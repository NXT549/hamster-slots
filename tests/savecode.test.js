// savecode.test.js — save codes (src/platform/savecode.ts): the save as one line
// of text for Menu → Save backup. Made, checked and loaded on the pretend
// platform (src/platform/memory.ts).

import { describe, test, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame, data } from './logic/helpers.js';
import { createMemoryPlatform } from '../src/platform/memory.ts';
import { makeSaveCode, readSaveCode, loadSaveCode } from '../src/platform/savecode.ts';
import { SAVE_VERSION } from '../src/logic/game.ts';

afterEach(() => vi.restoreAllMocks());

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
// Encode like a code, but with Node's own base64 (so the game's encoder is checked against it).
const codeOf = (save) => 'HS1:' + Buffer.from(JSON.stringify(save)).toString('base64');

// A game with some progress on it.
function playedGame(seed = 7) {
  const g = newGame(seed);
  g.addCoins(1e5);
  g.buyUpgrade('wheel');
  g.buyUpgrade('thirdReel');
  g.update(60);
  g.addTokens(12);
  return g;
}

describe('making a code', () => {
  test('one line: "HS1:" and base64, nothing else', () => {
    const code = makeSaveCode(playedGame(), createMemoryPlatform());
    expect(code).toMatch(/^HS1:[A-Za-z0-9+/]+=*$/);
  });

  test('it holds exactly the save, plus when it was made', () => {
    const g = playedGame();
    const p = createMemoryPlatform();
    const inside = JSON.parse(Buffer.from(makeSaveCode(g, p).slice(4), 'base64').toString('utf8'));
    const { savedAt, ...save } = inside;
    expect(save).toEqual(JSON.parse(JSON.stringify(g.toSaveData())));
    expect(savedAt).toBe(p.now());
  });
});

describe('checking a pasted code', () => {
  test('a good code: the save and a summary of it', () => {
    const g = playedGame();
    const p = createMemoryPlatform();
    const check = readSaveCode(makeSaveCode(g, p), data);
    expect(check.ok).toBe(true);
    expect(check.summary.generation).toBe(1);
    expect(check.summary.coins.eq(g.state.coins)).toBe(true);
    expect(check.summary.seeds.toNumber()).toBe(0);
    expect(check.summary.machines).toBe(1);
    expect(check.summary.savedAt).toBe(p.now());
  });

  test('spaces and line breaks inside the code are fine (chat apps wrap long lines)', () => {
    const code = makeSaveCode(playedGame(), createMemoryPlatform());
    const wrapped = `  ${code.slice(0, 30)}\n${code.slice(30, 90)} \r\n ${code.slice(90)}  `;
    expect(readSaveCode(wrapped, data).ok).toBe(true);
  });

  test('text in any language survives (UTF-8)', () => {
    const save = { ...JSON.parse(fixture('save-v8-early.json')), note: 'Hämster 🐹 ハムスター' };
    const check = readSaveCode(codeOf(save), data);
    expect(check.ok).toBe(true);
    expect(check.save.note).toBe('Hämster 🐹 ハムスター');
  });

  test('a save file\'s plain JSON works too', () => {
    expect(readSaveCode(fixture('save-v8-late.json'), data).ok).toBe(true);
  });

  test.each([
    ['', 'empty'],
    ['   \n ', 'empty'],
    ['hello', 'notACode'],
    ['[1, 2, 3]', 'notACode'],
    ['HS1:%%%not base64%%%', 'damaged'],
    ['HS1:aGVsbG8=', 'damaged'], // base64 of "hello": not JSON
    ['{"saveVersion": 8, "coins": ', 'damaged'],
    ['{}', 'unreadable'],
    ['{"saveVersion": 0}', 'unreadable'],
    ['{"saveVersion": 99}', 'newer'],
  ])('%j → %s', (text, problem) => {
    expect(readSaveCode(text, data)).toEqual({ ok: false, problem });
  });

  test('a code cut short when copying is "damaged"', () => {
    const code = makeSaveCode(playedGame(), createMemoryPlatform());
    for (const keep of [0.9, 0.5, 0.1]) {
      expect(readSaveCode(code.slice(0, Math.floor(code.length * keep)), data)).toEqual({ ok: false, problem: 'damaged' });
    }
  });

  test('a code from a newer game is "newer"', () => {
    const save = { ...JSON.parse(fixture('save-v8-early.json')), saveVersion: SAVE_VERSION + 1 };
    expect(readSaveCode(codeOf(save), data)).toEqual({ ok: false, problem: 'newer' });
  });
});

describe('loading a code', () => {
  test('it replaces the game, exactly', () => {
    const from = playedGame(7);
    const p = createMemoryPlatform();
    const check = readSaveCode(makeSaveCode(from, createMemoryPlatform()), data);
    const g = newGame(99);
    expect(loadSaveCode(g, p, check.save)).toBe(true);
    expect(g.toSaveData()).toEqual(from.toSaveData());
  });

  test('it\'s stored straight away, with today\'s time: no coins for the time since the code was made', () => {
    const old = createMemoryPlatform(1_000_000_000_000);
    const code = makeSaveCode(playedGame(), old); // made long ago
    const p = createMemoryPlatform(2_000_000_000_000); // loaded much later
    const g = newGame(1);
    const paid = [];
    g.on('offlineEarned', (e) => paid.push(e));
    expect(loadSaveCode(g, p, readSaveCode(code, data).save)).toBe(true);
    const stored = JSON.parse(p.stored.get('hamsterSlots.save'));
    expect(stored.savedAt).toBe(p.now());
    expect(stored.coins).toBe(g.state.coins.toString());
    expect(paid).toEqual([]);
  });

  test('when storage is full, the save still loads but says it wasn\'t stored', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const check = readSaveCode(makeSaveCode(playedGame(), createMemoryPlatform()), data);
    const p = createMemoryPlatform();
    p.full = true;
    const g = newGame(1);
    expect(loadSaveCode(g, p, check.save)).toBe(false);
    expect(g.toSaveData()).toEqual(playedGame().toSaveData());
  });

  test.each(['early', 'first-life', 'family', 'late'])('an old v7 code (%s) loads through the migrations, exactly like the v7 save file', (name) => {
    const v7 = JSON.parse(fixture(`save-v7-${name}.json`));
    const check = readSaveCode(codeOf(v7), data);
    expect(check.ok).toBe(true);
    const g = newGame(1);
    loadSaveCode(g, createMemoryPlatform(), check.save);
    expect(JSON.parse(JSON.stringify(g.toSaveData()))).toEqual(JSON.parse(fixture(`save-v8-${name}.json`)));
  });
});
