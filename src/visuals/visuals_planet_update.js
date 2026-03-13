/**
 * Per-frame physics, animation, and game logic for planet exploration.
 * Optimized: pre-allocated vectors, cached velocity.length(), cached DOM refs.
 */
import * as THREE from 'three';
import { gameState, HARVESTER_YIELDS, HARVESTER_YIELD_DEFAULT } from '../core/state.js';
import { getTerrainHeight, getTerrainHeightFast } from './visuals_planet_terrain.js';
import { harvesterGroups, soldierMeshes, hubGroup, buildingAnims, renderColonyGroundBuildings } from './visuals_planet_colony.js';
import { getOrCreateHarvesterHUD } from './visuals_planet_hud.js';
import planetState, { CAMERA_HEIGHT_OFFSET } from './visuals_planet_state.js';
import { updateGrass } from './visuals_planet_grass.js';

// ── Pre-allocated reusable vectors (never GC'd) ─────────────────────────────
const _cameraOffset = new THREE.Vector3(0, 0, 0); // dynamic, updated per frame
const _droneCenter  = new THREE.Vector3();
const _finalCenter  = new THREE.Vector3();
const _forward      = new THREE.Vector3();
const _right        = new THREE.Vector3();
const _inputDir     = new THREE.Vector3();
const _nextPos      = new THREE.Vector3();
const _flareTarget  = new THREE.Vector3();

// ── Cached DOM element ──────────────────────────────────────────────────────
let _coordsEl = null;

/** Call when planet changes to clear stale DOM caches. */
export function resetCachedDOM() {
    _coordsEl = null;
}

// ── Colony buildings helper ─────────────────────────────────────────────────

export function updateColonyBuildings() {
    if (!planetState.colonyBuildingsGroup || !planetState.currentPlanetData) return;
    renderColonyGroundBuildings(planetState.currentPlanetData.id, planetState.colonyBuildingsGroup, getTerrainHeight);
}

// ── Main per-frame update ───────────────────────────────────────────────────

