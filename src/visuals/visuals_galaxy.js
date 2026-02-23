/* Updated: Galaxy stars now use animated plasma shader matching single-system sun visuals */
import * as THREE from "three";
import { textures } from "../core/assets.js";
import { gameState } from "../core/state.js";

const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

export let starMeshes = [];
export let galaxyPlanetMeshes = [];
export let colonyRings = [];
export let visibleStarMeshes = [];
let starGlows = [];
let starShaderMats = [];
let atmosphereGroup = null;

export function createGalaxyVisuals(systems, hyperlanes, group) {
  // Clear old
  while (group.children.length > 0) group.remove(group.children[0]);
  starMeshes.length = 0;
  galaxyPlanetMeshes.length = 0;
  colonyRings.length = 0;
  visibleStarMeshes.length = 0;
  starGlows = [];
  starShaderMats = [];

  // 0. Atmosphere (Distant stars and Nebulae)
  createAtmosphere(group);

  // Hyperlanes — single straight line per connection, one material, no duplicates
  const hyperlaneMaterial = new THREE.LineBasicMaterial({
    color: 0x00c8e0,
    opacity: 0.35,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = [];
  (hyperlanes || []).forEach((lane) => {
    // Straight line only — start directly to end, no curve, no Y/Z offset
    points.push(new THREE.Vector3().copy(lane.start));
    points.push(new THREE.Vector3().copy(lane.end));
  });

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const lines = new THREE.LineSegments(geometry, hyperlaneMaterial);
  group.add(lines);

  // Global ambient light to ensure planets aren't pitch black on their dark side
  const galaxyAmbientLight = new THREE.AmbientLight(0xffffff, 1.0);
  group.add(galaxyAmbientLight);

  // Shared Materials for Stars
  // Outer halo uses the soft-halo texture (smooth gaussian ring, no hard edge)
  const glowMaterial = new THREE.SpriteMaterial({
    map: textures.glowSoft,
    transparent: true,
    opacity: isMobileDevice ? 0.16 : 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Mid glow uses the power-curve core texture
  const midGlowMaterial = new THREE.SpriteMaterial({
    map: textures.glow,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const coreMaterial = new THREE.SpriteMaterial({
    map: textures.glow,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  systems.forEach((sys) => {
    // --- Star Representation ---

    // 1. Hit Target (invisible sphere for raycasting)
    const hitGeo = new THREE.SphereGeometry(6, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.copy(sys.position);
    hitMesh.userData = { id: sys.id, type: "star" };
    group.add(hitMesh);
    starMeshes.push(hitMesh);

    // 2. Visible Star Sphere — animated plasma shader (desktop) or canvas texture (mobile)
    const starGeo = new THREE.SphereGeometry(2.0, isMobileDevice ? 16 : 32, isMobileDevice ? 16 : 32);
    let starMat;
    if (isMobileDevice) {
      const tex = createStarTexture(sys.color);
      starMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
    } else {
      const sc = new THREE.Color(sys.color);
      starMat = new THREE.ShaderMaterial({
        uniforms: {
          time:     { value: Math.random() * 100 },
          sunColor: { value: new THREE.Vector3(sc.r, sc.g, sc.b) },
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
            float limb = dot(vNormal, vec3(0.0, 0.0, 1.0));
            limb = pow(max(limb, 0.0), 0.4);
            vec3 hotColor  = min(sunColor * 1.8 + 0.4, vec3(1.0));
            vec3 coolColor = sunColor * 0.55;
            vec3 col = mix(coolColor, hotColor, plasma);
            col *= (0.7 + 0.3 * limb);
            float spot = step(0.72, fbm(uv * 2.5 + time * 0.05));
            col = mix(col, sunColor * 0.25, spot * 0.5);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        side: THREE.FrontSide,
      });
      starShaderMats.push(starMat);
    }
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.copy(sys.position);
    starMesh.rotation.y = Math.random() * Math.PI;
    starMesh.userData = {
      rotSpeed: (Math.random() * 0.2 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
    };
    group.add(starMesh);
    visibleStarMeshes.push(starMesh);

    // Corona / Atmosphere layer
    const coronaGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const coronaOpts = {
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    };
    if (isMobileDevice) {
      coronaOpts.map = createStarTexture(sys.color);
    } else {
      coronaOpts.color = sys.color;
    }
    const coronaMat = new THREE.MeshBasicMaterial(coronaOpts);
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.scale.set(-1.05, 1.05, 1.05);
    starMesh.add(coronaMesh);

    // 3. Outer halo (very large, soft gaussian ring — no hard edge)
    const outerHalo = new THREE.Sprite(glowMaterial.clone());
    outerHalo.material.color.setHex(sys.color);
    outerHalo.position.copy(sys.position);
    const baseGlowSize = isMobileDevice ? 9 + Math.random() * 2 : 14 + Math.random() * 4;
    outerHalo.scale.set(baseGlowSize, baseGlowSize, 1);
    outerHalo.userData = {
      baseScale: baseGlowSize,
      pulseOffset: Math.random() * Math.PI * 2,
    };
    group.add(outerHalo);
    starGlows.push(outerHalo);

    // 3b. Mid glow (medium, power-curve falloff)
    const midGlow = new THREE.Sprite(midGlowMaterial.clone());
    midGlow.material.color.setHex(sys.color);
    midGlow.position.copy(sys.position);
    const midGlowSize = 8 + Math.random() * 2;
    midGlow.scale.set(midGlowSize, midGlowSize, 1);
    group.add(midGlow);

    // 4. Core Sprite (Intense bright center)
    const core = new THREE.Sprite(coreMaterial.clone());
    core.material.color.setHex(sys.color);
    core.position.copy(sys.position);
    core.scale.set(3.5, 3.5, 1);
    group.add(core);

    // 4b. White-hot core center (pure white, tiny)
    const hotCoreMat = new THREE.SpriteMaterial({
      map: textures.glow,
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const hotCore = new THREE.Sprite(hotCoreMat);
    hotCore.position.copy(sys.position);
    hotCore.scale.set(2.0, 2.0, 1);
    group.add(hotCore);

    // 5. Colony Indicator Ring (Holographic UI style)
    const colonizedPlanets = sys.planets.filter(
      (p) => gameState.colonies[p.id],
    );
    if (colonizedPlanets.length > 0) {
      const ringGeo = new THREE.RingGeometry(4.0, 4.2, 64); // Reduced size
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

      // Add a subtle inner ring for the UI look
      const innerRingGeo = new THREE.RingGeometry(3.4, 3.6, 64); // Reduced size
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
      colonyRings.push(innerRing); // Animate both
    }

    // 6. System Name Label
    const label = createTextSprite(sys.name);
    label.position.copy(sys.position);
    label.position.y -= 5; // Adjusted position for smaller stars
    group.add(label);

    // --- Planet Representations ---
    sys.planets.forEach((p, i) => {
      const hasColony = !!gameState.colonies[p.id];
      // Keep orbit distance tight but distinct from star
      const orbitDist = 5 + i * 1.8;
      // Make planets slightly larger and more distinct
      const size = hasColony ? 1.2 : 0.8;

      // Texture Logic (Matches system view)
      let tex = textures.barren;
      let matColor = 0xffffff;
      let emissiveColor = 0x000000;
      let emissiveIntensity = 0.1; // Base glow for all planets to keep them visible

      switch (p.type) {
        case "Terran":
        case "Continental":
        case "Ocean":
          tex = textures.terran;
          matColor = 0xaaddff; // Light blue tint — lets green/brown terrain show through
          emissiveColor = 0x112244;
          emissiveIntensity = 0.35;
          break;
        case "Gas Giant":
          tex = textures.gas;
          matColor = 0xddbb88; // Softer orange — lets gas bands show through
          emissiveColor = 0x331100;
          emissiveIntensity = 0.5;
          break;
        case "Ice":
        case "Arctic":
          tex = textures.barren;
          matColor = 0xddeeff; // Very pale blue — lets crater detail show
          emissiveColor = 0x113344;
          emissiveIntensity = 0.25;
          break;
        case "Molten":
          tex = textures.barren;
          matColor = 0xbb4422; // Reduced red — lets barren texture craters/ridges show
          emissiveColor = 0x551100; // Lava glow
          emissiveIntensity = 0.7;
          break;
        case "Desert":
          tex = textures.barren;
          matColor = 0xddbb88; // Sandy tan — lets terrain show through
          emissiveColor = 0x221100;
          emissiveIntensity = 0.2;
          break;
        case "Tomb":
          tex = textures.barren;
          matColor = 0x999999; // Neutral grey — full texture visibility
          emissiveColor = 0x111111;
          emissiveIntensity = 0.1;
          break;
        default: // Barren, Asteroid
          tex = textures.barren;
          matColor = 0xcccccc; // Near-white — full texture visibility
          emissiveColor = 0x111111;
          emissiveIntensity = 0.15;
      }
      
      // Mobile: 16 segments vs 32 — 4x fewer triangles per planet, still looks smooth at galaxy zoom
      const pSegs = isMobileDevice ? 16 : 32;
      const pGeo = new THREE.SphereGeometry(size, pSegs, pSegs);

      const pMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({
            map: tex, color: matColor,
            emissive: new THREE.Color(emissiveColor), emissiveIntensity,
          })
        : new THREE.MeshStandardMaterial({
            map: tex, color: matColor,
            emissive: new THREE.Color(emissiveColor), emissiveIntensity,
            roughness: p.type === "Ocean" || p.type === "Terran" ? 0.6 : 0.8,
            metalness: p.type === "Ocean" ? 0.5 : 0.2,
          });
      const pMesh = new THREE.Mesh(pGeo, pMat);

      // Atmosphere rim — skip on mobile for additive blending cost
      if (!isMobileDevice && (p.type === "Terran" || p.type === "Continental" || p.type === "Ocean" || p.type === "Gas Giant")) {
        const atmoGeo = new THREE.SphereGeometry(size * 1.05, 16, 16);
        const atmoMat = new THREE.MeshBasicMaterial({
          color: p.type === "Gas Giant" ? 0xffaa55 : 0x55aaff,
          transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide
        });
        pMesh.add(new THREE.Mesh(atmoGeo, atmoMat));
      }

      // Colony aura — ShaderMaterial on desktop, cheap MeshBasicMaterial sprite on mobile
      if (hasColony) {
        if (isMobileDevice) {
          // Simple additive ring sprite — zero shader compilation cost
          const auraSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: textures.glow, color: 0x00f2ff,
            transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
          }));
          auraSprite.scale.set(size * 4, size * 4, 1);
          auraSprite.userData.isColonyAura = true;
          pMesh.add(auraSprite);
        } else {
          const auraGeo = new THREE.SphereGeometry(size * 1.3, 16, 16);
          const auraMat = new THREE.ShaderMaterial({
            uniforms: {
              color: { value: new THREE.Color(0x00f2ff) },
              time: { value: 0 }
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
            side: THREE.FrontSide
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
        sys.position.z + Math.sin(angle) * orbitDist,
      );

      // Rotation for visual flair
      pMesh.rotation.z = 0.4;
      pMesh.rotation.y = Math.random() * Math.PI;

      pMesh.userData = {
        center: sys.position,
        radius: orbitDist,
        angle: angle,
        speed: (0.15 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1), // Significantly slowed down from 0.8+0.5
        isPlanet: true,
      };

      group.add(pMesh);
      galaxyPlanetMeshes.push(pMesh);

      // Orbit Path — 32 segments on mobile vs 64 desktop
      const orbitGeo = new THREE.RingGeometry(
        orbitDist - 0.08,
        orbitDist + 0.08,
        isMobileDevice ? 32 : 64,
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

  // Add a subtle ambient light and directional light for the planets (since we changed them to Phong)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Increased from 0.15 for better base visibility
  group.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); // Increased from 0.4
  dirLight.position.set(50, 100, 50);
  group.add(dirLight);
}

export function updateGalaxyAnimations(time, group) {
  if (group) group.rotation.y = time * 0.01;

  // Animate star plasma shaders (desktop only)
  starShaderMats.forEach((mat) => {
    mat.uniforms.time.value = time;
  });

  // Rotate Stars
  visibleStarMeshes.forEach((mesh) => {
    mesh.rotation.y += mesh.userData.rotSpeed * 0.05;
    // Rotate corona opposite way
    if (mesh.children.length > 0) {
      mesh.children[0].rotation.y -= mesh.userData.rotSpeed * 0.1;
      mesh.children[0].rotation.z += 0.005;
    }
  });

  // Pulse outer halos — gentle breathing, small range relative to the larger base size
  starGlows.forEach((glow) => {
    const pulseAmplitude = isMobileDevice ? 0.55 : 1.5;
    const s =
      glow.userData.baseScale +
      Math.sin(time * 1.5 + glow.userData.pulseOffset) * pulseAmplitude;
    glow.scale.set(s, s, 1);
  });

  // Animate Atmosphere (Starfield twinkling and Nebula rotation)
  if (atmosphereGroup) {
    atmosphereGroup.children.forEach((child, i) => {
      if (child.userData.isStarfield) {
        child.material.uniforms.time.value = time * 1.5; // Faster twinkling
      } else if (child.isSprite && !isMobileDevice) {
        // Nebula
        child.rotation.z += 0.001 * (i % 2 === 0 ? 1 : -1); // Faster rotation
        const s = child.scale.x + Math.sin(time + i) * 1.0; // Noticeable breathing
        child.scale.set(s, s, 1);
      }
    });
  }

  galaxyPlanetMeshes.forEach((mesh) => {
    const data = mesh.userData;
    if (data.isPlanet) {
      data.angle += data.speed * 0.01;
      mesh.position.x = data.center.x + Math.cos(data.angle) * data.radius;
      mesh.position.z = data.center.z + Math.sin(data.angle) * data.radius;
      // Rotate planet on its axis
      mesh.rotation.y += 0.02;

      // Animate aura if present
      mesh.children.forEach(child => {
        if (child.userData.isColonyAura && child.material.uniforms) {
          child.material.uniforms.time.value = time;
        }
      });
    }
  });

  colonyRings.forEach((ring, index) => {
    // Alternate pulsing for inner/outer rings
    const offset = index % 2 === 0 ? 0 : Math.PI;
    ring.material.opacity = (Math.sin(time * 3 + offset) + 1) * 0.2 + 0.2;
    ring.rotation.z += index % 2 === 0 ? 0.01 : -0.015;
  });
}

function createAtmosphere(group) {
  atmosphereGroup = new THREE.Group();

  // ── 1. Deep background starfield (12000 distant points, multi-tint) ────────
  const starCount = 12000;
  const positions = new Float32Array(starCount * 3);
  const sizes     = new Float32Array(starCount);
  const offsets   = new Float32Array(starCount);
  const colors    = new Float32Array(starCount * 3);

  // Subtle star color palette: blue-white, warm white, cool blue, faint red
  const starPalette = [
    new THREE.Color(0xd0e8ff), // blue-white
    new THREE.Color(0xfff5e0), // warm white
    new THREE.Color(0xaaccff), // cool blue
    new THREE.Color(0xffd0c0), // faint red-orange
    new THREE.Color(0xffffff), // pure white
  ];

  for (let i = 0; i < starCount; i++) {
    const r     = 500 + Math.random() * 1800;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i]   = 0.3 + Math.random() * 2.2;
    offsets[i] = Math.random() * Math.PI * 2;
    const c = starPalette[Math.floor(Math.random() * starPalette.length)];
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute("offset",   new THREE.BufferAttribute(offsets, 1));
  starGeo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));

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
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.userData.isStarfield = true;
  atmosphereGroup.add(starPoints);

  // ── 2. Dense galactic-plane star band (extra stars near y=0) ───────────────
  const bandCount = 3000;
  const bPos  = new Float32Array(bandCount * 3);
  const bSize = new Float32Array(bandCount);
  const bOff  = new Float32Array(bandCount);

  for (let i = 0; i < bandCount; i++) {
    const r     = 300 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    bPos[i * 3]     = Math.cos(theta) * r;
    bPos[i * 3 + 1] = (Math.random() - 0.5) * 60; // flat band
    bPos[i * 3 + 2] = Math.sin(theta) * r;
    bSize[i] = 0.2 + Math.random() * 1.2;
    bOff[i]  = Math.random() * Math.PI * 2;
  }

  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  bandGeo.setAttribute("size",     new THREE.BufferAttribute(bSize, 1));
  bandGeo.setAttribute("offset",   new THREE.BufferAttribute(bOff, 1));

  const bandMat = new THREE.ShaderMaterial({
    uniforms: {
      time:  { value: 0 },
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
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const bandPoints = new THREE.Points(bandGeo, bandMat);
  bandPoints.userData.isStarfield = true;
  atmosphereGroup.add(bandPoints);

  // ── 3/4. Nebula sprites (desktop only) ──────────────────────────────────────
  // Large additive sprites are a known source of white/square artifacts on mobile GPUs.
  if (!isMobileDevice) {
    // ── 3. Nebula sprites — large background gas clouds ────────────────────────
    // Extended palette: blues, purples, magentas, teals, warm oranges
    const nebulaDefs = [
      // [ color,      minOpacity, maxOpacity, minSize, maxSize ]
      { color: 0x1122cc, opMin: 0.07, opMax: 0.13, sMin: 300, sMax: 550 },
      { color: 0x4411aa, opMin: 0.06, opMax: 0.11, sMin: 280, sMax: 500 },
      { color: 0x881166, opMin: 0.05, opMax: 0.10, sMin: 250, sMax: 480 },
      { color: 0x0d3366, opMin: 0.08, opMax: 0.14, sMin: 350, sMax: 600 },
      { color: 0x220055, opMin: 0.07, opMax: 0.12, sMin: 300, sMax: 520 },
      { color: 0x003355, opMin: 0.06, opMax: 0.11, sMin: 260, sMax: 460 },
      { color: 0x551133, opMin: 0.05, opMax: 0.09, sMin: 200, sMax: 400 },
      { color: 0x002244, opMin: 0.09, opMax: 0.15, sMin: 400, sMax: 700 },
      { color: 0x330066, opMin: 0.06, opMax: 0.10, sMin: 280, sMax: 500 },
      { color: 0x004433, opMin: 0.05, opMax: 0.09, sMin: 220, sMax: 420 }, // teal
      { color: 0x441100, opMin: 0.04, opMax: 0.08, sMin: 200, sMax: 380 }, // warm dark orange
      { color: 0x110033, opMin: 0.10, opMax: 0.18, sMin: 500, sMax: 900 }, // very large deep purple
    ];

    // Spawn 3 sprites per definition = 36 nebula sprites total
    nebulaDefs.forEach(def => {
      for (let j = 0; j < 3; j++) {
        const nebMat = new THREE.SpriteMaterial({
          map:         textures.glow,
          color:       def.color,
          transparent: true,
          opacity:     def.opMin + Math.random() * (def.opMax - def.opMin),
          blending:    THREE.AdditiveBlending,
          depthWrite:  false,
        });
        const neb  = new THREE.Sprite(nebMat);
        const dist  = 150 + Math.random() * 800;
        const angle = Math.random() * Math.PI * 2;
        neb.position.set(
          Math.cos(angle) * dist,
          (Math.random() - 0.5) * 250,
          Math.sin(angle) * dist,
        );
        const s = def.sMin + Math.random() * (def.sMax - def.sMin);
        neb.scale.set(s, s, 1);
        atmosphereGroup.add(neb);
      }
    });

    // ── 4. Bright accent nebulas — tighter, more vivid, near galaxy center ─────
    const accentDefs = [
      { color: 0x2255ff, opacity: 0.12, size: 180 },
      { color: 0xaa22ff, opacity: 0.10, size: 160 },
      { color: 0xff2266, opacity: 0.08, size: 140 },
      { color: 0x00aaff, opacity: 0.11, size: 170 },
      { color: 0xff6600, opacity: 0.07, size: 130 },
      { color: 0x22ffcc, opacity: 0.09, size: 150 },
    ];

    accentDefs.forEach(def => {
      const mat = new THREE.SpriteMaterial({
        map:         textures.glow,
        color:       def.color,
        transparent: true,
        opacity:     def.opacity * (0.7 + Math.random() * 0.6),
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
      });
      const spr   = new THREE.Sprite(mat);
      const dist  = 80 + Math.random() * 350;
      const angle = Math.random() * Math.PI * 2;
      spr.position.set(
        Math.cos(angle) * dist,
        (Math.random() - 0.5) * 100,
        Math.sin(angle) * dist,
      );
      const s = def.size * (0.8 + Math.random() * 0.6);
      spr.scale.set(s, s, 1);
      atmosphereGroup.add(spr);
    });
  }

  group.add(atmosphereGroup);
}

function createStarTexture(colorInt) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const color = new THREE.Color(colorInt);

  // Fill Background with base color
  ctx.fillStyle = "#" + color.getHexString();
  ctx.fillRect(0, 0, size, size);

  // Turbulence / Noise
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 30 + 10;

    // Varying opacity and brightness for "plasma" look
    const brightness = Math.random() > 0.5 ? 20 : -20;
    const alpha = Math.random() * 0.3;

    const adjusted = color.clone().offsetHSL(0, 0, brightness / 100);
    ctx.fillStyle = `rgba(${adjusted.r * 255}, ${adjusted.g * 255}, ${adjusted.b * 255}, ${alpha})`;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunspots (darker, smaller)
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 4 + 2;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flares (brighter, small)
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
  return tex;
}

function createTextSprite(text) {
  const PIXEL_SCALE = 2;
  const fontSize = 17;
  const font = `600 ${fontSize * PIXEL_SCALE}px "Rajdhani", sans-serif`;

  // Measure on a temp canvas first
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = font;
  const metrics = measure.measureText(text);

  // Minimal padding — single thin glow only
  const GLOW_PAD = 5 * PIXEL_SCALE;
  const w = Math.ceil(metrics.width) + GLOW_PAD * 2;
  const h = (fontSize + 8) * PIXEL_SCALE + GLOW_PAD * 2;
  const cx = w / 2;
  const cy = h / 2;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  ctx.lineJoin = "round";
  ctx.lineCap  = "round";

  // Single very subtle outer halo — much thinner and more transparent
  ctx.lineWidth   = 3 * PIXEL_SCALE;
  ctx.strokeStyle = "rgba(0, 242, 255, 0.10)";
  ctx.strokeText(text, cx, cy);

  // Thin dark outline for readability
  ctx.lineWidth   = 1.2 * PIXEL_SCALE;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
  ctx.strokeText(text, cx, cy);

  // Pure white fill for maximum readability
  ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
  ctx.fillText(text, cx, cy);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set((w * 0.05) / PIXEL_SCALE, (h * 0.05) / PIXEL_SCALE, 1);
  return sprite;
}
