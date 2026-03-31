/* Updated: Upgraded colony building visuals with detailed multi-part structures */
import * as THREE from 'three';
import { gameState, BUILDINGS } from '../core/state.js';
import { textures } from '../core/assets.js';
import { createShadowSprite } from './visuals_planet_drone.js';
import planetState from './visuals_planet_state.js';

export let harvesterGroups = [];
export let soldierMeshes = [];
export let hubGroup = null;
export let buildingAnims = [];
export let lakeExtractorGroups = [];

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

// ── Glow sprite helper ────────────────────────────────────────────────────────
function _addGlowSprite(parent, x, y, z, color, size, opacity) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft,
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: opacity || 0.3,
    }));
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    parent.add(sprite);
    return sprite;
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
    const endR = 34;    // building platform edge
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

        // Glow sprite at every other segment center (subtle tube lighting)
        if (i % 2 === 1) {
            _addGlowSprite(group, mx, my + 0.5, mz, borderColor, 2.5, 0.15);
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

    // Corner bollards with glow tips
    const bollardGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.2, 6);
    [[-3.5, 0, -3.5], [-3.5, 0, 3.5], [3.5, 0, -3.5], [3.5, 0, 3.5]].forEach(([bx, , bz]) => {
        const b = new THREE.Mesh(bollardGeo, _frameMat());
        b.position.set(bx, 0.9, bz);
        g.add(b);

        // Bollard tip glow
        const tipMat = new THREE.MeshStandardMaterial({
            color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 0.8,
            transparent: true, opacity: 0.8
        });
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 4, 4), tipMat);
        tip.position.set(bx, 1.55, bz);
        g.add(tip);
        _addGlowSprite(g, bx, 1.55, bz, 0x00ccff, 1.5, 0.2);
    });

    // Platform edge glow strips (4 sides)
    const edgeGlowMat = new THREE.MeshStandardMaterial({
        color: 0x00aacc, emissive: 0x00aacc, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.5
    });
    [[-4, 0.32, 0, 0.08, 0.06, 8.2],
     [4, 0.32, 0, 0.08, 0.06, 8.2],
     [0, 0.32, -4, 8.2, 0.06, 0.08],
     [0, 0.32, 4, 8.2, 0.06, 0.08]].forEach(([ex, ey, ez, ew, eh, ed]) => {
        const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(ew, eh, ed), edgeGlowMat);
        edgeStrip.position.set(ex, ey, ez);
        g.add(edgeStrip);
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

    // ── Central antenna mast ──
    // Thick lower mast section
    const mastLower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.55, 4, 8),
        _frameMat()
    );
    mastLower.position.y = 8;
    g.add(mastLower);

    // Thinner upper mast section
    const mastUpper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.35, 3, 8),
        _frameMat()
    );
    mastUpper.position.y = 11.5;
    g.add(mastUpper);

    // Mast support braces (4 diagonal struts from dome to mast)
    const braceMat = _mat('mastBrace', { color: 0x222233, roughness: 0.3, metalness: 0.85 });
    for (let bi = 0; bi < 4; bi++) {
        const ba = (bi / 4) * Math.PI * 2;
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 4), braceMat);
        brace.position.set(Math.cos(ba) * 2, 7.5, Math.sin(ba) * 2);
        brace.lookAt(0, 10, 0);
        // rotate to point toward top of mast
        const dir = new THREE.Vector3(-Math.cos(ba) * 2, 2.5, -Math.sin(ba) * 2).normalize();
        brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        brace.position.set(Math.cos(ba) * 1, 8, Math.sin(ba) * 1);
        g.add(brace);
    }

    // ── Rotating radar assembly ──
    const dishPivot = new THREE.Group();
    dishPivot.position.y = 13;
    dishPivot.userData.radarDish = true;

    // Dish mount hub (cylindrical base for the dish arm)
    const mountHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8),
        _frameMat()
    );
    dishPivot.add(mountHub);

    // Dish support arm (horizontal boom)
    const dishArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 2.8),
        braceMat
    );
    dishArm.position.set(0, 0.15, 1.4);
    dishPivot.add(dishArm);

    // Main parabolic dish — larger and more visible
    const dishMat = new THREE.MeshStandardMaterial({
        color: 0xc0d0e0, roughness: 0.15, metalness: 0.9,
        emissive: 0x1a2a3a, emissiveIntensity: 0.05,
    });
    const dishGeo = new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI;
    dish.position.set(0, 0.2, 2.8);
    dishPivot.add(dish);

    // Dish rim ring for definition
    const dishRim = new THREE.Mesh(
        new THREE.TorusGeometry(1.75, 0.08, 6, 16),
        braceMat
    );
    dishRim.rotation.x = Math.PI / 2;
    dishRim.position.set(0, 0.2, 2.8);
    dishPivot.add(dishRim);

    // Feed horn (receiver at focal point, with struts)
    const feedHorn = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.5, 6),
        _mat('feedHorn', { color: 0x888899, roughness: 0.2, metalness: 0.9 })
    );
    feedHorn.position.set(0, -0.6, 2.8);
    feedHorn.rotation.x = Math.PI;
    dishPivot.add(feedHorn);

    // Feed support struts (3 thin rods from dish rim to feed)
    for (let fi = 0; fi < 3; fi++) {
        const fa = (fi / 3) * Math.PI * 2;
        const strut = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 1.8, 3),
            braceMat
        );
        const sx = Math.cos(fa) * 0.9;
        const sz = 2.8 + Math.sin(fa) * 0.9;
        strut.position.set(sx / 2, -0.15, (sz + 2.8) / 2);
        const strutDir = new THREE.Vector3(-sx, -1.2, -(sz - 2.8)).normalize();
        strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), strutDir);
        strut.position.set(sx * 0.5, -0.2, 2.8 + Math.sin(fa) * 0.5);
        dishPivot.add(strut);
    }

    // Counter-weight on opposite side of arm
    const counterWeight = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.6),
        _frameMat()
    );
    counterWeight.position.set(0, 0.15, -0.3);
    dishPivot.add(counterWeight);

    g.add(dishPivot);

    // ── Beacon light on very top ──
    const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.0,
        transparent: true, opacity: 0.9
    });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), beaconMat);
    beacon.position.y = 13.6;
    beacon.userData.hubBeacon = true;
    g.add(beacon);

    // Beacon glow sprite
    const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow,
        color: 0xff3300,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.6,
    }));
    beaconGlow.position.y = 13.6;
    beaconGlow.scale.set(2.5, 2.5, 1);
    beaconGlow.userData.hubBeacon = true;
    g.add(beaconGlow);

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
        const sx = Math.cos(angle) * 6.8;
        const sz = Math.sin(angle) * 6.8;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 2.5), stripMat);
        strip.position.set(sx, 2.5, sz);
        strip.rotation.y = -angle;
        g.add(strip);

        // Glow sprite at each window strip
        const wGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glowSoft,
            color: 0x00f2ff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.25,
        }));
        wGlow.position.set(sx, 2.5, sz);
        wGlow.scale.set(4, 3, 1);
        g.add(wGlow);
    }

    // ── Main light ──
    const hubLight = new THREE.PointLight(0x00f2ff, 10, 40);
    hubLight.position.set(0, 8, 0);
    g.add(hubLight);

    // Hub top glow sprite
    const hubGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft,
        color: 0x00f2ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.3,
    }));
    hubGlow.position.set(0, 6, 0);
    hubGlow.scale.set(12, 8, 1);
    g.add(hubGlow);
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

    // Reactor core glow ring (animated: pulses)
    const coreRingMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.25,
        roughness: 0.3, metalness: 0.7
    });
    const coreRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.7, 0.25, 8, 16), coreRingMat
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

    // ── Energy arc between pylons (glowing wire — animated flicker) ──
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

    // Glow effects
    const reactorGlow = _addGlowSprite(g, 0, 4, 0, borderColor, 6, 0.25);
    _addGlowSprite(g, -3, 6.2, 2.5, borderColor, 2, 0.3);
    _addGlowSprite(g, 3, 6.2, 2.5, borderColor, 2, 0.3);
    _addGlowSprite(g, 0, 6.2, 2.5, borderColor, 3, 0.2);

    // Store animation references
    g.userData.animParts = { type: 'power_plant', coreRing, coreRingMat, arc, arcMat, reactorGlow, light };
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

    // ── Ore crusher cone (animated: spins) ──
    const crusherPivot = new THREE.Group();
    crusherPivot.position.set(0, 7.5, 0);
    const crusherGeo = new THREE.ConeGeometry(1.5, 3, 6);
    const crusher = new THREE.Mesh(crusherGeo, new THREE.MeshStandardMaterial({
        color: 0x555544, roughness: 0.5, metalness: 0.7
    }));
    crusher.rotation.x = Math.PI;
    crusherPivot.add(crusher);
    g.add(crusherPivot);

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

    // ── Crane arm (animated: rotates around base) ──
    const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 8, 6), _frameMat());
    craneBase.position.set(-2, 5, -1.5);
    g.add(craneBase);
    const cranePivot = new THREE.Group();
    cranePivot.position.set(-2, 9.2, -1.5);
    const craneArm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 0.3), _frameMat());
    craneArm.position.set(2.5, 0, 0);
    cranePivot.add(craneArm);
    g.add(cranePivot);

    // ── Accent light ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 5, 20);
    light.position.y = 7;
    g.add(light);

    // Glow effects
    _addGlowSprite(g, 0, 4.5, 0, borderColor, 5, 0.2);
    _addGlowSprite(g, 0, 9.2, -1.5, borderColor, 2, 0.15);

    // Store animation references
    g.userData.animParts = { type: 'mining_network', crusherPivot, cranePivot };
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

    // ── Internal vegetation hint (animated: gentle breathing) ──
    const vegGeo = new THREE.SphereGeometry(2.2, 8, 6);
    const vegMat = new THREE.MeshStandardMaterial({
        color: 0x226633, emissive: 0x114422, emissiveIntensity: 0.3,
        roughness: 0.9, metalness: 0.0
    });
    const veg = new THREE.Mesh(vegGeo, vegMat);
    veg.position.y = 1.8;
    veg.scale.y = 0.6;
    g.add(veg);
    const vegBaseScaleY = 0.6;

    // ── Water tanks ──
    const tankGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 8);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.3, metalness: 0.6 });
    [[3.5, 0, -2.5], [-3.5, 0, -2.5]].forEach(([wx, , wz]) => {
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(wx, 2, wz);
        g.add(tank);
    });

    // ── Growth light strips inside (animated: pulse) ──
    const growthLights = [];
    for (let i = 0; i < 3; i++) {
        const stripMat = new THREE.MeshStandardMaterial({
            color: borderColor, emissive: borderColor, emissiveIntensity: 0.4,
            roughness: 0.3, metalness: 0.5
        });
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 4), stripMat);
        strip.position.set(-1.5 + i * 1.5, 3.5, 0);
        g.add(strip);
        growthLights.push(stripMat);
    }

    // ── Interior glow ──
    const light = new THREE.PointLight(new THREE.Color(borderColor), 4, 18);
    light.position.y = 3;
    g.add(light);

    // Dome interior glow (visible through glass)
    const domeGlow = _addGlowSprite(g, 0, 2.5, 0, 0x44ff88, 7, 0.2);
    // Growth light glow strips
    const glowSprites = [];
    for (let i = 0; i < 3; i++) {
        glowSprites.push(_addGlowSprite(g, -1.5 + i * 1.5, 3.5, 0, borderColor, 2, 0.25));
    }

    // Store animation references
    g.userData.animParts = { type: 'hydroponics', veg, vegMat, vegBaseScaleY, growthLights, glowSprites, domeGlow, light };
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

    // ── Satellite dish on roof (animated: rotates) ──
    const dishPivot = new THREE.Group();
    dishPivot.position.set(1.5, 5.5, 0);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), _frameMat());
    dishPivot.add(pedestal);
    const dishGeo = new THREE.SphereGeometry(1.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.15, metalness: 0.9 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI;
    dish.rotation.z = 0.3;
    dish.position.y = 0.5;
    dishPivot.add(dish);
    g.add(dishPivot);

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

    // Antenna tip blink material (animated)
    const tipMat = new THREE.MeshStandardMaterial({
        color: borderColor, emissive: borderColor, emissiveIntensity: 0.4,
        roughness: 0.2, metalness: 0.6
    });
    const tipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), tipMat);
    tipGlow.position.set(-1.5, 10.2, 0);
    g.add(tipGlow);

    // ── Holographic projector base ──
    const projBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.5, 8), accentMat);
    projBase.position.set(0, 5.3, 0);
    g.add(projBase);

    // Hologram glow beam (animated: pulses)
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

    // Glow effects
    _addGlowSprite(g, 0, 3.8, 0, 0x4488ff, 5, 0.2);
    const antennaTipGlow = _addGlowSprite(g, -1.5, 10.2, 0, borderColor, 1.5, 0.4);
    const beamGlow = _addGlowSprite(g, 0, 6.8, 0, borderColor, 3, 0.2);

    // Store animation references
    g.userData.animParts = { type: 'research_lab', dishPivot, beam, beamMat, tipMat, antennaTipGlow, beamGlow, windowMat };
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

    // Hangar door opening (dark inset — recessed into the building)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 0.9, metalness: 0.1 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 0.6), doorMat);
    door.position.set(0, 2.4, 2.3);
    g.add(door);

    // Door frame — thin accent strips around the opening instead of a flat rectangle
    const frameThick = 0.15;
    // Top strip
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, frameThick, 0.2), accentMat);
    frameTop.position.set(0, 3.9, 2.55);
    g.add(frameTop);
    // Bottom strip
    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(3.6, frameThick, 0.2), accentMat);
    frameBot.position.set(0, 1.0, 2.55);
    g.add(frameBot);
    // Left strip
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, 3.0, 0.2), accentMat);
    frameL.position.set(-1.72, 2.45, 2.55);
    g.add(frameL);
    // Right strip
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(frameThick, 3.0, 0.2), accentMat);
    frameR.position.set(1.72, 2.45, 2.55);
    g.add(frameR);

    // Interior hint — small ship silhouette inside the hangar
    const innerMat = new THREE.MeshStandardMaterial({
        color: 0x334455, roughness: 0.6, metalness: 0.5
    });
    const innerShip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.0, 4), innerMat);
    innerShip.rotation.x = Math.PI / 2;
    innerShip.position.set(0, 2.4, 1.6);
    g.add(innerShip);

    // ── Roof (angled hangar roof) ──
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.5, metalness: 0.6 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 5.2), roofMat);
    roof.position.set(0, 5.15, 0);
    roof.castShadow = true;
    g.add(roof);

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

    // Crane trolley group (animated: oscillates along crossbeam)
    const trolleyPivot = new THREE.Group();
    trolleyPivot.position.set(0, 0, 0);
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), accentMat);
    trolley.position.set(0, 12.9, 0);
    trolleyPivot.add(trolley);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5, 4), _pipeMat());
    cable.position.set(0, 10.2, 0);
    trolleyPivot.add(cable);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 4, 8, Math.PI), accentMat);
    hook.position.set(0, 7.7, 0);
    trolleyPivot.add(hook);
    g.add(trolleyPivot);

    // ── Launch pad markings (accent circle on ground) ──
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.15, 6, 20), accentMat);
    padRing.rotation.x = Math.PI / 2;
    padRing.position.set(0, 0.65, 0);
    g.add(padRing);

    // ── Fuel tanks (neutral color, not purple) ──
    const fuelGeo = new THREE.CylinderGeometry(0.6, 0.6, 3, 8);
    const fuelMat = new THREE.MeshStandardMaterial({ color: 0x556666, roughness: 0.4, metalness: 0.5 });
    [[-3.5, 0, 3], [3.5, 0, 3]].forEach(([fx, , fz]) => {
        const tank = new THREE.Mesh(fuelGeo, fuelMat);
        tank.position.set(fx, 2.5, fz);
        g.add(tank);
        // Tank accent band
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 4, 8), accentMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(fx, 3.2, fz);
        g.add(band);
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

    // Glow effects
    _addGlowSprite(g, 0, 2.4, 2.6, borderColor, 3, 0.2);
    _addGlowSprite(g, 0, 12.9, 0, borderColor, 2, 0.25);
    const padGlow = _addGlowSprite(g, 0, 0.65, 0, borderColor, 6, 0.15);

    // Store animation references
    g.userData.animParts = { type: 'shipyard', trolleyPivot, padRing, padGlow, innerShip };
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

    _addGlowSprite(g, 0, 6, 0, borderColor || 0x00f2ff, 5, 0.25);
}

