// colony.test.js — 1.4.0, The Great Migration: the mega rebirth (a new colony:
// the generation, Heirloom Seeds, the tree and Machine Stars start again, for Golden
// Whiskers), colony perks, the seed softcap, Colony Trials, the Wise Elders
// (automation), Moving Day (the 8th machine, with boxes) and the colony traits; save v14.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  createRng, createGame, data, near, num, money, newGame, deepEqual, SAVE_VERSION,
} from './helpers.js';
import { migrateSave } from '../../src/logic/game.ts';

const col = data.colony;
const firstTree = data.familyTree.nodes.filter((n) => !n.colony);
const colonyTraits = data.familyTree.nodes.filter((n) => n.colony);
const perk = (id) => col.perks.find((p) => p.id === id);

// Plant every trait this colony can grow, each to its max (Family Fortune once): "the whole tree".
function completeTree(g) {
  if (!g.state.bigCage) g.openBigCage();
  g.addSeeds(1e7);
  for (let pass = 0; pass < 20; pass++) {
    for (const n of data.familyTree.nodes) {
      if (n.maxLevel === null && g.getTreeLevel(n.id) > 0) continue;
      while (g.canBuyTreeNode(n.id)) g.buyTreeNode(n.id);
    }
  }
  g.addSeeds(g.state.seeds.neg()); // no held seeds left over
}

// A family that has made the Great Migration once (in the Big Cage, as a migration leaves it).
function migrated(seed = 1) {
  const g = newGame(seed);
  completeTree(g);
  g.migrate();
  return g;
}
// …and whose new colony has had a few hamsters already: Colony Trials are open.
function trialFamily(seed = 1) {
  const g = migrated(seed);
  g.state.generation = col.trialGeneration;
  return g;
}

