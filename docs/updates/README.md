# Update plans

One file per planned update. **Open a file only when the user tells you to work on that update** (or asks about it); never read them all. Each plan says what to read in `DESIGN.md` / `PORTING_NOTES.md` by section, so you never need the big docs whole.

## Every plan assumes

- **Ask first** where the plan marks *the user's call*; everything else is already agreed (or is a default you may change, said so in the plan).
- On a branch, as `<version>-rc.1` in package.json, step by step; each step leaves the game playable, passes `npm test` and `npm run build`, and is its own commit (AGENTS → Git and releases). Stop for the user's OK where the plan says *stop*.
- Pick the update's name when content settles and tell the user (AGENTS → Git and releases).
- Docs in the same commit as the change (AGENTS → Keeping docs in sync): DESIGN's section and roadmap row, a Decision (next D-number) for each real choice, CHANGELOG `[Unreleased]`, Current status in AGENTS.md.
- When an update ships, mark its file *done* at the top (keep it as the record) and update this index.

## Plans

| File | Update | Status |
|---|---|---|
| [ui-4-family.md](ui-4-family.md) | New Digs part 4: Family tab, Colony, Big Cage panels | Done: released in 1.7.0 "Family Room" (D162) |
| [content-machine-skins.md](content-machine-skins.md) | Machine skins paint every machine, plus five new ones | Done: released in 1.6.1 "Fresh Coat" (D161) |
| [balancing.md](balancing.md) | Balancing round 1: later colonies (a dearer tree per colony) | Done: released in 1.7.1 "Settling In" (D163); kept for its variants |
| [playtest-fixes.md](playtest-fixes.md) | 1.7.x: fixes from playtest feedback | Waiting on the user's playtest |
| [balancing-2.md](balancing-2.md) | Balancing round 2: colony 3's short lives, casino boosts, a sim `--away` mode | Planned; best after the playtest; ask first |
| [ui-5-capsules-info.md](ui-5-capsules-info.md) | New Digs part 5: Capsules (reveal, Wardrobe, Diary) and Info | Planned (DESIGN §31) |
| [ui-6-casino.md](ui-6-casino.md) | New Digs part 6: Casino chrome, cashier, roulette spots, prizes | Planned (DESIGN §31) |
| [ui-7-menu-dialogs.md](ui-7-menu-dialogs.md) | New Digs part 7: Menu, Stats, Save backup, Welcome back, crash screen | Planned (DESIGN §31) |
| [ui-8-guide-sounds.md](ui-8-guide-sounds.md) | New Digs part 8: first-time guide and UI sounds (two new settings) | Planned (DESIGN §31) |
| [ui-9-polish.md](ui-9-polish.md) | New Digs part 9: access, motion, speed, skins, cleanup | Planned (DESIGN §31) |
| [m12-own-casino.md](m12-own-casino.md) | M12 Your own casino (late game) | Next on the roadmap; design with the user first |
| [m13-delivery-depth.md](m13-delivery-depth.md) | M13 Delivery depth | Only if playtests say deliveries are fun |
| [offline-app.md](offline-app.md) | Play offline: an installable app (a service worker) | Proposed; reverses a 1.0 choice, ask first |
| [itch-io.md](itch-io.md) | Release on itch.io | Ready whenever the user wants |
| [steam.md](steam.md) | Steam (Electron or Tauri) | Later |
| [mobile.md](mobile.md) | iOS and Android (Capacitor) | Maybe, later |

## Suggested order

A suggestion, not a decision: the user picks what's next.

1. **The playtest** (`playtest-fixes.md`): 1.3.0–1.7.1 have never been played by a person; everything below is a guess until then.
2. **New Digs parts 5–9**: the rest of the game is still in the old layouts; each part is small and view only. Part 8's guide matters most before any store release.
3. **Balancing round 2**, with the playtest's answer on colony 3.
4. **M12 Your own casino**: the next big system; design it with the user first.
5. **A store**: itch.io first (no fees, no review), with `offline-app.md` if the user wants the installable version.
6. **Ideas** below, whichever the user likes; the cheap, cute ones (Lucky Visitors, Jukebox, Family Album) fit between bigger updates.

## Ideas (not approved)

Proposals, not plans the user has picked. **Ask the user before building any of them** (AGENTS → Ask first).

| File | Idea |
|---|---|
| [content-lucky-visitors.md](content-lucky-visitors.md) | Lucky Visitors: tap a visitor at the cage for a small surprise |
| [content-daily-treats.md](content-daily-treats.md) | Daily Treats and Errands: a daily gift and three errands for tokens |
| [content-seasonal-festivals.md](content-seasonal-festivals.md) | Seasonal Festivals: dated events with treats and a stall |
| [content-machine-pack-2.md](content-machine-pack-2.md) | Three colony machines: expanding wilds, colossal symbols, multiplier wilds |
| [content-hamster-care.md](content-hamster-care.md) | Hamster Care: food, water and toy for a happy-hamster bonus |
| [content-family-album.md](content-family-album.md) | The Family Album: a page per retired hamster, family records |
| [content-jukebox.md](content-jukebox.md) | The Jukebox: chiptune music made in code |
| [content-pouch-finds.md](content-pouch-finds.md) | Pouch Finds: trinket sets that drop from wins |
| [content-pick-a-pup.md](content-pick-a-pup.md) | Pick a Pup: choose the next hamster from a litter of three, each with a personality |
| [content-weekly-trial.md](content-weekly-trial.md) | Trial of the Week: two Colony Trial twists at once, a stamp card |
| [content-translations.md](content-translations.md) | Translations: the game in more languages, picked in the Menu |
