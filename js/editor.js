/* ── CORe X · editor input (pointer tools on the canvas) ── */
'use strict';

CX.editor = (() => {
  let cv = null, stroke = null;

  const tileFromEvent = (e) => {
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cv.width / rect.width);
    const y = (e.clientY - rect.top) * (cv.height / rect.height);
    return { x: Math.floor(x / CX.TS), y: Math.floor(y / CX.TS) };
  };

  const inBounds = (t) => {
    const lv = CX.lev();
    return lv && t.x >= 0 && t.y >= 0 && t.x < lv.w && t.y < lv.h;
  };

  /* stamp brush at tile (paint or erase) */
  const stamp = (mode, tx, ty) => {
    const lv = CX.lev(), b = CX.state.brush, off = Math.floor(b / 2);
    let changed = false;
    for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) {
      const nx = tx + dx - off, ny = ty + dy - off;
      if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) continue;
      if (mode === 'erase') {
        if (CX.removeEnemyAt(lv, nx, ny)) changed = true;
        const i = CX.key(nx, ny, lv.w);
        if (lv.tiles[i] !== CX.T.EMPTY) { lv.tiles[i] = CX.T.EMPTY; changed = true; }
      } else {
        const i = CX.key(nx, ny, lv.w);
        const id = CX.state.tile;
        if (lv.tiles[i] !== id || id === CX.T.SPAWN) {
          CX.setTile(lv, nx, ny, id);
          changed = true;
        }
      }
    }
    return changed;
  };

  /* interpolate a drag from a → b so fast strokes leave no gaps */
  const strokeTo = (mode, a, b) => {
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(a.x + (b.x - a.x) * (i / n));
      const y = Math.round(a.y + (b.y - a.y) * (i / n));
      stamp(mode, x, y);
    }
  };

  const floodFill = (tx, ty, id) => {
    const lv = CX.lev();
    const target = CX.tileAt(lv, tx, ty);
    if (target === id) return;
    const stack = [[tx, ty]], seen = new Set();
    let guard = lv.w * lv.h;
    while (stack.length && guard-- > 0) {
      const [x, y] = stack.pop();
      const k = x + ',' + y;
      if (seen.has(k)) continue;
      seen.add(k);
      if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) continue;
      if (lv.tiles[CX.key(x, y, lv.w)] !== target) continue;
      CX.setTile(lv, x, y, id);
      CX.removeEnemyAt(lv, x, y);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  };

  const eyedropper = (t) => {
    const lv = CX.lev();
    if (lv.enemies.some(e => e.x === t.x && e.y === t.y)) {
      CX.main.setTool('enemy');
      return;
    }
    const id = CX.tileAt(lv, t.x, t.y);
    if (id === CX.T.EMPTY) CX.main.setTool('erase');
    else { CX.state.tile = id; CX.main.setTool('paint'); }
    CX.main.syncToolbar();
    CX.ui.toast(id === CX.T.EMPTY ? 'Picked: empty (eraser)' : 'Picked: ' + CX.TINFO[id].name);
  };

  const onDown = (e) => {
    if (CX.state.mode !== 'edit') return;
    CX.sfx.ensure();
    const t = tileFromEvent(e);
    if (!inBounds(t)) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);

    if (e.altKey && e.button === 0) { eyedropper(t); return; }

    const st = CX.state;
    if (e.button === 2 || st.tool === 'erase') {
      CX.pushUndo();
      stroke = { mode: 'erase', last: t };
      if (stamp('erase', t.x, t.y)) CX.changed();
      return;
    }
    if (e.button !== 0) return;

    if (st.tool === 'paint') {
      CX.pushUndo();
      stroke = { mode: 'paint', last: t };
      if (stamp('paint', t.x, t.y)) CX.changed();
    } else if (st.tool === 'fill') {
      CX.pushUndo();
      floodFill(t.x, t.y, st.tile);
      CX.changed();
    } else if (st.tool === 'enemy') {
      const lv = CX.lev();
      CX.pushUndo();
      if (!CX.removeEnemyAt(lv, t.x, t.y)) CX.addEnemyAt(lv, t.x, t.y);
      CX.changed();
    }
  };

  const onMove = (e) => {
    const t = tileFromEvent(e);
    CX.state.hover = t;
    if (stroke && CX.state.mode === 'edit') {
      if (inBounds(t)) {
        strokeTo(stroke.mode, stroke.last, t);
        stroke.last = t;
        CX.changed();
      }
    }
  };

  const onUp = () => { stroke = null; };

  const init = () => {
    cv = document.getElementById('game');
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', () => { if (!stroke) CX.state.hover = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  return { init };
})();

/* Called after any level mutation from the editor. */
CX.changed = () => {
  CX.ui && CX.ui.dirty();
  CX.saveLocal();
};
