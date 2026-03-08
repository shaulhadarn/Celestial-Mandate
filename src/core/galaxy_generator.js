/* Updated: Organized app hierarchy, moved to src/core folder, fixed imports and paths */
import * as THREE from 'three';
import { isMobile as isMobileDevice } from './device.js';

const SYSTEM_NAMES = [
    "Sol", "Alpha Centauri", "Sirius", "Procyon", "Vega", "Altair", "Deneb", "Rigel",
    "Betelgeuse", "Antares", "Canopus", "Arcturus", "Capella", "Spica", "Pollux", "Fomalhaut",
    "Denebola", "Regulus", "Castor", "Achernar", "Hadar", "Acrux", "Aldebaran", "Bellatrix"
];

const PLANET_TYPES = ['Terran', 'Gas Giant', 'Barren', 'Molten', 'Ice'];

export function generateGalaxy(systemCount = 50, radius = 200, playerSettings = null) {
    const systems = [];
    const usedPositions = [];

    for (let i = 0; i < systemCount; i++) {
        let pos, valid;
        let attempts = 0;
        
        // Find a position not too close to others
        do {
            valid = true;
            const r = Math.random() * radius;
            const theta = Math.random() * Math.PI * 2;
            // Simple flat disk distribution
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            // y = 0 so all systems are coplanar — hyperlanes stay perfectly straight
            pos = new THREE.Vector3(x, 0, z);
            
            for (let other of usedPositions) {
                if (pos.distanceTo(other) < 15) { // Minimum distance
                    valid = false;
                    break;
                }
            }
            attempts++;
        } while (!valid && attempts < 100);

        if (valid) {
            usedPositions.push(pos);
            const system = generateSystemData(i, pos, playerSettings);
            systems.push(system);
        }
    }

    // Generate Hyperlanes (use Set for O(1) duplicate checking)
    const hyperlanes = [];
    const hyperlaneKeys = new Set();
    const systemById = new Map(systems.map(s => [s.id, s]));
    systems.forEach(sysA => {
        // Find neighbors
        const neighbors = systems
            .filter(sysB => sysB.id !== sysA.id)
            .map(sysB => ({
                id: sysB.id,
                dist: sysA.position.distanceTo(sysB.position)
            }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 2 + Math.floor(Math.random() * 2)); // 2-4 connections

        neighbors.forEach(n => {
            if (n.dist < 50) { // Max lane length
                const id1 = Math.min(sysA.id, n.id);
                const id2 = Math.max(sysA.id, n.id);
                const key = `${id1}-${id2}`;

                if (!hyperlaneKeys.has(key)) {
                    hyperlaneKeys.add(key);
                    hyperlanes.push({
                        key: key,
                        start: sysA.position,
                        end: systemById.get(n.id).position
                    });

                    // Add to system data for logical traversal
                    sysA.connections.push(n.id);
                }
            }
        });
    });

    return { systems, hyperlanes };
}

function generateSystemData(id, position, playerSettings) {
    const name = SYSTEM_NAMES[id % SYSTEM_NAMES.length] + (id >= SYSTEM_NAMES.length ? ` ${Math.floor(id/SYSTEM_NAMES.length)}` : "");
    const starType = Math.random() > 0.7 ? 'Blue Giant' : (Math.random() > 0.4 ? 'Yellow Dwarf' : 'Red Dwarf');
    const color = starType === 'Blue Giant' ? 0xaaaaff : (starType === 'Yellow Dwarf' ? 0xffddaa : 0xff5555);
    
    // Generate Planets
    const planets = [];
    let planetCount = Math.floor(Math.random() * 6);
    
    // Force Home System properties if it's the player's system (ID 0)
    if (id === 0 && playerSettings) {
        planetCount = Math.max(planetCount, 3); // Ensure at least a few planets
        // Create Homeworld
        planets.push({
            id: `p-${id}-0`,
            name: `${playerSettings.name} Prime`,
            type: playerSettings.homeworld,
            distance: 20,
            size: 1.2,
            angle: Math.random() * Math.PI * 2,
            speed: 0.002,
            moons: []
        });
    }

    for(let i=planets.length; i<planetCount; i++) {
        const pType = PLANET_TYPES[Math.floor(Math.random() * PLANET_TYPES.length)];

        // Generate moons based on planet type
        const moons = [];
        let moonChance = 0, maxMoons = 0;
        if (pType === 'Gas Giant') {
            moonChance = 0.7; maxMoons = 2;
        } else if (['Terran', 'Continental', 'Ocean'].includes(pType)) {
            moonChance = 0.4; maxMoons = 1;
        } else if (['Ice', 'Arctic', 'Barren', 'Desert'].includes(pType)) {
            moonChance = 0.2; maxMoons = 1;
        }
        // Molten/Asteroid/Tomb get 0 moons (defaults above)

        if (moonChance > 0 && Math.random() < moonChance) {
            const moonCount = pType === 'Gas Giant' ? 1 + Math.floor(Math.random() * 2) : Math.round(Math.random());
            for (let m = 0; m < Math.min(moonCount, maxMoons); m++) {
                moons.push({
                    size: 0.2 + Math.random() * 0.15,
                    orbitRadius: 3.0 + m * 2.0 + Math.random(),
                    angle: Math.random() * Math.PI * 2,
                    speed: 0.015 + Math.random() * 0.015,
                    inclination: 0.1 + Math.random() * 0.3,
                    color: Math.random() > 0.5 ? 0xaaaaaa : 0x998877
                });
            }
        }

        planets.push({
            id: `p-${id}-${i}`,
            name: `${name} ${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}`,
            type: pType,
            distance: 18 + (i * 12) + (Math.random() * 3),
            size: 0.5 + Math.random(),
            angle: Math.random() * Math.PI * 2,
            speed: 0.001 + (Math.random() * 0.005),
            moons
        });
    }

    // Sort by distance
    planets.sort((a,b) => a.distance - b.distance);

    // Generate asteroid belt in ~35% of systems with 2+ planets
    let asteroidBelt = null;
    if (planets.length >= 2 && Math.random() < 0.35) {
        let bestGap = 0, beltDist = 0;
        for (let i = 0; i < planets.length - 1; i++) {
            const gap = planets[i + 1].distance - planets[i].distance;
            if (gap > bestGap) {
                bestGap = gap;
                beltDist = planets[i].distance + gap * 0.5;
            }
        }
        if (bestGap > 8) {
            asteroidBelt = {
                distance: beltDist,
                width: 3 + Math.random() * 2,
                count: isMobileDevice ? 50 : 100
            };
        }
    }

    return {
        id,
        name: (id === 0 && playerSettings) ? "Capital System" : name,
        position,
        starType,
        color,
        planets,
        asteroidBelt,
        connections: [],
        surveyed: (id === 0) // Start surveyed
    };
}