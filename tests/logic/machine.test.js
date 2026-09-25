// machine.test.js — the pure slot-machine rules and their exact maths (machine.ts).
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('win rule: count matches from the left', () => {
  const p = clunky.payouts;
  const rules = symbolRules(clunky);
  check(`2 reels, seed seed -> ${p.seed['2']}`, evaluate(['seed', 'seed'], p, rules).basePayout === p.seed['2']);
  check('2 reels, seed carrot -> 0', evaluate(['seed', 'carrot'], p, rules).basePayout === 0);
  check(`3 reels, carrot x3 -> ${p.carrot['3']} (not + the pair as well)`, evaluate(['carrot', 'carrot', 'carrot'], p, rules).basePayout === p.carrot['3']);
  check(`3 reels, carrot carrot seed -> ${p.carrot['2']}`, evaluate(['carrot', 'carrot', 'seed'], p, rules).basePayout === p.carrot['2']);
  check('3 reels, seed carrot carrot -> 0 (must start at reel 1)', evaluate(['seed', 'carrot', 'carrot'], p, rules).basePayout === 0);
  check('1 reel never pays', evaluate(['golden'], p, rules).basePayout === 0);
  // The blank (Wood Shaving): never pays, and ends a run.
  check('two Wood Shavings are not a win', evaluate(['blank', 'blank'], p, rules).basePayout === 0 && evaluate(['blank', 'blank', 'blank'], p, rules).basePayout === 0);
  check('a Wood Shaving ends a run: seed seed blank = a seed pair', evaluate(['seed', 'seed', 'blank'], p, rules).basePayout === p.seed['2']);
  check('a Wood Shaving first: no win', evaluate(['blank', 'seed', 'seed'], p, rules).basePayout === 0);
});

// ─────────────────────────────────────────────────────────────
describe('paylines: every line is read on its own, and the wins add up', () => {
  const p = stacker.payouts;
  const lines = allPaylines(stacker); // middle, top, bottom, diagonal down, diagonal up
  // grid[reel][row]:   reel 1           reel 2               reel 3
  const grid = [['seed', 'carrot', 'golden'], ['seed', 'carrot', 'seed'], ['golden', 'carrot', 'blueberry']];
  check('lineSymbols reads one row per reel', lineSymbols(grid, lines[3]).join() === 'seed,carrot,blueberry');
  const three = evaluateGrid(grid, lines.slice(0, 3), p);
  check('3 lines: middle carrot line + top seed pair', three.wins.length === 2
    && three.basePayout === p.carrot['3'] + p.seed['2'], JSON.stringify(three));
  check('a line where every reel matches is a full line', three.wins.find((w) => w.line === 0).fullLine === true
    && three.wins.find((w) => w.line === 1).fullLine === false);
  const five = evaluateGrid(grid, lines, p);
  check('5 lines: the diagonals add their own wins (seed-carrot-blueberry: none; golden-carrot-golden: none)',
    five.wins.length === 2 && five.basePayout === three.basePayout);
  const diag = [['seed', 'x', 'x'], ['x', 'seed', 'x'], ['x', 'x', 'seed']].map((c) => c.map((s) => (s === 'x' ? 'carrot' : s)));
  const d = evaluateGrid(diag, lines, p);
  check('the downward diagonal pays a seed line', d.wins.some((w) => w.line === 3 && w.symbolId === 'seed' && w.count === 3));
  check('a 1-row grid with one line works like the old rule',
    evaluateGrid([['carrot'], ['carrot'], ['seed']], allPaylines(clunky), clunky.payouts).basePayout === clunky.payouts.carrot['2']);
});

