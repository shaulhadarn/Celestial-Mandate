/* Updated: Cinematic premium splash scene with layered starfields, nebula depth, and upgraded planet presentation */
import * as THREE from 'three';
import { isMobile } from '../core/device.js';
import {
    createGlowTexture,
    createHaloRingTexture,
    createHullTexture,
    createNebulaTexture,
    createSoftGlowTexture
} from '../core/splash_assets.js';
import { createSplashScreenShip, createCapitalFleet, resetShip } from './splash_ships.js';
import { spawnTrailParticle, updateTrailParticles, disposeTrailPool } from './splash_particles.js';
import { setupSplashLighting } from './splash_lighting.js';
import { createSplashMoon, createSplashSatellites, updateMoon, updateSatellites } from './splash_celestial.js';
import { createSplashPlanetGroup } from './splash_planet_components.js';

let scene;
let camera;
let renderer;
let planet;
let clouds;
let cityLights;
let moon;
let atmosphere;
let innerGlow;
let coronaGlow;
let outerGlow;
let moonGlowInner;
let moonGlowOuter;
let moonRim;
let animationId;
let lastTime = performance.now();
let globalFade = 0;
const FADE_DURATION = 1.5;
const ships = [];
let satellites = [];
let trailTexture;
let hullTexture;
let splashLights = null;
let starLayers = [];
let nebulaLayers = [];
let flareLayers = [];

const lightDirection = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const trailWorldPosition = new THREE.Vector3();

