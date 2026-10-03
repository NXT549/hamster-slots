# New Digs part 5: Capsules and Info

**Status:** planned, build when asked. **Version:** next minor (view only). **Read:** DESIGN §31 "Screen by screen" rows Capsules and Info (`grep -n "^### Screen by screen" DESIGN.md`), §14 (capsules, diary), §25 (wardrobe buffs), §16–§19 for what the Info tab explains; PORTING_NOTES D159 (the tile/sheet pattern).

## Goal

The Capsules tab (`capsules.ts`) and the Info tab (`payouts.ts`) rebuilt on the kit. Nothing lost: every odds table stays on screen (store rule: always show gacha odds).

## Steps

1. **The reveal** becomes the shared Sheet: the skin, its rarity chip, its buff, "Wear it" and a big close. Pity counter and duplicate refund stay visible.
2. **The Wardrobe:** five hangers (fur, wheel, machine, room, hat), each showing what's worn; the total buffs as `statRow`s instead of one sentence.
3. **Skin tiles:** kit `tile` with the preview, name and rarity `chip`; a tap opens the sheet, also for skins not found yet ("how to get it", the odds of its rarity).
4. **The Diary:** stickers in progress first, nearest to done first (`listRow` with a `gauge`), done ones folded under "Done (N)"; sticker upgrades marked with a chip.
5. **Info:** the paytable on a phone as one card per symbol with its pays as chips (no sideways scroll); paylines as now; feature cards lead with their key number, explanation in a `more()` fold; recent wins as a receipt roll (`listRow`s).
6. Fix §31 "Before" bugs here (the Info tab never gets a dot, 57-row Diary in data order, 10.5 px skin text); delete replaced CSS from `styles/capsules.css` and `styles/info.css`.
7. **Stop:** screenshots at the four sizes (a pull and reveal, the Wardrobe with a hat, the Diary, the paytable on a 5-reel machine) for the user's OK.

## Tests and checks

- All tests pass. New: the diary order function (pure, in capsules.ts or a small helper) sorts by progress; every skin has a tile.
- Browser: pull capsules to a duplicate and to pity (debug recipes), wear one of each slot, all 8 machines' Info tab.

## Docs

DESIGN §31 status and rows, a Decision, CHANGELOG, AGENTS Current status.