// ─────────────────────────────────────────────────────────────
describe('the Great Migration: when it opens, what it resets, what it keeps', () => {
  const g = newGame(301);
  check('a new family can\'t migrate', g.canMigrate() === false && g.isTreeComplete() === false && g.migrate() === false);
  g.openBigCage();
  g.addSeeds(1e7);
  for (const n of firstTree) g.buyTreeNode(n.id);
  check('every trait planted once is not yet "the whole tree" (the traits with levels to go)', !g.isTreeComplete() && !g.canMigrate());
  completeTree(g);
  const progress = g.getTreeProgress();
  check('the whole tree: every first-colony trait at its max (colony traits don\'t count yet)',
    g.isTreeComplete() && progress.done === progress.total && progress.total === firstTree.length, JSON.stringify(progress));
  check('… and then the family can migrate', g.canMigrate());

  // Some things to keep: skins, tokens, a sticker, chips, stats.
  g.ownAllSkins();
  g.addTokens(7);
  g.addChips(500);
  g.state.stars.clunky = 3;
  g.state.seedsEarned = money(40000);
  g.state.generation = 14;
  const tokens = num(g.state.tokens);
  const skins = Object.keys(g.state.skins.owned).length;
  const diary = Object.keys(g.state.diary).length;
  const chips = num(g.state.casino.chips);
  const spins = g.state.stats.spins;
  const expected = Math.floor(Math.pow(40000 / col.whiskerDivisor, col.whiskerExponent));
  check('the pending whiskers follow the formula (seeds earned this colony)', num(g.getPendingWhiskers()) === expected, `${num(g.getPendingWhiskers())} vs ${expected}`);
  const events = [];
  g.on('migrated', (e) => events.push(e));
  check('migrate() works', g.migrate() === true);
  check('the migrated event says the new colony, the whiskers, the seeds and the generations',
    events.length === 1 && events[0].colony === 1 && num(events[0].whiskers) === expected && num(events[0].seedsEarned) === 40000 && events[0].generations === 14);
  check('the family starts again: generation 1, no seeds, a bare tree, no stars, no colony coins',
    g.state.generation === 1 && num(g.state.seeds) === 0 && num(g.state.seedsEarned) === 0 && deepEqual(g.state.tree, {})
    && deepEqual(g.state.stars, {}) && num(g.state.colonyCoins) === 0 && g.state.colony === 1);
  check('… and waits in the Big Cage for its first pup', g.state.bigCage === true && g.leaveBigCage() === true);
  check('whiskers, tokens, skins, stickers, chips and stats are kept',
    num(g.state.whiskers) === expected && num(g.state.tokens) >= tokens && Object.keys(g.state.skins.owned).length === skins
    && Object.keys(g.state.diary).length >= diary && num(g.state.casino.chips) === chips && g.state.stats.spins === spins
    && g.state.stats.migrations === 1 && num(g.state.stats.whiskersEarned) === expected);
  check('the New Horizons sticker', g.state.diary.newHorizons === true);
  check('the casino stays open for a migrated family (generation 1)', g.isCasinoUnlocked() && g.isCasinoOpen());
  check('the pups\' names start further along the list in a new colony', g.getPupName(1) !== createGame(structuredClone(data), createRng(1)).getPupName(1));
  // Rebirth upgrades (1.3.1) opened long ago: they stay open at generation 1.
  const fresh = createGame(structuredClone(data), createRng(5)); // (no debug unlock)
  const rebirth = data.upgrades.filter((u) => u.unlock && u.unlock.generation);
  check('a new family\'s rebirth upgrades are locked at generation 1', rebirth.every((u) => !fresh.isUpgradeUnlocked(u.id)));
  fresh.state.colony = 1;
  check('… a migrated family\'s are open at generation 1', rebirth.every((u) => fresh.isUpgradeUnlocked(u.id)));

  // Migrating during a life: this life's pending seeds count too.
  const h = newGame(302);
  completeTree(h);
  h.leaveBigCage();
  h.addCoins(1e12, true);
  const pending = h.getPendingSeeds();
  check('during a life, the migration counts this life\'s pending seeds too',
    h.canMigrate() && num(h.getMigrationSeeds()) === num(h.state.seedsEarned.add(pending)));
  const w = num(h.getPendingWhiskers());
  check('… and migrating from a life works (into the Big Cage)', h.migrate() && h.state.bigCage && num(h.state.whiskers) === w && w >= 1);
  check('a migration pays at least one whisker', num(migrated(303).state.whiskers) >= 1);
});

// ─────────────────────────────────────────────────────────────
describe('colony perks (Golden Whiskers)', () => {
  const g = migrated(311);
  g.leaveBigCage();
  g.state.whiskers = money(1e6);
  for (const p of col.perks) {
    const cost = num(g.getPerkCost(p.id));
    const before = num(g.state.whiskers);
    check(`${p.name}: costs baseCost at level 0 and spends it (rule 3)`, cost === p.baseCost && g.buyPerk(p.id) && num(g.state.whiskers) === before - cost);
  }
  const pride = perk('colonyPride');
  const m0 = num(g.getPayoutMultiplier());
  g.buyPerk('colonyPride');
  check('Colony Pride multiplies payouts (a group of its own: ×(1 + levels × perLevel))',
    near(num(g.getPayoutMultiplier()) / m0, (1 + 2 * pride.effect.perLevel) / (1 + pride.effect.perLevel), 1e-9));
  check('Colony Pride\'s second level costs baseCost × growthRate (rule 3)', num(g.getPerkCost('colonyPride')) === Math.floor(pride.baseCost * pride.growthRate ** 2));
  const sense = perk('seedSense');
  check('Seed Sense adds its share to every seed total', near(g.getSeedGain(), sense.effect.perLevel, 1e-12));
  check('Trailblazer: one more Machine Star', g.getMaxStars() === data.stars.max + perk('trailblazer').effect.perLevel);
  check('Old Friends: this pup already owns the Burrow Bonanza after the next retirement', (() => {
    g.addCoins(1e9, true);
    g.retire();
    const owns = g.ownsMachine('bonanza');
    g.leaveBigCage();
    return owns;
  })());
  check('the perks are kept through the next migration', (() => {
    completeTree(g);
    const levels = { ...g.state.perks };
    g.migrate();
    return deepEqual(g.state.perks, levels) && g.state.colony === 2;
  })());
  check('a maxed perk can\'t be bought', g.isPerkMaxed('wiseElders') && g.canBuyPerk('wiseElders') === false && g.buyPerk('wiseElders') === false);
  const poor = migrated(312);
  poor.state.whiskers = money(0);
  check('no whiskers, no perk', poor.canBuyPerk('colonyPride') === false && poor.buyPerk('colonyPride') === false);
  // Rule 4: perks never touch the odds. Every machine's RTP is the same with every perk.
  const q = newGame(313);
  const before = q.getEconomy();
  q.state.colony = 1;
  q.state.perks = Object.fromEntries(col.perks.map((p) => [p.id, p.maxLevel || 5]));
  const after = q.getEconomy();
  check('colony perks don\'t change the odds (the hit rate and the EV per ×1 are the same)', near(before.hitRate, after.hitRate, 1e-12) && near(before.ev, after.ev, 1e-9));
});

