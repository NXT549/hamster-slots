// main.ts — BOOT. Wires everything together and runs the frame loop.
//
// Order: data.json (bundled in) → create RNG + game → load save → settings, theme
// frames, sound, UI + debug → pay offline earnings → loop + autosave.
// This is the only place that knows about all the layers. Everything that
// depends on the device (storage, the real-world clock, "the player went away")
// goes through the platform: createWebPlatform() here, and one day a Steam or
// mobile version instead (src/platform/platform.ts).

// Vite bundles data.json into the game's code, so there's no separate file to
// load: it works the same on every platform (and even offline).
import bundledData from '../data.json';
// The two fonts come with the game (the Fontsource packages; both fonts are OFL,
// so that's allowed), so it looks the same offline, on itch.io, and later in the
// desktop and phone apps. Pixelify Sans (pixel words) only at weight 500, Nunito
// (numbers and easy-to-read text) at the four weights style.css uses.
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import { createRng } from './logic/rng.ts';
import { createGame } from './logic/game.ts';
import { createWebPlatform } from './platform/web.ts';
import { loadGame, clearSave, loadSettings, saveSettings } from './platform/save.ts';
import { createAutosave } from './platform/autosave.ts';
import { makeSaveCode, readSaveCode, loadSaveCode } from './platform/savecode.ts';
import { createSound } from './view/sound.ts';
import { applyTheme } from './view/theme.ts';
import { createUI } from './view/ui.ts';
import { createDebugPanel } from './view/debug.ts';
import type { Game } from './logic/game.ts';
import type { GameData } from './logic/types.ts';
import type { Platform } from './platform/platform.ts';
import type { Sound } from './view/sound.ts';

// `hamster` in the browser console (see the end of boot()).
declare global {
  interface Window {
    hamster: { game: Game; clock: { timeScale: number }; ui: ReturnType<typeof createUI>; sound: Sound };
  }
}

// Max real seconds processed per frame. If the tab stalls (or was in the
// background), we don't try to catch up frame by frame: time away is paid
// out as offline earnings instead (see below).
const MAX_FRAME_SECONDS = 0.25;

// Debug "Reload data.json" (only while developing with `npm run dev`): fetch the
// file fresh from the dev server. A built game has no data.json to fetch.
async function fetchData(): Promise<GameData> {
  const response = await fetch('data.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`data.json: HTTP ${response.status}`);
  return response.json();
}

function boot(platform: Platform) {
  // TypeScript reads data.json's own shape; GameData (types.ts) describes it more
  // exactly (e.g. which effect types exist), so the data is treated as a GameData.
  const data = bundledData as unknown as GameData;

  // A new random seed each session. The debug panel shows it, so a weird
  // session can be replayed in a test with createRng(thatSeed).
  const seed = Math.floor(Math.random() * 2 ** 32);
  const game = createGame(data, createRng(seed));
  const { savedAt } = loadGame(game, platform);

  // Shared by the loop and the debug panel's speed buttons.
  const clock = { timeScale: 1 };

  // Saving by itself (it starts after the first frame, below).
  const autosave = createAutosave(game, platform);

  // The player's preferences (sound, motion, numbers …). The UI changes this
  // object and calls onSettingsChange, which writes it back to storage.
  const settings = loadSettings(platform);
  const sound = createSound(settings);
  applyTheme(); // the pixel frames for the cardboard/paper look (reads the CSS colour tokens)

  // The debug panel: always there while developing (npm run dev). In a built game
  // (the public site) only with ?debug in the address, e.g. …/hamster_slots/?debug,
  // so players don't stumble on it but it's still there for testing.
  const debugOn = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  const debug = debugOn
    ? createDebugPanel(game, {
      clock,
      reloadData: import.meta.env.DEV ? async () => game.setData(await fetchData()) : null,
      saveNow: autosave.save,
    })
    : null;

  const ui = createUI(game, {
    sound,
    settings,
    onReset() {
      autosave.stop(); // or the "save when the page closes" would write the old progress straight back
      clearSave(platform);
      location.reload();
    },
    onToggleDebug: debug ? debug.toggle : null, // null: the Menu hides its debug button
    onSettingsChange() {
      settings.muted = sound.muted;
      settings.volume = sound.volume;
      saveSettings(platform, settings);
    },
    // Menu → Save backup (savecode.ts). A loaded save is stored, then the page
    // restarts from it, like after Reset, so every screen starts fresh.
    backup: {
      makeCode: () => makeSaveCode(game, platform),
      readCode: (text) => readSaveCode(text, game.data),
      load(save) {
        if (!loadSaveCode(game, platform, save)) return false;
        location.reload();
        return true;
      },
    },
  });

  // Offline earnings: pay for the time since the last save. game.ts does the
  // maths; we only tell it how many seconds passed (it never reads the clock).
  if (savedAt) game.applyOfflineEarnings((platform.now() - savedAt) / 1000);

  // The frame loop. requestAnimationFrame calls us before each screen repaint
  // (~60×/s). We pass the elapsed time, scaled by debug speed, to the logic,
  // then redraw.
  let last = performance.now();
  function frame(nowMs: number) {
    const realDt = Math.min((nowMs - last) / 1000, MAX_FRAME_SECONDS);
    last = nowMs;
    game.update(realDt * clock.timeScale);
    ui.render();
    debug?.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Autosave on a timer, and whenever the player goes away or closes the game.
  // A hidden tab stops the frame loop, so when it comes back, the time it was
  // hidden is paid out as offline earnings too (autosave.ts).
  autosave.start(data.autosaveSeconds);

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

// The web version of the platform. A Steam or phone version would pass its own.
boot(createWebPlatform());
