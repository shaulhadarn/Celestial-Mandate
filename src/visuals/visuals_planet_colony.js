/* Updated: Organized app hierarchy, moved to src/visuals folder, fixed imports and paths */
import * as THREE from 'three';
import { gameState, BUILDINGS } from '../core/state.js';

export let harvesterGroups = [];

/**
 * Renders the 3D structures of a colony on the planetary surface.
 */
export function renderColonyGroundBuildings(planetId, group, heightFn) {
    while(group.children.length > 0) group.remove(group.children[0]);
    harvesterGroups = [];
    const colony = gameState.colonies[planetId];
    if (!colony) return;

    // Hub
    const hubGeo = new THREE.CylinderGeometry(8, 10, 4, 8);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    const hubY = heightFn(0, 0);
    hub.position.set(0, hubY + 1.5, 0);
    hub.castShadow = true;
    hub.receiveShadow = true;
    group.add(hub);

    const hubLight = new THREE.PointLight(0x00f2ff, 10, 30);
    hubLight.position.set(0, 5, 0);
    hub.add(hubLight);

    // Buildings
    colony.buildings.forEach((bKey, i) => {
        const buildingData = BUILDINGS[bKey];
        const angle = (i / 5) * Math.PI * 2;
        const dist = 18;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const y = heightFn(x, z);

        const bGroup = new THREE.Group();
        bGroup.position.set(x, y, z);
        bGroup.rotation.y = -angle;

        const baseGeo = new THREE.BoxGeometry(6, 1, 6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        bGroup.add(new THREE.Mesh(baseGeo, baseMat));

        let towerGeo;
        if (bKey === 'power_plant') towerGeo = new THREE.CylinderGeometry(2, 3, 10, 6);
        else if (bKey === 'mining_network') towerGeo = new THREE.OctahedronGeometry(4);
        else if (bKey === 'hydroponics') towerGeo = new THREE.TorusKnotGeometry(2, 0.5, 64, 8);
        else towerGeo = new THREE.BoxGeometry(4, 12, 4);

        const towerMat = new THREE.MeshStandardMaterial({
            color: buildingData.borderColor || 0x00f2ff,
            emissive: buildingData.borderColor || 0x00f2ff,
            emissiveIntensity: 0.2
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = 5;
        tower.castShadow = true;
        bGroup.add(tower);

        group.add(bGroup);
    });

    // Harvesters
    const harvesters = colony.harvesters || [];
    harvesters.forEach((h) => {
        const hx = h.position.x;
        const hz = h.position.z;
        const hy = heightFn(hx, hz);

        const hGroup = new THREE.Group();
        hGroup.position.set(hx, hy, hz);
        hGroup.userData = { isHarvester: true, harvesterId: h.id };

        // Base platform
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x554422, roughness: 0.6, metalness: 0.4 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 2, 8), baseMat);
        base.position.y = 1;
        base.castShadow = true;
        base.receiveShadow = true;
        hGroup.add(base);

        // Main drilling column
        const columnMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.15,
            roughness: 0.4,
            metalness: 0.7
        });
        const column = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 14, 8), columnMat);
        column.position.y = 9;
        column.castShadow = true;
        hGroup.add(column);

        // Rotating top arm
        const armMat = new THREE.MeshStandardMaterial({ color: 0xddaa33, metalness: 0.8, roughness: 0.3 });
        const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.5), armMat);
        arm.position.y = 17;
        arm.userData.rotatingArm = true;
        hGroup.add(arm);

        // Drill bit (cone pointing down into ground)
        const drillMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
        const drill = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 6), drillMat);
        drill.position.y = -1;
        drill.rotation.x = Math.PI; // point downward
        hGroup.add(drill);

        // Amber beacon light
        const beacon = new THREE.PointLight(0xffaa00, 8, 40);
        beacon.position.y = 18;
        beacon.userData.beacon = true;
        hGroup.add(beacon);

        group.add(hGroup);
        harvesterGroups.push(hGroup);
    });
}
