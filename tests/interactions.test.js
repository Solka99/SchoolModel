import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3, Scene } from 'three';
import { InteractionSystem } from '../src/interaction/InteractionSystem.js';
import { approach } from '../src/objects/StudentDesk.js';
import { boxAt } from '../src/physics/Aabb.js';
import { CharacterController } from '../src/physics/CharacterController.js';
import { TargetHighlight } from '../src/interaction/TargetHighlight.js';

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

test('chair pick bounds cover mesh gaps, while walls still occlude them', () => {
  const camera = new PerspectiveCamera(); camera.position.set(0, 1, 0); camera.lookAt(0, 1, -1); camera.updateMatrixWorld();
  const chair = new Group(); chair.userData.owner = { interactable: true, pickBounds: boxAt([0, 1, -1.5], [0.5, 1, 0.5]) };
  const system = new InteractionSystem({});
  assert.equal(system.findTarget(camera, [chair]), chair.userData.owner);
  const wall = new Mesh(new BoxGeometry(2, 3, 0.2), new MeshBasicMaterial()); wall.position.set(0, 1, -0.7); wall.updateMatrixWorld();
  assert.equal(system.findTarget(camera, [chair, wall]), null);
  chair.userData.owner.pickBounds.translate(new Vector3(0, 0, -2));
  assert.equal(system.findTarget(camera, [chair]), null);
});

test('activation rechecks aim and range instead of using a stale target; busy objects do not activate', () => {
  const camera = new PerspectiveCamera(); camera.position.set(0, 1, 0); camera.lookAt(0, 1, -1); camera.updateMatrixWorld();
  const target = new Mesh(new BoxGeometry(1, 2, 0.1), new MeshBasicMaterial()); target.position.set(0, 1, -1.5); target.updateMatrixWorld();
  let count = 0; const owner = { interactable: true, canInteract: false, interact: () => count++ }; target.userData.owner = owner;
  const system = new InteractionSystem({ view: { camera }, world: { pickables: [target] } });
  assert.equal(system.activate(), false); assert.equal(count, 0);
  owner.canInteract = true; assert.equal(system.activate(), true); assert.equal(count, 1);
  system.target = owner; target.position.z = -5; target.updateMatrixWorld();
  assert.equal(system.activate(), false); assert.equal(count, 1);
  system.editing = {}; assert.equal(system.activate(), false);
});

test('seating blocks other actions and standing restores view with a clear fallback position', () => {
  const game = { player: new CharacterController(), view: { yaw: 0.5, pitch: 0.1 }, hud: { mode() {} },
    world: { school: { spawn: [-5, 0, 0] }, colliders: [] }, editor: { open() { throw new Error('Must not edit while seated'); } } };
  game.player.reset(new Vector3(0, 0, 1));
  const chair = { seat: new Vector3(2, 0.46, 3), facing: Math.PI / 2 };
  const system = new InteractionSystem(game);
  assert.equal(system.sit(chair), true); assert.equal(system.sit(chair), false);
  assert.equal(system.edit({}), false); assert.equal(system.activate(), false);
  game.world.colliders.push({ box: boxAt([1, 1, 2], [6, 2, 6]) });
  system.stand(); assert.equal(system.seated, null);
  assert.deepEqual(game.player.feet.toArray(), [-5, 0, 0]); assert.equal(game.player.verticalSpeed, 0);
  assert.equal(game.view.yaw, 0.5); assert.equal(game.view.pitch, 0.1);
});

test('target outline follows moved geometry, clears, and releases its scene reference', () => {
  const scene = new Scene(), highlight = new TargetHighlight(scene);
  const root = new Group(); root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  highlight.show({ root }); const before = highlight.box.getCenter(new Vector3()).clone();
  root.position.x = 10; highlight.show({ root });
  assert.ok(highlight.box.getCenter(new Vector3()).x - before.x > 9.9);
  assert.equal(highlight.helper.visible, true); highlight.clear(); assert.equal(highlight.helper.visible, false);
  highlight.dispose(); assert.equal(scene.children.length, 0);
});
test('animation approach clamps exact endpoints across frame partitions', () => {
  for (const fps of [30, 60, 120]) {
    let value = 0; for (let i = 0; i < fps; i++) value = approach(value, 95, 220 / fps);
    assert.equal(value, 95);
    for (let i = 0; i < fps; i++) value = approach(value, 0, 220 / fps);
    assert.equal(value, 0);
  }
});
