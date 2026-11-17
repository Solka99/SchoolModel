import { Scene, Color } from 'three';

const CELL_SIZE = 4;
const COLLIDER_MARGIN = 1.5;

function cell(value) { return Math.floor(value / CELL_SIZE); }
function cellKey(x, z) { return `${x},${z}`; }

export class World {
  constructor() {
    this.scene = new Scene(); this.scene.background = new Color('#d5dece');
    this.objects = []; this.colliders = []; this.pickables = [];
  }
  setSchool(school) {
    this.clear(); this.school = school; this.objects = school.objects;
    this.scene.add(school.root);
    this.colliders = this.objects.flatMap(o => o.colliders);
    this.pickables = [
      ...this.objects.filter(object => object.interactable || object.root.children.length).map(object => object.root),
      ...(school.pickableInstances || []),
    ];
    this.dynamic = new Set(this.objects.filter(o => o.alwaysUpdate));
    this.colliderGrid = new Map();
    for (const collider of this.colliders) {
      if (collider.owner.alwaysUpdate) continue;
      const { min, max } = collider.box;
      for (let x = cell(min.x - COLLIDER_MARGIN); x <= cell(max.x + COLLIDER_MARGIN); x++) {
        for (let z = cell(min.z - COLLIDER_MARGIN); z <= cell(max.z + COLLIDER_MARGIN); z++) {
          const key = cellKey(x, z);
          if (!this.colliderGrid.has(key)) this.colliderGrid.set(key, []);
          this.colliderGrid.get(key).push(collider);
        }
      }
    }
  }
  activate(object) { if (object.dynamic) this.dynamic.add(object); }
  update(dt, playerBox) {
    for (const object of this.dynamic) {
      if (object.update(dt, playerBox) === false && !object.alwaysUpdate) this.dynamic.delete(object);
    }
  }
  collidersNear(box) {
    const result = new Set();
    const minX = cell(box.min.x - 0.5), maxX = cell(box.max.x + 0.5);
    const minZ = cell(box.min.z - 0.5), maxZ = cell(box.max.z + 0.5);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      for (const collider of this.colliderGrid.get(cellKey(x, z)) || []) result.add(collider);
    }
    for (const object of this.dynamic) for (const collider of object.colliders) result.add(collider);
    return [...result];
  }
  clear() {
    if (this.school) this.scene.remove(this.school.root);
    this.school?.disposeInstances?.();
    for (const o of this.objects) o.dispose();
    this.objects = []; this.colliders = []; this.pickables = []; this.dynamic = new Set();
    this.colliderGrid = new Map(); this.school = null;
  }
}