// ─────────────────────────────────────────────────────────────
describe('EV formula vs brute force (every possible line, wilds and scatters)', () => {
  // A made-up machine small enough to try EVERY line: 6 symbols on up to 5 reels
  // is 7,776 lines. The formula must match that exactly (not just roughly).
  // It has a wild, a scatter and a blank ("x"), so every special rule is covered.
  const toy = {
    symbols: [
      { id: 'a', weight: 40 }, { id: 'b', weight: 25 }, { id: 'c', weight: 15 },
      { id: 'w', weight: 12, wild: true }, { id: 's', weight: 8, scatter: true }, { id: 'x', weight: 30, blank: true },
    ],
    payouts: {
      a: { 2: 2, 3: 10, 4: 40, 5: 200 }, b: { 2: 5, 3: 30, 4: 150, 5: 900 }, c: { 2: 9, 3: 70, 4: 400, 5: 2500 },
      w: { 2: 7, 3: 100, 4: 300, 5: 5000 },
    },
  };
  const rules = symbolRules(toy);
  const total = toy.symbols.reduce((sum, s) => sum + s.weight, 0);
  for (let reels = 2; reels <= 5; reels++) {
    for (const fullMult of [1, 1.5]) {
      let ev = 0;
      let hit = 0;
      (function all(line, chance) {
        if (line.length === reels) {
          const r = evaluate(line, toy.payouts, rules);
          const pay = r.basePayout * (r.count === reels ? fullMult : 1);
          ev += chance * pay;
          if (pay > 0) hit += chance;
          return;
        }
        for (const s of toy.symbols) all([...line, s.id], chance * s.weight / total);
      })([], 1);
      const f = expectedValue(toy, reels, fullMult);
      check(`toy machine, ${reels} reels, full-line x${fullMult}: formula EV ${f.ev.toFixed(6)} = brute force ${ev.toFixed(6)}, hit rate too`,
        near(f.ev, ev, 1e-9) && near(f.hitRate, hit, 1e-12));
    }
  }

  // The fast multi-line hit rate (machine.ts gridHitRate) against every possible
  // grid of a 2-reel × 3-row toy machine: 6 symbols on 6 cells = 46,656 grids.
  // Only reels 1 and 2 decide a hit, so 2 reels are enough to test it.
  const toyGrid = { ...toy, rows: 3, maxReels: 2, paylines: [[1, 1], [0, 0], [2, 2], [0, 1], [2, 1], [1, 0], [0, 2]] };
  const cells = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]];
  for (const lineCount of [2, 4, 7]) {
    const lines = toyGrid.paylines.slice(0, lineCount);
    let hit = 0;
    let ev = 0;
    const grid = [[null, null, null], [null, null, null]];
    (function fill(i, chance) {
      if (i === cells.length) {
        const pay = evaluateGrid(grid, lines, toy.payouts, rules).basePayout;
        ev += chance * pay;
        if (pay > 0) hit += chance;
        return;
      }
      for (const s of toy.symbols) {
        grid[cells[i][0]][cells[i][1]] = s.id;
        fill(i + 1, chance * s.weight / total);
      }
    })(0, 1);
    const f = expectedValue(toyGrid, 2, 1, lineCount);
    check(`toy grid, ${lineCount} lines: hit rate ${(f.hitRate * 100).toFixed(4)}% = every grid tried ${(hit * 100).toFixed(4)}%, EV too`,
      near(f.hitRate, hit, 1e-12) && near(f.ev, ev, 1e-9));
  }
});

