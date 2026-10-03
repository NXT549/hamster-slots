// guide.test.js — the first-time guide's steps (1.9.0, src/view/guide.ts, DESIGN §31 →
// The first-time guide). guideStep() is worked out from the game's own state only, so it
// runs here in Node on real games: each step shows while it should, ends by itself once
// it's done, and an old save that's past a step never sees it.

import { describe, test, expect } from 'vitest';
import { createRng } from '../src/logic/rng.ts';
import { createGame } from '../src/logic/game.ts';
import { money } from '../src/logic/money.ts';
import { guideStep, autoSpinUpgrade, GUIDE_LINES } from '../src/view/guide.ts';
import { data, land, plant } from './logic/helpers.js';

// A brand-new game, exactly as a new player gets it (nothing unlocked for the tests).
const fresh = (seed = 1) => createGame(structuredClone(data), createRng(seed));
const on = (tab = 'upgrades') => ({ tab });
const stepOf = (g, tab) => {
  const s = guideStep(g, on(tab));
  return s ? s.id : null;
};

describe('the guide, step by step through a first life', () => {
  test('a new game: Spin', () => {
    expect(stepOf(fresh())).toBe('spin');
  });

  test('no coins for a spin and no delivery yet: Deliver', () => {
    const g = fresh();
    g.state.coins = money(0);
    expect(stepOf(g)).toBe('deliver');
    // …and not while the hamster is already out on one.
    g.startDelivery();
    expect(stepOf(g)).not.toBe('deliver');
  });

  test('after the first delivery, being broke is no longer a guide step', () => {
    const g = fresh();
    g.state.stats.deliveries = 1;
    g.state.stats.spins = 3;
    g.state.coins = money(0);
    expect(stepOf(g)).toBe(null);
  });

  test('spun once and an upgrade is affordable: First upgrade, pointing at one you can buy', () => {
    const g = fresh();
    g.spin('manual');
    land(g);
    g.addCoins(1e6);
    const s = guideStep(g, on());
    expect(s.id).toBe('upgrade');
    expect(g.canBuyUpgrade(s.upgrade)).toBe(true);
    expect(GUIDE_LINES.upgrade(g)).toContain(g.getUpgradeDef(s.upgrade).name);
  });

  test('one upgrade bought and Wheel Training affordable: Auto-spin', () => {
    const g = fresh();
    g.spin('manual');
    land(g);
    g.addCoins(1e6);
    const auto = autoSpinUpgrade(g);
    const other = g.getAvailableUpgrades().find((d) => d.id !== auto && g.isUpgradeUnlocked(d.id) && g.canBuyUpgrade(d.id));
    g.buyUpgrade(other.id);
    expect(guideStep(g, on())).toEqual({ id: 'auto', upgrade: auto });
    g.buyUpgrade(auto);
    expect(stepOf(g)).toBe(null);
  });

  test('the first hamster can retire: Retire; then the Big Cage: Plant, then Start', () => {
    const g = fresh();
    g.spin('manual');
    land(g);
    g.addCoins(1e6);
    g.buyUpgrade(autoSpinUpgrade(g));
    g.addCoins(1e7, true); // earned coins: Heirloom Seeds to retire with
    expect(g.canRetire()).toBe(true);
    expect(stepOf(g)).toBe('retire');
    g.retire();
    expect(stepOf(g)).toBe('plant');
    const first = data.familyTree.nodes.find((n) => !n.needs || n.needs.length === 0);
    expect(g.buyTreeNode(first.id)).toBe(true);
    expect(stepOf(g)).toBe('start');
    g.leaveBigCage();
    // The second hamster: the first life's steps are done (and Retire is for the first hamster only).
    g.addCoins(1e7, true);
    expect(g.canRetire()).toBe(true);
    expect(stepOf(g)).toBe(null);
  });

  test('a later Big Cage visit with something planted points at nothing', () => {
    const g = fresh();
    g.state.stats.spins = 50;
    g.state.stats.upgradesBought = 10;
    g.state.generation = 3;
    plant(g, data.familyTree.nodes[0].id);
    g.openBigCage();
    expect(stepOf(g)).toBe(null);
  });
});

describe('the guide in the Capsules and Casino tabs', () => {
  // A family past the first life's steps (as an old save would be).
  const veteran = () => {
    const g = fresh();
    g.state.stats.spins = 500;
    g.state.stats.deliveries = 5;
    g.state.stats.upgradesBought = 40;
    g.state.generation = 2;
    return g;
  };

  test('Capsules: only with the tab open, a pull affordable and none pulled yet', () => {
    const g = veteran();
    g.addTokens(100);
    expect(stepOf(g, 'upgrades')).toBe(null);
    expect(stepOf(g, 'capsules')).toBe('capsules');
    g.state.stats.capsulesOpened = 1;
    expect(stepOf(g, 'capsules')).toBe(null);
  });

  test('Casino: only with the tab open, the casino open with chips and no game played yet', () => {
    const g = veteran();
    expect(g.isCasinoOpen()).toBe(true);
    g.state.casino.chips = money(250);
    expect(stepOf(g, 'info')).toBe(null);
    expect(stepOf(g, 'casino')).toBe('casino');
    g.state.stats.casinoGames = 1;
    expect(stepOf(g, 'casino')).toBe(null);
  });
});

describe('old saves past every step', () => {
  test('a well-played family sees no step anywhere', () => {
    const g = fresh();
    Object.assign(g.state.stats, { spins: 9000, deliveries: 30, upgradesBought: 300, capsulesOpened: 12, casinoGames: 40 });
    g.state.generation = 9;
    g.addCoins(1e9, true);
    g.addTokens(100);
    for (const tab of ['upgrades', 'family', 'capsules', 'casino', 'info']) expect(stepOf(g, tab)).toBe(null);
  });
});

describe('every step has its words, or the Big Cage speaks for it', () => {
  test('lines', () => {
    const g = fresh();
    for (const id of ['spin', 'deliver', 'upgrade', 'auto', 'retire', 'capsules', 'casino']) expect(typeof GUIDE_LINES[id](g)).toBe('string');
    expect(GUIDE_LINES.plant).toBe(null);
    expect(GUIDE_LINES.start).toBe(null);
  });
});
