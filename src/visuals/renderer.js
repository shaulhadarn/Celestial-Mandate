/* Updated: Fixed mobile race intro buttons — added #race-intro-overlay to preventDefault exclusions so all UI buttons work on mobile */
import * as THREE from 'three';
import { gameState, selectSystem, selectPlanet, getSystem, events } from '../core/state.js';
import { loadAssets, playSound, setMusicState } from '../core/assets.js';
import { disposeGroup } from '../core/dispose.js';
import { scene, camera, renderer, controls, groups, initRenderer as initSceneConfig } from '../core/scene_config.js';
import { createGalaxyVisuals, updateGalaxyAnimations, addColonyRingForSystem, starMeshes, isGalaxyBuilt } from './visuals_galaxy.js';
import { createSystemVisuals, updateSystemAnimations, addColonyVisual, addShipyardVisual, buildTradeRoutes, removePirateVisuals, planetMeshes, planetLabels } from './visuals_system.js';
import { createPlanetVisuals, updatePlanetPhysics, handleInput, handleExplorationTap } from './visuals_planet.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let cachedHyperlanes = [];

// Saved OrbitControls state before entering planet exploration
let savedControlsState = null;

// --- View transition fade helpers (uses #scene-transition-overlay from index.html) ---
let _fadeSafetyTimer = null;

function _fadeIn(durationMs = 400) {
    const overlay = document.getElementById('scene-transition-overlay');
    if (!overlay) return Promise.resolve();
    if (_fadeSafetyTimer) clearTimeout(_fadeSafetyTimer);
    overlay.querySelector('.transition-content').style.display = 'none';
    overlay.style.transition = `opacity ${durationMs}ms ease`;
    overlay.classList.add('active');
    // Safety: auto-remove overlay after 3s max in case something goes wrong
    _fadeSafetyTimer = setTimeout(() => {
        overlay.classList.remove('active');
    }, 3000);
    return new Promise(r => setTimeout(r, durationMs));
}

function _fadeOut(durationMs = 400) {
    const overlay = document.getElementById('scene-transition-overlay');
    if (!overlay) return Promise.resolve();
    if (_fadeSafetyTimer) { clearTimeout(_fadeSafetyTimer); _fadeSafetyTimer = null; }
    overlay.style.transition = `opacity ${durationMs}ms ease`;
    overlay.classList.remove('active');
    return new Promise(r => setTimeout(r, durationMs));
}

export async function init() {
    loadAssets();
    initSceneConfig();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);
    // Touch support — passive:false is CRITICAL so preventDefault() can block browser scroll/pan
    const _isUITouch = (target) => {
        if (!target || !target.closest) return false;
        return target.closest('#ui-layer') || target.closest('#splash-screen') ||
               target.closest('#creation-screen') || target.closest('#loading-screen') ||
               target.closest('#race-intro-overlay') || target.closest('#event-modal') ||
               target.closest('#scene-transition-overlay') || target.closest('#settings-panel') ||
               target.closest('#exploration-header') || target.closest('#harvester-hud') ||
               target.closest('#joystick-container') || target.closest('button');
    };
    window.addEventListener('touchmove', (e) => {
        // Only block default when touching the 3D canvas (not UI overlays)
        if (!_isUITouch(e.target || e.srcElement)) {
            e.preventDefault();
        }
        if (e.touches[0]) onMouseMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchstart', (e) => {
        if (!_isUITouch(e.target || e.srcElement)) {
            e.preventDefault();
        }
        if (e.touches[0]) onPointerDown(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        // Attach the real DOM target from the TouchEvent so handleTap can filter UI taps
        const synth = { clientX: t.clientX, clientY: t.clientY, target: e.target };
        onPointerUp(synth);
    }, { passive: true });

    // Use capture phase on document so keyboard events fire before R3F's Canvas
    // can intercept them (R3F creates a focusable div that can swallow key events)
    document.addEventListener('keydown', (e) => {
        handleInput(e.key, true);
        // Prevent spacebar from scrolling during exploration
        if (e.key === ' ' && gameState.viewMode === 'EXPLORATION') e.preventDefault();
    }, true);
    document.addEventListener('keyup', (e) => handleInput(e.key, false), true);

    // Events
    events.addEventListener('colony-founded', (e) => {
        const planetId = e.detail.planetId;

        if (gameState.viewMode === 'SYSTEM') {
            const mesh = planetMeshes.find(m => m.userData.id === planetId);
            if (mesh) addColonyVisual(mesh);
            buildTradeRoutes(groups.system);
        }

        // Always add colony ring to galaxy group so it's visible when
        // returning to galaxy view (galaxy visuals are reused, not rebuilt)
        if (groups.galaxy && isGalaxyBuilt()) {
            const sys = gameState.systems.find(s => s.planets.some(p => p.id === planetId));
            if (sys) addColonyRingForSystem(sys.id, groups.galaxy);
        }

        playSound('select');
    });

    // When a shipyard finishes building, add the orbital station immediately
    events.addEventListener('building-complete', (e) => {
        if (e.detail.buildingKey !== 'shipyard') return;
        if (gameState.viewMode !== 'SYSTEM') return;
        const mesh = planetMeshes.find(m => m.userData.id === e.detail.planetId);
        if (mesh) addShipyardVisual(mesh);
    });

    // Pirate raid notifications
    events.addEventListener('pirate-raid', (e) => {
        const d = e.detail;
        import('../ui/ui_notifications.js').then(({ showNotification }) => {
            showNotification(`Pirate raiders hit your colony! Lost ${d.minerals} minerals and ${d.energy} energy`, 'alert');
        });
    });

    // Pirate defeated — clean up visuals
    events.addEventListener('pirate-defeated', () => {
        if (gameState.viewMode === 'SYSTEM') {
            removePirateVisuals();
        }
    });

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

    // Thresholds: < 500ms duration, < 30px movement (widened for mobile fat-finger taps)
    if (duration < 500 && dist < 30) {
        handleTap(event);
    }
}

