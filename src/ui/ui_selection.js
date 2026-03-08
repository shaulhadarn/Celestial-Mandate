/* Updated: System panel now shows planets of the current system (not all galaxy stars) with type, size, colony indicator, and click-to-select */
import { gameState, getSystem, getPlanet, SURVEY_COST, selectSystem, selectPlanet, resolvePirateBattle } from '../core/state.js';
import { renderColonyView } from './ui_colony.js';
import { enterSystemView } from '../visuals/renderer.js';
import { playPirateBattle, planetMeshes } from '../visuals/visuals_system.js';

/** Track previous system to detect fresh opens vs content updates */
let _prevSystemId = null;

/**
 * Updates the System and Planet selection panels based on the current game state.
 */
export function updateSelectionPanel() {
    const sysPanel = document.getElementById('system-panel');
    const planetPanel = document.getElementById('planet-panel');

    const sys = gameState.selectedSystemId !== null ? getSystem(gameState.selectedSystemId) : null;

    if (sys) {
        const isNewSystem = _prevSystemId !== sys.id;
        _prevSystemId = sys.id;

        document.getElementById('sys-name').innerText = sys.name;
        document.getElementById('sys-class').innerText = getStarClass(sys.starType);
        document.getElementById('sys-class').style.color = '#' + sys.color.toString(16);
        document.getElementById('sys-planets').innerText = sys.planets.length;

        const surveyBtn = document.getElementById('btn-survey');
        if (sys.surveyed) {
            surveyBtn.innerText = "System Surveyed";
            surveyBtn.classList.add('disabled');
            surveyBtn.disabled = true;
            surveyBtn.style.opacity = '0.5';
            surveyBtn.style.cursor = 'default';
        } else {
            surveyBtn.innerText = `Survey System (⚡${SURVEY_COST.energy})`;
            surveyBtn.classList.remove('disabled');
            surveyBtn.disabled = false;
            surveyBtn.style.opacity = '1';
            surveyBtn.style.cursor = 'pointer';
        }

        // Fade-in the panel content when opening a new system
        const content = sysPanel.querySelector('.panel-content');
        if (isNewSystem && content) {
            content.style.opacity = '0';
            content.style.transform = 'translateY(6px)';
            requestAnimationFrame(() => {
                content.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                content.style.opacity = '1';
                content.style.transform = 'translateY(0)';
            });
        }

        // Only show system panel when selecting a NEW system, not on every update
        // (e.g. deselecting a planet should not force the system panel open)
        if (isNewSystem) {
            sysPanel.classList.remove('hidden');
        }
        renderStarList(sys.id);
    }

    if (gameState.selectedPlanetId !== null && gameState.viewMode === 'SYSTEM') {
        const planet = getPlanet(gameState.selectedPlanetId);

        if (planet) {
            if (window.innerWidth <= 768) sysPanel.classList.add('hidden');

            // Fade-in planet panel content (opacity only — no translateY to avoid scrollbar flash)
            const pContent = planetPanel.querySelector('.panel-content');
            if (pContent) {
                pContent.style.transition = 'none';
                pContent.style.opacity = '0';
                requestAnimationFrame(() => {
                    pContent.style.transition = 'opacity 0.25s ease-out';
                    pContent.style.opacity = '1';
                });
            }

            const isPirateActive = planet.pirate && gameState.pirateBase && !gameState.pirateBase.defeated;
            document.getElementById('planet-name').innerText = isPirateActive ? `${planet.name} ☠️` : planet.name;
            const isSurveyed = sys ? sys.surveyed : false;
            const colony = gameState.colonies[planet.id];

            // Always explicitly set land button state for the current planet
            const landBtn = document.getElementById('btn-land');
            if (landBtn) {
                if (planet.type === 'Gas Giant' || isPirateActive) {
                    landBtn.style.display = 'none';
                } else {
                    landBtn.style.display = 'block';
                    if (isSurveyed || colony) {
                        landBtn.disabled = false;
                        landBtn.style.opacity = '1';
                        landBtn.style.cursor = 'pointer';
                        landBtn.innerHTML = `Land & Explore`;
                    } else {
                        landBtn.disabled = true;
                        landBtn.style.opacity = '0.5';
                        landBtn.style.cursor = 'not-allowed';
                        landBtn.innerHTML = `Survey System First`;
                    }
                }
            }

            if (!isSurveyed && !colony && !isPirateActive) {
                document.getElementById('planet-class').innerText = "Unknown";
                document.getElementById('planet-size').innerText = "?";
            } else {
                document.getElementById('planet-class').innerText = isPirateActive ? `Pirate Stronghold (Power: ${gameState.pirateBase.power})` : planet.type;
                document.getElementById('planet-size').innerText = Math.floor(planet.size * 10);
            }

            planetPanel.classList.remove('hidden');

            const preColony = document.getElementById('planet-actions-pre');
            const colonyView = document.getElementById('planet-colony-view');
            const colonizeBtn = document.getElementById('btn-colonize');

            // Check if this is an active pirate base
            const isPirateBase = planet.pirate && gameState.pirateBase && !gameState.pirateBase.defeated;

            if (colony) {
                preColony.style.display = 'none';
                colonyView.classList.remove('hidden');

                const nameLabel = document.getElementById('planet-name');
                if(!nameLabel.innerText.includes('🏗️')) nameLabel.innerText += " 🏗️";

                renderColonyView(planet.id);
            } else if (isPirateBase) {
                // Pirate base — show attack UI instead of colonize
                preColony.style.display = 'block';
                preColony.classList.remove('hidden');
                colonyView.classList.add('hidden');

                const playerFleets = (gameState.fleets || []).filter(f => f.systemId === gameState.pirateBase.systemId && !f.moving);
                const playerPower = playerFleets.reduce((sum, f) => sum + (f.power || 1), 0);
                const hasFleets = playerPower > 0;

                colonizeBtn.disabled = !hasFleets;
                colonizeBtn.innerHTML = `⚔️ Attack Pirate Base${hasFleets ? ` (Power: ${playerPower} vs ${gameState.pirateBase.power})` : ''}`;
                colonizeBtn.style.opacity = hasFleets ? '1' : '0.5';
                colonizeBtn.style.background = hasFleets ? 'rgba(255, 50, 30, 0.3)' : '';
                colonizeBtn.style.borderColor = '#ff3322';
            } else {
                preColony.style.display = 'block';
                preColony.classList.remove('hidden');
                colonyView.classList.add('hidden');

                colonizeBtn.style.background = '';
                colonizeBtn.style.borderColor = '';
                if (!isSurveyed) {
                    colonizeBtn.disabled = true;
                    colonizeBtn.innerText = "Survey System First";
                    colonizeBtn.style.opacity = "0.5";
                } else {
                    colonizeBtn.disabled = false;
                    colonizeBtn.innerText = "Colonize Planet";
                    colonizeBtn.style.opacity = "1";
                }
            }
        } else {
            // Planet not found in index — reset land button and hide panel
            const landBtn = document.getElementById('btn-land');
            if (landBtn) landBtn.style.display = 'none';
            planetPanel.classList.add('hidden');
        }
    } else {
        planetPanel.classList.add('hidden');
    }
}

