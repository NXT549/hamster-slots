// sessions.js — the golden run's scripted play sessions.
//
// Each session plays the REAL game logic with a fixed seed and a fixed "player"
// script, and takes a snapshot (a checkpoint) now and then: the whole save, the
// RNG's position, how many of each event fired, and the coins paid out.
//
// tools/golden.mjs recorded those checkpoints once, from the plain-JS game
// (migration step 3.3), into golden.json. tests/golden.test.js plays the same
// sessions again and demands the very same checkpoints. So if a later step of the
// migration changes how the game plays, even by one cent or one random number,
// that test fails and shows where.
//
// The scripts are deliberately simple and a bit silly (a bot that buys the
// cheapest thing it can): the point is to touch every system, not to play well.

import { readFileSync } from 'node:fs';
import { createRng } from '../../src/logic/rng.ts';
import { createGame } from '../../src/logic/game.ts';

export const data = JSON.parse(readFileSync(new URL('../../data.json', import.meta.url), 'utf8'));

// Every event game.ts emits (AGENTS.md → Events).
const EVENTS = [
  'spinStarted', 'spinResolved', 'spinBlocked', 'betChanged', 'freeSpinsStarted', 'freeSpinsEnded',
  'jackpotStarted', 'jackpotWon', 'gambleOffered', 'gambleResolved', 'gambleEnded', 'coinsChanged',
  'seedsChanged', 'upgradeBought', 'machineBought', 'machineSwitched', 'treeNodeBought', 'retired',
  'bigCageLeft', 'machineRebuilt', 'holdStarted', 'holdEnded',
  'deliveryStarted', 'deliveryFinished', 'tokensChanged', 'stickerEarned', 'capsuleOpened',
  'skinEquipped', 'offlineEarned', 'dataReloaded', 'stateLoaded',
  'chipsChanged', 'rouletteSpun', 'blackjackChanged', 'blackjackEnded', 'derbyRun', 'seedDropped', 'prizeBought', 'boostEnded', // M11
  'migrated', 'perkBought', 'trialStarted', 'trialCompleted', 'trialEnded', 'autoChanged', // 1.4.0
];

const STEP = 0.25; // seconds of game time per step; the player acts once a second
// What the player does with each card gamble, in turn ("collect" = Take win).
const PICKS = ['collect', 'red', 'hearts', 'black', 'collect', 'spades', 'red', 'clubs', 'diamonds'];

// The money in a save (see MONEY_STATS in the game's types): since save v8 (big
// numbers, migration step 3.7) it's written as text ("1234.56"); the recording
// was made with v7, where it was a plain number.
export const MONEY_STATS = ['coinsWon', 'coinsSpent', 'deliveryCoins', 'coinsEarned', 'tokensEarned', 'biggestWin', 'offlineCoins', 'freeSpinCoins',
  'chipsBought', 'chipsEarned', 'biggestCasinoWin', // (M11's, in v11 saves)
  'whiskersEarned']; // (1.4.0's, in v14 saves)
export function moneyFields(save) {
  const fields = [[save, 'coins'], [save, 'seeds'], [save, 'seedsEarned'], [save, 'tokens'], [save, 'colonyCoins'], [save, 'whiskers']];
  if (save.run) fields.push([save.run, 'coinsEarned']);
  if (save.stats) for (const key of MONEY_STATS) fields.push([save.stats, key]);
  for (const m of save.machines || []) {
    for (const pot of Object.keys(m.pots || {})) fields.push([m.pots, pot]);
    if (m.freeSpins) fields.push([m.freeSpins, 'won']);
  }
  if (save.casino) { // M11 (v11 saves)
    fields.push([save.casino, 'chips'], [save.casino, 'bestIncome']);
    if (save.casino.hand) fields.push([save.casino.hand, 'bet'], [save.casino.hand, 'returned']);
  }
  return fields.filter(([obj, key]) => key in obj);
}

// A checkpoint as the golden run compares it: the save's money as plain numbers
// (text or number, the same amount) and without its version. So the recording
// from v7 and today's v8 saves match exactly when the game plays the same, while
// any other difference (a cent, a count, a random number) still shows up.
export function comparable(cp) {
  const out = canonical(cp);
  if (out.save) {
    for (const [obj, key] of moneyFields(out.save)) obj[key] = Number(obj[key]);
    delete out.save.saveVersion;
  }
  return out;
}

