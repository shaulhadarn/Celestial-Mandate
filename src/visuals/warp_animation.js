/**
 * Warp Drive Animation
 * Cinematic full-screen canvas overlay: stars stretch into chromatic streaks,
 * tunnel walls close in, a blinding flash whites out, then gently dissolves
 * to reveal the destination system beneath.
 *
 * Performance: DPR capped to 1 (motion blur hides pixels), onPrepare fires
 * during the first painted frame while canvas is solid black so the heavy
 * scene-creation work never causes a visible stutter.
 */

const STAR_COUNT = 800;
const WARP_MS    = 3200;
const DISSOLVE_MS = 2400;

// Phase boundaries within the warp portion (normalised to WARP_MS)
const P_IDLE    = 0.07;
const P_ENGAGE  = 0.16;
const P_WARP    = 0.60;
const P_FLASH   = 0.78;
const P_PEAK    = 1.0;

function easeOutQuint(x) { return 1 - Math.pow(1 - x, 5); }
function easeInCubic(x) { return x * x * x; }

/**
 * @param {Object}   opts
 * @param {Function} opts.onPrepare  Called while overlay is opaque black (load scene).
 * @param {Function} opts.onFlash    Called at peak flash (dissolve about to start).
 * @returns {Promise} Resolves when overlay is fully gone.
 */
