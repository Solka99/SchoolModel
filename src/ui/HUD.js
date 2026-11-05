export class HUD {
  constructor() {
    this.welcome = document.querySelector('#welcome'); this.start = document.querySelector('#start-button');
    this.status = document.querySelector('#load-status'); this.prompt = document.querySelector('#prompt');
    this.crosshair = document.querySelector('#crosshair'); this.lastPrompt = '';
  }
  ready() {
    this.start.disabled = false; this.start.innerHTML = 'Enter the classroom <span>↗</span>';
    this.status.textContent = 'Click to begin · keyboard and mouse required';
  }
  paused(hasStarted) {
    this.welcome.hidden = false; document.body.classList.remove('playing'); this.setPrompt('');
    if (hasStarted) { this.start.innerHTML = 'Back to the classroom <span>↗</span>'; this.status.textContent = 'Paused · click to capture your mouse again'; }
  }
  playing() { this.welcome.hidden = true; document.body.classList.add('playing'); }
  setPrompt(message, key = 'E') {
    const id = `${key}:${message}`;
    if (id === this.lastPrompt) return;
    this.lastPrompt = id; this.prompt.replaceChildren();
    this.prompt.style.display = message ? 'block' : 'none';
    this.crosshair.classList.toggle('active', Boolean(message));
    if (message) {
      const kbd = document.createElement('kbd'); kbd.textContent = key;
      this.prompt.append(kbd, document.createTextNode(message));
    }
  }
  mode(text) { document.querySelector('#mode-label').textContent = text; }
  toast(message) {
    const toast = document.querySelector('#toast'); toast.textContent = message; toast.style.display = 'block';
    clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
  }
  error(error) {
    document.body.classList.add('fatal'); this.welcome.hidden = false;
    this.status.textContent = error.message || String(error); this.start.disabled = false;
    this.start.innerHTML = 'Reload classroom <span>↻</span>'; this.start.onclick = () => location.reload();
  }
}
