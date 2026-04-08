/**
 * Level Editor — standalone planet surface editor mode.
 * Creates its own Three.js renderer, scene, camera, and controls.
 * Fully independent from the game's R3F-managed scene.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTerrainMesh, getTerrainHeight } from './visuals_planet_terrain.js';
import { getSkyColor, getVegetationConfig, getPropColor,
         makeTree, makeTreeRound, makeTreeTall,
         makeBush, makeWildflower, makeAlienPlant } from './visuals_planet_environment.js';
import { initSplashPlanet, stopSplashPlanet } from './splash_renderer.js';
import { buildEditorUI, destroyEditorUI, updateProperties, clearProperties, updateObjectCount } from './level_editor_ui.js';

// ── Editor-owned Three.js instances ────────────────────────────────────────

let _scene = null;
let _camera = null;
let _renderer = null;
let _controls = null;
let _canvas = null;

// ── Editor State ────────────────────────────────────────────────────────────

const state = {
    planetType: 'Terran',
    activeTool: 'place',
    selectedBrush: 'tree',
    selectedObjectId: null,
    placedObjects: [],
    editorGroup: null,
    terrainMesh: null,
    isActive: false,
    _highlightMesh: null,
    _animId: null,
};

const _raycaster = new THREE.Raycaster();
const _mouse = new THREE.Vector2();

// ── Public API ──────────────────────────────────────────────────────────────

export function enterEditor() {
    stopSplashPlanet();

    // Fade splash
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.opacity = '0';
    setTimeout(() => { if (splash) splash.style.display = 'none'; }, 600);

    state.isActive = true;
    state.placedObjects = [];
    state.selectedObjectId = null;

    // Show editor screen, hide game UI
    const editorScreen = document.getElementById('editor-screen');
    if (editorScreen) editorScreen.classList.remove('hidden');
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.classList.add('hidden');

    // Create standalone renderer
    _initRenderer();

    // Build the planet scene
    _buildScene(state.planetType);

    // Build UI
    buildEditorUI({
        getPlanetType: () => state.planetType,
        onChangePlanetType: _changePlanetType,
        onChangeTool: (t) => { state.activeTool = t; _deselectCurrent(); },
        onSelectBrush: (b) => { state.selectedBrush = b; },
        onSave: _saveMap,
        onLoad: _loadMap,
        onExport: _exportJSON,
        onClear: _clearAll,
        onExit: exitEditor,
        onDeleteSelected: _deleteSelected,
        onUpdateProperty: _updateProperty,
        onDeleteMap: _deleteMap,
        getMapList: _getMapList,
    });

    // Event listeners
    _renderer.domElement.addEventListener('pointerdown', _onPointerDown);
    _renderer.domElement.addEventListener('contextmenu', _preventDefault);

    // Start render loop
    _animate();
}

export function exitEditor() {
    state.isActive = false;
    if (state._animId) cancelAnimationFrame(state._animId);

    // Remove listeners
    if (_renderer) {
        _renderer.domElement.removeEventListener('pointerdown', _onPointerDown);
        _renderer.domElement.removeEventListener('contextmenu', _preventDefault);
    }
    destroyEditorUI();

    // Dispose scene objects
    if (_scene) {
        _scene.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
    }
    state.editorGroup = null;
    state.terrainMesh = null;
    state.placedObjects = [];
    state._highlightMesh = null;

    // Dispose renderer
    if (_controls) { _controls.dispose(); _controls = null; }
    if (_renderer) {
        _renderer.dispose();
        if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
        _renderer = null;
        _canvas = null;
    }
    _scene = null;
    _camera = null;

    // Hide editor, show splash
    const editorScreen = document.getElementById('editor-screen');
    if (editorScreen) editorScreen.classList.add('hidden');

    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.display = '';
        splash.style.opacity = '0';
        requestAnimationFrame(() => { splash.style.opacity = '1'; });
        initSplashPlanet('splash-planet-container');
    }
}

// ── Renderer Setup ─────────────────────────────────────────────────────────

function _initRenderer() {
    // Dispose previous if any
    if (_renderer) {
        _renderer.dispose();
        if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
    }

    _scene = new THREE.Scene();
    _camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    _camera.position.set(40, 35, 40);

    _renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.1;
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    _canvas = _renderer.domElement;
    _canvas.style.position = 'fixed';
    _canvas.style.top = '0';
    _canvas.style.left = '0';
    _canvas.style.zIndex = '1';
    document.body.appendChild(_canvas);

    // OrbitControls
    _controls = new OrbitControls(_camera, _canvas);
    _controls.enableDamping = true;
    _controls.dampingFactor = 0.08;
    _controls.enablePan = true;
    _controls.panSpeed = 1.0;
    _controls.minDistance = 8;
    _controls.maxDistance = 250;
    _controls.maxPolarAngle = Math.PI / 2 - 0.05;
    _controls.target.set(0, 0, 0);

    // Handle resize
    window.addEventListener('resize', _onResize);
}

function _onResize() {
    if (!_renderer || !_camera) return;
    _camera.aspect = window.innerWidth / window.innerHeight;
    _camera.updateProjectionMatrix();
    _renderer.setSize(window.innerWidth, window.innerHeight);
}

// ── Scene Building ──────────────────────────────────────────────────────────

function _buildScene(planetType) {
    // Clear existing scene
    while (_scene.children.length > 0) {
        const child = _scene.children[0];
        _scene.remove(child);
    }

    const skyColor = getSkyColor(planetType);
    const isDark = ['Barren', 'Tomb', 'Molten', 'Ice', 'Arctic'].includes(planetType);

    // Fog & background
    let fogDensity = 0.002;
    if (planetType === 'Ocean') fogDensity = 0.004;
    if (planetType === 'Ice' || planetType === 'Arctic') fogDensity = 0.003;
    if (planetType === 'Tomb' || planetType === 'Molten') fogDensity = 0.006;
    if (planetType === 'Barren') fogDensity = 0.0005;
    _scene.fog = new THREE.FogExp2(skyColor, fogDensity);
    _scene.background = new THREE.Color(skyColor);

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(600, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
    _scene.add(new THREE.Mesh(skyGeo, skyMat));

    if (isDark) {
        const sg = new THREE.BufferGeometry();
        const sp = new Float32Array(500 * 3);
        for (let i = 0; i < 500 * 3; i++) sp[i] = (Math.random() - 0.5) * 1000;
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        _scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.7 })));
    }

    // Terrain
    state.terrainMesh = createTerrainMesh(planetType);
    _scene.add(state.terrainMesh);

    // Lights
    const sunColor = isDark ? 0xffbb88 : 0xffffff;
    const sun = new THREE.DirectionalLight(sunColor, isDark ? 2.0 : 2.8);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    _scene.add(sun);
    _scene.add(sun.target);

    const fill = new THREE.DirectionalLight(isDark ? 0x334466 : 0x8899bb, isDark ? 0.8 : 0.5);
    fill.position.set(-80, 60, -80);
    _scene.add(fill);

    const ambientColor = isDark ? 0x223344 : 0x445566;
    _scene.add(new THREE.AmbientLight(ambientColor, isDark ? 1.2 : 0.9));
    _scene.add(new THREE.HemisphereLight(skyColor, 0x445544, isDark ? 0.8 : 1.2));

    // Editor group for placed objects
    state.editorGroup = new THREE.Group();
    _scene.add(state.editorGroup);

    // Ground grid helper (subtle)
    const gridHelper = new THREE.GridHelper(200, 40, 0x00f2ff, 0x112233);
    gridHelper.position.y = 0.1;
    gridHelper.material.opacity = 0.1;
    gridHelper.material.transparent = true;
    _scene.add(gridHelper);
}

// ── Object Creation ─────────────────────────────────────────────────────────

function _createObjectMesh(type, scale) {
    const vc = getVegetationConfig(state.planetType);
    const s = scale || (0.7 + Math.random() * 0.6);

    switch (type) {
        case 'tree':
            return makeTree(vc.treeColor || 0x2d5a1b, vc.trunkColor || 0x5c3a1e, s);
        case 'tree_round':
            return makeTreeRound(vc.treeColor2 || vc.treeColor || 0x3a6e28, vc.trunkColor2 || vc.trunkColor || 0x6b4422, s);
        case 'tree_tall':
            return makeTreeTall(vc.treeColor3 || vc.treeColor || 0x4a8832, vc.trunkColor3 || vc.trunkColor || 0xd4c8a0, s);
        case 'bush':
            return makeBush(vc.bushColor || 0x3a7a22, s);
        case 'wildflower':
            return makeWildflower(vc.wildflowerColors || [0xdd4466, 0xffaa22, 0xeedd55], s);
        case 'alien_plant':
            return makeAlienPlant(vc.alienPlantColor || 0x8b44cc, vc.alienGlow || 0x6600ff, s);
        case 'rock': {
            const geo = new THREE.DodecahedronGeometry(1.5 * s, 0);
            const mat = new THREE.MeshStandardMaterial({
                color: getPropColor(state.planetType), roughness: 0.85, metalness: 0.1
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            const g = new THREE.Group();
            g.add(mesh);
            mesh.position.y = 0.5 * s;
            return g;
        }
        case 'crystal': {
            const geo = new THREE.ConeGeometry(0.6 * s, 2.5 * s, 5);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x00ddff, emissive: 0x00aacc, emissiveIntensity: 0.4,
                transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.6
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            const g = new THREE.Group();
            g.add(mesh);
            mesh.position.y = 1.2 * s;
            return g;
        }
        case 'lake': {
            const radius = 25;
            const geo = new THREE.CircleGeometry(radius, 48);
            const mat = new THREE.MeshStandardMaterial({
                color: 0x1a7acc, emissive: 0x0a3066, emissiveIntensity: 0.2,
                transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.3,
                side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            const g = new THREE.Group();
            g.add(mesh);
            return g;
        }
        default:
            return makeBush(0x3a7a22, s);
    }
}

function _placeObject(type, hitPoint) {
    const scale = (type === 'lake') ? 1 : (0.7 + Math.random() * 0.6);
    const mesh = _createObjectMesh(type, scale);
    const y = (type === 'lake') ? getTerrainHeight(hitPoint.x, hitPoint.z) - 0.3 : getTerrainHeight(hitPoint.x, hitPoint.z);
    mesh.position.set(hitPoint.x, y, hitPoint.z);
    const rotY = Math.random() * Math.PI * 2;
    mesh.rotation.y = rotY;

    const id = _uuid();
    mesh.userData.editorId = id;
    mesh.userData.editorType = type;
    state.editorGroup.add(mesh);

    state.placedObjects.push({ id, type, x: hitPoint.x, z: hitPoint.z, rotY, scale, mesh });
    updateObjectCount(state.placedObjects.length);
}

// ── Selection ───────────────────────────────────────────────────────────────

function _selectObject(obj) {
    _deselectCurrent();
    state.selectedObjectId = obj.id;

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 2.0, 32),
        new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(obj.x, getTerrainHeight(obj.x, obj.z) + 0.15, obj.z);
    ring.userData._editorHighlight = true;
    state.editorGroup.add(ring);
    state._highlightMesh = ring;

    updateProperties(obj);
}

function _deselectCurrent() {
    state.selectedObjectId = null;
    if (state._highlightMesh) {
        state.editorGroup.remove(state._highlightMesh);
        if (state._highlightMesh.geometry) state._highlightMesh.geometry.dispose();
        if (state._highlightMesh.material) state._highlightMesh.material.dispose();
        state._highlightMesh = null;
    }
    clearProperties();
}

function _deleteSelected() {
    if (!state.selectedObjectId) return;
    _deleteObject(state.selectedObjectId);
    _deselectCurrent();
}

function _deleteObject(id) {
    const idx = state.placedObjects.findIndex(o => o.id === id);
    if (idx < 0) return;
    const obj = state.placedObjects[idx];
    state.editorGroup.remove(obj.mesh);
    obj.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
        }
    });
    state.placedObjects.splice(idx, 1);
    updateObjectCount(state.placedObjects.length);
}

function _updateProperty(id, prop, value) {
    const obj = state.placedObjects.find(o => o.id === id);
    if (!obj) return;

    if (prop === 'rotY') {
        obj.rotY = value;
        obj.mesh.rotation.y = value;
    } else if (prop === 'scale') {
        const pos = obj.mesh.position.clone();
        const rotY = obj.rotY;
        state.editorGroup.remove(obj.mesh);
        obj.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });

        const newMesh = _createObjectMesh(obj.type, value);
        newMesh.position.copy(pos);
        newMesh.rotation.y = rotY;
        newMesh.userData.editorId = id;
        newMesh.userData.editorType = obj.type;
        state.editorGroup.add(newMesh);
        obj.mesh = newMesh;
        obj.scale = value;
    }
}

// ── Input Handling ──────────────────────────────────────────────────────────

function _onPointerDown(e) {
    if (!state.isActive) return;
    if (e.button !== 0) return;
    if (e.target !== _renderer.domElement) return;

    _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, _camera);

    if (state.activeTool === 'place') {
        if (!state.terrainMesh) return;
        const hits = _raycaster.intersectObject(state.terrainMesh);
        if (hits.length > 0) {
            _placeObject(state.selectedBrush, hits[0].point);
        }
    } else if (state.activeTool === 'select' || state.activeTool === 'delete') {
        const meshes = state.placedObjects.map(o => o.mesh);
        if (meshes.length === 0) { _deselectCurrent(); return; }
        const hits = _raycaster.intersectObjects(meshes, true);
        if (hits.length > 0) {
            let obj = hits[0].object;
            while (obj && !obj.userData.editorId) obj = obj.parent;
            if (obj && obj.userData.editorId) {
                const data = state.placedObjects.find(o => o.id === obj.userData.editorId);
                if (data) {
                    if (state.activeTool === 'select') _selectObject(data);
                    else _deleteObject(data.id);
                }
            }
        } else {
            _deselectCurrent();
        }
    }
}

function _preventDefault(e) { e.preventDefault(); }

// ── Planet Type Change ──────────────────────────────────────────────────────

function _changePlanetType(newType) {
    const objectData = state.placedObjects.map(o => ({ type: o.type, x: o.x, z: o.z, rotY: o.rotY, scale: o.scale }));

    state.planetType = newType;
    state.selectedObjectId = null;
    state._highlightMesh = null;
    state.placedObjects = [];
    clearProperties();

    _buildScene(newType);

    objectData.forEach(d => {
        const mesh = _createObjectMesh(d.type, d.scale);
        const y = (d.type === 'lake') ? getTerrainHeight(d.x, d.z) - 0.3 : getTerrainHeight(d.x, d.z);
        mesh.position.set(d.x, y, d.z);
        mesh.rotation.y = d.rotY;
        const id = _uuid();
        mesh.userData.editorId = id;
        mesh.userData.editorType = d.type;
        state.editorGroup.add(mesh);
        state.placedObjects.push({ id, type: d.type, x: d.x, z: d.z, rotY: d.rotY, scale: d.scale, mesh });
    });
    updateObjectCount(state.placedObjects.length);
}

// ── Save / Load / Export ────────────────────────────────────────────────────

const STORAGE_KEY = 'celestial_editor_maps';

function _saveMap(name) {
    const data = {
        planetType: state.planetType,
        objects: state.placedObjects.map(o => ({ type: o.type, x: o.x, z: o.z, rotY: o.rotY, scale: o.scale })),
    };
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    store[name] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function _loadMap(name) {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const data = store[name];
    if (!data) return;

    const select = document.getElementById('editor-planet-select');
    if (select) select.value = data.planetType;

    _changePlanetType(data.planetType);

    state.placedObjects.forEach(o => state.editorGroup.remove(o.mesh));
    state.placedObjects = [];

    (data.objects || []).forEach(d => {
        const mesh = _createObjectMesh(d.type, d.scale);
        const y = (d.type === 'lake') ? getTerrainHeight(d.x, d.z) - 0.3 : getTerrainHeight(d.x, d.z);
        mesh.position.set(d.x, y, d.z);
        mesh.rotation.y = d.rotY || 0;
        const id = _uuid();
        mesh.userData.editorId = id;
        mesh.userData.editorType = d.type;
        state.editorGroup.add(mesh);
        state.placedObjects.push({ id, type: d.type, x: d.x, z: d.z, rotY: d.rotY || 0, scale: d.scale || 1, mesh });
    });
    updateObjectCount(state.placedObjects.length);
}

function _exportJSON() {
    const data = {
        planetType: state.planetType,
        objects: state.placedObjects.map(o => ({ type: o.type, x: +o.x.toFixed(2), z: +o.z.toFixed(2), rotY: +o.rotY.toFixed(3), scale: +o.scale.toFixed(2) })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level_${state.planetType.toLowerCase()}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function _clearAll() {
    state.placedObjects.forEach(o => {
        state.editorGroup.remove(o.mesh);
        o.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    state.placedObjects = [];
    _deselectCurrent();
    updateObjectCount(0);
}

function _deleteMap(name) {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete store[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function _getMapList() {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.entries(store).map(([name, data]) => ({ name, planetType: data.planetType }));
}

// ── Render Loop ─────────────────────────────────────────────────────────────

function _animate() {
    if (!state.isActive) return;
    state._animId = requestAnimationFrame(_animate);

    if (_controls) _controls.update();

    // Pulse highlight ring
    if (state._highlightMesh) {
        const t = performance.now() * 0.003;
        state._highlightMesh.material.opacity = 0.3 + Math.sin(t) * 0.2;
        state._highlightMesh.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    }

    if (_renderer && _scene && _camera) {
        _renderer.render(_scene, _camera);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let _uuidCounter = 0;
function _uuid() {
    return 'ed_' + (++_uuidCounter) + '_' + Math.random().toString(36).slice(2, 8);
}
