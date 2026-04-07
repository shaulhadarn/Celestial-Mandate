/**
 * Level Editor UI — builds and manages all DOM elements for the editor.
 */

const PLANET_TYPES = ['Terran', 'Continental', 'Ocean', 'Barren', 'Molten', 'Ice', 'Arctic', 'Desert', 'Tomb'];

const PALETTE = [
    { cat: 'Trees', items: [
        { key: 'tree',       icon: '\u{1F332}', label: 'Conifer' },
        { key: 'tree_round', icon: '\u{1F333}', label: 'Round' },
        { key: 'tree_tall',  icon: '\u{1F334}', label: 'Tall' },
    ]},
    { cat: 'Flora', items: [
        { key: 'bush',       icon: '\u{1F33F}', label: 'Bush' },
        { key: 'wildflower', icon: '\u{1F338}', label: 'Flower' },
        { key: 'alien_plant',icon: '\u{1F344}', label: 'Alien' },
    ]},
    { cat: 'Props', items: [
        { key: 'rock',    icon: '\u{1FAA8}', label: 'Rock' },
        { key: 'crystal', icon: '\u{1F48E}', label: 'Crystal' },
    ]},
    { cat: 'Water', items: [
        { key: 'lake', icon: '\u{1F4A7}', label: 'Lake' },
    ]},
];

const TOOLS = [
    { key: 'place',  label: 'Place' },
    { key: 'select', label: 'Select' },
    { key: 'delete', label: 'Delete' },
];

let _callbacks = null;

export function buildEditorUI(callbacks) {
    _callbacks = callbacks;
    _buildToolbar();
    _buildPalette();
    _buildBottomBar();
}

export function destroyEditorUI() {
    for (const id of ['editor-toolbar', 'editor-palette', 'editor-properties', 'editor-bottombar', 'editor-modal']) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    }
    const props = document.getElementById('editor-properties');
    if (props) props.classList.add('hidden');
    const modal = document.getElementById('editor-modal');
    if (modal) modal.classList.add('hidden');
    _callbacks = null;
}

function _buildToolbar() {
    const tb = document.getElementById('editor-toolbar');
    if (!tb) return;
    tb.innerHTML = '';

    // Title
    const title = document.createElement('span');
    title.className = 'editor-toolbar-label';
    title.textContent = 'Level Editor';
    title.style.fontSize = '13px';
    title.style.color = '#00f2ff';
    title.style.letterSpacing = '3px';
    tb.appendChild(title);

    tb.appendChild(_sep());

    // Planet type selector
    const ptLabel = document.createElement('span');
    ptLabel.className = 'editor-toolbar-label';
    ptLabel.textContent = 'Planet';
    tb.appendChild(ptLabel);

    const select = document.createElement('select');
    select.id = 'editor-planet-select';
    PLANET_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        select.appendChild(opt);
    });
    select.value = _callbacks.getPlanetType();
    select.addEventListener('change', () => _callbacks.onChangePlanetType(select.value));
    tb.appendChild(select);

    tb.appendChild(_sep());

    // Tool buttons
    const toolLabel = document.createElement('span');
    toolLabel.className = 'editor-toolbar-label';
    toolLabel.textContent = 'Tool';
    tb.appendChild(toolLabel);

    TOOLS.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'editor-tool-btn';
        btn.dataset.tool = tool.key;
        btn.textContent = tool.label;
        if (tool.key === 'place') btn.classList.add('active');
        btn.addEventListener('click', () => {
            tb.querySelectorAll('.editor-tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _callbacks.onChangeTool(tool.key);
        });
        tb.appendChild(btn);
    });

    tb.appendChild(_sep());

    // Object count
    const count = document.createElement('span');
    count.className = 'editor-obj-count';
    count.id = 'editor-obj-count';
    count.textContent = '0 objects';
    tb.appendChild(count);
}

function _buildPalette() {
    const pal = document.getElementById('editor-palette');
    if (!pal) return;
    pal.innerHTML = '';

    PALETTE.forEach(cat => {
        const catLabel = document.createElement('div');
        catLabel.className = 'editor-palette-cat';
        catLabel.textContent = cat.cat;
        pal.appendChild(catLabel);

        const grid = document.createElement('div');
        grid.className = 'editor-palette-grid';

        cat.items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'editor-palette-item';
            btn.dataset.brush = item.key;
            if (item.key === 'tree') btn.classList.add('active');
            btn.innerHTML = `<span class="editor-palette-icon">${item.icon}</span>${item.label}`;
            btn.addEventListener('click', () => {
                pal.querySelectorAll('.editor-palette-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                _callbacks.onSelectBrush(item.key);
                // Auto-switch to place tool
                const tb = document.getElementById('editor-toolbar');
                if (tb) {
                    tb.querySelectorAll('.editor-tool-btn').forEach(b => b.classList.remove('active'));
                    const placeBtn = tb.querySelector('[data-tool="place"]');
                    if (placeBtn) placeBtn.classList.add('active');
                }
                _callbacks.onChangeTool('place');
            });
            grid.appendChild(btn);
        });

        pal.appendChild(grid);
    });
}

function _buildBottomBar() {
    const bar = document.getElementById('editor-bottombar');
    if (!bar) return;
    bar.innerHTML = '';

    const btns = [
        { label: 'Save',   action: () => _showSaveModal() },
        { label: 'Load',   action: () => _showLoadModal() },
        { label: 'Export',  action: () => _callbacks.onExport() },
        { label: 'Clear',  action: () => _callbacks.onClear(), cls: 'danger' },
        { label: 'Exit',   action: () => _callbacks.onExit(),  cls: 'danger' },
    ];

    btns.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'editor-action-btn' + (b.cls ? ' ' + b.cls : '');
        btn.textContent = b.label;
        btn.addEventListener('click', b.action);
        bar.appendChild(btn);
    });
}

