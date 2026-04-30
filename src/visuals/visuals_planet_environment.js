/* Updated: InstancedMesh batching for rocks/crystals to reduce draw calls from 150+ to ~5 */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';
import { carveLakeBasins } from './visuals_planet_terrain.js';
import { _buildAlienHiveMesh } from './visuals_planet_colony.js';

export function getSkyColor(type) {
    switch(type) {
        case 'Terran':      return 0x4da6ff;
        case 'Continental': return 0x5c8a8a;
        case 'Ocean':       return 0x1a5276;
        case 'Barren':      return 0x111111;
        case 'Molten':      return 0x4a0000;
        case 'Ice':         return 0x1a3a52;
        case 'Arctic':      return 0x1e3a5a;
        case 'Desert':      return 0xb87a3a;
        case 'Tomb':        return 0x1a1a1a;
        case 'Gas Giant':   return 0xcc7a00;
        default:            return 0x050505;
    }
}

export function getPropColor(type) {
    switch(type) {
        case 'Terran':      return 0x5a3a1a;
        case 'Continental': return 0x4a3a2a;
        case 'Ocean':       return 0x1a3a5a;
        case 'Barren':      return 0x3a3a3a;
        case 'Molten':      return 0x1a0800;
        case 'Ice':         return 0x2a5a7a;
        case 'Arctic':      return 0x2a4a6a;
        case 'Desert':      return 0x6a3a1a;
        case 'Tomb':        return 0x1a1a12;
        default:            return 0x3a3a3a;
    }
}

// -- Helpers ------------------------------------------------------------------
function mat(color, emissive, emissiveIntensity, transparent, opacity, roughness) {
    if (isMobileDevice) {
        return new THREE.MeshLambertMaterial({
            color, emissive: emissive || 0x000000, emissiveIntensity: emissiveIntensity || 0,
            transparent: !!transparent, opacity: opacity !== undefined ? opacity : 1,
        });
    }
    return new THREE.MeshStandardMaterial({
        color, emissive: emissive || 0x000000, emissiveIntensity: emissiveIntensity || 0,
        transparent: !!transparent, opacity: opacity !== undefined ? opacity : 1,
        roughness: roughness !== undefined ? roughness : 0.8,
    });
}

// -- Vegetation configs per planet type ---------------------------------------
export function getVegetationConfig(type) {
    switch (type) {
        case 'Terran':
        case 'Continental':
            return {
                hasVeg: true,
                treeColor: 0x2d5a1b, trunkColor: 0x5c3a1e,
                treeColor2: 0x3a6e28, trunkColor2: 0x6b4422,   // oak/round tree
                treeColor3: 0x4a8832, trunkColor3: 0xd4c8a0,   // birch/tall tree
                bushColor: 0x3a7a22, flowerColor: 0xffdd44,
                wildflowerColors: [0xdd4466, 0xffaa22, 0xeedd55, 0xcc77dd],
                alienPlantColor: 0x8b44cc, alienGlow: 0x6600ff,
            };
        case 'Ocean':
            return {
                hasVeg: true,
                treeColor: 0x1a6644, trunkColor: 0x0d3322,
                bushColor: 0x22aa66, flowerColor: 0x00ffcc,
                alienPlantColor: 0x0088ff, alienGlow: 0x0044cc,
            };
        case 'Desert':
            return {
                hasVeg: true,
                treeColor: 0x8a7a22, trunkColor: 0x6a5a1a,
                bushColor: 0xaa8833, flowerColor: 0xff6600,
                alienPlantColor: 0xcc4400, alienGlow: 0xff2200,
            };
        case 'Ice':
        case 'Arctic':
            return {
                hasVeg: true,
                treeColor: 0x88aacc, trunkColor: 0x445566,
                bushColor: 0x99bbdd, flowerColor: 0xaaddff,
                alienPlantColor: 0x44ccff, alienGlow: 0x0088ff,
            };
        case 'Barren':
            return {
                hasVeg: true, sparse: true,
                treeColor: 0x5a5040, trunkColor: 0x3a3020,
                bushColor: 0x6a6050, flowerColor: 0x8a7a60,
                alienPlantColor: 0x887755, alienGlow: 0x554422,
            };
        case 'Molten':
            return {
                hasVeg: true, sparse: true,
                treeColor: 0xcc4400, trunkColor: 0x551a00,
                bushColor: 0xaa3300, flowerColor: 0xff6600,
                alienPlantColor: 0xff4400, alienGlow: 0xff2200,
            };
        case 'Tomb':
            return {
                hasVeg: true, sparse: true,
                treeColor: 0x2a3318, trunkColor: 0x1a1a10,
                bushColor: 0x333a22, flowerColor: 0x445530,
                alienPlantColor: 0x33aa22, alienGlow: 0x22ff00,
            };
        default:
            return { hasVeg: false };
    }
}

// -- Build a tree mesh --------------------------------------------------------
export function makeTree(treeColor, trunkColor, scale) {
    const g = new THREE.Group();
    const trunkH = 3 * scale;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25 * scale, 0.4 * scale, trunkH, 6),
        mat(trunkColor, 0, 0, false, 1, 0.95)
    );
    trunk.position.y = trunkH * 0.5;
    trunk.castShadow = true;
    g.add(trunk);

    // 3 layered canopy cones
    const canopyMat = mat(treeColor, 0, 0, false, 1, 0.85);
    [0, 1, 2].forEach(i => {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry((1.8 - i * 0.4) * scale, (2.2 - i * 0.3) * scale, 7),
            canopyMat
        );
        cone.position.y = trunkH + i * 1.2 * scale;
        cone.castShadow = true;
        g.add(cone);
    });
    return g;
}

// -- Build a bush mesh --------------------------------------------------------
export function makeBush(color, scale) {
    const g = new THREE.Group();
    const bushMat = mat(color, 0, 0, false, 1, 0.9);
    const positions = [[0,0,0],[0.6,0,0.3],[-0.5,0,0.4],[0.2,0,-0.5],[0,0.3,0]];
    positions.forEach(([x, y, z]) => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry((0.6 + Math.random() * 0.4) * scale, 6, 6),
            bushMat
        );
        sphere.position.set(x * scale, y * scale + 0.5 * scale, z * scale);
        sphere.castShadow = true;
        g.add(sphere);
    });
    return g;
}

// -- Build a round-canopy tree (oak / deciduous) -----------------------------
export function makeTreeRound(treeColor, trunkColor, scale) {
    const g = new THREE.Group();
    const trunkH = 2.5 * scale;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, trunkH, 6),
        mat(trunkColor, 0, 0, false, 1, 0.95)
    );
    trunk.position.y = trunkH * 0.5;
    trunk.castShadow = true;
    g.add(trunk);

    // Round canopy — 3 overlapping spheres for organic shape
    const canopyMat = mat(treeColor, 0, 0, false, 1, 0.85);
    const offsets = [
        [0, trunkH + 1.2 * scale, 0, 1.6],
        [0.6 * scale, trunkH + 0.8 * scale, 0.4 * scale, 1.1],
        [-0.5 * scale, trunkH + 0.6 * scale, -0.3 * scale, 1.2],
    ];
    offsets.forEach(([ox, oy, oz, r]) => {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(r * scale, 7, 6),
            canopyMat
        );
        sphere.position.set(ox, oy, oz);
        sphere.castShadow = true;
        g.add(sphere);
    });
    return g;
}

// -- Build a tall thin tree (birch / poplar) ---------------------------------
export function makeTreeTall(treeColor, trunkColor, scale) {
    const g = new THREE.Group();
    const trunkH = 5 * scale;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, trunkH, 5),
        mat(trunkColor, 0, 0, false, 1, 0.9)
    );
    trunk.position.y = trunkH * 0.5;
    trunk.castShadow = true;
    g.add(trunk);

    // Small clustered leaf puffs along upper trunk
    const leafMat = mat(treeColor, 0, 0, false, 1, 0.85);
    for (let i = 0; i < 4; i++) {
        const py = trunkH * 0.5 + (i * 1.1 + 0.5) * scale;
        const pr = (0.5 + Math.random() * 0.3) * scale;
        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(pr, 6, 5),
            leafMat
        );
        leaf.scale.set(1, 0.7, 1);
        leaf.position.set(
            (Math.random() - 0.5) * 0.4 * scale,
            py,
            (Math.random() - 0.5) * 0.4 * scale
        );
        leaf.castShadow = true;
        g.add(leaf);
    }
    return g;
}

