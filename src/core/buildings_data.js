/* Building definitions, harvester yields, and colony/survey costs */

export const BUILDINGS = {
    'mining_network': {
        name: "Mining Network",
        cost: { minerals: 150 },
        maintenance: { energy: 1 },
        production: { minerals: 4 },
        icon: "⛏️",
        buildTime: 5,
        color: 'rgba(255, 150, 50, 0.2)',
        borderColor: '#ff9632'
    },
    'power_plant': {
        name: "Power Plant",
        cost: { minerals: 100 },
        maintenance: {},
        production: { energy: 4 },
        icon: "⚡",
        buildTime: 5,
        color: 'rgba(255, 220, 0, 0.15)',
        borderColor: '#ffdd00'
    },
    'hydroponics': {
        name: "Hydroponics",
        cost: { minerals: 100 },
        maintenance: { energy: 1 },
        production: { food: 4 },
        icon: "🌱",
        buildTime: 4,
        color: 'rgba(50, 255, 100, 0.15)',
        borderColor: '#32ff64'
    },
    'research_lab': {
        name: "Research Lab",
        cost: { minerals: 200 },
        maintenance: { energy: 2 },
        production: {},
        icon: "🔬",
        buildTime: 8,
        color: 'rgba(50, 150, 255, 0.2)',
        borderColor: '#3296ff'
    },
    'shipyard': {
        name: "Shipyard",
        cost: { minerals: 250 },
        maintenance: { energy: 3 },
        production: {},
        icon: "🛸",
        buildTime: 10,
        color: 'rgba(180, 150, 255, 0.2)',
        borderColor: '#b496ff'
    },
    'harvester': {
        name: "Resource Harvester",
        icon: "🏭",
        cost: { minerals: 120 },
        buildTime: 6,
        maintenance: { energy: 1 },
        production: {},
        maxPerColony: 2,
        isHarvester: true,
        color: 'rgba(255, 170, 0, 0.15)',
        borderColor: '#ffaa00'
    }
};

export const MAX_BUILDING_LEVEL = 5;
export const LEVEL_BONUS_PER_LEVEL = 0.25; // +25% production per level above 1

/** Get production multiplier for a building level */
export function getBuildingLevelMult(level) {
    return 1 + (level - 1) * LEVEL_BONUS_PER_LEVEL;
}

/** Get mineral cost to upgrade from currentLevel to next */
export function getUpgradeCost(buildingKey, currentLevel) {
    const b = BUILDINGS[buildingKey];
    if (!b) return Infinity;
    return Math.ceil(b.cost.minerals * (0.5 + currentLevel * 0.5));
}

/** Get time (ticks) to upgrade from currentLevel */
export function getUpgradeTime(buildingKey, currentLevel) {
    const b = BUILDINGS[buildingKey];
    if (!b) return 999;
    return Math.ceil(b.buildTime * 0.5 * currentLevel);
}

export const HARVESTER_YIELDS = {
    'Terran':  { energy: 1, minerals: 1, food: 3 },
    'Molten':  { energy: 2, minerals: 3, food: 0 },
    'Barren':  { energy: 1, minerals: 3, food: 1 },
    'Ice':     { energy: 2, minerals: 2, food: 1 },
};
export const HARVESTER_YIELD_DEFAULT = { energy: 1, minerals: 2, food: 2 };

export const COLONY_COST = { minerals: 300, food: 100 };
export const SURVEY_COST = { energy: 50 };
