# AGENTS.md

The one file every agent reads (Claude Code, Codex, Cursor, Copilot…; `CLAUDE.md` just imports it). It is enough to start work. Everything else is read **on demand, by section**.

**Hamster Slots**: a cute pixel-art idle/clicker slot machine in the browser. A hamster on a wheel powers the machine; spins cost fake coins; when you're broke the hamster does timed **food deliveries** (always pay), so you never get stuck. **No real money, ever.** Web-first (D106): one TypeScript + Vite codebase, live on GitHub Pages; itch.io, Steam (Electron/Tauri) and mobile (Capacitor) later wrap the same build.

## Reading the other docs cheaply

`DESIGN.md` (~250 KB) and `PORTING_NOTES.md` (~155 KB) are far too big to read whole. Grep, then read only the section you need (`grep -n "^## " DESIGN.md`, then `Read` with offset/limit; `grep -n "^\*\*D146 " PORTING_NOTES.md` for one decision).

| File | What's in it |
|---|---|
| `DESIGN.md` | What the game is; source of truth for design. Every number in it comes from data.json. §1 pillars · §2 core loop · §3 Old Clunky · §4 deliveries · §5 upgrades · §6 currencies · §7 save · §8 debug panel · **§9 balance rules** · §10 balance targets · **§11 roadmap** · §12 look · §13 retirement + Family Tree · §14 tokens + capsules · §15 feel, offline earnings · §16 machines + paylines · §17 QoL, pause · §18 bets · §19 bonus features · §20 particles · §21 real pokies (M7) · §22 Big Cage · §23 1.0 · §24 M9 machines · §25 wardrobe · §26 redesign 1.2 · §27 casino · §28 Nuts & Bolts · §29 Great Migration · §30 Glow Up · §31 New Digs (UI redesign parts 1–9) |
| `PORTING_NOTES.md` | Platform plan, platform layer, invariants any rewrite keeps, then logs: **Decisions** (D1…D160: chosen, rejected, why), **Balance log**, **Playtest notes**, Prototype history |
| `CHANGELOG.md` | What players got per version; `[Unreleased]` on top |
| `docs/DEBUG.md` | Console and debug-panel recipes to reach any feature fast |
| `docs/updates/` | One implementation plan per planned update, indexed in its `README.md`. **Open a plan only when told to work on that update** |
| `README.md` | Public front page; keep it true |
| `src/logic/types.ts`, `game.ts` | The real reference for state, events (`GameEvents`), data (`GameData`) and the game API |

## Current status

> Keep this block true. Update it in the same commit as the change it describes.

