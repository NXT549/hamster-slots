// wheel.ts — VIEW layer. The hamster wheel, painted as pixel art (1.5.0, "The Glow Up").
//
// The wheel really turns: every frame its rungs and spokes are painted at the wheel's
// angle on a small canvas (2 screen pixels per painted pixel, like a sprite at 2×), so
// the pixels stay crisp squares at any angle (a rotated picture would smear them). At
// speed the rungs smear into arcs and the spokes leave ghosts, like a real wheel
// spinning. It stands on an A-frame in the bedding. During the jackpot wheel (and the
// Big Cheese's cheese wheel) its rim turns gold with lit bulbs, and the prize face
// (ui.ts) sits inside it. Colours are the wheel skins' theme tokens (WHEEL_TOKENS).

import { Pixmap, Mask, pixel, mixPixel, withAlpha, readTokens, ramp, paintMask } from './paint.ts';

export const WHEEL_TOKENS = [
  '--wheel-rim', '--wheel-bg', '--wheel-ring', '--wheel-spoke', '--wheel-hub', '--wheel-stand', '--outline-ink',
  '--gold', '--gold-dark', '--bulb-on', '--bulb-off',
] as const;
export type WheelColors = Record<(typeof WHEEL_TOKENS)[number], string>;

export const WHEEL_PX = 2;
// The painting (painted pixels): the wheel's centre and radius, and the ground under the stand.
export const WHEEL_W = 95;
export const WHEEL_H = 106;
export const WHEEL_CX = 47.5;
export const WHEEL_CY = 45;
export const WHEEL_R = 43;
const RUNGS = 24; // rungs round the running track
const SPOKES = 6;

