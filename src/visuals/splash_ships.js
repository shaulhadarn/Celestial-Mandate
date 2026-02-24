/* Updated: Organized app hierarchy, moved to src/visuals folder, fixed imports and paths */
import * as THREE from 'three';
import { isMobile } from '../core/device.js';

export function createSplashScreenShip(type = 'scout', textures) {
    const shipGroup = new THREE.Group();
    const { hullTexture, trailTexture } = textures;
    
    // Textures applied to materials
    const hullMat = new THREE.MeshStandardMaterial({ 
        map: hullTexture,
        color: type === 'capital' ? 0x99aacc : 0x777777, 
        metalness: 0.8, 
        roughness: 0.4, 
        emissive: 0x111111 
    });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });

    shipGroup.userData.trailAnchors = [];

    if (type === 'scout') {
        const noseGeo = new THREE.CylinderGeometry(0.05, 0.4, 1.2, 6);
        const nose = new THREE.Mesh(noseGeo, hullMat);
        nose.rotation.z = -Math.PI / 2;
        nose.position.x = 0.6;
        shipGroup.add(nose);

        const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 0.8);
        const body = new THREE.Mesh(bodyGeo, hullMat);
        body.position.x = -0.8;
        shipGroup.add(body);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), hullMat);
        bridge.position.set(-0.8, 0.4, 0);
        shipGroup.add(bridge);

        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(-1.2, 0);
        wingShape.lineTo(-1.6, 1.2);
        wingShape.lineTo(-0.4, 1.2);
        wingShape.lineTo(0, 0);
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });
        
        const lw = new THREE.Mesh(wingGeo, hullMat);
        lw.rotation.x = -Math.PI / 2;
        lw.position.set(-0.3, 0, 0.4);
        shipGroup.add(lw);

        const rw = new THREE.Mesh(wingGeo, hullMat);
        rw.rotation.x = Math.PI / 2;
        rw.position.set(-0.3, 0, -0.4);
        shipGroup.add(rw);

        const enginePos = [{x:-1.8, y:0, z:0}, {x:-1.7, y:0.2, z:0.5}, {x:-1.7, y:0.2, z:-0.5}];
        shipGroup.userData.engineGlows = [];
        enginePos.forEach(pos => {
            const e = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.4, 8), engineMat);
            e.rotation.z = Math.PI/2;
            e.position.set(pos.x, pos.y, pos.z);
            shipGroup.add(e);
            
            const anchor = new THREE.Object3D();
            anchor.position.set(pos.x - 0.3, pos.y, pos.z);
            shipGroup.add(anchor);
            shipGroup.userData.trailAnchors.push(anchor);

            const flare = new THREE.Sprite(new THREE.SpriteMaterial({
                map: trailTexture, color: 0x00f2ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            flare.position.set(pos.x - 0.05, pos.y, pos.z);
            flare.scale.set(1.0, 1.0, 1);
            shipGroup.add(flare);
            shipGroup.userData.engineGlows.push(flare);
            
            // Bright core for the engine light
            const core = new THREE.Sprite(new THREE.SpriteMaterial({
                map: trailTexture, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8
            }));
            core.position.set(pos.x - 0.02, pos.y, pos.z);
            core.scale.set(0.4, 0.4, 1);
            shipGroup.add(core);
            shipGroup.userData.engineGlows.push(core);
        });

        shipGroup.scale.setScalar(0.7);
    } else {
        // --- CAPITAL SHIP DESIGN ---
        const length = 6;
        const width = 1.8;
        const height = 1.2;

        for(let i=0; i<3; i++) {
            const segment = new THREE.Mesh(new THREE.BoxGeometry(length/3, height - (i*0.2), width - (i*0.1)), hullMat);
            segment.position.x = (length/3) - (i * (length/3));
            shipGroup.add(segment);
        }

        const prongGeo = new THREE.BoxGeometry(1.5, 0.3, 0.3);
        const lp = new THREE.Mesh(prongGeo, hullMat);
        lp.position.set(length/2 + 0.5, 0, 0.5);
        shipGroup.add(lp);
        const rp = new THREE.Mesh(prongGeo, hullMat);
        rp.position.set(length/2 + 0.5, 0, -0.5);
        shipGroup.add(rp);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.6), hullMat);
        tower.position.set(-1, 0.8, 0);
        shipGroup.add(tower);

        const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 2.2), ribMat);
        engineBlock.position.x = -length/2 - 0.2;
        shipGroup.add(engineBlock);

        const mainEngines = [
            {y: 0.4, z: 0.7}, {y: -0.4, z: 0.7},
            {y: 0.4, z: -0.7}, {y: -0.4, z: -0.7},
            {y: 0, z: 0}
        ];
        shipGroup.userData.engineGlows = [];
        mainEngines.forEach(pos => {
            const e = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.8, 12), engineMat);
            e.rotation.z = Math.PI/2;
            e.position.set(-length/2 - 0.6, pos.y, pos.z);
            shipGroup.add(e);

            const anchor = new THREE.Object3D();
            anchor.position.set(-length/2 - 1.2, pos.y, pos.z);
            shipGroup.add(anchor);
            shipGroup.userData.trailAnchors.push(anchor);

            const flare = new THREE.Sprite(new THREE.SpriteMaterial({
                map: trailTexture, color: 0xffaa00, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            flare.position.set(-length/2 - 0.7, pos.y, pos.z);
            flare.scale.set(2.4, 2.4, 1);
            shipGroup.add(flare);
            shipGroup.userData.engineGlows.push(flare);

            // Bright core for the engine light
            const core = new THREE.Sprite(new THREE.SpriteMaterial({
                map: trailTexture, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
            }));
            core.position.set(-length/2 - 0.65, pos.y, pos.z);
            core.scale.set(1.0, 1.0, 1);
            shipGroup.add(core);
            shipGroup.userData.engineGlows.push(core);
        });

        const light = new THREE.PointLight(0xffaa00, 15, 20);
        light.position.set(-length/2 - 1, 0, 0);
        shipGroup.add(light);
    }

    return shipGroup;
}

