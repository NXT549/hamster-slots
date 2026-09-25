// economy.test.js — spinning, buying, deliveries, the balance rules, win tiers and offline earnings.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('upgrade cost formula: floor(baseCost x growthRate ^ owned)', () => {
  const g = newGame();
  g.addCoins(1e7);
  const costs = (id, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(g.getUpgradeCost(id));
      g.buyUpgrade(id);
    }
    return out;
  };
  // The formula written out by hand (not with the game's own costAtLevel), so a
  // mistake in either one shows up.
  const byHand = (id, n) => Array.from({ length: n }, (_, i) => Math.floor(upgrade(id).baseCost * Math.pow(upgrade(id).growthRate, i)));
  const cheeks = costs('cheeks', 5);
  check(`Chubby Cheeks costs ${byHand('cheeks', 5).join(', ')}`, JSON.stringify(cheeks) === JSON.stringify(byHand('cheeks', 5)), JSON.stringify(cheeks));
  const wheelMax = upgrade('wheel').maxLevel;
  const wheel = costs('wheel', wheelMax);
  check(`Wheel Training's ${wheelMax} levels cost ${byHand('wheel', wheelMax).join(', ')}`, JSON.stringify(wheel) === JSON.stringify(byHand('wheel', wheelMax)), JSON.stringify(wheel));
  const lever = costs('lever', 8);
  check(`Oiled Lever's 8 levels total ${byHand('lever', 8).reduce((a, b) => a + b)}`, lever.reduce((a, b) => a + b) === byHand('lever', 8).reduce((a, b) => a + b), JSON.stringify(lever));
  const seeds = costs('newSeeds', 2);
  check(`New Seeds (the symbol unlocks) use the same formula: ${byHand('newSeeds', 2).join(', ')}`, JSON.stringify(seeds) === JSON.stringify(byHand('newSeeds', 2)));
  check('costAtLevel is that formula', costAtLevel(upgrade('clover'), 3) === byHand('clover', 4)[3]);
});

// ─────────────────────────────────────────────────────────────
describe('buying upgrades', () => {
  const g = newGame();
  check('start with startCoins', g.state.coins === data.startCoins);
  check('cannot buy when too poor', g.buyUpgrade('cheeks') === false && g.state.coins === data.startCoins);
  check('unknown upgrade id is refused', g.buyUpgrade('nope') === false);
  const reelCost = upgrade('thirdReel').baseCost;
  g.addCoins(reelCost);
  check('Third Reel: 2 reels before', g.getReelCount() === 2);
  const evBefore = g.getEconomy().ev;
  check('Third Reel purchase succeeds', g.buyUpgrade('thirdReel') === true);
  check(`Third Reel: coins reduced by exactly ${reelCost}`, g.state.coins === data.startCoins);
  check('Third Reel: 3 reels after', g.getReelCount() === 3);
  check('Third Reel: EV goes up', g.getEconomy().ev > evBefore);
  g.addCoins(1e5);
  check('Third Reel cannot be bought twice (maxLevel 1)', g.buyUpgrade('thirdReel') === false);
  const w = upgrade('wheel');
  for (let i = 0; i < 10; i++) g.buyUpgrade('wheel');
  check(`Wheel Training stops at max level ${w.maxLevel}`, g.buyUpgrade('wheel') === false && g.getUpgradeLevel('wheel') === w.maxLevel);
  const formula = w.effect.baseInterval * Math.pow(w.effect.intervalMultiplier, w.maxLevel - 1);
  check(`Wheel Training Lv ${w.maxLevel}: interval = max(formula ${formula.toFixed(2)} s, spin time + rest ${(clunky.spinDuration + w.effect.rest).toFixed(2)} s)`,
    near(g.getAutoInterval(), Math.max(formula, clunky.spinDuration + w.effect.rest), 1e-9), g.getAutoInterval());
  g.buyUpgrade('lever');
  check('Oiled Lever L1 spin cost 5 -> 4.5', g.getSpinCost() === 4.5);
  g.buyUpgrade('cheeks');
  g.buyUpgrade('cheeks');
  check('Chubby Cheeks L2 multiplier 1.5', g.getPayoutMultiplier() === 1.5);
  const prev = g.previewUpgrade('cheeks');
  check('shop preview: cheeks now 1.5 -> next 1.75', prev.now === 1.5 && prev.next === 1.75);
  check('shop preview: maxed upgrade has next = null', g.previewUpgrade('wheel').next === null);
  check('machine-scoped levels stored on the machine', g.state.machines[0].upgrades.lever === 1 && !('lever' in g.state.upgrades));
});

