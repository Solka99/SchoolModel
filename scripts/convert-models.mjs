import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Mesh, MeshStandardMaterial } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Exporter only needs binary FileReader support for these texture-free meshes.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); })
      .catch(error => this.onerror?.(error));
  }
};
const source = resolve(process.argv[2] || '.reference/pg3d/src/models');
const destination = resolve('public/models');
await mkdir(destination, { recursive: true });
const colors = { door: '#a47a4c', door_handle: '#b5b5ac', student_desk_stand: '#454e47', student_desk_desk: '#b8905b' };
for (const [name, color] of Object.entries(colors)) {
  const bytes = await readFile(resolve(source, `${name}.stl`));
  const geometry = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const material = new MeshStandardMaterial({ color, roughness: 0.7, metalness: name.includes('handle') ? 0.7 : 0 });
  const mesh = new Mesh(geometry, material); mesh.name = name;
  const binary = await new GLTFExporter().parseAsync(mesh, { binary: true });
  await writeFile(resolve(destination, `${name}.glb`), Buffer.from(binary));
  geometry.computeBoundingBox();
  console.log(`${name}: ${binary.byteLength} bytes; source bounds ${JSON.stringify(geometry.boundingBox)}`);
  geometry.dispose(); material.dispose();
}
// chair.glb is copied byte-for-byte; no hierarchy or texture conversion.
await writeFile(resolve(destination, 'chair.glb'), await readFile(resolve(source, 'chair.glb')));
