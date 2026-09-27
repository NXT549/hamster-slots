// family.test.js — retirement, Heirloom Seeds and the Family Tree.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, money, num, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree, plant,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('retirement: Heirloom Seeds', () => {
  const r = data.retirement;
  const g = newGame(11);
  check('a new game is generation 1 with 0 seeds', g.state.generation === 1 && num(g.state.seeds) === 0);
  check('cannot retire with 0 pending seeds', g.canRetire() === false && g.retire() === false);

  // Plain debug coins are NOT earnings, so they give no seeds.
  g.addCoins(1e6);
  check('debug coins do not count as earned', num(g.state.stats.coinsEarned) === 0 && num(g.getPendingSeeds()) === 0);
  g.addCoins(g.state.coins.neg());

  // Seeds formula: floor((lifetime earned / divisor) ^ exponent), so n seeds
  // need divisor × n^(1/exponent) coins (a cube root: 3 seeds = 27 × divisor).
  const coinsFor = (n) => r.seedDivisor * Math.pow(n, 1 / r.seedExponent);
  const earnTo = (target) => g.addCoins(target - num(g.state.stats.coinsEarned), true);
  earnTo(r.seedDivisor - 1);
  check(`just under ${r.seedDivisor} earned -> 0 seeds`, num(g.getPendingSeeds()) === 0);
  earnTo(r.seedDivisor);
  check(`${r.seedDivisor} earned -> 1 seed`, num(g.getPendingSeeds()) === 1);
  earnTo(coinsFor(3));
  check(`${Math.round(coinsFor(3))} earned -> exactly 3 seeds (an exact power must not round down)`, num(g.getPendingSeeds()) === 3);
  const prog = g.getSeedProgress();
  check(`seed progress: the next seed at ${Math.round(coinsFor(4))}`, num(prog.total) === 3 && near(num(prog.nextAt), coinsFor(4), 1e-6) && prog.progress < 1e-9);

  // Buy some upgrades, spin, start a delivery, then retire.
  g.addCoins(5000);
  g.buyUpgrade('wheel');
  g.buyUpgrade('thirdReel');
  g.buyUpgrade('cheeks');
  g.spin();
  const lifetimeBefore = num(g.state.stats.coinsEarned);
  const spinsBefore = g.state.stats.spins;
  const events = [];
  g.on('retired', (e) => events.push(e));
  check('retire succeeds', g.retire() === true);
  check('retire pays the pending seeds', num(g.state.seeds) === 3 && num(g.state.seedsEarned) === 3);
  check('retire: generation 2 with the next pup name', g.state.generation === 2 && g.getPupName() === r.pupNames[1]);
  check('retired event has old/new names and seeds', events[0] && events[0].oldName === r.pupNames[0] && events[0].newName === r.pupNames[1] && num(events[0].seedsGained) === 3);
  check('retire resets coins to startCoins', num(g.state.coins) === data.startCoins);
  check('retire resets upgrades and the Third Reel', g.getUpgradeLevel('wheel') === 0 && g.getUpgradeLevel('cheeks') === 0 && g.getReelCount() === 2);
  check('retire clears the spin in progress', g.state.machines[0].spinning === false && g.state.machines[0].result === null);
  check('retire resets this life\'s totals', num(g.state.run.coinsEarned) === 0 && g.state.run.playTime === 0);
  check('retire keeps lifetime stats', num(g.state.stats.coinsEarned) === lifetimeBefore && g.state.stats.spins === spinsBefore);
  check('right after retiring, 0 seeds are pending', num(g.getPendingSeeds()) === 0 && g.canRetire() === false);
  check('retiring opens the Big Cage (between lives)', g.state.bigCage === true);
  check(`heirloom bonus (M8): 3 seeds held -> +${(3 * r.payoutBonusPerSeedHeld * 100).toFixed(0)}% payouts`,
    near(num(g.getPayoutMultiplier()), 1 + 3 * r.payoutBonusPerSeedHeld, 1e-9));

  // Same coins, same seeds: retiring in two steps gives exactly the seeds of one big retirement.
  const a = newGame();
  a.addCoins(coinsFor(5), true);
  a.retire();
  const b = newGame();
  b.addCoins(coinsFor(2), true);
  b.retire();
  b.leaveBigCage();
  b.addCoins(coinsFor(5) - coinsFor(2), true);
  b.retire();
  check('retiring often gives no extra seeds (lifetime formula)', num(a.state.seedsEarned) === 5 && num(b.state.seedsEarned) === 5,
    `${a.state.seedsEarned} vs ${b.state.seedsEarned}`);

  // Real earnings count: spin wins and deliveries.
  const e = newGame(12);
  e.addCoins(1e5);
  for (let i = 0; i < 200; i++) { e.spin(); land(e); }
  e.startDelivery();
  e.update(data.delivery.duration + 1);
  check('spin wins + deliveries = coins earned', near(num(e.state.stats.coinsEarned), num(e.state.stats.coinsWon) + num(e.state.stats.deliveryCoins), 0.001)
    && num(e.state.stats.coinsEarned) > 0 && num(e.state.run.coinsEarned) === num(e.state.stats.coinsEarned));
});

