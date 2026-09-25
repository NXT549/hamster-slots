// rng.ts — LOGIC layer. Seedable random numbers.
//
// Why not Math.random()? Because Math.random() can't be replayed. With a seed,
// the same seed always gives the same sequence of spins, which makes tests and
// balance simulations repeatable.
//
// The algorithm is "mulberry32": tiny, fast, and good enough for a game.

// What createRng gives back. Anything with a weight can be picked by weight.
export interface Rng {
  seed: number;
  next(): number;
  pickWeighted<T extends { weight: number }>(items: readonly T[]): T;
  getState(): number;
  setState(s: number): void;
}

export function createRng(seed: number): Rng {
  // ">>> 0" forces the number into an unsigned 32-bit integer.
  let state = seed >>> 0;

  // Returns a float in [0, 1), like Math.random().
  function next(): number {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Picks one item from a list using each item's "weight".
  // Example: weights 55/30/15 → the first item is picked 55% of the time.
  // How: roll a number between 0 and the total weight, then walk the list
  // subtracting weights until the roll falls inside an item's slice.
  function pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
    let total = 0;
    for (const item of items) total += item.weight;
    let roll = next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    // Only reached through float rounding: the last item that can be picked at all
    // (a symbol that's still locked has weight 0 and must never land).
    for (let i = items.length - 1; i >= 0; i--) if (items[i].weight > 0) return items[i];
    return items[items.length - 1];
  }

  return {
    seed: seed >>> 0,
    next,
    pickWeighted,
    // getState/setState let tests compare or copy the exact position in the sequence.
    getState: () => state,
    setState: (s: number) => { state = s >>> 0; },
  };
}
