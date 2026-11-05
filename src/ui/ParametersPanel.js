import { PARAMETERS, DEFAULTS, normalizeParams } from '../config/classroom.js';

export class ParametersPanel {
  constructor(game) {
    this.game = game; this.dialog = document.querySelector('#settings-dialog'); this.inputs = new Map();
    const fields = document.querySelector('#parameter-fields');
    for (const descriptor of PARAMETERS) {
      const label = document.createElement('label'); label.textContent = descriptor.label;
      const input = document.createElement('input'); input.type = 'number'; input.name = descriptor.key;
      input.min = descriptor.min; input.max = descriptor.max; input.step = descriptor.step; input.required = true;
      label.append(input); fields.append(label); this.inputs.set(descriptor.key, input);
    }
    document.querySelector('#settings-button').addEventListener('click', () => this.open());
    document.querySelector('#close-settings').addEventListener('click', () => this.dialog.close());
    document.querySelector('#settings-form').addEventListener('submit', e => { e.preventDefault(); this.apply(); });
    document.querySelector('#reset-button').addEventListener('click', () => { this.game.rebuild(DEFAULTS); this.sync(); this.dialog.close(); });
    document.querySelector('#debug-checkbox').addEventListener('change', e => game.setDebug(e.target.checked));
  }
  sync() { for (const [key, input] of this.inputs) input.value = this.game.world.hall.params[key]; }
  open() {
    if (!this.game.ready || document.querySelector('dialog[open]')) return;
    this.game.pause(); this.sync(); this.dialog.showModal();
  }
  apply() {
    const params = normalizeParams({ ...this.game.world.hall.params, ...Object.fromEntries([...this.inputs].map(([key, input]) => [key, Number(input.value)])) });
    this.game.rebuild(params); this.sync(); this.dialog.close();
    this.game.hud.toast('Room rebuilt. Click Enter classroom to explore.');
  }
}
