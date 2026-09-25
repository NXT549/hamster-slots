// machines.test.js — owning and switching machines, bets, the Hamster Wild, Luck and symbol unlocks.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('machines: collect & switch', () => {
  const g = newGame(61);
  check('a new game owns only the free first machine', g.state.machines.length === 1 && g.ownsMachine('clunky') && !g.ownsMachine('stacker'));
  check('cannot buy a machine without the coins', g.canBuyMachine('stacker') === false && g.buyMachine('stacker') === false);
  check('unknown machine ids are refused', g.buyMachine('nope') === false && g.switchMachine('nope') === false);
  check('cannot switch to a machine you do not own', g.switchMachine('stacker') === false);
  g.addCoins(stacker.unlockCost - data.startCoins + 100);
  const log = [];
  g.on('machineBought', (e) => log.push(`bought:${e.id}:${e.cost}`));
  g.on('machineSwitched', (e) => log.push(`switched:${e.from}>${e.id}`));
  check('buy the Snack Stacker', g.buyMachine('stacker') === true);
  check('buying costs unlockCost and switches to it', g.state.coins === 100 && g.getMachineData().id === 'stacker'
    && log.join() === `bought:stacker:${stacker.unlockCost},switched:clunky>stacker`, log.join());
  check('cannot buy the same machine twice', g.canBuyMachine('stacker') === false);
  check('the Snack Stacker starts with 3 reels, 3 rows, 3 lines', g.getReelCount() === 3 && g.getRowCount() === 3 && g.getLineCount() === 3);
  check(`a Snack Stacker spin costs ${stacker.spinCost}`, g.getSpinCost() === stacker.spinCost);
  check('stats.machinesBought counts it, and "Snack Time" is awarded', g.state.stats.machinesBought === 1 && g.state.diary.secondMachine === true);

  // Machine upgrades belong to one machine; hamster upgrades work everywhere.
  const shop = g.getAvailableUpgrades().map((u) => u.id);
  check('the shop shows the Stacker\'s upgrades, not Old Clunky\'s', shop.includes('gears') && shop.includes('paylines') && shop.includes('fourthReel')
    && shop.includes('snackRestock') && shop.includes('sprinkles')
    && !shop.includes('lever') && !shop.includes('thirdReel') && !shop.includes('newSeeds') && !shop.includes('horseshoe')
    && shop.includes('cheeks') && shop.includes('wheel') && shop.includes('clover'), shop.join());
  g.addCoins(1e6);
  check('Old Clunky\'s Third Reel cannot be bought on the Stacker', g.buyUpgrade('thirdReel') === false);
  g.buyUpgrade('gears');
  g.buyUpgrade('cheeks');
  check('Smooth Gears lowers the Stacker\'s spin cost', g.getSpinCost() === roundMoney(stacker.spinCost * 0.9));
  check('switch back to Old Clunky', g.switchMachine('clunky') === true && g.getMachineData().id === 'clunky');
  check('Old Clunky keeps its own spin cost and has no Gears', g.getSpinCost() === clunky.spinCost && g.getUpgradeLevel('gears') === 0);
  check('Chubby Cheeks (a hamster upgrade) works on both', g.getPayoutMultiplier() === 1.25);
  check('switching to the machine you are on does nothing', g.switchMachine('clunky') === false);
  const info = g.getMachineInfo('stacker');
  check('getMachineInfo describes a machine you are not using', info.owned && !info.active && info.spinCost === roundMoney(stacker.spinCost * 0.9)
    && info.lines === 3 && info.maxLines === 5 && info.rows === 3);
  const unowned = newGame().getMachineInfo('stacker');
  check('getMachineInfo describes a machine you do not own yet', !unowned.owned && unowned.cost === stacker.unlockCost && unowned.reels === 3);

  // Extra Paylines and the Fourth Reel.
  g.switchMachine('stacker');
  const ev3 = g.getEconomy().ev;
  const preview = g.previewUpgrade('paylines');
  check('Extra Paylines preview: 3 -> 4 lines', preview.now === 3 && preview.next === 4);
  g.buyUpgrade('paylines');
  g.buyUpgrade('paylines');
  check('Extra Paylines x2: all 5 lines, and it stops there', g.getLineCount() === 5 && g.buyUpgrade('paylines') === false);
  check('5 lines = 5/3 of the 3-line EV (averages add up)', near(g.getEconomy().ev, ev3 * 5 / 3, 1e-9));
  check('getPaylines returns the 5 active lines', g.getPaylines().length === 5 && g.getPaylines()[3].join() === stacker.paylines[3].join());
  g.buyUpgrade('fourthReel');
  check('Fourth Reel: 4 reels', g.getReelCount() === 4);

  // Stacker spins: a 4 x 3 grid, every line scored, payouts = sum of lines x multiplier.
  let ok = true;
  let spins = 0;
  let multiLine = 0;
  g.on('spinResolved', (e) => {
    if (e.machineId !== 'stacker') return;
    spins++;
    if (e.result.length !== 4 || !e.result.every((c) => c.length === 3)) ok = false;
    const expected = evaluateGrid(e.result, g.getPaylines(), stacker.payouts, symbolRules(stacker));
    const pay = roundMoney(expected.wins.reduce((sum, w) => sum + roundMoney(w.basePayout * g.getPayoutMultiplier()), 0));
    if (pay !== e.payout || expected.wins.length !== e.wins.length) ok = false;
    if (e.tier !== g.getWinTier(expected.basePayout)) ok = false;
    if (e.wins.length >= 3) multiLine++;
  });
  for (let i = 0; i < 3000; i++) { g.spin(); land(g); }
  check('3,000 Stacker spins: 4 x 3 grids, every payout = the sum of its lines', ok && spins === 3000);
  check('"Line Dancer": 3+ lines won in one spin happens, and is recorded', multiLine > 0 && g.state.stats.mostLinesWon >= 3 && g.state.diary.threeLines === true);

  // After a switch, the old machine's spin still lands and pays.
  const s = gameOnStacker(62);
  s.switchMachine('clunky');
  s.spin();
  check('switch mid-spin is allowed', s.switchMachine('stacker') === true);
  const landed = [];
  s.on('spinResolved', (e) => landed.push(e.machineId));
  s.update(clunky.spinDuration + 0.05);
  check('the old machine\'s spin still lands and pays', landed[0] === 'clunky' && s.state.machines.find((m) => m.typeId === 'clunky').spinning === false);

  // Auto-spin runs the active machine only.
  const a = gameOnStacker(63);
  a.buyUpgrade('wheel');
  const machinesSpun = new Set();
  a.on('spinStarted', (e) => machinesSpun.add(e.machineId));
  a.update(30);
  check('auto-spin runs only the active machine', machinesSpun.size === 1 && machinesSpun.has('stacker'));

  // Retiring resets machines (they were bought with coins).
  const r = gameOnStacker(64);
  r.addCoins(data.retirement.seedDivisor * 4, true);
  r.retire();
  check('retiring resets machines to the free first machine', r.state.machines.length === 1 && r.getMachineData().id === 'clunky');
  check('Heirloom Reel only gives Old Clunky its Third Reel', (() => {
    const h = newGame(65);
    h.addSeeds(1000);
    for (const id of ['familyPride', 'warmUpLaps', 'quickPaws', 'heirloomReel']) h.buyTreeNode(id);
    h.addCoins(1e6);
    h.buyMachine('stacker');
    return h.getReelCount() === 3 && h.getUpgradeLevel('fourthReel') === 0 && h.getMachineInfo('clunky').reels === 3;
  })());

  // Saves: both machines, their upgrades and which one is active.
  const sv = gameOnStacker(66);
  sv.buyUpgrade('paylines');
  sv.switchMachine('clunky');
  sv.buyUpgrade('lever');
  sv.switchMachine('stacker');
  sv.spin();
  sv.update(0.3);
  const saved = JSON.parse(JSON.stringify(sv.toSaveData()));
  const sv2 = newGame();
  sv2.loadSaveData(saved);
  check('two machines round-trip through a save', deepEqual(sv2.toSaveData(), saved));
  check('the loaded game is on the Stacker with its paylines', sv2.getMachineData().id === 'stacker' && sv2.getLineCount() === 4);
  const junk = structuredClone(saved);
  junk.machines = [junk.machines[1], structuredClone(junk.machines[1]), { typeId: 'nope' }];
  junk.activeMachine = 0;
  junk.machines[0].result = [['seed', 'seed'], ['seed', 'seed'], ['seed', 'seed']]; // 2 rows: wrong for the Stacker
  const sv3 = newGame();
  sv3.loadSaveData(junk);
  check('load drops duplicate and unknown machines, and always keeps the free machine',
    sv3.state.machines.length === 2 && sv3.state.machines.map((m) => m.typeId).sort().join() === 'clunky,stacker');
  check('load keeps the right machine active after cleanup', sv3.getMachineData().id === 'stacker');
  check('load discards a grid with the wrong number of rows', sv3.state.machines.find((m) => m.typeId === 'stacker').result === null);

  // Frame size never changes the outcome, even with two machines and switches.
  // Both runs switch machine every 7 s of GAME time, but advance time in
  // different chunk sizes (7 s at once vs 1/60 s frames).
  function runSwitching(framesPer7s) {
    const x = gameOnStacker(67, 50000);
    x.buyUpgrade('wheel');
    x.buyUpgrade('wheel');
    for (let block = 0; block < 20; block++) {
      for (let f = 0; f < framesPer7s; f++) x.update(7 / framesPer7s);
      x.switchMachine(x.getMachineData().id === 'stacker' ? 'clunky' : 'stacker');
    }
    return JSON.stringify({ coins: x.state.coins, spins: x.state.stats.spins, rng: x.rng.getState() });
  }
  const bigSteps = runSwitching(1);
  const frames = runSwitching(420);
  check('two machines + switching: update(7) == 420 x update(1/60)', bigSteps === frames && JSON.parse(bigSteps).spins > 0,
    `${bigSteps} vs ${frames}`);
});