// A JSON copy with every object's keys sorted, so key order never matters.
export function canonical(value) {
  const sort = (x) => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])]));
    return x;
  };
  return JSON.parse(JSON.stringify(sort(value)));
}

function newGame(seed) {
  return createGame(structuredClone(data), createRng(seed));
}

function newSession(seed) {
  const s = { g: null, t: 0, picks: 0, log: { counts: {}, paid: 0 }, checkpoints: [] };
  attach(s, newGame(seed));
  return s;
}

// Listen to a game (also to the new game after a save + load).
function attach(s, g) {
  s.g = g;
  for (const name of EVENTS) g.on(name, () => { s.log.counts[name] = (s.log.counts[name] || 0) + 1; });
  g.on('spinResolved', (e) => { s.log.paid = Math.round((s.log.paid + e.payout.toNumber()) * 100) / 100; });
}

function checkpoint(s, label) {
  s.checkpoints.push(canonical({
    label,
    t: s.t,
    rng: s.g.rng.getState(),
    events: s.log.counts,
    paid: s.log.paid,
    save: s.g.toSaveData(),
  }));
}

// One second of a keen player: answer a gamble offer, else spin (or go on a
// delivery when even a ×1 spin is too dear).
function playerSecond(s) {
  const g = s.g;
  const offer = g.getGambleInfo();
  if (offer) {
    const pick = PICKS[s.picks++ % PICKS.length];
    if (pick !== 'collect' && offer.canPick) g.gamble(pick);
    if (g.getGambleInfo()) g.collectGamble(); // keep whatever is left
    return;
  }
  if (g.getSpinBet() === null) g.startDelivery('manual');
  else g.spin('manual');
}

// Buy the cheapest upgrade that can be bought right now (ties: data.json order).
// (Costs are Money, big numbers: .lt() is "less than".)
function buyCheapest(g) {
  let best = null;
  for (const def of g.getAvailableUpgrades()) {
    if (g.canBuyUpgrade(def.id) && (!best || g.getUpgradeCost(def.id).lt(g.getUpgradeCost(best.id)))) best = def;
  }
  return best ? g.buyUpgrade(best.id) : false;
}

// Plant Family Tree nodes, cheapest first, until nothing more can be planted.
// (Since M8 that only works in the Big Cage, right after retiring.)
function plantAll(g) {
  for (;;) {
    const ids = data.familyTree.nodes.map((n) => n.id).filter((id) => g.canBuyTreeNode(id));
    if (!ids.length) return;
    ids.sort((a, b) => g.getTreeCost(a).cmp(g.getTreeCost(b)));
    g.buyTreeNode(ids[0]);
  }
}

// Play for `seconds` of game time. clicks: act like playerSecond once a second;
// buyEvery: try buyCheapest every N seconds (0 = never).
function play(s, seconds, { clicks = true, buyEvery = 0, every = null } = {}) {
  const steps = Math.round(seconds / STEP);
  const perSecond = Math.round(1 / STEP);
  for (let i = 1; i <= steps; i++) {
    if (i % perSecond === 0) {
      const second = i / perSecond;
      if (clicks) playerSecond(s);
      if (buyEvery && second % buyEvery === 0) buyCheapest(s.g);
      if (every) every(second);
    }
    s.g.update(STEP);
    s.t = Math.round((s.t + STEP) * 1000) / 1000;
  }
}

// Let time pass in single ticks until the running machine stops spinning.
function waitIdle(s) {
  for (let i = 0; i < 1200 && s.g.state.machines[s.g.state.activeMachine].spinning; i++) {
    s.g.update(1 / 60);
    s.t = Math.round((s.t + 1 / 60) * 1e6) / 1e6;
  }
}

// ── The sessions ────────────────────────────────────────────────────────────

