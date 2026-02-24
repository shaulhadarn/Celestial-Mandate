/* Updated: Delay game-start event until fade-out animation completes for smooth transition to race intro */
import { events } from '../core/state.js';
import { state, TOTAL_STEPS, validateStep, validateCiv } from './ui_creation_state.js';
import { renderSpeciesStep } from './ui_creation_species.js';
import { renderHomeworldStep } from './ui_creation_homeworld.js';
import { renderTraitsStep } from './ui_creation_homeworld.js';
import { renderArchetypeStep, renderCivicsStep } from './ui_creation_society.js';
import { renderSummaryStep } from './ui_creation_summary.js';

// Persistent references — created once, never re-rendered
let _container = null;
let _stepView = null;
let _backBtn = null;
let _nextBtn = null;
let _dots = [];

export function initCreationUI() {
    _container = document.getElementById('creation-screen');
    if (!_container) return;

    buildShell(_container);
    renderStepContent();
}

/**
 * Build the permanent shell once: indicator + scrollable content area + footer.
 * Only called on first init.
 */
function buildShell(container) {
    const content = container.querySelector('.creation-content');
    content.innerHTML = '';

    const stepContainer = document.createElement('div');
    stepContainer.className = 'step-container';

    // ── Step indicator (permanent) ───────────────────────────────────────────
    const indicatorEl = document.createElement('div');
    indicatorEl.className = 'step-indicator-container';
    _dots = Array(TOTAL_STEPS).fill(0).map((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'step-dot';
        indicatorEl.appendChild(dot);
        return dot;
    });
    stepContainer.appendChild(indicatorEl);

    // ── Scrollable content area (only this animates) ─────────────────────────
    _stepView = document.createElement('div');
    _stepView.className = 'step-view';
    stepContainer.appendChild(_stepView);

    // ── Footer navigation (permanent) ────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'step-footer';

    _backBtn = document.createElement('button');
    _backBtn.className = 'nav-btn';
    _backBtn.innerText = 'Back';
    _backBtn.onclick = () => {
        if (state.currentStep > 0) {
            state.currentStep--;
            renderStepContent();
        }
    };

    _nextBtn = document.createElement('button');
    _nextBtn.className = 'nav-btn';
    _nextBtn.style.borderColor = 'var(--color-primary)';
    _nextBtn.onclick = () => handleNext(container);

    footer.appendChild(_backBtn);
    footer.appendChild(_nextBtn);
    stepContainer.appendChild(footer);

    content.appendChild(stepContainer);
}

/**
 * Re-render only the step-view content and update indicator + footer state.
 * Applies a CSS animation class so only the content slides/fades in.
 */
function renderStepContent() {
    // Update dots
    _dots.forEach((dot, i) => {
        dot.className = 'step-dot' +
            (i === state.currentStep ? ' active' : '') +
            (i < state.currentStep ? ' completed' : '');
    });

    // Update back button
    _backBtn.disabled = state.currentStep === 0;
    _backBtn.style.opacity = state.currentStep === 0 ? '0' : '1';
    _backBtn.style.pointerEvents = state.currentStep === 0 ? 'none' : 'auto';

    // Update next/finish button
    if (state.currentStep === TOTAL_STEPS - 1) {
        _nextBtn.innerText = 'Establish Empire';
        _nextBtn.classList.add('huge-btn');
    } else {
        _nextBtn.innerText = 'Next Step';
        _nextBtn.classList.remove('huge-btn');
    }

    // Animate only the content area
    _stepView.classList.remove('step-content-enter');
    // Force reflow so removing + re-adding the class triggers the animation
    void _stepView.offsetWidth;
    _stepView.innerHTML = '';

    switch (state.currentStep) {
        case 0: renderSpeciesStep(_stepView);    break;
        case 1: renderHomeworldStep(_stepView);  break;
        case 2: renderTraitsStep(_stepView);     break;
        case 3: renderArchetypeStep(_stepView);  break;
        case 4: renderCivicsStep(_stepView);     break;
        case 5: renderSummaryStep(_stepView);    break;
    }

    _stepView.classList.add('step-content-enter');
    _stepView.scrollTop = 0;
}

function handleNext(container) {
    if (state.currentStep === TOTAL_STEPS - 1) {
        if (validateCiv()) {
            container.classList.add('fade-out');
            setTimeout(() => {
                container.classList.add('hidden');
                events.dispatchEvent(new CustomEvent('game-start', { detail: state.currentCiv }));
            }, 1000);
        }
    } else {
        if (validateStep(state.currentStep)) {
            state.currentStep++;
            renderStepContent();
        }
    }
}

