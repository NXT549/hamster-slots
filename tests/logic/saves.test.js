// saves.test.js — saving, loading, every save migration, and hot reload.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, money, num, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';
import { moneyFields } from '../golden/sessions.js';

// Saves before v8 held money as plain numbers; today's save writes it as text
// (big numbers, money.ts). An "old save" made from today's save turns its money
// back into numbers, like the real thing.
function withNumbers(save) {
  for (const [obj, key] of moneyFields(save)) obj[key] = Number(obj[key]);
  return save;
}

// ─────────────────────────────────────────────────────────────
describe('saving and loading', () => {
  const g = newGame(9);
  g.addCoins(3000);
  g.buyUpgrade('wheel');
  g.buyUpgrade('lever');
  g.buyUpgrade('cheeks');
  g.update(7.3);
  g.spin();
  g.update(0.3); // save mid-spin on purpose
  const saved = JSON.parse(JSON.stringify(g.toSaveData())); // exactly what localStorage would hold
  check('save has saveVersion', saved.saveVersion === SAVE_VERSION);
  check('save holds no balance data', !('upgradesData' in saved) && !('payouts' in saved) && !('machinesData' in saved));

  const g2 = newGame(123);
  check('load succeeds', g2.loadSaveData(saved) === true);
  check('save -> load -> save round-trips exactly', deepEqual(g2.toSaveData(), saved),
    `${JSON.stringify(g2.toSaveData())}\n      vs ${JSON.stringify(saved)}`);

  const broken = structuredClone(saved);
  broken.upgrades.bogus = 3;
  broken.upgrades.wheel = 99;
  broken.coins = -50;
  broken.machines[0].result = ['not-a-symbol'];
  const g3 = newGame();
  g3.loadSaveData(broken);
  check('load drops unknown upgrades', !('bogus' in g3.state.upgrades));
  check('load caps levels at maxLevel', g3.getUpgradeLevel('wheel') === upgrade('wheel').maxLevel);
  check('load clamps negative coins to 0', num(g3.state.coins) === 0);
  check('load discards an invalid spin result', g3.state.machines[0].result === null && !g3.state.machines[0].spinning);

  const g4 = newGame();
  check('load rejects null', g4.loadSaveData(null) === false);
  check('load rejects unknown saveVersion', g4.loadSaveData({ saveVersion: 999 }) === false);
  check('failed load leaves a fresh game', num(g4.state.coins) === data.startCoins);

  // Family data round-trips, and junk tree data is cleaned.
  const f = newGame(14);
  f.addCoins(data.retirement.seedDivisor * 16, true);
  f.retire();
  f.buyTreeNode('familyPride');
  f.buyTreeNode('speedyScooter');
  f.leaveBigCage();
  f.startDelivery();
  f.update(3);
  const fSave = JSON.parse(JSON.stringify(f.toSaveData()));
  const f2 = newGame();
  f2.loadSaveData(fSave);
  check('family save round-trips (generation, seeds, tree, delivery)', deepEqual(f2.toSaveData(), fSave));
  const junk = structuredClone(fSave);
  junk.tree.bogus = 2;
  junk.tree.familyPride = 7;
  junk.seeds = -4;
  junk.generation = 0;
  const f3 = newGame();
  f3.loadSaveData(junk);
  check('load cleans the tree (unknown ids dropped, levels capped)', !('bogus' in f3.state.tree) && f3.state.tree.familyPride === 1);
  check('load clamps seeds >= 0 and generation >= 1', num(f3.state.seeds) === 0 && f3.state.generation === 1);
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v1 -> v2', () => {
  // A save exactly as milestone 1 wrote it (saveVersion 1, no family data).
  const v1 = {
    saveVersion: 1, coins: 321.5, upgrades: { wheel: 2, cheeks: 3 },
    machines: [{ typeId: 'clunky', upgrades: { lever: 1 }, spinning: false, spinTimer: 0, result: ['seed', 'seed'] }],
    activeMachine: 0, delivery: { active: true, timer: 12 }, autoTimer: 0.5,
    stats: { spins: 40, manualSpins: 30, autoSpins: 10, wins: 17, coinsWon: 900, coinsSpent: 200, deliveries: 2, deliveryCoins: 30, upgradesBought: 6, playTime: 400 },
  };
  const g = newGame();
  check('a v1 save loads', g.loadSaveData(v1) === true);
  check('v1 progress is kept', num(g.state.coins) === 321.5 && g.getUpgradeLevel('wheel') === 2 && g.getUpgradeLevel('lever') === 1);
  check('v1 -> v2: generation 1, no seeds, empty tree', g.state.generation === 1 && num(g.state.seeds) === 0 && deepEqual(g.state.tree, {}));
  check('v1 -> v2: past wins + deliveries count as earned', num(g.state.stats.coinsEarned) === 930 && num(g.state.run.coinsEarned) === 930);
  check('v1 -> v2: a delivery in progress keeps going', g.state.delivery.active === true && g.state.delivery.timer === 12);
  check('v1 -> v5: the old one-row result becomes a grid', deepEqual(g.state.machines[0].result, [['seed'], ['seed']]));
  check('v1 -> v7: the old machine keeps every symbol it had (New Seeds maxed, nothing locked)',
    g.getUpgradeLevel('newSeeds') === upgrade('newSeeds').maxLevel && clunky.symbols.every((s) => !g.isSymbolLocked(s.id)));
  check(`the migrated save is written as the current version (v${SAVE_VERSION})`, g.toSaveData().saveVersion === SAVE_VERSION);
  check('v1 -> v3: past goals are awarded as diary stickers', g.state.diary.firstSpin === true && num(g.state.tokens) > 0);
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v3 -> v4', () => {
  const g = newGame(51);
  g.addCoins(100);
  const v3 = withNumbers(JSON.parse(JSON.stringify(g.toSaveData())));
  v3.saveVersion = 3;
  delete v3.stats.biggestWin;
  delete v3.stats.offlineCoins;
  const g2 = newGame();
  check('a v3 save loads', g2.loadSaveData(v3) === true);
  check('v3 -> v4: new stats start at 0', num(g2.state.stats.biggestWin) === 0 && num(g2.state.stats.offlineCoins) === 0);
  check('v3 -> v4: everything else is kept', num(g2.state.coins) === num(g.state.coins));
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v4 -> v5', () => {
  // A save as milestone 4 wrote it: one machine, a one-row result, no new stats.
  const g = newGame(54);
  g.addCoins(upgrade('thirdReel').baseCost);
  g.buyUpgrade('thirdReel');
  const v4 = withNumbers(JSON.parse(JSON.stringify(g.toSaveData())));
  v4.saveVersion = 4;
  v4.machines[0].result = ['carrot', 'golden', 'seed'];
  v4.machines[0].spinning = true;
  v4.machines[0].spinTimer = 0.3;
  v4.stats.wins = 12;
  delete v4.stats.machinesBought;
  delete v4.stats.mostLinesWon;
  const g2 = newGame();
  check('a v4 save loads', g2.loadSaveData(v4) === true);
  check('v4 -> v5: the result becomes a grid with one row per reel',
    deepEqual(g2.state.machines[0].result, [['carrot'], ['golden'], ['seed']]));
  check('v4 -> v5: a spin in progress keeps going', g2.state.machines[0].spinning === true && g2.state.machines[0].spinTimer === 0.3);
  check('v4 -> v5: machinesBought 0, mostLinesWon 1 (old wins were on 1 line)',
    g2.state.stats.machinesBought === 0 && g2.state.stats.mostLinesWon === 1);
  let paid = null;
  g2.on('spinResolved', (e) => { paid = e; });
  g2.update(0.5);
  check('the migrated spin lands and is scored', paid !== null && num(paid.payout) === 0 && g2.getReelCount() === 3);
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v2 -> v3', () => {
  // A save as milestone 2 wrote it (family data, no tokens or skins).
  const v2 = {
    saveVersion: 2, coins: 50, upgrades: {}, machines: [{ typeId: 'clunky', upgrades: { thirdReel: 1 }, spinning: false, spinTimer: 0, result: null }],
    activeMachine: 0, delivery: { active: false, timer: 0, duration: 0 }, autoTimer: 0,
    run: { coinsEarned: 10, playTime: 5 }, generation: 3, seeds: 2, seedsEarned: 6, tree: { familyPride: 1 },
    stats: { spins: 150, manualSpins: 150, autoSpins: 0, wins: 60, coinsWon: 50000, coinsSpent: 750, deliveries: 3, deliveryCoins: 45, coinsEarned: 50045, upgradesBought: 9, playTime: 3000 },
  };
  const g = newGame();
  check('a v2 save loads', g.loadSaveData(v2) === true);
  check('v2 family data is kept', g.state.generation === 3 && num(g.state.seeds) === 2 && g.state.tree.familyPride === 1);
  check('v2 -> v3: no skins, starters equipped', Object.keys(g.state.skins.owned).length === 0 && g.getEquippedSkin('fur') === 'furClassic');
  const expected = ['firstSpin', 'firstWin', 'firstDelivery', 'spins100', 'thirdReel', 'firstRetirement'];
  check('v2 -> v3: stickers already reached are awarded on load', expected.every((id) => g.state.diary[id] === true),
    JSON.stringify(g.state.diary));
  const tokens = data.diary.filter((d) => expected.includes(d.id)).reduce((sum, d) => sum + d.tokens, 0);
  check(`v2 -> v3: those stickers pay ${tokens} tokens`, num(g.state.tokens) === tokens && num(g.state.stats.tokensEarned) === tokens, num(g.state.tokens));
});

