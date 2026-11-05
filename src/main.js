import './styles.css';
import { Game } from './core/Game.js';

let game;
try {
  game = new Game();
  if (import.meta.env.DEV) window.schoolRush = game;
  await game.start();
} catch (error) {
  console.error(error);
  if (game) game.hud.error(error);
  else {
    document.querySelector('#load-status').textContent = 'WebGL could not start. Try a browser with hardware acceleration enabled.';
    document.querySelector('#start-button').textContent = 'WebGL unavailable';
  }
}
if (import.meta.hot) import.meta.hot.dispose(() => game?.dispose());
