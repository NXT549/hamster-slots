// golden.test.js — the golden run: does the game still play EXACTLY as recorded?
//
// Plays the scripted sessions in golden/sessions.js again and compares every
// checkpoint (the whole save, the RNG's position, event counts, coins paid) with
// golden/golden.json, recorded from the plain-JS game in migration step 3.3.
// Saves are compared with their money as numbers and without their version
// (sessions.js comparable()), because save v8 writes money as text.
// A failure means the game now plays differently. If that's an intended, approved
// gameplay change, re-record with `node tools/golden.mjs --confirm`; otherwise
// it's a bug.

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { SESSIONS, comparable } from './golden/sessions.js';

const golden = JSON.parse(readFileSync(new URL('./golden/golden.json', import.meta.url), 'utf8'));

test('the recording has exactly the sessions the script plays', () => {
  expect(Object.keys(golden.sessions).sort()).toEqual(Object.keys(SESSIONS).sort());
});

for (const [name, expected] of Object.entries(golden.sessions)) {
  describe(`golden run: ${name}`, () => {
    let actual = [];
    beforeAll(() => {
      actual = SESSIONS[name]();
    }, 120_000);

    test('the same checkpoints, in the same order', () => {
      expect(actual.map((c) => c.label)).toEqual(expected.map((c) => c.label));
    });
    for (const [i, cp] of expected.entries()) {
      test(`checkpoint "${cp.label}"`, () => {
        expect(comparable(actual[i])).toEqual(comparable(cp));
      });
    }
  });
}
