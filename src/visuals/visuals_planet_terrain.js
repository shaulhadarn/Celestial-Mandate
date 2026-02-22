/* Updated: Per-type vertex colors, roughness/metalness/emissive tuned per planet type, fixes white-on-white Ice/Arctic terrain */
import * as THREE from 'three';
import { textures } from '../core/assets.js';

/**
 * Procedural terrain height math.
 * Uses layered sine waves (pseudo-fBm) for more natural, rugged terrain.
 */
export function getTerrainHeight(x, z) {
    let h = 0;
    let amplitude = 12;
    let frequency = 0.015;
    
    // Layer 1: Large hills
    h += Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude;
    
    // Layer 2: Medium details
    amplitude *= 0.5;
    frequency *= 2.1;
    h += Math.sin(x * frequency + 15) * Math.cos(z * frequency + 15) * amplitude;

    // Layer 3: Small rugged details
    amplitude *= 0.4;
    frequency *= 2.3;
    h += Math.sin(x * frequency + 30) * Math.cos(z * frequency + 30) * amplitude;

    // Flatten center area for the base/drone spawn
    const dist = Math.sqrt(x*x + z*z);
    const safeZone = 40;
    const blendZone = 30;
    
    if (dist < safeZone) {
        h *= 0.1; // Very flat in the center
    } else if (dist < safeZone + blendZone) {
        // Smoothly blend from flat center to rugged exterior
        const factor = (dist - safeZone) / blendZone;
        h *= (0.1 + 0.9 * factor * factor);
    }
    
    return h;
}

/**
 * Creates the terrain mesh for a planet view.
 */
export function createTerrainMesh(planetType) {
    const groundSize = 1000;
    const groundSegments = 256; 
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, groundSegments, groundSegments);
    
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i); 
        let z = getTerrainHeight(x, y);
        
        // Add micro-noise to vertices to simulate rocks/boulders
        const noise = (Math.random() - 0.5) * 0.8;
        z += noise; 
        
        pos.setZ(i, z);
    }
    groundGeo.computeVertexNormals();

    // Build per-vertex colors for visual contrast — this is the key fix for
    // types like Ice/Arctic where a single flat color shows nothing.
    const typeConf = getTypeConfig(planetType);
    const colorAttr = new Float32Array(pos.count * 3);
    const baseCol  = new THREE.Color(typeConf.colorLow);
    const highCol  = new THREE.Color(typeConf.colorHigh);
    const accentCol = new THREE.Color(typeConf.colorAccent);

    // Find height range for normalisation
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < pos.count; i++) {
        const h = pos.getZ(i);
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
    }
    const hRange = maxH - minH || 1;

    for (let i = 0; i < pos.count; i++) {  
        const h  = pos.getZ(i);
        const t  = (h - minH) / hRange;          // 0 = valley, 1 = peak
        const x  = pos.getX(i);
        const z  = pos.getY(i);

        // Blend low→high color by height
        const blended = baseCol.clone().lerp(highCol, t);

        // Sprinkle accent color in mid-range (rocks, ice patches, lava veins…)
        const accentStrength = typeConf.accentMid
            ? Math.max(0, 1 - Math.abs(t - 0.45) * 4) * 0.6
            : 0;
        blended.lerp(accentCol, accentStrength);

        // Tiny per-vertex jitter so flat-shaded faces look distinct
        const jitter = (Math.sin(x * 0.3 + z * 0.17) * 0.5 + 0.5) * typeConf.jitter;
        blended.r = Math.min(1, blended.r + jitter);
        blended.g = Math.min(1, blended.g + jitter);
        blended.b = Math.min(1, blended.b + jitter);

        colorAttr[i * 3]     = blended.r;
        colorAttr[i * 3 + 1] = blended.g;
        colorAttr[i * 3 + 2] = blended.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));

    const groundTex = getGroundTexture(planetType);
    if (groundTex) {
        groundTex.wrapS = THREE.RepeatWrapping;
        groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(40, 40);
    }

    const groundMat = new THREE.MeshStandardMaterial({
        map: groundTex || null,
        vertexColors: true,          // vertex colors carry all the visual detail
        roughness: typeConf.roughness,
        metalness: typeConf.metalness,
        flatShading: true,
        emissive: new THREE.Color(typeConf.emissive),
        emissiveIntensity: typeConf.emissiveIntensity,
    });

    const terrain = new THREE.Mesh(groundGeo, groundMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    return terrain;
}

