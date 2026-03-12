/**
 * Player fleet ship 3D meshes, spawning, and idle orbit animation for system view.
 * 3 hull classes (scout / corvette / cruiser) with per-race accent colors.
 */
import * as THREE from 'three';
import { gameState, RACE_SHIPS } from '../core/state.js';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';

// ── Internal ship mesh tracking ─────────────────────────────────────────────

/** @type {{ mesh: THREE.Group, engineGlow: THREE.Sprite, trailAnchor: THREE.Object3D, fleetData: object, orbitPlanetMesh: THREE.Mesh, orbitAngle: number, orbitRadius: number, orbitSpeed: number, orbitInclination: number, _prevPos: THREE.Vector3 }[]} */
const _playerShipMeshes = [];

let _controlledEntry = null; // set by ship_control module

export function setControlledEntry(entry) { _controlledEntry = entry; }
export function getControlledEntry() { return _controlledEntry; }
export function getPlayerShipMeshes() { return _playerShipMeshes; }

// ── Shared materials ────────────────────────────────────────────────────────

const _matCache = {};
function _mat(key, props) {
    if (!_matCache[key]) _matCache[key] = new THREE.MeshStandardMaterial(props);
    return _matCache[key];
}

const darkHullMat = _mat('darkHull', { color: 0x556677, metalness: 0.85, roughness: 0.3 });
const canopyMat = _mat('canopy', { color: 0x112244, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.8 });
const engineNozzleMat = _mat('nozzle', { color: 0x333333, metalness: 0.95, roughness: 0.2 });

function _makeAccentHullMat(accent) {
    return new THREE.MeshStandardMaterial({
        color: 0x667788, metalness: 0.85, roughness: 0.3,
        emissive: new THREE.Color(accent), emissiveIntensity: 0.15,
    });
}

function _makeEngineGlow(accent) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: new THREE.Color(accent),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
    }));
    return sprite;
}

function _makeNavLight(color, size) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft, color: new THREE.Color(color),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
    }));
    sprite.scale.setScalar(size);
    return sprite;
}

// ── Hull Class: Scout (power 1-2) ───────────────────────────────────────────

function _createScoutHull(accent) {
    const g = new THREE.Group();
    const hullMat = _makeAccentHullMat(accent);

    // Main fuselage — sleek elongated box
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.8), hullMat);
    g.add(body);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), hullMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.25;
    g.add(nose);

    // Cockpit canopy
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), canopyMat);
    cockpit.position.set(0, 0.14, -0.5);
    g.add(cockpit);

    // Wings — swept back
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.9, -0.4);
    wingShape.lineTo(0.7, 0.1);
    wingShape.lineTo(0, 0.15);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: false });
    const wingR = new THREE.Mesh(wingGeo, hullMat);
    wingR.position.set(0.15, -0.05, -0.1);
    wingR.rotation.set(0, 0, -0.1);
    g.add(wingR);
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -0.15;
    g.add(wingL);

    // Engine nozzles (2)
    for (const side of [-0.2, 0.2]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 8), engineNozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.02, 0.95);
        g.add(nozzle);
    }

    // Engine glow
    const engineGlow = _makeEngineGlow(accent);
    engineGlow.scale.set(0.6, 0.6, 1);
    engineGlow.position.set(0, 0, 1.15);
    g.add(engineGlow);

    // Nav lights
    const navR = _makeNavLight(0x00ff00, 0.12);
    navR.position.set(0.85, 0, -0.2);
    g.add(navR);
    const navL = _makeNavLight(0xff0000, 0.12);
    navL.position.set(-0.85, 0, -0.2);
    g.add(navL);

    // Trail anchor
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, 1.2);
    g.add(trailAnchor);

    return { shipGroup: g, engineGlow, trailAnchor };
}

// ── Hull Class: Corvette (power 3-5) ────────────────────────────────────────

function _createCorvetteHull(accent) {
    const g = new THREE.Group();
    const hullMat = _makeAccentHullMat(accent);

    // Main fuselage
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 3.0), hullMat);
    g.add(body);

    // Forward section (tapered)
    const fwd = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 1.0), hullMat);
    fwd.position.z = -1.8;
    g.add(fwd);

    // Nose spike
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 6), hullMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -2.6;
    g.add(nose);

    // Bridge superstructure
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.7), hullMat);
    bridge.position.set(0, 0.3, -0.4);
    g.add(bridge);
    const bridgeCanopy = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.5), canopyMat);
    bridgeCanopy.position.set(0, 0.45, -0.4);
    g.add(bridgeCanopy);

    // Dorsal spine
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 2.0), hullMat);
    spine.position.set(0, 0.22, 0.3);
    g.add(spine);

    // Wings — wider with weapon pylons
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.3, -0.5);
    wingShape.lineTo(1.1, 0.1);
    wingShape.lineTo(0, 0.2);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });
    const wingR = new THREE.Mesh(wingGeo, hullMat);
    wingR.position.set(0.3, -0.08, 0.0);
    g.add(wingR);
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -0.3;
    g.add(wingL);

    // Weapon turrets on wings
    for (const side of [-1.0, 1.0]) {
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 8), engineNozzleMat);
        turretBase.position.set(side, 0.08, -0.3);
        g.add(turretBase);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), engineNozzleMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(side, 0.12, -0.5);
        g.add(barrel);
    }

    // Engine nozzles (3)
    for (const side of [-0.25, 0, 0.25]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8), engineNozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.02, 1.6);
        g.add(nozzle);
    }

    // Engine glow (combined)
    const engineGlow = _makeEngineGlow(accent);
    engineGlow.scale.set(1.0, 0.8, 1);
    engineGlow.position.set(0, 0, 1.85);
    g.add(engineGlow);

    // Nav lights
    const navR = _makeNavLight(0x00ff00, 0.15);
    navR.position.set(1.2, 0, -0.3);
    g.add(navR);
    const navL = _makeNavLight(0xff0000, 0.15);
    navL.position.set(-1.2, 0, -0.3);
    g.add(navL);

    // Trail anchor
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, 1.9);
    g.add(trailAnchor);

    return { shipGroup: g, engineGlow, trailAnchor };
}

