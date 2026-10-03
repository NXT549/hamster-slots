# Content idea: Seasonal Festivals

> **Idea, not approved.** A new system: plan it with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Festival Season"**; first festival **"Pumpkin Night"** (late October), then **"Snow Day"** (December). *Timing:* Pumpkin Night needs to be built and shipped by mid-October to run this year; if the user picks it later, start with Snow Day.

## Pitch
For a couple of weeks at a time, the room dresses up: pumpkins and bats, or snow on the window. A festival symbol shows up on the reels and drops **festival treats** (a temporary currency) spent at a festival stall on limited outfits, a room, a hat. When it ends, the treats turn into Hamster Tokens and the outfits stay forever.

## What players get
- A **festival calendar** in data.json (start/end day, id, name). Only one at a time.
- **Festival look:** room decor and a night palette (view, from theme tokens), festival music if the Jukebox exists.
- **Treats** drop on wins (a chance per win, outside the payout) and from deliveries.
- **A stall** with 4–6 festival skins (existing categories: fur, hat, wheel, machine, room) with the same gentle buffs as same-rarity skins (§25), plus stickers.
- Festival skins come back next year; nothing is lost forever (cute, no fear of missing out).

## Rules to keep
- Rule 1: the view passes the day number (as in Daily Treats); the logic decides which festival is on.
- Rule 4: treats drop **outside** spin payouts; reel weights and paytables never change for a festival (a festival symbol is a view reskin of an existing symbol, or a drop marker). Every machine's RTP stays exactly as tested.
- Rule 9/11: decor painted from tokens; festival skins in `skins.ts`, ids/names/rarities in data.json.
- Treats never become coins or seeds.

## Plan
1. **Logic:** `festival` state {id, treats, bought[]}; `setDay(day)` picks the active festival; `buyFestivalItem(id)`; at the end, convert treats → tokens (rate in data). Events `festivalStarted`, `festivalEnded`, `treatsChanged`.
2. **Data:** `festivals: { treatChancePerWin, treatsPerDelivery, tokensPerTreat, list: [{ id, name, start: "10-20", end: "11-03", items: [...] }] }` (month-day, so it repeats every year).
3. **Save:** `festival` block → `SAVE_VERSION` bump, migration, fixtures; festival skins live in the normal owned-skins list.
4. **View:** decor layer in `cage.ts`, stall card in the Capsules tab, a banner when a festival starts, `.less-motion` for falling leaves/snow.
5. **Debug:** a debug-panel switch to force a festival (docs/DEBUG.md recipe).
6. **Tests:** no festival outside its dates; dates across New Year; conversion exact; RTP tests unchanged with a festival on.
7. **Docs:** DESIGN section, CHANGELOG, Decision, art notes.

## Questions for the user
- Which festivals (Halloween, winter, spring, the game's birthday)?
- Should festival skins carry buffs, or be looks only?
- Two-week festivals, or a whole month?
