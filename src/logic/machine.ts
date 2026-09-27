// machine.ts — LOGIC layer. Pure slot-machine rules, with no state and no timing.
//
// Everything here is a plain function: give it the machine's data (from data.json),
// get an answer back. That makes it easy to test.
//
// A spin fills a GRID: grid[reel][row] is one symbol id. A machine with one row
// (Old Clunky) has a single payline straight across. A machine with more rows
// (the Snack Stacker) lists its paylines in data.json: each line says which row
// it crosses on every reel, e.g. [0, 1, 2, 1] = top, middle, bottom, middle.
//
// Three special kinds of symbol (flags in data.json):
//   "wild": true     the Hamster Wild stands in for any normal symbol on a line
//   "scatter": true  counts ANYWHERE on the grid, never on a line (the Hamster
//                    Ball starts free spins, the Cheek Pouch the jackpot wheel)
//   "blank": true    the Wood Shaving: the "empty stop" of a real reel strip. It
//                    never pays, a wild can't stand in for it, and it ends a run.
//                    Luck works against it (game.ts getSymbols).

import type { MachineDef, Payouts, SymbolRules, LineResult, LineWin, Grid, Cell, FreeSpinsDef } from './types.ts';
import type { Rng } from './rng.ts';

// How many rows count on a machine. Old Clunky has 1: the rows above and below
// its payline are only decoration.
export function rowCount(machineData: MachineDef): number {
  return machineData.rows || 1;
}

// Every payline the machine could ever have, in the order they unlock.
// A one-row machine has a single line straight across row 0.
export function allPaylines(machineData: MachineDef): number[][] {
  return machineData.paylines || [new Array(machineData.maxReels).fill(0)];
}

// Which symbols are special on this machine:
//   { wild: id or null, scatters: Set of ids, blanks: Set of ids }
export function symbolRules(machineData: MachineDef): SymbolRules {
  const wild = machineData.symbols.find((s) => s.wild);
  const ids = (flag: 'scatter' | 'blank') => new Set(machineData.symbols.filter((s) => s[flag]).map((s) => s.id));
  return { wild: wild ? wild.id : null, scatters: ids('scatter'), blanks: ids('blank') };
}

const NO_RULES: SymbolRules = { wild: null, scatters: new Set(), blanks: new Set() };

// Scatters and blanks never count on a line: they end a run where they stand.
const endsRun = (rules: SymbolRules, id: string) => rules.scatters.has(id) || (!!rules.blanks && rules.blanks.has(id));

// Spin the reels: every cell independently picks a symbol by weight.
// Cells are filled reel by reel, top to bottom. (The order matters: it decides
// which random number goes where, so the same seed always gives the same grid.)
export function rollGrid(machineData: MachineDef, reelCount: number, rng: Rng): Grid {
  const rows = rowCount(machineData);
  const grid: Grid = [];
  for (let reel = 0; reel < reelCount; reel++) {
    const column: string[] = [];
    for (let row = 0; row < rows; row++) column.push(rng.pickWeighted(machineData.symbols).id);
    grid.push(column);
  }
  return grid;
}

// The symbols one payline crosses, reading left to right.
export function lineSymbols(grid: Grid, line: number[]): string[] {
  return grid.map((column, reel) => column[line[reel]]);
}

// payouts[symbol]["count"], or 0. (JSON object keys are always strings.)
function payFor(payouts: Payouts, symbolId: string | null | undefined, count: number): number {
  if (count < 2 || !symbolId) return 0;
  const table = payouts[symbolId] || {};
  return table[String(count)] || 0;
}

