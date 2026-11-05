import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { LightCircuit } from '../src/objects/LightCircuit.js';
import { LightSwitch } from '../src/objects/LightSwitch.js';

test('switch changes its actual light sources and fixtures, without touching another circuit', () => {
  const aFixture = new MeshStandardMaterial(), bFixture = new MeshStandardMaterial();
  const a = new LightCircuit('Room 101', [{ position: [0, 3.75, 0], intensity: 65 }], [aFixture]);
  const b = new LightCircuit('Room 102', [{ position: [0, 3.75, 0], intensity: 65 }], [bFixture]);
  const control = new LightSwitch(a, [0, 1.35, 0], Math.PI / 2);
  const originalRotation = control.rocker.rotation.x;
  assert.equal(control.message, 'Switch lights off');
  let notification;
  control.interact({ notify: message => { notification = message; } });
  assert.equal(a.on, false); assert.equal(a.lights[0].intensity, 0); assert.equal(aFixture.emissiveIntensity, 0);
  assert.equal(b.on, true); assert.equal(b.lights[0].intensity, 65); assert.equal(bFixture.emissiveIntensity, 1.2);
  assert.equal(control.message, 'Switch lights on'); assert.match(notification, /Room 101 lights: off/);
  assert.notEqual(control.rocker.rotation.x, originalRotation);
  assert.equal(control.indicator.material.emissiveIntensity, 0);
  assert.equal(a.lights[0].visible, true); assert.equal(a.root.children.length, 1);
  control.interact(); assert.equal(a.lights[0].intensity, 65); assert.equal(control.rocker.rotation.x, originalRotation);
  control.dispose(); aFixture.dispose(); bFixture.dispose();
});
test('room placement moves a lighting rig and switch together', () => {
  const circuit = new LightCircuit('Room 103', [{ position: [1, 3.75, 2] }], []);
  const control = new LightSwitch(circuit, [0, 1.35, 0], -Math.PI / 2);
  const room = new Group(); room.add(circuit.root, control.root); room.position.set(10, 0, 20); room.updateMatrixWorld(true);
  assert.deepEqual(circuit.lights[0].getWorldPosition(new Vector3()).toArray(), [11, 3.75, 22]);
  assert.deepEqual(control.root.getWorldPosition(new Vector3()).toArray(), [10, 1.35, 20]);
  assert.equal(control.colliders.length, 0); control.dispose();
});
