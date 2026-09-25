// savecode.ts — PLATFORM layer: the save as a one-line code (Menu → Save backup).
//
// A browser keeps one save per site, and it can be wiped (clearing site data,
// a private window, a phone running low on space). A save code is the backup:
// the whole save as one line of text the player can copy and keep anywhere, then
// paste back to get their hamster back, or to carry on in another browser.
//
//   "HS1:" + the save as JSON, in base64
// HS1 = "Hamster Slots save code, format 1". The save inside has its own
// saveVersion, so an old code loads through the save migrations like an old save.
// Base64 keeps it one line, with nothing a chat app or a text box would mangle.
// Only the Platform interface is used, so it works the same on every platform.

import { migrateSave, sanitizeState, SAVE_VERSION } from '../logic/game.ts';
import type { Game } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import type { GameData, SaveData } from '../logic/types.ts';
import type { Platform } from './platform.ts';
import { saveGame } from './save.ts';

const PREFIX = 'HS1:';

// Text ⇄ base64. btoa/atob only handle bytes, so the text goes through UTF-8 first.
function toBase64(text: string): string {
  let bytes = '';
  for (const byte of new TextEncoder().encode(text)) bytes += String.fromCharCode(byte);
  return btoa(bytes);
}
function fromBase64(code: string): string {
  const bytes = atob(code); // throws on anything that isn't base64
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
}

// The code for the game as it is right now.
export function makeSaveCode(game: Game, platform: Platform): string {
  const save: SaveData & { savedAt?: number } = game.toSaveData();
  save.savedAt = platform.now(); // shown when the code is pasted back ("saved 25 Sep, 14:03")
  return PREFIX + toBase64(JSON.stringify(save));
}

// Why a pasted code can't be loaded (the view words it for the player):
//   empty       nothing was pasted
//   notACode    it isn't a save code at all
//   damaged     it starts right but doesn't decode (usually cut short when copying)
//   newer       it's from a newer version of the game than this one
//   unreadable  it decodes, but it isn't a save this game can load
export type CodeProblem = 'empty' | 'notACode' | 'damaged' | 'newer' | 'unreadable';

// What a good code holds, to show before loading it.
export interface SaveSummary {
  generation: number;
  coins: Money;
  seeds: Money;
  machines: number;
  savedAt: number | null; // when the code was made (ms since 1970), if it says
}

export type CodeCheck = { ok: true; save: SaveData; summary: SaveSummary } | { ok: false; problem: CodeProblem };

// Check a pasted code without touching the game. Spaces and line breaks inside
// the code are ignored (chat apps like to wrap long lines). A save file's plain
// JSON text is accepted too.
export function readSaveCode(text: string, data: GameData): CodeCheck {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: 'empty' };
  let raw: any; // anything at all could be in there, so every field is checked before it's used
  try {
    if (trimmed.startsWith(PREFIX)) raw = JSON.parse(fromBase64(trimmed.slice(PREFIX.length).replace(/\s+/g, '')));
    else if (trimmed.startsWith('{')) raw = JSON.parse(trimmed);
    else return { ok: false, problem: 'notACode' };
  } catch {
    return { ok: false, problem: 'damaged' };
  }
  if (raw && typeof raw.saveVersion === 'number' && raw.saveVersion > SAVE_VERSION) return { ok: false, problem: 'newer' };
  const save = migrateSave(raw, data);
  if (!save) return { ok: false, problem: 'unreadable' };
  // The summary comes from the save as the game will really load it (cleaned up).
  const state = sanitizeState(save, data);
  return {
    ok: true,
    save,
    summary: {
      generation: state.generation,
      coins: state.coins,
      seeds: state.seeds,
      machines: state.machines.length,
      savedAt: typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : null,
    },
  };
}

// Load a checked code's save, and store it straight away. No offline earnings
// are paid for the time since the code was made (it could be weeks old, from
// another computer): the stored save gets today's time. Returns false if the
// platform wouldn't store it (the save is loaded anyway, but closing the game loses it).
export function loadSaveCode(game: Game, platform: Platform, save: SaveData): boolean {
  if (!game.loadSaveData(save)) return false;
  return saveGame(game, platform);
}
