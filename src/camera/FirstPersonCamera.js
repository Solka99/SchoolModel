import { PerspectiveCamera, MathUtils, Vector3 } from 'three';

export class FirstPersonCamera {
  constructor() {
    this.camera = new PerspectiveCamera(75, 1, 0.1, 55);
    this.yaw = Math.PI / 2; this.pitch = 0;
    this.forwardVector = new Vector3(); this.rightVector = new Vector3();
    this.directionVector = new Vector3(); this.lookTarget = new Vector3();
  }
  look(dx, dy) {
    const sensitivity = MathUtils.degToRad(0.12);
    this.yaw += dx * sensitivity;
    this.pitch = MathUtils.clamp(this.pitch - dy * sensitivity, -MathUtils.degToRad(89), MathUtils.degToRad(89));
  }
  get forward() { return this.forwardVector.set(Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  get right() { return this.rightVector.set(-Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get direction() {
    const horizontal = Math.cos(this.pitch);
    return this.directionVector.set(Math.cos(this.yaw) * horizontal, Math.sin(this.pitch), Math.sin(this.yaw) * horizontal);
  }
  sync(feet, stepOffset = 0) {
    this.camera.position.copy(feet).y += 1.62 + stepOffset;
    this.lookTarget.copy(this.camera.position).add(this.direction);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateMatrixWorld(true);
  }
  resize(width, height) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
}
