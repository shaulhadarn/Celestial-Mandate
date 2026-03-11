/* Updated: Upgraded colony building visuals with detailed multi-part structures */
import * as THREE from 'three';
import { gameState, BUILDINGS } from '../core/state.js';
import { textures } from '../core/assets.js';
import { createShadowSprite } from './visuals_planet_drone.js';

export let harvesterGroups = [];
export let soldierMeshes = [];
export let hubGroup = null;

// Procedural smoke/steam sprite texture (cached)
let _smokeTextureCache = null;
function _getSmokeTexture() {
    if (_smokeTextureCache) return _smokeTextureCache;
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    _smokeTextureCache = new THREE.CanvasTexture(canvas);
    return _smokeTextureCache;
}

// ── Shared materials (created once, reused across buildings) ─────────────────
const _matCache = {};
function _mat(key, props) {
    if (!_matCache[key]) _matCache[key] = new THREE.MeshStandardMaterial(props);
    return _matCache[key];
}

function _basePlatformMat() { return _mat('basePlat', { color: 0x2a2a2a, roughness: 0.5, metalness: 0.7 }); }
function _concreteMat() { return _mat('concrete', { color: 0x3a3a3a, roughness: 0.8, metalness: 0.2 }); }
function _frameMat() { return _mat('frame', { color: 0x1a1a1a, roughness: 0.3, metalness: 0.9 }); }
function _pipeMat() { return _mat('pipe', { color: 0x444444, roughness: 0.4, metalness: 0.8 }); }

// ── Connection tube from hub to building ────────────────────────────────────

function _buildConnectionTube(group, angle, heightFn, borderColor) {
    const tubeMat = _mat('tube', { color: 0x2a2a2a, roughness: 0.5, metalness: 0.7 });
    const railMat = _mat('tubeRail', { color: 0x1a1a1a, roughness: 0.3, metalness: 0.9 });
    const glowMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.6, roughness: 0.2, metalness: 0.5
    });

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const startR = 10;  // hub entrance tunnel end
    const endR = 18;    // building platform edge
    const SEGS = 6;
    const tubeW = 2.0;
    const tubeH = 0.4;
    const railH = 0.6;
    const elevate = 0.6; // walkway above terrain

    // Sample terrain points along the radial path
    const pts = [];
    for (let i = 0; i <= SEGS; i++) {
        const t = i / SEGS;
        const r = startR + (endR - startR) * t;
        const x = cosA * r;
        const z = sinA * r;
        const y = heightFn(x, z) + elevate;
        pts.push({ x, y, z });
    }

    for (let i = 0; i < SEGS; i++) {
        const a = pts[i], b = pts[i + 1];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const mz = (a.z + b.z) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Walkway slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(tubeW, tubeH, len + 0.3), tubeMat);
        slab.position.set(mx, my, mz);
        slab.lookAt(b.x, b.y, b.z);
        slab.receiveShadow = true;
        group.add(slab);

        // Side rails
        [-1, 1].forEach(side => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, railH, len + 0.3), railMat);
            rail.position.set(mx, my + (tubeH + railH) / 2, mz);
            rail.lookAt(b.x, b.y + (tubeH + railH) / 2, b.z);
            // Offset sideways in local space
            const perpX = -sinA * side * (tubeW / 2 - 0.06);
            const perpZ = cosA * side * (tubeW / 2 - 0.06);
            rail.position.x += perpX;
            rail.position.z += perpZ;
            group.add(rail);
        });

        // Glow strip down the center
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, len + 0.2), glowMat);
        strip.position.set(mx, my + tubeH / 2 + 0.04, mz);
        strip.lookAt(b.x, b.y + tubeH / 2 + 0.04, b.z);
        group.add(strip);

        // Support pillars every other segment
        if (i % 2 === 0) {
            const pillarH = Math.max(0.5, my - heightFn(mx, mz) + elevate);
            const pillar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.2, pillarH, 4),
                railMat
            );
            pillar.position.set(mx, my - pillarH / 2, mz);
            group.add(pillar);
        }
    }
}

