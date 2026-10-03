// kit.ts — VIEW layer. The kit: one set of pieces every screen is built from (1.6.0,
// "New Digs"; DESIGN §31 → The kit).
//
// Before 1.6.0 every screen built its own buttons, tiles, two-tap confirms and progress
// bars, each a little different. Now they're made here, once:
//   button, buyButton, confirmButton (two taps), toggle (a brass switch or a lever),
//   segmented (×1 / ×10 / Max …), stepper (− value +), createSubTabs, tile, createSheet
//   (the detail sheet in the tray), card, listRow, statRow, statTile, chip, gauge, amount,
//   more (a "How it works" fold) and drawer (the Locked drawer).
//
// Each piece is a plain function that builds its DOM ONCE and returns { el, update(…) }:
// the frame loop calls update() every frame, and update() only touches the page when a
// value really changed (setText / setHTML skip writes that change nothing). No framework:
// that's all a UI framework would do for us here, and it would be a new dependency (rule 5).
//
// The look lives in styles/kit.css: wood, paper, brass and enamel frames painted by frames.ts.
// UI sounds (part 8) go through uiSound(): a no-op until sound.ts plugs in with setUiSound().

import { spriteImg } from './art.ts';
import { setText, setHTML, formatCoins, formatWhole, iconHTML } from './dom.ts';
import type { Money } from '../logic/money.ts';

// ─────────────────────── small helpers (one copy each) ───────────────────────

// The element with this id (every id the view uses is in index.html).
export const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// "1st", "2nd", "3rd", "5th" …
export function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
}

// 0.237 → "24%"
export const pct = (v: number) => `${Math.round(v * 100)}%`;

// A new element with a class (and text).
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// The game's currencies: their icon (a 12×12 sprite) and their names.
export type Currency = 'coin' | 'seed' | 'token' | 'chip' | 'whisker' | 'takings';
export const CURRENCIES: Record<Currency, { sprite: string; name: string; one: string }> = {
  coin: { sprite: 'coin', name: 'coins', one: 'coin' },
  seed: { sprite: 'heirloom', name: 'Heirloom Seeds', one: 'Heirloom Seed' },
  token: { sprite: 'token', name: 'Hamster Tokens', one: 'Hamster Token' },
  chip: { sprite: 'chip', name: 'Casino Chips', one: 'Casino Chip' },
  whisker: { sprite: 'whisker', name: 'Golden Whiskers', one: 'Golden Whisker' },
  takings: { sprite: 'takings', name: 'Takings', one: 'Taking' },
};

// An amount as text: coins with their K/M/B ("1.22M"), the rest as whole numbers.
export function formatAmount(currency: Currency, value: Money | number): string {
  // Takings (M12) build up in fractions (a guest's share of a spin): shown whole, with K/M/B.
  if (currency === 'takings') return formatCoins(typeof value === 'number' ? Math.floor(value) : value.floor());
  return currency === 'coin' ? formatCoins(value) : formatWhole(value);
}

// An amount with its currency icon, as HTML (for text that's written in one go).
export function amountHTML(currency: Currency, value: Money | number, size = 24): string {
  return `<span class="k-amount">${iconHTML(CURRENCIES[currency].sprite, size)}<span class="num">${formatAmount(currency, value)}</span></span>`;
}

// The same as an element that updates itself (the icon is made once, not every frame).
export function amount(currency: Currency, size = 24) {
  const el = h('span', 'k-amount');
  el.append(spriteImg(CURRENCIES[currency].sprite, size, ''));
  const num = el.appendChild(h('span', 'num'));
  return { el, update(value: Money | number) { setText(num, formatAmount(currency, value)); } };
}

// ─────────────────────── UI sounds (part 8) ───────────────────────

// The pieces call uiSound('press'), uiSound('tab') …; sound.ts decides what each sounds like
// (and whether the UI sounds setting is on). Until it plugs in, they're silent.
let uiSoundFn: (name: string) => void = () => {};
export function setUiSound(fn: (name: string) => void): void {
  uiSoundFn = fn;
}
export function uiSound(name: string): void {
  uiSoundFn(name);
}

// ─────────────────────── two taps (pure, tested) ───────────────────────

