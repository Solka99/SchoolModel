import { Vector3 } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { boxAt } from '../physics/Aabb.js';

export class Chair extends SceneObject {
  constructor(models, position, teacher = false) {
    super(teacher ? 'teacher-chair' : 'student-chair');
    this.interactable = true; this.kind = 'chair'; this.root.position.set(...position);
    this.visual = models.chair(); this.visual.rotation.y = teacher ? 0 : Math.PI;
    this.root.add(this.visual);
    this.seat = new Vector3(position[0], position[1] + 0.46, position[2]);
    this.facing = teacher ? Math.PI / 2 : -Math.PI / 2;
    this.addCollider(boxAt([position[0], position[1] + 0.5, position[2]], [0.48, 1, 0.48]));
  }
  get message() { return 'Take a seat'; }
  interact(context) { context.sit(this); }
}
