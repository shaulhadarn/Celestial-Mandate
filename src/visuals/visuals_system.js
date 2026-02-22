/* Updated: Desktop planets upgraded to MeshPhysicalMaterial with per-type clearcoat/roughness, 64-segment geometry, inner atmosphere rim layer */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { gameState } from '../core/state.js';

const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

export let planetMeshes = [];
export let planetLabels = [];

export function clearSystemVisuals(group) {
    while(group.children.length > 0) group.remove(group.children[0]);
    planetMeshes.length = 0;
    planetLabels.length = 0;
}

export function createSystemVisuals(system, group) {
    clearSystemVisuals(group);
    if (!system) return;

    createSystemBackground(group);

    // Star
    const starGeo = new THREE.SphereGeometry(5, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: system.color });
    const star = new THREE.Mesh(starGeo, starMat);
    group.add(star);

    // Glow sprite — desktop only, additive sprites cause light-ray artifacts on mobile GPUs
    if (!isMobileDevice) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow,
            color: system.color,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
        }));
        glow.scale.set(12, 12, 12);
        glow.renderOrder = 1;
        group.add(glow);
    }

    // Light — reduced on mobile to prevent bloom/light-ray artifacts
    const pointLight = new THREE.PointLight(system.color, isMobileDevice ? 20 : 80, isMobileDevice ? 80 : 60);
    group.add(pointLight);

    // Ambient light — higher on mobile since we lose specular highlights
    const ambientLight = new THREE.AmbientLight(0xffffff, isMobileDevice ? 2.0 : 1.2);
    group.add(ambientLight);

    // Planets
    system.planets.forEach(p => {
        let tex = textures.barren;
        let atmosphereColor = null;
        let matColor = 0xffffff;
        let scale = 1;

        // Map types to textures
        let emissiveColor = 0x000000;
        let emissiveIntensity = 0.0;
        switch(p.type) {
            case 'Terran':
            case 'Continental':
                tex = textures.terran; 
                atmosphereColor = 0x00aaff;
                emissiveColor = 0x112244;
                emissiveIntensity = 0.3;
                break;
            case 'Ocean':
                tex = textures.terran;
                matColor = 0xaaddff;
                atmosphereColor = 0x0088ff;
                emissiveColor = 0x112244;
                emissiveIntensity = 0.3;
                break;
            case 'Gas Giant':
                tex = textures.gas; 
                atmosphereColor = 0xffaa00;
                emissiveColor = 0x331100;
                emissiveIntensity = 0.4;
                break;
            case 'Ice':
            case 'Arctic':
                tex = textures.barren; 
                matColor = 0xddeeff; 
                atmosphereColor = 0xaaddff;
                emissiveColor = 0x112233;
                emissiveIntensity = 0.2;
                break;
            case 'Molten':
                tex = textures.barren; 
                matColor = 0xcc4411; 
                atmosphereColor = 0xff4400;
                emissiveColor = 0x661100;
                emissiveIntensity = 0.6;
                break;
            case 'Desert':
                tex = textures.barren;
                matColor = 0xddbb88;
                atmosphereColor = 0xffaa66;
                emissiveColor = 0x221100;
                emissiveIntensity = 0.2;
                break;
            case 'Tomb':
                tex = textures.barren;
                matColor = 0x888888;
                atmosphereColor = 0x444444;
                emissiveColor = 0x111111;
                emissiveIntensity = 0.1;
                break;
            case 'Asteroid':
                tex = textures.barren;
                scale = 0.5;
                break;
            default: // Barren
                tex = textures.barren;
                matColor = 0xbbbbbb;
                emissiveColor = 0x111111;
                emissiveIntensity = 0.1;
        }

        // Higher resolution geometry on desktop
        const segments = isMobileDevice ? 32 : 64;
        const pGeo = new THREE.SphereGeometry(p.size * 2 * scale, segments, segments);

        // Per-type physical material properties
        let roughness = 0.75, metalness = 0.0, clearcoat = 0.0, clearcoatRoughness = 0.3;
        switch (p.type) {
            case 'Ocean':       roughness = 0.15; clearcoat = 0.8; clearcoatRoughness = 0.1; break;
            case 'Terran':
            case 'Continental': roughness = 0.65; clearcoat = 0.2; clearcoatRoughness = 0.4; break;
            case 'Gas Giant':   roughness = 0.4;  clearcoat = 0.5; clearcoatRoughness = 0.2; break;
            case 'Ice':
            case 'Arctic':      roughness = 0.2;  clearcoat = 0.9; clearcoatRoughness = 0.05; metalness = 0.1; break;
            case 'Molten':      roughness = 0.9;  metalness = 0.3; break;
            case 'Desert':      roughness = 0.95; break;
            case 'Tomb':        roughness = 0.85; metalness = 0.05; break;
            default:            roughness = 0.85; break;
        }

        const pMat = isMobileDevice
            ? new THREE.MeshLambertMaterial({
                map: tex, color: matColor,
                emissive: new THREE.Color(emissiveColor), emissiveIntensity
              })
            : new THREE.MeshPhysicalMaterial({
                map: tex, color: matColor,
                roughness, metalness, clearcoat, clearcoatRoughness,
                emissive: new THREE.Color(emissiveColor), emissiveIntensity,
                envMapIntensity: 0.6
              });
        const mesh = new THREE.Mesh(pGeo, pMat);

        if (atmosphereColor !== null) {
            // Outer atmosphere shell
            const atmoGeo = new THREE.SphereGeometry(p.size * 2.15 * scale, segments, segments);
            const atmoMat = new THREE.MeshBasicMaterial({
                color: atmosphereColor, transparent: true,
                opacity: isMobileDevice ? 0.12 : 0.08,
                blending: isMobileDevice ? THREE.NormalBlending : THREE.AdditiveBlending,
                side: THREE.BackSide, depthWrite: false
            });
            mesh.add(new THREE.Mesh(atmoGeo, atmoMat));

            // Inner atmosphere rim (desktop only) — adds a bright limb glow
            if (!isMobileDevice) {
                const rimGeo = new THREE.SphereGeometry(p.size * 2.05 * scale, segments, segments);
                const rimMat = new THREE.MeshBasicMaterial({
                    color: atmosphereColor, transparent: true, opacity: 0.06,
                    blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false
                });
                mesh.add(new THREE.Mesh(rimGeo, rimMat));

                // Outer glow halo sprite
                const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: textures.glow,
                    color: atmosphereColor,
                    transparent: true,
                    opacity: 0.28,
                    blending: THREE.AdditiveBlending, depthWrite: false
                }));
                glowSprite.scale.set(p.size * 5.5 * scale, p.size * 5.5 * scale, 1);
                mesh.add(glowSprite);
            }
        }
        
        mesh.position.set(Math.cos(p.angle) * p.distance, 0, Math.sin(p.angle) * p.distance);
        mesh.userData = { id: p.id, data: p };
        
        group.add(mesh);
        planetMeshes.push(mesh);

        // Orbit
        const orbitGeo = new THREE.RingGeometry(p.distance - 0.05, p.distance + 0.05, 128);
        const orbitMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            opacity: 0.08, 
            transparent: true, 
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const orbit = new THREE.Mesh(orbitGeo, orbitMat);
        orbit.rotation.x = Math.PI / 2;
        group.add(orbit);

        // Label
        const label = createTextSprite(p.name);
        label.userData = { id: p.id, data: p };
        group.add(label);
        planetLabels.push({ sprite: label, target: mesh, offsetY: - (p.size * 2.5) - 2 });

        if (gameState.colonies[p.id]) {
            addColonyVisual(mesh);
        }
    });
}

