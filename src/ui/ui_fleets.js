/* Updated: SVG ship icons — replaced emoji with unique SVG silhouettes per ship id */
import { gameState, RACE_SHIPS, buildShip, cancelShipBuild, events } from '../core/state.js';
import { showNotification } from './ui_notifications.js';
import { getShipSvg } from './ship_icons.js';

function openShipModal(ship) {
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

    document.getElementById('ship-modal-stats').innerHTML = [
        { label: 'Length',    value: ship.length   || '—' },
        { label: 'Crew',      value: ship.crew === 0 ? 'Unmanned' : (ship.crew || '—') },
        { label: 'Power',     value: `⚔ ${ship.power}` },
        { label: 'Minerals',  value: `💎 ${ship.cost.minerals}` },
        { label: 'Energy',    value: `⚡ ${ship.cost.energy}` },
        { label: 'Build Time',value: `⏱ ${ship.buildTime}s` },
    ].map(s => `
        <div class="ship-stat-cell">
            <div class="ship-stat-label">${s.label}</div>
            <div class="ship-stat-value" style="color:${accent}">${s.value}</div>
        </div>
    `).join('');

    document.getElementById('ship-modal-weapons').textContent = ship.weapons || '—';
    document.getElementById('ship-modal-special').textContent = ship.special || '—';
    document.getElementById('ship-modal-story').textContent   = ship.story   || ship.desc;

    const box = modal.querySelector('.ship-modal-box');
    box.style.borderColor  = `${accent}55`;
    box.style.boxShadow    = `0 0 60px ${accent}22, 0 0 120px rgba(0,0,0,0.8)`;

    modal.classList.remove('hidden');
}

function initShipModal() {
    const closeBtn = document.getElementById('ship-modal-close');
    const overlay  = document.getElementById('ship-detail-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    if (overlay)  overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') overlay?.classList.add('hidden');
    });
}

export function initFleetsUI() {
    initShipModal();
    const btn = document.getElementById('btn-fleets');
    const panel = document.getElementById('fleets-panel');
    const closeBtn = document.getElementById('btn-close-fleets');

    if (btn) btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderFleetsPanel();
    });

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    events.addEventListener('ship-built', (e) => {
        showNotification(`⚓ ${e.detail.fleet.name} has been commissioned!`, 'success');
        if (panel && !panel.classList.contains('hidden')) renderFleetsPanel();
    });

    events.addEventListener('tick', () => {
        if (panel && !panel.classList.contains('hidden')) _updateShipQueueProgress();
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
                            <span class="fsc-power">⚔ ${ship.power}</span>
                            <span class="fsc-cost">💎${ship.cost.minerals} ⚡${ship.cost.energy}</span>
                            <span class="fsc-time">⏱ ${ship.buildTime}s</span>
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
    fleetSection.innerHTML = `<h3 class="fleets-section-title">🚀 Active Fleet</h3>`;

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
                    <span class="fleet-group-sys">📍 ${sysName}</span>
                    <span class="fleet-group-power">⚔ Fleet Power: ${totalPower}</span>
                </div>
                <div class="fleet-group-ships">
                    ${ships.map(f => `
                        <div class="fleet-ship-row">
                            <span class="fsr-icon">${f.icon}</span>
                            <span class="fsr-name">${f.name}</span>
                            <span class="fsr-power">⚔ ${f.power}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            fleetSection.appendChild(group);
        });
    }
    content.appendChild(fleetSection);

    // Wire View buttons
    content.querySelectorAll('.fsc-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const shipId = btn.dataset.ship;
            const ship = raceShips.find(s => s.id === shipId);
            if (ship) openShipModal(ship);
        });
    });

    // Wire Build buttons
    content.querySelectorAll('.fsc-build-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const planetId = btn.dataset.planet;
            const shipId   = btn.dataset.ship;
            if (buildShip(planetId, shipId)) {
                const ship = (RACE_SHIPS[gameState.playerCivilization?.bodyType || 'humanoid'] || []).find(s => s.id === shipId);
                showNotification(`🛸 ${ship?.name || shipId} construction started!`, 'info');
                renderFleetsPanel();
            } else {
                showNotification('Insufficient resources or no Shipyard!', 'alert');
            }
        });
    });

    content.querySelectorAll('.fq-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            cancelShipBuild(btn.dataset.planet, parseInt(btn.dataset.idx));
            renderFleetsPanel();
        });
    });
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
