# Content idea: The Jukebox

> **Idea, not approved.** New feature: plan it with the user first (AGENTS.md → Ask first). Read only when told to work on this update. Working name: **"Hamster FM"** (minor update). The game has sound effects (`sound.ts`, synthesized) but no music.

## Pitch
A tiny radio on the room's shelf plays chiptune music, made in code like the sound effects (no audio files, no new dependency). Some tracks play from the start; more are found in capsules, the Prize Counter and festivals. Free spins, the casino and the Big Cage get their own tunes.

## What players get
- 6–10 short looping tracks (~30–60 s each): Cage Morning, Wheel Run, Free Spins Night, Casino Lounge, The Big Cage (meadow), plus unlockables.
- A **Music** volume slider and on/off (settings, stored apart from the save like the other settings); "Shuffle" or "Pick a track".
- Context switching: free spins, casino tab and Big Cage swap the music, with a short fade.

## Rules to keep
- Rule 5: no new dependencies; a small step sequencer on Web Audio in `src/view/music.ts` (square/triangle/noise voices like `sound.ts`).
- Track data (notes) is art, so it lives in the view (`music.ts`), not data.json; data.json lists only track ids, names and how each unlocks (like skins).
- Rule 1: owning a track is player state in the logic (`ownedTracks`), saved; playing it is the view's job.
- Browsers block audio until the first tap: start music after the first input (the sound effects already handle this).
- Off by default on a first visit? Ask the user.

## Plan
1. **View:** `music.ts` sequencer (tempo, patterns, 3–4 voices, loop, fade), 5 base tracks; hook into `sound.ts`'s audio context and master volume.
2. **Settings:** `music` (0–1) and `musicOn`; Menu sliders (kit `stepper`/`toggle`).
3. **Unlocks (optional step):** `tracks` in data.json; unlock sources (diary stickers, Prize Counter items, festival stall). If tracks become capsule items, that changes capsule odds: ask first. `ownedTracks` in the save → `SAVE_VERSION` bump, migration, fixtures.
4. **View:** the radio sprite on the shelf (tap = next track), a track list in Menu.
5. **Tests:** settings round-trip, unlock grants, the sequencer's pattern data is well-formed (lengths, notes in range).
6. **Docs:** DESIGN §15 (feel), CHANGELOG, Decision (code-made music vs files).

## Questions for the user
- Music on or off by default?
- Unlockable tracks, or all tracks from the start?
