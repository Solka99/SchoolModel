# Phase 3: environmental interactions

Phase 3 completes the existing school environment's interaction loop. The original door, chair, desk, and blackboard implementations are retained and improved; four independent lighting circuits and switches are added. The school layout and five reused GLB assets remain unchanged. No dependencies, backend, gameplay timer, obstacles, or win/lose system were added.

## Delivered behavior

| Interaction | Result |
| --- | --- |
| Doors | Handle/open/close animation, busy prompt while moving, obstruction feedback, reversal when blocked |
| Desks | Folding writing surface, matching bounds, busy/obstruction feedback, forgiving selection even when open |
| Chairs | Forgiving aiming through thin geometry; seated mouse look; Space restores a clear standing position without jumping |
| Blackboards | Independent text, named focused editor, 200-character limit, Delete clears, Shift+Enter adds a line, Enter/Escape finishes |
| Lights | One switch per classroom plus a corridor switch, each controlling its own sources and ceiling fixtures, with rocker/indicator feedback |
| Targeting | Gold bounds outline, object/room name, context action, hints and availability; two-unit range and occlusion remain enforced |

Classroom switches are on the interior wall next to each door, at height 1.35. The corridor switch is on the right wall near the entrance benches. All circuits start on. Pausing and respawning preserve environmental state; rebuilding/resetting the school restores lights to on, clears notes, and invalidates old interaction references.

## Implementation

- `LightCircuit.js` owns actual Three.js point sources and references its own fixture materials. Toggling sets source intensity and fixture emission; it keeps the source count constant to avoid recompiling shaders for each switch press.
- `LightSwitch.js` provides a small procedural plate, rocker and status indicator, contextual action, and completion feedback. It has no movement collider, so it cannot obstruct doorways.
- `Classroom` and `Corridor` generate their circuits and switches from the current dimensions. The default school has ten point sources across four circuits. Low common ambient/fill illumination keeps navigation possible with a circuit off.
- `TargetHighlight.js` owns one reusable outline outside the rebuildable school. It follows moving geometry, disappears when aiming away, pausing, sitting, or editing, and is excluded from picking.
- `InteractionSystem` checks current aim, range, occlusion and action availability again at activation. It compares furniture pick boxes against real mesh hits, so a forgiving chair/desk target cannot override a closer wall. Seated and editing modes exclude other actions.
- Door/desk state exposes availability, movement and obstruction. Blocked panels retain solid bounds and allow reversal; normal animation ignores repeated activation until it finishes.
- Blackboard editor cleanup is synchronous and guards against queued dialog-close events affecting another editing session. Rebuild/respawn also close the editor safely. Gameplay key presses cannot remain held after editing.

All circuit placement and pick bounds follow translated classrooms. Shared model materials are not mutated for selection or lighting, so activating one room's controls does not alter another room's furniture state.

## Validation

Validation uses Node.js 22.12.0, Three.js 0.180.0, Vite 7.3.7, and local Chrome software WebGL.

- **40 unit tests pass**, retaining Phase 1/2 coverage. Added checks cover circuit/fixture independence, translated light/switch positions, forgiving picking with occlusion, stale-target/range/busy rejection, seated-mode isolation, safe standing fallback/view restoration, and outline movement/cleanup. Animation tests also check busy and blocked prompt state.
- The browser smoke route visits every room continuously from the entrance, climbs its tiers, and activates doors, switches, chairs, desks, and blackboards through actual scene raycasts. It also exercises the narrower rebuilt school configuration.
- The browser verifies source intensity/fixture state and that another circuit's state remains unchanged when a room is switched off. A small diagnostic render of the same classroom camera view verifies that its rendered brightness falls substantially.

| Room | Lights on, mean RGB | Lights off, mean RGB |
| --- | --- | --- |
| 101 | 70.3 | 21.6 |
| 102 | 62.4 | 13.6 |
| 103 | 63.5 | 14.8 |

These values are diagnostic image averages in arbitrary units, not physical luminance measurements. The default school has 794 registered objects and 1,036 collision records. Switches and light rigs do not add movement collisions.

- Real browser keyboard checks exercise native textarea input/length limiting, Delete, Shift+Enter, typing the R key without respawning, and Enter/Escape cleanup. Rebuilding with an active editor clears its references and restores circuit defaults.
- Five repeated school rebuilds with debug helpers toggled keep geometry/texture counts stable when rendering the same view. Switch toggling does not allocate new model assets or outline geometry.
- Production build and Chrome startup/rendering smoke checks pass, including local assets and responsive overlays. Screenshots are generated in ignored `.qa/`, including lights-on/off and the switch target prompt/outline.

Run `npm test`, `npm run build`, and the browser smoke command in `README.md` to reproduce validation. Behavioral integration checks run against development; production does not expose the development game handle.

## Limits

Point lights use finite ranges and no shadow maps. Common ambient illumination and light spill can remain when a circuit is off; this is a simple interactive lighting model, not a fully occluded lighting simulation. Signs remain unlit materials for readability; board text now uses a lit material. Browser measurements use software WebGL and do not establish hardware performance. Other desktop browsers still need direct testing, and touch movement remains outside scope.

Vite retains its bundle-size advisory (approximately 614 KB minified JavaScript, 160 KB gzip); the build succeeds. Further lighting/material/performance polish remains Phase 5. Phase 4 is the next gameplay milestone.
