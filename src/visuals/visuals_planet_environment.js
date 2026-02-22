/* Updated: Mobile optimized - MeshLambertMaterial for props/creatures, no per-crystal PointLights on mobile, reduced prop count on mobile */
import * as THREE from 'three';
import { textures } from '../core/assets.js';

const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

export function getSkyColor(type) {
    switch(type) {
        case 'Terran':      return 0x4da6ff; // Clear day blue
        case 'Continental': return 0x5c8a8a; // Misty/cloudy blue-green
        case 'Ocean':       return 0x1a5276; // Deep atmospheric blue
        case 'Barren':      return 0x111111; // Dark, near vacuum
        case 'Molten':      return 0x4a0000; // Thick ash and magma glow
        case 'Ice':         return 0x1a3a52; // Dark steel blue — NOT white, so terrain contrast is clear
        case 'Arctic':      return 0x1e3a5a; // Deep cold blue — dark enough to contrast pale terrain
        case 'Desert':      return 0xb87a3a; // Dusty orange/tan
        case 'Tomb':        return 0x1a1a1a; // Dark grey nuclear winter
        case 'Gas Giant':   return 0xcc7a00; // Thick orange clouds
        default:            return 0x050505; // Deep space
    }
}

export function getPropColor(type) {
    switch(type) {
        case 'Terran':      return 0x5a3a1a; // Dark brown rocks
        case 'Continental': return 0x4a3a2a; // Earthy brown
        case 'Ocean':       return 0x1a3a5a; // Dark wet rocks
        case 'Barren':      return 0x3a3a3a; // Dark grey boulders
        case 'Molten':      return 0x1a0800; // Near-black scorched rock
        case 'Ice':         return 0x2a5a7a; // Dark teal ice boulders — visible against pale peaks
        case 'Arctic':      return 0x2a4a6a; // Dark blue-grey rocks
        case 'Desert':      return 0x6a3a1a; // Dark reddish sandstone
        case 'Tomb':        return 0x1a1a12; // Near-black ash rubble
        default:            return 0x3a3a3a;
    }
}

/**
 * Populates the planet with environmental props like rocks and crystals.
 */
export function createPlanetProps(planetType, group, heightFn) {
    const props = [];
    const propColor = getPropColor(planetType);
    // Mobile: MeshLambertMaterial — no PBR cost, same vertex-lit look
    const propMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: propColor })
        : new THREE.MeshStandardMaterial({ color: propColor, roughness: 0.9 });
    const crystalMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0x00f2ff, emissive: 0x0044aa, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })
        : new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x0044aa, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 });

    // Mobile: 80 props instead of 150 — halves draw calls
    const propCount = isMobileDevice ? 80 : 150;
    const propGeo = new THREE.DodecahedronGeometry(1, 0);
    const crystalGeo = new THREE.ConeGeometry(0.5, 3, 4);

    for(let i=0; i<propCount; i++) {
        const r = 30 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const yBase = heightFn(x, z);
        
        const isCrystal = Math.random() > 0.9;
        const scale = 0.5 + Math.random() * (isCrystal ? 1.5 : 3);
        const mesh = new THREE.Mesh(isCrystal ? crystalGeo : propGeo, isCrystal ? crystalMat : propMat);
        
        const halfHeight = isCrystal ? (3 * scale)/2 : (1 * scale)/2;
        const meshY = yBase + (isCrystal ? (1.5 * scale) : (0.8 * scale)); 

        mesh.position.set(x, meshY, z);
        mesh.scale.setScalar(scale);
        mesh.rotation.set(Math.random()*0.2, Math.random()*Math.PI, Math.random()*0.2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        props.push({ x, z, r: (isCrystal ? 1 : 1.5) * scale, topY: meshY + halfHeight });

        // Mobile: skip per-crystal PointLights — each light is a full shader pass on mobile
        if (isCrystal && !isMobileDevice) {
            const light = new THREE.PointLight(0x00f2ff, 2, 8);
            light.position.set(0, -1, 0);
            mesh.add(light);
        }
    }
    return props;
}

export function createCreatures(type, group, heightFn) {
    if (['Barren', 'Molten', 'Tomb'].includes(type)) return [];
    const creatures = [];
    // Mobile: 5 creatures instead of 10, lower-poly sphere
    const count = isMobileDevice ? 5 : 10;
    const bodyMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0xff44aa })
        : new THREE.MeshStandardMaterial({ color: 0xff44aa });
    const bodyGeo = new THREE.SphereGeometry(1, isMobileDevice ? 5 : 8, isMobileDevice ? 5 : 8);
    const legGeo = new THREE.BoxGeometry(0.2, 2, 0.2);

    for (let i = 0; i < count; i++) {
        const creature = new THREE.Group();
        const r = 50 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const y = heightFn(x, z) + 2;

        creature.position.set(x, y, z);
        creature.add(new THREE.Mesh(bodyGeo, bodyMat));
        for(let j=0; j<4; j++) {
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(Math.cos(j)*0.8, -1, Math.sin(j)*0.8);
            creature.add(leg);
        }

        creature.userData = { 
            originX: x, originZ: z, 
            phase: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.5
        };
        group.add(creature);
        creatures.push(creature);
    }
    return creatures;
}