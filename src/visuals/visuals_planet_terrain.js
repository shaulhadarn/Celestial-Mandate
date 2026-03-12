/* Updated: Mobile optimized - 96-segment terrain, MeshLambertMaterial on mobile, no micro-noise jitter on mobile */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';

/* ── Pre-baked height grid for fast per-frame lookups ─────────────────────── */
const GRID_SIZE = 512;
const GRID_EXTENT = 500; // terrain spans -500 to 500 on both axes
let heightGrid = null;

/**
 * Pre-compute all terrain heights into a flat Float32Array grid.
 * Called once from createTerrainMesh() so per-frame physics can use
 * getTerrainHeightFast() (bilinear interpolation) instead of trig math.
 */
export function bakeHeightGrid() {
    heightGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
    const step = (GRID_EXTENT * 2) / (GRID_SIZE - 1);
    for (let j = 0; j < GRID_SIZE; j++) {
        for (let i = 0; i < GRID_SIZE; i++) {
            const x = -GRID_EXTENT + i * step;
            const z = -GRID_EXTENT + j * step;
            heightGrid[j * GRID_SIZE + i] = getTerrainHeight(x, z);
        }
    }
}

/**
 * Fast terrain height via bilinear interpolation from the baked grid.
 * No trig — just array lookups and lerps. Falls back to getTerrainHeight()
 * if the grid hasn't been baked yet or coordinates are out of range.
 */
export function getTerrainHeightFast(x, z) {
    if (!heightGrid) return getTerrainHeight(x, z);

    // Map world coords to grid coords
    const invStep = (GRID_SIZE - 1) / (GRID_EXTENT * 2);
    const gx = (x + GRID_EXTENT) * invStep;
    const gz = (z + GRID_EXTENT) * invStep;

    // Out-of-bounds: fall back to analytic function
    if (gx < 0 || gx >= GRID_SIZE - 1 || gz < 0 || gz >= GRID_SIZE - 1) {
        return getTerrainHeight(x, z);
    }

    const ix = gx | 0; // floor via bitwise OR
    const iz = gz | 0;
    const fx = gx - ix; // fractional part
    const fz = gz - iz;

    const idx = iz * GRID_SIZE + ix;
    const h00 = heightGrid[idx];
    const h10 = heightGrid[idx + 1];
    const h01 = heightGrid[idx + GRID_SIZE];
    const h11 = heightGrid[idx + GRID_SIZE + 1];

    // Bilinear interpolation
    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
}

/**
 * Procedural terrain height math.
 * Smooth rolling hills — two gentle sine-wave octaves, no harsh detail.
 */
export function getTerrainHeight(x, z) {
    // Layer 1: Broad rolling hills
    let h = Math.sin(x * 0.012 + 0.3) * Math.cos(z * 0.012 + 0.7) * 14;
    // Cross-pattern for less uniform ridgelines
    h += Math.sin(x * 0.009 - z * 0.007) * 6;

    // Layer 2: Gentle medium undulation
    h += Math.sin(x * 0.028 + 12) * Math.cos(z * 0.024 + 8) * 3.5;

    // Flatten center area for the base/drone spawn
    const dist = Math.sqrt(x * x + z * z);
    const safeZone = 40;
    const blendZone = 30;

    if (dist < safeZone) {
        h *= 0.1;
    } else if (dist < safeZone + blendZone) {
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
    // Mobile: 96 segments = ~37k verts vs 256 = ~263k verts — 7x fewer triangles
    const groundSegments = isMobileDevice ? 96 : 256;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, groundSegments, groundSegments);
    
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // PlaneGeometry raw Y maps to -worldZ after rotation.x = -PI/2,
        // so negate Y so the mesh matches getTerrainHeight(worldX, worldZ)
        // used by all object placement and the baked height grid.
        const z = getTerrainHeight(x, -y);
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

    // Smooth shading for rolling-hill terrain (no flat faceted look)
    const groundMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({
            map: groundTex || null,
            vertexColors: true,
            emissive: new THREE.Color(typeConf.emissive),
            emissiveIntensity: typeConf.emissiveIntensity,
          })
        : new THREE.MeshStandardMaterial({
            map: groundTex || null,
            vertexColors: true,
            roughness: typeConf.roughness,
            metalness: typeConf.metalness,
            emissive: new THREE.Color(typeConf.emissive),
            emissiveIntensity: typeConf.emissiveIntensity,
          });

    const terrain = new THREE.Mesh(groundGeo, groundMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;

    // Bake height grid after terrain is created so per-frame physics can use fast lookups
    bakeHeightGrid();

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