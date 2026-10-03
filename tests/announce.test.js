// announce.test.js — what screen readers hear about a spin (src/view/announce.ts).
// A spin you pulled is always said, a loss too; auto and free spins only say their
// bigger wins, so the reader isn't talking every couple of seconds.

import { describe, test, expect } from 'vitest';
import { money } from '../src/logic/money.ts';
import { spinAnnouncement, freshText } from '../src/view/announce.ts';

const spin = (payout, tier, extra = {}) => ({
  machineId: 'oldClunky', result: [], wins: [], payout: money(payout), fullLine: false, tier,
  bet: 1, free: false, streak: 0, featureCells: [], doubled: false, ...extra,
});

describe('spin announcements', () => {
  test('a manual spin says how it went, a loss too', () => {
    expect(spinAnnouncement(spin(0, 'none'), true)).toBe('No win.');
    expect(spinAnnouncement(spin(12, 'win'), true)).toBe('Won 12 coins.');
    expect(spinAnnouncement(spin(5000, 'big'), true)).toBe('Big win! Won 5K coins.');
    expect(spinAnnouncement(spin(24, 'nice', { doubled: true }), true)).toBe('Nice win! Won 24 coins. Lucky Pennies doubled it.');
  });

  test('auto and free spins only say their bigger wins', () => {
    expect(spinAnnouncement(spin(0, 'none'), false)).toBe('');
    expect(spinAnnouncement(spin(12, 'win'), false)).toBe('');
    expect(spinAnnouncement(spin(40, 'nice', { free: true }), false)).toBe('Nice win! Won 40 coins.');
    expect(spinAnnouncement(spin(1e6, 'jackpot'), false)).toBe('Jackpot! Won 1M coins.');
  });

  test('the same line twice in a row still changes the text, so it is said again', () => {
    const first = freshText('', 'No win.');
    const second = freshText(first, 'No win.');
    const third = freshText(second, 'No win.');
    expect(first).toBe('No win.');
    expect(second).not.toBe(first);
    expect(third).toBe(first);
    expect(freshText('No win.', 'Won 3 coins.')).toBe('Won 3 coins.');
  });
});
