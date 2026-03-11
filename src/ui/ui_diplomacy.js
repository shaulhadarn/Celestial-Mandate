import { gameState, events } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

let _panel = null;
let _content = null;

// ── Faction data (pirates + future civilizations) ───────────────────────────

function _getPirateFaction() {
    const pb = gameState.pirateBase;
    if (!pb) return null;
    return {
        id: 'pirates',
        name: "Krath's Raiders",
        leader: 'Warlord Krath',
        type: 'Pirate Clan',
        status: pb.defeated ? 'defeated' : 'hostile',
        contacted: pb.introShown || false,
        color: '#ff4444',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="10" r="7"/>
            <circle cx="9.5" cy="9" r="1.5" fill="currentColor"/>
            <circle cx="14.5" cy="9" r="1.5" fill="currentColor"/>
            <path d="M9 13.5l1.2-.6 1.8.6 1.8-.6 1.2.6" stroke-width="1.2"/>
            <path d="M7 17h10M9 17v3M15 17v3" stroke-width="1"/>
        </svg>`,
        desc: pb.defeated
            ? "The pirate clan has been defeated. Their base on Corsair's Den has been neutralized and the planet is now available for colonization."
            : "A ruthless pirate clan operating from the outer reaches of your home system. They periodically raid your colonies, stealing minerals and energy. Build a shipyard and military ships to eliminate this threat.",
        power: pb.power,
    };
}

function _getKnownFactions() {
    const factions = [];
    const pirate = _getPirateFaction();
    if (pirate && pirate.contacted) factions.push(pirate);
    // Future: other civs pushed here
    return factions;
}

// ── Status badge helpers ────────────────────────────────────────────────────

function _statusBadge(status) {
    const map = {
        hostile:  { label: 'HOSTILE',   cls: 'dip-status-hostile' },
        neutral:  { label: 'NEUTRAL',   cls: 'dip-status-neutral' },
        friendly: { label: 'FRIENDLY',  cls: 'dip-status-friendly' },
        allied:   { label: 'ALLIED',    cls: 'dip-status-allied' },
        defeated: { label: 'DEFEATED',  cls: 'dip-status-defeated' },
    };
    const s = map[status] || map.neutral;
    return `<span class="dip-status-badge ${s.cls}">${s.label}</span>`;
}

// ── Render functions ────────────────────────────────────────────────────────

function _renderEmptyState() {
    return `
        <div class="dip-empty">
            <div class="dip-empty-icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" width="64" height="64">
                    <circle cx="24" cy="24" r="20" stroke-dasharray="4 3"/>
                    <circle cx="16" cy="20" r="5"/>
                    <circle cx="32" cy="20" r="5"/>
                    <path d="M20 25 C22 30 26 30 28 25" stroke-width="1"/>
                    <path d="M24 38v-6M18 36l6-4M30 36l-6-4" stroke-width="0.8" opacity="0.5"/>
                </svg>
            </div>
            <h3 class="dip-empty-title">No Contacts Established</h3>
            <p class="dip-empty-text">You have not yet encountered any other factions or civilizations. Explore the galaxy and expand your reach to make first contact.</p>
        </div>
    `;
}

function _renderFactionCard(faction) {
    const pb = gameState.pirateBase;
    const isPirate = faction.id === 'pirates';

    let actionsHtml = '';
    if (isPirate && !pb.defeated) {
        const hasShipyard = Object.values(gameState.colonies).some(c => c && c.buildings.includes('shipyard'));
        const hasShips = gameState.fleets && gameState.fleets.length > 0;

        actionsHtml = `
            <div class="dip-actions">
                <button class="dip-action-btn dip-btn-hail" data-faction="pirates" data-action="hail">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" width="14" height="14">
                        <path d="M2 14V4l6-3 6 3v10"/><path d="M5 8h6M5 11h6"/>
                    </svg>
                    Hail Krath
                </button>
                ${hasShipyard && hasShips ? `
                    <button class="dip-action-btn dip-btn-attack" data-faction="pirates" data-action="attack">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" width="14" height="14">
                            <path d="M2 14l5-5M7 9l3-7M7 9l7-3"/>
                        </svg>
                        Launch Assault
                    </button>
                ` : ''}
            </div>
        `;
    } else if (isPirate && pb.defeated) {
        actionsHtml = `
            <div class="dip-actions">
                <div class="dip-defeated-note">Threat eliminated. Corsair's Den is available for colonization.</div>
            </div>
        `;
    }

    return `
        <div class="dip-faction-card" data-faction="${faction.id}" style="--faction-color: ${faction.color}">
            <div class="dip-card-header">
                <div class="dip-card-icon">${faction.icon}</div>
                <div class="dip-card-info">
                    <div class="dip-card-name">${faction.name}</div>
                    <div class="dip-card-meta">
                        <span class="dip-card-type">${faction.type}</span>
                        ${_statusBadge(faction.status)}
                    </div>
                    <div class="dip-card-leader">Leader: ${faction.leader}</div>
                </div>
            </div>
            <div class="dip-card-body">
                <p class="dip-card-desc">${faction.desc}</p>
                ${isPirate && !pb.defeated ? `
                    <div class="dip-card-stats">
                        <div class="dip-stat">
                            <span class="dip-stat-label">Military Power</span>
                            <div class="dip-stat-bar">
                                <div class="dip-stat-fill" style="width: ${Math.min(100, (faction.power / 8) * 100)}%; background: ${faction.color}"></div>
                            </div>
                            <span class="dip-stat-val">${faction.power}</span>
                        </div>
                        <div class="dip-stat">
                            <span class="dip-stat-label">Threat Level</span>
                            <div class="dip-stat-bar">
                                <div class="dip-stat-fill" style="width: ${pb.power > 3 ? '80%' : '30%'}; background: #ff6644"></div>
                            </div>
                            <span class="dip-stat-val">${pb.power > 3 ? 'High' : 'Low'}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
            ${actionsHtml}
        </div>
    `;
}

function renderDiplomacyPanel() {
    if (!_content) return;

    const factions = _getKnownFactions();

    let html = '<div class="dip-container">';

    // Summary bar
    html += `
        <div class="dip-summary">
            <div class="dip-summary-item">
                <span class="dip-summary-num">${factions.length}</span>
                <span class="dip-summary-label">Known Factions</span>
            </div>
            <div class="dip-summary-item">
                <span class="dip-summary-num">${factions.filter(f => f.status === 'hostile').length}</span>
                <span class="dip-summary-label">Hostile</span>
            </div>
            <div class="dip-summary-item">
                <span class="dip-summary-num">${factions.filter(f => f.status === 'friendly' || f.status === 'allied').length}</span>
                <span class="dip-summary-label">Friendly</span>
            </div>
            <div class="dip-summary-item">
                <span class="dip-summary-num">${factions.filter(f => f.status === 'defeated').length}</span>
                <span class="dip-summary-label">Defeated</span>
            </div>
        </div>
    `;

    if (factions.length === 0) {
        html += _renderEmptyState();
    } else {
        html += '<div class="dip-factions-grid">';
        factions.forEach(f => { html += _renderFactionCard(f); });
        html += '</div>';
    }

    html += '</div>';
    _content.innerHTML = html;

    // Wire action buttons
    _content.querySelectorAll('.dip-action-btn').forEach(btn => {
        btn.addEventListener('click', _handleAction);
    });
}

// ── Actions ─────────────────────────────────────────────────────────────────

function _handleAction(e) {
    const btn = e.currentTarget;
    const faction = btn.dataset.faction;
    const action = btn.dataset.action;

    if (faction === 'pirates') {
        if (action === 'hail') _hailPirates();
        else if (action === 'attack') _launchPirateAssault();
    }
}

function _hailPirates() {
    // Show a hail conversation through the event system
    events.dispatchEvent(new CustomEvent('random-event', {
        detail: {
            event: {
                category: 'danger',
                icon: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M9.5 15.5l1-.5 1.5.5 1.5-.5 1 .5" stroke="currentColor" stroke-width="1" fill="none"/>`,
                title: 'Hailing Pirate Base',
                desc: "Krath's scarred face fills the screen once more. \"Back for more talk, colonist? You know the deal — pay up, or we keep raiding. Unless you've finally built something worth fighting with?\"\n\nHe grins menacingly. \"No? Then stop wasting my time. My raiders have schedules to keep.\"",
                choices: [
                    { label: 'We will destroy you.', effect: {} },
                    { label: 'End Transmission', effect: {} }
                ]
            }
        }
    }));
}

function _launchPirateAssault() {
    // Close diplomacy panel and trigger the attack via the colonize button logic
    _panel.classList.add('hidden');

    const pb = gameState.pirateBase;
    if (!pb || pb.defeated) return;

    // Find the pirate planet and simulate clicking "attack" in the selection panel
    showNotification('Select the pirate planet in the system view and press Attack to launch your assault!', 'info');
}

// ── Init ────────────────────────────────────────────────────────────────────

export function initDiplomacyUI() {
    _panel = document.getElementById('diplomacy-panel');
    _content = document.getElementById('diplomacy-panel-content');
    const closeBtn = document.getElementById('btn-close-diplomacy');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            _panel.classList.add('hidden');
        });
    }

    // Re-render on relevant events
    events.addEventListener('pirate-intro', () => {
        // Will be available in panel after intro
    });

    events.addEventListener('pirate-defeated', () => {
        if (_panel && !_panel.classList.contains('hidden')) renderDiplomacyPanel();
    });

    events.addEventListener('pirate-raid', () => {
        if (_panel && !_panel.classList.contains('hidden')) renderDiplomacyPanel();
    });
}

export function openDiplomacyPanel() {
    if (!_panel) return;
    _panel.classList.remove('hidden');
    renderDiplomacyPanel();
}
