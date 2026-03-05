/* Procedural equirectangular planet texture generators.
   Each function returns a THREE.CanvasTexture sized width=1024, height=512
   (2:1 ratio for proper spherical UV mapping) with seamless horizontal tiling. */
import * as THREE from 'three';

// ── Noise helpers ──────────────────────────────────────────────────────────────
// Simple 2D value noise using a permutation table — fast, no dependencies.
const _p = new Uint8Array(512);
(function initPerm() {
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [base[i], base[j]] = [base[j], base[i]];
    }
    for (let i = 0; i < 512; i++) _p[i] = base[i & 255];
})();

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function _lerp(a, b, t) { return a + (b - a) * t; }

function _grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function noise2D(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = _fade(xf), v = _fade(yf);
    const aa = _p[_p[xi] + yi], ab = _p[_p[xi] + yi + 1];
    const ba = _p[_p[xi + 1] + yi], bb = _p[_p[xi + 1] + yi + 1];
    return _lerp(
        _lerp(_grad(aa, xf, yf), _grad(ba, xf - 1, yf), u),
        _lerp(_grad(ab, xf, yf - 1), _grad(bb, xf - 1, yf - 1), u),
        v
    );
}

/** Fractal Brownian Motion — layered noise */
function fbm(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
    let val = 0, amp = 0.5, freq = 1.0;
    for (let i = 0; i < octaves; i++) {
        val += amp * noise2D(x * freq, y * freq);
        amp *= gain;
        freq *= lacunarity;
    }
    return val;
}

/**
 * Seamless-tiling noise on a cylinder (wraps horizontally).
 * Maps u (0..1) to a circle in 3D so left and right edges match perfectly.
 */
function seamlessNoise(u, v, scaleX, scaleY, octaves = 5) {
    const angle = u * Math.PI * 2;
    const nx = Math.cos(angle) * scaleX;
    const nz = Math.sin(angle) * scaleX;
    const ny = v * scaleY;
    // Use 2D slices through 3D space to get seamless wrap
    return fbm(nx + 50, ny + nz + 50, octaves);
}

// ── Color helpers ──────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function lerpColor(c1, c2, t) {
    return [
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    ];
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ── Shared canvas factory ──────────────────────────────────────────────────────
function makeCanvas(w = 1024, h = 512) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

function toTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

// ── Individual planet type generators ──────────────────────────────────────────

