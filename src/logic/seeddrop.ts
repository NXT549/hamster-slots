// seeddrop.ts — LOGIC layer (M11, the Hamster Casino). Seed Drop: a seed falls
// down a board of pegs, bouncing left or right at every row, into one of the bins
// at the bottom; the bin multiplies what you bet.
//
// Pure rules, no DOM and no clock (rule 1). At every row the seed goes left or right
// with an even chance, so it lands in bin k (the number of rights) with the chance
// C(rows, k) / 2^rows: the middle bins most often, the edges rarely. The bins'
// multipliers live in data.json (rule 2): big at the edges, small in the middle,
// set so a drop returns a little less than you bet on average (the house's small edge).

import type { Rng } from './rng.ts';

// n choose k (small numbers: a board has a handful of rows).
function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

// The chance a seed lands in bin k of a board with `rows` rows (bins 0 … rows).
export function binChance(rows: number, k: number): number {
  return k < 0 || k > rows ? 0 : choose(rows, k) / Math.pow(2, rows);
}

// The exact return to the player: every bin's chance × its multiplier.
export function seedDropRtp(multipliers: readonly number[]): number {
  const rows = multipliers.length - 1;
  return multipliers.reduce((s, m, k) => s + binChance(rows, k) * m, 0);
}

// Drop one seed: which way it bounces at every row (0 = left, 1 = right) and the bin it lands in.
export function dropSeed(rng: Rng, rows: number): { path: number[]; bin: number } {
  const path: number[] = [];
  for (let r = 0; r < rows; r++) path.push(rng.next() < 0.5 ? 0 : 1);
  return { path, bin: path.reduce((s, x) => s + x, 0) };
}
