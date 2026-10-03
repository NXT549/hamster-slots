# Content idea: Three colony machines

> **Idea, not approved.** New machines and mechanics: plan with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Bigger Burrows"** (minor update). Like M9 (DESIGN §24) and Moving Day (§29).

## Pitch
Players past their first Great Migration have seen every machine. Three new ones, unlocked by later colonies (`"colony": 2`, `3`, `4`), each with a pokie mechanic the game doesn't have yet, so the late game gets new toys, not only bigger numbers.

| Machine | Mechanic | Hamster reason |
|---|---|---|
| **The Nut Cracker** | **Expanding wilds:** a Walnut wild that lands fills its whole reel | the walnut cracks open and the shell covers the reel |
| **The Cheek Stuffer** | **Colossal symbols:** a 2×2 or 3×3 block of one symbol lands on the middle reels | cheeks stuffed with one snack |
| **The Top Hat** | **Multiplier wilds:** hat wilds carry ×2 or ×3; a line's wilds multiply together | the hamster pulls a bonus out of a hat |

## Why these three
`rollGrid` draws each cell from the weights, independently. Each mechanic keeps line EV **exact** by linearity (rule 4, `spinExpectation`):
- **Expanding:** a reel is all-wild with chance `1 − (1 − w)^rows`; otherwise its cells come from the weights without the wild. Per line, enumerate wild-reel / not.
- **Colossal:** enumerate block present × position × symbol; covered cells share one symbol, others are independent.
- **Multiplier wilds:** each reel's state is a symbol or a wild ×m; enumerate per line like `expectedValue` does with the plain wild.
Rejected: cascades/tumbles and cluster pays (exact EV not tractable), nudges with a choice (EV depends on the player).

## Rules to keep
- Rule 4 in every setup (reels, lines, Luck, symbol unlocks, Pays Both Ways if offered, features); add each machine to the RTP and symbol-unlock tests.
- Rule 2: weights, payouts, expand/colossal/multiplier chances in data.json.
- Rule 9/11: new 32×32 symbols (art.ts), a painted cabinet per machine (`cabinet.ts`, `CABINET_TOKENS`), new animations each with a `.less-motion` rule.
- Colony perks never change odds (rule 4).

## Plan (one machine per step; each leaves the game playable)
1. **machine.ts:** the mechanic as a pure function (`expandWilds(grid, …)`, `placeColossal(grid, …, rng)`, line multipliers in `evaluateGrid`), plus its exact EV term in `spinExpectation`. Brute-force test: a 1M-spin Monte Carlo lands within tolerance of the exact EV.
2. **data.json:** the machine (symbols, payouts, unlocks, Machine Luck, spin-cost upgrade, stars, `"colony": N`), its upgrades.
3. **game.ts:** wire into the spin (events gain `expanded` / `colossal` / `multipliers` fields for the view).
4. **Save:** owned machines are saved already; if new state is needed, `SAVE_VERSION` bump + migration + fixtures. `npm run economy` for the DESIGN tables.
5. **View:** symbols, cabinet, the reveal animation (shell cracks, block drops, hat tips).
6. **Sim:** `node tools/sim.mjs --lives 20` with colonies: when each machine arrives, colony lengths before/after (Balance log).
7. **Docs:** DESIGN §16/§24-style section per machine, roadmap row, CHANGELOG, Decision, stickers.

## Interactions
- **Pacing (balancing-2.md):** colony 3's middle lives are already short (2–5 min). A machine unlocked in colony 2 or 3 adds income there, so measure colonies 2–3 with `node tools/sim.mjs --migrate --colonies 3` before and after, and do this after (or with) balancing round 2.

## Questions for the user
- All three, or pick one or two?
- Colony machines (late game), or one earlier for newer players?