// ── Building-specific mesh builders ─────────────────────────────────────────

function _buildBasePlatform(g) {
    // Multi-layer platform: foundation slab + edge trim + floor surface
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 8), _basePlatformMat());
    slab.position.y = 0;
    slab.receiveShadow = true;
    g.add(slab);

    // Raised inner deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 6.5), _concreteMat());
    deck.position.y = 0.45;
    g.add(deck);

    // Corner bollards
    const bollardGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.2, 6);
    [[-3.5, 0, -3.5], [-3.5, 0, 3.5], [3.5, 0, -3.5], [3.5, 0, 3.5]].forEach(([bx, , bz]) => {
        const b = new THREE.Mesh(bollardGeo, _frameMat());
        b.position.set(bx, 0.9, bz);
        g.add(b);
    });
}

function _buildHub(g) {
    // ── Main dome ──
    const domeGeo = new THREE.SphereGeometry(7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
        color: 0x556677, roughness: 0.25, metalness: 0.8,
        emissive: 0x112233, emissiveIntensity: 0.1
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0;
    dome.castShadow = true;
    g.add(dome);

    // ── Base ring ──
    const ringGeo = new THREE.TorusGeometry(7.2, 0.5, 8, 24);
    const ring = new THREE.Mesh(ringGeo, _frameMat());
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    g.add(ring);

    // ── Foundation cylinder ──
    const foundGeo = new THREE.CylinderGeometry(8, 9.5, 3, 12);
    const found = new THREE.Mesh(foundGeo, _concreteMat());
    found.position.y = -1.5;
    found.receiveShadow = true;
    g.add(found);

    // ── Central antenna spire ──
    const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.4, 6, 6),
        _frameMat()
    );
    spire.position.y = 9;
    g.add(spire);

    // Rotating radar dish on top of spire
    const dishPivot = new THREE.Group();
    dishPivot.position.y = 12.5;
    dishPivot.userData.radarDish = true;

    const dishGeo = new THREE.SphereGeometry(1.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const dish = new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({
        color: 0xaabbcc, roughness: 0.2, metalness: 0.9
    }));
    dish.rotation.x = Math.PI;
    dishPivot.add(dish);

    // Small feed horn in front of dish
    const feedHorn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.0, 4),
        _frameMat()
    );
    feedHorn.position.set(0, 0.2, 0.7);
    feedHorn.rotation.x = Math.PI / 2;
    dishPivot.add(feedHorn);

    g.add(dishPivot);

    // ── Entrance tunnels (4 radial) ──
    const tunnelGeo = new THREE.BoxGeometry(3, 2.5, 8);
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const tunnel = new THREE.Mesh(tunnelGeo, _concreteMat());
        tunnel.position.set(Math.cos(angle) * 10, 0.5, Math.sin(angle) * 10);
        tunnel.rotation.y = -angle;
        tunnel.castShadow = true;
        g.add(tunnel);
    }

    // ── Window light strips around dome ──
    const stripMat = new THREE.MeshStandardMaterial({
        color: 0x00f2ff, emissive: 0x00f2ff, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.7
    });
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 2.5), stripMat);
        strip.position.set(Math.cos(angle) * 6.8, 2.5, Math.sin(angle) * 6.8);
        strip.rotation.y = -angle;
        g.add(strip);
    }

    // ── Main light ──
    const hubLight = new THREE.PointLight(0x00f2ff, 10, 40);
    hubLight.position.set(0, 8, 0);
    g.add(hubLight);
}

