# Play offline: an installable app

**Status:** proposed, not approved. It reverses a 1.0 choice (a service worker was rejected for 1.0: "a cache that can serve an old version is a new way to break updates", PORTING_NOTES 1.0 release basics; DESIGN §23 "Not done"), so **ask the user first** (AGENTS → Ask first). **Version:** a patch or minor with whatever ships next; no save change. **Read:** PORTING_NOTES → The plan, → The platform layer; DESIGN §23 "Release basics"; `public/manifest.webmanifest`; `src/platform/web.ts`.

## Why now

The game already has a manifest and icons, so phones offer "Add to Home Screen", but the installed app shows a browser error with no connection: a game that pays offline earnings can't be opened offline. A service worker fixes that, and it is also the first step of the mobile plan (`mobile.md`) without any store.

## The rule that answers the 1.0 worry

**A new version is never stuck behind an old one.** The worker caches the build, but on every start it checks for a new one in the background; when one is found the game says *"A new version is ready: tap to reload"* (saving first), and the next visit gets it anyway. The player is never on a version older than the one before last.

## Steps

1. **No new dependency** (rule 5): a hand-written `public/sw.js` (~60 lines) with a cache named after the version (`hamster-slots-1.7.1`), filled from a list of the build's files. A small `tools/swlist.mjs` run after `vite build` writes that list into `dist/sw.js` (Vite hashes file names, so the list changes every build). Ask before reaching for `vite-plugin-pwa` instead.
2. **Register it in `web.ts` only** (rule 1: the platform touches browser features; logic and view don't). Not in dev (`import.meta.env.DEV`) and not from `file://`, so play.bat and tests never meet a cache.
3. **Update flow:** cache-first for the game's files, network-first for `index.html`; an `updateReady` callback on the platform (a new optional `PlatformUpdates` piece, only if needed) that the view shows as a toast with a Reload button, which saves first (`save.ts`).
4. **itch.io:** a worker in an iframe on another domain doesn't help and may fail: register only when the page is top-level and on the GitHub Pages origin (or a `?sw` flag for testing).
5. **Tests:** `platform.test.js` with a fake `navigator.serviceWorker`: registers on the web build, not in dev or `file://` or an iframe; `tools/swlist.mjs` lists every file in `dist/` and nothing else.
6. **Check in Chromium:** build, `npx vite preview`, install, go offline (DevTools), reload; ship a second build and see the toast; offline earnings after a day away work from the installed app.

## Questions for the user

- Worth reversing the 1.0 choice? (rec. yes, with the update toast above)
- The toast, or update silently on the next visit?

## Docs

PORTING_NOTES → a Decision (the reversal, why it's safe now), The plan; DESIGN §23 "Not done" line; AGENTS File map (`sw.js`, `tools/swlist.mjs`) and Commands if the build script changes; README ("install it from your browser's menu"); CHANGELOG.
