/* Colonies overview panel - lists all player colonies with stats and quick navigation */
import { gameState, events, getPlanet, selectSystem, selectPlanet, BUILDINGS } from '../core/state.js';
import { enterSystemView, returnToGalaxyView } from '../visuals/renderer.js';
import { updateSelectionPanel } from './ui_selection.js';

// SVG icon helper — references the sprite sheet in index.html
const svgIcon = (id, cls = '') =>
    `<svg class="col-svg-icon svg-icon ${cls}" viewBox="0 0 24 24"><use href="#icon-${id}"></use></svg>`;

// Map building keys to sprite icon IDs
const BUILDING_ICON_MAP = {
    mining_network: 'mining',
    power_plant: 'energy',
    hydroponics: 'hydroponics',
    research_lab: 'research-lab',
    shipyard: 'shipyard',
};

export function initColoniesOverview() {
    const btn = document.getElementById('btn-colonies');
    const panel = document.getElementById('colonies-panel');
    const closeBtn = document.getElementById('btn-close-colonies');

    if (btn) btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderColoniesOverview();
    });

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    events.addEventListener('colony-founded', () => {
        if (!panel.classList.contains('hidden')) renderColoniesOverview();
    });
    events.addEventListener('building-complete', () => {
        if (!panel.classList.contains('hidden')) renderColoniesOverview();
    });
    events.addEventListener('resources-updated', () => {
        if (!panel.classList.contains('hidden')) renderColoniesOverview();
    });
}

