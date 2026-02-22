/* Updated: Organized app hierarchy, moved to src/core folder, fixed imports and paths */
export const BODY_TYPES = [
    { 
        id: "humanoid", 
        name: "Humanoid", 
        desc: "Versatile and adaptable, humanoids thrive in diverse environments with balanced traits.", 
        img: "assets/race_humanoid.png" 
    },
    { 
        id: "insectoid", 
        name: "Insectoid", 
        desc: "Hardy and communal, insectoids often favor rapid expansion and collective governance.", 
        img: "assets/race_insectoid.png" 
    },
    { 
        id: "avian", 
        name: "Avian", 
        desc: "Graceful and swift, avians often possess keen senses and a preference for high-altitude habitats.", 
        img: "assets/race_avian.png" 
    },
    { 
        id: "fungal", 
        name: "Fungal", 
        desc: "Resilient and patient, fungal species grow slowly but deeply entrench themselves in their ecosystems.", 
        img: "assets/race_fungal.png" 
    },
    { 
        id: "crystalline", 
        name: "Crystalline", 
        desc: "Beings of living mineral, they are extremely durable and naturally attuned to energy resonance.", 
        img: "assets/race_crystalline.png" 
    },
    { 
        id: "aquatic", 
        name: "Aquatic", 
        desc: "Native to ocean worlds, these species are masters of hydro-engineering and food production.", 
        img: "assets/race_aquatic.png" 
    },
    { 
        id: "energy", 
        name: "Energy-based", 
        desc: "Entities of pure energy, they transcend physical limitations but struggle with material interaction.", 
        img: "assets/race_energy.png" 
    },
    { 
        id: "synthetic", 
        name: "Synthetic", 
        desc: "Artificial lifeforms capable of extreme efficiency and logic, unburdened by biological needs.", 
        img: "assets/race_synthetic.png" 
    }
];

export const HOMEWORLD_TYPES = [
    { 
        id: "Continental", 
        name: "Verdant Nexus", 
        desc: "Bio-luminescent flora and floating pollen clouds dominate the vibrant continents.", 
        img: "assets/planet_continental.png",
        glow: "rgba(0, 242, 255, 0.4)"
    },
    { 
        id: "Ocean", 
        name: "Abyssal Spires", 
        desc: "A world of crushing depths and massive crystal reefs that reach the surface through emerald tides.", 
        img: "assets/planet_ocean.png",
        glow: "rgba(0, 255, 180, 0.4)"
    },
    { 
        id: "Arctic", 
        name: "Crystal Tundra", 
        desc: "Frozen oceans of liquid methane and jagged ice-glass peaks that refract stellar light into prism-storms.", 
        img: "assets/planet_arctic.png",
        glow: "rgba(200, 230, 255, 0.5)"
    },
    { 
        id: "Desert", 
        name: "Obsidian Wastes", 
        desc: "Endless plains of volcanic glass and black sands, where silicon-based life thrives in the heat shimmer.", 
        img: "assets/planet_desert.png",
        glow: "rgba(255, 180, 50, 0.3)"
    },
    { 
        id: "Tomb", 
        name: "Shattered Cradle", 
        desc: "The fragmented remains of a precursor world, held together by ancient gravity anchors and ghostly energies.", 
        img: "assets/planet_tomb.png",
        glow: "rgba(100, 255, 100, 0.3)"
    },
    { 
        id: "Gas Giant", 
        name: "Aetheric Maelstrom", 
        desc: "Electric tempests swirl in neon atmospheric bands, hiding leviathan-class entities within the pressure.", 
        img: "assets/planet_gas_giant.png",
        glow: "rgba(180, 100, 255, 0.4)"
    },
    { 
        id: "Molten", 
        name: "Magma Forge", 
        desc: "A chaotic landscape of liquid iron rivers and tectonic plates that fracture like brittle glass.", 
        img: "assets/planet_molten.png",
        glow: "rgba(255, 80, 0, 0.5)"
    }
];

export const TRAITS = [
    { id: "resilient", name: "Resilient", cost: 1, desc: "Army Health +50%" },
    { id: "rapid_breeders", name: "Rapid Breeders", cost: 2, desc: "Growth Speed +10%" },
    { id: "psionic", name: "Psionic Potential", cost: 3, desc: "Research Speed +5%" },
    { id: "photosynthetic", name: "Photosynthetic", cost: 1, desc: "Uses Energy instead of Food" },
    { id: "toxic_adapted", name: "Toxic Adapted", cost: 1, desc: "Habitability +20%" }
];

