// kit.test.js — the UI kit and its materials (1.6.0, "New Digs"; DESIGN §31 → Tests and checks).
// Runs with `npm test`, in Node (no page): the painters and the maths are pure, and the CSS
// is read as text.
//
// - Every colour frames.ts (and wheel.ts) reads is a "#rrggbb" token in style.css :root.
// - Every painted frame can stretch: the middle of each edge is the same all along, and the
//   middle is one colour (CSS border-image stretches those parts).
// - Frames are drawn at whole-number scales: every --fw is 4 px × a whole number.
// - The wide/phone breakpoint is the same everywhere (layout.ts and every copy in the CSS).
// - The rig's fit, and the two-tap rule's timing.
// - The stylesheet: every part file imported once, no class styled by two files (the old
//   .line-label clash), every frame tint on a framed element (the old Rebuild card bug).

import { test, expect, describe } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { FRAME_TOKENS, FRAME_SIZE, FRAME_SLICE, ENAMEL_TONES, paintFrames, paintTextures } from '../src/view/frames.ts';
import { WHEEL_TOKENS } from '../src/view/wheel.ts';
import { WIDE_QUERY, NARROW_QUERY, rigRoom, rigZoom } from '../src/view/layout.ts';
import { createArm, ordinal, pct, keyedList } from '../src/view/kit.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const styleCss = read('../src/view/style.css');
const rootBlock = styleCss.slice(styleCss.indexOf(':root {'), styleCss.indexOf('}', styleCss.indexOf(':root {')));
const stylesDir = new URL('../src/view/styles/', import.meta.url);
const partFiles = readdirSync(stylesDir).filter((f) => f.endsWith('.css')).sort();
const parts = Object.fromEntries(partFiles.map((f) => [f, readFileSync(new URL(f, stylesDir), 'utf8')]));
const allCss = { 'style.css': styleCss, ...parts };

// The value of a :root token ("#c9955c"), or undefined.
const tokenValue = (name) => {
  const m = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : undefined;
};

// A tiny CSS reader: every style rule as { selectors, body, file }, inside @media/@container too
// (keyframes, @import and comments are skipped). Enough for the game's own plain CSS.
function rulesOf(css, file) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '');
  const rules = [];
  let i = 0;
  function block() {
    while (i < text.length) {
      const open = text.indexOf('{', i);
      const close = text.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; return; }
      if (open === -1) { i = text.length; return; }
      const prelude = text.slice(i, open).trim();
      i = open + 1;
      if (/^@(media|container|supports)/.test(prelude)) block();
      else if (prelude.startsWith('@')) {
        // @keyframes and friends: skip to the matching brace
        let depth = 1;
        while (i < text.length && depth > 0) {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') depth--;
          i++;
        }
      } else {
        const end = text.indexOf('}', i);
        rules.push({ selectors: prelude.split(',').map((s) => s.trim()).filter(Boolean), body: text.slice(i, end), file });
        i = end + 1;
      }
    }
  }
  block();
  return rules;
}
const allRules = Object.entries(allCss).flatMap(([file, css]) => rulesOf(css, file));

// The :root colours frames.ts needs, as a colours object.
const frameColors = Object.fromEntries(FRAME_TOKENS.map((t) => [t, tokenValue(t)]));

