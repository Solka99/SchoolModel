import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { boxAt } from '../physics/Aabb.js';

const unitBox = new BoxGeometry(1, 1, 1);
export class Box extends SceneObject {
  constructor(name, center, size, color, { autoSteppable = false, solid = true, roughness = 0.85 } = {}) {
    super(name);
    const material = new MeshStandardMaterial({ color, roughness });
    this.resources.add(material);
    this.mesh = new Mesh(unitBox, material); this.mesh.position.set(...center); this.mesh.scale.set(...size);
    this.mesh.receiveShadow = true; this.mesh.castShadow = false; this.root.add(this.mesh);
    if (solid) this.addCollider(boxAt(center, size), autoSteppable);
  }
}
