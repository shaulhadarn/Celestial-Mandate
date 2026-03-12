/**
 * Exploration drone mesh and blob shadow sprite.
 * Upgraded: multi-layer hull, panelled armor, layered glow (no square glare),
 * detailed repulsors, sensor arrays, antenna. Mobile-optimised paths retained.
 */
import * as THREE from 'three';
import { textures } from '../core/assets.js';
import { isMobile as isMobileDevice } from '../core/device.js';

// ── Shared materials (created once) ─────────────────────────────────────────

let _hullMat, _frameMat, _trimMat, _glassMat, _padMat, _glowMat;

function _initMaterials() {
    if (_hullMat) return;

    _hullMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0x1a1a22 })
        : new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.15, metalness: 0.92 });

    _frameMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0x0d0d12 })
        : new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.2, metalness: 0.95 });

    _trimMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0x334455 })
        : new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.3, metalness: 0.8 });

    _glassMat = new THREE.MeshStandardMaterial({
        color: 0xbbddee, roughness: 0.05, metalness: 0.6,
        transparent: true, opacity: 0.7,
    });

    _padMat = isMobileDevice
        ? new THREE.MeshLambertMaterial({ color: 0x0a0a0a })
        : new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4, metalness: 0.85 });

    _glowMat = new THREE.MeshBasicMaterial({
        color: 0x00f2ff, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide
    });
}

// ── Drone mesh ──────────────────────────────────────────────────────────────

