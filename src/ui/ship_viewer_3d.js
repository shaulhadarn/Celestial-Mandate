/**
 * 3D ship viewer for the ship detail modal.
 * Creates a mini Three.js scene with procedural ship meshes,
 * lighting, and pointer-drag orbit + zoom controls.
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

// Zoom state
let _camDist = 4;
const CAM_DIST_MIN = 1.8;
const CAM_DIST_MAX = 8;

// Pinch state
let _pinchDist = 0;

// Animation time
let _time = 0;
let _glowMeshes = [];

/* ── Public API ──────────────────────────────────────────────────────── */

export function initShipViewer(shipId, accentColor) {
    _stopAnimation();
    _clearScene();
    _disposed = false;
    _camDist = 4;
    _glowMeshes = [];
    _time = 0;
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
    _glowMeshes = [];
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
        _scene.traverse(ch => {
            if (ch !== _scene && ch.geometry) ch.geometry.dispose();
            if (ch !== _scene && ch.material) ch.material.dispose();
        });
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
        _renderer.toneMappingExposure = 1.5;

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
    _scene.environment = _getEnvMap();

    /* ── Camera ── */
    _camera = new THREE.PerspectiveCamera(36, w / h, 0.01, 100);
    _camera.position.set(0, 0.6, _camDist);
    _camera.lookAt(0, 0, 0);

    /* ── Lighting — enhanced multi-light setup ── */
    _scene.add(new THREE.AmbientLight(0x334455, 0.6));

    // Key light — strong white from above-right
    const key = new THREE.DirectionalLight(0xeef4ff, 3.2);
    key.position.set(3, 5, 2);
    _scene.add(key);

    // Fill light — cool blue from left
    const fill = new THREE.DirectionalLight(0x88aacc, 1.4);
    fill.position.set(-4, -1, 3);
    _scene.add(fill);

    // Rim light — strong backlight for silhouette edge
    const rim = new THREE.DirectionalLight(0xaabbdd, 2.5);
    rim.position.set(0, 2, -5);
    _scene.add(rim);

    // Under-fill for belly detail
    const underFill = new THREE.DirectionalLight(0x446688, 0.6);
    underFill.position.set(0, -4, 1);
    _scene.add(underFill);

    // Accent bounce — colored glow from below
    const accentBounce = new THREE.PointLight(new THREE.Color(accentColor), 0.5, 10);
    accentBounce.position.set(0, -2, 1);
    _scene.add(accentBounce);

    // Secondary accent from front
    const accentFront = new THREE.PointLight(new THREE.Color(accentColor), 0.2, 8);
    accentFront.position.set(0, 0, -4);
    _scene.add(accentFront);

    /* ── Ship mesh (built locally, no shared state) ── */
    const shipGroup = _buildViewerShip(shipId, accentColor);

    // Center and normalize scale
    const box  = new THREE.Box3().setFromObject(shipGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale  = 2.4 / maxDim;

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

    _time += 0.016;

    if (!_isDragging) _rotY += AUTO_ROT * 0.016;

    _pivot.rotation.set(_rotX, _rotY, 0);

    // Update camera distance for zoom
    _camera.position.set(0, 0.6 * (_camDist / 4), _camDist);
    _camera.lookAt(0, 0, 0);

    // Animate engine glow pulse
    for (const gm of _glowMeshes) {
        const pulse = 0.7 + 0.3 * Math.sin(_time * 4 + gm.userData.phase);
        gm.material.emissiveIntensity = 1.5 * pulse;
        gm.material.opacity = 0.7 + 0.25 * pulse;
        gm.scale.setScalar(0.9 + 0.1 * pulse);
    }

    _renderer.render(_scene, _camera);
}

/* ── Pointer drag + zoom ─────────────────────────────────────────────── */

function _bindPointerEvents(ctr) {
    if (ctr._svCleanup) { ctr._svCleanup(); ctr._svCleanup = null; }

    const onDown = (e) => {
        if (e.touches && e.touches.length === 2) {
            // Start pinch
            _pinchDist = _getTouchDist(e.touches);
            return;
        }
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
        e.preventDefault();
        // Pinch zoom
        if (e.touches.length === 2) {
            const newDist = _getTouchDist(e.touches);
            if (_pinchDist > 0) {
                const ratio = _pinchDist / newDist;
                _camDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, _camDist * ratio));
            }
            _pinchDist = newDist;
            _isDragging = false;
            return;
        }
        if (!_isDragging) return;
        const pt = e.touches[0];
        _rotY += (pt.clientX - _prevX) * 0.008;
        _rotX += (pt.clientY - _prevY) * 0.006;
        _rotX = Math.max(-1.2, Math.min(1.2, _rotX));
        _prevX = pt.clientX;
        _prevY = pt.clientY;
    };
    const onUp = () => {
        _isDragging = false;
        _pinchDist = 0;
        ctr.classList.remove('dragging');
    };
    const onWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY * 0.003;
        _camDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, _camDist + delta));
    };

    ctr.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    ctr.addEventListener('touchstart', onDown, { passive: false });
    ctr.addEventListener('touchmove', onTouchMove, { passive: false });
    ctr.addEventListener('touchend', onUp);
    ctr.addEventListener('touchcancel', onUp);
    ctr.addEventListener('wheel', onWheel, { passive: false });

    ctr._svCleanup = () => {
        ctr.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onUp);
        ctr.removeEventListener('touchstart', onDown);
        ctr.removeEventListener('touchmove', onTouchMove);
        ctr.removeEventListener('touchend', onUp);
        ctr.removeEventListener('touchcancel', onUp);
        ctr.removeEventListener('wheel', onWheel);
    };
}

