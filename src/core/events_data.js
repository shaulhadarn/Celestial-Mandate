/**
 * Random game events that trigger periodically.
 * Each event has text, choices with effects applied to gameState.
 * Icons are inline SVG path data for each event category.
 */

/* ── SVG icon paths (viewBox 0 0 24 24) ─────────────────────────────────── */
const ICONS = {
    mining: `<path d="M12 2L2 19h20L12 2zm0 4l6.5 11h-13L12 6z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="14" r="2" fill="currentColor" opacity="0.6"/><line x1="12" y1="6" x2="12" y2="11" stroke="currentColor" stroke-width="1" opacity="0.4"/>`,
    solar: `<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.6"/><g stroke="currentColor" stroke-width="1" opacity="0.5"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7.8" y2="7.8"/><line x1="16.2" y1="16.2" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7.8" y2="16.2"/><line x1="16.2" y1="7.8" x2="19.1" y2="4.9"/></g>`,
    alien: `<ellipse cx="12" cy="10" rx="7" ry="8" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="9" cy="9" rx="2" ry="1.2" fill="currentColor" opacity="0.5"/><ellipse cx="15" cy="9" rx="2" ry="1.2" fill="currentColor" opacity="0.5"/><path d="M9 14c1.5 1.5 4.5 1.5 6 0" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/>`,
    food: `<path d="M12 2C8 2 4 6 4 10c0 3 2 5 4 6v4h8v-4c2-1 4-3 4-6 0-4-4-8-8-8z" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" stroke-width="1" opacity="0.4"/><circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.5"/>`,
    combat: `<path d="M12 2l2.5 7H22l-6 4.5 2.3 7L12 16l-6.3 4.5 2.3-7L2 9h7.5z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="11" r="2" fill="currentColor" opacity="0.4"/>`,
    diplomacy: `<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 18c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>`,
    science: `<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4" transform="rotate(0 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4" transform="rotate(120 12 12)"/>`,
    asteroid: `<path d="M14 3l-1 4 3 1-2 3 4 2-3 2 1 4-4-1-1 3-3-3-4 1 1-4-3-2 3-2-1-4 4 1z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="11" r="2" fill="currentColor" opacity="0.4"/>`,
    trade: `<rect x="3" y="7" width="7" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="7" width="7" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 10h4m-4 3h4" stroke="currentColor" stroke-width="1.2" opacity="0.5"/><path d="M10 14l2 2 2-2M14 10l-2-2-2 2" stroke="currentColor" stroke-width="1" opacity="0.35"/>`,
    anomaly: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v4m0 4v2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
};

export const RANDOM_EVENTS = [
    {
        id: 'mineral_vein',
        title: 'Rich Mineral Vein Discovered',
        desc: 'Geological surveys have uncovered a massive mineral deposit within our territory.',
        category: 'opportunity',
        icon: ICONS.mining,
        choices: [
            { label: 'Extract immediately', effect: { minerals: 200 } },
            { label: 'Careful extraction', effect: { minerals: 100, energy: 50 } },
        ]
    },
    {
        id: 'solar_flare',
        title: 'Solar Flare Activity',
        desc: 'A series of intense solar flares threatens our energy grid. Our engineers can attempt to harness the extra radiation or shield our infrastructure.',
        category: 'danger',
        icon: ICONS.solar,
        choices: [
            { label: 'Harness the energy', effect: { energy: 150, minerals: -30 } },
            { label: 'Shield infrastructure', effect: { energy: -50 } },
        ]
    },
    {
        id: 'alien_artifact',
        title: 'Alien Artifact Found',
        desc: 'An exploration team has discovered a mysterious artifact of unknown origin. It pulses with strange energy.',
        category: 'discovery',
        icon: ICONS.alien,
        choices: [
            { label: 'Study it', effect: { energy: 80, food: 40 } },
            { label: 'Sell to traders', effect: { minerals: 150 } },
        ]
    },
    {
        id: 'food_surplus',
        title: 'Bountiful Harvest',
        desc: 'Favorable conditions have resulted in an exceptional agricultural yield across our colonies.',
        category: 'opportunity',
        icon: ICONS.food,
        choices: [
            { label: 'Distribute freely', effect: { food: 250 } },
            { label: 'Trade surplus', effect: { food: 100, minerals: 80 } },
        ]
    },
    {
        id: 'pirate_raid',
        title: 'Pirate Raid',
        desc: 'A band of space pirates has been spotted near our trade routes. They demand tribute or threaten to attack.',
        category: 'danger',
        icon: ICONS.combat,
        choices: [
            { label: 'Pay tribute', effect: { minerals: -80, energy: -40 } },
            { label: 'Fight them off', effect: { energy: -60 } },
        ]
    },
    {
        id: 'refugee_fleet',
        title: 'Refugee Fleet Arrives',
        desc: 'A fleet of refugees from a destroyed civilization seeks asylum in our territory.',
        category: 'diplomacy',
        icon: ICONS.diplomacy,
        choices: [
            { label: 'Welcome them', effect: { food: -100, minerals: 60, energy: 40 } },
            { label: 'Turn them away', effect: {} },
        ]
    },
    {
        id: 'tech_breakthrough',
        title: 'Scientific Breakthrough',
        desc: 'Our research teams have made an unexpected breakthrough in energy conversion technology.',
        category: 'discovery',
        icon: ICONS.science,
        choices: [
            { label: 'Apply to energy grid', effect: { energy: 200 } },
            { label: 'Publish findings', effect: { energy: 60, minerals: 60, food: 60 } },
        ]
    },
    {
        id: 'asteroid_impact',
        title: 'Asteroid Detected',
        desc: 'A rogue asteroid is on a collision course with one of our colony worlds. We must act fast.',
        category: 'danger',
        icon: ICONS.asteroid,
        choices: [
            { label: 'Deflect it', effect: { energy: -100 } },
            { label: 'Mine it', effect: { minerals: 180, energy: -50 } },
        ]
    },
    {
        id: 'trade_caravan',
        title: 'Trade Caravan',
        desc: 'An interstellar trade caravan offers to exchange goods with our empire.',
        category: 'opportunity',
        icon: ICONS.trade,
        choices: [
            { label: 'Buy minerals', effect: { energy: -80, minerals: 150 } },
            { label: 'Buy food', effect: { energy: -60, food: 180 } },
            { label: 'Decline', effect: {} },
        ]
    },
    {
        id: 'energy_anomaly',
        title: 'Energy Anomaly',
        desc: 'A strange energy signature has been detected emanating from deep space. Analysis suggests it could be harnessed.',
        category: 'discovery',
        icon: ICONS.anomaly,
        choices: [
            { label: 'Investigate', effect: { energy: 120, minerals: 30 } },
            { label: 'Ignore it', effect: {} },
        ]
    },
];
