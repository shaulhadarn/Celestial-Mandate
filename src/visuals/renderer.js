/* Updated: Fixed mobile tap-through — UI taps no longer trigger 3D raycasts (diplomacy button fix) */
import * as THREE from 'three';
import { gameState, selectSystem, selectPlanet, getSystem, events } from '../core/state.js';
import { loadAssets, playSound } from '../core/assets.js';
import { scene, camera, renderer, composer, controls, groups, initRenderer as initSceneConfig } from '../core/scene_config.js';
import { createGalaxyVisuals, updateGalaxyAnimations, starMeshes } from './visuals_galaxy.js';
import { createSystemVisuals, updateSystemAnimations, addColonyVisual, planetMeshes, planetLabels } from './visuals_system.js';
import { createPlanetVisuals, updatePlanetPhysics, handleInput } from './visuals_planet.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let cachedHyperlanes = [];

// Saved OrbitControls state before entering planet exploration
let savedControlsState = null;

export async function init() {
    loadAssets();
    initSceneConfig();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);
    // Touch support mapping — pass original event so handleTap can check event.target
    window.addEventListener('touchmove', (e) => onMouseMove(e.touches[0]));
    window.addEventListener('touchstart', (e) => onPointerDown(e.touches[0]));
    window.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        // Attach the real DOM target from the TouchEvent so handleTap can filter UI taps
        const synth = { clientX: t.clientX, clientY: t.clientY, target: e.target };
        onPointerUp(synth);
    });

    window.addEventListener('keydown', (e) => handleInput(e.key, true));
    window.addEventListener('keyup', (e) => handleInput(e.key, false));

    // Events
    events.addEventListener('colony-founded', (e) => {
        if (gameState.viewMode === 'SYSTEM') {
            const planetId = e.detail.planetId;
            const mesh = planetMeshes.find(m => m.userData.id === planetId);
            if (mesh) {
                addColonyVisual(mesh);
                playSound('select'); 
            }
        } else if (gameState.viewMode === 'GALAXY') {
            buildGalaxyVisuals(gameState.systems, cachedHyperlanes);
            playSound('select');
        }
    });

    // Start render loop immediately
    requestAnimationFrame(animate);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

let pointerDownTime = 0;
let pointerDownPos = new THREE.Vector2();

function onPointerDown(event) {
    pointerDownTime = Date.now();
    pointerDownPos.set(event.clientX, event.clientY);
}

function onPointerUp(event) {
    // Calculate duration and distance to distinguish tap from drag
    const duration = Date.now() - pointerDownTime;
    const dist = pointerDownPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));

    // Thresholds: < 500ms duration, < 20px movement (Relaxed for easier tapping)
    if (duration < 500 && dist < 20) {
        handleTap(event);
    }
}

function handleTap(event) {
    if (gameState.viewMode === 'EXPLORATION') return;
    
    // Safety guard: Ensure raycaster, mouse, and camera are ready
    if (!raycaster || !mouse || !camera) return;

    // Ignore taps on UI elements — prevents buttons from triggering 3D raycasts
    const target = event.target || event.srcElement;
    if (target && target.closest && target.closest('#ui-layer')) return;

    // Update mouse coordinates for raycaster exactly at tap location
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (gameState.viewMode === 'GALAXY') {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(starMeshes);
        
        if (intersects.length > 0) {
            const sysId = intersects[0].object.userData.id;
            if (getSystem(sysId)) {
                selectSystem(sysId);
                playSound('select');
                enterSystemView(sysId);
            }
        }
    } else if (gameState.viewMode === 'SYSTEM') {
        raycaster.setFromCamera(mouse, camera);
        
        // Target planets (recursive) and labels
        const labelSprites = planetLabels.map(l => l.sprite);
        const targets = [...planetMeshes, ...labelSprites];

        const intersects = raycaster.intersectObjects(targets, true);
        
        if (intersects.length > 0) {
            let target = intersects[0].object;
            let pId = null;

            // Traverse up hierarchy to find ID (handles hitting children like atmosphere)
            while (target) {
                if (target.userData && target.userData.id) {
                    pId = target.userData.id;
                    break;
                }
                target = target.parent;
            }

            if (pId) {
                selectPlanet(pId);
                playSound('select');
            }
        }
    }
}

export function buildGalaxyVisuals(systems, hyperlanes) {
    if (hyperlanes) cachedHyperlanes = hyperlanes;
    // Removed: Galaxy building logic (moved to visuals_galaxy.js)
    createGalaxyVisuals(systems, cachedHyperlanes, groups.galaxy);
}

export function enterSystemView(systemId, instant = false) {
    // Safety check for R3F initialization
    if (!controls || !camera) {
        console.warn("enterSystemView: Scene not ready");
        return;
    }

    gameState.viewMode = 'SYSTEM';

    // Reset background and fog to deep space defaults
    if (scene) {
        scene.background = new THREE.Color(0x020408);
        scene.fog = new THREE.FogExp2(0x020408, 0.0015);
    }
    
    // Re-enable OrbitControls — boost speeds for tighter system-scale interaction
    if (controls) {
        controls.enabled = true;
        controls.minDistance = 10;
        controls.maxDistance = 300;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
        controls.rotateSpeed = 1.0;
        controls.panSpeed = 1.4;
        controls.zoomSpeed = 1.2;
    }

    groups.galaxy.visible = false;
    groups.system.visible = true;
    groups.planet.visible = false; // Hide planetary view

    const sys = getSystem(systemId);
    if (!sys) return;
    
    // Build new system visuals
    createSystemVisuals(sys, groups.system);

    const targetPos = new THREE.Vector3(0, 0, 0);

    if (instant) {
        // Instant camera jump
        camera.position.set(0, 40, 50);
        controls.target.copy(targetPos);
        controls.update();
    } else {
        // Animate camera
        animateCamera(targetPos, 50, 40);
    }

    // Force R3F to render frames immediately — fixes mobile black screen on view switch
    _forceFrames(6);
}

