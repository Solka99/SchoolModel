import { Box3Helper } from 'three';

export class ColliderDebug {
  constructor(scene) { this.scene = scene; this.helpers = []; this.enabled = false; }
  rebuild(colliders) {
    this.clear();
    if (!this.enabled) return;
    for (const c of colliders) {
      const helper = new Box3Helper(c.box, c.autoSteppable ? '#f5cb62' : '#53d7cd');
      helper.material.depthTest = false; helper.material.transparent = true; helper.material.opacity = 0.55;
      this.scene.add(helper); this.helpers.push(helper);
    }
  }
  clear() { for (const helper of this.helpers) { this.scene.remove(helper); helper.geometry.dispose(); helper.material.dispose(); } this.helpers = []; }
}
