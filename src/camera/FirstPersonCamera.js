import { PerspectiveCamera, MathUtils, Vector3 } from 'three';

export class FirstPersonCamera {
  constructor() { this.camera = new PerspectiveCamera(75, 1, 0.1, 200); this.yaw = Math.PI / 2; this.pitch = 0; }
  look(dx, dy) {
    const sensitivity = MathUtils.degToRad(0.12);
    this.yaw += dx * sensitivity;
    this.pitch = MathUtils.clamp(this.pitch - dy * sensitivity, -MathUtils.degToRad(89), MathUtils.degToRad(89));
  }
  get forward() { return new Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  get right() { return new Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get direction() { return new Vector3(Math.cos(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.sin(this.yaw) * Math.cos(this.pitch)); }
  sync(feet, stepOffset = 0) {
    this.camera.position.copy(feet).y += 1.62 + stepOffset;
    this.camera.lookAt(this.camera.position.clone().add(this.direction));
    this.camera.updateMatrixWorld(true);
  }
  resize(width, height) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}
