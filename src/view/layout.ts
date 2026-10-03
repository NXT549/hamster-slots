// layout.ts — VIEW layer. Where the big parts of the page go, worked out in one place.
//
// The game has two layouts (M15, DESIGN §26): WIDE (the tray beside the cage: a computer, or a
// phone on its side) and STACKED (the cage over the tray: a phone held upright). The CSS needs
// the same switch as the code, and browsers can't share a named media query between the two
// yet (CSS @custom-media isn't supported anywhere), so the query is written out in the CSS
// files too, and tests/kit.test.js checks that every copy there is exactly the one here.
//
// The rig's fit (how far the wheel and the machine zoom out to fit the cage) is plain maths, so
// it lives here as pure functions the tests can check without a page (ui.ts measures and calls them).

// Wide: at least 960 px wide, or a phone on its side from 700 px.
export const WIDE_QUERY = '(min-width: 960px), (min-width: 700px) and (orientation: landscape)';
// Stacked: everything else (the same condition, negated, for the CSS that only phones get).
export const NARROW_QUERY = 'not ((min-width: 960px) or ((min-width: 700px) and (orientation: landscape)))';

// The browser's live answer for the wide layout (call .matches; it follows resizes and rotations).
export function wideMedia(): MediaQueryList {
  return window.matchMedia(WIDE_QUERY);
}

// How tall the rig may be. Beside the tray the cage's wall has its own height (the window's,
// minus the HUD), so the rig fits in that. Stacked (a phone), the cage may take up to `share` of
// the screen's height (44%), but never so much that the tray is left with less than `trayShare`
// of it (32%): on a short phone the rig gives way, so the tray stays usable (1.6.0). It works from
// the rig's room now (the wall's height inside its padding) plus what the tray has beyond its
// share, which comes out the same at any zoom: the page's other parts don't change with it.
export function rigRoom({ wide, wallH, padTop, innerH, trayH = Infinity, share = 0.44, trayShare = 0.32 }: { wide: boolean; wallH: number; padTop: number; innerH: number; trayH?: number; share?: number; trayShare?: number }): number {
  if (wide) return Math.max(0, wallH - padTop);
  return Math.max(0, Math.min(innerH * share, wallH - padTop + trayH - innerH * trayShare));
}

// The zoom that fits a rig of rigW × rigH (measured at zoom 1) into availW × availH: never
// bigger than 1 (the art is drawn for 1), never smaller than 0.3 (past that nothing's readable).
export function rigZoom({ availW, availH, rigW, rigH }: { availW: number; availH: number; rigW: number; rigH: number }): number {
  if (!(rigW > 0) || !(rigH > 0)) return 1;
  return Math.max(0.3, Math.min(1, availW / rigW, availH / rigH));
}
