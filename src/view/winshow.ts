// winshow.ts — VIEW layer. The pokie "win show" that plays after a spin lands:
//   1) every winning cell glows (and every winning line is drawn), while the WIN
//      meter under the reels counts up to the total: faster or slower by win tier;
//   2) then the winning lines take turns, ONE AT A TIME: only that line is drawn
//      and lit, and a label names it ("Line 4 · Baby Carrot ×3 · 150"). Scatters
//      that started a feature get a turn of their own.
// It loops until the next spin starts. A tap on the reels skips to the total.
//
// View only (D92): the coins were already paid when the spin ended, so the show can
// be cut short, skipped or turned off and nothing about the economy changes.
// It runs on real time (performance.now()), so it looks the same at any game speed.

import { lineClass } from './reels.ts';
import { formatCoins } from './dom.ts';
import type { Reels } from './reels.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';
import type { Game } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import type { GameEvents, PaidWin, Cell } from '../logic/types.ts';

// One turn of the show: everything lit, one line, or the feature's scatters.
type Step = { kind: 'all' } | { kind: 'line'; win: PaidWin } | { kind: 'feature'; cells: Cell[] };

// The show that's playing (null when there's none).
interface Show {
  steps: Step[];
  total: Money;
  countFor: number; // ms the meter takes to count up
  start: number;
  step: number; // which step is showing (-1 = the first "everything lit" count-up)
  stepStart: number;
  skipped: boolean;
  featureText: string;
}

// What the win show draws on and uses.
interface WinShowParts {
  game: Game;
  reels: Reels;
  meter: HTMLElement;
  meterValue: HTMLElement;
  label: HTMLElement;
  reelsEl: HTMLElement;
  fx: Fx;
  sound: Sound;
  lessMotion: () => boolean;
}

// Real seconds the meter takes to count up, by win tier (see WIN_FX in ui.ts).
const COUNT_SECONDS: Record<string, number> = { win: 0.5, nice: 0.9, big: 1.4, jackpot: 2.2 };
const HOLD_ALL = 0.7; // the "everything lit" view before the lines take turns (and between loops)
const LINE_SECONDS = 1.0; // one line's turn
const FEATURE_SECONDS = 1.4; // the scatters' turn

