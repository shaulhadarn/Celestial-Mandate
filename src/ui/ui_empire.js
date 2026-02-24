import { gameState, getPlanet, selectSystem, selectPlanet } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

/**
 * Initializes the Empire Hub — a quick-access launcher panel.
 * Each button opens its corresponding fullscreen panel.
 */
export function initEmpireHub() {
    const empirePanel = document.getElementById('empire-panel');
    const closeEmpire = document.getElementById('btn-close-empire');

    if (closeEmpire) closeEmpire.addEventListener('click', () => {
        empirePanel.classList.add('hidden');
    });

    // Map each hub button to its header-bar counterpart
    const hubMap = {
        'hub-colonies':  'btn-colonies',
        'hub-research':  'btn-research',
        'hub-fleets':    'btn-fleets',
        'hub-codex':     'btn-codex',
    };

    for (const [hubId, btnId] of Object.entries(hubMap)) {
        const hubEl = document.getElementById(hubId);
        if (hubEl) {
            hubEl.addEventListener('click', () => {
                empirePanel.classList.add('hidden');
                const target = document.getElementById(btnId);
                if (target) target.click();
            });
        }
    }

    // Diplomacy has no fullscreen panel — show inline message
    const hubDiplomacy = document.getElementById('hub-diplomacy');
    if (hubDiplomacy) hubDiplomacy.addEventListener('click', () => {
        showNotification('No civilizations encountered yet', 'info');
    });
}

/**
 * Renders the list of all established colonies in the Empire Hub.
 */
export function renderColonyList() {
    const detail = document.getElementById('hub-dynamic-content');
    if (!detail) return;

    detail.classList.remove('hidden');
    detail.innerHTML = '<h4>Your Colonies</h4>';

    const colonyIds = Object.keys(gameState.colonies);
    if (colonyIds.length === 0) {
        detail.innerHTML += '<p style="color:#8ba4b3; font-size:12px;">No colonies established yet.</p>';
        return;
    }

    colonyIds.forEach(id => {
        const planet = getPlanet(id);
        if (!planet) return;

        const link = document.createElement('div');
        link.className = 'colony-link';
        link.innerHTML = `
            <span>${planet.name}</span>
            <span style="color:var(--color-primary); font-size:11px;">Pop: ${gameState.colonies[id].population}</span>
        `;
        link.onclick = () => {
            for (const sys of gameState.systems) {
                if (sys.planets.find(p => p.id === id)) {
                    selectSystem(sys.id);
                    break;
                }
            }
            selectPlanet(id);
            document.getElementById('empire-panel').classList.add('hidden');
            showNotification(`Navigated to ${planet.name}`, 'info');
        };
        detail.appendChild(link);
    });
}
