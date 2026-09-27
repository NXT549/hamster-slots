// wardrobe.test.js — M10, Wardrobe buffs: every skin you wear gives a buff (its
// slot decides what, its rarity how much), every Epic has a twist, and hats are
// a fifth slot that adds Luck. Worn skins work like upgrades at level 1, so the
// usual rules (exact EV, Luck raises the hit rate, …) must keep holding with them.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  data, near, deepEqual, num, newGame, clunky, bonanza, soldOn, land, spinExpectation, freeSpinStats,
} from './helpers.js';

const skin = (id) => data.skins.find((s) => s.id === id);
// The buff each slot gives (the first effect of every skin in it), weakest first.
const SLOT_BUFF = { fur: 'payoutMultiplier', hat: 'luck', wheel: 'spinSpeed', machine: 'spinCostMultiplier', room: 'offlineBonus' };
const strength = (e) => (e.type === 'spinSpeed' ? 1 - e.multiplier : e.type === 'spinCostMultiplier' ? 1 - e.perLevel : e.perLevel);
// A game that owns every skin and wears the given ones.
function wearing(...ids) {
  const g = newGame(71);
  g.ownAllSkins();
  for (const id of ids) g.equipSkin(id);
  return g;
}

// ─────────────────────────────────────────────────────────────
describe('the wardrobe data: a buff per slot, stronger with rarity, a twist per Epic', () => {
  const rarities = data.capsules.rarities.map((r) => r.id); // common, rare, epic
  check('five slots: fur, hat, wheel, machine, room', deepEqual(data.skinCategories.map((c) => c.id), ['fur', 'hat', 'wheel', 'machine', 'room']));
  for (const cat of data.skinCategories) {
    const skins = data.skins.filter((s) => s.category === cat.id);
    const starters = skins.filter((s) => s.rarity === 'starter');
    check(`${cat.name}: one starter, and it does nothing`, starters.length === 1 && !(starters[0].effects && starters[0].effects.length));
    const found = skins.filter((s) => s.rarity !== 'starter');
    check(`${cat.name}: every skin from a capsule gives the slot's buff (${SLOT_BUFF[cat.id]})`,
      found.length > 0 && found.every((s) => s.effects && s.effects[0].type === SLOT_BUFF[cat.id]));
    check(`${cat.name}: skins of one rarity give the same buff`, rarities.every((r) => {
      const values = found.filter((s) => s.rarity === r).map((s) => strength(s.effects[0]));
      return values.every((v) => v === values[0]);
    }));
    const byRarity = rarities.map((r) => found.filter((s) => s.rarity === r).map((s) => strength(s.effects[0]))[0]).filter((v) => v !== undefined);
    check(`${cat.name}: rarer = stronger (${byRarity.join(' < ')})`, byRarity.every((v, i) => v > 0 && (i === 0 || v > byRarity[i - 1])));
    check(`${cat.name}: every Epic has one twist, the others none`,
      found.every((s) => s.effects.length === (s.rarity === 'epic' ? 2 : 1)));
  }
  check('the gentle sizes the user picked: +5/10/20% payouts, +3/6/12 Luck',
    [['furCinnamon', 0.05], ['furLavender', 0.1], ['furGolden', 0.2], ['hatParty', 3], ['hatTop', 6], ['hatCrown', 12]].every(([id, v]) => skin(id).effects[0].perLevel === v));
  check('six hats in capsules: 3 common, 2 rare, 1 epic', deepEqual(
    rarities.map((r) => data.skins.filter((s) => s.category === 'hat' && s.rarity === r && !s.casino).length), [3, 2, 1]));
});

