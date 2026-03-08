/* Updated: Organized app hierarchy, moved to src/core folder, fixed imports and paths */
import * as THREE from 'three';

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

export function createHullTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base metallic dark color
    ctx.fillStyle = '#1a1d23';
    ctx.fillRect(0, 0, 512, 512);

    // Draw panels
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const w = Math.random() * 120 + 40;
        const h = Math.random() * 120 + 40;
        
        // Variation in panel color (greys and slightly blue-ish greys)
        const brightness = 25 + Math.random() * 25;
        ctx.fillStyle = `rgb(${brightness}, ${brightness + Math.random() * 5}, ${brightness + 10 + Math.random() * 10})`;
        ctx.fillRect(x, y, w, h);
        
        // Darker panel gaps/borders
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        
        // Add some "tech" details like lines or dots within panels
        if (Math.random() > 0.5) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(x + 5, y + 5, w - 10, 2);
        }
        
        // Rivets or bolt details
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let j = 0; j < 4; j++) {
            ctx.beginPath();
            ctx.arc(x + 5 + Math.random() * (w - 10), y + 5 + Math.random() * (h - 10), 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Add some larger industrial structural lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
        const x = (i / 10) * 512;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

export function createProceduralPlanetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // ── Simple seeded hash-based noise ──
    // Generates a deterministic-looking but random noise field
    const seed = Math.random() * 10000;
    function hash(x, y) {
        let h = seed + x * 374761393 + y * 668265263;
        h = (h ^ (h >> 13)) * 1274126177;
        h = h ^ (h >> 16);
        return (h & 0x7fffffff) / 0x7fffffff;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

    // Value noise with bilinear interpolation and horizontal wrapping
    function valueNoise(px, py, gridSize) {
        const gx = px / gridSize;
        const gy = py / gridSize;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = fade(gx - x0);
        const fy = fade(gy - y0);

        const v00 = hash(x0, y0);
        const v10 = hash(x0 + 1, y0);
        const v01 = hash(x0, y0 + 1);
        const v11 = hash(x0 + 1, y0 + 1);

        return lerp(
            lerp(v00, v10, fx),
            lerp(v01, v11, fx),
            fy
        );
    }

    // Multi-octave fractal noise
    function fractalNoise(px, py) {
        let val = 0;
        val += valueNoise(px, py, 280) * 0.45;
        val += valueNoise(px, py, 140) * 0.25;
        val += valueNoise(px, py, 70) * 0.15;
        val += valueNoise(px, py, 35) * 0.10;
        val += valueNoise(px, py, 18) * 0.05;
        return val;
    }

    // ── Generate the height map ──
    const heightMap = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            // Wrap-friendly: use x modulo for horizontal tiling
            const nx = fractalNoise(x, y);
            // Also sample shifted for seamless horizontal wrap blending
            const nxWrap = fractalNoise(x + W, y);
            const blendX = x / W;
            // Smoothly blend near edges for seamless horizontal wrapping
            const wrapBlend = blendX < 0.05 ? blendX / 0.05 :
                              blendX > 0.95 ? (1 - blendX) / 0.05 : 1.0;
            const n = lerp(nxWrap, nx, wrapBlend * 0.5 + 0.5);

            // Reduce land at poles (latitude falloff)
            const lat = Math.abs(y / H - 0.5) * 2; // 0 at equator, 1 at poles
            const poleFalloff = lat > 0.82 ? (1 - (lat - 0.82) / 0.18) * 0.3 : 0;

            heightMap[y * W + x] = n - poleFalloff;
        }
    }

    // ── Render pixels ──
    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;
    const seaLevel = 0.42;

    for (let y = 0; y < H; y++) {
        const lat = Math.abs(y / H - 0.5) * 2; // 0=equator, 1=pole
        for (let x = 0; x < W; x++) {
            const idx = (y * W + x) * 4;
            const h = heightMap[y * W + x];

            let r, g, b;

            if (h < seaLevel) {
                // Ocean — depth-based coloring
                const depth = (seaLevel - h) / seaLevel;
                r = Math.round(lerp(18, 8, depth));
                g = Math.round(lerp(42, 18, depth));
                b = Math.round(lerp(72, 38, depth));
                // Shallow coastal tint
                if (h > seaLevel - 0.04) {
                    const coastal = 1 - (seaLevel - h) / 0.04;
                    r = Math.round(lerp(r, 25, coastal * 0.5));
                    g = Math.round(lerp(g, 60, coastal * 0.6));
                    b = Math.round(lerp(b, 82, coastal * 0.4));
                }
            } else {
                // Land — biome based on latitude + height
                const landH = (h - seaLevel) / (1 - seaLevel); // 0-1 above sea level

                if (lat > 0.85) {
                    // Ice/snow
                    const ice = (lat - 0.85) / 0.15;
                    r = Math.round(lerp(140, 210, ice));
                    g = Math.round(lerp(155, 225, ice));
                    b = Math.round(lerp(165, 240, ice));
                } else if (lat > 0.65) {
                    // Tundra / boreal
                    const t = (lat - 0.65) / 0.2;
                    r = Math.round(lerp(55, 110, t));
                    g = Math.round(lerp(72, 120, t));
                    b = Math.round(lerp(55, 105, t));
                } else if (lat < 0.2) {
                    // Tropical — lush green or dense jungle
                    if (landH > 0.5) {
                        // Highland tropical
                        r = Math.round(lerp(42, 65, landH));
                        g = Math.round(lerp(75, 90, landH));
                        b = Math.round(lerp(35, 50, landH));
                    } else {
                        // Lowland tropical
                        r = Math.round(35 + landH * 25);
                        g = Math.round(70 + landH * 30);
                        b = Math.round(28 + landH * 15);
                    }
                } else if (lat < 0.45) {
                    // Temperate — green/brown mix
                    const moisture = valueNoise(x * 1.3, y * 1.3, 200);
                    if (moisture > 0.5) {
                        // Forested
                        r = Math.round(lerp(40, 60, landH));
                        g = Math.round(lerp(68, 85, landH));
                        b = Math.round(lerp(32, 48, landH));
                    } else {
                        // Grassland/farmland
                        r = Math.round(lerp(72, 95, landH));
                        g = Math.round(lerp(82, 100, landH));
                        b = Math.round(lerp(45, 58, landH));
                    }
                } else {
                    // Arid / desert belt
                    const moisture = valueNoise(x * 1.1, y * 1.1, 180);
                    if (moisture > 0.55) {
                        // Savanna
                        r = Math.round(lerp(85, 110, landH));
                        g = Math.round(lerp(78, 95, landH));
                        b = Math.round(lerp(42, 55, landH));
                    } else {
                        // Desert
                        r = Math.round(lerp(105, 140, landH));
                        g = Math.round(lerp(88, 115, landH));
                        b = Math.round(lerp(55, 72, landH));
                    }
                }

                // Mountain highlights at high elevation
                if (landH > 0.65) {
                    const mt = (landH - 0.65) / 0.35;
                    r = Math.round(lerp(r, 160, mt * 0.5));
                    g = Math.round(lerp(g, 155, mt * 0.5));
                    b = Math.round(lerp(b, 148, mt * 0.5));
                }

                // Coastal darkening right at shoreline
                if (h < seaLevel + 0.015) {
                    const shore = (h - seaLevel) / 0.015;
                    r = Math.round(lerp(r * 0.6, r, shore));
                    g = Math.round(lerp(g * 0.6, g, shore));
                    b = Math.round(lerp(b * 0.65, b, shore));
                }
            }

            // Subtle per-pixel noise for texture
            const noise = (hash(x * 7, y * 13) - 0.5) * 8;
            data[idx] = clamp01((r + noise) / 255) * 255;
            data[idx + 1] = clamp01((g + noise) / 255) * 255;
            data[idx + 2] = clamp01((b + noise) / 255) * 255;
            data[idx + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    // Expose heightmap so city lights can avoid oceans
    return { texture: tex, heightMap, seaLevel, mapW: W, mapH: H };
}

export function createProceduralCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Transparent base
    ctx.clearRect(0, 0, W, H);

    // Large weather systems — wispy, stretched cloud bands
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * W;
        const y = (Math.random() * 0.6 + 0.2) * H;
        const rx = 60 + Math.random() * 120;
        const ry = 20 + Math.random() * 40;
        const opacity = 0.08 + Math.random() * 0.15;
        const rotation = (Math.random() - 0.5) * 0.4;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        g.addColorStop(0.3, `rgba(230, 245, 255, ${opacity * 0.7})`);
        g.addColorStop(1, 'rgba(240, 250, 255, 0)');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Wrap
        for (const ox of [-W, W]) {
            ctx.save();
            ctx.translate(x + ox, y);
            ctx.rotate(rotation);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Smaller cloud puffs for detail
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * W;
        const y = (Math.random() * 0.7 + 0.15) * H;
        const r = Math.random() * 40 + 12;
        const opacity = Math.random() * 0.18;

        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        g.addColorStop(0.5, `rgba(220, 242, 255, ${opacity * 0.5})`);
        g.addColorStop(1, 'rgba(240, 250, 255, 0)');

        ctx.fillStyle = g;
        for (const ox of [0, -W, W]) {
            ctx.beginPath();
            ctx.arc(x + ox, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

export function createProceduralCityLightsTexture(planetData) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Land mask from planet heightmap — lights only on land
    const { heightMap, seaLevel, mapW, mapH } = planetData;
    const isLand = (px, py) => {
        const ix = Math.round(((px % W) + W) % W);
        const iy = Math.round(Math.max(0, Math.min(mapH - 1, py)));
        return heightMap[iy * mapW + ix] >= seaLevel + 0.01; // small margin above shore
    };

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // Helper: draw a single small dot at (x, y) with wrapping, only on land
    const drawDot = (x, y, size, fill) => {
        if (!isLand(x, y)) return;
        ctx.fillStyle = fill;
        for (const ox of [0, -W, W]) {
            ctx.fillRect(x + ox, y, size, size);
        }
    };

    // Helper: draw a scattered cluster of tiny dots, land-only
    const drawScatteredCluster = (cx, cy, spread, dotCount, color) => {
        for (let d = 0; d < dotCount; d++) {
            const dx = (Math.random() + Math.random() + Math.random() - 1.5) * spread;
            const dy = (Math.random() + Math.random() + Math.random() - 1.5) * spread * 0.6;
            const px = cx + dx;
            const py = cy + dy;
            if (!isLand(px, py)) continue;
            const dist = Math.sqrt(dx * dx + dy * dy) / spread;
            const falloff = Math.max(0, 1 - dist * 0.8);
            const dotAlpha = falloff * (0.35 + Math.random() * 0.55);
            const size = Math.random() > 0.82 ? 2 : 1;
            ctx.fillStyle = color.replace(/[\d.]+\)$/, () => dotAlpha.toFixed(2) + ')');
            for (const ox of [0, -W, W]) {
                ctx.fillRect(px + ox, py, size, size);
            }
        }
    };

    // Large metropolitan regions (fewer: 18 instead of 35) — land only
    for (let i = 0; i < 18; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * W;
            y = (Math.random() * 0.5 + 0.25) * H;
            attempts++;
        } while (!isLand(x, y) && attempts < 30);
        if (!isLand(x, y)) continue;

        const spread = 14 + Math.random() * 28;
        const dotCount = Math.round(30 + Math.random() * 40);
        const isCool = Math.random() > 0.75;
        const color = isCool
            ? `rgba(140, 220, 255, 1.0)`
            : `rgba(255, ${Math.round(200 + Math.random() * 40)}, ${Math.round(130 + Math.random() * 40)}, 1.0)`;
        drawScatteredCluster(x, y, spread, dotCount, color);

        // Bright core pixels at center
        for (let c = 0; c < 4 + Math.random() * 6; c++) {
            const coreX = x + (Math.random() - 0.5) * spread * 0.3;
            const coreY = y + (Math.random() - 0.5) * spread * 0.2;
            drawDot(coreX, coreY, Math.random() > 0.5 ? 2 : 1,
                color.replace(/[\d.]+\)$/, () => (0.6 + Math.random() * 0.35).toFixed(2) + ')'));
        }
    }

    // Medium city clusters (fewer: 160 instead of 380) — land only
    for (let i = 0; i < 160; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * W;
            const latitudeBias = (Math.random() * 0.56 + 0.22) * H;
            y = latitudeBias + (Math.random() - 0.5) * 110;
            attempts++;
        } while (!isLand(x, y) && attempts < 20);
        if (!isLand(x, y)) continue;

        const spread = 3 + Math.random() * 10;
        const dotCount = Math.round(4 + Math.random() * 12);
        const isCool = Math.random() > 0.65;
        const color = isCool
            ? `rgba(120, ${Math.round(210 + Math.random() * 40)}, 255, 1.0)`
            : `rgba(255, ${Math.round(180 + Math.random() * 55)}, ${Math.round(100 + Math.random() * 50)}, 1.0)`;
        drawScatteredCluster(x, y, spread, dotCount, color);
    }

    // Individual bright dots — towns (fewer: 1500 instead of 4000) — land only
    for (let i = 0; i < 1500; i++) {
        const x = Math.random() * W;
        const y = (Math.random() * 0.64 + 0.18) * H;
        if (!isLand(x, y)) continue;
        const alpha = 0.15 + Math.random() * 0.5;
        const size = Math.random() > 0.88 ? 2 : 1;
        const fill = Math.random() > 0.7
            ? `rgba(160, 230, 255, ${(alpha * 0.85).toFixed(2)})`
            : `rgba(255, ${Math.round(200 + Math.random() * 40)}, ${Math.round(130 + Math.random() * 40)}, ${alpha.toFixed(2)})`;
        drawDot(x, y, size, fill);
    }

    // ── Glow pass: downscale → upscale to create soft bloom around lights ──
    const glowCanvas = document.createElement('canvas');
    const glowSize = 256;
    glowCanvas.width = glowSize;
    glowCanvas.height = glowSize / 2;
    const glowCtx = glowCanvas.getContext('2d');
    // Downscale (acts as box blur)
    glowCtx.drawImage(canvas, 0, 0, glowSize, glowSize / 2);

    // Second pass at medium resolution
    const midCanvas = document.createElement('canvas');
    midCanvas.width = 512;
    midCanvas.height = 256;
    const midCtx = midCanvas.getContext('2d');
    midCtx.drawImage(canvas, 0, 0, 512, 256);

    // Composite glow layers back onto original
    ctx.globalCompositeOperation = 'lighter';
    // Large soft glow
    ctx.globalAlpha = 0.5;
    ctx.drawImage(glowCanvas, 0, 0, W, H);
    // Medium glow for tighter halos
    ctx.globalAlpha = 0.35;
    ctx.drawImage(midCanvas, 0, 0, W, H);
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

export function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
    // Avoid black artifacts
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

export function createSoftGlowTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    const center = size / 2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (x - center) / center;
            const dy = (y - center) / center;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= 1) continue;

            const angle = Math.atan2(dy, dx);
            const breakup = 0.96
                + Math.sin(angle * 5.0 + dist * 10.0) * 0.05
                + Math.cos(angle * 9.0 - dist * 16.0) * 0.03;
            const core = Math.pow(1 - dist, 2.45);
            const midGlow = Math.exp(-Math.pow((dist - 0.38) / 0.26, 2.0)) * 0.34;
            const edgeFade = 1 - smoothstep(0.76, 1.0, dist);
            const alpha = clamp01((core * 0.92 + midGlow) * breakup * edgeFade);
            const index = (y * size + x) * 4;

            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = Math.round(alpha * 255);
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

export function createHaloRingTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    const center = size / 2;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (x - center) / center;
            const dy = (y - center) / center;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= 1) continue;

            const angle = Math.atan2(dy, dx);
            const breakup = 0.94
                + Math.sin(angle * 6.0 + dist * 12.0) * 0.06
                + Math.cos(angle * 13.0 - dist * 20.0) * 0.04;
            const ring = Math.exp(-Math.pow((dist - 0.69) / 0.16, 2.0));
            const fill = Math.exp(-Math.pow((dist - 0.5) / 0.32, 2.0)) * 0.22;
            const edgeFade = 1 - smoothstep(0.84, 1.0, dist);
            const alpha = clamp01((ring * 0.88 + fill) * breakup * edgeFade);
            const index = (y * size + x) * 4;

            data[index] = 255;
            data[index + 1] = 255;
            data[index + 2] = 255;
            data[index + 3] = Math.round(alpha * 255);
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

