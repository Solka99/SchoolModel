export class InputManager {
  constructor(canvas, onLockChange, onCommand) {
    this.canvas = canvas; this.enabled = true; this.keys = new Set(); this.pressed = new Set(); this.dx = 0; this.dy = 0;
    this.abort = new AbortController(); const options = { signal: this.abort.signal };
    document.addEventListener('pointerlockchange', () => { this.clear(); onLockChange(this.locked); }, options);
    document.addEventListener('pointerlockerror', () => onCommand('lock-error'), options);
    document.addEventListener('mousemove', e => { if (this.locked && this.enabled) { this.dx += e.movementX; this.dy += e.movementY; } }, options);
    document.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || document.querySelector('dialog[open]')) return;
      if (!this.locked || !this.enabled) return;
      if (['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        if (e.code === 'Tab') onCommand('settings');
        if (e.code === 'KeyB') onCommand('debug');
        if (e.code === 'KeyR') onCommand('respawn');
      }
      this.keys.add(e.code);
    }, options);
    document.addEventListener('keyup', e => this.keys.delete(e.code), options);
    canvas.addEventListener('mousedown', e => { if (e.button === 0 && this.locked && this.enabled) this.pressed.add('KeyE'); }, options);
    window.addEventListener('blur', () => { this.clear(); this.unlock(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.unlock(); } }, options);
  }
  get locked() { return document.pointerLockElement === this.canvas; }
  async lock() {
    this.clear();
    try { await this.canvas.requestPointerLock(); } catch (error) {
      console.info('Mouse capture could not start:', error.message);
    }
  }
  unlock() { if (this.locked) document.exitPointerLock(); this.clear(); }
  clear() { this.keys.clear(); this.pressed.clear(); this.dx = 0; this.dy = 0; }
  consume(code) { const down = this.pressed.has(code); this.pressed.delete(code); return down; }
  mouse() { const result = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return result; }
  get intent() { return { x: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')), z: Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) }; }
  dispose() { this.abort.abort(); this.unlock(); }
}
