import { events, applyEventChoice } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

let _modal = null;

/* ── Category display config ────────────────────────────────────────────── */
const CATEGORY_META = {
    opportunity: { label: 'OPPORTUNITY', color: '#4ade80' },
    danger:      { label: 'ALERT',       color: '#f87171' },
    discovery:   { label: 'DISCOVERY',   color: '#a78bfa' },
    diplomacy:   { label: 'DIPLOMATIC',  color: '#fbbf24' },
};

/* ── Resource display helpers ───────────────────────────────────────────── */
const RES_ICONS = {
    energy:   `<svg class="evt-res-icon" viewBox="0 0 16 16"><path d="M9 1L3 9h4l-1 6 6-8H8z" fill="currentColor"/></svg>`,
    minerals: `<svg class="evt-res-icon" viewBox="0 0 16 16"><path d="M8 1L1 7l7 8 7-8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7h8M6 4l2 11M10 4l-2 11" stroke="currentColor" stroke-width="0.8" opacity="0.5"/></svg>`,
    food:     `<svg class="evt-res-icon" viewBox="0 0 16 16"><path d="M8 2C5 2 3 5 3 7c0 2 1.5 3.5 3 4v3h4v-3c1.5-.5 3-2 3-4 0-2-2-5-5-5z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
};

function _formatEffect(effect) {
    const parts = [];
    for (const [key, val] of Object.entries(effect)) {
        if (val === 0) continue;
        const icon = RES_ICONS[key] || '';
        const sign = val > 0 ? '+' : '';
        const cls  = val > 0 ? 'evt-eff-pos' : 'evt-eff-neg';
        parts.push(`<span class="evt-eff-chip ${cls}">${icon}${sign}${val}</span>`);
    }
    return parts.join('');
}

/* ── Modal construction ─────────────────────────────────────────────────── */
function _ensureModal() {
    if (_modal) return _modal;
    _modal = document.createElement('div');
    _modal.id = 'event-modal';
    _modal.className = 'event-modal hidden';
    _modal.innerHTML = `
        <div class="evt-backdrop"></div>
        <div class="evt-box">
            <!-- Decorative corner accents -->
            <span class="evt-corner evt-corner-tl"></span>
            <span class="evt-corner evt-corner-tr"></span>
            <span class="evt-corner evt-corner-bl"></span>
            <span class="evt-corner evt-corner-br"></span>

            <!-- Animated scan line -->
            <div class="evt-scanline"></div>

            <!-- Header -->
            <div class="evt-header">
                <div class="evt-icon-wrap">
                    <svg class="evt-icon" viewBox="0 0 24 24"></svg>
                    <div class="evt-icon-ring"></div>
                </div>
                <div class="evt-header-text">
                    <span class="evt-category"></span>
                    <span class="evt-title"></span>
                </div>
            </div>

            <!-- Separator with glow -->
            <div class="evt-separator">
                <div class="evt-sep-line"></div>
                <div class="evt-sep-diamond"></div>
                <div class="evt-sep-line"></div>
            </div>

            <!-- Description -->
            <div class="evt-desc"></div>

            <!-- Choices -->
            <div class="evt-choices"></div>

            <!-- Footer accent -->
            <div class="evt-footer-line"></div>
        </div>
    `;
    document.body.appendChild(_modal);

    _modal.addEventListener('click', (e) => {
        if (e.target === _modal || e.target.classList.contains('evt-backdrop')) {
            _modal.classList.add('hidden');
        }
    });

    return _modal;
}

/* ── Show event ─────────────────────────────────────────────────────────── */
function _showEvent(evt) {
    const modal = _ensureModal();
    const cat = CATEGORY_META[evt.category] || CATEGORY_META.discovery;

    // Set category accent color as CSS variable
    modal.style.setProperty('--evt-accent', cat.color);

    // Icon
    const iconSvg = modal.querySelector('.evt-icon');
    iconSvg.innerHTML = evt.icon || '';

    // Category badge
    const catEl = modal.querySelector('.evt-category');
    catEl.textContent = cat.label;

    // Title
    modal.querySelector('.evt-title').textContent = evt.title;

    // Description
    modal.querySelector('.evt-desc').textContent = evt.desc;

    // Choices
    const choicesEl = modal.querySelector('.evt-choices');
    choicesEl.innerHTML = '';
    evt.choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'evt-choice-btn';
        btn.style.animationDelay = `${0.15 + i * 0.07}s`;

        const hasEffect = Object.values(choice.effect).some(v => v !== 0);
        btn.innerHTML = `
            <div class="evt-choice-row">
                <span class="evt-choice-marker"></span>
                <span class="evt-choice-label">${choice.label}</span>
            </div>
            ${hasEffect ? `<div class="evt-choice-effects">${_formatEffect(choice.effect)}</div>` : ''}
        `;
        btn.addEventListener('click', () => {
            applyEventChoice(choice.effect);
            modal.classList.add('hidden');
            showNotification(`${evt.title}: ${choice.label}`, 'info');
        });
        choicesEl.appendChild(btn);
    });

    // Trigger entrance animation
    const box = modal.querySelector('.evt-box');
    box.classList.remove('evt-enter');
    modal.classList.remove('hidden');
    // Force reflow to restart animation
    void box.offsetWidth;
    box.classList.add('evt-enter');
}

export function initEventsUI() {
    events.addEventListener('random-event', (e) => {
        _showEvent(e.detail.event);
    });
}
