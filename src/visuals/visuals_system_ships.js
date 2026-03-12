/**
 * Player fleet ship 3D meshes, spawning, and idle orbit animation for system view.
 * 3 hull classes (scout / corvette / cruiser) with per-race accent colors.
 * Ships are kept small relative to planets to convey system-scale grandeur.
 */
import * as THREE from 'three';
import { gameState, RACE_SHIPS } from '../core/state.js';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';
import { _spawnSatTrail } from './visuals_system.js';

// ── Internal ship mesh tracking ─────────────────────────────────────────────

/** @type {{ mesh: THREE.Group, engineGlow: THREE.Sprite, trailAnchor: THREE.Object3D, fleetData: object, orbitPlanetMesh: THREE.Mesh, orbitAngle: number, orbitRadius: number, orbitSpeed: number, orbitInclination: number, _prevPos: THREE.Vector3 }[]} */
const _playerShipMeshes = [];

let _controlledEntry = null;

export function setControlledEntry(entry) { _controlledEntry = entry; }
export function getControlledEntry() { return _controlledEntry; }
export function getPlayerShipMeshes() { return _playerShipMeshes; }

// ── Shared materials ────────────────────────────────────────────────────────

const _matCache = {};
function _mat(key, props) {
    if (!_matCache[key]) _matCache[key] = new THREE.MeshStandardMaterial(props);
    return _matCache[key];
}

const darkHullMat   = _mat('darkHull',  { color: 0x3a4455, metalness: 0.9, roughness: 0.25 });
const midHullMat    = _mat('midHull',   { color: 0x556677, metalness: 0.85, roughness: 0.3 });
const canopyMat     = _mat('canopy',    { color: 0x0a1833, metalness: 0.95, roughness: 0.08, transparent: true, opacity: 0.85 });
const engineNozzleMat = _mat('nozzle',  { color: 0x222222, metalness: 0.95, roughness: 0.15 });
const panelLineMat  = _mat('panelLine', { color: 0x1a2233, metalness: 0.7, roughness: 0.5 });
const antennaMat    = _mat('antenna',   { color: 0x889999, metalness: 0.9, roughness: 0.2 });

function _makeAccentHullMat(accent) {
    return new THREE.MeshStandardMaterial({
        color: 0x556677, metalness: 0.85, roughness: 0.28,
        emissive: new THREE.Color(accent), emissiveIntensity: 0.18,
    });
}

function _makeAccentPanelMat(accent) {
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(accent).multiplyScalar(0.3), metalness: 0.8, roughness: 0.35,
        emissive: new THREE.Color(accent), emissiveIntensity: 0.35,
    });
}

function _makeEngineGlow(accent) {
    return new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: new THREE.Color(accent),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
    }));
}

function _makeNavLight(color, size) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft, color: new THREE.Color(color),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55,
    }));
    sprite.scale.setScalar(size);
    return sprite;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _addPanelLine(g, x, y, z, sx, sy, sz) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), panelLineMat);
    line.position.set(x, y, z);
    g.add(line);
}

function _addAntenna(g, x, y, z, height) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, height, 4), antennaMat);
    rod.position.set(x, y + height / 2, z);
    g.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), antennaMat);
    tip.position.set(x, y + height, z);
    g.add(tip);
}

// ── Hull Class: Scout (power 1-2) ───────────────────────────────────────────
// Agile interceptor — delta wing, sharp nose, twin engines

