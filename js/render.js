/* ── CORe X · canvas rendering (editor + play mode) ── */
'use strict';

CX.render = (ctx) => {
  const E = CX.engine;
  if (CX.state.mode === 'play' && E.running && E.lv) CX.renderGame(ctx, E);
  else CX.renderEditor(ctx);
};

/* ── shared tile art ─────────────────────────────────── */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const TILE_COLORS = {
  1: '#58c24f', 2: '#8593a3', 3: '#c0604a', 4: '#b07f4a', 5: '#a8b2bc',
  6: '#d3dae1', 7: '#ffd23f', 8: '#4d7fb3', 9: '#ff5c5c',
};

function bevel(ctx, px, py, s, light, dark) {
  ctx.fillStyle = light; ctx.fillRect(px, py, s, 2); ctx.fillRect(px, py, 2, s);
  ctx.fillStyle = dark;  ctx.fillRect(px, py + s - 2, s, 2); ctx.fillRect(px + s - 2, py, 2, s);
}

function drawTile(ctx, id, px, py, s, t) {
  switch (id) {
    case CX.T.GRASS: {
      ctx.fillStyle = '#7a5230'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#6a4527';
      ctx.fillRect(px + s * 0.2, py + s * 0.55, 3, 3);
      ctx.fillRect(px + s * 0.62, py + s * 0.7, 3, 3);
      ctx.fillStyle = '#58c24f'; ctx.fillRect(px, py, s, s * 0.36);
      ctx.fillStyle = '#7ed66f'; ctx.fillRect(px, py, s, s * 0.12);
      break;
    }
    case CX.T.STONE: {
      ctx.fillStyle = '#8593a3'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#6d7a8a';
      ctx.fillRect(px + s * 0.15, py + s * 0.35, s * 0.34, 2);
      ctx.fillRect(px + s * 0.5, py + s * 0.68, s * 0.34, 2);
      bevel(ctx, px, py, s, '#9fadc0', '#5d6a7a');
      break;
    }
    case CX.T.BRICK: {
      ctx.fillStyle = '#c0604a'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#8a3f2e';
      ctx.fillRect(px, py + s * 0.5 - 1, s, 2);
      ctx.fillRect(px + s * 0.5 - 1, py, 2, s * 0.5);
      ctx.fillRect(px + s * 0.25 - 1, py + s * 0.5, 2, s * 0.5);
      ctx.fillRect(px + s * 0.75 - 1, py + s * 0.5, 2, s * 0.5);
      bevel(ctx, px, py, s, '#d4765f', '#7c3a29');
      break;
    }
    case CX.T.WOOD: {
      ctx.fillStyle = '#b07f4a'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#8a5f36';
      ctx.fillRect(px, py + s * 0.33, s, 2);
      ctx.fillRect(px, py + s * 0.66, s, 2);
      ctx.fillStyle = '#6f4b29';
      ctx.fillRect(px + 3, py + 3, 2, 2); ctx.fillRect(px + s - 5, py + 3, 2, 2);
      bevel(ctx, px, py, s, '#c99a63', '#7c5530');
      break;
    }
    case CX.T.METAL: {
      ctx.fillStyle = '#a8b2bc'; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#8f9aa6'; ctx.fillRect(px + 4, py + 4, s - 8, s - 8);
      ctx.fillStyle = '#c4cdd6';
      [[7, 7], [s - 9, 7], [7, s - 9], [s - 9, s - 9]].forEach(([dx, dy]) =>
        ctx.fillRect(px + dx, py + dy, 2, 2));
      bevel(ctx, px, py, s, '#ccd5de', '#6d7883');
      break;
    }
    case CX.T.SPIKE: {
      ctx.fillStyle = '#39424e'; ctx.fillRect(px, py + s * 0.86, s, s * 0.14);
      const n = 3, w = s / n;
      for (let i = 0; i < n; i++) {
        const x0 = px + i * w;
        ctx.fillStyle = '#d3dae1';
        ctx.beginPath();
        ctx.moveTo(x0 + 1, py + s);
        ctx.lineTo(x0 + w / 2, py + s * 0.3);
        ctx.lineTo(x0 + w - 1, py + s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#8b96a3';
        ctx.beginPath();
        ctx.moveTo(x0 + w / 2, py + s * 0.3);
        ctx.lineTo(x0 + w - 1, py + s);
        ctx.lineTo(x0 + w / 2, py + s);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case CX.T.COIN: {
      const phase = (px + py * 2) * 0.05;
      const sq = Math.abs(Math.sin(t * 3 + phase)) * 0.65 + 0.35;
      const cx = px + s / 2, cy = py + s / 2 + Math.sin(t * 4 + phase) * s * 0.04;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sq, 1);
      ctx.fillStyle = '#e09b00';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.31, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3c2';
      ctx.fillRect(-s * 0.05, -s * 0.14, s * 0.08, s * 0.16);
      ctx.restore();
      break;
    }
    case CX.T.SPAWN: {
      ctx.fillStyle = 'rgba(77,127,179,0.28)';
      rr(ctx, px + 2, py + 2, s - 4, s - 4, 6); ctx.fill();
      ctx.strokeStyle = '#4d7fb3'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
      rr(ctx, px + 2, py + 2, s - 4, s - 4, 6); ctx.stroke();
      ctx.setLineDash([]);
      // up arrow
      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath();
      ctx.moveTo(px + s / 2, py + s * 0.22);
      ctx.lineTo(px + s * 0.74, py + s * 0.55);
      ctx.lineTo(px + s * 0.26, py + s * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(px + s * 0.42, py + s * 0.55, s * 0.16, s * 0.22);
      break;
    }
    case CX.T.GOAL: {
      const gx = px + s * 0.3;
      ctx.fillStyle = '#8f9aa6';
      ctx.fillRect(px + s * 0.16, py + s * 0.9, s * 0.34, s * 0.1);
      ctx.fillStyle = '#cfd6dd';
      ctx.fillRect(gx, py + s * 0.06, s * 0.08, s * 0.86);
      // waving flag
      const wv = Math.sin(t * 6 + py * 0.02) * s * 0.05;
      ctx.fillStyle = '#ff5c5c';
      ctx.beginPath();
      ctx.moveTo(gx + s * 0.08, py + s * 0.08);
      ctx.lineTo(gx + s * 0.62, py + s * 0.2 + wv);
      ctx.lineTo(gx + s * 0.08, py + s * 0.36);
      ctx.closePath(); ctx.fill();
      break;
    }
  }
}

function drawEnemyBlob(ctx, px, py, s, t, dir, squashed, squashT) {
  const cx = px + s * 0.5;
  if (squashed) {
    const a = Math.max(0, squashT / 0.45);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#a33d50';
    ctx.beginPath();
    ctx.ellipse(cx, py + s * 0.88, s * 0.42, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  const bob = Math.sin(t * 9 + px * 0.3) * s * 0.03;
  const bodyY = py + s * 0.42 + bob;
  ctx.fillStyle = '#e0566b';
  rr(ctx, px + s * 0.1, bodyY, s * 0.8, s * 0.5 - bob, s * 0.22);
  ctx.fill();
  ctx.fillStyle = '#b23a50';
  rr(ctx, px + s * 0.1, bodyY + s * 0.3, s * 0.8, s * 0.2 - bob * 0.5, s * 0.1);
  ctx.fill();
  // eyes
  const ex = s * 0.09 * (dir || 1);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - s * 0.14 + ex, bodyY + s * 0.14, s * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.14 + ex, bodyY + s * 0.14, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#232733';
  ctx.beginPath();
  ctx.arc(cx - s * 0.14 + ex * 1.5, bodyY + s * 0.15, s * 0.045, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.14 + ex * 1.5, bodyY + s * 0.15, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  // angry brows
  ctx.strokeStyle = '#232733'; ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.22 + ex, bodyY + s * 0.04);
  ctx.lineTo(cx - s * 0.06 + ex, bodyY + s * 0.08);
  ctx.moveTo(cx + s * 0.22 + ex, bodyY + s * 0.04);
  ctx.lineTo(cx + s * 0.06 + ex, bodyY + s * 0.08);
  ctx.stroke();
}

/* ── editor view ─────────────────────────────────────── */
CX.renderEditor = (ctx) => {
  const cv = ctx.canvas, lv = CX.lev(), TS = CX.TS, st = CX.state;
  if (!lv) return;
  ctx.fillStyle = '#0a0e15';
  ctx.fillRect(0, 0, cv.width, cv.height);

  const t = performance.now() / 1000;
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const id = lv.tiles[y * lv.w + x];
    if (id !== CX.T.EMPTY) drawTile(ctx, id, x * TS, y * TS, TS, t);
  }
  for (const en of lv.enemies)
    drawEnemyBlob(ctx, en.x * TS, en.y * TS, TS, t, 1, false, 0);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < lv.w; x++) { ctx.moveTo(x * TS + .5, 0); ctx.lineTo(x * TS + .5, lv.h * TS); }
  for (let y = 1; y < lv.h; y++) { ctx.moveTo(0, y * TS + .5); ctx.lineTo(lv.w * TS, y * TS + .5); }
  ctx.stroke();

  // hover ghost
  if (st.hover && st.hover.x >= 0 && st.hover.y >= 0 && st.hover.x < lv.w && st.hover.y < lv.h) {
    const { x, y } = st.hover, b = st.brush, off = Math.floor(b / 2);
    if (st.tool === 'enemy') {
      ctx.globalAlpha = 0.55;
      drawEnemyBlob(ctx, x * TS, y * TS, TS, t, 1, false, 0);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 2;
      ctx.strokeRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2);
    } else if (st.tool === 'erase' || st.tool === 'fill') {
      ctx.strokeStyle = st.tool === 'erase' ? '#ff6b6b' : '#63e6a5';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2);
    } else {
      ctx.globalAlpha = 0.5;
      for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) {
        const nx = x + dx - off, ny = y + dy - off;
        if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) continue;
        drawTile(ctx, st.tile, nx * TS, ny * TS, TS, t);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 1.5;
      const gx = (x - off) * TS, gy = (y - off) * TS;
      ctx.strokeRect(gx + .5, gy + .5, b * TS - 1, b * TS - 1);
    }
  }
};

