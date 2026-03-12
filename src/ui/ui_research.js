/* Research panel UI - tech tree viewer, research queue, bonuses display */
import { gameState, events, startResearch, cancelResearch, TECH_TREE, getAvailableTechs, getTechById, getTierTechs, isTierComplete, isTierUnlocked } from '../core/state.js';
import { showNotification } from './ui_notifications.js';
import { initTierCelebration } from './ui_tier_celebration.js';

export function initResearchUI() {
    const btn = document.getElementById('btn-research');
    const panel = document.getElementById('research-panel');
    const closeBtn = document.getElementById('btn-close-research');

    if (btn) btn.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderResearchPanel();
    });

    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    events.addEventListener('research-complete', (e) => {
        const tech = getTechById(e.detail.techId);
        showNotification(`Research Complete: ${tech?.name || e.detail.techId}`, 'success');
        if (!panel.classList.contains('hidden')) renderResearchPanel();
    });

    events.addEventListener('research-started', () => {
        if (!panel.classList.contains('hidden')) renderResearchPanel();
    });

    events.addEventListener('tick', () => {
        if (!panel.classList.contains('hidden')) updateResearchProgress();
    });

    // Re-render panel when tier unlocks (after celebration dismisses)
    events.addEventListener('tier-complete', () => {
        setTimeout(() => {
            if (!panel.classList.contains('hidden')) renderResearchPanel();
        }, 700);
    });

    // Initialize tier celebration overlay
    initTierCelebration();
}

