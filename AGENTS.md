# AGENTS.md — read this first

This is the entry point for **any AI agent** (Claude Code, Codex, Cursor, Copilot, …) working on `hamster_slots/`.
Read it fully before touching anything. `CLAUDE.md` in this folder just imports this file.

**Hamster Slots** is a cute pixel-art idle/clicker slot machine. A hamster on a wheel powers the machine. Spins cost coins, and when you run out, the hamster goes on **food deliveries** (timed, always pays), so you can never get stuck. All currency is fake in-game coins. **No real money, ever.**

**Web-first (since 2026-09-25):** the browser game *is* the game, and there's no engine port. One web codebase ships everywhere: GitHub Pages first (friends play from a link), then itch.io, then Steam (Electron or Tauri), and maybe mobile (Capacitor). See `PORTING_NOTES.md` (D106).

**Read order:** `AGENTS.md` (this file) → `DESIGN.md` (what the game is; the roadmap is §11) → `PORTING_NOTES.md` (platform plans, then the decision, balance and playtest logs). `CHANGELOG.md` says what players got in each version.

---

## Current status

> **Keep this block accurate.** Update it in the same commit as any change it describes.

- **Live: version 1.3.1 "Nuts & Bolts"** (2026-09-27) at **https://nxt549.github.io/hamster-slots/**. Every push to `main` tests, builds and deploys it (`.github/workflows/deploy.yml`, D118); the repo is **https://github.com/NXT549/hamster-slots** (public; the git remote `origin`). Separate numbers: the save format is `SAVE_VERSION` 12 (game.ts) and the data is `schemaVersion` 13 (data.json).
- **On the branch, waiting for the user's OK: 1.4.0-rc.1 "The Great Migration"** (DESIGN §29, D142–D145; the branch `claude/nice-hopper-r35bkf`): the user's "a new update to keep late game interesting like a mega rebirth… I just want the late game to remain interesting and fun", with their picks: **the Great Migration** (the whole tree planted → move to a new colony: the generation, seeds, tree and Machine Stars start again, for **Golden Whiskers**), **colony perks** (whiskers, kept for good), **Colony Trials** (a life with a twist, for whiskers), **the Wise Elders** (a perk that retires, plants and starts the next life for you), **Moving Day** (an 8th machine for migrated families, with **Moving Boxes** that all open into one symbol), **colony traits** (a 4th level on the tree), and **longer late lives** (a softcap on the seed curve; seeds now come from this colony's coins). Save v13, data schema 14. `package.json` says 1.4.0-rc.1 until the user OKs it; nothing of it is on `main` yet.
- **Newest release: 1.3.1 "Nuts & Bolts"** (DESIGN §28, D138–D141), released at the user's "Publish 1.3.1 now": the user's "a ton of new upgrades and improvements some gated behind rebirths… maybe some from achievements". 20 upgrades (3 for everyone, 6 **rebirth upgrades** a new generation unlocks, 11 **sticker upgrades** a diary sticker unlocks: `"unlock"` in data.json), 4 Family Tree traits (**Helping Paws**: the Hamster Helper buys cheap upgrades for you), 7 stickers, Lucky Pennies (a win can pay double), save v12. Built on the branch `claude/nifty-carson-bcaz1t` and merged into `main`.
- **Every update has a name** (the user's wish, 2026-09-27; Git and releases below): package.json `releaseName`, the CHANGELOG headings, the Menu.
- **Releases** (CHANGELOG.md): 0.1.0 "First Spin", the plain-JS prototype · 0.2.0 "New Foundations", M1–M7 on the web foundation · **1.0.0 "The Big Cage"**, the full release = M1–M8, polished (D123) · **1.1.0 "Machines & Hats"** = M9 + the seed jar + M10 + the phone paytable fix (D130) · **1.2.0 "A New Look"** = M15, the visual redesign (D134) · **1.3.0 "The Hamster Casino"** = M11 (D137) · **1.3.1 "Nuts & Bolts"** = 20 upgrades, rebirth and sticker unlocks, the Hamster Helper (D141). Tags: `v0.1.0`, `v0.2.0`, `v1.0.0` and `v1.3.0` are on GitHub (`v1.0.0` and `v1.3.0` as GitHub Releases the user published; `v1.3.0` is on `27b71d9`, the docs-only commit right after "Release 1.3.0", with the same game). **`v1.1.0` and `v1.2.0` exist only locally:** the sessions' git proxy cuts tag pushes off, so the user adds them (on `main`'s "Release 1.1.0" commit `7f2fe32` and "Release 1.2.0" commit `4fa56c3`) from a computer (`git tag -a` + `git push origin <tag>`) or as GitHub Releases. **`v1.3.1` too** (made locally on the "Release 1.3.1" commit `5d5bb4e`; the user publishes the GitHub Release "v1.3.1 · Nuts & Bolts" on it). 1.3.1 was checked on the live site after its deploy (Actions run 11).
- **Finished and live:**
  - **The web-first switch** (2026-09-25/26): npm + Vite, TypeScript for all of `src/`, Vitest + the golden run, the platform layer, break_eternity.js, the save backup, bundled fonts (PORTING_NOTES → Web migration, D110–D117), and GitHub Pages (D118).
  - **M1–M7** (DESIGN §11), ending with **M7 "Real pokies"** (§21) and **Pays Both Ways** (§3, D119, the user's first M7 feedback).
  - **M8 "The Big Cage"** (§22, D120–D122): held Heirloom Seeds, the Big Cage page, 7 new traits, Machine Stars.
  - **The 1.0 polish** (§23, D123–D124): celebrations, effects, the big moments between lives, icons, a crash screen, README.md.
  - **M9 "More machines"** (§24, D125–D128): the Hamster Maze (243 ways), the Acorn Vault (hold & spin), The Big Cheese (a multiplier wheel); save v10; and **the seed jar** (the user's pick for the short late lives: held seeds pay +1.5% each up to +100%, Family Fortune makes the jar bigger).
  - **M10 "Wardrobe buffs"** (§25, D129): every worn skin gives a gentle buff, 6 hats (+Luck), a twist on every Epic, one skin per slot.
  - **M15 "Visual redesign"** (§26, D131–D134), released in 1.2.0: still pixel art; **the whole game fits the window** (the tray beside the cage on wide screens, under it on phones; only the tray's tab scrolls); **small upgrade tiles** like the tree's, with a detail card on a tap; **the Family Tree only in the Big Cage**; the Big Cage as **a meadow with the family's pixel-art tree** (painted in code, `src/view/bigtree.ts`) that **grows with the family** (a sapling at first, only the traits you can plant show, every trait planted grows the trunk and a branch out to the traits it unlocks, D133); and **a new rebirth animation** (the hamster plants an Heirloom Seed, the tree grows; `src/view/bigcage.ts`). View only: no rules, balance or save changes.
  - **1.3.1 "Nuts & Bolts"** (§28, D138–D141): 20 upgrades (Lucky Pennies, Night Shift, the Cosy Nest; 6 rebirth upgrades; 11 sticker upgrades), 4 traits (Helping Paws = the Hamster Helper, Deep Roots, the Four-Leaf Heirloom, the Penny Jar), 7 stickers, locked upgrades folded in the shop, save v12, data schema 13; and every update has a name.
  - **M11 "Hamster Casino"** (§27, D135–D137), released in 1.3.0: the user's picks: **all four games** (Hamster Roulette, Blackjack, Seed Drop, the Hamster Derby), each with a **small house edge**; **chips earned by spinning and retiring, and bought with coins**; a **Prize Counter** with timed boosts, a Luck charm, Hamster Tokens and three casino-only skins. Chips only ever buy prizes (never coins). The logic is `src/logic/casino.ts` + one file per game, the view `src/view/casino.ts` (a Casino tab; on a phone the cage steps aside while it's open). Save v11, data schema 12.
- **Now:** waiting for the user's OK on 1.4.0-rc.1 (DESIGN §29's questions), and for playtest feedback on 1.1.0 (the user's friend, D130), 1.2.0 (D134), 1.3.0 (the casino, released at the user's "Publish 1.3" without a playtest first, D137) and 1.3.1 (the upgrades, released the same way, D141); the questions are in DESIGN §21–§29. Feedback goes in PORTING_NOTES → Playtest notes; fixes go out as 1.3.x (or 1.4.x after 1.4.0).
- **Still open:** on `main` (1.3.1) the late lives dip to 2–9 min around generations 12–15 (DESIGN §10); **1.4.0's seed softcap** makes them 2–3× longer (idle generations 11–13: 6.9–10.3 min), but **a migrated family's later colonies go much faster and their late lives are short again** (colony 2's generations 9–15: 2.5–8 min idle, 1.7–4 active; §29 → Balance, D144 has the levers); the wardrobe makes mid-game lives ~10–30% shorter (§25); casino boosts can take up to a third off the late lives if every chip goes into them (§27, `node tools/sim.mjs --casino`); 1.3.1's upgrades leave the total play time as it was but make the last lives shorter (generation 12: 2.4–3.5 min idle, from 3.7–9.6; §28 → Balance).
- **Next on the roadmap:** M12 Your own casino (DESIGN §11). It's a new system: plan it with the user first, and don't build it until they ask.
- **The code today:** everything in `src/` (logic, view, platform, boot) is **TypeScript** (strict). The tests and tools are JavaScript (typing them needs `@types/node`, a new dependency: ask first). Vite runs and builds it (`npm run dev`, `npm run build`, which type-checks first). Work since 0.2.0 was built on the branch `claude/serene-mayer-lgbgdp` (M15 and M11 on `claude/nice-hopper-r35bkf`) and merged into `main` at each release.
- **Tests now** (the 1.4.0 branch): `npm test` (Vitest) runs 2,474 tests in about 45 s: the logic checks (1,407: M7's 687 + 6 for save v8 + 56 for Pays Both Ways + 63 for M8 + 193 for M9 and the seed jar + 59 for M10 + 99 for M11's casino + 89 for 1.3.1 + 155 for 1.4.0: 107 in `colony.test.js`, the rest Moving Day's maths and data checks), 648 art checks, the Big Cage's tree (195: both trees, M15 and 1.4.0), the golden run (57), the save fixtures (54), the platform layer (27), money (57), save codes (25) and the release files (4).
- **Last verified:** each release's checks are in PORTING_NOTES → Playtest notes: 0.2.0 (2026-09-26: the golden run unchanged since 0.1.0, to the cent), Pays Both Ways, M8, 1.0.0-rc.1, M9, the seed jar, M10, M15, M11, 1.3.1-rc.1 (2026-09-27) and 1.4.0-rc.1 (2026-09-28): each with all tests and the build, the simulator before/after (for 1.4.0 also seven softcap variants and the migration loop), Chromium at 1280 and 390 px, and the built game too. 1.1.0 and 1.3.0 were checked on the live site after the deploy (it serves the new build and says the version; 1.3.0's page has the Casino tab).
- **Not yet verified:** how the M7, 1.0 and M9 sounds *sound* (tick, card, luck, unlock, softer auto clunks; the slam, the count-up, star, sprout, whoosh; M9's acorn and respin); the label on a natural jackpot-wheel trigger; a natural hold & spin Grand and a natural ×10 cheese wedge in the browser (only in the tests and from the console); the Epic twists in a real session (tested in the logic); the look in Firefox and Safari (for 1.0: the rays' `mask`, the line trace, the reel blur).

## Project docs

- **AGENTS.md:** how to work on the project (these rules).
- **DESIGN.md:** what the game is and where it's heading. The source of truth for design decisions.
- **PORTING_NOTES.md:** platform plans (web, Steam, mobile). Below them it also keeps the project's logs: **Decisions** (D-numbers), the **Balance log**, **Playtest notes** and the **Prototype history** (the old dev changelog).
- **CHANGELOG.md:** the player-facing record of changes.
- **README.md:** the public repository's front page (what the game is, the link to play, how to run it). Keep it true when the game's big picture changes.
- **Any change that affects what these docs say must update them in the same commit.** Docs must never go out of date.

| If you change… | Update… |
|---|---|
| Anything | **Current status** above, if it's no longer true |
| Something players will notice | `CHANGELOG.md` → `[Unreleased]`, in plain language for players |
| A number in a data file | `PORTING_NOTES.md` → Balance log (old → new, *why*, the simulator's before/after), and the DESIGN.md tables that show it (`npm run economy` prints fresh EV/RTP numbers). The game now plays differently on purpose, so re-record the golden run (`node tools/golden.mjs --confirm`) |
| A mechanic, symbol, upgrade or currency | `DESIGN.md` |
| Architecture, a file's role, an event, or a public game method | The **File map** / **Events** / **Game API** sections below |
| Platforms, the build, deploying, storage | `PORTING_NOTES.md` → the platform plan |
| Something felt good or bad in playtesting | `PORTING_NOTES.md` → Playtest notes |
| A choice between alternatives | `PORTING_NOTES.md` → Decisions (what you chose, what you rejected, why) |
| How we work | This file |

The hard rules keep their numbers (1–11), because the logs refer to them ("rule 3").

## Tech stack and architecture

- **TypeScript + Vite.**
- **Game logic and state live in their own modules with no DOM/UI code.** **Rule 1: logic never touches the DOM.** Logic modules (`src/logic/`: `rng.ts`, `events.ts`, `machine.ts`, `game.ts`) never use `document`, `window`, `localStorage`, `Date`, `performance` or `Math.random`, and they run headless in Node (tests, simulator). `tsconfig.logic.json` checks `src/logic` with no browser types at all, so `document`, `window` or `localStorage` there doesn't even compile. UI code reads `game.state` and listens to events. It never changes state directly: it calls actions (`game.spin()`, `game.buyUpgrade(id)`, …).
- **Platform-specific features (saving, storage, achievements) go through a small platform layer**, so the Steam and mobile versions can swap in their own implementations later (PORTING_NOTES → The platform layer). It's `src/platform/`: the `Platform` interface (`platform.ts`: storage, lifecycle, `now()`, achievements) and its web version (`web.ts`), which `main.ts` passes to `boot()`. `save.ts` and `autosave.ts` only use the interface, so they work on any platform. **Only `web.ts` touches `localStorage` and the page's hide/close events, and only `platform.now()` reads the real-world clock** (for offline earnings). A new platform = one more file like `web.ts`.
- **Use break_eternity.js for all currency and large numbers.** Every amount of money is a `Money` (`src/logic/money.ts`, D115): do maths with its methods (`a.add(b)`, `a.gte(b)`, `a.mul(x)`), and divide, raise to a power or round to cents with money.ts's `divide`, `power` and `roundMoney`, which give plain numbers' exact answers (Decimal's own `div`/`pow` drift by a cent, and the golden run would catch it). `+ - * < >` don't work on a Money, and TypeScript doesn't flag `<`/`>` between two of them, or a Money used as true/false (always true, even 0): watch for those. Odds, weights, timers, levels and counts stay plain numbers.
- **Rule 2: all balance numbers (costs, payouts, rebirth formulas, slot odds) live in data files, not hardcoded.** Today that's `data.json`: symbols, weights, payouts, spin cost and duration, delivery, upgrade costs, growth rates, effect values. No magic numbers in code. Data files stay plain JSON (no comments, no trailing commas), because the game, the tests and the simulator all read them. They hold **no art or colours**.
- **Rule 5: the stack and its dependencies.** TypeScript + Vite; break_eternity.js at runtime; Vitest for tests; the two fonts from Fontsource (`@fontsource/pixelify-sans`, `@fontsource/nunito`: the user's OK, 2026-09-26). No UI framework. Ask the user before adding any other dependency.
- **Rule 11: art lives in the view.** Sprites are text grids in `src/view/art.ts`. Colours, fonts and sizes are theme tokens in `src/view/style.css` `:root`; `src/view/theme.ts` repaints the UI frame sprites in those token colours (so button colours still live in `:root`). What each skin looks like is in `src/view/skins.ts` (fur = palette colours, the rest = token overrides set on the stage); data.json only lists skin ids/names/rarities. Numbers always use `--font-num` (clean font). The pixel font is always weight 500 (in bold its C looks like an O). Highlights go *behind* symbols, never on top (a tint once made grey seeds look golden). Every framed element sets its own `--frame`/`--fw` (custom properties inherit: a paper tile inside the cardboard tray would otherwise turn to cardboard).
- **Where things are:** the files live in their layer folders (File map below). data.json is bundled into the build, and so are the fonts.

## Saves

- **Save files include a version number** (`saveVersion`; `SAVE_VERSION` in game.ts, 13 on the 1.4.0 branch (12 on `main`): M8 added Machine Stars and the Big Cage flag, M9 a hold & spin under way and four stats, M11 the casino (chips, boosts, a blackjack hand in play) and its stats, 1.3.1 the Hamster Helper's switch and two stats, 1.4.0 the colony (migrations, Golden Whiskers, perks, the colony's coins, a Colony Trial, the Wise Elders' settings) and six stats; its step keeps an old save's pending seeds exactly, D144). Since v8, money is saved as text (`"1234.56"`, `"1.5e400"`), because a plain number stops at 1.8e308; `moneyFrom` (money.ts) reads both that and older saves' plain numbers.
- **Rule 6: the save stores player state only** (never balance values), so a data change applies straight away to an existing save. The save format lives in the logic (`toSaveData` / `loadSaveData` / `migrateSave` in game.ts); the platform layer only moves text. Settings are stored apart from the save, so Reset keeps them.
- **Any change to the save format needs a migration function, so old saves never break** (bump `SAVE_VERSION`, add a step to `migrateSave`), **plus a test that loads an old-format save and checks it migrates correctly.**
- **Autosave** (every `autosaveSeconds`, and whenever the page is hidden or closed: `autosave.ts`), **plus export/import of the save as a text string:** Menu → Save backup (`src/platform/savecode.ts` makes and checks codes, `src/view/backup.ts` is the dialog; D116). A code is `HS1:` + the save's JSON in base64, so an old code loads through the save migrations like an old save. Loading one pays no offline earnings for the time since it was made.
- **Offline progress is calculated when the player returns** (`applyOfflineEarnings(seconds)`, DESIGN §15). The platform layer tells the logic how many seconds passed (`main.ts` for the time since the last visit, `autosave.ts` for a hidden tab); the logic never reads the clock.

## Adding content and features

- **New content** (upgrades, slot symbols, rebirth layers, etc.) **should be added through the data files wherever possible, following existing patterns.** A new upgrade of an existing effect type needs only data. A new effect type needs one small function in game.ts (D7), its fields in the `Effect` type (`src/logic/types.ts`), a preview in `STAT_FOR_EFFECT`, a label in shop.ts `effectFormats` and an icon in art.ts. **A rebirth or sticker upgrade needs only data too** (1.3.1): `"unlock": { "generation": 4 }` (on sale from the family's 4th hamster) or `{ "sticker": "onFire" }` (once that diary sticker is earned); the shop, the Diary and the announcements pick it up by themselves. **A colony machine or trait needs only data too** (1.4.0): `"colony": 1` on a machine or a Family Tree trait keeps it for a family that has migrated at least once (the shop shows a colony machine as a locked card before that; the Big Cage lays a colony tree out with its extra level); a colony perk is a `colony.perks` entry (priced by rule 3, in whiskers), a Colony Trial a `colony.trials` entry with one of the five twists (`rule`).
- **If a new feature needs a new system, describe the plan to the user before building it.**
- **Never change game design, balance direction or core mechanics without asking first.** If a request conflicts with DESIGN.md, point out the conflict and ask.
- **Rule 3: one cost formula for everything you buy** (coin upgrades AND Family Tree nodes): `cost = floor(baseCost × growthRate ^ owned)` (`costAtLevel()` in game.ts). Don't invent per-upgrade cost curves.
- **Rule 8: build one milestone at a time,** then stop so the user can test. Don't add roadmap features early.

## Balance changes

- **Use the simulation/balance scripts in `tools/` to compare pacing before and after any balance change.** `node tools/sim.mjs` plays the real logic (options under How to run). Try a variant without touching the real file with `--data variant.json`, and check both players (`--player active`) and enough lives (`--lives 12`).
- **Report the key before/after numbers in the summary** (e.g. time to the first retirement, the first life's length, when each machine arrives), and paste the tables into PORTING_NOTES → Playtest notes.
- **If the tools can't measure something needed, suggest an addition to them.**
- **Rule 4: the balance rules are tested and must keep holding** (DESIGN §9). Every machine's RTP is above 100% in every setup: every reel count, payline count, wild level, with and without Pays Both Ways, and **step of its symbol unlocks, locked symbols included**, counting its features; the bet never changes it. **Every symbol unlock raises the EV and lowers the hit rate** (in every setup, at no Luck and at max Luck). **Every Luck level raises both the hit rate and the EV.** The auto-spin interval is never shorter than the spin time + the rest. Delivery coins/s stays below auto-spin profit/s at Wheel Training level 1 (also with the whole Family Tree). One delivery covers a base spin on the free first machine. The card gamble is exactly fair (colour and suit) and never counts as earned. Free spins always end (the retrigger loop stays < 1, even with max Luck, every Bouncy Ball and the whole Family Tree, Ball Pit included). **Every feature's EV is exact** (machine.ts `spinExpectation`); keep it that way when you add one. **M11's casino:** every casino bet keeps a small house edge (94–99.5% back; each game's return is exact), chips never turn into coins or count as earned, and the rules above hold with every casino boost on (the Lucky Charm is Luck; Turbo Wheel keeps the rest floor; free spins still end with the charm on top). **1.3.1:** Lucky Pennies' double is exact (a paid spin's lines × (1 + chance), and without it the RNG runs exactly as before); every rule holds with the new upgrades (Ball Bearings, Running Shoes, Night Shift); **the bet stays at ×10 at most** (D80, D139). **1.4.0:** Moving Day's boxes keep the EV exact (the mix of every reveal: machine.ts `expectedValue`, tested against every line tried and sampled spins with the boxes opened as the game opens them), and its unlocks and Luck follow the rules like every machine's; colony perks never change the odds (only payouts, seeds, stars, starting machines); the seed curve only ever grows (the softcap bends it down past `seedSoftcap.seeds`, never up).

## Testing

- **Game logic has unit tests (Vitest).**
- **Run the tests and a build before every commit. Don't commit if either fails.**
- **Bug fixes should include a test that would have caught the bug.**
- **Rule 10:** `npm test` after any change to logic, data or sprites. Everything must stay passing. `npm run build` also type-checks (`npm run typecheck` on its own): a type error fails the build.
- **What the tests are** (all in `tests/`, run by `npm test`):
  - `tests/logic/*.test.js`: the logic checks, one file per area (machine maths, economy, family, capsules, machines, features, saves, determinism, data, Pays Both Ways, the Big Cage, M9's machines, M10's wardrobe, M11's casino, 1.3.1's new upgrades, 1.4.0's colony: `colony.test.js`, the Great Migration, perks, the seed softcap, Colony Trials, the Wise Elders, Moving Day, colony traits, save v13). **The helpers' `newGame` puts every rebirth and sticker upgrade on sale** (the debug `unlockAllUpgrades()`), so "every upgrade maxed" means every upgrade; `nutsbolts.test.js` checks the locks on plain `createGame` games. Planting needs the Big Cage since M8: tests plant with `plant(g, …ids)` (helpers.js: opens it with the debug `openBigCage()`, plants, takes the spare seeds back, leaves). They keep the old `check(name, condition)` style: `tests/check.js` turns each check into a Vitest test. Shared helpers are in `tests/logic/helpers.js`. New tests can use Vitest's `test`/`expect` directly.
  - `tests/art.test.js`: sprites, skins and theme tokens.
  - `tests/golden.test.js`: **the golden run**, the migration's safety net. Scripted sessions (`tests/golden/sessions.js`) play the real logic on fixed seeds and must reproduce `tests/golden/golden.json` exactly: every save, the RNG's position, event counts, coins paid. It was recorded from the plain-JS game (save v7) and re-recorded for Pays Both Ways (2026-09-27: only the `allMachines` session changed, because it buys every upgrade) and for M8 (2026-09-27: only the lives after planting changed; the sessions now leave the Big Cage after planting), and for M9 (2026-09-27: the saves gained the v10 fields and the old sessions play the same; the new `moreMachines` session plays the Maze, the Vault and the Big Cheese), the seed jar (the family and moreMachines sessions) and M10 (the family session: it opens capsules and wears skins), and for 1.3.1 (2026-09-27: the sessions buy the new upgrades and plant the new traits, so the Hamster Helper buys too), and for 1.4.0 (2026-09-28: the saves gained the v13 fields; the seed softcap changes the late sessions' seeds; the new `migration` session plants the whole tree, migrates, buys perks, plays a Colony Trial and Moving Day, and lets the Wise Elders retire a hamster). Saves are compared with their money as numbers and without their version (`comparable()`), so v7 and v8 recordings check the same thing, to the cent. **Never re-record it to make a failing test pass.** Only re-record (`node tools/golden.mjs --confirm`) for an intended, approved gameplay change (a balance change, a new feature), and say so in the commit message.
  - `tests/fixtures.test.js`: real saves (`tests/fixtures/save-v<version>-<name>.json`, one set per save version, kept for good). The current version's must load and save back unchanged; each older one must migrate to exactly the current file of the same name (v7 → v8: every amount becomes the same amount as text; v9 → v10: the saves gain the four M9 stats and `hold: null` on every machine). A new save version gets its set with `node tools/golden.mjs --fixtures` (it never touches the recording or overwrites a file); since v9 a new version's file is the previous version's file of the same name, loaded and saved again, so "migrates to exactly" holds even when the sessions now play differently (D122).
  - `tests/money.test.js`: big numbers (`src/logic/money.ts`): the same answers as plain numbers for everyday amounts (the cent-exact promise), big numbers past 1.8e308, reading money from a save, and how `formatCoins` writes it.
  - `tests/savecode.test.js`: save codes: made, checked (every problem a pasted code can have), loaded (stored straight away, no offline pay), old v7 codes through the migrations, UTF-8.
  - `tests/bigtree.test.js`: the Big Cage's tree (M15, `src/view/bigtree.ts`): at every scene size from a 320 px phone to a 1560 px screen, for the first colony's tree and a migrated family's (1.4.0: a 4th level of colony traits), every trait is inside the scene, sits on its limb right above the trait it needs, and never overlaps another; planting the whole tree trait by trait, it only ever grows and always reaches every trait that shows; every colour the tree painter reads is a `:root` token.
  - `tests/release.test.js`: the files a release needs: the icons exist at their sizes, the manifest and index.html point at them, the link card's picture is there, package.json's version is a real version (and matches package-lock.json), and **the update has a name** (package.json `releaseName`, in its CHANGELOG heading; every released version's heading has one).
  - `tests/platform.test.js`: the platform layer. Saving and loading, broken saves, full or blocked storage, settings, Reset keeping the settings, autosave and the pay for time away, all on the pretend platform (`src/platform/memory.ts`); and the web version on a fake browser.
- **The tests and tools are JavaScript** (`.test.js`, `.mjs`): typing them would need `@types/node`, a new dependency (ask first).

## Git and releases

- **Work on a branch for anything bigger than a small fix;** merge to `main` when it's working.
- **Commit after each working step** with a clear message.
- **`main` must always be playable**, because it deploys to players automatically.
- **Versioning:** patch (0.1.1) for fixes, minor (0.2.0) for new features/content, major (1.0.0) for the full public release. A release candidate waiting for the user's OK on a branch says so in package.json (`1.0.0-rc.1`). The user can pick the number: they asked for the upgrades update as **1.3.1** (new content, so by this rule it would be 1.4.0; D138).
- **Every update gets a name from what it's about** (the user's wish, 2026-09-27: "i want names for each update based on what the updates about"). A few words that say what's new, the way players would talk about it: "The Hamster Casino", "Nuts & Bolts" (the upgrades update). Pick it when the update's content is settled, and tell the user (they can rename it). It goes in:
  - `package.json` → `"releaseName"` (the Menu shows "1.3.1 “Nuts & Bolts”"; `main.ts` reads it);
  - the CHANGELOG heading: `## [1.3.1] - 2026-09-27 · Nuts & Bolts` (while it's a release candidate: `## [Unreleased] · 1.3.1 "Nuts & Bolts"`);
  - the GitHub Release's title (`v1.3.1 · Nuts & Bolts`), **Current status** above, DESIGN.md's section and roadmap row, and the release's decision in PORTING_NOTES.
  - `tests/release.test.js` checks that the name is set and in the CHANGELOG heading, and that every released version's heading has one.
  - A fix-only patch can keep its update's theme with a plain name ("Casino Fixes"); a bigger patch like 1.3.1 gets its own.

  | Version | Name | What it was about |
  |---|---|---|
  | 0.1.0 | First Spin | The first numbered version: the plain-JS prototype, M1–M7 |
  | 0.2.0 | New Foundations | TypeScript + Vite, save backup, big numbers |
  | 1.0.0 | The Big Cage | The full release: M1–M8, polished |
  | 1.1.0 | Machines & Hats | M9's three machines, the seed jar, M10's wardrobe buffs and hats |
  | 1.2.0 | A New Look | M15, the visual redesign and the growing tree |
  | 1.3.0 | The Hamster Casino | M11, the casino |
  | 1.3.1 | Nuts & Bolts | 20 new upgrades (rebirth and sticker upgrades), 4 traits, the Hamster Helper |
  | 1.4.0 | The Great Migration | The mega rebirth (a new colony, Golden Whiskers, perks), Colony Trials, the Wise Elders, Moving Day, longer late lives *(release candidate)* |
- **Every player-facing change gets a CHANGELOG.md entry** under `[Unreleased]`, written in plain language for players. A release moves those entries under the new version and its date (and sets the same version in `package.json` once that file exists).
- **Commit identity** (set in this repo's own git config): name `nxt`, email `94941422+NXT549@users.noreply.github.com` (GitHub's private address, so no personal email is published). Claude's commits add a `Co-Authored-By` line.
- **Deploying:** `.github/workflows/deploy.yml` runs `npm ci`, the tests and the build on every push to `main` and, only if all pass, puts `dist/` on GitHub Pages (a failed run deploys nothing; the site keeps the last good version). The repo is https://github.com/NXT549/hamster-slots (remote `origin`), the game is at https://nxt549.github.io/hamster-slots/; a run's result is on the repo's **Actions** tab. So work is committed on a branch and merged into `main` (and pushed) after the user's OK. Releases are tagged on `main` and the tags pushed (`v0.1.0`, `v0.2.0`, `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.3.0`, `v1.3.1`); when a session can't push tags (HTTP 403), the user publishes a GitHub Release with that tag on the release commit instead. The CHANGELOG's version links compare them on GitHub.

## When unsure

- **Ask rather than guess**, especially for anything touching design, balance, or saves.

## Code style

- **Rule 7: comment for a learner.** The user is learning. Add short comments that explain *why*, at key points. Don't comment every line.
- **Rule 9: prototype art.** Pixel sprites in `src/view/art.ts` follow the style guide at the top of that file (24/16/12 px, colour ramps, matching outlines, whole-number scales; 12×12 UI frames are 9-slice and must keep their edges uniform). The palette's letters are all used: new colours go on free digits/punctuation (the purple ramp uses `8 9 0 +`); M7's sprites (Wood Shaving, clover, horseshoe, seed packet, card back, four suits) reuse existing ramps. The cage itself (bars, base, tubes, machines, the WIN meter, the gamble card) is CSS. Particles (`src/view/fx.ts`) are whole-pixel squares in token colours, or sprites from art.ts drawn at a whole-number scale (1.0: coins, stars, seeds, hearts), and must stay off with Motion "Less". Every new animation needs its `.less-motion` rule in style.css. Spend effort on feel and clarity, not detail. The Big Cage's tree (M15) is too big for a sprite, so `src/view/bigtree.ts` paints it on a small canvas at a whole-number scale with the same rules (ramps, top-left light, an outline per part, token colours).

## How to run

- **Play:** double-click **`play.bat`**. It checks the tools are installed (`npm install`; the first time downloads them into `node_modules/`), then starts **Vite** (`npm run dev`) in its own window on `http://localhost:8765/` and opens the browser. Port 8765 is where the game has always run, so the player's save is still there (a browser keeps one save per address + port). Close the server window to stop. (Opening `index.html` directly shows a "use play.bat" message, because browsers won't run JS modules from `file://`.)
- **npm scripts** (from this folder): `npm run dev` (the same as play.bat, without opening a browser), `npm run typecheck` (TypeScript checks the code, strict), `npm run build` (type-checks, then builds the players' version → `dist/`, relative paths), `npm run preview` (serves `dist/` on port 4173 to try the build), `npm test` (Vitest), `npm run test:watch`, `npm run economy`, `npm run sim` (the simulator).
- **Editing data.json while `npm run dev` runs:** save the file and the running game swaps in the new numbers by itself, keeping your progress (Vite hot update → `game.setData`). The debug panel's **Reload data.json** does the same by hand; it's hidden in a built game, where data.json is bundled into the code.
- **Tests:** `npm test` runs every test once (about 30 s); `npm run test:watch` re-runs them as you edit; `npx vitest run tests/logic/family.test.js` runs one file. A failing check shows its name and details.
- **Economy tables:** `npm run economy` prints EV, RTP and hit rate of every machine setup, feature odds and more, for DESIGN.md's tables after a balance change.
- **Balance simulator:** `node tools/sim.mjs` (idle player, 5 seeds, 7 lives; about 20 s). Options: `--player active`, `--lives 12`, `--seeds 3`, `--minutes 120` (the longest a life may last), `--retire 0.5`, `--first-minutes 60`, `--bankroll 40`, `--plant 0.25` (at the Big Cage, plant a trait if it costs at most this share of the seeds held, or 1 seed; hold the rest), `--data other.json` (try a variant without touching data.json; relative or absolute path), `--no-capsules` (never open capsules: the game without M10's wardrobe buffs), `--casino` (M11: spend every casino chip it earns on boosts, never buy chips or play a table: the most the casino can speed a family up), `--no-helper` (1.3.1: keep the Hamster Helper switched off, so the bot does all the buying), `--migrate` (1.4.0: make the Great Migration as soon as the whole tree is planted, spend the whiskers on perks cheapest first (never the Wise Elders: the bot retires by itself) and play on in the new colony; `--lives` counts every life, and the report names each life's colony and generation and says when each migration came and what it paid), `--verbose` (every purchase, and every 10 minutes what the bot is saving up for), `--help`. It plays the real game logic and prints, per life: length, seeds, coins earned, time to each milestone (first buy, Family/Capsules tab, Wheel 1, each symbol unlock on Old Clunky, Third Reel, Wheel maxed, each machine, bet ×2/×10, Pays Both Ways on each machine, the first level of 1.3.1's new upgrades), income snapshots, Luck and hit rate at 10/30/60 min, feature rates, and (M8) the seeds held, heirloom bonus and Machine Stars after each life. It buys by "time to afford + time to pay back" (D100); just before retiring it spends its coins finishing machines and rebuilds them for stars; it opens a capsule whenever it has the tokens and wears its rarest skin in every slot (M10), and reports the skins found.
- **Debug panel:** press **`` ` ``** (backtick) in the game, or Menu → Toggle debug panel. Always there with `npm run dev` (and play.bat); in a built game (`npm run preview`, the public site) only with **`?debug`** in the address, e.g. `http://localhost:8768/?debug`. Without it there's no panel, no Menu button and no key.
- **Fonts** come with the game: `main.ts` imports Pixelify Sans 500 and Nunito 600–900 from the Fontsource packages, and the build copies the font files into `dist/assets/` (a browser only downloads the ones it needs, ~75 KB). Nothing loads from the internet, so it works offline.
- **Claude Code preview:** `hamster-slots` (Vite dev on port **8766**) is defined in `.claude/launch.json` in **this** folder (for sessions started here) and in the **parent** folder (sessions started there). This folder also has `hamster-slots-alt` (port **8767**), for when another session is already using 8766, and `hamster-slots-build` (`npm run preview` of `dist/` on port **8768**; run `npm run build` first). Different port = different browser storage, so test saves never touch the player's save.
- **Screenshots at high DPI:** the preview's screenshot can crop to the top-left of the page when the display is scaled (e.g. 150%). Shrinking the page for an overview works without changing the layout: `document.querySelector('.app').style.cssText = 'transform: scale(0.55); transform-origin: 0 0; margin: 0'` (remove it afterwards).
- **Background tab?** Browsers pause animation frames when the page isn't visible (this includes a *hidden* Claude Code preview pane: the game then stops). `hamster.ui.render()` in the console draws one frame by hand; to keep it running, drive it with `setInterval(() => { hamster.game.update(0.05 * hamster.clock.timeScale); hamster.ui.render(); }, 50)`.
- **Testing fast:**
  - **Retirement:** debug panel → **Earn +10K / +100K** (counts toward seeds, unlike "Add coins") and **+5 seeds**. **Capsules:** **+10 / +100 tokens**.
  - **M6 features:** debug panel → **+5 free spins** (Burrow Bonanza) and **Wheel: Mini/Minor/Major/Grand** (Pouch Palace, when it isn't spinning). In the console: `hamster.game.addCoins(1e9)` (or text for big numbers: `addCoins('1e400')`; money in the state is a Money, so `hamster.game.state.coins.toString()` shows it), `hamster.game.buyUpgrade('highRoller', 4)`, `hamster.game.setBet(4)`, `hamster.game.buyMachine('bonanza')`.
  - **The card gamble:** debug panel → **Offer a gamble (100)** (or `hamster.game.triggerGamble(100)`). Set `hamster.clock.timeScale = 0` **first** to freeze its 5 s countdown while you look (a real offer after a manual win runs out before a console command can freeze it).
  - **Unlocks and Luck:** `hamster.game.buyUpgrade('newSeeds', 2)`, `buyUpgrade('clover', Infinity)`, `buyUpgrade('horseshoe', Infinity)`.
  - **The Big Cage (M8):** retire (debug **Earn +100K**, then Family → Retire twice), or debug **Open the Big Cage** to plant without retiring; **Start [pup]'s life** closes it. In the console: `hamster.game.openBigCage()`, `hamster.game.leaveBigCage()`. **The rebirth animation (M15)** plays only after a real retirement (about 5 s; a tap on the meadow skips it); a reload or Open the Big Cage shows the grown tree. The tree lays itself out again when the window changes size: try the phone and desktop sizes. **The tree grows as you plant** (D133): a new family's is a sapling; to see it fully grown, in the Big Cage run `const g = hamster.game; g.addSeeds(5000); for (let k = 0; k < 12; k++) for (const n of g.data.familyTree.nodes) if (g.canBuyTreeNode(n.id)) g.buyTreeNode(n.id);` (Family Fortune has no max, so it soaks up the rest).
  - **Machine Stars:** `hamster.game.addCoins(1e7)`, then Upgrades → the machine's tab → Max on every tile (or `for (const u of hamster.game.getAvailableUpgrades().filter((x) => x.scope === 'machine')) hamster.game.buyUpgrade(u.id, Infinity)`), and the Rebuild card appears (two taps).
  - **Celebrations (1.0):** in the console, `hamster.ui.celebrate.start({ kind: 'jackpot', titles: ['BIG WIN!', 'HUGE WIN!', 'JACKPOT!'], amount: hamster.game.state.coins })` (kinds: `big`, `jackpot`, `grand`, `pot`, `free`, `star`; `icon: 'star'` and `sub: '…'` are optional). A real one: debug **Wheel: Grand** on the Pouch Palace, or retire / rebuild as below.
  - **M9's machines:** `hamster.game.addCoins('1e16')`, then `for (const id of ['stacker', 'bonanza', 'palace', 'maze', 'vault', 'cheese']) hamster.game.buyMachine(id)`. **Hold & spin:** on the Acorn Vault after one spin, debug **Hold & spin** (or `hamster.game.triggerHold(7)`; `triggerHold(14)` leaves one empty cell: a 27% chance of the Grand). **The cheese wheel** needs a line of five: on the Big Cheese, buy Lucky Rind and Bigger Board and speed time up (debug panel) until one lands.
  - **The Wardrobe (M10):** debug panel → **Every skin** (or `hamster.game.ownAllSkins()`), then Capsules → Wardrobe, or `hamster.game.equipSkin('hatCrown')` (ids in data.json `skins`). The hat shows on the hamster at once; the Wardrobe's top line adds up the buffs.
  - **The Hamster Casino (M11):** retire once (debug **Earn +100K**, Family → Retire twice, Start) and the Casino tab appears with 250 chips; debug **+1,000 chips** (or `hamster.game.addChips(1e4)`). In the console: `hamster.game.playRoulette([{ kind: 'number', pick: 17, amount: 10 }])`, `dealBlackjack(20)` then `hitBlackjack()` / `standBlackjack()` / `doubleBlackjack()`, `runDerby('wobbles', 10)`, `dropSeed(50)`, `buyPrize('goldenHour')`; `hamster.game.getCasinoOdds()` lists every bet's exact return. On a phone size the cage steps aside while the tab is open. `casino.enabled: false` in data.json leaves the casino out.
  - **1.3.1's upgrades:** debug panel → **Unlock every upgrade** (or `hamster.game.unlockAllUpgrades()`; until the page reloads) puts every rebirth and sticker upgrade on sale; without it they open for real by retiring (debug **Earn +100K**, retire) or earning their sticker (the Diary says which). **The Hamster Helper:** debug **Open the Big Cage**, **+5 seeds**, plant Family Pride, Family Fortune and Helping Paws, Start; the switch shows in Upgrades → Hamster, and it buys a level a second (speed time up to watch). **Lucky Pennies:** `hamster.game.buyUpgrade('luckyPennies', Infinity)` (10%; the Penny Jar trait adds 6%), then spin until a win pops "×2 DOUBLE!".
  - **The Great Migration (1.4.0):** debug panel → **Plant the whole tree** (opens the Big Cage and plants every trait this colony can grow to its max; the spare seeds are taken back), then the Big Cage's **The Great Migration** button (two taps; or **Migrate now**, or Family → Colony) plays the move. **+10 whiskers** for the perks (Family → Colony). **Colony Trials** open from a colony's 4th hamster: after a migration, in the console `hamster.game.state.generation = 4` in the Big Cage (or retire a few times), then pick one above Start. **The Wise Elders:** buy the perk, switch them on in Family → Colony, and debug **Earn +100K** a few times. **Moving Day:** after a migration, `hamster.game.addCoins('1e14'); hamster.game.buyMachine('moving')`, and spin until boxes land. In the console: `migrate()`, `buyPerk(id)`, `startTrial(id)` / `startTrial(null)`, `setAuto({ retire, share, plant })`, `addWhiskers(n)`, `canMigrate()`, `getPendingWhiskers()`, `getTreeProgress()`.
  - **Pays Both Ways:** `hamster.game.buyUpgrade('thirdReel')`, then `buyUpgrade('clunkyBothWays')` (the others: `stackerBothWays`, `bonanzaBothWays`, `palaceBothWays`). A win from the right says "from the right" in the win show.
  - **The win show on many lines:** buy the Stacker with its paylines and wild, then speed time up until a spin wins on 3+ lines and slow it back down (a spin every ~3 s at normal speed).
  - **A fresh game:** Menu → Reset (twice). Clearing localStorage from the console doesn't stick, because the game saves itself when the page unloads.
  - **Save backup:** Menu → Save backup. A save file's plain JSON can be pasted too, e.g. one of `tests/fixtures/` (old v7 ones load through the migrations). Loading restarts the page.
  - **Offline earnings:** debug panel → pretend you were away 10 min / 1 h / 10 h. **Sound:** Menu → Sound; `hamster.sound.ready` in the console says whether audio is on.
- **Icons:** `node tools/icons.mjs` redraws `public/icons/` from the hamster sprite (run it after changing the sprite). `public/social.png` (the link card's picture) is a 1200×630 screenshot of a BIG WIN.
- **Sprite gallery:** `http://localhost:8765/tools/sprites.html` shows every sprite big (`?only=seed,carrot&zoom=8` for close-ups).
- Requires Node.js with npm (the user has Node 24, npm 11). Python isn't needed any more. The tools (`sim.mjs`, `economy.mjs`, `golden.mjs`) run the `.ts` logic straight from Node 24, which strips the types itself: that's why imports name the `.ts` file.

## File map

> **File map, Events and Game API describe today's code.** The logic's types (`src/logic/types.ts`, `Game` in game.ts) are the exact reference; these sections are the readable overview.

```
hamster_slots/
├── AGENTS.md          ← you are here (read-first guide, kept live)
├── CLAUDE.md          ← just `@AGENTS.md`, so Claude Code loads this file every session
├── DESIGN.md          ← game design: loop, machine, symbols, upgrades, balance, roadmap
├── PORTING_NOTES.md   ← platform plans (web, itch.io, Steam, mobile) + decisions, balance log, playtest notes,
│                         prototype history
├── CHANGELOG.md       ← what players got in each version (Keep a Changelog, from 0.1.0)
├── README.md          ← the public repo's front page: what the game is, the link to play, how to run it
├── data.json          ← ALL balance data (read by the game, tests and simulator): betSteps, gamble, machines (+ paylines,
│                         wild/scatter/blank symbols, locked symbols, freeSpins, jackpot pots; M9: ways, holdSpin,
│                         wheel), upgrades (incl. luck, unlockSymbol, bothWays, extraRespins, wheelBonus; `requires` =
│                         upgrades needed first; 1.3.1: `unlock` = a generation or a diary sticker, and doubleWin,
│                         offlineTime, stickerPayout, starPayout), retirement (seeds, held
│                         bonus, the seed jar) + familyTree (7 branches since M8; 1.3.1: autoBuy, generationPayout), stars (Machine Stars), tokens, capsules, skins (+ what each does
│                         when worn, M10: `effects`; 5 categories with hats), diary; 1.4.0: `colony` (the Great Migration:
│                         whiskers' formula, perks, trials, the Wise Elders' choices), `retirement.seedSoftcap`, Moving Day
│                         (a machine's `colony` and `mystery`: the boxes), colony traits (`colony` on a tree node)
├── index.html         ← page skeleton (HUD, cage stage + bet box + card gamble panel + pots + WIN meter + hold & spin
│                         board + clover badge + the casino's boost tags and 1.4.0's trial badge, tray tabs and sub-tabs + the upgrade detail
│                         card, the Family tab (1.4.0: sub-tabs Family / Colony; the retire card and planted traits; the migration card,
│                         the perks, the Wise Elders' settings, the trials), the whiskers pill on the HUD, the Casino tab (M11: chips + bet, the four tables, the cashier and the Prize
│                         Counter), menu + settings + version line, save backup, the Big Cage page (M15: the meadow scene: its canvas, the
│                         traits layer, the hamster, the seed, a speech bubble; the numbers, the trait card, Start; 1.4.0: the Colony
│                         Trial picker, the Great Migration button and its banner),
│                         the particle canvas) + icons, manifest and link-card tags + file:// and no-JavaScript warnings
├── public/            ← copied into the build as it is: icons/ (the hamster, made by tools/icons.mjs), manifest.webmanifest
│                         (add to home screen), social.png (the link card's picture)
├── package.json       ← npm: the version and the update's name (`releaseName`: 1.4.0-rc.1 "The Great Migration"), scripts (dev, typecheck, build, preview, test, economy, sim) and packages (Vite, Vitest, TypeScript; in the game: break_eternity.js and the two Fontsource fonts)
├── tsconfig.json      ← TypeScript settings (strict; .ts imports; only erasable syntax, so Node can run it)
├── tsconfig.logic.json ← src/logic checked with no browser types (rule 1)
├── package-lock.json  ← the exact tool versions npm installed (committed, so every install matches)
├── vite.config.js     ← Vite settings (relative paths for any host, dev server on port 8765) + where Vitest finds tests
├── .github/workflows/deploy.yml ← GitHub Actions: on every push to main, test + build, then deploy dist/ to GitHub Pages
├── play.bat           ← double-click launcher (npm install if needed, then Vite on port 8765 + opens the browser)
├── .claude/launch.json ← Claude Code preview servers (dev on 8766 and 8767, the built dist/ on 8768)
├── .gitignore / .gitattributes ← what git skips (node_modules/, dist/); line endings stored as LF (.bat keeps CRLF)
├── node_modules/, dist/ ← made by npm install / npm run build; never committed
├── tests/             ← Vitest (npm test)
│   ├── check.js       ← check(name, condition) → one Vitest test (the old test style)
│   ├── logic/         ← helpers.js (+ plant()) + one .test.js per area of the game logic (bothways.test.js: Pays Both Ways;
│   │                     bigcage.test.js: M8's held seeds, the Big Cage, the new traits, Machine Stars; m9.test.js: ways
│   │                     scoring and maths vs brute force, hold & spin vs Monte Carlo, the cheese wheel, save v10;
│   │                     wardrobe.test.js: M10's skin buffs, hats, Epic twists, the rules with the best wardrobe;
│   │                     casino.test.js: M11's four games (their exact odds vs play), chips, prizes and boosts, save v11;
│   │                     nutsbolts.test.js: 1.3.1's locks (rebirth and sticker upgrades), every new upgrade and trait,
│   │                     Lucky Pennies vs play, the Hamster Helper, the new stickers, save v12;
│   │                     colony.test.js: 1.4.0's Great Migration, perks, the seed softcap, Colony Trials, the Wise Elders,
│   │                     Moving Day and its boxes, colony traits, save v13)
│   ├── art.test.js    ← sprites, skins, theme tokens
│   ├── golden.test.js ← the golden run: the game must play exactly as recorded
│   ├── golden/        ← sessions.js (the scripted players) + golden.json (the recording)
│   ├── fixtures.test.js ← real saves must load and save back unchanged
│   ├── fixtures/      ← real save files, one set per save version (v7 … v13): the old-format saves migrations are tested on
│   ├── savecode.test.js ← save codes (Menu → Save backup): make, check, load, old codes
│   ├── money.test.js  ← big numbers: exact for everyday amounts, past 1.8e308, from a save, on screen
│   ├── bigtree.test.js ← the Big Cage's tree (M15): every trait inside, above the one it needs, never overlapping, at 14 sizes;
│   │                     the tree only grows as you plant
│   ├── release.test.js ← the release files: icons at their sizes, the manifest, index.html's links, the version
│   └── platform.test.js ← the platform layer on a pretend platform (full/blocked storage, hide/show/close) + web.ts
├── tools/
│   ├── sim.mjs        ← the balance simulator: a bot plays the real logic (node tools/sim.mjs --help)
│   ├── economy.mjs    ← prints the economy tables for DESIGN.md (npm run economy)
│   ├── golden.mjs     ← records the golden run (only for approved gameplay changes: --confirm) + save fixtures (--fixtures;
│   │                     a new version's = the previous version's file migrated)
│   ├── icons.mjs      ← draws public/icons/ from the hamster sprite (a tiny PNG writer; node tools/icons.mjs)
│   └── sprites.html   ← sprite gallery (dev page): every sprite in src/view/art.ts, big
└── src/
    ├── main.ts        ← BOOT: boot(createWebPlatform()): the fonts, data.json (bundled; hot-applied in dev) → game → load save →
    │                    settings, theme, sound, debug + UI (+ the version) → offline earnings → frame loop + autosave;
    │                    the crash screen (a bug in the loop stops autosave and says so)
    ├── logic/         ← LOGIC: no DOM, no clock, runs headless in Node (rule 1)
    │   ├── types.ts   ← the shapes of data.json (GameData), the state/save (GameState) and every event (GameEvents)
    │   ├── money.ts   ← Money = a big number (break_eternity.js Decimal) + helpers that give plain numbers' exact answers
    │   │                (roundMoney, divide, power) and read money from a save (moneyFrom)
    │   ├── rng.ts     ← seedable RNG (mulberry32) + pickWeighted
    │   ├── events.ts  ← tiny event emitter (the UI, tests and simulator listen)
    │   ├── machine.ts ← pure rules: rollGrid (reels × rows), paylines, evaluate (one line, left to right, wilds:
    │   │                best of two readings; scatters and blanks never on a line), evaluateGrid (every line; also
    │   │                from the right with Pays Both Ways, a full line once: isFullLine), findSymbol,
    │   │                expectedValue (exact, with wilds and both ways; exact hit rate, fast on grids), scatter
    │   │                maths (freeSpinStats, jackpotStats) and spinExpectation; M9: evaluateWays (243 ways: any row,
    │   │                reel to reel; ways = the counts multiplied), waysExpected + the ways hit rate, holdSpinStats
    │   │                (hold & spin: the trigger, and every (acorns, respins left) state worked out exactly),
    │   │                wheelAverage (the cheese wheel); 1.4.0: Moving Day's boxes (mysteryOptions, withReveal, revealMystery:
    │   │                every box opens into one symbol; expectedValue mixes the reveals)
    │   ├── roulette.ts ← M11: Hamster Roulette (a real single-zero wheel: which pockets a bet covers, what it pays, its exact return)
    │   ├── blackjack.ts ← M11: blackjack's house rules (an endless deck, the dealer peeks and stands on 17, double down),
    │   │                the best play for a hand (the table's hint) and the exact return with perfect play
    │   ├── derby.ts   ← M11: the Hamster Derby (five racers: their chances and pays)
    │   ├── seeddrop.ts ← M11: Seed Drop (a seed bounces down rows of pegs into a bin: the bins' chances, the return)
    │   ├── casino.ts  ← M11: the Hamster Casino, plugged into game.ts (createCasino): chips (earned, bought; a chip's price
    │   │                follows the family's best earnings), the four games' actions, the Prize Counter, boosts and charms
    │   │                (their effects join effectsOfType, scope "boost"), the odds for the tables
    │   └── game.ts    ← createGame (its type: Game): state, actions, upgrades (+ ×10/Max), machines (buy/switch, per-machine upgrades), symbols
    │                    (locks → family shifts → wild → Luck), Luck (Hamster + Machine), bets (High Roller,
    │                    step-down), free spins, jackpot pots + wheel, the card gamble (SUITS), Hot Streak, the
    │                    queued click, hold & spin (decided when it starts, played by a timer, paid at the end) and the
    │                    cheese wheel (M9), deliveries, auto-spin (+ the rest floor), retirement + Family Tree, the Big
    │                    Cage (between lives; the only place to plant; time stands still), held-seed bonus, Machine
    │                    Stars (rebuild), effects from both lists (effectsOfType; free starting levels, starting
    │                    machines), Hamster Tokens + diary, Capsule Machine + skins (M10: worn skins' effects join
    │                    effectsOfType at level 1: the Wardrobe buffs), 60 Hz tick, save format + migrations; 1.4.0: the Great
    │                    Migration (migrate, Golden Whiskers, colony perks: scope "colony"), Colony Trials (trialRule: the five
    │                    twists), the Wise Elders (autoStep: retire, plant, leave), the seed softcap (seedTotal / seedCoins, also
    │                    used by the v12 → v13 save step), colony gating (machines, traits, rebirth upgrades, the casino)
    ├── platform/      ← PLATFORM: everything that depends on the device (PORTING_NOTES → The platform layer)
    │   ├── platform.ts ← the Platform interface: storage (text by name), lifecycle (onHide/onShow/onClose), now(),
    │   │                achievements
    │   ├── web.ts     ← the web version: the only file using localStorage and visibilitychange/pagehide
    │   ├── memory.ts  ← a pretend platform for the tests (fill up or block storage, move the clock, hide/show/close)
    │   ├── save.ts    ← the save + the settings (incl. sub-tabs) in and out of storage, never crashing; the Settings type
    │   ├── savecode.ts ← the save as a one-line code ("HS1:" + base64 JSON): make, check (5 problems), load + store
    │   └── autosave.ts ← saves on a timer and when the player goes away or closes the game; pays for a hidden tab's time
    └── view/          ← VIEW: draws the game and turns clicks and keys into game actions
        ├── style.css  ← the "hamster cage" look; THEME TOKENS in :root (colours, fonts, sizes; M15: the meadow and the tree's);
        │                the layout (M15: the page is the window's height, the tray beside the cage or under it; the tray and the
        │                cage are CSS size containers, so their contents lay out by their own width)
        ├── art.ts     ← pixel sprites as text grids + palette (+ per-draw palette overrides for fur); hats (M10:
        │                HATS, drawn into the hamster frames as "hamster.hatParty" …, hamsterSprite());
        │                symbol/machine/upgrade/tree node/capsule → sprite maps (1.3.1: pennies, jar, moon, nest, shoe, coupon,
        │                album, paw, roots icons); UI frames + bedding tile; spriteCanvas
        │                (a sprite at 1× on a canvas, for the sprite particles)
        ├── theme.ts   ← turns the UI frame sprites into CSS variables (9-slice borders), painted in token colours
        ├── skins.ts   ← what each skin looks like (fur colours, hats, cage theme tokens) + swatches, hatOf()
        ├── dom.ts     ← shared helpers: formatCoins (+ short/full numbers; 1.23e15 from a quadrillion up; plain numbers or Money), formatWhole (seeds, tokens), mix, setText, setHTML, replayClass
        │                (takes its class off when the animation ends), popText ("LV 3!" floating off an element),
        │                iconHTML, createSubTabs, formatSeconds/Duration/Wait
        ├── sound.ts   ← synthesized sound effects (Web Audio; M9: acorn, respin; 1.4.0: box, migrate), volume + mute
        ├── fx.ts      ← pixel particles on one canvas over the page: sparkles, confetti, fountains, dust, embers,
        │                motes, twinkles, rings (shockwaves), and sprite particles (spinning coins, stars, seeds,
        │                hearts: coinFountain, rain, spriteBurst) (capped at 400; none with Motion "Less"). bigcage.ts moves
        │                the canvas into the Big Cage dialog while it's open (a dialog sits above the page)
        ├── celebrate.ts ← the big moments (1.0): the celebration over the cage (dim, rays, a title that slams in and
        │                climbs BIG WIN! → HUGE WIN! → JACKPOT!, the count-up, coins; taps go through, D124) and the
        │                iris between lives (closes on the hamster when it retires, opens on the new pup)
        ├── reels.ts   ← scrolling reel strips (3 visible rows; real rows on grid machines) that stop one at a
        │                time, payline tags (or badges on many-line machines), winning cells + lines (a ways win
        │                lights its cells, no line), feature cells, anticipation, quick reels; 1.4.0: Moving Day's boxes land as
        │                boxes and open (onOpen) once the last reel stops
        ├── winshow.ts ← the win show: everything lit + the WIN meter counting up, then one line at a time with
        │                a label ("… · 6 ways", "… · cheese wheel ×5"), then the scatters; loops; a tap skips (view only, D92)
        ├── shop.ts    ← the Upgrades tab (sub-tabs Hamster / [machine] / Machines): machine cards with feature
        │                chips and Machine Stars, ×1/×10/Max (tap the active one for the next), small upgrade tiles (M15) + the
        │                detail card a tap opens ("ready in" hints there), the Rebuild card and buttons (two taps); 1.3.1: the
        │                locked rebirth/sticker upgrades folded under each list (lockText), the Hamster Helper's switch; 1.4.0: a
        │                colony machine as a locked card before the first migration; describeEffect
        │                (also used by the family tree)
        ├── bigtree.ts ← the Big Cage's tree (M15): treeLayout() (the levels: where the trunk, the limbs and every trait go, for
        │                any scene size; pure maths, tested), treeShape() (how big the tree is for the traits that show) +
        │                leafClumps() (its canopy), and drawTree() (paints the meadow and the tree at any size it has grown to, as
        │                pixel art on a small canvas; its colours are theme tokens, TREE_TOKENS)
        ├── bigcage.ts ← the Big Cage page (M8; a meadow scene since M15): the traits that show (planted or unlocked) on the tree
        │                (tap → the card → Plant), the tree growing towards its shape (after a plant too), the numbers and the seed
        │                jar, Start, the hamster's speech bubble, and the rebirth animation (the hamster walks in, digs, plants the
        │                seed, then the family's tree grows; a tap skips it); 1.4.0: the Great Migration button (two taps), the
        │                banner and whisker rain, the new colony's first seed (the animation again), the Colony Trial picker, the
        │                colony tree (its 4th level)
        ├── payouts.ts ← the Info tab (sub-tabs): paytable (scatter, blank and locked rows), payline diagrams,
        │                Features (Luck, unlocks and the real odds of every feature: ways, hold & spin, the cheese
        │                wheel too), recent wins (hold & spin, ways, wedges); 1.4.0: the Moving Box row and the Moving Boxes card
        ├── ui.ts      ← HUD (coins + seeds, tab title), cage stage (wheel + prize wheel, tube, machine per type,
        │                tags, bubble, bet box, pots, clover + streak badges, card gamble panel, delivery tube,
        │                fitRig (to the cage's width and height, M15), stars on the marquee + gold trim), tray tabs, Family tab
        │                (retire + the planted traits; the tree is only in the Big Cage, bigcage.ts), menu + settings, skins on the
        │                stage, capsule prop, win celebrations (WIN_FX → celebrate.ts + particles), reel clunks, dust and
        │                thumps, the little touches (hearts, the breathing and dozing hamster, Spin's glow, the night
        │                cage in free spins, the page opening), retire → iris → Big Cage (bigcage.ts) → new
        │                life, the hold & spin board (renderHold) and the cheese wheel on the prize wheel (M9; the
        │                celebration waits until it lands), icon-only machine tags past 4 machines, sounds,
        │                welcome-back + stats dialogs; 1.4.0: the whiskers pill, the trial badge, a retirement by the Wise Elders
        │                (no Big Cage: a word from the new pup), the new colony's hello
        ├── capsules.ts ← the Capsules tab (sub-tabs): machine card + reveal (rays in the rarity's colour; the skin's buff),
        │                Wardrobe (each skin's buff, the total worn: M10; "Casino prize" on the casino's skins), Hamster Diary
        │                (1.3.1: "Unlocks the upgrade …" under a sticker that opens one)
        ├── colony.ts  ← 1.4.0: the Family tab's Colony sub-tab: the Great Migration card (the tree's progress, the whiskers it
        │                would bring, two-tap Migrate), the colony perk tiles, the Wise Elders' settings, the trials beaten
        ├── casino.ts  ← the Casino tab (M11, sub-tabs): the chips (the counter waits for each game's show) and the bet (− / +);
        │                Roulette (the board, the wheel painted pixel by pixel on a canvas, the ball), Blackjack (cards, the dealer's
        │                reveal, the tip), the Derby (lanes, the race), Seed Drop (pegs, bins, seeds falling), the cashier and the
        │                Prize Counter; the boost tags on the cage
        ├── backup.ts  ← the Save backup dialog (Menu): your code + Copy, paste a code (checked as you paste), two-tap Load
        └── debug.ts   ← debug panel (dev, or ?debug in a built game): stats incl. Luck and feature odds, coins, free spins, jackpot wheel, hold &
                         spin (M9), every skin (M10), unlock every upgrade (1.3.1), plant the whole tree, +whiskers, migrate (1.4.0),
                         offer a gamble, time speed, reload data in dev)
```

## Events (emitted by `game.ts`, listened to with `game.on(name, fn)`)

The payload of every event is typed in `GameEvents` (`src/logic/types.ts`). Every amount of money in a payload (`coins`, `amount`, `cost`, `payout`, `won`, `stake`, `reward`, `seedsGained`, `tokens`, `refund` …) is a Money.

| Event | Payload | When |
|---|---|---|
| `spinStarted` | `{ machineId, result, source, cost, bet, free, mystery }` | A spin started (`source`: `"manual"` / `"auto"` / `"free"`). `result` is the grid: `result[reel][row]`, with Moving Day's boxes already opened; `mystery` (1.4.0) = `{ cells, symbol }`: the cells that were boxes and what they all became (null without boxes); `bet` = the bet it REALLY uses (after a step-down); `cost` is 0 for a free spin |
| `spinResolved` | `{ machineId, result, wins, payout, fullLine, tier, bet, free, streak, featureCells, doubled }` | The spin finished. `wins` = the winning lines `[{ line, symbolId, count, basePayout, fullLine, usedWild, fromRight, payout }]` (`fromRight`: read from the last reel, with Pays Both Ways; a line can win at both ends; M9: on a ways machine `line` is the symbol's index and a win adds `ways` and `cells`, and on the Big Cheese a full line adds `wheel`, its wedge, already in `basePayout` and `payout`); `payout` = their total with every multiplier (bet, free-spin ×2 or Hot Streak); `fullLine` = some line matched on every reel; `tier` = `none`/`win`/`nice`/`big`/`jackpot` (base payouts together, × the free-spin multiplier; never × the bet); `streak` = the machine's win streak now; `featureCells` = `[[reel, row]…]` of the scatters that started free spins or the jackpot wheel; `doubled` (1.3.1) = Lucky Pennies doubled this win (already in the payouts). After a switch, the old machine's last spin still resolves (with its own `machineId`) |
| `spinBlocked` | `{ reason, source, cost? }` | A spin was refused: `reason` is `"coins"` (with the ×1 cost), `"delivery"`, `"gamble"` (a gamble is under way), `"bonus"` (the jackpot wheel is turning, or a hold & spin is playing) or `"bigCage"` (between lives, M8) |
| `betChanged` | `{ machineId, index, bet }` | The chosen bet changed (`setBet`) |
| `freeSpinsStarted` | `{ machineId, count, retrigger, bet, left }` | Free spins were won (`retrigger` = during free spins; also the debug button) |
| `freeSpinsEnded` | `{ machineId, spins, won }` | The last free spin of a batch landed |
| `jackpotStarted` | `{ machineId, pot, duration, bet }` | The jackpot wheel started; `pot` is already decided (the wheel only animates to it) |
| `jackpotWon` | `{ machineId, pot, amount }` | The wheel stopped and paid the pot (it resets to its seed) |
| `holdStarted` | `{ machineId, cells, respins, bet, duration }` | Hold & spin started (M9, the Acorn Vault): `cells` = `[[reel, row]…]` of the acorns that started it; the whole bonus is already decided (`getHold()` shows it as it plays) |
| `holdEnded` | `{ machineId, amount, coins, full }` | Hold & spin finished and paid `amount`; `coins` = acorns on the board, `full` = the Grand |
| `gambleOffered` | `{ machineId, stake }` | A win you pulled yourself can be gambled (or the debug offer) |
| `gambleResolved` | `{ machineId, win, pick, card: { suit, color }, multiplier, stake, round, next }` | A card was drawn for a pick (`pick`: `red`/`black` or a suit; `multiplier` 2 or 4; `next` = the new stake after a win) |
| `gambleEnded` | `{ machineId, reason, won, rounds, started }` | `reason`: `collect`, `lose`, `max`, `spin`, `expired`, `switch`, `retire`; `won` = coins gained (negative after a loss) |
| `coinsChanged` | `{ coins, amount }` | Any coin change |
| `seedsChanged` | `{ seeds, amount }` | Heirloom Seeds changed (retire, plant, debug) |
| `upgradeBought` | `{ id, level, cost, count, helper }` | Upgrade levels were bought (`count` > 1 for ×10 / Max; `cost` is the total; `helper` = the Hamster Helper bought it, 1.3.1) |
| `upgradeUnlocked` | `{ id, reason }` | 1.3.1: a rebirth upgrade (`reason` `"generation"`, when a hamster retires) or a sticker upgrade (`"sticker"`) is on sale now. Not on load, nor for the debug unlock |
| `helperChanged` | `{ on }` | 1.3.1: the Hamster Helper was switched on or off |
| `machineBought` | `{ id, cost }` | A new machine was bought (a `machineSwitched` to it follows) |
| `machineSwitched` | `{ id, from }` | The hamster now runs machine `id` |
| `treeNodeBought` | `{ id, level, cost }` | A Family Tree node was planted (`cost` in seeds) |
| `retired` | `{ generation, seedsGained, oldName, newName, runEarned, auto }` | The hamster retired; `generation` is the NEW pup's. The Big Cage is now open (`state.bigCage`). `auto` (1.4.0) = the Wise Elders did it: they plant and leave the Big Cage at once (`bigCageLeft` follows) |
| `bigCageLeft` | `{ generation, name }` | The new pup's life started (`leaveBigCage`) |
| `machineRebuilt` | `{ id, stars }` | A maxed machine was rebuilt; `stars` = its stars now |
| `deliveryStarted` | `{ duration, reward, source }` | The hamster left (`source`: `"manual"` / `"auto"` from Self-Starter) |
| `deliveryFinished` | `{ reward }` | The hamster came back and was paid |
| `tokensChanged` | `{ tokens, amount, source }` | Hamster Tokens changed. `source`: `sticker`, `jackpot`, `delivery`, `retire`, `pull`, `refund`, `debug` |
| `stickerEarned` | `{ id, tokens }` | A Hamster Diary goal was reached (also fires on load for old saves) |
| `capsuleOpened` | `{ skinId, rarity, duplicate, refund, pity }` | A capsule was pulled; `pity` = it was the guaranteed one |
| `skinEquipped` | `{ id, category }` | A skin was put on |
| `offlineEarned` | `{ awaySeconds, seconds, coins }` | Coins were paid for time away (`seconds` = the part that counted, after the cap) |
| `chipsChanged` | `{ chips, amount, source }` | Casino chips changed (M11). `source`: `buy`, `spins`, `retire`, `bet`, `win`, `prize`, `debug` |
| `rouletteSpun` | `{ pocket, bets, staked, returned }` | A roulette spin (M11): the pocket is decided; `bets` = each bet with what it `returned` (stake included) |
| `blackjackChanged` | `{ hand }` | A blackjack hand was dealt or drew a card, or ended (`hand.outcome` set) |
| `blackjackEnded` | `{ outcome, bet, returned }` | A hand was paid: `blackjack`, `win`, `push`, `lose` or `bust` |
| `derbyRun` | `{ racer, winner, bet, returned }` | A race: the winner is decided (the view runs it) |
| `seedDropped` | `{ path, bin, multiplier, bet, returned }` | A Seed Drop: `path` = the bounces (0 left, 1 right), row by row |
| `prizeBought` | `{ id, cost }` | A prize was bought at the Prize Counter (`cost` in chips) |
| `boostEnded` | `{ id }` | A boost ran out of time, or a charm out of spins |
| `migrated` | `{ colony, whiskers, seedsEarned, generations }` | 1.4.0: the Great Migration: `colony` = the new colony's number (1 = the second), `whiskers` = Golden Whiskers it paid, `seedsEarned` = the seeds that paid them, `generations` = the old colony's last generation. The family is in the Big Cage (generation 1) |
| `perkBought` | `{ id, level, cost }` | 1.4.0: a colony perk was bought (`cost` in whiskers) |
| `trialStarted` | `{ id, goal }` | 1.4.0: this life is a Colony Trial (picked in the Big Cage); `goal` = the pending seeds that beat it |
| `trialCompleted` | `{ id, whiskers }` | 1.4.0: a trial's goal was reached: it paid `whiskers` and its twist is over |
| `trialEnded` | `{ id, completed }` | 1.4.0: a trial ended (beaten, given up in the Big Cage, or the hamster retired before the goal) |
| `autoChanged` | `{ retire, share, plant }` | 1.4.0: the Wise Elders' settings changed (`setAuto`) |
| `dataReloaded` | `{}` | `setData()` applied a new data.json |
| `stateLoaded` | `{}` | A save was loaded |

## Game API (`createGame(data, rng)` in `src/logic/game.ts`)

Every amount of money it gives back (coins, seeds, tokens, costs, payouts, pots, the payout multiplier, profit per spin/second) is a Money (`src/logic/money.ts`); odds, `rtp`, `ev` per ×1, levels and times are plain numbers. The debug helpers (`addCoins`, `addSeeds`, `addTokens`, `triggerGamble`) take a number or text.

- **Actions** (return `true`/`false`): `spin(source)` (a manual spin asked for mid-spin is queued, D82), `startDelivery(source)`, `buyUpgrade(id, count = 1)` (count 10, or `Infinity` for Max; a third argument `true` = the Hamster Helper is buying), `setHelper(on)` (1.3.1: only once Helping Paws is planted), `buyMachine(id)` (also switches to it), `switchMachine(id)`, `retire()` (opens the Big Cage), `leaveBigCage()` (starts the new life), `buyTreeNode(id)` (only in the Big Cage), `rebuild(id)` (a maxed machine → a Machine Star), `pullCapsule()`, `equipSkin(id)`, `setBet(index)`, `gamble(pick)` (`'red'`, `'black'`, `'hearts'`, `'diamonds'`, `'clubs'`, `'spades'`), `collectGamble()` (Take win), `applyOfflineEarnings(seconds)`. Plus debug `addCoins(n, asEarned = false)` (asEarned counts toward seeds), `addSeeds(n)`, `addTokens(n)`, `addFreeSpins(n)`, `triggerJackpot(potId)`, `triggerGamble(stake)` (offer the gamble now), `openBigCage()` (plant without retiring), `ownAllSkins()` (M10), `triggerHold(coins = 6)` (hold & spin now on a machine that has it, after a spin), `unlockAllUpgrades()` (1.3.1: every rebirth and sticker upgrade on sale, not saved), `addWhiskers(n)` (1.4.0), and `setData(data)` (hot reload).
- **Time:** `update(dt)` advances game time in fixed 1/60 s ticks (`TICK`).
- **Queries (the machine you're running, upgrades):** `getMachineData()`, `getSpinCost()`, `getSpinDuration()`, `getPayoutMultiplier()`, `getHeirloomBonus()`, `getFullLineMultiplier()`, `getAutoInterval(overrides?, machine?)` (null = off; never below spin time + rest), `getReelCount()`, `getRowCount()`, `getLineCount()`, `getPaylines()` (the active lines, row per reel), `getSymbols(overrides?, machine?)` (the weights the reels really use: locks, family shifts, wild, Luck), `getSymbolChance(id)`, `getLuck(overrides?, machine?)` → `{hamster, machine, total}`, `isSymbolLocked(id, overrides?, machine?)`, `getSymbolUnlock(id)` (the upgrade that opens it, or null), `getDeliveryDuration()`, `getDeliveryReward()`, `hasAutoDelivery()`, `hasBothWays()` (this machine pays both ways), `getStars(id?)`, `getStarMultiplier(machine?)` (its payouts × this), `canRebuild(id)`, `getPotSeedMultiplier()` (Golden Pouches), `getWays()` (M9: ways on a ways machine, 0 = paylines), `getHoldRespins()` (with Sticky Paws), `getWheelBonus()` / `getWheelAverage()` (Aged Cheese; the average wedge), `getHold()` → `{cells (Money each, 0 = empty), rows, full, total, landed, respinsLeft, played, respins, maxRespins, progress}` or null (the hold & spin board as far as it has played), `getAvailableUpgrades()` (the hamster's + this machine's), `getUpgradeLevel/Cost(id)`, `getUpgradeNeeds(id)` (names of the upgrades its `requires` still needs; it can't be bought until that's empty), `getUpgradeBulk(id, count)` → `{count, cost, affordable}` (the price even when it still needs something or is locked; `affordable` is false then), 1.3.1: `getUpgradeLock(id)` → `{generation?, sticker?}` (what a rebirth or sticker upgrade still waits for) or null, `isUpgradeUnlocked(id)`, `hasHelper()`, `getHelper()` → `{share, interval}` or null, `getDoubleChance()` (Lucky Pennies + the Penny Jar), `getStarPayout()` (what one Machine Star adds, with Star Polish), `getOfflineCap()` (seconds of time away that pay, with the Cosy Nest), `countStickers()`, `isMaxed(id)`, `canAfford(n)`, `canBuyUpgrade(id)`, `previewUpgrade(id, levels = 1)` → `{type, now, next}`, `getSpinProgress()` (0–1), `getDeliveryProgress()` (0–1), `getEconomy()` (EV, hit rate, RTP, lines, profit/s…), `getWinTier(basePayout)`, `getOfflineEarnings(seconds)` → `{seconds, coins}`.
- **Queries (machines):** `getMachineInfo(id)` → `{owned, active, spinning, cost, spinCost, bet, reels, maxReels, lines, maxLines, rows, luck, symbols: {unlocked, lockable}, features: {wild, wildNow, freeSpins, jackpot, bothWays, ways, holdSpin, wheel}, freeSpinsLeft, bonus, stars, maxStars, fullyUpgraded, canRebuild}` (works for machines you don't own yet), `getMachineCost(id)`, `ownsMachine(id)`, `canBuyMachine(id)`.
- **Queries (bets and features):** `getBetSteps()`, `getMaxBetIndex()`, `getBetIndex()`, `getBet()` (the chosen ×), `getBetCost(bet?)`, `getSpinBet()` (what the next paid spin really uses; null = not even ×1), `getFreeSpins()` → `{left, total, played, won, bet}` or null, `hasFreeSpins()`, `getJackpotPots()` → `[{id, name, base, value}]` (value = coins at your bet), `getBonusProgress()` (0–1 while the jackpot wheel turns, else null), `getStreakMultiplier()` (for the next win), `getMaxStreakMultiplier()`, `getFeatureOdds()` (wild chance, free spins, pots, Luck, the card gamble's `color`/`suit` chance and multiplier, streak, hit rate), `canGamble()`, `getGambleInfo()` → `{stake, rounds, maxRounds, won, started, canPick, timeLeft, colorWin, suitWin, history}` or null, `getCardHistory()` → the last cards `[{suit, color}]`, newest first (never saved). `getEconomy()` also returns `starMultiplier` (its `payoutMultiplier` includes the machine's stars), `lineEv`, `streakFactor`, `luck`, `freeSpins`, `jackpot`, `bet`, `betCost` and `extraSecondsPerSpin` (time the features add), and its `profitPerSpin` is at the chosen bet. `previewUpgrade()` for a Luck upgrade gives `{luck, hitRate}` values, for a symbol unlock `{open, hitRate, win}`, for Pays Both Ways `{on, hitRate, win}`. Exported from game.ts: `SUITS` (the deck), `CARD_COLORS`.
- **Queries (family):** `getPendingSeeds()`, `canRetire()` (not in the Big Cage), `getSeedProgress()` → `{earned, total, nextAt, progress}`, `getPupName(gen?)`, `getHeirloomBonus()` (the held seeds' bonus, up to the seed jar), `getHeirloomBonusFor(seeds, overrides?)` (what that many seeds would give), `getHeldSeedBonusPerSeed()` (+1.5%), `getSeedJar(overrides?)` (the jar: 1 = +100%, bigger with Family Fortune), `getSeedJarSeeds()` (seeds that fill it), `getTreeNodeDef(id)`, `getTreeLevel(id)`, `getTreeCost(id)`, `isTreeMaxed(id)`, `isTreeNodeUnlocked(id)`, `canBuyTreeNode(id)` (only in the Big Cage), `previewTreeNode(id)` (its `next` counts the seeds planting spends), `getStartingLevel(upgradeId)` (incl. M8's per-machine free levels).
- **The Great Migration (1.4.0):** actions `migrate()` (from the Big Cage, or from a life: its pending seeds count too; the family lands in the Big Cage at generation 1 of the new colony), `buyPerk(id)`, `startTrial(id)` (in the Big Cage, before the life starts; `startTrial(null)` = an ordinary life), `setAuto({ retire?, share?, plant? })` (the Wise Elders; `share` must be one of `colony.autoRetire.shares`); queries `canMigrate()`, `isTreeComplete()` (every trait this colony can grow at its max, Family Fortune once), `getTreeProgress()` → `{done, total}`, `getPendingWhiskers()`, `getMigrationSeeds()` (the seeds the whiskers are worked out from), `getWhiskerGain()` (Whisker Wisdom), `getSeedGain()` (Seed Sense), `getMaxStars()` (with Trailblazer and Starry Roots), `getPerkDef(id)`, `getPerkLevel(id)`, `getPerkCost(id)`, `isPerkMaxed(id)`, `canBuyPerk(id)`, `previewPerk(id)`, `trialsOpen()` (migrated, and the colony's `trialGeneration`-th hamster or later), `getTrialDef(id)`, `getTrialGoal(id?)`, `getTrialWhiskers(id)`, `canStartTrial(id)`, `hasAutoRetire()`, `getAutoShares()`, `getAutoRetireGoal()`, `isMachineOpen(id)` (a colony machine: migrated enough times). `getMachineInfo()` adds `open`, `colony` and `features.mystery`; `getSeedProgress()` counts this colony's coins. A preview ("now → next") ignores a Colony Trial's twist.
- **Queries (tokens, capsules, skins):** `getDiaryProgress(id)` → `{value, target, done}`, `getPullCost()`, `canPull()`, `getPityRemaining()`, `getCapsuleOdds()` → `[{id, name, chance, withPity, duplicateRefund}]`, `getSkinDef(id)`, `isSkinOwned(id)`, `getEquippedSkin(category)`. M10: `getWardrobe()` → `[{category, skinId, effects}]` (the worn skins that do something), `getOfflineMultiplier()`, `getJackpotTokens()`, `getDeliveryTokenEvery()`, `getCardHistoryLength()` (the Epic twists' numbers; since 1.3.1 some upgrades add to them too, and they take `overrides`).
- **State you'll read:** `state.coins`, `state.machines` (owned: `{typeId, upgrades, bet, spinning, spinTimer, spinBet, spinFree, spinSource, result, streak, freeSpins, pots, bonus, hold}`; `hold` (M9) = `{start, values, steps, respins, bet, timer, duration}` while hold & spin plays), `state.gamble` (never saved), `state.activeMachine` (index), `state.run` (this life), `state.generation`, `state.seeds` (held), `state.seedsEarned`, `state.tree`, `state.stars` (Machine Stars by machine type), `state.bigCage` (between lives), `state.helper` (1.3.1: the Hamster Helper's switch), `state.tokens`, `state.diary`, `state.skins` (`owned`, `equipped`), `state.capsules.sincePity`, `state.stats` (lifetime, incl. `coinsEarned`, `goldenJackpots`, `capsulesOpened`, `tokensEarned`, `machinesBought`, `mostLinesWon`, `biggestBet`, `freeSpins`, `freeSpinTriggers`, `freeSpinCoins`, `wildWins`, `bestStreak`, `jackpotsWon`, `grandJackpots`, `gambleWins`, `gambleLosses`, `bestGambleRun`, `symbolsUnlocked`, `bestLuck`, `suitWins`, `rebuilds`, `bestStars`, `mostSeedsHeld`, M9's `bestWays`, `holdBonuses`, `holdGrands`, `bestWheel`, and M11's `casinoGames`, `chipsBought`, `chipsEarned`, `biggestCasinoWin`, `rouletteNumbers`, `blackjacks`, `derbyLongshots`, `seedDropEdges`, `prizesBought`, and 1.3.1's `doubleWins`, `helperBuys`, and 1.4.0's `migrations`, `whiskersEarned`, `trialsCompleted`, `autoRetires`, `mysteryBoxes`, `bestBoxes`); 1.4.0: `state.colony` (migrations made), `state.colonyCoins` (the coins the seed formula reads), `state.whiskers`, `state.perks`, `state.trial` (the trial this life is, or null), `state.trialsDone` (this colony's), `state.auto` (`{retire, share, plant}`).
- **Saving:** `toSaveData()`, `loadSaveData(obj)`.
- **The Hamster Casino (M11, casino.ts):** actions `buyChips(count)`, `playRoulette([{kind, pick, amount}…])` (kinds: `red`, `black`, `odd`, `even`, `low`, `high`, `dozen` and `column` (pick 0–2), `number` (pick 0–36)), `dealBlackjack(bet)`, `hitBlackjack()`, `standBlackjack()`, `doubleBlackjack()`, `runDerby(racerId, bet)`, `dropSeed(bet)`, `buyPrize(id)`, debug `addChips(n)`; queries `isCasinoUnlocked()` (the family has retired once, or migrated: 1.4.0), `isCasinoOpen()` (and not in the Big Cage), `getChipPrice()` (coins per chip: `chipPriceSeconds` of the family's best earnings per second; a migration starts that best again), `getIncomePerSecond()` (the best machine at the biggest bet, without boosts), `getCasinoBetSteps()`, `canBetChips(amount)`, `canDouble()`, `getBlackjackHint()` (`stand`/`hit`/`double`, or null), `getPrize(id)`, `canBuyPrize(id)`, `getPrizeBlock(id)` (why not: `closed`, `chips`, `full`, `owned`, or null), `getBoosts()` → `[{id, name, kind, left, max}]` (seconds for a boost, paid spins for a charm), `getCasinoOdds()` (every bet's exact return and chance). A bet is a whole multiple of the smallest bet step, up to the biggest; every payout is then a whole number of chips. State: `state.casino` = `{chips, bestIncome, spinsToChip, boosts, hand}` (`hand` = `{bet, player, dealer, doubled, outcome, returned}`; kept when retiring).
- **Read-only:** `game.state`, `game.data`, `game.rng`. In the browser console: `hamster.game`, `hamster.clock.timeScale`, `hamster.ui.render()`, `hamster.ui.celebrate` (try a celebration), `hamster.sound`.