// The two-tap rule for big choices (D24: retire, reset, rebuild, migrate, load a save): the
// first tap ARMS it, a second tap within `ms` confirms, and it disarms by itself after `ms`.
// It's given the time, so the tests can run it without a clock.
export function createArm(ms = 4000) {
  let until = 0;
  return {
    press(now: number): 'armed' | 'confirmed' {
      if (now < until) {
        until = 0;
        return 'confirmed';
      }
      until = now + ms;
      return 'armed';
    },
    armed(now: number): boolean { return now < until; },
    left(now: number): number { return Math.max(0, until - now); },
    disarm(): void { until = 0; },
  };
}

// ─────────────────────── lists by key ───────────────────────

// Keep a container's children in step with a list: reuse the piece for a key that's still
// there, make pieces for new keys, drop the ones that went, and put them in the list's order.
// (Rebuilding a whole list every time it changes would lose focus and scroll and restart
// animations.) `cache` is the map from the last call; the new map is returned.
export function keyedList<T, P extends { el: HTMLElement }>(
  container: HTMLElement, items: readonly T[], keyOf: (item: T) => string, make: (item: T) => P, cache: Map<string, P> = new Map(),
): Map<string, P> {
  const next = new Map<string, P>();
  items.forEach((item, i) => {
    const key = keyOf(item);
    const piece = cache.get(key) || make(item);
    next.set(key, piece);
    if (container.children[i] !== piece.el) container.insertBefore(piece.el, container.children[i] || null);
  });
  for (const [key, piece] of cache) if (!next.has(key)) piece.el.remove();
  // Anything else left over at the end (not one of ours any more) goes too.
  while (container.children.length > next.size) container.lastElementChild!.remove();
  return next;
}

// ─────────────────────── buttons ───────────────────────

export type Tone = 'primary' | 'soft' | 'buy' | 'gold' | 'danger' | 'token' | 'heirloom' | 'off' | 'black' | 'wood' | 'brass' | 'luck';
export type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonOptions {
  tone?: Tone;
  size?: Size;
  label?: string;
  icon?: string | null; // a sprite name
  iconSize?: number;
  meta?: string; // a second line (a cost, a time)
  ariaLabel?: string;
  className?: string;
  sound?: string | null; // the UI sound on a press (null: the caller plays its own)
  onClick?: (e: MouseEvent) => void;
}

// An enamel button (or a wooden key: tone "wood"). Pressing it pushes its face down into
// its lip (styles/kit.css). Blurred after a click, so Space (spin) never presses it again.
export function button(o: ButtonOptions = {}) {
  const el = h('button', `k-btn fr tone-${o.tone || 'wood'} size-${o.size || 'md'}${o.className ? ` ${o.className}` : ''}`);
  el.type = 'button';
  if (o.ariaLabel) el.setAttribute('aria-label', o.ariaLabel);
  const face = el.appendChild(h('span', 'k-btn-face'));
  let iconEl: HTMLElement | null = null;
  if (o.icon) iconEl = face.appendChild(spriteImg(o.icon, o.iconSize || 16, ''));
  const label = face.appendChild(h('span', 'k-btn-label', o.label || ''));
  const meta = face.appendChild(h('span', 'k-btn-meta', o.meta || ''));
  if (!o.meta) meta.classList.add('hidden');
  let tone = o.tone || 'wood';
  el.addEventListener('click', (e) => {
    el.blur();
    if (o.sound !== null) uiSound(o.sound || 'press');
    if (o.onClick) o.onClick(e);
  });
  return {
    el, face, label, meta,
    get icon() { return iconEl; },
    update({ label: text, meta: m, metaHTML, disabled, busy, tone: t }: { label?: string; meta?: string; metaHTML?: string; disabled?: boolean; busy?: boolean; tone?: Tone } = {}) {
      if (text !== undefined) setText(label, text);
      if (m !== undefined) { setText(meta, m); meta.classList.toggle('hidden', m === ''); }
      if (metaHTML !== undefined) { setHTML(meta, metaHTML); meta.classList.toggle('hidden', metaHTML === ''); }
      if (disabled !== undefined && el.disabled !== disabled) el.disabled = disabled;
      if (busy !== undefined) el.classList.toggle('is-busy', busy);
      if (t !== undefined && t !== tone) { el.classList.replace(`tone-${tone}`, `tone-${t}`); tone = t; }
    },
  };
}
export type Button = ReturnType<typeof button>;

