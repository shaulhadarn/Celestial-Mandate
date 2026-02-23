/* Updated: Clamped cameraPitch min to 0.05 (horizon) so camera can never look below ground in exploration mode */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { gameState, events } from '../core/state.js';
import { getTerrainHeight, createTerrainMesh, getGroundColor } from './visuals_planet_terrain.js';
import { createDroneMesh, createShadowSprite } from './visuals_planet_drone.js';
import { getSkyColor, createPlanetProps, createCreatures } from './visuals_planet_environment.js';
import { renderColonyGroundBuildings } from './visuals_planet_colony.js';

import { scene } from '../core/scene_config.js';

const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

let playerMesh;
let terrainMesh;
let planetProps = [];
let colonyBuildingsGroup = null;
let currentPlanetData = null;
let explorationGroup = null;
let sunLight = null;
const creatures = [];
const keyState = {};
const joystickInput = { x: 0, y: 0 };
let cameraYaw = Math.PI;
let cameraPitch = 0.4;
let cameraDistance = 18;
const CAMERA_DISTANCE_MIN = 5;
const CAMERA_DISTANCE_MAX = 60;
const CAMERA_HEIGHT_OFFSET = 2;
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Joystick zone: left 40% of screen width, bottom half
// Camera drag zone: right 60% of screen (or anywhere on desktop)
// Pinch-to-zoom: 2-finger touch anywhere
const JOYSTICK_ZONE_WIDTH_RATIO = 0.42; // left 42% reserved for joystick
let pinchStartDist = 0;
let isPinching = false;
let cameraDragTouchId = null; // track which touch is doing camera drag

function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function isInJoystickZone(x) {
    return x < window.innerWidth * JOYSTICK_ZONE_WIDTH_RATIO;
}

function initExplorationMouseControls() {
    // ── Mouse (desktop) ──────────────────────────────────────────────────────
    const onMouseDown = (e) => {
        isMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    };
    const onMouseUp = () => { isMouseDown = false; };
    const onMouseMoveExploration = (e) => {
        if (!isMouseDown || gameState.viewMode !== 'EXPLORATION') return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        cameraYaw -= dx * 0.005;
        cameraPitch = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraPitch + dy * 0.005));
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    };

    // ── Mouse wheel zoom ─────────────────────────────────────────────────────
    const onWheel = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;
        e.preventDefault();
        cameraDistance = Math.max(CAMERA_DISTANCE_MIN, Math.min(CAMERA_DISTANCE_MAX, cameraDistance + e.deltaY * 0.05));
    };

    // ── Touch ────────────────────────────────────────────────────────────────
    const onTouchStart = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;

        if (e.touches.length === 2) {
            // Two fingers = pinch zoom, cancel any single-touch drag
            isPinching = true;
            isMouseDown = false;
            cameraDragTouchId = null;
            pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
            e.preventDefault();
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            // Only start camera drag if touch is in the RIGHT zone (not joystick area)
            if (!isInJoystickZone(touch.clientX)) {
                isMouseDown = true;
                cameraDragTouchId = touch.identifier;
                lastMouseX = touch.clientX;
                lastMouseY = touch.clientY;
            }
        }
    };

    const onTouchEnd = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;

        if (e.touches.length < 2) {
            isPinching = false;
        }

        // Check if the camera drag touch was lifted
        const stillDown = Array.from(e.touches).some(t => t.identifier === cameraDragTouchId);
        if (!stillDown) {
            isMouseDown = false;
            cameraDragTouchId = null;
        }
    };

    const onTouchMove = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;
        e.preventDefault();

        // ── Pinch to zoom ────────────────────────────────────────────────────
        if (e.touches.length === 2 && isPinching) {
            const newDist = getTouchDistance(e.touches[0], e.touches[1]);
            const delta = pinchStartDist - newDist; // positive = fingers closer = zoom out
            cameraDistance = Math.max(CAMERA_DISTANCE_MIN, Math.min(CAMERA_DISTANCE_MAX, cameraDistance + delta * 0.05));
            pinchStartDist = newDist;
            return;
        }

        // ── Single touch camera drag ─────────────────────────────────────────
        if (!isMouseDown || !cameraDragTouchId) return;
        const touch = Array.from(e.touches).find(t => t.identifier === cameraDragTouchId);
        if (!touch) return;

        const dx = touch.clientX - lastMouseX;
        const dy = touch.clientY - lastMouseY;
        cameraYaw -= dx * 0.005;
        cameraPitch = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraPitch + dy * 0.005));
        lastMouseX = touch.clientX;
        lastMouseY = touch.clientY;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMoveExploration);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
}
initExplorationMouseControls();

