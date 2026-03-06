/* Updated: Cinematic splash lighting tuned for premium planetary presentation */
import * as THREE from 'three';

/**
 * Sets up the lighting rig for the splash screen and returns the light handles.
 */
export function setupSplashLighting(scene, compactScene = false) {
    const sunLight = new THREE.DirectionalLight(0xfff0dc, compactScene ? 3.6 : 4.3);
    sunLight.position.set(18, 8, 14);
    scene.add(sunLight);

    const ambientLight = new THREE.HemisphereLight(0x4fb8ff, 0x03060d, compactScene ? 0.52 : 0.65);
    scene.add(ambientLight);

    const rimLight = new THREE.DirectionalLight(0x27c2ff, compactScene ? 1.0 : 1.4);
    rimLight.position.set(-16, -5, -18);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x00e5ff, compactScene ? 0.75 : 1.05, 55);
    fillLight.position.set(4, -6, 8);
    scene.add(fillLight);

    const warmBounce = new THREE.PointLight(0xff9051, compactScene ? 0.32 : 0.46, 80);
    warmBounce.position.set(15, -1, -10);
    scene.add(warmBounce);

    return { sunLight, ambientLight, rimLight, fillLight, warmBounce };
}
