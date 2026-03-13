/**
 * Ship flight control system for the system view.
 * Handles input, 3D flight physics, camera follow, and banking animations.
 * Mobile: touch joystick for movement, touch drag for camera orbit, vertical buttons.
 */
import * as THREE from 'three';
import { setControlledEntry, getControlledEntry } from './visuals_system_ships.js';
import { isMobile as isMobileDevice } from '../core/device.js';
import { events } from '../core/state.js';
import { controls } from '../core/scene_config.js';
import { _spawnSatTrail } from './visuals_system.js';

// ── Pre-allocated vectors ───────────────────────────────────────────────────

const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _camPos  = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _euler   = new THREE.Euler();
const _trailWP = new THREE.Vector3();

// ── Shared mutable state ────────────────────────────────────────────────────

const JOYSTICK_ZONE = 0.42; // left 42% of screen reserved for joystick

export const systemShipState = {
    keyState: {},
    mouseDown: false,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    cameraDistance: 4,
    targetCameraDistance: 4,
    cameraPitch: 0.3,
    // Physics — tuned for small ships in a vast system
    velocity: new THREE.Vector3(),
    maxSpeed: 25,
    acceleration: 35,
    drag: 0.94,
    // Banking visual
    bankAngle: 0,
    // Mobile: joystick input + camera orbit offset
    joystickInput: { x: 0, y: 0 },
    cameraYawOffset: 0,
};

// ── Public API ──────────────────────────────────────────────────────────────

export function isShipControlActive() {
    return getControlledEntry() !== null;
}

/**
 * Enter ship control mode. Disables OrbitControls, positions camera behind ship.
 */
export function enterShipControl(shipEntry, controls) {
    setControlledEntry(shipEntry);

    // Fully disable OrbitControls — stop its update() from repositioning the camera
    if (controls) {
        controls.enabled = false;
        if (!controls._shipOrigUpdate) {
            controls._shipOrigUpdate = controls.update.bind(controls);
            controls.update = () => {}; // no-op during ship flight
        }
    }

    // Reset flight state
    systemShipState.velocity.set(0, 0, 0);
    systemShipState.bankAngle = 0;
    systemShipState.cameraDistance = 4;
    systemShipState.targetCameraDistance = 4;
    systemShipState.cameraPitch = 0.3;
    systemShipState.keyState = {};
    systemShipState.mouseDeltaX = 0;
    systemShipState.mouseDeltaY = 0;
    systemShipState.joystickInput.x = 0;
    systemShipState.joystickInput.y = 0;
    systemShipState.cameraYawOffset = 0;

    // Show control bar
    const bar = document.getElementById('system-ship-control-bar');
    if (bar) {
        bar.classList.remove('hidden');
        const nameEl = document.getElementById('system-ship-name');
        if (nameEl) nameEl.textContent = `Controlling: ${shipEntry.fleetData.name}`;
    }

    // Show unit panel
    const panel = document.getElementById('system-unit-panel');
    if (panel) panel.classList.remove('hidden');

    // Show mobile vertical controls
    if (isMobileDevice) {
        const mobileCtrl = document.getElementById('ship-mobile-controls');
        if (mobileCtrl) mobileCtrl.classList.remove('hidden');
        _wireVerticalButtons();
    }

    events.dispatchEvent(new CustomEvent('ship-control-enter'));
}

/**
 * Exit ship control mode. Re-enables OrbitControls, resets camera.
 */
