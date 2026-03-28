/**
 * Planet anomaly & procedural encounter system.
 * Generates discoverable anomaly POIs, manages discovery panel UI,
 * and triggers timed procedural encounters during exploration.
 */
import * as THREE from 'three';
import { gameState, events } from '../core/state.js';
import { showNotification } from '../ui/ui_notifications.js';
import planetState from './visuals_planet_state.js';
import { getTerrainHeight, getTerrainHeightFast } from './visuals_planet_terrain.js';

// ── Anomaly type definitions ────────────────────────────────────────────────

const ANOMALY_TYPES = {
    energy_vortex: {
        label: 'Energy Vortex',
        icon: '🌀',
        desc: 'A swirling concentration of exotic energy particles, pulsing with an otherworldly rhythm.',
        planetTypes: ['Terran', 'Continental', 'Ocean'],
        reward: { energy: 120, minerals: 0, food: 0 },
        glowColor: 0x9933ff,
    },
    ancient_monolith: {
        label: 'Ancient Monolith',
        icon: '🗿',
        desc: 'A towering dark stone engraved with luminous runes of unknown origin.',
        planetTypes: ['Tomb', 'Barren', 'Desert'],
        reward: { energy: 40, minerals: 80, food: 0 },
        glowColor: 0xcc44ff,
    },
    crashed_probe: {
        label: 'Crashed Probe',
        icon: '🛰️',
        desc: 'Wreckage of an unidentified probe, its beacon still faintly blinking.',
        planetTypes: null,
        reward: { energy: 50, minerals: 60, food: 0 },
        glowColor: 0xaa55ff,
    },
    bioluminescent_growth: {
        label: 'Bioluminescent Growth',
        icon: '🍄',
        desc: 'A massive pulsating organic mass radiating soft light from deep within.',
        planetTypes: ['Ocean', 'Ice', 'Arctic'],
        reward: { energy: 30, minerals: 0, food: 100 },
        glowColor: 0x7744ff,
    },
    magma_vent: {
        label: 'Magma Vent',
        icon: '🌋',
        desc: 'A fissure erupting with superheated minerals and rare crystalline deposits.',
        planetTypes: ['Molten', 'Desert'],
        reward: { energy: 60, minerals: 90, food: 0 },
        glowColor: 0xff44cc,
    },
    signal_source: {
        label: 'Signal Source',
        icon: '📡',
        desc: 'An alien transmitter projecting a faint holographic display into the air.',
        planetTypes: null,
        reward: { energy: 70, minerals: 40, food: 20 },
        glowColor: 0xbb33ff,
    },
};

// ── Seeded RNG ──────────────────────────────────────────────────────────────

function _hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0) / 0xFFFFFFFF;
}

