# Content idea: Pouch Finds (a collection)

> **Idea, not approved.** A new system: plan it with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Pocket Treasures"** (minor update).

## Pitch
Hamsters hoard. Now and then a win drops a little **trinket** into the hamster's cheek pouch: a button, a marble, a bottle cap, a tiny key. Trinkets come in themed **sets of 4** shown on a shelf in the room. A finished set gives a small permanent bonus kept for good. Unlike capsules (bought with tokens) and stickers (goals), finds come from just playing.

## What players get
- 6 sets × 4 trinkets: Sewing Box, Toy Chest, Kitchen Drawer, Garden Shed, Beach Bucket, Treasure Map (gold, late game).
- A drop chance on wins (higher on bigger win tiers) and on deliveries; duplicates turn into Hamster Tokens.
- A shelf of trinkets in the room, filling up as sets complete; an album page per set.
- Set bonuses reuse effect types: +payouts, faster deliveries, +offline earnings, +Luck, cheaper spins.
- Kept through retirement and migration, like stickers.

## Rules to keep
- Rule 4: drops happen **outside** the spin payout (an extra roll after the result), so spin EV and RTP stay exact; the set bonuses only raise EV (payouts, Luck) and must pass every rule-4 test, including delivery < auto-spin and offline < playing.
- Rule 2: sets, drop chances, duplicate refunds and bonuses in a `finds` block in data.json.
- Drops roll on the game rng only from game events, so the golden run stays deterministic (it will change: re-record only with the user's OK, said in the commit).
- No drops in offline earnings (or a fixed small number: decide).

## Plan
1. **Logic:** `finds: { owned: {id: count} }`; roll on `spinResolved` wins and deliveries; `findDropped` event; set bonuses join the effect totals.
2. **Data:** `finds: { chanceByTier: {...}, deliveryChance, duplicateTokens, sets: [{ id, name, items: [ids], effect }] }`.
3. **Save:** `SAVE_VERSION` bump, migration, old-save test, fixtures; golden run re-recorded (approved change).
4. **View:** 16×16 trinket sprites (art.ts, palette rules), the painted shelf, a pop-up as the trinket flies into the pouch, a sets page beside the Diary; `.less-motion` rules.
5. **Sim:** how long until each set completes (active/idle), and life lengths with all sets done (Balance log).
6. **Tests:** drop rates match data (Monte Carlo), duplicates refund, bonuses apply once per set, rule-4 tests with every set done.
7. **Docs:** DESIGN section, §6 if a currency changes, CHANGELOG, Decision.

## Questions for the user
- Should set bonuses give power, or be looks only (like stickers before 1.3.1)?
- 6 sets, or fewer and rarer?
