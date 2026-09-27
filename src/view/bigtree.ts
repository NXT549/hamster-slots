// bigtree.ts — VIEW layer. The family's huge tree in the Big Cage (M15).
//
// Retiring plants an Heirloom Seed, a huge tree shoots up, and the Family Tree's
// traits sit on its branches. Two parts:
//   1) treeLayout(): where the trunk, the branches, the leaves and every trait go,
//      for a scene of any size. Pure maths (no DOM), so tests/bigtree.test.js can
//      check that the traits never overlap, from a phone up to a big screen.
//   2) drawTree(): paints the scene as real pixel art on a small canvas (each canvas
//      pixel is `px` screen pixels, like a sprite drawn at 2× or 3×): the sky, the
//      hills, the ground, and the tree at any moment of its growing (grow values
//      from 0 to 1), with shading from the top-left and an outline around each part.
//
// The trunk carries the first branch in data.json ("Roots"): its first trait sits at
// the foot of the trunk (every other trait needs it), the others at the top of the
// crown. The other branches grow out of the trunk, half to the left, half to the right,
// from the bottom up. Colours are theme tokens (style.css :root, TREE_TOKENS below).

export interface Point { x: number; y: number }
// One branch of the Family Tree, from data.json: its id and its traits in order.
export interface BranchIn { id: string; nodes: string[] }
// A trait's spot: its centre in screen pixels, and how far along its branch it sits
// (0–1: the branch reaches it when it has grown that far).
export interface NodeSpot extends Point { id: string; branch: number; t: number }
export interface BranchGeom {
  id: string; side: -1 | 1; p0: Point; p1: Point; p2: Point; r0: number; r1: number; label: Point;
}
export interface Clump extends Point { r: number; branch: number } // branch -1 = the crown
export interface Layout {
  width: number; height: number; px: number; // the scene in screen pixels, and screen pixels per canvas pixel
  ground: number; // the ground line (screen pixels from the top)
  base: Point; top: Point; trunkR0: number; trunkR1: number;
  branches: BranchGeom[];
  clumps: Clump[];
  nodes: NodeSpot[];
  node: { w: number; h: number; up: number }; // a trait's box, for the overlap checks
}

// How much room a trait takes in a scene of this width (style.css .bt-node matches):
// w × h, starting `up` pixels above its centre. Below 820 px the traits are small
// icons (tap one to read its name); from 820 px they're bigger, with their name under them.
export const COMPACT_BELOW = 820;
export function nodeBox(width: number): { w: number; h: number; up: number } {
  if (width < 360) return { w: 38, h: 46, up: 23 }; // the smallest phones
  return width < COMPACT_BELOW ? { w: 44, h: 52, up: 26 } : { w: 96, h: 88, up: 36 };
}

// A point on a curved branch (a quadratic Bézier curve: from p0, pulled towards p1, to p2).
export function bezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

// Where a branch's traits sit along it (0 = the trunk, 1 = its tip).
function spotsAlong(n: number): number[] {
  if (n <= 1) return [0.8];
  if (n === 2) return [0.55, 0.95];
  return Array.from({ length: n }, (_, i) => 0.36 + (i * (0.95 - 0.36)) / (n - 1));
}

