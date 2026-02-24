/**
 * Milestone events — one-time story moments triggered by game progress.
 * Each milestone listens to a specific game event, checks a condition against
 * gameState, and fires exactly once via a 'milestone-event' CustomEvent.
 */

import { gameState, events } from '../core/state.js';

/* ── SVG icon paths (viewBox 0 0 24 24) ───────────────────────────────────── */
const ICONS = {
    colony: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3c-3 4-5 6-5 9a5 5 0 0010 0c0-3-2-5-5-9z" fill="currentColor" opacity="0.25"/><circle cx="12" cy="14" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/><line x1="12" y1="3" x2="12" y2="8" stroke="currentColor" stroke-width="1" opacity="0.5"/>`,
    research: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4" transform="rotate(0 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4" transform="rotate(120 12 12)"/>`,
    fleet: `<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2" fill="currentColor" opacity="0.4"/>`,
    survey: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="0.8" opacity="0.3"/><path d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" stroke="currentColor" stroke-width="0.8" opacity="0.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.6"/><circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.5"/>`,
    transcend: `<polygon points="12,1 15,9 23,9 17,14 19,22 12,17 5,22 7,14 1,9 9,9" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.35"/><line x1="12" y1="1" x2="12" y2="6" stroke="currentColor" stroke-width="1" opacity="0.5"/>`,
    industry: `<rect x="3" y="10" width="5" height="10" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="6" width="5" height="14" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="3" width="5" height="17" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="21" x2="23" y2="21" stroke="currentColor" stroke-width="1" opacity="0.4"/>`,
    population: `<circle cx="8" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 20c0-4 3-7 6-7h8c3 0 6 3 6 7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.4"/>`,
    armada: `<path d="M12 2l2 5h5l-4 3 1.5 5L12 12l-4.5 3L9 10l-4-3h5z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 17l-2 3h3zM18 17l2 3h-3z" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/><path d="M10 17l-1 4h6l-1-4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/><circle cx="12" cy="7" r="1.5" fill="currentColor" opacity="0.5"/>`,
};

/* ── Milestone Definitions ─────────────────────────────────────────────────── */
export const MILESTONE_EVENTS = [
    {
        id: 'first_colony',
        trigger: 'colony-founded',
        condition: () => Object.keys(gameState.colonies).length >= 2,
        title: 'A New Horizon',
        desc: 'The colony ship descends through alien skies, its hull glowing white-hot against an atmosphere never before touched by your kind. Below, a world of unknown promise awaits — its mountains, seas, and continents soon to bear the names of pioneers brave enough to leave everything behind. This is the moment your species ceases to be the children of one world and becomes citizens of the stars. History will remember this day as the first true step of an interstellar civilization, the day the cradle was finally, irrevocably left behind.',
        category: 'expansion',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.colony}</svg>`,
    },
    {
        id: 'five_colonies',
        trigger: 'colony-founded',
        condition: () => Object.keys(gameState.colonies).length >= 6,
        title: 'The Five Pillars',
        desc: 'Five worlds now orbit under your banner, each one a beating heart of industry, culture, and ambition. Trade routes thread between them like the arteries of a great body, carrying minerals, knowledge, and the ceaseless flow of your people. What began as a fragile outpost on a single alien shore has become something undeniable — an empire. Diplomats speak your name with respect; rivals speak it with unease. The five pillars of your dominion stand tall, and the galaxy watches to see how high you will build.',
        category: 'expansion',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.colony}</svg>`,
    },
    {
        id: 'first_research',
        trigger: 'research-complete',
        condition: () => gameState.research.completedTechs.length >= 1,
        title: 'First Light of Knowledge',
        desc: 'In the quiet hum of a research lab orbiting a distant star, a team of scientists stares at their instruments in disbelief. The data is unmistakable — a fundamental law of the universe has yielded its secret to your civilization. This first breakthrough is more than a technological achievement; it is a declaration that your species will not be content merely to survive among the stars. You will understand them. The torch of knowledge has been lit, and its light will push back the darkness of an infinite frontier.',
        category: 'discovery',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.research}</svg>`,
    },
    {
        id: 'first_fleet_move',
        trigger: 'fleet-arrived',
        condition: () => true,
        title: 'The Vanguard Departs',
        desc: 'The fleet breaks orbit for the first time, engines blazing against the velvet dark. Behind lies the safety of known space — ahead, the vast and terrible unknown. Every soul aboard understands the weight of this moment: they are the first of your kind to cross the gulf between stars under their own power, navigating the ancient hyperlanes that bind the galaxy together. The void is no longer an obstacle. It is a road, and your ships now travel it. Whatever waits at the other end, your people will face it together.',
        category: 'exploration',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.fleet}</svg>`,
    },
    {
        id: 'first_ship',
        trigger: 'ship-built',
        condition: () => gameState.fleets.length >= 1,
        title: 'Arsenal of the Stars',
        desc: 'The shipyard doors open and the first warship glides into the void, its hull still gleaming with the polish of a newly forged blade. Crew members line the observation decks of the orbital station, watching in reverent silence as the vessel clears the docking clamps and powers up its drives. This is no mere machine — it is the embodiment of your civilization\'s will to defend what it has built and to reach for what it has not. The stars have always been beautiful. Now, they are also yours to protect.',
        category: 'military',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.fleet}</svg>`,
    },
    {
        id: 'first_survey',
        trigger: 'system-surveyed',
        condition: () => true,
        title: 'Charting the Unknown',
        desc: 'The sensor arrays sweep across an alien star system for the first time, cataloguing worlds no eye of your kind has ever seen. Gas giants swirl in bands of crimson and gold; rocky moons hide secrets beneath crusts of ancient ice. Every data point is a revelation, every reading a verse in the grand poem of the cosmos. Your civilization has taken its first step from inhabitant to explorer, from survivor to cartographer of infinity. The map of the galaxy has its first mark — and there are billions more to make.',
        category: 'exploration',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.survey}</svg>`,
    },
    {
        id: 'transcendence_achieved',
        trigger: 'research-complete',
        condition: (detail) => detail.techId === 'transcendence',
        title: 'The Transcendence',
        desc: 'It begins as a whisper in the neural networks — a frequency beyond hearing, beyond thought, beyond the very concept of self. Then the barriers fall. Across every world, every ship, every mind in your civilization, the walls between consciousness dissolve like frost in starlight. Your species ascends, shedding the cage of flesh and physics to become something the universe has never seen. You are no longer a civilization. You are an idea, vast and luminous, woven into the fabric of spacetime itself. The stars do not shine upon you. You shine with them.',
        category: 'discovery',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.transcend}</svg>`,
    },
    {
        id: 'industrial_might',
        trigger: 'building-complete',
        condition: () => {
            let total = 0;
            for (const col of Object.values(gameState.colonies)) {
                total += col.buildings.length;
            }
            return total >= 10;
        },
        title: 'Industrial Might',
        desc: 'The forge-worlds glow with purpose. Across your empire, mining networks claw precious ore from planetary mantles, power plants harness the fury of captive suns, and research complexes push the boundaries of known science. The hum of ten great works reverberates through the void — a symphony of industry that echoes from core worlds to frontier outposts. Your enemies see the smoke rising from your forge-worlds and know what it means: the machine of empire has reached full power, and it will not be stopped.',
        category: 'economy',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.industry}</svg>`,
    },
    {
        id: 'population_boom',
        trigger: 'pop-growth',
        condition: () => {
            let total = 0;
            for (const col of Object.values(gameState.colonies)) {
                total += col.population;
            }
            return total >= 10;
        },
        title: 'Growing Pains',
        desc: 'The census reports arrive from every colony world, and the numbers tell a story of explosive growth. Nurseries overflow, habitation domes strain at their seams, and the endless hunger for food, energy, and space grows louder with every passing cycle. Ten billion voices now cry out across your empire — demanding, dreaming, daring. This tide of life is both your greatest strength and your most pressing challenge. Feed them, house them, and give them purpose, and there is nothing in the galaxy that can stand against such multitudes.',
        category: 'expansion',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.population}</svg>`,
    },
    {
        id: 'armada',
        trigger: 'ship-built',
        condition: () => gameState.fleets.length >= 5,
        title: 'Armada',
        desc: 'Five warships hang in formation above the orbital shipyard, their running lights blinking in silent unison against the backdrop of a billion stars. Together they represent more concentrated firepower than most civilizations will ever possess — a fleet capable of projecting your will across entire star systems. Admirals stand on command bridges and feel the thrum of engines beneath their feet, knowing that this armada is more than metal and fire. It is a statement, written in the language every species in the galaxy understands: we are here, we are powerful, and we will not be moved.',
        category: 'military',
        icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS.armada}</svg>`,
    },
];

/* ── Initialization ────────────────────────────────────────────────────────── */

/**
 * Registers listeners on the global event bus for every milestone.
 * Each milestone fires at most once per game; already-fired milestones
 * (tracked in gameState.milestonesFired) are skipped.
 */
export function initMilestoneEvents() {
    // Ensure the tracking array exists on gameState
    if (!gameState.milestonesFired) {
        gameState.milestonesFired = [];
    }

    for (const milestone of MILESTONE_EVENTS) {
        events.addEventListener(milestone.trigger, (e) => {
            // Skip if already fired
            if (gameState.milestonesFired.includes(milestone.id)) return;

            // Evaluate condition — pass event detail for milestones that inspect it
            const met = milestone.condition(e.detail);
            if (!met) return;

            // Mark as fired
            gameState.milestonesFired.push(milestone.id);

            // Dispatch milestone event for the UI layer to display
            events.dispatchEvent(new CustomEvent('milestone-event', {
                detail: {
                    event: {
                        id: milestone.id,
                        title: milestone.title,
                        desc: milestone.desc,
                        category: milestone.category,
                        icon: milestone.icon,
                    }
                },
            }));
        });
    }
}
