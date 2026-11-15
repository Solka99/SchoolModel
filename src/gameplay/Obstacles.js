import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { Box } from '../objects/Box.js';
import { boxAt, penetrates } from '../physics/Aabb.js';

class CompositeObstacle extends SceneObject {
  constructor(name) { super(name); this.parts = []; }
  box(name, center, size, color, solid = false) {
    const box = new Box(name, center, size, color, { solid });
    box.root.traverse(node => { node.userData.owner = this; });
    this.parts.push(box); this.root.add(box.root); return box;
  }
  dispose() { super.dispose(); for (const part of this.parts) part.dispose(); }
}

function transformColliders(object) {
  object.root.updateMatrix();
  for (const collider of object.colliders) collider.box.applyMatrix4(object.root.matrix);
}

export class FurnitureBlock extends CompositeObstacle {
  constructor(width, position = [0, 0, 0], yaw = 0) {
    super('furniture-obstacle'); this.kind = 'furniture-obstacle';
    this.label = 'Stacked furniture'; this.interactable = true;
    const x = -width * 0.16, size = width * 0.55;
    const body = this.box('stacked-desks', [x, 0.48, 0], [size, 0.96, 0.8], '#a27c49', true);
    this.colliders.push(...body.colliders);
    for (const y of [0.18, 0.5, 0.82]) this.box('furniture-edge', [x, y, -0.41], [size + 0.04, 0.06, 0.04], '#d1b87b');
    this.root.position.set(...position); this.root.rotation.y = yaw; transformColliders(this);
  }
  get canInteract() { return false; }
  get message() { return 'Go around the furniture'; }
  get detail() { return 'Use the clear right lane, or jump over'; }
}

export class CleaningCart extends CompositeObstacle {
  constructor(width, position = [0, 0, 0], yaw = 0, phase = 0) {
    super('cleaning-cart'); this.kind = 'cleaning-cart'; this.dynamic = true; this.interactable = true;
    this.label = 'Moving cleaning cart'; this.elapsed = phase; this.cooldown = 0; this.contact = false;
    this.amplitude = width / 2 - 0.5; this.basePosition = [...position]; this.yaw = yaw;
    this.offset = Math.sin(phase * Math.PI / 3) * this.amplitude;
    this.box('cart-body', [0, 0.55, 0], [0.7, 0.85, 0.7], '#537a72');
    this.box('cart-top', [0, 1.03, 0], [0.78, 0.1, 0.78], '#e2c484');
    this.box('cart-handle', [0, 1.25, 0.28], [0.64, 0.08, 0.08], '#314b41');
    for (const x of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) this.box('cart-wheel', [x, 0.08, z], [0.12, 0.16, 0.14], '#30443c');
    this.root.position.set(
      position[0] + Math.cos(yaw) * this.offset, position[1], position[2] - Math.sin(yaw) * this.offset,
    ); this.root.rotation.y = yaw;
    this.root.updateMatrixWorld(true); this.collider = this.addCollider(new Box3().setFromObject(this.root));
  }
  get canInteract() { return false; }
  get message() { return 'Watch the cleaning cart'; }
  get detail() { return 'Contact costs 2 seconds · wait or go around'; }
  update(dt, playerBox) {
    this.contact = false; this.cooldown = Math.max(0, this.cooldown - dt);
    const nextTime = this.elapsed + dt, previousOffset = this.offset;
    const nextOffset = Math.sin(nextTime * Math.PI / 3) * this.amplitude;
    this.root.position.set(
      this.basePosition[0] + Math.cos(this.yaw) * nextOffset,
      this.basePosition[1],
      this.basePosition[2] - Math.sin(this.yaw) * nextOffset,
    );
    this.root.updateMatrixWorld(true);
    const proposed = new Box3().setFromObject(this.root);
    if (playerBox && penetrates(playerBox, proposed)) {
      this.offset = previousOffset;
      this.root.position.set(
        this.basePosition[0] + Math.cos(this.yaw) * previousOffset,
        this.basePosition[1],
        this.basePosition[2] - Math.sin(this.yaw) * previousOffset,
      );
      this.root.updateMatrixWorld(true);
      if (this.cooldown <= 0) { this.contact = true; this.cooldown = 2.5; }
      return;
    }
    this.elapsed = nextTime; this.offset = nextOffset; this.collider.box.copy(proposed);
  }
}

