import { WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Vector3 } from 'three';
import { World } from '../world/World.js';
import { School } from '../world/School.js';
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
import { GameManager } from '../gameplay/GameManager.js';

export const FIXED_STEP = 1 / 120;
export class Game {
  constructor() {
    this.hud = new HUD(); this.ready = false; this.started = false; this.running = false;
    this.accumulator = 0; this.lastTime = null; this.lastTargetUpdate = -Infinity;
    this.renderPending = true; this.disposed = false;
    this.rush = new GameManager();
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace; this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1));
    this.renderer.domElement.setAttribute('aria-label', '3D school. Choose Explore to activate mouse and keyboard controls.');
    document.querySelector('#app').append(this.renderer.domElement);
    this.world = new World(); addLighting(this.world.scene);
    this.models = new ModelLibrary(); this.player = new CharacterController(); this.view = new FirstPersonCamera();
    this.debug = new ColliderDebug(this.world.scene);
    this.input = new InputManager(this.renderer.domElement, locked => this.onLock(locked), command => this.command(command));
    this.interactions = new InteractionSystem(this); this.editor = new BlackboardEditor(this); this.parameters = new ParametersPanel(this);
    this.hud.start.addEventListener('click', () => {
      if (!this.ready) return;
      if (this.rush.active) this.rebuild(this.world.school.params);
      this.input.lock();
    });
    document.querySelector('#rush-button').addEventListener('click', () => {
      if (!this.ready) return;
      if (this.rush.state === 'paused' || this.rush.state === 'ready') this.input.lock();
      else this.beginRush();
    });
    document.querySelector('#help-button').addEventListener('click', () => {
      if (document.querySelector('dialog[open]')) return;
      this.pause(); document.querySelector('#help-dialog').showModal();
    });
    document.querySelector('#close-help').addEventListener('click', () => document.querySelector('#help-dialog').close());
    this.resize = () => {
      this.renderer.setSize(innerWidth, innerHeight); this.view.resize(innerWidth, innerHeight);
      this.renderPending = true;
    };
    window.addEventListener('resize', this.resize); this.resize();
    this.frame = this.frame.bind(this);
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.pause(); this.hud.error(new Error('The graphics context was lost. Reload to restore the school.'));
    });
  }
  async start() {
    await this.models.load((loaded, total) => { this.hud.status.textContent = `Preparing models · ${loaded} / ${total}`; });
    this.rebuild(); this.ready = true; this.previewCamera(); this.hud.ready(this.world.school);
    this.animation = requestAnimationFrame(this.frame);
  }
  previewCamera() {
    const [x, , z] = this.world.school.spawn;
    this.view.camera.position.set(x, 1.9, z);
    this.view.camera.lookAt(x + 8, 1.5, z); this.view.camera.updateMatrixWorld(true);
    this.renderPending = true;
  }
  rebuild(params, { targetRoom = null } = {}) {
    // Construct before removing the old school, so failed construction is recoverable.
    const nextSchool = new School(this.models, params, { challenge: Boolean(targetRoom), game: this });
    this.pause(); this.editor.reset(); this.interactions.clear(); this.debug.clear();
    this.rush.reset();
    this.world.setSchool(nextSchool); this.respawn(); this.debug.rebuild(this.world.colliders);
    this.renderPending = true;
    if (targetRoom) {
      this.rush.prepare(nextSchool.rooms.find(r => r.number === targetRoom) || nextSchool.rooms.at(-1));
      if (this.rush.nextGateIndex !== null) this.placeNextKey();
    }
    if (!this.started) this.previewCamera();
    this.parameters?.sync(); this.hud.describeSchool(nextSchool); this.hud.mode(targetRoom ? 'SCHOOL RUSH · READY' : 'SCHOOL EXPLORER');
    this.hud.setRun(this.rush, nextSchool);
  }
  beginRush({ lock = true } = {}) {
    const targetRoom = document.querySelector('#target-room').value || '103';
    this.rebuild(this.world.school.params, { targetRoom });
    if (lock) this.input.lock();
  }
  placeNextKey() {
    const school = this.world.school;
    const corridorIndex = this.rush.nextGateIndex;
    const classrooms = school.rooms.filter(room =>
      room.corridorIndex === corridorIndex && room.corridorIndex < this.rush.reachableCorridors);
    if (!classrooms.length) throw new Error(`No reachable classroom in corridor ${corridorIndex + 1} for the next key.`);
    const room = classrooms[Math.floor(Math.random() * classrooms.length)];
    const key = school.spawnKey(room, this);
    this.world.pickables.push(key.root); this.world.activate(key);
    this.rush.setKeyRoom(room.number);
  }
  collectKey(key) {
    const school = this.world.school;
    if (school.activeKey !== key || !this.rush.collectKey(key.room.number)) return false;
    const pickableIndex = this.world.pickables.indexOf(key.root);
    if (pickableIndex >= 0) this.world.pickables.splice(pickableIndex, 1);
    this.world.dynamic.delete(key);
    key.collected = true; key.root.visible = false; school.activeKey = null;
    this.hud.toast(`Key collected from Room ${key.room.number}`);
    this.hud.setRun(this.rush, school);
    return true;
  }
  onGateUnlocked(door) {
    if (this.rush.nextGateIndex !== null) this.placeNextKey();
    this.hud.toast(`Corridor ${door.index + 1} barrier rising`);
    this.hud.setRun(this.rush, this.world.school);
  }
  respawn() {
    this.editor?.reset();
    this.interactions.clear(); this.input.clear();
    this.player.reset(new Vector3(...this.world.school.spawn));
    this.view.yaw = Math.PI / 2 - this.world.school.layout.corridors[0].yaw;
    this.view.pitch = 0; this.view.sync(this.player.feet);
    this.hud.mode(this.rush.active ? 'SCHOOL RUSH · GET TO CLASS' : 'SCHOOL EXPLORER'); this.hud.location(this.world.school.locationAt(this.player.feet));
  }
  onLock(locked) {
    this.accumulator = 0;
    if (locked && this.ready && !document.querySelector('dialog[open]')) {
      if (this.rush.finished) { this.input.unlock(); return; }
      this.lastTime = null;
      this.rush.start(); this.running = true; this.started = true; this.hud.playing(); this.view.sync(this.player.feet, this.player.eyeStepOffset);
      this.hud.mode(this.rush.active ? 'SCHOOL RUSH · GET TO CLASS' : 'SCHOOL EXPLORER');
      this.hud.setRun(this.rush, this.world.school);
    } else this.pause();
  }
  pause() {
    if (this.running && this.lastTime !== null) this.rush.update(Math.max(0, (performance.now() - this.lastTime) / 1000), this.player.feet);
    this.rush.pause(); this.running = false; this.accumulator = 0; this.lastTime = null;
    this.input.unlock(); this.interactions.clearTarget(); this.hud.paused(this.started, this.rush.active);
    if (this.world.school) this.hud.setRun(this.rush, this.world.school);
  }
  finishRun() {
    this.running = false; this.accumulator = 0; this.lastTime = null;
    this.editor.reset(); this.input.unlock(); this.interactions.clearTarget();
    this.hud.paused(this.started, true); this.hud.setRun(this.rush, this.world.school);
    this.hud.mode(this.rush.state === 'won' ? 'ON TIME · CLASS REACHED' : 'THE BELL HAS RUNG');
  }
  advanceRace(seconds) {
    const previousState = this.rush.state, previousDisplay = this.rush.timer.display;
    this.rush.update(seconds, this.player.feet);
    if (this.rush.finished) this.finishRun();
    if (this.rush.state !== previousState || this.rush.timer.display !== previousDisplay) {
      this.hud.setRun(this.rush, this.world.school);
    }
  }
  command(command) {
    if (command === 'settings') this.parameters.open();
    if (command === 'debug') this.setDebug(!this.debug.enabled);
    if (command === 'respawn') {
      if (this.rush.active) { this.beginRush({ lock: false }); this.hud.toast('Run reset. Click Start run to begin.'); }
      else { this.respawn(); this.hud.toast('Back at the school entrance.'); }
    }
    if (command === 'lock-error') this.hud.toast('Mouse capture was blocked. Click Enter school to try again.');
  }
  setDebug(value) {
    this.debug.enabled = value; this.debug.rebuild(this.world.colliders);
    document.querySelector('#debug-checkbox').checked = value;
    this.renderPending = true;
  }
  step(dt) {
    const jump = this.input.consume('Space');
    // A seated body is intentionally excluded from standing physics and panel obstruction.
    this.world.update(dt, this.interactions.seated ? null : this.player.box);
    if (this.world.school.obstacles?.carts.some(cart => cart.contact) && this.rush.penalize(2)) {
      this.hud.toast('Cleaning cart contact · −2 seconds');
      if (this.rush.finished) { this.finishRun(); return; }
    }
    if (this.interactions.seated) { if (jump) this.interactions.stand(); }
    else this.player.update(dt, this.input.intent, this.view.forward, this.view.right, jump,
      this.world.collidersNear(this.player.box));
    if (this.player.feet.y < -8) {
      this.rush.penalize(3); this.respawn(); this.hud.toast(this.rush.active ? 'Returned to entrance · −3 seconds' : 'Back at the school entrance.');
      if (this.rush.finished) this.finishRun();
    }
  }
  frame(time) {
    if (this.disposed) return;
    const rawElapsed = this.lastTime === null ? 0 : Math.max(0, (time - this.lastTime) / 1000);
    const elapsed = Math.min(0.1, rawElapsed);
    this.lastTime = time;
    if (this.running && !document.hidden) {
      this.view.look(...this.input.mouse()); this.accumulator += elapsed;
      while (this.accumulator >= FIXED_STEP && this.running) { this.step(FIXED_STEP); this.accumulator = Math.max(0, this.accumulator - FIXED_STEP); }
      // The countdown uses active real elapsed time, not the clamped physics delta.
      this.advanceRace(rawElapsed);
      this.view.sync(this.player.feet, this.player.eyeStepOffset);
      this.hud.location(this.world.school.locationAt(this.player.feet));
      if (this.running && time - this.lastTargetUpdate >= 50) {
        this.interactions.update(); this.lastTargetUpdate = time;
      }
      if (this.running && this.input.consume('KeyE')) this.interactions.activate();
    } else this.accumulator = 0;
    if ((this.running && !document.hidden) || this.renderPending) {
      this.renderer.render(this.world.scene, this.view.camera);
      this.renderPending = false;
    }
    this.animation = requestAnimationFrame(this.frame);
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.animation); window.removeEventListener('resize', this.resize);
    this.input.dispose(); this.interactions.dispose(); this.debug.clear(); this.world.clear(); this.models.dispose(); this.renderer.dispose();
  }
}
