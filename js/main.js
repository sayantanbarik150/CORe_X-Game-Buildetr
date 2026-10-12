/* ── CORe X · app shell, UI wiring, keyboard, game loop ── */
'use strict';

/* ═══ small UI utilities ═══ */
CX.ui = (() => {
  let statusDirty = false;
  const toasts = () => document.getElementById('toasts');

  return {
    toast(msg) {
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = msg;
      toasts().appendChild(d);
      requestAnimationFrame(() => d.classList.add('show'));
      setTimeout(() => {
        d.classList.remove('show');
        setTimeout(() => d.remove(), 300);
      }, 2600);
    },
    dirty() { statusDirty = true; },
    takeDirty() { const v = statusDirty; statusDirty = false; return v; },
    syncHistory() {
      document.getElementById('btn-undo').disabled = !CX.undoStack.length;
      document.getElementById('btn-redo').disabled = !CX.redoStack.length;
    },
    setSaved() {
      document.getElementById('status-right').textContent =
        'Saved ✓ · Autosaves to this browser · CORe X v1.0';
    },

    /* Generic modal: fields -> onSubmit(values) */
    modal({ title, bodyHTML = '', fields = [], submit = 'OK', onSubmit }) {
      const backdrop = document.getElementById('modal-backdrop');
      const box = document.getElementById('modal');
      box.innerHTML = '';
      const h2 = document.createElement('h2');
      h2.textContent = title;
      box.appendChild(h2);
      if (bodyHTML) {
        const bd = document.createElement('div');
        bd.className = 'mbody';
        bd.innerHTML = bodyHTML;
        box.appendChild(bd);
      }
      const form = document.createElement('form');
      const inputs = {};
      for (const f of fields) {
        const wrap = document.createElement('div');
        wrap.className = 'mfield';
        const lab = document.createElement('label');
        lab.textContent = f.label;
        wrap.appendChild(lab);
        let el;
        if (f.type === 'select') {
          el = document.createElement('select');
          for (const o of f.options) {
            const opt = document.createElement('option');
            opt.value = o.v; opt.textContent = o.label;
            el.appendChild(opt);
          }
          el.value = f.value;
        } else {
          el = document.createElement('input');
          el.type = f.type || 'text';
          el.value = f.value !== undefined ? f.value : '';
          if (f.min !== undefined) el.min = f.min;
          if (f.max !== undefined) el.max = f.max;
        }
        inputs[f.key] = el;
        wrap.appendChild(el);
        form.appendChild(wrap);
      }
      const actions = document.createElement('div');
      actions.className = 'mactions';
      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = 'Cancel';
      const ok = document.createElement('button');
      ok.type = 'submit'; ok.className = 'btn primary'; ok.textContent = submit;
      actions.appendChild(cancel); actions.appendChild(ok);
      form.appendChild(actions);

      const close = () => { backdrop.hidden = true; box.innerHTML = ''; };
      cancel.addEventListener('click', close);
      backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const values = {};
        for (const k in inputs) values[k] = inputs[k].value;
        close();
        onSubmit && onSubmit(values);
      });
      box.appendChild(form);
      backdrop.hidden = false;
      const first = form.querySelector('input, select');
      if (first) { first.focus(); first.select && first.select(); }
    },
  };
})();

