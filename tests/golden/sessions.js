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
import { createRng } from '../../src/logic/rng.js';
import { createGame } from '../../src/logic/game.js';

export const data = JSON.parse(readFileSync(new URL('../../data.json', import.meta.url), 'utf8'));

// Every event game.js emits (AGENTS.md → Events).
const EVENTS = [
  'spinStarted', 'spinResolved', 'spinBlocked', 'betChanged', 'freeSpinsStarted', 'freeSpinsEnded',
  'jackpotStarted', 'jackpotWon', 'gambleOffered', 'gambleResolved', 'gambleEnded', 'coinsChanged',
  'seedsChanged', 'upgradeBought', 'machineBought', 'machineSwitched', 'treeNodeBought', 'retired',
  'deliveryStarted', 'deliveryFinished', 'tokensChanged', 'stickerEarned', 'capsuleOpened',
  'skinEquipped', 'offlineEarned', 'dataReloaded', 'stateLoaded',
];

const STEP = 0.25; // seconds of game time per step; the player acts once a second
// What the player does with each card gamble, in turn ("collect" = Take win).
const PICKS = ['collect', 'red', 'hearts', 'black', 'collect', 'spades', 'red', 'clubs', 'diamonds'];

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
  g.on('spinResolved', (e) => { s.log.paid = Math.round((s.log.paid + e.payout) * 100) / 100; });
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
function buyCheapest(g) {
  let best = null;
  for (const def of g.getAvailableUpgrades()) {
    if (g.canBuyUpgrade(def.id) && (!best || g.getUpgradeCost(def.id) < g.getUpgradeCost(best.id))) best = def;
  }
  return best ? g.buyUpgrade(best.id) : false;
}

// Plant Family Tree nodes, cheapest first, until nothing more can be planted.
function plantAll(g) {
  for (;;) {
    const ids = data.familyTree.nodes.map((n) => n.id).filter((id) => g.canBuyTreeNode(id));
    if (!ids.length) return;
    ids.sort((a, b) => g.getTreeCost(a) - g.getTreeCost(b));
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
  checkpoint(s, 'third generation');

  g().applyOfflineEarnings(600);
  play(s, 5 * 60, { clicks: false, buyEvery: 5 });
  checkpoint(s, 'third generation, 5 min');
  return s.checkpoints;
}

export const SESSIONS = { firstLife, allMachines, family };

// Which checkpoints are also kept as real v7 save files (tests/fixtures/), for
// save-migration tests: [session, checkpoint label, file name].
export const FIXTURES = [
  ['firstLife', 'first life, 10 min', 'save-v7-early.json'],
  ['firstLife', 'first life, 50 min', 'save-v7-first-life.json'],
  ['family', 'third generation, 5 min', 'save-v7-family.json'],
  ['allMachines', 'played on after loading', 'save-v7-late.json'],
];
