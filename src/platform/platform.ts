// platform.ts — PLATFORM layer: what the game needs from the device it runs on.
//
// The game runs in a web page today, but later also inside a desktop app (Steam)
// and maybe a phone app. Each one stores files, reports "the player went away"
// and so on in its own way. So the rest of the code only ever talks to this small
// interface, and each platform brings its own version of it:
//   web.ts     the browser (GitHub Pages, itch.io, and play.bat)
//   memory.ts  a pretend platform that keeps everything in memory, for the tests
// A Steam or mobile version would be one more file like web.ts; nothing else changes.
//
// Keep it small: add something here only when a platform really needs it.

export interface Platform {
  storage: PlatformStorage;
  lifecycle: PlatformLifecycle;
  // Real-world time in milliseconds since 1970. Only used for "how long was the
  // player away" (offline earnings); the game logic never reads the clock (rule 1).
  now(): number;
  achievements: PlatformAchievements;
}

// Text stored under a name, kept between visits: the save and the settings.
// Every method may THROW (storage full, blocked in a private window, …): the
// caller catches it (save.ts), so a failed save never crashes the game.
// Storage is synchronous, so the game can save the moment the page closes. A
// platform whose own storage is slower (asynchronous) reads everything into memory
// when it starts (a save is only a few KB) and writes it back in the background.
export interface PlatformStorage {
  get(key: string): string | null; // null = nothing stored under that name
  set(key: string, text: string): void;
  remove(key: string): void;
}

// "Going away" and "coming back". Each on…() adds a function to call.
export interface PlatformLifecycle {
  onHide(fn: () => void): void; // the player can't see the game any more (other tab, minimised, phone locked)
  onShow(fn: () => void): void; // they're back
  onClose(fn: () => void): void; // the game is closing: the last chance to save
}

// Steam-style achievements. The web has none (the Hamster Diary is the game's own
// list), so nothing unlocks them yet. Which diary stickers would become Steam
// achievements is a design question for later (PORTING_NOTES → The platform layer).
export interface PlatformAchievements {
  unlock(id: string): void;
}