// ─────────────────────────────────────────────────────────────
describe('saving with bets, bonus features, unlocks and Luck (v6, v7)', () => {
  const b = gameOn('bonanza', 141);
  b.buyUpgrade('highRoller');
  b.setBet(1);
  b.buyUpgrade('deeperDigging');
  b.buyUpgrade('acorn', 3);
  b.buyUpgrade('clover', 2);
  b.addFreeSpins(4);
  b.update(bonanza.freeSpins.pause + 0.5); // mid free spins
  const saved = JSON.parse(JSON.stringify(b.toSaveData()));
  const b2 = newGame();
  check('a save with free spins, bets, a streak, unlocks and Luck loads', b2.loadSaveData(saved) === true);
  check('… and round-trips exactly', deepEqual(b2.toSaveData(), saved), `${JSON.stringify(b2.toSaveData().machines)}\n vs ${JSON.stringify(saved.machines)}`);
  check('… with the same Luck and symbols (Luck is never stored: it comes from the levels)',
    deepEqual(b2.getLuck(), b.getLuck()) && deepEqual(b2.getSymbols(), b.getSymbols()) && !JSON.stringify(saved).includes('"luck"'));
  b2.update(120);
  check('the loaded game plays its free spins out at the saved bet', b2.getFreeSpins() === null && b2.state.stats.freeSpins >= 4 && b2.getBet() === 2);

  const p = gameOn('palace', 142);
  p.spin();
  land(p);
  p.triggerJackpot('minor');
  p.update(1); // mid wheel
  const ps = JSON.parse(JSON.stringify(p.toSaveData()));
  const p2 = newGame();
  p2.loadSaveData(ps);
  check('a save mid jackpot wheel round-trips (pots too)', deepEqual(p2.toSaveData(), ps));
  const w = [];
  p2.on('jackpotWon', (e) => w.push(e));
  p2.update(palace.jackpot.duration);
  check('… and the wheel pays after loading', w.length === 1 && w[0].pot === 'minor');

  const junk = structuredClone(ps);
  const jm = junk.machines.find((m) => m.typeId === 'palace');
  jm.bet = 99;
  jm.pots.mini = -5;
  jm.pots.bogus = 7;
  jm.bonus = { pot: 'nope', timer: 2, bet: 1 };
  jm.streak = -3;
  const cm = junk.machines.find((m) => m.typeId === 'clunky');
  cm.freeSpins = { left: 5, total: 5, bet: 1, won: 0, timer: 0 }; // Old Clunky has no free spins
  junk.gamble = { machineId: 'palace', stake: 100, rounds: 0, started: true, timer: 1 };
  const p3 = newGame();
  p3.loadSaveData(junk);
  const pm = p3.state.machines.find((m) => m.typeId === 'palace');
  check('load cleans feature junk: bet capped, pots >= seed, unknown pots and wheels dropped, no streak below 0',
    p3.getBetIndex() === 0 && num(pm.pots.mini) === palace.jackpot.pots[0].seed && !('bogus' in pm.pots) && pm.bonus === null && pm.streak === 0);
  check('load drops free spins on a machine without them, and never loads a gamble',
    p3.state.machines.find((m) => m.typeId === 'clunky').freeSpins === null && p3.getGambleInfo() === null);
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v5 -> v6', () => {
  const g = newGame(151);
  g.addCoins(8000);
  g.buyMachine('stacker');
  g.spin();
  g.update(0.3);
  const v5 = withNumbers(JSON.parse(JSON.stringify(g.toSaveData())));
  v5.saveVersion = 5;
  for (const m of v5.machines) for (const k of ['bet', 'streak', 'freeSpins', 'pots', 'bonus', 'spinBet', 'spinFree', 'spinSource']) delete m[k];
  for (const k of ['biggestBet', 'freeSpins', 'freeSpinTriggers', 'freeSpinCoins', 'wildWins', 'bestStreak', 'jackpotsWon', 'grandJackpots', 'gambleWins', 'gambleLosses', 'bestGambleRun']) delete v5.stats[k];
  const g2 = newGame();
  check('a v5 save loads', g2.loadSaveData(v5) === true);
  check('v5 -> v6: every machine bets x1 with no free spins or streak', g2.state.machines.every((m) => m.bet === 0 && m.freeSpins === null && m.streak === 0));
  check('v5 -> v6: the new stats start at 0', g2.state.stats.jackpotsWon === 0 && g2.state.stats.gambleWins === 0 && g2.state.stats.biggestBet === 0);
  check('v5 -> v6: a spin in progress keeps going (at x1)', g2.getMachineData().id === 'stacker' && g2.state.machines[1].spinning === true && g2.state.machines[1].spinBet === 1);
  check(`the migrated save is written as v${SAVE_VERSION}`, g2.toSaveData().saveVersion === SAVE_VERSION);
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v6 -> v7 (symbols you unlock)', () => {
  // A v6 hamster had every symbol on every machine. After loading, it still has.
  const g = newGame(152);
  g.addCoins(1e9);
  g.buyMachine('stacker');
  g.buyMachine('bonanza');
  g.buyUpgrade('tunnelGrease', 2);
  const v6 = withNumbers(JSON.parse(JSON.stringify(g.toSaveData())));
  v6.saveVersion = 6;
  for (const k of ['symbolsUnlocked', 'bestLuck', 'suitWins']) delete v6.stats[k];
  delete v6.machines[0].upgrades; // an old machine with no upgrades at all
  const g2 = newGame();
  check('a v6 save loads', g2.loadSaveData(v6) === true && g2.toSaveData().saveVersion === SAVE_VERSION);
  const everyOpen = g2.state.machines.every((m) => {
    const md = data.machines.find((x) => x.id === m.typeId);
    return md.symbols.every((s) => !g2.isSymbolLocked(s.id, undefined, m));
  });
  check('v6 -> v7: every machine keeps every symbol it had (its unlock upgrade is maxed)', everyOpen
    && g2.getUpgradeLevel('deeperDigging') === upgrade('deeperDigging').maxLevel && g2.getUpgradeLevel('tunnelGrease') === 2);
  check('v6 -> v7: the new stats start at 0, and the migration doesn\'t count as buying unlocks',
    g2.state.stats.symbolsUnlocked === 0 && g2.state.stats.suitWins === 0 && g2.state.diary.newSeed !== true);
  check('v6 -> v7: no Luck is given for free (Luck comes from upgrades)', g2.getLuck().total === 0);
  // A fresh v7 game still starts with symbols locked (the migration is only for old saves).
  const fresh = withNumbers(JSON.parse(JSON.stringify(newGame().toSaveData())));
  fresh.saveVersion = 7;
  const g3 = newGame();
  g3.loadSaveData(fresh);
  check('a v7 save is not migrated: its locked symbols stay locked', g3.isSymbolLocked('carrot') && g3.isSymbolLocked('golden'));
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v7 -> v8 (money saved as text: big numbers)', () => {
  // (The real v7 saves in tests/fixtures/ are migrated in fixtures.test.js.)
  const g = newGame(160);
  g.addCoins(1234.56);
  g.addTokens(7);
  const v7 = withNumbers(JSON.parse(JSON.stringify(g.toSaveData())));
  v7.saveVersion = 7;
  const g2 = newGame();
  check('a v7 save (money as plain numbers) loads', g2.loadSaveData(v7) === true);
  const v8 = g2.toSaveData();
  check('v7 -> v8: the same amounts, now written as text', v8.saveVersion === SAVE_VERSION && v8.coins === String(v7.coins) && v8.tokens === '7'
    && typeof v8.stats.coinsWon === 'string' && typeof v8.run.coinsEarned === 'string', JSON.stringify([v8.coins, v8.tokens]));

  // What v8 is for: money past 1.8e308, where a plain number would be Infinity.
  const big = JSON.parse(JSON.stringify(g.toSaveData()));
  big.coins = '1.5e400';
  big.seeds = '4e320';
  big.stats.coinsEarned = '2.5e500';
  const g3 = newGame();
  check('a save with money past 1.8e308 loads', g3.loadSaveData(big) === true && g3.state.coins.gt(1e308) && g3.state.seeds.gt(1e308));
  const again = g3.toSaveData();
  const g4 = newGame();
  g4.loadSaveData(again);
  check('… keeps the amounts (to 12 digits) and saves them back the same every time',
    g3.state.coins.eq_tolerance('1.5e400', 1e-12) && g3.state.stats.coinsEarned.eq_tolerance('2.5e500', 1e-12) && deepEqual(g4.toSaveData(), again), again.coins);
  check('… and the game carries on (a spin, buying, the seed formula)', g4.spin() === true && g4.buyUpgrade('cheeks', 10) === true && g4.getPendingSeeds().gt(1e200));

  // Junk in the money fields falls back like any broken value.
  const junk = JSON.parse(JSON.stringify(g.toSaveData()));
  junk.coins = 'lots';
  junk.tokens = 'Infinity';
  junk.stats.coinsWon = '12abc';
  junk.seeds = { amount: 5 };
  const g5 = newGame();
  check('junk money text loads as the fresh value (start coins, 0 tokens, 0 seeds, 0 won)', g5.loadSaveData(junk) === true
    && num(g5.state.coins) === data.startCoins && num(g5.state.tokens) === 0 && num(g5.state.stats.coinsWon) === 0 && num(g5.state.seeds) === 0);
});