// ─────────────────────────────────────────────────────────────
describe('the seed softcap (longer late lives)', () => {
  const r = data.retirement;
  const cap = r.seedSoftcap;
  const g = newGame(321);
  const seedsAt = (coins) => { g.state.colonyCoins = money(coins); return num(g.getPendingSeeds()); };
  const oldSeeds = (coins) => Math.floor(Math.pow(coins / r.seedDivisor, r.seedExponent) + 1e-9);
  const capCoins = r.seedDivisor * Math.pow(cap.seeds, 1 / r.seedExponent);
  check('below the softcap the seeds are as before', [1300, 5e4, 1e6, capCoins * 0.99].every((c) => seedsAt(c) === oldSeeds(c)));
  check('past the softcap they grow more slowly', [capCoins * 4, capCoins * 100, 1e20].every((c) => seedsAt(c) < oldSeeds(c)));
  check('… and still always grow', [capCoins, capCoins * 2, capCoins * 10, 1e15, 1e20, 1e30].every((c, i, a) => i === 0 || seedsAt(c) > seedsAt(a[i - 1])));
  const t = capCoins * 16;
  check('the softer curve: past the cap, seeds grow as coins ^ exponent', near(seedsAt(t), Math.floor(cap.seeds * Math.pow(t / capCoins, cap.exponent)), 1));
  // The progress bar's "next seed at" is the inverse of the formula.
  let ok = true;
  for (const c of [2e5, capCoins * 3, 1e14, 1e22]) {
    g.state.colonyCoins = money(c);
    const p = g.getSeedProgress();
    const nextAt = num(p.nextAt);
    g.state.colonyCoins = money(nextAt * 1.000001);
    const more = num(g.getSeedProgress().total);
    if (!(p.progress >= 0 && p.progress <= 1 && more === num(p.total) + 1)) ok = false;
  }
  check('the progress bar\'s next seed comes exactly where it says', ok);
  check('seeds come from this colony\'s coins, not lifetime coins', (() => {
    const h = newGame(322);
    h.state.stats.coinsEarned = money(1e15);
    h.state.colonyCoins = money(0);
    return num(h.getPendingSeeds()) === 0;
  })());
  check('earning coins counts toward the colony\'s coins', (() => {
    const h = newGame(323);
    h.addCoins(5000, true);
    return num(h.state.colonyCoins) === 5000 && num(h.state.stats.coinsEarned) === 5000;
  })());
});

