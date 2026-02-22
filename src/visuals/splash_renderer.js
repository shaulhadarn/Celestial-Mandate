/* Updated: Organized app hierarchy, moved to src/visuals folder, fixed imports and paths */
import * as THREE from 'three';
import { createHullTexture, createGlowTexture } from '../core/splash_assets.js';
import { createSplashScreenShip, createCapitalFleet, resetShip } from './splash_ships.js';
import { trailParticles, spawnTrailParticle, updateTrailParticles } from './splash_particles.js';

// Modular Imports
import { setupSplashLighting } from './splash_lighting.js';
import { createSplashMoon, createSplashSatellites, updateMoon, updateSatellites } from './splash_celestial.js';
import { createSplashPlanetGroup } from './splash_planet_components.js';

let scene, camera, renderer, planet, clouds, moon, atmosphere;
let innerGlow, coronaGlow, outerGlow;
let moonGlowInner, moonGlowOuter, moonRim;
let animationId;
let lastTime = performance.now();
let globalFade = 0;
const FADE_DURATION = 1.5; // seconds
const ships = [];
let satellites = [];
let trailTexture, hullTexture;

export function initSplashPlanet(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const maxPixelRatio = window.innerWidth > 768 ? 2 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    container.appendChild(renderer.domElement);

    const isMobile = window.innerWidth <= 768;

    trailTexture = createGlowTexture();
    hullTexture = createHullTexture();
    const glowTex = createGlowTexture();

    // --- Component Initialization via Modular Factories ---
    
    // Planet & Atmosphere components
    const planetGroup = createSplashPlanetGroup(scene, renderer, glowTex, isMobile);
    planet = planetGroup.planet;
    clouds = planetGroup.clouds;
    atmosphere = planetGroup.atmosphere;
    innerGlow = planetGroup.innerGlow;
    coronaGlow = planetGroup.coronaGlow;
    outerGlow = planetGroup.outerGlow;

    // Lighting
    setupSplashLighting(scene);

    // Moon components
    const moonGroup = createSplashMoon(scene, glowTex);
    moon = moonGroup.moon;
    moonGlowInner = moonGroup.moonGlowInner;
    moonGlowOuter = moonGroup.moonGlowOuter;
    moonRim = moonGroup.moonRim;

    // Satellites
    satellites = createSplashSatellites(scene, trailTexture);

    // Ships
    const texGroup = { hullTexture, trailTexture };
    const scout = createSplashScreenShip('scout', texGroup);
    resetShip(scout, ships, true);
    scene.add(scout);
    ships.push(scout);

    const fleet = createCapitalFleet(texGroup);
    resetShip(fleet, ships, true);
    scene.add(fleet);
    ships.push(fleet);

    // Stars Background
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 2500;
    const starPos = new Float32Array(starsCount * 3);
    const starSizes = new Float32Array(starsCount);
    for(let i=0; i<starsCount; i++) {
        starPos[i*3] = (Math.random() - 0.5) * 400;
        starPos[i*3+1] = (Math.random() - 0.5) * 400;
        starPos[i*3+2] = (Math.random() - 0.5) * 200 - 50; // Keep behind planet
        starSizes[i] = Math.random() * 2;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starsGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    // Custom shader for twinkling stars
    const starsMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color: { value: new THREE.Color(0xffffff) }
        },
        vertexShader: `
            attribute float size;
            varying float vSize;
            void main() {
                vSize = size;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color;
            varying float vSize;
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                
                // Twinkle effect based on gl_FragCoord and time
                float twinkle = sin(time * 2.0 + gl_FragCoord.x * 0.1) * 0.5 + 0.5;
                float alpha = (0.8 - dist * 1.6) * (0.5 + twinkle * 0.5);
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Initial position based on device
    if (isMobile) {
        const p = { x: 0, y: 3, z: 0 };
        planet.position.set(p.x, p.y, p.z);
        // Ensure all components share the position object ref or copy correctly
        atmosphere.position.copy(planet.position);
        innerGlow.position.copy(planet.position);
        outerGlow.position.copy(planet.position);
        coronaGlow.position.copy(planet.position);
        camera.position.z = 18;
    } else {
        const p = { x: 4, y: 0, z: 0 };
        planet.position.x = p.x;
        atmosphere.position.x = p.x;
        innerGlow.position.x = p.x;
        outerGlow.position.x = p.x;
        coronaGlow.position.x = p.x;
    }

    function animate(currentTime) {
        animationId = requestAnimationFrame(animate);
        
        if (!lastTime) lastTime = currentTime;
        const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;

        planet.rotation.y += 0.05 * dt;
        if(clouds) clouds.rotation.y += 0.08 * dt; 
        planet.rotation.x += 0.005 * dt;

        // Cinematic Camera Drift
        const isMobileLive = window.innerWidth <= 768;
        const baseZ = isMobileLive ? 18 : 15;
        camera.position.x = Math.sin(currentTime * 0.0002) * 2;
        camera.position.y = Math.cos(currentTime * 0.00015) * 1.5 + (isMobileLive ? 3 : 0);
        camera.position.z = baseZ + Math.sin(currentTime * 0.0001) * 1.5;
        
        // Always look at the planet's center
        if (planet) {
            camera.lookAt(planet.position);
        }

        starsMat.uniforms.time.value = currentTime * 0.001;
        
        // Handle Global Fade In
        if (globalFade < 1) {
            globalFade = Math.min(1, globalFade + dt / FADE_DURATION);
            
            planet.material.opacity = globalFade;
            if (clouds) clouds.material.opacity = globalFade * 0.6;
            if (atmosphere) atmosphere.material.uniforms.uOpacity.value = globalFade;
            
            innerGlow.material.opacity = globalFade * (innerGlow.userData.targetOpacity || 0.45);
            coronaGlow.material.opacity = globalFade * (coronaGlow.userData.targetOpacity || 0.25);
            outerGlow.material.opacity = globalFade * (outerGlow.userData.targetOpacity || 0.4);
            
            starsMat.uniforms.color.value.setRGB(globalFade, globalFade, globalFade);
            
            if (moon) {
                moon.material.opacity = globalFade;
                moonGlowInner.material.opacity = globalFade * (moonGlowInner.userData.targetOpacity || 0.4);
                moonGlowOuter.material.opacity = globalFade * (moonGlowOuter.userData.targetOpacity || 0.2);
                moonRim.material.uniforms.uOpacity.value = globalFade;
            }
        }

        // Animated Modular Bodies
        updateSatellites(satellites, currentTime);
        updateMoon(moon, currentTime, dt);

        // Ship Animation Logic
        ships.forEach(shipOrFleet => {
            shipOrFleet.position.x += shipOrFleet.userData.speed * dt;
            shipOrFleet.position.y += Math.sin(currentTime * 0.001 + shipOrFleet.userData.offset) * 0.01;
            
            if (shipOrFleet.userData.rotSpeed) {
                shipOrFleet.rotation.x += Math.sin(currentTime * 0.002) * 0.002;
            }

            shipOrFleet.updateMatrixWorld(true);

            const subShips = shipOrFleet.userData.isFleet ? shipOrFleet.userData.ships : [shipOrFleet];
            
            subShips.forEach(s => {
                if (s.userData.engineGlows) {
                    const flicker = 0.9 + Math.random() * 0.2;
                    const pulse = Math.sin(currentTime * 0.01 + shipOrFleet.userData.offset) * 0.1 + 1.0;
                    s.userData.engineGlows.forEach(g => {
                        g.scale.setScalar((g.material.color.r > 0.5 ? 1.5 : 0.7) * pulse * flicker);
                        g.material.opacity = 0.7 * flicker;
                    });
                }
            });

            const spawnRate = isMobile ? 60 : 40; 
            if (currentTime - shipOrFleet.userData.lastTrailSpawn > spawnRate) {
                subShips.forEach(s => {
                    if (s.userData.trailAnchors) {
                        s.userData.trailAnchors.forEach(anchor => {
                            const pos = new THREE.Vector3();
                            anchor.getWorldPosition(pos);
                            spawnTrailParticle(scene, pos, trailTexture);
                        });
                    }
                });
                shipOrFleet.userData.lastTrailSpawn = currentTime;
            }
            
            if (shipOrFleet.position.x > 30) {
                resetShip(shipOrFleet, ships);
            }
        });

        updateTrailParticles(scene, dt);

        renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);

    window.addEventListener('resize', onResize);
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (planet) {
        const isMobile = window.innerWidth <= 768;
        const px = isMobile ? 0 : 4;
        const py = isMobile ? 3 : 0;
        
        planet.position.set(px, py, 0);
        
        // Safety checks for components that might be mid-initialization
        if (atmosphere) atmosphere.position.copy(planet.position);
        if (innerGlow) innerGlow.position.copy(planet.position);
        if (coronaGlow) coronaGlow.position.copy(planet.position);
        if (outerGlow) outerGlow.position.copy(planet.position);
        
        camera.position.z = isMobile ? 18 : 15;
    }
}

export function stopSplashPlanet() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    window.removeEventListener('resize', onResize);
    
    trailParticles.forEach(p => {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
    });
    trailParticles.length = 0;

    satellites.forEach(sat => {
        scene.remove(sat);
        sat.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    });
    satellites.length = 0;

    if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }
}

// tombstone comments for extracted logic:
// removed function createProceduralPlanetTexture() {} (moved to splash_assets.js)
// removed function createProceduralCloudTexture() {} (moved to splash_assets.js)
// removed function createProceduralMoonTexture() {} (moved to splash_assets.js)
// removed function setupSplashLighting() {} (moved to splash_lighting.js)
// removed function createSplashMoon() {} (moved to splash_celestial.js)
// removed function createSplashSatellites() {} (moved to splash_celestial.js)
// removed function createSplashPlanetGroup() {} (moved to splash_planet_components.js)