// Score ONE line using the "count matches from the left" rule:
// count identical symbols starting at reel 1. 2+ in a row pays payouts[symbol][count].
//   ["seed","seed","carrot"]  → count 2 → pays payouts.seed["2"]
//   ["seed","carrot","carrot"] → count 1 → no win (the match must start at reel 1)
//
// With a WILD, the line can be read two ways, and it pays the better one
// (compared on the base payouts), like a real pokie:
//   the WILD reading:   j wilds at the start pay payouts.wild[j] (j ≥ 2)
//   the SYMBOL reading: the first real symbol, counting every wild before and
//                       after it: [wild, carrot, wild, seed] = 3 Baby Carrots
// A scatter or a blank never counts on a line and ends a run:
//   [seed, wild, blank, seed] = 2 seeds;  [wild, wild, blank, …] = 2 wilds.
// Returns { symbolId, count, basePayout, usedWild }.
export function evaluate(symbols: string[], payouts: Payouts, rules: SymbolRules = NO_RULES): LineResult {
  const R = symbols.length;
  const wild = rules.wild;
  let j = 0; // leading wilds
  while (wild && j < R && symbols[j] === wild) j++;
  const wildPay = j >= 2 ? payFor(payouts, wild, j) : 0;
  if (j === R) return { symbolId: wild, count: R, basePayout: wildPay, usedWild: true };

  const first = symbols[j];
  let count = j + 1;
  if (!endsRun(rules, first)) {
    while (count < R && (symbols[count] === first || (wild && symbols[count] === wild))) count++;
  }
  const symbolPay = endsRun(rules, first) ? 0 : payFor(payouts, first, count);

  if (symbolPay > 0 && symbolPay >= wildPay) {
    return { symbolId: first, count, basePayout: symbolPay, usedWild: !!wild && symbols.slice(0, count).includes(wild) };
  }
  if (wildPay > 0) return { symbolId: wild, count: j, basePayout: wildPay, usedWild: true };
  return { symbolId: symbols[0], count: j > 0 ? j : count, basePayout: 0, usedWild: false };
}

// Is this line a FULL line: every reel the same line symbol (wilds may fill in),
// or wilds only? Then there is only one run, and it pays once, however you read it.
export function isFullLine(symbols: string[], rules: SymbolRules = NO_RULES): boolean {
  let symbol: string | null = null;
  for (const id of symbols) {
    if (endsRun(rules, id)) return false;
    if (id === rules.wild) continue;
    if (symbol !== null && id !== symbol) return false;
    symbol = id;
  }
  return true;
}

// Score a whole grid: every active payline is read on its own, and their wins
// add up. Returns only the lines that won:
//   { wins: [{ line, symbolId, count, basePayout, fullLine, usedWild, fromRight }], basePayout }
// `line` is the index into the machine's paylines; fullLine = every reel matched.
//
// PAYS BOTH WAYS (the "Pays Both Ways" upgrades): each line is ALSO read from the
// right-hand reel, the same way (evaluate() on the line backwards), and that win
// pays too, as its own entry with fromRight = true:
//   [seed, carrot, carrot] → no win from the left, 2 Baby Carrots from the right
//   [seed, seed, carrot, carrot, carrot] → 2 seeds from the left AND 3 carrots from the right
// A full line is still ONE win (paid from the left), never two.
export function evaluateGrid(grid: Grid, lines: number[][], payouts: Payouts, rules: SymbolRules = NO_RULES, bothWays = false): { wins: LineWin[]; basePayout: number } {
  const wins: LineWin[] = [];
  let basePayout = 0;
  const add = (index: number, r: LineResult, fromRight: boolean) => {
    if (r.basePayout <= 0) return;
    wins.push({ line: index, symbolId: r.symbolId, count: r.count, basePayout: r.basePayout, fullLine: r.count === grid.length, usedWild: r.usedWild, fromRight });
    basePayout += r.basePayout;
  };
  lines.forEach((line, index) => {
    const symbols = lineSymbols(grid, line);
    add(index, evaluate(symbols, payouts, rules), false);
    if (bothWays && !isFullLine(symbols, rules)) add(index, evaluate([...symbols].reverse(), payouts, rules), true);
  });
  return { wins, basePayout };
}

// Where a symbol landed anywhere on the grid (for scatters): [[reel, row], …].
export function findSymbol(grid: Grid, symbolId: string): Cell[] {
  const cells: Cell[] = [];
  grid.forEach((column, reel) => column.forEach((id, row) => { if (id === symbolId) cells.push([reel, row]); }));
  return cells;
}

// Each symbol's chance per cell, from the weights.
function chances(machineData: MachineDef): { id: string; p: number }[] {
  let total = 0;
  for (const s of machineData.symbols) total += s.weight;
  return machineData.symbols.map((s) => ({ id: s.id, p: total > 0 ? s.weight / total : 0 }));
}

