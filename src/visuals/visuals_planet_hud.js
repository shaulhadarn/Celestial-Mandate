/**
 * Harvester HUD overlay and placement mode for planet exploration.
 */
import { relocateHarvester } from '../core/state.js';
import planetState from './visuals_planet_state.js';

let _updateColonyBuildingsFn = null;

/** Call once at startup to wire the colony-buildings refresh callback (avoids circular import). */
export function initHUD(updateColonyBuildingsFn) {
    _updateColonyBuildingsFn = updateColonyBuildingsFn;
}

export function exitPlacementMode() {
    planetState.placementMode = null;
    planetState.nearestHarvesterData = null;
    const hud = document.getElementById('harvester-hud');
    if (hud) hud.style.display = 'none';
    const tint = document.getElementById('harvester-placement-tint');
    if (tint) tint.style.display = 'none';
}

export function getOrCreateHarvesterHUD() {
    let el = document.getElementById('harvester-hud');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'harvester-hud';
    el.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);z-index:200;display:none;text-align:center;';
    el.innerHTML = `
        <div id="harvester-hud-info" style="display:none;margin-bottom:8px;">
            <div style="background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.3);border-radius:6px;padding:8px 14px;font-size:12px;">
                <span style="color:#ffcc44;">🏭 Harvester</span>
                <span id="harvester-hud-yields" style="color:#ccc;margin-left:8px;"></span>
            </div>
        </div>
        <div id="harvester-hud-relocate" style="display:none;">
            <button id="btn-harvester-relocate" style="background:rgba(255,170,0,0.2);border:1px solid #ffaa00;color:#ffcc44;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;">
                ⛏ Relocate Harvester
            </button>
        </div>
        <div id="harvester-hud-placing" style="display:none;">
            <div style="color:#ffcc44;font-size:12px;margin-bottom:8px;">Fly to new location</div>
            <div style="display:flex;gap:8px;justify-content:center;">
                <button id="btn-harvester-place" style="background:rgba(0,255,100,0.2);border:1px solid #00ff66;color:#00ff66;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;">
                    ✓ Place Here
                </button>
                <button id="btn-harvester-cancel" style="background:rgba(255,50,50,0.2);border:1px solid #ff4444;color:#ff4444;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit;">
                    ✕ Cancel
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(el);

    // Amber tint overlay for placement mode
    const tint = document.createElement('div');
    tint.id = 'harvester-placement-tint';
    tint.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:150;box-shadow:inset 0 0 80px rgba(255,170,0,0.15);display:none;';
    document.body.appendChild(tint);

    // Wire buttons
    el.querySelector('#btn-harvester-relocate').addEventListener('click', () => {
        if (!planetState.nearestHarvesterData) return;
        planetState.placementMode = { ...planetState.nearestHarvesterData };
        el.querySelector('#harvester-hud-info').style.display = 'none';
        el.querySelector('#harvester-hud-relocate').style.display = 'none';
        el.querySelector('#harvester-hud-placing').style.display = 'block';
        document.getElementById('harvester-placement-tint').style.display = 'block';
    });

    el.querySelector('#btn-harvester-place').addEventListener('click', () => {
        if (!planetState.placementMode || !planetState.playerMesh || !planetState.currentPlanetData) return;
        relocateHarvester(planetState.placementMode.planetId, planetState.placementMode.harvesterId, {
            x: planetState.playerMesh.position.x,
            z: planetState.playerMesh.position.z
        });
        if (_updateColonyBuildingsFn) _updateColonyBuildingsFn();
        exitPlacementMode();
    });

    el.querySelector('#btn-harvester-cancel').addEventListener('click', () => {
        exitPlacementMode();
    });

    return el;
}
