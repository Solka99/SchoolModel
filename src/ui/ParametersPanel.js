import { SCHOOL_PARAMETERS, SCHOOL_DEFAULTS, normalizeSchoolParams } from '../config/school.js';

export class ParametersPanel {
  constructor(game) {
    this.game = game; this.dialog = document.querySelector('#settings-dialog'); this.inputs = new Map();
    const fields = document.querySelector('#parameter-fields');
    for (const descriptor of SCHOOL_PARAMETERS) {
      const label = document.createElement('label'); label.textContent = descriptor.label;
      const input = document.createElement('input'); input.type = 'number'; input.name = descriptor.key;
      input.min = descriptor.min; input.max = descriptor.max; input.step = descriptor.step; input.required = true;
      label.append(input); fields.append(label); this.inputs.set(descriptor.key, input);
    }
    document.querySelector('#settings-button').addEventListener('click', () => this.open());
    document.querySelector('#close-settings').addEventListener('click', () => this.dialog.close());
    document.querySelector('#settings-form').addEventListener('submit', e => { e.preventDefault(); this.apply(); });
    document.querySelector('#reset-button').addEventListener('click', () => { this.game.rebuild(SCHOOL_DEFAULTS); this.sync(); this.dialog.close(); });
    document.querySelector('#debug-checkbox').addEventListener('change', e => game.setDebug(e.target.checked));
  }
  sync() { for (const [key, input] of this.inputs) input.value = this.game.world.school.params[key]; }
  open() {
    if (!this.game.ready || document.querySelector('dialog[open]')) return;
    this.game.pause(); this.sync(); this.dialog.showModal();
  }
  apply() {
    const params = normalizeSchoolParams({ ...this.game.world.school.params, ...Object.fromEntries([...this.inputs].map(([key, input]) => [key, Number(input.value)])) });
    this.game.rebuild(params); this.sync(); this.dialog.close();
    this.game.hud.toast('School rebuilt. Click Enter school to explore.');
  }
}
