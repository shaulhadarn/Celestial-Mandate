/**
 * Random game events, event chains, and storylines.
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
    trade: `<rect x="3" y="7" width="7" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="7" width="7" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 10h4m-4 3h4" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>`,
    anomaly: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v4m0 4v2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
    ruins: `<path d="M4 20V8l4-5h8l4 5v12" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="20" x2="8" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5"/><line x1="12" y1="20" x2="12" y2="10" stroke="currentColor" stroke-width="1" opacity="0.5"/><line x1="16" y1="20" x2="16" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5"/><circle cx="12" cy="6" r="1.5" fill="currentColor" opacity="0.4"/>`,
    plague: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 4v5M12 15v5M4 12h5M15 12h5" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.2"/>`,
    politics: `<path d="M12 2v4M8 6l2 3M16 6l-2 3" stroke="currentColor" stroke-width="1.5"/><path d="M6 12h12M3 16l9-4 9 4M5 20h14" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="4" r="2" fill="currentColor" opacity="0.3"/>`,
    wormhole: `<ellipse cx="12" cy="12" rx="9" ry="9" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="6" ry="6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/><ellipse cx="12" cy="12" rx="3" ry="3" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
    nanite: `<circle cx="6" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="16" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="8" x2="18" y2="8" stroke="currentColor" stroke-width="1" opacity="0.5"/><line x1="6" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1" opacity="0.5"/><line x1="18" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1" opacity="0.5"/><circle cx="12" cy="8" r="1" fill="currentColor" opacity="0.4"/>`,
};

/* ── STANDALONE RANDOM EVENTS (30 total) ─────────────────────────────────── */