// -- Build a wildflower cluster (natural replacement for alien plants) --------
export function makeWildflower(colors, scale) {
    const g = new THREE.Group();
    const stemMat = mat(0x2a6618, 0, 0, false, 1, 0.85);
    const flowerCount = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < flowerCount; i++) {
        const h = (1.2 + Math.random() * 1.8) * scale;
        // Stem
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03 * scale, 0.05 * scale, h, 4),
            stemMat
        );
        const ox = (Math.random() - 0.5) * 1.0 * scale;
        const oz = (Math.random() - 0.5) * 1.0 * scale;
        stem.position.set(ox, h * 0.5, oz);
        stem.rotation.x = (Math.random() - 0.5) * 0.2;
        stem.rotation.z = (Math.random() - 0.5) * 0.2;
        g.add(stem);

        // Flower head
        const col = colors[Math.floor(Math.random() * colors.length)];
        const flower = new THREE.Mesh(
            new THREE.SphereGeometry((0.15 + Math.random() * 0.15) * scale, 6, 5),
            mat(col, col, 0.15, false, 1, 0.6)
        );
        flower.scale.set(1, 0.6, 1);
        flower.position.set(ox, h + 0.1 * scale, oz);
        g.add(flower);
    }

    // Low leaf cluster at base
    const baseMat = mat(0x2d6a1a, 0, 0, false, 1, 0.85);
    for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.35 * scale, 5, 4),
            baseMat
        );
        leaf.scale.set(1.2, 0.4, 0.8);
        leaf.position.set(
            (Math.random() - 0.5) * 0.6 * scale,
            0.15 * scale,
            (Math.random() - 0.5) * 0.6 * scale
        );
        leaf.rotation.y = Math.random() * Math.PI;
        g.add(leaf);
    }
    return g;
}

// -- Build an alien plant (tall glowing stalk with orb top) -------------------
export function makeAlienPlant(color, glowColor, scale) {
    const g = new THREE.Group();
    // Stalk
    const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 4 * scale, 5),
        mat(color, glowColor, 0.4, false, 1, 0.7)
    );
    stalk.position.y = 2 * scale;
    stalk.castShadow = true;
    g.add(stalk);

    // Glowing orb top
    const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 * scale, 8, 8),
        mat(color, glowColor, 1.2, true, 0.85, 0.3)
    );
    orb.position.y = 4.2 * scale;
    g.add(orb);

    // Leaf fronds
    for (let i = 0; i < 4; i++) {
        const frond = new THREE.Mesh(
            new THREE.ConeGeometry(0.3 * scale, 1.5 * scale, 4),
            mat(color, glowColor, 0.3, false, 1, 0.8)
        );
        frond.position.set(
            Math.cos(i * Math.PI * 0.5) * 0.8 * scale,
            2.5 * scale,
            Math.sin(i * Math.PI * 0.5) * 0.8 * scale
        );
        frond.rotation.z = 0.6;
        frond.rotation.y = i * Math.PI * 0.5;
        g.add(frond);
    }

    if (!isMobileDevice) {
        const light = new THREE.PointLight(glowColor, 1.5, 10 * scale);
        light.position.y = 4.2 * scale;
        g.add(light);
    }
    return g;
}

// -- Temp objects for matrix composition (reused to avoid GC pressure) --------
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _matrix = new THREE.Matrix4();

// -- Props (rocks + crystals) via InstancedMesh batching ----------------------
// ── Ambient prop factories (campfire, beacon, light post, boulder) ─────────

function _makeCampfire(scale = 1) {
    const g = new THREE.Group();
    const s = scale;
    const logMat = mat(0x4a3020, 0, 0, false, 1, 0.9);
    for (let i = 0; i < 6; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.15 * s, 1.2 * s, 5), logMat);
        const a = (i / 6) * Math.PI * 2;
        log.position.set(Math.cos(a) * 0.6 * s, 0.15 * s, Math.sin(a) * 0.6 * s);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = a;
        g.add(log);
    }
    // Outer flame (animated via flicker)
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35 * s, 1.2 * s, 6), fireMat);
    fire.position.y = 0.6 * s;
    fire.userData.isFlicker = true;
    g.add(fire);
    // Inner bright flame
    const inner = new THREE.Mesh(
        new THREE.ConeGeometry(0.2 * s, 0.8 * s, 5),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.95 })
    );
    inner.position.y = 0.5 * s;
    inner.userData.isFlicker = true;
    g.add(inner);
    // Glow sprite for soft light bloom
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff8833, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glowSprite.scale.set(3 * s, 3 * s, 1);
    glowSprite.position.y = 0.6 * s;
    g.add(glowSprite);
    // Point light (skipped on mobile for perf)
    if (!isMobileDevice) {
        const light = new THREE.PointLight(0xff6622, 3, 18 * s);
        light.position.y = 0.8 * s;
        g.add(light);
    }
    return g;
}

function _makeBeacon(scale = 1) {
    const g = new THREE.Group();
    const s = scale;
    // Base
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8 * s, 1 * s, 0.5 * s, 8),
        mat(0x444455, 0, 0, false, 1, 0.4)
    );
    base.position.y = 0.25 * s;
    g.add(base);
    // Pole
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 4 * s, 6),
        mat(0x666677, 0, 0, false, 1, 0.3)
    );
    pole.position.y = 2.5 * s;
    g.add(pole);
    // Top dish
    const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(0x88aacc, 0, 0, false, 1, 0.4)
    );
    dish.position.y = 4.5 * s;
    dish.rotation.x = Math.PI;
    g.add(dish);
    // Pulsing beacon bulb
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 * s, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    bulb.position.y = 4.7 * s;
    bulb.userData.isPulse = true;
    g.add(bulb);
    // Glow sprite
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0x00ff88, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glowSprite.scale.set(1.5 * s, 1.5 * s, 1);
    glowSprite.position.y = 4.7 * s;
    glowSprite.userData.isPulse = true;
    g.add(glowSprite);
    if (!isMobileDevice) {
        const light = new THREE.PointLight(0x00ff88, 1.5, 14 * s);
        light.position.y = 4.7 * s;
        g.add(light);
    }
    return g;
}

function _makeLightPost(scale = 1) {
    const g = new THREE.Group();
    const s = scale;
    const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 2 * s, 6),
        mat(0x555555, 0, 0, false, 1, 0.4)
    );
    post.position.y = 1 * s;
    g.add(post);
    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.32 * s, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffcc })
    );
    bulb.position.y = 2 * s;
    g.add(bulb);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xffffaa, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glowSprite.scale.set(2.2 * s, 2.2 * s, 1);
    glowSprite.position.y = 2 * s;
    g.add(glowSprite);
    if (!isMobileDevice) {
        const light = new THREE.PointLight(0xffffcc, 1.8, 12 * s);
        light.position.y = 2.1 * s;
        g.add(light);
    }
    return g;
}

function _makeBoulder(color, scale = 1) {
    const g = new THREE.Group();
    const baseGeo = new THREE.DodecahedronGeometry(scale * 1.6, 1);
    const m = mat(color, 0, 0, false, 1, 0.95);
    const main = new THREE.Mesh(baseGeo, m);
    main.castShadow = !isMobileDevice;
    main.scale.set(1, 0.7, 1.1);
    g.add(main);
    // Smaller cluster rock
    const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(scale * 0.7, 0), m);
    sub.position.set(scale * 1.3, scale * 0.2, scale * 0.4);
    sub.scale.set(1, 0.6, 1);
    g.add(sub);
    return g;
}

/**
 * Choose ambient elements appropriate for a planet type.
 * Returns counts: { campfires, beacons, lightPosts, hives, boulders }
 */
