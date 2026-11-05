export class HUD {
  constructor() {
    this.welcome = document.querySelector('#welcome'); this.start = document.querySelector('#start-button');
    this.status = document.querySelector('#load-status'); this.prompt = document.querySelector('#prompt');
    this.crosshair = document.querySelector('#crosshair'); this.lastPrompt = '';
  }
  ready(school) {
    this.describeSchool(school);
    this.start.disabled = false; this.start.innerHTML = 'Enter the school <span>↗</span>';
    this.status.textContent = 'Click to begin · keyboard and mouse required';
  }
  paused(hasStarted) {
    this.welcome.hidden = false; document.body.classList.remove('playing'); this.setPrompt('');
    if (hasStarted) { this.start.innerHTML = 'Back to school <span>↗</span>'; this.status.textContent = 'Paused · click to capture your mouse again'; }
  }
  playing() { this.welcome.hidden = true; document.body.classList.add('playing'); }
  setPrompt(message, key = 'E', { title = '', detail = '', available = true } = {}) {
    const id = `${key}:${message}:${title}:${detail}:${available}`;
    if (id === this.lastPrompt) return;
    this.lastPrompt = id; this.prompt.replaceChildren();
    this.prompt.style.display = message ? 'flex' : 'none';
    this.crosshair.classList.toggle('active', Boolean(message));
    this.prompt.classList.toggle('waiting', !available);
    this.prompt.setAttribute('aria-disabled', String(!available));
    if (message) {
      const kbd = document.createElement('kbd'); kbd.textContent = key;
      const copy = document.createElement('span'); copy.className = 'prompt-copy';
      if (title) { const heading = document.createElement('strong'); heading.textContent = title; copy.append(heading); }
      const action = document.createElement('span'); action.textContent = message; copy.append(action);
      if (detail) { const hint = document.createElement('small'); hint.textContent = detail; copy.append(hint); }
      this.prompt.append(kbd, copy);
    }
  }
  mode(text) { document.querySelector('#mode-label').textContent = text; }
  location(text) {
    const label = document.querySelector('#location-label');
    if (label.textContent !== text) label.textContent = text;
  }
  describeSchool(school) {
    document.querySelector('#school-summary').textContent = `${school.rooms.length} classrooms. One school to explore.`;
    const directory = document.querySelector('#school-directory'); directory.replaceChildren();
    for (const room of school.rooms) {
      const item = document.createElement('span');
      const number = document.createElement('b'); number.textContent = room.number;
      item.append(number, document.createTextNode(room.subject)); directory.append(item);
    }
  }
  toast(message) {
    const toast = document.querySelector('#toast'); toast.textContent = message; toast.style.display = 'block';
    clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
  }
  error(error) {
    document.body.classList.add('fatal'); this.welcome.hidden = false;
    this.status.textContent = error.message || String(error); this.start.disabled = false;
    this.start.innerHTML = 'Reload school <span>↻</span>'; this.start.onclick = () => location.reload();
  }
}
