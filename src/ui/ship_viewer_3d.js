/**
 * 3D ship viewer for the ship detail modal.
 * Creates a mini Three.js scene with procedural ship meshes,
 * lighting, and pointer-drag orbit controls.
 *
 * Ships are built LOCALLY using only fresh materials — no shared state
 * from the main game engine. This avoids circular-import issues and
 * disposed-material bugs when the viewer is opened multiple times.
 */
import * as THREE from 'three';
import { RACE_SHIPS } from '../core/state.js';

let _renderer = null;
let _scene = null;
let _camera = null;
let _pivot = null;
let _animId = null;
let _disposed = false;
let _pendingRetry = null;
let _lastW = 0;
let _lastH = 0;

// Drag state
let _isDragging = false;
let _prevX = 0;
let _prevY = 0;
let _rotY = 0;
let _rotX = 0.2;
const AUTO_ROT = 0.3;

/* ── Public API ──────────────────────────────────────────────────────── */

export function initShipViewer(shipId, accentColor) {
    _stopAnimation();
    _clearScene();
    _disposed = false;
    clearTimeout(_pendingRetry);
    _initInner(shipId, accentColor, 0);
}

export function disposeShipViewer() {
    _disposed = true;
    clearTimeout(_pendingRetry);
    _stopAnimation();
    _removePointerEvents();
    _clearScene();
    _isDragging = false;
}

/* ── Internal helpers ────────────────────────────────────────────────── */

function _stopAnimation() {
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
}

function _removePointerEvents() {
    const ctr = document.getElementById('ship-modal-viewer');
    if (ctr && ctr._svCleanup) { ctr._svCleanup(); ctr._svCleanup = null; }
}

function _clearScene() {
    if (_pivot) {
        _pivot.traverse(ch => {
            if (ch.geometry) ch.geometry.dispose();
            if (ch.material) ch.material.dispose();
        });
        _pivot = null;
    }
    if (_scene) {
        _scene.clear();
        _scene = null;
    }
    _camera = null;
}

/* ── Init (with layout retry) ────────────────────────────────────────── */

