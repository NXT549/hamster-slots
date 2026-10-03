// owncasino.test.js — M12, the Family Casino: a migrated family's own casino.
// Cabinets of its machines on the floor, hamster guests playing them below 100%,
// the house's edge coming in as Takings (exact averages, never random), a till that
// fills while you play and while you're away, and what Takings buy. Takings never
// become coins and never count as coins earned; the player's own odds never change.

import { describe, test, expect } from 'vitest';
import { data, num, newGame, createGame, createRng, costAtLevel, SAVE_VERSION } from './helpers.js';

const oc = data.ownCasino;
const cabinet = (id) => oc.cabinets.find((c) => c.machine === id);
const upgrade = (id) => oc.upgrades.find((u) => u.id === id);
const reward = (id) => oc.rewards.find((r) => r.id === id);
const spinTime = (id) => data.machines.find((m) => m.id === id).spinDuration;
const rateOf = (id, { guests = 1, bets = 1, edge = 0 } = {}) => {
  const c = cabinet(id);
  return (c.bet * bets * (1 - Math.max(oc.minGuestRtp, c.guestRtp - edge)) / (spinTime(id) + oc.guestRestSeconds)) * guests;
};
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

// A family that has migrated, playing its first life in the new colony (so the
// Family Casino opens on the next tick). Poking `colony` is enough: the migration
// itself is tested in colony.test.js.
function migratedGame(seed = 1, d = data) {
  const g = createGame(structuredClone(d), createRng(seed));
  g.unlockAllUpgrades();
  g.state.colony = 1;
  return g;
}
function openGame(seed = 1) {
  const g = migratedGame(seed);
  g.update(1 / 60);
  return g;
}
// Banked Takings to spend (the debug action).
function rich(g, n = 1e12) {
  g.addTakings(n);
  return g;
}

describe('opening', () => {
  test('a family that has not migrated has no Family Casino', () => {
    const g = newGame(1);
    g.update(10);
    expect(g.isOwnCasinoUnlocked()).toBe(false);
    expect(g.isOwnCasinoOpen()).toBe(false);
    expect(g.state.ownCasino.opened).toBe(false);
    expect(g.getTakingsPerSecond()).toBe(0);
  });

  test('a migrated family opens it on its first tick of play, with the free cabinet on the floor', () => {
    const g = migratedGame(2);
    const opened = [];
    g.on('ownCasinoOpened', (e) => opened.push(e));
    expect(g.isOwnCasinoUnlocked()).toBe(true);
    expect(g.isOwnCasinoOpen()).toBe(false);
    g.update(1 / 60);
    expect(g.isOwnCasinoOpen()).toBe(true);
    expect(opened).toEqual([{ cabinet: 'clunky' }]);
    expect(g.state.ownCasino.cabinets).toEqual({ clunky: true });
    expect(g.state.stats.cabinetsBought).toBe(1);
    expect(g.state.diary.grandOpening).toBe(true);
    g.update(1);
    expect(opened.length).toBe(1); // once
  });

  test('nothing opens or fills in the Big Cage (time stands still there)', () => {
    const g = migratedGame(3);
    g.openBigCage();
    g.update(60);
    expect(g.state.ownCasino.opened).toBe(false);
    g.leaveBigCage();
    g.update(1 / 60);
    expect(g.isOwnCasinoOpen()).toBe(true);
    g.openBigCage();
    const till = num(g.state.ownCasino.till);
    g.update(600);
    expect(num(g.state.ownCasino.till)).toBe(till);
  });

  test('either casino flag left off (a store build) means no Family Casino', () => {
    for (const off of ['ownCasino', 'casino']) {
      const d = structuredClone(data);
      d[off].enabled = false;
      const g = migratedGame(4, d);
      g.update(10);
      expect(g.isOwnCasinoUnlocked()).toBe(false);
      expect(g.state.ownCasino.opened).toBe(false);
      expect(g.applyOfflineEarnings(7200) && num(g.state.ownCasino.till) > 0).toBe(false);
    }
  });
});