describe('the materials (frames.ts)', () => {
  test.each(FRAME_TOKENS)('frame token %s is a #rrggbb colour in style.css :root', (name) => {
    expect(tokenValue(name)).toMatch(/^#[0-9a-f]{6}$/i);
  });
  test.each([...WHEEL_TOKENS])('wheel token %s is a colour in style.css :root', (name) => {
    expect(tokenValue(name), name).toMatch(/^#[0-9a-f]{6}$/i);
  });
  test('every enamel tone has its tokens', () => {
    for (const [face, lip] of Object.values(ENAMEL_TONES)) {
      expect(FRAME_TOKENS).toContain(face);
      expect(FRAME_TOKENS).toContain(lip);
    }
  });

  const frames = paintFrames(frameColors);
  test('the frames are all there', () => {
    for (const name of ['wood', 'woodPanel', 'woodBrass', 'brass', 'brassLit', 'brassDim', 'brassSlot', 'glass', 'chrome', 'paper', 'paperReady',
      'paperGold', 'paperHeirloom', 'paperSelected', 'paperLocked', 'indexTab', 'indexTabDim']) expect(frames[name], name).toBeTruthy();
    for (const tone of Object.keys(ENAMEL_TONES)) {
      expect(frames[`enamel-${tone}`]).toBeTruthy();
      expect(frames[`enamel-${tone}-down`]).toBeTruthy();
    }
  });
  test.each(Object.keys(frames))('frame %s stretches cleanly (9-slice)', (name) => {
    const f = frames[name];
    const N = FRAME_SIZE;
    const S = FRAME_SLICE;
    expect([f.w, f.h]).toEqual([N, N]);
    const at = (x, y) => f.data[y * N + x];
    const mid = [];
    for (let k = S; k < N - S; k++) mid.push(k);
    // The top and bottom edges (and the middle rows) are the same all along their middle part…
    for (let y = 0; y < N; y++) for (const x of mid) expect(at(x, y), `${name} row ${y}`).toBe(at(S, y));
    // …and so are the left and right edges, down theirs.
    for (let x = 0; x < N; x++) for (const y of mid) expect(at(x, y), `${name} column ${x}`).toBe(at(x, S));
    // The middle is one colour, and not see-through.
    expect(at(S, S) >>> 24).toBe(255);
  });
  test('the textures are 32×32 tiles that repeat', () => {
    const tx = paintTextures(frameColors);
    for (const name of ['wood', 'panel', 'paper']) expect([tx[name].w, tx[name].h], name).toEqual([32, 32]);
  });
});

describe('the stylesheet', () => {
  test('style.css imports every part file once, and only files that exist', () => {
    const imports = [...styleCss.matchAll(/@import "\.\/styles\/([^"]+)";/g)].map((m) => m[1]);
    expect([...imports].sort()).toEqual(partFiles);
    expect(new Set(imports).size).toBe(imports.length);
    // The imports come before the tokens (CSS needs @import first), and the frames (kit.css) before
    // the screens that tint them.
    expect(styleCss.indexOf('@import')).toBeLessThan(styleCss.indexOf(':root {'));
    expect(imports.indexOf('kit.css')).toBeLessThan(imports.indexOf('upgrades.css'));
    expect(imports.indexOf('base.css')).toBe(0);
  });
  test('the first :root block holds the tokens (the part files only override them)', () => {
    for (const [file, css] of Object.entries(parts)) {
      const own = rulesOf(css, file).filter((r) => r.selectors.includes(':root'));
      for (const r of own) expect(r.body.split(';').filter((d) => d.trim()).length, `${file} :root`).toBeLessThanOrEqual(2);
    }
  });
  test('frames are drawn at whole-number scales: every --fw is 4, 8, 12 or 16 px', () => {
    for (const [file, css] of Object.entries(allCss)) {
      for (const m of css.matchAll(/--fw:\s*([^;]+);/g)) expect([4, 8, 12, 16], `${file}: --fw ${m[1]}`).toContain(parseFloat(m[1]));
    }
  });
  test('no "border-image: none" shorthand (the build writes it as an empty value, which is dropped)', () => {
    // Found in 1.6.0's part 2: the phone's tab bar kept its frames in the built game only.
    // border-image-source: none does the same and survives the build.
    const bad = Object.entries(allCss).filter(([, css]) => /border-image\s*:\s*none\b/.test(css)).map(([file]) => file);
    expect(bad).toEqual([]);
  });
  test('the wide/phone breakpoint is the same in every CSS file as in layout.ts', () => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    let copies = 0;
    for (const [file, css] of Object.entries(allCss)) {
      for (const m of css.matchAll(/@media([^{]+)\{/g)) {
        const q = norm(m[1]);
        if (!/min-width:\s*(960|700)px/.test(q)) continue;
        copies++;
        expect([norm(WIDE_QUERY), norm(NARROW_QUERY)], `${file}: @media ${q}`).toContain(q);
      }
    }
    expect(copies).toBeGreaterThanOrEqual(2);
  });
  test('no class is styled on its own by two files (one component, one file)', () => {
    // (Not counted: kit.css's framed list, which gives every framed element its frame, and
    // layout.css's grid areas, which only say where the big parts go.)
    const where = new Map();
    for (const r of allRules) {
      if (/border-image-source:\s*var\(--frame\)/.test(r.body)) continue;
      if (r.file === 'layout.css' && /^\s*grid-area:[^;]+;?\s*$/.test(r.body)) continue;
      for (const sel of r.selectors) {
        if (!/^\.[\w-]+$/.test(sel)) continue;
        if (!where.has(sel)) where.set(sel, new Set());
        where.get(sel).add(r.file);
      }
    }
    const shared = [...where].filter(([, files]) => files.size > 1).map(([sel, files]) => `${sel}: ${[...files].join(', ')}`);
    expect(shared).toEqual([]);
  });
  test('a rule that tints a frame (--frame) is for a framed element', () => {
    // The framed classes: the big framed rule in kit.css (border-image from --frame).
    const framedRule = rulesOf(parts['kit.css'], 'kit.css').find((r) => /border-image-source:\s*var\(--frame\)/.test(r.body));
    const framed = new Set(framedRule.selectors.flatMap((s) => [...s.matchAll(/\.([\w-]+)/g)].map((m) => m[1])));
    // Classes that only ever sit on a framed element (a modifier next to .btn, .tile, .tag …).
    // The screens still to be rebuilt on the kit (parts 4–7) use these; new code uses .fr and k- pieces.
    const MODIFIERS = new Set(['btn-primary', 'btn-soft', 'btn-danger', 'btn-gold', 'btn-black', 'btn-token',
      'helper-btn', 'prize-tile', 'prize-btn', 'off', 'k-btn', 'k-buy', 'k-confirm', 'k-tile', 'k-sheet', 'k-card', 'deck-spin',
      'k-seg-opt', 'k-step-value', 'k-stat-tile', 'k-gauge', 'k-toggle-track', 'k-toggle-knob', 'k-lever', 'k-lever-knob']);
    const bad = [];
    for (const r of allRules) {
      if (!/(^|;|\s)--frame:/.test(r.body)) continue;
      if (/border-image/.test(r.body)) continue; // draws its own frame
      for (const sel of r.selectors) {
        const last = sel.split(/[\s>+~]+/).pop();
        const classes = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
        if (!classes.some((c) => framed.has(c) || MODIFIERS.has(c))) bad.push(`${r.file}: ${sel}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('layout.ts', () => {
  test('wide: the rig fits the wall; stacked: 44% of the screen', () => {
    expect(rigRoom({ wide: true, wallH: 700, padTop: 26, innerH: 900 })).toBe(674);
    expect(rigRoom({ wide: false, wallH: 300, padTop: 22, innerH: 844 })).toBeCloseTo(371.36);
    expect(rigRoom({ wide: false, wallH: 300, padTop: 22, innerH: 844, share: 0.4 })).toBeCloseTo(337.6);
    expect(rigRoom({ wide: true, wallH: 10, padTop: 26, innerH: 900 })).toBe(0);
  });
  test('stacked, the tray keeps at least 32% of a short screen (the rig gives way)', () => {
    // A tall phone: the tray has plenty, so the rig may have its 44%.
    expect(rigRoom({ wide: false, wallH: 281, padTop: 10, innerH: 844, trayH: 500 })).toBeCloseTo(371.36);
    // 360 x 640: the rig now (250) + the tray beyond its 32% (118 - 204.8) = 163.2.
    expect(rigRoom({ wide: false, wallH: 260, padTop: 10, innerH: 640, trayH: 118 })).toBeCloseTo(163.2);
    // The same page at the zoom that gives: the rig 163.2 tall, the tray 204.8, so the answer holds.
    expect(rigRoom({ wide: false, wallH: 173.2, padTop: 10, innerH: 640, trayH: 204.8 })).toBeCloseTo(163.2);
    // Never below nothing.
    expect(rigRoom({ wide: false, wallH: 20, padTop: 10, innerH: 640, trayH: 0 })).toBe(0);
  });
  test('the zoom fits both ways, never over 1, never under 0.3', () => {
    expect(rigZoom({ availW: 800, availH: 600, rigW: 400, rigH: 300 })).toBe(1);
    expect(rigZoom({ availW: 358, availH: 371, rigW: 700, rigH: 470 })).toBeCloseTo(358 / 700);
    expect(rigZoom({ availW: 900, availH: 235, rigW: 700, rigH: 470 })).toBe(0.5);
    expect(rigZoom({ availW: 50, availH: 50, rigW: 700, rigH: 470 })).toBe(0.3);
    expect(rigZoom({ availW: 500, availH: 500, rigW: 0, rigH: 0 })).toBe(1);
  });
});

describe('kit.ts helpers', () => {
  test('two taps: the first arms, a second within the time confirms, then it starts again', () => {
    const arm = createArm(4000);
    expect(arm.armed(0)).toBe(false);
    expect(arm.press(1000)).toBe('armed');
    expect(arm.armed(4999)).toBe(true);
    expect(arm.left(3000)).toBe(2000);
    expect(arm.press(4999)).toBe('confirmed');
    expect(arm.armed(5000)).toBe(false);
    // Too slow: the second tap only arms it again.
    expect(arm.press(10000)).toBe('armed');
    expect(arm.press(14000)).toBe('armed');
    arm.disarm();
    expect(arm.armed(14001)).toBe(false);
  });
  test('ordinal and pct', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
    expect(pct(0.237)).toBe('24%');
  });
  test('keyedList keeps pieces by key, in order, and drops the rest', () => {
    // A pretend container: just enough of the DOM for keyedList.
    const container = {
      children: [],
      insertBefore(el, ref) {
        const kids = this.children;
        const at = kids.indexOf(el);
        if (at >= 0) kids.splice(at, 1);
        const i = ref ? kids.indexOf(ref) : -1;
        if (i < 0) kids.push(el);
        else kids.splice(i, 0, el);
        el.parent = this;
      },
      get lastElementChild() { return this.children[this.children.length - 1]; },
    };
    const made = [];
    const make = (item) => {
      const el = { id: item, remove() { const k = this.parent.children; k.splice(k.indexOf(this), 1); } };
      made.push(item);
      return { el };
    };
    let cache = keyedList(container, ['a', 'b', 'c'], (x) => x, make);
    expect(container.children.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    cache = keyedList(container, ['c', 'a', 'd'], (x) => x, make, cache);
    expect(container.children.map((e) => e.id)).toEqual(['c', 'a', 'd']);
    expect(made).toEqual(['a', 'b', 'c', 'd']); // a and c were reused, only d is new
    expect([...cache.keys()]).toEqual(['c', 'a', 'd']);
  });
});

describe('the shell names real sprites', () => {
  // A misspelt sprite name only shows as a "?" tile in the browser, so check every name the page
  // and the shell write out literally: index.html's data-sprite pictures, the tab icons, the
  // wallet's currencies, and every spriteImg / iconHTML / icon: '…' in the shell's files.
  test('every sprite named in index.html, the shell and the kit exists in art.ts', async () => {
    const { SPRITES } = await import('../src/view/art.ts');
    const names = new Map(); // name → where
    const add = (name, where) => { if (!names.has(name)) names.set(name, where); };
    for (const m of read('../index.html').matchAll(/data-sprite="([\w.]+)"/g)) add(m[1], 'index.html');
    for (const file of ['ui.ts', 'hud.ts', 'deck.ts', 'kit.ts']) {
      const src = read(`../src/view/${file}`);
      for (const re of [/spriteImg\(\s*'([\w.]+)'/g, /iconHTML\(\s*'([\w.]+)'/g, /\bicon:\s*'([\w.]+)'/g, /\bsprite:\s*'([\w.]+)'/g]) {
        for (const m of src.matchAll(re)) add(m[1], file);
      }
      const tabs = src.match(/TAB_ICONS[^=]*=\s*\{([^}]+)\}/);
      if (tabs) for (const m of tabs[1].matchAll(/'([\w.]+)'/g)) add(m[1], `${file} TAB_ICONS`);
    }
    expect(names.size).toBeGreaterThan(20);
    const missing = [...names].filter(([name]) => !SPRITES[name]).map(([name, where]) => `${name} (${where})`);
    expect(missing).toEqual([]);
  });
});