// The exact average payout per spin (EV) and hit rate, worked out with probability
// instead of by spinning thousands of times.
//
// ONE line first. For a symbol with chance p on each reel, with R reels in total:
//   P(exactly k in a row from the left) = p^k × (1 − p)   when k < R (the next reel differs)
//   P(all R reels match)                = p^R
// EV of one line = sum over symbols and k of P(k) × payout(k).
// With a wild (chance w): the line starts with j wilds (w^j), then its first real
// symbol s (p), then the run goes on while cells are s OR wild ((p + w) per cell).
// Each of those cases pays the better of the two readings (see evaluate()).
//
// MORE lines: every line crosses one cell per reel, and every cell is its own
// random pick, so every line has exactly the same chances. Averages always add
// up (even though lines share cells), so EV = lines × EV of one line.
// The hit rate (the chance that ANY line pays) doesn't simply add up, because
// lines share cells. It's counted exactly instead: see gridHitRate() below.
//
// fullLineMultiplier (from the Jackpot Dance family trait) boosts only wins where
// EVERY reel matches (k = R). Pass machine data with adjusted symbol weights to
// get the EV after luck traits (game.ts does this).
//
// PAYS BOTH WAYS: a line also pays its run from the right, except a full line,
// which pays once. Every cell is its own random pick, so a line read backwards
// has exactly the same chances as one read forwards (and a full line is full
// both ways). So the right-hand reading is worth what the left-hand one is worth
// on lines that are NOT full:
//   EV both ways = EV + (EV − the part of the EV that full lines pay)
export function expectedValue(machineData: MachineDef, reelCount: number, fullLineMultiplier = 1, lineCount = 1, bothWays = false): { ev: number; hitRate: number } {
  const R = reelCount;
  const rules = symbolRules(machineData);
  const symbols = chances(machineData);
  const payouts = machineData.payouts;
  const w = rules.wild ? symbols.find((s) => s.id === rules.wild)!.p : 0;
  const wildPay = (j: number) => (j >= 2 ? payFor(payouts, rules.wild, j) : 0);

  let ev = 0;
  let fullEv = 0; // the part of ev paid by full lines
  let hitRate = 0;
  // fullLine = every reel is this symbol or a wild (it pays once, even both ways);
  // boosted = it's paid as a line of R, so Jackpot Dance multiplies it.
  const add = (chance: number, base: number, boosted: boolean, fullLine = boosted) => {
    if (!(chance > 0) || !(base > 0)) return;
    const value = chance * base * (boosted ? fullLineMultiplier : 1);
    ev += value;
    if (fullLine) fullEv += value;
    hitRate += chance;
  };

  if (w > 0) add(Math.pow(w, R), wildPay(R), true); // a line of wilds only
  for (let j = 0; j < R; j++) {
    const lead = Math.pow(w, j); // j wilds first …
    for (const s of symbols) {
      if (s.id === rules.wild || !(s.p > 0)) continue;
      if (endsRun(rules, s.id)) {
        add(lead * s.p, wildPay(j), false); // … then a scatter or a blank ends the line
        continue;
      }
      const q = s.p + w; // the run goes on while cells are this symbol or a wild
      for (let count = j + 1; count <= R; count++) {
        const chance = lead * s.p * Math.pow(q, count - j - 1) * (count < R ? 1 - q : 1);
        const symbolPay = payFor(payouts, s.id, count);
        if (symbolPay > 0 && symbolPay >= wildPay(j)) add(chance, symbolPay, count === R);
        else add(chance, wildPay(j), false, count === R);
      }
    }
  }
  const lines = allPaylines(machineData).slice(0, lineCount);
  if (bothWays && R > 2) {
    // (With 2 reels every pair is a full line, so nothing changes.)
    ev += ev - fullEv;
    hitRate = bothWaysHitRate(machineData, lines, R);
  } else if (lineCount > 1) {
    hitRate = gridHitRate(machineData, lines);
  }
  return { ev: ev * lineCount, hitRate };
}

