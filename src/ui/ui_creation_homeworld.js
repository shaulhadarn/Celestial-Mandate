/* Updated: Split into Step 2 (Homeworld only) and Step 3 (Biological Traits with animated SVGs) */
import { HOMEWORLD_TYPES, TRAITS } from '../core/civilization_data.js';
import { state } from './ui_creation_state.js';

// ── Animated SVG icons per trait ─────────────────────────────────────────────
const TRAIT_SVGS = {
    resilient: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <polygon points="30,4 56,18 56,42 30,56 4,42 4,18" stroke="currentColor" stroke-width="2" fill="none" class="trait-svg-hex"/>
        <polygon points="30,12 48,22 48,38 30,48 12,38 12,22" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5" class="trait-svg-hex-inner"/>
        <circle cx="30" cy="30" r="8" fill="currentColor" opacity="0.8" class="trait-svg-core"/>
        <line x1="30" y1="4" x2="30" y2="12" stroke="currentColor" stroke-width="2" class="trait-svg-spoke"/>
        <line x1="56" y1="18" x2="48" y2="22" stroke="currentColor" stroke-width="2" class="trait-svg-spoke"/>
        <line x1="56" y1="42" x2="48" y2="38" stroke="currentColor" stroke-width="2" class="trait-svg-spoke"/>
        <line x1="30" y1="56" x2="30" y2="48" stroke="currentColor" stroke-width="2" class="trait-svg-spoke"/>
        <line x1="4" y1="42" x2="12" y2="38" stroke="currentColor" stroke-width="2" class="trait-svg-spoke"/>
        <line x1="4" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="2" class="trait-svg-spoke"/>
    </svg>`,
    rapid_breeders: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="30" r="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="4 3" class="trait-svg-orbit"/>
        <circle cx="30" cy="30" r="14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="3 2" class="trait-svg-orbit2"/>
        <circle cx="30" cy="30" r="5" fill="currentColor" class="trait-svg-core"/>
        <circle cx="30" cy="8" r="3.5" fill="currentColor" opacity="0.9" class="trait-svg-dot1"/>
        <circle cx="52" cy="30" r="3" fill="currentColor" opacity="0.7" class="trait-svg-dot2"/>
        <circle cx="30" cy="52" r="2.5" fill="currentColor" opacity="0.5" class="trait-svg-dot3"/>
        <circle cx="8" cy="30" r="2" fill="currentColor" opacity="0.3" class="trait-svg-dot4"/>
    </svg>`,
    psionic: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="1.5" fill="none" class="trait-svg-ring"/>
        <path d="M30 10 L34 26 L50 30 L34 34 L30 50 L26 34 L10 30 L26 26 Z" stroke="currentColor" stroke-width="1.5" fill="none" class="trait-svg-star"/>
        <circle cx="30" cy="30" r="4" fill="currentColor" class="trait-svg-core"/>
        <circle cx="30" cy="30" r="8" stroke="currentColor" stroke-width="1" fill="none" opacity="0.4" class="trait-svg-pulse"/>
    </svg>`,
    photosynthetic: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="22" r="12" stroke="currentColor" stroke-width="2" fill="none" class="trait-svg-sun"/>
        <line x1="30" y1="4" x2="30" y2="10" stroke="currentColor" stroke-width="2" class="trait-svg-ray"/>
        <line x1="48" y1="22" x2="54" y2="22" stroke="currentColor" stroke-width="2" class="trait-svg-ray"/>
        <line x1="6" y1="22" x2="12" y2="22" stroke="currentColor" stroke-width="2" class="trait-svg-ray"/>
        <line x1="43" y1="9" x2="47" y2="5" stroke="currentColor" stroke-width="2" class="trait-svg-ray"/>
        <line x1="17" y1="9" x2="13" y2="5" stroke="currentColor" stroke-width="2" class="trait-svg-ray"/>
        <path d="M30 34 Q22 42 18 54" stroke="currentColor" stroke-width="2" fill="none" class="trait-svg-stem"/>
        <path d="M30 38 Q38 34 44 38 Q40 46 30 44 Z" fill="currentColor" opacity="0.7" class="trait-svg-leaf"/>
        <path d="M28 44 Q20 40 16 46 Q20 52 28 50 Z" fill="currentColor" opacity="0.5" class="trait-svg-leaf2"/>
    </svg>`,
    toxic_adapted: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="30" r="18" stroke="currentColor" stroke-width="2" fill="none" class="trait-svg-ring"/>
        <circle cx="30" cy="30" r="10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="5 3" class="trait-svg-inner"/>
        <path d="M30 12 L30 20" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="trait-svg-biohaz"/>
        <path d="M30 40 L30 48" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="trait-svg-biohaz"/>
        <path d="M12 30 L20 30" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="trait-svg-biohaz"/>
        <path d="M40 30 L48 30" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="trait-svg-biohaz"/>
        <circle cx="30" cy="30" r="5" fill="currentColor" class="trait-svg-core"/>
        <circle cx="30" cy="14" r="3" fill="currentColor" opacity="0.8" class="trait-svg-node"/>
        <circle cx="30" cy="46" r="3" fill="currentColor" opacity="0.8" class="trait-svg-node"/>
        <circle cx="14" cy="30" r="3" fill="currentColor" opacity="0.8" class="trait-svg-node"/>
        <circle cx="46" cy="30" r="3" fill="currentColor" opacity="0.8" class="trait-svg-node"/>
    </svg>`,
    regenerative: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="1.5" fill="none" class="trait-svg-ring"/>
        <path d="M30 14 A16 16 0 0 1 46 30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" class="trait-svg-spoke"/>
        <path d="M46 30 A16 16 0 0 1 30 46" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.7" class="trait-svg-spoke"/>
        <path d="M30 46 A16 16 0 0 1 14 30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.5" class="trait-svg-spoke"/>
        <path d="M14 30 A16 16 0 0 1 30 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.3" class="trait-svg-spoke"/>
        <circle cx="30" cy="30" r="6" fill="currentColor" opacity="0.8" class="trait-svg-core"/>
        <circle cx="30" cy="14" r="3" fill="currentColor" class="trait-svg-dot1"/>
        <circle cx="46" cy="30" r="3" fill="currentColor" opacity="0.7" class="trait-svg-dot2"/>
    </svg>`,
    hive_synapse: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="30" r="6" fill="currentColor" class="trait-svg-core"/>
        <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.7" class="trait-svg-node"/>
        <circle cx="44" cy="16" r="4" fill="currentColor" opacity="0.7" class="trait-svg-node"/>
        <circle cx="16" cy="44" r="4" fill="currentColor" opacity="0.7" class="trait-svg-node"/>
        <circle cx="44" cy="44" r="4" fill="currentColor" opacity="0.7" class="trait-svg-node"/>
        <line x1="30" y1="30" x2="16" y2="16" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="trait-svg-spoke"/>
        <line x1="30" y1="30" x2="44" y2="16" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="trait-svg-spoke"/>
        <line x1="30" y1="30" x2="16" y2="44" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="trait-svg-spoke"/>
        <line x1="30" y1="30" x2="44" y2="44" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="trait-svg-spoke"/>
        <line x1="16" y1="16" x2="44" y2="16" stroke="currentColor" stroke-width="1" opacity="0.3" stroke-dasharray="3 2"/>
        <line x1="44" y1="16" x2="44" y2="44" stroke="currentColor" stroke-width="1" opacity="0.3" stroke-dasharray="3 2"/>
        <line x1="44" y1="44" x2="16" y2="44" stroke="currentColor" stroke-width="1" opacity="0.3" stroke-dasharray="3 2"/>
        <line x1="16" y1="44" x2="16" y2="16" stroke="currentColor" stroke-width="1" opacity="0.3" stroke-dasharray="3 2"/>
    </svg>`,
    void_touched: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="trait-svg">
        <circle cx="30" cy="30" r="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="5 4" class="trait-svg-orbit"/>
        <circle cx="30" cy="30" r="14" stroke="currentColor" stroke-width="1" fill="none" opacity="0.4" class="trait-svg-orbit2"/>
        <circle cx="30" cy="30" r="5" fill="currentColor" class="trait-svg-core"/>
        <path d="M30 8 L32 16 L40 14 L34 20 L42 24 L34 24 L36 32 L30 26 L24 32 L26 24 L18 24 L26 20 L20 14 L28 16 Z" stroke="currentColor" stroke-width="1.5" fill="none" class="trait-svg-star"/>
    </svg>`,
};