function _initInner(shipId, accentColor, attempt) {
    if (_disposed) return;

    const container = document.getElementById('ship-modal-viewer');
    const canvas    = document.getElementById('ship-viewer-canvas');
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if ((w < 10 || h < 10) && attempt < 8) {
        _pendingRetry = setTimeout(() => _initInner(shipId, accentColor, attempt + 1), 100);
        return;
    }
    if (w < 10 || h < 10) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    /* ── Renderer (reuse if possible) ── */
    if (_renderer) {
        if (w !== _lastW || h !== _lastH) {
            _renderer.setSize(w, h);
            _renderer.setPixelRatio(dpr);
        }
    } else {
        try {
            _renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: dpr <= 1.5,
            });
        } catch (e) {
            console.warn('Ship viewer: WebGL init failed', e);
            return;
        }
        _renderer.setSize(w, h);
        _renderer.setPixelRatio(dpr);
        _renderer.setClearColor(0x000a14, 1);
        _renderer.toneMapping = THREE.ACESFilmicToneMapping;
        _renderer.toneMappingExposure = 1.4;

        canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            _stopAnimation();
        });
        canvas.addEventListener('webglcontextrestored', () => {
            if (!_disposed && _pivot) _animate();
        });
    }
    _lastW = w;
    _lastH = h;

    const gl = _renderer.getContext();
    if (!gl || gl.isContextLost()) {
        if (attempt < 10) {
            _pendingRetry = setTimeout(() => _initInner(shipId, accentColor, attempt + 1), 200);
        }
        return;
    }

    /* ── Scene ── */
    _scene = new THREE.Scene();

    /* ── Camera ── */
    _camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 100);
    _camera.position.set(0, 0.6, 4);
    _camera.lookAt(0, 0, 0);

    /* ── Lighting (neutral key/fill, subtle accent only) ── */
    _scene.add(new THREE.AmbientLight(0x334455, 0.8));

    const key = new THREE.DirectionalLight(0xeef4ff, 3.0);
    key.position.set(3, 4, 2);
    _scene.add(key);

    const fill = new THREE.DirectionalLight(0x88aacc, 1.2);
    fill.position.set(-3, -1, 3);
    _scene.add(fill);

    const rim = new THREE.DirectionalLight(0x8899bb, 2.0);
    rim.position.set(0, 2, -4);
    _scene.add(rim);

    // Subtle accent bounce — just enough to tint shadows, not wash out
    const accentBounce = new THREE.PointLight(new THREE.Color(accentColor), 0.35, 8);
    accentBounce.position.set(0, -2, 1);
    _scene.add(accentBounce);

    /* ── Ship mesh (built locally, no shared state) ── */
    const shipGroup = _buildViewerShip(shipId, accentColor);

    // Center and normalize scale
    const box  = new THREE.Box3().setFromObject(shipGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale  = 2.2 / maxDim;

    shipGroup.scale.setScalar(scale);
    shipGroup.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    _pivot = new THREE.Group();
    _pivot.add(shipGroup);
    _scene.add(_pivot);

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
    if (ctr._svCleanup) { ctr._svCleanup(); ctr._svCleanup = null; }

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

/* ══════════════════════════════════════════════════════════════════════
 *  STANDALONE SHIP BUILDERS — fresh materials, no shared game state
 * ══════════════════════════════════════════════════════════════════════ */

function _getHullClass(shipId) {
    if (!RACE_SHIPS) return 'scout';
    for (const race of Object.values(RACE_SHIPS)) {
        if (!Array.isArray(race)) continue;
        const ship = race.find(s => s.id === shipId);
        if (ship) {
            if (ship.power <= 2) return 'scout';
            if (ship.power <= 5) return 'corvette';
            return 'cruiser';
        }
    }
    return 'scout';
}

function _buildViewerShip(shipId, accent) {
    const hullClass = _getHullClass(shipId);
    switch (hullClass) {
        case 'corvette': return _buildCorvette(accent);
        case 'cruiser':  return _buildCruiser(accent);
        default:         return _buildScout(accent);
    }
}

// ── Environment cube for metallic reflections ────────────────────────────

let _envMap = null;
function _getEnvMap() {
    if (_envMap) return _envMap;
    // Simple gradient cubemap so metals have something to reflect
    const size = 16;
    const faces = [];
    for (let f = 0; f < 6; f++) {
        const data = new Uint8Array(size * size * 4);
        for (let j = 0; j < size; j++) {
            for (let i = 0; i < size; i++) {
                const idx = (j * size + i) * 4;
                const t = j / size;
                // Top faces bright, bottom dark, sides gradient
                const base = f < 2 ? (f === 2 ? 80 : 30) : 20 + t * 50;
                data[idx]     = base * 0.6;  // R
                data[idx + 1] = base * 0.7;  // G
                data[idx + 2] = base;        // B
                data[idx + 3] = 255;
            }
            faces.push ? 0 : 0; // no-op
        }
        faces.push(new THREE.DataTexture(data, size, size));
        faces[f].needsUpdate = true;
    }
    // Use a simple equirect approach instead — a tiny gradient texture
    const w = 64, h = 32;
    const eqData = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const idx = (j * w + i) * 4;
            const v = j / h; // 0=top, 1=bottom
            const topR = 50, topG = 65, topB = 90;
            const midR = 25, midG = 35, midB = 55;
            const botR = 8,  botG = 12, botB = 20;
            const t = v < 0.5 ? v * 2 : (v - 0.5) * 2;
            if (v < 0.5) {
                eqData[idx]     = topR + (midR - topR) * t;
                eqData[idx + 1] = topG + (midG - topG) * t;
                eqData[idx + 2] = topB + (midB - topB) * t;
            } else {
                eqData[idx]     = midR + (botR - midR) * t;
                eqData[idx + 1] = midG + (botG - midG) * t;
                eqData[idx + 2] = midB + (botB - midB) * t;
            }
            eqData[idx + 3] = 255;
        }
    }
    const eqTex = new THREE.DataTexture(eqData, w, h);
    eqTex.mapping = THREE.EquirectangularReflectionMapping;
    eqTex.needsUpdate = true;
    _envMap = eqTex;
    return _envMap;
}

// ── Material factory (all fresh, no cache) ──────────────────────────────

