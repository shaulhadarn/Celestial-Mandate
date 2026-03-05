/* Updated: Orbit rings use LineLoop for consistent visibility at all angles, planet segments increased to 96 on desktop */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { gameState } from '../core/state.js';
import { disposeGroup } from '../core/dispose.js';
import { createTextSprite } from '../core/text_sprite.js';
import { isMobile as isMobileDevice } from '../core/device.js';

export let planetMeshes = [];
export let planetLabels = [];

// Sun animation refs
let _sunShaderMat = null;
let _sunCorona1 = null;
let _sunCorona2 = null;
let _sunCorona3 = null;
let _sunFlares = [];
let _sunPointLight = null;

export function clearSystemVisuals(group) {
    disposeGroup(group);
    planetMeshes.length = 0;
    planetLabels.length = 0;
    _sunShaderMat = null;
    _sunCorona1 = null;
    _sunCorona2 = null;
    _sunCorona3 = null;
    _sunFlares = [];
    _sunPointLight = null;
}

export function createSystemVisuals(system, group) {
    clearSystemVisuals(group);
    if (!system) return;

    createSystemBackground(group);

    // ── Animated Sun ──────────────────────────────────────────────────────────
    const sunColor = new THREE.Color(system.color);
    const sunR = sunColor.r, sunG = sunColor.g, sunB = sunColor.b;

    // Animated plasma shader surface — used on ALL devices (only 1 sun, no perf concern)
    const starGeo = new THREE.SphereGeometry(5, isMobileDevice ? 32 : 64, isMobileDevice ? 32 : 64);
    const starMat = new THREE.ShaderMaterial({
        uniforms: {
            time:     { value: 0 },
            sunColor: { value: new THREE.Vector3(sunR, sunG, sunB) },
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 sunColor;
            varying vec2 vUv;
            varying vec3 vNormal;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                           mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
            }
            float fbm(vec2 p) {
                float v = 0.0; float a = 0.5;
                for(int i=0; i<5; i++) { v += a*noise(p); p *= 2.1; a *= 0.5; }
                return v;
            }

            void main() {
                vec2 uv = vUv * 4.0;
                float n = fbm(uv + time * 0.18);
                float n2 = fbm(uv * 1.6 - time * 0.12 + 3.7);
                float plasma = n * 0.6 + n2 * 0.4;

                // Limb darkening
                float limb = dot(vNormal, vec3(0.0, 0.0, 1.0));
                limb = pow(max(limb, 0.0), 0.4);

                // Hot core color
                vec3 hotColor  = min(sunColor * 1.8 + 0.4, vec3(1.0));
                vec3 coolColor = sunColor * 0.55;
                vec3 col = mix(coolColor, hotColor, plasma);
                col *= (0.7 + 0.3 * limb);

                // Bright sunspot flecks
                float spot = step(0.72, fbm(uv * 2.5 + time * 0.05));
                col = mix(col, sunColor * 0.25, spot * 0.5);

                gl_FragColor = vec4(col, 1.0);
            }
        `,
        side: THREE.FrontSide,
    });

    _sunShaderMat = starMat;
    const star = new THREE.Mesh(starGeo, starMat);
    group.add(star);

    if (!isMobileDevice) {
        // ── Corona layer 1 — tight inner glow ────────────────────────────────
        _sunCorona1 = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: system.color,
            transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        _sunCorona1.scale.set(16, 16, 1);
        group.add(_sunCorona1);

        // ── Corona layer 2 — mid diffuse halo ────────────────────────────────
        _sunCorona2 = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: system.color,
            transparent: true, opacity: 0.45,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        _sunCorona2.scale.set(28, 28, 1);
        group.add(_sunCorona2);

        // ── Corona layer 3 — wide outer atmosphere ────────────────────────────
        const outerColor = new THREE.Color(system.color).lerp(new THREE.Color(0xffffff), 0.3);
        _sunCorona3 = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: outerColor,
            transparent: true, opacity: 0.18,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        _sunCorona3.scale.set(50, 50, 1);
        group.add(_sunCorona3);

        // ── Solar flare spikes (4 cross-shaped streaks) ───────────────────────
        _sunFlares = [];
        const flareAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        flareAngles.forEach((angle, i) => {
            const flare = new THREE.Sprite(new THREE.SpriteMaterial({
                map: textures.glow, color: system.color,
                transparent: true, opacity: 0.35,
                blending: THREE.AdditiveBlending, depthWrite: false
            }));
            const len = 22 + i * 4;
            flare.scale.set(len, 3.5, 1);
            flare.material.rotation = angle;
            flare.userData.baseAngle = angle;
            flare.userData.baseLen = len;
            group.add(flare);
            _sunFlares.push(flare);
        });
    } else {
        // Mobile: 2 corona layers (inner glow + mid halo) — lighter than desktop
        _sunCorona1 = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: system.color,
            transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        _sunCorona1.scale.set(14, 14, 1);
        group.add(_sunCorona1);

        _sunCorona2 = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: system.color,
            transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        _sunCorona2.scale.set(24, 24, 1);
        group.add(_sunCorona2);
    }

    // Light — reduced intensity to avoid washing out planets
    _sunPointLight = new THREE.PointLight(system.color, isMobileDevice ? 15 : 40, isMobileDevice ? 80 : 80);
    group.add(_sunPointLight);

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
                tex = textures.terran;
                atmosphereColor = 0x00aaff;
                emissiveColor = 0x112244;
                emissiveIntensity = 0.3;
                break;
            case 'Continental':
                tex = textures.continental;
                atmosphereColor = 0x00aaff;
                emissiveColor = 0x112244;
                emissiveIntensity = 0.3;
                break;
            case 'Ocean':
                tex = textures.ocean;
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
                tex = textures.arctic;
                atmosphereColor = 0xaaddff;
                emissiveColor = 0x112233;
                emissiveIntensity = 0.2;
                break;
            case 'Molten':
                tex = textures.molten;
                atmosphereColor = 0xff4400;
                emissiveColor = 0x661100;
                emissiveIntensity = 0.6;
                break;
            case 'Desert':
                tex = textures.desert;
                atmosphereColor = 0xffaa66;
                emissiveColor = 0x221100;
                emissiveIntensity = 0.2;
                break;
            case 'Tomb':
                tex = textures.tomb;
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
                emissiveColor = 0x111111;
                emissiveIntensity = 0.1;
        }

        // Higher resolution geometry — 48 on mobile for smooth edges, 96 on desktop
        const segments = isMobileDevice ? 48 : 96;
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

        // MeshStandardMaterial on all devices for PBR look (skip clearcoat on mobile)
        const pMat = isMobileDevice
            ? new THREE.MeshStandardMaterial({
                map: tex, color: matColor,
                roughness, metalness,
                emissive: new THREE.Color(emissiveColor), emissiveIntensity,
              })
            : new THREE.MeshPhysicalMaterial({
                map: tex, color: matColor,
                roughness, metalness, clearcoat, clearcoatRoughness,
                emissive: new THREE.Color(emissiveColor), emissiveIntensity,
                envMapIntensity: 0.6
              });
        const mesh = new THREE.Mesh(pGeo, pMat);

        if (atmosphereColor !== null) {
            // Outer atmosphere shell — additive blending on all devices
            const atmoGeo = new THREE.SphereGeometry(p.size * 2.15 * scale, segments, segments);
            const atmoMat = new THREE.MeshBasicMaterial({
                color: atmosphereColor, transparent: true,
                opacity: isMobileDevice ? 0.10 : 0.08,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide, depthWrite: false
            });
            mesh.add(new THREE.Mesh(atmoGeo, atmoMat));

            // Inner atmosphere rim — bright limb glow on all devices
            const rimGeo = new THREE.SphereGeometry(p.size * 2.05 * scale, isMobileDevice ? 32 : segments, isMobileDevice ? 32 : segments);
            const rimMat = new THREE.MeshBasicMaterial({
                color: atmosphereColor, transparent: true,
                opacity: isMobileDevice ? 0.05 : 0.06,
                blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false
            });
            mesh.add(new THREE.Mesh(rimGeo, rimMat));
        }
        
        // ── Universal planet glow — gives every planet a subtle luminous halo ──
        const glowColor = atmosphereColor !== null ? atmosphereColor : matColor;
        const planetGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow,
            color: glowColor,
            transparent: true,
            opacity: isMobileDevice ? 0.15 : 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        const glowScale = p.size * (atmosphereColor !== null ? 6.0 : 5.0) * scale;
        planetGlow.scale.set(glowScale, glowScale, 1);
        mesh.add(planetGlow);

        mesh.position.set(Math.cos(p.angle) * p.distance, 0, Math.sin(p.angle) * p.distance);
        mesh.userData = { id: p.id, data: p };
        
        group.add(mesh);
        planetMeshes.push(mesh);

        // Orbit — use LineLoop so the ring is always visible regardless of camera angle
        const orbitSegments = 256;
        const orbitPoints = [];
        for (let j = 0; j <= orbitSegments; j++) {
            const theta = (j / orbitSegments) * Math.PI * 2;
            orbitPoints.push(new THREE.Vector3(
                Math.cos(theta) * p.distance,
                0,
                Math.sin(theta) * p.distance
            ));
        }
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({
            color: 0x66aadd,
            opacity: 0.4,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const orbit = new THREE.LineLoop(orbitGeo, orbitMat);
        group.add(orbit);

        // Label
        const label = createTextSprite(p.name, { fontSize: 20, worldScale: 0.035 });
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
    // ── Animate sun ──────────────────────────────────────────────────────────
    if (_sunShaderMat) {
        _sunShaderMat.uniforms.time.value = time;
    }

    if (_sunCorona1) {
        const pulse1 = 1.0 + 0.06 * Math.sin(time * 1.1);
        _sunCorona1.scale.set(16 * pulse1, 16 * pulse1, 1);
        _sunCorona1.material.opacity = 0.85 + 0.1 * Math.sin(time * 1.3);
    }
    if (_sunCorona2) {
        const pulse2 = 1.0 + 0.04 * Math.sin(time * 0.7 + 1.0);
        _sunCorona2.scale.set(28 * pulse2, 28 * pulse2, 1);
        _sunCorona2.material.opacity = 0.4 + 0.08 * Math.sin(time * 0.9 + 0.5);
    }
    if (_sunCorona3) {
        const pulse3 = 1.0 + 0.03 * Math.sin(time * 0.4 + 2.0);
        _sunCorona3.scale.set(50 * pulse3, 50 * pulse3, 1);
    }

    _sunFlares.forEach((flare, i) => {
        const t = time * 0.3 + i * 1.2;
        const lenMult = 1.0 + 0.18 * Math.sin(t);
        const baseLen = flare.userData.baseLen;
        flare.scale.set(baseLen * lenMult, 3.5 + 1.5 * Math.sin(t * 1.4), 1);
        flare.material.opacity = 0.25 + 0.18 * Math.abs(Math.sin(t * 0.8));
        flare.material.rotation = flare.userData.baseAngle + 0.04 * Math.sin(time * 0.5 + i);
    });

    if (_sunPointLight) {
        _sunPointLight.intensity = (isMobileDevice ? 15 : 40) * (1.0 + 0.08 * Math.sin(time * 1.7));
    }

    // ── Animate planets ───────────────────────────────────────────────────────
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

function createSystemBackground(group) {
    // ── Merged starfield + bright clusters into a single draw call ─────────
    const starCount = isMobileDevice ? 2500 : 5000;
    const clusterCount = isMobileDevice ? 25 : 60;
    const totalCount = starCount + clusterCount;

    const posArray  = new Float32Array(totalCount * 3);
    const colArray  = new Float32Array(totalCount * 3);
    const sizeArray = new Float32Array(totalCount);
    const layerArray = new Float32Array(totalCount); // 0 = background, 1 = cluster
    const color = new THREE.Color();

    // ── Background stars ──────────────────────────────────────────────────────
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

        const sz = Math.random();
        sizeArray[i] = sz > 0.97 ? 3.5 : sz > 0.90 ? 2.2 : sz > 0.70 ? 1.5 : 0.9;
        layerArray[i] = 0.0;
    }

    // ── Foreground cluster stars ──────────────────────────────────────────────
    const clusterColors = [0xffffff, 0xffeebb, 0xaaddff, 0xffccaa, 0xccddff];
    for (let i = 0; i < clusterCount; i++) {
        const idx = starCount + i;
        const r = 200 + Math.random() * 180;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        posArray[idx*3]   = r * Math.sin(phi) * Math.cos(theta);
        posArray[idx*3+1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[idx*3+2] = r * Math.cos(phi);
        const c = new THREE.Color(clusterColors[Math.floor(Math.random() * clusterColors.length)]);
        colArray[idx*3]   = c.r;
        colArray[idx*3+1] = c.g;
        colArray[idx*3+2] = c.b;
        sizeArray[idx] = 2.5 + Math.random() * 4.0;
        layerArray[idx] = 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colArray, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizeArray, 1));
    geo.setAttribute('layer',    new THREE.BufferAttribute(layerArray, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
            precision highp float;
            attribute vec3 color;
            attribute float size;
            attribute float layer;
            varying vec3 vColor;
            varying float vLayer;
            void main() {
                vColor = color;
                vLayer = layer;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                // background stars use 320 divisor, clusters use 300
                float scale = mix(320.0, 300.0, layer);
                gl_PointSize = size * (scale / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            precision highp float;
            varying vec3 vColor;
            varying float vLayer;
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float d = length(coord);
                if (d > 0.5) discard;
                // Background stars: simple linear falloff
                float bgAlpha = (1.0 - d * 2.0) * 0.95;
                // Cluster stars: core + halo glow
                float core = smoothstep(0.5, 0.0, d);
                float halo = smoothstep(0.5, 0.1, d) * 0.4;
                float clAlpha = core + halo;
                float alpha = mix(bgAlpha, clAlpha, vLayer);
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    group.add(new THREE.Points(geo, mat));
}