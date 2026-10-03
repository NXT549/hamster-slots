# Content idea: The Family Album

> **Idea, not approved.** Small new system (save change): plan it with the user first (AGENTS.md → Ask first, rule 8). Read only when told to work on this update. Working name: **"Family Album"** (minor update).

## Pitch
Every hamster who retires gets a page in the family album: a painted portrait in the outfit they wore, their name, generation and colony, how long they lived, their biggest win and coins earned. A **records** page shows the family bests ("Biggest win: Pip III, 4.2M"). The retirement moment gets a keepsake, and long families get a story.

## What players get
- An album in the Big Cage (and read-only on the Family tab): one page per retired hamster, newest first, grouped by colony.
- Portraits drawn from the hamster sprite + the skins worn (fur, hat) on a frame (`frames.ts`).
- Family records: biggest win, fastest life, most coins in a life, most free spins in a row.
- A "Save this page" button: the portrait card as a PNG (view only, `canvas.toBlob`, through the platform layer for downloads).
- Stickers: "Fill 10 / 50 pages".

## Rules to keep
- Rule 6: the album is player state (names, ids, numbers), never balance values.
- Keep the save small: cap stored pages (e.g. the newest 200 + all record holders), each a few short fields; Money as text.
- Rule 1: the logic builds the entry on `retired` (it already knows `oldName`, `generation`, `runEarned`); the view paints portraits.
- No gameplay effect: no rules, odds or balance change; golden run unchanged except the save shape.

## Plan
1. **Logic:** `album: { pages: [...], records: {...} }`; push a page in the retire path (also Wise Elders' auto retire); life stats needed per run (biggest win this life, life seconds) added to run state.
2. **Save:** `SAVE_VERSION` bump, migration (an old save starts with an empty album, or one page from the current stats), old-save test, fixtures. Backup codes grow: check size stays reasonable.
3. **View:** album pages with the kit (`card`, `listRow`), portrait painter, records card; the retire animation ends on the new page.
4. **Platform:** `platform.saveFile(name, blob)` (web: a download link) for the PNG, if the user wants it.
5. **Tests:** a page per retirement (manual and auto), the cap, records update, migration.
6. **Docs:** DESIGN §13/§22 addition, §7 save, CHANGELOG, Decision.

## Questions for the user
- Keep every hamster forever, or the newest N?
- Want the "save as picture" button?
