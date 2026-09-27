// celebrate.ts — VIEW layer. The game's big moments, pokie style (1.0): the cage
// dims, light rays turn behind a big title that slams in, the amount counts up
// under it, and gold coins fly. "BIG WIN!", "JACKPOT!", the jackpot pots, free
// spins and their total, a Machine Star.
//
// A title list CLIMBS while the amount counts up, like a real pokie's rollup:
// ["BIG WIN!", "HUGE WIN!", "JACKPOT!"] shows each for a third of the count and
// slams the next one in. It never stands in your way: taps go straight through
// it (the card gamble's 5 seconds keep running underneath), and any tap on the
// cage or a spin you pull yourself fades it out.
//
// View only, like the win show (D92): the coins were paid when the spin ended,
// so a celebration can be skipped or cut short and nothing changes. It runs on
// real time (performance.now()), so it looks the same at any game speed.
// With Motion "Less" there are no rays turning, no slams and no flying coins,
// and the amount shows straight away.

import { formatCoins } from './dom.ts';
import { spriteImg } from './art.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';
import type { Money } from '../logic/money.ts';

// What kind of moment it is: it picks the colours (style.css .kind-…) and how much flies.
export type CelebrationKind = 'big' | 'jackpot' | 'grand' | 'pot' | 'free' | 'star';

export interface CelebrationOptions {
  kind: CelebrationKind;
  titles: string[]; // the title climbs through these as the amount counts up
  amount?: Money | null; // counted up from 0 under the title
  sub?: string; // a small line under it
  icon?: string; // a sprite over the title (the star)
}

// Real seconds the amount takes to count up, and how long it stays after that.
const TIMING: Record<CelebrationKind, { count: number; hold: number }> = {
  big: { count: 1.6, hold: 1.1 },
  jackpot: { count: 3.2, hold: 1.8 },
  grand: { count: 3.6, hold: 2 },
  pot: { count: 2.2, hold: 1.4 },
  free: { count: 1.8, hold: 1.3 },
  star: { count: 0, hold: 2.6 },
};
// Gold coins a second raining over the cage while it counts (0 = a fountain at the start only).
const RAIN: Record<CelebrationKind, number> = { big: 0, jackpot: 26, grand: 40, pot: 14, free: 0, star: 0 };
const OUT_SECONDS = 0.35; // the fade out (style.css .celebration.out)

interface Show {
  opts: CelebrationOptions;
  start: number;
  countFor: number; // ms
  holdFor: number; // ms
  titleIndex: number;
  closing: number | null; // when the fade out started
  lastTick: number;
}

