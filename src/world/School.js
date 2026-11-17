import { DynamicDrawUsage, Group, InstancedMesh, Matrix4 } from 'three';
import { schoolLayout } from '../config/school.js';
import { Classroom } from './Classroom.js';
import { Corridor } from './Corridor.js';
import { CornerConnector } from './CornerConnector.js';
import { Box } from '../objects/Box.js';
import { Sign } from '../objects/Sign.js';
import { createObstacles, KeyPickup } from '../gameplay/Obstacles.js';

function addInstances(root, entries, { dynamic = false } = {}) {
  const instance = new InstancedMesh(entries[0].mesh.geometry, entries[0].mesh.material, entries.length);
  instance.name = 'school-instances';
  instance.castShadow = entries[0].mesh.castShadow;
  instance.receiveShadow = entries[0].mesh.receiveShadow;
  if (dynamic) instance.instanceMatrix.setUsage(DynamicDrawUsage);
  const inverseRoot = root.matrixWorld.clone().invert();
  for (const [index, entry] of entries.entries()) {
    instance.setMatrixAt(index, new Matrix4().multiplyMatrices(inverseRoot, entry.mesh.matrixWorld));
    entry.mesh.visible = false;
    if (entry.object) {
      entry.object.instanceRoot = root;
      entry.object.instanceRefs ||= [];
      entry.object.instanceRefs.push({
        mesh: entry.mesh, geometry: entry.mesh.geometry, instance, index,
        animated: entry.animated, localMatrix: entry.localMatrix,
      });
    }
  }
  instance.computeBoundingSphere();
  root.add(instance);
  return instance;
}

function sceneChunk(root, node) {
  let chunk = node;
  while (chunk.parent && chunk.parent !== root) chunk = chunk.parent;
  return chunk.userData.batchChunk ?? chunk.uuid;
}