export function createNebulaTexture(palette = []) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const paintCanvas = document.createElement('canvas');
    paintCanvas.width = canvas.width;
    paintCanvas.height = canvas.height;
    const paint = paintCanvas.getContext('2d');

    const colors = palette.length
        ? palette
        : [
            'rgba(0, 242, 255, 0.24)',
            'rgba(42, 98, 255, 0.16)',
            'rgba(255, 162, 110, 0.12)'
        ];

    paint.clearRect(0, 0, canvas.width, canvas.height);
    paint.globalCompositeOperation = 'screen';

    // Large diffuse base clouds — very soft, wide coverage
    for (let i = 0; i < 18; i++) {
        const x = canvas.width * 0.15 + Math.random() * canvas.width * 0.7;
        const y = canvas.height * 0.15 + Math.random() * canvas.height * 0.7;
        const radius = 180 + Math.random() * 260;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const stretchX = 1.2 + Math.random() * 1.4;
        const stretchY = 0.5 + Math.random() * 0.8;
        const rotation = Math.random() * Math.PI;
        const gradient = paint.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.25, color);
        gradient.addColorStop(0.55, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.5).toFixed(2) + ')'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        paint.save();
        paint.translate(x, y);
        paint.rotate(rotation);
        paint.scale(stretchX, stretchY);
        paint.fillStyle = gradient;
        paint.beginPath();
        paint.arc(0, 0, radius, 0, Math.PI * 2);
        paint.fill();
        paint.restore();
    }

    // Medium detail clusters — add nebula structure
    for (let i = 0; i < 36; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 80 + Math.random() * 160;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const stretchX = 1.0 + Math.random() * 1.2;
        const stretchY = 0.4 + Math.random() * 0.7;
        const rotation = Math.random() * Math.PI;
        const gradient = paint.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.4, color);
        gradient.addColorStop(0.7, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.35).toFixed(2) + ')'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        paint.save();
        paint.translate(x, y);
        paint.rotate(rotation);
        paint.scale(stretchX, stretchY);
        paint.fillStyle = gradient;
        paint.beginPath();
        paint.arc(0, 0, radius, 0, Math.PI * 2);
        paint.fill();
        paint.restore();
    }

    // Small bright wisps — fine detail without hard edges
    for (let i = 0; i < 24; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 40 + Math.random() * 90;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const stretchX = 1.5 + Math.random() * 2.0;
        const stretchY = 0.25 + Math.random() * 0.35;
        const rotation = Math.random() * Math.PI;
        const gradient = paint.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.3, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.6).toFixed(2) + ')'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        paint.save();
        paint.translate(x, y);
        paint.rotate(rotation);
        paint.scale(stretchX, stretchY);
        paint.fillStyle = gradient;
        paint.beginPath();
        paint.arc(0, 0, radius, 0, Math.PI * 2);
        paint.fill();
        paint.restore();
    }

    // Blur pass — stack-blur via downscale/upscale for seamless softness
    const blurCanvas = document.createElement('canvas');
    const blurSize = 256;
    blurCanvas.width = blurSize;
    blurCanvas.height = blurSize;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.drawImage(paintCanvas, 0, 0, blurSize, blurSize);

    const midCanvas = document.createElement('canvas');
    midCanvas.width = 512;
    midCanvas.height = 512;
    const midCtx = midCanvas.getContext('2d');
    midCtx.drawImage(blurCanvas, 0, 0, 512, 512);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Layer 1: heavily blurred base (downscaled then upscaled)
    ctx.globalAlpha = 0.7;
    ctx.drawImage(blurCanvas, 0, 0, canvas.width, canvas.height);
    // Layer 2: medium blur for mid-detail
    ctx.globalAlpha = 0.5;
    ctx.drawImage(midCanvas, 0, 0, canvas.width, canvas.height);
    // Layer 3: original detail on top at reduced opacity
    ctx.globalAlpha = 0.35;
    ctx.drawImage(paintCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const edgeScale = Math.min(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4 + 3;
            const edgeDistance = Math.min(x, canvas.width - 1 - x, y, canvas.height - 1 - y) / edgeScale;
            const edgeFade = smoothstep(0.0, 0.25, edgeDistance);
            const rx = (x - centerX) / centerX;
            const ry = (y - centerY) / centerY;
            const radialDistance = Math.sqrt(rx * rx + ry * ry);
            const radialFade = 1 - smoothstep(0.6, 1.0, radialDistance);

            data[index] = Math.round(data[index] * edgeFade * radialFade);
        }
    }
    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

export function createProceduralMoonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base Grey Surface
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Large scale terrain variation
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 30 + Math.random() * 80;
        const val = 60 + Math.random() * 40;
        ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
        
        const drawBlob = (bx, by, br) => {
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
            // Wrap horizontal
            ctx.beginPath(); ctx.arc(bx - canvas.width, by, br, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(bx + canvas.width, by, br, 0, Math.PI * 2); ctx.fill();
        };
        drawBlob(x, y, r);
    }

    // Crater details
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 2 + Math.random() * 14;
        
        const drawCrater = (cx, cy, cr) => {
            // Dark pit
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
            // Bright rim highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(cx - 1, cy - 1, cr + 1, 0, Math.PI * 2); ctx.stroke();
        };

        drawCrater(x, y, r);
        // Wrap horizontal
        drawCrater(x - canvas.width, y, r);
        drawCrater(x + canvas.width, y, r);
    }

    // Fine detail noise
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const brightness = Math.random() > 0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.05)`;
        ctx.fillRect(x, y, 1, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}
