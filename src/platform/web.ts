// web.ts — the PLATFORM for a web browser (GitHub Pages, itch.io, play.bat).
// The only file that uses localStorage and the page's hide/close events.

import type { Platform } from './platform.ts';

export function createWebPlatform(): Platform {
  return {
    // localStorage keeps text per site (address + port), so the save on
    // localhost:8765 and the one on GitHub Pages are two different saves.
    // It's looked up on every call, never kept: in some browsers merely touching
    // localStorage throws when the player has blocked site data, and that must
    // happen inside save.ts's try/catch, not here while the game starts.
    storage: {
      get: (key) => localStorage.getItem(key),
      set: (key, text) => localStorage.setItem(key, text),
      remove: (key) => localStorage.removeItem(key),
    },
    lifecycle: {
      // "visibilitychange" fires when the tab is hidden (another tab, minimised)
      // and when it's shown again.
      onHide: (fn) => document.addEventListener('visibilitychange', () => { if (document.hidden) fn(); }),
      onShow: (fn) => document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); }),
      // "pagehide" fires when the page closes or reloads.
      onClose: (fn) => window.addEventListener('pagehide', () => fn()),
    },
    now: () => Date.now(),
    // The web has no achievements (the Hamster Diary is the game's own list).
    achievements: { unlock: () => {} },
  };
}
