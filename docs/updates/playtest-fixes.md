# 1.7.x: playtest fixes

**Status:** waiting for the user's playtest of 1.1.0–1.7.1 (1.3.0–1.7.1 shipped without one). **Version:** patch (1.7.2, 1.7.3 …), keeps the "Settling In" name unless the user picks another. **Read:** PORTING_NOTES → Playtest notes (`grep -n "^## Playtest notes" PORTING_NOTES.md`), the "Questions the playtest must answer" at the end of DESIGN §21–§31.

## When feedback arrives

1. Write it in PORTING_NOTES → Playtest notes in the user's words, dated, before doing anything.
2. Sort each point: **bug** (fix now, with a test that would have caught it), **feel/look** (small view change: fix, screenshot), **balance** (see [balancing-2.md](balancing-2.md); never re-tune here without the user), **new idea** (roadmap or a new plan file, not a patch).
3. Fix bugs and small view changes on one branch, one commit each; tests and build green.
4. Ship as a patch: CHANGELOG entry, version bump, AGENTS Current status.

## Still unverified (check these first if the user can)

From AGENTS Current status:
- **Devices:** 1.6.0 (the new shell) and 1.7.0 (the Family tab, Colony, the Big Cage's sheet) on a real phone, Firefox and Safari (rays' `mask`, line trace, reel blur, `mask-image` on the sheet).
- **Sounds:** how the M7/1.0/M9 sounds sound.
- **Features in a real session:** a natural jackpot-wheel label, hold & spin Grand, the ×10 cheese wedge; Epic twists, including 1.6.1's Arcade Neon double win; all 8 machines in each machine skin.
- **Balance the sim can't feel:** colony 2's new 3–5 h length (1.7.1) and whether colony 3 feels too fast (balancing-2.md).

## Questions to ask the user (one card, after they've played)

- What felt slow, what felt too fast?
- Anything you couldn't find, read or tap on your phone?
- Which of the Ideas in this folder's index sounds most fun?
