# Balancing pass (plan)

> **Status: planned, don't build until asked.** Balance direction is an ask-first change (AGENTS.md): show the user the decisions in "Ask first" before touching data.json. Ships as its own update after 1.6.x; the user picks version and name (D138).

Goal: fix the open balance issues in AGENTS.md → Current status without touching the first life the user signed off ("real slog", D93) or any balance rule (DESIGN §9).

## Read only these

- DESIGN §9 (rules), §10 (targets), §29 → Colony perks + Balance, §27 → Balance, §25 → Balance.
- PORTING_NOTES: D93, D127–D128 (seed jar), D146 (softcap), Balance log tail, Playtest notes (newest 3 entries).
- Code: `seedTotal` / `seedCoins` (bottom of game.ts, also used by `migrateSave`), `seedsForCoins`, `whiskersFor`; data.json `retirement`, `colony.perks`, `casino.prizes`, `casino.chipsPerRetirement`.
- `node tools/sim.mjs --help`.

## Baseline (measured 2026-10-03 on 1.6.0, Node 22)

`node tools/sim.mjs --migrate --lives 34 --seeds 3` (idle) and `--player active`. Life lengths in minutes, ranges over seeds. Re-run before starting; numbers move with any data change.

| | idle | active |
|---|---|---|
| Colony 1, gens 1 · 5 · 8 | 50–61 · 37–46 · 11–16 | 31–33 · 27–31 · 7–10 |
| Colony 1, gens 9–10 (before the softcap bites) | 7–14 · 6–9 | 7–10 · 5–10 |
| Colony 1, gens 11–12 | 9–11 · 7–11 | 4.5–8.6 |
| Migration 1 | 5.0–5.8 h, 9–10 whiskers | 3.4–3.9 h, 10–11 |
| Colony 2, gens 1–5 | 9–20 | 4–11 |
| **Colony 2, gens 7–15** | **2.5–6.5** | **1.0–5.0** |
| Migration 2 | +2.1 h (7.1–7.7 h), 38–49 whiskers | +1.2 h, 33–37 |
| **Colony 3, gens 1–9** | **1.7–12.5, mostly 2–5** | **0.9–4.4** |

Reading: colony 1 is fine (softcap works). Every later colony is shorter than the last and its late lives are back to 1–5 minutes, worse than before 1.4.0. Cause (D146): the softcap sits at a fixed 100 seeds every colony, while Colony Pride (+50% payouts a level, 1 × 1.6ⁿ whiskers, no max, its own multiplier group) and Seed Sense grow income and seeds every colony. 38–49 whiskers at migration 2 buy ~6–7 Pride levels at once (×4–4.5 payouts).

## Issues, ranked

