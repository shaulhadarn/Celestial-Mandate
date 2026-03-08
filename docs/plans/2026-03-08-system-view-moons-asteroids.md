# System View Moons & Asteroid Belts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add decorative moons orbiting planets and asteroid belts to the single-system view.

**Architecture:** Extend `galaxy_generator.js` to produce moon data per planet and asteroid belt data per system. Extend `visuals_system.js` to render moons as small spheres orbiting their parent planet, and asteroid belts as InstancedMesh torus rings. All new visuals are decorative (no click/label interaction).

**Tech Stack:** Three.js (SphereGeometry, InstancedMesh, LineLoop), existing planet texture/material pipeline.

---

### Task 1: Add Moon Data to Planet Generation

**Files:**
- Modify: `src/core/galaxy_generator.js:110-120` (planet generation loop)

**Step 1: Add moon generation logic after each planet is created**

Inside `generateSystemData`, after each planet object is pushed, add a `moons` array based on planet type:

```javascript
// Add after line 118 (after the planet object is created in the for loop)
// Moon generation rules by planet type
const moonChance = { 'Gas Giant': 0.7, 'Terran': 0.4, 'Continental': 0.4, 'Ocean': 0.4, 'Ice': 0.2, 'Arctic': 0.2, 'Barren': 0.2, 'Desert': 0.2 };
const maxMoons = { 'Gas Giant': 2, 'Terran': 1, 'Continental': 1, 'Ocean': 1, 'Ice': 1, 'Arctic': 1, 'Barren': 1, 'Desert': 1 };
const chance = moonChance[planet.type] || 0;
const max = maxMoons[planet.type] || 0;
const moons = [];
if (Math.random() < chance) {
    const count = 1 + (max > 1 && Math.random() > 0.5 ? 1 : 0);
    for (let m = 0; m < count; m++) {
        moons.push({
            size: 0.2 + Math.random() * 0.15,       // 20-35% of parent
            orbitRadius: 3.0 + m * 2.0 + Math.random(),  // world units from parent center
            angle: Math.random() * Math.PI * 2,
            speed: 0.015 + Math.random() * 0.015,
            inclination: 0.1 + Math.random() * 0.3,  // tilt in radians
            color: Math.random() > 0.5 ? 0xaaaaaa : 0x998877  // grey or brownish
        });
    }
}
planet.moons = moons;
```

The homeworld planet (line 99-107) also needs `moons: []` added.

**Step 2: Verify no breakage**

Run the dev server and confirm galaxy generation still works (open browser, start new game or load).

**Step 3: Commit**

```bash
git add src/core/galaxy_generator.js
git commit -m "feat: generate moon data for planets in galaxy_generator"
```

---

### Task 2: Add Asteroid Belt Data to System Generation

**Files:**
- Modify: `src/core/galaxy_generator.js:124-134` (system return object)

**Step 1: Add asteroid belt generation before the system return**

After planets are sorted (line 123) and before the return (line 125), add:

```javascript
// ~35% of systems get an asteroid belt
let asteroidBelt = null;
if (planets.length >= 2 && Math.random() < 0.35) {
    // Place belt in the largest gap between planets, or after outermost
    let bestGap = 0, beltDist = 0;
    for (let i = 0; i < planets.length - 1; i++) {
        const gap = planets[i + 1].distance - planets[i].distance;
        if (gap > bestGap) {
            bestGap = gap;
            beltDist = planets[i].distance + gap * 0.5;
        }
    }
    // Only place if gap is meaningful (> 8 units)
    if (bestGap > 8) {
        asteroidBelt = {
            distance: beltDist,
            width: 3 + Math.random() * 2,  // radial spread
            count: isMobileDevice ? 50 : 100
        };
    }
}
```

Add `asteroidBelt` to the returned system object alongside `connections` and `surveyed`.

Note: Need to import `isMobileDevice` at the top of galaxy_generator.js:
```javascript
import { isMobile as isMobileDevice } from './device.js';
```

**Step 2: Commit**

```bash
git add src/core/galaxy_generator.js
git commit -m "feat: generate asteroid belt data for ~35% of systems"
```

---

### Task 3: Render Moons in System View

**Files:**
- Modify: `src/visuals/visuals_system.js` (inside `createSystemVisuals`, after planet mesh creation ~line 546, and in `updateSystemAnimations`)

**Step 1: Add module-level moon tracking array**

Near the top (after line 76 `_colonySatellites`), add:

```javascript
let _moonGroups = [];  // { parentMesh, pivot, moonMesh, data }[]
```

In `clearSystemVisuals` (line 219), add:
```javascript
_moonGroups = [];
```

**Step 2: After each planet mesh is added to the group, create moon visuals**

After line 546 (`group.add(mesh)`) and before the orbit ring code (line 549), add moon rendering:

