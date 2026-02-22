/* Updated: Organized app hierarchy, moved to src/ui folder, fixed imports and paths */
import { BODY_TYPES, HOMEWORLD_TYPES, ARCHETYPES, ETHICS_AXES } from '../core/civilization_data.js';

export const TOTAL_STEPS = 6;

export const state = {
    currentStep: 0,
    currentCiv: {
        name: "New Empire",
        bodyType: BODY_TYPES[0].id,
        homeworld: HOMEWORLD_TYPES[0].id,
        traits: [],
        archetype: ARCHETYPES[0].id,
        ethics: {},
        civics: []
    }
};

// Initialize Ethics
ETHICS_AXES.forEach(axis => state.currentCiv.ethics[axis.id] = 0);

export function validateStep(step) {
    if (step === 0) {
        if (!state.currentCiv.name.trim()) {
            alert("Please name your empire.");
            return false;
        }
    }
    return true;
}

export function validateCiv() {
    return validateStep(0);
}