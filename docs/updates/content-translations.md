# Content idea: Translations

> **Idea, not approved.** Touches every screen; plan with the user first (AGENTS.md → Ask first). Best **after New Digs parts 5–9**, so screens are rebuilt once, not twice. Read only when told to work on this update. Working name: **"Hamster Abroad"** (minor update).

## Pitch
The game in a few more languages, picked in the Menu. Store pages (itch.io, Steam) reach many more players with even one or two extra languages, and the game's text is short and friendly, so it translates well.

## What it takes
Text lives in three places today:
1. **The view** (`src/view/*.ts`, `index.html`): labels, sheets, the guide, letters.
2. **data.json:** names and descriptions of machines, upgrades, traits, perks, trials, skins, stickers, prizes, pup names (rule 2 keeps balance numbers there; names are text, not balance).
3. **Logic events** that carry words: few, and they should carry ids instead (rule 1 stays).

## Rules to keep
- **Rule 5:** no i18n library; a small `t(key, vars)` in `src/view/i18n.ts` with plain JSON per language (`src/view/lang/en.json`, `de.json`…), number formats through `Intl.NumberFormat` beside `--font-num`.
- **Fonts:** Pixelify Sans and Nunito ship latin, latin-ext and cyrillic files (`@fontsource`), so European languages and Russian are covered. The big titles ("BIG WIN!") are hand-drawn bitmaps in `pixelfont.ts` (A–Z, digits and a few signs): each language needs its accented capitals drawn (É, Ü, Ñ…) or its titles kept short and plain. Japanese or Chinese needs a new font: a bigger job, the user's call.
- **Layout:** German and French run ~30% longer: every tile, button and sheet must survive it (a "pseudo-language" that pads every string catches it, at the four test sizes).
- data.json's English names stay the source; translations key on ids (`upgrade.chubbyCheeks.name`), so a missing one falls back to English.
- A language is a **setting** (stored apart from the save), default from the browser's language.

## Plan
1. **Extract** view strings to `en.json` with `t()`, screen by screen (no visible change); a test that every `t()` key exists in `en.json`.
2. **data.json text** read through `t()` with English fallback.
3. **Pseudo-language** for layout checks; fix what breaks.
4. **One language** first (the user picks; a native speaker should check it: a session can translate, but only a person can say it reads well), then more.
5. **Tests:** every language has every key (or falls back), placeholders match (`{n}` in both), settings round-trip.
6. **Docs:** AGENTS (a rule: new text goes through `t()`), DESIGN §17 (setting), PORTING_NOTES Decision, README, CHANGELOG.

## Questions for the user
- Which language first? Do you know someone who speaks it to check?
- Worth doing before itch.io/Steam, or after?