- **Live: 1.7.1 "Settling In"** (2026-10-03) at https://nxt549.github.io/hamster-slots/ (repo https://github.com/NXT549/hamster-slots, public, remote `origin`). Every push to `main` tests, builds and deploys (`.github/workflows/deploy.yml`, D118). `SAVE_VERSION` 14 (game.ts); data.json `schemaVersion` 14.
- **1.6.1 "Fresh Coat"** = machine skins paint every machine (`painted()` in cabinet.ts, `--paint*` tokens) + 5 new machine skins (29 in the capsule pool; Arcade Neon's twist: +5% double-win), D161.
- **1.6.0** = UI redesign parts 1–3 (DESIGN §31, D156–D160): the hamster's-room look (wood, paper, brass, enamel: `frames.ts`), the kit (`kit.ts`), purse (`hud.ts`), control deck (`deck.ts`), phone tab bar, detail sheet, rebuilt Upgrades tab (`shop.ts`), nothing under 12 px, only the open tab drawn. View only: no rules, balance or save changes.
- **1.7.1 "Settling In"** = the balancing pass's first fix (D163, `docs/updates/balancing.md`): each colony's Family Tree costs ×3 more (`familyTree.costPerColony`), Colony Pride +30% a level (was +50%). No save change.
- **1.7.0 "Family Room"** = UI redesign part 4 (§31, D162): the Family tab (`family.ts`: retire letter, trait chips), Colony (`colony.ts`: perk tiles, toggles) and the Big Cage's panels on the kit. View only.
- **Planned, don't build until asked:** UI redesign parts 5–9 (Capsules + Info, Casino, Menu + dialogs, the guide + UI sounds, polish; §31). When asked: on a branch, part by part, each leaving the game playable. The user picked restyle + restructure, the room look, a first-time guide and UI sounds (two new settings `uiSounds`, `guide`; no save change).
- **Next on the roadmap:** M12 Your own casino (§11). A new system: plan it with the user first.
- **Now:** waiting for playtest feedback on 1.1.0–1.6.0 (1.3.0–1.6.0 shipped without a playtest; 1.6.0 and 1.7.0 not yet seen on a real phone, Firefox or Safari). Questions in DESIGN §21–§31; feedback goes in PORTING_NOTES → Playtest notes; fixes ship as 1.7.x.
- **Open balance issues:** late lives short around generations 11–15 (§10); 1.4.0's seed softcap made them 2–3× longer, and 1.7.1's balancing pass (D163: each colony's tree ×3, Colony Pride +30%) made colony 2 last 3–5 h with 5–8 min late lives, but colony 3's middle lives are still 2–5 min (§29 → Balance); the wardrobe makes mid-game lives ~10–30% shorter (§25); casino boosts can cut late lives by up to a third (§27, `node tools/sim.mjs --casino`).
- **Not yet verified:** how the M7/1.0/M9 sounds sound; a natural jackpot-wheel label, hold & spin Grand and ×10 cheese wedge in the browser (only tests/console); Epic twists in a real session; Firefox and Safari look (rays' `mask`, line trace, reel blur).
- **Tags:** `v0.1.0 v0.2.0 v1.0.0 v1.3.0 v1.3.1` are on GitHub. Missing (the session git proxy refuses tag pushes, HTTP 403), so the user adds them as GitHub Releases: v1.1.0 `7f2fe32`, v1.2.0 `4fa56c3`, v1.3.2 `1084cb6`, v1.4.0 on its docs-only deploy commit (same game as "Release 1.4.0" `76aec6d`, D149), v1.5.0 `bb98c2d`, v1.6.0 `6558459`, v1.6.1 on the "Release 1.6.1" commit, v1.7.0 on the "Release 1.7.0" commit, v1.7.1 on the "Release 1.7.1" commit.
- **Tests:** `npm test`, 2,985 tests, ~1.5 min.

## Commands

```
npm test                 # Vitest, everything (one file: npx vitest run tests/logic/family.test.js)
npm run build            # typecheck (logic with no DOM types, then all) + vite build → dist/
npm run dev              # Vite; data.json saves hot-swap numbers keeping progress
npm run economy          # EV/RTP/hit-rate tables for DESIGN
node tools/sim.mjs       # balance simulator, plays the real logic (--help for options)
node tools/golden.mjs --confirm     # re-record the golden run (approved gameplay changes only)
node tools/golden.mjs --fixtures    # make the save fixtures for a new save version
node tools/icons.mjs     # redraw public/icons/ from the hamster sprite
```

The user plays with `play.bat` (Vite on port 8765, which holds their save). `.claude/launch.json`: `hamster-slots` (dev, 8766), `hamster-slots-alt` (8767), `hamster-slots-build` (preview, 8768; build first). A different port = different storage, so tests never touch the player's save. Node 24 locally and in CI (tools run the `.ts` logic straight from Node, which strips types: imports name the `.ts` file).

## Hard rules

Numbered because the logs cite them ("rule 3").

1. **Logic never touches the DOM.** `src/logic/` never uses `document`, `window`, `localStorage`, `Date`, `performance` or `Math.random`; it runs headless in Node (`tsconfig.logic.json` has no browser types). The view reads `game.state`, listens to events and calls actions (`game.spin()`, `game.buyUpgrade(id)`); it never changes state. Platform features go through `src/platform/` (`Platform` in `platform.ts`): only `web.ts` touches `localStorage` and page hide/close events, and only `platform.now()` reads the clock. A new platform = one more file like `web.ts`.
2. **All balance numbers live in `data.json`**, plain JSON (no comments, no trailing commas, no art or colours). No magic numbers in code.
3. **One cost formula for everything you buy** (coin upgrades and Family Tree nodes): `floor(baseCost × growthRate ^ owned)` (`costAtLevel()`); a tree node in a later colony is that × `familyTree.costPerColony` ^ colony (D163).
4. **The balance rules are tested and must keep holding** (DESIGN §9): every machine's RTP > 100% in every setup (reels, paylines, wild level, Pays Both Ways, every symbol-unlock step, features counted), bet never changes it · each symbol unlock raises EV and lowers hit rate; each Luck level raises both · auto-spin interval ≥ spin time + rest · delivery coins/s < auto-spin profit/s at Wheel Training 1 (also with the whole tree); one delivery covers a base spin on the free first machine · card gamble exactly fair, never counts as earned · free spins always end (retrigger loop < 1 at max everything) · **every feature's EV is exact** (`spinExpectation` in machine.ts), keep it so for new features · casino: every bet 94–99.5% back, exact; chips never become coins or count as earned · Lucky Pennies' double exact; bet ≤ ×10 (D80, D139) · pause is a player choice; `getAutoInterval()` same paused or not · Moving Day's boxes keep EV exact; colony perks never change odds; the seed curve only grows (softcap bends it down past `seedSoftcap.seeds`, never up).
5. **Dependencies:** TypeScript, Vite, Vitest, break_eternity.js, `@fontsource/pixelify-sans`, `@fontsource/nunito`. No UI framework. Ask before adding anything (typing tests needs `@types/node`: ask).
6. **The save stores player state only**, never balance values. Details under Saves.
7. **Comment for a learner.** The user is learning: short comments explaining *why* at key points, not every line.
8. **One milestone at a time,** then stop for the user to test. No roadmap features early.
9. **Prototype art:** sprites follow the style guide atop `art.ts` (32/24/16/12 px; hamster and reel symbols 32×32 with five-step ramps; matching outlines; whole-number scales; 12×12 UI frames are 9-slice with uniform edges); every palette letter used, new colours on free digits/punctuation. Painted scenes use `paint.ts` (2 screen px per painted px, light from top-left, outline per part, dithered, never smooth). Titles use `pixelfont.ts`. Particles (`fx.ts`) are whole-pixel squares in token colours or whole-scale sprites, off with Motion "Less"; **every new animation gets its `.less-motion` rule beside it** in the same `styles/` file. Effort goes to feel and clarity, not detail.
10. **`npm test` after any change to logic, data or sprites**; tests and build must pass before every commit.
11. **Art lives in the view.** Sprites are text grids in `art.ts`. Anything that must fit any size (cage + room, wheel, cabinets, Big Cage tree) is painted in code on a small canvas from theme tokens (each painter lists its tokens: `CAGE_TOKENS`, `WHEEL_TOKENS`, `CABINET_TOKENS`, `TREE_TOKENS`, `FRAME_TOKENS`; tests check they're in `:root`), so skins keep working. Tokens (colours, fonts, sizes) are in the first `:root` block of `style.css`; rules in `src/view/styles/` (one file per part). `theme.ts` repaints UI frame sprites in token colours; `frames.ts` paints the wood/paper/brass/enamel frames into `--fr-*` variables, and a frame's `--fw` is always its 4 px corner at a whole number (4, 8, 12, 16). Every framed element sets its own `--frame`/`--fw` (custom properties inherit). Skins are in `skins.ts` (data.json lists only ids/names/rarities). Numbers use `--font-num`; the pixel font is always weight 500. Highlights go *behind* symbols.

**Also:** money is always a `Money` (`src/logic/money.ts`, break_eternity, D115): use its methods (`a.add(b)`, `a.gte(b)`, `a.mul(x)`) and money.ts's `divide`, `power`, `roundMoney` for exact answers (Decimal's own `div`/`pow` drift a cent; the golden run catches it). `+ - * < >` don't work on Money and TypeScript won't flag `<`/`>` or a Money used as a boolean (always true). Odds, weights, timers, levels and counts stay plain numbers.

**Ask first:** any change to game design, balance direction or core mechanics (if a request conflicts with DESIGN.md, say so); any new system (describe the plan before building); anything unsure about design, balance or saves.

## Keeping docs in sync

Any change that makes a doc wrong updates it **in the same commit**.

| If you change… | Update… |
|---|---|
| Anything | Current status above, if no longer true |
| Something players notice | `CHANGELOG.md` → `[Unreleased]`, plain words for players |
| A number in data.json | PORTING_NOTES → Balance log (old → new, why, sim before/after); the DESIGN tables showing it (`npm run economy`); re-record the golden run |
| A mechanic, symbol, upgrade or currency | `DESIGN.md` |
| A file's role, the architecture | File map below |
| Platforms, build, deploy, storage | PORTING_NOTES → the platform plan |
| Playtest impressions | PORTING_NOTES → Playtest notes |
| A choice between alternatives | PORTING_NOTES → Decisions (next D-number: chosen, rejected, why) |
| How we work | This file |

## Adding content

- Prefer data. A new upgrade of an existing effect type is data only. A new effect type: one small function in game.ts (D7), its fields in `Effect` (types.ts), a preview in `STAT_FOR_EFFECT`, a label in shop.ts `effectFormats`, an icon in art.ts.
- Rebirth/sticker upgrades: `"unlock": { "generation": 4 }` or `{ "sticker": "onFire" }`. Colony machines/traits: `"colony": 1`; colony perks are `colony.perks` entries (rule 3 pricing, in whiskers); Colony Trials are `colony.trials` entries with one of five twists (`rule`).

## Balance changes

Compare pacing before and after with `node tools/sim.mjs` (try a variant with `--data variant.json`; check `--player active` and enough lives, `--lives 12`). Report time to first retirement, first life's length, when each machine arrives; paste the tables into PORTING_NOTES → Playtest notes. If the sim can't measure it, suggest an addition.

## Saves

- Format lives in the logic (`toSaveData` / `loadSaveData` / `migrateSave` in game.ts); the platform only moves text. Settings are stored apart, so Reset keeps them.
- **Any save-format change:** bump `SAVE_VERSION`, add a `migrateSave` step, add a test loading an old save, and make the new fixture set (`node tools/golden.mjs --fixtures`).
- Money is saved as text (`"1234.56"`, `"1.5e400"`); `moneyFrom` also reads old plain numbers.
- Autosave every `autosaveSeconds` and on page hide/close (`autosave.ts`). Backup codes (Menu → Save backup) are `HS1:` + base64 save JSON, loaded through the migrations, no offline earnings.
- Offline progress: the platform says how many seconds passed; the logic runs `applyOfflineEarnings(seconds)` (§15).

## Testing

All tests are JavaScript in `tests/` (Vitest; older ones use `check(name, cond)` from `tests/check.js`). A bug fix includes a test that would have caught it.

- `tests/logic/*.test.js`: one file per area. `helpers.js`: **`newGame` puts every rebirth and sticker upgrade on sale**; planting needs the Big Cage, so use `plant(g, …ids)`.
- **`tests/golden.test.js`, the golden run:** scripted sessions (`tests/golden/sessions.js`) on fixed seeds must reproduce `tests/golden/golden.json` exactly. **Never re-record it to make a failing test pass**; only for an intended, approved gameplay change, said in the commit message. It must play the same on every Node: `Math.pow` can differ in the last bit between Node 22 and 24, so sessions round any power-derived amount before feeding it in (`seedCoinsToAdd`); check a new recording on Node 24.
- `tests/fixtures.test.js`: real saves `tests/fixtures/save-v<N>-<name>.json`, kept for good. The current version's load and save back unchanged; older ones migrate to exactly the current file of the same name.
- `art.test.js` (sprite sizes and palette, 9-slice, skins, tokens, cage layout at 5 sizes) · `kit.test.js` (frame tokens, `--fw`, one breakpoint, style.css imports each `styles/` file once, no class styled by two files, **never the `border-image: none` shorthand**, use `border-image-source: none`; the minifier empties it) · `shop.test.js` · `money.test.js` · `savecode.test.js` · `platform.test.js` (`memory.ts` fake platform, `web.ts` on a fake browser) · `bigtree.test.js` · `release.test.js` (icons, manifest, version = package-lock, the update has a name).

## Git and releases

- Branch for anything bigger than a small fix; commit after each working step; merge to `main` after the user's OK. **`main` must always be playable** (it auto-deploys; a failed CI run deploys nothing).
- Commit identity (repo git config): `nxt` / `94941422+NXT549@users.noreply.github.com`. Claude's commits add a `Co-Authored-By` line.
- Versions: patch = fixes, minor = features/content, major = full release; the user may pick (D138). A candidate says so in package.json (`1.0.0-rc.1`).
- **Every update has a name** players would use, picked when content settles (tell the user; they may rename). It goes in package.json `releaseName`, the CHANGELOG heading (`## [1.3.1] - 2026-09-27 · Nuts & Bolts`; as a candidate `## [Unreleased] · 1.3.1 "Nuts & Bolts"`), the GitHub Release title (`v1.3.1 · Nuts & Bolts`), Current status, DESIGN's section and roadmap row, and the release's Decision. A fix-only patch can keep its update's theme. Past names: 0.1.0 First Spin · 0.2.0 New Foundations · 1.0.0 The Big Cage · 1.1.0 Machines & Hats · 1.2.0 A New Look · 1.3.0 The Hamster Casino · 1.3.1 Nuts & Bolts · 1.3.2 Rest Stop · 1.4.0 The Great Migration · 1.5.0 The Glow Up · 1.6.0 New Digs · 1.6.1 Fresh Coat · 1.7.0 Family Room (CHANGELOG has what each held).
- A release moves `[Unreleased]` entries under the version and date. If tags can't be pushed (403), the user publishes a GitHub Release on the release commit.

## Debugging

Backtick or Menu → Toggle debug panel (always in dev; in a build only with `?debug`). Console: `hamster.game`, `hamster.clock.timeScale`, `hamster.ui.render()`, `hamster.ui.celebrate`, `hamster.sound`. Recipes: `docs/DEBUG.md`. A background tab pauses animation frames: call `hamster.ui.render()` or drive it with `setInterval(() => { hamster.game.update(0.05 * hamster.clock.timeScale); hamster.ui.render(); }, 50)`. High-DPI screenshots can crop: `document.querySelector('.app').style.cssText = 'transform: scale(0.55); transform-origin: 0 0; margin: 0'`. Galleries: `/tools/sprites.html?only=seed,carrot&zoom=8`, `/tools/kit.html`. Fresh game: Menu → Reset (twice). Fonts ship with the game (nothing loads from the internet); `index.html` from `file://` shows a "use play.bat" message.

## File map

```
data.json        ALL balance data (rule 2): machines, upgrades, retirement + familyTree, stars, tokens, capsules,
                 skins, diary, casino, colony, betSteps, gamble
index.html       page skeleton (HUD, stage, deck slot, gamble, pots, hold board, tabs + tray, menu, Big Cage page…)
public/          icons/, manifest.webmanifest, social.png (1200×630 link card), copied as is
src/main.ts      boot(createWebPlatform()): fonts, data → game → save → settings/theme/sound/debug/UI → offline
                 earnings → frame loop + autosave; crash screen
src/logic/       no DOM, no clock (rule 1)
  types.ts money.ts rng.ts (mulberry32) events.ts (emitter)
  machine.ts     pure rules: grids, paylines, evaluate, exact expectedValue, scatters, ways, hold & spin,
                 wheelAverage, Moving Day boxes
  roulette.ts blackjack.ts derby.ts seeddrop.ts   casino games (exact returns); casino.ts chips, Prize Counter, boosts
  game.ts        createGame: all state and actions, the 60 Hz tick, save format + migrations, every system
src/platform/    platform.ts (interface) web.ts (only localStorage + page events) memory.ts (test double)
                 save.ts savecode.ts autosave.ts
src/view/        draws the game, turns input into actions
  style.css      tokens (first :root) + @imports of styles/*.css (one per part)
  kit.ts         shared pieces: button, buyButton, confirmButton (two taps), toggle, segmented, stepper,
                 createSubTabs, tile, createSheet, card, listRow, chip, gauge, amount, drawer, keyedList…
  frames.ts theme.ts layout.ts   painted materials, frame CSS vars, the one breakpoint + rig maths
  hud.ts deck.ts                 purse; control deck (Deliver, Spin, auto lever, bet)
  art.ts skins.ts paint.ts pixelfont.ts   sprites + palette, skins, pixel painter, title font
  cage.ts wheel.ts cabinet.ts bigtree.ts  painted scenes
  reels.ts winshow.ts celebrate.ts fx.ts sound.ts dom.ts
  shop.ts        Upgrades tab (describeEffect is reused by colony + Big Cage)
  family.ts      Family tab: the retire letter, planted traits; colony.ts is its Colony sub-tab
  payouts.ts capsules.ts casino.ts bigcage.ts backup.ts debug.ts   the other tabs/pages
  ui.ts          creates and drives everything (only the open tab renders)
tests/ tools/    see Testing and Commands; tools/ also has sprites.html, kit.html
```
