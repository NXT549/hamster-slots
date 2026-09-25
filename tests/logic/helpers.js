// helpers.js — shared by the logic test files: the game data, small helpers, and
// games set up in common ways. (Moved from the top of tools/test_logic.mjs, step 3.3.)
// No Vitest in here, so tools/economy.mjs can use these too.

import { readFileSync } from 'node:fs';
import { createRng } from '../../src/logic/rng.ts';
import {
  evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol,
  scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation,
} from '../../src/logic/machine.ts';
import { createGame, costAtLevel, SAVE_VERSION, SUITS } from '../../src/logic/game.ts';
import { money, roundMoney as roundBig } from '../../src/logic/money.ts';

const data = JSON.parse(readFileSync(new URL('../../data.json', import.meta.url), 'utf8'));

const near = (a, b, tol) => Math.abs(a - b) <= tol;
// Money (coins, seeds, tokens) is a big number since migration step 3.7 (money.ts).
// num(x) is its plain number, so a check can compare it with === or add it up.
// (Exact for every amount the tests use: they're far below 9e15.)
const num = (x) => (typeof x === 'number' ? x : x.toNumber());
// Round to cents like the game does, as a plain number.
const roundMoney = (x) => num(roundBig(x));
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

export {
  readFileSync, createRng, money, num, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
};