function _seededRandom(seed) {
    let s = Math.floor(seed * 2147483647) || 1;
    return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// ── Anomaly generation ──────────────────────────────────────────────────────

export function generatePlanetAnomalies(planetData) {
    const rand = _seededRandom(_hash(planetData.id + '_anomalies'));

    const pool = [];
    for (const [typeKey, def] of Object.entries(ANOMALY_TYPES)) {
        if (def.planetTypes && !def.planetTypes.includes(planetData.type)) continue;
        pool.push({ typeKey, def, sortVal: rand() });
    }
    pool.sort((a, b) => b.sortVal - a.sortVal);

    const count = Math.min(pool.length, rand() < 0.4 ? 4 : (rand() < 0.6 ? 3 : 2));
    const anomalies = [];

    for (let i = 0; i < count; i++) {
        const { typeKey, def } = pool[i];
        const angle = (i / count) * Math.PI * 2 + rand() * 1.0;
        const dist = 50 + rand() * 80;
        anomalies.push({
            id: `anom_${planetData.id}_${typeKey}_${i}`,
            type: typeKey,
            label: def.label,
            icon: def.icon,
            desc: def.desc,
            reward: { ...def.reward },
            glowColor: def.glowColor,
            investigated: false,
            position: { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist },
            meshRef: null,
            _nearPlayer: false,
        });
    }
    return anomalies;
}

// ── Shared materials ────────────────────────────────────────────────────────

const _matCache = {};
function _mat(key, opts) {
    if (_matCache[key]) return _matCache[key];
    const m = new THREE.MeshStandardMaterial(opts);
    _matCache[key] = m;
    return m;
}

// ── 3D Mesh builders ────────────────────────────────────────────────────────

function _buildEnergyVortex(pos, anomaly) {
    const g = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    g.position.set(pos.x, groundY, pos.z);

    // Central orb
    const orbMat = new THREE.MeshStandardMaterial({
        color: 0xaa44ff, emissive: 0x7722cc, emissiveIntensity: 0.7,
        transparent: true, opacity: 0.85,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), orbMat);
    orb.position.y = 4;
    g.add(orb);

    // Orbiting particle ring (sprites)
    const ringGroup = new THREE.Group();
    ringGroup.position.y = 4;
    const pCount = 16;
    for (let i = 0; i < pCount; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            color: 0xcc66ff, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        const theta = (i / pCount) * Math.PI * 2;
        sp.position.set(Math.cos(theta) * 2.5, Math.sin(theta * 2) * 0.4, Math.sin(theta) * 2.5);
        sp.scale.set(0.35, 0.35, 0.35);
        sp.userData._baseTheta = theta;
        ringGroup.add(sp);
    }
    g.add(ringGroup);

    // Ground glow ring
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x9933ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 3.5, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);

    // Glow sprite
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0x9933ff, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.y = 4;
    glow.scale.set(6, 6, 1);
    g.add(glow);

    g.userData = {
        isAnomaly: true, anomalyId: anomaly.id, animPhase: 0,
        orbMat, ringGroup, ringMat, glowMat: glow.material,
    };
    return g;
}

function _buildAncientMonolith(pos, anomaly) {
    const g = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    g.position.set(pos.x, groundY, pos.z);

    // Main slab
    const slabMat = _mat('monolithSlab', { color: 0x1a1a22, roughness: 0.8, metalness: 0.3 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 8, 0.6), slabMat);
    slab.position.y = 4;
    slab.castShadow = true;
    g.add(slab);

    // Glowing rune strips
    const runeMat = new THREE.MeshStandardMaterial({
        color: 0xcc44ff, emissive: 0xcc44ff, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.7,
    });
    for (let i = 0; i < 4; i++) {
        const rune = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.62), runeMat);
        rune.position.set(0, 1.5 + i * 1.6, 0);
        g.add(rune);
    }

    // Base ring
    const baseMat = new THREE.MeshBasicMaterial({
        color: 0xcc44ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
    });
    const base = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.6, 20), baseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.06;
    g.add(base);

    // Glow sprite at top
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0xcc44ff, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.y = 8;
    glow.scale.set(4, 4, 1);
    g.add(glow);

    g.userData = {
        isAnomaly: true, anomalyId: anomaly.id, animPhase: 0,
        runeMat, baseMat, glowMat: glow.material,
    };
    return g;
}

function _buildCrashedProbe(pos, anomaly) {
    const g = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    g.position.set(pos.x, groundY, pos.z);

    // Body — tilted icosahedron
    const bodyMat = _mat('probeBody', { color: 0x556677, roughness: 0.6, metalness: 0.7 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), bodyMat);
    body.position.set(0, 0.8, 0);
    body.rotation.set(0.4, 0.2, -0.5);
    body.castShadow = true;
    g.add(body);

    // Antenna
    const antMat = _mat('probeAnt', { color: 0x888888, roughness: 0.4, metalness: 0.8 });
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), antMat);
    antenna.position.set(0.3, 2.2, 0);
    antenna.rotation.z = 0.3;
    g.add(antenna);

    // Blinking light at antenna tip
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 1.0 });
    const lightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lightMat);
    lightMesh.position.set(0.3 + Math.sin(0.3) * 1.5, 2.2 + Math.cos(0.3) * 1.5, 0);
    g.add(lightMesh);

    // Debris pieces
    const debrisMat = _mat('probeDebris', { color: 0x445566, roughness: 0.8, metalness: 0.5 });
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.3;
        const d = 1.5 + Math.random() * 1;
        const debris = new THREE.Mesh(new THREE.BoxGeometry(0.3 + Math.random() * 0.3, 0.15, 0.2 + Math.random() * 0.2), debrisMat);
        debris.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d);
        debris.rotation.set(Math.random(), Math.random(), Math.random());
        g.add(debris);
    }

    // Ground glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0xaa55ff, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.y = 1;
    glow.scale.set(5, 5, 1);
    g.add(glow);

    g.userData = {
        isAnomaly: true, anomalyId: anomaly.id, animPhase: 0,
        lightMat, blinkTimer: 0, glowMat: glow.material,
    };
    return g;
}