// ─────────────────────────────────────────────────────────────
describe('spinning, spin cost and timing', () => {
  const g = newGame(3);
  const blocked = [];
  g.on('spinBlocked', (e) => blocked.push(e.reason));
  check('spin succeeds with enough coins', g.spin() === true);
  check('spin cost is paid up front', g.state.coins === data.startCoins - clunky.spinCost);
  check('cannot start another spin while spinning', g.spin() === false && g.state.stats.spins === 1);
  g.update(clunky.spinDuration - 0.02);
  check('still spinning just before spinDuration', g.state.machines[0].spinning === true);
  g.update(0.04);
  // That second click wasn't lost: it was queued and starts as soon as the first spin lands.
  // (If that first spin won, the gamble offer takes the queued click's place instead.)
  const offered = g.getGambleInfo() !== null;
  check('spin resolves after spinDuration, and the click during it starts the next spin (or the gamble offer shows)',
    offered ? g.state.stats.spins === 1 : g.state.stats.spins === 2 && g.state.stats.manualSpins === 2);
  g.update(clunky.spinDuration + 0.05);
  check('only ONE click is queued (a second spin, not a third)', g.state.stats.spins <= 2 && g.state.machines[0].spinning === false);
  const q = newGame(31);
  q.addCoins(1e5);
  q.buyUpgrade('wheel', 10);
  q.update(q.getAutoInterval() + 0.5); // an auto-spin is running now
  check('(an auto-spin is running)', q.state.machines[0].spinning && q.state.stats.autoSpins === 1);
  q.spin('manual'); // lands mid auto-spin: queued
  const sources = [];
  q.on('spinStarted', (e) => sources.push(e.source));
  q.update(clunky.spinDuration);
  check('a queued click beats auto-spin to the next spin', sources[0] === 'manual');

  const g2 = newGame(4);
  g2.addCoins(-(data.startCoins - 2)); // leave 2 coins
  check('spin refused when coins < spin cost', g2.spin() === false && blocked.length === 0);
  const blocked2 = [];
  g2.on('spinBlocked', (e) => blocked2.push(e.reason));
  g2.spin();
  check('refused spin emits spinBlocked "coins"', blocked2[0] === 'coins');
  check('coins never go negative', g2.state.coins === 2);

  // Payouts include the Chubby Cheeks multiplier, rounded to cents.
  const g3 = newGame(5);
  g3.addCoins(1e6);
  g3.buyUpgrade('cheeks');
  let allCorrect = true;
  let wins = 0;
  let blanks = 0;
  let lockedSeen = 0;
  const locked = clunky.symbols.filter((s) => s.locked).map((s) => s.id);
  g3.on('spinResolved', (e) => {
    const expected = roundMoney(evaluate(row0(e.result), clunky.payouts, symbolRules(clunky)).basePayout * g3.getPayoutMultiplier());
    if (e.payout !== expected) allCorrect = false;
    if (e.payout > 0) wins++;
    if (row0(e.result).every((id) => id === 'blank') && e.payout !== 0) allCorrect = false;
    if (row0(e.result).includes('blank')) blanks++;
    if (row0(e.result).some((id) => locked.includes(id))) lockedSeen++;
  });
  for (let i = 0; i < 500; i++) {
    g3.spin();
    land(g3);
  }
  check('500 spins: every payout = base x multiplier, and Wood Shavings never pay', allCorrect && wins > 0 && blanks > 0, `wins=${wins} blanks=${blanks}`);
  check(`a new Old Clunky never lands a locked symbol (${locked.join(', ')})`, g3.state.stats.spins === 500 && lockedSeen === 0, lockedSeen);
});