function _buildPowerPlant(g, borderColor) {
    _buildBasePlatform(g);

    const accentMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.25,
        roughness: 0.3, metalness: 0.7
    });

    // ── Main reactor dome ──
    const reactorGeo = new THREE.SphereGeometry(2.5, 12, 10);
    const reactor = new THREE.Mesh(reactorGeo, new THREE.MeshStandardMaterial({
        color: 0x555555, roughness: 0.2, metalness: 0.9
    }));
    reactor.position.y = 4;
    reactor.castShadow = true;
    g.add(reactor);

    // Reactor core glow ring
    const coreRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.7, 0.25, 8, 16), accentMat
    );
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.y = 4;
    g.add(coreRing);

    // ── Twin cooling towers ──
    const towerGeo = new THREE.CylinderGeometry(1.2, 1.6, 7, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.6 });
    [[-2.5, 0, -1.5], [2.5, 0, -1.5]].forEach(([tx, , tz]) => {
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(tx, 4.5, tz);
        tower.castShadow = true;
        g.add(tower);

        // Tower rim
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.15, 6, 12), _frameMat());
        rim.rotation.x = Math.PI / 2;
        rim.position.set(tx, 8, tz);
        g.add(rim);
    });

    // ── Power conduits (pipes connecting towers to reactor) ──
    const conduitGeo = new THREE.CylinderGeometry(0.2, 0.2, 3.5, 6);
    [[-1.3, 3, -0.8], [1.3, 3, -0.8]].forEach(([cx, cy, cz]) => {
        const conduit = new THREE.Mesh(conduitGeo, _pipeMat());
        conduit.position.set(cx, cy, cz);
        conduit.rotation.z = Math.PI / 4 * (cx > 0 ? -1 : 1);
        g.add(conduit);
    });

    // ── Energy pylons ──
    const pylonGeo = new THREE.BoxGeometry(0.4, 5, 0.4);
    [[-3, 0, 2.5], [3, 0, 2.5]].forEach(([px, , pz]) => {
        const pylon = new THREE.Mesh(pylonGeo, _frameMat());
        pylon.position.set(px, 3.5, pz);
        g.add(pylon);
        // Pylon tip glow
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), accentMat);
        tip.position.set(px, 6.2, pz);
        g.add(tip);
    });

    // ── Energy arc between pylons (glowing wire) ──
    const arcMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.6
    });
    const arcGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.2, 4);
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.position.set(0, 6.2, 2.5);
    arc.rotation.z = Math.PI / 2;
    g.add(arc);

    // ── Top light ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 6, 25);
    light.position.y = 8;
    g.add(light);
}

function _buildMiningNetwork(g, borderColor) {
    _buildBasePlatform(g);

    const accentMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.3,
        roughness: 0.4, metalness: 0.7
    });

    // ── Central ore processor — large industrial box ──
    const processorMat = new THREE.MeshStandardMaterial({
        color: 0x4a3a2a, roughness: 0.6, metalness: 0.5
    });
    const processor = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 3.5), processorMat);
    processor.position.y = 3.5;
    processor.castShadow = true;
    g.add(processor);

    // Processor accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.4, 3.6), accentMat);
    stripe.position.y = 4.5;
    g.add(stripe);

    // ── Conveyor belt frame ──
    const conveyorGeo = new THREE.BoxGeometry(1.0, 0.3, 8);
    const conveyor = new THREE.Mesh(conveyorGeo, _frameMat());
    conveyor.position.set(0, 1.2, -2);
    conveyor.rotation.y = 0;
    g.add(conveyor);

    // Conveyor supports
    const supportGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
    for (let si = 0; si < 4; si++) {
        const s = new THREE.Mesh(supportGeo, _frameMat());
        s.position.set(0, 0.6, -4.5 + si * 2.2);
        g.add(s);
    }

    // ── Ore crusher cone ──
    const crusherGeo = new THREE.ConeGeometry(1.5, 3, 6);
    const crusher = new THREE.Mesh(crusherGeo, new THREE.MeshStandardMaterial({
        color: 0x555544, roughness: 0.5, metalness: 0.7
    }));
    crusher.position.set(0, 7.5, 0);
    crusher.rotation.x = Math.PI;
    g.add(crusher);

    // ── Sorting silos ──
    const siloGeo = new THREE.CylinderGeometry(0.8, 0.8, 4, 8);
    [[-2.5, 0, 2], [2.5, 0, 2]].forEach(([sx, , sz]) => {
        const silo = new THREE.Mesh(siloGeo, _pipeMat());
        silo.position.set(sx, 3, sz);
        silo.castShadow = true;
        g.add(silo);
        // Silo cap
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 8), _frameMat());
        cap.position.set(sx, 5.5, sz);
        g.add(cap);
    });

    // ── Crane arm ──
    const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 8, 6), _frameMat());
    craneBase.position.set(-2, 5, -1.5);
    g.add(craneBase);
    const craneArm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 0.3), _frameMat());
    craneArm.position.set(0.5, 9.2, -1.5);
    g.add(craneArm);

    // ── Accent light ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 5, 20);
    light.position.y = 7;
    g.add(light);
}