export function createCelebration({ host, fx, sound, lessMotion }: { host: HTMLElement; fx: Fx; sound: Sound; lessMotion: () => boolean }) {
  // The overlay lives inside the cage's wall, over the wheel and the machine
  // (not the buttons below them, so Spin always works).
  const root = document.createElement('div');
  root.className = 'celebration hidden';
  root.innerHTML = '<div class="cel-rays"></div><div class="cel-flash"></div>'
    + '<div class="cel-body"><div class="cel-icon"></div><div class="cel-title"></div><div class="cel-amount"></div><div class="cel-sub"></div></div>';
  host.appendChild(root);
  const q = (cls: string) => root.querySelector<HTMLElement>(cls)!;
  const parts = { icon: q('.cel-icon'), title: q('.cel-title'), amount: q('.cel-amount'), sub: q('.cel-sub') };
  let show: Show | null = null;
  let lastNow = performance.now();
  // On a narrow cage (a phone) the coins are smaller and fewer, so they don't bury the title.
  const small = () => host.clientWidth < 600;
  const coinScale = () => (small() ? 1 : 2);

  // The title, one <span> per letter, so they can bob in a wave (style.css).
  function setTitle(text: string): void {
    parts.title.replaceChildren(...[...text].map((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? ' ' : ch;
      span.style.setProperty('--i', String(i));
      return span;
    }));
    // Restart the slam (removing and re-adding a class replays a CSS animation).
    parts.title.classList.remove('slam');
    void parts.title.offsetWidth;
    parts.title.classList.add('slam');
  }

  function start(opts: CelebrationOptions): void {
    const t = TIMING[opts.kind];
    const now = performance.now();
    const hasAmount = !!opts.amount && opts.amount.gt(0);
    show = {
      opts, start: now, titleIndex: 0, closing: null, lastTick: 0,
      countFor: hasAmount && !lessMotion() ? t.count * 1000 : 0,
      holdFor: t.hold * 1000,
    };
    root.className = `celebration kind-${opts.kind}`;
    parts.icon.replaceChildren(...(opts.icon ? [spriteImg(opts.icon, 64)] : []));
    parts.icon.classList.toggle('hidden', !opts.icon);
    parts.amount.classList.toggle('hidden', !hasAmount);
    parts.amount.textContent = hasAmount ? `+${formatCoins(show.countFor ? opts.amount!.mul(0) : opts.amount!)}` : '';
    parts.sub.textContent = opts.sub || '';
    parts.sub.classList.toggle('hidden', !opts.sub);
    setTitle(show.countFor ? opts.titles[0] : opts.titles[opts.titles.length - 1]);
    if (!show.countFor) show.titleIndex = opts.titles.length - 1;
    sound.play('slam');
    // The first burst of gold: a ring from the title, and coins out of the middle.
    const c = fx.centerOf(parts.title);
    fx.ring(c.x, c.y, { count: 28, speed: 420, palette: fx.colors.gold });
    if (opts.kind === 'star') fx.spriteBurst('star', c.x, c.y, { count: 10, speed: 320, scale: 2, spin: 0 });
    else if (opts.kind !== 'free') fx.coinFountain(parts.title, (opts.kind === 'big' ? 18 : 26) * (small() ? 0.6 : 1), { scale: coinScale() });
    else fx.burstAt(parts.title, { count: 30, palette: fx.colors.party, speed: 260 });
  }

  // A tap anywhere on the cage fades it out, and the tap still does what it
  // was for (a gamble pick, skipping the win show). "capture" hears it first.
  host.addEventListener('click', () => close(), true);

  // Fade it out (a spin you pulled yourself, the Big Cage opening, a tap).
  function close(): void {
    if (!show || show.closing !== null) return;
    show.closing = performance.now();
    root.classList.add('out');
  }

  // Called every frame by ui.ts.
  function render(now: number): void {
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (!show) return;
    const { opts } = show;
    if (show.closing !== null) {
      if (now - show.closing >= OUT_SECONDS * 1000) {
        show = null;
        root.className = 'celebration hidden';
      }
      return;
    }
    // (Clamped at 0 too: a celebration started during this frame's drawing began a moment after `now`.)
    const t = show.countFor > 0 ? Math.min(1, Math.max(0, (now - show.start) / show.countFor)) : 1;
    // The title climbs: the next one slams in at each equal part of the count.
    const index = t >= 1 ? opts.titles.length - 1 : Math.min(opts.titles.length - 1, Math.floor(t * opts.titles.length));
    if (index !== show.titleIndex) {
      show.titleIndex = index;
      setTitle(opts.titles[index]);
      sound.play('slam');
      const c = fx.centerOf(parts.title);
      fx.ring(c.x, c.y, { count: 32, speed: 460, palette: index === opts.titles.length - 1 ? fx.colors.party : fx.colors.gold });
      fx.coinFountain(parts.title, small() ? 8 : 14, { scale: coinScale() });
    }
    if (opts.amount && opts.amount.gt(0)) {
      // Ease-out, like the WIN meter; a rising tick as the digits roll.
      const shown = opts.amount.mul(1 - (1 - t) * (1 - t) * (1 - t));
      parts.amount.textContent = `+${formatCoins(t >= 1 ? opts.amount : shown)}`;
      if (t < 1 && now - show.lastTick > 70) {
        show.lastTick = now;
        sound.play('rollup', t);
      }
    }
    // Gold rain over the cage while it counts (jackpots).
    const rain = RAIN[opts.kind];
    if (rain && t < 1 && Math.random() < rain * dt * (small() ? 0.5 : 1)) fx.coinRain(host, 1, { scale: coinScale() });
    if (now - show.start >= show.countFor + show.holdFor) close();
  }

  return {
    start, close, render,
    get active() { return !!show && show.closing === null; },
  };
}

// What createCelebration gives back.
export type Celebration = ReturnType<typeof createCelebration>;

// ─────────────────────── the iris (between lives) ───────────────────────

// How long the iris takes to close or open (ms).
export const IRIS_MS = 750;

// The old-cartoon ending: a dark circle shrinks onto the hamster when it retires
// ("That's all, folks!"), and opens from the new pup when its life starts. It's
// one round window in a huge dark shadow (style.css .iris), and only its size
// animates. ui.ts skips it with Motion "Less".
export function createIris() {
  let node: HTMLElement | null = null;

  // Puts the circle on the target; gives back the size that just uncovers the
  // whole window (twice the distance to the farthest corner), where it starts or ends.
  function placeOn(target: Element): { n: HTMLElement; full: string } {
    if (!node) {
      node = document.createElement('div');
      node.className = 'iris';
      document.body.appendChild(node);
    }
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    for (const a of node.getAnimations()) a.cancel();
    const far = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    return { n: node, full: `${Math.ceil(far * 2 + 8)}px` };
  }

  function close(target: Element): void {
    const { n, full } = placeOn(target);
    n.animate([{ width: full, height: full }, { width: '0px', height: '0px' }],
      { duration: IRIS_MS, easing: 'ease-in', fill: 'forwards' });
  }

  function open(target: Element): void {
    const { n, full } = placeOn(target);
    const a = n.animate([{ width: '0px', height: '0px' }, { width: full, height: full }],
      { duration: IRIS_MS, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = () => {
      n.remove();
      if (node === n) node = null;
    };
  }

  // Take it away at once (the new life starts with Motion "Less" on).
  function clear(): void {
    if (node) node.remove();
    node = null;
  }

  return { close, open, clear };
}