// ── Properties Panel ────────────────────────────────────────────────────────

export function updateProperties(obj) {
    const panel = document.getElementById('editor-properties');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'editor-prop-title';
    title.textContent = obj.type.replace(/_/g, ' ');
    panel.appendChild(title);

    // Position
    _propRow(panel, 'X', Math.round(obj.x));
    _propRow(panel, 'Z', Math.round(obj.z));

    // Rotation slider
    const rotLabel = document.createElement('div');
    rotLabel.className = 'editor-prop-label';
    rotLabel.textContent = 'Rotation';
    panel.appendChild(rotLabel);

    const rotSlider = document.createElement('input');
    rotSlider.type = 'range';
    rotSlider.className = 'editor-slider';
    rotSlider.min = '0'; rotSlider.max = '360'; rotSlider.step = '1';
    rotSlider.value = String(Math.round((obj.rotY || 0) * 180 / Math.PI));
    rotSlider.addEventListener('input', () => {
        _callbacks.onUpdateProperty(obj.id, 'rotY', parseFloat(rotSlider.value) * Math.PI / 180);
    });
    panel.appendChild(rotSlider);

    // Scale slider
    const scaleLabel = document.createElement('div');
    scaleLabel.className = 'editor-prop-label';
    scaleLabel.textContent = 'Scale';
    panel.appendChild(scaleLabel);

    const scaleSlider = document.createElement('input');
    scaleSlider.type = 'range';
    scaleSlider.className = 'editor-slider';
    scaleSlider.min = '0.3'; scaleSlider.max = '3'; scaleSlider.step = '0.1';
    scaleSlider.value = String(obj.scale || 1);
    scaleSlider.addEventListener('input', () => {
        _callbacks.onUpdateProperty(obj.id, 'scale', parseFloat(scaleSlider.value));
    });
    panel.appendChild(scaleSlider);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'editor-prop-delete';
    delBtn.textContent = 'Delete Object';
    delBtn.addEventListener('click', () => {
        _callbacks.onDeleteSelected();
        clearProperties();
    });
    panel.appendChild(delBtn);
}

export function clearProperties() {
    const panel = document.getElementById('editor-properties');
    if (panel) { panel.innerHTML = ''; panel.classList.add('hidden'); }
}

export function updateObjectCount(n) {
    const el = document.getElementById('editor-obj-count');
    if (el) el.textContent = `${n} object${n !== 1 ? 's' : ''}`;
}

// ── Save/Load Modals ────────────────────────────────────────────────────────

function _showSaveModal() {
    const modal = document.getElementById('editor-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'editor-modal-box';

    const title = document.createElement('div');
    title.className = 'editor-modal-title';
    title.textContent = 'Save Map';
    box.appendChild(title);

    const input = document.createElement('input');
    input.className = 'editor-modal-input';
    input.placeholder = 'Enter map name...';
    input.autofocus = true;
    box.appendChild(input);

    const btns = document.createElement('div');
    btns.className = 'editor-modal-btns';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'editor-action-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    btns.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'editor-action-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (name) {
            _callbacks.onSave(name);
            modal.classList.add('hidden');
        }
    });
    btns.appendChild(saveBtn);

    box.appendChild(btns);
    modal.appendChild(box);
    setTimeout(() => input.focus(), 50);
}

function _showLoadModal() {
    const modal = document.getElementById('editor-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'editor-modal-box';

    const title = document.createElement('div');
    title.className = 'editor-modal-title';
    title.textContent = 'Load Map';
    box.appendChild(title);

    const maps = _callbacks.getMapList();
    if (maps.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = '#667788';
        empty.style.fontSize = '13px';
        empty.style.marginBottom = '14px';
        empty.textContent = 'No saved maps yet.';
        box.appendChild(empty);
    } else {
        const list = document.createElement('ul');
        list.className = 'editor-map-list';
        maps.forEach(m => {
            const li = document.createElement('li');
            li.className = 'editor-map-item';

            const info = document.createElement('div');
            const name = document.createElement('span');
            name.className = 'editor-map-name';
            name.textContent = m.name;
            info.appendChild(name);
            const type = document.createElement('span');
            type.className = 'editor-map-type';
            type.textContent = '  ' + m.planetType;
            info.appendChild(type);
            li.appendChild(info);

            const del = document.createElement('button');
            del.className = 'editor-map-del';
            del.textContent = '\u2715';
            del.title = 'Delete map';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                _callbacks.onDeleteMap(m.name);
                _showLoadModal(); // refresh
            });
            li.appendChild(del);

            li.addEventListener('click', () => {
                _callbacks.onLoad(m.name);
                modal.classList.add('hidden');
            });
            list.appendChild(li);
        });
        box.appendChild(list);
    }

    const btns = document.createElement('div');
    btns.className = 'editor-modal-btns';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'editor-action-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    btns.appendChild(cancelBtn);
    box.appendChild(btns);

    modal.appendChild(box);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _sep() {
    const s = document.createElement('div');
    s.className = 'editor-toolbar-sep';
    return s;
}

function _propRow(parent, label, value) {
    const row = document.createElement('div');
    row.className = 'editor-prop-row';
    const l = document.createElement('span');
    l.className = 'editor-prop-label';
    l.textContent = label;
    row.appendChild(l);
    const v = document.createElement('span');
    v.className = 'editor-prop-value';
    v.textContent = String(value);
    row.appendChild(v);
    parent.appendChild(row);
}
