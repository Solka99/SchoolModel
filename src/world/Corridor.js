import { Group } from 'three';
import { roomBox, PALETTE as C } from './prefabs.js';
import { Sign } from '../objects/Sign.js';
import { corridorWallSegments } from '../config/school.js';
import { LightCircuit } from '../objects/LightCircuit.js';
import { LightSwitch } from '../objects/LightSwitch.js';
import { KeyedGate } from '../gameplay/Obstacles.js';

export class Corridor {
  constructor(layout, spec, game, challenge) {
    this.root = new Group(); this.root.name = `corridor-${spec.index}`;
    this.root.position.set(...spec.center); this.root.rotation.y = spec.yaw;
    this.objects = []; this.index = spec.index; this.length = layout.length;
    const { params: p, rooms } = layout;
    const half = p.corridorWidth / 2, h = p.roomHeight, length = layout.length;
    const wallThickness = 0.2;
    this.box('corridor-floor', [0, -0.1, 0], [p.corridorWidth, 0.2, length], C.floor);
    this.box('corridor-ceiling', [0, h + 0.1, 0], [p.corridorWidth, 0.2, length], C.ceiling);
    const localRooms = rooms.filter(room => room.corridorIndex === spec.index);
    for (const side of [-1, 1]) {
      for (const [a, b] of corridorWallSegments(layout, spec, side)) {
        this.box('corridor-wall', [side * (half + 0.1), h / 2, (a + b) / 2], [0.2, h, b - a], C.wall);
      }
    }
    for (const room of localRooms) {
      const doorZ = room.localOrigin[2] + layout.metrics.doorCenterZ;
      this.box('doorway-threshold', [room.side * (half + 0.1), -0.1, doorZ], [0.2, 0.2, 1], C.floor);
      this.add(new Sign(`room-sign-${room.number}`, [room.side * (half - 0.015), 2.4, doorZ], {
        title: room.number, subtitle: room.subject.toUpperCase(), yaw: -room.side * Math.PI / 2,
      }));
      this.add(new Sign(`room-marker-${room.number}`, [room.side * (half - 0.016), 1.55, doorZ + 1.05], {
        title: `ROOM ${room.number}`, subtitle: 'CLASSROOM', width: 0.65, height: 0.3, yaw: -room.side * Math.PI / 2, light: true,
      }));
    }
    if (spec.index === 0) this.buildEntrance(half, layout.entranceZ);
    if (challenge) {
      const gate = this.add(new KeyedGate(p.corridorWidth - 0.08,
        [0, 0, length / 2 - 0.75], spec.index, game));
      gate.root.traverse(node => { node.userData.owner = gate; });
      this.gate = gate;
      this.add(new Sign(`corridor-gate-${spec.index}`, [0, 2.65, length / 2 - 0.12], {
        title: 'KEY REQUIRED', subtitle: 'NEXT CORRIDOR', width: 2.2, height: 0.45, yaw: Math.PI,
      }));
    }
    for (const side of [-1, 1]) {
      const x = side * (half - 0.4);
      for (const z of [-length / 2 + 0.8, -length / 2 + 1.8]) {
        if (spec.index !== 0) break;
        this.box('entrance-bench-seat', [x, 0.46, z], [0.5, 0.12, 1.1], C.wood);
        this.box('entrance-bench-leg', [x, 0.2, z - 0.4], [0.35, 0.4, 0.1], '#45534a');
      }
    }
    this.add(new Sign(`corridor-directory-${spec.index}`, [0, 2.2, -length / 2 + 5], {
      title: spec.name.toUpperCase(), subtitle: localRooms.map(room => room.number).join('  /  ') || 'SQUARE SCHOOL LOOP',
      width: 2.6, height: 0.8, yaw: Math.PI,
    }));
    this.box('corridor-guide-line', [0, 0.003, 0], [0.045, 0.005, length - 1], '#b9ab7d', { solid: false });
    const fixtures = [];
    for (let z = -length / 2 + 2; z < length / 2; z += 4) {
      const light = this.box('corridor-light', [0, h - 0.03, z], [0.25, 0.04, 1.8], '#fff2d6', { solid: false });
      light.mesh.material.emissive.set('#fff0cf'); light.mesh.material.emissiveIntensity = 1;
      fixtures.push(light.mesh.material);
    }
    const count = Math.ceil(length / 10), height = h - 0.25;
    this.lighting = this.add(new LightCircuit(spec.name, Array.from({ length: count }, (_, i) => ({
      position: [0, height, -length / 2 + (i + 0.5) * length / count], intensity: 32 * (height / 3.75) ** 2,
      distance: Math.max(9, height + 4),
    })), fixtures));
    this.lightSwitch = this.add(new LightSwitch(this.lighting, [half - 0.035, 1.35, -length / 2 + 2.2], -Math.PI / 2));
    this.root.updateMatrixWorld(true);
    for (const object of this.objects) for (const collider of object.colliders) collider.box.applyMatrix4(this.root.matrix);
  }
  buildEntrance(half, entranceZ) {
    const side = -1, wallX = side * (half + 0.1);
    this.box('entrance-threshold', [wallX, -0.1, entranceZ], [0.2, 0.2, 1.2], C.floor);
    this.box('entrance-landing', [side * (half + 3.2), -0.1, entranceZ], [6, 0.2, 3.2], '#a6ad95');
    this.box('entrance-canopy', [side * (half + 1.5), 2.9, entranceZ], [2.8, 0.14, 3], C.wood, { solid: false });
    this.add(new Sign('entrance-sign', [side * (half + 1.5), 2.5, entranceZ], {
      title: 'SCHOOL RUSH', subtitle: 'MAIN ENTRANCE · GROUND FLOOR', width: 2.8, height: 0.6, yaw: -Math.PI / 2,
    }));
  }
  add(object) { this.objects.push(object); this.root.add(object.root); return object; }
  box(name, center, size, color, options) { return this.add(roomBox(name, center, size, color, options)); }
}
