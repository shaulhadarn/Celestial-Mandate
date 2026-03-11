import { events, applyEventChoice, scheduleChainStep } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

let _modal = null;

/* ── Category display config ────────────────────────────────────────────── */
const CATEGORY_META = {
    opportunity: { label: 'OPPORTUNITY', color: '#4ade80' },
    danger:      { label: 'ALERT',       color: '#f87171' },
    discovery:   { label: 'DISCOVERY',   color: '#a78bfa' },
    diplomacy:   { label: 'DIPLOMATIC',  color: '#fbbf24' },
    crisis:      { label: 'CRISIS',      color: '#f97316' },
    ancient:     { label: 'ANCIENT',     color: '#2dd4bf' },
    // Milestone categories
    expansion:   { label: 'MILESTONE',   color: '#60a5fa' },
    exploration: { label: 'MILESTONE',   color: '#a78bfa' },
    military:    { label: 'MILESTONE',   color: '#f87171' },
    economy:     { label: 'MILESTONE',   color: '#fbbf24' },
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

/* ── Description formatter — splits block text into readable paragraphs ── */
function _formatDesc(text) {
    if (!text) return '';
    // Escape HTML to prevent XSS
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Split into sentences, group ~2-3 sentences per paragraph
    const sentences = escaped.match(/[^.!?]+[.!?]+/g) || [escaped];
    const paragraphs = [];
    for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join('').trim();
        if (chunk) paragraphs.push(chunk);
    }
    return paragraphs.map(p => `<p class="evt-desc-para">${p}</p>`).join('');
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

            <!-- Chain indicator (hidden by default) -->
            <div class="evt-chain-bar hidden">
                <svg class="evt-chain-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4" cy="8" r="2.5"/><circle cx="12" cy="8" r="2.5"/><line x1="6.5" y1="8" x2="9.5" y2="8"/></svg>
                <span class="evt-chain-text"></span>
            </div>

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

    // Start fully hidden (no display)
    _modal.classList.add('evt-no-display');

    _modal.addEventListener('click', (e) => {
        if (e.target === _modal || e.target.classList.contains('evt-backdrop')) {
            _closeModal();
        }
    });

    return _modal;
}

function _openModal() {
    if (!_modal) return;
    // Remove display:none, start invisible, then fade in
    _modal.classList.remove('evt-no-display');
    _modal.classList.add('hidden');
    // Force reflow so the browser registers the hidden state before removing it
    void _modal.offsetWidth;
    _modal.classList.remove('hidden');
}

function _closeModal() {
    if (!_modal) return;
    const box = _modal.querySelector('.evt-box');
    if (box) {
        box.classList.remove('evt-enter');
        box.classList.add('evt-exit');
    }
    // Fade out overlay slightly after box starts its exit
    setTimeout(() => _modal.classList.add('hidden'), 80);
    // After all animations complete, set display:none and clean up
    setTimeout(() => {
        if (_modal.classList.contains('hidden')) {
            _modal.classList.add('evt-no-display');
            if (box) box.classList.remove('evt-exit');
        }
    }, 500);
}

/* ── Show event (random or chain step) ──────────────────────────────────── */
function _showEvent(evt, chainInfo) {
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

    // Chain indicator
    const chainBar = modal.querySelector('.evt-chain-bar');
    if (chainInfo) {
        chainBar.classList.remove('hidden');
        chainBar.querySelector('.evt-chain-text').textContent =
            `${chainInfo.chainTitle} — Part ${chainInfo.stepNum} of ${chainInfo.totalSteps}`;
    } else {
        chainBar.classList.add('hidden');
    }

    // Title
    modal.querySelector('.evt-title').textContent = evt.title;

    // Description — break long text into readable paragraphs
    const descEl = modal.querySelector('.evt-desc');
    descEl.innerHTML = _formatDesc(evt.desc);

    // Choices
    const choicesEl = modal.querySelector('.evt-choices');
    choicesEl.innerHTML = '';

    // For milestone events (no choices), add a single "Acknowledged" button
    const choices = evt.choices && evt.choices.length > 0
        ? evt.choices
        : [{ label: 'Acknowledged', effect: {} }];

    choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'evt-choice-btn';
        // Force animation restart: start without animation, add it after reflow
        btn.style.animation = 'none';
        btn.style.opacity = '0';

        const escapedLabel = (choice.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const hasEffect = choice.effect && Object.values(choice.effect).some(v => v !== 0);
        btn.innerHTML = `
            <div class="evt-choice-row">
                <span class="evt-choice-marker"></span>
                <span class="evt-choice-label">${escapedLabel}</span>
            </div>
            ${hasEffect ? `<div class="evt-choice-effects">${_formatEffect(choice.effect)}</div>` : ''}
        `;
        btn.addEventListener('click', () => {
            if (choice.effect) applyEventChoice(choice.effect);
            _closeModal();
            showNotification(`${evt.title}: ${choice.label}`, 'info');

            // If this is a chain event, schedule next step
            if (chainInfo && choice.nextStep) {
                scheduleChainStep(chainInfo.chainId, choice.nextStep, choice.delay || [30, 60]);
            } else if (chainInfo && !choice.nextStep) {
                // Chain ends with this choice
                scheduleChainStep(chainInfo.chainId, null, [0, 0]);
            }
        });
        choicesEl.appendChild(btn);
    });

    // Trigger entrance animations
    const box = modal.querySelector('.evt-box');
    box.classList.remove('evt-enter', 'evt-exit');
    _openModal();
    void box.offsetWidth;
    box.classList.add('evt-enter');

    // Restart button entrance animations after modal is visible
    requestAnimationFrame(() => {
        const btns = choicesEl.querySelectorAll('.evt-choice-btn');
        btns.forEach((btn, i) => {
            btn.style.animation = '';
            btn.style.animationDelay = `${0.15 + i * 0.07}s`;
        });
    });
}

