# Content idea: Pick a Pup

> **Idea, not approved.** A new system with a save change: plan it with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Litter Day"** (minor update).

## Pitch
Retiring today hands the wheel to one pup with a name. Instead, the retiring hamster has a **litter of three pups**, each born with one **personality**, and the player picks who takes over. A small choice at the best moment of the loop, so each life starts a little differently ("this one's a Night Owl, I'll leave it overnight").

## What players get
- **8–10 personalities**, each one gentle bonus for that life only, e.g.:
  - *Sleepy*: +25% offline earnings · *Night Owl*: +10% payouts while auto-spinning
  - *Speedy*: spins 5% faster (spin time only, never the auto interval) · *Lucky*: +2 Hamster Luck
  - *Foodie*: deliveries 15% faster · *Hoarder*: +5% Heirloom Seeds at retirement (rule-4-safe: seeds, not spin EV)
  - *Thrifty*: spins 5% cheaper · *Show-off*: bigger win celebrations (looks only, a joke pick)
- The retire letter (1.7.0's `family.ts`) ends on three pup cards (portrait, name, personality chip, its one line); tap one to pick. The Wise Elders pick by a rule the player sets (a `segmented`: "best for idle" / "best for active" / random).
- Rarer personalities from later generations or colonies; a diary sticker for meeting all of them.
- The Family Album (`content-family-album.md`), if built, shows each hamster's personality.

## Rules to keep
- **Rule 4:** every personality only raises EV or speed; "Speedy" changes spin time but `getAutoInterval()` must still be ≥ spin time + rest (test it). Delivery < auto-spin at Wheel Training 1 with *Foodie* (test). Offline < playing with *Sleepy* (test).
- **Rule 1:** the litter is rolled on the game rng in the retire path (so the golden run stays deterministic, but changes: re-record only with the user's OK); the view only shows it.
- **Rule 2:** personalities, their effects (existing effect types where possible, D7), litter size and rarity in a `pups` block in data.json; pup names stay in `retirement.pupNames`.
- No wrong choice: the bonuses are small (≤ the weakest Common skin's buff), so picking for fun is fine.

## Plan
1. **Logic:** `retire()` rolls `state.litter` (3 pups: name + personality); `pickPup(i)` sets `state.pup`; until a pick, the first pup is the default so auto retire and old calls work unchanged. Personality effects join the effect totals so the shop previews and the sim see them.
2. **Data:** `pups: { litterSize, personalities: [{ id, name, line, rarity, from: { generation | colony }, effect }] }`.
3. **Save:** `pup` + `litter` → `SAVE_VERSION` bump, a `migrateSave` step (an old save's hamster gets no personality), old-save test, `node tools/golden.mjs --fixtures`.
4. **View:** pup cards on the retire letter and in the Big Cage's rebirth animation; the personality as a chip on the Family tab (sheet explains it).
5. **Sim:** the bot picks the best for its player type; life lengths before/after (Balance log). Expect ~5–10% shorter lives; if more, shrink the numbers.
6. **Tests:** litter deterministic per seed; every personality passes the rule-4 checks; Wise Elders' pick rule; migration.
7. **Docs:** DESIGN §13 (retiring), §29 (the Elders' new switch), CHANGELOG, Decision, Balance log.

## Questions for the user
- A choice of three, or one random pup with a personality (no choice, less to read)?
- Bonuses, or personalities as looks and lines only?