function _getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
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

// ── Environment map — higher quality gradient with horizon highlight ───────

let _envMap = null;
function _getEnvMap() {
    if (_envMap) return _envMap;
    const w = 256, h = 128;
    const eqData = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const idx = (j * w + i) * 4;
            const v = j / h; // 0=top, 1=bottom
            const u = i / w;
            // Sky gradient with bright horizon band
            let r, g, b;
            if (v < 0.35) {
                // Upper sky — deep space blue
                const t = v / 0.35;
                r = 15 + t * 30;
                g = 22 + t * 35;
                b = 45 + t * 45;
            } else if (v < 0.55) {
                // Horizon band — bright blue-white highlight
                const t = (v - 0.35) / 0.2;
                const peak = Math.sin(t * Math.PI);
                r = 45 + peak * 80;
                g = 57 + peak * 90;
                b = 90 + peak * 100;
            } else {
                // Lower — dark ground reflection
                const t = (v - 0.55) / 0.45;
                r = 45 - t * 35;
                g = 57 - t * 42;
                b = 90 - t * 65;
            }
            // Slight horizontal variation for visual interest
            const hVar = Math.sin(u * Math.PI * 4) * 5;
            // Subtle star sparkles
            const sparkle = (Math.sin(u * 317 + v * 211) * Math.cos(u * 523 + v * 137) > 0.92) ? 40 : 0;

            eqData[idx]     = Math.max(0, Math.min(255, r + hVar + sparkle));
            eqData[idx + 1] = Math.max(0, Math.min(255, g + hVar * 0.8 + sparkle));
            eqData[idx + 2] = Math.max(0, Math.min(255, b + hVar * 0.5 + sparkle));
            eqData[idx + 3] = 255;
        }
    }
    const eqTex = new THREE.DataTexture(eqData, w, h);
    eqTex.mapping = THREE.EquirectangularReflectionMapping;
    eqTex.needsUpdate = true;
    _envMap = eqTex;
    return _envMap;
}

// ── Material factory ────────────────────────────────────────────────────

