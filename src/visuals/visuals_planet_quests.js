/**
 * Planet surface quest system.
 * Generates quests on landing, builds 3D markers, checks proximity each frame,
 * grants resource rewards, and updates a DOM-based quest tracker.
 */
import * as THREE from 'three';
import { gameState, events } from '../core/state.js';
import { showNotification } from '../ui/ui_notifications.js';
import planetState from './visuals_planet_state.js';
import { getTerrainHeight } from './visuals_planet_terrain.js';
import { textures } from '../core/assets.js';

// ── Quest type definitions ──────────────────────────────────────────────────

const QUEST_TYPES = {
    creature_scan: {
        label: 'Scan Alien Lifeforms',
        desc: 'Fly near alien creatures to scan their biology.',
        icon: '🔬',
        target: 3,
        reward: { energy: 0, minerals: 0, food: 50 },
        triggerRadius: 14,
        needsCreatures: true,
    },
    mineral_survey: {
        label: 'Survey Mineral Deposit',
        desc: 'Fly to the mineral deposit and collect geological data.',
        icon: '⛏️',
        target: 1,
        reward: { energy: 0, minerals: 80, food: 0 },
        triggerRadius: 10,
    },
    outpost_site: {
        label: 'Scout Outpost Location',
        desc: 'Investigate a potential site for a forward outpost.',
        icon: '🏕️',
        target: 1,
        reward: { energy: 30, minerals: 60, food: 0 },
        triggerRadius: 10,
        markerDistMin: 60,
        markerDistMax: 120,
    },
    ruin_investigate: {
        label: 'Investigate Ancient Ruins',
        desc: 'Explore the alien ruins and recover artifacts.',
        icon: '🏛️',
        target: 1,
        reward: { energy: 0, minerals: 100, food: 0 },
        triggerRadius: 10,
        favorsTypes: ['Tomb', 'Barren', 'Desert'],
    },
    atmosphere_sample: {
        label: 'Collect Atmosphere Sample',
        desc: 'Fly to the elevated sampling point to gather atmospheric data.',
        icon: '🌫️',
        target: 1,
        reward: { energy: 60, minerals: 0, food: 0 },
        triggerRadius: 10,
    },
    patrol_route: {
        label: 'Patrol Perimeter',
        desc: 'Visit all waypoints to secure the colony perimeter.',
        icon: '🛡️',
        target: 3,
        reward: { energy: 40, minerals: 40, food: 0 },
        triggerRadius: 12,
        needsColony: true,
        isSequential: true,
    },
    creature_census: {
        label: 'Creature Census',
        desc: 'Fly near both creature species to log their population data.',
        icon: '📋',
        target: 2,
        reward: { energy: 0, minerals: 20, food: 60 },
        triggerRadius: 16,
        needsCreatures: true,
    },
    beacon_deploy: {
        label: 'Deploy Signal Beacon',
        desc: 'Place a signal beacon at the designated coordinates.',
        icon: '📡',
        target: 1,
        reward: { energy: 80, minerals: 0, food: 0 },
        triggerRadius: 10,
        needsColony: true,
    },
    water_sample: {
        label: 'Collect Water Sample',
        desc: 'Fly to the water body and extract a sample for analysis.',
        icon: '💧',
        target: 1,
        reward: { energy: 0, minerals: 20, food: 70 },
        triggerRadius: 12,
        favorsTypes: ['Ocean', 'Terran', 'Continental', 'Ice', 'Arctic'],
    },
    geological_core: {
        label: 'Extract Core Sample',
        desc: 'Drill at the geological site to extract a deep core sample.',
        icon: '🪨',
        target: 1,
        reward: { energy: 0, minerals: 100, food: 0 },
        triggerRadius: 10,
        markerDistMin: 50,
        markerDistMax: 100,
    },
    flora_catalog: {
        label: 'Catalog Native Flora',
        desc: 'Visit vegetation clusters to document native plant species.',
        icon: '🌿',
        target: 3,
        reward: { energy: 0, minerals: 0, food: 90 },
        triggerRadius: 12,
        isSequential: true,
        needsCreatures: true, // proxy for "has vegetation" — Barren/Tomb excluded
    },
    energy_anomaly: {
        label: 'Investigate Energy Anomaly',
        desc: 'Locate the source of an unusual energy signature.',
        icon: '⚡',
        target: 1,
        reward: { energy: 90, minerals: 0, food: 0 },
        triggerRadius: 10,
        favorsTypes: ['Molten', 'Tomb'],
        markerDistMin: 55,
        markerDistMax: 110,
    },
    artifact_recovery: {
        label: 'Recover Alien Artifact',
        desc: 'Excavate the buried artifact detected by orbital scans.',
        icon: '🏺',
        target: 1,
        reward: { energy: 40, minerals: 60, food: 0 },
        triggerRadius: 10,
        markerDistMin: 45,
        markerDistMax: 95,
    },
    terrain_mapping: {
        label: 'Map Terrain Features',
        desc: 'Visit elevated terrain points to complete the surface map.',
        icon: '🗺️',
        target: 3,
        reward: { energy: 30, minerals: 50, food: 0 },
        triggerRadius: 12,
        isSequential: true,
    },
    comms_relay: {
        label: 'Establish Comms Relay',
        desc: 'Deploy a communications relay at a strategic high point.',
        icon: '📶',
        target: 1,
        reward: { energy: 70, minerals: 30, food: 0 },
        triggerRadius: 10,
        needsColony: true,
        markerDistMin: 70,
        markerDistMax: 130,
    },
    seismic_scan: {
        label: 'Seismic Activity Scan',
        desc: 'Deploy sensors at the fault line to measure tectonic activity.',
        icon: '📊',
        target: 2,
        reward: { energy: 40, minerals: 70, food: 0 },
        triggerRadius: 11,
        isSequential: true,
        favorsTypes: ['Molten', 'Barren', 'Desert'],
    },
    supply_cache: {
        label: 'Locate Supply Cache',
        desc: 'Retrieve a supply cache dropped during an earlier expedition.',
        icon: '📦',
        target: 1,
        reward: { energy: 30, minerals: 30, food: 30 },
        triggerRadius: 10,
        markerDistMin: 35,
        markerDistMax: 80,
    },
    bio_hazard: {
        label: 'Neutralize Bio-Hazard',
        desc: 'Fly to the contamination zone and deploy decontaminant.',
        icon: '☣️',
        target: 1,
        reward: { energy: 50, minerals: 0, food: 50 },
        triggerRadius: 10,
        needsCreatures: true,
        favorsTypes: ['Terran', 'Continental', 'Ocean'],
    },
};

