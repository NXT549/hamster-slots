// festival.test.js — Pumpkin Night: festival dates, candy, the stall, and the end.

import { describe, it, expect } from 'vitest';
import { data, newGame, num, land, createGame, createRng } from './helpers.js';
import { festivalOnDate, monthDay } from '../../src/logic/festival.ts';

const fd = data.festivals;
const pumpkin = fd.list.find((f) => f.id === 'pumpkinNight');
const [startM, startD] = pumpkin.start.split('-').map(Number);

// A game on Pumpkin Night's first day.
function festive(seed = 1) {
  const g = newGame(seed);
  g.setDate(startM, startD);
  return g;
}

describe('festival dates', () => {
  it('reads month-days', () => {
    expect(monthDay('10-20')).toBe(1020);
    expect(monthDay('01-05')).toBe(105);
  });

  it('Pumpkin Night is on from its first to its last day, and not around them', () => {
    expect(festivalOnDate(pumpkin, 10, 20)).toBe(true);
    expect(festivalOnDate(pumpkin, 10, 31)).toBe(true);
    expect(festivalOnDate(pumpkin, 11, 3)).toBe(true);
    expect(festivalOnDate(pumpkin, 10, 19)).toBe(false);
    expect(festivalOnDate(pumpkin, 11, 4)).toBe(false);
    expect(festivalOnDate(pumpkin, 6, 1)).toBe(false);
  });

  it('a festival can cross New Year', () => {
    const snow = { id: 'snow', name: 'Snow Day', start: '12-20', end: '01-05', items: [] };
    expect(festivalOnDate(snow, 12, 25)).toBe(true);
    expect(festivalOnDate(snow, 1, 3)).toBe(true);
    expect(festivalOnDate(snow, 1, 6)).toBe(false);
    expect(festivalOnDate(snow, 12, 19)).toBe(false);
  });

  it('no two festivals overlap', () => {
    for (const a of fd.list) for (const b of fd.list) {
      if (a === b) continue;
      for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) expect(festivalOnDate(a, m, d) && festivalOnDate(b, m, d)).toBe(false);
    }
  });
});

describe('starting and ending', () => {
  it('nothing is on in a new game until the date says so', () => {
    const g = newGame(1);
    expect(g.getFestival()).toBe(null);
    g.setDate(6, 1);
    expect(g.getFestival()).toBe(null);
    const started = [];
    g.on('festivalStarted', (e) => started.push(e.id));
    g.setDate(startM, startD);
    expect(g.getFestival().id).toBe('pumpkinNight');
    g.setDate(10, 25); // the same festival: no new start
    expect(started).toEqual(['pumpkinNight']);
  });

  it('at the end, leftover candy becomes Hamster Tokens (rounded down), and the candy is gone', () => {
    const g = festive();
    g.addTreats(23);
    const tokens = num(g.state.tokens);
    const ended = [];
    g.on('festivalEnded', (e) => ended.push(e));
    g.setDate(11, 4);
    expect(g.getFestival()).toBe(null);
    expect(g.state.festival.treats).toBe(0);
    expect(num(g.state.tokens) - tokens).toBe(Math.floor(23 / fd.treatsPerToken));
    expect(ended).toEqual([{ id: 'pumpkinNight', treats: 23, tokens: Math.floor(23 / fd.treatsPerToken) }]);
  });

  it('candy is not collected outside a festival', () => {
    const g = newGame(1);
    g.addTreats(10);
    g.startDelivery();
    g.update(data.delivery.duration + 0.1);
    expect(g.state.festival.treats).toBe(0);
    expect(g.state.stats.treatsEarned).toBe(0);
  });
});

