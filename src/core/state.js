/* Updated: Added research state, research queue, bonus application, and research building unlocks */
import { ARCHETYPES } from './civilization_data.js';
import { TECH_TREE, RESEARCH_BUILDINGS, getTechById, getAvailableTechs } from './research_data.js';

// Central store for Game State
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
    playerCivilization: null, // Set on game start
    research: {
        completedTechs: [],      // array of tech ids
        currentResearch: null,   // { techId, progress, total }
        researchPoints: 0,       // accumulated per tick from research labs
        bonuses: {}              // accumulated bonuses from completed techs
    }
};

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
    }
};

// 3 unique ships per race — keyed by bodyType id
export const RACE_SHIPS = {
    humanoid: [
        { id: 'h_scout',    name: 'Pioneer Scout',     icon: '🛸', cost: { minerals: 80,  energy: 40  }, buildTime: 12, power: 1,  desc: 'Fast recon vessel. Explores uncharted systems.' },
        { id: 'h_corvette', name: 'Vanguard Corvette',  icon: '🚀', cost: { minerals: 180, energy: 90  }, buildTime: 25, power: 3,  desc: 'Agile combat ship. Backbone of early fleets.' },
        { id: 'h_cruiser',  name: 'Sovereign Cruiser',  icon: '🛡️', cost: { minerals: 350, energy: 180 }, buildTime: 50, power: 7,  desc: 'Heavy warship. Dominates mid-game engagements.' },
    ],
    insectoid: [
        { id: 'i_drone',    name: 'Brood Drone',        icon: '🪲', cost: { minerals: 60,  energy: 30  }, buildTime: 8,  power: 1,  desc: 'Expendable swarm unit. Cheap and numerous.' },
        { id: 'i_carrier',  name: 'Hive Carrier',       icon: '�', cost: { minerals: 200, energy: 80  }, buildTime: 30, power: 4,  desc: 'Deploys drone swarms in combat.' },
        { id: 'i_dreadnought', name: 'Queen Dreadnought', icon: '👾', cost: { minerals: 400, energy: 200 }, buildTime: 60, power: 9, desc: 'Apex predator of the void. Feared by all.' },
    ],
    avian: [
        { id: 'a_skiff',    name: 'Windskiff',          icon: '🪶', cost: { minerals: 70,  energy: 50  }, buildTime: 10, power: 1,  desc: 'Ultra-fast scout. Outruns any pursuit.' },
        { id: 'a_raptor',   name: 'Raptor Interceptor', icon: '🦅', cost: { minerals: 160, energy: 100 }, buildTime: 22, power: 3,  desc: 'Precision strike craft. Excels at ambushes.' },
        { id: 'a_stormwing', name: 'Stormwing Frigate', icon: '⚡', cost: { minerals: 320, energy: 160 }, buildTime: 45, power: 7,  desc: 'Elegant warship. Combines speed and firepower.' },
    ],
    fungal: [
        { id: 'f_spore',    name: 'Spore Pod',          icon: '🍄', cost: { minerals: 50,  energy: 20  }, buildTime: 10, power: 1,  desc: 'Biological probe. Self-replicates slowly.' },
        { id: 'f_tendril',  name: 'Tendril Cruiser',    icon: '🌿', cost: { minerals: 190, energy: 70  }, buildTime: 28, power: 4,  desc: 'Entangles enemies with mycelial nets.' },
        { id: 'f_worldship', name: 'Worldship',         icon: '🌑', cost: { minerals: 450, energy: 150 }, buildTime: 65, power: 10, desc: 'Living ship-world. Near-indestructible.' },
    ],
    crystalline: [
        { id: 'c_shard',    name: 'Crystal Shard',      icon: '💎', cost: { minerals: 90,  energy: 60  }, buildTime: 12, power: 2,  desc: 'Resonance scout. Detects mineral deposits.' },
        { id: 'c_lattice',  name: 'Lattice Warship',    icon: '🔷', cost: { minerals: 200, energy: 120 }, buildTime: 30, power: 5,  desc: 'Fires focused resonance beams.' },
        { id: 'c_monolith', name: 'Resonance Monolith', icon: '🗿', cost: { minerals: 380, energy: 220 }, buildTime: 55, power: 9,  desc: 'Shatters enemy hulls with pure frequency.' },
    ],
    aquatic: [
        { id: 'q_tide',     name: 'Tidecaller',         icon: '🌊', cost: { minerals: 75,  energy: 45  }, buildTime: 11, power: 1,  desc: 'Fluid-hull scout. Slips through debris fields.' },
        { id: 'q_leviathan', name: 'Deep Leviathan',    icon: '🐋', cost: { minerals: 210, energy: 100 }, buildTime: 32, power: 5,  desc: 'Massive bio-ship. Absorbs damage like water.' },
        { id: 'q_abyss',    name: 'Abyssal Dreadnought', icon: '🌀', cost: { minerals: 420, energy: 190 }, buildTime: 58, power: 10, desc: 'Void-ocean titan. Commands entire fleets.' },
    ],
    energy: [
        { id: 'e_pulse',    name: 'Pulse Wisp',         icon: '✨', cost: { minerals: 40,  energy: 80  }, buildTime: 8,  power: 2,  desc: 'Pure energy scout. Phases through obstacles.' },
        { id: 'e_arc',      name: 'Arc Conduit',        icon: '⚡', cost: { minerals: 100, energy: 160 }, buildTime: 20, power: 5,  desc: 'Channels stellar energy into weapons.' },
        { id: 'e_nova',     name: 'Nova Singularity',   icon: '🌟', cost: { minerals: 200, energy: 320 }, buildTime: 45, power: 11, desc: 'Collapses stars. The ultimate weapon.' },
    ],
    synthetic: [
        { id: 's_probe',    name: 'Recon Probe',        icon: '🤖', cost: { minerals: 60,  energy: 60  }, buildTime: 8,  power: 1,  desc: 'Automated scout. Never needs a crew.' },
        { id: 's_warbot',   name: 'Warbot Corvette',    icon: '⚙️', cost: { minerals: 170, energy: 130 }, buildTime: 24, power: 4,  desc: 'Self-repairing combat unit. Relentless.' },
        { id: 's_fortress', name: 'Fortress Platform',  icon: '🏰', cost: { minerals: 360, energy: 250 }, buildTime: 52, power: 9,  desc: 'Mobile fortress. Turns any system into a stronghold.' },
    ],
};

