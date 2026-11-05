import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Vector3 } from 'three';
import { boxAt, penetrates, playerBox } from '../src/physics/Aabb.js';

test('touching faces are not penetration; a small overlap is', () => {
  const floor = boxAt([0, -0.1, 0], [10, 0.2, 10]);
  assert.equal(penetrates(playerBox(new Vector3()), floor), false);
  assert.equal(penetrates(playerBox(new Vector3(0, -0.01, 0)), floor), true);
});
test('degenerate collision boxes do not block the character', () => {
  assert.equal(penetrates(playerBox(new Vector3()), boxAt([0, 1, 0], [0, 1, 1])), false);
  assert.equal(penetrates(boxAt([0, 1, 0], [0, 1, 1]), playerBox(new Vector3())), false);
});
test('a hinge rotation transforms the bounds and center together', () => {
  const panel = boxAt([0.5, 1, 0], [1, 2, 0.1]);
  panel.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2));
  const center = panel.getCenter(new Vector3()), size = panel.getSize(new Vector3());
  assert.ok(Math.abs(center.z + 0.5) < 1e-6);
  assert.ok(Math.abs(size.x - 0.1) < 1e-6);
  assert.ok(Math.abs(size.z - 1) < 1e-6);
});
