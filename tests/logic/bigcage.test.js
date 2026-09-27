// bigcage.test.js — M8, The Big Cage: held Heirloom Seeds, the Big Cage between
// lives (the only place to plant), the new Family Tree traits, and Machine Stars
// (rebuilding a fully upgraded machine).

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  spinExpectation, jackpotStats, freeSpinStats, data, near, deepEqual, num, newGame,
  clunky, bonanza, palace, nodes, upgrade, land, soldOn, plant,
} from './helpers.js';

const node = (id) => nodes.find((n) => n.id === id);
const r = data.retirement;
const coinsFor = (n) => r.seedDivisor * Math.pow(n, 1 / r.seedExponent);

// ─────────────────────────────────────────────────────────────
describe('held seeds: the heirloom bonus counts the seeds you keep', () => {
  const g = newGame(201);
  g.addCoins(coinsFor(10), true);
  g.retire();
  const per = r.payoutBonusPerSeedHeld;
  check(`10 seeds held: +${(10 * per * 100).toFixed(0)}% payouts`, num(g.state.seeds) === 10 && near(num(g.getPayoutMultiplier()), 1 + 10 * per, 1e-9));
  const pride = g.previewTreeNode('familyPride');
  check('a trait\'s preview counts the seeds planting spends (Family Pride: the payouts you\'d really have)',
    near(num(pride.now), 1 + 10 * per, 1e-9) && near(num(pride.next), 1 + node('familyPride').effect.perLevel + 9 * per, 1e-9) && num(g.state.seeds) === 10);
  g.buyTreeNode('familyPride'); // 1 seed: +25%, and one held seed's bonus is gone
  check(`planting spends the seed's bonus: Family Pride (1 seed) → 1 + 0.25 + 9 × ${per}`,
    near(num(g.getPayoutMultiplier()), 1 + node('familyPride').effect.perLevel + 9 * per, 1e-9));
  const fortune = node('familyFortune').effect.perLevel;
  const cost = num(g.getTreeCost('familyFortune'));
  const preview = g.previewTreeNode('familyFortune');
  check('Family Fortune previews the bonus per held seed', near(preview.now, per, 1e-12) && near(preview.next, per + fortune, 1e-12));
  g.buyTreeNode('familyFortune');
  const held = 9 - cost;
  check(`Family Fortune: every held seed pays ${((per + fortune) * 100).toFixed(1)}%`,
    near(g.getHeldSeedBonusPerSeed(), per + fortune, 1e-12) && near(num(g.getHeirloomBonus()), held * (per + fortune), 1e-9));
  check('the diary counts the most seeds ever held', g.state.stats.mostSeedsHeld === 10);
  const rich = newGame(202);
  rich.addSeeds(30);
  check('Nest Egg: holding 25 seeds earns the sticker', rich.state.diary.nestEgg === true && rich.state.stats.mostSeedsHeld === 30);
});

// ─────────────────────────────────────────────────────────────
describe('the Big Cage: between lives, time stands still, and you plant', () => {
  const g = newGame(203);
  g.addCoins(1e4);
  g.buyUpgrade('wheel');
  g.addCoins(coinsFor(4), true);
  const events = [];
  g.on('spinBlocked', (e) => events.push(e.reason));
  g.on('bigCageLeft', (e) => events.push(`left ${e.generation} ${e.name}`));
  check('not in the Big Cage during a life', g.state.bigCage === false && g.buyTreeNode('familyPride') === false);
  g.retire();
  check('retiring opens the Big Cage', g.state.bigCage === true && g.canRetire() === false);
  const time = g.state.stats.playTime;
  const spins = g.state.stats.spins;
  plant(g, 'familyPride', 'warmUpLaps'); // auto-spin from the start
  g.update(60);
  check('time stands still: no play time, no auto-spins', g.state.stats.playTime === time && g.state.stats.spins === spins && g.getUpgradeLevel('wheel') === 1);
  check('spins wait (reason "bigCage"), and so do deliveries', g.spin() === false && events.includes('bigCage') && g.startDelivery() === false);
  check('no offline pay for time spent in the Big Cage', num(g.getOfflineEarnings(3600).coins) === 0 && g.applyOfflineEarnings(3600) === false);
  check('you can plant there (seeds held)', g.state.bigCage && g.canBuyTreeNode('speedyScooter') === num(g.state.seeds) >= num(g.getTreeCost('speedyScooter')));
  check('leaving starts the new life', g.leaveBigCage() === true && g.state.bigCage === false && events.includes(`left 2 ${g.getPupName()}`));
  check('… and only once', g.leaveBigCage() === false);
  g.update(30);
  check('time runs again: auto-spin plays', g.state.stats.spins > spins && g.state.stats.playTime > time);
  check('planting is closed again until the next retirement', g.canBuyTreeNode('speedyScooter') === false);

  const d = newGame(204);
  check('debug: openBigCage lets you plant without retiring (the generation stays)', d.openBigCage() === true && d.state.bigCage && d.state.generation === 1 && d.openBigCage() === false);
  d.leaveBigCage();
});