// ─────────────────────────────────────────────────────────────
describe('EV formula vs every line, and vs real spins (same RNG as the game)', () => {
  // Two checks per setup of every real machine:
  //  1) EXACT: try every possible single line (at most 8 symbols on 5 reels =
  //     32,768 lines). Its average must equal the formula's one-line EV.
  //  2) SAMPLED: real grids from the game's RNG. A sampled average is only as
  //     precise as its "standard error" (the spread ÷ √N). Machines with huge, rare
  //     wins (a line of Golden Seeds!) have a big spread, and a sample that missed
  //     them underestimates its own spread, so the allowed error comes from the
  //     EXACT spread of one line (from check 1): L lines can spread at most L times
  //     as much as one. The check allows 4 of those standard errors (or 3%).
  // Each setup is checked with no symbols unlocked yet and with every symbol open.
  function lineMoments(md, reels) {
    const rules = symbolRules(md);
    const total = md.symbols.reduce((sum, s) => sum + s.weight, 0);
    const symbols = md.symbols.filter((s) => s.weight > 0);
    let m1 = 0;
    let m2 = 0;
    (function all(line, chance) {
      if (line.length === reels) {
        const pay = evaluate(line, md.payouts, rules).basePayout;
        m1 += chance * pay;
        m2 += chance * pay * pay;
        return;
      }
      for (const s of symbols) all([...line, s.id], (chance * s.weight) / total);
    })([], 1);
    return { mean: m1, sd: Math.sqrt(Math.max(0, m2 - m1 * m1)) };
  }
  for (const m of data.machines) {
    for (const wildWeight of wildWeights(m)) for (const unlocked of [0, unlockLevels(m).at(-1)]) {
      const md = withUnlocks(withWild(m, wildWeight), unlocked);
      const rules = symbolRules(md);
      for (let reels = m.startReels; reels <= m.maxReels; reels++) {
        const exact = lineMoments(md, reels);
        const one = expectedValue(md, reels, 1, 1).ev;
        check(`${m.name}, ${reels} reels${wildWeight ? `, wild weight ${wildWeight}` : ''}, ${unlocked ? 'every symbol unlocked' : 'nothing unlocked'}: one-line EV formula ${one.toFixed(4)} = every line tried ${exact.mean.toFixed(4)}`,
          near(one, exact.mean, 1e-9 * Math.max(1, one)));
        for (const lines of reachableLines(m)) {
          const rng = createRng(42 + reels * 10 + lines + (wildWeight || 0) * 1000 + unlocked * 7);
          const N = m === clunky ? 200000 : 40000;
          const active = allPaylines(md).slice(0, lines);
          let sum = 0;
          let sumSq = 0;
          let hits = 0;
          for (let i = 0; i < N; i++) {
            const pay = evaluateGrid(rollGrid(md, reels, rng), active, md.payouts, rules).basePayout;
            sum += pay;
            sumSq += pay * pay;
            if (pay > 0) hits++;
          }
          const { ev, hitRate } = expectedValue(md, reels, 1, lines);
          const avg = sum / N;
          const stderr = Math.max(Math.sqrt(Math.max(0, sumSq / N - avg * avg) / N), (lines * exact.sd) / Math.sqrt(N));
          const label = `${m.name}, ${reels} reels, ${lines} line${lines === 1 ? '' : 's'}${wildWeight ? `, wild weight ${wildWeight}` : ''}, ${unlocked ? 'every symbol unlocked' : 'nothing unlocked'}`;
          check(`${label}: sampled EV ${avg.toFixed(2)} ~ formula ${ev.toFixed(2)} (±${Math.max(ev * 0.03, 4 * stderr).toFixed(2)})`,
            near(avg, ev, Math.max(ev * 0.03, 4 * stderr)));
          check(`${label}: sampled hit rate ${(hits / N * 100).toFixed(2)}% ~ formula ${(hitRate * 100).toFixed(2)}%`,
            near(hits / N, hitRate, 0.01));
        }
      }
    }
  }
  {
    // Scatters: how often free spins / the jackpot wheel start, and the average award.
    for (const m of data.machines.filter((x) => x.freeSpins || x.jackpot)) {
      const rng = createRng(4242);
      const N = 200000;
      const fs = m.freeSpins;
      const jp = m.jackpot;
      let fsTriggers = 0;
      let fsSpins = 0;
      let jpTriggers = 0;
      for (let i = 0; i < N; i++) {
        const grid = rollGrid(m, m.maxReels, rng);
        if (fs) {
          const award = freeSpinAward(fs, findSymbol(grid, fs.symbol).length);
          if (award > 0) { fsTriggers++; fsSpins += award; }
        }
        if (jp && findSymbol(grid, jp.symbol).length >= jp.min) jpTriggers++;
      }
      const tol = (q) => 4 * Math.sqrt((q * (1 - q)) / N);
      if (fs) {
        const f = freeSpinStats(m, m.maxReels);
        check(`${m.name}: free spins start on ${(fsTriggers / N * 100).toFixed(3)}% of spins ~ formula ${(f.q * 100).toFixed(3)}%`,
          near(fsTriggers / N, f.q, tol(f.q)));
        check(`${m.name}: ${(fsSpins / fsTriggers).toFixed(2)} free spins per trigger ~ formula ${f.perTrigger.toFixed(2)}`,
          near(fsSpins / fsTriggers, f.perTrigger, 0.3));
      }
      if (jp) {
        const j = jackpotStats(m, m.maxReels);
        check(`${m.name}: the jackpot wheel starts on ${(jpTriggers / N * 100).toFixed(3)}% of spins ~ formula ${(j.q * 100).toFixed(3)}%`,
          near(jpTriggers / N, j.q, tol(j.q)));
      }
    }
    const d = scatterDistribution(0.1, 15);
    check('scatterDistribution: the chances add up to 1', near(d.reduce((a, b) => a + b, 0), 1, 1e-12));
    const fs = bonanza.freeSpins;
    check('freeSpinAward: 2 balls give nothing, 3 give the "3" award, 7 count as "5", extra spins add on',
      freeSpinAward(fs, 2) === 0 && freeSpinAward(fs, 3) === fs.awards['3'] && freeSpinAward(fs, 7) === fs.awards['5']
      && freeSpinAward(fs, 3, 4) === fs.awards['3'] + 4 && freeSpinAward(fs, 1, 4) === 0);
  }
});