export function createWinShow({ game, reels, meter, meterValue, label, reelsEl, fx, sound, lessMotion }: WinShowParts) {
  let show: Show | null = null; // { steps, total, countFor, start, step, stepStart, skipped, featureText }
  let lastTick = 0;

  const symbolName = (id: string | null) => {
    const s = game.getMachineData().symbols.find((x) => x.id === id);
    return s ? s.name : id;
  };
  const num = (n: Money) => `<b class="num">${formatCoins(n)}</b>`;

  // What a line's turn says. One-line machines don't number their line.
  function lineText(w: PaidWin): string {
    const many = game.getLineCount() > 1;
    const wild = w.usedWild && w.symbolId !== 'wild' ? ' (with a wild)' : '';
    return `${many ? `Line ${w.line + 1} · ` : ''}${symbolName(w.symbolId)} ×${w.count}${wild} · ${num(w.payout)}`;
  }

  // The label takes the colour of the line it names (line-N classes set --lc).
  function setLabel(html: string, line: number | null = null): void {
    label.className = `line-label${html ? '' : ' hidden'}${line === null ? '' : ` ${lineClass(line)}`}`;
    label.innerHTML = html || '';
  }

  function setMeter(value: Money | null): void {
    meterValue.textContent = value === null ? '' : formatCoins(value);
  }

  // Called on "spinResolved" for the machine you're looking at.
  function start(e: GameEvents['spinResolved']): void {
    const steps: Step[] = [];
    if (e.wins.length > 1 || (e.wins.length && e.featureCells.length)) steps.push({ kind: 'all' });
    for (const w of e.wins) steps.push({ kind: 'line', win: w });
    if (e.featureCells.length) steps.push({ kind: 'feature', cells: e.featureCells });
    if (!steps.length) { stop(); return; }
    const now = performance.now();
    show = {
      steps, total: e.payout, start: now, step: -1, stepStart: now, skipped: false, featureText: '',
      countFor: lessMotion() ? 0 : (COUNT_SECONDS[e.tier] || COUNT_SECONDS.win) * 1000,
    };
    reelsEl.classList.add('show-skip');
    // Step 1: everything lit while the meter counts.
    reels.showWin(e.wins);
    if (e.featureCells.length) reels.showFeature(e.featureCells);
    setLabel(e.wins.length === 1 && !e.featureCells.length ? lineText(e.wins[0]) : '', e.wins.length === 1 ? e.wins[0].line : null);
  }

  // The feature's own words, once ui.ts knows them ("8 free spins!", "The jackpot wheel!").
  // (The game says what a feature won just after the spin lands.) It's shown right
  // away, during the first "everything lit" step too: free spins start playing after
  // a 1 s pause, before the show would reach the scatters' own turn.
  function setFeatureText(text: string): void {
    if (!show) return;
    show.featureText = text;
    const s = show.steps[show.step];
    if (show.step < 0 || (s && s.kind !== 'line')) setLabel(text);
  }

  // Called on "spinStarted": the next spin wipes the show and the meter.
  function stop() {
    show = null;
    reelsEl.classList.remove('show-skip');
    setLabel('');
    setMeter(null);
    meter.classList.remove('counting');
  }

  // A tap on the reels: jump to the total, everything lit, and stop cycling.
  function skip() {
    if (!show || show.skipped) return;
    show.skipped = true;
    show.countFor = 0;
    reels.clearWin();
    const wins = show.steps.filter((s) => s.kind === 'line').map((s) => s.win);
    reels.showWin(wins);
    const feature = show.steps.find((s) => s.kind === 'feature');
    if (feature) reels.showFeature(feature.cells);
    if (feature && show.featureText) setLabel(show.featureText);
    else setLabel(wins.length === 1 ? lineText(wins[0]) : '', wins.length === 1 ? wins[0].line : null);
    setMeter(show.total);
    meter.classList.remove('counting');
  }
  reelsEl.addEventListener('click', skip);

  // Show one turn of the cycle.
  function enterStep(i: number, now: number): void {
    if (!show) return;
    show.step = i;
    show.stepStart = now;
    const s = show.steps[i];
    reels.clearWin();
    if (s.kind === 'all') {
      reels.showWin(show.steps.filter((x) => x.kind === 'line').map((x) => x.win));
      const feature = show.steps.find((x) => x.kind === 'feature');
      if (feature) reels.showFeature(feature.cells);
      setLabel(feature ? show.featureText : '');
    } else if (s.kind === 'line') {
      reels.showWin([s.win]);
      setLabel(lineText(s.win), s.win.line);
      // Sparkles along the line as it's shown, in its colour.
      const colour = getComputedStyle(label).getPropertyValue('--lc').trim();
      for (const cell of reels.cellsFor(s.win)) fx.sparkleOver(cell, { count: 3, palette: colour ? [colour, '#ffffff'] : fx.colors.gold });
    } else {
      reels.showFeature(s.cells);
      setLabel(show.featureText || 'Bonus!');
    }
  }

  // Called every frame.
  function render(now: number): void {
    if (!show) return;
    // The meter counts up (ease-out), with a soft tick now and then.
    const t = show.countFor > 0 ? Math.min(1, (now - show.start) / show.countFor) : 1;
    setMeter(show.total.mul(1 - (1 - t) * (1 - t)));
    meter.classList.toggle('counting', t < 1);
    if (t < 1 && now - lastTick > 90) {
      lastTick = now;
      sound.play('tick');
    }
    if (show.skipped || show.steps.length < 2) return; // one line (or skipped): nothing to cycle
    // After the count-up and a short hold, the turns begin, and loop.
    const begin = show.start + show.countFor + HOLD_ALL * 1000;
    if (now < begin) return;
    const s = show.steps[show.step];
    const length = !s ? 0 : s.kind === 'all' ? HOLD_ALL : s.kind === 'feature' ? FEATURE_SECONDS : LINE_SECONDS;
    if (show.step < 0 || now - show.stepStart >= length * 1000) {
      // Skip the "all" step on the first pass (it was just shown during the count-up).
      let next = (show.step + 1) % show.steps.length;
      if (show.step < 0 && show.steps[0].kind === 'all') next = 1;
      enterStep(next, now);
    }
  }

  return { start, stop, skip, render, setFeatureText, get active() { return !!show; } };
}
