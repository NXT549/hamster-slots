// m9.test.js — M9, More machines: the Hamster Maze (243 ways), the Acorn Vault
// (hold & spin) and the Big Cheese (the multiplier wheel). Every new feature's
// average is exact (machine.ts), so each one is checked against brute force or
// a big sample, and against the game itself.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  createRng, rollGrid, evaluateGrid, allPaylines, symbolRules, findSymbol, scatterDistribution, expectedValue, spinExpectation,
  createGame, data, near, deepEqual, num, newGame, land, soldOn, unlockLevels, withUnlocks, wildWeights, withWild, SAVE_VERSION,
} from './helpers.js';
import { evaluateWays, holdSpinStats, wheelAverage } from '../../src/logic/machine.ts';

const maze = data.machines.find((m) => m.id === 'maze');
const vault = data.machines.find((m) => m.id === 'vault');
const cheese = data.machines.find((m) => m.id === 'cheese');
const ids = (m) => m.symbols.map((s) => s.id);

// A game running a machine, with every upgrade it sells bought (debug coins).
function onMachine(id, seed = 1, { maxed = true } = {}) {
  const g = newGame(seed);
  g.addCoins('1e18');
  g.buyMachine(id);
  if (maxed) for (const u of g.getAvailableUpgrades().filter((x) => x.scope === 'machine')) g.buyUpgrade(u.id, Infinity);
  return g;
}

// ─────────────────────────────────────────────────────────────
describe('ways: scoring a grid', () => {
  const rules = symbolRules(maze);
  // reel 1: 1 carrot · reel 2: 2 carrots · reel 3: a carrot and a wild · reel 4: none
  const grid = [['carrot', 'seed', 'blank'], ['carrot', 'carrot', 'corn'], ['wild', 'blank', 'carrot'], ['seed', 'corn', 'blank'], ['carrot', 'carrot', 'carrot']];
  const { wins, basePayout } = evaluateWays(grid, maze.payouts, rules, ids(maze));
  const carrot = wins.find((w) => w.symbolId === 'carrot');
  check('3 reels of carrots: 1 × 2 × 2 = 4 ways, each paying the 3-reel prize (the carrots on reel 5 don\'t count: reel 4 broke the run)',
    carrot && carrot.count === 3 && carrot.ways === 4 && carrot.basePayout === 4 * maze.payouts.carrot['3'] && carrot.usedWild && carrot.cells.length === 5);
  check('the seed on reel 1 wins nothing (not on reels 2 and 3)', !wins.some((w) => w.symbolId === 'seed'));
  check('the grid pays the sum of its wins', basePayout === wins.reduce((sum, w) => sum + w.basePayout, 0));
  const full = [['golden', 'seed', 'seed'], ['golden', 'wild', 'seed'], ['golden', 'seed', 'seed'], ['wild', 'seed', 'seed'], ['golden', 'golden', 'seed']];
  const r = evaluateWays(full, maze.payouts, rules, ids(maze));
  const golden = r.wins.find((w) => w.symbolId === 'golden');
  const seed = r.wins.find((w) => w.symbolId === 'seed');
  check('five reels of Golden Seeds (wilds too): 1 × 2 × 1 × 1 × 2 = 4 ways, a full line', golden && golden.count === 5 && golden.ways === 4 && golden.fullLine);
  check('…and seeds everywhere: 2 × 2 × 2 × 3 × 1 = 24 ways at the same time', seed && seed.count === 5 && seed.ways === 24);
  // The wild never lands on reel 1 of a ways machine.
  const rng = createRng(9);
  const md = withWild(maze, 50);
  let wildOnFirst = 0;
  let wildLater = 0;
  for (let i = 0; i < 3000; i++) {
    const g = rollGrid(md, 5, rng);
    wildOnFirst += g[0].filter((x) => x === 'wild').length;
    wildLater += g.slice(1).flat().filter((x) => x === 'wild').length;
  }
  check('rollGrid: the wild never lands on reel 1 of a ways machine (and does on the others)', wildOnFirst === 0 && wildLater > 1000);
});