/* ═══ main app ═══ */
CX.main = (() => {
  let cv, ctx, playBtn;
  let statsDirty = true;

  const $ = (id) => document.getElementById(id);

  /* ── canvas & panels sync ── */
  function syncCanvasSize() {
    const lv = CX.lev();
    cv.width = lv.w * CX.TS;
    cv.height = lv.h * CX.TS;
  }
  function rebuildSelect() {
    const sel = $('level-select');
    sel.innerHTML = '';
    CX.state.levels.forEach((lv, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = lv.name;
      sel.appendChild(o);
    });
    sel.value = CX.state.active;
  }
  function syncRightPanel() {
    const lv = CX.lev();
    $('lvl-name').textContent = lv.name;
    $('lvl-w').value = lv.w;
    $('lvl-h').value = lv.h;
    updateStats();
  }
  function updateStats() {
    const lv = CX.lev();
    const c = { solid: 0, coin: 0, spike: 0, spawn: 0, goal: 0 };
    for (const id of lv.tiles) {
      if (CX.TINFO[id].solid) c.solid++;
      else if (id === CX.T.COIN) c.coin++;
      else if (id === CX.T.SPIKE) c.spike++;
      else if (id === CX.T.SPAWN) c.spawn++;
      else if (id === CX.T.GOAL) c.goal++;
    }
    const row = (label, val, cls) =>
      `<li><span>${label}</span><b class="${cls || ''}">${val}</b></li>`;
    $('stats').innerHTML =
      row('Size', lv.w + ' × ' + lv.h) +
      row('Solid blocks', c.solid) +
      row('Coins', c.coin) +
      row('Spikes', c.spike) +
      row('Enemies', lv.enemies.length) +
      row('Spawn', c.spawn ? '1' : 'missing', c.spawn ? 'ok' : 'warn') +
      row('Goal', c.goal ? '1' : 'missing', c.goal ? 'ok' : 'warn');
  }
  function updateSession() {
    const s = CX.engine.session;
    $('session-stats').innerHTML =
      `<li><span>Levels cleared</span><b>${s.cleared}</b></li>` +
      `<li><span>Coins collected</span><b>${s.coins}</b></li>` +
      `<li><span>Deaths</span><b>${s.deaths}</b></li>` +
      `<li><span>Play time</span><b>${CX.formatTime(s.time)}</b></li>`;
  }
  function updateStatus() {
    const el = $('status-left');
    if (CX.state.mode === 'play') {
      el.textContent = '▶ Playing — ← → / A D move · Space jump · R restart · Esc stop';
      return;
    }
    const lv = CX.lev();
    const h = CX.state.hover;
    const pos = (h && h.x >= 0 && h.y >= 0 && h.x < lv.w && h.y < lv.h)
      ? `(${h.x}, ${h.y}) ${CX.TINFO[CX.tileAt(lv, h.x, h.y)].name}`
      : '—';
    const tools = { paint: 'Brush', fill: 'Fill', erase: 'Erase', enemy: 'Enemy' };
    el.textContent = `${tools[CX.state.tool]} · ${pos} · Level ${lv.w}×${lv.h}`;
  }

  /* ── toolbar ── */
  function buildToolbar() {
    const sw = $('swatches');
    CX.SWATCHES.forEach((id, i) => {
      const d = document.createElement('div');
      d.className = 'swatch';
      d.dataset.tile = id;
      d.title = CX.TINFO[id].name + ' (' + (i + 1) + ')';
      const c = document.createElement('canvas');
      c.width = 30; c.height = 30;
      CX.drawSwatchIcon(c, id);
      const nm = document.createElement('div');
      nm.className = 'nm'; nm.textContent = CX.TINFO[id].name;
      const k = document.createElement('div');
      k.className = 'key'; k.textContent = i + 1;
      d.appendChild(k); d.appendChild(c); d.appendChild(nm);
      d.addEventListener('click', () => {
        CX.state.tile = id;
        if (CX.state.tool === 'erase' || CX.state.tool === 'enemy') CX.state.tool = 'paint';
        syncToolbar();
      });
      sw.appendChild(d);
    });
    document.querySelectorAll('#tools .tool').forEach(b =>
      b.addEventListener('click', () => setTool(b.dataset.tool)));
    document.querySelectorAll('#brush-seg button').forEach(b =>
      b.addEventListener('click', () => setBrush(+b.dataset.brush)));
  }
  function setTool(name) { CX.state.tool = name; syncToolbar(); }
  function setBrush(n) { CX.state.brush = CX.clamp(n, 1, 3); syncToolbar(); }
  function syncToolbar() {
    document.querySelectorAll('#tools .tool').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === CX.state.tool));
    document.querySelectorAll('.swatch').forEach(s =>
      s.classList.toggle('active', +s.dataset.tile === CX.state.tile));
    document.querySelectorAll('#brush-seg button').forEach(b =>
      b.classList.toggle('active', +b.dataset.brush === CX.state.brush));
  }

  /* ── play control ── */
  function startPlay() {
    CX.state.mode = 'play';
    CX.state.hover = null;
    document.body.classList.add('playing');
    CX.engine.session = { coins: 0, deaths: 0, time: 0, cleared: 0 };
    CX.engine.start(CX.state.active);
    playBtn.textContent = '■ Stop';
    playBtn.classList.add('stop');
    if (document.activeElement) document.activeElement.blur();
  }
  function stopPlay() {
    CX.state.mode = 'edit';
    document.body.classList.remove('playing');
    CX.engine.stop();
    playBtn.textContent = '▶ Play';
    playBtn.classList.remove('stop');
    if (document.activeElement) document.activeElement.blur();
  }
  function advance() {
    const E = CX.engine;
    if (!E.allDone && E.idx + 1 < CX.state.levels.length) {
      setActive(E.idx + 1);
      E.start(E.idx + 1);
    } else {
      stopPlay();
      CX.ui.toast('🏆 Project complete — every level cleared!');
    }
  }

  /* ── level management ── */
  function setActive(i) {
    CX.state.active = CX.clamp(i, 0, CX.state.levels.length - 1);
    syncCanvasSize();
    rebuildSelect();
    syncRightPanel();
    CX.saveLocal();
  }
  function onLevelChanged() {   // after undo/redo/resize
    syncCanvasSize();
    rebuildSelect();
    syncRightPanel();
  }
  function newLevelModal() {
    CX.ui.modal({
      title: 'New level',
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: 'Level ' + (CX.state.levels.length + 1) },
        { key: 'w', label: 'Width (tiles)', type: 'number', value: 24, min: CX.MIN_W, max: CX.MAX_W },
        { key: 'h', label: 'Height (tiles)', type: 'number', value: 14, min: CX.MIN_H, max: CX.MAX_H },
        { key: 'template', label: 'Template', type: 'select', value: 'field', options: [
          { v: 'field', label: 'Grass field (spawn + goal)' },
          { v: 'blank', label: 'Blank' },
        ] },
      ],
      submit: 'Create',
      onSubmit(v) {
        const lv = CX.makeLevel(v.name.trim() || 'Untitled', +v.w, +v.h, v.template);
        CX.state.levels.push(lv);
        setActive(CX.state.levels.length - 1);
        CX.ui.toast('Created “' + lv.name + '”');
      },
    });
  }
  function duplicateLevel() {
    const src = CX.lev();
    const copy = CX.cloneLevel(src);
    copy.id = CX.uid();
    copy.name = src.name + ' copy';
    CX.state.levels.splice(CX.state.active + 1, 0, copy);
    setActive(CX.state.active + 1);
    CX.ui.toast('Duplicated level');
  }
  function deleteLevel() {
    if (CX.state.levels.length <= 1) { CX.ui.toast('Cannot delete the last level'); return; }
    const lv = CX.lev();
    if (!confirm('Delete “' + lv.name + '”? This cannot be undone.')) return;
    CX.state.levels.splice(CX.state.active, 1);
    setActive(Math.min(CX.state.active, CX.state.levels.length - 1));
    CX.ui.toast('Level deleted');
  }
  function renameLevel() {
    const lv = CX.lev();
    CX.ui.modal({
      title: 'Rename level',
      fields: [{ key: 'name', label: 'Name', type: 'text', value: lv.name }],
      submit: 'Rename',
      onSubmit(v) {
        lv.name = (v.name || '').trim().slice(0, 48) || lv.name;
        rebuildSelect(); syncRightPanel(); CX.saveLocal();
      },
    });
  }
  function resizeLevel() {
    const lv = CX.lev();
    const w = CX.clamp(Math.round(+$('lvl-w').value) || lv.w, CX.MIN_W, CX.MAX_W);
    const h = CX.clamp(Math.round(+$('lvl-h').value) || lv.h, CX.MIN_H, CX.MAX_H);
    if (w === lv.w && h === lv.h) { syncRightPanel(); return; }
    CX.pushUndo();
    const tiles = new Array(w * h).fill(0);
    for (let y = 0; y < Math.min(h, lv.h); y++)
      for (let x = 0; x < Math.min(w, lv.w); x++)
        tiles[y * w + x] = lv.tiles[y * lv.w + x];
    const enemies = lv.enemies.filter(e => e.x < w && e.y < h);
    CX.applyLevelData({ id: lv.id, name: lv.name, w, h, tiles, enemies });
    CX.ui.toast(`Resized to ${w} × ${h}`);
  }

  /* ── import / export ── */
  function exportProject() {
    const data = {
      app: 'CORe X Game Builder', v: CX.VERSION,
      exported: new Date().toISOString(),
      levels: CX.state.levels,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'corex-levels.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    CX.ui.toast('Exported ' + CX.state.levels.length + ' level(s)');
  }
  function importProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const arr = Array.isArray(data) ? data : (data.levels || []);
        const levels = arr.map(CX.sanitizeLevel).filter(Boolean);
        if (!levels.length) { CX.ui.toast('No valid levels found in that file'); return; }
        if (!confirm('Import ' + levels.length + ' level(s)? This replaces the current project.')) return;
        if (CX.state.mode === 'play') stopPlay();
        CX.undoStack.length = 0; CX.redoStack.length = 0;
        CX.state.levels = levels;
        setActive(0);
        CX.ui.syncHistory();
        CX.ui.toast('Imported ' + levels.length + ' level(s)');
      } catch (err) {
        CX.ui.toast('Import failed — that file is not valid level JSON');
      }
    };
    reader.readAsText(file);
  }
  function loadDemo() {
    if (!confirm('Replace the current project with the built-in demo levels?')) return;
    if (CX.state.mode === 'play') stopPlay();
    CX.undoStack.length = 0; CX.redoStack.length = 0;
    CX.state.levels = CX.sampleLevels();
    setActive(0);
    CX.ui.syncHistory();
    CX.ui.toast('Demo levels loaded');
  }

  /* ── keyboard ── */
  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  function onKeydown(e) {
    const tgt = e.target;
    if (tgt && /^(INPUT|SELECT|TEXTAREA)$/.test(tgt.tagName)) return;
    if (!document.getElementById('modal-backdrop').hidden) return; // modal handles its own keys

    if (CX.state.mode === 'play') {
      CX.keys[e.code] = true;
      if (JUMP_KEYS.includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) CX.engine.pressJump();
      } else if (e.code === 'Escape') stopPlay();
      else if (e.code === 'KeyR') CX.engine.restart();
      else if (e.code === 'Enter' && CX.engine.finished) { e.preventDefault(); advance(); }
      return;
    }
    // edit mode
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      e.shiftKey ? CX.redo() : CX.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); CX.redo(); return; }
    switch (e.code) {
      case 'KeyB': setTool('paint'); return;
      case 'KeyF': setTool('fill'); return;
      case 'KeyE': setTool('erase'); return;
      case 'KeyN': setTool('enemy'); return;
      case 'Minus': setBrush(CX.state.brush - 1); return;
      case 'Equal': setBrush(CX.state.brush + 1); return;
      case 'Enter': e.preventDefault(); startPlay(); return;
      case 'Space': e.preventDefault(); return;
    }
    if (/^Digit[1-9]$/.test(e.code)) {
      const id = CX.SWATCHES[+e.code.slice(5) - 1];
      if (id !== undefined) {
        CX.state.tile = id;
        if (CX.state.tool === 'erase' || CX.state.tool === 'enemy') CX.state.tool = 'paint';
        syncToolbar();
      }
    }
  }
  function onKeyup(e) {
    delete CX.keys[e.code];
    if (CX.state.mode === 'play' && JUMP_KEYS.includes(e.code)) CX.engine.releaseJump();
  }

  /* ── main loop ── */
  function loop() {
    let last = performance.now(), uiT = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (CX.state.mode === 'play') CX.engine.update(dt);
      CX.render(ctx);
      uiT += dt;
      if (uiT > 0.15) {
        uiT = 0;
        if (CX.ui.takeDirty() || statsDirty) { statsDirty = false; updateStats(); }
        updateSession();
        updateStatus();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ── boot ── */
  function init() {
    cv = $('game');
    ctx = cv.getContext('2d');
    playBtn = $('btn-play');

    CX.loadLocal();
    buildToolbar();
    syncToolbar();
    CX.editor.init();
    setActive(CX.state.active);
    CX.ui.syncHistory();

    playBtn.addEventListener('click', () =>
      CX.state.mode === 'edit' ? startPlay() : stopPlay());
    $('btn-undo').addEventListener('click', () => CX.undo());
    $('btn-redo').addEventListener('click', () => CX.redo());
    $('btn-new').addEventListener('click', newLevelModal);
    $('btn-dup').addEventListener('click', duplicateLevel);
    $('btn-rename').addEventListener('click', renameLevel);
    $('btn-del').addEventListener('click', deleteLevel);
    $('btn-export').addEventListener('click', exportProject);
    $('btn-import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) importProject(e.target.files[0]);
      e.target.value = '';
    });
    $('btn-demo').addEventListener('click', loadDemo);
    $('btn-resize').addEventListener('click', resizeLevel);
    $('level-select').addEventListener('change', (e) => {
      if (CX.state.mode === 'play') return;
      setActive(+e.target.value);
    });
    $('btn-help').addEventListener('click', () => CX.ui.modal({
      title: 'CORe X — help',
      bodyHTML: `
        <p><b>Build:</b> paint tiles on the grid, place one <b>Spawn</b> and one <b>Goal</b>,
        drop some enemies, then press <kbd>Enter</kbd> to play your level.</p>
        <table>
          <tr><td>Paint / Fill / Erase / Enemy</td><td><kbd>B</kbd> <kbd>F</kbd> <kbd>E</kbd> <kbd>N</kbd></td></tr>
          <tr><td>Select tile</td><td><kbd>1</kbd>–<kbd>9</kbd></td></tr>
          <tr><td>Brush size</td><td><kbd>-</kbd> / <kbd>+</kbd></td></tr>
          <tr><td>Erase (any tool)</td><td>right-drag</td></tr>
          <tr><td>Pick tile</td><td><kbd>Alt</kbd>-click</td></tr>
          <tr><td>Undo / Redo</td><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>⇧</kbd>+<kbd>Z</kbd></td></tr>
          <tr><td>Play / Stop</td><td><kbd>Enter</kbd> / <kbd>Esc</kbd></td></tr>
          <tr><td>Move · Jump</td><td><kbd>←</kbd><kbd>→</kbd>/<kbd>A</kbd><kbd>D</kbd> · <kbd>Space</kbd></td></tr>
          <tr><td>Restart level</td><td><kbd>R</kbd></td></tr>
        </table>
        <p>Levels autosave to this browser. Use <b>Export</b> to back them up as JSON
        and <b>Import</b> to bring them back.</p>`,
      submit: 'Got it',
    }));

    // blur buttons after click so Space/Enter don't retrigger them
    document.addEventListener('click', (e) => {
      if (e.target && e.target.tagName === 'BUTTON') e.target.blur();
    });

    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
    window.addEventListener('blur', () => { CX.keys = {}; });

    loop();
    CX.ui.toast('👋 Welcome to CORe X — press Enter to play the first demo level!');
  }

  return { init, onLevelChanged, setTool, syncToolbar };
})();

CX.main.init();
