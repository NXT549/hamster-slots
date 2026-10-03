// guide.ts — VIEW layer. The first-time guide (1.9.0, New Digs part 8; DESIGN §31 → The first-time guide).
//
// A new player gets pointed the way: the hamster says what to do next in its speech
// bubble, and a pixel paw bounces beside the thing to tap, with a soft ring round it.
//
// Every step is worked out from the game's own state (guideStep, below), so the save
// doesn't change: the lifetime stats already count everything it needs. A step ends by
// itself once you've done the thing, an old save that's past a step never sees it, and
// a Reset (which clears the stats) brings the guide back. "Skip guide" on the bubble, or
// Menu → Guide, switches it off (a setting, so Reset keeps that choice).
//
// guideStep() is pure (no page needed), so tests/guide.test.js runs it in Node on games
// made with the test helpers. createGuide() is the paw: it never blocks a tap
// (pointer-events: none), and waits while something big plays.

import { spriteImg } from './art.ts';
import type { Game } from '../logic/game.ts';
import type { Sound } from './sound.ts';

// ─────────────────────── the steps (pure, tested) ───────────────────────

export type GuideStepId = 'spin' | 'deliver' | 'upgrade' | 'auto' | 'retire' | 'plant' | 'start' | 'capsules' | 'casino';
export interface GuideStep {
  id: GuideStepId;
  upgrade?: string; // 'upgrade' and 'auto': which upgrade's tile
}
// What the view adds: which tray tab is open (the Capsules and Casino steps show there).
export interface GuideView { tab: string }

// The Wheel Training upgrade (the auto-spin): found by its effect, so a renamed id still works.
export function autoSpinUpgrade(game: Game): string | null {
  const def = game.data.upgrades.find((u) => u.effect.type === 'autoSpin');
  return def ? def.id : null;
}

// The step to show now, or null. In the order of DESIGN §31's table: the first one that applies.
export function guideStep(game: Game, view: GuideView): GuideStep | null {
  const s = game.state;
  const first = s.generation === 1 && s.colony === 0; // the family's very first hamster

  // The Big Cage (after the first retirement): plant the first trait, then start the new life.
  if (s.bigCage) {
    const planted = Object.values(s.tree).some((level) => level > 0);
    if (!planted) return { id: 'plant' };
    if (s.generation === 2 && s.colony === 0) return { id: 'start' };
    return null;
  }

  const machine = s.machines[s.activeMachine];
  const busy = !!(machine && (machine.bonus || machine.hold)) || !!s.gamble || game.hasFreeSpins();
  const broke = s.coins.lt(game.getBetCost());
  if (s.stats.spins === 0 && !broke) return { id: 'spin' };
  if (s.stats.deliveries === 0 && broke && !s.delivery.active && !busy) return { id: 'deliver' };

  if (s.stats.upgradesBought === 0) {
    const ready = game.getAvailableUpgrades().find((d) => game.isUpgradeUnlocked(d.id) && game.canBuyUpgrade(d.id));
    if (ready) return { id: 'upgrade', upgrade: ready.id };
  }
  const auto = autoSpinUpgrade(game);
  if (first && auto && game.getUpgradeLevel(auto) === 0 && game.isUpgradeUnlocked(auto) && game.canBuyUpgrade(auto)) {
    return { id: 'auto', upgrade: auto };
  }
  if (first && game.canRetire()) return { id: 'retire' };

  if (view.tab === 'capsules' && s.stats.capsulesOpened === 0 && game.canPull()) return { id: 'capsules' };
  if (view.tab === 'casino' && s.stats.casinoGames === 0 && game.isCasinoOpen() && s.casino.chips.gt(0)) return { id: 'casino' };
  return null;
}

// What the hamster says for each step (the Big Cage's own hamster speaks for its two).
export const GUIDE_LINES: Record<GuideStepId, ((game: Game) => string) | null> = {
  spin: (game) => `Hi, I'm ${game.getPupName()}! Tap SPIN (or Space). Each spin costs coins: match symbols from the left to win!`,
  deliver: () => 'Out of coins? Send me on a delivery (D): it always pays!',
  upgrade: (game) => `We can afford an upgrade! Tap ${game.getUpgradeDef(guideUpgradeId(game) || '')?.name || 'it'} in Upgrades to buy it.`,
  auto: (game) => `${game.getUpgradeDef(autoSpinUpgrade(game) || '')?.name || 'Wheel Training'} lets me spin the machine by myself. Buy it!`,
  retire: () => 'I can retire! In the Family tab, I pass my Heirloom Seeds to a new pup, and they make the whole family stronger.',
  plant: null,
  start: null,
  capsules: () => 'Pull a capsule with Hamster Tokens: hats, fur and skins, each with a little buff!',
  casino: () => 'Pick a table and play! Casino Chips stay in the casino: they never turn into coins.',
};
// (The first affordable upgrade, for the line above.)
function guideUpgradeId(game: Game): string | null {
  const d = game.getAvailableUpgrades().find((x) => game.isUpgradeUnlocked(x.id) && game.canBuyUpgrade(x.id));
  return d ? d.id : null;
}