function _buildHydroponics(g, borderColor) {
    _buildBasePlatform(g);

    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88ffaa, roughness: 0.1, metalness: 0.2,
        transparent: true, opacity: 0.35,
        emissive: borderColor, emissiveIntensity: 0.15
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.4,
        roughness: 0.3, metalness: 0.5
    });

    // ── Main biodome ──
    const domeGeo = new THREE.SphereGeometry(3.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.position.y = 1;
    dome.castShadow = true;
    g.add(dome);

    // Dome frame ribs
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });
    for (let r = 0; r < 6; r++) {
        const angle = (r / 6) * Math.PI;
        const rib = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.08, 4, 24, Math.PI), ribMat);
        rib.rotation.y = angle;
        rib.position.y = 1;
        g.add(rib);
    }

    // Dome base ring
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.2, 6, 20), _frameMat());
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 1;
    g.add(baseRing);

    // ── Side greenhouse tunnels ──
    const tunnelGeo = new THREE.CylinderGeometry(1.2, 1.2, 5, 8, 1, false, 0, Math.PI);
    [[-2.5, 0, 0], [2.5, 0, 0]].forEach(([tx, , tz], i) => {
        const tunnel = new THREE.Mesh(tunnelGeo, glassMat);
        tunnel.rotation.z = Math.PI / 2;
        tunnel.rotation.y = i === 0 ? 0 : Math.PI;
        tunnel.position.set(tx > 0 ? 5 : -5, 1.8, tz);
        g.add(tunnel);
    });

    // ── Internal vegetation hint (green blob inside dome) ──
    const vegGeo = new THREE.SphereGeometry(2.2, 8, 6);
    const vegMat = new THREE.MeshStandardMaterial({
        color: 0x226633, emissive: 0x114422, emissiveIntensity: 0.3,
        roughness: 0.9, metalness: 0.0
    });
    const veg = new THREE.Mesh(vegGeo, vegMat);
    veg.position.y = 1.8;
    veg.scale.y = 0.6;
    g.add(veg);

    // ── Water tanks ──
    const tankGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 8);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.3, metalness: 0.6 });
    [[3.5, 0, -2.5], [-3.5, 0, -2.5]].forEach(([wx, , wz]) => {
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(wx, 2, wz);
        g.add(tank);
    });

    // ── Growth light strips inside ──
    for (let i = 0; i < 3; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 4), accentMat);
        strip.position.set(-1.5 + i * 1.5, 3.5, 0);
        g.add(strip);
    }

    // ── Interior glow ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 4, 18);
    light.position.y = 3;
    g.add(light);
}

