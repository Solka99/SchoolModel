# School Rush

A browser-based Three.js migration of the original `pg3d` university lecture hall. Phase 1 is implemented: one procedural classroom, first-person movement, gravity/jumping, collisions, tiered seating, animated doors and folding desks, chair sitting, and an editable blackboard.

## Run locally

Requires Node.js 22.12 or newer, npm, and a desktop browser with WebGL and Pointer Lock support.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Click **Enter the classroom** to capture the mouse. Escape pauses and releases it; click the button to resume. Keyboard and mouse are required for exploration; touch controls are outside Phase 1.

| Control | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Space | Jump, or stand up when seated |
| E / left click | Interact with the visible object within two units |
| Escape | Pause and release the mouse |
| Tab | Room settings |
| B | Toggle collision bounds |
| R | Return to the front of the room |

Doors press their handles before opening. Student writing surfaces fold independently. While editing the board, typing stays in the editor: Backspace deletes, Delete clears, and Enter finishes. Click to resume exploration after closing an editor or settings dialog.

## Build and validate

```sh
npm test
npm run build
npm run preview
```

The static output is `dist/`. Relative asset URLs allow hosting beneath a subdirectory. Serve it over HTTP(S), rather than opening `index.html` as a local file. The runtime uses only Three.js and local assets; it has no backend or external font/CDN requests.

Optional Chrome smoke checks, after starting the dev server:

```sh
node scripts/browser-smoke.mjs
```

The script uses Chrome's DevTools protocol with no extra test dependency. It defaults to the Windows Chrome install location; set `CHROME_PATH` to use another executable. It checks loaded models, actual Pointer Lock and keyboard movement, real-hall stair/door traversal, interactions, regeneration, and GPU resource counts. Screenshots and temporary profiles go into ignored `.qa/`. To check the production preview, pass its URL: `node scripts/browser-smoke.mjs http://127.0.0.1:4173/`. Production intentionally exposes no game debugging object, so that run checks loading/rendering/requests and responsive overlays; full behavior checks run against development.

## Project layout

| Directory | Responsibility |
| --- | --- |
| `src/core`, `src/camera` | Browser lifecycle, input, fixed-step loop, camera |
| `src/physics` | Feet-based AABB character controller |
| `src/world`, `src/config` | Procedural hall, X/Z layout stacks, room settings |
| `src/assets`, `public/models` | Shared GLB templates and reused assets |
| `src/objects`, `src/interaction` | Object behavior, animation, picking and interaction modes |
| `src/ui`, `src/debug` | DOM interface and collision helpers |
| `tests`, `scripts` | Algorithm tests, browser QA, asset conversion |

The simulation runs at 120 Hz, independently of rendering. The default room preserves the reference's 14.7 × 13.45 × 10 dimensions, seven 0.2-high tiers, 105 student desks, and 106 chairs. Static colliders are cached; animated panels update their own bounds. Rebuilding disposes room-owned resources while retaining shared model geometry and textures.

The original C++ repository is preserved and referenced at [rubikon02/pg3d, commit 4b0bea1](https://github.com/rubikon02/pg3d/tree/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775). This repository contains the JavaScript migration, not a replacement native build.

See [migration plan](docs/phase-1-migration-plan.md), [asset provenance and conversion](docs/assets.md), and [validation results and limitations](docs/phase-1-validation.md). Further classrooms, corridors, timers, obstacles, and win/lose gameplay remain later phases.
