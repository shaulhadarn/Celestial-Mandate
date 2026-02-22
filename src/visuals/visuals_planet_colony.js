/* Updated: Organized app hierarchy, moved to src/visuals folder, fixed imports and paths */
import * as THREE from 'three';
import { gameState, BUILDINGS } from '../core/state.js';

/**
 * Renders the 3D structures of a colony on the planetary surface.
 */
export function renderColonyGroundBuildings(planetId, group, heightFn) {
    while(group.children.length > 0) group.remove(group.children[0]);
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
}