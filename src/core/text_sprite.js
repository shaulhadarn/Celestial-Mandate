import * as THREE from 'three';

/**
 * Creates a canvas-based text sprite for 3D scene labels.
 * Renders at 2x resolution for crisp text on high-DPR mobile screens.
 *
 * @param {string} text - The label text
 * @param {object} [opts]
 * @param {number} [opts.fontSize=1.0] - Scale in world units
 * @returns {THREE.Sprite}
 */
export function createTextSprite(text, opts = {}) {
    const worldScale = opts.fontSize || 1.0;

    // Render at 2x for crisp text on retina / mobile screens
    const scale = 2;
    const pxSize = 48 * scale;
    const pad = 12 * scale;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = `bold ${pxSize}px Rajdhani, sans-serif`;
    ctx.font = font;

    const metrics = ctx.measureText(text);
    const textW = Math.ceil(metrics.width) + pad * 2;
    const textH = pxSize + pad * 2;

    // Ensure power-of-two-ish dimensions for better GPU filtering
    canvas.width = textW;
    canvas.height = textH;

    // Re-set after resize (canvas reset clears state)
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark outline for readability against any background
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 5 * scale;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, textW / 2, textH / 2);

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, textW / 2, textH / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    const aspect = textW / textH;
    sprite.scale.set(worldScale * aspect, worldScale, 1);

    return sprite;
}