// ─────────────────────────────────────────────────────────────
describe('hot reload (debug "Reload data.json")', () => {
  const g = newGame(10);
  g.addCoins(5000);
  for (let i = 0; i < 5; i++) g.buyUpgrade('wheel');
  const coins = num(g.state.coins);
  const newData = structuredClone(data);
  newData.upgrades.find((u) => u.id === 'wheel').maxLevel = 3;
  newData.machines[0].spinCost = 7;
  g.setData(newData);
  check('reload keeps coins', num(g.state.coins) === coins);
  check('reload caps levels to the new maxLevel', g.getUpgradeLevel('wheel') === 3);
  check('reload applies new balance values', num(g.getSpinCost()) === 7);
});

// ─────────────────────────────────────────────────────────────
describe('save migration: v8 -> v9 (M8: the Big Cage, Machine Stars)', () => {
  // A family in its second life, with seeds held, a planted tree and Family Fortune.
  const g = newGame(170);
  g.addCoins(data.retirement.seedDivisor * 100, true); // 10 seeds
  g.retire();
  g.buyTreeNode('familyPride');
  g.buyTreeNode('familyFortune');
  g.leaveBigCage();
  g.spin();
  g.update(1);
  const v8 = JSON.parse(JSON.stringify(g.toSaveData()));
  delete v8.stars;
  delete v8.bigCage;
  for (const key of ['rebuilds', 'bestStars', 'mostSeedsHeld']) delete v8.stats[key];
  v8.saveVersion = 8;
  const g2 = newGame();
  check('a v8 save loads', g2.loadSaveData(v8) === true);
  const v9 = g2.toSaveData();
  check('v8 -> v9: no stars yet, and the save is mid-life (not in the Big Cage)',
    v9.saveVersion === SAVE_VERSION && deepEqual(v9.stars, {}) && v9.bigCage === false && g2.getStars('clunky') === 0);
  check('v8 -> v9: the new stats start at 0', g2.state.stats.rebuilds === 0 && g2.state.stats.bestStars === 0 && g2.state.stats.mostSeedsHeld === 0);
  check('v8 -> v9: the tree, the seeds held and the spin in progress are kept',
    g2.getTreeLevel('familyPride') === 1 && g2.getTreeLevel('familyFortune') === 1 && num(g2.state.seeds) === num(g.state.seeds)
    && g2.state.machines[0].spinning === g.state.machines[0].spinning);
  check('v8 -> v9: the heirloom bonus counts the seeds held (up to the seed jar, which Family Fortune makes bigger)',
    near(num(g2.getHeirloomBonus()), Math.min(num(g2.state.seeds) * data.retirement.payoutBonusPerSeedHeld, g2.getSeedJar()), 1e-9)
    && near(g2.getSeedJar(), data.retirement.seedJar + nodes.find((n) => n.id === 'familyFortune').effect.perLevel, 1e-12));
  const rest = { ...v9 };
  check('v8 -> v9: nothing else changes', deepEqual({ ...rest, saveVersion: 8, stars: undefined, bigCage: undefined, stats: { ...rest.stats, rebuilds: undefined, bestStars: undefined, mostSeedsHeld: undefined } },
    { ...v8, stars: undefined, bigCage: undefined, stats: { ...v8.stats, rebuilds: undefined, bestStars: undefined, mostSeedsHeld: undefined } }));

  // The Big Cage and stars round-trip, and junk is cleaned.
  const c = newGame(171);
  c.addCoins(data.retirement.seedDivisor * 4, true);
  c.retire();
  const inCage = JSON.parse(JSON.stringify(c.toSaveData()));
  const c2 = newGame();
  c2.loadSaveData(inCage);
  const t0 = c2.state.stats.playTime;
  c2.update(30);
  check('a save made in the Big Cage loads in the Big Cage, where time stands still',
    c2.state.bigCage === true && c2.state.stats.playTime === t0 && c2.spin() === false);
  const junk = JSON.parse(JSON.stringify(inCage));
  junk.stars = { clunky: 99, bonanza: 2.7, nope: 3, stacker: -1 };
  junk.bigCage = 'yes';
  const c3 = newGame();
  c3.loadSaveData(junk);
  check('junk stars are cleaned (capped at the max, whole numbers, known machines only); a non-true bigCage is false',
    deepEqual(c3.state.stars, { clunky: data.stars.max, bonanza: 2 }) && c3.state.bigCage === false, JSON.stringify(c3.state.stars));
});
