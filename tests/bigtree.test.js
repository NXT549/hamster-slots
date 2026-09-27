// bigtree.test.js — the Big Cage's tree (M15, src/view/bigtree.ts): at every scene
// size, from a small phone to a big screen, every Family Tree trait sits inside the
// scene and no two traits overlap (so each one can be tapped). Runs with `npm test`.

import { readFileSync } from 'node:fs';
import { check } from './check.js';
import { treeLayout, bezier, TREE_TOKENS } from '../src/view/bigtree.ts';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../src/view/style.css', import.meta.url), 'utf8');
const ft = data.familyTree;
const [trunkBranch, ...rest] = ft.branches;
const nodesOf = (b) => ft.nodes.filter((n) => n.branch === b.id).map((n) => n.id);
const trunk = nodesOf(trunkBranch);
const branches = rest.map((b) => ({ id: b.id, nodes: nodesOf(b) }));

// Scene sizes the Big Cage really gets (bigcage.ts: the part of the page left for the tree).
const SIZES = [
  [320, 420], [360, 300], [360, 460], [544, 455], [390, 520], [414, 560], [600, 520], [768, 660], [819, 600],
  [820, 560], [920, 720], [1000, 560], [1200, 900], [1560, 1040],
];

for (const [w, h] of SIZES) {
  const layout = treeLayout(w, h, trunk, branches);
  const { w: bw, h: bh, up } = layout.node;
  const box = (n) => ({ left: n.x - bw / 2, right: n.x + bw / 2, top: n.y - up, bottom: n.y - up + bh });
  check(`${w}×${h}: every trait has a spot`, layout.nodes.length === ft.nodes.length && ft.nodes.every((n) => layout.nodes.some((s) => s.id === n.id)));
  const outside = layout.nodes.filter((n) => { const b = box(n); return b.left < 0 || b.top < 0 || b.right > w || b.bottom > h; });
  check(`${w}×${h}: every trait is inside the scene`, outside.length === 0, outside.map((n) => n.id).join(', '));
  const overlaps = [];
  for (let i = 0; i < layout.nodes.length; i++) {
    for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = box(layout.nodes[i]);
      const b = box(layout.nodes[j]);
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${layout.nodes[i].id} + ${layout.nodes[j].id}`);
    }
  }
  check(`${w}×${h}: no two traits overlap`, overlaps.length === 0, overlaps.join('; '));
  check(`${w}×${h}: the tree stands on the ground`, layout.base.y === layout.ground && layout.top.y < layout.ground);
  // Every branch trait sits on its branch (the curve at its t).
  const onBranch = layout.nodes.filter((n) => n.branch >= 0).every((n) => {
    const g = layout.branches[n.branch];
    const p = bezier(g.p0, g.p1, g.p2, n.t);
    return Math.abs(p.x - n.x) <= 1 && Math.abs(p.y - n.y) <= 1;
  });
  check(`${w}×${h}: every branch trait sits on its branch`, onBranch);
}

// The first trunk trait (every other trait needs it) sits at the foot of the tree, below all the rest.
{
  const layout = treeLayout(920, 720, trunk, branches);
  const root = layout.nodes.find((n) => n.id === trunk[0]);
  check('the first trait sits at the foot of the trunk', root.x === layout.base.x && layout.nodes.every((n) => n === root || n.y < root.y));
  check('half the branches grow left, half right', layout.branches.filter((b) => b.side < 0).length === Math.ceil(branches.length / 2));
}

// Every colour the tree painter reads is a theme token in style.css :root, as "#rrggbb".
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
for (const token of TREE_TOKENS) {
  check(`tree colour ${token} is a :root token`, new RegExp(`${token}:\\s*#[0-9a-fA-F]{6};`).test(root));
}