describe('ways: the exact EV and hit rate', () => {
  // 1) A small ways machine, every grid tried (2 rows × 3 and 4 reels).
  const small = {
    id: 't', ways: true, rows: 2, startReels: 3, maxReels: 4, spinCost: 1,
    symbols: [
      { id: 'a', weight: 5 }, { id: 'b', weight: 3 }, { id: 'c', weight: 2 },
      { id: 'wild', weight: 1.5, wild: true }, { id: 'blank', weight: 4, blank: true }, { id: 'sc', weight: 0.7, scatter: true },
    ],
    payouts: { a: { 2: 1, 3: 2, 4: 5 }, b: { 3: 4, 4: 9 }, c: { 3: 10, 4: 30 } },
  };
  const rules = symbolRules(small);
  const total = small.symbols.reduce((sum, s) => sum + s.weight, 0);
  for (const R of [3, 4]) {
    let ev = 0;
    let hit = 0;
    let full = 0;
    const cells = R * small.rows;
    const idx = new Array(cells).fill(0);
    const n = small.symbols.length;
    for (let iter = 0; iter < n ** cells; iter++) {
      let p = 1;
      const grid = [];
      for (let reel = 0; reel < R; reel++) {
        const col = [];
        for (let row = 0; row < small.rows; row++) {
          const s = small.symbols[idx[reel * small.rows + row]];
          p *= reel === 0 ? (s.wild ? 0 : s.weight / (total - 1.5)) : s.weight / total;
          col.push(s.id);
        }
        grid.push(col);
      }
      if (p > 0) {
        const { wins, basePayout } = evaluateWays(grid, small.payouts, rules, ids(small));
        ev += p * basePayout;
        if (basePayout > 0) hit += p;
        full += p * wins.filter((w) => w.fullLine).reduce((sum, w) => sum + w.basePayout, 0);
      }
      for (let k = 0; k < cells; k++) { idx[k]++; if (idx[k] < n) break; idx[k] = 0; }
    }
    const x = expectedValue(small, R, 1);
    check(`a small ways machine, ${R} reels, every grid tried: EV ${x.ev.toFixed(6)} = ${ev.toFixed(6)}, hit rate ${x.hitRate.toFixed(6)} = ${hit.toFixed(6)}, full part ${x.fullEv.toFixed(6)} = ${full.toFixed(6)}`,
      near(x.ev, ev, 1e-9) && near(x.hitRate, hit, 1e-9) && near(x.fullEv, full, 1e-9));
  }
  // 2) The real Maze, sampled with the game's own grids.
  for (const wild of wildWeights(maze)) for (const unlocked of [0, unlockLevels(maze).at(-1)]) {
    const md = withUnlocks(withWild(maze, wild), unlocked);
    for (let reels = maze.startReels; reels <= maze.maxReels; reels++) {
      const rng = createRng(77 + reels * 10 + (wild || 0) * 100 + unlocked);
      const N = 40000;
      let sum = 0;
      let sumSq = 0;
      let hits = 0;
      for (let i = 0; i < N; i++) {
        const pay = evaluateWays(rollGrid(md, reels, rng), md.payouts, symbolRules(md), ids(md)).basePayout;
        sum += pay;
        sumSq += pay * pay;
        if (pay > 0) hits++;
      }
      const { ev, hitRate } = expectedValue(md, reels);
      const avg = sum / N;
      const stderr = Math.sqrt(Math.max(0, sumSq / N - avg * avg) / N);
      const label = `the Hamster Maze, ${reels} reels, wild weight ${wild}, ${unlocked ? 'every symbol unlocked' : 'nothing unlocked'}`;
      check(`${label}: sampled hit rate ${(hits / N * 100).toFixed(2)}% ~ exact ${(hitRate * 100).toFixed(2)}%`, near(hits / N, hitRate, 0.01));
      check(`${label}: sampled EV ${avg.toFixed(0)} ~ exact ${ev.toFixed(0)} (±${Math.max(ev * 0.05, 5 * stderr).toFixed(0)})`, near(avg, ev, Math.max(ev * 0.05, 5 * stderr)));
    }
  }
});

