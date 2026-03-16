/* Central game state, save/load, resource tick, and colony/building actions */
import { ARCHETYPES } from './civilization_data.js';
import { TECH_TREE, RESEARCH_BUILDINGS, getTechById, getAvailableTechs, getTierTechs, isTierComplete, isTierUnlocked } from './research_data.js';

// Sub-module imports
import { BUILDINGS, HARVESTER_YIELDS, HARVESTER_YIELD_DEFAULT, COLONY_COST, SURVEY_COST, MAX_BUILDING_LEVEL, LEVEL_BONUS_PER_LEVEL, getBuildingLevelMult, getUpgradeCost, getUpgradeTime } from './buildings_data.js';
import { RACE_SHIPS, SHIPS } from './ships_data.js';
import { tickResearch, applyTechBonus, unlockResearchBuilding, startResearch, cancelResearch } from './state_research.js';
import { tickRandomEvents, scheduleChainStep, applyEventChoice } from './state_events.js';
import { moveFleet, tickFleetMovement, getConnectedSystems } from './state_fleets.js';
import { tickPirateRaids, resolvePirateBattle } from './state_pirates.js';

// ── Index maps for O(1) lookups — rebuilt after galaxy generation or game load
const _systemIndex = new Map(); // id -> system
const _planetIndex = new Map(); // id -> planet
const _planetToSystem = new Map(); // planetId -> systemId

export function rebuildIndexes() {
    _systemIndex.clear();
    _planetIndex.clear();
    _planetToSystem.clear();
    for (const sys of gameState.systems) {
        _systemIndex.set(sys.id, sys);
        for (const p of sys.planets) {
            _planetIndex.set(p.id, p);
            _planetToSystem.set(p.id, sys.id);
        }
    }
}

export function getSystemForPlanet(planetId) {
    const sysId = _planetToSystem.get(planetId);
    return sysId != null ? _systemIndex.get(sysId) : null;
}

// ── Central store for Game State ─────────────────────────────────────────────
export const gameState = {
    resources: {
        energy: 200,
        minerals: 500,
        food: 300
    },
    income: {
        energy: 5,
        minerals: 3,
        food: 2
    },
    rates: {
        energy: 0,
        minerals: 0,
        food: 0
    },
    viewMode: 'SYSTEM', // 'GALAXY' or 'SYSTEM' — starts in SYSTEM to avoid galaxy flash on game start
    selectedSystemId: null,
    selectedPlanetId: null,
    systems: [], // populated by generator
    hyperlanes: [], // populated by generator
    colonies: {}, // Map planetId -> { population, buildings: [] }
    fleets: [], // Global list of ships: { id, type, systemId, name }
    date: new Date(2200, 0, 1),
    paused: false,
    gameSpeed: 1, // 1x, 2x, 3x
    playerCivilization: null, // Set on game start
    research: {
        completedTechs: [],      // array of tech ids
        currentResearch: null,   // { techId, progress, total }
        researchPoints: 0,       // accumulated per tick from research labs
        bonuses: {}              // accumulated bonuses from completed techs
    },
    pirateBase: null, // { planetId, systemId, power, raidTimer, raidInterval, defeated, battleInProgress }
    // Story & lore state
    eventChains: {
        active: [],              // [{ chainId, nextStepId, ticksRemaining }]
        completed: []            // [chainId, ...]
    },
    milestonesFired: [],         // [milestoneId, ...]
    codex: {
        unlocked: []             // [codexEntryId, ...]
    },
    completedSurfaceQuests: []   // [{planetId, questType, completedAt}]
};

// ── Simple event bus ─────────────────────────────────────────────────────────
export const events = new EventTarget();