// ─────────────────────────────────────────────────────────────
describe('Colony Trials', () => {
  const plainFamily = newGame(331);
  plainFamily.openBigCage();
  check('trials only open after a migration', !plainFamily.trialsOpen() && !plainFamily.canStartTrial(col.trials[0].id) && !plainFamily.startTrial(col.trials[0].id));
  check(`… and from each colony's hamster ${col.trialGeneration} on (the first ones have little a twist could take away)`, (() => {
    const h = migrated(330);
    const first = h.trialsOpen() || h.canStartTrial(col.trials[0].id);
    h.state.generation = col.trialGeneration - 1;
    const before = h.trialsOpen();
    h.state.generation = col.trialGeneration;
    return !first && !before && h.trialsOpen() && h.canStartTrial(col.trials[0].id);
  })());

  for (const t of col.trials) {
    const g = trialFamily(332);
    g.state.seedsEarned = money(400);
    g.state.seeds = money(10);
    // A family with a bit of everything, so each twist has something to take away.
    completeTreeKeepSeeds(g);
    g.addCoins(1e9); // (not earned: no seeds)
    g.state.stars.clunky = 3;
    g.ownAllSkins();
    for (const s of data.skins) if (s.effects && s.effects.length) g.equipSkin(s.id);
    const goal = num(g.getTrialGoal(t.id));
    check(`${t.name}: the goal is ${t.goalShare} × the seeds earned this colony (at least ${t.minSeeds})`, goal === Math.max(t.minSeeds, Math.ceil(400 * t.goalShare)));
    const started = [];
    g.on('trialStarted', (e) => started.push(e));
    check(`${t.name}: starts in the Big Cage`, g.canStartTrial(t.id) && g.startTrial(t.id) && g.state.trial === t.id && started.length === 1 && num(started[0].goal) === goal);
    g.leaveBigCage();
    g.buyUpgrade('wheel', 5);
    g.buyUpgrade('highRoller', 4);
    if (t.rule === 'noFamily') check(`${t.name}: no heirloom bonus and no family traits`, num(g.getHeirloomBonus()) === 0 && treeOff(g));
    if (t.rule === 'noAuto') check(`${t.name}: no auto-spin, even with Wheel Training`, g.getAutoInterval() === null);
    if (t.rule === 'noAuto') check(`${t.name}: … but the shop still says what Wheel Training gives (previews ignore the twist)`,
      typeof g.previewUpgrade('wheel').now === 'number' && g.getAutoInterval() === null);
    if (t.rule === 'betCap') check(`${t.name}: … and High Roller's tile still shows the family's bets`, g.previewUpgrade('highRoller').now > 1);
    if (t.rule === 'noStars') check(`${t.name}: stars don't count`, g.getStarMultiplier() === 1 && g.getStars('clunky') === 3);
    if (t.rule === 'betCap') check(`${t.name}: bets ×1 only`, g.getMaxBetIndex() === 0 && g.setBet(2) === false);
    if (t.rule === 'noWardrobe') check(`${t.name}: nothing worn does anything`, g.getWardrobe().length > 0 && wardrobeOff(g));
    // Beat it: earn coins until the life's pending seeds reach the goal.
    const done = [];
    g.on('trialCompleted', (e) => done.push(e));
    const whiskers = num(g.state.whiskers);
    const pay = Math.floor(t.whiskers * (1 + g.getWhiskerGain()) + 1e-9); // (with Whisker Wisdom planted)
    for (let k = 0; k < 60 && g.state.trial; k++) g.addCoins(10 ** (k / 3 + 3), true);
    check(`${t.name}: beating the goal pays its whiskers (× Whisker Wisdom) and lifts the twist`,
      g.state.trial === null && done.length === 1 && num(done[0].whiskers) === pay && num(g.state.whiskers) === whiskers + pay
      && g.state.trialsDone[t.id] === true && g.state.stats.trialsCompleted === 1);
    if (t.rule === 'noAuto') check(`${t.name}: … auto-spin works again at once`, g.getAutoInterval() !== null);
    if (t.rule === 'betCap') check(`${t.name}: … the bets are back`, g.getMaxBetIndex() > 0);
    g.retire();
    check(`${t.name}: once a colony`, g.canStartTrial(t.id) === false && g.startTrial(t.id) === false);
  }

  // Retiring before the goal: no whiskers, and the trial is over (not done, so it can be tried again).
  const g = trialFamily(333);
  g.state.seedsEarned = money(20); // the goal: 5 seeds
  const t = col.trials[0];
  g.startTrial(t.id);
  g.leaveBigCage();
  g.addCoins(6e5, true); // 21 seeds in all: 1 pending
  const ended = [];
  g.on('trialEnded', (e) => ended.push(e));
  const whiskers = num(g.state.whiskers);
  check('retiring before the goal ends the trial without whiskers', g.retire() && g.state.trial === null && ended.length === 1 && ended[0].completed === false && num(g.state.whiskers) === whiskers);
  check('… and it can be tried again', g.canStartTrial(t.id));
  check('startTrial(null) goes back to an ordinary life', g.startTrial(t.id) && g.startTrial(null) && g.state.trial === null);
  check('No Family takes the head start away, and giving it up brings it back', (() => {
    const h = trialFamily(334);
    completeTreeKeepSeeds(h);
    h.addCoins(1e9, true);
    h.retire();
    const head = h.getUpgradeLevel('wheel');
    h.startTrial('freshStart');
    const none = h.getUpgradeLevel('wheel');
    h.startTrial(null);
    return head > 0 && none === 0 && h.getUpgradeLevel('wheel') === head;
  })());
  check('a trial can\'t start once the life has begun (only in the Big Cage, before any play)', (() => {
    const h = trialFamily(335);
    h.leaveBigCage();
    h.update(1);
    h.openBigCage();
    return h.canStartTrial(col.trials[0].id) === false;
  })());
  check('a migration forgets the trials beaten (they pay again in the new colony)', (() => {
    const h = trialFamily(336);
    h.state.trialsDone = { [col.trials[0].id]: true };
    completeTree(h);
    h.migrate();
    h.state.generation = col.trialGeneration;
    return deepEqual(h.state.trialsDone, {}) && h.canStartTrial(col.trials[0].id);
  })());
});