export function exitShipControl(controls, camera) {
    const wasControlling = getControlledEntry();
    setControlledEntry(null);

    systemShipState.velocity.set(0, 0, 0);
    systemShipState.keyState = {};

    // Re-enable OrbitControls — restore its update() first
    if (controls) {
        if (controls._shipOrigUpdate) {
            controls.update = controls._shipOrigUpdate;
            delete controls._shipOrigUpdate;
        }
        controls.enabled = true;
        controls.minDistance = 10;
        controls.maxDistance = 300;
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
        controls.rotateSpeed = 1.0;
        controls.panSpeed = 1.4;
        controls.zoomSpeed = 1.2;
        // Restore mobile touch mapping
        if (isMobileDevice) {
            controls.touches = {
                ONE: THREE.TOUCH.PAN,
                TWO: THREE.TOUCH.DOLLY_PAN,
            };
            controls.screenSpacePanning = true;
        }

        // Flush and reset camera
        if (camera) {
            const wasDamping = controls.enableDamping;
            controls.enableDamping = false;
            controls.update();

            // If we were controlling a ship, look at where it was
            if (wasControlling) {
                controls.target.copy(wasControlling.mesh.position);
                camera.position.set(
                    wasControlling.mesh.position.x,
                    wasControlling.mesh.position.y + 15,
                    wasControlling.mesh.position.z + 20
                );
            } else {
                controls.target.set(0, 0, 0);
                camera.position.set(0, 40, 50);
            }

            camera.zoom = 1;
            camera.updateProjectionMatrix();
            controls.saveState();
            controls.reset();
            controls.enableDamping = wasDamping;
        }
    }

    // Hide control bar
    const bar = document.getElementById('system-ship-control-bar');
    if (bar) bar.classList.add('hidden');

    // Hide mobile vertical controls
    const mobileCtrl = document.getElementById('ship-mobile-controls');
    if (mobileCtrl) mobileCtrl.classList.add('hidden');

    // Reset joystick
    systemShipState.joystickInput.x = 0;
    systemShipState.joystickInput.y = 0;

    events.dispatchEvent(new CustomEvent('ship-control-exit'));
}

/**
 * Handle keyboard input for ship control.
 */
