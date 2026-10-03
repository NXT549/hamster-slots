# AGENTS.md — read this first

Entry point for **any AI agent** (Claude Code, Codex, Cursor, Copilot, …) working on `hamster_slots/`. Read it fully before touching anything. `CLAUDE.md` just imports this file.

**Hamster Slots** is a cute pixel-art idle/clicker slot machine. A hamster on a wheel powers the machine. Spins cost coins; when you run out, the hamster goes on **food deliveries** (timed, always pays), so you can never get stuck. All currency is fake in-game coins. **No real money, ever.**

**Web-first (since 2026-09-25):** the browser game *is* the game; no engine port. One web codebase ships everywhere: GitHub Pages first, then itch.io, then Steam (Electron or Tauri), maybe mobile (Capacitor). See `PORTING_NOTES.md` (D106).

**Read order:** `AGENTS.md` → `DESIGN.md` (what the game is; roadmap §11) → `PORTING_NOTES.md` (platform plans, then the decision, balance and playtest logs). `CHANGELOG.md` = what players got in each version. `docs/DEBUG.md` = console and debug-panel recipes for testing fast.

---

## Current status

> **Keep this block accurate.** Update it in the same commit as any change it describes.

- **Live: 1.6.0 "New Digs"** (2026-10-03) at **https://nxt549.github.io/hamster-slots/**. Every push to `main` tests, builds and deploys it (`.github/workflows/deploy.yml`, D118). Repo: **https://github.com/NXT549/hamster-slots** (public; remote `origin`). Save format `SAVE_VERSION` 14 (game.ts); data `schemaVersion` 14 (data.json).
- **Releases** (details in CHANGELOG.md; the "what it was about" table is under Git and releases): 0.1.0 · 0.2.0 · 1.0.0 · 1.1.0 · 1.2.0 · 1.3.0 · 1.3.1 · 1.3.2 · 1.4.0 · 1.5.0 · 1.6.0. Every update has a name (package.json `releaseName`, CHANGELOG headings, the Menu).
- **Tags:** `v0.1.0`, `v0.2.0`, `v1.0.0`, `v1.3.0`, `v1.3.1` are on GitHub. **`v1.1.0`, `v1.2.0`, `v1.3.2`, `v1.4.0`, `v1.5.0`, `v1.6.0` are not:** the sessions' git proxy cuts tag pushes off (HTTP 403), so the user adds them as GitHub Releases on `main`'s release commits ("Release 1.1.0" `7f2fe32`, "Release 1.2.0" `4fa56c3`, "Release 1.3.2" `1084cb6`, 1.4.0 on its docs-only deploy commit (same game as "Release 1.4.0" `76aec6d`, D149), "Release 1.5.0" `bb98c2d`, "Release 1.6.0" `6558459`), or from a computer (`git tag -a` + `git push origin <tag>`).
- **Newest, 1.6.0 "New Digs"** (DESIGN §31, D156–D160): parts 1–3 of the full UI redesign. The hamster's-room look (wood, paper, brass, enamel: `frames.ts`), the kit every screen is built from (`kit.ts`), the purse (`hud.ts`), the control deck (`deck.ts`), the phone's bottom tab bar, the detail sheet, a rebuilt Upgrades tab (`shop.ts`), nothing under 12 px, only the open tab drawn. **View only**: no rules, balance or save changes; the golden run is untouched.
- **Planned, not built: UI redesign parts 4–9** (Family, Capsules and Info, Casino, Menu and dialogs, the guide and UI sounds, polish; DESIGN §31, D156–D160). **Don't build them until the user asks**; then on a branch, part by part, each leaving the game playable. The user's picks: restyle + restructure, the hamster's room look, a first-time guide and UI sounds (two new settings `uiSounds`, `guide`; no save change).
- **Next on the roadmap:** M12 Your own casino (DESIGN §11). A new system: plan it with the user first; don't build until they ask.
- **Now:** waiting for playtest feedback on 1.1.0–1.6.0 (the user published 1.3.0–1.6.0 without a playtest; 1.6.0 not yet seen on a real phone, Firefox or Safari). Questions are in DESIGN §21–§31. Feedback goes in PORTING_NOTES → Playtest notes; fixes ship as 1.6.x.
- **Still open (balance):** late lives were short around generations 11–15 (DESIGN §10); 1.4.0's seed softcap made them 2–3× longer, but a migrated family's later colonies go fast and their late lives are short again (§29 → Balance, D146 has the levers); the wardrobe makes mid-game lives ~10–30% shorter (§25); casino boosts can take up to a third off late lives (§27, `node tools/sim.mjs --casino`).
- **Not yet verified:** how the M7/1.0/M9 sounds *sound*; a natural jackpot-wheel label, hold & spin Grand and ×10 cheese wedge in the browser (only tests/console); Epic twists in a real session; the look in Firefox and Safari (rays' `mask`, line trace, reel blur).
- **Code today:** everything in `src/` (logic, view, platform, boot) is strict **TypeScript**. Since 1.5.0 the view paints its big scenes as pixel art on small canvases (`paint.ts`, `cage.ts`, `wheel.ts`, `cabinet.ts`, `bigtree.ts`). Tests and tools are JavaScript (typing them needs `@types/node`: ask first). Releases were built on feature branches and merged into `main`.
- **Tests now:** `npm test` (Vitest), 2,937 tests, about a minute and a half. Each release's checks are logged in PORTING_NOTES → Playtest notes.

## Project docs

- **AGENTS.md:** how to work on the project. **DESIGN.md:** what the game is; the source of truth for design decisions. **PORTING_NOTES.md:** platform plans, then the logs: **Decisions** (D-numbers), **Balance log**, **Playtest notes**, **Prototype history**. **CHANGELOG.md:** the player-facing record. **README.md:** the public front page; keep it true. **docs/DEBUG.md:** debug recipes.
- **Any change that affects what these docs say must update them in the same commit.**

| If you change… | Update… |
|---|---|
| Anything | **Current status** above, if it's no longer true |
| Something players will notice | `CHANGELOG.md` → `[Unreleased]`, plain language for players |
| A number in a data file | PORTING_NOTES → Balance log (old → new, *why*, simulator before/after), and the DESIGN tables that show it (`npm run economy`). Re-record the golden run (`node tools/golden.mjs --confirm`) |
| A mechanic, symbol, upgrade or currency | `DESIGN.md` |
| Architecture, a file's role, an event, a public game method | The **File map** below (events and the game API live in `types.ts` / `game.ts`) |
| Platforms, the build, deploying, storage | PORTING_NOTES → the platform plan |
| Something felt good or bad in playtesting | PORTING_NOTES → Playtest notes |
| A choice between alternatives | PORTING_NOTES → Decisions (chosen, rejected, why) |
| How we work | This file |

The hard rules keep their numbers (1–11), because the logs refer to them ("rule 3").

## Tech stack and architecture

- **TypeScript + Vite.**
- **Rule 1: logic never touches the DOM.** `src/logic/` never uses `document`, `window`, `localStorage`, `Date`, `performance` or `Math.random`, and runs headless in Node (tests, simulator). `tsconfig.logic.json` checks it with no browser types. UI code reads `game.state`, listens to events and calls actions (`game.spin()`, `game.buyUpgrade(id)`, …); it never changes state directly.
- **Platform features (saving, storage, achievements) go through `src/platform/`:** the `Platform` interface (`platform.ts`) and its web version (`web.ts`), which `main.ts` passes to `boot()`. **Only `web.ts` touches `localStorage` and the page's hide/close events, and only `platform.now()` reads the real clock** (offline earnings). A new platform = one more file like `web.ts`.
- **Use break_eternity.js for all currency and large numbers.** Every amount of money is a `Money` (`src/logic/money.ts`, D115): use its methods (`a.add(b)`, `a.gte(b)`, `a.mul(x)`), and money.ts's `divide`, `power`, `roundMoney` for exact plain-number answers (Decimal's own `div`/`pow` drift by a cent; the golden run would catch it). `+ - * < >` don't work on a Money, and TypeScript doesn't flag `<`/`>` between two, or a Money used as a boolean (always true, even 0). Odds, weights, timers, levels and counts stay plain numbers.
- **Rule 2: all balance numbers live in data files, not code.** Today `data.json`. No magic numbers in code. Plain JSON (no comments, no trailing commas); no art or colours in it.
- **Rule 5: dependencies.** TypeScript + Vite; break_eternity.js at runtime; Vitest; the two Fontsource fonts (`@fontsource/pixelify-sans`, `@fontsource/nunito`). No UI framework. Ask before adding any other dependency.
- **Rule 11: art lives in the view.** Sprites are text grids in `src/view/art.ts`. What must fit any size (cage and room, wheel, cabinets, the Big Cage's tree) is painted in code on a small canvas, reading colours from theme tokens (each painter lists them: `CAGE_TOKENS`, `WHEEL_TOKENS`, `CABINET_TOKENS`, `TREE_TOKENS`, `FRAME_TOKENS`; tests check they're in `:root`), so skins keep working. Colours, fonts and sizes are tokens in the first `:root` block of `src/view/style.css`; the rules live in `src/view/styles/` (one file per part). `theme.ts` repaints the UI frame sprites in token colours; `frames.ts` paints the kit's wood, paper, brass and enamel frames into `--fr-*` variables (a frame's `--fw` is always its 4 px corner at a whole number: 4, 8, 12 or 16 px). Skins are in `skins.ts` (data.json only lists ids/names/rarities). Numbers use `--font-num`. The pixel font is always weight 500. Highlights go *behind* symbols, never on top. Every framed element sets its own `--frame`/`--fw` (custom properties inherit).