// ── Hull Class: Cruiser (power 6+) ──────────────────────────────────────────

function _createCruiserHull(accent) {
    const g = new THREE.Group();
    const hullMat = _makeAccentHullMat(accent);

    // Main hull — multi-segment
    const bodyMain = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 3.5), hullMat);
    g.add(bodyMain);

    // Forward prongs (2)
    for (const side of [-0.35, 0.35]) {
        const prong = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 1.8), hullMat);
        prong.position.set(side, 0, -2.4);
        g.add(prong);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), hullMat);
        tip.rotation.x = -Math.PI / 2;
        tip.position.set(side, 0, -3.4);
        g.add(tip);
    }

    // Bridge tower
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), hullMat);
    bridge.position.set(0, 0.5, -0.5);
    g.add(bridge);
    const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.7), canopyMat);
    bridgeTop.position.set(0, 0.8, -0.5);
    g.add(bridgeTop);

    // Engine block (wider rear)
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.0), hullMat);
    engineBlock.position.set(0, 0, 1.6);
    g.add(engineBlock);

    // Lateral wings / weapon platforms
    for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 1.5), hullMat);
        wing.position.set(side * 0.95, -0.05, 0.2);
        g.add(wing);

        // Weapon turrets (2 per side)
        for (const zOff of [-0.3, 0.4]) {
            const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8), engineNozzleMat);
            turret.position.set(side * 1.0, 0.1, zOff);
            g.add(turret);
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), engineNozzleMat);
            barrel.rotation.x = -Math.PI / 2;
            barrel.position.set(side * 1.0, 0.15, zOff - 0.25);
            g.add(barrel);
        }
    }

    // Engine nozzles (5)
    for (const side of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.35, 8), engineNozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.02, 2.2);
        g.add(nozzle);
    }

    // Engine glow (large combined)
    const engineGlow = _makeEngineGlow(accent);
    engineGlow.scale.set(1.6, 1.0, 1);
    engineGlow.position.set(0, 0, 2.5);
    g.add(engineGlow);

    // Core engine glow (white-hot center)
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft, color: 0xffffff,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4,
    }));
    coreGlow.scale.set(0.8, 0.8, 1);
    coreGlow.position.set(0, 0, 2.3);
    g.add(coreGlow);

    // Nav lights (4 corners)
    const navPositions = [
        [1.3, 0.05, -0.1, 0x00ff00],
        [-1.3, 0.05, -0.1, 0xff0000],
        [0.3, 0.85, -0.5, accent],
        [-0.3, 0.85, -0.5, accent],
    ];
    navPositions.forEach(([x, y, z, col]) => {
        const nav = _makeNavLight(col, 0.15);
        nav.position.set(x, y, z);
        g.add(nav);
    });

    // Trail anchor
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, 2.6);
    g.add(trailAnchor);

    return { shipGroup: g, engineGlow, trailAnchor };
}

// ── Hull class router ───────────────────────────────────────────────────────

function _getHullClass(shipId) {
    for (const race of Object.values(RACE_SHIPS)) {
        const ship = race.find(s => s.id === shipId);
        if (ship) {
            if (ship.power <= 2) return 'scout';
            if (ship.power <= 5) return 'corvette';
            return 'cruiser';
        }
    }
    return 'scout';
}

/**
 * Creates a ship mesh group for the given ship type.
 * @returns {{ shipGroup: THREE.Group, engineGlow: THREE.Sprite, trailAnchor: THREE.Object3D }}
 */
export function createPlayerShipMesh(shipId, accentColor) {
    const hullClass = _getHullClass(shipId);
    const accent = accentColor || '#00f2ff';

    switch (hullClass) {
        case 'corvette': return _createCorvetteHull(accent);
        case 'cruiser':  return _createCruiserHull(accent);
        default:         return _createScoutHull(accent);
    }
}

// ── Ship spawning ───────────────────────────────────────────────────────────

