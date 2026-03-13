/**
 * Floating game notifications / toasts.
 */

const ICONS = {
    info: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><line x1="10" y1="9" x2="10" y2="14"/><circle cx="10" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,
    alert: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 2 L18.66 17 H1.34 Z"/><line x1="10" y1="8" x2="10" y2="12"/><circle cx="10" cy="14.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,
    success: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><polyline points="6,10 9,13 14,7"/></svg>`,
};

const TITLES = { info: 'System Update', alert: 'Alert', success: 'Complete' };
const DURATION = 5000;

export function showNotification(text, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `notif notif--${type}`;

    el.innerHTML =
        `<div class="notif-icon">${ICONS[type] || ICONS.info}</div>` +
        `<div class="notif-body">` +
            `<div class="notif-title">${TITLES[type] || TITLES.info}</div>` +
            `<div class="notif-text">${text}</div>` +
        `</div>` +
        `<button class="notif-close" aria-label="Dismiss">&times;</button>` +
        `<div class="notif-timer"><div class="notif-timer-bar"></div></div>`;

    // Dismiss on close click
    el.querySelector('.notif-close').onclick = () => _dismiss(el);

    container.appendChild(el);

    // Cap visible toasts — remove oldest when > 4
    const all = container.querySelectorAll('.notif');
    if (all.length > 4) _dismiss(all[0]);

    // Auto-dismiss
    const tid = setTimeout(() => _dismiss(el), DURATION);
    el._tid = tid;
}

function _dismiss(el) {
    if (el._dismissed) return;
    el._dismissed = true;
    clearTimeout(el._tid);
    el.classList.add('notif--out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Fallback in case animationend doesn't fire
    setTimeout(() => { if (el.parentNode) el.remove(); }, 600);
}
