/* Updated: Added Research and Colonies Overview panels wired to top bar buttons */
import * as THREE from 'three';
import { gameState, events, getSystem, selectSystem, selectPlanet, colonizePlanet, getPlanet, surveySystem, SURVEY_COST, loadGame } from '../core/state.js';
import { returnToGalaxyView, enterPlanetView, focusCamera, restoreControlsAfterPlanet } from '../visuals/renderer.js';
import { setJoystickInput } from '../visuals/visuals_planet.js';
import { disposeGroup } from '../core/dispose.js';
import { groups, controls, scene } from '../core/scene_config.js';
import { renderColonyView, updateColonyDynamicState } from './ui_colony.js';
import { renderColonyList, initEmpireHub } from './ui_empire.js';
import { initSettingsUI } from './ui_settings.js';
import { updateSelectionPanel } from './ui_selection.js';
import { showNotification } from './ui_notifications.js';
import { initResearchUI } from './ui_research.js';
import { initColoniesOverview } from './ui_colonies_overview.js';
import { initFleetsUI } from './ui_fleets.js';
import { initEventsUI } from './ui_events.js';
import { initCodexUI } from './ui_codex.js';
import { initMilestoneEvents } from '../core/milestone_events.js';
import { startMenuMusic } from '../core/assets.js';

// Re-export for other modules to use
export { showNotification };

let activeJoystick = null;

// --- Scene Transition Helpers ---
function getTransitionOverlay() {
    return document.getElementById('scene-transition-overlay');
}

function showTransition(text, subtext) {
    const overlay = getTransitionOverlay();
    overlay.querySelector('.transition-text').textContent = text || '';
    overlay.querySelector('.transition-subtext').textContent = subtext || '';
    overlay.querySelector('.transition-spinner').style.display = text ? '' : 'none';
    overlay.classList.add('active');
    return new Promise(r => setTimeout(r, 600)); // wait for fade-in
}

function hideTransition() {
    const overlay = getTransitionOverlay();
    overlay.classList.remove('active');
    return new Promise(r => setTimeout(r, 600)); // wait for fade-out
}

/**
 * Main UI Hub. Sets up tickers and general interface listeners.
 */