// A buy button: the cost with its currency, filling up (candy stripes) while you save up.
//   ready   you can afford it (green)        saving  not yet (the fill shows how close)
//   maxed   nothing left to buy (gold)       locked  can't be bought yet (a padlock)
//   switch  a machine you own (blue)         running the machine you're on (gold)
export type BuyState = 'ready' | 'saving' | 'maxed' | 'locked' | 'switch' | 'running';
const BUY_TONE: Record<BuyState, Tone> = { ready: 'buy', saving: 'off', maxed: 'gold', locked: 'off', switch: 'soft', running: 'gold' };

export function buyButton({ onClick, size = 'md', className = '', ariaLabel }: { onClick: () => void; size?: Size; className?: string; ariaLabel?: string }) {
  const b = button({ tone: 'buy', size, className: `k-buy ${className}`, sound: null, ariaLabel, onClick: () => onClick() });
  const fill = b.el.insertBefore(h('span', 'k-buy-fill'), b.face);
  let iconName = '';
  let iconEl: HTMLElement | null = null;
  let state: BuyState | '' = '';
  let shownFill = -1;
  const setIcon = (name: string) => {
    if (name === iconName) return;
    iconName = name;
    if (iconEl) iconEl.remove();
    iconEl = name ? b.face.insertBefore(spriteImg(name, name === 'lock' ? 16 : 24, ''), b.label) : null;
  };
  return {
    el: b.el,
    // `verb` goes before the cost ("Plant · 12"); `label` is what an unpriced state says instead of its default.
    update({ state: s, cost, currency = 'coin', count = 1, progress = 0, label, verb = '' }:
      { state: BuyState; cost?: Money | number; currency?: Currency; count?: number; progress?: number; label?: string; verb?: string }) {
      if (s !== state) {
        b.update({ tone: BUY_TONE[s] });
        b.el.classList.toggle('is-saving', s === 'saving');
        b.el.classList.toggle('is-locked', s === 'locked');
        state = s;
      }
      const priced = s === 'ready' || s === 'saving';
      setIcon(priced ? CURRENCIES[currency].sprite : s === 'locked' ? 'lock' : '');
      const text = label !== undefined && !priced ? label
        : priced && cost !== undefined ? `${verb ? `${verb} · ` : ''}${count > 1 ? `×${count} · ` : ''}${formatAmount(currency, cost)}`
          : s === 'maxed' ? 'Max' : s === 'locked' ? 'Locked' : s === 'switch' ? 'Switch' : s === 'running' ? 'Running' : '';
      b.update({ label: text, disabled: s === 'maxed' || s === 'locked' || s === 'running' });
      b.label.classList.toggle('num', priced);
      // The fill: only while saving up, and only redrawn when it moves a visible step.
      const f = s === 'saving' ? Math.max(0, Math.min(1, progress)) : 0;
      const step = Math.round(f * 200);
      if (step !== shownFill) {
        shownFill = step;
        fill.style.width = `${step / 2}%`;
      }
    },
  };
}
export type BuyButton = ReturnType<typeof buyButton>;

// The two-tap button. The first tap arms it: it turns into a brass "Tap again" plate and a
// fuse burns down along its bottom; a second tap within 4 s confirms; then it disarms.
export function confirmButton({ label, armedLabel, onConfirm, tone = 'gold', size = 'md', ms = 4000, className = '' }:
  { label: string; armedLabel: string; onConfirm: () => void; tone?: Tone; size?: Size; ms?: number; className?: string }) {
  const arm = createArm(ms);
  let labels = { label, armedLabel };
  let timer = 0;
  const b = button({ tone, size, label, className: `k-confirm ${className}`, sound: null, onClick: () => press() });
  const fuse = b.el.appendChild(h('span', 'k-fuse'));
  b.el.style.setProperty('--fuse-ms', `${ms}ms`);
  function disarm(): void {
    arm.disarm();
    window.clearTimeout(timer);
    b.el.classList.remove('is-armed');
    b.update({ label: labels.label });
  }
  function press(): void {
    if (b.el.disabled) return;
    if (arm.press(performance.now()) === 'confirmed') {
      disarm();
      onConfirm();
      return;
    }
    b.el.classList.add('is-armed');
    b.update({ label: labels.armedLabel });
    fuse.classList.remove('burning');
    void fuse.offsetWidth; // restart the fuse's animation
    fuse.classList.add('burning');
    uiSound('arm');
    window.clearTimeout(timer);
    timer = window.setTimeout(disarm, ms);
  }
  return {
    el: b.el, disarm,
    get armed() { return arm.armed(performance.now()); },
    update({ label: l, armedLabel: a, disabled }: { label?: string; armedLabel?: string; disabled?: boolean } = {}) {
      labels = { label: l ?? labels.label, armedLabel: a ?? labels.armedLabel };
      if (disabled && arm.armed(performance.now())) disarm();
      b.update({ label: arm.armed(performance.now()) ? labels.armedLabel : labels.label, disabled });
    },
  };
}
export type ConfirmButton = ReturnType<typeof confirmButton>;

