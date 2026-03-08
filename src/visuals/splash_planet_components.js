/* Updated: Stellaris-quality planet with rich atmosphere, bright city lights, and tight atmospheric glow */
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
    const segments = isMobile ? 48 : 80;
    const { softGlowTex, glowTex } = haloTextures;

    const planetResult = createProceduralPlanetTexture();
    const planetTex = planetResult.texture;
    planetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    planetTex.colorSpace = THREE.SRGBColorSpace;

    const cloudTex = createProceduralCloudTexture();
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.wrapT = THREE.ClampToEdgeWrapping;
    cloudTex.minFilter = THREE.LinearFilter;
    cloudTex.magFilter = THREE.LinearFilter;
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    // Pass planet heightmap so city lights only appear on land
    const cityLightsTex = createProceduralCityLightsTexture(planetResult);
    cityLightsTex.wrapS = THREE.RepeatWrapping;
    cityLightsTex.wrapT = THREE.ClampToEdgeWrapping;
    cityLightsTex.minFilter = THREE.LinearFilter;
    cityLightsTex.magFilter = THREE.LinearFilter;
    cityLightsTex.colorSpace = THREE.SRGBColorSpace;

    // ── Planet surface ──
    const geometry = new THREE.SphereGeometry(5, segments, segments);
    const material = new THREE.MeshPhysicalMaterial({
        map: planetTex,
        roughness: 0.68,
        metalness: 0.05,
        clearcoat: 0.2,
        clearcoatRoughness: 0.7,
        emissive: new THREE.Color(0x0c1520),
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0
    });
    const planet = new THREE.Mesh(geometry, material);
    scene.add(planet);

    // ── Cloud layer ──
    const cloudGeo = new THREE.SphereGeometry(5.06, segments, segments);
    const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 0.98,
        metalness: 0.0,
        color: 0xdceeff
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    planet.add(clouds);

    // ── City lights shader — bright on dark side ──
    const cityLights = new THREE.Mesh(
        new THREE.SphereGeometry(5.02, segments, segments),
        new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: 0.0 },
                uTime: { value: 0.0 },
                uLightDirection: { value: new THREE.Vector3(0.8, 0.3, 0.55).normalize() },
                uLightsMap: { value: cityLightsTex },
                uWarmColor: { value: new THREE.Color(0xffcc88) },
                uCoolColor: { value: new THREE.Color(0x88d8ff) }
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
                    vec3 normal = normalize(vWorldNormal);
                    vec4 lightSample = texture2D(uLightsMap, vUv);
                    float luminance = dot(lightSample.rgb, vec3(0.299, 0.587, 0.114));

                    // Shimmer effect
                    float shimmer = 0.9 + 0.1 * sin(uTime * 2.0 + vUv.x * 50.0 + vUv.y * 35.0);

                    // Color mapping
                    vec3 mappedColor = mix(uWarmColor, uCoolColor, clamp(lightSample.b * 1.3, 0.0, 1.0));
                    vec3 finalColor = mix(mappedColor, lightSample.rgb * 1.5, 0.4);

                    // Lights visible everywhere — no night mask
                    float intensity = max(lightSample.a, luminance);
                    float alpha = intensity * shimmer * uOpacity * 0.85;
                    if (alpha < 0.01) discard;
                    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    planet.add(cityLights);

    // ── Atmosphere shader — tight, bright Fresnel rim with day/twilight/night coloring ──
    const atmoGeo = new THREE.SphereGeometry(5.28, segments, segments);
    const atmoMat = new THREE.ShaderMaterial({
        uniforms: {
            uOpacity: { value: 0.0 },
            uTime: { value: 0.0 },
            uLightDirection: { value: new THREE.Vector3(0.8, 0.3, 0.55).normalize() },
            colorDay: { value: new THREE.Color(0x4db8ff) },
            colorTwilight: { value: new THREE.Color(0xff7744) },
            colorNight: { value: new THREE.Color(0x1a88cc) }
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

                // Tight Fresnel — strong at the rim, drops off fast
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);

                // Sun-facing calculations
                float sunFacing = max(dot(normal, lightDir), 0.0);
                float twilight = smoothstep(0.0, 0.18, sunFacing) * (1.0 - smoothstep(0.18, 0.55, sunFacing));

                // Night side rim — subtle blue glow
                float nightFacing = max(dot(normal, -lightDir), 0.0);
                float nightRim = pow(nightFacing, 1.4) * fresnel * 0.3;

                // Subtle breathing
                float pulse = 0.96 + 0.04 * sin(uTime * 0.5);

                // Color blending
                vec3 finalColor = mix(colorNight, colorTwilight, twilight);
                finalColor = mix(finalColor, colorDay, pow(sunFacing, 0.5));

                // Bright rim on the lit side, subtle on dark side
                float litRim = fresnel * (0.25 + sunFacing * 0.75);
                float alpha = (litRim + twilight * fresnel * 0.8 + nightRim) * uOpacity * pulse;

                // Extra bright edge — the "atmosphere line" visible in Stellaris
                float edgeLine = pow(fresnel, 6.0) * sunFacing * 0.6;
                alpha += edgeLine * uOpacity;

                gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);

    // ── Second atmosphere layer — thin bright edge line ──
    const atmoEdgeGeo = new THREE.SphereGeometry(5.14, segments, segments);
    const atmoEdgeMat = new THREE.ShaderMaterial({
        uniforms: {
            uOpacity: { value: 0.0 },
            uTime: { value: 0.0 },
            uLightDirection: { value: new THREE.Vector3(0.8, 0.3, 0.55).normalize() },
            uColor: { value: new THREE.Color(0x66ccff) }
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
            uniform vec3 uColor;
            varying vec3 vWorldNormal;
            varying vec3 vViewDir;
            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDir = normalize(vViewDir);
                vec3 lightDir = normalize(uLightDirection);

                // Very tight Fresnel — only visible at the extreme edge
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 8.0);

                // Only on lit side + terminator
                float sunFacing = dot(normal, lightDir);
                float litMask = smoothstep(-0.15, 0.3, sunFacing);

                float pulse = 0.95 + 0.05 * sin(uTime * 0.6 + 1.0);
                float alpha = fresnel * litMask * uOpacity * pulse * 0.9;

                gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
            }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });
    const atmosphereEdge = new THREE.Mesh(atmoEdgeGeo, atmoEdgeMat);
    scene.add(atmosphereEdge);

    // ── Layered glow system — tighter, more concentrated around planet ──
    const glowTexture = softGlowTex || glowTex;

    // Layer 1: Tight bright core halo — hugs the planet closely
    const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x44ccff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    }));
    innerGlow.scale.set(12.5, 12.5, 1);
    innerGlow.userData.baseScale = new THREE.Vector2(12.5, 12.5);
    innerGlow.userData.targetOpacity = 0.5;
    innerGlow.userData.positionOffset = null;
    scene.add(innerGlow);

    // Layer 2: Mid corona — soft atmospheric spread
    const coronaGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x2299dd,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    }));
    coronaGlow.scale.set(18, 18, 1);
    coronaGlow.userData.baseScale = new THREE.Vector2(18, 18);
    coronaGlow.userData.targetOpacity = 0.22;
    coronaGlow.userData.positionOffset = null;
    scene.add(coronaGlow);

    // Layer 3: Outer halo — very subtle, tighter than before
    const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x1177bb,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    }));
    outerGlow.scale.set(26, 26, 1);
    outerGlow.userData.baseScale = new THREE.Vector2(26, 26);
    outerGlow.userData.targetOpacity = 0.12;
    outerGlow.userData.positionOffset = null;
    scene.add(outerGlow);

    return { planet, clouds, cityLights, atmosphere, atmosphereEdge, innerGlow, coronaGlow, outerGlow };
}
