# Machine skins for every machine (done)

> **Built and released in 1.6.1 "Fresh Coat"** (2026-10-03, the user picked "All together"; PORTING_NOTES D161). Kept as the record of the plan; read only when told to work on machine skins. Picks made: Arcade Neon's twist is a 5% double-win chance; the old skins are renamed "… Paint".

## The problem today
- A machine skin's **buff** (cheaper spins) already works on every machine (DESIGN §25).
- Its **look** only reaches Old Clunky: the 4 machine skins (`skins.ts` lines ~68–71) set `--machine` / `--machine-dark` / `--marquee`, and only Old Clunky's body reads them (`cabinet.ts` `looks.clunky`). The other 7 machines paint from their own tokens (`--stacker*`, `--bonanza*`, `--palace*`, `--maze*`, `--vault*`, `--cheese*`, `--box*`), which no skin touches. So wearing "Midnight" on the Big Cheese changes nothing you can see.

## What players get
1. **Every machine skin recolours every machine.** Each skin becomes a theme with a recolour for all 8 cabinets, keeping each machine's own shape and character (the cheese stays cheesy, in Midnight blue).
2. **New machine skins** (capsules), e.g.:
   - Common: **Bubblegum** (pinks), **Mossy** (greens)
   - Rare: **Copper Pipes** (copper + rivets), **Seaside** (teal + sand)
   - Epic: **Arcade** (black cabinet, neon trim, bulbs chase in rainbow) with a twist (pick one with the user, e.g. "+1 free spin when they trigger" or "a jackpot wheel pot grows faster")
3. Buffs follow rarity like every machine skin (cheaper spins 5 / 10 / 15%).

## Rules to keep
- Rule 11: colours are tokens; skins live in `skins.ts`; data.json only gets the new ids, names, rarities and `effects`. Every token a skin sets must be in `CABINET_TOKENS` and the first `:root` block (tests check).
- The equipped tokens go on the stage element, so a Wardrobe swatch still shows the classic look by default.
- New skins grow the capsule pool (24 → 29): duplicate and rarity odds shift, and the pity and diary stickers ("collect every skin") must still work. Rule 4 tests run with the new Epic worn.
- No save change for recolours. New skins are new ids in the owned list: no `SAVE_VERSION` bump unless a new twist needs state.

## Plan
1. **Recolour (view only, ships first):** a helper in `skins.ts` that derives each machine family's tokens from a skin's base/dark/light (e.g. `--cheese` = skin base mixed with the cheese yellow, so each machine keeps its identity) or hand-picked tokens per family for the 4 existing skins. `cabinet.invalidate()` already repaints on a skin change (ui.ts ~285). Fix the comment in `skins.ts` line 11 and `cabinet.ts` line 19.
2. **Check every machine × every skin** in `tools/sprites.html` / a new swatch grid in `tools/kit.html`; screenshot all 8 cabinets in each skin for the user.
3. **New skins:** ids/names/rarities/effects in data.json; tokens in `skins.ts`; Wardrobe swatches; a new twist only if the user picks one (one small effect function, D7).
4. **Tests:** every machine skin sets every cabinet family's tokens; art.test.js tokens in `:root`; capsule pool count and odds; rule-4 tests with the new Epic worn.
5. **Docs:** DESIGN §14 (pool, odds table) and §25 (skins table, twist), CHANGELOG ("machine skins now recolour every machine"), a Decision (derived vs hand-picked colours).

## Questions for the user
- Ship the "every machine" recolour on its own first as a quick fix (1.6.x), then the new skins?
- How many new skins, and which Epic twist?
