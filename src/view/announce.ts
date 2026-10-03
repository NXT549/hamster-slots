// announce.ts — what screen readers hear about a spin (QOL, after 1.9.0).
// The page has one hidden "live region" (#sr-live in index.html): a screen reader
// reads out whatever text is put in it. The hamster's speech already goes there;
// this adds the spin results, which before were only shown (lit lines, "+N").
// Pure text-building, so tests can run it in Node.

import { formatCoins } from './dom.ts';
import type { GameEvents } from '../logic/types.ts';

const TIER_WORDS: Record<string, string> = { nice: 'Nice win! ', big: 'Big win! ', jackpot: 'Jackpot! ' };

// One spin's line, or '' when it isn't worth saying. A spin you pulled yourself is
// always said (a loss too, or you'd never know the reels stopped); auto-spin and free
// spins come every couple of seconds, so only their bigger wins are said, or the
// reader would talk without a break.
export function spinAnnouncement(e: GameEvents['spinResolved'], manual: boolean): string {
  const won = e.payout.gt(0);
  if (!manual && (!won || !TIER_WORDS[e.tier])) return '';
  if (!won) return 'No win.';
  const doubled = e.doubled ? ' Lucky Pennies doubled it.' : '';
  return `${TIER_WORDS[e.tier] || ''}Won ${formatCoins(e.payout)} coins.${doubled}`;
}

// A live region only speaks when its text CHANGES, so saying "No win." twice in a
// row would be silent the second time. Adding or dropping an invisible trailing
// space makes the text differ, and the reader says it again.
export function freshText(previous: string, text: string): string {
  return previous === text ? `${text} ` : text;
}
