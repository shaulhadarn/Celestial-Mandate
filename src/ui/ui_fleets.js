/* Updated: Upgraded ship modal with SVG stat icons, capabilities bars, weapon/special lists; replaced all emoji with SVG throughout fleets UI */
import { gameState, RACE_SHIPS, buildShip, cancelShipBuild, moveFleet, getConnectedSystems, events } from '../core/state.js';
import { showNotification } from './ui_notifications.js';
import { getShipSvg } from './ship_icons.js';
import { initShipViewer, disposeShipViewer } from './ship_viewer_3d.js';
import { getPlayerShipMeshes } from '../visuals/visuals_system_ships.js';
import { enterShipControl } from '../visuals/visuals_system_ship_control.js';
import { controls } from '../core/scene_config.js';
import { refreshSystemShips } from '../visuals/renderer.js';

// SVG icon templates for stat cells
const STAT_ICONS = {
    length: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="7" x2="3" y2="13"/><line x1="17" y1="7" x2="17" y2="13"/><line x1="8" y1="9" x2="12" y2="9"/></svg>`,
    crew: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="7" r="3"/><path d="M4 17 C4 13 7 11 10 11 C13 11 16 13 16 17"/></svg>`,
    power: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 L14 2 L10 9 L15 9 L8 18 L10 11 L5 11 Z"/></svg>`,
    minerals: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,7 17,13 10,18 3,13 3,7"/><line x1="10" y1="2" x2="10" y2="18" opacity="0.4"/><line x1="3" y1="7" x2="17" y2="13" opacity="0.4"/><line x1="17" y1="7" x2="3" y2="13" opacity="0.4"/></svg>`,
    energy: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11 2 L7 10 L10 10 L9 18 L13 10 L10 10 L11 2Z"/></svg>`,
    buildTime: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><line x1="10" y1="6" x2="10" y2="10"/><line x1="10" y1="10" x2="13" y2="13"/><circle cx="10" cy="10" r="1" fill="currentColor"/></svg>`,
    hull: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 L17 6 L17 14 L10 18 L3 14 L3 6 Z"/><path d="M10 6 L14 8 L14 12 L10 14 L6 12 L6 8 Z" opacity="0.5"/></svg>`,
    speed: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 14 Q10 4 17 14"/><line x1="10" y1="14" x2="13" y2="8"/><circle cx="10" cy="14" r="1.5" fill="currentColor"/></svg>`,
};