describe('takings are exact averages', () => {
  test('a cabinet earns its bet × the house edge once a spin (spin time + the rest), × the guests', () => {
    const g = openGame(5);
    expect(close(g.getCabinetRate('clunky'), rateOf('clunky'))).toBe(true);
    expect(close(g.getTakingsPerSecond(), rateOf('clunky'))).toBe(true);
    rich(g);
    for (const c of oc.cabinets) if (c.cost > 0) expect(g.buyCabinet(c.machine)).toBe(true);
    const all = oc.cabinets.reduce((s, c) => s + rateOf(c.machine), 0);
    expect(close(g.getTakingsPerSecond(), all)).toBe(true);
  });

  test('the upgrades multiply guests and bets and trim the guests\' return, exactly', () => {
    const g = rich(openGame(6));
    for (const u of oc.upgrades) while (g.canBuyFloorUpgrade(u.id)) g.buyFloorUpgrade(u.id);
    const sum = (type) => oc.upgrades.filter((u) => u.effect.type === type).reduce((s, u) => s + u.effect.perLevel * u.maxLevel, 0);
    const mods = { guests: 1 + sum('guests'), bets: 1 + sum('guestBet'), edge: sum('houseEdge') };
    expect(close(g.getGuestMultiplier(), mods.guests)).toBe(true);
    expect(close(g.getGuestBetMultiplier(), mods.bets)).toBe(true);
    expect(close(g.getCabinetRate('clunky'), rateOf('clunky', mods))).toBe(true);
    expect(close(g.getTillHours(), oc.tillHours + sum('tillHours'))).toBe(true);
  });

  test('the guests always play below 100% and never below the floor, so takings are never negative', () => {
    const g = rich(openGame(7));
    const check = () => {
      for (const c of oc.cabinets) {
        const rtp = g.getGuestRtp(c.machine);
        expect(rtp).toBeLessThan(1);
        expect(rtp).toBeGreaterThanOrEqual(oc.minGuestRtp);
        expect(g.getCabinetRate(c.machine)).toBeGreaterThan(0);
      }
    };
    check();
    while (g.canBuyFloorUpgrade('floorManager')) g.buyFloorUpgrade('floorManager');
    check();
  });

  test('the till fills by the rate while you play, up to its hours of takings', () => {
    const g = openGame(8);
    const t0 = num(g.state.ownCasino.till);
    g.update(60);
    expect(close(num(g.state.ownCasino.till) - t0, rateOf('clunky') * 60)).toBe(true);
    expect(g.isTillFull()).toBe(false);
    // (Nearly full, so the test doesn't have to play two hours.)
    g.state.ownCasino.till = g.getTillCapacity().sub(rateOf('clunky') * 5);
    g.update(10);
    expect(close(num(g.state.ownCasino.till), rateOf('clunky') * oc.tillHours * 3600)).toBe(true);
    expect(g.isTillFull()).toBe(true);
  });
});

describe('the till and Takings', () => {
  test('emptying the till banks it as Takings, and never touches coins or the seeds', () => {
    const g = openGame(9);
    g.update(600);
    const before = {
      coins: num(g.state.coins), run: num(g.state.run.coinsEarned), colony: num(g.state.colonyCoins),
      earned: num(g.state.stats.coinsEarned), seeds: num(g.getPendingSeeds()),
    };
    const till = num(g.state.ownCasino.till);
    const seen = [];
    g.on('tillEmptied', (e) => seen.push(num(e.amount)));
    expect(g.emptyTill()).toBe(true);
    expect(seen).toEqual([till]);
    expect(num(g.state.ownCasino.till)).toBe(0);
    expect(num(g.state.ownCasino.takings)).toBe(till);
    expect(num(g.state.stats.takingsEarned)).toBe(till);
    expect(g.state.stats.tillsEmptied).toBe(1);
    expect({
      coins: num(g.state.coins), run: num(g.state.run.coinsEarned), colony: num(g.state.colonyCoins),
      earned: num(g.state.stats.coinsEarned), seeds: num(g.getPendingSeeds()),
    }).toEqual(before);
    expect(g.emptyTill()).toBe(false); // nothing left in it
  });

  test('cabinets: bought once each, for their price', () => {
    const g = openGame(10);
    const c = cabinet('stacker');
    g.addTakings(c.cost - 1);
    expect(g.canBuyCabinet('stacker')).toBe(false);
    g.addTakings(1);
    expect(g.buyCabinet('stacker')).toBe(true);
    expect(num(g.state.ownCasino.takings)).toBe(0);
    rich(g);
    expect(g.buyCabinet('stacker')).toBe(false);
    expect(g.buyCabinet('clunky')).toBe(false);
    expect(g.buyCabinet('nope')).toBe(false);
    for (const x of oc.cabinets) g.buyCabinet(x.machine);
    expect(g.state.stats.cabinetsBought).toBe(oc.cabinets.length);
    expect(g.state.diary.fullFloor).toBe(true);
  });

  test('floor upgrades and back-office buys use rule 3\'s cost formula', () => {
    const g = rich(openGame(11));
    for (const u of oc.upgrades) {
      for (let lv = 0; lv < u.maxLevel; lv++) {
        expect(num(g.getFloorCost(u.id))).toBe(num(costAtLevel(u, lv)));
        expect(g.buyFloorUpgrade(u.id)).toBe(true);
      }
      expect(g.isFloorMaxed(u.id)).toBe(true);
      expect(g.buyFloorUpgrade(u.id)).toBe(false);
    }
    for (const r of oc.rewards) {
      for (let n = 0; n < 5; n++) {
        expect(num(g.getOwnRewardCost(r.id))).toBe(num(costAtLevel(r, n)));
        expect(g.buyOwnReward(r.id)).toBe(true);
      }
    }
  });

  test('a Chip Crate gives chips (earned, never coins) and a Token Box a token', () => {
    const g = rich(openGame(12));
    const coins = num(g.state.coins);
    const chips = num(g.state.casino.chips);
    const tokens = num(g.state.tokens);
    g.buyOwnReward('chipCrate');
    g.buyOwnReward('tokenBox');
    expect(num(g.state.casino.chips)).toBe(chips + reward('chipCrate').chips);
    expect(num(g.state.stats.chipsEarned)).toBe(reward('chipCrate').chips);
    expect(num(g.state.tokens)).toBeGreaterThanOrEqual(tokens + reward('tokenBox').tokens);
    expect(num(g.state.coins)).toBe(coins);
  });

  test('you can\'t spend what you haven\'t banked (the till doesn\'t count)', () => {
    const g = openGame(13);
    g.applyOfflineEarnings(oc.tillHours * 3600);
    expect(num(g.state.ownCasino.till)).toBeGreaterThan(upgrade('neonSign').baseCost);
    expect(g.canBuyFloorUpgrade('neonSign')).toBe(false);
    g.emptyTill();
    expect(g.buyFloorUpgrade('neonSign')).toBe(true);
  });
});

