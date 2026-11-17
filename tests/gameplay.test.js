import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Timer } from '../src/gameplay/Timer.js';
import { GameManager } from '../src/gameplay/GameManager.js';
import { MovingObstacle, TeacherDeskObstacle, KeyedGate, createObstacles } from '../src/gameplay/Obstacles.js';
import { boxAt, penetrates } from '../src/physics/Aabb.js';

const room = { number: '103', subject: 'Literature', bounds: { minX: 2.4, maxX: 17.1, minZ: 19.85, maxZ: 33.3 } };
const inside = new Vector3(3, 0, 21), outside = new Vector3(0, 0, 1.5);
test('timer formats, clamps expiry, and resets without negative time', () => {
  const timer = new Timer(45); assert.equal(timer.display, '00:45');
  timer.advance(0.1); assert.equal(timer.display, '00:45');
  timer.advance(1); assert.equal(timer.display, '00:44');
  timer.advance(99); assert.equal(timer.display, '00:00'); assert.equal(timer.expired, true);
  timer.reset(); assert.equal(timer.remaining, 45);
});
test('ready and paused runs do not consume time; full active deltas do', () => {
  const game = new GameManager(); game.prepare(room);
  game.update(10, outside); assert.equal(game.timer.remaining, 45);
  game.start(); game.update(3.7, outside); assert.equal(game.timer.remaining, 41.3);
  game.pause(); game.update(100, outside); assert.equal(game.timer.remaining, 41.3);
  game.start(); game.update(4, outside); assert.ok(Math.abs(game.timer.remaining - 37.3) < 1e-6);
});
test('challenge uses the selected duration and resets to that duration', () => {
  const game = new GameManager();
  game.prepare(room, 90);
  assert.equal(game.timer.duration, 90);
  assert.equal(game.timer.remaining, 90);
  game.start(); game.update(12, outside); game.pause();
  game.prepare(room, 90);
  assert.equal(game.timer.remaining, 90);
});
test('countdown is independent of render-frame partitions', () => {
  for (const fps of [30, 60, 120]) {
    const game = new GameManager(); game.prepare(room); game.start();
    for (let i = 0; i < fps * 3; i++) game.update(1 / fps, outside);
    assert.ok(Math.abs(game.timer.remaining - 42) < 1e-8);
  }
});
test('only fully entering the designated classroom wins', () => {
  const game = new GameManager(); game.prepare(room); game.start();
  game.update(1, new Vector3(-9, 0, 10)); assert.equal(game.state, 'running');
  game.update(1, new Vector3(2.5, 0, 21)); assert.equal(game.state, 'running');
  game.update(1, inside); assert.equal(game.state, 'won');
  const remaining = game.timer.remaining; game.update(100, outside); assert.equal(game.timer.remaining, remaining);
});
test('deadline wins over arrival; penalties can end a run and cannot affect finished runs', () => {
  const game = new GameManager(); game.prepare(room, 2); game.start(); game.update(2, inside);
  assert.equal(game.state, 'lost'); assert.equal(game.penalize(2), false);
  game.prepare(room, 3); game.start(); assert.equal(game.penalize(2), true); assert.equal(game.hits, 1);
  assert.equal(game.timer.remaining, 1); game.penalize(2); assert.equal(game.state, 'lost'); assert.equal(game.penaltySeconds, 4);
  game.prepare(room); assert.equal(game.state, 'ready'); assert.equal(game.timer.remaining, 45); assert.equal(game.hits, 0);
  game.reset(); assert.equal(game.state, 'idle'); assert.equal(game.target, null);
});
test('one key unlocks only the next corridor gate and exposes the next reachable section', () => {
  const game = new GameManager();
  game.prepare({ ...room, corridorIndex: 2 }); game.start();
  assert.equal(game.nextGateIndex, 0); assert.equal(game.reachableCorridors, 1);
  assert.equal(game.unlockGate({ index: 0 }), false);
  assert.equal(game.collectKey('101'), true); assert.equal(game.hasKey, true);
  assert.equal(game.unlockGate({ index: 1 }), false);
  assert.equal(game.unlockGate({ index: 0 }), true);
  assert.equal(game.hasKey, false); assert.equal(game.nextGateIndex, 1); assert.equal(game.reachableCorridors, 2);
  assert.equal(game.collectKey('102'), true); assert.equal(game.unlockGate({ index: 1 }), true);
  assert.equal(game.nextGateIndex, null); assert.equal(game.reachableCorridors, 3);
});
test('keyed corridor barrier rises vertically and clears its collision bounds', () => {
  const rush = new GameManager();
  rush.prepare({ ...room, corridorIndex: 1 }); rush.start(); rush.collectKey('101');
  let opened = false;
  const gate = new KeyedGate(4.32, [0, 0, 0], 0, {
    rush, hud: { toast() {} }, onGateUnlocked() { opened = true; },
  });
  const player = boxAt([0, 0.9, 0], [0.4, 1.8, 0.4]);
  const closedBounds = gate.collider.box.clone();
  assert.equal(penetrates(player, closedBounds), true);
  gate.interact();
  assert.equal(opened, true); assert.equal(rush.hasKey, false); assert.equal(gate.unlocked, true);
  gate.update(0.5);
  assert.ok(gate.lift > 0 && gate.collider.box.min.y > closedBounds.min.y);
  assert.ok(penetrates(player, gate.collider.box), 'Barrier still blocks the passage while rising');
  gate.update(0.5);
  assert.equal(gate.lift, gate.openHeight);
  assert.equal(gate.moving, false);
  assert.equal(penetrates(player, gate.collider.box), false, 'Raised barrier clears the walking path');
  assert.ok(gate.panel.position.y > 1.1, 'Barrier translates upward instead of rotating');
  gate.dispose();
});
test('moving obstacles move deterministically and stop rather than pushing through the player', () => {
  const a = new MovingObstacle(4.4, [0, 0, 6.45]), b = new MovingObstacle(4.4, [0, 0, 6.45]);
  for (let i = 0; i < 120; i++) a.update(1 / 120);
  for (let i = 0; i < 60; i++) b.update(1 / 60);
  assert.ok(Math.abs(a.root.position.x - b.root.position.x) < 1e-6);
  const obstacle = new MovingObstacle(4.4, [0, 0, 6.45]), player = boxAt([0.6, 0.9, 6.45], [0.4, 1.8, 0.4]);
  let contacts = 0;
  for (let i = 0; i < 120; i++) { obstacle.update(1 / 120, player); if (obstacle.contact) contacts++; }
  assert.equal(contacts, 1); assert.equal(penetrates(obstacle.collider.box, player), false);
  assert.ok(obstacle.elapsed < 0.1); // Its phase freezes too, preventing a later teleport across the player.
  assert.equal(obstacle.root.name, 'moving-obstacle');
  assert.equal(obstacle.label, 'Moving obstacle');
  assert.equal(obstacle.root.children.length, 5, 'The obstacle has one body and four wheels');
  a.dispose(); b.dispose(); obstacle.dispose();
});
test('moving obstacles follow the orientation of a turned corridor', () => {
  const obstacle = new MovingObstacle(4.4, [0, 0, 0], Math.PI / 2);
  const before = obstacle.root.position.clone(); obstacle.update(0.25);
  assert.ok(Math.abs(obstacle.root.position.z - before.z) > 0.1);
  assert.ok(Math.abs(obstacle.root.position.x - before.x) < 1e-6);
  obstacle.dispose();
});
test('each corridor has a line of three side-to-side moving obstacles, with no timed passage', () => {
  const layout = {
    params: { corridorWidth: 4.4 },
    corridors: Array.from({ length: 4 }, (_, index) => ({
      index, length: 18, yaw: index * Math.PI / 2, center: [index * 18, 0, 0],
    })),
  };
  const obstacles = createObstacles(layout, {}, layout.corridors);
  assert.equal(obstacles.movingObstacles.length, 12);
  assert.equal(obstacles.objects.some(object => object.kind === 'timed-passage'), false);
  assert.equal(new Set(obstacles.movingObstacles.map(obstacle => obstacle.root.position.z)).size > 1, true);
  for (const object of obstacles.objects) object.dispose();
});
test('a reused teacher desk leaves a walkable lane even in the narrowest corridor', () => {
  const obstacle = new TeacherDeskObstacle(3);
  assert.equal(obstacle.parts[0].root.name, 'teacher-desk');
  assert.deepEqual(obstacle.parts[0].mesh.scale.toArray(), [1.8, 0.8, 0.7]);
  assert.ok(1.5 - obstacle.colliders[0].box.max.x > 0.8);
  assert.equal(penetrates(obstacle.colliders[0].box, boxAt([1.1, 0.9, 0], [0.4, 1.8, 0.4])), false);
  assert.equal(obstacle.colliders[0].autoSteppable, false); obstacle.dispose();
});
