import { Text } from 'troika-three-text';

// Rajdhani SemiBold WOFF2 from Google Fonts (same weight used by the HTML UI)
const FONT_URL = 'https://fonts.gstatic.com/s/rajdhani/v15/LDI2apCSOBg7S-QT7pasEfOqeef3kg.woff2';

/**
 * Creates an SDF text label mesh for 3D scenes (replaces canvas-based sprites).
 * Uses troika-three-text for crisp text at any zoom level with a single shared font atlas.
 * Auto-billboards to face the camera via onBeforeRender.
 *
 * @param {string} text - The label text
 * @param {object} [opts] - Options
 * @param {number} [opts.fontSize=1.0] - Font size in world units
 * @returns {THREE.Mesh} (troika Text mesh — drop-in for THREE.Sprite positioning)
 */
export function createTextSprite(text, opts = {}) {
    const fontSize = opts.fontSize || 1.0;

    const label = new Text();
    label.text = text;
    label.font = FONT_URL;
    label.fontSize = fontSize;
    label.anchorX = 'center';
    label.anchorY = 'middle';

    // White fill with dark outline for readability (matches previous canvas style)
    label.color = 0xffffff;
    label.outlineWidth = '3%';
    label.outlineColor = 0x000000;
    label.outlineOpacity = 0.65;

    // Rendering — same depth behavior as previous SpriteMaterial
    label.depthTest = true;
    label.depthWrite = false;

    // Billboard: face the camera every frame (replaces Sprite auto-billboard)
    label.onBeforeRender = function (_renderer, _scene, cam) {
        this.quaternion.copy(cam.quaternion);
    };

    // Kick off async SDF generation so geometry is ready by next render
    label.sync();

    return label;
}