// ── Save / Load ──────────────────────────────────────────────────────────────
export function saveGame() {
    try {
        const data = {
            resources: gameState.resources,
            income: gameState.income,
            systems: gameState.systems,
            hyperlanes: gameState.hyperlanes,
            colonies: gameState.colonies,
            fleets: gameState.fleets,
            date: gameState.date,
            playerCivilization: gameState.playerCivilization,
            research: gameState.research,
            eventChains: gameState.eventChains,
            milestonesFired: gameState.milestonesFired,
            codex: gameState.codex,
            pirateBase: gameState.pirateBase,
            completedSurfaceQuests: gameState.completedSurfaceQuests,
            version: '1.3.0'
        };
        localStorage.setItem('celestial_mandate_save', JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Save failed", e);
        return false;
    }
}

export function loadGame() {
    const json = localStorage.getItem('celestial_mandate_save');
    if (!json) return false;
    try {
        const data = JSON.parse(json);

        gameState.resources = data.resources;
        gameState.income = data.income;
        gameState.systems = data.systems;
        gameState.hyperlanes = data.hyperlanes || [];
        gameState.colonies = data.colonies;
        gameState.fleets = data.fleets;
        gameState.date = new Date(data.date);
        gameState.playerCivilization = data.playerCivilization;
        if (data.research) {
            gameState.research = data.research;
            // Re-apply all completed tech bonuses and building unlocks
            gameState.research.completedTechs.forEach(id => {
                const tech = getTechById(id);
                if (tech) {
                    applyTechBonus(tech);
                    if (tech.unlocks) unlockResearchBuilding(tech.unlocks);
                }
            });
        }

        // Story & lore state (backward compatible defaults)
        gameState.eventChains = data.eventChains || { active: [], completed: [] };
        gameState.milestonesFired = data.milestonesFired || [];
        gameState.codex = data.codex || { unlocked: [] };
        gameState.pirateBase = data.pirateBase || null;
        gameState.completedSurfaceQuests = data.completedSurfaceQuests || [];

        // Ensure buildingLevels exists for all colonies (backward compat)
        Object.values(gameState.colonies).forEach(col => {
            if (!col.buildingLevels) {
                col.buildingLevels = (col.buildings || []).map(() => 1);
            }
        });

        // Reset View
        gameState.viewMode = 'GALAXY';
        gameState.selectedSystemId = null;
        gameState.selectedPlanetId = null;

        rebuildIndexes();
        return true;
    } catch (e) {
        console.error("Load failed", e);
        return false;
    }
}

// ── Main Resource Tick ───────────────────────────────────────────────────────
let _autosaveTicks = 0;

export function updateResources() {
    if (gameState.paused) return;

    const archetypeId = gameState.playerCivilization?.archetype || 'standard';
    const modifiers = ARCHETYPES.find(a => a.id === archetypeId)?.modifiers || { growth: 1, energy_upkeep: 0, food_upkeep: 1 };
    const rb = gameState.research.bonuses;

    // Base Income
    let energy = gameState.income.energy;
    let minerals = gameState.income.minerals;
    let food = gameState.income.food;

    // Research point accumulation from research labs
    let researchPointsGained = 0;

    // Colony Logic
    Object.entries(gameState.colonies).forEach(([planetId, col]) => {
        // Base colony production
        let colEnergy = 1;
        let colMinerals = 1;
        let colFood = 1;

        // Precursor Bonus
        if (modifiers.resource_bonus) {
            colEnergy += modifiers.resource_bonus;
            colMinerals += modifiers.resource_bonus;
            colFood += modifiers.resource_bonus;
        }

        // Buildings Production (with level bonuses)
        if (!col.buildingLevels) col.buildingLevels = col.buildings.map(() => 1);
        col.buildings.forEach((bId, idx) => {
            const b = BUILDINGS[bId];
            if (b) {
                const level = col.buildingLevels[idx] || 1;
                const mult = getBuildingLevelMult(level);

                if(b.production.energy) colEnergy += Math.floor(b.production.energy * mult);
                if(b.production.minerals) colMinerals += Math.floor(b.production.minerals * mult);
                if(b.production.food) colFood += Math.floor(b.production.food * mult);

                if(b.maintenance.energy) colEnergy -= b.maintenance.energy;
                if(b.maintenance.minerals) colMinerals -= b.maintenance.minerals;
                if(b.maintenance.food) colFood -= b.maintenance.food;

                // Research labs generate research points (scaled by level)
                if (bId === 'research_lab') researchPointsGained += Math.floor(5 * mult);
            }
        });

        // Harvester Production
        if (!col.harvesters) col.harvesters = [];
        if (!col.harvesterConstruction) col.harvesterConstruction = [];

        const planet = getPlanet(planetId);
        const planetType = planet ? planet.type : null;
        col.harvesters.forEach(() => {
            const yields = HARVESTER_YIELDS[planetType] || HARVESTER_YIELD_DEFAULT;
            colEnergy += yields.energy;
            colMinerals += yields.minerals;
            colFood += yields.food;
            colEnergy -= (BUILDINGS.harvester.maintenance.energy || 0);
        });

        // Apply per-colony research bonuses
        if (rb.energy_income) colEnergy += rb.energy_income;
        if (rb.minerals_income) colMinerals += rb.minerals_income;
        if (rb.food_income) colFood += rb.food_income;

        // Megacorp Trade Bonus
        if (modifiers.energy_bonus) {
            colEnergy *= (1 + modifiers.energy_bonus);
        }

        // Pop Upkeep (with research reduction)
        const pops = col.population;
        const energyUpkeepReduction = rb.energy_upkeep_reduction || 0;
        const foodUpkeepReduction = rb.food_upkeep_reduction || 0;
        colEnergy -= pops * modifiers.energy_upkeep * (1 - energyUpkeepReduction);
        colFood -= pops * modifiers.food_upkeep * (1 - foodUpkeepReduction);

        // Pop Growth Logic
        if (!col.growthProgress) col.growthProgress = 0;

        let growthRate = modifiers.growth * (1 + (rb.pop_growth || 0));

        // Starvation/Power Shortage checks
        let growthPenalty = 1.0;
        if (gameState.resources.food <= 0 && modifiers.food_upkeep > 0) growthPenalty = 0.1;
        if (gameState.resources.energy <= 0 && modifiers.energy_upkeep > 0) growthPenalty = 0.1;

        col.growthProgress += growthRate * growthPenalty;

        if (col.growthProgress >= 100) {
            col.population += 1;
            col.growthProgress = 0;
            events.dispatchEvent(new CustomEvent('pop-growth', { detail: { planetId } }));
        }

        // Apply colony totals to global
        energy += colEnergy;
        minerals += colMinerals;
        food += colFood;
        energy += (rb.energy_income_factor || 0) * colEnergy;

        // Construction Queue (new builds + upgrades)
        if (col.construction && col.construction.length > 0) {
            const item = col.construction[0];
            item.progress += 1;

            // Check completion
            if (item.progress >= item.total) {
                if (item.isUpgrade) {
                    // Upgrade existing building
                    if (!col.buildingLevels) col.buildingLevels = col.buildings.map(() => 1);
                    col.buildingLevels[item.buildingIndex] = item.targetLevel;
                    col.construction.shift();
                    events.dispatchEvent(new CustomEvent('building-upgraded', {
                        detail: { planetId, buildingKey: item.buildingKey, level: item.targetLevel }
                    }));
                } else {
                    // New building
                    col.buildings.push(item.buildingKey);
                    if (!col.buildingLevels) col.buildingLevels = [];
                    col.buildingLevels.push(1);
                    col.construction.shift();
                    events.dispatchEvent(new CustomEvent('building-complete', {
                        detail: { planetId, buildingKey: item.buildingKey }
                    }));
                }
                events.dispatchEvent(new CustomEvent('resources-updated'));
            }
        }

        // Harvester Construction Queue
        if (col.harvesterConstruction && col.harvesterConstruction.length > 0) {
            const hItem = col.harvesterConstruction[0];
            hItem.progress += 1;

            if (hItem.progress >= hItem.total) {
                col.harvesters.push({
                    id: hItem.id,
                    position: { x: 30 + hItem.id * 20, z: 30 },
                    active: true
                });
                col.harvesterConstruction.shift();

                events.dispatchEvent(new CustomEvent('harvester-complete', {
                    detail: { planetId }
                }));
                events.dispatchEvent(new CustomEvent('resources-updated'));
            }
        }

        // Ship Build Queue
        if (col.shipQueue && col.shipQueue.length > 0) {
            const item = col.shipQueue[0];
            item.progress += 1;
            if (item.progress >= item.total) {
                col.shipQueue.shift();
                const race = gameState.playerCivilization?.bodyType || 'humanoid';
                const ships = RACE_SHIPS[race] || [];
                const ship = ships.find(s => s.id === item.shipId);
                const fleet = {
                    id: `fleet_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                    shipId: item.shipId,
                    name: ship ? ship.name : item.shipId,
                    icon: ship ? ship.icon : '🚀',
                    power: ship ? ship.power : 1,
                    accentColor: ship ? ship.accentColor : '#00f2ff',
                    systemId: null,
                    planetId,
                };
                // Find which system this planet belongs to
                const sys = getSystemForPlanet(planetId);
                if (sys) {
                    fleet.systemId = sys.id;
                    fleet.systemName = sys.name;
                }
                if (!gameState.fleets) gameState.fleets = [];
                gameState.fleets.push(fleet);
                events.dispatchEvent(new CustomEvent('ship-built', { detail: { fleet } }));
                events.dispatchEvent(new CustomEvent('resources-updated'));
            }
        }
    });

    // Apply global income factor from research
    const globalFactor = 1 + (rb.global_income_factor || 0);
    gameState.resources.energy += energy * globalFactor;
    gameState.resources.minerals += minerals * globalFactor;
    gameState.resources.food += food * globalFactor;

    // Advance research
    gameState.research.researchPoints += researchPointsGained;
    tickResearch();

    // Update global rates for UI display
    gameState.rates.energy = Math.floor(energy);
    gameState.rates.minerals = Math.floor(minerals);
    gameState.rates.food = Math.floor(food);

    // Clamp at 0 minimum for resources (no debt yet, just 0)
    if (gameState.resources.energy < 0) gameState.resources.energy = 0;
    if (gameState.resources.minerals < 0) gameState.resources.minerals = 0;
    if (gameState.resources.food < 0) gameState.resources.food = 0;

    // Advance time by 1 day per tick
    gameState.date.setDate(gameState.date.getDate() + 1);

    tickFleetMovement();
    tickPirateRaids();
    tickRandomEvents();

    // Autosave every 60 ticks (~60 game-days)
    _autosaveTicks++;
    if (_autosaveTicks >= 60) {
        _autosaveTicks = 0;
        saveGame();
        events.dispatchEvent(new CustomEvent('autosave'));
    }

    events.dispatchEvent(new CustomEvent('tick'));
}

// ── Selection ────────────────────────────────────────────────────────────────
export function selectSystem(systemId) {
    gameState.selectedSystemId = systemId;
    gameState.selectedPlanetId = null;
    events.dispatchEvent(new CustomEvent('selection-changed'));
}

export function selectPlanet(planetId) {
    gameState.selectedPlanetId = planetId;
    events.dispatchEvent(new CustomEvent('selection-changed'));
}

export function getSystem(id) {
    return _systemIndex.get(id) || gameState.systems.find(s => s.id === id);
}

export function getPlanet(id) {
    return _planetIndex.get(id) || null;
}

// ── Colony Actions ───────────────────────────────────────────────────────────
export function surveySystem(systemId) {
    const sys = getSystem(systemId);
    if (!sys || sys.surveyed) return false;
    if (gameState.resources.energy < SURVEY_COST.energy) return false;

    gameState.resources.energy -= SURVEY_COST.energy;
    sys.surveyed = true;

    events.dispatchEvent(new CustomEvent('system-surveyed', { detail: { systemId } }));
    events.dispatchEvent(new CustomEvent('resources-updated'));
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}

export function colonizePlanet(planetId) {
    if (gameState.colonies[planetId]) return false;

    // Block colonization of active pirate base
    if (gameState.pirateBase && !gameState.pirateBase.defeated && gameState.pirateBase.planetId === planetId) return false;

    const archetypeId = gameState.playerCivilization?.archetype || 'standard';
    const modifiers = ARCHETYPES.find(a => a.id === archetypeId)?.modifiers || { colony_cost_factor: 1 };
    const costFactor = modifiers.colony_cost_factor || 1;

    const minCost = COLONY_COST.minerals * costFactor;
    const foodCost = COLONY_COST.food * costFactor;

    if (gameState.resources.minerals < minCost || gameState.resources.food < foodCost) return false;

    gameState.resources.minerals -= minCost;
    gameState.resources.food -= foodCost;

    gameState.colonies[planetId] = {
        population: 1,
        growthProgress: 0,
        buildings: [],
        construction: []
    };
    events.dispatchEvent(new CustomEvent('colony-founded', { detail: { planetId } }));
    events.dispatchEvent(new CustomEvent('resources-updated'));
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}

// ── Ship Building ────────────────────────────────────────────────────────────
export function buildShip(planetId, shipId) {
    const col = gameState.colonies[planetId];
    if (!col) return false;
    if (!col.buildings.includes('shipyard')) return false;

    const race = gameState.playerCivilization?.bodyType || 'humanoid';
    const ships = RACE_SHIPS[race] || [];
    const ship = ships.find(s => s.id === shipId);
    if (!ship) return false;

    if (gameState.resources.minerals < ship.cost.minerals) return false;
    if (gameState.resources.energy < ship.cost.energy) return false;

    gameState.resources.minerals -= ship.cost.minerals;
    gameState.resources.energy   -= ship.cost.energy;

    if (!col.shipQueue) col.shipQueue = [];
    col.shipQueue.push({ shipId, progress: 0, total: ship.buildTime, planetId });

    events.dispatchEvent(new CustomEvent('resources-updated'));
    return true;
}

export function buildHarvester(planetId, isInstant = false) {
    const col = gameState.colonies[planetId];
    if (!col) return false;

    if (!col.harvesters) col.harvesters = [];
    if (!col.harvesterConstruction) col.harvesterConstruction = [];

    const totalCount = col.harvesters.length + col.harvesterConstruction.length;
    if (totalCount >= BUILDINGS.harvester.maxPerColony) return false;

    let cost = BUILDINGS.harvester.cost.minerals;
    if (isInstant) cost *= 2;
    if (gameState.resources.minerals < cost) return false;

    gameState.resources.minerals -= cost;

    const nextId = totalCount;

    if (isInstant) {
        col.harvesters.push({
            id: nextId,
            position: { x: 30 + nextId * 20, z: 30 },
            active: true
        });
        events.dispatchEvent(new CustomEvent('harvester-complete', { detail: { planetId } }));
    } else {
        col.harvesterConstruction.push({
            id: nextId,
            progress: 0,
            total: BUILDINGS.harvester.buildTime
        });
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}

export function relocateHarvester(planetId, harvesterId, newPos) {
    const col = gameState.colonies[planetId];
    if (!col || !col.harvesters) return false;

    const harvester = col.harvesters.find(h => h.id === harvesterId);
    if (!harvester) return false;

    harvester.position = { x: newPos.x, z: newPos.z };
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}

export function cancelShipBuild(planetId, queueIndex) {
    const col = gameState.colonies[planetId];
    if (!col || !col.shipQueue) return;
    const item = col.shipQueue[queueIndex];
    if (!item) return;

    const race = gameState.playerCivilization?.bodyType || 'humanoid';
    const ship = (RACE_SHIPS[race] || []).find(s => s.id === item.shipId);
    if (ship) {
        // Refund 50%
        gameState.resources.minerals += Math.floor(ship.cost.minerals * 0.5);
        gameState.resources.energy   += Math.floor(ship.cost.energy   * 0.5);
    }
    col.shipQueue.splice(queueIndex, 1);
    events.dispatchEvent(new CustomEvent('resources-updated'));
}

// ── Building Actions ─────────────────────────────────────────────────────────
export function buildBuilding(planetId, buildingKey, isInstant = false) {
    const col = gameState.colonies[planetId];
    const b = BUILDINGS[buildingKey];
    if (!col || !b) return false;
    if (b.isHarvester) return false; // harvesters use buildHarvester() instead

    // Enforce max buildings limit (5) — exclude upgrades from pending count
    const pendingNewCount = col.construction ? col.construction.filter(c => !c.isUpgrade).length : 0;
    if (col.buildings.length + pendingNewCount >= 5) return false;

    let cost = b.cost.minerals;
    if (isInstant) cost *= 2; // Double cost for instant

    // Check costs
    if (gameState.resources.minerals < cost) return false;

    // Deduct
    gameState.resources.minerals -= cost;

    if (isInstant) {
        // Build immediately
        col.buildings.push(buildingKey);
        if (!col.buildingLevels) col.buildingLevels = [];
        col.buildingLevels.push(1);
        events.dispatchEvent(new CustomEvent('building-complete', { detail: { planetId, buildingKey } }));
    } else {
        // Add to queue
        if (!col.construction) col.construction = [];
        col.construction.push({
            buildingKey,
            progress: 0,
            total: b.buildTime
        });
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    return true;
}

export function upgradeBuilding(planetId, buildingIndex, isInstant = false) {
    const col = gameState.colonies[planetId];
    if (!col) return false;
    if (buildingIndex < 0 || buildingIndex >= col.buildings.length) return false;

    if (!col.buildingLevels) col.buildingLevels = col.buildings.map(() => 1);

    const currentLevel = col.buildingLevels[buildingIndex] || 1;
    if (currentLevel >= MAX_BUILDING_LEVEL) return false;

    // Don't allow upgrading if already upgrading this building
    if (col.construction && col.construction.some(c => c.isUpgrade && c.buildingIndex === buildingIndex)) return false;

    const bKey = col.buildings[buildingIndex];
    const b = BUILDINGS[bKey];
    if (!b) return false;

    const baseCost = getUpgradeCost(bKey, currentLevel);
    let cost = isInstant ? baseCost * 2 : baseCost;
    if (gameState.resources.minerals < cost) return false;

    gameState.resources.minerals -= cost;

    if (isInstant) {
        col.buildingLevels[buildingIndex] = currentLevel + 1;
        events.dispatchEvent(new CustomEvent('building-upgraded', {
            detail: { planetId, buildingKey: bKey, level: currentLevel + 1 }
        }));
    } else {
        if (!col.construction) col.construction = [];
        col.construction.push({
            buildingKey: bKey,
            buildingIndex,
            isUpgrade: true,
            targetLevel: currentLevel + 1,
            progress: 0,
            total: getUpgradeTime(bKey, currentLevel)
        });
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}

// ── Re-exports for backward compatibility ────────────────────────────────────
// All 33+ consumer files can continue importing from './state.js' unchanged.

// Data
export { BUILDINGS, HARVESTER_YIELDS, HARVESTER_YIELD_DEFAULT, COLONY_COST, SURVEY_COST };
export { MAX_BUILDING_LEVEL, LEVEL_BONUS_PER_LEVEL, getBuildingLevelMult, getUpgradeCost, getUpgradeTime };
export { RACE_SHIPS, SHIPS };

// Research
export { startResearch, cancelResearch };
export { TECH_TREE, RESEARCH_BUILDINGS, getAvailableTechs, getTechById, getTierTechs, isTierComplete, isTierUnlocked };

// Events
export { applyEventChoice, scheduleChainStep };

// Fleets
export { moveFleet, getConnectedSystems };

// Pirates
export { resolvePirateBattle };
