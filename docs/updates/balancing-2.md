# Balancing, round 2 (plan)

> **Status: planned, don't build until asked.** Balance direction is an ask-first change (AGENTS.md): show the user the "Ask first" card before touching data.json. Best **after the user's playtest** of 1.7.1 (`playtest-fixes.md`): whether colony 3 *feels* too fast is their call, the sim only measures it. Ships as a patch (1.7.x) or with the next minor; the user picks (D138). Round 1 and every variant it tried: [balancing.md](balancing.md) (D163).

Goal: the issues round 1 left open, without touching colony 1's first 8 lives (D93), colony 2's new 3–5 h (D163) or any balance rule (DESIGN §9).

## Read only these

- [balancing.md](balancing.md) → "B1 + B2: what the variants showed" (why the seed curve can't fix it; the lever is the climb between lives).
- DESIGN §9 (rules), §29 → Colony perks + Balance, §27 → Balance.
- PORTING_NOTES: D163, Balance log tail.
- Code: `getTreeCost`, `whiskersFor` (game.ts); data.json `familyTree.costPerColony`, `colony.whiskerDivisor` / `whiskerExponent`, `colony.perks` (colonyPride), `casino.prizes`, `casino.chipsPerRetirement`.

## Baseline (measured 2026-10-03 on 1.7.1, Node 22)

`node tools/sim.mjs --migrate --lives 45 --seeds 3`, idle and `--player active`, each without and with `--casino` (the bot spends its chips on boosts). From the sim's `Colony N:` summary lines; ranges over seeds. Colony 3 doesn't finish in 45 lives. Re-run before starting.

| | idle | idle + casino | active | active + casino |
|---|---|---|---|---|
| Colony 1, hours | 5.5–5.9 | 4.4–5.4 | 3.4–3.6 | 3.0–3.6 |
| Colony 1, median life gens 9–15 (min) | 9.1–10.6 | 8.0–11.1 | 5.7–8.9 | **3.3–7.1** |
| Colony 2, hours | 4.0–5.0 | 3.4–4.0 | 3.1–5.0 | 2.7–2.9 |
| Colony 2, median gens 9–15 | 6.5–6.8 | 4.2–8.6 | 5.2–6.2 | **3.6–4.7** |
| Colony 2, shortest past gen 3 | 4.3–5.2 | 2.5–4.4 | 2.1–4.1 | 2.5–3.0 |
| Whiskers at migration 2 | 63–72 | 57–68 | 64–72 | 61–68 |
| **Colony 3, median gens 9–15** | **4.6–5.7** | **3.9–4.4** | **3.1–4.6** | **2.3–4.3** |
| **Colony 3, shortest past gen 3** | **2.4–3.9** | **1.8–2.9** | **2.3** | **1.2–1.6** |

Reading: colony 2 now meets round 1's targets without the casino. Colony 3 misses them (lives under 4 min idle, ~2 min active). **The casino boosts still cut late lives by up to ~40% for an active player** (colony 1's median 5.7–8.9 → 3.3–7.1), so C3 is real, not a maybe.

## Issues, ranked

| # | Issue | Evidence | Plan |
|---|---|---|---|
| **C1** | Colony 3's middle lives 2–5 min (more whiskers from the longer colony 2 → more Pride) | baseline | **Main work** |
| C2 | Colony 1 gens 9–10 dip (6–9 min idle) before the softcap starts (round 1's B2, not tried) | balancing.md baseline | Try in the same pass |
| **C3** | Casino boosts cut active players' late lives by up to ~40% on 1.7.1 | `--casino` columns above | Data trim (ask first); over round 1's 25% line |
| C4 | Offline upgrades the sim never values (Night Shift, Cosy Nest; round 1's B5) | §28 | Sim addition `--away` first, then judge |

## Levers for C1 (from round 1's finding)

Only how fast the family's power climbs between lives sets a life's length. For colony 3 the climb comes from Pride bought with colony 2's whiskers. Variants to run (`--migrate --colonies 3 --seeds 3`, idle and active, each as `--data variant.json`):
1. **A gentler whisker formula:** `colony.whiskerExponent` 0.5 → 0.4 or 0.45 (fewer whiskers from a long colony; colony 2's own length unchanged, since whiskers are paid at its end).
2. **Pride's price grows faster** (its `growthRate` 1.6 → 1.8 or 2.0), so the 2nd migration's whiskers buy fewer levels.
3. **Tree ×3 → ×3.5 per migration** (`costPerColony`): colony 2's traits ×3 → ×3.5 (+17%), colony 3's ×9 → ×12.25 (+36%), so it stretches colony 3 more. Watch colony 2 stays shorter than colony 1 (the migration's reward; round 1 rejected ×4 for that).
4. C2 on top of the pick: `retirement.seedSoftcap.seeds` 100 → 70.

**Targets** (round 1's, still proposed): no life under 4 min idle / 2.5 active past gen 3 in colonies 2–3; colony 3 not shorter than ~70% of colony 2; colony 1 and colony 2's hours unchanged (±10%).

## Ask first (one `ask_decision` card)

1. **Colony 3:** leave it fast (a quick replay; the Wise Elders automate it) / a gentler whisker formula (rec. once the variants agree: it touches only later colonies) / pricier Pride / a dearer tree.
2. **Casino boosts:** leave (the casino is a choice) / trim Golden Hour or chips per retirement (rec.: the baseline shows up to ~40% shorter lives).

## Steps

1. Branch. Re-run the baseline above; save outputs in a scratch dir.
2. **Sim addition (C4):** `--away H` closes the game for H hours between sessions (offline earnings through `applyOfflineEarnings`, as the game does), so offline upgrades get bought and valued. Report life lengths with `--away 8` (a night) beside the plain runs.
3. Run the C1 variants; pick with the user against the targets.
4. Apply the pick in data.json. `npm test`; `npm run build`. Golden run: re-record (`node tools/golden.mjs --confirm`, Node 24) only after the user approves, said in the commit.
5. C3: `--casino` again on the pick; trim only with the user's OK (`chipsPerRetirement` 250 → 150 or Golden Hour +50% → +35%).
6. Docs in the same commit: PORTING_NOTES Balance log (old → new, why, sim before/after) + Playtest notes (tables) + a Decision; DESIGN §29 → Balance (and §27 if the casino changes); CHANGELOG `[Unreleased]` ("a third colony's lives last longer"); AGENTS.md Current status → open balance issues.

## Interactions

- **New colony content** (`content-machine-pack-2.md`, M12) adds income or whiskers in colonies 2–3: do this pass first, or re-run it after.
- **Pick a Pup / Lucky Visitors / Pouch Finds** (ideas) each add a little power per life; whichever ships, re-run the baseline.