export function handleSystemShipInput(key, pressed) {
    const k = key.toLowerCase();
    if (['w', 'a', 's', 'd', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        // Map arrows to WASD
        const mapped = {
            'arrowup': 'w', 'arrowdown': 's', 'arrowleft': 'a', 'arrowright': 'd',
        }[k] || k;
        systemShipState.keyState[mapped] = pressed;
    }
}

/**
 * Handle mouse events for ship camera rotation.
 */
export function handleShipMouseDown(e) {
    if (!isShipControlActive()) return;
    systemShipState.mouseDown = true;
    systemShipState.lastMouseX = e.clientX;
    systemShipState.lastMouseY = e.clientY;
}

export function handleShipMouseMove(e) {
    if (!isShipControlActive() || !systemShipState.mouseDown) return;
    systemShipState.mouseDeltaX += (e.clientX - systemShipState.lastMouseX) * 0.003;
    systemShipState.mouseDeltaY += (e.clientY - systemShipState.lastMouseY) * 0.003;
    systemShipState.lastMouseX = e.clientX;
    systemShipState.lastMouseY = e.clientY;
}

export function handleShipMouseUp() {
    systemShipState.mouseDown = false;
}

export function handleShipWheel(e) {
    if (!isShipControlActive()) return;
    systemShipState.targetCameraDistance += e.deltaY * 0.005;
    systemShipState.targetCameraDistance = Math.max(1.5, Math.min(20, systemShipState.targetCameraDistance));
}

// ── Mobile joystick input ────────────────────────────────────────────────────

export function setSystemShipJoystick(x, y) {
    systemShipState.joystickInput.x = x;
    systemShipState.joystickInput.y = y;
}

// ── Mobile vertical buttons (ascend/descend) ─────────────────────────────────
let _verticalWired = false;

function _wireVerticalButtons() {
    const ascend = document.getElementById('btn-ship-ascend');
    const descend = document.getElementById('btn-ship-descend');

    // Only wire once, but retry if DOM elements weren't ready on first attempt
    if (_verticalWired) return;
    if (!ascend && !descend) return; // DOM not ready, will retry next enterShipControl
    _verticalWired = true;

    const setKey = (key, val) => { systemShipState.keyState[key] = val; };

    if (ascend) {
        ascend.addEventListener('touchstart', (e) => { e.preventDefault(); setKey(' ', true); }, { passive: false });
        ascend.addEventListener('touchend', () => setKey(' ', false));
        ascend.addEventListener('touchcancel', () => setKey(' ', false));
    }
    if (descend) {
        descend.addEventListener('touchstart', (e) => { e.preventDefault(); setKey('shift', true); }, { passive: false });
        descend.addEventListener('touchend', () => setKey('shift', false));
        descend.addEventListener('touchcancel', () => setKey('shift', false));
    }
}

// ── Mobile touch camera orbit ────────────────────────────────────────────────
// Single touch on right side of screen → orbit camera around ship
// Pinch → zoom in/out

let _touchDragId = null;
let _lastTouchX = 0;
let _lastTouchY = 0;
let _pinching = false;
let _pinchStartDist = 0;

function _getTouchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function _isShipUITouch(e) {
    const t = e.target || e.srcElement;
    if (!t || !t.closest) return false;
    return t.closest('#ship-mobile-controls') || t.closest('#system-ship-control-bar') ||
           t.closest('#system-unit-panel') || t.closest('#joystick-container') ||
           t.closest('#ui-layer') || t.closest('button');
}

function _initShipTouchControls() {
    window.addEventListener('touchstart', (e) => {
        if (!isShipControlActive()) return;
        if (_isShipUITouch(e)) return;

        if (e.touches.length >= 2) {
            _pinching = true;
            _pinchStartDist = _getTouchDist(e.touches[0], e.touches[1]);
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            // Right side of screen → camera orbit
            if (touch.clientX > window.innerWidth * JOYSTICK_ZONE) {
                _touchDragId = touch.identifier;
                _lastTouchX = touch.clientX;
                _lastTouchY = touch.clientY;
            }
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isShipControlActive()) return;

        // Pinch to zoom
        if (_pinching && e.touches.length >= 2) {
            const dist = _getTouchDist(e.touches[0], e.touches[1]);
            const delta = _pinchStartDist - dist;
            systemShipState.targetCameraDistance += delta * 0.01;
            systemShipState.targetCameraDistance = Math.max(1.5, Math.min(20, systemShipState.targetCameraDistance));
            _pinchStartDist = dist;
            return;
        }

        // Camera orbit drag
        if (_touchDragId !== null) {
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === _touchDragId) {
                    const dx = e.touches[i].clientX - _lastTouchX;
                    const dy = e.touches[i].clientY - _lastTouchY;
                    systemShipState.cameraYawOffset -= dx * 0.006;
                    systemShipState.cameraPitch = Math.max(0.05, Math.min(1.4, systemShipState.cameraPitch + dy * 0.005));
                    _lastTouchX = e.touches[i].clientX;
                    _lastTouchY = e.touches[i].clientY;
                    break;
                }
            }
        }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (!isShipControlActive()) return;
        if (e.touches.length < 2) _pinching = false;
        let found = false;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === _touchDragId) { found = true; break; }
        }
        if (!found) _touchDragId = null;
    }, { passive: true });
}

_initShipTouchControls();

// ── Per-frame flight physics + camera ───────────────────────────────────────

/**
 * Update ship flight physics and camera position. Called every frame when controlling a ship.
 */