// Plant the whole tree but keep the seeds (for the trials' family).
function completeTreeKeepSeeds(g) {
  const held = g.state.seeds;
  completeTree(g);
  g.addSeeds(held);
}
// No Family: the tree adds nothing (Luck and payouts are the same with a bare tree).
function treeOff(g) {
  const tree = g.state.tree;
  const luck = g.getLuck().hamster;
  const pay = num(g.getPayoutMultiplier());
  g.state.tree = {};
  const same = g.getLuck().hamster === luck && num(g.getPayoutMultiplier()) === pay;
  g.state.tree = tree;
  return same && Object.keys(tree).length > 0;
}
// With the wardrobe off, the payout multiplier has no wardrobe or boost group.
function wardrobeOff(g) {
  const worn = g.getWardrobe();
  const payoutSkins = worn.filter((w) => w.effects.some((e) => e.type === 'payoutMultiplier'));
  if (!payoutSkins.length) return true;
  const m = num(g.getPayoutMultiplier());
  const trial = g.state.trial;
  g.state.trial = null;
  const withSkins = num(g.getPayoutMultiplier());
  g.state.trial = trial;
  return withSkins > m;
}

// ─────────────────────────────────────────────────────────────
describe('the Wise Elders (automation)', () => {
  const g = migrated(341);
  g.leaveBigCage();
  check('without the perk nothing retires by itself', (() => {
    g.setAuto({ retire: true });
    g.addCoins(1e8, true);
    g.update(3);
    return g.state.generation === 1 && g.hasAutoRetire() === false;
  })());
  g.state.whiskers = money(100);
  g.buyPerk('wiseElders');
  check('setAuto only takes the share choices in data.json', g.setAuto({ share: 0.3 }) && g.state.auto.share === col.autoRetire.shares[0] && g.setAuto({ share: col.autoRetire.shares[1] }) && g.state.auto.share === col.autoRetire.shares[1]);
  g.setAuto({ retire: true, plant: true, share: col.autoRetire.shares[0] });
  const retired = [];
  g.on('retired', (e) => retired.push(e));
  g.addCoins(1e8, true); // plenty of pending seeds
  g.update(1.5);
  check('with the perk the family retires by itself (auto), plants and starts the next life',
    retired.length === 1 && retired[0].auto === true && g.state.generation === 2 && g.state.bigCage === false
    && Object.keys(g.state.tree).length > 0 && g.state.stats.autoRetires === 1, JSON.stringify({ n: retired.length, gen: g.state.generation, cage: g.state.bigCage }));
  check('the Wise Old Hamster sticker', g.state.diary.wiseOld === true);
  check('… it waits for the share of the seeds earned (not every seed)', (() => {
    g.setAuto({ share: col.autoRetire.shares.at(-1) });
    const goal = num(g.getAutoRetireGoal());
    return goal === Math.max(col.autoRetire.minSeeds, Math.ceil(num(g.state.seedsEarned) * col.autoRetire.shares.at(-1)));
  })());
  check('never during a Colony Trial', (() => {
    const h = trialFamily(342);
    h.state.whiskers = money(100);
    h.buyPerk('wiseElders');
    h.setAuto({ retire: true });
    h.state.seedsEarned = money(1e9); // an out-of-reach trial goal
    h.startTrial(col.trials[0].id);
    h.leaveBigCage();
    h.addCoins(1e10, true);
    h.update(2);
    return h.state.generation === col.trialGeneration && h.state.trial !== null; // (no retirement)
  })());
  check('switched off, it waits', (() => {
    const h = migrated(343);
    h.state.whiskers = money(100);
    h.buyPerk('wiseElders');
    h.setAuto({ retire: false });
    h.leaveBigCage();
    h.addCoins(1e8, true);
    h.update(2);
    return h.state.generation === 1;
  })());
});

