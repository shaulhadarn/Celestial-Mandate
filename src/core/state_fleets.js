/* Fleet movement and connectivity logic */
import { gameState, events, getSystem } from './state.js';

/**
 * Orders a fleet (ship) to move to a connected system via hyperlane.
 * @param {number} fleetIndex - Index in gameState.fleets
 * @param {number} targetSystemId - Destination system ID
 * @returns {boolean} Whether the order was accepted
 */
export function moveFleet(fleetIndex, targetSystemId) {
    const fleet = gameState.fleets[fleetIndex];
    if (!fleet) return false;
    if (fleet.moving) return false; // already in transit

    const currentSys = getSystem(fleet.systemId);
    if (!currentSys) return false;

    // Check if destination is connected via hyperlane
    if (!currentSys.connections.includes(targetSystemId)) return false;

    const targetSys = getSystem(targetSystemId);
    if (!targetSys) return false;

    fleet.moving = {
        fromId: fleet.systemId,
        toId: targetSystemId,
        toName: targetSys.name,
        progress: 0,
        total: 10, // 10 ticks to travel
    };
    events.dispatchEvent(new CustomEvent('fleet-moving', { detail: { fleet } }));
    return true;
}

export function tickFleetMovement() {
    if (!gameState.fleets) return;
    gameState.fleets.forEach(fleet => {
        if (!fleet.moving) return;
        fleet.moving.progress++;
        if (fleet.moving.progress >= fleet.moving.total) {
            fleet.systemId = fleet.moving.toId;
            fleet.systemName = fleet.moving.toName;
            const arrival = fleet.moving;
            fleet.moving = null;
            events.dispatchEvent(new CustomEvent('fleet-arrived', { detail: { fleet, arrival } }));
        }
    });
}

export function getConnectedSystems(systemId) {
    const sys = getSystem(systemId);
    if (!sys) return [];
    return sys.connections.map(id => getSystem(id)).filter(Boolean);
}
