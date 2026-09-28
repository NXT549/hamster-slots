// fx.ts — VIEW layer. Pixel particles: sparkles, confetti, coin fountains, dust
// and embers, drawn on one <canvas> laid over the whole page.
//
// Every particle is a little square at a whole-pixel position, so it looks like
// the pixel art around it. Some are little sprites instead (1.0): spinning gold
// coins, stars and seeds, drawn from art.ts at a whole-number scale. Colours come from the CSS theme tokens. Particles are
// kept in one list and reused, with a hard cap, so a lucky streak at 50× debug
// speed can't slow the page down. Math.random() is fine here: this is the view,
// and it never touches the game's own RNG.
// With Motion set to "Less" (or the system's reduced motion) nothing is drawn.

import { spriteCanvas } from './art.ts';

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
  sprite?: HTMLCanvasElement; // drawn as this sprite instead of a square (size = its scale)
  spin?: number; // a sprite coin turning over: how fast (turns a second)
  phase?: number; // where in its turn it is
  floor?: number; // bounces once off this y (a coin landing on the bedding)
  glint?: number; // 1.5.0: a four-pointed star, its arms this long at their longest (it swells and fades)
}

// The colour lists particles pick from (read from the theme tokens).
interface Palettes {
  gold: string[];
  box: string[]; // 1.4.0: Moving Day's cardboard
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
      box: [token('--box'), token('--box-dark'), token('--box-light'), token('--box-tape')],
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
    // (1.5.0) A couple of star glints flash where the burst starts.
    for (let i = 0; i < Math.min(3, Math.ceil(count / 10)); i++) {
      add({ x: x + between(-10, 10), y: y + between(-10, 10), vx: 0, vy: 0, life: between(0.3, 0.5), max: 0, size: 2, color: '#ffffff', gravity: 0, drag: 0, glint: pick([6, 8, 10]) });
    }
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
      // (1.5.0) Every third one is a star glint: it swells into a four-pointed star and fades.
      const star = i % 3 === 0;
      add({
        x: between(r.left, r.right), y: between(r.top, r.bottom), vx: between(-20, 20), vy: star ? between(-25, -8) : between(-60, -20),
        life: star ? between(0.5, 0.9) : between(0.4, 0.8), max: 0, size: pick([2, 3, 3, 4]), color: star ? '#ffffff' : pick(palette),
        gravity: star ? 0 : 40, drag: 1, twinkle: !star, glint: star ? pick([2, 3, 3, 4]) * 2 : undefined,
      });
    }
  }

  // 1.5.0: star glints twinkling over an element: they swell into four-pointed stars and fade
  // (the shine on a jackpot, a new trait, a star on a machine).
  function glints(el: Element | null | undefined, count = 6, palette: string[] = ['#ffffff', colors.gold[0], '#fff3b8']) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      add({
        x: between(r.left, r.right), y: between(r.top, r.bottom), vx: 0, vy: between(-12, -2),
        life: between(0.45, 0.9), max: 0, size: 2, color: pick(palette), gravity: 0, drag: 0, glint: pick([4, 6, 6, 8, 10]),
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

  // 1.5.0: blossom petals drifting down over an element, `rate` a second (the Big Cage's tree):
  // slow, swaying, soft pink and white.
  function petals(el: Element | null | undefined, rate: number, dt: number, palette: string[]) {
    if (!el || Math.random() > rate * dt) return;
    const r = el.getBoundingClientRect();
    add({
      x: between(r.left + r.width * 0.15, r.right - r.width * 0.15), y: between(r.top + r.height * 0.1, r.top + r.height * 0.55),
      vx: between(-10, 10), vy: between(8, 22), life: between(3, 5), max: 0, size: pick([2, 3]), color: pick(palette),
      gravity: 4, drag: 0.2, wobble: between(0, Math.PI * 2), fade: true,
    });
  }

  // Twinkling specks over an element, `rate` a second (the cage at night during free spins).
  function twinkles(el: Element | null | undefined, rate: number, dt: number, palette: string[] = colors.gold) {
    if (!el || Math.random() > rate * dt) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > height) return;
    add({
      x: between(r.left + 8, r.right - 8), y: between(r.top + 8, r.bottom - 30), vx: 0, vy: between(-10, -3),
      life: between(0.7, 1.3), max: 0, size: pick([2, 3, 3, 4]), color: pick(palette), gravity: 0, drag: 0, twinkle: true, fade: true,
    });
  }

  // ─────────────────────── sprite particles (1.0) ───────────────────────

  // One sprite particle: `scale` whole pixels per sprite pixel.
  function addSprite(name: string, x: number, y: number, vx: number, vy: number, { scale = 2, life = 1.6, gravity = 700, drag = 0.2, spin = 0, floor }: { scale?: number; life?: number; gravity?: number; drag?: number; spin?: number; floor?: number } = {}) {
    const sprite = spriteCanvas(name);
    if (!sprite) return;
    add({
      x, y, vx, vy, life: life * between(0.8, 1.2), max: 0, size: scale, color: '', gravity, drag,
      sprite, spin, phase: Math.random() * Math.PI, floor,
    });
  }

  // Gold coins shooting up out of an element and tumbling down (big wins).
  function coinFountain(el: Element | null | undefined, count = 20, { scale = 2, power = 1 }: { scale?: number; power?: number } = {}) {
    if (!el) return;
    const c = centerOf(el);
    for (let i = 0; i < count; i++) {
      addSprite('coin', c.x + between(-c.w * 0.25, c.w * 0.25), c.y + c.h * 0.2, between(-220, 220) * power, between(-720, -380) * power, {
        scale: Math.random() < 0.25 ? scale + 1 : scale, life: between(1.3, 2), spin: between(1.5, 3.5),
      });
    }
  }

  // Sprites raining down over an element (coins over the cage on a jackpot,
  // Heirloom Seeds in the Big Cage). They bounce once off its bottom edge (the
  // bedding), then fade. Without a floor they fall straight through.
  function rain(name: string, el: Element | null | undefined, count = 20, { scale = 2, floor = true }: { scale?: number; floor?: boolean } = {}) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      addSprite(name, between(r.left + 10, r.right - 10), r.top - between(10, 80), between(-40, 40), between(60, 260), {
        scale: Math.random() < 0.3 ? scale + 1 : scale, life: between(1.6, 2.4), gravity: 620, drag: 0.1, spin: between(1, 3),
        floor: floor ? Math.min(r.bottom, height) - 14 : undefined,
      });
    }
  }
  const coinRain = (el: Element | null | undefined, count = 20, opts: { scale?: number } = {}) => rain('coin', el, count, opts);

  // 1.5.0: coins clinking down into a machine's coin tray (x, y: the tray; w: how wide):
  // they drop out of the machine, tumble and bounce once in the tray.
  function coinDrop(x: number, y: number, w: number, count = 6, scale = 1) {
    for (let i = 0; i < count; i++) {
      addSprite('coin', x + between(-w / 2, w / 2), y - between(16, 44), between(-12, 12), between(20, 90), {
        scale, life: between(0.8, 1.2), gravity: 900, drag: 0.1, spin: between(2, 4), floor: y,
      });
    }
  }

  // Sprites flying out from a point in every direction (a star, seeds, clovers).
  function spriteBurst(name: string, x: number, y: number, { count = 10, speed = 260, scale = 2, life = 1.1, gravity = 300, spin = 0 }: { count?: number; speed?: number; scale?: number; life?: number; gravity?: number; spin?: number } = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + between(-0.2, 0.2);
      const v = speed * between(0.6, 1);
      addSprite(name, x, y, Math.cos(angle) * v, Math.sin(angle) * v - speed * 0.25, { scale, life, gravity, drag: 1.4, spin });
    }
  }

  // A ring of sparks racing outwards (a shockwave: a purchase, a star, a slam).
  function ring(x: number, y: number, { count = 24, speed = 320, palette = colors.gold, size = 3, life = 0.45 }: BurstOptions = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      add({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life, max: 0, size, color: pick(palette), gravity: 0, drag: 3.2,
      });
    }
  }
  function ringAt(el: Element | null | undefined, opts?: BurstOptions) {
    if (!el) return;
    const c = centerOf(el);
    ring(c.x, c.y, opts);
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
      if (p.spin) p.phase! += p.spin * Math.PI * dt;
      // A coin landing on the bedding bounces once, softly.
      if (p.floor !== undefined && p.y > p.floor && p.vy > 0) {
        p.y = p.floor;
        p.vy *= -0.35;
        p.vx *= 0.6;
        p.floor = undefined;
      }
    }
  }

  function draw(): void {
    if (!parts.length && !drawnLast) return;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false; // sprites scale up as crisp squares (resizing the canvas resets this)
    drawnLast = parts.length > 0;
    for (const p of parts) {
      const t = p.life / p.max; // 1 → 0
      // Twinkling sparkles blink as they fade; others fade out at the end.
      if (p.twinkle && t < 0.5 && Math.floor(p.life * 20) % 2) continue;
      ctx.globalAlpha = p.fade ? Math.min(1, t * 2, (1 - t) * 4) : Math.min(1, t * 3);
      if (p.glint) {
        // A four-pointed star: it swells to its full size and shrinks away (glowing: 'lighter').
        const t2 = 1 - p.life / p.max; // 0 → 1
        const arm = Math.max(1, Math.round(p.glint * Math.sin(Math.PI * Math.min(1, t2)) / 2) * 2);
        const cx = Math.round(p.x);
        const cy = Math.round(p.y);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color;
        ctx.fillRect(cx - arm, cy - 1, arm * 2 + 2, 2);
        ctx.fillRect(cx - 1, cy - arm, 2, arm * 2 + 2);
        if (arm >= 4) ctx.fillRect(cx - 2, cy - 2, 4, 4); // a brighter heart
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (p.sprite) {
        // A spinning coin is squashed sideways as it turns (whole sprite pixels only).
        const cols = p.spin ? Math.max(1, Math.round(Math.abs(Math.cos(p.phase!)) * p.sprite.width)) : p.sprite.width;
        const w = cols * p.size;
        const h = p.sprite.height * p.size;
        ctx.drawImage(p.sprite, Math.round(p.x - w / 2), Math.round(p.y - h / 2), w, h);
        continue;
      }
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }

  // Called every frame by ui.ts with real seconds.
  function frame(dt: number): void {
    if (lessMotion() && parts.length) parts.length = 0;
    update(Math.min(dt, 0.05));
    draw();
  }

  return {
    frame, readColors, burst, burstAt, sparkleOver, glints, confetti, fountain, dust, embers, motes, centerOf,
    coinFountain, coinRain, coinDrop, rain, spriteBurst, ring, ringAt, twinkles, petals,
    canvas, // the one canvas: ui.ts lends it to an open dialog (the Big Cage), which sits above the page
    get colors() { return colors; },
    get count() { return parts.length; },
  };
}

// What createFx gives back.
export type Fx = ReturnType<typeof createFx>;