export function initUI() {
    // Setup Tickers
    setInterval(updateTopBar, 100); // 10fps UI update

    // Initialize Sub-modules
    initEmpireHub();
    initSettingsUI();
    initResearchUI();
    initColoniesOverview();
    initFleetsUI();
    initSpeedControls();
    initEventsUI();
    initCodexUI();
    initMilestoneEvents();

    events.addEventListener('autosave', () => {
        showNotification('Game autosaved', 'info');
    });

    // Splash Screen Listeners
    const splashStart = document.getElementById('splash-start');
    const splashLoad = document.getElementById('splash-load');
    const splashSettings = document.getElementById('splash-settings');

    if (splashStart) {
        splashStart.addEventListener('click', () => {
            startMenuMusic();
            document.getElementById('settings-panel').classList.add('hidden');
            showLoadingScreen(() => {
                document.getElementById('splash-screen').classList.add('hidden');
                document.getElementById('creation-screen').classList.remove('hidden');
            });
        });
    }

    if (splashSettings) {
        splashSettings.addEventListener('click', () => {
            const panel = document.getElementById('settings-panel');
            panel.classList.remove('hidden');
            // Ensure high Z-index in case applied dynamically
            panel.style.zIndex = '2100';
        });
    }

    if (splashLoad) {
        splashLoad.addEventListener('click', () => {
            startMenuMusic();
            document.getElementById('settings-panel').classList.add('hidden');
            if (loadGame()) {
                showLoadingScreen(() => {
                    events.dispatchEvent(new CustomEvent('game-load'));
                });
            } else {
                showNotification("No saved empires found in local sector.", "alert");
            }
        });
    }

    // Event Listeners
    events.addEventListener('selection-changed', updateSelectionPanel);
    
    document.getElementById('btn-close-system').addEventListener('click', () => {
        document.getElementById('system-panel').classList.add('hidden');
    });

    document.getElementById('btn-close-planet').addEventListener('click', () => {
        selectPlanet(null);
        document.getElementById('planet-panel').classList.add('hidden');
    });

    const empirePanel = document.getElementById('empire-panel');
    const hubBtn = document.getElementById('btn-empire-hub');
    if (hubBtn) {
        hubBtn.addEventListener('click', () => {
            empirePanel.classList.toggle('hidden');
            if (!empirePanel.classList.contains('hidden')) renderColonyList();
        });
    }

    document.getElementById('btn-view-toggle').addEventListener('click', () => {
        document.getElementById('empire-panel').classList.add('hidden');
        
        if (gameState.viewMode === 'SYSTEM') {
            returnToGalaxyView();
            document.getElementById('system-panel').classList.add('hidden');
            document.getElementById('planet-panel').classList.add('hidden');
        } else if (gameState.viewMode === 'EXPLORATION') {
            returnToSystemViewFromPlanet();
        } else {
            if (gameState.selectedSystemId) {
                selectSystem(null);
                document.getElementById('system-panel').classList.add('hidden');
            }
        }
    });

    document.getElementById('btn-land').addEventListener('click', async () => {
        if (!gameState.selectedPlanetId) return;

        const planet = getPlanet(gameState.selectedPlanetId);
        if (!planet) return;

        if (planet.type === 'Gas Giant') {
            showNotification("Cannot land on Gas Giant", 'alert');
            return;
        }

        try {
            // Phase 1: Fade to black with landing animation
            await showTransition('Initiating Landing', `Descending to ${planet.name}`);

            // Phase 2: Do the actual scene swap while screen is black
            document.getElementById('ui-layer').classList.add('hidden-during-exploration');
            document.getElementById('exploration-controls').classList.remove('hidden');
            document.getElementById('hint-text').classList.add('hidden');
            document.getElementById('planet-panel').classList.add('hidden');
            document.getElementById('system-panel').classList.add('hidden');
            document.getElementById('btn-view-toggle').classList.add('hidden');
            document.getElementById('btn-empire-hub').classList.add('hidden');
            const mdb = document.getElementById('mobile-date-badge');
            if (mdb) mdb.style.display = 'none';

            enterPlanetView(planet);

            if (window.innerWidth <= 768) {
                const lookZone = document.getElementById('exploration-look-zone');
                if (lookZone) lookZone.classList.add('visible');

                try {
                    const nipplejs = (await import('nipplejs')).default;
                    const container = document.getElementById('joystick-container');
                    container.classList.add('visible');

                    if (activeJoystick) {
                        activeJoystick.destroy();
                    }

                    activeJoystick = nipplejs.create({
                        zone: container,
                        mode: 'static',
                        position: { left: '50%', top: '50%' },
                        color: 'rgba(0,242,255,0.8)',
                        size: Math.min(120, container.offsetWidth * 0.8)
                    });

                    activeJoystick.on('move', (evt, data) => {
                        if (data.vector) {
                            setJoystickInput(data.vector.x, data.vector.y);
                        }
                    });

                    activeJoystick.on('end', () => {
                        setJoystickInput(0, 0);
                    });
                } catch (e) {
                    console.error("Failed to load joystick controls", e);
                }
            }

            // Brief pause so scene has a frame to render
            await new Promise(r => setTimeout(r, 400));

            // Phase 3: Fade in the planet view
            await hideTransition();
            showNotification(`Landed on ${planet.name}`, 'success');
        } catch (err) {
            console.error("Landing failed", err);
            showNotification("Landing Sequence Failed", "alert");
            hideTransition();
            document.getElementById('ui-layer').classList.remove('hidden-during-exploration');
            document.getElementById('exploration-controls').classList.add('hidden');
        }
    });

    document.getElementById('btn-exit-planet').addEventListener('click', () => returnToSystemViewFromPlanet());

    document.getElementById('btn-survey').addEventListener('click', () => {
        if (gameState.selectedSystemId) {
            if (surveySystem(gameState.selectedSystemId)) {
                showNotification("System Surveyed: Data Available", "success");
                // Animate the panel content to reflect surveyed data
                const content = document.getElementById('system-panel').querySelector('.panel-content');
                if (content) {
                    content.style.transition = 'none';
                    content.style.opacity = '0.3';
                    content.style.transform = 'translateY(4px)';
                    requestAnimationFrame(() => {
                        content.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out';
                        content.style.opacity = '1';
                        content.style.transform = 'translateY(0)';
                    });
                }
            } else {
                showNotification("Cannot Survey: Insufficient Energy", "alert");
            }
        }
    });

    document.getElementById('btn-colonize').addEventListener('click', () => {
        if(gameState.selectedPlanetId) {
            if(colonizePlanet(gameState.selectedPlanetId)) {
                showNotification("Colony Established Successfully", "success");
                updateSelectionPanel(); 
            } else {
                showNotification("Insufficient Resources", "alert");
            }
        }
    });

    events.addEventListener('resources-updated', () => {
        updateTopBar();
        if (gameState.selectedPlanetId && gameState.colonies[gameState.selectedPlanetId]) {
            renderColonyView(gameState.selectedPlanetId);
        }
    });
}

