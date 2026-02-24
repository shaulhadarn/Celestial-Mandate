import * as THREE from 'three';

/**
 * Creates a text label sprite for 3D scenes.
 * @param {string} text - The label text
 * @param {object} [opts] - Options
 * @param {number} [opts.fontSize=17] - Base font size (before pixel scaling)
 * @param {number} [opts.worldScale=0.05] - Scale factor from canvas pixels to world units
 * @returns {THREE.Sprite}
 */
export function createTextSprite(text, opts = {}) {
    const PIXEL_SCALE = 2;
    const fontSize = opts.fontSize || 17;
    const worldScale = opts.worldScale || 0.05;
    const font = `600 ${fontSize * PIXEL_SCALE}px "Rajdhani", sans-serif`;

    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const metrics = measure.measureText(text);

    const GLOW_PAD = 5 * PIXEL_SCALE;
    const w = Math.ceil(metrics.width) + GLOW_PAD * 2;
    const h = (fontSize + 8) * PIXEL_SCALE + GLOW_PAD * 2;
    const cx = w / 2;
    const cy = h / 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Single very subtle outer halo
    ctx.lineWidth = 3 * PIXEL_SCALE;
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.10)';
    ctx.strokeText(text, cx, cy);

    // Thin dark outline for readability
    ctx.lineWidth = 1.2 * PIXEL_SCALE;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeText(text, cx, cy);

    // Pure white fill
    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.fillText(text, cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;

    const spriteMaterial = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set((w * worldScale) / PIXEL_SCALE, (h * worldScale) / PIXEL_SCALE, 1);
    return sprite;
}
