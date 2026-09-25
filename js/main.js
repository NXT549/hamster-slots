// main.js — BOOT. Wires everything together and runs the frame loop.
//
// Order: load data.json → create RNG + game → load save → settings, theme frames,
// sound, UI + debug → pay offline earnings → loop.
// This is the only place that knows about all the layers (and the only place,
// besides save.js, that reads the real-world clock with Date.now()).
// Godot equivalent: the autoloads (GameData, Game, SaveManager) + the Main scene.

import { createRng } from './rng.js';
import { createGame } from './game.js';
import { saveGame, loadGame, clearSave, loadSettings, saveSettings } from './save.js';
import { createSound } from './sound.js';
import { applyTheme } from './theme.js';
import { createUI } from './ui.js';
import { createDebugPanel } from './debug.js';

// Max real seconds processed per frame. If the tab stalls (or was in the
// background), we don't try to catch up frame by frame: time away is paid
// out as offline earnings instead (see below).
const MAX_FRAME_SECONDS = 0.25;

async function loadData() {
  // cache: 'no-store' so edits to data.json show up on reload straight away.
  const response = await fetch('data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`data.json: HTTP ${response.status}`);
  return response.json();
}

function showBootError(err) {
  const box = document.getElementById('boot-error');
  box.innerHTML = `
    <div class="panel">
      <p><b>Couldn't load data.json.</b></p>
      <p>Browsers block this when <code>index.html</code> is opened straight from disk.
      Start the game by double-clicking <b>play.bat</b> instead.</p>
      <p class="small">${String(err && err.message ? err.message : err)}</p>
    </div>`;
  box.classList.remove('hidden');
}

async function boot() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    showBootError(err);
    return;
  }

  // A new random seed each session. The debug panel shows it, so a weird
  // session can be replayed in a test with createRng(thatSeed).
  const seed = Math.floor(Math.random() * 2 ** 32);
  const game = createGame(data, createRng(seed));
  const { savedAt } = loadGame(game);

  // Shared by the loop and the debug panel's speed buttons.
  const clock = { timeScale: 1 };

  // While resetting, stop all saving. Otherwise the "save on page close"
  // handler would write the old progress straight back.
  let resetting = false;
  const save = () => (resetting ? false : saveGame(game));

  // The player's preferences (sound, motion, numbers …). The UI changes this
  // object and calls onSettingsChange, which writes it back to storage.
  const settings = loadSettings();
  const sound = createSound(settings);
  applyTheme(); // the pixel frames for the cardboard/paper look (reads the CSS colour tokens)

  const debug = createDebugPanel(game, {
    clock,
    reloadData: async () => game.setData(await loadData()),
    saveNow: save,
  });

  const ui = createUI(game, {
    sound,
    settings,
    onReset() {
      resetting = true;
      clearSave();
      location.reload();
    },
    onToggleDebug: debug.toggle,
    onSettingsChange() {
      settings.muted = sound.muted;
      settings.volume = sound.volume;
      saveSettings(settings);
    },
  });

  // Offline earnings: pay for the time since the last save. game.js does the
  // maths; we only tell it how many seconds passed (it never reads the clock).
  if (savedAt) game.applyOfflineEarnings((Date.now() - savedAt) / 1000);

  // The frame loop. requestAnimationFrame calls us before each screen repaint
  // (~60×/s). We pass the elapsed time, scaled by debug speed, to the logic,
  // then redraw.
  let last = performance.now();
  function frame(nowMs) {
    const realDt = Math.min((nowMs - last) / 1000, MAX_FRAME_SECONDS);
    last = nowMs;
    game.update(realDt * clock.timeScale);
    ui.render();
    debug.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Autosave on a timer, and whenever the tab is hidden or closed.
  // A hidden tab stops the frame loop, so when it comes back, the time it was
  // hidden is paid out as offline earnings too.
  setInterval(save, data.autosaveSeconds * 1000);
  let hiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      save();
      hiddenAt = Date.now();
    } else if (hiddenAt !== null) {
      game.applyOfflineEarnings((Date.now() - hiddenAt) / 1000);
      hiddenAt = null;
    }
  });
  window.addEventListener('pagehide', save);

  // Handy for poking around in the browser console: try  hamster.game.state
  // (hamster.ui.render() draws one frame by hand, e.g. while the tab is hidden.)
  window.hamster = { game, clock, ui, sound };
}

boot();
