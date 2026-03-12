/**
 * Ship flight control system for the system view.
 * Handles input, 3D flight physics, camera follow, and banking animations.
 */
import * as THREE from 'three';
import { setControlledEntry, getControlledEntry } from './visuals_system_ships.js';

// ── Pre-allocated vectors ───────────────────────────────────────────────────

const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _camPos  = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _behindDir = new THREE.Vector3();

// ── Shared mutable state ────────────────────────────────────────────────────

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

    // Disable orbit camera
    if (controls) controls.enabled = false;

    // Reset flight state
    systemShipState.velocity.set(0, 0, 0);
    systemShipState.bankAngle = 0;
    systemShipState.cameraDistance = 4;
    systemShipState.targetCameraDistance = 4;
    systemShipState.cameraPitch = 0.3;
    systemShipState.keyState = {};
    systemShipState.mouseDeltaX = 0;
    systemShipState.mouseDeltaY = 0;

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
}

/**
 * Exit ship control mode. Re-enables OrbitControls, resets camera.
 */
export function exitShipControl(controls, camera) {
    const wasControlling = getControlledEntry();
    setControlledEntry(null);

    systemShipState.velocity.set(0, 0, 0);
    systemShipState.keyState = {};

    // Re-enable OrbitControls
    if (controls) {
        controls.enabled = true;
        controls.minDistance = 10;
        controls.maxDistance = 300;
        controls.enableDamping = true;
        controls.dampingFactor = 0.12;
        controls.rotateSpeed = 1.0;
        controls.panSpeed = 1.4;
        controls.zoomSpeed = 1.2;

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

// ── Per-frame flight physics + camera ───────────────────────────────────────

/**
 * Update ship flight physics and camera position. Called every frame when controlling a ship.
 */
export function updateShipFlight(dt, camera) {
    const entry = getControlledEntry();
    if (!entry) return;

    const mesh = entry.mesh;
    const { keyState, velocity } = systemShipState;

    // Get ship's local axes
    _forward.set(0, 0, -1).applyQuaternion(mesh.quaternion);
    _right.set(1, 0, 0).applyQuaternion(mesh.quaternion);

    // Throttle (W/S)
    const accel = systemShipState.acceleration;
    if (keyState.w) velocity.addScaledVector(_forward, accel * dt);
    if (keyState.s) velocity.addScaledVector(_forward, -accel * 0.4 * dt);

    // Vertical (Space/Shift)
    if (keyState[' ']) velocity.y += accel * 0.6 * dt;
    if (keyState.shift) velocity.y -= accel * 0.6 * dt;

    // Yaw from A/D keys
    const yawInput = (keyState.a ? 1 : 0) - (keyState.d ? 1 : 0);
    mesh.rotateY(yawInput * 2.5 * dt);

    // Yaw/pitch from mouse drag
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
    const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
    euler.z = systemShipState.bankAngle;
    mesh.quaternion.setFromEuler(euler);

    // Engine glow intensity based on speed
    if (entry.engineGlow) {
        const speedFrac = speed / systemShipState.maxSpeed;
        entry.engineGlow.material.opacity = 0.35 + speedFrac * 0.55;
    }

    // ── Camera: third-person chase ──
    // Smooth camera distance lerp
    systemShipState.cameraDistance += (systemShipState.targetCameraDistance - systemShipState.cameraDistance) * 3 * dt;

    const camDist = systemShipState.cameraDistance;
    const camPitch = systemShipState.cameraPitch;

    // Camera behind ship
    _behindDir.set(0, 0, 1).applyQuaternion(mesh.quaternion); // behind ship = +Z local
    _camPos.copy(mesh.position)
        .addScaledVector(_behindDir, camDist * Math.cos(camPitch));
    _camPos.y += camDist * Math.sin(camPitch);

    // Smooth camera follow
    camera.position.lerp(_camPos, 6 * dt);

    // Look slightly ahead of ship
    _camTarget.copy(mesh.position).addScaledVector(_forward, 0.8);
    camera.lookAt(_camTarget);
}
