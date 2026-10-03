// nutsbolts.test.js — 1.3.1, "Nuts & Bolts": 20 new upgrades (some on sale from
// the start, some unlocked by retiring = REBIRTH upgrades, some by a diary sticker
// = STICKER upgrades), 4 new Family Tree traits (the Hamster Helper among them),
// 8 new stickers, and save v12. The locks are checked on plain games (createGame);
// everything else uses the helpers' newGame, where every upgrade is on sale.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  data, near, num, newGame, createGame, createRng, clunky, bonanza, soldOn, land, plant, roundMoney, spinExpectation, freeSpinStats,
  gameWithWholeTree, SAVE_VERSION,
} from './helpers.js';

const upgrade = (id) => data.upgrades.find((u) => u.id === id);
// A plain game: nothing unlocked by the debug helper.
const fresh = (seed = 1, d = data) => createGame(structuredClone(d), createRng(seed));
// Retire (with debug coins that count as earned) and start the next life.
function nextLife(g) {
  g.addCoins(1e9 * g.state.generation, true);
  const ok = g.retire() && g.leaveBigCage();
  return ok;
}
const gated = data.upgrades.filter((u) => u.unlock);
const rebirth = gated.filter((u) => u.unlock.generation);
const stickerUps = gated.filter((u) => u.unlock.sticker);

// ─────────────────────────────────────────────────────────────
describe('1.3.1 data: the new upgrades, traits and stickers', () => {
  check('20 new upgrades: 3 for everyone, 6 rebirth upgrades, 11 sticker upgrades',
    ['luckyPennies', 'nightShift', 'cosyNest'].every((id) => upgrade(id) && !upgrade(id).unlock) && rebirth.filter((u) => u.id !== 'zoomies').length === 6 && stickerUps.length === 11);
  check('every "unlock" is a generation of 2 or more, or a sticker in the diary',
    gated.every((u) => (u.unlock.generation === undefined || (Number.isInteger(u.unlock.generation) && u.unlock.generation >= 2))
      && (u.unlock.sticker === undefined || data.diary.some((d) => d.id === u.unlock.sticker))));
  check('rebirth upgrades open at generations 2, 3, 4, 5, 6, 7 (Zoomies, 1.10.0) and 8', rebirth.map((u) => u.unlock.generation).join() === '2,3,4,5,6,7,8');
  check('no two sticker upgrades need the same sticker', new Set(stickerUps.map((u) => u.unlock.sticker)).size === stickerUps.length);
  check('the bets still stop at x10 (DESIGN §18: bigger bets made late lives collapse, D80)', data.betSteps.join() === '1,2,3,5,10'
    && !gated.some((u) => u.effect.type === 'betSteps'));
  const firstColony = data.familyTree.nodes.filter((n) => !n.colony);
  check('the four new traits sit where the Big Cage has room: two on the trunk, the third of Charms and of Bonuses',
    ['helpingPaws', 'deepRoots'].every((id) => data.familyTree.nodes.find((n) => n.id === id).branch === 'roots')
    && firstColony.filter((n) => n.branch === 'charms').length === 3 && firstColony.filter((n) => n.branch === 'bonuses').length === 3);
  check('Full Bloom still means every trait (of the first colony: 1.4.0\'s colony traits come on top)',
    data.diary.find((d) => d.id === 'treeAll').goal.target === firstColony.length);
  check('every new upgrade has a max level, except Mega Cheeks (a coin sink, like Chubby Cheeks)',
    [...gated, upgrade('luckyPennies'), upgrade('nightShift'), upgrade('cosyNest')].every((u) => (u.id === 'megaCheeks' ? u.maxLevel === null : u.maxLevel > 0)));
});