// The chance that at least one line wins, counted exactly.
// A line wins when its first two cells make a pair: the same line symbol twice,
// or a line symbol and a wild, or two wilds (every 2-match pays, and a test
// checks that). A scatter or a blank never makes a pair: two Wood Shavings are
// not a win. So only reels 1 and 2 decide a hit.
//
// The trick that keeps it fast: try every way REEL 1 can land (8 symbols on
// 3 cells = 512 ways). Once reel 1 is fixed, every cell of reel 2 is its own
// independent pick, so
//   P(no line wins | reel 1) = the product, over reel 2's rows, of
//                              P(that cell pairs with none of the reel-1 cells
//                                its lines start from)
// and the hit rate is 1 − the average of that over reel 1.
// The answer is remembered, because the UI asks for the economy every frame.
const hitRateCache = new Map<string, number>();
function gridHitRate(machineData: MachineDef, lines: number[][]): number {
  const rules = symbolRules(machineData);
  const key = JSON.stringify([machineData.symbols.map((s) => [s.id, s.weight, !!s.blank]), rules.wild, lines.map((l) => [l[0], l[1]])]);
  if (hitRateCache.has(key)) return hitRateCache.get(key)!;

  const symbols = chances(machineData).filter((s) => s.p > 0);
  const onLine = (id: string) => !endsRun(rules, id);
  const pair = (a: string, b: string) => onLine(a) && onLine(b) && (a === b || a === rules.wild || b === rules.wild);
  const rows0 = [...new Set(lines.map((l) => l[0]))]; // the rows of reel 1 that some line starts on
  const rows1 = [...new Set(lines.map((l) => l[1]))]; // the rows of reel 2 that some line crosses
  const picked: Record<number, string> = {}; // reel-1 row → symbol id, filled in by the loop below

  let miss = 0; // the chance that NO line wins
  (function tryRow(i: number, chance: number): void {
    if (i < rows0.length) {
      for (const s of symbols) {
        picked[rows0[i]] = s.id;
        tryRow(i + 1, chance * s.p);
      }
      return;
    }
    let none = chance;
    for (const r of rows1) {
      const partners = lines.filter((l) => l[1] === r).map((l) => picked[l[0]]);
      let safe = 0; // P(the reel-2 cell in row r pairs with none of its partners)
      for (const b of symbols) if (!partners.some((a) => pair(a, b.id))) safe += b.p;
      none *= safe;
    }
    miss += none;
  })(0, 1);

  const hit = 1 - miss;
  if (hitRateCache.size > 256) hitRateCache.clear(); // never grows without limit
  hitRateCache.set(key, hit);
  return hit;
}

// The hit rate when lines pay both ways: a line wins when its first two cells
// make a pair OR its last two do. Still exact, with the same trick as above:
//   4+ reels: the two ends use different reels, so they're independent:
//             P(no win) = P(no pair on the left) × P(no pair on the right),
//             and the right end is the left-end sum on the lines backwards.
//   3 reels:  both ends share the middle reel, so try every way IT can land;
//             then every cell of reels 1 and 3 is its own independent pick.
function bothWaysHitRate(machineData: MachineDef, lines: number[][], R: number): number {
  if (R >= 4) {
    const missLeft = 1 - gridHitRate(machineData, lines);
    const missRight = 1 - gridHitRate(machineData, lines.map((l) => [l[R - 1], l[R - 2]]));
    return 1 - missLeft * missRight;
  }
  const rules = symbolRules(machineData);
  const key = JSON.stringify(['both', machineData.symbols.map((s) => [s.id, s.weight, !!s.blank]), rules.wild, lines.map((l) => l.slice(0, 3))]);
  if (hitRateCache.has(key)) return hitRateCache.get(key)!;

  const symbols = chances(machineData).filter((s) => s.p > 0);
  const onLine = (id: string) => !endsRun(rules, id);
  const pair = (a: string, b: string) => onLine(a) && onLine(b) && (a === b || a === rules.wild || b === rules.wild);
  const middle = [...new Set(lines.map((l) => l[1]))]; // the rows of reel 2 that some line crosses
  const picked: Record<number, string> = {}; // reel-2 row → symbol id

  let miss = 0;
  (function tryRow(i: number, chance: number): void {
    if (i < middle.length) {
      for (const s of symbols) {
        picked[middle[i]] = s.id;
        tryRow(i + 1, chance * s.p);
      }
      return;
    }
    let none = chance;
    for (const reel of [0, 2]) {
      for (const r of new Set(lines.map((l) => l[reel]))) {
        const partners = lines.filter((l) => l[reel] === r).map((l) => picked[l[1]]);
        let safe = 0; // P(this cell pairs with none of its partners on reel 2)
        for (const b of symbols) if (!partners.some((a) => pair(a, b.id))) safe += b.p;
        none *= safe;
      }
    }
    miss += none;
  })(0, 1);

  const hit = 1 - miss;
  if (hitRateCache.size > 256) hitRateCache.clear();
  hitRateCache.set(key, hit);
  return hit;
}

