# New Digs part 9: polish

**Status:** planned, build when asked; best after parts 4–8. **Version:** next minor, or folded into part 8's release (the user's call). **Read:** DESIGN §31 "Goals", "What stays", "Tests and checks" (`grep -n "^### " DESIGN.md`, take the ones after §31); D153 (the speed test).

## Goal

Finish the redesign: access, motion, speed, skins, and the last of the old CSS.

## Steps

1. **Access:** contrast of text on wood, paper and brass (WCAG AA for body text); every target ≥ 44 px (script it: list buttons under 44 px at 390×844, as §31's "Before" table did); visible focus rings on every kit piece; tab roles checked on every tab set; pixel icons replace any emoji left (⏸ ▶ 🔒).
2. **Motion "Less":** every animation in `src/view/styles/` has its `.less-motion` rule beside it (add a test that scans the CSS for `animation`/`@keyframes` without one).
3. **Speed:** D153's frame test at 1× and throttled 4×/6× must stay at or above 1.6.0 (54 / 32 fps). Only the open tab renders; no animated CSS filters.
4. **Skins:** every skin recolours the new frames (tokens only; `FRAME_TOKENS` test); screenshot each skin category once.
5. **Cleanup:** remove dead rules, tokens and markup left from the old layouts; `kit.test.js` passes (no class styled by two files, no `border-image: none` shorthand).
6. **Check everything** in Chromium at 1280×800, 1920×1080, 390×844, 360×640, 844×390 and 320 px wide, dev and built: every tab, sheet and dialog, all 8 machines, a retirement, the casino, the guide, skins, Motion "Less", no console errors.
7. Mark §31 done, write the release (AGENTS → Git and releases).

## Not checkable in a session

A real phone, Firefox and Safari: list them for the user's playtest (DESIGN §31's questions).