// ─────────────────────────────────────────────────────────────
describe('bets (denoms) and High Roller', () => {
  const g = newGame(81);
  g.addCoins(1e6);
  check('a new hamster bets x1 and cannot raise it yet', g.getBet() === 1 && g.getMaxBetIndex() === 0 && g.setBet(2) === false && g.getBet() === 1);
  g.buyUpgrade('highRoller');
  const changes = [];
  g.on('betChanged', (e) => changes.push(e));
  check('High Roller Lv 1 unlocks the next bet (x2)', g.getMaxBetIndex() === 1 && g.setBet(1) === true && g.getBet() === 2 && changes[0].bet === 2);
  check('setBet never goes past what is unlocked', g.setBet(99) === false && g.getBet() === 2);
  check('a x2 spin costs twice the x1 cost', g.getBetCost() === roundMoney(g.getSpinCost() * 2));
  const prev = g.previewUpgrade('highRoller');
  check('the High Roller card shows the max bet going up (x2 -> x3)', prev.now === 2 && prev.next === 3);
  let ok = true;
  let wins = 0;
  let spent = 0;
  g.on('spinStarted', (e) => { spent += e.cost; if (e.bet !== 2) ok = false; });
  g.on('spinResolved', (e) => {
    const base = evaluate(row0(e.result), clunky.payouts, symbolRules(clunky)).basePayout;
    if (e.payout !== roundMoney(base * (g.getPayoutMultiplier() * 2))) ok = false;
    if (e.tier !== g.getWinTier(base)) ok = false; // the tier ignores the bet
    if (e.payout > 0) wins++;
  });
  for (let i = 0; i < 300; i++) { g.spin(); land(g); }
  check('300 x2 spins: each costs 2x and pays base x multiplier x 2 (tier from the base payout)', ok && wins > 0 && near(spent, 300 * g.getSpinCost() * 2, 1e-6));
  g.setBet(0);
  const e1 = g.getEconomy();
  g.setBet(1);
  const e2 = g.getEconomy();
  check('the RTP is the same at every bet; profit per spin scales with it', near(e1.rtp, e2.rtp, 1e-12) && near(e2.profitPerSpin, 2 * e1.profitPerSpin, 1e-9));

  // Stepping down when you can't afford your bet.
  const s = newGame(82);
  s.addCoins(1e5);
  s.buyUpgrade('highRoller', 2);
  s.setBet(2); // x3
  s.addCoins(12 - s.state.coins); // 12 coins: x3 costs 15, x2 costs 10
  const started = [];
  s.on('spinStarted', (e) => started.push(e));
  check('too poor for x3: the spin steps down to x2', s.getSpinBet() === 2 && s.spin() === true && started[0].bet === 2 && started[0].cost === 10);
  check('the chosen bet stays x3', s.getBet() === 3);
  land(s);
  s.addCoins(4 - s.state.coins);
  const reasons = [];
  s.on('spinBlocked', (e) => reasons.push(e));
  check('below x1 the spin is refused ("coins", with the x1 cost)', s.getSpinBet() === null && s.spin() === false && reasons[0].reason === 'coins' && reasons[0].cost === clunky.spinCost);

  const a = newGame(83);
  a.addCoins(1e6);
  a.buyUpgrade('wheel');
  a.buyUpgrade('highRoller', Infinity);
  a.setBet(data.betSteps.length - 1);
  a.addCoins(30 - a.state.coins);
  a.update(10);
  check('auto-spin never stalls at a high bet: it steps down', a.state.stats.autoSpins > 0);

  const m = newGame(84);
  m.addCoins(1e9);
  m.buyUpgrade('highRoller', 2);
  m.setBet(2);
  m.buyMachine('stacker');
  check('a new machine starts at the bet you were using', m.getMachineData().id === 'stacker' && m.getBet() === 3 && m.getMachineInfo('stacker').bet === 3);
  check('each machine keeps its own bet', m.setBet(0) === true && m.switchMachine('clunky') === true && m.getBet() === 3);
  m.buyUpgrade('highRoller', 2);
  m.setBet(4);
  m.spin();
  check(`a x${data.betSteps[4]} spin sets stats.biggestBet and earns "High Roller"`, m.state.stats.biggestBet === data.betSteps[4] && m.state.diary.highRoller === true);
  m.addCoins(data.retirement.seedDivisor * 4, true);
  land(m);
  m.retire();
  check('retiring resets High Roller (bets go back to x1)', m.getMaxBetIndex() === 0 && m.getBet() === 1);
});

