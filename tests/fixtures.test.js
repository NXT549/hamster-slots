// fixtures.test.js — real save files from the game (tests/fixtures/), recorded by
// tools/golden.mjs from the golden run's sessions: save-v<version>-<name>.json.
//
// Every save version keeps its own set for good:
//   - the CURRENT version's saves must load and save back unchanged;
//   - every OLDER save is the "old-format save" the migrations are tested on
//     (AGENTS.md → Saves): it must load, and save back exactly as the current
//     version's file of the same name (the same moment of the same session).

import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createRng } from '../src/logic/rng.ts';
import { createGame, SAVE_VERSION } from '../src/logic/game.ts';
import { data, canonical, moneyFields, FIXTURES } from './golden/sessions.js';

const dir = new URL('./fixtures/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const read = (file) => JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
const nameOf = (file) => file.replace(/^save-v\d+-/, '').replace(/\.json$/, '');

// Load a save into a fresh game and save it again.
function loadAndSave(save) {
  const game = createGame(structuredClone(data), createRng(1));
  expect(game.loadSaveData(structuredClone(save))).toBe(true);
  return game.toSaveData();
}

test('there are save fixtures for the current version and for older ones', () => {
  expect(files.filter((f) => f.startsWith(`save-v${SAVE_VERSION}-`)).length).toBe(FIXTURES.length);
  expect(files.some((f) => !f.startsWith(`save-v${SAVE_VERSION}-`))).toBe(true);
});

for (const file of files) {
  const save = read(file);
  if (save.saveVersion === SAVE_VERSION) {
    test(`${file} loads, and saves back the same`, () => {
      expect(canonical(loadAndSave(save))).toEqual(canonical(save));
    });
  } else {
    const current = `save-v${SAVE_VERSION}-${nameOf(file)}.json`;
    test(`${file} (an old save) migrates to exactly ${current}`, () => {
      expect(canonical(loadAndSave(save))).toEqual(canonical(read(current)));
    });
  }
}

describe('save v7 → v8: money is saved as text (big numbers)', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v7-${name}.json: every amount becomes the same amount as text; nothing else changes`, () => {
      const old = read(`save-v7-${name}.json`);
      const now = canonical(loadAndSave(old));
      const fields = moneyFields(now);
      expect(fields.length).toBeGreaterThan(10);
      for (const [obj, key] of fields) expect(typeof obj[key]).toBe('string');
      // Turn the text back into numbers (and the version back to 7), and leave out
      // what v9 … v15 added: then it's the old save again.
      const later = withoutV11(withoutV12(withoutV13(withoutV14(withoutV15(now)))));
      for (const [obj, key] of moneyFields(later)) obj[key] = Number(obj[key]);
      later.saveVersion = 7;
      expect(withoutV9(withoutV10(later))).toEqual(canonical(old));
    });
  }
});

// What save v9 (M8, the Big Cage) added, taken out again.
function withoutV9(save) {
  const out = structuredClone(save);
  delete out.stars;
  delete out.bigCage;
  for (const key of ['rebuilds', 'bestStars', 'mostSeedsHeld']) delete out.stats[key];
  return out;
}

describe('save v8 → v9: M8 adds Machine Stars and the Big Cage', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v8-${name}.json: gets no stars, is mid-life, starts the new stats at 0; nothing else changes`, () => {
      const old = read(`save-v8-${name}.json`);
      const now = canonical(loadAndSave(old));
      expect(now.stars).toEqual({});
      expect(now.bigCage).toBe(false);
      expect([now.stats.rebuilds, now.stats.bestStars, now.stats.mostSeedsHeld]).toEqual([0, 0, 0]);
      now.saveVersion = 8;
      expect(withoutV9(withoutV10(withoutV11(withoutV12(withoutV13(withoutV14(withoutV15(now)))))))).toEqual(canonical(old));
    });
  }
});

// What save v10 (M9, more machines) added, taken out again.
function withoutV10(save) {
  const out = structuredClone(save);
  for (const m of out.machines) delete m.hold;
  for (const key of ['bestWays', 'holdBonuses', 'holdGrands', 'bestWheel']) delete out.stats[key];
  return out;
}

describe('save v9 → v10: M9 adds hold & spin and four stats', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v9-${name}.json: no hold & spin going, the new stats at 0; nothing else changes`, () => {
      const old = read(`save-v9-${name}.json`);
      const now = canonical(loadAndSave(old));
      expect(now.machines.every((m) => m.hold === null)).toBe(true);
      expect([now.stats.bestWays, now.stats.holdBonuses, now.stats.holdGrands, now.stats.bestWheel]).toEqual([0, 0, 0, 0]);
      now.saveVersion = 9;
      expect(withoutV10(withoutV11(withoutV12(withoutV13(withoutV14(withoutV15(now))))))).toEqual(canonical(old));
    });
  }
});

// What save v11 (M11, the Hamster Casino) added, taken out again.
const CASINO_STATS = ['casinoGames', 'chipsBought', 'chipsEarned', 'biggestCasinoWin', 'rouletteNumbers', 'blackjacks', 'derbyLongshots', 'seedDropEdges', 'prizesBought'];
function withoutV11(save) {
  const out = structuredClone(save);
  delete out.casino;
  for (const key of CASINO_STATS) delete out.stats[key];
  return out;
}

describe('save v10 → v11: M11 adds the casino and its stats', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v10-${name}.json: no chips, no boosts, no hand, the new stats at 0; nothing else changes`, () => {
      const old = read(`save-v10-${name}.json`);
      const now = canonical(loadAndSave(old));
      expect(now.casino).toEqual({ chips: '0', bestIncome: '0', spinsToChip: 0, boosts: {}, hand: null });
      expect(CASINO_STATS.map((k) => Number(now.stats[k]))).toEqual(CASINO_STATS.map(() => 0));
      now.saveVersion = 10;
      expect(withoutV11(withoutV12(withoutV13(withoutV14(withoutV15(now)))))).toEqual(canonical(old));
    });
  }
});

