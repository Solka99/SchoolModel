# Phase 4: School Rush

Phase 4 adds a replayable timed challenge to the school while keeping obstacle-free exploration and the existing classroom interactions.

## School layout and route

The ground floor is a square loop of four connected corridor sections, each with a classroom on its outside wall:

| Corridor | Classroom |
| --- | --- |
| North | 101 Mathematics |
| East | 102 Science |
| South | 103 Literature |
| West | 104 History |

The entrance is on the inner side of the north corridor, several metres away from the West-to-North turn. This keeps its doorway, canopy, and landing out of the junction. Each of the four turns has a connector that fills the outer corner quadrant with continuous floor and ceiling and seals the exterior corner with two flush-joined walls. Side-wall openings connect each corridor to the next; wall segments stop at those openings and at the classroom end-wall faces rather than running through them. Each corridor connection has a keyed barrier that rises vertically when unlocked. The selected destination determines the forward route around the loop: 101 requires no barrier; 102, 103, and 104 require one, two, and three keys respectively. Classroom doors remain independently operable.

One key is placed randomly inside a classroom in the reachable corridor whose barrier is next on the selected route. The HUD names its classroom. Collect it with E, then use it to raise that barrier. Raising a barrier consumes the key and makes the next corridor reachable; its key is then placed in that corridor. A key never spawns beyond a closed barrier. Keys are reset with every new run.

Choose a destination and start a 45-second rush. The countdown begins only after Pointer Lock succeeds. The player starts near the entrance, and wins only after entering the selected classroom. A wrong classroom does not win. Expiry takes priority over arrival at the deadline. Escape, lost pointer lock, focus/visibility loss, help, and board editing pause the same run and stop obstacle movement.

R resets to a ready screen. Retry creates a fresh school challenge; leaving the run returns to obstacle-free exploration. School settings are unavailable during a challenge. Rebuilding resets classroom state, keys, corridor barriers, obstacles, timer, and penalties.

## Obstacles

| Type | Implementation | Consequence |
| --- | --- | --- |
| Stacked furniture | Procedural block near the entrance | Go around or jump over |
| Moving cleaning carts | Three carts move side-to-side in a line in each corridor (12 total), with staggered phases | Collision stops a cart and costs 2 seconds; a 2.5-second cooldown prevents repeated contact penalties |
| Keyed corridor barriers | Span each corridor connection and lift vertically after the route key is used | Block the passage until raised clear of the player |

The cart motion follows each corridor's orientation. A cart freezes its phase as well as its transform when obstructed, preventing a delayed teleport through the player. There is no timed passage or obstacle that drops on a timer. Falling from the exterior entrance landing returns the player to the entrance and costs 3 seconds during a run. Obstacles and barriers use conservative AABBs rather than a physics engine.

## Code map

- `src/config/school.js`: four corridor transforms, classroom assignments, dimensions, and world-space room placement.
- `src/world/School.js`, `src/world/Corridor.js`, and `src/world/CornerConnector.js`: square loop construction, sealed corner turns, rotated classrooms, corridor barriers, and key placement.
- `src/gameplay/GameManager.js`: rush states, target arrival, key inventory, reachable sections, and ordered barrier progression.
- `src/gameplay/Obstacles.js`: moving carts, entrance furniture, rising keyed barriers, classroom keys, collision boxes, and cleanup.
- `src/core/Game.js`: Pointer Lock lifecycle, key/barrier interaction, collision penalties, active time, and rebuild/reset behavior.
- `src/ui/HUD.js` and `index.html`: destination selection, countdown, key location, route progress, and instructions.
- `scripts/check-rush.mjs`: browser checks for run controls, key accessibility, barrier progression, cart penalties, target selection, timeout, and resource cleanup.

The simulation runs at 120 Hz with a bounded rendering-frame accumulator. The countdown uses full active elapsed time independently of the clamped physics delta, so low render rates do not grant extra time. Expiry takes priority over arrival at the deadline.

## Validation

Validated with Node.js 22.12.0, Three.js 0.180.0, Vite 7.3.7, and Chrome software WebGL.

- `npm test`: 51 tests pass, including corner floor coverage and walls, square corridor joins, room placement, target-room arrival, key consumption and gate order, vertical barrier movement/collision, moving-cart motion/contact/orientation, and narrow-corridor furniture clearance.
- `npm run build`: passes. Vite retains its advisory for the roughly 632 KB minified application chunk.
- `node scripts/browser-smoke.mjs`: passes Pointer Lock and keyboard movement, traverses all four classrooms in exploration, checks independent lights and board state, rebuilds the school, and runs the timed-mode browser checks.
- Timed-mode checks verify actual start/pause/resume/reset controls, key pickup and HUD progression, rejection of a keyless door, one key per required door, reachable-only key placement, all four destinations, wrong-room rejection, cart contact penalties, timeout, and stable resources after repeated rebuilds.
- The browser smoke runner also verifies the UI at a narrow viewport and checks for uncaught browser errors or failed application requests.

The browser route tests use deterministic game state manipulation for destination-arrival assertions; they verify the interaction and progression systems but are not manual run-time measurements.

## Scope and limits

The challenge remains desktop keyboard/mouse oriented. There are no NPCs, persistent scores, or saved progress. Cart and barrier movement are kinematic. Touch controls and browsers other than Chrome need direct validation.
