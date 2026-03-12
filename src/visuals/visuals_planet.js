/**
 * Planet exploration orchestrator.
 * Wires together sub-modules; keeps createPlanetVisuals (the scene assembly function)
 * and re-exports the public API unchanged for renderer.js and ui.js.
 */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { gameState, events, BUILDINGS } from '../core/state.js';
import { disposeGroup } from '../core/dispose.js';
import { scene } from '../core/scene_config.js';
import { isMobile as isMobileDevice } from '../core/device.js';

import planetState from './visuals_planet_state.js';
import { getTerrainHeight, createTerrainMesh, getGroundColor } from './visuals_planet_terrain.js';
import { createDroneMesh, createShadowSprite } from './visuals_planet_drone.js';
import { getSkyColor, createPlanetProps, createCreatures } from './visuals_planet_environment.js';
import { renderColonyGroundBuildings, soldierMeshes } from './visuals_planet_colony.js';

// Sub-modules — import also registers the mouse/touch listeners (self-invoking init)
import { handleInput, setJoystickInput } from './visuals_planet_input.js';
import { updatePlanetPhysics, updateColonyBuildings, resetCachedDOM } from './visuals_planet_update.js';
import { exitPlacementMode, initHUD } from './visuals_planet_hud.js';

// Wire HUD → update dependency (breaks potential circular import)
initHUD(updateColonyBuildings);

// Re-export public API (unchanged for renderer.js and ui.js)
export { handleInput, setJoystickInput, updatePlanetPhysics };

// ── Building info tooltip auto-dismiss timer ────────────────────────────────
let _buildingInfoTimer = null;

function _showBuildingInfo(buildingKey) {
    const tooltip = document.getElementById('building-info-tooltip');
    if (!tooltip) return;
    const data = buildingKey === '_hub'
        ? { name: 'Colony Hub', icon: '🏛️', production: {} }
        : BUILDINGS[buildingKey];
    if (!data) return;

    document.getElementById('building-info-icon').textContent = data.icon || '🏗️';
    document.getElementById('building-info-name').textContent = data.name;

    const prodParts = [];
    if (data.production) {
        for (const [res, amt] of Object.entries(data.production)) {
            if (amt) prodParts.push(`+${amt} ${res}`);
        }
    }
    document.getElementById('building-info-production').textContent = prodParts.length ? prodParts.join(', ') : '';

    tooltip.classList.remove('hidden');
    if (_buildingInfoTimer) clearTimeout(_buildingInfoTimer);
    _buildingInfoTimer = setTimeout(() => { tooltip.classList.add('hidden'); }, 3000);
}