## Saves

- **Rule 6: the save stores player state only** (never balance values), so a data change applies straight away. The format lives in the logic (`toSaveData` / `loadSaveData` / `migrateSave` in game.ts); the platform only moves text. Settings are stored apart, so Reset keeps them.
- `saveVersion` is `SAVE_VERSION` in game.ts (14). **Any change to the save format needs a migration step (bump the version, add to `migrateSave`) plus a test that loads an old-format save and checks it migrates.** Money is saved as text (`"1234.56"`, `"1.5e400"`); `moneyFrom` reads that and older plain numbers.
- **Autosave** every `autosaveSeconds` and whenever the page is hidden or closed (`autosave.ts`); **export/import** as a text code: Menu → Save backup (`savecode.ts`, `backup.ts`). A code is `HS1:` + the save's JSON in base64 and loads through the migrations; loading pays no offline earnings.
- **Offline progress** is worked out on return (`applyOfflineEarnings(seconds)`, DESIGN §15). The platform tells the logic how many seconds passed; the logic never reads the clock.

## Adding content and features

- **New content goes through the data files wherever possible, following existing patterns.** A new upgrade of an existing effect type needs only data. A new effect type needs one small function in game.ts (D7), its fields in `Effect` (`types.ts`), a preview in `STAT_FOR_EFFECT`, a label in shop.ts `effectFormats` and an icon in art.ts. Rebirth/sticker upgrades are data only: `"unlock": { "generation": 4 }` or `{ "sticker": "onFire" }`. Colony machines/traits: `"colony": 1`; colony perks are `colony.perks` entries (priced by rule 3, in whiskers), Colony Trials `colony.trials` entries with one of the five twists (`rule`).
- **A new system: describe the plan to the user before building it.**
- **Never change game design, balance direction or core mechanics without asking.** If a request conflicts with DESIGN.md, point it out and ask.
- **Rule 3: one cost formula for everything you buy** (coin upgrades AND Family Tree nodes): `cost = floor(baseCost × growthRate ^ owned)` (`costAtLevel()`). No per-upgrade curves.
- **Rule 8: build one milestone at a time,** then stop so the user can test. Don't add roadmap features early.

