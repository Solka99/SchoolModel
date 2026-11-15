import { Group } from 'three';
import { schoolLayout } from '../config/school.js';
import { Classroom } from './Classroom.js';
import { Corridor } from './Corridor.js';
import { CornerConnector } from './CornerConnector.js';
import { Sign } from '../objects/Sign.js';
import { createObstacles, KeyPickup } from '../gameplay/Obstacles.js';

export class School {
  constructor(models, values, { challenge = false, game = null } = {}) {
    this.layout = schoolLayout(values); this.params = this.layout.params;
    this.root = new Group(); this.root.name = 'school-ground-floor'; this.objects = []; this.rooms = [];
    this.spawn = this.layout.spawn; this.corridors = []; this.gates = []; this.activeKey = null;
    try {
      for (const spec of this.layout.rooms) {
        const classroom = new Classroom(models, { ...this.params, doorOnLeft: spec.side === 1 }, { outsideLanding: false, label: `Room ${spec.number}` });
        for (const object of classroom.objects) {
          if (object.interactable && object.kind !== 'light-switch') object.label += ` · Room ${spec.number}`;
        }
        const corridor = this.layout.corridors[spec.corridorIndex];
        const keyX = -spec.side * (this.layout.metrics.roomWidth / 2 - 1.1);
        const keyZ = this.layout.metrics.doorCenterZ + 0.65;
        const cos = Math.cos(spec.yaw), sin = Math.sin(spec.yaw);
        const keyPosition = [
          spec.origin[0] + cos * keyX + sin * keyZ,
          0.32,
          spec.origin[2] - sin * keyX + cos * keyZ,
        ];
        this.rooms.push({ ...spec, keyPosition, corridor: corridor.index, classroom }); this.objects.push(...classroom.objects);
        classroom.place(spec.origin, spec.yaw); this.root.add(classroom.root);
        // Visible on the room side, to identify a classroom after entering it.
        const signZ = this.layout.metrics.zFront + 0.06;
        const sign = new Sign(`inside-sign-${spec.number}`, [
          spec.origin[0] + Math.sin(spec.yaw) * signZ, 2.7,
          spec.origin[2] + Math.cos(spec.yaw) * signZ,
        ], {
          title: `ROOM ${spec.number}`, subtitle: spec.subject.toUpperCase(), width: 2, height: 0.45, yaw: spec.yaw,
        });
        this.objects.push(sign); this.root.add(sign.root);
      }
      for (const spec of this.layout.corridors) {
        const corridor = new Corridor(this.layout, spec, game, challenge);
        this.corridors.push(corridor); this.objects.push(...corridor.objects); this.root.add(corridor.root);
        if (corridor.gate) this.gates.push(corridor.gate);
      }
      this.corners = this.layout.corners.map(spec => {
        const corner = new CornerConnector(this.params.corridorWidth, this.params.roomHeight, spec.center, spec.yaw);
        this.objects.push(corner); this.root.add(corner.root); return corner;
      });
      this.corridor = this.corridors[0];
      if (challenge) {
        this.obstacles = createObstacles(this.layout, game, this.layout.corridors);
        for (const object of this.obstacles.objects) { this.objects.push(object); this.root.add(object.root); }
      }
      this.root.updateMatrixWorld(true);
    } catch (error) { for (const object of this.objects) object.dispose(); throw error; }
  }
  spawnKey(room, game) {
    if (!room || this.activeKey) throw new Error('A key is already active or its classroom is missing.');
    const key = new KeyPickup(room.keyPosition, room, game);
    this.activeKey = key; this.objects.push(key); this.root.add(key.root); return key;
  }
  locationAt(position) {
    const room = this.rooms.find(r => {
      const dx = position.x - r.origin[0], dz = position.z - r.origin[2];
      const x = Math.cos(r.yaw) * dx - Math.sin(r.yaw) * dz;
      const z = Math.sin(r.yaw) * dx + Math.cos(r.yaw) * dz;
      return x > r.localBounds.minX && x < r.localBounds.maxX &&
        z > r.localBounds.minZ && z < r.localBounds.maxZ;
    });
    if (room) return `ROOM ${room.number} / ${room.subject.toUpperCase()}`;
    for (const corridor of this.layout.corridors) {
      const dx = position.x - corridor.center[0], dz = position.z - corridor.center[2];
      const localX = Math.cos(corridor.yaw) * dx - Math.sin(corridor.yaw) * dz;
      const localZ = Math.sin(corridor.yaw) * dx + Math.cos(corridor.yaw) * dz;
      if (Math.abs(localX) < this.params.corridorWidth / 2 &&
          Math.abs(localZ) < this.layout.length / 2) return corridor.name.toUpperCase();
    }
    return 'GROUND FLOOR / SCHOOL ENTRANCE';
  }
}