// ─────────────────────────────────────────────────────────────
describe('rebirth and sticker upgrades are locked until they open', () => {
  const g = fresh(3);
  g.addCoins(1e15);
  check('a new family: every rebirth and sticker upgrade is locked', gated.every((u) => g.getUpgradeLock(u.id) !== null && !g.isUpgradeUnlocked(u.id)));
  check('…and says what opens it', rebirth.every((u) => g.getUpgradeLock(u.id).generation === u.unlock.generation)
    && stickerUps.every((u) => g.getUpgradeLock(u.id).sticker === u.unlock.sticker));
  check('a locked upgrade can\'t be bought, even with the coins', gated.every((u) => !g.canBuyUpgrade(u.id) && !g.getUpgradeBulk(u.id, 1).affordable && !g.buyUpgrade(u.id)));
  check('…and stays at level 0', gated.every((u) => g.getUpgradeLevel(u.id) === 0));
  check('the shop still lists them (to show them locked)', gated.filter((u) => u.scope === 'global').every((u) => g.getAvailableUpgrades().some((d) => d.id === u.id)));
  check('the upgrades for everyone are on sale from the start', g.buyUpgrade('luckyPennies') && g.buyUpgrade('wheel') && g.buyUpgrade('nightShift') && g.buyUpgrade('cosyNest'));

  // Retiring: each generation opens its rebirth upgrade, and says so once.
  const h = fresh(4);
  const opened = [];
  h.on('upgradeUnlocked', (e) => opened.push(e));
  const byGeneration = {};
  for (let gen = 2; gen <= 8; gen++) {
    nextLife(h);
    byGeneration[gen] = opened.filter((e) => e.reason === 'generation').map((e) => e.id);
    opened.length = 0;
  }
  check('generation 2 opens Running Shoes, 3 the Coupon Book, 4 the Sticker Album, 5 Star Polish, 6 Mega Cheeks, 7 Zoomies, 8 Hot Sauce (each once)',
    [2, 3, 4, 5, 6, 7, 8].map((gen) => byGeneration[gen].join('+')).join() === 'runningShoes,couponBook,stickerAlbum,starPolish,megaCheeks,zoomies,hotSauce',
    JSON.stringify(byGeneration));
  check('by generation 8 every rebirth upgrade is on sale', rebirth.every((u) => h.isUpgradeUnlocked(u.id)));

  // A sticker opens its upgrade.
  const s = fresh(5);
  s.addCoins(1e6);
  const events = [];
  s.on('upgradeUnlocked', (e) => events.push(e));
  s.state.stats.bestStreak = 5; // as if 5 paid spins in a row had won
  s.spin('manual'); // anything that checks the diary
  check('earning On Fire opens Blazing Streak (a sticker upgrade)', s.state.diary.onFire && s.isUpgradeUnlocked('blazingStreak')
    && events.length === 1 && events[0].id === 'blazingStreak' && events[0].reason === 'sticker');
  check('…which still needs Hot Streak first', !s.canBuyUpgrade('blazingStreak') && s.getUpgradeNeeds('blazingStreak').join() === 'Hot Streak');

  // A save keeps what's open, and loading it announces nothing.
  const loaded = fresh(6);
  const again = [];
  loaded.on('upgradeUnlocked', (e) => again.push(e));
  loaded.loadSaveData(s.toSaveData());
  check('a loaded save keeps its sticker upgrade open, without announcing it again', loaded.isUpgradeUnlocked('blazingStreak') && again.length === 0);

  const d = fresh(7);
  const quiet = [];
  d.on('upgradeUnlocked', (e) => quiet.push(e));
  check('the debug unlock puts every upgrade on sale, quietly', d.unlockAllUpgrades() && gated.every((u) => d.isUpgradeUnlocked(u.id)) && quiet.length === 0);
});

describe('Machine Stars: a locked upgrade never blocks a rebuild', () => {
  const g = fresh(8);
  g.addCoins('1e16');
  g.buyMachine('vault');
  for (const u of g.getAvailableUpgrades().filter((x) => x.scope === 'machine')) g.buyUpgrade(u.id, Infinity);
  check('the Acorn Vault with every upgrade that is on sale maxed can be rebuilt (Acorn Stash is still locked)',
    g.getUpgradeLevel('acornStash') === 0 && g.canRebuild('vault'));
  g.unlockAllUpgrades();
  check('once Acorn Stash is on sale, it has to be maxed too', !g.canRebuild('vault') && g.buyUpgrade('acornStash') && g.canRebuild('vault'));
});