export function treeLayout(width: number, height: number, trunk: string[], branches: BranchIn[]): Layout {
  const px = width < 600 ? 2 : 3;
  const node = nodeBox(width);
  const cx = Math.round(width / 2);
  const ground = Math.round(height * 0.9);
  const base = { x: cx, y: ground };
  const top = { x: cx, y: Math.round(height * 0.14) };
  const trunkR0 = Math.max(12, Math.min(34, width * 0.035));
  const trunkR1 = trunkR0 * 0.45;
  // Branches: the first half on the left, the rest on the right, each side from the bottom up.
  const perSide = Math.ceil(branches.length / 2);
  const yLow = 0.68;
  const yHigh = 0.27;
  const reach = Math.min(width * 0.44, height * 0.62);
  const rise = height * 0.1;
  const geoms: BranchGeom[] = [];
  const nodes: NodeSpot[] = [];
  const clumpR = Math.max(18, Math.min(70, Math.min(width, height) * 0.075));
  const clumps: Clump[] = [];
  branches.forEach((b, i) => {
    const side: -1 | 1 = i < perSide ? -1 : 1;
    const row = i < perSide ? i : i - perSide;
    const y = height * (perSide > 1 ? yLow - (row * (yLow - yHigh)) / (perSide - 1) : (yLow + yHigh) / 2);
    const p0 = { x: cx, y };
    const p1 = { x: cx + side * reach * 0.45, y: y - rise * 0.15 };
    const p2 = { x: cx + side * reach, y: y - rise };
    const r0 = trunkR0 * 0.55;
    geoms.push({ id: b.id, side, p0, p1, p2, r0, r1: r0 * 0.45, label: bezier(p0, p1, p2, 0.2) });
    spotsAlong(b.nodes.length).forEach((t, k) => {
      const p = bezier(p0, p1, p2, t);
      nodes.push({ id: b.nodes[k], branch: i, t, x: Math.round(p.x), y: Math.round(p.y) });
    });
    // Leaves: a big clump at the tip, a smaller one along the top of the branch.
    clumps.push({ ...bezier(p0, p1, p2, 1), r: clumpR, branch: i });
    const mid = bezier(p0, p1, p2, 0.62);
    clumps.push({ x: mid.x, y: mid.y - clumpR * 0.45, r: clumpR * 0.62, branch: i });
  });
  // The crown around the top of the trunk.
  clumps.push({ x: top.x, y: top.y + clumpR * 0.2, r: clumpR * 1.35, branch: -1 });
  clumps.push({ x: top.x - clumpR * 1.2, y: top.y + clumpR * 0.75, r: clumpR, branch: -1 });
  clumps.push({ x: top.x + clumpR * 1.2, y: top.y + clumpR * 0.75, r: clumpR, branch: -1 });
  // The trunk's traits: the first at its foot, the rest side by side at the top.
  trunk.forEach((id, k) => {
    if (k === 0) nodes.push({ id, branch: -1, t: 0, x: cx, y: Math.round(ground - height * 0.1) });
    else {
      const others = trunk.length - 1;
      const x = cx + (k - 1 - (others - 1) / 2) * (node.w + 8);
      nodes.push({ id, branch: -1, t: 1, x: Math.round(x), y: top.y });
    }
  });
  return { width, height, px, ground, base, top, trunkR0, trunkR1, branches: geoms, clumps, nodes, node };
}

// ─────────────────────── painting ───────────────────────

// Every colour drawTree uses: theme tokens in style.css :root (tests/art.test.js checks them).
export const TREE_TOKENS = [
  '--sky-top', '--sky-bottom', '--sun', '--cloud', '--cloud-shade', '--hill-far', '--hill-near',
  '--grass', '--grass-dark', '--grass-light', '--soil', '--soil-dark',
  '--bark', '--bark-light', '--bark-dark', '--bark-ink', '--leaf', '--leaf-light', '--leaf-dark', '--leaf-ink',
  '--blossom',
] as const;
export type TreeColors = Record<(typeof TREE_TOKENS)[number], string>;

// How far each part has grown (0–1). Everything at 1 = the grown tree.
export interface Grow {
  trunk: number;
  branches: number[]; // one per branch
  clumps: number[]; // one per clump (a little over 1 while one pops out)
  mound: number; // the little mound of soil where the seed went in
  blossoms: number; // how many blossoms (one for every trait level the family has)
}
export function grownTree(layout: Layout, blossoms: number): Grow {
  return { trunk: 1, branches: layout.branches.map(() => 1), clumps: layout.clumps.map(() => 1), mound: 0, blossoms };
}

// "#rrggbb" → one pixel for a Uint32Array over ImageData (its bytes are R, G, B, A).
function pixel(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return ((255 << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}
// A small, fixed "random" number from a seed, so the clouds and leaves never jump about.
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Mask values: which ramp colour a pixel of wood or leaves gets.
const BASE = 1;
const LIGHT = 2;
const SHADE = 3;
const BLOSSOM = 4; // a flower's middle (sun yellow)
const PETAL = 5; // its petals (blossom pink)

// A filled, shaded disc (light towards the top-left, shade towards the bottom-right).
function stamp(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, bumpy = 0): void {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  const rr = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      // A leaf clump's edge wobbles a little (bumpy), so it looks leafy, not round.
      const edge = bumpy ? rr * (1 + bumpy * Math.sin(Math.atan2(dy, dx) * 7 + cx)) : rr;
      if (dx * dx + dy * dy > edge) continue;
      const d = (dx + dy) * 0.7071; // along the light (top-left → bottom-right)
      mask[y * w + x] = d < -r * 0.35 ? LIGHT : d > r * 0.4 ? SHADE : BASE;
    }
  }
}

