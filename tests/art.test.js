// art.test.js — checks the text sprites in src/view/art.ts are well-formed, and
// that every skin and theme token they rely on exists. Runs with `npm test`.
// (Moved from tools/test_art.mjs in migration step 3.3; the checks are unchanged.)
//
// A typo in a sprite (a row one pixel too short, or a letter with no colour)
// is easy to make by hand and hard to spot on screen. This catches it.

import { readFileSync } from 'node:fs';
import { check } from './check.js';
import { SPRITES, PALETTE, SYMBOL_SPRITES, CAPSULE_SPRITES, MACHINE_SPRITES, upgradeIcon, treeIcon, perkIcon } from '../src/view/art.ts';
import { SKIN_ART, SKIN_TOKENS } from '../src/view/skins.ts';
import { FRAME_SPRITES, THEME_TOKENS } from '../src/view/theme.ts';
import { CAGE_TOKENS, cageLayout } from '../src/view/cage.ts';
import { CABINET_TOKENS, painted } from '../src/view/cabinet.ts';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));


for (const [name, rows] of Object.entries(SPRITES)) {
  const width = rows[0].length;
  const badRows = rows.map((r, i) => [i, r.length]).filter(([, len]) => len !== width);
  check(`${name}: every row is ${width} px wide`, badRows.length === 0, `rows with wrong width: ${JSON.stringify(badRows)}`);
  const unknown = [...new Set(rows.join('').split(''))].filter((ch) => ch !== '.' && !(ch in PALETTE));
  check(`${name}: every pixel letter has a palette colour`, unknown.length === 0, `unknown: ${unknown.join(' ')}`);
}

// Style guide (see the top of src/view/art.ts): square sprites of 32 (1.5.0: the hamster
// and the reel symbols), 24, 16 or 12 pixels.
for (const [name, rows] of Object.entries(SPRITES)) {
  check(`${name}: is a square 32, 24, 16 or 12 px sprite`, rows.length === rows[0].length && [32, 24, 16, 12].includes(rows.length),
    `${rows[0].length}x${rows.length}`);
}

for (const m of data.machines) {
  check(`machine "${m.id}" has a sprite`, MACHINE_SPRITES[m.id] in SPRITES);
  for (const s of m.symbols) {
    check(`symbol "${s.id}" has a sprite`, SYMBOL_SPRITES[s.id] in SPRITES);
  }
}

// 9-slice frames: CSS stretches the middle of each edge (border-image), so the
// middle 4 pixels of every edge must be the same all along, and the centre one colour.
for (const name of FRAME_SPRITES) {
  const rows = SPRITES[name];
  const n = rows.length;
  const mid = [4, 5, 6, 7];
  const edgeRowsOk = rows.every((row) => mid.every((x) => row[x] === row[4])); // top, bottom and middle rows
  const edgeColsOk = [...rows[0]].every((_, x) => mid.every((y) => rows[y][x] === rows[4][x])); // left, right and middle columns
  const centre = new Set(mid.flatMap((y) => mid.map((x) => rows[y][x])));
  check(`${name}: a 12×12 frame whose edges can stretch (9-slice)`, n === 12 && edgeRowsOk && edgeColsOk && centre.size === 1);
}
for (const u of data.upgrades) {
  check(`upgrade "${u.id}" has an icon`, upgradeIcon(u) in SPRITES);
}
for (const n of data.familyTree.nodes) {
  check(`tree node "${n.id}" has an icon`, treeIcon(n) in SPRITES);
}
check('the Heirloom Seed currency has a sprite', 'heirloom' in SPRITES);
// 1.4.0: Golden Whiskers and the colony perks.
check('the Golden Whiskers currency has a 12 px sprite', 'whisker' in SPRITES && SPRITES.whisker.length === 12);
for (const p of data.colony.perks) {
  check(`colony perk "${p.id}" has an icon`, perkIcon(p) in SPRITES);
}
check('the Hamster Token and Capsule Machine have sprites', 'token' in SPRITES && 'gacha' in SPRITES);
for (const r of data.capsules.rarities) {
  check(`capsule rarity "${r.id}" has a capsule sprite`, CAPSULE_SPRITES[r.id] in SPRITES);
}

