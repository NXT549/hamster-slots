// test_logic.mjs — proves the game logic works with NO page, NO browser, NO visuals.
//
// Run it from the hamster_slots folder:
//     node tools/test_logic.mjs
//
// Plain script, no test framework: each check prints PASS or FAIL, and the
// script exits with code 1 if anything failed. At the end it prints the
// economy numbers, so you can copy them into DESIGN.md after a balance change.

import { readFileSync } from 'node:fs';
import { createRng } from '../js/rng.js';
import {
  evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol,
  scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation,
} from '../js/machine.js';
import { createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS } from '../js/game.js';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? `   -> ${detail}` : ''}`);
  }
}
function section(title) {
  console.log(`\n== ${title} ==`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// Compares two JSON-like values, ignoring the order of object keys.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((k) => deepEqual(a[k], b[k]));
}
// Every test gets its own copy of the data, so nothing leaks between tests.
const newGame = (seed = 1) => createGame(structuredClone(data), createRng(seed));
const clunky = data.machines[0];
const stacker = data.machines.find((m) => m.id === 'stacker');
const bonanza = data.machines.find((m) => m.id === 'bonanza');
const palace = data.machines.find((m) => m.id === 'palace');
const nodes = data.familyTree.nodes;
const nodeIds = nodes.map((n) => n.id);
const upgrade = (id) => data.upgrades.find((u) => u.id === id);
// Old Clunky has one row, so its payline is simply row 0 of every reel.
const row0 = (grid) => grid.map((column) => column[0]);
// Let the spin that's running land (spins take a few seconds since milestone 7).
const land = (g) => g.update(g.getSpinDuration() + 0.05);
// Upgrades a machine sells (hamster upgrades too), of one effect type.
const soldOn = (m, type) => data.upgrades.filter((u) => u.effect.type === type && (u.scope === 'global' || !u.machines || u.machines.includes(m.id)));
// Every luck upgrade a machine can use, maxed: { clover: 10, horseshoe: 10 }.
const maxLuckLevels = (m) => Object.fromEntries(soldOn(m, 'luck').map((u) => [u.id, u.maxLevel]));
// Buy every level of every luck upgrade the active machine can use (debug coins).
function maxLuck(g) {
  g.addCoins(1e15);
  for (const u of soldOn(g.getMachineData(), 'luck')) g.buyUpgrade(u.id, Infinity);
}

// A game that already owns the Snack Stacker and is running it.
function gameOnStacker(seed = 1, coins = 1e7) {
  const g = newGame(seed);
  g.addCoins(coins);
  g.buyMachine('stacker');
  return g;
}

// A game that owns a machine (bought with debug coins) and is running it.
function gameOn(machineId, seed = 1, coins = 1e9) {
  const g = newGame(seed);
  g.addCoins(coins);
  if (machineId !== 'clunky') g.buyMachine(machineId);
  return g;
}

// Every payline count a machine can reach (Extra Paylines add lines in steps).
function reachableLines(m) {
  const all = allPaylines(m).length;
  const ups = data.upgrades.filter((u) => u.effect.type === 'extraPayline' && (!u.machines || u.machines.includes(m.id)));
  const out = [m.startLines || all];
  for (const u of ups) for (let l = 1; l <= u.maxLevel; l++) out.push(Math.min(all, (m.startLines || all) + l * u.effect.linesPerLevel));
  return [...new Set(out)];
}

// The wild weights a machine can have: its listed weight, plus each Hamster Wild level.
function wildWeights(m) {
  const wild = m.symbols.find((s) => s.wild);
  if (!wild) return [null];
  const up = data.upgrades.find((u) => u.effect.type === 'symbolWeight' && u.effect.symbol === wild.id && (!u.machines || u.machines.includes(m.id)));
  const out = [wild.weight];
  if (up) for (let l = 1; l <= up.maxLevel; l++) out.push(wild.weight + l * up.effect.perLevel);
  return out;
}
const withWild = (m, weight) => (weight === null ? m : { ...m, symbols: m.symbols.map((s) => (s.wild ? { ...s, weight } : s)) });

// The symbol unlock levels a machine can have: 0 (the fresh machine) … every symbol.
function unlockLevels(m) {
  const up = soldOn(m, 'unlockSymbol')[0];
  return up ? Array.from({ length: up.maxLevel + 1 }, (_, i) => i) : [0];
}
// The machine's data with only the symbols a given unlock level opens (locked = weight 0).
function withUnlocks(m, level) {
  const up = soldOn(m, 'unlockSymbol')[0];
  const open = up ? up.effect.symbols.slice(0, level) : [];
  return { ...m, symbols: m.symbols.map((s) => (s.locked && !open.includes(s.id) ? { ...s, weight: 0 } : s)) };
}

// One game that owns every machine, used to ask "what would the reels land on
// with these levels?" (game.getSymbols with overrides) for any setup.
const probe = newGame(999);
probe.addCoins(1e15);
for (const m of data.machines.slice(1)) probe.buyMachine(m.id);
const probeMachine = (m) => probe.state.machines.find((x) => x.typeId === m.id);
// Every setup of a machine: reels × paylines × wild level × symbols unlocked, at Luck 0 or max Luck.
function setups(m, luck) {
  const out = [];
  const wildUp = soldOn(m, 'symbolWeight')[0];
  const unlock = soldOn(m, 'unlockSymbol')[0];
  for (let reels = m.startReels; reels <= m.maxReels; reels++) {
    for (const lines of reachableLines(m)) {
      for (let wild = 0; wild <= (wildUp ? wildUp.maxLevel : 0); wild++) {
        const ladder = unlockLevels(m).map((level) => {
          const o = { ...(luck === 'max' ? maxLuckLevels(m) : {}) };
          if (wildUp) o[wildUp.id] = wild;
          if (unlock) o[unlock.id] = level;
          const md = { ...m, symbols: probe.getSymbols(o, probeMachine(m)) };
          return { level, md, value: spinExpectation(md, reels, { lines }) };
        });
        out.push({ reels, lines, wild, ladder, label: `${m.name}, ${reels} reels, ${lines} line${lines === 1 ? '' : 's'}${wildUp ? `, wild Lv ${wild}` : ''}${luck === 'max' ? ', max Luck' : ''}` });
      }
    }
  }
  return out;
}

// A game that owns every family tree node once (Family Fortune at level 1).
// Seeds are added with the debug helper so the heirloom bonus stays 0.
function gameWithWholeTree(seed = 1) {
  const g = newGame(seed);
  g.addSeeds(10000);
  for (const id of nodeIds) g.buyTreeNode(id);
  return g;
}

// ─────────────────────────────────────────────────────────────
section('data.json sanity');
{
  const knownTypes = ['payoutMultiplier', 'autoSpin', 'spinCostMultiplier', 'extraReel', 'extraPayline',
    'betSteps', 'winStreak', 'symbolWeight', 'extraFreeSpins', 'jackpotGrowth', 'luck', 'unlockSymbol'];
  const treeTypes = ['payoutMultiplier', 'shiftWeight', 'fullLineMultiplier', 'startingLevel', 'spinSpeed',
    'deliveryTime', 'deliveryPayoutBonus', 'autoDelivery'];
  check('every upgrade has a known effect type', data.upgrades.every((u) => knownTypes.includes(u.effect.type)));
  check('every tree node has a known effect type', nodes.every((n) => treeTypes.includes(n.effect.type)),
    nodes.filter((n) => !treeTypes.includes(n.effect.type)).map((n) => n.id).join(', '));
  const allIds = [...data.upgrades.map((u) => u.id), ...nodeIds];
  check('upgrade and tree ids are all unique', new Set(allIds).size === allIds.length);
  const branchIds = data.familyTree.branches.map((b) => b.id);
  check('every tree node is on a listed branch', nodes.every((n) => branchIds.includes(n.branch)));
  // "requires" may only point at nodes listed EARLIER, which also rules out loops.
  check('tree requires only point at earlier nodes (no loops)',
    nodes.every((n, i) => n.requires.every((r) => nodeIds.slice(0, i).includes(r))));
  check('exactly one tree node has no requirements (the root)', nodes.filter((n) => n.requires.length === 0).length === 1);
  check('startingLevel effects name real upgrades',
    nodes.filter((n) => n.effect.type === 'startingLevel').every((n) => data.upgrades.some((u) => u.id === n.effect.upgrade)));
  const symbolIds = clunky.symbols.map((s) => s.id);
  check('shiftWeight effects name real symbols',
    nodes.filter((n) => n.effect.type === 'shiftWeight').every((n) => symbolIds.includes(n.effect.from) && symbolIds.includes(n.effect.to)));
  check('every tree node costs at least 1 seed', nodes.every((n) => n.baseCost >= 1));
  check('every upgrade scope is global or machine', data.upgrades.every((u) => ['global', 'machine'].includes(u.scope)));
  // A symbol may start at weight 0 only if an upgrade raises it (the Stacker's Hamster Wild).
  const raised = (m, s) => data.upgrades.some((u) => u.effect.type === 'symbolWeight' && u.effect.symbol === s.id && (!u.machines || u.machines.includes(m.id)));
  check('every symbol has a positive weight (or an upgrade raises it from 0)',
    data.machines.every((m) => m.symbols.every((s) => s.weight > 0 || (s.weight === 0 && raised(m, s)))));
  check('every line symbol has a payout table; scatters and blanks have none',
    data.machines.every((m) => m.symbols.every((s) => (s.scatter || s.blank ? !m.payouts[s.id] : !!m.payouts[s.id]))));
  // The exact hit-rate count in machine.js relies on every 2-match paying something.
  check('every line symbol\'s 2-match pays (wilds too)', data.machines.every((m) => m.symbols.every((s) => s.scatter || s.blank || m.payouts[s.id]['2'] > 0)));
  check('at most one wild per machine, and no symbol is two kinds at once (wild, scatter, blank)',
    data.machines.every((m) => m.symbols.filter((s) => s.wild).length <= 1 && m.symbols.every((s) => [s.wild, s.scatter, s.blank].filter(Boolean).length <= 1)));

  // Milestone 7: the blank, symbols you unlock, Luck.
  check('every machine has exactly one blank (the Wood Shaving), with a weight, never locked',
    data.machines.every((m) => m.symbols.filter((s) => s.blank).length === 1 && m.symbols.filter((s) => s.blank).every((s) => s.weight > 0 && !s.locked)));
  const unlocks = data.upgrades.filter((u) => u.effect.type === 'unlockSymbol');
  check('symbol unlocks are one-per-machine machine upgrades, one level per symbol in their list',
    unlocks.every((u) => u.scope === 'machine' && u.machines && u.machines.length === 1 && u.maxLevel === u.effect.symbols.length));
  check('every locked symbol is opened by exactly one unlock sold on its machine, and unlocks only list locked symbols',
    data.machines.every((m) => m.symbols.filter((s) => s.locked).every((s) => soldOn(m, 'unlockSymbol').filter((u) => u.effect.symbols.includes(s.id)).length === 1))
    && unlocks.every((u) => u.machines.every((id) => u.effect.symbols.every((sym) => data.machines.find((m) => m.id === id).symbols.some((s) => s.id === sym && s.locked)))));
  check('only plain line symbols can be locked (not wilds, scatters or blanks), and every machine starts with some',
    data.machines.every((m) => m.symbols.every((s) => !s.locked || (!s.wild && !s.scatter && !s.blank)) && m.symbols.some((s) => !s.locked && !s.blank && !s.scatter && s.weight > 0)));
  const lucks = data.upgrades.filter((u) => u.effect.type === 'luck');
  check('Hamster Luck (a hamster upgrade) exists, and every machine sells its own Machine Luck',
    lucks.some((u) => u.scope === 'global') && data.machines.every((m) => lucks.some((u) => u.scope === 'machine' && u.machines && u.machines.includes(m.id))));
  check('luck upgrades have a max level and add positive Luck', lucks.every((u) => u.maxLevel > 0 && u.effect.perLevel > 0));
  check('Wheel Training rests between auto-spins (autoSpin "rest" > 0)', data.upgrades.filter((u) => u.effect.type === 'autoSpin').every((u) => u.effect.rest > 0));
  check('free spins and the jackpot wheel each name a scatter symbol of their machine',
    data.machines.every((m) => ['freeSpins', 'jackpot'].every((f) => !m[f] || m.symbols.some((s) => s.id === m[f].symbol && s.scatter))));
  check('every scatter symbol starts something (free spins or the jackpot wheel)',
    data.machines.every((m) => m.symbols.filter((s) => s.scatter).every((s) => [m.freeSpins, m.jackpot].some((f) => f && f.symbol === s.id))));
  check('jackpot pots have a positive weight and seed, and growth >= 0',
    data.machines.every((m) => !m.jackpot || m.jackpot.pots.every((p) => p.weight > 0 && p.seed > 0 && p.growth >= 0)));
  check('symbolWeight upgrades name a symbol of every machine that sells them',
    data.upgrades.filter((u) => u.effect.type === 'symbolWeight')
      .every((u) => (u.machines || []).every((id) => data.machines.find((m) => m.id === id).symbols.some((s) => s.id === u.effect.symbol))));
  check('extraFreeSpins / jackpotGrowth upgrades are only sold on machines with that feature',
    data.upgrades.filter((u) => u.effect.type === 'extraFreeSpins').every((u) => u.machines.every((id) => data.machines.find((m) => m.id === id).freeSpins))
    && data.upgrades.filter((u) => u.effect.type === 'jackpotGrowth').every((u) => u.machines.every((id) => data.machines.find((m) => m.id === id).jackpot)));

  // Bets
  const steps = data.betSteps;
  check('betSteps start at x1 and go up', steps[0] === 1 && steps.every((b, i) => i === 0 || b > steps[i - 1]));
  const stepUps = data.upgrades.filter((u) => u.effect.type === 'betSteps').reduce((sum, u) => sum + u.maxLevel * u.effect.stepsPerLevel, 0);
  check('High Roller unlocks exactly every bet step', stepUps === steps.length - 1, stepUps);
  check('the gamble has a round limit, an offer time and a card history', data.gamble.maxRounds >= 1 && data.gamble.offerSeconds > 0 && data.gamble.history >= 1);

  // Machines
  const machineIds = data.machines.map((m) => m.id);
  check('machine ids are unique', new Set(machineIds).size === machineIds.length);
  check('the first machine is free (unlockCost 0)', (data.machines[0].unlockCost || 0) === 0);
  check('every other machine has a price', data.machines.slice(1).every((m) => m.unlockCost > 0));
  check('machine-only upgrades name real machines and are machine-scoped',
    data.upgrades.filter((u) => u.machines).every((u) => u.scope === 'machine' && u.machines.every((id) => machineIds.includes(id))));
  for (const m of data.machines) {
    const lines = allPaylines(m);
    check(`${m.name}: every payline gives a row for every reel, inside the grid`,
      lines.every((l) => l.length >= m.maxReels && l.every((row) => Number.isInteger(row) && row >= 0 && row < rowCount(m))));
    check(`${m.name}: startLines fits the list of paylines`, !m.startLines || (m.startLines >= 1 && m.startLines <= lines.length));
    // Every extra reel (and payline) this machine sells must fit exactly.
    const sold = data.upgrades.filter((u) => u.scope === 'global' || !u.machines || u.machines.includes(m.id));
    const extraReels = sold.filter((u) => u.effect.type === 'extraReel').reduce((sum, u) => sum + u.maxLevel * u.effect.reelsPerLevel, 0);
    check(`${m.name}: extra reel upgrades add up to maxReels - startReels`, extraReels === m.maxReels - m.startReels, extraReels);
    const extraLines = sold.filter((u) => u.effect.type === 'extraPayline').reduce((sum, u) => sum + u.maxLevel * u.effect.linesPerLevel, 0);
    check(`${m.name}: extra payline upgrades add up to all its lines`, (m.startLines || lines.length) + extraLines === lines.length, extraLines);
  }
}

// ─────────────────────────────────────────────────────────────
section('win rule: count matches from the left');
{
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
}

// ─────────────────────────────────────────────────────────────
section('paylines: every line is read on its own, and the wins add up');
{
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
}

// ─────────────────────────────────────────────────────────────
section('upgrade cost formula: floor(baseCost x growthRate ^ owned)');
{
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
}

// ─────────────────────────────────────────────────────────────
section('buying upgrades');
{
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
}

// ─────────────────────────────────────────────────────────────
section('spinning, spin cost and timing');
{
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
}

// ─────────────────────────────────────────────────────────────
section('food delivery (the soft-lock safety net)');
{
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
}

// ─────────────────────────────────────────────────────────────
section('EV formula vs brute force (every possible line, wilds and scatters)');
{
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

  // The fast multi-line hit rate (machine.js gridHitRate) against every possible
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
}

// ─────────────────────────────────────────────────────────────
section('EV formula vs every line, and vs real spins (same RNG as the game)');
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

// ─────────────────────────────────────────────────────────────
section('balance rules (DESIGN.md section 9)');
{
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
}

// ─────────────────────────────────────────────────────────────
section('retirement: Heirloom Seeds');
{
  const r = data.retirement;
  const g = newGame(11);
  check('a new game is generation 1 with 0 seeds', g.state.generation === 1 && g.state.seeds === 0);
  check('cannot retire with 0 pending seeds', g.canRetire() === false && g.retire() === false);

  // Plain debug coins are NOT earnings, so they give no seeds.
  g.addCoins(1e6);
  check('debug coins do not count as earned', g.state.stats.coinsEarned === 0 && g.getPendingSeeds() === 0);
  g.addCoins(-g.state.coins);

  // Seeds formula: floor((lifetime earned / divisor) ^ exponent), so n seeds
  // need divisor × n^(1/exponent) coins (a cube root: 3 seeds = 27 × divisor).
  const coinsFor = (n) => r.seedDivisor * Math.pow(n, 1 / r.seedExponent);
  const earnTo = (target) => g.addCoins(target - g.state.stats.coinsEarned, true);
  earnTo(r.seedDivisor - 1);
  check(`just under ${r.seedDivisor} earned -> 0 seeds`, g.getPendingSeeds() === 0);
  earnTo(r.seedDivisor);
  check(`${r.seedDivisor} earned -> 1 seed`, g.getPendingSeeds() === 1);
  earnTo(coinsFor(3));
  check(`${Math.round(coinsFor(3))} earned -> exactly 3 seeds (an exact power must not round down)`, g.getPendingSeeds() === 3);
  const prog = g.getSeedProgress();
  check(`seed progress: the next seed at ${Math.round(coinsFor(4))}`, prog.total === 3 && near(prog.nextAt, coinsFor(4), 1e-6) && prog.progress < 1e-9);

  // Buy some upgrades, spin, start a delivery, then retire.
  g.addCoins(5000);
  g.buyUpgrade('wheel');
  g.buyUpgrade('thirdReel');
  g.buyUpgrade('cheeks');
  g.spin();
  const lifetimeBefore = g.state.stats.coinsEarned;
  const spinsBefore = g.state.stats.spins;
  const events = [];
  g.on('retired', (e) => events.push(e));
  check('retire succeeds', g.retire() === true);
  check('retire pays the pending seeds', g.state.seeds === 3 && g.state.seedsEarned === 3);
  check('retire: generation 2 with the next pup name', g.state.generation === 2 && g.getPupName() === r.pupNames[1]);
  check('retired event has old/new names and seeds', events[0] && events[0].oldName === r.pupNames[0] && events[0].newName === r.pupNames[1] && events[0].seedsGained === 3);
  check('retire resets coins to startCoins', g.state.coins === data.startCoins);
  check('retire resets upgrades and the Third Reel', g.getUpgradeLevel('wheel') === 0 && g.getUpgradeLevel('cheeks') === 0 && g.getReelCount() === 2);
  check('retire clears the spin in progress', g.state.machines[0].spinning === false && g.state.machines[0].result === null);
  check('retire resets this life\'s totals', g.state.run.coinsEarned === 0 && g.state.run.playTime === 0);
  check('retire keeps lifetime stats', g.state.stats.coinsEarned === lifetimeBefore && g.state.stats.spins === spinsBefore);
  check('right after retiring, 0 seeds are pending', g.getPendingSeeds() === 0 && g.canRetire() === false);
  check(`heirloom bonus: 3 seeds earned -> +${(3 * r.payoutBonusPerSeedEarned * 100).toFixed(0)}% payouts`,
    near(g.getPayoutMultiplier(), 1 + 3 * r.payoutBonusPerSeedEarned, 1e-9));

  // Same coins, same seeds: retiring in two steps gives exactly the seeds of one big retirement.
  const a = newGame();
  a.addCoins(coinsFor(5), true);
  a.retire();
  const b = newGame();
  b.addCoins(coinsFor(2), true);
  b.retire();
  b.addCoins(coinsFor(5) - coinsFor(2), true);
  b.retire();
  check('retiring often gives no extra seeds (lifetime formula)', a.state.seedsEarned === 5 && b.state.seedsEarned === 5,
    `${a.state.seedsEarned} vs ${b.state.seedsEarned}`);

  // Real earnings count: spin wins and deliveries.
  const e = newGame(12);
  e.addCoins(1e5);
  for (let i = 0; i < 200; i++) { e.spin(); land(e); }
  e.startDelivery();
  e.update(data.delivery.duration + 1);
  check('spin wins + deliveries = coins earned', near(e.state.stats.coinsEarned, e.state.stats.coinsWon + e.state.stats.deliveryCoins, 0.001)
    && e.state.stats.coinsEarned > 0 && e.state.run.coinsEarned === e.state.stats.coinsEarned);
}

// ─────────────────────────────────────────────────────────────
section('family tree: buying nodes');
{
  const g = newGame(13);
  check('cannot buy a node with no seeds', g.buyTreeNode('familyPride') === false);
  g.addSeeds(5);
  check('cannot buy a node before its requirement', g.isTreeNodeUnlocked('luckyWhiskers') === false && g.buyTreeNode('luckyWhiskers') === false);
  check('unknown node id is refused', g.buyTreeNode('nope') === false);
  check('buy the root node', g.buyTreeNode('familyPride') === true && g.state.seeds === 4);
  check('root unlocks the branches', g.isTreeNodeUnlocked('luckyWhiskers') && g.isTreeNodeUnlocked('warmUpLaps') && g.isTreeNodeUnlocked('speedyScooter'));
  check('single-level node cannot be bought twice', g.buyTreeNode('familyPride') === false);
  g.addSeeds(1000);
  const fortune = [];
  for (let i = 0; i < 4; i++) { fortune.push(g.getTreeCost('familyFortune')); g.buyTreeNode('familyFortune'); }
  check('Family Fortune costs 3, 4, 6, 10 (cost formula)', JSON.stringify(fortune) === '[3,4,6,10]', JSON.stringify(fortune));
  check('tree levels are stored in state.tree', g.state.tree.familyPride === 1 && g.state.tree.familyFortune === 4);

  // The tree survives retirement.
  g.addCoins(data.retirement.seedDivisor, true);
  g.retire();
  check('tree nodes are kept after retiring', g.getTreeLevel('familyPride') === 1 && g.getTreeLevel('familyFortune') === 4);
  check('tree preview: Family Fortune now -> next', g.previewTreeNode('familyFortune').next > g.previewTreeNode('familyFortune').now);
  check('tree preview: owned single-level node has next = null', g.previewTreeNode('familyPride').next === null);
}

// ─────────────────────────────────────────────────────────────
section('family traits (tree effects)');
{
  const buy = (g, ...ids) => { g.addSeeds(1000); for (const id of ids) g.buyTreeNode(id); };

  // Family Pride multiplies with Chubby Cheeks instead of adding to it.
  const p = newGame();
  p.addCoins(1000);
  p.buyUpgrade('cheeks');
  p.buyUpgrade('cheeks');
  buy(p, 'familyPride');
  check('Family Pride x Chubby Cheeks: 1.5 x 1.25 = 1.875', p.getPayoutMultiplier() === 1.875, p.getPayoutMultiplier());

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
  const mult = j.getPayoutMultiplier();
  let ok = true;
  let fullLines = 0;
  j.buyUpgrade('newSeeds', Infinity);
  j.buyUpgrade('thirdReel');
  j.on('spinResolved', (e) => {
    const r = evaluate(row0(e.result), clunky.payouts, symbolRules(clunky));
    const expected = roundMoney(r.basePayout * (e.fullLine ? 1.5 : 1) * mult);
    if (e.payout !== expected) ok = false;
    if (e.fullLine && e.payout > 0) fullLines++;
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
  check('the next Wheel Training level costs the Lv 1 price (formula uses owned levels)', s.getUpgradeCost('wheel') === costAtLevel(upgrade('wheel'), 1));
  buy(s, 'quickPaws', 'heirloomReel');
  check('Heirloom Reel gives 3 reels right away', s.getReelCount() === 3);
  s.addCoins(data.retirement.seedDivisor, true);
  s.retire();
  check('after retiring: Wheel Training Lv 1 and 3 reels for free', s.getUpgradeLevel('wheel') === 1 && s.getReelCount() === 3);
  check('the free level never lowers a bought one', (() => {
    s.addCoins(1e4); s.buyUpgrade('wheel'); s.buyUpgrade('wheel');
    s.buyTreeNode('familyFortune'); // triggers applyStartingLevels again
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
  check('without Big Backpack, reward ignores payout bonuses', d.getDeliveryReward() === data.delivery.reward);
  buy(d, 'bigBackpack');
  check(`Big Backpack: reward = ${data.delivery.reward} x payout multiplier`, d.getDeliveryReward() === roundMoney(data.delivery.reward * d.getPayoutMultiplier()));
  d.startDelivery();
  d.update(trip + 0.1);
  check(`a ${trip} s delivery finishes on time and pays the boosted reward`,
    d.state.delivery.active === false && d.state.stats.deliveryCoins === d.getDeliveryReward());
  d.addCoins(-d.state.coins);
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
}

// ─────────────────────────────────────────────────────────────
section('determinism: frame size must not change the outcome');
{
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
    g.addCoins(-g.state.coins); // broke, so Self-Starter kicks in
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
  check('coins stay rounded to cents', Math.abs(g.state.coins * 100 - Math.round(g.state.coins * 100)) < 1e-6);
}

// ─────────────────────────────────────────────────────────────
section('saving and loading');
{
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
  check('load clamps negative coins to 0', g3.state.coins === 0);
  check('load discards an invalid spin result', g3.state.machines[0].result === null && !g3.state.machines[0].spinning);

  const g4 = newGame();
  check('load rejects null', g4.loadSaveData(null) === false);
  check('load rejects unknown saveVersion', g4.loadSaveData({ saveVersion: 999 }) === false);
  check('failed load leaves a fresh game', g4.state.coins === data.startCoins);

  // Family data round-trips, and junk tree data is cleaned.
  const f = newGame(14);
  f.addCoins(data.retirement.seedDivisor * 16, true);
  f.retire();
  f.buyTreeNode('familyPride');
  f.buyTreeNode('speedyScooter');
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
  check('load clamps seeds >= 0 and generation >= 1', f3.state.seeds === 0 && f3.state.generation === 1);
}

// ─────────────────────────────────────────────────────────────
section('save migration: v1 -> v2');
{
  // A save exactly as milestone 1 wrote it (saveVersion 1, no family data).
  const v1 = {
    saveVersion: 1, coins: 321.5, upgrades: { wheel: 2, cheeks: 3 },
    machines: [{ typeId: 'clunky', upgrades: { lever: 1 }, spinning: false, spinTimer: 0, result: ['seed', 'seed'] }],
    activeMachine: 0, delivery: { active: true, timer: 12 }, autoTimer: 0.5,
    stats: { spins: 40, manualSpins: 30, autoSpins: 10, wins: 17, coinsWon: 900, coinsSpent: 200, deliveries: 2, deliveryCoins: 30, upgradesBought: 6, playTime: 400 },
  };
  const g = newGame();
  check('a v1 save loads', g.loadSaveData(v1) === true);
  check('v1 progress is kept', g.state.coins === 321.5 && g.getUpgradeLevel('wheel') === 2 && g.getUpgradeLevel('lever') === 1);
  check('v1 -> v2: generation 1, no seeds, empty tree', g.state.generation === 1 && g.state.seeds === 0 && deepEqual(g.state.tree, {}));
  check('v1 -> v2: past wins + deliveries count as earned', g.state.stats.coinsEarned === 930 && g.state.run.coinsEarned === 930);
  check('v1 -> v2: a delivery in progress keeps going', g.state.delivery.active === true && g.state.delivery.timer === 12);
  check('v1 -> v5: the old one-row result becomes a grid', deepEqual(g.state.machines[0].result, [['seed'], ['seed']]));
  check('v1 -> v7: the old machine keeps every symbol it had (New Seeds maxed, nothing locked)',
    g.getUpgradeLevel('newSeeds') === upgrade('newSeeds').maxLevel && clunky.symbols.every((s) => !g.isSymbolLocked(s.id)));
  check(`the migrated save is written as the current version (v${SAVE_VERSION})`, g.toSaveData().saveVersion === SAVE_VERSION);
  check('v1 -> v3: past goals are awarded as diary stickers', g.state.diary.firstSpin === true && g.state.tokens > 0);
}

// ─────────────────────────────────────────────────────────────
section('save migration: v3 -> v4');
{
  const g = newGame(51);
  g.addCoins(100);
  const v3 = JSON.parse(JSON.stringify(g.toSaveData()));
  v3.saveVersion = 3;
  delete v3.stats.biggestWin;
  delete v3.stats.offlineCoins;
  const g2 = newGame();
  check('a v3 save loads', g2.loadSaveData(v3) === true);
  check('v3 -> v4: new stats start at 0', g2.state.stats.biggestWin === 0 && g2.state.stats.offlineCoins === 0);
  check('v3 -> v4: everything else is kept', g2.state.coins === g.state.coins);
}

// ─────────────────────────────────────────────────────────────
section('save migration: v4 -> v5');
{
  // A save as milestone 4 wrote it: one machine, a one-row result, no new stats.
  const g = newGame(54);
  g.addCoins(upgrade('thirdReel').baseCost);
  g.buyUpgrade('thirdReel');
  const v4 = JSON.parse(JSON.stringify(g.toSaveData()));
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
  check('the migrated spin lands and is scored', paid !== null && paid.payout === 0 && g2.getReelCount() === 3);
}

// ─────────────────────────────────────────────────────────────
section('win tiers (how big a win feels)');
{
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
}

// ─────────────────────────────────────────────────────────────
section('offline earnings');
{
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
}

// ─────────────────────────────────────────────────────────────
section('save migration: v2 -> v3');
{
  // A save as milestone 2 wrote it (family data, no tokens or skins).
  const v2 = {
    saveVersion: 2, coins: 50, upgrades: {}, machines: [{ typeId: 'clunky', upgrades: { thirdReel: 1 }, spinning: false, spinTimer: 0, result: null }],
    activeMachine: 0, delivery: { active: false, timer: 0, duration: 0 }, autoTimer: 0,
    run: { coinsEarned: 10, playTime: 5 }, generation: 3, seeds: 2, seedsEarned: 6, tree: { familyPride: 1 },
    stats: { spins: 150, manualSpins: 150, autoSpins: 0, wins: 60, coinsWon: 50000, coinsSpent: 750, deliveries: 3, deliveryCoins: 45, coinsEarned: 50045, upgradesBought: 9, playTime: 3000 },
  };
  const g = newGame();
  check('a v2 save loads', g.loadSaveData(v2) === true);
  check('v2 family data is kept', g.state.generation === 3 && g.state.seeds === 2 && g.state.tree.familyPride === 1);
  check('v2 -> v3: no skins, starters equipped', Object.keys(g.state.skins.owned).length === 0 && g.getEquippedSkin('fur') === 'furClassic');
  const expected = ['firstSpin', 'firstWin', 'firstDelivery', 'spins100', 'thirdReel', 'firstRetirement'];
  check('v2 -> v3: stickers already reached are awarded on load', expected.every((id) => g.state.diary[id] === true),
    JSON.stringify(g.state.diary));
  const tokens = data.diary.filter((d) => expected.includes(d.id)).reduce((sum, d) => sum + d.tokens, 0);
  check(`v2 -> v3: those stickers pay ${tokens} tokens`, g.state.tokens === tokens && g.state.stats.tokensEarned === tokens, g.state.tokens);
}

// ─────────────────────────────────────────────────────────────
section('data.json sanity: tokens, capsules, skins, diary');
{
  const cats = data.skinCategories.map((c) => c.id);
  const rarities = data.capsules.rarities.map((r) => r.id);
  check('every skin is in a listed category', data.skins.every((s) => cats.includes(s.category)));
  check('every skin rarity is "starter" or a capsule rarity', data.skins.every((s) => s.rarity === 'starter' || rarities.includes(s.rarity)));
  check('every category has exactly one starter skin',
    cats.every((c) => data.skins.filter((s) => s.category === c && s.rarity === 'starter').length === 1));
  check('every capsule rarity has at least one skin', rarities.every((r) => data.skins.some((s) => s.rarity === r)));
  check('the pity rarity is a real rarity', rarities.includes(data.capsules.pityRarity));
  const skinIds = data.skins.map((s) => s.id);
  check('skin ids are unique', new Set(skinIds).size === skinIds.length);
  const stickerIds = data.diary.map((d) => d.id);
  check('diary ids are unique', new Set(stickerIds).size === stickerIds.length);
  const goalTypes = ['stat', 'upgradeLevel', 'generation', 'treeNodes', 'skinsOwned', 'machinesOwned'];
  check('"machinesOwned" goals are reachable', data.diary.filter((d) => d.goal.type === 'machinesOwned').every((d) => d.goal.target <= data.machines.length));
  check('every diary goal has a known type', data.diary.every((d) => goalTypes.includes(d.goal.type)));
  const statKeys = Object.keys(newGame().state.stats);
  check('"stat" goals name real stats', data.diary.filter((d) => d.goal.type === 'stat').every((d) => statKeys.includes(d.goal.stat)));
  check('"upgradeLevel" goals are reachable',
    data.diary.filter((d) => d.goal.type === 'upgradeLevel').every((d) => {
      const u = data.upgrades.find((x) => x.id === d.goal.upgrade);
      return u && (u.maxLevel === null || d.goal.target <= u.maxLevel);
    }));
  check('"treeNodes" goals are reachable', data.diary.filter((d) => d.goal.type === 'treeNodes').every((d) => d.goal.target <= nodes.length));
  const poolSize = data.skins.filter((s) => s.rarity !== 'starter').length;
  check('"skinsOwned" goals are reachable', data.diary.filter((d) => d.goal.type === 'skinsOwned').every((d) => d.goal.target <= poolSize));
  check('every sticker pays at least 1 token', data.diary.every((d) => d.tokens >= 1));
  // The first capsule should come from early goals alone (before any luck).
  const early = ['firstSpin', 'firstWin', 'wheelTraining', 'spins100', 'thirdReel'];
  const earlyTokens = data.diary.filter((d) => early.includes(d.id)).reduce((sum, d) => sum + d.tokens, 0);
  check(`early stickers (${earlyTokens} tokens) pay for the first pull (${data.capsules.pullCost})`, earlyTokens >= data.capsules.pullCost);
}

// ─────────────────────────────────────────────────────────────
section('Hamster Tokens + the diary');
{
  const g = newGame(31);
  const stickers = [];
  g.on('stickerEarned', (e) => stickers.push(e.id));
  check('a new game has 0 tokens and no stickers', g.state.tokens === 0 && Object.keys(g.state.diary).length === 0);
  g.spin();
  land(g);
  check('first spin earns the "First Spin" sticker', stickers.includes('firstSpin') && g.state.diary.firstSpin === true);
  const tokensAfter = g.state.tokens;
  g.spin();
  land(g);
  check('a sticker is only awarded once', stickers.filter((id) => id === 'firstSpin').length === 1);
  check('tokens only change when a sticker/jackpot pays', g.state.tokens >= tokensAfter);
  g.addCoins(1000);
  g.buyUpgrade('wheel');
  check('buying Wheel Training earns "Look, No Paws!"', g.state.diary.wheelTraining === true);
  const p = g.getDiaryProgress('spins100');
  check('diary progress reports value / target', p.target === 100 && p.value === g.state.stats.spins && p.done === false);

  // Deliveries: every 5th pays a token.
  const d = newGame(32);
  const sources = [];
  d.on('tokensChanged', (e) => sources.push(e.source));
  for (let i = 0; i < 5; i++) {
    d.startDelivery();
    d.update(data.delivery.duration + 0.1);
  }
  check('the 5th delivery brings a token tip', sources.filter((s) => s === 'delivery').length === 1);

  // Retiring pays tokens.
  const r = newGame(33);
  r.addCoins(data.retirement.seedDivisor, true);
  const before = r.state.tokens;
  r.retire();
  check(`retiring pays ${data.tokens.perRetirement} tokens (+ the "Big Cage" sticker)`,
    r.state.tokens === before + data.tokens.perRetirement + data.diary.find((x) => x.id === 'firstRetirement').tokens);
  check('tokens are kept when retiring', r.state.tokens > 0);

  // Golden jackpots: only the jackpot symbol on EVERY reel, with 3+ reels.
  // (Max Luck and every symbol unlocked, so golden lines come often enough to count.)
  const j = newGame(34);
  maxLuck(j);
  j.buyUpgrade('newSeeds', Infinity);
  check('buying a symbol unlock counts toward "Fresh Seeds"', j.state.stats.symbolsUnlocked === upgrade('newSeeds').maxLevel && j.state.diary.newSeed === true);
  let paid = 0;
  let expected = 0;
  let twoReelGolden = 0;
  j.on('tokensChanged', (e) => { if (e.source === 'jackpot') paid++; });
  j.on('spinResolved', (e) => {
    if (e.result.length >= 3 && e.result.every((column) => column[0] === 'golden')) expected++;
    if (e.result.length === 2 && e.result.every((column) => column[0] === 'golden')) twoReelGolden++;
  });
  for (let i = 0; i < 2000; i++) { j.spin(); land(j); } // 2 reels: golden pairs, no tokens
  check('2-reel golden lines pay no jackpot token', twoReelGolden > 0 && paid === 0, `pairs=${twoReelGolden}`);
  j.buyUpgrade('thirdReel');
  for (let i = 0; i < 6000; i++) { j.spin(); land(j); }
  check(`3-reel golden jackpots pay 1 token each (${paid} of ${expected})`, expected > 0 && paid === expected && j.state.stats.goldenJackpots === expected);
}

// ─────────────────────────────────────────────────────────────
section('Capsule Machine + skins');
{
  const c = data.capsules;
  const g = newGame(41);
  check('starter skins are owned and equipped', g.isSkinOwned('furClassic') && g.getEquippedSkin('fur') === 'furClassic');
  check('cannot pull without tokens', g.canPull() === false && g.pullCapsule() === false);
  const opened = [];
  g.on('capsuleOpened', (e) => opened.push(e));
  g.addTokens(c.pullCost);
  const collectorTokens = data.diary.find((d) => d.id === 'firstCapsule').tokens;
  check('a pull costs pullCost tokens (the first one also earns "Capsule Collector")',
    g.pullCapsule() === true && g.state.tokens === collectorTokens + opened[0].refund);
  check('the pulled skin is owned now', g.isSkinOwned(opened[0].skinId) && g.getSkinDef(opened[0].skinId).rarity === opened[0].rarity);
  check('a pull never gives a starter skin', opened[0].rarity !== 'starter');
  check('pulled skin can be equipped', g.equipSkin(opened[0].skinId) === true
    && g.getEquippedSkin(g.getSkinDef(opened[0].skinId).category) === opened[0].skinId);
  check('an unowned skin cannot be equipped', (() => {
    const unowned = data.skins.find((s) => !g.isSkinOwned(s.id));
    return g.equipSkin(unowned.id) === false;
  })());

  // Odds over many pulls (debug tokens), and the pity rule.
  const o = newGame(42);
  o.addTokens(c.pullCost * 20000);
  const counts = {};
  let run = 0;
  let longestRun = 0;
  let dupes = 0;
  let refundsOk = true;
  o.on('capsuleOpened', (e) => {
    counts[e.rarity] = (counts[e.rarity] || 0) + 1;
    run = e.rarity === c.pityRarity ? 0 : run + 1;
    longestRun = Math.max(longestRun, run);
    if (e.duplicate) {
      dupes++;
      if (e.refund !== c.rarities.find((r) => r.id === e.rarity).duplicateRefund) refundsOk = false;
    }
  });
  const tokensBefore = o.state.tokens;
  for (let i = 0; i < 20000; i++) o.pullCapsule();
  const total = 20000;
  // Pity lifts the pity rarity above its listed chance; getCapsuleOdds() predicts by how much.
  for (const r of o.getCapsuleOdds()) {
    const share = (counts[r.id] || 0) / total;
    check(`${r.name}: ${(share * 100).toFixed(1)}% of pulls ~ ${(r.withPity * 100).toFixed(1)}% predicted with pity (listed ${(r.chance * 100).toFixed(0)}%)`,
      near(share, r.withPity, 0.01));
  }
  check(`pity: never ${c.pityPulls} pulls in a row without ${c.pityRarity} (longest ${longestRun})`, longestRun <= c.pityPulls - 1);
  check('duplicates refund their rarity\'s tokens', dupes > 0 && refundsOk);
  const refunds = o.state.tokens - (tokensBefore - total * c.pullCost);
  check('tokens spent = pulls x cost - refunds', refunds > 0 && o.state.stats.capsulesOpened === total);
  check('20,000 pulls collect every skin', data.skins.every((s) => o.isSkinOwned(s.id)));
  check('"Fashion Hamster" sticker for 8 skins', o.state.diary.fashion === true);

  // Pity counter: forced at exactly pityPulls - 1 misses.
  const p = newGame(43);
  p.loadSaveData({ ...p.toSaveData(), capsules: { sincePity: c.pityPulls - 1 } });
  check(`pity remaining shows 1 after ${c.pityPulls - 1} misses`, p.getPityRemaining() === 1);
  p.addTokens(c.pullCost);
  let forced = null;
  p.on('capsuleOpened', (e) => { forced = e; });
  p.pullCapsule();
  check('the pity pull is the pity rarity, then the counter resets', forced.rarity === c.pityRarity && forced.pity === true && p.state.capsules.sincePity === 0);

  // Save round trip with skins, and junk cleanup.
  const s = JSON.parse(JSON.stringify(g.toSaveData()));
  const g2 = newGame();
  g2.loadSaveData(s);
  check('skins and tokens round-trip through a save', deepEqual(g2.toSaveData(), s));
  const junk = structuredClone(s);
  junk.skins.owned.notASkin = true;
  junk.skins.owned.furClassic = true; // starters are never stored as "owned"
  junk.skins.equipped.room = 'roomSunflower'; // not owned
  junk.skins.equipped.fur = 'wheelGold'; // wrong category
  junk.tokens = -3;
  junk.capsules.sincePity = 999;
  const g3 = newGame();
  g3.loadSaveData(junk);
  check('load drops unknown/starter skins from "owned"', !('notASkin' in g3.state.skins.owned) && !('furClassic' in g3.state.skins.owned));
  check('load un-equips skins that are not owned or in the wrong slot',
    g3.getEquippedSkin('room') === 'roomClassic' && g3.getEquippedSkin('fur') !== 'wheelGold');
  check('load clamps tokens >= 0 and the pity counter', g3.state.tokens === 0 && g3.state.capsules.sincePity === c.pityPulls - 1);

  // Pulls are deterministic with the same seed.
  const pulls = (seed) => {
    const x = newGame(seed);
    x.addTokens(c.pullCost * 30);
    const got = [];
    x.on('capsuleOpened', (e) => got.push(e.skinId));
    for (let i = 0; i < 30; i++) x.pullCapsule();
    return got.join(',');
  };
  check('same seed, same capsules', pulls(77) === pulls(77) && pulls(77) !== pulls(78));
}

// ─────────────────────────────────────────────────────────────
section('machines: collect & switch');
{
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
}

// ─────────────────────────────────────────────────────────────
section('buying x10 and Max');
{
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
}

// ─────────────────────────────────────────────────────────────
section('wilds and scatters on a line');
{
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
}

// ─────────────────────────────────────────────────────────────
section('bets (denoms) and High Roller');
{
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
}

// ─────────────────────────────────────────────────────────────
section('Hamster Wild (the Snack Stacker)');
{
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
}

// ─────────────────────────────────────────────────────────────
section('free spins (Burrow Bonanza)');
{
  const g = gameOn('bonanza', 101);
  check('Burrow Bonanza: 5 reels x 3 rows, 5 of 10 paylines', g.getReelCount() === 5 && g.getRowCount() === 3 && g.getLineCount() === 5 && g.getMachineInfo('bonanza').maxLines === 10);
  const started = [];
  const resolved = [];
  const ended = [];
  g.on('spinStarted', (e) => started.push(e));
  g.on('spinResolved', (e) => resolved.push(e));
  g.on('freeSpinsEnded', (e) => ended.push(e));
  check('addFreeSpins (debug) gives free spins', g.addFreeSpins(5) === true && g.getFreeSpins().left === 5);
  check('a paid spin waits while free spins are waiting', g.spin() === false);
  const coins = g.state.coins;
  g.update(300);
  const n = started.length;
  check(`free spins play by themselves (no Wheel Training), cost nothing (${n} played)`, n >= 5 && started.every((e) => e.free && e.cost === 0 && e.source === 'free'));
  const mult = bonanza.freeSpins.multiplier;
  const payOk = resolved.every((e) => {
    const r = evaluateGrid(e.result, g.getPaylines(), bonanza.payouts, symbolRules(bonanza));
    return e.payout === roundMoney(r.wins.reduce((sum, w) => sum + roundMoney(w.basePayout * g.getPayoutMultiplier() * mult), 0));
  });
  check(`every free-spin win is x${mult}`, payOk && resolved.every((e) => e.free));
  const won = roundMoney(resolved.reduce((sum, e) => sum + e.payout, 0));
  check('when they are done: freeSpinsEnded with the spins and the total won', ended.length === 1 && ended[0].spins === n && near(ended[0].won, won, 0.011) && g.getFreeSpins() === null);
  check('coins only went up during free spins', near(g.state.coins, coins + won, 0.011));
  check('stats.freeSpins counts them (not as manual or auto spins)', g.state.stats.freeSpins === n && g.state.stats.manualSpins === 0 && g.state.stats.autoSpins === 0);
  check('free-spin wins never offer a gamble', g.getGambleInfo() === null);

  // The bet is frozen when free spins start.
  g.buyUpgrade('highRoller');
  g.setBet(1);
  g.addFreeSpins(2);
  g.setBet(0);
  const bets = [];
  g.on('spinStarted', (e) => bets.push(e.bet));
  g.update(30);
  check('free spins use the bet they were won at', bets.length >= 2 && bets.every((b) => b === 2));

  const a = gameOn('bonanza', 102);
  a.buyUpgrade('wheel', 10);
  a.addFreeSpins(10);
  a.update(a.getAutoInterval() + 5);
  check('auto-spin waits while free spins play', a.state.stats.autoSpins === 0 && a.state.stats.freeSpins > 0);

  const w = gameOn('bonanza', 103);
  w.addFreeSpins(3);
  w.switchMachine('clunky');
  w.update(10);
  check('free spins wait on their machine after a switch', w.getMachineInfo('bonanza').freeSpinsLeft === 3 && w.state.stats.freeSpins === 0);
  w.switchMachine('bonanza');
  w.update(120);
  check('… and play when you come back', w.getMachineInfo('bonanza').freeSpinsLeft === 0 && w.state.stats.freeSpins >= 3);

  const d = gameOn('bonanza', 104);
  d.startDelivery();
  d.addFreeSpins(2);
  d.update(5);
  check('no free spins while the hamster is out delivering', d.state.stats.freeSpins === 0);

  const ss = gameWithWholeTree(105);
  ss.addCoins(1e9);
  ss.buyMachine('bonanza');
  ss.addCoins(-ss.state.coins);
  ss.addFreeSpins(3);
  ss.update(0.2);
  check('Self-Starter waits while free spins are left', ss.state.delivery.active === false);

  // A long run: natural triggers, retriggers, and the time free spins take.
  // Max Luck makes Hamster Balls land more often, so there are enough to count.
  const r = gameOn('bonanza', 106, 1e12);
  maxLuck(r);
  r.buyUpgrade('wheel', 10);
  let triggers = 0;
  let retriggers = 0;
  let paid = 0;
  r.on('freeSpinsStarted', (e) => (e.retrigger ? retriggers++ : triggers++));
  r.on('spinStarted', (e) => { if (!e.free) paid++; });
  const T = 20000;
  r.update(T);
  const econ = r.getEconomy();
  const q = econ.freeSpins.chance;
  check(`free spins start on ${(triggers / paid * 100).toFixed(2)}% of paid spins ~ formula ${(q * 100).toFixed(2)}%`,
    near(triggers / paid, q, 4 * Math.sqrt((q * (1 - q)) / paid)));
  check(`retriggers happen (${retriggers})`, retriggers > 0);
  check(`${(r.state.stats.freeSpins / triggers).toFixed(1)} free spins per trigger (with retriggers) ~ formula ${econ.freeSpins.perTriggerWithRetriggers.toFixed(1)}`,
    near(r.state.stats.freeSpins / triggers, econ.freeSpins.perTriggerWithRetriggers, econ.freeSpins.perTriggerWithRetriggers * 0.15));
  const rate = 1 / (econ.autoInterval + econ.extraSecondsPerSpin);
  check(`paid spins a second ${(paid / T).toFixed(4)} ~ 1 / (interval + time in free spins) ${rate.toFixed(4)}`, near(paid / T, rate, rate * 0.03));
  check('"Free Ride" is awarded', r.state.diary.freeRide === true);
}

// ─────────────────────────────────────────────────────────────
section('the jackpot wheel and pots (Pouch Palace)');
{
  const jp = palace.jackpot;
  const g = gameOn('palace', 111);
  check('Pouch Palace: 5 reels, 10 of 20 lines, every pot at its seed', g.getReelCount() === 5 && g.getLineCount() === 10
    && g.getJackpotPots().every((p, i) => p.base === jp.pots[i].seed));
  g.spin();
  check('every paid spin grows every pot by its growth', g.getJackpotPots().every((p, i) => p.base === roundMoney(jp.pots[i].seed + jp.pots[i].growth)));
  land(g);
  g.buyUpgrade('pouchPolish');
  const growth = 1 + data.upgrades.find((u) => u.id === 'pouchPolish').effect.perLevel;
  const before = g.getJackpotPots().map((p) => p.base);
  g.spin();
  check('Pouch Polish makes the pots grow faster', g.getJackpotPots().every((p, i) => near(p.base, before[i] + jp.pots[i].growth * growth, 0.011)));
  land(g);
  check('the marquee value = pot x bet x payout multiplier', g.getJackpotPots().every((p) => p.value === roundMoney(p.base * g.getBet() * g.getPayoutMultiplier())));

  const won = [];
  const blocked = [];
  g.on('jackpotWon', (e) => won.push(e));
  g.on('spinBlocked', (e) => blocked.push(e.reason));
  const major = g.getJackpotPots().find((p) => p.id === 'major').base;
  check('triggerJackpot (debug) starts the wheel', g.triggerJackpot('major') === true && g.getBonusProgress() === 0);
  check('no spins while the wheel turns', g.spin() === false && blocked.includes('bonus'));
  g.update(1);
  check('the wheel\'s progress follows game time', near(g.getBonusProgress(), 1 / jp.duration, 0.02));
  const coins = g.state.coins;
  const earned = g.state.stats.coinsEarned;
  g.update(jp.duration);
  check('when it stops it pays pot x bet x payout multiplier', won.length === 1 && won[0].pot === 'major'
    && won[0].amount === roundMoney(major * g.getBet() * g.getPayoutMultiplier()) && near(g.state.coins, coins + won[0].amount, 0.011));
  check('… the pot goes back to its seed, and the win counts as earned', g.getJackpotPots().find((p) => p.id === 'major').base === jp.pots.find((p) => p.id === 'major').seed
    && near(g.state.stats.coinsEarned, earned + won[0].amount, 0.011));
  check('stats.jackpotsWon and "Pot Luck"', g.state.stats.jackpotsWon === 1 && g.state.diary.potLuck === true);
  g.triggerJackpot(jp.pots[jp.pots.length - 1].id);
  g.update(jp.duration + 0.1);
  check('the top pot counts as a Grand ("Grand Hamster")', g.state.stats.grandJackpots === 1 && g.state.diary.grandHamster === true);

  const r = gameOn('palace', 112);
  r.addCoins(data.retirement.seedDivisor * 4, true);
  r.triggerJackpot('mini');
  check('no retiring while the wheel turns (its pot would be lost)', r.canRetire() === false && r.retire() === false);
  r.update(jp.duration + 0.1);
  check('… but you can once it has paid', r.canRetire() === true);

  const s = gameOn('palace', 113);
  s.triggerJackpot('minor');
  s.switchMachine('clunky');
  const w2 = [];
  s.on('jackpotWon', (e) => w2.push(e));
  s.update(jp.duration + 0.1);
  check('the wheel still pays after a switch', w2.length === 1 && w2[0].machineId === 'palace');

  // A long run: trigger rate, which pot, and the long-run pot EV.
  // Max Luck makes Cheek Pouches land more often, so there are enough wheels to count.
  const n = gameOn('palace', 114, 1e14);
  maxLuck(n);
  n.buyUpgrade('wheel', 10);
  let paid = 0;
  const counts = {};
  const sums = {};
  const sumSqs = {};
  const scale = n.getBet() * n.getPayoutMultiplier();
  n.on('spinStarted', (e) => { if (!e.free) paid++; });
  n.on('jackpotWon', (e) => {
    const x = e.amount / scale; // back to base units
    counts[e.pot] = (counts[e.pot] || 0) + 1;
    sums[e.pot] = (sums[e.pot] || 0) + x;
    sumSqs[e.pot] = (sumSqs[e.pot] || 0) + x * x;
  });
  n.update(40000);
  const stats = jackpotStats({ ...palace, symbols: n.getSymbols() }, 5); // the weights the reels really used (Luck, locks)
  const wheels = Object.values(counts).reduce((a, b) => a + b, 0);
  check(`the wheel starts on ${(wheels / paid * 100).toFixed(2)}% of paid spins ~ formula ${(stats.q * 100).toFixed(2)}%`,
    near(wheels / paid, stats.q, 4 * Math.sqrt((stats.q * (1 - stats.q)) / paid)));
  const totalWeight = jp.pots.reduce((a, p) => a + p.weight, 0);
  for (const p of jp.pots.slice(0, 2)) {
    const share = (counts[p.id] || 0) / wheels;
    const expected = p.weight / totalWeight;
    check(`${p.name}: ${(share * 100).toFixed(1)}% of wheels ~ ${(expected * 100).toFixed(1)}%`, near(share, expected, 4 * Math.sqrt((expected * (1 - expected)) / wheels)));
    // The heart of the pot formula: a pot won with chance c a spin has been
    // growing for 1/c spins on average, so it holds seed + growth / c when won.
    const c = stats.pots.find((x) => x.id === p.id).chance;
    const mean = sums[p.id] / counts[p.id];
    const stderr = Math.sqrt(Math.max(0, sumSqs[p.id] / counts[p.id] - mean * mean) / counts[p.id]);
    check(`${p.name} holds ${mean.toFixed(0)} on average when won ~ seed + growth / chance = ${(p.seed + p.growth / c).toFixed(0)}`,
      near(mean, p.seed + p.growth / c, 4 * stderr));
  }
}

// ─────────────────────────────────────────────────────────────
section('the card gamble');
{
  // Spin by hand until a spin wins (and so offers the gamble).
  const manualWin = (game) => {
    for (let i = 0; i < 200; i++) {
      game.spin('manual');
      land(game);
      if (game.getGambleInfo()) return true;
    }
    return false;
  };
  const g = newGame(121);
  g.addCoins(1e6);
  const offers = [];
  const ends = [];
  let lastPayout = 0;
  g.on('gambleOffered', (e) => offers.push(e));
  g.on('gambleEnded', (e) => ends.push(e));
  g.on('spinResolved', (e) => { if (e.payout > 0) lastPayout = e.payout; });
  check('a win you pulled yourself offers the gamble for that win', manualWin(g) && offers.length === 1 && g.getGambleInfo().stake === lastPayout);
  g.update(data.gamble.offerSeconds + 0.1);
  check(`an untouched offer runs out after ${data.gamble.offerSeconds} s`, g.getGambleInfo() === null && ends.at(-1).reason === 'expired');
  manualWin(g);
  g.spin();
  check('spinning again closes the offer', g.getGambleInfo() === null && ends.at(-1).reason === 'spin');

  // A click queued during a winning manual spin doesn't close that spin's gamble offer.
  let found = false;
  for (let seed = 200; seed < 300 && !found; seed++) {
    const x = newGame(seed);
    x.addCoins(1e6);
    x.spin();
    x.spin(); // queued
    x.update(clunky.spinDuration + 0.05);
    if (!x.getGambleInfo()) continue;
    found = true;
    check('a click queued during a winning spin leaves its gamble offer open (the next tap decides)', x.state.stats.spins === 1);
    x.spin();
    check('… and the next tap spins on, closing the offer', x.state.stats.spins === 2 && x.getGambleInfo() === null);
  }
  check('(a seed whose first spin wins was found)', found);

  const a = newGame(122);
  a.addCoins(1e6);
  a.buyUpgrade('wheel', 10);
  let autoOffers = 0;
  a.on('gambleOffered', () => autoOffers++);
  a.update(300);
  check('auto-spin wins never offer a gamble', autoOffers === 0 && a.state.stats.wins > 0);

  const h = newGame(125);
  h.addCoins(1e6);
  h.buyUpgrade('wheel');
  manualWin(h);
  const auto0 = h.state.stats.autoSpins;
  h.update(data.gamble.offerSeconds - 0.5);
  check('auto-spin waits while a gamble offer is open', h.state.stats.autoSpins === auto0);

  const p = newGame(123);
  p.addCoins(1e6);
  manualWin(p);
  const stake = p.getGambleInfo().stake;
  const coins = p.state.coins;
  const earned = p.state.stats.coinsEarned;
  const res = [];
  p.on('gambleResolved', (e) => res.push(e));
  check('a pick must be a colour or a suit', p.gamble('middle') === false && p.gamble('left') === false && p.gamble('') === false);
  p.gamble('red');
  check('a colour pick wins +stake (×2) or loses the stake', res.length === 1 && res[0].multiplier === 2
    && (res[0].win ? p.state.coins === roundMoney(coins + stake) : p.state.coins === roundMoney(coins - stake)));
  check('the card is a real card of the deck, and red wins exactly on hearts and diamonds',
    SUITS.some((s) => s.id === res[0].card.suit && s.color === res[0].card.color) && res[0].win === (res[0].card.color === 'red'));
  check('gambling never changes coinsEarned (it can\'t farm Heirloom Seeds)', p.state.stats.coinsEarned === earned);
  if (p.getGambleInfo()) {
    const blocked = [];
    p.on('spinBlocked', (e) => blocked.push(e.reason));
    check('while a gamble is under way, spins wait ("gamble")', p.spin() === false && blocked[0] === 'gamble');
    check('you can always take the win', p.collectGamble() === true && p.getGambleInfo() === null);
  }

  // Fairness: 20,000 colour picks and 20,000 suit picks (debug offers, so it's quick).
  // Every card is a fresh draw, so both bets are exactly fair: on average they never pay.
  const f = newGame(124);
  f.addCoins(1e9);
  const coinsEarned0 = f.state.stats.coinsEarned;
  const tally = { color: { picks: 0, wins: 0, net: 0 }, suit: { picks: 0, wins: 0, net: 0 } };
  const suitsSeen = {};
  let prizesOk = true;
  let maxEnds = 0;
  let lastCard = null;
  f.on('gambleResolved', (e) => {
    const t = tally[['red', 'black'].includes(e.pick) ? 'color' : 'suit'];
    t.picks++;
    t.net += (e.win ? e.stake * (e.multiplier - 1) : -e.stake) / e.stake; // in stakes
    if (e.win) { t.wins++; if (e.next !== roundMoney(e.stake * e.multiplier)) prizesOk = false; }
    suitsSeen[e.card.suit] = (suitsSeen[e.card.suit] || 0) + 1;
    lastCard = e.card;
  });
  f.on('gambleEnded', (e) => { if (e.reason === 'max') maxEnds++; });
  const picksOf = { color: ['red', 'black'], suit: SUITS.map((s) => s.id) };
  for (const mode of ['color', 'suit']) {
    let i = 0;
    while (tally[mode].picks < 20000) {
      f.triggerGamble(10);
      while (f.getGambleInfo()) f.gamble(picksOf[mode][i++ % picksOf[mode].length]);
    }
  }
  for (const [mode, chance, mult] of [['color', 0.5, 2], ['suit', 0.25, 4]]) {
    const t = tally[mode];
    const sd = Math.sqrt(chance * (mult - 1) ** 2 + (1 - chance)); // the spread of one pick, in stakes
    check(`rule 4: ${(t.wins / t.picks * 100).toFixed(2)}% of ${t.picks} ${mode} picks win ~ ${chance * 100}% (fair)`,
      near(t.wins / t.picks, chance, 4 * Math.sqrt(chance * (1 - chance) / t.picks)));
    check(`rule 4: ${mode} picks pay back ${(t.net / t.picks * 100).toFixed(2)}% of the stakes on average ~ 0 (a fair bet)`,
      near(t.net / t.picks, 0, 4 * sd / Math.sqrt(t.picks)));
  }
  const draws = Object.values(suitsSeen).reduce((a, b) => a + b, 0);
  check(`every suit is drawn ~25% of the time (${SUITS.map((s) => `${s.id} ${((suitsSeen[s.id] || 0) / draws * 100).toFixed(1)}%`).join(', ')})`,
    SUITS.every((s) => near((suitsSeen[s.id] || 0) / draws, 0.25, 4 * Math.sqrt(0.1875 / draws))));
  check('a right colour doubles the stake, a right suit makes it ×4', prizesOk);
  check(`after ${data.gamble.maxRounds} wins in a row the gamble takes the win by itself`, maxEnds > 0);
  check('rule 4: gamble coins never count as earned', f.state.stats.coinsEarned === coinsEarned0);
  check('stats count gamble picks; "Double Trouble" after 3 wins in a row; "Card Shark" after a suit win',
    f.state.stats.gambleWins === tally.color.wins + tally.suit.wins && f.state.stats.gambleLosses === tally.color.picks + tally.suit.picks - tally.color.wins - tally.suit.wins
    && f.state.stats.suitWins === tally.suit.wins && f.state.diary.doubleTrouble === true && f.state.diary.cardShark === true);
  const history = f.getCardHistory();
  check(`the last ${data.gamble.history} cards are kept, newest first`, history.length === data.gamble.history && deepEqual(history[0], { suit: lastCard.suit, color: lastCard.color }));
  f.triggerGamble(10);
  const info = f.getGambleInfo();
  check('getGambleInfo shows both prizes and the card history', info.colorWin === 20 && info.suitWin === 40 && info.history.length === data.gamble.history);
  check('the Info tab gets the real odds', deepEqual(f.getFeatureOdds().gamble.color, { chance: 0.5, multiplier: 2 }) && deepEqual(f.getFeatureOdds().gamble.suit, { chance: 0.25, multiplier: 4 }));

  // Edge cases.
  const e = newGame(126);
  e.addCoins(1e6);
  manualWin(e);
  e.addCoins(-e.state.coins + e.getGambleInfo().stake / 2);
  check('you need the stake in your pile to gamble it', e.canGamble() === false && e.gamble('red') === false);
  const sv = newGame(127);
  sv.addCoins(1e6);
  manualWin(sv);
  check('an open gamble is not saved', !('gamble' in sv.toSaveData()));
  const re = newGame(128);
  re.addCoins(data.retirement.seedDivisor * 4, true);
  manualWin(re);
  re.gamble('black');
  if (re.getGambleInfo()) check('no retiring during a gamble', re.canRetire() === false && re.retire() === false);
  const sw = gameOn('stacker', 129);
  sw.switchMachine('clunky');
  manualWin(sw);
  sw.switchMachine('stacker');
  check('switching machine ends the gamble (keeping what it won)', sw.getGambleInfo() === null);
}

// ─────────────────────────────────────────────────────────────
section('Hot Streak');
{
  const g = newGame(131);
  g.addCoins(1e9);
  g.buyUpgrade('thirdReel');
  maxLuck(g); // wins in a row need a decent hit rate
  let prevStreak = 0;
  let ok = true;
  g.on('spinResolved', (e) => {
    if (e.streak !== (e.wins.length > 0 ? prevStreak + 1 : 0)) ok = false;
    prevStreak = e.streak;
  });
  for (let i = 0; i < 3000; i++) { g.spin(); land(g); }
  check('every machine counts winning paid spins in a row, and a loss resets it', ok && g.state.stats.bestStreak >= 3);
  check('"On Fire" for 5 wins in a row', g.state.stats.bestStreak >= 5 && g.state.diary.onFire === true);

  const h = newGame(132);
  h.addCoins(1e9);
  h.buyUpgrade('thirdReel');
  h.buyUpgrade('hotStreak', Infinity);
  const hs = data.upgrades.find((u) => u.id === 'hotStreak');
  const per = hs.effect.perStack * hs.maxLevel;
  check('Hot Streak maxed: the best bonus is x(1 + perStack x level x maxStacks)', near(h.getMaxStreakMultiplier(), 1 + per * hs.effect.maxStacks, 1e-12));
  let before = 0;
  let payOk = true;
  let sumMult = 0;
  let winsN = 0;
  h.on('spinResolved', (e) => {
    const mult = 1 + per * Math.min(before, hs.effect.maxStacks);
    const expected = roundMoney(e.wins.reduce((sum, w) => sum + roundMoney(w.basePayout * h.getPayoutMultiplier() * mult), 0));
    if (e.payout !== expected) payOk = false;
    if (e.wins.length) { sumMult += mult; winsN++; }
    before = e.streak;
  });
  for (let i = 0; i < 20000; i++) { h.spin(); land(h); }
  const econ = h.getEconomy();
  check('a winning spin pays x the streak bonus from the streak BEFORE it', payOk);
  check(`average bonus on wins x${(sumMult / winsN).toFixed(4)} ~ formula x${econ.streakFactor.toFixed(4)}`, near(sumMult / winsN, econ.streakFactor, 0.02));
  check('the economy counts Hot Streak in the EV', near(econ.ev, econ.lineEv * econ.streakFactor, 1e-9));

  const f = gameOn('bonanza', 133);
  f.buyUpgrade('hotStreak');
  f.addFreeSpins(6);
  const streak0 = f.state.machines[f.state.activeMachine].streak;
  f.update(120);
  check('free spins never touch the streak', f.state.machines[f.state.activeMachine].streak === streak0 && f.state.stats.freeSpins >= 6);
}

// ─────────────────────────────────────────────────────────────
section('saving with bets, bonus features, unlocks and Luck (v6, v7)');
{
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
    p3.getBetIndex() === 0 && pm.pots.mini === palace.jackpot.pots[0].seed && !('bogus' in pm.pots) && pm.bonus === null && pm.streak === 0);
  check('load drops free spins on a machine without them, and never loads a gamble',
    p3.state.machines.find((m) => m.typeId === 'clunky').freeSpins === null && p3.getGambleInfo() === null);
}

// ─────────────────────────────────────────────────────────────
section('save migration: v5 -> v6');
{
  const g = newGame(151);
  g.addCoins(8000);
  g.buyMachine('stacker');
  g.spin();
  g.update(0.3);
  const v5 = JSON.parse(JSON.stringify(g.toSaveData()));
  v5.saveVersion = 5;
  for (const m of v5.machines) for (const k of ['bet', 'streak', 'freeSpins', 'pots', 'bonus', 'spinBet', 'spinFree', 'spinSource']) delete m[k];
  for (const k of ['biggestBet', 'freeSpins', 'freeSpinTriggers', 'freeSpinCoins', 'wildWins', 'bestStreak', 'jackpotsWon', 'grandJackpots', 'gambleWins', 'gambleLosses', 'bestGambleRun']) delete v5.stats[k];
  const g2 = newGame();
  check('a v5 save loads', g2.loadSaveData(v5) === true);
  check('v5 -> v6: every machine bets x1 with no free spins or streak', g2.state.machines.every((m) => m.bet === 0 && m.freeSpins === null && m.streak === 0));
  check('v5 -> v6: the new stats start at 0', g2.state.stats.jackpotsWon === 0 && g2.state.stats.gambleWins === 0 && g2.state.stats.biggestBet === 0);
  check('v5 -> v6: a spin in progress keeps going (at x1)', g2.getMachineData().id === 'stacker' && g2.state.machines[1].spinning === true && g2.state.machines[1].spinBet === 1);
  check(`the migrated save is written as v${SAVE_VERSION}`, g2.toSaveData().saveVersion === SAVE_VERSION);
}

// ─────────────────────────────────────────────────────────────
section('save migration: v6 -> v7 (symbols you unlock)');
{
  // A v6 hamster had every symbol on every machine. After loading, it still has.
  const g = newGame(152);
  g.addCoins(1e9);
  g.buyMachine('stacker');
  g.buyMachine('bonanza');
  g.buyUpgrade('tunnelGrease', 2);
  const v6 = JSON.parse(JSON.stringify(g.toSaveData()));
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
  const fresh = JSON.parse(JSON.stringify(newGame().toSaveData()));
  const g3 = newGame();
  g3.loadSaveData(fresh);
  check('a v7 save is not migrated: its locked symbols stay locked', g3.isSymbolLocked('carrot') && g3.isSymbolLocked('golden'));
}

// ─────────────────────────────────────────────────────────────
section('Luck and symbols you unlock (in the game)');
{
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
}

// ─────────────────────────────────────────────────────────────
section('determinism with bets and bonus features');
{
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
}

// ─────────────────────────────────────────────────────────────
section('hot reload (debug "Reload data.json")');
{
  const g = newGame(10);
  g.addCoins(5000);
  for (let i = 0; i < 5; i++) g.buyUpgrade('wheel');
  const coins = g.state.coins;
  const newData = structuredClone(data);
  newData.upgrades.find((u) => u.id === 'wheel').maxLevel = 3;
  newData.machines[0].spinCost = 7;
  g.setData(newData);
  check('reload keeps coins', g.state.coins === coins);
  check('reload caps levels to the new maxLevel', g.getUpgradeLevel('wheel') === 3);
  check('reload applies new balance values', g.getSpinCost() === 7);
}

// ─────────────────────────────────────────────────────────────
section('economy summary (copy into DESIGN.md after balance changes)');
// Every setup: reels, paylines, wild level, and each step of the symbol unlocks
// (L0 = the fresh machine), at no Luck and at max Luck.
const fmtStep = (m, s) => `L${s.level} EV ${s.value.ev.toFixed(2)} RTP ${(s.value.ev / m.spinCost * 100).toFixed(1)}% hit ${(s.value.hitRate * 100).toFixed(1)}%`;
for (const m of data.machines) {
  for (const luck of ['zero', 'max']) {
    for (const s of setups(m, luck)) console.log(`${s.label}: ${s.ladder.map((step) => fmtStep(m, step)).join(' | ')}`);
  }
  // Where a paid spin's value comes from on the fresh and the fully unlocked machine (no Luck).
  for (const s of [setups(m, 'zero')[0], setups(m, 'zero').at(-1)]) {
    for (const step of [s.ladder[0], s.ladder.at(-1)]) {
      const r = step.value;
      const parts = [`lines ${r.lineEv.toFixed(2)}`];
      if (m.freeSpins) parts.push(`free spins ${r.freeSpins.ev.toFixed(2)} (1 in ${Math.round(1 / r.freeSpins.chance)}, ${r.freeSpins.perTriggerWithRetriggers.toFixed(1)} spins)`);
      if (m.jackpot) parts.push(`pots ${r.jackpot.ev.toFixed(2)} (wheel 1 in ${Math.round(1 / r.jackpot.chance)})`);
      console.log(`  ${s.label}, L${step.level}: EV ${r.ev.toFixed(2)} [${parts.join(', ')}] | profit/spin ${(r.ev - m.spinCost).toFixed(2)}`);
    }
  }
}
for (const m of data.machines.filter((x) => x.freeSpins)) {
  const extra = data.upgrades.filter((u) => u.effect.type === 'extraFreeSpins' && u.machines.includes(m.id)).reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0);
  const md = setups(m, 'zero').at(-1).ladder.at(-1).md;
  const r = spinExpectation(md, m.maxReels, { lines: allPaylines(m).length, extraFreeSpins: extra });
  console.log(`${m.name}, every line, every symbol, +${extra} free spins a trigger: EV ${r.ev.toFixed(2)} | RTP ${(r.ev / m.spinCost * 100).toFixed(1)}% | ${r.freeSpins.perTriggerWithRetriggers.toFixed(1)} free spins a trigger`);
}
for (const m of data.machines.filter((x) => x.jackpot)) {
  const polish = data.upgrades.filter((u) => u.effect.type === 'jackpotGrowth' && u.machines.includes(m.id)).reduce((g, u) => g + u.maxLevel * u.effect.perLevel, 1);
  const md = setups(m, 'zero').at(-1).ladder.at(-1).md;
  const r = spinExpectation(md, m.maxReels, { lines: allPaylines(m).length, jackpotGrowth: polish });
  const every = r.jackpot.pots.map((p) => `${p.id} 1 in ${Math.round(1 / p.chance).toLocaleString('en-US')} spins`).join(', ');
  console.log(`${m.name}, every line, every symbol, pots growing x${polish}: EV ${r.ev.toFixed(2)} | RTP ${(r.ev / m.spinCost * 100).toFixed(1)}% | ${every}`);
}
{
  const h = data.upgrades.find((u) => u.id === 'hotStreak');
  if (h) {
    for (const m of data.machines) {
      const md = setups(m, 'zero').at(-1).ladder.at(-1).md;
      const r = spinExpectation(md, m.maxReels, { lines: allPaylines(m).length, streakPerStack: h.effect.perStack * h.maxLevel, streakCap: h.effect.maxStacks });
      console.log(`Hot Streak maxed on ${m.name} (full, no Luck): average win bonus x${r.streakFactor.toFixed(3)} (hit rate ${(r.hitRate * 100).toFixed(1)}%)`);
    }
  }
}
{
  // Old Clunky and the Snack Stacker with every luck trait (the tree's weight shifts
  // and Jackpot Dance), every symbol unlocked, no Luck upgrades.
  for (const m of [clunky, stacker]) {
    const g = gameWithWholeTree();
    g.addCoins(1e12);
    if (m !== clunky) g.buyMachine(m.id);
    g.buyUpgrade(soldOn(m, 'unlockSymbol')[0].id, Infinity);
    const md = { ...m, symbols: g.getSymbols() };
    const all = allPaylines(m).length;
    for (let reels = m.startReels; reels <= m.maxReels; reels++) {
      const { ev, hitRate } = expectedValue(md, reels, g.getFullLineMultiplier(), all);
      console.log(`${m.name}, ${reels} reels, ${all} line${all === 1 ? '' : 's'}, all luck traits (weights ${md.symbols.map((s) => `${s.id} ${s.weight}`).join(' / ')}): EV ${ev.toFixed(4)} | RTP ${(ev / m.spinCost * 100).toFixed(1)}% | hit rate ${(hitRate * 100).toFixed(2)}%`);
    }
  }
  const r = data.retirement;
  const seeds = [1, 2, 3, 5, 10, 20].map((n) => `${n} = ${Math.round(r.seedDivisor * Math.pow(n, 1 / r.seedExponent)).toLocaleString('en-US')}`);
  console.log(`Lifetime coins needed for N Heirloom Seeds: ${seeds.join(' · ')}`);
  console.log(`Whole family tree (Family Fortune once): ${nodes.reduce((sum, n) => sum + n.baseCost, 0)} seeds`);

  const c = data.capsules;
  const pool = data.skins.filter((s) => s.rarity !== 'starter');
  const byRarity = c.rarities.map((x) => `${pool.filter((s) => s.rarity === x.id).length} ${x.name.toLowerCase()}`).join(', ');
  console.log(`Diary: ${data.diary.length} stickers, ${data.diary.reduce((sum, d) => sum + d.tokens, 0)} tokens in total · pull ${c.pullCost} tokens · pool ${pool.length} skins (${byRarity})`);
  // Golden jackpots on Old Clunky (3 reels, the Golden Seed unlocked), with no Luck and with max Luck.
  const sym = data.tokens.jackpotSymbol;
  const chance = (luck) => {
    const md = setups(clunky, luck).find((s) => s.reels === 3).ladder.at(-1).md;
    const total = md.symbols.reduce((sum, s) => sum + s.weight, 0);
    return Math.pow(md.symbols.find((s) => s.id === sym).weight / total, 3);
  };
  console.log(`Golden jackpot chance per 3-reel spin on Old Clunky: ${(chance('zero') * 100).toFixed(3)}% with no Luck (1 in ${Math.round(1 / chance('zero'))}), ${(chance('max') * 100).toFixed(3)}% with max Luck (1 in ${Math.round(1 / chance('max'))})`);
  // The auto-spin rhythm per Wheel Training level (Old Clunky).
  const w = upgrade('wheel');
  const iv = Array.from({ length: w.maxLevel }, (_, i) => probe.getAutoInterval({ wheel: i + 1 }, probeMachine(clunky)).toFixed(2));
  console.log(`Wheel Training intervals on Old Clunky (Lv 1–${w.maxLevel}): ${iv.join(' · ')} s (spin ${clunky.spinDuration} s + rest ${w.effect.rest} s = the floor)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
