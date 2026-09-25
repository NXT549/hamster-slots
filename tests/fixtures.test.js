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
      // Turn the text back into numbers (and the version back to 7): then it's the old save again.
      for (const [obj, key] of fields) obj[key] = Number(obj[key]);
      now.saveVersion = 7;
      expect(now).toEqual(canonical(old));
    });
  }
});
