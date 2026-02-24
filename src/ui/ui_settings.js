/* Updated: Wired volume slider display, updated setActive for new sett-preset-btn/sett-toggle classes */
import { setGraphicsPreset, updateGraphicsSetting } from '../core/scene_config.js';
import { saveGame } from '../core/state.js';
import { showNotification } from './ui_notifications.js';

/**
 * Initializes the graphics and audio settings panel.
 */
export function initSettingsUI() {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('btn-settings');
    const closeSettings = document.getElementById('btn-close-settings');
    const resetBtn = document.getElementById('btn-reset-game');
    const saveBtn = document.getElementById('btn-save-game');

    const gfxUltra = document.getElementById('gfx-ultra');
    const gfxHigh = document.getElementById('gfx-high');
    const gfxLow = document.getElementById('gfx-low');

    // Volume slider live display
    const volSlider = document.getElementById('vol-slider');
    const volDisplay = document.getElementById('vol-display');
    if (volSlider && volDisplay) {
        volSlider.addEventListener('input', () => {
            volDisplay.textContent = `${volSlider.value}%`;
        });
    }

    // UI Helpers — works for both sett-preset-btn and sett-toggle classes
    const setActive = (ids, targetId) => ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === targetId);
    });

    const syncUI = (conf) => {
        setActive(['gfx-aa-on', 'gfx-aa-off'], conf.antialias ? 'gfx-aa-on' : 'gfx-aa-off');
        setActive(['gfx-bloom-on', 'gfx-bloom-off'], conf.bloom ? 'gfx-bloom-on' : 'gfx-bloom-off');
        setActive(['gfx-shadow-high', 'gfx-shadow-low', 'gfx-shadow-off'], `gfx-shadow-${conf.shadows}`);

        let scaleStr = '100';
        if (conf.scale === 2.0) scaleStr = '200';
        else if (conf.scale === 1.5) scaleStr = '150';
        else if (conf.scale === 0.75) scaleStr = '75';
        else if (conf.scale === 0.5) scaleStr = '50';
        setActive(['gfx-scale-200', 'gfx-scale-150', 'gfx-scale-100', 'gfx-scale-75', 'gfx-scale-50'], `gfx-scale-${scaleStr}`);

        const resStr = conf.resolution === 'native' ? 'native' : conf.resolution;
        setActive(['gfx-res-native', 'gfx-res-1440', 'gfx-res-1080', 'gfx-res-720'], `gfx-res-${resStr}`);
    };

    if (gfxUltra) {
        gfxUltra.addEventListener('click', () => {
            const conf = setGraphicsPreset('ultra');
            setActive(['gfx-ultra', 'gfx-high', 'gfx-low'], 'gfx-ultra');
            syncUI(conf);
            showNotification('Ultra Sharp mode enabled — 2× supersampling active', 'success');
        });
    }

    if (gfxHigh) {
        gfxHigh.addEventListener('click', () => {
            const conf = setGraphicsPreset('high');
            setActive(['gfx-ultra', 'gfx-high', 'gfx-low'], 'gfx-high');
            syncUI(conf);
        });
    }

    if (gfxLow) {
        gfxLow.addEventListener('click', () => {
            const conf = setGraphicsPreset('low');
            setActive(['gfx-ultra', 'gfx-high', 'gfx-low'], 'gfx-low');
            syncUI(conf);
        });
    }

    // Granular Controls
    const aaIds = ['gfx-aa-on', 'gfx-aa-off'];
    document.getElementById('gfx-aa-on')?.addEventListener('click', () => {
        updateGraphicsSetting('antialias', true);
        setActive(aaIds, 'gfx-aa-on');
        showNotification('Anti-Aliasing enabled — smoother edges', 'success');
    });
    document.getElementById('gfx-aa-off')?.addEventListener('click', () => {
        updateGraphicsSetting('antialias', false);
        setActive(aaIds, 'gfx-aa-off');
        showNotification('Anti-Aliasing disabled', 'info');
    });

    const bloomIds = ['gfx-bloom-on', 'gfx-bloom-off'];
    document.getElementById('gfx-bloom-on')?.addEventListener('click', () => {
        updateGraphicsSetting('bloom', true);
        setActive(bloomIds, 'gfx-bloom-on');
    });
    document.getElementById('gfx-bloom-off')?.addEventListener('click', () => {
        updateGraphicsSetting('bloom', false);
        setActive(bloomIds, 'gfx-bloom-off');
    });

    const shadowIds = ['gfx-shadow-high', 'gfx-shadow-low', 'gfx-shadow-off'];
    shadowIds.forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            const val = id.replace('gfx-shadow-', '');
            updateGraphicsSetting('shadows', val);
            setActive(shadowIds, id);
        });
    });

    const scaleIds = ['gfx-scale-200', 'gfx-scale-150', 'gfx-scale-100', 'gfx-scale-75', 'gfx-scale-50'];
    scaleIds.forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            let val = 1.0;
            if (id.includes('200')) val = 2.0;
            if (id.includes('150')) val = 1.5;
            if (id.includes('75')) val = 0.75;
            if (id.includes('50')) val = 0.5;
            updateGraphicsSetting('scale', val);
            setActive(scaleIds, id);
        });
    });

    const resIds = ['gfx-res-native', 'gfx-res-1440', 'gfx-res-1080', 'gfx-res-720'];
    resIds.forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            let val = 'native';
            if (id.includes('1440')) val = 1440;
            if (id.includes('1080')) val = 1080;
            if (id.includes('720')) val = 720;
            updateGraphicsSetting('resolution', val);
            setActive(resIds, id);
        });
    });

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.toggle('hidden');
        });
    }

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.add('hidden');
        }
    });

    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            settingsPanel.classList.add('hidden');
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset your empire? This will reload the game.")) {
                window.location.reload();
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (saveGame()) {
                showNotification("Empire Saved Successfully", "success");
            } else {
                showNotification("Save Failed", "alert");
            }
        });
    }
}