export const RANDOM_EVENTS = [
    // ── Existing events (rewritten) ────────────────────────────────────────
    {
        id: 'mineral_vein',
        image: 'assets/images/events/evt_mineral_vein.png',
        title: 'Rich Mineral Vein Discovered',
        desc: 'Deep-core geological surveys have revealed a mineral deposit of staggering proportions beneath one of our colony worlds. Preliminary scans indicate veins of rare-earth elements threading through kilometres of bedrock like the roots of some vast subterranean tree. The mining guilds are already mobilising, but our engineers warn that aggressive extraction could destabilise the tectonic plate above a major population centre.',
        category: 'opportunity',
        icon: ICONS.mining,
        choices: [
            { label: 'Extract aggressively', effect: { minerals: 200 } },
            { label: 'Careful, staged extraction', effect: { minerals: 100, energy: 50 } },
        ]
    },
    {
        id: 'solar_flare',
        image: 'assets/images/events/evt_solar_flare.png',
        title: 'Solar Flare Activity',
        desc: 'A series of coronal mass ejections from the local star has sent a wall of charged plasma hurtling toward our inner colonies. The energy grid is already fluctuating as the first wave strikes — transformers are overloading, and orbital stations have gone into emergency lockdown. Our engineers believe they can reconfigure the grid to harvest the excess radiation, but the window is narrow and the risk of catastrophic failure is real.',
        category: 'danger',
        icon: ICONS.solar,
        choices: [
            { label: 'Reconfigure and harness', effect: { energy: 150, minerals: -30 } },
            { label: 'Shield all infrastructure', effect: { energy: -50 } },
        ]
    },
    {
        id: 'alien_artifact',
        image: 'assets/images/events/evt_alien_artifact.png',
        title: 'Alien Artifact Found',
        desc: 'An exploration team working in the ruins of a long-dead world has unearthed an object of clearly artificial origin — and clearly not of any known design. It is warm to the touch despite the frozen vacuum around it, and it pulses with an inner light that shifts through colours that have no name in any language we speak. Our xenoarchaeologists are divided: some see a treasure beyond price, others a warning we should heed.',
        category: 'ancient',
        icon: ICONS.alien,
        choices: [
            { label: 'Study it in our labs', effect: { energy: 80, food: 40 } },
            { label: 'Sell to the traders', effect: { minerals: 150 } },
        ]
    },
    {
        id: 'food_surplus',
        image: 'assets/images/events/evt_food_surplus.png',
        title: 'Bountiful Harvest',
        desc: 'Something extraordinary has happened across our agricultural worlds. Solar conditions, soil chemistry, and atmospheric composition have aligned in a confluence so improbable that our scientists are calling it a "golden convergence." The harvest is beyond anything in recorded history — granaries overflow, preservation vaults are at capacity, and the scent of fresh grain fills the corridors of every colony ship in orbit.',
        category: 'opportunity',
        icon: ICONS.food,
        choices: [
            { label: 'Distribute to all colonies', effect: { food: 250 } },
            { label: 'Trade surplus for materials', effect: { food: 100, minerals: 80 } },
        ]
    },
    {
        id: 'pirate_raid',
        image: 'assets/images/events/evt_pirate_raid.png',
        title: 'Pirate Raid',
        desc: 'Long-range sensors have detected a flotilla of unmarked vessels converging on our trade routes — the Harvesters, a pirate confederation that has plagued this sector for decades. Their leader has broadcast a single demand: tribute in minerals and energy, or they will burn every freighter in the shipping lane. Our admirals counsel that we can fight them off, but the engagement will cost us dearly in energy and munitions.',
        category: 'danger',
        icon: ICONS.combat,
        choices: [
            { label: 'Pay the tribute', effect: { minerals: -80, energy: -40 } },
            { label: 'Engage and destroy', effect: { energy: -60 } },
        ]
    },
    {
        id: 'refugee_fleet',
        image: 'assets/images/events/evt_refugee_fleet.png',
        title: 'Refugee Fleet Arrives',
        desc: 'A vast fleet of battered, barely functional ships has appeared at the edge of our territory, broadcasting on all frequencies: they are the survivors of a civilization destroyed by a catastrophe they cannot — or will not — name. Millions of souls crowd their failing vessels, and they beg for sanctuary. Accepting them will strain our food reserves, but they bring with them knowledge, labour, and technologies we have never seen.',
        category: 'diplomacy',
        icon: ICONS.diplomacy,
        choices: [
            { label: 'Welcome them all', effect: { food: -100, minerals: 60, energy: 40 } },
            { label: 'Turn them away', effect: {} },
        ]
    },
    {
        id: 'tech_breakthrough',
        image: 'assets/images/events/evt_tech_breakthrough.png',
        title: 'Scientific Breakthrough',
        desc: 'A team of researchers working in an underfunded laboratory on the fringes of the empire has made a discovery that is sending shockwaves through the scientific community. They have found a new principle of energy conversion that contradicts decades of established theory — and it works. The implications are staggering: more efficient reactors, cheaper production, and applications we cannot yet imagine.',
        category: 'discovery',
        icon: ICONS.science,
        choices: [
            { label: 'Apply to energy grid', effect: { energy: 200 } },
            { label: 'Publish across all fields', effect: { energy: 60, minerals: 60, food: 60 } },
        ]
    },
    {
        id: 'asteroid_impact',
        image: 'assets/images/events/evt_asteroid_impact.png',
        title: 'Asteroid Detected',
        desc: 'A rogue asteroid the size of a small moon has been detected on a collision course with one of our colony worlds. Impact is estimated in days, not weeks. The asteroid is rich in heavy metals — a fortune in minerals — but its trajectory will carry it through the heart of our most productive agricultural zone. We must decide: deflect it at enormous energy cost, or attempt the dangerous gambit of mining it in transit.',
        category: 'danger',
        icon: ICONS.asteroid,
        choices: [
            { label: 'Deflect it safely', effect: { energy: -100 } },
            { label: 'Risk mining it in transit', effect: { minerals: 180, energy: -50 } },
        ]
    },
    {
        id: 'trade_caravan',
        image: 'assets/images/events/evt_trade_caravan.png',
        title: 'Trade Caravan',
        desc: 'An interstellar trade caravan bearing the sigils of the Merchants\' Guild has dropped out of hyperspace near our capital system. Their holds are full of goods from a hundred worlds — exotic minerals, alien foodstuffs, and technologies that shimmer with unfamiliar energies. The caravan master offers fair prices, but warns that the Guild remembers those who turn them away.',
        category: 'diplomacy',
        icon: ICONS.trade,
        choices: [
            { label: 'Buy rare minerals', effect: { energy: -80, minerals: 150 } },
            { label: 'Buy alien foodstuffs', effect: { energy: -60, food: 180 } },
            { label: 'Politely decline', effect: {} },
        ]
    },
    {
        id: 'energy_anomaly',
        image: 'assets/images/events/evt_energy_anomaly.png',
        title: 'Energy Anomaly',
        desc: 'Deep-space telescopes have detected an impossible reading: a concentrated energy signature emanating from a region of space that should be empty. It pulses with a rhythm that our computers insist is non-random, as if something — or someone — is broadcasting. The signal is ancient beyond reckoning, its wavelength shifted by billions of years of cosmic expansion. Whatever is out there has been calling for a very, very long time.',
        category: 'discovery',
        icon: ICONS.anomaly,
        choices: [
            { label: 'Send a probe to investigate', effect: { energy: 120, minerals: 30 } },
            { label: 'Log it and move on', effect: {} },
        ]
    },

    // ── New events ─────────────────────────────────────────────────────────
    {
        id: 'void_whispers',
        image: 'assets/images/events/evt_void_whispers.png',
        title: 'Whispers from the Void',
        desc: 'Communications arrays across the empire have begun picking up faint, repeating transmissions from deep interstellar space. The signals are encoded in a mathematical language of breathtaking complexity — one that predates every known civilization by millions of years. Linguists and mathematicians work in shifts to decode the patterns, and what little they have translated speaks of a warning: something ancient sleeps in the dark between stars, and it is beginning to stir.',
        category: 'ancient',
        icon: ICONS.ruins,
        choices: [
            { label: 'Dedicate resources to decoding', effect: { energy: -60, minerals: 80 } },
            { label: 'Increase sensor range', effect: { energy: -40 } },
            { label: 'Ignore the transmissions', effect: {} },
        ]
    },
    {
        id: 'derelict_leviathan',
        image: 'assets/images/events/evt_derelict_leviathan.png',
        title: 'The Derelict Leviathan',
        desc: 'A patrol fleet has discovered the wreck of a starship so vast it dwarfs anything in our records — eight kilometres from bow to stern, its hull composed of alloys our metallurgists cannot identify. The vessel is dead, its crew gone for aeons, but its reactors still emit a faint thermal signature. Salvage teams could extract technologies centuries ahead of our own, but there are those who argue that some tombs should remain sealed.',
        category: 'ancient',
        icon: ICONS.ruins,
        choices: [
            { label: 'Full salvage operation', effect: { minerals: 200, energy: -80 } },
            { label: 'Cautious survey only', effect: { minerals: 60 } },
        ]
    },
    {
        id: 'precursor_data_core',
        image: 'assets/images/events/evt_precursor_data_core.png',
        title: 'Precursor Data Core',
        desc: 'Deep within an asteroid field, a survey drone has detected a structure of unmistakable artificial origin — a data storage device the size of a building, its crystalline matrices still humming with information after untold millennia. The data within could represent the accumulated knowledge of a civilisation far more advanced than our own. The question is not whether we can access it, but whether we should. Every precursor archive ever opened has changed the civilisation that opened it. Not always for the better.',
        category: 'ancient',
        icon: ICONS.ruins,
        choices: [
            { label: 'Decrypt and download everything', effect: { energy: -100, minerals: 100, food: 80 } },
            { label: 'Extract only safe data', effect: { energy: -30, minerals: 40 } },
        ]
    },
    {
        id: 'stellar_nursery',
        image: 'assets/images/events/evt_stellar_nursery.png',
        title: 'Stellar Nursery Bloom',
        desc: 'A nearby nebula has begun collapsing — not in the slow geological timescale we expected, but with terrifying, beautiful speed. New stars are being born in cascades of light and radiation that paint the void in colours our sensors can barely process. The energy output is immense and largely unharnessed. Our scientists propose building collection arrays in the nebula\'s outer reaches, though the radiation makes any operation there inherently dangerous.',
        category: 'discovery',
        icon: ICONS.solar,
        choices: [
            { label: 'Build energy collectors', effect: { energy: 180, minerals: -60 } },
            { label: 'Study the phenomenon', effect: { energy: 40, food: 40 } },
        ]
    },
    {
        id: 'dark_matter_cascade',
        image: 'assets/images/events/evt_dark_matter_cascade.png',
        title: 'Dark Matter Cascade',
        desc: 'Something has gone terribly wrong in the fabric of space near one of our colony systems. A cascade of dark matter interactions is destabilising the local hyperlane network, making FTL travel unpredictable and dangerous. Ships that enter the affected lanes emerge at random coordinates — or do not emerge at all. Our physicists believe they can stabilise the cascade, but the energy cost will be punishing.',
        category: 'danger',
        icon: ICONS.wormhole,
        choices: [
            { label: 'Stabilise with massive energy', effect: { energy: -150 } },
            { label: 'Reroute trade lanes (costly)', effect: { minerals: -100 } },
        ]
    },
    {
        id: 'silent_armada',
        image: 'assets/images/events/evt_silent_armada.png',
        title: 'The Silent Armada',
        desc: 'An armada of unknown origin has appeared at the edge of our territory. Hundreds of vessels hang motionless in the void, their hulls dark and unmarked, their drives cold. They do not respond to hails. They do not move. They simply watch, their presence a question without words. Our admirals are divided: some see an invasion fleet waiting for the signal to attack, others see refugees too traumatised to speak. The silence stretches, heavy with implication.',
        category: 'diplomacy',
        icon: ICONS.diplomacy,
        choices: [
            { label: 'Send an envoy ship', effect: { energy: -30, food: 80 } },
            { label: 'Deploy a defensive screen', effect: { energy: -60 } },
            { label: 'Wait and observe', effect: {} },
        ]
    },
    {
        id: 'colony_dissent',
        image: 'assets/images/events/evt_colony_dissent.png',
        title: 'Colony Dissent',
        desc: 'The governor of our most distant colony has transmitted a formal declaration of grievances. They claim the central administration has neglected their needs, diverted their resources to core worlds, and treated their population as expendable labourers rather than equal citizens. The declaration stops short of demanding independence, but the implication is unmistakable. If we do not act, this spark of discontent could ignite a fire across every frontier world.',
        category: 'crisis',
        icon: ICONS.politics,
        choices: [
            { label: 'Send aid and concessions', effect: { food: -80, energy: -40, minerals: 60 } },
            { label: 'Assert central authority', effect: { energy: -30 } },
        ]
    },
    {
        id: 'genetic_question',
        title: 'The Genetic Question',
        desc: 'A controversial proposal has reached the highest levels of our scientific council: a genetic modification programme that could dramatically increase the productivity and resilience of our population. The science is sound, but the ethics are fiercely debated. Proponents argue it is the natural next step of evolution; opponents call it a betrayal of our species\' identity. The decision will define who we are as a civilisation for generations to come.',
        category: 'crisis',
        icon: ICONS.science,
        choices: [
            { label: 'Approve the programme', effect: { food: 100, energy: -60 } },
            { label: 'Fund ethical alternatives', effect: { energy: -40, minerals: -30 } },
            { label: 'Ban the research', effect: {} },
        ]
    },
    {
        id: 'plague_ship',
        title: 'Plague Ship',
        desc: 'A merchant vessel has staggered into port broadcasting an automated quarantine warning. Its crew is dead or dying, consumed by a pathogen that does not match any known biological agent. The ship\'s cargo hold contains medical supplies desperately needed by our colonies — but the contagion may have already spread to the goods. Burn the ship and lose the cargo, or risk unleashing a plague across our worlds.',
        category: 'danger',
        icon: ICONS.plague,
        choices: [
            { label: 'Quarantine and decontaminate', effect: { energy: -80, food: 60 } },
            { label: 'Destroy the vessel', effect: { minerals: -40 } },
        ]
    },
    {
        id: 'wormhole_tremor',
        title: 'Wormhole Tremor',
        desc: 'Space itself has torn open near the outer reaches of our territory. A wormhole — unstable, shimmering, and impossible according to current physics — has manifested without warning. Probes sent through return with sensor data from a star system thousands of light-years away, rich with untouched resources. But the wormhole pulses erratically, its edges fraying. It could close at any moment, stranding anyone we send through on the other side of the galaxy.',
        category: 'discovery',
        icon: ICONS.wormhole,
        choices: [
            { label: 'Send an expedition through', effect: { energy: -60, minerals: 160 } },
            { label: 'Study from a safe distance', effect: { energy: 60 } },
        ]
    },
    {
        id: 'diplomats_gambit',
        title: 'The Diplomat\'s Gambit',
        desc: 'A foreign envoy has arrived unannounced at our capital, bearing gifts of rare minerals and a proposal wrapped in silk and hidden daggers. They represent a distant power that seeks an alliance against a mutual threat — but the terms are suspiciously generous. Our intelligence services warn that the envoy\'s true purpose may be to map our defences under the guise of friendship. Trust is a commodity in shorter supply than any mineral.',
        category: 'diplomacy',
        icon: ICONS.diplomacy,
        choices: [
            { label: 'Accept the alliance', effect: { minerals: 120, energy: 40 } },
            { label: 'Decline gracefully', effect: { energy: 20 } },
        ]
    },
    {
        id: 'nanite_outbreak',
        title: 'Nanite Swarm Outbreak',
        desc: 'A cloud of self-replicating nanomachines has escaped containment in one of our research facilities and is consuming everything in its path — metal, rock, organic matter — converting it all into more of itself. The swarm is spreading across the colony surface at an alarming rate, and conventional weapons are useless against something that rebuilds itself faster than it can be destroyed. Our engineers have a plan to disrupt the swarm\'s replication signal, but it requires diverting enormous energy reserves.',
        category: 'danger',
        icon: ICONS.nanite,
        choices: [
            { label: 'Disrupt the signal (costly)', effect: { energy: -120, minerals: 80 } },
            { label: 'Evacuate and quarantine', effect: { food: -60, minerals: -40 } },
        ]
    },
    {
        id: 'archaeological_expedition',
        title: 'Archaeological Expedition',
        desc: 'Construction teams on one of our colony worlds have broken through into a vast subterranean complex that predates any known civilisation. The halls are kilometres long, lined with crystalline pillars that still glow with a faint bioluminescence. At the complex\'s heart lies what can only be described as a throne room — and on the throne, a figure carved from the same crystal, frozen in an expression of infinite patience. The expedition leader reports that the deeper they go, the warmer the crystals become.',
        category: 'ancient',
        icon: ICONS.ruins,
        choices: [
            { label: 'Fund a full expedition', effect: { energy: -80, minerals: 140 } },
            { label: 'Seal and protect the site', effect: { minerals: 30 } },
        ]
    },
    {
        id: 'subspace_echo',
        title: 'Subspace Echo',
        desc: 'Our communications network has received a message that should not exist. It arrives through subspace channels from coordinates that correspond to empty, surveyed space — a region we have confirmed contains nothing but void. The message is in our own language, uses our own encryption protocols, and is dated three hundred years in the future. It contains a single set of coordinates and four words: "Do not come here."',
        category: 'discovery',
        icon: ICONS.anomaly,
        choices: [
            { label: 'Investigate the coordinates', effect: { energy: -50, minerals: 100 } },
            { label: 'Heed the warning', effect: { energy: 40 } },
        ]
    },
    {
        id: 'frontier_mutiny',
        title: 'Mutiny on the Frontier',
        desc: 'A fleet stationed at the empire\'s edge has declared mutiny. The officers claim they were ordered to abandon a colony under alien attack — an order they refused to carry out. Now they sit in defiant orbit above the world they saved, their guns trained on any vessel that approaches. The mutineers are heroes to the colonists and traitors to the admiralty. How we handle this will determine whether our military holds together or fractures along fault lines of conscience.',
        category: 'crisis',
        icon: ICONS.politics,
        choices: [
            { label: 'Pardon and reinstate them', effect: { energy: -40, food: 60 } },
            { label: 'Negotiate surrender', effect: { energy: -20 } },
        ]
    },
    {
        id: 'merchant_prince',
        title: 'The Merchant Prince',
        desc: 'A trader of legendary reputation has arrived in our space, commanding a vessel that is part warship, part treasure vault, and part mobile bazaar. Known only as the Merchant Prince, this enigmatic figure claims to have traded with civilisations that no longer exist and to possess goods from across the galaxy. The prices are steep, but those who have dealt with the Prince before whisper that the investments always pay off — eventually.',
        category: 'diplomacy',
        icon: ICONS.trade,
        choices: [
            { label: 'Buy exclusive goods', effect: { energy: -100, minerals: 100, food: 80 } },
            { label: 'Offer a trade partnership', effect: { energy: 40, minerals: 40 } },
        ]
    },
    {
        id: 'gravity_anomaly',
        title: 'Gravity Well Anomaly',
        desc: 'An inexplicable gravitational anomaly has manifested in one of our outer systems — a point in empty space that bends light and pulls at nearby objects with the force of a planetary body, yet registers as containing no mass whatsoever. Our physicists are simultaneously terrified and exhilarated. Early theories suggest it may be an artificial construct — a gravity generator built by a civilisation capable of engineering spacetime itself. The anomaly is stable for now, but who can say what happens when it isn\'t?',
        category: 'discovery',
        icon: ICONS.wormhole,
        choices: [
            { label: 'Construct a research station', effect: { energy: -70, minerals: -50, food: 120 } },
            { label: 'Observe remotely', effect: { energy: 50 } },
        ]
    },
    {
        id: 'separatist_movement',
        title: 'Separatist Movement',
        desc: 'A coalition of frontier colonies has formed a political movement calling itself the Free Stars Alliance, demanding self-governance and the right to conduct independent trade with alien civilisations. Their leader, a charismatic ex-governor, has published a manifesto that is spreading like wildfire through the imperial networks. The movement is peaceful — for now — but our intelligence services report that weapons are being stockpiled in hidden caches across the frontier.',
        category: 'crisis',
        icon: ICONS.politics,
        choices: [
            { label: 'Grant limited autonomy', effect: { energy: -50, food: -40, minerals: 80 } },
            { label: 'Crack down firmly', effect: { energy: -80 } },
        ]
    },
    {
        id: 'crystalline_bloom',
        title: 'Crystalline Bloom',
        desc: 'Across the surface of one of our colony worlds, crystals have begun growing — erupting from the soil in pillars of impossible beauty, spreading across plains and mountains in a slow, inexorable tide. They pulse with light and emit harmonic frequencies that our sensors interpret as structured data. Our xenobiologists believe these are a form of silicon-based life, and they are growing at an accelerating rate. If this is life, it may be the most alien form of intelligence we have ever encountered.',
        category: 'discovery',
        icon: ICONS.anomaly,
        choices: [
            { label: 'Attempt to communicate', effect: { energy: -40, food: 60, minerals: 60 } },
            { label: 'Harvest the crystals', effect: { minerals: 150 } },
        ]
    },
    {
        id: 'last_transmission',
        title: 'The Last Transmission',
        desc: 'A deep-space relay has captured a transmission so old that it predates the formation of our star. The signal is degraded almost beyond recovery, but our most advanced algorithms have reconstructed fragments: a voice, speaking in a language that resonates with something primal and ancient, describing the fall of a civilisation that spanned the galaxy. The final words, translated with uncertain accuracy, read: "We built too high. We reached too far. Remember us, and do not follow."',
        category: 'ancient',
        icon: ICONS.ruins,
        choices: [
            { label: 'Archive and study the warning', effect: { energy: 40, minerals: 40 } },
            { label: 'Broadcast a response', effect: { energy: -60, food: 80 } },
        ]
    },
];


