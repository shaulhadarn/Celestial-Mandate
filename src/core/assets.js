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

    textures.pirateHull = createPirateHullTexture();

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

function createPirateHullTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base dark metallic hull
    ctx.fillStyle = '#0f1114';
    ctx.fillRect(0, 0, 512, 512);

    // Armor panels — darker greys with slight variation
    for (let i = 0; i < 70; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const w = Math.random() * 100 + 30;
        const h = Math.random() * 100 + 30;
        const brightness = 14 + Math.random() * 18;
        ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${Math.floor(brightness * 0.9)})`;
        ctx.fillRect(x, y, w, h);

        // Panel gaps
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);

        // Inner tech lines
        if (Math.random() > 0.6) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.fillRect(x + 4, y + 4, w - 8, 1);
        }
    }

    // Red war paint streaks — irregular slashes
    for (let i = 0; i < 18; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const len = 20 + Math.random() * 80;
        const angle = Math.random() * Math.PI;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(${180 + Math.floor(Math.random() * 75)}, ${Math.floor(Math.random() * 30)}, 0, ${0.15 + Math.random() * 0.25})`;
        ctx.fillRect(-len / 2, -2, len, 3 + Math.random() * 4);
        ctx.restore();
    }

    // Battle scars / gouges
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 1 + Math.random() * 5;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.3 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        // Bright scratch rim
        ctx.strokeStyle = `rgba(80, 80, 80, ${0.2 + Math.random() * 0.2})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(x - 0.5, y - 0.5, r + 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Red glow accents — pulsing light strips
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const w = 40 + Math.random() * 100;
        ctx.fillStyle = `rgba(255, 40, 0, ${0.08 + Math.random() * 0.12})`;
        ctx.fillRect(x, y, w, 2);
    }

    // Rivets and bolt details
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
    }

    // Structural grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 12; i++) {
        const x = (i / 12) * 512;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
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