function renderColoniesOverview() {
    const content = document.getElementById('colonies-panel-content');
    if (!content) return;

    const colonyEntries = Object.entries(gameState.colonies);

    if (colonyEntries.length === 0) {
        content.innerHTML = `<div class="colonies-empty">No colonies established yet. Colonize a planet to begin your empire.</div>`;
        return;
    }

    let totalPop = 0;
    let totalEnergy = 0;
    let totalMinerals = 0;
    let totalFood = 0;

    const cards = colonyEntries.map(([planetId, col]) => {
        const planet = getPlanet(planetId);
        if (!planet) return '';

        // Find which system this planet belongs to
        const system = gameState.systems.find(s => s.planets.some(p => p.id === planetId));

        // Calculate colony production
        let colEnergy = 1, colMinerals = 1, colFood = 1;
        col.buildings.forEach(bId => {
            const b = BUILDINGS[bId];
            if (b) {
                if (b.production.energy) colEnergy += b.production.energy;
                if (b.production.minerals) colMinerals += b.production.minerals;
                if (b.production.food) colFood += b.production.food;
                if (b.maintenance.energy) colEnergy -= b.maintenance.energy;
                if (b.maintenance.minerals) colMinerals -= b.maintenance.minerals;
                if (b.maintenance.food) colFood -= b.maintenance.food;
            }
        });

        totalPop += col.population;
        totalEnergy += colEnergy;
        totalMinerals += colMinerals;
        totalFood += colFood;

        const buildingSlots = col.buildings.length;
        const maxSlots = 5;
        const constructing = col.construction?.length > 0 ? col.construction[0] : null;
        const growthPct = Math.floor(col.growthProgress || 0);

        const buildingIcons = col.buildings.map(bId => {
            const b = BUILDINGS[bId];
            if (!b) return '';
            const iconId = BUILDING_ICON_MAP[bId] || 'building';
            const color = b.borderColor || '#00e5ff';
            return `<span class="colony-building-icon" title="${b.name}" style="color:${color}">${svgIcon(iconId)}</span>`;
        }).join('');

        const emptySlots = Array(maxSlots - buildingSlots).fill(0).map(() =>
            `<span class="colony-building-slot-empty">○</span>`
        ).join('');

        return `
            <div class="colony-overview-card" data-planet-id="${planetId}" data-system-id="${system?.id || ''}">
                <div class="colony-card-header">
                    <div class="colony-card-title">
                        <span class="colony-card-name">${planet.name}</span>
                        <span class="colony-card-type">${planet.type}</span>
                    </div>
                    <div class="colony-card-system">${system?.name || 'Unknown System'}</div>
                </div>
                <div class="colony-card-stats">
                    <div class="colony-stat-row">
                        <span class="colony-stat col-stat-pop">${svgIcon('population')} Pop: <strong>${col.population}</strong></span>
                        <span class="colony-stat col-stat-growth">${svgIcon('growth')} Growth: <strong>${growthPct}%</strong></span>
                        <span class="colony-stat col-stat-building">${svgIcon('building')} Buildings: <strong>${buildingSlots}/${maxSlots}</strong></span>
                    </div>
                    <div class="colony-stat-row">
                        <span class="colony-stat ${colEnergy >= 0 ? 'pos' : 'neg'} col-stat-energy">${svgIcon('energy')} ${colEnergy >= 0 ? '+' : ''}${Math.floor(colEnergy)}</span>
                        <span class="colony-stat ${colMinerals >= 0 ? 'pos' : 'neg'} col-stat-minerals">${svgIcon('minerals')} ${colMinerals >= 0 ? '+' : ''}${Math.floor(colMinerals)}</span>
                        <span class="colony-stat ${colFood >= 0 ? 'pos' : 'neg'} col-stat-food">${svgIcon('food')} ${colFood >= 0 ? '+' : ''}${Math.floor(colFood)}</span>
                    </div>
                </div>
                <div class="colony-card-buildings">
                    ${buildingIcons}${emptySlots}
                    ${constructing ? `<span class="colony-constructing" title="Building: ${BUILDINGS[constructing.buildingKey]?.name}">${svgIcon('constructing')}</span>` : ''}
                </div>
                <button class="colony-goto-btn" data-planet-id="${planetId}" data-system-id="${system != null ? system.id : ''}">
                    → Go to Colony
                </button>
            </div>`;
    }).join('');

    const summary = `
        <div class="colonies-summary">
            <div class="colonies-summary-stat col-stat-colonies">${svgIcon('colonies')} <strong>${colonyEntries.length}</strong> Colonies</div>
            <div class="colonies-summary-stat col-stat-pop">${svgIcon('population')} <strong>${totalPop}</strong> Total Pop</div>
            <div class="colonies-summary-stat col-stat-energy">${svgIcon('energy')} <strong>${totalEnergy >= 0 ? '+' : ''}${Math.floor(totalEnergy)}</strong>/tick</div>
            <div class="colonies-summary-stat col-stat-minerals">${svgIcon('minerals')} <strong>${totalMinerals >= 0 ? '+' : ''}${Math.floor(totalMinerals)}</strong>/tick</div>
            <div class="colonies-summary-stat col-stat-food">${svgIcon('food')} <strong>${totalFood >= 0 ? '+' : ''}${Math.floor(totalFood)}</strong>/tick</div>
        </div>`;

    content.innerHTML = summary + `<div class="colonies-grid">${cards}</div>`;

    // Wire up Go to Colony buttons
    content.querySelectorAll('.colony-goto-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rawSysId = btn.dataset.systemId;
            if (rawSysId === '' || rawSysId == null) return;
            const systemId = parseInt(rawSysId, 10);
            if (isNaN(systemId)) return;
            const planetId = btn.dataset.planetId;

            // 1. Close the colonies overlay panel
            document.getElementById('colonies-panel').classList.add('hidden');

            // 2. If currently in galaxy view, switch to system view first (await so viewMode is SYSTEM)
            if (gameState.viewMode === 'GALAXY' || gameState.viewMode !== 'SYSTEM' || gameState.selectedSystemId !== systemId) {
                await enterSystemView(systemId);
            }

            // 3. Select system then planet — these fire 'selection-changed' which calls updateSelectionPanel
            selectSystem(systemId);
            selectPlanet(planetId);

            // 4. Make sure the ui-layer is visible (colonies panel hides it on some paths)
            const uiLayer = document.getElementById('ui-layer');
            if (uiLayer) uiLayer.classList.remove('hidden');

            // 5. Force panel update now that viewMode is SYSTEM
            updateSelectionPanel();

            // 6. Ensure system panel is visible
            const sysPanel = document.getElementById('system-panel');
            if (sysPanel) sysPanel.classList.remove('hidden');
        });
    });
}
