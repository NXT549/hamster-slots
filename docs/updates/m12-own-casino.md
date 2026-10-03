# M12: Your own casino (late game)

**Status:** next on the roadmap. **A new system: design it with the user before any code** (AGENTS → Ask first, rule 8). **Version:** next minor, with a name. **Read:** DESIGN §11 row 12 and the M6 wishlist line ("late game you can eventually start your own casino"), §27 (the Hamster Casino: chips, exact returns), §29 (colonies, Golden Whiskers, the Wise Elders), §9 (balance rules), §10 (open late-game issues); PORTING_NOTES D88, D146.

## What the roadmap says

The family opens its own casino: put machines you own on the floor, hamster guests play them, you earn the house edge while idle; decor, staff, more rooms, a new late-game currency/layer. Unlocked far into the game.

## Conflicts to settle with the user first

- **"House edge" vs rule 4.** Every machine's RTP is > 100% for the player, so a guest playing *your* machines would beat the house. The casino's earnings need their own number: guest RTP from data.json (e.g. 92–96%, like real pokies), shown on screen, never touching the player's own odds.
- **What it pays and whether it counts as earned.** If it pays coins that count toward seeds, it is a new seed farm and shortens late lives (already an open issue, §10). Default proposal: a new currency (working name **Takings**) spent only in the casino layer, plus a small, capped bonus elsewhere; never counts as coins earned, like chips (rule 4).
- **Where it sits in the reset layers.** Kept through retirement? Through a migration? Default: unlocks after the first Great Migration, kept through retirements, reset (or partly kept) by a migration, so it is the colony's late game.
- **Store rules:** running a casino pushes the gambling look further (DESIGN §11). It must be removable from a build with one data flag, like `casino.enabled`.

## Questions for the user (ask with options, mark a recommendation)

1. Unlock: after the first migration (rec.) / a generation number / every machine owned.
2. What it pays: its own currency with its own shop (rec.) / coins / Golden Whiskers.
3. Depth: a small idle layer (floor slots, guests, decor) (rec.) / a full management game (staff, rooms, events).
4. Active or idle: mostly idle with offline earnings (rec.) / tapping guests, events.
5. Look: a new full-screen page like the Big Cage (rec.) / a sub-tab of the Casino tab.

## Proposed shape (once answered)

- **Logic:** `src/logic/owncasino.ts`, headless and pure like `casino.ts` (rule 1): floor slots, which machines are placed, guest arrivals per second, each guest's average bet and the casino's RTP → takings per second, all exact (expected values, not random per guest, so offline earnings use the same formula). game.ts only wires state, actions (`placeMachine`, `buyFloorUpgrade`), events and the tick.
- **Data:** a `ownCasino` block in data.json (unlock, floor slots, guest rates, RTP, upgrades with `baseCost`/`growthRate` per rule 3, decor), `enabled` flag. Schema version bump.
- **Save:** bump `SAVE_VERSION`, a `migrateSave` step, an old-save test, new fixtures (`node tools/golden.mjs --fixtures`).
- **View:** a page built from the kit (New Digs parts should be done or at least part 4, so it starts in the new look); a painted casino floor in `paint.ts` style with its own `*_TOKENS`.
- **Balance:** add the layer to `tools/sim.mjs` (`--owncasino`); report late lives before/after; new rule-4 tests (takings exact, never counted as earned, RTP of the player's machines unchanged).

## Build order (after the design is agreed)

1. Design in DESIGN (new section) + Decision; user OK. 2. Logic + data + tests. 3. Save + fixtures. 4. Sim + balance pass, numbers to the Balance log. 5. View. 6. Stickers, effects, sounds. 7. Stop for screenshots and the user's playtest.
