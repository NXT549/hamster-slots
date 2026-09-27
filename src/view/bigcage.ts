// bigcage.ts — VIEW layer. The Big Cage (M8), redesigned in M15: the page between
// lives, and the only place to plant Heirloom Seeds. It's a scene of its own: a
// meadow where the family's huge tree grows (bigtree.ts paints it), with every
// Family Tree trait sitting on its branches. Tap a trait to read about it and plant it.
//
// Retiring plays the new rebirth animation: the hamster walks in with an Heirloom
// Seed, digs, plants it, and a huge tree shoots up; its branches grow out and the
// traits pop onto them. Then the numbers and the Start button slide in. A tap skips
// it, and Motion "Less" shows the grown tree straight away.
//
// Like the rest of the view, it only calls game actions (buyTreeNode, leaveBigCage)
// and reads state. ui.ts creates it and calls render() every frame.

import { spriteImg, treeIcon, applySprite, hamsterSprite } from './art.ts';
import { furColors, hatOf } from './skins.ts';
import { treeLayout, drawTree, grownTree, TREE_TOKENS } from './bigtree.ts';
import { describeEffect } from './shop.ts';
import { formatWhole, setText, setHTML, replayClass, iconHTML, popText } from './dom.ts';
import { IRIS_MS } from './celebrate.ts';
import { divide } from '../logic/money.ts';
import type { Layout, Grow, TreeColors } from './bigtree.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';
import type { Game } from '../logic/game.ts';
import type { GameEvents } from '../logic/types.ts';
import type { Money } from '../logic/money.ts';