export function createPlanetVisuals(planetData, group) {
    planetProps = [];
    creatures.length = 0;
    currentPlanetData = planetData;
    explorationGroup = group;
    while(group.children.length > 0) group.remove(group.children[0]);

    // Ice/Arctic now have dark sky colors — treat them as dark for lighting purposes
    const isDark = ['Barren', 'Tomb', 'Molten', 'Ice', 'Arctic'].includes(planetData.type);
    const skyColor = getSkyColor(planetData.type);

    // Dynamic Fog for atmosphere depth
    let fogDensity = 0.002;
    if (planetData.type === 'Ocean') fogDensity = 0.004;
    if (planetData.type === 'Ice' || planetData.type === 'Arctic') fogDensity = 0.003; // Light haze
    if (planetData.type === 'Tomb' || planetData.type === 'Molten') fogDensity = 0.006;
    if (planetData.type === 'Barren') fogDensity = 0.0005; // Thin atmosphere
    
    if (scene) {
        scene.fog = new THREE.FogExp2(skyColor, fogDensity);
        scene.background = new THREE.Color(skyColor);
    }

    // 1. Sky (Kept as a fallback/backdrop)
    const skyGeo = new THREE.SphereGeometry(600, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
    group.add(new THREE.Mesh(skyGeo, skyMat));

    if (isDark) {
        const starsGeo = new THREE.BufferGeometry();
        const starsCount = 1000;
        const starPos = new Float32Array(starsCount * 3);
        for(let i=0; i<starsCount*3; i++) starPos[i] = (Math.random() - 0.5) * 1000;
        starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        group.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2, transparent: true, opacity: 0.8})));
    }

    // 2. Terrain
    terrainMesh = createTerrainMesh(planetData.type);
    group.add(terrainMesh);

    // 3. Drone
    playerMesh = createDroneMesh();
    const spawnX = 25, spawnZ = 25;
    const spawnGroundH = getTerrainHeight(spawnX, spawnZ);
    playerMesh.position.set(spawnX, spawnGroundH + 4.5, spawnZ); 
    
    const shadowMesh = createShadowSprite();
    group.add(shadowMesh);
    playerMesh.userData = { 
        ...playerMesh.userData, 
        velocity: new THREE.Vector3(), 
        shadowMesh,
        lastPos: playerMesh.position.clone() 
    };
    group.add(playerMesh);

    // 4. Props
    planetProps = createPlanetProps(planetData.type, group, getTerrainHeight);

    // 5. Particles — mobile: 60 instead of 200 (fewer point sprites = fewer overdraw passes)
    const particleGeo = new THREE.BufferGeometry();
    const pCount = isMobileDevice ? 60 : 200;
    const pPos = new Float32Array(pCount * 3);
    for(let i=0; i<pCount*3; i++) pPos[i] = (Math.random() - 0.5) * 200;
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.4, map: textures.glow, blending: THREE.AdditiveBlending, depthWrite: false });
    const p = new THREE.Points(particleGeo, pMat);
    p.userData = { isDust: true };
    group.add(p);

    // 6. Colony (hidden on landing - exploration starts with drone only)
    colonyBuildingsGroup = new THREE.Group();
    colonyBuildingsGroup.visible = false;
    group.add(colonyBuildingsGroup);
    updateColonyBuildings();

    // 7. Creatures
    const alienList = createCreatures(planetData.type, group, getTerrainHeight);
    alienList.forEach(c => creatures.push(c));

    // 8. Lights
    const sunColor = isDark ? 0xffbb88 : 0xffffff;
    sunLight = new THREE.DirectionalLight(sunColor, isDark ? 2.0 : 2.8);
    sunLight.position.set(100, 200, 100);
    // Mobile: castShadow=false — shadow map is the #1 GPU cost in exploration view
    sunLight.castShadow = !isMobileDevice;
    if (!isMobileDevice) {
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -80;
        sunLight.shadow.camera.right = 80;
        sunLight.shadow.camera.top = 80;
        sunLight.shadow.camera.bottom = -80;
        sunLight.shadow.bias = -0.0005;
    }
    group.add(sunLight);
    group.add(sunLight.target);

    // Fill light from opposite side — prevents pitch-black terrain on shadowed faces
    const fillLight = new THREE.DirectionalLight(isDark ? 0x334466 : 0x8899bb, isDark ? 0.8 : 0.5);
    fillLight.position.set(-80, 60, -80);
    fillLight.castShadow = false;
    group.add(fillLight);

    // Ambient floor — guarantees minimum visibility everywhere regardless of surface angle
    const ambientColor = isDark ? 0x223344 : 0x445566;
    const ambientIntensity = isDark ? 1.2 : 0.9;
    group.add(new THREE.AmbientLight(ambientColor, ambientIntensity));

    // Hemisphere light — sky/ground gradient for natural outdoor look
    const hemiIntensity = isDark ? 0.8 : 1.2;
    group.add(new THREE.HemisphereLight(skyColor, getGroundColor(planetData.type), hemiIntensity));

    return playerMesh;
}

