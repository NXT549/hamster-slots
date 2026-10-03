# Content idea: Hamster Care

> **Idea, not approved.** A new system: plan it with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Snack Time"** (minor update).

## Pitch
The hamster has a food bowl, a water bottle and a chew toy in the cage. Topping them up (one tap each) makes the hamster **happy** for a while: a small bonus and happier animations. Letting them run empty never hurts; the hamster just goes back to normal. Pillar 1 (cute first) with no guilt.

## What players get
- 3 needs: **Food** (+payouts), **Water** (+delivery speed), **Toy** (+1 Hamster Luck). Each fills to 100% with a tap and drains over ~10–20 min of play.
- A **mood** face on the hamster (idle pose, a heart particle when topped up).
- Upgrades / tree traits later: bigger bowls (slower drain), an auto-feeder (Wise Elders style automation for the late game).
- Stickers: "Top up 50 times", "Keep all three full for an hour".

## Rules to keep
- Never below normal: an empty need is 0 bonus, never a penalty (pillar 4).
- Rule 4: +Luck raises EV and hit rate like every Luck level; the payout bonus multiplies every line like a skin buff, so RTP only goes up. Check `getAutoInterval` is untouched (Water speeds deliveries, not auto-spin).
- Rule 4: delivery coins/s must stay below auto-spin profit/s at Wheel Training 1 with Water full: test it.
- Needs don't drain offline or while paused/in the Big Cage; offline earnings ignore them.
- Rule 2: drain rates, bonuses and caps in a `care` block in data.json.

## Plan
1. **Logic:** `care` state {food, water, toy} (0–1), drained in the tick; `topUp(need)`; effects read through the existing effect totals (payout multiplier, delivery time, luck) so previews and the sim see them. Events `careChanged`.
2. **Data:** `care: { needs: [{ id, drainSeconds, effect }] }` with existing effect types where possible (D7).
3. **Save:** `care` block → `SAVE_VERSION` bump, migration (start full), old-save test, fixtures.
4. **View:** props painted into the cage (`cage.ts`, tokens), tap targets ≥ 44 px, a small gauge in the purse or on the prop, mood expressions on the 32×32 hamster, `.less-motion` rules.
5. **Sim:** active (keeps them full) vs idle (never) players: life lengths before/after; Balance log.
6. **Tests:** no penalty when empty, no drain while hidden/paused/offline, the rule-4 checks above.
7. **Docs:** DESIGN section, CHANGELOG, Decision, Balance log.

## Questions for the user
- Do needs sound fun or naggy in an idle game? (Alternative: needs refill themselves when you buy upgrades.)
- Which bonuses: payouts, Luck, deliveries, or looks only?
