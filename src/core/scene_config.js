/* Updated: Added anti-aliasing toggle — recreates WebGL renderer on change, rebuilds composer and controls */
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Detect mobile once at module load
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

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
    renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isMobile ? 0.75 : 1.2;
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
    // On mobile: skip EffectComposer entirely — its internal HalfFloat render targets
    // are not reliably supported on mobile GPUs and produce white square tile artifacts.
    // The render loop in renderer.js falls through to renderer.render() when composer===null.
    if (isMobile) {
        composer = null;
    } else {
        composer = new EffectComposer(renderer);
        composer.setSize(window.innerWidth, window.innerHeight);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Desktop only: bloom post-processing
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,   // strength
            0.5,   // radius
            0.8    // threshold
        );
        composer.addPass(bloomPass);

        // OutputPass handles sRGB conversion (required in Three r152+)
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
        if (composer) composer.setSize(window.innerWidth, window.innerHeight);
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
    ultraSharp: false,  // supersampling + max anisotropy
    antialias: !isMobile // default on for desktop, off for mobile
};

export function getGraphicsConfig() { return { ...config }; }

export function updateGraphicsSetting(key, value) {
    config[key] = value;
    if (key === 'antialias') {
        recreateRenderer();
    }
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
    newRenderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    newRenderer.outputColorSpace = THREE.SRGBColorSpace;
    newRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    newRenderer.toneMappingExposure = isMobile ? 0.75 : 1.2;

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

    // Rebuild composer for bloom on desktop
    if (!isMobile) {
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
    if (prevAA !== config.antialias) recreateRenderer();
    applyGraphicsConfig();
    return config;
}

function applyGraphicsConfig() {
    // Bloom — only toggle on desktop; mobile has no composer at all
    if (!isMobile && composer) {
        composer.passes.forEach(pass => {
            if (pass instanceof UnrealBloomPass) pass.enabled = config.bloom;
        });
    }

    // Calculate Logical Size
    let width = window.innerWidth;
    let height = window.innerHeight;

    if (config.resolution !== 'native') {
        const targetH = parseInt(config.resolution);
        const aspect = width / height;
        height = targetH;
        width = Math.round(targetH * aspect);
    }

    // Set Canvas Size (Logical Resolution)
    // Third arg false prevents changing CSS size (keeps it 100% of window)
    renderer.setSize(width, height, false);

    // Set Render Scale (Pixel Ratio)
    let basePixelRatio = 1.0;
    if (config.resolution === 'native') {
        basePixelRatio = window.devicePixelRatio || 1.0;
    }

    // Ultra Sharp: supersample at 2x device pixel ratio
    const ultraMultiplier = config.ultraSharp ? 2.0 : 1.0;
    const maxRatio = isMobile ? 1.5 : 4.0; // cap mobile to prevent bloom tile artifacts
    const pixelRatio = Math.min(basePixelRatio * config.scale * ultraMultiplier, maxRatio);
    renderer.setPixelRatio(pixelRatio);

    // Ultra Sharp: max anisotropy on all textures
    if (renderer && config.ultraSharp) {
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

    // Update Composer size — composer is null on mobile, skip entirely
    if (!isMobile && composer) {
        composer.setSize(width, height);
        composer.passes.forEach(pass => {
            if (pass instanceof UnrealBloomPass) {
                pass.resolution.set(width, height);
            }
        });
    }

    // Shadows
    if (renderer) {
        if (config.shadows === 'off') {
            renderer.shadowMap.enabled = false;
        } else {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = config.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
        }
    }
    
    // Force material update for shadows
    if (scene) {
        scene.traverse(obj => {
            if (obj.material) obj.material.needsUpdate = true;
        });
    }
}