function _buildResearchLab(g, borderColor) {
    _buildBasePlatform(g);

    const accentMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.4,
        roughness: 0.2, metalness: 0.6
    });

    // ── Main lab building — clean angular design ──
    const labMat = new THREE.MeshStandardMaterial({
        color: 0x556688, roughness: 0.2, metalness: 0.8
    });
    const labBody = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4), labMat);
    labBody.position.y = 3;
    labBody.castShadow = true;
    g.add(labBody);

    // Window band
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x88ccff, emissive: 0x4488ff, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.6
    });
    const windowBand = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.8, 4.1), windowMat);
    windowBand.position.y = 3.8;
    g.add(windowBand);

    // ── Satellite dish on roof ──
    const dishGeo = new THREE.SphereGeometry(1.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.15, metalness: 0.9 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI;
    dish.rotation.z = 0.3;
    dish.position.set(1.5, 6, 0);
    g.add(dish);

    // Dish pedestal
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), _frameMat());
    pedestal.position.set(1.5, 5.5, 0);
    g.add(pedestal);

    // ── Antenna tower ──
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 5, 4), _frameMat());
    antenna.position.set(-1.5, 7.5, 0);
    g.add(antenna);

    // Antenna cross-bars
    for (let ci = 0; ci < 3; ci++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), _frameMat());
        bar.position.set(-1.5, 6 + ci * 1.2, 0);
        g.add(bar);
    }

    // Antenna tip blink
    const tipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), accentMat);
    tipGlow.position.set(-1.5, 10.2, 0);
    g.add(tipGlow);

    // ── Holographic projector base ──
    const projBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.5, 8), accentMat);
    projBase.position.set(0, 5.3, 0);
    g.add(projBase);

    // Hologram glow beam
    const beamMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.2
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.6, 2.5, 6), beamMat);
    beam.position.set(0, 6.8, 0);
    g.add(beam);

    // ── Side instrument pods ──
    const podGeo = new THREE.BoxGeometry(1.5, 2.5, 1.5);
    [[-3.5, 0, 0], [3.5, 0, 0]].forEach(([px, , pz]) => {
        const pod = new THREE.Mesh(podGeo, labMat);
        pod.position.set(px, 2, pz);
        pod.castShadow = true;
        g.add(pod);
    });

    // ── Lights ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 5, 22);
    light.position.y = 7;
    g.add(light);
}

function _buildShipyard(g, borderColor) {
    _buildBasePlatform(g);

    const accentMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.35,
        roughness: 0.3, metalness: 0.6
    });

    // ── Main hangar building ──
    const hangarMat = new THREE.MeshStandardMaterial({
        color: 0x444455, roughness: 0.4, metalness: 0.7
    });
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), hangarMat);
    hangar.position.y = 3;
    hangar.castShadow = true;
    g.add(hangar);

    // Hangar door opening (dark inset)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.9, metalness: 0.1 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 0.2), doorMat);
    door.position.set(0, 2.5, 2.6);
    g.add(door);

    // Door frame accent
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.3, 0.1), accentMat);
    doorFrame.position.set(0, 2.5, 2.65);
    g.add(doorFrame);

    // ── Gantry cranes (2 tall towers + crossbeam) ──
    const gantryGeo = new THREE.BoxGeometry(0.4, 12, 0.4);
    const gantryMat = _frameMat();
    const gL = new THREE.Mesh(gantryGeo, gantryMat);
    gL.position.set(-3.5, 7, 0);
    g.add(gL);
    const gR = new THREE.Mesh(gantryGeo, gantryMat);
    gR.position.set(3.5, 7, 0);
    g.add(gR);

    // Crossbeam
    const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.5, 0.5), gantryMat);
    crossbeam.position.set(0, 13.2, 0);
    g.add(crossbeam);

    // Crane trolley
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), accentMat);
    trolley.position.set(0.5, 12.9, 0);
    g.add(trolley);

    // Crane cable
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5, 4), _pipeMat());
    cable.position.set(0.5, 10.2, 0);
    g.add(cable);

    // ── Launch pad markings (accent circle on ground) ──
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.15, 6, 20), accentMat);
    padRing.rotation.x = Math.PI / 2;
    padRing.position.set(0, 0.65, 0);
    g.add(padRing);

    // ── Fuel tanks ──
    const fuelGeo = new THREE.CylinderGeometry(0.6, 0.6, 3, 8);
    const fuelMat = new THREE.MeshStandardMaterial({ color: 0x993366, roughness: 0.4, metalness: 0.5 });
    [[-3.5, 0, 3], [3.5, 0, 3]].forEach(([fx, , fz]) => {
        const tank = new THREE.Mesh(fuelGeo, fuelMat);
        tank.position.set(fx, 2.5, fz);
        g.add(tank);
    });

    // ── Comms array on roof ──
    const commsBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 6), _frameMat());
    commsBase.position.set(2, 6.5, -1.5);
    g.add(commsBase);
    const commsAntenna = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 0.06), _frameMat());
    commsAntenna.position.set(2, 8.2, -1.5);
    g.add(commsAntenna);

    // ── Shipyard light ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 6, 25);
    light.position.y = 10;
    g.add(light);
}