/* ── Pirate intro conversation ─────────────────────────────────────────── */

const PIRATE_SKULL_ICON = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M9.5 15.5l1-.5 1.5.5 1.5-.5 1 .5" stroke="currentColor" stroke-width="1" fill="none"/>`;
const COMMANDER_ICON = `<path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 8v6l8 4 8-4V8" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`;

const _pirateConvo = [
    {
        speaker: 'pirate',
        title: 'Incoming Transmission',
        desc: "A crackling signal cuts through your comms array. A scarred face appears on screen, grinning beneath a jagged red visor.\n\n\"Well, well... fresh colonists. Welcome to OUR sector, outsiders. The name's Krath. I run things around here.\"",
        btn: 'Respond...'
    },
    {
        speaker: 'player',
        title: 'Colony Command',
        desc: "\"This is a lawful colonial settlement under imperial charter. Identify yourself and state your intentions.\"",
        btn: 'Continue...'
    },
    {
        speaker: 'pirate',
        title: 'Incoming Transmission',
        desc: "Krath laughs. \"Imperial charter? Out here? That's adorable. Let me explain how this works, colonist. You see that planet on the edge of your system? That's MINE. My crew and I have been running operations from Corsair's Den long before you showed up.\"\n\nHe leans forward, his grin fading. \"Here's the deal — you pay us a little tribute. Minerals. Energy. Consider it... a protection fee.\"",
        btn: 'Respond...'
    },
    {
        speaker: 'player',
        title: 'Colony Command',
        desc: "\"We will not negotiate with raiders. This system is under our jurisdiction now.\"",
        btn: 'Continue...'
    },
    {
        speaker: 'pirate',
        title: 'Incoming Transmission',
        desc: "Krath slams his fist on the console. \"Wrong answer! You don't GET to say no. My raiders are already en route to your precious little colony. We'll take what we need — and we'll keep taking until there's nothing left.\"\n\nHe points at the screen. \"Unless you're smarter than you look... build yourself a shipyard, put together some real firepower, and come try to take us out. Until then — we OWN you.\"\n\nThe transmission cuts to static.",
        btn: 'End Transmission'
    }
];

function _showPirateConvoStep(stepIdx) {
    const step = _pirateConvo[stepIdx];
    if (!step) return;

    const isPirate = step.speaker === 'pirate';
    const evt = {
        category: isPirate ? 'danger' : 'military',
        icon: isPirate ? PIRATE_SKULL_ICON : COMMANDER_ICON,
        title: step.title,
        desc: step.desc,
        choices: [{
            label: step.btn,
            effect: {}
        }]
    };

    // Override the choice click to advance conversation instead of closing
    const modal = _ensureModal();
    const cat = CATEGORY_META[evt.category] || CATEGORY_META.danger;
    modal.style.setProperty('--evt-accent', cat.color);

    const iconSvg = modal.querySelector('.evt-icon');
    iconSvg.innerHTML = evt.icon || '';

    const catEl = modal.querySelector('.evt-category');
    catEl.textContent = isPirate ? 'PIRATE COMMS' : 'YOUR RESPONSE';

    // Chain indicator shows conversation progress
    const chainBar = modal.querySelector('.evt-chain-bar');
    chainBar.classList.remove('hidden');
    chainBar.querySelector('.evt-chain-text').textContent =
        `Transmission — ${stepIdx + 1} of ${_pirateConvo.length}`;

    modal.querySelector('.evt-title').textContent = evt.title;

    const descEl = modal.querySelector('.evt-desc');
    descEl.innerHTML = _formatDesc(evt.desc);

    const choicesEl = modal.querySelector('.evt-choices');
    choicesEl.innerHTML = '';

    const btn = document.createElement('button');
    btn.className = 'evt-choice-btn';
    btn.style.animation = 'none';
    btn.style.opacity = '0';
    const escapedLabel = step.btn.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    btn.innerHTML = `
        <div class="evt-choice-row">
            <span class="evt-choice-marker"></span>
            <span class="evt-choice-label">${escapedLabel}</span>
        </div>
    `;
    btn.addEventListener('click', () => {
        if (stepIdx + 1 < _pirateConvo.length) {
            // Advance to next step
            _showPirateConvoStep(stepIdx + 1);
        } else {
            // End of conversation
            _closeModal();
            showNotification('Pirate raiders will periodically attack your colony. Build a Shipyard and ships to fight back!', 'alert');
        }
    });
    choicesEl.appendChild(btn);

    // Entrance animation
    const box = modal.querySelector('.evt-box');
    box.classList.remove('evt-enter', 'evt-exit');
    if (stepIdx === 0) {
        _openModal();
    }
    void box.offsetWidth;
    box.classList.add('evt-enter');

    requestAnimationFrame(() => {
        btn.style.animation = '';
        btn.style.animationDelay = '0.15s';
    });
}

export function initEventsUI() {
    // Random events + chain events
    events.addEventListener('random-event', (e) => {
        const detail = e.detail;
        const chainInfo = detail.chainId ? {
            chainId: detail.chainId,
            chainTitle: detail.chainTitle,
            stepNum: detail.stepNum,
            totalSteps: detail.totalSteps
        } : null;
        _showEvent(detail.event, chainInfo);
    });

    // Milestone events (no choices, just narrative)
    events.addEventListener('milestone-event', (e) => {
        _showEvent(e.detail.event, null);
    });

    // Pirate intro conversation
    events.addEventListener('pirate-intro', () => {
        _showPirateConvoStep(0);
    });
}
