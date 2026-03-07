/* Updated: Fixed Machine Intelligence SVG to use animated arch-svg classes (outer spin, inner reverse spin, core pulse, node pulse, ray flash) */
import { ARCHETYPES, ETHICS_AXES, CIVICS } from '../core/civilization_data.js';
import { state } from './ui_creation_state.js';

const ARCHETYPE_SVGS = {
    standard:   `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><rect x="10" y="10" width="40" height="40" rx="4" stroke="currentColor" stroke-width="2" fill="none" class="arch-svg-outer"/><rect x="20" y="20" width="20" height="20" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5" class="arch-svg-inner"/><line x1="30" y1="10" x2="30" y2="20" stroke="currentColor" stroke-width="2" class="arch-svg-line"/><line x1="30" y1="40" x2="30" y2="50" stroke="currentColor" stroke-width="2" class="arch-svg-line"/><line x1="10" y1="30" x2="20" y2="30" stroke="currentColor" stroke-width="2" class="arch-svg-line"/><line x1="40" y1="30" x2="50" y2="30" stroke="currentColor" stroke-width="2" class="arch-svg-line"/><circle cx="30" cy="30" r="5" fill="currentColor" class="arch-svg-core"/></svg>`,
    hive_mind:  `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><circle cx="30" cy="30" r="6" fill="currentColor" class="arch-svg-core"/><circle cx="30" cy="12" r="4" fill="currentColor" opacity="0.8" class="arch-svg-node"/><circle cx="48" cy="21" r="4" fill="currentColor" opacity="0.8" class="arch-svg-node"/><circle cx="48" cy="39" r="4" fill="currentColor" opacity="0.8" class="arch-svg-node"/><circle cx="30" cy="48" r="4" fill="currentColor" opacity="0.8" class="arch-svg-node"/><circle cx="12" cy="39" r="4" fill="currentColor" opacity="0.8" class="arch-svg-node"/><circle cx="12" cy="21" r="4" fill="currentColor" opacity="0.8" class="arch-svg-node"/><line x1="30" y1="30" x2="30" y2="16" stroke="currentColor" stroke-width="1.5" opacity="0.6" class="arch-svg-link"/><line x1="30" y1="30" x2="44" y2="23" stroke="currentColor" stroke-width="1.5" opacity="0.6" class="arch-svg-link"/><line x1="30" y1="30" x2="44" y2="37" stroke="currentColor" stroke-width="1.5" opacity="0.6" class="arch-svg-link"/><line x1="30" y1="30" x2="30" y2="44" stroke="currentColor" stroke-width="1.5" opacity="0.6" class="arch-svg-link"/><line x1="30" y1="30" x2="16" y2="37" stroke="currentColor" stroke-width="1.5" opacity="0.6" class="arch-svg-link"/><line x1="30" y1="30" x2="16" y2="23" stroke="currentColor" stroke-width="1.5" opacity="0.6" class="arch-svg-link"/></svg>`,
    machine:    `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><rect x="14" y="14" width="32" height="32" rx="4" stroke="currentColor" stroke-width="2" fill="none" class="arch-svg-outer"/><rect x="22" y="22" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" class="arch-svg-inner"/><circle cx="30" cy="30" r="4" fill="currentColor" class="arch-svg-core"/><line x1="30" y1="6" x2="30" y2="14" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><line x1="30" y1="46" x2="30" y2="54" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><line x1="6" y1="30" x2="14" y2="30" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><line x1="46" y1="30" x2="54" y2="30" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><circle cx="30" cy="8" r="2.5" fill="currentColor" opacity="0.7" class="arch-svg-node"/><circle cx="52" cy="30" r="2.5" fill="currentColor" opacity="0.7" class="arch-svg-node"/><circle cx="30" cy="52" r="2.5" fill="currentColor" opacity="0.7" class="arch-svg-node"/><circle cx="8" cy="30" r="2.5" fill="currentColor" opacity="0.7" class="arch-svg-node"/></svg>`,
    megacorp:   `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><polygon points="30,6 54,20 54,40 30,54 6,40 6,20" stroke="currentColor" stroke-width="2" fill="none" class="arch-svg-hex"/><path d="M22 34 L26 24 L30 32 L34 20 L38 30" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" class="arch-svg-chart"/><line x1="18" y1="38" x2="42" y2="38" stroke="currentColor" stroke-width="1.5" class="arch-svg-base"/></svg>`,
    nomadic:    `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><path d="M30 8 L44 20 L44 36 L30 44 L16 36 L16 20 Z" stroke="currentColor" stroke-width="2" fill="none" class="arch-svg-ship"/><path d="M22 16 L38 16" stroke="currentColor" stroke-width="1.5" class="arch-svg-wing"/><path d="M20 26 L40 26" stroke="currentColor" stroke-width="1.5" class="arch-svg-wing"/><circle cx="30" cy="32" r="4" fill="currentColor" opacity="0.8" class="arch-svg-engine"/><circle cx="30" cy="32" r="8" stroke="currentColor" stroke-width="1" fill="none" stroke-dasharray="2 2" opacity="0.4" class="arch-svg-thruster"/></svg>`,
    precursor:  `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><circle cx="30" cy="30" r="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="6 3" class="arch-svg-outer"/><circle cx="30" cy="30" r="14" stroke="currentColor" stroke-width="1.5" fill="none" class="arch-svg-mid"/><circle cx="30" cy="30" r="6" fill="currentColor" opacity="0.9" class="arch-svg-core"/><line x1="30" y1="8" x2="30" y2="16" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><line x1="52" y1="30" x2="44" y2="30" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><line x1="8" y1="30" x2="16" y2="30" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/><line x1="30" y1="52" x2="30" y2="44" stroke="currentColor" stroke-width="2" class="arch-svg-ray"/></svg>`,
    parasitic:  `<svg viewBox="0 0 60 60" fill="none" class="arch-svg"><circle cx="30" cy="30" r="10" stroke="currentColor" stroke-width="2" fill="none" class="arch-svg-core-ring"/><circle cx="30" cy="30" r="4" fill="currentColor" class="arch-svg-core"/><path d="M30 20 Q20 10 10 18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="arch-svg-tendril"/><path d="M40 30 Q52 22 50 10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="arch-svg-tendril"/><path d="M30 40 Q38 52 28 56" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="arch-svg-tendril"/><path d="M20 30 Q8 38 10 50" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="arch-svg-tendril"/></svg>`,
};