function _createScoutHull(accent) {
    const g = new THREE.Group();
    const hullMat = _makeAccentHullMat(accent);
    const accentPanel = _makeAccentPanelMat(accent);

    // Main fuselage — tapered front, wider rear
    const bodyFwd = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 1.0), hullMat);
    bodyFwd.position.z = -0.3;
    g.add(bodyFwd);
    const bodyRear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.9), darkHullMat);
    bodyRear.position.z = 0.4;
    g.add(bodyRear);

    // Nose — sharp angular cone
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, -0.08);
    noseShape.lineTo(0.15, -0.06);
    noseShape.lineTo(0, 0.08);
    noseShape.lineTo(-0.15, -0.06);
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.rotation.x = Math.PI;
    nose.position.set(0, 0.02, -0.8);
    g.add(nose);

    // Cockpit canopy — raised bubble
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), canopyMat);
    cockpit.position.set(0, 0.12, -0.55);
    g.add(cockpit);

    // Accent stripe along fuselage
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 1.6), accentPanel);
    stripe.position.set(0, 0.1, 0.05);
    g.add(stripe);

    // Delta wings — swept back with beveled edge
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.1, -0.6);
    wingShape.lineTo(0.95, -0.55);
    wingShape.lineTo(0.85, -0.35);
    wingShape.lineTo(0, 0.12);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1 });
    const wingR = new THREE.Mesh(wingGeo, hullMat);
    wingR.position.set(0.18, -0.04, 0.0);
    wingR.rotation.set(0, 0, -0.06);
    g.add(wingR);
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -0.18;
    g.add(wingL);

    // Winglets (vertical stabilizers at wingtips)
    for (const side of [1, -1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.2), hullMat);
        fin.position.set(side * 0.92, 0.04, -0.12);
        fin.rotation.z = side * -0.15;
        g.add(fin);
    }

    // Tail fins (V-tail)
    for (const side of [1, -1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.3), darkHullMat);
        tail.position.set(side * 0.18, 0.12, 0.72);
        tail.rotation.z = side * -0.25;
        tail.rotation.x = 0.1;
        g.add(tail);
    }

    // Engine nacelles (twin pods)
    for (const side of [-0.22, 0.22]) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.55, 8), darkHullMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(side, -0.03, 0.65);
        g.add(nacelle);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), engineNozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.03, 0.95);
        g.add(nozzle);
    }

    // Underbelly intake
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.4), engineNozzleMat);
    intake.position.set(0, -0.12, -0.2);
    g.add(intake);

    // Panel lines
    _addPanelLine(g, 0, 0.005, -0.4, 0.005, 0.17, 0.6);
    _addPanelLine(g, 0.15, 0, 0.3, 0.005, 0.2, 0.5);
    _addPanelLine(g, -0.15, 0, 0.3, 0.005, 0.2, 0.5);

    // Antenna
    _addAntenna(g, 0, 0.12, -0.9, 0.15);

    // Engine glow
    const engineGlow = _makeEngineGlow(accent);
    engineGlow.scale.set(0.5, 0.4, 1);
    engineGlow.position.set(0, -0.02, 1.05);
    g.add(engineGlow);

    // Individual engine glows
    for (const side of [-0.22, 0.22]) {
        const eg = _makeEngineGlow(accent);
        eg.scale.set(0.2, 0.2, 1);
        eg.position.set(side, -0.03, 1.0);
        g.add(eg);
    }

    // Nav lights
    g.add(Object.assign(_makeNavLight(0x00ff00, 0.08), { position: new THREE.Vector3(0.95, 0.03, -0.15) }));
    g.add(Object.assign(_makeNavLight(0xff0000, 0.08), { position: new THREE.Vector3(-0.95, 0.03, -0.15) }));
    g.add(Object.assign(_makeNavLight(accent, 0.06), { position: new THREE.Vector3(0, 0.15, 0.8) }));

    // Trail anchor
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, 1.1);
    g.add(trailAnchor);

    return { shipGroup: g, engineGlow, trailAnchor };
}

// ── Hull Class: Corvette (power 3-5) ────────────────────────────────────────
// Multi-role warship — angular hull, bridge tower, weapon systems, 3 engines