function _buildBioGrowth(pos, anomaly) {
    const g = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    g.position.set(pos.x, groundY, pos.z);

    // Cluster of glowing organic spheres
    const bioMat = new THREE.MeshStandardMaterial({
        color: 0x4422aa, emissive: 0x6633cc, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.85,
    });
    const spheres = [
        { s: 1.2, x: 0, y: 1.0, z: 0 },
        { s: 0.8, x: 0.9, y: 0.7, z: 0.5 },
        { s: 0.7, x: -0.7, y: 0.6, z: 0.6 },
        { s: 0.6, x: 0.3, y: 1.6, z: -0.3 },
        { s: 0.5, x: -0.5, y: 0.4, z: -0.7 },
    ];
    for (const sp of spheres) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(sp.s, 10, 10), bioMat);
        mesh.position.set(sp.x, sp.y, sp.z);
        g.add(mesh);
    }

    // Floating spore sprites
    const sporeGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
        const spore = new THREE.Sprite(new THREE.SpriteMaterial({
            color: 0x9966ff, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        spore.position.set(
            (Math.random() - 0.5) * 3,
            1 + Math.random() * 3,
            (Math.random() - 0.5) * 3
        );
        spore.scale.set(0.15, 0.15, 0.15);
        spore.userData._baseY = spore.position.y;
        spore.userData._drift = Math.random() * Math.PI * 2;
        sporeGroup.add(spore);
    }
    g.add(sporeGroup);

    // Ground glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0x7744ff, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.y = 1;
    glow.scale.set(5, 5, 1);
    g.add(glow);

    g.userData = {
        isAnomaly: true, anomalyId: anomaly.id, animPhase: 0,
        bioMat, sporeGroup, glowMat: glow.material,
    };
    return g;
}

function _buildMagmaVent(pos, anomaly) {
    const g = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    g.position.set(pos.x, groundY, pos.z);

    // Fissure cone
    const rockMat = _mat('ventRock', { color: 0x2a1a0a, roughness: 0.9, metalness: 0.2 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.5, 8), rockMat);
    cone.position.y = 1.0;
    cone.castShadow = true;
    g.add(cone);

    // Inner glow
    const innerMat = new THREE.MeshStandardMaterial({
        color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.7,
    });
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 8), innerMat);
    inner.position.y = 1.8;
    g.add(inner);

    // Ember sprites rising
    const emberGroup = new THREE.Group();
    for (let i = 0; i < 10; i++) {
        const ember = new THREE.Sprite(new THREE.SpriteMaterial({
            color: 0xff6622, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        ember.position.set(
            (Math.random() - 0.5) * 1.2,
            2 + Math.random() * 4,
            (Math.random() - 0.5) * 1.2
        );
        ember.scale.set(0.2, 0.2, 0.2);
        ember.userData._baseY = ember.position.y;
        ember.userData._speed = 0.5 + Math.random() * 1.5;
        emberGroup.add(ember);
    }
    g.add(emberGroup);

    // Ground glow ring
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff4400, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2, 3, 16), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);

    g.userData = {
        isAnomaly: true, anomalyId: anomaly.id, animPhase: 0,
        innerMat, emberGroup, ringMat, glowMat: ringMat,
    };
    return g;
}

