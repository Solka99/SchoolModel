import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolLayout, uncoveredSegments, normalizeSchoolParams } from '../src/config/school.js';
import { School } from '../src/world/School.js';

test('three numbered rooms connect to both sides of a single corridor', () => {
  const l = schoolLayout();
  assert.deepEqual(l.rooms.map(r => r.number), ['101', '102', '103']);
  assert.deepEqual(l.spawn, [0, 0, 1.5]);
  assert.equal(new Set(l.rooms.map(r => r.side)).size, 2);
  for (const r of l.rooms) {
    assert.ok(Math.abs(Math.abs(r.door[0]) - (l.params.corridorWidth / 2 + 0.1)) < 1e-6);
    assert.ok(r.door[2] > r.bounds.minZ + 0.5 && r.door[2] < r.bounds.maxZ - 0.5);
    const nearWall = r.side === 1 ? r.bounds.minX : r.bounds.maxX;
    assert.ok(Math.abs(Math.abs(nearWall) - (l.params.corridorWidth / 2 + 0.2)) < 1e-6);
    assert.ok(r.bounds.minZ >= l.entranceDepth);
    assert.ok(r.bounds.maxZ < l.length);
  }
});
test('classroom interiors do not overlap', () => {
  const l = schoolLayout();
  for (const [i, a] of l.rooms.entries()) for (const b of l.rooms.slice(i + 1)) {
    const overlap = a.bounds.minX < b.bounds.maxX && a.bounds.maxX > b.bounds.minX && a.bounds.minZ < b.bounds.maxZ && a.bounds.maxZ > b.bounds.minZ;
    assert.equal(overlap, false);
  }
});
test('school placement and corridor length adapt to classroom dimensions', () => {
  for (const values of [{ seatRows: 1, seatCols: 2, corridorWidth: 3, frontMargin: 1.5 }, { seatRows: 20, seatCols: 10, corridorWidth: 6, frontMargin: 5 }]) {
    const l = schoolLayout(values);
    assert.ok(l.params.roomHeight >= l.params.seatRows * 0.2 + 2.1 - 1e-6);
    assert.ok(Math.abs(l.rooms[2].bounds.minZ - l.rooms[0].bounds.maxZ - 0.4) < 1e-6);
    assert.ok(l.length > l.rooms[2].bounds.maxZ);
    for (const r of l.rooms) assert.ok(Math.abs(Math.abs(r.door[0]) - (l.params.corridorWidth / 2 + 0.1)) < 1e-6);
  }
});
test('corridor wall gaps match classroom shells without sealing doorways', () => {
  const l = schoolLayout();
  for (const side of [-1, 1]) {
    const rooms = l.rooms.filter(r => r.side === side);
    const segments = uncoveredSegments(0, l.length, rooms.map(r => [r.bounds.minZ, r.bounds.maxZ]));
    for (const room of rooms) assert.equal(segments.some(([a, b]) => a < room.door[2] + 0.5 && b > room.door[2] - 0.5), false);
    const total = segments.reduce((n, [a, b]) => n + b - a, 0) + rooms.reduce((n, r) => n + r.bounds.maxZ - r.bounds.minZ, 0);
    assert.ok(Math.abs(total - l.length) < 1e-6);
  }
  assert.deepEqual(uncoveredSegments(0, 10, [[4, 7], [2, 5]]), [[0, 2], [7, 10]]);
});
test('invalid corridor widths are bounded or reset', () => {
  assert.equal(normalizeSchoolParams({ corridorWidth: NaN }).corridorWidth, 4.4);
  assert.equal(normalizeSchoolParams({ corridorWidth: -1 }).corridorWidth, 3);
  assert.equal(normalizeSchoolParams({ corridorWidth: 99 }).corridorWidth, 6);
  assert.equal(normalizeSchoolParams({ seatRows: 1, roomHeight: 2.5 }).roomHeight, 3.2);
});

test('location labels distinguish the lobby, corridor, and every classroom', () => {
  const layout = schoolLayout();
  const school = { layout, rooms: layout.rooms };
  assert.match(School.prototype.locationAt.call(school, { x: 0, z: 1.5 }), /ENTRANCE/);
  assert.match(School.prototype.locationAt.call(school, { x: 0, z: 10 }), /CORRIDOR/);
  for (const room of layout.rooms) {
    const position = { x: room.origin[0], z: (room.bounds.minZ + room.bounds.maxZ) / 2 };
    assert.ok(School.prototype.locationAt.call(school, position).includes(room.number));
  }
});