export function openShipModal(ship) {
    const modal   = document.getElementById('ship-detail-modal');
    const accent  = ship.accentColor || '#00c8ff';

    const iconEl = document.getElementById('ship-modal-icon');
    iconEl.innerHTML = getShipSvg(ship.id);
    iconEl.style.color = accent;
    document.getElementById('ship-modal-name').textContent  = ship.name;
    document.getElementById('ship-modal-class').textContent = ship.shipClass || '';
    document.getElementById('ship-modal-class').style.color = accent;

    const header = document.getElementById('ship-modal-header');
    header.style.borderBottom = `1px solid ${accent}44`;
    header.style.background   = `linear-gradient(90deg, ${accent}18 0%, transparent 100%)`;

    // Derive extra stats from ship data
    const hullHP = Math.round(ship.power * 120 + (ship.crew || 0) * 2);
    const speed = ship.crew === 0 ? 'Autonomous' : (ship.power <= 2 ? 'Fast' : ship.power <= 5 ? 'Standard' : 'Slow');

    document.getElementById('ship-modal-stats').innerHTML = [
        { label: 'Length',     value: ship.length || '—',                         icon: STAT_ICONS.length },
        { label: 'Crew',       value: ship.crew === 0 ? 'Unmanned' : (ship.crew || '—'), icon: STAT_ICONS.crew },
        { label: 'Power',      value: ship.power,                                 icon: STAT_ICONS.power },
        { label: 'Hull HP',    value: hullHP,                                      icon: STAT_ICONS.hull },
        { label: 'Speed',      value: speed,                                       icon: STAT_ICONS.speed },
        { label: 'Minerals',   value: ship.cost.minerals,                          icon: STAT_ICONS.minerals },
        { label: 'Energy',     value: ship.cost.energy,                            icon: STAT_ICONS.energy },
        { label: 'Build Time', value: `${ship.buildTime}s`,                        icon: STAT_ICONS.buildTime },
    ].map(s => `
        <div class="ship-stat-cell">
            <div class="ship-stat-icon" style="color:${accent}">${s.icon}</div>
            <div class="ship-stat-label">${s.label}</div>
            <div class="ship-stat-value" style="color:${accent}">${s.value}</div>
        </div>
    `).join('');

    // Capabilities bars
    const maxPower = 11;
    const capEntries = [
        { label: 'Firepower',  pct: Math.min(100, (ship.power / maxPower) * 100) },
        { label: 'Durability', pct: Math.min(100, (hullHP / 1500) * 100) },
        { label: 'Agility',   pct: ship.power <= 2 ? 90 : ship.power <= 5 ? 55 : 25 },
    ];
    const capsEl = document.getElementById('ship-modal-capabilities');
    if (capsEl) {
        capsEl.innerHTML = capEntries.map(c => `
            <div class="ship-cap-row">
                <span class="ship-cap-label">${c.label}</span>
                <div class="ship-cap-bar-bg">
                    <div class="ship-cap-bar-fill" style="width:${c.pct}%; background:${accent};"></div>
                </div>
                <span class="ship-cap-pct" style="color:${accent}">${Math.round(c.pct)}%</span>
            </div>
        `).join('');
    }

    // Weapons list with bullet SVGs
    const weaponsList = (ship.weapons || '—').split(',').map(w => w.trim());
    document.getElementById('ship-modal-weapons').innerHTML = weaponsList.map(w => `
        <div class="ship-weapon-item">
            <svg viewBox="0 0 16 16" fill="currentColor" class="ship-bullet-icon" style="color:${accent}"><circle cx="8" cy="8" r="3" opacity="0.8"/><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/></svg>
            <span>${w}</span>
        </div>
    `).join('');

    // Special systems list with bullet SVGs
    const specialList = (ship.special || '—').split(',').map(s => s.trim());
    document.getElementById('ship-modal-special').innerHTML = specialList.map(s => `
        <div class="ship-weapon-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="ship-bullet-icon" style="color:${accent}"><rect x="3" y="3" width="10" height="10" rx="2"/><circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6"/></svg>
            <span>${s}</span>
        </div>
    `).join('');

    document.getElementById('ship-modal-story').textContent = ship.story || ship.desc;

    const box = modal.querySelector('.ship-modal-box');
    box.style.borderColor  = `${accent}55`;
    box.style.boxShadow    = `0 0 60px ${accent}22, 0 0 120px rgba(0,0,0,0.8)`;

    modal.classList.remove('hidden');

    // Launch 3D viewer after modal is visible so canvas has dimensions
    requestAnimationFrame(() => initShipViewer(ship.id, accent));
}

function _closeShipModal() {
    const overlay = document.getElementById('ship-detail-modal');
    if (overlay) overlay.classList.add('hidden');
    disposeShipViewer();
}

function initShipModal() {
    const closeBtn = document.getElementById('ship-modal-close');
    const overlay  = document.getElementById('ship-detail-modal');
    if (closeBtn) closeBtn.addEventListener('click', _closeShipModal);
    if (overlay)  overlay.addEventListener('click', (e) => {
        if (e.target === overlay) _closeShipModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) _closeShipModal();
    });
}

