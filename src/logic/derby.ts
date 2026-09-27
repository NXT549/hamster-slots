// derby.ts — LOGIC layer (M11, the Hamster Casino). The Hamster Derby: five
// hamsters race; bet on the one you think wins.
//
// Pure rules, no DOM and no clock (rule 1). Each racer has a chance to win (its
// weight) and what it pays back for a win, stake included (data.json, rule 2): the
// favourite pays little, the long shot a lot, and every racer returns a little less
// than you bet on average (the house's small edge). The winner is picked when the
// race starts; the view only animates it (like the jackpot wheel, D92).

import type { Rng } from './rng.ts';

export interface RacerDef { id: string; name: string; weight: number; pays: number }

export function racerChance(racer: RacerDef, racers: readonly RacerDef[]): number {
  const total = racers.reduce((s, r) => s + r.weight, 0);
  return total > 0 ? racer.weight / total : 0;
}

// The exact return to the player of a bet on one racer.
export function derbyRtp(racer: RacerDef, racers: readonly RacerDef[]): number {
  return racerChance(racer, racers) * racer.pays;
}

// Who wins the race.
export function runDerby(rng: Rng, racers: readonly RacerDef[]): RacerDef {
  return rng.pickWeighted(racers);
}
