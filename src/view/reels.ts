// reels.ts — VIEW layer. Draws the reels as vertical strips that scroll and land,
// like a real slot machine, plus the payline markers and the winning lines.
//
// How it works: when a spin starts, each reel gets a long "strip" of symbols:
//   [spare, ROW 0, ROW 1, ROW 2, …random filler…, the 3 symbols showing now]
// The strip starts scrolled to its bottom (what you see now) and slides down
// until the result sits in the window. The slide is driven by game.getSpinProgress(),
// so it automatically follows the game's timing and debug speed-ups.
//
// Every reel window shows 3 rows. On a machine with 3 rows (the Snack Stacker and
// the 5-reel machines) all 3 are real. On a one-row machine (Old Clunky) only the
// middle row counts: the rows above and below are decoration, picked with
// Math.random(), which is fine here because this is the view and it never touches
// the game's own RNG.
//
// Anticipation: when the reels that have stopped already show all but one of the
// scatters a feature needs, the reels still spinning shimmer and land a beat later
// (still inside the same spin time, so the game's timing never changes).
//
// 1.4.0, Moving Day's boxes: the game has already opened them (spinStarted says which
// cells were boxes and what they became), so the reels land them as boxes, and once
// the last reel stops they all pop open into that symbol, just before the win shows.
//
// 1.10.0, Burrow Party: Zoomies (the hamster dashes across the reel window, and the
// reels it ran over land all wild, glowing) and Sticky Wilds (wilds held from an
// earlier free spin land with a honey glow). Both glows sit BEHIND the symbols.

import { symbolImg } from './art.ts';
import { replayClass } from './dom.ts';
import type { Game } from '../logic/game.ts';
import type { Grid, Cell } from '../logic/types.ts';

// One reel on screen: its column, its scrolling strip of symbols, and where the
// strip slides from and to. setStrip() fills in ids, from and to.
interface Reel {
  col: HTMLElement;
  strip: HTMLElement;
  ids: string[];
  from: number;
  to: number;
  stop: number; // the spin progress (0–1) at which it lands
  landed?: boolean;
  tease?: boolean;
}

// A winning line as the reels need it: which payline, how many cells, and from
// which end (a "Pays Both Ways" win counts from the right-hand reel).
interface LineHit {
  line: number;
  count: number;
  fromRight?: boolean;
  cells?: Cell[]; // M9: a ways win lights exactly these cells (it has no line to draw)
}

export const CELL = 72; // height in px of one symbol cell (keep in sync with --cell in style.css)
const VISIBLE = 3; // rows you can see in the window
const OVERSHOOT = 8; // px the strip slides past its stop before settling back
const MAX_TAG_LINES = 5; // more lines than this: no tags down the sides, a badge on winning lines instead
const LINE_COLOURS = 10; // style.css has --line-1 … --line-10; line 11 reuses line 1's colour

// Reels stop left to right, ONE AT A TIME like a real pokie: reel 1 at 30% of the
// spin, the last one at 90%, so the last reel lands just before the payout. With
// a 3-second spin that's a clunk every ~0.45 s on a 5-reel machine. Quick reels
// (a Menu setting) land earlier and closer together, and only drop a few symbols.
function stopPoint(index: number, count: number, quick: boolean): number {
  const [first, last] = quick ? [0.35, 0.6] : [0.3, 0.9];
  return count === 1 ? last : first + ((last - first) * index) / (count - 1);
}

// How many filler symbols a reel scrolls past before it stops: enough to look like
// a fast blur for the whole time it spins (about 10 a second, plus a few), capped
// so a strip never gets huge.
const fillersFor = (stopSeconds: number) => Math.min(40, Math.round(6 + stopSeconds * 10));

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

// 1.5.0: before a reel drops it winds up: a little hitch upwards, like a real reel
// catching (a share of its travel, and how far it rises in px). Quick reels skip it.
const WINDUP = 0.07;
const WINDUP_PX = 12;

