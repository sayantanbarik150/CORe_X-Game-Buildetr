/* ── CORe X · level model, ASCII parsing, demo levels ── */
'use strict';

/* ASCII legend used by the demo maps and by text-based tools:
   .  empty          #  grass block     S  stone        B  brick
   W  wood           M  metal           ^  spikes       o  coin
   P  player spawn   G  goal flag      E  patrolling enemy            */
CX.LEGEND = { '.': 0, '#': 1, 'S': 2, 'B': 3, 'W': 4, 'M': 5, '^': 6, 'o': 7, 'P': 8, 'G': 9 };

CX.parseASCII = (name, rows) => {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const tiles = new Array(w * h).fill(0);
  const enemies = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === 'E') { enemies.push({ x, y }); continue; }
      const id = CX.LEGEND[ch];
      tiles[y * w + x] = (id !== undefined ? id : 0);
    }
  });
  return { id: CX.uid(), name, w, h, tiles, enemies };
};

CX.makeLevel = (name, w, h, template) => {
  w = CX.clamp(Math.round(w) || 20, CX.MIN_W, CX.MAX_W);
  h = CX.clamp(Math.round(h) || 12, CX.MIN_H, CX.MAX_H);
  const tiles = new Array(w * h).fill(0);
  if (template === 'field') {
    for (let y = h - 3; y < h; y++)
      for (let x = 0; x < w; x++)
        tiles[y * w + x] = CX.T.GRASS;
    tiles[(h - 4) * w + 2] = CX.T.SPAWN;
    tiles[(h - 4) * w + (w - 3)] = CX.T.GOAL;
  }
  return { id: CX.uid(), name, w, h, tiles, enemies: [] };
};

/* Validate/normalize any object into a level (import, localStorage). */
CX.sanitizeLevel = (o) => {
  if (!o || typeof o !== 'object') return null;
  const w = Math.round(o.w), h = Math.round(o.h);
  if (!(w >= 4 && h >= 4) || w > CX.MAX_W || h > CX.MAX_H) return null;
  const tiles = new Array(w * h).fill(0);
  const src = Array.isArray(o.tiles) ? o.tiles : [];
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(+src[i]);
    tiles[i] = (v >= 0 && v <= 9) ? v : 0;
  }
  const enemies = [];
  if (Array.isArray(o.enemies)) {
    for (const e of o.enemies) {
      if (!e) continue;
      const x = Math.round(e.x), y = Math.round(e.y);
      if (x >= 0 && x < w && y >= 0 && y < h) enemies.push({ x, y });
    }
  }
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 48) : 'Untitled';
  return { id: CX.uid(), name, w, h, tiles, enemies };
};

CX.cloneLevel = (lv) => JSON.parse(JSON.stringify(lv));

/* ── Demo levels ─────────────────────────────────────── */
CX.sampleLevels = () => [
  CX.parseASCII('1 · First Steps', [
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '........................oo....',
    '.......................####...',
    '....................WWW.......',
    '..................o...........',
    '.............WWWWW............',
    '..........o...................',
    '.........BBB..................',
    '.P...o.......o....E....o...G..',
    '##############################',
    '##############################',
    '##############################',
  ]),
  CX.parseASCII('2 · Spike Cavern', [
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'M................................M',
    'M................................M',
    'M................................M',
    'M................................M',
    'M................................M',
    'M................................M',
    'M................................M',
    'M................................M',
    'M...........oo......oo...........M',
    'M..........BBBB....BBBB..........M',
    'M....o......................o....M',
    'M...WWWW..................WWWW...M',
    'M.P.....^^^^.....^^^^...E......G.M',
    '##################################',
    '##################################',
    '##################################',
  ]),
  CX.parseASCII('3 · Sky Tower', [
    'SSSSSSSSSSSSSSSSSS',
    'S................S',
    'S................S',
    'S.........G......S',
    'S........SSS.....S',
    'S.........o......S',
    'S...WWW..........S',
    'S....o...........S',
    'S........WWW.....S',
    'S.........o......S',
    'S...WWW..........S',
    'S.........E......S',
    'S........WWW.....S',
    'S....o...........S',
    'S...WWW..........S',
    'S.........o......S',
    'S........WWW.....S',
    'S....o...........S',
    'S...WWW..........S',
    'S.........o......S',
    'S........WWW.....S',
    'S....o...........S',
    'S...WWW..........S',
    'S.P......o....o..S',
    '##################',
    '##################',
  ]),
];