// Paint the wheel at `angle` degrees, turning `speed` degrees a second (for the smear).
// prize = the jackpot wheel is on (a gold rim with bulbs); `bulbStep` chases them.
export function paintWheel(c: WheelColors, angle: number, speed: number, prize = false, bulbStep = 0): Pixmap {
  const out = new Pixmap(WHEEL_W, WHEEL_H);
  const cx = WHEEL_CX;
  const cy = WHEEL_CY;
  const R = WHEEL_R;
  const ink = pixel(c['--outline-ink']);
  const rim = pixel(c['--wheel-rim']);
  const ring = pixel(c['--wheel-ring']);
  const spoke = pixel(c['--wheel-spoke']);
  const bg = pixel(c['--wheel-bg']);
  const standRamp = ramp(c['--wheel-stand'], mixCss(c['--wheel-stand'], c['--outline-ink'], 0.3), c['--outline-ink']);

  // The stand: an A-frame from the hub down into the bedding, and its base (behind the wheel).
  const legs = new Mask(WHEEL_W, WHEEL_H);
  const foot = WHEEL_H - 4;
  for (const side of [-1, 1]) {
    for (let y = Math.floor(cy); y <= foot; y++) {
      const t = (y - cy) / (foot - cy);
      const x = cx + side * (3 + t * 17);
      for (let k = -2; k <= 2; k++) legs.put(Math.round(x + k), y, k === -2 ? 2 : k === 2 ? 4 : 3);
    }
  }
  for (let y = foot - 1; y <= foot + 1; y++) for (let x = Math.round(cx - 24); x <= cx + 24; x++) legs.put(x, y, y === foot - 1 ? 2 : y === foot + 1 ? 4 : 3);
  paintMask(out, legs, standRamp);

  // The back of the wheel: a see-through disc (the cage shows through a little).
  const back = withAlpha(bg, 0.72);
  const rIn = R - 6;
  for (let y = Math.floor(cy - rIn); y <= cy + rIn; y++) {
    for (let x = Math.floor(cx - rIn); x <= cx + rIn; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rIn) out.set(x, y, back);
    }
  }
  // A soft shadow inside the rim along the bottom (where the hamster runs).
  for (let y = Math.floor(cy); y <= cy + rIn; y++) {
    for (let x = Math.floor(cx - rIn); x <= cx + rIn; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > rIn - 3 && d <= rIn && (x + y) % 2) out.set(x, y, withAlpha(ink, 0.12));
    }
  }

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const fast = Math.abs(speed) > 200;
  // The spokes (with ghosts behind them when it's fast), from the hub to the inner rim.
  const drawSpoke = (a: number, col: number) => {
    const x1 = cx + Math.cos(a) * (rIn - 1);
    const y1 = cy + Math.sin(a) * (rIn - 1);
    out.line(cx, cy, x1, y1, col);
  };
  for (let k = 0; k < SPOKES; k++) {
    const a = rad(angle + (k * 360) / SPOKES);
    if (fast) for (let g = 1; g <= 3; g++) drawSpoke(a - rad(g * 7) * Math.sign(speed || 1), withAlpha(spoke, 0.35 - g * 0.08));
    drawSpoke(a, spoke);
    // A second, lighter line beside each spoke gives it some thickness.
    drawSpoke(a + 0.035, withAlpha(mixPixel(spoke, 0xffffffff, 0.35), 0.8));
  }

  // The running track: a band round the edge (the ring colour), lit at the top-left,
  // its rungs going round with the wheel, the rim's outline in and out.
  const ringLight = mixPixel(ring, 0xffffffff, 0.45);
  const ringShade = mixPixel(ring, pixel(c['--wheel-rim']), 0.3);
  const goldRim = pixel(c['--gold']);
  const goldDark = pixel(c['--gold-dark']);
  for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++) {
    for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > R + 0.5 || d < rIn - 0.5) continue;
      if (d > R - 0.8 || d < rIn + 0.6) { out.set(x, y, prize ? goldDark : rim); continue; } // the rim's outlines
      const lit = (-dx - dy) / (d * 1.414); // top-left lit, bottom-right shaded
      if (prize) out.set(x, y, lit > 0.45 ? mixPixel(goldRim, 0xffffffff, 0.4) : lit < -0.45 ? goldDark : goldRim);
      else out.set(x, y, lit > 0.5 ? ringLight : lit < -0.5 ? ringShade : ring);
    }
  }
  // Rungs (or, on the prize wheel, bulbs) round the track.
  const onBulb = pixel(c['--bulb-on']);
  const offBulb = pixel(c['--bulb-off']);
  for (let k = 0; k < RUNGS; k++) {
    const a = rad(angle + (k * 360) / RUNGS);
    const r = (R + rIn) / 2;
    const x = Math.round(cx + Math.cos(a) * r - 0.5);
    const y = Math.round(cy + Math.sin(a) * r - 0.5);
    if (prize) {
      const lit = (k + bulbStep) % 2 === 0;
      out.set(x, y, lit ? 0xffffffff : offBulb);
      out.set(x + 1, y, lit ? onBulb : offBulb);
      out.set(x, y + 1, lit ? onBulb : offBulb);
      continue;
    }
    if (fast) {
      // Smeared into a short arc: the rung and a fading tail behind it.
      for (let g = 0; g < 4; g++) {
        const ag = a - rad(g * 3) * Math.sign(speed || 1);
        out.set(Math.round(cx + Math.cos(ag) * r - 0.5), Math.round(cy + Math.sin(ag) * r - 0.5), withAlpha(rim, 0.55 - g * 0.12));
      }
    } else {
      // A rung: a short bar across the track.
      for (let k2 = -1.5; k2 <= 1.5; k2 += 0.5) {
        out.set(Math.round(cx + Math.cos(a) * (r + k2) - 0.5), Math.round(cy + Math.sin(a) * (r + k2) - 0.5), k2 < 0 ? withAlpha(rim, 0.85) : withAlpha(rim, 0.55));
      }
    }
  }
  // The hub: a shaded bolt in the middle.
  const hub = new Mask(12, 12);
  hub.ball(6, 6, 4.2, 4.2);
  paintMask(out, hub, ramp(c['--wheel-hub'], mixCss(c['--wheel-hub'], c['--outline-ink'], 0.3), c['--wheel-rim']), Math.round(cx - 6), Math.round(cy - 6));
  out.set(Math.round(cx) - 1, Math.round(cy) - 1, withAlpha(ink, 0.6));
  return out;
}

// mix() for two CSS colours, giving a CSS colour back.
function mixCss(a: string, b: string, t: number): string {
  const p = mixPixel(pixel(a), pixel(b), t);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(p & 0xff)}${hex((p >>> 8) & 0xff)}${hex((p >>> 16) & 0xff)}`;
}

// The wheel's canvas in the wheel unit. ui.ts calls render() every frame with the angle.
export function createWheel(unit: HTMLElement, tokensFrom: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'wheel-canvas';
  canvas.width = WHEEL_W;
  canvas.height = WHEEL_H;
  canvas.style.width = `${WHEEL_W * WHEEL_PX}px`;
  canvas.style.height = `${WHEEL_H * WHEEL_PX}px`;
  unit.prepend(canvas);
  let colors: WheelColors | null = null;
  let lastKey = '';
  return {
    // A wheel skin changed: read the colours again.
    invalidate() { colors = null; lastKey = ''; },
    render(angle: number, speed: number, prize: boolean, now: number) {
      if (!colors) colors = readTokens(tokensFrom, WHEEL_TOKENS);
      const step = prize ? Math.floor(now / 150) : 0;
      // Only repaint when the picture would change (the angle to the nearest degree).
      const key = `${Math.round(angle)}|${Math.abs(speed) > 200}|${prize}|${step}`;
      if (key === lastKey) return;
      lastKey = key;
      paintWheel(colors, angle, speed, prize, step).toCanvas(canvas);
    },
  };
}
