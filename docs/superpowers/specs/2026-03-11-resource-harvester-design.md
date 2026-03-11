# Resource Harvester — Design Spec

## Overview

A deployable structure that extracts bonus resources based on planet type. Built from the colony menu in a dedicated "Harvesters" section, visible as a 3D structure on the planet surface during exploration, and repositionable by flying the drone near it.

## Goals

- Add strategic depth: planet type matters more when choosing where to colonize
- Make planet exploration purposeful: colony buildings visible, harvesters can be relocated
- Integrate cleanly with existing building/resource/tick systems

## Building Definition

| Property | Value |
|----------|-------|
| Name | Resource Harvester |
| Icon | 🏭 |
| Cost | 120 Minerals |
| Build Time | 6 ticks |
| Energy Upkeep | -1 per tick |
| Max per Colony | 2 (separate slots, does not count toward 5-building cap) |

Added to the `BUILDINGS` object in `state.js` with an `isHarvester: true` flag to distinguish it from regular buildings.

## Planet-Type Yield Table

Each harvester produces a total of +5 resources per tick, distributed by planet type. The galaxy generator creates 5 types: Terran, Gas Giant, Barren, Molten, Ice. Gas Giants cannot be colonized (no landing), so they have no yield entry.

| Planet Type | Energy | Minerals | Food | Notes |
|-------------|--------|----------|------|-------|
| Terran | +1 | +1 | +3 | Food-rich biosphere |
| Molten | +2 | +3 | +0 | Mineral extraction from lava flows |
| Barren | +1 | +3 | +1 | Surface mineral deposits |
| Ice | +2 | +2 | +1 | Geothermal + ice mining |
| Gas Giant | — | — | — | Cannot be colonized/landed on |

Default/fallback yield for any unmapped type: `{ energy: 1, minerals: 2, food: 2 }`.

Stored as a `HARVESTER_YIELDS` constant in `state.js`.

## Data Model Changes

### Colony Object — New Fields

```javascript
colony.harvesters = [
  {
    id: 0,                    // 0 or 1 (max 2)
    position: { x: 40, z: -30 }, // terrain coordinates on planet surface
    active: true
  }
]
colony.harvesterConstruction = [
  {
    id: 0,
    progress: 3,
    total: 6
  }
]
```

- `harvesters` array stores completed harvesters with their planet-surface positions
- `harvesterConstruction` array stores in-progress builds (same pattern as `colony.construction`)
- Default position assigned on completion; player can relocate via drone

### BUILDINGS Entry

Follows the exact schema of existing buildings (`cost` as object, `production`, `color`, `borderColor`):

```javascript
BUILDINGS.harvester = {
  name: "Resource Harvester",
  icon: "🏭",
  cost: { minerals: 120 },
  buildTime: 6,
  maintenance: { energy: 1 },
  production: {},              // actual yields are planet-dependent, handled in tick
  maxPerColony: 2,
  isHarvester: true,
  color: 'rgba(255, 170, 0, 0.15)',
  borderColor: '#ffaa00'
}
```

**Important:** The `isHarvester` flag is used to:
- Filter harvesters OUT of the regular building construction list in `ui_colony.js`
- Skip the 5-building-cap check in construction logic
- Harvesters are stored in `colony.harvesters` / `colony.harvesterConstruction`, NOT in `colony.buildings` / `colony.construction` — so the existing building tick loop never processes them and there is no double-counting of maintenance

## Resource Tick Integration

In `tickResources()` within `state.js`, after iterating colony buildings:

1. Loop through `colony.harvesters` (not `colony.buildings` — harvesters are separate)
2. Look up planet type from the planet data for this colony's planet ID
3. Look up yields from `HARVESTER_YIELDS[planetType]` (with fallback for unmapped types)
4. Add yields to colony income (energy, minerals, food)
5. Subtract maintenance (-1 energy per active harvester)
6. Advance `colony.harvesterConstruction` progress; on completion, move to `colony.harvesters` array with a default position and dispatch `'harvester-complete'` event

## Function Definitions

### `buildHarvester(planetId, instant = false)`

```
1. Find colony for planetId
2. Count existing: colony.harvesters.length + colony.harvesterConstruction.length
3. If count >= 2, return false (max reached)
4. Cost = instant ? BUILDINGS.harvester.cost.minerals * 2 : BUILDINGS.harvester.cost.minerals
5. If gameState.resources.minerals < cost, return false
6. Deduct minerals
7. If instant: push to colony.harvesters with default position { x: 30 + id*20, z: 30 }
8. Else: push to colony.harvesterConstruction with { id, progress: 0, total: 6 }
9. Dispatch 'selection-changed' event to refresh UI
10. Return true
```