function _buildSignalSource(pos, anomaly) {
    const g = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    g.position.set(pos.x, groundY, pos.z);

    // Transmitter body
    const txMat = _mat('signalTx', { color: 0x556688, roughness: 0.3, metalness: 0.85 });
    const tx = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), txMat);
    tx.position.y = 2;
    tx.castShadow = true;
    g.add(tx);

    // Support strut
    const strutMat = _mat('signalStrut', { color: 0x445566, roughness: 0.5, metalness: 0.7 });
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2, 6), strutMat);
    strut.position.y = 1;
    g.add(strut);

    // Holographic display plane
    const holoMat = new THREE.MeshBasicMaterial({
        color: 0xbb33ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
    });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.8), holoMat);
    holo.position.y = 4;
    g.add(holo);

    // Scan line
    const scanMat = new THREE.MeshBasicMaterial({
        color: 0xdd66ff, transparent: true, opacity: 0.5,
    });
    const scanLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.02), scanMat);
    scanLine.position.y = 4;
    g.add(scanLine);

    // Glow sprite
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0xbb33ff, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.y = 3;
    glow.scale.set(5, 5, 1);
    g.add(glow);

    g.userData = {
        isAnomaly: true, anomalyId: anomaly.id, animPhase: 0,
        tx, holo, holoMat, scanLine, glowMat: glow.material,
    };
    return g;
}

const MESH_BUILDERS = {
    energy_vortex: _buildEnergyVortex,
    ancient_monolith: _buildAncientMonolith,
    crashed_probe: _buildCrashedProbe,
    bioluminescent_growth: _buildBioGrowth,
    magma_vent: _buildMagmaVent,
    signal_source: _buildSignalSource,
};

// ── Create anomaly meshes ───────────────────────────────────────────────────

export function createAnomalyMeshes(anomalies, anomalyGroup) {
    for (const anomaly of anomalies) {
        const builder = MESH_BUILDERS[anomaly.type];
        if (!builder) continue;
        const mesh = builder(anomaly.position, anomaly);
        anomalyGroup.add(mesh);
        anomaly.meshRef = mesh;
    }
}

// ── Per-frame anomaly animation ─────────────────────────────────────────────

export function updateAnomalyAnims(dt, time) {
    if (!planetState.anomalyGroup) return;

    for (const mesh of planetState.anomalyGroup.children) {
        const ud = mesh.userData;
        if (!ud.isAnomaly) continue;
        ud.animPhase += dt;

        // Investigated → dim
        if (ud.investigated) {
            if (ud.glowMat && ud.glowMat.opacity > 0.02) {
                ud.glowMat.opacity *= 0.95;
            }
            continue;
        }

        const t = ud.animPhase;

        // Energy Vortex — rotate ring, pulse orb
        if (ud.ringGroup) {
            ud.ringGroup.rotation.y += dt * 1.2;
            for (const sp of ud.ringGroup.children) {
                sp.position.y = Math.sin(t * 2 + sp.userData._baseTheta * 3) * 0.5;
            }
            if (ud.orbMat) ud.orbMat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.25;
            if (ud.ringMat) ud.ringMat.opacity = 0.15 + Math.sin(t * 2) * 0.08;
        }

        // Monolith — pulse runes
        if (ud.runeMat) {
            ud.runeMat.emissiveIntensity = 0.4 + Math.sin(t * 1.5) * 0.3;
        }

        // Crashed Probe — blink light
        if (ud.lightMat) {
            ud.blinkTimer += dt;
            ud.lightMat.opacity = ud.blinkTimer % 1.5 < 0.15 ? 1.0 : 0.1;
        }

        // Bio Growth — pulse emissive, drift spores
        if (ud.bioMat) {
            ud.bioMat.emissiveIntensity = 0.3 + Math.sin(t * 1.8) * 0.25;
        }
        if (ud.sporeGroup) {
            for (const sp of ud.sporeGroup.children) {
                sp.position.y = sp.userData._baseY + Math.sin(t * 0.8 + sp.userData._drift) * 0.6;
                sp.material.opacity = 0.25 + Math.sin(t + sp.userData._drift) * 0.15;
            }
        }

        // Magma Vent — rise embers, flicker inner glow
        if (ud.emberGroup) {
            for (const ember of ud.emberGroup.children) {
                ember.position.y += ember.userData._speed * dt;
                ember.material.opacity = Math.max(0, 0.5 - (ember.position.y - ud.emberGroup.parent.position.y) * 0.05);
                if (ember.position.y > 8) {
                    ember.position.y = 2 + Math.random();
                    ember.position.x = (Math.random() - 0.5) * 1.2;
                    ember.position.z = (Math.random() - 0.5) * 1.2;
                    ember.material.opacity = 0.5;
                }
            }
            if (ud.innerMat) ud.innerMat.emissiveIntensity = 0.6 + Math.sin(t * 5) * 0.25;
        }

        // Signal Source — rotate hologram, move scan line
        if (ud.holo) {
            ud.holo.rotation.y += dt * 0.5;
            ud.holoMat.opacity = 0.1 + Math.sin(t * 2) * 0.06;
        }
        if (ud.scanLine) {
            ud.scanLine.position.y = 3.2 + Math.sin(t * 2) * 0.8;
        }

        // Glow pulse (all types)
        if (ud.glowMat) {
            ud.glowMat.opacity = 0.2 + Math.sin(t * 1.5) * 0.1;
        }
    }
}