export function updatePlanetPhysics(dt, camera, controls, group) {
    const { playerMesh, sunLight, dustMesh, creatures, planetProps,
            cameraYaw, cameraPitch, keyState, joystickInput } = planetState;

    if (!playerMesh || !camera) return;

    const controlTarget = planetState.controlTarget; // null = drone, mesh = soldier
    const followTarget = controlTarget || playerMesh;

    // --- 0. Smooth camera distance + height transitions ---
    const lerpRate = 3 * dt; // smooth ~0.2s transition
    planetState.cameraDistance += (planetState.targetCameraDistance - planetState.cameraDistance) * lerpRate;
    planetState.cameraHeightOffset += (planetState.targetCameraHeightOffset - planetState.cameraHeightOffset) * lerpRate;
    _cameraOffset.y = planetState.cameraHeightOffset;

    // --- 1. Camera Position (follows controlTarget or drone) ---
    _droneCenter.copy(followTarget.position).add(_cameraOffset);
    const sinYaw = Math.sin(cameraYaw);
    const cosYaw = Math.cos(cameraYaw);
    const sinPitch = Math.sin(cameraPitch);
    const cosPitch = Math.cos(cameraPitch);

    const useDist = planetState.cameraDistance;
    const camX = _droneCenter.x + useDist * sinYaw * cosPitch;
    let camY = _droneCenter.y + useDist * sinPitch;
    const camZ = _droneCenter.z + useDist * cosYaw * cosPitch;
    const camGroundH = getTerrainHeightFast(camX, camZ) + 1.5;
    if (camY < camGroundH) camY = camGroundH;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(_droneCenter);

    // --- 2. Movement Direction (derived from cameraYaw) ---
    _forward.set(-sinYaw, 0, -cosYaw);
    _right.set(cosYaw, 0, -sinYaw);
    _inputDir.set(0, 0, 0);

    if (keyState['w']) _inputDir.add(_forward);
    if (keyState['s']) _inputDir.sub(_forward);
    if (keyState['a']) _inputDir.sub(_right);
    if (keyState['d']) _inputDir.add(_right);
    if (Math.abs(joystickInput.x) > 0.1 || Math.abs(joystickInput.y) > 0.1) {
        _inputDir.x += _forward.x * joystickInput.y + _right.x * joystickInput.x;
        _inputDir.y += _forward.y * joystickInput.y + _right.y * joystickInput.x;
        _inputDir.z += _forward.z * joystickInput.y + _right.z * joystickInput.x;
    }

    if (controlTarget) {
        // --- 2b/3b. Soldier ground movement ---
        const soldierSpeed = 40;
        const soldierDrag = 0.88;
        const sVel = controlTarget.userData.velocity;

        if (_inputDir.lengthSq() > 0) {
            _inputDir.normalize();
            sVel.x += _inputDir.x * soldierSpeed * dt;
            sVel.z += _inputDir.z * soldierSpeed * dt;
        }

        // Jump (spacebar) — only when grounded
        const groundH = getTerrainHeightFast(controlTarget.position.x, controlTarget.position.z);
        const isGrounded = controlTarget.position.y <= groundH + 0.05;
        if (keyState[' '] && isGrounded) {
            sVel.y = 12; // jump impulse
        }

        // Gravity
        sVel.y -= 30 * dt;

        controlTarget.position.x += sVel.x * dt;
        controlTarget.position.z += sVel.z * dt;
        controlTarget.position.y += sVel.y * dt;

        // Ground collision
        const newGroundH = getTerrainHeightFast(controlTarget.position.x, controlTarget.position.z);
        if (controlTarget.position.y <= newGroundH) {
            controlTarget.position.y = newGroundH;
            sVel.y = 0;
        }

        sVel.x *= soldierDrag;
        sVel.z *= soldierDrag;

        const soldierSpd = Math.sqrt(sVel.x * sVel.x + sVel.z * sVel.z);

        // --- 4b. Soldier rotation (face walking direction) ---
        if (soldierSpd > 0.1) {
            const targetRot = Math.atan2(sVel.x, sVel.z);
            let diff = targetRot - controlTarget.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            controlTarget.rotation.y += diff * 12 * dt;
        }

        // --- Walk cycle animation for controlled soldier (joint-based) ---
        const ud = controlTarget.userData;
        const j = ud.joints;
        if (soldierSpd > 0.1) {
            ud.walkPhase = (ud.walkPhase || 0) + soldierSpd * dt * 6;
            const wp = ud.walkPhase;
            const walkSin = Math.sin(wp);
            const walkCos = Math.cos(wp);

            // Gentle vertical bob (subtle, no side-lean)
            controlTarget.position.y += Math.abs(walkSin) * 0.02;

            if (j) {
                // Hip swing (right leg forward when sin>0)
                j.rightLeg.rotation.x = walkSin * 0.6;
                j.leftLeg.rotation.x = -walkSin * 0.6;

                // Knee bend: bends when leg swings backward (lifting foot)
                j.rightKnee.rotation.x = Math.max(0, -walkSin) * 0.8;
                j.leftKnee.rotation.x = Math.max(0, walkSin) * 0.8;

                // Arms counter-swing (opposite to legs)
                j.rightArm.rotation.x = -walkSin * 0.25;
                j.leftArm.rotation.x = walkSin * 0.45;

                // Elbow bend: slight bend when arm swings back
                j.rightElbow.rotation.x = Math.max(0, walkSin) * 0.3 - 0.15;
                j.leftElbow.rotation.x = Math.max(0, -walkSin) * 0.3 - 0.15;

                // Head bob
                j.head.rotation.x = Math.sin(wp * 2) * 0.03;
            }
        } else {
            // Idle — breathing + relax joints
            const idleT = performance.now() * 0.001;
            controlTarget.rotation.z *= 0.8;

            if (j) {
                j.rightLeg.rotation.x *= 0.85;
                j.leftLeg.rotation.x *= 0.85;
                j.rightKnee.rotation.x *= 0.85;
                j.leftKnee.rotation.x *= 0.85;
                j.rightArm.rotation.x *= 0.85;
                j.leftArm.rotation.x *= 0.85;
                j.rightElbow.rotation.x = j.rightElbow.rotation.x * 0.85 - 0.05;
                j.leftElbow.rotation.x = j.leftElbow.rotation.x * 0.85 - 0.05;
                // Subtle arm sway
                j.rightArm.rotation.z = Math.sin(idleT * 1.5 + 1) * 0.02;
                j.leftArm.rotation.z = Math.sin(idleT * 1.5 - 1) * 0.02;
            }
        }
    }

    // Drone physics always run (drone hovers in place when soldier is controlled)
    const speed = 100;
    const drag = 0.92;
    const velocity = playerMesh.userData.velocity;

    // ── Ascent animation (orbit exit) — bypass normal physics ────────────
    if (planetState._ascending) {
        planetState._ascendProgress += dt;
        const p = planetState._ascendProgress;
        // Accelerating upward thrust, dampen horizontal drift
        velocity.x *= 0.92;
        velocity.z *= 0.92;
        const upSpeed = 60 + p * 120; // accelerates over time
        playerMesh.position.x += velocity.x * dt;
        playerMesh.position.z += velocity.z * dt;
        playerMesh.position.y += upSpeed * dt;
        // Tilt drone nose upward during ascent
        playerMesh.rotation.x = THREE.MathUtils.lerp(playerMesh.rotation.x, -0.5, 3 * dt);
        playerMesh.rotation.z *= 0.9;
        // Zoom camera out and pitch up for cinematic effect
        planetState.targetCameraDistance = 35 + p * 20;
        planetState.targetCameraHeightOffset = 2 + p * 6;
        // Skip normal input, gravity, terrain clamping
    } else {

    if (!controlTarget) {
        // Only accept input when controlling drone
        if (_inputDir.lengthSq() > 0) {
            _inputDir.normalize();
            velocity.x += _inputDir.x * speed * dt;
            velocity.y += _inputDir.y * speed * dt;
            velocity.z += _inputDir.z * speed * dt;
        }
        // Spacebar = fly higher
        if (keyState[' ']) {
            velocity.y += 60 * dt;
        }
    }

    // Drone gravity (pulls drone back to hover height when not pressing space)
    if (!controlTarget) {
        velocity.y -= 25 * dt;
    }

    // --- 3. Apply drone movement with slope collision ---
    _nextPos.set(
        playerMesh.position.x + velocity.x * dt,
        playerMesh.position.y + velocity.y * dt,
        playerMesh.position.z + velocity.z * dt
    );
    let nextGroundH = getTerrainHeightFast(_nextPos.x, _nextPos.z);
    const NS = 3;
    for (const [ox, oz] of [[-NS,0],[NS,0],[0,-NS],[0,NS]]) {
        nextGroundH = Math.max(nextGroundH, getTerrainHeightFast(_nextPos.x + ox, _nextPos.z + oz));
    }
    nextGroundH += 1.2;
    if (nextGroundH >= _nextPos.y) {
        // Landed on terrain — stop vertical velocity, slide horizontally
        velocity.y = 0;
        playerMesh.position.x += velocity.x * dt;
        playerMesh.position.z += velocity.z * dt;
        playerMesh.position.y = nextGroundH;
    } else {
        playerMesh.position.x += velocity.x * dt;
        playerMesh.position.y += velocity.y * dt;
        playerMesh.position.z += velocity.z * dt;
    }
    velocity.multiplyScalar(drag);

    } // end ascending else

    // Cache velocity magnitude once (used 6+ times below)
    const cachedSpeed = velocity.length();

    // --- 4. Drone Rotation (face movement direction) ---
    if (cachedSpeed > 0.1) {
        const targetRot = Math.atan2(velocity.x, velocity.z);
        let diff = targetRot - playerMesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        playerMesh.rotation.y += diff * 12 * dt;
        playerMesh.rotation.z = THREE.MathUtils.lerp(playerMesh.rotation.z, -diff * cachedSpeed * 0.05, 10 * dt);
        playerMesh.rotation.x = 0;
    } else {
        playerMesh.rotation.z *= 0.9;
        playerMesh.rotation.x *= 0.9;
    }

    // --- 5. Drone Visual Effects ---
    const time = Date.now() * 0.002;
    if (playerMesh.userData.flare) {
        const flicker = 0.85 + Math.random() * 0.3;
        const moving = cachedSpeed > 0.1;
        // Core flare: compact, bright
        const coreSize = (moving ? 2.4 : 1.6) * flicker;
        _flareTarget.set(coreSize, coreSize, 1);
        playerMesh.userData.flare.scale.lerp(_flareTarget, 0.1);
        playerMesh.userData.flare.material.opacity = 0.6 + (moving ? 0.3 : 0.0);
        // Halo flare: wide, soft — uses glowSoft texture (no square edge)
        const halo = playerMesh.userData.haloFlare;
        if (halo) {
            const haloSize = (moving ? 5.5 : 3.5) * (0.9 + Math.random() * 0.2);
            halo.scale.set(haloSize, haloSize, 1);
            halo.material.opacity = moving ? 0.3 : 0.15;
        }
    }

    // Antenna blink (red tip)
    playerMesh.children.forEach(child => {
        if (child.userData.antennaBlink) {
            child.material.opacity = Math.sin(time * 1.5) > 0.7 ? 1 : 0.1;
        }
    });

    // --- 5b. Engine Trails ---
    const trails = playerMesh.userData.engineTrails;
    if (trails) {
        const moving = cachedSpeed > 0.5;
        if (moving) {
            playerMesh.userData.trailTimer = (playerMesh.userData.trailTimer || 0) + dt;
            const emitRate = Math.min(0.03, 0.08 - cachedSpeed * 0.003);
            if (playerMesh.userData.trailTimer > emitRate) {
                playerMesh.userData.trailTimer = 0;
                const idle = trails.find(p => p.life <= 0);
                if (idle) {
                    idle.life = idle.maxLife;
                    const padAngle = (idle.padIndex / 4) * Math.PI * 2 + playerMesh.rotation.y;
                    const padR = 1.4;
                    idle.sprite.position.set(
                        playerMesh.position.x + Math.sin(padAngle) * padR,
                        playerMesh.position.y + 0.8,
                        playerMesh.position.z + Math.cos(padAngle) * padR
                    );
                    idle.velocity.set(
                        -velocity.x * 0.15 + (Math.random() - 0.5) * 1.5,
                        -1.5 + Math.random() * 0.8,
                        -velocity.z * 0.15 + (Math.random() - 0.5) * 1.5
                    );
                    idle.sprite.visible = true;
                    idle.sprite.material.opacity = 0.7;
                    idle.sprite.scale.set(0.5, 0.5, 0.5);
                }
            }
        }
        trails.forEach(p => {
            if (p.life <= 0) return;
            p.life -= dt;
            const t = 1 - (p.life / p.maxLife);
            p.sprite.position.x += p.velocity.x * dt;
            p.sprite.position.y += p.velocity.y * dt;
            p.sprite.position.z += p.velocity.z * dt;
            p.velocity.y *= 0.95;
            const s = 0.5 + t * 2.0;
            p.sprite.scale.set(s, s, s);
            p.sprite.material.opacity = 0.7 * (1 - t) * (1 - t);
            if (p.life <= 0) {
                p.sprite.visible = false;
                p.sprite.material.opacity = 0;
            }
        });
    }

    // --- 6. Ground Height & Hover ---
    const HOVER_BUFFER = 6.0;
    const HOVER_MIN = 5.0;
    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    let groundH = getTerrainHeightFast(px, pz);
    const R = 5;
    const sampleOffsets = [
        [-R,0],[R,0],[0,-R],[0,R],
        [-R,-R],[R,-R],[-R,R],[R,R],
        [-R*0.5,0],[R*0.5,0],[0,-R*0.5],[0,R*0.5]
    ];
    for (const [ox, oz] of sampleOffsets) {
        groundH = Math.max(groundH, getTerrainHeightFast(px + ox, pz + oz));
    }
    if (cachedSpeed > 0.1) {
        const lookAhead = 8;
        const vx = velocity.x / cachedSpeed;
        const vz = velocity.z / cachedSpeed;
        groundH = Math.max(groundH, getTerrainHeightFast(px + vx * lookAhead, pz + vz * lookAhead));
        groundH = Math.max(groundH, getTerrainHeightFast(px + vx * lookAhead * 0.5, pz + vz * lookAhead * 0.5));
    }
    groundH += 1.2;

    for (const prop of planetProps) {
        const dxP = px - prop.x;
        const dzP = pz - prop.z;
        if (dxP * dxP + dzP * dzP < prop.r * prop.r) groundH = Math.max(groundH, prop.topY);
    }

    const targetY = groundH + HOVER_BUFFER + Math.sin(time) * 0.3;
    if (playerMesh.position.y < groundH + HOVER_MIN) {
        playerMesh.position.y = groundH + HOVER_MIN;
    } else if (playerMesh.position.y < targetY) {
        playerMesh.position.y = targetY;
    } else {
        playerMesh.position.y += (targetY - playerMesh.position.y) * 4 * dt;
    }

    // --- 7. Shadow ---
    if (playerMesh.userData.shadowMesh) {
        const sm = playerMesh.userData.shadowMesh;
        // Sample a small grid so shadow sits on top of terrain even on bumpy/high ground
        let shadowGH = getTerrainHeightFast(px, pz);
        shadowGH = Math.max(shadowGH, getTerrainHeightFast(px - 2, pz));
        shadowGH = Math.max(shadowGH, getTerrainHeightFast(px + 2, pz));
        shadowGH = Math.max(shadowGH, getTerrainHeightFast(px, pz - 2));
        shadowGH = Math.max(shadowGH, getTerrainHeightFast(px, pz + 2));
        shadowGH += 0.25; // stay above terrain surface
        sm.position.set(playerMesh.position.x, shadowGH, playerMesh.position.z);
        const dist = playerMesh.position.y - shadowGH;
        // Larger shadow at height, strong opacity that fades gently
        sm.scale.setScalar(2.2 + (dist * 0.06));
        sm.material.opacity = Math.max(0.1, 0.85 - (dist * 0.04));
    }

    // --- 7b. Sun light follows drone ---
    if (sunLight) {
        sunLight.position.set(px + 100, 200, pz + 100);
        sunLight.target.position.set(px, 0, pz);
        sunLight.target.updateMatrixWorld();
        sunLight.shadow.camera.updateProjectionMatrix();
    }

    // --- 8. Atmospheric particles & Creatures ---
    if (dustMesh && dustMesh.material.uniforms) {
        dustMesh.material.uniforms.uTime.value = time;
        // Keep particle cloud centered on player so motes always surround camera
        dustMesh.position.x = followTarget.position.x;
        dustMesh.position.z = followTarget.position.z;
    }

    creatures.forEach(c => {
        const ud = c.userData;
        ud.phase += dt * ud.speed;
        ud.idlePhase = (ud.idlePhase || 0) + dt;

        const roam   = ud.roamRadius  || 10;
        const bob    = ud.bobHeight   || 0.4;
        const bscale = ud.bodyScale   || 1.0;
        const jts    = ud.joints      || {};
        const p      = ud.phase;
        const ip     = ud.idlePhase;

        // ── Movement (roaming circle) ──
        const targetX = ud.originX + Math.cos(p) * roam;
        const targetZ = ud.originZ + Math.sin(p) * roam;

        c.position.x = THREE.MathUtils.lerp(c.position.x, targetX, 0.5 * dt);
        c.position.z = THREE.MathUtils.lerp(c.position.z, targetZ, 0.5 * dt);
        c.position.y = getTerrainHeightFast(c.position.x, c.position.z) + bscale * 0.9
                       + Math.abs(Math.sin(p * 4)) * bob;

        // Face movement direction (smooth)
        const cdx = targetX - c.position.x;
        const cdz = targetZ - c.position.z;
        if (Math.abs(cdx) + Math.abs(cdz) > 0.01) {
            const targetRot = Math.atan2(cdx, cdz);
            c.rotation.y = THREE.MathUtils.lerp(c.rotation.y, targetRot, 3.0 * dt);
        }

        // Walk speed factor (for animation intensity)
        const walkSpeed = Math.sqrt(cdx * cdx + cdz * cdz);
        const walkAmp = Math.min(1.0, walkSpeed * 0.5);

        // ── Jointed leg animation (hip + knee) ──
        if (jts.legs) {
            const legCount = jts.legs.length;
            for (let li = 0; li < legCount; li++) {
                const leg = jts.legs[li];
                // Alternating gait: opposite legs swing opposite, stagger by index
                const offset = (li / legCount) * Math.PI * 2;
                const swing = Math.sin(p * 6 + offset);

                // Hip: forward/back swing
                leg.hip.rotation.x = swing * 0.45 * walkAmp;
                // Slight outward splay on swing
                leg.hip.rotation.z = leg.side * 0.05 * Math.abs(swing);

                // Knee: bends when leg is behind (swing negative)
                leg.knee.rotation.x = Math.max(0, -swing) * 0.65 * walkAmp;
            }
        }

        // ── Head look-around ──
        if (jts.head) {
            // Slow scanning side-to-side
            jts.head.rotation.y = Math.sin(ip * 0.6) * 0.3;
            // Subtle nod (up-down tied to walk)
            jts.head.rotation.x = Math.sin(p * 4) * 0.08 * walkAmp
                                + Math.sin(ip * 1.2) * 0.05;
        }

        // ── Mandible movement ──
        if (jts.mandibleL && jts.mandibleR) {
            // Slow chewing/clicking motion
            const chew = Math.sin(ip * 2.5) * 0.15 + Math.sin(ip * 4.1) * 0.08;
            jts.mandibleL.rotation.y = -chew;
            jts.mandibleR.rotation.y = chew;
        }

        // ── Antennae sway ──
        if (jts.antennaeL && jts.antennaeR) {
            // Independent wavering, slightly different frequencies
            jts.antennaeL.rotation.x = Math.sin(ip * 1.8 + 0.5) * 0.25;
            jts.antennaeL.rotation.z = Math.sin(ip * 2.3) * 0.15;
            jts.antennaeR.rotation.x = Math.sin(ip * 1.8 - 0.5) * 0.25;
            jts.antennaeR.rotation.z = Math.sin(ip * 2.3 + 1.0) * -0.15;
        }

        // ── Tail swish (species A) ──
        if (jts.tail) {
            jts.tail.rotation.y = Math.sin(ip * 1.3) * 0.35 + Math.sin(p * 3) * 0.15 * walkAmp;
            jts.tail.rotation.x = Math.sin(ip * 0.9) * 0.1;
        }

        // ── Shadow ──
        if (ud.shadowMesh) {
            const rawGH = getTerrainHeightFast(c.position.x, c.position.z) + 0.1;
            ud.shadowMesh.position.set(c.position.x, rawGH, c.position.z);
            const distAbove = c.position.y - rawGH;
            ud.shadowMesh.scale.setScalar(bscale * 1.6 + distAbove * 0.08);
            ud.shadowMesh.material.opacity = Math.max(0, 0.5 - distAbove * 0.06);
        }
    });

    // --- 8a. Cloud drift (UV scroll) + ground mist ---
    const followPos = controlTarget || playerMesh;
    planetState.cloudLayers.forEach(cl => {
        // UV scroll for natural slow drift (no plane movement)
        if (cl.material.map) {
            cl.material.map.offset.x += cl.userData.uvDx * dt;
            cl.material.map.offset.y += cl.userData.uvDz * dt;
        }
        // Subtle opacity breathing (wind gusts)
        const breath = Math.sin(time * 0.4 + cl.userData.opacityPhase) * 0.04;
        cl.material.opacity = cl.userData.baseOpacity + breath;
        // Keep centered above player
        cl.position.x = followPos.position.x;
        cl.position.z = followPos.position.z;
    });
    // Ground mist follows player
    if (planetState.groundMist) {
        const mist = planetState.groundMist;
        mist.position.x = followPos.position.x;
        mist.position.z = followPos.position.z;
        // Slow UV scroll
        if (mist.material.map) {
            mist.material.map.offset.x += 0.001 * dt;
            mist.material.map.offset.y += 0.0006 * dt;
        }
        // Subtle opacity pulse
        const mp = Math.sin(time * 0.3) * 0.03;
        mist.material.opacity = mist.userData.baseOpacity + mp;
    }
    // Atmospheric haze follows player horizontally
    if (planetState.hazeMesh) {
        planetState.hazeMesh.position.x = followPos.position.x;
        planetState.hazeMesh.position.z = followPos.position.z;
    }

    // --- 8b. Lake water gentle bob ---
    if (planetState.lakeMeshes) {
        planetState.lakeMeshes.forEach(lm => {
            lm.userData.time += dt;
            lm.position.y = lm.userData.baseY + Math.sin(lm.userData.time * 0.6) * 0.15;
        });
    }

    // --- 8c. Grass wind animation ---
    updateGrass(planetState.grassData, dt);

    // --- 8b. Patrol soldiers (waypoint-based walk) ---
    const TRAIL_SPACING = 1.2;   // drop a footprint every N units
    const TRAIL_LIFE    = 6.0;   // seconds before full fade
    const now = performance.now() * 0.001; // seconds for idle anims

    soldierMeshes.forEach(s => {
        const ud = s.userData;
        if (!ud.isSoldier) return;

        // Skip patrol AI for player-controlled soldier (movement handled in section 2b/3b)
        if (ud._playerControlled) {
            // Still update shadow
            if (ud.shadowMesh) {
                const gH = getTerrainHeightFast(s.position.x, s.position.z) + 0.15;
                ud.shadowMesh.position.set(s.position.x, gH, s.position.z);
                ud.shadowMesh.material.opacity = 0.55;
            }
            // Trail marks while player walks
            if (ud.trailMarks) {
                for (let ti = 0; ti < ud.trailMarks.length; ti++) {
                    const tm = ud.trailMarks[ti];
                    if (tm.age < TRAIL_LIFE) {
                        tm.age += dt;
                        const frac = tm.age / TRAIL_LIFE;
                        tm.mesh.material.opacity = 0.25 * (1 - frac);
                        if (frac >= 1) { tm.mesh.visible = false; tm.mesh.material.opacity = 0; }
                    }
                }
                const sVel = ud.velocity;
                const spd = sVel ? Math.sqrt(sVel.x * sVel.x + sVel.z * sVel.z) : 0;
                if (spd > 0.5) {
                    ud.trailDist = (ud.trailDist || 0) + spd * dt;
                    if (ud.trailDist >= TRAIL_SPACING) {
                        ud.trailDist -= TRAIL_SPACING;
                        const tm = ud.trailMarks[ud.trailIndex % ud.trailMarks.length];
                        ud.trailIndex++;
                        const gH2 = getTerrainHeightFast(s.position.x, s.position.z) + 0.12;
                        tm.mesh.position.set(s.position.x, gH2, s.position.z);
                        tm.mesh.rotation.z = s.rotation.y;
                        tm.mesh.visible = true;
                        tm.mesh.material.opacity = 0.25;
                        tm.age = 0;
                    }
                }
            }
            return;
        }

        // ── Shadow follows soldier ──
        if (ud.shadowMesh) {
            const gH = getTerrainHeightFast(s.position.x, s.position.z) + 0.15;
            ud.shadowMesh.position.set(s.position.x, gH, s.position.z);
            ud.shadowMesh.material.opacity = 0.55;
        }

        // ── Age existing trail marks ──
        if (ud.trailMarks) {
            for (let ti = 0; ti < ud.trailMarks.length; ti++) {
                const tm = ud.trailMarks[ti];
                if (tm.age < TRAIL_LIFE) {
                    tm.age += dt;
                    const frac = tm.age / TRAIL_LIFE;
                    tm.mesh.material.opacity = 0.25 * (1 - frac);
                    if (frac >= 1) { tm.mesh.visible = false; tm.mesh.material.opacity = 0; }
                }
            }
        }

        // ── Idle breathing + head scan (always active) ──
        const idlePhase = now + (ud.centerX || 0); // unique per soldier
        const pj = ud.joints; // joint references
        if (pj && pj.head) {
            const scanAmp = ud.waitTimer > 0 ? 0.35 : 0.1;
            pj.head.rotation.y = Math.sin(idlePhase * 0.7) * scanAmp;
        }
        if (pj && pj.muzzle) {
            pj.muzzle.material.opacity = ud.waitTimer > 0
                ? (Math.sin(idlePhase * 8) > 0.95 ? 0.6 : 0)
                : 0;
        }

        // Waiting at waypoint — stand still, breathing + slight sway
        if (ud.waitTimer > 0) {
            ud.waitTimer -= dt;
            if (pj) {
                // Return legs to rest
                pj.rightLeg.rotation.x *= 0.9;
                pj.leftLeg.rotation.x *= 0.9;
                pj.rightKnee.rotation.x *= 0.9;
                pj.leftKnee.rotation.x *= 0.9;

                // Subtle arm sway while idle
                const breathe = Math.sin(idlePhase * 2.5) * 0.015;
                pj.rightArm.rotation.x = pj.rightArm.rotation.x * 0.9
                    + Math.sin(idlePhase * 1.3 + 1) * 0.04;
                pj.leftArm.rotation.x = pj.leftArm.rotation.x * 0.9
                    + Math.sin(idlePhase * 1.3 - 1) * 0.04;
                pj.rightArm.rotation.z = breathe;
                pj.leftArm.rotation.z = -breathe;
                pj.rightElbow.rotation.x *= 0.9;
                pj.leftElbow.rotation.x *= 0.9;
            }
            // Slight body bob from breathing
            s.position.y = getTerrainHeightFast(s.position.x, s.position.z)
                + Math.sin(idlePhase * 2.5) * 0.02;
            return;
        }

        // Walk toward current waypoint
        const dx = ud.waypointX - s.position.x;
        const dz = ud.waypointZ - s.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.5) {
            // Reached waypoint — pause, then pick a new one within patrol zone
            ud.waitTimer = 1.0 + Math.random() * 2.5;
            const angle = Math.random() * Math.PI * 2;
            const r = 2 + Math.random() * ud.patrolRadius;
            ud.waypointX = ud.centerX + Math.cos(angle) * r;
            ud.waypointZ = ud.centerZ + Math.sin(angle) * r;
            return;
        }

        // Step toward waypoint
        const nx = dx / dist;
        const nz = dz / dist;
        const step = ud.speed * dt;
        s.position.x += nx * step;
        s.position.z += nz * step;
        s.position.y = getTerrainHeightFast(s.position.x, s.position.z);

        // Face walking direction
        s.rotation.y = Math.atan2(nx, nz);

        // Walk cycle — joint-based animation
        ud.walkPhase += step * 4;
        const wp = ud.walkPhase;
        const walkSin = Math.sin(wp);
        const walkCos = Math.cos(wp);
        // Subtle vertical bob while walking
        s.position.y += Math.abs(walkSin) * 0.04;
        // Slight body lean into movement
        s.rotation.z = walkCos * 0.02;

        if (pj) {
            // Hip swing
            pj.rightLeg.rotation.x = walkSin * 0.5;
            pj.leftLeg.rotation.x = -walkSin * 0.5;

            // Knee bend when leg swings back
            pj.rightKnee.rotation.x = Math.max(0, -walkSin) * 0.7;
            pj.leftKnee.rotation.x = Math.max(0, walkSin) * 0.7;

            // Arms counter-swing (weapon arm less)
            pj.rightArm.rotation.x = -walkSin * 0.2;
            pj.leftArm.rotation.x = walkSin * 0.35;
            pj.rightArm.rotation.z = 0;
            pj.leftArm.rotation.z = 0;

            // Elbow bend
            pj.rightElbow.rotation.x = Math.max(0, walkSin) * 0.2 - 0.1;
            pj.leftElbow.rotation.x = Math.max(0, -walkSin) * 0.2 - 0.1;
        }

        // ── Drop track trail marks ──
        if (ud.trailMarks) {
            ud.trailDist += step;
            if (ud.trailDist >= TRAIL_SPACING) {
                ud.trailDist -= TRAIL_SPACING;
                const tm = ud.trailMarks[ud.trailIndex % ud.trailMarks.length];
                ud.trailIndex++;
                const gH = getTerrainHeightFast(s.position.x, s.position.z) + 0.12;
                tm.mesh.position.set(s.position.x, gH, s.position.z);
                tm.mesh.rotation.z = s.rotation.y;
                tm.mesh.visible = true;
                tm.mesh.material.opacity = 0.25;
                tm.age = 0;
            }
        }
    });

    // --- 9. Animate harvesters ---
    harvesterGroups.forEach(hGroup => {
        hGroup.children.forEach(child => {
            if (child.userData.rotatingArm) {
                child.rotation.y += 0.8 * dt;
            }
            if (child.userData.beacon) {
                child.intensity = 6 + Math.sin(performance.now() * 0.003) * 4;
            }
        });

        // Steam vents
        const steam = hGroup.userData.steamParticles;
        if (steam) {
            hGroup.userData.steamTimer = (hGroup.userData.steamTimer || 0) + dt;
            if (hGroup.userData.steamTimer > 0.4) {
                hGroup.userData.steamTimer = 0;
                const idle = steam.find(p => p.life <= 0);
                if (idle) {
                    idle.life = idle.maxLife;
                    const angle = idle.baseAngle + (Math.random() - 0.5) * 0.6;
                    const dist = 4.5 + Math.random();
                    idle.sprite.position.set(
                        Math.cos(angle) * dist, 2, Math.sin(angle) * dist
                    );
                    idle.velocity.set(
                        (Math.random() - 0.5) * 0.5,
                        2 + Math.random() * 1.5,
                        (Math.random() - 0.5) * 0.5
                    );
                    idle.sprite.visible = true;
                    idle.sprite.material.opacity = 0.4;
                    idle.sprite.scale.set(1, 1, 1);
                }
            }
            steam.forEach(p => {
                if (p.life <= 0) return;
                p.life -= dt;
                const t = 1 - (p.life / p.maxLife);
                p.sprite.position.x += p.velocity.x * dt;
                p.sprite.position.y += p.velocity.y * dt;
                p.sprite.position.z += p.velocity.z * dt;
                p.velocity.y *= 0.98;
                const s = 1 + t * 2.5;
                p.sprite.scale.set(s, s, s);
                p.sprite.material.opacity = 0.4 * (1 - t) * (1 - t);
                if (p.life <= 0) {
                    p.sprite.visible = false;
                    p.sprite.material.opacity = 0;
                }
            });
        }

        // Harvester rover
        const rover = hGroup.userData.rover;
        if (rover && rover.userData.harvesterRover) {
            const ud = rover.userData;
            ud.orbitPhase += ud.orbitSpeed * dt;

            const rx = ud.baseX + Math.cos(ud.orbitPhase) * ud.orbitRadius;
            const rz = ud.baseZ + Math.sin(ud.orbitPhase) * ud.orbitRadius;
            const ry = ud.heightFn(rx, rz);
            rover.position.set(rx, ry, rz);
            rover.rotation.y = -ud.orbitPhase + Math.PI / 2;

            rover.children.forEach(child => {
                if (child.userData.scoopArm) {
                    child.rotation.z = Math.sin(performance.now() * 0.005) * 0.3;
                }
                if (child.userData.wheel) {
                    child.rotation.z += 3 * dt;
                }
            });

            // Rover exhaust
            const exhaust = ud.exhaustParticles;
            if (exhaust) {
                ud.exhaustTimer = (ud.exhaustTimer || 0) + dt;
                if (ud.exhaustTimer > 0.15) {
                    ud.exhaustTimer = 0;
                    const idle = exhaust.find(p => p.life <= 0);
                    if (idle) {
                        idle.life = idle.maxLife;
                        idle.sprite.position.set(-1.4, 0.8, (Math.random() - 0.5) * 0.4);
                        idle.velocity.set(
                            -0.5 - Math.random() * 0.5,
                            1.5 + Math.random(),
                            (Math.random() - 0.5) * 0.8
                        );
                        idle.sprite.visible = true;
                        idle.sprite.material.opacity = 0.5;
                        idle.sprite.scale.set(0.5, 0.5, 0.5);
                    }
                }
                exhaust.forEach(p => {
                    if (p.life <= 0) return;
                    p.life -= dt;
                    const t = 1 - (p.life / p.maxLife);
                    p.sprite.position.x += p.velocity.x * dt;
                    p.sprite.position.y += p.velocity.y * dt;
                    p.sprite.position.z += p.velocity.z * dt;
                    p.velocity.y *= 0.96;
                    const s = 0.5 + t * 1.5;
                    p.sprite.scale.set(s, s, s);
                    p.sprite.material.opacity = 0.5 * (1 - t) * (1 - t);
                    if (p.life <= 0) {
                        p.sprite.visible = false;
                        p.sprite.material.opacity = 0;
                    }
                });
            }

            // ── Engine trail glow sprites (world-space) ──
            const eTrail = ud.engineTrailSprites;
            if (eTrail) {
                ud.engineTrailTimer = (ud.engineTrailTimer || 0) + dt;
                if (ud.engineTrailTimer > 0.12) {
                    ud.engineTrailTimer = 0;
                    const idle = eTrail.find(p => p.life <= 0);
                    if (idle) {
                        idle.life = idle.maxLife;
                        // Spawn behind rover in world space
                        const bx = rx - Math.cos(-ud.orbitPhase + Math.PI / 2) * 1.5;
                        const bz = rz - Math.sin(-ud.orbitPhase + Math.PI / 2) * 1.5;
                        idle.sprite.position.set(bx, ry + 0.5, bz);
                        idle.sprite.visible = true;
                        idle.sprite.material.opacity = 0.5;
                        idle.sprite.scale.set(0.6, 0.6, 0.6);
                    }
                }
                for (let ei = 0; ei < eTrail.length; ei++) {
                    const p = eTrail[ei];
                    if (p.life <= 0) continue;
                    p.life -= dt;
                    const t = 1 - (p.life / p.maxLife);
                    p.sprite.position.y += 0.3 * dt; // drift up
                    const s = 0.6 + t * 1.2;
                    p.sprite.scale.set(s, s, s);
                    p.sprite.material.opacity = 0.5 * (1 - t) * (1 - t);
                    if (p.life <= 0) {
                        p.sprite.visible = false;
                        p.sprite.material.opacity = 0;
                    }
                }
            }

            // ── Rover track marks (world-space ground decals) ──
            const rTracks = ud.trackMarks;
            if (rTracks) {
                // Age existing marks
                for (let rti = 0; rti < rTracks.length; rti++) {
                    const tm = rTracks[rti];
                    if (tm.age < 8) {
                        tm.age += dt;
                        const frac = tm.age / 8;
                        tm.mesh.material.opacity = 0.2 * (1 - frac);
                        if (frac >= 1) { tm.mesh.visible = false; tm.mesh.material.opacity = 0; }
                    }
                }
                // Distance since last mark
                const tdx = rx - ud.lastRX;
                const tdz = rz - ud.lastRZ;
                ud.trackDist += Math.sqrt(tdx * tdx + tdz * tdz);
                ud.lastRX = rx;
                ud.lastRZ = rz;
                if (ud.trackDist >= 1.5) {
                    ud.trackDist -= 1.5;
                    // Drop two tracks (left + right wheel lines)
                    const perpX = Math.sin(-ud.orbitPhase + Math.PI / 2) * 0.7;
                    const perpZ = -Math.cos(-ud.orbitPhase + Math.PI / 2) * 0.7;
                    [-1, 1].forEach(side => {
                        const tm = rTracks[ud.trackIndex % rTracks.length];
                        ud.trackIndex++;
                        const gH = ud.heightFn(rx + perpX * side, rz + perpZ * side) + 0.1;
                        tm.mesh.position.set(rx + perpX * side, gH, rz + perpZ * side);
                        tm.mesh.rotation.z = rover.rotation.y;
                        tm.mesh.visible = true;
                        tm.mesh.material.opacity = 0.2;
                        tm.age = 0;
                    });
                }
            }
        }
    });

    // --- 9b. Animate hub radar dish + beacon ---
    if (hubGroup) {
        hubGroup.children.forEach(child => {
            if (child.userData.radarDish) {
                child.rotation.y += 0.6 * dt;
            }
            // Blinking beacon on hub top
            if (child.userData.hubBeacon) {
                const blink = Math.sin(performance.now() * 0.004) > 0.3 ? 1 : 0.1;
                if (child.isMesh) {
                    child.material.opacity = blink * 0.9;
                    child.material.emissiveIntensity = blink;
                } else if (child.isSprite) {
                    child.material.opacity = blink * 0.6;
                }
            }
        });
    }

    // --- 9c. Animate building parts ---
    const _t = performance.now() * 0.001;
    for (let bi = 0; bi < buildingAnims.length; bi++) {
        const a = buildingAnims[bi];
        switch (a.type) {
            case 'power_plant': {
                // Core ring pulses (scale Y oscillation + emissive glow)
                const pulse = 0.8 + Math.sin(_t * 2.5) * 0.25;
                a.coreRing.scale.y = pulse;
                a.coreRingMat.emissiveIntensity = 0.15 + Math.sin(_t * 3) * 0.15;
                // Energy arc flicker (randomized opacity for electric effect)
                a.arcMat.opacity = 0.35 + Math.random() * 0.35;
                a.arcMat.emissiveIntensity = 0.3 + Math.random() * 0.5;
                // Reactor glow breathe
                const gs = 6 + Math.sin(_t * 1.5) * 1.5;
                a.reactorGlow.scale.set(gs, gs, 1);
                // Light intensity pulses
                a.light.intensity = 5 + Math.sin(_t * 2) * 2;
                break;
            }
            case 'mining_network': {
                // Crusher spins
                a.crusherPivot.rotation.y += dt * 1.5;
                // Crane arm rotates slowly
                a.cranePivot.rotation.y += dt * 0.4;
                break;
            }
            case 'hydroponics': {
                // Vegetation breathes
                a.veg.scale.y = a.vegBaseScaleY + Math.sin(_t * 0.8) * 0.04;
                a.veg.scale.x = 1 + Math.sin(_t * 0.6 + 1) * 0.02;
                a.veg.scale.z = 1 + Math.sin(_t * 0.7 + 2) * 0.02;
                a.vegMat.emissiveIntensity = 0.2 + Math.sin(_t * 1.2) * 0.12;
                // Growth lights cycle (staggered)
                for (let li = 0; li < a.growthLights.length; li++) {
                    a.growthLights[li].emissiveIntensity = 0.25 + Math.sin(_t * 2 + li * 2.1) * 0.2;
                }
                // Glow sprites pulse with lights
                for (let li = 0; li < a.glowSprites.length; li++) {
                    a.glowSprites[li].material.opacity = 0.15 + Math.sin(_t * 2 + li * 2.1) * 0.12;
                }
                // Dome glow breathe
                const dgs = 7 + Math.sin(_t * 0.8) * 1;
                a.domeGlow.scale.set(dgs, dgs, 1);
                // Interior light intensity
                a.light.intensity = 3.5 + Math.sin(_t * 1.2) * 1;
                break;
            }
            case 'research_lab': {
                // Satellite dish rotates
                a.dishPivot.rotation.y += dt * 0.5;
                // Hologram beam pulses (opacity + scale)
                a.beamMat.opacity = 0.12 + Math.sin(_t * 3) * 0.1;
                a.beam.scale.x = 1 + Math.sin(_t * 4) * 0.15;
                a.beam.scale.z = 1 + Math.sin(_t * 4) * 0.15;
                const bgs = 3 + Math.sin(_t * 3) * 1;
                a.beamGlow.scale.set(bgs, bgs, 1);
                // Antenna tip blinks
                const blink = Math.sin(_t * 4) > 0.2 ? 1.0 : 0.1;
                a.tipMat.emissiveIntensity = blink * 0.8;
                a.antennaTipGlow.material.opacity = blink * 0.5;
                // Window band subtle shimmer
                a.windowMat.emissiveIntensity = 0.4 + Math.sin(_t * 1.5) * 0.12;
                break;
            }
            case 'shipyard': {
                // Crane trolley oscillates along crossbeam
                a.trolleyPivot.position.x = Math.sin(_t * 0.6) * 2.5;
                // Launch pad ring glow pulses
                const padScale = 6 + Math.sin(_t * 1.8) * 1.5;
                a.padGlow.scale.set(padScale, padScale, 1);
                // Inner ship silhouette subtle glow
                if (a.innerShip.material.emissive) {
                    a.innerShip.material.emissiveIntensity = 0.1 + Math.sin(_t * 2) * 0.08;
                }
                break;
            }
        }
    }

    // --- 10. Drone proximity to harvesters ---
    if (!planetState.placementMode) {
        let nearHarvester = null;
        harvesterGroups.forEach(hGroup => {
            if (!hGroup.userData.isHarvester) return;
            const dist = playerMesh.position.distanceTo(hGroup.position);
            if (dist < 15) nearHarvester = hGroup;
        });

        const hud = getOrCreateHarvesterHUD();
        if (nearHarvester && planetState.currentPlanetData) {
            planetState.nearestHarvesterData = {
                harvesterId: nearHarvester.userData.harvesterId,
                planetId: planetState.currentPlanetData.id
            };
            hud.style.display = 'block';
            hud.querySelector('#harvester-hud-info').style.display = 'block';
            hud.querySelector('#harvester-hud-relocate').style.display = 'block';
            hud.querySelector('#harvester-hud-placing').style.display = 'none';

            const pType = planetState.currentPlanetData.type || 'Barren';
            const y = HARVESTER_YIELDS[pType] || HARVESTER_YIELD_DEFAULT;
            const yieldsEl = hud.querySelector('#harvester-hud-yields');
            if (yieldsEl) yieldsEl.innerHTML = `⚡+${y.energy} 💎+${y.minerals} 🍏+${y.food}`;
        } else {
            planetState.nearestHarvesterData = null;
            hud.style.display = 'none';
        }
    } else {
        const hud = document.getElementById('harvester-hud');
        if (hud) {
            hud.style.display = 'block';
            hud.querySelector('#harvester-hud-info').style.display = 'none';
            hud.querySelector('#harvester-hud-relocate').style.display = 'none';
            hud.querySelector('#harvester-hud-placing').style.display = 'block';
        }
    }

    // --- 11. Update exploration header coords (cached DOM ref) ---
    if (!_coordsEl) _coordsEl = document.getElementById('exploration-coords');
    if (_coordsEl) {
        const coordsTarget = controlTarget || playerMesh;
        _coordsEl.textContent = `X:${Math.round(coordsTarget.position.x)} Z:${Math.round(coordsTarget.position.z)}`;
    }

    // --- 12. Final Camera Update (reuse cached trig from step 1) ---
    _finalCenter.copy(followTarget.position).add(_cameraOffset);
    const finalCamX = _finalCenter.x + useDist * sinYaw * cosPitch;
    let finalCamY = _finalCenter.y + useDist * sinPitch;
    const finalCamZ = _finalCenter.z + useDist * cosYaw * cosPitch;
    const finalCamGH = getTerrainHeightFast(finalCamX, finalCamZ) + 1.5;
    if (finalCamY < finalCamGH) finalCamY = finalCamGH;
    camera.position.set(finalCamX, finalCamY, finalCamZ);
    camera.lookAt(_finalCenter);
}
