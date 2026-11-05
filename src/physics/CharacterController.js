import { Vector3 } from 'three';
import { playerBox, penetrates, overlapsXZ } from './Aabb.js';

// Feet remain authoritative. A camera offset eases automatic steps without
// temporarily placing the collision body inside a stair riser.
export class CharacterController {
  constructor() {
    this.feet = new Vector3();
    this.halfWidth = 0.2; this.height = 1.8;
    this.speed = 4.5; this.gravity = -20; this.jumpSpeed = 7.5; this.maxStep = 0.8;
    this.reset(new Vector3());
  }
  reset(position) {
    this.feet.copy(position); this.verticalSpeed = 0; this.grounded = false;
    this.eyeStepOffset = 0;
  }
  get box() { return playerBox(this.feet, this.halfWidth, this.height); }
  blocked(position, colliders) {
    const box = playerBox(position, this.halfWidth, this.height);
    return colliders.some(c => penetrates(box, c.box));
  }
  supported(colliders) {
    const probe = this.feet.clone(); probe.y -= 0.004;
    return this.blocked(probe, colliders);
  }
  update(dt, intent, forward, right, jump, colliders) {
    this.grounded = this.verticalSpeed <= 0 && this.supported(colliders);
    const motion = forward.clone().multiplyScalar(intent.z).addScaledVector(right, intent.x);
    if (motion.lengthSq() > 0) motion.normalize().multiplyScalar(this.speed * dt);
    for (const axis of ['x', 'z']) {
      if (!motion[axis]) continue;
      const target = this.feet.clone(); target[axis] += motion[axis];
      if (!this.blocked(target, colliders)) { this.feet.copy(target); continue; }
      if (!this.grounded || jump) continue;
      const targetBox = playerBox(target, this.halfWidth, this.height);
      const tops = colliders.filter(c => c.autoSteppable && overlapsXZ(targetBox, c.box))
        .map(c => c.box.max.y).filter(y => y > this.feet.y + 0.001 && y - this.feet.y <= this.maxStep)
        .sort((a, b) => a - b);
      for (const top of tops) {
        const raised = target.clone(); raised.y = top;
        const clearance = this.feet.clone(); clearance.y = top;
        if (!this.blocked(raised, colliders) && !this.blocked(clearance, colliders)) {
          this.eyeStepOffset -= top - this.feet.y;
          this.feet.copy(raised); this.verticalSpeed = 0; break;
        }
      }
    }
    if (jump && this.grounded) { this.verticalSpeed = this.jumpSpeed; this.grounded = false; }
    this.verticalSpeed += this.gravity * dt;
    const previousY = this.feet.y;
    let nextY = previousY + this.verticalSpeed * dt;
    const horizontalBox = this.box;
    this.grounded = false;
    for (const c of colliders) {
      if (!overlapsXZ(horizontalBox, c.box)) continue;
      if (this.verticalSpeed <= 0 && previousY >= c.box.max.y - 0.001 && nextY < c.box.max.y) {
        nextY = Math.max(nextY, c.box.max.y);
        this.grounded = true;
      } else if (this.verticalSpeed > 0 && previousY + this.height <= c.box.min.y + 0.001 && nextY + this.height > c.box.min.y) {
        nextY = Math.min(nextY, c.box.min.y - this.height);
      }
    }
    if (this.grounded || (this.verticalSpeed > 0 && nextY < previousY + this.verticalSpeed * dt - 1e-8)) this.verticalSpeed = 0;
    this.feet.y = nextY;
    this.eyeStepOffset *= Math.exp(-dt * 18);
  }
}