export function createTerranTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const deepOcean = [15, 50, 120];
    const shallowOcean = [30, 100, 180];
    const beach = [180, 170, 120];
    const lowland = [50, 140, 50];
    const highland = [35, 100, 35];
    const mountain = [120, 110, 100];
    const snow = [230, 235, 240];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 3, 3, 6) * 0.5 + 0.5;
            const detail = seamlessNoise(u, v, 8, 8, 4) * 0.15;
            const elev = clamp01(n + detail);

            let color;
            if (elev < 0.42) color = lerpColor(deepOcean, shallowOcean, elev / 0.42);
            else if (elev < 0.46) color = lerpColor(shallowOcean, beach, (elev - 0.42) / 0.04);
            else if (elev < 0.58) color = lerpColor(lowland, highland, (elev - 0.46) / 0.12);
            else if (elev < 0.72) color = lerpColor(highland, mountain, (elev - 0.58) / 0.14);
            else color = lerpColor(mountain, snow, clamp01((elev - 0.72) / 0.15));

            // Polar ice caps
            const lat = Math.abs(v - 0.5) * 2;
            if (lat > 0.82) {
                const iceBlend = clamp01((lat - 0.82) / 0.12);
                color = lerpColor(color, [220, 235, 245], iceBlend);
            }

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createContinentalTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const ocean = [20, 60, 130];
    const coast = [40, 120, 170];
    const plains = [90, 155, 70];
    const forest = [30, 95, 30];
    const hills = [100, 90, 65];
    const peaks = [170, 165, 155];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 4, 3, 6) * 0.5 + 0.5;
            const detail = seamlessNoise(u, v, 10, 10, 3) * 0.1;
            const elev = clamp01(n + detail);

            let color;
            if (elev < 0.38) color = lerpColor(ocean, coast, elev / 0.38);
            else if (elev < 0.50) color = lerpColor(coast, plains, (elev - 0.38) / 0.12);
            else if (elev < 0.65) color = lerpColor(plains, forest, (elev - 0.50) / 0.15);
            else if (elev < 0.80) color = lerpColor(forest, hills, (elev - 0.65) / 0.15);
            else color = lerpColor(hills, peaks, clamp01((elev - 0.80) / 0.15));

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createOceanTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const deepBlue = [8, 30, 80];
    const midBlue = [15, 60, 140];
    const shallowBlue = [40, 120, 190];
    const islandGreen = [50, 130, 50];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 3, 3, 5) * 0.5 + 0.5;
            const wave = seamlessNoise(u, v, 12, 12, 3) * 0.08;
            const elev = clamp01(n + wave);

            let color;
            if (elev < 0.35) color = lerpColor(deepBlue, midBlue, elev / 0.35);
            else if (elev < 0.65) color = lerpColor(midBlue, shallowBlue, (elev - 0.35) / 0.30);
            else if (elev < 0.78) color = lerpColor(shallowBlue, islandGreen, (elev - 0.65) / 0.13);
            else color = islandGreen;

            // Subtle specular highlights on water
            const spec = seamlessNoise(u, v, 20, 20, 2);
            if (elev < 0.65 && spec > 0.3) {
                const s = (spec - 0.3) * 0.15;
                color = [color[0] + s * 100, color[1] + s * 100, color[2] + s * 100];
            }

            const idx = (y * w + x) * 4;
            d[idx] = clamp01(color[0] / 255) * 255 | 0;
            d[idx + 1] = clamp01(color[1] / 255) * 255 | 0;
            d[idx + 2] = clamp01(color[2] / 255) * 255 | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createDesertTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const darkSand = [160, 110, 60];
    const sand = [210, 175, 110];
    const lightSand = [235, 210, 160];
    const rock = [130, 95, 60];
    const ridge = [100, 70, 40];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 4, 4, 5) * 0.5 + 0.5;
            const dunes = seamlessNoise(u, v, 8, 4, 4) * 0.2;
            const elev = clamp01(n + dunes);

            let color;
            if (elev < 0.35) color = lerpColor(ridge, rock, elev / 0.35);
            else if (elev < 0.55) color = lerpColor(rock, darkSand, (elev - 0.35) / 0.20);
            else if (elev < 0.75) color = lerpColor(darkSand, sand, (elev - 0.55) / 0.20);
            else color = lerpColor(sand, lightSand, clamp01((elev - 0.75) / 0.20));

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createArcticTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const deepIce = [160, 190, 210];
    const ice = [200, 220, 235];
    const snow = [235, 240, 248];
    const crevasse = [100, 140, 170];
    const frost = [220, 230, 245];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 4, 4, 5) * 0.5 + 0.5;
            const crack = seamlessNoise(u, v, 12, 12, 3);
            const elev = clamp01(n);

            let color;
            if (elev < 0.30) color = lerpColor(crevasse, deepIce, elev / 0.30);
            else if (elev < 0.55) color = lerpColor(deepIce, ice, (elev - 0.30) / 0.25);
            else if (elev < 0.75) color = lerpColor(ice, frost, (elev - 0.55) / 0.20);
            else color = lerpColor(frost, snow, clamp01((elev - 0.75) / 0.20));

            // Crevasse detail
            if (crack > 0.35 && crack < 0.40) {
                color = lerpColor(color, crevasse, 0.5);
            }

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createBarrenTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const darkRock = [80, 75, 70];
    const rock = [130, 125, 115];
    const lightRock = [170, 165, 155];
    const dust = [150, 140, 125];
    const crater = [60, 55, 50];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 5, 5, 6) * 0.5 + 0.5;
            const detail = seamlessNoise(u, v, 15, 15, 3) * 0.1;
            const elev = clamp01(n + detail);

            let color;
            if (elev < 0.25) color = lerpColor(crater, darkRock, elev / 0.25);
            else if (elev < 0.50) color = lerpColor(darkRock, rock, (elev - 0.25) / 0.25);
            else if (elev < 0.70) color = lerpColor(rock, dust, (elev - 0.50) / 0.20);
            else color = lerpColor(dust, lightRock, clamp01((elev - 0.70) / 0.25));

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createMoltenTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const darkCrust = [25, 10, 5];
    const crust = [50, 20, 10];
    const hotCrack = [200, 80, 10];
    const lava = [255, 160, 30];
    const brightLava = [255, 220, 80];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 4, 4, 5) * 0.5 + 0.5;
            const cracks = seamlessNoise(u, v, 8, 8, 4);
            const fine = seamlessNoise(u, v, 16, 16, 3) * 0.1;
            const elev = clamp01(n + fine);

            let color;
            // Mostly dark crust with glowing cracks
            if (elev < 0.45) color = lerpColor(darkCrust, crust, elev / 0.45);
            else if (elev < 0.55) color = lerpColor(crust, hotCrack, (elev - 0.45) / 0.10);
            else if (elev < 0.65) color = lerpColor(hotCrack, lava, (elev - 0.55) / 0.10);
            else color = lerpColor(lava, brightLava, clamp01((elev - 0.65) / 0.20));

            // Extra lava veins from crack noise
            const crackVal = (cracks * 0.5 + 0.5);
            if (crackVal > 0.58 && crackVal < 0.64) {
                const t = 1.0 - Math.abs(crackVal - 0.61) / 0.03;
                color = lerpColor(color, lava, t * 0.8);
            }

            const idx = (y * w + x) * 4;
            d[idx] = Math.min(255, color[0]) | 0;
            d[idx + 1] = Math.min(255, color[1]) | 0;
            d[idx + 2] = Math.min(255, color[2]) | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createGasGiantTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const band1 = [180, 140, 80];
    const band2 = [220, 180, 110];
    const band3 = [160, 110, 60];
    const band4 = [200, 160, 100];
    const storm = [210, 130, 60];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            // Horizontal banding — primary feature of gas giants
            const bandFreq = v * 18;
            const band = Math.sin(bandFreq) * 0.5 + 0.5;
            const bandDetail = seamlessNoise(u, v, 2, 0.5, 3) * 0.15;

            // Turbulence distortion within bands
            const turb = seamlessNoise(u, v, 6, 3, 4) * 0.2;
            const val = clamp01(band + bandDetail + turb);

            let color;
            if (val < 0.25) color = lerpColor(band3, band1, val / 0.25);
            else if (val < 0.50) color = lerpColor(band1, band2, (val - 0.25) / 0.25);
            else if (val < 0.75) color = lerpColor(band2, band4, (val - 0.50) / 0.25);
            else color = lerpColor(band4, band3, (val - 0.75) / 0.25);

            // Storm spots
            const stormN = seamlessNoise(u, v, 10, 10, 2);
            if (stormN > 0.38) {
                const t = clamp01((stormN - 0.38) / 0.1);
                color = lerpColor(color, storm, t * 0.4);
            }

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}

export function createTombTexture() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;

    const waste = [60, 65, 55];
    const ash = [95, 95, 85];
    const ruins = [75, 80, 70];
    const scar = [50, 45, 40];
    const glow = [80, 100, 70];

    for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const n = seamlessNoise(u, v, 5, 5, 5) * 0.5 + 0.5;
            const detail = seamlessNoise(u, v, 12, 12, 3) * 0.1;
            const elev = clamp01(n + detail);

            let color;
            if (elev < 0.30) color = lerpColor(scar, waste, elev / 0.30);
            else if (elev < 0.55) color = lerpColor(waste, ruins, (elev - 0.30) / 0.25);
            else if (elev < 0.75) color = lerpColor(ruins, ash, (elev - 0.55) / 0.20);
            else color = lerpColor(ash, glow, clamp01((elev - 0.75) / 0.20));

            const idx = (y * w + x) * 4;
            d[idx] = color[0] | 0;
            d[idx + 1] = color[1] | 0;
            d[idx + 2] = color[2] | 0;
            d[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(canvas);
}
