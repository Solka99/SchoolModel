export class BlackboardEditor {
  constructor(game) {
    this.game = game; this.dialog = document.querySelector('#editor-dialog'); this.input = document.querySelector('#board-text');
    this.input.addEventListener('input', () => this.sync());
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.close(); }
      if (e.key === 'Delete') { e.preventDefault(); this.input.value = ''; this.sync(); }
    });
    document.querySelector('#clear-board').addEventListener('click', () => { this.input.value = ''; this.sync(); this.input.focus(); });
    document.querySelector('#finish-edit').addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', () => { if (!this.dialog.open) this.finish(); });
  }
  open(board) {
    this.game.pause(); this.game.input.enabled = false; this.board = board; this.input.value = board.text;
    document.querySelector('#editor-title').textContent = board.label;
    this.sync(); this.dialog.showModal(); this.input.focus();
  }
  sync() {
    this.input.value = this.input.value.slice(0, 200);
    if (this.board) this.board.setText(this.input.value);
    document.querySelector('#character-count').textContent = `${this.input.value.length} / 200`;
  }
  finish(notify = true) {
    if (!this.board) return;
    if (this.game.interactions.editing === this.board) this.game.interactions.editing = null;
    this.board = null; this.game.input.enabled = true;
    if (notify) this.game.hud.toast('Board updated. Use Back to school to resume.');
  }
  close() { this.sync(); this.dialog.close(); this.finish(); }
  reset() {
    this.finish(false);
    if (this.dialog.open) this.dialog.close();
    this.game.input.enabled = true;
  }
}
