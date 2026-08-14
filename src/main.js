// ───────────────────────────────────────────────────────────────────────────
// HOME — Mansion & Family.  Entry point.
// ───────────────────────────────────────────────────────────────────────────
import { Game } from './game.js';

const canvas = document.getElementById('viewport');

function fatal(err) {
  console.error(err);
  const box = document.getElementById('loadtext');
  if (box) {
    box.innerHTML = `Something went wrong.<br><span style="color:#e78ba7">${String(err?.message || err)}</span>`;
  }
}

async function boot() {
  if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) {
    fatal(new Error('This browser has no WebGL — try Chrome, Edge, Firefox or Safari.'));
    return;
  }
  const game = new Game(canvas);
  window.game = game;               // handy from the console

  try {
    await game.load();
  } catch (e) {
    fatal(e);
    return;
  }

  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      game.frame(dt);
    } catch (e) {
      fatal(e);
      throw e;
    }
  };
  requestAnimationFrame(loop);

  canvas.addEventListener('click', () => {
    if (game.state === 'play' && !game.input.locked && !game.dialogue) {
      game.input.requestLock();
      game.audio.resume();
    }
  });
}

boot();