// ── Step 2: Homeworld ─────────────────────────────────────────────────────────
export function renderHomeworldStep(parent) {
    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 2: Homeworld</h2>
            <p>Select your species' native environment and planetary origin.</p>
        </div>
        <div class="creation-section">
            <label class="section-label-fancy">Planet Class Preference</label>
            <div class="planet-grid" id="opt-homeworld"></div>
        </div>
    `;

    const hwContainer = parent.querySelector('#opt-homeworld');
    HOMEWORLD_TYPES.forEach(type => {
        const card = document.createElement('div');
        card.className = `planet-card ${state.currentCiv.homeworld === type.id ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="planet-preview">
                <div class="planet-grid-overlay"></div>
                <div class="planet-scanner"></div>
                <div class="planet-atmosphere" style="position:absolute; width:80%; height:80%; border-radius:50%; background: radial-gradient(circle at center, transparent 40%, ${type.glow || 'rgba(0,242,255,0.2)'} 100%); pointer-events:none; z-index:3; filter: blur(8px);"></div>
                <div class="planet-image-loader"></div>
                <img class="planet-lazy-image" src="" data-src="${type.img}" style="z-index:2; position:relative; width: 75%; filter: drop-shadow(0 0 15px ${type.glow || 'rgba(0,242,255,0.2)'}); opacity: 0; transition: opacity 0.8s ease;">
            </div>
            <div class="planet-info">
                <div class="planet-name">${type.name}</div>
                <div class="planet-type-label">${type.id === 'Gas Giant' ? 'Atmospheric' : 'Solid Surface'}</div>
                <div class="planet-desc">${type.desc}</div>
                <div class="planet-stats-row">
                    <div class="planet-stat"><span class="label">HABITABILITY</span><span class="value">100%</span></div>
                    <div class="planet-stat"><span class="label">RESOURCES</span><span class="value">ABUNDANT</span></div>
                    <div class="planet-stat"><span class="label">GRAVITY</span><span class="value">1.0G</span></div>
                </div>
            </div>
        `;

        const img = card.querySelector('.planet-lazy-image');
        const loader = card.querySelector('.planet-image-loader');
        const tempImg = new Image();
        tempImg.onload = () => { img.src = type.img; img.style.opacity = '1'; loader.classList.add('hidden'); };
        tempImg.src = type.img;

        card.addEventListener('click', () => {
            state.currentCiv.homeworld = type.id;
            Array.from(hwContainer.children).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
        hwContainer.appendChild(card);
    });
}

// ── Step 3: Biological Traits ─────────────────────────────────────────────────
export function renderTraitsStep(parent) {
    const selectedCount = state.currentCiv.traits.length;

    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 3: Biological Traits</h2>
            <p>Choose up to 2 inherent biological abilities that define your species.</p>
        </div>
        <div class="traits-counter-bar">
            <span class="traits-counter-label">TRAITS SELECTED</span>
            <div class="traits-counter-pips">
                <div class="traits-pip ${selectedCount >= 1 ? 'active' : ''}"></div>
                <div class="traits-pip ${selectedCount >= 2 ? 'active' : ''}"></div>
            </div>
            <span class="traits-counter-val">${selectedCount} / 2</span>
        </div>
        <div class="traits-full-grid" id="opt-traits"></div>
    `;

    const traitsContainer = parent.querySelector('#opt-traits');

    TRAITS.forEach(trait => {
        const isSelected = state.currentCiv.traits.includes(trait.id);
        const svgIcon = TRAIT_SVGS[trait.id] || `<svg viewBox="0 0 60 60" class="trait-svg"><circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

        const card = document.createElement('div');
        card.className = `trait-card ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="trait-card-icon">${svgIcon}</div>
            <div class="trait-card-body">
                <div class="trait-card-name">${trait.name}</div>
                <div class="trait-card-desc">${trait.desc}</div>
                <div class="trait-card-cost">
                    <span class="trait-cost-label">TRAIT COST</span>
                    <span class="trait-cost-val">${trait.cost} pt${trait.cost !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="trait-card-check">${isSelected ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}</div>
        `;

        card.addEventListener('click', () => {
            const nowSelected = state.currentCiv.traits.includes(trait.id);
            if (nowSelected) {
                state.currentCiv.traits = state.currentCiv.traits.filter(t => t !== trait.id);
                card.classList.remove('selected');
                card.querySelector('.trait-card-check').innerHTML = '';
            } else {
                if (state.currentCiv.traits.length >= 2) return;
                state.currentCiv.traits.push(trait.id);
                card.classList.add('selected');
                card.querySelector('.trait-card-check').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
            }
            // Update counter
            const count = state.currentCiv.traits.length;
            parent.querySelector('.traits-counter-val').textContent = `${count} / 2`;
            parent.querySelectorAll('.traits-pip').forEach((pip, i) => {
                pip.classList.toggle('active', i < count);
            });
        });

        traitsContainer.appendChild(card);
    });
}