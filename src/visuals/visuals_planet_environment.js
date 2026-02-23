/* Updated: Added 2 alien species with distinct shapes/behaviors + vegetation (trees, bushes, alien plants) per planet type */
import * as THREE from 'three';
import { textures } from '../core/assets.js';

const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Vegetation configs per planet type ───────────────────────────────────────
function getVegetationConfig(type) {
    switch (type) {
        case 'Terran':
        case 'Continental':
            return {
                hasVeg: true,
                treeColor: 0x2d5a1b, trunkColor: 0x5c3a1e,
                bushColor: 0x3a7a22, flowerColor: 0xffdd44,
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
        default:
            return { hasVeg: false };
    }
}

// ── Build a tree mesh ─────────────────────────────────────────────────────────
function makeTree(treeColor, trunkColor, scale) {
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

// ── Build a bush mesh ─────────────────────────────────────────────────────────
function makeBush(color, scale) {
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

// ── Build an alien plant (tall glowing stalk with orb top) ────────────────────
function makeAlienPlant(color, glowColor, scale) {
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

// ── Props (rocks + crystals) ──────────────────────────────────────────────────
export function createPlanetProps(planetType, group, heightFn) {
    const props = [];
    const propColor = getPropColor(planetType);
    const propMat = mat(propColor, 0, 0, false, 1, 0.9);
    const crystalMat = mat(0x00f2ff, 0x0044aa, 0.5, true, 0.8, 0.2);

    const propCount = isMobileDevice ? 80 : 150;
    const propGeo   = new THREE.DodecahedronGeometry(1, 0);
    const crystalGeo = new THREE.ConeGeometry(0.5, 3, 4);

    for (let i = 0; i < propCount; i++) {
        const r = 30 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const yBase = heightFn(x, z);

        const isCrystal = Math.random() > 0.9;
        const scale = 0.5 + Math.random() * (isCrystal ? 1.5 : 3);
        const mesh = new THREE.Mesh(isCrystal ? crystalGeo : propGeo, isCrystal ? crystalMat : propMat);

        const halfHeight = isCrystal ? (3 * scale) / 2 : (1 * scale) / 2;
        const meshY = yBase + (isCrystal ? 1.5 * scale : 0.8 * scale);

        mesh.position.set(x, meshY, z);
        mesh.scale.setScalar(scale);
        mesh.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        props.push({ x, z, r: (isCrystal ? 1 : 1.5) * scale, topY: meshY + halfHeight });

        if (isCrystal && !isMobileDevice) {
            const light = new THREE.PointLight(0x00f2ff, 2, 8);
            light.position.set(0, -1, 0);
            mesh.add(light);
        }
    }

    // ── Vegetation ────────────────────────────────────────────────────────────
    const vegCfg = getVegetationConfig(planetType);
    if (vegCfg.hasVeg) {
        const vegCount = isMobileDevice ? 30 : 70;
        for (let i = 0; i < vegCount; i++) {
            const r = 20 + Math.random() * 280;
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            const yBase = heightFn(x, z);
            const roll = Math.random();
            const scale = 0.5 + Math.random() * 0.8;
            let vegMesh;

            if (roll < 0.35) {
                vegMesh = makeTree(vegCfg.treeColor, vegCfg.trunkColor, scale);
            } else if (roll < 0.65) {
                vegMesh = makeBush(vegCfg.bushColor, scale);
            } else {
                vegMesh = makeAlienPlant(vegCfg.alienPlantColor, vegCfg.alienGlow, scale);
            }

            vegMesh.position.set(x, yBase, z);
            vegMesh.rotation.y = Math.random() * Math.PI * 2;
            group.add(vegMesh);
            // Add as collision prop (wide radius so drone doesn't clip through)
            props.push({ x, z, r: 1.5 * scale, topY: yBase + 4 * scale });
        }
    }

    return props;
}

// ── Alien species definitions ─────────────────────────────────────────────────
function getSpeciesConfigs(planetType) {
    // Species A — large slow grazer
    const speciesA = {
        bodyColor:  0x44aa66,
        legColor:   0x226644,
        eyeColor:   0xffff00,
        eyeGlow:    0xaaaa00,
        bodyScale:  1.6,
        legCount:   6,
        speed:      0.15,
        roamRadius: 18,
        bobHeight:  0.3,
        count:      isMobileDevice ? 3 : 6,
    };
    // Species B — small fast hunter
    const speciesB = {
        bodyColor:  0xcc4422,
        legColor:   0x882211,
        eyeColor:   0x00ffff,
        eyeGlow:    0x008888,
        bodyScale:  0.8,
        legCount:   4,
        speed:      0.55,
        roamRadius: 30,
        bobHeight:  0.6,
        count:      isMobileDevice ? 4 : 8,
    };

    // Adjust colors per planet type
    switch (planetType) {
        case 'Ice': case 'Arctic':
            speciesA.bodyColor = 0xaaddff; speciesA.legColor = 0x6699bb;
            speciesB.bodyColor = 0x88ccff; speciesB.legColor = 0x4488aa;
            break;
        case 'Desert':
            speciesA.bodyColor = 0xcc8833; speciesA.legColor = 0x885522;
            speciesB.bodyColor = 0xdd6622; speciesB.legColor = 0x993311;
            break;
        case 'Ocean':
            speciesA.bodyColor = 0x2288aa; speciesA.legColor = 0x115566;
            speciesB.bodyColor = 0x44bbcc; speciesB.legColor = 0x227788;
            break;
        case 'Molten':
            speciesA.bodyColor = 0x882200; speciesA.legColor = 0x441100;
            speciesA.eyeColor  = 0xff4400; speciesA.eyeGlow = 0xff2200;
            speciesB.bodyColor = 0xcc3300; speciesB.legColor = 0x661100;
            speciesB.eyeColor  = 0xffaa00; speciesB.eyeGlow = 0xff6600;
            break;
    }
    return [speciesA, speciesB];
}

function buildCreatureMesh(cfg) {
    const g = new THREE.Group();
    const s = cfg.bodyScale;

    // Body
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(s, isMobileDevice ? 6 : 10, isMobileDevice ? 6 : 10),
        mat(cfg.bodyColor, 0, 0, false, 1, 0.75)
    );
    body.scale.set(1, 0.65, 1.2);
    body.castShadow = true;
    g.add(body);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(s * 0.55, isMobileDevice ? 5 : 8, isMobileDevice ? 5 : 8),
        mat(cfg.bodyColor, 0, 0, false, 1, 0.7)
    );
    head.position.set(0, s * 0.3, s * 1.1);
    head.castShadow = true;
    g.add(head);

    // Eyes (2)
    const eyeMat = mat(cfg.eyeColor, cfg.eyeGlow, 1.5, false, 1, 0.1);
    [-0.22, 0.22].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.12, 5, 5), eyeMat);
        eye.position.set(ex * s, s * 0.45, s * 1.55);
        g.add(eye);
    });

    // Legs
    const legMat = mat(cfg.legColor, 0, 0, false, 1, 0.9);
    for (let j = 0; j < cfg.legCount; j++) {
        const angle = (j / cfg.legCount) * Math.PI * 2;
        const legTop = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.1, s * 0.08, s * 0.9, 4),
            legMat
        );
        legTop.position.set(Math.cos(angle) * s * 0.85, -s * 0.35, Math.sin(angle) * s * 0.6);
        legTop.rotation.z = Math.cos(angle) * 0.4;
        legTop.rotation.x = Math.sin(angle) * 0.3;
        legTop.castShadow = true;
        g.add(legTop);

        const legBot = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.07, s * 0.05, s * 0.7, 4),
            legMat
        );
        legBot.position.set(Math.cos(angle) * s * 1.1, -s * 0.9, Math.sin(angle) * s * 0.85);
        legBot.rotation.z = Math.cos(angle) * 0.6;
        legBot.rotation.x = Math.sin(angle) * 0.5;
        g.add(legBot);
    }

    // Tail (species A only — longer body)
    if (cfg.legCount === 6) {
        const tail = new THREE.Mesh(
            new THREE.ConeGeometry(s * 0.2, s * 1.4, 5),
            mat(cfg.bodyColor, 0, 0, false, 1, 0.8)
        );
        tail.position.set(0, s * 0.1, -s * 1.3);
        tail.rotation.x = -0.5;
        g.add(tail);
    }

    return g;
}

// ── Public: create creatures (2 species) ─────────────────────────────────────
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
            creature.userData = {
                originX:    x,
                originZ:    z,
                phase:      Math.random() * Math.PI * 2,
                speed:      cfg.speed,
                roamRadius: cfg.roamRadius,
                bobHeight:  cfg.bobHeight,
                bodyScale:  cfg.bodyScale,
                legCount:   cfg.legCount,
                speciesIdx,
                // leg animation refs — children indices for legs start at 3 (body+head+eyes)
                legStartIdx: 4,
            };
            group.add(creature);
            creatures.push(creature);
        }
    });

    return creatures;
}