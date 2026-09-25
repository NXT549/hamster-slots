// autosave.ts — PLATFORM layer: saving by itself, and paying for time away.
//
// It only uses the Platform interface, so it works the same on every platform.
//   - Every `everySeconds`, and whenever the player goes away or closes the
//     game, it saves.
//   - A hidden page stops the frame loop (browsers pause it), so when the player
//     comes back, the time they were away is paid out as offline earnings.
//     (Time since the LAST VISIT is paid by main.ts when the game starts.)

import type { Game } from '../logic/game.ts';
import type { Platform } from './platform.ts';
import { saveGame } from './save.ts';

export function createAutosave(game: Game, platform: Platform) {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let hiddenAt: number | null = null;

  // Save now. Returns false if it failed (or saving was stopped).
  const save = () => (stopped ? false : saveGame(game, platform));

  return {
    save,

    // Start saving by itself.
    start(everySeconds: number): void {
      timer = setInterval(save, everySeconds * 1000);
      platform.lifecycle.onHide(() => {
        save();
        hiddenAt = platform.now();
      });
      platform.lifecycle.onShow(() => {
        if (hiddenAt === null) return;
        // The logic does the maths; we only tell it how many seconds passed (it never reads the clock).
        game.applyOfflineEarnings((platform.now() - hiddenAt) / 1000);
        hiddenAt = null;
      });
      platform.lifecycle.onClose(save);
    },

    // Stop all saving, for good (Reset). Otherwise the "save when the page
    // closes" handler would write the old progress straight back.
    stop(): void {
      stopped = true;
      clearInterval(timer);
    },
  };
}
