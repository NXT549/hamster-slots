# M13: Delivery depth

**Status:** conditional. **Only if playtests say deliveries are fun** (DESIGN §11 row 13); ask the user before starting. **Read:** DESIGN §4 (deliveries), §9 (balance rules on deliveries), §13 (the scooter, backpack and auto-delivery Family Tree traits).

## What the roadmap says

Routes (short and safe vs long and lucrative) and helper hamsters. The scooter, backpack and auto-delivery already exist as traits.

## Hard limits (rule 4)

- Delivery coins/s stay **below** auto-spin profit/s at Wheel Training 1, with the whole tree: every route, every helper. Deliveries are the safety net, not a strategy.
- One delivery still covers a base spin on Old Clunky; the short route is always available with 0 coins.

## Questions for the user

1. Routes: 2–3 fixed routes (rec.) / a map that grows with the family.
2. Risk: long routes always pay more but take longer (rec., keeps "always pays") / long routes can fail.
3. Helpers: a helper runs deliveries while the hamster spins, capped below auto-spin (rec.) / no helpers.

## Proposed shape

- **Data:** `delivery.routes` (id, name, duration, reward multiplier, unlock) in data.json; helpers as upgrades of a new effect type (`deliveryHelper`, D7 pattern: one function in game.ts, `Effect` field, `STAT_FOR_EFFECT`, shop label, icon).
- **Logic:** `startDelivery(routeId?)` defaults to today's route, so old calls and the golden run keep working; state gains the chosen route.
- **Save:** bump `SAVE_VERSION` if the route or helpers are stored; migration, fixtures.
- **View:** route picker on the Deliver button (kit `segmented` in a sheet); the tube scene shows the route.
- **Tests:** the rule-4 delivery inequalities for every route and helper level; `node tools/sim.mjs` before/after.
