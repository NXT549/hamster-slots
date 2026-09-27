// economy.mjs — prints the economy numbers for DESIGN.md's tables: EV, RTP and hit
// rate of every machine setup (no Luck and max Luck, each step of the symbol
// unlocks), feature odds, Hot Streak, the luck traits, seeds, tokens and auto-spin.
//
// Run it from the hamster_slots folder after a balance change:
//     npm run economy
// (It used to be the last part of tools/test_logic.mjs; step 3.3 moved it here.)

import {
  readFileSync, createRng, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree, plant,
} from '../tests/logic/helpers.js';

// Every setup: reels, paylines, wild level, and each step of the symbol unlocks
// (L0 = the fresh machine), at no Luck and at max Luck.
const fmtStep = (m, s) => `L${s.level} EV ${s.value.ev.toFixed(2)} RTP ${(s.value.ev / m.spinCost * 100).toFixed(1)}% hit ${(s.value.hitRate * 100).toFixed(1)}%`;
for (const m of data.machines) {
  for (const luck of ['zero', 'max']) {
    for (const s of setups(m, luck)) console.log(`${s.label}: ${s.ladder.map((step) => fmtStep(m, step)).join(' | ')}`);
  }
  // Where a paid spin's value comes from on the fresh and the fully unlocked machine (no Luck),
  // and the fully unlocked machine paying both ways (when it sells Pays Both Ways).
  const all = setups(m, 'zero');
  const plain = all.filter((s) => !s.bothWays);
  for (const s of [plain[0], plain.at(-1), ...(all.at(-1).bothWays ? [all.at(-1)] : [])]) {
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
  // (Only those traits: the M8 traits add Luck and free levels, which the Luck tables cover.)
  for (const m of [clunky, stacker]) {
    const g = newGame();
    plant(g, 'familyPride', 'luckyWhiskers', 'carrotPatch', 'jackpotDance');
    g.addCoins(1e12);
    if (m !== clunky) g.buyMachine(m.id);
    g.switchMachine(m.id);
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