```javascript
// ── Moons ──
if (p.moons && p.moons.length > 0) {
    p.moons.forEach(moonData => {
        const moonRadius = p.size * moonData.size * 2 * scale;
        const moonGeo = new THREE.SphereGeometry(moonRadius, isMobileDevice ? 16 : 24, isMobileDevice ? 16 : 24);
        const moonMat = new THREE.MeshStandardMaterial({
            color: moonData.color,
            roughness: 0.85,
            metalness: 0.05,
            emissive: new THREE.Color(0x111111),
            emissiveIntensity: 0.1
        });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);

        // Moon orbit pivot — positioned at planet, tilted
        const moonPivot = new THREE.Group();
        moonPivot.rotation.x = moonData.inclination;
        moonPivot.rotation.z = Math.random() * 0.2;

        // Position moon at its orbit radius from parent center
        const moonOrbitR = moonData.orbitRadius;
        moonMesh.position.set(
            Math.cos(moonData.angle) * moonOrbitR,
            0,
            Math.sin(moonData.angle) * moonOrbitR
        );
        moonPivot.add(moonMesh);

        // Faint moon orbit ring
        const moonOrbitPts = [];
        for (let mo = 0; mo <= 64; mo++) {
            const theta = (mo / 64) * Math.PI * 2;
            moonOrbitPts.push(new THREE.Vector3(
                Math.cos(theta) * moonOrbitR, 0, Math.sin(theta) * moonOrbitR
            ));
        }
        const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
        const moonOrbitMat = new THREE.LineBasicMaterial({
            color: 0x66aadd, opacity: 0.15, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        moonPivot.add(new THREE.LineLoop(moonOrbitGeo, moonOrbitMat));

        // The pivot is parented to the scene group, but tracks planet position each frame
        group.add(moonPivot);

        _moonGroups.push({
            parentMesh: mesh,
            pivot: moonPivot,
            moonMesh: moonMesh,
            data: moonData
        });
    });
}
```

**Step 3: Animate moons in updateSystemAnimations**

After the `planetLabels.forEach` block (~line 785), add:

```javascript
// ── Animate moons ─────────────────────────────────────────────────────
_moonGroups.forEach(entry => {
    // Track parent planet position
    entry.pivot.position.copy(entry.parentMesh.position);

    // Orbit the moon around the pivot
    const a = entry.data.angle + time * entry.data.speed * 10;
    entry.moonMesh.position.x = Math.cos(a) * entry.data.orbitRadius;
    entry.moonMesh.position.z = Math.sin(a) * entry.data.orbitRadius;
    entry.moonMesh.rotation.y += 0.008;
});
```

**Step 4: Verify visually**

Open a system with gas giants — should see small grey/brown spheres orbiting them with faint orbit rings.

**Step 5: Commit**

```bash
git add src/visuals/visuals_system.js
git commit -m "feat: render decorative moons orbiting planets in system view"
```

---

### Task 4: Render Asteroid Belts in System View

**Files:**
- Modify: `src/visuals/visuals_system.js` (inside `createSystemVisuals` after all planets, and in `updateSystemAnimations`)

**Step 1: Add module-level asteroid belt tracking**

Near the moon tracking array, add:
```javascript
let _asteroidBelt = null;  // { mesh: InstancedMesh, group: Group }
```

In `clearSystemVisuals`, add:
```javascript
_asteroidBelt = null;
```

**Step 2: After all planets are rendered, add asteroid belt**

At the end of `createSystemVisuals` (after the `system.planets.forEach` closing brace, ~line 580), add:

```javascript
// ── Asteroid Belt ─────────────────────────────────────────────────────
if (system.asteroidBelt) {
    const belt = system.asteroidBelt;
    const beltGroup = new THREE.Group();

    // InstancedMesh for rocks
    const rockGeo = new THREE.IcosahedronGeometry(0.3, 0);
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x887766,
        roughness: 0.9,
        metalness: 0.1,
        emissive: new THREE.Color(0x111111),
        emissiveIntensity: 0.05
    });
    const count = belt.count;
    const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = belt.distance + (Math.random() - 0.5) * belt.width;
        const y = (Math.random() - 0.5) * 1.5;

        dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.5 + Math.random() * 1.0;
        dummy.scale.set(s, s * (0.6 + Math.random() * 0.4), s);
        dummy.updateMatrix();
        rockMesh.setMatrixAt(i, dummy.matrix);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    beltGroup.add(rockMesh);

    // Faint guide ring at belt center distance
    const beltRingPts = [];
    for (let j = 0; j <= 128; j++) {
        const theta = (j / 128) * Math.PI * 2;
        beltRingPts.push(new THREE.Vector3(
            Math.cos(theta) * belt.distance, 0, Math.sin(theta) * belt.distance
        ));
    }
    const beltRingGeo = new THREE.BufferGeometry().setFromPoints(beltRingPts);
    const beltRingMat = new THREE.LineBasicMaterial({
        color: 0x998877, opacity: 0.2, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    beltGroup.add(new THREE.LineLoop(beltRingGeo, beltRingMat));

    group.add(beltGroup);
    _asteroidBelt = { group: beltGroup };
}
```

**Step 3: Animate asteroid belt rotation**

In `updateSystemAnimations`, after the moon animation block, add:

```javascript
// ── Animate asteroid belt ─────────────────────────────────────────────
if (_asteroidBelt) {
    _asteroidBelt.group.rotation.y += 0.0002;
}
```

**Step 4: Verify visually**

Reload and navigate between systems — ~35% should show an asteroid belt ring of small rocks between planet orbits.

**Step 5: Commit**

```bash
git add src/visuals/visuals_system.js
git commit -m "feat: render asteroid belt with InstancedMesh rocks in system view"
```

---

### Task 5: Final Polish & Edge Cases

**Files:**
- Modify: `src/core/galaxy_generator.js` (homeworld planet moons)
- Modify: `src/visuals/visuals_system.js` (cleanup verification)

**Step 1: Ensure homeworld planet gets moons array**

In the homeworld planet creation (line 99-107), add `moons: []` to the object so moon rendering code doesn't error on undefined.

**Step 2: Verify clearSystemVisuals properly disposes new objects**

The existing `disposeGroup(group)` in `clearSystemVisuals` recursively disposes all children including our new meshes and geometries. Confirm by switching between systems multiple times — no visual artifacts or memory leaks.

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: ensure homeworld planet has moons array, verify cleanup"
```