/* ── EVENT CHAINS ───────────────────────────────────────────────────────── */

export const EVENT_CHAINS = {
    precursor_signal: {
        id: 'precursor_signal',
        title: 'The Precursor Signal',
        steps: [
            {
                id: 'precursor_signal_1',
                title: 'Unknown Signal Detected',
                desc: 'A deep-space listening post has detected a signal unlike anything in our databases — a precise, repeating mathematical sequence broadcasting from a region of space marked as empty on every chart we possess. The signal is old. Impossibly old. Our astrophysicists estimate it has been repeating for at least forty thousand years, patient and unwavering, waiting for someone with the technology to hear it. The question is not whether to investigate, but whether we are ready for what we might find.',
                category: 'ancient',
                icon: ICONS.anomaly,
                choices: [
                    { label: 'Investigate the source', effect: { energy: -60 }, nextStep: 'precursor_signal_2', delay: [40, 70] },
                    { label: 'Log and continue monitoring', effect: {}, nextStep: null },
                ]
            },
            {
                id: 'precursor_signal_2',
                title: 'The Precursor Beacon',
                desc: 'Our expedition has found the source: a beacon of extraordinary sophistication, orbiting a dead star in a system that has no business containing artificial structures. The beacon is constructed from materials that do not appear on the periodic table — alloys that are warm to the touch and seem to repair themselves when damaged. As our teams approach, the signal changes. It is no longer repeating. It is responding.',
                category: 'ancient',
                icon: ICONS.ruins,
                choices: [
                    { label: 'Attempt to interface with it', effect: { energy: -80 }, nextStep: 'precursor_signal_3', delay: [35, 60] },
                    { label: 'Observe from a distance', effect: { energy: -20 }, nextStep: 'precursor_signal_3', delay: [50, 80] },
                ]
            },
            {
                id: 'precursor_signal_3',
                title: 'The Archive Unsealed',
                desc: 'The beacon has opened. Inside, suspended in a lattice of crystalline data storage, lies the accumulated knowledge of a civilisation that mastered the galaxy when our ancestors were still learning to use fire. The archive contains star charts of systems that have since burned out, technical schematics that make our most advanced technology look primitive, and — most troubling — a detailed account of why they disappeared. The knowledge is transformative. It is also, perhaps, dangerous.',
                category: 'ancient',
                icon: ICONS.ruins,
                choices: [
                    { label: 'Download everything', effect: { energy: 120, minerals: 100 }, nextStep: 'precursor_signal_4', delay: [30, 50] },
                    { label: 'Take only what we can understand', effect: { energy: 60, minerals: 40 }, nextStep: 'precursor_signal_4', delay: [30, 50] },
                ]
            },
            {
                id: 'precursor_signal_4',
                title: 'The Architects\' Legacy',
                desc: 'The full scope of the Architects\' knowledge is now clear. They were a civilisation that transcended biology, merged with their machines, and reshaped stars — and in the end, they chose to leave. Not because they failed, but because they decided that the galaxy belonged to those who would come after. The archive contains a gift: the blueprints for technologies that could accelerate our civilisation by centuries. But it also contains a choice: share the knowledge with the galaxy, or keep it for ourselves.',
                category: 'ancient',
                icon: ICONS.ruins,
                choices: [
                    { label: 'Share with all civilisations', effect: { energy: 80, food: 80, minerals: 80 }, nextStep: null },
                    { label: 'Keep it for our empire alone', effect: { energy: 200, minerals: 200 }, nextStep: null },
                ]
            },
        ]
    },

    void_plague: {
        id: 'void_plague',
        title: 'The Void Plague',
        steps: [
            {
                id: 'void_plague_1',
                title: 'Patient Zero',
                desc: 'Medical officers on one of our frontier colonies have reported an outbreak of an unknown pathogen. Patients present with bioluminescent veins and a progressive loss of motor control, followed by a strange serenity that the infected describe as "hearing the void." The disease does not match any known biological agent, and it is spreading faster than our quarantine protocols can contain. Our epidemiologists are working around the clock, but they are afraid.',
                category: 'danger',
                icon: ICONS.plague,
                choices: [
                    { label: 'Quarantine the colony', effect: { energy: -40 }, nextStep: 'void_plague_2', delay: [35, 55] },
                    { label: 'Rush medical resources there', effect: { food: -60, energy: -30 }, nextStep: 'void_plague_2', delay: [30, 50] },
                ]
            },
            {
                id: 'void_plague_2',
                title: 'The Spreading Dark',
                desc: 'Despite our efforts, the plague has spread. Three more colonies report cases, and a military transport ship has been found drifting with its entire crew infected. The bioluminescence has intensified — the infected glow in the dark, their veins tracing patterns that our computers recognise as mathematical fractals of extraordinary complexity. They are calm, even blissful, but they are no longer entirely themselves. The plague is not just a disease. It is a transformation.',
                category: 'danger',
                icon: ICONS.plague,
                choices: [
                    { label: 'Impose empire-wide quarantine', effect: { energy: -80, food: -40 }, nextStep: 'void_plague_3', delay: [30, 50] },
                    { label: 'Focus all research on a cure', effect: { energy: -60 }, nextStep: 'void_plague_3', delay: [35, 55] },
                ]
            },
            {
                id: 'void_plague_3',
                title: 'Origin Point',
                desc: 'A breakthrough. Our xenobiologists have traced the pathogen to alien spores drifting through the void between stars — ancient biological material, possibly millions of years old, that was activated when it came into contact with the warmth of our colony atmospheres. The spores are not random. They were designed — engineered by an intelligence that understood biology at a level we are only beginning to comprehend. A cure is possible, but it will require enormous resources.',
                category: 'danger',
                icon: ICONS.plague,
                choices: [
                    { label: 'Develop a cure at any cost', effect: { energy: -120, minerals: -60 }, nextStep: 'void_plague_4', delay: [25, 40] },
                    { label: 'Permanent quarantine zones', effect: { food: -80 }, nextStep: 'void_plague_4', delay: [25, 40] },
                ]
            },
            {
                id: 'void_plague_4',
                title: 'Aftermath',
                desc: 'The crisis has passed — but its scars remain. Whether through cure or quarantine, the plague has been contained. The infected who were cured retain fragments of what they experienced: visions of vast, dark spaces between galaxies, and a presence that watched them with something that felt like curiosity. Our scientists now believe the spores were a form of communication — a message written in biology rather than language. The question of who sent it, and why, may never be answered.',
                category: 'discovery',
                icon: ICONS.science,
                choices: [
                    { label: 'Study the spore specimens', effect: { energy: 100, food: 60 }, nextStep: null },
                    { label: 'Destroy all samples', effect: { food: 40 }, nextStep: null },
                ]
            },
        ]
    },

    first_contact: {
        id: 'first_contact',
        title: 'First Contact Protocol',
        steps: [
            {
                id: 'first_contact_1',
                title: 'The Alien Probe',
                desc: 'An object has entered our territory that is clearly artificial and clearly not ours. It is small — no larger than a shuttle — and it moves with a grace that suggests propulsion technology far beyond our own. It does not respond to hails, but neither does it evade. It simply observes, its sensors sweeping our systems with methodical precision. We are being studied, measured, and catalogued by an intelligence that has not yet decided whether we are worth talking to.',
                category: 'diplomacy',
                icon: ICONS.alien,
                choices: [
                    { label: 'Attempt communication', effect: { energy: -30 }, nextStep: 'first_contact_2', delay: [35, 60] },
                    { label: 'Capture the probe', effect: { energy: -50 }, nextStep: 'first_contact_2', delay: [30, 50] },
                ]
            },
            {
                id: 'first_contact_2',
                title: 'The Response',
                desc: 'They have answered. Whether through our communication attempts or in response to our actions, the intelligence behind the probe has made contact. A transmission arrives in a format clearly designed to be decoded by any sufficiently advanced civilisation: mathematical constants, followed by simple pictographic exchanges. They are learning our language in real time, with a speed that is both impressive and unsettling. After seventy-two hours of exchange, the first complete sentence arrives: "We have been watching you for longer than you know. We wish to meet."',
                category: 'diplomacy',
                icon: ICONS.alien,
                choices: [
                    { label: 'Agree to a meeting', effect: { energy: -40 }, nextStep: 'first_contact_3', delay: [30, 50] },
                    { label: 'Proceed with extreme caution', effect: { energy: -20 }, nextStep: 'first_contact_3', delay: [40, 65] },
                ]
            },
            {
                id: 'first_contact_3',
                title: 'The Overture',
                desc: 'They come in a vessel of breathtaking elegance — a ship that seems grown rather than built, its hull alive with shifting colours. The beings inside are unlike anything we have imagined: neither hostile nor passive, but genuinely curious. They offer us a choice, as they have offered every civilisation they have contacted: a trade agreement that will bring prosperity and knowledge, in exchange for the one thing they value above all else — our stories, our art, our music. They are collectors of culture, and they find us fascinating.',
                category: 'diplomacy',
                icon: ICONS.alien,
                choices: [
                    { label: 'Embrace full cultural exchange', effect: { energy: 120, food: 100, minerals: 80 }, nextStep: null },
                    { label: 'Limited trade only', effect: { minerals: 100, energy: 40 }, nextStep: null },
                ]
            },
        ]
    },

    exile_fleet: {
        id: 'exile_fleet',
        title: 'The Exile Fleet',
        steps: [
            {
                id: 'exile_fleet_1',
                title: 'The Exodus Arrives',
                desc: 'They come in their thousands — battered ships of a hundred different designs, lashed together with emergency tethers and held aloft by engines that should have failed long ago. The Exile Fleet carries the remnants of not one, but several civilisations destroyed by a cataclysm they call the Burning — an event they will not describe except in whispers. They number in the millions, and they have nowhere else to go. They ask for sanctuary, and they ask with the desperate dignity of those who have lost everything.',
                category: 'diplomacy',
                icon: ICONS.diplomacy,
                choices: [
                    { label: 'Grant full sanctuary', effect: { food: -120, energy: -40 }, nextStep: 'exile_fleet_2', delay: [35, 55] },
                    { label: 'Offer limited aid', effect: { food: -50 }, nextStep: 'exile_fleet_2', delay: [40, 65] },
                ]
            },
            {
                id: 'exile_fleet_2',
                title: 'The Integration Debate',
                desc: 'The presence of millions of refugees has ignited a fierce debate across our empire. Those on the frontier welcome the newcomers — their skills, their labour, their alien perspectives on problems we have struggled with for decades. But the core worlds are uneasy. Resources are strained, cultural tensions simmer, and there are those who whisper that the exiles brought the Burning with them — that whatever destroyed their worlds might follow them to ours.',
                category: 'crisis',
                icon: ICONS.politics,
                choices: [
                    { label: 'Push for full integration', effect: { food: -60, energy: 40, minerals: 60 }, nextStep: 'exile_fleet_3', delay: [30, 50] },
                    { label: 'Establish separate settlements', effect: { food: -30 }, nextStep: 'exile_fleet_3', delay: [35, 55] },
                ]
            },
            {
                id: 'exile_fleet_3',
                title: 'A New Chapter',
                desc: 'Months have passed, and the exiles have begun to find their place. Their engineers have introduced techniques that have improved our mining efficiency. Their scientists have shared knowledge from civilisations we never knew existed. Their children play with ours in the corridors of colony ships and the parks of frontier worlds. The integration has not been without cost or conflict, but something new is being born — a civilisation enriched by the best of many worlds.',
                category: 'diplomacy',
                icon: ICONS.diplomacy,
                choices: [
                    { label: 'Celebrate the union', effect: { food: 80, minerals: 80, energy: 80 }, nextStep: null },
                    { label: 'Stay vigilant', effect: { energy: 60, minerals: 40 }, nextStep: null },
                ]
            },
        ]
    },

    echoes_of_architects: {
        id: 'echoes_of_architects',
        title: 'Echoes of the Architects',
        steps: [
            {
                id: 'echoes_1',
                title: 'The Buried City',
                desc: 'Seismic surveys on a remote colony world have revealed something that should not exist: a city, buried beneath three kilometres of sedimentary rock, its structures impossibly preserved. The architecture is unlike anything in our records — vaulted chambers carved from a single piece of crystalline material, corridors that curve according to mathematical principles we do not understand, and at the city\'s centre, a tower that still emits a faint energy signature. Someone built this city, lived in it, and left it here for us to find.',
                category: 'ancient',
                icon: ICONS.ruins,
                choices: [
                    { label: 'Excavate immediately', effect: { energy: -60, minerals: -40 }, nextStep: 'echoes_2', delay: [35, 60] },
                    { label: 'Careful archaeological survey', effect: { energy: -30 }, nextStep: 'echoes_2', delay: [45, 70] },
                ]
            },
            {
                id: 'echoes_2',
                title: 'The Living Halls',
                desc: 'The deeper we dig, the more the ruins come alive. Lights flicker on in corridors that have been dark for millennia. Machinery hums to life as if waking from a long sleep. The walls are covered in a script that our linguists cannot read but our computers recognise as containing compressed data of extraordinary density — each symbol encodes the information equivalent of an entire library. And in the lowest chambers, we find them: stasis pods, hundreds of them, their occupants long turned to dust. All except one.',
                category: 'ancient',
                icon: ICONS.ruins,
                choices: [
                    { label: 'Open the surviving pod', effect: { energy: -50 }, nextStep: 'echoes_3', delay: [30, 50] },
                    { label: 'Study without opening', effect: { energy: -20, minerals: 40 }, nextStep: 'echoes_3', delay: [40, 60] },
                ]
            },
            {
                id: 'echoes_3',
                title: 'The Awakening',
                desc: 'It is not a biological being. It is an artificial intelligence — the last surviving consciousness of the civilisation that built this city. It calls itself the Custodian, and it has been waiting. Not for rescue, but for a civilisation advanced enough to understand its purpose. The Custodian offers a choice: it can merge with our neural networks, granting us access to technologies that could reshape our empire, or it can share its knowledge more slowly, teaching us as a mentor rather than a tool.',
                category: 'ancient',
                icon: ICONS.science,
                choices: [
                    { label: 'Allow the neural merge', effect: { energy: -80 }, nextStep: 'echoes_4', delay: [25, 40] },
                    { label: 'Accept it as a mentor', effect: { energy: -30 }, nextStep: 'echoes_4', delay: [30, 50] },
                ]
            },
            {
                id: 'echoes_4',
                title: 'Legacy of the Architects',
                desc: 'The Custodian has fulfilled its purpose. Whether through merger or mentorship, the knowledge of the Architects flows into our civilisation like water into parched earth. We understand now why they left: not from failure or despair, but from a belief that the galaxy is a garden, and every civilisation that grows within it deserves the chance to bloom in its own way. The Custodian\'s final message is simple: "Build well. The stars are patient, but they are not eternal."',
                category: 'ancient',
                icon: ICONS.ruins,
                choices: [
                    { label: 'Honor the Architects\' legacy', effect: { energy: 150, minerals: 150, food: 100 }, nextStep: null },
                    { label: 'Archive and move forward', effect: { energy: 100, minerals: 100 }, nextStep: null },
                ]
            },
        ]
    },
};

/** Preload all event images lazily in the background so they're cached when needed */
export function preloadEventImages() {
    const urls = new Set();
    for (const evt of RANDOM_EVENTS) {
        if (evt.image) urls.add(evt.image);
    }
    for (const chain of Object.values(EVENT_CHAINS)) {
        for (const step of chain.steps || []) {
            if (step.image) urls.add(step.image);
        }
    }
    // Stagger loads so we don't hammer the network on startup
    let delay = 2000;
    for (const url of urls) {
        setTimeout(() => {
            const img = new Image();
            img.src = url;
        }, delay);
        delay += 150;
    }
}
