// fx.ts — VIEW layer. Pixel particles: sparkles, confetti, coin fountains, dust
// and embers, drawn on one <canvas> laid over the whole page.
//
// Every particle is a little square at a whole-pixel position, so it looks like
// the pixel art around it. Colours come from the CSS theme tokens. Particles are
// kept in one list and reused, with a hard cap, so a lucky streak at 50× debug
// speed can't slow the page down. Math.random() is fine here: this is the view,
// and it never touches the game's own RNG.
// With Motion set to "Less" (or the system's reduced motion) nothing is drawn.

const MAX_PARTICLES = 400;

// One particle. `max` is its starting life (filled in on its first update).
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  twinkle?: boolean; // blinks as it fades
  wobble?: number; // sways side to side (confetti)
  fade?: boolean; // fades in and out (motes)
}

// The colour lists particles pick from (read from the theme tokens).
interface Palettes {
  gold: string[];
  party: string[];
  fire: string[];
  dust: string[];
  token: string[];
  heirloom: string[];
  lines: string[];
}

// How a burst looks (all optional).
interface BurstOptions {
  count?: number;
  palette?: string[];
  speed?: number;
  gravity?: number;
  life?: number;
  size?: number;
  twinkle?: boolean;
}

export function createFx(canvas: HTMLCanvasElement, { lessMotion }: { lessMotion: () => boolean }) {
  const ctx = canvas.getContext('2d')!;
  const parts: Particle[] = []; // { x, y, vx, vy, life, max, size, color, gravity, drag, twinkle }
  let colors = {} as Palettes;
  let width = 0;
  let height = 0;
  let drawnLast = false; // something was drawn last frame (so the canvas needs a clear)

  // Read the palette from the theme tokens (again after a skin changes them).
  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    colors = {
      gold: [token('--gold'), token('--gold-dark'), '#fff3b8', '#ffffff'],
      party: [token('--gold'), token('--primary'), token('--soft'), token('--buy'), token('--token'), token('--line-5')],
      fire: ['#ffd35c', '#f79a3e', '#ef6f6c', '#fff3b8'],
      dust: ['#e6dfd5', '#cbb8a5', '#b9ad9f'],
      token: [token('--token'), token('--token-dark'), '#ffffff'],
      heirloom: [token('--heirloom'), token('--heirloom-dark'), '#f5d6a8'],
      lines: Array.from({ length: 10 }, (_, i) => token(`--line-${i + 1}`)),
    };
  }
  readColors();

  // The canvas matches the window in CSS pixels (no retina scaling: bigger,
  // crisper squares are the whole point).
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
  resize();
  window.addEventListener('resize', resize);

  const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
  const between = (a: number, b: number) => a + Math.random() * (b - a);

  function add(p: Particle): void {
    if (lessMotion() || parts.length >= MAX_PARTICLES) return;
    parts.push(p);
  }

  // The centre of an element on screen (particles live in window coordinates).
  function centerOf(el: Element) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  // ─────────────────────── effects ───────────────────────

  // A burst of sparkles flying out from a point.
  function burst(x: number, y: number, { count = 12, palette = colors.gold, speed = 160, gravity = 260, life = 0.7, size = 3, twinkle = true }: BurstOptions = {}) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * between(0.35, 1);
      add({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * 0.3,
        life: life * between(0.6, 1.2), max: 0, size: Math.random() < 0.3 ? size + 1 : size,
        color: pick(palette), gravity, drag: 1.8, twinkle,
      });
    }
  }

  function burstAt(el: Element | null | undefined, opts?: BurstOptions) {
    if (!el) return;
    const c = centerOf(el);
    burst(c.x, c.y, opts);
  }

  // Sparkles scattered over an element's area (e.g. a winning cell, a new tile).
  function sparkleOver(el: Element | null | undefined, { count = 8, palette = colors.gold }: { count?: number; palette?: string[] } = {}) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      add({
        x: between(r.left, r.right), y: between(r.top, r.bottom), vx: between(-20, 20), vy: between(-60, -20),
        life: between(0.4, 0.8), max: 0, size: pick([2, 3, 3, 4]), color: pick(palette), gravity: 40, drag: 1, twinkle: true,
      });
    }
  }

  // Confetti raining down from above an element (default: the whole screen).
  function confetti(count = 60, el: Element | null = null) {
    const r = el ? el.getBoundingClientRect() : { left: 0, right: width, top: 0 };
    for (let i = 0; i < count; i++) {
      add({
        x: between(r.left, r.right), y: r.top - between(0, 60), vx: between(-40, 40), vy: between(20, 120),
        life: between(1.6, 2.6), max: 0, size: pick([3, 4, 4, 5]), color: pick(colors.party), gravity: 90, drag: 0.6,
        wobble: between(0, Math.PI * 2),
      });
    }
  }

  // Gold coins/sparkles shooting up like a fountain (jackpots).
  function fountain(el: Element | null | undefined, count = 50) {
    if (!el) return;
    const c = centerOf(el);
    for (let i = 0; i < count; i++) {
      add({
        x: c.x + between(-c.w * 0.3, c.w * 0.3), y: c.y, vx: between(-120, 120), vy: between(-460, -220),
        life: between(1, 1.6), max: 0, size: pick([3, 4, 5]), color: pick(colors.gold), gravity: 520, drag: 0.3, twinkle: true,
      });
    }
  }

  // A soft puff of dust (a lost gamble, the wheel kicking up bedding).
  function dust(x: number, y: number, count = 10, spread = 30) {
    for (let i = 0; i < count; i++) {
      add({
        x: x + between(-spread, spread), y, vx: between(-50, 50), vy: between(-70, -20),
        life: between(0.5, 0.9), max: 0, size: pick([3, 4, 5]), color: pick(colors.dust), gravity: 60, drag: 2.5,
      });
    }
  }

  // Embers rising from an element (Hot Streak). Called every frame; `rate` is
  // embers a second, so a bigger streak burns brighter.
  function embers(el: Element | null | undefined, rate: number, dt: number) {
    if (!el || rate <= 0) return;
    let n = rate * dt;
    const r = el.getBoundingClientRect();
    while (n > 0) {
      if (Math.random() < n) {
        add({
          x: between(r.left + 4, r.right - 4), y: r.top + 4, vx: between(-15, 15), vy: between(-90, -40),
          life: between(0.4, 0.8), max: 0, size: pick([2, 3]), color: pick(colors.fire), gravity: -30, drag: 1.2,
        });
      }
      n -= 1;
    }
  }

  // Slow motes drifting in the air over an element (the cage), a few a second.
  function motes(el: Element | null | undefined, rate: number, dt: number) {
    if (!el || Math.random() > rate * dt) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > height) return;
    add({
      x: between(r.left, r.right), y: between(r.top + 20, r.bottom - 20), vx: between(-8, 8), vy: between(-12, -4),
      life: between(2.5, 4), max: 0, size: 2, color: 'rgba(255, 255, 255, 0.7)', gravity: 0, drag: 0, fade: true,
    });
  }

  // ─────────────────────── drawing ───────────────────────

  function update(dt: number): void {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p.max) p.max = p.life;
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      if (p.wobble !== undefined) {
        p.wobble += dt * 6;
        p.x += Math.sin(p.wobble) * 30 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function draw(): void {
    if (!parts.length && !drawnLast) return;
    ctx.clearRect(0, 0, width, height);
    drawnLast = parts.length > 0;
    for (const p of parts) {
      const t = p.life / p.max; // 1 → 0
      // Twinkling sparkles blink as they fade; others fade out at the end.
      if (p.twinkle && t < 0.5 && Math.floor(p.life * 20) % 2) continue;
      ctx.globalAlpha = p.fade ? Math.min(1, t * 2, (1 - t) * 4) : Math.min(1, t * 3);
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }

  // Called every frame by ui.js with real seconds.
  function frame(dt: number): void {
    if (lessMotion() && parts.length) parts.length = 0;
    update(Math.min(dt, 0.05));
    draw();
  }

  return {
    frame, readColors, burst, burstAt, sparkleOver, confetti, fountain, dust, embers, motes, centerOf,
    get colors() { return colors; },
    get count() { return parts.length; },
  };
}