// ── Seeded random from planet ID ────────────────────────────────────────────

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

// ── Quest generation ────────────────────────────────────────────────────────

export function generatePlanetQuests(planetData) {
    const hasColony = !!gameState.colonies[planetData.id];
    const hasCreatures = !['Barren', 'Tomb'].includes(planetData.type);
    const rand = _seededRandom(_hash(planetData.id + '_quests') + (gameState.date ? gameState.date.getTime() * 0.0000001 : 0));

    // Build eligible pool
    const pool = [];
    for (const [typeKey, def] of Object.entries(QUEST_TYPES)) {
        if (def.needsColony && !hasColony) continue;
        if (def.needsCreatures && !hasCreatures) continue;

        // Check recently completed on this planet
        const recentlyDone = gameState.completedSurfaceQuests.some(
            q => q.planetId === planetData.id && q.questType === typeKey
        );
        if (recentlyDone) continue;

        // Weight: favored types get higher chance
        let weight = 1;
        if (def.favorsTypes && def.favorsTypes.includes(planetData.type)) weight = 2.5;
        pool.push({ typeKey, def, weight, sortVal: rand() * weight });
    }

    // Sort by weighted random and pick 3-4
    pool.sort((a, b) => b.sortVal - a.sortVal);
    const count = pool.length >= 4 ? (rand() < 0.5 ? 4 : 3) : Math.min(pool.length, 3);
    const quests = [];

    for (let i = 0; i < count; i++) {
        const { typeKey, def } = pool[i];
        const angle = (i / count) * Math.PI * 2 + rand() * 0.8;
        const distMin = def.markerDistMin || 40;
        const distMax = def.markerDistMax || 90;
        const dist = distMin + rand() * (distMax - distMin);

        const quest = {
            id: `q_${planetData.id}_${typeKey}_${i}`,
            type: typeKey,
            status: 'active',
            label: def.label,
            desc: def.desc,
            icon: def.icon,
            progress: 0,
            target: def.target,
            reward: { ...def.reward },
            triggerRadius: def.triggerRadius || 10,
            isSequential: !!def.isSequential,
            markerPos: null,          // set below
            markerRef: null,          // set when 3D markers built
            subMarkers: [],           // for patrol_route waypoints
            _scannedCreatures: new Set(), // for creature_scan tracking
        };

        if (def.isSequential) {
            // Multiple waypoints
            const waypoints = [];
            for (let w = 0; w < def.target; w++) {
                const wa = (w / def.target) * Math.PI * 2 + rand() * 0.5 + angle;
                const wd = 50 + rand() * 60;
                waypoints.push({ x: Math.cos(wa) * wd, z: Math.sin(wa) * wd });
            }
            quest.markerPos = waypoints[0];
            quest.subMarkers = waypoints;
        } else {
            quest.markerPos = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
        }

        quests.push(quest);
    }

    return quests;
}