function initSpeedControls() {
    const pauseBtn = document.getElementById('btn-pause');
    const speed1 = document.getElementById('btn-speed-1');
    const speed2 = document.getElementById('btn-speed-2');
    const speed3 = document.getElementById('btn-speed-3');

    function updateSpeedUI() {
        [speed1, speed2, speed3].forEach(b => b?.classList.remove('speed-active'));
        pauseBtn?.classList.remove('speed-paused');
        if (gameState.paused) {
            pauseBtn?.classList.add('speed-paused');
        } else if (gameState.gameSpeed === 1) {
            speed1?.classList.add('speed-active');
        } else if (gameState.gameSpeed === 2) {
            speed2?.classList.add('speed-active');
        } else if (gameState.gameSpeed === 3) {
            speed3?.classList.add('speed-active');
        }
    }

    if (pauseBtn) pauseBtn.addEventListener('click', () => {
        gameState.paused = !gameState.paused;
        updateSpeedUI();
    });
    if (speed1) speed1.addEventListener('click', () => {
        gameState.paused = false;
        gameState.gameSpeed = 1;
        updateSpeedUI();
    });
    if (speed2) speed2.addEventListener('click', () => {
        gameState.paused = false;
        gameState.gameSpeed = 2;
        updateSpeedUI();
    });
    if (speed3) speed3.addEventListener('click', () => {
        gameState.paused = false;
        gameState.gameSpeed = 3;
        updateSpeedUI();
    });
}

function updateTopBar() {
    document.getElementById('res-energy').innerText = Math.floor(gameState.resources.energy);
    document.getElementById('res-minerals').innerText = Math.floor(gameState.resources.minerals);
    document.getElementById('res-food').innerText = Math.floor(gameState.resources.food);
    
    const formatRate = (val) => val >= 0 ? `+${val}` : `${val}`;
    document.getElementById('rate-energy').innerText = formatRate(gameState.rates.energy);
    document.getElementById('rate-minerals').innerText = formatRate(gameState.rates.minerals);
    document.getElementById('rate-food').innerText = formatRate(gameState.rates.food);

    const d = gameState.date;
    const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;
    const dateEl = document.getElementById('top-bar').querySelector('.date-value');
    if (dateEl) dateEl.innerText = dateStr;
    const mobileDateEl = document.getElementById('mobile-date-badge');
    if (mobileDateEl) {
        const mdv = mobileDateEl.querySelector('.date-value');
        if (mdv) mdv.innerText = dateStr;
    }

    const toggleBtn = document.getElementById('btn-view-toggle');
    const hubBtn = document.getElementById('btn-empire-hub');
    const topBar = document.getElementById('top-bar');

    if (gameState.viewMode === 'EXPLORATION') {
        topBar.classList.add('hidden'); // Hide top bar in exploration
        if (mobileDateEl) mobileDateEl.style.display = 'none';
        return; // Skip other button logic
    } else {
        topBar.classList.remove('hidden');
    }

    if (gameState.viewMode === 'SYSTEM') {
        toggleBtn.innerText = "Return to Galaxy";
        // On mobile, hide the button when any bottom panel/modal is open
        const anyPanelOpen = !document.getElementById('system-panel').classList.contains('hidden')
            || !document.getElementById('planet-panel').classList.contains('hidden')
            || !document.getElementById('empire-panel').classList.contains('hidden');
        if (window.innerWidth <= 768 && anyPanelOpen) {
            toggleBtn.classList.add('hidden');
        } else {
            toggleBtn.classList.remove('hidden');
        }
        hubBtn.classList.add('hidden');
    } else {
        toggleBtn.classList.add('hidden');
        hubBtn.classList.remove('hidden');
    }

    // Dynamic Colony Update
    if (gameState.selectedPlanetId && gameState.colonies[gameState.selectedPlanetId]) {
        const panel = document.getElementById('planet-panel');
        // Only update if panel is visible and active
        if (panel && !panel.classList.contains('hidden') && gameState.viewMode === 'SYSTEM') {
            updateColonyDynamicState(gameState.selectedPlanetId);
        }
    }
}