// ─────────────────────────────────────────────────────────────
describe('Hamster Wild (the Snack Stacker)', () => {
  const g = gameOn('stacker', 91);
  check('the Stacker has no wild until Hamster Wild', g.getSymbolChance('wild') === 0 && g.getAvailableUpgrades().some((u) => u.id === 'hamsterWild'));
  check('Old Clunky does not sell Hamster Wild', !newGame().getAvailableUpgrades().some((u) => u.id === 'hamsterWild'));
  const before = g.getEconomy().ev;
  const up = data.upgrades.find((u) => u.id === 'hamsterWild').effect;
  const others = g.getSymbols().reduce((sum, s) => sum + s.weight, 0); // every other symbol's weight (the wild's is 0)
  check('Hamster Wild Lv 1 gives the wild its weight', g.buyUpgrade('hamsterWild') === true && near(g.getSymbolChance('wild'), up.perLevel / (others + up.perLevel), 1e-12));
  check('the wild raises the EV', g.getEconomy().ev > before);
  const prev = g.previewUpgrade('hamsterWild');
  check('the card previews the wild chance going up', near(prev.now, g.getSymbolChance('wild'), 1e-12) && prev.next > prev.now);
  g.buyUpgrade('hamsterWild', Infinity);
  g.buyUpgrade('paylines', Infinity);
  let ok = true;
  let wildSeen = false;
  g.on('spinResolved', (e) => {
    const r = evaluateGrid(e.result, g.getPaylines(), stacker.payouts, symbolRules(stacker));
    const pay = roundMoney(r.wins.reduce((sum, w) => sum + roundMoney(w.basePayout * g.getPayoutMultiplier()), 0));
    if (pay !== e.payout) ok = false;
    if (e.result.some((c) => c.includes('wild'))) wildSeen = true;
  });
  for (let i = 0; i < 2000; i++) { g.spin(); land(g); }
  check('2,000 spins with wilds: every payout follows the wild rule', ok && wildSeen);
  check('stats.wildWins counts wins with a wild, and "Wild Thing" is awarded', g.state.stats.wildWins > 0 && g.state.diary.wildThing === true);
  // A golden full line counts as a golden jackpot even with wilds in it (not a line of wilds alone).
  const line = evaluate(['golden', 'wild', 'golden'], stacker.payouts, symbolRules(stacker));
  check('golden, wild, golden is a golden full line (a golden jackpot)', line.symbolId === 'golden' && line.count === 3);
});

