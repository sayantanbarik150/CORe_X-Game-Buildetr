/* ── CORe X · project state, undo/redo, persistence ── */
'use strict';

CX.state = {
  levels: [],
  active: 0,
  mode: 'edit',            // 'edit' | 'play'
  tool: 'paint',           // paint | fill | erase | enemy
  tile: CX.T.GRASS,
  brush: 1,
  hover: null,             // {x,y} tile under cursor (edit mode)
};

CX.keys = {};              // held keyboard state (e.code -> true)

CX.lev = () => CX.state.levels[CX.state.active];

/* ── Undo / Redo (snapshots of the active level) ─────── */
CX.undoStack = [];
CX.redoStack = [];
const UNDO_LIMIT = 80;

CX.snapshot = () => JSON.stringify(CX.lev());

CX.pushUndo = (snap) => {
  CX.undoStack.push(snap || CX.snapshot());
  if (CX.undoStack.length > UNDO_LIMIT) CX.undoStack.shift();
  CX.redoStack.length = 0;
  CX.ui && CX.ui.syncHistory();
};

CX.undo = () => {
  if (!CX.undoStack.length || CX.state.mode === 'play') return;
  CX.redoStack.push(CX.snapshot());
  CX.applyLevelData(JSON.parse(CX.undoStack.pop()));
};

CX.redo = () => {
  if (!CX.redoStack.length || CX.state.mode === 'play') return;
  CX.undoStack.push(CX.snapshot());
  CX.applyLevelData(JSON.parse(CX.redoStack.pop()));
};

/* Replace the active level with `data` (already validated shape). */
CX.applyLevelData = (data) => {
  CX.state.levels[CX.state.active] = data;
  CX.main && CX.main.onLevelChanged();
  CX.saveLocal();
};

/* ── Mutation helpers (always called while editing) ──── */
CX.setTile = (lv, x, y, id) => {
  if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return;
  const i = CX.key(x, y, lv.w);
  if (id === CX.T.SPAWN) {
    // only one spawn per level: clear any existing
    for (let k = 0; k < lv.tiles.length; k++)
      if (lv.tiles[k] === CX.T.SPAWN) lv.tiles[k] = CX.T.EMPTY;
  }
  if (id !== CX.T.EMPTY) {
    // painting over an enemy's home tile removes that enemy
    lv.enemies = lv.enemies.filter(e => !(e.x === x && e.y === y));
  }
  lv.tiles[i] = id;
};

CX.tileAt = (lv, x, y) => {
  if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return 0;
  return lv.tiles[CX.key(x, y, lv.w)];
};

CX.addEnemyAt = (lv, x, y) => {
  if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return false;
  if (lv.enemies.some(e => e.x === x && e.y === y)) return false;
  lv.enemies.push({ x, y });
  return true;
};

CX.removeEnemyAt = (lv, x, y) => {
  const n = lv.enemies.length;
  lv.enemies = lv.enemies.filter(e => !(e.x === x && e.y === y));
  return lv.enemies.length !== n;
};

/* ── Persistence ─────────────────────────────────────── */
CX.saveTimer = null;
CX.saveLocal = () => {
  clearTimeout(CX.saveTimer);
  CX.saveTimer = setTimeout(() => {
    try {
      const payload = { v: CX.VERSION, active: CX.state.active, levels: CX.state.levels };
      localStorage.setItem(CX.STORE_KEY, JSON.stringify(payload));
      CX.ui && CX.ui.setSaved();
    } catch (e) { /* storage full/blocked */ }
  }, 250);
};

CX.loadLocal = () => {
  let loaded = false;
  try {
    const raw = localStorage.getItem(CX.STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const levels = (data.levels || []).map(CX.sanitizeLevel).filter(Boolean);
      if (levels.length) {
        CX.state.levels = levels;
        CX.state.active = CX.clamp(data.active | 0, 0, levels.length - 1);
        loaded = true;
      }
    }
  } catch (e) { /* corrupted save -> fall through to samples */ }
  if (!loaded) {
    CX.state.levels = CX.sampleLevels();
    CX.state.active = 0;
  }
};
