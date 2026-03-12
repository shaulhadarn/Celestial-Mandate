/**
 * 3D ship viewer for the ship detail modal.
 * Creates a mini Three.js scene with the procedural ship mesh,
 * ambient + directional lighting, and pointer-drag orbit controls.
 */
import * as THREE from 'three';
import { createPlayerShipMesh } from '../visuals/visuals_system_ships.js';

let _renderer = null;
let _scene = null;
let _camera = null;
let _shipGroup = null;
let _animId = null;
let _disposed = false;

// Drag state
let _isDragging = false;
let _prevX = 0;
let _prevY = 0;
let _rotY = 0;      // horizontal rotation (user-controlled)
let _rotX = 0.15;   // vertical tilt (slight top-down default)
let _autoRotSpeed = 0.3; // auto-rotation speed (rad/s)

/**
 * Initialize the 3D ship viewer for a given ship.
 * @param {string} shipId - e.g. 'h_scout'
 * @param {string} accentColor - e.g. '#00f2ff'
 */
export function initShipViewer(shipId, accentColor) {
    disposeShipViewer();
    _disposed = false;

    const container = document.getElementById('ship-modal-viewer');
    const canvas = document.getElementById('ship-viewer-canvas');
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dpr = Math.min(window.devicePixelRatio, 2);

    // Renderer
    _renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
    });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(dpr);
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.2;

    // Scene
    _scene = new THREE.Scene();

    // Camera
    _camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 100);
    _camera.position.set(0, 0.5, 3);
    _camera.lookAt(0, 0, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0x334466, 0.8);
    _scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xddeeff, 2.0);
    keyLight.position.set(3, 4, 2);
    _scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(new THREE.Color(accentColor), 0.6);
    fillLight.position.set(-2, -1, 3);
    _scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x6688aa, 1.0);
    rimLight.position.set(0, 2, -4);
    _scene.add(rimLight);

    // Subtle accent point light underneath
    const underGlow = new THREE.PointLight(new THREE.Color(accentColor), 0.5, 8);
    underGlow.position.set(0, -2, 0);
    _scene.add(underGlow);

    // Create ship mesh
    const { shipGroup } = createPlayerShipMesh(shipId, accentColor);
    _shipGroup = shipGroup;

    // Center & scale the ship to fit the viewer
    const box = new THREE.Box3().setFromObject(shipGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.0 / maxDim; // fit within ~2 units
    shipGroup.scale.setScalar(scale);
    shipGroup.position.sub(center.multiplyScalar(scale));

    _scene.add(shipGroup);

    // Reset rotation
    _rotY = 0;
    _rotX = 0.15;

    // Pointer events for drag-to-rotate
    _bindPointerEvents(container);

    // Start render loop
    _animate();
}

function _animate() {
    if (_disposed) return;
    _animId = requestAnimationFrame(_animate);

    if (!_shipGroup || !_renderer || !_scene || !_camera) return;

    // Auto-rotate when not dragging
    if (!_isDragging) {
        _rotY += _autoRotSpeed * 0.016; // ~60fps
    }

    // Apply rotation: Y is horizontal, X is vertical tilt
    _shipGroup.rotation.set(0, 0, 0);
    _shipGroup.rotateY(_rotY);
    _shipGroup.rotateX(_rotX);

    _renderer.render(_scene, _camera);
}

function _bindPointerEvents(container) {
    const onDown = (e) => {
        _isDragging = true;
        container.classList.add('dragging');
        const pt = e.touches ? e.touches[0] : e;
        _prevX = pt.clientX;
        _prevY = pt.clientY;
    };

    const onMove = (e) => {
        if (!_isDragging) return;
        e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        const dx = pt.clientX - _prevX;
        const dy = pt.clientY - _prevY;
        _prevX = pt.clientX;
        _prevY = pt.clientY;

        _rotY += dx * 0.008;
        _rotX += dy * 0.006;
        // Clamp vertical to avoid flipping
        _rotX = Math.max(-1.2, Math.min(1.2, _rotX));
    };

    const onUp = () => {
        _isDragging = false;
        container.classList.remove('dragging');
    };

    // Mouse
    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // Touch
    container.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    // Store cleanup refs
    container._shipViewerCleanup = () => {
        container.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        container.removeEventListener('touchstart', onDown);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
    };
}

/**
 * Dispose the 3D viewer and free GPU resources.
 */
export function disposeShipViewer() {
    _disposed = true;
    if (_animId) {
        cancelAnimationFrame(_animId);
        _animId = null;
    }

    // Remove pointer event listeners
    const container = document.getElementById('ship-modal-viewer');
    if (container && container._shipViewerCleanup) {
        container._shipViewerCleanup();
        container._shipViewerCleanup = null;
    }

    // Dispose ship group meshes
    if (_shipGroup) {
        _shipGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                // Don't dispose shared materials from the main scene cache
                if (!child.material.userData?.shared) {
                    child.material.dispose();
                }
            }
        });
        _shipGroup = null;
    }

    if (_scene) {
        _scene.clear();
        _scene = null;
    }

    if (_renderer) {
        _renderer.dispose();
        _renderer = null;
    }

    _camera = null;
    _isDragging = false;
}
