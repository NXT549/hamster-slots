# Steam (desktop)

**Status:** later (platform step 3). **Needs the user:** Steamworks account and fee, store page, content rating, the wrapper choice. **Read:** PORTING_NOTES → The plan, → The platform layer, → Platform notes → Steam; DESIGN §11 "Things to keep in mind for release".

## Decisions for the user first

1. **Wrapper:** Electron (same Chromium everywhere, mature Steamworks bindings, ~100 MB) (rec. for a first desktop build) / Tauri (small, system webview, Rust side, test on WebKit).
2. **Achievements:** mirror the Hamster Diary stickers (ids from data.json) (rec.) / a separate list / none.
3. **Store rules:** keep the card gamble, bets and casino in the Steam build, or turn the casino off (`casino.enabled: false`).

## Steps

1. **`src/platform/desktop.ts`:** a `Platform` implementation (rule 1): storage as files in the app's user-data folder (Steam Cloud syncs it), lifecycle on hide/minimise/quit, `now()`, achievements through the Steamworks binding. Tests with a fake like `memory.ts`.
2. **The wrapper project** in its own folder (`desktop/`), loading the same `dist/`; `main.ts` boots with the desktop platform there. A Quit button in the Menu (an app action, added to the interface only now).
3. **Hidden window:** keep the game running or pay offline earnings when the window is hidden (browsers throttle hidden pages; `autosave.ts` already pays a hidden tab's time).
4. **Debug panel:** a launch flag instead of `?debug`.
5. **Build and upload:** a CI job that packages Windows (and macOS/Linux if wanted); the user uploads with SteamPipe.
6. **Check:** saves survive restart and Cloud sync; achievements unlock; Save backup still works.

## Docs

PORTING_NOTES → The plan, platform layer table, Platform notes, a Decision per choice; AGENTS File map and Commands; README.