export function initFleetsUI() {
    initShipModal();
    const btn = document.getElementById('btn-fleets');
    const panel = document.getElementById('fleets-panel');
    const closeBtn = document.getElementById('btn-close-fleets');
    const content = document.getElementById('fleets-panel-content');

    if (btn) btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderFleetsPanel();
    });

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    // ── Single delegated click handler on stable content element ──
    // Buttons inside are destroyed/recreated every tick by renderFleetsPanel(),
    // so attaching handlers to individual buttons is unreliable.
    // Event delegation on the persistent parent catches clicks regardless.
    if (content) content.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // View ship details
        if (target.classList.contains('fsc-view-btn')) {
            const shipId = target.dataset.ship;
            const race = gameState.playerCivilization?.bodyType || 'humanoid';
            const ship = (RACE_SHIPS[race] || []).find(s => s.id === shipId);
            if (ship) openShipModal(ship);
            return;
        }

        // Build ship
        if (target.classList.contains('fsc-build-btn')) {
            const planetId = target.dataset.planet;
            const shipId = target.dataset.ship;
            if (buildShip(planetId, shipId)) {
                const race = gameState.playerCivilization?.bodyType || 'humanoid';
                const ship = (RACE_SHIPS[race] || []).find(s => s.id === shipId);
                showNotification(`🛸 ${ship?.name || shipId} construction started!`, 'info');
                renderFleetsPanel();
            } else {
                showNotification('Insufficient resources or no Shipyard!', 'alert');
            }
            return;
        }

        // Cancel build queue item
        if (target.classList.contains('fq-cancel')) {
            cancelShipBuild(target.dataset.planet, parseInt(target.dataset.idx));
            renderFleetsPanel();
            return;
        }

        // Move fleet — show dropdown
        if (target.classList.contains('fsr-move-btn')) {
            const fleetIdx = parseInt(target.dataset.fleetIdx);
            const fleet = gameState.fleets[fleetIdx];
            if (!fleet) return;
            const existing = target.parentElement.querySelector('.fsr-dest-picker');
            if (existing) { existing.remove(); return; }
            const connected = getConnectedSystems(fleet.systemId);
            if (connected.length === 0) {
                showNotification('No connected systems to move to!', 'alert');
                return;
            }
            const picker = document.createElement('div');
            picker.className = 'fsr-dest-picker';
            picker.innerHTML = connected.map(sys =>
                `<button class="fsr-dest-btn" data-dest="${sys.id}" data-fleet-idx="${fleetIdx}">${sys.name}</button>`
            ).join('');
            target.parentElement.appendChild(picker);
            return;
        }

        // Move fleet — destination chosen
        if (target.classList.contains('fsr-dest-btn')) {
            const destId = parseInt(target.dataset.dest);
            const fleetIdx = parseInt(target.dataset.fleetIdx);
            const fleet = gameState.fleets[fleetIdx];
            if (fleet && moveFleet(fleetIdx, destId)) {
                const connected = getConnectedSystems(fleet.systemId);
                const destSys = connected.find(s => s.id === destId);
                showNotification(`${fleet.name} departing for ${destSys?.name || 'unknown'}`, 'info');
                renderFleetsPanel();
            } else {
                showNotification('Cannot move to that system!', 'alert');
            }
            return;
        }

        // Fly ship — enter 3D ship control
        if (target.classList.contains('fsr-fly-btn')) {
            e.stopPropagation();
            const fleetId = target.dataset.fleetId;
            // Always refresh to ensure ships are spawned
            refreshSystemShips();
            const shipMeshes = getPlayerShipMeshes();
            const entry = shipMeshes.find(s => String(s.fleetData.id) === String(fleetId));
            if (entry) {
                enterShipControl(entry, controls);
                if (panel) panel.classList.add('hidden');
            } else {
                showNotification('Ship not found in current system view', 'alert');
            }
            return;
        }
    });

    events.addEventListener('ship-built', (e) => {
        showNotification(`⚓ ${e.detail.fleet.name} has been commissioned!`, 'success');
        if (panel && !panel.classList.contains('hidden')) renderFleetsPanel();
    });

    events.addEventListener('fleet-arrived', (e) => {
        showNotification(`${e.detail.fleet.name} arrived at ${e.detail.fleet.systemName}`, 'success');
        if (panel && !panel.classList.contains('hidden')) renderFleetsPanel();
    });

    events.addEventListener('tick', () => {
        if (panel && !panel.classList.contains('hidden')) {
            _updateShipQueueProgress();
            // Don't re-render while a move destination picker is open
            if (!panel.querySelector('.fsr-dest-picker')) {
                renderFleetsPanel();
            }
        }
    });
}

