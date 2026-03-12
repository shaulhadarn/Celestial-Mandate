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
import { getSkyColor, createPlanetProps, createCreatures, createCloudLayers, createGroundMist, createAtmosphericHaze } from './visuals_planet_environment.js';
import { hasGrass, createGrassMesh } from './visuals_planet_grass.js';
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

    // Zoom camera in for tight third-person soldier view
    planetState.targetCameraDistance = 8;
    planetState.targetCameraHeightOffset = 1.4;

    const bar = document.getElementById('soldier-control-bar');
    if (bar) bar.classList.remove('hidden');
    _updateUnitPanelHighlight();
}

function _switchToDrone() {
    if (planetState.controlTarget && planetState.controlTarget.userData) {
        planetState.controlTarget.userData._playerControlled = false;
    }
    planetState.controlTarget = null;

    // Restore drone camera distance
    planetState.targetCameraDistance = 18;
    planetState.targetCameraHeightOffset = 2;

    const bar = document.getElementById('soldier-control-bar');
    if (bar) bar.classList.add('hidden');
    _updateUnitPanelHighlight();
}

// ── Unit selection panel (right side quick-select) ──────────────────────────

function _updateUnitPanelHighlight() {
    const list = document.getElementById('unit-panel-list');
    if (!list) return;
    list.querySelectorAll('.unit-btn').forEach(btn => {
        const idx = parseInt(btn.dataset.soldierIdx, 10);
        const isDrone = btn.dataset.unitType === 'drone';
        const isActive = isDrone
            ? !planetState.controlTarget
            : (planetState.controlTarget === soldierMeshes[idx]);
        btn.classList.toggle('unit-active', isActive);
    });
}

function _buildUnitPanel() {
    const panel = document.getElementById('unit-panel');
    const list = document.getElementById('unit-panel-list');
    if (!panel || !list) return;
    list.innerHTML = '';

    // Drone button (always first)
    const droneBtn = document.createElement('button');
    droneBtn.className = 'unit-btn unit-active';
    droneBtn.dataset.unitType = 'drone';
    droneBtn.innerHTML = '<span class="unit-icon">🤖</span><span class="unit-label">Drone</span>';
    droneBtn.onclick = () => _switchToDrone();
    list.appendChild(droneBtn);

    // Soldier buttons
    soldierMeshes.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'unit-btn';
        btn.dataset.soldierIdx = i;
        btn.dataset.unitType = 'soldier';
        btn.innerHTML = `<span class="unit-icon">🪖</span><span class="unit-label">S-${i + 1}</span>`;
        btn.onclick = () => _switchToSoldier(soldierMeshes[i]);
        list.appendChild(btn);
    });

    panel.classList.toggle('hidden', soldierMeshes.length === 0);
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
    planetState.cloudLayers = [];
    planetState.groundMist = null;
    planetState.hazeMesh = null;
    planetState.grassData = null;
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

    // 5. Atmospheric particles — floating motes, pollen, spores
    {
        const particleGeo = new THREE.BufferGeometry();
        const pCount = isMobileDevice ? 120 : 400;
        const pPos = new Float32Array(pCount * 3);
        const pOffset = new Float32Array(pCount);   // unique phase per particle
        const pSpeed = new Float32Array(pCount);    // unique drift speed
        for (let i = 0; i < pCount; i++) {
            pPos[i * 3]     = (Math.random() - 0.5) * 300;
            pPos[i * 3 + 1] = Math.random() * 50 + 0.5;
            pPos[i * 3 + 2] = (Math.random() - 0.5) * 300;
            pOffset[i] = Math.random() * Math.PI * 2;
            pSpeed[i]  = 0.3 + Math.random() * 0.7; // varied individual speed
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        particleGeo.setAttribute('aOffset', new THREE.BufferAttribute(pOffset, 1));
        particleGeo.setAttribute('aSpeed', new THREE.BufferAttribute(pSpeed, 1));

        const dustShaderMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uMap: { value: textures.glow },
            },
            vertexShader: /* glsl */`
                attribute float aOffset;
                attribute float aSpeed;
                uniform float uTime;
                varying float vTwinkle;
                varying float vSize;
                void main() {
                    vec3 pos = position;
                    float t = uTime * 0.1 * aSpeed;
                    // Each particle drifts on its own Lissajous-like path (no shared direction)
                    float px = aOffset;
                    float py = aOffset * 1.7 + 3.14;
                    float pz = aOffset * 2.3 + 1.57;
                    pos.x += sin(t * 0.7 + px) * 8.0 + cos(t * 0.3 + px * 2.1) * 4.0;
                    pos.z += cos(t * 0.6 + pz) * 7.0 + sin(t * 0.25 + pz * 1.8) * 5.0;
                    // Gentle rise and fall
                    pos.y += sin(t * 0.4 + py) * 4.0 + cos(t * 0.15 + py * 0.7) * 2.0;
                    pos.y = max(pos.y, 0.5); // stay above ground
                    // Wrap in a large cube so particles always surround camera
                    pos.x = mod(pos.x + 150.0, 300.0) - 150.0;
                    pos.z = mod(pos.z + 150.0, 300.0) - 150.0;
                    // Twinkle: slow fade in/out per particle
                    vTwinkle = 0.15 + 0.85 * pow(0.5 + 0.5 * sin(uTime * 0.8 + aOffset * 4.0), 2.0);
                    // Size varies per particle
                    vSize = (1.5 + sin(aOffset * 3.0) * 1.0) * aSpeed;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = vSize / -mvPosition.z * 120.0;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D uMap;
                varying float vTwinkle;
                varying float vSize;
                void main() {
                    vec4 tex = texture2D(uMap, gl_PointCoord);
                    // Soft warm-white glow
                    vec3 col = vec3(1.0, 0.97, 0.9);
                    gl_FragColor = vec4(col, tex.a * 0.3 * vTwinkle);
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
    _buildUnitPanel();

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
        planetState.sunLight.shadow.camera.left = -120;
        planetState.sunLight.shadow.camera.right = 120;
        planetState.sunLight.shadow.camera.top = 120;
        planetState.sunLight.shadow.camera.bottom = -120;
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

    // 9. Cloud layers (only for atmospheric planet types)
    planetState.cloudLayers = createCloudLayers(planetData.type);
    planetState.cloudLayers.forEach(cl => group.add(cl));

    // 10. Ground mist (low-lying fog for atmosphere)
    planetState.groundMist = createGroundMist(planetData.type);
    if (planetState.groundMist) group.add(planetState.groundMist);

    // 11. Atmospheric haze (horizon gradient cylinder)
    planetState.hazeMesh = createAtmosphericHaze(skyColor, planetData.type);
    if (planetState.hazeMesh) group.add(planetState.hazeMesh);

    // 12. Grass (instanced blades for grassy planet types)
    if (hasGrass(planetData.type)) {
        planetState.grassData = createGrassMesh(planetData.type);
        if (planetState.grassData) group.add(planetState.grassData.mesh);
    }

    return planetState.playerMesh;
}

// ── Colony event listeners ──────────────────────────────────────────────────

events.addEventListener('building-complete', (e) => {
    if (gameState.viewMode === 'EXPLORATION' && planetState.currentPlanetData && e.detail.planetId === planetState.currentPlanetData.id) {
        updateColonyBuildings();
        _buildUnitPanel();
    }
});

events.addEventListener('harvester-complete', (e) => {
    if (gameState.viewMode === 'EXPLORATION' && planetState.currentPlanetData && e.detail.planetId === planetState.currentPlanetData.id) {
        updateColonyBuildings();
        _buildUnitPanel();
    }
});
