/* Updated: Organized app hierarchy, moved to src/ui folder, fixed imports and paths */
import { gameState, getPlanet, selectSystem, selectPlanet } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

/**
 * Initializes listeners for the Empire Management panel.
 */
export function initEmpireHub() {
    const empirePanel = document.getElementById('empire-panel');
    const hubColonies = document.getElementById('hub-colonies');
    const hubResearch = document.getElementById('hub-research');
    const hubDiplomacy = document.getElementById('hub-diplomacy');
    const hubFleets = document.getElementById('hub-fleets');
    const closeEmpire = document.getElementById('btn-close-empire');

    if (hubColonies) hubColonies.addEventListener('click', renderColonyList);
    
    if (hubResearch) hubResearch.addEventListener('click', () => {
        const detail = document.getElementById('hub-dynamic-content');
        detail.classList.remove('hidden');
        detail.innerHTML = `<h4>Active Research</h4><p style="color:#8ba4b3; font-size:12px;">No research projects currently available. Build a Research Lab to begin.</p>`;
    });

    if (hubDiplomacy) hubDiplomacy.addEventListener('click', () => {
        const detail = document.getElementById('hub-dynamic-content');
        detail.classList.remove('hidden');
        detail.innerHTML = `<h4>Galactic Diplomacy</h4><p style="color:#8ba4b3; font-size:12px;">No other space-faring civilizations have been encountered yet.</p>`;
    });

    if (hubFleets) hubFleets.addEventListener('click', () => {
        const detail = document.getElementById('hub-dynamic-content');
        detail.classList.remove('hidden');
        detail.innerHTML = `<h4>Fleet Command</h4><p style="color:#8ba4b3; font-size:12px;">1st Expeditionary Fleet: Stationary at Capital.</p>`;
    });

    if (closeEmpire) closeEmpire.addEventListener('click', () => {
        empirePanel.classList.add('hidden');
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
            // Find parent system to select it first
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