// ─────────────────────────────────────────────────────────────
describe('Moving Day (the 8th machine) and the colony traits', () => {
  const moving = data.machines.find((m) => m.id === 'moving');
  const g = newGame(351);
  g.addCoins(moving.unlockCost * 10);
  check('Moving Day is not for sale to a family that hasn\'t migrated', !g.isMachineOpen('moving') && !g.canBuyMachine('moving') && !g.buyMachine('moving')
    && g.getMachineInfo('moving').open === false);
  const h = migrated(352);
  h.leaveBigCage();
  h.addCoins(moving.unlockCost * 10);
  check('… it is for a migrated family', h.isMachineOpen('moving') && h.buyMachine('moving') && h.getMachineData().id === 'moving');
  const seen = [];
  h.on('spinStarted', (e) => seen.push(e));
  let boxLeft = false;
  for (let k = 0; k < 400; k++) {
    h.spin('manual');
    h.update(5);
    if (h.state.machines[h.state.activeMachine].result.some((col2) => col2.includes('box'))) boxLeft = true;
  }
  const opened = seen.filter((e) => e.mystery);
  check('boxes land and open (every spinStarted says which cells and what they became)', opened.length > 20
    && opened.every((e) => e.mystery.cells.length > 0 && e.mystery.cells.every(([r, row]) => e.result[r][row] === e.mystery.symbol)));
  check('no box is ever left on the reels', !boxLeft && seen.every((e) => e.result.every((c) => !c.includes('box'))));
  check('all the boxes of a spin open into the same symbol, one the machine has open', opened.every((e) => moving.mystery.reveal.some((r) => r.symbol === e.mystery.symbol) && e.mystery.symbol !== 'golden'));
  check('the stats count the boxes', h.state.stats.mysteryBoxes === opened.reduce((sum, e) => sum + e.mystery.cells.length, 0) && h.state.stats.bestBoxes >= 1);
  check('the RTP of Moving Day at every start is over 100%', h.getEconomy().rtp > 1);

  // Colony traits: only for a family that has migrated.
  const a = newGame(353);
  completeTree(a);
  check('colony traits don\'t grow in the first colony', colonyTraits.every((n) => !a.isTreeNodeUnlocked(n.id) && a.getTreeLevel(n.id) === 0));
  const b = migrated(354);
  completeTree(b);
  check('… they do after a migration (once the trait they need is planted)', colonyTraits.every((n) => b.getTreeLevel(n.id) === (n.maxLevel || 1)));
  check('… and then "the whole tree" includes them', b.getTreeProgress().total === data.familyTree.nodes.length && b.isTreeComplete());
  const starry = colonyTraits.find((n) => n.effect.type === 'maxStars');
  check('Starry Roots raises the most stars a machine can have', b.getMaxStars() === data.stars.max + starry.effect.perLevel * starry.maxLevel);
  const wisdom = colonyTraits.find((n) => n.effect.type === 'whiskerGain');
  check('Whisker Wisdom raises the next migration\'s whiskers', near(b.getWhiskerGain(), wisdom.effect.perLevel * wisdom.maxLevel, 1e-12)
    && num(b.getPendingWhiskers()) >= 1);
  const boxes = colonyTraits.find((n) => n.effect.type === 'symbolWeight');
  check('Moving Boxes puts more boxes on Moving Day', (() => {
    const c = migrated(355);
    c.leaveBigCage();
    c.addCoins(moving.unlockCost * 2);
    c.buyMachine('moving');
    const before = c.getSymbolChance('box');
    completeTree(c);
    c.leaveBigCage();
    return c.getSymbolChance('box') > before && c.getTreeLevel(boxes.id) === boxes.maxLevel;
  })());
});