export function addColonyVisual(planetMesh) {
    const colonyGroup = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.2, 0.2, 1, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
    colonyGroup.add(new THREE.Mesh(geo, mat));
    
    const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    colonyGroup.add(ring);

    colonyGroup.position.set(planetMesh.geometry.parameters.radius * 1.5, 0, 0);
    colonyGroup.rotation.z = 0.5;
    planetMesh.add(colonyGroup);
}

export function updateSystemAnimations(time) {
    planetMeshes.forEach(mesh => {
        const data = mesh.userData.data;
        const speed = data.speed * 10;
        mesh.position.x = Math.cos(data.angle + time * speed) * data.distance;
        mesh.position.z = Math.sin(data.angle + time * speed) * data.distance;
        mesh.rotation.y += 0.005;
    });

    planetLabels.forEach(item => {
        if(item.target && item.sprite) {
            item.sprite.position.copy(item.target.position);
            item.sprite.position.y += item.offsetY;
        }
    });
}

function createTextSprite(text) {
    const PIXEL_SCALE = 2;
    const fontSize = 20;
    const font = `600 ${fontSize * PIXEL_SCALE}px "Rajdhani", sans-serif`;

    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const metrics = measure.measureText(text);

    const GLOW_PAD = 5 * PIXEL_SCALE;
    const w = Math.ceil(metrics.width) + GLOW_PAD * 2;
    const h = (fontSize + 8) * PIXEL_SCALE + GLOW_PAD * 2;
    const cx = w / 2;
    const cy = h / 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Single very subtle halo — thin and low opacity
    ctx.lineWidth   = 3 * PIXEL_SCALE;
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.10)';
    ctx.strokeText(text, cx, cy);

    // Thin dark outline for readability
    ctx.lineWidth   = 1.2 * PIXEL_SCALE;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeText(text, cx, cy);

    // Pure white fill for maximum readability
    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.fillText(text, cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.90, depthTest: true, depthWrite: false
    }));
    sprite.scale.set((w * 0.035) / PIXEL_SCALE, (h * 0.035) / PIXEL_SCALE, 1);
    return sprite;
}

