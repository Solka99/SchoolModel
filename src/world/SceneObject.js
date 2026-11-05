import { Group, Box3 } from 'three';

export class SceneObject {
  constructor(name) {
    this.root = new Group(); this.root.name = name; this.root.userData.owner = this;
    this.colliders = []; this.resources = new Set(); this.interactable = false;
  }
  addCollider(box, autoSteppable = false) {
    const collider = { box, autoSteppable, owner: this };
    this.colliders.push(collider); return collider;
  }
  meshBounds(mesh) {
    mesh.updateWorldMatrix(true, true);
    return new Box3().setFromObject(mesh);
  }
  update() {}
  interact() {}
  get message() { return ''; }
  dispose() { for (const resource of this.resources) resource.dispose(); this.resources.clear(); }
}
