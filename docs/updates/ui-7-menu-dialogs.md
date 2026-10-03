# New Digs part 7: Menu and dialogs

**Status:** planned, build when asked. **Version:** next minor (view only). **Read:** DESIGN §31 "Screen by screen" rows Menu and Dialogs (`grep -n "^### Screen by screen" DESIGN.md`), §17 (settings), §7 (save backup), §15 (offline earnings); D162 for the newest kit patterns (part 4).

## Goal

The Menu and every dialog as kit pieces: a wooden board / picture frame with a pixel title plate (`pixelfont.ts`). Everything works the same; settings keep their keys.

## Steps

1. **Split out `src/view/menu.ts`** from ui.ts (`buildSettings`, `applySettings`, `showSound`, `buildStats`, the Menu wiring) and the matching `index.html` dialogs (`#menu`, `#stats`, `#backup`, `#welcome`). No visible change yet.
2. **A kit `dialog()` piece** in kit.ts: a picture frame, title plate, body, action row, close button, safe-area padding, focus kept inside while open.
3. **Menu:** three parts (two columns when wide). *Settings:* Sound (volume, on/off), Motion, Reels, Numbers as `segmented` (leave room for part 8's UI sounds and Guide). *Game:* Stats, Save backup, Reset (a `confirmButton`). *About:* version and name, What's new (the CHANGELOG's latest entry), the keys, "the coins are pretend", the debug panel when allowed.
4. **Stats:** a ledger of `statRow`s in groups (spins, wins, features, family, casino).
5. **Save backup** (`backup.ts`): kit pieces, same behaviour; Load a save becomes a `confirmButton`.
6. **Welcome back:** a letter from the hamster with the offline coins as an `amount`.
7. **Crash screen** (`main.ts` `crashScreen`): the kit's dialog look, but built with no game state and no kit factories that could throw (it must work when everything else failed).
8. **Debug panel** keeps its look but stops covering a phone's whole screen.
9. **Stop:** screenshots of each dialog at the four sizes for the user's OK.

## Tests and checks

- `platform.test.js` and `savecode.test.js` unchanged. New: settings round-trip through the Menu's controls (or a pure `settingsFromControls`), the dialog piece traps focus.
- Browser: load a backup code, Reset twice, a fake crash (`throw` in the console path from DEBUG.md), welcome back after `hamster.clock` jumps.

## Docs

DESIGN §31 status and rows, a Decision, CHANGELOG, AGENTS Current status and File map (`menu.ts`).
