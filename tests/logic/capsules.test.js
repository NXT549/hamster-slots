// capsules.test.js — Hamster Tokens, the diary, the Capsule Machine and skins.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, money, num, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('Hamster Tokens + the diary', () => {
  const g = newGame(31);
  const stickers = [];
  g.on('stickerEarned', (e) => stickers.push(e.id));
  check('a new game has 0 tokens and no stickers', num(g.state.tokens) === 0 && Object.keys(g.state.diary).length === 0);
  g.spin();
  land(g);
  check('first spin earns the "First Spin" sticker', stickers.includes('firstSpin') && g.state.diary.firstSpin === true);
  const tokensAfter = num(g.state.tokens);
  g.spin();
  land(g);
  check('a sticker is only awarded once', stickers.filter((id) => id === 'firstSpin').length === 1);
  check('tokens only change when a sticker/jackpot pays', num(g.state.tokens) >= tokensAfter);
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
  const before = num(r.state.tokens);
  r.retire();
  check(`retiring pays ${data.tokens.perRetirement} tokens (+ the "Big Cage" sticker)`,
    num(r.state.tokens) === before + data.tokens.perRetirement + data.diary.find((x) => x.id === 'firstRetirement').tokens);
  check('tokens are kept when retiring', num(r.state.tokens) > 0);

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
});

// ─────────────────────────────────────────────────────────────
describe('Capsule Machine + skins', () => {
  const c = data.capsules;
  const g = newGame(41);
  check('starter skins are owned and equipped', g.isSkinOwned('furClassic') && g.getEquippedSkin('fur') === 'furClassic');
  check('cannot pull without tokens', g.canPull() === false && g.pullCapsule() === false);
  const opened = [];
  g.on('capsuleOpened', (e) => opened.push(e));
  g.addTokens(c.pullCost);
  const collectorTokens = data.diary.find((d) => d.id === 'firstCapsule').tokens;
  check('a pull costs pullCost tokens (the first one also earns "Capsule Collector")',
    g.pullCapsule() === true && num(g.state.tokens) === collectorTokens + num(opened[0].refund));
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
      if (num(e.refund) !== c.rarities.find((r) => r.id === e.rarity).duplicateRefund) refundsOk = false;
    }
  });
  const tokensBefore = num(o.state.tokens);
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
  const refunds = num(o.state.tokens) - (tokensBefore - total * c.pullCost);
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
  check('load clamps tokens >= 0 and the pity counter', num(g3.state.tokens) === 0 && g3.state.capsules.sincePity === c.pityPulls - 1);

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
});
