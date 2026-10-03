// bigcage.ts — VIEW layer. The Big Cage (M8), redesigned in M15: the page between
// lives, and the only place to plant Heirloom Seeds. It's a scene of its own: a
// meadow where the family's tree grows (bigtree.ts paints it), with the Family Tree's
// traits on it. Tap a trait to read about it and plant it.
//
// The tree grows with the family (the user's picks): a trait only shows once the one
// it needs is planted, and every trait you plant makes the tree grow, the trunk up to
// the next level and a branch out to the traits it unlocked, which sprout as the branch
// reaches them. A family that has planted nothing has a sapling with one trait.
//
// Retiring plays the rebirth animation: the hamster walks in with an Heirloom Seed,
// digs, plants it, and the family's tree shoots up to the size the family has grown
// it to. Then the numbers and the Start button slide in. A tap skips it, and Motion
// "Less" shows the grown tree straight away (and grows it at once when you plant).
//
// 1.4.0, The Great Migration: once the whole tree is planted, a button here moves the
// family to a new colony (two taps): a banner, golden whiskers rain down, the old tree
// is gone and the first pup of the new colony plants a seed in the new meadow. A
// migrated family also picks a Colony Trial here, before a life starts, and its tree
// grows a 4th level of colony traits.
//
// Like the rest of the view, it only calls game actions (buyTreeNode, leaveBigCage,
// migrate, startTrial) and reads state. ui.ts creates it and calls render() every frame.

import { spriteImg, treeIcon, applySprite, hamsterSprite, runFrame } from './art.ts';
import { furColors, hatOf } from './skins.ts';
import { treeLayout, treeShape, trunkTop, leafClumps, drawTree, TREE_TOKENS } from './bigtree.ts';
import { describeEffect } from './shop.ts';
import { formatWhole, setText, setHTML, replayClass, iconHTML, popText } from './dom.ts';
import { h, createSheet, statTile, gauge, segmented, confirmButton, button, buyButton, more, amountHTML, appeared } from './kit.ts';
import type { BuyButton, BuyState } from './kit.ts';
import { IRIS_MS } from './celebrate.ts';
import { divide } from '../logic/money.ts';
import type { Layout, Shape, TreeColors, Clump } from './bigtree.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';
import type { Game } from '../logic/game.ts';
import type { GameEvents } from '../logic/types.ts';
import type { Money } from '../logic/money.ts';