// What save v12 (1.3.1, Nuts & Bolts) added, taken out again: the Hamster Helper's
// switch, two stats, and the new diary stickers an older save earns as it loads
// (Night Owl for coins earned while away, Billionaire …), with their tokens.
const V12_STATS = ['doubleWins', 'helperBuys'];
const V12_STICKERS = ['seeingDouble', 'nightOwl', 'busyPaws', 'littleHelper', 'stickerBook', 'dynasty', 'billionaire'];
function withoutV12(save) {
  const out = structuredClone(save);
  delete out.helper;
  for (const key of V12_STATS) delete out.stats[key];
  for (const id of V12_STICKERS) {
    if (!out.diary[id]) continue;
    delete out.diary[id];
    const tokens = data.diary.find((d) => d.id === id).tokens;
    out.tokens = String(Number(out.tokens) - tokens);
    out.stats.tokensEarned = String(Number(out.stats.tokensEarned) - tokens);
  }
  return out;
}

describe('save v11 → v12: 1.3.1 adds the Hamster Helper and two stats', () => {
  test('1.3.1 added these stickers (and no others)', () => {
    expect(V12_STICKERS.every((id) => data.diary.some((d) => d.id === id))).toBe(true);
  });
  for (const [, , name] of FIXTURES) {
    test(`save-v11-${name}.json: the helper's switch on, the new stats at 0, stickers already earned are awarded; nothing else changes`, () => {
      const old = read(`save-v11-${name}.json`);
      const now = canonical(loadAndSave(old));
      expect(now.helper).toBe(true);
      expect(V12_STATS.map((k) => now.stats[k])).toEqual([0, 0]);
      now.saveVersion = 11;
      expect(withoutV12(withoutV13(withoutV14(withoutV15(now))))).toEqual(canonical(old));
    });
  }
});

// What save v13 (the auto-spin pause toggle) added, taken out again.
function withoutV13(save) {
  const out = structuredClone(save);
  delete out.autoPaused;
  return out;
}

describe('save v12 → v13: the auto-spin pause toggle', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v12-${name}.json: starts unpaused; nothing else changes`, () => {
      const old = read(`save-v12-${name}.json`);
      const now = canonical(loadAndSave(old));
      expect(now.autoPaused).toBe(false);
      now.saveVersion = 12;
      expect(withoutV13(withoutV14(withoutV15(now)))).toEqual(canonical(old));
    });
  }
});

// What save v14 (1.4.0, The Great Migration) added, taken out again: the colony and six stats.
const V14_FIELDS = ['colony', 'colonyCoins', 'whiskers', 'perks', 'trial', 'trialsDone', 'auto'];
const V14_STATS = ['migrations', 'whiskersEarned', 'trialsCompleted', 'autoRetires', 'mysteryBoxes', 'bestBoxes'];
function withoutV14(save) {
  const out = structuredClone(save);
  for (const key of V14_FIELDS) delete out[key];
  for (const key of V14_STATS) delete out.stats[key];
  return out;
}

describe('save v13 → v14: 1.4.0 adds the colony (the seeds pending stay the same)', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v13-${name}.json: the first colony, no whiskers, perks or trial, the Wise Elders off, the new stats at 0, the same seeds pending; nothing else changes`, () => {
      const old = read(`save-v13-${name}.json`);
      const game = createGame(structuredClone(data), createRng(1));
      expect(game.loadSaveData(structuredClone(old))).toBe(true);
      const now = canonical(game.toSaveData());
      expect([now.colony, now.whiskers, now.trial]).toEqual([0, '0', null]);
      expect([now.perks, now.trialsDone, now.auto.retire]).toEqual([{}, {}, false]);
      expect(V14_STATS.map((k) => Number(now.stats[k]))).toEqual(V14_STATS.map(() => 0));
      // The seeds pending with the old curve (a square root of the lifetime coins), and now.
      const r = data.retirement;
      const before = Math.max(0, Math.floor(Math.pow(Number(old.stats.coinsEarned) / r.seedDivisor, r.seedExponent) + 1e-9) - Number(old.seedsEarned));
      expect(game.getPendingSeeds().toNumber() + 0).toBe(before); // (+ 0: the big numbers can say -0 for none)
      expect(Number(now.colonyCoins)).toBeGreaterThanOrEqual(Number(old.stats.coinsEarned));
      now.saveVersion = 13;
      expect(withoutV14(withoutV15(now))).toEqual(canonical(old));
    });
  }
});

// What save v15 (M12, the Family Casino) added, taken out again: the casino and three stats.
const V15_STATS = ['takingsEarned', 'tillsEmptied', 'cabinetsBought'];
function withoutV15(save) {
  const out = structuredClone(save);
  delete out.ownCasino;
  for (const key of V15_STATS) delete out.stats[key];
  return out;
}

describe('save v14 → v15: M12 adds the Family Casino (not open yet)', () => {
  for (const [, , name] of FIXTURES) {
    test(`save-v14-${name}.json: no Family Casino yet, the new stats at 0; nothing else changes`, () => {
      const old = read(`save-v14-${name}.json`);
      const now = canonical(loadAndSave(old));
      expect(now.ownCasino).toEqual({ opened: false, cabinets: {}, upgrades: {}, rewards: {}, till: '0', takings: '0' });
      expect(V15_STATS.map((k) => Number(now.stats[k]))).toEqual([0, 0, 0]);
      now.saveVersion = 14;
      expect(withoutV15(now)).toEqual(canonical(old));
    });
  }
});