// ─────────────── Scatters: free spins and the jackpot wheel ───────────────
// A scatter counts anywhere on the grid, and every cell is its own random pick,
// so the number of scatters follows the binomial formula:
//   P(exactly k of n cells) = C(n, k) × p^k × (1 − p)^(n − k)

// P(exactly k scatters) for k = 0 … cells.
export function scatterDistribution(p: number, cells: number): number[] {
  const out: number[] = [];
  let choose = 1; // C(cells, k), built up step by step
  for (let k = 0; k <= cells; k++) {
    if (k > 0) choose = (choose * (cells - k + 1)) / k;
    out.push(choose * Math.pow(p, k) * Math.pow(1 - p, cells - k));
  }
  return out;
}

// The chance of one symbol per cell.
export function symbolChance(machineData: MachineDef, symbolId: string): number {
  const s = chances(machineData).find((x) => x.id === symbolId);
  return s ? s.p : 0;
}

// Free spins won for `count` scatters: the award for the biggest listed count
// that fits ("5" means 5 or more), plus extra spins from upgrades. 0 = no trigger.
export function freeSpinAward(freeSpins: FreeSpinsDef, count: number, extra = 0): number {
  let award = 0;
  for (const [k, spins] of Object.entries(freeSpins.awards)) {
    if (count >= Number(k) && spins > 0) award = Math.max(award, spins);
  }
  return award > 0 ? award + extra : 0;
}

// The fewest scatters that trigger anything.
export function minTrigger(awards: Record<string, number>): number {
  return Math.min(...Object.keys(awards).map(Number));
}

// Free spins, exactly:
//   q          = the chance a spin triggers them
//   perTrigger = the average award when it does
//   total      = the average number of free spins per trigger INCLUDING retriggers.
//                Each free spin can retrigger with chance q, so total = N + q·N·total,
//                which gives total = N / (1 − q·N).
export function freeSpinStats(machineData: MachineDef, reelCount: number, extra = 0): { q: number; perTrigger: number; total: number } {
  const fs = machineData.freeSpins;
  if (!fs) return { q: 0, perTrigger: 0, total: 0 };
  const cells = reelCount * rowCount(machineData);
  const dist = scatterDistribution(symbolChance(machineData, fs.symbol), cells);
  let q = 0;
  let spins = 0;
  dist.forEach((chance, k) => {
    const award = freeSpinAward(fs, k, extra);
    if (award > 0) { q += chance; spins += chance * award; }
  });
  const perTrigger = q > 0 ? spins / q : 0;
  const loop = q * perTrigger;
  return { q, perTrigger, total: loop < 1 ? perTrigger / (1 - loop) : Infinity };
}

