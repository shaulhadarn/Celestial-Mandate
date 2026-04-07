/* Pirate raid tick and battle resolution logic */
import { gameState, events, getPlanet, getSystem } from './state.js';

// ── Helper: get pirate combat data for any pirate planet ────────────────────
/**
 * Returns { power, defeated, isHomePirate, systemId } for a pirate planet,
 * or null if the planet is not a pirate base.
 * Works for both the home-system pirateBase and random outpost pirateData.
 */
export function getPirateInfo(planetId) {
    const pb = gameState.pirateBase;
    // Home system pirate
    if (pb && pb.planetId === planetId) {
        return { power: pb.power, defeated: pb.defeated, isHomePirate: true, systemId: pb.systemId };
    }
    // Random outpost pirate (data stored on planet)
    const planet = getPlanet(planetId);
    if (planet && planet.pirate && planet.pirateData) {
        // Find which system this planet belongs to
        let sysId = null;
        for (const s of gameState.systems) {
            if (s.planets.some(p => p.id === planetId)) { sysId = s.id; break; }
        }
        return { power: planet.pirateData.power, defeated: planet.pirateData.defeated, isHomePirate: false, systemId: sysId };
    }
    return null;
}

// ── Pirate Raids (home system only) ─────────────────────────────────────────
export function tickPirateRaids() {
    const pb = gameState.pirateBase;
    if (!pb || pb.defeated || pb.battleInProgress) return;

    pb.raidTimer++;

    // Show pirate intro conversation ~60 ticks into the game (before raids start)
    if (!pb.introShown && pb.raidTimer >= -60) {
        pb.introShown = true;
        events.dispatchEvent(new CustomEvent('pirate-intro'));
    }

    if (pb.raidTimer < pb.raidInterval) return;

    // Raid! Steal resources
    const stolenMinerals = Math.min(gameState.resources.minerals, 3 + Math.floor(Math.random() * 6));
    const stolenEnergy = Math.min(gameState.resources.energy, 2 + Math.floor(Math.random() * 4));

    if (stolenMinerals <= 0 && stolenEnergy <= 0) {
        pb.raidTimer = 0;
        return;
    }

    gameState.resources.minerals -= stolenMinerals;
    gameState.resources.energy -= stolenEnergy;

    events.dispatchEvent(new CustomEvent('pirate-raid', {
        detail: { minerals: stolenMinerals, energy: stolenEnergy }
    }));
    events.dispatchEvent(new CustomEvent('resources-updated'));

    pb.raidTimer = 0;
    pb.raidInterval = 25 + Math.floor(Math.random() * 15);
}

// ── Pirate Battle Resolution (works for any pirate planet) ──────────────────
/**
 * @param {string} [planetId] - specific pirate planet to attack. Falls back to home pirateBase.
 */
export function resolvePirateBattle(planetId) {
    const info = planetId ? getPirateInfo(planetId) : null;

    // Home pirate fallback (original behavior)
    if (!planetId || (info && info.isHomePirate)) {
        return _resolveHomePirateBattle();
    }

    // Random outpost pirate battle
    if (!info || info.defeated) return null;
    const planet = getPlanet(planetId);
    if (!planet || !planet.pirateData) return null;

    const playerFleets = (gameState.fleets || []).filter(f => f.systemId === info.systemId && !f.moving);
    const playerPower = playerFleets.reduce((sum, f) => sum + (f.power || 1), 0);
    if (playerPower <= 0) return null;

    const pd = planet.pirateData;
    const result = { playerPower, piratePower: pd.power, won: false, shipsLost: [], planetId };

    if (playerPower > pd.power) {
        pd.defeated = true;
        planet.pirate = false;
        result.won = true;
        events.dispatchEvent(new CustomEvent('pirate-defeated', { detail: result }));
    } else {
        let powerToLose = pd.power - playerPower;
        const sorted = [...playerFleets].sort((a, b) => (a.power || 1) - (b.power || 1));
        for (const fleet of sorted) {
            if (powerToLose <= 0) break;
            result.shipsLost.push(fleet);
            powerToLose -= (fleet.power || 1);
        }
        result.shipsLost.forEach(lost => {
            const idx = gameState.fleets.indexOf(lost);
            if (idx >= 0) gameState.fleets.splice(idx, 1);
        });
        pd.power = Math.max(1, pd.power - playerPower);
        events.dispatchEvent(new CustomEvent('pirate-battle-lost', { detail: result }));
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return result;
}

// Original home pirate battle (keeps existing behavior for home system pirates)
function _resolveHomePirateBattle() {
    const pb = gameState.pirateBase;
    if (!pb || pb.defeated) return null;

    const playerFleets = (gameState.fleets || []).filter(f => f.systemId === pb.systemId && !f.moving);
    const playerPower = playerFleets.reduce((sum, f) => sum + (f.power || 1), 0);
    if (playerPower <= 0) return null;

    const result = { playerPower, piratePower: pb.power, won: false, shipsLost: [] };

    if (playerPower > pb.power) {
        pb.defeated = true;
        result.won = true;
        for (const sys of gameState.systems) {
            const planet = sys.planets.find(p => p.id === pb.planetId);
            if (planet) { planet.pirate = false; break; }
        }
        events.dispatchEvent(new CustomEvent('pirate-defeated', { detail: result }));
    } else {
        let powerToLose = pb.power - playerPower;
        const sorted = [...playerFleets].sort((a, b) => (a.power || 1) - (b.power || 1));
        for (const fleet of sorted) {
            if (powerToLose <= 0) break;
            result.shipsLost.push(fleet);
            powerToLose -= (fleet.power || 1);
        }
        result.shipsLost.forEach(lost => {
            const idx = gameState.fleets.indexOf(lost);
            if (idx >= 0) gameState.fleets.splice(idx, 1);
        });
        pb.power = Math.max(1, pb.power - playerPower);
        events.dispatchEvent(new CustomEvent('pirate-battle-lost', { detail: result }));
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    return result;
}
