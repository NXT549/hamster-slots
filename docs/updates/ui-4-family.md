# New Digs part 4: Family, Colony, Big Cage panels

**Status:** planned, build when asked. **Version:** next minor (view only, no save change). **Read:** DESIGN §31 "Screen by screen" rows Family, Colony, The Big Cage (`grep -n "^### Screen by screen" DESIGN.md`, read that table), §13, §22, §29 for what each number means; PORTING_NOTES D157–D159 for how parts 1–3 were built (copy their patterns).

## Goal

The Family tab, the Colony and the Big Cage's panels rebuilt on the kit, like the Upgrades tab in part 3. **The meadow, the tree, the rebirth animation and `treeLayout()` don't change.** View only: golden run, fixtures and sim untouched.

## Steps

1. **Split the Family tab out of ui.ts** into `src/view/family.ts` (today `renderFamily()` in ui.ts plus markup in `index.html` `#tab-family`). Same factory shape as `shop.ts`: build once, `render(now, visible, tick)` writes only what changed. Keep the tab dot logic (4×/s) and the "I've earned an Heirloom Seed" line. No visible change yet.
2. **The retire letter** (a kit `card`, tone `heirloom`): pup portrait and name, big line "Retire now: +N Heirloom Seeds", bonus now → after, a `gauge` to the next seed, a `confirmButton` (replaces `retireArmed` and its timer). What resets and what's kept goes in a `more()` fold. The seed-jar-full note becomes a chip plus a sentence in the fold.
3. **Planted traits** as tappable `chip`s; a tap opens the tray's `createSheet` with the trait's description and level (today a hover `title`, unreachable on a phone).
4. **Colony** (`colony.ts`): the migration card (gauge, whiskers it would bring, `confirmButton`, explanation in a fold); **perks as kit `tile`s with a sheet**, bought exactly like upgrades (reuse shop.ts's tile + `describeEffect`); Wise Elders' switches as `toggle`, their mode as `segmented`; trials as `listRow`s.
5. **Big Cage panels** (`bigcage.ts`): the numbers as `statTile`s on a wooden garden sign; the trait card becomes the shared Sheet (no fixed 150 px, no inner scroll), rising over the lower meadow while the scene shifts so the tapped trait stays visible; trial picker a `segmented` with icons; Start an `xl` enamel button; Migration a `confirmButton`. Nothing under 12 px (labels today are 9.5 px).
6. Fix the §31 "Before" bugs that live here, each with a test where one can catch it. Delete the CSS this replaces (`styles/bigcage.css`, family rules); `kit.test.js` checks no class is styled by two files.
7. **Stop:** screenshots at 390×844, 360×640, 844×390 and 1280×800 (Family tab, a retirement, the Big Cage with the sheet open, the Colony after a migration) for the user's OK.

## Tests and checks

- All tests pass; `bigtree.test.js` unchanged. New: the retire card's confirm arms and disarms (pure `createArm`), the perk tile shows the same cost as `game` (rule 3).
- Browser: a real retirement, planting in the Big Cage, a migration (debug panel recipes in `docs/DEBUG.md`), Motion "Less", no console errors.

## Docs

DESIGN §31 status line and rows (mark part 4 built, "as built" notes), a Decision, CHANGELOG, AGENTS Current status and File map (`family.ts`).