// An on/off switch: a brass slot with a knob that slides across (kind "switch"), or a lever
// with a lamp (kind "lever": the auto-spin pause). One "off" look everywhere. It never flips
// itself: onChange asks for the new value, and the next update() shows what's true.
export function toggle({ kind = 'switch', label = '', onLabel = 'On', offLabel = 'Off', ariaLabel, onChange, className = '' }:
  { kind?: 'switch' | 'lever'; label?: string; onLabel?: string; offLabel?: string; ariaLabel?: string; onChange: (on: boolean) => void; className?: string }) {
  const el = h('button', `k-toggle kind-${kind}${className ? ` ${className}` : ''}`);
  el.type = 'button';
  el.setAttribute('aria-pressed', 'false');
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  if (kind === 'lever') {
    el.append(h('span', 'k-lamp'));
    const lever = el.appendChild(h('span', 'k-lever fr'));
    lever.append(h('span', 'k-lever-knob fr'));
  } else {
    if (label) el.append(h('span', 'k-toggle-label', label));
    const track = el.appendChild(h('span', 'k-toggle-track fr'));
    track.append(h('span', 'k-toggle-knob fr'));
  }
  const state = kind === 'switch' ? el.appendChild(h('span', 'k-toggle-state')) : null;
  let on: boolean | null = null;
  el.addEventListener('click', () => {
    el.blur();
    uiSound('switch');
    onChange(!on);
  });
  return {
    el,
    update(value: boolean, disabled = false) {
      if (value !== on) {
        on = value;
        el.classList.toggle('is-on', value);
        el.setAttribute('aria-pressed', String(value));
        if (state) setText(state, value ? onLabel : offLabel);
      }
      if (el.disabled !== disabled) el.disabled = disabled;
    },
  };
}
export type Toggle = ReturnType<typeof toggle>;

// A row of options, all always showing, the chosen one lit (×1 / ×10 / Max, Motion, Reels …).
export function segmented<V>({ options, ariaLabel, onPick, className = '' }:
  { options: { value: V; label: string; icon?: string; title?: string }[]; ariaLabel: string; onPick: (value: V) => void; className?: string }) {
  const el = h('div', `k-seg${className ? ` ${className}` : ''}`);
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', ariaLabel);
  const buttons = options.map((o) => {
    const b = h('button', 'k-seg-opt fr');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    if (o.title) b.title = o.title;
    if (o.icon) b.append(spriteImg(o.icon, 16, ''));
    b.append(h('span', '', o.label));
    b.addEventListener('click', () => {
      b.blur();
      uiSound('tick');
      onPick(o.value);
    });
    el.append(b);
    return b;
  });
  let shown: V | undefined;
  return {
    el, buttons,
    update(value: V, isDisabled?: (v: V) => boolean) {
      if (value !== shown) {
        shown = value;
        buttons.forEach((b, i) => {
          b.setAttribute('aria-pressed', String(options[i].value === value));
          b.classList.toggle('is-on', options[i].value === value);
        });
      }
      if (isDisabled) buttons.forEach((b, i) => { const d = isDisabled(options[i].value); if (b.disabled !== d) b.disabled = d; });
    },
  };
}
export type Segmented<V> = ReturnType<typeof segmented<V>>;