// ── Default building (fallback) ─────────────────────────────────────────────

function _buildDefault(g, borderColor) {
    _buildBasePlatform(g);

    const tower = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 10, 3.5),
        new THREE.MeshStandardMaterial({
            color: borderColor || 0x00f2ff,
            emissive: borderColor || 0x00f2ff,
            emissiveIntensity: 0.2,
            roughness: 0.3, metalness: 0.7
        })
    );
    tower.position.y = 6;
    tower.castShadow = true;
    g.add(tower);

    const light = new THREE.PointLight(new THREE.Color(borderColor || 0x00f2ff), 4, 18);
    light.position.y = 10;
    g.add(light);
}

// ── Patrol soldiers ─────────────────────────────────────────────────────────

function _buildSoldierMesh() {
    const g = new THREE.Group();
    const skinMat = _mat('soldierSkin', { color: 0x445566, roughness: 0.6, metalness: 0.4 });
    const armorMat = _mat('soldierArmor', { color: 0x2a3a2a, roughness: 0.5, metalness: 0.6 });
    const visorMat = new THREE.MeshStandardMaterial({
        color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 0.6,
        roughness: 0.1, metalness: 0.8
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), armorMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    g.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skinMat);
    head.position.y = 1.85;
    g.add(head);

    // Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.15), visorMat);
    visor.position.set(0, 1.85, 0.15);
    g.add(visor);

    // Left leg
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const legL = new THREE.Mesh(legGeo, skinMat);
    legL.position.set(-0.15, 0.45, 0);
    legL.userData.isLeg = true;
    legL.userData.side = -1;
    g.add(legL);

    // Right leg
    const legR = new THREE.Mesh(legGeo, skinMat);
    legR.position.set(0.15, 0.45, 0);
    legR.userData.isLeg = true;
    legR.userData.side = 1;
    g.add(legR);

    // Left arm
    const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armL = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.42, 1.15, 0);
    armL.userData.isArm = true;
    armL.userData.side = -1;
    g.add(armL);

    // Right arm (holds weapon)
    const armR = new THREE.Mesh(armGeo, skinMat);
    armR.position.set(0.42, 1.15, 0);
    armR.userData.isArm = true;
    armR.userData.side = 1;
    g.add(armR);

    // Weapon (simple rifle shape on right side)
    const rifle = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.7),
        _mat('rifle', { color: 0x333333, roughness: 0.3, metalness: 0.9 })
    );
    rifle.position.set(0.42, 1.0, 0.25);
    g.add(rifle);

    // Backpack
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2), armorMat);
    backpack.position.set(0, 1.25, -0.27);
    g.add(backpack);

    g.scale.setScalar(1.1);
    return g;
}

// ── Main render function ────────────────────────────────────────────────────

/**
 * Renders the 3D structures of a colony on the planetary surface.
 */
