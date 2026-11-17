import { ROOM_SPECS } from '../config/school.js';

export class HUD {
  constructor() {
    this.welcome = document.querySelector('#welcome'); this.start = document.querySelector('#start-button');
    this.status = document.querySelector('#load-status'); this.prompt = document.querySelector('#prompt');
    this.crosshair = document.querySelector('#crosshair'); this.lastPrompt = '';
    this.describeSchool({ rooms: ROOM_SPECS });
  }
  ready(school) {
    this.describeSchool(school);
    this.start.disabled = false; this.start.textContent = 'Explore';
    document.querySelector('#rush-button').disabled = false;
    this.status.textContent = 'Ready';
  }
  paused(hasStarted, hasRun = false) {
    this.welcome.hidden = false; document.body.classList.remove('playing'); this.setPrompt('');
    if (hasStarted && !hasRun) { this.start.textContent = 'Resume'; this.status.textContent = 'Paused'; }
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
    const directory = document.querySelector('#school-directory'); directory.replaceChildren();
    for (const room of school.rooms) {
      const item = document.createElement('span');
      const number = document.createElement('b'); number.textContent = room.number;
      item.append(number, document.createTextNode(room.subject)); directory.append(item);
    }
    const select = document.querySelector('#target-room'), previous = select.value || '103'; select.replaceChildren();
    for (const room of school.rooms) {
      const option = document.createElement('option'); option.value = room.number; option.textContent = `Room ${room.number} · ${room.subject}`; select.append(option);
    }
    select.value = previous;
  }
  setRun(run, school) {
    const hud = document.querySelector('#race-hud'); hud.hidden = !run.active;
    const clock = document.querySelector('#race-clock');
    if (clock.textContent !== run.timer.display) clock.textContent = run.timer.display;
    hud.classList.toggle('urgent', run.timer.remaining <= 10); hud.dataset.state = run.state;
    document.querySelector('#race-destination').textContent = run.target ? `ROOM ${run.target.number} / ${run.target.subject.toUpperCase()}` : '';
    const routeText = run.state === 'won' ? 'Reached' : run.state === 'lost' ? 'Time up' :
      run.state === 'paused' ? 'Paused' : run.state === 'ready' ? 'Find a key' :
      run.hasKey ? `Open barrier ${run.nextGateIndex + 1}` :
      run.keyRoom ? `Key: Room ${run.keyRoom}` :
      run.nextGateIndex !== null ? 'Find a key' : 'Reach the room';
    const route = document.querySelector('#race-route'); if (route.textContent !== routeText) route.textContent = routeText;
    document.querySelector('#settings-button').disabled = run.active;
    const selectionLocked = run.state === 'ready' || run.state === 'running' || run.state === 'paused';
    document.querySelector('#target-room').disabled = selectionLocked;
    document.querySelector('#challenge-time').disabled = selectionLocked;
    document.querySelector('#rush-button').disabled = !this.start || this.start.disabled;
    if (this.runState === run.state) return;
    this.runState = run.state;
    const title = document.querySelector('#welcome-title'), intro = document.querySelector('#welcome-intro');
    const primary = document.querySelector('#rush-button'), result = document.querySelector('#run-result');
    result.hidden = !run.finished;
    if (run.state === 'won') {
      title.textContent = 'You made it.';
      intro.textContent = `Room ${run.target.number}.`;
      result.textContent = `${run.timer.display} left · ${run.hits} hits`;
    } else if (run.state === 'lost') {
      title.textContent = 'Time is up.';
      intro.textContent = `Room ${run.target.number} was not reached.`;
      result.textContent = `${run.hits} hits`;
    } else if (run.state === 'paused') {
      title.textContent = 'Run paused';
      intro.textContent = `Room ${run.target.number} · ${run.timer.display}`;
    } else if (run.state === 'ready') {
      title.textContent = 'Challenge';
      intro.textContent = `Reach Room ${run.target.number} in ${run.timer.duration} seconds.`;
    } else if (run.state === 'idle') {
      title.textContent = 'School';
      intro.textContent = 'Explore the halls or get to a classroom before time runs out.';
    }
    primary.textContent = run.state === 'paused' ? 'Resume' : run.state === 'ready' ? 'Start' : run.finished ? 'Try again' : 'Start challenge';
    this.start.textContent = 'Explore';
    if (run.active) this.status.textContent = run.state === 'running' ? 'Esc pauses · R resets' : 'Paused · R resets';
  }
  toast(message) {
    const toast = document.querySelector('#toast'); toast.textContent = message; toast.style.display = 'block';
    clearTimeout(this.toastTimeout); this.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3500);
  }
  error(error) {
    document.body.classList.add('fatal'); this.welcome.hidden = false;
    this.status.textContent = error.message || String(error); this.start.disabled = false;
    this.start.textContent = 'Reload'; this.start.onclick = () => location.reload();
  }
}