export function playWarpAnimation({ onPrepare, onFlash } = {}) {
    const canvas = document.createElement('canvas');
    canvas.id = 'warp-canvas';
    canvas.style.cssText =
        'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
        'z-index:99999;pointer-events:none;';
    document.body.appendChild(canvas);

    // DPR 1 — the warp effect is all motion blur and glow; retina adds cost, not quality
    let w, h, cx, cy, diag;

    function resize() {
        w = canvas.width  = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w * 0.5;
        cy = h * 0.5;
        diag = Math.sqrt(cx * cx + cy * cy);
    }
    resize();

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#010308';
    ctx.fillRect(0, 0, w, h);
    window.addEventListener('resize', resize);

    // Pre-allocate star pool
    const stars = new Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) stars[i] = makeStar({});

    function makeStar(s) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.pow(Math.random(), 0.6) * 0.35 + 0.005;
        s.x = Math.cos(a) * d;
        s.y = Math.sin(a) * d;
        s.z = 0.4 + Math.random() * 0.8;
        s.bri = 0.35 + Math.random() * 0.65;
        s.prevX = s.x;
        s.prevY = s.y;
        if (Math.random() < 0.12) {
            s.r = 1.0; s.g = 0.78 + Math.random() * 0.15; s.b = 0.55 + Math.random() * 0.2;
        } else {
            s.r = 0.72 + Math.random() * 0.28;
            s.g = 0.78 + Math.random() * 0.22;
            s.b = 0.88 + Math.random() * 0.12;
        }
        return s;
    }

    return new Promise(resolve => {
        let flashFired = false;

        // ── First rAF: the browser has painted the black canvas overlay. ──
        // Fire onPrepare NOW while the screen is solid black — the heavy
        // scene-creation work blocks the main thread for ~30-100ms but the
        // user only sees black. Timer starts AFTER onPrepare returns, so
        // the warp animation plays from t=0 with zero stutter.
        requestAnimationFrame(() => {
            if (onPrepare) onPrepare();

            const t0 = performance.now();

            function frame(now) {
                const elapsed = now - t0;

                // ── DISSOLVE PHASE ──────────────────────────────────────
                if (elapsed >= WARP_MS) {
                    const u = Math.min((elapsed - WARP_MS) / DISSOLVE_MS, 1.0);
                    // easeInCubic: holds white longer, then accelerates fade
                    // → cinematic "flash holds… then gently reveals"
                    const alpha = 1 - easeInCubic(u);

                    if (!flashFired) {
                        flashFired = true;
                        if (onFlash) onFlash();
                    }

                    ctx.clearRect(0, 0, w, h);
                    if (alpha > 0.002) {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.fillStyle = 'rgba(230,242,255,' + alpha + ')';
                        ctx.fillRect(0, 0, w, h);
                    }

                    if (u < 1.0) {
                        requestAnimationFrame(frame);
                    } else {
                        window.removeEventListener('resize', resize);
                        canvas.remove();
                        resolve();
                    }
                    return;
                }

                // ── WARP PHASE ──────────────────────────────────────────
                const t = elapsed / WARP_MS;

                // Background trail
                ctx.globalCompositeOperation = 'source-over';
                if (t < P_ENGAGE) {
                    ctx.fillStyle = 'rgba(1,3,8,0.45)';
                } else if (t < P_FLASH) {
                    const trailKeep = 0.06 + (1 - (t - P_ENGAGE) / (P_FLASH - P_ENGAGE)) * 0.18;
                    ctx.fillStyle = 'rgba(1,3,8,' + trailKeep + ')';
                } else {
                    ctx.fillStyle = 'rgba(1,3,8,0.55)';
                }
                ctx.fillRect(0, 0, w, h);

                // Speed curve
                let speed;
                if (t < P_IDLE) {
                    speed = 0.0015;
                } else if (t < P_ENGAGE) {
                    const u = (t - P_IDLE) / (P_ENGAGE - P_IDLE);
                    speed = 0.0015 + u * u * 0.012;
                } else if (t < P_WARP) {
                    const u = (t - P_ENGAGE) / (P_WARP - P_ENGAGE);
                    speed = 0.014 + u * u * u * 0.26;
                } else if (t < P_FLASH) {
                    speed = 0.28 + ((t - P_WARP) / (P_FLASH - P_WARP)) * 0.18;
                } else {
                    speed = 0.46;
                }

                const streakMul = speed < 0.008 ? 1.0 : 1.0 + speed * 50;

                // ── Stars ───────────────────────────────────────────────
                ctx.globalCompositeOperation = 'lighter';

                for (let i = 0; i < STAR_COUNT; i++) {
                    const s = stars[i];
                    s.prevX = s.x;
                    s.prevY = s.y;

                    const dist = Math.sqrt(s.x * s.x + s.y * s.y) || 0.001;
                    const nx = s.x / dist;
                    const ny = s.y / dist;
                    s.x += nx * speed * (0.4 + dist * 2.5) * s.z;
                    s.y += ny * speed * (0.4 + dist * 2.5) * s.z;

                    const sx  = cx + s.x * w;
                    const sy  = cy + s.y * h;
                    const spx = cx + s.prevX * w;
                    const spy = cy + s.prevY * h;

                    if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) {
                        makeStar(s);
                        continue;
                    }

                    const bri = Math.min(s.bri * (0.5 + speed * 5), 1.0);
                    const r = s.r * bri * 255 | 0;
                    const g = s.g * bri * 255 | 0;
                    const b = s.b * bri * 255 | 0;

                    if (streakMul > 1.5) {
                        const dx = sx - spx;
                        const dy = sy - spy;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const tail = Math.min(len * streakMul, dist * w * 0.9);
                        const ux = dx / len;
                        const uy = dy / len;
                        const lw = Math.min((0.4 + speed * 5) * s.z, 6);

                        // Chromatic fringe at high speed
                        if (speed > 0.1) {
                            const fringe = lw * 0.6;
                            ctx.beginPath();
                            ctx.moveTo(sx - ux * tail + uy * fringe, sy - uy * tail - ux * fringe);
                            ctx.lineTo(sx + uy * fringe, sy - ux * fringe);
                            ctx.strokeStyle = 'rgba(255,' + (g * 0.5 | 0) + ',' + (b * 0.3 | 0) + ',' + (bri * 0.25) + ')';
                            ctx.lineWidth = lw * 0.5;
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(sx - ux * tail - uy * fringe, sy - uy * tail + ux * fringe);
                            ctx.lineTo(sx - uy * fringe, sy + ux * fringe);
                            ctx.strokeStyle = 'rgba(' + (r * 0.3 | 0) + ',' + (g * 0.5 | 0) + ',255,' + (bri * 0.25) + ')';
                            ctx.lineWidth = lw * 0.5;
                            ctx.stroke();
                        }

                        // Main streak
                        ctx.beginPath();
                        ctx.moveTo(sx - ux * tail, sy - uy * tail);
                        ctx.lineTo(sx, sy);
                        ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (bri * 0.85) + ')';
                        ctx.lineWidth = lw;
                        ctx.stroke();

                        // Bright head
                        if (speed > 0.03) {
                            ctx.beginPath();
                            ctx.arc(sx, sy, lw * 0.7, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(' + Math.min(r + 80, 255) + ',' + Math.min(g + 80, 255) + ',255,' + bri + ')';
                            ctx.fill();
                        }
                    } else {
                        const rad = 0.8 + s.z * 1.8;
                        ctx.beginPath();
                        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (bri * 0.8) + ')';
                        ctx.fill();
                    }
                }

                // ── Tunnel vignette ─────────────────────────────────────
                if (t > P_ENGAGE) {
                    const u = Math.min((t - P_ENGAGE) / (P_FLASH - P_ENGAGE), 1);
                    ctx.globalCompositeOperation = 'source-over';
                    const innerR = diag * (0.55 - u * 0.25);
                    const outerR = diag * 0.85;
                    const vig = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
                    vig.addColorStop(0, 'rgba(0,0,0,0)');
                    vig.addColorStop(1, 'rgba(0,2,12,' + (0.3 + u * 0.5) + ')');
                    ctx.fillStyle = vig;
                    ctx.fillRect(0, 0, w, h);
                }

                // ── Central engine glow ─────────────────────────────────
                if (t > P_IDLE) {
                    const u = Math.min((t - P_IDLE) / (P_FLASH - P_IDLE), 1);
                    const radius = 20 + u * u * diag * 0.22;
                    const alpha = u * u * 0.35;
                    ctx.globalCompositeOperation = 'lighter';
                    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                    grad.addColorStop(0, 'rgba(200,230,255,' + alpha + ')');
                    grad.addColorStop(0.3, 'rgba(80,180,255,' + (alpha * 0.5) + ')');
                    grad.addColorStop(1, 'rgba(0,40,100,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, w, h);
                }

                // ── Flash build-up ──────────────────────────────────────
                if (t >= P_FLASH) {
                    const u = (t - P_FLASH) / (P_PEAK - P_FLASH);
                    const a = Math.pow(Math.min(u, 1), 2);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = 'rgba(230,242,255,' + a + ')';
                    ctx.fillRect(0, 0, w, h);
                }

                requestAnimationFrame(frame);
            }

            requestAnimationFrame(frame);
        });
    });
}
