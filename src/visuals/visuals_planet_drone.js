/* Updated: Mobile optimized - no SpotLight shadow on mobile, reduced PointLight range, lower-poly drone geometry on mobile */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';

/**
 * Creates the 3D model for the player's exploration drone.
 */
export function createDroneMesh() {
    const shipGroup = new THREE.Group();
    
    // Core Chassis
    const chassisGeo = new THREE.OctahedronGeometry(1.2, isMobileDevice ? 1 : 2);
    const chassisMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0x222222 })
        : new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.9 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 2;
    chassis.castShadow = !isMobileDevice;
    shipGroup.add(chassis);

    // Upper Shell
    const shellSeg = isMobileDevice ? 6 : 8;
    const shellGeo = new THREE.SphereGeometry(1.4, shellSeg, shellSeg, 0, Math.PI * 2, 0, Math.PI / 2);
    const shellMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0xdddddd })
        : new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.1, metalness: 0.8 });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = 2.1;
    shell.castShadow = !isMobileDevice;
    shipGroup.add(shell);

    // Sensor "Eye"
    const eyeGeo = new THREE.SphereGeometry(0.3, isMobileDevice ? 8 : 16, isMobileDevice ? 8 : 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 2.3, 1.1);
    shipGroup.add(eye);

    // Repulsor Pads
    const padGeo = new THREE.CylinderGeometry(0.6, 0.5, 0.2, 16);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for(let i=0; i<4; i++) {
        const padContainer = new THREE.Group();
        const angle = (i / 4) * Math.PI * 2;
        padContainer.rotation.y = angle;
        
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(0, 1.4, 1.4);
        pad.rotation.x = Math.PI / 6;
        pad.castShadow = true;
        padContainer.add(pad);
        
        const padGlowGeo = new THREE.CircleGeometry(0.4, 16);
        const padGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const padGlow = new THREE.Mesh(padGlowGeo, padGlowMat);
        padGlow.position.set(0, 1.25, 1.48);
        padGlow.rotation.x = Math.PI / 2 + Math.PI / 6;
        padContainer.add(padGlow);
        
        shipGroup.add(padContainer);
    }
    
    // Mobile: smaller range PointLight — fewer fragments lit per frame
    const engineLight = new THREE.PointLight(0x00f2ff, isMobileDevice ? 5 : 8, isMobileDevice ? 8 : 12);
    engineLight.position.set(0, 0.5, 0);
    shipGroup.add(engineLight);

    const flareMat = new THREE.SpriteMaterial({ 
        map: textures.glow, 
        color: 0x00f2ff, 
        transparent: true, 
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const flare = new THREE.Sprite(flareMat);
    flare.scale.set(3, 3, 1);
    flare.position.y = 0.5;
    shipGroup.add(flare);
    shipGroup.userData.flare = flare;

    // Mobile: SpotLight with castShadow=true is the single most expensive draw call
    // On mobile we keep the light but disable shadow casting entirely
    const spotLight = new THREE.SpotLight(0xffffff, isMobileDevice ? 12 : 20);
    spotLight.position.set(0, 5, 0);
    spotLight.target.position.set(0, 0, -10);
    spotLight.angle = 0.5;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = !isMobileDevice;
    if (!isMobileDevice) {
        spotLight.shadow.mapSize.set(512, 512);
        spotLight.shadow.camera.near = 1;
        spotLight.shadow.camera.far = 30;
    }
    shipGroup.add(spotLight);
    shipGroup.add(spotLight.target);

    // Engine trail particle pool
    const TRAIL_COUNT = isMobileDevice ? 12 : 24;
    const trails = [];
    for (let i = 0; i < TRAIL_COUNT; i++) {
        const mat = new THREE.SpriteMaterial({
            map: textures.glow,
            color: 0x00f2ff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.visible = false;
        sprite.scale.set(0.3, 0.3, 0.3);
        trails.push({
            sprite,
            life: 0,
            maxLife: 0.6 + Math.random() * 0.3,
            velocity: new THREE.Vector3(),
            padIndex: i % 4, // cycle across 4 repulsor pads
        });
    }
    shipGroup.userData.engineTrails = trails;
    shipGroup.userData.trailTimer = 0;

    return shipGroup;
}

/**
 * Creates a simple blob shadow sprite.
 */
export function createShadowSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.6)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(3.0, 3.0);
    const shadowMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.85,
        depthWrite: false, depthTest: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const mesh = new THREE.Mesh(shadowGeo, shadowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
}