// unlock.ts — VIEW layer. Unlock moments (1.9.0, DESIGN §31 → Unlock moments).
//
// Something new is yours: a tab, a purse counter, a machine's sign, an upgrade tile.
// Before 1.9.0 it simply appeared. Now a brass padlock pops up over it, shakes, its
// shackle springs open and it hops off, while the thing itself pops in with a ring of
// gold sparks, a "NEW!" and a click-and-chime.
//
// ui.ts (and the views) only say WHAT unlocked: reveal(key, () => element). The moment
// waits until you can see the element (a tile in a tab you haven't opened yet plays when
// you open it) and until nothing big is on screen (busy(): a celebration, the gamble …).
// Two at once play one after the other.
//
// View only: nothing here decides when anything unlocks (the logic does). With Motion
// "Less" there's no padlock, shake or sparks: just a still gold outline for a moment.

import { spriteImg } from './art.ts';
import { popText, replayClass } from './dom.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';

const SHAKE_MS = 480; // the padlock shakes this long, then springs open (styles/unlock.css: the same)
const DONE_MS = 1150; // …and has hopped off and faded by now
const GAP_MS = 520; // between two unlocks that came at once
const GIVE_UP_MS = 30 * 60 * 1000; // a target never seen in half an hour: forget it

interface Waiting { key: string; target: () => HTMLElement | null; since: number }

// Can the player see it? It's on the page, has a size, and some of it is in the window.
function inView(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false; // hidden (display: none), or in a closed tab
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

export function createUnlocks({ fx, sound, lessMotion, busy }: { fx: Fx; sound: Sound; lessMotion: () => boolean; busy: () => boolean }) {
  const waiting: Waiting[] = [];
  let nextAt = 0;

  // Something unlocked: play its moment once it can be seen. (The same key twice is one moment.)
  function reveal(key: string, target: () => HTMLElement | null): void {
    if (waiting.some((w) => w.key === key)) return;
    waiting.push({ key, target, since: performance.now() });
  }

  // The moment itself, on one element.
  function play(el: HTMLElement): void {
    if (lessMotion()) {
      replayClass(el, 'unlock-still');
      sound.play('reveal');
      return;
    }
    const r = el.getBoundingClientRect();
    // The padlock: 16×16, at 2× (3× over something big, like a machine page). It lives in an
    // open dialog if the element does (a dialog sits above the rest of the page).
    const scale = Math.min(r.width, r.height) >= 96 ? 3 : 2;
    const lock = document.createElement('div');
    lock.className = 'unlock-lock';
    lock.style.left = `${Math.round(r.left + r.width / 2 - 8 * scale)}px`;
    lock.style.top = `${Math.round(r.top + r.height / 2 - 8 * scale)}px`;
    lock.append(spriteImg('lock', 16 * scale, ''));
    (el.closest('dialog[open]') || document.body).appendChild(lock);
    el.classList.add('unlock-wait'); // dimmed behind the padlock until it opens
    setTimeout(() => {
      lock.replaceChildren(spriteImg('lockOpen', 16 * scale, ''));
      lock.classList.add('open');
      el.classList.remove('unlock-wait');
      replayClass(el, 'unlock-pop');
      fx.ringAt(el, { count: 22, speed: 240, palette: fx.colors.gold });
      fx.sparkleOver(el, { count: 8 });
      popText(el, 'NEW!', 'gold');
      sound.play('reveal');
    }, SHAKE_MS);
    setTimeout(() => {
      lock.remove();
      el.classList.remove('unlock-wait'); // (in case the page was hidden and the timers bunched up)
    }, DONE_MS);
  }

  // Every frame (ui.ts): start the next moment whose element can be seen.
  function render(now: number): void {
    if (!waiting.length || now < nextAt) return;
    for (let i = waiting.length - 1; i >= 0; i--) if (now - waiting[i].since > GIVE_UP_MS) waiting.splice(i, 1);
    if (busy()) return;
    const i = waiting.findIndex((w) => inView(w.target()));
    if (i < 0) return;
    const [w] = waiting.splice(i, 1);
    play(w.target()!);
    nextAt = now + GAP_MS;
  }

  return {
    reveal, render,
    // A new save or a new colony: what was waiting is old news.
    clear() { waiting.length = 0; },
  };
}

export type Unlocks = ReturnType<typeof createUnlocks>;