function _hull() {
    return new THREE.MeshStandardMaterial({
        color: 0x5e6e7e, metalness: 0.88, roughness: 0.25,
        envMap: _getEnvMap(), envMapIntensity: 0.7,
    });
}
function _hullLight() {
    return new THREE.MeshStandardMaterial({
        color: 0x6a7a8a, metalness: 0.85, roughness: 0.3,
        envMap: _getEnvMap(), envMapIntensity: 0.6,
    });
}
function _dark() {
    return new THREE.MeshStandardMaterial({
        color: 0x1a2028, metalness: 0.92, roughness: 0.15,
        envMap: _getEnvMap(), envMapIntensity: 0.5,
    });
}
function _mid() {
    return new THREE.MeshStandardMaterial({
        color: 0x4a5868, metalness: 0.84, roughness: 0.3,
        envMap: _getEnvMap(), envMapIntensity: 0.55,
    });
}
function _armor() {
    return new THREE.MeshStandardMaterial({
        color: 0x3a4555, metalness: 0.9, roughness: 0.2,
        envMap: _getEnvMap(), envMapIntensity: 0.65,
    });
}
function _panel() {
    return new THREE.MeshStandardMaterial({
        color: 0x2a3440, metalness: 0.88, roughness: 0.22,
        envMap: _getEnvMap(), envMapIntensity: 0.5,
    });
}
function _canopy() {
    return new THREE.MeshStandardMaterial({
        color: 0x0a1a33, metalness: 0.95, roughness: 0.02,
        transparent: true, opacity: 0.85,
        envMap: _getEnvMap(), envMapIntensity: 1.5,
    });
}
function _nozzle() {
    return new THREE.MeshStandardMaterial({
        color: 0x080808, metalness: 0.95, roughness: 0.1,
        envMap: _getEnvMap(), envMapIntensity: 0.4,
        side: THREE.DoubleSide,
    });
}
function _accentTrim(c) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(c).multiplyScalar(0.4),
        metalness: 0.75, roughness: 0.3,
        emissive: new THREE.Color(c), emissiveIntensity: 0.6,
        envMap: _getEnvMap(), envMapIntensity: 0.3,
    });
}
function _accentSoft(c) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(c).multiplyScalar(0.2),
        metalness: 0.8, roughness: 0.4,
        emissive: new THREE.Color(c), emissiveIntensity: 0.25,
        envMap: _getEnvMap(), envMapIntensity: 0.2,
    });
}
function _glow(c) {
    return new THREE.MeshStandardMaterial({
        color: c, emissive: new THREE.Color(c), emissiveIntensity: 1.5,
        transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false,
    });
}
function _panelLine() {
    return new THREE.MeshStandardMaterial({
        color: 0x0a0e14, metalness: 0.5, roughness: 0.8,
    });
}

// Helper: add a glow disc with animation tracking
function _addGlowDisc(group, x, y, z, radius, color) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), _glow(color));
    disc.position.set(x, y, z);
    disc.userData.phase = Math.random() * Math.PI * 2;
    group.add(disc);
    _glowMeshes.push(disc);
    return disc;
}

// Helper: add engine exhaust cone (soft volumetric look)
function _addExhaustCone(group, x, y, z, radius, length, color) {
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 8, 1, true), mat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(x, y, z + length * 0.5);
    group.add(cone);
}

// ── Scout (power 1-2): Agile interceptor ─────────────────────────────────

