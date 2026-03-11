# Resource Harvester Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Resource Harvester building that produces planet-type-dependent resources, with 3D representation on the planet surface and drone-based relocation.

**Architecture:** Harvester data lives in `colony.harvesters[]` / `colony.harvesterConstruction[]` (separate from the 5-slot building system). Yields are computed per tick based on the planet's type via a `HARVESTER_YIELDS` lookup table. Colony UI gets a new "Harvesters" section. Planet exploration shows colony buildings (currently hidden) and renders harvesters as interactive 3D structures.

**Tech Stack:** Three.js, vanilla JS, HTML/CSS (no framework for UI)

**Spec:** `docs/superpowers/specs/2026-03-11-resource-harvester-design.md`

---

## Chunk 1: Core Data & Game Logic

### Task 1: Add HARVESTER_YIELDS constant and BUILDINGS.harvester entry

**Files:**
- Modify: `src/core/state.js:75-126` (after existing BUILDINGS block)

- [ ] **Step 1: Add HARVESTER_YIELDS constant after BUILDINGS**

In `src/core/state.js`, directly after the closing `};` of the `BUILDINGS` object (line 126), add:

```javascript
export const HARVESTER_YIELDS = {
    'Terran':  { energy: 1, minerals: 1, food: 3 },
    'Molten':  { energy: 2, minerals: 3, food: 0 },
    'Barren':  { energy: 1, minerals: 3, food: 1 },
    'Ice':     { energy: 2, minerals: 2, food: 1 },
};
export const HARVESTER_YIELD_DEFAULT = { energy: 1, minerals: 2, food: 2 };
```

- [ ] **Step 2: Add harvester entry to BUILDINGS object**

Inside the `BUILDINGS` object (before its closing `}`), add:

```javascript
    'harvester': {
        name: "Resource Harvester",
        icon: "🏭",
        cost: { minerals: 120 },
        buildTime: 6,
        maintenance: { energy: 1 },
        production: {},
        maxPerColony: 2,
        isHarvester: true,
        color: 'rgba(255, 170, 0, 0.15)',
        borderColor: '#ffaa00'
    }
```

- [ ] **Step 3: Verify the game still loads**

Open the game in the browser. Confirm the galaxy map renders and no console errors appear. The harvester building shouldn't appear in any UI yet.

- [ ] **Step 4: Commit**

```bash
git add src/core/state.js
git commit -m "feat: add HARVESTER_YIELDS and BUILDINGS.harvester definition"
```

---

### Task 2: Add buildHarvester() and relocateHarvester() functions

**Files:**
- Modify: `src/core/state.js` (after `buildBuilding()` at line ~856)

- [ ] **Step 1: Add buildHarvester function**

After the `buildBuilding()` function, add:

```javascript
export function buildHarvester(planetId, isInstant = false) {
    const col = gameState.colonies[planetId];
    if (!col) return false;

    // Ensure harvester arrays exist (backward compat)
    if (!col.harvesters) col.harvesters = [];
    if (!col.harvesterConstruction) col.harvesterConstruction = [];

    const totalCount = col.harvesters.length + col.harvesterConstruction.length;
    if (totalCount >= BUILDINGS.harvester.maxPerColony) return false;

    let cost = BUILDINGS.harvester.cost.minerals;
    if (isInstant) cost *= 2;
    if (gameState.resources.minerals < cost) return false;

    gameState.resources.minerals -= cost;

    const nextId = totalCount; // 0 or 1

    if (isInstant) {
        col.harvesters.push({
            id: nextId,
            position: { x: 30 + nextId * 20, z: 30 },
            active: true
        });
        events.dispatchEvent(new CustomEvent('harvester-complete', { detail: { planetId } }));
    } else {
        col.harvesterConstruction.push({
            id: nextId,
            progress: 0,
            total: BUILDINGS.harvester.buildTime
        });
    }

    events.dispatchEvent(new CustomEvent('resources-updated'));
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}

export function relocateHarvester(planetId, harvesterId, newPos) {
    const col = gameState.colonies[planetId];
    if (!col || !col.harvesters) return false;

    const harvester = col.harvesters.find(h => h.id === harvesterId);
    if (!harvester) return false;

    harvester.position = { x: newPos.x, z: newPos.z };
    events.dispatchEvent(new CustomEvent('selection-changed'));
    return true;
}
```

