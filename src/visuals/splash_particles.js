/* GPU-optimized trail particle system using a pooled THREE.Points object.
 * Replaces per-sprite creation/destruction with a fixed-size buffer pool
 * to eliminate GC pressure and GPU resource churn. */
import * as THREE from 'three';
import { isMobile } from '../core/device.js';

const MAX_PARTICLES = isMobile ? 100 : 200;
const MOBILE_ACTIVE_CAP = 80;

// Pool state
let poolGeometry = null;
let poolMesh = null;
let positions = null;
let opacities = null;
let sizes = null;

// Per-slot metadata (CPU side)
const poolSlots = new Array(MAX_PARTICLES);
for (let i = 0; i < MAX_PARTICLES; i++) {
    poolSlots[i] = { active: false, life: 0, maxLife: 0, baseScale: 0, slotIndex: i };
}

let activeCount = 0;
let initialized = false;

// Backward-compatible export: mirrors active pool entries so external code
// that reads trailParticles.length or iterates still works.
// Each entry has a stub `sprite` with `material.dispose()` as a no-op
// so the cleanup path in splash_renderer.js doesn't throw.
export const trailParticles = [];

const stubDispose = () => {};

function rebuildCompatArray() {
    trailParticles.length = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
        if (poolSlots[i].active) {
            trailParticles.push({
                sprite: {
                    material: { dispose: stubDispose },
                    position: {
                        x: positions[i * 3],
                        y: positions[i * 3 + 1],
                        z: positions[i * 3 + 2]
                    }
                },
                life: poolSlots[i].life,
                maxLife: poolSlots[i].maxLife,
                baseScale: poolSlots[i].baseScale
            });
        }
    }
}

function initTrailPool(scene, trailTexture) {
    positions = new Float32Array(MAX_PARTICLES * 3);
    opacities = new Float32Array(MAX_PARTICLES);
    sizes = new Float32Array(MAX_PARTICLES);

    poolGeometry = new THREE.BufferGeometry();
    poolGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    poolGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    poolGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: trailTexture },
            color: { value: new THREE.Color(0x00ccff) }
        },
        vertexShader: /* glsl */ `
            attribute float aOpacity;
            attribute float aSize;
            varying float vOpacity;
            void main() {
                vOpacity = aOpacity;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * (300.0 / -mvPosition.z);
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

    poolMesh = new THREE.Points(poolGeometry, mat);
    poolMesh.frustumCulled = false;
    scene.add(poolMesh);

    initialized = true;
}

export function spawnTrailParticle(scene, position, trailTexture) {
    if (!initialized) {
        initTrailPool(scene, trailTexture);
    }

    if (isMobile && activeCount >= MOBILE_ACTIVE_CAP) return;

    // Find a free slot
    let slot = null;
    for (let i = 0; i < MAX_PARTICLES; i++) {
        if (!poolSlots[i].active) {
            slot = poolSlots[i];
            break;
        }
    }
    if (!slot) return; // pool exhausted

    const idx = slot.slotIndex;
    const baseScale = (isMobile ? 0.6 : 0.8) + Math.random() * 0.4;
    const life = 0.6 + Math.random() * 0.4;

    slot.active = true;
    slot.life = life;
    slot.maxLife = 1.0;
    slot.baseScale = baseScale;

    positions[idx * 3]     = position.x;
    positions[idx * 3 + 1] = position.y;
    positions[idx * 3 + 2] = position.z;

    const lifeRatio = life / slot.maxLife;
    opacities[idx] = lifeRatio * 0.6;
    sizes[idx] = baseScale * (0.5 + lifeRatio * 0.5);

    activeCount++;

    // Mark buffers dirty
    poolGeometry.attributes.position.needsUpdate = true;
    poolGeometry.attributes.aOpacity.needsUpdate = true;
    poolGeometry.attributes.aSize.needsUpdate = true;
}

export function updateTrailParticles(scene, dt) {
    if (!initialized) return;

    let dirty = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
        const slot = poolSlots[i];
        if (!slot.active) continue;

        slot.life -= dt;

        // Drift left, matching original behavior
        positions[i * 3] -= 0.5 * dt;

        if (slot.life <= 0) {
            // Kill particle: zero out size so the vertex is invisible
            slot.active = false;
            sizes[i] = 0;
            opacities[i] = 0;
            activeCount--;
        } else {
            const lifeRatio = slot.life / slot.maxLife;
            opacities[i] = lifeRatio * 0.6;
            sizes[i] = slot.baseScale * (0.5 + lifeRatio * 0.5);
        }

        dirty = true;
    }

    if (dirty) {
        poolGeometry.attributes.position.needsUpdate = true;
        poolGeometry.attributes.aOpacity.needsUpdate = true;
        poolGeometry.attributes.aSize.needsUpdate = true;
    }

    // Keep compat array in sync
    rebuildCompatArray();
}

// Called externally (splash_renderer cleanup) via trailParticles.length = 0
// but we also expose a dedicated cleanup so the pool mesh can be removed.
export function disposeTrailPool(scene) {
    if (!initialized) return;
    if (poolMesh) {
        scene.remove(poolMesh);
        poolMesh.material.dispose();
        poolGeometry.dispose();
        poolMesh = null;
        poolGeometry = null;
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
        poolSlots[i].active = false;
    }
    activeCount = 0;
    trailParticles.length = 0;
    initialized = false;
}
