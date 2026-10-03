# Content idea: Daily Treats and Errands

> **Idea, not approved.** A new system: plan it with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Treat Jar"** (minor update).

## Pitch
A treat jar on the shelf fills once a real day: open it for a small gift. Next to it, three **errands** for the day ("land 30 wins", "do 2 deliveries", "spin the Snack Stacker 50 times") that pay Hamster Tokens. A reason to come back each day, never a punishment for missing one.

## What players get
- **Daily treat:** tokens or a timed boost, a slightly better gift on a 7-day calendar. Missing a day **never resets** the calendar (cute, not naggy); it just waits.
- **3 errands a day**, picked from a pool by the logic, scaled to what the player owns (no "spin the Big Cheese" before you have it). Reroll one per day for free.
- Stickers for errands done (10 / 50 / 200).

## Rules to keep
- Rule 1: the logic never reads the date. The view/platform passes a **day number** (`platform.now()` → local day) into `game.newDay(day)`; tests pass any day they like.
- Rule 2: the pool, goals, rewards and calendar in a `daily` block in data.json.
- Tokens stay cosmetic-only currency (DESIGN §6): errands pay tokens and boosts, never seeds or coins large enough to change the seed pace.
- Errand goals reuse the diary's goal types (`{ type: "stat", stat, target }`) counted from the day's start, so no new counters are needed where a stat exists.
- Changing the device clock only skips ahead; fine for a single-player game with fake coins (say so in the Decision).

## Plan
1. **Logic:** `daily` state {day, calendarStep, treatOpened, errands: [{id, start, done}], rerolled}; `newDay(day)`, `openTreat()`, `rerollErrand(i)`; events `dailyReset`, `errandDone`, `treatOpened`. Errand picks use the game rng seeded by day so a reload doesn't change them.
2. **Data:** `daily: { calendar: [...7 rewards], errandsPerDay, pool: [{ id, text, goal, tokens, requires }] }`.
3. **Platform:** a `today()` helper in the view (local midnight); called at boot and on page show.
4. **Save:** new `daily` block → `SAVE_VERSION` bump, `migrateSave` step (starts at calendar 0), old-save test, `node tools/golden.mjs --fixtures`.
5. **View:** the jar on the room shelf (painted, `CAGE_TOKENS`), a small errands card (kit `card` + `gauge`), a dot on the jar when something's ready.
6. **Tests:** no reset inside a day; a skipped day keeps the calendar; errands never ask for unowned machines; progress counts only from the day's start; reload keeps the same errands.
7. **Docs:** DESIGN section, CHANGELOG, a Decision (date from the view, no streak loss), the store-rule note in DESIGN §11 (daily rewards are fine; no real money).

## Questions for the user
- Errands for tokens only, or also chips/boosts?
- Keep the 7-day calendar, or one flat daily gift?