// ─────────────────────────────────────────────────────────────
describe('new Family Tree traits (M8)', () => {
  // Big Spender: High Roller levels at the start of every life.
  const b = newGame(205);
  plant(b, 'familyPride', 'bigSpender');
  check('Big Spender: High Roller Lv 1 right away (bet ×2 unlocked)', b.getUpgradeLevel('highRoller') === 1 && b.getMaxBetIndex() === 1);
  plant(b, 'bigSpender');
  b.addCoins(coinsFor(1), true);
  b.retire();
  check('Big Spender Lv 2: every life starts with High Roller Lv 2', b.getUpgradeLevel('highRoller') === 2);
  b.leaveBigCage();

  // Seed Vault: every machine starts with its symbol unlocks.
  const v = newGame(206);
  plant(v, 'familyPride', 'bigSpender', 'seedVault');
  check('Seed Vault Lv 1: Old Clunky has its Baby Carrot right away', v.getUpgradeLevel('newSeeds') === 1 && !v.isSymbolLocked('carrot') && v.isSymbolLocked('golden'));
  v.addCoins(1e6);
  v.buyMachine('stacker');
  check('… and a machine bought later starts with its first unlock too', v.getUpgradeLevel('snackRestock') === 1 && !v.isSymbolLocked('strawberry'));
  plant(v, 'seedVault');
  check('Seed Vault Lv 2: every symbol, on every machine you own', v.getUpgradeLevel('snackRestock') === 2 && v.getMachineInfo('clunky').symbols.unlocked === 2);
  check('it doesn\'t count as buying unlocks (no diary sticker for free)', v.state.stats.symbolsUnlocked === 0);

  // Lucky Family (Hamster Luck) and Lucky Heirlooms (Machine Luck levels).
  const l = newGame(207);
  plant(l, 'familyPride', 'luckyFamily', 'luckyFamily');
  const lf = node('luckyFamily').effect.perLevel;
  check(`Lucky Family Lv 2: +${2 * lf} Hamster Luck on every machine`, deepEqual(l.getLuck(), { hamster: 2 * lf, machine: 0, total: 2 * lf }));
  plant(l, 'luckyHeirlooms', 'luckyHeirlooms');
  const perLuckLevel = upgrade('horseshoe').effect.perLevel;
  check('Lucky Heirlooms Lv 2: every machine starts with Machine Luck Lv 2', l.getUpgradeLevel('horseshoe') === 2 && l.getLuck().machine === 2 * perLuckLevel);
  l.addCoins(1e6);
  l.buyMachine('stacker');
  check('… the Snack Stacker too (Lucky Sprinkles Lv 2)', l.getUpgradeLevel('sprinkles') === 2);

  // Snack Inheritance: every pup owns the Snack Stacker.
  const s = newGame(208);
  plant(s, 'familyPride', 'bigSpender', 'seedVault', 'snackInheritance');
  check('Snack Inheritance: the Snack Stacker is owned right away (still running Old Clunky)',
    s.ownsMachine('stacker') && s.getMachineData().id === 'clunky' && s.state.stats.machinesBought === 0);
  check('… and it got the family\'s free levels (Seed Vault)', s.getMachineInfo('stacker').symbols.unlocked === 1);
  s.addCoins(coinsFor(1), true);
  s.retire();
  check('… and again in every new life', s.ownsMachine('stacker') && s.state.machines.length === 2);
  s.leaveBigCage();

  // Ball Pit: more Hamster Balls on the Burrow Bonanza (free spins); exact odds.
  const p = newGame(209);
  p.addCoins(1e9);
  p.buyMachine('bonanza');
  const before = p.getFeatureOdds().freeSpins.chance;
  const ball = bonanza.symbols.find((x) => x.id === bonanza.freeSpins.symbol);
  plant(p, 'familyPride', 'ballPit');
  const md = { ...bonanza, symbols: p.getSymbols() };
  check(`Ball Pit Lv 1: the Hamster Ball weighs ${ball.weight} + ${node('ballPit').effect.perLevel}, so free spins come sooner`,
    near(md.symbols.find((x) => x.id === ball.id).weight, ball.weight + node('ballPit').effect.perLevel, 1e-9) && p.getFeatureOdds().freeSpins.chance > before);
  check('… and the EV is still exact (spinExpectation with the new weights)', near(p.getEconomy().ev, spinExpectation(md, 5, { lines: p.getLineCount() }).ev, 1e-9));

  // Golden Pouches: pots start (and restart) bigger; the EV counts it exactly.
  const j = newGame(210);
  j.addCoins(1e9);
  j.buyMachine('palace');
  plant(j, 'familyPride', 'ballPit', 'goldenPouches');
  const mult = 1 + node('goldenPouches').effect.perLevel;
  const grand = palace.jackpot.pots.at(-1);
  check(`Golden Pouches Lv 1: every pot starts at its seed × ${mult}`, near(num(j.getJackpotPots().at(-1).base), grand.seed * mult, 0.01));
  const jmd = { ...palace, symbols: j.getSymbols() };
  check('… and the jackpot EV counts the bigger seeds exactly',
    near(j.getEconomy().jackpot.ev, jackpotStats(jmd, 5, 1, mult).ev, 1e-9) && j.getEconomy().jackpot.ev > jackpotStats(jmd, 5, 1, 1).ev);
  j.triggerJackpot(grand.id);
  j.update(palace.jackpot.duration + 0.1);
  check('… and a won pot starts again at the bigger seed', near(num(j.getJackpotPots().at(-1).base), grand.seed * mult, 0.01));

  // Free spins must still always end with every ball the family can add.
  const whole = newGame(211);
  whole.addCoins(1e12);
  whole.buyMachine('bonanza');
  plant(whole, ...nodes.map((n) => n.id), 'ballPit', 'ballPit', 'luckyFamily', 'luckyFamily', 'luckyFamily');
  for (const u of soldOn(bonanza, 'luck')) whole.buyUpgrade(u.id, Infinity);
  for (const u of soldOn(bonanza, 'extraFreeSpins')) whole.buyUpgrade(u.id, Infinity);
  const extra = soldOn(bonanza, 'extraFreeSpins').reduce((sum, u) => sum + u.maxLevel * u.effect.perLevel, 0);
  const f = freeSpinStats({ ...bonanza, symbols: whole.getSymbols() }, 5, extra);
  check(`free spins always end with the whole tree, max Luck and every Bouncy Ball (retrigger loop ${(f.q * f.perTrigger).toFixed(3)} < 1)`,
    f.q * f.perTrigger < 1 && Number.isFinite(f.total));
});

