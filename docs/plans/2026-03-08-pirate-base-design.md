# Pirate Base Feature Design

## Overview

The player's home system contains a pirate base on one of its planets. Pirates raid the homeworld each tick cycle, stealing resources. The player must build a shipyard, construct ships, and send them to defeat the pirates in an animated battle. Once defeated, the planet becomes colonizable.

## World Generation

- Home system (id 0) guaranteed 4+ planets
- Second planet by distance tagged `pirate: true`, forced to Barren or Molten type
- Named menacingly (e.g. "Corsair's Den")

## Game State

```
pirateBase: {
    planetId, systemId: 0, power: 5,
    raidTimer: 0, raidInterval: 15,
    defeated: false, battleInProgress: false
}
```

## Pirate Raids

- Each tick: increment raidTimer
- At raidInterval: steal 3-8 minerals + 2-5 energy, show notification
- Reset timer with randomness (12-18 ticks)
- Stop when defeated or player has 0 resources

## Visuals (System View)

- Dark angular pirate station orbiting the pirate planet (red/orange accents)
- 2-3 red pirate fighter ships flying raid routes to homeworld
- Removed when pirates defeated

## Combat — Animated Battle

Player clicks "Attack Pirate Base" when they have ships in system:

1. Player ships fly toward pirate planet (~2s)
2. Weapon flash effects at contact point (~2s)
3. Win: explosion + station fade, event modal announcing victory
4. Lose: ships retreat, lost ships removed, event modal

Win condition: player total power > pirate power (5)
Lose: player loses ships worth (pirate power - player power), pirate power reduced by player's power

## Post-Victory

- Planet loses `pirate: true`, becomes colonizable
- Standard colony founding applies (300 minerals + 100 food)

## Files

| File | Changes |
|------|---------|
| `galaxy_generator.js` | 4+ home planets, pirate planet tag |
| `state.js` | pirateBase state, raid logic in updateResources |
| `visuals_system.js` | Pirate station mesh, fighters, battle animation |
| `ui_selection.js` | "Attack Pirate Base" button |
| `ui_events.js` / `ui_notifications.js` | Raid + battle notifications |
