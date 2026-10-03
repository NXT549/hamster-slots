# Balancing pass (plan)

> **Status: B1 built (2026-10-03, D161): each colony's tree ×3, Colony Pride +30%. Open: colony 3's middle lives, B2–B6.** Earlier status: planned, don't build until asked. Balance direction is an ask-first change (AGENTS.md): show the user the decisions in "Ask first" before touching data.json. Ships as its own update after 1.6.x; the user picks version and name (D138).

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

## B1 + B2: what the variants showed (2026-10-03)

Measured with `--migrate --lives 36 --seeds 3`, idle (`/tmp` variant files, not kept). "Short" = colony 2 life past gen 3.

| Variant | Colony 2 hours | Colony 2 gens 9–15 (median) | Colony 3 | Verdict |
|---|---|---|---|---|
| Baseline | 1.8–2.1 | 2.8–4.4 min | 2–5 min lives | the problem |
| Softcap seeds ×0.5 / ×0.25 per colony | 1.9–2.5 | 4.5–5.8 | — | weak |
| Softcap exponent ×0.75 / ×0.7 / ×0.65 per colony | 2.2–19 | 4–8 | 1–4 min | short lives stay; **a wall** at the colony's end (lives jump to the 120 min cap); ×0.5–0.6 never finishes |
| Seeds cost ×2 / ×3 / ×5 more coins per colony (`seedDivisor`) | 1.7–2.3 | 3.0–5.3 | 1.5–5.6 | **no effect** |
| Colony Pride +30%/level, or price growth 2.0 | 2.2–2.5 | 4–5.3 | 2–3.5 | weak |
| **Family Tree ×2 / ×3 dearer per colony** | 2.3–3.0 / **3.0–4.6** | 2.8–5.5 / **4.8–6.1** | 3–7 min | **best**; colony 2's gens 1–12 last 5–20 min at ×3. Colony 3 still fast (+60–74 whiskers → more Pride) |

**Why the seed curve can't fix it:** a player (and the bot, and the Wise Elders) retires when pending seeds reach a share of the seeds earned. That's a *relative* goal, so any multiplier on coins or on the divisor cancels out; only how fast the family's power climbs from one life to the next sets a life's length. Colony 2 climbs ~10× a life because the tree is replanted quickly with lots of seeds, and Pride stacks on top. Only the curve's exponent changes that, and it turns into a wall once the tree needs seeds the curve won't give.

**So the lever is the climb, not the curve:** a dearer tree per colony (new optional `familyTree.costPerColony`, cost × k^colony after rule 3's formula; tested as a 3-line patch in `getTreeCost`, not committed), plus something for colony 3+: a gentler Pride (it compounds with the extra whiskers a longer colony pays) or a whisker formula that grows slower. The sim summary (`Colony N:` lines, `--colonies N`) is in tools/sim.mjs.

Next variants once the user picks a direction: tree ×3 + Pride 0.3/level; tree ×3 + Pride growth 2.0; tree ×2.5 + Pride 0.35; each idle and active, `--lives 45` to see colony 3 finish. B2 (colony 1 gens 9–10): try `seedSoftcap.seeds` 70 on top.

**Targets** (proposed; confirm with the user):
- Colony 1 unchanged through gen 8; gens 9–13 ≥ 7 min idle, ≥ 4 active.
- Each new colony's early game still clearly faster than the last (the migration's reward): colony 2 gens 1–5 ≤ 60% of colony 1's.
- No life under 4 min idle / 2.5 min active in colonies 2–3 past gen 3.
- Colony 2 lasts ≥ 2.5 h idle (now 2.1); colony 3 not shorter than ~70% of colony 2.
- Whole tree / migration 1 time unchanged (5.0–5.8 h idle).

## Ask first (one `ask_decision` card each, before editing data)

1. **Which direction:** a dearer tree per colony + gentler Pride (recommended: the only lever that worked) · accept fast later colonies as a quick replay the Wise Elders automate · a gentler seed curve per colony (longer last lives, but a wall).
2. **Save in progress:** with a dearer tree, a colony-2+ save's next traits cost more (planted ones stay). No save change needed. (A curve change would instead shrink pending seeds and need `SAVE_VERSION` 15 like D146's v13 → v14 step.)
3. **The targets above.**

## Steps

1. Branch. Re-run the baseline; save outputs to a scratch dir.
2. Add `costPerColony` to the family tree's type (types.ts) and `getTreeCost`; the Big Cage shows `getTreeCost`, so the view follows. Tests: colony 1 costs unchanged; colony c costs = floor(rule-3 cost × k^c); the Wise Elders and the sim's planter still plant (they read `getTreeCost`). Check rule 3's wording in AGENTS/DESIGN still holds (one formula, × a colony factor) and say so in the Decision.
3. Run the variants; pick with the user against the targets.
4. Apply the pick. `npm test`; `npm run build`. Golden run: re-record with `node tools/golden.mjs --confirm` only once the user approves the change, on Node 24, and say so in the commit.
5. B3: `--casino --migrate`; if late lives are still cut > 25%, try `casino.chipsPerRetirement` 250 → 150 or Golden Hour 0.5 → 0.35 (ask first).
6. Docs in the same commit: PORTING_NOTES Balance log (old → new, why, sim before/after) + Playtest notes (tables) + a Decision (next free D-number); DESIGN §10 and §29 → Balance (and §13 if the curve text changes); CHANGELOG `[Unreleased]` in players' words ("later colonies' last lives last longer"); AGENTS.md Current status → open balance issues.

## Sim additions (small, do first if useful)

- Done (2026-10-03): a per-colony summary at the end (hours per colony, shortest life past gen 3, median life gens 9–15) and `--colonies N`. A colony that walls makes `--colonies` run for hours: use `--lives` for risky variants.
- Optional (B5): an `--away` mode that closes the game for N hours between sessions, so offline upgrades get valued.

## Interactions

- **M12 "Your own casino"** (docs/updates/, PR #5): this pass changes no machine RTP or pay table, so M12's separate guest payout rate is unaffected. M12 unlocks "far into the game": re-measure its unlock time with the sim after this lands.
- **UI redesign parts 4–9**: view only, no conflict. If the Colony tab is restyled first, any new number (per-colony softcap) still shows through existing previews.
- **Casino boosts and the wardrobe** multiply income, so re-check B3/B4 numbers after B1.
