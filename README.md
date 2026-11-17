# School Rush

A browser-based Three.js school game. 

## Run locally

Requires Node.js 22.12 or newer, npm, and a desktop browser with WebGL and Pointer Lock support.

```sh
npm install
npm run dev
```

Open the URL (normally `http://127.0.0.1:5173`).

Choose a destination and a time limit (30, 45, 60, 90, or 120 seconds), then click **Start challenge**.

| Control | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Space | Jump, or stand up when seated |
| E / left click | Open, collect, sit, write, turn on/off light |
| Escape | Pause and release the mouse |
| Tab | School settings |
| B | Toggle collision bounds |
| R | Reset a timed run to its ready screen; return to the entrance in exploration |

## Build and validate

```sh
npm test
npm run build
npm run preview
```

## Project layout

| Directory | Responsibility |
| --- | --- |
| `src/core`, `src/camera` | Browser lifecycle, input, fixed-step loop, camera |
| `src/physics` | Feet-based AABB character controller |
| `src/gameplay` | Countdown, key progression, run state/arrival rules, moving obstacles |
| `src/world`, `src/config` | Four-corridor square school layout, classroom builders, placement and settings |
| `src/assets`, `public/models` | Shared GLB templates and reused assets |
| `src/objects`, `src/interaction` | Object behavior, light circuits/switches, animation, picking, target outline and interaction modes |
| `src/ui`, `src/debug` | DOM interface and collision helpers |
| `tests`, `scripts` | Algorithm tests, browser QA, asset conversion |


Files inside `src/config/` define the school/classroom layout.