describe('collecting candy', () => {
  it('a candy every few winning spins (counted, not rolled)', () => {
    const g = festive(9);
    g.addCoins(1e9);
    let wins = 0;
    g.on('spinResolved', (e) => { if (num(e.payout) > 0) wins++; });
    for (let i = 0; i < 300; i++) {
      g.spin();
      land(g);
      if (g.state.gamble) g.collectGamble();
    }
    expect(wins).toBeGreaterThan(fd.winsPerTreat);
    expect(g.state.festival.treats).toBe(Math.floor(wins / fd.winsPerTreat));
    expect(g.state.festival.wins).toBe(wins % fd.winsPerTreat);
    expect(g.state.stats.treatsEarned).toBe(g.state.festival.treats);
  });

  it('a festival never changes the reels: the same seed spins the same with or without it', () => {
    const play = (on) => {
      const g = newGame(42);
      if (on) g.setDate(startM, startD);
      g.addCoins(1e6);
      const grids = [];
      g.on('spinResolved', (e) => grids.push(JSON.stringify(e.result) + num(e.payout)));
      for (let i = 0; i < 100; i++) { g.spin(); land(g); if (g.state.gamble) g.collectGamble(); }
      return { grids, coins: num(g.state.coins) };
    };
    expect(play(true)).toEqual(play(false));
  });

  it('every delivery brings candy', () => {
    const g = festive();
    g.startDelivery();
    g.update(data.delivery.duration + 0.1);
    expect(g.state.festival.treats).toBe(fd.treatsPerDelivery);
  });

  it('time away brings candy, up to the offline limit', () => {
    const g = festive();
    g.applyOfflineEarnings(30 * 60);
    expect(g.state.festival.treats).toBe(Math.floor(30 / fd.awayMinutesPerTreat));
    const h = festive();
    h.applyOfflineEarnings(100 * 3600);
    expect(h.state.festival.treats).toBe(Math.floor(data.offline.maxSeconds / 60 / fd.awayMinutesPerTreat));
  });
});

describe('the stall', () => {
  it('sells every item for its price, once, and the outfit is kept after the festival', () => {
    const g = festive();
    const item = pumpkin.items[0];
    expect(g.buyFestivalItem(item.skin)).toBe(false); // no candy yet
    g.addTreats(item.cost + 3);
    expect(g.buyFestivalItem(item.skin)).toBe(true);
    expect(g.state.festival.treats).toBe(3);
    expect(g.isSkinOwned(item.skin)).toBe(true);
    expect(g.state.stats.festivalItems).toBe(1);
    g.addTreats(item.cost);
    expect(g.buyFestivalItem(item.skin)).toBe(false); // already yours
    g.setDate(12, 1);
    expect(g.isSkinOwned(item.skin)).toBe(true);
    expect(g.buyFestivalItem(pumpkin.items[1].skin)).toBe(false); // the stall is closed
  });

  it('buying everything earns "Dressed to Spook"', () => {
    const g = festive();
    g.addTreats(pumpkin.items.reduce((sum, i) => sum + i.cost, 0));
    for (const i of pumpkin.items) expect(g.buyFestivalItem(i.skin)).toBe(true);
    expect(g.state.diary.dressedToSpook).toBe(true);
  });

  it('festival skins are real skins, never in a capsule, and wear like their rarity', () => {
    for (const i of pumpkin.items) {
      const def = data.skins.find((s) => s.id === i.skin);
      expect(def.festival).toBe('pumpkinNight');
      const twin = data.skins.find((s) => s.category === def.category && s.rarity === def.rarity && !s.festival && !s.casino);
      expect(def.effects).toEqual(twin.effects);
    }
    const g = createGame(structuredClone(data), createRng(5));
    g.addTokens(100000);
    for (let i = 0; i < 400; i++) g.pullCapsule();
    for (const i of pumpkin.items) expect(g.isSkinOwned(i.skin)).toBe(false);
  });
});

describe('saving', () => {
  it('a festival and its candy survive a save and load', () => {
    const g = festive();
    g.addTreats(17);
    const h = newGame(2);
    expect(h.loadSaveData(JSON.parse(JSON.stringify(g.toSaveData())))).toBe(true);
    expect(h.getFestival().id).toBe('pumpkinNight');
    expect(h.state.festival.treats).toBe(17);
  });

  it('a festival that is no longer in the data ends at the next date, and pays its candy', () => {
    const g = festive();
    g.addTreats(10);
    const save = JSON.parse(JSON.stringify(g.toSaveData()));
    save.festival.id = 'oldFestival';
    const h = newGame(2);
    h.loadSaveData(save);
    const tokens = num(h.state.tokens);
    h.setDate(startM, startD);
    expect(num(h.state.tokens) - tokens).toBe(Math.floor(10 / fd.treatsPerToken));
    expect(h.getFestival().id).toBe('pumpkinNight');
    expect(h.state.festival.treats).toBe(0);
  });
});