// ─────────────────────────────────────────────────────────────
describe('save v14', () => {
  const g = trialFamily(361);
  g.state.whiskers = money(20);
  g.buyPerk('colonyPride');
  g.startTrial(col.trials[1].id);
  g.state.trialsDone[col.trials[0].id] = true;
  g.setAuto({ retire: true, share: col.autoRetire.shares[2], plant: false });
  const save = g.toSaveData();
  check('a save is v15, with the colony', save.saveVersion === SAVE_VERSION && SAVE_VERSION === 15 && save.colony === 1 && save.whiskers === '19'
    && save.perks.colonyPride === 1 && save.trial === col.trials[1].id && save.trialsDone[col.trials[0].id] === true
    && deepEqual(save.auto, { retire: true, share: col.autoRetire.shares[2], plant: false }) && typeof save.colonyCoins === 'string');
  const h = newGame(362);
  check('… and loads back the same', h.loadSaveData(JSON.parse(JSON.stringify(save))) && deepEqual(h.toSaveData(), save));

  // v13 → v14: the seeds pending stay the same, on the new curve. A v12 save (from
  // before 1.3.2's pause toggle too) goes through both steps and ends up the same.
  const r = data.retirement;
  for (const version of [13, 12]) {
    for (const coins of [0, 5e4, 3e8, 1e15, 1e24]) {
      const old = JSON.parse(JSON.stringify(newGame(363).toSaveData()));
      old.saveVersion = version;
      for (const k of ['colony', 'colonyCoins', 'whiskers', 'perks', 'trial', 'trialsDone', 'auto']) delete old[k];
      for (const k of ['migrations', 'whiskersEarned', 'trialsCompleted', 'autoRetires', 'mysteryBoxes', 'bestBoxes']) delete old.stats[k];
      if (version === 12) delete old.autoPaused;
      const oldTotal = Math.floor(Math.pow(coins / r.seedDivisor, r.seedExponent) + 1e-9);
      const earned = Math.floor(oldTotal / 2);
      old.stats.coinsEarned = String(coins);
      old.seedsEarned = String(earned);
      const k = newGame(364);
      const loaded = k.loadSaveData(old);
      check(`v${version} → v14 (${coins} coins earned): the same seeds are pending as before (${oldTotal - earned})`,
        loaded && num(k.getPendingSeeds()) === oldTotal - earned && k.state.colony === 0 && num(k.state.whiskers) === 0 && k.state.trial === null
        && k.state.auto.retire === false && k.state.stats.migrations === 0 && k.state.autoPaused === false, `${num(k.getPendingSeeds())}`);
    }
  }
  const bad = JSON.parse(JSON.stringify(save));
  bad.trial = 'nope';
  bad.perks = { colonyPride: 2.5, nope: 3, wiseElders: 9 };
  bad.auto = { retire: 'yes', share: 0.33, plant: 0 };
  bad.colony = -2;
  bad.stars = { clunky: 99 };
  const c = newGame(365);
  c.loadSaveData(bad);
  check('junk colony fields are cleaned (unknown trials and perks, capped levels, a known share, stars capped at the max)',
    c.state.trial === null && deepEqual(c.state.perks, { colonyPride: 2, wiseElders: 1 }) && c.state.auto.retire === false
    && c.state.auto.share === col.autoRetire.shares[0] && c.state.colony === 0 && c.state.stars.clunky === c.getMaxStars(), JSON.stringify([c.state.perks, c.state.stars]));
  check('migrateSave v13 → v14 without data keeps the lifetime coins as the colony\'s', (() => {
    const v13 = JSON.parse(JSON.stringify(newGame(366).toSaveData()));
    v13.saveVersion = 13;
    delete v13.colonyCoins;
    v13.stats.coinsEarned = '12345';
    return migrateSave(v13, null).colonyCoins === '12345';
  })());
});

