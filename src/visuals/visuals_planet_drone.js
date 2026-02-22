/* Updated: Organized app hierarchy, moved to src/visuals folder, fixed imports and paths */
import * as THREE from 'three';
import { textures } from '../core/assets.js';

/**
 * Creates the 3D model for the player's exploration drone.
 */
export function createDroneMesh() {
    const shipGroup = new THREE.Group();
    
    // Core Chassis
    const chassisGeo = new THREE.OctahedronGeometry(1.2, 2);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.9 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 2;
    chassis.castShadow = true;
    shipGroup.add(chassis);

    // Upper Shell
    const shellGeo = new THREE.SphereGeometry(1.4, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.1, metalness: 0.8 });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.y = 2.1;
    shell.castShadow = true;
    shipGroup.add(shell);

    // Sensor "Eye"
    const eyeGeo = new THREE.SphereGeometry(0.3, 16, 16);
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
    
    const engineLight = new THREE.PointLight(0x00f2ff, 8, 12);
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

    const spotLight = new THREE.SpotLight(0xffffff, 20);
    spotLight.position.set(0, 5, 0);
    spotLight.target.position.set(0, 0, -10);
    spotLight.angle = 0.5;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    shipGroup.add(spotLight);
    shipGroup.add(spotLight.target);

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
    gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    const tex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const shadowMat = new THREE.MeshBasicMaterial({ 
        map: tex, transparent: true, opacity: 0.6,
        depthWrite: false, depthTest: true,
        polygonOffset: true, polygonOffsetFactor: -1
    });
    const mesh = new THREE.Mesh(shadowGeo, shadowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
}