// ── Deployable tank ─────────────────────────────────────────────────────────

export function buildTankMesh() {
    const g = new THREE.Group();

    // ── Space tank materials ──
    const hullMat = _mat('tankHull', { color: 0x0c1420, roughness: 0.3, metalness: 0.9 });
    const armorMat = _mat('tankArmor', { color: 0x141e2a, roughness: 0.35, metalness: 0.85 });
    const frameMat = _mat('tankFrame', { color: 0x0a0f18, roughness: 0.25, metalness: 0.95 });
    const turretMat = _mat('tankTurret', { color: 0x10182a, roughness: 0.3, metalness: 0.9 });
    const cannonMat = _mat('tankCannon', { color: 0x080c14, roughness: 0.15, metalness: 0.95 });
    const glowMat = new THREE.MeshStandardMaterial({
        color: 0x00ddff, emissive: 0x00ddff, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.85,
    });
    const glowDimMat = new THREE.MeshStandardMaterial({
        color: 0x0088cc, emissive: 0x0088cc, emissiveIntensity: 0.4,
        transparent: true, opacity: 0.6,
    });
    const engineGlowMat = new THREE.MeshStandardMaterial({
        color: 0x3399ff, emissive: 0x2266ff, emissiveIntensity: 1.0,
        transparent: true, opacity: 0.9,
    });

    // ── Main hull — angular, low-profile wedge shape ──
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.8, 3.0), hullMat);
    hull.position.y = 0.7;
    hull.castShadow = true;
    g.add(hull);

    // Angled front armor (wedge)
    const frontWedge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.8), armorMat);
    frontWedge.position.set(2.2, 0.65, 0);
    frontWedge.rotation.z = -0.4;
    frontWedge.castShadow = true;
    g.add(frontWedge);

    // Rear engine block
    const rearBlock = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 2.6), armorMat);
    rearBlock.position.set(-2.0, 0.75, 0);
    g.add(rearBlock);

    // ── Side armor fins (angular wing-like panels) ──
    [-1, 1].forEach(side => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.6), armorMat);
        fin.position.set(0.3, 0.9, side * 1.7);
        fin.rotation.z = side * -0.08;
        fin.castShadow = true;
        g.add(fin);

        // Side armor plates (layered)
        const plate = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 0.15), frameMat);
        plate.position.set(0, 0.65, side * 1.55);
        g.add(plate);

        // Glow strip along side
        const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.06), glowDimMat);
        sideGlow.position.set(0.2, 0.95, side * 1.58);
        g.add(sideGlow);
    });

    // ── Hover engine pods (replace tracks) ──
    const hoverPositions = [
        { x: 1.2, z: -1.4 }, { x: -1.2, z: -1.4 },
        { x: 1.2, z: 1.4 },  { x: -1.2, z: 1.4 },
    ];
    const hoverPods = [];
    hoverPositions.forEach(hp => {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 8), frameMat);
        pod.position.set(hp.x, 0.2, hp.z);
        g.add(pod);
        // Glow ring underneath
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.4, 8), engineGlowMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(hp.x, 0.06, hp.z);
        g.add(ring);
        hoverPods.push(ring);
    });

    // ── Hull details ──
    // Front sensor array (visor slit)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 1.8), glowMat);
    visor.position.set(1.6, 1.0, 0);
    g.add(visor);

    // Front headlights (bright energy lamps)
    [-0.7, 0.7].forEach(zoff => {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), glowMat);
        lamp.position.set(2.6, 0.7, zoff);
        g.add(lamp);
    });

    // Rear thruster vents (engine exhaust)
    [-0.6, 0, 0.6].forEach(zoff => {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.35), frameMat);
        vent.position.set(-2.4, 0.75, zoff);
        g.add(vent);
        const ventGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.28), engineGlowMat);
        ventGlow.position.set(-2.47, 0.75, zoff);
        g.add(ventGlow);
    });

    // Hull top panel lines
    [-0.5, 0.5].forEach(zoff => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.03), glowDimMat);
        line.position.set(-0.2, 1.12, zoff);
        g.add(line);
    });

    // Antenna / sensor mast on hull rear
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), frameMat);
    antenna.position.set(-1.6, 1.5, 0.6);
    g.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), glowMat);
    antennaTip.position.set(-1.6, 1.95, 0.6);
    g.add(antennaTip);

    // ── Turret pivot (rotates independently) ──
    const turretPivot = new THREE.Group();
    turretPivot.position.set(0.1, 1.15, 0);
    g.add(turretPivot);

    // Turret base — octagonal ring
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.12, 8), frameMat);
    turretPivot.add(turretBase);

    // Turret body — angular, wider at base
    const turretBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.3), turretMat);
    turretBody.position.set(0.3, 0.38, 0);
    turretBody.castShadow = true;
    turretPivot.add(turretBody);

    // Turret sloped front
    const turretFront = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 1.15), turretMat);
    turretFront.position.set(1.3, 0.32, 0);
    turretFront.rotation.z = -0.25;
    turretPivot.add(turretFront);

    // Turret top sensor dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), frameMat);
    dome.position.set(-0.3, 0.72, 0);
    turretPivot.add(dome);
    const domeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), glowMat);
    domeGlow.position.set(-0.3, 0.85, 0);
    turretPivot.add(domeGlow);

    // Turret side energy vanes
    [-1, 1].forEach(side => {
        const vane = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.12), glowDimMat);
        vane.position.set(0.1, 0.55, side * 0.78);
        turretPivot.add(vane);
    });

    // Turret glow accent line
    const tGlow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.03), glowMat);
    tGlow.position.set(0.5, 0.7, 0);
    turretPivot.add(tGlow);

    // ── Dual energy cannons ──
    [-0.22, 0.22].forEach(zoff => {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 8), cannonMat);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(2.6, 0.38, zoff);
        turretPivot.add(barrel);

        // Energy coil rings along barrel
        for (let ci = 0; ci < 3; ci++) {
            const coil = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 8), glowDimMat);
            coil.rotation.y = Math.PI / 2;
            coil.position.set(1.4 + ci * 0.7, 0.38, zoff);
            turretPivot.add(coil);
        }

        // Muzzle tip glow
        const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.15, 8), glowMat);
        muzzleTip.rotation.z = Math.PI / 2;
        muzzleTip.position.set(4.15, 0.38, zoff);
        turretPivot.add(muzzleTip);
    });

    // Muzzle point (projectile spawn — centered between dual barrels)
    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(4.3, 0.38, 0);
    turretPivot.add(muzzlePoint);

    // Shadow sprite
    const shadow = createShadowSprite();
    shadow.scale.set(5, 5, 1);
    shadow.position.set(0, 0.02, 0);
    g.add(shadow);

    // ── Exhaust / thruster particles (pooled sprites) ──
    const smokeTex = _getSmokeTexture();
    const exhaustParticles = [];
    for (let pi = 0; pi < 14; pi++) {
        const spMat = new THREE.SpriteMaterial({
            map: smokeTex,
            color: 0x4488cc,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const sp = new THREE.Sprite(spMat);
        sp.scale.set(0.3, 0.3, 0.3);
        sp.visible = false;
        exhaustParticles.push({
            sprite: sp,
            life: 0,
            maxLife: 0.6 + Math.random() * 0.4,
            vx: 0, vy: 0, vz: 0,
            added: false,
        });
    }

    // ── Hover trail marks (energy scorch on ground — dual tracks) ──
    const trailMarks = [];
    for (let ti = 0; ti < 50; ti++) {
        const tMat = new THREE.SpriteMaterial({
            map: smokeTex,
            color: 0x2288bb,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const tsp = new THREE.Sprite(tMat);
        tsp.scale.set(1.8, 0.4, 1);
        tsp.visible = false;
        trailMarks.push({
            sprite: tsp,
            life: 0,
            maxLife: 2.5,
            added: false,
        });
    }

    g.userData = {
        isTank: true,
        turretPivot,
        muzzlePoint,
        shadowMesh: shadow,
        velocity: new THREE.Vector3(),
        exhaustParticles,
        exhaustTimer: 0,
        trailMarks,
        trailTimer: 0,
        hoverPods,
        hoverTime: 0,
    };

    return g;
}

// ── Patrol soldiers ─────────────────────────────────────────────────────────

function _buildSoldierMesh() {
    const g = new THREE.Group();

    // ── Materials ──
    const armorMat = new THREE.MeshStandardMaterial({
        color: 0x2a3a2a, roughness: 0.45, metalness: 0.7
    });
    const armorTrimMat = new THREE.MeshStandardMaterial({
        color: 0x1a2a1a, roughness: 0.3, metalness: 0.85
    });
    const underMat = new THREE.MeshStandardMaterial({
        color: 0x222222, roughness: 0.7, metalness: 0.3
    });
    const bootMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, roughness: 0.6, metalness: 0.5
    });
    const visorMat = new THREE.MeshStandardMaterial({
        color: 0x00ccff, emissive: 0x00ccff, emissiveIntensity: 0.8,
        roughness: 0.05, metalness: 0.95
    });
    const rifleMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a, roughness: 0.25, metalness: 0.95
    });
    const rifleAccentMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, roughness: 0.3, metalness: 0.9
    });

    // ── Torso (chest plate + belly) — static on root ──
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.38), armorMat);
    chestPlate.position.y = 1.35;
    chestPlate.castShadow = true;
    g.add(chestPlate);

    const chestLine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.39), armorTrimMat);
    chestLine.position.y = 1.35;
    g.add(chestLine);

    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.32), underMat);
    belly.position.y = 0.95;
    g.add(belly);

    // Shoulder pads
    [-1, 1].forEach(side => {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.32), armorTrimMat);
        pad.position.set(side * 0.38, 1.58, 0);
        pad.castShadow = true;
        g.add(pad);
    });

    // Collar / neck guard
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.12, 6), armorTrimMat);
    collar.position.y = 1.65;
    g.add(collar);

    // Belt / waist strap
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.36), bootMat);
    belt.position.y = 0.82;
    g.add(belt);

    // Belt pouch
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), armorTrimMat);
    pouch.position.set(-0.28, 0.82, 0.18);
    g.add(pouch);

    // ── Backpack ──
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.2), armorMat);
    backpack.position.set(0, 1.28, -0.28);
    backpack.castShadow = true;
    g.add(backpack);

    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), armorTrimMat);
    canister.position.set(0.12, 1.15, -0.38);
    g.add(canister);

    // ── Head pivot (neck level) ──
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.72;
    headGroup.userData.isHead = true;
    g.add(headGroup);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), armorMat);
    helmet.position.y = 0.16;
    helmet.castShadow = true;
    headGroup.add(helmet);

    const helmetRidge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.16), armorTrimMat);
    helmetRidge.position.set(0, 0.24, -0.06);
    headGroup.add(helmetRidge);

    const visor = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        visorMat
    );
    visor.position.set(0, 0.12, 0.1);
    visor.rotation.x = -0.3;
    headGroup.add(visor);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 3), rifleMat);
    antenna.position.set(-0.15, 0.36, -0.05);
    antenna.rotation.z = 0.2;
    headGroup.add(antenna);

    // ── Legs with hip + knee pivots ──
    const joints = { head: headGroup };

    [-1, 1].forEach(side => {
        const sName = side === -1 ? 'left' : 'right';

        // Hip pivot at belt level
        const hipGroup = new THREE.Group();
        hipGroup.position.set(side * 0.16, 0.82, 0);
        hipGroup.userData.isLeg = true;
        hipGroup.userData.side = side;
        g.add(hipGroup);

        // Upper thigh
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.2), underMat);
        thigh.position.y = -0.19;
        hipGroup.add(thigh);

        // Thigh armor plate (front)
        const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.05), armorTrimMat);
        thighPlate.position.set(0, -0.12, 0.12);
        hipGroup.add(thighPlate);

        // Knee pad
        const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.1), armorTrimMat);
        kneePad.position.set(0, -0.36, 0.12);
        hipGroup.add(kneePad);

        // Knee pivot (inside hip group)
        const kneeGroup = new THREE.Group();
        kneeGroup.position.y = -0.40;
        hipGroup.add(kneeGroup);

        // Shin
        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), underMat);
        shin.position.y = -0.12;
        kneeGroup.add(shin);

        // Shin guard (front armor)
        const shinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.05), armorMat);
        shinGuard.position.set(0, -0.10, 0.11);
        kneeGroup.add(shinGuard);

        // Boot ankle collar
        const ankleCollar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), armorTrimMat);
        ankleCollar.position.y = -0.26;
        kneeGroup.add(ankleCollar);

        // Boot body
        const bootBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.28), bootMat);
        bootBody.position.set(0, -0.33, 0.02);
        kneeGroup.add(bootBody);

        // Boot sole (wider, extends forward)
        const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.32), bootMat);
        bootSole.position.set(0, -0.40, 0.04);
        kneeGroup.add(bootSole);

        // Boot toe cap
        const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.06), armorTrimMat);
        toeCap.position.set(0, -0.36, 0.17);
        kneeGroup.add(toeCap);

        // Boot heel
        const bootHeel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), bootMat);
        bootHeel.position.set(0, -0.38, -0.11);
        kneeGroup.add(bootHeel);

        joints[sName + 'Leg'] = hipGroup;
        joints[sName + 'Knee'] = kneeGroup;
    });

    // ── Arms with shoulder + elbow pivots ──
    [-1, 1].forEach(side => {
        const sName = side === -1 ? 'left' : 'right';

        // Shoulder pivot
        const shoulderGroup = new THREE.Group();
        shoulderGroup.position.set(side * 0.38, 1.5, 0);
        shoulderGroup.userData.isArm = true;
        shoulderGroup.userData.side = side;
        g.add(shoulderGroup);

        // Upper arm
        const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), underMat);
        upperArm.position.y = -0.16;
        shoulderGroup.add(upperArm);

        // Upper arm armor band
        const armBand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), armorTrimMat);
        armBand.position.y = -0.04;
        shoulderGroup.add(armBand);

        // Elbow pivot (inside shoulder group)
        const elbowGroup = new THREE.Group();
        elbowGroup.position.y = -0.32;
        shoulderGroup.add(elbowGroup);

        // Forearm
        const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.13), armorMat);
        forearm.position.set(0, -0.14, 0.02);
        elbowGroup.add(forearm);

        // Wrist guard
        const wristGuard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.15), armorTrimMat);
        wristGuard.position.set(0, -0.26, 0.02);
        elbowGroup.add(wristGuard);

        // Glove
        const glove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), bootMat);
        glove.position.set(0, -0.33, 0.04);
        elbowGroup.add(glove);

        joints[sName + 'Arm'] = shoulderGroup;
        joints[sName + 'Elbow'] = elbowGroup;
    });

    // ── Detailed rifle (attached to right elbow group) ──
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.02, -0.28, 0.18);
    rifleGroup.rotation.x = -0.1;
    joints.rightElbow.add(rifleGroup);

    // Receiver body
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.32), rifleMat);
    rifleGroup.add(receiver);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 6), rifleMat);
    barrel.position.set(0, 0.01, 0.35);
    barrel.rotation.x = Math.PI / 2;
    rifleGroup.add(barrel);

    // Barrel shroud
    const barrelShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), rifleAccentMat);
    barrelShroud.position.set(0, 0.01, 0.22);
    barrelShroud.rotation.x = Math.PI / 2;
    rifleGroup.add(barrelShroud);

    // Muzzle brake
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.08, 6), rifleAccentMat);
    muzzleBrake.position.set(0, 0.01, 0.56);
    muzzleBrake.rotation.x = Math.PI / 2;
    rifleGroup.add(muzzleBrake);

    // Magazine
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), rifleAccentMat);
    magazine.position.set(0, -0.10, 0.02);
    magazine.rotation.x = -0.15;
    rifleGroup.add(magazine);

    // Pistol grip
    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), bootMat);
    pistolGrip.position.set(0, -0.08, -0.08);
    pistolGrip.rotation.x = -0.3;
    rifleGroup.add(pistolGrip);

    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.1), rifleMat);
    triggerGuard.position.set(0, -0.06, -0.01);
    rifleGroup.add(triggerGuard);

    // Foregrip
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.06), bootMat);
    foregrip.position.set(0, -0.06, 0.15);
    rifleGroup.add(foregrip);

    // Scope
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), armorTrimMat);
    scope.position.set(0, 0.07, 0.08);
    scope.rotation.x = Math.PI / 2;
    rifleGroup.add(scope);

    // Scope mount
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.06), rifleMat);
    scopeMount.position.set(0, 0.05, 0.08);
    rifleGroup.add(scopeMount);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), rifleMat);
    stock.position.set(0, 0, -0.24);
    rifleGroup.add(stock);

    // Stock butt pad
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.03), bootMat);
    stockPad.position.set(0, 0, -0.34);
    rifleGroup.add(stockPad);

    // Tactical light (small glow on barrel)
    const tacLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.8 })
    );
    tacLight.position.set(0.04, 0.01, 0.15);
    rifleGroup.add(tacLight);

    // Muzzle flash point (at barrel tip)
    const muzzle = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
    );
    muzzle.position.set(0, 0.01, 0.6);
    rifleGroup.add(muzzle);

    joints.rifle = rifleGroup;
    joints.muzzle = muzzle;

    // Store all joint references for animation
    g.userData.joints = joints;

    g.scale.setScalar(1.2);
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
    buildingAnims = [];
    lakeExtractorGroups = [];
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
        const dist = 38;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const y = heightFn(x, z);

        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        bGroup.rotation.y = -angle;
        bGroup.userData.buildingKey = bKey;

        const bc = buildingData.borderColor || '#00f2ff';
        if (bKey === 'power_plant') _buildPowerPlant(bGroup, bc);
        else if (bKey === 'mining_network') _buildMiningNetwork(bGroup, bc);
        else if (bKey === 'hydroponics') _buildHydroponics(bGroup, bc);
        else if (bKey === 'research_lab') _buildResearchLab(bGroup, bc);
        else if (bKey === 'shipyard') _buildShipyard(bGroup, bc);
        else _buildDefault(bGroup, bc);

        group.add(bGroup);

        // Collect animation parts
        if (bGroup.userData.animParts) buildingAnims.push(bGroup.userData.animParts);

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

        // Engine trail sprites (world-space glow left behind rover)
        const ROVER_TRAIL_COUNT = 10;
        const roverTrailSprites = [];
        for (let eti = 0; eti < ROVER_TRAIL_COUNT; eti++) {
            const etMat = new THREE.SpriteMaterial({
                map: textures.glow,
                color: 0xffaa44,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                opacity: 0,
            });
            const etSprite = new THREE.Sprite(etMat);
            etSprite.visible = false;
            etSprite.scale.set(0.6, 0.6, 0.6);
            group.add(etSprite);
            roverTrailSprites.push({ sprite: etSprite, life: 0, maxLife: 1.0 + Math.random() * 0.5 });
        }
        rover.userData.engineTrailSprites = roverTrailSprites;
        rover.userData.engineTrailTimer = 0;

        // Track marks pool (flat quads on ground behind rover)
        const ROVER_TRACK_MAX = 24;
        const roverTracks = [];
        const roverTrackGeo = new THREE.PlaneGeometry(0.4, 0.7);
        for (let rti = 0; rti < ROVER_TRACK_MAX; rti++) {
            const rtMat = new THREE.MeshBasicMaterial({
                color: 0x111100, transparent: true, opacity: 0,
                depthWrite: false, polygonOffset: true,
                polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            });
            const rtMark = new THREE.Mesh(roverTrackGeo, rtMat);
            rtMark.rotation.x = -Math.PI / 2;
            rtMark.visible = false;
            group.add(rtMark);
            roverTracks.push({ mesh: rtMark, age: 999 });
        }
        rover.userData.trackMarks = roverTracks;
        rover.userData.trackIndex = 0;
        rover.userData.trackDist = 0;
        rover.userData.lastRX = 0;
        rover.userData.lastRZ = 0;

        // Place rover at initial orbit position
        const initAngle = rover.userData.orbitPhase;
        const initR = rover.userData.orbitRadius;
        const rx = hx + Math.cos(initAngle) * initR;
        const rz = hz + Math.sin(initAngle) * initR;
        const ry = heightFn(rx, rz);
        rover.position.set(rx, ry, rz);
        rover.rotation.y = -initAngle + Math.PI / 2;
        rover.userData.lastRX = rx;
        rover.userData.lastRZ = rz;

        group.add(rover);
        hGroup.userData.rover = rover;

        group.add(hGroup);
        harvesterGroups.push(hGroup);
    });

    // ── Lake Extractors ──
    const lakeExtractors = colony.lakeExtractors || [];
    lakeExtractors.forEach((ext) => {
        const ex = ext.position.x;
        const ez = ext.position.z;
        // Find the lake this extractor belongs to for water Y
        const lakeDef = planetState.lakeDefs[ext.lakeIndex];
        const waterY = lakeDef ? (lakeDef.waterY ?? heightFn(lakeDef.x, lakeDef.z) - 0.5) : heightFn(ex, ez);

        const eGroup = new THREE.Group();
        eGroup.position.set(ex, waterY, ez);
        eGroup.userData = { isLakeExtractor: true, extractorId: ext.id, lakeIndex: ext.lakeIndex };

        _buildLakeExtractor(eGroup);

        group.add(eGroup);
        lakeExtractorGroups.push(eGroup);
    });

    // ── Patrol soldiers (3, each guarding a different area near the colony) ──
    for (let si = 0; si < 3; si++) {
        const soldier = _buildSoldierMesh();
        // Each soldier patrols a distinct zone spread around the colony
        const patrolAngle = (si / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const patrolDist = 24 + Math.random() * 12;
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

        Object.assign(soldier.userData, {
            isSoldier: true,
            centerX, centerZ,
            patrolRadius: 4 + Math.random() * 4,
            waypointX: centerX + Math.cos(wpAngle) * wpR,
            waypointZ: centerZ + Math.sin(wpAngle) * wpR,
            waitTimer: Math.random() * 1.5,
            walkPhase: 0,
            speed: 2.5 + Math.random() * 1.5,
            fireCooldown: 0,
            shadowMesh: sShadow,
            trailMarks,
            trailIndex: 0,
            trailDist: 0,
        });
        group.add(soldier);
        soldierMeshes.push(soldier);
    }

    // ── Alien hives (hostile spawn points) ──
    _spawnAlienHives(group, heightFn);

    // ── Colony shield dome ──
    _buildColonyShield(group);
}