// Skins: data.json lists them, src/view/skins.ts says what they look like.
for (const skin of data.skins) {
  const art = SKIN_ART[skin.id];
  check(`skin "${skin.id}" has art in src/view/skins.ts`, !!art);
  if (!art) continue;
  if (skin.category === 'fur') {
    const letters = Object.keys(art.colors || {});
    check(`fur "${skin.id}" only recolours real palette letters`, letters.every((ch) => ch in PALETTE), letters.join(' '));
    check(`fur "${skin.id}" has no CSS tokens`, !art.tokens);
  } else {
    const names = Object.keys(art.tokens || {});
    check(`skin "${skin.id}" only sets CSS custom properties`, names.every((n) => n.startsWith('--')), names.join(' '));
    check(`skin "${skin.id}" has no fur colours`, !art.colors);
  }
  const starterEmpty = skin.rarity !== 'starter' || (!art.colors && !art.tokens);
  check(`skin "${skin.id}": starter skins are the plain classic look`, starterEmpty);
}
// A skin token that isn't a theme token in style.css :root would silently do nothing.
const css = readFileSync(new URL('../src/view/style.css', import.meta.url), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
for (const name of SKIN_TOKENS) {
  check(`skin token ${name} is a theme token in style.css :root`, rootBlock.includes(`${name}:`));
}
check('no art for skins that are not in data.json', Object.keys(SKIN_ART).every((id) => data.skins.some((s) => s.id === id)));

// theme.ts paints the pixel frames in token colours and mixes them, which needs "#rrggbb".
for (const name of THEME_TOKENS) {
  const match = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`));
  check(`theme token ${name} is a #rrggbb colour in style.css :root`, !!match && /^#[0-9a-f]{6}$/i.test(match[1].trim()), match && match[1]);
}

// 1.5.0: the painted cage (cage.ts) and the machine cabinets (cabinet.ts) read their
// colours from theme tokens. A token missing from style.css :root would paint magenta.
for (const name of new Set([...CAGE_TOKENS, ...CABINET_TOKENS])) {
  check(`painted-scene token ${name} is a theme token in style.css :root`, rootBlock.includes(`${name}:`));
}
// The cage's layout at the sizes the stage really gets (a phone to a big screen): the
// back wall sits inside the stage, the tray's front below it, and the room's window,
// shelf and portrait inside the back wall, never overlapping each other.
for (const [W, H, wallB, floorT] of [[374, 360, 250, 276], [520, 420, 300, 326], [815, 724, 584, 610], [1100, 900, 740, 766], [300, 260, 180, 198]]) {
  const L = cageLayout(W, H, wallB, floorT);
  const tag = `cage layout ${W}×${H}`;
  check(`${tag}: the back wall is inside the stage`, L.back.l > 0 && L.back.r < L.w && L.back.top > 0 && L.back.floor < L.wallB && L.wallB <= L.floorT && L.floorT <= L.h);
  const parts = [L.window, L.shelf, L.portrait].filter(Boolean);
  check(`${tag}: the window, shelf and portrait are on the back wall`, parts.every((r) => r.x > L.back.l && r.x + r.w < L.back.r && r.y > L.back.top && r.y + r.h < L.back.floor));
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  check(`${tag}: nothing on the wall overlaps`, parts.every((a, i) => parts.every((b, j) => i === j || !overlap(a, b))));
}

// 1.6.1 (Fresh Coat): a machine skin paints every machine, not only Old Clunky.
for (const skin of data.skins.filter((s) => s.category === 'machine' && s.rarity !== 'starter')) {
  const t = SKIN_ART[skin.id].tokens || {};
  check(`${skin.name} sets the paint for every machine`, ['--paint', '--paint-dark', '--paint-light'].every((n) => /^#[0-9a-f]{6}$/.test(t[n] || '')));
}
{
  const c = Object.fromEntries(CABINET_TOKENS.map((n) => [n, '#123456']));
  check('the starter machine skin (no paint) leaves every machine its own colours', painted({ ...c, '--paint': 'none' })['--cheese'] === '#123456');
  const p = painted({ ...c, '--paint': '#aaaaaa', '--paint-dark': '#bbbbbb', '--paint-light': '#cccccc' });
  const bodies = ['machine', 'stacker', 'bonanza', 'palace', 'maze', 'vault', 'cheese', 'box'];
  check('a painted skin swaps every machine body for its paint', bodies.every((b) => p[`--${b}`] === '#aaaaaa' && p[`--${b}-dark`] === '#bbbbbb'));
  check('…but keeps each machine\'s own details (grass, rind, tape, gold)', ['--bonanza-grass', '--cheese-rind', '--box-tape', '--palace-gold', '--maze-path'].every((n) => p[n] === '#123456'));
}
