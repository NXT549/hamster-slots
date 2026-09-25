// test_art.mjs — checks the text sprites in js/art.js are well-formed.
// Run from the hamster_slots folder:   node tools/test_art.mjs
//
// A typo in a sprite (a row one pixel too short, or a letter with no colour)
// is easy to make by hand and hard to spot on screen. This catches it.

import { readFileSync } from 'node:fs';
import { SPRITES, PALETTE, SYMBOL_SPRITES, CAPSULE_SPRITES, MACHINE_SPRITES, upgradeIcon, treeIcon } from '../js/art.js';
import { SKIN_ART, SKIN_TOKENS } from '../js/skins.js';
import { FRAME_SPRITES, THEME_TOKENS } from '../js/theme.js';

const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));

let failed = 0;
function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${!condition && detail ? `   -> ${detail}` : ''}`);
  if (!condition) failed++;
}

for (const [name, rows] of Object.entries(SPRITES)) {
  const width = rows[0].length;
  const badRows = rows.map((r, i) => [i, r.length]).filter(([, len]) => len !== width);
  check(`${name}: every row is ${width} px wide`, badRows.length === 0, `rows with wrong width: ${JSON.stringify(badRows)}`);
  const unknown = [...new Set(rows.join('').split(''))].filter((ch) => ch !== '.' && !(ch in PALETTE));
  check(`${name}: every pixel letter has a palette colour`, unknown.length === 0, `unknown: ${unknown.join(' ')}`);
}

// Style guide (see the top of js/art.js): square sprites of 24, 16 or 12 pixels.
for (const [name, rows] of Object.entries(SPRITES)) {
  check(`${name}: is a square 24, 16 or 12 px sprite`, rows.length === rows[0].length && [24, 16, 12].includes(rows.length),
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
check('the Hamster Token and Capsule Machine have sprites', 'token' in SPRITES && 'gacha' in SPRITES);
for (const r of data.capsules.rarities) {
  check(`capsule rarity "${r.id}" has a capsule sprite`, CAPSULE_SPRITES[r.id] in SPRITES);
}

// Skins: data.json lists them, js/skins.js says what they look like.
for (const skin of data.skins) {
  const art = SKIN_ART[skin.id];
  check(`skin "${skin.id}" has art in js/skins.js`, !!art);
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
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
for (const name of SKIN_TOKENS) {
  check(`skin token ${name} is a theme token in style.css :root`, rootBlock.includes(`${name}:`));
}
check('no art for skins that are not in data.json', Object.keys(SKIN_ART).every((id) => data.skins.some((s) => s.id === id)));

// theme.js paints the pixel frames in token colours and mixes them, which needs "#rrggbb".
for (const name of THEME_TOKENS) {
  const match = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`));
  check(`theme token ${name} is a #rrggbb colour in style.css :root`, !!match && /^#[0-9a-f]{6}$/i.test(match[1].trim()), match && match[1]);
}

console.log(failed ? `\n${failed} failed` : '\nall sprites OK');
process.exit(failed ? 1 : 0);
