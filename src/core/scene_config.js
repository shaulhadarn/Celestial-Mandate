/* Updated: Improved rendering quality — use full devicePixelRatio on desktop, LineLoop orbits, recreateRenderer defers pixel ratio to applyGraphicsConfig */
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { isMobile } from './device.js';

// Global references for legacy compatibility
export let scene = null;
export let camera = null;
export let renderer = null;
export let controls = null;
export let composer = null;

// Scene graph roots
export const groups = {
    galaxy: new THREE.Group(),
    system: new THREE.Group(),
    planet: new THREE.Group()
};

export function initRenderer() {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) return;

    // Clear any existing canvas
    canvasContainer.innerHTML = '';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060c); // Dark space background

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 80, 150);

    renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,          // antialias is expensive on mobile GPU
        powerPreference: 'high-performance',
        precision: 'highp',            // force highp to prevent mediump tile artifacts
        logarithmicDepthBuffer: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Mobile: cap at 1.5x to avoid oversized framebuffers that cause bloom tile artifacts
    // Desktop: use full device pixel ratio for crisp edges
    renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isMobile ? 1.0 : 1.2;
    canvasContainer.appendChild(renderer.domElement);

    // Dynamic import for OrbitControls to avoid bundling issues if not present globally
    import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 1000;
        controls.minDistance = 10;
    }).catch(e => console.warn('Could not load OrbitControls', e));

    // Post-Processing Setup
    // Mobile: use UnsignedByteType render targets at half resolution to avoid
    // white tile artifacts caused by HalfFloat on mobile GPUs.
    // Desktop: use HalfFloat for full-quality HDR bloom.
    if (isMobile) {
        const mobileRtParams = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
        };
        const mobileRT = new THREE.WebGLRenderTarget(
            Math.floor(window.innerWidth / 2),
            Math.floor(window.innerHeight / 2),
            mobileRtParams
        );
        composer = new EffectComposer(renderer, mobileRT);
        composer.setSize(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
            0.75,  // strength (boosted to show planet glow on mobile)
            0.45,  // radius (wider spread for visible halos)
            0.75   // threshold (slightly lower to catch glow sprites)
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);
    } else {
        composer = new EffectComposer(renderer);
        composer.setSize(window.innerWidth, window.innerHeight);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,   // strength
            0.5,   // radius
            0.8    // threshold
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);
    }

    scene.add(groups.galaxy);
    scene.add(groups.system);
    scene.add(groups.planet);

    window.addEventListener('resize', () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
            const cw = isMobile ? Math.floor(window.innerWidth / 2) : window.innerWidth;
            const ch = isMobile ? Math.floor(window.innerHeight / 2) : window.innerHeight;
            composer.setSize(cw, ch);
        }
    });
}

// Hooks for R3F to inject state
export function setGlobalScene(s) { scene = s; }
export function setGlobalCamera(c) { camera = c; }
export function setGlobalRenderer(r) { renderer = r; }
export function setGlobalControls(c) { controls = c; }
export function setGlobalComposer(c) { composer = c; }

// Graphics Configuration
const config = {
    bloom: true,
    shadows: 'high',
    scale: 1.0,
    resolution: 'native',
    ultraSharp: true,   // supersampling + max anisotropy (ultra sharp default)
    antialias: true
};

export function getGraphicsConfig() { return { ...config }; }

export function updateGraphicsSetting(key, value) {
    config[key] = value;
    // antialias is baked into the WebGL context — can't change without recreating canvas.
    // R3F owns the canvas, so skip recreateRenderer() to avoid destroying it.
    applyGraphicsConfig();
}

