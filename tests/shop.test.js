// shop.test.js — the Upgrades tab's words and rules (1.6.0, "New Digs", part 3: shop.ts rebuilt
// on the kit). Runs in Node on a real game: the helpers it checks are pure.
//
// - How a locked upgrade says it opens, short (its tile) and long (its sheet).
// - A machine's features, named (its sheet) for its icon chips (its page).
// - Level pips only for a small max level.
// - The Upgrades tab's dot: something affordable now that wasn't when you last looked.

import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/logic/rng.ts';
import { createGame } from '../src/logic/game.ts';
import { lockShort, lockText, machineFeatures, pipCount, newlyAffordable } from '../src/view/shop.ts';
import { perkState } from '../src/view/colony.ts';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const freshGame = () => createGame(structuredClone(data), createRng(1));

describe('locked upgrades say how they open', () => {
  const g = freshGame();
  const all = g.getAvailableUpgrades();
  const rebirth = all.find((d) => { const l = g.getUpgradeLock(d.id); return l && l.generation && !l.sticker; });
  const sticker = all.find((d) => { const l = g.getUpgradeLock(d.id); return l && l.sticker && !l.generation; });
  test('there are rebirth and sticker upgrades to check', () => {
    expect(rebirth).toBeTruthy();
    expect(sticker).toBeTruthy();
  });
  test('a rebirth upgrade: "Opens with your Nth hamster", and in full how many retirements are left', () => {
    const lock = g.getUpgradeLock(rebirth.id);
    const nth = ['', '1st', '2nd', '3rd'][lock.generation] || `${lock.generation}th`;
    expect(lockShort(g, rebirth.id)).toBe(`Opens with your ${nth} hamster`);
    const left = lock.generation - g.state.generation;
    expect(lockText(g, rebirth.id)).toContain(`retire ${left} more time${left === 1 ? '' : 's'}`);
    expect(lockText(g, rebirth.id)).toMatch(/^A rebirth upgrade/);
  });
  test('a sticker upgrade: "Earn the … sticker", and in full what the sticker asks', () => {
    const def = g.data.diary.find((d) => d.id === g.getUpgradeLock(sticker.id).sticker);
    expect(lockShort(g, sticker.id)).toBe(`Earn the ${def.name} sticker`);
    expect(lockText(g, sticker.id)).toContain(`<b>${def.name}</b> (${def.description})`);
  });
  test('no emoji padlocks any more (the padlock is a sprite)', () => {
    for (const d of all) {
      expect(lockShort(g, d.id) || '').not.toContain('🔒');
      expect(lockText(g, d.id) || '').not.toContain('🔒');
    }
  });
  test('an upgrade on sale has no lock text', () => {
    const open = all.find((d) => !g.getUpgradeLock(d.id));
    expect(lockShort(g, open.id)).toBeNull();
    expect(lockText(g, open.id)).toBeNull();
  });
});

describe('machine pages', () => {
  test('every feature a machine has gets an icon and a name', () => {
    const g = freshGame();
    for (const md of g.data.machines) {
      const info = g.getMachineInfo(md.id);
      const features = machineFeatures(info);
      for (const f of features) {
        expect(typeof f.icon).toBe('string');
        expect(f.name.length).toBeGreaterThan(0);
      }
      // The flags it shows are the ones the machine has.
      expect(features.some((f) => f.icon === 'ballIcon')).toBe(!!info.features.freeSpins);
      expect(features.some((f) => f.icon === 'pouchPolish')).toBe(!!info.features.jackpot);
      expect(features.some((f) => f.icon === 'acornIcon')).toBe(!!info.features.holdSpin);
      expect(features.some((f) => f.icon === 'cheeseIcon')).toBe(!!info.features.wheel);
    }
  });
});

describe('tiles', () => {
  test('pips only for a max level from 2 to 12', () => {
    expect(pipCount({ maxLevel: 5 })).toBe(5);
    expect(pipCount({ maxLevel: 12 })).toBe(12);
    expect(pipCount({ maxLevel: 1 })).toBe(0);
    expect(pipCount({ maxLevel: 25 })).toBe(0);
    expect(pipCount({})).toBe(0);
  });
});

describe("the Upgrades tab's dot", () => {
  test('only for something that was not affordable when you last looked', () => {
    expect(newlyAffordable(['cheeks'], new Set())).toBe(true);
    expect(newlyAffordable(['cheeks'], new Set(['cheeks']))).toBe(false);
    expect(newlyAffordable([], new Set(['cheeks']))).toBe(false); // (bought it: nothing new)
    expect(newlyAffordable(['cheeks', 'machine:stacker'], new Set(['cheeks']))).toBe(true);
  });
});

// The Colony's perk tiles (New Digs part 4) are bought like upgrades: their state comes from the
// game's own canBuyPerk / isPerkMaxed, and their price is the game's (rule 3's one cost formula).
describe('colony perk tiles', () => {
  test('saving → ready → maxed follows the game, and the price is the game\'s', () => {
    const g = freshGame();
    const perk = g.data.colony.perks.find((p) => p.maxLevel);
    expect(perkState(g, perk.id)).toBe('saving');
    expect(g.getPerkCost(perk.id).eq(Math.floor(perk.baseCost))).toBe(true);
    g.addWhiskers(g.getPerkCost(perk.id));
    expect(perkState(g, perk.id)).toBe('ready');
    g.addWhiskers(1e9);
    while (g.canBuyPerk(perk.id)) g.buyPerk(perk.id);
    expect(g.getPerkLevel(perk.id)).toBe(perk.maxLevel);
    expect(perkState(g, perk.id)).toBe('maxed');
  });
});
