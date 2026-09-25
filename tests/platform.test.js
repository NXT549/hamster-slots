// platform.test.js — the platform layer (src/platform/): saving, settings,
// autosave and time away, and the web version of the platform.
//
// Most tests run on the pretend platform (src/platform/memory.ts), which can
// fill its storage up, block it, move the clock on, and hide, show or close the
// game, like a real device. The web version is tested with a fake browser.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { newGame } from './logic/helpers.js';
import { createMemoryPlatform } from '../src/platform/memory.ts';
import { createWebPlatform } from '../src/platform/web.ts';
import { saveGame, loadGame, clearSave, loadSettings, saveSettings } from '../src/platform/save.ts';
import { createAutosave } from '../src/platform/autosave.ts';

// Players' saves are stored under these names: changing one would lose every save.
const SAVE_KEY = 'hamsterSlots.save';
const SETTINGS_KEY = 'hamsterSlots.settings';

// save.ts warns in the console when storage fails; keep the test output clean.
// Pretend timers: autosave's timer runs only when a test moves time on, and never outlives it.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.useFakeTimers();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// A game with some progress: Wheel Training (so it earns while away) and a minute of auto-spins.
function playedGame(seed = 7) {
  const g = newGame(seed);
  g.addCoins(1e5);
  g.buyUpgrade('wheel');
  g.buyUpgrade('thirdReel');
  g.update(60);
  return g;
}
const fresh = () => newGame(1).toSaveData();
// Records every offlineEarned event of a game.
function offlinePayments(g) {
  const paid = [];
  g.on('offlineEarned', (e) => paid.push(e));
  return paid;
}

// ─────────────────────────────────────────────────────────────
describe('saving and loading', () => {
  test('a save loads back exactly', () => {
    const p = createMemoryPlatform();
    const g = playedGame();
    expect(saveGame(g, p)).toBe(true);
    const g2 = newGame(99);
    const { loaded, savedAt } = loadGame(g2, p);
    expect(loaded).toBe(true);
    expect(g2.toSaveData()).toEqual(g.toSaveData());
    expect(savedAt).toBe(p.now()); // when it was saved, for offline earnings
  });

  test('the save goes under its old name, so players keep their saves', () => {
    const p = createMemoryPlatform();
    saveGame(playedGame(), p);
    expect([...p.stored.keys()]).toEqual([SAVE_KEY]);
    expect(JSON.parse(p.stored.get(SAVE_KEY)).savedAt).toBe(p.now());
  });

  test('nothing saved yet: a new game', () => {
    const p = createMemoryPlatform();
    const g = newGame(1);
    expect(loadGame(g, p)).toEqual({ loaded: false, savedAt: null });
    expect(g.toSaveData()).toEqual(fresh());
  });

  test.each([
    ['cut-off text', '{"saveVersion": 7, "coins": 12'],
    ['not JSON at all', 'hello'],
    ['JSON that is not a save', '[1, 2, 3]'],
    ['null', 'null'],
    ['a save from the future', '{"saveVersion": 99}'],
  ])('a broken save (%s) starts a new game and never crashes', (_, text) => {
    const p = createMemoryPlatform();
    p.stored.set(SAVE_KEY, text);
    const g = newGame(1);
    expect(loadGame(g, p)).toEqual({ loaded: false, savedAt: null });
    expect(g.toSaveData()).toEqual(fresh());
  });

  test('a save without a time loads, with no offline earnings', () => {
    const p = createMemoryPlatform();
    p.stored.set(SAVE_KEY, JSON.stringify(playedGame().toSaveData()));
    const { loaded, savedAt } = loadGame(newGame(1), p);
    expect(loaded).toBe(true);
    expect(savedAt).toBe(null);
  });

  test('storage full: the save fails without crashing, and the last good save stays', () => {
    const p = createMemoryPlatform();
    const g = playedGame();
    saveGame(g, p);
    const before = p.stored.get(SAVE_KEY);
    p.full = true;
    g.addCoins(123);
    expect(saveGame(g, p)).toBe(false);
    expect(p.stored.get(SAVE_KEY)).toBe(before);
    expect(() => saveSettings(p, loadSettings(p))).not.toThrow();
  });

  test('storage blocked: nothing crashes, the game starts fresh with default settings', () => {
    const p = createMemoryPlatform();
    saveGame(playedGame(), p);
    p.blocked = true;
    const g = newGame(1);
    expect(saveGame(g, p)).toBe(false);
    expect(loadGame(g, p)).toEqual({ loaded: false, savedAt: null });
    expect(g.toSaveData()).toEqual(fresh());
    expect(loadSettings(p)).toEqual(loadSettings(createMemoryPlatform()));
    expect(() => saveSettings(p, loadSettings(p))).not.toThrow();
    expect(() => clearSave(p)).not.toThrow();
  });

  test('Reset (clearSave) removes the save but keeps the settings', () => {
    const p = createMemoryPlatform();
    saveGame(playedGame(), p);
    const settings = { ...loadSettings(p), muted: true };
    saveSettings(p, settings);
    clearSave(p);
    expect(p.stored.has(SAVE_KEY)).toBe(false);
    expect(loadSettings(p)).toEqual(settings);
  });
});