// ─────────────────────────────────────────────────────────────
describe('Lucky Pennies and the Penny Jar: a win can pay double', () => {
  const g = newGame(21);
  check('no pennies, no chance', g.getDoubleChance() === 0);
  g.addCoins(1e9);
  g.buyUpgrade('luckyPennies', Infinity);
  check('Lucky Pennies maxed: 10%', near(g.getDoubleChance(), 0.1, 1e-12));
  plant(g, 'familyPride', 'ballPit', 'goldenPouches', 'pennyJar', 'pennyJar', 'pennyJar');
  check('with the Penny Jar maxed too: 16%', near(g.getDoubleChance(), 0.16, 1e-12));
  // The EV: the lines of a paid spin × (1 + chance), exactly (the coin toss doesn't depend on the reels).
  g.buyUpgrade('thirdReel');
  const e = g.getEconomy();
  const plain = spinExpectation({ ...clunky, symbols: g.getSymbols() }, 3, { fullLineMultiplier: g.getFullLineMultiplier() });
  check('Old Clunky\'s EV = the lines × 1.16', near(e.ev, plain.ev * 1.16, 1e-9));
  const b = newGame(22);
  b.addCoins(1e12);
  b.buyMachine('bonanza');
  b.buyUpgrade('luckyPennies', Infinity);
  const be = b.getEconomy();
  check('on the Burrow Bonanza only the paid lines double (free spins don\'t)',
    near(be.ev, be.lineEv * be.streakFactor * 1.1 + be.freeSpins.ev + be.jackpot.ev + be.hold.ev, 1e-9));

  // Play: about 16% of winning paid spins pay double, and a doubled win is exactly twice.
  let wins = 0;
  let doubled = 0;
  let exact = true;
  let never = true;
  g.on('spinResolved', (r) => {
    if (r.doubled && (r.free || r.wins.length === 0)) never = false;
    if (r.free || r.wins.length === 0) return;
    wins++;
    if (!r.doubled) return;
    doubled++;
    const mult = num(g.getPayoutMultiplier()) * r.bet;
    for (const w of r.wins) if (num(w.payout) !== roundMoney(mult * w.basePayout * (w.fullLine ? g.getFullLineMultiplier() : 1) * 2)) exact = false;
  });
  for (let i = 0; i < 5000; i++) {
    g.spin('auto');
    land(g);
  }
  const share = doubled / wins;
  check(`about 16% of wins pay double (${(share * 100).toFixed(1)}% of ${wins})`, Math.abs(share - 0.16) < 4 * Math.sqrt(0.16 * 0.84 / wins));
  check('a doubled win pays exactly twice on every line', doubled > 0 && exact);
  check('a losing spin is never "doubled"', never);
  check('the stat counts them, and Seeing Double is earned', g.state.stats.doubleWins === doubled && g.state.diary.seeingDouble);

  // Without the pennies the coin is never tossed, so the reels land exactly as they did before 1.3.1.
  const without = structuredClone(data);
  without.upgrades = without.upgrades.filter((u) => u.effect.type !== 'doubleWin');
  without.familyTree.nodes = without.familyTree.nodes.filter((n) => n.effect.type !== 'doubleWin');
  const x = fresh(23);
  const y = fresh(23, without);
  for (const k of [x, y]) {
    k.addCoins(1e6);
    for (let i = 0; i < 300; i++) { k.spin('auto'); land(k); }
  }
  check('with no chance to double, the RNG runs exactly as before', x.rng.getState() === y.rng.getState() && num(x.state.coins) === num(y.state.coins));
});

// ─────────────────────────────────────────────────────────────
describe('offline upgrades: Night Shift and the Cosy Nest', () => {
  const g = newGame(31);
  g.addCoins(1e9);
  g.buyUpgrade('wheel');
  const base = g.getOfflineEarnings(10 * 3600);
  check('2 hours pay at most, to start with', base.seconds === data.offline.maxSeconds && g.getOfflineCap() === data.offline.maxSeconds);
  g.buyUpgrade('cosyNest', Infinity);
  check('the Cosy Nest maxed: 6 hours', g.getOfflineCap() === data.offline.maxSeconds + 4 * 3600 && g.getOfflineEarnings(10 * 3600).seconds === 6 * 3600);
  check('…and it pays for the extra hours', near(num(g.getOfflineEarnings(10 * 3600).coins), num(base.coins) * 3, 1));
  g.buyUpgrade('nightShift', Infinity);
  check('Night Shift maxed: offline earnings x1.5', near(g.getOfflineMultiplier(), 1.5, 1e-12));
  // Time away never pays as much as playing: the best room on top of Night Shift maxed.
  g.ownAllSkins();
  const rooms = data.skins.filter((s) => s.category === 'room' && s.effects);
  let best = 0;
  for (const r of rooms) {
    g.equipSkin(r.id);
    best = Math.max(best, g.getOfflineMultiplier());
  }
  check(`offline stays below playing: ${data.offline.efficiency} x ${best.toFixed(2)} < 1`, data.offline.efficiency * best < 1);
  const n = newGame(32);
  n.addCoins(1e6);
  check('Night Shift and the Cosy Nest need Wheel Training (nothing runs while you\'re away without it)',
    !n.canBuyUpgrade('nightShift') && !n.canBuyUpgrade('cosyNest') && n.buyUpgrade('wheel') && n.canBuyUpgrade('nightShift'));
});

