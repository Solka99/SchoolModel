import { PointLight } from 'three';
import { SceneObject } from '../world/SceneObject.js';

// One circuit owns its light sources and references only its own fixture materials.
export class LightCircuit extends SceneObject {
  constructor(name, sources, fixtures) {
    super('light-circuit'); this.kind = 'light-circuit'; this.label = name;
    this.on = true; this.fixtures = fixtures;
    this.lights = sources.map(({ position, intensity = 65, distance = 10 }) => {
      const light = new PointLight('#fff0d4', intensity, distance, 2);
      light.position.set(...position); light.userData.onIntensity = intensity;
      this.root.add(light); return light;
    });
    this.setOn(true);
  }
  setOn(on) {
    this.on = Boolean(on);
    // Keep the source count stable to avoid shader recompilation on each toggle.
    for (const light of this.lights) light.intensity = this.on ? light.userData.onIntensity : 0;
    for (const fixture of this.fixtures) fixture.emissiveIntensity = this.on ? 1.2 : 0;
  }
  toggle() { this.setOn(!this.on); }
}
