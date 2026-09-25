// backup.ts — VIEW: the Save backup dialog (Menu → Save backup).
//
// Top half: your save as a one-line code, with a Copy button.
// Bottom half: paste a code. It's checked as you paste (what's in it, or what's
// wrong with it, in plain words), and "Load this save" needs two taps, because
// it replaces the game you have now.
// Making, checking and loading codes happens in src/platform/savecode.ts;
// main.ts hands this view the three actions.

import { formatCoins, formatWhole, setText } from './dom.ts';
import type { Game } from '../logic/game.ts';
import type { SaveData } from '../logic/types.ts';
import type { CodeCheck, CodeProblem } from '../platform/savecode.ts';

export interface BackupActions {
  makeCode(): string;
  readCode(text: string): CodeCheck;
  // Load a checked save (the page restarts with it). false = it couldn't be stored.
  load(save: SaveData): boolean;
}

// What each problem says to the player.
const PROBLEMS: Record<CodeProblem, string> = {
  empty: '',
  notACode: "That isn't a Hamster Slots save code. A save code starts with HS1: (copy all of it).",
  damaged: 'This code is damaged or cut short. Copy the whole code again, then paste it here.',
  newer: 'This save comes from a newer version of Hamster Slots, so this one can’t load it.',
  unreadable: "This code doesn't hold a save this game can read.",
};

export function createBackupView(game: Game, actions: BackupActions) {
  // The element with this id (every id used here is in index.html).
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    dialog: $<HTMLDialogElement>('backup'), code: $<HTMLTextAreaElement>('backup-code'), copy: $<HTMLButtonElement>('backup-copy'),
    paste: $<HTMLTextAreaElement>('backup-paste'), status: $('backup-status'), load: $<HTMLButtonElement>('backup-load'),
  };
  let checked: SaveData | null = null; // the pasted save, once it checks out
  let armed = 0; // "Load this save" needs a second tap before this time
  let copyTimer = 0;
  let armTimer = 0;

  function setStatus(html: string, kind: 'good' | 'bad' | '' = ''): void {
    el.status.className = `backup-status${kind ? ` ${kind}` : ''}`;
    el.status.innerHTML = html;
  }

  function disarm(): void {
    armed = 0;
    clearTimeout(armTimer);
    setText(el.load, 'Load this save');
  }

  // Check what's in the paste box and say what it holds.
  function check(): void {
    disarm();
    const result = actions.readCode(el.paste.value);
    checked = result.ok ? result.save : null;
    el.load.disabled = !result.ok;
    if (!result.ok) {
      setStatus(PROBLEMS[result.problem], result.problem === 'empty' ? '' : 'bad');
      return;
    }
    const s = result.summary;
    const when = s.savedAt === null ? '' : ` · saved ${new Date(s.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
    const num = (text: string) => `<b>${text}</b>`; // numbers in the clean font
    setStatus(
      `${game.getPupName(s.generation)}, generation ${num(String(s.generation))} · ${num(formatCoins(s.coins))} coins · `
      + `${num(formatWhole(s.seeds))} Heirloom Seeds · ${num(String(s.machines))} machine${s.machines === 1 ? '' : 's'}${when}.`
      + ' Loading it replaces the game you have now.',
      'good',
    );
  }

  function open(): void {
    el.code.value = actions.makeCode();
    el.paste.value = '';
    setText(el.copy, 'Copy code');
    check();
    el.dialog.showModal();
  }

  // Copy: the clipboard if the browser allows it, otherwise the code is selected
  // so the player can copy it themselves. (Some browsers never answer at all, so
  // after a second it counts as "not allowed".)
  el.copy.addEventListener('click', async () => {
    let text = 'Copied ✓';
    try {
      const noAnswer = new Promise((_, reject) => window.setTimeout(reject, 1000));
      await Promise.race([navigator.clipboard.writeText(el.code.value), noAnswer]);
    } catch {
      el.code.focus();
      el.code.select();
      text = 'Selected: now copy it';
    }
    setText(el.copy, text);
    clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => setText(el.copy, 'Copy code'), 2500);
  });
  el.code.addEventListener('focus', () => el.code.select()); // one tap selects the whole code

  el.paste.addEventListener('input', check);

  // Two taps within 3 s, like Reset and Retire.
  el.load.addEventListener('click', () => {
    if (!checked) return;
    if (performance.now() < armed) {
      disarm();
      if (!actions.load(checked)) {
        setStatus('It loaded, but this browser won’t let the game store it (storage full or blocked), so it will be gone when you close the game.', 'bad');
      }
      return;
    }
    armed = performance.now() + 3000;
    setText(el.load, 'Tap again to replace your game');
    armTimer = window.setTimeout(disarm, 3000);
  });

  el.dialog.addEventListener('close', disarm);

  return { open };
}
