export class BlackboardEditor {
  constructor(game) {
    this.game = game; this.dialog = document.querySelector('#editor-dialog'); this.input = document.querySelector('#board-text');
    this.input.addEventListener('input', () => this.sync());
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.close(); }
      if (e.key === 'Delete') { e.preventDefault(); this.input.value = ''; this.sync(); }
    });
    document.querySelector('#clear-board').addEventListener('click', () => { this.input.value = ''; this.sync(); this.input.focus(); });
    document.querySelector('#finish-edit').addEventListener('click', () => this.close());
    this.dialog.addEventListener('close', () => {
      this.game.interactions.editing = null; this.board = null; this.game.input.enabled = true;
      this.game.hud.toast('Board updated. Click Enter school to continue.');
    });
  }
  open(board) {
    this.game.pause(); this.game.input.enabled = false; this.board = board; this.input.value = board.text;
    this.sync(); this.dialog.showModal(); this.input.focus();
  }
  sync() {
    if (this.board) this.board.setText(this.input.value);
    document.querySelector('#character-count').textContent = `${this.input.value.length} / 200`;
  }
  close() { this.sync(); this.dialog.close(); }
  reset() {
    this.board = null;
    if (this.dialog.open) this.dialog.close();
    this.game.input.enabled = true;
  }
}
