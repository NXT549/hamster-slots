# New Digs part 8: first-time guide and UI sounds

**Status:** built as 1.9.0-rc.1 "Welcome Mat" (2026-10-03, D165), with unlock moments added at the user's ask (DESIGN §31 → Unlock moments); waiting for the user's OK. Planned 2026-09-29 (the user picked both). **Version:** next minor. **Read:** DESIGN §31 "The first-time guide" and "UI sounds" (`grep -n "^### The first-time guide\|^### UI sounds" DESIGN.md`), §15 (sound), D157 (the `uiSound` hook).

## Goal

A guide that points the way for a new player, and soft UI sounds. **Two new settings (`uiSounds`, `guide`), no save change:** `SAVE_VERSION` stays.

## Steps

1. **Settings:** add `uiSounds: true` and `guide: true` to the defaults in `src/platform/save.ts`; old settings load with them. Menu rows for both (part 7's board, or the current Menu if 7 isn't built). Test in `tests/platform.test.js`.
2. **`playUi(name)` in sound.ts:** synthesized (no files): tab (paper flip), subtab (tick), press (wooden click), toggle (brass click), sheet (slide), arm (fuse tick), cantAfford (bonk), guide (pop). Quieter than game sounds, rate-limited, off when `uiSounds` is off or muted. Plug it into kit.ts's existing `setUiSound` hook so every kit piece gets it; never double a sound that buying, planting or spinning already plays.
3. **`src/view/guide.ts`:** `guideStep(game)` a pure function from game state only (stats.spins, deliveries, upgradesBought, capsulesOpened, casinoGames, generation, tree), returning the step id or null. Steps and triggers exactly as DESIGN §31's table (Spin, Deliver, First upgrade, Auto-spin, Retire, Plant, Capsules, Casino).
4. **The paw:** a new pixel paw sprite in art.ts (style guide, palette test), bouncing beside the target with a soft ring; never blocks taps; waits during celebrations, the gamble, the iris, the rebirth animation; still with Motion "Less" (its `.less-motion` rule beside it). The hamster says the step's line in the speech bubble (already announced to screen readers). "Skip the guide" on the note sets `guide: false`.
5. **Stop:** a fresh game played through every step in the browser, screenshots, and a note on how the sounds feel (the user listens; a session can't).

## Tests and checks

- New: `guideStep()` at every step and after each is done, on games from `tests/logic/helpers.js` (run in Node, no DOM in guide's pure part); an old save past every step gets null; settings defaults.
- Golden run and fixtures untouched (no logic change). Browser: fresh game, Reset brings the guide back, Motion "Less".

## Docs

DESIGN §31 status, §15 (UI sounds), §17 (two settings), a Decision, CHANGELOG, AGENTS Current status (the two settings exist) and File map (`guide.ts`).