- [ ] **Step 2: Guard buildBuilding() against harvester key**

In the existing `buildBuilding()` function (line ~822), after the `if (!col || !b) return false;` check, add:

```javascript
    if (b.isHarvester) return false; // harvesters use buildHarvester() instead
```

This prevents accidentally adding a harvester to the regular 5-slot building system.

- [ ] **Step 3: Export the new functions**

The functions use `export` keyword directly, so they're automatically available. Verify `getPlanet` is already exported (it is, at line 602).

- [ ] **Step 4: Commit**

```bash
git add src/core/state.js
git commit -m "feat: add buildHarvester() and relocateHarvester() functions"
```

---

### Task 3: Integrate harvesters into tickResources()

**Files:**
- Modify: `src/core/state.js:360-447` (inside the colony loop in `tickResources()`)

- [ ] **Step 1: Add harvester production to colony tick loop**

In `tickResources()`, inside the `Object.entries(gameState.colonies).forEach(...)` loop, after the "Buildings Production" block (after line 389, before "Apply per-colony research bonuses" at line 392), add:

```javascript
        // Harvester Production
        if (!col.harvesters) col.harvesters = [];
        if (!col.harvesterConstruction) col.harvesterConstruction = [];

        const planet = getPlanet(planetId);
        const planetType = planet ? planet.type : null;
        col.harvesters.forEach(() => {
            const yields = HARVESTER_YIELDS[planetType] || HARVESTER_YIELD_DEFAULT;
            colEnergy += yields.energy;
            colMinerals += yields.minerals;
            colFood += yields.food;
            // Maintenance
            colEnergy -= (BUILDINGS.harvester.maintenance.energy || 0);
        });
```

- [ ] **Step 2: Add harvester construction tick**

After the existing "Construction Queue" block (after line 447, the closing `}` of the building construction if-block), add:

```javascript
        // Harvester Construction Queue
        if (col.harvesterConstruction && col.harvesterConstruction.length > 0) {
            const hItem = col.harvesterConstruction[0];
            hItem.progress += 1;

            if (hItem.progress >= hItem.total) {
                col.harvesters.push({
                    id: hItem.id,
                    position: { x: 30 + hItem.id * 20, z: 30 },
                    active: true
                });
                col.harvesterConstruction.shift();

                events.dispatchEvent(new CustomEvent('harvester-complete', {
                    detail: { planetId }
                }));
                events.dispatchEvent(new CustomEvent('resources-updated'));
            }
        }
```

- [ ] **Step 3: Test in game**