// The jackpot wheel, exactly. It starts on `min`+ bonus symbols (chance q), then
// picks a pot by weight. Every paid spin adds `growth` to each pot, and a pot
// goes back to its seed when won. In the long run, a pot won with chance c per
// spin is won after 1/c spins on average, holding seed + growth/c by then. So on
// average each pot pays c × seed + growth per spin: everything that flows in
// flows back out. (All in base units: before the bet and payout bonuses.)
// seedMultiplier (Golden Pouches, M8): pots start again at seed × this after a win.
export function jackpotStats(machineData: MachineDef, reelCount: number, growthMultiplier = 1, seedMultiplier = 1): { q: number; ev: number; pots: { id: string; chance: number }[] } {
  const jp = machineData.jackpot;
  if (!jp) return { q: 0, ev: 0, pots: [] };
  const cells = reelCount * rowCount(machineData);
  const dist = scatterDistribution(symbolChance(machineData, jp.symbol), cells);
  const q = dist.slice(jp.min).reduce((a, b) => a + b, 0);
  const totalWeight = jp.pots.reduce((sum, pot) => sum + pot.weight, 0);
  let ev = 0;
  const pots = jp.pots.map((pot) => {
    const chance = (q * pot.weight) / totalWeight; // this pot is won on a spin
    ev += chance * pot.seed * seedMultiplier + pot.growth * growthMultiplier;
    return { id: pot.id, chance };
  });
  return { q, ev, pots };
}

// What spinExpectation can be told (all optional).
export interface SpinOptions {
  lines?: number;
  fullLineMultiplier?: number;
  streakPerStack?: number;
  streakCap?: number;
  extraFreeSpins?: number;
  jackpotGrowth?: number;
  spinDuration?: number;
  bothWays?: boolean; // lines pay from the right too (the "Pays Both Ways" upgrades)
  potSeedMultiplier?: number; // jackpot pots start bigger (Golden Pouches, M8)
}

// What a paid spin is worth, and where that comes from.
export interface SpinValue {
  ev: number;
  lineEv: number;
  hitRate: number;
  streakFactor: number;
  freeSpins: { chance: number; perTrigger: number; perTriggerWithRetriggers: number; perSpin: number; ev: number };
  jackpot: { chance: number; ev: number; pots: { id: string; chance: number }[] };
  extraSeconds: number;
}

// Everything a PAID spin is worth on average, in base units (×1 bet, before the
// payout bonuses), with every feature the machine has:
//   ev = line EV × streak factor          (Hot Streak, paid spins only)
//      + free spins per paid spin × line EV × free-spin multiplier
//      + the jackpot wheel's long-run pay (see jackpotStats)
// Hot Streak: a win after n wins in a row pays × (1 + perStack × min(n, cap)).
// The streak before a spin doesn't change that spin's odds, and in the long run
// P(n ≥ k) = h^k (h = hit rate), so the average bonus is perStack × (h + h² + … + h^cap).
// extraSeconds = how much time the features add per paid spin on average
// (free spins and the jackpot wheel pause auto-spin while they play).
export function spinExpectation(machineData: MachineDef, reelCount: number, opts: SpinOptions = {}): SpinValue {
  const {
    lines = 1, fullLineMultiplier = 1, streakPerStack = 0, streakCap = 0,
    extraFreeSpins = 0, jackpotGrowth = 1, spinDuration = machineData.spinDuration, bothWays = false, potSeedMultiplier = 1,
  } = opts;
  const { ev: lineEv, hitRate } = expectedValue(machineData, reelCount, fullLineMultiplier, lines, bothWays);
  let streakSum = 0;
  for (let k = 1; k <= streakCap; k++) streakSum += Math.pow(hitRate, k);
  const streakFactor = 1 + streakPerStack * streakSum;

  const fsData = machineData.freeSpins;
  const fs = freeSpinStats(machineData, reelCount, extraFreeSpins);
  const freeSpinsPerSpin = fs.q * fs.total;
  const freeEv = fsData ? freeSpinsPerSpin * lineEv * fsData.multiplier : 0;

  const jp = jackpotStats(machineData, reelCount, jackpotGrowth, potSeedMultiplier);
  const extraSeconds = (fsData ? freeSpinsPerSpin * (spinDuration + fsData.pause) : 0)
    + (machineData.jackpot ? jp.q * machineData.jackpot.duration : 0);

  return {
    ev: lineEv * streakFactor + freeEv + jp.ev,
    lineEv, hitRate, streakFactor,
    freeSpins: { chance: fs.q, perTrigger: fs.perTrigger, perTriggerWithRetriggers: fs.total, perSpin: freeSpinsPerSpin, ev: freeEv },
    jackpot: { chance: jp.q, ev: jp.ev, pots: jp.pots },
    extraSeconds,
  };
}
