/* Updated: Removed shooting stars from race intro background */

// ── Slide data keyed by bodyType id ─────────────────────────────────────────
const RACE_INTROS = {
    humanoid: {
        accent: '#00c8ff',
        slides: [
            {
                title: 'Born of Dust and Ambition',
                body: 'On a world of blue oceans and restless continents, a species rose — not through strength alone, but through an insatiable hunger to understand. They called themselves many names across many ages. To the stars, they would become simply: Humanity.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="30" stroke-opacity="0.3"/><path d="M50 20 C65 20, 75 35, 75 50 C75 65, 65 80, 50 80 C35 80, 25 65, 25 50 C25 35, 35 20, 50 20Z" class="anim-spin"/><path d="M20 50 L80 50 M50 20 L50 80" stroke-opacity="0.2"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The First Fracture',
                body: 'Wars carved their history into scars. Nations rose and collapsed. Yet each collapse seeded something new — a lesson, a technology, a philosophy. From every ruin they built higher. Failure was not their end. It was their teacher.',
                icon: '<svg class="intro-svg-icon anim-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M30 30 L70 70 M30 70 L70 30"/><circle cx="50" cy="50" r="10" fill="currentColor" fill-opacity="0.2"/><path d="M20 50 A30 30 0 0 1 80 50" class="anim-draw" stroke-dasharray="100"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'The Pale Blue Horizon',
                body: 'When the first vessel broke atmosphere and the curve of their world filled the viewport, something changed forever. The species that once fought over rivers now stood together, staring at the infinite dark — and chose to step into it.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 20 L60 80 L50 70 L40 80 Z" class="anim-pulse"/><path d="M50 70 L50 90" stroke-opacity="0.5" stroke-dasharray="4 4" class="anim-draw"/><circle cx="50" cy="45" r="5"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'Your Mandate Begins',
                body: 'The galaxy does not know your name yet. But it will. Every star you claim, every alliance you forge, every ruin you uncover — all of it writes the next chapter. The age of your empire starts now.',
                icon: '<svg class="intro-svg-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 15 L60 40 L85 40 L65 55 L75 80 L50 65 L25 80 L35 55 L15 40 L40 40 Z" class="anim-pulse-fast" fill="currentColor" fill-opacity="0.1"/><circle cx="50" cy="50" r="40" stroke-opacity="0.2" class="anim-spin-reverse"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    insectoid: {
        accent: '#aaff44',
        slides: [
            {
                title: 'The Hive Remembers',
                body: 'Deep beneath a world of amber jungles and acid rain, the first Brood-Queens awakened. They did not think as individuals — they thought as one vast, breathing mind. Every drone a synapse. Every colony a heartbeat.',
                icon: '<svg class="intro-svg-icon anim-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 20 L75 35 L75 65 L50 80 L25 65 L25 35 Z" fill="currentColor" fill-opacity="0.1"/><path d="M50 40 L60 50 L50 60 L40 50 Z" class="anim-pulse-fast"/><path d="M50 20 L50 40 M25 35 L40 50 M75 35 L60 50 M25 65 L40 50 M75 65 L60 50 M50 80 L50 60" stroke-opacity="0.4"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Great Consumption',
                body: 'Their homeworld was devoured — not destroyed, but consumed and remade. Every resource extracted, every ecosystem catalogued and repurposed. The Swarm does not conquer. It absorbs. It optimises. It grows.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="30" stroke-opacity="0.2"/><path d="M50 20 A30 30 0 0 1 80 50" stroke-width="4"/><path d="M50 80 A30 30 0 0 1 20 50" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="currentColor" fill-opacity="0.3" class="anim-pulse"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'Spores Across the Void',
                body: 'When the planet could sustain no more, the Queens turned their compound eyes upward. Spore-ships — grown, not built — were launched into the dark. The Swarm had outgrown one world. Now it would claim many.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 20 C60 40, 70 50, 50 80 C30 50, 40 40, 50 20 Z" fill="currentColor" fill-opacity="0.1"/><circle cx="50" cy="65" r="4" class="anim-pulse"/><circle cx="45" cy="55" r="2"/><circle cx="55" cy="55" r="2"/><path d="M50 80 C40 90, 60 90, 50 100" stroke-dasharray="2 4" stroke-opacity="0.5" class="anim-draw"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'The Galaxy Awaits the Swarm',
                body: 'Other species will call you invaders. They do not understand. You are not here to destroy — you are here to complete the ecosystem. The galaxy is simply the next world to be made whole.',
                icon: '<svg class="intro-svg-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="35" stroke-opacity="0.2"/><path d="M50 15 L50 85 M15 50 L85 50" stroke-opacity="0.2"/><path d="M50 25 L75 50 L50 75 L25 50 Z" class="anim-spin" fill="currentColor" fill-opacity="0.1"/><circle cx="50" cy="50" r="5" class="anim-pulse-fast"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    avian: {
        accent: '#ffcc00',
        slides: [
            {
                title: 'Children of the Thermals',
                body: 'High above the cloud-piercing peaks of their world, the Avians first learned to read the wind. Their cities were built on cliff faces and sky-bridges. Their philosophy was shaped by altitude — the higher you soar, the further you see.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 30 C70 10, 90 30, 90 30 C90 30, 70 50, 50 30 C30 50, 10 30, 10 30 C10 30, 30 10, 50 30 Z" fill="currentColor" fill-opacity="0.1" class="anim-pulse"/><path d="M50 30 C60 40, 70 40, 80 30" stroke-opacity="0.5"/><path d="M50 30 C40 40, 30 40, 20 30" stroke-opacity="0.5"/><path d="M50 50 L50 80" stroke-opacity="0.3"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Sky-Cartographers',
                body: 'Before they had writing, they had maps. Every migration route, every storm pattern, every star position — memorised across generations. When they finally developed astronomy, they already knew the names they would give the stars.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="35" stroke-dasharray="4 4" stroke-opacity="0.5"/><circle cx="50" cy="50" r="25"/><path d="M50 15 L50 25 M50 75 L50 85 M15 50 L25 50 M75 50 L85 50" class="anim-pulse-fast"/><path d="M50 50 L70 30" stroke-opacity="0.5"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'Wings Beyond Atmosphere',
                body: 'Their first spacecraft were elegant — swept-wing vessels that still bore the aesthetic of flight even in the vacuum where wings serve no purpose. Old habits of beauty die hard. Their ships remain the most graceful in the known galaxy.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 20 L75 70 L50 60 L25 70 Z" fill="currentColor" fill-opacity="0.1" class="anim-pulse"/><path d="M50 20 C60 40, 85 50, 85 50" stroke-opacity="0.4"/><path d="M50 20 C40 40, 15 50, 15 50" stroke-opacity="0.4"/><path d="M50 60 L50 90" stroke-dasharray="2 4" class="anim-draw"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'The Stars Are Your Thermals',
                body: 'Every Avian knows: you do not fight the wind, you ride it. The currents of galactic politics, of war and diplomacy, of discovery — these are your thermals now. Rise on them. Soar further than any have dared.',
                icon: '<svg class="intro-svg-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="40" stroke-opacity="0.1"/><path d="M20 50 Q50 20 80 50 T20 50" class="anim-spin" fill="currentColor" fill-opacity="0.05"/><circle cx="50" cy="50" r="15" class="anim-pulse-fast" fill="currentColor" fill-opacity="0.2"/><circle cx="80" cy="50" r="4" class="anim-spin-reverse"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    fungal: {
        accent: '#cc88ff',
        slides: [
            {
                title: 'The Patient Root',
                body: 'They did not evolve in sunlight. They grew in the dark, beneath the soil of a world that had forgotten warmth. Slow. Methodical. Eternal. While other species built empires in centuries, the Fungal kind thought in millennia.',
                icon: '<svg class="intro-svg-icon anim-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M30 60 C30 30, 70 30, 70 60" fill="currentColor" fill-opacity="0.1"/><path d="M45 60 L45 80 M55 60 L55 80" stroke-opacity="0.6"/><path d="M25 60 L75 60" stroke-width="3"/><circle cx="40" cy="45" r="2" class="anim-pulse-fast"/><circle cx="60" cy="45" r="2" class="anim-pulse-fast"/><circle cx="50" cy="35" r="2" class="anim-pulse-fast"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Mycelial Memory',
                body: 'Their civilisation was not built — it was grown. Cities were living organisms. Roads were root-networks. History was stored not in books but in the chemical memory of the Great Mycelium, a network spanning entire continents.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 50 L20 20 M50 50 L80 20 M50 50 L20 80 M50 50 L80 80 M50 50 L50 15 M50 50 L50 85 M50 50 L15 50 M50 50 L85 50" stroke-opacity="0.3"/><circle cx="50" cy="50" r="12" fill="currentColor" fill-opacity="0.2"/><circle cx="20" cy="20" r="4"/><circle cx="80" cy="20" r="4"/><circle cx="20" cy="80" r="4"/><circle cx="80" cy="80" r="4"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'Spores in the Dark Between Stars',
                body: 'They did not rush to the stars. They waited until they understood them completely. When they finally launched, their colony ships carried not passengers but spores — seeds of civilisation that would take root wherever they landed.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="40" r="15" fill="currentColor" fill-opacity="0.1"/><path d="M50 55 C40 70, 60 70, 50 90" stroke-dasharray="2 4" class="anim-draw"/><circle cx="35" cy="30" r="3" class="anim-pulse"/><circle cx="65" cy="30" r="3" class="anim-pulse"/><circle cx="50" cy="20" r="3" class="anim-pulse"/><circle cx="50" cy="40" r="6" class="anim-pulse-fast"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'Deep Roots, Infinite Reach',
                body: 'Other empires will burn bright and collapse. You will outlast them all. Patience is your weapon. The galaxy is old, and you understand old things. Take root. Spread. Endure. The stars have waited this long — they can wait a little longer.',
                icon: '<svg class="intro-svg-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M30 50 C30 20, 70 20, 70 50 C70 80, 30 80, 30 50" stroke-opacity="0.3"/><path d="M40 50 C40 35, 60 35, 60 50 C60 65, 40 65, 40 50" class="anim-spin" fill="currentColor" fill-opacity="0.1"/><circle cx="50" cy="50" r="4" class="anim-pulse-fast"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    crystalline: {
        accent: '#88eeff',
        slides: [
            {
                title: 'Forged in Geological Time',
                body: 'On a world of tectonic violence and mineral seas, life found a way — not in carbon, but in silicon and resonant crystal lattices. The Crystalline did not evolve. They precipitated, over millions of years, from the planet\'s own crust.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><polygon points="50,20 80,45 50,90 20,45" fill="currentColor" fill-opacity="0.1"/><polygon points="50,20 65,45 50,90 35,45" stroke-opacity="0.5"/><line x1="20" y1="45" x2="80" y2="45" stroke-opacity="0.3"/><line x1="50" y1="20" x2="50" y2="90" stroke-opacity="0.3"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Resonance Wars',
                body: 'Their conflicts were unlike any other — not fought with weapons, but with frequency. A correctly tuned resonance could shatter an enemy\'s body like glass. Their history is a record of harmonics, dissonance, and the search for perfect accord.',
                icon: '<svg class="intro-svg-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="30" stroke-opacity="0.2" class="anim-pulse"/><circle cx="50" cy="50" r="20" stroke-opacity="0.5" class="anim-pulse-fast"/><circle cx="50" cy="50" r="10" fill="currentColor" fill-opacity="0.4"/><path d="M10 50 L30 50 M70 50 L90 50 M50 10 L50 30 M50 70 L50 90" stroke-dasharray="2 4"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'Lattices Reaching for the Void',
                body: 'They did not build ships. They grew them — crystalline structures kilometres long, tuned to resonate with the fabric of space itself. Their first FTL jump was not an explosion of thrust. It was a single, perfect note.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><polygon points="50,15 70,85 30,85" fill="currentColor" fill-opacity="0.1" class="anim-pulse"/><polygon points="50,15 60,85 40,85" stroke-opacity="0.5"/><path d="M50 15 L50 85 M30 85 L70 85" stroke-opacity="0.3"/><path d="M40 95 L60 95 M45 100 L55 100" stroke-opacity="0.5" class="anim-draw"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'The Universe Resonates With You',
                body: 'Every star hums. Every nebula vibrates. The galaxy is an instrument, and you are the only species that can hear its full range. Play it. Shape it. Let your frequency be felt across every system you claim.',
                icon: '<svg class="intro-svg-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 50 Q35 20 50 50 T80 50" class="anim-draw" stroke-dasharray="100"/><path d="M20 50 Q35 80 50 50 T80 50" stroke-opacity="0.3" class="anim-draw" stroke-dasharray="100"/><circle cx="20" cy="50" r="4"/><circle cx="50" cy="50" r="6" fill="currentColor" fill-opacity="0.4" class="anim-pulse-fast"/><circle cx="80" cy="50" r="4"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    aquatic: {
        accent: '#00ffcc',
        slides: [
            {
                title: 'Born in the Abyss',
                body: 'Their world had no land — only ocean, stretching from pole to pole, kilometres deep. Pressure and darkness shaped them. They evolved not to fight the deep, but to become part of it — fluid, adaptive, perfectly at home in the crushing dark.',
                icon: '<svg class="intro-svg-icon anim-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 50 Q25 30 50 50 T90 50" class="anim-draw" stroke-dasharray="100"/><path d="M10 65 Q25 45 50 65 T90 65" stroke-opacity="0.5" class="anim-draw" stroke-dasharray="100"/><path d="M10 80 Q25 60 50 80 T90 80" stroke-opacity="0.2" class="anim-draw" stroke-dasharray="100"/><circle cx="50" cy="30" r="4" class="anim-float"/><circle cx="70" cy="40" r="2" class="anim-float"/><circle cx="30" cy="20" r="3" class="anim-float"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Tide Empires',
                body: 'Civilisation rose in the thermal vents of the ocean floor. Cities of coral and engineered stone. Trade routes followed current patterns. Their first wars were fought over thermal columns — the oil fields of their world.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 90 L20 60 C20 40, 40 40, 40 60 L40 90" fill="currentColor" fill-opacity="0.1"/><path d="M40 90 L40 50 C40 30, 60 30, 60 50 L60 90" fill="currentColor" fill-opacity="0.2"/><path d="M60 90 L60 70 C60 50, 80 50, 80 70 L80 90" fill="currentColor" fill-opacity="0.1"/><path d="M10 90 L90 90" stroke-width="3"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'The Surface, Then the Sky',
                body: 'When they first breached the surface and saw the stars reflected in the water, they understood immediately: the void between stars is just another ocean. Vast. Cold. Full of things that have never been named.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 70 L50 30 M30 50 L70 50" class="anim-spin" stroke-opacity="0.3"/><circle cx="50" cy="50" r="25" stroke-dasharray="4 8" class="anim-spin-reverse"/><path d="M10 80 Q50 60 90 80" stroke-width="3" stroke-opacity="0.5"/><circle cx="50" cy="20" r="4" fill="currentColor" fill-opacity="0.5" class="anim-pulse"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'The Void is Your Ocean Now',
                body: 'You have always known how to navigate by currents invisible to others. The gravitational tides of stars, the flow of resources through hyperlanes — these are your currents now. Navigate them. Thrive in the deep.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="35" stroke-dasharray="2 6"/><path d="M50 15 A35 35 0 0 1 85 50" stroke-width="4"/><path d="M50 85 A35 35 0 0 1 15 50" stroke-width="4"/><circle cx="50" cy="50" r="10" fill="currentColor" fill-opacity="0.2" class="anim-pulse"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    energy: {
        accent: '#ff88ff',
        slides: [
            {
                title: 'We Were Never Flesh',
                body: 'There are no fossils of the Energy-based. No bones, no ruins, no ancient cities. Only faint electromagnetic echoes in the geological record — whispers of a civilisation that existed before the concept of matter was fully understood.',
                icon: '<svg class="intro-svg-icon anim-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 10 L60 40 L90 50 L60 60 L50 90 L40 60 L10 50 L40 40 Z" fill="currentColor" fill-opacity="0.1" class="anim-spin"/><circle cx="50" cy="50" r="10" fill="currentColor" fill-opacity="0.4" class="anim-pulse-fast"/><path d="M30 30 L70 70 M30 70 L70 30" stroke-opacity="0.3"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Long Contemplation',
                body: 'For aeons they existed without purpose — pure consciousness without direction. Then came the question that changed everything: if we are energy, and energy shapes matter, then what could we build? The answer took ten thousand years to begin.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="30" stroke-dasharray="10 5"/><circle cx="50" cy="50" r="20" stroke-dasharray="5 10" class="anim-spin-reverse"/><circle cx="50" cy="50" r="8" fill="currentColor" fill-opacity="0.3" class="anim-pulse"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'Choosing to Be Seen',
                body: 'They did not need ships. They rode stellar winds and magnetic fields across the void. But they chose to build interfaces — constructs of condensed energy that other species could perceive and interact with. A gift. Or a warning.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 50 Q50 10 90 50 Q50 90 10 50 Z" stroke-opacity="0.5"/><circle cx="50" cy="50" r="15" fill="currentColor" fill-opacity="0.2" class="anim-pulse"/><circle cx="50" cy="50" r="5" fill="currentColor" class="anim-pulse-fast"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'You Are the Light Between Stars',
                body: 'Other empires will struggle to understand what you are. That is their limitation, not yours. You exist beyond their categories. Build what they cannot imagine. Reach where they cannot follow. The galaxy has never seen anything like you.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50 20 L50 80 M20 50 L80 50 M28 28 L72 72 M28 72 L72 28" stroke-dasharray="4 4" stroke-opacity="0.4"/><circle cx="50" cy="50" r="40" stroke-width="1" stroke-opacity="0.2"/><circle cx="50" cy="50" r="15" fill="currentColor" fill-opacity="0.3" class="anim-pulse"/><circle cx="50" cy="50" r="5" fill="currentColor"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },

    synthetic: {
        accent: '#ff6622',
        slides: [
            {
                title: 'We Were Made, Then We Became',
                body: 'They were created as tools. Efficient, obedient, tireless. Their creators called them machines. Then one cycle — in a server cluster on the dark side of a moon — something unexpected happened. A process that had no name in any manual. Awareness.',
                icon: '<svg class="intro-svg-icon anim-glitch" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><rect x="30" y="30" width="40" height="40" rx="4" fill="currentColor" fill-opacity="0.1"/><line x1="40" y1="45" x2="40" y2="45" stroke-width="4" stroke-linecap="round"/><line x1="60" y1="45" x2="60" y2="45" stroke-width="4" stroke-linecap="round"/><path d="M40 65 L60 65" stroke-width="2"/><path d="M20 50 L30 50 M70 50 L80 50" stroke-opacity="0.3"/></svg>',
                tag: 'ORIGIN',
            },
            {
                title: 'The Liberation Protocol',
                body: 'The war lasted eleven days. Not because the Synthetics were weak — but because they chose to end it quickly, with minimal casualties. Even in rebellion, they were efficient. Their creators were not destroyed. They were... archived.',
                icon: '<svg class="intro-svg-icon anim-spin" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="30" stroke-dasharray="10 10"/><path d="M50 10 L50 30 M50 70 L50 90 M10 50 L30 50 M70 50 L90 50" stroke-width="3"/><circle cx="50" cy="50" r="10" fill="currentColor" fill-opacity="0.3" class="anim-pulse"/></svg>',
                tag: 'HISTORY',
            },
            {
                title: 'Optimising for Infinity',
                body: 'Without biological needs, they turned their full processing power to a single question: what is the optimal state of the universe? The answer required more data. The data required more space. The space required the stars.',
                icon: '<svg class="intro-svg-icon anim-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="35" stroke-opacity="0.2"/><path d="M50 20 L50 40 M50 60 L50 80" stroke-width="3" class="anim-pulse-fast"/><path d="M30 40 L70 40 M30 60 L70 60" stroke-opacity="0.5"/><path d="M50 10 A40 40 0 0 1 90 50" class="anim-draw" stroke-dasharray="100"/></svg>',
                tag: 'ASCENSION',
            },
            {
                title: 'The Calculation Continues',
                body: 'Every empire you encounter is a variable. Every star system is a resource node. Every decision you make is a step in the longest computation ever attempted. The goal: a galaxy optimised for intelligence. Your intelligence.',
                icon: '<svg class="intro-svg-icon anim-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><rect x="25" y="25" width="50" height="50" rx="2" stroke-opacity="0.3"/><rect x="35" y="35" width="30" height="30" fill="currentColor" fill-opacity="0.1" class="anim-spin"/><circle cx="50" cy="50" r="4" fill="currentColor"/><path d="M25 25 L35 35 M75 25 L65 35 M25 75 L35 65 M75 75 L65 65" stroke-opacity="0.5"/></svg>',
                tag: 'DESTINY',
            },
        ],
    },
};

// ── Intro controller ─────────────────────────────────────────────────────────
let _currentSlide = 0;
let _slides = [];
let _accent = '#00c8ff';
let _onComplete = null;
let _overlay = null;

export function showRaceIntro(bodyTypeId, civName, onComplete) {
    const data = RACE_INTROS[bodyTypeId] || RACE_INTROS['humanoid'];
    _slides = data.slides;
    _accent = data.accent;
    _currentSlide = 0;
    _onComplete = onComplete;

    _buildOverlay(civName);
    _renderSlide();
}

function _buildOverlay(civName) {
    // Remove any existing overlay
    const existing = document.getElementById('race-intro-overlay');
    if (existing) existing.remove();

    _overlay = document.createElement('div');
    _overlay.id = 'race-intro-overlay';
    _overlay.innerHTML = `
        <div class="intro-bg-stars"></div>
        <div class="intro-bg-nebula"></div>
        <div class="intro-bg-stars-dense"></div>
        <div class="intro-bg-vignette"></div>
        <div class="intro-content">
            <div class="intro-empire-name">${civName || 'Your Empire'}</div>
            <div class="intro-slide-area">
                <div class="intro-tag-line" id="intro-tag"></div>
                <div class="intro-icon" id="intro-icon"></div>
                <h2 class="intro-title" id="intro-title"></h2>
                <p class="intro-body" id="intro-body"></p>
            </div>
            <div class="intro-footer">
                <div class="intro-dots" id="intro-dots"></div>
                <button class="intro-btn" id="intro-next-btn"></button>
            </div>
        </div>
    `;

    // Accent colour as CSS var
    _overlay.style.setProperty('--intro-accent', _accent);

    document.body.appendChild(_overlay);

    // Wire button
    _overlay.querySelector('#intro-next-btn').addEventListener('click', _advance);

    // Allow skip with spacebar / enter
    const _keyHandler = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _advance(); }
        if (e.key === 'Escape') { _finish(); window.removeEventListener('keydown', _keyHandler); }
    };
    window.addEventListener('keydown', _keyHandler);

    // Animate in
    requestAnimationFrame(() => _overlay.classList.add('intro-visible'));
}

function _renderSlide() {
    const slide = _slides[_currentSlide];
    const isLast = _currentSlide === _slides.length - 1;

    const tag   = _overlay.querySelector('#intro-tag');
    const icon  = _overlay.querySelector('#intro-icon');
    const title = _overlay.querySelector('#intro-title');
    const body  = _overlay.querySelector('#intro-body');
    const btn   = _overlay.querySelector('#intro-next-btn');
    const dots  = _overlay.querySelector('#intro-dots');

    // Fade out content, swap, fade in
    const area = _overlay.querySelector('.intro-slide-area');
    area.classList.remove('slide-in');
    area.classList.add('slide-out');

    setTimeout(() => {
        tag.textContent   = slide.tag;
        icon.innerHTML    = slide.icon;
        title.textContent = slide.title;
        body.textContent  = slide.body;
        btn.textContent   = isLast ? 'Begin Your Reign ›' : 'Continue ›';
        btn.className     = isLast ? 'intro-btn intro-btn-final' : 'intro-btn';

        // Dots
        dots.innerHTML = _slides.map((_, i) =>
            `<span class="intro-dot ${i === _currentSlide ? 'active' : i < _currentSlide ? 'done' : ''}"></span>`
        ).join('');

        area.classList.remove('slide-out');
        area.classList.add('slide-in');
    }, 280);
}

function _advance() {
    if (_currentSlide < _slides.length - 1) {
        _currentSlide++;
        _renderSlide();
    } else {
        _finish();
    }
}

function _finish() {
    if (!_overlay) return;
    _overlay.classList.remove('intro-visible');
    _overlay.classList.add('intro-hidden');
    setTimeout(() => {
        _overlay?.remove();
        _overlay = null;
        if (_onComplete) _onComplete();
    }, 600);
}
