/* GPU-optimised galaxy visuals — InstancedMesh batching for stars & glow layers
 * Reduces ~400+ draw calls down to ~10 for the star system rendering.
 * Three.js r0.168.0 via ESM import maps. */
import * as THREE from "three";
import { textures } from "../core/assets.js";
import { gameState } from "../core/state.js";
import { disposeGroup } from "../core/dispose.js";
import { createTextSprite } from "../core/text_sprite.js";
import { isMobile as isMobileDevice } from "../core/device.js";

// Cache star canvas textures by color to avoid recreating them on every galaxy rebuild
const _starTextureCache = new Map();

// ── Public exports (API contract — do NOT rename / remove) ──────────────────
export let starMeshes = [];          // individual hit-spheres for raycasting
export let galaxyPlanetMeshes = [];  // individual planet meshes (not batched)
export let colonyRings = [];         // individual colony ring meshes
export let visibleStarMeshes = [];   // kept for compat — now references dummy array

// ── Module-level instanced state ────────────────────────────────────────────
let starGlows = [];       // kept for legacy ref; animation uses instanced data now
let starShaderMats = [];
let atmosphereGroup = null;

// Instanced batches
let starInstancedMesh = null;       // InstancedMesh for visible star spheres
let coronaInstancedMesh = null;     // InstancedMesh for corona shells
let outerHaloInstanced = null;      // InstancedMesh billboard — outer halo
let midGlowInstanced = null;        // InstancedMesh billboard — mid glow
let coreInstanced = null;           // InstancedMesh billboard — core
let hotCoreInstanced = null;        // InstancedMesh billboard — white-hot core

// Per-star animation data (parallel arrays, index = star index)
let _starCount = 0;
let _rotSpeeds = null;              // Float32Array
let _rotYs = null;                  // Float32Array — current Y rotation per star
let _coronaRotYs = null;
let _coronaRotZs = null;
let _positions = null;              // Float32Array(n*3) — star world positions
let _glowBaseScales = null;         // Float32Array
let _glowPulseOffsets = null;       // Float32Array

// Temp objects reused every frame to avoid GC
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