// − value +: the bet, the casino's bets. A label above the value and a hint under it.
export function stepper({ label = '', onStep, ariaDown = 'Less', ariaUp = 'More', className = '' }:
  { label?: string; onStep: (step: number) => void; ariaDown?: string; ariaUp?: string; className?: string }) {
  const el = h('div', `k-stepper${className ? ` ${className}` : ''}`);
  const down = button({ tone: 'wood', label: '−', ariaLabel: ariaDown, className: 'k-step-btn', sound: null, onClick: () => onStep(-1) });
  const value = h('div', 'k-step-value fr');
  const labelEl = value.appendChild(h('span', 'k-step-label', label));
  if (!label) labelEl.classList.add('hidden');
  const num = value.appendChild(h('span', 'k-step-num num'));
  const hint = value.appendChild(h('span', 'k-step-hint'));
  const up = button({ tone: 'wood', label: '+', ariaLabel: ariaUp, className: 'k-step-btn', sound: null, onClick: () => onStep(1) });
  el.append(down.el, value, up.el);
  return {
    el, down, up,
    update({ value: v, valueHTML, hint: t, canDown = true, canUp = true, upLocked = false, warn = false }:
      { value?: string; valueHTML?: string; hint?: string; canDown?: boolean; canUp?: boolean; upLocked?: boolean; warn?: boolean }) {
      if (v !== undefined) setText(num, v);
      if (valueHTML !== undefined) setHTML(num, valueHTML);
      if (t !== undefined) { setText(hint, t); hint.classList.toggle('hidden', t === ''); }
      down.update({ disabled: !canDown });
      up.update({ disabled: !canUp });
      up.el.classList.toggle('is-locked', upLocked);
      el.classList.toggle('is-warn', warn);
    },
  };
}
export type Stepper = ReturnType<typeof stepper>;

// ─────────────────────── sub-tabs ───────────────────────

// Sub-tabs inside a tray tab. `nav` holds buttons with data-sub="name"; `root` holds the
// matching <div class="subpanel" data-sub="name">. Opening one hides the others. The choice
// is remembered in settings.subTabs[key] (a view setting, not game progress). They're real
// tabs for screen readers (role tab / tabpanel, aria-selected). Returns helpers to open one,
// show a dot on one ("something here is ready"), and rename or hide one.
// (Moved here from dom.ts in 1.6.0; `icons` and `onChange` are new.)
interface SubTabSettings {
  subTabs?: Record<string, string>;
}