export function createDroneMesh() {
    _initMaterials();
    const seg = isMobileDevice ? 1 : 2;
    const segH = isMobileDevice ? 8 : 16;
    const shipGroup = new THREE.Group();

    // ── Core chassis (dark octahedron) ──
    const chassis = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.1, seg),
        _frameMat
    );
    chassis.position.y = 2;
    chassis.castShadow = !isMobileDevice;
    shipGroup.add(chassis);

    // ── Upper dome (polished shell) ──
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.45, segH, segH, 0, Math.PI * 2, 0, Math.PI / 2),
        _hullMat
    );
    dome.position.y = 2.05;
    dome.castShadow = !isMobileDevice;
    shipGroup.add(dome);

    // ── Dome trim ring ──
    const trimRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.06, 6, isMobileDevice ? 12 : 24),
        _trimMat
    );
    trimRing.position.y = 2.05;
    trimRing.rotation.x = Math.PI / 2;
    shipGroup.add(trimRing);

    // ── Lower hull plate (belly pan) ──
    const bellyGeo = new THREE.CylinderGeometry(1.1, 0.8, 0.4, isMobileDevice ? 8 : 16);
    const belly = new THREE.Mesh(bellyGeo, _frameMat);
    belly.position.y = 1.5;
    belly.castShadow = !isMobileDevice;
    shipGroup.add(belly);

    // ── Sensor eye (glass dome + emissive iris) ──
    const eyeHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.36, 0.15, segH),
        _trimMat
    );
    eyeHousing.position.set(0, 2.25, 1.2);
    eyeHousing.rotation.x = Math.PI / 2;
    shipGroup.add(eyeHousing);

    const eyeLens = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, segH, segH),
        _glassMat
    );
    eyeLens.position.set(0, 2.25, 1.28);
    shipGroup.add(eyeLens);

    const eyeIris = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00f2ff })
    );
    eyeIris.position.set(0, 2.25, 1.35);
    shipGroup.add(eyeIris);

    // ── Side sensor bumps (2) ──
    [-1, 1].forEach(side => {
        const bump = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 6, 6),
            _trimMat
        );
        bump.position.set(side * 1.25, 2.2, 0);
        shipGroup.add(bump);

        const bumpLens = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0x00f2ff })
        );
        bumpLens.position.set(side * 1.35, 2.2, 0);
        shipGroup.add(bumpLens);
    });

    // ── Top antenna ──
    const antennaBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.2, 6),
        _frameMat
    );
    antennaBase.position.y = 3.4;
    shipGroup.add(antennaBase);

    const antennaMast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
        _trimMat
    );
    antennaMast.position.y = 3.75;
    shipGroup.add(antennaMast);

    const antennaTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 1 })
    );
    antennaTip.position.y = 4.02;
    antennaTip.userData.antennaBlink = true;
    shipGroup.add(antennaTip);

    // ── Rear vent grille ──
    const ventGrille = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.3, 0.08),
        new THREE.MeshStandardMaterial({
            color: 0x111111, roughness: 0.9, metalness: 0.3,
        })
    );
    ventGrille.position.set(0, 2.0, -1.3);
    shipGroup.add(ventGrille);

    // Vent glow behind grille
    const ventGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.2),
        new THREE.MeshBasicMaterial({
            color: 0x00aaff, transparent: true, opacity: 0.3,
            side: THREE.DoubleSide
        })
    );
    ventGlow.position.set(0, 2.0, -1.34);
    shipGroup.add(ventGlow);

    // ── 4 Repulsor pads (detailed) ──
    for (let i = 0; i < 4; i++) {
        const padContainer = new THREE.Group();
        const angle = (i / 4) * Math.PI * 2;
        padContainer.rotation.y = angle;

        // Strut arm connecting hull to pad
        const strut = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.12, 0.7),
            _frameMat
        );
        strut.position.set(0, 1.5, 1.1);
        padContainer.add(strut);

        // Pad body
        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.45, 0.22, isMobileDevice ? 8 : 16),
            _padMat
        );
        pad.position.set(0, 1.35, 1.4);
        pad.rotation.x = Math.PI / 6;
        pad.castShadow = true;
        padContainer.add(pad);

        // Pad inner ring (accent)
        const innerRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.35, 0.03, 4, isMobileDevice ? 8 : 12),
            _trimMat
        );
        innerRing.position.set(0, 1.35, 1.4);
        innerRing.rotation.x = Math.PI / 2 + Math.PI / 6;
        padContainer.add(innerRing);

        // Glow disc (circle geometry, not a sprite — no square artifact)
        const padGlow = new THREE.Mesh(
            new THREE.CircleGeometry(0.38, isMobileDevice ? 8 : 16),
            _glowMat
        );
        padGlow.position.set(0, 1.22, 1.48);
        padGlow.rotation.x = Math.PI / 2 + Math.PI / 6;
        padContainer.add(padGlow);

        shipGroup.add(padContainer);
    }

    // ── Engine light ──
    const engineLight = new THREE.PointLight(
        0x00f2ff, isMobileDevice ? 5 : 8, isMobileDevice ? 8 : 12
    );
    engineLight.position.set(0, 0.5, 0);
    shipGroup.add(engineLight);

    // ── Layered engine flare (replaces single square sprite) ──
    // Core: small bright sprite
    const coreFlare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glow,
        color: 0x88ffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }));
    coreFlare.scale.set(1.8, 1.8, 1);
    coreFlare.position.y = 0.6;
    shipGroup.add(coreFlare);

    // Halo: larger soft sprite (uses glowSoft = no hard edge)
    const haloFlare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: textures.glowSoft || textures.glow,
        color: 0x00ccff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.35,
    }));
    haloFlare.scale.set(4.5, 4.5, 1);
    haloFlare.position.y = 0.5;
    shipGroup.add(haloFlare);

    // Store both as a composite flare for the update loop
    shipGroup.userData.flare = coreFlare;
    shipGroup.userData.haloFlare = haloFlare;

    // ── Spotlight (headlight) ──
    const spotLight = new THREE.SpotLight(0xffffff, isMobileDevice ? 12 : 20);
    spotLight.position.set(0, 5, 0);
    spotLight.target.position.set(0, 0, -10);
    spotLight.angle = 0.5;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = !isMobileDevice;
    if (!isMobileDevice) {
        spotLight.shadow.mapSize.set(512, 512);
        spotLight.shadow.camera.near = 1;
        spotLight.shadow.camera.far = 30;
    }
    shipGroup.add(spotLight);
    shipGroup.add(spotLight.target);

    // ── Engine trail particle pool ──
    const TRAIL_COUNT = isMobileDevice ? 12 : 24;
    const trails = [];
    for (let i = 0; i < TRAIL_COUNT; i++) {
        const mat = new THREE.SpriteMaterial({
            map: textures.glow,
            color: 0x00f2ff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.visible = false;
        sprite.scale.set(0.3, 0.3, 0.3);
        trails.push({
            sprite,
            life: 0,
            maxLife: 0.6 + Math.random() * 0.3,
            velocity: new THREE.Vector3(),
            padIndex: i % 4,
        });
    }
    shipGroup.userData.engineTrails = trails;
    shipGroup.userData.trailTimer = 0;

    return shipGroup;
}

// ── Blob shadow sprite ──────────────────────────────────────────────────────

export function createShadowSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,0.6)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(3.0, 3.0);
    const shadowMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.85,
        depthWrite: false, depthTest: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const mesh = new THREE.Mesh(shadowGeo, shadowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
}