// ── Step 4: Archetype ─────────────────────────────────────────────────────────
export function renderArchetypeStep(parent) {
    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 4: Play Style</h2>
            <p>Choose your civilization's governing archetype.</p>
        </div>
        <div class="creation-section">
            <label class="section-label-fancy">Galactic Archetype</label>
            <div class="archetype-grid" id="opt-archetype"></div>
        </div>
    `;

    const archContainer = parent.querySelector('#opt-archetype');
    ARCHETYPES.forEach(arch => {
        const svg = ARCHETYPE_SVGS[arch.id] || `<svg viewBox="0 0 60 60" class="arch-svg"><circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;
        const card = document.createElement('div');
        card.className = `archetype-card ${state.currentCiv.archetype === arch.id ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="archetype-card-icon">${svg}</div>
            <div class="archetype-card-body">
                <div class="archetype-card-name">${arch.name}</div>
                <div class="archetype-card-mechanic">⚙ ${arch.mechanic}</div>
                <div class="archetype-card-desc">${arch.desc}</div>
            </div>
            <div class="archetype-card-check"></div>
        `;
        card.addEventListener('click', () => {
            state.currentCiv.archetype = arch.id;
            archContainer.querySelectorAll('.archetype-card').forEach(c => {
                c.classList.remove('selected');
                c.querySelector('.archetype-card-check').innerHTML = '';
            });
            card.classList.add('selected');
            card.querySelector('.archetype-card-check').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        });
        if (state.currentCiv.archetype === arch.id) {
            card.querySelector('.archetype-card-check').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
        }
        archContainer.appendChild(card);
    });
}