// ─────────────────────────────────────────────────────────────
describe('the balance rules still hold for a migrated family', () => {
  // Rule 4 with every perk and every colony trait: Moving Day's RTP > 100% in every
  // setup is in the machine tests; here the auto-spin floor and the delivery rule.
  const g = migrated(371);
  completeTree(g);
  g.leaveBigCage();
  g.state.perks = Object.fromEntries(col.perks.map((p) => [p.id, p.maxLevel || 5]));
  g.buyUpgrade('wheel', Infinity);
  check('the auto-spin interval never goes below the spin time + the rest', g.getAutoInterval() >= g.getSpinDuration() - 1e-9);
  check('Moving Day with every upgrade maxed (and Moving Boxes) still pays over 100% (RTP)', (() => {
    const h = migrated(372);
    completeTree(h);
    h.leaveBigCage();
    h.addCoins(1e18);
    h.buyMachine('moving');
    for (const u of data.upgrades.filter((x) => x.machines && x.machines.includes('moving'))) h.buyUpgrade(u.id, Infinity);
    return h.getMachineData().id === 'moving' && h.getEconomy().rtp > 1;
  })());
});

// ─────────────────────────────────────────────────────────────
describe('a dearer Family Tree in each new colony (the balancing pass)', () => {
  const k = 3;
  const d = structuredClone(data);
  d.familyTree.costPerColony = k;
  const g = createGame(d, createRng(5));
  g.unlockAllUpgrades();
  const plain = createGame(structuredClone(data), createRng(5));
  const node = d.familyTree.nodes[0];
  const base = num(plain.getTreeCost(node.id));
  check('the first colony pays rule 3\'s price', num(g.getTreeCost(node.id)) === base);
  g.state.colony = 1;
  check('colony 2 pays floor(price × k)', num(g.getTreeCost(node.id)) === Math.floor(base * k));
  g.state.colony = 2;
  check('colony 3 pays floor(price × k²)', num(g.getTreeCost(node.id)) === Math.floor(base * k * k));
  check('data.json\'s factor is never below 1 (a later colony never pays less)', (data.familyTree.costPerColony ?? 1) >= 1);
});
