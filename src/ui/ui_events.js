import { events, applyEventChoice } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

let _modal = null;

function _ensureModal() {
    if (_modal) return _modal;
    _modal = document.createElement('div');
    _modal.id = 'event-modal';
    _modal.className = 'event-modal hidden';
    _modal.innerHTML = `
        <div class="event-modal-box">
            <div class="event-modal-header">
                <span class="event-modal-title"></span>
            </div>
            <div class="event-modal-desc"></div>
            <div class="event-modal-choices"></div>
        </div>
    `;
    document.body.appendChild(_modal);

    // Click outside to dismiss (pick no effect)
    _modal.addEventListener('click', (e) => {
        if (e.target === _modal) _modal.classList.add('hidden');
    });

    return _modal;
}

function _showEvent(evt) {
    const modal = _ensureModal();
    modal.querySelector('.event-modal-title').textContent = evt.title;
    modal.querySelector('.event-modal-desc').textContent = evt.desc;

    const choicesEl = modal.querySelector('.event-modal-choices');
    choicesEl.innerHTML = '';
    evt.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'event-choice-btn';

        const effectParts = [];
        if (choice.effect.energy) effectParts.push(`${choice.effect.energy > 0 ? '+' : ''}${choice.effect.energy} Energy`);
        if (choice.effect.minerals) effectParts.push(`${choice.effect.minerals > 0 ? '+' : ''}${choice.effect.minerals} Minerals`);
        if (choice.effect.food) effectParts.push(`${choice.effect.food > 0 ? '+' : ''}${choice.effect.food} Food`);

        btn.innerHTML = `
            <span class="event-choice-label">${choice.label}</span>
            ${effectParts.length > 0 ? `<span class="event-choice-effect">${effectParts.join(', ')}</span>` : ''}
        `;
        btn.addEventListener('click', () => {
            applyEventChoice(choice.effect);
            modal.classList.add('hidden');
            showNotification(`${evt.title}: ${choice.label}`, 'info');
        });
        choicesEl.appendChild(btn);
    });

    modal.classList.remove('hidden');
}

export function initEventsUI() {
    events.addEventListener('random-event', (e) => {
        _showEvent(e.detail.event);
    });
}
