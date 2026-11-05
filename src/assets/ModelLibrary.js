import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODEL_NAMES = ['chair', 'door', 'door_handle', 'student_desk_stand', 'student_desk_desk'];
export class ModelLibrary {
  constructor(base = `${import.meta.env.BASE_URL}models/`) {
    this.base = base; this.loader = new GLTFLoader(); this.templates = new Map();
  }
  async load(onProgress = () => {}) {
    let count = 0;
    await Promise.all(MODEL_NAMES.map(async name => {
      try {
        const gltf = await this.loader.loadAsync(`${this.base}${name}.glb`);
        gltf.scene.traverse(node => { if (node.isMesh) { node.castShadow = false; node.receiveShadow = true; } });
        this.templates.set(name, gltf.scene);
        onProgress(++count, MODEL_NAMES.length);
      } catch (error) { throw new Error(`Could not load ${name}.glb. Check the model files and reload.`, { cause: error }); }
    }));
  }
  clone(name) {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Model not loaded: ${name}`);
    return template.clone(true);
  }
  chair() {
    const visual = this.clone('chair');
    const bounds = new Box3().setFromObject(visual);
    const size = bounds.getSize(new Vector3());
    const scale = 0.5 / Math.max(size.x, size.z);
    const group = new Group(); group.add(visual);
    visual.position.set(-(bounds.min.x + size.x / 2), -bounds.min.y, -(bounds.min.z + size.z / 2));
    group.scale.setScalar(scale); return group;
  }
  dispose() {
    const resources = new Set();
    for (const template of this.templates.values()) template.traverse(node => {
      if (!node.isMesh) return;
      resources.add(node.geometry);
      for (const m of (Array.isArray(node.material) ? node.material : [node.material])) {
        resources.add(m);
        for (const value of Object.values(m)) if (value?.isTexture) resources.add(value);
      }
    });
    for (const r of resources) { r.dispose(); if (r.isTexture) r.source?.data?.close?.(); }
    this.templates.clear();
  }
}
