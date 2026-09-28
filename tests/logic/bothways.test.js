// bothways.test.js — "Pays Both Ways" (the user's M7 playtest: "with 3 slots it's
// left to right, so if you get 2 on the right it doesn't count"). Each machine
// sells an upgrade that ALSO reads every line from the right-hand reel.
// The scoring (machine.ts evaluateGrid), its exact maths (expectedValue), and the
// upgrade in the game (game.ts: the "bothWays" effect, "requires").

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  createRng, evaluate, evaluateGrid, expectedValue, rollGrid, allPaylines, symbolRules, spinExpectation,
  data, near, num, newGame, clunky, stacker, bonanza, palace, land, soldOn, wildWeights, withWild, unlockLevels, withUnlocks, spinGrid, opened,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('pays both ways: which wins count', () => {
  const p = clunky.payouts;
  const rules = symbolRules(clunky);
  const line = allPaylines(clunky); // one line, row 0
  const grid = (...ids) => ids.map((id) => [id]);
  const score = (g, both = true) => evaluateGrid(g, line, p, rules, both);

  const right = score(grid('seed', 'carrot', 'carrot'));
  check('seed carrot carrot: nothing from the left, a Baby Carrot pair from the right',
    score(grid('seed', 'carrot', 'carrot'), false).basePayout === 0
    && right.wins.length === 1 && right.wins[0].fromRight && right.wins[0].symbolId === 'carrot' && right.wins[0].count === 2
    && right.basePayout === p.carrot['2'], JSON.stringify(right));
  const left = score(grid('seed', 'seed', 'carrot'));
  check('seed seed carrot: still the seed pair from the left, and only that',
    left.wins.length === 1 && !left.wins[0].fromRight && left.basePayout === p.seed['2']);
  const full = score(grid('carrot', 'carrot', 'carrot'));
  check('a full line pays ONCE, not once from each side',
    full.wins.length === 1 && full.wins[0].fullLine && !full.wins[0].fromRight && full.basePayout === p.carrot['3']);
  check('a Wood Shaving still ends a run: blank seed seed pays the pair from the right; seed blank seed pays nothing',
    score(grid('blank', 'seed', 'seed')).basePayout === p.seed['2'] && score(grid('seed', 'blank', 'seed')).basePayout === 0);
  check('2 reels: both ways changes nothing (every pair is a full line)',
    ['seed', 'carrot', 'golden', 'blank'].every((a) => ['seed', 'carrot', 'golden', 'blank'].every((b) =>
      score(grid(a, b)).basePayout === score(grid(a, b), false).basePayout && score(grid(a, b)).wins.length === score(grid(a, b), false).wins.length)));

  // A 5-reel machine with a wild: a run at each end, and the wilds in the middle count for both.
  const bp = bonanza.payouts;
  const br = symbolRules(bonanza);
  const five = (ids) => evaluateGrid(ids.map((id) => [id, id, id]), [[1, 1, 1, 1, 1]], bp, br, true);
  const two = five(['seed', 'seed', 'blank', 'carrot', 'carrot']);
  check('5 reels: seed seed | carrot carrot pays both pairs',
    two.wins.length === 2 && two.basePayout === bp.seed['2'] + bp.carrot['2'], JSON.stringify(two));
  const wild = five(['seed', 'wild', 'wild', 'wild', 'carrot']);
  const fromLeft = evaluate(['seed', 'wild', 'wild', 'wild', 'carrot'], bp, br);
  const fromRight = evaluate(['carrot', 'wild', 'wild', 'wild', 'seed'], bp, br);
  check('5 reels: seed + 3 wilds + carrot pays the left run and the right run (each reads the wilds its own way)',
    wild.wins.length === 2 && wild.basePayout === fromLeft.basePayout + fromRight.basePayout && wild.wins.every((w) => w.usedWild));
  const allWild = five(['wild', 'wild', 'wild', 'wild', 'wild']);
  check('5 wilds are one full line, paid once', allWild.wins.length === 1 && allWild.basePayout === bp.wild['5']);
});

