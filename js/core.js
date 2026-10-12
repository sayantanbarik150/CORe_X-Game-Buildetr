/* ── CORe X · core constants, tile registry, helpers, sfx ── */
'use strict';
window.CX = window.CX || {};

CX.VERSION = 1;
CX.STORE_KEY = 'corex-game-builder-v1';
CX.TS = 32;                 // tile size in px
CX.MIN_W = 8;  CX.MAX_W = 48;
CX.MIN_H = 8;  CX.MAX_H = 24;

/* Tile IDs */
CX.T = Object.freeze({
  EMPTY: 0, GRASS: 1, STONE: 2, BRICK: 3, WOOD: 4, METAL: 5,
  SPIKE: 6, COIN: 7, SPAWN: 8, GOAL: 9,
});

/* Metadata, indexed by tile id */
CX.TINFO = [
  { name: 'Empty',  solid: false },
  { name: 'Grass',  solid: true },
  { name: 'Stone',  solid: true },
  { name: 'Brick',  solid: true },
  { name: 'Wood',   solid: true },
  { name: 'Metal',  solid: true },
  { name: 'Spikes', solid: false, hazard: true },
  { name: 'Coin',   solid: false, coin: true },
  { name: 'Spawn',  solid: false, spawn: true },
  { name: 'Goal',   solid: false, goal: true },
];

/* Palette order (matches number keys 1–9) */
CX.SWATCHES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ── tiny helpers ── */
CX.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
CX.approach = (v, target, amt) => v < target ? Math.min(v + amt, target) : Math.max(v - amt, target);
CX.uid = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
CX.key = (x, y, w) => y * w + x;
CX.formatTime = (t) => {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t % 1) * 10);
  return m + ':' + String(s).padStart(2, '0') + '.' + d;
};

/* ── sound effects (WebAudio, lazily created on first gesture) ── */
CX.sfx = (() => {
  let ac = null;
  const ensure = () => {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { /* no audio, no problem */ }
  };
  const tone = (f0, f1, dur, type, vol) => {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(1, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  };
  return {
    ensure,
    jump()  { tone(300, 560, 0.12, 'square', 0.04); },
    coin()  { tone(880, 1400, 0.09, 'sine', 0.05); setTimeout(() => tone(1320, 1760, 0.08, 'sine', 0.04), 55); },
    stomp() { tone(220, 90, 0.16, 'square', 0.06); },
    die()   { tone(320, 55, 0.42, 'sawtooth', 0.06); },
    win()   { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f, 0.13, 'triangle', 0.05), i * 95)); },
    click() { tone(620, 720, 0.05, 'triangle', 0.03); },
  };
})();