function renderResearchPanel() {
    const content = document.getElementById('research-panel-content');
    if (!content) return;

    const r = gameState.research;
    const archetypeId = gameState.playerCivilization?.archetype || 'standard';
    const hasLab = Object.values(gameState.colonies).some(col => col.buildings.includes('research_lab'));

    // Group techs by tier
    const tiers = [1, 2, 3, 4];
    const tierNames = { 1: 'Tier I — Foundations', 2: 'Tier II — Advancement', 3: 'Tier III — Mastery', 4: 'Tier IV — Transcendence' };

    let html = '';

    // Current Research Bar
    html += `<div class="research-current-bar">`;
    if (r.currentResearch) {
        const tech = getTechById(r.currentResearch.techId);
        const pct = Math.min(100, Math.floor((r.currentResearch.progress / r.currentResearch.total) * 100));
        html += `
            <div class="research-active">
                <div class="research-active-header">
                    <span class="research-active-icon">${tech?.icon || '🔬'}</span>
                    <span class="research-active-name">${tech?.name || r.currentResearch.techId}</span>
                    <span class="research-active-pct">${pct}%</span>
                    <button class="research-cancel-btn" id="btn-cancel-research">✕ Cancel</button>
                </div>
                <div class="research-progress-track">
                    <div class="research-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="research-active-sub">${r.researchPoints} research points accumulated</div>
            </div>`;
    } else if (!hasLab) {
        html += `<div class="research-no-lab">⚠️ Build a <strong>Research Lab</strong> in a colony to begin research.</div>`;
    } else {
        html += `<div class="research-idle">🔬 No active research. Select a technology below.</div>`;
    }
    html += `</div>`;

    // Bonuses Summary
    const bonusEntries = Object.entries(r.bonuses);
    if (bonusEntries.length > 0) {
        html += `<div class="research-bonuses-bar">`;
        html += `<span class="research-bonuses-label">Active Bonuses:</span>`;
        bonusEntries.forEach(([key, val]) => {
            const label = formatBonusKey(key);
            const valStr = val > 0 ? `+${formatBonusVal(key, val)}` : formatBonusVal(key, val);
            html += `<span class="research-bonus-chip">${label} ${valStr}</span>`;
        });
        html += `</div>`;
    }

    // Tech Tree by Tier
    tiers.forEach(tier => {
        const tierTechs = TECH_TREE.filter(t => {
            if (t.tier !== tier) return false;
            if (t.archetype.length > 0 && !t.archetype.includes(archetypeId)) return false;
            return true;
        });
        if (tierTechs.length === 0) return;

        const tierUnlocked = isTierUnlocked(tier, archetypeId, r.completedTechs);
        const tierDone = isTierComplete(tier, archetypeId, r.completedTechs);

        let sectionClass = 'research-tier-section';
        if (!tierUnlocked) sectionClass += ' research-tier-locked';
        if (tierDone) sectionClass += ' tier-complete';

        html += `<div class="${sectionClass}">`;
        html += `<div class="research-tier-label">${tierNames[tier]}</div>`;
        html += `<div class="research-tier-grid">`;

        tierTechs.forEach(tech => {
            const completed = r.completedTechs.includes(tech.id);
            const isActive = r.currentResearch?.techId === tech.id;
            const prereqsMet = tech.requires.every(req => r.completedTechs.includes(req));
            // If tier is locked, all techs in it are locked regardless of individual prereqs
            const effectivelyLocked = !tierUnlocked || (!prereqsMet && !completed);
            const available = tierUnlocked && prereqsMet && !completed && !isActive;

            let cardClass = 'research-card';
            if (completed) cardClass += ' completed';
            else if (isActive) cardClass += ' active';
            else if (effectivelyLocked) cardClass += ' locked';
            else cardClass += ' available';

            const bonusText = tech.bonus ? Object.entries(tech.bonus).map(([k, v]) => {
                return `${formatBonusKey(k)} ${v > 0 ? '+' : ''}${formatBonusVal(k, v)}`;
            }).join(', ') : '';

            const prereqText = tech.requires.length > 0
                ? tech.requires.map(req => {
                    const t = getTechById(req);
                    return t ? t.name : req;
                }).join(', ')
                : '';

            html += `
                <div class="${cardClass}" data-tech-id="${tech.id}">
                    <div class="research-card-icon">${tech.icon}</div>
                    <div class="research-card-body">
                        <div class="research-card-name">${tech.name}</div>
                        <div class="research-card-desc">${tech.desc}</div>
                        ${tech.flavor ? `<div class="research-card-flavor">${tech.flavor}</div>` : ''}
                        ${bonusText ? `<div class="research-card-bonus">${bonusText}</div>` : ''}
                        ${tech.unlocks ? `<div class="research-card-unlock">🏗️ Unlocks: ${tech.unlocks.replace(/_/g,' ')}</div>` : ''}
                        ${prereqText ? `<div class="research-card-prereq">Requires: ${prereqText}</div>` : ''}
                    </div>
                    <div class="research-card-footer">
                        <span class="research-card-cost">🔬 ${tech.cost}</span>
                        ${completed ? `<span class="research-card-status done">✓ Done</span>` : ''}
                        ${isActive ? `<span class="research-card-status researching">⏳ Researching</span>` : ''}
                        ${available && hasLab && !r.currentResearch ? `<button class="research-start-btn" data-tech-id="${tech.id}">Research</button>` : ''}
                        ${effectivelyLocked && !completed && !isActive ? `<span class="research-card-status locked-txt">🔒 Locked</span>` : ''}
                        ${available && !hasLab ? `<span class="research-card-status no-lab">Need Lab</span>` : ''}
                        ${available && r.currentResearch && !isActive ? `<span class="research-card-status busy">Queue Full</span>` : ''}
                    </div>
                </div>`;
        });

        html += `</div>`;

        // Lock overlay for locked tiers
        if (!tierUnlocked) {
            const prevTier = tier - 1;
            const prevTierTechs = getTierTechs(prevTier, archetypeId);
            const completedCount = prevTierTechs.filter(t => r.completedTechs.includes(t.id)).length;
            const totalCount = prevTierTechs.length;
            html += `<div class="research-tier-lock-overlay">
                <div class="research-tier-lock-icon">🔒</div>
                <div class="research-tier-lock-text">Complete all Tier ${_romanNumeral(prevTier)} technologies to unlock</div>
                <div class="research-tier-lock-progress">${completedCount} / ${totalCount} completed</div>
            </div>`;
        }

        html += `</div>`;
    });

    content.innerHTML = html;

    // Wire up buttons
    content.querySelectorAll('.research-start-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const techId = btn.dataset.techId;
            if (startResearch(techId)) {
                showNotification(`Researching: ${getTechById(techId)?.name}`, 'success');
            } else {
                showNotification('Cannot start research', 'alert');
            }
        });
    });

    const cancelBtn = document.getElementById('btn-cancel-research');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            cancelResearch();
            showNotification('Research cancelled', 'alert');
        });
    }
}

function updateResearchProgress() {
    const r = gameState.research;
    if (!r.currentResearch) return;
    const pct = Math.min(100, Math.floor((r.currentResearch.progress / r.currentResearch.total) * 100));
    const fill = document.querySelector('.research-progress-fill');
    const pctEl = document.querySelector('.research-active-pct');
    const sub = document.querySelector('.research-active-sub');
    if (fill) fill.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (sub) sub.textContent = `${r.researchPoints} research points accumulated`;
}

function formatBonusKey(key) {
    const map = {
        energy_income: '⚡ Energy/colony',
        minerals_income: '💎 Minerals/colony',
        food_income: '🍏 Food/colony',
        pop_growth: '👥 Pop Growth',
        research_cost_factor: '🔬 Research Cost',
        energy_upkeep_reduction: '⚡ Energy Upkeep',
        food_upkeep_reduction: '🍏 Food Upkeep',
        global_income_factor: '📈 All Income',
        energy_income_factor: '⚡ Energy Factor'
    };
    return map[key] || key;
}

function formatBonusVal(key, val) {
    if (key.includes('factor') || key.includes('growth') || key.includes('reduction')) {
        return `${Math.round(val * 100)}%`;
    }
    return val;
}

function _romanNumeral(n) {
    return { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }[n] || n;
}
