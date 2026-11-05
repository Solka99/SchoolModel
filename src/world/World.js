import { Scene, Color } from 'three';

export class World {
  constructor() {
    this.scene = new Scene(); this.scene.background = new Color('#d5dece');
    this.objects = []; this.colliders = []; this.pickables = [];
  }
  setClassroom(hall) {
    this.clear(); this.hall = hall; this.objects = hall.objects;
    this.scene.add(hall.root);
    this.colliders = this.objects.flatMap(o => o.colliders);
    this.pickables = this.objects.map(o => o.root);
    this.dynamic = this.objects.filter(o => o.dynamic);
  }
  update(dt, playerBox) { for (const object of this.dynamic) object.update(dt, playerBox); }
  clear() {
    if (this.hall) this.scene.remove(this.hall.root);
    for (const o of this.objects) o.dispose();
    this.objects = []; this.colliders = []; this.pickables = []; this.dynamic = []; this.hall = null;
  }
}