// The rebirth animation's timeline, in ms from when the Big Cage opens.
const T = {
  walkEnd: 1000, // the hamster walks in from the left…
  seed: 1000, // …holds up the Heirloom Seed…
  digStart: 1250, digEnd: 1850, // …digs…
  dropStart: 1650, dropEnd: 1950, // …and the seed drops into the hole.
  sprout: 1950,
  trunkStart: 2100, trunkEnd: 3000, // the trunk shoots up
  hopBack: 2150, // the hamster jumps back out of the way
  branchStart: 2600, branchStep: 140, branchFor: 520, // the branches grow out, bottom first
  clumpDelay: 420, clumpFor: 380, // leaves pop out near a branch's tip
  crown: [2850, 2980, 3110], // the crown's leaves
  ui: 4300, // the numbers, the trait card and Start slide in
  end: 4700,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
// Grows a little past 1 and settles back (a pop).
const backOut = (v: number) => {
  const x = clamp01(v);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

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
  };
  const ctx = el.canvas.getContext('2d')!;
  const seedLabel = (text: string) => `${iconHTML('heirloom')}${text}`;

  let nodeEls = new Map<string, HTMLButtonElement>();
  let labelEls: HTMLElement[] = [];
  let selected: string | null = null;
  let layout: Layout | null = null;
  let layoutKey = '';
  let colors = {} as TreeColors;
  let drawnKey = ''; // what the canvas shows now (it's only repainted when that changes)
  let born = new Set<string>(); // traits that have popped onto the tree (during the animation)
  let lastRetired: GameEvents['retired'] | null = null;
  let playIntro = false; // the next opening plays the rebirth animation
  let intro: { start: number; fired: Set<string>; skipped: boolean } | null = null;
  let openAt = 0; // the page waits for the iris to close on the old life first
  let heldRoll: { from: Money; at: number } | null = null; // the seeds held count up after a retirement
  let speech: { text: string; until: number } | null = null;
  let hamsterX = 0; // where the scene's hamster stands (screen pixels in the scene)

  // ─────────────────────── building ───────────────────────

  // One button per trait (placed over the tree by place()), and a sign per branch.
  function build(): void {
    el.nodes.replaceChildren();
    nodeEls = new Map();
    labelEls = [];
    const ft = game.data.familyTree;
    if (!ft) return;
    for (const def of ft.nodes) {
      const btn = document.createElement('button');
      btn.className = 'bt-node';
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
    for (const branch of ft.branches.slice(1)) {
      const sign = document.createElement('span');
      sign.className = 'bt-sign';
      sign.textContent = branch.name;
      el.nodes.appendChild(sign);
      labelEls.push(sign);
    }
    if (!selected || !nodeEls.has(selected)) selected = ft.nodes[0] ? ft.nodes[0].id : null;
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
    const key = `${w}x${h}`;
    if (key === layoutKey || !ft || w < 10 || h < 10) return;
    layoutKey = key;
    const [trunk, ...branches] = ft.branches;
    const nodesOf = (id: string) => ft.nodes.filter((n) => n.branch === id).map((n) => n.id);
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
    layout.branches.forEach((b, i) => {
      const sign = labelEls[i];
      if (!sign) return;
      sign.style.left = `${b.label.x}px`;
      sign.style.top = `${b.label.y - b.r0 - 6}px`;
    });
    hamsterX = layout.base.x - layout.trunkR0 * 1.6 - 34;
    drawnKey = '';
  }

  // ─────────────────────── the rebirth animation ───────────────────────

  // The order the branches grow in: bottom row first, left then right.
  function growOrder(i: number): number {
    const per = Math.ceil((layout ? layout.branches.length : 0) / 2);
    return i < per ? i * 2 : (i - per) * 2 + 1;
  }

  // How grown everything is t ms into the animation (null: no animation, all grown).
  function growAt(t: number | null, blossoms: number): Grow {
    if (!layout) return { trunk: 0, branches: [], clumps: [], mound: 0, blossoms: 0 };
    if (t === null) return grownTree(layout, blossoms);
    const trunk = t < T.sprout ? 0 : t < T.trunkStart ? 0.06 * easeOut((t - T.sprout) / (T.trunkStart - T.sprout))
      : 0.06 + 0.94 * easeOut((t - T.trunkStart) / (T.trunkEnd - T.trunkStart));
    const branchStart = (i: number) => T.branchStart + growOrder(i) * T.branchStep;
    const branches = layout.branches.map((_, i) => easeOut((t - branchStart(i)) / T.branchFor));
    let crown = 0;
    const clumps = layout.clumps.map((c) => {
      const start = c.branch >= 0 ? branchStart(c.branch) + T.clumpDelay : T.crown[Math.min(crown++, T.crown.length - 1)];
      return t < start ? 0 : backOut((t - start) / T.clumpFor);
    });
    const mound = t < T.digStart ? 0 : t < T.trunkStart ? clamp01((t - T.digStart) / (T.digEnd - T.digStart)) : clamp01(1 - (t - T.trunkStart) / 500);
    return { trunk, branches, clumps, mound, blossoms: t >= T.ui ? blossoms : 0 };
  }

  // Has this trait grown onto the tree yet?
  function isBorn(id: string, g: Grow): boolean {
    if (!layout) return false;
    const spot = layout.nodes.find((n) => n.id === id);
    if (!spot) return false;
    if (spot.branch < 0) {
      if (spot.t === 0) return g.trunk > 0.25; // at the foot of the trunk
      const crown = layout.clumps.findIndex((c) => c.branch < 0);
      return (g.clumps[crown] || 0) > 0.9; // at the top of the crown
    }
    return (g.branches[spot.branch] || 0) >= spot.t;
  }

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
  function playScene(t: number, now: number): void {
    if (!layout || !intro) return;
    const L = layout;
    const plantX = L.base.x - 30;
    const frame = t < T.walkEnd ? (Math.floor(now / 110) % 2 ? 'hamster2' : 'hamster') : 'hamster';
    applySprite(el.hamster, hamsterSprite(frame, hatOf(game)), 48, furColors(game));
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
    el.hamster.style.left = `${x - 24}px`;
    el.hamster.style.top = `${L.ground - 46 - lift}px`;
    el.hamster.classList.toggle('digging', t >= T.digStart && t < T.digEnd);
    // The seed: held up over its head, then it drops into the hole.
    const seedUp = t >= T.seed && t < T.dropEnd;
    el.seed.classList.toggle('hidden', !seedUp);
    if (seedUp) {
      const k = clamp01((t - T.dropStart) / (T.dropEnd - T.dropStart));
      const sx = plantX + (L.base.x - plantX) * k;
      const sy = L.ground - 84 + (80 * k * k); // falls faster and faster
      el.seed.style.left = `${sx - 12}px`;
      el.seed.style.top = `${sy - 12}px`;
    }
    cue('hello', T.seed, t, () => {
      replayClass(el.hamster, 'hop');
      sound.play('sticker');
      say('Our Heirloom Seed! Let\'s plant it.', 2400);
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
    cue('grow', T.trunkStart, t, () => {
      sound.play('sprout');
      sound.play('anticipation');
      replayClass(el.scene, 'rumble');
      say('Whoa! Look at it grow!', 2200);
    });
    cue('leaves', T.crown[0], t, () => {
      const p = scenePoint(L.top.x, L.top.y);
      fx.burst(p.x, p.y, { count: 40, palette: [colors['--leaf'], colors['--leaf-light'], colors['--leaf-dark']], speed: 260, gravity: 260, size: 4, twinkle: false });
    });
    L.branches.forEach((b, i) => {
      cue(`branch${i}`, T.branchStart + growOrder(i) * T.branchStep + T.clumpDelay, t, () => {
        const p = scenePoint(b.p2.x, b.p2.y);
        fx.burst(p.x, p.y, { count: 14, palette: [colors['--leaf'], colors['--leaf-light'], colors['--blossom']], speed: 180, gravity: 240, size: 3, twinkle: false });
        sound.play('tick');
      });
    });
    // The numbers, the card and Start slide in; Heirloom Seeds rain down.
    cue('ui', T.ui, t, () => {
      el.dialog.classList.add('ui-in');
      if (heldRoll) heldRoll.at = performance.now();
      fx.rain('heirloom', el.scene, lastRetired ? Math.min(40, 12 + lastRetired.seedsGained.toNumber()) : 10, { scale: 2, floor: false });
      say(game.data.familyTree.nodes.some((n) => game.canBuyTreeNode(n.id))
        ? 'Tap a trait to plant it. Every pup after me is born with it!' : 'Start the new life when you\'re ready!', 4500);
    }, true);
  }

  function skip(): void {
    if (!intro) return;
    intro.skipped = true;
    intro.start = performance.now() - T.end;
  }
  el.scene.addEventListener('click', (e) => {
    if (intro && !(e.target as Element).closest('.bt-node')) skip();
  });
  el.skip.addEventListener('click', skip);

  // ─────────────────────── opening and closing ───────────────────────

  function open(now: number): void {
    el.dialog.showModal();
    // The particles move into the dialog while it's open (a dialog sits above the
    // whole page, canvas included).
    el.dialog.appendChild(fx.canvas);
    readColors();
    layoutKey = '';
    place();
    born = new Set();
    const animate = playIntro && !lessMotion();
    playIntro = false;
    intro = animate ? { start: now, fired: new Set(), skipped: false } : null;
    el.dialog.classList.toggle('playing', animate);
    el.dialog.classList.toggle('ui-in', !animate);
    if (!animate) {
      el.hamster.style.left = `${hamsterX - 24}px`;
      el.hamster.style.top = `${(layout ? layout.ground : 0) - 46}px`;
      applySprite(el.hamster, hamsterSprite('hamster', hatOf(game)), 48, furColors(game));
      el.seed.classList.add('hidden');
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
    // Wait for the iris to close on the old life (ui.ts), then play the animation.
    if (!lessMotion()) {
      playIntro = true;
      heldRoll = { from: game.state.seeds.sub(e.seedsGained), at: Infinity };
      openAt = performance.now() + IRIS_MS + 150;
    }
  });
  game.on('bigCageLeft', () => { lastRetired = null; });
  game.on('dataReloaded', build);

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
    const line = treeLine(game.getTreeNodeDef(e.id)!.effect.type);
    if (line) say(line);
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
  el.dialog.addEventListener('cancel', (e) => e.preventDefault());
  // A new size (the window turned, or resized): lay the tree out again.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { layoutKey = ''; }).observe(el.scene);

  // ─────────────────────── drawing ───────────────────────

  function renderNodes(g: Grow): void {
    for (const [id, btn] of nodeEls) {
      const level = game.getTreeLevel(id);
      const maxed = game.isTreeMaxed(id);
      btn.classList.toggle('owned', level > 0);
      btn.classList.toggle('locked', !game.isTreeNodeUnlocked(id));
      btn.classList.toggle('ready', game.canBuyTreeNode(id));
      btn.classList.toggle('selected', id === selected);
      // During the animation a trait appears when its branch has grown out to it.
      const here = !intro || isBorn(id, g);
      if (here && !born.has(id)) {
        born.add(id);
        if (intro && !intro.skipped) {
          replayClass(btn, 'sprout');
          fx.burstAt(btn, { count: 8, palette: [colors['--leaf-light'], '#ffffff'], speed: 110, gravity: 200, size: 3 });
        }
      }
      btn.classList.toggle('unborn', !here);
      const cost = seedLabel(formatWhole(game.getTreeCost(id)));
      setHTML(btn.querySelector<HTMLElement>('.node-cost')!, maxed ? (level > 1 ? `Lv ${level}` : 'Owned') : level > 0 ? `Lv ${level} · ${cost}` : cost);
    }
    for (const sign of labelEls) sign.classList.toggle('unborn', !!intro && g.trunk < 1);
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
    const needs = unlocked ? '' : `<div class="note">Needs ${def.requires.map((r) => game.getTreeNodeDef(r)!.name).join(' + ')} first.</div>`;
    // What planting does to the heirloom bonus: the seeds it spends stop paying,
    // unless the jar stays full (M9); Family Fortune also makes the jar bigger.
    const held = game.state.seeds;
    const nowBonus = game.getHeirloomBonus();
    const afterBonus = game.getHeirloomBonusFor(held.sub(cost).max(0), def.effect.type === 'seedJar' ? { [def.id]: level + 1 } : undefined);
    const change = afterBonus.eq(nowBonus) ? `heirloom bonus stays ${bonusText(nowBonus)} (the seed jar is still full)` : `heirloom bonus ${bonusText(nowBonus)} → ${bonusText(afterBonus)}`;
    const trade = unlocked && !maxed && held.gte(cost) ? `<div class="note">Planting spends ${formatWhole(cost)} of your ${formatWhole(held)} seeds: ${change}.</div>` : '';
    const fill = maxed || affordable || !unlocked ? 0 : Math.min(100, divide(held, cost).toNumber() * 100);
    const buttonClass = maxed ? 'maxed' : affordable ? '' : 'poor';
    const buttonText = maxed ? 'Owned' : !unlocked ? 'Locked' : seedLabel(`Plant · ${formatWhole(cost)}`);
    setHTML(el.detail, `
      <div class="tile-top">
        <div class="tile-icon">${iconHTML(treeIcon(def) || 'heirloom', 32)}</div>
        <div><div class="tile-name">${def.name}</div><div class="tile-tag">${branch ? branch.name : ''} · ${maxText}</div></div>
      </div>
      <div class="tile-desc">${def.description}</div>
      <div class="tile-effect">${describeEffect(game, def, game.previewTreeNode(def.id))}</div>
      ${needs}${trade}
      <button class="buy-btn ${buttonClass}"><span class="buy-fill" style="width:${fill.toFixed(1)}%"></span><span class="buy-label">${buttonText}</span></button>`);
  }

  function renderNumbers(now: number): void {
    const s = game.state;
    const name = game.getPupName();
    setText(el.sub, !lastRetired ? `${name} (generation ${s.generation}) is waiting to start.`
      : intro && now - intro.start < T.ui ? `${lastRetired.oldName} is planting the family's Heirloom Seed…`
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
    setText(el.explain, `Every seed you hold gives +${Math.round(per * 1000) / 10}% payouts, until the seed jar is full (Family Fortune makes it bigger). Planting a seed gives that up, but the trait is the family's forever. `
      + 'Coins, upgrades and machines start over; the seeds, the tree and Machine Stars stay. Time stands still until you start the new life.');
    setText(el.start, `Start ${name}'s life`);
  }

  function render(now: number): void {
    const s = game.state;
    if (s.bigCage && !el.dialog.open && now >= openAt) open(now);
    else if (!s.bigCage && el.dialog.open) close();
    if (!s.bigCage || !el.dialog.open) return;
    place();
    const t = intro ? now - intro.start : null;
    const blossoms = Object.values(s.tree).reduce((a, b) => a + b, 0);
    const g = growAt(t, blossoms);
    // Repaint the canvas only when something on it changed (every frame while it grows).
    const key = t !== null && t < T.end ? `t${Math.floor(t / 16)}` : `grown|${blossoms}`;
    if (layout && key !== drawnKey) {
      drawnKey = key;
      drawTree(ctx, layout, g, colors);
    }
    if (intro && t !== null) {
      playScene(t, now);
      if (t >= T.end) {
        intro = null;
        el.dialog.classList.remove('playing');
        el.dialog.classList.add('ui-in');
      }
    } else if (layout) {
      // Standing by the tree: it breathes.
      el.hamster.style.left = `${hamsterX - 24}px`;
      el.hamster.style.top = `${layout.ground - 46}px`;
    }
    el.hamster.classList.toggle('idle', !intro);
    el.skip.classList.toggle('hidden', !intro);
    renderNodes(g);
    renderDetail();
    renderNumbers(now);
    // The scene's speech bubble, over the hamster.
    const line = speech && now < speech.until ? speech.text : '';
    setText(el.bubble, line);
    el.bubble.classList.toggle('hidden', line === '');
    el.bubble.style.left = `${parseFloat(el.hamster.style.left || '0') + 24}px`;
    el.bubble.style.top = `${parseFloat(el.hamster.style.top || '0') - 8}px`;
  }

  build();
  return { render, build };
}
