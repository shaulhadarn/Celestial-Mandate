/* Updated: Multiplied all tech costs x4 to make research take significantly longer */

// Each tech: { id, name, icon, desc, cost, tier, requires[], archetype[], bonus, unlocks }
// bonus: object applied to gameState.researchBonuses
// unlocks: building key added to available buildings
// archetype: [] means available to all, otherwise restricted

export const TECH_TREE = [

    // ── TIER 1 (always available, no prerequisites) ──────────────────────────

    {
        id: 'basic_physics',
        name: 'Basic Physics',
        icon: '⚛️',
        desc: 'Foundational understanding of matter and energy. Unlocks Power Relay.',
        cost: 320,
        tier: 1,
        requires: [],
        archetype: [],
        bonus: { energy_income: 2 },
        unlocks: 'power_relay'
    },
    {
        id: 'geology',
        name: 'Planetary Geology',
        icon: '🪨',
        desc: 'Advanced mineral extraction techniques. +3 minerals per colony.',
        cost: 320,
        tier: 1,
        requires: [],
        archetype: [],
        bonus: { minerals_income: 3 },
        unlocks: null
    },
    {
        id: 'agri_science',
        name: 'Agricultural Science',
        icon: '🌾',
        desc: 'Improved crop yields and food synthesis. +3 food per colony.',
        cost: 320,
        tier: 1,
        requires: [],
        archetype: [],
        bonus: { food_income: 3 },
        unlocks: null
    },
    {
        id: 'basic_computing',
        name: 'Basic Computing',
        icon: '💻',
        desc: 'Digital logic systems. Reduces research costs by 10%.',
        cost: 400,
        tier: 1,
        requires: [],
        archetype: [],
        bonus: { research_cost_factor: -0.1 },
        unlocks: null
    },
    {
        id: 'colonial_admin',
        name: 'Colonial Administration',
        icon: '📋',
        desc: 'Efficient colony governance. Unlocks Administrative Center.',
        cost: 400,
        tier: 1,
        requires: [],
        archetype: [],
        bonus: { pop_growth: 0.1 },
        unlocks: 'admin_center'
    },

    // ── TIER 2 ────────────────────────────────────────────────────────────────

    {
        id: 'fusion_power',
        name: 'Fusion Power',
        icon: '☢️',
        desc: 'Clean fusion reactors. +5 energy per colony. Unlocks Fusion Reactor.',
        cost: 720,
        tier: 2,
        requires: ['basic_physics'],
        archetype: [],
        bonus: { energy_income: 5 },
        unlocks: 'fusion_reactor'
    },
    {
        id: 'deep_core_mining',
        name: 'Deep Core Mining',
        icon: '⛏️',
        desc: 'Drill to the planetary core. +6 minerals per colony.',
        cost: 720,
        tier: 2,
        requires: ['geology'],
        archetype: [],
        bonus: { minerals_income: 6 },
        unlocks: 'deep_mine'
    },
    {
        id: 'synthetic_food',
        name: 'Synthetic Food',
        icon: '🧪',
        desc: 'Lab-grown nutrition. +5 food per colony. Unlocks Nutrient Vat.',
        cost: 720,
        tier: 2,
        requires: ['agri_science'],
        archetype: [],
        bonus: { food_income: 5 },
        unlocks: 'nutrient_vat'
    },
    {
        id: 'advanced_computing',
        name: 'Advanced Computing',
        icon: '🖥️',
        desc: 'Quantum processors. Research costs -20% total.',
        cost: 800,
        tier: 2,
        requires: ['basic_computing'],
        archetype: [],
        bonus: { research_cost_factor: -0.1 },
        unlocks: null
    },
    {
        id: 'pop_engineering',
        name: 'Population Engineering',
        icon: '🧬',
        desc: 'Genetic optimization. Pop growth +25%.',
        cost: 800,
        tier: 2,
        requires: ['colonial_admin'],
        archetype: [],
        bonus: { pop_growth: 0.25 },
        unlocks: null
    },

    // ── TIER 3 ────────────────────────────────────────────────────────────────

    {
        id: 'antimatter_power',
        name: 'Antimatter Power',
        icon: '🌟',
        desc: 'Near-limitless energy. +10 energy per colony. Unlocks Antimatter Core.',
        cost: 1400,
        tier: 3,
        requires: ['fusion_power'],
        archetype: [],
        bonus: { energy_income: 10 },
        unlocks: 'antimatter_core'
    },
    {
        id: 'nanite_mining',
        name: 'Nanite Mining',
        icon: '🤖',
        desc: 'Self-replicating nanite extractors. +10 minerals per colony.',
        cost: 1400,
        tier: 3,
        requires: ['deep_core_mining'],
        archetype: [],
        bonus: { minerals_income: 10 },
        unlocks: null
    },
    {
        id: 'food_replication',
        name: 'Food Replication',
        icon: '🍽️',
        desc: 'Matter-to-food conversion. Eliminates food upkeep per pop.',
        cost: 1400,
        tier: 3,
        requires: ['synthetic_food'],
        archetype: [],
        bonus: { food_upkeep_reduction: 0.5 },
        unlocks: null
    },
    {
        id: 'neural_interface',
        name: 'Neural Interface',
        icon: '🧠',
        desc: 'Direct mind-machine link. Unlocks Neural Hub building.',
        cost: 1600,
        tier: 3,
        requires: ['advanced_computing', 'pop_engineering'],
        archetype: [],
        bonus: { research_cost_factor: -0.15 },
        unlocks: 'neural_hub'
    },

    // ── TIER 4 (endgame) ──────────────────────────────────────────────────────

    {
        id: 'zero_point_energy',
        name: 'Zero-Point Energy',
        icon: '✨',
        desc: 'Harvest energy from vacuum fluctuations. +20 energy per colony.',
        cost: 2800,
        tier: 4,
        requires: ['antimatter_power'],
        archetype: [],
        bonus: { energy_income: 20 },
        unlocks: null
    },
    {
        id: 'matter_compression',
        name: 'Matter Compression',
        icon: '🔮',
        desc: 'Compress matter for ultra-dense storage. +15 minerals per colony.',
        cost: 2800,
        tier: 4,
        requires: ['nanite_mining'],
        archetype: [],
        bonus: { minerals_income: 15 },
        unlocks: null
    },
    {
        id: 'transcendence',
        name: 'Transcendence',
        icon: '🌌',
        desc: 'Your species ascends beyond physical limits. All income +15%.',
        cost: 3600,
        tier: 4,
        requires: ['neural_interface', 'zero_point_energy'],
        archetype: [],
        bonus: { global_income_factor: 0.15 },
        unlocks: 'ascension_spire'
    },

    // ── ARCHETYPE-SPECIFIC ────────────────────────────────────────────────────

    // Hive Mind
    {
        id: 'hive_expansion',
        name: 'Hive Expansion Protocol',
        icon: '🕸️',
        desc: 'The swarm grows faster. Pop growth +50%.',
        cost: 600,
        tier: 2,
        requires: ['colonial_admin'],
        archetype: ['hive_mind'],
        bonus: { pop_growth: 0.5 },
        unlocks: null
    },
    {
        id: 'synaptic_relay',
        name: 'Synaptic Relay Network',
        icon: '🧠',
        desc: 'Hive consciousness spans the galaxy. Unlocks Synaptic Relay.',
        cost: 1200,
        tier: 3,
        requires: ['hive_expansion'],
        archetype: ['hive_mind'],
        bonus: { research_cost_factor: -0.2 },
        unlocks: 'synaptic_relay'
    },

    // Machine Intelligence
    {
        id: 'machine_efficiency',
        name: 'Machine Efficiency Protocols',
        icon: '⚙️',
        desc: 'Optimized synthetic processes. Energy upkeep -30%.',
        cost: 600,
        tier: 2,
        requires: ['basic_computing'],
        archetype: ['machine'],
        bonus: { energy_upkeep_reduction: 0.3 },
        unlocks: null
    },
    {
        id: 'self_replication',
        name: 'Self-Replication Matrix',
        icon: '🤖',
        desc: 'Machines build machines. Pop growth +40%. Unlocks Replication Hub.',
        cost: 1200,
        tier: 3,
        requires: ['machine_efficiency'],
        archetype: ['machine'],
        bonus: { pop_growth: 0.4 },
        unlocks: 'replication_hub'
    },

    // Megacorp
    {
        id: 'trade_networks',
        name: 'Interstellar Trade Networks',
        icon: '💹',
        desc: 'Commerce across star systems. Energy income +30%.',
        cost: 600,
        tier: 2,
        requires: ['colonial_admin'],
        archetype: ['megacorp'],
        bonus: { energy_income_factor: 0.3 },
        unlocks: null
    },
    {
        id: 'corporate_espionage',
        name: 'Corporate Espionage Division',
        icon: '🕵️',
        desc: 'Steal tech from rivals. Research cost -25%. Unlocks Black Site.',
        cost: 1200,
        tier: 3,
        requires: ['trade_networks'],
        archetype: ['megacorp'],
        bonus: { research_cost_factor: -0.25 },
        unlocks: 'black_site'
    },

    // Nomadic
    {
        id: 'fleet_logistics',
        name: 'Fleet Logistics',
        icon: '🚀',
        desc: 'Mobile civilization efficiency. All income +10%.',
        cost: 600,
        tier: 2,
        requires: ['basic_physics'],
        archetype: ['nomadic'],
        bonus: { global_income_factor: 0.1 },
        unlocks: null
    },

    // Precursor
    {
        id: 'ancient_archives',
        name: 'Ancient Archives',
        icon: '📜',
        desc: 'Rediscover lost knowledge. Unlocks all Tier 1 techs instantly.',
        cost: 800,
        tier: 2,
        requires: ['basic_computing'],
        archetype: ['precursor'],
        bonus: { research_cost_factor: -0.3 },
        unlocks: null
    }
];

