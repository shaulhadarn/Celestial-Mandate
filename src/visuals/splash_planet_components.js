/* Updated: Premium splash planet shading with city lights, richer clouds, and cinematic atmosphere */
import * as THREE from 'three';
import {
    createProceduralPlanetTexture,
    createProceduralCloudTexture,
    createProceduralCityLightsTexture
} from '../core/splash_assets.js';

/**
 * Constructs the core planetary body, cloud layer, atmosphere shader, and glow sprites.
 */
export function createSplashPlanetGroup(scene, renderer, haloTextures, isMobile) {
    const segments = isMobile ? 40 : 72;
    const { softGlowTex, glowTex } = haloTextures;

    const planetTex = createProceduralPlanetTexture();
    planetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    planetTex.colorSpace = THREE.SRGBColorSpace;

    const cloudTex = createProceduralCloudTexture();
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.wrapT = THREE.ClampToEdgeWrapping;
    cloudTex.minFilter = THREE.LinearFilter;
    cloudTex.magFilter = THREE.LinearFilter;
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    const cityLightsTex = createProceduralCityLightsTexture();
    cityLightsTex.wrapS = THREE.RepeatWrapping;
    cityLightsTex.wrapT = THREE.ClampToEdgeWrapping;
    cityLightsTex.minFilter = THREE.LinearFilter;
    cityLightsTex.magFilter = THREE.LinearFilter;
    cityLightsTex.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(5, segments, segments);
    const material = new THREE.MeshPhysicalMaterial({
        map: planetTex,
        roughness: 0.72,
        metalness: 0.04,
        clearcoat: 0.28,
        clearcoatRoughness: 0.78,
        emissive: new THREE.Color(0x03121e),
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0
    });
    const planet = new THREE.Mesh(geometry, material);
    scene.add(planet);

    const cloudGeo = new THREE.SphereGeometry(5.08, segments, segments);
    const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 0.98,
        metalness: 0.0,
        color: 0xe4f5ff
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    planet.add(clouds);

    const cityLights = new THREE.Mesh(
        new THREE.SphereGeometry(5.025, segments, segments),
        new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: 0.0 },
                uTime: { value: 0.0 },
                uLightDirection: { value: new THREE.Vector3(0.8, 0.3, 0.55).normalize() },
                uLightsMap: { value: cityLightsTex },
                uWarmColor: { value: new THREE.Color(0xffc87a) },
                uCoolColor: { value: new THREE.Color(0x74d7ff) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorldNormal;
                varying vec3 vViewDir;
                void main() {
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    vViewDir = normalize(cameraPosition - worldPosition.xyz);
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform float uOpacity;
                uniform float uTime;
                uniform vec3 uLightDirection;
                uniform vec3 uWarmColor;
                uniform vec3 uCoolColor;
                uniform sampler2D uLightsMap;
                varying vec2 vUv;
                varying vec3 vWorldNormal;
                varying vec3 vViewDir;
                void main() {
                    vec3 lightDir = normalize(uLightDirection);
                    vec4 lightSample = texture2D(uLightsMap, vUv);
                    float luminance = dot(lightSample.rgb, vec3(0.299, 0.587, 0.114));
                    float nightMask = pow(max(dot(normalize(vWorldNormal), -lightDir), 0.0), 1.85);
                    float rim = pow(1.0 - max(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0), 2.5);
                    float shimmer = 0.84 + 0.16 * sin(uTime * 1.7 + vUv.x * 45.0 + vUv.y * 30.0);
                    vec3 mappedColor = mix(uWarmColor, uCoolColor, clamp(lightSample.b * 1.2, 0.0, 1.0));
                    vec3 finalColor = mix(mappedColor, lightSample.rgb, 0.55);
                    float alpha = max(lightSample.a, luminance) * nightMask * shimmer * (0.58 + rim * 0.65) * uOpacity;
                    if (alpha < 0.01) discard;
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    planet.add(cityLights);

    const atmoGeo = new THREE.SphereGeometry(5.42, segments, segments);
    const atmoMat = new THREE.ShaderMaterial({
        uniforms: {
            uOpacity: { value: 0.0 },
            uTime: { value: 0.0 },
            uLightDirection: { value: new THREE.Vector3(0.8, 0.3, 0.55).normalize() },
            colorDay: { value: new THREE.Color(0x2aa8ff) },
            colorTwilight: { value: new THREE.Color(0xff8d59) },
            colorNight: { value: new THREE.Color(0x00e1ff) }
        },
        vertexShader: `
            varying vec3 vWorldNormal;
            varying vec3 vViewDir;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                vViewDir = normalize(cameraPosition - worldPosition.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float uOpacity;
            uniform float uTime;
            uniform vec3 uLightDirection;
            uniform vec3 colorDay;
            uniform vec3 colorTwilight;
            uniform vec3 colorNight;
            varying vec3 vWorldNormal;
            varying vec3 vViewDir;
                void main() {
                    vec3 normal = normalize(vWorldNormal);
                    vec3 viewDir = normalize(vViewDir);
                    vec3 lightDir = normalize(uLightDirection);
                    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.05);
                    float sunFacing = max(dot(normal, lightDir), 0.0);
                    float twilight = smoothstep(0.0, 0.22, sunFacing) * (1.0 - smoothstep(0.22, 0.6, sunFacing));
                    float nightRim = pow(max(dot(normal, -lightDir), 0.0), 1.6) * fresnel;
                    float pulse = 0.94 + 0.06 * sin(uTime * 0.45);
                    vec3 finalColor = mix(colorNight, colorTwilight, twilight);
                    finalColor = mix(finalColor, colorDay, pow(sunFacing, 0.45));
                    float alpha = (fresnel * (0.14 + sunFacing * 0.56 + twilight * 0.74) + nightRim * 0.05) * uOpacity * pulse;
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);

    // ── Layered glow system — soft uniform halo matching in-game planet glows ──
    // All layers centered on the planet (no z-offset) so glow wraps evenly.
    // Uses softGlowTex for smooth radial falloff without angular artifacts.
    const glowTexture = softGlowTex || glowTex;

    // Layer 1: Tight bright core halo — cyan-white, hugs the planet
    const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x55eeff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    }));
    innerGlow.scale.set(14, 14, 1);
    innerGlow.userData.baseScale = new THREE.Vector2(14, 14);
    innerGlow.userData.targetOpacity = 0.45;
    innerGlow.userData.positionOffset = null;
    scene.add(innerGlow);

    // Layer 2: Mid diffuse glow — softer cyan spread
    const coronaGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x22bbff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    }));
    coronaGlow.scale.set(24, 24, 1);
    coronaGlow.userData.baseScale = new THREE.Vector2(24, 24);
    coronaGlow.userData.targetOpacity = 0.25;
    coronaGlow.userData.positionOffset = null;
    scene.add(coronaGlow);

    // Layer 3: Wide outer atmosphere halo — very soft, large radius
    const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x1188dd,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    }));
    outerGlow.scale.set(38, 38, 1);
    outerGlow.userData.baseScale = new THREE.Vector2(38, 38);
    outerGlow.userData.targetOpacity = 0.15;
    outerGlow.userData.positionOffset = null;
    scene.add(outerGlow);

    return { planet, clouds, cityLights, atmosphere, innerGlow, coronaGlow, outerGlow };
}