export function updateShipFlight(dt, camera) {
    const entry = getControlledEntry();
    if (!entry) return;

    const mesh = entry.mesh;
    const { keyState, velocity, joystickInput } = systemShipState;

    // Get ship's local axes
    _forward.set(0, 0, -1).applyQuaternion(mesh.quaternion);
    _right.set(1, 0, 0).applyQuaternion(mesh.quaternion);

    // Throttle (W/S + joystick Y)
    const accel = systemShipState.acceleration;
    if (keyState.w) velocity.addScaledVector(_forward, accel * dt);
    if (keyState.s) velocity.addScaledVector(_forward, -accel * 0.4 * dt);
    // Joystick Y: positive = push forward on stick = forward
    if (Math.abs(joystickInput.y) > 0.1) {
        velocity.addScaledVector(_forward, accel * joystickInput.y * dt);
    }

    // Vertical (Space/Shift)
    if (keyState[' ']) velocity.y += accel * 0.6 * dt;
    if (keyState.shift) velocity.y -= accel * 0.6 * dt;

    // Yaw from A/D keys + joystick X
    let yawInput = (keyState.a ? 1 : 0) - (keyState.d ? 1 : 0);
    if (Math.abs(joystickInput.x) > 0.1) {
        yawInput -= joystickInput.x; // left stick = yaw left
    }
    mesh.rotateY(yawInput * 2.5 * dt);

    // Yaw/pitch from mouse drag (desktop)
    if (Math.abs(systemShipState.mouseDeltaX) > 0.001) {
        mesh.rotateY(-systemShipState.mouseDeltaX * 1.5);
        systemShipState.mouseDeltaX *= 0.5; // decay
    }
    if (Math.abs(systemShipState.mouseDeltaY) > 0.001) {
        mesh.rotateX(-systemShipState.mouseDeltaY * 1.0);
        systemShipState.mouseDeltaY *= 0.5;
    }

    // Drag
    velocity.multiplyScalar(systemShipState.drag);

    // Clamp speed
    const speed = velocity.length();
    if (speed > systemShipState.maxSpeed) {
        velocity.multiplyScalar(systemShipState.maxSpeed / speed);
    }

    // Apply movement
    mesh.position.addScaledVector(velocity, dt);

    // Banking animation (visual roll based on yaw rate)
    const targetBank = -yawInput * 0.5;
    systemShipState.bankAngle = THREE.MathUtils.lerp(systemShipState.bankAngle, targetBank, 5 * dt);

    // Apply bank as local Z rotation (preserve quaternion yaw/pitch)
    _euler.setFromQuaternion(mesh.quaternion, 'YXZ');
    _euler.z = systemShipState.bankAngle;
    mesh.quaternion.setFromEuler(_euler);

    // Engine glow intensity based on speed
    if (entry.engineGlow) {
        const speedFrac = speed / systemShipState.maxSpeed;
        entry.engineGlow.material.opacity = 0.35 + speedFrac * 0.55;
    }

    // ── Camera: third-person orbit ──
    // Smooth camera distance lerp
    systemShipState.cameraDistance += (systemShipState.targetCameraDistance - systemShipState.cameraDistance) * 3 * dt;

    const camDist = systemShipState.cameraDistance;
    const camPitch = systemShipState.cameraPitch;

    // Camera position: orbit around ship using ship yaw + user offset
    _euler.setFromQuaternion(mesh.quaternion, 'YXZ');
    const camYaw = _euler.y + Math.PI + systemShipState.cameraYawOffset;

    _camPos.set(
        mesh.position.x + camDist * Math.sin(camYaw) * Math.cos(camPitch),
        mesh.position.y + camDist * Math.sin(camPitch),
        mesh.position.z + camDist * Math.cos(camYaw) * Math.cos(camPitch)
    );

    // Set camera directly (OrbitControls.update() runs before us each frame,
    // so we must override its positioning and sync controls.target to the ship)
    camera.position.copy(_camPos);

    _camTarget.copy(mesh.position);
    _camTarget.y += 0.3; // slightly above center
    camera.lookAt(_camTarget);

    // Keep OrbitControls target on the ship so it doesn't fight the camera
    if (controls) {
        controls.target.copy(_camTarget);
    }

    // ── Engine trails ──
    // Emit trail particles from the engine exhaust, velocity-based
    if (entry.trailAnchor && speed > 0.5) {
        entry.trailAnchor.getWorldPosition(_trailWP);
        // Trail velocity = opposite of ship velocity (exhaust goes backward)
        const trailVx = -velocity.x * 1.5;
        const trailVy = -velocity.y * 1.5;
        const trailVz = -velocity.z * 1.5;
        // Emit 1-3 particles per frame based on speed
        const emitCount = speed > systemShipState.maxSpeed * 0.5 ? 3 : speed > 2 ? 2 : 1;
        for (let i = 0; i < emitCount; i++) {
            // Slight random spread for a fuller exhaust plume
            const spread = 0.15;
            _spawnSatTrail(
                _trailWP.x + (Math.random() - 0.5) * spread,
                _trailWP.y + (Math.random() - 0.5) * spread,
                _trailWP.z + (Math.random() - 0.5) * spread,
                trailVx + (Math.random() - 0.5) * 2,
                trailVy + (Math.random() - 0.5) * 2,
                trailVz + (Math.random() - 0.5) * 2
            );
        }
    }
}
