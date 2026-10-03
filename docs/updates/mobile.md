# Mobile apps (iOS, Android)

**Status:** maybe, later (platform step 4). **Needs the user:** Apple and Google developer accounts, store pages, a Mac for iOS builds, the store-rule decision. **Read:** PORTING_NOTES → The plan, → The platform layer, → Platform notes → Mobile; DESIGN §11 "Things to keep in mind for release"; DESIGN §31 (the phone layout and safe areas are already built).

## Decisions for the user first

1. **Store rules:** Apple and Google treat simulated gambling and loot boxes strictly. Keep the casino and card gamble, or ship with `casino.enabled: false` and the gamble off (rec. to check the current rules first, then decide).
2. **Which stores:** Android first (simpler review, no Mac needed) (rec.) / both.

## Steps

1. **Capacitor** wraps `dist/` (ask before adding it: rule 5).
2. **`src/platform/mobile.ts`:** storage through Capacitor Preferences (not the webview's localStorage, which iOS may clear), lifecycle on app pause/resume (save on pause, offline earnings on resume), `now()`. Tests with a fake.
3. **Touch only:** an on-screen way to every keyboard-only action (bet keys, gamble keys, the debug panel); the Android back button closes sheets and dialogs first.
4. **Safe areas:** already in the layout (`viewport-fit=cover`); check on real notched devices.
5. **Icons and splash** from `node tools/icons.mjs` sizes.
6. **Check on real devices** (a session can't): saves across app kills, offline earnings, audio after the first tap, performance on a low-end phone.

## Docs

PORTING_NOTES → The plan, platform layer table, Platform notes, a Decision per choice; AGENTS File map and Commands; README.
