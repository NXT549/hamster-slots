// bigtree.test.js — the Big Cage's tree (M15, src/view/bigtree.ts): at every scene
// size, from a small phone to a big screen, every Family Tree trait sits inside the
// scene and no two traits overlap (so each one can be tapped); and the tree grows the
// way the family plants: it only ever gets bigger, and it always reaches every trait
// that shows. Runs with `npm test`.

import { readFileSync } from 'node:fs';
import { check } from './check.js';
import { treeLayout, treeShape, trunkTop, bezier, TREE_TOKENS } from '../src/view/bigtree.ts';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../src/view/style.css', import.meta.url), 'utf8');
const ft = data.familyTree;
const [trunkBranch, ...rest] = ft.branches;
// The whole tree (a migrated family's, with 1.4.0's colony traits as a 4th level), and
// the first colony's (bigcage.ts leaves the colony traits out until the family migrates).
const treeFor = (nodes) => {
  const of = (b) => nodes.filter((n) => n.branch === b.id).map((n) => n.id);
  return { nodes, trunk: of(trunkBranch), branches: rest.map((b) => ({ id: b.id, nodes: of(b) })) };
};
const TREES = [['colony tree', treeFor(ft.nodes)], ['first colony', treeFor(ft.nodes.filter((n) => !n.colony))]];
const { trunk, branches } = TREES[0][1];

// Scene sizes the Big Cage really gets (bigcage.ts: the part of the page left for the tree).
const SIZES = [
  [320, 420], [360, 300], [360, 460], [544, 455], [390, 520], [414, 560], [600, 520], [768, 660], [819, 600],
  [820, 560], [920, 720], [1000, 560], [1200, 900], [1560, 1040],
];

for (const [label, tree] of TREES) for (const [wide, high] of SIZES) {
  const w = wide;
  const h = high;
  const { trunk, branches } = tree;
  const layout = treeLayout(w, h, trunk, branches);
  const tag = `${label}, ${w}×${h}`;
  const { w: bw, h: bh, up } = layout.node;
  const box = (n) => ({ left: n.x - bw / 2, right: n.x + bw / 2, top: n.y - up, bottom: n.y - up + bh });
  check(`${tag}: every trait has a spot`, layout.nodes.length === tree.nodes.length && tree.nodes.every((n) => layout.nodes.some((s) => s.id === n.id)));
  const outside = layout.nodes.filter((n) => { const b = box(n); return b.left < 0 || b.top < 0 || b.right > w || b.bottom > h; });
  check(`${tag}: every trait is inside the scene`, outside.length === 0, outside.map((n) => n.id).join(', '));
  const overlaps = [];
  for (let i = 0; i < layout.nodes.length; i++) {
    for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = box(layout.nodes[i]);
      const b = box(layout.nodes[j]);
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${layout.nodes[i].id} + ${layout.nodes[j].id}`);
    }
  }
  check(`${tag}: no two traits overlap`, overlaps.length === 0, overlaps.join('; '));
  check(`${tag}: the tree stands on the ground`, layout.base.y === layout.ground && layout.fullTop < layout.ground);
  // Every branch trait sits on its limb (the curve at its t), and right above the trait it needs.
  const onLimb = layout.nodes.filter((n) => n.limb >= 0).every((n) => {
    const l = layout.limbs[n.limb];
    const p = bezier(l.p0, l.p1, l.p2, n.t);
    return Math.abs(p.x - n.x) <= 1 && Math.abs(p.y - n.y) <= 1 && l.tier === n.tier;
  });
  check(`${tag}: every branch trait sits on its limb`, onLimb);
  const stacked = tree.nodes.filter((n) => n.branch !== trunkBranch.id && n.requires.length).every((n) => {
    const me = layout.nodes.find((s) => s.id === n.id);
    return n.requires.every((r) => {
      const need = layout.nodes.find((s) => s.id === r);
      return need.limb < 0 || (Math.abs(need.x - me.x) <= 1 && need.y > me.y);
    });
  });
  check(`${tag}: a trait sits right above the one it needs`, stacked);
}

// The tree grows as the family plants (bigcage.ts shows a trait once it's planted or
// the traits it needs are): a sapling at first, and it never shrinks as more shows.
{
  const layout = treeLayout(920, 720, trunk, branches);
  const planted = new Set();
  const shownFor = () => new Set(ft.nodes.filter((n) => planted.has(n.id) || n.requires.every((r) => planted.has(r))).map((n) => n.id));
  const first = treeShape(layout, shownFor());
  check('with nothing planted the tree is a sapling: only the first trait shows, no limbs', shownFor().size === 1 && first.tier === 0 && first.trunk < 0.4 && first.reach.every((r) => r === 0));
  let last = first;
  let grows = true;
  let reaches = true;
  // Plant everything, one trait at a time, in data.json's order (every trait's needs come first).
  for (const n of ft.nodes) {
    planted.add(n.id);
    const shown = shownFor();
    const shape = treeShape(layout, shown);
    if (shape.trunk < last.trunk || shape.girth < last.girth || shape.reach.some((r, i) => r < last.reach[i])) grows = false;
    for (const spot of layout.nodes.filter((x) => shown.has(x.id))) {
      const ok = spot.limb < 0 ? trunkTop(layout, shape.trunk) <= spot.y : shape.reach[spot.limb] >= spot.t;
      if (!ok) reaches = false;
    }
    last = shape;
  }
  check('planting only ever makes the tree bigger', grows);
  check('the tree always reaches every trait that shows', reaches);
  check('with every trait planted the tree is fully grown', last.trunk === 1 && last.girth === 1);
}

// The first trunk trait (every other trait needs it) sits at the foot of the tree, below all the rest.
{
  const layout = treeLayout(920, 720, trunk, branches);
  const root = layout.nodes.find((n) => n.id === trunk[0]);
  check('the first trait sits at the foot of the trunk', root.x === layout.base.x && layout.nodes.every((n) => n === root || n.y < root.y));
  const left = layout.nodes.filter((n) => n.branch >= 0 && n.x < layout.base.x);
  check('half the branches grow on the left, half on the right', new Set(left.map((n) => n.branch)).size === Math.ceil(branches.length / 2));
}

// Every colour the tree painter reads is a theme token in style.css :root, as "#rrggbb".
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
for (const token of TREE_TOKENS) {
  check(`tree colour ${token} is a :root token`, new RegExp(`${token}:\\s*#[0-9a-fA-F]{6};`).test(root));
}