describe('ways: the Hamster Maze in the game', () => {
  const g = onMachine('maze', 21, { maxed: false });
  check('it starts with 3 reels: 27 ways; Longer Maze adds reels (81, then 243)', g.getReelCount() === 3 && g.getWays() === 27 && g.getMachineInfo('maze').features.ways === 27);
  g.buyUpgrade('longerMaze', Infinity);
  check('…243 ways with every reel', g.getReelCount() === 5 && g.getWays() === 243);
  check('no paylines and no Pays Both Ways for sale', !soldOn(maze, 'bothWays').length && g.getLineCount() === 1);
  // Spins pay exactly what evaluateWays says, × the payout multiplier and the bet.
  let ok = true;
  let wins = 0;
  g.on('spinResolved', (e) => {
    const expected = evaluateWays(e.result, maze.payouts, symbolRules(maze), ids(maze));
    if (expected.wins.length !== e.wins.length) ok = false;
    // (No Hot Streak, Jackpot Dance or stars in this game: a win pays its base × the payout multiplier × the bet.)
    e.wins.forEach((w, i) => {
      const pays = expected.wins[i].basePayout * num(g.getPayoutMultiplier()) * e.bet;
      if (w.ways !== expected.wins[i].ways || !deepEqual(w.cells, expected.wins[i].cells) || !near(num(w.payout), pays, Math.max(0.01, 1e-9 * pays))) ok = false;
    });
    if (e.payout.gt(0)) wins++;
  });
  for (let i = 0; i < 60; i++) {
    g.spin('manual');
    land(g);
    if (g.state.gamble) g.collectGamble();
  }
  check('60 spins: every win is a ways win, with its ways and cells', ok && wins > 0);
  check('the most ways won is a lifetime stat', g.state.stats.bestWays > 0);
});

// ─────────────────────────────────────────────────────────────
describe('hold & spin: the exact average', () => {
  // Every bonus played out by the rules, many times, vs holdSpinStats.
  const hs = vault.holdSpin;
  const N = 15;
  for (const extra of [0, 2]) {
    const stats = holdSpinStats(vault, 5, extra);
    const rng = createRng(31 + extra);
    const p = vault.symbols.find((s) => s.id === hs.symbol).weight / vault.symbols.reduce((a, s) => a + s.weight, 0);
    const R0 = hs.respins + extra;
    const T = 400000;
    let trig = 0;
    let coins = 0;
    let full = 0;
    let respins = 0;
    for (let t = 0; t < T; t++) {
      let k = 0;
      for (let i = 0; i < N; i++) if (rng.next() < p) k++;
      if (k < hs.trigger) continue;
      trig++;
      let n = k;
      let left = R0;
      while (left > 0 && n < N) {
        let j = 0;
        for (let i = 0; i < N - n; i++) if (rng.next() < hs.respinChance) j++;
        n += j;
        respins++;
        left = j ? R0 : left - 1;
      }
      coins += n;
      if (n === N) full++;
    }
    check(`${R0} respins: trigger chance ${(stats.q * 100).toFixed(3)}% ~ sampled ${(trig / T * 100).toFixed(3)}%`, near(stats.q, trig / T, 0.1 * stats.q));
    check(`${R0} respins: ${stats.coins.toFixed(2)} acorns at the end ~ sampled ${(coins / trig).toFixed(2)}`, near(stats.coins, coins / trig, 0.05 * stats.coins));
    check(`${R0} respins: ${stats.respins.toFixed(2)} respins a bonus ~ sampled ${(respins / trig).toFixed(2)}`, near(stats.respins, respins / trig, 0.05 * stats.respins));
  }
  // The trigger chance is the binomial tail: exact.
  const cells = 15;
  const p = vault.symbols.find((s) => s.id === hs.symbol).weight / vault.symbols.reduce((a, s) => a + s.weight, 0);
  const tail = scatterDistribution(p, cells).slice(hs.trigger).reduce((a, b) => a + b, 0);
  check('the trigger chance is the chance of 6+ acorns among 15 cells', near(holdSpinStats(vault, 5).q, tail, 1e-12));
  check('more respins: a bigger average bonus and a likelier Grand', holdSpinStats(vault, 5, 2).ev > holdSpinStats(vault, 5, 0).ev && holdSpinStats(vault, 5, 2).full > holdSpinStats(vault, 5, 0).full);
});