function _buildScout(accent) {
    const g = new THREE.Group();
    const hullMat   = _hull();
    const hullLt    = _hullLight();
    const trimMat   = _accentTrim(accent);
    const softTrim  = _accentSoft(accent);
    const darkMat   = _dark();
    const midMat    = _mid();
    const armorMat  = _armor();
    const panelMat  = _panel();
    const nozzleMat = _nozzle();
    const lineMat   = _panelLine();

    // ── Main fuselage — multi-section tapered body ──
    const bodyFwd = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.9), hullMat);
    bodyFwd.position.z = -0.35;
    g.add(bodyFwd);

    const bodyMid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.6), midMat);
    bodyMid.position.z = 0.1;
    g.add(bodyMid);

    const bodyRear = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.8), hullLt);
    bodyRear.position.z = 0.45;
    g.add(bodyRear);

    // Belly plate — darker underside panel
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 1.4), panelMat);
    belly.position.set(0, -0.11, 0.1);
    g.add(belly);

    // ── Nose — sleek angular cone with sensor tip ──
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 4), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0.0, -1.05);
    g.add(nose);

    // Nose sensor tip
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), _glow(accent));
    noseTip.position.set(0, 0, -1.52);
    g.add(noseTip);

    // ── Cockpit canopy — multi-piece with frame ──
    const canopyBase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.3), darkMat);
    canopyBase.position.set(0, 0.08, -0.55);
    g.add(canopyBase);

    const cockpit = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        _canopy()
    );
    cockpit.position.set(0, 0.12, -0.55);
    g.add(cockpit);

    // Canopy frame lines
    for (const zz of [-0.1, 0.05]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.005, 0.008), darkMat);
        frame.position.set(0, 0.17, -0.55 + zz);
        g.add(frame);
    }

    // ── Panel lines along fuselage ──
    for (const zOff of [-0.8, -0.1, 0.3, 0.7]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.008), lineMat);
        line.position.set(0, 0.11, zOff);
        g.add(line);
    }

    // ── Accent stripe — dorsal racing stripe ──
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 1.7), trimMat);
    stripe.position.set(0, 0.115, 0.0);
    g.add(stripe);

    // Side accent lines
    for (const side of [1, -1]) {
        const sideLine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 1.5), softTrim);
        sideLine.position.set(side * 0.175, 0.02, 0.05);
        g.add(sideLine);
    }

    // ── Delta wings — with thickness and detail ──
    for (const side of [1, -1]) {
        // Main wing
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.035, 0.5), hullMat);
        wing.position.set(side * 0.68, -0.025, 0.1);
        wing.rotation.z = side * -0.05;
        wing.rotation.y = side * 0.06;
        g.add(wing);

        // Wing underside panel
        const wingUnder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.35), panelMat);
        wingUnder.position.set(side * 0.68, -0.048, 0.12);
        wingUnder.rotation.z = side * -0.05;
        g.add(wingUnder);

        // Leading edge — accent
        const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.018, 0.018), trimMat);
        wingEdge.position.set(side * 0.68, -0.005, -0.14);
        wingEdge.rotation.z = side * -0.05;
        g.add(wingEdge);

        // Wing panel line
        const wingLine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.005, 0.006), lineMat);
        wingLine.position.set(side * 0.55, -0.01, 0.1);
        g.add(wingLine);

        // Winglet (vertical fin at tip)
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.22), armorMat);
        fin.position.set(side * 1.15, 0.05, 0.02);
        fin.rotation.z = side * -0.12;
        g.add(fin);

        // Winglet tip light
        _addNavLight(g, side * 1.16, 0.15, -0.05, side > 0 ? 0x00ff44 : 0xff2200, 0.02);

        // Wing-root hardpoint
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.15), darkMat);
        pylon.position.set(side * 0.35, -0.06, 0.0);
        g.add(pylon);
    }

    // ── Tail fins (V-tail) ──
    for (const side of [1, -1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.28), armorMat);
        tail.position.set(side * 0.18, 0.13, 0.75);
        tail.rotation.z = side * -0.22;
        g.add(tail);

        // Tail accent
        const tailTrim = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.015, 0.25), trimMat);
        tailTrim.position.set(side * 0.18, 0.26, 0.75);
        tailTrim.rotation.z = side * -0.22;
        g.add(tailTrim);
    }

    // ── Engine nacelles — detailed with heat vents ──
    for (const side of [-0.22, 0.22]) {
        // Nacelle body
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 10), darkMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(side, -0.03, 0.62);
        g.add(nacelle);

        // Nacelle cowling
        const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.075, 0.15, 10), midMat);
        cowl.rotation.x = Math.PI / 2;
        cowl.position.set(side, -0.03, 0.38);
        g.add(cowl);

        // Accent intake ring
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.008, 6, 16), trimMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(side, -0.03, 0.35);
        g.add(ring);

        // Heat vent slats
        for (let v = 0; v < 3; v++) {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.05), lineMat);
            vent.position.set(side + 0.065, -0.03, 0.52 + v * 0.08);
            g.add(vent);
        }

        // Nozzle
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.12, 10), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.03, 0.95);
        g.add(nozzle);

        // Nozzle inner ring
        const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 4, 10), nozzleMat);
        innerRing.rotation.x = Math.PI / 2;
        innerRing.position.set(side, -0.03, 0.98);
        g.add(innerRing);

        // Glow disc
        _addGlowDisc(g, side, -0.03, 1.01, 0.05, accent);

        // Exhaust cone
        _addExhaustCone(g, side, -0.03, 1.01, 0.04, 0.25, accent);
    }

    // ── Underbelly intake ──
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.35), nozzleMat);
    intake.position.set(0, -0.13, -0.15);
    g.add(intake);

    // Intake grille lines
    for (let i = 0; i < 4; i++) {
        const grille = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.005), midMat);
        grille.position.set(0, -0.11, -0.28 + i * 0.07);
        g.add(grille);
    }

    // ── Sensor dome (top rear) ──
    const sensorDome = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), _canopy());
    sensorDome.position.set(0, 0.12, 0.5);
    g.add(sensorDome);

    // ── Rear antenna nub ──
    const antennaNub = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4), midMat);
    antennaNub.position.set(0, 0.22, 0.75);
    g.add(antennaNub);

    // ── Nav lights ──
    _addNavLight(g, 0, 0.16, 0.85, accent, 0.022);

    return g;
}

