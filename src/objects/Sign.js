import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { SceneObject } from '../world/SceneObject.js';

export class Sign extends SceneObject {
  constructor(name, position, { title, subtitle = '', width = 1.4, height = 0.5, yaw = 0, light = false }) {
    super(name);
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = Math.round(768 * height / width);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = light ? '#e8e7d8' : '#214c40'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#a88b5c'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.fillStyle = light ? '#214c40' : '#f3f0dc';
    ctx.font = '600 76px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, 384, canvas.height * (subtitle ? 0.39 : 0.5), 690);
    if (subtitle) { ctx.font = '28px sans-serif'; ctx.fillText(subtitle, 384, canvas.height * 0.77, 690); }
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: texture }); const geometry = new PlaneGeometry(width, height);
    this.root.add(new Mesh(geometry, material)); this.root.position.set(...position); this.root.rotation.y = yaw;
    this.resources.add(texture); this.resources.add(material); this.resources.add(geometry);
  }
}
