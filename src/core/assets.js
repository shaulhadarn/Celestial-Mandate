/* Updated: Upgraded glow textures to 512px with smooth power-curve falloff and separate soft halo texture */
import * as THREE from 'three';

export const textures = {};
export const sounds = {};
let audioCtx;

export function loadAssets() {
    const texLoader = new THREE.TextureLoader();
    textures.glow = createGlowTexture();
    textures.glowSoft = createSoftHaloTexture();
    textures.terran = texLoader.load('assets/planet_terran.png');
    textures.gas = texLoader.load('assets/planet_gas.png');
    textures.barren = texLoader.load('assets/planet_barren.png');

    // Mark all shared textures so disposeGroup() skips them during cleanup
    for (const tex of Object.values(textures)) {
        if (tex && tex.isTexture) tex.userData.shared = true;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    loadSound('hover', 'assets/ui_hover.mp3');
    loadSound('select', 'assets/ui_select.mp3');
    loadSound('bgm', 'assets/bgm_ambient.mp3');
}

function createGlowTexture() {
    // 512px for high-res crisp core glow with smooth power-curve falloff
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const cx = SIZE / 2;

    // Paint pixel-by-pixel alpha using a power curve so the edge fades
    // smoothly to zero with no visible hard ring
    const imageData = ctx.createImageData(SIZE, SIZE);
    const data = imageData.data;
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dx = (x - cx) / cx;
            const dy = (y - cx) / cx;
            const dist = Math.sqrt(dx * dx + dy * dy); // 0 = center, 1 = edge
            if (dist >= 1.0) continue;
            // Power-curve: bright tight core, very gradual soft falloff
            const t = 1.0 - dist;
            const alpha = Math.pow(t, 1.8) * 255;
            const idx = (y * SIZE + x) * 4;
            data[idx]     = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = Math.round(alpha);
        }
    }
    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

// Separate soft halo texture — very wide, extremely gradual falloff
// Used for the outer diffuse ring that was showing the hard pixelated edge
function createSoftHaloTexture() {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const cx = SIZE / 2;

    const imageData = ctx.createImageData(SIZE, SIZE);
    const data = imageData.data;
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dx = (x - cx) / cx;
            const dy = (y - cx) / cx;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= 1.0) continue;
            // Very high power = almost zero in center, peak at ~0.3 radius, fades to 0 at edge
            // This creates a soft diffuse ring with no hard boundary
            const t = 1.0 - dist;
            // Gaussian-like: peak brightness in the mid-ring, zero at center and edge
            const ring = Math.pow(t, 3.5) * (1.0 - Math.pow(t, 0.4));
            const alpha = Math.max(0, ring) * 180;
            const idx = (y * SIZE + x) * 4;
            data[idx]     = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = Math.round(alpha);
        }
    }
    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
}

async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        sounds[name] = await audioCtx.decodeAudioData(buffer);
    } catch (e) {
        console.warn('Audio load failed', e);
    }
}

export function playSound(name) {
    if (!sounds[name] || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const source = audioCtx.createBufferSource();
    source.buffer = sounds[name];
    source.connect(audioCtx.destination);
    source.start(0);
}

// --- Background Music ---
let musicElement = null;
let menuMusicElement = null;
const FADE_DURATION = 1500; // ms for fade in/out
const GAME_VOLUME = 0.35;
const MENU_VOLUME = 0.30;

function _fadeAudio(audio, fromVol, toVol, duration = FADE_DURATION) {
    return new Promise(resolve => {
        if (!audio) { resolve(); return; }
        const steps = 30;
        const stepTime = duration / steps;
        const volStep = (toVol - fromVol) / steps;
        let current = 0;
        audio.volume = Math.max(0, Math.min(1, fromVol));
        const interval = setInterval(() => {
            current++;
            audio.volume = Math.max(0, Math.min(1, fromVol + volStep * current));
            if (current >= steps) {
                clearInterval(interval);
                audio.volume = Math.max(0, Math.min(1, toVol));
                resolve();
            }
        }, stepTime);
    });
}

function _playWithRetry(audio) {
    audio.play().catch(() => {
        const resume = () => { if (audio) audio.play().catch(() => {}); };
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('touchstart', resume, { once: true });
    });
}

export function startMenuMusic() {
    try {
        if (menuMusicElement) return;
        menuMusicElement = new Audio(encodeURI('assets/Shaul Hadar - Time To Profit Demo.mp3'));
        menuMusicElement.loop = true;
        menuMusicElement.volume = 0;
        _playWithRetry(menuMusicElement);
        _fadeAudio(menuMusicElement, 0, MENU_VOLUME);
    } catch (e) {
        console.warn('Menu music init failed (non-fatal):', e);
        menuMusicElement = null;
    }
}

export async function startMusic() {
    try {
        if (musicElement) return;

        // Fade out menu music first
        if (menuMusicElement) {
            await _fadeAudio(menuMusicElement, menuMusicElement.volume, 0);
            menuMusicElement.pause();
            menuMusicElement.src = '';
            menuMusicElement = null;
        }

        musicElement = new Audio(encodeURI('assets/9.Counter Point - Master of Epic.mp3'));
        musicElement.loop = true;
        musicElement.volume = 0;
        _playWithRetry(musicElement);
        _fadeAudio(musicElement, 0, GAME_VOLUME);
    } catch (e) {
        console.warn('Music init failed (non-fatal):', e);
        musicElement = null;
    }
}

export function setMusicVolume(vol) {
    if (musicElement) musicElement.volume = Math.max(0, Math.min(1, vol));
}