### `relocateHarvester(planetId, harvesterId, newPos)`

```
1. Find colony for planetId
2. Find harvester in colony.harvesters by id
3. Update harvester.position = { x: newPos.x, z: newPos.z }
4. Dispatch 'selection-changed' event
```

## Colony Panel UI Changes

File: `src/ui/ui_colony.js`

### New "Harvesters" Section

Added below the existing building grid, separated by a divider:

- Header: `⛏ HARVESTERS (N/2)` in amber/orange color (#ffaa00)
- For each completed harvester: card showing icon, "Harvester #N", planet yield type label, and per-resource yields (⚡+X 💎+X 🍏+X)
- For each under-construction harvester: card with progress bar (same style as building construction)
- Empty slot: "+" Build Harvester" button with cost/time display
- Button disabled if minerals < 120 or harvesters already at max (2)
- Instant build option at 2x cost (240 minerals), consistent with existing buildings
- **Filter:** The existing building construction list loop (`Object.keys(BUILDINGS)`) must filter out entries where `isHarvester === true` so the harvester doesn't appear in the regular build menu

### Yield Display in Colonies Overview

File: `src/ui/ui_colonies_overview.js`

- Colony cards already show production rates; harvester yields are included in those totals automatically since they're added in `tickResources()`

## Planet Exploration Changes

### A. Colony Buildings Visible

File: `src/visuals/visuals_planet.js`

- Change `colonyBuildingsGroup.visible = false` (line 276) to `true` when the planet has a colony
- Colony hub + all buildings render on terrain via existing `renderColonyGroundBuildings()`

### B. Drone Spawn Near Colony

File: `src/visuals/visuals_planet.js`

- If planet has a colony, spawn drone near the colony hub (position 0, ground+4.5, 10) instead of hardcoded (25, ground+4.5, 25)
- If no colony, keep current spawn position

### C. Harvester 3D Models

File: `src/visuals/visuals_planet_colony.js`

Add harvester rendering to `renderColonyGroundBuildings()`:

- Each harvester rendered at its stored `position.x, position.z` on terrain
- Visual: drilling rig / extractor structure — tall vertical beam with a rotating top element and pulsing amber beacon light
- Geometry: `CylinderGeometry` base + `ConeGeometry` drill bit + `PointLight` beacon (color: #ffaa00)
- Animated in the planet physics update loop: slow rotation on the top element, pulsing beacon light

### D. Drone Proximity Interaction

File: `src/visuals/visuals_planet.js`

- Each frame, check distance between drone (`playerMesh.position`) and each harvester mesh
- When drone is within 15 units of a harvester: show floating "Relocate" UI button (HTML overlay positioned via 3D-to-screen projection)
- On "Relocate" click: enter placement mode
  - UI shows "Fly to new location and press [Place]" message
  - Drone flight continues normally
  - "Place" button appears in the HUD
  - On "Place" click: update `colony.harvesters[id].position` to drone's current x/z, re-render harvester mesh at new position, exit placement mode
  - "Cancel" button returns to normal mode without moving

### E. Exploration HUD

- When in placement mode, tint the screen edges slightly amber to indicate active placement
- Show harvester yield info in a small tooltip when drone is near a harvester

## Save/Load Compatibility

- `colony.harvesters` and `colony.harvesterConstruction` default to `[]` if missing (backward compatible with existing saves)
- Harvester positions stored as simple `{x, z}` objects (serializable)

## Files Modified

| File | Changes |
|------|---------|
| `src/core/state.js` | Add `HARVESTER_YIELDS`, `BUILDINGS.harvester`, harvester construction/tick logic, `buildHarvester()`, `relocateHarvester()` exports |
| `src/ui/ui_colony.js` | Add harvesters section to colony panel UI |
| `src/visuals/visuals_planet.js` | Colony visible on landing, drone spawn near colony, proximity interaction, placement mode |
| `src/visuals/visuals_planet_colony.js` | Render harvester 3D models with animation |

## Out of Scope

- Harvester upgrades or leveling
- Different harvester types
- Harvester destruction/damage mechanics
- New resource types (harvesters use existing energy/minerals/food)
