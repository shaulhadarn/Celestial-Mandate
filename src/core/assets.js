/* Updated: Upgraded glow textures to 512px with smooth power-curve falloff and separate soft halo texture */
import * as THREE from 'three';
import {
    createTerranTexture, createContinentalTexture, createOceanTexture,
    createDesertTexture, createArcticTexture, createBarrenTexture,
    createMoltenTexture, createGasGiantTexture, createTombTexture
} from './planet_textures.js';

export const textures = {};
export const sounds = {};
let audioCtx;

export function loadAssets() {
    textures.glow = createGlowTexture();
    textures.glowSoft = createSoftHaloTexture();

    // Procedural equirectangular planet textures (seamless spherical mapping)
    textures.terran = createTerranTexture();
    textures.continental = createContinentalTexture();
    textures.ocean = createOceanTexture();
    textures.desert = createDesertTexture();
    textures.arctic = createArcticTexture();
    textures.barren = createBarrenTexture();
    textures.molten = createMoltenTexture();
    textures.gas = createGasGiantTexture();
    textures.tomb = createTombTexture();

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

// --- Background Music (2-track crossfade playlist) ---
const TRACKS = [
    encodeURI('assets/Shaul Hadar - Time To Profit Demo.mp3'),
    encodeURI('assets/9.Counter Point - Master of Epic.mp3'),
];
const FADE_DURATION = 2000; // ms
const MUSIC_VOLUME = 0.35;
let _currentAudio = null;
let _trackIndex = 0;
let _musicStarted = false;
let _userVolume = MUSIC_VOLUME;

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

async function _playTrack(index) {
    const audio = new Audio(TRACKS[index]);
    audio.loop = false;
    audio.volume = 0;
    _currentAudio = audio;
    _trackIndex = index;

    // When track ends, crossfade to next
    audio.addEventListener('ended', () => {
        _advanceTrack();
    });

    _playWithRetry(audio);
    await _fadeAudio(audio, 0, _userVolume);
}

async function _advanceTrack() {
    const old = _currentAudio;
    const nextIndex = (_trackIndex + 1) % TRACKS.length;

    // Fade out current
    if (old) {
        await _fadeAudio(old, old.volume, 0);
        old.pause();
        old.src = '';
    }

    // Play next
    await _playTrack(nextIndex);
}

export function startMenuMusic() {
    if (_musicStarted) return;
    _musicStarted = true;
    try {
        _playTrack(0);
    } catch (e) {
        console.warn('Music init failed (non-fatal):', e);
    }
}

export function startMusic() {
    // No-op — music is already running from startMenuMusic and will keep cycling
    if (_musicStarted) return;
    // Fallback if startMenuMusic was never called
    _musicStarted = true;
    try {
        _playTrack(0);
    } catch (e) {
        console.warn('Music init failed (non-fatal):', e);
    }
}

export function setMusicVolume(vol) {
    _userVolume = Math.max(0, Math.min(1, vol));
    if (_currentAudio) _currentAudio.volume = _userVolume;
}