// Buildings unlocked by research (added to BUILDINGS in state.js dynamically)
export const RESEARCH_BUILDINGS = {
    'power_relay': {
        name: "Power Relay",
        cost: { minerals: 120 },
        maintenance: {},
        production: { energy: 6 },
        icon: "🔋",
        buildTime: 5,
        color: 'rgba(255, 220, 0, 0.15)',
        borderColor: '#ffdd00',
        researchRequired: 'basic_physics'
    },
    'admin_center': {
        name: "Administrative Center",
        cost: { minerals: 150 },
        maintenance: { energy: 1 },
        production: {},
        icon: "🏛️",
        buildTime: 6,
        color: 'rgba(0, 242, 255, 0.1)',
        borderColor: '#00f2ff',
        researchRequired: 'colonial_admin',
        bonus: { pop_growth: 0.1 }
    },
    'fusion_reactor': {
        name: "Fusion Reactor",
        cost: { minerals: 250 },
        maintenance: {},
        production: { energy: 12 },
        icon: "☢️",
        buildTime: 10,
        color: 'rgba(255, 100, 0, 0.15)',
        borderColor: '#ff6400',
        researchRequired: 'fusion_power'
    },
    'deep_mine': {
        name: "Deep Core Mine",
        cost: { minerals: 200 },
        maintenance: { energy: 2 },
        production: { minerals: 10 },
        icon: "⛏️",
        buildTime: 8,
        color: 'rgba(180, 120, 50, 0.2)',
        borderColor: '#b47832',
        researchRequired: 'deep_core_mining'
    },
    'nutrient_vat': {
        name: "Nutrient Vat",
        cost: { minerals: 180 },
        maintenance: { energy: 1 },
        production: { food: 10 },
        icon: "🧫",
        buildTime: 7,
        color: 'rgba(50, 200, 100, 0.15)',
        borderColor: '#32c864',
        researchRequired: 'synthetic_food'
    },
    'antimatter_core': {
        name: "Antimatter Core",
        cost: { minerals: 400 },
        maintenance: {},
        production: { energy: 25 },
        icon: "🌟",
        buildTime: 15,
        color: 'rgba(200, 100, 255, 0.2)',
        borderColor: '#c864ff',
        researchRequired: 'antimatter_power'
    },
    'neural_hub': {
        name: "Neural Hub",
        cost: { minerals: 350 },
        maintenance: { energy: 3 },
        production: {},
        icon: "🧠",
        buildTime: 12,
        color: 'rgba(0, 200, 255, 0.2)',
        borderColor: '#00c8ff',
        researchRequired: 'neural_interface'
    },
    'ascension_spire': {
        name: "Ascension Spire",
        cost: { minerals: 800 },
        maintenance: { energy: 5 },
        production: { energy: 30, minerals: 20, food: 20 },
        icon: "🌌",
        buildTime: 25,
        color: 'rgba(255, 255, 100, 0.2)',
        borderColor: '#ffff64',
        researchRequired: 'transcendence'
    },
    'synaptic_relay': {
        name: "Synaptic Relay",
        cost: { minerals: 300 },
        maintenance: { energy: 2 },
        production: {},
        icon: "🕸️",
        buildTime: 10,
        color: 'rgba(255, 50, 200, 0.2)',
        borderColor: '#ff32c8',
        researchRequired: 'synaptic_relay'
    },
    'replication_hub': {
        name: "Replication Hub",
        cost: { minerals: 300 },
        maintenance: { energy: 3 },
        production: {},
        icon: "🤖",
        buildTime: 10,
        color: 'rgba(100, 200, 100, 0.15)',
        borderColor: '#64c864',
        researchRequired: 'self_replication'
    },
    'black_site': {
        name: "Black Site",
        cost: { minerals: 300 },
        maintenance: { energy: 2 },
        production: { energy: 8 },
        icon: "🕵️",
        buildTime: 10,
        color: 'rgba(50, 50, 50, 0.5)',
        borderColor: '#646464',
        researchRequired: 'corporate_espionage'
    }
};

export function getTechById(id) {
    return TECH_TREE.find(t => t.id === id);
}

export function getAvailableTechs(archetypeId, completedTechIds) {
    return TECH_TREE.filter(tech => {
        // Archetype filter
        if (tech.archetype.length > 0 && !tech.archetype.includes(archetypeId)) return false;
        // Already completed
        if (completedTechIds.includes(tech.id)) return false;
        // Prerequisites met
        return tech.requires.every(req => completedTechIds.includes(req));
    });
}