function handleTap(event) {
    // Safety guard: Ensure raycaster, mouse, and camera are ready
    if (!raycaster || !mouse || !camera) return;

    // Ignore taps on UI elements — prevents buttons from triggering 3D raycasts
    const target = event.target || event.srcElement;
    if (target && target.closest && target.closest('#ui-layer')) return;
    // Block taps on exploration UI controls (back-to-drone button, etc.)
    if (target && target.closest && target.closest('#soldier-control-bar')) return;
    if (target && target.closest && target.closest('#exploration-header')) return;
    if (target && target.closest && target.closest('#unit-panel')) return;
    // Block clicks when event modal (or any overlay) is open
    if (target && target.closest && target.closest('#event-modal')) return;
    // Also block if the event modal is visible (backdrop covers screen)
    const evtModal = document.getElementById('event-modal');
    if (evtModal && !evtModal.classList.contains('hidden') && !evtModal.classList.contains('evt-no-display')) return;

    // Update mouse coordinates for raycaster exactly at tap location
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (gameState.viewMode === 'GALAXY') {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(starMeshes);
        
        if (intersects.length > 0) {
            const sysId = intersects[0].object.userData.id;
            if (getSystem(sysId)) {
                playSound('select');
                // Delay state selection until after fade — prevents bottom modal
                // from flashing before the system view loads
                enterSystemView(sysId).then(() => selectSystem(sysId));
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
    } else if (gameState.viewMode === 'EXPLORATION') {
        handleExplorationTap(raycaster, mouse, camera);
    }
}

export function buildGalaxyVisuals(systems, hyperlanes) {
    if (hyperlanes) cachedHyperlanes = hyperlanes;
    // Safety check: ensure scene and groups are ready before building galaxy
    if (!scene || !groups || !groups.galaxy) {
        console.warn("buildGalaxyVisuals: Scene not ready, skipping galaxy build");
        return;
    }
    // Removed: Galaxy building logic (moved to visuals_galaxy.js)
    createGalaxyVisuals(systems, cachedHyperlanes, groups.galaxy);
}

export async function enterSystemView(systemId, instant = false) {
    // Safety check for R3F initialization
    if (!controls || !camera) {
        console.warn("enterSystemView: Scene not ready");
        return;
    }

    try {
        // Animated transition (skip fade on initial/instant load)
        if (!instant) {
            await _fadeIn(500);
        }

        gameState.viewMode = 'SYSTEM';
        setMusicState('SYSTEM');

        // Reset background and fog to deep space defaults
        if (scene) {
            scene.background = new THREE.Color(0x020408);
            scene.fog = new THREE.FogExp2(0x020408, 0.0006);
        }

        // Re-enable OrbitControls — boost speeds for tighter system-scale interaction
        if (controls) {
            controls.enabled = true;
            controls.enableRotate = true;
            controls.enableZoom = true;
            controls.enablePan = true;
            controls.minDistance = 10;
            controls.maxDistance = 300;
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
        if (!sys) { _fadeOut(); return; }

        // Build new system visuals
        createSystemVisuals(sys, groups.system);

        // Flush residual pan/rotate momentum BEFORE setting camera:
        // OrbitControls accumulates panOffset and sphericalDelta internally.
        // update() with damping off applies + zeros all accumulators in one shot.
        const wasDamping = controls.enableDamping;
        controls.enableDamping = false;
        controls.update();

        // Now snap camera to system view position (accumulators are drained)
        const targetPos = new THREE.Vector3(0, 0, 0);
        camera.position.set(0, 40, 50);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        controls.target.copy(targetPos);

        // Save clean state and reset — update() inside reset() will find
        // zero deltas so the position stays exactly where we set it.
        controls.saveState();
        controls.reset();
        controls.enableDamping = wasDamping;

        // Force R3F to render frames so the scene is ready before revealing
        _forceFrames(10);

        if (!instant) {
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            await _fadeOut(600);
        }
    } catch (e) {
        console.error('enterSystemView error:', e);
        _fadeOut();
    }
}

export async function returnToGalaxyView() {
    try {
        await _fadeIn(500);

        gameState.viewMode = 'GALAXY';
        setMusicState('GALAXY');

        // Reset background and fog to deep space defaults
        if (scene) {
            scene.background = new THREE.Color(0x020408);
            scene.fog = new THREE.FogExp2(0x020408, 0.0006);
        }

        // Restore OrbitControls to galaxy defaults
        if (controls) {
            controls.enabled = true;
            controls.enableRotate = true;
            controls.enableZoom = true;
            controls.enablePan = true;
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.rotateSpeed = 0.6;
            controls.panSpeed = 0.8;
            controls.zoomSpeed = 0.8;
        }

        // Reuse existing galaxy visuals if already built — avoids expensive rebuild
        if (!isGalaxyBuilt()) {
            buildGalaxyVisuals(gameState.systems, cachedHyperlanes);
        }

        groups.galaxy.visible = true;
        groups.system.visible = false;
        groups.planet.visible = false;

        // Clean up system view GPU resources
        disposeGroup(groups.system);
        planetMeshes.length = 0;

        // Set galaxy-scale distance limits before focusing so saveState captures them
        controls.minDistance = 20;
        controls.maxDistance = 400;

        // Restore Camera — center on the system we just left, zoomed out to show neighbors
        if (gameState.selectedSystemId !== null) {
            const sys = getSystem(gameState.selectedSystemId);
            if (sys) {
                focusCamera(sys.position, 120);
            }
        }

        // Force R3F to render several frames so the scene is fully composited before fade-out
        _forceFrames(10);

        // Brief pause to let GPU finish compositing before revealing
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        await _fadeOut(600);
    } catch (e) {
        console.error('returnToGalaxyView error:', e);
        _fadeOut();
    }
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
    setMusicState('EXPLORATION');

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

    // Restore system-view control parameters (same as enterSystemView)
    controls.minDistance = 10;
    controls.maxDistance = 300;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 1.0;
    controls.panSpeed = 1.4;
    controls.zoomSpeed = 1.2;
    controls.enabled = true;

    // Flush residual momentum before snapping (see enterSystemView)
    const wasDamping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();

    // Set camera and target to default system view
    controls.target.set(0, 0, 0);
    camera.position.set(0, 40, 50);
    camera.zoom = 1;
    camera.updateProjectionMatrix();

    controls.saveState();
    controls.reset();
    controls.enableDamping = wasDamping;

    savedControlsState = null;
}

function animateCamera(target, distance, height, duration = 800) {
    if (!camera || !controls) return;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endTarget = target.clone();
    const endPos = new THREE.Vector3(0, height, distance);
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Ease out cubic for smooth deceleration
        const ease = 1 - Math.pow(1 - t, 3);

        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startTarget, endTarget, ease);
        controls.update();

        if (t < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

export function focusCamera(target, distance = 50) {
    if (!controls || !camera) return;
    // Flush residual momentum before snapping (see enterSystemView)
    const wasDamping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();

    controls.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3(0, distance, distance * 0.6));
    camera.zoom = 1;
    camera.updateProjectionMatrix();

    controls.saveState();
    controls.reset();
    controls.enableDamping = wasDamping;
}

// Removed: helper functions like createTextSprite, addColonyVisual (moved to visuals_system.js)

// R3F Hook - called every frame by GameScene.jsx
export function updateFrame(state, delta) {
    const time = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.1);

    if(gameState.viewMode === 'GALAXY') {
        updateGalaxyAnimations(time, groups.galaxy, state.camera);
    }

    if(gameState.viewMode === 'SYSTEM') {
        updateSystemAnimations(time, dt, groups.system);
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

