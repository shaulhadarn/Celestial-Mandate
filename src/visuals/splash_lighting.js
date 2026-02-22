/* Updated: Enhanced high-contrast sci-fi lighting for splash screen */
import * as THREE from 'three';

/**
 * Sets up the complex directional and ambient lighting for the splash screen.
 */
export function setupSplashLighting(scene) {
    // 1. Main Sun Light (Key Light) - Stronger, sharper
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 3.5);
    sunLight.position.set(10, 5, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // 2. Ambient Fill Light - Deep space blue
    const ambientLight = new THREE.AmbientLight(0x0a1526, 0.4);
    scene.add(ambientLight);

    // 3. Rim Light (Backlight) - Creates a glowing edge on the dark side of the planet
    const rimLight = new THREE.DirectionalLight(0x0088ff, 1.5);
    rimLight.position.set(-15, -5, -15);
    scene.add(rimLight);

    // 4. Fill Light - Soft blue/cyan fill from nebula
    const fillLight = new THREE.PointLight(0x00f2ff, 0.8, 50);
    fillLight.position.set(5, -5, 5);
    scene.add(fillLight);
}