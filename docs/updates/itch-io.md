# Release on itch.io

**Status:** ready whenever the user wants (platform step 2). **Needs the user:** an itch.io account and the upload (Claude can't log in). **Read:** PORTING_NOTES → The plan and → Platform notes → itch.io (`grep -n "^\*\*itch.io" PORTING_NOTES.md`); DESIGN §11 "Things to keep in mind for release".

## Steps

1. **Store-rule check** (the user decides): itch.io's rules on simulated gambling and gacha; what the page says ("no real money"; odds shown in game). Write the result in PORTING_NOTES → Platform notes.
2. **Build check:** `npm run build`; `dist/` works from a zip in an iframe on another domain (relative paths: `base: './'` already). Test with `npx vite preview` and from a local static server in an iframe page.
3. **Zip:** a script `tools/itch.mjs` (or an npm script) that zips `dist/` with `index.html` at the root (no new dependency: use Node's zlib or the system `zip`; ask before adding a package).
4. **Page text and art:** reuse `README.md` and `public/social.png`; screenshots at 1280×800 and 390×844; embed size (suggest 1280×800 with fullscreen allowed; it fits phones).
5. **The user uploads** and sets the page public. Later: `butler` in CI (needs an API key as a repo secret: the user's call).
6. **Saves:** the itch save is separate from GitHub Pages; Menu → Save backup moves it. Say so on the page.

## Docs

PORTING_NOTES → The plan (status), a Decision, README (a "Play on itch.io" link), AGENTS Current status.