// ── Step 5: Ideological Spectrum ──────────────────────────────────────────────
export function renderEthicsStep(parent) {
    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 5: Ideological Spectrum</h2>
            <p>Define your empire's core ideological alignment across five axes.</p>
        </div>
        <div class="creation-section">
            <div class="ethics-sliders" id="opt-ethics"></div>
        </div>
    `;

    const ethicsContainer = parent.querySelector('#opt-ethics');
    ETHICS_AXES.forEach(axis => {
        const val = state.currentCiv.ethics[axis.id] || 0;
        const row = document.createElement('div');
        row.className = 'ethics-row';
        row.innerHTML = `
            <div class="ethics-labels">
                <span class="ethic-label left">${axis.left}</span>
                <span class="ethic-label right">${axis.right}</span>
            </div>
            <div class="ethics-track">
                <input type="range" min="-2" max="2" value="${val}" step="1" data-id="${axis.id}">
            </div>
        `;
        row.querySelector('input').addEventListener('input', (e) => {
            state.currentCiv.ethics[axis.id] = parseInt(e.target.value);
        });
        ethicsContainer.appendChild(row);
    });
}

const CIVIC_SVGS = {
    philosopher_kings:       `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><polygon points="30,6 34,22 50,22 37,32 42,48 30,38 18,48 23,32 10,22 26,22" stroke="currentColor" stroke-width="1.5" fill="none" class="civic-svg-star"/><circle cx="30" cy="30" r="5" fill="currentColor" opacity="0.8" class="civic-svg-core"/></svg>`,
    merchant_guilds:         `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-ring"/><path d="M22 30 L30 22 L38 30 L30 38 Z" stroke="currentColor" stroke-width="1.5" fill="none" class="civic-svg-diamond"/><line x1="30" y1="10" x2="30" y2="22" stroke="currentColor" stroke-width="1.5" class="civic-svg-line"/><line x1="30" y1="38" x2="30" y2="50" stroke="currentColor" stroke-width="1.5" class="civic-svg-line"/><circle cx="30" cy="30" r="3" fill="currentColor" class="civic-svg-core"/></svg>`,
    warrior_caste:           `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><line x1="30" y1="6" x2="30" y2="46" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="civic-svg-blade"/><line x1="18" y1="26" x2="42" y2="26" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="civic-svg-guard"/><path d="M26 46 L30 54 L34 46 Z" fill="currentColor" class="civic-svg-pommel"/><circle cx="30" cy="12" r="3" fill="currentColor" opacity="0.7" class="civic-svg-tip"/></svg>`,
    hive_network:            `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><circle cx="30" cy="30" r="5" fill="currentColor" class="civic-svg-core"/><circle cx="30" cy="10" r="3" fill="currentColor" opacity="0.8" class="civic-svg-node"/><circle cx="47" cy="20" r="3" fill="currentColor" opacity="0.8" class="civic-svg-node"/><circle cx="47" cy="40" r="3" fill="currentColor" opacity="0.8" class="civic-svg-node"/><circle cx="30" cy="50" r="3" fill="currentColor" opacity="0.8" class="civic-svg-node"/><circle cx="13" cy="40" r="3" fill="currentColor" opacity="0.8" class="civic-svg-node"/><circle cx="13" cy="20" r="3" fill="currentColor" opacity="0.8" class="civic-svg-node"/><line x1="30" y1="30" x2="30" y2="13" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-link"/><line x1="30" y1="30" x2="44" y2="22" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-link"/><line x1="30" y1="30" x2="44" y2="38" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-link"/><line x1="30" y1="30" x2="30" y2="47" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-link"/><line x1="30" y1="30" x2="16" y2="38" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-link"/><line x1="30" y1="30" x2="16" y2="22" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-link"/></svg>`,
    digital_consciousness:   `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><rect x="12" y="12" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-box"/><line x1="12" y1="24" x2="48" y2="24" stroke="currentColor" stroke-width="1" opacity="0.4" class="civic-svg-grid"/><line x1="12" y1="36" x2="48" y2="36" stroke="currentColor" stroke-width="1" opacity="0.4" class="civic-svg-grid"/><line x1="24" y1="12" x2="24" y2="48" stroke="currentColor" stroke-width="1" opacity="0.4" class="civic-svg-grid"/><line x1="36" y1="12" x2="36" y2="48" stroke="currentColor" stroke-width="1" opacity="0.4" class="civic-svg-grid"/><circle cx="30" cy="30" r="5" fill="currentColor" class="civic-svg-core"/><circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.6" class="civic-svg-bit"/><circle cx="36" cy="24" r="2" fill="currentColor" opacity="0.6" class="civic-svg-bit"/><circle cx="24" cy="36" r="2" fill="currentColor" opacity="0.6" class="civic-svg-bit"/><circle cx="36" cy="36" r="2" fill="currentColor" opacity="0.6" class="civic-svg-bit"/></svg>`,
    devouring_swarm:         `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><circle cx="30" cy="30" r="8" fill="currentColor" opacity="0.9" class="civic-svg-core"/><circle cx="30" cy="30" r="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-dasharray="4 2" class="civic-svg-ring1"/><circle cx="30" cy="30" r="24" stroke="currentColor" stroke-width="1" fill="none" stroke-dasharray="3 3" class="civic-svg-ring2"/><circle cx="30" cy="14" r="3" fill="currentColor" opacity="0.7" class="civic-svg-dot"/><circle cx="44" cy="22" r="2.5" fill="currentColor" opacity="0.6" class="civic-svg-dot"/><circle cx="44" cy="38" r="2" fill="currentColor" opacity="0.5" class="civic-svg-dot"/><circle cx="30" cy="46" r="2.5" fill="currentColor" opacity="0.6" class="civic-svg-dot"/><circle cx="16" cy="38" r="2" fill="currentColor" opacity="0.5" class="civic-svg-dot"/><circle cx="16" cy="22" r="3" fill="currentColor" opacity="0.7" class="civic-svg-dot"/></svg>`,
    determined_exterminator: `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><path d="M30 6 L50 20 L50 40 L30 54 L10 40 L10 20 Z" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-shield"/><path d="M22 28 L28 34 L38 22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="civic-svg-check"/></svg>`,
    private_prospectors:     `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><rect x="14" y="28" width="32" height="22" rx="3" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-chest"/><path d="M22 28 L22 22 Q22 14 30 14 Q38 14 38 22 L38 28" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-lid"/><line x1="14" y1="36" x2="46" y2="36" stroke="currentColor" stroke-width="1.5" class="civic-svg-band"/><circle cx="30" cy="42" r="3" fill="currentColor" opacity="0.8" class="civic-svg-lock"/></svg>`,
    stellar_cartographers:   `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><circle cx="30" cy="30" r="22" stroke="currentColor" stroke-width="1.5" fill="none" class="civic-svg-ring"/><ellipse cx="30" cy="30" rx="22" ry="10" stroke="currentColor" stroke-width="1" fill="none" opacity="0.4" class="civic-svg-orbit"/><ellipse cx="30" cy="30" rx="22" ry="10" stroke="currentColor" stroke-width="1" fill="none" opacity="0.4" transform="rotate(60 30 30)" class="civic-svg-orbit"/><ellipse cx="30" cy="30" rx="22" ry="10" stroke="currentColor" stroke-width="1" fill="none" opacity="0.4" transform="rotate(120 30 30)" class="civic-svg-orbit"/><circle cx="30" cy="30" r="4" fill="currentColor" class="civic-svg-core"/><circle cx="42" cy="18" r="2.5" fill="currentColor" opacity="0.7" class="civic-svg-dot"/><circle cx="18" cy="42" r="2" fill="currentColor" opacity="0.5" class="civic-svg-dot"/></svg>`,
    void_architects:         `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><path d="M30 8 L48 20 L48 40 L30 52 L12 40 L12 20 Z" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-hex"/><path d="M30 16 L40 22 L40 34 L30 40 L20 34 L20 22 Z" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5" class="civic-svg-hex-inner"/><circle cx="30" cy="28" r="4" fill="currentColor" class="civic-svg-core"/><line x1="30" y1="8" x2="30" y2="16" stroke="currentColor" stroke-width="1.5" class="civic-svg-line"/><line x1="48" y1="20" x2="40" y2="22" stroke="currentColor" stroke-width="1.5" class="civic-svg-line"/><line x1="12" y1="20" x2="20" y2="22" stroke="currentColor" stroke-width="1.5" class="civic-svg-line"/></svg>`,
    gene_sculptors:          `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><path d="M22 8 Q30 18 22 28 Q30 38 22 48" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="civic-svg-helix1"/><path d="M38 8 Q30 18 38 28 Q30 38 38 48" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" class="civic-svg-helix2"/><line x1="24" y1="13" x2="36" y2="13" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-rung"/><line x1="22" y1="23" x2="38" y2="23" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-rung"/><line x1="24" y1="33" x2="36" y2="33" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-rung"/><line x1="22" y1="43" x2="38" y2="43" stroke="currentColor" stroke-width="1.5" opacity="0.5" class="civic-svg-rung"/><circle cx="30" cy="28" r="4" fill="currentColor" opacity="0.8" class="civic-svg-core"/></svg>`,
    fleet_doctrine:          `<svg viewBox="0 0 60 60" fill="none" class="civic-svg"><path d="M30 10 L42 22 L42 38 L30 50 L18 38 L18 22 Z" stroke="currentColor" stroke-width="2" fill="none" class="civic-svg-shield"/><path d="M30 18 L36 24 L36 34 L30 40 L24 34 L24 24 Z" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5" class="civic-svg-inner"/><circle cx="30" cy="30" r="4" fill="currentColor" class="civic-svg-core"/><path d="M12 16 L18 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="civic-svg-line"/><path d="M48 16 L42 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="civic-svg-line"/><path d="M30 4 L30 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="civic-svg-line"/></svg>`,
};