// ── Proximity detection ─────────────────────────────────────────────────────

const DETECTION_RADIUS = 10;
let _currentPanelAnomaly = null;

export function updateAnomalyProximity(dt) {
    const playerMesh = planetState.controlTarget || planetState.playerMesh;
    if (!playerMesh || !planetState.anomalies) return;

    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;
    const rSq = DETECTION_RADIUS * DETECTION_RADIUS;

    let nearest = null;
    let nearestDistSq = rSq;

    for (const anomaly of planetState.anomalies) {
        if (anomaly.investigated) continue;
        const dx = px - anomaly.position.x;
        const dz = pz - anomaly.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
            nearest = anomaly;
        }
    }

    if (nearest && _currentPanelAnomaly !== nearest) {
        _currentPanelAnomaly = nearest;
        _showDiscoveryPanel(nearest);
    } else if (!nearest && _currentPanelAnomaly) {
        _currentPanelAnomaly = null;
        hideDiscoveryPanel();
    }
}

// ── Discovery panel UI ──────────────────────────────────────────────────────

function _rewardString(reward) {
    const parts = [];
    if (reward.energy) parts.push(`+${reward.energy} ⚡`);
    if (reward.minerals) parts.push(`+${reward.minerals} 💎`);
    if (reward.food) parts.push(`+${reward.food} 🌿`);
    return parts.join('  ');
}

function _showDiscoveryPanel(anomaly) {
    const panel = document.getElementById('discovery-panel');
    if (!panel) return;

    const iconEl = document.getElementById('discovery-icon');
    const labelEl = document.getElementById('discovery-label');
    const descEl = document.getElementById('discovery-desc');
    const rewardEl = document.getElementById('discovery-reward');
    const btn = document.getElementById('discovery-investigate-btn');

    if (iconEl) iconEl.textContent = anomaly.icon;
    if (labelEl) labelEl.textContent = anomaly.label;
    if (descEl) descEl.textContent = anomaly.desc;
    if (rewardEl) rewardEl.textContent = _rewardString(anomaly.reward);
    if (btn) btn.onclick = () => _investigateAnomaly(anomaly);

    panel.classList.remove('hidden');
}

export function hideDiscoveryPanel() {
    _currentPanelAnomaly = null;
    const panel = document.getElementById('discovery-panel');
    if (panel) panel.classList.add('hidden');
}

