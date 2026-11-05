import { Scene, Color } from 'three';

export class World {
  constructor() {
    this.scene = new Scene(); this.scene.background = new Color('#d5dece');
    this.objects = []; this.colliders = []; this.pickables = [];
  }
  setSchool(school) {
    this.clear(); this.school = school; this.objects = school.objects;
    this.scene.add(school.root);
    this.colliders = this.objects.flatMap(o => o.colliders);
    this.pickables = this.objects.map(o => o.root);
    this.dynamic = this.objects.filter(o => o.dynamic);
  }
  update(dt, playerBox) { for (const object of this.dynamic) object.update(dt, playerBox); }
  clear() {
    if (this.school) this.scene.remove(this.school.root);
    for (const o of this.objects) o.dispose();
    this.objects = []; this.colliders = []; this.pickables = []; this.dynamic = []; this.school = null;
  }
}
