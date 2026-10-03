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
//
// Most machines pay on PAYLINES. A "ways" machine (M9: "ways": true, the Hamster
// Maze) has none: see evaluateWays below.
//
// 1.4.0: MOVING BOXES (Moving Day, "mystery" in data.json). Every box that lands
// turns into the same symbol before the spin is scored (revealMystery below).
//
// 1.10.0 (Burrow Party): ZOOMIES turn whole reels wild on a paid spin, and on the
// Burrow Bonanza STICKY WILDS stay put for a few free spins while the free-spin
// multiplier CLIMBS. All three keep the maths exact: see the end of this file.

import type { MachineDef, Payouts, SymbolRules, LineResult, LineWin, Grid, Cell, FreeSpinsDef, WheelDef, ZoomiesDef } from './types.ts';
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
// On a ways machine the wild never lands on reel 1 (like a real 243-ways pokie),
// so every win starts with a real symbol.
export function rollGrid(machineData: MachineDef, reelCount: number, rng: Rng): Grid {
  const rows = rowCount(machineData);
  const firstReel = machineData.ways ? machineData.symbols.map((s) => (s.wild ? { ...s, weight: 0 } : s)) : machineData.symbols;
  const grid: Grid = [];
  for (let reel = 0; reel < reelCount; reel++) {
    const column: string[] = [];
    for (let row = 0; row < rows; row++) column.push(rng.pickWeighted(reel === 0 ? firstReel : machineData.symbols).id);
    grid.push(column);
  }
  return grid;
}

// ── Moving boxes (1.4.0, Moving Day) ──
// What a box can turn into right now, with the chances: the machine's reveal list,
// but only symbols its reels can land on (a locked symbol never comes out of a box).
// Empty when the machine has no boxes, or none can land (then there's nothing to average).
export function mysteryOptions(machineData: MachineDef): { symbol: string; p: number }[] {
  const m = machineData.mystery;
  if (!m) return [];
  const weightOf = (id: string) => (machineData.symbols.find((x) => x.id === id) || { weight: 0 }).weight;
  if (!(weightOf(m.symbol) > 0)) return [];
  const on = m.reveal.filter((r) => weightOf(r.symbol) > 0 && r.weight > 0);
  const total = on.reduce((sum, r) => sum + r.weight, 0);
  return total > 0 ? on.map((r) => ({ symbol: r.symbol, p: r.weight / total })) : [];
}

// The machine once its boxes have turned into `symbol`: the box's weight moves to it.
export function withReveal(machineData: MachineDef, symbol: string): MachineDef {
  const box = machineData.mystery!.symbol;
  const extra = (machineData.symbols.find((x) => x.id === box) || { weight: 0 }).weight;
  return {
    ...machineData,
    symbols: machineData.symbols.map((x) => (x.id === box ? { ...x, weight: 0 } : x.id === symbol ? { ...x, weight: x.weight + extra } : x)),
  };
}

