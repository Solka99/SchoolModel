import { Box3, Box3Helper } from 'three';

export class TargetHighlight {
  constructor(scene) {
    this.scene = scene;
    this.box = new Box3(); this.helper = new Box3Helper(this.box, '#e9ca86');
    this.helper.material.transparent = true; this.helper.material.opacity = 0.7;
    this.helper.material.depthWrite = false; this.helper.visible = false;
    this.helper.raycast = () => {}; scene.add(this.helper);
  }
  show(object) {
    if (!object) { this.clear(); return; }
    if (object.pickBounds) this.box.copy(object.pickBounds);
    else {
      object.root.updateWorldMatrix(true, true);
      this.box.setFromObject(object.root);
    }
    this.box.expandByScalar(0.012);
    this.helper.visible = !this.box.isEmpty();
  }
  clear() { this.helper.visible = false; }
  dispose() { this.scene.remove(this.helper); this.helper.geometry.dispose(); this.helper.material.dispose(); }
}
