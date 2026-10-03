// burrowparty.test.js — 1.10.0 "Burrow Party": Zoomies (whole reels turn wild on a
// paid spin), and the Burrow Bonanza's Sticky Wilds and Party Climb (free spins).
// The maths must stay exact (rule 4): small toy machines are checked against every
// possible grid, and the real game against long runs.

import { describe, test, expect } from 'vitest';
import { data, gameOn, createGame, createRng, evaluateGrid, symbolRules, spinExpectation, freeSpinStats } from './helpers.js';
import { zoomCases, canZoom, stickyChances, freeSpinSession } from '../../src/logic/machine.ts';

const ZOOM = data.zoomies;

// The game's data with every spin and bonus nearly instant, so long runs are quick
// (only timing changes: what lands, and what it pays, are the same).
function fast(d) {
  for (const m of d.machines) {
    m.spinDuration = 0.05;
    if (m.freeSpins) m.freeSpins.pause = 0.02;
    if (m.jackpot) m.jackpot.duration = 0.05;
    if (m.holdSpin) { m.holdSpin.respinSeconds = 0.02; m.holdSpin.pause = 0.02; }
  }
  return d;
}
// Play until nothing is left to play on the machine (free spins, a wheel, hold & spin).
function playOut(g) {
  g.update(0.1);
  for (let i = 0; i < 100000 && (g.getFreeSpins() || g.state.machines.some((m) => m.spinning || m.bonus || m.hold)); i++) g.update(0.1);
}

// Every grid of a toy machine (reels × rows cells over its symbols), with its chance,
// for the zoomed reels all wild. Small enough to try every one.
function everyGrid(md, reels, zoomed, visit) {
  const rows = md.rows || 1;
  const total = md.symbols.reduce((s, x) => s + x.weight, 0);
  const syms = md.symbols.filter((s) => s.weight > 0).map((s) => ({ id: s.id, p: s.weight / total }));
  const wild = symbolRules(md).wild;
  const free = [];
  for (let r = 0; r < reels; r++) if (!zoomed.includes(r)) for (let row = 0; row < rows; row++) free.push([r, row]);
  const grid = Array.from({ length: reels }, (_, r) => Array.from({ length: rows }, () => (zoomed.includes(r) ? wild : null)));
  (function fill(i, chance) {
    if (i === free.length) { visit(grid.map((c) => [...c]), chance); return; }
    const [r, row] = free[i];
    for (const s of syms) { grid[r][row] = s.id; fill(i + 1, chance * s.p); }
  })(0, 1);
}

// A toy: 4 reels × 2 rows, three lines, a wild, a blank and a scatter.
const toy = {
  id: 'toy', name: 'Toy', description: '', unlockCost: 0, startReels: 4, maxReels: 4, rows: 2, spinCost: 10, spinDuration: 1,
  paylines: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 1, 1, 0]], startLines: 3,
  symbols: [
    { id: 'a', name: 'A', weight: 5 }, { id: 'b', name: 'B', weight: 3 }, { id: 'w', name: 'Wild', weight: 2, wild: true },
    { id: 'ball', name: 'Ball', weight: 2, scatter: true }, { id: 'x', name: 'Blank', weight: 4, blank: true },
  ],
  payouts: { a: { 2: 2, 3: 5, 4: 20 }, b: { 2: 4, 3: 15, 4: 60 }, w: { 2: 8, 3: 40, 4: 300 } },
  freeSpins: { symbol: 'ball', awards: { 3: 5, 5: 10 }, multiplier: 2, pause: 1 },
};
const toyZoom = { minReels: 4, reels: [{ count: 1, weight: 3 }, { count: 2, weight: 1 }] };

