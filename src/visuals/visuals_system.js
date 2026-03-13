/* Updated: Orbit rings use LineLoop for consistent visibility at all angles, planet segments increased to 96 on desktop */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { gameState } from '../core/state.js';
import { disposeGroup } from '../core/dispose.js';
import { createTextSprite } from '../core/text_sprite.js';
import { isMobile as isMobileDevice } from '../core/device.js';
import { buildPlayerShips, updatePlayerShipOrbits, clearPlayerShips, getPlayerShipMeshes, createPlayerShipMesh } from './visuals_system_ships.js';

export let planetMeshes = [];
export let planetLabels = [];

// ── Shared glow time uniform — ONE write per frame updates all glow materials ──
const _glowTime = { value: 0 };
const _glowPlaneGeo = new THREE.PlaneGeometry(1, 1);

/**
 * Creates a billboard glow mesh with pulsing baked into the shader.
 * All instances share _glowTime, so updateSystemAnimations only sets time once.
 */
function _createGlowMesh(glowTexture, color, baseOpacity, phase, pulseSpeed, pulseAmt) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: glowTexture },
            color: { value: new THREE.Color(color) },
            time: _glowTime,
            phase: { value: phase },
            baseOpacity: { value: baseOpacity },
            pulseSpeed: { value: pulseSpeed },
            pulseAmt: { value: pulseAmt }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                // Perspective-correct billboard: expand quad in view space before projection
                vec4 mvPos = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                // position.xy carries the PlaneGeometry vertex offset, scaled by mesh.scale
                vec3 camRight = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
                vec3 camUp    = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
                mvPos.xyz += camRight * position.x + camUp * position.y;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            uniform vec3 color;
            uniform float time;
            uniform float phase;
            uniform float baseOpacity;
            uniform float pulseSpeed;
            uniform float pulseAmt;
            varying vec2 vUv;
            void main() {
                float pulse = (1.0 - pulseAmt) + pulseAmt * sin(time * pulseSpeed + phase);
                float alpha = baseOpacity * pulse;
                vec4 tex = texture2D(map, vUv);
                gl_FragColor = vec4(color * tex.rgb, tex.a * alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(_glowPlaneGeo, mat);
    return mesh;
}

// Sun animation refs
let _sunShaderMat = null;
let _sunCorona1 = null;
let _sunCorona2 = null;
let _sunCorona3 = null;
let _sunFlares = [];
let _sunPointLight = null;
let _colonySatellites = [];
let _moonGroups = [];  // { parentMesh, pivot, moonMesh, data }[]
let _asteroidBelt = null;  // { group: Group }
let _tradeShips = [];      // { mesh, engineGlow, trailAnchor, fromId, toId, progress, speed, arcHeight, _prevPos }
let _shipyardStations = []; // { pivot, station, dockGlow, navLights[], trailAnchor, orbitSpeed, _prevPos }
let _pirateStations = [];   // Same shape as _shipyardStations but red themed
let _pirateRaiders = [];    // Same shape as _tradeShips but red themed
let _battleAnim = null;     // Active battle animation state

// ── Satellite engine trail particle pool ────────────────────────────────────
const SAT_TRAIL_MAX = isMobileDevice ? 160 : 350;
let _trailGeo = null;
let _trailMesh = null;
let _trailPositions = null;
let _trailOpacities = null;
let _trailSizes = null;
const _trailSlots = new Array(SAT_TRAIL_MAX);
for (let i = 0; i < SAT_TRAIL_MAX; i++) {
    _trailSlots[i] = { active: false, life: 0, maxLife: 0, baseSize: 0, vx: 0, vy: 0, vz: 0 };
}
let _trailActive = 0;
let _trailInited = false;
const _trailWorldPos = new THREE.Vector3();
const _shipTmpFrom = new THREE.Vector3();
const _shipTmpTo = new THREE.Vector3();
const _shipTmpDir = new THREE.Vector3();

function _initSatTrailPool(group) {
    _trailPositions = new Float32Array(SAT_TRAIL_MAX * 3);
    _trailOpacities = new Float32Array(SAT_TRAIL_MAX);
    _trailSizes = new Float32Array(SAT_TRAIL_MAX);

    _trailGeo = new THREE.BufferGeometry();
    _trailGeo.setAttribute('position', new THREE.BufferAttribute(_trailPositions, 3));
    _trailGeo.setAttribute('aOpacity', new THREE.BufferAttribute(_trailOpacities, 1));
    _trailGeo.setAttribute('aSize', new THREE.BufferAttribute(_trailSizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: textures.glow },
            color: { value: new THREE.Color(0x00ccff) }
        },
        vertexShader: /* glsl */ `
            attribute float aOpacity;
            attribute float aSize;
            varying float vOpacity;
            void main() {
                vOpacity = aOpacity;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * (200.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D map;
            uniform vec3 color;
            varying float vOpacity;
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                float d = length(coord);
                if (d > 0.5) discard;
                vec4 texColor = texture2D(map, gl_PointCoord);
                gl_FragColor = vec4(color, texColor.a * vOpacity);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    _trailMesh = new THREE.Points(_trailGeo, mat);
    _trailMesh.frustumCulled = false;
    group.add(_trailMesh);
    _trailInited = true;
}

export function _spawnSatTrail(x, y, z, vx, vy, vz, sizeMul) {
    if (!_trailInited) return;
    if (isMobileDevice && _trailActive >= 60) return;

    let slot = null;
    for (let i = 0; i < SAT_TRAIL_MAX; i++) {
        if (!_trailSlots[i].active) { slot = _trailSlots[i]; slot._idx = i; break; }
    }
    if (!slot) return;

    const idx = slot._idx;
    const sm = sizeMul || 1.0;
    const baseSize = ((isMobileDevice ? 1.2 : 1.6) + Math.random() * 0.6) * sm;
    const life = (0.5 + Math.random() * 0.4) * (0.6 + sm * 0.4);

    slot.active = true;
    slot.life = life;
    slot.maxLife = life;
    slot.baseSize = baseSize;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;

    _trailPositions[idx * 3]     = x;
    _trailPositions[idx * 3 + 1] = y;
    _trailPositions[idx * 3 + 2] = z;
    _trailOpacities[idx] = 0.5;
    _trailSizes[idx] = baseSize;
    _trailActive++;
}

function _updateSatTrails(dt) {
    if (!_trailInited) return;
    let dirty = false;

    for (let i = 0; i < SAT_TRAIL_MAX; i++) {
        const slot = _trailSlots[i];
        if (!slot.active) continue;

        slot.life -= dt;

        // Drift particle along initial velocity
        _trailPositions[i * 3]     += slot.vx * dt;
        _trailPositions[i * 3 + 1] += slot.vy * dt;
        _trailPositions[i * 3 + 2] += slot.vz * dt;

        if (slot.life <= 0) {
            slot.active = false;
            _trailSizes[i] = 0;
            _trailOpacities[i] = 0;
            _trailActive--;
        } else {
            const r = slot.life / slot.maxLife;
            _trailOpacities[i] = r * 0.5;
            _trailSizes[i] = slot.baseSize * (0.3 + r * 0.7);
        }
        dirty = true;
    }

    if (dirty) {
        _trailGeo.attributes.position.needsUpdate = true;
        _trailGeo.attributes.aOpacity.needsUpdate = true;
        _trailGeo.attributes.aSize.needsUpdate = true;
    }
}

function _disposeSatTrailPool() {
    if (_trailMesh) {
        _trailMesh.material.dispose();
        _trailGeo.dispose();
        _trailMesh = null;
        _trailGeo = null;
    }
    for (let i = 0; i < SAT_TRAIL_MAX; i++) _trailSlots[i].active = false;
    _trailActive = 0;
    _trailInited = false;
}

export function clearSystemVisuals(group) {
    _disposeSatTrailPool();
    disposeGroup(group);
    planetMeshes.length = 0;
    planetLabels.length = 0;
    _sunShaderMat = null;
    _sunCorona1 = null;
    _sunCorona2 = null;
    _sunCorona3 = null;
    _sunFlares = [];
    _sunPointLight = null;
    _colonySatellites = [];
    _moonGroups = [];
    _asteroidBelt = null;
    _tradeShips = [];
    _shipyardStations = [];
    _pirateStations = [];
    _pirateRaiders.forEach(pr => { if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh); });
    _pirateRaiders = [];
    _battleAnim = null;
    clearPlayerShips();
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

    // ── Star name label ────────────────────────────────────────────────────
    const starLabel = createTextSprite(system.name, { fontSize: 2.4 });
    starLabel.position.set(0, -9, 0);
    group.add(starLabel);

    // Light — reduced intensity to avoid washing out planets
    _sunPointLight = new THREE.PointLight(system.color, isMobileDevice ? 15 : 40, isMobileDevice ? 80 : 80);
    group.add(_sunPointLight);

    // Ambient light — higher on mobile since we lose specular highlights
    const ambientLight = new THREE.AmbientLight(0xffffff, isMobileDevice ? 2.0 : 1.2);
    group.add(ambientLight);

    // Planets
    system.planets.forEach((p, idx) => {
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
                atmosphereColor = 0xccaa77;
                emissiveColor = 0x221a0e;
                emissiveIntensity = 0.25;
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
            const atmoGeo = new THREE.SphereGeometry(p.size * 2.2 * scale, segments, segments);
            const atmoMat = new THREE.MeshBasicMaterial({
                color: atmosphereColor, transparent: true,
                opacity: isMobileDevice ? 0.28 : 0.25,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide, depthWrite: false
            });
            mesh.add(new THREE.Mesh(atmoGeo, atmoMat));

            // Inner atmosphere rim — bright limb glow on all devices
            const rimGeo = new THREE.SphereGeometry(p.size * 2.08 * scale, isMobileDevice ? 32 : segments, isMobileDevice ? 32 : segments);
            const rimMat = new THREE.MeshBasicMaterial({
                color: atmosphereColor, transparent: true,
                opacity: isMobileDevice ? 0.18 : 0.15,
                blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false
            });
            mesh.add(new THREE.Mesh(rimGeo, rimMat));
        }
        
        // ── Planet glow — Sprite-based for stable camera-facing (2 layers) ──
        const glowColor = atmosphereColor !== null ? atmosphereColor : matColor;
        const planetR = p.size * 2 * scale;

        // Layer 1: Soft outer halo
        const outerHalo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow,
            color: glowColor,
            transparent: true,
            opacity: isMobileDevice ? 0.45 : 0.5,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
        }));
        const outerScale = planetR * 6;
        outerHalo.scale.set(outerScale, outerScale, 1);
        mesh.add(outerHalo);

        // Layer 2: Tighter core glow
        const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow,
            color: glowColor,
            transparent: true,
            opacity: isMobileDevice ? 0.55 : 0.6,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
        }));
        const coreScale = planetR * 3.5;
        coreGlow.scale.set(coreScale, coreScale, 1);
        mesh.add(coreGlow);

        mesh.position.set(Math.cos(p.angle) * p.distance, 0, Math.sin(p.angle) * p.distance);
        mesh.userData = { id: p.id, data: p };
        
        group.add(mesh);
        planetMeshes.push(mesh);

        // ── Moons ──
        if (p.moons && p.moons.length > 0) {
            p.moons.forEach(moonData => {
                const moonRadius = p.size * moonData.size * 2 * scale;
                const moonGeo = new THREE.SphereGeometry(moonRadius, isMobileDevice ? 16 : 24, isMobileDevice ? 16 : 24);
                const moonMat = new THREE.MeshStandardMaterial({
                    map: textures.barren,
                    color: moonData.color,
                    roughness: 0.85,
                    metalness: 0.05,
                    emissive: new THREE.Color(0x222222),
                    emissiveIntensity: 0.15
                });
                const moonMesh = new THREE.Mesh(moonGeo, moonMat);

                // Faint moon glow sprite
                const moonGlowColor = moonData.color;
                const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: textures.glow,
                    color: moonGlowColor,
                    transparent: true,
                    opacity: isMobileDevice ? 0.25 : 0.3,
                    blending: THREE.AdditiveBlending,
                    depthTest: false,
                    depthWrite: false,
                }));
                const moonGlowScale = moonRadius * 4;
                moonGlow.scale.set(moonGlowScale, moonGlowScale, 1);
                moonMesh.add(moonGlow);

                // Moon orbit pivot — positioned at planet, tilted
                const moonPivot = new THREE.Group();
                moonPivot.rotation.x = moonData.inclination;
                moonPivot.rotation.z = Math.random() * 0.2;

                // Position moon at its orbit radius from parent center
                const moonOrbitR = moonData.orbitRadius;
                moonMesh.position.set(
                    Math.cos(moonData.angle) * moonOrbitR,
                    0,
                    Math.sin(moonData.angle) * moonOrbitR
                );
                moonPivot.add(moonMesh);

                // Faint moon orbit ring
                const moonOrbitPts = [];
                for (let mo = 0; mo <= 64; mo++) {
                    const theta = (mo / 64) * Math.PI * 2;
                    moonOrbitPts.push(new THREE.Vector3(
                        Math.cos(theta) * moonOrbitR, 0, Math.sin(theta) * moonOrbitR
                    ));
                }
                const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
                const moonOrbitMat = new THREE.LineBasicMaterial({
                    color: 0x66aadd, opacity: 0.15, transparent: true,
                    blending: THREE.AdditiveBlending, depthWrite: false
                });
                moonPivot.add(new THREE.LineLoop(moonOrbitGeo, moonOrbitMat));

                // The pivot tracks planet position each frame
                group.add(moonPivot);

                _moonGroups.push({
                    parentMesh: mesh,
                    pivot: moonPivot,
                    moonMesh: moonMesh,
                    data: moonData
                });
            });
        }

        // Orbit — use LineLoop so the ring is always visible regardless of camera angle
        const orbitSegments = 128;
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
        const label = createTextSprite(p.name, { fontSize: 1.8 });
        label.userData = { id: p.id, data: p };
        group.add(label);
        planetLabels.push({ sprite: label, target: mesh, offsetY: - (p.size * 2.5) - 3 });

        if (gameState.colonies[p.id]) {
            addColonyVisual(mesh);
            // Add shipyard station if colony has one built
            const colony = gameState.colonies[p.id];
            if (colony.buildings && colony.buildings.includes('shipyard')) {
                addShipyardVisual(mesh);
            }
        }

        // Pirate base visual
        if (p.pirate && gameState.pirateBase && !gameState.pirateBase.defeated) {
            addPirateBaseVisual(mesh);
        }
    });

    // ── Asteroid Belt ─────────────────────────────────────────────────────
    if (system.asteroidBelt) {
        const belt = system.asteroidBelt;
        const beltGroup = new THREE.Group();

        // Simple 3D hash for coherent noise deformation
        function rockHash(x, y, z) {
            let h = x * 374761393 + y * 668265263 + z * 1274126177;
            h = Math.abs(h);
            h = ((h >> 13) ^ h) * 1274126177;
            return ((h >> 16) ^ h & 0x7fffffff) / 0x7fffffff;
        }
        function rockNoise3D(px, py, pz, scale) {
            const gx = px / scale, gy = py / scale, gz = pz / scale;
            const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
            const fx = gx - x0, fy = gy - y0, fz = gz - z0;
            const sx = fx * fx * (3 - 2 * fx);
            const sy = fy * fy * (3 - 2 * fy);
            const sz = fz * fz * (3 - 2 * fz);
            const lerp = (a, b, t) => a + (b - a) * t;
            const v000 = rockHash(x0, y0, z0);
            const v100 = rockHash(x0+1, y0, z0);
            const v010 = rockHash(x0, y0+1, z0);
            const v110 = rockHash(x0+1, y0+1, z0);
            const v001 = rockHash(x0, y0, z0+1);
            const v101 = rockHash(x0+1, y0, z0+1);
            const v011 = rockHash(x0, y0+1, z0+1);
            const v111 = rockHash(x0+1, y0+1, z0+1);
            return lerp(
                lerp(lerp(v000,v100,sx), lerp(v010,v110,sx), sy),
                lerp(lerp(v001,v101,sx), lerp(v011,v111,sx), sy),
                sz
            );
        }

        // Create a few varied asteroid geometries to pick from
        const asteroidGeos = [];
        const geoVariants = 4;
        for (let g = 0; g < geoVariants; g++) {
            const baseGeo = new THREE.IcosahedronGeometry(0.25, 2);
            const posAttr = baseGeo.getAttribute('position');
            const seed = g * 137.5;
            for (let v = 0; v < posAttr.count; v++) {
                const vx = posAttr.getX(v), vy = posAttr.getY(v), vz = posAttr.getZ(v);
                const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
                if (len === 0) continue;
                const nx = vx / len, ny = vy / len, nz = vz / len;
                // Multi-octave noise deformation for natural lumps and craters
                const n1 = rockNoise3D(nx * 3 + seed, ny * 3 + seed, nz * 3 + seed, 1.0);
                const n2 = rockNoise3D(nx * 6 + seed, ny * 6 + seed, nz * 6 + seed, 1.0) * 0.5;
                const n3 = rockNoise3D(nx * 12 + seed, ny * 12 + seed, nz * 12 + seed, 1.0) * 0.2;
                const deform = 0.65 + (n1 + n2 + n3) * 0.35 / 1.7;
                posAttr.setXYZ(v, nx * 0.25 * deform, ny * 0.25 * deform, nz * 0.25 * deform);
            }
            posAttr.needsUpdate = true;
            baseGeo.computeVertexNormals();
            asteroidGeos.push(baseGeo);
        }

        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x99887a,
            roughness: 0.92,
            metalness: 0.08,
            emissive: new THREE.Color(0x1a1510),
            emissiveIntensity: 0.12,
            flatShading: true
        });

        // Create instanced meshes per geometry variant
        const count = belt.count;
        const perVariant = Math.ceil(count / geoVariants);
        const dummy = new THREE.Object3D();

        for (let g = 0; g < geoVariants; g++) {
            const varCount = Math.min(perVariant, count - g * perVariant);
            if (varCount <= 0) break;
            const rockMesh = new THREE.InstancedMesh(asteroidGeos[g], rockMat, varCount);

            for (let i = 0; i < varCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = belt.distance + (Math.random() - 0.5) * belt.width;
                const y = (Math.random() - 0.5) * 1.2;

                dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
                dummy.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
                const sRand = Math.random();
                const s = sRand > 0.9 ? 1.5 + Math.random() * 1.0 : 0.4 + Math.random() * 0.8;
                dummy.scale.set(s, s * (0.7 + Math.random() * 0.6), s * (0.7 + Math.random() * 0.6));
                dummy.updateMatrix();
                rockMesh.setMatrixAt(i, dummy.matrix);
            }
            rockMesh.instanceMatrix.needsUpdate = true;
            beltGroup.add(rockMesh);
        }

        // Faint guide ring at belt center distance
        const beltRingPts = [];
        for (let j = 0; j <= 128; j++) {
            const theta = (j / 128) * Math.PI * 2;
            beltRingPts.push(new THREE.Vector3(
                Math.cos(theta) * belt.distance, 0, Math.sin(theta) * belt.distance
            ));
        }
        const beltRingGeo = new THREE.BufferGeometry().setFromPoints(beltRingPts);
        const beltRingMat = new THREE.LineBasicMaterial({
            color: 0x998877, opacity: 0.2, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        beltGroup.add(new THREE.LineLoop(beltRingGeo, beltRingMat));

        group.add(beltGroup);
        _asteroidBelt = { group: beltGroup };
    }

    // ── Trade ships between colonies ──
    buildTradeRoutes(group);

    // ── Pirate raider ships ──
    buildPirateRaidRoutes(group);

    // ── Player fleet ships ──
    buildPlayerShips(group, planetMeshes);
}

export function addColonyVisual(planetMesh) {
    const planetRadius = planetMesh.geometry.parameters.radius;
    const orbitRadius = planetRadius * 1.6;
    const satScale = Math.max(0.35, planetRadius * 0.22);

    // Orbit pivot — child of the planet so it follows orbital motion
    const orbitPivot = new THREE.Group();
    planetMesh.add(orbitPivot);

    const satGroup = new THREE.Group();
    satGroup.scale.setScalar(satScale);

    // ── Materials (matching splash screen satellite) ──
    const goldFoilMat = new THREE.MeshStandardMaterial({
        color: 0xffd58a, metalness: 0.92, roughness: 0.24,
        emissive: 0x4a2606, emissiveIntensity: 0.18
    });
    const panelMat = new THREE.MeshStandardMaterial({
        color: 0x08152e, metalness: 0.84, roughness: 0.16,
        emissive: 0x0a2a4a, emissiveIntensity: 0.22
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0xb9c4d2, metalness: 0.88, roughness: 0.2
    });

    // ── Body — gold foil cube ──
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.0), goldFoilMat);
    satGroup.add(body);

    // ── Antenna deck ──
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.15, 8), metalMat);
    deck.position.z = 0.6;
    deck.rotation.x = Math.PI / 2;
    satGroup.add(deck);

    // ── Dish antenna ──
    const dishGeo = new THREE.SphereGeometry(0.35, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dish = new THREE.Mesh(dishGeo, metalMat);
    dish.position.z = 0.7;
    dish.rotation.x = -Math.PI / 2;
    satGroup.add(dish);

    // ── Solar panel arrays ──
    for (let j = 0; j < 2; j++) {
        const side = j === 0 ? 1 : -1;
        const panelWidth = 1.8;
        const panelHeight = 0.6;
        const panelFrame = new THREE.Mesh(
            new THREE.BoxGeometry(panelWidth, 0.06, panelHeight), metalMat
        );
        panelFrame.position.x = side * (0.25 + panelWidth / 2);
        const panelSurface = new THREE.Mesh(
            new THREE.BoxGeometry(panelWidth * 0.93, 0.03, panelHeight * 0.88), panelMat
        );
        panelSurface.position.y = 0.035;
        panelFrame.add(panelSurface);

        // Panel grid lines for detail
        for (let g = 1; g < 4; g++) {
            const gridLine = new THREE.Mesh(
                new THREE.BoxGeometry(0.02, 0.065, panelHeight * 0.88),
                metalMat
            );
            gridLine.position.set(-panelWidth * 0.45 + g * (panelWidth * 0.9 / 4), 0.005, 0);
            panelFrame.add(gridLine);
        }

        satGroup.add(panelFrame);
    }

    // ── Antenna boom ──
    const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.6), metalMat
    );
    antenna.position.set(0.15, 0.15, -0.4);
    antenna.rotation.x = Math.PI / 6;
    satGroup.add(antenna);

    // ── Nav light ──
    const navLightColor = 0x00f2ff;
    const navLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: navLightColor })
    );
    navLight.position.set(0, 0.32, 0.3);
    satGroup.add(navLight);

    // ── Nav glow sprite ──
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const gCtx = glowCanvas.getContext('2d');
    const grad = gCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0, 242, 255, 0.9)');
    grad.addColorStop(0.4, 'rgba(0, 242, 255, 0.3)');
    grad.addColorStop(1, 'rgba(0, 242, 255, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(glowCanvas);

    const navGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: navLightColor,
        transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    navGlow.scale.set(1.0, 1.0, 1);
    navLight.add(navGlow);

    // ── Engine glow + trail anchor at the rear ──
    const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0x00ccff,
        transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    engineGlow.scale.set(0.6, 0.6, 1);
    engineGlow.position.set(0, 0, -0.55);
    satGroup.add(engineGlow);

    // Trail anchor — world position sampled each frame to emit particles
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, -0.7);
    satGroup.add(trailAnchor);

    // Position satellite at orbit radius; rotate so engine trails behind orbit direction
    satGroup.position.set(orbitRadius, 0, 0);
    satGroup.rotation.y = Math.PI;
    orbitPivot.add(satGroup);

    // Random starting angle and inclination
    const startAngle = Math.random() * Math.PI * 2;
    orbitPivot.rotation.y = startAngle;
    orbitPivot.rotation.x = 0.2 + Math.random() * 0.3;

    // Track for animation
    _colonySatellites.push({
        pivot: orbitPivot,
        sat: satGroup,
        navLight,
        navGlow,
        engineGlow,
        trailAnchor,
        orbitSpeed: 0.3 + Math.random() * 0.2,
        navColor: navLightColor,
        _prevPos: new THREE.Vector3()
    });
}

// ── Shipyard orbital stations ────────────────────────────────────────────────

function _createShipyardMesh() {
    const stationGroup = new THREE.Group();

    // ── Materials ──
    const hullMat = new THREE.MeshStandardMaterial({
        color: 0x6a6a7a, metalness: 0.88, roughness: 0.22,
        emissive: 0x1a1028, emissiveIntensity: 0.15
    });
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x8888aa, metalness: 0.9, roughness: 0.18,
        emissive: 0x221133, emissiveIntensity: 0.12
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0xb496ff, metalness: 0.7, roughness: 0.3,
        emissive: 0xb496ff, emissiveIntensity: 0.4
    });
    const panelMat = new THREE.MeshStandardMaterial({
        color: 0x0a1630, metalness: 0.8, roughness: 0.2,
        emissive: 0x0a2a4a, emissiveIntensity: 0.2
    });

    // ── Central spine / dock bay — elongated octagonal frame ──
    const spineGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8, 1, true);
    const spine = new THREE.Mesh(spineGeo, frameMat);
    spine.rotation.x = Math.PI / 2;
    stationGroup.add(spine);

    // Dock bay end caps — ring shapes
    for (let end = -1; end <= 1; end += 2) {
        const ringGeo = new THREE.TorusGeometry(0.38, 0.06, 6, 8);
        const ring = new THREE.Mesh(ringGeo, accentMat);
        ring.position.z = end * 1.2;
        ring.rotation.x = 0;
        stationGroup.add(ring);
    }

    // ── Support arms — two angled struts with docking clamps ──
    for (let side = -1; side <= 1; side += 2) {
        const armGeo = new THREE.BoxGeometry(1.6, 0.08, 0.12);
        const arm = new THREE.Mesh(armGeo, hullMat);
        arm.position.set(side * 0.9, 0, 0);
        arm.rotation.z = side * 0.15;
        stationGroup.add(arm);

        // Docking clamp at end of arm
        const clampGeo = new THREE.BoxGeometry(0.14, 0.25, 0.3);
        const clamp = new THREE.Mesh(clampGeo, frameMat);
        clamp.position.set(side * 1.7, 0, 0);
        stationGroup.add(clamp);

        // Clamp accent light
        const clampLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xb496ff })
        );
        clampLight.position.set(side * 1.7, 0.15, 0);
        stationGroup.add(clampLight);
    }

    // ── Rotating ring section ──
    const torusGeo = new THREE.TorusGeometry(0.7, 0.07, 8, 24);
    const torus = new THREE.Mesh(torusGeo, frameMat);
    torus.rotation.x = Math.PI / 2;
    torus.userData._isRing = true; // Tag for animation
    stationGroup.add(torus);

    // Ring spokes — radial struts connecting spine to ring
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const spokeGeo = new THREE.BoxGeometry(0.35, 0.03, 0.03);
        const spoke = new THREE.Mesh(spokeGeo, frameMat);
        spoke.position.set(Math.cos(angle) * 0.52, 0, Math.sin(angle) * 0.52);
        spoke.rotation.y = -angle;
        stationGroup.add(spoke);
    }

    // ── Solar panel arrays (larger than colony sat) ──
    for (let side = -1; side <= 1; side += 2) {
        const panelFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.9, 0.5), hullMat
        );
        panelFrame.position.set(side * 0.42, 0, -0.8);
        const panelSurface = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.82, 0.42), panelMat
        );
        panelSurface.position.x = side * 0.03;
        panelFrame.add(panelSurface);
        stationGroup.add(panelFrame);
    }

    // ── Dock bay interior glow (construction energy) ──
    const dockGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow,
        color: 0xb496ff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    dockGlow.scale.set(1.4, 1.4, 1);
    stationGroup.add(dockGlow);

    // ── Nav lights (4 corners) ──
    const navLights = [];
    const navPositions = [
        [0, 0.4, 0], [0, -0.4, 0],
        [1.7, 0.15, 0], [-1.7, 0.15, 0]
    ];
    navPositions.forEach(pos => {
        const navMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xb496ff })
        );
        navMesh.position.set(pos[0], pos[1], pos[2]);
        stationGroup.add(navMesh);

        // Glow sprite
        const navGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow,
            color: 0xb496ff,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        navGlow.scale.set(0.3, 0.3, 1);
        navMesh.add(navGlow);
        navLights.push({ mesh: navMesh, glow: navGlow });
    });

    // ── Engine glow at rear ──
    const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0x9966ff,
        transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    engineGlow.scale.set(0.5, 0.5, 1);
    engineGlow.position.set(0, 0, -1.3);
    stationGroup.add(engineGlow);

    // Trail anchor for particle emission
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, -1.4);
    stationGroup.add(trailAnchor);

    return { stationGroup, dockGlow, navLights, engineGlow, trailAnchor };
}

export function addShipyardVisual(planetMesh) {
    const planetRadius = planetMesh.geometry.parameters.radius;
    const orbitRadius = planetRadius * 1.9;
    const stationScale = Math.max(0.55, planetRadius * 0.32);

    // Orbit pivot — child of the planet so it follows orbital motion
    const orbitPivot = new THREE.Group();
    planetMesh.add(orbitPivot);

    const { stationGroup, dockGlow, navLights, engineGlow, trailAnchor } = _createShipyardMesh();
    stationGroup.scale.setScalar(stationScale);

    // Position at orbit radius; rotate so engine trails behind orbit direction
    stationGroup.position.set(orbitRadius, 0, 0);
    stationGroup.rotation.y = Math.PI;
    orbitPivot.add(stationGroup);

    // Random starting angle and different inclination from colony sat
    orbitPivot.rotation.y = Math.random() * Math.PI * 2;
    orbitPivot.rotation.x = -(0.15 + Math.random() * 0.25); // Negative to diverge from colony sat

    _shipyardStations.push({
        pivot: orbitPivot,
        station: stationGroup,
        dockGlow,
        navLights,
        engineGlow,
        trailAnchor,
        orbitSpeed: 0.15 + Math.random() * 0.1, // Slower than colony sat
        _prevPos: new THREE.Vector3()
    });
}

// ── Pirate base station ──────────────────────────────────────────────────────

function _createPirateStationMesh() {
    const stationGroup = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, metalness: 0.85, roughness: 0.3,
        emissive: 0x220500, emissiveIntensity: 0.2
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0xff3322, metalness: 0.7, roughness: 0.3,
        emissive: 0xff3322, emissiveIntensity: 0.5
    });
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a, metalness: 0.9, roughness: 0.2,
        emissive: 0x1a0500, emissiveIntensity: 0.15
    });

    // Angular central hull — menacing wedge shape
    const hullGeo = new THREE.BoxGeometry(1.2, 0.4, 2.4);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    stationGroup.add(hull);

    // Forward spike
    const spikeGeo = new THREE.ConeGeometry(0.3, 1.2, 4);
    const spike = new THREE.Mesh(spikeGeo, hullMat);
    spike.rotation.x = -Math.PI / 2;
    spike.position.z = 1.8;
    stationGroup.add(spike);

    // Weapon turrets on top
    for (let side = -1; side <= 1; side += 2) {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 6), frameMat);
        turret.position.set(side * 0.4, 0.3, 0.5);
        stationGroup.add(turret);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), frameMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(side * 0.4, 0.35, 0.75);
        stationGroup.add(barrel);
    }

    // Fin wings — angular outward
    for (let side = -1; side <= 1; side += 2) {
        const finGeo = new THREE.BoxGeometry(1.0, 0.05, 1.4);
        const fin = new THREE.Mesh(finGeo, hullMat);
        fin.position.set(side * 1.1, 0, -0.2);
        fin.rotation.z = side * 0.25;
        stationGroup.add(fin);

        // Red stripe on fin
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.1), accentMat);
        stripe.position.set(side * 1.1, 0.04, 0.3);
        stripe.rotation.z = side * 0.25;
        stationGroup.add(stripe);
    }

    // Red glow core
    const dockGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff3322,
        transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    dockGlow.scale.set(1.6, 1.6, 1);
    stationGroup.add(dockGlow);

    // Nav lights
    const navLights = [];
    const navPositions = [[0, 0.3, 1.8], [0, -0.25, -1.2], [1.5, 0.1, 0], [-1.5, 0.1, 0]];
    navPositions.forEach(pos => {
        const navMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xff3322 })
        );
        navMesh.position.set(pos[0], pos[1], pos[2]);
        stationGroup.add(navMesh);

        const navGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: 0xff3322,
            transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        navGlow.scale.set(0.35, 0.35, 1);
        navMesh.add(navGlow);
        navLights.push({ mesh: navMesh, glow: navGlow });
    });

    // Engine glow
    const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff5500,
        transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    engineGlow.scale.set(0.7, 0.7, 1);
    engineGlow.position.set(0, 0, -1.3);
    stationGroup.add(engineGlow);

    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, -1.5);
    stationGroup.add(trailAnchor);

    return { stationGroup, dockGlow, navLights, engineGlow, trailAnchor };
}

export function addPirateBaseVisual(planetMesh) {
    const planetRadius = planetMesh.geometry.parameters.radius;
    const orbitRadius = planetRadius * 1.8;
    const stationScale = Math.max(0.6, planetRadius * 0.35);

    const orbitPivot = new THREE.Group();
    planetMesh.add(orbitPivot);

    const { stationGroup, dockGlow, navLights, engineGlow, trailAnchor } = _createPirateStationMesh();
    stationGroup.scale.setScalar(stationScale);
    stationGroup.position.set(orbitRadius, 0, 0);
    stationGroup.rotation.y = Math.PI;
    orbitPivot.add(stationGroup);

    orbitPivot.rotation.y = Math.random() * Math.PI * 2;
    orbitPivot.rotation.x = 0.1 + Math.random() * 0.2;

    _pirateStations.push({
        pivot: orbitPivot,
        station: stationGroup,
        dockGlow,
        navLights,
        engineGlow,
        trailAnchor,
        orbitSpeed: 0.18 + Math.random() * 0.1,
        _prevPos: new THREE.Vector3()
    });
}

// ── Pirate raider ships ─────────────────────────────────────────────────────

function _createPirateRaiderMesh() {
    const shipGroup = new THREE.Group();
    const hullTex = textures.pirateHull;

    // ── Materials ──
    const hullMat = new THREE.MeshStandardMaterial({
        map: hullTex,
        color: 0x888888, metalness: 0.85, roughness: 0.35,
        emissive: 0x220500, emissiveIntensity: 0.15
    });
    const ribMat = new THREE.MeshStandardMaterial({
        color: 0x111111, metalness: 0.9, roughness: 0.1
    });
    const engineMat = new THREE.MeshStandardMaterial({
        color: 0x222222, metalness: 0.9, roughness: 0.2
    });
    const weaponMat = new THREE.MeshStandardMaterial({
        map: hullTex,
        color: 0x553322, metalness: 0.8, roughness: 0.4,
        emissive: 0x110200, emissiveIntensity: 0.2
    });

    // ── Nose — aggressive pointed cone ──
    const noseGeo = new THREE.CylinderGeometry(0.04, 0.35, 1.1, 6);
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 1.5;
    shipGroup.add(nose);

    // ── Main body — angular fuselage ──
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.5, 1.6);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    body.position.z = 0;
    shipGroup.add(body);

    // ── Cockpit canopy ──
    const cockpitGeo = new THREE.BoxGeometry(0.35, 0.22, 0.55);
    const cockpitMat = new THREE.MeshStandardMaterial({
        color: 0x220000, metalness: 0.6, roughness: 0.1,
        emissive: 0x440000, emissiveIntensity: 0.5
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.32, 0.6);
    shipGroup.add(cockpit);

    // ── Spine ridge on top ──
    const spineGeo = new THREE.BoxGeometry(0.12, 0.18, 1.8);
    const spine = new THREE.Mesh(spineGeo, ribMat);
    spine.position.set(0, 0.3, -0.1);
    shipGroup.add(spine);

    // ── Forward-swept wings ──
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.4, 0);
    wingShape.lineTo(1.6, 0.8);
    wingShape.lineTo(1.4, 1.1);
    wingShape.lineTo(0.1, 0.3);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });

    const lw = new THREE.Mesh(wingGeo, hullMat);
    lw.rotation.x = -Math.PI / 2;
    lw.position.set(0.3, 0, 0.2);
    shipGroup.add(lw);

    const rw = new THREE.Mesh(wingGeo, hullMat);
    rw.rotation.x = -Math.PI / 2;
    rw.rotation.y = Math.PI;
    rw.position.set(-0.3, 0, 0.2);
    shipGroup.add(rw);

    // ── Tail fins — angled vertical stabilizers ──
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(-0.3, 0);
    finShape.lineTo(-0.5, 0.7);
    finShape.lineTo(-0.15, 0.5);
    finShape.lineTo(0, 0);
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });

    const lFin = new THREE.Mesh(finGeo, hullMat);
    lFin.position.set(0.25, 0.2, -0.8);
    lFin.rotation.z = -0.15;
    shipGroup.add(lFin);

    const rFin = new THREE.Mesh(finGeo, hullMat);
    rFin.position.set(-0.25, 0.2, -0.8);
    rFin.rotation.z = 0.15;
    rFin.scale.x = -1;
    shipGroup.add(rFin);

    // ── Wing-mounted weapon pods (mesh only, no barrel sprites) ──
    const podGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6);
    const podL = new THREE.Mesh(podGeo, weaponMat);
    podL.rotation.x = Math.PI / 2;
    podL.position.set(1.1, -0.05, 0.7);
    shipGroup.add(podL);

    const podR = new THREE.Mesh(podGeo, weaponMat);
    podR.rotation.x = Math.PI / 2;
    podR.position.set(-1.1, -0.05, 0.7);
    shipGroup.add(podR);

    // ── Engine block — rear housing ──
    const engineBlockGeo = new THREE.BoxGeometry(0.8, 0.45, 0.5);
    const engineBlock = new THREE.Mesh(engineBlockGeo, ribMat);
    engineBlock.position.set(0, 0, -0.9);
    shipGroup.add(engineBlock);

    // ── Engine nozzles (3 mesh cylinders) ──
    const enginePositions = [
        { x: 0, y: 0, z: -1.15 },
        { x: 0.28, y: 0.1, z: -1.1 },
        { x: -0.28, y: 0.1, z: -1.1 }
    ];

    enginePositions.forEach(pos => {
        const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.14, 0.3, 8),
            engineMat
        );
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(pos.x, pos.y, pos.z);
        shipGroup.add(nozzle);
    });

    // ── Single combined engine flare (covers all 3 nozzles) ──
    const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff3300,
        transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    engineGlow.scale.set(1.6, 1.2, 1);
    engineGlow.position.set(0, 0.03, -1.2);
    shipGroup.add(engineGlow);

    // ── Single white-hot core behind engines ──
    const engineCore = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xffffff,
        transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    engineCore.scale.set(0.6, 0.5, 1);
    engineCore.position.set(0, 0.03, -1.15);
    shipGroup.add(engineCore);

    // ── Single trail anchor (center engine) ──
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, -1.4);
    shipGroup.add(trailAnchor);

    // ── Wing-tip nav lights (depthTest off to prevent square clipping) ──
    const navL = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff2200,
        transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    navL.scale.set(0.35, 0.35, 1);
    navL.position.set(1.5, 0, 0.9);
    shipGroup.add(navL);

    const navR = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff2200,
        transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    navR.scale.set(0.35, 0.35, 1);
    navR.position.set(-1.5, 0, 0.9);
    shipGroup.add(navR);

    // Store references for animation
    shipGroup.userData.engineGlow = engineGlow;
    shipGroup.userData.engineCore = engineCore;
    shipGroup.userData.navLights = [navL, navR];

    return {
        shipGroup,
        engineGlow,
        trailAnchor,
        trailAnchors: [trailAnchor]
    };
}

export function buildPirateRaidRoutes(group) {
    // Remove existing pirate raiders
    _pirateRaiders.forEach(pr => { if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh); });
    _pirateRaiders = [];

    if (!gameState.pirateBase || gameState.pirateBase.defeated) return;

    const pirateMesh = planetMeshes.find(m => m.userData.id === gameState.pirateBase.planetId);
    const homeMesh = planetMeshes.find(m => gameState.colonies[m.userData.id]);
    if (!pirateMesh || !homeMesh) return;

    // 2-3 raider ships flying between pirate base and homeworld
    const raiderCount = 2 + (Math.random() > 0.5 ? 1 : 0);
    for (let s = 0; s < raiderCount; s++) {
        const raider = _createPirateRaiderMesh();
        const scale = 0.55 + Math.random() * 0.25;
        raider.shipGroup.scale.setScalar(scale);
        group.add(raider.shipGroup);

        const goingForward = s % 2 === 0;
        _pirateRaiders.push({
            mesh: raider.shipGroup,
            engineGlow: raider.engineGlow,
            trailAnchor: raider.trailAnchor,
            fromMesh: goingForward ? pirateMesh : homeMesh,
            toMesh: goingForward ? homeMesh : pirateMesh,
            progress: s / raiderCount,
            speed: 0.012 + Math.random() * 0.008,
            arcHeight: 4 + Math.random() * 5,
            lateralOffset: (Math.random() - 0.5) * 3,
            _prevPos: new THREE.Vector3()
        });
    }
}

// ── Laser beam helper ───────────────────────────────────────────────────────

function _createLaserBeam(color, group) {
    const positions = new Float32Array(6); // 2 points × 3 components
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    group.add(line);
    return {
        line, mat,
        setEndpoints(from, to) {
            const pos = line.geometry.attributes.position.array;
            pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
            pos[3] = to.x;   pos[4] = to.y;   pos[5] = to.z;
            line.geometry.attributes.position.needsUpdate = true;
        }
    };
}

// ── Pirate battle animation — cinematic version ─────────────────────────────

function _getHullScale(power) {
    if (power <= 2) return 0.12;   // scout
    if (power <= 5) return 0.18;   // corvette
    return 0.25;                    // cruiser
}

export function playPirateBattle(playerFleets, pirateMesh, homeMesh, onPhase) {
    if (!pirateMesh || !homeMesh) { onPhase('resolve'); return; }

    const group = pirateMesh.parent; // system group
    const battleShips = [];

    // ── Create actual player ship meshes at homeworld ───────────────────────
    playerFleets.forEach((fleet, i) => {
        const accent = fleet.accentColor || '#00f2ff';
        const { shipGroup, engineGlow, trailAnchor } = createPlayerShipMesh(fleet.shipId, accent);
        const scale = _getHullScale(fleet.power || 1);
        shipGroup.scale.setScalar(scale);
        shipGroup.position.copy(homeMesh.position);
        shipGroup.position.y += 1.5 + i * 1.0;
        group.add(shipGroup);
        battleShips.push({ mesh: shipGroup, engineGlow, trailAnchor, fleet, dead: false });
    });

    // ── Get pirate station world position ───────────────────────────────────
    const _pirateStationWorldPos = new THREE.Vector3();
    function getPirateStationPos() {
        if (_pirateStations.length > 0) {
            _pirateStations[0].station.getWorldPosition(_pirateStationWorldPos);
            return _pirateStationWorldPos;
        }
        return pirateMesh.position;
    }

    const startTime = performance.now();
    const TOTAL = 15000; // 15 seconds
    let resolved = false;
    let lastBeamTime = 0;
    let lastPirateBeamTime = 0;

    // Effect arrays
    const flashSprites = [];
    const beams = [];

    // Pre-compute formation offsets (V-shape)
    const n = battleShips.length;
    const formationOffsets = battleShips.map((_, i) => {
        const row = Math.floor(i / 2);
        const side = i % 2 === 0 ? -1 : 1;
        return new THREE.Vector3(side * (1.5 + row * 1.0), 0.5 * row, row * 1.2);
    });

    // Easing: ease-in-out cubic
    function easeInOutCubic(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    // Spawn a flash at a position
    function spawnFlash(pos, color, size, life) {
        const flash = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color,
            transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        flash.scale.set(size, size, 1);
        flash.position.copy(pos);
        group.add(flash);
        flashSprites.push({ sprite: flash, life, maxLife: life });
    }

    // Spawn a laser beam from → to
    function fireBeam(from, to, color, life) {
        const beam = _createLaserBeam(color, group);
        beam.setEndpoints(from, to);
        beams.push({ beam, life, maxLife: life });
        // Impact flash at target
        spawnFlash(to.clone(), color, 1.5 + Math.random() * 1.5, 0.2);
    }

    function animateBattle() {
        const elapsed = performance.now() - startTime;
        const t = elapsed / TOTAL;
        const dt = 0.016; // ~60fps timestep for effect aging

        const piratePos = getPirateStationPos();
        const homePos = homeMesh.position;

        // ═══════════════════════════════════════════════════════════════════
        // Phase 1: Launch & Approach (0–0.4 = 0–6s)
        // ═══════════════════════════════════════════════════════════════════
        if (t < 0.4) {
            const moveT = t / 0.4;
            const eased = easeInOutCubic(moveT);

            battleShips.forEach((bs, i) => {
                // Interpolate from home → pirate with formation offset that shrinks
                const formScale = 1.0 - eased * 0.6; // formation tightens as they approach
                bs.mesh.position.lerpVectors(homePos, piratePos, eased);
                bs.mesh.position.x += formationOffsets[i].x * formScale;
                bs.mesh.position.y += formationOffsets[i].y * formScale + Math.sin(moveT * Math.PI) * (2 + i * 0.4);
                bs.mesh.position.z += formationOffsets[i].z * formScale;

                // Face direction of travel (nose +Z, lookAt aligns -Z, so flip)
                const lookTarget = piratePos.clone();
                lookTarget.y = bs.mesh.position.y;
                const bdx1 = lookTarget.x - bs.mesh.position.x;
                const bdz1 = lookTarget.z - bs.mesh.position.z;
                bs.mesh.lookAt(bs.mesh.position.x - bdx1, bs.mesh.position.y, bs.mesh.position.z - bdz1);

                // Engine glow brightens during approach
                if (bs.engineGlow) {
                    bs.engineGlow.material.opacity = 0.4 + eased * 0.5;
                }
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // Phase 2: Combat (0.4–0.8 = 6–12s)
        // ═══════════════════════════════════════════════════════════════════
        else if (t < 0.8) {
            const combatT = (t - 0.4) / 0.4; // 0→1 within combat phase

            // Ships orbit/strafe around pirate station
            battleShips.forEach((bs, i) => {
                if (bs.dead) { bs.mesh.visible = false; return; }
                const angle = elapsed * 0.001 * (0.8 + i * 0.15) + i * (Math.PI * 2 / n);
                const orbitR = 3 + i * 0.8;
                bs.mesh.position.set(
                    piratePos.x + Math.cos(angle) * orbitR,
                    piratePos.y + 1.0 + Math.sin(elapsed * 0.003 + i) * 0.8,
                    piratePos.z + Math.sin(angle) * orbitR
                );
                // Face toward pirate station (nose +Z, lookAt aligns -Z, so flip)
                const cdx = piratePos.x - bs.mesh.position.x;
                const cdy = piratePos.y - bs.mesh.position.y;
                const cdz = piratePos.z - bs.mesh.position.z;
                bs.mesh.lookAt(bs.mesh.position.x - cdx, bs.mesh.position.y - cdy, bs.mesh.position.z - cdz);

                // Engine glow pulse
                if (bs.engineGlow) {
                    bs.engineGlow.material.opacity = 0.5 + 0.3 * Math.sin(elapsed * 0.005 + i);
                }
            });

            // Player ships fire cyan beams at pirate station
            if (elapsed - lastBeamTime > 150) { // every ~150ms
                lastBeamTime = elapsed;
                const alive = battleShips.filter(bs => !bs.dead);
                if (alive.length > 0) {
                    const shooter = alive[Math.floor(Math.random() * alive.length)];
                    const target = piratePos.clone();
                    target.x += (Math.random() - 0.5) * 1.5;
                    target.y += (Math.random() - 0.5) * 1.0;
                    target.z += (Math.random() - 0.5) * 1.5;
                    fireBeam(shooter.mesh.position.clone(), target, 0x00ccff, 0.25);
                }
            }

            // Pirate station fires red beams back
            if (elapsed - lastPirateBeamTime > 500) { // every ~500ms
                lastPirateBeamTime = elapsed;
                const alive = battleShips.filter(bs => !bs.dead);
                if (alive.length > 0) {
                    const target = alive[Math.floor(Math.random() * alive.length)];
                    const from = piratePos.clone();
                    from.y += 0.5;
                    fireBeam(from, target.mesh.position.clone(), 0xff3322, 0.3);
                }
            }

            // Random explosion flashes in the combat zone
            if (Math.random() > 0.85) {
                const pos = piratePos.clone();
                pos.x += (Math.random() - 0.5) * 6;
                pos.y += (Math.random() - 0.5) * 4 + 1;
                pos.z += (Math.random() - 0.5) * 6;
                spawnFlash(pos, Math.random() > 0.5 ? 0xffaa00 : 0xffffff, 2 + Math.random() * 3, 0.3);
            }

            // Resolve battle at 60% through combat phase (t ≈ 0.64)
            if (!resolved && combatT > 0.5) {
                resolved = true;
                onPhase('resolve');

                // After resolve: mark dead ships (ships lost in result)
                const lostIds = new Set();
                if (gameState.pirateBase && !gameState.pirateBase.defeated) {
                    // Loss: some ships were removed from gameState.fleets
                    playerFleets.forEach(f => {
                        if (!gameState.fleets.find(gf => gf.id === f.id)) {
                            lostIds.add(f.id);
                        }
                    });
                }
                battleShips.forEach(bs => {
                    if (lostIds.has(bs.fleet.id)) {
                        bs.dead = true;
                        // Death explosion
                        spawnFlash(bs.mesh.position.clone(), 0xff6600, 4, 0.5);
                        spawnFlash(bs.mesh.position.clone(), 0xffffff, 3, 0.3);
                    }
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Phase 3: Aftermath (0.8–1.0 = 12–15s)
        // ═══════════════════════════════════════════════════════════════════
        else {
            const afterT = (t - 0.8) / 0.2; // 0→1

            if (gameState.pirateBase && gameState.pirateBase.defeated) {
                // ── Victory: big explosion on station, ships fly home ────────
                // Expanding explosion at pirate station
                if (afterT < 0.3) {
                    const explodeT = afterT / 0.3;
                    if (Math.random() > 0.4) {
                        const pos = piratePos.clone();
                        pos.x += (Math.random() - 0.5) * 3 * explodeT;
                        pos.y += (Math.random() - 0.5) * 3 * explodeT;
                        pos.z += (Math.random() - 0.5) * 3 * explodeT;
                        const colors = [0xff6600, 0xffaa00, 0xffffff, 0xff2200];
                        spawnFlash(pos, colors[Math.floor(Math.random() * colors.length)], 3 + Math.random() * 5, 0.4);
                    }
                }

                // Fade pirate station
                _pirateStations.forEach(ps => {
                    const fadeT = Math.min(1, afterT * 2); // fade in first half
                    const s = ps.station.scale.x;
                    if (s > 0.01) ps.station.scale.setScalar(s * (1 - fadeT * 0.03));
                    if (ps.dockGlow) ps.dockGlow.material.opacity = Math.max(0, (1 - fadeT) * 0.8);
                });

                // Surviving ships fly back (nose +Z, lookAt aligns -Z, so flip)
                const alive = battleShips.filter(bs => !bs.dead);
                alive.forEach((bs, i) => {
                    bs.mesh.position.lerpVectors(piratePos, homePos, afterT);
                    bs.mesh.position.y += Math.sin(afterT * Math.PI) * (2 + i * 0.3);
                    const rdx = homePos.x - bs.mesh.position.x;
                    const rdz = homePos.z - bs.mesh.position.z;
                    bs.mesh.lookAt(bs.mesh.position.x - rdx, bs.mesh.position.y, bs.mesh.position.z - rdz);
                });
            } else {
                // ── Defeat: ships retreat (nose +Z, lookAt aligns -Z, so flip)
                const alive = battleShips.filter(bs => !bs.dead);
                alive.forEach((bs, i) => {
                    bs.mesh.position.lerpVectors(piratePos, homePos, afterT);
                    bs.mesh.position.y += Math.sin(afterT * Math.PI) * (2 + i * 0.3);
                    const rdx2 = homePos.x - bs.mesh.position.x;
                    const rdz2 = homePos.z - bs.mesh.position.z;
                    bs.mesh.lookAt(bs.mesh.position.x - rdx2, bs.mesh.position.y, bs.mesh.position.z - rdz2);
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Update effects (beams + flashes)
        // ═══════════════════════════════════════════════════════════════════

        // Age and remove beams
        for (let i = beams.length - 1; i >= 0; i--) {
            const b = beams[i];
            b.life -= dt;
            if (b.life <= 0) {
                group.remove(b.beam.line);
                b.beam.mat.dispose();
                b.beam.line.geometry.dispose();
                beams.splice(i, 1);
            } else {
                b.beam.mat.opacity = (b.life / b.maxLife) * 0.9;
            }
        }

        // Age and remove flashes
        for (let i = flashSprites.length - 1; i >= 0; i--) {
            const fs = flashSprites[i];
            fs.life -= dt;
            if (fs.life <= 0) {
                group.remove(fs.sprite);
                fs.sprite.material.dispose();
                flashSprites.splice(i, 1);
            } else {
                fs.sprite.material.opacity = (fs.life / fs.maxLife) * 0.9;
                // Expand slightly as they fade
                const grow = 1 + (1 - fs.life / fs.maxLife) * 0.3;
                fs.sprite.scale.multiplyScalar(1 + 0.01 * grow);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Continue or cleanup
        // ═══════════════════════════════════════════════════════════════════
        if (t < 1.0) {
            requestAnimationFrame(animateBattle);
        } else {
            // Cleanup all battle meshes
            battleShips.forEach(bs => group.remove(bs.mesh));
            beams.forEach(b => {
                group.remove(b.beam.line);
                b.beam.mat.dispose();
                b.beam.line.geometry.dispose();
            });
            flashSprites.forEach(fs => {
                group.remove(fs.sprite);
                fs.sprite.material.dispose();
            });

            if (gameState.pirateBase && gameState.pirateBase.defeated) {
                removePirateVisuals();
            }
        }
    }

    requestAnimationFrame(animateBattle);
}

export function removePirateVisuals() {
    _pirateStations.forEach(ps => {
        if (ps.pivot.parent) ps.pivot.parent.remove(ps.pivot);
    });
    _pirateStations = [];
    _pirateRaiders.forEach(pr => {
        if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
    });
    _pirateRaiders = [];
}

// ── Trade ships between colonies ─────────────────────────────────────────────

function _createTradeShipMesh() {
    const shipGroup = new THREE.Group();

    // Sleek wedge hull
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 0.12);
    hullShape.lineTo(-0.08, -0.1);
    hullShape.lineTo(0, -0.06);
    hullShape.lineTo(0.08, -0.1);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
        depth: 0.04, bevelEnabled: false
    });
    hullGeo.center();
    const hullMat = new THREE.MeshStandardMaterial({
        color: 0x8899aa, metalness: 0.7, roughness: 0.3,
        emissive: 0x112233, emissiveIntensity: 0.3
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2;
    shipGroup.add(hull);

    // Engine glow at rear
    const engineGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0x00ccff,
        transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    engineGlow.scale.set(0.35, 0.35, 1);
    engineGlow.position.set(0, 0, -0.12);
    shipGroup.add(engineGlow);

    // Trail anchor for particle emission
    const trailAnchor = new THREE.Object3D();
    trailAnchor.position.set(0, 0, -0.18);
    shipGroup.add(trailAnchor);

    // Nav running lights
    const navL = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0xff3333,
        transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    navL.scale.set(0.08, 0.08, 1);
    navL.position.set(-0.09, 0, 0);
    shipGroup.add(navL);

    const navR = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow, color: 0x33ff33,
        transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    navR.scale.set(0.08, 0.08, 1);
    navR.position.set(0.09, 0, 0);
    shipGroup.add(navR);

    return { shipGroup, engineGlow, trailAnchor };
}

export function buildTradeRoutes(group) {
    // Remove existing trade ships
    _tradeShips.forEach(ts => {
        if (ts.mesh.parent) ts.mesh.parent.remove(ts.mesh);
    });
    _tradeShips = [];

    // Find colonized planet meshes in this system
    const colonyMeshes = planetMeshes.filter(m => gameState.colonies[m.userData.id]);
    if (colonyMeshes.length < 2) return;

    // Build routes between colony pairs (limit to avoid clutter)
    const pairs = [];
    for (let i = 0; i < colonyMeshes.length; i++) {
        for (let j = i + 1; j < colonyMeshes.length; j++) {
            pairs.push([colonyMeshes[i], colonyMeshes[j]]);
        }
    }

    // Cap at 6 routes max
    const routes = pairs.slice(0, 6);

    routes.forEach(([meshA, meshB]) => {
        // 2-3 ships per route, staggered
        const shipsPerRoute = 2 + (Math.random() > 0.5 ? 1 : 0);
        for (let s = 0; s < shipsPerRoute; s++) {
            const { shipGroup, engineGlow, trailAnchor } = _createTradeShipMesh();
            const scale = 0.8 + Math.random() * 0.5;
            shipGroup.scale.setScalar(scale);
            group.add(shipGroup);

            // Alternate direction: even ships go A→B, odd go B→A
            const goingForward = s % 2 === 0;

            _tradeShips.push({
                mesh: shipGroup,
                engineGlow,
                trailAnchor,
                fromMesh: goingForward ? meshA : meshB,
                toMesh: goingForward ? meshB : meshA,
                progress: s / shipsPerRoute,  // stagger start
                speed: 0.015 + Math.random() * 0.01,  // full trip in ~50-70s
                arcHeight: 3 + Math.random() * 4,
                lateralOffset: (Math.random() - 0.5) * 2,
                _prevPos: new THREE.Vector3()
            });
        }
    });
}

export function updateSystemAnimations(time, dt, group) {
    // Init trail pool on first animation tick if satellites or trade ships exist
    if (!_trailInited && (_colonySatellites.length > 0 || _tradeShips.length > 0 || _shipyardStations.length > 0 || _pirateStations.length > 0 || _pirateRaiders.length > 0 || getPlayerShipMeshes().length > 0) && group) {
        _initSatTrailPool(group);
    }

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
    // Single shared time uniform drives ALL planet glow pulsing via GPU shader
    _glowTime.value = time;

    planetMeshes.forEach((mesh) => {
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

    // ── Animate moons ─────────────────────────────────────────────────────
    _moonGroups.forEach(entry => {
        // Track parent planet position
        entry.pivot.position.copy(entry.parentMesh.position);

        // Orbit the moon around the pivot
        const a = entry.data.angle + time * entry.data.speed * 10;
        entry.moonMesh.position.x = Math.cos(a) * entry.data.orbitRadius;
        entry.moonMesh.position.z = Math.sin(a) * entry.data.orbitRadius;
        entry.moonMesh.rotation.y += 0.008;
    });

    // ── Animate asteroid belt ─────────────────────────────────────────────
    if (_asteroidBelt) {
        _asteroidBelt.group.rotation.y += 0.0002;
    }

    // ── Animate colony satellites + engine trails ─────────────────────────────
    _colonySatellites.forEach(entry => {
        entry.pivot.rotation.y += entry.orbitSpeed * 0.008;

        // Nav light blink
        const blinkOn = Math.floor(time * 2.0) % 2 === 0;
        entry.navLight.material.color.setHex(blinkOn ? entry.navColor : 0x112233);
        entry.navGlow.material.opacity = blinkOn ? 0.7 : 0.08;

        // Engine glow pulse
        if (entry.engineGlow) {
            const pulse = 0.5 + 0.15 * Math.sin(time * 6.0);
            entry.engineGlow.material.opacity = pulse;
        }

        // Gentle panel wobble
        entry.sat.rotation.z = Math.sin(time * 0.4) * 0.06;

        // Spawn engine trail particles
        if (entry.trailAnchor && _trailInited) {
            entry.trailAnchor.getWorldPosition(_trailWorldPos);

            // Compute velocity from position delta for natural trail drift
            const dx = _trailWorldPos.x - entry._prevPos.x;
            const dy = _trailWorldPos.y - entry._prevPos.y;
            const dz = _trailWorldPos.z - entry._prevPos.z;

            // Skip first frame (prevPos is origin → huge delta)
            const hasValid = entry._prevPos.lengthSq() > 0.001;
            entry._prevPos.copy(_trailWorldPos);

            if (hasValid) {
                _spawnSatTrail(
                    _trailWorldPos.x, _trailWorldPos.y, _trailWorldPos.z,
                    -dx * 2, -dy * 2, -dz * 2
                );
            }
        }
    });

    // ── Animate shipyard stations ─────────────────────────────────────────────
    _shipyardStations.forEach(entry => {
        // Slow majestic orbit
        entry.pivot.rotation.y += entry.orbitSpeed * 0.005;

        // Dock bay glow pulse (purple construction energy)
        if (entry.dockGlow) {
            const glowPulse = 0.4 + 0.25 * Math.sin(time * 2.0) + 0.1 * Math.sin(time * 5.3);
            entry.dockGlow.material.opacity = glowPulse;
            const glowScale = 1.3 + 0.15 * Math.sin(time * 1.5);
            entry.dockGlow.scale.set(glowScale, glowScale, 1);
        }

        // Nav light blink pattern (alternating pairs)
        entry.navLights.forEach((nav, i) => {
            const phase = i < 2 ? 0 : Math.PI; // Top/bottom vs left/right alternate
            const blinkOn = Math.sin(time * 2.5 + phase) > 0;
            nav.mesh.material.color.setHex(blinkOn ? 0xb496ff : 0x221133);
            nav.glow.material.opacity = blinkOn ? 0.6 : 0.05;
        });

        // Engine glow pulse
        if (entry.engineGlow) {
            entry.engineGlow.material.opacity = 0.4 + 0.15 * Math.sin(time * 4.0);
        }

        // Rotate the ring element inside the station
        entry.station.children.forEach(child => {
            if (child.userData._isRing) {
                child.rotation.z += 0.008;
            }
        });

        // Gentle pitch/roll wobble
        entry.station.rotation.x = Math.sin(time * 0.3) * 0.04;
        entry.station.rotation.z = Math.cos(time * 0.25) * 0.03;

        // Engine trail particles
        if (entry.trailAnchor && _trailInited) {
            entry.trailAnchor.getWorldPosition(_trailWorldPos);
            const dx = _trailWorldPos.x - entry._prevPos.x;
            const dy = _trailWorldPos.y - entry._prevPos.y;
            const dz = _trailWorldPos.z - entry._prevPos.z;
            const hasValid = entry._prevPos.lengthSq() > 0.001;
            entry._prevPos.copy(_trailWorldPos);
            if (hasValid) {
                _spawnSatTrail(
                    _trailWorldPos.x, _trailWorldPos.y, _trailWorldPos.z,
                    -dx * 1.5, -dy * 1.5, -dz * 1.5
                );
            }
        }
    });

    // ── Animate pirate stations ─────────────────────────────────────────────
    _pirateStations.forEach(entry => {
        entry.pivot.rotation.y += entry.orbitSpeed * 0.005;

        if (entry.dockGlow) {
            const glowPulse = 0.4 + 0.3 * Math.sin(time * 2.5) + 0.1 * Math.sin(time * 6.0);
            entry.dockGlow.material.opacity = glowPulse;
            const glowScale = 1.4 + 0.2 * Math.sin(time * 1.8);
            entry.dockGlow.scale.set(glowScale, glowScale, 1);
        }

        entry.navLights.forEach((nav, i) => {
            const phase = i < 2 ? 0 : Math.PI;
            const blinkOn = Math.sin(time * 3.0 + phase) > 0;
            nav.mesh.material.color.setHex(blinkOn ? 0xff3322 : 0x220500);
            nav.glow.material.opacity = blinkOn ? 0.7 : 0.05;
        });

        if (entry.engineGlow) {
            entry.engineGlow.material.opacity = 0.5 + 0.2 * Math.sin(time * 5.0);
        }

        entry.station.rotation.x = Math.sin(time * 0.35) * 0.03;
        entry.station.rotation.z = Math.cos(time * 0.28) * 0.04;

        if (entry.trailAnchor && _trailInited) {
            entry.trailAnchor.getWorldPosition(_trailWorldPos);
            const dx = _trailWorldPos.x - entry._prevPos.x;
            const dy = _trailWorldPos.y - entry._prevPos.y;
            const dz = _trailWorldPos.z - entry._prevPos.z;
            const hasValid = entry._prevPos.lengthSq() > 0.001;
            entry._prevPos.copy(_trailWorldPos);
            if (hasValid) {
                _spawnSatTrail(
                    _trailWorldPos.x, _trailWorldPos.y, _trailWorldPos.z,
                    -dx * 1.5, -dy * 1.5, -dz * 1.5
                );
            }
        }
    });

    // ── Animate pirate raiders ────────────────────────────────────────────────
    _pirateRaiders.forEach(ts => {
        ts.progress += ts.speed * dt;
        if (ts.progress >= 1) {
            const tmp = ts.fromMesh;
            ts.fromMesh = ts.toMesh;
            ts.toMesh = tmp;
            ts.progress -= 1;
        }

        _shipTmpFrom.copy(ts.fromMesh.position);
        _shipTmpTo.copy(ts.toMesh.position);

        const t2 = ts.progress;
        const eased = t2 < 0.5 ? 4 * t2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 3) / 2;

        ts.mesh.position.lerpVectors(_shipTmpFrom, _shipTmpTo, eased);
        const arcT = Math.sin(t2 * Math.PI);
        ts.mesh.position.y += arcT * ts.arcHeight;

        const midX = (_shipTmpTo.z - _shipTmpFrom.z);
        const midZ = -(_shipTmpTo.x - _shipTmpFrom.x);
        const lateralLen = Math.sqrt(midX * midX + midZ * midZ);
        if (lateralLen > 0.01) {
            ts.mesh.position.x += (midX / lateralLen) * ts.lateralOffset * arcT;
            ts.mesh.position.z += (midZ / lateralLen) * ts.lateralOffset * arcT;
        }

        _shipTmpDir.subVectors(_shipTmpTo, _shipTmpFrom).normalize();
        // Pirate raider nose is +Z — Object3D.lookAt makes +Z face target
        ts.mesh.lookAt(
            ts.mesh.position.x + _shipTmpDir.x,
            ts.mesh.position.y + _shipTmpDir.y,
            ts.mesh.position.z + _shipTmpDir.z
        );

        // Engine glow + core pulse (single combined sprites)
        const ud = ts.mesh.userData;
        if (ud.engineGlow) {
            ud.engineGlow.material.opacity = 0.6 + 0.25 * Math.sin(time * 6.0);
            const s = 1.5 + 0.15 * Math.sin(time * 8.0);
            ud.engineGlow.scale.set(s, s * 0.8, 1);
        }
        if (ud.engineCore) {
            ud.engineCore.material.opacity = 0.4 + 0.3 * Math.sin(time * 7.0);
        }

        // Nav light blink — alternating
        if (ud.navLights) {
            ud.navLights.forEach((nav, i) => {
                const blinkOn = Math.sin(time * 3.5 + i * Math.PI) > 0;
                nav.material.opacity = blinkOn ? 0.6 : 0.08;
            });
        }

        // Trail particles
        if (ts.trailAnchor && _trailInited) {
            ts.trailAnchor.getWorldPosition(_trailWorldPos);
            const dx = _trailWorldPos.x - ts._prevPos.x;
            const dy = _trailWorldPos.y - ts._prevPos.y;
            const dz = _trailWorldPos.z - ts._prevPos.z;
            const hasValid = ts._prevPos.lengthSq() > 0.001;
            ts._prevPos.copy(_trailWorldPos);
            if (hasValid) {
                _spawnSatTrail(
                    _trailWorldPos.x, _trailWorldPos.y, _trailWorldPos.z,
                    -dx * 2, -dy * 2, -dz * 2
                );
            }
        }
    });

    // ── Animate trade ships ─────────────────────────────────────────────────
    _tradeShips.forEach(ts => {
        ts.progress += ts.speed * dt;
        if (ts.progress >= 1) {
            // Swap direction — ship loops back
            const tmp = ts.fromMesh;
            ts.fromMesh = ts.toMesh;
            ts.toMesh = tmp;
            ts.progress -= 1;
        }

        // Get current planet world positions
        _shipTmpFrom.copy(ts.fromMesh.position);
        _shipTmpTo.copy(ts.toMesh.position);

        // Cubic ease for smooth acceleration/deceleration
        const t = ts.progress;
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Lerp along the route with an arc
        ts.mesh.position.lerpVectors(_shipTmpFrom, _shipTmpTo, eased);

        // Arc height peaks at midpoint
        const arcT = Math.sin(t * Math.PI);
        ts.mesh.position.y += arcT * ts.arcHeight;

        // Lateral offset for visual separation between ships on same route
        const midX = (_shipTmpTo.z - _shipTmpFrom.z);
        const midZ = -(_shipTmpTo.x - _shipTmpFrom.x);
        const lateralLen = Math.sqrt(midX * midX + midZ * midZ);
        if (lateralLen > 0.01) {
            ts.mesh.position.x += (midX / lateralLen) * ts.lateralOffset * arcT;
            ts.mesh.position.z += (midZ / lateralLen) * ts.lateralOffset * arcT;
        }

        // Face direction of travel — Object3D.lookAt makes +Z face target
        _shipTmpDir.copy(_shipTmpTo).sub(_shipTmpFrom).normalize();
        if (_shipTmpDir.lengthSq() > 0.001) {
            ts.mesh.lookAt(
                ts.mesh.position.x + _shipTmpDir.x,
                ts.mesh.position.y + _shipTmpDir.y * 0.3,
                ts.mesh.position.z + _shipTmpDir.z
            );
        }

        // Engine glow pulse
        if (ts.engineGlow) {
            ts.engineGlow.material.opacity = 0.5 + 0.25 * Math.sin(time * 8 + ts.progress * 20);
        }

        // Spawn trail particles
        if (ts.trailAnchor && _trailInited) {
            ts.trailAnchor.getWorldPosition(_trailWorldPos);
            const dx = _trailWorldPos.x - ts._prevPos.x;
            const dy = _trailWorldPos.y - ts._prevPos.y;
            const dz = _trailWorldPos.z - ts._prevPos.z;
            const hasValid = ts._prevPos.lengthSq() > 0.001;
            ts._prevPos.copy(_trailWorldPos);

            if (hasValid && Math.random() < 0.6) {
                _spawnSatTrail(
                    _trailWorldPos.x, _trailWorldPos.y, _trailWorldPos.z,
                    -dx * 1.5, -dy * 1.5, -dz * 1.5
                );
            }
        }
    });

    // ── Player fleet ship orbits ──
    updatePlayerShipOrbits(time, dt);

    // Update trail particles
    if (_trailInited && dt > 0) {
        _updateSatTrails(dt);
    }
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
        const r = 400 + Math.random() * 800;
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
        const r = 200 + Math.random() * 400;
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
        fog: false,
    });

    group.add(new THREE.Points(geo, mat));
}