export function createSubTabs(
  nav: HTMLElement,
  root: HTMLElement,
  { key, settings, onSettingsChange, icons, onChange }:
    { key: string; settings?: SubTabSettings | null; onSettingsChange: () => void; icons?: Record<string, string>; onChange?: (name: string) => void },
) {
  const buttons = [...nav.querySelectorAll<HTMLElement>('[data-sub]')];
  const panels = [...root.querySelectorAll<HTMLElement>('.subpanel')];
  const names = buttons.map((b) => b.dataset.sub!);
  let current: string | null = null;
  nav.setAttribute('role', 'tablist');
  const labels = new Map<string, HTMLElement>();
  for (const b of buttons) {
    const name = b.dataset.sub!;
    b.setAttribute('role', 'tab');
    if (!b.id) b.id = `subtab-${key}-${name}`;
    // The words go in a span of their own, so an icon can sit beside them and a rename keeps it.
    const words = h('span', 'k-subtab-label', b.textContent || '');
    b.replaceChildren(words);
    if (icons && icons[name]) {
      b.prepend(spriteImg(icons[name], 16, ''));
      b.title = words.textContent || '';
    }
    labels.set(name, words);
    const panel = panels.find((p) => p.dataset.sub === name);
    if (panel) {
      if (!panel.id) panel.id = `subpanel-${key}-${name}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', b.id);
      b.setAttribute('aria-controls', panel.id);
    }
  }

  function open(name: string, remember = true): void {
    if (!names.includes(name)) name = names[0];
    const changed = current !== null && current !== name;
    current = name;
    for (const b of buttons) {
      const on = b.dataset.sub === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const p of panels) p.classList.toggle('hidden', p.dataset.sub !== name);
    if (remember && settings) {
      settings.subTabs = { ...(settings.subTabs || {}), [key]: name };
      onSettingsChange();
    }
    fit();
    if (changed && onChange) onChange(name);
  }

  // They stay on one row: when the names don't fit, only the open one keeps its name and the
  // others show their icons (.compact); if that's still too wide (no icons), they wrap (.wrap).
  function fit(): void {
    nav.classList.remove('compact', 'wrap');
    if (nav.scrollWidth <= nav.clientWidth + 1) return;
    if (icons) {
      nav.classList.add('compact');
      if (nav.scrollWidth <= nav.clientWidth + 1) return;
    }
    nav.classList.add('wrap');
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fit()).observe(nav);
  for (const b of buttons) {
    b.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      if (current !== b.dataset.sub) uiSound('subtab');
      open(b.dataset.sub!);
    });
  }
  open((settings && settings.subTabs && settings.subTabs[key]) || names[0], false);

  const button = (name: string) => buttons.find((b) => b.dataset.sub === name);
  return {
    open,
    get current() { return current; },
    setDot(name: string, on: unknown) { const b = button(name); if (b) b.classList.toggle('alert', !!on && current !== name); },
    setLabel(name: string, text: string) {
      const l = labels.get(name);
      if (!l || l.textContent === text) return;
      setText(l, text);
      const b = button(name);
      if (b) b.title = text; // (shown as its icon alone on a narrow tray)
      fit();
    },
    setHidden(name: string, hidden: unknown) {
      const b = button(name);
      if (!b || b.classList.contains('hidden') === !!hidden) return;
      b.classList.toggle('hidden', !!hidden);
      if (hidden && current === name) open(names[0], false);
      fit();
    },
  };
}
export type SubTabs = ReturnType<typeof createSubTabs>;

// ─────────────────────── tiles and the sheet ───────────────────────

export type TileTone = 'plain' | 'ready' | 'maxed' | 'selected' | 'locked' | 'planted';

// A tile: icon, name, level, a short effect, pips. THE WHOLE TILE is one tap target (it
// opens the sheet): an invisible button covers it, under everything but the buy button,
// which stays a separate 44 px target (one tap still buys, D132).
export function tile({ icon, iconSize = 32, name, onOpen, buy = null, pips = 0, className = '' }:
  { icon: string | null; iconSize?: number; name: string; onOpen: () => void; buy?: { el: HTMLElement } | null; pips?: number; className?: string }) {
  const el = h('div', `k-tile fr${className ? ` ${className}` : ''}`);
  const hit = el.appendChild(h('button', 'k-tile-hit'));
  hit.type = 'button';
  hit.setAttribute('aria-label', `About ${name}`);
  hit.setAttribute('aria-expanded', 'false');
  hit.addEventListener('click', () => {
    hit.blur();
    onOpen();
  });
  const iconBox = el.appendChild(h('span', 'k-tile-icon'));
  iconBox.append(spriteImg(icon, iconSize, name[0]));
  const text = el.appendChild(h('span', 'k-tile-text'));
  const head = text.appendChild(h('span', 'k-tile-head'));
  head.append(h('span', 'k-tile-name', name));
  const level = head.appendChild(h('span', 'k-tile-level'));
  const effect = text.appendChild(h('span', 'k-tile-effect'));
  const pipBox = text.appendChild(h('span', 'k-pips'));
  const pipEls: HTMLElement[] = [];
  for (let i = 0; i < pips; i++) pipEls.push(pipBox.appendChild(h('i')));
  if (!pips) pipBox.remove();
  if (buy) el.append(buy.el);
  let tone: TileTone = 'plain';
  let filled = -1;
  return {
    el, hit,
    update({ level: lv, effect: fx, pips: n, tone: t }: { level?: string; effect?: string; pips?: number; tone?: TileTone }) {
      if (lv !== undefined) setText(level, lv);
      if (fx !== undefined) setHTML(effect, fx);
      if (n !== undefined && n !== filled) {
        filled = n;
        pipEls.forEach((p, i) => p.classList.toggle('on', i < n));
      }
      if (t !== undefined && t !== tone) {
        el.classList.remove(`is-${tone}`);
        if (t !== 'plain') el.classList.add(`is-${t}`);
        tone = t;
      }
    },
    setOpen(open: boolean) { hit.setAttribute('aria-expanded', String(open)); },
  };
}
export type Tile = ReturnType<typeof tile>;

// The detail sheet: rises from the bottom of its host (the tray, or the Big Cage's panel),
// never over the cage (D132). A header (icon, title, a tag), a body and a footer that its
// owner fills, and a big close button. One owner at a time: show() with a new key empties
// it for the new owner, who checks sheet.key before updating it. The host's --sheet-h says
// how tall it is, so the host's panels can leave room for it (the tile you tapped scrolls
// into view above the sheet).
export function createSheet(host: HTMLElement) {
  const el = h('section', 'k-sheet fr hidden');
  el.setAttribute('aria-label', 'Details');
  const head = el.appendChild(h('header', 'k-sheet-head'));
  const iconBox = head.appendChild(h('span', 'k-sheet-icon'));
  const titles = head.appendChild(h('div', 'k-sheet-titles'));
  const title = titles.appendChild(h('h3', 'k-sheet-title'));
  const tag = titles.appendChild(h('div', 'k-sheet-tag'));
  const close = button({ tone: 'wood', icon: 'close', ariaLabel: 'Close', className: 'k-sheet-close', sound: null, onClick: () => hide() });
  head.append(close.el);
  const body = el.appendChild(h('div', 'k-sheet-body'));
  const foot = el.appendChild(h('footer', 'k-sheet-foot'));
  host.append(el);
  let key: string | null = null;
  let iconKey = '';
  const hideListeners: ((key: string) => void)[] = [];
  new ResizeObserver(() => host.style.setProperty('--sheet-h', `${key ? el.offsetHeight : 0}px`)).observe(el);

  function show(k: string, { icon = null, iconSize = 32, title: t = '', tag: g = '' }: { icon?: string | null; iconSize?: number; title?: string; tag?: string }): boolean {
    const fresh = key !== k;
    if (fresh) {
      if (key) for (const fn of hideListeners) fn(key); // the old owner's sheet is gone
      body.replaceChildren();
      foot.replaceChildren();
      key = k;
      el.classList.remove('hidden');
      host.classList.add('has-sheet');
      uiSound('sheet');
    }
    const ik = `${icon}|${iconSize}`;
    if (ik !== iconKey) {
      iconKey = ik;
      iconBox.replaceChildren(...(icon ? [spriteImg(icon, iconSize, t[0] || '?')] : []));
    }
    setText(title, t);
    setText(tag, g);
    tag.classList.toggle('hidden', g === '');
    return fresh; // true: fill the body and footer now
  }
  function hide(): void {
    if (!key) return;
    const old = key;
    key = null;
    el.classList.add('hidden');
    host.classList.remove('has-sheet');
    host.style.setProperty('--sheet-h', '0px');
    uiSound('sheet');
    for (const fn of hideListeners) fn(old);
  }
  // Escape closes it (unless a dialog is open: that's what Escape closes then).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && key && !document.querySelector('dialog[open]')) hide();
  });
  return {
    el, body, foot, show, hide,
    get key() { return key; },
    setTag(text: string) { setText(tag, text); tag.classList.toggle('hidden', text === ''); },
    onHide(fn: (key: string) => void) { hideListeners.push(fn); },
  };
}
export type Sheet = ReturnType<typeof createSheet>;

// ─────────────────────── cards, rows, chips, gauges ───────────────────────

export type CardTone = 'plain' | 'gold' | 'heirloom' | 'ready' | 'selected' | 'locked';

// A card: paper on the tray's wood, with a header and a tone (the retire letter, the
// migration card, the Rebuild ticket, the cashier …).
export function card({ tone = 'plain', title = '', icon = null, className = '' }: { tone?: CardTone; title?: string; icon?: string | null; className?: string } = {}) {
  const el = h('div', `k-card fr tone-${tone}${className ? ` ${className}` : ''}`);
  const head = el.appendChild(h('div', 'k-card-head'));
  if (icon) head.append(spriteImg(icon, 16, ''));
  const titleEl = head.appendChild(h('span', 'k-card-title', title));
  if (!title && !icon) head.classList.add('hidden');
  const body = el.appendChild(h('div', 'k-card-body'));
  let shownTone = tone;
  return {
    el, head, body,
    setTitle(text: string) { setText(titleEl, text); head.classList.toggle('hidden', !text && !icon); },
    setTone(t: CardTone) { if (t !== shownTone) { el.classList.replace(`tone-${shownTone}`, `tone-${t}`); shownTone = t; } },
  };
}

// A row in a list: an icon, a title, a line under it, a value at the end, and maybe a bar.
export function listRow({ icon = null, title = '', bar = false }: { icon?: string | null; title?: string; bar?: boolean } = {}) {
  const el = h('div', 'k-row');
  if (icon) el.append(spriteImg(icon, 16, ''));
  const text = el.appendChild(h('div', 'k-row-text'));
  const titleEl = text.appendChild(h('div', 'k-row-title', title));
  const sub = text.appendChild(h('div', 'k-row-sub'));
  const value = el.appendChild(h('div', 'k-row-value'));
  const g = bar ? gauge({}) : null;
  if (g) text.append(g.el);
  return {
    el,
    update({ title: t, sub: s, subHTML, value: v, valueHTML, fraction }: { title?: string; sub?: string; subHTML?: string; value?: string; valueHTML?: string; fraction?: number }) {
      if (t !== undefined) setText(titleEl, t);
      if (s !== undefined) setText(sub, s);
      if (subHTML !== undefined) setHTML(sub, subHTML);
      if (v !== undefined) setText(value, v);
      if (valueHTML !== undefined) setHTML(value, valueHTML);
      if (fraction !== undefined && g) g.update(fraction);
    },
  };
}

// A label and a number, in a ledger line (Stats) or a little tile (the Big Cage's numbers).
export function statRow(label: string) {
  const el = h('div', 'k-stat-row');
  el.append(h('span', 'k-stat-label', label));
  const value = el.appendChild(h('b', 'k-stat-value num'));
  return { el, update(v: string) { setText(value, v); }, updateHTML(v: string) { setHTML(value, v); } };
}
export function statTile(label: string) {
  const el = h('div', 'k-stat-tile fr');
  el.append(h('span', 'k-stat-label', label));
  const value = el.appendChild(h('b', 'k-stat-value num'));
  return { el, update(v: string) { setText(value, v); }, updateHTML(v: string) { setHTML(value, v); } };
}

// A small label in a tone (a feature, a rarity, "new").
export type ChipTone = 'plain' | 'gold' | 'buy' | 'soft' | 'token' | 'heirloom' | 'luck' | 'danger';
export function chip(text: string, tone: ChipTone = 'plain', icon: string | null = null) {
  const el = h('span', `k-chip tone-${tone}`);
  if (icon) el.append(spriteImg(icon, 16, ''));
  const label = el.appendChild(h('span', '', text));
  return { el, update(t: string) { setText(label, t); } };
}

// One progress bar for everything: a glass tube in a brass rim, filled with a colour.
export type GaugeTone = 'buy' | 'gold' | 'heirloom' | 'token' | 'soft' | 'whisker' | 'primary';
export function gauge({ tone = 'buy', label = '' }: { tone?: GaugeTone; label?: string }) {
  const el = h('div', `k-gauge fr tone-${tone}`);
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  if (label) el.setAttribute('aria-label', label);
  const fill = el.appendChild(h('span', 'k-gauge-fill'));
  let shown = -1;
  return {
    el,
    update(fraction: number) {
      const step = Math.round(Math.max(0, Math.min(1, fraction)) * 1000);
      if (step === shown) return;
      shown = step;
      fill.style.width = `${step / 10}%`;
      el.setAttribute('aria-valuenow', String(Math.round(step / 10)));
    },
  };
}

// A "How it works" fold for the long explanations (they used to sit open on every card).
export function more(summary = 'How it works') {
  const el = h('details', 'k-more');
  el.append(h('summary', '', summary));
  const body = el.appendChild(h('div', 'k-more-body'));
  el.addEventListener('toggle', () => uiSound('tick'));
  return { el, body };
}

// The Locked drawer: upgrades that open later, folded away with a padlock and a count.
export function drawer(title = 'Locked') {
  const el = h('details', 'k-drawer');
  const summary = el.appendChild(h('summary', 'k-drawer-head'));
  summary.append(spriteImg('lock', 16, ''));
  const label = summary.appendChild(h('span', 'k-drawer-title'));
  const body = el.appendChild(h('div', 'k-drawer-body'));
  let count = -1;
  return {
    el, body,
    update(n: number, note = '') {
      if (n === count) return;
      count = n;
      setText(label, `${title} (${n})${note ? ` · ${note}` : ''}`);
      el.classList.toggle('hidden', n === 0);
    },
  };
}
