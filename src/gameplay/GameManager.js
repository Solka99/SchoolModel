import { Timer } from './Timer.js';

export class GameManager {
  constructor() { this.timer = new Timer(); this.reset(); }
  reset() {
    this.timer.reset(45); this.state = 'idle'; this.target = null; this.hits = 0; this.penaltySeconds = 0;
    this.routeGates = []; this.gatesOpened = 0; this.hasKey = false; this.keyRoom = null;
  }
  prepare(target, seconds = 45) {
    if (!target?.bounds || !target.number) throw new Error('Choose a valid classroom.');
    this.timer.reset(seconds); this.target = target; this.hits = 0; this.penaltySeconds = 0;
    const corridorIndex = Number.isInteger(target.corridorIndex) ? target.corridorIndex : 0;
    this.routeGates = Array.from({ length: corridorIndex }, (_, index) => index);
    this.gatesOpened = 0; this.hasKey = false; this.keyRoom = null; this.state = 'ready';
  }
  start() { if (this.state === 'ready' || this.state === 'paused') this.state = 'running'; }
  pause() { if (this.state === 'running') this.state = 'paused'; }
  get active() { return this.state !== 'idle'; }
  get finished() { return this.state === 'won' || this.state === 'lost'; }
  get nextGateIndex() { return this.routeGates[this.gatesOpened] ?? null; }
  get reachableCorridors() { return this.gatesOpened + 1; }
  setKeyRoom(number) { this.keyRoom = number; }
  collectKey(number) {
    if (this.state !== 'running' || this.hasKey || !number) return false;
    this.hasKey = true; this.keyRoom = null; return true;
  }
  unlockGate(gate) {
    if (this.state !== 'running' || !this.hasKey || gate.index !== this.nextGateIndex) return false;
    this.hasKey = false; this.keyRoom = null; this.gatesOpened++; return true;
  }
  arrived(feet) {
    if (!this.target || !feet) return false;
    const b = this.target.localBounds || this.target.bounds, margin = 0.22;
    let x = feet.x, z = feet.z;
    if (this.target.localBounds) {
      const dx = feet.x - this.target.origin[0], dz = feet.z - this.target.origin[2];
      x = Math.cos(this.target.yaw) * dx - Math.sin(this.target.yaw) * dz;
      z = Math.sin(this.target.yaw) * dx + Math.cos(this.target.yaw) * dz;
    }
    return feet.y >= -0.05 && x > b.minX + margin && x < b.maxX - margin &&
      z > b.minZ + margin && z < b.maxZ - margin;
  }
  update(seconds, feet) {
    if (this.state !== 'running') return;
    this.timer.advance(seconds);
    // Expiry takes priority at the deadline; touching a doorway is not arrival.
    if (this.timer.expired) this.state = 'lost';
    else if (this.arrived(feet)) this.state = 'won';
  }
  penalize(seconds) {
    if (this.state !== 'running') return false;
    const penalty = Math.max(0, Number(seconds) || 0);
    if (!penalty) return false;
    this.hits++; this.penaltySeconds += penalty; this.timer.advance(penalty);
    if (this.timer.expired) this.state = 'lost';
    return true;
  }
}