export function updatePlanetPhysics(dt, camera, controls, group) {
    if (!playerMesh || !camera) return;

    // --- 1. Camera Position (before movement so direction vectors are correct) ---
    const droneCenter = playerMesh.position.clone().add(new THREE.Vector3(0, CAMERA_HEIGHT_OFFSET, 0));
    const camX = droneCenter.x + cameraDistance * Math.sin(cameraYaw) * Math.cos(cameraPitch);
    const camY = droneCenter.y + cameraDistance * Math.sin(cameraPitch);
    const camZ = droneCenter.z + cameraDistance * Math.cos(cameraYaw) * Math.cos(cameraPitch);
    camera.position.set(camX, camY, camZ);
    camera.lookAt(droneCenter);

    // --- 2. Movement Direction (derived from cameraYaw, not camera.quaternion) ---
    const speed = 40;
    const drag = 0.92;
    const velocity = playerMesh.userData.velocity;
    const inputDir = new THREE.Vector3();

    // Forward = direction camera is facing (flattened to XZ plane)
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    // Right vector is perpendicular to forward vector
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    if (keyState['w']) inputDir.add(forward);
    if (keyState['s']) inputDir.sub(forward);
    if (keyState['a']) inputDir.sub(right);
    if (keyState['d']) inputDir.add(right);
    if (Math.abs(joystickInput.x) > 0.1 || Math.abs(joystickInput.y) > 0.1) {
        inputDir.add(forward.clone().multiplyScalar(joystickInput.y).add(right.clone().multiplyScalar(joystickInput.x)));
    }

    if (inputDir.length() > 0) {
        inputDir.normalize();
        velocity.add(inputDir.multiplyScalar(speed * dt));
    }

    // --- 3. Apply Movement with slope collision ---
    const nextPos = playerMesh.position.clone().add(velocity.clone().multiplyScalar(dt));
    // Sample a small grid at next position to get worst-case terrain height
    let nextGroundH = getTerrainHeight(nextPos.x, nextPos.z);
    const NS = 3;
    for (const [ox, oz] of [[-NS,0],[NS,0],[0,-NS],[0,NS]]) {
        nextGroundH = Math.max(nextGroundH, getTerrainHeight(nextPos.x + ox, nextPos.z + oz));
    }
    nextGroundH += 1.2; // noise margin
    // Only block if terrain at next step is above drone's current Y (would clip into slope)
    if (nextGroundH >= playerMesh.position.y) {
        // Terrain is above drone - stop horizontal movement, let hover push drone up first
        velocity.x = 0;
        velocity.z = 0;
    } else {
        playerMesh.position.add(velocity.clone().multiplyScalar(dt));
    }
    velocity.multiplyScalar(drag);

    // --- 4. Drone Rotation (face movement direction) ---
    if (velocity.length() > 0.1) {
        const targetRot = Math.atan2(velocity.x, velocity.z);
        let diff = targetRot - playerMesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        playerMesh.rotation.y += diff * 12 * dt;
        playerMesh.rotation.z = THREE.MathUtils.lerp(playerMesh.rotation.z, -diff * velocity.length() * 0.05, 10 * dt);
        playerMesh.rotation.x = 0; 
    } else {
        playerMesh.rotation.z *= 0.9;
        playerMesh.rotation.x *= 0.9;
    }

    // --- 5. Drone Visual Effects ---
    const time = Date.now() * 0.002;
    if (playerMesh.userData.flare) {
        const flicker = 0.8 + Math.random() * 0.4;
        const moving = velocity.length() > 0.1;
        playerMesh.userData.flare.scale.lerp(new THREE.Vector3((moving ? 4 : 2.5) * flicker, (moving ? 4 : 2.5) * flicker, 1), 0.1);
        playerMesh.userData.flare.material.opacity = 0.4 + (moving ? 0.4 : 0.1);
    }

    // --- 6. Ground Height & Hover ---
    const HOVER_BUFFER = 6.0;  // target hover height above ground
    const HOVER_MIN = 5.0;     // absolute minimum clearance - hard floor
    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    // Sample terrain at current pos + wide grid + ahead in velocity direction
    let groundH = getTerrainHeight(px, pz);
    const R = 5; // sample radius
    const sampleOffsets = [
        [-R,0],[R,0],[0,-R],[0,R],
        [-R,-R],[R,-R],[-R,R],[R,R],
        [-R*0.5,0],[R*0.5,0],[0,-R*0.5],[0,R*0.5]
    ];
    for (const [ox, oz] of sampleOffsets) {
        groundH = Math.max(groundH, getTerrainHeight(px + ox, pz + oz));
    }
    // Look ahead in velocity direction to pre-empt rising slopes
    const velLen = velocity.length();
    if (velLen > 0.1) {
        const lookAhead = 8;
        const vx = velocity.x / velLen;
        const vz = velocity.z / velLen;
        groundH = Math.max(groundH, getTerrainHeight(px + vx * lookAhead, pz + vz * lookAhead));
        groundH = Math.max(groundH, getTerrainHeight(px + vx * lookAhead * 0.5, pz + vz * lookAhead * 0.5));
    }
    // Add margin for mesh micro-noise (±0.4 per vertex)
    groundH += 1.2;

    for (const prop of planetProps) {
        const distSq = (px - prop.x)**2 + (pz - prop.z)**2;
        if (distSq < prop.r * prop.r) groundH = Math.max(groundH, prop.topY);
    }

    const targetY = groundH + HOVER_BUFFER + Math.sin(time) * 0.3;
    if (playerMesh.position.y < groundH + HOVER_MIN) {
        // Hard snap - never allow drone below minimum clearance
        playerMesh.position.y = groundH + HOVER_MIN;
    } else if (playerMesh.position.y < targetY) {
        // Terrain rising - snap up immediately, no lerp
        playerMesh.position.y = targetY;
    } else {
        // Gentle float down when above target
        playerMesh.position.y += (targetY - playerMesh.position.y) * 4 * dt;
    }

    // --- 7. Shadow ---
    if (playerMesh.userData.shadowMesh) {
        const sm = playerMesh.userData.shadowMesh;
        sm.position.set(playerMesh.position.x, groundH + 0.12, playerMesh.position.z);
        const dist = playerMesh.position.y - groundH;
        sm.scale.setScalar(1.2 + (dist * 0.12));
        sm.material.opacity = Math.max(0, 0.7 - (dist * 0.08));
    }

    // --- 7b. Sun light follows drone — keeps shadow frustum centred on player ---
    if (sunLight) {
        const dx = playerMesh.position.x;
        const dz = playerMesh.position.z;
        sunLight.position.set(dx + 100, 200, dz + 100);
        sunLight.target.position.set(dx, 0, dz);
        sunLight.target.updateMatrixWorld();
        sunLight.shadow.camera.updateProjectionMatrix();
    }

    // --- 8. Dust & Creatures ---
    group.children.forEach(child => { if (child.isPoints && child.userData.isDust) { child.rotation.y += 0.05 * dt; child.position.y = Math.sin(time * 0.5) * 5; } });

    creatures.forEach(c => {
        const ud = c.userData;
        ud.phase += dt * ud.speed;

        const roam   = ud.roamRadius  || 10;
        const bob    = ud.bobHeight   || 0.4;
        const bscale = ud.bodyScale   || 1.0;

        const targetX = ud.originX + Math.cos(ud.phase) * roam;
        const targetZ = ud.originZ + Math.sin(ud.phase) * roam;

        c.position.x = THREE.MathUtils.lerp(c.position.x, targetX, 0.5 * dt);
        c.position.z = THREE.MathUtils.lerp(c.position.z, targetZ, 0.5 * dt);
        c.position.y = getTerrainHeight(c.position.x, c.position.z) + bscale * 0.9
                       + Math.abs(Math.sin(ud.phase * 4)) * bob;

        // Face movement direction
        const dx = targetX - c.position.x;
        const dz = targetZ - c.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.01) {
            c.rotation.y = Math.atan2(dx, dz);
        }

        // Leg swing — children after index 3 are legs (body, head, eye×2, then legs)
        const legStart = ud.legStartIdx || 4;
        const legCount = ud.legCount    || 4;
        for (let li = 0; li < legCount * 2; li++) {
            const child = c.children[legStart + li];
            if (!child) continue;
            const side  = li % 2 === 0 ? 1 : -1;
            const swing = Math.sin(ud.phase * 6 + li * 0.8) * 0.35;
            child.rotation.x = swing * side;
        }
    });

    // --- 9. Final Camera Update (after drone position is finalized) ---
    const finalCenter = playerMesh.position.clone().add(new THREE.Vector3(0, CAMERA_HEIGHT_OFFSET, 0));
    const finalCamX = finalCenter.x + cameraDistance * Math.sin(cameraYaw) * Math.cos(cameraPitch);
    const finalCamY = finalCenter.y + cameraDistance * Math.sin(cameraPitch);
    const finalCamZ = finalCenter.z + cameraDistance * Math.cos(cameraYaw) * Math.cos(cameraPitch);
    camera.position.set(finalCamX, finalCamY, finalCamZ);
    camera.lookAt(finalCenter);
}

