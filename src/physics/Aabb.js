import { Box3, Vector3 } from 'three';

const EPSILON = 1e-6;
export function penetrates(a, b) {
  if (a.isEmpty() || b.isEmpty()) return false;
  return a.min.x < b.max.x - EPSILON && a.max.x > b.min.x + EPSILON &&
    a.min.y < b.max.y - EPSILON && a.max.y > b.min.y + EPSILON &&
    a.min.z < b.max.z - EPSILON && a.max.z > b.min.z + EPSILON &&
    b.max.x > b.min.x && b.max.y > b.min.y && b.max.z > b.min.z &&
    a.max.x > a.min.x && a.max.y > a.min.y && a.max.z > a.min.z;
}
export function playerBox(feet, halfWidth = 0.2, height = 1.8) {
  return new Box3(new Vector3(feet.x - halfWidth, feet.y, feet.z - halfWidth),
    new Vector3(feet.x + halfWidth, feet.y + height, feet.z + halfWidth));
}
export function boxAt(center, size) {
  return new Box3().setFromCenterAndSize(new Vector3(...center), new Vector3(...size));
}
export function overlapsXZ(a, b) {
  return a.min.x < b.max.x - EPSILON && a.max.x > b.min.x + EPSILON &&
    a.min.z < b.max.z - EPSILON && a.max.z > b.min.z + EPSILON;
}
