/* Updated: Renamed from main.jsx to main.js, updated Game import to Game.js for Cloudflare Pages MIME type compatibility */
import { jsxDEV } from "react/jsx-dev-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { init as initRenderer, buildGalaxyVisuals, focusCamera, enterSystemView, isRendererReady } from "./visuals/renderer.js";
import { startMusic } from "./core/assets.js";
import { generateGalaxy } from "./core/galaxy_generator.js";
import { gameState, updateResources, events, colonizePlanet, selectSystem, selectPlanet, rebuildIndexes } from "./core/state.js";
import { initUI } from "./ui/ui.js";
import { initCreationUI } from "./ui/ui_creation.js";
import { initSplashPlanet, stopSplashPlanet } from "./visuals/splash_renderer.js";
import { showRaceIntro } from "./ui/ui_intro.js";
import { playWarpAnimation } from "./visuals/warp_animation.js";
import { Game } from "./Game.js";
document.querySelector('script[src="main.js"]')?.remove();
async function start() {
  initSplashPlanet("splash-planet-container");
  initUI();
  initCreationUI();
  await initRenderer();
  events.addEventListener("game-start", (e) => {
    const playerCiv = e.detail;
    console.log("Starting Game with Civ:", playerCiv);
    stopSplashPlanet();
    // Fade out creation screen, then show race intro, then start game
    const creationScreen = document.getElementById("creation-screen");
    creationScreen.classList.add("hidden");
    showRaceIntro(playerCiv.bodyType, playerCiv.name, () => {
      startGame(playerCiv);
    });
  });
  events.addEventListener("game-load", () => {
    console.log("Loading Game...");
    stopSplashPlanet();
    startLoadedGame();
  });
  console.log("Celestial Mandate Initialized - Awaiting Species Creation");
}
function fadeOutSplash() {
  const splash = document.getElementById("splash-screen");
  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";
  const container = document.getElementById("game-container");
  container.style.transition = "opacity 0.8s ease";
  container.style.opacity = "1";
  // Force R3F to recalculate canvas size now that the container is visible.
  // Chrome throttles rendering of opacity:0 elements, so this kick-starts
  // proper compositing, shader compilation, and DPR detection.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
  });
  setTimeout(() => {
    splash.classList.add("hidden");
    splash.style.opacity = "";
    splash.style.pointerEvents = "";
    // Second resize after transition completes to ensure final dimensions are correct
    window.dispatchEvent(new Event('resize'));
  }, 1000);
}
function startGame(playerCiv) {
  gameState.playerCivilization = playerCiv;
  fadeOutSplash();
  document.getElementById("creation-screen").classList.add("hidden");
  // Keep UI hidden during warp — it will be revealed after the animation
  const uiLayer = document.getElementById("ui-layer");
  uiLayer.style.opacity = '0';
  uiLayer.classList.remove("hidden");
  const container = document.getElementById("game-container");
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsxDEV(Game, {}, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 54,
    columnNumber: 17
  }, this));
  const galaxyData = generateGalaxy(100, 300, playerCiv);
  gameState.systems = galaxyData.systems;
  gameState.hyperlanes = galaxyData.hyperlanes;
  rebuildIndexes();
  // Galaxy visuals will be built when scene is ready in SceneBindings component
  startLogicLoop();
  startMusic();
  const homeSystem = galaxyData.systems[0];
  const homePlanet = homeSystem.planets[0];
  if (homePlanet) {
    colonizePlanet(homePlanet.id);
  }

  // Set initial state to SYSTEM before React Three Fiber even renders the first frame
  gameState.viewMode = 'SYSTEM';
  focusHome(homeSystem, homePlanet, true);
}
function startLoadedGame() {
  gameState.playerCivilization = gameState.playerCivilization || {};
  fadeOutSplash();
  document.getElementById("creation-screen").classList.add("hidden");
  document.getElementById("ui-layer").classList.remove("hidden");
  const container = document.getElementById("game-container");
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsxDEV(Game, {}, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 87,
    columnNumber: 17
  }, this));
  // Galaxy visuals will be built when scene is ready in SceneBindings component
  startLogicLoop();
  startMusic();
  const homeSystem = gameState.systems[0];
  let homePlanet = null;
  for (const sys of gameState.systems) {
    const p = sys.planets.find((pl) => gameState.colonies[pl.id]);
    if (p) {
      homePlanet = p;
      break;
    }
  }
  
  // Set initial state to SYSTEM before React Three Fiber even renders the first frame
  gameState.viewMode = 'SYSTEM';
  focusHome(homeSystem, homePlanet);
  console.log("Game Loaded Successfully");
}
let logicIntervalId = null;
function startLogicLoop() {
  if (logicIntervalId) clearInterval(logicIntervalId);
  logicIntervalId = setInterval(() => {
    const speed = gameState.gameSpeed || 1;
    for (let i = 0; i < speed; i++) {
      updateResources();
    }
  }, 1e3);
}
function focusHome(homeSystem, homePlanet, useWarp = false) {
  const attemptFocus = (retries = 0) => {
    if (isRendererReady()) {
      if (homeSystem) {
        if (useWarp) {
          const uiLayer = document.getElementById('ui-layer');

          // Warp canvas is created immediately as solid black — covers
          // everything so no UI or 3D content is ever visible during warp.
          playWarpAnimation({
            onFlash: () => {
              // Scene is set up behind the white overlay at peak flash
              enterSystemView(homeSystem.id, true);
              selectSystem(homeSystem.id);
              if (homePlanet) selectPlanet(homePlanet.id);
            }
          }).then(() => {
            // Overlay is gone — smoothly reveal UI
            if (uiLayer) {
              uiLayer.style.transition = 'opacity 0.8s ease';
              uiLayer.style.opacity = '1';
              setTimeout(() => { uiLayer.style.transition = ''; }, 900);
            }
          });
        } else {
          enterSystemView(homeSystem.id, true);
          selectSystem(homeSystem.id);
          if (homePlanet) selectPlanet(homePlanet.id);
        }
      }
    } else if (retries < 40) {
      setTimeout(() => attemptFocus(retries + 1), 50);
    }
  };
  attemptFocus();
}
start();
