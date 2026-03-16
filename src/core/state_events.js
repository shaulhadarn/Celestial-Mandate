/* Random event and event chain tick logic */
import { gameState, events } from './state.js';
import { RANDOM_EVENTS, EVENT_CHAINS } from './events_data.js';
import { RACE_SHIPS } from './ships_data.js';

let _eventTicks = 0;

/* ── Chain helper: find a step by ID within a chain ─────────────────────── */
function _findChainStep(chainId, stepId) {
    const chain = EVENT_CHAINS[chainId];
    if (!chain) return null;
    return chain.steps.find(s => s.id === stepId) || null;
}

export function tickRandomEvents() {
    _eventTicks++;

    // ── Tick active event chains ───────────────────────────────────────────
    const chains = gameState.eventChains;
    for (let i = chains.active.length - 1; i >= 0; i--) {
        const entry = chains.active[i];
        entry.ticksRemaining--;
        if (entry.ticksRemaining <= 0) {
            const step = _findChainStep(entry.chainId, entry.nextStepId);
            if (step) {
                const chain = EVENT_CHAINS[entry.chainId];
                const stepIdx = chain.steps.indexOf(step);
                events.dispatchEvent(new CustomEvent('random-event', {
                    detail: {
                        event: step,
                        chainId: entry.chainId,
                        chainTitle: chain.title,
                        stepNum: stepIdx + 1,
                        totalSteps: chain.steps.length
                    }
                }));
            }
            chains.active.splice(i, 1);
        }
    }

    // ── Standalone random events (including chain starters) ────────────────
    const threshold = 90 + Math.floor(Math.random() * 90);
    if (_eventTicks >= threshold) {
        _eventTicks = 0;

        // Chance to start a chain (20%) if any are available
        const availableChains = Object.values(EVENT_CHAINS).filter(c =>
            !chains.completed.includes(c.id) &&
            !chains.active.some(a => a.chainId === c.id) &&
            (!c.condition || c.condition(gameState))
        );

        if (availableChains.length > 0 && Math.random() < 0.2) {
            const chain = availableChains[Math.floor(Math.random() * availableChains.length)];
            const firstStep = chain.steps[0];
            events.dispatchEvent(new CustomEvent('random-event', {
                detail: {
                    event: firstStep,
                    chainId: chain.id,
                    chainTitle: chain.title,
                    stepNum: 1,
                    totalSteps: chain.steps.length
                }
            }));
        } else {
            const eligible = RANDOM_EVENTS.filter(e => !e.condition || e.condition(gameState));
            if (eligible.length === 0) return;
            const evt = eligible[Math.floor(Math.random() * eligible.length)];
            events.dispatchEvent(new CustomEvent('random-event', { detail: { event: evt } }));
        }
    }
}

export function scheduleChainStep(chainId, nextStepId, delay) {
    if (!nextStepId) {
        // Chain ends — mark completed
        if (!gameState.eventChains.completed.includes(chainId)) {
            gameState.eventChains.completed.push(chainId);
        }
        return;
    }
    const [min, max] = delay;
    const ticks = min + Math.floor(Math.random() * (max - min));
    gameState.eventChains.active.push({ chainId, nextStepId, ticksRemaining: ticks });
}

export function applyEventChoice(effect) {
    if (effect.energy) gameState.resources.energy += effect.energy;
    if (effect.minerals) gameState.resources.minerals += effect.minerals;
    if (effect.food) gameState.resources.food += effect.food;
    if (gameState.resources.energy < 0) gameState.resources.energy = 0;
    if (gameState.resources.minerals < 0) gameState.resources.minerals = 0;
    if (gameState.resources.food < 0) gameState.resources.food = 0;

    // Bonus: spawn a ship in home system
    if (effect.fleet) {
        const race = gameState.playerCivilization?.bodyType || 'humanoid';
        const ships = RACE_SHIPS[race] || [];
        const classIdx = { scout: 0, corvette: 1, cruiser: 2 }[effect.fleet] ?? 0;
        const shipDef = ships[classIdx] || ships[0];
        if (shipDef) {
            const fleet = {
                id: Date.now() + Math.random(),
                shipId: shipDef.id,
                name: shipDef.name,
                icon: shipDef.icon,
                power: shipDef.power,
                systemId: 0,
                planetId: null,
            };
            if (!gameState.fleets) gameState.fleets = [];
            gameState.fleets.push(fleet);
            events.dispatchEvent(new CustomEvent('ship-built', { detail: { fleet } }));
        }
    }

    // Bonus: add population to a random colony
    if (effect.population) {
        const colIds = Object.keys(gameState.colonies);
        if (colIds.length > 0) {
            const target = colIds[Math.floor(Math.random() * colIds.length)];
            gameState.colonies[target].population += effect.population;
        }
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
}