Start a new game. Colonize a planet. Use the browser console to manually test:
```javascript
import('/src/core/state.js').then(m => { m.buildHarvester(/* your planet id */, true); });
```
Verify resources tick up faster after building the harvester. Check no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/state.js
git commit -m "feat: integrate harvester production and construction into tick loop"
```

---

## Chunk 2: Colony Panel UI

### Task 4: Filter harvesters from regular build menu

**Files:**
- Modify: `src/ui/ui_colony.js:95` (the `Object.keys(BUILDINGS).forEach` loop)

- [ ] **Step 1: Add isHarvester filter to construction list**

In `renderColonyView()`, line 95 currently reads:
```javascript
        Object.keys(BUILDINGS).forEach(key => {
```

Change it to:
```javascript
        Object.keys(BUILDINGS).filter(key => !BUILDINGS[key].isHarvester).forEach(key => {
```

This prevents the harvester from appearing in the regular building construction list.

- [ ] **Step 2: Also filter in updateColonyDynamicState**

In `updateColonyDynamicState()`, line 281 currently reads:
```javascript
    Object.keys(BUILDINGS).forEach(key => {
```

Change to:
```javascript
    Object.keys(BUILDINGS).filter(key => !BUILDINGS[key].isHarvester).forEach(key => {
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/ui_colony.js
git commit -m "fix: filter harvester out of regular building construction list"
```

---

### Task 5: Add harvesters section to colony panel UI

**Files:**
- Modify: `src/ui/ui_colony.js` (import `buildHarvester`, `HARVESTER_YIELDS`, `getPlanet`; add section after construction list)

- [ ] **Step 1: Update imports**

Line 2 of `ui_colony.js` currently reads:
```javascript
import { gameState, BUILDINGS, buildBuilding, RACE_SHIPS, buildShip } from '../core/state.js';
```

Change to:
```javascript
import { gameState, BUILDINGS, buildBuilding, buildHarvester, HARVESTER_YIELDS, getPlanet, RACE_SHIPS, buildShip } from '../core/state.js';
```

- [ ] **Step 2: Add renderHarvesterSection function**

Add this function before the `renderColonyView` function (after the imports):

```javascript
function renderHarvesterSection(planetId, parentEl) {
    // Remove existing section if re-rendering
    const existing = document.getElementById('colony-harvester-section');
    if (existing) existing.remove();

    const colony = gameState.colonies[planetId];
    if (!colony) return;

    // Ensure arrays exist
    if (!colony.harvesters) colony.harvesters = [];
    if (!colony.harvesterConstruction) colony.harvesterConstruction = [];

    const planet = getPlanet(planetId);
    const planetType = planet ? planet.type : 'Barren';
    const yields = HARVESTER_YIELDS[planetType] || { energy: 1, minerals: 2, food: 2 };
    const maxH = BUILDINGS.harvester.maxPerColony;
    const totalCount = colony.harvesters.length + colony.harvesterConstruction.length;

    const section = document.createElement('div');
    section.id = 'colony-harvester-section';
    section.style.cssText = 'margin-top:16px;border-top:1px solid rgba(255,170,0,0.2);padding-top:14px;';

    let cardsHtml = '';

    // Completed harvesters
    colony.harvesters.forEach((h, i) => {
        cardsHtml += `
            <div style="background:rgba(255,170,0,0.08);border:1px solid rgba(255,170,0,0.3);border-radius:6px;padding:10px;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:20px;">🏭</span>
                    <div>
                        <div style="color:#ffcc44;font-size:13px;font-weight:bold;">Harvester #${i + 1}</div>
                        <div style="color:#888;font-size:11px;">${planetType} yields</div>
                    </div>
                </div>
                <div style="display:flex;gap:12px;margin-top:8px;font-size:12px;">
                    ${yields.energy ? `<span style="color:#ffd700;">⚡+${yields.energy}</span>` : ''}
                    ${yields.minerals ? `<span style="color:#00e5ff;">💎+${yields.minerals}</span>` : ''}
                    ${yields.food ? `<span style="color:#00ff66;">🍏+${yields.food}</span>` : ''}
                    <span style="color:#ff8844;margin-left:auto;">-1⚡</span>
                </div>
            </div>`;
    });

    // Under construction
    colony.harvesterConstruction.forEach((hc) => {
        const pct = Math.floor((hc.progress / hc.total) * 100);
        cardsHtml += `
            <div style="background:rgba(255,170,0,0.05);border:1px dashed rgba(255,170,0,0.25);border-radius:6px;padding:10px;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:20px;opacity:0.5;">🏭</span>
                    <div style="flex:1;">
                        <div style="color:#ffaa00;font-size:12px;">Building Harvester...</div>
                        <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:4px;">
                            <div class="harvester-construction-fill" style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ffaa00,#ffdd44);border-radius:2px;transition:width 0.3s;"></div>
                        </div>
                    </div>
                    <span class="harvester-construction-pct" style="font-size:10px;color:#ffaa00;">${pct}%</span>
                </div>
            </div>`;
    });

    // Empty slot (build button)
    if (totalCount < maxH) {
        const costNormal = BUILDINGS.harvester.cost.minerals;
        const costInstant = costNormal * 2;
        const currentMinerals = gameState.resources.minerals;

        cardsHtml += `
            <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,170,0,0.2);border-radius:6px;padding:12px;text-align:center;">
                <div style="color:#ffaa00;font-size:12px;margin-bottom:8px;">+ Build Harvester</div>
                <div style="display:flex;gap:6px;justify-content:center;">
                    <button id="btn-build-harvester" class="btn-build-action btn-build-normal" style="border-color:#ffaa00;" ${currentMinerals < costNormal ? 'disabled' : ''}>
                        <span>Build (${BUILDINGS.harvester.buildTime}s)</span>
                        <span class="cost-display">💎${costNormal}</span>
                    </button>
                    <button id="btn-instant-harvester" class="btn-build-action btn-build-instant" style="border-color:#ffaa00;" ${currentMinerals < costInstant ? 'disabled' : ''}>
                        <span>Instant</span>
                        <span class="cost-display">💎${costInstant}</span>
                    </button>
                </div>
            </div>`;
    }

    section.innerHTML = `
        <div style="font-size:10px;letter-spacing:2px;color:#ffaa00;text-transform:uppercase;margin-bottom:10px;">⛏ Harvesters (${totalCount}/${maxH})</div>
        ${cardsHtml}
    `;

    parentEl.appendChild(section);

    // Wire build buttons
    const btnBuild = section.querySelector('#btn-build-harvester');
    const btnInstant = section.querySelector('#btn-instant-harvester');

    if (btnBuild) {
        btnBuild.addEventListener('click', () => {
            if (buildHarvester(planetId, false)) {
                showNotification('Harvester construction started!', 'info');
                renderColonyView(planetId);
            } else {
                showNotification('Insufficient Minerals', 'alert');
            }
        });
    }
    if (btnInstant) {
        btnInstant.addEventListener('click', () => {
            if (buildHarvester(planetId, true)) {
                showNotification('Harvester built instantly!', 'success');
                renderColonyView(planetId);
            } else {
                showNotification('Insufficient Minerals', 'alert');
            }
        });
    }
}
```

- [ ] **Step 3: Call renderHarvesterSection from renderColonyView**

In `renderColonyView()`, just before the shipyard section (line 161, the comment `// ── Shipyard Section`), add:

```javascript
    // ── Harvester Section ──────────────────────────────────────────────────────
    const colonyViewEl = document.getElementById('planet-colony-view');
    if (colonyViewEl) renderHarvesterSection(planetId, colonyViewEl);
```

- [ ] **Step 4: Add harvester construction progress updates to updateColonyDynamicState**

At the end of `updateColonyDynamicState()` (before the closing `}`), add:

```javascript
    // Update Harvester Construction Progress
    const hFills = document.querySelectorAll('#colony-harvester-section .harvester-construction-fill');
    const colony2 = gameState.colonies[planetId];
    if (colony2 && colony2.harvesterConstruction) {
        colony2.harvesterConstruction.forEach((hItem, i) => {
            if (hFills[i]) {
                const pct = Math.floor((hItem.progress / hItem.total) * 100);
                hFills[i].style.width = `${pct}%`;
                const text = hFills[i].closest('div')?.parentElement?.querySelector('.harvester-construction-pct');
                if (text) text.innerText = `${pct}%`;
            }
        });
    }

    // Update Harvester Build Button States
    const btnBuildH = document.getElementById('btn-build-harvester');
    const btnInstantH = document.getElementById('btn-instant-harvester');
    if (btnBuildH) btnBuildH.disabled = gameState.resources.minerals < BUILDINGS.harvester.cost.minerals;
    if (btnInstantH) btnInstantH.disabled = gameState.resources.minerals < BUILDINGS.harvester.cost.minerals * 2;
```

- [ ] **Step 5: Test in game**

Start a new game. Colonize a planet. Open the colony view panel. Verify:
- The "⛏ HARVESTERS (0/2)" section appears below the building grid
- The "Build Harvester" button shows with correct cost (💎120)
- Clicking "Build" starts construction (progress bar appears)
- After 6 ticks, the completed harvester card shows with yields
- Building a second harvester works; at 2/2 the build button disappears
- The harvester does NOT appear in the regular building construction list

- [ ] **Step 6: Commit**

```bash
git add src/ui/ui_colony.js
git commit -m "feat: add harvesters section to colony panel UI"
```

---

## Chunk 3: Planet Exploration — Colony Visible & Harvesters

### Task 6: Make colony buildings visible and spawn drone near colony

**Files:**
- Modify: `src/visuals/visuals_planet.js:197-201` (drone spawn), `src/visuals/visuals_planet.js:274-278` (colony visibility)

- [ ] **Step 1: Make colony buildings visible when colony exists**

In `createPlanetVisuals()`, line 274-276 currently reads:
```javascript
    // 6. Colony (hidden on landing - exploration starts with drone only)
    colonyBuildingsGroup = new THREE.Group();
    colonyBuildingsGroup.visible = false;
```

Change to:
```javascript
    // 6. Colony buildings — visible if planet has a colony
    colonyBuildingsGroup = new THREE.Group();
    colonyBuildingsGroup.visible = !!gameState.colonies[planetData.id];
```

- [ ] **Step 2: Spawn drone near colony hub when colony exists**

Lines 198-201 currently read:
```javascript
    playerMesh = createDroneMesh();
    const spawnX = 25, spawnZ = 25;
    const spawnGroundH = getTerrainHeight(spawnX, spawnZ);
    playerMesh.position.set(spawnX, spawnGroundH + 4.5, spawnZ);
```

Change to:
```javascript
    playerMesh = createDroneMesh();
    const hasColony = !!gameState.colonies[planetData.id];
    const spawnX = hasColony ? 0 : 25;
    const spawnZ = hasColony ? 10 : 25;
    const spawnGroundH = getTerrainHeight(spawnX, spawnZ);
    playerMesh.position.set(spawnX, spawnGroundH + 4.5, spawnZ);
```

- [ ] **Step 3: Test in game**

Land on a colonized planet. Verify:
- Colony hub and buildings are visible on the terrain
- Drone starts near the colony hub (not off to the side)
- Landing on an uncolonized planet still works (drone at 25, 25)

- [ ] **Step 4: Commit**

```bash
git add src/visuals/visuals_planet.js
git commit -m "feat: show colony buildings on planet surface, spawn drone near colony"
```

---

### Task 7: Render harvester 3D models on planet surface

**Files:**
- Modify: `src/visuals/visuals_planet_colony.js` (add harvester rendering)

- [ ] **Step 1: Import HARVESTER_YIELDS (not needed, but import getPlanet if useful)**

Line 3 of `visuals_planet_colony.js` currently reads:
```javascript
import { gameState, BUILDINGS } from '../core/state.js';
```

No change needed — we only need `gameState` and `BUILDINGS` which are already imported. The harvester data is on `colony.harvesters`.

- [ ] **Step 2: Add harvester meshes to renderColonyGroundBuildings**

At the end of `renderColonyGroundBuildings()`, after the `colony.buildings.forEach(...)` block (before the closing `}`), add:

```javascript
    // Harvesters
    const harvesters = colony.harvesters || [];
    harvesters.forEach((h) => {
        const hx = h.position.x;
        const hz = h.position.z;
        const hy = heightFn(hx, hz);

        const hGroup = new THREE.Group();
        hGroup.position.set(hx, hy, hz);
        hGroup.userData = { isHarvester: true, harvesterId: h.id };

        // Base platform
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x554422, roughness: 0.6, metalness: 0.4 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 2, 8), baseMat);
        base.position.y = 1;
        base.castShadow = true;
        base.receiveShadow = true;
        hGroup.add(base);

        // Main drilling column
        const columnMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.15,
            roughness: 0.4,
            metalness: 0.7
        });
        const column = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 14, 8), columnMat);
        column.position.y = 9;
        column.castShadow = true;
        hGroup.add(column);

        // Rotating top arm
        const armMat = new THREE.MeshStandardMaterial({ color: 0xddaa33, metalness: 0.8, roughness: 0.3 });
        const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 1.5, 1.5), armMat);
        arm.position.y = 17;
        arm.userData.rotatingArm = true;
        hGroup.add(arm);

        // Drill bit (cone pointing down into ground)
        const drillMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
        const drill = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 6), drillMat);
        drill.position.y = -1;
        drill.rotation.x = Math.PI; // point downward
        hGroup.add(drill);

        // Amber beacon light
        const beacon = new THREE.PointLight(0xffaa00, 8, 40);
        beacon.position.y = 18;
        beacon.userData.beacon = true;
        hGroup.add(beacon);

        group.add(hGroup);
    });
```

- [ ] **Step 3: Export harvester mesh references for animation**

Add an exported array at the top of the file (after the imports):

```javascript
export let harvesterGroups = [];
```

At the start of `renderColonyGroundBuildings()` (after the `while` loop that clears children), add:
```javascript
    harvesterGroups = [];
```

At the end of the harvester forEach (after `group.add(hGroup)`), add:
```javascript
        harvesterGroups.push(hGroup);
```

- [ ] **Step 4: Commit**

```bash
git add src/visuals/visuals_planet_colony.js
git commit -m "feat: render harvester 3D models on planet surface"
```

---

### Task 8: Animate harvesters (rotating arm + pulsing beacon)

**Files:**
- Modify: `src/visuals/visuals_planet.js` (import `harvesterGroups`, add animation in `updatePlanetPhysics`)

- [ ] **Step 1: Import harvesterGroups**

In `visuals_planet.js`, line 6 currently reads:
```javascript
import { renderColonyGroundBuildings } from './visuals_planet_colony.js';
```

Change to:
```javascript
import { renderColonyGroundBuildings, harvesterGroups } from './visuals_planet_colony.js';
```

- [ ] **Step 2: Add harvester animation to updatePlanetPhysics**

In `updatePlanetPhysics()`, after the existing terrain/dust/creature updates (near the end of the function, before the final `}`), add:

```javascript
    // Animate harvesters — rotating arm + pulsing beacon
    harvesterGroups.forEach(hGroup => {
        hGroup.children.forEach(child => {
            if (child.userData.rotatingArm) {
                child.rotation.y += 0.8 * dt;
            }
            if (child.userData.beacon) {
                child.intensity = 6 + Math.sin(performance.now() * 0.003) * 4;
            }
        });
    });
```

- [ ] **Step 3: Listen for harvester-complete event to refresh visuals**

Near the existing `building-complete` listener (line ~533), add:

```javascript
events.addEventListener('harvester-complete', (e) => {
    if (gameState.viewMode === 'EXPLORATION' && currentPlanetData && e.detail.planetId === currentPlanetData.id) updateColonyBuildings();
});
```

- [ ] **Step 4: Test in game**

Land on a colonized planet with a harvester (instant-build one via console if needed). Verify:
- Harvester structure is visible on the terrain
- The top arm rotates slowly
- The amber beacon light pulses
- Building a harvester while on the planet updates the surface in real time

- [ ] **Step 5: Commit**

```bash
git add src/visuals/visuals_planet.js src/visuals/visuals_planet_colony.js
git commit -m "feat: animate harvester rotating arm and pulsing beacon"
```

---

## Chunk 4: Drone Proximity Interaction & Relocation

### Task 9: Add drone proximity detection and relocate UI

**Files:**
- Modify: `src/visuals/visuals_planet.js` (proximity check in `updatePlanetPhysics`, HTML overlay)
- Modify: `src/core/state.js` (already has `relocateHarvester` from Task 2)

- [ ] **Step 1: Add module-level state for placement mode and import relocateHarvester**

At the top of `visuals_planet.js` (near the other `let` declarations around line 14-18), add:

```javascript
let placementMode = null; // null or { harvesterId, planetId } — set when user clicks Relocate
let nearestHarvesterData = null; // { harvesterId, planetId } — set by proximity detection each frame
```

Also update the existing static import from `state.js` (line 4). It currently imports `gameState, events` — change to:
```javascript
import { gameState, events, relocateHarvester, HARVESTER_YIELDS, HARVESTER_YIELD_DEFAULT } from '../core/state.js';
```

- [ ] **Step 2: Create the proximity/relocate overlay HTML**

Add a function to manage the floating UI. Place it after the `setJoystickInput` function:

```javascript
function _getOrCreateHarvesterHUD() {
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
        if (!nearestHarvesterData) return;
        // Transition from proximity-detected to active placement mode
        placementMode = { ...nearestHarvesterData };
        el.querySelector('#harvester-hud-info').style.display = 'none';
        el.querySelector('#harvester-hud-relocate').style.display = 'none';
        el.querySelector('#harvester-hud-placing').style.display = 'block';
        document.getElementById('harvester-placement-tint').style.display = 'block';
    });

    el.querySelector('#btn-harvester-place').addEventListener('click', () => {
        if (!placementMode || !playerMesh || !currentPlanetData) return;
        relocateHarvester(placementMode.planetId, placementMode.harvesterId, {
            x: playerMesh.position.x,
            z: playerMesh.position.z
        });
        updateColonyBuildings();
        _exitPlacementMode();
    });

    el.querySelector('#btn-harvester-cancel').addEventListener('click', () => {
        _exitPlacementMode();
    });

    return el;
}

function _exitPlacementMode() {
    placementMode = null;
    nearestHarvesterData = null;
    const hud = document.getElementById('harvester-hud');
    if (hud) hud.style.display = 'none';
    const tint = document.getElementById('harvester-placement-tint');
    if (tint) tint.style.display = 'none';
}
```

- [ ] **Step 3: Add proximity check to updatePlanetPhysics**

In `updatePlanetPhysics()`, after the harvester animation code added in Task 8, add:

```javascript
    // Drone proximity to harvesters — show relocate UI or placement HUD
    if (!placementMode) {
        // Not in placement mode — detect proximity to show relocate button + yield tooltip
        let nearHarvester = null;
        harvesterGroups.forEach(hGroup => {
            if (!hGroup.userData.isHarvester) return;
            const dist = playerMesh.position.distanceTo(hGroup.position);
            if (dist < 15) nearHarvester = hGroup;
        });

        const hud = _getOrCreateHarvesterHUD();
        if (nearHarvester && currentPlanetData) {
            nearestHarvesterData = {
                harvesterId: nearHarvester.userData.harvesterId,
                planetId: currentPlanetData.id
            };
            hud.style.display = 'block';
            hud.querySelector('#harvester-hud-info').style.display = 'block';
            hud.querySelector('#harvester-hud-relocate').style.display = 'block';
            hud.querySelector('#harvester-hud-placing').style.display = 'none';

            // Update yield tooltip with planet-type yields (uses imported constants)
            const pType = currentPlanetData.type || 'Barren';
            const y = HARVESTER_YIELDS[pType] || HARVESTER_YIELD_DEFAULT;
            const yieldsEl = hud.querySelector('#harvester-hud-yields');
            if (yieldsEl) yieldsEl.innerHTML = `⚡+${y.energy} 💎+${y.minerals} 🍏+${y.food}`;
        } else {
            nearestHarvesterData = null;
            hud.style.display = 'none';
        }
    } else {
        // In active placement mode — keep the placing HUD visible
        const hud = document.getElementById('harvester-hud');
        if (hud) {
            hud.style.display = 'block';
            hud.querySelector('#harvester-hud-info').style.display = 'none';
            hud.querySelector('#harvester-hud-relocate').style.display = 'none';
            hud.querySelector('#harvester-hud-placing').style.display = 'block';
        }
    }
```

- [ ] **Step 4: Clean up HUD on exit exploration**

Reset placement state at the top of `createPlanetVisuals()` so any stale state is cleared when re-entering exploration. After the existing variable resets at the start of the function, add:

```javascript
    _exitPlacementMode();
```

Also add the same call inside the existing `restoreControlsAfterPlanet()` handler in `renderer.js` — search for where `groups.planet.visible = false` is set in `restoreControlsAfterPlanet()` and add `_exitPlacementMode()` as an exported function. Alternatively, simply reset at the top of `createPlanetVisuals` which is always called on re-entry — this alone is sufficient.

- [ ] **Step 5: Test in game**

Land on a colonized planet with a harvester. Fly the drone near the harvester. Verify:
- "Relocate Harvester" button appears when within ~15 units
- Clicking it switches to placement mode with "Place Here" / "Cancel" buttons
- Flying away and clicking "Place Here" moves the harvester to the new location
- "Cancel" exits placement mode
- Leaving the planet cleans up the HUD

- [ ] **Step 6: Commit**

```bash
git add src/visuals/visuals_planet.js
git commit -m "feat: add drone proximity detection and harvester relocation UI"
```

---

### Task 10: Final integration test and cleanup

- [ ] **Step 1: Full gameplay test**

Play through the following sequence:
1. Start new game → warp to home system
2. Open colony view → verify harvester section shows (0/2)
3. Build a harvester (normal) → verify construction progress bar
4. Wait for completion → verify harvester card with yields appears
5. Build second harvester (instant) → verify it appears immediately
6. Verify build button disappears at 2/2
7. Check resource rates increased in top bar
8. Land on planet → verify colony buildings visible
9. Verify drone starts near colony hub
10. Fly to a harvester → verify "Relocate" button appears
11. Relocate the harvester → verify it moves on the surface
12. Return to galaxy view → verify no errors
13. Navigate to another system → land on uncolonized planet → verify no harvester UI

- [ ] **Step 2: Save/Load backward compatibility test**

If the game has a save/load system, save a game with harvesters, reload it, and verify harvesters persist. Also load an old save (without harvesters) and verify no crashes.

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: resource harvester — complete implementation with planet exploration integration"
```
