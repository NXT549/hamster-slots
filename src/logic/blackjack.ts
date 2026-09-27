// blackjack.ts — LOGIC layer (M11, the Hamster Casino). Blackjack against the
// hamster dealer.
//
// Pure rules, no DOM and no clock (rule 1). The house rules (data.json may change
// what a blackjack pays):
//   · Every card is a fresh draw from a full deck (an "infinite deck", like the card
//     gamble), so the odds never depend on what came before, and can be worked out exactly.
//   · The dealer peeks: with an Ace or a ten showing, a dealer blackjack ends the hand at once.
//   · The dealer draws to 17 and stands on every 17 (a soft 17 too).
//   · You may hit, stand, or double down on your first two cards (one more card, bet ×2).
//     No splitting, no insurance.
//   · A blackjack (an Ace and a ten on your first two cards) pays 3 to 2; a win pays 1 to 1.
// blackjackRtp() works out the exact return with perfect play, for the Info line
// and the tests (the house keeps a small edge, the user's pick).

import type { Rng } from './rng.ts';
import type { SuitId } from './types.ts';

export interface BjCard { rank: number; suit: SuitId } // rank 1 = Ace, 11–13 = J, Q, K
export type BjOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';
const SUIT_IDS: readonly SuitId[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// A card's value: Ace 1 (it can count 11: see handValue), J/Q/K 10.
export const cardValue = (c: BjCard) => Math.min(10, c.rank);

// The best total of a hand, and whether an Ace is counting as 11 ("soft").
export function handValue(cards: readonly BjCard[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === 1) aces++;
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}

export const isBlackjack = (cards: readonly BjCard[]) => cards.length === 2 && handValue(cards).total === 21;

export function drawCard(rng: Rng): BjCard {
  const rank = Math.min(13, Math.floor(rng.next() * 13) + 1);
  const suit = SUIT_IDS[Math.min(3, Math.floor(rng.next() * 4))];
  return { rank, suit };
}

// The dealer draws until 17 or more (and stands on a soft 17).
export function dealerShouldHit(cards: readonly BjCard[]): boolean {
  return handValue(cards).total < 17;
}

// Who won a finished hand (the player didn't bust; the dealer has drawn).
export function settle(player: readonly BjCard[], dealer: readonly BjCard[]): BjOutcome {
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  if (p > 21) return 'bust';
  if (d > 21 || p > d) return 'win';
  return p === d ? 'push' : 'lose';
}

// What a hand pays back per chip bet, stake included (a push gives the stake back).
export function returnFor(outcome: BjOutcome, blackjackPays: number): number {
  return outcome === 'blackjack' ? 1 + blackjackPays : outcome === 'win' ? 2 : outcome === 'push' ? 1 : 0;
}

// ─────────────────────── the exact odds ───────────────────────

// The chance of each card value from a fresh deck: 1 (Ace) … 9 are 1/13 each; 10 is 4/13 (10, J, Q, K).
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const chance = (v: number) => (v === 10 ? 4 / 13 : 1 / 13);
const best = (hard: number, ace: boolean) => (ace && hard + 10 <= 21 ? hard + 10 : hard);

// Where the dealer ends up (17–21, or 22 = bust) from an upcard, once it has peeked
// and has no blackjack: the hole card can't be the card that would make one.
function dealerFinals(up: number): number[] {
  const out = new Array(23).fill(0);
  const play = (hard: number, ace: boolean, p: number) => {
    const t = best(hard, ace);
    if (t >= 17) {
      out[Math.min(22, t)] += p;
      return;
    }
    for (const v of VALUES) play(hard + v, ace || v === 1, p * chance(v));
  };
  // The hole card, knowing it doesn't make a blackjack.
  const banned = up === 1 ? 10 : up === 10 ? 1 : 0;
  const allowed = VALUES.filter((v) => v !== banned);
  const total = allowed.reduce((s, v) => s + chance(v), 0);
  for (const v of allowed) play(up + v, up === 1 || v === 1, chance(v) / total);
  return out;
}

// The player's expected results (per chip first bet) against one upcard: standing on
// a total, doubling a hand, and the best of stand / hit / double for a hand.
function evsFor(up: number) {
  const finals = dealerFinals(up);
  const stand = (t: number) => {
    if (t > 21) return -1;
    let ev = finals[22]; // the dealer busts
    for (let d = 17; d <= 21; d++) ev += d < t ? finals[d] : d > t ? -finals[d] : 0;
    return ev;
  };
  const after = (hard: number, ace: boolean, v: number) => (hard + v > 21 ? 22 : best(hard + v, ace || v === 1));
  const double = (hard: number, ace: boolean) => VALUES.reduce((s, v) => s + chance(v) * 2 * stand(after(hard, ace, v)), 0);
  const memo = new Map<string, number>();
  const bestEv = (hard: number, ace: boolean, firstTwo: boolean): number => {
    if (hard > 21) return -1;
    const key = `${hard}|${ace}|${firstTwo}`;
    if (memo.has(key)) return memo.get(key)!;
    let hit = 0;
    for (const v of VALUES) hit += chance(v) * bestEv(hard + v, ace || v === 1, false);
    const ev = Math.max(stand(best(hard, ace)), hit, firstTwo ? double(hard, ace) : -Infinity);
    memo.set(key, ev);
    return ev;
  };
  const hit = (hard: number, ace: boolean) => VALUES.reduce((s, v) => s + chance(v) * bestEv(hard + v, ace || v === 1, false), 0);
  return { stand, double, hit, bestEv };
}

// The best play for a hand ('stand', 'hit' or 'double'): the hint the table can show.
export function bestPlay(player: readonly BjCard[], dealerUp: BjCard): 'stand' | 'hit' | 'double' {
  const hard = player.reduce((s, c) => s + cardValue(c), 0);
  const ace = player.some((c) => c.rank === 1);
  if (best(hard, ace) >= 21) return 'stand';
  const e = evsFor(cardValue(dealerUp));
  const stand = e.stand(best(hard, ace));
  const hit = e.hit(hard, ace);
  const double = player.length === 2 ? e.double(hard, ace) : -Infinity;
  return double > Math.max(stand, hit) ? 'double' : hit > stand ? 'hit' : 'stand';
}

// The exact return to the player per chip bet, with perfect play: over every first
// two cards and upcard, the dealer's peek, blackjacks, and the best play after.
// (≈ 0.99 with the usual 3 to 2: the house keeps about 1%.)
export function blackjackRtp(blackjackPays: number): number {
  let ev = 0;
  for (const up of VALUES) {
    const pu = chance(up);
    const dealerBj = up === 1 ? chance(10) : up === 10 ? chance(1) : 0; // the peek finds a blackjack
    const bestEv = evsFor(up).bestEv;
    for (const a of VALUES) {
      for (const b of VALUES) {
        const p = pu * chance(a) * chance(b);
        const playerBj = (a === 1 && b === 10) || (a === 10 && b === 1);
        if (playerBj) ev += p * (dealerBj * 0 + (1 - dealerBj) * blackjackPays);
        else ev += p * (dealerBj * -1 + (1 - dealerBj) * bestEv(a + b, a === 1 || b === 1, true));
      }
    }
  }
  return 1 + ev;
}