// A first life on Old Clunky: clicking, deliveries, buying, gambling, retiring.
function firstLife() {
  const s = newSession(11);
  for (let minute = 5; minute <= 50; minute += 5) {
    play(s, 5 * 60, { buyEvery: 5 });
    checkpoint(s, `first life, ${minute} min`);
  }
  if (s.g.canRetire()) s.g.retire();
  checkpoint(s, 'retired');
  plantAll(s.g);
  s.g.leaveBigCage(); // M8: the new life starts when you leave the Big Cage
  checkpoint(s, 'planted the tree');
  play(s, 10 * 60, { buyEvery: 5 });
  checkpoint(s, 'second life, 10 min');
  return s.checkpoints;
}

// Every machine with every upgrade: bets, free spins, the jackpot wheel, a switch
// mid-spin, the card gamble, offline earnings, and a save + load in the middle.
function allMachines() {
  const s = newSession(22);
  const g = () => s.g;
  g().addCoins(1e9);
  for (const id of ['stacker', 'bonanza', 'palace']) g().buyMachine(id);
  for (const id of ['clunky', 'stacker', 'bonanza', 'palace']) {
    g().switchMachine(id);
    for (const def of g().getAvailableUpgrades()) g().buyUpgrade(def.id, Infinity);
    g().setBet(g().getMaxBetIndex());
  }
  checkpoint(s, 'bought everything');

  for (const id of ['clunky', 'stacker', 'bonanza', 'palace']) {
    g().switchMachine(id);
    if (id === 'bonanza') g().addFreeSpins(5);
    const pots = id === 'palace' ? data.machines.find((m) => m.id === 'palace').jackpot.pots.map((p) => p.id) : [];
    play(s, 3 * 60, {
      every(second) {
        // On the Pouch Palace, spin the jackpot wheel for each pot in turn.
        if (pots.length && second % 40 === 0) {
          waitIdle(s);
          g().triggerJackpot(pots.shift());
        }
      },
    });
    checkpoint(s, `played the ${id}`);
  }

  // Switch away while a spin is running: it still lands and pays on its machine.
  waitIdle(s);
  g().switchMachine('stacker');
  g().spin('manual');
  g().update(0.5);
  g().switchMachine('clunky');
  play(s, 10, { clicks: false });
  checkpoint(s, 'switched mid-spin');

  // The card gamble, offered by hand: a colour, then a suit, then take the rest.
  waitIdle(s);
  g().triggerGamble(250);
  for (const pick of ['red', 'spades']) if (g().getGambleInfo()) g().gamble(pick);
  if (g().getGambleInfo()) g().collectGamble();
  checkpoint(s, 'card gamble');

  g().applyOfflineEarnings(3600);
  checkpoint(s, 'an hour away');

  // Save, load into a brand-new game (same RNG position), and keep playing there.
  const save = g().toSaveData();
  const next = newGame(22);
  next.rng.setState(g().rng.getState());
  next.loadSaveData(save);
  attach(s, next);
  checkpoint(s, 'after save + load');
  play(s, 2 * 60);
  checkpoint(s, 'played on after loading');
  return s.checkpoints;
}

// The family: retiring twice, planting, capsules and skins, an idle life.
function family() {
  const s = newSession(33);
  const g = () => s.g;
  g().addCoins(20000, true); // counts as earned, so it brings Heirloom Seeds
  checkpoint(s, 'earned 20K');
  g().retire();
  plantAll(g());
  g().leaveBigCage();
  checkpoint(s, 'retired and planted');

  g().addTokens(300);
  while (g().canPull()) g().pullCapsule();
  for (const skin of data.skins) if (g().isSkinOwned(skin.id)) g().equipSkin(skin.id);
  checkpoint(s, 'capsules and skins');

  play(s, 15 * 60, { clicks: false, buyEvery: 5 }); // idle: auto-spin from Warm-up Laps
  checkpoint(s, 'an idle life, 15 min');

  g().addCoins(2e6, true);
  g().retire();
  plantAll(g());
  g().leaveBigCage();
  checkpoint(s, 'third generation');

  g().applyOfflineEarnings(600);
  play(s, 5 * 60, { clicks: false, buyEvery: 5 });
  checkpoint(s, 'third generation, 5 min');
  return s.checkpoints;
}