// The sky, sun, clouds, hills and ground: painted once per size (they never grow).
function paintBackdrop(out: Uint32Array, w: number, h: number, groundY: number, c: TreeColors): void {
  const sky0 = pixel(c['--sky-top']);
  const sky1 = pixel(c['--sky-bottom']);
  // The sky in four bands, dithered (a checkerboard) where they meet: the pixel-art way to blend.
  const skyMix = [sky0, sky0, sky1, sky1];
  const bandH = groundY / 3;
  for (let y = 0; y < groundY; y++) {
    const i = Math.floor(y / bandH);
    const intoNext = bandH - (y - i * bandH) <= 2; // the last two rows of a band…
    for (let x = 0; x < w; x++) {
      const upper = intoNext && (x + y) % 2 === 0; // …are dithered into the next one
      out[y * w + x] = skyMix[Math.min(3, upper ? i + 1 : i)];
    }
  }
  // The sun, top right, with a ring of dither around it.
  const sun = pixel(c['--sun']);
  const sx = w * 0.82;
  const sy = groundY * 0.2;
  const sr = Math.max(6, w * 0.045);
  for (let y = Math.floor(sy - sr * 1.5); y < sy + sr * 1.5; y++) {
    for (let x = Math.floor(sx - sr * 1.5); x < sx + sr * 1.5; x++) {
      if (x < 0 || y < 0 || x >= w || y >= groundY) continue;
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d <= sr || (d <= sr * 1.35 && (x + y) % 2 === 0)) out[y * w + x] = sun;
    }
  }
  // Clouds: a few puffs each, flat-bottomed, a shade along the bottom.
  const cloud = pixel(c['--cloud']);
  const cloudShade = pixel(c['--cloud-shade']);
  for (let k = 0; k < 4; k++) {
    const cxp = w * (0.08 + 0.26 * k + hash(k) * 0.1);
    const cyp = groundY * (0.12 + hash(k + 9) * 0.25);
    const size = Math.max(4, w * (0.025 + hash(k + 3) * 0.02));
    const bottom = cyp + size * 0.6;
    for (let p = 0; p < 4; p++) {
      const px = cxp + (p - 1.5) * size * 0.9;
      const py = cyp - (p === 1 || p === 2 ? size * 0.5 : 0);
      const r = size * (p === 1 || p === 2 ? 1 : 0.75);
      for (let y = Math.floor(py - r); y <= bottom; y++) {
        for (let x = Math.floor(px - r); x <= px + r; x++) {
          if (x < 0 || y < 0 || x >= w || y >= groundY) continue;
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > r) continue;
          out[y * w + x] = y > bottom - 2 ? cloudShade : cloud;
        }
      }
    }
  }
  // Two rows of rolling hills behind the ground.
  const hills: [string, number, number, number][] = [['--hill-far', 0.16, 0.05, 1.3], ['--hill-near', 0.08, 0.035, 2.1]];
  for (const [token, height, wave, freq] of hills) {
    const col = pixel(c[token as keyof TreeColors]);
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const top = groundY - groundY * (height + wave * Math.sin(t * Math.PI * freq * 2 + freq));
      for (let y = Math.max(0, Math.floor(top)); y < groundY; y++) out[y * w + x] = col;
    }
  }
  // The ground: a grass edge with tufts, then soil with pebbles.
  const grass = pixel(c['--grass']);
  const grassDark = pixel(c['--grass-dark']);
  const grassLight = pixel(c['--grass-light']);
  const soil = pixel(c['--soil']);
  const soilDark = pixel(c['--soil-dark']);
  const grassH = Math.max(3, Math.round((h - groundY) * 0.3));
  for (let y = groundY; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = y - groundY;
      let col = d < grassH ? (d === 0 ? grassLight : d === grassH - 1 ? grassDark : grass) : soil;
      if (d >= grassH && hash(x * 31 + y * 17) > 0.965) col = soilDark; // pebbles
      if (d === grassH && x % 3 === 0) col = grassDark; // the grass's ragged bottom edge
      out[y * w + x] = col;
    }
  }
  // Grass tufts poking up above the edge, and little flowers in it.
  const petal = pixel(c['--blossom']);
  const middle = pixel(c['--sun']);
  for (let x = 1; x < w - 1; x += 2) {
    if (hash(x * 7) < 0.55) continue;
    const tall = hash(x * 13) > 0.6 ? 2 : 1;
    for (let k = 1; k <= tall; k++) if (groundY - k >= 0) out[(groundY - k) * w + x] = k === tall ? grassLight : grass;
  }
  for (let x = 3; x < w - 3; x += 5) {
    if (hash(x * 3.3) < 0.72 || Math.abs(x - w / 2) < w * 0.08) continue; // none right at the tree's foot
    const y = groundY - 3;
    if (y < 1) continue;
    out[(y + 1) * w + x] = grassDark; // the stem
    out[(y + 2) * w + x] = grassDark;
    out[y * w + x] = middle;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) out[(y + dy) * w + x + dx] = petal;
  }
}

