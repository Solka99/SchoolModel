import { CanvasTexture, Mesh, PlaneGeometry, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { SceneObject } from '../world/SceneObject.js';
import { Box } from './Box.js';

export class Blackboard extends SceneObject {
  constructor(center, width, height) {
    super('blackboard'); this.kind = 'blackboard'; this.interactable = true; this.text = '';
    this.label = 'Blackboard';
    const surface = new Box('board-surface', center, [width, height, 0.06], '#24493d');
    this.root.add(surface.root); this.colliders.push(...surface.colliders); this.children = [surface];
    for (const [dx, dy, w, h] of [[0, height / 2 + 0.04, width + 0.16, 0.08], [0, -height / 2 - 0.04, width + 0.16, 0.08], [-width / 2 - 0.04, 0, 0.08, height], [width / 2 + 0.04, 0, 0.08, height]]) {
      const frame = new Box('board-frame', [center[0] + dx, center[1] + dy, center[2]], [w, h, 0.08], '#ab8454');
      this.root.add(frame.root); this.colliders.push(...frame.colliders); this.children.push(frame);
    }
    // All board descendants belong to the board, including its frame.
    this.root.traverse(o => { o.userData.owner = this; });
    this.canvas = document.createElement('canvas'); this.canvas.width = 1536; this.canvas.height = 400;
    this.texture = new CanvasTexture(this.canvas); this.texture.colorSpace = SRGBColorSpace;
    const material = new MeshStandardMaterial({ map: this.texture, roughness: 1 });
    const geometry = new PlaneGeometry(width - 0.04, height - 0.04);
    const face = new Mesh(geometry, material); face.position.set(center[0], center[1], center[2] + 0.032);
    this.root.add(face); this.resources.add(this.texture); this.resources.add(material); this.resources.add(geometry);
    this.setText('');
  }
  get message() { return 'Write on the blackboard'; }
  get detail() { return this.text ? 'Edit the current note · up to 200 characters' : 'Leave a note for the class'; }
  interact(context) { context.edit(this); }
  setText(text) {
    this.text = text.slice(0, 200);
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#24493d'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#e9ead8'; ctx.font = '40px Georgia'; ctx.textBaseline = 'top';
    let line = '', y = 45;
    for (const character of this.text) {
      if (character === '\n' || ctx.measureText(line + character).width > 1420) {
        ctx.fillText(line, 45, y); y += 55; line = character === '\n' ? '' : character;
      } else line += character;
    }
    ctx.fillText(line, 45, y); this.texture.needsUpdate = true;
  }
  dispose() { super.dispose(); for (const child of this.children) child.dispose(); }
}
