# School Rush

A browser-based Three.js school game, migrated from the original `pg3d` university lecture hall. Phase 4 is implemented: race from the entrance to your designated classroom before a 45-second countdown expires. Explore four corridors connected in a square, find classroom keys, unlock the route, avoid moving carts, and reach class. Obstacle-free exploration retains all classroom interactions from Phases 1–3.

## Run locally

Requires Node.js 22.12 or newer, npm, and a desktop browser with WebGL and Pointer Lock support.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Choose a destination, then click **Start a 45-second rush** to capture the mouse and begin the countdown. The school has sixteen classrooms—**101–116**, with Mathematics, Science, Literature, and History subjects—four along the outside of each side of the square corridor loop. The north entrance facade is marked by an exterior sign and canopy, with the wall beneath it sealed. You start near this facade. The key location is shown in the HUD; each key appears in a classroom in the currently reachable corridor leading to the next barrier. Press E to collect one and raise that barrier. Each raised barrier leads to the next corridor, where its key can be found. Open the target classroom door and get fully inside before time expires. Entering another classroom does not end the run.

The HUD shows remaining time, destination, and the key/door progress. Escape releases the mouse and pauses both the clock and obstacles. **Resume run** continues the same run. **Try again** after a win/loss starts fresh; **R** resets a run to its ready screen, where you click **Start run** to capture the mouse again. A failed mouse-capture request never starts the clock. Exploration requires a desktop keyboard and mouse.

**Explore the school** starts without a timer or obstacles. During a run, **Leave run & explore** abandons the challenge and returns to this mode. School dimensions can be changed in exploration; settings are locked while a timed run is ready, active, paused, or finished. Starting/restarting rebuilds the school using its current dimensions, resets doors, board text, lights, obstacle phases, timer, and penalties.

| Obstacle | Behavior | How to pass |
| --- | --- | --- |
| Stacked furniture | Blocks part of the entrance corridor | Use the clear lane or jump over |
| Moving cleaning carts | Three shuttles move side-to-side in a line in each corridor; they stop rather than push through the player | Wait or go around; contact costs 2 seconds, with a 2.5-second cooldown |
| Keyed corridor barriers | A vertical barrier separates each connected corridor; a key raises only the next barrier on the selected route | Find the key in an accessible classroom, then use E on the barrier |

Falling off the entrance landing returns you to the entrance and costs 3 seconds during a run. Obstacles and barriers use simple conservative AABBs rather than a physics engine. Corner connectors fill the outer quadrants of each corridor turn with continuous floor and ceiling and sealed outer walls. Key placement is random among classrooms in the current corridor, so a key never spawns beyond a closed barrier. There is no timed passage.

| Control | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Space | Jump, or stand up when seated |
| E / left click | Open, collect, sit, write, or toggle lights on a visible target within two units |
| Escape | Pause and release the mouse |
| Tab | School settings |
| B | Toggle collision bounds |
| R | Reset a timed run to its ready screen; return to the entrance in exploration |

Look for the outline and named action prompt. Each classroom's switch is inside, next to its door; each corridor has a switch. The eight circuits control their own light sources and ceiling fixtures, with a visible rocker and indicator on each switch. Lights start on and retain their state when you pause or respawn. A little ambient light and readable signs remain when lights are off.

Doors press their handles before opening. Student writing surfaces fold independently. Wait while a door or desk moves; its prompt reports progress. If the player blocks a panel, it waits and the prompt offers reversing the action. Chairs and desks have forgiving selection volumes, while walls and closer furniture still block interaction rays. While seated you can look around; Space stands up without triggering a jump. Other interactions are disabled until you stand.

Each classroom has its own board text and furniture state. The focused board editor isolates gameplay input: Backspace deletes, Delete clears, Shift+Enter adds a line, and Enter or Escape finishes. Text is limited to 200 characters. Click the start/resume button to return to exploration after closing an editor or settings dialog. School settings rebuild all sixteen rooms and four corridors from the new dimensions, reset lights to on, clear board text, and return you to the entrance.

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

To run only the Phase 4 gameplay checks after the full school regression has passed, use `node scripts/browser-smoke.mjs http://127.0.0.1:5173/ --rush-only`.

The script uses Chrome's DevTools protocol with no extra test dependency. It defaults to the Windows Chrome install location; set `CHROME_PATH` to use another executable. It retains school/interactions checks, then runs `scripts/check-rush.mjs`: actual start/pause/resume/restart controls, clock behavior, key placement/accessibility, gate unlocking, contact penalties, target-room selection, timeout, and restart resource cleanup. Screenshots and temporary profiles go into ignored `.qa/`. To check the production preview, pass its URL: `node scripts/browser-smoke.mjs http://127.0.0.1:4173/`. Production intentionally exposes no game debugging object, so that run checks loading/rendering/requests and responsive overlays; full behavior checks run against development.

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

The simulation runs at 120 Hz, independently of rendering. The challenge countdown uses full active elapsed time, independently of the clamped physics delta; low rendering rates cannot extend the time budget. Time and obstacle animation stop while paused, including during a board editor or help screen. Expiry takes priority over arrival at the exact deadline. Reaching the target requires the player's body to clear the doorway, rather than merely touching the room boundary.

Each default classroom preserves the reference's 14.7 × 13.45 footprint, seven 0.2-high tiers, 105 student desks, and 106 chairs: **1,680 student desks and 1,696 chairs** across the school. Phase 2 uses a four-unit ceiling height, 4.4-wide corridors, and procedurally placed room numbers, directory signs, entrance benches, and ceiling strips. The standalone classroom builder retains the original Phase 1 defaults, including its ten-unit ceiling.

`src/config/school.js` defines the sixteen room/corridor assignments and derives the square loop and room origins from the current classroom dimensions. Four classrooms line the outside of each corridor side, with clear corners where the corridors connect. The courtyard-facing walls remain closed at all four turns, and the north entrance facade is sealed. `Classroom` generates each room, and each `Corridor` fills only wall segments not provided by its adjoining classrooms. Keyed doors gate each corridor connection during a rush; a key is chosen only from rooms in the currently reachable sections. All classrooms reuse the same five cached model assets.

Static colliders, pick bounds, sitting anchors, and local light rigs move with each classroom; animated panels refresh world-space bounds. Rebuilding disposes the previous school's unique resources while retaining the shared model cache, low ambient lighting, and one reusable target outline. School settings preserve a minimum 3.2 ceiling height for signs and door headroom, raising it further when seating tiers require it. Room/corridor lights use bounded point sources without shadow maps; their intensities and fixture emission change without adding/removing sources during a toggle.

The original C++ repository is preserved and referenced at [rubikon02/pg3d, commit 4b0bea1](https://github.com/rubikon02/pg3d/tree/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775). This repository contains the JavaScript migration, not a replacement native build.

See [Phase 4 implementation and validation](docs/phase-4-validation.md), [Phase 3 validation](docs/phase-3-validation.md), [Phase 2 validation](docs/phase-2-validation.md), [original migration plan](docs/phase-1-migration-plan.md), [asset provenance and conversion](docs/assets.md), and [historical Phase 1 validation](docs/phase-1-validation.md). Visual/audio polish and further performance work remain Phase 5.
