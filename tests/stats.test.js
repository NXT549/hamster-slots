// stats.test.js — the stats, Diary and Recent wins QoL (view helpers, checked in Node on real games).
//
// - Menu → Stats: every stat the logic counts is shown somewhere (stats.ts statSections),
//   with "This life" first; the casino sections wait until they've been reached.
// - The Diary: nearest stickers first, finished ones in their own list (capsules.ts diaryOrder).
// - Recent wins: kept as text between visits and read back safely (payouts.ts serializeLog/parseLog).

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/logic/rng.ts';
import { createGame } from '../src/logic/game.ts';
import { money } from '../src/logic/money.ts';
import { statSections } from '../src/view/stats.ts';
import { diaryOrder } from '../src/view/capsules.ts';
import { serializeLog, parseLog } from '../src/view/payouts.ts';
import { createMemoryPlatform } from '../src/platform/memory.ts';
import { clearSave, loadWinLog, saveWinLog } from '../src/platform/save.ts';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const fresh = () => createGame(structuredClone(data), createRng(1));
const titles = (g) => statSections(g).map((s) => s.title);

describe('Menu → Stats', () => {
  test('"This life" comes first, with the pup\'s name and coins per minute', () => {
    const g = fresh();
    const [life] = statSections(g);
    expect(life.title).toBe(`This life: ${g.getPupName()}`);
    expect(life.rows.find(([l]) => l === 'Coins per minute')[1]).toBe('—'); // under a minute: no rate yet
    g.state.run.playTime = 120;
    g.state.run.coinsEarned = money(600);
    expect(statSections(g)[0].rows.find(([l]) => l === 'Coins per minute')[1]).toBe('300');
  });

  test('the casino sections only show once they have been reached', () => {
    const g = fresh();
    expect(titles(g)).not.toContain('The Hamster Casino');
    expect(titles(g)).not.toContain('Your casino');
    g.state.stats.casinoGames = 3;
    g.state.ownCasino.opened = true;
    expect(titles(g)).toContain('The Hamster Casino');
    expect(titles(g)).toContain('Your casino');
  });

  // A stat the logic counts but nobody can see is wasted: give every one a visible number.
  // (Each stat is set to its own odd value; its row must change when it does.)
  test('every lifetime stat is shown somewhere', () => {
    const g = fresh();
    g.state.colony = 1; // (every section showing)
    g.state.ownCasino.opened = true;
    g.state.stats.casinoGames = 1;
    const shown = () => JSON.stringify(statSections(g));
    const missing = [];
    for (const key of Object.keys(g.state.stats)) {
      const before = shown();
      const old = g.state.stats[key];
      g.state.stats[key] = typeof old === 'number' ? 987654 : money(987654);
      if (shown() === before) missing.push(key);
      g.state.stats[key] = old;
    }
    expect(missing).toEqual([]);
  });
});

describe('the Diary order', () => {
  test('nearest first, ties keep their order, finished ones apart', () => {
    const order = diaryOrder([
      { id: 'a', value: 1, target: 10, done: false },
      { id: 'b', value: 9, target: 10, done: false },
      { id: 'c', value: 5, target: 5, done: true },
      { id: 'd', value: 1, target: 10, done: false },
      { id: 'e', value: 50, target: 10, done: false }, // past the goal (awarded on the next check): first
    ]);
    expect(order).toEqual({ open: ['e', 'b', 'a', 'd'], done: ['c'] });
  });

  test('works on the real diary', () => {
    const g = fresh();
    const rows = data.diary.map((d) => ({ id: d.id, ...g.getDiaryProgress(d.id) }));
    const order = diaryOrder(rows);
    expect([...order.open, ...order.done].sort()).toEqual(data.diary.map((d) => d.id).sort());
  });
});

describe('Recent wins between visits', () => {
  const ids = data.machines.map((m) => m.id);
  const entry = {
    machineId: ids[0], kind: 'spin', payout: money('1.5e40'), tier: 'big', bet: 5, at: 1000,
    wins: [{ symbolId: 'seed', count: 3, payout: money(9), line: 0, fullLine: true, fromRight: false, basePayout: 3, usedWild: false }],
  };

  test('a log reads back as it was written', () => {
    const [back] = parseLog(serializeLog([entry, { machineId: ids[0], kind: 'gamble', payout: money(-20), text: 'Gamble lost', at: 2000 }]), ids);
    expect(back.payout.eq(entry.payout)).toBe(true);
    expect(back.wins).toEqual([{ symbolId: 'seed', count: 3, ways: undefined, wheel: undefined }]);
    expect([back.tier, back.bet, back.at]).toEqual(['big', 5, 1000]);
    expect(parseLog(serializeLog([entry, { machineId: ids[0], kind: 'gamble', payout: money(-20), text: 'Gamble lost', at: 2000 }]), ids)[1].payout.toNumber()).toBe(-20);
  });

  test('anything odd is left out, never thrown', () => {
    expect(parseLog(null, ids)).toEqual([]);
    expect(parseLog('not json', ids)).toEqual([]);
    expect(parseLog('{"a":1}', ids)).toEqual([]);
    const bad = [{ ...entry, machineId: 'gone' }, { ...entry, kind: 'nope' }, { ...entry, at: 'x' }, { ...entry, wins: 'x' }, null];
    expect(parseLog(JSON.stringify(bad), ids)).toEqual([]);
    expect(parseLog(JSON.stringify([{ ...entry, payout: '12', tier: 'x" onclick="y' }]), ids)[0].tier).toBeUndefined();
  });

  test('Reset clears it', () => {
    const p = createMemoryPlatform();
    saveWinLog(p, serializeLog([entry]));
    expect(parseLog(loadWinLog(p), ids)).toHaveLength(1);
    clearSave(p);
    expect(loadWinLog(p)).toBeNull();
  });
});
