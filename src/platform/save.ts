// save.ts — PLATFORM layer: the save and the settings, in and out of storage.
//
// It just moves text through the platform's storage (localStorage on the web,
// see web.ts), so it works the same on every platform. What goes IN the save
// (and how old saves get upgraded) is decided by game.ts
// (toSaveData / loadSaveData), so that part is testable without a browser.

import type { Game } from '../logic/game.ts';
import type { SaveData } from '../logic/types.ts';
import type { Platform } from './platform.ts';

const SAVE_KEY = 'hamsterSlots.save';
// Settings (sound, motion, number style …) are the player's preferences, not game
// progress, so they live under their own key and survive "Reset progress".
const SETTINGS_KEY = 'hamsterSlots.settings';

// Everything is wrapped in try/catch: storage can be full, disabled (private
// windows), or hold broken text. A failed save or load must never crash the game.

export function saveGame(game: Game, platform: Platform): boolean {
  try {
    const save: SaveData & { savedAt?: number } = game.toSaveData();
    save.savedAt = platform.now(); // real-world time, so the next visit can pay offline earnings
    platform.storage.set(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    console.warn('Save failed:', err);
    return false;
  }
}

// Returns { loaded, savedAt }: whether a save was loaded, and when it was
// written (milliseconds since 1970, or null if unknown).
export function loadGame(game: Game, platform: Platform): { loaded: boolean; savedAt: number | null } {
  try {
    const text = platform.storage.get(SAVE_KEY);
    if (!text) return { loaded: false, savedAt: null };
    const save = JSON.parse(text);
    const loaded = game.loadSaveData(save);
    return { loaded, savedAt: loaded && typeof save.savedAt === 'number' ? save.savedAt : null };
  } catch (err) {
    console.warn('Load failed, starting a new game:', err);
    return { loaded: false, savedAt: null };
  }
}

export function clearSave(platform: Platform): void {
  try {
    platform.storage.remove(SAVE_KEY);
  } catch (err) {
    console.warn('Could not clear save:', err);
  }
}

// The player's preferences (Menu):
//   motion     "auto" = follow the system's reduced-motion setting, "less", "full"
//   quickReels reels drop straight into place instead of scrolling (view only)
//   numbers    "short" (47.2K) or "full" (47,275)
//   buyAmount  the shop's ×1 / ×10 / Max toggle: 1, 10 or "max"
//   subTabs    which sub-tab each tray tab last showed, e.g. { upgrades: "machine" }
export interface Settings {
  muted: boolean;
  volume: number;
  motion: 'auto' | 'less' | 'full';
  quickReels: boolean;
  numbers: 'short' | 'full';
  buyAmount: 1 | 10 | 'max';
  subTabs: Record<string, string>;
}

const DEFAULT_SETTINGS: Settings = { muted: false, volume: 0.6, motion: 'auto', quickReels: false, numbers: 'short', buyAmount: 1, subTabs: {} };

// Only short word-like names survive (the view checks them against its own list).
function cleanSubTabs(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    if (/^[a-z]{1,20}$/.test(key) && typeof value === 'string' && /^[a-z]{1,20}$/.test(value)) out[key] = value;
  }
  return out;
}

const oneOf = <T>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

export function loadSettings(platform: Platform): Settings {
  try {
    const raw = JSON.parse(platform.storage.get(SETTINGS_KEY) || '{}');
    const d = DEFAULT_SETTINGS;
    return {
      muted: typeof raw.muted === 'boolean' ? raw.muted : d.muted,
      volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : d.volume,
      motion: oneOf<Settings['motion']>(raw.motion, ['auto', 'less', 'full'], d.motion),
      quickReels: typeof raw.quickReels === 'boolean' ? raw.quickReels : d.quickReels,
      numbers: oneOf<Settings['numbers']>(raw.numbers, ['short', 'full'], d.numbers),
      buyAmount: oneOf<Settings['buyAmount']>(raw.buyAmount, [1, 10, 'max'], d.buyAmount),
      subTabs: cleanSubTabs(raw.subTabs),
    };
  } catch (err) {
    return { ...DEFAULT_SETTINGS, subTabs: {} };
  }
}

export function saveSettings(platform: Platform, settings: Settings): void {
  try {
    platform.storage.set(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}
