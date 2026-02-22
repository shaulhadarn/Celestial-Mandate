/* Updated: Added star list to system panel - all galaxy stars listed with click-to-navigate */
import { gameState, getSystem, getPlanet, SURVEY_COST, selectSystem } from '../core/state.js';
import { renderColonyView } from './ui_colony.js';
import { enterSystemView } from '../visuals/renderer.js';

/**
 * Updates the System and Planet selection panels based on the current game state.
 */
export function updateSelectionPanel() {
    const sysPanel = document.getElementById('system-panel');
    const planetPanel = document.getElementById('planet-panel');
    
    const sys = gameState.selectedSystemId !== null ? getSystem(gameState.selectedSystemId) : null;

    if (sys) {
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
        sysPanel.classList.remove('hidden');
        renderStarList(sys.id);
    }

    if (gameState.selectedPlanetId !== null && gameState.viewMode === 'SYSTEM') {
        const planet = getPlanet(gameState.selectedPlanetId);
        
        if (planet) {
            if (window.innerWidth <= 768) sysPanel.classList.add('hidden');

            document.getElementById('planet-name').innerText = planet.name;
            const isSurveyed = sys ? sys.surveyed : false;
            const colony = gameState.colonies[planet.id];

            const landBtn = document.getElementById('btn-land');
            if (landBtn) {
                if (planet.type === 'Gas Giant') {
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
                        landBtn.innerHTML = `Uncharted (Survey System)`;
                    }
                }
            }
            
            if (!isSurveyed && !colony) {
                document.getElementById('planet-class').innerText = "Unknown";
                document.getElementById('planet-size').innerText = "?";
            } else {
                document.getElementById('planet-class').innerText = planet.type;
                document.getElementById('planet-size').innerText = Math.floor(planet.size * 10);
            }
            
            planetPanel.classList.remove('hidden');

            const preColony = document.getElementById('planet-actions-pre');
            const colonyView = document.getElementById('planet-colony-view');
            const colonizeBtn = document.getElementById('btn-colonize');

            if (colony) {
                preColony.style.display = 'none';
                colonyView.classList.remove('hidden');
                
                const nameLabel = document.getElementById('planet-name');
                if(!nameLabel.innerText.includes('🏗️')) nameLabel.innerText += " 🏗️";

                renderColonyView(planet.id);
            } else {
                preColony.style.display = 'block';
                preColony.classList.remove('hidden');
                colonyView.classList.add('hidden');
                
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
        }
    } else {
        planetPanel.classList.add('hidden');
    }
}

function renderStarList(activeSystemId) {
    const container = document.getElementById('star-list');
    if (!container) return;
    container.innerHTML = '';

    const systems = gameState.systems || [];
    systems.forEach(sys => {
        const isActive = sys.id === activeSystemId;
        const hasColony = sys.planets.some(p => gameState.colonies[p.id]);
        const colorHex = '#' + sys.color.toString(16).padStart(6, '0');

        const row = document.createElement('div');
        row.className = `star-list-item${isActive ? ' active' : ''}`;
        row.innerHTML = `
            <span class="star-list-dot" style="background:${colorHex};box-shadow:0 0 5px ${colorHex};"></span>
            <span class="star-list-name">${sys.name}</span>
            <span class="star-list-meta">${sys.planets.length}p${hasColony ? ' 🏛' : ''}</span>
        `;
        row.addEventListener('click', () => {
            selectSystem(sys.id);
            enterSystemView(sys.id);
        });
        container.appendChild(row);
    });
}

function getStarClass(type) {
    if(type === 'Blue Giant') return 'Class O (Blue Giant)';
    if(type === 'Yellow Dwarf') return 'Class G (Yellow Dwarf)';
    return 'Class M (Red Dwarf)';
}