// ── Step 6: Civics ────────────────────────────────────────────────────────────
export function renderCivicsStep(parent) {
    const currentArchName = ARCHETYPES.find(a => a.id === state.currentCiv.archetype)?.name;

    // Clean up civics that no longer match archetype
    state.currentCiv.civics = state.currentCiv.civics.filter(cid => {
        const civic = CIVICS.find(c => c.id === cid);
        return !civic || !civic.req || civic.req === currentArchName;
    });

    const selectedCount = state.currentCiv.civics.length;

    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 6: Imperial Civics</h2>
            <p>Choose 2 governing principles that shape your empire's laws and culture.</p>
        </div>
        <div class="traits-counter-bar">
            <span class="traits-counter-label">CIVICS SELECTED</span>
            <div class="traits-counter-pips">
                <div class="traits-pip ${selectedCount >= 1 ? 'active' : ''}"></div>
                <div class="traits-pip ${selectedCount >= 2 ? 'active' : ''}"></div>
            </div>
            <span class="traits-counter-val">${selectedCount} / 2</span>
        </div>
        <div class="traits-full-grid" id="opt-civics"></div>
    `;

    const civicsContainer = parent.querySelector('#opt-civics');

    CIVICS.forEach(civic => {
        if (civic.req && civic.req !== currentArchName) return;

        const isSelected = state.currentCiv.civics.includes(civic.id);
        const svg = CIVIC_SVGS[civic.id] || `<svg viewBox="0 0 60 60" class="civic-svg"><circle cx="30" cy="30" r="20" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

        const card = document.createElement('div');
        card.className = `trait-card ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="trait-card-icon">${svg}</div>
            <div class="trait-card-body">
                <div class="trait-card-name">${civic.name}</div>
                <div class="trait-card-desc">${civic.desc}</div>
                ${civic.req ? `<div class="trait-card-cost"><span class="trait-cost-label">REQUIRES</span><span class="trait-cost-val" style="color:var(--color-secondary)">${civic.req}</span></div>` : ''}
            </div>
            <div class="trait-card-check">${isSelected ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}</div>
        `;

        card.addEventListener('click', () => {
            const nowSelected = state.currentCiv.civics.includes(civic.id);
            if (nowSelected) {
                state.currentCiv.civics = state.currentCiv.civics.filter(c => c !== civic.id);
                card.classList.remove('selected');
                card.querySelector('.trait-card-check').innerHTML = '';
            } else {
                if (state.currentCiv.civics.length >= 2) return;
                state.currentCiv.civics.push(civic.id);
                card.classList.add('selected');
                card.querySelector('.trait-card-check').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
            }
            const count = state.currentCiv.civics.length;
            parent.querySelector('.traits-counter-val').textContent = `${count} / 2`;
            parent.querySelectorAll('.traits-pip').forEach((pip, i) => {
                pip.classList.toggle('active', i < count);
            });
        });

        civicsContainer.appendChild(card);
    });
}