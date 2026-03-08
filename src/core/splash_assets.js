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

    // Deep ocean base
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);

    // Helper: draw blob with horizontal wrapping
    const drawBlob = (bx, by, br, style) => {
        ctx.fillStyle = style;
        for (const ox of [0, -W, W]) {
            ctx.beginPath();
            ctx.arc(bx + ox, by, br, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    // 1. Ocean depth variation — dark blues and teals
    const oceanColors = ['#0c1e38', '#0e2440', '#0a2035', '#102a48', '#08283a'];
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = 60 + Math.random() * 140;
        drawBlob(x, y, r, oceanColors[Math.floor(Math.random() * oceanColors.length)]);
    }

    // 2. Continental landmasses — earth tones (browns, tans, greens)
    const continentPalettes = [
        ['#3d5a2e', '#4a6b35', '#2d4a22', '#5a7845'],  // temperate green
        ['#6b5a3e', '#7a684a', '#8c7856', '#5a4a32'],   // desert/arid brown
        ['#4a5a4a', '#3a4e3a', '#556b55', '#2e3e2e'],   // dark forest
        ['#7a6850', '#8a7860', '#6a5840', '#9a8868'],    // sandy/savanna
    ];

    const continentCount = 7;
    for (let c = 0; c < continentCount; c++) {
        const centerX = Math.random() * W;
        const centerY = H * 0.15 + Math.random() * H * 0.7;
        const palette = continentPalettes[Math.floor(Math.random() * continentPalettes.length)];
        const blobCount = 12 + Math.random() * 18;
        const spreadX = 100 + Math.random() * 120;
        const spreadY = 60 + Math.random() * 80;

        for (let i = 0; i < blobCount; i++) {
            const x = centerX + (Math.random() - 0.5) * spreadX;
            const y = centerY + (Math.random() - 0.5) * spreadY;
            const r = 15 + Math.random() * 55;
            drawBlob(x, y, r, palette[Math.floor(Math.random() * palette.length)]);
        }

        // Add terrain detail within continents
        for (let i = 0; i < blobCount * 2; i++) {
            const x = centerX + (Math.random() - 0.5) * spreadX * 0.9;
            const y = centerY + (Math.random() - 0.5) * spreadY * 0.9;
            const r = 5 + Math.random() * 20;
            const shade = palette[Math.floor(Math.random() * palette.length)];
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, shade);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            for (const ox of [0, -W, W]) {
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x + ox, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 3. Ice caps at poles
    for (let pole = 0; pole < 2; pole++) {
        const py = pole === 0 ? 0 : H;
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * W;
            const y = py + (pole === 0 ? 1 : -1) * Math.random() * 50;
            const r = 20 + Math.random() * 50;
            const alpha = 0.15 + Math.random() * 0.2;
            drawBlob(x, y, r, `rgba(200, 220, 240, ${alpha})`);
        }
    }

    // 4. Coastal shallows — lighter blue-green near land edges
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = Math.random() * 25 + 5;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(30, 80, 100, 0.25)');
        grad.addColorStop(1, 'rgba(20, 60, 80, 0)');
        for (const ox of [0, -W, W]) {
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x + ox, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 5. Mountain highlights — lighter streaks on landmasses
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = Math.random() * 12 + 3;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(180, 170, 150, 0.3)');
        grad.addColorStop(1, 'rgba(160, 150, 130, 0)');
        for (const ox of [0, -W, W]) {
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x + ox, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 6. Fine detail noise
    for (let i = 0; i < 1200; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const bright = Math.random() > 0.5;
        ctx.fillStyle = bright ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
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

export function createProceduralCityLightsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const drawCluster = (x, y, radius, color) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.3, color);
        gradient.addColorStop(0.7, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.4).toFixed(2) + ')'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        for (const ox of [0, -W, W]) {
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x + ox, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    // Large metropolitan regions — bright cores
    for (let i = 0; i < 35; i++) {
        const x = Math.random() * W;
        const y = (Math.random() * 0.5 + 0.25) * H;
        const radius = 18 + Math.random() * 35;
        const alpha = 0.4 + Math.random() * 0.35;
        const isCool = Math.random() > 0.75;
        const color = isCool
            ? `rgba(140, 220, 255, ${alpha})`
            : `rgba(255, ${200 + Math.random() * 40}, ${130 + Math.random() * 40}, ${alpha})`;
        drawCluster(x, y, radius, color);
    }

    // Medium city clusters
    const clusterCount = 380;
    for (let i = 0; i < clusterCount; i++) {
        const x = Math.random() * W;
        const latitudeBias = (Math.random() * 0.56 + 0.22) * H;
        const y = latitudeBias + (Math.random() - 0.5) * 110;
        const radius = 4 + Math.random() * 18;
        const isCool = Math.random() > 0.65;
        const color = isCool
            ? `rgba(120, ${210 + Math.random() * 40}, 255, ${0.22 + Math.random() * 0.25})`
            : `rgba(255, ${180 + Math.random() * 55}, ${100 + Math.random() * 50}, ${0.28 + Math.random() * 0.3})`;
        drawCluster(x, y, radius, color);
    }

    // Connected highway/transport lines between clusters
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 60; i++) {
        const x1 = Math.random() * W;
        const y1 = (Math.random() * 0.5 + 0.25) * H;
        const x2 = x1 + (Math.random() - 0.5) * 200;
        const y2 = y1 + (Math.random() - 0.5) * 80;
        const alpha = 0.06 + Math.random() * 0.08;
        ctx.strokeStyle = `rgba(255, 210, 140, ${alpha})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Individual bright dots — towns and villages
    for (let i = 0; i < 3500; i++) {
        const x = Math.random() * W;
        const y = (Math.random() * 0.64 + 0.18) * H;
        const alpha = 0.15 + Math.random() * 0.5;
        const size = Math.random() > 0.85 ? 2 : 1;
        const fill = Math.random() > 0.7
            ? `rgba(160, 230, 255, ${alpha * 0.85})`
            : `rgba(255, ${200 + Math.random() * 40}, ${130 + Math.random() * 40}, ${alpha})`;

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, size, size);
    }

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