// ─────────────────────────────────────────────────────────────
describe('settings', () => {
  test('no settings yet: the defaults', () => {
    expect(loadSettings(createMemoryPlatform())).toEqual({
      muted: false, volume: 0.6, motion: 'auto', quickReels: false, numbers: 'short', buyAmount: 1, subTabs: {},
    });
  });

  test('settings load back exactly, under their own name', () => {
    const p = createMemoryPlatform();
    const settings = { muted: true, volume: 0.3, motion: 'less', quickReels: true, numbers: 'full', buyAmount: 'max', subTabs: { upgrades: 'machine' } };
    saveSettings(p, settings);
    expect([...p.stored.keys()]).toEqual([SETTINGS_KEY]);
    expect(loadSettings(p)).toEqual(settings);
  });

  test('odd values fall back to safe ones', () => {
    const p = createMemoryPlatform();
    p.stored.set(SETTINGS_KEY, JSON.stringify({
      muted: 'yes', volume: 7, motion: 'wild', quickReels: 1, numbers: 'long', buyAmount: 3, subTabs: { 'Upgrades!': 'x', info: 'odds', family: 5 },
    }));
    expect(loadSettings(p)).toEqual({
      muted: false, volume: 1, motion: 'auto', quickReels: false, numbers: 'short', buyAmount: 1, subTabs: { info: 'odds' },
    });
  });

  test('broken settings text: the defaults', () => {
    const p = createMemoryPlatform();
    p.stored.set(SETTINGS_KEY, '{"muted": tr');
    expect(loadSettings(p)).toEqual(loadSettings(createMemoryPlatform()));
  });
});

