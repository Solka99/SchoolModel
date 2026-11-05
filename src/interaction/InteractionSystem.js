import { Raycaster, Vector2, Vector3 } from 'three';
import { TargetHighlight } from './TargetHighlight.js';

export function ownerOf(node) {
  for (let current = node; current; current = current.parent) if (current.userData.owner) return current.userData.owner;
  return null;
}
export class InteractionSystem {
  constructor(game) {
    this.game = game; this.raycaster = new Raycaster(); this.raycaster.far = 2; this.pickPoint = new Vector3();
    this.highlight = game.world?.scene ? new TargetHighlight(game.world.scene) : null;
    this.clear();
  }
  clearTarget() { this.target = null; this.highlight?.clear(); }
  clear() { this.clearTarget(); this.seated = null; this.editing = null; this.previous = null; }
  findTarget(camera, roots) {
    this.raycaster.setFromCamera(new Vector2(0, 0), camera);
    const hit = this.raycaster.intersectObjects(roots, true)[0];
    let nearest = hit?.distance ?? Infinity;
    let owner = hit ? ownerOf(hit.object) : null;
    // Furniture has thin parts and gaps. A pick box keeps aiming forgiving while
    // still comparing its distance to real wall/furniture occluders.
    for (const root of roots) {
      const candidate = ownerOf(root);
      const bounds = candidate?.pickBounds;
      if (!bounds) continue;
      const point = this.raycaster.ray.intersectBox(bounds, this.pickPoint);
      if (!point) continue;
      const distance = point.distanceTo(this.raycaster.ray.origin);
      if (distance < nearest && distance <= this.raycaster.far) { nearest = distance; owner = candidate; }
    }
    return owner?.interactable ? owner : null;
  }
  update() {
    const g = this.game;
    this.target = this.editing || this.seated ? null : this.findTarget(g.view.camera, g.world.pickables);
    this.highlight?.show(this.target);
    const object = this.target || this.seated;
    g.hud.setPrompt(this.target?.message || (this.seated ? 'Stand up' : ''), this.seated ? 'SPACE' : 'E', {
      title: object?.label || '',
      detail: this.seated ? 'Mouse to look around · return to your previous position' : object?.detail || '',
      available: this.target?.canInteract !== false,
    });
  }
  activate() {
    if (this.seated || this.editing) return false;
    this.target = this.findTarget(this.game.view.camera, this.game.world.pickables);
    if (!this.target || this.target.canInteract === false) return false;
    this.target.interact(this); return true;
  }
  notify(message) { this.game.hud.toast(message); }
  sit(chair) {
    if (this.seated || this.editing) return false;
    const g = this.game;
    this.previous = { feet: g.player.feet.clone(), yaw: g.view.yaw, pitch: g.view.pitch };
    this.seated = chair; this.clearTarget();
    g.player.reset(new Vector3(chair.seat.x, chair.seat.y - 1.02, chair.seat.z));
    g.view.yaw = chair.facing; g.view.pitch = 0;
    g.hud.mode('TAKE YOUR TIME · SPACE TO STAND');
    return true;
  }
  stand() {
    const g = this.game;
    if (!this.seated) return;
    const chair = this.seated;
    const fallback = chair.seat.clone().addScaledVector(new Vector3(Math.cos(chair.facing), 0, Math.sin(chair.facing)), 0.7);
    fallback.y = chair.seat.y - 0.46;
    const position = [this.previous.feet, fallback, new Vector3(...g.world.school.spawn)]
      .find(p => !g.player.blocked(p, g.world.colliders));
    g.player.reset(position || new Vector3(...g.world.school.spawn));
    g.view.yaw = this.previous.yaw; g.view.pitch = this.previous.pitch;
    this.seated = null; this.previous = null; g.hud.mode('SCHOOL EXPLORER');
  }
  edit(board) {
    if (this.seated || this.editing) return false;
    this.editing = board; this.clearTarget(); this.game.editor.open(board); return true;
  }
  dispose() { this.clear(); this.highlight?.dispose(); }
}
