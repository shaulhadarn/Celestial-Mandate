/* Updated: Mobile optimized - 96-segment terrain, MeshLambertMaterial on mobile, no micro-noise jitter on mobile */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';

/* ── Pre-baked height grid for fast per-frame lookups ─────────────────────── */
const GRID_SIZE = 256;
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
    // Layer 1: Broad rolling hills (rotated axes to avoid axis-aligned ridges)
    let h = Math.sin(x * 0.011 + z * 0.005 + 0.3) * Math.cos(z * 0.013 - x * 0.003 + 0.7) * 14;
    // Cross-pattern at non-orthogonal angle
    h += Math.sin(x * 0.008 - z * 0.009 + 2.1) * 6;

    // Layer 2: Medium undulation (rotated ~30° from primary)
    h += Math.sin(x * 0.021 + z * 0.017 + 12) * Math.cos(z * 0.026 - x * 0.011 + 8) * 3.5;

    // Layer 3: Fine detail to break up any remaining regularity
    h += Math.sin(x * 0.047 - z * 0.033 + 5.3) * 1.2;

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
    // Reduced segments — 160 desktop (25K verts) vs 96 mobile (9K verts)
    // Still smooth due to vertex normals; huge perf win on load
    const groundSegments = isMobileDevice ? 96 : 160;
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

    // High-quality hash — two different prime sets to avoid axis-aligned patterns
    function hash21(px, pz) {
        let h = Math.sin(px * 127.1 + pz * 311.7) * 43758.5453;
        return h - Math.floor(h);
    }
    function hash21b(px, pz) {
        let h = Math.sin(px * 269.5 + pz * 183.3) * 28461.7231;
        return h - Math.floor(h);
    }
    // Value noise with quintic interpolation (smoother than smoothstep, no visible grid)
    function valueNoise(px, pz) {
        const ix = Math.floor(px), iz = Math.floor(pz);
        const fx = px - ix, fz = pz - iz;
        // Quintic smoothstep — eliminates the second-derivative discontinuity that causes banding
        const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
        const a = hash21(ix, iz);
        const b = hash21(ix + 1, iz);
        const c = hash21(ix, iz + 1);
        const d = hash21(ix + 1, iz + 1);
        return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
    }
    // Second noise layer with different hash to avoid correlation
    function valueNoise2(px, pz) {
        const ix = Math.floor(px), iz = Math.floor(pz);
        const fx = px - ix, fz = pz - iz;
        const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
        const a = hash21b(ix, iz);
        const b = hash21b(ix + 1, iz);
        const c = hash21b(ix, iz + 1);
        const d = hash21b(ix + 1, iz + 1);
        return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
    }

    // Pre-allocate a working color to avoid 66K Color.clone() allocations
    const _workCol = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
        const h  = pos.getZ(i);
        const t  = (h - minH) / hRange;          // 0 = valley, 1 = peak
        const x  = pos.getX(i);
        const z  = pos.getY(i);

        // Blend low→high color by height
        _workCol.copy(baseCol).lerp(highCol, t);

        // Sprinkle accent color in mid-range (rocks, ice patches, lava veins…)
        const accentStrength = typeConf.accentMid
            ? Math.max(0, 1 - Math.abs(t - 0.45) * 4) * 0.6
            : 0;
        if (accentStrength > 0) _workCol.lerp(accentCol, accentStrength);

        // 3-octave noise with rotated sampling to break grid alignment
        // Rotate coordinates by ~37° so noise grid doesn't align with mesh grid
        const rx = x * 0.7986 + z * 0.6018;   // cos(37°), sin(37°)
        const rz = -x * 0.6018 + z * 0.7986;
        const n1 = valueNoise(rx * 0.04, rz * 0.04);           // large patches
        const n2 = valueNoise2(rx * 0.12 + 50, rz * 0.12 + 50); // medium detail
        const n3 = valueNoise(rx * 0.3 + 100, rz * 0.3 + 100);  // fine grain
        const jitter = ((n1 * 0.5 + n2 * 0.35 + n3 * 0.15) - 0.3) * typeConf.jitter;
        _workCol.r = Math.min(1, Math.max(0, _workCol.r + jitter));
        _workCol.g = Math.min(1, Math.max(0, _workCol.g + jitter));
        _workCol.b = Math.min(1, Math.max(0, _workCol.b + jitter));

        colorAttr[i * 3]     = _workCol.r;
        colorAttr[i * 3 + 1] = _workCol.g;
        colorAttr[i * 3 + 2] = _workCol.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));

    const groundTex = getGroundTexture(planetType);
    if (groundTex) {
        groundTex.wrapS = THREE.RepeatWrapping;
        groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(37, 37);
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

/**
 * Carve lake basins into the terrain mesh and baked height grid.
 * Depresses terrain vertices within each lake radius into a smooth bowl
 * so the water disc (placed at waterY) is actually visible above the ground.
 * Must be called AFTER createTerrainMesh (so baked grid exists) and BEFORE
 * lake meshes are positioned.
 * @param {THREE.Mesh} terrainMesh - The terrain mesh to modify
 * @param {Array} lakeDefs - Array of { x, z, radius }
 * @returns {Array} Same lakeDefs, each augmented with .waterY
 */
export function carveLakeBasins(terrainMesh, lakeDefs) {
    if (!lakeDefs || lakeDefs.length === 0) return lakeDefs;

    const pos = terrainMesh.geometry.attributes.position;
    const colorAttr = terrainMesh.geometry.attributes.color;

    for (const lake of lakeDefs) {
        // Sample terrain height at the lake edge to determine water level
        let edgeTotal = 0;
        const edgeSamples = 16;
        for (let i = 0; i < edgeSamples; i++) {
            const angle = (i / edgeSamples) * Math.PI * 2;
            const ex = lake.x + Math.cos(angle) * lake.radius;
            const ez = lake.z + Math.sin(angle) * lake.radius;
            edgeTotal += getTerrainHeight(ex, ez);
        }
        const edgeH = edgeTotal / edgeSamples;
        lake.waterY = edgeH - 0.6;   // water surface sits just below average edge height
        const depth = 3.5;            // how deep the center basin goes below waterY
        const carveRadius = lake.radius + 2; // slightly wider than lake for smooth blending

        // Depress terrain vertices within lake area
        for (let i = 0; i < pos.count; i++) {
            const localX = pos.getX(i);
            const localY = pos.getY(i);
            // PlaneGeometry local Y = -worldZ (due to the negate in createTerrainMesh)
            const worldX = localX;
            const worldZ = -localY;

            const dx = worldX - lake.x;
            const dz = worldZ - lake.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < carveRadius) {
                const t = dist / carveRadius; // 0 at center, 1 at edge
                // Smooth bowl: steep at edges, flat at center (cubic ease)
                const bowl = 1 - t * t * t;
                const targetH = lake.waterY - depth * bowl;
                const currentH = pos.getZ(i);

                if (targetH < currentH) {
                    pos.setZ(i, targetH);

                    // Darken vertex color for underwater lake bed
                    if (colorAttr) {
                        const dark = 0.25 + 0.75 * t; // darker at center
                        colorAttr.setXYZ(i,
                            colorAttr.getX(i) * dark * 0.5,
                            colorAttr.getY(i) * dark * 0.55,
                            colorAttr.getZ(i) * dark * 0.65
                        );
                    }
                }
            }
        }
    }

    pos.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
    terrainMesh.geometry.computeVertexNormals();

    // Update baked height grid so physics / placement respect the basins
    if (heightGrid) {
        const step = (GRID_EXTENT * 2) / (GRID_SIZE - 1);
        for (const lake of lakeDefs) {
            const depth = 3.5;
            const carveRadius = lake.radius + 2;
            // Only iterate grid cells near the lake (bounding box)
            const minI = Math.max(0, Math.floor(((lake.x - carveRadius) + GRID_EXTENT) / step));
            const maxI = Math.min(GRID_SIZE - 1, Math.ceil(((lake.x + carveRadius) + GRID_EXTENT) / step));
            const minJ = Math.max(0, Math.floor(((lake.z - carveRadius) + GRID_EXTENT) / step));
            const maxJ = Math.min(GRID_SIZE - 1, Math.ceil(((lake.z + carveRadius) + GRID_EXTENT) / step));

            for (let j = minJ; j <= maxJ; j++) {
                for (let i = minI; i <= maxI; i++) {
                    const gx = -GRID_EXTENT + i * step;
                    const gz = -GRID_EXTENT + j * step;
                    const dx = gx - lake.x;
                    const dz = gz - lake.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist < carveRadius) {
                        const t = dist / carveRadius;
                        const bowl = 1 - t * t * t;
                        const targetH = lake.waterY - depth * bowl;
                        const idx = j * GRID_SIZE + i;
                        if (targetH < heightGrid[idx]) {
                            heightGrid[idx] = targetH;
                        }
                    }
                }
            }
        }
    }

    return lakeDefs;
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