describe('hold & spin: the Acorn Vault in the game', () => {
  const g = onMachine('vault', 41);
  const respins = vault.holdSpin.respins + soldOn(vault, 'extraRespins').reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0);
  check('Sticky Paws maxed: more respins', g.getHoldRespins() === respins && respins > vault.holdSpin.respins);
  g.spin('manual');
  land(g);
  if (g.state.gamble) g.collectGamble();
  const events = [];
  g.on('holdStarted', (e) => events.push(['start', e]));
  g.on('holdEnded', (e) => events.push(['end', e]));
  const coinsBefore = g.state.coins;
  check('the debug trigger starts it with 6 acorns', g.triggerHold(6) && events[0][0] === 'start' && events[0][1].cells.length === 6 && events[0][1].respins === respins);
  const h = g.state.machines[g.state.activeMachine].hold;
  // Replay the rules on the saved outcome: respins reset on every new acorn and stop at 0 or a full grid.
  let left = h.respins;
  let filled = h.start.length;
  let rulesOk = h.start.every((i) => h.values[i] > 0);
  h.steps.forEach((step, i) => {
    if (left <= 0 || filled >= h.values.length) rulesOk = false;
    filled += step.length;
    left = step.length ? h.respins : left - 1;
    if (i === h.steps.length - 1 && !(left === 0 || filled === h.values.length)) rulesOk = false;
  });
  check('the whole bonus is decided at the start, by the rules (respins reset on a new acorn; it ends at 0 respins or a full grid)',
    rulesOk && filled === h.values.filter((v) => v > 0).length);
  check('every acorn holds one of the machine\'s coin values', h.values.every((v) => v === 0 || vault.holdSpin.values.some((x) => x.value === v)));
  check('it takes pause + respins + pause seconds', near(h.duration, 2 * vault.holdSpin.pause + h.steps.length * vault.holdSpin.respinSeconds, 1e-9));
  // While it plays: no spins, no retiring, no rebuilding.
  let blocked = null;
  g.on('spinBlocked', (e) => { blocked = e.reason; });
  check('while it plays, spins are blocked (reason "bonus")', !g.spin('manual') && blocked === 'bonus');
  check('…and the board says what it shows: the starting acorns, all the respins still to come', g.getHold().played === 0 && g.getHold().cells.filter((c) => c.gt(0)).length === 6);
  // A save made halfway loads halfway, and pays the same.
  g.update(h.duration / 2);
  const save = JSON.parse(JSON.stringify(g.toSaveData()));
  const copy = createGame(structuredClone(data), createRng(5));
  check('saved and loaded halfway, it carries on where it was', copy.loadSaveData(save) && deepEqual(copy.state.machines[copy.state.activeMachine].hold, g.state.machines[g.state.activeMachine].hold));
  const expected = (h.values.reduce((a, b) => a + b, 0) + (h.values.every((v) => v > 0) ? vault.holdSpin.grand : 0)) * num(g.getPayoutMultiplier()) * g.getStarMultiplier() * h.bet;
  g.update(h.duration);
  copy.update(h.duration);
  const end = events.find((e) => e[0] === 'end');
  check('when it\'s over it pays every acorn (+ the Grand when full) × the bet and the bonuses', end && near(num(end[1].amount), expected, 0.02) && g.state.machines[g.state.activeMachine].hold === null);
  check('…the loaded copy pays exactly the same', num(copy.state.coins.sub(g.state.coins)) === 0 || near(num(copy.state.coins), num(g.state.coins), 0.02));
  check('…and it counts as earned (Heirloom Seeds)', num(g.state.coins.sub(coinsBefore)) >= num(end[1].amount) - 0.02 && g.state.stats.holdBonuses >= 1);
  // A broken hold in a save is dropped, never loaded.
  const bad = JSON.parse(JSON.stringify(save));
  bad.machines.find((m) => m.typeId === 'vault').hold.values[0] = 12345;
  const loaded = createGame(structuredClone(data), createRng(6));
  check('a save with a broken hold & spin loads without it', loaded.loadSaveData(bad) && loaded.state.machines.find((m) => m.typeId === 'vault').hold === null);
  // Retiring and rebuilding wait for it.
  const r = onMachine('vault', 42);
  r.addCoins('1e12', true);
  r.spin('manual');
  land(r);
  if (r.state.gamble) r.collectGamble();
  r.triggerHold(8);
  check('you can\'t retire or rebuild while hold & spin plays', !r.canRetire() && !r.canRebuild('vault'));
});