function _investigateAnomaly(anomaly) {
    anomaly.investigated = true;

    // Grant rewards
    if (anomaly.reward.energy) gameState.resources.energy += anomaly.reward.energy;
    if (anomaly.reward.minerals) gameState.resources.minerals += anomaly.reward.minerals;
    if (anomaly.reward.food) gameState.resources.food += anomaly.reward.food;
    events.dispatchEvent(new CustomEvent('resources-updated'));

    showNotification(`${anomaly.icon} ${anomaly.label} investigated! ${_rewardString(anomaly.reward)}`, 'success');

    // Mark mesh as investigated (triggers dim in animation loop)
    if (anomaly.meshRef) {
        anomaly.meshRef.userData.investigated = true;
    }

    // Energy burst VFX at anomaly position
    _spawnInvestigateEffect(anomaly);

    hideDiscoveryPanel();
}

function _spawnInvestigateEffect(anomaly) {
    if (!planetState.explorationGroup || !anomaly.meshRef) return;
    const pos = anomaly.meshRef.position;

    // Burst sprite
    const burst = new THREE.Sprite(new THREE.SpriteMaterial({
        color: anomaly.glowColor, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    burst.position.copy(pos);
    burst.position.y += 3;
    burst.scale.set(2, 2, 1);
    planetState.explorationGroup.add(burst);

    const _fade = () => {
        burst.material.opacity -= 0.04;
        burst.scale.multiplyScalar(1.06);
        if (burst.material.opacity > 0.02) {
            requestAnimationFrame(_fade);
        } else {
            burst.removeFromParent();
            burst.material.dispose();
        }
    };
    requestAnimationFrame(_fade);
}

// ── Procedural encounter system ─────────────────────────────────────────────

const ENCOUNTER_TYPES = {
    meteor_shower: { label: 'Meteor Shower', weight: 1.0, duration: 8 },
    energy_surge: { label: 'Energy Surge', weight: 1.0, duration: 3 },
    creature_migration: { label: 'Creature Migration', weight: 1.0, duration: 10, needsCreatures: true },
    distress_signal: { label: 'Distress Signal', weight: 0.6, duration: 30 },
};

export function updateEncounterTimer(dt) {
    if (planetState._ascending) return;
    if (!planetState._encounterRand) return;

    // Active encounter in progress
    if (planetState._activeEncounter) {
        const enc = planetState._activeEncounter;
        enc.elapsed += dt;
        _updateEncounter(enc, dt);
        if (enc.elapsed >= enc.duration) {
            _endEncounter(enc);
            planetState._activeEncounter = null;
        }
        return;
    }

    planetState._encounterTimer += dt;
    if (planetState._encounterTimer >= planetState._encounterCooldown) {
        planetState._encounterTimer = 0;
        planetState._encounterCooldown = 45 + planetState._encounterRand() * 45;
        _triggerRandomEncounter();
    }
}

function _triggerRandomEncounter() {
    const rand = planetState._encounterRand;
    const hasCreatures = planetState.creatures && planetState.creatures.length > 0;

    const pool = [];
    let totalWeight = 0;
    for (const [key, def] of Object.entries(ENCOUNTER_TYPES)) {
        if (def.needsCreatures && !hasCreatures) continue;
        pool.push({ key, def });
        totalWeight += def.weight;
    }
    if (pool.length === 0) return;

    let pick = rand() * totalWeight;
    let chosen = pool[0];
    for (const entry of pool) {
        pick -= entry.def.weight;
        if (pick <= 0) { chosen = entry; break; }
    }

    const enc = {
        type: chosen.key,
        elapsed: 0,
        duration: chosen.def.duration,
        data: {},
    };

    // Init encounter-specific data
    const playerMesh = planetState.controlTarget || planetState.playerMesh;
    const px = playerMesh ? playerMesh.position.x : 0;
    const pz = playerMesh ? playerMesh.position.z : 0;

    if (enc.type === 'meteor_shower') {
        enc.data.nextImpact = 0.5;
        enc.data.deposits = [];
        showNotification('☄️ Meteor shower detected nearby!', 'alert');
    } else if (enc.type === 'energy_surge') {
        // Screen flash + immediate reward
        gameState.resources.energy += 30;
        events.dispatchEvent(new CustomEvent('resources-updated'));
        showNotification('⚡ Energy surge! +30 energy', 'success');
        const overlay = document.getElementById('encounter-flash-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('energy-surge');
            setTimeout(() => {
                overlay.classList.remove('energy-surge');
                overlay.classList.add('hidden');
            }, 800);
        }
    } else if (enc.type === 'creature_migration') {
        // Pick migration direction
        const angle = Math.random() * Math.PI * 2;
        enc.data.dirX = Math.cos(angle);
        enc.data.dirZ = Math.sin(angle);
        enc.data.origPositions = planetState.creatures.map(c => ({
            x: c.userData.originX, z: c.userData.originZ,
        }));
        showNotification('🦎 Creature migration in progress!', 'info');
    } else if (enc.type === 'distress_signal') {
        // Spawn temporary beacon
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        const bx = px + Math.cos(angle) * dist;
        const bz = pz + Math.sin(angle) * dist;
        const by = getTerrainHeightFast(bx, bz);

        const beaconGroup = new THREE.Group();
        beaconGroup.position.set(bx, by, bz);

        // Pillar
        const pillarMat = new THREE.MeshBasicMaterial({
            color: 0xff6633, transparent: true, opacity: 0.3,
        });
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 10, 8), pillarMat);
        pillar.position.y = 5;
        beaconGroup.add(pillar);

        // Top glow
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            color: 0xff6633, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.position.y = 10;
        glow.scale.set(4, 4, 1);
        beaconGroup.add(glow);

        if (planetState.explorationGroup) planetState.explorationGroup.add(beaconGroup);
        enc.data.beacon = beaconGroup;
        enc.data.bx = bx;
        enc.data.bz = bz;
        enc.data.collected = false;
        planetState._encounterMeshes.push(beaconGroup);
        showNotification('🆘 Distress signal detected! Investigate before it fades!', 'alert');
    }

    planetState._activeEncounter = enc;
}

function _updateEncounter(enc, dt) {
    const playerMesh = planetState.controlTarget || planetState.playerMesh;

    if (enc.type === 'meteor_shower') {
        enc.data.nextImpact -= dt;
        if (enc.data.nextImpact <= 0 && planetState.explorationGroup && playerMesh) {
            enc.data.nextImpact = 0.6 + Math.random() * 0.8;

            const px = playerMesh.position.x + (Math.random() - 0.5) * 40;
            const pz = playerMesh.position.z + (Math.random() - 0.5) * 40;
            const py = getTerrainHeightFast(px, pz);

            // Impact flash
            const flash = new THREE.Sprite(new THREE.SpriteMaterial({
                color: 0xffaa33, transparent: true, opacity: 0.9,
                blending: THREE.AdditiveBlending, depthWrite: false,
            }));
            flash.position.set(px, py + 1, pz);
            flash.scale.set(3, 3, 1);
            planetState.explorationGroup.add(flash);
            const _fadeFlash = () => {
                flash.material.opacity -= 0.06;
                flash.scale.multiplyScalar(0.93);
                if (flash.material.opacity > 0.02) requestAnimationFrame(_fadeFlash);
                else { flash.removeFromParent(); flash.material.dispose(); }
            };
            requestAnimationFrame(_fadeFlash);

            // Mineral deposit (clickable glow)
            const depMat = new THREE.MeshStandardMaterial({
                color: 0x88aaff, emissive: 0x4466cc, emissiveIntensity: 0.6,
                transparent: true, opacity: 0.8,
            });
            const dep = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), depMat);
            dep.position.set(px, py + 0.4, pz);
            dep.userData.isMeteorDeposit = true;
            dep.userData.life = 15;
            planetState.explorationGroup.add(dep);
            enc.data.deposits.push(dep);
            planetState._encounterMeshes.push(dep);
        }

        // Fade deposits over time
        for (let i = enc.data.deposits.length - 1; i >= 0; i--) {
            const dep = enc.data.deposits[i];
            dep.userData.life -= dt;
            if (dep.userData.life <= 3) {
                dep.material.opacity = Math.max(0, dep.userData.life / 3 * 0.8);
            }
            if (dep.userData.life <= 0) {
                dep.removeFromParent();
                dep.geometry.dispose();
                dep.material.dispose();
                enc.data.deposits.splice(i, 1);
            }
        }
    }

    if (enc.type === 'creature_migration' && planetState.creatures.length > 0) {
        const progress = Math.min(enc.elapsed / enc.duration, 1);
        const shift = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        for (let i = 0; i < planetState.creatures.length; i++) {
            const c = planetState.creatures[i];
            const orig = enc.data.origPositions[i];
            if (!orig) continue;
            c.userData.originX = orig.x + enc.data.dirX * shift * 30;
            c.userData.originZ = orig.z + enc.data.dirZ * shift * 30;
            c.userData.speed = 0.4 + shift * 0.4;
        }
    }

    if (enc.type === 'distress_signal' && !enc.data.collected && playerMesh) {
        // Check proximity to beacon
        const dx = playerMesh.position.x - enc.data.bx;
        const dz = playerMesh.position.z - enc.data.bz;
        if (dx * dx + dz * dz < 64) { // 8 units
            enc.data.collected = true;
            gameState.resources.energy += 100;
            gameState.resources.minerals += 100;
            gameState.resources.food += 100;
            events.dispatchEvent(new CustomEvent('resources-updated'));
            showNotification('🆘 Distress signal recovered! +100 ⚡ +100 💎 +100 🌿', 'success');

            if (enc.data.beacon) {
                enc.data.beacon.removeFromParent();
            }
        }

        // Pulse beacon glow
        if (enc.data.beacon && !enc.data.collected) {
            const remaining = enc.duration - enc.elapsed;
            const urgency = remaining < 10 ? 1 + Math.sin(enc.elapsed * 8) * 0.5 : 1;
            enc.data.beacon.children.forEach(child => {
                if (child.material && child.material.opacity !== undefined) {
                    child.material.opacity = (child.isSprite ? 0.5 : 0.25) * urgency;
                }
            });
        }
    }
}

