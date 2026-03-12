/* Tier completion celebration overlay — beautiful animation when all techs in a tier are completed */
import { gameState, events, getTierTechs } from '../core/state.js';

const TIER_THEMES = {
    1: { color: '#00f2ff', glow: 'rgba(0,242,255,0.6)', name: 'Foundations', subtitle: 'The bedrock of your empire is complete.' },
    2: { color: '#ffaa00', glow: 'rgba(255,170,0,0.6)', name: 'Advancement', subtitle: 'Your civilization rises beyond its origins.' },
    3: { color: '#c864ff', glow: 'rgba(200,100,255,0.6)', name: 'Mastery', subtitle: 'You have mastered the forces of the cosmos.' },
    4: { color: '#ffffff', glow: 'rgba(255,255,200,0.8)', name: 'Transcendence', subtitle: 'Your species has ascended beyond physical limits.' },
};

const TIER_LABELS = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV',
};

let _overlay = null;
let _dismissTimer = null;

export function initTierCelebration() {
    events.addEventListener('tier-complete', (e) => {
        const { tier, nextTier } = e.detail;
        showTierCelebration(tier, nextTier);
    });
}

function showTierCelebration(tier, nextTier) {
    _overlay = document.getElementById('tier-celebration-overlay');
    if (!_overlay) return;

    const theme = TIER_THEMES[tier] || TIER_THEMES[1];
    const archetypeId = gameState.playerCivilization?.archetype || 'standard';
    const tierTechs = getTierTechs(tier, archetypeId);

    // Build inner HTML
    let html = '';

    // Backdrop
    html += `<div class="tier-cel-backdrop"></div>`;

    // Particles
    html += `<div class="tier-cel-particles">`;
    for (let i = 0; i < 40; i++) {
        const angle = (Math.random() * 360);
        const dist = 120 + Math.random() * 280;
        const size = 2 + Math.random() * 4;
        const dur = 1.5 + Math.random() * 1.5;
        const delay = Math.random() * 0.8;
        html += `<span class="tier-cel-particle" style="
            --angle:${angle}deg;
            --dist:${dist}px;
            --size:${size}px;
            --dur:${dur}s;
            --delay:${delay}s;
            --color:${theme.color};
        "></span>`;
    }
    html += `</div>`;

    // Central content
    html += `<div class="tier-cel-content" style="--accent:${theme.color}; --glow:${theme.glow};">`;

    // Tier badge
    html += `<div class="tier-cel-badge">
        <div class="tier-cel-badge-ring"></div>
        <div class="tier-cel-badge-number">${TIER_LABELS[tier]}</div>
    </div>`;

    // Title
    html += `<div class="tier-cel-title">TIER ${TIER_LABELS[tier]} COMPLETE</div>`;
    html += `<div class="tier-cel-subtitle">${theme.name}</div>`;
    html += `<div class="tier-cel-flavor">${theme.subtitle}</div>`;

    // Separator
    html += `<div class="tier-cel-separator">
        <div class="tier-cel-sep-line"></div>
        <div class="tier-cel-sep-diamond"></div>
        <div class="tier-cel-sep-line"></div>
    </div>`;

    // Tech icons row
    html += `<div class="tier-cel-techs">`;
    tierTechs.forEach((tech, i) => {
        html += `<div class="tier-cel-tech" style="--i:${i}">
            <span class="tier-cel-tech-icon">${tech.icon}</span>
            <span class="tier-cel-tech-name">${tech.name}</span>
        </div>`;
    });
    html += `</div>`;

    // Next tier unlock text
    if (nextTier && TIER_THEMES[nextTier]) {
        const nextTheme = TIER_THEMES[nextTier];
        html += `<div class="tier-cel-unlock">
            <span class="tier-cel-unlock-icon">&#128275;</span>
            <span>Tier ${TIER_LABELS[nextTier]} Unlocked — ${nextTheme.name}</span>
        </div>`;
    }

    // Click to dismiss hint
    html += `<div class="tier-cel-dismiss">Click anywhere to continue</div>`;

    html += `</div>`; // end content

    _overlay.innerHTML = html;
    _overlay.classList.remove('hidden');
    _overlay.style.setProperty('--accent', theme.color);
    _overlay.style.setProperty('--glow', theme.glow);

    // Force reflow then trigger entrance
    void _overlay.offsetWidth;
    _overlay.classList.add('tier-cel-enter');

    // Auto-dismiss after 6s
    clearTimeout(_dismissTimer);
    _dismissTimer = setTimeout(() => dismissCelebration(), 6000);

    // Click/tap to dismiss early
    _overlay.addEventListener('click', _onDismissClick, { once: true });
}

function _onDismissClick() {
    clearTimeout(_dismissTimer);
    dismissCelebration();
}

function dismissCelebration() {
    if (!_overlay) return;
    _overlay.removeEventListener('click', _onDismissClick);
    _overlay.classList.remove('tier-cel-enter');
    _overlay.classList.add('tier-cel-exit');

    setTimeout(() => {
        if (_overlay) {
            _overlay.classList.add('hidden');
            _overlay.classList.remove('tier-cel-exit');
            _overlay.innerHTML = '';
        }
        _overlay = null;
    }, 600);
}
