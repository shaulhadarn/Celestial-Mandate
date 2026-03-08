/**
 * Warp Drive Animation
 * Full-screen canvas overlay that renders a starfield warp tunnel effect.
 * Stars accelerate from center outward into radial streaks, ending in a bright flash.
 */

const STAR_COUNT = 600;
const DURATION_MS = 2800;

// Phases (normalized 0–1)
const PHASE_DRIFT = 0.15;    // gentle drift
const PHASE_ACCEL = 0.55;    // warp acceleration
const PHASE_PEAK  = 0.80;    // full warp speed
// 0.80–1.0 = flash & fade out

export function playWarpAnimation() {
    return new Promise(resolve => {
        const canvas = document.createElement('canvas');
        canvas.id = 'warp-canvas';
        canvas.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: 99999; pointer-events: none;
        `;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let w, h, cx, cy;

        function resize() {
            w = canvas.width = window.innerWidth * window.devicePixelRatio;
            h = canvas.height = window.innerHeight * window.devicePixelRatio;
            cx = w / 2;
            cy = h / 2;
        }
        resize();
        window.addEventListener('resize', resize);

        // Initialize stars with random positions in a circular field
        const stars = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push(resetStar({}));
        }

        function resetStar(s) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 0.3 + 0.01; // normalized distance from center
            s.x = Math.cos(angle) * dist;
            s.y = Math.sin(angle) * dist;
            s.z = Math.random() * 1.0 + 0.5;
            s.brightness = 0.4 + Math.random() * 0.6;
            // Slight color variation: white to blue-white
            const blue = 0.7 + Math.random() * 0.3;
            s.r = 0.7 + Math.random() * 0.3;
            s.g = 0.75 + Math.random() * 0.25;
            s.b = blue;
            s.prevX = s.x;
            s.prevY = s.y;
            return s;
        }

        const startTime = performance.now();
        let animId;

        function frame(now) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / DURATION_MS, 1.0);

            ctx.globalCompositeOperation = 'source-over';
            // Slight trail: darken previous frame instead of full clear
            const trailAlpha = t < PHASE_DRIFT ? 0.4 : 0.12 + (1 - t) * 0.15;
            ctx.fillStyle = `rgba(0, 2, 8, ${trailAlpha})`;
            ctx.fillRect(0, 0, w, h);

            // Speed curve: slow drift → exponential acceleration → peak
            let speed;
            if (t < PHASE_DRIFT) {
                speed = 0.002 + t / PHASE_DRIFT * 0.008;
            } else if (t < PHASE_ACCEL) {
                const at = (t - PHASE_DRIFT) / (PHASE_ACCEL - PHASE_DRIFT);
                speed = 0.01 + at * at * at * 0.15;
            } else if (t < PHASE_PEAK) {
                const pt = (t - PHASE_ACCEL) / (PHASE_PEAK - PHASE_ACCEL);
                speed = 0.16 + pt * 0.25;
            } else {
                speed = 0.41;
            }

            // Streak length scales with speed
            const streakMul = t < PHASE_DRIFT ? 1.0 : 1.0 + speed * 40;

            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < stars.length; i++) {
                const s = stars[i];
                s.prevX = s.x;
                s.prevY = s.y;

                // Move radially outward
                const dist = Math.sqrt(s.x * s.x + s.y * s.y) || 0.001;
                const nx = s.x / dist;
                const ny = s.y / dist;
                const moveSpeed = speed * (0.5 + dist * 2.0) * s.z;
                s.x += nx * moveSpeed;
                s.y += ny * moveSpeed;

                // Screen coordinates
                const sx = cx + s.x * w;
                const sy = cy + s.y * h;
                const spx = cx + s.prevX * w;
                const spy = cy + s.prevY * h;

                // Off screen? Reset
                if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
                    resetStar(s);
                    continue;
                }

                // Brightness increases during warp
                const bri = Math.min(s.brightness * (0.6 + speed * 4), 1.0);
                const r = Math.round(s.r * bri * 255);
                const g = Math.round(s.g * bri * 255);
                const b = Math.round(s.b * bri * 255);

                if (streakMul > 1.5) {
                    // Draw streak line
                    const dx = sx - spx;
                    const dy = sy - spy;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const streakLen = Math.min(len * streakMul, dist * w * 0.8);
                    const endX = sx - (dx / (len || 1)) * streakLen;
                    const endY = sy - (dy / (len || 1)) * streakLen;

                    const lineWidth = (0.5 + speed * 4) * s.z;
                    ctx.beginPath();
                    ctx.moveTo(endX, endY);
                    ctx.lineTo(sx, sy);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${bri * 0.9})`;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();

                    // Bright head
                    if (speed > 0.05) {
                        ctx.beginPath();
                        ctx.arc(sx, sy, lineWidth * 0.8, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(${Math.min(r + 60, 255)}, ${Math.min(g + 60, 255)}, 255, ${bri})`;
                        ctx.fill();
                    }
                } else {
                    // Draw dot
                    const radius = 1.0 + s.z * 1.5;
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bri})`;
                    ctx.fill();
                }
            }

            // Center glow during warp (engine core)
            if (t > PHASE_DRIFT) {
                const glowT = (t - PHASE_DRIFT) / (1 - PHASE_DRIFT);
                const glowRadius = 30 + glowT * glowT * Math.min(w, h) * 0.15;
                const glowAlpha = glowT * glowT * 0.3;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
                gradient.addColorStop(0, `rgba(180, 220, 255, ${glowAlpha})`);
                gradient.addColorStop(0.4, `rgba(80, 160, 255, ${glowAlpha * 0.5})`);
                gradient.addColorStop(1, 'rgba(0, 40, 80, 0)');
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, w, h);
            }

            // Vignette tunnel effect
            if (t > PHASE_ACCEL) {
                const vigT = (t - PHASE_ACCEL) / (1 - PHASE_ACCEL);
                ctx.globalCompositeOperation = 'source-over';
                const vigGrad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.15, cx, cy, Math.min(w, h) * 0.7);
                vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                vigGrad.addColorStop(1, `rgba(0, 2, 10, ${vigT * 0.6})`);
                ctx.fillStyle = vigGrad;
                ctx.fillRect(0, 0, w, h);
            }

            // Final flash
            if (t > PHASE_PEAK) {
                const flashT = (t - PHASE_PEAK) / (1 - PHASE_PEAK);
                const flashAlpha = Math.pow(flashT, 2.5);
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = `rgba(220, 240, 255, ${flashAlpha})`;
                ctx.fillRect(0, 0, w, h);
            }

            if (t < 1.0) {
                animId = requestAnimationFrame(frame);
            } else {
                // Hold white briefly then clean up
                window.removeEventListener('resize', resize);
                // Fade out the canvas
                canvas.style.transition = 'opacity 0.5s ease';
                canvas.style.opacity = '0';
                setTimeout(() => {
                    canvas.remove();
                    resolve();
                }, 500);
            }
        }

        // Start with black canvas
        ctx.fillStyle = '#000208';
        ctx.fillRect(0, 0, w, h);

        animId = requestAnimationFrame(frame);
    });
}