export function initSplashPlanet(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (renderer) {
        stopSplashPlanet();
    }

    const compactScene = isMobile;
    globalFade = 0;
    lastTime = performance.now();
    ships.length = 0;
    satellites = [];
    starLayers = [];
    nebulaLayers = [];
    flareLayers = [];

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020408, compactScene ? 0.0048 : 0.0038);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = compactScene ? 18.4 : 15.6;

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactScene ? 1.45 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = compactScene ? 1.02 : 1.12;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    trailTexture = createGlowTexture();
    trailTexture.colorSpace = THREE.SRGBColorSpace;
    hullTexture = createHullTexture();
    hullTexture.colorSpace = THREE.SRGBColorSpace;
    const glowTex = createGlowTexture();
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const softGlowTex = createSoftGlowTexture();
    softGlowTex.colorSpace = THREE.SRGBColorSpace;
    const haloRingTex = createHaloRingTexture();
    haloRingTex.colorSpace = THREE.SRGBColorSpace;

    const planetGroup = createSplashPlanetGroup(
        scene,
        renderer,
        { softGlowTex, haloRingTex, glowTex },
        compactScene
    );
    planet = planetGroup.planet;
    clouds = planetGroup.clouds;
    cityLights = planetGroup.cityLights;
    atmosphere = planetGroup.atmosphere;
    innerGlow = planetGroup.innerGlow;
    coronaGlow = planetGroup.coronaGlow;
    outerGlow = planetGroup.outerGlow;

    splashLights = setupSplashLighting(scene, compactScene);
    lightDirection.copy(splashLights.sunLight.position).normalize();
    atmosphere.material.uniforms.uLightDirection.value.copy(lightDirection);
    cityLights.material.uniforms.uLightDirection.value.copy(lightDirection);

    const background = buildSpaceBackground(scene, glowTex, compactScene);
    starLayers = background.starLayers;
    nebulaLayers = background.nebulaLayers;
    flareLayers = background.flareLayers;

    const moonGroup = createSplashMoon(scene, { softGlowTex, haloRingTex });
    moon = moonGroup.moon;
    moonGlowInner = moonGroup.moonGlowInner;
    moonGlowOuter = moonGroup.moonGlowOuter;
    moonRim = moonGroup.moonRim;

    satellites = createSplashSatellites(scene, trailTexture);

    const texGroup = { hullTexture, trailTexture };
    const scout = createSplashScreenShip('scout', texGroup);
    resetShip(scout, ships, true);
    scene.add(scout);
    ships.push(scout);

    const fleet = createCapitalFleet(texGroup);
    resetShip(fleet, ships, true);
    scene.add(fleet);
    ships.push(fleet);

    applyPlanetLayout(compactScene);

    function animate(currentTime) {
        animationId = requestAnimationFrame(animate);
        if (!renderer || !scene || !camera || !planet) return;

        const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;
        const timeSeconds = currentTime * 0.001;

        globalFade = Math.min(1, globalFade + dt / FADE_DURATION);

        planet.rotation.y += 0.04 * dt;
        planet.rotation.x = Math.sin(timeSeconds * 0.12) * 0.035;
        if (clouds) {
            clouds.rotation.y += 0.065 * dt;
            clouds.rotation.x = Math.sin(timeSeconds * 0.1) * 0.02;
        }
        if (atmosphere) {
            atmosphere.rotation.y += 0.01 * dt;
            atmosphere.material.uniforms.uTime.value = timeSeconds;
            atmosphere.material.uniforms.uOpacity.value = globalFade * (0.94 + Math.sin(timeSeconds * 0.45) * 0.06);
        }
        if (cityLights) {
            cityLights.material.uniforms.uTime.value = timeSeconds;
            cityLights.material.uniforms.uOpacity.value = globalFade * 0.95;
        }

        const isCompactLive = window.innerWidth <= 768;
        const baseZ = isCompactLive ? 18.4 : 15.6;
        camera.position.x = Math.sin(currentTime * 0.00017) * (isCompactLive ? 1.05 : 1.7) - (isCompactLive ? 0 : 0.2);
        camera.position.y = Math.cos(currentTime * 0.00011) * 0.8 + (isCompactLive ? 3.55 : 0.38);
        camera.position.z = baseZ + Math.sin(currentTime * 0.00008) * (isCompactLive ? 0.65 : 1.05);
        cameraTarget.set(
            planet.position.x - (isCompactLive ? 0.0 : 0.35),
            planet.position.y + 0.18,
            0
        );
        camera.lookAt(cameraTarget);

        planet.material.opacity = globalFade;
        if (clouds) clouds.material.opacity = globalFade * 0.42;

        // Dynamic glow pulsing — star-like breathing effect
        const corePulse = 0.88 + Math.sin(timeSeconds * 1.1) * 0.12;
        const midPulse = 0.90 + Math.sin(timeSeconds * 0.65 + 1.2) * 0.10;
        const outerPulse = 0.94 + Math.cos(timeSeconds * 0.4) * 0.06;

        innerGlow.material.opacity = globalFade * innerGlow.userData.targetOpacity * corePulse;
        coronaGlow.material.opacity = globalFade * coronaGlow.userData.targetOpacity * midPulse;
        outerGlow.material.opacity = globalFade * outerGlow.userData.targetOpacity * outerPulse;

        if (innerGlow.userData.baseScale) {
            const scalePulse = 0.96 + Math.sin(timeSeconds * 0.9) * 0.04;
            innerGlow.scale.set(innerGlow.userData.baseScale.x * scalePulse, innerGlow.userData.baseScale.y * scalePulse, 1);
        }
        if (coronaGlow.userData.baseScale) {
            const scalePulse = 0.97 + Math.sin(timeSeconds * 0.55 + 1.1) * 0.04;
            coronaGlow.scale.set(coronaGlow.userData.baseScale.x * scalePulse, coronaGlow.userData.baseScale.y * scalePulse, 1);
        }
        if (outerGlow.userData.baseScale) {
            const scalePulse = 0.985 + Math.cos(timeSeconds * 0.35) * 0.025;
            outerGlow.scale.set(outerGlow.userData.baseScale.x * scalePulse, outerGlow.userData.baseScale.y * scalePulse, 1);
        }

        if (moon) {
            moon.material.opacity = globalFade;
            moonGlowInner.material.opacity = globalFade * moonGlowInner.userData.targetOpacity * (0.92 + Math.sin(timeSeconds * 0.61) * 0.08);
            moonGlowOuter.material.opacity = globalFade * moonGlowOuter.userData.targetOpacity * (0.9 + Math.cos(timeSeconds * 0.45) * 0.1);
            moonRim.material.uniforms.uOpacity.value = globalFade * (0.9 + Math.sin(timeSeconds * 0.38) * 0.1);
            if (moonGlowInner.userData.baseScale) {
                const pulse = 0.986 + Math.sin(timeSeconds * 0.58) * 0.028;
                moonGlowInner.scale.set(moonGlowInner.userData.baseScale.x * pulse, moonGlowInner.userData.baseScale.y * pulse, 1);
            }
            if (moonGlowOuter.userData.baseScale) {
                const pulse = 0.99 + Math.cos(timeSeconds * 0.42 + 0.6) * 0.024;
                moonGlowOuter.scale.set(moonGlowOuter.userData.baseScale.x * pulse, moonGlowOuter.userData.baseScale.y * pulse, 1);
            }
        }

        starLayers.forEach((layer) => {
            layer.mesh.rotation.y += dt * layer.mesh.userData.rotationYSpeed;
            layer.mesh.rotation.x = Math.sin(timeSeconds * 0.08 + layer.mesh.userData.phase) * layer.mesh.userData.rotationXAmplitude;
            layer.material.uniforms.time.value = timeSeconds;
            layer.material.uniforms.uFade.value = globalFade * layer.mesh.userData.baseOpacity;
        });

        nebulaLayers.forEach((layer, index) => {
            const pulse = 0.92 + Math.sin(timeSeconds * layer.userData.pulseSpeed + layer.userData.phase) * 0.08;
            layer.position.x = layer.userData.baseX + Math.sin(timeSeconds * layer.userData.driftX + layer.userData.phase) * layer.userData.rangeX;
            layer.position.y = layer.userData.baseY + Math.cos(timeSeconds * layer.userData.driftY + layer.userData.phase) * layer.userData.rangeY;
            layer.material.opacity = globalFade * layer.userData.baseOpacity * pulse;
            layer.material.rotation = Math.sin(timeSeconds * 0.03 + index) * 0.08;
        });

        flareLayers.forEach((layer) => {
            const pulse = 0.94 + Math.sin(timeSeconds * layer.userData.pulseSpeed + layer.userData.phase) * 0.06;
            layer.material.opacity = globalFade * layer.userData.baseOpacity * pulse;
            layer.scale.set(
                layer.userData.baseScale.x * pulse,
                layer.userData.baseScale.y * pulse,
                1
            );
        });

        updateSatellites(satellites, currentTime);
        updateMoon(moon, currentTime, dt);

        ships.forEach((shipOrFleet) => {
            shipOrFleet.position.x += shipOrFleet.userData.speed * dt;
            shipOrFleet.position.y = shipOrFleet.userData.baseY + Math.sin(timeSeconds * 1.05 + shipOrFleet.userData.offset) * 0.22;
            shipOrFleet.position.z = shipOrFleet.userData.baseZ + Math.cos(timeSeconds * 0.78 + shipOrFleet.userData.offset * 0.6) * 0.18;
            shipOrFleet.rotation.x = shipOrFleet.userData.baseRotX + Math.sin(timeSeconds * 0.68 + shipOrFleet.userData.offset) * 0.035;
            shipOrFleet.rotation.z = Math.sin(timeSeconds * 0.48 + shipOrFleet.userData.offset) * 0.03;

            shipOrFleet.updateMatrixWorld(true);

            const subShips = shipOrFleet.userData.isFleet ? shipOrFleet.userData.ships : [shipOrFleet];
            subShips.forEach((ship) => {
                if (!ship.userData.engineGlows) return;

                const flicker = 0.92 + Math.random() * 0.08;
                const pulse = 0.94 + Math.sin(timeSeconds * 8 + shipOrFleet.userData.offset) * 0.08;
                ship.userData.engineGlows.forEach((glow) => {
                    const baseScale = glow.material.color.r > 0.5 ? 1.55 : 0.78;
                    glow.scale.setScalar(baseScale * pulse * flicker);
                    glow.material.opacity = 0.66 * flicker;
                });
            });

            const spawnRate = isCompactLive ? 60 : 40;
            if (currentTime - shipOrFleet.userData.lastTrailSpawn > spawnRate) {
                subShips.forEach((ship) => {
                    if (!ship.userData.trailAnchors) return;

                    ship.userData.trailAnchors.forEach((anchor) => {
                        anchor.getWorldPosition(trailWorldPosition);
                        spawnTrailParticle(scene, trailWorldPosition, trailTexture);
                    });
                });
                shipOrFleet.userData.lastTrailSpawn = currentTime;
            }

            if (shipOrFleet.position.x > 32) {
                resetShip(shipOrFleet, ships);
            }
        });

        updateTrailParticles(scene, dt);
        renderer.render(scene, camera);
    }

    animationId = requestAnimationFrame(animate);
    window.addEventListener('resize', onResize);
}

