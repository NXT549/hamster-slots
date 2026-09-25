// check.js — the bridge between the game's "check(name, condition)" style of
// test and Vitest.
//
// The logic tests were written as a plain script: work something out, then
// check(name, condition). Rather than rewrite 687 checks (and risk changing
// what they test), each check() now registers a real Vitest test with the same
// name. The work happens while Vitest collects the tests; each test then passes
// or fails on the condition that was worked out.
//
// New tests can use Vitest's own test() / expect() directly.

import { test, expect } from 'vitest';

export function check(name, condition, detail = '') {
  test(name, () => {
    // The message shows up when the check fails, like the old "FAIL name -> detail".
    expect(Boolean(condition), detail ? `${name} -> ${detail}` : name).toBe(true);
  });
}
