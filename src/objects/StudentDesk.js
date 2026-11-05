import { Box3, Group, MathUtils } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { penetrates } from '../physics/Aabb.js';

export function approach(value, target, delta) {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}
export class StudentDesk extends SceneObject {
  constructor(models, position) {
    super('student-desk'); this.interactable = true; this.kind = 'desk'; this.dynamic = true;
    this.angle = 0; this.open = false; this.root.position.set(...position);
    const outer = new Group(); outer.rotation.y = Math.PI;
    const correction = new Group(); correction.rotation.x = -Math.PI / 2;
    outer.add(correction); this.root.add(outer);
    this.stand = models.clone('student_desk_stand'); correction.add(this.stand);
    this.hinge = new Group(); this.hinge.position.set(0, 0.035, 0.69); correction.add(this.hinge);
    this.tabletop = models.clone('student_desk_desk'); this.hinge.add(this.tabletop);
    this.supportCollider = this.addCollider(new Box3()); this.topCollider = this.addCollider(new Box3());
    this.refresh();
  }
  refresh() {
    this.root.updateMatrixWorld(true);
    this.supportCollider.box.copy(this.meshBounds(this.stand));
    this.topCollider.box.copy(this.meshBounds(this.tabletop));
  }
  get message() { return this.open ? 'Fold desk away' : 'Open writing desk'; }
  interact() { this.open = !this.open; }
  update(dt, playerBox) {
    const previous = this.angle;
    this.angle = approach(this.angle, this.open ? 90 : 0, 300 * dt);
    if (previous === this.angle) return;
    this.hinge.rotation.x = MathUtils.degToRad(this.angle); this.refresh();
    if (playerBox && penetrates(playerBox, this.topCollider.box)) {
      this.angle = previous; this.hinge.rotation.x = MathUtils.degToRad(previous); this.refresh();
    }
  }
}
