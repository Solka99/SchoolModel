import { AmbientLight, DirectionalLight } from 'three';
import { Box } from '../objects/Box.js';

export const PALETTE = { wall: '#d8d5c4', floor: '#7e8c79', ceiling: '#eeeee3', wood: '#b18c5f', trim: '#b3bca4', step: '#89917d' };
export function roomBox(name, center, size, color, options) { return new Box(name, center, size, color, options); }
export function addLighting(scene) {
  scene.add(new AmbientLight('#ecf0dd', 1.2));
  const main = new DirectionalLight('#fff0d4', 2.2); main.position.set(4, 9, -4); scene.add(main);
  const fill = new DirectionalLight('#d1dfdc', 0.9); fill.position.set(-4, 6, 8); scene.add(fill);
}