// ─────────────────────────────────────────────────────────────
describe('faster and cheaper: Running Shoes and the Coupon Book', () => {
  const g = newGame(41);
  g.addCoins(1e15);
  const d0 = g.getSpinDuration();
  g.buyUpgrade('runningShoes', Infinity);
  check('Running Shoes maxed: spins x0.95^3', near(g.getSpinDuration(), d0 * Math.pow(0.95, 3), 1e-12));
  // Rule 8: auto-spin never starts before the spin + the rest, on every machine and Wheel level, with every speed-up.
  for (const md of data.machines.slice(1)) g.buyMachine(md.id);
  plant(g, 'familyPride', 'warmUpLaps', 'quickPaws');
  let floor = true;
  for (const md of data.machines) {
    g.switchMachine(md.id);
    for (let lv = 1; lv <= upgrade('wheel').maxLevel; lv++) {
      const iv = g.getAutoInterval({ wheel: lv });
      if (!(iv >= g.getSpinDuration() + upgrade('wheel').effect.rest - 1e-9)) floor = false;
    }
  }
  check('rule 8 with Running Shoes and Quick Paws: auto-spin never beats spin time + the rest', floor);

  const c = newGame(42);
  c.addCoins(1e15);
  c.buyMachine('stacker');
  const costs = data.machines.slice(0, 2).map((md) => { c.switchMachine(md.id); return num(c.getSpinCost()); });
  c.buyUpgrade('couponBook', Infinity);
  const after = data.machines.slice(0, 2).map((md) => { c.switchMachine(md.id); return num(c.getSpinCost()); });
  check('the Coupon Book maxed: every machine\'s spins x0.95^5', after.every((v, i) => near(v, roundMoney(costs[i] * Math.pow(0.95, 5)), 0.005)));
});

// ─────────────────────────────────────────────────────────────
describe('bigger payouts: Sticker Album, Mega Cheeks, Money Bags, Star Polish, Deep Roots', () => {
  const g = newGame(51);
  g.addCoins(1e15);
  for (const d of data.diary.slice(0, 10)) g.state.diary[d.id] = true; // 10 stickers earned
  const p0 = num(g.getPayoutMultiplier());
  const stickers = g.countStickers();
  g.buyUpgrade('stickerAlbum', Infinity);
  check(`the Sticker Album maxed: +3% per sticker (${stickers} stickers)`, stickers > 0 && near(num(g.getPayoutMultiplier()), p0 + 0.03 * stickers, 1e-9));
  const before = num(g.getPayoutMultiplier());
  g.state.stats.upgradesBought = 500; // as if 500 levels were bought: Busy Paws
  g.buyUpgrade('megaCheeks'); // (and this checks the diary)
  check('every new sticker adds to the album', g.state.diary.busyPaws && near(num(g.getPayoutMultiplier()), before + 1 + 0.03 * (g.countStickers() - stickers), 1e-9));
  const m0 = num(g.getPayoutMultiplier());
  g.buyUpgrade('megaCheeks', 9);
  g.buyUpgrade('moneyBags', Infinity);
  check('Mega Cheeks (+100% a level, no max) and Money Bags (+50%, max 5) add to the coin upgrades\' group',
    near(num(g.getPayoutMultiplier()), m0 + 9 + 2.5, 1e-9) && !g.isMaxed('megaCheeks'));

  const s = newGame(52);
  s.addCoins(1e9);
  s.state.stars.clunky = 3;
  check('3 Machine Stars: x1.30', near(s.getStarMultiplier(), 1.3, 1e-12));
  s.buyUpgrade('starPolish', Infinity);
  check('Star Polish maxed: each star +20%, so x1.60', near(s.getStarMultiplier(), 1.6, 1e-12) && near(s.getStarPayout(), 0.2, 1e-12));

  const r = newGame(53);
  plant(r, 'familyPride', 'familyFortune', 'helpingPaws');
  const r0 = num(r.getPayoutMultiplier());
  plant(r, 'deepRoots');
  check('Deep Roots: +2% for the 1st generation', near(num(r.getPayoutMultiplier()), r0 + 0.02, 1e-12));
  nextLife(r);
  nextLife(r);
  r.addSeeds(r.state.seeds.neg()); // no heirloom bonus, to compare
  check('…and +6% by the 3rd (it grows with the family, in the family\'s group)', near(num(r.getPayoutMultiplier()), 1 + 0.25 + 0.06, 1e-12));
});

