/* ═══════════════════════════════════════════════════════════════════════════
   GALACTIC CODEX — Lore Entries
   ═══════════════════════════════════════════════════════════════════════════ */

export const CODEX_CATEGORIES = [
    'History',
    'Species',
    'Technology',
    'Anomalies',
    'Factions',
    'Locations',
];

export const CODEX_ENTRIES = [

    /* ─── History ──────────────────────────────────────────────────────────── */

    {
        id: 'age_of_silence',
        category: 'History',
        title: 'The Age of Silence',
        unlockCondition: 'game-start',
        body: `Before humanity reached for the stars, the galaxy was quiet — not empty, but silent. Billions of years of stellar evolution had birthed and extinguished civilizations that left behind only ruins and riddles. The periods between these civilizations are known collectively as the Age of Silence, a span of cosmic time in which the galaxy belonged to no one.

Archaeologists and xenohistorians have pieced together fragments of this era from precursor artifacts scattered across thousands of systems. What they found was unsettling: evidence of at least seven distinct spacefaring civilizations, each of which rose to galactic prominence and then vanished without clear explanation. The gaps between them stretch for millions of years.

The Age of Silence ended — or perhaps merely paused — when the first human colony ship crossed beyond the Sol system's Oort cloud and established contact with the wider galaxy. Whether humanity will join the long procession of forgotten empires or break the cycle remains the central question of our age.`,
    },

    {
        id: 'great_expansion',
        category: 'History',
        title: 'The Great Expansion',
        unlockCondition: 'milestone:first_colony',
        body: `The Great Expansion refers to the explosive period of human colonization that followed the perfection of sustained faster-than-light travel. Within three generations, humanity went from a single-system species to a sprawling interstellar civilization with footholds in dozens of star systems.

The early expansion was chaotic. Colony ships launched by competing national blocs, corporate consortiums, and ideological movements scattered across the galactic arm with little coordination. Some colonies thrived; others vanished without a trace. Communication delays of weeks or months meant that each world effectively governed itself, leading to a patchwork of cultures, governments, and even divergent human subspecies adapted to alien environments.

It was during this era that humanity first encountered the ruins of the Architects and realized that the galaxy had been shaped — deliberately — by forces far older and more powerful than anything in human experience. The discovery sent shockwaves through colonial society and ultimately led to the founding of the Celestial Mandate.`,
    },

    {
        id: 'the_architects',
        category: 'History',
        title: 'The Architects',
        unlockCondition: 'event:precursor_signal_1',
        body: `The Architects — named for the impossibly precise engineering of their surviving structures — are the most recent of the galaxy's vanished precursor civilizations. They disappeared approximately 2.3 million years ago, leaving behind a network of artifacts, installations, and modified stellar objects that continue to function to this day.

What sets the Architects apart from earlier precursors is the scale and intentionality of their works. They did not merely colonize star systems — they reshaped them. Binary stars locked into mathematically perfect orbits. Asteroid belts arranged into data storage lattices. Entire planets hollowed out and repurposed as computational engines. Their engineering transcended material science and entered the realm of what some researchers call "cosmic architecture."

No remains of the Architects themselves have ever been found. No bodies, no biological samples, no DNA. Only their machines endure, patient and silent, waiting for inputs that stopped coming two million years ago. The leading theory — and the most disturbing one — is that the Architects did not die. They simply became something else.`,
    },

    {
        id: 'the_collapse',
        category: 'History',
        title: 'The Collapse',
        unlockCondition: 'event:colony_dissent',
        body: `The Collapse was not a single event but a cascade of failures that nearly ended humanity's interstellar civilization. It began with the Hyperlane Crisis — a sudden, unexplained degradation of the stable faster-than-light corridors that connected the major colony worlds. Travel times that had been measured in days stretched to months. Supply chains shattered. Colonies that depended on imported food and technology faced starvation and regression.

The political consequences were immediate and catastrophic. The United Colonial Parliament fractured along factional lines. Outer colonies declared independence. Inner systems hoarded resources. The military splintered into competing fleets, each loyal to a different authority. For nearly a decade, humanity existed as a collection of isolated, often hostile island-states scattered across the galaxy.

The Collapse ended — officially — with the signing of the Mandate Accords, but its scars run deep. Many colony worlds never recovered their pre-Collapse populations. Entire technologies were lost as the specialists who understood them died without successors. And in the unexplored reaches beyond the old borders, something stirred in the silence left by humanity's retreat.`,
    },

    {
        id: 'mandate_era',
        category: 'History',
        title: 'The Celestial Mandate',
        unlockCondition: 'game-start',
        body: `The Celestial Mandate is both a political entity and a philosophical doctrine. Born from the ashes of the Collapse, it represents humanity's second attempt at interstellar governance — this time guided by the hard lessons of the first failure.

The Mandate's founding principle is simple but radical: no single world, faction, or ideology may claim dominion over humanity's destiny. Instead, the Mandate serves as a framework for coordinated expansion, shared defense, and collective decision-making. Its authority derives not from military power but from the practical recognition that humanity's survival depends on cooperation.

In practice, the Mandate operates through a network of Governors — individuals chosen to oversee specific sectors of space. Each Governor commands significant autonomy within their domain but must answer to the Mandate Council on matters of interstellar policy. The system is imperfect, prone to political maneuvering and occasional corruption, but it has held together where the old Parliamentary system failed.

You are one such Governor. Your sector is newly charted, rich with potential and danger. The decisions you make here will shape not just your colonies but the future of the Mandate itself.`,
    },

    {
        id: 'lost_empires',
        category: 'History',
        title: 'The Lost Empires',
        unlockCondition: 'event:last_transmission',
        body: `Before the Architects, there were others. Xenoarchaeological surveys have identified the remnants of at least six additional spacefaring civilizations, each separated by millions of years. They are known collectively as the Lost Empires, though in truth almost nothing is known about any of them individually.

The oldest traces — designated "Empire Zero" by researchers — date to approximately 3.2 billion years ago, when Earth's most complex life forms were single-celled organisms. Whatever Empire Zero was, it operated on a galactic scale, leaving isotopic signatures in stellar atmospheres across the entire galactic disk. The scope of their engineering defies comprehension.

The pattern that emerges from studying the Lost Empires is troubling. Each civilization appears to have reached a critical threshold of technological sophistication and then simply... stopped. Not destroyed — there are no signs of war or catastrophe. They ceased to exist as coherent civilizations. The most popular hypothesis is the Transcendence Theory: that each empire eventually evolved beyond the need for physical infrastructure. But there is another theory, whispered in academic circles — that something in the galaxy actively prevents civilizations from exceeding a certain level of development. A cosmic filter. And that humanity is approaching it.`,
    },

    /* ─── Species ──────────────────────────────────────────────────────────── */

    {
        id: 'the_void_born',
        category: 'Species',
        title: 'The Void Born',
        unlockCondition: 'event:void_whispers',
        body: `The Void Born are not a species in any biological sense. They are a phenomenon — a collective designation for the strange, semi-coherent energy patterns that have been detected in deep interstellar space, far from any star system. First catalogued by the automated survey probes of the early Expansion era, the Void Born were initially dismissed as sensor artifacts or exotic radiation signatures.

That changed when the research vessel Cassandra recorded what appeared to be a Void Born entity actively manipulating the local fabric of spacetime. The recording, which lasted 47 seconds before the entity dissipated, showed a luminous structure approximately 3 kilometers across performing what physicists later described as "computational origami" — folding space into complex geometric patterns with no apparent physical mechanism.

No communication with the Void Born has ever been established. They do not respond to electromagnetic signals, gravitational pulses, or any other form of transmission humanity has attempted. They appear, perform their inscrutable manipulations, and vanish. Some researchers believe they are the remnants of a precursor civilization that uploaded itself into the quantum structure of spacetime. Others argue they are something far more ancient — entities that predate the galaxy itself.`,
    },

    {
        id: 'the_harvesters',
        category: 'Species',
        title: 'The Harvesters',
        unlockCondition: 'event:silent_armada',
        body: `First contact with the Harvesters occurred during the third year of the Mandate era, when a fleet of biomechanical vessels entered the Kepler-442 system and began systematically stripping the outer planets of their atmospheric gases. They ignored all attempts at communication. When a Mandate patrol squadron moved to intercept, the Harvester fleet simply repositioned — not aggressively, but with the indifferent efficiency of industrial machinery avoiding an obstacle.

The Harvesters, as they came to be called, are a spacefaring species that appears to operate on a fundamentally different set of priorities than humanity. Their ships are partially organic, grown rather than built, and their resource extraction methods suggest a civilization that has been consuming stellar material for millennia. They take what they need and move on, showing no interest in habitable worlds, intelligent life, or territorial claims.

Diplomatic efforts have produced limited results. The Harvesters communicate through modulated electromagnetic pulses that convey functional information — resource compositions, territorial boundaries, threat assessments — but nothing resembling culture, philosophy, or emotion. They are, as one frustrated diplomat described them, "a civilization that has optimized away everything that makes civilization worth having."`,
    },

    {
        id: 'the_merchants_collective',
        category: 'Species',
        title: 'The Merchants Collective',
        unlockCondition: 'event:merchant_prince',
        body: `The Merchants Collective is an interstellar trade network operated by a species that has never revealed its true name, biology, or homeworld. All interactions with the Collective are conducted through intermediaries — genetically engineered humanoid constructs designed specifically to interface with human psychology. These "trade envoys" are unfailingly polite, devastatingly shrewd, and impossible to read.

The Collective's trade goods are remarkable. They offer technologies that are always exactly one generation ahead of the buyer's current capabilities — advanced enough to be valuable, but never so advanced as to be destabilizing. Their prices are always denominated in raw materials, particularly rare isotopes and exotic matter. They accept no currency, no data, and no services. Only physical goods.

Attempts to trace Collective supply lines or identify their production facilities have universally failed. Their ships appear in-system through means that do not correspond to any known FTL method and depart the same way. Intelligence analysts suspect the Collective is not a single species but a consortium of multiple civilizations operating under a shared commercial framework — a galactic merchant guild that has been in operation for far longer than humanity has existed.`,
    },

    {
        id: 'the_exile_clans',
        category: 'Species',
        title: 'The Exile Clans',
        unlockCondition: 'event:exile_fleet_1',
        body: `The Exile Clans are the remnants of a once-great civilization that lost its homeworld to a catastrophe they refuse to discuss. They travel in vast generation fleets — armadas of interconnected vessels that serve as mobile cities, factories, and farms. Each fleet is a self-contained nation, capable of sustaining its population indefinitely without planetfall.

The Exiles' culture is defined by loss. Their art is elegiac, their music haunting, their architecture designed to evoke the memory of places that no longer exist. They carry with them a vast oral history — tens of thousands of years of stories, laws, and traditions maintained by professional rememberers known as the Keepers of the Long Memory.

Relations between the Exile Clans and the Mandate are complicated. The Exiles need resources — fuel, raw materials, biological stocks to maintain genetic diversity — and they are willing to trade labor, intelligence, and military support to get them. But they are also proud, suspicious of settled civilizations, and prone to internal conflicts that can spill over into the surrounding space. Accepting an Exile fleet into your territory is both an opportunity and a risk, one that many Mandate governors have learned to navigate with care.`,
    },

    /* ─── Technology ───────────────────────────────────────────────────────── */

    {
        id: 'taming_stellar_fire',
        category: 'Technology',
        title: 'Taming Stellar Fire',
        unlockCondition: 'research:fusion_power',
        body: `The development of controlled fusion power is widely regarded as the single most important technological achievement in human history. More than any other breakthrough, it was fusion that made interstellar civilization possible — providing the energy density needed to sustain colony ships during decades-long transits and to power the industrial infrastructure of worlds with no fossil fuel deposits.

The physics of fusion had been understood for centuries before it became practical. The challenge was always engineering: containing a plasma hotter than the core of a star within a magnetic bottle small enough to fit inside a ship. The breakthrough came from an unexpected direction — the application of Architect-derived metamaterials that could maintain coherent magnetic fields at temperatures and pressures that would have been impossible with purely human technology.

Modern fusion reactors bear little resemblance to the massive, fragile prototypes of the early era. A standard colonial power plant fits in a space roughly the size of a residential building and produces enough energy to sustain a city of a million people. Military-grade reactors are even more compact, their output measured not in megawatts but in the tonnage of enemy armor they can vaporize per second.`,
    },

    {
        id: 'the_neural_revolution',
        category: 'Technology',
        title: 'The Neural Revolution',
        unlockCondition: 'research:neural_interface',
        body: `The development of direct neural interfaces marked a fundamental shift in the relationship between human minds and the machines that served them. For the first time, the bottleneck was not processing power or data storage but the bandwidth of human consciousness itself.

Early neural interfaces were crude — implanted electrodes that could detect gross motor intentions and translate them into machine commands. They were used primarily for medical rehabilitation and industrial teleoperation. But as the technology matured, the interfaces became more intimate. Second-generation systems could read and write individual neurons. Third-generation systems could interface with entire brain regions, allowing users to perceive data feeds as sensory experience and control complex systems through pure thought.

The social consequences were profound and divisive. "Linked" individuals — those with permanent neural interfaces — reported dramatically enhanced cognitive capabilities, but they also exhibited psychological changes that alarmed ethicists. Some users struggled to distinguish between their own thoughts and the data flowing through their interfaces. Others found the unaugmented world intolerably slow and began spending most of their time in fully immersive virtual environments. The debate over how far humanity should merge with its machines continues to divide the Mandate's philosophical factions.`,
    },

    {
        id: 'matter_as_clay',
        category: 'Technology',
        title: 'Matter as Clay',
        unlockCondition: 'research:matter_compression',
        body: `Matter compression technology allows engineers to restructure materials at the atomic level, producing substances with properties that do not occur naturally. Need a hull plating that is transparent to visible light but impervious to radiation? A conductor that operates at room temperature with zero resistance? A structural member with the tensile strength of neutronium but the weight of aluminum? Matter compression makes it possible.

The technology is derived from Architect engineering principles discovered in a precursor installation orbiting a white dwarf star. The installation contained what appeared to be a manufacturing facility capable of rearranging atomic nuclei with the precision of a jeweler setting stones. Human scientists spent decades reverse-engineering the principles before producing a working prototype.

The implications for civilization are still unfolding. Traditional resource scarcity becomes meaningless when any element can be transmuted into any other — though the energy costs remain enormous. Military applications were, predictably, developed first: compressed-matter warheads that carry the destructive potential of antimatter without the storage hazards. But it is the civilian applications — perfect building materials, lossless energy storage, molecular medicine — that will ultimately transform human civilization.`,
    },

    {
        id: 'the_transcendence_question',
        category: 'Technology',
        title: 'The Transcendence Question',
        unlockCondition: 'research:transcendence',
        body: `Transcendence is the most controversial concept in human science, philosophy, and politics. It refers to the theoretical possibility of transitioning human consciousness beyond biological substrates entirely — uploading minds into computational matrices, merging with quantum fields, or achieving states of existence that current physics cannot adequately describe.

The research is real. Multiple independent laboratories have demonstrated that human consciousness can be sustained outside a biological brain for limited periods. The subjects report experiences that they struggle to articulate — expanded perception, access to modes of thought that biological neurons cannot support, a sense of connection to structures they describe as "deeper than spacetime."

The political implications are staggering. If transcendence is achievable, does the Mandate have an obligation to pursue it? What happens to the colonies, the fleets, the physical infrastructure of civilization when the population begins transitioning to a non-physical state? And — the question that haunts xenoarchaeologists — is transcendence what happened to the Architects? To the Lost Empires? Is it an ascension... or a trap?`,
    },

    {
        id: 'zero_point_dawn',
        category: 'Technology',
        title: 'Zero-Point Dawn',
        unlockCondition: 'research:zero_point_energy',
        body: `Zero-point energy extraction — drawing usable power from the quantum vacuum itself — was long considered a theoretical impossibility. The energy exists, physicists agreed, but extracting it would require manipulating the fabric of spacetime at scales where the distinction between energy and geometry breaks down. It was a technology for gods, not engineers.

The breakthrough came not from a laboratory but from a derelict Architect power plant discovered in the Cygnus system. The installation was still operational after two million years, drawing energy from a source that defied all known physics. Analysis revealed that the Architects had solved the quantum vacuum extraction problem by creating a localized region of modified spacetime — essentially, a pocket universe with different physical constants where zero-point extraction was thermodynamically favorable.

Human zero-point reactors are crude approximations of the Architect design, but they work. A single reactor produces more energy than a star, sustained indefinitely, with no fuel input and no waste output. The technology has made energy scarcity a relic of history — but it has also raised uncomfortable questions about the nature of the pocket universes that power the reactors. Some physicists believe they are not empty. And the energy readings from the oldest reactors suggest that something inside them is... growing.`,
    },

    {
        id: 'the_nanite_age',
        category: 'Technology',
        title: 'The Nanite Age',
        unlockCondition: 'research:nanite_mining',
        body: `Self-replicating nanoscale machines — nanites — transformed industry before they nearly destroyed it. The first-generation nanite swarms were designed for mining: clouds of molecular-scale robots that could disassemble asteroid material atom by atom and reassemble it into refined ingots of pure elements. They were spectacularly efficient, reducing the cost of raw materials by orders of magnitude.

The crisis came when a nanite swarm in the Tau Ceti system suffered a replication error that disabled its shutdown protocols. The swarm consumed the asteroid it was mining, then the next asteroid, then began working on the system's outer planets. By the time a Mandate fleet arrived with electromagnetic pulse weapons, the swarm had converted approximately 0.3% of the system's total mass into copies of itself.

The Tau Ceti Incident led to the Nanite Protocols — the most restrictive technology regulations in Mandate history. All nanite swarms now carry multiple redundant shutdown mechanisms, hard-coded replication limits, and "suicide switches" that activate if the swarm exceeds its designated operational boundary. The technology remains indispensable for large-scale mining and construction, but the memory of Tau Ceti ensures that every nanite deployment is treated with the same caution as a nuclear weapon.`,
    },

    /* ─── Anomalies ────────────────────────────────────────────────────────── */

    {
        id: 'dark_matter_storms',
        category: 'Anomalies',
        title: 'Dark Matter Storms',
        unlockCondition: 'event:dark_matter_cascade',
        body: `Dark matter — the invisible substance that comprises approximately 85% of the galaxy's mass — is normally inert, interacting with ordinary matter only through gravity. Dark matter storms are the terrifying exception.

Under conditions that physicists do not yet fully understand, concentrations of dark matter can enter an excited state in which they interact violently with normal matter. The resulting "storms" manifest as regions of space where gravity fluctuates wildly, electromagnetic fields distort, and the fabric of spacetime itself develops what navigators describe as "turbulence." Ships caught in a dark matter storm experience structural stresses that can tear them apart, instrument failures from electromagnetic interference, and — most disturbingly — temporal anomalies that cause different parts of the vessel to experience time at different rates.

Dark matter storms are unpredictable. They can appear anywhere, at any time, with warning periods ranging from hours to seconds. The only reliable defense is avoidance — which requires a sensor network sophisticated enough to detect the precursor conditions. Several Mandate research stations are dedicated to developing early warning systems, but progress is slow. Dark matter, by its nature, does not want to be observed.`,
    },

    {
        id: 'wormhole_phenomena',
        category: 'Anomalies',
        title: 'Wormhole Phenomena',
        unlockCondition: 'event:wormhole_tremor',
        body: `Natural wormholes — tunnels through spacetime connecting distant regions of the galaxy — were predicted by general relativity but were long assumed to be physically impossible. The discovery that they not only exist but are relatively common reshaped galactic geography overnight.

Most natural wormholes are unstable, flickering in and out of existence on timescales ranging from microseconds to centuries. They connect random points in space with no apparent pattern, and their endpoints shift unpredictably. Navigating one is theoretically possible but practically suicidal — the tidal forces inside an unstable wormhole would reduce a ship to a stream of individual atoms.

Stable wormholes are another matter entirely. Approximately 200 have been catalogued within Mandate space, each connecting two fixed points with consistent geometry. These "gates" have become the backbone of interstellar commerce, reducing transit times from weeks to hours. The gates are not natural phenomena — their stability is maintained by structures of clearly artificial origin, embedded in the wormhole throats like reinforcing rings in a mine shaft. The structures are Architect technology, and they have been operating without maintenance for two million years. No one knows what will happen when they finally fail.`,
    },

    {
        id: 'the_crystalline_entity',
        category: 'Anomalies',
        title: 'Crystalline Phenomena',
        unlockCondition: 'event:crystalline_bloom',
        body: `Crystalline blooms are among the most beautiful and least understood phenomena in the galaxy. They appear as sudden, explosive growths of complex crystalline structures on planetary surfaces, asteroid fields, and occasionally on the hulls of ships. The crystals are composed of elements arranged in configurations that should not be stable under normal physical laws, held together by forces that resist analysis.

The blooms are alive — or at least they exhibit behaviors consistent with life. They grow, they respond to stimuli, they appear to communicate through piezoelectric pulses that propagate through their structures at the speed of sound. Individual crystals within a bloom are differentiated, performing specialized functions analogous to the organs of a biological organism. Some researchers have proposed that each bloom is not a colony but a single distributed entity — a crystalline mind thinking thoughts that chemistry alone cannot support.

The relationship between crystalline blooms and the Architects is suspected but unproven. The crystal structures incorporate the same metamaterials found in Architect installations, and they appear preferentially in systems where other Architect artifacts are present. One provocative theory suggests that the blooms are the Architects — or rather, that the Architects engineered themselves into crystalline form as part of their transcendence. If true, the crystals growing on your colony hulls may be the sleeping dreams of a two-million-year-old god.`,
    },

    {
        id: 'energy_ghosts',
        category: 'Anomalies',
        title: 'Energy Ghosts',
        unlockCondition: 'event:energy_anomaly',
        body: `Energy ghosts — formally designated "coherent energy manifestations" — are unexplained phenomena that occur in regions of intense energy flux: around active stars, inside nebulae, and occasionally within the power cores of large installations. They appear as luminous shapes, roughly humanoid in outline, that persist for periods ranging from seconds to hours before dissipating.

The scientific community is divided on whether energy ghosts represent a genuine phenomenon or an artifact of observation. Sensor data is inconclusive — the manifestations register on some instruments but not others, and no two recordings of the same event agree on basic parameters like size, luminosity, or spectral composition. Skeptics argue that human pattern recognition is imposing familiar shapes on random energy fluctuations.

Those who have witnessed energy ghosts firsthand are less dismissive. Multiple independent observers report a consistent subjective experience: a sense of being watched, a feeling of vast intelligence, and — in some cases — the impression of receiving a communication too complex for human cognition to process. One veteran navigator described the experience as "standing in a library where every book is written in a language you almost understand." Whether energy ghosts are natural phenomena, precursor remnants, or something else entirely remains one of the galaxy's enduring mysteries.`,
    },

    {
        id: 'subspace_whispers',
        category: 'Anomalies',
        title: 'Subspace Whispers',
        unlockCondition: 'event:subspace_echo',
        body: `Subspace — the dimensional layer beneath normal spacetime that makes faster-than-light travel possible — is not silent. Sensitive receivers tuned to subspace frequencies detect a constant background of signals: rhythmic pulses, complex modulations, and what can only be described as voices. They are known colloquially as the Whispers.

The Whispers are not random noise. Analysis has revealed structure — repeating patterns, mathematical relationships, and information densities that far exceed what natural processes could produce. They are, by every objective measure, communications. But communications between whom? The signals do not originate from any known civilization, and they do not correspond to any catalogued language or encoding scheme.

The most unsettling aspect of the Whispers is their content — or rather, the effect they have on those who listen to them. Researchers who spend extended periods monitoring subspace frequencies report vivid dreams, sudden insights into unrelated problems, and an increasing conviction that the signals are personally addressed to them. Three separate research teams have been disbanded after members began exhibiting obsessive behavior, claiming to be on the verge of "understanding everything." The Mandate's official position is that the Whispers are a natural phenomenon of no strategic significance. The classified position is considerably less reassuring.`,
    },

    /* ─── Factions ─────────────────────────────────────────────────────────── */

    {
        id: 'pirate_confederacy',
        category: 'Factions',
        title: 'The Pirate Confederacy',
        unlockCondition: 'event:pirate_raid',
        body: `The Pirate Confederacy is less a unified organization than a loose network of independent raider groups, smuggling operations, and rogue colonies that have chosen to exist outside Mandate law. They operate from hidden bases in asteroid fields, nebulae, and the uncharted fringes of explored space, preying on trade convoys and poorly defended colonies.

Despite their reputation for lawlessness, the Confederacy operates according to a strict internal code known as the Black Compact. The Compact governs everything from the division of plunder to the treatment of prisoners, and violations are punished with a severity that would make Mandate courts blanch. The Confederacy's leadership — a rotating council of the most successful captains — enforces the Compact with ruthless efficiency.

The Mandate's relationship with the Confederacy is pragmatic. Full suppression would require a military commitment that no governor is willing to authorize, and the Confederacy's intelligence network — which spans the entire galaxy — has proven useful on multiple occasions. Unofficially, several Mandate governors maintain back-channel communications with Confederacy captains, trading amnesty for information and occasional "deniable" military operations in regions where the Mandate cannot officially operate.`,
    },

    {
        id: 'refugee_nations',
        category: 'Factions',
        title: 'The Refugee Nations',
        unlockCondition: 'event:refugee_fleet',
        body: `The galaxy is in constant motion, and not all of it is voluntary. Wars, ecological disasters, stellar catastrophes, and the slow grinding of economic forces produce a continuous stream of displaced populations — people who have lost their worlds and must find new ones or perish.

The Refugee Nations are the political entities that have formed around these displaced populations. Some are temporary — crisis organizations that dissolve once their members are resettled. Others have persisted for generations, their populations born and raised in fleet ships, knowing no planetary home. These permanent refugee nations have developed their own cultures, their own political traditions, and their own fierce pride in their survival.

The largest refugee populations in Mandate space are the Exiles — remnants of a non-human civilization — and the Diaspora, a human population displaced by the Collapse who never returned to their original worlds. Both groups represent significant pools of labor, expertise, and military potential. Both are also politically volatile, their loyalty to the Mandate conditional on the Mandate's willingness to accommodate their needs. For a sector governor, a refugee fleet appearing in your territory is both a test and an opportunity.`,
    },

    {
        id: 'science_collective',
        category: 'Factions',
        title: 'The Science Collective',
        unlockCondition: 'event:tech_breakthrough',
        body: `The Science Collective is an independent research organization that operates across Mandate space without allegiance to any particular governor, faction, or political entity. Founded in the aftermath of the Collapse by scientists who watched civilization's technological regression with horror, the Collective exists to ensure that knowledge is never again lost to political upheaval.

The Collective maintains a network of research stations, libraries, and teaching institutions scattered across hundreds of systems. Their archives contain the most comprehensive collection of human and alien knowledge in existence, including classified research that the Mandate government would prefer remained secret. The Collective's position is that knowledge belongs to the species, not to any government, and they have resisted every attempt to bring their archives under political control.

Relations between the Collective and the Mandate are tense but mutually beneficial. The Collective provides technical expertise and breakthrough research that no individual colony could fund. In return, they expect protection, resources, and — most importantly — autonomy. Governors who attempt to direct the Collective's research agenda or restrict access to their archives quickly find that the organization's political connections and public support make them effectively untouchable.`,
    },

    {
        id: 'colonial_frontier',
        category: 'Factions',
        title: 'The Colonial Frontier',
        unlockCondition: 'milestone:five_colonies',
        body: `Beyond the established trade routes and well-defended core systems lies the Frontier — a vast expanse of barely explored space where the Mandate's authority is more theoretical than practical. The Frontier is home to a unique subculture of settlers, prospectors, and adventurers who have chosen to live beyond the reach of civilization's comforts and constraints.

Frontier colonists are a self-reliant breed. They build their own habitats, grow their own food, and manufacture their own tools from whatever materials the local system provides. They are resourceful, stubborn, and deeply suspicious of authority — qualities that make them difficult to govern but invaluable as pioneers. Many of the Mandate's most productive colony worlds were first settled by Frontier wildcatters who ignored official survey data and followed their instincts into the unknown.

The Frontier is also dangerous. Beyond the mapped systems, there are no patrols, no rescue services, and no guarantees. Pirate raiders, hostile xenofauna, environmental hazards, and the simple mathematics of equipment failure in deep space claim lives every day. Those who survive develop a hard-eyed pragmatism and a solidarity with their fellow frontiersmen that transcends the political divisions of the inner systems. On the Frontier, the only faction that matters is "us" — and everyone else is the void.`,
    },

    /* ─── Locations ────────────────────────────────────────────────────────── */

    {
        id: 'the_galactic_core',
        category: 'Locations',
        title: 'The Galactic Core',
        unlockCondition: 'event:gravity_anomaly',
        body: `The center of the galaxy is a region of extraordinary density and violence. Millions of stars packed into a volume a few hundred light-years across, orbiting a supermassive black hole four million times the mass of Sol. Radiation levels are lethal. Gravitational tides can tear ships apart. Navigation is virtually impossible without real-time computational support.

And yet, something is there. Deep-space telescopes have detected structures in the Core — vast, geometrically precise objects orbiting the central black hole at velocities that should be impossible. They are not natural formations. Their thermal signatures suggest active power generation on a scale that dwarfs anything in the outer galaxy. And their electromagnetic emissions, decoded by Mandate cryptographers, contain what appears to be a beacon signal — a repeating mathematical sequence that translates, roughly, as "HERE."

No expedition to the Core has ever returned. The Mandate has sent four, each better equipped than the last. All contact was lost within days of entering the Core's outer boundary. The fifth expedition is currently being planned, incorporating lessons from the previous failures and newly developed radiation shielding derived from Architect technology. The question of what awaits at the galaxy's center — the origin of the beacon, the nature of the structures, the fate of four lost fleets — is the greatest unsolved mystery in human space.`,
    },

    {
        id: 'the_outer_rim',
        category: 'Locations',
        title: 'The Outer Rim',
        unlockCondition: 'milestone:first_survey',
        body: `The Outer Rim is the colloquial name for the sparse, thinly-starred region at the edge of the galaxy's habitable zone. Beyond it lies intergalactic space — the void between galaxies, empty of everything except the faintest whisper of hydrogen and the cold light of impossibly distant stars.

Despite its apparent desolation, the Outer Rim has become a region of intense interest to the Mandate. The low stellar density means less radiation, fewer gravitational anomalies, and clearer sensor readings — making it ideal for astronomical observation and long-range communication. Several of the Mandate's most sensitive listening posts are located in Outer Rim systems, their receivers pointed outward into the intergalactic void.

What they have heard is troubling. The void is not empty. Intermittent signals, far too structured to be natural, have been detected from the direction of the Andromeda galaxy — 2.5 million light-years away. If the signals are genuine communications, they were sent when humanity's ancestors were still learning to chip stone tools. The civilization that produced them has had two and a half million years to develop since then. Whatever they are now, they are likely beyond human comprehension. And they may already be on their way.`,
    },

    {
        id: 'the_hyperlane_network',
        category: 'Locations',
        title: 'The Hyperlane Network',
        unlockCondition: 'milestone:first_fleet_move',
        body: `The Hyperlane Network is the circulatory system of interstellar civilization — a web of stabilized faster-than-light corridors that connect the galaxy's inhabited systems. Without the hyperlanes, travel between stars would take years or decades. With them, a journey of a hundred light-years can be completed in days.

The hyperlanes are not a human creation. They are Architect infrastructure, engineered two million years ago through mechanisms that human physics can describe but not replicate. Each lane is a tunnel through higher-dimensional space, held open by precisely calibrated gravitational anchors embedded in the stars at either end. The anchors appear to be self-maintaining — drawing energy from their host stars to sustain the dimensional fold that makes FTL transit possible.

Control of hyperlane junctions — systems where multiple lanes converge — is the foundation of interstellar power. The Mandate's political geography is shaped by the network: core systems sit at major junctions, while frontier worlds cling to the ends of isolated spurs. The Collapse demonstrated what happens when the network fails, and ensuring its continued operation is the Mandate's highest strategic priority. Every governor knows that whoever controls the lanes controls the galaxy. And every governor also knows that the Architect technology sustaining them is two million years old, shows signs of degradation, and has no known replacement.`,
    },
];
