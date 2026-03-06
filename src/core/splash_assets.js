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
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base Deep Blue "Ocean"
    ctx.fillStyle = '#001a33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Continent colors: various shades of darker and medium blue
    const landColors = ['#002244', '#003366', '#004080', '#0059b3'];
    
    // 1. Generate irregular continents using clusters of blobs
    const continentCount = 6;
    for (let c = 0; c < continentCount; c++) {
        const centerX = Math.random() * canvas.width;
        const centerY = Math.random() * canvas.height;
        const landSize = 10 + Math.random() * 15; // Number of blobs per continent
        const baseHue = landColors[Math.floor(Math.random() * landColors.length)];

        for (let i = 0; i < landSize; i++) {
            const x = centerX + (Math.random() - 0.5) * 150;
            const y = centerY + (Math.random() - 0.5) * 100;
            const r = 20 + Math.random() * 60;
            
            ctx.fillStyle = baseHue;
            
            // Draw blob with horizontal wrapping
            const drawBlob = (bx, by, br) => {
                ctx.beginPath();
                ctx.arc(bx, by, br, 0, Math.PI * 2);
                ctx.fill();
                // Wrap left
                ctx.beginPath();
                ctx.arc(bx - canvas.width, by, br, 0, Math.PI * 2);
                ctx.fill();
                // Wrap right
                ctx.beginPath();
                ctx.arc(bx + canvas.width, by, br, 0, Math.PI * 2);
                ctx.fill();
            };

            drawBlob(x, y, r);
        }
    }

    // 2. Add "Special Areas" (Lighter blue plateaus or energy cracks)
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * 15 + 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        
        // Brighter electric blue for highlights
        g.addColorStop(0, 'rgba(0, 242, 255, 0.4)');
        g.addColorStop(1, 'rgba(0, 242, 255, 0)');
        
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        
        // Wrap highlights
        if (x + r > canvas.width) {
            ctx.beginPath();
            ctx.arc(x - canvas.width, y, r, 0, Math.PI * 2);
            ctx.fill();
        } else if (x - r < 0) {
            ctx.beginPath();
            ctx.arc(x + canvas.width, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 3. Add fine detail / noise for texture depth
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

export function createProceduralCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Transparent base
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reduced cloud density and opacity to ensure surface visibility
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * canvas.width;
        const y = (Math.random() * 0.7 + 0.15) * canvas.height;
        const r = Math.random() * 60 + 20;
        const opacity = Math.random() * 0.25; // Lower opacity
        
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        g.addColorStop(0.4, `rgba(200, 240, 255, ${opacity * 0.6})`); // Light blue tint
        g.addColorStop(1, 'rgba(230, 250, 255, 0)');
        
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Pixel-perfect horizontal wrapping for seamless rotation
        if (x + r > canvas.width) {
            ctx.beginPath();
            ctx.arc(x - canvas.width, y, r, 0, Math.PI * 2);
            ctx.fill();
        } else if (x - r < 0) {
            ctx.beginPath();
            ctx.arc(x + canvas.width, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter; // Ensure smooth interpolation across the seam
    return tex;
}

export function createProceduralCityLightsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const drawCluster = (x, y, radius, color) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.35, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    };

    const clusterCount = 260;
    for (let i = 0; i < clusterCount; i++) {
        const x = Math.random() * canvas.width;
        const latitudeBias = (Math.random() * 0.56 + 0.22) * canvas.height;
        const y = latitudeBias + (Math.random() - 0.5) * 90;
        const radius = 4 + Math.random() * 20;
        const isCool = Math.random() > 0.7;
        const color = isCool
            ? `rgba(110, ${200 + Math.random() * 30}, 255, ${0.18 + Math.random() * 0.18})`
            : `rgba(255, ${170 + Math.random() * 55}, ${95 + Math.random() * 40}, ${0.22 + Math.random() * 0.22})`;

        drawCluster(x, y, radius, color);
        drawCluster(x - canvas.width, y, radius, color);
        drawCluster(x + canvas.width, y, radius, color);
    }

    for (let i = 0; i < 1800; i++) {
        const x = Math.random() * canvas.width;
        const y = (Math.random() * 0.64 + 0.18) * canvas.height;
        const alpha = 0.12 + Math.random() * 0.35;
        const size = Math.random() > 0.82 ? 2 : 1;
        const fill = Math.random() > 0.76
            ? `rgba(140, 220, 255, ${alpha * 0.9})`
            : `rgba(255, ${190 + Math.random() * 40}, ${120 + Math.random() * 40}, ${alpha})`;

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, size, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
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
