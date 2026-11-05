import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

for (const name of ['chair', 'door', 'door_handle', 'student_desk_stand', 'student_desk_desk']) {
  test(`${name} GLB is valid, self-contained, and has mesh bounds`, async () => {
    const bytes = await readFile(new URL(`../public/models/${name}.glb`, import.meta.url));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(json.asset.version, '2.0');
    assert.ok(json.meshes.length > 0);
    for (const buffer of json.buffers) assert.equal(buffer.uri, undefined);
    for (const image of json.images || []) assert.equal(image.uri, undefined);
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
      const position = json.accessors[primitive.attributes.POSITION];
      assert.equal(position.min.length, 3); assert.equal(position.max.length, 3); assert.ok(position.count > 0);
    }
    if (name === 'chair') assert.equal(createHash('sha256').update(bytes).digest('hex'), 'bdb809ba9d081b703638cfa01af7b2d3b980aeee54a4f0878423616c5639f49d');
  });
}
