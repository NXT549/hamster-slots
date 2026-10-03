// data.test.js — data.json sanity checks.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('data.json sanity', () => {
  const knownTypes = ['payoutMultiplier', 'autoSpin', 'spinCostMultiplier', 'extraReel', 'extraPayline',
    'betSteps', 'winStreak', 'symbolWeight', 'extraFreeSpins', 'jackpotGrowth', 'luck', 'unlockSymbol', 'bothWays',
    'extraRespins', 'wheelBonus', // M9
    'doubleWin', 'offlineBonus', 'offlineTime', 'spinSpeed', 'stickerPayout', 'starPayout', 'streakCap', 'fullLineMultiplier',
    'jackpotTokens', 'deliveryTokens', 'gambleHistory', 'potSeedBonus', // 1.3.1
    'zoomies', 'stickyWilds', 'freeSpinClimb']; // 1.10.0
  const treeTypes = ['payoutMultiplier', 'shiftWeight', 'fullLineMultiplier', 'startingLevel', 'spinSpeed',
    'deliveryTime', 'deliveryPayoutBonus', 'autoDelivery',
    'seedJar', 'luck', 'startingMachineLevel', 'startingMachine', 'symbolWeight', 'potSeedBonus', // M8
    'autoBuy', 'generationPayout', 'doubleWin', // 1.3.1
    'maxStars', 'whiskerGain', 'payoutMultiplier']; // 1.4.0: the colony traits
  check('every upgrade has a known effect type', data.upgrades.every((u) => knownTypes.includes(u.effect.type)));
  check('every tree node has a known effect type', nodes.every((n) => treeTypes.includes(n.effect.type)),
    nodes.filter((n) => !treeTypes.includes(n.effect.type)).map((n) => n.id).join(', '));
  // "requires" names upgrades sold on the same machine (the shop says "Needs …" until they're bought).
  const upgradeById = Object.fromEntries(data.upgrades.map((u) => [u.id, u]));
  const badRequires = data.upgrades.filter((u) => (u.requires || []).some((r) => {
    const need = upgradeById[r];
    return !need || need.scope !== u.scope || (u.machines || []).some((m) => need.machines && !need.machines.includes(m));
  }));
  check('every upgrade "requires" names an upgrade sold alongside it', badRequires.length === 0, badRequires.map((u) => u.id).join(', '));
  const allIds = [...data.upgrades.map((u) => u.id), ...nodeIds];
  check('upgrade and tree ids are all unique', new Set(allIds).size === allIds.length);
  const branchIds = data.familyTree.branches.map((b) => b.id);
  check('every tree node is on a listed branch', nodes.every((n) => branchIds.includes(n.branch)));
  // "requires" may only point at nodes listed EARLIER, which also rules out loops.
  check('tree requires only point at earlier nodes (no loops)',
    nodes.every((n, i) => n.requires.every((r) => nodeIds.slice(0, i).includes(r))));
  check('exactly one tree node has no requirements (the root)', nodes.filter((n) => n.requires.length === 0).length === 1);
  // 1.4.0: a colony trait needs a migration, and never a trait of a later colony.
  const colonyOf = (id) => nodes.find((n) => n.id === id).colony || 0;
  check('colony traits need at least one migration, and only need traits of their colony or earlier',
    nodes.every((n) => (n.colony === undefined || (Number.isInteger(n.colony) && n.colony >= 1)) && n.requires.every((r) => colonyOf(r) <= (n.colony || 0))));

  // The Great Migration (1.4.0): its perks and trials.
  const col = data.colony;
  const perkTypes = ['payoutMultiplier', 'seedGain', 'autoRetire', 'startingMachine', 'maxStars'];
  check('every colony perk has a known effect type, a price and a unique id',
    col.perks.every((p) => perkTypes.includes(p.effect.type) && p.baseCost >= 1 && p.growthRate >= 1)
    && new Set([...allIds, ...col.perks.map((p) => p.id)]).size === allIds.length + col.perks.length);
  check('every Colony Trial has a known twist, a goal and whiskers, and the ids are unique',
    col.trials.every((t) => ['noFamily', 'noAuto', 'noStars', 'betCap', 'noWardrobe'].includes(t.rule) && t.goalShare > 0 && t.minSeeds >= 1 && t.whiskers >= 1)
    && new Set(col.trials.map((t) => t.id)).size === col.trials.length);
  check('the Wise Elders\' choices go up, and they plant at most the seeds held',
    col.autoRetire.shares.length > 0 && col.autoRetire.shares.every((x, i) => x > 0 && (i === 0 || x > col.autoRetire.shares[i - 1]))
    && col.autoRetire.minSeeds >= 1 && col.autoRetire.plantShare > 0 && col.autoRetire.plantShare <= 1);
  check('whiskers need a divisor and a growing curve, and trials open after a migration (from a colony\'s Nth hamster)',
    col.whiskerDivisor > 0 && col.whiskerExponent > 0 && col.whiskerExponent <= 1 && col.trialsFrom >= 1
    && Number.isInteger(col.trialGeneration) && col.trialGeneration >= 1);
  const cap = data.retirement.seedSoftcap;
  check('the seed softcap (1.4.0) bends the curve down, never up', !cap || (cap.seeds >= 1 && cap.exponent > 0 && cap.exponent < data.retirement.seedExponent));
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
  // (On a ways machine the wild never lands on reel 1, so it never starts a win and has no table.)
  // (Moving Day's box, 1.4.0, always opens into another symbol first, so it has no table either.)
  const isBox = (m, s) => !!m.mystery && m.mystery.symbol === s.id;
  const needsTable = (m, s) => !(s.scatter || s.blank || (m.ways && s.wild) || isBox(m, s));
  check('every line symbol has a payout table; scatters and blanks have none',
    data.machines.every((m) => m.symbols.every((s) => (needsTable(m, s) ? !!m.payouts[s.id] : !m.payouts[s.id]))));
  // The exact hit-rate count in machine.ts relies on every 2-match paying something
  // on a payline machine. (Ways machines count their hit rate another way: any shortest run.)
  check('every line symbol\'s 2-match pays on a payline machine (wilds too)', data.machines.filter((m) => !m.ways).every((m) => m.symbols.every((s) => s.scatter || s.blank || isBox(m, s) || m.payouts[s.id]['2'] > 0)));
  // Moving Day's boxes (1.4.0): a plain symbol on the machine (not wild, scatter or blank, never
  // locked), opening only into symbols of the same machine that pay on a line.
  for (const m of data.machines.filter((x) => x.mystery)) {
    const box = m.symbols.find((x) => x.id === m.mystery.symbol);
    check(`${m.name}: its box is a plain symbol of the machine, never locked`, !!box && !box.wild && !box.scatter && !box.blank && !box.locked && box.weight > 0);
    check(`${m.name}: boxes open only into its own line symbols (with a payout table), each at least once`,
      m.mystery.reveal.length > 0 && m.mystery.reveal.every((r) => r.weight > 0 && r.symbol !== box.id && m.payouts[r.symbol]
        && m.symbols.some((x) => x.id === r.symbol && !x.scatter && !x.blank)));
    check(`${m.name}: at least one symbol a box opens into is never locked`, m.mystery.reveal.some((r) => !m.symbols.find((x) => x.id === r.symbol).locked));
  }
  check('every symbol of a ways machine pays for 3 on 3 reels (its first reels)', data.machines.filter((m) => m.ways).every((m) => m.startReels >= 3 && m.symbols.every((s) => !needsTable(m, s) || m.payouts[s.id]['3'] > 0)));
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
  check('every scatter symbol starts something (free spins, the jackpot wheel or hold & spin)',
    data.machines.every((m) => m.symbols.filter((s) => s.scatter).every((s) => [m.freeSpins, m.jackpot, m.holdSpin].some((f) => f && f.symbol === s.id))));
  // M9
  check('extraRespins / wheelBonus upgrades are only sold on machines with that feature',
    data.upgrades.filter((u) => u.effect.type === 'extraRespins').every((u) => u.machines.every((id) => data.machines.find((m) => m.id === id).holdSpin))
    && data.upgrades.filter((u) => u.effect.type === 'wheelBonus').every((u) => u.machines.every((id) => data.machines.find((m) => m.id === id).wheel)));
  check('hold & spin: a trigger it can reach, respins, a chance per cell, coin values and a Grand',
    data.machines.filter((m) => m.holdSpin).every((m) => {
      const h = m.holdSpin;
      return h.trigger >= 1 && h.trigger <= m.startReels * rowCount(m) && h.respins >= 1 && h.respinChance > 0 && h.respinChance < 1
        && h.values.length > 0 && h.values.every((v) => v.value > 0 && v.weight > 0) && h.grand >= 0 && h.respinSeconds > 0 && h.pause >= 0;
    }));
  check('the cheese wheel: wedges with a multiplier of 2+ and a weight', data.machines.filter((m) => m.wheel).every((m) => m.wheel.wedges.length > 0 && m.wheel.wedges.every((w) => w.multiplier >= 2 && w.weight > 0)));
  check('a ways machine has no paylines and sells no Pays Both Ways', data.machines.filter((m) => m.ways).every((m) => !m.paylines && !data.upgrades.some((u) => u.effect.type === 'bothWays' && u.machines.includes(m.id))));
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
  check('a colony machine (1.4.0) needs at least one migration, and the first machine is never one',
    data.machines.every((m) => m.colony === undefined || (Number.isInteger(m.colony) && m.colony >= 1)) && !data.machines[0].colony);
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
});

// ─────────────────────────────────────────────────────────────
describe('data.json sanity: tokens, capsules, skins, diary', () => {
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
  const goalTypes = ['stat', 'upgradeLevel', 'generation', 'treeNodes', 'skinsOwned', 'machinesOwned', 'categoryOwned', 'stickers'];
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
});
