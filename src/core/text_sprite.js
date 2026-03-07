import * as THREE from 'three';

// Round up to nearest power of two (optimal for GPU mipmap generation)
function nextPOT(v) {
    v--;
    v |= v >> 1; v |= v >> 2; v |= v >> 4; v |= v >> 8; v |= v >> 16;
    return v + 1;
}

/**
 * Creates a high-resolution canvas-based text sprite for 3D scene labels.
 * Renders at 4x resolution with power-of-two textures for crisp display
 * on retina / mobile screens at any zoom level.
 *
 * @param {string} text - The label text
 * @param {object} [opts]
 * @param {number} [opts.fontSize=1.0] - Scale in world units
 * @returns {THREE.Sprite}
 */
export function createTextSprite(text, opts = {}) {
    const worldScale = opts.fontSize || 1.0;

    // ── High-res canvas rendering (4x for retina clarity) ───────────────────
    const RES = 4;
    const pxSize = 48 * RES;        // 192px effective font
    const pad = 14 * RES;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = `bold ${pxSize}px Rajdhani, sans-serif`;
    ctx.font = font;

    const metrics = ctx.measureText(text);
    const rawW = Math.ceil(metrics.width) + pad * 2;
    const rawH = pxSize + pad * 2;

    // Power-of-two dimensions for optimal mipmap quality
    canvas.width = nextPOT(rawW);
    canvas.height = nextPOT(rawH);

    // Re-set after resize
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw centered in the POT canvas
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Dark outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 6 * RES;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy);

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, cy);

    // ── Texture ─────────────────────────────────────────────────────────────
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    // Scale using the actual text area ratio (not the padded POT canvas)
    const aspect = rawW / rawH;
    sprite.scale.set(worldScale * aspect, worldScale, 1);

    return sprite;
}
