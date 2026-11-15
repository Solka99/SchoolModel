export class Timer {
  constructor(seconds = 45) { this.reset(seconds); }
  reset(seconds = this.duration) {
    const value = Number(seconds);
    this.duration = Number.isFinite(value) && value > 0 ? Math.max(1, value) : 45; this.remaining = this.duration;
  }
  advance(seconds) { this.remaining = Math.max(0, this.remaining - Math.max(0, Number(seconds) || 0)); }
  get expired() { return this.remaining <= 0; }
  get display() {
    const seconds = Math.ceil(this.remaining);
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}
