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
// Info → Recent wins, kept between visits. Not part of the save (it's only for looking
// back, never game state), but it belongs to this save's progress: Reset clears it.
const WIN_LOG_KEY = 'hamsterSlots.recentWins';

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
  clearWinLog(platform);
}

// Recent wins (payouts.ts reads and writes the text). Failing quietly is fine: it's only a log.
export function loadWinLog(platform: Platform): string | null {
  try { return platform.storage.get(WIN_LOG_KEY); } catch { return null; }
}
export function saveWinLog(platform: Platform, text: string): void {
  try { platform.storage.set(WIN_LOG_KEY, text); } catch { /* storage full or blocked: the log just isn't kept */ }
}
export function clearWinLog(platform: Platform): void {
  try { platform.storage.remove(WIN_LOG_KEY); } catch { /* nothing to do */ }
}

// The player's preferences (Menu):
//   motion     "auto" = follow the system's reduced-motion setting, "less", "full"
//   quickReels reels drop straight into place instead of scrolling (view only)
//   numbers    "short" (47.2K) or "full" (47,275)
//   buyAmount  the shop's ×1 / ×10 / Max toggle: 1, 10 or "max"
//   subTabs    which sub-tab each tray tab last showed, e.g. { upgrades: "machine" }
//   uiSounds   (1.9.0) soft clicks and ticks for the buttons, tabs and sheets
//   guide      (1.9.0) the first-time guide: the hamster's tips and the pointing paw
export interface Settings {
  muted: boolean;
  volume: number;
  motion: 'auto' | 'less' | 'full';
  quickReels: boolean;
  numbers: 'short' | 'full';
  buyAmount: 1 | 10 | 'max';
  subTabs: Record<string, string>;
  uiSounds: boolean;
  guide: boolean;
}

const DEFAULT_SETTINGS: Settings = { muted: false, volume: 0.6, motion: 'auto', quickReels: false, numbers: 'short', buyAmount: 1, subTabs: {}, uiSounds: true, guide: true };

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
      uiSounds: typeof raw.uiSounds === 'boolean' ? raw.uiSounds : d.uiSounds,
      guide: typeof raw.guide === 'boolean' ? raw.guide : d.guide,
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
