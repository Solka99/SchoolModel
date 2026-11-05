import { WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Vector3 } from 'three';
import { World } from '../world/World.js';
import { Classroom } from '../world/Classroom.js';
import { addLighting } from '../world/prefabs.js';
import { ModelLibrary } from '../assets/ModelLibrary.js';
import { FirstPersonCamera } from '../camera/FirstPersonCamera.js';
import { CharacterController } from '../physics/CharacterController.js';
import { InputManager } from './InputManager.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { HUD } from '../ui/HUD.js';
import { BlackboardEditor } from '../ui/BlackboardEditor.js';
import { ParametersPanel } from '../ui/ParametersPanel.js';
import { ColliderDebug } from '../debug/ColliderDebug.js';

export const FIXED_STEP = 1 / 120;
export class Game {
  constructor() {
    this.hud = new HUD(); this.ready = false; this.started = false; this.running = false;
    this.accumulator = 0; this.lastTime = null; this.disposed = false;
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace; this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15; this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.domElement.setAttribute('aria-label', '3D lecture hall. Use Enter classroom to activate mouse and keyboard controls.');
    document.querySelector('#app').append(this.renderer.domElement);
    this.world = new World(); addLighting(this.world.scene);
    this.models = new ModelLibrary(); this.player = new CharacterController(); this.view = new FirstPersonCamera();
    this.debug = new ColliderDebug(this.world.scene);
    this.input = new InputManager(this.renderer.domElement, locked => this.onLock(locked), command => this.command(command));
    this.interactions = new InteractionSystem(this); this.editor = new BlackboardEditor(this); this.parameters = new ParametersPanel(this);
    this.hud.start.addEventListener('click', () => { if (this.ready) this.input.lock(); });
    document.querySelector('#help-button').addEventListener('click', () => {
      if (document.querySelector('dialog[open]')) return;
      this.pause(); document.querySelector('#help-dialog').showModal();
    });
    document.querySelector('#close-help').addEventListener('click', () => document.querySelector('#help-dialog').close());
    this.resize = () => { this.renderer.setSize(innerWidth, innerHeight); this.view.resize(innerWidth, innerHeight); };
    window.addEventListener('resize', this.resize); this.resize();
    this.frame = this.frame.bind(this);
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.pause(); this.hud.error(new Error('The graphics context was lost. Reload to restore the classroom.'));
    });
  }
  async start() {
    await this.models.load((loaded, total) => { this.hud.status.textContent = `Preparing models · ${loaded} / ${total}`; });
    this.rebuild(); this.ready = true; this.previewCamera(); this.hud.ready();
    this.animation = requestAnimationFrame(this.frame);
  }
  previewCamera() {
    const m = this.world.hall.metrics;
    this.view.camera.position.set(m.xRight - 0.9, 3.7, m.zBack - 0.7);
    this.view.camera.lookAt(-1.2, 0.8, m.zFront + 1.5); this.view.camera.updateMatrixWorld(true);
  }
  rebuild(params) {
    // Construct before removing the old hall, so failed construction is recoverable.
    const nextHall = new Classroom(this.models, params);
    this.pause(); this.editor.reset(); this.interactions.clear(); this.debug.clear();
    this.world.setClassroom(nextHall); this.respawn(); this.debug.rebuild(this.world.colliders);
    if (!this.started) this.previewCamera();
    this.parameters?.sync(); this.hud.mode('CLASSROOM EXPLORER');
  }
  respawn() {
    this.interactions.clear(); this.input.clear();
    this.player.reset(new Vector3(...this.world.hall.metrics.spawn));
    this.view.yaw = Math.PI / 2; this.view.pitch = 0; this.view.sync(this.player.feet);
    this.hud.mode('CLASSROOM EXPLORER');
  }
  onLock(locked) {
    this.accumulator = 0; this.lastTime = null;
    if (locked && this.ready && !document.querySelector('dialog[open]')) {
      this.running = true; this.started = true; this.hud.playing(); this.view.sync(this.player.feet, this.player.eyeStepOffset);
    } else { this.running = false; this.hud.paused(this.started); }
  }
  pause() { this.running = false; this.accumulator = 0; this.input.unlock(); this.hud.paused(this.started); }
  command(command) {
    if (command === 'settings') this.parameters.open();
    if (command === 'debug') this.setDebug(!this.debug.enabled);
    if (command === 'respawn') { this.respawn(); this.hud.toast('Back at the front of the room.'); }
    if (command === 'lock-error') this.hud.toast('Mouse capture was blocked. Click Enter classroom to try again.');
  }
  setDebug(value) {
    this.debug.enabled = value; this.debug.rebuild(this.world.colliders);
    document.querySelector('#debug-checkbox').checked = value;
  }
  step(dt) {
    const jump = this.input.consume('Space');
    // A seated body is intentionally excluded from standing physics and panel obstruction.
    this.world.update(dt, this.interactions.seated ? null : this.player.box);
    if (this.interactions.seated) { if (jump) this.interactions.stand(); }
    else this.player.update(dt, this.input.intent, this.view.forward, this.view.right, jump, this.world.colliders);
    if (this.player.feet.y < -8) { this.respawn(); this.hud.toast('You stepped off the landing. Back to class.'); }
  }
  frame(time) {
    if (this.disposed) return;
    const elapsed = this.lastTime === null ? 0 : Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.running && !document.hidden) {
      this.view.look(...this.input.mouse()); this.accumulator += elapsed;
      while (this.accumulator >= FIXED_STEP && this.running) { this.step(FIXED_STEP); this.accumulator -= FIXED_STEP; }
      this.view.sync(this.player.feet, this.player.eyeStepOffset);
      this.interactions.update();
      if (this.input.consume('KeyE')) this.interactions.activate();
      if (this.running) this.view.sync(this.player.feet, this.player.eyeStepOffset);
    } else this.accumulator = 0;
    this.renderer.render(this.world.scene, this.view.camera);
    this.animation = requestAnimationFrame(this.frame);
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.animation); window.removeEventListener('resize', this.resize);
    this.input.dispose(); this.debug.clear(); this.world.clear(); this.models.dispose(); this.renderer.dispose();
  }
}
