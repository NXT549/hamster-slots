// dom.ts — VIEW helpers shared by the view files (ui, shop, capsules, debug …).
// Small, boring functions that make drawing every frame cheap.

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
function twoDecimals(x: number): string {
  return String(Math.floor(x * 100) / 100);
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
export function replayClass(node: HTMLElement, cls: string): void {
  node.classList.remove(cls);
  void node.offsetWidth; // forces the browser to notice the removal
  node.classList.add(cls);
}

// An inline pixel icon for HTML strings (e.g. a coin before a price), about
// `size` CSS pixels wide. Like every sprite, it's scaled by a whole number.
export function iconHTML(sprite: string, size = 24): string {
  const rows = SPRITES[sprite];
  if (!rows) return '';
  const scale = spriteScale(sprite, size);
  return `<img class="sprite" src="${spriteURL(sprite)}" width="${rows[0].length * scale}" height="${rows.length * scale}" alt="">`;
}

// Sub-tabs inside a tray tab. `nav` holds buttons with data-sub="name"; `root`
// holds the matching <div class="subpanel" data-sub="name">. Opening one hides the
// others. The choice is remembered in settings.subTabs[key] (a view setting, not
// game progress). Returns helpers to open a sub-tab, show a dot on one ("something
// here is ready") and rename or hide one.
// Only the part of the settings (save.ts) that sub-tabs use.
interface SubTabSettings {
  subTabs?: Record<string, string>;
}

export function createSubTabs(
  nav: HTMLElement,
  root: HTMLElement,
  { key, settings, onSettingsChange }: { key: string; settings?: SubTabSettings | null; onSettingsChange: () => void },
) {
  const buttons = [...nav.querySelectorAll<HTMLElement>('[data-sub]')];
  const panels = [...root.querySelectorAll<HTMLElement>('.subpanel')];
  const names = buttons.map((b) => b.dataset.sub!);
  let current: string | null = null;

  function open(name: string, remember = true): void {
    if (!names.includes(name)) name = names[0];
    current = name;
    for (const b of buttons) b.classList.toggle('active', b.dataset.sub === name);
    for (const p of panels) p.classList.toggle('hidden', p.dataset.sub !== name);
    if (remember && settings) {
      settings.subTabs = { ...(settings.subTabs || {}), [key]: name };
      onSettingsChange();
    }
  }
  for (const b of buttons) {
    b.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      open(b.dataset.sub!);
    });
  }
  open((settings && settings.subTabs && settings.subTabs[key]) || names[0], false);

  const button = (name: string) => buttons.find((b) => b.dataset.sub === name);
  return {
    open,
    get current() { return current; },
    setDot(name: string, on: unknown) { const b = button(name); if (b) b.classList.toggle('alert', !!on && current !== name); },
    setLabel(name: string, text: string) { const b = button(name); if (b) setText(b, text); },
    setHidden(name: string, hidden: unknown) {
      const b = button(name);
      if (!b) return;
      b.classList.toggle('hidden', !!hidden);
      if (hidden && current === name) open(names[0], false);
    },
  };
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
