// determinism.test.js — determinism: the same seed and inputs always give the same game.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, money, num, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('determinism: frame size must not change the outcome', () => {
  function run(chops) {
    const g = newGame(777);
    g.addCoins(5000);
    for (let i = 0; i < 3; i++) g.buyUpgrade('wheel');
    g.buyUpgrade('lever');
    g.startDelivery(); // include a delivery so every timer type is covered
    for (const dt of chops) g.update(dt);
    return JSON.stringify({ coins: g.state.coins, stats: g.state.stats.spins, rng: g.rng.getState() });
  }
  const oneBig = run([120]);
  const frames = run(Array(7200).fill(1 / 60));
  const halfSeconds = run(Array(240).fill(0.5));
  const lumpy = run([0.3, 17, 0.001, 42.699, 60]);
  check('update(120) == 7200 x update(1/60)', oneBig === frames, `${oneBig} vs ${frames}`);
  check('update(120) == 240 x update(0.5)', oneBig === halfSeconds, `${oneBig} vs ${halfSeconds}`);
  check('update(120) == uneven chunks', oneBig === lumpy, `${oneBig} vs ${lumpy}`);
  check('auto-spins actually happened in that run', JSON.parse(oneBig).stats > 0);

  // Same again with the whole family tree: faster spins, shorter + automatic deliveries.
  function runTree(chops) {
    const g = gameWithWholeTree(778);
    g.addCoins(g.state.coins.neg()); // broke, so Self-Starter kicks in
    for (const dt of chops) g.update(dt);
    return JSON.stringify({ coins: g.state.coins, spins: g.state.stats.spins, deliveries: g.state.stats.deliveries, rng: g.rng.getState() });
  }
  const treeBig = runTree([120]);
  check('with the whole tree: update(120) == 7200 x update(1/60)', treeBig === runTree(Array(7200).fill(1 / 60)));
  check('with the whole tree: deliveries and spins both happened',
    JSON.parse(treeBig).deliveries > 0 && JSON.parse(treeBig).spins > 0, treeBig);

  // Measured auto-spin rate matches the interval (leftover time is carried, not lost).
  const g = newGame(8);
  g.addCoins(1e6);
  g.buyUpgrade('wheel', Infinity);
  g.update(600);
  const expectedSpins = 600 / g.getAutoInterval();
  check(`Wheel maxed: ${g.state.stats.autoSpins} auto-spins in 600 s ~ expected ${expectedSpins.toFixed(0)} (within 2%)`,
    near(g.state.stats.autoSpins, expectedSpins, expectedSpins * 0.02));
  check('coins stay rounded to cents', Math.abs(num(g.state.coins) * 100 - Math.round(num(g.state.coins) * 100)) < 1e-6);
});

// ─────────────────────────────────────────────────────────────
describe('determinism with bets and bonus features', () => {
  function runBonanza(chops) {
    const x = gameOn('bonanza', 161, 1e8);
    x.buyUpgrade('wheel', 10);
    x.buyUpgrade('highRoller');
    x.buyUpgrade('hotStreak');
    x.setBet(1);
    x.addFreeSpins(6);
    for (const dt of chops) x.update(dt);
    return JSON.stringify({ coins: x.state.coins, spins: x.state.stats.spins, free: x.state.stats.freeSpins, rng: x.rng.getState() });
  }
  const big = runBonanza([120]);
  check('free spins + bets + Hot Streak: update(120) == 7200 x update(1/60)', big === runBonanza(Array(7200).fill(1 / 60)) && JSON.parse(big).free >= 6, big);
  function runPalace(chops) {
    const x = gameOn('palace', 162, 1e9);
    x.buyUpgrade('wheel', 10);
    x.triggerJackpot('mini');
    for (const dt of chops) x.update(dt);
    return JSON.stringify({ coins: x.state.coins, spins: x.state.stats.spins, pots: x.state.stats.jackpotsWon, rng: x.rng.getState() });
  }
  const pb = runPalace([120]);
  check('the jackpot wheel: update(120) == uneven chunks', pb === runPalace([0.3, 17, 0.001, 42.699, 60]) && JSON.parse(pb).pots >= 1, pb);
});