function _makeNebulaTexture(r, g, b, size) {
    const s = size || 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    const cx = s / 2, cy = s / 2;

    // Outer soft cloud
    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.5);
    g1.addColorStop(0,   `rgba(${r},${g},${b},0.55)`);
    g1.addColorStop(0.3, `rgba(${r},${g},${b},0.28)`);
    g1.addColorStop(0.6, `rgba(${r},${g},${b},0.10)`);
    g1.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, s, s);

    // Inner bright core
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.18);
    g2.addColorStop(0,   `rgba(${Math.min(r+60,255)},${Math.min(g+60,255)},${Math.min(b+60,255)},0.5)`);
    g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, s, s);

    return new THREE.CanvasTexture(c);
}

function _makeGalaxyBandTexture() {
    const w = 512, h = 128;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0,    'rgba(180,200,255,0)');
    g.addColorStop(0.25, 'rgba(180,200,255,0.07)');
    g.addColorStop(0.5,  'rgba(220,230,255,0.13)');
    g.addColorStop(0.75, 'rgba(180,200,255,0.07)');
    g.addColorStop(1,    'rgba(180,200,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Add some star-cluster blobs along the band
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * w;
        const y = h * 0.3 + Math.random() * h * 0.4;
        const r = 4 + Math.random() * 18;
        const bg = ctx.createRadialGradient(x, y, 0, x, y, r);
        bg.addColorStop(0, 'rgba(255,255,255,0.18)');
        bg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    return new THREE.CanvasTexture(c);
}