function _getAmbientCounts(planetType) {
    const desktop = !isMobileDevice;
    switch (planetType) {
        case 'Terran':
        case 'Continental':
            return { campfires: desktop ? 2 : 1, beacons: 1, lightPosts: 0, hives: 0, boulders: desktop ? 6 : 3 };
        case 'Desert':
            return { campfires: desktop ? 3 : 1, beacons: desktop ? 2 : 1, lightPosts: 0, hives: 0, boulders: desktop ? 8 : 4 };
        case 'Ice':
        case 'Arctic':
            return { campfires: 0, beacons: desktop ? 2 : 1, lightPosts: desktop ? 3 : 1, hives: 0, boulders: desktop ? 5 : 3 };
        case 'Barren':
            return { campfires: 0, beacons: desktop ? 3 : 1, lightPosts: desktop ? 2 : 1, hives: desktop ? 1 : 0, boulders: desktop ? 10 : 5 };
        case 'Tomb':
            return { campfires: 0, beacons: desktop ? 1 : 0, lightPosts: 0, hives: desktop ? 2 : 1, boulders: desktop ? 6 : 3 };
        case 'Molten':
            return { campfires: 0, beacons: desktop ? 1 : 0, lightPosts: 0, hives: desktop ? 1 : 0, boulders: desktop ? 8 : 4 };
        case 'Ocean':
            return { campfires: 0, beacons: desktop ? 2 : 1, lightPosts: desktop ? 1 : 0, hives: 0, boulders: desktop ? 4 : 2 };
        default:
            return { campfires: 0, beacons: desktop ? 1 : 0, lightPosts: 0, hives: 0, boulders: desktop ? 4 : 2 };
    }
}

export function createPlanetProps(planetType, group, heightFn) {
    const props = [];
    const propColor = getPropColor(planetType);
    const propMat = mat(propColor, 0, 0, false, 1, 0.9);
    const crystalMat = mat(0x00f2ff, 0x0044aa, 0.5, true, 0.8, 0.2);

    // Lake exclusion — no rocks/vegetation inside lakes
    const lakeDefs = _generateLakePositions(planetType);
    const _insideLake = (px, pz) => {
        for (const lk of lakeDefs) {
            const dx = px - lk.x, dz = pz - lk.z;
            if (dx * dx + dz * dz < (lk.radius + 3) * (lk.radius + 3)) return true;
        }
        return false;
    };

    const propCount = isMobileDevice ? 80 : 150;
    const propGeo   = new THREE.DodecahedronGeometry(1, 0);
    const crystalGeo = new THREE.ConeGeometry(0.5, 3, 4);

    // ---- Pass 1: generate all prop data and count rocks vs crystals ----------
    const propData = [];
    let rockCount = 0;
    let crystalCount = 0;

    for (let i = 0; i < propCount; i++) {
        const r = 30 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        if (_insideLake(x, z)) continue;
        const yBase = heightFn(x, z);

        const isCrystal = Math.random() > 0.9;
        const scale = 0.5 + Math.random() * (isCrystal ? 1.5 : 3);
        const halfHeight = isCrystal ? (3 * scale) / 2 : (1 * scale) / 2;
        const meshY = yBase + (isCrystal ? 1.2 * scale : 0.25 * scale);

        const rotX = Math.random() * 0.2;
        const rotY = Math.random() * Math.PI;
        const rotZ = Math.random() * 0.2;

        if (isCrystal) {
            crystalCount++;
        } else {
            rockCount++;
        }

        propData.push({ x, z, meshY, scale, rotX, rotY, rotZ, isCrystal, halfHeight });
    }

    // ---- Pass 2: build InstancedMesh for rocks ------------------------------
    const rockInstancedMesh = new THREE.InstancedMesh(propGeo, propMat, rockCount);
    rockInstancedMesh.castShadow = true;
    rockInstancedMesh.receiveShadow = true;

    // ---- Pass 2b: build InstancedMesh for crystals --------------------------
    const crystalInstancedMesh = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
    crystalInstancedMesh.castShadow = true;
    crystalInstancedMesh.receiveShadow = true;

    let rockIdx = 0;
    let crystalIdx = 0;

    for (let i = 0; i < propData.length; i++) {
        const d = propData[i];

        _position.set(d.x, d.meshY, d.z);
        _euler.set(d.rotX, d.rotY, d.rotZ);
        _quaternion.setFromEuler(_euler);
        _scale.set(d.scale, d.scale, d.scale);
        _matrix.compose(_position, _quaternion, _scale);

        if (d.isCrystal) {
            crystalInstancedMesh.setMatrixAt(crystalIdx, _matrix);
            crystalIdx++;

            // Crystal point lights (desktop only, kept as individual lights)
            if (!isMobileDevice) {
                const light = new THREE.PointLight(0x00f2ff, 2, 8);
                light.position.set(d.x, d.meshY - 1, d.z);
                group.add(light);
            }
        } else {
            rockInstancedMesh.setMatrixAt(rockIdx, _matrix);
            rockIdx++;
        }

        // Collision data — same format as before
        props.push({
            x: d.x,
            z: d.z,
            r: (d.isCrystal ? 1 : 1.5) * d.scale,
            topY: d.meshY + d.halfHeight
        });
    }

    // Mark instance attribute buffers as needing upload
    rockInstancedMesh.instanceMatrix.needsUpdate = true;
    crystalInstancedMesh.instanceMatrix.needsUpdate = true;

    group.add(rockInstancedMesh);
    group.add(crystalInstancedMesh);

    // ---- Vegetation -----------------------------------------------------------
    const vegCfg = getVegetationConfig(planetType);
    if (vegCfg.hasVeg) {
        const baseCount = isMobileDevice ? 60 : 160;
        const vegCount = vegCfg.sparse ? Math.round(baseCount * 0.3) : baseCount;
        const hasNaturalVeg = !!vegCfg.wildflowerColors; // Terran/Continental
        for (let i = 0; i < vegCount; i++) {
            const r = 20 + Math.random() * 280;
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            if (_insideLake(x, z)) continue;
            const yBase = heightFn(x, z);
            const roll = Math.random();
            const scale = 0.5 + Math.random() * 0.8;
            let vegMesh;

            if (hasNaturalVeg) {
                // Terran/Continental: 3 tree types + bushes + wildflowers (no alien plants)
                if (roll < 0.18) {
                    vegMesh = makeTree(vegCfg.treeColor, vegCfg.trunkColor, scale);
                } else if (roll < 0.36) {
                    vegMesh = makeTreeRound(vegCfg.treeColor2, vegCfg.trunkColor2, scale);
                } else if (roll < 0.50) {
                    vegMesh = makeTreeTall(vegCfg.treeColor3, vegCfg.trunkColor3, scale);
                } else if (roll < 0.72) {
                    vegMesh = makeBush(vegCfg.bushColor, scale);
                } else {
                    vegMesh = makeWildflower(vegCfg.wildflowerColors, scale);
                }
            } else {
                // Other planet types: original distribution with alien plants
                if (roll < 0.35) {
                    vegMesh = makeTree(vegCfg.treeColor, vegCfg.trunkColor, scale);
                } else if (roll < 0.65) {
                    vegMesh = makeBush(vegCfg.bushColor, scale);
                } else {
                    vegMesh = makeAlienPlant(vegCfg.alienPlantColor, vegCfg.alienGlow, scale);
                }
            }

            vegMesh.position.set(x, yBase, z);
            vegMesh.rotation.y = Math.random() * Math.PI * 2;
            // Tag for wind sway animation
            vegMesh.userData.isVegetation = true;
            vegMesh.userData.swayPhase = Math.random() * Math.PI * 2;
            vegMesh.userData.swayScale = scale;
            vegMesh.userData.baseRotX = 0;
            vegMesh.userData.baseRotZ = 0;
            group.add(vegMesh);
            props.push({ x, z, r: 1.5 * scale, topY: yBase + 4 * scale });
        }
    }

    // ── Ambient props: campfires, beacons, light posts, alien hives, boulders ──
    const amb = _getAmbientCounts(planetType);

    // Helper: place a single object at a random valid (non-lake, non-center) location
    const _placeAmbient = (mesh, minR, maxR, collisionR, topYOffset) => {
        let attempts = 0;
        while (attempts < 12) {
            const r = minR + Math.random() * (maxR - minR);
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            if (!_insideLake(x, z)) {
                const y = heightFn(x, z);
                mesh.position.set(x, y, z);
                mesh.rotation.y = Math.random() * Math.PI * 2;
                group.add(mesh);
                props.push({ x, z, r: collisionR, topY: y + topYOffset });
                return true;
            }
            attempts++;
        }
        return false;
    };

    // Campfires (warm, mostly outside the colony zone)
    for (let i = 0; i < amb.campfires; i++) {
        _placeAmbient(_makeCampfire(0.9 + Math.random() * 0.4), 50, 280, 1.2, 1.8);
    }
    // Beacons (tall, scattered widely)
    for (let i = 0; i < amb.beacons; i++) {
        _placeAmbient(_makeBeacon(0.8 + Math.random() * 0.4), 60, 290, 1.0, 5);
    }
    // Light posts (lit pathways for dark planets)
    for (let i = 0; i < amb.lightPosts; i++) {
        _placeAmbient(_makeLightPost(0.9 + Math.random() * 0.3), 45, 250, 0.5, 2.2);
    }
    // Alien hives (rare, large, far from colony)
    for (let i = 0; i < amb.hives; i++) {
        const hive = _buildAlienHiveMesh();
        const hiveScale = 0.6 + Math.random() * 0.3;
        hive.scale.setScalar(hiveScale);
        _placeAmbient(hive, 120, 320, 6 * hiveScale, 4 * hiveScale);
    }
    // Boulders (scattered terrain detail)
    for (let i = 0; i < amb.boulders; i++) {
        const bScale = 0.8 + Math.random() * 0.7;
        _placeAmbient(_makeBoulder(propColor, bScale), 35, 320, 2 * bScale, 1.2 * bScale);
    }

    return props;
}

