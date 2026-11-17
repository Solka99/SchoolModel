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
    this.start.disabled = false; this.start.innerHTML = 'Explore <span>→</span>';
    document.querySelector('#rush-button').disabled = false;
    this.status.textContent = 'Click to enter the school.';
  }
  paused(hasStarted, hasRun = false) {
    this.welcome.hidden = false; document.body.classList.remove('playing'); this.setPrompt('');
    if (hasStarted && !hasRun) { this.start.innerHTML = 'Back to school <span>→</span>'; this.status.textContent = 'Paused · click to continue.'; }
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
    const routeText = run.state === 'won' ? 'Classroom reached' : run.state === 'lost' ? 'Time is up' :
      run.state === 'paused' ? 'Timer and carts paused' : run.state === 'ready' ? 'Find the key and raise the barriers' :
      run.hasKey ? `Key collected · raise barrier ${run.nextGateIndex + 1}` :
      run.keyRoom ? `Find the key in Room ${run.keyRoom}` :
      run.nextGateIndex !== null ? 'Find a key in an accessible classroom' : 'Barriers are raised · reach your classroom';
    const route = document.querySelector('#race-route'); if (route.textContent !== routeText) route.textContent = routeText;
    document.querySelector('#settings-button').disabled = run.active;
    document.querySelector('#target-room').disabled = run.state === 'ready' || run.state === 'running' || run.state === 'paused';
    document.querySelector('#rush-button').disabled = !this.start || this.start.disabled;
    if (this.runState === run.state) return;
    this.runState = run.state;
    const title = document.querySelector('#welcome-title'), intro = document.querySelector('#welcome-intro');
    const primary = document.querySelector('#rush-button'), result = document.querySelector('#run-result');
    result.hidden = !run.finished;
    if (run.state === 'won') {
      title.textContent = 'You made it.';
      intro.textContent = `You reached Room ${run.target.number} before the bell.`;
      result.textContent = `${run.timer.display} left · ${run.hits} penalties · ${run.penaltySeconds}s lost`;
    } else if (run.state === 'lost') {
      title.textContent = 'Time is up.';
      intro.textContent = `Time ran out before you reached Room ${run.target.number}.`;
      result.textContent = `${run.hits} penalties · ${run.penaltySeconds}s lost. A fresh run resets the obstacles and barriers.`;
    } else if (run.state === 'paused') {
      title.textContent = 'Run paused';
      intro.textContent = `Paused at ${run.timer.display}. Continue to Room ${run.target.number}, or leave the run to explore.`;
    } else if (run.state === 'ready') {
      title.textContent = 'Choose a classroom';
      intro.textContent = `Find a key, raise the corridor barriers, and reach Room ${run.target.number} in 45 seconds.`;
    } else if (run.state === 'idle') {
      title.textContent = 'Explore the school';
      intro.textContent = 'Walk through the corridors, visit a classroom, or try to reach one before the 45-second timer runs out.';
    }
    primary.innerHTML = `${run.state === 'paused' ? 'Resume run' : run.state === 'ready' ? 'Start run' : run.finished ? 'Try again' : 'Start 45-second challenge'} <span>→</span>`;
    this.start.innerHTML = `${run.active ? 'Leave run & explore' : 'Explore'} <span>→</span>`;
    if (run.active) this.status.textContent = run.state === 'running' ? 'R restarts · Escape pauses' : 'Click to continue · R resets the run';
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
