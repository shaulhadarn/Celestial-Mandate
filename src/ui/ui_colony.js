/* Updated: Use shared openShipModal from ui_fleets.js instead of duplicate inline code */
import { gameState, BUILDINGS, buildBuilding, RACE_SHIPS, buildShip } from '../core/state.js';
import { showNotification } from './ui_notifications.js';
import { getShipSvg } from './ship_icons.js';
import { openShipModal } from './ui_fleets.js';

/**
 * Renders the detailed view of a colony, including building slots and construction options.
 */
export function renderColonyView(planetId) {
    const colony = gameState.colonies[planetId];
    if(!colony) return;

    // Handle legacy saves without construction array
    if(!colony.construction) colony.construction = [];

    const totalSlots = 5;
    const occupiedSlots = colony.buildings.length + colony.construction.length;

    const popEl = document.getElementById('col-pop');
    popEl.innerHTML = `${colony.population}`;
    
    // Add growth indicator
    if (colony.growthProgress !== undefined) {
        const growthPct = Math.floor(colony.growthProgress);
        popEl.innerHTML += ` <span style="font-size:10px; color:#88ff88;">(+${growthPct}%)</span>`;
    }

    document.getElementById('col-buildings-count').innerText = `${occupiedSlots}/${totalSlots}`; 

    // --- Render Slots Grid ---
    const bList = document.getElementById('colony-building-list');
    if (!bList) return;
    bList.innerHTML = '';

    // 1. Completed Buildings
    colony.buildings.forEach(bKey => {
        const b = BUILDINGS[bKey];
        const el = document.createElement('div');
        el.className = 'building-slot';
        if (b) {
            el.style.backgroundColor = b.color;
            el.style.borderColor = b.borderColor;
            
            let traits = [];
            if(b.production.energy) traits.push(`+${b.production.energy}⚡`);
            if(b.production.minerals) traits.push(`+${b.production.minerals}💎`);
            if(b.production.food) traits.push(`+${b.production.food}🍏`);
            if(traits.length === 0) traits.push("Unique");

            el.innerHTML = `
                <span class="building-icon">${b.icon}</span>
                <div class="building-traits">${traits.join(' ')}</div>
            `;
            el.title = b.name;
        }
        bList.appendChild(el);
    });

    // 2. Under Construction
    colony.construction.forEach(item => {
        const b = BUILDINGS[item.buildingKey];
        const pct = Math.floor((item.progress / item.total) * 100);
        
        const el = document.createElement('div');
        el.className = 'building-slot';
        el.style.borderStyle = 'dashed';
        
        el.innerHTML = `
            <span class="building-icon" style="opacity:0.5">${b ? b.icon : '🏗️'}</span>
            <div class="construction-overlay">
                <span style="font-size:10px; color:#fff;">${pct}%</span>
                <div class="construction-bar">
                    <div class="construction-fill" style="width:${pct}%"></div>
                </div>
            </div>
        `;
        bList.appendChild(el);
    });
    
    // 3. Empty Slots
    for(let i=occupiedSlots; i<totalSlots; i++) {
        const el = document.createElement('div');
        el.className = 'building-slot empty';
        el.innerText = '+';
        bList.appendChild(el);
    }

    // --- Render Construction List ---
    const cList = document.getElementById('colony-construction-list');
    if (!cList) return;
    cList.innerHTML = '';
    
    if(occupiedSlots < totalSlots) {
        Object.keys(BUILDINGS).forEach(key => {
            const b = BUILDINGS[key];
            const currentMinerals = gameState.resources.minerals;
            const costNormal = b.cost.minerals;
            const costInstant = b.cost.minerals * 2;
            
            let traitsText = "";
            if(b.production.energy) traitsText += `+${b.production.energy}⚡ `;
            if(b.production.minerals) traitsText += `+${b.production.minerals}💎 `;
            if(b.production.food) traitsText += `+${b.production.food}🍏 `;
            if(b.maintenance.energy) traitsText += `-${b.maintenance.energy}⚡ `;

            const card = document.createElement('div');
            card.className = 'build-option';
            card.style.borderLeft = `2px solid ${b.borderColor || '#00f2ff'}`;
            
            card.innerHTML = `
                <div class="build-header">
                    <div class="build-title">
                        <span>${b.icon}</span> ${b.name}
                    </div>
                </div>
                <div class="build-header" style="margin-bottom:10px;">
                     <div class="build-stats-preview">${traitsText}</div>
                </div>
                
                <div class="build-actions">
                    <button class="btn-build-action btn-build-normal" id="build-${key}">
                        <span>Build (${b.buildTime}s)</span>
                        <span class="cost-display">💎${costNormal}</span>
                    </button>
                    <button class="btn-build-action btn-build-instant" id="instant-${key}">
                        <span>Instant</span>
                        <span class="cost-display">💎${costInstant}</span>
                    </button>
                </div>
            `;

            cList.appendChild(card);

            const btnNormal = card.querySelector(`#build-${key}`);
            const btnInstant = card.querySelector(`#instant-${key}`);

            if (currentMinerals < costNormal) btnNormal.disabled = true;
            if (currentMinerals < costInstant) btnInstant.disabled = true;

            btnNormal.addEventListener('click', () => {
                if(buildBuilding(planetId, key, false)) {
                    showNotification(`Construction Started: ${b.name}`, 'info');
                } else {
                    showNotification("Insufficient Minerals", 'alert');
                }
            });

            btnInstant.addEventListener('click', () => {
                if(buildBuilding(planetId, key, true)) {
                    showNotification(`Instant Build: ${b.name}`, 'success');
                } else {
                    showNotification("Insufficient Minerals", 'alert');
                }
            });
        });
    } else {
        cList.innerHTML = '<div style="color:#666;text-align:center;padding:15px;border:1px dashed #444;">No empty building slots</div>';
    }

    // ── Shipyard Section ──────────────────────────────────────────────────────
    // Remove any existing shipyard section before re-rendering
    const existingYard = document.getElementById('colony-shipyard-section');
    if (existingYard) existingYard.remove();

    if (colony.buildings.includes('shipyard')) {
        const race = gameState.playerCivilization?.bodyType || 'humanoid';
        const raceShips = RACE_SHIPS[race] || [];
        const queue = colony.shipQueue || [];

        const section = document.createElement('div');
        section.id = 'colony-shipyard-section';
        section.style.cssText = 'margin-top:16px;border-top:1px solid rgba(0,200,255,0.15);padding-top:14px;';

        let queueHtml = '';
        if (queue.length > 0) {
            queueHtml = `<div style="margin-bottom:10px;">
                <div style="font-size:10px;letter-spacing:2px;color:#ffaa00;text-transform:uppercase;margin-bottom:6px;">Build Queue</div>
                ${queue.map((item, idx) => {
                    const ship = raceShips.find(s => s.id === item.shipId);
                    const pct = Math.floor((item.progress / item.total) * 100);
                    return `<div class="fleet-queue-item" data-planet-id="${planetId}" data-queue-idx="${idx}" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                        <span style="font-size:16px;">${ship ? ship.icon : '🚀'}</span>
                        <div style="flex:1;">
                            <div style="font-size:11px;color:#cce8ff;">${ship ? ship.name : item.shipId}</div>
                            <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:3px;">
                                <div class="fq-bar" style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ffaa00,#ffdd44);border-radius:2px;"></div>
                            </div>
                        </div>
                        <span class="fq-pct" style="font-size:10px;color:#ffaa00;">${pct}%</span>
                    </div>`;
                }).join('')}
            </div>`;
        }

        const shipCards = raceShips.map(ship => {
            const canAfford = gameState.resources.minerals >= ship.cost.minerals &&
                              gameState.resources.energy   >= ship.cost.energy;
            return `<div class="fleet-ship-card ${canAfford ? '' : 'fleet-ship-disabled'}" style="margin-bottom:6px;">
                <div class="fsc-icon fsc-svg-icon" style="color:${ship.accentColor || '#00c8ff'}">${getShipSvg(ship.id)}</div>
                <div class="fsc-info">
                    <div class="fsc-name">${ship.name}</div>
                    <div class="fsc-stats">
                        <span class="fsc-power">⚔ ${ship.power}</span>
                        <span class="fsc-cost">💎${ship.cost.minerals} ⚡${ship.cost.energy}</span>
                        <span class="fsc-time">⏱ ${ship.buildTime}s</span>
                    </div>
                </div>
                <button class="fsc-view-btn colony-ship-view" data-ship="${ship.id}">View</button>
                <button class="fsc-build-btn colony-ship-build" data-planet="${planetId}" data-ship="${ship.id}" ${canAfford ? '' : 'disabled'}>Build</button>
            </div>`;
        }).join('');

        section.innerHTML = `
            <div style="font-size:10px;letter-spacing:2px;color:#00c8ff;text-transform:uppercase;margin-bottom:10px;">🛸 Shipyard</div>
            ${queueHtml}
            <div style="font-size:10px;letter-spacing:2px;color:#557799;text-transform:uppercase;margin-bottom:8px;">Commission Ship</div>
            ${shipCards}
        `;

        // Append after the planet-colony-view content
        const colonyView = document.getElementById('planet-colony-view');
        if (colonyView) colonyView.appendChild(section);

        // Wire View buttons — use shared openShipModal from ui_fleets.js
        section.querySelectorAll('.colony-ship-view').forEach(btn => {
            btn.addEventListener('click', () => {
                const ship = raceShips.find(s => s.id === btn.dataset.ship);
                if (ship) openShipModal(ship);
            });
        });

        // Wire build buttons
        section.querySelectorAll('.colony-ship-build').forEach(btn => {
            btn.addEventListener('click', () => {
                const pId = btn.dataset.planet;
                const sId = btn.dataset.ship;
                if (buildShip(pId, sId)) {
                    const ship = raceShips.find(s => s.id === sId);
                    showNotification(`🛸 ${ship?.name || sId} construction started!`, 'info');
                    renderColonyView(pId);
                } else {
                    showNotification('Insufficient resources!', 'alert');
                }
            });
        });
    }
}

