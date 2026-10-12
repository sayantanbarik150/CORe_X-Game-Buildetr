/* ── CORe X · platformer engine (play mode) ──
   All positions are in tile units (floats). The engine operates on a
   deep copy of the level so editing is never affected by playtesting. */
'use strict';

CX.PHYS = Object.freeze({
  MOVE: 8,          // horizontal speed, tiles/s
  GRAV: 40,         // gravity, tiles/s²
  JUMP: -16,        // jump velocity (max height ≈ 3.2 tiles)
  JUMP_CUT: -5,     // velocity cap when releasing jump early
  MAX_FALL: 22,
  COYOTE: 0.10,     // seconds of grace after leaving a ledge
  BUFFER: 0.12,     // seconds of jump input buffering
  ENEMY_SPEED: 2.4,
});

CX.solidAt = (lv, tx, ty) => {
  if (tx < 0 || tx >= lv.w) return true;   // side walls
  if (ty < 0) return false;                // open sky
  if (ty >= lv.h) return false;            // open pit (fall = death)
  return CX.TINFO[lv.tiles[ty * lv.w + tx]].solid;
};

const overlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

CX.engine = {
  running: false,
  idx: -1,
  lv: null,               // working copy {w,h,tiles,enemies(defs),spawnX,spawnY,hasGoal}
  player: null,
  enemies: [],
  particles: [],
  coins: 0, totalCoins: 0,
  deaths: 0, time: 0,
  finished: false, allDone: false,
  respawnT: 0, shake: 0,
  camY: 0,                // smoothed vertical camera (world units)
  session: { coins: 0, deaths: 0, time: 0, cleared: 0 },

  /* ── lifecycle ── */
  start(idx) {
    const src = CX.state.levels[idx];
    if (!src) return;
    this.idx = idx;
    const lv = {
      w: src.w, h: src.h,
      tiles: src.tiles.slice(),
      enemies: src.enemies.map(e => ({ x: e.x, y: e.y })),
    };
    // locate spawn & goal
    let sx = -1, sy = -1;
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const i = y * lv.w + x;
      if (lv.tiles[i] === CX.T.SPAWN) { sx = x; sy = y; lv.tiles[i] = CX.T.EMPTY; }
    }
    this.totalCoins = lv.tiles.reduce((n, t) => n + (t === CX.T.COIN ? 1 : 0), 0);
    const hasGoal = lv.tiles.some(t => t === CX.T.GOAL);
    if (sx < 0) { // no spawn placed: first empty tile, scanning top-left
      outer: for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
        if (lv.tiles[y * lv.w + x] === CX.T.EMPTY) { sx = x; sy = y; break outer; }
      }
      if (sx < 0) { sx = 1; sy = 1; }
    }
    lv.spawnX = sx; lv.spawnY = sy; lv.hasGoal = hasGoal;
    this.lv = lv;

    const P = CX.PHYS;
    this.player = {
      x: sx + 0.19, y: sy + 1 - 0.86, w: 0.62, h: 0.86,
      vx: 0, vy: 0, dir: 1, onGround: false,
      coyote: 0, jumpBuf: 0, dead: false, landFx: 0,
    };
    this.coins = 0; this.deaths = 0; this.time = 0;
    this.finished = false; this.allDone = false; this.respawnT = 0; this.shake = 0;
    this.particles = [];
    this.spawnEnemies();
    this.camY = Math.max(0, (sy + 1) - 13.5);
    this.running = true;
    if (!hasGoal) CX.ui.toast('No goal placed — add a 🚩 flag to make this level winnable');
  },

  stop() { this.running = false; },

  restart() { if (this.idx >= 0) this.start(this.idx); },

  spawnEnemies() {
    this.enemies = this.lv.enemies.map(d => ({
      x: d.x + 0.14, y: d.y + 1 - 0.56, w: 0.72, h: 0.56,
      dir: Math.random() < 0.5 ? -1 : 1,
      vx: 0, vy: 0, onGround: false, squashed: false, squashT: 0,
    }));
  },

  /* ── input hooks (called from keyboard handlers) ── */
  pressJump() {
    const p = this.player;
    if (!this.running || this.finished || !p || p.dead) return;
    p.jumpBuf = CX.PHYS.BUFFER;
  },
  releaseJump() {
    const p = this.player;
    if (p && !p.dead && p.vy < CX.PHYS.JUMP_CUT) p.vy = CX.PHYS.JUMP_CUT;
  },

  /* ── main update ── */
  update(dt) {
    if (!this.running) return;
    this.time += dt;
    this.session.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.updateParticles(dt);

    const p = this.player;
    // smooth camera toward player (vertical levels)
    const targetCam = CX.clamp((p.y + p.h / 2) - 13.5, -1, Math.max(0, this.lv.h - 13.5));
    this.camY += (targetCam - this.camY) * Math.min(1, dt * 6);

    if (this.finished) return;
    if (p.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }

    const P = CX.PHYS, k = CX.keys;
    const left = k['ArrowLeft'] || k['KeyA'], right = k['ArrowRight'] || k['KeyD'];
    const want = (right ? 1 : 0) - (left ? 1 : 0);
    const accel = p.onGround ? 64 : 40;
    if (want !== 0) {
      p.vx = CX.approach(p.vx, want * P.MOVE, accel * dt);
      p.dir = want;
    } else {
      p.vx = CX.approach(p.vx, 0, (p.onGround ? 80 : 8) * dt);
    }

    p.coyote = p.onGround ? P.COYOTE : p.coyote - dt;
    p.jumpBuf -= dt;
    p.landFx = Math.max(0, p.landFx - dt * 5);
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = P.JUMP; p.coyote = 0; p.jumpBuf = 0;
      CX.sfx.jump();
      this.burst(p.x + p.w / 2, p.y + p.h, '#c8d6e8', 6, 2.2, 0);
    }
    p.vy = Math.min(p.vy + P.GRAV * dt, P.MAX_FALL);

    this.moveX(p, dt);
    const wasAir = !p.onGround, fallSpeed = p.vy;
    this.moveY(p, dt);
    if (wasAir && p.onGround && fallSpeed > 8) {
      p.landFx = Math.min(1, fallSpeed / 18);
      this.burst(p.x + p.w / 2, p.y + p.h, '#aab8ca', 5, 2.0, 0);
    }

    this.scanTiles(p);
    if (!p.dead && p.y > this.lv.h + 1) this.kill();

    if (!p.dead) this.updateEnemies(dt);
  },

  /* ── tile interactions ── */
  scanTiles(p) {
    const lv = this.lv, T = CX.T;
    const x0 = Math.floor(p.x), x1 = Math.floor(p.x + p.w);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + p.h);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) continue;
      const i = ty * lv.w + tx, id = lv.tiles[i];
      if (id === T.EMPTY) continue;
      if (id === T.SPIKE) {
        if (overlap(p.x + 0.08, p.y + 0.08, p.w - 0.16, p.h - 0.12, tx + 0.06, ty + 0.42, 0.88, 0.58))
          this.kill();
      } else if (id === T.COIN) {
        if (overlap(p.x, p.y, p.w, p.h, tx + 0.18, ty + 0.18, 0.64, 0.64)) {
          lv.tiles[i] = T.EMPTY;
          this.coins++; this.session.coins++;
          CX.sfx.coin();
          this.burst(tx + 0.5, ty + 0.5, '#ffd23f', 10, 3.4, 4);
        }
      } else if (id === T.GOAL) {
        if (overlap(p.x, p.y, p.w, p.h, tx + 0.1, ty, 0.8, 1)) this.win();
      }
    }
  },

  /* ── movement & collision ── */
  moveX(e, dt) {
    e.x += e.vx * dt;
    const lv = this.lv;
    if (e.vx > 0) {
      const tx = Math.floor(e.x + e.w);
      if (this.colV(tx, e.y, e.h, lv)) { e.x = tx - e.w; e.vx = 0; }
    } else if (e.vx < 0) {
      const tx = Math.floor(e.x);
      if (this.colV(tx, e.y, e.h, lv)) { e.x = tx + 1; e.vx = 0; }
    }
  },
  moveY(e, dt) {
    e.y += e.vy * dt;
    e.onGround = false;
    const lv = this.lv;
    if (e.vy > 0) {
      const ty = Math.floor(e.y + e.h);
      if (this.colH(e.x, e.w, ty, lv)) { e.y = ty - e.h; e.vy = 0; e.onGround = true; }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y);
      if (this.colH(e.x, e.w, ty, lv)) { e.y = ty + 1; e.vy = 0; }
    }
  },
  colV(tx, y, h, lv) {
    const y0 = Math.floor(y + 0.01), y1 = Math.floor(y + h - 0.01);
    for (let ty = y0; ty <= y1; ty++) if (CX.solidAt(lv, tx, ty)) return true;
    return false;
  },
  colH(x, w, ty, lv) {
    const x0 = Math.floor(x + 0.01), x1 = Math.floor(x + w - 0.01);
    for (let tx = x0; tx <= x1; tx++) if (CX.solidAt(lv, tx, ty)) return true;
    return false;
  },

  /* ── enemies ── */
  updateEnemies(dt) {
    const P = CX.PHYS, p = this.player, lv = this.lv;
    for (const en of this.enemies) {
      if (en.squashed) { en.squashT -= dt; continue; }
      en.vy = Math.min(en.vy + P.GRAV * dt, P.MAX_FALL);
      en.x += en.dir * P.ENEMY_SPEED * dt;
      // wall ahead?
      const frontX = en.dir > 0 ? Math.floor(en.x + en.w) : Math.floor(en.x);
      if (this.colV(frontX, en.y, en.h, lv)) {
        en.x = en.dir > 0 ? frontX - en.w : frontX + 1;
        en.dir *= -1;
      }
      this.moveY(en, dt);
      // ledge ahead? turn around
      if (en.onGround) {
        const footX = en.dir > 0 ? en.x + en.w + 0.06 : en.x - 0.06;
        if (!CX.solidAt(lv, Math.floor(footX), Math.floor(en.y + en.h + 0.12)))
          en.dir *= -1;
      }
      // player contact
      if (overlap(p.x + 0.06, p.y + 0.06, p.w - 0.12, p.h - 0.1, en.x + 0.05, en.y + 0.05, en.w - 0.1, en.h - 0.08)) {
        if (p.vy > 0 && (p.y + p.h) - en.y < 0.42) {
          en.squashed = true; en.squashT = 0.45;
          p.vy = -9;
          CX.sfx.stomp();
          this.burst(en.x + en.w / 2, en.y + en.h / 2, '#e0566b', 12, 3.6, 6);
        } else {
          this.kill();
        }
      }
    }
    this.enemies = this.enemies.filter(e => !e.squashed || e.squashT > 0);
  },

  /* ── death / respawn / win ── */
  kill() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    this.deaths++; this.session.deaths++;
    this.respawnT = 0.65;
    this.shake = 0.4;
    CX.sfx.die();
    this.burst(p.x + p.w / 2, p.y + p.h / 2, '#46c2ff', 14, 5, 8);
    this.burst(p.x + p.w / 2, p.y + p.h / 2, '#ffffff', 8, 4, 8);
  },
  respawn() {
    const lv = this.lv, p = this.player;
    p.x = lv.spawnX + 0.19; p.y = lv.spawnY + 1 - 0.86;
    p.vx = 0; p.vy = 0; p.dead = false; p.coyote = 0; p.jumpBuf = 0;
    this.spawnEnemies();
  },
  win() {
    if (this.finished) return;
    this.finished = true;
    this.session.cleared++;
    this.allDone = this.idx >= CX.state.levels.length - 1;
    CX.sfx.win();
    const p = this.player;
    for (let i = 0; i < 3; i++)
      this.burst(p.x + p.w / 2, p.y, ['#ffd23f', '#63e6a5', '#46c2ff'][i], 14, 6, 10);
  },

  /* ── particles ── */
  burst(x, y, color, n, speed, upBias) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - upBias * 0.5,
        life: 0.35 + Math.random() * 0.4,
        max: 0.75,
        color, size: 0.06 + Math.random() * 0.09,
      });
    }
  },
  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.vy += 14 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    this.particles = this.particles.filter(pt => pt.life > 0);
  },
};