// A step that you can choose to put off rests for the rest of this visit once its paw has
// pointed at the real thing (not just its tab) this long: the guide nudges, it doesn't nag.
const REST_MS: Partial<Record<GuideStepId, number>> = { upgrade: 20000, auto: 20000, retire: 10000 };

// ─────────────────────── the paw ───────────────────────

// Where the paw points for a step: the element, and whether it's the step's real target
// (true) or the tab or sub-tab on the way to it (false). ui.ts knows the screens, so it says.
export type GuideTarget = { el: HTMLElement; final: boolean } | null;

export function createGuide(game: Game, { sound, lessMotion, busy, enabled, targetFor }: {
  sound: Sound;
  lessMotion: () => boolean;
  busy: () => boolean; // a celebration, the gamble, the iris, a dialog over it …
  enabled: () => boolean; // the Guide setting
  targetFor: (step: GuideStep) => GuideTarget;
}) {
  // The paw and its ring live in the page, or in the Big Cage while it's open (a dialog sits
  // above everything else). Neither ever takes a tap.
  const root = document.createElement('div');
  root.className = 'coach hidden';
  root.setAttribute('aria-hidden', 'true'); // (the hamster's line is what screen readers hear)
  const ring = root.appendChild(document.createElement('div'));
  ring.className = 'coach-ring';
  const paw = root.appendChild(document.createElement('div'));
  paw.className = 'coach-paw';
  let pawScale = 0;
  document.body.appendChild(root);

  let current: GuideStepId | null = null;
  const pointedFor = new Map<GuideStepId, number>(); // ms the paw has pointed at a step's real target
  const resting = new Set<GuideStepId>(); // steps put off for this visit
  let last = 0;

  function hide(): void {
    root.classList.add('hidden');
  }

  // Every frame (ui.ts), with the open tab. Returns the step showing (for the bubble's line), or null.
  function render(now: number, view: GuideView): GuideStep | null {
    const dt = last ? Math.min(250, now - last) : 0;
    last = now;
    const step = enabled() ? guideStep(game, view) : null;
    const showing = step && !resting.has(step.id) ? step : null;
    if (!showing) {
      current = null;
      hide();
      return null;
    }
    if (showing.id !== current) {
      current = showing.id;
      sound.playUi('guide');
    }
    const target = busy() ? null : targetFor(showing);
    const r = target ? target.el.getBoundingClientRect() : null;
    if (!target || !r || r.width < 2 || r.height < 2) {
      hide();
      return showing; // (the line still shows: the paw comes back when its target does)
    }
    // Rests once it has pointed at the real thing long enough (REST_MS).
    if (target.final && REST_MS[showing.id]) {
      const t = (pointedFor.get(showing.id) || 0) + dt;
      pointedFor.set(showing.id, t);
      if (t > REST_MS[showing.id]!) resting.add(showing.id);
    }
    place(target.el, r);
    return showing;
  }

  // Ring the target and put the paw just above it (below it, pointing up, if there's no room above).
  function place(el: HTMLElement, r: DOMRect): void {
    const host = el.closest('dialog[open]') || document.body;
    if (root.parentElement !== host) host.appendChild(root);
    root.classList.remove('hidden');
    root.classList.toggle('still', lessMotion());
    const scale = window.innerWidth < 360 ? 2 : 3; // the 16×16 paw at a whole scale (2× only on the smallest phones)
    if (scale !== pawScale) {
      pawScale = scale;
      paw.replaceChildren(spriteImg('guidePaw', 16 * scale, ''));
      paw.style.setProperty('--paw', `${16 * scale}px`);
    }
    const pad = 4;
    ring.style.left = `${Math.round(r.left - pad)}px`;
    ring.style.top = `${Math.round(r.top - pad)}px`;
    ring.style.width = `${Math.round(r.width + pad * 2)}px`;
    ring.style.height = `${Math.round(r.height + pad * 2)}px`;
    const size = 16 * scale;
    const below = r.top < size + 12;
    paw.classList.toggle('below', below);
    paw.style.left = `${Math.round(r.left + r.width / 2 - size / 2)}px`;
    paw.style.top = `${Math.round(below ? r.bottom + 6 : r.top - size - 6)}px`;
  }

  return {
    render,
    // Menu → Guide switched back on: anything put off this visit comes back.
    wake() { resting.clear(); pointedFor.clear(); },
    get step() { return current; },
  };
}

export type Guide = ReturnType<typeof createGuide>;
