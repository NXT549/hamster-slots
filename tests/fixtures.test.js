// fixtures.test.js — real save files from the game (tests/fixtures/), recorded by
// tools/golden.mjs from the golden run's sessions.
//
// Today they're save v7, the current format, so each one must load and save back
// unchanged. When the save format changes (v8 in migration step 3.7), these same
// files become the "old-format save" every migration is tested against
// (AGENTS.md → Saves).

import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createRng } from '../src/logic/rng.ts';
import { createGame, SAVE_VERSION } from '../src/logic/game.ts';
import { data, canonical } from './golden/sessions.js';

const dir = new URL('./fixtures/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

test('there are save fixtures to test', () => {
  expect(files.length).toBeGreaterThan(0);
});

for (const file of files) {
  const save = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  test(`${file} loads, and saves back the same`, () => {
    expect(save.saveVersion).toBe(SAVE_VERSION);
    const game = createGame(structuredClone(data), createRng(1));
    expect(game.loadSaveData(structuredClone(save))).toBe(true);
    expect(canonical(game.toSaveData())).toEqual(canonical(save));
  });
}