// M9: the three late-game machines. The Hamster Maze (243 ways), the Acorn Vault
// (hold & spin, natural and by hand, saved and loaded halfway) and the Big Cheese
// (the cheese wheel), every upgrade bought, at the biggest bet.
function moreMachines() {
  const s = newSession(44);
  const g = () => s.g;
  g().addCoins('1e16');
  for (const id of ['maze', 'vault', 'cheese']) {
    g().buyMachine(id);
    for (const def of g().getAvailableUpgrades()) g().buyUpgrade(def.id, Infinity);
    g().setBet(g().getMaxBetIndex());
  }
  checkpoint(s, 'bought the new machines');
  for (const id of ['maze', 'vault', 'cheese']) {
    g().switchMachine(id);
    play(s, 4 * 60);
    checkpoint(s, `played the ${id}`);
  }
  // Hold & spin by hand, saved and loaded halfway through, then played out.
  g().switchMachine('vault');
  waitIdle(s);
  if (g().getGambleInfo()) g().collectGamble();
  g().triggerHold(7);
  play(s, 5, { clicks: false });
  const save = g().toSaveData();
  const next = newGame(44);
  next.rng.setState(g().rng.getState());
  next.loadSaveData(save);
  attach(s, next);
  checkpoint(s, 'hold & spin, saved halfway');
  play(s, 60);
  checkpoint(s, 'hold & spin played out');
  return s.checkpoints;
}

// M11: the Hamster Casino. It opens with the second hamster: chips from retiring,
// from spinning and bought with coins; every game (Roulette with several bets,
// Blackjack played by its hint, a race on every hamster, seed drops); the prizes
// (boosts running out in play, a charm used up by spins, a token, a skin), time
// away with a boost on, and a blackjack hand saved and loaded halfway.
function casino() {
  const s = newSession(55);
  const g = () => s.g;
  g().addCoins(50000, true);
  g().retire();
  plantAll(g());
  g().leaveBigCage();
  play(s, 5 * 60, { buyEvery: 5 });
  checkpoint(s, 'the casino opened');

  g().addCoins(1e6);
  g().buyChips(1000);
  const bets = [
    [{ kind: 'red', pick: 0, amount: 20 }, { kind: 'number', pick: 17, amount: 10 }],
    [{ kind: 'dozen', pick: 1, amount: 50 }, { kind: 'column', pick: 2, amount: 10 }, { kind: 'odd', pick: 0, amount: 10 }],
    [{ kind: 'number', pick: 0, amount: 10 }, { kind: 'high', pick: 0, amount: 100 }],
  ];
  for (let i = 0; i < 12; i++) g().playRoulette(bets[i % bets.length]);
  for (let i = 0; i < 15; i++) {
    g().dealBlackjack(20);
    for (let hint = g().getBlackjackHint(); hint; hint = g().getBlackjackHint()) {
      if (hint === 'double') g().doubleBlackjack();
      else if (hint === 'hit') g().hitBlackjack();
      else g().standBlackjack();
    }
  }
  for (const racer of data.casino.derby.racers) for (let i = 0; i < 3; i++) g().runDerby(racer.id, 10);
  for (let i = 0; i < 20; i++) g().dropSeed(i % 2 ? 10 : 50);
  checkpoint(s, 'played every table');

  g().addChips(20000);
  for (const id of ['goldenHour', 'turboWheel', 'luckyCharm', 'luckyCharm', 'tokenBag', 'visor']) g().buyPrize(id);
  g().equipSkin('hatVisor');
  checkpoint(s, 'bought prizes');
  play(s, 100, { buyEvery: 5 });
  checkpoint(s, 'boosts running');
  g().applyOfflineEarnings(1800);
  play(s, 60, { clicks: false });
  checkpoint(s, 'time away, then boosts ran out');

  // A hand saved halfway (before the dealer plays), loaded into a new game, then finished.
  g().dealBlackjack(50);
  const save = g().toSaveData();
  const next = newGame(55);
  next.rng.setState(g().rng.getState());
  next.loadSaveData(save);
  attach(s, next);
  checkpoint(s, 'a hand saved halfway');
  g().standBlackjack();
  play(s, 30);
  checkpoint(s, 'the hand played out');
  return s.checkpoints;
}