function _hull() {
    return new THREE.MeshStandardMaterial({
        color: 0x5a6a7a, metalness: 0.85, roughness: 0.28,
        envMap: _getEnvMap(), envMapIntensity: 0.6,
    });
}
function _dark() {
    return new THREE.MeshStandardMaterial({
        color: 0x1a2028, metalness: 0.9, roughness: 0.18,
        envMap: _getEnvMap(), envMapIntensity: 0.4,
    });
}
function _mid() {
    return new THREE.MeshStandardMaterial({
        color: 0x4a5868, metalness: 0.82, roughness: 0.32,
        envMap: _getEnvMap(), envMapIntensity: 0.5,
    });
}
function _canopy() {
    return new THREE.MeshStandardMaterial({
        color: 0x0a1a33, metalness: 0.95, roughness: 0.05,
        transparent: true, opacity: 0.8,
        envMap: _getEnvMap(), envMapIntensity: 1.2,
    });
}
function _nozzle() {
    return new THREE.MeshStandardMaterial({
        color: 0x080808, metalness: 0.95, roughness: 0.12,
        envMap: _getEnvMap(), envMapIntensity: 0.3,
        side: THREE.DoubleSide,
    });
}
// Accent trim — colored emissive for stripes/panels only
function _accentTrim(c) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(c).multiplyScalar(0.4),
        metalness: 0.75, roughness: 0.35,
        emissive: new THREE.Color(c), emissiveIntensity: 0.55,
        envMap: _getEnvMap(), envMapIntensity: 0.3,
    });
}
// Bright glow — engine exhaust, nav lights
function _glow(c) {
    return new THREE.MeshStandardMaterial({
        color: c, emissive: new THREE.Color(c), emissiveIntensity: 1.5,
        transparent: true, opacity: 0.8,
        side: THREE.DoubleSide, depthWrite: false,
    });
}

// ── Scout (power 1-2): Agile interceptor ─────────────────────────────────

function _buildScout(accent) {
    const g = new THREE.Group();
    const hullMat  = _hull();
    const trimMat  = _accentTrim(accent);
    const darkMat  = _dark();
    const midMat   = _mid();
    const nozzleMat = _nozzle();

    // Main fuselage — tapered front, wider rear
    const bodyFwd = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 1.0), hullMat);
    bodyFwd.position.z = -0.3;
    g.add(bodyFwd);

    const bodyRear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.9), midMat);
    bodyRear.position.z = 0.4;
    g.add(bodyRear);

    // Nose — angular cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.8, 4), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.0, -1.0);
    g.add(nose);

    // Cockpit canopy
    const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
        _canopy()
    );
    cockpit.position.set(0, 0.12, -0.55);
    g.add(cockpit);

    // Accent stripe (this is where the accent color should pop)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 1.6), trimMat);
    stripe.position.set(0, 0.1, 0.05);
    g.add(stripe);

    // Side accent lines along fuselage
    for (const side of [1, -1]) {
        const sideLine = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 1.5), trimMat);
        sideLine.position.set(side * 0.175, 0, 0.05);
        g.add(sideLine);
    }

    // Delta wings
    for (const side of [1, -1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.55), hullMat);
        wing.position.set(side * 0.65, -0.03, 0.1);
        wing.rotation.z = side * -0.06;
        wing.rotation.y = side * 0.08;
        g.add(wing);

        // Wing accent edge
        const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.015, 0.02), trimMat);
        wingEdge.position.set(side * 0.65, -0.01, -0.15);
        wingEdge.rotation.z = side * -0.06;
        g.add(wingEdge);

        // Winglet (vertical fin at tip)
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.2), darkMat);
        fin.position.set(side * 1.1, 0.04, 0.0);
        fin.rotation.z = side * -0.15;
        g.add(fin);
    }

    // Tail fins (V-tail)
    for (const side of [1, -1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.3), darkMat);
        tail.position.set(side * 0.18, 0.12, 0.72);
        tail.rotation.z = side * -0.25;
        g.add(tail);
    }

    // Engine nacelles
    for (const side of [-0.22, 0.22]) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.55, 8), darkMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(side, -0.03, 0.65);
        g.add(nacelle);

        // Nacelle accent ring
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.04, 8), trimMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(side, -0.03, 0.45);
        g.add(ring);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.03, 0.95);
        g.add(nozzle);

        const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), _glow(accent));
        glowDisc.position.set(side, -0.03, 1.01);
        g.add(glowDisc);
    }

    // Underbelly intake
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.4), nozzleMat);
    intake.position.set(0, -0.12, -0.2);
    g.add(intake);

    // Nav lights
    _addNavLight(g, 0.95, 0.03, -0.15, 0x00ff00, 0.03);
    _addNavLight(g, -0.95, 0.03, -0.15, 0xff0000, 0.03);
    _addNavLight(g, 0, 0.15, 0.8, accent, 0.025);

    return g;
}

