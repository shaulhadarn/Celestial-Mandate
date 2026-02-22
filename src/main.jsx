/* Updated: Organized app hierarchy, moved to ./src folder, fixed imports and paths */
import { jsxDEV } from "react/jsx-dev-runtime";
import React from "react";
import { createRoot } from "react-dom/client";
import { init as initRenderer, buildGalaxyVisuals, focusCamera, enterSystemView, isRendererReady } from "./visuals/renderer.js";
import { generateGalaxy } from "./core/galaxy_generator.js";
import { gameState, updateResources, events, colonizePlanet, selectSystem, selectPlanet } from "./core/state.js";
import { initUI } from "./ui/ui.js";
import { initCreationUI } from "./ui/ui_creation.js";
import { initSplashPlanet, stopSplashPlanet } from "./visuals/splash_renderer.js";
import { Game } from "./Game.jsx";
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
    startGame(playerCiv);
  });
  events.addEventListener("game-load", () => {
    console.log("Loading Game...");
    stopSplashPlanet();
    startLoadedGame();
  });
  console.log("Celestial Mandate Initialized - Awaiting Species Creation");
}
function startGame(playerCiv) {
  gameState.playerCivilization = playerCiv;
  document.getElementById("splash-screen").classList.add("hidden");
  document.getElementById("creation-screen").classList.add("hidden");
  document.getElementById("ui-layer").classList.remove("hidden");
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
  buildGalaxyVisuals(gameState.systems, gameState.hyperlanes);
  startLogicLoop();
  const homeSystem = galaxyData.systems[0];
  const homePlanet = homeSystem.planets[0];
  if (homePlanet) {
    colonizePlanet(homePlanet.id);
  }
  focusHome(homeSystem, homePlanet);
}
function startLoadedGame() {
  gameState.playerCivilization = gameState.playerCivilization || {};
  document.getElementById("splash-screen").classList.add("hidden");
  document.getElementById("creation-screen").classList.add("hidden");
  document.getElementById("ui-layer").classList.remove("hidden");
  const container = document.getElementById("game-container");
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsxDEV(Game, {}, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 87,
    columnNumber: 17
  }, this));
  buildGalaxyVisuals(gameState.systems, gameState.hyperlanes);
  startLogicLoop();
  const homeSystem = gameState.systems[0];
  let homePlanet = null;
  for (const sys of gameState.systems) {
    const p = sys.planets.find((pl) => gameState.colonies[pl.id]);
    if (p) {
      homePlanet = p;
      break;
    }
  }
  focusHome(homeSystem, homePlanet);
  console.log("Game Loaded Successfully");
}
function startLogicLoop() {
  setInterval(() => {
    updateResources();
  }, 1e3);
}
function focusHome(homeSystem, homePlanet) {
  const attemptFocus = (retries = 0) => {
    if (isRendererReady()) {
      if (homeSystem) {
        enterSystemView(homeSystem.id);
        selectSystem(homeSystem.id);
        if (homePlanet) {
          selectPlanet(homePlanet.id);
        }
      }
    } else if (retries < 20) {
      setTimeout(() => attemptFocus(retries + 1), 100);
    } else {
      console.error("Renderer failed to initialize in time.");
    }
  };
  attemptFocus();
}
start();