describe('while you\'re away', () => {
  test('the till fills by the same formula, up to its size (not the coins\' offline cap)', () => {
    const g = openGame(14);
    g.emptyTill();
    const offline = [];
    g.on('tillOffline', (e) => offline.push(e));
    g.applyOfflineEarnings(1800);
    expect(close(num(g.state.ownCasino.till), rateOf('clunky') * 1800)).toBe(true);
    expect(offline.length).toBe(1);
    g.emptyTill();
    rich(g);
    g.buyFloorUpgrade('cashier'); // the till holds 4 hours now: more than the coins' 2-hour cap
    g.emptyTill();
    g.state.ownCasino.till = g.state.ownCasino.till.mul(0);
    g.applyOfflineEarnings(10 * 3600);
    expect(close(num(g.state.ownCasino.till), rateOf('clunky') * g.getTillHours() * 3600)).toBe(true);
    expect(g.getTillHours() * 3600).toBeGreaterThan(data.offline.maxSeconds);
  });

  test('nothing for a short absence, nor in the Big Cage', () => {
    const g = openGame(15);
    g.emptyTill();
    g.applyOfflineEarnings(data.offline.minSeconds - 1);
    expect(num(g.state.ownCasino.till)).toBe(0);
    g.openBigCage();
    g.applyOfflineEarnings(3600);
    expect(num(g.state.ownCasino.till)).toBe(0);
  });
});

describe('the rest of the game is untouched', () => {
  test('your own machines pay exactly the same with the whole Family Casino', () => {
    const plain = openGame(16);
    const full = rich(openGame(16));
    for (const c of oc.cabinets) full.buyCabinet(c.machine);
    for (const u of oc.upgrades) while (full.canBuyFloorUpgrade(u.id)) full.buyFloorUpgrade(u.id);
    const eco = (g) => JSON.parse(JSON.stringify(g.getEconomy()));
    expect(eco(full)).toEqual(eco(plain));
    expect(num(full.getPayoutMultiplier())).toBe(num(plain.getPayoutMultiplier()));
    expect(full.getLuck()).toEqual(plain.getLuck());
  });

  test('it is kept when a hamster retires and when the family migrates', () => {
    const g = rich(openGame(17));
    g.buyCabinet('stacker');
    g.buyFloorUpgrade('neonSign');
    g.update(60);
    const kept = JSON.stringify(g.toSaveData().ownCasino);
    g.addCoins(1e9, true);
    g.retire();
    expect(JSON.stringify(g.toSaveData().ownCasino)).toBe(kept);
    // A migration: the whole tree planted, then migrate (colony.test.js has the details).
    g.addSeeds(1e7);
    for (let pass = 0; pass < 20; pass++) {
      for (const n of data.familyTree.nodes) {
        if (n.maxLevel === null && g.getTreeLevel(n.id) > 0) continue;
        while (g.canBuyTreeNode(n.id)) g.buyTreeNode(n.id);
      }
    }
    expect(g.migrate()).toBe(true);
    expect(JSON.stringify(g.toSaveData().ownCasino)).toBe(kept);
  });

  test('a save keeps it all (v' + SAVE_VERSION + '), and loading cleans what no longer exists', () => {
    const g = rich(openGame(18), 1234.5);
    g.buyCabinet('stacker');
    g.buyFloorUpgrade('neonSign');
    g.update(30);
    const save = g.toSaveData();
    expect(save.saveVersion).toBe(17);
    const h = createGame(structuredClone(data), createRng(1));
    expect(h.loadSaveData(structuredClone(save))).toBe(true);
    expect(h.toSaveData().ownCasino).toEqual(save.ownCasino);
    const broken = structuredClone(save);
    broken.ownCasino = { opened: true, cabinets: { stacker: true, nope: true }, upgrades: { neonSign: 99, nope: 2 }, rewards: { chipCrate: -3 }, till: '-5', takings: 'pie' };
    expect(h.loadSaveData(broken)).toBe(true);
    expect(h.toSaveData().ownCasino).toEqual({ opened: true, cabinets: { stacker: true }, upgrades: { neonSign: upgrade('neonSign').maxLevel }, rewards: {}, till: '0', takings: '0' });
  });
});