// -- Alien species definitions ------------------------------------------------
function getSpeciesConfigs(planetType) {
    // Species A — large armored grazer (6 legs, heavy, slow)
    const speciesA = {
        bodyColor:   0x44aa66,
        bellyColor:  0x66cc88,
        legColor:    0x226644,
        carapaceColor: 0x337755,
        eyeColor:    0xffff00,
        eyeGlow:     0xaaaa00,
        markingColor: 0x22ff88,
        markingGlow:  0x11aa55,
        bodyScale:   1.6,
        legCount:    6,
        speed:       0.15,
        roamRadius:  18,
        bobHeight:   0.3,
        count:       isMobileDevice ? 3 : 6,
        hasTail:     true,
        hasAntennae: true,
        hasSpines:   true,
        hasMandibles: true,
    };
    // Species B — agile predator (4 legs, fast, sleek)
    const speciesB = {
        bodyColor:   0xcc4422,
        bellyColor:  0xdd7744,
        legColor:    0x882211,
        carapaceColor: 0xaa3318,
        eyeColor:    0x00ffff,
        eyeGlow:     0x008888,
        markingColor: 0xff4400,
        markingGlow:  0xcc2200,
        bodyScale:   0.8,
        legCount:    4,
        speed:       0.55,
        roamRadius:  30,
        bobHeight:   0.6,
        count:       isMobileDevice ? 4 : 8,
        hasTail:     false,
        hasAntennae: true,
        hasSpines:   false,
        hasMandibles: true,
    };

    // Adjust colors per planet type
    switch (planetType) {
        case 'Ice': case 'Arctic':
            speciesA.bodyColor = 0xaaddff; speciesA.bellyColor = 0xcceeff;
            speciesA.legColor = 0x6699bb; speciesA.carapaceColor = 0x88bbdd;
            speciesA.markingColor = 0x44ddff; speciesA.markingGlow = 0x22aacc;
            speciesB.bodyColor = 0x88ccff; speciesB.bellyColor = 0xaaddff;
            speciesB.legColor = 0x4488aa; speciesB.carapaceColor = 0x66aacc;
            speciesB.markingColor = 0x00ccff; speciesB.markingGlow = 0x0088aa;
            break;
        case 'Desert':
            speciesA.bodyColor = 0xcc8833; speciesA.bellyColor = 0xddaa55;
            speciesA.legColor = 0x885522; speciesA.carapaceColor = 0xaa7728;
            speciesA.markingColor = 0xffcc44; speciesA.markingGlow = 0xccaa22;
            speciesB.bodyColor = 0xdd6622; speciesB.bellyColor = 0xee8844;
            speciesB.legColor = 0x993311; speciesB.carapaceColor = 0xbb5518;
            speciesB.markingColor = 0xff8800; speciesB.markingGlow = 0xcc6600;
            break;
        case 'Ocean':
            speciesA.bodyColor = 0x2288aa; speciesA.bellyColor = 0x44aacc;
            speciesA.legColor = 0x115566; speciesA.carapaceColor = 0x1a7799;
            speciesA.markingColor = 0x00eeff; speciesA.markingGlow = 0x00aabb;
            speciesB.bodyColor = 0x44bbcc; speciesB.bellyColor = 0x66ddee;
            speciesB.legColor = 0x227788; speciesB.carapaceColor = 0x33aabb;
            speciesB.markingColor = 0x44ffff; speciesB.markingGlow = 0x22cccc;
            break;
        case 'Molten':
            speciesA.bodyColor = 0x882200; speciesA.bellyColor = 0xaa4400;
            speciesA.legColor = 0x441100; speciesA.carapaceColor = 0x661800;
            speciesA.eyeColor = 0xff4400; speciesA.eyeGlow = 0xff2200;
            speciesA.markingColor = 0xff6600; speciesA.markingGlow = 0xff4400;
            speciesB.bodyColor = 0xcc3300; speciesB.bellyColor = 0xee5500;
            speciesB.legColor = 0x661100; speciesB.carapaceColor = 0xaa2800;
            speciesB.eyeColor = 0xffaa00; speciesB.eyeGlow = 0xff6600;
            speciesB.markingColor = 0xffaa00; speciesB.markingGlow = 0xff8800;
            break;
    }
    return [speciesA, speciesB];
}