// ─────────────────────────────────────────────────────────────
describe('Machine Stars: rebuild a fully upgraded machine', () => {
  const st = data.stars;
  const g = newGame(212);
  g.addCoins(1e9);
  check('a machine with upgrades still to buy can\'t be rebuilt', g.canRebuild('clunky') === false && g.rebuild('clunky') === false);
  for (const u of g.getAvailableUpgrades().filter((x) => x.scope === 'machine')) g.buyUpgrade(u.id, Infinity);
  g.buyUpgrade('cheeks', 3);
  check('every Old Clunky upgrade maxed: it can be rebuilt', g.getMachineInfo('clunky').fullyUpgraded && g.canRebuild('clunky'));
  const events = [];
  g.on('machineRebuilt', (e) => events.push(e));
  check('rebuild: a star, and the machine\'s upgrades start again', g.rebuild('clunky') && g.getStars('clunky') === 1
    && g.getUpgradeLevel('thirdReel') === 0 && g.getUpgradeLevel('lever') === 0 && g.getReelCount() === 2 && events[0] && events[0].stars === 1);
  check('the hamster\'s own upgrades are untouched (Chubby Cheeks)', g.getUpgradeLevel('cheeks') === 3);
  check(`a star: payouts × ${1 + st.payoutPerStar} and +${st.luckPerStar} Machine Luck on that machine`,
    near(g.getStarMultiplier(), 1 + st.payoutPerStar, 1e-12) && g.getLuck().machine === st.luckPerStar);
  check('stats and the Shooting Star sticker', g.state.stats.rebuilds === 1 && g.state.stats.bestStars === 1 && g.state.diary.shootingStar === true);

  // The star multiplies a real spin's payout (a forced Sunflower pair).
  let paid = null;
  g.on('spinResolved', (e) => { paid = e; });
  g.spin('auto');
  g.state.machines[0].result = [['seed'], ['seed']];
  land(g);
  const expected = clunky.payouts.seed['2'] * num(g.getPayoutMultiplier()) * g.getStarMultiplier();
  check('a spin on a starred machine pays × its stars', paid && near(num(paid.payout), Math.round(expected * 100) / 100, 0.005), `${paid && paid.payout} vs ${expected}`);
  const econ = g.getEconomy();
  check('the economy counts the stars (RTP, profit, the payout multiplier)',
    near(econ.starMultiplier, 1 + st.payoutPerStar, 1e-12) && near(num(econ.payoutMultiplier), num(g.getPayoutMultiplier()) * econ.starMultiplier, 1e-9));

  // Up to the max, and kept forever.
  for (let i = 1; i < st.max; i++) {
    for (const u of g.getAvailableUpgrades().filter((x) => x.scope === 'machine')) g.buyUpgrade(u.id, Infinity);
    g.rebuild('clunky');
  }
  for (const u of g.getAvailableUpgrades().filter((x) => x.scope === 'machine')) g.buyUpgrade(u.id, Infinity);
  check(`at most ${st.max} stars`, g.getStars('clunky') === st.max && g.canRebuild('clunky') === false && g.rebuild('clunky') === false);
  check('All-Star: the sticker for a machine with every star', g.state.diary.allStar === true);
  g.addCoins(coinsFor(3), true);
  g.retire();
  check('stars are kept when the hamster retires', g.getStars('clunky') === st.max && g.getMachineInfo('stacker').stars === 0);
  g.leaveBigCage();

  // Not while the machine is busy.
  const b = newGame(213);
  b.addCoins(1e12);
  b.buyMachine('bonanza');
  for (const u of b.getAvailableUpgrades().filter((x) => x.scope === 'machine')) b.buyUpgrade(u.id, Infinity);
  b.addFreeSpins(3);
  check('not while free spins are waiting', b.canRebuild('bonanza') === false);
  b.update(120);
  check('… and yes once they\'re done', b.state.machines.find((m) => m.typeId === 'bonanza').freeSpins === null && b.canRebuild('bonanza'));
  b.spin('manual');
  check('not while it spins', b.canRebuild('bonanza') === false);

  // Tree free levels come straight back after a rebuild.
  const h = newGame(214);
  plant(h, 'familyPride', 'warmUpLaps', 'quickPaws', 'heirloomReel');
  h.addCoins(1e9);
  for (const u of h.getAvailableUpgrades().filter((x) => x.scope === 'machine')) h.buyUpgrade(u.id, Infinity);
  h.rebuild('clunky');
  check('Heirloom Reel\'s Third Reel comes straight back after a rebuild', h.getReelCount() === 3 && h.getStars('clunky') === 1);

  // Stars and pots: a pot pays × the stars too.
  const p = newGame(215);
  p.addCoins(1e12);
  p.buyMachine('palace');
  p.state.stars.palace = 2; // (test shortcut: as if rebuilt twice)
  const pot = palace.jackpot.pots[0];
  const won = [];
  p.on('jackpotWon', (e) => won.push(e));
  const value = num(p.getJackpotPots()[0].value);
  p.triggerJackpot(pot.id);
  p.update(palace.jackpot.duration + 0.1);
  check('a jackpot pot pays × the machine\'s stars (and the marquee shows it)', won[0] && near(num(won[0].amount), value, 0.01)
    && near(value, num(p.getJackpotPots()[0].base) * num(p.getPayoutMultiplier()) * (1 + 2 * st.payoutPerStar) * p.getBet(), 0.01));
  // The exact EV with stars: RTP scales with the star multiplier.
  const q = newGame(216);
  const rtp0 = q.getEconomy().rtp;
  q.state.stars.clunky = 1; // (test shortcut)
  const exact = (spinExpectation({ ...clunky, symbols: q.getSymbols() }, 2).ev * num(q.getPayoutMultiplier()) * (1 + st.payoutPerStar)) / clunky.spinCost;
  check('RTP with a star = the exact EV (with the star\'s Luck) × the star multiplier', near(q.getEconomy().rtp, exact, 1e-9) && q.getEconomy().rtp > rtp0);
});
