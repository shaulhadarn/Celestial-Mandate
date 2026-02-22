<!-- Updated: Logged completion of mobile rendering stabilization fixes (composer + additive glow reductions) -->
# Project Status

## Current Goal
- Organize files in folders and optimize app hierarchy for files and make everything work correctly.

## Completed Tasks
- Analyzed current file structure and dependencies
- Created new folder hierarchy (src, assets, styles)
- Moved files to their respective new directories
  - `src/core/`: state.js, civilization_data.js, galaxy_generator.js, scene_config.js, assets.js, splash_assets.js
  - `src/ui/`: ui.js, ui_colony.js, ui_creation.js, ui_creation_homeworld.js, etc.
  - `src/visuals/`: renderer.js, visuals_galaxy.js, splash_renderer.js, etc.
  - `src/`: main.jsx, Game.jsx
  - `assets/`: all .png and .mp3 files
  - `styles/`: all .css files
- Updated import paths in all JS/JSX files
- Updated asset paths in configuration files (`assets.js`, `civilization_data.js`)
- Updated CSS file references in `index.html`
- Updated script references in `index.html`
- Tested the application locally to ensure everything works correctly
- Added standard update comments to all modified JS/CSS files
- Fixed mobile galaxy drag rendering artifacts (flicker, square flashes, large light-ray bursts)
  - Disabled mobile post-processing composer path in `src/Game.js` and removed duplicate per-frame composer render path in R3F loop
  - Reduced/limited additive glow behavior for stars and planets on mobile
  - Disabled heavy additive nebula sprite layers on mobile in both galaxy and system backgrounds

## Next Steps
- Continue implementing features as requested.
- Validate mobile drag smoothness and visual stability after these renderer/glow changes.