export function buildCreatureMesh(cfg) {
    const g = new THREE.Group();
    const s = cfg.bodyScale;
    const seg = isMobileDevice ? 6 : 10; // geometry detail
    const joints = {}; // store animatable joints

    const bodyMat     = mat(cfg.bodyColor, 0, 0, false, 1, 0.55);
    const bellyMat    = mat(cfg.bellyColor, 0, 0, false, 1, 0.65);
    const carapaceMat = mat(cfg.carapaceColor, 0, 0, false, 1, 0.35);
    const legMat      = mat(cfg.legColor, 0, 0, false, 1, 0.6);
    const eyeMat      = mat(cfg.eyeColor, cfg.eyeGlow, 1.5, false, 1, 0.1);
    const markMat     = mat(cfg.markingColor, cfg.markingGlow, 0.8, true, 0.7, 0.3);

    // ── Thorax (rear body segment) ──
    const thorax = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.85, seg, seg),
        bodyMat
    );
    thorax.scale.set(1, 0.6, 1.3);
    thorax.position.set(0, 0, -s * 0.5);
    thorax.castShadow = true;
    g.add(thorax);

    // Thorax bioluminescent stripe
    if (!isMobileDevice) {
        const thoraxStripe = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.87, seg, seg),
            markMat
        );
        thoraxStripe.scale.set(0.3, 0.62, 1.0);
        thoraxStripe.position.copy(thorax.position);
        g.add(thoraxStripe);
    }

    // ── Abdomen (front body segment) ──
    const abdomen = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.7, seg, seg),
        bodyMat
    );
    abdomen.scale.set(0.9, 0.65, 1.0);
    abdomen.position.set(0, s * 0.05, s * 0.4);
    abdomen.castShadow = true;
    g.add(abdomen);

    // Belly (lighter underbelly)
    const belly = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.6, seg, seg),
        bellyMat
    );
    belly.scale.set(0.75, 0.4, 0.9);
    belly.position.set(0, -s * 0.2, s * 0.1);
    g.add(belly);

    // ── Carapace (dorsal armor plates) ──
    const plateCount = cfg.legCount === 6 ? 4 : 2;
    for (let i = 0; i < plateCount; i++) {
        const pz = s * (-0.7 + i * 0.5);
        const plate = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.35, seg, 4),
            carapaceMat
        );
        plate.scale.set(1.4, 0.3, 0.8);
        plate.position.set(0, s * 0.35 + i * s * 0.02, pz);
        g.add(plate);
    }

    // ── Spines along back (species A) ──
    if (cfg.hasSpines && !isMobileDevice) {
        for (let i = 0; i < 5; i++) {
            const spine = new THREE.Mesh(
                new THREE.ConeGeometry(s * 0.06, s * 0.4, 4),
                carapaceMat
            );
            spine.position.set(0, s * 0.55, s * (-0.8 + i * 0.35));
            spine.rotation.x = -0.2;
            g.add(spine);
        }
    }

    // ── Head group (pivots for look animation) ──
    const headGroup = new THREE.Group();
    headGroup.position.set(0, s * 0.15, s * 0.95);
    g.add(headGroup);
    joints.head = headGroup;

    // Neck
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(s * 0.2, s * 0.28, s * 0.3, seg),
        bodyMat
    );
    neck.position.set(0, s * 0.05, s * 0.1);
    neck.rotation.x = 0.4;
    headGroup.add(neck);

    // Cranium
    const cranium = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.42, seg, seg),
        bodyMat
    );
    cranium.scale.set(1.0, 0.8, 1.1);
    cranium.position.set(0, s * 0.15, s * 0.35);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Head crest / ridge
    const crest = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.25, seg, 4),
        carapaceMat
    );
    crest.scale.set(0.5, 0.4, 1.0);
    crest.position.set(0, s * 0.32, s * 0.25);
    headGroup.add(crest);

    // Eyes (larger, more prominent, with pupils)
    [-0.2, 0.2].forEach(side => {
        const eyeSocket = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.1, 6, 6),
            mat(0x111111, 0, 0, false, 1, 0.9)
        );
        eyeSocket.position.set(side * s, s * 0.25, s * 0.6);
        headGroup.add(eyeSocket);

        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.09, 6, 6),
            eyeMat
        );
        eye.position.set(side * s, s * 0.25, s * 0.64);
        headGroup.add(eye);
    });

    // ── Mandibles (jaw pincers) ──
    if (cfg.hasMandibles) {
        const mandibleL = new THREE.Group();
        mandibleL.position.set(-s * 0.15, s * 0.0, s * 0.7);
        headGroup.add(mandibleL);
        const mandibleR = new THREE.Group();
        mandibleR.position.set(s * 0.15, s * 0.0, s * 0.7);
        headGroup.add(mandibleR);
        joints.mandibleL = mandibleL;
        joints.mandibleR = mandibleR;

        [-1, 1].forEach((side, i) => {
            const parent = i === 0 ? mandibleL : mandibleR;
            const jaw = new THREE.Mesh(
                new THREE.ConeGeometry(s * 0.06, s * 0.35, 4),
                legMat
            );
            jaw.position.set(0, -s * 0.05, s * 0.12);
            jaw.rotation.x = 1.2;
            jaw.rotation.z = side * 0.3;
            parent.add(jaw);
        });
    }

    // ── Antennae ──
    if (cfg.hasAntennae) {
        const antennaeL = new THREE.Group();
        antennaeL.position.set(-s * 0.12, s * 0.35, s * 0.5);
        headGroup.add(antennaeL);
        const antennaeR = new THREE.Group();
        antennaeR.position.set(s * 0.12, s * 0.35, s * 0.5);
        headGroup.add(antennaeR);
        joints.antennaeL = antennaeL;
        joints.antennaeR = antennaeR;

        [-1, 1].forEach((side, i) => {
            const parent = i === 0 ? antennaeL : antennaeR;
            // Base segment
            const seg1 = new THREE.Mesh(
                new THREE.CylinderGeometry(s * 0.02, s * 0.025, s * 0.4, 4),
                legMat
            );
            seg1.position.set(0, s * 0.2, s * 0.05);
            seg1.rotation.x = -0.6;
            seg1.rotation.z = side * 0.3;
            parent.add(seg1);
            // Tip (glowing)
            const tip = new THREE.Mesh(
                new THREE.SphereGeometry(s * 0.04, 5, 5),
                markMat
            );
            tip.position.set(0, s * 0.42, s * 0.15);
            parent.add(tip);
        });
    }

    // ── Jointed legs (hip group → upper leg → knee group → lower leg → foot) ──
    const legJoints = [];
    for (let j = 0; j < cfg.legCount; j++) {
        // Distribute legs along the body — keep within thorax/abdomen bounds
        const frac = (j / (cfg.legCount - 1)) - 0.5; // -0.5 to 0.5
        const side = j % 2 === 0 ? -1 : 1;
        const zPos = frac * s * 1.4 - s * 0.1; // tighter spread, shifted slightly rearward
        // Body tapers toward front — narrow the hip attachment for front legs
        const taper = 1.0 - Math.max(0, frac) * 0.35;
        const xPos = side * s * 0.65 * taper;

        // Hip pivot
        const hipGroup = new THREE.Group();
        hipGroup.position.set(xPos, -s * 0.15, zPos);
        g.add(hipGroup);

        // Hip socket — visually connects leg to body
        const hipSocket = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.12, 5, 5),
            bodyMat
        );
        hipSocket.scale.set(1.0, 0.7, 0.8);
        hipGroup.add(hipSocket);

        // Upper leg (thigh)
        const upperLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.09, s * 0.07, s * 0.65, isMobileDevice ? 4 : 6),
            legMat
        );
        upperLeg.position.set(side * s * 0.25, -s * 0.15, 0);
        upperLeg.rotation.z = side * 0.5;
        hipGroup.add(upperLeg);

        // Joint bulge at connection
        const jointBulge = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.08, 5, 5),
            carapaceMat
        );
        jointBulge.position.set(side * s * 0.45, -s * 0.35, 0);
        hipGroup.add(jointBulge);

        // Knee pivot
        const kneeGroup = new THREE.Group();
        kneeGroup.position.set(side * s * 0.45, -s * 0.35, 0);
        hipGroup.add(kneeGroup);

        // Lower leg (shin)
        const lowerLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.06, s * 0.04, s * 0.55, isMobileDevice ? 4 : 6),
            legMat
        );
        lowerLeg.position.set(side * s * 0.1, -s * 0.3, 0);
        lowerLeg.rotation.z = side * 0.3;
        kneeGroup.add(lowerLeg);

        // Foot pad
        const foot = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.06, 5, 4),
            carapaceMat
        );
        foot.scale.set(1, 0.4, 1.3);
        foot.position.set(side * s * 0.15, -s * 0.58, 0);
        kneeGroup.add(foot);

        legJoints.push({ hip: hipGroup, knee: kneeGroup, side });
    }
    joints.legs = legJoints;

    // ── Tail (species A — segmented, flexible) ──
    if (cfg.hasTail) {
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, s * 0.05, -s * 1.2);
        g.add(tailGroup);
        joints.tail = tailGroup;

        const tailSegs = isMobileDevice ? 3 : 5;
        for (let i = 0; i < tailSegs; i++) {
            const tRadius = s * (0.2 - i * 0.03);
            const seg = new THREE.Mesh(
                new THREE.SphereGeometry(Math.max(tRadius, s * 0.05), 5, 5),
                i % 2 === 0 ? bodyMat : carapaceMat
            );
            seg.scale.set(1, 0.6, 1);
            seg.position.set(0, -i * s * 0.06, -i * s * 0.3);
            tailGroup.add(seg);
        }
        // Tail tip glow
        const tailTip = new THREE.Mesh(
            new THREE.SphereGeometry(s * 0.06, 5, 5),
            markMat
        );
        tailTip.position.set(0, -tailSegs * s * 0.06, -tailSegs * s * 0.3);
        tailGroup.add(tailTip);
    }

    // ── Bioluminescent body markings (side dots) ──
    if (!isMobileDevice) {
        const dotCount = cfg.legCount === 6 ? 4 : 3;
        for (let i = 0; i < dotCount; i++) {
            [-1, 1].forEach(side => {
                const dot = new THREE.Mesh(
                    new THREE.SphereGeometry(s * 0.05, 4, 4),
                    markMat
                );
                dot.position.set(
                    side * s * 0.65,
                    s * 0.05,
                    s * (-0.5 + i * 0.4)
                );
                g.add(dot);
            });
        }
    }

    g.userData.joints = joints;
    return g;
}

