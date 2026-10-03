# New Digs part 6: Casino

**Status:** planned, build when asked. **Version:** next minor (view only). **Read:** DESIGN §31 "Screen by screen" row Casino (`grep -n "^### Screen by screen" DESIGN.md`), §27 for the games, chips and Prize Counter; D136 (the cage steps aside on a phone).

## Goal

The casino's chrome (`casino.ts`, `styles/casino.css`) rebuilt on the kit, and roulette playable by finger on a phone. Odds and returns don't change (rule 4: every bet 94–99.5%, exact; the logic modules `roulette.ts`, `blackjack.ts`, `derby.ts`, `seeddrop.ts` stay untouched).

## Steps

1. **Chip bar** at the top with an `amount` and a **"+ Chips"** button that opens the cashier (a Sheet) from any table; today chips can only be bought on the Prizes sub-tab.
2. **Games as icon sub-tabs** (`createSubTabs`, one row on a phone; new 16×16 icons in art.ts if missing).
3. **Roulette:** finger-sized spots on a phone (today ~18–20 px). Default: the board in two halves (0–18, 19–36) with a switch; the user may prefer a zoom. Add "undo last chip" (view-side: remove the last placed bet before the spin). Bets use `stepper`.
4. **Blackjack, Derby, Seed Drop:** kit buttons and steppers; the Derby's lanes as `listRow`s with a bar.
5. **Prizes** as kit `tile`s with the sheet; boosts show time left with a `gauge`.
6. Odds notes in `more()` folds; "not enough chips" worded one way, everywhere (one helper).
7. **Stop:** screenshots at the four sizes (each table mid-game, the cashier, the prizes) for the user's OK.

## Tests and checks

- `tests/logic/casino.test.js` unchanged and green. New: undo-last-chip leaves the bet list as before the chip.
- Browser: a round of each game at 360×640 and 1280×800, buying chips from a table, `casino.enabled: false` still hides it all.

## Docs

DESIGN §31 status and row, §27 if a control moved, a Decision, CHANGELOG, AGENTS Current status.
