import { Box } from '../objects/Box.js';
import { SceneObject } from './SceneObject.js';
import { PALETTE as C } from './prefabs.js';

export class CornerConnector extends SceneObject {
  constructor(width, height, center, yaw) {
    super('corridor-corner-connector');
    this.parts = [];
    const half = width / 2;
    const wallThickness = 0.2;
    this.box('corner-floor', [half / 2, -0.1, half / 2], [half, 0.2, half], C.floor);
    this.box('corner-ceiling', [half / 2, height + 0.1, half / 2], [half, 0.2, half], C.ceiling);
    this.box('corner-outer-wall-x', [
      half + wallThickness / 2, height / 2, (half + wallThickness) / 2,
    ], [wallThickness, height, half + wallThickness], C.wall);
    this.box('corner-outer-wall-z', [
      half / 2, height / 2, half + wallThickness / 2,
    ], [half, height, wallThickness], C.wall);
    this.root.position.set(...center);
    this.root.rotation.y = yaw;
    this.root.updateMatrixWorld(true);
    for (const collider of this.colliders) collider.box.applyMatrix4(this.root.matrix);
  }
  box(name, center, size, color) {
    const part = new Box(name, center, size, color);
    this.parts.push(part);
    this.colliders.push(...part.colliders);
    this.root.add(part.root);
  }
  dispose() {
    super.dispose();
    for (const part of this.parts) part.dispose();
  }
}
