/**
 * Per-frame physics, animation, and game logic for planet exploration.
 * Optimized: pre-allocated vectors, cached velocity.length(), cached DOM refs.
 */
import * as THREE from 'three';
import { gameState, HARVESTER_YIELDS, HARVESTER_YIELD_DEFAULT } from '../core/state.js';
import { getTerrainHeight, getTerrainHeightFast } from './visuals_planet_terrain.js';
import { harvesterGroups, soldierMeshes, renderColonyGroundBuildings } from './visuals_planet_colony.js';
import { getOrCreateHarvesterHUD } from './visuals_planet_hud.js';
import planetState, { CAMERA_HEIGHT_OFFSET } from './visuals_planet_state.js';

// ── Pre-allocated reusable vectors (never GC'd) ─────────────────────────────
const _cameraOffset = new THREE.Vector3(0, CAMERA_HEIGHT_OFFSET, 0);
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
            cameraYaw, cameraPitch, cameraDistance, keyState, joystickInput } = planetState;

    if (!playerMesh || !camera) return;

    // --- 1. Camera Position (before movement so direction vectors are correct) ---
    _droneCenter.copy(playerMesh.position).add(_cameraOffset);
    const sinYaw = Math.sin(cameraYaw);
    const cosYaw = Math.cos(cameraYaw);
    const sinPitch = Math.sin(cameraPitch);
    const cosPitch = Math.cos(cameraPitch);

    const camX = _droneCenter.x + cameraDistance * sinYaw * cosPitch;
    let camY = _droneCenter.y + cameraDistance * sinPitch;
    const camZ = _droneCenter.z + cameraDistance * cosYaw * cosPitch;
    const camGroundH = getTerrainHeightFast(camX, camZ) + 2.0;
    if (camY < camGroundH) camY = camGroundH;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(_droneCenter);

    // --- 2. Movement Direction (derived from cameraYaw) ---
    const speed = 100;
    const drag = 0.92;
    const velocity = playerMesh.userData.velocity;

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

    if (_inputDir.lengthSq() > 0) {
        _inputDir.normalize();
        velocity.x += _inputDir.x * speed * dt;
        velocity.y += _inputDir.y * speed * dt;
        velocity.z += _inputDir.z * speed * dt;
    }

    // --- 3. Apply Movement with slope collision ---
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
    if (nextGroundH >= playerMesh.position.y) {
        velocity.x = 0;
        velocity.z = 0;
    } else {
        playerMesh.position.x += velocity.x * dt;
        playerMesh.position.y += velocity.y * dt;
        playerMesh.position.z += velocity.z * dt;
    }
    velocity.multiplyScalar(drag);

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
        const flicker = 0.8 + Math.random() * 0.4;
        const moving = cachedSpeed > 0.1;
        const fSize = (moving ? 4 : 2.5) * flicker;
        _flareTarget.set(fSize, fSize, 1);
        playerMesh.userData.flare.scale.lerp(_flareTarget, 0.1);
        playerMesh.userData.flare.material.opacity = 0.4 + (moving ? 0.4 : 0.1);
    }

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

    // --- 8. Dust & Creatures ---
    if (dustMesh && dustMesh.material.uniforms) {
        dustMesh.material.uniforms.uTime.value = time;
    }

    creatures.forEach(c => {
        const ud = c.userData;
        ud.phase += dt * ud.speed;

        const roam   = ud.roamRadius  || 10;
        const bob    = ud.bobHeight   || 0.4;
        const bscale = ud.bodyScale   || 1.0;

        const targetX = ud.originX + Math.cos(ud.phase) * roam;
        const targetZ = ud.originZ + Math.sin(ud.phase) * roam;

        c.position.x = THREE.MathUtils.lerp(c.position.x, targetX, 0.5 * dt);
        c.position.z = THREE.MathUtils.lerp(c.position.z, targetZ, 0.5 * dt);
        c.position.y = getTerrainHeightFast(c.position.x, c.position.z) + bscale * 0.9
                       + Math.abs(Math.sin(ud.phase * 4)) * bob;

        const cdx = targetX - c.position.x;
        const cdz = targetZ - c.position.z;
        if (Math.abs(cdx) + Math.abs(cdz) > 0.01) {
            c.rotation.y = Math.atan2(cdx, cdz);
        }

        const legStart = ud.legStartIdx || 4;
        const legCount = ud.legCount    || 4;
        for (let li = 0; li < legCount * 2; li++) {
            const child = c.children[legStart + li];
            if (!child) continue;
            const side  = li % 2 === 0 ? 1 : -1;
            const swing = Math.sin(ud.phase * 6 + li * 0.8) * 0.35;
            child.rotation.x = swing * side;
        }

        if (ud.shadowMesh) {
            const rawGH = getTerrainHeightFast(c.position.x, c.position.z) + 0.1;
            ud.shadowMesh.position.set(c.position.x, rawGH, c.position.z);
            const distAbove = c.position.y - rawGH;
            ud.shadowMesh.scale.setScalar(bscale * 1.6 + distAbove * 0.08);
            ud.shadowMesh.material.opacity = Math.max(0, 0.5 - distAbove * 0.06);
        }
    });

    // --- 8b. Patrol soldiers ---
    soldierMeshes.forEach(s => {
        const ud = s.userData;
        if (!ud.isSoldier) return;
        ud.phase += dt * ud.speed;

        const tx = ud.originX + Math.cos(ud.phase) * ud.patrolRadius;
        const tz = ud.originZ + Math.sin(ud.phase) * ud.patrolRadius;

        s.position.x = THREE.MathUtils.lerp(s.position.x, tx, 2 * dt);
        s.position.z = THREE.MathUtils.lerp(s.position.z, tz, 2 * dt);
        s.position.y = getTerrainHeightFast(s.position.x, s.position.z);

        s.rotation.y = -ud.phase + Math.PI / 2;

        s.children.forEach(child => {
            if (child.userData.isLeg) {
                child.rotation.x = Math.sin(ud.phase * 8) * 0.5 * child.userData.side;
            }
            if (child.userData.isArm) {
                child.rotation.x = Math.sin(ud.phase * 8 + Math.PI) * 0.35 * child.userData.side;
            }
        });
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
        }
    });

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
        _coordsEl.textContent = `X:${Math.round(playerMesh.position.x)} Z:${Math.round(playerMesh.position.z)}`;
    }

    // --- 12. Final Camera Update (reuse cached trig from step 1) ---
    _finalCenter.copy(playerMesh.position).add(_cameraOffset);
    const finalCamX = _finalCenter.x + cameraDistance * sinYaw * cosPitch;
    const finalCamY = _finalCenter.y + cameraDistance * sinPitch;
    const finalCamZ = _finalCenter.z + cameraDistance * cosYaw * cosPitch;
    camera.position.set(finalCamX, finalCamY, finalCamZ);
    camera.lookAt(_finalCenter);
}
