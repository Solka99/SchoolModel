# Phase 1 validation

Validated on 2026-11-05 with Node.js 22.12.0, Three.js 0.180.0, Vite 7.3.7, and local Chrome using its software WebGL renderer. The native C++ application was inspected as source; it was not executed for a side-by-side visual comparison.

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | 27 passing tests, no failures |
| `npm run build` | Successful static production build |
| `node scripts/browser-smoke.mjs` against Vite | Passed: actual Pointer Lock, keyboard movement, WebGL rendering, assets, real-hall simulation, interactions, and rebuild checks |
| Same smoke script against production preview | Passed: startup, rendering, local asset requests, responsive overlay, and no JavaScript exceptions |
| Default room metrics | 14.7 × 13.45 × 10; seven tiers; 105 student desks and 106 chairs |
| Full browser scene | 246 behavior objects and 339 collider records, including procedural trim |
| Five successive room rebuilds with collision helpers toggled | GPU resource counts stayed at seven geometries and two textures after rendering the same view |
| Dependency audit after compatible Vite update | Zero reported vulnerabilities |

Unit tests cover strict collision contact, degenerate and transformed boxes, diagonal movement normalization, jumps and airborne jump rejection, landing and head collisions, wall sliding, flagged stairs and headroom, walking off platforms, reset state, and equal fixed-step travel at 30/60/120 rendering FPS. Layout tests check source metrics, counts, spacings, all tier heights, last-tier extension, parameter clearance, and stack axes. Picking tests verify occlusion, distance, and descendant ownership.

Tests also parse the actual converted model files: panel dimensions/centers in both door orientations, handle sequencing/debounce, open-panel solidity, obstruction during closing, and desk support/pivot bounds. Asset tests verify GLB headers, embedded resources, bounds metadata, and the original chair checksum.

The browser test acquires Pointer Lock through an actual mouse click and moves the player through a keyboard event. Its additional behavior checks use the development-only game handle to drive the real hall: climb both central aisles across all seven tiers, target/open a door and walk onto the landing, close it, sit and stand, open/close a desk, update the board through its editor, change room size and door side, and reset. This is automated integration coverage, not a complete manual playthrough of every seat.

Screenshots of the welcome screen, classroom, rear view, settings, and narrow-screen overlay were generated in ignored `.qa/`. Desktop screenshots were inspected for furniture orientation, board/door placement, seating layout, and interface readability. Screenshots can be regenerated using the smoke script.

## Deliberate differences from the native implementation

- Three.js renders the original geometry with standard materials and main/fill/ambient lighting. Color/illumination are approximations, not pixel-exact fixed-function OpenGL output. Simple trim and ceiling light strips improve readability without changing the room shell.
- The camera keeps the original yaw convention, projection, eye height, and mouse sensitivity. Mouse movement uses Pointer Lock. Escape pauses instead of exiting the process.
- Simulation uses a 120 Hz fixed step. Automatic stairs move the collision body onto the valid surface immediately and ease the camera height, avoiding penetration during a physical interpolation.
- Door panels remain solid while open, and closing stops when the player obstructs the next pose. Interactive rays include wall/furniture occluders.
- The GLB chair's actual Y-up bounds determine its grounding and seat anchor. The native model-axis-dependent placement/sitting calculation is not reproduced.
- The teacher chair retains its original default location, but moves forward when a smaller front margin would put it through the front wall.
- Desk writing-surface bounds follow the animation. Solid chairs and furniture use manageable AABBs rather than detailed physics.
- Blackboard text uses a canvas texture and focused DOM editor. Movement is paused during editing; no gameplay key doubles as text input. Enter finishes; Delete clears; Backspace behaves as normal text editing.
- Room controls use DOM inputs, safe ceiling clearance, and an explicit rebuild. The front margin starts at 1.5 rather than the native 0.5 minimum so the teaching area stays usable. Regeneration invalidates interaction references and keeps shared assets cached.
- Falling off the original exterior landing returns the player to the spawn point.

## Remaining verification limits

- Hardware-accelerated performance and extended manual play on the user's machine are not benchmarked. Browser tests used software WebGL, so their rendering speed is not a GPU performance measure.
- Chrome was exercised; Firefox, Safari, and Edge still need direct compatibility checks. This phase requires a desktop keyboard and mouse; touch movement is not implemented.
- The native executable was not run. Exact visual parity and the original asset authorship/license remain unverified; see `assets.md` for provenance.
- Production was tested at the preview server root. Relative entry, favicon, and model URLs support subdirectory deployment by construction, but a separate subdirectory host was not exercised.
- Vite reports a bundle-size advisory for the approximately 601 KB minified Three.js application chunk (about 155 KB gzip). The build succeeds. Further loading/performance optimization belongs to Phase 5.

Later school expansion and School Rush timer/objective gameplay are intentionally outside Phase 1.