// ─────────────────────────────────────────────────────────────
describe('the buffs, slot by slot', () => {
  const plain = newGame(71);
  check('a new game wears starter skins: no buffs', plain.getWardrobe().length === 0 && num(plain.getPayoutMultiplier()) === 1
    && plain.getLuck().hamster === 0 && plain.getOfflineMultiplier() === 1);

  const fur = wearing('furCinnamon');
  check('fur: Cinnamon pays ×1.05', near(num(fur.getPayoutMultiplier()), 1.05, 1e-12));
  fur.addCoins(1e6);
  fur.buyUpgrade('cheeks', 2);
  const cheeks = data.upgrades.find((u) => u.id === 'cheeks').effect.perLevel;
  check('…and it multiplies with Chubby Cheeks (its own group), not adds', near(num(fur.getPayoutMultiplier()), (1 + 2 * cheeks) * 1.05, 1e-12));

  const wheel = wearing('wheelOak');
  check('wheel: the Oak Wheel spins 10% faster', near(wheel.getSpinDuration(), clunky.spinDuration * 0.9, 1e-12));
  wheel.addCoins(1e6);
  wheel.buyUpgrade('wheel', Infinity);
  const rest = data.upgrades.find((u) => u.id === 'wheel').effect.rest;
  check('…and auto-spin is still never quicker than the spin + the rest', wheel.getAutoInterval() >= wheel.getSpinDuration() + rest - 1e-9);

  const machine = wearing('machineGrape');
  check('machine: Grape Clunky makes spins 10% cheaper', near(num(machine.getSpinCost()), clunky.spinCost * 0.9, 1e-9));
  machine.addCoins(1e9);
  machine.buyMachine('bonanza');
  check('…on every machine', near(num(machine.getSpinCost()), bonanza.spinCost * 0.9, 1e-9));

  const room = wearing('roomStarry');
  const bare = newGame(71);
  for (const g of [room, bare]) { g.addCoins(1e6); g.buyUpgrade('wheel'); }
  check('room: Starry Night pays 10% more while you\'re away',
    near(num(room.getOfflineEarnings(3600).coins), num(bare.getOfflineEarnings(3600).coins) * 1.1, 0.02));

  const hat = wearing('hatTop');
  check('hat: the Top Hat adds 6 Hamster Luck', hat.getLuck().hamster === 6 && hat.getLuck().total === 6);
  const e = hat.getEconomy();
  check('…and the EV stays exact with it', near(e.ev, spinExpectation({ ...clunky, symbols: hat.getSymbols() }, 2, { lines: 1 }).ev, 1e-9));
  check('…and it raises the hit rate and the EV', e.hitRate > plain.getEconomy().hitRate && e.ev > plain.getEconomy().ev);
  check('the most Luck ever is noted when a hat goes on', hat.state.stats.bestLuck >= 6);

  const off = wearing('hatTop');
  off.equipSkin('hatNone');
  check('taking the hat off takes its Luck away', off.getLuck().hamster === 0 && off.getWardrobe().length === 0);
});

// ─────────────────────────────────────────────────────────────
describe('the Epic twists', () => {
  const plain = newGame(72);
  check(`Golden Glow: a golden jackpot gives ${data.tokens.perJackpot + 1} tokens`, wearing('furGolden').getJackpotTokens() === data.tokens.perJackpot + 1
    && plain.getJackpotTokens() === data.tokens.perJackpot);

  const gold = wearing('wheelGold');
  check('Gold Wheel: nothing without Hot Streak', gold.getMaxStreakMultiplier() === 1);
  const streak = data.upgrades.find((u) => u.effect.type === 'winStreak');
  gold.addCoins(1e9);
  gold.buyUpgrade(streak.id);
  plain.addCoins(1e9);
  plain.buyUpgrade(streak.id);
  check('Gold Wheel: Hot Streak climbs one step higher',
    near(gold.getMaxStreakMultiplier(), 1 + streak.effect.perStack * (streak.effect.maxStacks + 1), 1e-12)
    && near(plain.getMaxStreakMultiplier(), 1 + streak.effect.perStack * streak.effect.maxStacks, 1e-12));

  const mid = wearing('machineMidnight');
  mid.addCoins(1e9);
  mid.buyMachine('bonanza');
  const b0 = newGame(72);
  b0.addCoins(1e9);
  b0.buyMachine('bonanza');
  check('Midnight Clunky: 2 more free spins a trigger', near(mid.getEconomy().freeSpins.perTrigger, b0.getEconomy().freeSpins.perTrigger + 2, 1e-9));

  const sun = wearing('roomSunflower');
  check(`Sunflower Field: a token every 3rd delivery (not every ${data.tokens.deliveryEvery}th)`, sun.getDeliveryTokenEvery() === 3);
  const tips = [];
  sun.on('tokensChanged', (e) => { if (e.source === 'delivery') tips.push(sun.state.stats.deliveries); });
  for (let i = 0; i < 6; i++) { sun.startDelivery(); sun.update(sun.getDeliveryDuration() + 0.05); }
  check('…and the 3rd and 6th deliveries really tip one', deepEqual(tips, [3, 6]));

  const crown = wearing('hatCrown');
  check(`the Crown: the gamble shows ${data.gamble.history + 2} past cards`, crown.getCardHistoryLength() === data.gamble.history + 2);
  for (let i = 0; i < 12; i++) { crown.triggerGamble(10); crown.gamble('red'); crown.collectGamble(); }
  check('…and keeps that many', crown.getCardHistory().length === data.gamble.history + 2);
});