function recreateRenderer() {
    if (!renderer) return;
    const container = renderer.domElement.parentElement;
    const oldCanvas = renderer.domElement;

    // Create new renderer with updated antialias
    const newRenderer = new THREE.WebGLRenderer({
        antialias: config.antialias,
        powerPreference: 'high-performance',
        precision: 'highp',
        logarithmicDepthBuffer: false,
    });
    newRenderer.setSize(window.innerWidth, window.innerHeight);
    newRenderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio);
    newRenderer.outputColorSpace = THREE.SRGBColorSpace;
    newRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    newRenderer.toneMappingExposure = isMobile ? 1.0 : 1.2;

    // Swap canvas
    container.replaceChild(newRenderer.domElement, oldCanvas);
    renderer.dispose();
    renderer = newRenderer;

    // Reconnect OrbitControls to new canvas
    if (controls) {
        controls.dispose();
        import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
            const newControls = new OrbitControls(camera, renderer.domElement);
            newControls.enableDamping = controls.enableDamping;
            newControls.dampingFactor = controls.dampingFactor;
            newControls.maxDistance = controls.maxDistance;
            newControls.minDistance = controls.minDistance;
            newControls.enablePan = controls.enablePan;
            newControls.rotateSpeed = controls.rotateSpeed;
            newControls.panSpeed = controls.panSpeed;
            newControls.zoomSpeed = controls.zoomSpeed;
            newControls.target.copy(controls.target);
            controls = newControls;
        });
    }

    // Rebuild composer for bloom
    if (isMobile) {
        const mobileRtParams = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType
        };
        const mobileRT = new THREE.WebGLRenderTarget(
            Math.floor(window.innerWidth / 2),
            Math.floor(window.innerHeight / 2),
            mobileRtParams
        );
        composer = new EffectComposer(renderer, mobileRT);
        composer.setSize(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2));
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)),
            0.5, 0.3, 0.8
        );
        bloomPass.enabled = config.bloom;
        composer.addPass(bloomPass);
        const outputPass = new OutputPass();
        composer.addPass(outputPass);
    } else {
        composer = new EffectComposer(renderer);
        composer.setSize(window.innerWidth, window.innerHeight);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8, 0.5, 0.8
        );
        bloomPass.enabled = config.bloom;
        composer.addPass(bloomPass);
        const outputPass = new OutputPass();
        composer.addPass(outputPass);
    }
}

export function setGraphicsPreset(level) {
    const prevAA = config.antialias;
    if (level === 'ultra') {
        config.bloom = true;
        config.shadows = 'high';
        config.scale = 1.0;
        config.resolution = 'native';
        config.ultraSharp = true;
        config.antialias = true;
    } else if (level === 'high') {
        config.bloom = true;
        config.shadows = 'high';
        config.scale = 1.0;
        config.resolution = 'native';
        config.ultraSharp = false;
        config.antialias = true;
    } else {
        config.bloom = false;
        config.shadows = 'off';
        config.scale = 0.75;
        config.resolution = 'native';
        config.ultraSharp = false;
        config.antialias = false;
    }
    // Note: antialias is baked into the WebGL context at creation time.
    // R3F manages the canvas — calling recreateRenderer() would destroy it.
    // Skip recreateRenderer(); applyGraphicsConfig handles pixel ratio, shadows, etc.
    applyGraphicsConfig();
    return config;
}

export function applyGraphicsConfig() {
    // Guard: wait for R3F to provide globals before applying
    if (!renderer) return;

    // Bloom — toggle on both desktop and mobile
    if (composer) {
        composer.passes.forEach(pass => {
            if (pass instanceof UnrealBloomPass) pass.enabled = config.bloom;
        });
    }

    // Calculate Logical Size — read from renderer (R3F manages canvas size)
    const currentSize = new THREE.Vector2();
    renderer.getSize(currentSize);
    let width = currentSize.x || window.innerWidth;
    let height = currentSize.y || window.innerHeight;

    if (config.resolution !== 'native') {
        const targetH = parseInt(config.resolution);
        const aspect = width / height;
        height = targetH;
        width = Math.round(targetH * aspect);
        // Only override size for non-native resolutions
        renderer.setSize(width, height, false);
    }

    // Set Render Scale (Pixel Ratio)
    let basePixelRatio = 1.0;
    if (config.resolution === 'native') {
        basePixelRatio = window.devicePixelRatio || 1.0;
    }

    // Ultra Sharp: supersample at 2x device pixel ratio
    const ultraMultiplier = config.ultraSharp ? 2.0 : 1.0;
    const maxRatio = isMobile ? (config.ultraSharp ? 2.5 : 1.5) : 4.0;
    const pixelRatio = Math.min(basePixelRatio * config.scale * ultraMultiplier, maxRatio);
    renderer.setPixelRatio(pixelRatio);

    // Ultra Sharp: max anisotropy on all textures
    if (config.ultraSharp) {
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        if (scene) {
            scene.traverse(obj => {
                if (obj.material?.map) {
                    obj.material.map.anisotropy = maxAniso;
                    obj.material.map.needsUpdate = true;
                }
            });
        }
    }

    // Update Composer size + pixel ratio
    if (composer) {
        const compWidth = isMobile ? Math.floor(width / 2) : width;
        const compHeight = isMobile ? Math.floor(height / 2) : height;
        composer.setPixelRatio(pixelRatio);
        composer.setSize(compWidth, compHeight);
        composer.passes.forEach(pass => {
            if (pass instanceof UnrealBloomPass) {
                pass.resolution.set(compWidth, compHeight);
            }
        });
    }

    // Shadows
    if (config.shadows === 'off') {
        renderer.shadowMap.enabled = false;
    } else {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = config.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    }

    // Force material update for shadows
    if (scene) {
        scene.traverse(obj => {
            if (obj.material) obj.material.needsUpdate = true;
        });
    }
}