/**
 * Updates dynamic elements of the colony view (progress bars, button states) without full re-render.
 */
export function updateColonyDynamicState(planetId) {
    const colony = gameState.colonies[planetId];
    if (!colony) return;

    // Update Pop
    const popEl = document.getElementById('col-pop');
    if (popEl) {
        let content = `${colony.population}`;
        if (colony.growthProgress !== undefined) {
            const growthPct = Math.floor(colony.growthProgress);
            content += ` <span style="font-size:10px; color:#88ff88;">(+${growthPct}%)</span>`;
        }
        popEl.innerHTML = content;
    }

    // Update Construction Progress
    const fills = document.querySelectorAll('#colony-building-list .construction-fill');
    colony.construction.forEach((item, i) => {
        if(fills[i]) {
            const pct = Math.floor((item.progress / item.total) * 100);
            fills[i].style.width = `${pct}%`;
            // Update percentage text (sibling span in construction-overlay)
            const text = fills[i].closest('.construction-overlay')?.querySelector('span');
            if(text) text.innerText = `${pct}%`;
        }
    });

    // Update Build Button States based on current resources
    Object.keys(BUILDINGS).forEach(key => {
        const b = BUILDINGS[key];
        const btnNormal = document.getElementById(`build-${key}`);
        const btnInstant = document.getElementById(`instant-${key}`);
        
        if(btnNormal && btnInstant) {
            const currentMinerals = gameState.resources.minerals;
            const costNormal = b.cost.minerals;
            const costInstant = b.cost.minerals * 2;
            
            btnNormal.disabled = currentMinerals < costNormal;
            btnInstant.disabled = currentMinerals < costInstant;
        }
    });
}