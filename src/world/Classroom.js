import { Group } from 'three';
import { DEFAULTS, normalizeParams, computeMetrics } from '../config/classroom.js';
import { HStack, VStack } from './Layout.js';
import { roomBox, PALETTE as C } from './prefabs.js';
import { Chair } from '../objects/Chair.js';
import { StudentDesk } from '../objects/StudentDesk.js';
import { Door } from '../objects/Door.js';
import { Blackboard } from '../objects/Blackboard.js';

export function seatingSlots(p, m) {
  const sections = new HStack(p.aisleWidth);
  for (let section = 0; section < p.seatSections; section++) {
    sections.add([m.sectionWidth, 0, m.seatingDepth], origin => {
      const slots = [];
      for (let row = 0; row < p.seatRows; row++) for (let col = 0; col < p.seatCols; col++) {
        const x = origin[0] + col * (p.seatSlotWidth + p.seatColGap) + p.seatSlotWidth / 2;
        const y = (row + 1) * p.rowHeight;
        const z = origin[2] + row * m.rowDepth;
        // Native slot origin plus slotDepth/2 places the chair at rowDepth-0.25.
        slots.push({ section, row, col, desk: [x, y, z], chair: [x, y, z + m.rowDepth - 0.25] });
      }
      return slots;
    });
  }
  return sections.build([-m.seatingWidth / 2, 0, p.seatStartZ]);
}
export function tierSlots(p, m) {
  const steps = new VStack();
  for (let row = 0; row < p.seatRows; row++) steps.add([m.roomWidth, p.rowHeight, m.rowDepth], origin => {
    const depth = row === p.seatRows - 1 ? m.zBack - origin[2] : m.rowDepth;
    return [{ row, center: [0, p.rowHeight * (row + 0.5), origin[2] + depth / 2], size: [m.roomWidth, p.rowHeight, depth] }];
  });
  return steps.build([0, 0, p.seatStartZ]);
}
export class Classroom {
  constructor(models, values = DEFAULTS) {
    this.params = normalizeParams(values); this.metrics = computeMetrics(this.params);
    this.root = new Group(); this.root.name = 'lecture-hall'; this.objects = [];
    try { this.build(models); } catch (error) { for (const o of this.objects) o.dispose(); throw error; }
  }
  add(object) { this.objects.push(object); this.root.add(object.root); return object; }
  box(name, center, size, color, options) { return this.add(roomBox(name, center, size, color, options)); }
  build(models) {
    const p = this.params, m = this.metrics;
    this.box('floor', [0, -0.1, m.centerZ], [m.roomWidth, 0.2, m.roomDepth], C.floor);
    this.box('ceiling', [0, p.roomHeight + 0.1, m.centerZ], [m.roomWidth, 0.2, m.roomDepth], C.ceiling);
    for (const z of [m.zFront - 0.1, m.zBack + 0.1]) this.box('wall', [0, p.roomHeight / 2, z], [m.roomWidth + 0.4, p.roomHeight, 0.2], C.wall);
    for (const side of [-1, 1]) {
      const x = side * (m.roomWidth / 2 + 0.1);
      if ((side === -1) !== p.doorOnLeft) {
        this.box('side-wall', [x, p.roomHeight / 2, m.centerZ], [0.2, p.roomHeight, m.roomDepth], C.wall);
      } else {
        const start = m.doorCenterZ - 0.5, end = m.doorCenterZ + 0.5;
        if (start > m.zFront) this.box('door-wall-front', [x, p.roomHeight / 2, (m.zFront + start) / 2], [0.2, p.roomHeight, start - m.zFront], C.wall);
        this.box('door-wall-back', [x, p.roomHeight / 2, (m.zBack + end) / 2], [0.2, p.roomHeight, m.zBack - end], C.wall);
        this.box('door-lintel', [x, (p.roomHeight + 2) / 2, m.doorCenterZ], [0.2, p.roomHeight - 2, 1], C.wall);
        this.door = this.add(new Door(models, [x, 1, m.doorCenterZ], { sign: -side }));
        this.box('outside-landing', [x + side * 3, -0.1, m.doorCenterZ], [6.45, 0.2, 6], C.floor);
        // Thin reveal trim frames the existing opening without narrowing it.
        for (const dz of [-0.57, 0.57]) this.box('door-trim', [x - side * 0.115, 1.05, m.doorCenterZ + dz], [0.035, 2.1, 0.07], C.wood, { solid: false });
        this.box('door-trim-top', [x - side * 0.115, 2.09, m.doorCenterZ], [0.035, 0.08, 1.2], C.wood, { solid: false });
      }
    }
    this.blackboard = this.add(new Blackboard([0, 1.6, m.zFront + 0.03], p.blackboardWidth, p.blackboardHeight));
    this.box('teacher-desk', [0, 0.4, 0], [1.8, 0.8, 0.7], C.wood);
    this.add(new Chair(models, [0, 0, Math.max(-1.6, m.zFront + 0.35)], true));
    for (const t of tierSlots(p, m)) {
      this.box('seating-tier', t.center, t.size, C.step, { autoSteppable: true });
      // A fine nosing makes each riser readable, without altering collision.
      this.box('step-edge', [0, t.center[1] + 0.102, t.center[2] - t.size[2] / 2 + 0.025], [m.roomWidth, 0.008, 0.05], '#c1b596', { solid: false });
    }
    for (const slot of seatingSlots(p, m)) {
      this.add(new StudentDesk(models, slot.desk)); this.add(new Chair(models, slot.chair));
    }
    // Simple visual trim and ceiling strips retain the room's original shell.
    this.box('front-wainscot', [0, 0.42, m.zFront + 0.015], [m.roomWidth, 0.84, 0.035], C.trim, { solid: false });
    for (const side of [-1, 1]) {
      const x = side * (m.roomWidth / 2 - 0.02);
      const start = m.doorCenterZ + 0.65;
      this.box('side-wainscot', [x, 0.42, (start + m.zBack) / 2], [0.035, 0.84, m.zBack - start], C.trim, { solid: false });
    }
    for (const x of [-m.seatingWidth / 3, 0, m.seatingWidth / 3]) {
      const strip = this.box('ceiling-light', [x, p.roomHeight - 0.03, m.centerZ], [0.12, 0.04, m.roomDepth - 2], '#fff5d8', { solid: false });
      strip.mesh.material.emissive.set('#fff1cb'); strip.mesh.material.emissiveIntensity = 1;
    }
    this.root.updateMatrixWorld(true);
  }
}