export function renderFleetsPanel() {
    const content = document.getElementById('fleets-panel-content');
    if (!content) return;
    content.innerHTML = '';

    const race = gameState.playerCivilization?.bodyType || 'humanoid';
    const raceShips = RACE_SHIPS[race] || [];

    // ── Section 1: Shipyards & Build Queues ──────────────────────────────────
    const shipyardPlanets = _getShipyardPlanets();

    const buildSection = document.createElement('div');
    buildSection.className = 'fleets-section';
    buildSection.innerHTML = `<h3 class="fleets-section-title">⚙ Shipyards</h3>`;

    if (shipyardPlanets.length === 0) {
        buildSection.innerHTML += `<div class="fleets-empty">No shipyards built yet. Construct a Shipyard on a colony to commission ships.</div>`;
    } else {
        shipyardPlanets.forEach(({ planetId, planetName, systemName, col }) => {
            const yard = document.createElement('div');
            yard.className = 'fleet-shipyard-card';
            yard.innerHTML = `
                <div class="fleet-yard-header">
                    <span class="fleet-yard-icon">🛸</span>
                    <div>
                        <div class="fleet-yard-name">${planetName}</div>
                        <div class="fleet-yard-system">${systemName}</div>
                    </div>
                </div>
            `;

            // Queue display
            const queue = col.shipQueue || [];
            if (queue.length > 0) {
                const queueEl = document.createElement('div');
                queueEl.className = 'fleet-queue';
                queueEl.innerHTML = `<div class="fleet-queue-label">Build Queue</div>`;
                queue.forEach((item, idx) => {
                    const ship = raceShips.find(s => s.id === item.shipId);
                    const pct = Math.floor((item.progress / item.total) * 100);
                    const qItem = document.createElement('div');
                    qItem.className = 'fleet-queue-item';
                    qItem.dataset.planetId = planetId;
                    qItem.dataset.queueIdx = idx;
                    qItem.innerHTML = `
                        <span class="fq-icon">${ship ? ship.icon : '🚀'}</span>
                        <div class="fq-info">
                            <div class="fq-name">${ship ? ship.name : item.shipId}</div>
                            <div class="fq-bar-wrap">
                                <div class="fq-bar" style="width:${pct}%"></div>
                            </div>
                        </div>
                        <span class="fq-pct">${pct}%</span>
                        <button class="fq-cancel" data-planet="${planetId}" data-idx="${idx}" title="Cancel (50% refund)">✕</button>
                    `;
                    queueEl.appendChild(qItem);
                });
                yard.appendChild(queueEl);
            }

            // Ship build options
            const buildOpts = document.createElement('div');
            buildOpts.className = 'fleet-build-opts';
            buildOpts.innerHTML = `<div class="fleet-build-label">Commission Ship</div>`;

            raceShips.forEach(ship => {
                const canAfford = gameState.resources.minerals >= ship.cost.minerals &&
                                  gameState.resources.energy   >= ship.cost.energy;
                const card = document.createElement('div');
                card.className = `fleet-ship-card ${canAfford ? '' : 'fleet-ship-disabled'}`;
                card.innerHTML = `
                    <div class="fsc-icon fsc-svg-icon" style="color:${ship.accentColor || '#00c8ff'}">${getShipSvg(ship.id)}</div>
                    <div class="fsc-info">
                        <div class="fsc-name">${ship.name}</div>
                        <div class="fsc-desc">${ship.desc}</div>
                        <div class="fsc-stats">
                            <span class="fsc-power"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="fsc-stat-svg"><path d="M4 1 L10 1 L7 6 L11 6 L5 13 L7 7 L3 7 Z"/></svg>${ship.power}</span>
                            <span class="fsc-cost"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" class="fsc-stat-svg fsc-mineral"><polygon points="7,1 12,4 12,10 7,13 2,10 2,4"/></svg>${ship.cost.minerals} <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" class="fsc-stat-svg fsc-energy"><path d="M8 1 L5 7 L7 7 L6 13 L9 7 L7 7 L8 1Z"/></svg>${ship.cost.energy}</span>
                            <span class="fsc-time"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" class="fsc-stat-svg"><circle cx="7" cy="7" r="5"/><line x1="7" y1="4" x2="7" y2="7"/><line x1="7" y1="7" x2="9" y2="9"/></svg>${ship.buildTime}s</span>
                        </div>
                    </div>
                    <button class="fsc-view-btn" data-ship="${ship.id}">View</button>
                    <button class="fsc-build-btn" data-planet="${planetId}" data-ship="${ship.id}" ${canAfford ? '' : 'disabled'}>
                        Build
                    </button>
                `;
                buildOpts.appendChild(card);
            });

            yard.appendChild(buildOpts);
            buildSection.appendChild(yard);
        });
    }
    content.appendChild(buildSection);

    // ── Section 2: Active Fleet ───────────────────────────────────────────────
    const fleetSection = document.createElement('div');
    fleetSection.className = 'fleets-section';
    fleetSection.innerHTML = `<h3 class="fleets-section-title"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="fleets-title-svg"><path d="M10 2 L14 8 L12 10 L10 9 L8 10 L6 8 Z"/><path d="M8 10 L6 16 L10 14 L14 16 L12 10"/></svg> Active Fleet</h3>`;

    const fleets = gameState.fleets || [];
    if (fleets.length === 0) {
        fleetSection.innerHTML += `<div class="fleets-empty">No ships commissioned yet. Build ships at a Shipyard.</div>`;
    } else {
        // Group by system
        const bySystem = {};
        fleets.forEach(f => {
            const key = f.systemName || f.systemId || 'Unknown System';
            if (!bySystem[key]) bySystem[key] = [];
            bySystem[key].push(f);
        });

        Object.entries(bySystem).forEach(([sysName, ships]) => {
            const totalPower = ships.reduce((s, f) => s + (f.power || 1), 0);
            const group = document.createElement('div');
            group.className = 'fleet-group';
            group.innerHTML = `
                <div class="fleet-group-header">
                    <span class="fleet-group-sys"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" class="fsc-stat-svg"><path d="M7 1 C4 1 2 3.5 2 6 C2 9.5 7 13 7 13 C7 13 12 9.5 12 6 C12 3.5 10 1 7 1Z"/><circle cx="7" cy="6" r="2"/></svg> ${sysName}</span>
                    <span class="fleet-group-power"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="fsc-stat-svg"><path d="M4 1 L10 1 L7 6 L11 6 L5 13 L7 7 L3 7 Z"/></svg> Fleet Power: ${totalPower}</span>
                </div>
                <div class="fleet-group-ships">
                    ${ships.map(f => {
                        const fleetIdx = gameState.fleets.indexOf(f);
                        const inCurrentSystem = gameState.viewMode === 'SYSTEM' && f.systemId === gameState.selectedSystemId && !f.moving;
                        const movingInfo = f.moving
                            ? `<span class="fsr-transit">In transit to ${f.moving.toName} (${Math.floor((f.moving.progress / f.moving.total) * 100)}%)</span>`
                            : `<button class="fsr-move-btn" data-fleet-idx="${fleetIdx}">Move</button>`;
                        const flyBtn = inCurrentSystem
                            ? `<button class="fsr-fly-btn" data-fleet-id="${f.id}" title="Fly this ship">Fly</button>`
                            : '';
                        return `
                        <div class="fleet-ship-row">
                            <span class="fsr-icon">${f.icon}</span>
                            <span class="fsr-name">${f.name}</span>
                            <span class="fsr-power"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="fsc-stat-svg"><path d="M4 1 L10 1 L7 6 L11 6 L5 13 L7 7 L3 7 Z"/></svg> ${f.power}</span>
                            ${flyBtn}
                            ${movingInfo}
                        </div>`;
                    }).join('')}
                </div>
            `;
            fleetSection.appendChild(group);
        });
    }
    content.appendChild(fleetSection);
    // All button clicks are handled via event delegation in initFleetsUI()
}

function _getShipyardPlanets() {
    const result = [];
    for (const sys of gameState.systems) {
        for (const planet of sys.planets) {
            const col = gameState.colonies[planet.id];
            if (col && col.buildings.includes('shipyard')) {
                result.push({
                    planetId: planet.id,
                    planetName: planet.name,
                    systemName: sys.name,
                    col,
                });
            }
        }
    }
    return result;
}

function _updateShipQueueProgress() {
    const race = gameState.playerCivilization?.bodyType || 'humanoid';
    const raceShips = RACE_SHIPS[race] || [];

    document.querySelectorAll('.fleet-queue-item').forEach(item => {
        const planetId = item.dataset.planetId;
        const idx = parseInt(item.dataset.queueIdx);
        const col = gameState.colonies[planetId];
        if (!col || !col.shipQueue || !col.shipQueue[idx]) return;
        const q = col.shipQueue[idx];
        const pct = Math.floor((q.progress / q.total) * 100);
        const bar = item.querySelector('.fq-bar');
        const pctEl = item.querySelector('.fq-pct');
        if (bar) bar.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
    });
}
