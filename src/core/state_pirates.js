/* Pirate raid tick and battle resolution logic */
import { gameState, events } from './state.js';

// ── Pirate Raids ─────────────────────────────────────────────────────────────
export function tickPirateRaids() {
    const pb = gameState.pirateBase;
    if (!pb || pb.defeated || pb.battleInProgress) return;

    pb.raidTimer++;

    // Show pirate intro conversation ~15 ticks into the game (before raids start)
    if (!pb.introShown && pb.raidTimer >= -30) {
        pb.introShown = true;
        events.dispatchEvent(new CustomEvent('pirate-intro'));
    }

    if (pb.raidTimer < pb.raidInterval) return;

    // Raid! Steal resources
    const stolenMinerals = Math.min(gameState.resources.minerals, 3 + Math.floor(Math.random() * 6));
    const stolenEnergy = Math.min(gameState.resources.energy, 2 + Math.floor(Math.random() * 4));

    if (stolenMinerals <= 0 && stolenEnergy <= 0) {
        pb.raidTimer = 0;
        return; // Nothing to steal
    }

    gameState.resources.minerals -= stolenMinerals;
    gameState.resources.energy -= stolenEnergy;

    events.dispatchEvent(new CustomEvent('pirate-raid', {
        detail: { minerals: stolenMinerals, energy: stolenEnergy }
    }));
    events.dispatchEvent(new CustomEvent('resources-updated'));

    // Reset with randomness
    pb.raidTimer = 0;
    pb.raidInterval = 25 + Math.floor(Math.random() * 15);
}

// ── Pirate Battle Resolution ─────────────────────────────────────────────────
export function resolvePirateBattle() {
    const pb = gameState.pirateBase;
    if (!pb || pb.defeated) return null;

    const playerFleets = (gameState.fleets || []).filter(f => f.systemId === pb.systemId && !f.moving);
    const playerPower = playerFleets.reduce((sum, f) => sum + (f.power || 1), 0);

    if (playerPower <= 0) return null;

    const result = { playerPower, piratePower: pb.power, won: false, shipsLost: [] };

    if (playerPower > pb.power) {
        // Victory
        pb.defeated = true;
        result.won = true;

        // Remove pirate flag from planet so it can be colonized
        for (const sys of gameState.systems) {
            const planet = sys.planets.find(p => p.id === pb.planetId);
            if (planet) { planet.pirate = false; break; }
        }

        events.dispatchEvent(new CustomEvent('pirate-defeated', { detail: result }));
    } else {
        // Defeat — lose ships worth the difference, reduce pirate power
        let powerToLose = pb.power - playerPower;
        // Sort weakest first for removal
        const sorted = [...playerFleets].sort((a, b) => (a.power || 1) - (b.power || 1));
        for (const fleet of sorted) {
            if (powerToLose <= 0) break;
            result.shipsLost.push(fleet);
            powerToLose -= (fleet.power || 1);
        }
        // Remove lost ships from gameState
        result.shipsLost.forEach(lost => {
            const idx = gameState.fleets.indexOf(lost);
            if (idx >= 0) gameState.fleets.splice(idx, 1);
        });
        // Reduce pirate power by what the player brought
        pb.power = Math.max(1, pb.power - playerPower);

        events.dispatchEvent(new CustomEvent('pirate-battle-lost', { detail: result }));
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    return result;
}