// ─────────────────────────────────────────────────────────────
describe('food delivery (the soft-lock safety net)', () => {
  const g = newGame(6);
  g.addCoins(-data.startCoins);
  check('broke: 0 coins', g.state.coins === 0);
  check('broke: cannot spin', g.spin() === false);
  check('delivery can start at 0 coins', g.startDelivery() === true);
  check('only one delivery at a time', g.startDelivery() === false);
  const reasons = [];
  g.on('spinBlocked', (e) => reasons.push(e.reason));
  g.addCoins(100);
  g.spin();
  check('no spinning while the hamster is delivering', reasons[0] === 'delivery' && g.state.stats.spins === 0);
  g.addCoins(-100);
  g.update(data.delivery.duration - 0.1);
  check('delivery not finished early', g.state.delivery.active === true && g.state.coins === 0);
  g.update(0.2);
  check('delivery pays its reward', g.state.coins === data.delivery.reward && g.state.delivery.active === false);
  check('after a delivery you can spin again', g.spin() === true);

  const g2 = newGame(7);
  g2.addCoins(1000);
  g2.buyUpgrade('wheel');
  g2.startDelivery();
  g2.update(10);
  check('auto-spin pauses during delivery', g2.state.stats.spins === 0);
  g2.update(data.delivery.duration);
  check('auto-spin resumes after delivery', g2.state.stats.autoSpins > 0);
});

