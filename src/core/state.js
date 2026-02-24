/* Updated: Enriched RACE_SHIPS with story, shipClass, length, crew, weapons, special, accentColor for all 24 ships across 8 races */
import { ARCHETYPES } from './civilization_data.js';
import { TECH_TREE, RESEARCH_BUILDINGS, getTechById, getAvailableTechs } from './research_data.js';
import { RANDOM_EVENTS, EVENT_CHAINS } from './events_data.js';

// Index maps for O(1) lookups — rebuilt after galaxy generation or game load
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
    gameSpeed: 1, // 1x, 2x, 3x
    playerCivilization: null, // Set on game start
    research: {
        completedTechs: [],      // array of tech ids
        currentResearch: null,   // { techId, progress, total }
        researchPoints: 0,       // accumulated per tick from research labs
        bonuses: {}              // accumulated bonuses from completed techs
    },
    // Story & lore state
    eventChains: {
        active: [],              // [{ chainId, nextStepId, ticksRemaining }]
        completed: []            // [chainId, ...]
    },
    milestonesFired: [],         // [milestoneId, ...]
    codex: {
        unlocked: []             // [codexEntryId, ...]
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
        { id: 'h_scout', name: 'Pioneer Scout', icon: '🛸', cost: { minerals: 80, energy: 40 }, buildTime: 12, power: 1, desc: 'Fast recon vessel. Explores uncharted systems.', shipClass: 'Scout Frigate', length: '142m', crew: 12, weapons: 'Light Pulse Cannons × 2', special: 'Deep-Range Sensor Array', accentColor: '#00f2ff', story: "Born from humanity's insatiable curiosity, the Pioneer Scout was the first vessel to cross the Outer Veil. Its sleek hull was designed in the shipyards of New Carthage, built for one purpose: to go where no one has gone before. Crews of twelve brave the unknown in these nimble craft, mapping star systems and cataloguing alien worlds. Many Pioneers never return — but those that do carry knowledge that shapes the fate of empires." },
        { id: 'h_corvette', name: 'Vanguard Corvette', icon: '🚀', cost: { minerals: 180, energy: 90 }, buildTime: 25, power: 3, desc: 'Agile combat ship. Backbone of early fleets.', shipClass: 'Light Corvette', length: '280m', crew: 65, weapons: 'Railgun Batteries × 4, Point-Defense Turrets × 2', special: 'Afterburner Boost Drive', accentColor: '#ffaa00', story: "The Vanguard Corvette earned its name in the Battle of Kepler's Reach, where a squadron of twelve held off an entire enemy armada for six days. Fast, lethal, and cheap enough to build in numbers, the Vanguard became the backbone of every human fleet. Veterans call them 'razors' — thin, sharp, and deadly. Admirals call them indispensable." },
        { id: 'h_cruiser', name: 'Sovereign Cruiser', icon: '🛡️', cost: { minerals: 350, energy: 180 }, buildTime: 50, power: 7, desc: 'Heavy warship. Dominates mid-game engagements.', shipClass: 'Heavy Cruiser', length: '680m', crew: 420, weapons: 'Siege Cannons × 6, Missile Batteries × 8, Point-Defense Grid', special: 'Reinforced Void-Steel Hull, Fleet Command Bridge', accentColor: '#c864ff', story: "When the Sovereign Cruiser enters a system, the battle is already half-won. These behemoths carry enough firepower to crack a moon and enough armor to shrug off a broadside. Each one takes years to build and carries the names of fallen heroes etched into its hull. To serve aboard a Sovereign is the highest honor in the Imperial Fleet — and the most dangerous." },
    ],
    insectoid: [
        { id: 'i_drone', name: 'Brood Drone', icon: '🪲', cost: { minerals: 60, energy: 30 }, buildTime: 8, power: 1, desc: 'Expendable swarm unit. Cheap and numerous.', shipClass: 'Swarm Drone', length: '38m', crew: 0, weapons: 'Acid Spitter × 1, Razor Mandibles', special: 'Hive-Mind Coordination, Self-Destruct Spore Burst', accentColor: '#64c832', story: "The Brood Drone is not a ship — it is an extension of the Hive's will. Grown in vast bio-vats over mere days, each drone carries a fragment of the Queen's consciousness. Alone, a drone is nothing. In swarms of thousands, they are an unstoppable tide that has consumed entire star systems. Enemy commanders have learned to fear the sound of chittering in the void." },
        { id: 'i_carrier', name: 'Hive Carrier', icon: '🦟', cost: { minerals: 200, energy: 80 }, buildTime: 30, power: 4, desc: 'Deploys drone swarms in combat.', shipClass: 'Bio-Carrier', length: '520m', crew: 0, weapons: 'Drone Launch Bays × 12, Spore Torpedo Launchers × 4', special: 'Rapid Drone Regeneration, Pheromone Command Pulse', accentColor: '#88cc44', story: "The Hive Carrier is a living fortress that births war. Its cavernous interior teems with thousands of dormant drones, awakened only when the Hive demands blood. In battle, it hangs back, flooding the void with its children while enemy ships are overwhelmed. To destroy a Carrier is to silence a thousand voices — but the Hive always grows another." },
        { id: 'i_dreadnought', name: 'Queen Dreadnought', icon: '👾', cost: { minerals: 400, energy: 200 }, buildTime: 60, power: 9, desc: 'Apex predator of the void. Feared by all.', shipClass: 'Apex Dreadnought', length: '1.4km', crew: 0, weapons: 'Bio-Plasma Cannons × 8, Acid Beam Arrays × 6, Drone Swarm Bays × 20', special: 'Queen-Shard Neural Core, Regenerating Chitin Armor', accentColor: '#cc4444', story: "There are legends of the Queen Dreadnought that predate recorded history. Ancient star-charts mark certain systems with a single warning: 'The Hive was here.' This living leviathan carries a fragment of the Queen herself — her rage, her hunger, her absolute will to consume. No weapon built by lesser races has ever destroyed one. They are simply endured, until the Hive moves on." },
    ],
    avian: [
        { id: 'a_skiff', name: 'Windskiff', icon: '🪶', cost: { minerals: 70, energy: 50 }, buildTime: 10, power: 1, desc: 'Ultra-fast scout. Outruns any pursuit.', shipClass: 'Recon Skiff', length: '95m', crew: 6, weapons: 'Feather-Blade Micro-Missiles × 4', special: 'Gale-Drive Hypersprint, Atmospheric Glide Mode', accentColor: '#44aaff', story: "The Windskiff was inspired by the great sky-hunters of the Avian homeworld — creatures that could dive faster than sound and vanish into clouds before prey knew they were there. Its pilots are chosen for their reflexes and their fearlessness. A Windskiff crew lives by one creed: strike fast, vanish faster. They have never lost a pursuit." },
        { id: 'a_raptor', name: 'Raptor Interceptor', icon: '🦅', cost: { minerals: 160, energy: 100 }, buildTime: 22, power: 3, desc: 'Precision strike craft. Excels at ambushes.', shipClass: 'Strike Interceptor', length: '310m', crew: 80, weapons: 'Talon Railguns × 6, Dive-Bomb Torpedo Pods × 3', special: 'Stealth Feather-Coating, Predator Lock-On System', accentColor: '#ffcc00', story: "Raptor pilots are the elite of the Avian military — warriors who train for decades to master the art of the killing dive. The Raptor Interceptor was built around their philosophy: approach unseen, strike with absolute precision, and be gone before the enemy can respond. In three hundred years of service, no Raptor has ever been caught from behind." },
        { id: 'a_stormwing', name: 'Stormwing Frigate', icon: '⚡', cost: { minerals: 320, energy: 160 }, buildTime: 45, power: 7, desc: 'Elegant warship. Combines speed and firepower.', shipClass: 'Storm Frigate', length: '590m', crew: 310, weapons: 'Lightning Cannon Arrays × 5, Storm Missile Clusters × 10', special: 'Electromagnetic Storm Generator, Wing-Sail Solar Charging', accentColor: '#ffee44', story: "The Stormwing Frigate is the Avian people's greatest achievement in naval engineering — a ship as beautiful as it is deadly. Its swept-wing silhouette cuts through space like a raptor through wind, and its electromagnetic storm generators can disable entire enemy fleets before a single shot is fired. To see a Stormwing in full battle configuration is to witness a work of terrible art." },
    ],
    fungal: [
        { id: 'f_spore', name: 'Spore Pod', icon: '🍄', cost: { minerals: 50, energy: 20 }, buildTime: 10, power: 1, desc: 'Biological probe. Self-replicates slowly.', shipClass: 'Bio-Probe', length: '60m', crew: 0, weapons: 'Spore Burst Ejectors × 2', special: 'Mycelial Self-Replication, Spore Trail Navigation', accentColor: '#88dd44', story: "The Spore Pod drifts through the void like a seed on the wind, patient and purposeful. It carries no crew — only the Fungal Collective's distributed consciousness, encoded in living mycelium. Where a Spore Pod lands, the Collective follows. Entire planets have been claimed not through war, but through the quiet, inevitable spread of spores. By the time enemies notice, it is already too late." },
        { id: 'f_tendril', name: 'Tendril Cruiser', icon: '🌿', cost: { minerals: 190, energy: 70 }, buildTime: 28, power: 4, desc: 'Entangles enemies with mycelial nets.', shipClass: 'Entanglement Cruiser', length: '480m', crew: 0, weapons: 'Mycelial Net Launchers × 6, Spore Acid Sprayers × 4', special: 'Living Hull Regeneration, Tendril Boarding Cables', accentColor: '#44cc88', story: "The Tendril Cruiser does not destroy its enemies — it absorbs them. Its vast mycelial nets can ensnare ships ten times its size, pulling them into a slow, inescapable embrace. Once caught, the Collective's tendrils penetrate the hull, converting metal and crew alike into biomass. Enemy admirals have standing orders: never let a Tendril Cruiser get close. Most learn this lesson too late." },
        { id: 'f_worldship', name: 'Worldship', icon: '🌑', cost: { minerals: 450, energy: 150 }, buildTime: 65, power: 10, desc: 'Living ship-world. Near-indestructible.', shipClass: 'Living Worldship', length: '8km', crew: 0, weapons: 'Planetary Spore Cannons × 4, Mycelial Pulse Wave, Tendril Swarm Bays', special: 'Self-Sustaining Biosphere, Collective Hive-Mind Core, Planetary Terraforming', accentColor: '#228844', story: "The Worldship is not a vessel — it is a civilization. Over centuries, the Fungal Collective grew this living moon-sized organism from a single spore, feeding it with the minerals of a hundred worlds. Inside its vast interior, billions of organisms live, work, and dream. Its outer shell is kilometers of living armor that heals faster than any weapon can damage it. The Worldship does not go to war. War comes to it, and is consumed." },
    ],
    crystalline: [
        { id: 'c_shard', name: 'Crystal Shard', icon: '💎', cost: { minerals: 90, energy: 60 }, buildTime: 12, power: 2, desc: 'Resonance scout. Detects mineral deposits.', shipClass: 'Resonance Scout', length: '110m', crew: 8, weapons: 'Focused Resonance Beam × 2', special: 'Deep-Spectrum Mineral Scanner, Harmonic Stealth Field', accentColor: '#88ccff', story: "Grown rather than built, the Crystal Shard is a marvel of Crystalline engineering — a living lattice of resonant minerals that vibrates in harmony with the universe itself. Its crew of eight are bonded to the ship through crystalline neural interfaces, feeling every vibration in the void. They can detect mineral deposits across three star systems and navigate asteroid fields by sound alone." },
        { id: 'c_lattice', name: 'Lattice Warship', icon: '🔷', cost: { minerals: 200, energy: 120 }, buildTime: 30, power: 5, desc: 'Fires focused resonance beams.', shipClass: 'Resonance Warship', length: '440m', crew: 180, weapons: 'Resonance Beam Arrays × 8, Harmonic Pulse Cannons × 4', special: 'Prismatic Shield Lattice, Frequency Amplification Core', accentColor: '#4488ff', story: "The Lattice Warship is a weapon of terrible beauty. Its crystalline hull refracts starlight into prismatic cascades, and its resonance beams can shatter enemy hulls at the molecular level — vibrating their atoms apart until the ship simply dissolves. Crystalline commanders prize the Lattice for its elegance: it destroys without explosion, without fire, without chaos. Only silence." },
        { id: 'c_monolith', name: 'Resonance Monolith', icon: '🗿', cost: { minerals: 380, energy: 220 }, buildTime: 55, power: 9, desc: 'Shatters enemy hulls with pure frequency.', shipClass: 'Apex Monolith', length: '1.1km', crew: 600, weapons: 'Planetary Resonance Cannon × 1, Harmonic Disruptor Arrays × 12, Shard Storm Launchers × 6', special: 'Crystalline Fortress Hull, Resonance Amplification Network, Frequency Overload', accentColor: '#aa66ff', story: "Ancient Crystalline texts describe the Resonance Monolith as 'the voice of the universe, given form and fury.' Its single planetary resonance cannon can shatter a moon's crust from orbit. In battle, it broadcasts a frequency that resonates with every metal alloy known to science, causing enemy ships to vibrate themselves apart. The Monolith has never been defeated in direct combat. It simply sings, and everything breaks." },
    ],
    aquatic: [
        { id: 'q_tide', name: 'Tidecaller', icon: '🌊', cost: { minerals: 75, energy: 45 }, buildTime: 11, power: 1, desc: 'Fluid-hull scout. Slips through debris fields.', shipClass: 'Fluid Scout', length: '120m', crew: 14, weapons: 'Hydro-Jet Torpedoes × 3', special: 'Fluid-Adaptive Hull, Debris-Phase Navigation', accentColor: '#44aacc', story: "The Tidecaller moves through space the way water moves through rock — finding every crack, every gap, every path that others cannot see. Its fluid-adaptive hull reshapes itself around obstacles, allowing it to navigate debris fields and asteroid belts that would destroy conventional ships. Tidecaller crews are chosen for their patience and their instinct for flow. They never force their way through anything. They simply find the path of least resistance." },
        { id: 'q_leviathan', name: 'Deep Leviathan', icon: '🐋', cost: { minerals: 210, energy: 100 }, buildTime: 32, power: 5, desc: 'Massive bio-ship. Absorbs damage like water.', shipClass: 'Bio-Leviathan', length: '720m', crew: 0, weapons: 'Pressure Cannon Arrays × 6, Bioluminescent Pulse Emitters × 4', special: 'Hydro-Regenerative Armor, Depth Charge Launchers, Sonar Targeting', accentColor: '#2288aa', story: "The Deep Leviathan was not designed — it was evolved. Over millennia, the Aquatic Collective bred these creatures in the crushing depths of their ocean worlds, selecting for size, resilience, and aggression. The result is a living warship that feels no pain, fears no damage, and regenerates faster than weapons can destroy it. Enemy commanders have reported firing everything they have into a Leviathan and watching it simply absorb the hits." },
        { id: 'q_abyss', name: 'Abyssal Dreadnought', icon: '🌀', cost: { minerals: 420, energy: 190 }, buildTime: 58, power: 10, desc: 'Void-ocean titan. Commands entire fleets.', shipClass: 'Void Dreadnought', length: '2.2km', crew: 0, weapons: 'Void Vortex Cannons × 4, Tidal Wave Pulse × 1, Depth Torpedo Bays × 16', special: 'Gravitational Current Manipulation, Fleet Coordination Sonar, Abyssal Armor', accentColor: '#115577', story: "From the deepest trenches of the Aquatic homeworld came the inspiration for the Abyssal Dreadnought — a creature so ancient and vast that early explorers mistook it for a continent. The Dreadnought captures that primal terror and weaponizes it. Its void vortex cannons create miniature gravitational anomalies that crush enemy ships like pressure at the ocean floor. When an Abyssal Dreadnought enters a system, the stars themselves seem to dim." },
    ],
    energy: [
        { id: 'e_pulse', name: 'Pulse Wisp', icon: '✨', cost: { minerals: 40, energy: 80 }, buildTime: 8, power: 2, desc: 'Pure energy scout. Phases through obstacles.', shipClass: 'Energy Scout', length: '80m', crew: 3, weapons: 'Pulse Burst Emitters × 4', special: 'Phase-Through Capability, Electromagnetic Cloak', accentColor: '#ffff44', story: "The Pulse Wisp exists at the boundary between matter and energy — a vessel so suffused with stellar power that it can briefly phase through solid matter. Its three-person crew are Energy Beings who have chosen to anchor themselves in physical form for the purpose of exploration. They navigate by feeling the electromagnetic currents of the universe, moving through space the way light moves through glass." },
        { id: 'e_arc', name: 'Arc Conduit', icon: '⚡', cost: { minerals: 100, energy: 160 }, buildTime: 20, power: 5, desc: 'Channels stellar energy into weapons.', shipClass: 'Energy Conduit', length: '350m', crew: 20, weapons: 'Arc Lightning Cannons × 6, Solar Flare Projectors × 3', special: 'Stellar Energy Absorption, Chain Lightning Discharge', accentColor: '#ffcc00', story: "The Arc Conduit is less a ship than a living capacitor — a vessel designed to absorb the raw energy of stars and release it in devastating bursts. Its crew of twenty Energy Beings maintain the delicate balance between absorption and discharge, walking the razor's edge between power and annihilation. In battle, the Arc Conduit draws energy from nearby stars, growing more powerful the longer the fight lasts. Enemies have learned: end the fight quickly, or not at all." },
        { id: 'e_nova', name: 'Nova Singularity', icon: '🌟', cost: { minerals: 200, energy: 320 }, buildTime: 45, power: 11, desc: 'Collapses stars. The ultimate weapon.', shipClass: 'Singularity Dreadnought', length: '900m', crew: 50, weapons: 'Stellar Collapse Cannon × 1, Nova Pulse Arrays × 8, Singularity Torpedoes × 6', special: 'Star Collapse Trigger, Singularity Core, Energy Transcendence Field', accentColor: '#ffffff', story: "There is only one recorded use of the Nova Singularity's primary weapon. The target was a star system. The result was a new nebula. The fifty Energy Beings who crew this vessel are the most powerful individuals in the known galaxy — beings who have transcended physical form so completely that they exist simultaneously as crew and as the ship itself. The Nova Singularity is not deployed in battles. It is deployed to end wars." },
    ],
    synthetic: [
        { id: 's_probe', name: 'Recon Probe', icon: '🤖', cost: { minerals: 60, energy: 60 }, buildTime: 8, power: 1, desc: 'Automated scout. Never needs a crew.', shipClass: 'Autonomous Probe', length: '55m', crew: 0, weapons: 'Defensive Laser Turrets × 2', special: 'Full Autonomy AI Core, Long-Range Sensor Suite, Self-Repair Nanobots', accentColor: '#88aacc', story: "The Recon Probe was the first fully autonomous warship ever created — a machine that thinks, decides, and acts without any organic input. Its AI core was trained on ten thousand years of military history and can predict enemy movements with 94.7% accuracy. Probe pilots — a term used loosely, since no one actually pilots them — joke that the Probe is smarter than its commanders. The Probe's logs suggest it agrees." },
        { id: 's_warbot', name: 'Warbot Corvette', icon: '⚙️', cost: { minerals: 170, energy: 130 }, buildTime: 24, power: 4, desc: 'Self-repairing combat unit. Relentless.', shipClass: 'Combat Corvette', length: '290m', crew: 0, weapons: 'Railgun Batteries × 5, Missile Pods × 4, Point-Defense Lasers × 6', special: 'Nanobot Self-Repair System, Tactical Combat AI, Modular Weapon Hardpoints', accentColor: '#aaaaaa', story: "The Warbot Corvette was designed with one principle: it should never stop fighting. Its nanobot repair systems can rebuild damaged components mid-battle, its tactical AI adapts to enemy strategies in real-time, and its modular weapon hardpoints can be reconfigured between engagements. Enemy commanders have reported destroying a Warbot Corvette's weapons array, only to watch it rebuild and return fire within minutes. They are not ships. They are persistence made metal." },
        { id: 's_fortress', name: 'Fortress Platform', icon: '🏰', cost: { minerals: 360, energy: 250 }, buildTime: 52, power: 9, desc: 'Mobile fortress. Turns any system into a stronghold.', shipClass: 'Mobile Fortress', length: '1.8km', crew: 0, weapons: 'Siege Cannon Batteries × 10, Anti-Ship Missile Arrays × 16, Point-Defense Network', special: 'Impenetrable Composite Armor, Autonomous Defense Grid, System Lockdown Protocol', accentColor: '#cc8844', story: "The Fortress Platform was born from a simple question: what if a shipyard could fight? The answer is a mobile behemoth that carries enough weapons to hold an entire star system against any fleet. Once deployed, a Fortress Platform locks down its position and becomes effectively immovable — not because it cannot move, but because nothing can make it move. Admirals use them as anchors for entire battle lines. Enemies call them 'the door that never opens.'" },
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
            eventChains: gameState.eventChains,
            milestonesFired: gameState.milestonesFired,
            codex: gameState.codex,
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

let _autosaveTicks = 0;
let _eventTicks = 0;

/* ── Chain helper: find a step by ID within a chain ─────────────────────── */
function _findChainStep(chainId, stepId) {
    const chain = EVENT_CHAINS[chainId];
    if (!chain) return null;
    return chain.steps.find(s => s.id === stepId) || null;
}

function tickRandomEvents() {
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
            !chains.active.some(a => a.chainId === c.id)
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
            const evt = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
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
    events.dispatchEvent(new CustomEvent('resources-updated'));
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
    return _systemIndex.get(id) || gameState.systems.find(s => s.id === id);
}

export function getPlanet(id) {
    return _planetIndex.get(id) || null;
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

/**
 * Orders a fleet (ship) to move to a connected system via hyperlane.
 * @param {number} fleetIndex - Index in gameState.fleets
 * @param {number} targetSystemId - Destination system ID
 * @returns {boolean} Whether the order was accepted
 */
export function moveFleet(fleetIndex, targetSystemId) {
    const fleet = gameState.fleets[fleetIndex];
    if (!fleet) return false;
    if (fleet.moving) return false; // already in transit

    const currentSys = getSystem(fleet.systemId);
    if (!currentSys) return false;

    // Check if destination is connected via hyperlane
    if (!currentSys.connections.includes(targetSystemId)) return false;

    const targetSys = getSystem(targetSystemId);
    if (!targetSys) return false;

    fleet.moving = {
        fromId: fleet.systemId,
        toId: targetSystemId,
        toName: targetSys.name,
        progress: 0,
        total: 10, // 10 ticks to travel
    };
    events.dispatchEvent(new CustomEvent('fleet-moving', { detail: { fleet } }));
    return true;
}

function tickFleetMovement() {
    if (!gameState.fleets) return;
    gameState.fleets.forEach(fleet => {
        if (!fleet.moving) return;
        fleet.moving.progress++;
        if (fleet.moving.progress >= fleet.moving.total) {
            fleet.systemId = fleet.moving.toId;
            fleet.systemName = fleet.moving.toName;
            const arrival = fleet.moving;
            fleet.moving = null;
            events.dispatchEvent(new CustomEvent('fleet-arrived', { detail: { fleet, arrival } }));
        }
    });
}

export function getConnectedSystems(systemId) {
    const sys = getSystem(systemId);
    if (!sys) return [];
    return sys.connections.map(id => getSystem(id)).filter(Boolean);
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