function _createCorvetteHull(accent) {
    const g = new THREE.Group();
    const hullMat = _makeAccentHullMat(accent);
    const accentPanel = _makeAccentPanelMat(accent);

    // Main hull — layered angular sections
    const hullLower = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 3.2), darkHullMat);
    hullLower.position.y = -0.08;
    g.add(hullLower);
    const hullUpper = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 2.8), hullMat);
    hullUpper.position.y = 0.1;
    g.add(hullUpper);

    // Forward hull taper
    const fwdSection = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.2), hullMat);
    fwdSection.position.set(0, 0.02, -2.0);
    g.add(fwdSection);

    // Nose — angular wedge
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, -0.09);
    noseShape.lineTo(0.2, -0.07);
    noseShape.lineTo(0, 0.09);
    noseShape.lineTo(-0.2, -0.07);
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.rotation.x = Math.PI;
    nose.position.set(0, 0.02, -2.6);
    g.add(nose);

    // Bridge superstructure — multi-level
    const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.8), darkHullMat);
    bridgeBase.position.set(0, 0.26, -0.5);
    g.add(bridgeBase);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.6), hullMat);
    bridge.position.set(0, 0.38, -0.5);
    g.add(bridge);
    const bridgeWindows = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.5), canopyMat);
    bridgeWindows.position.set(0, 0.48, -0.5);
    g.add(bridgeWindows);

    // Sensor mast atop bridge
    _addAntenna(g, 0, 0.52, -0.5, 0.25);
    // Radar dish
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI), antennaMat);
    dish.rotation.x = -Math.PI / 2;
    dish.position.set(0.12, 0.55, -0.35);
    g.add(dish);

    // Accent stripe panels (port/starboard)
    for (const side of [1, -1]) {
        const acStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 2.0), accentPanel);
        acStripe.position.set(side * 0.34, 0.12, -0.1);
        g.add(acStripe);
    }

    // Wings — angular with hard edges
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.4, -0.6);
    wingShape.lineTo(1.25, -0.5);
    wingShape.lineTo(1.1, -0.2);
    wingShape.lineTo(0, 0.15);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.015, bevelSegments: 1 });
    const wingR = new THREE.Mesh(wingGeo, hullMat);
    wingR.position.set(0.35, -0.1, 0.2);
    g.add(wingR);
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -0.35;
    g.add(wingL);

    // Wing weapon pylons
    for (const side of [1, -1]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.35), darkHullMat);
        pylon.position.set(side * 1.0, -0.12, -0.15);
        g.add(pylon);
        // Missile pod
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), engineNozzleMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(side * 1.0, -0.18, -0.15);
        g.add(pod);
    }

    // Dorsal turret
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 8), engineNozzleMat);
    turretBase.position.set(0, 0.22, 0.6);
    g.add(turretBase);
    const turretBarrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), engineNozzleMat);
    turretBarrel1.rotation.x = -Math.PI / 2;
    turretBarrel1.position.set(0.04, 0.25, 0.35);
    g.add(turretBarrel1);
    const turretBarrel2 = turretBarrel1.clone();
    turretBarrel2.position.x = -0.04;
    g.add(turretBarrel2);

    // Ventral turret
    const vTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 8), engineNozzleMat);
    vTurret.position.set(0, -0.22, 0.2);
    g.add(vTurret);
    const vBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), engineNozzleMat);
    vBarrel.rotation.x = -Math.PI / 2;
    vBarrel.position.set(0, -0.24, 0.0);
    g.add(vBarrel);

    // Engine block — 3 engines in wider rear
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.6), darkHullMat);
    engineBlock.position.set(0, -0.02, 1.5);
    g.add(engineBlock);

    for (const side of [-0.28, 0, 0.28]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.25, 8), engineNozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.02, 1.85);
        g.add(nozzle);
    }

    // Panel lines
    _addPanelLine(g, 0, 0.005, -1.0, 0.005, 0.2, 0.8);
    _addPanelLine(g, 0, 0.005, 0.8, 0.005, 0.2, 0.8);
    for (const side of [0.25, -0.25]) {
        _addPanelLine(g, side, -0.19, 0.5, 0.3, 0.005, 0.8);
    }

    // Antenna array
    _addAntenna(g, -0.2, 0.2, 1.2, 0.15);
    _addAntenna(g, 0.2, 0.2, 1.2, 0.12);

    // Engine glow
    const engineGlow = _makeEngineGlow(accent);
    engineGlow.scale.set(0.9, 0.6, 1);
    engineGlow.position.set(0, -0.02, 2.0);
    g.add(engineGlow);

    // Nav lights
    g.add(Object.assign(_makeNavLight(0x00ff00, 0.1), { position: new THREE.Vector3(1.3, -0.05, -0.2) }));
    g.add(Object.assign(_makeNavLight(0xff0000, 0.1), { position: new THREE.Vector3(-1.3, -0.05, -0.2) }));
    g.add(Object.assign(_makeNavLight(accent, 0.08), { position: new THREE.Vector3(0, 0.53, -0.5) }));
    g.add(Object.assign(_makeNavLight(0xffffff, 0.06), { position: new THREE.Vector3(0, -0.25, 1.5) }));

    // Trail anchor
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, 2.1);
    g.add(trailAnchor);

    return { shipGroup: g, engineGlow, trailAnchor };
}