// ─────────────────────────────────────────────────────────────
describe('balance rules (DESIGN.md section 9)', () => {
  // Rule 1, for every setup a machine can have (reels, paylines, wild level, and
  // every step of its symbol unlocks, locked symbols included), counting its
  // features (free spins, jackpot pots) with no feature upgrades and no Luck
  // (Luck only raises it, see below).
  for (const m of data.machines) {
    const all = setups(m, 'zero');
    const worst = all.flatMap((s) => s.ladder.map((step) => ({ s, step, rtp: step.value.ev / m.spinCost }))).sort((a, b) => a.rtp - b.rtp)[0];
    check(`rule 1: ${m.name}: every setup (${all.length} × ${unlockLevels(m).length} unlock steps) has RTP > 100% (lowest ${(worst.rtp * 100).toFixed(1)}%: ${worst.s.label}, ${worst.step.level} unlocked)`,
      worst.rtp > 1);
    // Free spins must be able to end: each one retriggers less than once on average,
    // even with every Bouncy Ball and every bit of Luck (Luck makes the balls land more often).
    if (m.freeSpins) {
      const extra = data.upgrades.filter((u) => u.effect.type === 'extraFreeSpins' && u.machines.includes(m.id)).reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0);
      const lucky = setups(m, 'max').at(-1).ladder.at(-1).md;
      const f = freeSpinStats(lucky, m.maxReels, extra);
      check(`${m.name}: free spins always end (retrigger loop ${(f.q * f.perTrigger).toFixed(3)} < 1, ${f.total.toFixed(1)} spins a trigger with every Bouncy Ball and max Luck)`,
        f.q * f.perTrigger < 1 && Number.isFinite(f.total));
    }
  }

  // Symbols you unlock (the user's "new seeds"), kept balanced: in EVERY setup,
  // at no Luck and at max Luck, each unlock raises the average win and lowers
  // the hit rate. Bigger prizes, fewer wins: never a trap, and a reason to buy Luck.
  for (const m of data.machines) {
    for (const luck of ['zero', 'max']) {
      const bad = [];
      let steps = 0;
      for (const s of setups(m, luck)) {
        s.ladder.slice(1).forEach((step, i) => {
          steps++;
          const before = s.ladder[i].value;
          if (!(step.value.ev > before.ev && step.value.hitRate < before.hitRate)) bad.push(`${s.label} step ${step.level}`);
        });
      }
      check(`unlocks on ${m.name}${luck === 'max' ? ' (max Luck)' : ''}: all ${steps} steps raise EV and lower the hit rate`, steps > 0 && bad.length === 0, bad.slice(0, 3).join('; '));
    }
  }

  // Luck: every Luck level raises BOTH the hit rate and the EV, on every machine
  // (the blank is what it works against). Checked level by level, with nothing and
  // with everything unlocked.
  for (const m of data.machines) {
    const machine = probeMachine(m);
    const unlock = soldOn(m, 'unlockSymbol')[0];
    const bad = [];
    let steps = 0;
    for (const unlocked of [0, unlockLevels(m).at(-1)]) {
      let prev = null;
      const lucks = soldOn(m, 'luck');
      const levels = {};
      for (const u of lucks) {
        for (let l = 0; l <= u.maxLevel; l++) {
          levels[u.id] = l;
          const o = { ...levels, ...(unlock ? { [unlock.id]: unlocked } : {}) };
          const md = { ...m, symbols: probe.getSymbols(o, machine) };
          const v = spinExpectation(md, m.startReels, { lines: m.startLines || 1 });
          if (prev && (l > 0) && !(v.ev > prev.ev && v.hitRate > prev.hitRate)) bad.push(`${u.id} Lv ${l}`);
          if (l > 0) steps++;
          prev = v;
        }
      }
    }
    check(`Luck on ${m.name}: all ${steps} Luck levels raise both the hit rate and the EV`, steps > 0 && bad.length === 0, bad.join(', '));
  }

  // The auto-spin interval is never shorter than the spin plus a short rest, on
  // any machine, at any Wheel Training level, with or without Quick Paws.
  {
    const w = upgrade('wheel');
    const t = newGame(5);
    t.addCoins(1e15);
    for (const m of data.machines.slice(1)) t.buyMachine(m.id);
    let ok = true;
    let checked = 0;
    for (const quick of [false, true]) {
      if (quick) { t.addSeeds(100); for (const id of ['familyPride', 'warmUpLaps', 'quickPaws']) t.buyTreeNode(id); }
      for (const m of data.machines) {
        t.switchMachine(m.id);
        for (let l = 1; l <= w.maxLevel; l++) {
          checked++;
          if (!(t.getAutoInterval({ wheel: l }) >= t.getSpinDuration() + w.effect.rest - 1e-9)) ok = false;
        }
      }
    }
    check(`the auto-spin interval is never shorter than spin time + ${w.effect.rest} s rest (${checked} setups, Quick Paws too)`, ok);
  }
  const g = newGame();
  g.addCoins(1e6);
  g.buyUpgrade('wheel');
  const econ = g.getEconomy();
  check(`rule 2: delivery ${econ.deliveryPerSecond.toFixed(2)}/s < auto-spin profit at Wheel L1 ${econ.expectedAutoProfitPerSecond.toFixed(2)}/s`,
    econ.deliveryPerSecond < econ.expectedAutoProfitPerSecond);
  check(`rule 3: one delivery (${data.delivery.reward}) covers a base spin on the free first machine (${clunky.spinCost})`,
    data.delivery.reward >= clunky.spinCost);

  // Rule 2 must also hold with the WHOLE family tree (faster, bigger deliveries).
  // Checked at 2 reels: a fresh life on 2 reels is the worst case for auto-spin.
  const t = newGame();
  t.addSeeds(10000);
  for (const id of nodeIds) if (id !== 'heirloomReel') t.buyTreeNode(id);
  const tEcon = t.getEconomy();
  check(`rule 2 with the whole tree (2 reels): delivery ${tEcon.deliveryPerSecond.toFixed(2)}/s < auto-spin ${tEcon.expectedAutoProfitPerSecond.toFixed(2)}/s`,
    t.getAutoInterval() !== null && tEcon.reels === 2 && tEcon.deliveryPerSecond < tEcon.expectedAutoProfitPerSecond);
  const w = gameWithWholeTree();
  const wEcon = w.getEconomy();
  check(`rule 2 with the whole tree (3 reels): delivery ${wEcon.deliveryPerSecond.toFixed(2)}/s < auto-spin ${wEcon.expectedAutoProfitPerSecond.toFixed(2)}/s`,
    wEcon.deliveryPerSecond < wEcon.expectedAutoProfitPerSecond);
});