// -- Public: create creatures (2 species) -------------------------------------
export function createCreatures(type, group, heightFn) {
    if (['Barren', 'Tomb'].includes(type)) return [];
    const creatures = [];
    const speciesConfigs = getSpeciesConfigs(type);

    speciesConfigs.forEach((cfg, speciesIdx) => {
        for (let i = 0; i < cfg.count; i++) {
            const creature = buildCreatureMesh(cfg);
            const r = 40 + Math.random() * 120;
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            const y = heightFn(x, z) + cfg.bodyScale * 0.9;

            creature.position.set(x, y, z);
            creature.rotation.y = Math.random() * Math.PI * 2;

            // Preserve joints from buildCreatureMesh, merge with movement data
            const jointRefs = creature.userData.joints || {};
            creature.userData = {
                originX:     x,
                originZ:     z,
                phase:       Math.random() * Math.PI * 2,
                idlePhase:   Math.random() * Math.PI * 2,
                speed:       cfg.speed,
                roamRadius:  cfg.roamRadius,
                bobHeight:   cfg.bobHeight,
                bodyScale:   cfg.bodyScale,
                legCount:    cfg.legCount,
                speciesIdx,
                hasTail:     !!cfg.hasTail,
                hasAntennae: !!cfg.hasAntennae,
                hasMandibles:!!cfg.hasMandibles,
                joints:      jointRefs,
            };
            group.add(creature);
            creatures.push(creature);
        }
    });

    return creatures;
}

// ── Procedural cloud system ─────────────────────────────────────────────────

// Planet types that get clouds — opacity, tint, UV scroll speed multiplier
const CLOUD_TYPES = {
    'Terran':      { opacity: 0.32, color: 0xeef4ff, speed: 1.0 },
    'Continental': { opacity: 0.28, color: 0xe8f0ff, speed: 0.9 },
    'Ocean':       { opacity: 0.40, color: 0xd8eaff, speed: 1.2 },
    'Arctic':      { opacity: 0.22, color: 0xdae8f4, speed: 0.6 },
    'Ice':         { opacity: 0.18, color: 0xc8dce8, speed: 0.5 },
    'Desert':      { opacity: 0.14, color: 0xf0dcc0, speed: 0.4 },
    'Barren':      { opacity: 0.08, color: 0xbbbbbb, speed: 0.3 },
    'Molten':      { opacity: 0.26, color: 0x4a2a1a, speed: 0.7 },
    'Tomb':        { opacity: 0.16, color: 0x88aa88, speed: 0.35 },
    'Gas Giant':   { opacity: 0.45, color: 0xeedd99, speed: 1.5 },
};

let _cloudTexCache = null;