function createSystemBackground(group) {
    // ── 1. Dense layered starfield ────────────────────────────────────────────
    const starCount = isMobileDevice ? 2500 : 5000;
    const posArray = new Float32Array(starCount * 3);
    const colArray = new Float32Array(starCount * 3);
    const sizeArray = new Float32Array(starCount);
    const color = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
        const r = 350 + Math.random() * 450;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        posArray[i*3]   = r * Math.sin(phi) * Math.cos(theta);
        posArray[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[i*3+2] = r * Math.cos(phi);

        const hue = Math.random();
        if      (hue > 0.96) color.setHex(0xffffff);  // pure white bright
        else if (hue > 0.88) color.setHex(0xffeedd);  // warm yellow
        else if (hue > 0.78) color.setHex(0xaaccff);  // blue-white
        else if (hue > 0.65) color.setHex(0xffccaa);  // orange
        else if (hue > 0.50) color.setHex(0xddddff);  // pale blue
        else                 color.setHex(0x7788aa);  // dim blue-grey

        colArray[i*3]   = color.r;
        colArray[i*3+1] = color.g;
        colArray[i*3+2] = color.b;

        // Size variation: most tiny, a few large
        const sz = Math.random();
        sizeArray[i] = sz > 0.97 ? 3.5 : sz > 0.90 ? 2.2 : sz > 0.70 ? 1.5 : 0.9;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    starGeo.setAttribute('color',    new THREE.BufferAttribute(colArray, 3));
    starGeo.setAttribute('size',     new THREE.BufferAttribute(sizeArray, 1));

    const starMat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
            precision highp float;
            attribute vec3 color;
            attribute float size;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (320.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            precision highp float;
            varying vec3 vColor;
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float d = length(coord);
                if (d > 0.5) discard;
                float alpha = (1.0 - d * 2.0) * 0.95;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
    });

    group.add(new THREE.Points(starGeo, starMat));

    if (isMobileDevice) return; // skip heavy layers on mobile

    // ── 2. Galaxy band (Milky Way streak) ────────────────────────────────────
    const bandTex = _makeGalaxyBandTexture();
    const bandMat = new THREE.SpriteMaterial({
        map: bandTex, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const band = new THREE.Sprite(bandMat);
    band.position.set(0, 0, -480);
    band.scale.set(1400, 320, 1);
    band.rotation = 0.35;
    group.add(band);

    // Second band at a slight angle for depth
    const bandMat2 = new THREE.SpriteMaterial({
        map: bandTex, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    const band2 = new THREE.Sprite(bandMat2);
    band2.position.set(60, 80, -460);
    band2.scale.set(1100, 200, 1);
    group.add(band2);

    // ── 3. Rich layered nebulae ───────────────────────────────────────────────
    const nebulaDefs = [
        // [r, g, b, x, y, z, scale, opacity]
        [  30,  60, 160,  200, 120, -400, 420, 0.22 ],  // deep blue
        [ 120,  20, 180, -180,  80, -380, 380, 0.20 ],  // purple
        [  20, 120,  80,  -60,-160, -420, 340, 0.18 ],  // teal green
        [ 180,  40,  20,  160,-100, -390, 300, 0.16 ],  // red-orange
        [  60,  30, 140, -220,-120, -410, 360, 0.14 ],  // indigo
        [  20,  80, 160,  100, 200, -430, 280, 0.17 ],  // cyan
        [ 140,  80,  20, -100, 180, -400, 320, 0.13 ],  // amber
        [  80, 160,  60,  240, -60, -370, 260, 0.12 ],  // lime
    ];

    nebulaDefs.forEach(([r, g, b, x, y, z, scale, opacity]) => {
        const tex = _makeNebulaTexture(r, g, b, 256);
        const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(x, y, z);
        sprite.scale.set(scale, scale, 1);
        group.add(sprite);
    });

    // ── 4. Accent nebula wisps (smaller, brighter) ───────────────────────────
    const wispDefs = [
        [  80, 140, 255,  280,  60, -350, 160, 0.28 ],
        [ 255,  80, 120, -260, -80, -360, 140, 0.24 ],
        [  80, 255, 200,  -40, 260, -340, 130, 0.22 ],
        [ 255, 180,  60,  180,-220, -355, 120, 0.20 ],
        [ 160,  80, 255, -200, 200, -345, 150, 0.22 ],
    ];

    wispDefs.forEach(([r, g, b, x, y, z, scale, opacity]) => {
        const tex = _makeNebulaTexture(r, g, b, 128);
        const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(x, y, z);
        sprite.scale.set(scale, scale, 1);
        group.add(sprite);
    });

    // ── 5. Bright foreground star clusters ───────────────────────────────────
    const clusterCount = 60;
    const cPosArray  = new Float32Array(clusterCount * 3);
    const cColArray  = new Float32Array(clusterCount * 3);
    const cSizeArray = new Float32Array(clusterCount);
    const clusterColors = [0xffffff, 0xffeebb, 0xaaddff, 0xffccaa, 0xccddff];

    for (let i = 0; i < clusterCount; i++) {
        const r = 200 + Math.random() * 180;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        cPosArray[i*3]   = r * Math.sin(phi) * Math.cos(theta);
        cPosArray[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        cPosArray[i*3+2] = r * Math.cos(phi);
        const c = new THREE.Color(clusterColors[Math.floor(Math.random() * clusterColors.length)]);
        cColArray[i*3]   = c.r;
        cColArray[i*3+1] = c.g;
        cColArray[i*3+2] = c.b;
        cSizeArray[i] = 2.5 + Math.random() * 4.0;
    }

    const clusterGeo = new THREE.BufferGeometry();
    clusterGeo.setAttribute('position', new THREE.BufferAttribute(cPosArray, 3));
    clusterGeo.setAttribute('color',    new THREE.BufferAttribute(cColArray, 3));
    clusterGeo.setAttribute('size',     new THREE.BufferAttribute(cSizeArray, 1));

    const clusterMat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
            precision highp float;
            attribute vec3 color;
            attribute float size;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            precision highp float;
            varying vec3 vColor;
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float d = length(coord);
                if (d > 0.5) discard;
                float core = smoothstep(0.5, 0.0, d);
                float halo = smoothstep(0.5, 0.1, d) * 0.4;
                gl_FragColor = vec4(vColor, core + halo);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
    });

    group.add(new THREE.Points(clusterGeo, clusterMat));
}