/* Updated: Organized app hierarchy, moved to src/core folder, fixed imports and paths */
import * as THREE from 'three';

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

export function createNebulaTexture(palette = []) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const colors = palette.length
        ? palette
        : [
            'rgba(0, 242, 255, 0.24)',
            'rgba(42, 98, 255, 0.16)',
            'rgba(255, 162, 110, 0.12)'
        ];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 36; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 80 + Math.random() * 210;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        ctx.strokeStyle = color;
        ctx.lineWidth = 26 + Math.random() * 74;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.bezierCurveTo(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            Math.random() * canvas.width,
            Math.random() * canvas.height
        );
        ctx.stroke();
    }

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
