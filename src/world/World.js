import { Box3, Scene, Color } from 'three';

const CELL_SIZE = 4;
const COLLIDER_MARGIN = 1.5;
const PICKABLE_MARGIN = 2.5;

function cell(value) { return Math.floor(value / CELL_SIZE); }
function cellKey(x, z) { return `${x},${z}`; }

export class World {
  constructor() {
    this.scene = new Scene(); this.scene.background = new Color('#d5dece');
    this.objects = []; this.colliders = []; this.pickables = [];
    this.pickableGrid = new Map(); this.pickableCells = new Map();
    this.pickableQuery = []; this.seenPickables = new Set();
  }
  setSchool(school) {
    this.clear(); this.school = school; this.objects = school.objects;
    this.scene.add(school.root);
    this.colliders = this.objects.flatMap(o => o.colliders);
    this.pickables = this.objects.filter(object => object.interactable || object.root.children.length)
      .map(object => object.root);
    this.pickables.push(...(school.pickableInstances || []));
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
    this.pickableGrid = new Map(); this.pickableCells = new Map();
    const bounds = new Box3();
    for (const root of this.pickables) {
      const owner = root.userData.owner;
      const pickBounds = owner?.pickBounds;
      if (pickBounds) bounds.copy(pickBounds);
      else bounds.setFromObject(root);
      if (bounds.isEmpty()) continue;
      const cells = [];
      for (let x = cell(bounds.min.x - PICKABLE_MARGIN); x <= cell(bounds.max.x + PICKABLE_MARGIN); x++) {
        for (let z = cell(bounds.min.z - PICKABLE_MARGIN); z <= cell(bounds.max.z + PICKABLE_MARGIN); z++) {
          const key = cellKey(x, z);
          if (!this.pickableGrid.has(key)) this.pickableGrid.set(key, []);
          this.pickableGrid.get(key).push(root); cells.push(key);
        }
      }
      this.pickableCells.set(root, cells);
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
  pickablesNear(position) {
    this.pickableQuery.length = 0; this.seenPickables.clear();
    const minX = cell(position.x - PICKABLE_MARGIN), maxX = cell(position.x + PICKABLE_MARGIN);
    const minZ = cell(position.z - PICKABLE_MARGIN), maxZ = cell(position.z + PICKABLE_MARGIN);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      for (const root of this.pickableGrid.get(cellKey(x, z)) || []) {
        if (this.seenPickables.has(root)) continue;
        this.seenPickables.add(root); this.pickableQuery.push(root);
      }
    }
    return this.pickableQuery;
  }
  addPickable(root) {
    if (this.pickables.includes(root)) return;
    this.pickables.push(root);
    const bounds = root.userData.owner?.pickBounds || new Box3().setFromObject(root);
    if (bounds.isEmpty()) return;
    const cells = [];
    for (let x = cell(bounds.min.x - PICKABLE_MARGIN); x <= cell(bounds.max.x + PICKABLE_MARGIN); x++) {
      for (let z = cell(bounds.min.z - PICKABLE_MARGIN); z <= cell(bounds.max.z + PICKABLE_MARGIN); z++) {
        const key = cellKey(x, z);
        if (!this.pickableGrid.has(key)) this.pickableGrid.set(key, []);
        this.pickableGrid.get(key).push(root); cells.push(key);
      }
    }
    this.pickableCells.set(root, cells);
  }
  removePickable(root) {
    const cells = this.pickableCells.get(root);
    if (cells) {
      for (const key of cells) {
        const roots = this.pickableGrid.get(key);
        const index = roots.indexOf(root);
        if (index >= 0) roots.splice(index, 1);
        if (!roots.length) this.pickableGrid.delete(key);
      }
      this.pickableCells.delete(root);
    }
    const index = this.pickables.indexOf(root);
    if (index >= 0) this.pickables.splice(index, 1);
  }
  clear() {
    if (this.school) this.scene.remove(this.school.root);
    this.school?.disposeInstances?.();
    for (const o of this.objects) o.dispose();
    this.objects = []; this.colliders = []; this.pickables = []; this.dynamic = new Set();
    this.colliderGrid = new Map(); this.pickableGrid.clear(); this.pickableCells.clear();
    this.pickableQuery.length = 0; this.seenPickables.clear(); this.school = null;
  }
}