// ── Lake Hydro Extractor ────────────────────────────────────────────────────

function _buildLakeExtractor(group) {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    // --- Floating hexagonal platform ---
    const platGeo = new THREE.CylinderGeometry(3.2, 3.5, 0.6, 6);
    const platMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x1a3a5a, emissive: 0x0a1a2a, emissiveIntensity: 0.2 })
        : new THREE.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.4, metalness: 0.7, emissive: 0x0a1a2a, emissiveIntensity: 0.2 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = 0.3;
    platform.castShadow = true;
    group.add(platform);

    // Platform edge glow ring
    const ringGeo = new THREE.TorusGeometry(3.35, 0.08, 6, 6);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ccff, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.6;
    group.add(ring);

    // --- Central turbine column ---
    const colGeo = new THREE.CylinderGeometry(0.6, 0.8, 5, 8);
    const colMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x334466, emissive: 0x112233, emissiveIntensity: 0.15 })
        : new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.3, metalness: 0.8, emissive: 0x112233, emissiveIntensity: 0.15 });
    const column = new THREE.Mesh(colGeo, colMat);
    column.position.y = 3.1;
    column.castShadow = true;
    group.add(column);

    // --- Rotating turbine blades (3 curved vanes) ---
    const turbine = new THREE.Group();
    turbine.position.y = 5.8;
    const bladeMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x88ccff, emissive: 0x2288cc, emissiveIntensity: 0.4 })
        : new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.2, metalness: 0.6, emissive: 0x2288cc, emissiveIntensity: 0.4 });
    for (let i = 0; i < 3; i++) {
        const bladeGeo = new THREE.BoxGeometry(0.15, 0.3, 3.5);
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        const angle = (i / 3) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * 1.75, 0, Math.sin(angle) * 1.75);
        blade.rotation.y = angle;
        // Slight tilt for wind-catch look
        blade.rotation.x = 0.15;
        blade.castShadow = true;
        turbine.add(blade);
    }
    // Central hub cap
    const hubCapGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const hubCapMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x00aaff, emissive: 0x0066cc, emissiveIntensity: 0.5 })
        : new THREE.MeshStandardMaterial({ color: 0x00aaff, roughness: 0.15, metalness: 0.9, emissive: 0x0066cc, emissiveIntensity: 0.5 });
    turbine.add(new THREE.Mesh(hubCapGeo, hubCapMat));
    group.add(turbine);
    group.userData.turbine = turbine;

    // --- Energy conduit pipes (2 curved supports) ---
    const pipeMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x224466 })
        : new THREE.MeshStandardMaterial({ color: 0x224466, roughness: 0.5, metalness: 0.6 });
    for (let side = -1; side <= 1; side += 2) {
        const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 6);
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.set(side * 1.4, 2.8, 0);
        pipe.rotation.z = side * 0.2;
        group.add(pipe);
    }

    // --- Underwater intake vanes (dangling below platform) ---
    const vaneMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x0066aa, emissive: 0x003366, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 })
        : new THREE.MeshStandardMaterial({ color: 0x0066aa, roughness: 0.2, metalness: 0.5, emissive: 0x003366, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 4; i++) {
        const vaneAngle = (i / 4) * Math.PI * 2;
        const vane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.8), vaneMat);
        vane.position.set(Math.cos(vaneAngle) * 1.8, -1.2, Math.sin(vaneAngle) * 1.8);
        vane.rotation.y = vaneAngle;
        group.add(vane);
    }

    // --- Energy orb (floating above turbine) ---
    const orbGeo = new THREE.SphereGeometry(0.35, 12, 10);
    const orbMat = isMobile
        ? new THREE.MeshLambertMaterial({ color: 0x44ddff, emissive: 0x00bbff, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 })
        : new THREE.MeshStandardMaterial({ color: 0x44ddff, emissive: 0x00bbff, emissiveIntensity: 0.8, roughness: 0.05, metalness: 1.0, transparent: true, opacity: 0.85 });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.y = 7.2;
    group.add(orb);
    group.userData.energyOrb = orb;

    // Energy orb glow sprite
    if (textures.glow) {
        const glowMat = new THREE.SpriteMaterial({
            map: textures.glow, color: 0x00ccff,
            transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(4, 4, 1);
        glow.position.y = 7.2;
        group.add(glow);
        group.userData.orbGlow = glow;
    }

    // --- Water ripple ring (flat ring on water surface) ---
    const rippleGeo = new THREE.RingGeometry(2.8, 4.5, 24);
    const rippleMat = new THREE.MeshBasicMaterial({
        color: 0x44aaff, transparent: true, opacity: 0.15,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ripple = new THREE.Mesh(rippleGeo, rippleMat);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = 0.08;
    group.add(ripple);
    group.userData.ripple = ripple;

    // --- Small point light for ambient glow ---
    if (!isMobile) {
        const light = new THREE.PointLight(0x00ccff, 1.5, 15);
        light.position.y = 6;
        group.add(light);
    }
}

// ── Colony Shield Dome ──────────────────────────────────────────────────────

function _buildColonyShield(group) {
    const SHIELD_RADIUS = 38;
    const SHIELD_MAX_HP = 200;

    // Inner translucent dome
    const domeMat = new THREE.MeshStandardMaterial({
        color: 0x00ccff, emissive: 0x004488, emissiveIntensity: 0.2,
        transparent: true, opacity: 0.08, side: THREE.DoubleSide,
        roughness: 0.1, metalness: 0.8, depthWrite: false,
    });
    const domeGeo = new THREE.SphereGeometry(SHIELD_RADIUS, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = 0;
    domeMesh.renderOrder = 999;
    group.add(domeMesh);

    // Hex wireframe overlay (icosahedron at lower subdivision for hex-grid look)
    const wireGeo = new THREE.IcosahedronGeometry(SHIELD_RADIUS + 0.15, 2);
    // Remove bottom half vertices by clipping — just use full sphere but visually it's fine
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff, wireframe: true, transparent: true, opacity: 0.12,
        depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.position.y = 0;
    wireMesh.renderOrder = 1000;
    group.add(wireMesh);

    // Base ring glow at ground level
    const ringGeo = new THREE.RingGeometry(SHIELD_RADIUS - 0.5, SHIELD_RADIUS + 0.5, 48);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ccff, transparent: true, opacity: 0.15,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.2;
    ringMesh.renderOrder = 998;
    group.add(ringMesh);

    planetState.colonyShield = {
        hp: SHIELD_MAX_HP,
        maxHp: SHIELD_MAX_HP,
        radius: SHIELD_RADIUS,
        mesh: domeMesh,
        wireMesh,
        ringMesh,
        domeMat,
        wireMat,
        ringMat,
        lastHitTime: -999,
        broken: false,
        hitFlashTimer: 0,
    };
}

export { _buildColonyShield };

// ── Alien Hive Structure ────────────────────────────────────────────────────

function _buildAlienHiveMesh() {
    const g = new THREE.Group();

    const hiveMat = new THREE.MeshStandardMaterial({
        color: 0x3a1a2a, roughness: 0.7, metalness: 0.3,
        emissive: 0x440011, emissiveIntensity: 0.15
    });
    const membraneMat = new THREE.MeshStandardMaterial({
        color: 0x661133, roughness: 0.4, metalness: 0.2,
        emissive: 0xff2244, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.7
    });
    const spineMat = new THREE.MeshStandardMaterial({
        color: 0x2a0a1a, roughness: 0.5, metalness: 0.6
    });

    // Main mound (organic dome)
    const mound = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hiveMat);
    mound.scale.set(1, 0.65, 1);
    mound.castShadow = true;
    g.add(mound);

    // Secondary smaller mound
    const mound2 = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hiveMat);
    mound2.position.set(3.5, 0, 2);
    mound2.scale.set(1, 0.55, 1);
    g.add(mound2);

    // Entrance orifice (glowing membrane)
    const orifice = new THREE.Mesh(new THREE.CircleGeometry(1.8, 8), membraneMat);
    orifice.position.set(4.5, 1.2, 0);
    orifice.rotation.y = Math.PI / 2;
    orifice.rotation.x = -0.3;
    g.add(orifice);

    // Organic spines/tendrils
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 4 + Math.random() * 1.5;
        const h = 2 + Math.random() * 3;
        const spine = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, h, 4),
            spineMat
        );
        spine.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
        spine.rotation.x = (Math.random() - 0.5) * 0.4;
        spine.rotation.z = (Math.random() - 0.5) * 0.4;
        g.add(spine);
    }

    // Pulsing glow core (sprite)
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft,
        color: 0xff2244,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.4,
    }));
    glowSprite.position.set(0, 2, 0);
    glowSprite.scale.set(10, 10, 1);
    g.add(glowSprite);
    g.userData.glowSprite = glowSprite;

    // Ground-level fleshy tendrils (flat spreads)
    for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 3;
        const tendril = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.15, 2 + Math.random() * 2),
            hiveMat
        );
        tendril.position.set(Math.cos(angle) * r * 0.6, 0.1, Math.sin(angle) * r * 0.6);
        tendril.rotation.y = angle;
        g.add(tendril);
    }

    return g;
}