// ─────────────────────────────────────────────────────────────
describe('wardrobe: the rules still hold with the best of everything worn', () => {
  const best = ['furGolden', 'hatCrown', 'wheelGold', 'machineMidnight', 'roomSunflower'];
  // Rule 2: deliveries earn less than auto-spin at Wheel Training 1 (the wardrobe only helps auto-spin).
  const g = wearing(...best);
  g.addCoins(1e6);
  g.buyUpgrade('wheel');
  const econ = g.getEconomy();
  check('rule 2 with the best wardrobe: delivery/s < auto-spin profit/s', num(econ.deliveryPerSecond) < num(econ.expectedAutoProfitPerSecond));
  // Every Clover level still raises the hit rate and the EV with the Crown's Luck on top.
  let ok = true;
  const clover = data.upgrades.find((u) => u.id === 'clover');
  let prev = null;
  for (let l = 0; l <= clover.maxLevel; l++) {
    const v = spinExpectation({ ...clunky, symbols: g.getSymbols({ clover: l }) }, 2, { lines: 1 });
    if (prev && !(v.hitRate > prev.hitRate && v.ev > prev.ev)) ok = false;
    prev = v;
  }
  check('every Luck level still raises the hit rate and the EV, with the Crown on', ok);
  // Free spins still always end: max Luck, every Bouncy Ball, the Crown and Midnight Clunky's 2 more.
  const f = wearing(...best);
  f.addCoins(1e12);
  f.buyMachine('bonanza');
  for (const u of soldOn(bonanza, 'luck')) f.buyUpgrade(u.id, Infinity);
  for (const u of soldOn(bonanza, 'extraFreeSpins')) f.buyUpgrade(u.id, Infinity);
  const extra = soldOn(bonanza, 'extraFreeSpins').reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0) + 2;
  const s = freeSpinStats({ ...bonanza, symbols: f.getSymbols() }, 5, extra);
  check(`free spins always end with the best wardrobe (retrigger loop ${(s.q * s.perTrigger).toFixed(3)} < 1)`, s.q * s.perTrigger < 1);
  check('the game\'s own free-spin maths counts Midnight Clunky too', near(f.getEconomy().freeSpins.perTriggerWithRetriggers, s.total, 1e-9));
});

// ─────────────────────────────────────────────────────────────
describe('wardrobe: saves, the diary and capsules', () => {
  const g = wearing('furLavender', 'hatCowboy', 'roomMint');
  const save = JSON.parse(JSON.stringify(g.toSaveData()));
  const g2 = newGame();
  g2.loadSaveData(save);
  check('what you wear comes back with the save, buffs and all', g2.getEquippedSkin('hat') === 'hatCowboy'
    && g2.getLuck().hamster === 6 && near(num(g2.getPayoutMultiplier()), 1.1, 1e-12) && deepEqual(g2.toSaveData(), save));
  check('an older save (no hat) wears no hat', newGame().getEquippedSkin('hat') === 'hatNone');

  const d = newGame(73);
  for (const id of ['hatParty', 'hatBeanie']) d.state.skins.owned[id] = true;
  d.equipSkin('hatParty'); // any action that checks the diary
  check('Hat Trick needs 3 hats', !d.state.diary.hatTrick);
  d.state.skins.owned.hatTop = true;
  d.equipSkin('hatTop');
  check('Hat Trick: 3 hats earn the sticker', d.state.diary.hatTrick === true);

  const c = newGame(74);
  c.addTokens(1e6);
  const got = new Set();
  c.on('capsuleOpened', (e) => got.add(e.skinId));
  for (let i = 0; i < 3000; i++) c.pullCapsule();
  const pool = data.skins.filter((s) => s.rarity !== 'starter' && !s.casino); // M11: the casino's skins are only at its Prize Counter
  check(`hats come from capsules: ${pool.length} skins in the pool, all found in 3,000 pulls`,
    pool.length === 24 && pool.every((s) => got.has(s.id)));
  check('no casino skin ever comes out of a capsule', data.skins.filter((s) => s.casino).every((s) => !got.has(s.id)));
  check('a spin with a hat on plays like any spin', (() => { const h = wearing('hatCrown'); h.spin(); land(h); return h.state.stats.spins === 1; })());
});
