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
    sub: $('bc-sub'), held: $('bc-held'), bonus: $('bc-bonus'), stars: $('bc-stars'),
    jar: $('bc-jar'), jarFill: $('bc-jar-fill'), jarText: $('bc-jar-text'), explain: $('bc-explain'),
    detail: $('tree-detail'), start: $<HTMLButtonElement>('bc-start'),
    // 1.4.0
    migrate: $<HTMLButtonElement>('bc-migrate'), banner: $('bc-banner'),
    trials: $('bc-trials'), trialPicks: $('bc-trial-picks'), trialNote: $('bc-trial-note'),
  };
  const ctx = el.canvas.getContext('2d')!;
  const seedLabel = (text: string) => `${iconHTML('heirloom')}${text}`;

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
  let hamsterX = 0; // where the scene's hamster stands (screen pixels in the scene)
  let lastMigrated: GameEvents['migrated'] | null = null; // 1.4.0: the family has just moved to a new colony
  let migrateArmed = 0; // migrating needs two taps
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
        selected = def.id;
      });
      el.nodes.appendChild(btn);
      nodeEls.set(def.id, btn);
    }
    if (!selected || !nodeEls.has(selected)) selected = ft.nodes[0] ? ft.nodes[0].id : null;
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
    if (intro && !(e.target as Element).closest('.bt-node')) skip();
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
    migrateArmed = 0;
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
    const button = el.detail.querySelector('.buy-btn');
    fx.ringAt(button, { count: 18, speed: 240, palette: [fx.colors.heirloom[0], '#ffffff'] });
    if (!lessMotion()) {
      const level = game.getTreeLevel(e.id);
      popText(button || node, game.isTreeMaxed(e.id) && level > 1 ? 'MAX!' : level > 1 ? `LV ${level}!` : 'Planted!', 'seed');
      popText(el.held, `−${formatWhole(e.cost)}`, 'seed');
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

  // Plant: the detail card is redrawn often, so it listens on the card itself.
  el.detail.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('.buy-btn');
    if (!button || !selected) return;
    button.blur();
    game.buyTreeNode(selected);
  });
  // Only the button starts the new life (Escape doesn't close the page).
  el.start.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    game.leaveBigCage();
  });
  // The Great Migration (1.4.0): two taps, it can't happen by accident.
  el.migrate.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    const now = performance.now();
    if (now < migrateArmed) {
      migrateArmed = 0;
      game.migrate();
    } else {
      migrateArmed = now + 3000;
      sound.play('tick');
      say(`A new colony: the tree, the seeds and the stars start again, for ${formatWhole(game.getPendingWhiskers())} Golden Whiskers. Tap again to go!`, 4000);
    }
  });
  // A Colony Trial for this life (or none): the picks are redrawn often, so it listens on the row.
  el.trialPicks.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-trial]');
    if (!button) return;
    button.blur();
    const id = button.dataset.trial || null;
    if (id === game.state.trial) return;
    if (game.startTrial(id)) {
      const t = game.getTrialDef(id);
      say(t ? `${t.name}: ${t.description} Beat it for ${formatWhole(game.getTrialWhiskers(t.id))} Golden Whiskers!` : 'An ordinary life it is.', 4000);
    }
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

  function renderDetail(): void {
    const def = selected && game.getTreeNodeDef(selected);
    if (!def) {
      setHTML(el.detail, '');
      return;
    }
    const level = game.getTreeLevel(def.id);
    const maxed = game.isTreeMaxed(def.id);
    const cost = game.getTreeCost(def.id);
    const unlocked = game.isTreeNodeUnlocked(def.id);
    const affordable = game.canBuyTreeNode(def.id);
    const branch = game.data.familyTree.branches.find((b) => b.id === def.branch);
    const maxText = def.maxLevel ? `Lv ${level}/${def.maxLevel}` : `Lv ${level}`;
    // What planting does to the heirloom bonus: the seeds it spends stop paying,
    // unless the jar stays full (M9); Family Fortune also makes the jar bigger.
    const held = game.state.seeds;
    const nowBonus = game.getHeirloomBonus();
    const afterBonus = game.getHeirloomBonusFor(held.sub(cost).max(0), def.effect.type === 'seedJar' ? { [def.id]: level + 1 } : undefined);
    const change = afterBonus.eq(nowBonus) ? `heirloom bonus stays ${bonusText(nowBonus)} (the seed jar is still full)` : `heirloom bonus ${bonusText(nowBonus)} → ${bonusText(afterBonus)}`;
    const trade = unlocked && !maxed && held.gte(cost) ? `<div class="note">Planting spends ${formatWhole(cost)} of your ${formatWhole(held)} seeds: ${change}.</div>` : '';
    // What planting it makes grow: the traits that need it.
    const opens = level === 0 ? game.data.familyTree.nodes.filter((n) => n.requires.includes(def.id)) : [];
    const grows = opens.length ? `<div class="note">Planting it grows the tree: ${opens.map((n) => n.name).join(', ')} ${opens.length === 1 ? 'appears' : 'appear'}.</div>` : '';
    const fill = maxed || affordable || !unlocked ? 0 : Math.min(100, divide(held, cost).toNumber() * 100);
    const buttonClass = maxed ? 'maxed' : affordable ? '' : 'poor';
    const buttonText = maxed ? 'Owned' : seedLabel(`Plant · ${formatWhole(cost)}`);
    setHTML(el.detail, `
      <div class="tile-top">
        <div class="tile-icon">${iconHTML(treeIcon(def) || 'heirloom', 32)}</div>
        <div><div class="tile-name">${def.name}</div><div class="tile-tag">${branch ? branch.name : ''} · ${maxText}</div></div>
      </div>
      <div class="tile-desc">${def.description}</div>
      <div class="tile-effect">${describeEffect(game, def, game.previewTreeNode(def.id))}</div>
      ${trade}${grows}
      <button class="buy-btn ${buttonClass}"><span class="buy-fill" style="width:${fill.toFixed(1)}%"></span><span class="buy-label">${buttonText}</span></button>`);
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
    setHTML(el.held, seedLabel(formatWhole(held)));
    const per = game.getHeldSeedBonusPerSeed();
    const jar = game.getSeedJar();
    const jarSeeds = game.getSeedJarSeeds();
    setText(el.bonus, `${bonusText(game.getHeirloomBonus())} payouts`);
    // The seed jar (M9): how full it is, as a bar and in seeds.
    const fillShare = jarSeeds > 0 ? Math.min(1, s.seeds.toNumber() / jarSeeds) : 0;
    el.jarFill.style.width = `${(fillShare * 100).toFixed(1)}%`;
    el.jar.classList.toggle('full', fillShare >= 1);
    setText(el.jarText, fillShare >= 1
      ? `Full: +${Math.round(jar * 100)}% (${formatWhole(jarSeeds)} seeds). Plant the seeds past that.`
      : `${formatWhole(s.seeds)} of ${formatWhole(jarSeeds)} seeds · up to +${Math.round(jar * 100)}%`);
    const stars = Object.values(s.stars).reduce((a, b) => a + b, 0);
    setHTML(el.stars, stars > 0 ? `${iconHTML('star', 16)}${stars}` : 'none yet');
    setText(el.explain, `Every seed you hold gives +${Math.round(per * 1000) / 10}% payouts, until the seed jar is full (Family Fortune makes it bigger). Planting a seed gives that up, but the trait is the family's forever, and the tree grows. `
      + 'Coins, upgrades and machines start over; the seeds, the tree and Machine Stars stay. Time stands still until you start the new life.');
    setText(el.start, `Start ${name}'s life`);
    // The Great Migration (1.4.0), once the whole tree is planted
    const canMigrate = game.canMigrate();
    el.migrate.classList.toggle('hidden', !canMigrate);
    if (canMigrate) {
      setHTML(el.migrate, now < migrateArmed ? 'Tap again: pack up for a new colony!'
        : `The Great Migration · <span class="whisker-amount">${iconHTML('whisker', 16)}+${formatWhole(game.getPendingWhiskers())}</span> Golden Whiskers`);
    }
    renderTrials();
  }

  // Colony Trials (1.4.0): after the first migration, a life can be a trial. Picked
  // here, before the life starts; each pays its whiskers once a colony.
  function renderTrials(): void {
    const s = game.state;
    const c = game.data.colony;
    const open = !!c && game.trialsOpen() && s.run.playTime === 0;
    el.trials.classList.toggle('hidden', !open);
    if (!open || !c) return;
    const key = `${s.trial}|${c.trials.map((t) => (s.trialsDone[t.id] ? 1 : 0)).join('')}|${formatWhole(s.seedsEarned)}`;
    if (el.trialPicks.dataset.key !== key) {
      el.trialPicks.dataset.key = key;
      const pick = (id: string, label: string, done: boolean) => `<button class="seg-btn${(s.trial || '') === id ? ' active' : ''}" data-trial="${id}"${done ? ' disabled' : ''}>${label}${done ? ' ✓' : ''}</button>`;
      setHTML(el.trialPicks, pick('', 'None', false) + c.trials.map((t) => pick(t.id, t.name, !!s.trialsDone[t.id])).join(''));
    }
    const t = game.getTrialDef(s.trial);
    const seeds = (n: Money) => `<span class="seed-amount">${iconHTML('heirloom', 16)}${formatWhole(n)}</span>`;
    const whiskers = (n: Money) => `<span class="whisker-amount">${iconHTML('whisker', 16)}${formatWhole(n)}</span>`;
    setHTML(el.trialNote, t
      ? `<b>${t.name}:</b> ${t.description} Reach ${seeds(game.getTrialGoal())} Heirloom Seeds this life for ${whiskers(game.getTrialWhiskers(t.id))} Golden Whiskers; then the twist is over.`
      : `A life with a twist, for Golden Whiskers (each once a colony). ${c.trials.filter((x) => s.trialsDone[x.id]).length} of ${c.trials.length} beaten this colony.`);
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
    if (selected && !shown.has(selected)) selected = [...shown][0] || null; // the card never shows a hidden trait
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
    el.skip.classList.toggle('hidden', !intro || intro.uiAt !== null);
    renderNodes(shown);
    renderDetail();
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