// ─────────────────────────────────────────────────────────────
describe('family tree: buying nodes', () => {
  const g = newGame(13);
  g.addSeeds(5);
  check('M8: cannot plant outside the Big Cage (only between lives)', g.canBuyTreeNode('familyPride') === false && g.buyTreeNode('familyPride') === false);
  g.addSeeds(-5);
  g.openBigCage(); // the debug way in (normally: retire)
  check('cannot buy a node with no seeds', g.buyTreeNode('familyPride') === false);
  g.addSeeds(5);
  check('cannot buy a node before its requirement', g.isTreeNodeUnlocked('luckyWhiskers') === false && g.buyTreeNode('luckyWhiskers') === false);
  check('unknown node id is refused', g.buyTreeNode('nope') === false);
  check('buy the root node', g.buyTreeNode('familyPride') === true && num(g.state.seeds) === 4);
  check('root unlocks the branches', g.isTreeNodeUnlocked('luckyWhiskers') && g.isTreeNodeUnlocked('warmUpLaps') && g.isTreeNodeUnlocked('speedyScooter'));
  check('single-level node cannot be bought twice', g.buyTreeNode('familyPride') === false);
  g.addSeeds(1000);
  const fortune = [];
  for (let i = 0; i < 4; i++) { fortune.push(num(g.getTreeCost('familyFortune'))); g.buyTreeNode('familyFortune'); }
  check('Family Fortune costs 3, 4, 6, 10 (cost formula)', JSON.stringify(fortune) === '[3,4,6,10]', JSON.stringify(fortune));
  check('tree levels are stored in state.tree', g.state.tree.familyPride === 1 && g.state.tree.familyFortune === 4);

  // The tree survives retirement.
  g.leaveBigCage();
  g.addCoins(data.retirement.seedDivisor, true);
  g.retire();
  check('tree nodes are kept after retiring', g.getTreeLevel('familyPride') === 1 && g.getTreeLevel('familyFortune') === 4);
  check('tree preview: Family Fortune now -> next', num(g.previewTreeNode('familyFortune').next) > num(g.previewTreeNode('familyFortune').now));
  check('tree preview: owned single-level node has next = null', g.previewTreeNode('familyPride').next === null);
});

