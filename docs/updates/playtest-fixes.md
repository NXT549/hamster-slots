# 1.6.x: playtest fixes

**Status:** waiting for the user's playtest of 1.1.0–1.6.0. **Version:** patch (1.6.1, 1.6.2 …), keeps the "New Digs" name unless the user picks another. **Read:** PORTING_NOTES → Playtest notes (`grep -n "^## Playtest notes" PORTING_NOTES.md`), the "Questions the playtest must answer" at the end of DESIGN §21–§31.

## When feedback arrives

1. Write it in PORTING_NOTES → Playtest notes in the user's words, dated, before doing anything.
2. Sort each point: **bug** (fix now, with a test that would have caught it), **feel/look** (small view change: fix, screenshot), **balance** (see the balancing plans; never re-tune here without the user), **new idea** (roadmap or a new plan file, not a patch).
3. Fix bugs and small view changes on one branch, one commit each; tests and build green.
4. Ship as a patch: CHANGELOG entry, version bump, AGENTS Current status.

## Still unverified (check these first if the user can)

From AGENTS Current status: 1.6.0 on a real phone, Firefox, Safari (rays' `mask`, line trace, reel blur); how the M7/1.0/M9 sounds sound; a natural jackpot-wheel label, hold & spin Grand and ×10 cheese wedge in the browser; Epic twists in a real session.