// ─────────────────────────────────────────────────────────────
describe('the cheese wheel: the exact average', () => {
  check('the wheel\'s average: ×2 45, ×3 30, ×5 17, ×10 8 of 100', near(wheelAverage(cheese.wheel), (2 * 45 + 3 * 30 + 5 * 17 + 10 * 8) / 100, 1e-12));
  const bonus = soldOn(cheese, 'wheelBonus').reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0);
  check('Aged Cheese adds to every wedge', near(wheelAverage(cheese.wheel, bonus), wheelAverage(cheese.wheel) + bonus, 1e-12));
  // Sampled: roll grids, pay lines, and multiply every full line by its own wedge.
  const md = withUnlocks(cheese, unlockLevels(cheese).at(-1));
  const rng = createRng(55);
  const lines = allPaylines(md).slice(0, 20);
  const rules = symbolRules(md);
  const N = 60000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < N; i++) {
    const { wins } = evaluateGrid(rollGrid(md, 5, rng), lines, md.payouts, rules);
    let pay = 0;
    for (const w of wins) pay += w.basePayout * (w.fullLine ? rng.pickWeighted(md.wheel.wedges).multiplier : 1);
    sum += pay;
    sumSq += pay * pay;
  }
  const v = spinExpectation(md, 5, { lines: 20 });
  const avg = sum / N;
  const stderr = Math.sqrt(Math.max(0, sumSq / N - avg * avg) / N);
  check(`the Big Cheese, 20 lines: sampled ${avg.toFixed(0)} ~ exact ${v.lineEv.toFixed(0)} (lines + the wheel's extra, ±${(5 * stderr).toFixed(0)})`, near(avg, v.lineEv, Math.max(5 * stderr, 0.03 * v.lineEv)));
  const plain = expectedValue(md, 5, 1, 20);
  check('the wheel adds (what full lines pay) × (the average − 1)', near(v.wheel.ev, plain.fullEv * (wheelAverage(md.wheel) - 1), 1e-9) && near(v.lineEv, plain.ev + v.wheel.ev, 1e-9));
});

describe('the cheese wheel in the game', () => {
  const g = onMachine('cheese', 61);
  let seen = null;
  g.on('spinResolved', (e) => { if (!seen && e.wins.some((w) => w.wheel)) seen = { e, mult: num(g.getPayoutMultiplier()) * g.getStarMultiplier() }; });
  for (let i = 0; i < 4000 && !seen; i++) {
    g.spin('auto');
    land(g);
    if (g.state.gamble) g.collectGamble();
  }
  check('a line of five spins the wheel (found one in a few thousand spins)', !!seen);
  if (seen) {
    const bonus = g.getWheelBonus();
    const wedgeOk = seen.e.wins.filter((w) => w.wheel).every((w) => w.fullLine && cheese.wheel.wedges.some((x) => x.multiplier + bonus === w.wheel));
    check('only full lines land a wedge, and it\'s one of the wheel\'s (+ Aged Cheese)', wedgeOk && seen.e.wins.filter((w) => !w.fullLine).every((w) => !w.wheel));
    const w = seen.e.wins.find((x) => x.wheel);
    // (No Hot Streak or Jackpot Dance in this game: the line pays base × the multipliers × the bet × its wedge.)
    const pays = w.basePayout * seen.mult * seen.e.bet * w.wheel;
    check('that line pays × its wedge', near(num(w.payout), pays, Math.max(0.01, pays * 1e-9)));
    check('the win tier counts the wedge', seen.e.tier === g.getWinTier(seen.e.wins.reduce((sum, x) => sum + x.basePayout * (x.wheel || 1), 0), cheese));
    check('the best wedge is a lifetime stat', g.state.stats.bestWheel >= w.wheel);
  }
});

// ─────────────────────────────────────────────────────────────
describe('M9 in the game: the machines, stickers and save v10', () => {
  const order = data.machines.map((m) => m.id);
  check('the three new machines come after the Pouch Palace, each dearer than the last',
    deepEqual(order.slice(-3), ['maze', 'vault', 'cheese']) && data.machines.every((m, i) => i === 0 || m.unlockCost > data.machines[i - 1].unlockCost));
  const g = newGame(71);
  g.addCoins('1e18');
  for (const m of data.machines.slice(1)) g.buyMachine(m.id);
  check('Whole Arcade: own all seven machines at once', g.state.diary.wholeArcade === true && g.state.diary.fullCage === true);
  check(`the save version is 10 (${SAVE_VERSION})`, SAVE_VERSION === 10);
  const v9 = JSON.parse(JSON.stringify(g.toSaveData()));
  v9.saveVersion = 9;
  for (const m of v9.machines) delete m.hold;
  for (const k of ['bestWays', 'holdBonuses', 'holdGrands', 'bestWheel']) delete v9.stats[k];
  const loaded = createGame(structuredClone(data), createRng(3));
  check('a v9 save loads: no hold & spin going, the new stats at 0', loaded.loadSaveData(v9) && loaded.state.machines.every((m) => m.hold === null)
    && ['bestWays', 'holdBonuses', 'holdGrands', 'bestWheel'].every((k) => loaded.state.stats[k] === 0));
});