function renderStarList(activeSystemId) {
    const container = document.getElementById('star-list');
    if (!container) return;
    container.innerHTML = '';

    const sys = getSystem(activeSystemId);
    if (!sys) return;

    const planets = sys.planets || [];
    planets.forEach(planet => {
        const hasColony = !!gameState.colonies[planet.id];
        const isSelected = gameState.selectedPlanetId === planet.id;
        const isSurveyed = sys.surveyed;

        const isPirate = planet.pirate && gameState.pirateBase && !gameState.pirateBase.defeated;
        const typeLabel = isPirate ? 'Pirate Base' : ((isSurveyed || hasColony) ? planet.type : 'Unknown');
        const sizeLabel = (isSurveyed || hasColony || isPirate) ? Math.floor(planet.size * 10) : '?';

        const PLANET_COLORS = {
            'Terran': '#4a9eff', 'Continental': '#5bc8af', 'Ocean': '#2277cc',
            'Desert': '#e8a44a', 'Arctic': '#aaddff', 'Barren': '#888888',
            'Molten': '#ff5522', 'Gas Giant': '#cc8844', 'Tomb': '#667766',
        };
        const dotColor = isPirate ? '#ff3322' : (PLANET_COLORS[planet.type] || '#aaaaaa');

        const row = document.createElement('div');
        row.className = `star-list-item${isSelected ? ' active' : ''}`;
        const suffix = hasColony ? ' 🏛' : (isPirate ? ' ☠️' : '');
        row.innerHTML = `
            <span class="star-list-dot" style="background:${dotColor};box-shadow:0 0 5px ${dotColor};"></span>
            <span class="star-list-name">${planet.name}</span>
            <span class="star-list-meta">${typeLabel} · ${sizeLabel}${suffix}</span>
        `;
        row.addEventListener('click', () => {
            selectPlanet(planet.id);
        });
        container.appendChild(row);

        // Staggered fade-in for each planet row
        const idx = container.children.length - 1;
        row.style.opacity = '0';
        row.style.transform = 'translateY(4px)';
        requestAnimationFrame(() => {
            row.style.transition = `opacity 0.25s ease-out ${idx * 0.04}s, transform 0.25s ease-out ${idx * 0.04}s`;
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        });
    });
}

function getStarClass(type) {
    if(type === 'Blue Giant') return 'Class O (Blue Giant)';
    if(type === 'Yellow Dwarf') return 'Class G (Yellow Dwarf)';
    return 'Class M (Red Dwarf)';
}