export class KeyedGate extends SceneObject {
  constructor(width, center, index, game) {
    super('keyed-corridor-gate'); this.kind = 'keyed-gate'; this.dynamic = true; this.interactable = true;
    this.label = 'Locked corridor barrier'; this.index = index; this.game = game;
    this.lift = 0; this.openHeight = 2.3; this.liftSpeed = 2.3; this.unlocked = false; this.moving = false;
    this.root.position.set(...center);
    this.panel = new Mesh(new BoxGeometry(width, 2.2, 0.16), new MeshStandardMaterial({ color: '#765638', roughness: 0.78 }));
    this.panel.position.set(0, 1.1, 0); this.panel.castShadow = true; this.panel.receiveShadow = true;
    this.root.add(this.panel); this.resources.add(this.panel.geometry); this.resources.add(this.panel.material);
    this.root.updateMatrixWorld(true);
    this.collider = this.addCollider(new Box3().setFromObject(this.panel));
  }
  get canInteract() { return !this.unlocked && !this.moving; }
  get message() { return this.unlocked ? 'Corridor barrier raised' : 'Raise corridor barrier'; }
  get detail() {
    if (this.unlocked) return 'Barrier raised';
    return this.game.rush.hasKey ? 'Use the key to lift this barrier' : 'Find a key in an accessible classroom';
  }
  interact() {
    if (!this.canInteract) return;
    if (!this.game.rush.unlockGate(this)) {
      this.game.hud.toast(this.game.rush.hasKey ? 'This is not the next barrier on your route' : 'Find a key in an accessible classroom first');
      return;
    }
    this.unlocked = true; this.moving = true;
    this.game.onGateUnlocked(this);
  }
  update(dt) {
    if (!this.moving) return;
    this.lift = Math.min(this.openHeight, this.lift + this.liftSpeed * dt);
    if (this.lift >= this.openHeight - 1e-9) this.lift = this.openHeight;
    this.panel.position.y = 1.1 + this.lift;
    this.root.updateMatrixWorld(true);
    this.collider.box.setFromObject(this.panel);
    if (this.lift === this.openHeight) this.moving = false;
  }
}

export class KeyPickup extends SceneObject {
  constructor(position, room, game) {
    super('classroom-key'); this.kind = 'key'; this.interactable = true; this.dynamic = true;
    this.label = `Key in Room ${room.number}`; this.room = room; this.game = game; this.collected = false;
    const material = new MeshStandardMaterial({ color: '#e5b94f', metalness: 0.55, roughness: 0.35 });
    const ring = new Mesh(new TorusGeometry(0.13, 0.045, 8, 18), material);
    ring.position.x = -0.11; ring.rotation.y = Math.PI / 2;
    const shaft = new Mesh(new BoxGeometry(0.34, 0.07, 0.07), material); shaft.position.x = 0.16;
    const tooth = new Mesh(new BoxGeometry(0.07, 0.13, 0.07), material); tooth.position.set(0.24, -0.08, 0);
    this.root.add(ring, shaft, tooth); this.root.position.set(...position);
    this.root.traverse(node => { node.userData.owner = this; });
    this.pickBounds = boxAt(position, [0.65, 0.5, 0.4]);
    this.resources.add(material); this.resources.add(ring.geometry); this.resources.add(shaft.geometry); this.resources.add(tooth.geometry);
  }
  get canInteract() { return !this.collected; }
  get message() { return 'Collect key'; }
  get detail() { return 'This key raises the next corridor barrier'; }
  interact() { this.game.collectKey(this); }
  update(dt) { if (!this.collected) this.root.rotation.y += dt * 1.7; }
}

export function createObstacles(layout, game, corridors) {
  const width = layout.params.corridorWidth, obstacles = [], carts = [];
  for (const corridor of corridors) {
    const { index, length, yaw, center } = corridor;
    const positions = [-length * 0.23, 0, length * 0.23];
    for (const [lane, localZ] of positions.entries()) {
      const position = [
        center[0] + Math.sin(yaw) * localZ,
        0,
        center[2] + Math.cos(yaw) * localZ,
      ];
      const cart = new CleaningCart(width, position, yaw, lane * 0.8 + index * 0.45);
      carts.push(cart); obstacles.push(cart);
    }
  }
  const first = corridors[0];
  const furniturePosition = [
    first.center[0] + Math.sin(first.yaw) * (-first.length * 0.34),
    0,
    first.center[2] + Math.cos(first.yaw) * (-first.length * 0.34),
  ];
  const furniture = new FurnitureBlock(width, furniturePosition, first.yaw);
  obstacles.push(furniture);
  return { objects: obstacles, carts, furniture };
}
