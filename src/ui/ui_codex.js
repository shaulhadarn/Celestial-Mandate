import { gameState, events } from '../core/state.js';
import { CODEX_ENTRIES, CODEX_CATEGORIES } from '../core/codex_data.js';
import { showNotification } from './ui_notifications.js';

let _selectedId = null;

/* ── Category visual config ────────────────────────────────────────────── */
const CAT_CONFIG = {
    History: {
        color: 'var(--codex-history)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
    },
    Species: {
        color: 'var(--codex-species)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
    },
    Technology: {
        color: 'var(--codex-technology)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
    },
    Anomalies: {
        color: 'var(--codex-anomalies)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>`,
    },
    Factions: {
        color: 'var(--codex-factions)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    },
    Locations: {
        color: 'var(--codex-locations)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 00-8-8z"/></svg>`,
    },
    Civilizations: {
        color: 'var(--codex-civilizations)',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h1"/><path d="M14 10h1"/><path d="M9 14h1"/><path d="M14 14h1"/></svg>`,
    },
};

/* ── Unlock helpers ─────────────────────────────────────────────────────── */
function _isUnlocked(entry) {
    return gameState.codex.unlocked.includes(entry.id);
}

function _tryUnlock(conditionPrefix, conditionValue) {
    const match = conditionPrefix + (conditionValue ? ':' + conditionValue : '');
    let unlocked = false;
    for (const entry of CODEX_ENTRIES) {
        if (_isUnlocked(entry)) continue;
        if (entry.unlockCondition === match || entry.unlockCondition === conditionPrefix) {
            gameState.codex.unlocked.push(entry.id);
            showNotification(`Codex Unlocked: ${entry.title}`, 'info');
            unlocked = true;
        }
    }
    if (unlocked) _renderSidebar();
}

/* ── Rendering ──────────────────────────────────────────────────────────── */
function _renderSidebar() {
    const sidebar = document.getElementById('codex-sidebar');
    if (!sidebar) return;

    let html = '';
    for (const cat of CODEX_CATEGORIES) {
        const cfg = CAT_CONFIG[cat] || { color: 'var(--color-primary)', icon: '' };
        const entries = CODEX_ENTRIES.filter(e => e.category === cat);
        const unlockedCount = entries.filter(e => _isUnlocked(e)).length;

        html += `<div class="codex-cat-group">`;
        html += `<div class="codex-cat-header" style="color:${cfg.color}">
            <span class="codex-cat-icon">${cfg.icon}</span>
            <span class="codex-cat-label">${cat}</span>
            <span class="codex-cat-count">${unlockedCount}/${entries.length}</span>
        </div>`;

        for (const entry of entries) {
            const unlocked = _isUnlocked(entry);
            const activeClass = entry.id === _selectedId ? ' active' : '';
            const lockedClass = unlocked ? '' : ' locked';

            html += `<button class="codex-entry-btn${activeClass}${lockedClass}" data-codex-id="${entry.id}" style="color:${cfg.color}">
                <span class="codex-entry-dot" style="background:${cfg.color}"></span>
                ${unlocked ? entry.title : '???'}
            </button>`;
        }
        html += `</div>`;
    }

    sidebar.innerHTML = html;

    sidebar.querySelectorAll('.codex-entry-btn:not(.locked)').forEach(btn => {
        btn.addEventListener('click', () => {
            _selectedId = btn.dataset.codexId;
            _renderSidebar();
            _renderContent();
        });
    });
}

function _renderContent() {
    const content = document.getElementById('codex-content');
    if (!content || !_selectedId) return;

    const entry = CODEX_ENTRIES.find(e => e.id === _selectedId);
    if (!entry || !_isUnlocked(entry)) {
        content.innerHTML = `<div class="codex-empty">Select an entry to read</div>`;
        return;
    }

    const cfg = CAT_CONFIG[entry.category] || { color: 'var(--color-primary)', icon: '' };

    // Convert newlines to paragraphs
    const paragraphs = entry.body.split('\n\n').filter(p => p.trim());
    const bodyHtml = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');

    content.innerHTML = `
        <div class="codex-article-fade" style="color:${cfg.color}">
            <div class="codex-article-header">
                <div class="codex-article-icon" style="border-color:${cfg.color}; color:${cfg.color}">
                    ${cfg.icon}
                </div>
                <div class="codex-article-meta">
                    <div class="codex-article-cat" style="color:${cfg.color}">${entry.category}</div>
                    <div class="codex-article-title">${entry.title}</div>
                </div>
            </div>
            <div class="codex-article-divider"></div>
            <div class="codex-article-body">${bodyHtml}</div>
        </div>
    `;
}

/* ── Init ───────────────────────────────────────────────────────────────── */
export function initCodexUI() {
    const btn = document.getElementById('btn-codex');
    const panel = document.getElementById('codex-panel');
    const closeBtn = document.getElementById('btn-close-codex');

    if (btn) btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            _renderSidebar();
            _renderContent();
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    // Unlock game-start entries on game start
    events.addEventListener('game-start', () => {
        for (const entry of CODEX_ENTRIES) {
            if (entry.unlockCondition === 'game-start' && !_isUnlocked(entry)) {
                gameState.codex.unlocked.push(entry.id);
            }
        }
    });

    // Also unlock game-start entries on game load
    events.addEventListener('game-load', () => {
        for (const entry of CODEX_ENTRIES) {
            if (entry.unlockCondition === 'game-start' && !_isUnlocked(entry)) {
                gameState.codex.unlocked.push(entry.id);
            }
        }
    });

    // Research-triggered unlocks
    events.addEventListener('research-complete', (e) => {
        _tryUnlock('research', e.detail.techId);
    });

    // Event-triggered unlocks (random events + chain events)
    events.addEventListener('random-event', (e) => {
        const evt = e.detail.event;
        if (evt && evt.id) {
            _tryUnlock('event', evt.id);
        }
    });

    // Milestone-triggered unlocks
    events.addEventListener('milestone-event', (e) => {
        const evt = e.detail.event;
        if (evt && evt.id) {
            _tryUnlock('milestone', evt.id);
        }
    });
}
