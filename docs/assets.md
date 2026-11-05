# Phase 1 assets

All five runtime models originate from `rubikon02/pg3d`, commit `4b0bea18fbc6e59cb5c4bad46fe91bbb02a96775`, under `src/models/`. The native repository and original files are unchanged. The unused `chair.stl` alternative is not shipped.

| Runtime asset | Original | Bytes | Treatment |
| --- | --- | --- | --- |
| `chair.glb` | `chair.glb` | 369120 | Exact original bytes, including embedded JPEG and material |
| `door.glb` | `door.stl` | 11104 | Geometry-only format conversion; authored warm wood material |
| `door_handle.glb` | `door_handle.stl` | 29516 | Geometry-only format conversion; metal material |
| `student_desk_stand.glb` | `student_desk_stand.stl` | 7544 | Geometry-only format conversion; dark support material |
| `student_desk_desk.glb` | `student_desk_desk.stl` | 18536 | Geometry-only format conversion; wood-colored material |

Every GLB is self-contained. No texture files, runtime STL loader, network model source, or decoder service is required. The complete runtime model set is 435820 bytes (about 426 KiB).

## Reproduce conversions

Obtain a separate checkout of the pinned source, then run:

```sh
node scripts/convert-models.mjs /path/to/pg3d/src/models
```

The default input directory is `.reference/pg3d/src/models`, ignored by Git. The script uses the installed Three.js `STLLoader` and `GLTFExporter`, with a small binary FileReader adapter for Node. It copies the chair unchanged, converts the four STL files to GLB, and logs untransformed source bounds. No Blender installation or converter dependency is required.

## Axes, dimensions, and pivots

- The actual chair GLB contains one mesh node, no node correction transform, and bounds `[-0.25, 0, -0.25]` to `[0.25, 1, 0.25]`. It is already Y-up. `ModelLibrary.chair()` centers its footprint, places the bottom at zero, and scales its X/Z footprint to 0.5. Student chairs rotate 180 degrees; the teacher chair uses its original orientation. Each instance shares immutable geometry/materials and the embedded texture.
- The door STL bounds are `[0, -0.05, 0]` to `[1, 0.05, 2]`. Local Z is height and local X runs from the hinge to the free edge. Preserve that origin. An outer X rotation of -90 degrees maps height to world Y. Door orientation and animated swing are parent Y rotations. The default side door rotates 90 degrees before its outward swing. The panel remains solid during the full animation.
- Door handles retain their local geometry origin. Each sits at local `(0.86, ±0.03, 1)` before the panel's axis correction; the opposite handle mirrors local Y. Handle animation rotates about local Y.
- The desk stand bounds are approximately `[-0.25, 0, 0]` to `[0.25, 0.1, 0.7]`. The writing surface is approximately `[-0.24, -0.01, -0.39]` to `[0.24, 0.01, 0.01]`. Neither part is recentered. A writing-surface group at `(0, 0.035, 0.69)` supplies the hinge; its local X angle changes from 0 to 90 degrees. Parent groups compose `Ry(180°) × Rx(-90°)`, matching the native transform order.
- Student chairs stand on the tier surface. Explicit seat anchors avoid the native code's model-axis-dependent sitting calculation. The seated camera is 0.6 units above a 0.46-high seat anchor.

The classroom shell, teacher desk, board/frame, trim, and ceiling strips are procedural geometry. Text is drawn into a local canvas texture, refreshed only when board text changes. The favicon is a small source SVG. UI fonts use system fallbacks, with no external font request.

## Provenance

The inspected source tree had no license file. The user requested reuse of these existing university project assets. Their authorship/license and any required attribution should be confirmed before distributing the project beyond that authorized context. No license for the original assets is asserted here. Installed package licenses remain in their npm packages.

Chair SHA-256 (original and runtime): `bdb809ba9d081b703638cfa01af7b2d3b980aeee54a4f0878423616c5639f49d`.