// ─────────────────────────────────────────────────────────────
describe('family traits (tree effects)', () => {
  const buy = (g, ...ids) => plant(g, ...ids);

  // Family Pride multiplies with Chubby Cheeks instead of adding to it.
  const p = newGame();
  p.addCoins(1000);
  p.buyUpgrade('cheeks');
  p.buyUpgrade('cheeks');
  buy(p, 'familyPride');
  check('Family Pride x Chubby Cheeks: 1.5 x 1.25 = 1.875', num(p.getPayoutMultiplier()) === 1.875, num(p.getPayoutMultiplier()));

  // Lucky Whiskers + Carrot Patch move weight from Sunflower Seeds, but never onto
  // a symbol that's still locked (a family trait can't unlock one by accident).
  const base = Object.fromEntries(clunky.symbols.map((s) => [s.id, s.weight]));
  const l = newGame();
  buy(l, 'familyPride', 'luckyWhiskers', 'carrotPatch');
  const w0 = Object.fromEntries(l.getSymbols().map((s) => [s.id, s.weight]));
  check('Lucky Whiskers + Carrot Patch do nothing while the Carrot and Golden Seed are locked',
    w0.seed === base.seed && w0.carrot === 0 && w0.golden === 0, JSON.stringify(w0));
  l.addCoins(1e7);
  l.buyUpgrade('newSeeds', Infinity);
  const whiskers = nodes.find((n) => n.id === 'luckyWhiskers').effect.amount;
  const patch = nodes.find((n) => n.id === 'carrotPatch').effect.amount;
  const w2 = Object.fromEntries(l.getSymbols().map((s) => [s.id, s.weight]));
  check(`once unlocked: seed/carrot/golden ${base.seed}/${base.carrot}/${base.golden} -> ${base.seed - whiskers - patch}/${base.carrot + patch}/${base.golden + whiskers} (the blank keeps ${base.blank})`,
    w2.seed === base.seed - whiskers - patch && w2.carrot === base.carrot + patch && w2.golden === base.golden + whiskers && w2.blank === base.blank, JSON.stringify(w2));
  const unlockedOnly = newGame();
  unlockedOnly.addCoins(1e7);
  unlockedOnly.buyUpgrade('newSeeds', Infinity);
  check('the luck traits raise EV', l.getEconomy().ev > unlockedOnly.getEconomy().ev);
  // Real spins use the new weights: count reel-1 symbols over many spins.
  const counts = { seed: 0, carrot: 0, golden: 0, blank: 0 };
  l.on('spinStarted', (e) => counts[e.result[0][0]]++);
  for (let i = 0; i < 20000; i++) { l.spin(); land(l); }
  const want = l.getSymbolChance('golden');
  check(`spins really use the traits' weights (Golden ${(counts.golden / 200).toFixed(1)}% ~ ${(want * 100).toFixed(1)}%)`, near(counts.golden / 20000, want, 0.012));

  // Jackpot Dance: only full lines get the bonus.
  const j = newGame(21);
  buy(j, 'familyPride', 'luckyWhiskers', 'carrotPatch', 'jackpotDance');
  j.addCoins(1e7);
  const mult = num(j.getPayoutMultiplier());
  let ok = true;
  let fullLines = 0;
  j.buyUpgrade('newSeeds', Infinity);
  j.buyUpgrade('thirdReel');
  j.on('spinResolved', (e) => {
    const r = evaluate(row0(e.result), clunky.payouts, symbolRules(clunky));
    const expected = roundMoney(r.basePayout * (e.fullLine ? 1.5 : 1) * mult);
    if (num(e.payout) !== expected) ok = false;
    if (e.fullLine && num(e.payout) > 0) fullLines++;
  });
  for (let i = 0; i < 3000; i++) { j.spin(); land(j); }
  check('Jackpot Dance: full-line wins x1.5, others unchanged', ok && fullLines > 0, `fullLines=${fullLines}`);

  // EV formula with luck + Jackpot Dance matches real sampled spins.
  for (const reels of [2, 3]) {
    const md = { ...clunky, symbols: j.getSymbols() };
    const rng = createRng(500 + reels);
    const N = 200000;
    let total = 0;
    for (let i = 0; i < N; i++) {
      const { count, basePayout } = evaluate(row0(rollGrid(md, reels, rng)), md.payouts, symbolRules(md));
      total += basePayout * (count === reels ? j.getFullLineMultiplier() : 1);
    }
    const { ev } = expectedValue(md, reels, j.getFullLineMultiplier());
    check(`${reels} reels + luck + Jackpot Dance: sampled EV ${(total / N).toFixed(3)} ~ formula ${ev.toFixed(3)} (within 3%)`,
      near(total / N, ev, ev * 0.03));
  }

  // Warm-up Laps + Heirloom Reel: free levels now AND after every retirement.
  const s = newGame();
  buy(s, 'familyPride', 'warmUpLaps');
  check('Warm-up Laps gives Wheel Training Lv 1 right away', s.getUpgradeLevel('wheel') === 1 && s.getAutoInterval() !== null);
  check('the next Wheel Training level costs the Lv 1 price (formula uses owned levels)', num(s.getUpgradeCost('wheel')) === num(costAtLevel(upgrade('wheel'), 1)));
  buy(s, 'quickPaws', 'heirloomReel');
  check('Heirloom Reel gives 3 reels right away', s.getReelCount() === 3);
  s.addCoins(data.retirement.seedDivisor, true);
  s.retire();
  s.leaveBigCage();
  check('after retiring: Wheel Training Lv 1 and 3 reels for free', s.getUpgradeLevel('wheel') === 1 && s.getReelCount() === 3);
  check('the free level never lowers a bought one', (() => {
    s.addCoins(1e4); s.buyUpgrade('wheel'); s.buyUpgrade('wheel');
    buy(s, 'familyFortune'); // triggers applyStartingLevels again
    return s.getUpgradeLevel('wheel') === 3;
  })());

  // Quick Paws: spin time and auto interval both x0.8.
  const q = newGame();
  q.addCoins(1e4);
  q.buyUpgrade('wheel');
  const ivBefore = q.getAutoInterval();
  const quick = nodes.find((n) => n.id === 'quickPaws').effect.multiplier;
  const fast = clunky.spinDuration * quick;
  buy(q, 'familyPride', 'warmUpLaps', 'quickPaws');
  check(`Quick Paws: spin time ${clunky.spinDuration} -> ${fast.toFixed(2)} s`, near(q.getSpinDuration(), fast, 1e-9));
  check(`Quick Paws: auto interval x${quick} (Wheel Lv 1 is above the rest floor)`, near(q.getAutoInterval(), ivBefore * quick, 1e-9));
  q.spin();
  q.update(fast - 0.02);
  check(`Quick Paws: spin still running at ${(fast - 0.02).toFixed(2)} s`, q.state.machines[0].spinning === true);
  q.update(0.04);
  check(`Quick Paws: spin resolved by ${(fast + 0.02).toFixed(2)} s`, q.state.machines[0].spinning === false);

  // Delivery branch
  const d = newGame();
  const scooter = nodes.find((n) => n.id === 'speedyScooter').effect.multiplier;
  const trip = data.delivery.duration * scooter;
  buy(d, 'familyPride', 'speedyScooter');
  check(`Speedy Scooter: delivery ${data.delivery.duration} s -> ${trip} s`, near(d.getDeliveryDuration(), trip, 1e-9));
  check('without Big Backpack, reward ignores payout bonuses', num(d.getDeliveryReward()) === data.delivery.reward);
  buy(d, 'bigBackpack');
  check(`Big Backpack: reward = ${data.delivery.reward} x payout multiplier`, num(d.getDeliveryReward()) === roundMoney(data.delivery.reward * num(d.getPayoutMultiplier())));
  d.startDelivery();
  d.update(trip + 0.1);
  check(`a ${trip} s delivery finishes on time and pays the boosted reward`,
    d.state.delivery.active === false && num(d.state.stats.deliveryCoins) === num(d.getDeliveryReward()));
  d.addCoins(d.state.coins.neg());
  d.update(1);
  check('without Self-Starter, a broke hamster waits for you', d.state.delivery.active === false);
  const starts = [];
  d.on('deliveryStarted', (e) => starts.push(e.source));
  buy(d, 'selfStarter');
  d.update(0.1);
  check('Self-Starter: broke -> the hamster starts a delivery by itself', d.state.delivery.active === true && starts[0] === 'auto');
  const rich = newGame();
  buy(rich, 'familyPride', 'speedyScooter', 'bigBackpack', 'selfStarter');
  rich.update(5);
  check('Self-Starter does nothing while you can afford a spin', rich.state.delivery.active === false);
});
