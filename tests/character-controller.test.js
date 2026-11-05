import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { CharacterController } from '../src/physics/CharacterController.js';
import { boxAt } from '../src/physics/Aabb.js';

const F = new Vector3(0, 0, 1), R = new Vector3(1, 0, 0);
const floor = { box: boxAt([0, -0.1, 0], [100, 0.2, 100]) };
function run(player, seconds, intent, colliders = [floor], jump = false) {
  for (let frame = 0; frame < Math.round(seconds * 120); frame++) player.update(1 / 120, intent, F, R, jump && frame === 0, colliders);
}
test('normalized diagonal speed equals forward speed', () => {
  const a = new CharacterController(), b = new CharacterController();
  run(a, 1, { x: 0, z: 1 }); run(b, 1, { x: 1, z: 1 });
  assert.ok(Math.abs(a.feet.length() - 4.5) < 1e-6);
  assert.ok(Math.abs(b.feet.length() - 4.5) < 1e-6);
});
test('jump lands on floor; airborne jump cannot reset vertical velocity', () => {
  const p = new CharacterController(); run(p, 0.1, { x: 0, z: 0 });
  run(p, 0.2, { x: 0, z: 0 }, [floor], true); assert.ok(p.feet.y > 0.8);
  const velocity = p.verticalSpeed;
  p.update(1 / 120, { x: 0, z: 0 }, F, R, true, [floor]);
  assert.ok(p.verticalSpeed < velocity);
  run(p, 1, { x: 0, z: 0 }); assert.equal(p.feet.y, 0); assert.equal(p.grounded, true);
});
test('ceiling stops upward movement', () => {
  const p = new CharacterController();
  const ceiling = { box: boxAt([0, 2.1, 0], [10, 0.2, 10]) };
  run(p, 0.1, { x: 0, z: 0 }, [floor, ceiling]);
  let peak = 0;
  for (let i = 0; i < 80; i++) { p.update(1 / 120, { x: 0, z: 0 }, F, R, i === 0, [floor, ceiling]); peak = Math.max(peak, p.feet.y); }
  assert.ok(peak <= 0.200001); assert.equal(p.feet.y, 0);
});
test('axis separation permits wall sliding', () => {
  const p = new CharacterController(); const wall = { box: boxAt([1, 1, 0], [0.2, 2, 20]) };
  run(p, 1, { x: 1, z: 1 }, [floor, wall]);
  assert.ok(p.feet.x <= 0.70001); assert.ok(p.feet.z > 3);
});
test('only flagged stairs auto-step, with headroom', () => {
  const stair = { box: boxAt([0, 0.1, 1], [2, 0.2, 1]), autoSteppable: true };
  const p = new CharacterController(); run(p, 0.25, { x: 0, z: 1 }, [floor, stair]);
  assert.ok(p.feet.z > 0.5); assert.equal(p.feet.y, 0.2);
  const q = new CharacterController(); run(q, 0.25, { x: 0, z: 1 }, [floor, { ...stair, autoSteppable: false }]);
  assert.ok(q.feet.z < 0.31); assert.equal(q.feet.y, 0);
  const r = new CharacterController();
  const ceiling = { box: boxAt([0, 2, 1], [2, 0.2, 1]) };
  run(r, 0.25, { x: 0, z: 1 }, [floor, stair, ceiling]); assert.ok(r.feet.z < 0.31);
});
test('walking off a platform clears grounded and cannot jump in the air', () => {
  const p = new CharacterController(); p.reset(new Vector3(0, 1, 0));
  const platform = { box: boxAt([0, 0.5, 0], [1, 1, 1]) };
  run(p, 0.3, { x: 0, z: 1 }, [floor, platform]);
  assert.equal(p.grounded, false); assert.ok(p.feet.y < 1);
  p.update(1 / 120, { x: 0, z: 1 }, F, R, true, [floor, platform]); assert.ok(p.verticalSpeed < 0);
});
test('reset clears falling and step camera state', () => {
  const p = new CharacterController(); p.verticalSpeed = -10; p.eyeStepOffset = -0.3; p.grounded = true;
  p.reset(new Vector3(3, 2, 1)); assert.equal(p.verticalSpeed, 0); assert.equal(p.eyeStepOffset, 0); assert.equal(p.grounded, false);
});
test('fixed simulation produces equal travel at 30, 60 and 120 render FPS', () => {
  const values = [30, 60, 120].map(fps => {
    const p = new CharacterController(); let accumulator = 0;
    for (let i = 0; i < fps; i++) {
      accumulator += 1 / fps;
      while (accumulator >= 1 / 120 - 1e-10) { p.update(1 / 120, { x: 0, z: 1 }, F, R, false, [floor]); accumulator -= 1 / 120; }
    }
    return p.feet.z;
  });
  assert.ok(values.every(value => Math.abs(value - 4.5) < 1e-6));
});
