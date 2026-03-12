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

// ── Material factory (all fresh, no cache) ──────────────────────────────

function _hull()   { return new THREE.MeshStandardMaterial({ color: 0x3a4455, metalness: 0.9, roughness: 0.25 }); }
function _dark()   { return new THREE.MeshStandardMaterial({ color: 0x222832, metalness: 0.92, roughness: 0.2 }); }
function _mid()    { return new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.85, roughness: 0.3 }); }
function _canopy() { return new THREE.MeshStandardMaterial({ color: 0x0a1833, metalness: 0.95, roughness: 0.08, transparent: true, opacity: 0.85 }); }
function _nozzle() { return new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.95, roughness: 0.15 }); }

function _accent(c) {
    return new THREE.MeshStandardMaterial({
        color: 0x556677, metalness: 0.85, roughness: 0.28,
        emissive: new THREE.Color(c), emissiveIntensity: 0.18,
    });
}
function _accentPanel(c) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(c).multiplyScalar(0.3), metalness: 0.8, roughness: 0.35,
        emissive: new THREE.Color(c), emissiveIntensity: 0.4,
    });
}
function _glow(c) {
    return new THREE.MeshStandardMaterial({
        color: c, emissive: new THREE.Color(c), emissiveIntensity: 1.2,
        transparent: true, opacity: 0.7,
    });
}

// ── Scout (power 1-2): Agile interceptor ─────────────────────────────────

function _buildScout(accent) {
    const g = new THREE.Group();
    const hullMat = _accent(accent);
    const panelMat = _accentPanel(accent);
    const darkMat = _hull();
    const nozzleMat = _nozzle();

    // Main fuselage — tapered front, wider rear
    const bodyFwd = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 1.0), hullMat);
    bodyFwd.position.z = -0.3;
    g.add(bodyFwd);

    const bodyRear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.9), darkMat);
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

    // Accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 1.6), panelMat);
    stripe.position.set(0, 0.1, 0.05);
    g.add(stripe);

    // Delta wings (flat boxes, rotated for sweep)
    for (const side of [1, -1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.55), hullMat);
        wing.position.set(side * 0.65, -0.03, 0.1);
        wing.rotation.z = side * -0.06;
        wing.rotation.y = side * 0.08;
        g.add(wing);

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

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.03, 0.95);
        g.add(nozzle);

        // Engine glow disc
        const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), _glow(accent));
        glowDisc.position.set(side, -0.03, 1.01);
        g.add(glowDisc);
    }

    // Underbelly intake
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.4), nozzleMat);
    intake.position.set(0, -0.12, -0.2);
    g.add(intake);

    // Nav lights (small emissive spheres)
    _addNavLight(g, 0.95, 0.03, -0.15, 0x00ff00, 0.03);
    _addNavLight(g, -0.95, 0.03, -0.15, 0xff0000, 0.03);
    _addNavLight(g, 0, 0.15, 0.8, accent, 0.025);

    return g;
}

// ── Corvette (power 3-5): Medium warship ─────────────────────────────────

function _buildCorvette(accent) {
    const g = new THREE.Group();
    const hullMat = _accent(accent);
    const panelMat = _accentPanel(accent);
    const darkMat = _hull();
    const midMat = _mid();
    const nozzleMat = _nozzle();

    // Main hull — elongated box
    const hullMain = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 2.2), hullMat);
    g.add(hullMain);

    // Forward section — tapered
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

    // Accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 2.6), panelMat);
    stripe.position.set(0, 0.16, -0.2);
    g.add(stripe);

    // Side weapon pods
    for (const side of [1, -1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.8), darkMat);
        pod.position.set(side * 0.52, -0.05, 0.3);
        g.add(pod);

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
    const hullMat = _accent(accent);
    const panelMat = _accentPanel(accent);
    const darkMat = _hull();
    const midMat = _mid();
    const nozzleMat = _nozzle();

    // Main hull — massive elongated body
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

    // Accent racing stripes
    for (const yOff of [0.23, -0.23]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 3.5), panelMat);
        stripe.position.set(0, yOff, -0.3);
        g.add(stripe);
    }

    // Side armor / weapon bays
    for (const side of [1, -1]) {
        // Armor panel
        const armor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 2.0), darkMat);
        armor.position.set(side * 0.6, 0, 0);
        g.add(armor);

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
