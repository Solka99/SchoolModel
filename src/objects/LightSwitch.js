import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { SceneObject } from '../world/SceneObject.js';

const geometry = new BoxGeometry(1, 1, 1);
export class LightSwitch extends SceneObject {
  constructor(circuit, position, yaw) {
    super('light-switch'); this.kind = 'light-switch'; this.interactable = true;
    this.circuit = circuit; this.label = `${circuit.label} lights`;
    this.root.position.set(...position); this.root.rotation.y = yaw;
    const plate = new MeshStandardMaterial({ color: '#dddccc', roughness: 0.65 });
    const rocker = new MeshStandardMaterial({ color: '#f6f1dc', roughness: 0.6 });
    const indicator = new MeshStandardMaterial({ color: '#7d9c67', emissive: '#afd883' });
    for (const material of [plate, rocker, indicator]) this.resources.add(material);
    const mesh = new Mesh(geometry, plate); mesh.scale.set(0.2, 0.3, 0.035); this.root.add(mesh);
    this.rocker = new Mesh(geometry, rocker); this.rocker.scale.set(0.105, 0.17, 0.035); this.rocker.position.z = 0.028; this.root.add(this.rocker);
    this.indicator = new Mesh(geometry, indicator); this.indicator.scale.set(0.035, 0.015, 0.008); this.indicator.position.set(0, 0.115, 0.023); this.root.add(this.indicator);
    this.sync();
  }
  sync() {
    this.rocker.rotation.x = this.circuit.on ? -0.18 : 0.18;
    this.indicator.material.emissiveIntensity = this.circuit.on ? 0.8 : 0;
    this.indicator.material.color.set(this.circuit.on ? '#8ea969' : '#596453');
  }
  get message() { return this.circuit.on ? 'Switch lights off' : 'Switch lights on'; }
  get detail() { return this.circuit.on ? 'Lights are on' : 'Lights are off'; }
  interact(context) {
    this.circuit.toggle(); this.sync();
    context?.notify?.(`${this.label}: ${this.circuit.on ? 'on' : 'off'}`);
  }
}
