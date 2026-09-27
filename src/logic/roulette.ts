// roulette.ts — LOGIC layer (M11, the Hamster Casino). Hamster Roulette: the
// hamster runs in its ball around a single-zero wheel (0–36) and drops into a pocket.
//
// Pure rules, no DOM and no clock (rule 1): which pockets a bet covers, what it pays,
// and the exact return to the player. The wheel's layout is the real European one;
// what each bet PAYS lives in data.json (rule 2). With the usual payouts every bet
// returns 36/37 of what you bet on average: the zero is the house's small edge.

import type { Rng } from './rng.ts';

// The red numbers of a real roulette wheel (the rest, 1–36, are black; 0 is green).
export const RED_NUMBERS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// The pockets in the order they sit around the wheel (the view draws them this way).
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const POCKETS = 37; // 0 … 36

// The kinds of bet. dozen / column / number also say which one (`pick`).
export type RouletteKind = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen' | 'column' | 'number';
export const ROULETTE_KINDS: readonly RouletteKind[] = ['red', 'black', 'odd', 'even', 'low', 'high', 'dozen', 'column', 'number'];
// How many picks a kind has (dozen: 1st/2nd/3rd, column: 1–3, number: 0–36).
export function picksFor(kind: RouletteKind): number {
  return kind === 'dozen' || kind === 'column' ? 3 : kind === 'number' ? POCKETS : 1;
}

export function pocketColor(n: number): 'green' | 'red' | 'black' {
  return n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black';
}

// Does a bet win on this pocket? (0 loses every bet but a bet on 0 itself.)
export function covers(kind: RouletteKind, pick: number, n: number): boolean {
  if (kind === 'number') return n === pick;
  if (n === 0) return false;
  switch (kind) {
    case 'red': return RED_NUMBERS.has(n);
    case 'black': return !RED_NUMBERS.has(n);
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'dozen': return Math.ceil(n / 12) === pick + 1; // pick 0 = 1–12, 1 = 13–24, 2 = 25–36
    case 'column': return (n - 1) % 3 === pick; // pick 0 = 1, 4, 7 …; 1 = 2, 5, 8 …; 2 = 3, 6, 9 …
    default: return false;
  }
}

// How many pockets a bet covers (12 for a dozen, 18 for red …).
export function coverage(kind: RouletteKind, pick = 0): number {
  let n = 0;
  for (let p = 0; p < POCKETS; p++) if (covers(kind, pick, p)) n++;
  return n;
}

// What each kind pays back for a win, stake included (data.json: 2 for red = "1 to 1").
export type RoulettePays = Record<'even' | 'dozen' | 'number', number>;
export function paysFor(kind: RouletteKind, pays: RoulettePays): number {
  return kind === 'number' ? pays.number : kind === 'dozen' || kind === 'column' ? pays.dozen : pays.even;
}

// The exact return to the player of one bet: the chance it wins × what it pays back.
export function rouletteRtp(kind: RouletteKind, pays: RoulettePays, pick = 0): number {
  return (coverage(kind, pick) / POCKETS) * paysFor(kind, pays);
}

// Where the ball stops: every pocket is equally likely.
export function spinRoulette(rng: Rng): number {
  return Math.min(POCKETS - 1, Math.floor(rng.next() * POCKETS));
}
