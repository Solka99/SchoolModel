# School Rush

A browser-based Three.js migration of the original `pg3d` university lecture hall, expanded into a modular school. Phase 3 is implemented: explore one ground floor with three classrooms, open doors and desks, sit on chairs, edit blackboards, and switch classroom/corridor lights on and off. Named action prompts, target outlines, and animation/obstruction feedback guide interactions.

## Run locally

Requires Node.js 22.12 or newer, npm, and a desktop browser with WebGL and Pointer Lock support.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Click **Enter the school** to capture the mouse. You start inside the main entrance, facing down the corridor. Follow the signs to Rooms **101 Mathematics**, **102 Science**, and **103 Literature**. Doors start closed; look at a nearby door and press E to open it. Escape pauses and releases the mouse; click the button to resume. Exploration requires a desktop keyboard and mouse.

| Control | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Space | Jump, or stand up when seated |
| E / left click | Open, sit, write, or toggle lights on a visible target within two units |
| Escape | Pause and release the mouse |
| Tab | School settings |
| B | Toggle collision bounds |
| R | Return to the school entrance |

Look for the outline and named action prompt. Each classroom's switch is inside, next to its door; the corridor switch is near the entrance benches. The four circuits control their own light sources and ceiling fixtures, with a visible rocker and indicator on each switch. Lights start on and retain their state when you pause or respawn. A little ambient light and readable signs remain when lights are off.

Doors press their handles before opening. Student writing surfaces fold independently. Wait while a door or desk moves; its prompt reports progress. If the player blocks a panel, it waits and the prompt offers reversing the action. Chairs and desks have forgiving selection volumes, while walls and closer furniture still block interaction rays. While seated you can look around; Space stands up without triggering a jump. Other interactions are disabled until you stand.

Each classroom has its own board text and furniture state. The focused board editor isolates gameplay input: Backspace deletes, Delete clears, Shift+Enter adds a line, and Enter or Escape finishes. Text is limited to 200 characters. Click the start/resume button to return to exploration after closing an editor or settings dialog. School settings rebuild every room and the corridor from the new dimensions, reset lights to on, clear board text, and return you to the entrance.

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

The script uses Chrome's DevTools protocol with no extra test dependency. It defaults to the Windows Chrome install location; set `CHROME_PATH` to use another executable. It checks loaded models, actual Pointer Lock/keyboard movement, and a continuous physical route through all rooms. It activates room interactions through raycasting, measures rendered brightness with lights on/off, checks circuit independence, exercises the board editor with actual keyboard events, and verifies rebuilding/resource counts. Screenshots and temporary profiles go into ignored `.qa/`. To check the production preview, pass its URL: `node scripts/browser-smoke.mjs http://127.0.0.1:4173/`. Production intentionally exposes no game debugging object, so that run checks loading/rendering/requests and responsive overlays; full behavior checks run against development.

## Project layout

| Directory | Responsibility |
| --- | --- |
| `src/core`, `src/camera` | Browser lifecycle, input, fixed-step loop, camera |
| `src/physics` | Feet-based AABB character controller |
| `src/world`, `src/config` | Modular school/corridor/classroom builders, X/Z stacks, placement and settings |
| `src/assets`, `public/models` | Shared GLB templates and reused assets |
| `src/objects`, `src/interaction` | Object behavior, light circuits/switches, animation, picking, target outline and interaction modes |
| `src/ui`, `src/debug` | DOM interface and collision helpers |
| `tests`, `scripts` | Algorithm tests, browser QA, asset conversion |

The simulation runs at 120 Hz, independently of rendering. Each default classroom preserves the reference's 14.7 × 13.45 footprint, seven 0.2-high tiers, 105 student desks, and 106 chairs: **315 student desks and 318 chairs** across the school. Phase 2 uses a four-unit ceiling height, a 4.4-wide corridor, and procedurally placed room numbers, directory signs, entrance benches, and ceiling strips. The standalone classroom builder retains the original Phase 1 defaults, including its ten-unit ceiling.

`src/config/school.js` defines room numbers, subjects, sides, and corridor rows. `School` derives room origins from their current dimensions, `Classroom` generates each room, and `Corridor` fills only wall segments not already provided by the adjoining classrooms. Doorways share their coordinates with the room shells. There are no teleports or loading boundaries between rooms. All three rooms reuse the same five cached model assets.

Static colliders, pick bounds, sitting anchors, and local light rigs move with each classroom; animated panels refresh world-space bounds. Rebuilding disposes the previous school's unique resources while retaining the shared model cache, low ambient lighting, and one reusable target outline. School settings preserve a minimum 3.2 ceiling height for signs and door headroom, raising it further when seating tiers require it. Room/corridor lights use bounded point sources without shadow maps; their intensities and fixture emission change without adding/removing sources during a toggle.

The original C++ repository is preserved and referenced at [rubikon02/pg3d, commit 4b0bea1](https://github.com/rubikon02/pg3d/tree/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775). This repository contains the JavaScript migration, not a replacement native build.

See [Phase 3 implementation and validation](docs/phase-3-validation.md), [Phase 2 validation](docs/phase-2-validation.md), [original migration plan](docs/phase-1-migration-plan.md), [asset provenance and conversion](docs/assets.md), and [historical Phase 1 validation](docs/phase-1-validation.md). The timer, obstacles, objectives, and win/lose gameplay remain Phase 4.