function _hideBuildingInfo() {
    const tooltip = document.getElementById('building-info-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
    if (_buildingInfoTimer) { clearTimeout(_buildingInfoTimer); _buildingInfoTimer = null; }
}

// ── Soldier control switching ───────────────────────────────────────────────

function _switchToSoldier(soldier) {
    // Release previous soldier if any
    if (planetState.controlTarget && planetState.controlTarget.userData) {
        planetState.controlTarget.userData._playerControlled = false;
    }
    planetState.controlTarget = soldier;
    soldier.userData._playerControlled = true;
    // Give soldier a velocity vector if it doesn't have one
    if (!soldier.userData.velocity) soldier.userData.velocity = new THREE.Vector3();
    else soldier.userData.velocity.set(0, 0, 0);

    const bar = document.getElementById('soldier-control-bar');
    if (bar) bar.classList.remove('hidden');
}

function _switchToDrone() {
    if (planetState.controlTarget && planetState.controlTarget.userData) {
        planetState.controlTarget.userData._playerControlled = false;
    }
    planetState.controlTarget = null;
    const bar = document.getElementById('soldier-control-bar');
    if (bar) bar.classList.add('hidden');
}

// ── Exploration tap handler (called from renderer.js) ───────────────────────

export function handleExplorationTap(raycaster, mouse, camera) {
    raycaster.setFromCamera(mouse, camera);

    // Raycast against soldiers first (smaller targets, higher priority)
    if (soldierMeshes.length > 0) {
        const soldierHits = raycaster.intersectObjects(soldierMeshes, true);
        if (soldierHits.length > 0) {
            // Traverse up to find the soldier root with userData.isSoldier
            let obj = soldierHits[0].object;
            while (obj) {
                if (obj.userData && obj.userData.isSoldier) {
                    _switchToSoldier(obj);
                    _hideBuildingInfo();
                    return;
                }
                obj = obj.parent;
            }
        }
    }

    // Raycast against colony buildings
    if (planetState.colonyBuildingsGroup && planetState.colonyBuildingsGroup.children.length > 0) {
        const buildingHits = raycaster.intersectObjects(planetState.colonyBuildingsGroup.children, true);
        if (buildingHits.length > 0) {
            let obj = buildingHits[0].object;
            while (obj) {
                if (obj.userData && obj.userData.buildingKey) {
                    _showBuildingInfo(obj.userData.buildingKey);
                    return;
                }
                if (obj.userData && obj.userData.isHub) {
                    _showBuildingInfo('_hub');
                    return;
                }
                obj = obj.parent;
            }
        }
    }

    // Nothing relevant hit — dismiss tooltip
    _hideBuildingInfo();
}

// ── Scene assembly ──────────────────────────────────────────────────────────

export function createPlanetVisuals(planetData, group) {
    exitPlacementMode();
    resetCachedDOM();
    _switchToDrone();                 // reset soldier control on planet change
    _hideBuildingInfo();
    planetState.planetProps = [];
    planetState.creatures.length = 0;
    planetState.dustMesh = null;
    planetState.currentPlanetData = planetData;
    planetState.explorationGroup = group;
    disposeGroup(group);

    // Wire "Back to Drone" button
    const backBtn = document.getElementById('btn-back-to-drone');
    if (backBtn) {
        backBtn.onclick = () => _switchToDrone();
    }

    const isDark = ['Barren', 'Tomb', 'Molten', 'Ice', 'Arctic'].includes(planetData.type);
    const skyColor = getSkyColor(planetData.type);

    // Dynamic Fog
    let fogDensity = 0.002;
    if (planetData.type === 'Ocean') fogDensity = 0.004;
    if (planetData.type === 'Ice' || planetData.type === 'Arctic') fogDensity = 0.003;
    if (planetData.type === 'Tomb' || planetData.type === 'Molten') fogDensity = 0.006;
    if (planetData.type === 'Barren') fogDensity = 0.0005;

    if (scene) {
        scene.fog = new THREE.FogExp2(skyColor, fogDensity);
        scene.background = new THREE.Color(skyColor);
    }

    // 1. Sky
    const skyGeo = new THREE.SphereGeometry(600, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
    group.add(new THREE.Mesh(skyGeo, skyMat));

    if (isDark) {
        const starsGeo = new THREE.BufferGeometry();
        const starsCount = 1000;
        const starPos = new Float32Array(starsCount * 3);
        for (let i = 0; i < starsCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 1000;
        starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        group.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.8 })));
    }

    // 2. Terrain
    planetState.terrainMesh = createTerrainMesh(planetData.type);
    group.add(planetState.terrainMesh);

    // 3. Drone
    planetState.playerMesh = createDroneMesh();
    const hasColony = !!gameState.colonies[planetData.id];
    const spawnX = hasColony ? 0 : 25;
    const spawnZ = hasColony ? 10 : 25;
    const spawnGroundH = getTerrainHeight(spawnX, spawnZ);
    planetState.playerMesh.position.set(spawnX, spawnGroundH + 4.5, spawnZ);

    const shadowMesh = createShadowSprite();
    group.add(shadowMesh);
    planetState.playerMesh.userData = {
        ...planetState.playerMesh.userData,
        velocity: new THREE.Vector3(),
        shadowMesh,
        lastPos: planetState.playerMesh.position.clone()
    };
    group.add(planetState.playerMesh);

    // 3b. Engine trail sprites — world space
    if (planetState.playerMesh.userData.engineTrails) {
        planetState.playerMesh.userData.engineTrails.forEach(p => group.add(p.sprite));
    }

    // 4. Props
    planetState.planetProps = createPlanetProps(planetData.type, group, getTerrainHeight);

    // 5. Particles — GPU-animated dust
    {
        const particleGeo = new THREE.BufferGeometry();
        const pCount = isMobileDevice ? 60 : 200;
        const pPos = new Float32Array(pCount * 3);
        const pOffset = new Float32Array(pCount);
        for (let i = 0; i < pCount; i++) {
            pPos[i * 3]     = (Math.random() - 0.5) * 200;
            pPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
            pPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
            pOffset[i] = Math.random() * Math.PI * 2;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        particleGeo.setAttribute('aOffset', new THREE.BufferAttribute(pOffset, 1));

        const dustShaderMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uMap: { value: textures.glow },
            },
            vertexShader: /* glsl */`
                attribute float aOffset;
                uniform float uTime;
                varying float vTwinkle;
                void main() {
                    vec3 pos = position;
                    pos.y += sin(uTime * 0.5 + aOffset) * 5.0;
                    pos.x += sin(uTime * 0.3 + aOffset * 1.7) * 1.5;
                    pos.z += cos(uTime * 0.25 + aOffset * 2.3) * 1.5;
                    vTwinkle = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 2.0 + aOffset * 3.0));
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = 4.0 / -mvPosition.z * 100.0;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap;
                varying float vTwinkle;
                void main() {
                    vec4 tex = texture2D(uMap, gl_PointCoord);
                    gl_FragColor = vec4(1.0, 1.0, 1.0, tex.a * 0.4 * vTwinkle);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const p = new THREE.Points(particleGeo, dustShaderMat);
        p.userData = { isDust: true };
        planetState.dustMesh = p;
        group.add(p);
    }

    // 6. Colony buildings
    planetState.colonyBuildingsGroup = new THREE.Group();
    planetState.colonyBuildingsGroup.visible = !!gameState.colonies[planetData.id];
    group.add(planetState.colonyBuildingsGroup);
    updateColonyBuildings();

    // 7. Creatures (with blob shadows)
    const alienList = createCreatures(planetData.type, group, getTerrainHeight);
    alienList.forEach(c => {
        const creatureShadow = createShadowSprite();
        const bs = c.userData.bodyScale || 1;
        creatureShadow.scale.setScalar(bs * 1.6);
        group.add(creatureShadow);
        c.userData.shadowMesh = creatureShadow;
        planetState.creatures.push(c);
    });

    // 8. Lights
    const sunColor = isDark ? 0xffbb88 : 0xffffff;
    planetState.sunLight = new THREE.DirectionalLight(sunColor, isDark ? 2.0 : 2.8);
    planetState.sunLight.position.set(100, 200, 100);
    planetState.sunLight.castShadow = !isMobileDevice;
    if (!isMobileDevice) {
        planetState.sunLight.shadow.mapSize.set(4096, 4096);
        planetState.sunLight.shadow.camera.near = 10;
        planetState.sunLight.shadow.camera.far = 400;
        planetState.sunLight.shadow.camera.left = -40;
        planetState.sunLight.shadow.camera.right = 40;
        planetState.sunLight.shadow.camera.top = 40;
        planetState.sunLight.shadow.camera.bottom = -40;
        planetState.sunLight.shadow.bias = -0.0003;
        planetState.sunLight.shadow.normalBias = 0.02;
    }
    group.add(planetState.sunLight);
    group.add(planetState.sunLight.target);

    const fillLight = new THREE.DirectionalLight(isDark ? 0x334466 : 0x8899bb, isDark ? 0.8 : 0.5);
    fillLight.position.set(-80, 60, -80);
    fillLight.castShadow = false;
    group.add(fillLight);

    const ambientColor = isDark ? 0x223344 : 0x445566;
    const ambientIntensity = isDark ? 1.2 : 0.9;
    group.add(new THREE.AmbientLight(ambientColor, ambientIntensity));

    const hemiIntensity = isDark ? 0.8 : 1.2;
    group.add(new THREE.HemisphereLight(skyColor, getGroundColor(planetData.type), hemiIntensity));

    return planetState.playerMesh;
}

// ── Colony event listeners ──────────────────────────────────────────────────

events.addEventListener('building-complete', (e) => {
    if (gameState.viewMode === 'EXPLORATION' && planetState.currentPlanetData && e.detail.planetId === planetState.currentPlanetData.id)
        updateColonyBuildings();
});

events.addEventListener('harvester-complete', (e) => {
    if (gameState.viewMode === 'EXPLORATION' && planetState.currentPlanetData && e.detail.planetId === planetState.currentPlanetData.id)
        updateColonyBuildings();
});
