/* Updated: Organized app hierarchy, moved to src/ui folder, fixed imports and paths */
import { BODY_TYPES } from '../core/civilization_data.js';
import { state } from './ui_creation_state.js';

export function renderSpeciesStep(parent) {
    parent.innerHTML = `
        <div class="creation-header-mini">
            <h2>Step 1: Species & Identity</h2>
            <p>Define the biological form and name of your founding species.</p>
        </div>

        <div class="creation-section">
            <div class="form-group">
                <label>Empire Name</label>
                <input type="text" id="civ-name" value="${state.currentCiv.name}" maxlength="25" placeholder="e.g. The Terran Federation">
            </div>
        </div>

        <div class="creation-section">
            <label style="margin-bottom:15px; display:block; color:#8ba4b3; text-transform:uppercase;">Biological Archetype</label>
            <div class="race-grid" id="opt-body">
                <!-- Populated via JS -->
            </div>
        </div>
    `;

    const nameInput = parent.querySelector('#civ-name');
    nameInput.addEventListener('input', (e) => state.currentCiv.name = e.target.value);

    const bodyContainer = parent.querySelector('#opt-body');
    BODY_TYPES.forEach(type => {
        const card = document.createElement('div');
        card.className = `race-card ${state.currentCiv.bodyType === type.id ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="race-image-container">
                <div class="race-image-loader"></div>
                <img class="race-lazy-image" src="" alt="${type.name}">
            </div>
            <div class="race-info">
                <div class="race-name">${type.name}</div>
                <div class="race-desc">${type.desc}</div>
            </div>
        `;

        const img = card.querySelector('.race-lazy-image');
        const loader = card.querySelector('.race-image-loader');
        
        const tempImg = new Image();
        tempImg.onload = () => {
            img.src = type.img;
            img.classList.add('loaded');
            loader.classList.add('hidden');
        };
        tempImg.src = type.img;
        
        card.addEventListener('click', () => {
            state.currentCiv.bodyType = type.id;
            Array.from(bodyContainer.children).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });

        bodyContainer.appendChild(card);
    });
}