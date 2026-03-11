/**
 * Camera controls and input handling for planet exploration.
 * Mouse, touch, keyboard, and joystick input.
 */
import { gameState } from '../core/state.js';
import planetState, {
    CAMERA_DISTANCE_MIN,
    CAMERA_DISTANCE_MAX,
    JOYSTICK_ZONE_WIDTH_RATIO,
} from './visuals_planet_state.js';

// ── Helpers (zero-allocation touch iteration) ────────────────────────────────

function findTouch(touches, predicate) {
    for (let i = 0; i < touches.length; i++) {
        if (predicate(touches[i])) return touches[i];
    }
    return null;
}

function someTouch(touches, predicate) {
    for (let i = 0; i < touches.length; i++) {
        if (predicate(touches[i])) return true;
    }
    return false;
}

function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function isInJoystickZone(x) {
    return x < window.innerWidth * JOYSTICK_ZONE_WIDTH_RATIO;
}

export function isDroneMoving() {
    return Math.abs(planetState.joystickInput.x) > 0.05
        || Math.abs(planetState.joystickInput.y) > 0.05
        || planetState.keyState['w'] || planetState.keyState['a']
        || planetState.keyState['s'] || planetState.keyState['d'];
}

// ── Mouse / Touch / Wheel controls ──────────────────────────────────────────

function initExplorationMouseControls() {
    // ── Mouse (desktop) ──────────────────────────────────────────────────────
    const onMouseDown = (e) => {
        planetState.isMouseDown = true;
        planetState.lastMouseX = e.clientX;
        planetState.lastMouseY = e.clientY;
    };
    const onMouseUp = () => { planetState.isMouseDown = false; };
    const onMouseMoveExploration = (e) => {
        if (!planetState.isMouseDown || gameState.viewMode !== 'EXPLORATION') return;
        const dx = e.clientX - planetState.lastMouseX;
        const dy = e.clientY - planetState.lastMouseY;
        planetState.cameraYaw -= dx * 0.005;
        planetState.cameraPitch = Math.max(0.02, Math.min(Math.PI / 2 - 0.05, planetState.cameraPitch + dy * 0.005));
        planetState.lastMouseX = e.clientX;
        planetState.lastMouseY = e.clientY;
    };

    // ── Mouse wheel zoom ─────────────────────────────────────────────────────
    const onWheel = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;
        e.preventDefault();
        planetState.cameraDistance = Math.max(CAMERA_DISTANCE_MIN, Math.min(CAMERA_DISTANCE_MAX, planetState.cameraDistance + e.deltaY * 0.05));
    };

    // ── Touch ────────────────────────────────────────────────────────────────
    const _isUITouch = (e) => e.target.closest('#exploration-header, #harvester-hud, .action-btn, button');

    const onTouchStart = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;
        if (_isUITouch(e)) return;

        if (e.touches.length >= 2) {
            if (isDroneMoving()) {
                const nonJoystickTouch = findTouch(e.touches, t => !isInJoystickZone(t.clientX));
                if (nonJoystickTouch) {
                    planetState.isMouseDown = true;
                    planetState.cameraDragTouchId = nonJoystickTouch.identifier;
                    planetState.lastMouseX = nonJoystickTouch.clientX;
                    planetState.lastMouseY = nonJoystickTouch.clientY;
                }
                e.preventDefault();
                return;
            }

            planetState.isMouseDown = false;
            planetState.cameraDragTouchId = null;
            planetState.isPinching = true;
            planetState.pinchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
            e.preventDefault();
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            if (!isInJoystickZone(touch.clientX)) {
                planetState.isMouseDown = true;
                planetState.cameraDragTouchId = touch.identifier;
                planetState.lastMouseX = touch.clientX;
                planetState.lastMouseY = touch.clientY;
            }
        }
    };

    const onTouchEnd = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;

        if (e.touches.length < 2) {
            planetState.isPinching = false;
        }

        const stillDown = someTouch(e.touches, t => t.identifier === planetState.cameraDragTouchId);
        if (!stillDown) {
            planetState.isMouseDown = false;
            planetState.cameraDragTouchId = null;
        }
    };

    const onTouchMove = (e) => {
        if (gameState.viewMode !== 'EXPLORATION') return;
        if (_isUITouch(e)) return;
        e.preventDefault();

        // Pinch to zoom (only when drone is NOT moving)
        if (e.touches.length === 2 && planetState.isPinching && !isDroneMoving()) {
            const newDist = getTouchDistance(e.touches[0], e.touches[1]);
            const delta = planetState.pinchStartDist - newDist;
            planetState.cameraDistance = Math.max(CAMERA_DISTANCE_MIN, Math.min(CAMERA_DISTANCE_MAX, planetState.cameraDistance + delta * 0.05));
            planetState.pinchStartDist = newDist;
            return;
        }

        // While d-pad is active with 2 touches: second finger is camera drag
        if (e.touches.length >= 2 && isDroneMoving() && planetState.cameraDragTouchId !== null) {
            const touch = findTouch(e.touches, t => t.identifier === planetState.cameraDragTouchId);
            if (touch) {
                const dx = touch.clientX - planetState.lastMouseX;
                const dy = touch.clientY - planetState.lastMouseY;
                planetState.cameraYaw -= dx * 0.005;
                planetState.cameraPitch = Math.max(0.02, Math.min(Math.PI / 2 - 0.05, planetState.cameraPitch + dy * 0.005));
                planetState.lastMouseX = touch.clientX;
                planetState.lastMouseY = touch.clientY;
            }
            return;
        }

        // Single touch camera drag
        if (!planetState.isMouseDown || !planetState.cameraDragTouchId) return;
        const touch = findTouch(e.touches, t => t.identifier === planetState.cameraDragTouchId);
        if (!touch) return;

        const dx = touch.clientX - planetState.lastMouseX;
        const dy = touch.clientY - planetState.lastMouseY;
        planetState.cameraYaw -= dx * 0.005;
        planetState.cameraPitch = Math.max(0.02, Math.min(Math.PI / 2 - 0.05, planetState.cameraPitch + dy * 0.005));
        planetState.lastMouseX = touch.clientX;
        planetState.lastMouseY = touch.clientY;
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

// ── Keyboard + Joystick ─────────────────────────────────────────────────────

export function handleInput(key, pressed) {
    const k = key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) {
        if (k === 'arrowup') planetState.keyState['w'] = pressed;
        else if (k === 'arrowdown') planetState.keyState['s'] = pressed;
        else if (k === 'arrowleft') planetState.keyState['a'] = pressed;
        else if (k === 'arrowright') planetState.keyState['d'] = pressed;
        else planetState.keyState[k] = pressed;
    }
}

export function setJoystickInput(x, y) {
    planetState.joystickInput.x = x;
    planetState.joystickInput.y = y;
}
