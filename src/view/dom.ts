// dom.ts — VIEW helpers shared by the view files (ui, shop, capsules, debug …).
// Small, boring functions that make drawing every frame cheap. (The shared pieces of the UI,
// sub-tabs included since 1.6.0, are in kit.ts.)

import { SPRITES, spriteURL, spriteScale } from './art.ts';
import { money, isFiniteMoney } from '../logic/money.ts';
import type { Money } from '../logic/money.ts';

// How numbers from 1,000 up are written (a Menu setting):
//   "short" → 47.27K, 1.5M      "full" → 47,275, 1.5M
let numberStyle: 'short' | 'full' = 'short';
export function setNumberStyle(style: string): void {
  numberStyle = style === 'full' ? 'full' : 'short';
}

// 12.3456 → "12.34" (never rounds UP, so "1.99K" is never really 1,989.6),
// and trailing zeros go: 1.50 → "1.5", 2.00 → "2".
// (+1e-9: 2300 / 1000 × 100 comes out as 229.99999… in floating point, which
// would floor to "2.29K". Like scientific() below.)
function twoDecimals(x: number): string {
  return String(Math.floor(x * 100 + 1e-9) / 100);
}

// Small amounts show cents (a 4.05-coin spin matters); big ones show whole numbers.
// From a million up it's always "1.23M" (B, T), so the HUD stays readable, and
// from a quadrillion (1e15) up it's "1.23e15": 1.23 × 10^15.
// Takes a plain number or a Money (a big number, see logic/money.ts).
export function formatCoins(value: Money | number): string {
  const n = typeof value === 'number' ? value : value.toNumber();
  if (!(Math.abs(n) < 1e15)) return scientific(money(value));
  const abs = Math.abs(n);
  if (abs < 100) return String(Math.round(n * 100) / 100);
  if (abs < 1000) return String(Math.floor(n));
  for (const [size, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as [number, string][]) {
    if (abs < size) continue;
    if (suffix === 'K' && numberStyle === 'full') break;
    return `${twoDecimals(n / size)}${suffix}`;
  }
  return Math.floor(n).toLocaleString('en-US');
}

// Whole numbers (Heirloom Seeds, Hamster Tokens): written in full, "1234", and
// from a quadrillion up like money, "1.23e15".
export function formatWhole(value: Money | number): string {
  const n = typeof value === 'number' ? value : value.toNumber();
  return Math.abs(n) < 1e15 ? String(n) : scientific(money(value));
}

// "1.23e15": the mantissa (1 to 9.99) with 2 decimals, never rounded up, like
// the K/M/B/T numbers. (+1e-9: a big number's mantissa is worked out with
// logarithms and can come out as 1.2299999… for 1.23.) Past about 1e9000000000000000
// (layer 2 and up) break_eternity writes it itself, e.g. "ee15.2".
function scientific(m: Money): string {
  if (!isFiniteMoney(m)) return m.toString();
  if (m.layer >= 2) return m.toString();
  return `${Math.floor(m.m * 100 + 1e-9) / 100}e${m.e}`;
}

// Mix two "#rrggbb" colours: t = 0 gives a, t = 1 gives b.
export function mix(a: string, b: string, t: number): string {
  const n = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * t).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

// Only touch the DOM when something actually changed. Writing the same text
// 60 times a second is wasted work.
export function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setHTML(node: HTMLElement, html: string): void {
  if (node.dataset.html !== html) {
    node.dataset.html = html;
    node.innerHTML = html;
  }
}

// Restart a one-shot CSS animation by removing and re-adding its class.
// The class comes off again when its animation ends (1.0), so an element's
// resting animation (the hamster breathing) comes back after a hop.
export function replayClass(node: HTMLElement, cls: string): void {
  node.classList.remove(cls);
  void node.offsetWidth; // forces the browser to notice the removal
  node.classList.add(cls);
  const done = (e: AnimationEvent) => {
    if (e.target !== node) return; // a child's animation ending bubbles up here too
    node.classList.remove(cls);
    node.removeEventListener('animationend', done);
  };
  node.addEventListener('animationend', done);
}

// A little word that pops up over an element and floats away ("LV 3!", "MAX!",
// "+1 Luck"), e.g. over the button you just pressed. `cls` picks its colour
// (style.css .pop-text). It lives on the page itself, so it can float anywhere.
export function popText(anchor: Element | null | undefined, text: string, cls = ''): void {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return; // hidden (another tab)
  const node = document.createElement('div');
  node.className = `pop-text ${cls}`;
  node.textContent = text;
  node.style.left = `${r.left + r.width / 2}px`;
  node.style.top = `${r.top + Math.min(r.height / 2, 20)}px`;
  // Inside an open dialog it must live in the dialog: a dialog sits above everything else on the page.
  (anchor.closest('dialog[open]') || document.body).appendChild(node);
  node.addEventListener('animationend', () => node.remove());
  setTimeout(() => node.remove(), 2000); // in case no animation runs (Motion "Less")
}

// An inline pixel icon for HTML strings (e.g. a coin before a price), about
// `size` CSS pixels wide. Like every sprite, it's scaled by a whole number.
export function iconHTML(sprite: string, size = 24): string {
  const rows = SPRITES[sprite];
  if (!rows) return '';
  const scale = spriteScale(sprite, size);
  return `<img class="sprite" src="${spriteURL(sprite)}" width="${rows[0].length * scale}" height="${rows.length * scale}" alt="">`;
}

// Seconds for labels: 18 → "18s", 0.64 → "0.64s"
export const formatSeconds = (s: number) => `${Number(s.toFixed(2))}s`;

// Longer spans for people: 4380 → "1 h 13 min", 95 → "1 min 35 s"
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = Math.floor(seconds % 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min${sec ? ` ${sec} s` : ''}`;
  return `${sec} s`;
}

// A rough wait for the "ready in …" hints: 8 → "8s", 130 → "2 min", 5400 → "1.5 h".
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 360) / 10} h`;
}