describe('Zoomies: the maths (machine.ts)', () => {
  test('the cases add up to 1, and each count gets its share of the weight', () => {
    for (const R of [4, 5]) {
      const cases = zoomCases(R, ZOOM);
      expect(cases.reduce((s, c) => s + c.p, 0)).toBeCloseTo(1, 12);
      const total = ZOOM.reels.reduce((s, o) => s + o.weight, 0);
      for (const o of ZOOM.reels) expect(cases.filter((c) => c.reels.length === o.count).reduce((s, c) => s + c.p, 0)).toBeCloseTo(o.weight / total, 12);
    }
  });

  test('only payline machines with a wild and 5 reels can zoom', () => {
    const can = data.machines.filter((m) => canZoom(m, m.maxReels, ZOOM)).map((m) => m.id);
    expect(can).toEqual(['bonanza', 'palace', 'vault', 'moving', 'cheese']);
    expect(canZoom(data.machines.find((m) => m.id === 'stacker'), 4, ZOOM)).toBe(false);
  });

  // The line EV, the hit rate and the free-spin trigger, against every grid.
  for (const bothWays of [false, true]) {
    test(`every grid of a toy machine agrees with the exact numbers${bothWays ? ' (pays both ways)' : ''}`, () => {
      const exact = spinExpectation(toy, 4, { lines: 3, bothWays, zoomChance: 1, zoomies: toyZoom });
      let ev = 0;
      let hit = 0;
      let trigger = 0;
      for (const c of zoomCases(4, toyZoom)) {
        everyGrid(toy, 4, c.reels, (grid, chance) => {
          const r = evaluateGrid(grid, toy.paylines, toy.payouts, symbolRules(toy), bothWays);
          ev += c.p * chance * r.basePayout;
          if (r.wins.length) hit += c.p * chance;
          if (grid.flat().filter((id) => id === 'ball').length >= 3) trigger += c.p * chance;
        });
      }
      expect(exact.lineEv).toBeCloseTo(ev, 9);
      expect(exact.hitRate).toBeCloseTo(hit, 12);
      expect(exact.freeSpins.chance).toBeCloseTo(trigger, 12);
      expect(exact.zoom.chance).toBe(1);
    });
  }

  test('a share of spins with Zoomies is the mix of the two', () => {
    const none = spinExpectation(toy, 4, { lines: 3 });
    const all = spinExpectation(toy, 4, { lines: 3, zoomChance: 1, zoomies: toyZoom });
    const some = spinExpectation(toy, 4, { lines: 3, zoomChance: 0.1, zoomies: toyZoom });
    expect(some.lineEv).toBeCloseTo(0.9 * none.lineEv + 0.1 * all.lineEv, 9);
    expect(some.hitRate).toBeCloseTo(0.9 * none.hitRate + 0.1 * all.hitRate, 12);
    expect(some.zoom.ev).toBeCloseTo(0.1 * (all.lineEv - none.lineEv), 9);
  });

  test('without Zoomies every number is exactly what it was', () => {
    for (const m of data.machines) {
      const R = m.maxReels;
      const opts = { lines: m.paylines ? m.paylines.length : 1, extraFreeSpins: 3 };
      expect(spinExpectation(m, R, { ...opts, zoomChance: 0, zoomies: ZOOM })).toEqual(spinExpectation(m, R, opts));
    }
  });

  test('Zoomies only ever raises a machine\'s EV (every 5-reel machine, at every chance)', () => {
    for (const m of data.machines.filter((x) => canZoom(x, x.maxReels, ZOOM))) {
      let last = spinExpectation(m, 5, { lines: m.startLines }).ev;
      for (const z of [0.005, 0.01, 0.015]) {
        const ev = spinExpectation(m, 5, { lines: m.startLines, zoomChance: z, zoomies: ZOOM }).ev;
        expect(ev).toBeGreaterThan(last);
        last = ev;
      }
    }
  });
});

