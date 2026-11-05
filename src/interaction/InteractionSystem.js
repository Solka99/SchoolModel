import { Raycaster, Vector2, Vector3 } from 'three';

export function ownerOf(node) {
  for (let current = node; current; current = current.parent) if (current.userData.owner) return current.userData.owner;
  return null;
}
export class InteractionSystem {
  constructor(game) { this.game = game; this.raycaster = new Raycaster(); this.raycaster.far = 2; this.clear(); }
  clear() { this.target = null; this.seated = null; this.editing = null; this.previous = null; }
  findTarget(camera, roots) {
    this.raycaster.setFromCamera(new Vector2(0, 0), camera);
    const hit = this.raycaster.intersectObjects(roots, true)[0];
    const owner = hit ? ownerOf(hit.object) : null;
    return owner?.interactable ? owner : null;
  }
  update() {
    const g = this.game;
    this.target = this.editing || this.seated ? null : this.findTarget(g.view.camera, g.world.pickables);
    g.hud.setPrompt(this.target?.message || (this.seated ? 'Stand up' : ''), this.seated ? 'SPACE' : 'E');
  }
  activate() { this.target?.interact(this); }
  sit(chair) {
    const g = this.game;
    this.previous = { feet: g.player.feet.clone(), yaw: g.view.yaw, pitch: g.view.pitch };
    this.seated = chair; this.target = null;
    g.player.reset(new Vector3(chair.seat.x, chair.seat.y - 1.02, chair.seat.z));
    g.view.yaw = chair.facing; g.view.pitch = 0;
    g.hud.mode('TAKE YOUR TIME · SPACE TO STAND');
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
  edit(board) { this.editing = board; this.game.editor.open(board); }
}