function buildSpaceBackground(currentScene, glowTex, compactScene) {
    const starFieldLayers = [
        createStarLayer(currentScene, {
            count: compactScene ? 1300 : 2400,
            spreadX: 460,
            spreadY: 280,
            zMin: -250,
            zMax: -70,
            sizeMin: 0.8,
            sizeMax: compactScene ? 2.0 : 2.5,
            opacityMin: 0.22,
            opacityMax: 0.68,
            palette: [0xffffff, 0xc9dcff, 0x8fd1ff],
            rotationYSpeed: 0.0022,
            rotationXAmplitude: 0.022,
            baseOpacity: 0.74
        }),
        createStarLayer(currentScene, {
            count: compactScene ? 260 : 560,
            spreadX: 380,
            spreadY: 220,
            zMin: -190,
            zMax: -35,
            sizeMin: 1.6,
            sizeMax: compactScene ? 3.4 : 4.4,
            opacityMin: 0.32,
            opacityMax: 0.92,
            palette: [0xffffff, 0xdce9ff, 0x80d8ff, 0xffd5af],
            rotationYSpeed: 0.0046,
            rotationXAmplitude: 0.038,
            baseOpacity: 1.0
        })
    ];

    const nebulaConfigs = compactScene
        ? [
            {
                position: new THREE.Vector3(-22, 7, -112),
                scale: new THREE.Vector3(112, 68, 1),
                colors: ['rgba(0, 228, 255, 0.16)', 'rgba(28, 80, 255, 0.12)', 'rgba(255, 165, 118, 0.06)'],
                opacity: 0.16
            },
            {
                position: new THREE.Vector3(20, -7, -118),
                scale: new THREE.Vector3(102, 58, 1),
                colors: ['rgba(255, 142, 88, 0.18)', 'rgba(102, 78, 255, 0.12)', 'rgba(0, 242, 255, 0.08)'],
                opacity: 0.14
            },
            {
                position: new THREE.Vector3(-6, -10, -132),
                scale: new THREE.Vector3(120, 60, 1),
                colors: ['rgba(0, 208, 255, 0.09)', 'rgba(70, 116, 255, 0.08)', 'rgba(255, 174, 118, 0.04)'],
                opacity: 0.08
            }
        ]
        : [
            {
                position: new THREE.Vector3(-30, 6, -112),
                scale: new THREE.Vector3(132, 82, 1),
                colors: ['rgba(0, 228, 255, 0.18)', 'rgba(28, 80, 255, 0.14)', 'rgba(255, 165, 118, 0.06)'],
                opacity: 0.18
            },
            {
                position: new THREE.Vector3(25, -8, -122),
                scale: new THREE.Vector3(108, 64, 1),
                colors: ['rgba(255, 142, 88, 0.22)', 'rgba(102, 78, 255, 0.14)', 'rgba(0, 242, 255, 0.09)'],
                opacity: 0.16
            },
            {
                position: new THREE.Vector3(4, 15, -148),
                scale: new THREE.Vector3(140, 78, 1),
                colors: ['rgba(54, 116, 255, 0.16)', 'rgba(0, 214, 255, 0.12)', 'rgba(255, 255, 255, 0.06)'],
                opacity: 0.1
            },
            {
                position: new THREE.Vector3(-8, -11, -136),
                scale: new THREE.Vector3(132, 68, 1),
                colors: ['rgba(0, 214, 255, 0.1)', 'rgba(74, 118, 255, 0.08)', 'rgba(255, 184, 126, 0.04)'],
                opacity: 0.08
            }
        ];

    const nebulaFieldLayers = nebulaConfigs.map((config, index) =>
        createNebulaLayer(currentScene, {
            ...config,
            driftX: 0.04 + index * 0.012,
            driftY: 0.03 + index * 0.01,
            rangeX: 1.6 + index * 0.6,
            rangeY: 1.1 + index * 0.35,
            pulseSpeed: 0.22 + index * 0.07
        })
    );

    const flareFieldLayers = [
        createFlareLayer(currentScene, glowTex, {
            position: new THREE.Vector3(22, 10, -58),
            scale: new THREE.Vector3(54, 54, 1),
            color: 0xffc48f,
            opacity: compactScene ? 0.14 : 0.2,
            pulseSpeed: 0.7
        }),
        createFlareLayer(currentScene, glowTex, {
            position: new THREE.Vector3(21, 10, -60),
            scale: new THREE.Vector3(96, 10, 1),
            color: 0xffc58c,
            opacity: compactScene ? 0.05 : 0.08,
            pulseSpeed: 0.52
        }),
        createFlareLayer(currentScene, glowTex, {
            position: new THREE.Vector3(22.5, 10.5, -57),
            scale: new THREE.Vector3(18, 18, 1),
            color: 0xffffff,
            opacity: compactScene ? 0.12 : 0.18,
            pulseSpeed: 0.92
        })
    ];

    return {
        starLayers: starFieldLayers,
        nebulaLayers: nebulaFieldLayers,
        flareLayers: flareFieldLayers
    };
}