// ─────────────────────────────────────────────────────────────
describe('the streak, full lines, Luck, tokens and the gamble', () => {
  const g = newGame(61);
  g.addCoins(1e15);
  g.buyUpgrade('blazingStreak');
  check('Blazing Streak needs Hot Streak', g.getUpgradeLevel('blazingStreak') === 0);
  g.buyUpgrade('hotStreak', Infinity);
  const cap0 = g.getMaxStreakMultiplier();
  g.buyUpgrade('blazingStreak', Infinity);
  check('Blazing Streak maxed: the streak counts 8 wins, up to x3.00', near(cap0, 2.25, 1e-12) && near(g.getMaxStreakMultiplier(), 3, 1e-12));
  g.buyUpgrade('thirdReel');
  const e = g.getEconomy();
  let sum = 0;
  for (let k = 1; k <= 8; k++) sum += Math.pow(e.hitRate, k);
  check('…and the EV\'s streak factor counts all 8 exactly', near(e.streakFactor, 1 + 0.25 * sum, 1e-12));

  const l = newGame(62);
  l.addCoins(1e15);
  l.buyUpgrade('lineDance', Infinity);
  check('Line Dance maxed: full lines x1.1^5', near(l.getFullLineMultiplier(), Math.pow(1.1, 5), 1e-12));
  plant(l, 'familyPride', 'luckyWhiskers', 'carrotPatch', 'jackpotDance');
  check('…and on top of Jackpot Dance', near(l.getFullLineMultiplier(), 1.5 * Math.pow(1.1, 5), 1e-12));
  const luck0 = l.getLuck().hamster;
  l.buyUpgrade('rabbitsFoot', Infinity);
  check('the Rabbit\'s Foot maxed: +20 Hamster Luck', l.getLuck().hamster === luck0 + 20);

  const t = newGame(63);
  t.addCoins(1e9);
  check('tokens to start with: 1 per golden jackpot, one every 5th delivery, 5 past cards',
    t.getJackpotTokens() === 1 && t.getDeliveryTokenEvery() === 5 && t.getCardHistory && t.getOfflineMultiplier() === 1);
  t.buyUpgrade('goldenTouch', Infinity);
  t.buyUpgrade('tipJar');
  t.buyUpgrade('cardCounter');
  check('Golden Touch (+2), the Tip Jar (every 3rd) and the Card Counter (+3 cards)',
    t.getJackpotTokens() === 3 && t.getDeliveryTokenEvery() === 3);
  const u = newGame(64);
  check('an upgrade that isn\'t bought yet does nothing (the Tip Jar at level 0)', u.getDeliveryTokenEvery() === 5);
});

