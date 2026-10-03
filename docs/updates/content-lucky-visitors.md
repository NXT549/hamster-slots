# Content idea: Lucky Visitors

> **Idea, not approved.** A new system: describe the plan to the user and get their picks before building (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Knock Knock"** (minor update).

## Pitch
Now and then a little visitor shows up at the cage: a sparrow at the window with a seed, a mouse with a crumb, a ladybird on the wheel. Tap it before it leaves for a small surprise. Idle games' "golden cookie": a reason to glance at the screen without punishing anyone who doesn't.

## What players get
- 4–6 visitors, each with one reward kind: a coin burst (N seconds of current income), a short timed boost (reuse casino boost effects: `payoutMultiplier`, spin speed), a free spin, a Hamster Token (rare), a delivery finished early.
- A visitor stays ~10 s, then leaves. Missing one costs nothing.
- Diary stickers ("Tap 1 / 25 / 100 visitors"), a stat in Menu → Stats.
- An upgrade or tree trait later: visitors come more often (data only once the effect exists).

## Rules to keep
- Rule 1: the logic decides when a visitor comes (game rng, a timer in the tick) and what it gives; the view only draws it and calls `game.tapVisitor(id)`.
- Rule 2: every chance, interval, duration and reward size in a new `visitors` block in data.json.
- Rule 4: visitors pay outside spins, so RTP and spin EV are untouched. A coin burst counts as earned coins (it feeds seeds), so size it from income, not lifetime, and check the seed pace in the sim.
- No visitors while the tab is hidden or offline (offline earnings don't include them), during the Big Cage, or in a gamble/bonus.
- Motion "Less": the visitor still appears, without the flight path.

## Plan
1. **Logic:** `visitors` state (`next` timer, `current` {id, left}), `tapVisitor()`, events `visitorArrived`, `visitorLeft`, `visitorTapped`. Rewards call existing helpers (boost timers from casino.ts, `addCoins`).
2. **Data:** `visitors: { minSeconds, maxSeconds, staySeconds, kinds: [{ id, name, weight, reward }] }`.
3. **Save:** only the timer matters; keep the visitor out of the save (a fresh one after load). If a stat or sticker is added: `SAVE_VERSION` bump, migration, fixtures.
4. **View:** sprites (16 or 24 px, style guide), a painted path across the cage (`cage.ts` layout), a tap target ≥ 44 px, a small toast for the reward, `.less-motion` rule.
5. **Sim:** add `--visitors` (active players tap every one, idle players none) and report the change to first retirement.
6. **Tests:** visitors never come while paused/hidden/in the Big Cage; reward sizes match data; a timed-out visitor gives nothing; golden run untouched unless sessions tap.
7. **Docs:** DESIGN new section, CHANGELOG, a Decision, Balance log with sim numbers.

## Questions for the user
- Rewards: coins only, or coins + boosts + tokens?
- How often: every ~2–5 min, or rarer and bigger?
- Should an upgrade make them come more often?