// ─────────────────────────────────────────────────────────────
describe('wilds and scatters on a line', () => {
  const p = bonanza.payouts;
  const rules = symbolRules(bonanza);
  const ev = (line) => evaluate(line, p, rules);
  const a = ev(['wild', 'carrot', 'wild', 'seed', 'seed']);
  check('wild, carrot, wild, seed … = 3 Baby Carrots (wilds before and after count)', a.symbolId === 'carrot' && a.count === 3 && a.basePayout === p.carrot['3'] && a.usedWild);
  const b = ev(['wild', 'wild', 'wild', 'seed', 'seed']);
  check('3 wilds then 2 seeds pays the better reading: 3 wilds (not 5 seeds)', b.symbolId === 'wild' && b.count === 3 && b.basePayout === Math.max(p.wild['3'], p.seed['5']));
  const c = ev(['wild', 'wild', 'golden', 'golden', 'wild']);
  check('wild, wild, golden, golden, wild = a full line of 5 Golden Seeds', c.symbolId === 'golden' && c.count === 5 && c.basePayout === p.golden['5']);
  check('5 wilds pay the wild\'s own top prize', ev(Array(5).fill('wild')).basePayout === p.wild['5']);
  check('a scatter first: no line win', ev(['ball', 'seed', 'seed', 'seed', 'seed']).basePayout === 0);
  check('one wild then a scatter: no line win', ev(['wild', 'ball', 'seed', 'seed', 'seed']).basePayout === 0);
  check('two wilds then a scatter: the 2 wilds pay', ev(['wild', 'wild', 'ball', 'seed', 'seed']).basePayout === p.wild['2']);
  check('a scatter ends a run: seed, wild, ball … = 2 seeds', ev(['seed', 'wild', 'ball', 'seed', 'seed']).basePayout === p.seed['2']);
  check('a Wood Shaving ends a run too: seed, wild, blank … = 2 seeds', ev(['seed', 'wild', 'blank', 'seed', 'seed']).basePayout === p.seed['2']);
  check('a wild never stands in for a Wood Shaving: wild, blank … = no win', ev(['wild', 'blank', 'blank', 'seed', 'seed']).basePayout === 0);
  check('two wilds then a Wood Shaving: the 2 wilds pay', ev(['wild', 'wild', 'blank', 'seed', 'seed']).basePayout === p.wild['2']);
  check('without a wild on the machine, the old rule is unchanged', evaluate(['seed', 'seed', 'seed'], clunky.payouts).basePayout === clunky.payouts.seed['3']);
  const grid = [['ball', 'wild', 'seed'], ['seed', 'wild', 'ball'], ['corn', 'wild', 'seed'], ['ball', 'apple', 'seed'], ['seed', 'seed', 'seed']];
  const w = evaluateGrid(grid, allPaylines(bonanza).slice(0, 3), p, rules);
  check('evaluateGrid: middle line = 3 wilds (it beats 4 apples? no: wild 3 vs apple 4 → the better one)',
    w.wins.find((x) => x.line === 0).basePayout === Math.max(p.wild['3'], p.apple['4']));
  check('findSymbol finds every scatter on the grid', JSON.stringify(findSymbol(grid, 'ball')) === JSON.stringify([[0, 0], [1, 2], [3, 0]]));
});
