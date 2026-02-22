/* Updated: Upgraded splash screen planet with premium atmosphere shader, better clouds and lighting */
import * as THREE from 'three';
import { createProceduralPlanetTexture, createProceduralCloudTexture } from '../core/splash_assets.js';

/**
 * Constructs the core planetary body, cloud layer, atmosphere shader, and glow sprites.
 */
export function createSplashPlanetGroup(scene, renderer, glowTex, isMobile) {
    const planetTex = createProceduralPlanetTexture();
    planetTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    
    const cloudTex = createProceduralCloudTexture();
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.wrapT = THREE.ClampToEdgeWrapping;
    cloudTex.minFilter = THREE.LinearFilter;

    // 1. Core Planet Body - Enhanced Material
    const geometry = new THREE.SphereGeometry(5, isMobile ? 48 : 64, isMobile ? 48 : 64);
    const material = new THREE.MeshStandardMaterial({ 
        map: planetTex, 
        roughness: 0.6,
        metalness: 0.1,
        transparent: true, 
        opacity: 0 
    });
    const planet = new THREE.Mesh(geometry, material);
    scene.add(planet);

    // 2. Cloud Layer - Parallax and shadows
    const cloudGeo = new THREE.SphereGeometry(5.05, isMobile ? 48 : 64, isMobile ? 48 : 64);
    const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudTex, 
        transparent: true, 
        opacity: 0, 
        blending: THREE.NormalBlending, 
        side: THREE.FrontSide, 
        depthWrite: false,
        roughness: 0.9,
        color: 0xffffff
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    planet.add(clouds);

    // 3. Premium Atmosphere Shader (Rayleigh scattering approximation)
    const atmoGeo = new THREE.SphereGeometry(5.3, isMobile ? 48 : 64, isMobile ? 48 : 64);
    const atmoMat = new THREE.ShaderMaterial({
        uniforms: { 
            uOpacity: { value: 0.0 },
            color1: { value: new THREE.Color(0x0088ff) },
            color2: { value: new THREE.Color(0x00f2ff) }
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
            uniform float uOpacity;
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
                float intensity = pow(0.65 - dot(vNormal, vPositionNormal), 4.0);
                vec3 finalColor = mix(color1, color2, intensity);
                gl_FragColor = vec4(finalColor, intensity * 1.5 * uOpacity);
            }
        `,
        side: THREE.BackSide, 
        blending: THREE.AdditiveBlending, 
        transparent: true,
        depthWrite: false
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmosphere);

    // 4. Enhanced Glows
    const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x00ccff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    innerGlow.scale.set(22, 22, 1);
    innerGlow.userData.targetOpacity = 0.5;
    scene.add(innerGlow);

    const coronaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5500ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    coronaGlow.scale.set(16, 16, 1);
    coronaGlow.userData.targetOpacity = 0.3;
    scene.add(coronaGlow);
    
    const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x0055ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    outerGlow.userData.targetOpacity = 0.4;
    outerGlow.scale.set(40, 40, 1);
    outerGlow.position.z = -2;
    scene.add(outerGlow);

    return { planet, clouds, atmosphere, innerGlow, coronaGlow, outerGlow };
}