// Strip offset for a spin progress t (0 → 1): a wind-up, then a fast slide that
// decelerates, overshoots slightly, then settles. That settle is the little "clunk" of landing.
function stripOffset(from: number, to: number, t: number, overshoot: number, windup: boolean): number {
  if (t >= 1) return to;
  if (windup) {
    if (t < WINDUP) return from - WINDUP_PX * Math.sin((t / WINDUP) * Math.PI);
    t = (t - WINDUP) / (1 - WINDUP);
  }
  const split = 0.85;
  if (t < split) return from + (to + overshoot - from) * easeOutQuad(t / split);
  return to + overshoot * (1 - easeOutQuad((t - split) / (1 - split)));
}

export const lineClass = (index: number) => `line-${index % LINE_COLOURS}`;

// onLand(i) is called once when reel i comes to rest during a spin (for sounds).
// onTease() is called once when the anticipation starts. quick() says whether the
// "quick reels" setting is on.
export function createReels(
  container: HTMLElement,
  game: Game,
  { onLand = () => {}, onTease = () => {}, onOpen = () => {}, quick = () => false, runner = null }: {
    onLand?: (i: number) => void; onTease?: () => void; onOpen?: (cells: HTMLElement[]) => void; quick?: () => boolean;
    runner?: (() => HTMLElement) | null; // 1.10.0: the hamster sprite that dashes across for Zoomies
  } = {},
) {
  let reels: Reel[] = []; // { col, strip, ids, from, to, landed, stop, tease }
  let tags: { line: number; el: HTMLElement[] }[] = []; // payline number tags: { line, el: [left, right] }
  let svg: SVGSVGElement | null = null; // the layer the winning lines are drawn on
  let spinQuick = false; // quick reels, decided when the spin started
  let teaseFrom: number | null = null; // anticipation: the reel after which the others tease (null = none)
  let teased = false; // onTease() already called for this spin
  let teasingNow = false; // a reel is teasing right now (the machine's heartbeat, ui.ts)
  let buildKey = '';
  let boxes: { cells: Cell[]; symbol: string } | null = null; // 1.4.0: boxes still closed on the reels
  let marks = new Map<string, string>(); // 1.10.0: "reel,row" → a glow class ('zoomed', 'sticky') shown once that reel lands
  let dash: HTMLElement | null = null; // 1.10.0: the Zoomies runner, while it runs

  const md = () => game.getMachineData();
  const realRows = () => game.getRowCount(); // 1 = only the middle row counts

  function randomSymbol() {
    // Decoration only: symbols with weight 0 (a wild you haven't unlocked) never show.
    const symbols = game.getSymbols();
    let roll = Math.random() * symbols.reduce((sum, s) => sum + s.weight, 0);
    for (const s of symbols) {
      roll -= s.weight;
      if (roll < 0) return s.id;
    }
    return symbols[0].id;
  }

  // The 3 visible symbols of reel i for a result grid: a one-row machine puts its
  // symbol in the middle and random decoration above and below.
  function visibleColumn(grid: Grid | null, i: number): string[] {
    const column = grid && grid[i];
    if (realRows() >= VISIBLE && column) return column.slice(0, VISIBLE);
    // No spin yet: a random symbol the machine can really land (never a locked one).
    const onLine = column ? column[0] : randomSymbol();
    return [randomSymbol(), onLine, randomSymbol()];
  }

  // Which symbols get a soft glow of their own (behind them, never on top).
  function symbolKind(id: string): string {
    const s = md().symbols.find((x) => x.id === id);
    return s ? (s.wild ? 'sym-wild' : s.scatter ? 'sym-scatter' : '') : '';
  }

  function setStrip(reel: Reel, ids: string[], from: number, to: number): void {
    reel.strip.replaceChildren(
      ...ids.map((id) => {
        const cell = document.createElement('div');
        cell.className = `cell ${symbolKind(id)}`;
        cell.dataset.kind = symbolKind(id);
        cell.appendChild(symbolImg(id));
        return cell;
      }),
    );
    reel.ids = ids;
    reel.from = from;
    reel.to = to;
  }

  // Build resting reels showing the machine's current/last result.
  function build() {
    boxes = null; // (a rebuilt window shows the result, boxes already open)
    const machine = game.state.machines[game.state.activeMachine];
    const count = game.getReelCount();
    container.replaceChildren();
    container.dataset.rows = String(realRows());
    container.dataset.reels = String(count);
    reels = [];
    for (let i = 0; i < count; i++) {
      const col = document.createElement('div');
      col.className = 'reel';
      const strip = document.createElement('div');
      strip.className = 'strip';
      col.appendChild(strip);
      container.appendChild(col);
      // (setStrip, just below, fills in the real ids, from and to.)
      const reel: Reel = { col, strip, ids: [], from: 0, to: 0, stop: stopPoint(i, count, false) };
      // At rest the strip is shifted up by one cell, so cells 1–3 are visible.
      setStrip(reel, [randomSymbol(), ...visibleColumn(machine.result, i), randomSymbol()], -CELL, -CELL);
      reels.push(reel);
    }
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'win-lines');
    container.appendChild(svg);
    buildTags();
    buildKey = key();
  }

  // Numbered tags at both ends of every payline (machines with 2 to 5 lines).
  // Lines you haven't unlocked yet are shown faded, as a goal.
  function buildTags() {
    tags = [];
    const all = md().paylines;
    container.dataset.tags = all && all.length >= 2 && all.length <= MAX_TAG_LINES ? 'side' : 'none';
    if (!all || all.length < 2 || all.length > MAX_TAG_LINES) return;
    const last = reels.length - 1;
    for (const side of ['left', 'right']) {
      const rowOf = (line: number[]) => (side === 'left' ? line[0] : line[last]);
      all.forEach((line, index) => {
        // Lines that start (or end) on the same row share it: spread their tags out.
        const sharing = all.map((_, j) => j).filter((j) => rowOf(all[j]) === rowOf(line));
        const slot = sharing.indexOf(index) - (sharing.length - 1) / 2;
        const tag = document.createElement('span');
        tag.className = `line-tag ${side} ${lineClass(index)}`;
        tag.textContent = String(index + 1);
        tag.style.top = `${rowOf(line) * CELL + CELL / 2 + slot * 20}px`;
        container.appendChild(tag);
        (tags[index] ||= { line: index, el: [] }).el.push(tag);
      });
    }
  }

  // Rebuild when the machine, its reel count or its rows change.
  const key = () => `${md().id}|${game.getReelCount()}|${realRows()}`;

  // Anticipation: which reel (if any) already shows all but one of the scatters
  // a feature needs, with reels still to come. The reels after it tease.
  function findTease(grid: Grid): number | null {
    const m = md();
    const needs: { symbol: string; min: number }[] = [];
    if (m.freeSpins) needs.push({ symbol: m.freeSpins.symbol, min: Math.min(...Object.keys(m.freeSpins.awards).map(Number)) });
    if (m.jackpot) needs.push({ symbol: m.jackpot.symbol, min: m.jackpot.min });
    let best: number | null = null;
    for (const { symbol, min } of needs) {
      let seen = 0;
      for (let i = 0; i < grid.length - 1; i++) {
        seen += grid[i].filter((id) => id === symbol).length;
        if (seen >= min - 1) {
          if (best === null || i < best) best = i;
          break;
        }
      }
    }
    return best;
  }

  // Called on the game's "spinStarted" event with the (already decided) result, and
  // (Moving Day) the boxes the game opened: they land as boxes and open later.
  function startSpin(result: Grid, mystery: { cells: Cell[]; symbol: string } | null = null, extra: { zoom?: number[]; sticky?: Cell[] } = {}): void {
    const box = md().mystery ? md().mystery!.symbol : null;
    const grid = mystery && box ? result.map((column, r) => column.map((id, row) => (mystery.cells.some(([cr, crow]) => cr === r && crow === row) ? box : id))) : result;
    boxes = mystery && box ? mystery : null;
    if (key() !== buildKey || reels.length !== grid.length) build();
    spinQuick = quick();
    teaseFrom = spinQuick ? null : findTease(grid);
    teased = false;
    const seconds = game.getSpinDuration();
    reels.forEach((reel, i) => {
      const showingNow = reel.ids.slice(1, 1 + VISIBLE);
      // Later reels travel further, so they stop later. Quick reels just drop in.
      const fillers = Array.from({ length: spinQuick ? 1 : fillersFor(stopPoint(i, reels.length, false) * seconds) }, randomSymbol);
      // (one more symbol under the ones showing now: the wind-up lifts the strip a little)
      const ids = [randomSymbol(), ...visibleColumn(grid, i), ...fillers, ...showingNow, randomSymbol()];
      setStrip(reel, ids, -(ids.length - VISIBLE - 1) * CELL, -CELL);
      reel.landed = false;
      reel.stop = stopPoint(i, reels.length, spinQuick);
      reel.tease = false;
    });
    // Teasing reels land later, spread out up to just before the payout.
    if (teaseFrom !== null) {
      const after = reels.length - 1 - teaseFrom;
      const start = reels[teaseFrom].stop;
      reels.forEach((reel, i) => {
        if (i <= teaseFrom!) return;
        reel.tease = true;
        reel.stop = start + ((0.97 - start) * (i - teaseFrom!)) / after;
      });
    }
    clearWin();
    // 1.10.0: which cells glow once their reel lands, and the hamster's dash.
    marks = new Map();
    const zoom = extra.zoom || [];
    for (const r of zoom) for (let row = 0; row < realRows(); row++) marks.set(`${r},${row}`, 'zoomed');
    for (const [r, row] of extra.sticky || []) marks.set(`${r},${row}`, 'sticky');
    if (dash) dash.remove();
    dash = null;
    if (zoom.length && runner) {
      const el = document.createElement('div');
      el.className = 'zoomies-runner';
      el.style.setProperty('--reels-width', `${container.offsetWidth}px`); // (where the dash ends: past the last reel)
      el.appendChild(runner());
      el.addEventListener('animationend', () => el.remove());
      container.appendChild(el);
      dash = el;
    }
  }

  // Light up the marked cells of reel i (1.10.0), behind the symbols.
  function applyMarks(i: number): void {
    for (const [key, cls] of marks) {
      const [r, row] = key.split(',').map(Number);
      if (r !== i) continue;
      const cell = cellAt(r, row);
      if (cell) cell.classList.add(cls);
    }
  }

  // Which row of the window a machine row is drawn in (a one-row machine uses the middle).
  const windowRow = (row: number) => (realRows() >= VISIBLE ? row : 1);
  const cellAt = (reel: number, row: number) => reels[reel] && reels[reel].strip.children[1 + windowRow(row)];

  // The reels a win covers: the first `count` from the left, or the last ones
  // for a win read from the right.
  const winReels = (w: LineHit) => {
    const n = Math.min(w.count, reels.length);
    return Array.from({ length: n }, (_, i) => (w.fromRight ? reels.length - n + i : i));
  };

  // Light up the winning cells, and draw each winning line across the reels.
  // wins: [{ line, count, fromRight }] from the spinResolved event.
  function showWin(wins: LineHit[]): void {
    clearWin();
    const lines = game.getPaylines();
    for (const w of wins) {
      if (w.cells) {
        // A ways win (M9): every cell of the win lights up in its colour; no line to draw.
        for (const [reel, row] of w.cells) {
          const cell = cellAt(reel, row);
          if (cell) cell.classList.add('win', lineClass(w.line));
        }
        continue;
      }
      const line = lines[w.line];
      if (!line) continue;
      for (const i of winReels(w)) {
        const cell = cellAt(i, line[i]);
        if (cell) cell.classList.add('win', lineClass(w.line));
      }
      const tag = tags[w.line];
      if (tag) for (const el of tag.el) el.classList.add('won');
      if (lines.length > 1) drawLine(line, w.line, lines.length > MAX_TAG_LINES);
    }
  }

  // Scatters that started a feature glow gold, wherever they are.
  function showFeature(cells: Cell[]): void {
    for (const [reel, row] of cells) {
      const cell = cellAt(reel, row);
      if (cell) cell.classList.add('feature');
    }
  }

  function drawLine(line: number[], index: number, badge: boolean): void {
    const pts = reels.map((reel, i) => [reel.col.offsetLeft + reel.col.offsetWidth / 2, windowRow(line[i]) * CELL + CELL / 2]);
    const points = pts.map(([x, y]) => `${x},${y}`).join(' ');
    // The line draws itself across the reels, left to right (1.0): a dash as
    // long as the whole line slides into place (style.css .win-lines, "trace").
    const length = Math.ceil(pts.reduce((sum, [x, y], i) => (i ? sum + Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]) : 0), 0));
    for (const cls of ['under', 'over']) {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', points);
      poly.setAttribute('class', `${cls} ${lineClass(index)}`);
      poly.style.setProperty('--len', `${length}px`);
      svg!.appendChild(poly);
    }
    // Many-line machines have no side tags, so the drawn line gets its number.
    if (badge) {
      const tag = document.createElement('span');
      tag.className = `line-tag badge won ${lineClass(index)}`;
      tag.textContent = String(index + 1);
      tag.style.left = `${pts[0][0] - 9}px`;
      tag.style.top = `${pts[0][1]}px`;
      container.appendChild(tag);
    }
  }

  function clearWin() {
    for (const reel of reels) for (const cell of reel.strip.children as HTMLCollectionOf<HTMLElement>) cell.className = `cell ${cell.dataset.kind || ''}`;
    for (const t of tags) for (const el of t.el) el.classList.remove('won');
    for (const b of container.querySelectorAll('.line-tag.badge')) b.remove();
    if (svg) svg.replaceChildren();
    reels.forEach((reel, i) => { if (reel.landed !== false) applyMarks(i); }); // (the glows stay through the win show)
  }

  // The cells lit up right now, with their line colour class (for the particles).
  function litCells() {
    return [...container.querySelectorAll('.cell.win, .cell.feature')];
  }

  // The cells one winning line covers ({ line, count, fromRight } from spinResolved), for the win show.
  function cellsFor(win: LineHit): Element[] {
    if (win.cells) return win.cells.map(([reel, row]) => cellAt(reel, row)).filter(Boolean) as Element[];
    const line = game.getPaylines()[win.line];
    if (!line) return [];
    return winReels(win).map((i) => cellAt(i, line[i])).filter(Boolean) as Element[];
  }

  // Every box opens into the symbol the game picked (once the last reel has landed).
  function openBoxes(): void {
    if (!boxes) return;
    const { cells, symbol } = boxes;
    boxes = null;
    const opened: HTMLElement[] = [];
    for (const [reel, row] of cells) {
      const cell = cellAt(reel, row) as HTMLElement | undefined;
      if (!cell) continue;
      cell.dataset.kind = symbolKind(symbol);
      cell.className = `cell ${cell.dataset.kind}`;
      cell.replaceChildren(symbolImg(symbol));
      opened.push(cell);
    }
    if (opened.length) onOpen(opened);
  }

  // The on-screen box of one reel (for the dust puff when it lands).
  const reelElement = (i: number) => (reels[i] ? reels[i].col : null);

  // Called every frame.
  function render() {
    if (key() !== buildKey) build();
    const machine = game.state.machines[game.state.activeMachine];
    const progress = game.getSpinProgress();
    const active = game.getLineCount();
    for (const t of tags) for (const el of t.el) el.classList.toggle('locked', t.line >= active);
    let teasing = false;
    reels.forEach((reel, i) => {
      const t = machine.spinning ? Math.min(1, progress / reel.stop) : 1;
      reel.strip.style.transform = `translateY(${stripOffset(reel.from, reel.to, t, spinQuick ? OVERSHOOT / 2 : OVERSHOOT, !spinQuick)}px)`;
      reel.col.classList.toggle('moving', t < 1);
      reel.col.classList.toggle('fast', t < 0.7 && !spinQuick); // a motion blur while it races (style.css)
      // A teasing reel shimmers once every reel before it has landed.
      const tease = !!reel.tease && t < 1 && machine.spinning && teaseFrom !== null && progress >= reels[teaseFrom].stop;
      reel.col.classList.toggle('tease', tease);
      if (tease) teasing = true;
      if (t >= 1 && reel.landed === false) {
        reel.landed = true;
        replayClass(reel.col, 'landed'); // (1.5.0) a flash of light as it lands
        applyMarks(i);
        onLand(i);
      }
    });
    if (teasing && !teased) {
      teased = true;
      onTease();
    }
    teasingNow = teasing;
    // Moving Day (1.4.0): every reel has landed, so the boxes open (a new spin, or the
    // machine rebuilt, simply shows the result: it's already opened).
    if (boxes && reels.every((r) => r.landed)) openBoxes();
  }

  build();
  return { build, startSpin, showWin, showFeature, clearWin, render, litCells, cellsFor, reelElement, get teasing() { return teasingNow; } };
}

// What createReels gives back (the win show and ui.ts use it).
export type Reels = ReturnType<typeof createReels>;
