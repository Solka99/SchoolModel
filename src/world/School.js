import { Group } from 'three';
import { schoolLayout } from '../config/school.js';
import { Classroom } from './Classroom.js';
import { Corridor } from './Corridor.js';
import { Sign } from '../objects/Sign.js';

export class School {
  constructor(models, values) {
    this.layout = schoolLayout(values); this.params = this.layout.params;
    this.root = new Group(); this.root.name = 'school-ground-floor'; this.objects = []; this.rooms = [];
    this.spawn = this.layout.spawn;
    try {
      for (const spec of this.layout.rooms) {
        const classroom = new Classroom(models, { ...this.params, doorOnLeft: spec.side === 1 }, { outsideLanding: false, label: `Room ${spec.number}` });
        for (const object of classroom.objects) {
          if (object.interactable && object.kind !== 'light-switch') object.label += ` · Room ${spec.number}`;
        }
        this.rooms.push({ ...spec, classroom }); this.objects.push(...classroom.objects);
        classroom.place(spec.origin); this.root.add(classroom.root);
        // Visible on the room side, to identify a classroom after entering it.
        const sign = new Sign(`inside-sign-${spec.number}`, [spec.origin[0], 2.7, spec.bounds.minZ + 0.06], {
          title: `ROOM ${spec.number}`, subtitle: spec.subject.toUpperCase(), width: 2, height: 0.45,
        });
        this.objects.push(sign); this.root.add(sign.root);
      }
      this.corridor = new Corridor(models, this.layout);
      this.objects.push(...this.corridor.objects); this.root.add(this.corridor.root);
      this.root.updateMatrixWorld(true);
    } catch (error) { for (const object of this.objects) object.dispose(); throw error; }
  }
  locationAt(position) {
    const room = this.rooms.find(r => position.x > r.bounds.minX && position.x < r.bounds.maxX && position.z > r.bounds.minZ && position.z < r.bounds.maxZ);
    if (room) return `ROOM ${room.number} / ${room.subject.toUpperCase()}`;
    return position.z < this.layout.entranceDepth ? 'GROUND FLOOR / MAIN ENTRANCE' : 'GROUND FLOOR / MAIN CORRIDOR';
  }
}