## Balance changes

- **Compare pacing before and after any balance change** with `node tools/sim.mjs` (it plays the real logic). Try a variant with `--data variant.json`; check both players (`--player active`) and enough lives (`--lives 12`). Report key before/after numbers (time to the first retirement, first life's length, when each machine arrives) and paste the tables into PORTING_NOTES → Playtest notes. If the tools can't measure something, suggest an addition.
- **Rule 4: the balance rules are tested and must keep holding** (DESIGN §9):
  - Every machine's RTP is above 100% in every setup (reel count, paylines, wild level, with/without Pays Both Ways, every step of its symbol unlocks, features counted); the bet never changes it.
  - Every symbol unlock raises the EV and lowers the hit rate; every Luck level raises both hit rate and EV.
  - The auto-spin interval is never shorter than spin time + rest. Delivery coins/s stays below auto-spin profit/s at Wheel Training level 1 (also with the whole Family Tree). One delivery covers a base spin on the free first machine.
  - The card gamble is exactly fair and never counts as earned. Free spins always end (the retrigger loop stays < 1, even with max Luck, every Bouncy Ball and the whole tree).
  - **Every feature's EV is exact** (machine.ts `spinExpectation`); keep it that way for new features.
  - **Casino (M11):** every bet keeps a small house edge (94–99.5% back, each exact); chips never turn into coins or count as earned; the rules hold with every boost on.
  - **1.3.1:** Lucky Pennies' double is exact; the bet stays at ×10 at most (D80, D139). **1.3.2:** the pause toggle is a player choice; `getAutoInterval()` is the same paused or not. **1.4.0:** Moving Day's boxes keep the EV exact; colony perks never change the odds; the seed curve only ever grows (the softcap bends it down past `seedSoftcap.seeds`, never up).

## Testing

- **Run the tests and a build before every commit; don't commit if either fails.** Bug fixes include a test that would have caught the bug. **Rule 10:** `npm test` after any change to logic, data or sprites. `npm run build` also type-checks (`npm run typecheck`).
- **All tests live in `tests/`** (`npm test`; one file: `npx vitest run tests/logic/family.test.js`):
  - `tests/logic/*.test.js`: one file per area (machine maths, economy, family, capsules, machines, features, saves, determinism, data, bothways, bigcage, m9, wardrobe, casino, nutsbolts, autopause, colony). Helpers in `helpers.js`; **`newGame` puts every rebirth and sticker upgrade on sale** (`unlockAllUpgrades()`); planting needs the Big Cage, so use `plant(g, …ids)`. Old `check(name, condition)` style (`tests/check.js`); new tests can use Vitest directly.
  - `tests/art.test.js`: sprites (32/24/16/12 px, every letter a palette colour, 9-slice frames), skins, theme tokens, painters' tokens, the cage layout at five sizes.
  - **`tests/golden.test.js`: the golden run**, the safety net: scripted sessions (`tests/golden/sessions.js`) on fixed seeds must reproduce `tests/golden/golden.json` exactly (saves, RNG position, event counts, coins paid). **It must play the same on every Node:** `Math.pow` can differ in its last bit between Node 22 and 24, so sessions never feed the game an amount worked out with a power without rounding it first (`seedCoinsToAdd`); check a new recording on Node 24 (CI's) too. **Never re-record it to make a failing test pass.** Re-record (`node tools/golden.mjs --confirm`) only for an intended, approved gameplay change, and say so in the commit message.
  - `tests/fixtures.test.js`: real saves (`tests/fixtures/save-v<version>-<name>.json`, one set per version, kept for good). The current version's must load and save back unchanged; older ones must migrate to exactly the current file of the same name. A new save version gets its set with `node tools/golden.mjs --fixtures` (the previous version's file, loaded and saved again).
  - `money.test.js` (cent-exact maths, past 1.8e308, `formatCoins`), `savecode.test.js`, `platform.test.js` (on `memory.ts`'s pretend platform, and `web.ts` on a fake browser), `bigtree.test.js` (the tree at 14 sizes: every trait inside, above its parent, never overlapping, only grows), `release.test.js` (icons, manifest, version matches package-lock, **the update has a name** in package.json `releaseName` and the CHANGELOG heading).
  - `tests/kit.test.js` (1.6.0): frame tokens and 9-slice edges, `--fw` scales, one copy of the breakpoint, style.css imports every `styles/` file once, no class styled by two files, framed tints only on framed elements, **no `border-image: none` shorthand** (the minifier empties it: use `border-image-source: none`), layout.ts's rig maths, two-tap timing, `keyedList`, every sprite the page names exists. `tests/shop.test.js`: the Upgrades tab's pure helpers.
- **The tests and tools are JavaScript** (typing them needs `@types/node`: ask first).

## Git and releases

- **Branch for anything bigger than a small fix;** merge to `main` when it's working. **Commit after each working step.** **`main` must always be playable** (it deploys automatically).
- **Versioning:** patch for fixes, minor for new features/content, major for the full release. A release candidate on a branch says so in package.json (`1.0.0-rc.1`). The user can pick the number (1.3.1 was new content but they asked for it, D138).
- **Every update gets a name from what it's about** (the user's wish, 2026-09-27): a few words players would use. Pick it when the content is settled and tell the user (they can rename). It goes in package.json `"releaseName"`, the CHANGELOG heading (`## [1.3.1] - 2026-09-27 · Nuts & Bolts`; while a candidate: `## [Unreleased] · 1.3.1 "Nuts & Bolts"`), the GitHub Release title (`v1.3.1 · Nuts & Bolts`), Current status, DESIGN's section and roadmap row, and the release's decision in PORTING_NOTES. A fix-only patch can keep its update's theme ("Casino Fixes").

  | Version | Name | What it was about |
  |---|---|---|
  | 0.1.0 | First Spin | The plain-JS prototype, M1–M7 |
  | 0.2.0 | New Foundations | TypeScript + Vite, save backup, big numbers |
  | 1.0.0 | The Big Cage | The full release: M1–M8, polished |
  | 1.1.0 | Machines & Hats | M9's three machines, the seed jar, M10's wardrobe buffs |
  | 1.2.0 | A New Look | M15, the visual redesign and the growing tree |
  | 1.3.0 | The Hamster Casino | M11, the casino |
  | 1.3.1 | Nuts & Bolts | 20 new upgrades, 4 traits, the Hamster Helper |
  | 1.3.2 | Rest Stop | A pause button for auto-spin |
  | 1.4.0 | The Great Migration | The mega rebirth, Colony Trials, Wise Elders, Moving Day, longer late lives |
  | 1.5.0 | The Glow Up | Full visual redesign: painted room, cage and machines, new hamster |
  | 1.6.0 | New Digs | UI redesign parts 1–3: room look, purse, control deck, phone tab bar, Upgrades tab |
- **Every player-facing change gets a CHANGELOG entry** under `[Unreleased]`, in plain language. A release moves them under the version and date.
- **Commit identity** (repo git config): name `nxt`, email `94941422+NXT549@users.noreply.github.com`. Claude's commits add a `Co-Authored-By` line.
- **Deploying:** `deploy.yml` runs `npm ci`, tests and build on every push to `main` and only if all pass puts `dist/` on GitHub Pages (a failed run deploys nothing). Work goes on a branch and is merged to `main` after the user's OK. When a session can't push tags (HTTP 403), the user publishes a GitHub Release on the release commit instead.

## When unsure

- **Ask rather than guess**, especially for design, balance, or saves.

## Code style

- **Rule 7: comment for a learner.** The user is learning. Short comments that explain *why*, at key points; not every line.
- **Rule 9: prototype art.** Sprites in `art.ts` follow the style guide at the top of that file (32/24/16/12 px; the hamster and reel symbols are 32×32 with five-step ramps; matching outlines, whole-number scales; 12×12 UI frames are 9-slice with uniform edges). All palette letters are used: new colours go on free digits/punctuation. The cage, room, wheel and cabinets are painted (`paint.ts`: 2 screen pixels per painted pixel, light from the top-left, an outline per part, dithered, never smooth). Titles use `pixelfont.ts`. Particles (`fx.ts`) are whole-pixel squares in token colours or sprites at a whole-number scale and must stay off with Motion "Less"; **every new animation needs its `.less-motion` rule next to it** in the same `styles/` file. Spend effort on feel and clarity, not detail.

## How to run

- **Play:** double-click `play.bat` (installs if needed, starts Vite on `http://localhost:8765/`, opens the browser). Port 8765 keeps the player's save. `index.html` from `file://` shows a "use play.bat" message.
- **npm scripts:** `dev`, `typecheck`, `build` (type-checks, then → `dist/`), `preview` (port 4173), `test`, `test:watch`, `economy` (EV/RTP/hit-rate tables for DESIGN), `sim`.
- **data.json hot update:** with `npm run dev`, saving it swaps in the numbers keeping progress (the debug panel's **Reload data.json** does it by hand; hidden in a built game).
- **Balance simulator:** `node tools/sim.mjs` (idle player, 5 seeds, 7 lives, ~20 s). Options: `--player active`, `--lives N`, `--seeds N`, `--minutes N`, `--retire F`, `--first-minutes N`, `--bankroll N`, `--plant F`, `--data other.json`, `--no-capsules`, `--casino`, `--no-helper`, `--migrate`, `--verbose`, `--help`. It reports per life: length, seeds, coins, time to each milestone, income and Luck snapshots, feature rates, held seeds, stars. It buys by "time to afford + time to pay back" (D100).
- **Debug panel:** backtick key or Menu → Toggle debug panel; always with `npm run dev`, in a built game only with `?debug`. **Recipes for testing every feature fast are in `docs/DEBUG.md`.** In the console: `hamster.game`, `hamster.clock.timeScale`, `hamster.ui.render()`, `hamster.ui.celebrate`, `hamster.sound`.
- **Fonts** come with the game (`main.ts` imports Pixelify Sans 500 and Nunito 600–900; nothing loads from the internet).
- **Claude Code preview:** `.claude/launch.json` defines `hamster-slots` (dev, port 8766), `hamster-slots-alt` (8767) and `hamster-slots-build` (`npm run preview`, 8768; build first). A different port = different browser storage, so test saves never touch the player's.
- **Screenshots at high DPI** can crop to the top-left: shrink with `document.querySelector('.app').style.cssText = 'transform: scale(0.55); transform-origin: 0 0; margin: 0'`. **A background tab pauses animation frames:** call `hamster.ui.render()` or drive it with `setInterval(() => { hamster.game.update(0.05 * hamster.clock.timeScale); hamster.ui.render(); }, 50)`.
- **Other tools:** `node tools/icons.mjs` redraws `public/icons/` from the hamster sprite; `public/social.png` is the link card (1200×630). Sprite gallery: `/tools/sprites.html` (`?only=seed,carrot&zoom=8`). Kit gallery: `/tools/kit.html`. A fresh game: Menu → Reset (twice).
- Needs Node.js with npm (user has Node 24). The tools run the `.ts` logic straight from Node 24, which strips types: that's why imports name the `.ts` file.

## File map

> Events and the game API are typed in `src/logic/types.ts` (`GameEvents`, `GameState`, `GameData`) and `Game` in `game.ts`; read those, not a copy here. Every amount of money in a payload or return is a `Money`.

```
hamster_slots/
├── AGENTS.md, CLAUDE.md (= @AGENTS.md), DESIGN.md, PORTING_NOTES.md, CHANGELOG.md, README.md, docs/DEBUG.md
├── data.json          ← ALL balance data (rule 2): machines, upgrades, retirement + familyTree, stars, tokens, capsules,
│                        skins, diary, casino, colony (1.4.0), betSteps, gamble
├── index.html         ← page skeleton: HUD shelf, cage stage, control deck slot, gamble panel, pots, WIN meter, hold board,
│                        main tabs (tablist) + tray with panels and sub-tabs, menu/settings, save backup, Big Cage page,
│                        particle canvas, live region, icons/manifest tags, file:// and no-JS warnings
├── public/            ← icons/, manifest.webmanifest, social.png (copied into the build as is)
├── package.json       ← version, `releaseName`, scripts, packages; package-lock.json
├── tsconfig.json, tsconfig.logic.json (src/logic with no browser types), vite.config.js
├── .github/workflows/deploy.yml, play.bat, .claude/launch.json, .gitignore/.gitattributes
├── tests/             ← see Testing (logic/, art, golden/, fixtures/, money, savecode, bigtree, release, shop, kit, platform)
├── tools/             ← sim.mjs, economy.mjs, golden.mjs, icons.mjs, sprites.html, kit.html
└── src/
    ├── main.ts        ← boot(createWebPlatform()): fonts, data → game → load save → settings, theme, sound, debug, UI →
    │                    offline earnings → frame loop + autosave; the crash screen
    ├── logic/         ← no DOM, no clock (rule 1)
    │   ├── types.ts, money.ts, rng.ts (mulberry32), events.ts (emitter)
    │   ├── machine.ts ← pure rules: rollGrid, paylines, evaluate/evaluateGrid, expectedValue (exact), scatter maths,
    │   │                ways (M9), hold & spin maths, wheelAverage, Moving Day's boxes (mysteryOptions, revealMystery)
    │   ├── roulette.ts, blackjack.ts, derby.ts, seeddrop.ts ← M11's four games (exact returns)
    │   ├── casino.ts  ← M11: chips, the games' actions, Prize Counter, boosts and charms (plugged into game.ts)
    │   └── game.ts    ← createGame: state and actions, upgrades, machines, symbols and Luck, bets, free spins, jackpot pots
    │                    + wheel, card gamble, streaks, hold & spin, cheese wheel, deliveries, auto-spin (+ rest floor + pause
    │                    toggle), retirement + Family Tree + the Big Cage, Machine Stars, tokens + diary, capsules + skins +
    │                    wardrobe buffs, the 60 Hz tick, save format + migrations, the Great Migration (colony, whiskers,
    │                    perks, trials, Wise Elders, seed softcap)
    ├── platform/      ← platform.ts (interface), web.ts (only localStorage + page events), memory.ts (test double),
    │                    save.ts (save + settings in/out of storage), savecode.ts, autosave.ts
    └── view/          ← draws the game; turns input into actions
        ├── style.css  ← theme tokens (first :root block), then @imports of styles/ (base, kit, layout, hud, stage, machine,
        │                celebrate, upgrades, family, bigcage, capsules, info, casino, dialogs, debug)
        ├── kit.ts     ← the pieces every screen is built from (button, buyButton, confirmButton (two taps), toggle, segmented,
        │                stepper, createSubTabs, tile, createSheet, card, listRow, chip, gauge, amount, drawer, keyedList …)
        ├── frames.ts, theme.ts, layout.ts ← painted materials from tokens; the frame CSS variables; the one breakpoint + rig maths
        ├── hud.ts, deck.ts ← the purse (wallet) and the control deck (Deliver, Spin, auto-spin lever, bet)
        ├── art.ts, skins.ts, paint.ts, pixelfont.ts ← sprites + palette, skin looks, the shared pixel painter, the title font
        ├── cage.ts, wheel.ts, cabinet.ts, bigtree.ts ← painted scenes: room + cage, hamster wheel, machine cabinets, the Big Cage's tree
        ├── dom.ts, sound.ts (Web Audio), fx.ts (particles), celebrate.ts (big wins, the iris between lives)
        ├── reels.ts, winshow.ts ← reel strips and payline/ways/feature cells; the win show
        ├── shop.ts    ← Upgrades tab (Hamster / machine / Machines sub-tabs; describeEffect also used by colony + Big Cage)
        ├── payouts.ts ← Info tab: paytable, paylines, feature odds, recent wins
        ├── capsules.ts, colony.ts, casino.ts, bigcage.ts, backup.ts, debug.ts ← Capsules tab (machine, wardrobe, diary), the
        │                Family tab's Colony sub-tab, the Casino tab, the Big Cage page + rebirth animation, Save backup, debug panel
        └── ui.ts      ← creates and drives everything: HUD and deck each frame, the sheet, stage (wheel, machine, signs, bubble,
                         pots, gamble), fitRig, the tabs (only the open one renders), Family tab, menu + settings, skins, win
                         celebrations, retire → iris → Big Cage → new life, hold board, cheese wheel, sounds, dialogs
```
