import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolLayout, corridorWallSegments, uncoveredSegments, normalizeSchoolParams } from '../src/config/school.js';
import { School } from '../src/world/School.js';
import { CornerConnector } from '../src/world/CornerConnector.js';

function pointAt(corridor, z) {
  return [
    corridor.center[0] + Math.sin(corridor.yaw) * z,
    corridor.center[2] + Math.cos(corridor.yaw) * z,
  ];
}

test('four corridor sections join into a square loop with four classrooms each', () => {
  const layout = schoolLayout();
  assert.deepEqual(layout.rooms.map(room => room.number), Array.from({ length: 16 }, (_, index) => String(101 + index)));
  assert.equal(layout.corridors.length, 4);
  for (const corridor of layout.corridors) {
    assert.equal(layout.rooms.filter(room => room.corridorIndex === corridor.index).length, 4);
  }
  for (let i = 1; i < layout.rooms.length; i++) {
    const previous = layout.rooms[i - 1], current = layout.rooms[i];
    if (previous.corridorIndex === current.corridorIndex) {
      assert.ok(Math.abs(current.localOrigin[2] - previous.localOrigin[2] - (layout.metrics.roomDepth + 0.4)) < 1e-6);
    }
  }
  for (let i = 0; i < 4; i++) {
    const end = pointAt(layout.corridors[i], layout.length / 2);
    const start = pointAt(layout.corridors[(i + 1) % 4], -layout.length / 2);
    assert.ok(Math.hypot(end[0] - start[0], end[1] - start[1]) < 1e-6);
  }
  assert.ok(layout.entranceZ > -layout.length / 2 + 5);
  assert.ok(layout.entranceZ < layout.length / 2 - 1);
  const spawnInCorridor = layout.corridors[0];
  const dx = layout.spawn[0] - spawnInCorridor.center[0];
  const dz = layout.spawn[2] - spawnInCorridor.center[2];
  const localX = Math.cos(spawnInCorridor.yaw) * dx - Math.sin(spawnInCorridor.yaw) * dz;
  const localZ = Math.sin(spawnInCorridor.yaw) * dx + Math.cos(spawnInCorridor.yaw) * dz;
  assert.ok(Math.abs(localX + layout.params.corridorWidth / 2 - 1.4) < 1e-6);
  assert.ok(Math.abs(localZ - layout.entranceZ) < 1e-6);
  assert.ok(layout.spawn.every(Number.isFinite));
});

test('corner connectors fill each outer turn quadrant and close it with walls', () => {
  const layout = schoolLayout();
  assert.equal(layout.corners.length, 4);
  const half = layout.params.corridorWidth / 2;
  const wallThickness = 0.2;
  for (const spec of layout.corners) {
    const corner = new CornerConnector(layout.params.corridorWidth, layout.params.roomHeight, spec.center, spec.yaw);
    const localQuarter = half / 4;
    const x = spec.center[0] + Math.cos(spec.yaw) * localQuarter + Math.sin(spec.yaw) * localQuarter;
    const z = spec.center[2] - Math.sin(spec.yaw) * localQuarter + Math.cos(spec.yaw) * localQuarter;
    const floor = corner.colliders.find(collider => collider.owner.root.name === 'corner-floor');
    assert.ok(floor.box.containsPoint({ x, y: 0, z }), `Floor covers the missing quadrant at corner ${spec.index}`);
    assert.equal(corner.parts.length, 4);
    assert.ok(corner.colliders.every(collider => !collider.box.isEmpty()));
    const wallX = corner.colliders.find(collider => collider.owner.root.name === 'corner-outer-wall-x').box;
    const wallZ = corner.colliders.find(collider => collider.owner.root.name === 'corner-outer-wall-z').box;
    const outsideCorner = {
      x: spec.center[0] + Math.cos(spec.yaw) * (half + wallThickness / 2) +
        Math.sin(spec.yaw) * (half + wallThickness / 2),
      y: layout.params.roomHeight / 2,
      z: spec.center[2] - Math.sin(spec.yaw) * (half + wallThickness / 2) +
        Math.cos(spec.yaw) * (half + wallThickness / 2),
    };
    assert.ok(wallX.containsPoint(outsideCorner), `Outer corner seam is covered at corner ${spec.index}`);
    const overlap = [
      Math.min(wallX.max.x, wallZ.max.x) - Math.max(wallX.min.x, wallZ.min.x),
      Math.min(wallX.max.y, wallZ.max.y) - Math.max(wallX.min.y, wallZ.min.y),
      Math.min(wallX.max.z, wallZ.max.z) - Math.max(wallX.min.z, wallZ.min.z),
    ];
    assert.ok(overlap.some(size => size <= 1e-8), `Corner walls meet without clipping at corner ${spec.index}`);
    corner.dispose();
  }
});