// Fallback generic ships if race not found
export const SHIPS = {
    'scout':    { name: "Scout Ship",  cost: { minerals: 100, energy: 50  }, buildTime: 15, icon: "🛰️", desc: "Fast exploration vessel." },
    'corvette': { name: "Corvette",    cost: { minerals: 200, energy: 100 }, buildTime: 30, icon: "🚀", desc: "Small combat ship." },
};

export const COLONY_COST = { minerals: 300, food: 100 };
export const SURVEY_COST = { energy: 50 };

// Simple event bus
export const events = new EventTarget();

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
            version: '1.2.0'
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
        
        // Reset View
        gameState.viewMode = 'GALAXY';
        gameState.selectedSystemId = null;
        gameState.selectedPlanetId = null;
        
        return true;
    } catch (e) {
        console.error("Load failed", e);
        return false;
    }
}

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

        // Buildings Production
        col.buildings.forEach(bId => {
            const b = BUILDINGS[bId];
            if (b) {
                if(b.production.energy) colEnergy += b.production.energy;
                if(b.production.minerals) colMinerals += b.production.minerals;
                if(b.production.food) colFood += b.production.food;
                
                if(b.maintenance.energy) colEnergy -= b.maintenance.energy;
                if(b.maintenance.minerals) colMinerals -= b.maintenance.minerals;
                if(b.maintenance.food) colFood -= b.maintenance.food;

                // Research labs generate research points
                if (bId === 'research_lab') researchPointsGained += 5;
            }
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

        // Construction Queue
        if (col.construction && col.construction.length > 0) {
            const item = col.construction[0];
            item.progress += 1;
            
            // Check completion
            if (item.progress >= item.total) {
                col.buildings.push(item.buildingKey);
                col.construction.shift();
                
                events.dispatchEvent(new CustomEvent('building-complete', { 
                    detail: { planetId, buildingKey: item.buildingKey } 
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
                    systemId: null,
                    planetId,
                };
                // Find which system this planet belongs to
                for (const sys of gameState.systems) {
                    if (sys.planets.find(p => p.id === planetId)) {
                        fleet.systemId = sys.id;
                        fleet.systemName = sys.name;
                        break;
                    }
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
    
    events.dispatchEvent(new CustomEvent('tick'));
}

function tickResearch() {
    const r = gameState.research;
    if (!r.currentResearch) return;

    // Apply research cost factor bonus
    const costFactor = Math.max(0.3, 1 + (r.bonuses.research_cost_factor || 0));
    r.currentResearch.progress += r.researchPoints;

    if (r.currentResearch.progress >= r.currentResearch.total * costFactor) {
        const techId = r.currentResearch.techId;
        r.completedTechs.push(techId);
        r.currentResearch = null;
        r.researchPoints = 0;

        const tech = getTechById(techId);
        if (tech) {
            applyTechBonus(tech);
            if (tech.unlocks) unlockResearchBuilding(tech.unlocks);
        }

        events.dispatchEvent(new CustomEvent('research-complete', { detail: { techId } }));
        events.dispatchEvent(new CustomEvent('resources-updated'));
    }
}

function applyTechBonus(tech) {
    const rb = gameState.research.bonuses;
    if (!tech.bonus) return;
    Object.entries(tech.bonus).forEach(([key, val]) => {
        rb[key] = (rb[key] || 0) + val;
    });
}

function unlockResearchBuilding(buildingKey) {
    if (!RESEARCH_BUILDINGS[buildingKey]) return;
    if (!BUILDINGS[buildingKey]) {
        BUILDINGS[buildingKey] = { ...RESEARCH_BUILDINGS[buildingKey] };
    }
}

export function startResearch(techId) {
    const r = gameState.research;
    if (r.currentResearch) return false; // already researching
    if (r.completedTechs.includes(techId)) return false;

    // Check if colony with research_lab exists
    const hasLab = Object.values(gameState.colonies).some(col =>
        col.buildings.includes('research_lab')
    );
    if (!hasLab) return false;

    const tech = getTechById(techId);
    if (!tech) return false;

    r.currentResearch = { techId, progress: 0, total: tech.cost };
    r.researchPoints = 0;
    events.dispatchEvent(new CustomEvent('research-started', { detail: { techId } }));
    return true;
}

export function cancelResearch() {
    gameState.research.currentResearch = null;
    gameState.research.researchPoints = 0;
    events.dispatchEvent(new CustomEvent('resources-updated'));
}

export { TECH_TREE, RESEARCH_BUILDINGS, getAvailableTechs, getTechById };

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
    return gameState.systems.find(s => s.id === id);
}

export function getPlanet(id) {
    for (const sys of gameState.systems) {
        const p = sys.planets.find(p => p.id === id);
        if (p) return p;
    }
    return null;
}

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
    return true;
}

// ── Ship Building ─────────────────────────────────────────────────────────────
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

export function buildBuilding(planetId, buildingKey, isInstant = false) {
    const col = gameState.colonies[planetId];
    const b = BUILDINGS[buildingKey];
    if (!col || !b) return false;
    
    // Enforce max buildings limit (5)
    const pendingCount = col.construction ? col.construction.length : 0;
    if (col.buildings.length + pendingCount >= 5) return false;

    let cost = b.cost.minerals;
    if (isInstant) cost *= 2; // Double cost for instant

    // Check costs
    if (gameState.resources.minerals < cost) return false;

    // Deduct
    gameState.resources.minerals -= cost;

    if (isInstant) {
        // Build immediately
        col.buildings.push(buildingKey);
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