import { Group } from 'three';
import { roomBox, PALETTE as C } from './prefabs.js';
import { Door } from '../objects/Door.js';
import { Sign } from '../objects/Sign.js';
import { uncoveredSegments } from '../config/school.js';

export class Corridor {
  constructor(models, layout) {
    this.root = new Group(); this.root.name = 'main-corridor'; this.objects = [];
    const { params: p, length, rooms } = layout;
    const half = p.corridorWidth / 2, h = p.roomHeight;
    this.box('corridor-floor', [0, -0.1, length / 2], [p.corridorWidth, 0.2, length], C.floor);
    this.box('corridor-ceiling', [0, h + 0.1, length / 2], [p.corridorWidth, 0.2, length], C.ceiling);
    for (const side of [-1, 1]) {
      const covered = rooms.filter(r => r.side === side).map(r => [r.bounds.minZ, r.bounds.maxZ]);
      for (const [a, b] of uncoveredSegments(0, length, covered)) {
        this.box('corridor-wall', [side * (half + 0.1), h / 2, (a + b) / 2], [0.2, h, b - a], C.wall);
        this.box('corridor-trim', [side * (half - 0.015), 0.42, (a + b) / 2], [0.035, 0.84, b - a], C.trim, { solid: false });
      }
    }
    this.box('corridor-end-wall', [0, h / 2, length + 0.1], [p.corridorWidth + 0.4, h, 0.2], C.wall);
    // Entrance wall, with the same one-unit doorway used by the source models.
    for (const side of [-1, 1]) {
      const width = half - 0.5;
      this.box('entrance-wall', [side * (0.5 + width / 2), h / 2, -0.1], [width, h, 0.2], C.wall);
    }
    this.box('entrance-lintel', [0, (h + 2) / 2, -0.1], [1, h - 2, 0.2], C.wall);
    this.entranceDoor = this.add(new Door(models, [0, 1, -0.1], { alongZ: false, sign: 1 }));
    this.box('entrance-landing', [0, -0.1, -3], [p.corridorWidth + 2, 0.2, 6], '#a6ad95');
    this.box('entrance-canopy', [0, 2.9, -1.4], [p.corridorWidth + 1.2, 0.14, 2.8], C.wood, { solid: false });
    this.add(new Sign('entrance-sign', [0, 2.5, -0.205], { title: 'SCHOOL RUSH', subtitle: 'MAIN ENTRANCE · GROUND FLOOR', width: 2.8, height: 0.6, yaw: Math.PI }));
    this.add(new Sign('exit-sign', [0, 2.45, 0.015], { title: 'EXIT', subtitle: 'MAIN ENTRANCE', width: 1.1, height: 0.4 }));
    this.add(new Sign('corridor-directory', [0, 2.2, length - 0.005], { title: 'GROUND FLOOR', subtitle: rooms.map(r => r.number).join('  /  '), width: 2.6, height: 0.8, yaw: Math.PI }));
    for (const room of rooms) {
      this.box('doorway-threshold', [room.door[0], -0.1, room.door[2]], [0.2, 0.2, 1], C.floor);
      this.add(new Sign(`room-sign-${room.number}`, [room.side * (half - 0.015), 2.4, room.door[2]], {
        title: room.number, subtitle: room.subject.toUpperCase(), yaw: -room.side * Math.PI / 2,
      }));
      // Smaller directional label next to each opening stays visible at eye level.
      this.add(new Sign(`room-marker-${room.number}`, [room.side * (half - 0.016), 1.55, room.door[2] + 1.05], {
        title: `ROOM ${room.number}`, subtitle: 'CLASSROOM', width: 0.65, height: 0.3, yaw: -room.side * Math.PI / 2, light: true,
      }));
    }
    for (const side of [-1, 1]) {
      const x = side * (half - 0.4);
      this.box('entrance-bench-seat', [x, 0.46, 3.2], [0.5, 0.12, 1.8], C.wood);
      for (const z of [2.6, 3.8]) this.box('entrance-bench-leg', [x, 0.2, z], [0.35, 0.4, 0.1], '#45534a');
    }
    this.add(new Sign('school-noticeboard', [-half + 0.015, 1.7, 3.2], {
      title: 'WELCOME TO SCHOOL', subtitle: rooms.map(r => `${r.number} ${r.subject}`).join('  ·  '), width: 2.2, height: 0.8, yaw: Math.PI / 2, light: true,
    }));
    this.box('corridor-guide-line', [0, 0.003, length / 2], [0.045, 0.005, length - 1], '#b9ab7d', { solid: false });
    for (let z = 2; z < length; z += 4) {
      const light = this.box('corridor-light', [0, h - 0.03, z], [0.25, 0.04, 1.8], '#fff2d6', { solid: false });
      light.mesh.material.emissive.set('#fff0cf'); light.mesh.material.emissiveIntensity = 1;
    }
  }
  add(object) { this.objects.push(object); this.root.add(object.root); return object; }
  box(name, center, size, color, options) { return this.add(roomBox(name, center, size, color, options)); }
}
