# System View Enhancement: Moons & Asteroid Belts

## Summary
Add decorative moons to planets and asteroid belts to systems in the single-system view.

## Files to Modify
1. `src/core/galaxy_generator.js` — Add moon + asteroid belt data generation
2. `src/visuals/visuals_system.js` — Render moons and asteroid belts

## Design

### Moons (Data Model)

Each planet gains an optional `moons` array during generation:

```javascript
planet.moons = [
  {
    size: 0.25,        // fraction of parent planet size (0.2-0.35)
    orbitRadius: 3.5,  // distance from parent center (in world units)
    angle: 1.2,        // starting angle (radians)
    speed: 0.02,       // orbit speed
    color: 0xaaaaaa    // surface tint
  }
]
```

**Moon assignment rules:**
- Gas Giant: 70% chance, 1-2 moons
- Terran/Continental/Ocean: 40% chance, 0-1 moon
- Barren/Desert/Ice/Arctic: 20% chance, 0-1 moon
- Molten/Asteroid/Tomb: 0 moons

### Moons (Rendering)

- Small `SphereGeometry` (parent.size * moon.size * 2, 16 segments)
- `MeshStandardMaterial` with grey/brown tint, roughness 0.85
- No atmosphere, no glow sprites (too small)
- Faint orbit ring around parent (LineLoop, 64 segments, opacity 0.15)
- Parented to a group that follows the planet position each frame
- Orbit on slightly tilted plane (random 0.1-0.4 radian inclination)

### Asteroid Belt (Data Model)

System gains an optional `asteroidBelt` property:

```javascript
system.asteroidBelt = {
  distance: 35,     // orbital distance from star center
  width: 4,         // radial spread
  count: 100        // number of rocks (adjusted for mobile)
}
```

**Assignment:** ~35% of systems get a belt. Distance placed in a gap between planet orbits, or beyond the outermost planet.

### Asteroid Belt (Rendering)

- `InstancedMesh` with `IcosahedronGeometry(0.3, 0)` (low-poly rock)
- Desktop: 80-120 instances, Mobile: 40-60 instances
- Each instance: random position in torus (distance +/- width/2), random Y spread (-1 to +1), random rotation matrix, random scale (0.5-1.5x)
- Material: `MeshStandardMaterial`, brownish-grey, roughness 0.9, metalness 0.1
- Slow rotation animation: entire belt group rotates ~0.0002 rad/frame
- Faint guide ring (LineLoop) at belt center distance, opacity 0.2

### Animation Updates

In `updateSystemAnimations`:
- Moon groups track parent planet position, then moons orbit within the group
- Asteroid belt group rotates slowly around Y axis
- Individual asteroid tumble via per-instance rotation (optional, perf-dependent)

### Performance Budget
- Moons: max ~10 extra spheres per system (negligible)
- Asteroid belt: 1 InstancedMesh draw call with 40-120 instances (negligible)
- Mobile: reduced counts, fewer segments