/**
 * Spawns a player ship mesh orbiting a planet.
 * @param {object} fleetData - The fleet object from gameState.fleets
 * @param {THREE.Group} group - The system scene group
 * @param {THREE.Mesh} [planetMesh] - Planet to orbit (optional, orbits sun if null)
 */
export function spawnPlayerShip(fleetData, group, planetMesh) {
    const accent = fleetData.accentColor || '#00f2ff';
    const { shipGroup, engineGlow, trailAnchor } = createPlayerShipMesh(fleetData.shipId, accent);

    // Scale based on hull class
    const hullClass = _getHullClass(fleetData.shipId);
    const scale = { scout: 0.5, corvette: 0.65, cruiser: 0.8 }[hullClass] || 0.5;
    shipGroup.scale.setScalar(scale);

    // Orbit parameters
    const planetRadius = planetMesh?.geometry?.parameters?.radius || 2;
    const orbitRadius = planetRadius * 2.8 + Math.random() * 1.5;
    const startAngle = Math.random() * Math.PI * 2;
    const orbitSpeed = 0.2 + Math.random() * 0.15;
    const orbitInclination = (Math.random() - 0.5) * 0.4;

    const center = planetMesh ? planetMesh.position : new THREE.Vector3(0, 0, 0);
    shipGroup.position.set(
        center.x + Math.cos(startAngle) * orbitRadius,
        center.y + Math.sin(startAngle * 0.5) * orbitInclination * orbitRadius,
        center.z + Math.sin(startAngle) * orbitRadius
    );

    // Tag for raycasting
    shipGroup.userData.fleetId = fleetData.id;
    shipGroup.userData.isPlayerShip = true;
    shipGroup.userData.shipName = fleetData.name;

    group.add(shipGroup);

    _playerShipMeshes.push({
        mesh: shipGroup,
        engineGlow,
        trailAnchor,
        fleetData,
        orbitPlanetMesh: planetMesh || null,
        orbitAngle: startAngle,
        orbitRadius,
        orbitSpeed,
        orbitInclination,
        _prevPos: shipGroup.position.clone(),
    });
}

// ── Build all ships for current system ──────────────────────────────────────

/**
 * Called from createSystemVisuals to spawn meshes for all fleets in the current system.
 * @param {THREE.Group} group - The system scene group
 * @param {THREE.Mesh[]} planetMeshesArr - Array of planet meshes with userData.id
 */
export function buildPlayerShips(group, planetMeshesArr) {
    const currentSystemId = gameState.selectedSystemId;
    if (!currentSystemId || !gameState.fleets) return;

    const fleetsHere = gameState.fleets.filter(f => f.systemId === currentSystemId && !f.moving);

    fleetsHere.forEach(fleet => {
        const planetMesh = planetMeshesArr?.find(m => m.userData.id === fleet.planetId) || null;
        spawnPlayerShip(fleet, group, planetMesh);
    });
}

// ── Idle orbit animation ────────────────────────────────────────────────────

const _tmpLookAt = new THREE.Vector3();

/**
 * Updates all idle (non-controlled) player ship orbits. Called per-frame.
 */
export function updatePlayerShipOrbits(time, dt) {
    _playerShipMeshes.forEach(entry => {
        // Skip the controlled ship — its position is driven by flight physics
        if (entry === _controlledEntry) return;

        entry.orbitAngle += entry.orbitSpeed * dt * 0.3;

        const center = entry.orbitPlanetMesh
            ? entry.orbitPlanetMesh.position
            : _tmpLookAt.set(0, 0, 0);

        const a = entry.orbitAngle;
        const r = entry.orbitRadius;
        const incl = entry.orbitInclination;

        entry.mesh.position.set(
            center.x + Math.cos(a) * r,
            center.y + Math.sin(a * 0.5) * incl * r,
            center.z + Math.sin(a) * r
        );

        // Face orbital direction (look ahead)
        _tmpLookAt.set(
            center.x + Math.cos(a + 0.1) * r,
            center.y + Math.sin((a + 0.1) * 0.5) * incl * r,
            center.z + Math.sin(a + 0.1) * r
        );
        entry.mesh.lookAt(_tmpLookAt);

        // Engine glow pulse
        if (entry.engineGlow) {
            entry.engineGlow.material.opacity = 0.35 + 0.15 * Math.sin(time * 5 + entry.orbitAngle);
        }

        entry._prevPos.copy(entry.mesh.position);
    });
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

export function clearPlayerShips() {
    _playerShipMeshes.forEach(entry => {
        if (entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
    });
    _playerShipMeshes.length = 0;
    _controlledEntry = null;
}

export function removePlayerShip(fleetId) {
    const idx = _playerShipMeshes.findIndex(e => e.fleetData.id === fleetId);
    if (idx === -1) return;
    const entry = _playerShipMeshes[idx];
    if (entry.mesh.parent) entry.mesh.parent.remove(entry.mesh);
    _playerShipMeshes.splice(idx, 1);
    if (_controlledEntry === entry) _controlledEntry = null;
}
