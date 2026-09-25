// save.js — BRIDGE layer. The ONLY file that touches localStorage.
//
// It just moves text in and out of the browser's storage. What goes IN the
// save (and how old saves get upgraded) is decided by game.js
// (toSaveData / loadSaveData), so that part is testable without a browser.
// Godot: this becomes a SaveManager autoload writing user://save.json.

const SAVE_KEY = 'hamsterSlots.save';
// Settings (sound, motion, number style …) are the player's preferences, not game
// progress, so they live under their own key and survive "Reset progress".
const SETTINGS_KEY = 'hamsterSlots.settings';

// Everything is wrapped in try/catch: storage can be full, disabled (private
// windows), or hold broken text. A failed save or load must never crash the game.

export function saveGame(game) {
  try {
    const save = game.toSaveData();
    save.savedAt = Date.now(); // real-world time, so the next visit can pay offline earnings
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (err) {
    console.warn('Save failed:', err);
    return false;
  }
}

// Returns { loaded, savedAt }: whether a save was loaded, and when it was
// written (milliseconds since 1970, or null if unknown).
export function loadGame(game) {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return { loaded: false, savedAt: null };
    const save = JSON.parse(text);
    const loaded = game.loadSaveData(save);
    return { loaded, savedAt: loaded && typeof save.savedAt === 'number' ? save.savedAt : null };
  } catch (err) {
    console.warn('Load failed, starting a new game:', err);
    return { loaded: false, savedAt: null };
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
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
const DEFAULT_SETTINGS = { muted: false, volume: 0.6, motion: 'auto', quickReels: false, numbers: 'short', buyAmount: 1, subTabs: {} };

// Only short word-like names survive (the view checks them against its own list).
function cleanSubTabs(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    if (/^[a-z]{1,20}$/.test(key) && typeof value === 'string' && /^[a-z]{1,20}$/.test(value)) out[key] = value;
  }
  return out;
}

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const d = DEFAULT_SETTINGS;
    return {
      muted: typeof raw.muted === 'boolean' ? raw.muted : d.muted,
      volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : d.volume,
      motion: oneOf(raw.motion, ['auto', 'less', 'full'], d.motion),
      quickReels: typeof raw.quickReels === 'boolean' ? raw.quickReels : d.quickReels,
      numbers: oneOf(raw.numbers, ['short', 'full'], d.numbers),
      buyAmount: oneOf(raw.buyAmount, [1, 10, 'max'], d.buyAmount),
      subTabs: cleanSubTabs(raw.subTabs),
    };
  } catch (err) {
    return { ...DEFAULT_SETTINGS, subTabs: {} };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}