// ── Corvette (power 3-5): Medium warship ─────────────────────────────────

function _buildCorvette(accent) {
    const g = new THREE.Group();
    const hullMat   = _hull();
    const hullLt    = _hullLight();
    const trimMat   = _accentTrim(accent);
    const softTrim  = _accentSoft(accent);
    const darkMat   = _dark();
    const midMat    = _mid();
    const armorMat  = _armor();
    const panelMat  = _panel();
    const nozzleMat = _nozzle();
    const lineMat   = _panelLine();

    // ── Main hull — multi-section layered body ──
    const hullMain = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 2.0), hullMat);
    g.add(hullMain);

    // Upper hull plate
    const upperPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 1.8), hullLt);
    upperPlate.position.set(0, 0.16, 0);
    g.add(upperPlate);

    // Lower hull plate
    const lowerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 1.6), panelMat);
    lowerPlate.position.set(0, -0.16, 0);
    g.add(lowerPlate);

    // ── Forward section — tapered with armor plating ──
    const fwd = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.24, 0.7), midMat);
    fwd.position.z = -1.2;
    g.add(fwd);

    const fwdTaper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.4), armorMat);
    fwdTaper.position.z = -1.7;
    g.add(fwdTaper);

    // ── Nose cone — sharper ──
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 4), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0, -2.2);
    g.add(nose);

    // Nose sensor cluster
    const noseSensor = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), _glow(accent));
    noseSensor.position.set(0, 0, -2.62);
    g.add(noseSensor);

    // ── Bridge tower — detailed superstructure ──
    const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.55), armorMat);
    bridgeBase.position.set(0, 0.24, -0.2);
    g.add(bridgeBase);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.45), midMat);
    bridge.position.set(0, 0.36, -0.2);
    g.add(bridge);

    const bridgeWindow = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.07, 0.22), _canopy());
    bridgeWindow.position.set(0, 0.40, -0.38);
    g.add(bridgeWindow);

    // Bridge roof detail
    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.35), darkMat);
    bridgeRoof.position.set(0, 0.47, -0.2);
    g.add(bridgeRoof);

    // Bridge sensor mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), midMat);
    mast.position.set(0, 0.57, -0.2);
    g.add(mast);

    const mastTip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), _glow(accent));
    mastTip.position.set(0, 0.67, -0.2);
    g.add(mastTip);

    // ── Panel lines ──
    for (const zOff of [-1.5, -0.8, -0.1, 0.5, 0.9]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.005, 0.006), lineMat);
        line.position.set(0, 0.15, zOff);
        g.add(line);
    }
    for (const side of [1, -1]) {
        for (const zOff of [-0.6, 0.2, 0.7]) {
            const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.2, 0.006), lineMat);
            vLine.position.set(side * 0.33, 0.04, zOff);
            g.add(vLine);
        }
    }

    // ── Accent dorsal stripe ──
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 2.8), trimMat);
    stripe.position.set(0, 0.185, -0.15);
    g.add(stripe);

    // Side accent bands
    for (const side of [1, -1]) {
        const sideLine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 2.2), softTrim);
        sideLine.position.set(side * 0.33, 0.05, 0);
        g.add(sideLine);
    }

    // ── Side weapon pods with turrets ──
    for (const side of [1, -1]) {
        // Pod pylon
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.5), midMat);
        pylon.position.set(side * 0.42, -0.04, 0.3);
        g.add(pylon);

        // Weapon pod
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.75), darkMat);
        pod.position.set(side * 0.55, -0.04, 0.3);
        g.add(pod);

        // Pod accent band
        const podBand = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.018, 0.08), trimMat);
        podBand.position.set(side * 0.55, 0.04, 0.3);
        g.add(podBand);

        // Pod panel line
        const podLine = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.005, 0.005), lineMat);
        podLine.position.set(side * 0.55, 0.0, 0.05);
        g.add(podLine);

        // Turret base
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 8), armorMat);
        turretBase.position.set(side * 0.55, 0.05, 0.05);
        g.add(turretBase);

        // Turret barrel (twin)
        for (const bOff of [-0.025, 0.025]) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), nozzleMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(side * 0.55 + bOff, 0.06, -0.18);
            g.add(barrel);
        }

        // Wing stub
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.55), hullMat);
        wing.position.set(side * 0.82, -0.06, 0.2);
        g.add(wing);

        // Wing edge accent
        const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.015), trimMat);
        wingEdge.position.set(side * 0.82, -0.04, -0.05);
        g.add(wingEdge);

        // Wing tip fin
        const wingFin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.18), armorMat);
        wingFin.position.set(side * 1.05, -0.01, 0.2);
        g.add(wingFin);
    }

    // ── Rear engine block ──
    const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.33, 0.55), darkMat);
    rearBlock.position.z = 1.15;
    g.add(rearBlock);

    // Rear armor plate
    const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.36, 0.06), armorMat);
    rearPlate.position.z = 0.88;
    g.add(rearPlate);

    // ── Triple engine nacelles ──
    for (const x of [-0.24, 0, 0.24]) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.55, 10), darkMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(x, -0.04, 1.42);
        g.add(nacelle);

        // Intake ring
        const intakeRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.008, 6, 16), trimMat);
        intakeRing.rotation.x = Math.PI / 2;
        intakeRing.position.set(x, -0.04, 1.18);
        g.add(intakeRing);

        // Mid ring
        const midRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.006, 6, 12), midMat);
        midRing.rotation.x = Math.PI / 2;
        midRing.position.set(x, -0.04, 1.42);
        g.add(midRing);

        // Nozzle
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.14, 10), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(x, -0.04, 1.72);
        g.add(nozzle);

        // Glow
        _addGlowDisc(g, x, -0.04, 1.79, 0.06, accent);
        _addExhaustCone(g, x, -0.04, 1.79, 0.05, 0.3, accent);
    }

    // ── Ventral details ──
    // Sensor array under belly
    const ventralSensor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.25), panelMat);
    ventralSensor.position.set(0, -0.2, -0.6);
    g.add(ventralSensor);

    const sensorLens = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), _canopy());
    sensorLens.position.set(0, -0.22, -0.6);
    sensorLens.rotation.x = Math.PI;
    g.add(sensorLens);

    // ── Nav lights ──
    _addNavLight(g, 1.06, -0.01, 0.2, 0x00ff44, 0.032);
    _addNavLight(g, -1.06, -0.01, 0.2, 0xff2200, 0.032);
    _addNavLight(g, 0, 0.48, -0.4, accent, 0.025);
    _addNavLight(g, 0, -0.2, 0.9, accent, 0.02);

    return g;
}