// ── Corvette (power 3-5): Medium warship ─────────────────────────────────

function _buildCorvette(accent) {
    const g = new THREE.Group();
    const hullMat  = _hull();
    const trimMat  = _accentTrim(accent);
    const darkMat  = _dark();
    const midMat   = _mid();
    const nozzleMat = _nozzle();

    // Main hull — elongated box (neutral metal)
    const hullMain = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 2.2), hullMat);
    g.add(hullMain);

    // Forward section — tapered (slightly different tone)
    const fwd = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.8), midMat);
    fwd.position.z = -1.3;
    g.add(fwd);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 4), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0, -2.0);
    g.add(nose);

    // Bridge tower
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.5), midMat);
    bridge.position.set(0, 0.28, -0.2);
    g.add(bridge);

    const bridgeWindow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.25), _canopy());
    bridgeWindow.position.set(0, 0.35, -0.35);
    g.add(bridgeWindow);

    // Accent dorsal stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 2.6), trimMat);
    stripe.position.set(0, 0.16, -0.2);
    g.add(stripe);

    // Side accent lines
    for (const side of [1, -1]) {
        const sideLine = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.12, 2.0), trimMat);
        sideLine.position.set(side * 0.35, 0.05, 0);
        g.add(sideLine);
    }

    // Side weapon pods
    for (const side of [1, -1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.8), darkMat);
        pod.position.set(side * 0.52, -0.05, 0.3);
        g.add(pod);

        // Pod accent band
        const podBand = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.02, 0.1), trimMat);
        podBand.position.set(side * 0.52, 0.04, 0.3);
        g.add(podBand);

        // Turret barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), nozzleMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(side * 0.52, 0.03, -0.2);
        g.add(barrel);

        // Wing stub
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.6), hullMat);
        wing.position.set(side * 0.8, -0.08, 0.2);
        g.add(wing);
    }

    // Rear section — engine block
    const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.6), darkMat);
    rearBlock.position.z = 1.2;
    g.add(rearBlock);

    // Triple engine nacelles
    for (const x of [-0.25, 0, 0.25]) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), darkMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(x, -0.05, 1.45);
        g.add(nacelle);

        // Nacelle accent ring
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.04, 8), trimMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, -0.05, 1.25);
        g.add(ring);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.12, 8), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(x, -0.05, 1.72);
        g.add(nozzle);

        const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), _glow(accent));
        glowDisc.position.set(x, -0.05, 1.78);
        g.add(glowDisc);
    }

    // Antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 4), midMat);
    antenna.position.set(0, 0.55, -0.2);
    g.add(antenna);

    // Nav lights
    _addNavLight(g, 1.05, -0.03, 0.2, 0x00ff00, 0.035);
    _addNavLight(g, -1.05, -0.03, 0.2, 0xff0000, 0.035);
    _addNavLight(g, 0, 0.42, -0.4, accent, 0.03);

    return g;
}

// ── Cruiser (power 6+): Heavy capital ship ───────────────────────────────

