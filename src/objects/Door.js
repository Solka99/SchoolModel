import { Box3, Group, MathUtils } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { approach } from './StudentDesk.js';
import { penetrates } from '../physics/Aabb.js';

export class Door extends SceneObject {
  constructor(models, center, { alongZ = true, sign = 1 } = {}) {
    super('door'); this.kind = 'door'; this.interactable = true; this.dynamic = true;
    this.angle = 0; this.handleAngle = 0; this.open = false; this.pending = false; this.hold = 0;
    this.sign = sign;
    this.root.position.set(center[0] - (alongZ ? 0 : 0.5), center[1] - 1, center[2] + (alongZ ? 0.5 : 0));
    this.root.rotation.y = alongZ ? Math.PI / 2 : 0;
    this.swing = new Group(); this.root.add(this.swing);
    const correction = new Group(); correction.rotation.x = -Math.PI / 2; this.swing.add(correction);
    this.panel = models.clone('door'); correction.add(this.panel);
    this.handles = [];
    for (const side of [1, -1]) {
      const handle = new Group(); handle.position.set(0.86, side * 0.03, 1);
      const model = models.clone('door_handle'); model.scale.y = side; handle.add(model);
      correction.add(handle); this.handles.push(handle);
    }
    this.panelCollider = this.addCollider(new Box3()); this.refresh();
  }
  refresh() { this.root.updateMatrixWorld(true); this.panelCollider.box.copy(this.meshBounds(this.panel)); }
  get message() { return this.open ? 'Close door' : 'Open door'; }
  interact() {
    if (this.pending) return;
    if (this.open) this.open = false;
    else { this.pending = true; this.hold = 0; }
  }
  update(dt, playerBox) {
    if (this.pending) {
      this.handleAngle = approach(this.handleAngle, -25, 300 * dt);
      if (this.handleAngle === -25) { this.open = true; this.pending = false; this.hold = 0.04; }
    } else if (this.hold > 0) this.hold -= dt;
    else this.handleAngle = approach(this.handleAngle, 0, 300 * dt);
    this.handles.forEach((h, i) => { h.rotation.y = MathUtils.degToRad(this.handleAngle) * (i === 0 ? 1 : -1); });
    const previous = this.angle;
    this.angle = approach(this.angle, this.open ? 95 : 0, 220 * dt);
    if (previous === this.angle) return;
    this.swing.rotation.y = MathUtils.degToRad(this.angle) * this.sign; this.refresh();
    if (playerBox && penetrates(playerBox, this.panelCollider.box)) {
      this.angle = previous; this.swing.rotation.y = MathUtils.degToRad(previous) * this.sign; this.refresh();
    }
  }
}
