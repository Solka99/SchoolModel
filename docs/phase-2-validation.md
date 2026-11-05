# Phase 2: modular school

Phase 2 expands the migrated lecture hall into one explorable school floor. It retains the Phase 1 furniture, interactions, physics, input, renderer, and model cache. No additional npm dependencies or external assets were added.

## Delivered environment

| Area | Contents |
| --- | --- |
| Main entrance | Animated entrance door, exterior landing/canopy, exit and entrance signs, benches, welcome directory |
| Main corridor | One continuous hall, ceiling strips, floor guide line, room numbers, subject signs, and end directory |
| Room 101 | Mathematics, east side near the entrance |
| Room 102 | Science, west side near the entrance |
| Room 103 | Literature, east side farther along the corridor |

Each default classroom has the original 14.7 × 13.45 footprint, seven raised seating tiers, 105 student desks, 106 chairs, a teacher desk, and an independent blackboard. Total furniture is 315 student desks and 318 chairs. The default ceiling is lowered from the standalone reference's ten units to four, consistently across this school floor. The corridor is 4.4 units wide and approximately 35.7 units long.

The player starts at `(0, 0, 1.5)`, inside the entrance, facing down the corridor. All four doors start closed and retain their handle/open/close animations. Entering another room requires walking through its doorway, with no scene switch, teleport, or loading screen. The HUD identifies the entrance, corridor, or current classroom.

## Implementation

- `src/config/school.js`: numbered room specifications and bounded school settings; derives origins, room bounds, shared door positions, corridor length, and spawn from current classroom metrics.
- `src/world/School.js`: composes rooms and corridor into one world, adds interior room signs, and resolves the player's current location.
- `src/world/Corridor.js`: fills wall segments not already supplied by classroom shells; adds doorway thresholds, entrance, corridor geometry, signs, and benches.
- `src/world/Classroom.js`: reuses the original procedural builder. School instances omit the old exterior classroom landing. `place()` translates authored collision boxes and seat anchors with each room, while subsequent animated bounds are calculated in world space.
- `src/objects/Sign.js`: local canvas textures on planar geometry, with explicit resource disposal.
- `World`, `Game`, and the interaction/UI modules now operate on the complete school. Respawn, fall recovery, and standing fallback use the school entrance. Rebuilding clears old interaction references and replaces all school-owned resources while preserving lighting and shared model templates.

School settings edit all classrooms and the connecting corridor together. Room placement is recalculated when rows, columns, front margin, ceiling height, or corridor width changes. Ceiling height is at least 3.2 for signage and increases further for standing clearance above the highest tier. Rebuild/reset clears board text and returns the player to the entrance. The original standalone classroom defaults and their Phase 1 layout tests remain available in code.

## Verification

Validated locally with Node.js 22.12.0, Three.js 0.180.0, Vite 7.3.7, and Chrome software WebGL.

- **34 unit tests passed**, including all original Phase 1 checks. New tests cover room adjacency, non-overlap, placement under minimum/maximum room dimensions, corridor wall gaps, bounded settings, location labels, translated seats/colliders, and animated world-space bounds after moving a room.
- **Development browser smoke passed** with actual click-to-lock and keyboard movement. Its continuous physical route walks through the entrance, then enters and leaves all three classrooms. It verifies closed-door blocking, ray targeting, opening, climbing/descending the translated seating tiers, sitting/standing, desks, and separate board text in each room. The route uses the real collision controller and scene bounds.
- **Reconfigured school routes passed** after reducing corridor width to 3, ceiling height to 3.2, front margin to 1.5, rows to 4, and columns per section to 3. All three rebuilt rooms remained accessible, with 108 student desks in total.
- **Five repeated whole-school rebuilds** with debug helpers toggled kept geometry and texture counts stable when rendering the same corridor view. Shared model assets are loaded once rather than separately for each room.
- **Production build and browser startup checks passed**, including model/icon requests, rendering, responsive overlays, and no JavaScript exceptions. Vite retains its advisory about the roughly 607 KB minified application chunk; this is not a build failure.
- Welcome, corridor, classroom interior, settings, and narrow-screen screenshots were generated in ignored `.qa/`. Desktop views were inspected for doorway alignment, signs, furniture, and UI readability.

Run `npm test`, `npm run build`, and the documented browser smoke script to reproduce checks. Full behavioral integration checks use the development-only game handle; production smoke checks startup/rendering and requests without exposing that handle.

## Limits and later phases

Chrome software WebGL was exercised; other browsers and hardware performance still need direct testing. This is a desktop keyboard/mouse experience. Layout tests exercise parameter extremes, but the largest allowed furniture layouts are not performance benchmarks. Classroom dimensions and visual style derive from the source project rather than a precise architectural model of a real school.

Light switches and further interaction refinements remain Phase 3. Timers, destinations, moving obstacles, victory/defeat, and the School Rush game mode remain Phase 4. No later-phase systems were introduced here.