// ─────────────────────────────────────────────────────────────
describe('autosave and time away', () => {
  test('saves by itself every few seconds', () => {
    const p = createMemoryPlatform();
    const autosave = createAutosave(playedGame(), p);
    autosave.start(30);
    vi.advanceTimersByTime(29_000);
    expect(p.stored.has(SAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(p.stored.has(SAVE_KEY)).toBe(true);
    autosave.stop();
  });

  test('going away saves; coming back pays for the time away', () => {
    const p = createMemoryPlatform();
    const g = playedGame();
    const paid = offlinePayments(g);
    createAutosave(g, p).start(30);
    p.hide();
    expect(JSON.parse(p.stored.get(SAVE_KEY)).coins).toBe(g.state.coins.toString()); // money is saved as text
    p.advance(600);
    p.show();
    expect(paid.length).toBe(1);
    expect(paid[0].awaySeconds).toBe(600);
    expect(paid[0].coins.toString()).toBe(playedGame().getOfflineEarnings(600).coins.toString()); // the logic's own maths
  });

  test('the time away is paid once, and only after going away', () => {
    const p = createMemoryPlatform();
    const g = playedGame();
    const paid = offlinePayments(g);
    createAutosave(g, p).start(30);
    p.advance(600);
    p.show(); // never went away
    expect(paid.length).toBe(0);
    p.hide();
    p.advance(600);
    p.show();
    p.advance(600);
    p.show(); // already paid
    expect(paid.length).toBe(1);
  });

  test('closing the game saves', () => {
    const p = createMemoryPlatform();
    const g = playedGame();
    createAutosave(g, p).start(30);
    p.close();
    expect(JSON.parse(p.stored.get(SAVE_KEY)).coins).toBe(g.state.coins.toString()); // money is saved as text
  });

  test('save now says whether it worked', () => {
    const p = createMemoryPlatform();
    const autosave = createAutosave(playedGame(), p);
    expect(autosave.save()).toBe(true);
    p.full = true;
    expect(autosave.save()).toBe(false);
  });

  test('after stop (Reset), nothing saves any more: not the timer, going away or closing', () => {
    const p = createMemoryPlatform();
    const autosave = createAutosave(playedGame(), p);
    autosave.start(30);
    autosave.stop();
    vi.advanceTimersByTime(120_000);
    p.hide();
    p.close();
    expect(autosave.save()).toBe(false);
    expect(p.stored.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// A fake browser: localStorage, document (with `hidden`) and window, just enough for web.ts.
function fakeBrowser() {
  const items = new Map();
  const listeners = new Map();
  const listen = (target) => (type, fn) => listeners.set(target + type, [...(listeners.get(target + type) ?? []), fn]);
  const document = { hidden: false, addEventListener: listen('document.') };
  vi.stubGlobal('localStorage', {
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => items.set(k, String(v)),
    removeItem: (k) => items.delete(k),
  });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { addEventListener: listen('window.') });
  return {
    items,
    // Hide or show the page the way a browser does: set document.hidden, then fire the event.
    setHidden(hidden) {
      document.hidden = hidden;
      (listeners.get('document.visibilitychange') ?? []).forEach((fn) => fn({ type: 'visibilitychange' }));
    },
    closePage: () => (listeners.get('window.pagehide') ?? []).forEach((fn) => fn({ type: 'pagehide' })),
  };
}

describe('the web platform', () => {
  test('storage is localStorage', () => {
    const browser = fakeBrowser();
    const p = createWebPlatform();
    p.storage.set('a', 'one');
    expect(browser.items.get('a')).toBe('one');
    expect(p.storage.get('a')).toBe('one');
    expect(p.storage.get('b')).toBe(null);
    p.storage.remove('a');
    expect(browser.items.has('a')).toBe(false);
  });

  test('hiding the tab = going away, showing it = coming back, closing the page = closing', () => {
    const browser = fakeBrowser();
    const p = createWebPlatform();
    const calls = [];
    p.lifecycle.onHide(() => calls.push('hide'));
    p.lifecycle.onShow(() => calls.push('show'));
    p.lifecycle.onClose(() => calls.push('close'));
    browser.setHidden(true);
    browser.setHidden(false);
    browser.closePage();
    expect(calls).toEqual(['hide', 'show', 'close']);
  });

  test('the clock is the real-world time; achievements do nothing', () => {
    fakeBrowser();
    vi.setSystemTime(1_700_000_000_000);
    const p = createWebPlatform();
    expect(p.now()).toBe(1_700_000_000_000);
    expect(() => p.achievements.unlock('anything')).not.toThrow();
  });

  test('blocked site data: starting the game never touches localStorage, and saving fails safely', () => {
    fakeBrowser();
    // Some browsers throw as soon as you even LOOK at localStorage when site data is blocked.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('The operation is insecure.');
      },
    });
    try {
      const p = createWebPlatform();
      const g = newGame(1);
      expect(loadGame(g, p)).toEqual({ loaded: false, savedAt: null });
      expect(loadSettings(p)).toEqual(loadSettings(createMemoryPlatform()));
      expect(saveGame(g, p)).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete globalThis.localStorage;
    }
  });

  test('going away in the browser writes the save to localStorage', () => {
    const browser = fakeBrowser();
    const p = createWebPlatform();
    const g = playedGame();
    createAutosave(g, p).start(30);
    browser.setHidden(true);
    expect(JSON.parse(browser.items.get(SAVE_KEY)).coins).toBe(g.state.coins.toString());
  });
});
