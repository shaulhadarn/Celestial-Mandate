/**
 * Random game events that trigger periodically.
 * Each event has text, choices with effects applied to gameState.
 */
export const RANDOM_EVENTS = [
    {
        id: 'mineral_vein',
        title: 'Rich Mineral Vein Discovered',
        desc: 'Geological surveys have uncovered a massive mineral deposit within our territory.',
        choices: [
            { label: 'Extract immediately', effect: { minerals: 200 } },
            { label: 'Careful extraction', effect: { minerals: 100, energy: 50 } },
        ]
    },
    {
        id: 'solar_flare',
        title: 'Solar Flare Activity',
        desc: 'A series of intense solar flares threatens our energy grid. Our engineers can attempt to harness the extra radiation or shield our infrastructure.',
        choices: [
            { label: 'Harness the energy', effect: { energy: 150, minerals: -30 } },
            { label: 'Shield infrastructure', effect: { energy: -50 } },
        ]
    },
    {
        id: 'alien_artifact',
        title: 'Alien Artifact Found',
        desc: 'An exploration team has discovered a mysterious artifact of unknown origin. It pulses with strange energy.',
        choices: [
            { label: 'Study it', effect: { energy: 80, food: 40 } },
            { label: 'Sell to traders', effect: { minerals: 150 } },
        ]
    },
    {
        id: 'food_surplus',
        title: 'Bountiful Harvest',
        desc: 'Favorable conditions have resulted in an exceptional agricultural yield across our colonies.',
        choices: [
            { label: 'Distribute freely', effect: { food: 250 } },
            { label: 'Trade surplus', effect: { food: 100, minerals: 80 } },
        ]
    },
    {
        id: 'pirate_raid',
        title: 'Pirate Raid',
        desc: 'A band of space pirates has been spotted near our trade routes. They demand tribute or threaten to attack.',
        choices: [
            { label: 'Pay tribute', effect: { minerals: -80, energy: -40 } },
            { label: 'Fight them off', effect: { energy: -60 } },
        ]
    },
    {
        id: 'refugee_fleet',
        title: 'Refugee Fleet Arrives',
        desc: 'A fleet of refugees from a destroyed civilization seeks asylum in our territory.',
        choices: [
            { label: 'Welcome them', effect: { food: -100, minerals: 60, energy: 40 } },
            { label: 'Turn them away', effect: {} },
        ]
    },
    {
        id: 'tech_breakthrough',
        title: 'Scientific Breakthrough',
        desc: 'Our research teams have made an unexpected breakthrough in energy conversion technology.',
        choices: [
            { label: 'Apply to energy grid', effect: { energy: 200 } },
            { label: 'Publish findings', effect: { energy: 60, minerals: 60, food: 60 } },
        ]
    },
    {
        id: 'asteroid_impact',
        title: 'Asteroid Detected',
        desc: 'A rogue asteroid is on a collision course with one of our colony worlds. We must act fast.',
        choices: [
            { label: 'Deflect it', effect: { energy: -100 } },
            { label: 'Mine it', effect: { minerals: 180, energy: -50 } },
        ]
    },
    {
        id: 'trade_caravan',
        title: 'Trade Caravan',
        desc: 'An interstellar trade caravan offers to exchange goods with our empire.',
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
        choices: [
            { label: 'Investigate', effect: { energy: 120, minerals: 30 } },
            { label: 'Ignore it', effect: {} },
        ]
    },
];
