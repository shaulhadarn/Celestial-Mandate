/* Research tick logic, tech bonuses, and research actions */
import { gameState, events } from './state.js';
import { BUILDINGS } from './buildings_data.js';
import { TECH_TREE, RESEARCH_BUILDINGS, getTechById, getAvailableTechs, getTierTechs, isTierComplete, isTierUnlocked } from './research_data.js';

export function tickResearch() {
    const r = gameState.research;
    if (!r.currentResearch) return;

    // Apply research cost factor bonus
    const costFactor = Math.max(0.3, 1 + (r.bonuses.research_cost_factor || 0));
    r.currentResearch.progress += r.researchPoints;

    if (r.currentResearch.progress >= r.currentResearch.total * costFactor) {
        const techId = r.currentResearch.techId;
        r.completedTechs.push(techId);
        r.currentResearch = null;
        r.researchPoints = 0;

        const tech = getTechById(techId);
        if (tech) {
            applyTechBonus(tech);
            if (tech.unlocks) unlockResearchBuilding(tech.unlocks);
        }

        events.dispatchEvent(new CustomEvent('research-complete', { detail: { techId } }));
        events.dispatchEvent(new CustomEvent('resources-updated'));

        // Check if the completed tech's tier is now fully done
        if (tech) {
            const archetypeId = gameState.playerCivilization?.archetype || 'standard';
            if (isTierComplete(tech.tier, archetypeId, r.completedTechs)) {
                events.dispatchEvent(new CustomEvent('tier-complete', {
                    detail: { tier: tech.tier, nextTier: tech.tier < 4 ? tech.tier + 1 : null }
                }));
            }
        }
    }
}

export function applyTechBonus(tech) {
    const rb = gameState.research.bonuses;
    if (!tech.bonus) return;
    Object.entries(tech.bonus).forEach(([key, val]) => {
        rb[key] = (rb[key] || 0) + val;
    });
}

export function unlockResearchBuilding(buildingKey) {
    if (!RESEARCH_BUILDINGS[buildingKey]) return;
    if (!BUILDINGS[buildingKey]) {
        BUILDINGS[buildingKey] = { ...RESEARCH_BUILDINGS[buildingKey] };
    }
}

export function startResearch(techId) {
    const r = gameState.research;
    if (r.currentResearch) return false; // already researching
    if (r.completedTechs.includes(techId)) return false;

    // Check if colony with research_lab exists
    const hasLab = Object.values(gameState.colonies).some(col =>
        col.buildings.includes('research_lab')
    );
    if (!hasLab) return false;

    const tech = getTechById(techId);
    if (!tech) return false;

    // Tier gate: previous tier must be fully complete
    const archetypeId = gameState.playerCivilization?.archetype || 'standard';
    if (!isTierUnlocked(tech.tier, archetypeId, r.completedTechs)) return false;

    r.currentResearch = { techId, progress: 0, total: tech.cost };
    r.researchPoints = 0;
    events.dispatchEvent(new CustomEvent('research-started', { detail: { techId } }));
    return true;
}

export function cancelResearch() {
    gameState.research.currentResearch = null;
    gameState.research.researchPoints = 0;
    events.dispatchEvent(new CustomEvent('resources-updated'));
}