function _createCloudTexture() {
    if (_cloudTexCache) return _cloudTexCache;

    const W = 1024, H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Large wispy cloud bands
    for (let i = 0; i < 35; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const rx = 80 + Math.random() * 160;
        const ry = 25 + Math.random() * 50;
        const op = 0.06 + Math.random() * 0.14;
        const rot = (Math.random() - 0.5) * 0.4;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(255,255,255,${op})`);
        g.addColorStop(0.35, `rgba(240,248,255,${op * 0.6})`);
        g.addColorStop(1, 'rgba(240,250,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Wrap edges so the texture tiles seamlessly
        for (const ox of [-W, W]) {
            ctx.save();
            ctx.translate(x + ox, y);
            ctx.rotate(rot);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Smaller puffs for detail
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = 12 + Math.random() * 50;
        const op = 0.04 + Math.random() * 0.15;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${op})`);
        g.addColorStop(0.5, `rgba(230,245,255,${op * 0.4})`);
        g.addColorStop(1, 'rgba(240,250,255,0)');
        ctx.fillStyle = g;
        for (const ox of [0, -W, W]) {
            ctx.beginPath();
            ctx.arc(x + ox, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    _cloudTexCache = tex;
    return tex;
}

/**
 * Creates cloud layer(s) for the planet. Returns an array of cloud meshes
 * (may be empty if planet type has no clouds). Caller adds them to the group.
 * Each layer has UV-scroll animation data in userData.
 */
export function createCloudLayers(planetType) {
    const conf = CLOUD_TYPES[planetType];
    if (!conf) return [];

    const tex = _createCloudTexture();
    const layers = [];

    // Three layers at different heights — slow UV scroll for natural drift
    const layerDefs = [
        { height: 65,  size: 700, opMul: 1.0,  uvSpeed: 0.003,  uvAngle: 0.1  },
        { height: 110, size: 900, opMul: 0.55, uvSpeed: 0.0018, uvAngle: -0.15 },
        { height: 160, size: 1100, opMul: 0.3,  uvSpeed: 0.001,  uvAngle: 0.25 },
    ];

    for (const def of layerDefs) {
        const geo = new THREE.PlaneGeometry(def.size, def.size);
        const mat = new THREE.MeshBasicMaterial({
            map: tex.clone(),   // clone so each layer has independent UV offset
            transparent: true,
            opacity: conf.opacity * def.opMul,
            color: conf.color,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        // Enable UV offset animation on the cloned texture
        mat.map.wrapS = THREE.RepeatWrapping;
        mat.map.wrapT = THREE.RepeatWrapping;

        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = def.height;
        mesh.renderOrder = 5; // render after terrain
        mesh.userData.cloudLayer = true;
        mesh.userData.baseOpacity = conf.opacity * def.opMul;
        // UV scroll direction (dx, dz per second)
        const a = def.uvAngle;
        mesh.userData.uvDx = Math.cos(a) * def.uvSpeed * conf.speed;
        mesh.userData.uvDz = Math.sin(a) * def.uvSpeed * conf.speed;
        mesh.userData.opacityPhase = Math.random() * Math.PI * 2; // unique breathing offset
        layers.push(mesh);
    }

    return layers;
}

// ── Ground mist layer ───────────────────────────────────────────────────────

const MIST_TYPES = {
    'Terran':      { opacity: 0.12, color: 0xccddee },
    'Continental': { opacity: 0.10, color: 0xbbccdd },
    'Ocean':       { opacity: 0.18, color: 0x99bbdd },
    'Arctic':      { opacity: 0.15, color: 0xaabbcc },
    'Ice':         { opacity: 0.14, color: 0x99aacc },
    'Molten':      { opacity: 0.20, color: 0x331100 },
    'Tomb':        { opacity: 0.12, color: 0x112211 },
};

let _mistTexCache = null;

function _createMistTexture() {
    if (_mistTexCache) return _mistTexCache;
    const S = 512;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, S, S);

    // Soft radial patches
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const r = 60 + Math.random() * 120;
        const op = 0.04 + Math.random() * 0.08;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${op})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    _mistTexCache = tex;
    return tex;
}

/**
 * Creates a low-lying ground mist plane. Returns the mesh or null.
 */
export function createGroundMist(planetType) {
    const conf = MIST_TYPES[planetType];
    if (!conf) return null;

    const tex = _createMistTexture();
    const geo = new THREE.PlaneGeometry(500, 500);
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: conf.opacity,
        color: conf.color,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 2.5; // just above terrain surface
    mesh.renderOrder = 4;
    mesh.userData.groundMist = true;
    mesh.userData.baseOpacity = conf.opacity;
    return mesh;
}

// ── Atmospheric haze (horizon gradient ring) ────────────────────────────────

/**
 * Creates a vertical cylinder around the scene that fades from transparent
 * at the bottom to the sky color at the top — simulates atmospheric haze.
 */
export function createAtmosphericHaze(skyColor, planetType) {
    const darkTypes = ['Barren', 'Tomb', 'Molten'];
    if (darkTypes.includes(planetType)) return null; // no haze on harsh worlds

    const geo = new THREE.CylinderGeometry(450, 450, 200, 32, 1, true);
    const col = new THREE.Color(skyColor);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: col },
        },
        vertexShader: /* glsl */`
            varying float vHeight;
            void main() {
                vHeight = uv.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            varying float vHeight;
            void main() {
                // Fade from transparent at bottom to sky color at top
                float alpha = smoothstep(0.0, 0.7, vHeight) * 0.45;
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 40; // centered at mid-height
    mesh.renderOrder = 3;
    return mesh;
}

// ── Lakes with shore vegetation ─────────────────────────────────────────────

// Planet types that can have lakes
const LAKE_TYPES = {
    'Terran':      { waterColor: 0x1a7acc, waterEmissive: 0x0a3066, shoreVeg: true },
    'Continental': { waterColor: 0x2088bb, waterEmissive: 0x0c3560, shoreVeg: true },
    'Ocean':       { waterColor: 0x1060cc, waterEmissive: 0x082858, shoreVeg: true },
    'Ice':         { waterColor: 0x60aadd, waterEmissive: 0x1a4060, shoreVeg: false },
    'Arctic':      { waterColor: 0x50a0cc, waterEmissive: 0x183858, shoreVeg: false },
    'Desert':      { waterColor: 0x2a8878, waterEmissive: 0x0c3828, shoreVeg: true },
    // Lava lakes — bright orange/red, strong emissive glow
    'Molten':      { waterColor: 0xcc3300, waterEmissive: 0xff4400, emissiveIntensity: 0.8, opacity: 0.95, roughness: 0.35, metalness: 0.2, shoreVeg: false, shoreColor: 0x2a1a0a },
    // Chemical/mineral pools — murky grey-brown
    'Barren':      { waterColor: 0x4a4030, waterEmissive: 0x1a1408, emissiveIntensity: 0.1, opacity: 0.9, roughness: 0.4, metalness: 0.3, shoreVeg: false, shoreColor: 0x5a5040 },
    // Toxic pools — sickly green with faint glow
    'Tomb':        { waterColor: 0x1a3a10, waterEmissive: 0x2a5a0a, emissiveIntensity: 0.35, opacity: 0.88, roughness: 0.15, metalness: 0.5, shoreVeg: false, shoreColor: 0x2a2a1a },
};

/**
 * Generates lake positions. Uses seeded pseudo-random so lakes are consistent
 * per planet but varied. All lakes are guaranteed to be far from the colony at origin.
 */
const COLONY_EXCLUSION = 65; // Colony buildings extend to ~22, safe zone to ~40; add generous buffer
export function _generateLakePositions(planetType) {
    const lakes = [];
    const count = isMobileDevice ? 2 : 3;

    // Scenic lake
    const nearAngle = 0.8 + Math.sin(planetType.length * 1.7) * 0.6;
    const nearDist  = 130 + Math.abs(Math.sin(planetType.length * 2.3)) * 40;
    lakes.push({
        x: Math.cos(nearAngle) * nearDist,
        z: Math.sin(nearAngle) * nearDist,
        radius: 28 + (planetType.length % 3) * 6,
    });

    // Additional lakes scattered around the map
    const seed = planetType.charCodeAt(0) * 137;
    for (let i = 1; i < count; i++) {
        const angle = (seed + i * 2.4) % (Math.PI * 2);
        const dist = 140 + ((seed * i * 7) % 110);
        const r = 24 + ((seed * i) % 14);
        lakes.push({
            x: Math.cos(angle) * dist,
            z: Math.sin(angle) * dist,
            radius: r,
        });
    }

    // Safety: reject any lake whose edge comes within COLONY_EXCLUSION of origin
    return lakes.filter(lake => {
        const centerDist = Math.sqrt(lake.x * lake.x + lake.z * lake.z);
        return (centerDist - lake.radius) >= COLONY_EXCLUSION;
    });
}

/**
 * Builds a small alien fish mesh — bioluminescent body with tail fin.
 */
export function _buildAlienFish(bodyColor, glowColor, scale) {
    const g = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(0.3 * scale, 6, 5);
    bodyGeo.scale(1.8, 1, 1);
    g.add(new THREE.Mesh(bodyGeo, mat(bodyColor, glowColor, 0.6, false, 1, 0.4)));
    // Tail fin
    const tailGeo = new THREE.ConeGeometry(0.25 * scale, 0.5 * scale, 4);
    tailGeo.rotateZ(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeo, mat(bodyColor, glowColor, 0.3, true, 0.8, 0.5));
    tail.position.x = -0.45 * scale;
    g.add(tail);
    // Dorsal fin
    const finGeo = new THREE.ConeGeometry(0.12 * scale, 0.3 * scale, 3);
    const fin = new THREE.Mesh(finGeo, mat(bodyColor, glowColor, 0.4, true, 0.7, 0.5));
    fin.position.y = 0.25 * scale;
    g.add(fin);
    // Bioluminescent eye spots
    const eyeGeo = new THREE.SphereGeometry(0.06 * scale, 4, 4);
    const eyeMat = mat(glowColor, glowColor, 1.0, false, 1, 0.2);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.35 * scale, 0.08 * scale, 0.12 * scale);
    g.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.35 * scale, 0.08 * scale, -0.12 * scale);
    g.add(eyeR);
    g.userData.tail = tail;
    return g;
}

const FISH_COLORS = {
    'Terran':      { body: 0x22aa88, glow: 0x44ffcc },
    'Continental': { body: 0x3388aa, glow: 0x55ccff },
    'Ocean':       { body: 0x2266cc, glow: 0x44aaff },
    'Ice':         { body: 0x88bbdd, glow: 0xaaddff },
    'Arctic':      { body: 0x77aacc, glow: 0x99ccee },
    'Desert':      { body: 0x44aa77, glow: 0x66ddaa },
    'Molten':      { body: 0xcc4400, glow: 0xff6600 },
    'Barren':      { body: 0x666655, glow: 0x998877 },
    'Tomb':        { body: 0x33aa22, glow: 0x55ff33 },
};

/**
 * Creates lake water meshes, shore vegetation, fish, and returns collision data.
 * Carves basins into the terrain mesh so water is visible above the ground.
 */
export function createLakes(planetType, group, heightFn, terrainMesh) {
    const conf = LAKE_TYPES[planetType];
    if (!conf) return { meshes: [], collisions: [], fish: [], lakeDefs: [] };

    const lakeDefs = _generateLakePositions(planetType);
    const meshes = [];
    const collisions = [];
    const fish = [];
    const vegCfg = getVegetationConfig(planetType);
    const fishCfg = FISH_COLORS[planetType] || FISH_COLORS['Terran'];

    // Carve basins into the terrain so lake beds are below the water surface
    if (terrainMesh) carveLakeBasins(terrainMesh, lakeDefs);

    // Pre-build shared water material (one shader compile for all lakes of same type)
    const segments = isMobileDevice ? 24 : 32;
    const lakeOpacity = conf.opacity || 0.88;
    const lakeEmissiveStr = conf.emissiveIntensity || 0.4;
    const _sharedWaterMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({
            color: conf.waterColor,
            emissive: conf.waterEmissive,
            emissiveIntensity: Math.min(lakeEmissiveStr, 0.5),
            transparent: true,
            opacity: lakeOpacity,
        })
        : new THREE.ShaderMaterial({
            uniforms: {
                uTime:      { value: 0 },
                uColor:     { value: new THREE.Color(conf.waterColor) },
                uEmissive:  { value: new THREE.Color(conf.waterEmissive) },
                uEmissiveStr: { value: lakeEmissiveStr },
                uOpacity:   { value: lakeOpacity },
                uFresnelPow: { value: planetType === 'Molten' ? 1.5 : 2.5 },
            },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                varying vec3 vWorldPos;
                varying vec3 vViewDir;
                uniform float uTime;

                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    float wave = sin(pos.x * 3.0 + uTime * 1.2) * cos(pos.y * 2.5 + uTime * 0.9) * 0.2
                               + sin(pos.x * 1.5 - uTime * 0.7) * 0.15;
                    pos.z += wave;
                    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
                    vWorldPos = worldPos.xyz;
                    vViewDir = normalize(cameraPosition - worldPos.xyz);
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: /* glsl */`
                precision mediump float;
                uniform float uTime;
                uniform vec3 uColor;
                uniform vec3 uEmissive;
                uniform float uEmissiveStr;
                uniform float uOpacity;
                uniform float uFresnelPow;
                varying vec2 vUv;
                varying vec3 vWorldPos;
                varying vec3 vViewDir;

                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                float vnoise(vec2 p) {
                    vec2 i = floor(p), f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash(i), b = hash(i + vec2(1,0));
                    float c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
                    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
                }

                void main() {
                    vec3 V = normalize(vViewDir);
                    float fresnel = pow(1.0 - max(abs(V.y), 0.05), uFresnelPow);
                    float n1 = vnoise(vWorldPos.xz * 0.15 + uTime * vec2(0.08, 0.06));
                    float n2 = vnoise(vWorldPos.xz * 0.3 - uTime * vec2(0.05, 0.1)) * 0.5;
                    float caustic = (n1 + n2) * 0.5 + 0.5;
                    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
                    float spec = pow(max(dot(reflect(-lightDir, vec3(0,1,0)), V), 0.0), 48.0) * 0.6;
                    vec3 col = uColor;
                    col += caustic * 0.15 * uColor;
                    col += fresnel * 0.3 * vec3(0.6, 0.8, 1.0);
                    col += uEmissive * uEmissiveStr;
                    col += spec * vec3(1.0, 0.95, 0.9);
                    vec2 centered = vUv - 0.5;
                    float edgeFade = smoothstep(1.0, 0.7, length(centered) * 2.0);
                    float alpha = uOpacity * edgeFade * (0.85 + fresnel * 0.15);
                    gl_FragColor = vec4(col, alpha);
                    #include <tonemapping_fragment>
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

    for (const lake of lakeDefs) {
        const waterY = lake.waterY ?? heightFn(lake.x, lake.z) - 0.5;

        // ── Water surface disc (shared material — one shader compile for all lakes) ──
        const waterGeo = new THREE.CircleGeometry(lake.radius, segments);
        const waterMat = _sharedWaterMat;

        const waterMesh = new THREE.Mesh(waterGeo, waterMat);
        waterMesh.rotation.x = -Math.PI / 2;
        waterMesh.position.set(lake.x, waterY, lake.z);
        waterMesh.renderOrder = 2;
        waterMesh.userData.isLake = true;
        waterMesh.userData.baseY = waterY;
        waterMesh.userData.time = Math.random() * 100;
        group.add(waterMesh);
        meshes.push(waterMesh);

        // ── Subtle shore ring (sandy/muddy edge) ──
        const shoreGeo = new THREE.RingGeometry(lake.radius - 1.5, lake.radius + 2.5, segments);
        const shoreColor = conf.shoreColor
            || (planetType === 'Desert' ? 0x8a7a4a
            : (planetType === 'Ice' || planetType === 'Arctic') ? 0x5a7a8a
            : 0x4a5a3a);
        const shoreMat = isMobileDevice
            ? new THREE.MeshLambertMaterial({ color: shoreColor, transparent: true, opacity: 0.5 })
            : new THREE.MeshStandardMaterial({ color: shoreColor, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.5 });
        const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
        shoreMesh.rotation.x = -Math.PI / 2;
        shoreMesh.position.set(lake.x, waterY + 0.05, lake.z);
        group.add(shoreMesh);

        // ── Point light for glowing lakes (lava, toxic) ──
        if (!isMobileDevice && lakeEmissiveStr >= 0.3) {
            const glowLight = new THREE.PointLight(conf.waterEmissive, lakeEmissiveStr * 2.5, lake.radius * 3);
            glowLight.position.set(lake.x, waterY + 2, lake.z);
            group.add(glowLight);
        }

        // ── Shore vegetation (trees, bushes, reeds around the lake edge) ──
        if (conf.shoreVeg && vegCfg.hasVeg) {
            const shoreVegCount = isMobileDevice ? 14 : 28;
            const hasNaturalVeg = !!vegCfg.wildflowerColors;
            for (let i = 0; i < shoreVegCount; i++) {
                const angle = (i / shoreVegCount) * Math.PI * 2 + Math.random() * 0.3;
                const dist = lake.radius + 2 + Math.random() * 6;
                const vx = lake.x + Math.cos(angle) * dist;
                const vz = lake.z + Math.sin(angle) * dist;
                const vy = heightFn(vx, vz);
                const scale = 0.5 + Math.random() * 0.7;
                const roll = Math.random();

                let vegMesh;
                if (hasNaturalVeg) {
                    // Terran/Continental: mix of tree types, bushes, wildflowers, reeds
                    if (roll < 0.15) {
                        vegMesh = makeTree(vegCfg.treeColor, vegCfg.trunkColor, scale * 1.2);
                    } else if (roll < 0.28) {
                        vegMesh = makeTreeRound(vegCfg.treeColor2, vegCfg.trunkColor2, scale);
                    } else if (roll < 0.50) {
                        vegMesh = makeBush(vegCfg.bushColor, scale);
                    } else if (roll < 0.70) {
                        vegMesh = makeWildflower(vegCfg.wildflowerColors, scale * 0.8);
                    } else {
                        vegMesh = _makeReedCluster(vegCfg.bushColor, scale);
                    }
                } else {
                    // Other planet types: original distribution with alien plants
                    if (roll < 0.25) {
                        vegMesh = makeTree(vegCfg.treeColor, vegCfg.trunkColor, scale * 1.2);
                    } else if (roll < 0.55) {
                        vegMesh = makeBush(vegCfg.bushColor, scale);
                    } else if (roll < 0.75) {
                        vegMesh = makeAlienPlant(vegCfg.alienPlantColor, vegCfg.alienGlow, scale * 0.8);
                    } else {
                        vegMesh = _makeReedCluster(vegCfg.bushColor, scale);
                    }
                }

                vegMesh.position.set(vx, vy, vz);
                vegMesh.rotation.y = Math.random() * Math.PI * 2;
                vegMesh.userData.isVegetation = true;
                vegMesh.userData.swayPhase = Math.random() * Math.PI * 2;
                vegMesh.userData.swayScale = scale;
                vegMesh.userData.baseRotX = 0;
                vegMesh.userData.baseRotZ = 0;
                group.add(vegMesh);

                collisions.push({ x: vx, z: vz, r: 1.2 * scale, topY: vy + 4 * scale });
            }
        }

        // ── Alien fish swimming in the lake ──
        const fishCount = isMobileDevice ? 3 : 6;
        for (let fi = 0; fi < fishCount; fi++) {
            const fScale = 0.6 + Math.random() * 0.8;
            const fishMesh = _buildAlienFish(fishCfg.body, fishCfg.glow, fScale);
            const swimRadius = 3 + Math.random() * (lake.radius * 0.6);
            const startAngle = Math.random() * Math.PI * 2;
            fishMesh.position.set(
                lake.x + Math.cos(startAngle) * swimRadius,
                waterY - 0.3 - Math.random() * 0.8,
                lake.z + Math.sin(startAngle) * swimRadius
            );
            fishMesh.userData.lakeX = lake.x;
            fishMesh.userData.lakeZ = lake.z;
            fishMesh.userData.lakeRadius = lake.radius;
            fishMesh.userData.waterY = waterY;
            fishMesh.userData.swimRadius = swimRadius;
            fishMesh.userData.swimPhase = startAngle;
            fishMesh.userData.swimSpeed = 0.3 + Math.random() * 0.4;
            fishMesh.userData.depthOffset = 0.3 + Math.random() * 0.8;
            group.add(fishMesh);
            fish.push(fishMesh);
        }

        // Collision: treat the whole lake as a large circular obstacle
        collisions.push({ x: lake.x, z: lake.z, r: lake.radius, topY: waterY + 0.5 });
    }

    return { meshes, collisions, fish, lakeDefs };
}

/**
 * Reed cluster — thin tall grass-like cylinders growing near water.
 */
export function _makeReedCluster(color, scale) {
    const g = new THREE.Group();
    const reedMat = mat(color, 0, 0, false, 1, 0.85);
    const reedCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < reedCount; i++) {
        const h = (2.5 + Math.random() * 2) * scale;
        const reed = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04 * scale, 0.08 * scale, h, 4),
            reedMat
        );
        reed.position.set(
            (Math.random() - 0.5) * 1.2 * scale,
            h * 0.5,
            (Math.random() - 0.5) * 1.2 * scale
        );
        // Slight lean for natural look
        reed.rotation.x = (Math.random() - 0.5) * 0.15;
        reed.rotation.z = (Math.random() - 0.5) * 0.15;
        reed.castShadow = true;
        g.add(reed);
    }
    // Top tuft on tallest reed
    const tuft = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 * scale, 5, 4),
        mat(color, 0, 0, false, 1, 0.8)
    );
    tuft.scale.set(0.6, 1.2, 0.6);
    tuft.position.set(0, (3.5 + Math.random()) * scale, 0);
    g.add(tuft);
    return g;
}
