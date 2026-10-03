# Porting Notes

How one web codebase reaches every platform, plus the project's logs. **There is no engine port** (D106): the browser game is the game, and every platform wraps the same build.
**Update this in the same commit as the change it describes.** (See the table in `AGENTS.md`.)

Sections: [The plan](#the-plan) · [The platform layer](#the-platform-layer) · [Platform notes](#platform-notes) · [Web migration](#web-migration) · [Invariants](#invariants-any-rewrite-must-keep) · [Decisions](#decisions) · [Balance log](#balance-log) · [Playtest notes](#playtest-notes) · [Prototype history](#prototype-history-before-010)

---

## The plan

One codebase: TypeScript + Vite (D107). The build makes a static site (`dist/`: HTML, JS, CSS, data, fonts), and every platform ships that same folder. Only the platform layer differs.

| # | Platform | How it ships | Needs | Status |
|---|---|---|---|---|
| 1 | **Web: GitHub Pages** | A GitHub Actions workflow runs the tests and the build on every push to `main`, then publishes `dist/` to Pages. Friends play from a link. | The TS + Vite migration (done, 0.2.0), a GitHub repo, a build that works from the repo's sub-path (done: `base: './'`) | **Live** since 2026-09-26: https://nxt549.github.io/hamster-slots/ (Step 4, D118); **1.0.0**, **1.1.0**, **1.2.0** and **1.3.0** since 2026-09-27 (D123, D130, D134, D137) |
| 2 | **itch.io** | `dist/` uploaded as a zip, as an HTML5 game played in the browser on itch | Relative paths in the build (done); export/import saves (done, 0.2.0); the store-rule check (DESIGN §11); an itch.io account (the user's) Not started (1.0 is out, so it can go next whenever the user wants) |
| 3 | **Steam** | `dist/` inside a desktop wrapper: **Electron or Tauri** (not decided yet) | A desktop platform layer (file saves, Steam Cloud, maybe achievements), a store page, content ratings | Later |
| 4 | **Mobile** (maybe) | `dist/` inside **Capacitor** (iOS and Android apps) | A mobile platform layer (native storage, app pause/resume), touch-friendly controls, store review | Maybe, later |

Each platform gets a detailed plan here when its turn comes.

## The platform layer

*Built for the web (step 3.6, D114); the other columns are the plan.* The game logic never knows which platform it's on (rule 1). Everything platform-specific goes through one small interface, and each platform brings its own implementation:
- `src/platform/platform.ts`: the `Platform` interface: **storage**, **lifecycle**, **`now()`** (the clock) and **achievements**.
- `src/platform/web.ts`: the web version (localStorage, `visibilitychange` + `pagehide`, `Date.now()`, no achievements). `main.ts` calls `boot(createWebPlatform())`: a Steam or mobile build would pass its own platform there instead.
- `src/platform/save.ts` (the save and the settings) and `autosave.ts` (the timer, save on hide/close, pay for a hidden tab's time) only use the interface, so every platform shares them.
- `src/platform/memory.ts`: a pretend platform for the tests.

The save backup (`src/platform/savecode.ts`, 3.8) needed no new service: it only uses storage and `now()`, so every platform gets it. App actions (Quit, open a link) come when a platform needs them.

| Service | What the game needs | Web / itch.io | Steam (Electron or Tauri) | Mobile (Capacitor) |
|---|---|---|---|---|
| **Storage** | Read/write the save, the settings and the Recent wins log as text, under three keys (settings survive Reset; D166) | `localStorage` (one per site) | A file in the app's user-data folder; Steam Cloud can sync that folder | Native key-value storage (e.g. Capacitor Preferences) rather than the webview's `localStorage` (iOS may clear that when storage runs low) |
| **Save backup** | Export the save as a text string; import one | Copy and paste the text: built (Menu → Save backup, D116). A file download/upload is optional | Same | Same (the share sheet helps) |
| **Lifecycle** | "Going away" → save now and remember when; "back" → pay offline earnings (DESIGN §15) | `visibilitychange` + `pagehide` | Window hidden/minimised, and quitting | App pause/resume events |
| **Clock** | Real-world time, only for offline earnings | `Date.now()` | Same | Same |
| **Achievements** | Unlock one by id | Nothing: the in-game Hamster Diary is the achievement list | Steam achievements through a Steamworks library for the chosen wrapper | Maybe Game Center / Google Play Games |
| **App actions** | Quit, open a link | Not needed (no Quit button on the web) | A Quit button | The Android back button |

- Whether Steam achievements mirror the Diary stickers (ids from data.json) is a **design question for the user**, answered when Steam is planned.
- Keep the interface small. Add a service only when a platform really needs it.

## Platform notes

**Every platform**
- **Fonts:** bundled with the build since 0.2.0 (Fontsource packages; both fonts are OFL-licensed, so that's allowed, D22, D117). Nothing loads from the internet, so offline, desktop and mobile look the same.
- **A save belongs to one site or app.** Saves on `localhost`, on GitHub Pages and on itch.io are three separate saves. Export/import is how a player moves one, and it's the backup when a browser clears a site's data.
- **Big numbers:** break_eternity.js lets currency grow far past 1e308, where plain JS numbers turn into `Infinity`. The save stores them as text so they survive JSON (save v8, step 3.7, D115).
- **The debug panel:** always there in `npm run dev`; in a built game only with `?debug` in the address (D110 default, built in 3.9, D117). A desktop or mobile build will need its own way in (a launch flag, say) if it's wanted there.
- **Store rules:** slot machines, bets, the card gamble and the capsule gacha can trigger "simulated gambling" and loot-box ratings, even with no real money. Check each store's current rules before a release (DESIGN §11, "Things to keep in mind for release").

**Web: GitHub Pages**
- A project site lives at `https://<user>.github.io/<repo>/`, so the build must work from a sub-path (Vite's `base`: `'./'` or `'/<repo>/'`).
- Vite gives built files hashed names, so a browser never mixes old and new files. The dev server always serves fresh files too, so the no-cache Python server (D48) was removed in 3.1.
- `main` deploys itself, so `main` must always be playable (AGENTS → Git and releases).
- The workflow (`.github/workflows/deploy.yml`, D118): on a push to `main` (or by hand: Actions → Run workflow), job 1 runs `npm ci`, `npm test` and `npm run build` on Linux with Node 24, and uploads `dist/`; job 2 deploys it, only if job 1 passed. One deploy at a time.
- The repo is https://github.com/NXT549/hamster-slots; the site is https://nxt549.github.io/hamster-slots/: its own address, so its save is separate from play.bat's (`localhost:8765`). Moving a save there = Menu → Save backup.

**itch.io**
- An HTML5 game is a zip with `index.html` at its root. itch plays it inside an iframe on its own domain, so the build must use relative paths (Vite `base: './'`).
- Set the embed size (or allow fullscreen). The game already fits phone widths.
- Upload by hand at first; itch's `butler` command-line tool can automate it later.

**Steam (Electron or Tauri: to be decided)**
- **Electron** bundles its own Chromium: the same browser engine on every OS and mature Steamworks libraries, but a big download (roughly 100 MB or more).
- **Tauri** uses the system's webview (WebView2 on Windows, WebKit on macOS and Linux): a small download, but each OS draws a little differently (test with WebKit, i.e. Safari), and its native side is written in Rust.
- Either way: saves become files through the platform layer (with Steam Cloud), a Quit button appears, and the game must keep running, or pay offline earnings, while the window is hidden (browsers slow hidden pages down).

**Mobile (Capacitor, maybe)**
- Touch only: no hover and no keyboard. The keyboard shortcuts (bet `-`/`=`, the gamble keys, the backtick debug panel) need on-screen ways in, buttons need finger-sized targets, and the layout must keep clear of notches (safe areas).
- Save when the app pauses; pay offline earnings when it resumes.
- Audio already starts on the first tap (DESIGN §15), which mobile browsers require.
- Apple and Google each have their own rules and age ratings for simulated gambling. Check them before building for mobile.

## Web migration

Moving the plain-JS prototype to TypeScript + Vite (D107). The user approved this plan on 2026-09-25 (D110). **Every step:**
- leaves the game playable
- passes the tests and the build
- is committed on the `web-migration` branch
- gets tested by the user, then merged into `main` after their OK

**Nothing about the gameplay changes** until 3.8. The **golden run** (3.3) proves it: every later step must reproduce today's game to the cent.

| Step | What | Status |
|---|---|---|
| 3.0 | Git baseline: `git init`, `.gitignore`, `.gitattributes`; commit today's game + docs on `main`, tag `v0.1.0`; branch `web-migration` | **Done** |
| 3.1 | npm + Vite, still JavaScript: `package.json` (0.1.0), Vite (`base: './'`); data.json bundled, with live reload of data edits in `npm run dev`; `play.bat` runs Vite on **port 8765** (the same site, so the player's save carries over); `tools/serve.py` removed; preview configs switched to Vite (+ `hamster-slots-build` for `dist/`). Vite 8.3.1 | **Done** (the user tested play.bat: it opens and the save was kept) |
| 3.2 | Move files into layers, no code changes (a separate commit keeps git history): `src/logic/`, `src/platform/`, `src/view/` (with style.css), `src/main.js`; data.json stays at the top | **Done** (the built files came out byte-for-byte the same; the user tested it) |
| 3.3 | Vitest: all 687 checks as Vitest tests, art tests too, `npm run economy` for DESIGN's tables; the **golden run** (scripted sessions on fixed seeds, recorded from today's code, replayed by a test); real v7 save fixtures. Vitest 5.0.2; 1,108 tests in ~10 s (D111) | **Done** (the user OK'd it) |
| 3.4 | TypeScript for the logic (strict; JS and TS side by side meanwhile): types for data.json, state and event payloads; rng → events → machine → game; the build type-checks first; the tools run the `.ts` logic straight on Node 24. TypeScript 7.0.2 (D112) | **Done** (the user OK'd it) |
| 3.5 | TypeScript for the view: helpers first (dom, art, theme, skins, sound, fx), then the screens and main (and save.ts, which holds the Settings type the screens need) (D113) | **Done** (the user OK'd it) |
| 3.6 | The platform layer: a `Platform` interface (storage, going away / coming back, clock, achievements as a no-op) + the web version; tests with a fake in-memory platform (D114) | **Done** (the user said to continue) |
| 3.7 | break_eternity.js for all three currencies and everything priced in them (odds stay plain numbers); `money.ts`; **save v8** with a v7 → v8 migration tested on the fixtures; a speed check at 50× (D115) | **Done** (the user OK'd it) |
| 3.8 | **Save backup** (new feature): Menu → Save backup, Export (a one-line code + Copy) and Import (paste, two-tap "Load this save", friendly errors); old codes load through the migrations (D116) | **Done** (the user OK'd it) |
| 3.9 | Bundled fonts, the debug-panel rule, cleanup, docs; release **0.2.0**; merge into `main` (D117) | **Done** (the user OK'd it; merged into `main`, tagged `v0.2.0`) |
| Step 4 | GitHub Pages: the user creates the repo (`NXT549`) and sets Pages → Source = GitHub Actions; `.github/workflows/deploy.yml` tests, builds and deploys on every push to `main` | **Done:** https://github.com/NXT549/hamster-slots, live at https://nxt549.github.io/hamster-slots/ (D118) |

## Invariants any rewrite must keep

These were the "gotchas for the port". They still hold for the TypeScript migration: the same data and the same seed must give the same game, down to the cent.

- **Payout tables are keyed by strings:** `payouts["seed"]["2"]`, not `[2]` (in TypeScript: `Record<string, number>`).
- **The cost formula is exactly `floor(baseCost × growthRate ^ owned)`** (`costAtLevel()`), so costs never drift (rule 3).
- **Money is rounded to cents after every change** (`roundMoney()`, D12), and money maths goes through money.ts (D115): break_eternity's own `div`, `pow` and `round` differ from plain numbers in the last digit, which would drift by a cent.
- **Seed formula epsilon:** `seedsForCoins()` is `floor(pow(coins / divisor, exponent) + 1e-9)`. Without the tiny `+ 1e-9`, an exact square like 11,700 coins (3 seeds with the square root, `seedExponent` 0.5) can come out as 2.9999999 and floor to 2 seeds. Keep it.
- **Offline earnings are capped, then halved:** `min(seconds, maxSeconds) × perSecond × efficiency`. Compare `seconds >= minSeconds` BEFORE capping.
- **Sprite scale must stay a whole number** (`max(1, floor(size / width))`), or pixel art gets uneven pixels.
- **Tokens and skins survive retiring.** They're outside the list of fields `retire()` resets. Only a full Reset clears them.
- **Retire keeps lifetime stats but resets the rest:** copy the list of reset fields from `retire()` exactly (coins, upgrades, machines, active machine, delivery, auto timer, run totals), then re-apply "start with" traits.
- **mulberry32 must stay bit-exact** (`>>> 0` and `Math.imul` in `src/logic/rng.ts`), so the same seed gives the same spins before and after the migration.
- **Spin results are `result[reel][row]`** (save v5). A v4 save's flat result becomes one-row columns; check the row count against the machine's `rows` when loading.
- **Multi-line payouts round each line to cents, then add them up.** Rounding the total once gives different cents, and then payouts won't match.
- **EV scales with lines, the hit rate doesn't** (D62). Keep the exact reel-1-and-2 count for the hit rate, and cache it; it needs every 2-match to pay (a data test checks this).
- **An upgrade a machine doesn't sell is level 0 on that machine**, even if the save has a number for it. "Start with" traits only raise the level on machines that sell the upgrade (the Heirloom Reel never gives the Stacker a third reel).
- **The free first machine is always owned.** When loading, add it back if it's missing, keep each machine type once, and find the active machine by its type id (indexes can shift during cleanup).
- **The wild "best of" rule compares BASE payouts,** then applies Jackpot Dance only if the chosen reading covers every reel. Comparing after multipliers gives different wins.
- **A scatter never counts on a line and ends a run**, even after wilds: wild, wild, ball pays the 2-wild prize; wild, ball pays nothing.
- **Order of RNG draws in `resolveSpin`** (for seeded parity): evaluate the lines (no draws) → golden-jackpot tokens → start free spins (no draw) → start the jackpot wheel (**one `pickWeighted` draw** for the pot) → offer the gamble (no draw). `gamble()` uses one `rng.next()` per pick. Keep this order.
- **Pots are in base units** (before the bet and payout bonuses). Growth is added on **paid** spins only, and a won pot resets to its seed, not to 0.
- **Gamble coins never go through `earn()`**, and the open gamble is removed in `toSaveData()`.
- **The queued click is not state**: don't save it, and clear it on switch, retire and load.
- **Tick order** (every 1/60 s): delivery → jackpot wheels (all machines) → spin timers (all machines) → gamble offer countdown → the queued click → free spins (active machine) → auto-spin (held while free spins, a wheel or a gamble has the machine) → Self-Starter.
- **The weights the reels use (M7), in this order:** locked symbols → 0 (unless their unlock is open) → family weight shifts (skipped when either symbol has weight 0) → the Hamster Wild's added weight → × (1 + Luck ÷ 100) on every symbol except the blank. A different order gives different odds.
- **An unlock upgrade opens its list in order:** level n = the first n symbols. The v6 → v7 migration sets every unlock a machine sells to its max level (so `migrateSave` needs the data file).
- **A blank ends a run and never pairs,** even with a wild next to it: wild, blank = nothing; wild, wild, blank = the 2-wild prize.
- **The multi-line hit rate** (machine.ts `gridHitRate`): try every way reel 1's rows can land, then multiply, over reel 2's rows, the chance that that cell pairs with none of its lines' reel-1 cells. It's exact and fast (8 symbols on 3 cells = 512 cases), and the answer is cached by weights.
- **The auto-spin interval** is `max(baseInterval × multiplier^(level−1) × Quick Paws, spin time (with Quick Paws) + rest)`, and the spin time depends on the machine, so ask per machine.
- **The card draw** is `SUITS[floor(rng.next() × 4)]` with SUITS in the order hearts, diamonds, clubs, spades: one draw per pick. Keep it for seeded parity.
- **`pickWeighted`'s float-rounding fallback** returns the last item with weight > 0 (a locked symbol must never land).

---

## Decisions

Newest at the bottom. Format: **decision**, *alternatives rejected*, why.

> **D1–D105 were written while a Godot rebuild was planned.** Their Godot remarks ("Godot: …", "ports to GDScript", "Godot needs") are history: since D106 there is no engine port. The decisions themselves still stand unless a later one says otherwise.

**D1 — A local server (`play.bat`) to run the game.** *Rejected: `data.js` wrapper, drag-in file picker.*
Browsers block a page on `file://` from reading `data.json`; a tiny server fixes that and keeps the data pure JSON. (See D48.)

**D2 — Spins cost coins; food deliveries are the safety net.** *Rejected: free spins.* (User's call.)
Paid spins give the "is this spin worth it?" feeling; deliveries (timed, always pay) prevent a soft-lock at 0 coins and stay weaker than auto-spin (DESIGN §9).

**D3 — Count matches from the left.** *Rejected: pay any pair anywhere; 3-in-a-row only.*
It's how real slots read a payline and works for any reel count.

**D4 — No power while the hamster is delivering.** *Rejected: deliveries run alongside spinning.*
The hamster powers the machine, and it makes deliveries a real choice, not free income. A spin in progress still finishes.

**D5 — The machine starts at 2 reels and progresses by upgrades.** (User's idea.)
Third Reel adds one. State stores `machines` as an array from day one, so multi-machine isn't a refactor later.

**D6 — Upgrades have a `scope`: `global` or `machine`.**
Hamster upgrades are global; machine upgrades start fresh on a new machine.

**D7 — Upgrade effects are data (`effect.type` + params); the logic has one small function per type.**
A new upgrade of an existing type needs only `data.json`.

**D8 — Expected value comes from a formula, not from sampling.** A test samples 200k spins to check the formula and RNG agree. If machines outgrow a formula, switch to exact enumeration or simulator estimates.

**D9 — A seedable RNG (mulberry32) passed into the game.** *Rejected: `Math.random()`.*
Same seed, same results, so tests and simulations repeat exactly.

**D10 — A fixed 60 Hz logic tick.** One `update(10)` equals 600 small updates, so speed-ups, lag and offline progress stay deterministic.

**D11 — The spin result is decided at spin start and paid at spin end.** The UI needs to know where reels stop; logic owns timing and the UI only reads `getSpinProgress()`.

**D12 — Money is rounded to cents after every change.** Float drift (4.4999999…) could leave "4.5 coins" unable to pay a 4.5 spin.

**D13 — `save.js` only moves text to and from storage; the save format and migrations live in `game.js`.**
Headless tests can check round-trips, and a new platform only swaps the storage.

**D14 — Auto-spin carries leftover time; it doesn't bank spins.** The average rate stays exact, and when it can't fire (busy, broke, delivering) it waits instead of stacking spins.

**D15 — Wheel Training max level is 8, not 10.** At level 8 the interval reaches the 0.8 s spin time; levels 9–10 would do nothing.

**D16 — Holding Space does NOT repeat spins.** *Rejected: key auto-repeat spins.* It would be a free max-speed auto-spinner and make Wheel Training pointless.

**D17 — Reels stop left to right at fixed points of the spin progress** (reel 1 at 30%, the last at 90%). The flicker uses the real clock, never the game RNG.

**D19 — The UI is a "diorama", not a clicker layout.** *Rejected: the three-column Cookie Clicker style.* User feedback: it looked too much like Cookie Clicker. Now a room stage, a HUD pill and a tabbed tray.

**D20 — Sprites are text grids in `js/art.js` with a shared palette.** *Rejected: CSS-shape art, image files.* Easy to edit and test, and a **skin can be a palette swap**.

**D21 — Reels are scrolling strips with 3 visible rows,** positioned from `getSpinProgress()`. Decoration rows use view-only randomness, never the game RNG.

**D22 — Two fonts: Pixelify Sans (weight 500) for words, Nunito for numbers and body text.** In the pixel font 5 and 8 read as "S", and bold makes C look like O.

**D23 — Theme tokens in `style.css :root`.** Skins and art direction change tokens, not rules.

**D24 — Reset is a two-tap button inside the Menu,** not the browser's `confirm()`: consistent look, easy to port.

**D25 — Highlights go BEHIND symbols.** A gold overlay made grey Sunflower Seeds look like Golden Seeds, misleading the player. Never tint a symbol.

**D18 — No catch-up for background time (yet).** Hidden tabs pause animation frames. Offline earnings are planned for the Feel milestone (now milestone 4) as one capped `update(secondsAway)`.

**D26 — Rebirth = "Retire to the Big Cage"; the currency is "Heirloom Seeds".** (User picked "retire & pass it on" and "a permanent tree bought with rebirth currency".) *Rejected: "Golden Sunflower Seeds".* It clashes with the **Golden Seed** reel symbol.

**D27 — Seeds come from LIFETIME coins earned: `total = floor((lifetime / 5000) ^ 0.5)`, and retiring pays `total − seeds already received`.** *Rejected: a formula on this life's coins only.* With a square root, per-life seeds reward retiring every few minutes (an exploit). Lifetime gives the same seeds for the same coins however often you retire.

**D28 — Heirloom bonus: every seed EVER earned gives +10% payouts, even after it's planted.** *Rejected: (a) tree-only power; (b) "unspent seeds give the bonus".* (a) A bot showed lives stretching to ~90 min by generation 4: a finite tree can't keep up with a square-root formula. (b) Planting would feel like losing power. 0.10 beat 0.05: the tree finishes ~30 min sooner.

**D29 — Payout bonuses: add within a group, multiply between groups: `(1 + coin upgrades) × (1 + family)`.** *Rejected: everything additive.* Family Pride's +25% would barely matter next to Chubby Cheeks' +500%. Family group = heirloom bonus + Family Pride + Family Fortune.

**D30 — Family Tree nodes use the SAME shape and cost formula as upgrades,** plus `branch` and `requires`. Effects from both lists are collected in one place, so a node can reuse an upgrade effect type.

**D31 — "Start with" traits write real upgrade levels** (at retire, when planted, on load), never lowering a bought level. *Rejected: computing "max(bought, free)" on the fly.* One stored number is simpler to read, save and port. The cost formula counts the free level as owned.

**D32 — Luck = moving weight between symbols, not adding weight.** Weights still sum to 100, so weight reads as "% chance per reel". No symbol drops below weight 1.

**D33 — The Family tab appears only when the first seed is pending.** *Rejected: showing it from the start.* A second currency in minute one is noise; the reveal is a mid-game surprise.

**D34 — The Family Tree is drawn top-down like a genealogy chart,** and buying is **select → Plant** in a detail panel. *Rejected: a buy button on every node* (cramped on a phone, easy to mis-tap). Retire is two-tap, like Reset.

**D35 — `delivery.duration` is stored in the state** (save v2), so buying Speedy Scooter mid-trip can't break the progress bar. Spin duration isn't: spins are under a second.

**D36 — Compact numbers from 1M ("1.23M", B, T), pulled forward from the Feel milestone.** 9-digit numbers overflowed the HUD on phones.

**D37 — The machine rig zooms to fit the stage width (`fitRig()`)** instead of a fixed 0.68 zoom, which clipped the lever with 3 reels.

**D38 — Save v2, with a v1 → v2 migration.** Old progress is kept: the hamster becomes generation 1, and past wins and deliveries count as earned.

**D39 — Skins: a separate gacha ("Capsule Machine") paid with Hamster Tokens.** (User's call; token sources left to us.) The DESIGN §14 proposal got "this is really good, continue". Tokens only buy cosmetics, never power, and are never sold.

**D40 — Tokens come from four places: diary stickers, golden jackpots, every 5th delivery, retiring.** *Rejected: tokens from coins or seeds* (skins would compete with power; the user wanted them "earnt separately"). Stickers front-load the first pull, jackpots make the rarest spin special, deliveries get a late-game purpose, retiring ties skins to the family loop. The delivery tip is a counter, not a random chance, so it can't change the RNG sequence.

**D41 — The diary is data-driven with 5 goal types** (`stat`, `upgradeLevel`, `generation`, `treeNodes`, `skinsOwned`), checked after actions **and on load**, so old saves get stickers they already reached. Checking after actions, not every tick, keeps 50× speed cheap.

**D42 — Before the Capsules tab appears, stickers are silent.** Tokens pile up, but the hamster doesn't talk about a currency the player can't see. The tab appears at 10 tokens (enough for a pull).

**D43 — Pity = "after N−1 misses, the next pull is the pity rarity"; the UI shows the REAL rate.** With Epic 5% and pity 20, Epics are really ~7.8% of pulls, and the odds line says so. Honest odds matter for a gacha, even a free one.

**D44 — Duplicates refund tokens by rarity (2 / 4 / 8)** instead of a fourth "shard" currency. Simpler, and no pull feels like a total loss.

**D45 — What a skin looks like lives in `js/skins.js`, not data.json.** data.json keeps id, name, category and rarity, never colours (rule 2). Fur skins pass a palette override; wheel, machine and room skins override theme tokens **set on the stage element**, so the tray keeps the classic tokens.

**D46 — New theme tokens for skinnable parts** (`--wheel-*`, `--marquee`, `--floor-ink`, `--token`, `--rarity-*`). Rule 11 says colours are tokens; now the wheel and marquee follow it.

**D47 — View code split: `dom.js`, `skins.js`, `capsules.js`.** ui.js was heading past 600 lines; each tray tab with real logic can be its own file.

**D48 — The local server sends `Cache-Control: no-store`.** Python's plain `http.server` let the browser keep old .js files, so a refresh loaded a mix of old and new modules. Cost: re-downloads on every load, instant locally.

**D50 — The sprite cleanup (user: the assets were "almost too clunky").** Every sprite was redrawn finer: main sprites 24×24 (was 16×16), icons 16×16, currency icons 12×12, at whole-number scales. Each material got a colour ramp and **its own darker outline** instead of one dark-brown line, which was what made the old art heavy. *Rejected: smooth vector art* (the project is pixel art). The text grids in `js/art.js` stay the source of truth.

**D51 — Sprite sizes are asked for in CSS pixels, not scale factors.** art.js picks the biggest whole-number scale that fits, so resolution can change without touching callers.

**D52 — Fur skins list only 3 colours; the view works out the rest**, so every fur skin matches the sprite's style automatically.

**D53 — The stage is two bands: a wall and a floor.** The wheel, machine, buttons and delivery road stand on the floor line (before, the rig floated and buttons straddled the edge). Outlines went from 4 px to 3 px (2 px for small parts).

**D54 — Win tiers come from the BASE payout ÷ the machine's BASE spin cost** (`winTiers`: nice 10×, big 20×, jackpot 100×). *Rejected: final payout ÷ current spin cost.* Chubby Cheeks multiplies every payout, so every win would become a "big win" within minutes.

**D55 — Offline earnings are worked out, not simulated:** `expectedAutoProfitPerSecond × seconds × 50%`, capped at 2 h, nothing under 1 minute. *Rejected: running `update(secondsAway)`* (432,000 ticks is slow, uses RNG draws, and auto-buys nothing anyway). The seconds are passed in, so the logic never reads the clock. Needs Wheel Training; counts as earned.

**D56 — Sounds are synthesized with Web Audio**, no audio files. Reel clunks and small-win blips only play for spins you pulled yourself (auto-spin at 1.5 spins/s would make them constant). Settings use their own storage key so Reset keeps them.

**D57 — Celebrations have limits:** at most 40 flying coins, one banner at a time, no motion with "reduced motion" on. A 3,000-spin test once spawned 394 coins and 31 stacked banners.

**D58 — Save v4** adds `stats.biggestWin` and `stats.offlineCoins` (a v3 save starts them at 0).

**D49 — `window.hamster.ui` is exposed**, so `hamster.ui.render()` can draw a frame by hand when a background tab pauses animation frames.

**D59 — Milestone 5 = the user's three asks, scoped by a question round.** They asked for "qol features", a new slot machine, and "a full redesign of the ascetic". Picks: art direction *hamster cage* (over night arcade, cozy cottage, candy toy shop), *collect & switch* (D61), and QoL sets *Buy ×10 / Max* and *Settings & info* (keyboard shortcuts and save backup not picked). Grid + paylines was pulled in from "Machine types I", because a recoloured Old Clunky wouldn't feel like a new machine.

**D60 — Spin results are a grid (`result[reel][row]`), and paylines are data.** *Rejected: a flat result for one-row machines beside a grid for others* (two shapes, twice the tests). A one-row machine gets one line across row 0, so Old Clunky's data didn't change.

**D61 — Collect & switch: one hamster runs one machine at a time.** (User's pick.) *Rejected: all machines at once with helper hamsters* (a whole new system to balance) *and trading up* (you'd lose the old machine). Switching is free and **allowed mid-spin**, and the old machine's spin still lands and pays. *Rejected: blocking a switch while spinning*: with fast auto-spin it spins ~99% of the time, so the button would almost never work. Machines reset on retiring; the free first machine is always owned, keeping "never stuck" true.

**D62 — EV for several lines is `lines × one-line EV`; the hit rate is counted exactly** by trying every way reels 1 and 2 can land (only they decide a win), cached. Averages add even though lines share cells; the any-line chance doesn't. Needs every symbol's 2-match to pay something. *Rejected: estimating by sampling* (slow, noisy, uses RNG draws).

**D63 — Machine upgrades list the machines that sell them (`"machines": [...]`), with a separate upgrade per machine.** *Rejected: one shared upgrade with a per-machine price multiplier* (a second way to set prices next to rule 3). An upgrade a machine doesn't sell counts as level 0 there, so effects, previews and "start with" traits just work.

**D64 — The Snack Stacker's numbers came from a throwaway bot.** The first draft's upgrades all followed within ~2 minutes and income jumped ~10×. Payouts were softened (~15%) and upgrades made pricier (2,000 / 10,000 × 4ⁿ / 150,000), spreading them over ~7–9 minutes. It still makes long lives much richer (~9× income at 30 min); flagged as a playtest question rather than tuned away, because a new machine *should* feel like a big step.

**D65 — Win tiers on a multi-line machine use the base payouts of all winning lines together; a golden jackpot token is paid per golden full line.** Several small lines in one spin *feel* bigger; per-line tokens keep "a Golden Seed on every reel of a line" the same on every machine.

**D66 — Buying ×10 / Max.** ×10 buys the next 10 levels and is all-or-nothing; Max buys as many as you can afford (when none, it still reports the next price). One `upgradeBought` event with `count`. A bundle is the sum of per-level costs (rule 3 unchanged). *Rejected: ×10 as "as many as possible up to 10"*, since ×10 and Max would then behave the same when you're short.

**D67 — The cage look.** CSS-gradient bars over the wall, a repeating 24×24 bedding tile, a plastic base using `--floor` / `--floor-dark` from the room skin, so old skin tokens kept working. Machine skins still recolour only Old Clunky; the Snack Stacker has its own tokens. The belt and delivery road became clear tubes.

**D68 — Pixel UI frames: 12×12 "9-slice" sprites as CSS `border-image`, repainted in token colours by `js/theme.js`.** *Rejected: CSS clip-path corners* (don't read as pixel art) *and image files* (colours outside `:root`, no build step). **Gotcha:** custom properties inherit, so a paper tile inside the cardboard tray picked up the tray's `--frame`/`--fw`; every framed element now sets its own.

**D69 — Settings: Motion (Auto / Less / Full), Quick reels, Number style (short by default), and the ×1/×10/Max choice**, stored so Reset keeps them. **Quick reels are view only:** reels land by ~45% of the spin, but a spin takes the same game time. *Rejected: actually faster spins*: spin speed is a paid Family Tree trait (Quick Paws), so a free setting would be a power boost.

**D70 — The recent-wins log is view only** (not saved), and the tab title shows the coins. Saving the log would put view data in the save (rule 6).

**D71 — `spin()` now checks the diary when a spin starts, not only when it lands.** A save made mid-spin got "First Spin" on load but not live, so save → load → save didn't round-trip.

**D72 — `schemaVersion` fix.** M4 logged 3 → 4 but data.json still said 3. It's now 5, for the machine and upgrade `machines` fields.

**D73 — Milestone 6 = the user's ten goals, split in two, scoped by a question round.** Rule 8 meant splitting; the user picked **two milestones, pokies first** (M6: denoms, win-more features, machines, balance, upgrades, particles; M7: hats, skin buffs, tree traits), **all four bonus features** (wild, scatter free spins, gamble, jackpot pots), **bets unlocked by an upgrade** (rejected: unlocked by holding coins; all bets open with lower returns), and for M7 **"what you wear gives the buff, hats are a 5th capsule category"** (rejected: a Hat Shop; an "owned = buff" collection bonus). The M7 choice reverses D39/D40 (tokens never buy power). *(Update, D88: after M6 feedback, "Wardrobe buffs" moved to M10 and its tree traits to M8.)*

**D74 — Bets: one global unlock (High Roller), a chosen bet per machine, and a "step down" rule.** Cost and every payout are × bet, so the bet never changes the RTP. *Rejected: a per-machine bet unlock* (a new machine would start at ×1 and earn less than the old one, so buying would feel like a loss). A new machine starts at your current bet. **If the chosen bet is unaffordable, the spin uses the biggest unlocked bet you can afford**, refused only below ×1; *rejected: refusing the spin* (a high bet would silently stall idle auto-spin). Win tiers keep BASE ÷ BASE (D54).

**D75 — The wild uses the real-pokie "best of two readings" rule.** A line is read as leading wilds (the wild's own table) and as the first real symbol with wilds around it; it pays the better **base** payout, then Jackpot Dance applies if that reading covers every reel. Scatters never substitute. *Rejected: "a wild copies the first real symbol; a line of wilds pays as Golden Seeds"*: wild, wild, scatter would pay nothing while wild, wild, seed pays 3 seeds, which reads as unfair. EV stays exact.

**D76 — Scatters and free spins.** `"scatter": true` symbols count anywhere, never on a line; a machine's `freeSpins` or `jackpot` names which scatter starts it. Free spins play **by themselves** on the active machine, cost nothing, keep the winning bet, pay ×2; retriggers add to the batch. Auto-spin's timer stands still meanwhile. *Rejected: free spins that continue on a machine you switched away from* (D61). Their time is in `extraSecondsPerSpin`, so auto profit/s and offline earnings stay exact.

**D77 — Jackpot pots: base units, growth per paid spin, a wheel decided at the trigger and paid after 3 s.** Pots are stored before the bet and payout bonuses (so the bet changes their shown value, like linked jackpots), grow per paid spin (× Pouch Polish), reset to their seed when won. 3+ Cheek Pouches on a **paid** spin start the wheel; the pot is picked by weight at once (like D11). Whatever flows in flows back out, so EV is exact. *Rejected: a hidden "mystery" trigger* (no anticipation) *and pots shared by all machines* (they'd belong to no machine's balance). Retiring waits for the wheel.

**D78 — The gamble: manual wins only, fair, never "earned", never saved.** Offered for 4 s after a win you pulled yourself that didn't start a feature; 50/50 by the game's RNG (not a balance number). **Gamble coins never count toward `coinsEarned`**, or gambling would farm seeds (balance rule 4 checks it). An open gamble is left out of the save: leaving = keeping. *Rejected: gambling auto-spin wins* (a pop-up every second) *and holding the win back until you decide* (every spin would need a "collect" step).

**D79 — Hot Streak is exact too.** The next winning paid spin pays × (1 + perStack × level × min(streak, maxStacks)). The streak doesn't change odds, and P(streak ≥ k) = hᵏ, so the average bonus is closed-form. Free spins neither count nor get it. The streak counts on every machine even without the upgrade (for "On Fire" and stats).

**D80 — The balance pass (from the simulator): a cube-root seed curve, a smaller heirloom bonus, bets capped at ×10, pricier machines.** The first M6 draft (square root, +10% per seed, bets to ×100, Bonanza 400K, Palace 15M) had lives collapse to **~2 minutes** by generation 7, since bets, machines and the heirloom bonus multiply each other. The exponent alone barely helped; capping bets at ×10 plus a cube root made lives lengthen after generation 10; +3% heirloom shrank the mid-game dip; higher machine prices placed the machines. Final: **seeds = floor((lifetime ÷ 1,667)^(1/3))** (keeps 3 seeds at ~45,000 coins, so the first retirement doesn't move), **+3% per seed**, **bets ×1/2/3/5/10**, **High Roller 2,000 × 10ⁿ**, **Bonanza 600,000**, **Palace 100,000,000** (upgrades ×10), **Bouncy Ball +3 spins at 75,000 × 2.2ⁿ** (never bought at +2). Idle lives now run 15–21, 11–14, 9–12 … minutes, dipping to 4–8 when the Palace arrives, then growing. The tree fills in ~1.1–1.4 h; M7 adds traits, so that target is revisited. *(Now M8, see D88.)*

**D81 — `tools/sim.mjs`: the balance simulator is now a real tool.** A headless bot on the real `createGame`: idle or active clicking, a greedy buyer ranking upgrades and machines by Δ(expected income/s) ÷ cost, measured on a **clone** made by a save round-trip. The idle player buys Wheel Training first, the bet is the biggest step leaving 40 spins of bankroll, it retires at max(3, +50% of seeds earned) and plants cheapest-first. Node only, no dependencies (rule 5).

**D82 — A click during a spin is never lost; a gamble offer takes its place.** With Wheel Training maxed the machine is idle only a split second between auto-spins, so clicks were ignored and the gamble almost never appeared. A manual spin asked for mid-spin is now **queued (one, not a pile)** and starts when the spin lands. If the spin you pulled just won, the gamble offer takes the queued spin's place. The queue is an unsaved input buffer. *Rejected: a "stop auto-spin" toggle* (more UI, and idle players would forget it on).

**D83 — Sub-tabs and the Info tab.** The Upgrades tab was getting long and the user asked for "different tabs for upgrades and stuff". One helper (`createSubTabs`) gives Upgrades, Capsules and Info paper sub-tabs; each choice is a setting (`subTabs`). Paytable became **Info** (Paytable, Paylines, Features, Recent wins); **Features** shows every feature's real odds from `getFeatureOdds()` (like D43). *Rejected: more top-level tabs* (four already need scrolling on a phone).

**D84 — Particles on one fixed canvas over the page.** Whole-pixel squares in theme colours, a pool capped at 400, nothing with Motion "Less". Window coordinates, so sparkles can come from a tray tile as well as a reel cell. `Math.random()` is fine (view only; rule 1 is about logic). *Rejected: DOM elements per particle* (hundreds of nodes at 50× speed) *and a canvas only over the stage* (no sparkles on tiles).

**D85 — Sprites for M6, and the palette ran out of letters.** New 24×24 symbols, two machine icons and five 16×16 icons. Every a–z/A–Z letter was taken, so the Pouch Palace's purple ramp uses `8`, `9`, `0` and `+`. Drafts came from a throwaway shape-to-grid script (D50), fixed by hand. "Apple Slice" became "Red Apple" (a whole apple reads better at 48 px).

**D86 — Save v6: the migration only bumps the version.** Every new field has a safe default that `sanitizeState` fills in, and sanitize also cleans junk (bet clamped, pots never below their seed, unknown pots/wheels and free spins on machines without them dropped, `gamble` never loaded). A spin in progress keeps the bet it was paid with.

**D87 — Sampled-EV checks allow 4 standard errors.** Rare huge wins (5 wilds = 150,000 on the Bonanza) make "within 3%" fail by pure luck. The check is now "within max(3%, 4 standard errors)", and the brute-force test (D75) makes the formula itself exact. Rare-event checks (pot EV) test the per-pot claim instead of the total, which a single Grand would swamp.

**D88 — The roadmap after the M6 feedback: M7 Real pokies → M8 The Big Cage → M9 More machines → M10 Wardrobe buffs → M11 Hamster Casino → M12 Your own casino** (then Delivery depth, Port-prep freeze). The first real playtest gave 7 new features, 3 balance asks and 4 changes. Rule 8 means one milestone at a time, so they were grouped by what they touch: everything changing a single spin's economy and feel goes in M7, because later milestones get balanced on top of it (the recommendation, which the user picked). Retiring and prestige is M8. New machines come after luck and unlocks exist. The casino and your own casino are last, as the biggest new systems. The old M7 "Wardrobe buffs" (D73) becomes M10 unchanged, its Family Tree ideas move to M8. Particles and animations are no longer a milestone: each milestone ships its own effects. The order after M7 can be re-picked after each playtest.

**D89 — "New seeds (carrot, sunflower, golden)" = unlockable symbols.** The user explained it as "unlockable symbols: you don't start with them, but you can unlock more, but keep it balanced in some way". Machines start with fewer symbols and an unlock is a one-level machine upgrade. "Balanced" becomes a tested rule: **every unlock raises EV and lowers the hit rate**, which also creates the demand for luck. *Rejected (offered):* prestige seed tiers, a seed garden, a seed shop on the retire page.

**D90 — The luck model: a blank symbol, and every other symbol's weight × (1 + Luck ÷ 100).** Luck = Hamster Luck (a hamster upgrade) + Machine Luck (one per machine). With a blank that luck doesn't touch, luck **raises both the hit rate and the EV**, it is a plain weight change so the exact maths keeps working, and it has built-in diminishing returns. *Rejected:* moving weight from common to rare symbols (lowers the hit rate, DESIGN §13, the opposite of luck); "sticky" reels copying the previous reel (cells stop being independent, breaking EV = lines × one-line EV, D62). The hit-rate `pair()` must learn that a blank pair isn't a hit.

**D91 — The gamble becomes the pokies card gamble** (the user's pick): red/black ×2 at 50%, suit ×4 at 25%, the last 5 cards shown, Take Win. It keeps D78's rules (manual wins only, fair, never earned, never saved). Every card is an independent draw (an endless deck), so the history carries no information, and Info says so. *Rejected (offered):* a gamble ladder, "gamble half", removing the gamble.

**D92 — The win show is view only.** Lines shown one at a time with a WIN meter counting up, looping until the next spin. The payout still happens when the spin ends. To guarantee time to see it, the auto-spin interval gets a floor of spin time + a short rest (data). *Rejected: making the win show take game time like a real credit roll-up* (winning more lines would slow income, and every feature's time maths, `extraSecondsPerSpin` D76, would need it).

**D93 — "Real slog" pacing** (the user's pick from "a bit slower", "steady grind", "real slog"): spins ~3 s, first buy ~2–3 min, Wheel Training ~10 min, first retirement ~1 h, later lives faster. Pillar 2 ("next upgrade within ~30 s") is rewritten for M7. **Constraint:** balance rules 2 and 3 together force base RTP ≥ 1 + auto interval ÷ delivery time, so the slog must come from time and prices, not from spins that lose money; rule 4 (RTP > 100%) stays.

**D94 — Direction for M8 (not built):** the heirloom bonus moves from "per seed ever earned" to **"per seed held"** (bigger per seed), so planting spends a sure bonus for a trait: the user's "a reason to both rebirth and hold heirloom seeds". Additive % within the family group rather than ×, because × per seed compounds and would collapse lives again (D80). Planting only on the full-screen Big Cage page. Machine rebirths ("Rebuild") give permanent Machine Stars. Numbers come from the simulator when M8 is planned in detail.

**D95 — The blank (the Wood Shaving): a symbol flag, `"blank": true`, with no payout table.** It never pays, never makes a pair, a wild can't stand in for it, and it ends a run where it lands, like a scatter (machine.js `endsRun`). Every machine has one. Luck multiplies every weight except the blank's (D90). *Rejected:* "empty" cells with no symbol at all (every view and test would need a special case).

**D96 — Symbol unlocks: `"locked": true` on the symbol + ONE `unlockSymbol` upgrade per machine listing the symbols in the order they open** (level n opens the first n). The locked symbol keeps its real weight in the table; `getSymbols` gives it weight 0 until open. This replaces the idea of reusing `symbolWeight`, because migration and UI must know which symbols are "new seeds" (the Stacker's wild is also weight 0), and the levels still use the one cost formula (rule 3). **Why a fixed order:** a new symbol takes probability from every other and hurts long runs of the most valuable symbols most; with a free order, opening the Carrot after the Golden Seed LOWERED the EV at every Luck level. With a fixed order a test proves every step raises EV and lowers hit rate in every setup. Family weight shifts skip a still-locked symbol. *Rejected:* one upgrade per symbol (the trap above); unlocking by taking weight from the blank (an unlock would RAISE the hit rate, against "new symbols make wins less likely").

**D97 — Luck is an effect type (`luck`, `perLevel`) summed per scope:** global upgrades (later family traits) = **Hamster Luck** (Four-Leaf Clover), machine upgrades = **Machine Luck** (Lucky Horseshoe, Lucky Sprinkles, Lucky Acorn, Lucky Charm). Applied LAST in `getSymbols` (locks, family shifts, wild, then × (1 + Luck/100) on all but the blank), so the exact maths needs no new code. +10 Luck a level, 5 levels each: up to 100 on a machine (the first draft's +5 was too weak, the bot never bought it before ~55 min). Luck is never stored (save v7 needs nothing). *Rejected:* luck as a hit-rate bonus after the roll (the reels would lie about their odds).

**D98 — Paytables for the unlock ladder: flat long runs for common symbols, steep ones for unlocked symbols.** Adding a symbol of weight w scales every other chance by f = T/(T+w), and a run of k by f^k, so a 4-in-a-row keeps only ~60%. For an unlock to raise EV in every setup, the new symbol's 4- and 5-runs must pay a lot and common symbols' long runs little more than pairs (as in real pokies). The 5-reel machines got more blanks (weight 70) for fewer wins (39–47% of spins fresh) and bigger pays.

**D99 — Sampled-EV checks take their allowed error from the EXACT spread of one line.** Steeper M7 paytables made 40,000 Stacker spins come out 4.4 "standard errors" low (rare big wins missing, so the sample's spread looked too small). The test now tries every possible single line of each real machine to get the exact mean (checked to 1e-9) and spread; L lines spread at most L times as much, so the bound is 4 × L × spread ÷ √N. A second brute force checks the fast multi-line hit rate against all 46,656 grids of a toy machine.

**D100 — The simulator buys by "time to afford + time to pay back"** ((cost − coins) ÷ income + cost ÷ income gained), not income gained per coin. With M7 prices the Bonanza had the best income per coin, so the old bot saved 120,000 coins for it for hours and bought nothing else. A person buys the cheap good thing first. This changed every simulator number, so M6's tables aren't comparable with M7's.

**D101 — The slog, first life** (D93): Old Clunky starts with Sunflower Seeds and Wood Shavings only (27.7% hits, RTP 150%), 3-second spins, **100 starting coins** and a **20-coin, 45-second delivery**. Why not fewer coins: at a 28% hit rate the chance to go broke from x coins is about e^(−2μx/σ²); with 40 coins that's ~36% and a delivery worth 2.4 spins fails about half the time, so being broke became a loop. With 100 coins it's ~3%. **Wheel Training** starts at 4.6 s (about ⅔ of clicking speed) and reaches the rest floor (3.8 s) at Lv 4: a 6.5–8 s Wheel 1 halved an idle player's income for half an hour, and rule 2 then forced a delivery worth ~1 spin. Targets: first buy ~2 min for a clicker, Wheel 1 ~10 min idle, first retirement ~45–75 min.

**D102 — Heirloom Seeds go back to a square root** (`seedDivisor` 1,300: 3 seeds = 11,700 coins, about a 60-minute first life), the heirloom bonus drops to **+1.5% per seed**, and **Warm-up Laps costs 1 seed** (gen 2 starts with auto-spin). With M6's cube root each retirement needed 8× the coins of the one before and M7's slower income made lives 2–4 no faster than the first; exponent 0.4 didn't fix late lives. **Known issue for M8:** from generation ~9 lives shrink to 3–10 min; M8 reworks the rebirth economy (held seeds, D94).

**D103 — Machines re-spaced so each fresh machine is ~2–3× the previous one fully upgraded:** Snack Stacker 5,000, Burrow Bonanza 60,000, Pouch Palace 3,000,000, payouts scaled evenly (keeps the unlock ladder's property, D96/D98), upgrade prices to match, the Palace's pots ×6. High Roller costs 3,000 × 15ⁿ. Before this the bot skipped the Stacker and never reached the Palace.

**D104 — The win show is its own view file on real time:** step 1 lights everything while the WIN meter counts (0.5–2.2 s by tier), then each line gets a 1 s turn with a coloured label, then the scatters; it loops, a tap skips to the total, the next spin clears it. Real time so it reads the same at any debug speed; view only, so D92 holds. **Reel clunks now play for every spin** (auto-spin softer): M4 muted them at 1.25 spins/s (D56), but auto-spin is now at most ~0.26 spins/s and hearing each reel land is the point. A dust puff per reel too.

**D105 — The card gamble's prizes are not in data.json:** they're the deck's fair odds (a colour ×2, a suit ×4), like D78's cheeks, so nobody can make it unfair by editing data. `history` and `offerSeconds` (4 → 5) are data. Card history isn't saved. A debug `triggerGamble(stake)` opens an offer without a winning spin (the fairness test needs 40,000 picks). Keys: left red, right black, 1–4 suits, C take the win.

**D106 — Web-first: no engine port** (the user, 2026-09-25). *Rejected: the Godot rebuild (3D / 2.5D pixel art) that D1–D105 were preparing for.* The browser game is the game, shipped from one web codebase: GitHub Pages first, then itch.io, then Steam via Electron or Tauri, maybe mobile via Capacitor. Nothing may depend on a specific engine or platform; platform code goes through the platform layer. This replaced the Godot mapping table, DESIGN §11's "Port-prep freeze" and "Godot rebuild" rows, and the 2.5D look (the final look is open, DESIGN §12).

**D107 — The target stack: TypeScript + Vite, break_eternity.js, Vitest, a platform layer** (the user's rules, AGENTS.md). It replaces rule 5's "no frameworks, no build step, no npm dependencies". Why: types catch mistakes in a big codebase (game.js ~80 KB); Vite gives instant reloads and one static build for every platform; break_eternity.js lets currency pass 1e308; Vitest runs logic tests headless; the platform layer lets Steam and mobile swap storage, lifecycle and achievements. Still true: no UI framework, and any other dependency needs the user's OK.

**D108 — Four docs, and what each records** (the user, 2026-09-25). AGENTS.md = how to work. DESIGN.md = what the game is (source of truth). PORTING_NOTES.md = platform plans plus the logs (Decisions, Balance log, Playtest notes, Prototype history). CHANGELOG.md = what players got. *Rejected: a separate DEVLOG.md* (the user's pick). Git commits carry developer history from now on. `CLAUDE.md` is just `@AGENTS.md`. Hard rules 1–11 kept their numbers, so older decisions ("rule 3") still point right.

**D109 — Versions: 0.1.0 is today's game** (the user's pick over "save 0.1.0 for the first public build"). 0.1.0 (2026-09-25) = milestones 1–7. Patch for fixes, minor for features or content, 1.0.0 for the full public release. The game version is separate from the save format (`SAVE_VERSION`, 7) and data format (`schemaVersion`, 7).

**D110 — The migration plan, and how it stays safe** (approved by the user, 2026-09-25). *Rejected: converting everything in one go* (nothing playable or testable in between).
- **Small steps**, each playable and committed.
- **TypeScript before break_eternity.js**, so the compiler finds every use of coins when their type changes.
- **The golden run**: scripted sessions on fixed seeds, recorded from the plain-JS code, which every step must reproduce to the cent.
- **`play.bat` stays on port 8765**, so the player's local save carries over.
- **data.json is bundled** instead of fetched; `npm run dev` hot-applies edits.
- **Defaults unless the user says otherwise:** the debug panel always in dev but only with `?debug` on the public site; fonts from Fontsource (needs the user's OK, rule 5); numbers past trillions as `1.23e15`; importing a save pays no offline earnings.
- **Git commits use the name "nxt"** and GitHub's private address, so no personal email is published.

**D111 — The tests move to Vitest through a `check()` bridge, and a golden run guards the migration.** *Rejected: rewriting the 687 checks as idiomatic `describe`/`it`/`expect` tests* (the easiest way to change what a test checks without noticing). A one-off script copied every section unchanged into files by area, and `tests/check.js` turns each `check(name, condition)` into a Vitest test (same 1,070 checks, ~10 s instead of ~28 s). The economy printout became `tools/economy.mjs`. The golden run is three sessions (a first life, every machine at max bet, a family with retirements, capsules and skins), 29 checkpoints of full save, RNG position, event counts and coins paid; a one-number change failed every first-life checkpoint. Four checkpoints are also saved as v7 fixtures for the v8 migration test. `tools/golden.mjs` refuses to overwrite the recording without `--confirm`.

**D112 — TypeScript for the logic: types added, not a line of behaviour changed.** TypeScript 7.0.2, **strict**.
- **Two configs.** `tsconfig.logic.json` checks `src/logic` with no DOM, so rule 1 is enforced by the compiler (`Date` and `Math.random` are still guarded by tests and review).
- **`.ts` import extensions and only erasable syntax** (no enums), so Node 24 runs the logic directly for the simulator and tools.
- **Tools and tests stay JavaScript for now** (typing them needs `@types/node`, a new dependency, rule 5: later, with the user's OK).
- **`src/logic/types.ts`** describes data.json (effects as a tagged union), the state/save and every event payload. Where data guarantees something exists, a `!` says so. Save input is typed `Untrusted` (`any`), since it's checked value by value.
- **Proof it's the same game:** the golden run identical, all tests pass, `npm run economy` and the simulator identical JS vs TS, the game played in the browser.

**D113 — TypeScript for the view and boot.** Every file in `src/` is now strict TypeScript. `save.js` was converted too (it holds the `Settings` shape every screen uses), so `src/` is never mixed JS/TS and there is no `allowJs`. Page elements have real types. Loosely typed (`any`) on purpose: the shop's "now → next" preview values, the sound recipes' arguments, and save input (D112). A few behaviour-preserving code edits where a type alone couldn't say it (empty initial reel arrays, `!!free`, `??` defaults for possibly missing values, an early return in the win show). `effectAs` is exported so the view reads effects like the logic; `window.hamster` is typed; the Godot remarks are gone. Checked: all tests, a byte-identical CSS build, every screen in the browser at 375 px.

**D114 — The platform layer: one small interface, synchronous storage.** `src/platform/platform.ts` defines `Platform`: `storage` (`get`/`set`/`remove` text), `lifecycle` (`onHide`/`onShow`/`onClose`), `now()` and `achievements.unlock(id)`; `web.ts` is the web version and `main.ts` does `boot(createWebPlatform())`.
- **Storage is synchronous.** *Rejected: asynchronous (Promise) storage*, though desktop files and Capacitor are async. The game must save the instant the page closes, and sync keeps start-up simple. A slower platform reads everything into memory at start (a save is a few KB) and writes in the background.
- **Storage may throw; `save.ts` catches.** The platform reports failure, and the one place that saves decides what it means. `web.ts` looks `localStorage` up on every call, since some browsers throw on merely reading it when site data is blocked.
- **`save.ts` and `autosave.ts` are shared by every platform**; hide/show/close timing moved out of main.ts into autosave.ts so tests can drive it.
- **The pretend platform (`memory.ts`) lives in `src/`**, so TypeScript checks it against the interface; nothing imports it, so it isn't in the build.
- **Achievements are a no-op**; which Diary stickers become Steam achievements is a design question for when Steam is planned.
- **Not changed:** the storage names (`hamsterSlots.save`, `hamsterSlots.settings`), what's saved, when, or how time away is paid. A test pins the names, since changing one would lose every save.
- Checked with 27 new tests (breaking the code on purpose failed them every time) and in the browser (hide saves, return pays exactly, reload keeps progress, Reset keeps settings).

**D115 — Big numbers: break_eternity.js behind `money.ts`, exact where plain numbers were.** break_eternity.js 2.1.3 (MIT, no dependencies, +56 KB). `Money` is its `Decimal`.
- **The cent-exact promise.** Below 9e15 a Decimal keeps a plain number, so add, subtract, multiply and compare give exactly the plain-number answer. Its divide and power don't (57 ÷ 100 = 0.5700000000000001), so `divide`, `power` and `roundMoney` do plain-number maths whenever the numbers fit and hand over only past that. This keeps the golden run passing unchanged. *Rejected: Decimal's own div/pow everywhere* (a cent of drift here and there, and the golden run couldn't guard the switch).
- **Past 9e15** a Decimal keeps ~12 significant digits, more than any price needs, so `roundMoney` leaves such amounts alone.
- **Reading money from a save is strict.** break_eternity reads almost any text ("12abc" as 12), so `moneyFrom` accepts only the forms a Decimal writes, or a plain number (older saves). Junk, NaN and Infinity give the fallback.
- **On screen:** below 1e15 `formatCoins` writes what it always did; from a quadrillion up "1.23e15" (the D110 default).
- **What is Money:** all three currencies and everything priced in them, in state, save and events. Odds, weights, timers, levels, counts, `rtp` and the paytable's EV per ×1 stay plain numbers. Every calculation kept its order of operations.
- **Save v8:** money saved as text; `migrateSave` v7 → v8 only bumps the version, since `sanitizeState` reads a number or text. *Rejected: converting every field in the migration* (a second list of money fields to keep in step).
- **The golden run stays as recorded (v7)**, comparing saves with money as numbers and without version, so it still demands every cent; a deliberate break (Decimal's divide in `roundMoney`) failed it. Fixtures are one set per save version (`save-v8-*.json` via `node tools/golden.mjs --fixtures`, which never overwrites); each v7 file must migrate to exactly its v8 twin.
- **Tools:** the simulator's bot still does its sums in plain numbers, so output is identical (slower: ~18 s vs ~13 s). The logic costs 0.110 ms a frame at 50× (was 0.098) against 16.7 ms available.
- **Found in the browser, fixed:** the coin counter never quite reached a huge amount (9.99e399 for 1e400), so it now lands once within a billionth; seeds and tokens (`formatWhole`) are written like money from a quadrillion up.

**D116 — Save backup: a one-line save code** (the user's rule "export/import of the save as a text string"). Menu → Save backup.
- **The code is `HS1:` + the save's JSON in base64** (through UTF-8). "HS1" = save code format 1; the save inside keeps its own `saveVersion`, so an old code loads through the migrations. Spaces and line breaks in a pasted code are ignored, and a plain save JSON is accepted too. *Rejected: compressing the code* (a new dependency or async CompressionStream, for codes that already paste fine) and *a file download/upload* (maybe later for desktop).
- **A pasted code is checked as you paste**, each problem in plain words (nothing yet, not a code, damaged or cut short, from a newer game, not readable); a good one shows what it holds.
- **Loading needs two taps** (it replaces the game). The save is stored straight away with today's time and the page restarts from it, and **no offline earnings are paid** for the time since the code was made (D110). If storage is full or blocked the game says so and loads anyway, for this visit.
- **Copy** uses the clipboard; if refused or silent for a second, the code is selected instead ("Selected: now copy it").
- The code logic is platform code (`src/platform/savecode.ts`) built only on the Platform interface; the dialog is `src/view/backup.ts`.

**D117 — Bundled fonts, the debug-panel rule, release 0.2.0** (the end of the migration).
- **Fonts:** `@fontsource/pixelify-sans` and `@fontsource/nunito` 5.3.0 (the user's OK, 2026-09-26: rule 5): exactly the weights style.css used (Pixelify 500, Nunito 600–900), same family names, so style.css didn't change. A browser downloads only ~75 KB. The Google Fonts link is gone: the game makes no request to anyone else. *Rejected: the variable-font packages* (another family name to change in the tokens, for one weight of Pixelify).
- **The debug panel** exists only when `import.meta.env.DEV` or the address has `?debug`; otherwise no panel, key or Menu button. Its code still ships (small; not worth a chunk). `window.hamster` stays: it's a single-player game.
- **Release 0.2.0** (a minor version: the save backup), tagged `v0.2.0` on `main` when merged. Stale "Until migrated" notes and `.js` file names in comments were cleaned up.

**D118 — GitHub Pages: one workflow that tests before it deploys.** `.github/workflows/deploy.yml`, on every push to `main` and by hand.
- **Two jobs.** `test-and-build` (Linux, Node 24, `npm ci`, `npm test`, `npm run build`, upload `dist/`), then `deploy` only if the first passed, so a failing test or type error never reaches players. *Rejected: deploying from a `gh-pages` branch* (a second branch to keep in step, and build output in git).
- **Actions at their newest major versions** (checked 2026-09-26), with only the permissions Pages needs; one deploy at a time, a newer push waits rather than cancelling.
- **Linux differs from Windows:** file names are case-sensitive (all 170 relative imports match) and checkouts use LF (`.gitattributes`; a fresh LF checkout passed everything).
- **`base: './'`** means the build works at any sub-path.
- The user created the public repo `NXT549/hamster-slots` (free Pages needs public; the history holds no personal email) and set Pages → Source = GitHub Actions. **Live since 2026-09-26.**

**D119 — Pays Both Ways, as an upgrade** (the first M7 feedback, 2026-09-27). The user: "issue with 3 slots its based left to right meaning if you get 2 on the right it doesnt count". Left to right is on purpose (D3), so they were asked with numbers: always both ways would take Old Clunky's hit rate from 27.7% to 40.8% and roughly double the 5-reel machines' pay, undoing the slog. They picked **an upgrade per machine** over *both ways always* (full rebalance), *keep left to right and explain it better* and *both ways on Old Clunky only*.
- **The rule:** each line is also scored backwards with the same `evaluate()`, and that win pays on its own (`fromRight: true`). A **full line pays once** (`isFullLine`). The two ends may share cells, as in "pays both ways" pokies. *Rejected: only count a right-hand run that doesn't touch the left one* (fiddlier to explain and make exact, for a rare case).
- **Exact maths:** cells are independent, so a backwards line has the same odds, and EV both ways = EV + (EV − what full lines pay). The hit rate uses `gridHitRate` for each end (4+ reels, ends share no reel) or tries every way reel 2 can land (3 reels). Tested against every line and every grid of toy machines.
- **`requires`** (new optional upgrade field): upgrade ids that must be bought first. Old Clunky's needs the Third Reel (with 2 reels every pair is already a full line). The tile shows "Needs Third Reel" with no buy. *Rejected: hiding it until the Third Reel* (the tile says it exists and what it needs, like a locked symbol).
- **Prices from the simulator:** cheap versions made the bot skip the Snack Stacker and never buy the Pouch Palace, so each costs about the next machine's price or more. The user OK'd them ("sound good to me") and the merge (2026-09-27).
- No save version change (upgrade levels are saved by id); `schemaVersion` 7 → 8. The golden run was re-recorded: only `allMachines` plays differently.

**D120 — M8, The Big Cage: how it's built** (the user's picks, 2026-09-27: rebuild any time once maxed; all four trait groups; on a branch until they've tried it).
- **Held seeds** (D94): the heirloom bonus is `payoutBonusPerSeedHeld` × seeds held (family group, additive). Planting spends seeds and their bonus. *Rejected: × per seed* (compounds, D80).
- **Family Fortune repurposed**, not removed: "+10% payouts for 3 seeds" would lose to holding, so it became `heldSeedBonus` (+0.5% per held seed per level). Saves keep its levels. *Rejected: deleting it and refunding seeds* (a dead end and a migration for nothing).
- **The Big Cage is a state, not just a page:** `state.bigCage` (saved) from `retire()` until `leaveBigCage()`. `canBuyTreeNode` needs it, and `tick()` returns at once while it's set, so time stands still (no spins, deliveries or offline pay) and a save made there loads back there. The logic, not the view, enforces "only there". `openBigCage()` is the debug way in. *Rejected: a view-only overlay* (Warm-up Laps' auto-spin would play under it, and planting would be possible from the console or a stale tab).
- **"Keep" traits are free starting levels:** Seed Vault and Lucky Heirlooms are `startingMachineLevel`, Big Spender is `startingLevel` (High Roller), Snack Inheritance is `startingMachine` (owned, not bought, so `machinesBought` skips it). *Rejected: remembering last life's levels per machine* (more state, and a pup's start would depend on how the last life ended).
- **Luck traits reuse `luck`** (a tree luck effect is Hamster Luck), **Ball Pit reuses `symbolWeight`**, **Golden Pouches** is `potSeedBonus` (pots start and restart at seed × (1 + 0.5 × level); `jackpotStats(…, seedMultiplier)` keeps EV exact).
- **One tree, two homes:** the tree's DOM moves into the Big Cage page while open and back to the Family tab after, so there's one tree to build. A trait's preview is worked out with the seeds planting would spend already gone, so Family Pride shows the payouts you'd really have.

**D121 — M8 balance: what was tried, and the late lives** (numbers in the Balance log and Playtest notes, 2026-09-27).
- Held bonus options 3% / 1.5% / 1% per seed; stars +25% & +5 Luck, +15% & +3, +10% & +2. Chosen: **1.5% and +10% & +2**, the pair that keeps generations 1–8 closest to M7 (+25% stars made gens 6–8 up to twice as fast).
- **Late lives (gen 9+) are still short** (1–13 min idle). Rejected: steeper seed curves (middle lives got longer, gens 10–12 still short) and weaker held seeds (1%: same). By then the family owns everything, so each life is a quick re-run; it needs new content (M9), so the issue stays open (DESIGN §10). *Rejected: tuning the simulator's retire rule to hide it.*

**D122 — Machine Stars** (the user's pick: "max it, rebuild any time").
- A machine can be rebuilt when **every upgrade it sells is maxed**, it isn't busy, and it has fewer than `stars.max` (5). Rebuilding clears its upgrades, then gives back the family's free levels. Stars live in `state.stars` (by machine type), kept through retiring.
- A star multiplies that machine's payouts and adds Machine Luck, so every EV stays exact; deliveries are untouched.
- No cost and no "one per life" limit, as the user picked. *Rejected: star price multipliers on the machine's upgrades* (a second cost curve, against rule 3).
- **v9 save fixtures** are the v8 fixtures loaded and saved again, because the family session plays differently since M8 and "every older save migrates to exactly the current file" must hold.

**D123 — 1.0 before M9: the release plan** (the user, 2026-09-27: "continue developing i want a full release before trying to make the game longer i also really want some cool animations and effects").
- Release prep moved up to right after M8 (DESIGN §11, §23). **1.0 = M1–M8, polished**; M9 and later come as updates. "Full release" read as the full public release, **1.0.0**. *Rejected: 0.3.0.*
- Built on M8's unmerged branch (the user wanted to try M8 first, D120), so one playtest covers both; `1.0.0-rc.1` until the user OKs it.
- **View only:** no rules, balance or save changes; the late lives stay short (D121: release before making the game longer).
- Effects: a celebration module (`celebrate.ts`), sprite particles, CSS; everything obeys Motion "Less".
- Release basics: icons (`tools/icons.mjs`, no new dependency), manifest, link card, version in the Menu, a crash screen, `README.md`. *Rejected for 1.0:* a service worker (a cache that can serve an old version is a new way to break updates), a title screen (an idle game opens onto the cage), credits by name (the user's call), a "what's new" pop-up (the Menu links the CHANGELOG).
- **Released (2026-09-27)** after the user's "looks good keep going"; `main` fast-forwarded, deployed. The tag push was refused (HTTP 403), so the user published the GitHub Release. Friends' v8 saves migrate to v9.

**D124 — Celebrations let taps through** (1.0).
- The celebration covers the cage up to ~5 s and the card gamble's offer lasts 5 s, so a blocking overlay would eat the gamble. The overlay has `pointer-events: none`: taps reach the gamble, reels and machine tags, and any tap on the cage fades it out; a spin you pull fades it too, auto-spins don't. It never covers Spin and Deliver. *Rejected: pausing the gamble timer during a celebration* (a view effect changing game timing, D92), *shorter celebrations when a gamble is offered* (a jackpot count-up would be cut to nothing).

**D125 — M9, More machines: three late-game machines, one mechanic each** (the user's picks, 2026-09-27: all three proposed machines, in the late game; DESIGN §24).
- **Each machine is a data flag plus one small rule**, like free spins and the jackpot wheel: `ways` (the Hamster Maze), `holdSpin` (the Acorn Vault), `wheel` (the Big Cheese), with two new effect types (`extraRespins`, `wheelBonus`). Everything else is existing systems, so a fourth machine of any kind needs only data.
- **Every EV stays exact** (rule 4), so the simulator, previews, economy tables and balance tests run over them too.
- **Placement: late game** (the user's pick), the next rungs of the ladder: 500M · 25B · 2.5T, each fresh machine earning about what the one before earns finished. *Rejected: an early machine between Old Clunky and the Snack Stacker* (offered, not picked), *between the Bonanza and the Palace* (the user wanted them late).

**D126 — Ways, hold & spin and the cheese wheel: how they work**
- **Ways:** a symbol wins from reel 1 through 3+ reels on any row; prize × the number of ways. The wild never lands on reel 1, so it has no prize of its own. The EV is exact (reels are independent). *Rejected: paylines on every row* (the Stacker already does lines; ways is the pokie mechanic the user's "more slot machines" asked for), *Pays Both Ways on the Maze* (a ways win already reads any row).
- **Hold & spin is decided at the start** (like a spin and the jackpot wheel, D92): the whole bonus is rolled at once and stored, a timer plays it out, it pays at the end. Same seed, same bonus; a mid-bonus save loads halfway (save v10). Only on paid spins; never offered to the gamble. *Rejected: rolling each respin as it plays* (view timing would change the RNG, D92).
- Its EV is worked out exactly (trigger chance, a small table over acorns and respins left); the bonus's time is added to seconds per spin so coins per second stay honest.
- **The cheese wheel is rolled at resolve**: each full line picks a wedge and pays × it; the prize wheel animates to it (view only). *Rejected: a wheel that stops the machine like the jackpot wheel* (full lines come often enough that waiting on each would slow auto-spin).

**D127 — M9 balance, and the late lives that are still short** (numbers in the Balance log and Playtest notes, 2026-09-27).
- The user placed the machines late "priced so lives from generation ~9 get longer again". **They don't:** by the time a simulated family can afford them, a life lasts about a minute.
- **Why:** the heirloom bonus is linear in held seeds and late lives earn seeds by the thousand, so it multiplies income 10–10,000× within a few lives; new income only makes that come sooner, so no machine price lengthens lives. *Tried and reverted:* a soft cap on held seeds (late lives 2–3 min, bonus still +15,000% by gen 18), and the same plus Family Fortune capped at 5 levels. Neither is a fix and both change M8's design.
- **This is the user's call** (balance direction). Options put to them: (1) keep it, M12 gives the late game depth; (2) make held seeds pay less and less and re-tune gens 1–8; (3) a second prestige layer later. The simulator's retire rule is not changed to hide it (D121). **The user picked the seed jar** (D128).

**D128 — The seed jar** (the user's pick, 2026-09-27, from four measured options: the seed jar, a hard cap at +100%, keep it, plan a new prestige layer).
- **Held seeds pay +1.5% each up to the jar** (1 = +100%, 67 seeds), and **Family Fortune makes the jar bigger** (+25% a level, cost unchanged, no max). Data without a `seedJar` keeps the old uncapped bonus. No save change.
- **Why a jar:** capped, a life's seed goal outgrows income again, so late lives lengthen; a growing jar keeps plant-or-hold alive past the full tree. Measured (idle): no cap ~1 min from gen 12; hard cap +100%: 5–18 min; the jar: 5–9 min. *Rejected: a hard cap* (extra seeds useless once the tree is full), *a log curve* (still runs away through Family Fortune).
- **The Maze's pays ×1.5** (before M9 ships): a fresh Maze earned 0.62× a finished Palace and the simulated players skipped it; at ×1.5 it's 0.95× and they buy it around gen 12–13. The rest of the ladder was checked and left alone.
- **The golden run** was re-recorded (approved: the user's pick): only the family and moreMachines sessions changed.

**D129 — M10, Wardrobe buffs: how it's built** (the user's picks, 2026-09-27: gentle buffs, 6 hats for Luck, a twist on every Epic, one skin per slot; earlier: "what you wear gives the buff", "hats come from capsules").
- **Worn skins are effects.** Each skin lists its `effects` and `effectsOfType` adds worn skins' at level 1 (scope `wardrobe`), so every rule, preview and EV picks them up with no special cases. New effect types only for what didn't exist. *Rejected: a separate "wardrobe bonus" system* (every rule would have had to ask it, and some would be missed).
- **Fur is its own payout group** (× (1 + fur)): Chubby Cheeks reaches hundreds of %, which would drown a +5%. *Rejected: adding to the family group* (the seed jar caps that group's heirloom part; it would mix two systems).
- Sizes are the user's "gentle": +5/10/20% payouts and offline, 5/10/15% faster or cheaper spins, +3/6/12 Luck; every skin of a slot gives the slot's buff, stronger for rarer, one twist per Epic (tested).
- **Hats are drawn into the hamster sprite**, so every place that draws the hamster wears one with no extra element to keep in step. *Rejected: a hat element layered over the hamster* (hop, breathing and scale would each need to move it).
- **No save change** (an older save wears no hat). **Tokens stay earn-only** (no real money, ever). The capsule pool grows 18 → 24 skins (~151 pulls to complete, from ~110).
- The simulator's bot opens capsules and wears its rarest skin; `--no-capsules` for before/after.

**D130 — 1.1.0: released before the user's own playtest** (the user, 2026-09-27: "i wana push 1.1.0 rn so my friend can play it and let me know what they think").
- 1.1.0 = M9 + the seed jar + the Maze ×1.5 + M10 + the phone paytable fix. The friend's play is the first playtest of all of it.
- The user was told: nobody had played M9/M10; the jar is a nerf only for families past 67 seeds (nobody on 1.0 could be); saves go v9 → v10 and a rollback would drop the new machines and hats, so problems are fixed forward (1.1.1).
- Tag push refused (HTTP 403), so the user publishes the GitHub Release on the "Release 1.1.0" commit.

**D131 — M15, the visual redesign: on the roadmap, then the user's picks** (the user, 2026-09-27: "i want an entire visual redesign", with better upgrades UI because "having to scroll down is a pain", a rebirth animation, and "a separate screen where you spend heirloom seeds and you can only spend those seeds when you rebirth").
- Added as **roadmap row 15** (DESIGN §11) and **§26**. Two asks already exist in some form (M8's Big Cage, D120; 1.0's iris and sprouting traits, D123), so the plan doesn't build them twice.
- **Proposed as view only** (no rules, balance or save changes).
- **Decided (2026-09-27):** still pixel art, "a full cleaner way more user friendly ui for both big and small screens"; the Big Cage and animation "just… more detailed"; "tree only apears when you rebirth" and a rebirth animation of "the hamster planting an heirloom seed and a huge tree shoots up and the rebirth skill tree is branching off the huge tree"; upgrades "something similar to the rebirth, i just want it to fit a bit better"; "build this now" (before M11), so no mock-up round. Built: D132.

**D132 — M15, the visual redesign: how it's built** (DESIGN §26).
- **View only**; `1.2.0-rc.1` until the user OKs it.
- **The layout is a CSS grid the window's height**: side by side from 960 px (or 700 px on its side), stacked below; only the tray's tab scrolls. The tray and cage are CSS size containers, so contents lay out by their own width; `fitRig()` zooms the rig to fit the cage's width and height. *Rejected:* a bottom sheet over the cage (hides the machine, a new gesture), the page scrolling to a docked tray (the user's complaint).
- **Upgrade tiles** are compact with a detail card on a tap, but **the buy button still buys in one tap** (the tree's "tap, then Plant" guards a once-a-life choice; an idle game buys constantly). ×1 / ×10 / Max cycles on tapping the active one. *Rejected: rows* (the user asked for tiles "similar to the rebirth").
- **The Big Cage's tree is painted in code** on a small canvas (`bigtree.ts`) in the sprites' style. *Rejected:* one huge sprite (sprites are fixed small squares, tested), CSS shapes (no pixel look, can't grow branch by branch). Trait placement is pure, tested maths; trait buttons are HTML over the canvas.
- **The rebirth animation is a view-only timeline** (D92): the game already retired. It plays only after a real retirement, a tap skips it, Motion "Less" shows the grown tree.
- **The Family tab lost the tree** (the user's "tree only apears when you rebirth"); it lists planted traits instead.
- **See-through traits** (1.1.0 playtest note, D131): unplantable traits keep solid boxes, only the icon fades.

**D133 — M15: the tree grows with the family** (the user's first look, 2026-09-27: "looks good tree looks a little clunky and goofy tho i only want new rebirth upgrades to appear after you buy the previous one also make the main trunk of the tree grown and reveal new upgrades as you buy the upgrades").
- **Only traits you can plant show** (`isTreeNodeUnlocked`): the game's own rule, so no logic change.
- **Levels instead of rows:** each branch's traits stack in a column, so a trait sits right above the one it needs and the trunk only has to reach higher levels as their traits appear. *Rejected:* keeping rows and growing only branches (the trunk wouldn't grow, as asked); moving traits as the tree grows (a trait you're about to tap would jump).
- **Growing:** `treeShape()` says how big the tree is for the traits that show; bigcage.ts eases the drawn tree towards it (trunk first, then limbs), in the rebirth animation and after a plant. Tested: it never shrinks and always reaches every shown trait.
- **Less clunky:** bare stick branches with a leaf ball read as goofy, so now there's a canopy, a tapered swaying trunk, knots, a grass shadow; the branch signs are gone.

**D134 — 1.2.0: the visual redesign released** (the user, 2026-09-27: "Yeah publish 1.2 I'm on mobile right now").
- 1.2.0 = M15 (D131–D133). View only: nothing migrates, nobody's progress changes. Not checked before release (the user said go): Firefox, Safari, a real phone's touch (the user's phone is the first real check); fixes go out as 1.2.1.
- Tag push refused (HTTP 403); the user publishes the GitHub Release on the "Release 1.2.0" commit.

**D135 — M11, the Hamster Casino: the user's picks** (the user, 2026-09-27: "continue with the project plan", the next roadmap row; AGENTS.md says to plan a new system with the user first).
- Asked four questions. **The user picked:** all four games (Hamster Roulette, Blackjack, Seed Drop, the Hamster Derby) · chips **both** earned by playing and bought with coins · the Prize Counter **all of it** (timed boosts, Luck charms, Hamster Tokens, casino-only cosmetics) · odds with **a small house edge** (others offered: exactly fair, or a player's edge).
- **Chips only ever buy prizes.** With a house edge, chips turning into coins would be a slow coin sink; with a player's edge they'd farm coins and seeds. That keeps the card gamble the only place coins can be bet (still exactly fair, rule 4). Built: D136.

**D136 — M11, the Hamster Casino: how it's built** (DESIGN §27).
- **A logic module per game** (`roulette`, `blackjack`, `derby`, `seeddrop`), each with its **exact** return; **`casino.ts`** holds chips, actions, prizes and boosts and plugs into game.ts through a small host, so game.ts only gains hooks. The games use the game's seeded RNG, so seeds replay.
- **Rules:** a single-zero wheel in real pocket order; blackjack with an endless deck (exact odds), dealer peeks and stands on 17, double down, **no splits** (a second hand on a small table, and +0.5% isn't worth the rules). **Bets are whole multiples of 10 chips** (10–1,000) so every payout is whole chips.
- **The pays are data** (rule 2); tests demand every bet keeps a small house edge (94–99.5% back).
- **A chip's price follows the family's best earnings** (0.5 s of the best machine's auto profit at the biggest bet) and never falls. *Rejected:* a price per spin of the best machine (spin costs are fixed while payouts grow, so chips would get ever cheaper and boosts permanent); the income right now (cheap at each life's start, to hoard).
- **Boosts are effects**, like worn skins (M10): scope `boost`, so every rule picks them up. Golden Hour's payout bonus is a group of its own. Offline earnings and chip prices ignore boosts; boosts count down in play time, charms per paid spin.
- **The view:** the chips counter lags behind each game's show; the roulette wheel is painted pixel by pixel; Seed Drop's seeds are sprites. **On a phone the cage steps aside while the Casino tab is open** (stacked, the tray had ~210 px, too little for any table). *Rejected:* a smaller wheel (1× too small, 1.5× not whole-number), a full-screen casino page like the Big Cage (the tab keeps it one tap away).
- **Casino skins** are ordinary skins with `casino: true`, never in the capsule pool. **Save v11** adds the casino and nine stats; its migration only bumps the version (fixtures from v10's, D122).
- **`casino.enabled: false`** in data.json leaves the casino out, in case a store's simulated-gambling rules need it (DESIGN §11).
- `1.3.0-rc.1` until the user OKs it.

**D137 — 1.3.0: the Hamster Casino released** (the user, 2026-09-27: "Publish 1.3", after asking whether it had been published).
- 1.3.0 = M11 (D135–D136). **Save v11:** older saves migrate (no chips, casino stats 0; a family that retired before can play at once); data schema 12.
- Released without a casino playtest (the user's call); fixes go out as 1.3.x. Not checked: Firefox, Safari, a real phone's touch on the roulette board, how the tables feel and sound.
- Tag push cut off by the git proxy; the user published the GitHub Release `v1.3.0` themselves from GitHub's website, on the docs-only commit after the release commit (same game).

**D138 — 1.3.1 "Nuts & Bolts": the user's upgrades update** (the user, 2026-09-27: "i want a ton of new upgrades and improvements some gated behind rebirths any some way and some not maybe some from achievements just want a big 1.3.1 update of upgrades and add this to the md files that i want names for each update based on what the updates about").
- Built without a question round: the message already said what, how they unlock and the version. The locks are a small data addition (D139) and the Hamster Helper is one Family Tree trait, so it was built on a branch as `1.3.1-rc.1` awaiting the user's OK.
- **The version: 1.3.1, as the user asked.** By the project's rule new content is a minor (1.4.0); the user picked the number, and the release summary pointed this out.
- **"Achievements" = the Hamster Diary's stickers**, which can now unlock an upgrade as well as pay tokens. Built: D139; names: D140.

**D139 — 1.3.1: how it's built** (DESIGN §28).
- **Locks are data:** `"unlock": { "generation": N }` or `{ "sticker": id }`. Rejected: a separate "rebirth shop" and an achievements page. Neither lock can close again, so a locked upgrade is always level 0 and needs no special case; only Machine Stars skip a still-locked machine upgrade.
- **In the shop the locked ones are folded away** (a `<details>`): a first life would otherwise show 9 padlocks under 8 upgrades.
- **No bigger bets.** The draft "Whale Paws" (bets ×25/×50) was swapped for **Hot Sauce** (Hot Streak +2% a win in a row a level), because DESIGN §18 and D80 say bets above ×10 collapsed the late lives to ~2 minutes.
- **Lucky Pennies (a win can pay double) is exact:** one toss per winning paid spin, so lines pay × (1 + chance). No toss at 0 chance, so the RNG runs as before without it. Free spins never double.
- **Three single-machine sticker upgrades are machine upgrades** (Ball Bearings, Acorn Stash, Sharp Cheddar), as the data tests expect.
- **The four new traits go where the tree has room** (two on the trunk, the third of Charms and Bonuses): a new branch would overlap on a 320 px phone, a fourth level on a short screen.
- **The Hamster Helper** (Helping Paws): every second, buys the cheapest upgrade on sale here that costs **at most 10% of your coins**. Rejected: per-upgrade switches (a lot of UI for a first version), buying machines (a big decision), "buy everything" (spends what you're saving). Its switch is saved (save v12, on by default); its levels skip the buy sound and speech.
- `betSteps` stays `[1, 2, 3, 5, 10]`; data schema 13.

**D140 — Every update gets a name** (the user, same message: "i want names for each update based on what the updates about").
- The rule is in AGENTS.md → Git and releases: a short name in package.json `releaseName`, the CHANGELOG heading, the GitHub Release title and the docs; `tests/release.test.js` checks it.
- **Earlier releases were named too:** 0.1.0 First Spin · 0.2.0 New Foundations · 1.0.0 The Big Cage · 1.1.0 Machines & Hats · 1.2.0 A New Look · 1.3.0 The Hamster Casino; 1.3.1 is **Nuts & Bolts**. The user can rename any.

**D141 — 1.3.1 "Nuts & Bolts" released** (the user, 2026-09-27: "push it to github"; asked whether to release, they picked "Publish 1.3.1 now").
- 1.3.1 = DESIGN §28 (D138–D140). **Save v12:** older saves migrate (helper on, two stats at 0, stickers already reached); data schema 13.
- Released without a playtest (the user's call), like 1.3.0. Not checked: Firefox, Safari, a real phone's touch, how the helper and doubled wins feel.
- Tag push cut off again; the user publishes the GitHub Release **"v1.3.1 · Nuts & Bolts"** on the "Release 1.3.1" commit.

**D142 — 1.3.2 "Rest Stop": a pause button for auto-spin** (the user, 2026-09-27, on mobile: "theres no option to pause the hamster"; they asked for "an option to pause that auto spin I want a option to enable and disable auto spin" and "to make it easier to star machines"; placement: "A button next to Spin/Deliver").
- **The gap:** once Wheel Training is bought it fires forever, which gets in the way of saving up for a machine's last upgrade to rebuild it for a star (M8, §22).
- **Scope, from the user's answers:** auto-spin only; deliveries stay (Self-Starter is the safety net) and manual spins still work. Offline earnings pay 0 while paused (my recommendation; the user didn't object).
- **How:** `state.autoPaused` (save v13), gated only where auto-spin fires, in the HUD rate, the shop's "ready in" hints and offline earnings. **`getAutoInterval()` is untouched on purpose**: previews, debug stats, the simulator and the balance rules ask what Wheel Training would do, not whether it's firing. Resets on retire like the bet.
- **The button:** a small ⏸/▶ toggle next to Spin (the user's pick), shown once Wheel Training exists; paused reads like never having bought it (wheel speed, Spin glow, dozing hamster).
- Built as `1.3.2-rc.1`; named "Rest Stop" (Claude's pick, open to renaming). Released: D143.

**D143 — 1.3.2 "Rest Stop" released** (the user, 2026-09-28: "Publish it").
- 1.3.2 = the pause button (D142). **Save v13:** older saves migrate (`autoPaused: false`); data schema unchanged (13).
- Released without a playtest (the user's call); not yet checked on the user's own phone, where the gap was found, so worth a look once live.
- Tag push cut off; the user publishes the GitHub Release **"v1.3.2 · Rest Stop"** on the "Release 1.3.2" commit.

**D144 — 1.4.0 "The Great Migration": the user's late-game update** (the user, 2026-09-27: "Start working on a new update to keep late game interesting like a mega rebirth ... I just want the late game to remain interesting and fun").
- A new system, so it was planned with the user first (AGENTS.md): four questions. **A mega rebirth resets:** "Family, tree & stars" (rejected: only the tree and seeds; everything but the collection). **Opens when:** "Whole tree planted" (rejected: a generation number; a coins total). **Extras:** all four offered (Colony Trials, Automation, an 8th machine, Colony-only traits). **Late lives:** "Make them longer" (rejected: leave them short and add automation only).
- **Version 1.4.0** (new features), release candidate `1.4.0-rc.1` until the user OKs it (released: D148). **Name: "The Great Migration"**. Contents: DESIGN §29; built in D145 (migration), D146 (late lives), D147 (trials, Wise Elders, Moving Day, colony traits).

**D145 — 1.4.0: the Great Migration, how it's built** (DESIGN §29).
- **A colony is state, not a copy of the game:** `state.colony` counts migrations; a migration resets the generation, seeds, tree, Machine Stars, this life, `colonyCoins` and trials beaten, and keeps the rest (the user's pick). Rejected: a separate save slot per colony (nothing would carry over).
- **Golden Whiskers come from the seeds earned this colony:** `floor((seedsEarned ÷ 100) ^ 0.5)`, at least 1, × Whisker Wisdom. A square root like the seeds' own curve: a longer colony pays more, never endlessly more. **Migrating from a life counts its pending seeds**, so the player never has to retire just to migrate. Rejected: whiskers from coins (the colony is about seeds; coins grow by powers of ten late on).
- **Perks are data** (`colony.perks`, priced by rule 3), scope `"colony"`; Colony Pride's payouts are **a group of their own** in `getPayoutMultiplier`, like the wardrobe's and boosts'. Rejected: a second "colony tree" (another page to learn).
- **A migrated family keeps what it unlocked:** rebirth upgrades (§28's `unlock.generation` only counts in the first colony), the casino and the stickers. **A chip's price starts again** with the new colony's earnings (the old best would price chips out of reach for hours).
- **Colony machines and traits are data** (`"colony": 1`); "the whole tree" is every trait this colony can grow, so the next migration needs the colony traits too.
- **Save v14** (D146 has its step); **data schema 14.**

**D146 — 1.4.0: longer late lives, the seed softcap** (the user's "make them longer"; DESIGN §29).
- **Why lives were short:** from generation ~11 a life's income grows ×5–10 over the last, while the bot retires once pending seeds reach half the seeds earned, which on a square root needs only ×2.25 the coins. So lives shrank to 2–4 min idle, 1–3 active.
- **Chosen: a softcap on the seed curve** (`retirement.seedSoftcap = { seeds, exponent }`): below `seeds` as before; past it, extra seeds grow as coins ^ `exponent`. Rejected: a steeper exponent everywhere (slows the right-paced first lives); slowing income instead (the jar, stars and machines would all need new numbers, and the late game would feel smaller); a cap on seeds per life (a wall with no gradient).
- **Seeds come from this colony's coins** (`state.colonyCoins`), so a new colony starts on the steep early part. **An old save's pending seeds don't change:** the v13 → v14 step sets `colonyCoins` to what the new curve needs for the seeds the old one gave.
- **Picked: 100 seeds, exponent 0.2** (seven variants tried). Later caps (300, 1,000) only stretched the last lives and left generations 11–14 at 3–6 min; exponent 0.2 matches their ×5–10 income growth. Idle generations 11–13: 2.5–7.0 → 6.9–10.3 min. The first 8 lives and the time to the whole tree don't change.
- **Past generation ~16 lives climb steeply** (the family owns everything): meant to make the Great Migration the next step (opens at 5.0–5.8 h idle, ~generation 11–12).
- **Open (playtest):** a migrated family's later colonies go much faster and their late lives are short again (colony 2's generations 9–15: 2.5–8 min idle). Levers are data: a weaker or dearer Colony Pride, or a softcap that tightens per colony.

**D147 — 1.4.0: Colony Trials, the Wise Elders, Moving Day, colony traits** (DESIGN §29).
- **Colony Trials:** five twists as data (`noFamily`, `noAuto`, `noStars`, `betCap`, `noWardrobe`). The goal is **a quarter of the seeds earned this colony, at least 5**; **beating it lifts the twist at once** (rejected: the twist for the whole life, which would make a finished trial a wait). Picked in the Big Cage before a life starts; once a colony each. **From a colony's 4th hamster:** earlier hamsters have nothing worth taking away, so a trial would be free whiskers. A tile's "now → next" ignores the twist.
- **The Wise Elders** (a perk): retire when pending seeds reach a share of the colony's seeds earned (25 / 50 / 100 / 200%, at least 3; the player's pick is saved), plant cheap traits (a quarter of seeds held), and start the next life at once. **Like retiring by hand, they may retire mid-spin** (a first draft waited for an idle machine, which a clicking player never has); they wait for free spins, bonuses and gambles, and rest during a trial. **They never migrate:** that's the player's decision. Rejected: auto-migrating, auto-buying perks.
- **Moving Day** (8th machine, `"colony": 1`): **Moving Boxes** is a new mechanic that keeps the EV exact: after the reels roll, every box turns into one symbol picked by the reveal weights (one RNG draw, only when a box landed). **Priced between the Acorn Vault and the Big Cheese** (250B), so a migrated family meets it mid-colony. Boxes land as boxes and pop open after the last reel stops (the result is already decided, D92).
- **Colony traits:** a 4th level on four branches (Moving Boxes, Whisker Wisdom, Pack Leader, Starry Roots), 40–60 seeds a level. Rejected: a new branch (4 columns overlap on a 320 px phone, D139).
- **Six stickers** (57 in all): New Horizons pays 10 tokens; the rest 2–8.

**D148 — 1.4.0 "The Great Migration" released** (the user, 2026-09-28: "publish 1.4").
- 1.4.0 = D144–D147: the Great Migration, Golden Whiskers, perks, Colony Trials, the Wise Elders, Moving Day, colony traits, the seed softcap.
- **Merged with 1.3.2 first.** 1.3.2 "Rest Stop" (D142–D143) shipped on `main` meanwhile and took save v13, so the colony became **save v14** (v12 → v13 is 1.3.2's step, v13 → v14 is 1.4.0's) and 1.4.0's decisions were renumbered D144–D147. The golden run was re-recorded on top of 1.3.2's: old sessions play exactly as recorded, the `migration` session is new. **Data schema 14.**
- Released without a playtest first (the user's call), like 1.3.0–1.3.2. The open question is how fast later colonies go (D146).
- The tag `v1.4.0` is made locally; tag pushes are cut off by the sessions' git proxy, so the user publishes the GitHub Release **"v1.4.0 · The Great Migration"** on the docs-only commit that deployed it, like v1.3.0 and v1.3.1.
- **The first deploy failed** on the golden run on CI's Node 24 (nothing deployed; the site kept 1.3.2): fixed without touching the game (D149), and the next run passed.

**D149 — The golden run plays the same on every Node** (2026-09-28, found by the 1.4.0 deploy).
- **What happened:** `Math.pow` differs in its last bit between Node 22 and 24 (even for whole-number exponents). Floors, cent rounding and small amounts hide it, but the `migration` session fed the game a ~5e14 debug amount, where one last bit is 0.0625 coins, so two checkpoints differed by hundredths of a coin.
- **Chosen:** round the session's debug amounts to 3 significant digits before they go in (sessions.js `seedCoinsToAdd`) and re-record; only the `migration` session changed, the other checkpoints are byte for byte the same.
- **Rejected:** recording on Node 24 only (other Nodes would then fail); a tolerance in `comparable()` (the run promises the cent; a looser test could hide a real change); a pow of our own in money.ts giving the same bits everywhere (the right long-term fix if a real game amount ever shows the difference, but it changes the last bit of every price and payout, so the whole recording would move: plan it with the user).
- **The rule** (AGENTS.md → Testing): a session never feeds the game a power-derived amount without rounding it, and a new recording is checked on Node 24 as well.

**D150 — 1.5.0 "The Glow Up": the direction** (the user, 2026-09-28: "I want you to do a full visual redesign of the game ... a massive improvement in graphics/visuals better animations more detail everything"; DESIGN §30).
- **Chosen: still pixel art, with far more detail and motion ("HD pixel art").** Pixel art is the game's identity, and for M15 the user picked "still pixel art" (D131). What was CSS boxes and gradients (wire, wall, bedding, tray, wheel, machines) is painted as pixel art, the hamster and symbols get bigger sprites, and animation is everywhere.
- **Built without asking first**, unlike M15 (D131): the request was explicit, it's view only, the one real choice had the user's own answer from M15, and it's a release candidate on a branch.
- **Rejected:** a smooth vector or "HD painted" look (a different game); WebGL such as PixiJS (a new dependency, rule 5); more CSS (can't give pixel-art texture, shading or outlines).

**D151 — The Glow Up: painted scenes** (how it's built).
- **One shared painter, `paint.ts`** (pixmap, shaded masks, ramps, outlines, dithering, colours from theme tokens), modelled on the Big Cage's tree.
- **`cage.ts`: the stage is one painting behind the DOM parts,** a **perspective cage** instead of flat bars (depth was what the flat stage lacked). The sky is a separate layer seen through holes so clouds can drift in CSS while **the painting is only redrawn when something changes**; the night room (free spins) is a second painting faded in with CSS opacity. Rejected: painting every frame, SVG (not pixel art).
- **`cabinet.ts`:** each cabinet is painted to fit its machine (size measured from the DOM, repainted on resize, switch or skin); the bulbs are a second canvas redrawn only when a bulb changes. Colours are tokens, so skins still recolour Old Clunky.
- **`wheel.ts`:** repainted every frame at its angle at 1 painted pixel per 2 screen pixels, so rungs stay square pixels (a CSS-rotated picture would smear them); cheap.
- Tests: every token the painters read is in `:root`; `cageLayout()` keeps the room's parts on the back wall at five sizes.

**D152 — The Glow Up: bigger sprites, and a pixel font of our own.**
- **The hamster and the 14 reel symbols are 32×32** (drawn at 2×), everything else stays 24/16/12. *Why:* 24 px had no room for the detail asked for; 32 at 2× still fits a 72 px reel cell. **Five-step ramps** need more colours than the palette's letters, so deep shades use punctuation marks; fur skins work out `%` themselves.
- **The hamster has frames:** standing, a four-step run (step time follows the wheel), blink, asleep, cheering; hats follow the head bob (`HAMSTER_BOB`).
- **A pixel font of our own for the big titles** (`pixelfont.ts`): the browser draws Pixelify Sans smoothed at every size from 8 to 40 px, so a canvas title can't be crisp with it. Each letter is its own canvas (the wave still works), coloured like metal from tokens. The logo uses it too; the celebration's amount stays in Nunito (rule 11).

**D153 — The Glow Up: keeping it quick.**
- Measured in headless Chromium without a graphics card (the worst case), free spins with auto-spin: **1.4.0: 56 fps · first 1.5.0 build: 38–42 · 1.5.0-rc.1: 54.** The cost was the free-spins glow (an animated CSS `drop-shadow` filter on a machine whose reels move every frame: −11) and a `fixed` page background (−3).
- **Chosen:** paint the glow on the cabinet's bulbs canvas (a few steps a second), drop the title's drop-shadow filter, let the page background scroll. *Rejected:* dropping the glow (the user asked for more, not less).

**D154 — The Glow Up: the version and the name.**
- **1.5.0**, a minor version (new look, no new content, like 1.2.0), as **1.5.0-rc.1** until the user OKs it (D155). **Name: "The Glow Up"**; the user can rename it. View only: golden run, fixtures and simulator untouched, nobody's progress changes. Icons and the link card picture are redrawn from the new art.

**D155 — 1.5.0 "The Glow Up" released** (the user, 2026-09-28: "Publish the new update").
- 1.5.0 = the second visual redesign (D150–D154, DESIGN §30). View only: save v14, data schema 14.
- Released after the user saw screenshots, without a playtest first (the user's call), like 1.3.0–1.4.0; not yet checked on a real phone, Firefox or Safari. DESIGN §30's questions are the ones to answer. Tests were also run on Node 24 before the push (D149).
- The tag `v1.5.0` is made locally; tag pushes are cut off by the git proxy, so the user publishes the GitHub Release **"v1.5.0 · The Glow Up"** on the "Release 1.5.0" commit (`bb98c2d`). The deploy passed and the live files match the local build.

**D156 — A full UI redesign: planned, and the user's picks** (the user, 2026-09-29: "Make a full plan to redesign the full UI"; DESIGN §31).
- **Asked first, unlike 1.5.0 (D150):** "the full UI" could mean a new skin, a new layout, or both. **The user's picks:** **restyle + restructure** (over restyle only, or usability only); **the hamster's room** look: painted wood, paper and brass (over a cardboard toy box, an arcade machine, or clean and bold); extras **a first-time guide** and **UI sounds** (not keyboard shortcuts, nor text-size and colour options); **"plan into docs only"**.
- **Written down as DESIGN §31 and a roadmap row, like M15's plan (D131).** Nothing is built until the user asks; then a branch and 1.6.0-rc.1, with a stop for the user's OK on the look after the Upgrades tab (part 3 of 9).
- **Why restructure too:** measurements showed a 390×844 phone's tray tab only 296 px tall (2 of 22 tiles in view), over half the buttons under 44 px, text down to 9 px, five tabs overflowing at 360 px, and a 5-reel WIN meter 8 px tall. The code had no shared pieces (six copies of the two-tap confirm, four of the buy button …) and seven small bugs.
- **Chosen:** one kit of plain TypeScript factories for every screen; painted frames from tokens, once at startup; only the open tab renders; the guide works its steps out from lifetime stats (no save change; its switch and the UI sounds' are settings); on a phone the main tabs go to a bottom bar and the detail card becomes a sheet *inside* the tray.
- **Rejected:** a UI framework or WebGL/PixiJS (rule 5); a sheet over the cage (hides the machine, D132); more or merged top-level tabs (five already crowd a phone, D83); machine switching in a menu (must stay one tap, §12); canvas text for every word (screen readers, weight); guide progress in the save (a save change for a view feature); a full-screen casino page (D136); a title screen or "what's new" pop-up (D123).
- **Name: "New Digs"**, as **1.6.0** (minor, like 1.2.0 and 1.5.0); the user can rename it.

**D157 — Building 1.6.0 "New Digs": part 1, the foundations** (the user, 2026-10-02: "i want you to implement the new plan ...", then "build it"; DESIGN §31).
- **Built as planned (D156):** branch, **1.6.0-rc.1**, part by part; parts 1–3, then the stop for the user's OK on the look.
- **The stylesheet is split into `src/view/styles/`** (one file per part, `@import`ed by style.css, which keeps the first `:root` block that tests read). Rules moved unchanged; kit.css must come before any file that tints a frame. Rejected: one stylesheet per screen linked from index.html (more requests, cascade order depends on the HTML); importing CSS from TypeScript (the token file must stay plain CSS for the tests).
- **Frames are painted from profiles** (`frames.ts`): four colours per edge plus a corner style, so every edge's middle is uniform **by construction** (what 9-slice needs; tested). Painted once at startup into `--fr-*`/`--tx-*`, so skins reach them. Rejected: ~40 more 12×12 text sprites in art.ts (no token colours without a recolour map each); CSS gradients and shadows (not pixel art; D150).
- **The kit is plain factories** (`kit.ts`: build DOM once, `update()` writes only what changed): the two-tap rule is a pure `createArm()`, lists are kept by key, `createSubTabs` became real tabs for screen readers. UI sounds go through a hook (`uiSound`) part 8 plugs in. Rejected: a UI framework or web components (rule 5).
- **One breakpoint** (`layout.ts`), with a test that every CSS copy matches; the rig's fit maths moved there as pure functions.
- **Fixed on the way:** the Rebuild card's gold frame never drew (not in the framed list); `.line-label` was styled by two files for two meanings (the captions are `.payline-caption` now); frames at in-between scales are whole scales now; dead rules, markup and tokens removed.

**D158 — 1.6.0 part 2: the shell** (DESIGN §31; choices made on the way).
- **The main tabs are a grid area of their own** (brass plates on the tray's top, or a bar at the bottom of a phone). Rejected: a second set of tab buttons for the phone (two copies to keep in step).
- **The materials switch over in one place:** theme.ts points the old frame variables at frames.ts's paintings, so screens not rebuilt yet wear wood, paper, brass and enamel now and get new layouts in their own parts. Rejected: restyling each screen only in its part (half old, half new for six parts).
- **The HUD and control deck are modules** (`hud.ts`, `deck.ts`) built from kit pieces; they only read state and call actions; keys unchanged. **The auto-spin pause is a brass lever** (`aria-pressed`), replacing ⏸/▶.
- **The sheet lives inside the tray** (up to 260 px on a short tray; a long note fades at its bottom edge); switching tab closes it.
- **A short phone keeps a third for the tray:** the cage may take up to 44% of the screen's height but the tray never gets under 32%; a 64 px deck, 60 px tab bar, coins' rate beside the number.
- **The card gamble left the zoomed rig** (it drew at half size on a phone) for the cage's wall, centred on the reels. Rejected: letting it cover the deck on a phone (a tap on Spin while a gamble is offered takes the win and spins; covering Spin would put the picks under your thumb).
- **The machine's signs never cover the machine:** the rig keeps below them when they reach over it; phones get slimmer, icon-only signs.
- **Labels stay readable:** payline tags, pot plaques, the WIN meter, the line label and the machine's sign grow back against the zoom (min 12 px on screen); the bubble's words stay 12 px.
- **Only the open tab renders;** closed tabs' dots update 4 times a second. **Pins** (Colony Trial, casino boosts) are tappable for a note.
- **Found on the way:** particles from off-screen elements burst at the page's corner (skipped now); **the built game's minifier turns `border-image: none` into an empty value**, so the phone's tab bar lost its frames in the built game only (fixed with `border-image-source: none`; a test bans the shorthand). The hamster's lines also go to a polite live region.

**D159 — 1.6.0 part 3: the Upgrades tab** (DESIGN §31), then **the stop** for the user's OK on the look.
- **Rows, not cards:** one row per upgrade (icon, name and level, "now → next", pips, a 44 px buy button), one column even on a computer, nothing under 12 px: three rows in view on a phone, seven or eight on a computer. Rejected: M15's two columns of small paper tiles (two in view on a phone, level at 10.5 px).
- **The whole tile opens its sheet**, while its buy button still buys in one tap (D132).
- **Kept by id** (`keyedList`): switching machines or an unlock reuses tiles (no lost scroll or focus).
- **Previews 4 times a second** and only for the open tab (the old tab worked out every tile's exact EV every frame). Throttled CPU 4×/6×: **54 and 32 fps, against 1.5.0's 32 and 19.**
- **The bar** holds the Helper's switch (or a hint) beside ×1/×10/Max; narrow trays get slimmer buttons and icon-only sub-tabs except the open one.
- **Lock words:** "Opens with your 4th hamster" or "Earn the On Fire sticker" on the tile, the full sentence in the sheet; the padlock is a sprite.
- **Machines** are catalogue pages; **the workshop ticket** uses the kit's two-tap button.
- **The speech bubble sits over the signs:** the rig sits above them so the hamster's words are never hidden; its empty space lets taps through, so signs still switch machines.
- **The tab's dot** shows when something new comes within reach while you're elsewhere. Rejected: a dot whenever anything is affordable (it would hardly ever go off).

**D160 — 1.6.0 "New Digs" released, with parts 1–3** (the user, 2026-10-03, after the screenshots at the stop: "that looks good publish it").
- **Chosen:** publish what was built, now, as **1.6.0 "New Digs"**: parts 1–3 of DESIGN §31 (D157–D159). Screens not rebuilt yet wear the new materials in their old layouts, and every part left the game playable. **Parts 4–9** (Family, Capsules and Info, Casino, Menu and dialogs, the guide and UI sounds, polish) stay planned for later updates, built when the user asks. *Rejected:* holding the release until all nine parts are done (the plan's stop was for the look, and it passed).
- View only: save v14, data schema 14; golden run and fixtures untouched. The plan's two new settings (`uiSounds`, `guide`) come with part 8, not in 1.6.0.
- Released after the user saw screenshots, without a playtest first (the user's call), like 1.3.0–1.5.0; not yet checked on a real phone, Firefox or Safari. DESIGN §31's questions are the ones to answer. Tests were also run on Node 24 (D149).
- The tag `v1.6.0` is made locally; tag pushes are cut off by the git proxy, so the user publishes the GitHub Release **"v1.6.0 · New Digs"** on the "Release 1.6.0" commit (`6558459`). The deploy passed and the live files match the local build.

**D161 — Machine skins paint every machine, and five new ones ("Fresh Coat", for 1.6.1)** (the user, 2026-10-03: "add new skins since skins currently only work on the first slot machine", then "All together" on the plan's question).
- **Chosen:** a machine skin sets one paint (`--paint`, `--paint-dark`, `--paint-light`; cabinet.ts `painted()` swaps it in for every cabinet's body tokens), plus `--paint-marquee` for every sign. Each machine keeps its shape and own details (grass, rind, tape, gold). Five new skins (2 Common, 2 Rare, 1 Epic) with the usual machine buffs; the Epic, Arcade Neon, gets a 5% double-win twist (the Lucky Pennies effect, so the EV stays exact). The old skins are renamed "… Paint" (ids kept, so saves don't change). *Rejected:* hand-picked colours per machine per skin (9 skins × 8 machines to keep in step); tinting each machine's own colours towards the skin (dark skins turned the cheese olive); setting the family tokens themselves on the stage (the Big Cheese's wheel and other UI read them too).
- No save change. The golden run was re-recorded: its capsule pulls now draw from 29 skins (an approved content change). Collecting every capsule skin takes ~194 pulls (was ~151).
- Released as **1.6.1 "Fresh Coat"** (the user's "aprove all", 2026-10-03), without a playtest, like 1.3.0–1.6.0. Tags can't be pushed, so the user publishes the GitHub Release **"v1.6.1 · Fresh Coat"** on the "Release 1.6.1" commit.


**D162 — New Digs part 4: the Family tab, Colony and the Big Cage's panels on the kit, released as 1.7.0 "Family Room"** (2026-10-03, the user picked "Family redesign" as the next update, then "continue", then approved shipping it after screenshots: "aprove all"; DESIGN §31, plan `docs/updates/ui-4-family.md`).
- **Chosen:** the Family tab moves out of ui.ts into `family.ts`: a retire letter (a `card` with the pup's portrait, "Retire now: +N Heirloom Seeds", bonus now → after, a gauge to the next seed, a `confirmButton` in place of `retireArmed`'s timer, what resets in a `more()` fold); planted traits as chips that open the tray's sheet (was a hover tooltip). `colony.ts` is rebuilt: the migration card, perks as `tile`s with a sheet (bought like upgrades), the Wise Elders as `toggle`s and a `segmented`, trials as `listRow`s. The Big Cage's numbers are `statTile`s on a wooden sign; the trait card is the kit's sheet rising over the lower meadow while the tree slides up so the trait stays in view; the trial picker is a `segmented`; Start an `xl` button; the migration a `confirmButton`.
- **Choices inside it:** the Big Cage no longer picks a trait by itself except on a first family's first visit with nothing planted (so the first plant is one tap away); otherwise the meadow stays clear until you tap. *Rejected:* always opening the first buyable trait (the sheet hid half the tree every visit). The trial picker has no icons (the trials have no sprites; drawing five is art work for part 9). The panel under the meadow scrolls when it doesn't fit (a phone on its side) with Start pinned in sight; Start is smaller below 700 px tall. Switching Family ↔ Colony starts the sub-tab at its top. The 9.5 px and 10.5 px labels are gone.
- View only: save v14, data schema 14; golden run, fixtures and simulator untouched. New test: the perk tiles' saving → ready → maxed and price follow the game (`shop.test.js`).
- Checked in Chromium at 390×844, 360×640, 844×390 and 1280×800: a retirement, planting, a trait's sheet, the Colony, a migration and a trial, no console errors. Not checked: a real phone, Firefox, Safari.
- **Released** as 1.7.0 "Family Room" (a minor version, a name picked for the family screens in the hamster's room; the user can rename it), after 1.6.1. Tag pushes are refused (403), so the user publishes the GitHub Release **"v1.7.0 · Family Room"** on the "Release 1.7.0" commit.

**D163 — Balancing pass: later colonies, a dearer tree per colony, released as 1.7.1 "Settling In"** (the user picked "dearer tree" on 2026-10-03; DESIGN §29 → Balance; plan and every variant in docs/updates/balancing.md).
- **Problem:** after a Great Migration every colony was faster than the last, with late lives of 1–6 min (colony 2 lasted ~2 h idle, ~1.3 h active).
- **Finding:** players, the bot and the Wise Elders retire when pending seeds reach a *share* of the seeds earned, so a multiplier on coins or on `seedDivisor` cancels out (×2/×3/×5 per colony: no change). A softcap that tightens per colony (seeds ×0.5/×0.25, exponent ×0.75…×0.5) left the short lives and added a wall at the colony's end. A weaker Colony Pride alone helped a little. What sets a life's length is how fast the family's power climbs between lives, and a migrated family climbed ~10× a life by replanting the tree with its flood of seeds.
- **Chosen:** `familyTree.costPerColony` 3 (a trait costs rule 3's price × 3^colony; rule 3's formula is unchanged, the colony only scales it) and Colony Pride +50% → +30% a level. Colony 2 now 3.5–4.8 h idle, 3.1–4.5 active, late lives 5–8 min; colony 1 untouched. Rejected: ×4 (colony 2 longer than colony 1, losing the migration's reward), ×2.5 + Pride 0.35 and ×3 + Pride growth 2.0 (similar, shorter colony 2 or shorter colony 3).
- **Open:** colony 3's middle lives stay 2–5 min (more whiskers from the longer colony 2). The casino boosts weren't re-measured on top (§27's "up to a third" may still hold). No save change: planted traits stay; only the next ones cost more.


**D164 — M12, the Family Casino, released as 1.8.0 "Grand Opening"** (2026-10-03; the project was set up to "begin roadmap 12", then the user left every call to Claude: "you decide everything based on the current and future state of the game"; DESIGN §32, plan `docs/updates/m12-own-casino.md`).
- **Chosen:** opens in the first life after the first Great Migration; its own currency (Takings) for its own cabinets and floor upgrades, plus Chip Crates and Token Boxes at growing rule-3 prices; a small idle layer (8 cabinets, 5 upgrades, 2 back-office buys) with one chore, a till that holds 2 h (up to 12 h) of takings; a sub-tab of the Casino tab; kept through retirements and migrations; `ownCasino.enabled` (and `casino.enabled`) leave it out of a build. Guests play below 100% (92–95%, the Floor Manager trims to 88% at most), so rule 4's >100% for the player stays and the "house edge" is real; takings are an exact average (bet × edge ÷ (spin time + 2 s rest) × guests), so play and away share one formula and the RNG is never touched.
- **Why no coins:** the open problem is short late lives (§10, §29, D163). Takings that paid coins or counted as earned would be a seed farm on top; Golden Whiskers would feed Colony Pride, which D163 just had to rein in. So the casino's power stays inside itself, and its links out (chips for boosts, tokens for capsules) are things the game already measures, priced to grow.
- **Rejected:** a full page like the Big Cage (that page exists because time stands still there; the Casino tab's redesign, §31 part 6, will restyle the sub-tab with the rest); random guests (offline would need a second formula); unlocking at a generation (before the migration the family still has the tree to grow); a full management game with events and rooms (a second game in the tray); paying a small capped coin bonus (even +25% payouts shortens every life by about a fifth).
- **Save v15** (`ownCasino`, three stats), data schema 15, three stickers (60). The golden run was re-recorded: only saves gained the new fields, and the migration session's colony checkpoints gained the Grand Opening sticker's 3 tokens (which also earned Sticker Book a little earlier, so a few later amounts moved); same recording on Node 22 and 24. New sim option `--owncasino [minutes]`. Checked in Chromium at 390×844, 1280×2200 and 844×390, no console errors; not checked on a real phone, Firefox or Safari.
- **Released** as 1.8.0 "Grand Opening" (a minor version: a new system) at the user's "publish it", before a playtest. Tag pushes are refused (403), so the user publishes the GitHub Release **"v1.8.0 · Grand Opening"** on the "Release 1.8.0" commit.
- **1.8.1** (same day, a fix-only patch keeping the theme): the purse showed Takings unrounded ("15.21415999999927"). The purse now writes them with `formatAmount` and `formatWhole` floors any fraction. Chosen over rounding the stored Takings: their fractions keep the till's averages exact (rule 4), and "can I afford it" already compares the real value. No save change. GitHub Release **"v1.8.1 · Grand Opening"** on the "Release 1.8.1" commit.

**D165 — New Digs part 8 (the first-time guide and UI sounds) with unlock moments, released as 1.9.0 "Welcome Mat"** (2026-10-03; the user: "I want new animations for unlocking things as well as a tutorial", with the design left to Claude; DESIGN §31, plan `docs/updates/ui-8-guide-sounds.md`).
- **Chosen:** the tutorial *is* part 8's guide, built as planned (steps from the game's state, no save change; `guideStep()` pure and tested), plus a Start step after Plant on the first Big Cage visit, a rest for the steps you may put off (first upgrade, auto-spin, retire) after the paw has pointed at them a while, and "Skip guide" as a link on the hamster's line. Unlock moments: **one padlock animation** (`unlock.ts`) for everything that appears (tabs, purse counters, sub-tabs, machine signs, upgrade tiles that leave the Locked drawer or stop needing another, colony machines), which waits until its target can be seen and nothing big is playing; and **a small celebration** ("NEW SYMBOL!", "NEW MACHINE!") for the two unlocks that change the reels. Pieces report themselves through a kit hook (`appeared()`), like `uiSound()`, so later screens get it for free.
- **Rejected:** a separate tutorial with its own screens or a forced walkthrough (D123: no pop-ups over the game; the guide only points); a step list saved in the save (a save change for something the stats already know); a different animation per kind of unlock (more code, and one shared look teaches players what a padlock means); a celebration for every unlock (they'd stack and cover the machine; the padlock is small and quick).
- **Settings** `uiSounds` and `guide` (both on; older settings gain them). No logic, data, balance or save change: the golden run and fixtures are untouched. Checked in Chromium at 390×844 and 1280×800 (a fresh game through Spin, the first upgrade, a new symbol, the Family tab's padlock, a new machine, retiring and the Big Cage) and with Motion "Less", no console errors; the sounds can't be heard in a test browser, so the user listens.
- **Released** as 1.9.0 "Welcome Mat" at the user's "publish it", before a playtest. Tag pushes are refused (403), so the user publishes the GitHub Release **"v1.9.0 · Welcome Mat"** on the "Release 1.9.0" commit.

**D166 — QoL: stats in sections, the Diary nearest-first, Recent wins kept between visits** (2026-10-03; the user asked for QoL ideas and approved this batch: "tell qol yes"; DESIGN §17).
- **Chosen:** Stats built by `statSections()` (`src/view/stats.ts`, pure, tested) in sections with *This life* first; every `Stats` field shown, and a test fails if a new one isn't. The Diary's rows are moved (not rebuilt) into nearest-first order, finished ones in a `<details>` fold (`diaryOrder()` in capsules.ts). Recent wins are written as text to a third storage key, `hamsterSlots.recentWins` (save.ts `loadWinLog`/`saveWinLog`), on every logged win, with real-world time (`platform.now()`) so "3 min ago" survives a reload; `clearSave` and loading a backup code clear it.
- **Rejected:** Recent wins in the save (a save-version bump for something that's only for looking back, and the golden run and fixtures would change); writing the log only on autosave (ten short rows are cheap to write, and it'd lose the last wins on a crash); hiding finished stickers entirely (some players like ticking them off).
- No logic, data, balance or save change: the golden run and fixtures are untouched.

---

## Balance log

Every `data.json` change: date · value · old → new · why.

| Date | Value | Old → New | Why |
|---|---|---|---|
| 2026-09-23 | *(initial values)* | — | Starting guesses (DESIGN §3–5). Start 25 coins, spin 5, weights 55/30/15, delivery 30 s → 15, Cheeks 50×1.15ⁿ, Wheel 100×1.25ⁿ, Lever 75×1.3ⁿ, Third Reel 1,000. |
| 2026-09-23 | `schemaVersion` | 1 → 14 over the log | Bumps (v2 retirement/familyTree; v3 tokens/capsules/skins/diary; v4 winTiers/offline, logged but never changed the file, D72; v5 machine `unlockCost`/`rows`/`paylines`; v6 bets/gamble/scatter/wild/freeSpins/jackpot; v7 blank/locked, `luck`, `unlockSymbol`, `autoSpin.rest`; v8 `bothWays`, `requires`; v9 M8 effects, `stars`; v10 M9 ways/holdSpin/wheel, `seedJar`; v11 M10 skin `effects`, `hat`; v12 M11 `casino`; v13 1.3.1 upgrade `unlock` + new effect types; v14 1.4.0 `colony`, `seedSoftcap`, machine `colony`/`mystery`). |
| 2026-09-23 → 09-27 | `retirement` seed curve | seedDivisor — → 5,000 → 1,667 → **1,300** · seedExponent — → 0.5 → 1/3 (written as 0.3333333333333333: 0.3333333 rounds an exact cube like 27 down a seed) → **0.5** · bonus 0.10 per seed earned → 0.03 → **0.015** (D28, D80, D102) | 5,000 chosen over 1,000 (Family tab in minute 1) and 10,000 (first retirement ~23 min). The cube-root detour was a try at slowing mid-game; 1,300 / sqrt makes 3 seeds = 11,700 coins ≈ a 60-min first life, later lives 30–45 min then shorter. 0.10 per seed fed back too hard once bets and bigger machines arrived (lives 2–5 min); 0.015 keeps lives 5–14 min. |
| 2026-09-27 | `payoutBonusPerSeedEarned` → `payoutBonusPerSeedHeld` | 0.015 per seed earned → **0.015 per seed held** | M8 (D120): planting spends a seed's bonus. Tried 0.03 (gens 6–8 faster, late lives +5,000%) and 0.01 (no better); 0.015 keeps gens 1–8 closest to M7 (D121). |
| 2026-09-23 | Family Tree costs (first tree) | — → Pride 1 · Fortune 3×1.5ⁿ · Luck 2/4/8 · Speed 2/4/8 · Delivery 1/2/3 (38 seeds); Warm-up Laps 2 → **1** (09-25, D102; tree 37) | First retirement (3 seeds) buys the root plus one tier-1 trait; with Warm-up at 1, gen 2 starts with auto-spin. Delivery cheaper as quality of life. |
| 2026-09-23 | Family Tree effects | — → Pride +25% · Fortune +10%/lvl · Whiskers/Carrot Patch (5 weight to golden/carrot) · Jackpot Dance ×1.5 full line · Warm-up Wheel Lv 1 · Quick Paws ×0.8 · Heirloom Reel · Scooter ×0.6 · Backpack · Self-Starter | Starting guesses. Luck traits take Old Clunky 3-reel RTP 275% → 441%; rule 2 holds with the whole tree. |
| 2026-09-23 | Hamster Tokens | — → golden jackpot 1 · every 5th delivery 1 · retiring 3 · diary stickers 1–5 | First five stickers pay exactly one pull (10), so Capsules appear at ~3–6 min. |
| 2026-09-23 | Capsules | — → pull 10 · Common 70 / Rare 25 / Epic 5 · Epic pity 20 · refunds 2/4/8 · 9 common / 5 rare / 4 epic | Starting guesses. Real Epic rate with pity ~7.8%; full collection ~110 pulls. |
| 2026-09-24 | `winTiers` | — → nice 10× · big 20× · jackpot 100× (base payout ÷ base spin cost) | A celebration about every 20 spins on Old Clunky; the common Sunflower line stays a plain win. |
| 2026-09-24 | `offline` | — → min 60 s · max 7,200 s · efficiency 0.5 | Idle-game default; playing actively still earns twice as much. |
| 2026-09-24 | Snack Stacker (new) | — → unlock 7,500 (later 5,000) · 3 reels (max 4) · 3 rows · 5 paylines (start 3) · spin 25 / 0.8 s · 5 symbols, payouts 2/3/4 · RTP 162% (3 reels, 3 lines) → 380% (4 reels, 5 lines) | Bought at 13.5–19.7 min idle, about when the first retirement is ready. First draft's pays reached 490% and ~10× income, so softened (D64). |
| 2026-09-24 | Snack Stacker upgrades | — → Smooth Gears 2,000 × 1.3ⁿ (max 8, spin ×0.9) · Extra Paylines 10,000 × 4ⁿ (max 2) · Fourth Reel 150,000. Later (09-25): 4,000 · 20,000 · 200,000, Hamster Wild 30,000 → 60,000 (× 3ⁿ) | First draft (750 / 3,000 / 25,000) all bought within ~2 min; now ~7–9 min. Raised later in step with the machine arriving earlier with bigger pays. |
| 2026-09-24 | `upgrades[].machines` | — → Oiled Lever + Third Reel: clunky; Stacker upgrades: stacker | Machine upgrades name their machine (D63). |
| 2026-09-24 → 09-27 | Diary | 18 stickers / 53 tokens → 20/58 (+Snack Time, Line Dancer) → 28/83 → 31/91 (+Fresh Seeds, Card Shark, Four-Leaf Hamster; Top Athlete Wheel Lv 8 → 4; Double Trouble "3 gambles in a row") → 34/102 (+Nest Egg, Shooting Star, All-Star; Full Bloom 11 → 18 traits) → 38/119 (+A-maze-ing, Nut Hoarder, The Big Cheese, Whole Arcade; Full Cage "own four machines") → 39/122 (+Hat Trick) → 44/135 (casino: Lucky Number, Blackjack!, Photo Finish, Edge of the Board, Prize Winner) → 51/159 (1.3.1: Seeing Double, Night Owl, Busy Paws, Little Helper, Sticker Book, Dynasty, Billionaire) → 57 (1.4.0: New Horizons 10, Far Far Away 8, Trial by Fur 3, School of Hard Knocks 5, Wise Old Hamster 2, Box Full 3) | The first five stickers always pay exactly one pull (10 tokens). |
| 2026-09-25 | `betSteps` | — → [1, 2, 3, 5, 10] | D74. A draft with 20/50/100 made later lives ~2 min (D80). |
| 2026-09-25 | `gamble` | — → maxRounds 5 · offerSeconds 4 → **5** · `history` 5 | 5 doubles = up to ×32; 5 s to read Red/Black plus 4 suits; last 5 cards shown (D105). |
| 2026-09-25 | High Roller (new, global) | — → 2,000 × 10ⁿ max 4 (draft 1,000 × 6ⁿ max 7 bought too fast, D80) → **3,000 × 15ⁿ** (D102) | Bets multiply the late game; ×2 at 12–18 min in a first life. |
| 2026-09-25 | Hot Streak (new, global) | — → 5,000 × 4ⁿ → **20,000 × 4ⁿ**, max 5, +5% per win in a row per level (up to 5) | Maxed ×1.18 (Old Clunky) to ×1.91 (Pouch Palace) on average. Repriced in step with the slower economy. |
| 2026-09-25 | Snack Stacker `wild` / Hamster Wild (new) | — → wild weight 0, pays 150/3,000/15,000 (later 560/8,400/84,000 at 2/3/4) · Hamster Wild 30,000 × 3ⁿ max 3, weight +2 a level | EV 95 → 119 → 147 → 180. +3 a level beat the Fourth Reel. |
| 2026-09-25 | Burrow Bonanza (new) | — → 600,000 · 5×3 · 5 of 10 lines · spin 100 · 7 symbols + wild + Bouncy-Ball scatter · free spins 3/4/5+ → 8/12/20, ×2, pause 0.35 s · EV 335 fresh, 670 at 10 lines, 1,013 with every ball | Price drafted 400,000 → 600,000 (~10 min into the 3rd life, D80). See the 09-25 rebalance below. |
| 2026-09-25 | Bonanza upgrades | — → Tunnel Grease 50,000 × 1.3ⁿ (max 8) · More Tunnels 100,000 × 2.5ⁿ (max 5, +1 line) · Bouncy Ball 75,000 × 2.2ⁿ (max 5, +3 free spins). Later: 10,000 · 25,000 · 20,000 | Ball draft (150,000 × 2.5ⁿ, +2) was never bought (+5% EV vs More Tunnels +16%). Repriced when the machine got 10× cheaper. |
| 2026-09-25 | Pouch Palace (new) | — → 100,000,000 · 5×3 · 10 of 20 lines · spin 500 · pots Mini/Minor/Major/Grand (weights 62/27/10/1, seeds 5,000/12,500/50,000/500,000, growth 1/2/4/10) · wheel 3 s · EV 1,918 fresh, 3,652 at 20 lines; pots ~10% | Price drafted 15M → 100M (~7th life). Grand weight 2 → 1 (hourly Grands felt too common). See the rebalance below. |
| 2026-09-25 | Palace upgrades | — → Velvet Gears 10M × 1.3ⁿ · Extra Pouches 20M × 2.5ⁿ (+2 lines) · Pouch Polish 30M × 3ⁿ (pot growth +50%) → **400,000 · 800,000 · 1.2M** | First ×10 the drafts to match the price; then ~33× cheaper with the machine. |
| 2026-09-25 | **Machine rebalance (D98, D103)** | Old Clunky: spin 0.8 → **3 s**, weights 55/30/15 → seed 50, carrot 25 🔒, golden 12 🔒 + Wood Shaving 45, pays 2/3 seed 10/30 → 27/45, carrot 25/100 → 95/400, golden 75/500 → 280/2,400 (27.7% hits, RTP 150%) · Stacker 7,500 → **5,000**, spin 3.2 s, strawberry/golden 🔒 + Shaving 40, new pays (fresh RTP 151%, 42.6% hits; full 784%) · Bonanza 600,000 → **60,000**, spin 3.6 s, apple/golden 🔒 + Shaving 70, pays ~×1.6–19 per tier (fresh RTP 400%, 39.3% hits from 78.8%, free spins 1 in 255), free-spin pause 0.35 → 1 s · Palace 100M → **3M**, spin 3.6 s, apple/golden 🔒 + Shaving 70, pays up, pots ×6 (Mini 30,000 … Grand 3M, growth 6/12/24/60) (fresh RTP 784%, 46.5% hits from 85.8%) | Fresh machines sit at 25–45% hits (D93: rules 2+3 floor, RTP 150%+); unlockable pays are steep so every unlock raises the EV (D98). Win tiers on Old Clunky: Sunflower pair/line win, Carrot pair nice, Carrot line and Golden pair big, Golden line jackpot. |
| 2026-09-25 | `startCoins` | 25 → **100** | At a 28% hit rate, 40 coins went broke ~36% of the time (D101); 100 → ~3%. First buy ~2 min for a clicker. |
| 2026-09-25 | `delivery` | 30 s / 15 → **45 s / 20** | Covers 4 spins (D101); 0.44 coins/s stays below auto-spin at Wheel 1 (0.54/s), rule 2. |
| 2026-09-25 | Chubby Cheeks | 50 × 1.15ⁿ → **200 × 1.16ⁿ** | First buy for a clicker at ~2 min (target 2–3). |
| 2026-09-25 | Wheel Training | 100 × 1.25ⁿ, max 8, 2.5 s × 0.85ⁿ → **600 × 1.6ⁿ, max 4, 4.6 s × 0.93ⁿ, rest 0.8 s** | Intervals 4.60 / 4.28 / 3.98 / 3.80 s (floor = 3 s spin + 0.8 s). Wheel 1 at ~8–23 min idle (target ~10). D101. |
| 2026-09-25 | Four-Leaf Clover (new, global) | — → 500 × 2ⁿ, max 5, +10 Luck | Hamster Luck (D97). +5 a level was never worth buying. |
| 2026-09-25 | Machine Luck (new, per machine) | — → Lucky Horseshoe 300 · Sprinkles 8,000 · Acorn 25,000 · Charm 800,000, each × 2ⁿ, max 5, +10 Luck | Up to 50 Machine + 50 Hamster Luck. |
| 2026-09-25 | Symbol unlocks (new, per machine) | — → New Seeds 300 · Snack Restock 10,000 · Deeper Digging 30,000 · Royal Pantry 1,200,000, each × 6ⁿ, max 2 | D96. Second step costs 6× the first. |
| 2026-09-25 | Old Clunky upgrades | Oiled Lever 75 × 1.3ⁿ → 200 × 1.35ⁿ · Third Reel 1,000 → 1,600 | Slog prices. Third Reel at ~35–70 min in a first life idle, ~16–22 min later. |
| 2026-09-27 | Pays Both Ways (new, per machine, `bothWays`) | — → Old Clunky **5,000** (needs Third Reel) · Stacker **100,000** · Bonanza **5,000,000** · Palace **200,000,000**; max 1 | The user's first M7 feedback (D119). Lines pay ×1.35–1.9, so it must not out-rank the next machine. Tried 2,500/40K/250K/12M (bot skipped the Stacker, never bought the Palace), 3,500/60K/1.5M/60M (still no Palace); 8,000/150K/8M/400M kept the order but Old Clunky's was almost never bought. |
| 2026-09-27 | Family Fortune | +10% payouts a level → +0.5% per held seed (`heldSeedBonus`) → **seed jar +25% a level** (`seedJar`); cost 3 × 1.5ⁿ unchanged | D120, D128. Held-seed version bought from ~gen 6; the jar version is the endless seed sink once full. +50% a level gave the same lives. |
| 2026-09-27 | Family Tree, 7 new traits (M8) | — → Lucky Family 2 × 2ⁿ (max 4, +5 Luck) · Lucky Heirlooms 4 × 1.5ⁿ (max 5) · Big Spender 3 × 3ⁿ (max 2) · Seed Vault 4 × 2ⁿ (max 2) · Snack Inheritance 10 · Ball Pit 5 × 2ⁿ (max 3, +0.4 ball weight) · Golden Pouches 6 × 2ⁿ (max 3, +50% pot seeds) | The user's four groups (D120). Tree 37 → 71 seeds; planted after 5.2–6.1 h idle (was 4.0–4.9). |
| 2026-09-27 | `stars` (new) | — → max 5, **+10% payouts and +2 Machine Luck per star** | Machine Stars (D122). +25% & +5 made gens 6–8 up to twice as fast; +15% & +3 still faster than M7 in gens 6–7 (D121). |
| 2026-09-27 | Hamster Maze (new, ways) | — → **500M** · 3→5 reels × 3 rows, 243 ways · spin 2,500 / 3.6 s · weights seed 30, carrot 24, corn 18, blueberry 14, strawberry 9 🔒, golden 5 🔒, blank 70, wild 0 · pays per way ×1.5 after launch (seed 90K/180K/360K … golden 12M/120M/1.8B at 3/4/5) · fresh RTP 1,219% → **1,828%** | Fresh Maze earns 0.95× a finished Palace (was 0.62×) so players buy it (D128). Draft pays were ×100 too big (scale slip); Strawberry/Golden pays raised until every unlock raises EV at every Luck (rule 4). |
| 2026-09-27 | Maze upgrades | — → Maze Map 60M × 1.3ⁿ · Longer Maze 800M × 5ⁿ (+1 reel) · Maze Runner 300M × 3ⁿ (wild +2) · Hidden Snacks 200M × 6ⁿ · Lucky Turns 140M × 2ⁿ | Standard shapes at the machine's price. |
| 2026-09-27 | Acorn Vault (new, hold & spin) | — → **25B** · 5×3, 10 of 20 lines · spin 50,000 · 6+ acorns, 3 respins, 10% a cell, values 175K (40) … 17.5M (2), Grand 175M · fresh RTP 1,246% (hold & spin 1 in 139, ~24% of EV; Grand 1 in 2,749), 39.2% hits | M9. |
| 2026-09-27 | Vault upgrades | — → Oiled Hinges 3B × 1.3ⁿ · Wider Vault 6B × 2.5ⁿ (+2 lines) · Sticky Paws 10B × 4ⁿ (+1 respin) · Vault Pantry 10B × 6ⁿ · Lucky Combination 6B × 2ⁿ · Pays Both Ways 1T | Both Ways at 40× the price, like the Palace's (~67×). |
| 2026-09-27 | The Big Cheese (new, cheese wheel) | — → **2.5T** · 5×3, 10 of 20 lines · spin 300,000 · wheel ×2 (45) ×3 (30) ×5 (17) ×10 (8) · fresh RTP 1,322% (wheel ~16% of EV, ×3.45 avg), 46.4% hits | M9. |
| 2026-09-27 | Cheese upgrades | — → Cheese Slicer 300B × 1.3ⁿ · Bigger Board 600B × 2.5ⁿ · Aged Cheese 1T × 4ⁿ (+1 every wedge) · Cheese Board 1T × 6ⁿ · Lucky Rind 600B × 2ⁿ · Pays Both Ways 100T | Standard shapes. |
| 2026-09-27 | `retirement.seedJar` (new) | — → **1** (+100%, 67 seeds) | D128: heirloom bonus stops at the jar. Late lives ~1 min → 2–9 min at gens 12–15, 22–40 min by gen 18 (idle). |
| 2026-09-27 | Skin buffs (new, M10) | — → fur +5/10/20% payouts · wheel spins ×0.95/0.9/0.85 · machine spin cost ×0.95/0.9/0.85 · room offline +5/10/20% · hat +3/6/12 Luck (Common/Rare/Epic) | User's "gentle" (D129). Lives ~10–30% shorter from the middle game, whole tree ~1 h sooner (idle). |
| 2026-09-27 | Epic twists (new, M10) | — → Golden Glow +1 token a golden jackpot · Crown +2 gamble cards · Gold Wheel +1 Hot Streak step · Midnight Clunky +2 free spins · Sunflower Field a token every 3rd delivery | One per Epic (D129). |
| 2026-09-27 | Hats (new capsule skins) | — → Party Hat, Beanie, Flower Crown (common) · Top Hat, Cowboy Hat (rare) · Crown (epic) + No Hat | Pool 18 → 24; full collection ~110 → ~151 pulls. |
| 2026-09-27 | The casino (new, M11) | — → opens at generation 2 · a chip per 2 paid spins · 250 per retirement · chip = 0.5 s of best earnings (min 1 coin) · bets 10–1,000 · roulette ×2/×3/×36 · blackjack 3:2 · derby Nutmeg 34%/×2.8, Biscuit 26%/×3.7, Pepper 20%/×4.8, Tofu 13%/×7.3, Wobbles 7%/×13.6 · Seed Drop 8 rows | User's "small house edge" (D135): every bet returns 94.9–98.9% (roulette 97.3%, blackjack 98.9% perfect play, derby 94.9–96.2%, Seed Drop 95.9%). Chip amounts are guesses: a Golden Hour about every 500 paid spins. |
| 2026-09-27 | Prizes (new, M11) | — → Golden Hour 250 (+50% payouts, 90 s, up to 10 min) · Turbo Wheel 200 (spins ×0.8, 2 min) · Lucky Charm 200 (+15 Luck, 100 paid spins) · Token Bag 400 · Dealer's Visor 2,500 (hat +6 Luck) · Tuxedo 3,500 (fur +10%) · Casino Night 3,500 (room +10% offline) | Skins are Rare-sized buffs. Every chip into boosts (`--casino`): 12 lives 5–12% sooner, late lives up to a third shorter. |
| 2026-09-27 | Upgrades (new, 1.3.1) | — → **everyone:** Lucky Pennies 2,500 × 2.5ⁿ (+2% double) · Night Shift 1,000 × 3ⁿ (+10% offline) · Cosy Nest 2,000 × 4ⁿ (+1 h away) · **rebirth:** Running Shoes gen 2, 4,000 × 4ⁿ · Coupon Book gen 3, 8,000 × 3ⁿ · Sticker Album gen 4, 25,000 × 5ⁿ · Star Polish gen 5, 100,000 × 8ⁿ · Mega Cheeks gen 6, 1M × 1.5ⁿ (+100%, no max) · Hot Sauce gen 8, 5M × 3ⁿ · **sticker:** Blazing Streak 60,000 × 4ⁿ · Line Dance 15,000 × 3ⁿ · Rabbit's Foot 50,000 × 3ⁿ · Golden Touch 10,000 × 5ⁿ · Tip Jar 5,000 · Card Counter 3,000 · Money Bags 400,000 × 3ⁿ · Deep Pockets 3M × 3ⁿ · Ball Bearings 150,000 × 3ⁿ · Acorn Stash 50B · Sharp Cheddar 5T | Priced to arrive near their generation's income or sticker moment, staying a sink: payout ones join the coin-upgrade group, so late they are a few tens of percent. Before/after: Playtest notes (1.3.1). |
| 2026-09-27 | Family Tree (1.3.1) | 18 traits / 71 seeds → 22 / 94 | + Helping Paws 4 (Hamster Helper: 10% of coins every 1 s) · Deep Roots 10 (+2% a generation) · Four-Leaf Heirloom 4 × 2ⁿ (max 2) · Penny Jar 5 × 2ⁿ (max 3, +2% double). Full Bloom 18 → 22. |
| 2026-09-28 | `retirement.seedSoftcap` (new) | — → 100 seeds, exponent 0.2 | D146. Seven (seeds, exponent) pairs tried, 20 lives × 3 seeds idle (table: Playtest notes 1.4.0-rc.1); a later cap only stretched the last lives. 100 / 0.2 lengthens gens 11–13 most evenly (idle 2.5–7.0 → 6.9–10.3 min; active gens 11–15 1.2–4.0 → 3.5–13.9), first 8 lives unchanged. |
| 2026-09-28 | `colony` (new) | — → whiskers `floor((seeds earned ÷ 4) ^ 0.5)` (divisor started at 100: first migration at ~300–400 seeds paid 1–2) · perks Colony Pride 1 × 1.6ⁿ (+50%), Seed Sense 2 × 1.8ⁿ (+10%, max 10), Wise Elders 3, Old Friends 4, Trailblazer 5 × 2ⁿ (+1 star, max 3) · trials 25% of colony seeds (min 5), 2–3 whiskers, from a colony's 4th hamster · Elders 25/50/100/200%, min 3 seeds, plant ≤25% of seeds held | Divisor 4 pays ~9 whiskers at the first migration, ~27 at 3,000 seeds. |
| 2026-09-28 | Moving Day (new, `colony: 1`) | — → **250B** · 5×3 · 20 paylines (10 at first) · spin 120,000 / 3.4 s · box weight 9, boxes open into carrot 30, corn 26, apple 20, golden 14, wild 10 · fresh RTP 1,566% (Vault 1,246%, Cheese 1,322%); fully upgraded ~16.7M profit a spin (Vault ~4.0M, Cheese ~30M) | Sits between the Vault (25B) and the Cheese (2.5T). Payouts in DESIGN §29. |
| 2026-09-28 | Moving Day upgrades | — → Packing Tape 12B × 1.3ⁿ · More Rooms 24B × 2.5ⁿ · Bubble Wrap 30B × 2.2ⁿ (+2 box weight) · Valuables 40B · Lucky Van 24B × 2ⁿ · Pays Both Ways 10T | Like the Cheese's set, scaled to price. |
| 2026-09-28 | Colony traits (new, `colony: 1`) | — → Moving Boxes 40 × 2ⁿ (+2 box weight, max 2) · Whisker Wisdom 60 × 2ⁿ (+25% whiskers, max 2) · Pack Leader 50 × 2ⁿ (+50% payouts, max 3) · Starry Roots 60 × 2ⁿ (+1 star, max 2) | For a colony's late part (the rest of the tree costs ~250 seeds). |
| 2026-10-03 | Machine skins (1.6.1) | 4 → 9 (+Bubblegum, Moss: spins 5% cheaper · Copper Pipes, Seaside: 10% · Arcade Neon: 15% + 5% double-win chance) | The user's "add new skins" (D161). Same buff sizes as the old ones; the capsule pool grows 24 → 29, so the full set takes ~194 pulls (was ~151). No sim run: the buffs match the existing machine skins, and the simulator wears the rarest skin it owns (§25). |
| 2026-10-03 | `familyTree.costPerColony` (new) · `colony.perks` Colony Pride `perLevel` | — → **3** · 0.5 → **0.3** | Later colonies' lives were 1–6 min (D163). Sim (`--migrate --lives 45 --seeds 3`, idle): colony 2 1.8–2.1 h → 3.5–4.8 h, its gens 9–15 2.8–4.4 → 6.0–8.4 min; active 1.1–1.5 → 3.1–4.5 h. Colony 1 unchanged. Golden run re-recorded (migration session only). |
| 2026-10-03 | `ownCasino` (new, M12) · `schemaVersion` · diary | — → 8 cabinets (bets 5 … 300,000 Takings, guests win back 92–95%, 0 … 400M Takings), 5 floor upgrades, 2 back-office buys, till 2 h, rest 2 s, min guest return 88% · 14 → 15 · 57 → 60 stickers (+Grand Opening 3, Full Floor 10, Casino Mogul 8) | The Family Casino (D164, DESIGN §32). Paced with a greedy model (empties the till the moment it pays): first cabinet ~20 min, full floor ~14 h of casino time. Takings never touch coins; sim before/after in Playtest notes. |

---


---

## Playtest notes

*The first real feedback on the whole game came after M6 (below). Before that there were only the user's first look at M1 and short reactions ("really good", "is good").*

Template: date · build/milestone · what felt good · what felt bad · what to try.

**What to look for in the first playtest:** Is going broke frustrating or funny? Is the 30 s delivery too long or too short? Is the Third Reel a "wow" moment? When do you stop clicking? Does anything feel pointless?

**2026-10-03 · 1.8.0 bug hunt (Claude, headless Chromium on the build at 390×844 and 1280×800, plus a logic fuzzer)**
- Played: a fresh start, deliveries, every tab and sub-tab, retire, the Big Cage, Plant the whole tree, the Great Migration, the grand opening, the till (play, 10 h away, reload), buying cabinets, the four casino tables, the Menu. A throwaway fuzzer ran 60,000 random actions (every game action, saves reloaded along the way): no crash, no NaN, no negative amount.
- Bugs found and fixed (shipped in 1.9.1): **the Family tab vanished after a reload in a migrated colony's first life** (generation 1, no seeds yet), so the Colony perks the new Golden Whiskers buy were unreachable until the first seed; **Deep Pockets bought mid-life left the jackpot pots in play at the old seed** until the next life or reload (so a reload changed the pots); **the Family Casino showed Old Clunky's guest bet as "5.00"** (the others "20", "100").
- A code read afterwards (logic, platform, casino tables, number formatting) found two more, fixed with tests: **K/M/B amounts stepped down a hundredth** for about 1 in 17 round numbers (2,300 read "2.29K": `twoDecimals` floored 229.999…), and **the blackjack hint said "hit" whenever a double wasn't affordable**, even on hands to stand on (soft 18 v 3).
- Seen, not changed: the Takings counter's long decimal (PR #11); the roulette "2:1" column labels read like "8:1" at 1× in the pixel font; the Hamster Casino's "it's open!" line shows in colony 2 when the family migrated before ever starting generation 2 (correct: that's when it first opens).
- §32's questions, from one tester's look: the till reads clearly ("full! Empty it…") and the guests' return is on every cabinet card; the floor fills over about three colonies (sim: Hamster Maze ~4 h after opening at a 10-min till habit, while colony 2 lasts 3–5 h), slow enough to stay a goal; the sub-tab is easy to miss on a phone (six sub-tabs on two rows, "Your casino" last), worth a look in part 6 of the redesign.

**2026-10-03 · 1.8.0 the Family Casino (simulator, not a real playtest)**
- `node tools/sim.mjs --migrate --lives 45 --seeds 3 --casino`, without and with `--owncasino` (the bot empties the till every 10 min of play and buys cabinets and upgrades by payback; Chip Crates only once the floor is full):

  | | `--casino` | `--casino --owncasino` |
  |---|---|---|
  | Great Migration 1 · 2 | 4.4–5.4 h · 7.6–12.0 h | the same |
  | Colony 1 · 2, median life gens 9–15 | 8.0–11.1 · 5.5–8.0 min | the same |
  | Colony 3, shortest life past gen 3 · median gens 9–15 | 2.0–2.4 · 3.9–4.7 min | 2.2–2.9 · 3.6–4.5 min |

- So the coins' pacing doesn't move (the only difference is noise in colony 3, where the runs end). The floor, in hours of play after the grand opening: Snack Stacker 0.4, Burrow Bonanza 1.4, Pouch Palace 2.6, Hamster Maze 3.9, Acorn Vault 5.9, Moving Day 8.9 (2 of 3 seeds), the Big Cheese not within the runs; 40–91 tills emptied; no Chip Crates (the floor never filled). Slower than the greedy model in §32 (it empties the till every 10 min, and plays through Big Cage visits).

**2026-10-03 · balancing pass: later colonies (simulator, not a real playtest)**
- `node tools/sim.mjs --migrate --lives 45 --seeds 3` (the new `Colony N:` summary lines), before → after (tree ×3 per colony, Colony Pride +30%):

| | idle before | idle after | active before | active after |
|---|---|---|---|---|
| Colony 1 (hours · median gens 9–15) | 5.0–5.8 · 6.6–9.8 min | the same | 3.4–3.9 · 6.7–7.1 | the same |
| Colony 2 hours | 1.8–2.1 | 3.5–4.8 | 1.1–1.5 | 3.1–4.5 |
| Colony 2 shortest life past gen 3 | 2.5–2.6 min | 2.3–4.4 | 1.0–1.8 | 2.5–3.6 |
| Colony 2 median gens 9–15 | 2.8–4.4 min | 6.0–8.4 | 2.3–3.1 | 4.9–7.7 |
| Colony 3 median gens 9–15 | 2.5–3.9 min | 4.2–6.2 | 1.6–1.9 | 2.8–4.2 |
| Whiskers, migration 2 | 38–49 | 65–67 | 33–37 | 66–71 |

- Variants that didn't work (idle, colony 2 hours · median gens 9–15): softcap seeds ×0.5/colony 1.9–2.1 · 4.5–5.0; ×0.25 2.2–2.5 · 4.6–5.8; exponent ×0.75 2.2–2.8 · 4.7–5.1, ×0.65 4.3–19.4 h (a wall); seedDivisor ×3/colony 1.7–2.1 · 3.6–4.4; Pride +30% alone 2.2–2.4 · 4.1–5.3; tree ×3 alone 3.0–4.6 · 4.8–6.1; tree ×4 + Pride +30% 6.1–7.2 · 5.6–7.5.

**2026-10-03 · 1.6.0-rc.1 "New Digs", parts 1–3: the stop for the user's OK on the look (automated checks, not a real playtest)**
- **Measured, before (1.5.0) → after parts 1–3** (same game: 1B coins, every upgrade on sale, one retirement): buttons under 44 px 32 of 57 → 6 of 38 (1280×800) and 31 of 55 → 7 of 27 (390×844); smallest text 9–10 px → 12 px everywhere (places under 12 px: 24–27 → 0); on a phone the tray's open tab 296 → 305 px, a phone on its side 395 (page scrolled 150 px) → 249 px with no scroll; the five tabs no longer overflow on short or narrow phones (a bottom bar, 53 px, on 390×844); the WIN meter's number on a 5-reel machine 8 → 14 px on a phone. On a phone only 1–2 upgrade rows are fully in view (as before).
- **Speed** (5-reel machine, free spins, auto-spin; 1.5.0 vs this): 60 and 60 fps; CPU slowed 4×: **32 → 54**; 6×: **19 → 32** (only the open tab draws now).
- **Not checked:** a real phone (touch, a notch's safe area), Firefox and Safari (`mask-image` on the sheet, individual `translate`/`scale` on the card gamble: Safari 14.1+), and the look itself: the user's OK decides (§31's questions).

**2026-10-03 · 1.6.0-rc.1 "New Digs", part 2: the shell (automated checks, not a real playtest)**

**2026-10-02 · 1.5.0 "The Glow Up" · the UI before the planned redesign (measured, not a real playtest)**
- Measured for DESIGN §31's "Before": the game fits a computer's window well; **on a phone the tray is small and much of the UI is under finger size** (31 of 55 buttons under 44 px at 390×844; text down to 9 px; 6 of 22 hamster upgrade tiles in view at 1280×800, only 2 on a phone). The two-row casino sub-tabs and the tab row on a phone on its side are the tightest spots (the five tabs were 24–28 px too wide there; the page scrolled 150 px). Roulette spots ~18–20 px wide on a phone.

**2026-09-28 · 1.5.0-rc.1 "The Glow Up" · the visual redesign (automated checks, not a real playtest)**
- **Speed** (5-reel machine in free spins with auto-spin): 1.4.0: 56 fps · first 1.5.0 build: 38–42 · after moving the free-spins glow onto the bulbs' canvas and dropping two CSS filters: **54** (D153).
- **Found and fixed:** the window's glass wasn't cut out (painting a transparent colour does nothing: `Pixmap.clear()`); old icon scales too big for the wider hamster (the 180 px icon overflowed; tools/icons.mjs now refuses a scale that doesn't fit); tab icons never showed in the 5-tab tray; the carrot's root vanished past its shoulder (a bad curve); the free-spins halo was too faint; the celebration title letters overlapped by one outline too many.

**2026-09-28 · 1.4.0-rc.1 "The Great Migration" · the mega rebirth (automated checks, not a real playtest)**
- **Found and fixed:** the Wise Elders waited for an idle machine, which a clicking player (or a tight auto-spin) never has: they now retire mid-spin; a tile's preview during Tired Paws said "Auto-spin off (max)": previews now ignore a trial's twist; trials in a colony's first lives were free whiskers: they open from the 4th hamster; the first migration paid 1–2 whiskers: the divisor went from 100 to 4; icons in the trial note and migration button broke onto lines of their own (a sprite is a block: now inline boxes).
- **Seed softcap, simulator** (`--lives 20 --seeds 3`, idle, life lengths in minutes; 120 = the simulator's cap). `before` = 1.3.1's curve, **100/0.2 picked** (softcap past 100 seeds, exponent 0.2); six other variants tried (1000/0.25 … 150/0.2) were between the two or ran away to 120 min:

| Life | before | 100/0.2 (picked) |
|---|---|---|
| Gen 1–8 | unchanged | unchanged |
| Gen 11 | 4.3–7.0 | 7.9–10.3 |
| Gen 12 | 2.8–3.5 | 7.1–8.7 |
| Gen 13 | 2.5–3.7 | 6.9–8.3 |
| Gen 15 | 3.3–6.5 | 8.6–37.1 |
| Gen 18 | 5.7–9.7 | 69.8–120 |
| 20 lives in all | 5.8–6.7 h | 11.9–14.1 h |
| Whole Family Tree | 5.0–5.6 h | 5.0–5.8 h |

  Active player, 100/0.2: generations 11–15 from 1.2–4.0 to 3.5–13.9 min; 20 lives 3.8–4.2 h → 10.5–11.0 h; whole tree 3.3–3.7 → 3.4–3.9 h.
- **The migration loop** (`--lives 30 --migrate`): idle first migration after 5.0–5.8 h (10–12 generations, **9–10 whiskers**), second after 7.1–7.7 h (**38–49 whiskers**); active after 3.4–3.9 h and 4.6–5.1 h.
- **What it shows:** first colony's late lives are 2–3× longer (idle gens 11–13 from 2.5–7.0 to 6.9–10.3 min); the first 8 lives and the whole-tree time don't change. **A migrated family's early game is 3–4× faster** (colony 2's first lives 10–15 min idle, 4–10 active, vs 37–61 and 27–33), and **its late lives are short again** (colony 2's generations 9–15: 2.5–8 min idle, 1.7–4 active): Colony Pride multiplies income while the seed curve is the same. **Open question for the playtest** (DESIGN §29); levers in D146.
- **Not checked:** Firefox and Safari; a real phone's touch; how the new sounds (box opening, migration fanfare) sound; a real session through a whole second colony.

**2026-09-27/28 · 1.3.2-rc.1 "Rest Stop" · the pause button (automated checks, not a real playtest)**
- **Not yet checked:** how it feels on the user's own phone, where the gap was first found; Firefox and Safari.

**2026-09-27 · 1.3.1-rc.1 "Nuts & Bolts" · more upgrades (automated checks, not a real playtest)**
- **Simulator** (`--lives 12`, idle; active moved little): the upgrades leave total play time as it was (5.0–5.9 h → 5.2–5.6 h; whole tree 4.7–5.8 → 5.0–5.6 h) but **generation 12 got shorter: 3.7–9.6 → 2.4–3.5 min** (gens 5–6 a little longer, gen 7 12.2–24.5 from 9.0–24.3). The Hamster Helper changes nothing measurable (identical with `--no-helper` except gen 12: 3.0–4.5).
- **Not yet checked:** how a doubled win and the helper *feel* (is the helper's "LV 5" pop too busy?), Firefox and Safari (the `<details>` group's marker), a real phone's touch on the folded group.

**2026-09-27 · M11 · the Hamster Casino (automated checks, not a real playtest)**
- **Simulator** (`--lives 12`; `--casino` = the bot spends every chip on boosts): **the casino shortens the whole run slightly** — idle 5.0–5.9 h → 4.4–5.6 h, active 3.4–3.6 → 3.1–3.5 h; late lives lose up to a third (gen 12 idle 3.7–9.6 → 2.8–5.9, active 2.7–4.7 → 1.6–3.2); gens 1–2 barely change; 1–3 boosts bought a life. Without `--casino` the game plays as before.
- **Not yet checked:** how the tables *feel* and sound (chip clack, pegs), Firefox and Safari (canvas wheel, `:has()` in the five-tab rule), a real phone's touch on the roulette board's small spots.

**2026-09-27 · M15 · the growing tree (D133; automated checks, not a real playtest)**

**2026-09-27 · M15 · the visual redesign (automated checks, not a real playtest)**
- **Not yet checked:** Firefox and Safari (container queries, `100dvh`, the `@media not (…)` syntax), a real phone's touch (the tiles' two tap areas), how the animation feels after a few lives.

**2026-09-27 · 1.1.0 · the user: the layout (→ M15, D131)**
- Bad: "having to scroll down is a pain" (the upgrades). Measured on 1.1.0: at 1280×800 the page is 1,377 px tall and the tray starts ~715 px down, below the fold, so buying something scrolls the machine off the screen; at 390×844 the page is 1,796 px, one ~190 px tile per row.
- Also asked for: an entire visual redesign, a rebirth animation, a separate screen for spending seeds (DESIGN §26).
- Seen in the Big Cage at the same time: the tree's lines show through the traits you can't plant yet (`.node.locked` 55% see-through, lines drawn behind), and on a phone most of the tree sits below the Start button.

**2026-09-27 · M10 · Wardrobe buffs (automated, not a real playtest)**
- **Simulator** (`--lives 18`, with the wardrobe vs `--no-capsules`): the wardrobe makes mid-game lives ~10–30% shorter (idle gens 7–9: 23–31 · 14–18 · 14–19 min without → 9–23 · 11–15 · 6–13 with); whole tree idle 5.7–6.3 h → 4.7–5.8 h, active 3.5–4.0 → 3.4–3.6 h. Skins found: 2–3 after gen 1, 5 by gen 4, 9 by gen 9, 10–12 by gen 18. Gens 16–18 swing with when the Big Cheese arrives.
- **Found while testing:** putting a hat on didn't note its Luck in the "most Luck" stat until the next diary check (a save made then changed on load); putting a skin on now checks the diary.

**2026-09-27 · M9 · the seed jar and the Maze ×1.5 (automated, not a real playtest)**
- The user picked the seed jar (D128). Heirloom bonus stays +41% … +725% (jar + Family Fortune), not +1,252,053%.
- **Simulator** (`--lives 18`, idle gens 9–18 life lengths in minutes): before the jar 6–13 · 6–11 · 4–10 · 2–3 · 1.5–3.5 · 0.8–1.8 · 0.7–1.4 · 1.1–1.5 · 0.7–1.3 · 0.8–1.0; with the jar and the Maze change 14–19 · 7–14 · 6–9 · 5–6 · 4–6 · 5–6 · 2–6 · 3–24 · 12–25 · 22–40; the jar without the Maze change left the Maze never bought and later lives shorter. Active: Maze from gen 12, Big Cheese from gen 17; whole tree idle 5.7–6.3 h, active 3.5–4.0 h.

**2026-09-27 · M9 · simulator, maths and Chromium checks (automated, not a real playtest)**
- **Simulator, first M9 run** (idle, gens 9–18): 6–13 · 6–11 · 4–10 · 2–3 · 1.5–3.5 · 0.8–1.8 · 0.7–1.4 · 1.1–1.5 · 0.7–1.3 · 0.8–1.0 min; the Acorn Vault from gen 14–15, the Maze and Big Cheese never (the bot's payback rule prefers finishing the Palace, and lives end first). M9 changes nothing before the machines arrive, and they arrive when lives are a minute long (D127).
- **Found and fixed:** a crash on the cheese wheel (a negative time in the celebration's count-up, caught by the 1.0 crash screen); the Maze's card said "1 payline" (now "27 ways"); Aged Cheese's tile had no label, Sticky Paws' now says "Respins"; the wild's Info card was wrong for the Maze; with seven machines the named tags wrapped into three rows over the machine (past four machines they're icons only); **and a 1.0 bug:** on a phone the Info → Paytable table was wider than the screen, so the whole page scrolled sideways (every machine): the table now scrolls on its own.
- **Not checked:** a natural Grand and a natural ×10 wedge in the browser (tests and console only); the new sounds by ear; Firefox and Safari.

**2026-09-27 · 1.0.0-rc.1 (M8 + the polish) · my checks in Chromium (not a real playtest)**
- **Seen and fixed while checking:** the celebration first blocked the card gamble's buttons for its whole length (→ taps go through, D124); the iris started far too big (→ sized to the window's farthest corner); on a phone the planted trait can be scrolled out of sight (→ "Planted!" floats from the Plant button); the free-spins night glow was too faint; on a phone the celebration's coins buried the title (→ half the size, fewer); the WIN meter and the celebration both ticked while counting (→ only the celebration ticks). The favicon 404 is gone.
- **Not checked:** Firefox and Safari (the rays' `mask`, the line trace's `stroke-dasharray` from a CSS variable, the reel blur). How it all *feels* over a long session is the playtest's question (DESIGN §23).

**2026-09-27 · M8 · balance simulator (automated, not a real playtest)**
- **Final, idle** (`--lives 12 --seeds 5`, gens 1–12, min): 46–77 · 32–48 · 40–50 · 42–56 · 38–61 · 32–39 · 23–31 · 11–19 · 5–13 · 4–11 · 1–10 · 1–3; whole tree 5.2–6.1 h (M7: 4.0–4.9 h). Active: 28–45 … 1–3, whole tree 3.5–3.9 h. Seeds held after each life 3 · 6 · 7 · 9 · 10–11 · 14–25 · 19–32 · 32–69 (bonus +5% … +85%). Stars: first at gen 4–5, 15–20 by gen 12.
- **Found and fixed in the browser:** the page was stuck at the normal dialog width (a later `.dialog` rule won); the sticky Start button floated over the tree (now a solid footer); trait details were off-screen after a tap (they scroll into view); Family Pride's preview ignored the seed it spends.
- **Watch in the playtest:** DESIGN §22's questions: is the Big Cage a moment or a chore, is plant-or-hold a real choice, are stars worth rebuilding for.

**2026-09-27 · M7 · the user's first M7 feedback: pairs on the right**
- The user: "issue with 3 slots its based left to right meaning if you get 2 on the right it doesnt count". On Old Clunky with the Third Reel, 🌻 🥕 🥕 pays nothing: wins count from reel 1 (D3, DESIGN §3), and the only hints were the first speech bubble and the Info tab. The user picked **Pays Both Ways as an upgrade** (D119).
- **Simulator**, idle total 5.3–5.9 h → 4.8–5.8 h, active 3.4–4.1 → 3.6–3.7 h; life 1 unchanged (the bot can't afford 5,000 on Old Clunky before retiring); Old Clunky's Both Ways bought from gen 3 (~40 min in idle, ~23–31 active). Prices tried and rejected (idle): 2,500 / 40K / 250K / 12M → the Stacker skipped from gen 6 and **no Palace in 12 lives**; 3,500 / 60K / 1.5M / 60M → still no Palace; 8,000 / 150K / 8M / 400M → fine, but Old Clunky's almost never bought.
- **Watch in the playtest:** does 5,000 feel reachable on Old Clunky (end of the first life or early in the second)? Does "from the right" read clearly in the win show?

**2026-09-25 · M7 · balance simulator (automated, not a real playtest)**
- Bot buys by time to afford + time to pay back (D100), so these tables can't be compared with M6's.
- **Final, idle** (gens 1–12, min): 46–77 · 35–43 · 32–50 · 39–65 · 33–46 · 31–40 · 16–31 · 10–18 · 9–14 · 7–18 · 5–10 · 3–10. First life: Wheel 1 at 8–23 min (a clicker until then), Family tab at 8–13 min, Third Reel 37–70 min, ~11.8K coins earned. Stacker ~30–37 min into gen 2, Bonanza gens 4–5, Palace from gen 8. Whole tree 4.0–4.9 h. Active: 28–45 … 3–6; whole tree 2.7–3.4 h.
- **Watch in the real playtest:** the first 10 minutes of clicking before Wheel Training (the slog the user asked for, but is it fun?); the Family tab showing up at ~10 min long before retiring makes sense (~60 min); lives from gen ~9 are short again (M8).

**2026-09-25 · M7 · browser check (Chromium preview, port 8766)**
- **Found and fixed:** the resting reels of a brand-new game showed a Baby Carrot (still locked): decoration picked symbols by list position when there was no result yet (now by real weights); the card panel (360 px) spilled out of the cage at 375 px (now 300 px, tighter suit buttons); the face-down card looked like a card inside a card (the card-back sprite is now the card); a natural free-spin trigger never showed "8 free spins!": the first free spin cleared the show before the scatters' turn (the feature's text now shows at once; winshow.js `setFeatureText`).

**2026-09-25 · M6 · the user's feedback + an overall review**
- **The user's list** (after playing M6). *New:* more slot machines; rebirths for slot machines; unlock/buy new "seeds" (carrot, sunflower, golden) = unlockable symbols; more fun upgrades, and side games (roulette, blackjack…) in a hamster casino; late game, start your own casino; hats and skins that give unique changes and improvements; particles and animations. *Balance:* slow spins down, because the early game should feel like a slog; new symbols make wins less likely, so players buy luck; give a reason to rebirth more *and* to hold Heirloom Seeds (a % or × income bonus). *Changes:* change how double-or-nothing works; make it feel more like real slot machines ("make them go one by one"); luck upgrades where you can see your luck, with hamster luck and machine luck; "you currently have to scroll down to purchase rebirths": retiring should open a full page of just the rebirth upgrades, and they can only be bought there.
- **Review: what's weak** (it matches the feedback):
  1. *Too generous, no tension.* RTP 139% to 1,013%, hit rates 41% to 89%: every spin a sure profit, wins feel cheap. Baseline: first buy 0.7–3.6 min, income 13.8/s at 10 min in gen 1 → ~30M/s by gen 10.
  2. *Too fast to read.* A spin takes 0.8 s, reels land ~0.14 s apart, every winning line lights at once (up to 20 on the Palace). Doesn't feel like a pokie.
  3. *Luck is hidden and backwards.* Two tree weight shifts, lowers the hit rate (DESIGN §13), no number shown.
  4. *Retiring has no decision.* The +3% bonus counts seeds *ever earned*, so planting costs nothing; the tree (38 seeds) fills in 1.1–1.4 h (idle), then only Family Fortune is left. Lives shrink from 15–21 min (gen 1) to 4–8 min (gen 7+), so retiring becomes routine; the tree sits below the retire card.
  5. *The gamble is rarely seen* (manual wins only, 4 s offer; "pick a cheek" doesn't read as pokie). 6. *Machines are steps you skip past* (big price gaps; from gen 8 all four bought within ~5 min). 7. No human playtest of M2–M6 before this. 8. The code is getting big: new systems get their own modules.
- **What changed:** the roadmap (DESIGN §11, D88), the M7 spec (DESIGN §21), the M7 slog targets (DESIGN §10). No code or data changes yet.

**2026-09-25 · M6 · balance simulator (automated, not a real playtest)**
- **Baseline, the M5 data:** idle first life 15.5–23 min (+3 seeds), Third Reel 9.0–13.7 min (target 4–6: the greedy idle bot prefers Chubby Cheeks), Stacker 13.5–19.6 min. Later lives shrank to 7–10 min and the whole tree was planted after only **1.0–1.3 h** (M2 target ~3 h): the Stacker had already sped seeds up, as the M5 notes feared.
- **Final, idle:** lives 15–21 · 11–14 · 9–12 · 9–13 · 9–12 · 7–10 · 4–8 · 5–7 · 6–8 · 6–11 min; Bonanza 9–12 min into gen 3; Palace 4–8 min into gen 7; whole tree ~1.1–1.4 h. Active: first retirement 8–11 min, lives 6–13 min, whole tree ~0.9–1.0 h.
- Watch in the real playtest: the mid-game dip when the Palace arrives (4–8 min lives), and whether the tree filling in ~1 h feels fine until M8 adds traits.

**2026-09-25 · M6 · browser check (Chromium preview, port 8766)**
- **Found and fixed:** with fast auto-spin, clicks landed mid-spin and were lost, so the gamble almost never appeared (D82). A first fix let the queued click close the offer instantly; now the offer takes its place.

**2026-09-24 · M5 · Snack Stacker bot (automated, not a real playtest)**
- **First draft** (payouts ~15% higher, Stacker upgrades 750 / 3,000 × 3ⁿ / 25,000): the 4th/5th payline and the Fourth Reel followed within ~2 min of the Stacker, and income went from ~14 coins/s at 10 min to ~2,000 at 20 min. Too fast → D64.
- **Final**, idle: Stacker at 13.5–19.7 min; 3 seeds at 15.1–21.1 min; income ~850/s at 20 min, ~1,900/s at 40. Active: Stacker at 7.1–13.7 min.
- **Same bot without the Stacker** (idle): 3 seeds at 16.8–22.7 min, income ~200/s at 30 min. So the Stacker barely changes *when* the first retirement is possible, but a player who stays on earns ~9× faster, and seeds come ~3× faster in long lives. Watch this in the real playtest: does the Family Tree now fill too quickly?

**2026-09-23 · M1 · user's first look**
- Good: "a really great start".
- Bad: "looks a little too much like Cookie Clicker". The user wants a cleaner, more distinctive look → UI refresh (D19–D25).
- Next: the user will describe a skill tree, a rebirth system, skins, and the overall art/UI direction (DESIGN.md → User wishlist).

**2026-09-23 · M2 · balance bot (automated, not a real playtest)**
- Gen 1, idle: Wheel Training 0.3 min, **Third Reel 6.3 min** (target 4–6 ✓), Wheel maxed 11.9 min.
- **Chubby Cheeks is very strong early.** The active bot had payouts ×2.5 within the first minute and the Third Reel at ~1.5 min, and never bothered with Wheel Training (clicking beat the 2.5 s auto-spin). Watch this in the real playtest: is manual clicking too good early?

**2026-09-23 · M1 · dev smoke test (automated, not a real playtest)**
- The debug panel covers part of the page on small windows; toggle it off (`` ` ``) to shop (after the UI refresh it sits bottom-left).

---

---

## Prototype history (before 0.1.0)

The old developer changelog from AGENTS.md (D108), condensed. Newest first. From 0.1.0 on, git commits hold the developer history and `CHANGELOG.md` the player-facing one.

- 2026-09-25 — **M7 Real pokies** (DESIGN §21): blank symbol, fast exact multi-line hit rate, locked symbols + `unlockSymbol` (D96), Luck, auto-spin rest floor, card gamble, Wood Shaving, steep paytables (D98), 9 upgrades, slog prices, square-root seeds, save v7, `winshow.js`, simulator buys by pay-back time (D100). Tests 558 → 687 (D99). D95–D105.
- 2026-09-25 — **Review + new roadmap after M6 feedback**: docs only (new DESIGN §21 proposal, roadmap rows 7–14). D88–D94.
- 2026-09-25 — **M6 Pokies night**: bets and High Roller, Hamster Wild, scatters, free spins, jackpot pots + wheel, fair gamble, Hot Streak, queued click (D82), 2 machines (Burrow Bonanza, Pouch Palace), tuned seed curve, save v6, `tools/sim.mjs`, sub-tabs, `fx.js`. Tests 319 → 558. D73–D87.
- 2026-09-24 — **M5 New look, QoL & a second machine**: hamster cage redesign, grid spins + paylines, Snack Stacker, collect & switch, Buy ×10/Max, Menu settings, save v5. Tests 228 → 319. D59–D72.
- 2026-09-24 — **M4 Polish & feel**: sprites redrawn, win tiers, flying coins, synthesized sound, offline earnings + Welcome-back, Stats screen, save v4. Tests 207 → 228. D50–D58.
- 2026-09-23 — **M3 Hamster Tokens & Capsule Machine**: tokens from diary stickers, capsules with rarities and Epic pity, 22 skins + Wardrobe, `tools/serve.py` no-cache server, save v3. Tests 154 → 207. D39–D49.
- 2026-09-23 — **M2 Retirement & Family Tree**: Heirloom Seeds, 11-node Family Tree, Family tab, save v2, phone rig fit. Tests 77 → 154. D26–D39.
- 2026-09-23 — **UI refresh** ("looks too much like Cookie Clicker"): diorama layout, text sprites (`art.js`), tabbed tray, Menu with two-tap Reset. View only. D19–D25.
- 2026-09-23 — **M1 built**: data.json, logic, headless test (77 checks), save, UI, debug panel, play.bat. D16–D18.
- 2026-09-23 — Plan approved: spins cost coins, food deliveries as safety net, Old Clunky starts at 2 reels, play.bat; wrote DESIGN.md and PORTING_NOTES.md (D1–D15).
- 2026-09-23 — Created DESIGN.md, AGENTS.md, CLAUDE.md; no game code yet.
