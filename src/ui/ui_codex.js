import { gameState, events } from '../core/state.js';
import { CODEX_ENTRIES, CODEX_CATEGORIES } from '../core/codex_data.js';
import { showNotification } from './ui_notifications.js';

let _selectedId = null;

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
        const entries = CODEX_ENTRIES.filter(e => e.category === cat);
        const unlockedCount = entries.filter(e => _isUnlocked(e)).length;

        html += `<div class="codex-cat-group">`;
        html += `<div class="codex-cat-header">
            <span>${cat}</span>
            <span class="codex-cat-count">${unlockedCount}/${entries.length}</span>
        </div>`;

        for (const entry of entries) {
            const unlocked = _isUnlocked(entry);
            const activeClass = entry.id === _selectedId ? ' active' : '';
            const lockedClass = unlocked ? '' : ' locked';

            html += `<button class="codex-entry-btn${activeClass}${lockedClass}" data-codex-id="${entry.id}">
                ${unlocked ? entry.title : '???'}
            </button>`;
        }
        html += `</div>`;
    }

    sidebar.innerHTML = html;

    // Attach click handlers
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

    // Convert newlines to paragraphs
    const paragraphs = entry.body.split('\n\n').filter(p => p.trim());
    const bodyHtml = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');

    content.innerHTML = `
        <div class="codex-article-cat">${entry.category}</div>
        <div class="codex-article-title">${entry.title}</div>
        <div class="codex-article-divider"></div>
        <div class="codex-article-body">${bodyHtml}</div>
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