// ── Hull Class: Cruiser (power 6+) ──────────────────────────────────────────
// Capital warship — massive multi-deck hull, command tower, heavy armament, 5 engines

function _createCruiserHull(accent) {
    const g = new THREE.Group();
    const hullMat = _makeAccentHullMat(accent);
    const accentPanel = _makeAccentPanelMat(accent);

    // Main hull — 3 stacked layers for imposing silhouette
    const hullBottom = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 4.0), darkHullMat);
    hullBottom.position.y = -0.18;
    g.add(hullBottom);
    const hullMid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 3.8), hullMat);
    hullMid.position.y = 0.0;
    g.add(hullMid);
    const hullTop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.15, 3.2), midHullMat);
    hullTop.position.y = 0.15;
    g.add(hullTop);

    // Forward prongs — 2 heavy lance barrels
    for (const side of [-0.35, 0.35]) {
        const prong = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 2.0), darkHullMat);
        prong.position.set(side, -0.05, -2.7);
        g.add(prong);
        const prongTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 6), hullMat);
        prongTip.rotation.x = -Math.PI / 2;
        prongTip.position.set(side, -0.05, -3.8);
        g.add(prongTip);
        // Lance emitter glow
        const lanceGlow = _makeNavLight(accent, 0.12);
        lanceGlow.position.set(side, -0.05, -4.05);
        g.add(lanceGlow);
        // Prong accent stripe
        const pStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 1.4), accentPanel);
        pStripe.position.set(side, 0.03, -2.7);
        g.add(pStripe);
    }

    // Forward command section
    const fwdCmd = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 1.0), hullMat);
    fwdCmd.position.set(0, 0.0, -1.6);
    g.add(fwdCmd);

    // Command bridge tower — imposing multi-tier
    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 1.0), darkHullMat);
    towerBase.position.set(0, 0.28, -0.5);
    g.add(towerBase);
    const towerMid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.8), hullMat);
    towerMid.position.set(0, 0.42, -0.5);
    g.add(towerMid);
    const towerTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.6), midHullMat);
    towerTop.position.set(0, 0.56, -0.5);
    g.add(towerTop);
    const bridgeWindows = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.55), canopyMat);
    bridgeWindows.position.set(0, 0.64, -0.5);
    g.add(bridgeWindows);

    // Bridge antenna array
    _addAntenna(g, 0, 0.67, -0.5, 0.35);
    _addAntenna(g, 0.15, 0.67, -0.3, 0.2);
    _addAntenna(g, -0.15, 0.67, -0.3, 0.2);

    // Radar dish
    const dish = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), antennaMat);
    dish.position.set(0.25, 0.6, -0.2);
    dish.rotation.y = Math.PI / 2;
    g.add(dish);

    // Accent stripes (port/starboard — full length)
    for (const side of [1, -1]) {
        const longStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 3.4), accentPanel);
        longStripe.position.set(side * 0.56, 0.05, 0.0);
        g.add(longStripe);
    }

    // Lateral weapon platforms
    for (const side of [-1, 1]) {
        // Platform wing
        const platform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 1.6), darkHullMat);
        platform.position.set(side * 1.0, -0.1, 0.2);
        g.add(platform);
        // Platform upper armour
        const armour = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.3), hullMat);
        armour.position.set(side * 1.0, -0.02, 0.2);
        g.add(armour);

        // Heavy turrets (2 per side)
        for (const zOff of [-0.35, 0.35]) {
            const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 8), engineNozzleMat);
            tBase.position.set(side * 1.05, 0.05, zOff);
            g.add(tBase);
            for (const bOff of [-0.03, 0.03]) {
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), engineNozzleMat);
                barrel.rotation.x = -Math.PI / 2;
                barrel.position.set(side * 1.05 + bOff, 0.09, zOff - 0.3);
                g.add(barrel);
            }
        }

        // Point-defense turrets
        const pdTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 6), engineNozzleMat);
        pdTurret.position.set(side * 0.8, 0.18, 0.8);
        g.add(pdTurret);
        const pdBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4), engineNozzleMat);
        pdBarrel.rotation.x = -Math.PI / 2;
        pdBarrel.position.set(side * 0.8, 0.2, 0.65);
        g.add(pdBarrel);
    }

    // Dorsal spine / keel
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.5), darkHullMat);
    spine.position.set(0, 0.22, 0.5);
    g.add(spine);

    // Ventral hangar bay
    const hangarDoor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.8), engineNozzleMat);
    hangarDoor.position.set(0, -0.28, 0.0);
    g.add(hangarDoor);
    const hangarGlow = _makeNavLight(accent, 0.2);
    hangarGlow.position.set(0, -0.3, 0.0);
    g.add(hangarGlow);

    // Engine block — massive rear section
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.8), darkHullMat);
    engineBlock.position.set(0, -0.05, 1.8);
    g.add(engineBlock);
    const engineCowl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.4), hullMat);
    engineCowl.position.set(0, -0.05, 1.5);
    g.add(engineCowl);

    // 5 engine nozzles
    for (const side of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.3, 8), engineNozzleMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side, -0.05, 2.25);
        g.add(nozzle);
    }

    // Panel lines — complex hull detail
    _addPanelLine(g, 0, 0.005, -0.8, 0.005, 0.25, 1.0);
    _addPanelLine(g, 0, 0.005, 1.0, 0.005, 0.25, 0.8);
    for (const x of [-0.4, 0.4]) {
        _addPanelLine(g, x, -0.27, 0.5, 0.4, 0.005, 1.2);
    }
    _addPanelLine(g, 0, 0.22, 0.5, 0.7, 0.005, 1.0);

    // Antenna array at stern
    _addAntenna(g, -0.3, 0.2, 1.8, 0.18);
    _addAntenna(g, 0.3, 0.2, 1.8, 0.18);

    // Engine glow (large combined)
    const engineGlow = _makeEngineGlow(accent);
    engineGlow.scale.set(1.6, 0.9, 1);
    engineGlow.position.set(0, -0.05, 2.55);
    g.add(engineGlow);

    // Core engine glow (white-hot center)
    const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft, color: 0xffffff,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45,
    }));
    coreGlow.scale.set(0.8, 0.6, 1);
    coreGlow.position.set(0, -0.05, 2.4);
    g.add(coreGlow);

    // Nav lights (6 positions)
    g.add(Object.assign(_makeNavLight(0x00ff00, 0.12), { position: new THREE.Vector3(1.4, -0.05, 0.0) }));
    g.add(Object.assign(_makeNavLight(0xff0000, 0.12), { position: new THREE.Vector3(-1.4, -0.05, 0.0) }));
    g.add(Object.assign(_makeNavLight(accent, 0.1), { position: new THREE.Vector3(0.2, 0.68, -0.5) }));
    g.add(Object.assign(_makeNavLight(accent, 0.1), { position: new THREE.Vector3(-0.2, 0.68, -0.5) }));
    g.add(Object.assign(_makeNavLight(0xffffff, 0.08), { position: new THREE.Vector3(0, -0.3, 2.0) }));
    g.add(Object.assign(_makeNavLight(0xffffff, 0.06), { position: new THREE.Vector3(0, 0.22, -1.4) }));

    // Trail anchor
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, 2.7);
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
 * Ships are scaled small relative to planets so the system feels vast.
 */