export function createCapitalFleet(textures) {
    const fleetGroup = new THREE.Group();
    fleetGroup.userData.isFleet = true;
    
    const flagship = createSplashScreenShip('capital', textures);
    flagship.position.set(0, 0, 0);
    fleetGroup.add(flagship);
    
    const escorts = [];
    const escortOffsets = [
        { x: -3, y: 1.5, z: 2 },
        { x: -3, y: -1.5, z: -2 },
        { x: -5, y: 0, z: 4 }
    ];
    
    escortOffsets.forEach(offset => {
        const escort = createSplashScreenShip('scout', textures);
        escort.position.set(offset.x, offset.y, offset.z);
        escort.scale.setScalar(0.4);
        fleetGroup.add(escort);
        escorts.push(escort);
    });
    
    fleetGroup.userData.ships = [flagship, ...escorts];
    return fleetGroup;
}

export function resetShip(ship, ships, initial = false) {
    const index = ships.indexOf(ship) === -1 ? ships.length : ships.indexOf(ship);

    if (initial) {
        ship.position.x = -8 - (index * 12); 
    } else {
        ship.position.x = -35 - Math.random() * 15;
    }
    
    ship.position.y = (Math.random() - 0.5) * 6;
    ship.position.z = 7 + Math.random() * 4; 
    
    if (isMobile) {
        ship.position.y = 4 + (Math.random() - 0.5) * 4;
    }
    
    ship.userData = {
        ...ship.userData,
        speed: 2.5 + Math.random() * 1.5, 
        offset: Math.random() * 100,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        lastTrailSpawn: performance.now(),
        trailAnchors: ship.userData.trailAnchors 
    };

    ship.rotation.x = (Math.random() - 0.5) * 0.5;
}