export function returnToGalaxyView() {
    gameState.viewMode = 'GALAXY';

    // Reset background and fog to deep space defaults
    if (scene) {
        scene.background = new THREE.Color(0x020408);
        scene.fog = new THREE.FogExp2(0x020408, 0.0015);
    }

    // Restore OrbitControls to galaxy defaults
    if (controls) {
        controls.enabled = true;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 0.6;
        controls.panSpeed = 0.8;
        controls.zoomSpeed = 0.8;
    }
    
    buildGalaxyVisuals(gameState.systems, cachedHyperlanes);

    groups.galaxy.visible = true;
    groups.system.visible = false;
    groups.planet.visible = false;

    // Clean up system view to save resources
    while(groups.system.children.length > 0) groups.system.remove(groups.system.children[0]);
    planetMeshes.length = 0; 

    // Restore Camera
    if (gameState.selectedSystemId !== null) {
        const sys = getSystem(gameState.selectedSystemId);
        if (sys) {
            focusCamera(sys.position, 60);
        }
    }
    controls.minDistance = 20;
    controls.maxDistance = 400;

    // Force R3F to render frames immediately — fixes mobile black screen on return
    // (frameloop:"demand" won't auto-render until invalidate is called)
    _forceFrames(6);
}

function _forceFrames(count) {
    if (count <= 0) return;
    if (window.__r3fInvalidate) window.__r3fInvalidate();
    if (renderer && scene && camera) renderer.render(scene, camera);
    requestAnimationFrame(() => _forceFrames(count - 1));
}

export function enterPlanetView(planetData) {
    if (!controls || !camera) {
        console.error("enterPlanetView: Scene not ready");
        return;
    }

    // Save full OrbitControls state before disabling so we can restore it exactly
    savedControlsState = {
        target: controls.target.clone(),
        position: camera.position.clone(),
        zoom: camera.zoom,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        enablePan: controls.enablePan,
        enableDamping: controls.enableDamping,
        dampingFactor: controls.dampingFactor
    };

    gameState.viewMode = 'EXPLORATION';

    groups.galaxy.visible = false;
    groups.system.visible = false;
    groups.planet.visible = true;

    const playerMesh = createPlanetVisuals(planetData, groups.planet);

    // Setup Camera for 3rd Person - position behind drone
    const droneCenter = playerMesh.position.clone().add(new THREE.Vector3(0, 2, 0));
    camera.position.set(
        droneCenter.x + 18 * Math.sin(Math.PI) * Math.cos(0.4),
        droneCenter.y + 18 * Math.sin(0.4),
        droneCenter.z + 18 * Math.cos(Math.PI) * Math.cos(0.4)
    );
    camera.lookAt(droneCenter);
    
    controls.enabled = false; // Disable OrbitControls entirely during exploration

    // Reset physics state to prevent camera jumps on first frame
    if (playerMesh && playerMesh.userData) {
        if (!playerMesh.userData.lastPos) playerMesh.userData.lastPos = new THREE.Vector3();
        playerMesh.userData.lastPos.copy(playerMesh.position);
    }
}

export function restoreControlsAfterPlanet() {
    if (!controls || !camera) return;

    // controls.reset() flushes all internal _spherical, _sphericalDelta,
    // _panOffset, _scale state that accumulated while controls were disabled
    controls.reset();

    // Always reset to the default system view camera — same as enterSystemView
    controls.target.set(0, 0, 0);
    camera.position.set(0, 40, 50);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.minDistance = 10;
    controls.maxDistance = 300;
    controls.enablePan = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 1.0;
    controls.panSpeed = 1.4;
    controls.zoomSpeed = 1.2;
    savedControlsState = null;

    controls.enabled = true;
    controls.update();
}

export function focusCamera(target, distance = 50) {
    if (!controls || !camera) return;
    controls.target.copy(target);
    // Offset camera
    camera.position.copy(target).add(new THREE.Vector3(0, distance, distance * 0.6));
    controls.update();
}

// Removed: helper functions like createTextSprite, addColonyVisual (moved to visuals_system.js)

// R3F Hook - called every frame by GameScene.jsx
export function updateFrame(state, delta) {
    const time = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.1);

    if(gameState.viewMode === 'GALAXY') {
        updateGalaxyAnimations(time, groups.galaxy);
    }

    if(gameState.viewMode === 'SYSTEM') {
        updateSystemAnimations(time);
    }

    if(gameState.viewMode === 'EXPLORATION') {
        // Ensure camera and controls are available (imported from scene_config)
        if(camera && controls) {
            updatePlanetPhysics(dt, camera, controls, groups.planet);
        }
    }
}

// Helper to check readiness
export function isRendererReady() {
    return !!(camera && controls && scene);
}

// Main render loop - uses composer for bloom post-processing
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    // Update OrbitControls damping
    if (controls && controls.update) controls.update();

    // Update game visuals based on current view mode
    if (gameState.viewMode === 'GALAXY') {
        updateGalaxyAnimations(time, groups.galaxy);
    } else if (gameState.viewMode === 'SYSTEM') {
        updateSystemAnimations(time);
    } else if (gameState.viewMode === 'EXPLORATION') {
        if (camera && controls) {
            updatePlanetPhysics(delta, camera, controls, groups.planet);
        }
    }

    // Render with post-processing (bloom) if composer is available, otherwise fallback
    if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}