// ── Cruiser (power 6+): Heavy capital ship ───────────────────────────────

function _buildCruiser(accent) {
    const g = new THREE.Group();
    const hullMat   = _hull();
    const hullLt    = _hullLight();
    const trimMat   = _accentTrim(accent);
    const softTrim  = _accentSoft(accent);
    const darkMat   = _dark();
    const midMat    = _mid();
    const armorMat  = _armor();
    const panelMat  = _panel();
    const nozzleMat = _nozzle();
    const lineMat   = _panelLine();

    // ── Main hull — massive layered body ──
    const hullMain = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 2.8), hullMat);
    g.add(hullMain);

    // Upper armor plating
    const upperArmor = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 2.5), hullLt);
    upperArmor.position.set(0, 0.24, 0);
    g.add(upperArmor);

    // Lower armor plating
    const lowerArmor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 2.2), panelMat);
    lowerArmor.position.set(0, -0.24, 0);
    g.add(lowerArmor);

    // ── Forward hull section — multi-layered taper ──
    const fwd1 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.38, 1.0), midMat);
    fwd1.position.z = -1.7;
    g.add(fwd1);

    const fwd2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.6), armorMat);
    fwd2.position.z = -2.4;
    g.add(fwd2);

    // Armored bow
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.26, 0.5), hullMat);
    bow.position.z = -2.85;
    g.add(bow);

    // Nose cap
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 4), darkMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.position.set(0, 0, -3.3);
    g.add(nose);

    // Bow sensor array
    const bowSensor = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), _glow(accent));
    bowSensor.position.set(0, 0, -3.6);
    g.add(bowSensor);

    // ── Command bridge — elevated superstructure ──
    const bridgePlatform = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.9), armorMat);
    bridgePlatform.position.set(0, 0.3, -0.5);
    g.add(bridgePlatform);

    const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.75), midMat);
    bridgeBase.position.set(0, 0.42, -0.5);
    g.add(bridgeBase);

    const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.55), darkMat);
    bridgeTop.position.set(0, 0.56, -0.5);
    g.add(bridgeTop);

    // Bridge windows — wrap-around
    const bridgeWindows = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.055, 0.28), _canopy());
    bridgeWindows.position.set(0, 0.55, -0.78);
    g.add(bridgeWindows);

    // Side bridge windows
    for (const side of [1, -1]) {
        const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.18), _canopy());
        sideWin.position.set(side * 0.2, 0.55, -0.55);
        g.add(sideWin);
    }

    // Bridge roof equipment
    const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 0.03, 8), midMat);
    radarDish.position.set(0.08, 0.65, -0.5);
    g.add(radarDish);

    const commsMast = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 4), midMat);
    commsMast.position.set(-0.08, 0.78, -0.5);
    g.add(commsMast);

    const commsTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), _glow(accent));
    commsTip.position.set(-0.08, 0.91, -0.5);
    g.add(commsTip);

    // Antenna mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4), midMat);
    mast.position.set(0, 0.82, -0.5);
    g.add(mast);

    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), midMat);
    dish.position.set(0, 0.82, -0.5);
    dish.rotation.x = Math.PI;
    g.add(dish);

    // ── Hull panel lines (extensive grid) ──
    for (const zOff of [-2.2, -1.5, -0.8, 0.0, 0.6, 1.1]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.005, 0.006), lineMat);
        line.position.set(0, 0.22, zOff);
        g.add(line);
    }
    for (const side of [1, -1]) {
        for (const zOff of [-1.8, -0.9, 0.0, 0.8]) {
            const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.3, 0.006), lineMat);
            vLine.position.set(side * 0.47, 0.05, zOff);
            g.add(vLine);
        }
    }

    // ── Accent racing stripes ──
    for (const yOff of [0.25, -0.25]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.03, 3.2), trimMat);
        stripe.position.set(0, yOff, -0.25);
        g.add(stripe);
    }

    // Dorsal accent
    const dorsalLine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 3.0), trimMat);
    dorsalLine.position.set(0, 0.28, -0.2);
    g.add(dorsalLine);

    // ── Side armor & weapon bays ──
    for (const side of [1, -1]) {
        // Main armor panel
        const armor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 1.8), armorMat);
        armor.position.set(side * 0.57, 0, 0);
        g.add(armor);

        // Armor accent strip
        const armorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 1.6), softTrim);
        armorTrim.position.set(side * 0.67, 0, 0);
        g.add(armorTrim);

        // Armor panel lines
        for (const zOff of [-0.5, 0.2, 0.7]) {
            const aLine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.005, 0.005), lineMat);
            aLine.position.set(side * 0.57, 0.1, zOff);
            g.add(aLine);
        }

        // Upper turret (detailed)
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 10), midMat);
        turretBase.position.set(side * 0.52, 0.25, 0.5);
        g.add(turretBase);

        const turretHousing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), armorMat);
        turretHousing.position.set(side * 0.52, 0.31, 0.5);
        g.add(turretHousing);

        // Twin barrels
        for (const bOff of [-0.025, 0.025]) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), nozzleMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(side * 0.52 + bOff, 0.3, 0.22);
            g.add(barrel);
        }

        // Lower turret
        const turretBase2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 10), midMat);
        turretBase2.position.set(side * 0.52, -0.25, -0.8);
        g.add(turretBase2);

        const turretHousing2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), armorMat);
        turretHousing2.position.set(side * 0.52, -0.31, -0.8);
        g.add(turretHousing2);

        for (const bOff of [-0.025, 0.025]) {
            const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), nozzleMat);
            barrel2.rotation.x = Math.PI / 2;
            barrel2.position.set(side * 0.52 + bOff, -0.3, -1.08);
            g.add(barrel2);
        }

        // Broadside weapon ports (accent-lit recesses)
        for (const zOff of [-0.3, 0.1, 0.5]) {
            const port = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), _glow(accent));
            port.position.set(side * 0.67, 0, zOff);
            g.add(port);
        }

        // Wing / radiator fin
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.025, 1.1), hullMat);
        wing.position.set(side * 0.92, 0, 0.4);
        g.add(wing);

        // Wing underside
        const wingUnder = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.012, 0.9), panelMat);
        wingUnder.position.set(side * 0.92, -0.02, 0.4);
        g.add(wingUnder);

        // Wing edge accent
        const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.012, 0.015), trimMat);
        wingEdge.position.set(side * 0.92, 0.015, -0.12);
        g.add(wingEdge);

        // Wing panel line
        const wingLine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.005, 0.005), lineMat);
        wingLine.position.set(side * 0.85, 0.015, 0.4);
        g.add(wingLine);

        // Winglet
        const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.28), armorMat);
        winglet.position.set(side * 1.2, 0.08, 0.7);
        g.add(winglet);

        // Wing tip nav light
        _addNavLight(g, side * 1.21, 0.18, 0.55, side > 0 ? 0x00ff44 : 0xff2200, 0.035);
    }

    // ── Forward weapon — main cannon (detailed) ──
    const cannonMount = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.2), armorMat);
    cannonMount.position.set(0, -0.08, -2.7);
    g.add(cannonMount);

    const mainCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 8), nozzleMat);
    mainCannon.rotation.x = Math.PI / 2;
    mainCannon.position.set(0, -0.08, -3.1);
    g.add(mainCannon);

    // Cannon muzzle glow
    const muzzleGlow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), _glow(accent));
    muzzleGlow.position.set(0, -0.08, -3.72);
    g.add(muzzleGlow);

    // ── Ventral flight deck / hangar ──
    const hangarBay = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.5), darkMat);
    hangarBay.position.set(0, -0.28, 0.3);
    g.add(hangarBay);

    const hangarDoor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.005, 0.35), softTrim);
    hangarDoor.position.set(0, -0.315, 0.3);
    g.add(hangarDoor);

    // ── Rear engine block ──
    const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.48, 0.6), darkMat);
    rearBlock.position.z = 1.6;
    g.add(rearBlock);

    // Rear armor
    const rearArmor = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 0.06), armorMat);
    rearArmor.position.z = 1.3;
    g.add(rearArmor);

    // ── Quad engines — detailed ──
    for (const pos of [[-0.28, 0.1], [0.28, 0.1], [-0.28, -0.1], [0.28, -0.1]]) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.65, 12), darkMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(pos[0], pos[1], 1.92);
        g.add(nacelle);

        // Intake ring
        const intakeRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.008, 6, 16), trimMat);
        intakeRing.rotation.x = Math.PI / 2;
        intakeRing.position.set(pos[0], pos[1], 1.63);
        g.add(intakeRing);

        // Mid reinforcement ring
        const midRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.006, 6, 12), midMat);
        midRing.rotation.x = Math.PI / 2;
        midRing.position.set(pos[0], pos[1], 1.92);
        g.add(midRing);

        // Nozzle
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 12), nozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(pos[0], pos[1], 2.28);
        g.add(nozzle);

        // Glow
        _addGlowDisc(g, pos[0], pos[1], 2.36, 0.075, accent);
        _addExhaustCone(g, pos[0], pos[1], 2.36, 0.06, 0.4, accent);
    }

    // ── Top nav lights ──
    _addNavLight(g, 0, 0.64, -0.7, accent, 0.03);
    _addNavLight(g, 0, -0.25, -2.5, accent, 0.022);
    // Rear warning light
    _addNavLight(g, 0, 0.26, 1.9, 0xff8800, 0.025);

    return g;
}

// ── Nav light helper (emissive sphere with glow) ──────────────────────────

function _addNavLight(group, x, y, z, color, size) {
    const mat = new THREE.MeshStandardMaterial({
        color, emissive: new THREE.Color(color), emissiveIntensity: 1.8,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), mat);
    sphere.position.set(x, y, z);
    group.add(sphere);
}