test('classroom doors sit in their corridor walls and rotated classrooms stay separate', () => {
  const layout = schoolLayout();
  for (const room of layout.rooms) {
    assert.equal(room.corridorIndex, Math.floor(layout.rooms.indexOf(room) / 4));
    assert.ok(Math.abs(Math.abs(room.localOrigin[0]) - (layout.params.corridorWidth / 2 + 0.2 + layout.metrics.roomWidth / 2)) < 1e-6);
    assert.ok(Math.abs(Math.abs(room.door[1] - 1)) < 1e-6);
    assert.ok(room.bounds.maxX > room.bounds.minX && room.bounds.maxZ > room.bounds.minZ);
  }
  for (const [i, a] of layout.rooms.entries()) for (const b of layout.rooms.slice(i + 1)) {
    const overlap = a.bounds.minX < b.bounds.maxX && a.bounds.maxX > b.bounds.minX &&
      a.bounds.minZ < b.bounds.maxZ && a.bounds.maxZ > b.bounds.minZ;
    assert.equal(overlap, false);
  }
});

test('corridor dimensions adapt to classroom settings and the corridor openings remain uncovered', () => {
  for (const values of [
    { seatRows: 1, seatCols: 2, corridorWidth: 3, frontMargin: 1.5 },
    { seatRows: 20, seatCols: 10, corridorWidth: 6, frontMargin: 5 },
  ]) {
    const layout = schoolLayout(values);
    assert.ok(layout.params.roomHeight >= layout.params.seatRows * 0.2 + 2.1 - 1e-6);
    assert.ok(layout.length > layout.metrics.roomDepth);
    for (const room of layout.rooms) {
      const frontWall = [
        room.localOrigin[2] + layout.metrics.zFront - 0.2,
        room.localOrigin[2] + layout.metrics.zFront,
      ];
      const backWall = [
        room.localOrigin[2] + layout.metrics.zBack,
        room.localOrigin[2] + layout.metrics.zBack + 0.2,
      ];
      const covered = [frontWall[0], backWall[1]];
      const segments = uncoveredSegments(-layout.length / 2, layout.length / 2, [covered]);
      assert.equal(segments.some(([a, b]) => a < room.localOrigin[2] + layout.metrics.doorCenterZ + 0.5 &&
        b > room.localOrigin[2] + layout.metrics.doorCenterZ - 0.5), false);
      for (const segment of segments) for (const endWall of [frontWall, backWall]) {
        assert.equal(segment[0] < endWall[1] - 1e-8 && segment[1] > endWall[0] + 1e-8, false,
          `Corridor wall does not clip the classroom end wall in Room ${room.number}`);
      }
    }
  }
  assert.deepEqual(uncoveredSegments(0, 10, [[4, 7], [2, 5]]), [[0, 2], [7, 10]]);
});

test('corridor-facing courtyard walls stay closed at every corner turn', () => {
  for (const values of [{}, { corridorWidth: 3 }, { corridorWidth: 6 }]) {
    const layout = schoolLayout(values);
    for (const corridor of layout.corridors) {
      const segments = corridorWallSegments(layout, corridor, -1);
      const cornerWallEnd = -layout.length / 2 + 0.5;
      assert.equal(segments.some(([a, b]) => a <= cornerWallEnd && b > cornerWallEnd), true,
        `${corridor.name} blocks the courtyard at its corner`);
    }
  }
});

test('north entrance wall is sealed beneath its exterior sign', () => {
  const layout = schoolLayout();
  const northCorridor = layout.corridors[0];
  const segments = corridorWallSegments(layout, northCorridor, -1);
  assert.equal(segments.some(([a, b]) => a <= layout.entranceZ && b >= layout.entranceZ), true);
});

test('invalid corridor widths are bounded or reset', () => {
  assert.equal(normalizeSchoolParams({ corridorWidth: NaN }).corridorWidth, 4.4);
  assert.equal(normalizeSchoolParams({ corridorWidth: -1 }).corridorWidth, 3);
  assert.equal(normalizeSchoolParams({ corridorWidth: 99 }).corridorWidth, 6);
  assert.equal(normalizeSchoolParams({ seatRows: 1, roomHeight: 2.5 }).roomHeight, 3.2);
});

test('location labels distinguish classrooms and all four corridor sections', () => {
  const layout = schoolLayout();
  const school = { layout, rooms: layout.rooms, params: layout.params };
  for (const room of layout.rooms) {
    assert.ok(School.prototype.locationAt.call(school, { x: room.origin[0], z: room.origin[2] }).includes(room.number));
  }
  for (const corridor of layout.corridors) {
    const [x, z] = pointAt(corridor, 0);
    assert.match(School.prototype.locationAt.call(school, { x, z }), new RegExp(corridor.name.toUpperCase()));
  }
});
