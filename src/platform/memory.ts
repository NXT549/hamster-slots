// memory.ts — a pretend PLATFORM that keeps everything in memory, for the tests.
//
// A test can do what a real device does: fill the storage up, block it, move
// the clock on, hide and show the game, close it. It lives in src/ (not tests/)
// so TypeScript checks that it really matches the Platform interface. The game
// never imports it, so it isn't part of the build.

import type { Platform } from './platform.ts';

export interface MemoryPlatform extends Platform {
  stored: Map<string, string>; // what's in storage now
  time: number; // what now() returns (ms); advance() moves it on
  full: boolean; // true = every write fails, like a full disk
  blocked: boolean; // true = storage can't be used at all, like blocked site data
  unlocked: string[]; // achievements unlocked, in order
  advance(seconds: number): void;
  hide(): void;
  show(): void;
  close(): void;
}

export function createMemoryPlatform(time = 1_000_000_000_000): MemoryPlatform {
  const handlers = { hide: [] as (() => void)[], show: [] as (() => void)[], close: [] as (() => void)[] };
  const fail = (what: string) => {
    throw new Error(`storage ${what} (pretend)`);
  };
  const platform: MemoryPlatform = {
    stored: new Map(),
    time,
    full: false,
    blocked: false,
    unlocked: [],
    storage: {
      get(key) {
        if (platform.blocked) fail('blocked');
        return platform.stored.get(key) ?? null;
      },
      set(key, text) {
        if (platform.blocked) fail('blocked');
        if (platform.full) fail('full');
        platform.stored.set(key, String(text));
      },
      remove(key) {
        if (platform.blocked) fail('blocked');
        platform.stored.delete(key);
      },
    },
    lifecycle: {
      onHide: (fn) => handlers.hide.push(fn),
      onShow: (fn) => handlers.show.push(fn),
      onClose: (fn) => handlers.close.push(fn),
    },
    now: () => platform.time,
    achievements: { unlock: (id) => platform.unlocked.push(id) },
    advance(seconds) {
      platform.time += seconds * 1000;
    },
    hide: () => handlers.hide.forEach((fn) => fn()),
    show: () => handlers.show.forEach((fn) => fn()),
    close: () => handlers.close.forEach((fn) => fn()),
  };
  return platform;
}