| # | Issue | Evidence | Plan |
|---|---|---|---|
| **B1** | Colony 2+ late lives 1–6 min; colony 3 runs away | baseline above | **Fix (main work)** |
| B2 | Colony 1 gens 9–10 dip (6–9 idle) before the softcap starts at 100 seeds | baseline | Try in the same pass as B1 |
| B3 | Casino boosts cut late lives by up to a third (§27) | `--casino` | Re-measure after B1; data trim only if still > 25% |
| B4 | Wardrobe: mid-game lives 10–30% shorter (§25) | §25 table | Leave (user picked "gentle"); playtest decides |
| B5 | Upgrades the bot never buys: Night Shift, Cosy Nest, Golden Touch, Tip Jar, Card Counter | §28 | Not balance (offline/tokens/QoL; the sim can't value them). Leave; sim addition below |
| B6 | Colony 1 lives climb to the 120 min cap from gen ~16 if you don't migrate | §29 | Intended nudge (D146). Playtest question only |

Not touched: gen 1–8 of colony 1, any RTP or machine pay table, the rule 2/3 floor (§10), the card gamble, casino returns.

## B1 + B2: the change

Two levers, try both, pick with the sim. Both keep every §9 rule (neither touches odds; the seed curve still only grows: rule 4's "softcap bends it down, never up").

**Lever 1: a softcap that tightens per colony** (D146's named lever). New data field, e.g. `retirement.seedSoftcap.perColony` = factor applied from colony 2: `seeds_c = seeds × perColony^(c-1)` (or `exponent_c`; try both shapes). Code: `seedTotal` / `seedCoins` take the colony number (they are module-level and used by `migrateSave`, so pass it in; no new state, `state.colony` exists). Also try a lower colony-1 `seeds` (60–80) for B2; D146 only tried higher caps.

**Lever 2: a gentler Colony Pride** (data only): `perLevel` 0.5 → 0.25–0.35, or `growthRate` 1.6 → 2.0–2.4. Pride stays the whisker sink (no max).

**Watch:** whiskers come from seeds earned this colony (`whiskersFor`), so fewer seeds = fewer whiskers. If migration 2 drops below ~25, retune `colony.whiskerDivisor`, not the curve.

Variants to run (each `--data variant.json --migrate --lives 34 --seeds 3`, idle and active; ~8 min each, run in background, in parallel):
1. perColony 0.5 (seeds 100 → 50 → 25)
2. exponent per colony 0.2 → 0.15 → 0.1
3. Pride 0.3/level
4. Pride growth 2.2
5. best of 1–2 combined with best of 3–4
6. B2: colony-1 seeds 70 on top of the pick

**Targets** (proposed; confirm with the user):
- Colony 1 unchanged through gen 8; gens 9–13 ≥ 7 min idle, ≥ 4 active.
- Each new colony's early game still clearly faster than the last (the migration's reward): colony 2 gens 1–5 ≤ 60% of colony 1's.
- No life under 4 min idle / 2.5 min active in colonies 2–3 past gen 3.
- Colony 2 lasts ≥ 2.5 h idle (now 2.1); colony 3 not shorter than ~70% of colony 2.
- Whole tree / migration 1 time unchanged (5.0–5.8 h idle).

## Ask first (one `ask_decision` card each, before editing data)

1. **Which lever:** softcap per colony (late lives longer, early colony speed kept) · weaker Pride (every colony slower) · both. Recommend: softcap per colony, plus Pride only if colony 3 still runs away.
2. **Save in progress:** a colony-2+ save's pending seeds shrink under a new curve (held seeds never change). Accept it (recommended: pending only, the life just runs a bit longer), or bump `SAVE_VERSION` 15 and rescale `colonyCoins` like the v13 → v14 step (D146).
3. **The targets above.**

## Steps

1. Branch. Re-run the baseline; save outputs to a scratch dir.
2. (If lever 1) add the field to `RetirementDef` (types.ts), colony-aware `seedTotal`/`seedCoins`, a data.json `schemaVersion` bump only if the loader needs it; tests: the curve only grows per colony, colony 1 identical, `migrateSave` v13 → v14 still gives the same pending seeds (fixtures).
3. Run the variants; pick with the user against the targets.
4. Apply the pick. `npm test`; `npm run build`. Golden run: re-record with `node tools/golden.mjs --confirm` only once the user approves the change, on Node 24, and say so in the commit.
5. B3: `--casino --migrate`; if late lives are still cut > 25%, try `casino.chipsPerRetirement` 250 → 150 or Golden Hour 0.5 → 0.35 (ask first).
6. Docs in the same commit: PORTING_NOTES Balance log (old → new, why, sim before/after) + Playtest notes (tables) + a Decision (next free D-number); DESIGN §10 and §29 → Balance (and §13 if the curve text changes); CHANGELOG `[Unreleased]` in players' words ("later colonies' last lives last longer"); AGENTS.md Current status → open balance issues.

## Sim additions (small, do first if useful)

- A per-colony summary at the end: hours per colony, shortest life past gen 3, median life gens 9–15. Today it has to be read off 34 lines.
- `--colonies N`: stop after N migrations instead of guessing `--lives`.
- Optional (B5): an `--away` mode that closes the game for N hours between sessions, so offline upgrades get valued.

## Interactions

- **M12 "Your own casino"** (docs/updates/, PR #5): this pass changes no machine RTP or pay table, so M12's separate guest payout rate is unaffected. M12 unlocks "far into the game": re-measure its unlock time with the sim after this lands.
- **UI redesign parts 4–9**: view only, no conflict. If the Colony tab is restyled first, any new number (per-colony softcap) still shows through existing previews.
- **Casino boosts and the wardrobe** multiply income, so re-check B3/B4 numbers after B1.