export class School {
  constructor(models, values, { challenge = false, game = null } = {}) {
    this.layout = schoolLayout(values); this.params = this.layout.params;
    this.root = new Group(); this.root.name = 'school-ground-floor'; this.objects = []; this.rooms = [];
    this.instanceMeshes = []; this.instanceMaterials = new Set(); this.pickableInstances = [];
    this.batchedFurnitureMeshes = 0; this.batchedBoxMeshes = 0;
    this.spawn = this.layout.spawn; this.corridors = []; this.gates = []; this.activeKey = null;
    try {
      for (const spec of this.layout.rooms) {
        const classroom = new Classroom(models, { ...this.params, doorOnLeft: spec.side === 1 }, { outsideLanding: false, label: `Room ${spec.number}` });
        classroom.root.userData.batchChunk = spec.corridorIndex;
        for (const object of classroom.objects) {
          if (object.interactable && object.kind !== 'light-switch') object.label += ` · Room ${spec.number}`;
        }
        const corridor = this.layout.corridors[spec.corridorIndex];
        const keyX = -spec.side * (this.layout.metrics.roomWidth / 2 - 1.1);
        const keyZ = this.layout.metrics.doorCenterZ + 0.65;
        const cos = Math.cos(spec.yaw), sin = Math.sin(spec.yaw);
        const keyPosition = [
          spec.origin[0] + cos * keyX + sin * keyZ,
          0.32,
          spec.origin[2] - sin * keyX + cos * keyZ,
        ];
        this.rooms.push({ ...spec, keyPosition, corridor: corridor.index, classroom }); this.objects.push(...classroom.objects);
        classroom.place(spec.origin, spec.yaw); this.root.add(classroom.root);
        // Visible on the room side, to identify a classroom after entering it.
        const signZ = this.layout.metrics.zFront + 0.06;
        const sign = new Sign(`inside-sign-${spec.number}`, [
          spec.origin[0] + Math.sin(spec.yaw) * signZ, 2.7,
          spec.origin[2] + Math.cos(spec.yaw) * signZ,
        ], {
          title: `ROOM ${spec.number}`, subtitle: spec.subject.toUpperCase(), width: 2, height: 0.45, yaw: spec.yaw,
        });
        this.objects.push(sign); this.root.add(sign.root);
      }
      for (const spec of this.layout.corridors) {
        const corridor = new Corridor(this.layout, spec, game, challenge);
        corridor.root.userData.batchChunk = spec.index;
        this.corridors.push(corridor); this.objects.push(...corridor.objects); this.root.add(corridor.root);
        if (corridor.gate) this.gates.push(corridor.gate);
      }
      this.corners = this.layout.corners.map(spec => {
        const corner = new CornerConnector(this.params.corridorWidth, this.params.roomHeight, spec.center, spec.yaw);
        corner.root.userData.batchChunk = spec.index;
        this.objects.push(corner); this.root.add(corner.root); return corner;
      });
      this.corridor = this.corridors[0];
      if (challenge) {
        this.obstacles = createObstacles(this.layout, game, this.layout.corridors);
        for (const object of this.obstacles.objects) { this.objects.push(object); this.root.add(object.root); }
      }
      this.root.updateMatrixWorld(true);
      this.batchFurniture();
      this.batchBuilding();
    } catch (error) {
      this.disposeInstances();
      for (const object of this.objects) object.dispose();
      throw error;
    }
  }
  batchFurniture() {
    const groups = new Map();
    for (const object of this.objects) {
      if (object.kind !== 'chair' && object.kind !== 'desk') continue;
      object.root.traverse(mesh => {
        if (!mesh.isMesh) return;
        const chunk = sceneChunk(this.root, object.root);
        const key = `${chunk}:${mesh.geometry.uuid}:${mesh.material.uuid}`;
        if (!groups.has(key)) groups.set(key, []);
        const animated = object.kind === 'desk' && object.tabletop.getObjectById(mesh.id) === mesh;
        const localMatrix = animated ?
          new Matrix4().copy(object.tabletop.matrixWorld).invert().multiply(mesh.matrixWorld) : null;
        if (animated && !mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        groups.get(key).push({ object, mesh, animated, localMatrix });
      });
    }
    for (const [key, entries] of groups) {
      const instance = addInstances(this.root, entries, { dynamic: entries.some(({ object }) => object.kind === 'desk') });
      this.batchedFurnitureMeshes += entries.length;
      this.instanceMeshes.push(instance);
    }
    for (const object of this.objects) {
      if (object.kind !== 'chair' && object.kind !== 'desk') continue;
      object.batched = true;
      object.instanceRoot = this.root;
      object.topInstanceRefs = object.instanceRefs.filter(ref => ref.animated)
        .map(({ geometry, instance, index, localMatrix }) => ({ geometry, instance, index, localMatrix }));
      if (object.kind === 'desk') { object.stand.clear(); object.tabletop.clear(); }
      object.root.clear();
      if (object.kind === 'desk') object.refresh();
      else object.visual = null;
      object.instanceRefs.length = 0;
    }
  }
  batchBuilding() {
    const groups = new Map();
    for (const object of this.objects) {
      const boxes = object instanceof Box ? [object] :
        object.root.name === 'corridor-corner-connector' ? object.parts : [];
      for (const box of boxes) {
        if (box.mesh.material.emissive.getHex() !== 0) continue;
        const material = box.mesh.material;
        const chunk = sceneChunk(this.root, box.mesh);
        const key = `${chunk}:${material.color.getHexString()}:${material.roughness}:${material.metalness}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ mesh: box.mesh });
      }
    }
    for (const [key, entries] of groups) {
      const material = entries[0].mesh.material.clone();
      const instance = addInstances(this.root, entries.map(({ mesh }) => ({ mesh })));
      instance.material = material;
      this.batchedBoxMeshes += entries.length;
      this.instanceMeshes.push(instance);
      this.instanceMaterials.add(material);
      this.pickableInstances.push(instance);
      for (const { mesh } of entries) {
        const objectRoot = mesh.parent;
        objectRoot?.removeFromParent();
        objectRoot?.clear();
      }
    }
    for (const object of this.objects) {
      if (object instanceof Box || object.root.name === 'corridor-corner-connector') object.root.removeFromParent();
    }
  }
  disposeInstances() {
    for (const instance of this.instanceMeshes) instance.dispose();
    for (const material of this.instanceMaterials) material.dispose();
    this.instanceMeshes.length = 0;
    this.instanceMaterials.clear();
    this.pickableInstances.length = 0;
  }
  spawnKey(room, game) {
    if (!room || this.activeKey) throw new Error('A key is already active or its classroom is missing.');
    const key = new KeyPickup(room.keyPosition, room, game);
    this.activeKey = key; this.objects.push(key); this.root.add(key.root); return key;
  }
  locationAt(position) {
    const room = this.rooms.find(r => {
      const dx = position.x - r.origin[0], dz = position.z - r.origin[2];
      const x = Math.cos(r.yaw) * dx - Math.sin(r.yaw) * dz;
      const z = Math.sin(r.yaw) * dx + Math.cos(r.yaw) * dz;
      return x > r.localBounds.minX && x < r.localBounds.maxX &&
        z > r.localBounds.minZ && z < r.localBounds.maxZ;
    });
    if (room) return `ROOM ${room.number} / ${room.subject.toUpperCase()}`;
    for (const corridor of this.layout.corridors) {
      const dx = position.x - corridor.center[0], dz = position.z - corridor.center[2];
      const localX = Math.cos(corridor.yaw) * dx - Math.sin(corridor.yaw) * dz;
      const localZ = Math.sin(corridor.yaw) * dx + Math.cos(corridor.yaw) * dz;
      if (Math.abs(localX) < this.params.corridorWidth / 2 &&
          Math.abs(localZ) < this.layout.length / 2) return corridor.name.toUpperCase();
    }
    return 'GROUND FLOOR / SCHOOL ENTRANCE';
  }
}