// ─────────────────────────────────────────────────────────────
describe('the machines\' new upgrades: Ball Bearings, Deep Pockets, Acorn Stash, Sharp Cheddar', () => {
  const g = newGame(71);
  g.addCoins('1e16');
  g.buyMachine('bonanza');
  const award0 = g.getEconomy().freeSpins.perTrigger;
  for (const u of soldOn(bonanza, 'extraFreeSpins')) g.buyUpgrade(u.id, Infinity);
  check('Ball Bearings is the Bonanza\'s own', upgrade('ballBearings').scope === 'machine' && g.getUpgradeLevel('ballBearings') === 3);
  check('…and adds 3 free spins a trigger on top of the Bouncy Balls', near(g.getEconomy().freeSpins.perTrigger, award0 + 15 + 3, 1e-9));
  for (const u of soldOn(bonanza, 'luck')) g.buyUpgrade(u.id, Infinity);
  plant(g, 'familyPride', 'ballPit', 'ballPit', 'ballPit', 'luckyFamily', 'luckyFamily', 'luckyFamily', 'luckyFamily');
  const extra = soldOn(bonanza, 'extraFreeSpins').reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0);
  const f = freeSpinStats({ ...bonanza, symbols: g.getSymbols() }, 5, extra);
  check(`rule 5 with Ball Bearings: free spins still end (retrigger loop ${(f.q * f.perTrigger).toFixed(3)} < 1)`, f.q * f.perTrigger < 1);

  g.buyMachine('palace');
  const pot0 = g.getPotSeedMultiplier();
  g.buyUpgrade('deepPockets', Infinity);
  check('Deep Pockets maxed: pots start at x2 their seed (every machine\'s, a hamster upgrade)', near(g.getPotSeedMultiplier(), pot0 + 1, 1e-12));
  // 1.8.1 fix: the pots already in play grow to the new seed at once (they only did at the
  // next reload or life before, so a reload changed them).
  const palacePots = g.state.machines.find((m) => m.typeId === 'palace').pots;
  const palaceDef = data.machines.find((m) => m.id === 'palace');
  check('…and the Pouch Palace\'s pots in play grow to the new seed at once',
    palaceDef.jackpot.pots.every((p) => num(palacePots[p.id]) >= roundMoney(p.seed * g.getPotSeedMultiplier())));
  const saved = JSON.stringify(g.toSaveData());
  const g2 = newGame(71);
  g2.loadSaveData(JSON.parse(saved));
  check('…so a save and reload leaves the pots as they were', JSON.stringify(g2.toSaveData().machines.map((m) => m.pots)) === JSON.stringify(JSON.parse(saved).machines.map((m) => m.pots)));
  g.buyMachine('vault');
  const r0 = g.getHoldRespins();
  g.buyUpgrade('acornStash');
  check('Acorn Stash: one more respin', g.getHoldRespins() === r0 + 1);
  g.buyMachine('cheese');
  const w0 = g.getWheelBonus();
  g.buyUpgrade('sharpCheddar');
  check('Sharp Cheddar: +1 on every wedge', g.getWheelBonus() === w0 + 1);
});

// ─────────────────────────────────────────────────────────────
describe('Hot Sauce: Hot Streak pays more for every win in a row', () => {
  const g = newGame(81);
  g.addCoins('1e16');
  g.buyUpgrade('hotSauce');
  check('Hot Sauce needs Hot Streak', g.getUpgradeLevel('hotSauce') === 0);
  g.buyUpgrade('hotStreak', Infinity);
  g.buyUpgrade('hotSauce', Infinity);
  check('Hot Sauce maxed: +7% a win in a row (5% + 2%), up to x2.75 on the 5th', near(g.getMaxStreakMultiplier(), 2.75, 1e-12));
  g.buyUpgrade('blazingStreak', Infinity);
  check('…and x3.80 on the 8th with Blazing Streak too', near(g.getMaxStreakMultiplier(), 3.8, 1e-12));
  g.buyUpgrade('thirdReel');
  const e = g.getEconomy();
  let sum = 0;
  for (let k = 1; k <= 8; k++) sum += Math.pow(e.hitRate, k);
  check('the EV\'s streak factor is exact with both', near(e.streakFactor, 1 + 0.35 * sum, 1e-12));
  const rtps = g.getBetSteps().map((_, i) => { g.setBet(i); return g.getEconomy().rtp; });
  check('the bet still never changes the RTP', rtps.every((r) => near(r, rtps[0], 1e-12)));
});

