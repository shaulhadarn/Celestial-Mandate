/* Updated: Premium moon shading and orbital dressing for the splash scene */
import * as THREE from 'three';
import { createProceduralMoonTexture } from '../core/splash_assets.js';

function getPlanetAnchor() {
    return window.innerWidth > 768
        ? { x: 4.5, y: 0.15 }
        : { x: 0, y: 3.25 };
}

/**
 * Creates the moon and its associated glow sprites and atmosphere rim.
 */
export function createSplashMoon(scene, haloTextures) {
    const { softGlowTex, haloRingTex } = haloTextures;
    const moonGeo = new THREE.SphereGeometry(1.2, 48, 48);
    const moonTex = createProceduralMoonTexture();
    moonTex.colorSpace = THREE.SRGBColorSpace;

    const moonMat = new THREE.MeshStandardMaterial({
        map: moonTex,
        color: 0xd8dee8,
        roughness: 0.96,
        metalness: 0.02,
        emissive: new THREE.Color(0x101722),
        emissiveIntensity: 0.14,
        transparent: true,
        opacity: 0
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(9.8, 2.3, 0);
    scene.add(moon);

    const moonGlowInner = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softGlowTex,
        color: 0x9fd2ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    moonGlowInner.scale.set(5.4, 5.1, 1);
    moonGlowInner.userData.baseScale = new THREE.Vector2(5.4, 5.1);
    moonGlowInner.userData.targetOpacity = 0.18;
    moon.add(moonGlowInner);

    const moonGlowOuter = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloRingTex,
        color: 0x4b7fff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    moonGlowOuter.scale.set(12, 11.3, 1);
    moonGlowOuter.userData.baseScale = new THREE.Vector2(12, 11.3);
    moonGlowOuter.userData.targetOpacity = 0.08;
    moon.add(moonGlowOuter);

    const moonRim = new THREE.Mesh(
        new THREE.SphereGeometry(1.28, 32, 32),
        new THREE.ShaderMaterial({
            uniforms: { uOpacity: { value: 0.0 } },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uOpacity;
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vec3 viewDir = normalize(-vPosition);
                    float intensity = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.15);
                    gl_FragColor = vec4(0.56, 0.73, 1.0, intensity * 0.24 * uOpacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
            depthWrite: false
        })
    );
    moon.add(moonRim);

    return { moon, moonGlowInner, moonGlowOuter, moonRim };
}

/**
 * Generates the satellite models that orbit the splash planet.
 */
export function createSplashSatellites(scene, trailTexture) {
    const satellites = [];
    const satColors = [0x00f2ff, 0xffaa00];

    for (let i = 0; i < 2; i++) {
        const satGroup = new THREE.Group();

        const goldFoilMat = new THREE.MeshStandardMaterial({
            color: 0xffd58a,
            metalness: 0.95,
            roughness: 0.22,
            emissive: 0x4a2606,
            emissiveIntensity: 0.14
        });
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x08152e,
            metalness: 0.86,
            roughness: 0.14,
            emissive: 0x0a2a4a,
            emissiveIntensity: 0.18
        });
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0xb9c4d2,
            metalness: 0.9,
            roughness: 0.18
        });

        const satBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.25), goldFoilMat);
        satGroup.add(satBody);

        const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 8), metalMat);
        deck.position.z = 0.15;
        deck.rotation.x = Math.PI / 2;
        satGroup.add(deck);

        const dishGeo = new THREE.SphereGeometry(0.1, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const dish = new THREE.Mesh(dishGeo, metalMat);
        dish.position.z = 0.18;
        dish.rotation.x = -Math.PI / 2;
        satGroup.add(dish);

        const arrayGroup = new THREE.Group();
        for (let j = 0; j < 2; j++) {
            const side = j === 0 ? 1 : -1;
            const panelWidth = 0.45;
            const panelHeight = 0.15;
            const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(panelWidth, 0.02, panelHeight), metalMat);
            panelFrame.position.x = side * (0.06 + panelWidth / 2);
            const panelSurface = new THREE.Mesh(new THREE.BoxGeometry(panelWidth * 0.95, 0.01, panelHeight * 0.9), panelMat);
            panelSurface.position.y = 0.01;
            panelFrame.add(panelSurface);
            arrayGroup.add(panelFrame);
        }
        satGroup.add(arrayGroup);

        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15), metalMat);
        antenna.position.set(0.04, 0.04, -0.1);
        antenna.rotation.x = Math.PI / 6;
        satGroup.add(antenna);

        const lightGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: satColors[i] });
        const navLight = new THREE.Mesh(lightGeo, lightMat);
        navLight.position.set(0, 0.08, 0.08);
        satGroup.add(navLight);

        const lightGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: trailTexture,
            color: satColors[i],
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        lightGlow.scale.set(0.26, 0.26, 1);
        navLight.add(lightGlow);

        satGroup.userData = {
            orbitRadius: 6.8 + i * 1.3,
            orbitSpeed: 0.25 + i * 0.15,
            orbitOffset: i * Math.PI * 1.2,
            inclination: i === 0 ? 0.25 : -0.35,
            light: navLight,
            lightGlow,
            lightColor: satColors[i]
        };

        scene.add(satGroup);
        satellites.push(satGroup);
    }

    return satellites;
}

/**
 * Updates the moon's orbital position and self-rotation.
 */
export function updateMoon(moon, currentTime, dt) {
    if (!moon) return;

    const anchor = getPlanetAnchor();
    const orbitSpeed = 0.15;
    const orbitRadius = 9.4;
    const angle = currentTime * 0.0001 * orbitSpeed;

    moon.position.x = anchor.x + Math.cos(angle) * orbitRadius;
    moon.position.y = anchor.y + 2.1 + Math.sin(angle) * 1.9;
    moon.position.z = Math.sin(angle) * orbitRadius * 0.55;
    moon.rotation.y += 0.01 * dt;
}

/**
 * Updates the satellite orbital positions and nav light blinking.
 */
export function updateSatellites(satellites, currentTime) {
    const anchor = getPlanetAnchor();

    satellites.forEach((sat) => {
        const ud = sat.userData;
        const timeVal = currentTime * 0.001;
        const angle = timeVal * ud.orbitSpeed + ud.orbitOffset;

        sat.position.x = anchor.x + Math.cos(angle) * ud.orbitRadius;
        sat.position.y = anchor.y + Math.sin(angle) * ud.orbitRadius * Math.sin(ud.inclination);
        sat.position.z = Math.sin(angle) * ud.orbitRadius * Math.cos(ud.inclination);
        sat.lookAt(anchor.x, anchor.y, 0);

        if (ud.light) {
            const lightOn = Math.floor(currentTime / 500) % 2 === 0;
            ud.light.material.color.setHex(lightOn ? ud.lightColor : 0x000000);
            ud.lightGlow.material.opacity = lightOn ? 0.72 : 0.08;
        }
    });
}
