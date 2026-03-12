/**
 * 3D ship viewer for the ship detail modal.
 * Creates a mini Three.js scene with the procedural ship mesh,
 * lighting, and pointer-drag orbit controls.
 *
 * Uses a pivot group so the ship always rotates around its visual center.
 * Hides sprites (engine glow / nav lights) to avoid shared-texture issues
 * with the second WebGL context.
 */
import * as THREE from 'three';
import { createPlayerShipMesh } from '../visuals/visuals_system_ships.js';

let _renderer = null;
let _scene = null;
let _camera = null;
let _pivot = null;       // outer group we rotate
let _animId = null;
let _disposed = false;
let _pendingRetry = null;

// Drag state
let _isDragging = false;
let _prevX = 0;
let _prevY = 0;
let _rotY = 0;
let _rotX = 0.2;
const AUTO_ROT = 0.3;   // rad/s idle spin

/* ── Public API ──────────────────────────────────────────────────────── */

export function initShipViewer(shipId, accentColor) {
    disposeShipViewer();
    _disposed = false;
    clearTimeout(_pendingRetry);
    _initInner(shipId, accentColor, 0);
}

export function disposeShipViewer() {
    _disposed = true;
    clearTimeout(_pendingRetry);
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }

    const ctr = document.getElementById('ship-modal-viewer');
    if (ctr && ctr._svCleanup) { ctr._svCleanup(); ctr._svCleanup = null; }

    if (_pivot) {
        _pivot.traverse(ch => {
            if (ch.geometry) ch.geometry.dispose();
            // Only dispose materials we created (not the shared cache ones from visuals_system_ships)
            if (ch.material && !ch.material._sharedShipMat) ch.material.dispose();
        });
        _pivot = null;
    }
    if (_scene) { _scene.clear(); _scene = null; }
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    _camera = null;
    _isDragging = false;
}

/* ── Init (with layout retry) ────────────────────────────────────────── */

function _initInner(shipId, accentColor, attempt) {
    const container = document.getElementById('ship-modal-viewer');
    const canvas    = document.getElementById('ship-viewer-canvas');
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if ((w < 10 || h < 10) && attempt < 6) {
        _pendingRetry = setTimeout(() => _initInner(shipId, accentColor, attempt + 1), 80);
        return;
    }
    if (w < 10 || h < 10) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    /* ── Renderer ── */
    try {
        _renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr <= 1.5 });
    } catch (e) {
        console.warn('Ship viewer: WebGL init failed', e);
        return;
    }
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(dpr);
    _renderer.setClearColor(0x000a14, 1);           // solid dark background
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.4;

    /* ── Scene ── */
    _scene = new THREE.Scene();

    /* ── Camera ── */
    _camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 100);
    _camera.position.set(0, 0.6, 4);
    _camera.lookAt(0, 0, 0);

    /* ── Lighting ── */
    _scene.add(new THREE.AmbientLight(0x445566, 1.0));

    const key = new THREE.DirectionalLight(0xddeeff, 2.5);
    key.position.set(3, 4, 2);
    _scene.add(key);

    const fill = new THREE.DirectionalLight(new THREE.Color(accentColor), 1.0);
    fill.position.set(-3, -1, 3);
    _scene.add(fill);

    const rim = new THREE.DirectionalLight(0x6688aa, 1.5);
    rim.position.set(0, 2, -4);
    _scene.add(rim);

    const under = new THREE.PointLight(new THREE.Color(accentColor), 0.8, 10);
    under.position.set(0, -2, 0);
    _scene.add(under);

    /* ── Ship mesh ── */
    let shipGroup;
    try {
        const result = createPlayerShipMesh(shipId, accentColor);
        shipGroup = result.shipGroup;
    } catch (e) {
        console.warn('Ship viewer: mesh creation failed', e);
        return;
    }

    // Hide sprites (engine glows / nav lights) — they reference shared glow
    // textures that may not upload correctly to a second WebGL context
    shipGroup.traverse(ch => { if (ch.isSprite) ch.visible = false; });

    // Compute bounding box BEFORE scaling
    const box  = new THREE.Box3().setFromObject(shipGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale  = 2.2 / maxDim;

    // Offset the ship so its visual center sits at the local origin
    shipGroup.scale.setScalar(scale);
    shipGroup.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    // Wrap in a pivot that sits at world origin — rotation stays centered
    _pivot = new THREE.Group();
    _pivot.add(shipGroup);
    _scene.add(_pivot);

    // Start from a nice 3/4 angle (nose toward camera-left)
    _rotY = -0.6;
    _rotX = 0.2;

    _bindPointerEvents(container);
    _animate();
}

/* ── Render loop ─────────────────────────────────────────────────────── */

function _animate() {
    if (_disposed) return;
    _animId = requestAnimationFrame(_animate);
    if (!_pivot || !_renderer || !_scene || !_camera) return;

    if (!_isDragging) _rotY += AUTO_ROT * 0.016;

    _pivot.rotation.set(_rotX, _rotY, 0);

    _renderer.render(_scene, _camera);
}

/* ── Pointer drag ────────────────────────────────────────────────────── */

function _bindPointerEvents(ctr) {
    const onDown = (e) => {
        _isDragging = true;
        ctr.classList.add('dragging');
        const pt = e.touches ? e.touches[0] : e;
        _prevX = pt.clientX;
        _prevY = pt.clientY;
    };
    const onMouseMove = (e) => {
        if (!_isDragging) return;
        _rotY += (e.clientX - _prevX) * 0.008;
        _rotX += (e.clientY - _prevY) * 0.006;
        _rotX = Math.max(-1.2, Math.min(1.2, _rotX));
        _prevX = e.clientX;
        _prevY = e.clientY;
    };
    const onTouchMove = (e) => {
        if (!_isDragging) return;
        e.preventDefault();
        const pt = e.touches[0];
        _rotY += (pt.clientX - _prevX) * 0.008;
        _rotX += (pt.clientY - _prevY) * 0.006;
        _rotX = Math.max(-1.2, Math.min(1.2, _rotX));
        _prevX = pt.clientX;
        _prevY = pt.clientY;
    };
    const onUp = () => {
        _isDragging = false;
        ctr.classList.remove('dragging');
    };

    ctr.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    ctr.addEventListener('touchstart', onDown, { passive: false });
    ctr.addEventListener('touchmove', onTouchMove, { passive: false });
    ctr.addEventListener('touchend', onUp);
    ctr.addEventListener('touchcancel', onUp);

    ctr._svCleanup = () => {
        ctr.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onUp);
        ctr.removeEventListener('touchstart', onDown);
        ctr.removeEventListener('touchmove', onTouchMove);
        ctr.removeEventListener('touchend', onUp);
        ctr.removeEventListener('touchcancel', onUp);
    };
}