function showLoadingScreen(onComplete) {
    const screen = document.getElementById('loading-screen');
    const bar = document.getElementById('loader-progress');
    const subtext = document.getElementById('loader-subtext');
    
    screen.classList.remove('hidden');
    bar.style.width = '0%';
    
    const steps = [
        "Analyzing stellar configurations...",
        "Generating orbital mechanics...",
        "Calculating species genetic markers...",
        "Syncing hyperlane node array...",
        "Finalizing galactic simulation..."
    ];

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;
        
        bar.style.width = `${progress}%`;
        const stepIdx = Math.floor((progress / 100) * (steps.length - 1));
        subtext.innerText = steps[stepIdx];

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                screen.classList.add('hidden');
                if (onComplete) onComplete();
            }, 500);
        }
    }, 150);
}

async function returnToSystemViewFromPlanet() {
    // Phase 1: Fade to black
    await showTransition('', '');

    // Phase 2: Do the scene swap while screen is black
    gameState.viewMode = 'SYSTEM';
    groups.planet.visible = false;
    groups.system.visible = true;

    if (scene) {
        scene.background = new THREE.Color(0x020408);
        scene.fog = new THREE.FogExp2(0x020408, 0.0006);
    }

    disposeGroup(groups.planet);

    if (activeJoystick) {
        activeJoystick.destroy();
        activeJoystick = null;
    }
    const container = document.getElementById('joystick-container');
    if (container) container.classList.remove('visible');
    const lookZone = document.getElementById('exploration-look-zone');
    if (lookZone) lookZone.classList.remove('visible');
    setJoystickInput(0, 0);

    document.getElementById('ui-layer').classList.remove('hidden-during-exploration');
    document.getElementById('exploration-controls').classList.add('hidden');
    document.getElementById('btn-view-toggle').classList.remove('hidden');
    document.getElementById('btn-empire-hub').classList.add('hidden');
    const mdb = document.getElementById('mobile-date-badge');
    if (mdb) mdb.style.display = '';

    restoreControlsAfterPlanet();
    updateSelectionPanel();

    if (window.innerWidth <= 768) {
        // Hide system panel on mobile to avoid clutter, but keep planet panel
        // visible so the user can still see the planet they just explored
        document.getElementById('system-panel').classList.add('hidden');
    }

    // Brief pause for scene to render a frame
    await new Promise(r => setTimeout(r, 200));

    // Phase 3: Fade in the orbit view
    await hideTransition();
}

// removed function updateSelectionPanel() {} (moved to ui_selection.js)
// removed function getStarClass() {} (moved to ui_selection.js)
// removed function initSettingsUI() {} (moved to ui_settings.js)
// removed function showNotification() {} (moved to ui_notifications.js)