// 1.4.0: The Great Migration. A family plants its whole tree and migrates from a
// life (its pending seeds count); the whiskers buy perks; a few quick lives in the
// new colony, then a Colony Trial played and beaten; Moving Day with every upgrade
// (its boxes open on the reels); the Wise Elders retire a hamster by themselves; and
// a save loaded halfway.
function migration() {
  const s = newSession(66);
  const g = () => s.g;
  g().addCoins(50000, true);
  g().retire();
  plantAll(g());
  g().leaveBigCage();
  play(s, 3 * 60, { buyEvery: 5 });
  // The whole tree, to its max (seeds from the debug helper; the spare ones taken back).
  g().openBigCage();
  g().addSeeds(1e7);
  for (let pass = 0; pass < 20; pass++) {
    for (const n of data.familyTree.nodes) {
      if (n.maxLevel === null && g().getTreeLevel(n.id) > 0) continue;
      while (g().canBuyTreeNode(n.id)) g().buyTreeNode(n.id);
    }
  }
  g().addSeeds(g().state.seeds.neg());
  g().leaveBigCage();
  checkpoint(s, 'the whole tree planted');
  g().addCoins('1e12', true);
  g().migrate();
  checkpoint(s, 'migrated');
  // The Wise Elders (with a few debug whiskers on top), then perks cheapest first, while the whiskers last.
  g().addWhiskers(10);
  g().buyPerk('wiseElders');
  for (;;) {
    const perks = data.colony.perks.filter((p) => g().canBuyPerk(p.id));
    if (!perks.length) break;
    perks.sort((a, b) => g().getPerkCost(a.id).cmp(g().getPerkCost(b.id)));
    g().buyPerk(perks[0].id);
  }
  g().leaveBigCage();
  play(s, 3 * 60, { buyEvery: 5 });
  checkpoint(s, 'the new colony\'s first life');
  // A few quick lives, until trials open; then a trial for the next life.
  while (g().state.generation < data.colony.trialGeneration) {
    g().addCoins(g().getSeedProgress().nextAt.mul(4), true);
    g().retire();
    plantAll(g());
    g().leaveBigCage();
  }
  g().addCoins(g().getSeedProgress().nextAt.mul(4), true);
  g().retire();
  plantAll(g());
  g().startTrial('tiredPaws');
  g().leaveBigCage();
  play(s, 2 * 60, { buyEvery: 5 });
  checkpoint(s, 'a trial under way');
  g().addCoins(g().getSeedProgress().nextAt.mul(50), true);
  play(s, 30);
  checkpoint(s, 'the trial beaten');
  // Moving Day, with every upgrade.
  g().addCoins('1e16');
  g().buyMachine('moving');
  for (const def of g().getAvailableUpgrades()) g().buyUpgrade(def.id, Infinity);
  g().setBet(g().getMaxBetIndex());
  play(s, 4 * 60);
  checkpoint(s, 'played Moving Day');
  // The Wise Elders retire a hamster by themselves (and plant, and start the next life).
  g().setAuto({ retire: true, share: data.colony.autoRetire.shares[0], plant: true });
  waitIdle(s);
  if (g().getGambleInfo()) g().collectGamble();
  g().addCoins(g().getSeedProgress().nextAt.mul(20), true);
  play(s, 20);
  checkpoint(s, 'the elders retired a hamster');
  // Saved and loaded, then played on.
  const save = g().toSaveData();
  const next = newGame(66);
  next.rng.setState(g().rng.getState());
  next.loadSaveData(save);
  attach(s, next);
  play(s, 60, { buyEvery: 5 });
  checkpoint(s, 'played on after loading');
  return s.checkpoints;
}

export const SESSIONS = { firstLife, allMachines, family, moreMachines, casino, migration };

// Which checkpoints are also kept as real save files (tests/fixtures/), for
// save-migration tests: [session, checkpoint label, name]. The files are called
// save-v<version>-<name>.json; every save version gets its own set, and old sets
// are kept for good (they're the old-format saves the migrations are tested on).
export const FIXTURES = [
  ['firstLife', 'first life, 10 min', 'early'],
  ['firstLife', 'first life, 50 min', 'first-life'],
  ['family', 'third generation, 5 min', 'family'],
  ['allMachines', 'played on after loading', 'late'],
];