// The rebirth animation's timeline, in ms from when the Big Cage opens. After the
// seed goes in, the tree grows at its own pace (grow() below) and the numbers slide
// in once it has finished (or at `latest`).
const T = {
  walkEnd: 1000, // the hamster walks in from the left…
  seed: 1000, // …holds up the Heirloom Seed…
  digStart: 1250, digEnd: 1850, // …digs…
  dropStart: 1650, dropEnd: 1950, // …and the seed drops into the hole.
  sprout: 1950, // the tree starts to grow
  hopBack: 2150, // the hamster jumps back out of the way
  latest: 7000, // the numbers slide in by now, even if the tree is still growing
  outro: 400, // …and the animation ends this long after they do
};
const POP_MS = 380; // a bunch of leaves popping out

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
// Grows a little past 1 and settles back (a pop).
const backOut = (v: number) => {
  const x = clamp01(v);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
// Moves a value towards its target: quickly while it's far, never slower than `min` a second.
function approach(value: number, target: number, dt: number, min: number, rate: number): number {
  const d = target - value;
  const step = Math.max(min, Math.abs(d) * rate) * dt;
  return Math.abs(d) <= step ? target : value + Math.sign(d) * step;
}

interface Options {
  fx: Fx;
  sound: Sound;
  lessMotion: () => boolean;
  bonusText: (bonus: Money) => string;
  treeLine: (effectType: string) => string | null; // what the hamster says after planting
}

export function createBigCage(game: Game, { fx, sound, lessMotion, bonusText, treeLine }: Options) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    dialog: $<HTMLDialogElement>('big-cage'), scene: $('bc-scene'), world: $('bc-world'), canvas: $<HTMLCanvasElement>('bc-canvas'), nodes: $('bc-nodes'),
    hamster: $<HTMLImageElement>('bc-hamster'), seed: $('bc-seed'), bubble: $('bc-bubble'), skip: $('bc-skip'),
    sub: $('bc-sub'), sign: $('bc-sign'), foot: $('bc-foot'),
    banner: $('bc-banner'), // 1.4.0
  };
  const ctx = el.canvas.getContext('2d')!;
  const seedLabel = (text: string) => `${iconHTML('heirloom')}${text}`;

  // ── "New Digs" part 4: the panels, from the kit ──
  // The trait you tapped: a sheet rising over the lower meadow (the scene shifts up so the trait
  // stays in view above it), not a fixed card with its own scroll.
  const sheet = createSheet(el.scene);
  // The numbers, on a wooden garden sign: seeds held, the heirloom bonus, Machine Stars, the seed jar.
  const heldTile = statTile('Seeds held');
  const bonusTile = statTile('Heirloom bonus');
  const starsTile = statTile('Machine Stars');
  const tilesRow = el.sign.appendChild(h('div', 'bc-tiles'));
  tilesRow.append(heldTile.el, bonusTile.el, starsTile.el);
  const jarRow = el.sign.appendChild(h('div', 'bc-jar'));
  jarRow.append(h('span', 'bc-jar-label', 'Seed jar'));
  const jarGauge = gauge({ tone: 'heirloom', label: 'Seed jar' });
  jarRow.append(jarGauge.el);
  const jarText = jarRow.appendChild(h('span', 'bc-jar-text'));
  // Below: a Colony Trial for this life (1.4.0), how it works, the Great Migration and Start.
  const trialBox = el.foot.appendChild(h('div', 'bc-trials hidden'));
  trialBox.append(h('span', 'bc-trials-label', 'Colony Trial for this life'));
  const colonyDef = game.data.colony;
  const trialPick = segmented<string>({
    options: [{ value: '', label: 'None' }, ...(colonyDef ? colonyDef.trials.map((t) => ({ value: t.id, label: t.name, title: t.description })) : [])],
    ariaLabel: 'Colony Trial', className: 'bc-trial-picks',
    onPick: (id) => {
      if (id === (game.state.trial || '')) return;
      if (game.startTrial(id || null)) {
        const t = game.getTrialDef(id || null);
        say(t ? `${t.name}: ${t.description} Beat it for ${formatWhole(game.getTrialWhiskers(t.id))} Golden Whiskers!` : 'An ordinary life it is.', 4000);
      }
    },
  });
  trialBox.append(trialPick.el);
  const trialNote = trialBox.appendChild(h('p', 'k-note bc-trial-note'));
  const how = more('How it works');
  const explain = how.body.appendChild(h('p'));
  // The Great Migration (1.4.0): two taps, it can't happen by accident.
  const migrate = confirmButton({
    label: 'The Great Migration', armedLabel: 'Tap again: pack up for a new colony!', tone: 'soft', size: 'lg', className: 'bc-migrate',
    onConfirm: () => { game.migrate(); },
  });
  migrate.el.addEventListener('click', () => {
    if (migrate.armed) say(`A new colony: the tree, the seeds and the stars start again, for ${formatWhole(game.getPendingWhiskers())} Golden Whiskers. Tap again to go!`, 4000);
  });
  // Only this button starts the new life (Escape doesn't close the page).
  const start = button({ tone: 'gold', size: 'xl', label: 'Start the new life', className: 'bc-start', onClick: () => game.leaveBigCage() });
  el.foot.append(how.el, migrate.el, start.el);

  // The open trait's sheet: what it does, the trade (seeds held vs the trait), what it grows, Plant.
  let traitSheet: { id: string; effect: HTMLElement; trade: HTMLElement; grows: HTMLElement; plant: BuyButton } | null = null;
  function openTrait(id: string): void {
    const key = `bc:trait:${id}`;
    if (sheet.key === key) { sheet.hide(); return; }
    const def = game.getTreeNodeDef(id);
    if (!def) return;
    if (sheet.show(key, { icon: treeIcon(def) || 'heirloom', iconSize: 32, title: def.name })) {
      const effect = h('p', 'shop-effect');
      const trade = h('p', 'k-note');
      const grows = h('p', 'k-note');
      sheet.body.append(h('p', 'k-note', def.description), effect, trade, grows);
      const plant = buyButton({ size: 'lg', onClick: () => game.buyTreeNode(id), ariaLabel: `Plant ${def.name}` });
      sheet.foot.append(plant.el);
      traitSheet = { id, effect, trade, grows, plant };
    }
    selected = id;
  }
  sheet.onHide(() => { selected = null; traitSheet = null; });

  let nodeEls = new Map<string, HTMLButtonElement>();
  let selected: string | null = null;
  let layout: Layout | null = null;
  let layoutKey = '';
  let colors = {} as TreeColors;
  let drawnKey = ''; // what the canvas shows now (it's only repainted when that changes)
  // The tree as it's drawn: it eases towards treeShape() (see grow()).
  const drawn = { trunk: 0, girth: 0, reach: [] as number[] };
  let born = new Map<string, number>(); // bunches of leaves: when each popped out
  let sprouted = new Set<string>(); // traits the tree has grown out to
  let snap = true; // the next frame shows the tree grown, with no animation
  let lastFrame = 0;
  let lastRetired: GameEvents['retired'] | null = null;
  let playIntro = false; // the next opening plays the rebirth animation
  let intro: { start: number; fired: Set<string>; skipped: boolean; uiAt: number | null } | null = null;
  let openAt = 0; // the page waits for the iris to close on the old life first
  let heldRoll: { from: Money; at: number } | null = null; // the seeds held count up after a retirement
  let speech: { text: string; until: number } | null = null;
  let autoOpened = false; // a first family's first visit: the first trait to plant opens by itself
  let shift = 0; // how far the scene is moved up, so the trait you tapped shows above its sheet
  let hamsterX = 0; // where the scene's hamster stands (screen pixels in the scene)
  let lastMigrated: GameEvents['migrated'] | null = null; // 1.4.0: the family has just moved to a new colony
  let replayAt = 0; // after a migration from the Big Cage: when the planting animation plays again

  // The traits that show: planted ones, and the ones whose needs are all planted.
  function shownTraits(): Set<string> {
    const ft = game.data.familyTree;
    return new Set(ft ? ft.nodes.filter((n) => game.getTreeLevel(n.id) > 0 || game.isTreeNodeUnlocked(n.id)).map((n) => n.id) : []);
  }

  // ─────────────────────── building ───────────────────────

  // One button per trait (placed over the tree by place()).
  function build(): void {
    el.nodes.replaceChildren();
    nodeEls = new Map();
    const ft = game.data.familyTree;
    if (!ft) return;
    for (const def of ft.nodes) {
      const btn = document.createElement('button');
      btn.className = 'bt-node unborn';
      btn.innerHTML = '<span class="bt-icon"></span><span class="node-cost"></span><span class="bt-name"></span>';
      btn.querySelector('.bt-icon')!.appendChild(spriteImg(treeIcon(def), 32, def.name[0]));
      btn.querySelector('.bt-name')!.textContent = def.name;
      btn.setAttribute('aria-label', def.name);
      btn.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        openTrait(def.id);
      });
      el.nodes.appendChild(btn);
      nodeEls.set(def.id, btn);
    }
    if (selected && !nodeEls.has(selected)) sheet.hide();
    sprouted = new Set();
    snap = true;
    layoutKey = ''; // place them again
  }

  function readColors(): void {
    const css = getComputedStyle(document.documentElement);
    colors = Object.fromEntries(TREE_TOKENS.map((t) => [t, css.getPropertyValue(t).trim()])) as TreeColors;
    drawnKey = '';
  }

  // Work out the tree for the scene's size, size the canvas to match (a whole number
  // of screen pixels per canvas pixel) and put every trait on its spot.
  function place(): void {
    const ft = game.data.familyTree;
    const w = el.scene.clientWidth;
    const h = el.scene.clientHeight;
    const key = `${w}x${h}|${game.state.colony}`;
    if (key === layoutKey || !ft || w < 10 || h < 10) return;
    layoutKey = key;
    const [trunk, ...branches] = ft.branches;
    // (Colony traits, 1.4.0, are only on a migrated family's tree: a 4th level.)
    const nodesOf = (id: string) => ft.nodes.filter((n) => n.branch === id && (n.colony || 0) <= game.state.colony).map((n) => n.id);
    const px = w < 600 ? 2 : 3;
    // The layout is for exactly the canvas's size, so the painted branches and the
    // trait buttons line up to the pixel.
    const cw = Math.floor(w / px) * px;
    const ch = Math.floor(h / px) * px;
    layout = treeLayout(cw, ch, nodesOf(trunk.id), branches.map((b) => ({ id: b.id, nodes: nodesOf(b.id) })));
    el.canvas.width = cw / px;
    el.canvas.height = ch / px;
    el.canvas.style.width = `${cw}px`;
    el.canvas.style.height = `${ch}px`;
    // The world (the canvas, the traits, the hamster) is exactly the canvas's size, centred.
    el.world.style.left = `${Math.floor((w - cw) / 2)}px`;
    el.world.style.width = `${cw}px`;
    el.world.style.height = `${ch}px`;
    const { w: bw, up } = layout.node;
    el.scene.classList.toggle('compact', bw < 90);
    el.nodes.style.setProperty('--nw', `${bw}px`);
    for (const spot of layout.nodes) {
      const btn = nodeEls.get(spot.id);
      if (!btn) continue;
      btn.style.left = `${spot.x - bw / 2}px`;
      btn.style.top = `${spot.y - up}px`;
    }
    hamsterX = layout.base.x - layout.trunkR0 * 1.6 - 40;
    drawn.reach = layout.limbs.map((_, i) => drawn.reach[i] || 0);
    drawnKey = '';
  }

  // ─────────────────────── growing ───────────────────────

  // One frame of growing: the trunk grows up first, a limb only once the trunk has
  // reached it, leaves pop out where the wood has got to, and a trait sprouts when its
  // branch (or the trunk) reaches it. `snap`: straight to the grown tree, no animation.
  function grow(shape: Shape, shown: Set<string>, now: number, dt: number, allowed: boolean): Clump[] {
    const L = layout!;
    const instant = snap || lessMotion();
    if (instant) {
      drawn.trunk = shape.trunk;
      drawn.girth = shape.girth;
      drawn.reach = shape.reach.slice();
    } else if (allowed) {
      drawn.trunk = approach(drawn.trunk, shape.trunk, dt, 0.3, 2.6);
      drawn.girth = approach(drawn.girth, shape.girth, dt, 0.25, 2.6);
      const top = trunkTop(L, drawn.trunk);
      L.limbs.forEach((l, i) => {
        if (top <= l.p0.y - L.height * 0.02) drawn.reach[i] = approach(drawn.reach[i] || 0, shape.reach[i], dt, 0.45, 3.5);
      });
    }
    const clumps = leafClumps(L, shown, drawn, shape);
    for (const c of clumps) {
      if (born.has(c.key)) continue;
      const reached = c.limb < 0 ? drawn.trunk >= c.need && drawn.trunk > 0 : (drawn.reach[c.limb] || 0) >= c.need;
      if (!reached) continue;
      born.set(c.key, instant ? -Infinity : now);
      if (!instant && !(intro && intro.skipped)) {
        const p = scenePoint(c.x, c.y);
        fx.burst(p.x, p.y, { count: 8, palette: [colors['--leaf'], colors['--leaf-light'], colors['--leaf-dark']], speed: 150, gravity: 240, size: 3, twinkle: false });
      }
    }
    // A trait appears when the tree has grown out to it (the trunk up to it, or its limb out to it).
    for (const spot of L.nodes) {
      if (!shown.has(spot.id) || sprouted.has(spot.id)) continue;
      const reached = spot.limb < 0 ? drawn.trunk > 0 && trunkTop(L, drawn.trunk) <= spot.y + 4 : (drawn.reach[spot.limb] || 0) >= spot.t - 0.001;
      if (!reached) continue;
      sprouted.add(spot.id);
      const btn = nodeEls.get(spot.id);
      if (btn && !instant) {
        replayClass(btn, 'sprout');
        fx.burstAt(btn, { count: 10, palette: [colors['--leaf-light'], '#ffffff', colors['--blossom']], speed: 120, gravity: 200, size: 3 });
        sound.play('tick');
      }
    }
    snap = false;
    return clumps;
  }

  // Has the tree finished growing (so the canvas can stop repainting)?
  function settled(shape: Shape, clumps: Clump[], now: number): boolean {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;
    return near(drawn.trunk, shape.trunk) && near(drawn.girth, shape.girth) && shape.reach.every((r, i) => near(drawn.reach[i] || 0, r))
      && clumps.every((c) => born.has(c.key) && now - born.get(c.key)! > POP_MS);
  }

  // ─────────────────────── the rebirth animation ───────────────────────

  // Things that happen once, at a moment of the animation (a sound, some particles).
  function cue(name: string, at: number, t: number, fn: () => void, always = false): void {
    if (!intro || intro.fired.has(name) || t < at) return;
    intro.fired.add(name);
    if (!intro.skipped || always) fn();
  }

  function scenePoint(x: number, y: number): { x: number; y: number } {
    const r = el.world.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y };
  }

  function say(text: string, ms = 3500): void {
    // On a phone the bubble sits over the lowest traits, so it doesn't stay long.
    const short = el.scene.classList.contains('compact');
    speech = { text, until: performance.now() + (short ? Math.min(ms, 2600) : ms) };
  }

  // The part of the animation that isn't the tree: the hamster, the seed, the cues.
  function playScene(t: number, now: number, shape: Shape, done: boolean): void {
    if (!layout || !intro) return;
    const L = layout;
    const plantX = L.base.x - 30;
    const frame = t < T.walkEnd ? runFrame(now, 80) : t >= T.digStart && t < T.digEnd ? 'hamsterRun2' : 'hamster';
    applySprite(el.hamster, hamsterSprite(frame, hatOf(game)), 64, furColors(game));
    // Walk in, stand and dig at the spot, then jump back out of the tree's way.
    let x = hamsterX;
    let lift = 0;
    if (t < T.walkEnd) x = -60 + (plantX + 60) * easeOut(t / T.walkEnd);
    else if (t < T.hopBack) x = plantX;
    else if (t < T.hopBack + 450) {
      const k = (t - T.hopBack) / 450;
      x = plantX + (hamsterX - plantX) * easeOut(k);
      lift = Math.sin(Math.PI * k) * 38;
    }
    el.hamster.style.left = `${x - 32}px`;
    el.hamster.style.top = `${L.ground - 60 - lift}px`;
    el.hamster.classList.toggle('digging', t >= T.digStart && t < T.digEnd);
    // The seed: held up over its head, then it drops into the hole.
    const seedUp = t >= T.seed && t < T.dropEnd;
    el.seed.classList.toggle('hidden', !seedUp);
    if (seedUp) {
      const k = clamp01((t - T.dropStart) / (T.dropEnd - T.dropStart));
      el.seed.style.left = `${plantX + (L.base.x - plantX) * k - 12}px`;
      el.seed.style.top = `${L.ground - 84 + 80 * k * k - 12}px`; // falls faster and faster
    }
    cue('hello', T.seed, t, () => {
      replayClass(el.hamster, 'hop');
      sound.play('sticker');
      say(lastMigrated ? 'Our new home! Let\'s plant the colony\'s first seed.' : 'Our Heirloom Seed! Let\'s plant it.', 2400);
      const p = scenePoint(plantX, L.ground - 84);
      fx.burst(p.x, p.y, { count: 14, palette: fx.colors.heirloom, speed: 140 });
    });
    for (let k = 0; k < 5; k++) {
      cue(`dig${k}`, T.digStart + k * 120, t, () => {
        const p = scenePoint(L.base.x - 6, L.ground - 2);
        fx.dust(p.x, p.y, 6, 16);
      });
    }
    cue('plant', T.dropEnd, t, () => {
      sound.play('plant');
      const p = scenePoint(L.base.x, L.ground - 4);
      fx.burst(p.x, p.y, { count: 18, palette: fx.colors.gold, speed: 120 });
    });
    cue('grow', T.hopBack, t, () => {
      sound.play('sprout');
      if (shape.tier > 0) {
        sound.play('anticipation');
        replayClass(el.scene, 'rumble');
        say('Whoa! Look at our family\'s tree grow!', 2600);
      } else say('A little sapling! It grows with every trait we plant.', 3000);
    });
    // The numbers, the card and Start slide in once the tree has grown; seeds rain down.
    if (intro.uiAt === null && ((done && t > T.hopBack + 600) || t >= T.latest || intro.skipped)) intro.uiAt = t;
    cue('ui', intro.uiAt ?? Infinity, t, () => {
      el.dialog.classList.add('ui-in');
      if (heldRoll) heldRoll.at = performance.now();
      fx.rain('heirloom', el.scene, lastRetired ? Math.min(40, 12 + lastRetired.seedsGained.toNumber()) : 10, { scale: 2, floor: false });
      // 1.3.1: this generation opens a rebirth upgrade? The hamster says so first.
      const fresh = game.data.upgrades.filter((u) => u.unlock && u.unlock.generation === game.state.generation && game.isUpgradeUnlocked(u.id));
      const news = fresh.length ? `And this life I can buy ${fresh.map((u) => u.name).join(' and ')}! ` : '';
      say(news + (shape.tier === 0 ? 'Plant Family Pride and watch the tree grow!'
        : game.data.familyTree.nodes.some((n) => game.canBuyTreeNode(n.id)) ? 'Tap a trait to plant it. Every pup after me is born with it!'
          : 'Start the new life when you\'re ready!'), news ? 6500 : 4500);
    }, true);
  }

  function skip(): void {
    if (!intro) return;
    intro.skipped = true;
    intro.start = Math.min(intro.start, performance.now() - T.hopBack - 460); // past the digging and the jump
    snap = true;
  }
  el.scene.addEventListener('click', (e) => {
    if (intro && !(e.target as Element).closest('.bt-node, .k-sheet')) skip();
  });
  el.skip.addEventListener('click', skip);

  // ─────────────────────── opening and closing ───────────────────────

  function open(now: number): void {
    if (!el.dialog.open) el.dialog.showModal();
    // The particles move into the dialog while it's open (a dialog sits above the
    // whole page, canvas included).
    el.dialog.appendChild(fx.canvas);
    readColors();
    layoutKey = '';
    place();
    const animate = playIntro && !lessMotion();
    playIntro = false;
    autoOpened = false;
    // The animation grows the tree from the seed; otherwise it's simply there.
    born = new Map();
    sprouted = new Set();
    for (const btn of nodeEls.values()) btn.classList.add('unborn');
    drawn.trunk = 0;
    drawn.girth = 0;
    drawn.reach = drawn.reach.map(() => 0);
    snap = !animate;
    intro = animate ? { start: now, fired: new Set(), skipped: false, uiAt: null } : null;
    el.dialog.classList.toggle('playing', animate);
    el.dialog.classList.toggle('ui-in', !animate);
    el.seed.classList.add('hidden');
    if (!animate) {
      applySprite(el.hamster, hamsterSprite('hamster', hatOf(game)), 64, furColors(game));
      if (heldRoll) heldRoll.at = now + 350;
      if (lastRetired) setTimeout(() => fx.rain('heirloom', el.scene, Math.min(40, 12 + lastRetired!.seedsGained.toNumber()), { scale: 2, floor: false }), 300);
    }
  }

  function close(): void {
    sheet.hide();
    el.dialog.close();
    document.body.appendChild(fx.canvas);
    intro = null;
    heldRoll = null;
    speech = null;
    el.dialog.classList.remove('playing', 'ui-in');
  }

  // ─────────────────────── game events ───────────────────────

  game.on('retired', (e) => {
    lastRetired = e;
    if (e.auto) return; // the Wise Elders (1.4.0): the next life starts at once, no Big Cage
    // Wait for the iris to close on the old life (ui.ts), then play the animation.
    if (!lessMotion()) {
      playIntro = true;
      heldRoll = { from: game.state.seeds.sub(e.seedsGained), at: Infinity };
      openAt = performance.now() + IRIS_MS + 150;
    }
  });
  game.on('bigCageLeft', () => { lastRetired = null; lastMigrated = null; });
  // The Great Migration (1.4.0): a banner and a rain of golden whiskers, then the old
  // tree is gone and the new colony's first pup plants its seed (the rebirth animation).
  game.on('migrated', (e) => {
    lastMigrated = e;
    lastRetired = null;
    migrate.disarm();
    const now = performance.now();
    setHTML(el.banner, `<b>The Great Migration!</b><span>Colony ${e.colony + 1} · ${iconHTML('whisker', 24)}+${formatWhole(e.whiskers)} Golden Whiskers</span>`);
    el.banner.classList.remove('hidden');
    if (!lessMotion()) replayClass(el.banner, 'slam');
    setTimeout(() => el.banner.classList.add('hidden'), lessMotion() ? 2500 : 3200);
    if (el.dialog.open) {
      fx.rain('whisker', el.scene, 40, { scale: 2, floor: false });
      playIntro = !lessMotion();
      replayAt = now + (lessMotion() ? 0 : 1500);
      layoutKey = '';
    } else {
      // From a life: the Big Cage opens (after the iris, like a retirement) and plays it.
      playIntro = !lessMotion();
      openAt = now + (lessMotion() ? 0 : 300);
      setTimeout(() => fx.rain('whisker', el.scene, 40, { scale: 2, floor: false }), 400);
    }
    build();
  });
  game.on('dataReloaded', build);
  game.on('stateLoaded', () => { snap = true; });

  game.on('treeNodeBought', (e) => {
    sound.play('sprout');
    const node = nodeEls.get(e.id);
    if (node) {
      // The trait springs up and leaves fly.
      replayClass(node, 'sprout');
      fx.burstAt(node, { count: 22, palette: [colors['--leaf'], colors['--leaf-dark'], colors['--leaf-light']], speed: 200, gravity: 360, size: 4, twinkle: false });
    }
    // The Plant button you pressed: a ring of sparks, and the word floating up from it.
    const button = traitSheet ? traitSheet.plant.el : null;
    fx.ringAt(button, { count: 18, speed: 240, palette: [fx.colors.heirloom[0], '#ffffff'] });
    if (!lessMotion()) {
      const level = game.getTreeLevel(e.id);
      popText(button || node, game.isTreeMaxed(e.id) && level > 1 ? 'MAX!' : level > 1 ? `LV ${level}!` : 'Planted!', 'seed');
      popText(heldTile.el, `−${formatWhole(e.cost)}`, 'seed');
    }
    // The tree grows (render() eases it to its new shape); a new level makes it rumble.
    if (layout && e.level === 1) {
      const before = treeShape(layout, new Set([...shownTraits()].filter((id) => id !== e.id && game.getTreeNodeDef(id)!.requires.every((r) => r !== e.id))));
      if (treeShape(layout, shownTraits()).tier > before.tier && !lessMotion()) replayClass(el.scene, 'rumble');
    }
    const unlocked = e.level === 1 && game.data.familyTree.nodes.some((n) => n.requires.includes(e.id));
    const line = treeLine(game.getTreeNodeDef(e.id)!.effect.type);
    say(unlocked ? `${line ? `${line} ` : ''}The tree is growing!` : line || '');
  });

  el.dialog.addEventListener('cancel', (e) => e.preventDefault());
  // A new size (the window turned, or resized): lay the tree out again.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { layoutKey = ''; }).observe(el.scene);

  // ─────────────────────── drawing ───────────────────────

  function renderNodes(shown: Set<string>): void {
    for (const [id, btn] of nodeEls) {
      const level = game.getTreeLevel(id);
      const maxed = game.isTreeMaxed(id);
      btn.classList.toggle('owned', level > 0);
      btn.classList.toggle('ready', game.canBuyTreeNode(id));
      btn.classList.toggle('selected', id === selected);
      // Only traits that show, and only once the tree has grown out to them.
      btn.classList.toggle('unborn', !shown.has(id) || !sprouted.has(id));
      const cost = seedLabel(formatWhole(game.getTreeCost(id)));
      setHTML(btn.querySelector<HTMLElement>('.node-cost')!, maxed ? (level > 1 ? `Lv ${level}` : 'Owned') : level > 0 ? `Lv ${level} · ${cost}` : cost);
    }
  }

  // The open trait's sheet, every frame while it's open.
  function drawTraitSheet(): void {
    const def = traitSheet && sheet.key === `bc:trait:${traitSheet.id}` ? game.getTreeNodeDef(traitSheet.id) : null;
    if (!traitSheet || !def) return;
    const level = game.getTreeLevel(def.id);
    const maxed = game.isTreeMaxed(def.id);
    const cost = game.getTreeCost(def.id);
    const unlocked = game.isTreeNodeUnlocked(def.id);
    const affordable = game.canBuyTreeNode(def.id);
    const branch = game.data.familyTree.branches.find((b) => b.id === def.branch);
    sheet.setTag(`${branch ? `${branch.name} · ` : ''}${maxed ? 'Max' : def.maxLevel ? `Lv ${level} of ${def.maxLevel}` : `Lv ${level}`}`);
    setHTML(traitSheet.effect, describeEffect(game, def, game.previewTreeNode(def.id)));
    // What planting does to the heirloom bonus: the seeds it spends stop paying,
    // unless the jar stays full (M9); Family Fortune also makes the jar bigger.
    const held = game.state.seeds;
    const nowBonus = game.getHeirloomBonus();
    const afterBonus = game.getHeirloomBonusFor(held.sub(cost).max(0), def.effect.type === 'seedJar' ? { [def.id]: level + 1 } : undefined);
    const change = afterBonus.eq(nowBonus) ? `the heirloom bonus stays ${bonusText(nowBonus)} (the seed jar is still full)` : `the heirloom bonus goes ${bonusText(nowBonus)} → ${bonusText(afterBonus)}`;
    setText(traitSheet.trade, unlocked && !maxed && held.gte(cost) ? `Planting spends ${formatWhole(cost)} of your ${formatWhole(held)} seeds: ${change}.` : '');
    traitSheet.trade.classList.toggle('hidden', traitSheet.trade.textContent === '');
    // What planting it makes grow: the traits that need it.
    const opens = level === 0 ? game.data.familyTree.nodes.filter((n) => n.requires.includes(def.id)) : [];
    setText(traitSheet.grows, opens.length ? `Planting it grows the tree: ${opens.map((n) => n.name).join(', ')} ${opens.length === 1 ? 'appears' : 'appear'}.` : '');
    traitSheet.grows.classList.toggle('hidden', !opens.length);
    const state: BuyState = maxed ? 'maxed' : !unlocked ? 'locked' : affordable ? 'ready' : 'saving';
    traitSheet.plant.update({
      state, cost, currency: 'seed', verb: 'Plant', progress: state === 'saving' ? divide(held, cost).toNumber() : 0,
      label: maxed ? (level > 1 ? 'Max' : 'Planted') : undefined,
    });
  }

  // The scene moves up (never past the trait's own top) so the trait you tapped shows above its sheet.
  function shiftScene(): void {
    let want = 0;
    const btn = selected && sheet.key ? nodeEls.get(selected) : null;
    if (btn) {
      const top = parseFloat(btn.style.top || '0');
      const room = el.scene.clientHeight - sheet.el.offsetHeight - 12;
      want = Math.max(0, Math.min(top + btn.offsetHeight - room, top - 8));
    }
    want = Math.round(want);
    if (want === shift) return;
    shift = want;
    el.world.style.transform = shift ? `translateY(${-shift}px)` : '';
  }

  function renderNumbers(now: number): void {
    const s = game.state;
    const name = game.getPupName();
    setText(el.sub, lastMigrated ? `The family moved to colony ${lastMigrated.colony + 1} with ${formatWhole(lastMigrated.whiskers)} Golden Whiskers. ${name} is its first pup.`
      : !lastRetired ? `${name} (generation ${s.generation}${s.colony > 0 ? `, colony ${s.colony + 1}` : ''}) is waiting to start.`
      : intro && intro.uiAt === null ? `${lastRetired.oldName} is planting the family's Heirloom Seed…`
        : `${lastRetired.oldName} retired and planted the family's seed: +${formatWhole(lastRetired.seedsGained)} Heirloom Seeds. ${name} (generation ${s.generation}) is next.`);
    // The seeds held count up from what the family had before this retirement.
    let held = s.seeds;
    if (heldRoll) {
      const t = Math.max(0, Math.min(1, (now - heldRoll.at) / 1200));
      held = heldRoll.from.add(s.seeds.sub(heldRoll.from).mul(1 - (1 - t) * (1 - t))).floor();
      if (t >= 1) heldRoll = null;
    }
    heldTile.updateHTML(amountHTML('seed', held));
    const per = game.getHeldSeedBonusPerSeed();
    const jar = game.getSeedJar();
    const jarSeeds = game.getSeedJarSeeds();
    bonusTile.update(bonusText(game.getHeirloomBonus()));
    // The seed jar (M9): how full it is, as a gauge and in seeds.
    const fillShare = jarSeeds > 0 ? Math.min(1, s.seeds.toNumber() / jarSeeds) : 0;
    jarGauge.update(fillShare);
    jarRow.classList.toggle('full', fillShare >= 1);
    setText(jarText, fillShare >= 1
      ? `Full: +${Math.round(jar * 100)}%. Plant the seeds past ${formatWhole(jarSeeds)}.`
      : `${formatWhole(s.seeds)} of ${formatWhole(jarSeeds)} · up to +${Math.round(jar * 100)}%`);
    const stars = Object.values(s.stars).reduce((a, b) => a + b, 0);
    starsTile.updateHTML(stars > 0 ? `${iconHTML('star', 16)}${stars}` : 'None yet');
    setText(explain, `Every seed you hold gives +${Math.round(per * 1000) / 10}% payouts, until the seed jar is full (Family Fortune makes it bigger). Planting a seed gives that up, but the trait is the family's forever, and the tree grows. `
      + 'Tap a trait on the tree to read about it and plant it. Coins, upgrades and machines start over; the seeds, the tree and Machine Stars stay. Time stands still until you start the new life.');
    start.update({ label: `Start ${name}'s life` });
    // The Great Migration (1.4.0), once the whole tree is planted
    const canMigrate = game.canMigrate();
    migrate.el.classList.toggle('hidden', !canMigrate);
    if (canMigrate) migrate.update({ label: `The Great Migration · +${formatWhole(game.getPendingWhiskers())} Golden Whiskers` });
    renderTrials();
  }

  // Colony Trials (1.4.0): after the first migration, a life can be a trial. Picked
  // here, before the life starts; each pays its whiskers once a colony.
  let trialsDrawn = false; // (the first draw announces nothing: it was there before the page loaded)
  function renderTrials(): void {
    const s = game.state;
    const c = game.data.colony;
    const open = !!c && game.trialsOpen() && s.run.playTime === 0;
    trialBox.classList.toggle('hidden', !open);
    if (!open || !c) return;
    trialPick.update(s.trial || '', (id) => id !== '' && !!s.trialsDone[id]);
    // Double Trouble (1.10) shows up once both its halves are beaten this colony.
    trialPick.buttons.forEach((b, i) => {
      const id = i === 0 ? '' : c.trials[i - 1].id;
      const hide = id !== '' && !game.isTrialUnlocked(id);
      const was = b.classList.contains('hidden');
      b.classList.toggle('hidden', hide);
      if (was && !hide && trialsDrawn) appeared(b, `trial:${id}`); // its unlock moment (1.9.0's unlock.ts)
    });
    trialsDrawn = true;
    const t = game.getTrialDef(s.trial);
    setHTML(trialNote, t
      ? `<b>${t.name}:</b> ${t.description} Reach ${amountHTML('seed', game.getTrialGoal(), 12)} Heirloom Seeds this life for ${amountHTML('whisker', game.getTrialWhiskers(t.id), 12)} Golden Whiskers; then the twist is over.`
      : `A life with a twist, for Golden Whiskers (each once a colony). ${c.trials.filter((x) => s.trialsDone[x.id]).length} of ${c.trials.length} beaten this colony. Beat two twists one at a time and they come back together as Double Trouble.`);
  }

  // 1.5.0: life in the meadow. Two butterflies flutter about near the grass, a bird flies
  // over now and then, and blossom petals drift down from the tree (none with Motion "Less").
  const critters = [
    { img: spriteImg('butterfly', 24) as HTMLImageElement, colors: null as Record<string, string> | null, seed: 0.3 },
    { img: spriteImg('butterfly', 24) as HTMLImageElement, colors: { p: '#93cfe8', F: '#cbecf8', Z: '#33739a', P: '#5ea6c8' }, seed: 2.1 },
  ];
  const bird = spriteImg('bird', 24) as HTMLImageElement;
  for (const c of [...critters.map((x) => x.img), bird]) {
    c.classList.add('bc-critter');
    el.world.appendChild(c);
  }
  let birdFrom = 0; // when the bird last set off
  function renderCritters(now: number, dt: number): void {
    const still = lessMotion() || !layout;
    for (const c of [...critters.map((x) => x.img), bird]) c.classList.toggle('hidden', still);
    if (still || !layout) return;
    const W = layout.width;
    const g = layout.ground;
    critters.forEach((c, i) => {
      const t = now / 1000 + c.seed * 10;
      // A wandering loop over the meadow, bobbing as it flaps.
      const x = W * (0.5 + 0.38 * Math.sin(t * 0.23 + c.seed) * Math.cos(t * 0.11 + i));
      const y = g - 30 - Math.abs(Math.sin(t * 0.7 + c.seed)) * g * 0.22 - Math.sin(t * 6) * 3;
      applySprite(c.img, Math.floor(now / 110 + i) % 2 ? 'butterfly2' : 'butterfly', 24, c.colors);
      c.img.style.transform = `translate(${Math.round(x - 12)}px, ${Math.round(y - 12)}px) scaleX(${Math.cos(t * 0.23 + c.seed) > 0 ? 1 : -1})`;
    });
    // The bird: across the sky every 16 s or so.
    const flight = (now - birdFrom) / 1000;
    if (flight > 16) birdFrom = now;
    const bx = -30 + flight * (W + 60) / 7;
    bird.classList.toggle('hidden', flight > 7);
    applySprite(bird, Math.floor(now / 180) % 2 ? 'bird2' : 'bird', 24, null);
    bird.style.transform = `translate(${Math.round(bx)}px, ${Math.round(layout.height * 0.12 + Math.sin(flight * 2) * 8)}px)`;
    fx.petals(el.canvas, 1.2, dt, [colors['--blossom'], '#ffffff', colors['--blossom']]);
  }

  function render(now: number): void {
    const s = game.state;
    if (s.bigCage && !el.dialog.open && now >= openAt) open(now);
    else if (!s.bigCage && el.dialog.open) close();
    else if (s.bigCage && el.dialog.open && replayAt && now >= replayAt) {
      replayAt = 0;
      open(now); // 1.4.0: after a migration, the new colony's first seed goes in
    }
    const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!s.bigCage || !el.dialog.open) return;
    place();
    if (!layout) return;
    const t = intro ? now - intro.start : null;
    const shown = shownTraits();
    if (selected && !shown.has(selected)) sheet.hide(); // the sheet never shows a hidden trait
    const shape = treeShape(layout, shown);
    const clumps = grow(shape, shown, now, dt, t === null || t >= T.sprout);
    const done = settled(shape, clumps, now);
    // Repaint the canvas only when something on it changed (every frame while it grows).
    const blossoms = Object.values(s.tree).reduce((a, b) => a + b, 0);
    const key = done ? `done|${blossoms}|${layoutKey}|${shown.size}` : `f${Math.floor(now / 16)}`;
    if (key !== drawnKey) {
      drawnKey = key;
      const mound = t === null ? 0 : t < T.digStart ? 0 : t < T.hopBack ? clamp01((t - T.digStart) / (T.digEnd - T.digStart)) : clamp01(1 - (t - T.hopBack) / 500);
      drawTree(ctx, layout, {
        trunk: drawn.trunk, girth: drawn.girth, reach: drawn.reach, mound, blossoms: done ? blossoms : 0,
        clumps: clumps.map((c) => ({ ...c, scale: born.has(c.key) ? backOut((now - born.get(c.key)!) / POP_MS) : 0 })),
      }, colors);
    }
    if (intro && t !== null) {
      playScene(t, now, shape, done);
      if (intro.uiAt !== null && t >= intro.uiAt + T.outro) {
        intro = null;
        el.dialog.classList.remove('playing');
        el.dialog.classList.add('ui-in');
      }
    }
    if (!intro) {
      // Standing by the tree: it breathes.
      el.hamster.style.left = `${hamsterX - 32}px`;
      el.hamster.style.top = `${layout.ground - 60}px`;
    }
    el.hamster.classList.toggle('idle', !intro);
    renderCritters(now, dt);
    el.skip.classList.toggle('hidden', !intro || intro.uiAt !== null);
    // A first family's first visit: once the tree is up, the first trait to plant opens by itself.
    if (!intro && !autoOpened) {
      autoOpened = true;
      const ft = game.data.familyTree;
      if (!sheet.key && ft && !ft.nodes.some((n) => game.getTreeLevel(n.id) > 0)) {
        const first = ft.nodes.find((n) => shown.has(n.id) && game.canBuyTreeNode(n.id));
        if (first) openTrait(first.id);
      }
    }
    renderNodes(shown);
    drawTraitSheet();
    shiftScene();
    renderNumbers(now);
    // The scene's speech bubble, over the hamster.
    const line = speech && now < speech.until ? speech.text : '';
    setText(el.bubble, line);
    el.bubble.classList.toggle('hidden', line === '');
    el.bubble.style.left = `${parseFloat(el.hamster.style.left || '0') + 32}px`;
    el.bubble.style.top = `${parseFloat(el.hamster.style.top || '0') - 8}px`;
  }

  build();
  return { render, build };
}
