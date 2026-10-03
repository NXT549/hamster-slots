// diary2.test.js — Dear Diary: the new stickers, secret stickers and their three stats.

import { describe, it, expect } from 'vitest';
import { data, newGame, num, land, money } from './helpers.js';
import { migrateSave, SAVE_VERSION } from '../../src/logic/game.ts';

const sticker = (id) => data.diary.find((d) => d.id === id);

describe('Diary Volume 2 data', () => {
  it('has unique sticker ids', () => {
    const ids = data.diary.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every secret sticker a hint, and only secret ones', () => {
    for (const d of data.diary) {
      if (d.secret) expect(typeof d.hint === 'string' && d.hint.length > 0).toBe(true);
      else expect(d.hint).toBeUndefined();
    }
    expect(data.diary.filter((d) => d.secret).length).toBeGreaterThanOrEqual(5);
  });

  // "Every skin" and "every hat" must mean what's really in the capsules (not the
  // starters, not the casino's prizes), or the sticker could never be earned.
  it('"Full Wardrobe" and "Hat Rack" ask for exactly the capsule pool', () => {
    const pool = data.skins.filter((s) => s.rarity !== 'starter' && !s.casino && !s.festival);
    expect(sticker('fullWardrobe').goal.target).toBe(pool.length);
    expect(sticker('hatRack').goal.target).toBe(pool.filter((s) => s.category === 'hat').length);
  });

  it('"Line Party" and "Lucky Seven" ask for lines some machine has', () => {
    const most = Math.max(...data.machines.map((m) => (m.paylines || []).length));
    expect(sticker('lineParty').goal.target).toBeLessThanOrEqual(most);
    expect(sticker('luckySeven').goal.target).toBeLessThanOrEqual(most);
  });

  it('"Scrapbook" can be earned without itself', () => {
    expect(sticker('scrapbook').goal.target).toBeLessThan(data.diary.length);
  });
});

describe('secret stickers', () => {
  it('petting the hamster counts, and 25 pets earn "Hamster Hugs"', () => {
    const g = newGame(5);
    const pets = [];
    g.on('hamsterPetted', (e) => pets.push(e.pets));
    for (let i = 0; i < 24; i++) g.petHamster();
    expect(g.state.diary.hamsterHugs).toBeFalsy();
    const before = num(g.state.tokens);
    g.petHamster();
    expect(g.state.stats.pets).toBe(25);
    expect(pets.at(-1)).toBe(25);
    expect(g.state.diary.hamsterHugs).toBe(true);
    expect(num(g.state.tokens) - before).toBeGreaterThanOrEqual(sticker('hamsterHugs').tokens);
  });

  it('worstDrySpell is the longest run of paid spins without a winning line', () => {
    const g = newGame(11);
    g.addCoins(1e9);
    let run = 0;
    let worst = 0;
    g.on('spinResolved', (e) => {
      if (e.free) return;
      run = e.wins.length > 0 ? 0 : run + 1;
      worst = Math.max(worst, run);
    });
    for (let i = 0; i < 400; i++) {
      g.spin();
      land(g);
      if (g.state.gamble) g.collectGamble();
    }
    expect(worst).toBeGreaterThan(0);
    expect(g.state.stats.worstDrySpell).toBe(worst);
    expect(!!g.state.diary.drySpell).toBe(worst >= sticker('drySpell').goal.target);
  });

  it('spending the last coins on a spin earns "Rock Bottom"', () => {
    const g = newGame(3);
    const cost = g.getBetCost(1);
    g.state.coins = money(cost); // exactly one spin left
    g.spin();
    expect(g.state.stats.lastCoinSpins).toBe(1);
    expect(g.state.diary.rockBottom).toBe(true);
  });

  it('a spin with coins to spare is not rock bottom', () => {
    const g = newGame(3);
    g.addCoins(1000);
    g.spin();
    expect(g.state.stats.lastCoinSpins).toBe(0);
  });
});

describe('save v16', () => {
  it('a v15 save loads with the new stats at 0 and gets the stickers it already reached', () => {
    const g = newGame(7);
    g.addCoins(1e9);
    for (let i = 0; i < 30; i++) { g.spin(); land(g); }
    const save = JSON.parse(JSON.stringify(g.toSaveData()));
    save.saveVersion = 15;
    delete save.stats.pets;
    delete save.stats.worstDrySpell;
    delete save.stats.lastCoinSpins;
    const migrated = migrateSave(save, data);
    expect(migrated.saveVersion).toBe(SAVE_VERSION);
    const h = newGame(7);
    expect(h.loadSaveData(save)).toBe(true);
    expect(h.state.stats.pets).toBe(0);
    expect(h.state.stats.lastCoinSpins).toBe(0);
    expect(h.state.stats.spins).toBe(g.state.stats.spins);
  });
});