function _endEncounter(enc) {
    if (enc.type === 'creature_migration' && enc.data.origPositions) {
        // Restore original creature positions
        for (let i = 0; i < planetState.creatures.length; i++) {
            const c = planetState.creatures[i];
            const orig = enc.data.origPositions[i];
            if (!orig) continue;
            c.userData.originX = orig.x;
            c.userData.originZ = orig.z;
            c.userData.speed = c.userData._baseSpeed || 0.15;
        }
    }

    if (enc.type === 'distress_signal' && enc.data.beacon && !enc.data.collected) {
        enc.data.beacon.removeFromParent();
        showNotification('🆘 Distress signal faded...', 'info');
    }

    // Clean up remaining meteor deposits
    if (enc.type === 'meteor_shower' && enc.data.deposits) {
        for (const dep of enc.data.deposits) {
            dep.removeFromParent();
            dep.geometry.dispose();
            dep.material.dispose();
        }
        enc.data.deposits = [];
    }
}

// ── Tap handler for meteor deposits ─────────────────────────────────────────

export function handleAnomalyTap(raycaster) {
    // Check meteor deposits
    const enc = planetState._activeEncounter;
    if (enc && enc.type === 'meteor_shower' && enc.data.deposits) {
        const hits = raycaster.intersectObjects(enc.data.deposits, false);
        if (hits.length > 0) {
            const dep = hits[0].object;
            if (dep.userData.isMeteorDeposit) {
                gameState.resources.minerals += 15;
                events.dispatchEvent(new CustomEvent('resources-updated'));
                showNotification('⛏️ Meteor minerals collected! +15 💎', 'success');
                dep.removeFromParent();
                dep.geometry.dispose();
                dep.material.dispose();
                const idx = enc.data.deposits.indexOf(dep);
                if (idx >= 0) enc.data.deposits.splice(idx, 1);
                return true;
            }
        }
    }
    return false;
}