// ─────────────────────────────────────────────────────────────
describe('win tiers (how big a win feels)', () => {
  const g = newGame();
  const tiers = data.winTiers;
  check('win tiers are in increasing order', tiers.every((t, i) => i === 0 || t.minMultiple > tiers[i - 1].minMultiple));
  const rules = symbolRules(clunky);
  const tierOf = (result) => g.getWinTier(evaluate(result, clunky.payouts, rules).basePayout);
  // What each tier is on Old Clunky follows from the paytable ÷ the spin cost (5).
  check('no win -> "none"', tierOf(['seed', 'carrot', 'seed']) === 'none' && tierOf(['blank', 'blank', 'blank']) === 'none');
  check('Sunflower pair -> "win"', tierOf(['seed', 'seed', 'carrot']) === 'win');
  check('Sunflower line -> "win" (the most common line stays small)', tierOf(['seed', 'seed', 'seed']) === 'win');
  check('Carrot pair -> "nice"', tierOf(['carrot', 'carrot', 'seed']) === 'nice');
  check('Carrot line and Golden pair -> "big"', tierOf(['carrot', 'carrot', 'carrot']) === 'big' && tierOf(['golden', 'golden', 'blank']) === 'big');
  check('Golden line -> "jackpot"', tierOf(['golden', 'golden', 'golden']) === 'jackpot');

  // Upgrades must not change the tier: it uses the BASE payout.
  const u = newGame(52);
  u.addCoins(1e7);
  for (let i = 0; i < 30; i++) u.buyUpgrade('cheeks');
  u.buyUpgrade('thirdReel');
  u.buyUpgrade('newSeeds', Infinity);
  let ok = true;
  let biggest = 0;
  u.on('spinResolved', (e) => {
    if (e.tier !== u.getWinTier(evaluate(row0(e.result), clunky.payouts, rules).basePayout)) ok = false;
    biggest = Math.max(biggest, e.payout);
  });
  for (let i = 0; i < 2000; i++) { u.spin(); land(u); }
  check('spinResolved carries the tier (same with 30 levels of Chubby Cheeks)', ok);
  check('stats.biggestWin is the largest payout', u.state.stats.biggestWin === biggest && biggest > 0);
});

// ─────────────────────────────────────────────────────────────
describe('offline earnings', () => {
  const o = data.offline;
  const g = newGame(53);
  check('no Wheel Training: nothing earned offline', g.getOfflineEarnings(3600).coins === 0 && g.applyOfflineEarnings(3600) === false);
  g.addCoins(1e5);
  g.buyUpgrade('wheel');
  g.buyUpgrade('thirdReel');
  const perSecond = g.getEconomy().expectedAutoProfitPerSecond;
  const hour = g.getOfflineEarnings(3600);
  check(`1 h away = auto profit/s x 3600 x ${o.efficiency}`, near(hour.coins, perSecond * 3600 * o.efficiency, 0.01) && hour.seconds === 3600);
  check(`capped at ${o.maxSeconds / 3600} h`, g.getOfflineEarnings(o.maxSeconds * 5).seconds === o.maxSeconds);
  check(`under ${o.minSeconds} s counts as nothing`, g.getOfflineEarnings(o.minSeconds - 1).coins === 0);
  const before = { coins: g.state.coins, earned: g.state.stats.coinsEarned, rng: g.rng.getState() };
  const events = [];
  g.on('offlineEarned', (e) => events.push(e));
  check('applyOfflineEarnings succeeds', g.applyOfflineEarnings(3600) === true);
  check('offline coins are added and count as earned (toward seeds)',
    near(g.state.coins, before.coins + hour.coins, 0.011) && near(g.state.stats.coinsEarned, before.earned + hour.coins, 0.011));
  check('offline earnings never touch the RNG', g.rng.getState() === before.rng);
  check('offlineEarned event says how long and how much', events[0] && events[0].seconds === 3600 && events[0].coins === hour.coins);
  check('stats.offlineCoins adds up', g.state.stats.offlineCoins === hour.coins);
});