/* ── play view ───────────────────────────────────────── */
CX.renderGame = (ctx, E) => {
  const cv = ctx.canvas, lv = E.lv, TS = CX.TS;
  const viewW = cv.width / TS, viewH = cv.height / TS;
  const t = E.time;

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#1d2b45');
  g.addColorStop(1, '#0e1524');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // drifting soft lights
  ctx.fillStyle = 'rgba(120,160,220,0.05)';
  for (let i = 0; i < 4; i++) {
    const bx = ((t * 12 + i * 260) % (cv.width + 320)) - 160;
    const by = 40 + (i * 97) % cv.height * 0.6;
    ctx.beginPath(); ctx.ellipse(bx, by, 90, 26, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  if (E.shake > 0) {
    ctx.translate((Math.random() - .5) * E.shake * 10, (Math.random() - .5) * E.shake * 10);
  }
  const oy = -E.camY * TS;
  ctx.translate(0, Math.round(oy));

  // tiles (only visible rows)
  const yStart = Math.max(0, Math.floor(E.camY) - 1);
  const yEnd = Math.min(lv.h - 1, Math.ceil(E.camY + viewH) + 1);
  for (let y = yStart; y <= yEnd; y++) for (let x = 0; x < lv.w; x++) {
    const id = lv.tiles[y * lv.w + x];
    if (id !== CX.T.EMPTY) drawTile(ctx, id, x * TS, y * TS, TS, t);
  }

  // enemies
  for (const en of E.enemies)
    drawEnemyBlob(ctx, en.x * TS, en.y * TS, TS, t, en.dir, en.squashed, en.squashT);

  // player
  const p = E.player;
  if (!p.dead) {
    const px = p.x * TS, py = p.y * TS, pw = p.w * TS, ph = p.h * TS;
    const stretch = CX.clamp(1 + Math.abs(p.vy) * 0.006, 1, 1.12) - p.landFx * 0.22;
    ctx.save();
    ctx.translate(px + pw / 2, py + ph);
    ctx.scale(2 - stretch, stretch);
    ctx.translate(-pw / 2, -ph);
    ctx.fillStyle = '#2b8fd6';
    rr(ctx, 0, ph * 0.72, pw, ph * 0.28, 5); ctx.fill();
    ctx.fillStyle = '#46c2ff';
    rr(ctx, 0, 0, pw, ph * 0.8, 7); ctx.fill();
    ctx.strokeStyle = '#123c5c'; ctx.lineWidth = 2;
    rr(ctx, 1, 1, pw - 2, ph - 2, 7); ctx.stroke();
    // eyes
    const look = p.dir * pw * 0.12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(pw * 0.3 + look, ph * 0.28, pw * 0.14, ph * 0.13, 0, 0, Math.PI * 2);
    ctx.ellipse(pw * 0.7 + look, ph * 0.28, pw * 0.14, ph * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10233a';
    ctx.beginPath();
    ctx.arc(pw * 0.3 + look * 1.6, ph * 0.3, pw * 0.065, 0, Math.PI * 2);
    ctx.arc(pw * 0.7 + look * 1.6, ph * 0.3, pw * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // particles
  for (const pt of E.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x * TS, pt.y * TS, pt.size * TS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHUD(ctx, E);
  if (E.finished) drawWinOverlay(ctx, E);
};

function pill(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  rr(ctx, x, y, w, h, h / 2); ctx.fill();
}

function drawHUD(ctx, E) {
  const cv = ctx.canvas;
  ctx.save();
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // level name
  const name = CX.state.levels[E.idx] ? CX.state.levels[E.idx].name : '';
  ctx.font = '600 12px system-ui, sans-serif';
  const nw = ctx.measureText(name).width + 20;
  pill(ctx, cv.width - nw - 10, 10, nw, 24);
  ctx.fillStyle = 'rgba(223,231,242,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(name, cv.width - nw, 23);

  // coin counter
  ctx.font = '700 13px system-ui, sans-serif';
  const coinTxt = `${E.coins}/${E.totalCoins}`;
  pill(ctx, 10, 10, 76, 24);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(26, 22, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e09b00';
  ctx.beginPath(); ctx.arc(26, 22, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(coinTxt, 40, 23);

  // deaths
  pill(ctx, 94, 10, 58, 24);
  ctx.fillStyle = E.deaths ? '#ff8787' : 'rgba(223,231,242,0.6)';
  ctx.fillText('✖ ' + E.deaths, 106, 23);

  // timer
  const tt = CX.formatTime(E.time);
  const tw = ctx.measureText(tt).width + 20;
  pill(ctx, 160, 10, tw, 24);
  ctx.fillStyle = 'rgba(223,231,242,0.8)';
  ctx.fillText(tt, 170, 23);
  ctx.restore();
}

function drawWinOverlay(ctx, E) {
  const cv = ctx.canvas;
  ctx.fillStyle = 'rgba(5,8,14,0.6)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.textAlign = 'center';
  const cx = cv.width / 2, cy = cv.height / 2;
  const bw = Math.min(430, cv.width - 40), bh = 168;
  ctx.fillStyle = 'rgba(18,24,36,0.95)';
  ctx.strokeStyle = '#3b4a63';
  rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 14); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#ffc94d';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText(E.allDone ? '🏆 All levels cleared!' : '⭐ Level complete!', cx, cy - 38);

  ctx.fillStyle = '#b9c5d6';
  ctx.font = '500 13px system-ui, sans-serif';
  const line = `Coins ${E.coins}/${E.totalCoins}   ·   Deaths ${E.deaths}   ·   Time ${CX.formatTime(E.time)}`;
  ctx.fillText(line, cx, cy - 2);

  if (E.allDone) {
    ctx.fillText(`Session: ${E.session.cleared} cleared · ${E.session.coins} coins · ${E.session.deaths} deaths`, cx, cy + 24);
    ctx.fillStyle = '#63e6a5';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('Press Enter to return to the editor', cx, cy + 56);
  } else {
    ctx.fillStyle = '#63e6a5';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('Press Enter for the next level', cx, cy + 56);
  }
  ctx.restore();
}

/* small icon renderer for the palette swatches */
CX.drawSwatchIcon = (canvas, id) => {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  const pad = 2;
  const s = canvas.width - pad * 2;
  ctx.translate(pad, pad);
  drawTile(ctx, id, 0, 0, s, 0.8);
  ctx.restore();
};
