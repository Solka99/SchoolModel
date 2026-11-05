import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Door } from '../src/objects/Door.js';
import { StudentDesk } from '../src/objects/StudentDesk.js';
import { boxAt, penetrates } from '../src/physics/Aabb.js';

const templates = new Map();
for (const name of ['door', 'door_handle', 'student_desk_stand', 'student_desk_desk']) {
  const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  templates.set(name, gltf.scene);
}
const models = { clone: name => templates.get(name).clone(true) };

test('converted door geometry fits both authored doorway orientations', () => {
  for (const alongZ of [true, false]) {
    const door = new Door(models, [2, 1, 3], { alongZ });
    const center = door.panelCollider.box.getCenter(new Vector3());
    assert.ok(center.distanceTo(new Vector3(2, 1, 3)) < 1e-5);
    const size = door.panelCollider.box.getSize(new Vector3());
    assert.ok(Math.abs(size.y - 2) < 1e-5);
    assert.ok(Math.abs((alongZ ? size.z : size.x) - 1) < 1e-5);
  }
});
test('door debounces handle presses, opens fully, and remains solid while open', () => {
  const door = new Door(models, [0, 1, 0]); door.interact(); door.interact();
  door.update(1 / 120); assert.equal(door.angle, 0); assert.ok(door.handleAngle < 0);
  for (let i = 0; i < 120; i++) door.update(1 / 120);
  assert.equal(door.angle, 95); assert.equal(door.open, true); assert.equal(door.colliders.length, 1);
  assert.ok(!door.panelCollider.box.isEmpty());
  door.interact(); for (let i = 0; i < 120; i++) door.update(1 / 120);
  assert.equal(door.angle, 0); assert.equal(door.handleAngle, 0);
});
test('closing door waits when the player obstructs its panel', () => {
  const door = new Door(models, [0, 1, 0], { alongZ: false });
  door.interact(); for (let i = 0; i < 120; i++) door.update(1 / 120);
  const player = boxAt([0, 0.9, 0], [0.4, 1.8, 0.4]);
  assert.equal(penetrates(player, door.panelCollider.box), false);
  door.interact(); for (let i = 0; i < 120; i++) door.update(1 / 120, player);
  assert.ok(door.angle > 0); assert.equal(penetrates(player, door.panelCollider.box), false);
  for (let i = 0; i < 120; i++) door.update(1 / 120);
  assert.equal(door.angle, 0);
});
test('actual desk mesh keeps its support fixed while the writing surface folds', () => {
  const desk = new StudentDesk(models, [0, 0.2, 2]);
  const stand = desk.supportCollider.box.clone(), closed = desk.topCollider.box.clone();
  desk.interact(); for (let i = 0; i < 60; i++) desk.update(1 / 120);
  assert.equal(desk.angle, 90); assert.equal(desk.supportCollider.box.equals(stand), true);
  assert.equal(desk.topCollider.box.equals(closed), false);
  desk.interact(); for (let i = 0; i < 60; i++) desk.update(1 / 120);
  assert.equal(desk.angle, 0); assert.equal(desk.topCollider.box.equals(closed), true);
});
