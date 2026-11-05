# School Rush: Phase 1 repository analysis and migration plan

## Baseline and scope

The current local repository is `Solka99/SchoolModel`, at commit `bc96969`, and contains only `README.md`. There is no local C++ application or browser implementation to migrate in place.

The reference inspected is [rubikon02/pg3d](https://github.com/rubikon02/pg3d/tree/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775), pinned to commit `4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775`. Inspection covered its source tree, application, camera, input, physics, scene/layout, model loader, object implementations, prefabs, parameters, and build configuration. This is a source analysis; neither the native application nor its binary assets were rendered or executed.

Build the browser application at this repository's root. Keep the native repository unchanged and reference its pinned source. If a native checkout is needed for visual comparison, keep it separate from the browser source. Do not copy CMake, vcpkg, IDE files, or OpenGL code into the runtime.

Phase 1 delivers one functioning lecture hall with the original layout, movement, stairs, furniture, assets, doors, and basic interactions. Include existing sitting, folding desks, and blackboard editing to satisfy the brief's parity goal; Phase 3 can later generalize and improve these across the school. Do not create `School.js`, `Corridor.js`, timers, objectives, obstacles, sprint, win/lose screens, or NPCs in this phase.

This document records the migration design. The Phase 1 implementation now follows it; see `README.md` for operation and `docs/phase-1-validation.md` for checks and deliberate differences.

## What the original actually does

### Application and scene

[`Application.cpp`](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/app/Application.cpp) owns FreeGLUT callbacks, input, camera, character, scene, interactions, sitting/editing state, and parameter regeneration. Updates use elapsed time clamped to 0.001–0.05 seconds, with a target of 120 FPS. Rendering uses fixed-function lighting, matrix stacks, immediate-mode geometry, and GLUT overlays. Projection is 75 degrees, near 0.1, far 200.

`Scene` is a flat list of owned `SceneObject`s. Objects expose bounds, solidity, interactability, automatic stepping, updates, and rendering. Retain the object behavior contract, but let Three.js own rendering and transforms. A small world registry is still useful for colliders and behavior updates; a second rendering engine is unnecessary.

### Procedural lecture hall

[`LectureHall.cpp`](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/scene/LectureHall.cpp) computes dimensions from seating parameters, then creates floor, ceiling, four walls, a side doorway, an exterior floor landing, blackboard, teacher desk/chair, student furniture, and raised seating steps. The wall with the door is split into front, back, and lintel boxes; collision must retain the opening.

Default values come from `LectureHall.h`, with four overridden by the same defaults in `ParameterManager`: three seating sections, five columns per section, seven rows, 0.5-wide slots, 1.05-deep slots, 0.1 column gaps, 1.5-wide aisles, and 0.2 rise per row. `rowDepth = max(seatRowGap, seatSlotDepth)`, hence 1.05 by default.

Derived reference values for verification:

| Quantity | Default result |
| --- | --- |
| Section width | `5 × 0.5 + 4 × 0.1 = 2.9` |
| Seating width | `3 × 2.9 + 2 × 1.5 = 11.7` |
| Seating depth | `7 × 1.05 = 7.35` |
| Room width / depth / height | `14.7 / 13.45 / 10` |
| Interior X limits | `-7.35` to `7.35` |
| Front / back Z | `-3` / `10.45` |
| Student chairs / student desks | `105 / 105` |
| Total chairs | `106`, including teacher chair |
| Seating tiers | `7`, with tops at `0.2 … 1.4` |
| Blackboard width / height / center | `5 / 1.3 / (0, 1.6, -2.97)` |
| Spawn feet | `(1.6, 0, -0.2)` |
| Default door center | `(-7.45, 1, -1.4)` |

Floor, wall, and ceiling thickness are 0.2. Door opening is 1 wide and 2 high. The last seating tier extends to the rear wall. The exterior landing has depth 6 and width 6.45; preserve it so the migrated doorway leads onto a floor without requiring a corridor.

`HStack` advances along X. Despite its name, `VStack` advances along Z, not Y. Tier elevation is supplied by the hall's row factory. Preserve these semantics in the port.

### Movement and collision

[`CharacterController.cpp`](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/physics/CharacterController.cpp) normalizes WASD intent, moves along X and then Z for wall sliding, and tests a feet-based player AABB against solid objects. It applies gravity and resolves landings or upward head collisions. Automatic stepping is limited to explicitly marked objects and interpolates elevation using smoothstep.

Preserve these initial tuning values: speed 4.5 units/s, gravity -20 units/s², jump speed 7.5 units/s, player half-width 0.2, player height 1.8, eye height 1.62, maximum automatic step 0.8. Furniture must not become automatically climbable just because it is short.

Camera yaw starts at 90 degrees, looking along +Z; pitch is clamped to ±89 degrees, sensitivity is 0.12 degrees per mouse pixel. The original forward vector is `(cos(yaw) cos(pitch), sin(pitch), sin(yaw) cos(pitch))`. Keep that convention and orient the Three.js camera using its direction, since a Three.js camera's local forward is -Z.

`Aabb.h` uses strict overlap comparisons: touching faces do not count as penetration. Preserve that behavior using `Box3` as storage plus an explicit strict-overlap helper. Blindly substituting a box intersection method can change grounding and stair behavior.

### Interactions and animation

The original uses a two-unit eye ray against object AABBs, filtered to interactables, then dispatches on type. Left click activates the target. The prompt comes from the object. Preserve range and behavior; use E as the primary browser control and optionally retain left click after pointer lock is acquired.

| Object | Observed source behavior | Phase 1 treatment |
| --- | --- | --- |
| Door | Handle press to -25 degrees, then panel opens to 95 degrees; handle 300 degrees/s, panel 220 degrees/s; pending-open debounce | Preserve the sequence, hinge, orientation, and outward swing. Closing skips the handle press but still animates the panel. |
| Student desk | Separate stand and hinged writing surface, toggles 0–90 degrees at 300 degrees/s | Preserve both model parts and folding interaction. |
| Chair | Calculates sitting position/yaw; application stores previous feet/yaw/pitch; Space stands up, normally restoring previous position | Preserve the state transition, with an explicit seat anchor and valid stand position. |
| Blackboard | Framed procedural board, text limited to 200 characters; typing, Backspace, Delete, Enter | Preserve text/edit state; replace GLUT stroke text with a canvas texture and a browser text editor. |
| Teacher desk | Procedural box marked interactable, but no useful overridden interaction | Keep as solid furniture; omit a misleading action prompt. |

Sources: [door implementation](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/scene/objects/Door.cpp), [student desk](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/scene/objects/StudentDesk.cpp), [chair](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/scene/objects/Chair.cpp), [blackboard](https://github.com/rubikon02/pg3d/blob/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/scene/objects/Blackboard.cpp).

## Reuse and rewrite decisions

| Native component | Decision |
| --- | --- |
| `LectureHall`, `Layout`, room/furniture prefab dimensions | Port formulas, loops, spacing, factory composition, and spawn almost directly. Replace allocation and render calls with JS factories and groups. |
| `CharacterController` | Port movement, jump/gravity, axis separation, and marked-step algorithm; harden state reset, timestep handling, and grounding. No physics dependency. |
| Door/desk animation and blackboard text state | Port state and rates, express animation through pivot groups, keep DOM work outside object logic. |
| `InputState`, key bindings, parameter descriptors | Preserve action/consume semantics and bounded configuration; replace callbacks with browser events. |
| `FirstPersonCamera` | Preserve direction math and tuning; replace `gluLookAt` and cursor warping with `PerspectiveCamera` and Pointer Lock. |
| `Scene` / `SceneObject` | Adapt into a small behavior registry and object wrapper around `Object3D`; remove per-object `render()`. |
| `ModelMesh` / `ModelObject` | Rewrite loading and rendering using Three.js loaders, asset caching, materials, groups, and world bounds. Retain reuse/caching intent. |
| `Raycast` | Replace custom slab traversal with `Raycaster`; preserve range/nearest-target semantics and object ownership. |
| `Box`, `Light`, colors, overlays | Rewrite with `BoxGeometry`, Three.js lights/materials, DOM/CSS, and debug helpers. Use main/fill lighting plus ambient illumination as a visual approximation. |
| `Vec3`, `Mat3`, `Vec4`, angle helpers | Use Three.js math; retain only collision-specific helpers. |
| FreeGLUT, OpenGL state, Assimp/STB texture plumbing, CMake/vcpkg | No browser runtime port. Vite and Three.js replace these responsibilities. |

### Assets

The [reference model directory](https://github.com/rubikon02/pg3d/tree/4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775/src/models) contains six assets, about 416 KB combined:

| Source file | Proposed destination | Use |
| --- | --- | --- |
| `src/models/chair.glb` | `public/models/chair.glb` | Active chair asset; reuse GLB materials, textures, and hierarchy. |
| `src/models/chair.stl` | Keep in reference only | Alternative chair mesh, not used by the current hall builder. |
| `src/models/door.stl` | Convert to `public/models/door.glb` | Door panel; preserve its hinge-relative origin. |
| `src/models/door_handle.stl` | Convert to `public/models/door_handle.glb` | Handle reused on both sides; preserve source origin. |
| `src/models/student_desk_stand.stl` | Convert to `public/models/student_desk_stand.glb` | Fixed desk support. |
| `src/models/student_desk_desk.stl` | Convert to `public/models/student_desk_desk.glb` | Moving writing surface. |

Recommended final runtime format is GLB throughout, as requested. Convert the four active STL assets once, without centering, scaling, or baking away their pivot coordinates. Record source names, transforms, material choices, and conversion procedure in `docs/assets.md`. A conversion-only `scripts/convert-models.mjs` can use Three.js `STLLoader` and `GLTFExporter` with the required Node export support, or document a reproducible Blender procedure if that is simpler in the implementation environment. Choose one workflow before adding tooling; an in-browser STL conversion system is unnecessary.

For the first asset smoke test, loading original STL files with `STLLoader` is an acceptable temporary step. Remove that runtime branch once GLB conversion is verified. Both loaders are Three.js addons, not additional npm dependencies: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [STLLoader](https://threejs.org/docs/pages/STLLoader.html).

Do not assume the native model normalization is correct for `GLTFLoader`: `ModelMesh.cpp` reads mesh vertices without traversing Assimp node transforms, whereas the browser loader retains the scene graph. `ModelPrefabs.h` also sizes a chair using source X/Y and lifts it using source Z. Inspect the loaded GLB hierarchy and bounds before applying any axis correction. Keep corrections on a wrapper group, normalize once using world Y as height, and never flatten or recenter door/desk parts independently. For the STL-origin desk, preserve the writing-surface pivot offset `(0, 0.035, 0.69)` in source coordinates before the outer model rotation. The outer desk correction is `(-90, 180, 0)` degrees.

Asset contents, embedded resources, exact appearance, and any attribution requirements still need inspection during asset import. No license file was present in the inspected reference tree; record provenance and confirm the applicable reuse terms before distribution.

## Target architecture and contracts

Use a plain JavaScript ES-module application, with `three` as the runtime dependency and `vite` as the development dependency. Pin compatible versions and commit the generated lockfile during implementation. Avoid a framework, ECS, physics engine, or general event bus.

- `Game` owns startup, browser lifecycle, simulation loop, and rendering.
- `World` owns a Three.js scene and collections of behavior objects, collision records, and pickable roots. It can replace one hall without discarding persistent lighting.
- A `SceneObject` wraps an `Object3D` and exposes optional `update(dt)`, `interact(context)`, `getInteractionMessage()`, bounds, solidity, and `autoSteppable`. Objects do not directly read keys or manipulate DOM elements.
- `CharacterController` owns feet position and movement state. The camera reads the result; camera controls never translate the player independently.
- `InteractionSystem` maps hit descendants to their owning behavior object. It also manages walking/seated/editing modes, so browser input cannot both type on a board and move the player.
- `ModelLibrary` caches asset promises/templates, clones transform hierarchies per instance, and shares immutable geometry/materials. Release shared assets at library shutdown, not whenever one chair is removed.

Advance simulation with a fixed 1/120-second step and a bounded accumulator driven by `requestAnimationFrame`. Consume discrete actions once, update animation and dynamic bounds before player collision, then update camera matrices and interaction targeting before rendering. Clear accumulated time and input when paused, hidden, or unlocked. This bounds displacement across the 0.1-thick door and 0.2-thick walls without introducing swept physics. Validate stair timing and collision at varied rendering rates.

Use authored collider boxes for walls, tiers, and furniture, transformed into world space; use `Box3` for storage. Keep static bounds cached and refresh moving-part bounds only when transforms change. Do not derive all collision from a group's decorative geometry on every frame. [Box3 documentation](https://threejs.org/docs/pages/Box3.html).

For picking, cast through screen center with a two-unit maximum distance. Include wall/furniture occluders as well as interactive meshes, take the nearest hit, and resolve its owner. Broad proxy pick meshes can preserve the original forgiving chair targeting. Keep these separate from collision boxes and visual/debug meshes. [Raycaster documentation](https://threejs.org/docs/pages/Raycaster.html).

## File-by-file implementation order

All paths are relative to this repository. Each step extends the previous working application.

### Step 1: Render a browser scene

| File | Source/reference | Work |
| --- | --- | --- |
| `package.json` | `CMakeLists.txt`, `vcpkg.json` | Add ES modules, Three.js, Vite, and dev/build/preview scripts; add Node test script when tests arrive. |
| `package-lock.json` | New/generated | Lock installed versions. |
| `.gitignore` | New | Ignore `node_modules/`, `dist/`, temporary conversion input, and local reference checkout if used. |
| `index.html` | Native window and overlays | Add canvas container, loading/start overlay, minimal HUD hooks, and module entry. |
| `src/main.js` | `main.cpp` | Construct and start `Game`; show initialization errors. |
| `src/core/Game.js` | `Application.cpp/.h` | Create renderer, scene/world, perspective camera, main/fill/ambient lights, resize handler, RAF loop, and cleanup. Extend this file at subsequent steps. |
| `src/styles.css` | `CrosshairOverlay`, `ParametersOverlay` | Full-window canvas, overlay, crosshair, prompts, and simple editor/control styles. |
| `README.md` | Existing one-line README | Document setup, scripts, Phase 1 scope, reference commit, and link to this plan. |

Gate: dev server displays a lit test box; resize preserves aspect; production build and preview work. No school expansion.

### Step 2: Port player movement in a small test room

| File | Source/reference | Work |
| --- | --- | --- |
| `src/core/InputManager.js` | `InputState.h`, `InputAction.h`, `KeyBindings.h` | Held actions, single-press actions, mouse deltas, Pointer Lock events, blur/visibility reset, and gameplay/editor modes. |
| `src/camera/FirstPersonCamera.js` | `FirstPersonCamera.cpp/.h` | Yaw/pitch, XZ movement vectors, eye offset, projection, and direction-based orientation. |
| `src/physics/Aabb.js` | `Aabb.h`, `Mat3.h` | Strict penetration check, feet box construction, transformed authored bounds. |
| `src/physics/CharacterController.js` | `CharacterController.cpp/.h` | Port normalized movement, X/Z resolution, gravity, jump, floor/ceiling resolution, and flagged auto-step state. Reset all transient state on teleport. |
| `src/world/SceneObject.js` | `SceneObject.h` | Small common object wrapper and optional behavior methods. |
| `src/world/World.js` | `Scene.cpp/.h` | Object registration, colliders, update lists, hall replacement, and disposal ownership. |
| `src/objects/Box.js` | `Box.cpp/.h` | Reusable solid box with explicit bounds and optional stepping flag. |
| `tests/character-controller.test.js` | New | Node tests for diagonal speed, floor/ceiling resolution, wall sliding, jump gating, stair clearance, and reset. |
| `tests/aabb.test.js` | New | Contact versus penetration, transformed bounds, and zero-volume handling. |

Gate: click-to-lock, WASD/mouse, grounded jump, landing, wall sliding, and a marked 0.2-high step work. Escape unlocks and pauses; relocking requires a click; a click used to lock must not activate an object. Repeat at 30/60/120 rendering FPS and after tab switching.

### Step 3: Recreate the procedural hall with placeholder furniture

| File | Source/reference | Work |
| --- | --- | --- |
| `src/world/Layout.js` | `Layout.cpp/.h` | Port X/Z stacks and factory slots with the same spacing semantics. |
| `src/config/classroom.js` | `LectureHall.h`, `ParameterManager.cpp` | Hall defaults, four editable descriptors/limits, derived metrics, and spawn settings. |
| `src/world/prefabs.js` | `RoomPrefabs.h`, `LectureHallPrefabs.h`, `Colors.h`, `LightingPrefabs.h` | Room/furniture factories, palette, teacher desk, and lighting setup; use temporary boxes for imported furniture. |
| `src/world/Classroom.js` | `LectureHall.cpp` | Port metrics, split doorway wall, outside landing, furniture placement, tiers, and build result. Return a hall group, object records, metrics, and spawn. |
| `src/objects/Blackboard.js` | `Blackboard.cpp/.h` | First add board/frame geometry and collider; add writing in Step 6. |
| `tests/classroom-layout.test.js` | New | Assert default dimensions, row/section spacing, counts, tier heights, doorway gap, and left/right door placement. |

Gate: all default values in the reference table match. Walk from front to rear through both aisles; climb and descend every tier; jump under a test low ceiling; reach the landing through the placeholder doorway. Debug placeholders remain temporary.

### Step 4: Import real furniture assets

| File | Source/reference | Work |
| --- | --- | --- |
| `docs/assets.md` | Model directory and prefab transforms | Record pinned origins, conversion workflow, dimensions, axis fixes, pivots, materials, and attribution status. |
| `public/models/chair.glb` | Existing GLB | Copy the original asset unchanged. |
| `public/models/door.glb` | `door.stl` | Convert preserving source geometry coordinates. |
| `public/models/door_handle.glb` | `door_handle.stl` | Convert preserving coordinates. |
| `public/models/student_desk_stand.glb` | `student_desk_stand.stl` | Convert preserving coordinates. |
| `public/models/student_desk_desk.glb` | `student_desk_desk.stl` | Convert preserving coordinates. |
| `src/assets/ModelLibrary.js` | `ModelMesh.cpp`, `ModelObject.cpp`, `ModelPrefabs.h` | Async GLB loading, cache/templates, clone instances, per-asset normalization, errors, and ownership-aware disposal. |
| `src/objects/Chair.js` | `Chair`, chair prefabs | Chair visual, authored collision/pick bounds, student/teacher orientation, and seat/stand anchors. |
| `src/objects/StudentDesk.js` | `StudentDesk.cpp/.h` | Fixed stand and pivoted writing surface, collider, and animation state. |

Update `prefabs.js`, `Classroom.js`, and `Game.js` to await asset readiness and replace placeholders. Use Vite's base path when constructing public model URLs so production subpath hosting works; [Vite asset guidance](https://vite.dev/guide/assets).

Gate: inspect one chair, one desk, one panel, and one handle before building all instances. Compare orientation, size, texture, ground contact, and pivot positions against source expectations/native view if available. Network requests load each asset once. Full hall then has 106 chairs and 105 folding desks, without placeholders or silent load failures. Check both dev and preview.

### Step 5: Raycasting, door and desk animation

| File | Source/reference | Work |
| --- | --- | --- |
| `src/interaction/InteractionSystem.js` | `Raycast.h`, `Scene::raycastClosest`, `Application::tryInteract` | Screen-center ray, owner lookup, occlusion, range, dispatch, and interaction state. |
| `src/objects/Door.js` | `Door.cpp/.h`, `RoomPrefabs.h` | Hinge/panel/handle groups, both orientations, outward sign, pending handle press, open/close animation, prompt, and dynamic bounds. |
| `src/ui/HUD.js` | `CrosshairOverlay.cpp/.h` | Crosshair and action prompt plus loading/lock/error state. No game timer or destination HUD. |
| `tests/interactions.test.js` | New | Range/occlusion/owner resolution, door and desk endpoints, debounce, and animation under different dt partitions. |

Extend `StudentDesk.js` to toggle the tabletop, and replace the door placeholder in the hall. Refresh moving collision bounds before each physics step. Keep animation state independent of the render loop.

Gate: only a reachable, visible target prompts; walls block interaction; E activates once per press. Handles move before doors, tabletop hinges match the original, and all animations reach exact endpoints. Closed doors block passage; fully open doors allow passage and their panels remain solid in their new locations.

### Step 6: Complete existing interactions and safe regeneration

| File | Source/reference | Work |
| --- | --- | --- |
| `src/ui/BlackboardEditor.js` | `Application::keyDown`, `Blackboard` text methods | Focused editor for up to 200 characters; Backspace deletes, Delete clears, Enter finishes. Stop movement while typing, handle Escape predictably, and require a click to resume pointer lock. |
| `src/ui/ParametersPanel.js` | `ParameterManager`, `ParametersOverlay` | Small DOM controls for rows, columns, front margin, room height, apply/reset, with bounded values and source defaults. |
| `src/debug/ColliderDebug.js` | `DebugAabbRenderer` | Toggle collider helpers, including moving parts, without letting helpers participate in picks. |
| `docs/phase-1-validation.md` | New | Record manual acceptance cases, browser/build results, and remaining parity differences. |

Extend `Blackboard.js` with text state and canvas texture updates only when text changes. Extend `InteractionSystem.js` with seated/editing transitions; Space stands up from chairs without initiating a jump on the same press. Sitting fixes the camera to its seat anchor and bypasses standing-character physics. Check saved stand position and use a clear fallback anchor if obstructed.

Extend `Game.js`, `World.js`, and `classroom.js` for rebuilding only the hall: clear target, editing and sitting state, reset physics and input, replace objects/colliders, and respawn safely. Preserve shared asset cache and persistent lighting; dispose removed unique textures/materials/helpers. Validate ceiling clearance against the actual highest tier plus standing player height and a margin, rather than copying the native heuristic blindly.

Gate: sit/look/stand, write/delete/clear/finish, rebuild/reset while previously seated or editing, and repeated regeneration all work. Key presses in the editor/panel do not move the player. Object and renderer resource counts settle after repeated rebuilds.

## Behaviors to correct during the port

These are explicit migration changes, rather than features to reproduce accidentally:

1. **Door solidity:** native `Door::isSolid()` returns false at an opening angle of 6 degrees. Keep a transformed panel AABB through the entire swing. A rotating AABB is conservative; test passage at 95 degrees. Stop/reject a closing motion that would overlap the player rather than trapping the character.
2. **Interaction through walls:** the native query filters out non-interactable objects before finding the closest hit. Include occluders in browser raycasting, then decide whether the first owner is interactable.
3. **Furniture bounds:** the native desk collider is a fixed proxy independent of folding angle. Use a support proxy and a moving tabletop proxy so collision follows meaningful furniture motion. Test tight seating spaces; do not make one large box around the entire seating section.
4. **Physics state:** clear step interpolation and vertical state on teleport/regeneration, and calculate grounding consistently when walking off an edge. Preserve stair behavior while checking headroom over the step trajectory, not only at the final destination.
5. **Sitting coordinates:** source calculations mix model dimensions and world axes, and run standing physics during sitting. Derive anchors from normalized furniture and suspend standing physics while seated.
6. **Input/lifecycle:** replace Escape-to-exit with unlock/pause, suppress repeated discrete actions, clear held keys on blur, and ensure text editing consumes input exclusively.
7. **Regeneration:** replace the native assumption that the first two objects are lights with explicit persistent and hall ownership. Invalidate references before removing objects.
8. **Transforms:** source rendering composes `T × Rz × Ry × Rx × S`. Use nested groups or equivalent matrices when preserving multi-axis corrections; do not assume the default Euler order reproduces it.

## Phase 1 acceptance and handoff

Run focused Node tests for the ported algorithms, `npm run build`, and a browser check against `npm run preview`. No large testing framework is necessary; Node's built-in test runner is sufficient for math/layout/state tests. Pointer lock, texture appearance, editor focus, and WebGL behavior require actual browser checks.

Phase 1 is complete when:

- The default procedural hall matches the reference dimensions and furniture counts, with real reused assets and functional lighting.
- WASD/mouse, lock/unlock, gravity, jumping, wall sliding, furniture collisions, and all seven stairs work without frame-rate-dependent travel or tab-resume jumps.
- The side wall has a real doorway; the player can open its animated door and walk onto the original landing.
- Visible targets within two units show accurate prompts; walls prevent interaction through them.
- Doors, folding desks, sitting/standing, and editable board text work with isolated input modes.
- Regeneration/reset leaves a valid spawn, no stale interaction references, and no accumulating resources.
- Asset URLs work in production preview, including the intended base path; loading failures display a useful error.
- The validation document distinguishes tested behavior from any remaining visual or native-parity uncertainty.

Only after these checks pass should Phase 2 add a school, corridor, and more classrooms. Keep `Classroom` configurable now, but defer school-wide architecture until one migrated hall is proven.
