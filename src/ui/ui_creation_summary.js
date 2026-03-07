/* Updated: Replace emoji icons with animated SVGs in summary boxes */
import { HOMEWORLD_TYPES, BODY_TYPES, ARCHETYPES, TRAITS, CIVICS } from '../core/civilization_data.js';
import { state } from './ui_creation_state.js';

// Animated SVG: DNA double helix for Biological Data
const SVG_BIO = `<svg viewBox="0 0 32 32" fill="none" class="summary-box-svg">
    <path d="M8 4 Q16 10 24 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="summary-svg-helix1"/>
    <path d="M8 12 Q16 18 24 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="summary-svg-helix1"/>
    <path d="M8 20 Q16 26 24 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="summary-svg-helix1"/>
    <path d="M8 28 Q16 34 24 28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" class="summary-svg-helix1"/>
    <path d="M24 4 Q16 10 8 16 Q16 22 24 28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.5" class="summary-svg-helix2"/>
    <path d="M8 4 Q16 10 24 16 Q16 22 8 28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.5" class="summary-svg-helix2"/>
    <circle cx="16" cy="10" r="2" fill="currentColor" opacity="0.7" class="summary-svg-node"/>
    <circle cx="16" cy="22" r="2" fill="currentColor" opacity="0.7" class="summary-svg-node"/>
</svg>`;

// Animated SVG: scroll/pillars for Social Framework
const SVG_SOCIAL = `<svg viewBox="0 0 32 32" fill="none" class="summary-box-svg">
    <rect x="6" y="8" width="20" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" class="summary-svg-scroll"/>
    <line x1="10" y1="13" x2="22" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" class="summary-svg-line"/>
    <line x1="10" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" class="summary-svg-line"/>
    <line x1="10" y1="19" x2="18" y2="19" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" class="summary-svg-line"/>
    <path d="M6 8 Q4 8 4 10 Q4 12 6 12" stroke="currentColor" stroke-width="1.2" fill="none" class="summary-svg-curl"/>
    <path d="M26 8 Q28 8 28 10 Q28 12 26 12" stroke="currentColor" stroke-width="1.2" fill="none" class="summary-svg-curl"/>
    <circle cx="16" cy="5" r="2" fill="currentColor" opacity="0.6" class="summary-svg-seal"/>
</svg>`;

// Animated SVG: bar chart for Starting Modifiers
const SVG_STATS = `<svg viewBox="0 0 32 32" fill="none" class="summary-box-svg">
    <line x1="6" y1="26" x2="26" y2="26" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="8" y="16" width="4" height="10" rx="1" fill="currentColor" opacity="0.5" class="summary-svg-bar1"/>
    <rect x="14" y="10" width="4" height="16" rx="1" fill="currentColor" opacity="0.7" class="summary-svg-bar2"/>
    <rect x="20" y="13" width="4" height="13" rx="1" fill="currentColor" opacity="0.6" class="summary-svg-bar3"/>
    <circle cx="10" cy="14" r="2" fill="currentColor" class="summary-svg-dot"/>
    <circle cx="16" cy="8" r="2" fill="currentColor" class="summary-svg-dot"/>
    <circle cx="22" cy="11" r="2" fill="currentColor" class="summary-svg-dot"/>
    <polyline points="10,14 16,8 22,11" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="summary-svg-trend"/>
</svg>`;

export function renderSummaryStep(parent) {
    const homeworld = HOMEWORLD_TYPES.find(h => h.id === state.currentCiv.homeworld);
    const body = BODY_TYPES.find(b => b.id === state.currentCiv.bodyType);
    const archetype = ARCHETYPES.find(a => a.id === state.currentCiv.archetype) || ARCHETYPES[0];
    
    const chosenTraits = state.currentCiv.traits.map(tid => TRAITS.find(t => t.id === tid));
    const chosenCivics = state.currentCiv.civics.map(cid => CIVICS.find(c => c.id === cid));

    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 7: Galactic Proclamation</h2>
            <p>Finalize the details of your empire. Once established, you will begin your journey from your homeworld.</p>
        </div>

        <div class="summary-container">
            <div class="summary-hero">
                <h1 class="summary-empire-name">${state.currentCiv.name}</h1>
                <div class="summary-archetype">${archetype.name}</div>
            </div>

            <div class="summary-grid">
                <div class="summary-box">
                    <h3>${SVG_BIO} Biological Data</h3>
                    <div class="summary-item"><span class="label">Phenotype</span><span class="value">${body?.name || "Unknown"}</span></div>
                    <div class="summary-item"><span class="label">Homeworld</span><span class="value">${homeworld?.name || "Uncharted"}</span></div>
                    <div class="summary-tags">
                        ${chosenTraits.map(t => `<span class="summary-tag">${t.name}</span>`).join('')}
                        ${chosenTraits.length === 0 ? '<span style="color:#666; font-size:11px;">No biological traits selected.</span>' : ''}
                    </div>
                </div>

                <div class="summary-box">
                    <h3>${SVG_SOCIAL} Social Framework</h3>
                    <div class="summary-item"><span class="label">Doctrine</span><span class="value">${archetype.mechanic}</span></div>
                    <div class="summary-tags">
                        ${chosenCivics.map(c => `<span class="summary-tag" style="border-color:var(--color-secondary); color:var(--color-secondary); background:rgba(255,170,0,0.1);">${c.name}</span>`).join('')}
                        ${chosenCivics.length === 0 ? '<span style="color:#666; font-size:11px;">No state civics selected.</span>' : ''}
                    </div>
                </div>

                <div class="summary-box">
                    <h3>${SVG_STATS} Starting Modifiers</h3>
                    <div class="summary-item"><span class="label">Energy Upkeep</span><span class="value">${archetype.modifiers.energy_upkeep > 0 ? '-' + archetype.modifiers.energy_upkeep : 'Standard'}</span></div>
                    <div class="summary-item"><span class="label">Food Needs</span><span class="value">${archetype.modifiers.food_upkeep === 0 ? 'None' : (archetype.modifiers.food_upkeep > 1 ? 'High' : 'Standard')}</span></div>
                    <div class="summary-item"><span class="label">Base Growth</span><span class="value">${Math.round(archetype.modifiers.growth * 100)}%</span></div>
                </div>
            </div>
        </div>
    `;
}