// ─────────────────────────────────────────────────────────────────────────────
// Billboard ShaderMaterial factory
// ─────────────────────────────────────────────────────────────────────────────
function createBillboardMaterial(map, opacity, useInstanceColor) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      opacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      attribute vec3 instanceColor;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vColor = ${useInstanceColor ? "instanceColor" : "vec3(1.0)"};

        // Extract instance position & scale from instanceMatrix
        // instanceMatrix columns: [scaleX * right, scaleY * up, scaleZ * forward, translation]
        vec3 instancePos = vec3(instanceMatrix[3]);
        float sx = length(vec3(instanceMatrix[0]));
        float sy = length(vec3(instanceMatrix[1]));

        // Billboard: replace model rotation with camera-facing orientation
        vec4 mvPos = viewMatrix * vec4(instancePos, 1.0);
        mvPos.xy += position.xy * vec2(sx, sy);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float opacity;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vec4 tex = texture2D(map, vUv);
        gl_FragColor = vec4(vColor * tex.rgb, tex.a * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// createGalaxyVisuals  (public API — signature unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function createGalaxyVisuals(systems, hyperlanes, group) {
  // Dispose old GPU resources (geometries, materials, textures) before rebuilding
  disposeGroup(group);
  starMeshes.length = 0;
  galaxyPlanetMeshes.length = 0;
  colonyRings.length = 0;
  visibleStarMeshes.length = 0;
  starGlows = [];
  starShaderMats = [];
  starInstancedMesh = null;
  coronaInstancedMesh = null;
  outerHaloInstanced = null;
  midGlowInstanced = null;
  coreInstanced = null;
  hotCoreInstanced = null;

  // 0. Atmosphere (Distant stars and Nebulae)
  createAtmosphere(group);

  // ── Hyperlanes ──────────────────────────────────────────────────────────────
  const hyperlaneMaterial = new THREE.LineBasicMaterial({
    color: 0x00c8e0,
    opacity: 0.35,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = [];
  (hyperlanes || []).forEach((lane) => {
    points.push(new THREE.Vector3().copy(lane.start));
    points.push(new THREE.Vector3().copy(lane.end));
  });

  const linesGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lines = new THREE.LineSegments(linesGeo, hyperlaneMaterial);
  group.add(lines);

  // Global ambient light
  const galaxyAmbientLight = new THREE.AmbientLight(0xffffff, 1.0);
  group.add(galaxyAmbientLight);

  const N = systems.length;
  _starCount = N;

  // ── Per-star animation arrays ───────────────────────────────────────────────
  _rotSpeeds = new Float32Array(N);
  _rotYs = new Float32Array(N);
  _coronaRotYs = new Float32Array(N);
  _coronaRotZs = new Float32Array(N);
  _positions = new Float32Array(N * 3);
  _glowBaseScales = new Float32Array(N);
  _glowPulseOffsets = new Float32Array(N);

  // Pre-compute per-star data
  const colors = new Float32Array(N * 3);
  const tmpColor = new THREE.Color();

  systems.forEach((sys, i) => {
    _positions[i * 3] = sys.position.x;
    _positions[i * 3 + 1] = sys.position.y;
    _positions[i * 3 + 2] = sys.position.z;

    tmpColor.set(sys.color);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;

    _rotSpeeds[i] = (Math.random() * 0.2 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
    _rotYs[i] = Math.random() * Math.PI;
    _coronaRotYs[i] = 0;
    _coronaRotZs[i] = 0;
    _glowBaseScales[i] = isMobileDevice ? 12 + Math.random() * 3 : 14 + Math.random() * 4;
    _glowPulseOffsets[i] = Math.random() * Math.PI * 2;
  });

  // ── A. Hit spheres (individual — required for raycasting) ─────────────────
  const hitGeo = new THREE.SphereGeometry(6, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  systems.forEach((sys, i) => {
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.copy(sys.position);
    hitMesh.userData = { id: sys.id, type: "star" };
    group.add(hitMesh);
    starMeshes.push(hitMesh);
  });

  // ── B. Instanced star spheres ─────────────────────────────────────────────
  const starSegs = isMobileDevice ? 24 : 32;
  const starGeo = new THREE.SphereGeometry(2.0, starSegs, starSegs);

  // Plasma shader for star surfaces — same look on mobile & desktop
  // Mobile uses 3 fbm iterations for perf, desktop uses 5
  const fbmIters = isMobileDevice ? 3 : 5;
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 instanceColor;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vSunColor;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vSunColor = instanceColor;
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vSunColor;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for(int i=0; i<${fbmIters}; i++) { v += a*noise(p); p *= 2.1; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 uv = vUv * 4.0;
        float n = fbm(uv + time * 0.18);
        float n2 = fbm(uv * 1.6 - time * 0.12 + 3.7);
        float plasma = n * 0.6 + n2 * 0.4;
        float limb = dot(vNormal, vec3(0.0, 0.0, 1.0));
        limb = pow(max(limb, 0.0), 0.4);
        vec3 hotColor  = min(vSunColor * 1.8 + 0.4, vec3(1.0));
        vec3 coolColor = vSunColor * 0.55;
        vec3 col = mix(coolColor, hotColor, plasma);
        col *= (0.7 + 0.3 * limb);
        float spot = step(0.72, fbm(uv * 2.5 + time * 0.05));
        col = mix(col, vSunColor * 0.25, spot * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.FrontSide,
  });
  starShaderMats.push(starMat);

  starInstancedMesh = new THREE.InstancedMesh(starGeo, starMat, N);
  // Set per-instance color
  const instanceColorAttr = new THREE.InstancedBufferAttribute(colors.slice(), 3);
  starInstancedMesh.geometry.setAttribute("instanceColor", instanceColorAttr);

  // Set initial matrices
  systems.forEach((sys, i) => {
    _euler.set(0, _rotYs[i], 0);
    _quat.setFromEuler(_euler);
    _mat4.compose(sys.position, _quat, _scale.set(1, 1, 1));
    starInstancedMesh.setMatrixAt(i, _mat4);
  });
  starInstancedMesh.instanceMatrix.needsUpdate = true;
  group.add(starInstancedMesh);

  // Shared PlaneGeometry for all billboard quads
  const billboardGeo = new THREE.PlaneGeometry(1, 1);

  // ── C. Instanced corona glow (soft sprite instead of hard shell) ──────────
  const coronaGlowMat = createBillboardMaterial(textures.glow, isMobileDevice ? 0.5 : 0.35, true);
  coronaInstancedMesh = new THREE.InstancedMesh(billboardGeo, coronaGlowMat, N);
  coronaInstancedMesh.geometry.setAttribute(
    "instanceColor",
    new THREE.InstancedBufferAttribute(colors.slice(), 3)
  );
  systems.forEach((sys, i) => {
    const s = isMobileDevice ? 7 : 6;
    _mat4.compose(sys.position, _quat.identity(), _scale.set(s, s, 1));
    coronaInstancedMesh.setMatrixAt(i, _mat4);
  });
  coronaInstancedMesh.instanceMatrix.needsUpdate = true;
  coronaInstancedMesh.frustumCulled = false;
  group.add(coronaInstancedMesh);

  // ── D. Instanced billboard glow layers ────────────────────────────────────
  // --- Outer halo layer ---
  const outerHaloMat = createBillboardMaterial(
    textures.glowSoft,
    isMobileDevice ? 0.45 : 0.28,
    true
  );
  outerHaloInstanced = new THREE.InstancedMesh(billboardGeo, outerHaloMat, N);
  outerHaloInstanced.geometry.setAttribute(
    "instanceColor",
    new THREE.InstancedBufferAttribute(colors.slice(), 3)
  );
  systems.forEach((sys, i) => {
    const s = _glowBaseScales[i];
    _mat4.compose(
      _pos.set(sys.position.x, sys.position.y, sys.position.z),
      _quat.identity(),
      _scale.set(s, s, 1)
    );
    outerHaloInstanced.setMatrixAt(i, _mat4);
  });
  outerHaloInstanced.instanceMatrix.needsUpdate = true;
  outerHaloInstanced.frustumCulled = false; // billboards are always visible
  group.add(outerHaloInstanced);

  // --- Mid glow layer ---
  const midGlowMat = createBillboardMaterial(textures.glow, isMobileDevice ? 0.55 : 0.22, true);
  midGlowInstanced = new THREE.InstancedMesh(billboardGeo, midGlowMat, N);
  midGlowInstanced.geometry.setAttribute(
    "instanceColor",
    new THREE.InstancedBufferAttribute(colors.slice(), 3)
  );
  systems.forEach((sys, i) => {
    const s = isMobileDevice ? 10 + Math.random() * 3 : 8 + Math.random() * 2;
    _mat4.compose(
      _pos.copy(sys.position),
      _quat.identity(),
      _scale.set(s, s, 1)
    );
    midGlowInstanced.setMatrixAt(i, _mat4);
  });
  midGlowInstanced.instanceMatrix.needsUpdate = true;
  midGlowInstanced.frustumCulled = false;
  group.add(midGlowInstanced);

  // --- Core layer ---
  const coreSize = isMobileDevice ? 5.0 : 3.5;
  const coreBillboardMat = createBillboardMaterial(textures.glow, isMobileDevice ? 0.8 : 0.55, true);
  coreInstanced = new THREE.InstancedMesh(billboardGeo, coreBillboardMat, N);
  coreInstanced.geometry.setAttribute(
    "instanceColor",
    new THREE.InstancedBufferAttribute(colors.slice(), 3)
  );
  systems.forEach((sys, i) => {
    _mat4.compose(
      _pos.copy(sys.position),
      _quat.identity(),
      _scale.set(coreSize, coreSize, 1)
    );
    coreInstanced.setMatrixAt(i, _mat4);
  });
  coreInstanced.instanceMatrix.needsUpdate = true;
  coreInstanced.frustumCulled = false;
  group.add(coreInstanced);

  // --- White-hot core layer (pure white, no instance color) ---
  const hotCoreSize = isMobileDevice ? 3.0 : 2.0;
  const hotCoreBillboardMat = createBillboardMaterial(textures.glow, isMobileDevice ? 0.75 : 0.5, false);
  hotCoreInstanced = new THREE.InstancedMesh(billboardGeo, hotCoreBillboardMat, N);
  // No instanceColor needed — shader uses vec3(1.0) for white
  systems.forEach((sys, i) => {
    _mat4.compose(
      _pos.copy(sys.position),
      _quat.identity(),
      _scale.set(hotCoreSize, hotCoreSize, 1)
    );
    hotCoreInstanced.setMatrixAt(i, _mat4);
  });
  hotCoreInstanced.instanceMatrix.needsUpdate = true;
  hotCoreInstanced.frustumCulled = false;
  group.add(hotCoreInstanced);

  // ── E. Colony rings, labels, planets (per-system, not batched) ───────────
  systems.forEach((sys, i) => {
    // Colony Indicator Ring (Holographic UI style)
    const colonizedPlanets = sys.planets.filter(
      (p) => gameState.colonies[p.id]
    );
    if (colonizedPlanets.length > 0) {
      const ringGeo = new THREE.RingGeometry(4.0, 4.2, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(sys.position);

      const innerRingGeo = new THREE.RingGeometry(3.4, 3.6, 64);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.copy(sys.position);

      group.add(ring);
      group.add(innerRing);
      colonyRings.push(ring);
      colonyRings.push(innerRing);
    }

    // System Name Label
    const label = createTextSprite(sys.name);
    label.position.copy(sys.position);
    label.position.y -= 5;
    group.add(label);

    // ── Planets ────────────────────────────────────────────────────────────
    sys.planets.forEach((p, pi) => {
      const hasColony = !!gameState.colonies[p.id];
      const orbitDist = 5 + pi * 1.8;
      const size = hasColony ? 1.2 : 0.8;

      let tex = textures.barren;
      let matColor = 0xffffff;
      let emissiveColor = 0x000000;
      let emissiveIntensity = 0.1;

      switch (p.type) {
        case "Terran":
          tex = textures.terran;
          emissiveColor = 0x112244;
          emissiveIntensity = 0.35;
          break;
        case "Continental":
          tex = textures.continental;
          emissiveColor = 0x112244;
          emissiveIntensity = 0.35;
          break;
        case "Ocean":
          tex = textures.ocean;
          emissiveColor = 0x112244;
          emissiveIntensity = 0.35;
          break;
        case "Gas Giant":
          tex = textures.gas;
          emissiveColor = 0x331100;
          emissiveIntensity = 0.5;
          break;
        case "Ice":
        case "Arctic":
          tex = textures.arctic;
          emissiveColor = 0x113344;
          emissiveIntensity = 0.25;
          break;
        case "Molten":
          tex = textures.molten;
          emissiveColor = 0x551100;
          emissiveIntensity = 0.7;
          break;
        case "Desert":
          tex = textures.desert;
          emissiveColor = 0x221100;
          emissiveIntensity = 0.2;
          break;
        case "Tomb":
          tex = textures.tomb;
          emissiveColor = 0x111111;
          emissiveIntensity = 0.1;
          break;
        default:
          tex = textures.barren;
          emissiveColor = 0x111111;
          emissiveIntensity = 0.15;
      }

      const pSegs = isMobileDevice ? 24 : 32;
      const pGeo = new THREE.SphereGeometry(size, pSegs, pSegs);
      const pMat = new THREE.MeshStandardMaterial({
        map: tex,
        color: matColor,
        emissive: new THREE.Color(emissiveColor),
        emissiveIntensity,
        roughness: p.type === "Ocean" || p.type === "Terran" ? 0.6 : 0.8,
        metalness: p.type === "Ocean" ? 0.5 : 0.2,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);

      // Atmosphere rim — all planet types get a glow
      {
        const atmoColors = {
          'Terran': 0x55aaff, 'Continental': 0x55aaff, 'Ocean': 0x4488ff,
          'Gas Giant': 0xffaa55, 'Molten': 0xff4400, 'Lava': 0xff4400,
          'Desert': 0xddaa44, 'Arid': 0xddaa44,
          'Ice': 0x88ccff, 'Arctic': 0x88ccff, 'Frozen': 0x88ccff,
          'Tomb': 0x44ff88, 'Toxic': 0x44ff44,
          'Barren': 0x887766, 'Rocky': 0x887766,
        };
        const atmoColor = atmoColors[p.type] || 0x887766;
        const hasThickAtmo = ['Terran','Continental','Ocean','Gas Giant'].includes(p.type);
        const atmoScale = hasThickAtmo ? 1.05 : 1.04;
        const atmoOpacity = hasThickAtmo
          ? (isMobileDevice ? 0.3 : 0.35)
          : (isMobileDevice ? 0.2 : 0.25);

        const atmoGeo = new THREE.SphereGeometry(size * atmoScale, 16, 16);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: atmoColor,
          transparent: true,
          opacity: atmoOpacity,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
        });
        pMesh.add(new THREE.Mesh(atmoGeo, atmoMat));

        // Outer soft glow sprite for all planets
        const glowSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: textures.glow,
            color: atmoColor,
            transparent: true,
            opacity: hasThickAtmo ? 0.45 : 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        glowSprite.scale.set(size * 5, size * 5, 1);
        pMesh.add(glowSprite);

        // Second softer halo layer for visible glow at distance
        const haloSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: textures.glowSoft || textures.glow,
            color: atmoColor,
            transparent: true,
            opacity: hasThickAtmo ? 0.25 : 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        haloSprite.scale.set(size * 8, size * 8, 1);
        pMesh.add(haloSprite);
      }

      // Colony aura
      if (hasColony) {
        if (isMobileDevice) {
          const auraSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.glow,
              color: 0x00f2ff,
              transparent: true,
              opacity: 0.5,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          );
          auraSprite.scale.set(size * 4, size * 4, 1);
          auraSprite.userData.isColonyAura = true;
          pMesh.add(auraSprite);
        } else {
          const auraGeo = new THREE.SphereGeometry(size * 1.3, 16, 16);
          const auraMat = new THREE.ShaderMaterial({
            uniforms: {
              color: { value: new THREE.Color(0x00f2ff) },
              time: { value: 0 },
            },
            vertexShader: `
              varying vec3 vNormal;
              varying vec3 vPositionNormal;
              void main() {
                vNormal = normalize(normalMatrix * normal);
                vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform vec3 color;
              uniform float time;
              varying vec3 vNormal;
              varying vec3 vPositionNormal;
              void main() {
                float intensity = pow(0.65 - dot(vNormal, vPositionNormal), 3.0);
                intensity *= 0.5 + 0.5 * sin(time * 2.0);
                gl_FragColor = vec4(color, intensity * 0.8);
              }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.FrontSide,
          });
          const aura = new THREE.Mesh(auraGeo, auraMat);
          aura.userData.isColonyAura = true;
          pMesh.add(aura);
        }
      }

      const angle = Math.random() * Math.PI * 2;
      pMesh.position.set(
        sys.position.x + Math.cos(angle) * orbitDist,
        sys.position.y,
        sys.position.z + Math.sin(angle) * orbitDist
      );
      pMesh.rotation.z = 0.4;
      pMesh.rotation.y = Math.random() * Math.PI;
      pMesh.userData = {
        center: sys.position,
        radius: orbitDist,
        angle: angle,
        speed:
          (0.15 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1),
        isPlanet: true,
      };

      group.add(pMesh);
      galaxyPlanetMeshes.push(pMesh);

      // Orbit Path
      const orbitGeo = new THREE.RingGeometry(
        orbitDist - 0.08,
        orbitDist + 0.08,
        isMobileDevice ? 32 : 64
      );
      const orbitMat = new THREE.MeshBasicMaterial({
        color: hasColony ? 0x00f2ff : 0x6699bb,
        opacity: hasColony ? 0.5 : 0.3,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const orbit = new THREE.Mesh(orbitGeo, orbitMat);
      orbit.rotation.x = Math.PI / 2;
      orbit.position.copy(sys.position);
      group.add(orbit);
    });
  });

  // Lights for planets
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  group.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(50, 100, 50);
  group.add(dirLight);
}

// ─────────────────────────────────────────────────────────────────────────────
// addColonyRingForSystem  (public API — signature unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function addColonyRingForSystem(systemId, group) {
  const sys = gameState.systems.find((s) => s.id === systemId);
  if (!sys) return;

  const ringGeo = new THREE.RingGeometry(4.0, 4.2, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f2ff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(sys.position);

  const innerRingGeo = new THREE.RingGeometry(3.4, 3.6, 64);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0x00f2ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.copy(sys.position);

  group.add(ring);
  group.add(innerRing);
  colonyRings.push(ring);
  colonyRings.push(innerRing);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateGalaxyAnimations  (public API — signature unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export function updateGalaxyAnimations(time, group) {
  if (group) group.rotation.y = time * 0.01;

  // ── Animate instanced star plasma shader (desktop) ──────────────────────
  if (starShaderMats.length > 0) {
    starShaderMats.forEach((mat) => {
      mat.uniforms.time.value = time;
    });
  }

  // ── Rotate star instances ───────────────────────────────────────────────
  if (starInstancedMesh && _starCount > 0) {
    for (let i = 0; i < _starCount; i++) {
      _rotYs[i] += _rotSpeeds[i] * 0.05;

      // Update star instance matrix
      _euler.set(0, _rotYs[i], 0);
      _quat.setFromEuler(_euler);
      _pos.set(
        _positions[i * 3],
        _positions[i * 3 + 1],
        _positions[i * 3 + 2]
      );
      _mat4.compose(_pos, _quat, _scale.set(1, 1, 1));
      starInstancedMesh.setMatrixAt(i, _mat4);

      // Update corona glow billboard (gentle pulse)
      const cs = (isMobileDevice ? 7 : 6) + Math.sin(time * 1.2 + _glowPulseOffsets[i]) * 0.4;
      _mat4.compose(_pos, _quat.identity(), _scale.set(cs, cs, 1));
      coronaInstancedMesh.setMatrixAt(i, _mat4);
    }
    starInstancedMesh.instanceMatrix.needsUpdate = true;
    coronaInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  // ── Pulse outer halo instances ──────────────────────────────────────────
  if (outerHaloInstanced && _starCount > 0) {
    const pulseAmplitude = isMobileDevice ? 1.2 : 1.5;
    for (let i = 0; i < _starCount; i++) {
      const s =
        _glowBaseScales[i] +
        Math.sin(time * 1.5 + _glowPulseOffsets[i]) * pulseAmplitude;
      _pos.set(
        _positions[i * 3],
        _positions[i * 3 + 1],
        _positions[i * 3 + 2]
      );
      _mat4.compose(_pos, _quat.identity(), _scale.set(s, s, 1));
      outerHaloInstanced.setMatrixAt(i, _mat4);
    }
    outerHaloInstanced.instanceMatrix.needsUpdate = true;
  }

  // ── Animate Atmosphere (Starfield twinkling and Nebula rotation) ────────
  if (atmosphereGroup) {
    atmosphereGroup.children.forEach((child, i) => {
      if (child.userData.isStarfield) {
        child.material.uniforms.time.value = time * 1.5;
      } else if (child.isSprite) {
        const rotSpeed = isMobileDevice ? 0.0005 : 0.001;
        const breathAmp = isMobileDevice ? 0.4 : 1.0;
        child.rotation.z += rotSpeed * (i % 2 === 0 ? 1 : -1);
        const s = child.scale.x + Math.sin(time + i) * breathAmp;
        child.scale.set(s, s, 1);
      }
    });
  }

  // ── Animate planets ─────────────────────────────────────────────────────
  galaxyPlanetMeshes.forEach((mesh) => {
    const data = mesh.userData;
    if (data.isPlanet) {
      data.angle += data.speed * 0.01;
      mesh.position.x = data.center.x + Math.cos(data.angle) * data.radius;
      mesh.position.z = data.center.z + Math.sin(data.angle) * data.radius;
      mesh.rotation.y += 0.02;

      mesh.children.forEach((child) => {
        if (child.userData.isColonyAura && child.material.uniforms) {
          child.material.uniforms.time.value = time;
        }
      });
    }
  });

  // ── Animate colony rings ────────────────────────────────────────────────
  colonyRings.forEach((ring, index) => {
    const offset = index % 2 === 0 ? 0 : Math.PI;
    ring.material.opacity = (Math.sin(time * 3 + offset) + 1) * 0.2 + 0.2;
    ring.rotation.z += index % 2 === 0 ? 0.01 : -0.015;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Atmosphere (background starfield + nebulae)  — unchanged logic
// ─────────────────────────────────────────────────────────────────────────────
function createAtmosphere(group) {
  atmosphereGroup = new THREE.Group();

  if (!isMobileDevice) {
    // ── 1. Deep background starfield (12000 distant points, multi-tint) ──
    const starCount = 12000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const offsets = new Float32Array(starCount);
    const colors = new Float32Array(starCount * 3);

    const starPalette = [
      new THREE.Color(0xd0e8ff),
      new THREE.Color(0xfff5e0),
      new THREE.Color(0xaaccff),
      new THREE.Color(0xffd0c0),
      new THREE.Color(0xffffff),
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 500 + Math.random() * 1800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.3 + Math.random() * 2.2;
      offsets[i] = Math.random() * Math.PI * 2;
      const c = starPalette[Math.floor(Math.random() * starPalette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    starGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute("offset", new THREE.BufferAttribute(offsets, 1));
    starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        precision highp float;
        attribute float size;
        attribute float offset;
        attribute vec3 color;
        varying float vOffset;
        varying vec3  vColor;
        void main() {
          vOffset = offset;
          vColor  = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position  = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float time;
        varying float vOffset;
        varying vec3  vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord);
          if (d > 0.5) discard;
          float alpha = (1.0 - d * 2.0) * (0.45 + 0.55 * sin(time * 1.2 + vOffset));
          gl_FragColor = vec4(vColor, alpha * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    starPoints.userData.isStarfield = true;
    atmosphereGroup.add(starPoints);

    // ── 2. Dense galactic-plane star band ────────────────────────────────
    const bandCount = 3000;
    const bPos = new Float32Array(bandCount * 3);
    const bSize = new Float32Array(bandCount);
    const bOff = new Float32Array(bandCount);

    for (let i = 0; i < bandCount; i++) {
      const r = 300 + Math.random() * 900;
      const theta = Math.random() * Math.PI * 2;
      bPos[i * 3] = Math.cos(theta) * r;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      bPos[i * 3 + 2] = Math.sin(theta) * r;
      bSize[i] = 0.2 + Math.random() * 1.2;
      bOff[i] = Math.random() * Math.PI * 2;
    }

    const bandGeo = new THREE.BufferGeometry();
    bandGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bandGeo.setAttribute("size", new THREE.BufferAttribute(bSize, 1));
    bandGeo.setAttribute("offset", new THREE.BufferAttribute(bOff, 1));

    const bandMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xaabbdd) },
      },
      vertexShader: `
        precision highp float;
        attribute float size;
        attribute float offset;
        varying float vOffset;
        void main() {
          vOffset = offset;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position  = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float time;
        uniform vec3  color;
        varying float vOffset;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord);
          if (d > 0.5) discard;
          float alpha = (1.0 - d * 2.0) * (0.3 + 0.4 * sin(time * 0.8 + vOffset));
          gl_FragColor = vec4(color, alpha * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const bandPoints = new THREE.Points(bandGeo, bandMat);
    bandPoints.userData.isStarfield = true;
    atmosphereGroup.add(bandPoints);
  }

  // ── Nebula sprites ──────────────────────────────────────────────────────
  const nebulaDefs = [
    { color: 0x1122cc, opMin: 0.07, opMax: 0.13, sMin: 300, sMax: 550 },
    { color: 0x4411aa, opMin: 0.06, opMax: 0.11, sMin: 280, sMax: 500 },
    { color: 0x881166, opMin: 0.05, opMax: 0.1, sMin: 250, sMax: 480 },
    { color: 0x0d3366, opMin: 0.08, opMax: 0.14, sMin: 350, sMax: 600 },
    { color: 0x220055, opMin: 0.07, opMax: 0.12, sMin: 300, sMax: 520 },
    { color: 0x003355, opMin: 0.06, opMax: 0.11, sMin: 260, sMax: 460 },
    { color: 0x551133, opMin: 0.05, opMax: 0.09, sMin: 200, sMax: 400 },
    { color: 0x002244, opMin: 0.09, opMax: 0.15, sMin: 400, sMax: 700 },
    { color: 0x330066, opMin: 0.06, opMax: 0.1, sMin: 280, sMax: 500 },
    { color: 0x004433, opMin: 0.05, opMax: 0.09, sMin: 220, sMax: 420 },
    { color: 0x441100, opMin: 0.04, opMax: 0.08, sMin: 200, sMax: 380 },
    { color: 0x110033, opMin: 0.1, opMax: 0.18, sMin: 500, sMax: 900 },
  ];

  const nebulaCount = isMobileDevice ? 2 : 3;

  nebulaDefs.forEach((def) => {
    for (let j = 0; j < nebulaCount; j++) {
      const nebMat = new THREE.SpriteMaterial({
        map: textures.glow,
        color: def.color,
        transparent: true,
        opacity: def.opMin + Math.random() * (def.opMax - def.opMin),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const neb = new THREE.Sprite(nebMat);
      const dist = 150 + Math.random() * 800;
      const angle = Math.random() * Math.PI * 2;
      neb.position.set(
        Math.cos(angle) * dist,
        (Math.random() - 0.5) * 250,
        Math.sin(angle) * dist
      );
      const s = def.sMin + Math.random() * (def.sMax - def.sMin);
      neb.scale.set(s, s, 1);
      atmosphereGroup.add(neb);
    }
  });

  // Bright accent nebulas
  const accentDefs = [
    { color: 0x2255ff, opacity: 0.12, size: 180 },
    { color: 0xaa22ff, opacity: 0.1, size: 160 },
    { color: 0xff2266, opacity: 0.08, size: 140 },
    { color: 0x00aaff, opacity: 0.11, size: 170 },
    { color: 0xff6600, opacity: 0.07, size: 130 },
    { color: 0x22ffcc, opacity: 0.09, size: 150 },
  ];

  accentDefs.forEach((def) => {
    const mat = new THREE.SpriteMaterial({
      map: textures.glow,
      color: def.color,
      transparent: true,
      opacity: def.opacity * (0.7 + Math.random() * 0.6),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    const dist = 80 + Math.random() * 350;
    const angle = Math.random() * Math.PI * 2;
    spr.position.set(
      Math.cos(angle) * dist,
      (Math.random() - 0.5) * 100,
      Math.sin(angle) * dist
    );
    const s = def.size * (0.8 + Math.random() * 0.6);
    spr.scale.set(s, s, 1);
    atmosphereGroup.add(spr);
  });

  group.add(atmosphereGroup);
}

// ─────────────────────────────────────────────────────────────────────────────
// createStarTexture  — kept for potential external use / fallback
// ─────────────────────────────────────────────────────────────────────────────
function createStarTexture(colorInt) {
  if (_starTextureCache.has(colorInt)) return _starTextureCache.get(colorInt);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const color = new THREE.Color(colorInt);

  ctx.fillStyle = "#" + color.getHexString();
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 30 + 10;
    const brightness = Math.random() > 0.5 ? 20 : -20;
    const alpha = Math.random() * 0.3;
    const adjusted = color.clone().offsetHSL(0, 0, brightness / 100);
    ctx.fillStyle = `rgba(${adjusted.r * 255}, ${adjusted.g * 255}, ${adjusted.b * 255}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 4 + 2;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 8 + 2;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  _starTextureCache.set(colorInt, tex);
  return tex;
}
