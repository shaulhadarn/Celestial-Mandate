/* Updated: Fix mobile flicker/square artifacts by reducing additive glows and skipping heavy nebula sprites on mobile */
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

    // Glow — kept small to prevent overbright bloom on mobile
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ 
        map: textures.glow, 
        color: system.color, 
        transparent: true,
        opacity: isMobileDevice ? 0.4 : 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true
    }));
    const systemStarGlowScale = isMobileDevice ? 7 : 12;
    glow.scale.set(systemStarGlowScale, systemStarGlowScale, systemStarGlowScale);
    glow.renderOrder = 1; 
    group.add(glow);

    // Light — low intensity so bloom doesn't amplify it into a white wash
    const pointLight = new THREE.PointLight(system.color, 80, 60);
    group.add(pointLight);

    // Ambient light — brightens the dark side of all planets so they aren't pitch black
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
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

        const pGeo = new THREE.SphereGeometry(p.size * 2 * scale, 32, 32);
        const pMat = new THREE.MeshStandardMaterial({ 
            map: tex, color: matColor, roughness: 0.7, metalness: 0.2,
            emissive: new THREE.Color(emissiveColor), emissiveIntensity
        });
        const mesh = new THREE.Mesh(pGeo, pMat);

        if (atmosphereColor !== null) {
            const atmoGeo = new THREE.SphereGeometry(p.size * 2.1 * scale, 32, 32);
            const atmoMat = new THREE.MeshBasicMaterial({
                color: atmosphereColor, transparent: true, opacity: 0.1,
                blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
            });
            mesh.add(new THREE.Mesh(atmoGeo, atmoMat));
            
            const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: textures.glow,
                color: atmosphereColor,
                transparent: true,
                opacity: isMobileDevice ? 0.15 : 0.3,
                blending: THREE.AdditiveBlending, depthWrite: false
            }));
            const planetGlowScaleMultiplier = isMobileDevice ? 3 : 5;
            glowSprite.scale.set(p.size * planetGlowScaleMultiplier * scale, p.size * planetGlowScaleMultiplier * scale, 1);
            mesh.add(glowSprite);
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
    const fontSize = 16;
    const font = `500 ${fontSize * PIXEL_SCALE}px "Rajdhani", sans-serif`;

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

    // Slightly dimmed fill — not harsh white
    ctx.fillStyle = 'rgba(210, 235, 255, 0.88)';
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

function createSystemBackground(group) {
    // 1. Distant Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const posArray = new Float32Array(starCount * 3);
    const colArray = new Float32Array(starCount * 3);
    const color = new THREE.Color();

    for(let i=0; i<starCount; i++) {
        const r = 400 + Math.random() * 400; // Distance
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        posArray[i*3] = r * Math.sin(phi) * Math.cos(theta);
        posArray[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[i*3+2] = r * Math.cos(phi);

        // Color variation
        const hue = Math.random();
        if (hue > 0.9) color.setHex(0xffffff); // White
        else if (hue > 0.7) color.setHex(0xffddaa); // Warm
        else if (hue > 0.5) color.setHex(0xaaddff); // Cool
        else color.setHex(0x8888aa); // Dim

        colArray[i*3] = color.r;
        colArray[i*3+1] = color.g;
        colArray[i*3+2] = color.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    // Use ShaderMaterial with highp precision to prevent square point artifacts on mobile
    const starMat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
            precision highp float;
            attribute vec3 color;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = 1.8 * (300.0 / -mvPosition.z);
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
                float alpha = (1.0 - d * 2.0) * 0.85;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
    });

    const stars = new THREE.Points(starGeo, starMat);
    group.add(stars);

    // 2. Background Nebulae (desktop only)
    // Large additive sprites are a known source of flashing/square artifacts on mobile GPUs.
    if (!isMobileDevice) {
        const nebulaColors = [0x112233, 0x331122, 0x113322, 0x221133];

        for(let i=0; i<12; i++) {
            const mat = new THREE.SpriteMaterial({
                map: textures.glow,
                color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
                transparent: true,
                opacity: 0.06 + Math.random() * 0.04,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const sprite = new THREE.Sprite(mat);
            const r = 300 + Math.random() * 200;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            sprite.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );

            const scale = 150 + Math.random() * 150;
            sprite.scale.set(scale, scale, 1);
            group.add(sprite);
        }
    }
}