export const ARCHETYPES = [
    {
        id: "standard",
        name: "Standard Empire",
        icon: "🏛️",
        desc: "Balanced civilization with conventional diplomacy and economy.",
        mechanic: "Balanced Growth",
        modifiers: { growth: 1.0, energy_upkeep: 0, food_upkeep: 1 }
    },
    {
        id: "hive_mind",
        name: "Hive Mind",
        icon: "🧠",
        desc: "A single consciousness controlling a swarm of drones.",
        mechanic: "Rapid Organic Growth",
        modifiers: { growth: 2.0, energy_upkeep: 0, food_upkeep: 1.5 }
    },
    {
        id: "machine",
        name: "Machine Intelligence",
        icon: "🤖",
        desc: "A network of efficient, unfeeling synthetic processors.",
        mechanic: "Powered by Energy",
        modifiers: { growth: 1.2, energy_upkeep: 1.0, food_upkeep: 0 }
    },
    {
        id: "megacorp",
        name: "Mega-Corporation",
        icon: "💰",
        desc: "A civilization run as a business, focused on trade and profit.",
        mechanic: "Economic Leverage",
        modifiers: { growth: 1.0, energy_upkeep: 0, food_upkeep: 1, energy_bonus: 0.2 }
    },
    {
        id: "nomadic",
        name: "Nomadic Fleet",
        icon: "🛸",
        desc: "A civilization that lives on flotillas, never staying in one place for long.",
        mechanic: "Mobile Civilization",
        modifiers: { growth: 0.8, energy_upkeep: 0.5, food_upkeep: 0.5, colony_cost_factor: 0.5 }
    },
    {
        id: "precursor",
        name: "Precursor Remnant",
        icon: "🏺",
        desc: "An ancient, stagnant civilization with superior starting technology.",
        mechanic: "Fallen Glory",
        modifiers: { growth: 0.1, energy_upkeep: 2.0, food_upkeep: 2.0, resource_bonus: 5 }
    },
    {
        id: "parasitic",
        name: "Parasitic Species",
        icon: "👾",
        desc: "Requires host organisms to thrive and expand.",
        mechanic: "Host Dependence",
        modifiers: { growth: 1.5, energy_upkeep: 0, food_upkeep: 0.2 }
    }
];

// Kept for legacy reference if needed, but UI will use ARCHETYPES
export const GOVERNMENT_TYPES = ARCHETYPES.map(a => a.name);

export const ETHICS_AXES = [
    { left: "Individualist", right: "Collectivist", id: "axis_ind_col" },
    { left: "Militarist", right: "Pacifist", id: "axis_mil_pac" },
    { left: "Materialist", right: "Spiritualist", id: "axis_mat_spi" },
    { left: "Xenophile", right: "Xenophobe", id: "axis_xen_pho" },
    { left: "Isolationist", right: "Expansionist", id: "axis_iso_exp" }
];

export const CIVICS = [
    { id: "philosopher_kings", name: "Philosopher Kings", icon: "👑", desc: "Leader XP +25%" },
    { id: "merchant_guilds", name: "Merchant Guilds", icon: "⚖️", desc: "Trade Income +10%" },
    { id: "warrior_caste", name: "Warrior Caste", icon: "⚔️", desc: "Army Cost -20%" },
    { id: "hive_network", name: "Hive Neural Network", icon: "🕸️", desc: "Replaces Happiness with Coherence", req: "Hive Mind" },
    { id: "digital_consciousness", name: "Digital Consciousness", icon: "💾", desc: "Leaders are immortal", req: "Machine Intelligence" },
    { id: "devouring_swarm", name: "Devouring Swarm", icon: "🌋", desc: "Total War capability", req: "Hive Mind" },
    { id: "determined_exterminator", name: "Determined Exterminator", icon: "🔫", desc: "Combat Bonus +25%", req: "Machine Intelligence" },
    { id: "private_prospectors", name: "Private Prospectors", icon: "🛠️", desc: "Colony Ships cost Energy", req: "Mega-Corporation" }
];