function createStarLayer(currentScene, config) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const sizes = new Float32Array(config.count);
    const alphas = new Float32Array(config.count);
    const twinkles = new Float32Array(config.count);
    const colors = new Float32Array(config.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < config.count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * config.spreadX;
        positions[i * 3 + 1] = (Math.random() - 0.5) * config.spreadY;
        positions[i * 3 + 2] = THREE.MathUtils.lerp(config.zMin, config.zMax, Math.random());
        sizes[i] = THREE.MathUtils.lerp(config.sizeMin, config.sizeMax, Math.random());
        alphas[i] = THREE.MathUtils.lerp(config.opacityMin, config.opacityMax, Math.random());
        twinkles[i] = 0.45 + Math.random() * 2.2;

        color.set(config.palette[Math.floor(Math.random() * config.palette.length)]);
        color.offsetHSL((Math.random() - 0.5) * 0.03, 0, Math.random() * 0.08);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            uFade: { value: 0 }
        },
        vertexShader: `
            attribute float aSize;
            attribute float aAlpha;
            attribute float aTwinkle;
            attribute vec3 aColor;
            varying float vAlpha;
            varying float vTwinkle;
            varying vec3 vColor;
            void main() {
                vAlpha = aAlpha;
                vTwinkle = aTwinkle;
                vColor = aColor;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                float depthScale = clamp(300.0 / max(-mvPosition.z, 1.0), 0.0, 6.0);
                gl_PointSize = aSize * depthScale;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float uFade;
            varying float vAlpha;
            varying float vTwinkle;
            varying vec3 vColor;
            void main() {
                vec2 uv = gl_PointCoord - vec2(0.5);
                float dist = length(uv);
                if (dist > 0.5) discard;
                float core = smoothstep(0.34, 0.0, dist);
                float halo = smoothstep(0.5, 0.12, dist) * 0.42;
                float twinkle = 0.78 + sin(time * vTwinkle + vTwinkle * 6.2831) * 0.22;
                float alpha = (core + halo) * vAlpha * twinkle * uFade;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const mesh = new THREE.Points(geometry, material);
    mesh.frustumCulled = false;
    mesh.userData = {
        rotationYSpeed: config.rotationYSpeed,
        rotationXAmplitude: config.rotationXAmplitude,
        phase: Math.random() * Math.PI * 2,
        baseOpacity: config.baseOpacity
    };
    currentScene.add(mesh);

    return { mesh, material };
}

function createNebulaLayer(currentScene, config) {
    const texture = createNebulaTexture(config.colors);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(config.position);
    sprite.scale.copy(config.scale);
    sprite.userData = {
        baseX: config.position.x,
        baseY: config.position.y,
        rangeX: config.rangeX,
        rangeY: config.rangeY,
        driftX: config.driftX,
        driftY: config.driftY,
        pulseSpeed: config.pulseSpeed,
        baseOpacity: config.opacity,
        phase: Math.random() * Math.PI * 2
    };
    currentScene.add(sprite);
    return sprite;
}

function createFlareLayer(currentScene, glowTex, config) {
    const material = new THREE.SpriteMaterial({
        map: glowTex,
        color: config.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(config.position);
    sprite.scale.copy(config.scale);
    sprite.userData = {
        baseScale: config.scale.clone(),
        baseOpacity: config.opacity,
        pulseSpeed: config.pulseSpeed,
        phase: Math.random() * Math.PI * 2
    };
    currentScene.add(sprite);
    return sprite;
}

function applyPlanetLayout(compactScene) {
    if (!planet) return;

    const px = compactScene ? 0 : 4.5;
    const py = compactScene ? 3.25 : 0.15;

    planet.position.set(px, py, 0);
    if (atmosphere) atmosphere.position.copy(planet.position);

    [innerGlow, coronaGlow, outerGlow].forEach((glow) => {
        if (!glow) return;
        glow.position.copy(planet.position);
        if (glow.userData.positionOffset) {
            glow.position.add(glow.userData.positionOffset);
        }
    });
}

function onResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    const compactScene = window.innerWidth <= 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactScene ? 1.45 : 2));
    renderer.toneMappingExposure = compactScene ? 1.02 : 1.12;

    if (scene?.fog) {
        scene.fog.density = compactScene ? 0.0048 : 0.0038;
    }

    applyPlanetLayout(compactScene);
}

function disposeMaterial(material, disposedTextures) {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => {
        if (!entry) return;

        Object.values(entry).forEach((value) => {
            if (value?.isTexture && !disposedTextures.has(value)) {
                disposedTextures.add(value);
                value.dispose();
            }
        });

        if (entry.uniforms) {
            Object.values(entry.uniforms).forEach((uniform) => {
                if (uniform?.value?.isTexture && !disposedTextures.has(uniform.value)) {
                    disposedTextures.add(uniform.value);
                    uniform.value.dispose();
                }
            });
        }

        entry.dispose();
    });
}

function disposeSceneResources(root) {
    const disposedTextures = new Set();

    root.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            disposeMaterial(child.material, disposedTextures);
        }
    });
}

export function stopSplashPlanet() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    window.removeEventListener('resize', onResize);

    if (scene) {
        disposeTrailPool(scene);
        disposeSceneResources(scene);
        scene.clear();
    }

    if (renderer) {
        renderer.dispose();
        if (renderer.domElement?.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }

    scene = null;
    camera = null;
    renderer = null;
    planet = null;
    clouds = null;
    cityLights = null;
    moon = null;
    atmosphere = null;
    innerGlow = null;
    coronaGlow = null;
    outerGlow = null;
    moonGlowInner = null;
    moonGlowOuter = null;
    moonRim = null;
    splashLights = null;
    satellites = [];
    starLayers = [];
    nebulaLayers = [];
    flareLayers = [];
    ships.length = 0;
    trailTexture = null;
    hullTexture = null;
    globalFade = 0;
}