describe('Zoomies in the game', () => {
  // A lot of Zoomies, so a short run sees plenty.
  const d = fast(structuredClone(data));
  d.upgrades.find((u) => u.id === 'zoomies').effect.perLevel = 0.1;
  const g = createGame(d, createRng(77));
  g.unlockAllUpgrades();
  g.addCoins(1e12);
  g.buyMachine('palace');
  g.buyUpgrade('zoomies', 3);
  const zooms = [];
  let spins = 0;
  g.on('spinStarted', (e) => { if (!e.free) spins++; if (e.zoom.length) zooms.push(e); });
  for (let i = 0; i < 4000; i++) {
    g.spin();
    playOut(g);
  }
  test('the chance per paid spin is Zoomies\' level × its chance', () => {
    expect(g.getZoomChance()).toBeCloseTo(0.3, 12);
    expect(Math.abs(zooms.length / spins - 0.3)).toBeLessThan(0.03);
    expect(g.state.stats.zoomies).toBe(zooms.length);
  });
  test('the zoomed reels land all wild, and how many follows the weights', () => {
    expect(zooms.every((e) => e.zoom.every((r) => e.result[r].every((id) => id === 'wild')))).toBe(true);
    const total = ZOOM.reels.reduce((s, o) => s + o.weight, 0);
    for (const o of ZOOM.reels) expect(Math.abs(zooms.filter((e) => e.zoom.length === o.count).length / zooms.length - o.weight / total)).toBeLessThan(0.05);
  });
  test('the economy and the Info tab count it', () => {
    const withZoom = g.getEconomy().ev;
    g.state.upgrades.zoomies = 0;
    const without = g.getEconomy().ev;
    g.state.upgrades.zoomies = 3;
    expect(withZoom).toBeGreaterThan(without * 1.5);
    expect(g.getFeatureOdds().zoom.chance).toBeCloseTo(0.3, 12);
  });

  test('never on Old Clunky, the Snack Stacker, the Maze, or a free spin', () => {
    const h = createGame(d, createRng(78));
    h.unlockAllUpgrades();
    h.addCoins(1e15);
    h.buyUpgrade('zoomies', 3);
    const seen = [];
    h.on('spinStarted', (e) => { if (e.zoom.length) seen.push(e); });
    for (const id of ['clunky', 'stacker', 'maze']) {
      if (id !== 'clunky') h.buyMachine(id); else h.switchMachine('clunky');
      for (let i = 0; i < 300; i++) { h.spin(); playOut(h); }
    }
    h.buyMachine('bonanza');
    h.addFreeSpins(200);
    let free = 0;
    h.on('spinStarted', (e) => { if (e.free) free++; });
    playOut(h);
    expect(free).toBeGreaterThan(150);
    expect(seen.length).toBe(0);
  });
});

