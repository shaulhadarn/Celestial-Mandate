/**
 * Level Editor — standalone planet surface editor mode.
 * Entered from splash screen, fully independent of game state.
 */
import * as THREE from 'three';
import { scene, camera, renderer, controls, groups, composer } from '../core/scene_config.js';
import { disposeGroup } from '../core/dispose.js';
import { createTerrainMesh, getTerrainHeight, bakeHeightGrid } from './visuals_planet_terrain.js';
import { getSkyColor, getVegetationConfig, getPropColor,
         makeTree, makeTreeRound, makeTreeTall,
         makeBush, makeWildflower, makeAlienPlant } from './visuals_planet_environment.js';
import { initSplashPlanet, stopSplashPlanet } from './splash_renderer.js';
import { buildEditorUI, destroyEditorUI, updateProperties, clearProperties, updateObjectCount } from './level_editor_ui.js';

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
let _terrainGroup = null;

// ── Public API ──────────────────────────────────────────────────────────────

export function enterEditor() {
    stopSplashPlanet();

    // Fade splash
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.opacity = '0';
    setTimeout(() => {
        if (splash) splash.style.display = 'none';
    }, 600);

    state.isActive = true;
    state.placedObjects = [];
    state.selectedObjectId = null;

    // Show editor screen
    const editorScreen = document.getElementById('editor-screen');
    if (editorScreen) editorScreen.classList.remove('hidden');

    // Set up Three.js scene
    _buildScene(state.planetType);

    // Camera setup — use OrbitControls
    if (controls) {
        controls.enabled = true;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 8;
        controls.maxDistance = 200;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.target.set(0, 0, 0);
    }
    if (camera) {
        camera.position.set(40, 35, 40);
        camera.lookAt(0, 0, 0);
    }

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
    renderer.domElement.addEventListener('pointerdown', _onPointerDown);
    renderer.domElement.addEventListener('contextmenu', _preventDefault);

    // Start render loop
    _animate();
}

export function exitEditor() {
    state.isActive = false;
    if (state._animId) cancelAnimationFrame(state._animId);

    // Clean up
    renderer.domElement.removeEventListener('pointerdown', _onPointerDown);
    renderer.domElement.removeEventListener('contextmenu', _preventDefault);
    destroyEditorUI();

    // Dispose scene
    if (groups.planet) disposeGroup(groups.planet);
    state.editorGroup = null;
    state.terrainMesh = null;
    state.placedObjects = [];
    state._highlightMesh = null;

    // Reset scene
    if (scene) {
        scene.fog = null;
        scene.background = new THREE.Color(0x020408);
    }

    // Show splash
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

// ── Scene Building ──────────────────────────────────────────────────────────

function _buildScene(planetType) {
    if (groups.planet) disposeGroup(groups.planet);
    const group = groups.planet;

    const skyColor = getSkyColor(planetType);
    const isDark = ['Barren', 'Tomb', 'Molten', 'Ice', 'Arctic'].includes(planetType);

    // Fog & background
    if (scene) {
        let fogDensity = 0.002;
        if (planetType === 'Ocean') fogDensity = 0.004;
        if (planetType === 'Ice' || planetType === 'Arctic') fogDensity = 0.003;
        if (planetType === 'Tomb' || planetType === 'Molten') fogDensity = 0.006;
        if (planetType === 'Barren') fogDensity = 0.0005;
        scene.fog = new THREE.FogExp2(skyColor, fogDensity);
        scene.background = new THREE.Color(skyColor);
    }

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(600, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({ color: skyColor, side: THREE.BackSide });
    group.add(new THREE.Mesh(skyGeo, skyMat));

    if (isDark) {
        const sg = new THREE.BufferGeometry();
        const sp = new Float32Array(500 * 3);
        for (let i = 0; i < 500 * 3; i++) sp[i] = (Math.random() - 0.5) * 1000;
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        group.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0.7 })));
    }

    // Terrain
    state.terrainMesh = createTerrainMesh(planetType);
    group.add(state.terrainMesh);

    // Lights
    const sunColor = isDark ? 0xffbb88 : 0xffffff;
    const sun = new THREE.DirectionalLight(sunColor, isDark ? 2.0 : 2.8);
    sun.position.set(100, 200, 100);
    group.add(sun);
    group.add(sun.target);

    const fill = new THREE.DirectionalLight(isDark ? 0x334466 : 0x8899bb, isDark ? 0.8 : 0.5);
    fill.position.set(-80, 60, -80);
    group.add(fill);

    const ambientColor = isDark ? 0x223344 : 0x445566;
    group.add(new THREE.AmbientLight(ambientColor, isDark ? 1.2 : 0.9));
    group.add(new THREE.HemisphereLight(skyColor, 0x445544, isDark ? 0.8 : 1.2));

    // Editor group for placed objects
    state.editorGroup = new THREE.Group();
    group.add(state.editorGroup);

    // Ground grid helper (subtle)
    const gridHelper = new THREE.GridHelper(200, 40, 0x00f2ff, 0x112233);
    gridHelper.position.y = 0.05;
    gridHelper.material.opacity = 0.12;
    gridHelper.material.transparent = true;
    group.add(gridHelper);
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

    // Highlight ring
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 2.0, 32),
        new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(obj.x, getTerrainHeight(obj.x, obj.z) + 0.1, obj.z);
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
    // dispose children
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
        // Rebuild mesh with new scale
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
    // Only left click
    if (e.button !== 0) return;
    // Ignore clicks on UI panels
    if (e.target !== renderer.domElement) return;

    _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, camera);

    if (state.activeTool === 'place') {
        // Raycast terrain
        if (!state.terrainMesh) return;
        const hits = _raycaster.intersectObject(state.terrainMesh);
        if (hits.length > 0) {
            _placeObject(state.selectedBrush, hits[0].point);
        }
    } else if (state.activeTool === 'select' || state.activeTool === 'delete') {
        // Raycast placed objects
        const meshes = state.placedObjects.map(o => o.mesh);
        if (meshes.length === 0) return;
        const hits = _raycaster.intersectObjects(meshes, true);
        if (hits.length > 0) {
            // Walk up to find editorId
            let obj = hits[0].object;
            while (obj && !obj.userData.editorId) obj = obj.parent;
            if (obj && obj.userData.editorId) {
                const data = state.placedObjects.find(o => o.id === obj.userData.editorId);
                if (data) {
                    if (state.activeTool === 'select') {
                        _selectObject(data);
                    } else {
                        _deleteObject(data.id);
                    }
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
    // Serialize current objects
    const objectData = state.placedObjects.map(o => ({ type: o.type, x: o.x, z: o.z, rotY: o.rotY, scale: o.scale }));

    state.planetType = newType;
    state.selectedObjectId = null;
    state._highlightMesh = null;
    state.placedObjects = [];
    clearProperties();

    // Rebuild scene
    _buildScene(newType);

    // Re-place objects with new colors
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

    // Update planet type selector
    const select = document.getElementById('editor-planet-select');
    if (select) select.value = data.planetType;

    _changePlanetType(data.planetType);

    // Clear and re-place
    // (changePlanetType already cleared, but if same type we need to clear manually)
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

    if (controls) controls.update();

    // Pulse highlight ring
    if (state._highlightMesh) {
        const t = performance.now() * 0.003;
        state._highlightMesh.material.opacity = 0.3 + Math.sin(t) * 0.2;
        state._highlightMesh.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    }

    if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let _uuidCounter = 0;
function _uuid() {
    return 'ed_' + (++_uuidCounter) + '_' + Math.random().toString(36).slice(2, 8);
}