// ─────────────────────────────────────────────────────────────
describe('pays both ways: the exact EV and hit rate', () => {
  // The same made-up machine as machine.test.js (a wild, a scatter and a blank),
  // every possible line tried, scored both ways by evaluateGrid itself.
  const toy = {
    symbols: [
      { id: 'a', weight: 40 }, { id: 'b', weight: 25 }, { id: 'c', weight: 15 },
      { id: 'w', weight: 12, wild: true }, { id: 's', weight: 8, scatter: true }, { id: 'x', weight: 30, blank: true },
    ],
    payouts: {
      a: { 2: 2, 3: 10, 4: 40, 5: 200 }, b: { 2: 5, 3: 30, 4: 150, 5: 900 }, c: { 2: 9, 3: 70, 4: 400, 5: 2500 },
      w: { 2: 20, 3: 100, 4: 600, 5: 5000 },
    },
    maxReels: 5,
  };
  const rules = symbolRules(toy);
  const total = toy.symbols.reduce((sum, s) => sum + s.weight, 0);
  for (let reels = 2; reels <= 5; reels++) {
    for (const fullMult of [1, 3]) {
      let ev = 0;
      let hit = 0;
      (function all(line, chance) {
        if (line.length === reels) {
          const r = evaluateGrid(line.map((id) => [id]), [new Array(reels).fill(0)], toy.payouts, rules, true);
          const pay = r.wins.reduce((sum, w) => sum + w.basePayout * (w.fullLine ? fullMult : 1), 0);
          ev += chance * pay;
          if (pay > 0) hit += chance;
          return;
        }
        for (const s of toy.symbols) all([...line, s.id], (chance * s.weight) / total);
      })([], 1);
      const f = expectedValue({ ...toy, maxReels: reels }, reels, fullMult, 1, true);
      check(`toy machine, ${reels} reels, full-line x${fullMult}, both ways: formula EV ${f.ev.toFixed(6)} = every line tried ${ev.toFixed(6)}, hit rate too`,
        near(f.ev, ev, 1e-9) && near(f.hitRate, hit, 1e-12));
    }
  }

  // The hit rate on grids: every grid of a small toy machine (4 symbols, 2 rows).
  // 3 reels (both ends share reel 2) and 4 reels (the ends are apart) take
  // different paths through the maths, so both are tried.
  const small = {
    symbols: [{ id: 'a', weight: 5 }, { id: 'b', weight: 3 }, { id: 'w', weight: 1, wild: true }, { id: 'x', weight: 4, blank: true }],
    payouts: { a: { 2: 1, 3: 4, 4: 12 }, b: { 2: 3, 3: 9, 4: 30 }, w: { 2: 6, 3: 20, 4: 80 } },
    rows: 2,
    paylines: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 1, 0, 1], [1, 0, 1, 0], [0, 0, 1, 1]],
  };
  const smallRules = symbolRules(small);
  const smallTotal = small.symbols.reduce((sum, s) => sum + s.weight, 0);
  for (const reels of [3, 4]) {
    const md = { ...small, maxReels: reels, paylines: small.paylines.map((l) => l.slice(0, reels)) };
    const cells = [];
    for (let r = 0; r < reels; r++) for (let row = 0; row < 2; row++) cells.push([r, row]);
    for (const lineCount of [1, 3, 5]) {
      const lines = md.paylines.slice(0, lineCount);
      let hit = 0;
      let ev = 0;
      const grid = Array.from({ length: reels }, () => [null, null]);
      (function fill(i, chance) {
        if (i === cells.length) {
          const pay = evaluateGrid(grid, lines, small.payouts, smallRules, true).basePayout;
          ev += chance * pay;
          if (pay > 0) hit += chance;
          return;
        }
        for (const s of small.symbols) {
          grid[cells[i][0]][cells[i][1]] = s.id;
          fill(i + 1, (chance * s.weight) / smallTotal);
        }
      })(0, 1);
      const f = expectedValue(md, reels, 1, lineCount, true);
      check(`toy grid, ${reels} reels, ${lineCount} line${lineCount === 1 ? '' : 's'}, both ways: hit rate ${(f.hitRate * 100).toFixed(4)}% = every grid tried ${(hit * 100).toFixed(4)}%, EV too`,
        near(f.hitRate, hit, 1e-12) && near(f.ev, ev, 1e-9));
    }
  }

  // Every real machine that sells it, on the reels it can have with it (3+):
  // one line exactly (every line tried), and every payline count sampled with the game's RNG.
  for (const m of data.machines.filter((x) => soldOn(x, 'bothWays').length > 0)) {
    for (const wildWeight of [wildWeights(m).at(0), wildWeights(m).at(-1)]) {
      const md = withUnlocks(withWild(m, wildWeight), unlockLevels(m).at(-1));
      const mdRules = symbolRules(md);
      const mdTotal = md.symbols.reduce((sum, s) => sum + s.weight, 0);
      for (let reels = Math.max(3, m.startReels); reels <= m.maxReels; reels++) {
        let exact = 0;
        (function all(line, chance) {
          if (line.length === reels) {
            for (const { ids, p } of opened(md, line)) {
              exact += chance * p * evaluateGrid(ids.map((id) => [id]), [new Array(reels).fill(0)], md.payouts, mdRules, true).basePayout;
            }
            return;
          }
          for (const s of md.symbols) if (s.weight > 0) all([...line, s.id], (chance * s.weight) / mdTotal);
        })([], 1);
        const one = expectedValue(md, reels, 1, 1, true).ev;
        const label = `${m.name}, ${reels} reels${wildWeight ? `, wild weight ${wildWeight}` : ''}, both ways`;
        check(`${label}: one-line EV ${one.toFixed(4)} = every line tried ${exact.toFixed(4)}`, near(one, exact, 1e-9 * Math.max(1, one)));
        const lines = allPaylines(md).length;
        const rng = createRng(7 + reels + (wildWeight || 0));
        const N = 30000;
        let hits = 0;
        for (let i = 0; i < N; i++) if (evaluateGrid(spinGrid(md, reels, rng), allPaylines(md), md.payouts, mdRules, true).wins.length > 0) hits++;
        const { hitRate } = expectedValue(md, reels, 1, lines, true);
        check(`${label}, ${lines} lines: sampled hit rate ${(hits / N * 100).toFixed(2)}% ~ formula ${(hitRate * 100).toFixed(2)}%`, near(hits / N, hitRate, 0.012));
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────
describe('pays both ways: the upgrade in the game', () => {
  const ids = Object.fromEntries(data.upgrades.filter((u) => u.effect.type === 'bothWays').map((u) => [u.machines[0], u.id]));
  check('every payline machine sells a Pays Both Ways upgrade (a ways machine has no lines to read backwards)', data.machines.filter((m) => !m.ways).every((m) => ids[m.id]));

  // Old Clunky's needs the Third Reel: with 2 reels every pair already fills the line.
  const g = newGame(3);
  g.addCoins(1e6);
  const id = ids.clunky;
  const before = g.getUpgradeBulk(id);
  check("Old Clunky's Both Ways needs the Third Reel first (price shown, not buyable)",
    g.getUpgradeNeeds(id).join() === 'Third Reel' && !g.canBuyUpgrade(id) && !before.affordable && num(before.cost) === num(g.getUpgradeCost(id)) && !g.buyUpgrade(id)
    && !g.hasBothWays());
  g.buyUpgrade('thirdReel');
  const preview = g.previewUpgrade(id);
  check('after the Third Reel it can be bought; the shop preview shows more wins and a bigger average win',
    g.getUpgradeNeeds(id).length === 0 && g.canBuyUpgrade(id)
    && preview.now.on === false && preview.next.on === true && preview.next.hitRate > preview.now.hitRate && preview.next.win.gt(preview.now.win));
  const evBefore = g.getEconomy().ev;
  check('buying it turns it on', g.buyUpgrade(id) && g.hasBothWays() && g.isMaxed(id) && g.getMachineInfo('clunky').features.bothWays);
  const md = { ...g.getMachineData(), symbols: g.getSymbols() };
  check("the game's EV is the exact both-ways EV", g.getEconomy().ev > evBefore
    && near(g.getEconomy().ev, spinExpectation(md, 3, { bothWays: true }).ev, 1e-9));

  // A real spin: pay a pair on the right, as its own win from the right.
  let resolved = null;
  g.on('spinResolved', (e) => { resolved = e; });
  const coins = num(g.state.coins);
  g.spin('auto'); // (auto: no card gamble offer to get in the way)
  g.state.machines[0].result = [['seed'], ['carrot'], ['carrot']];
  land(g);
  const pay = num(g.getPayoutMultiplier()) * clunky.payouts.carrot['2'];
  check('a spin that lands seed carrot carrot pays the Baby Carrot pair from the right',
    resolved && resolved.wins.length === 1 && resolved.wins[0].fromRight && near(num(resolved.payout), pay, 0.005)
    && near(num(g.state.coins), coins - num(g.getSpinCost()) + pay, 0.005), JSON.stringify(resolved && resolved.wins));

  // Stats: a line that pays at both ends is still ONE line.
  const b = newGame(4);
  b.addCoins(1e12);
  b.buyMachine('bonanza');
  b.buyUpgrade(ids.bonanza);
  b.on('spinResolved', (e) => { resolved = e; });
  b.spin('auto');
  const m = b.state.machines.find((x) => x.typeId === 'bonanza');
  const cols = ['seed', 'seed', 'blank', 'carrot', 'carrot'].map((id) => [id, id, id]);
  m.result = cols;
  land(b);
  const lines = b.getLineCount();
  check(`a grid where every line pays at both ends: ${lines} lines won (not ${lines * 2})`,
    resolved.wins.length === lines * 2 && b.state.stats.mostLinesWon === lines);

  // It's a coin upgrade: kept in the save, gone when the hamster retires.
  const saved = newGame(5);
  saved.loadSaveData(JSON.parse(JSON.stringify(g.toSaveData())));
  check('a save keeps it', saved.hasBothWays());
  const r = newGame(6);
  r.addCoins(1e6);
  r.buyUpgrade('thirdReel');
  r.buyUpgrade(id);
  r.addCoins(1e9, true);
  check('retiring resets it, like every coin upgrade', r.hasBothWays() && r.retire() && !r.hasBothWays());
});

// ─────────────────────────────────────────────────────────────
describe('pays both ways: every machine gets more wins and a bigger average win', () => {
  for (const m of [clunky, stacker, bonanza, palace]) {
    const md = withUnlocks(m, 0);
    const lines = allPaylines(m).length;
    const off = spinExpectation(md, m.maxReels, { lines });
    const on = spinExpectation(md, m.maxReels, { lines, bothWays: true });
    check(`${m.name} (${m.maxReels} reels, ${lines} line${lines === 1 ? '' : 's'}): hit rate ${(off.hitRate * 100).toFixed(1)}% → ${(on.hitRate * 100).toFixed(1)}%, EV ${off.ev.toFixed(1)} → ${on.ev.toFixed(1)}`,
      on.hitRate > off.hitRate && on.ev > off.ev);
  }
});