// ─────────────────────────────────────────────────────────────
describe('the Hamster Helper (Helping Paws)', () => {
  const none = newGame(91);
  none.addCoins(1e6);
  check('without Helping Paws there is no helper, and it can\'t be switched on', !none.hasHelper() && !none.setHelper(true));
  none.update(30);
  check('…and nothing gets bought', none.state.stats.upgradesBought === 0);

  const g = newGame(92);
  plant(g, 'familyPride', 'familyFortune', 'helpingPaws');
  check('Helping Paws planted: the helper is there, and on', g.hasHelper() && g.state.helper === true);
  g.addCoins(20000);
  const bought = [];
  g.on('upgradeBought', (e) => bought.push({ ...e, coinsBefore: num(g.state.coins) + num(e.cost) }));
  const cheapest = () => Math.min(...g.getAvailableUpgrades().filter((u) => g.canBuyUpgrade(u.id)).map((u) => num(g.getUpgradeCost(u.id))));
  const first = cheapest();
  g.update(0.99);
  check('it waits a second before it looks at the shop', bought.length === 0);
  g.update(0.02);
  check('then it buys the cheapest upgrade on sale', bought.length === 1 && bought[0].helper && near(num(bought[0].cost), first, 1e-9) && bought[0].count === 1);
  const machines = g.state.machines.length;
  g.update(120);
  check(`it keeps buying, one level a second (${bought.length} in 121 s)`, bought.length > 10 && bought.length <= 121);
  check('it never spends more than a tenth of your coins on one level', bought.every((b) => num(b.cost) <= 0.1 * b.coinsBefore + 1e-6));
  check('it never buys a machine', g.state.machines.length === machines);
  check('its levels are counted, and Little Helper is earned', g.state.stats.helperBuys === bought.length && g.state.diary.littleHelper);
  const n = bought.length;
  check('switched off, it stops', g.setHelper(false) && (g.update(30), bought.length === n));
  g.setHelper(true);
  g.openBigCage();
  g.update(30);
  check('it rests in the Big Cage', bought.length === n);
  g.leaveBigCage();
  const save = g.toSaveData();
  check('the save remembers the switch', save.helper === true);
  g.setHelper(false);
  const h = newGame(93);
  h.loadSaveData(g.toSaveData());
  check('…switched off too', h.state.helper === false && h.hasHelper());
});

// ─────────────────────────────────────────────────────────────
describe('the Four-Leaf Heirloom and the new stickers', () => {
  const g = newGame(101);
  plant(g, 'familyPride', 'luckyFamily', 'luckyHeirlooms', 'cloverHeirloom', 'cloverHeirloom');
  check('Four-Leaf Heirloom maxed: the pup has Four-Leaf Clover Lv 2 for free', g.getUpgradeLevel('clover') === 2);
  nextLife(g);
  check('…every life', g.getUpgradeLevel('clover') === 2 && num(g.getUpgradeCost('clover')) === upgrade('clover').baseCost * 4);

  const s = newGame(102);
  const all = data.diary.filter((d) => d.goal.type !== 'stickers').slice(0, 30);
  for (const d of all) s.state.diary[d.id] = true;
  s.addCoins(1e3);
  s.spin('manual');
  check('Sticker Book: 30 stickers', s.countStickers() >= 30 && s.state.diary.stickerBook);
  const d = newGame(103);
  for (let gen = 2; gen <= 10; gen++) nextLife(d);
  check('Dynasty at generation 10, Billionaire at a billion coins earned', d.state.diary.dynasty && d.state.diary.billionaire);
  const o = newGame(104);
  o.addCoins(1e6);
  o.buyUpgrade('wheel');
  o.applyOfflineEarnings(3600);
  check('Night Owl: coins earned while away', o.state.diary.nightOwl);
});

// ─────────────────────────────────────────────────────────────
describe('save v12 (1.3.1 added it; later saves keep it)', () => {
  const g = gameWithWholeTree(111);
  const save = g.toSaveData();
  check('a save has the helper\'s switch and the new stats', save.saveVersion === SAVE_VERSION
    && save.helper === true && save.stats.doubleWins === 0 && save.stats.helperBuys === 0);
  const v11 = structuredClone(save);
  v11.saveVersion = 11;
  delete v11.helper;
  delete v11.stats.doubleWins;
  delete v11.stats.helperBuys;
  const h = newGame(112);
  check('a v11 save loads: the helper on, the new stats at 0', h.loadSaveData(v11) && h.state.helper === true && h.state.stats.doubleWins === 0 && h.state.stats.helperBuys === 0);
  const broken = structuredClone(save);
  broken.helper = 'yes';
  broken.stats.doubleWins = -4;
  const b = newGame(113);
  check('a broken switch counts as on; a broken stat as 0', b.loadSaveData(broken) && b.state.helper === true && b.state.stats.doubleWins === 0);
});