export function renderColonyGroundBuildings(planetId, group, heightFn) {
    while(group.children.length > 0) group.remove(group.children[0]);
    harvesterGroups = [];
    soldierMeshes = [];
    hubGroup = null;
    const colony = gameState.colonies[planetId];
    if (!colony) return;

    // ── Hub (central command structure) ──
    const _hub = new THREE.Group();
    const hubY = heightFn(0, 0);
    _hub.position.set(0, hubY, 0);
    _hub.userData.isHub = true;
    _buildHub(_hub);
    group.add(_hub);
    hubGroup = _hub;

    // ── Buildings arranged around hub ──
    colony.buildings.forEach((bKey, i) => {
        const buildingData = BUILDINGS[bKey];
        const angle = (i / 5) * Math.PI * 2;
        const dist = 22;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const y = heightFn(x, z);

        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        bGroup.rotation.y = -angle;

        const bc = buildingData.borderColor || '#00f2ff';
        if (bKey === 'power_plant') _buildPowerPlant(bGroup, bc);
        else if (bKey === 'mining_network') _buildMiningNetwork(bGroup, bc);
        else if (bKey === 'hydroponics') _buildHydroponics(bGroup, bc);
        else if (bKey === 'research_lab') _buildResearchLab(bGroup, bc);
        else if (bKey === 'shipyard') _buildShipyard(bGroup, bc);
        else _buildDefault(bGroup, bc);

        group.add(bGroup);

        // Connection tube from hub to this building
        _buildConnectionTube(group, angle, heightFn, bc);
    });

    // ── Harvesters ──
    const harvesters = colony.harvesters || [];
    harvesters.forEach((h) => {
        const hx = h.position.x;
        const hz = h.position.z;
        const hy = heightFn(hx, hz);

        const hGroup = new THREE.Group();
        hGroup.position.set(hx, hy, hz);
        hGroup.userData = { isHarvester: true, harvesterId: h.id };

        // Base platform
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x554422, roughness: 0.6, metalness: 0.4 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 2, 8), baseMat);
        base.position.y = 1;
        base.castShadow = true;
        base.receiveShadow = true;
        hGroup.add(base);

        // Main drilling column
        const columnMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.15,
            roughness: 0.4,
            metalness: 0.7
        });
        const column = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 14, 8), columnMat);
        column.position.y = 9;
        column.castShadow = true;
        hGroup.add(column);

        // Rotating top arm
        const armMat = new THREE.MeshStandardMaterial({ color: 0xddaa33, metalness: 0.8, roughness: 0.3 });
        const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.5), armMat);
        arm.position.y = 17;
        arm.userData.rotatingArm = true;
        hGroup.add(arm);

        // Drill bit (cone pointing down into ground)
        const drillMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
        const drill = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 6), drillMat);
        drill.position.y = -1;
        drill.rotation.x = Math.PI; // point downward
        hGroup.add(drill);

        // Amber beacon light
        const beacon = new THREE.PointLight(0xffaa00, 8, 40);
        beacon.position.y = 18;
        beacon.userData.beacon = true;
        hGroup.add(beacon);

        // Steam vent particles around drill rig base
        const steamParticles = [];
        const steamTex = _getSmokeTexture();
        for (let si = 0; si < 12; si++) {
            const sMat = new THREE.SpriteMaterial({
                map: steamTex,
                color: 0xcccccc,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.NormalBlending
            });
            const sp = new THREE.Sprite(sMat);
            sp.scale.set(1, 1, 1);
            sp.visible = false;
            hGroup.add(sp);
            steamParticles.push({
                sprite: sp,
                life: 0,
                maxLife: 1.2 + Math.random() * 0.8,
                velocity: new THREE.Vector3(),
                baseAngle: (si / 12) * Math.PI * 2
            });
        }
        hGroup.userData.steamParticles = steamParticles;
        hGroup.userData.steamTimer = Math.random() * 2; // stagger start

        // Small harvester rover that orbits around the drill rig
        const rover = new THREE.Group();
        rover.userData.harvesterRover = true;
        rover.userData.orbitRadius = 10 + Math.random() * 4;
        rover.userData.orbitSpeed = 0.3 + Math.random() * 0.2;
        rover.userData.orbitPhase = Math.random() * Math.PI * 2;
        rover.userData.heightFn = heightFn;
        rover.userData.baseX = hx;
        rover.userData.baseZ = hz;

        // Rover body
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc8822, roughness: 0.5, metalness: 0.6 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 1.6), bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        rover.add(body);

        // Cab / top section
        const cabMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.7 });
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.4), cabMat);
        cab.position.set(-0.4, 1.7, 0);
        rover.add(cab);

        // Scoop arm at front
        const scoopMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 });
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.2), scoopMat);
        scoop.position.set(1.6, 0.5, 0);
        scoop.userData.scoopArm = true;
        rover.add(scoop);

        // Wheels (4 small cylinders)
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
        [[-0.8, 0.4, 0.9], [-0.8, 0.4, -0.9], [0.8, 0.4, 0.9], [0.8, 0.4, -0.9]].forEach(([wx, wy, wz]) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(wx, wy, wz);
            wheel.rotation.x = Math.PI / 2;
            wheel.userData.wheel = true;
            rover.add(wheel);
        });

        // Small amber headlight
        const headlight = new THREE.PointLight(0xffaa00, 2, 8);
        headlight.position.set(1.5, 1.2, 0);
        rover.add(headlight);

        // Rover exhaust smoke particles (pooled sprites behind rover)
        const exhaustParticles = [];
        const smokeTex = _getSmokeTexture();
        for (let pi = 0; pi < 8; pi++) {
            const spMat = new THREE.SpriteMaterial({
                map: smokeTex,
                color: 0x886644,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const sp = new THREE.Sprite(spMat);
            sp.scale.set(0.5, 0.5, 0.5);
            sp.position.set(-1.4, 0.8, 0);
            sp.visible = false;
            rover.add(sp);
            exhaustParticles.push({
                sprite: sp,
                life: 0,
                maxLife: 0.6 + Math.random() * 0.4,
                velocity: new THREE.Vector3()
            });
        }
        rover.userData.exhaustParticles = exhaustParticles;
        rover.userData.exhaustTimer = 0;

        // Place rover at initial orbit position
        const initAngle = rover.userData.orbitPhase;
        const initR = rover.userData.orbitRadius;
        const rx = hx + Math.cos(initAngle) * initR;
        const rz = hz + Math.sin(initAngle) * initR;
        const ry = heightFn(rx, rz);
        rover.position.set(rx, ry, rz);
        rover.rotation.y = -initAngle + Math.PI / 2;

        group.add(rover);
        hGroup.userData.rover = rover;

        group.add(hGroup);
        harvesterGroups.push(hGroup);
    });

    // ── Patrol soldiers (3, each guarding a different area near the colony) ──
    for (let si = 0; si < 3; si++) {
        const soldier = _buildSoldierMesh();
        // Each soldier patrols a distinct zone spread around the colony
        const patrolAngle = (si / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const patrolDist = 14 + Math.random() * 10;
        const centerX = Math.cos(patrolAngle) * patrolDist;
        const centerZ = Math.sin(patrolAngle) * patrolDist;
        const sy = heightFn(centerX, centerZ);
        soldier.position.set(centerX, sy, centerZ);

        // First waypoint
        const wpAngle = Math.random() * Math.PI * 2;
        const wpR = 2 + Math.random() * 4;
        // Blob shadow
        const sShadow = createShadowSprite();
        sShadow.scale.setScalar(1.4);
        sShadow.position.set(centerX, sy + 0.15, centerZ);
        group.add(sShadow);

        // Track-trail pool (small flat quads left behind while walking)
        const TRAIL_MAX = 16;
        const trailMarks = [];
        const trailGeo = new THREE.PlaneGeometry(0.35, 0.55);
        for (let ti = 0; ti < TRAIL_MAX; ti++) {
            const tMat = new THREE.MeshBasicMaterial({
                color: 0x000000, transparent: true, opacity: 0,
                depthWrite: false, polygonOffset: true,
                polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            });
            const mark = new THREE.Mesh(trailGeo, tMat);
            mark.rotation.x = -Math.PI / 2;
            mark.visible = false;
            group.add(mark);
            trailMarks.push({ mesh: mark, age: 999 });
        }

        soldier.userData = {
            isSoldier: true,
            centerX, centerZ,
            patrolRadius: 4 + Math.random() * 4,
            waypointX: centerX + Math.cos(wpAngle) * wpR,
            waypointZ: centerZ + Math.sin(wpAngle) * wpR,
            waitTimer: Math.random() * 1.5,
            walkPhase: 0,
            speed: 2.5 + Math.random() * 1.5,
            shadowMesh: sShadow,
            trailMarks,
            trailIndex: 0,
            trailDist: 0,
        };
        group.add(soldier);
        soldierMeshes.push(soldier);
    }
}
