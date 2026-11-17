import { Box3, Group, MathUtils, Matrix4 } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { penetrates } from '../physics/Aabb.js';

export function approach(value, target, delta) {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}
export class StudentDesk extends SceneObject {
  constructor(models, position) {
    super('student-desk'); this.interactable = true; this.kind = 'desk'; this.dynamic = true;
    this.label = 'Writing desk'; this.blocked = false;
    this.angle = 0; this.open = false; this.root.position.set(...position);
    const outer = new Group(); outer.rotation.y = Math.PI; this.outer = outer;
    const correction = new Group(); correction.rotation.x = -Math.PI / 2; this.correction = correction;
    outer.add(correction); this.root.add(outer);
    this.stand = models.clone('student_desk_stand'); correction.add(this.stand);
    this.hinge = new Group(); this.hinge.position.set(0, 0.035, 0.69); correction.add(this.hinge);
    this.tabletop = models.clone('student_desk_desk'); this.hinge.add(this.tabletop);
    this.supportCollider = this.addCollider(new Box3()); this.topCollider = this.addCollider(new Box3());
    this.pickBox = new Box3();
    this.refresh();
  }
  refresh() {
    if (!this.batched) {
      this.root.updateMatrixWorld(true);
      this.supportCollider.box.copy(this.meshBounds(this.stand));
      this.topCollider.box.copy(this.meshBounds(this.tabletop));
    } else {
      this.root.updateWorldMatrix(true, false);
      this.outer.updateMatrix(); this.correction.updateMatrix();
      this.hinge.updateMatrix(); this.tabletop.updateMatrix();
      const matrix = new Matrix4().copy(this.instanceRoot.matrixWorld).invert()
        .multiply(this.root.matrixWorld).multiply(this.outer.matrix)
        .multiply(this.correction.matrix).multiply(this.hinge.matrix)
        .multiply(this.tabletop.matrix);
      this.topCollider.box.makeEmpty();
      for (const ref of this.topInstanceRefs) {
        const instanceMatrix = matrix.clone().multiply(ref.localMatrix);
        ref.instance.setMatrixAt(ref.index, instanceMatrix);
        ref.geometry.computeBoundingBox();
        this.topCollider.box.union(ref.geometry.boundingBox.clone()
          .applyMatrix4(instanceMatrix).applyMatrix4(this.instanceRoot.matrixWorld));
        ref.instance.instanceMatrix.needsUpdate = true;
      }
    }
    this.pickBox.copy(this.supportCollider.box).union(this.topCollider.box);
  }
  get pickBounds() { return this.pickBox; }
  get moving() { return Math.abs(this.angle - (this.open ? 90 : 0)) > 0.05; }
  get canInteract() { return !this.moving || this.blocked; }
  get message() {
    if (this.moving && !this.blocked) return this.open ? 'Opening writing desk…' : 'Folding desk away…';
    return this.open ? 'Fold desk away' : 'Open writing desk';
  }
  get detail() { return this.blocked ? 'Desk obstructed · step clear or reverse the desk' : this.moving ? 'Wait for the writing surface to stop' : 'Fold the writing surface up or down'; }
  interact() { if (this.canInteract) this.open = !this.open; }
  update(dt, playerBox) {
    this.blocked = false;
    const previous = this.angle;
    this.angle = approach(this.angle, this.open ? 90 : 0, 300 * dt);
    if (previous === this.angle) return false;
    this.hinge.rotation.x = MathUtils.degToRad(this.angle); this.refresh();
    if (playerBox && penetrates(playerBox, this.topCollider.box)) {
      this.blocked = true;
      this.angle = previous; this.hinge.rotation.x = MathUtils.degToRad(previous); this.refresh();
    }
    return this.moving;
  }
}