// Turn every box on a grid into one symbol, picked by the reveal weights. It returns
// the new grid, the cells that were boxes and what they became; null when no box landed.
export function revealMystery(grid: Grid, machineData: MachineDef, rng: Rng): { grid: Grid; cells: Cell[]; symbol: string } | null {
  const m = machineData.mystery;
  if (!m) return null;
  const cells = findSymbol(grid, m.symbol);
  const options = mysteryOptions(machineData);
  if (!cells.length || !options.length) return null;
  const symbol = rng.pickWeighted(options.map((o) => ({ symbol: o.symbol, weight: o.p }))).symbol;
  const out = grid.map((column) => column.map((id) => (id === m.symbol ? symbol : id)));
  return { grid: out, cells, symbol };
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

// ─────────────── Ways (M9: the Hamster Maze) ───────────────
// No paylines: a symbol wins when it's on reel 1 AND on the reels right after
// it, on ANY row. Every path through those reels (one cell per reel) is a "way",
// and each way pays the paytable amount:
//   reel 1: 1 carrot, reel 2: 2 carrots, reel 3: 1 carrot + 1 wild, reel 4: none
//   → 3 reels in a row, 1 × 2 × 2 = 4 ways → 4 × payouts.carrot["3"]
// The wild stands in on reels 2 onwards (it never lands on reel 1: rollGrid).
// With 3 rows and 5 reels there are 3^5 = 243 ways; with 3 reels, 27.
// Returns every symbol that won, with its ways and the cells to light up.
export function evaluateWays(grid: Grid, payouts: Payouts, rules: SymbolRules, symbolIds: string[]): { wins: LineWin[]; basePayout: number } {
  const wins: LineWin[] = [];
  let basePayout = 0;
  const R = grid.length;
  symbolIds.forEach((id, index) => {
    if (id === rules.wild || endsRun(rules, id) || !grid[0].includes(id)) return;
    const cells: Cell[] = [];
    let ways = 1;
    let count = 0;
    for (let reel = 0; reel < R; reel++) {
      const here: Cell[] = [];
      grid[reel].forEach((cell, row) => { if (cell === id || (reel > 0 && cell === rules.wild)) here.push([reel, row]); });
      if (!here.length) break;
      ways *= here.length;
      cells.push(...here);
      count++;
    }
    const pay = payFor(payouts, id, count);
    if (!(pay > 0)) return;
    wins.push({
      line: index, symbolId: id, count, basePayout: pay * ways, fullLine: count === R,
      usedWild: cells.some(([reel, row]) => grid[reel][row] === rules.wild), fromRight: false, ways, cells,
    });
    basePayout += pay * ways;
  });
  return { wins, basePayout };
}

// The exact EV of a ways machine. Every cell is its own random pick, so the
// count of a symbol on each reel is independent of the other reels, and
//   ways for EXACTLY k reels = c1 × c2 × … × ck × [reel k+1 has none]
// averages to E[c1] × … × E[ck] × P(reel k+1 has none) (averages of independent
// things multiply). E[c] = rows × p (reel 1: the symbol alone, without the wild's
// weight; reels 2+: the symbol OR the wild). fullEv = the part paid by wins on
// every reel (Jackpot Dance and the cheese wheel work on those).
function waysExpected(machineData: MachineDef, R: number, fullLineMultiplier: number): { ev: number; fullEv: number; hitRate: number } {
  const rows = rowCount(machineData);
  const rules = symbolRules(machineData);
  const all = chances(machineData);
  const w = rules.wild ? all.find((s) => s.id === rules.wild)!.p : 0;
  const first = chances({ ...machineData, symbols: machineData.symbols.map((s) => (s.wild ? { ...s, weight: 0 } : s)) });
  let ev = 0;
  let fullEv = 0;
  all.forEach((s, i) => {
    if (s.id === rules.wild || endsRun(rules, s.id) || !(s.p > 0)) return;
    const e1 = rows * first[i].p;
    const q = s.p + w;
    const miss = Math.pow(1 - q, rows); // P(a later reel has none of it)
    let product = e1;
    for (let k = 1; k <= R; k++) {
      if (k > 1) product *= rows * q;
      const pay = payFor(machineData.payouts, s.id, k);
      if (!(pay > 0)) continue;
      const value = (k < R ? product * miss : product) * pay * (k === R ? fullLineMultiplier : 1);
      ev += value;
      if (k === R) fullEv += value;
    }
  });
  return { ev, fullEv, hitRate: waysHitRate(machineData, R) };
}

// The chance a ways spin wins anything, counted exactly. A symbol wins once it's
// on reel 1 and on every reel up to its shortest paying run (3 on the Maze). So
// what matters is WHICH symbols each reel shows, not where. Reel by reel, keep
// the chances of "these symbols are still alive" (on every reel so far; a wild
// keeps them all alive). The chance a reel shows exactly the set A of symbols is
// worked out by inclusion–exclusion:
//   P(exactly A) = Σ over B ⊆ A of (−1)^(|A|−|B|) × P(every cell is in B or a non-paying symbol)
// A reel of 3 cells shows at most 3 symbols, so only small sets are tried.
function waysHitRate(machineData: MachineDef, R: number): number {
  const rules = symbolRules(machineData);
  const key = JSON.stringify(['ways', R, machineData.symbols.map((s) => [s.id, s.weight]), machineData.payouts]);
  if (hitRateCache.has(key)) return hitRateCache.get(key)!;
  const rows = rowCount(machineData);
  const all = chances(machineData);
  const first = chances({ ...machineData, symbols: machineData.symbols.map((s) => (s.wild ? { ...s, weight: 0 } : s)) });
  // The paying symbols, and the shortest run each one pays for.
  const paying = all.map((s, i) => ({ ...s, i })).filter((s) => s.id !== rules.wild && !endsRun(rules, s.id) && s.p > 0)
    .map((s) => ({ ...s, min: Array.from({ length: R }, (_, k) => k + 1).find((k) => payFor(machineData.payouts, s.id, k) > 0) || 0 }))
    .filter((s) => s.min > 0);
  if (!paying.length) return 0;
  const n = paying.length;
  const wildP = rules.wild ? all.find((s) => s.id === rules.wild)!.p : 0;

  // Every set of at most `rows` of the tracked things (paying symbols, then the wild as bit n), with its chance.
  function patterns(p: number[]): { mask: number; chance: number }[] {
    const other = 1 - p.reduce((a, b) => a + b, 0); // blanks, scatters: they never help
    const items = p.map((x, i) => i).filter((i) => p[i] > 0);
    const out: { mask: number; chance: number }[] = [];
    (function pick(start: number, chosen: number[]): void {
      let chance = 0; // inclusion–exclusion over the subsets of `chosen`
      const m = chosen.length;
      for (let sub = 0; sub < 1 << m; sub++) {
        let sum = other;
        let size = 0;
        for (let b = 0; b < m; b++) if (sub & (1 << b)) { sum += p[chosen[b]]; size++; }
        chance += ((m - size) % 2 ? -1 : 1) * Math.pow(Math.max(0, sum), rows);
      }
      if (chance > 1e-15) out.push({ mask: chosen.reduce((acc, b) => acc | (1 << b), 0), chance });
      if (m === rows) return;
      for (let j = start; j < items.length; j++) pick(j + 1, [...chosen, items[j]]);
    })(0, []);
    return out;
  }
  const reel1 = patterns(paying.map((s) => first[s.i].p));
  const later = patterns([...paying.map((s) => s.p), wildP]);
  const wildBit = 1 << n;
  const reached = (k: number) => paying.reduce((acc, s, b) => (s.min === k ? acc | (1 << b) : acc), 0); // symbols that win at k reels

  let hit = 0;
  let alive = new Map<number, number>();
  for (const { mask, chance } of reel1) if (mask) alive.set(mask, (alive.get(mask) || 0) + chance);
  for (let k = 2; k <= R && alive.size; k++) {
    const next = new Map<number, number>();
    const wins = reached(k);
    for (const [set, chance] of alive) {
      for (const pat of later) {
        const still = pat.mask & wildBit ? set : set & pat.mask;
        if (!still) continue;
        if (still & wins) hit += chance * pat.chance;
        else next.set(still, (next.get(still) || 0) + chance * pat.chance);
      }
    }
    alive = next;
  }
  if (hitRateCache.size > 256) hitRateCache.clear();
  hitRateCache.set(key, hit);
  return hit;
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
export function expectedValue(machineData: MachineDef, reelCount: number, fullLineMultiplier = 1, lineCount = 1, bothWays = false): { ev: number; hitRate: number; fullEv: number } {
  // Moving boxes (1.4.0): the average over what they turn into. Given the symbol they
  // become, a grid is an ordinary grid with the boxes' weight added to that symbol
  // (every cell is still its own draw), so each part is the ordinary maths below.
  const options = mysteryOptions(machineData);
  if (options.length) {
    const out = { ev: 0, hitRate: 0, fullEv: 0 };
    for (const o of options) {
      const r = expectedValue(withReveal(machineData, o.symbol), reelCount, fullLineMultiplier, lineCount, bothWays);
      out.ev += o.p * r.ev;
      out.hitRate += o.p * r.hitRate;
      out.fullEv += o.p * r.fullEv;
    }
    return out;
  }
  if (machineData.ways) return waysExpected(machineData, reelCount, fullLineMultiplier); // (no lines, and no both ways)
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
  return { ev: ev * lineCount, hitRate, fullEv: fullEv * lineCount };
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
// `cells` = how many cells can hold a scatter (fewer when Zoomies turned reels wild).
export function freeSpinStats(machineData: MachineDef, reelCount: number, extra = 0, cells = reelCount * rowCount(machineData)): { q: number; perTrigger: number; total: number } {
  const fs = machineData.freeSpins;
  if (!fs) return { q: 0, perTrigger: 0, total: 0 };
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
export function jackpotStats(machineData: MachineDef, reelCount: number, growthMultiplier = 1, seedMultiplier = 1, cells = reelCount * rowCount(machineData)): { q: number; ev: number; pots: { id: string; chance: number }[] } {
  const jp = machineData.jackpot;
  if (!jp) return { q: 0, ev: 0, pots: [] };
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

// ─────────────── Hold & spin (M9: the Acorn Vault), exactly ───────────────
// `trigger`+ coins on a paid spin start it (the coin count is binomial, like any
// scatter). Then it's a little chain of chances: with n coins held and r respins
// left, each of the N − n empty cells lands a coin with chance q on a respin, so
// the number of new coins j is binomial too. j > 0 → (n + j coins, respins back
// to R0); j = 0 → (n, r − 1). It stops at r = 0 or when every cell holds a coin.
// Worked backwards from the full grid, for every (n, r):
//   F = the average number of coins at the end, G = the chance the grid fills
//   (the Grand), S = the average number of respins played.
// Every coin's value is its own random pick, so the average bonus is
//   F × (the average coin value) + G × grand.
// `cells` = how many cells can land a coin on the spin itself (fewer when Zoomies
// turned reels wild); the bonus still plays on the whole board.
export function holdSpinStats(machineData: MachineDef, reelCount: number, extraRespins = 0, cells = reelCount * rowCount(machineData)): { q: number; ev: number; full: number; respins: number; coins: number } {
  const hs = machineData.holdSpin;
  if (!hs) return { q: 0, ev: 0, full: 0, respins: 0, coins: 0 };
  const N = reelCount * rowCount(machineData);
  const R0 = hs.respins + extraRespins;
  const q = hs.respinChance;
  // F[n][r], G[n][r], S[n][r] for n = 0 … N, r = 0 … R0.
  const F: number[][] = [];
  const G: number[][] = [];
  const S: number[][] = [];
  for (let n = N; n >= 0; n--) {
    F[n] = [];
    G[n] = [];
    S[n] = [];
    const b = n < N ? scatterDistribution(q, N - n) : [1]; // P(j new coins) on one respin
    for (let r = 0; r <= R0; r++) {
      if (n === N || r === 0) {
        F[n][r] = n;
        G[n][r] = n === N ? 1 : 0;
        S[n][r] = 0;
        continue;
      }
      F[n][r] = b[0] * F[n][r - 1];
      G[n][r] = b[0] * G[n][r - 1];
      S[n][r] = 1 + b[0] * S[n][r - 1];
      for (let j = 1; j < b.length; j++) {
        F[n][r] += b[j] * F[n + j][R0];
        G[n][r] += b[j] * G[n + j][R0];
        S[n][r] += b[j] * S[n + j][R0];
      }
    }
  }
  const totalWeight = hs.values.reduce((sum, v) => sum + v.weight, 0);
  const meanValue = hs.values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight;
  const dist = scatterDistribution(symbolChance(machineData, hs.symbol), cells);
  let chance = 0;
  let ev = 0;
  let full = 0;
  let respins = 0;
  let coins = 0;
  dist.forEach((p, k) => {
    if (k < hs.trigger) return;
    chance += p;
    ev += p * (F[k][R0] * meanValue + G[k][R0] * hs.grand);
    full += p * G[k][R0];
    respins += p * S[k][R0];
    coins += p * F[k][R0];
  });
  // respins and coins: per trigger (the average bonus), not per spin
  return { q: chance, ev, full, respins: chance > 0 ? respins / chance : 0, coins: chance > 0 ? coins / chance : 0 };
}

// The cheese wheel's average multiplier, with `bonus` added to every wedge (an upgrade).
export function wheelAverage(wheel: WheelDef, bonus = 0): number {
  const total = wheel.wedges.reduce((sum, w) => sum + w.weight, 0);
  return wheel.wedges.reduce((sum, w) => sum + (w.multiplier + bonus) * w.weight, 0) / total;
}

// ─────────────── Zoomies (1.10.0), exactly ───────────────
// On a paid spin, with chance z, the hamster dashes across the reels and turns
// `count` whole reels wild (count by weight, then which reels, all equally likely).
// Every other cell is still its own random pick, so the spin is an ordinary spin
// whose zoomed reels hold a wild in every row. The maths below is the line maths
// of expectedValue, but reel by reel (a zoomed reel's wild chance is 1).

// Can Zoomies run on this machine with this many reels? (Paylines and a wild only.)
export function canZoom(machineData: MachineDef, reelCount: number, def: ZoomiesDef | undefined): boolean {
  return !!def && !machineData.ways && !!machineData.paylines && reelCount >= def.minReels && symbolRules(machineData).wild !== null;
}

// Every way Zoomies can land, with its chance (given that it happens).
export function zoomCases(reelCount: number, def: ZoomiesDef): { reels: number[]; p: number }[] {
  const options = def.reels.filter((o) => o.weight > 0 && o.count >= 1 && o.count <= reelCount);
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  const out: { reels: number[]; p: number }[] = [];
  for (const o of options) {
    const sets: number[][] = [];
    (function pick(from: number, set: number[]): void {
      if (set.length === o.count) { sets.push(set); return; }
      for (let r = from; r < reelCount; r++) pick(r + 1, [...set, r]);
    })(0, []);
    for (const reels of sets) out.push({ reels, p: o.weight / total / sets.length });
  }
  return out;
}

// Which reels the hamster runs over this time (in reel order).
export function pickZoomReels(reelCount: number, def: ZoomiesDef, rng: Rng): number[] {
  const count = Math.min(reelCount, rng.pickWeighted(def.reels.filter((o) => o.count >= 1)).count);
  const reels = Array.from({ length: reelCount }, (_, i) => i);
  // A partial shuffle: draw `count` different reels, one random number each.
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng.next() * (reelCount - i));
    [reels[i], reels[j]] = [reels[j], reels[i]];
  }
  return reels.slice(0, count).sort((a, b) => a - b);
}

// Turn whole reels of a grid wild.
export function zoomGrid(grid: Grid, reels: number[], wild: string): Grid {
  return grid.map((column, reel) => (reels.includes(reel) ? column.map(() => wild) : column));
}

// ONE line's EV read from the left, when every reel has its own chances (reels[i]:
// symbol id → chance). Same cases as expectedValue: j wilds first, then the first
// real symbol, then the run goes on while cells are that symbol or a wild; only
// the powers become products, reel by reel.
function lineValueByReel(reels: Map<string, number>[], rules: SymbolRules, payouts: Payouts, fullLineMultiplier: number): { ev: number; fullEv: number } {
  const R = reels.length;
  const wildOn = (i: number) => (rules.wild ? reels[i].get(rules.wild) || 0 : 0);
  const chanceOf = (i: number, id: string) => reels[i].get(id) || 0;
  const wildPay = (j: number) => (j >= 2 ? payFor(payouts, rules.wild, j) : 0);
  const ids = [...new Set(reels.flatMap((r) => [...r.keys()]))].filter((id) => id !== rules.wild);
  let ev = 0;
  let fullEv = 0;
  const add = (chance: number, base: number, boosted: boolean, fullLine = boosted) => {
    if (!(chance > 0) || !(base > 0)) return;
    const value = chance * base * (boosted ? fullLineMultiplier : 1);
    ev += value;
    if (fullLine) fullEv += value;
  };
  if (rules.wild) {
    let all = 1;
    for (let i = 0; i < R; i++) all *= wildOn(i);
    add(all, wildPay(R), true); // a line of wilds only
  }
  let lead = 1; // the chance the first j reels are all wild
  for (let j = 0; j < R; j++) {
    for (const id of ids) {
      const p = chanceOf(j, id);
      if (!(p > 0)) continue;
      if (endsRun(rules, id)) {
        add(lead * p, wildPay(j), false);
        continue;
      }
      let run = lead * p; // reels j … count−1 hold this symbol or a wild (reel j: the symbol)
      for (let count = j + 1; count <= R; count++) {
        const next = count < R ? chanceOf(count, id) + wildOn(count) : 0;
        const chance = run * (count < R ? Math.max(0, 1 - next) : 1);
        const symbolPay = payFor(payouts, id, count);
        if (symbolPay > 0 && symbolPay >= wildPay(j)) add(chance, symbolPay, count === R);
        else add(chance, wildPay(j), false, count === R);
        run *= next;
      }
    }
    lead *= wildOn(j);
  }
  return { ev, fullEv };
}

// The chance that no line pays at one END of the lines: `pairs` gives each line's
// rows on the end reel and its neighbour; a zoomed reel is all wild.
//   neither zoomed: the usual count (gridHitRate)
//   both zoomed:    two wilds always pay, so every line wins
//   one zoomed:     a line wins when the other reel's cell is a line symbol (or a
//                   wild), so the chance is that every such cell is a scatter or a blank
function endMiss(machineData: MachineDef, pairs: number[][], zoomA: boolean, zoomB: boolean): number {
  if (!zoomA && !zoomB) return 1 - gridHitRate(machineData, pairs);
  if (zoomA && zoomB) return 0;
  const rules = symbolRules(machineData);
  const dead = chances(machineData).filter((s) => endsRun(rules, s.id)).reduce((sum, s) => sum + s.p, 0);
  const rows = new Set(pairs.map((l) => (zoomA ? l[1] : l[0])));
  return Math.pow(dead, rows.size);
}

// The lines of a spin where Zoomies turned `zoomed` reels wild: { ev, fullEv, hitRate },
// like expectedValue. Moving boxes: the average over what they turn into, as there.
// (Machines with Zoomies have 4+ reels, so with Pays Both Ways the two ends never share a reel.)
function zoomLines(machineData: MachineDef, R: number, zoomed: number[], fullLineMultiplier: number, lineCount: number, bothWays: boolean): { ev: number; hitRate: number; fullEv: number } {
  const options = mysteryOptions(machineData);
  if (options.length) {
    const out = { ev: 0, hitRate: 0, fullEv: 0 };
    for (const o of options) {
      const r = zoomLines(withReveal(machineData, o.symbol), R, zoomed, fullLineMultiplier, lineCount, bothWays);
      out.ev += o.p * r.ev;
      out.hitRate += o.p * r.hitRate;
      out.fullEv += o.p * r.fullEv;
    }
    return out;
  }
  const rules = symbolRules(machineData);
  const normal = new Map(chances(machineData).map((s) => [s.id, s.p] as [string, number]));
  const allWild = new Map([[rules.wild!, 1]]);
  const reels = Array.from({ length: R }, (_, i) => (zoomed.includes(i) ? allWild : normal));
  const left = lineValueByReel(reels, rules, machineData.payouts, fullLineMultiplier);
  let ev = left.ev;
  const lines = allPaylines(machineData).slice(0, lineCount);
  let miss = endMiss(machineData, lines.map((l) => [l[0], l[1]]), zoomed.includes(0), zoomed.includes(1));
  if (bothWays && R > 2) {
    // The right-hand reading pays on every line that isn't full (a full line pays once).
    const right = lineValueByReel([...reels].reverse(), rules, machineData.payouts, fullLineMultiplier);
    ev += right.ev - right.fullEv;
    miss *= endMiss(machineData, lines.map((l) => [l[R - 1], l[R - 2]]), zoomed.includes(R - 1), zoomed.includes(R - 2));
  }
  return { ev: ev * lineCount, hitRate: 1 - miss, fullEv: left.fullEv * lineCount };
}

// ─────────────── Burrow Party's free spins (1.10.0), exactly ───────────────
// STICKY WILDS: a wild that lands on a free spin stays for the next `sticky` free
// spins (landing again starts its count again). Every cell still draws a symbol on
// every spin, so a cell shows a wild on free spin k when ANY of its last
// min(k, sticky + 1) draws was a wild, each cell on its own:
//   P(wild)       = 1 − (1 − w)^min(k, sticky + 1)
//   P(symbol s)   = p_s × (1 − w)^min(k − 1, sticky)   (no wild still held, then s)
// so free spin k is an ordinary spin with those chances. The CLIMB: free spin k's
// wins are × (multiplier + climb × min(k − 1, steps)).
// Both stop changing after free spin K = max(sticky, steps) + 1. So the session is
// worked out spin by spin up to K (the chances of how many spins are left, after
// retriggers), and from K on every spin is the same: from r spins left, the spins
// still to come are r / (1 − loop) on average (loop = the chance of a retrigger ×
// its average award, as in freeSpinStats).

// Free spin k's chances (k = 1, 2, …), as weights that add up to 1.
export function stickyChances(machineData: MachineDef, k: number, sticky: number): MachineDef {
  const rules = symbolRules(machineData);
  if (!(sticky > 0) || !rules.wild) return machineData;
  const w = symbolChance(machineData, rules.wild);
  const clear = Math.pow(1 - w, Math.min(k - 1, sticky)); // no wild held from earlier spins
  return {
    ...machineData,
    symbols: chances(machineData).map((s) => ({
      ...machineData.symbols.find((x) => x.id === s.id)!,
      weight: s.id === rules.wild ? 1 - Math.pow(1 - w, Math.min(k, sticky + 1)) : s.p * clear,
    })),
  };
}

// What free spins are worth, per number of free spins first awarded:
//   value(N) = the average of Σ (multiplier × line EV) over every spin played, retriggers included
//   spins(N) = the average number played
export function freeSpinSession(
  machineData: MachineDef, reelCount: number,
  opts: { extra?: number; sticky?: number; steps?: number; fullLineMultiplier?: number; lines?: number; bothWays?: boolean; wheelBonus?: number },
): (award: number) => { value: number; spins: number } {
  const fs = machineData.freeSpins!;
  const { extra = 0, sticky = 0, steps = 0, fullLineMultiplier = 1, lines = 1, bothWays = false, wheelBonus = 0 } = opts;
  const average = machineData.wheel ? wheelAverage(machineData.wheel, wheelBonus) : 1;
  const cells = reelCount * rowCount(machineData);
  const K = Math.max(sticky, steps) + 1;
  // Free spin k: its line EV, its multiplier, and the chances of each retrigger award.
  const stage = (k: number) => {
    const md = stickyChances(machineData, k, sticky);
    const r = expectedValue(md, reelCount, fullLineMultiplier, lines, bothWays);
    const awards = new Map<number, number>();
    scatterDistribution(symbolChance(md, fs.symbol), cells).forEach((p, count) => {
      const a = freeSpinAward(fs, count, extra);
      awards.set(a, (awards.get(a) || 0) + p);
    });
    return { lineEv: r.ev + r.fullEv * (average - 1), multiplier: fs.multiplier + (fs.climb || 0) * Math.min(k - 1, steps), awards };
  };
  const stages = Array.from({ length: K }, (_, i) => stage(i + 1));
  const last = stages[K - 1];
  let loop = 0;
  for (const [a, p] of last.awards) loop += a * p;
  const tail = loop < 1 ? 1 / (1 - loop) : Infinity; // spins to come per spin left, from free spin K on
  const memo = new Map<number, { value: number; spins: number }>();
  return (award: number) => {
    if (memo.has(award)) return memo.get(award)!;
    let left = new Map<number, number>([[award, 1]]); // spins left → chance, before free spin k
    let value = 0;
    let spins = 0;
    for (let k = 1; k < K; k++) {
      const s = stages[k - 1];
      const next = new Map<number, number>();
      for (const [r, p] of left) {
        if (r <= 0) continue; // it's over
        value += p * s.multiplier * s.lineEv;
        spins += p;
        for (const [a, q] of s.awards) next.set(r - 1 + a, (next.get(r - 1 + a) || 0) + p * q);
      }
      left = next;
    }
    for (const [r, p] of left) {
      if (r <= 0) continue;
      value += p * r * tail * last.multiplier * last.lineEv;
      spins += p * r * tail;
    }
    const out = { value, spins };
    memo.set(award, out);
    return out;
  };
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
  extraRespins?: number; // hold & spin starts (and resets) with this many more respins (M9)
  wheelBonus?: number; // added to every wedge of the cheese wheel (M9)
  doubleChance?: number; // a winning paid spin pays double with this chance (Lucky Pennies, 1.3.1)
  zoomChance?: number; // a paid spin has Zoomies with this chance (1.10.0)
  zoomies?: ZoomiesDef; // how many reels Zoomies turns wild (data.json zoomies)
  stickyWilds?: number; // free spins: a wild stays this many more free spins (1.10.0, Sticky Wilds)
  climbSteps?: number; // free spins: the multiplier climbs this many steps (1.10.0, Party Climb)
}

// What a paid spin is worth, and where that comes from.
export interface SpinValue {
  ev: number;
  lineEv: number;
  hitRate: number;
  streakFactor: number;
  freeSpins: { chance: number; perTrigger: number; perTriggerWithRetriggers: number; perSpin: number; ev: number };
  jackpot: { chance: number; ev: number; pots: { id: string; chance: number }[] };
  hold: { chance: number; ev: number; full: number; respins: number; coins: number }; // M9: hold & spin (full = the Grand's chance per paid spin)
  wheel: { average: number; ev: number }; // M9: the cheese wheel (its average multiplier, and what it adds)
  zoom: { chance: number; ev: number }; // 1.10.0: Zoomies' chance per paid spin, and what it adds to the lines
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
// (free spins, the jackpot wheel and hold & spin pause auto-spin while they play).
// M9: the cheese wheel multiplies full lines: + (what full lines pay) × (the
// average multiplier − 1), part of the lines' EV (Hot Streak multiplies it too).
// Hold & spin adds its average bonus (holdSpinStats), on paid spins.
// 1.3.1: Lucky Pennies doubles a winning paid spin's lines with chance d. The coin
// toss doesn't depend on the reels, so on average the lines pay × (1 + d).
// 1.10.0: Zoomies. A paid spin is one of several CASES (no Zoomies, or these reels
// wild), each an ordinary spin worked out on its own; the paid spin is the average
// of the cases, weighted by their chances. A zoomed reel holds no scatters, so the
// features' triggers are counted over fewer cells. Free spins never have Zoomies.
// Sticky Wilds and the climb change only the free spins (freeSpinSession).
export function spinExpectation(machineData: MachineDef, reelCount: number, opts: SpinOptions = {}): SpinValue {
  const {
    lines = 1, fullLineMultiplier = 1, streakPerStack = 0, streakCap = 0,
    extraFreeSpins = 0, jackpotGrowth = 1, spinDuration = machineData.spinDuration, bothWays = false, potSeedMultiplier = 1,
    extraRespins = 0, wheelBonus = 0, doubleChance = 0, zoomChance = 0, zoomies, stickyWilds = 0, climbSteps = 0,
  } = opts;
  const rows = rowCount(machineData);
  const average = machineData.wheel ? wheelAverage(machineData.wheel, wheelBonus) : 1;
  const lines0 = expectedValue(machineData, reelCount, fullLineMultiplier, lines, bothWays);
  const plainLineEv = lines0.ev + lines0.fullEv * (average - 1); // a spin without Zoomies (and every free spin)

  // The cases a paid spin can be.
  const z = canZoom(machineData, reelCount, zoomies) && zoomChance > 0 ? Math.min(1, zoomChance) : 0;
  const cases: { reels: number[]; p: number }[] = [{ reels: [], p: 1 - z }];
  if (z > 0) for (const c of zoomCases(reelCount, zoomies!)) cases.push({ reels: c.reels, p: z * c.p });

  const fsData = machineData.freeSpins;
  const hs = machineData.holdSpin;
  // Free spins: the old closed form when nothing changes from spin to spin (so old
  // numbers stay exactly the same), else the session worked out spin by spin.
  const party = !!fsData && (stickyWilds > 0 || (climbSteps > 0 && !!fsData.climb));
  const session = party ? freeSpinSession(machineData, reelCount, { extra: extraFreeSpins, sticky: stickyWilds, steps: fsData!.climb ? climbSteps : 0, fullLineMultiplier, lines, bothWays, wheelBonus }) : null;
  const loopStats = fsData ? freeSpinStats(machineData, reelCount, extraFreeSpins) : null; // the retrigger loop (free spins have no Zoomies)
  const plainLoop = loopStats ? loopStats.q * loopStats.perTrigger : 0;
  const plainTail = plainLoop < 1 ? 1 / (1 - plainLoop) : Infinity;

  let lineEv = 0;
  let hitRate = 0;
  let zoomEv = 0;
  let fsChance = 0;
  let fsAwards = 0; // free spins first awarded, per paid spin
  let fsSpins = 0; // free spins played, per paid spin
  let freeEv = 0;
  const jp = { q: 0, ev: 0, pots: [] as { id: string; chance: number }[] };
  const hold = { q: 0, ev: 0, full: 0, respins: 0, coins: 0 };
  for (const c of cases) {
    if (!(c.p > 0)) continue;
    const r = c.reels.length ? zoomLines(machineData, reelCount, c.reels, fullLineMultiplier, lines, bothWays) : lines0;
    const caseLineEv = c.reels.length ? r.ev + r.fullEv * (average - 1) : plainLineEv;
    lineEv += c.p * caseLineEv;
    hitRate += c.p * r.hitRate;
    if (c.reels.length) zoomEv += c.p * (caseLineEv - plainLineEv);
    const cells = (reelCount - c.reels.length) * rows; // a zoomed reel holds no scatters
    if (fsData) {
      const dist = scatterDistribution(symbolChance(machineData, fsData.symbol), cells);
      dist.forEach((p, count) => {
        const award = freeSpinAward(fsData, count, extraFreeSpins);
        if (!(award > 0)) return;
        fsChance += c.p * p;
        fsAwards += c.p * p * award;
        if (session) {
          const v = session(award);
          freeEv += c.p * p * v.value;
          fsSpins += c.p * p * v.spins;
        }
      });
    }
    if (machineData.jackpot) {
      const j = jackpotStats(machineData, reelCount, jackpotGrowth, potSeedMultiplier, cells);
      jp.q += c.p * j.q;
      jp.ev += c.p * j.ev;
      j.pots.forEach((pot, i) => {
        if (!jp.pots[i]) jp.pots[i] = { id: pot.id, chance: 0 };
        jp.pots[i].chance += c.p * pot.chance;
      });
    }
    if (hs) {
      const h = holdSpinStats(machineData, reelCount, extraRespins, cells);
      hold.q += c.p * h.q;
      hold.ev += c.p * h.ev;
      hold.full += c.p * h.full;
      hold.respins += c.p * h.q * h.respins; // per trigger, below
      hold.coins += c.p * h.q * h.coins;
    }
  }
  if (hold.q > 0) { hold.respins /= hold.q; hold.coins /= hold.q; }
  if (fsData && !session) {
    fsSpins = fsAwards * plainTail;
    freeEv = fsSpins * plainLineEv * fsData.multiplier;
  }
  if (cases.length === 1) {
    // No Zoomies: worked out exactly as before 1.10.0, so the old numbers don't move
    // by even the last digit (the golden run depends on them).
    lineEv = plainLineEv;
    hitRate = lines0.hitRate;
    if (loopStats) {
      fsChance = loopStats.q;
      fsAwards = loopStats.q * loopStats.perTrigger;
      if (!session) {
        fsSpins = loopStats.q * loopStats.total;
        freeEv = fsSpins * plainLineEv * fsData!.multiplier;
      }
    }
    if (hs) Object.assign(hold, holdSpinStats(machineData, reelCount, extraRespins));
  }
  let perTrigger = fsChance > 0 ? fsAwards / fsChance : 0;
  let perTriggerWithRetriggers = fsChance > 0 ? fsSpins / fsChance : 0;
  if (cases.length === 1 && loopStats) {
    perTrigger = loopStats.perTrigger;
    if (!session) perTriggerWithRetriggers = loopStats.total;
  }

  let streakSum = 0;
  for (let k = 1; k <= streakCap; k++) streakSum += Math.pow(hitRate, k);
  const streakFactor = 1 + streakPerStack * streakSum;

  const extraSeconds = (fsData ? fsSpins * (spinDuration + fsData.pause) : 0)
    + (machineData.jackpot ? jp.q * machineData.jackpot.duration : 0)
    + (hs ? hold.q * (hold.respins * hs.respinSeconds + 2 * hs.pause) : 0);

  return {
    ev: lineEv * streakFactor * (1 + doubleChance) + freeEv + jp.ev + hold.ev,
    lineEv, hitRate, streakFactor,
    freeSpins: { chance: fsChance, perTrigger, perTriggerWithRetriggers, perSpin: fsSpins, ev: freeEv },
    jackpot: { chance: jp.q, ev: jp.ev, pots: jp.pots },
    hold: { chance: hold.q, ev: hold.ev, full: hold.full, respins: hold.respins, coins: hold.coins },
    wheel: { average, ev: lines0.fullEv * (average - 1) },
    zoom: { chance: z, ev: zoomEv },
    extraSeconds,
  };
}