function _spawnAlienHives(group, heightFn) {
    planetState.alienHives = [];
    const hiveCount = 1 + Math.floor(Math.random() * 2); // 1-2 hives

    for (let i = 0; i < hiveCount; i++) {
        const angle = (i / hiveCount) * Math.PI * 2 + Math.random() * 1.0;
        const dist = 140 + Math.random() * 60; // 140-200 units from center
        const hx = Math.cos(angle) * dist;
        const hz = Math.sin(angle) * dist;
        const hy = heightFn(hx, hz);

        const hive = _buildAlienHiveMesh();
        hive.position.set(hx, hy - 0.5, hz);
        hive.rotation.y = Math.random() * Math.PI * 2;
        group.add(hive);

        planetState.alienHives.push({
            mesh: hive,
            x: hx, z: hz,
            spawnTimer: 3 + Math.random() * 5, // first spawn in 3-8s
            spawnInterval: 8 + Math.random() * 4, // 8-12s between spawns
            maxActive: 6,
            activeCount: 0,
        });
    }
}

// ── Hostile Alien Creature (3 variants) ──────────────────────────────────────

export function buildHostileAlienMesh() {
    const g = new THREE.Group();

    // Variant roll: 0 = grunt (60%), 1 = spitter (25%), 2 = brute (15%)
    const roll = Math.random();
    const variant = roll < 0.60 ? 0 : roll < 0.85 ? 1 : 2;
    const isBrute = variant === 2;
    const isSpitter = variant === 1;
    const scale = isBrute ? 1.5 : isSpitter ? 0.85 : 1.0;

    const bodyColor = isBrute ? 0x551133 : isSpitter ? 0x772222 : 0x661122;
    const chitinColor = isBrute ? 0x331122 : isSpitter ? 0x553311 : 0x441111;
    const eyeColor = isSpitter ? 0xff6600 : 0xff0000;

    const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor, roughness: 0.5, metalness: 0.4,
        emissive: 0x330000, emissiveIntensity: 0.15
    });
    const chitin = new THREE.MeshStandardMaterial({
        color: chitinColor, roughness: 0.3, metalness: 0.7
    });
    const eyeMat = new THREE.MeshStandardMaterial({
        color: eyeColor, emissive: eyeColor, emissiveIntensity: 0.9,
        roughness: 0.1, metalness: 0.8
    });
    const mandibleMat = new THREE.MeshStandardMaterial({
        color: 0x2a0a0a, roughness: 0.4, metalness: 0.8
    });
    const stingerMat = new THREE.MeshStandardMaterial({
        color: 0xaa2200, emissive: 0x661100, emissiveIntensity: 0.3,
        roughness: 0.2, metalness: 0.9
    });

    // Body (elongated, forward-leaning)
    const bw = 0.7 * scale, bh = 0.5 * scale, bd = 1.2 * scale;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bodyMat);
    body.position.y = 0.6 * scale;
    body.rotation.x = -0.15;
    body.castShadow = true;
    g.add(body);

    // Armored back plates
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.15 * scale, 0.9 * scale), chitin);
    backPlate.position.set(0, 0.95 * scale, -0.1 * scale);
    g.add(backPlate);

    // Brute: extra heavy shoulder armor
    if (isBrute) {
        [-1, 1].forEach(side => {
            const shoulderPlate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.5), chitin);
            shoulderPlate.position.set(side * 0.45 * scale, 0.85 * scale, 0.15 * scale);
            shoulderPlate.rotation.z = side * 0.2;
            g.add(shoulderPlate);
        });
        // Heavy crest
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.15), chitin);
        crest.position.set(0, 1.2 * scale, 0.5 * scale);
        g.add(crest);
    }

    // Spines on back (more for brute)
    const spineCount = isBrute ? 5 : 3;
    for (let si = 0; si < spineCount; si++) {
        const sH = isBrute ? 0.55 : 0.4;
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, sH * scale, 4), chitin);
        spine.position.set(
            (Math.random() - 0.5) * 0.2 * scale,
            (1.05 + si * 0.04) * scale,
            (-0.3 + si * (0.9 / spineCount)) * scale
        );
        spine.rotation.x = -0.3;
        g.add(spine);
    }

    // Head pivot
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.7 * scale, 0.7 * scale);
    g.add(headGroup);

    const headSize = isBrute ? 0.55 : isSpitter ? 0.4 : 0.45;
    const head = new THREE.Mesh(new THREE.BoxGeometry(headSize * scale, 0.35 * scale, 0.4 * scale), bodyMat);
    head.castShadow = true;
    headGroup.add(head);

    // Eyes (glowing) — brutes get 4 eyes
    const eyeCount = isBrute ? 2 : 1;
    for (let row = 0; row < eyeCount; row++) {
        [-1, 1].forEach(side => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 6, 4), eyeMat);
            eye.position.set(side * 0.18 * scale, (0.08 - row * 0.12) * scale, 0.18 * scale);
            headGroup.add(eye);
        });
    }

    // Spitter: glowing venom sac under jaw
    if (isSpitter) {
        const venomSac = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4),
            new THREE.MeshStandardMaterial({
                color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 0.6,
                transparent: true, opacity: 0.8, roughness: 0.2
            })
        );
        venomSac.position.set(0, -0.15 * scale, 0.1 * scale);
        headGroup.add(venomSac);
    }

    // Mandibles (animated) — brute mandibles are bigger
    const mScale = isBrute ? 1.4 : 1.0;
    const mandibleL = new THREE.Group();
    mandibleL.position.set(-0.15 * scale, -0.08 * scale, 0.2 * scale);
    headGroup.add(mandibleL);
    const mL = new THREE.Mesh(new THREE.BoxGeometry(0.06 * mScale * scale, 0.06 * mScale * scale, 0.3 * mScale * scale), mandibleMat);
    mL.position.z = 0.15 * mScale * scale;
    mandibleL.add(mL);

    const mandibleR = new THREE.Group();
    mandibleR.position.set(0.15 * scale, -0.08 * scale, 0.2 * scale);
    headGroup.add(mandibleR);
    const mR = new THREE.Mesh(new THREE.BoxGeometry(0.06 * mScale * scale, 0.06 * mScale * scale, 0.3 * mScale * scale), mandibleMat);
    mR.position.z = 0.15 * mScale * scale;
    mandibleR.add(mR);

    // Tail with stinger (all variants)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.55 * scale, -0.6 * scale);
    g.add(tailGroup);
    const tailSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.15 * scale, 0.12 * scale, 0.4 * scale), bodyMat);
    tailSeg1.position.z = -0.2 * scale;
    tailGroup.add(tailSeg1);
    const tailSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 0.35 * scale), bodyMat);
    tailSeg2.position.set(0, 0.06 * scale, -0.55 * scale);
    tailSeg2.rotation.x = 0.3;
    tailGroup.add(tailSeg2);
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.2 * scale, 4), stingerMat);
    stinger.position.set(0, 0.18 * scale, -0.75 * scale);
    stinger.rotation.x = 0.8;
    tailGroup.add(stinger);

    // Legs (6 legs, 3 per side)
    const legJoints = [];
    [-1, 1].forEach(side => {
        for (let li = 0; li < 3; li++) {
            const hipGroup = new THREE.Group();
            hipGroup.position.set(side * 0.35 * scale, 0.45 * scale, (0.3 - li * 0.4) * scale);
            g.add(hipGroup);

            const upperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.35 * scale, 0.08 * scale), chitin);
            upperLeg.position.set(side * 0.12 * scale, -0.17 * scale, 0);
            hipGroup.add(upperLeg);

            const kneeGroup = new THREE.Group();
            kneeGroup.position.set(side * 0.12 * scale, -0.35 * scale, 0);
            hipGroup.add(kneeGroup);

            const lowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.3 * scale, 0.06 * scale), chitin);
            lowerLeg.position.y = -0.15 * scale;
            kneeGroup.add(lowerLeg);

            // Claw foot
            const claw = new THREE.Mesh(new THREE.ConeGeometry(0.03 * scale, 0.08 * scale, 3), mandibleMat);
            claw.position.set(0, -0.32 * scale, 0.02 * scale);
            claw.rotation.x = -0.5;
            kneeGroup.add(claw);

            legJoints.push({ hip: hipGroup, knee: kneeGroup, side });
        }
    });

    // Shadow
    const shadow = createShadowSprite();
    shadow.scale.set(1.8 * scale, 1.8 * scale, 1);
    shadow.position.set(0, 0.05, 0);
    g.add(shadow);

    // HP: grunt=5, spitter=3, brute=10
    const hp = isBrute ? 10 : isSpitter ? 3 : 5;
    const speed = isBrute ? (3 + Math.random()) : isSpitter ? (5 + Math.random() * 2) : (4 + Math.random() * 2);

    g.userData = {
        isHostile: true,
        variant, // 0=grunt, 1=spitter, 2=brute
        hp,
        maxHp: hp,
        speed,
        phase: Math.random() * Math.PI * 2,
        bodyScale: scale,
        shadowMesh: shadow,
        joints: {
            head: headGroup,
            mandibleL, mandibleR,
            tail: tailGroup,
            legs: legJoints,
        },
    };

    return g;
}