function updateColonyBuildings() {
    if (!colonyBuildingsGroup || !currentPlanetData) return;
    renderColonyGroundBuildings(currentPlanetData.id, colonyBuildingsGroup, getTerrainHeight);
}

export function handleInput(key, pressed) {
    const k = key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) {
        if(k === 'arrowup') keyState['w'] = pressed;
        else if(k === 'arrowdown') keyState['s'] = pressed;
        else if(k === 'arrowleft') keyState['a'] = pressed;
        else if(k === 'arrowright') keyState['d'] = pressed;
        else keyState[k] = pressed;
    }
}

export function setJoystickInput(x, y) { joystickInput.x = x; joystickInput.y = y; }

events.addEventListener('building-complete', (e) => {
    if (gameState.viewMode === 'EXPLORATION' && currentPlanetData && e.detail.planetId === currentPlanetData.id) updateColonyBuildings();
});

// removed function getTerrainHeight() {} (moved to visuals_planet_terrain.js)
// removed function getSkyColor() {} (moved to visuals_planet_environment.js)
// removed function getGroundColor() {} (moved to visuals_planet_terrain.js)
// removed function getPropColor() {} (moved to visuals_planet_environment.js)
// removed function getGroundTexture() {} (moved to visuals_planet_terrain.js)
// removed function createShadowTexture() {} (moved to visuals_planet_drone.js)
// removed function createCreatures() {} (moved to visuals_planet_environment.js)