// Paint the whole scene into ctx (a canvas `layout.width / px` pixels wide).
// The backdrop is cached per size (paint it once, copy it each frame).
let cache: { key: string; data: Uint32Array } | null = null;
export function drawTree(ctx: CanvasRenderingContext2D, layout: Layout, grow: Grow, colors: TreeColors): void {
  const { px } = layout;
  const w = Math.max(1, Math.floor(layout.width / px));
  const h = Math.max(1, Math.floor(layout.height / px));
  const groundY = Math.floor(layout.ground / px);
  const key = `${w}x${h}|${groundY}|${TREE_TOKENS.map((t) => colors[t]).join()}`;
  if (!cache || cache.key !== key) {
    const data = new Uint32Array(w * h);
    paintBackdrop(data, w, h, groundY, colors);
    cache = { key, data };
  }
  const image = ctx.createImageData(w, h);
  const out = new Uint32Array(image.data.buffer);
  out.set(cache.data);
  const wood = new Uint8Array(w * h);
  const leaves = new Uint8Array(w * h);
  const s = (v: number) => v / px; // screen pixels → canvas pixels

  // The trunk: stacked discs from the foot up, tapering, with a flared foot and roots.
  const foot = { x: s(layout.base.x), y: s(layout.base.y) + 1 };
  const full = s(layout.base.y - layout.top.y);
  const tall = full * grow.trunk;
  const girth = 0.35 + 0.65 * Math.min(1, grow.trunk * 1.25); // a sprout is thin
  if (grow.trunk > 0) {
    for (let d = 0; d <= tall; d += 0.5) {
      const f = d / full;
      const flare = f < 0.06 ? 1 + ((0.06 - f) / 0.06) * 0.45 : 1; // a gently flared foot
      const r = (s(layout.trunkR0) + (s(layout.trunkR1) - s(layout.trunkR0)) * f) * girth * flare;
      stamp(wood, w, h, foot.x + Math.sin(f * 5) * s(layout.trunkR0) * 0.12, foot.y - d, r);
    }
    // Roots reaching out along the ground on both sides.
    if (grow.trunk > 0.3) {
      for (const side of [-1, 1]) {
        for (let k = 0; k <= 1; k += 0.04) {
          const r = s(layout.trunkR0) * 0.3 * (1 - k) * girth;
          stamp(wood, w, h, foot.x + side * s(layout.trunkR0) * (0.8 + k * 1.6), foot.y - 1 + k * 3, Math.max(0.6, r));
        }
      }
    }
    // Bark: little grooves running up the trunk (the shade colour), never at the edges.
    for (let y = Math.max(0, Math.floor(foot.y - tall)); y < Math.min(h, foot.y); y++) {
      for (let x = Math.floor(foot.x - s(layout.trunkR0) * 1.8); x < foot.x + s(layout.trunkR0) * 1.8; x++) {
        if (x < 1 || x >= w - 1) continue;
        const i = y * w + x;
        if (wood[i] === BASE && wood[i - 1] && wood[i + 1] && (x * 5 + Math.floor(y / 4) * 3) % 9 === 0) wood[i] = SHADE;
      }
    }
  }
  // The branches, each grown as far as grow.branches says.
  layout.branches.forEach((b, i) => {
    const g = grow.branches[i] || 0;
    if (g <= 0) return;
    const p0 = { x: s(b.p0.x), y: s(b.p0.y) };
    const p1 = { x: s(b.p1.x), y: s(b.p1.y) };
    const p2 = { x: s(b.p2.x), y: s(b.p2.y) };
    const steps = Math.ceil(Math.hypot(p2.x - p0.x, p2.y - p0.y) * 2);
    for (let k = 0; k <= steps * g; k++) {
      const t = k / steps;
      const p = bezier(p0, p1, p2, t);
      stamp(wood, w, h, p.x, p.y, (s(b.r0) + (s(b.r1) - s(b.r0)) * t) * (0.5 + 0.5 * g));
    }
  });
  // The trunk goes into the ground: no wood below the grass (except the roots lying on it).
  for (let y = Math.max(0, groundY + 2); y < h; y++) wood.fill(0, y * w, (y + 1) * w);
  // The mound of soil where the seed went in (before the tree grows over it).
  if (grow.mound > 0) {
    const mr = s(layout.trunkR0) * 1.3 * grow.mound;
    for (let y = Math.floor(foot.y - mr * 0.6); y <= foot.y; y++) {
      for (let x = Math.floor(foot.x - mr); x <= foot.x + mr; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const dx = (x + 0.5 - foot.x) / mr;
        const dy = (y + 0.5 - foot.y) / (mr * 0.6);
        if (dx * dx + dy * dy <= 1 && !wood[y * w + x]) out[y * w + x] = pixel(dy < -0.55 ? colors['--soil'] : colors['--soil-dark']);
      }
    }
  }
  // Leaves: clumps of foliage, each popping out with its own grow value.
  layout.clumps.forEach((c, i) => {
    const g = grow.clumps[i] || 0;
    if (g <= 0) return;
    const r = s(c.r) * g;
    const x = s(c.x);
    const y = s(c.y);
    stamp(leaves, w, h, x, y, r, 0.12);
    // A few smaller puffs around the edge make it a bush, not a ball.
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + hash(i * 5 + k) * 0.8;
      stamp(leaves, w, h, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.6, r * (0.42 + hash(i + k * 3) * 0.12), 0.1);
    }
  });
  // Leaf texture: a sprinkle of light and dark leaves (a fixed pattern, so it never flickers).
  for (let i = 0; i < leaves.length; i++) {
    if (!leaves[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const n = (x * 7 + y * 13) % 17;
    if (leaves[i] === BASE && n === 0) leaves[i] = LIGHT;
    else if (leaves[i] === BASE && n === 5) leaves[i] = SHADE;
  }
  // Blossoms: one for every trait level the family has planted (the tree blooms as you plant).
  if (grow.blossoms > 0 && layout.clumps.length) {
    let placed = 0;
    for (let k = 0; placed < grow.blossoms && k < grow.blossoms * 6; k++) {
      const c = layout.clumps[k % layout.clumps.length];
      if ((grow.clumps[k % layout.clumps.length] || 0) < 1) continue;
      const a = hash(k * 3.1) * Math.PI * 2;
      const d = s(c.r) * (0.25 + hash(k * 1.7) * 0.6);
      const bx = Math.round(s(c.x) + Math.cos(a) * d);
      const by = Math.round(s(c.y) + Math.sin(a) * d * 0.8);
      if (bx < 1 || by < 1 || bx >= w - 1 || by >= h - 1 || !leaves[by * w + bx]) continue;
      leaves[by * w + bx] = BLOSSOM; // a little flower: a yellow middle and four pink petals
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (leaves[(by + dy) * w + bx + dx]) leaves[(by + dy) * w + bx + dx] = PETAL;
      placed++;
    }
  }

  // Put it together: leaves over wood, each with its own outline, over the backdrop.
  const woodCol = [0, pixel(colors['--bark']), pixel(colors['--bark-light']), pixel(colors['--bark-dark'])];
  const leafCol = [0, pixel(colors['--leaf']), pixel(colors['--leaf-light']), pixel(colors['--leaf-dark']), pixel(colors['--sun']), pixel(colors['--blossom'])];
  const woodInk = pixel(colors['--bark-ink']);
  const leafInk = pixel(colors['--leaf-ink']);
  const near = (m: Uint8Array, x: number, y: number) =>
    (x > 0 && m[y * w + x - 1]) || (x < w - 1 && m[y * w + x + 1]) || (y > 0 && m[(y - 1) * w + x]) || (y < h - 1 && m[(y + 1) * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (leaves[i]) out[i] = leafCol[leaves[i]];
      else if (near(leaves, x, y)) out[i] = leafInk;
      else if (wood[i]) out[i] = woodCol[wood[i]];
      else if (near(wood, x, y)) out[i] = woodInk;
    }
  }
  ctx.putImageData(image, 0, 0);
}
