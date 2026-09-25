// main.js — BOOT. Wires everything together and runs the frame loop.
//
// Order: data.json (bundled in) → create RNG + game → load save → settings, theme
// frames, sound, UI + debug → pay offline earnings → loop.
// This is the only place that knows about all the layers (and the only place,
// besides save.js, that reads the real-world clock with Date.now()).

// Vite bundles data.json into the game's code, so there's no separate file to
// load: it works the same on every platform (and even offline).
import bundledData from '../data.json';
import { createRng } from './logic/rng.ts';
import { createGame } from './logic/game.ts';
import { saveGame, loadGame, clearSave, loadSettings, saveSettings } from './platform/save.js';
import { createSound } from './view/sound.js';
import { applyTheme } from './view/theme.js';
import { createUI } from './view/ui.js';
import { createDebugPanel } from './view/debug.js';

// Max real seconds processed per frame. If the tab stalls (or was in the
// background), we don't try to catch up frame by frame: time away is paid
// out as offline earnings instead (see below).
const MAX_FRAME_SECONDS = 0.25;

// Debug "Reload data.json" (only while developing with `npm run dev`): fetch the
// file fresh from the dev server. A built game has no data.json to fetch.
async function fetchData() {
  const response = await fetch('data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`data.json: HTTP ${response.status}`);
  return response.json();
}

function boot() {
  const data = bundledData;

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
    reloadData: import.meta.env.DEV ? async () => game.setData(await fetchData()) : null,
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

  // While developing (`npm run dev`), Vite watches data.json. Save a change to it
  // and the running game swaps in the new numbers straight away, keeping your
  // progress: no page reload needed.
  if (import.meta.hot) {
    import.meta.hot.accept('../data.json', (mod) => {
      if (mod) game.setData(mod.default);
    });
  }

  // Handy for poking around in the browser console: try  hamster.game.state
  // (hamster.ui.render() draws one frame by hand, e.g. while the tab is hidden.)
  window.hamster = { game, clock, ui, sound };
}

boot();
