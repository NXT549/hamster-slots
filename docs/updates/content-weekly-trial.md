# Content idea: Trial of the Week

> **Idea, not approved.** Builds on Colony Trials (DESIGN §29); a save change: plan it with the user first (AGENTS.md → Ask first). Read only when told to work on this update. Working name: **"Weekly Challenge"** (minor update).

## Pitch
Every week one **special trial** is on the Big Cage's trial picker: two of the five twists at once ("Tired Paws + Small Pockets"), or a twist plus a fixed machine. Beat it for a one-off reward and a stamp on a **trial card**; your best time is kept. No server: the week number picks the trial, so every player gets the same one that week.

## What players get
- A sixth row on the trial picker, *This week*, with its two twists, its reward and your best time.
- Rewards: Golden Whiskers (like a trial, a bit more) the first time each week; a stamp per week on a 12-stamp card, and a skin or hat for a full card (missing weeks never resets it).
- Stickers: "Beat 1 / 5 / 12 weekly trials".

## Rules to keep
- **Rule 1:** the logic never reads the date: the view passes a **week number** (from `platform.now()`) in, as Daily Treats would (`content-daily-treats.md`); tests pass any week.
- **Rule 2:** the list of combinations, rewards and the card in `colony.weekly` in data.json; the week picks from the list by number, so it repeats in a long cycle.
- **Rule 4:** twists only take things away (they're the existing five rules), so every machine's RTP and the delivery rules hold as tested; check two twists at once can always be finished (a test plays each combination to its goal with the sim's bot).
- Unlocks with Colony Trials (`colony.trialsFrom`), so it's late game.

## Plan
1. **Logic:** trials take a list of rules instead of one (`rule` → `rules`, the old field still read); `setWeek(week)`; the weekly trial's goal and reward like other trials; `weekly: { week, best: {week: seconds}, stamps }` in state.
2. **Data:** `colony.weekly: { combos: [{ rules: [...], goalShare, whiskers }], card: { stamps, reward } }`.
3. **Save:** `SAVE_VERSION` bump, migration, old-save test, fixtures.
4. **View:** the picker's sixth row (the `segmented` gains it, or a card above), the stamp card on the Colony sub-tab.
5. **Tests:** same week → same trial; a week change mid-trial keeps the running one; every combination finishable; rewards once a week.
6. **Docs:** DESIGN §29 (Colony Trials), CHANGELOG, Decision (week from the view, no server, the clock can be changed: fine for a single-player game).

## Questions for the user
- Weekly, or a new one every day?
- Reward: whiskers, tokens, or a cosmetic only?
