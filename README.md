# CORe_X — Game Builder

A tiny **level editor + playable platformer** in the browser. Draw your own tile
levels with a mouse, then hit **Play** to run and jump through them — all in one
page, no build step, no dependencies.

![CORe_X](https://img.shields.io/badge/vanilla-JS-ffc94d)

## What you get

- **Tile editor** — paint, erase, flood-fill, and an eyedropper across a grid.
- **Play mode** — step straight into your level as the runner; stomp enemies,
  grab coins, dodge spikes, reach the goal flag.
- **Undo / Redo** — every edit is reversible (80 steps).
- **Multiple levels** — create, duplicate, rename, delete, and switch between
  levels from the top bar.
- **Save / Load** — autosaves to `localStorage` as you edit.
- **Export / Import** — copy a level as JSON to share or back up, and load it
  back any time.
- **Three sample levels** — *First Steps*, *Spike Cavern*, and the vertical
  *Sky Tower* zig-zag climb, to play out of the box and learn from.

## Run it

It's a static site — no install, no bundler.

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works (`npx serve`, VS Code Live Server, GitHub Pages, …).

## Controls

| Input | Action |
| ----- | ------ |
| Left-drag | Paint with the current tile / brush |
| Right-drag | Erase |
| Alt + click | Eyedropper (pick tile under cursor) |
| `B` / `F` / `E` / `N` | Brush, Flood-fill, Eraser, eNemy tools |
| `1`–`9` | Select tile type |
| `-` / `=` | Decrease / increase brush size |
| `Enter` | Play, or advance to the next level when finished |
| `Esc` | Stop playing / back to editor |
| `R` | Restart current level |
| `Ctrl+Z` / `Shift+Z` or `Ctrl+Y` | Undo / Redo |

In play mode: **Arrow keys** (or `A`/`D`) to move, **Space / W / Up** to jump
(hold for a higher jump), stomp enemies from above.

## Project layout

```
index.html        app shell (top bar, side panels, canvas)
css/styles.css    dark theme, layout grid
js/core.js        shared constants, tile defs, helpers, WebAudio sfx
js/levels.js      level schema + 3 sample levels
js/state.js       app state, undo/redo, localStorage persistence
js/engine.js      platformer physics, enemies, coins, goal, camera
js/render.js      procedural tile art + editor/game drawing
js/editor.js      mouse tools: stamp, erase, fill, eyedropper, enemies
js/main.js        UI wiring, level CRUD, export/import, main loop
```

## Physics at a glance

Tuned for tight, responsive platforming (see `PHYS` in `js/engine.js`):

- Move speed **8 tiles/s**, gravity **40**, jump impulse **−16** (~3.2 tiles high).
- Coyote time **0.10s** and jump buffering **0.12s** for forgiving inputs.
- Variable jump height (release early to cut the jump).
- Enemies turn around at ledges and walls; stomp them to bounce.

## License

MIT — do whatever you like with it.