describe('Burrow Party: Sticky Wilds and Party Climb (free spins)', () => {
  const bonanza = data.machines.find((m) => m.id === 'bonanza');

  test('free spin k\'s chances add up to 1, and the wild\'s grows to 1 − (1 − w)^(sticky + 1)', () => {
    const w = bonanza.symbols.find((s) => s.wild).weight / bonanza.symbols.reduce((s, x) => s + x.weight, 0);
    for (let k = 1; k <= 6; k++) {
      const md = stickyChances(bonanza, k, 2);
      expect(md.symbols.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1, 12);
      expect(md.symbols.find((s) => s.wild).weight).toBeCloseTo(1 - Math.pow(1 - w, Math.min(k, 3)), 12);
    }
    expect(stickyChances(bonanza, 5, 0)).toBe(bonanza);
  });

  test('with neither upgrade the session is the old closed form', () => {
    const session = freeSpinSession(bonanza, 5, { lines: 5 });
    const fs = freeSpinStats(bonanza, 5);
    const lineEv = spinExpectation(bonanza, 5, { lines: 5 }).lineEv;
    for (const n of [8, 12, 20]) {
      expect(session(n).spins).toBeCloseTo(n / (1 - fs.q * fs.perTrigger), 9);
      expect(session(n).value).toBeCloseTo((n / (1 - fs.q * fs.perTrigger)) * lineEv * 2, 6);
    }
  });

  test('the multiplier climbs ×1 a free spin, as far as Party Climb goes', () => {
    const g = gameOn('bonanza', 5, 1e12);
    g.buyUpgrade('partyClimb', 2);
    const m = [];
    const pays = [];
    g.on('spinStarted', (e) => m.push(e.multiplier));
    g.on('spinResolved', (e) => pays.push(e));
    g.addFreeSpins(6);
    g.update(200);
    expect(m.slice(0, 6)).toEqual([2, 3, 4, 4, 4, 4]);
    expect(g.getMaxFreeSpinMultiplier()).toBe(4);
    const mult = g.getPayoutMultiplier().toNumber();
    pays.slice(0, 6).forEach((e, i) => {
      const r = evaluateGrid(e.result, g.getPaylines(), bonanza.payouts, symbolRules(bonanza));
      expect(e.payout.toNumber()).toBeCloseTo(r.basePayout * mult * m[i], 1);
    });
  });

  // A long run with flat little prizes (so the average settles fast): the cells,
  // the spins and the pay per session all match the exact numbers.
  const d = fast(structuredClone(data));
  const flat = d.machines.find((m) => m.id === 'bonanza');
  for (const id of Object.keys(flat.payouts)) flat.payouts[id] = { 2: 1, 3: 2, 4: 3, 5: 4 };
  const g = createGame(d, createRng(2024));
  g.unlockAllUpgrades();
  g.addCoins(1e12);
  g.buyMachine('bonanza');
  g.buyUpgrade('stickyWilds', 2);
  g.buyUpgrade('partyClimb', 3);
  g.buyUpgrade('bouncyBall', 5);
  const wildAt = [];
  const ballAt = [];
  const cellsAt = [];
  let k = 0;
  g.on('spinStarted', (e) => {
    if (!e.free) return;
    k = g.getFreeSpins().played;
    const cells = e.result.flat();
    wildAt[k] = (wildAt[k] || 0) + cells.filter((id) => id === 'wild').length;
    ballAt[k] = (ballAt[k] || 0) + cells.filter((id) => id === 'ball').length;
    cellsAt[k] = (cellsAt[k] || 0) + cells.length;
  });
  let sessions = 0;
  let spins = 0;
  let coins = 0;
  g.on('freeSpinsEnded', (e) => { sessions++; spins += e.spins; coins += e.won.toNumber(); });
  const N = 8;
  for (let i = 0; i < 6000; i++) {
    g.addFreeSpins(N);
    playOut(g);
  }
  const md = { ...g.getMachineData(), symbols: g.getSymbols() };
  const extra = 5 * data.upgrades.find((u) => u.id === 'bouncyBall').effect.perLevel; // Bouncy Ball, Lv 5
  const session = freeSpinSession(md, 5, { extra, sticky: 2, steps: 3, lines: g.getLineCount() });
  test('every cell shows a wild on free spin k with the chance worked out (and a ball less often)', () => {
    for (const kk of [1, 2, 3, 4, 6]) {
      const chances = stickyChances(md, kk, 2);
      const total = chances.symbols.reduce((s, x) => s + x.weight, 0);
      const pw = chances.symbols.find((s) => s.wild).weight / total;
      const pb = chances.symbols.find((s) => s.id === 'ball').weight / total;
      expect(Math.abs(wildAt[kk] / cellsAt[kk] - pw)).toBeLessThan(0.006);
      expect(Math.abs(ballAt[kk] / cellsAt[kk] - pb)).toBeLessThan(0.004);
    }
    expect(g.state.stats.stickyWilds).toBeGreaterThan(0);
  });
  test('the spins per session and the pay per session match the exact session', () => {
    // (addFreeSpins gives N on top of any retriggered, so a session can start with more.)
    expect(sessions).toBe(6000);
    expect(Math.abs(spins / sessions / session(N).spins - 1)).toBeLessThan(0.02);
    expect(Math.abs(coins / sessions / (session(N).value * g.getPayoutMultiplier().toNumber()) - 1)).toBeLessThan(0.02);
  });

  test('free spins always end, at every level (the retrigger loop stays below 1)', () => {
    const md2 = bonanza; // (every symbol unlocked: the most wilds and balls)
    for (const sticky of [0, 1, 2]) {
      for (const steps of [0, 3]) {
        const s = freeSpinSession(md2, 5, { extra: 18, sticky, steps, lines: 10, bothWays: true })(38);
        expect(Number.isFinite(s.spins) && Number.isFinite(s.value)).toBe(true);
      }
    }
  });

  test('both upgrades only ever raise the machine\'s EV', () => {
    const base = spinExpectation(bonanza, 5, { lines: 5 }).ev;
    let last = base;
    for (const [sticky, steps] of [[1, 0], [2, 0], [2, 1], [2, 2], [2, 3]]) {
      const ev = spinExpectation(bonanza, 5, { lines: 5, stickyWilds: sticky, climbSteps: steps }).ev;
      expect(ev).toBeGreaterThan(last);
      last = ev;
    }
  });

  test('Sticky Wilds held halfway through free spins come back after a save', () => {
    const h = gameOn('bonanza', 9, 1e12);
    h.buyUpgrade('stickyWilds', 2);
    h.addFreeSpins(40);
    let saved = null;
    h.on('spinResolved', () => { if (!saved && h.getFreeSpins() && h.getFreeSpins().sticky.length) saved = h.toSaveData(); });
    h.update(400);
    expect(saved).not.toBe(null);
    const back = createGame(structuredClone(data), createRng(1));
    expect(back.loadSaveData(structuredClone(saved))).toBe(true);
    const bonanzaOf = (save) => save.machines.find((m) => m.typeId === 'bonanza');
    expect(bonanzaOf(back.toSaveData()).freeSpins).toEqual(bonanzaOf(saved).freeSpins);
    expect(bonanzaOf(saved).freeSpins.sticky.every((n) => Number.isInteger(n) && n >= 0 && n <= 2)).toBe(true);
    expect(back.getFreeSpins().sticky.length).toBeGreaterThan(0);
  });
});
