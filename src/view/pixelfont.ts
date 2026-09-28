// pixelfont.ts — VIEW layer. A chunky pixel font for the big titles (1.5.0, "The Glow Up").
//
// "BIG WIN!", "JACKPOT!", "8 FREE SPINS!" are drawn as real pixel art: each letter is
// a little bitmap below (# = ink), coloured with a metal ramp from its top to its bottom
// (a bright highlight, the base colour, a shade, a deep shade), with an outline in the
// ramp's edge colour, a dark ink outline round that, and a drop shadow. The browser's
// fonts are smoothed at every size, so they can't be pixel-perfect: this can.
// Each letter is its own canvas, so the celebration can bob the letters in a wave.
// Colours are theme tokens (the ramps come from style.css :root via ui.ts/celebrate.ts).

// The letters: 8 rows each, 2-pixel strokes. Narrow letters are narrower.
const GLYPHS: Record<string, string[]> = {
  A: ['.####.', '##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '##..##', '#####.'],
  C: ['.####.', '##..##', '##....', '##....', '##....', '##....', '##..##', '.####.'],
  D: ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
  E: ['######', '##....', '##....', '#####.', '##....', '##....', '##....', '######'],
  F: ['######', '##....', '##....', '#####.', '##....', '##....', '##....', '##....'],
  G: ['.####.', '##..##', '##....', '##....', '##.###', '##..##', '##..##', '.#####'],
  H: ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##', '##..##'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  J: ['..####', '....##', '....##', '....##', '....##', '##..##', '##..##', '.####.'],
  K: ['##..##', '##..##', '##.##.', '####..', '####..', '##.##.', '##..##', '##..##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '######'],
  M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##', '##...##'],
  N: ['##..##', '###.##', '######', '##.###', '##..##', '##..##', '##..##', '##..##'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  P: ['#####.', '##..##', '##..##', '##..##', '#####.', '##....', '##....', '##....'],
  Q: ['.####.', '##..##', '##..##', '##..##', '##..##', '##.###', '##..##', '.###.#'],
  R: ['#####.', '##..##', '##..##', '##..##', '#####.', '##.##.', '##..##', '##..##'],
  S: ['.####.', '##..##', '##....', '.####.', '....##', '....##', '##..##', '.####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  V: ['##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..'],
  W: ['##...##', '##...##', '##...##', '##.#.##', '##.#.##', '#######', '.##.##.', '.#...#.'],
  X: ['##..##', '##..##', '.####.', '..##..', '..##..', '.####.', '##..##', '##..##'],
  Y: ['##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..'],
  Z: ['######', '....##', '...##.', '..##..', '.##...', '##....', '##....', '######'],
  0: ['.####.', '##..##', '##.###', '######', '###.##', '##..##', '##..##', '.####.'],
  1: ['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  2: ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '##....', '######'],
  3: ['.####.', '##..##', '....##', '..###.', '....##', '....##', '##..##', '.####.'],
  4: ['...###', '..####', '.##.##', '##..##', '######', '....##', '....##', '....##'],
  5: ['######', '##....', '##....', '#####.', '....##', '....##', '##..##', '.####.'],
  6: ['.####.', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '.####.'],
  7: ['######', '....##', '....##', '...##.', '..##..', '..##..', '..##..', '..##..'],
  8: ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
  9: ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '.####.'],
  '!': ['##', '##', '##', '##', '##', '..', '##', '##'],
  '?': ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'],
  '&': ['.###...', '##.##..', '##.##..', '.###...', '####.##', '##.###.', '##..##.', '.###.##'],
  '+': ['......', '..##..', '..##..', '######', '######', '..##..', '..##..', '......'],
  '×': ['......', '##..##', '.####.', '..##..', '.####.', '##..##', '......', '......'],
  "'": ['##', '##', '.#', '..', '..', '..', '..', '..'],
  '.': ['..', '..', '..', '..', '..', '..', '##', '##'],
  ',': ['..', '..', '..', '..', '..', '##', '##', '.#'],
  '-': ['.....', '.....', '.....', '#####', '#####', '.....', '.....', '.....'],
  ':': ['..', '##', '##', '..', '..', '##', '##', '..'],
  '%': ['##...#', '##..##', '...##.', '..##..', '.##...', '##..##', '#...##', '......'],
  ' ': ['...', '...', '...', '...', '...', '...', '...', '...'],
};
const ROWS = 8;

// Can the font draw this text? (Anything it can't is left to the browser's font.)
export const canDraw = (text: string) => [...text.toUpperCase()].every((ch) => ch in GLYPHS);

// The colours of a title: a highlight (top rows), the base, a shade, a deep shade
// (bottom rows), the edge round the letter, the ink outline, and its shadow.
export interface TitleRamp { hilite: string; light: string; base: string; shade: string; deep: string; edge: string; ink: string }

// Which ramp colour each of the 8 rows gets (top to bottom): light from above.
const ROW_TONE: (keyof TitleRamp)[] = ['hilite', 'light', 'base', 'base', 'base', 'shade', 'shade', 'deep'];

function hex(c: string): [number, number, number] {
  const h = c.trim().replace('#', '');
  const full = h.length === 3 ? [...h].map((x) => x + x).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

// One letter as a canvas (1 canvas pixel = 1 font pixel; CSS scales it up). The letter
// sits 2 pixels in from the left and top (its outlines), with 2 rows under it (the shadow).
export function letterCanvas(ch: string, ramp: TitleRamp): HTMLCanvasElement {
  const g = GLYPHS[ch.toUpperCase()] || GLYPHS['?'];
  const w = g[0].length + 4;
  const h = ROWS + 5;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const put = (x: number, y: number, col: string, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const [r, gg, b] = hex(col);
    const i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = a;
  };
  const ink = (x: number, y: number) => g[y - 2] && g[y - 2][x - 2] === '#';
  const near = (x: number, y: number, d: number) => {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) <= d + (d > 1 ? 1 : 0) && ink(x + dx, y + dy)) return true;
    return false;
  };
  // The drop shadow (the ink outline's shape, two rows down, see-through).
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!near(x, y, 2) && near(x, y - 2, 2)) put(x, y, ramp.ink, 110);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink(x, y)) {
        const row = y - 2;
        // The letter's top-left edges catch the light; the rest follows the row's tone.
        const lit = !ink(x, y - 1) || !ink(x - 1, y);
        put(x, y, ramp[lit && row < 5 ? (row < 2 ? 'hilite' : 'light') : ROW_TONE[row]]);
      } else if (near(x, y, 1)) put(x, y, ramp.edge);
      else if (near(x, y, 2)) put(x, y, ramp.ink);
    }
  }
  ctx.putImageData(img, 0, 0);
  canvas.className = 'px-letter';
  return canvas;
}

// How wide a title is in font pixels (its letters, their outlines, less the shared ones).
export const titleWidth = (text: string) => [...text.toUpperCase()].reduce((w, ch) => w + (GLYPHS[ch] || GLYPHS['?'])[0].length + 3, 1);

// A whole word as one row of letter canvases, each `scale` screen pixels a font pixel.
// Letters overlap by their outlines so they sit snugly together.
export function titleLetters(text: string, ramp: TitleRamp, scale: number): HTMLElement[] {
  return [...text.toUpperCase()].map((ch, i) => {
    const span = document.createElement('span');
    span.className = 'px-char';
    span.style.setProperty('--i', String(i));
    const c = letterCanvas(ch, ramp);
    c.style.width = `${c.width * scale}px`;
    c.style.height = `${c.height * scale}px`;
    span.style.marginRight = `${-scale}px`; // the neighbours share their outermost outline
    span.appendChild(c);
    return span;
  });
}
