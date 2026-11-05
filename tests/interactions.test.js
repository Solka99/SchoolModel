import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { InteractionSystem } from '../src/interaction/InteractionSystem.js';
import { approach } from '../src/objects/StudentDesk.js';

test('nearest wall occludes target; range and descendant owner resolve', () => {
  const camera = new PerspectiveCamera(); camera.position.set(0, 1, 0); camera.lookAt(0, 1, -1); camera.updateMatrixWorld();
  const target = new Group(); target.userData.owner = { interactable: true, kind: 'door' };
  const mesh = new Mesh(new BoxGeometry(1, 2, 0.1), new MeshBasicMaterial()); mesh.position.set(0, 1, -1.5); target.add(mesh);
  const wall = new Mesh(new BoxGeometry(2, 3, 0.2), new MeshBasicMaterial()); wall.position.set(0, 1, -0.7);
  target.updateMatrixWorld(true); wall.updateMatrixWorld(true);
  const system = new InteractionSystem({});
  assert.equal(system.findTarget(camera, [target, wall]), null);
  assert.equal(system.findTarget(camera, [target]), target.userData.owner);
  target.position.z = -2; target.updateMatrixWorld(true); assert.equal(system.findTarget(camera, [target]), null);
});
test('animation approach clamps exact endpoints across frame partitions', () => {
  for (const fps of [30, 60, 120]) {
    let value = 0; for (let i = 0; i < fps; i++) value = approach(value, 95, 220 / fps);
    assert.equal(value, 95);
    for (let i = 0; i < fps; i++) value = approach(value, 0, 220 / fps);
    assert.equal(value, 0);
  }
});