// ─────────────────────────────────────────────────────────────
describe('Luck and symbols you unlock (in the game)', () => {
  const g = newGame(171);
  g.addCoins(1e9);
  const e0 = g.getEconomy();
  check('a new hamster has Luck 0 (Hamster 0 + Machine 0)', deepEqual(g.getLuck(), { hamster: 0, machine: 0, total: 0 }) && deepEqual(e0.luck, g.getLuck()));
  g.buyUpgrade('clover', 2);
  g.buyUpgrade('horseshoe', 3);
  const clover = upgrade('clover').effect.perLevel;
  const shoe = upgrade('horseshoe').effect.perLevel;
  check(`Hamster Luck (Four-Leaf Clover) + Machine Luck (Lucky Horseshoe) add up: ${2 * clover} + ${3 * shoe}`,
    deepEqual(g.getLuck(), { hamster: 2 * clover, machine: 3 * shoe, total: 2 * clover + 3 * shoe }));
  const L = g.getLuck().total;
  const base = Object.fromEntries(clunky.symbols.map((s) => [s.id, s.weight]));
  const now = Object.fromEntries(g.getSymbols().map((s) => [s.id, s.weight]));
  check(`every symbol but the blank has its weight x (1 + ${L}/100); the blank keeps ${base.blank}`,
    near(now.seed, base.seed * (1 + L / 100), 1e-9) && now.blank === base.blank && now.carrot === 0);
  const e1 = g.getEconomy();
  check('Luck raises the hit rate and the EV', e1.hitRate > e0.hitRate && e1.ev > e0.ev);
  const prev = g.previewUpgrade('clover');
  check('the Clover card previews Luck and the hit rate going up', prev.now.luck === L && prev.next.luck === L + clover && prev.next.hitRate > prev.now.hitRate);
  g.buyMachine('stacker');
  check('Hamster Luck works on every machine; Machine Luck stays with its machine',
    deepEqual(g.getLuck(), { hamster: 2 * clover, machine: 0, total: 2 * clover }) && g.getMachineInfo('clunky').luck === L);

  // Unlocking, one symbol at a time, in order.
  const u = newGame(172);
  u.addCoins(1e9);
  const locked = soldOn(clunky, 'unlockSymbol')[0].effect.symbols;
  check(`Old Clunky starts with ${locked.join(' and ')} locked, and they show in getMachineInfo`,
    locked.every((id) => u.isSymbolLocked(id)) && u.getMachineInfo('clunky').symbols.unlocked === 0 && u.getMachineInfo('clunky').symbols.lockable === locked.length);
  check('getSymbolUnlock names the upgrade that opens a symbol', u.getSymbolUnlock(locked[0]).id === 'newSeeds' && u.getSymbolUnlock('seed') === null);
  const before = u.getEconomy();
  const card = u.previewUpgrade('newSeeds');
  u.buyUpgrade('newSeeds');
  const after = u.getEconomy();
  check(`New Seeds Lv 1 opens the ${locked[0]} (only): EV up, hit rate down`, !u.isSymbolLocked(locked[0]) && u.isSymbolLocked(locked[1])
    && after.ev > before.ev && after.hitRate < before.hitRate);
  check('the New Seeds card previews the average win going up and the hit rate going down',
    card.next.win > card.now.win && card.next.hitRate < card.now.hitRate && card.next.open === 1 && card.now.open === 0);
  u.buyUpgrade('newSeeds');
  check('Lv 2 opens the next one too; after that it\'s maxed', locked.every((id) => !u.isSymbolLocked(id)) && u.isMaxed('newSeeds'));
  let seen = 0;
  u.on('spinStarted', (e) => { if (e.result.some((c) => c.includes(locked[1]))) seen++; });
  for (let i = 0; i < 400; i++) { u.spin(); land(u); }
  check(`the reels land on an unlocked ${locked[1]} (${seen} times in 400 spins)`, seen > 0);
  u.addCoins(data.retirement.seedDivisor * 4, true);
  u.retire();
  check('symbol unlocks are coin upgrades: they reset when the hamster retires', locked.every((id) => u.isSymbolLocked(id)));
  check('"Four-Leaf Hamster": the best Luck is remembered', (() => {
    const k = newGame(173);
    k.addCoins(1e12);
    k.buyUpgrade('clover', Infinity);
    k.buyUpgrade('horseshoe', Infinity);
    return k.state.stats.bestLuck === k.getLuck().total && k.state.diary.luck50 === (k.getLuck().total >= 50);
  })());
});
