import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, computeMetrics, normalizeParams } from '../src/config/classroom.js';
import { seatingSlots, tierSlots } from '../src/world/Classroom.js';
import { HStack, VStack } from '../src/world/Layout.js';

test('default metrics and spawn match the native hall', () => {
  const m = computeMetrics(DEFAULTS);
  for (const [key, expected] of Object.entries({ sectionWidth: 2.9, seatingWidth: 11.7, seatingDepth: 7.35, roomWidth: 14.7, roomDepth: 13.45, zFront: -3, zBack: 10.45, doorCenterZ: -1.4 })) {
    assert.ok(Math.abs(m[key] - expected) < 1e-6, key);
  }
  assert.deepEqual(m.spawn, [1.6, 0, -0.2]);
});
test('105 seating slots preserve section, row and chair spacing', () => {
  const m = computeMetrics(DEFAULTS), slots = seatingSlots(DEFAULTS, m);
  assert.equal(slots.length, 105);
  assert.ok(Math.abs(slots[1].desk[0] - slots[0].desk[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(slots[5].desk[2] - slots[0].desk[2] - 1.05) < 1e-6);
  assert.ok(Math.abs(slots[35].desk[0] - slots[0].desk[0] - 4.4) < 1e-6);
  assert.ok(Math.abs(slots[0].chair[2] - slots[0].desk[2] - 0.8) < 1e-6);
});
test('seven tiers have source heights; final tier reaches back wall', () => {
  const m = computeMetrics(DEFAULTS), tiers = tierSlots(DEFAULTS, m);
  assert.equal(tiers.length, 7);
  tiers.forEach((t, i) => assert.ok(Math.abs(t.center[1] + t.size[1] / 2 - (i + 1) * 0.2) < 1e-6));
  assert.ok(Math.abs(tiers.at(-1).center[2] + tiers.at(-1).size[2] / 2 - m.zBack) < 1e-6);
});
test('parameter bounds protect standing clearance above highest tier', () => {
  const p = normalizeParams({ seatRows: 100, seatCols: NaN, roomHeight: 2.5 });
  assert.equal(p.seatRows, 20); assert.equal(p.seatCols, 5); assert.ok(p.roomHeight >= 6.1 - 1e-6);
});
test('HStack advances X and VStack advances Z', () => {
  const h = new HStack(1).add([2, 3, 4], p => [p]).add([2, 3, 4], p => [p]);
  const v = new VStack(1).add([2, 3, 4], p => [p]).add([2, 3, 4], p => [p]);
  assert.deepEqual(h.build([0, 7, 0]), [[0, 7, 0], [3, 7, 0]]);
  assert.deepEqual(v.build([0, 7, 0]), [[0, 7, 0], [0, 7, 5]]);
});