export function spawnPlayerShip(fleetData, group, planetMesh) {
    const accent = fleetData.accentColor || '#00f2ff';
    const { shipGroup, engineGlow, trailAnchor } = createPlayerShipMesh(fleetData.shipId, accent);

    // Scale: ships are tiny compared to planets (planet radius ~2-3 units)
    const hullClass = _getHullClass(fleetData.shipId);
    const scale = { scout: 0.12, corvette: 0.18, cruiser: 0.25 }[hullClass] || 0.12;
    shipGroup.scale.setScalar(scale);

    // Orbit parameters — wider to give sense of space
    const planetRadius = planetMesh?.geometry?.parameters?.radius || 2;
    const orbitRadius = planetRadius * 1.8 + 1.5 + Math.random() * 2.0;
    const startAngle = Math.random() * Math.PI * 2;
    const orbitSpeed = 0.15 + Math.random() * 0.12;
    const orbitInclination = (Math.random() - 0.5) * 0.35;

    const center = planetMesh ? planetMesh.position : new THREE.Vector3(0, 0, 0);
    shipGroup.position.set(
        center.x + Math.cos(startAngle) * orbitRadius,
        center.y + Math.sin(startAngle * 0.5) * orbitInclination * orbitRadius,
        center.z + Math.sin(startAngle) * orbitRadius
    );

    // Invisible bounding box for easier click picking on tiny ships
    const bb = new THREE.Mesh(
        new THREE.BoxGeometry(2.5 / scale, 1.5 / scale, 4.0 / scale),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    shipGroup.add(bb);

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

export function buildPlayerShips(group, planetMeshesArr) {
    const currentSystemId = gameState.selectedSystemId;
    if (currentSystemId == null || !gameState.fleets) return;

    const fleetsHere = gameState.fleets.filter(f => f.systemId === currentSystemId && !f.moving);

    fleetsHere.forEach(fleet => {
        const planetMesh = planetMeshesArr?.find(m => m.userData.id === fleet.planetId) || null;
        spawnPlayerShip(fleet, group, planetMesh);
    });
}

// ── Idle orbit animation ────────────────────────────────────────────────────

const _tmpLookAt = new THREE.Vector3();
const _trailWP = new THREE.Vector3();

export function updatePlayerShipOrbits(time, dt) {
    _playerShipMeshes.forEach(entry => {
        // Controlled ship — only emit engine trails, skip orbit motion
        if (entry === _controlledEntry) {
            _emitShipTrail(entry, dt);
            return;
        }

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

        // Face orbital direction
        _tmpLookAt.set(
            center.x + Math.cos(a + 0.1) * r,
            center.y + Math.sin((a + 0.1) * 0.5) * incl * r,
            center.z + Math.sin(a + 0.1) * r
        );
        entry.mesh.lookAt(_tmpLookAt);

        // Engine glow pulse
        if (entry.engineGlow) {
            entry.engineGlow.material.opacity = 0.4 + 0.2 * Math.sin(time * 4 + entry.orbitAngle);
        }

        // Emit engine trail particles
        _emitShipTrail(entry, dt);

        entry._prevPos.copy(entry.mesh.position);
    });
}

/**
 * Emit trail particles from a ship's trail anchor.
 * Uses velocity from position delta — same pattern as trade ships.
 */
function _emitShipTrail(entry, dt) {
    if (!entry.trailAnchor) return;

    entry.trailAnchor.getWorldPosition(_trailWP);

    const dx = _trailWP.x - entry._prevPos.x;
    const dy = _trailWP.y - entry._prevPos.y;
    const dz = _trailWP.z - entry._prevPos.z;

    const hasMoved = entry._prevPos.lengthSq() > 0.001;

    // For controlled ship, always update prevPos from trail anchor
    if (entry === _controlledEntry) {
        entry._prevPos.copy(_trailWP);
    }

    if (hasMoved && Math.random() < 0.7) {
        _spawnSatTrail(
            _trailWP.x, _trailWP.y, _trailWP.z,
            -dx * 2.0, -dy * 2.0, -dz * 2.0
        );
    }
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