// ─────────────────────────────────────────────────────────────
describe('buying x10 and Max', () => {
  const g = newGame(71);
  g.addCoins(1e5);
  const cheeks = data.upgrades.find((u) => u.id === 'cheeks');
  const sum = (def, from, n) => Array.from({ length: n }, (_, i) => Math.floor(def.baseCost * Math.pow(def.growthRate, from + i))).reduce((a, b) => a + b, 0);
  const b10 = g.getUpgradeBulk('cheeks', 10);
  check('x10 Chubby Cheeks costs the sum of the next 10 levels', b10.count === 10 && b10.cost === sum(cheeks, 0, 10) && b10.affordable);
  const bought = [];
  g.on('upgradeBought', (e) => bought.push(e));
  const coins = g.state.coins;
  check('buy x10', g.buyUpgrade('cheeks', 10) === true && g.getUpgradeLevel('cheeks') === 10 && g.state.coins === coins - b10.cost);
  check('one upgradeBought event with count 10', bought.length === 1 && bought[0].count === 10 && bought[0].level === 10 && bought[0].cost === b10.cost);
  check('stats.upgradesBought counts every level', g.state.stats.upgradesBought === 10);
  check('x10 preview shows the value after 10 more levels', g.previewUpgrade('cheeks', 10).next === 1 + 0.25 * 20);

  // Capped upgrades: x10 stops at the max level.
  const wheelMax = upgrade('wheel').maxLevel;
  g.buyUpgrade('wheel');
  g.buyUpgrade('wheel');
  const w = g.getUpgradeBulk('wheel', 10);
  check(`x10 Wheel Training at Lv 2 buys the last ${wheelMax - 2} levels`, w.count === wheelMax - 2 && g.buyUpgrade('wheel', 10) === true && g.getUpgradeLevel('wheel') === wheelMax);
  check('a maxed upgrade has nothing to buy', g.getUpgradeBulk('wheel', 10).count === 0 && g.buyUpgrade('wheel', Infinity) === false);

  // x10 is all or nothing. Coins for exactly 3 levels of Cheeks (plus a little), not 10.
  const three = sum(cheeks, 0, 3);
  const p = newGame(72);
  p.addCoins(three + 5 - data.startCoins);
  check('x10 you cannot afford is refused (all or nothing)', p.getUpgradeBulk('cheeks', 10).affordable === false && p.buyUpgrade('cheeks', 10) === false
    && p.getUpgradeLevel('cheeks') === 0);

  // Max buys as many as you can afford.
  const m = p.getUpgradeBulk('cheeks', Infinity);
  check(`Max: ${three + 5} coins buy 3 levels of Cheeks (${three})`, m.count === 3 && m.cost === three && m.affordable);
  p.buyUpgrade('cheeks', Infinity);
  check('buy Max', p.getUpgradeLevel('cheeks') === 3 && p.state.coins === 5);
  const poor = p.getUpgradeBulk('cheeks', Infinity);
  check('Max with too few coins shows the next price but is not affordable', poor.count === 1 && poor.cost === costAtLevel(cheeks, 3) && !poor.affordable);
  check('an upgrade the machine does not sell has nothing to buy', p.getUpgradeBulk('gears', 10).count === 0);
});
