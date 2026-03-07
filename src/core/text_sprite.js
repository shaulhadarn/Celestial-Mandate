import * as THREE from 'three';

/**
 * Creates a canvas-based text sprite for 3D scene labels.
 * Each call creates a small canvas, draws the text, and returns a Sprite.
 *
 * @param {string} text - The label text
 * @param {object} [opts] - Options
 * @param {number} [opts.fontSize=1.0] - Scale in world units (default 1.0 for galaxy, 0.7 for planet labels)
 * @returns {THREE.Sprite}
 */
export function createTextSprite(text, opts = {}) {
    const worldScale = opts.fontSize || 1.0;

    // ── Canvas rendering ────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const pxSize = 40;
    const font = `bold ${pxSize}px Rajdhani, sans-serif`;
    ctx.font = font;

    const metrics = ctx.measureText(text);
    const textW = Math.ceil(metrics.width) + 16;  // padding
    const textH = pxSize + 16;

    canvas.width = textW;
    canvas.height = textH;

    // Re-set font after resize (canvas reset clears context state)
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, textW / 2, textH / 2);

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, textW / 2, textH / 2);

    // ── Texture + Sprite ────────────────────────────────────────────────────
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    // Scale to world units, preserving aspect ratio
    const aspect = textW / textH;
    sprite.scale.set(worldScale * aspect, worldScale, 1);

    return sprite;
}