export function getGroundColor(type) {
    // Kept for backwards compatibility — vertex colors now drive terrain appearance
    switch(type) {
        case 'Terran':      return 0x3b823b;
        case 'Continental': return 0x228b22;
        case 'Ocean':       return 0x114488;
        case 'Barren':      return 0xa0a0a0;
        case 'Molten':      return 0x3f1515;
        case 'Ice':         return 0x8ec8e8;
        case 'Arctic':      return 0x7ab8d8;
        case 'Desert':      return 0xd2b48c;
        case 'Tomb':        return 0x4a4a4a;
        default:            return 0x555555;
    }
}

export function getGroundTexture(type) {
    switch(type) {
        case 'Terran':      return textures.terran;
        case 'Continental': return textures.terran;
        case 'Ocean':       return textures.terran;
        default:            return null;
    }
}

/**
 * Per-type terrain configuration.
 * colorLow   = valley / deep color
 * colorHigh  = peak / ridge color
 * colorAccent = mid-slope accent (rocks, ice patches, lava veins)
 * accentMid  = whether to blend accent at mid-height
 * jitter     = per-vertex brightness jitter amount (0 = none)
 * roughness / metalness / emissive / emissiveIntensity
 */
function getTypeConfig(type) {
    switch(type) {
        case 'Terran':
            return { colorLow: 0x1a5c1a, colorHigh: 0x4caf50, colorAccent: 0x8d6e3f,
                     accentMid: true,  jitter: 0.03,
                     roughness: 0.9, metalness: 0.0,
                     emissive: 0x000000, emissiveIntensity: 0 };

        case 'Continental':
            return { colorLow: 0x1e6b1e, colorHigh: 0x5cb85c, colorAccent: 0x7a5c3a,
                     accentMid: true,  jitter: 0.03,
                     roughness: 0.88, metalness: 0.0,
                     emissive: 0x000000, emissiveIntensity: 0 };

        case 'Ocean':
            return { colorLow: 0x0a2a5e, colorHigh: 0x1a6aaa, colorAccent: 0x2a9ad4,
                     accentMid: false, jitter: 0.04,
                     roughness: 0.4, metalness: 0.15,
                     emissive: 0x001122, emissiveIntensity: 0.05 };

        case 'Barren':
            return { colorLow: 0x3a3a3a, colorHigh: 0x888888, colorAccent: 0x5a4a3a,
                     accentMid: true,  jitter: 0.06,
                     roughness: 0.95, metalness: 0.05,
                     emissive: 0x000000, emissiveIntensity: 0 };

        case 'Molten':
            return { colorLow: 0x1a0500, colorHigh: 0x5a1800, colorAccent: 0xff4400,
                     accentMid: true,  jitter: 0.02,
                     roughness: 0.7, metalness: 0.2,
                     emissive: 0xff2200, emissiveIntensity: 0.35 };

        case 'Ice':
            // Key fix: dark teal valleys, bright icy peaks, blue-white accent
            // This gives strong contrast so the terrain is clearly visible
            return { colorLow: 0x1a4a6a, colorHigh: 0xb8e4f0, colorAccent: 0x4a9ab8,
                     accentMid: true,  jitter: 0.05,
                     roughness: 0.3, metalness: 0.25,
                     emissive: 0x0a1a2a, emissiveIntensity: 0.04 };

        case 'Arctic':
            // Dark blue-grey valleys, pale blue-white peaks
            return { colorLow: 0x1e3a4a, colorHigh: 0xa8cce0, colorAccent: 0x3a6a88,
                     accentMid: true,  jitter: 0.05,
                     roughness: 0.55, metalness: 0.1,
                     emissive: 0x050e14, emissiveIntensity: 0.03 };

        case 'Desert':
            return { colorLow: 0x7a4a1a, colorHigh: 0xe8c87a, colorAccent: 0xb87a3a,
                     accentMid: true,  jitter: 0.07,
                     roughness: 0.92, metalness: 0.0,
                     emissive: 0x000000, emissiveIntensity: 0 };

        case 'Tomb':
            return { colorLow: 0x1a1a1a, colorHigh: 0x4a4a3a, colorAccent: 0x2a3a1a,
                     accentMid: true,  jitter: 0.04,
                     roughness: 0.95, metalness: 0.05,
                     emissive: 0x0a1a08, emissiveIntensity: 0.08 };

        default:
            return { colorLow: 0x2a2a2a, colorHigh: 0x666666, colorAccent: 0x444444,
                     accentMid: false, jitter: 0.05,
                     roughness: 0.9, metalness: 0.05,
                     emissive: 0x000000, emissiveIntensity: 0 };
    }
}