function _buildCruiser(accent) {
    const g = new THREE.Group();
    const hullMat  = _hull();
    const trimMat  = _accentTrim(accent);
    const darkMat  = _dark();
    const midMat   = _mid();
    const nozzleMat = _nozzle();

    // Main hull — massive elongated body (neutral metal)
    const hullMain = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 3.0), hullMat);
    g.add(hullMain);

    // Forward hull section
    const fwd = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), midMat);
    fwd.position.z = -1.8;
    g.add(fwd);

    // Armored bow
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), hullMat);
    bow.position.z = -2.6;
    g.add(bow);

    // Nose cap
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), darkMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0, -3.1);
    g.add(nose);

    // Command bridge — elevated superstructure
    const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.8), midMat);
    bridgeBase.position.set(0, 0.32, -0.5);
    g.add(bridgeBase);

    const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.6), darkMat);
    bridgeTop.position.set(0, 0.48, -0.5);
    g.add(bridgeTop);

    const bridgeWindows = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.3), _canopy());
    bridgeWindows.position.set(0, 0.48, -0.75);
    g.add(bridgeWindows);

    // Accent racing stripes (this is where accent color pops)
    for (const yOff of [0.23, -0.23]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 3.5), trimMat);
        stripe.position.set(0, yOff, -0.3);
        g.add(stripe);
    }

    // Dorsal accent line
    const dorsalLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 2.8), trimMat);
    dorsalLine.position.set(0, 0.23, -0.3);
    g.add(dorsalLine);

    // Side armor / weapon bays
    for (const side of [1, -1]) {
        // Armor panel
        const armor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 2.0), darkMat);
        armor.position.set(side * 0.6, 0, 0);
        g.add(armor);

        // Armor accent strip
        const armorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 1.8), trimMat);
        armorTrim.position.set(side * 0.71, 0, 0);
        g.add(armorTrim);

        // Upper turret
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 8), midMat);
        turretBase.position.set(side * 0.55, 0.25, 0.5);
        g.add(turretBase);

        const turretBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), nozzleMat);
        turretBarrel.rotation.x = Math.PI / 2;
        turretBarrel.position.set(side * 0.55, 0.28, 0.25);
        g.add(turretBarrel);

        // Lower turret
        const turretBase2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 8), midMat);
        turretBase2.position.set(side * 0.55, -0.25, -0.8);
        g.add(turretBase2);

        const turretBarrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), nozzleMat);
        turretBarrel2.rotation.x = Math.PI / 2;
        turretBarrel2.position.set(side * 0.55, -0.22, -1.05);
        g.add(turretBarrel2);

        // Wing / radiator fin
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 1.2), hullMat);
        wing.position.set(side * 0.9, 0, 0.5);
        g.add(wing);

        // Wing edge accent
        const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.015, 0.03), trimMat);
        wingEdge.position.set(side * 0.9, 0.02, -0.1);
        g.add(wingEdge);

        // Winglet
        const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.3), darkMat);
        winglet.position.set(side * 1.2, 0.08, 0.8);
        g.add(winglet);
    }

    // Forward weapon — main cannon
    const mainCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 6), nozzleMat);
    mainCannon.rotation.x = Math.PI / 2;
    mainCannon.position.set(0, -0.1, -2.8);
    g.add(mainCannon);

    // Rear engine block
    const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 0.7), darkMat);
    rearBlock.position.z = 1.7;
    g.add(rearBlock);

    // Quad engines
    for (const pos of [[-0.3, 0.1], [0.3, 0.1], [-0.3, -0.1], [0.3, -0.1]]) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 8), darkMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(pos[0], pos[1], 2.0);
        g.add(nacelle);

        // Nacelle accent ring
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.04, 8), trimMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pos[0], pos[1], 1.75);
        g.add(ring);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.14, 8), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(pos[0], pos[1], 2.32);
        g.add(nozzle);

        const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), _glow(accent));
        glowDisc.position.set(pos[0], pos[1], 2.39);
        g.add(glowDisc);
    }

    // Antenna mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 4), midMat);
    mast.position.set(0, 0.74, -0.5);
    g.add(mast);

    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), midMat);
    dish.position.set(0, 0.74, -0.5);
    dish.rotation.x = Math.PI;
    g.add(dish);

    // Nav lights
    _addNavLight(g, 1.2, 0.03, 0.5, 0x00ff00, 0.04);
    _addNavLight(g, -1.2, 0.03, 0.5, 0xff0000, 0.04);
    _addNavLight(g, 0, 0.56, -0.7, accent, 0.035);
    _addNavLight(g, 0, -0.25, -2.5, accent, 0.025);

    return g;
}

// ── Nav light helper (emissive sphere, no sprite/texture) ────────────────

function _addNavLight(group, x, y, z, color, size) {
    const mat = new THREE.MeshStandardMaterial({
        color, emissive: new THREE.Color(color), emissiveIntensity: 1.5,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), mat);
    sphere.position.set(x, y, z);
    group.add(sphere);
}