// ── 3D Marker construction ──────────────────────────────────────────────────

const MARKER_COLOR = 0x00f2ff;
const MARKER_COMPLETE_COLOR = 0xffaa00;

function _createSingleMarker(pos, quest) {
    const group = new THREE.Group();
    const groundY = getTerrainHeight(pos.x, pos.z);
    group.position.set(pos.x, groundY, pos.z);

    // Glowing pillar
    const pillarGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 6);
    const pillarMat = new THREE.MeshBasicMaterial({
        color: MARKER_COLOR,
        transparent: true,
        opacity: 0.5,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 4;
    group.add(pillar);

    // Ground ring
    const ringGeo = new THREE.RingGeometry(1.4, 1.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
        color: MARKER_COLOR,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);

    // Top glow sphere
    const sphereGeo = new THREE.SphereGeometry(0.45, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
        color: MARKER_COLOR,
        transparent: true,
        opacity: 0.8,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.y = 8.5;
    group.add(sphere);

    // Glow sprite on top
    if (textures.glow) {
        const spriteMat = new THREE.SpriteMaterial({
            map: textures.glow,
            color: MARKER_COLOR,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(4, 4, 1);
        sprite.position.y = 8.5;
        group.add(sprite);
    }

    group.userData = {
        isQuestMarker: true,
        questId: quest.id,
        questType: quest.type,
        pulsePhase: Math.random() * Math.PI * 2,
        completePop: 0,
        removeAfter: -1,
        pillarMat,
        ringMat,
        sphereMat,
        ring,
        sphere,
    };

    return group;
}

export function createQuestMarkers(quests, questGroup) {
    for (const quest of quests) {
        if (quest.isSequential && quest.subMarkers.length > 0) {
            // Create markers for all waypoints, only first visible
            quest.subMarkers.forEach((wp, idx) => {
                const marker = _createSingleMarker(wp, quest);
                marker.userData.waypointIndex = idx;
                marker.visible = idx === 0; // only show current waypoint
                questGroup.add(marker);
                if (idx === 0) quest.markerRef = marker;
            });
        } else {
            const marker = _createSingleMarker(quest.markerPos, quest);
            questGroup.add(marker);
            quest.markerRef = marker;
        }
    }
}

// ── Per-frame marker animation ──────────────────────────────────────────────

export function updateQuestMarkerAnims(dt, time) {
    if (!planetState.questGroup) return;

    for (const marker of planetState.questGroup.children) {
        if (!marker.userData.isQuestMarker) continue;
        const ud = marker.userData;

        // Removal countdown
        if (ud.removeAfter > 0) {
            ud.removeAfter -= dt;
            // Fade out
            const fade = Math.max(0, ud.removeAfter / 0.5);
            if (ud.pillarMat) ud.pillarMat.opacity = 0.5 * fade;
            if (ud.ringMat) ud.ringMat.opacity = 0.35 * fade;
            if (ud.sphereMat) ud.sphereMat.opacity = 0.8 * fade;
            marker.scale.setScalar(1 + (1 - fade) * 0.3);
            if (ud.removeAfter <= 0) {
                marker.visible = false;
            }
            continue;
        }

        // Completion pop
        if (ud.completePop > 0) {
            ud.completePop -= dt;
            const t = 1 - ud.completePop / 0.3;
            marker.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.4);
            continue;
        }

        // Idle pulse
        const pulse = 0.85 + Math.sin(time * 2 + ud.pulsePhase) * 0.15;
        if (ud.ring) {
            ud.ring.scale.setScalar(pulse);
            ud.ringMat.opacity = 0.25 + Math.sin(time * 2.5 + ud.pulsePhase) * 0.1;
        }
        if (ud.sphere) {
            ud.sphere.position.y = 8.5 + Math.sin(time * 1.5 + ud.pulsePhase) * 0.3;
        }
    }
}

// ── Proximity completion ────────────────────────────────────────────────────

const RESOURCE_ICONS = { energy: '⚡', minerals: '⛏️', food: '🌾' };

function _rewardString(reward) {
    const parts = [];
    for (const [res, amt] of Object.entries(reward)) {
        if (amt > 0) parts.push(`+${amt} ${RESOURCE_ICONS[res] || res}`);
    }
    return parts.join('  ');
}

function _grantReward(reward) {
    if (reward.energy) gameState.resources.energy += reward.energy;
    if (reward.minerals) gameState.resources.minerals += reward.minerals;
    if (reward.food) gameState.resources.food += reward.food;
    events.dispatchEvent(new CustomEvent('resources-updated'));
}

function _completeQuest(quest) {
    quest.status = 'complete';
    _grantReward(quest.reward);

    const rewardStr = _rewardString(quest.reward);
    showNotification(`${quest.icon} ${quest.label} complete! ${rewardStr}`, 'success');

    // Record completion
    gameState.completedSurfaceQuests.push({
        planetId: planetState.currentPlanetData?.id,
        questType: quest.type,
        completedAt: gameState.date ? gameState.date.getTime() : Date.now(),
    });

    // Marker completion animation
    if (quest.markerRef) {
        const ud = quest.markerRef.userData;
        ud.completePop = 0.3;
        // Change color to amber
        if (ud.pillarMat) ud.pillarMat.color.setHex(MARKER_COMPLETE_COLOR);
        if (ud.ringMat) ud.ringMat.color.setHex(MARKER_COMPLETE_COLOR);
        if (ud.sphereMat) ud.sphereMat.color.setHex(MARKER_COMPLETE_COLOR);
        // Schedule removal
        ud.removeAfter = 0.5;
    }

    // For sequential quests, hide remaining sub-markers
    if (quest.isSequential && planetState.questGroup) {
        for (const child of planetState.questGroup.children) {
            if (child.userData.questId === quest.id) {
                child.userData.removeAfter = 0.5;
            }
        }
    }

    updateQuestTrackerUI();
}

export function updateQuestProximity(dt) {
    const playerMesh = planetState.controlTarget || planetState.playerMesh;
    if (!playerMesh || !planetState.quests) return;

    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    for (const quest of planetState.quests) {
        if (quest.status !== 'active') continue;

        if (quest.type === 'creature_scan' || quest.type === 'creature_census') {
            // Check proximity to creatures
            for (const creature of planetState.creatures) {
                const cx = creature.position.x;
                const cz = creature.position.z;
                const distSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
                const rSq = quest.triggerRadius * quest.triggerRadius;
                if (distSq < rSq) {
                    const cId = creature.uuid;
                    if (!quest._scannedCreatures.has(cId)) {
                        quest._scannedCreatures.add(cId);
                        quest.progress++;
                        updateQuestTrackerUI();

                        if (quest.progress >= quest.target) {
                            _completeQuest(quest);
                        } else {
                            showNotification(`${quest.icon} Scanned creature (${quest.progress}/${quest.target})`, 'info');
                        }
                    }
                }
            }
        } else if (quest.isSequential) {
            // Patrol route — check current waypoint
            const wpIdx = quest.progress;
            if (wpIdx >= quest.subMarkers.length) continue;
            const wp = quest.subMarkers[wpIdx];
            const distSq = (px - wp.x) * (px - wp.x) + (pz - wp.z) * (pz - wp.z);
            const rSq = quest.triggerRadius * quest.triggerRadius;
            if (distSq < rSq) {
                quest.progress++;

                // Hide current waypoint marker, show next
                if (planetState.questGroup) {
                    for (const child of planetState.questGroup.children) {
                        if (child.userData.questId === quest.id && child.userData.waypointIndex === wpIdx) {
                            child.userData.removeAfter = 0.3;
                        }
                        if (child.userData.questId === quest.id && child.userData.waypointIndex === wpIdx + 1) {
                            child.visible = true;
                            quest.markerRef = child;
                        }
                    }
                }

                updateQuestTrackerUI();

                if (quest.progress >= quest.target) {
                    _completeQuest(quest);
                } else {
                    showNotification(`${quest.icon} Waypoint reached (${quest.progress}/${quest.target})`, 'info');
                }
            }
        } else {
            // Standard single-marker proximity
            const mp = quest.markerPos;
            const distSq = (px - mp.x) * (px - mp.x) + (pz - mp.z) * (pz - mp.z);
            const rSq = quest.triggerRadius * quest.triggerRadius;
            if (distSq < rSq) {
                quest.progress = quest.target;
                _completeQuest(quest);
            }
        }
    }
}

// ── Quest Tracker UI ────────────────────────────────────────────────────────

export function updateQuestTrackerUI() {
    const tracker = document.getElementById('quest-tracker');
    if (!tracker) return;

    const quests = planetState.quests || [];
    if (quests.length === 0) {
        tracker.classList.add('hidden');
        return;
    }

    tracker.classList.remove('hidden');

    const completedCount = quests.filter(q => q.status === 'complete').length;
    const countEl = document.getElementById('qt-count');
    if (countEl) countEl.textContent = `${completedCount}/${quests.length}`;

    const listEl = document.getElementById('qt-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    for (const quest of quests) {
        const isComplete = quest.status === 'complete';
        const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));

        const rewardParts = [];
        for (const [res, amt] of Object.entries(quest.reward)) {
            if (amt > 0) rewardParts.push(`+${amt}${RESOURCE_ICONS[res] || ''}`);
        }

        const item = document.createElement('div');
        item.className = `qt-item${isComplete ? ' qt-complete' : ''}`;
        item.dataset.questId = quest.id;
        item.innerHTML = `
            <div class="qt-item-dot${isComplete ? ' qt-dot-done' : ''}"></div>
            <div class="qt-item-body">
                <div class="qt-item-label">${quest.icon} ${quest.label}</div>
                <div class="qt-item-progress-wrap">
                    <div class="qt-item-progress-bar" style="width: ${pct}%"></div>
                </div>
                <div class="qt-item-meta">${isComplete ? 'Complete' : `${quest.progress}/${quest.target}`}</div>
            </div>
            <div class="qt-item-reward">${rewardParts.join(' ')}</div>
        `;
        listEl.appendChild(item);
    }
}

// ── Quest info tooltip (on tap) ─────────────────────────────────────────────

let _questTooltipTimer = null;

export function showQuestTooltip(questId) {
    const quest = (planetState.quests || []).find(q => q.id === questId);
    if (!quest) return;

    const tooltip = document.getElementById('quest-tap-tooltip');
    if (!tooltip) return;

    document.getElementById('quest-tap-icon').textContent = quest.icon;
    document.getElementById('quest-tap-label').textContent = quest.label;
    document.getElementById('quest-tap-desc').textContent = quest.desc;
    document.getElementById('quest-tap-reward').textContent = _rewardString(quest.reward);

    tooltip.classList.remove('hidden');

    if (_questTooltipTimer) clearTimeout(_questTooltipTimer);
    _questTooltipTimer = setTimeout(() => {
        tooltip.classList.add('hidden');
    }, 3500);
}

export function hideQuestTooltip() {
    const tooltip = document.getElementById('quest-tap-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
    if (_questTooltipTimer) clearTimeout(_questTooltipTimer);
}
