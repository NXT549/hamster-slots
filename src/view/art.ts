// art.ts — VIEW layer. All pixel-art sprites, drawn as text.
//
// Each sprite is a list of strings. Each character is one pixel, and its colour
// comes from PALETTE ("." = transparent). At startup each sprite is painted once
// onto a tiny canvas and turned into an image URL. CSS scales it up with crisp,
// unblurred pixels (image-rendering: pixelated).
//
// Why text? Anyone can edit a sprite in a text editor, and a SKIN can be as small
// as a different set of colours for some letters (see src/view/skins.ts).
// See every sprite big: tools/sprites.html (with the game's server running).
//
// Style guide (keep new sprites consistent):
//   · The hamster and the reel symbols are 32×32 (1.5.0, "The Glow Up": more room for
//     detail); other main sprites (machines, cage props) are 24×24; icons are 16×16;
//     currency icons are 12×12. They're drawn at whole-number scales only.
//   · The bigger sprites have five-step ramps: a highlight, light, base, shade and a
//     deep shade next to the outline (the new colours are on punctuation marks, below).
//   · Every material has a small colour ramp: base, shade (bottom-right), light
//     (top-left) and its OWN darker outline. No single black outline everywhere:
//     that's what made the old sprites look heavy.
//   · Light comes from the top-left.
//   · UI frames (frameCard, framePaper, frameButton …) are 12×12 "9-slice" pictures:
//     4 px corners, and the middle 4 px of every edge are the same all along, so
//     CSS (border-image) can stretch them to any size. src/view/theme.ts turns them into
//     CSS variables. Tiles (bedding) repeat seamlessly: their edges wrap around.
//
// Rule: art never goes in data.json (that file is balance only).

// Palette letter → colour, e.g. { t: '#d9895a' }. Fur skins and repainted frames
// pass a few of these to swap colours for one drawing.
export type Colors = Record<string, string>;

export const PALETTE: Colors = {
  // ink + neutrals
  k: '#4a3428', // ink: eyes and tiny details
  w: '#fffdf8', // white
  q: '#e6dfd5', // light grey (white shade)
  Q: '#b9ad9f', // mid grey
  K: '#8a7b6d', // grey outline (for white/grey things)
  // sunflower seed
  d: '#6a6158', // seed body
  s: '#4e4640', // seed shade
  l: '#d6cfc3', // seed stripe
  L: '#f2ede4', // seed stripe light
  D: '#352e29', // seed outline
  // gold (Golden Seed, coins, stars)
  y: '#ffd35c', // gold
  Y: '#e8a93a', // gold shade
  h: '#fff3b8', // gold light / sparkle
  V: '#a36e1c', // gold outline
  // carrot + leaves
  o: '#f79a3e', // carrot
  O: '#d9722a', // carrot shade
  j: '#ffc27d', // carrot light
  J: '#9c4a1d', // carrot outline
  G: '#6cc26a', // leaf
  g: '#3f8f45', // leaf shade
  i: '#a8e290', // leaf light
  H: '#2c6634', // leaf outline
  // hamster (fur skins recolour t/T/c/p; skins.ts works out a/A/C from them)
  t: '#f2b37b', // fur
  T: '#d98f55', // fur shade
  '%': '#b9713f', // fur deep shade (1.5.0: the 32×32 hamster; skins.ts works it out for fur skins)
  a: '#fad3a8', // fur light
  A: '#9d5f37', // fur outline
  c: '#fde8d0', // cream (belly, cheeks)
  C: '#efcfae', // cream shade
  p: '#f59aa5', // pink (ears, nose, feet, Hamster Token)
  P: '#d9707f', // pink shade
  Z: '#a8475a', // pink outline
  // red (oil can, heart, capsule machine)
  r: '#ef6f6c', // red
  R: '#c24f4d', // red shade
  e: '#ff9f98', // red light
  X: '#86302f', // red outline
  // mint (Old Clunky)
  m: '#7fcbb8', // mint
  M: '#58a894', // mint shade
  f: '#b7e8d9', // mint light
  E: '#33735f', // mint outline
  // blue (deliveries)
  b: '#93cfe8', // blue
  B: '#5ea6c8', // blue shade
  v: '#cbecf8', // blue light
  W: '#33739a', // blue outline
  // tan (Heirloom Seeds, cardboard, wood shavings)
  n: '#e3b27a', // tan
  N: '#b9844c', // tan shade
  x: '#f5d6a8', // tan light
  U: '#74502e', // tan outline
  // blueberry
  u: '#6f86e0', // blueberry
  I: '#4d5fb8', // blueberry shade
  z: '#aebdf5', // blueberry light
  S: '#2f3a7e', // blueberry outline
  F: '#ffc6cd', // pink light (the Snack Stacker, the food bowl)
  // purple velvet (the Pouch Palace). The letters ran out, so it uses digits.
  8: '#a77bd6', // purple
  9: '#7c55b3', // purple shade
  '+': '#d4bdf3', // purple light
  0: '#4b2c78', // purple outline
  // UI chrome for the 9-slice frames: paper …
  1: '#fffaf1', // paper
  2: '#f1e2c9', // paper shade
  3: '#cfae86', // paper outline
  // … and a button. theme.ts repaints 4–7 with each button's own colours.
  4: '#82d1b1', // button
  5: '#53aa88', // button shade (the "lip" under it)
  6: '#b7ead4', // button light
  7: '#2f6f57', // button outline
  // 1.5.0: a deep shade (between the shade and the outline) for the 32×32 sprites' ramps,
  // and a light for the seed's dark body. The letters had run out, so these use punctuation.
  '!': '#c98a26', // gold deep shade
  '(': '#8b8177', // seed light
  ')': '#b85a22', // carrot deep shade
  '#': '#a33c3b', // red deep shade
  '&': '#3d4c9c', // blueberry deep shade
  '*': '#97683c', // tan deep shade
};

// Returns a copy of a sprite with some letters swapped, e.g. { d: 'Y' }.
function recolor(rows: string[], map: Colors): string[] {
  return rows.map((row) => [...row].map((ch) => map[ch] || ch).join(''));
}

// ───────────────────────── Sprites ─────────────────────────

// ── Reel symbols (32×32 since 1.5.0: five-step ramps, drawn at 2× on the reels) ──
const seed = [
  '................................',
  '.............DDDDD..............',
  '............D(((dsD.............',
  '............DLL(ddD.............',
  '...........D(L((ldsD............',
  '..........Dd(L((lddsD...........',
  '..........D((L((lddsD...........',
  '.........Dd((L(((lddsD..........',
  '.........D(((L(((lddsD..........',
  '.........D(((L(((lddssD.........',
  '........Dd(((L(((lddssD.........',
  '........D(((L(((dldddssD........',
  '........D(((L(((dldddssD........',
  '........D(((L(((dldddssD........',
  '.......Dd(((L(((ddlddssD........',
  '.......Dd(((L((dddQddsssD.......',
  '.......Dd(((L((dddQddsssD.......',
  '.......Dd(((l(ddddQddsssD.......',
  '.......Dd(((ldddddQddsssD.......',
  '........Dd((ldddddQdssssD.......',
  '........DddddlddddQdssssD.......',
  '........DddddlddddQdsssD........',
  '........DddddlddddQssssD........',
  '.........DdddlddddQssssD........',
  '.........DdddlddddQsssD.........',
  '..........DdddlddQssssD.........',
  '...........DddlddQsssD..........',
  '............DddlsQssD...........',
  '.............DdlsQsD............',
  '..............DDDDD.............',
  '................................',
  '................................',
];

const golden = [
  '................................',
  '.............VVVVV..............',
  '............VhhhyYV.............',
  '............VwwhyyV.......y.....',
  '...........VhwhhhyYV......h.....',
  '..........VyhwhhhyyYV...yhwhy...',
  '..........VhhwhhhyyYV.....h.....',
  '.........VyhhwhhhhyyYV....y.....',
  '.........VhhhwhhhhyyYV..........',
  '.........VhhhwhhhhyyY!V.........',
  '........VyhhhwhhhhyyYYV.........',
  '........VhhhwhhhyhyyyY!V........',
  '........VhhhwhhhyhyyyYYV........',
  '........VhhhwhhhyhyyyYYV........',
  '.......VyhhhwhhhyyhyyYYV........',
  '.......VyhhhwhhyyyYyyYY!V.......',
  '.......VyhhhwhhyyyYyyYY!V.......',
  '.......VyhhhwhyyyyYyyYY!V.......',
  '.......VyhhhwyyyyyYyyYY!V.......',
  '........VyhhhyyyyyYyYYY!V.......',
  '........VyyyyhyyyyYyYYY!V.......',
  '.....h..VyyyyhyyyyYyYYYV........',
  '....hwh.VyyyyhyyyyYYYY!V........',
  '.....h...VyyyhyyyyYYYY!V........',
  '.........VyyyhyyyyYYY!V....h....',
  '..........VyyyhyyYYYY!V...hwh...',
  '...........VyyhyyYYY!V.....h....',
  '............VyyhYYY!V...........',
  '.............VyhYY!V............',
  '..............VVVVV.............',
  '................................',
  '................................',
];

const carrot = [
  '................HH..............',
  '.......HHH.....HiGH....HH.......',
  '......HiGGH...HiggH...HiiH......',
  '.......HgggH..HGggH..HiGgH......',
  '.......HggggHHigggH.HiGggH......',
  '........HggggHGgggHHiGggH.......',
  '.........HggggGgggiiGggH........',
  '..........HgggGgggGGggH.........',
  '..........JGggggggGgggH.........',
  '.........JjjjjjjjjjjjoJJ........',
  '........JjjjjjjjjjjjoooOJ.......',
  '.......JoooooooooooOOOO)J.......',
  '........JooooooooooOOOO)J.......',
  '........JoojjjjjoooOOO)J........',
  '........JooOOOOOooOOOO)J........',
  '........JoooooooooOOO)J.........',
  '.........JooooooojOOO)J.........',
  '.........JoooooooOOOOJ..........',
  '.........JoooooooOOO)J..........',
  '.........JojjjoooOOOJ...........',
  '..........JOOOoooOO)J...........',
  '..........JoooooOOOJ............',
  '..........JoooojOO)J............',
  '..........JooooOOOJ.............',
  '...........JooooO)J.............',
  '...........JjjjOOJ..............',
  '...........JOOOO)J..............',
  '............JooOJ...............',
  '............Joo)J...............',
  '............JoOJ................',
  '.............JJ.................',
  '................................',
];

// ── The hamster (32×32, 1.5.0): standing, a four-step run, a blink, asleep and cheering ──
// Every frame has the same head (the hats sit on it), a step up or down for the run's
// bounce (HAMSTER_BOB). Fur skins recolour t T a A % c C (and p P Z for pink ones).
// Standing (and breathing, in CSS): the frame used wherever the hamster just is.
const hamster = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '............AAttTttpP%attttTA...',
  '.........AAAtttttaT%%atttttTTA..',
  '........AaaaaaataaaaaattwktTTA..',
  '......AAaaaaaaaTaaaattttkktTTA..',
  '.....AtaaaaaaaTtttttttttkDTTT%A.',
  '.....AaaaaaaaaTtttttttttccTT%pA.',
  '....AtaaaaaaaaTTttttttcccccc%P..',
  '...AttaaaaaatttTtttttcccccccCAqQ',
  '..AattaaaatttttTTTttccccccpcCA..',
  '..AtttttttttttttTTTTcccccccCCAQ.',
  '...AtttttttttttttttTTccccCCCCA..',
  '....AtttttttttttttTTT%CCCCCCA...',
  '....AttttttttccccccccT%%%AAA....',
  '....ATttttcccccccccccccCA.......',
  '.....ATTtccccccccccccccCA.......',
  '......ZTTcccccccccccccCZZ.......',
  '.....ZPPTppcccccccccCCZppZ......',
  '....ZPPPpppPcccccCCCPPpppPZ.....',
  '.....ZPPZPPZAAAAAAAZPZZPPZ......',
  '......ZZ.ZZ.........ZZ.ZZ.......',
  '................................',
];
// The run: four steps, the paws passing under the body, the body bouncing.
const hamsterRun1 = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '.............AttTttpP%attttTA...',
  '.........AAAAATTtaT%%atttttTTA..',
  '.......AAaaaaattaaaaaattwktTTA..',
  '.....AAaaaaaaaaTaaaattttkktTTA..',
  '....AtaaaaaaaaTtttttttttkDTTT%A.',
  '...AtaaaaaaaaaTtttttttttccTT%pA.',
  '...AaaaaaaaaatTTttttttcccccc%P..',
  '..AtaaaaaaaatttTtttttcccccccCAqQ',
  '.AattaaaaatttttTTTttccccccpcCA..',
  '.AttttttttttttttTTTTcccccccCCAQ.',
  '..AttttttttttttttttTTccccCCCCA..',
  '..AtttttttttttttttTTT%CCCCCCA...',
  '..AttttttttttccccccccT%%%AAA....',
  '...AttttttcccccccccccccC%A......',
  '....ATTTTccccccccccccccCA.ZZ....',
  '....ZPTTTcccccccccccccCZ.ZppZ...',
  '...ZPPPPTccppcccccccCZPPZpppPZ..',
  '....ZPPZAZpppPcccCCAZPPPPZPPZ...',
  '.....ZZ...ZPPZAAAAA..ZPZZ.ZZ....',
  '...........ZZ.........ZZ........',
  '................................',
];
const hamsterRun2 = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '............AAttTttpP%attttTA...',
  '.........AAAtttttaT%%atttttTTA..',
  '........AaaaaaataaaaaattwktTTA..',
  '......AAaaaaaaaTaaaattttkktTTA..',
  '.....AtaaaaaaaTtttttttttkDTTT%A.',
  '.....AaaaaaaaaTtttttttttccTT%pA.',
  '....AtaaaaaaaaTTttttttcccccc%P..',
  '...AttaaaaaatttTtttttcccccccCAqQ',
  '..AattaaaatttttTTTttccccccpcCA..',
  '..AtttttttttttttTTTTcccccccCCAQ.',
  '...AtttttttttttttttTTccccCCCCA..',
  '....AtttttttttttttTTT%CCCCCCA...',
  '....AttttttttccccccccT%%%AAA....',
  '....ATttttcccccccccccccCA.......',
  '.....ATTtccccccccccccccCAZZ.....',
  '......ATTcccccccccccccCAZPPZ....',
  '.......ZppccccccccccCCAZPPPPZ...',
  '......ZpppPccccccCCCAAZppPZZ....',
  '.......ZPPPPZAAAAAAA.ZpppPZ.....',
  '........ZPPZ..........ZPPZ......',
  '.........ZZ............ZZ.......',
  '................................',
];
const hamsterRun3 = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '.............AttTttpP%attttTA...',
  '.........AAAAATTtaT%%atttttTTA..',
  '.......AAaaaaattaaaaaattwktTTA..',
  '.....AAaaaaaaaaTaaaattttkktTTA..',
  '....AtaaaaaaaaTtttttttttkDTTT%A.',
  '...AtaaaaaaaaaTtttttttttccTT%pA.',
  '...AaaaaaaaaatTTttttttcccccc%P..',
  '..AtaaaaaaaatttTtttttcccccccCAqQ',
  '.AattaaaaatttttTTTttccccccpcCA..',
  '.AttttttttttttttTTTTcccccccCCAQ.',
  '..AttttttttttttttttTTccccCCCCA..',
  '..AtttttttttttttttTTT%CCCCCCA...',
  '..AttttttttttccccccccT%%%AAA....',
  '...AttttttcccccccccccccC%A......',
  '....ATTTTccccccccccccccCAZZ.....',
  '....ZppTTcccccccccccccCAZPPZ....',
  '...ZpppPTcccccccccccppZZPPPPZ...',
  '....ZPPZAAcccccccCCpppPZZPZZ....',
  '.....ZZ...ZPPZAAAAAZPPZ..ZZ.....',
  '...........ZZ.......ZZ..........',
  '................................',
];
const hamsterRun4 = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '............AAttTttpP%attttTA...',
  '.........AAAtttttaT%%atttttTTA..',
  '........AaaaaaataaaaaattwktTTA..',
  '......AAaaaaaaaTaaaattttkktTTA..',
  '.....AtaaaaaaaTtttttttttkDTTT%A.',
  '.....AaaaaaaaaTtttttttttccTT%pA.',
  '....AtaaaaaaaaTTttttttcccccc%P..',
  '...AttaaaaaatttTtttttcccccccCAqQ',
  '..AattaaaatttttTTTttccccccpcCA..',
  '..AtttttttttttttTTTTcccccccCCAQ.',
  '...AtttttttttttttttTTccccCCCCA..',
  '....AtttttttttttttTTT%CCCCCCA...',
  '....AttttttttccccccccT%%%AAA....',
  '....ATttttcccccccccccccCA.......',
  '.....ATTtccccccccccccccCZZ......',
  '......ZTTcccccccccccccCZppZ.....',
  '.....ZPPTcccccccccccCCZpppPZ....',
  '....ZPPPPppccccccCCCZPPZPPZ.....',
  '.....ZPPpppPZAAAAAAZPPPPZZ......',
  '......ZZZPPZ........ZPZZ........',
  '.........ZZ..........ZZ.........',
  '................................',
];
// A blink (now and then while it rests).
const hamsterBlink = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '............AAttTttpP%attttTA...',
  '.........AAAtttttaT%%atttttTTA..',
  '........AaaaaaataaaaaatttttTTA..',
  '......AAaaaaaaaTaaaattttttkTTA..',
  '.....AtaaaaaaaTttttttttkkkTTT%A.',
  '.....AaaaaaaaaTtttttttttccTT%pA.',
  '....AtaaaaaaaaTTttttttcccccc%P..',
  '...AttaaaaaatttTtttttcccccccCAqQ',
  '..AattaaaatttttTTTttccccccpcCA..',
  '..AtttttttttttttTTTTcccccccCCAQ.',
  '...AtttttttttttttttTTccccCCCCA..',
  '....AtttttttttttttTTT%CCCCCCA...',
  '....AttttttttccccccccT%%%AAA....',
  '....ATttttcccccccccccccCA.......',
  '.....ATTtccccccccccccccCA.......',
  '......ZTTcccccccccccccCZZ.......',
  '.....ZPPTppcccccccccCCZppZ......',
  '....ZPPPpppPcccccCCCPPpppPZ.....',
  '.....ZPPZPPZAAAAAAAZPZZPPZ......',
  '......ZZ.ZZ.........ZZ.ZZ.......',
  '................................',
];
// Asleep: eyes shut, curled a little lower.
const hamsterSleep = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '.............AttTttpP%attttTA...',
  '.............ATTtaT%%atttttTTA..',
  '..........AAAAA%aaaaaatttttTTA..',
  '........AAaaaaaTaaaattttttkTTA..',
  '.......AaaaaaaTttttttttkkkTTT%A.',
  '......AaaaaaaaTtttttttttccTT%pA.',
  '....AAaaaaaaaaTTttttttcccccc%P..',
  '...AtaaaaaaaaatTtttttcccccccCAqQ',
  '..AattaaaaaatttTTTttccccccpcCA..',
  '..AtttttatttttttTTTTcccccccCCAQ.',
  '...AtttttttttttttttTTccccCCCCA..',
  '...AttttttttttttttTTT%CCCCCCA...',
  '....AttttttttccccccccT%%%AAA....',
  '....AtttttcccccccccccccC%A......',
  '.....ATTtccccccccccccccCZ.......',
  '.....ZPTTppcccccccccccCppZ......',
  '....ZPPPpppPccccccccCPpppPZ.....',
  '.....ZPPZPPccccccCCZPZZPPZ......',
  '......ZZ.ZZAAAAAAAA.ZZ.ZZ.......',
  '................................',
];
// Cheering: a happy hop, all paws off the ground, eyes squeezed shut with joy.
const hamsterCheer = [
  '................................',
  '................................',
  '................................',
  '................................',
  '..................AAA...........',
  '.................AaatA..........',
  '...............AAaattTAAA.......',
  '..............AttatppTtttAA.....',
  '.............AtttttppTattttA....',
  '.............AttTttpP%attttTA...',
  '.........AAAAATTtaT%%atttttTTA..',
  '.......AAaaaaattaaaaaatttttTTA..',
  '.....AAaaaaaaaaTaaaattttkktTTA..',
  '....AtaaaaaaaaTttttttttkttkTT%A.',
  '...AtaaaaaaaaaTtttttttttccTT%pA.',
  '...AaaaaaaaaatTTttttttcccccc%P..',
  '..AtaaaaaaaatttTtttttcccccccCAqQ',
  '.AattaaaaatttttTTTttccccccpcCA..',
  '.AttttttttttttttTTTTcccccccCCAQ.',
  '..AttttttttttttttttTTccccCCCCA..',
  '..AtttttttttttttttTTT%CCCCCCA...',
  '..AttttttttttccccccccT%%%AAA....',
  '...AttttttcccccccccccccC%A......',
  '....ATTTTccccccccccccccCA..ZZ...',
  '.....ATTTcccccccccccccCAZZZppZ..',
  '...ZZZZATcccccccccccCAAZPPpppPZ.',
  '..ZPPppZAAcccccccCCAA.ZPPPPPPZ..',
  '.ZPPpppPZ.AAAAAAAAA....ZPZZZZ...',
  '..ZPPPPZ................ZZ......',
  '...ZZZZ.........................',
  '................................',
  '................................',
];

// ── Currency icons (12×12) ──
const coin = [
  '....VVVV....',
  '..VVyhhyVV..',
  '.VyhhhyyyyV.',
  '.VhhwyyyyyV.',
  'VyhyyyyyYyyV',
  'VyyyyyyyYyyV',
  'VyyyyyyyYyYV',
  'VyyyyyyyYYYV',
  '.VyyYYYYYYV.',
  '.VyyyYYYYYV.',
  '..VVYYYYVV..',
  '....VVVV....',
];

// M11: a Casino Chip (red, with the white edge marks every casino chip has).
const chip = [
  '....XXXX....',
  '..XXrwwrXX..',
  '.XrrrwwrrrX.',
  '.XrRRRRRRrX.',
  'XrrRweeeRrrX',
  'XwwReeeeRwwX',
  'XwwReeeeRwwX',
  'XrrReeeRRRRX',
  '.XrRRRRRRRX.',
  '.XRRRwwRRRX.',
  '..XXRwwRXX..',
  '....XXXX....',
];

const token = [
  '....ZZZZ....',
  '..ZZppppZZ..',
  '.ZppppppppZ.',
  '.ZppwppwppZ.',
  'ZppppppppppZ',
  'ZpwppppppwpZ',
  'ZpppwwwwppPZ',
  'ZpppwwwwPPPZ',
  '.ZpppwwPPPZ.',
  '.ZpppPPPPPZ.',
  '..ZZPPPPZZ..',
  '....ZZZZ....',
];

const heirloom = [
  '........HH..',
  '.....U.HGGH.',
  '....UnHGgH..',
  '...UxxnUH...',
  '...UxnnU....',
  '..UxxnnnU...',
  '..UnxnnNU...',
  '..UnxnNNU...',
  '..UnxNNNU...',
  '..UnxNNNU...',
  '...UNNNU....',
  '....UUU.....',
];

// ── Capsules (12×12), one per rarity ──
const capsule = [
  '....WWWW....',
  '..WWbvvbWW..',
  '.WbvvvbbbbW.',
  '.WvvvbbbbbW.',
  'WbvbbbbbbbbW',
  'WvbbbbbbbbbW',
  'KKKKKKKKKKKK',
  'KwwwwwwqqqqK',
  '.KwwwqqqqqK.',
  '.KwwqqqqqqK.',
  '..KKqqqqKK..',
  '....KKKK....',
];

// Rare and Epic capsules are the same capsule with a different top colour:
// a tiny example of how a recolour makes a new sprite (and how skins work).
const capsuleRare = recolor(capsule, { b: 'p', B: 'P', v: 'p', W: 'Z' });
const capsuleEpic = recolor(capsule, { b: 'y', B: 'Y', v: 'h', W: 'V' });

// ── The Capsule Machine (24×24) ──
const gacha = [
  '...........KK...........',
  '........KKKwwKKK........',
  '.......KwwwwwwwwK.......',
  '......KwwwwpppwwwK......',
  '.....KwwwwwppPwwwwK.....',
  '....KwwwwwwpPPbwwwwK....',
  '....KwwwwmmmwbbbwwwK....',
  '...KwwwwwmmMwbBBwwwwK...',
  '...KwwwwwMMwwBBwwwwwK...',
  '...KwwwbbbwwwwyyywqqK...',
  '....KwwbbBwppwyyYqqK....',
  '....KwwbBBpppPyYYqqK....',
  '.....KwyywwPPqqmmqK.....',
  '....XKwwYwwwqqqmqqKX....',
  '...XRRRRRRRRRRRRRRRRX...',
  '...XrrrreeeerrrrrrrrX...',
  '...XrreeerrrrrryrrrrX...',
  '...XrerkkrrrrryyyrrrX...',
  '...XrrrrrrrrrryyYrrrX...',
  '...XrrrrrrrrrrrYrRRRX...',
  '...XrrrrrrssssrRRRRRX...',
  '...XrrrrrrssssRRRRRRX...',
  '....XrrrrRRRRRRRRRRX....',
  '.....XXXXXXXXXXXXXX.....',
];

// ── Upgrade + Family Tree icons (16×16) ──
const cheeks = [
  '................',
  '................',
  '..AAA......AAA..',
  '.AtttAAAAAAtttA.',
  'AttpttttttttpttA',
  'AttttaaatttttttA',
  '.AtaaattttttttA.',
  '.AtaakttttktttA.',
  'AtattkttttkttttA',
  'AtccccttttccccTA',
  '.AcccccppcccccA.',
  '.AcccccttcccccA.',
  '..AcccttTTcccA..',
  '...AttTTTTTTA...',
  '....AAATTAAA....',
  '.......AA.......',
];

const wheel = [
  '....KKKwwKKK....',
  '...KwwwwwwqqK...',
  '..KwwKQKKQKqqK..',
  '.KwwK.Q..Q.KqqK.',
  '.KwK...QQ...KqK.',
  '.KwQQ..QQ..QQqK.',
  'KwwK.QQyyQQ.KqQK',
  'KqqK.QQyyQQ.KQQK',
  '.KqQQ.UQQU.QQQK.',
  '.KqK.UnQQnU.KQK.',
  '.KqqKUQnnQUKQQK.',
  '..KqqnQnnQnQQK..',
  '...KqQQQQQQQK...',
  '....UnnQQNNU....',
  '....UnnNNNNU....',
  '.....UUUUUU.....',
];

const oilcan = [
  '................',
  '............KK..',
  '...........KqqK.',
  '..........KqqK..',
  '.........KqqK...',
  '........KqqK..y.',
  '....XXXKqqK...y.',
  '...XeeerrX....V.',
  '...XrrrrrX......',
  '..XrrrRRRRXX....',
  '..XeeeeerrX.X...',
  '.XeeerrrrrrXX...',
  '.XrrrrrrrrRXX...',
  '.XrrrrrRRRRX....',
  '..XrrRRRRRX.....',
  '...XXXXXXX......',
];

const reel = [
  '...EEEEEEEEEE...',
  '..EmmmmmmmmmmE..',
  '.EmmyyyyyyyymmE.',
  'EmmmyyyyyyyymmmE',
  'EmmffmmmmmmmmmmE',
  'EmffmmmmmmmmmmmE',
  'EmmwwwwwwwwwwmmE',
  'EmmwwwwwwwwwwmmE',
  'EmmwddwoowyywmmE',
  'EmmwddwoowyywMME',
  'EmmwwwwwwwwwwMME',
  'EmmwwwwwwwwwwMME',
  'EmmmmmmmmMMMMMME',
  '.EmmmmmMMMMMMME.',
  '..EmmmMMMMMMME..',
  '...EEEEEEEEEE...',
];

const heart = [
  '................',
  '...XXXX..XXXX...',
  '..XreeeXXeeerX..',
  '.XreeeeeeerrrrX.',
  '.XeeweeeerrrrrX.',
  'XeeweeerrrrrrrrX',
  '.XeeerrrrrrrrrX.',
  '.XeerrrrrrrrrrX.',
  '..XrrrrrrrrrrX..',
  '...XrrrrrrrRX...',
  '....XrrrrRRX....',
  '.....XrrRRX.....',
  '......XRRX......',
  '......XRRX......',
  '.......XX.......',
  '................',
];

const star = [
  '................',
  '................',
  '.......VV.......',
  '......VhhV......',
  '......VhyV......',
  '..VVVVhyyyVVVV..',
  '.VhhhyyyyyyyyyV.',
  '..VhyyyyyyyyyV..',
  '...VyyyyyyyYV...',
  '....VyyyyYYV....',
  '....VyyyYYYV....',
  '....VyYYYYYV....',
  '...VYYVVVVYYV...',
  '...VYV....VYV...',
  '....V......V....',
  '................',
];

const bolt = [
  '................',
  '.........V......',
  '........VhV.....',
  '.......VhyV.....',
  '......VhyV......',
  '......VhyV......',
  '.....VhyVVVV....',
  '....VhyyyyyyV...',
  '...VhyyyyyyV....',
  '....VVVVyyV.....',
  '......VyyV......',
  '......VyV.......',
  '......VYV.......',
  '.....VYV........',
  '......V.........',
  '................',
];

const scooter = [
  '................',
  '.........WWWWW..',
  '........WbbbbbW.',
  '.........WWBWW..',
  '..........WBW...',
  '..........WBW...',
  '..........WBW...',
  '...........WBW..',
  '...........WBW..',
  '...........WBW..',
  '..WWWWWWWWWWBW..',
  '.WbbbbbbbbbbbbW.',
  '..DssbbbbbbssD..',
  '.DssssDWWDssssD.',
  '..DssD....DssD..',
  '...DD......DD...',
];

const backpack = [
  '................',
  '................',
  '......WWWW......',
  '.....WWWWWW.....',
  '....WBBBBBBW....',
  '...WBBBBBBBBW...',
  '..WBBBBBBBBBBW..',
  '..WBBBBBBBBBBW..',
  '..WbWWWyyWWWbW..',
  '..WbbbbyybbbbW..',
  '..WbbbbbbbbbBW..',
  '..WbbBBBBBBBBW..',
  '..WbbbbbbBBBBW..',
  '...WbbbBBBBBW...',
  '....WbBBBBBW....',
  '.....WWWWWW.....',
];

const parcel = [
  '................',
  '................',
  '..UUUUUUUUUUUU..',
  '.UxxxxxNNxxxxxU.',
  '.UxxxxxNNxxxxxU.',
  '.UnnnnnNNnnnnnU.',
  '.UxxxxxNNnnnnnU.',
  '.UxxxxnNNnnnnnU.',
  '.UxxnnnNNnnnnnU.',
  '.UnnnnnNNnnnnnU.',
  '.UnnnnnNNnnnNNU.',
  '.UnnnnnNNnNNNNU.',
  '.UnnnnnNNNNNNNU.',
  '.UnnnnNNNNNNNNU.',
  '..UUUUUUUUUUUU..',
  '................',
];

const pouch = [
  '................',
  '....UUUUUUUU....',
  '...UxxxxxxnnU...',
  '...UxxxnnnnnU...',
  '....UnnnnnnU....',
  '....UnnnnnnU....',
  '...UXrrrrrrXU...',
  '..UnxxxxnnnnnU..',
  '..UnxxnnnnnnnU..',
  '.UnxnnnGGnnnnnU.',
  '.UnnnnnNNnnnNNU.',
  '.UnnnnnNNnNNNNU.',
  '..UnnnnnNNNNNU..',
  '...UnnnNNNNNU...',
  '....UUNNNNUU....',
  '......UUUU......',
];

const goldenIcon = [
  '................',
  '.......VV.......',
  '......VyyV......',
  '.....VhhyyV.....',
  '....VhwyyhyV....',
  '....VhwyyhyV....',
  '...VyywyyhyyV...',
  '...VyywyyhyYV...',
  '...VyywyyhYYV...',
  '...VyywyyhYYV...',
  '...VyywyYhYYV...',
  '...VyywYYhYYV...',
  '....VywYYhYV....',
  '.....VYYYYV.....',
  '......VVVV......',
  '................',
];

const carrotIcon = [
  '.....H....H.....',
  '....HGH..HGH....',
  '....HiGHHGGH....',
  '.....HGHHGH.....',
  '.....HGGGGH.....',
  '....JJHgGHJJ....',
  '...JjjjjjjjoJ...',
  '...JjjjjjoooJ...',
  '...JjjjjooooJ...',
  '....JjjooooJ....',
  '....JooooooJ....',
  '.....JooooJ.....',
  '.....JooOOJ.....',
  '......JOOJ......',
  '......JOOJ......',
  '.......JJ.......',
];

// ── Snack Stacker symbols (32×32) ──
const blueberry = [
  '................................',
  '................................',
  '................................',
  '................................',
  '..............SSSSS.............',
  '..........SSSSzzIuISSS..........',
  '.........Szzzzzzz&uuuuS.........',
  '.......SSzzzzzIzzzzuIuuSS.......',
  '......Szzwwwwzz&zSz&uuuuuS......',
  '.....Szzwwwwwzzz&S&uuuuuuuS.....',
  '....SzzwwwwwzzzzzzzuuuuuuuIS....',
  '....SzzwwwwzzzzzzzzuuuuuuuIS....',
  '...SzzzwwwzzzzzzzzzuuuuuuuIIS...',
  '...SzzzzzzzzzzzzzzuuuuuuuuIIS...',
  '..SzzzzzzzzzzzzzzuuuuuuuuuIIIS..',
  '..SzzzzzzzzzzzzzuuuuzuuuuuIIIS..',
  '..SuzzzzzzzzzzzzuuzuuuuuuIIIIS..',
  '..SuzzzzzzzzzuuuuuuuuuuuuIII&S..',
  '..SuuzzzzzzuuuuuuuuuzuuzIIII&S..',
  '..SuuuuuuuuuuuuuuuuuuuuIIIII&S..',
  '..SuuuuuuuuzuuuuuuuuuuIIIII&&S..',
  '...SuuuuzuuuuuuuuuuuuIIIII&&S...',
  '...SuuuuuuuuuuuuuuuuIIIIII&&S...',
  '....SuuuuuuuuzuuuuIIIIIII&&S....',
  '....SuuuuuuzuuuuIIIIIIII&&&S....',
  '.....SIuuuuuuuIIIIIIII&&&&S.....',
  '......SIIIIIIIIIIIIII&&&&S......',
  '.......SSIIIIIIIIII&&&&SS.......',
  '.........SIIIIII&&&&&&S.........',
  '..........SSSS&&&&SSSS..........',
  '..............SSSS..............',
  '................................',
];

const strawberry = [
  '.................H..............',
  '................HgH.............',
  '................HgH.............',
  '..........HHHHHHGHHHHH..........',
  '.......HHHiiiiGgGiiiGgHHH.......',
  '.....HHiiiiiiGGgGiiGGgiiGHH.....',
  '....HiiiiiGGGGiiiGGGGgiiGGgH....',
  '....HiiiGGGGGiiiiGGgggGGGGgH....',
  '....HGGGGGggGiiGGGgggGGGgggH....',
  '...XeeeggggeeGGGgggrrggggRRRX...',
  '...XreeeeeeeeeggggrrrrrrRRRRX...',
  '...XreeeheeehrrryrrryrrRyRRRX...',
  '...Xreeereeerrrr#rrr#rrR#RR#X...',
  '...XreeeeerrrrrrrrrrrrrRRRR#X...',
  '...XrrreyrrryrrryrrryrRRyRR#X...',
  '...Xrrrr#rrr#rrr#rrr#RRR#RR#X...',
  '...XrrrrrrrrrrrrrrrrrRRRRR##X...',
  '....XrrryrrryrrryrrryRRRyR#X....',
  '....Xrrr#rrr#rrr#rrR#RRR###X....',
  '.....XrrrrrrrrrrrrrRRRRRR#X.....',
  '.....XrryrrryrrryrRRyRRRy#X.....',
  '......Xr#rrr#rrr#RRR#RR##X......',
  '......XrrrrrrrrrrRRRRRR##X......',
  '.......XrrrryrrryRRRyR##X.......',
  '........Xrrr#rrR#RRR###X........',
  '.........XrrrrrRRRRR##X.........',
  '..........XryrrRyRR##X..........',
  '...........X#rrR#R##X...........',
  '............XrrRR##X............',
  '.............XXR#XX.............',
  '...............XX...............',
  '................................',
];

// ── Milestone 6 symbols (32×32) ──
// The Hamster Wild: your hamster's face on a gold coin. It stands in for any symbol on a line.
const wild = [
  '............VVVVVVVV............',
  '.........VVVhhhhyyyyVVV.........',
  '........VhhhhhhhhhyyyyyV........',
  '......VVhhhhhhYYYYhyyyyyVV......',
  '.....VhhhhhYYYhhhhYYYyyyyyh.....',
  '....VhhhhYYhhhhhhhhyyYYyyhwh....',
  '...VhhhhYhhhhhhhhhhyyyyYyyhYV...',
  '...VhhhYhaathhhhhhhyaatyhyyyV...',
  '..VhhhYhaaatThhhhhyaaatTyhyyYV..',
  '.VhhhYhhappPTaaatttappPTyyhyYYV.',
  '.VhhhYhhttPaaaaaattttPT%yyhyYYV.',
  '.VhhYhhhhTaaaaaaattttt%yyyyhYYV.',
  'VyhhYhhhhaaaaaaaatttttTyyyyhYYYV',
  'VyhhYhhhaaaaaaaattttttTTyyyhYYYV',
  'VyhYhhhhaaaawkattttwkTTTyyyYhYYV',
  'VyyYhhhhtaaakktttttkkTTTyyYYhYYV',
  'VyyYhhhhtttccttttttccTT%yyYYhY!V',
  'VyyYyyyytcccccCttcccccc%yYYYhY!V',
  'VyyyYyyycccpccCppccccpcCYYYhYY!V',
  'VyyyYyyycccccccPPcccccCCYYYhY!!V',
  '.VyyYyyyycccCcccccCccCCYYYYhY!V.',
  '.VyyyYyyyCCCCCccCCCCCCCYYYhY!!V.',
  '.VyyyYyyyyyTTTTCC%%%%YYYYYh!!!V.',
  '..VyyyYyyyyyy%%%%%%YYYYYYh!!!V..',
  '...VyyyhyyyyyyyyyYYYYYYYh!!!V...',
  '...VYyyyhyyyyyyYYYYYYYYh!!!!V...',
  '....VYYyyhhyYYYYYYYYYhh!!!!V....',
  '.....VYYYYYhhhYYYYhhhY!!!!V.....',
  '......VVYYYYYYhhhhYY!!!!VV......',
  '........VYYYYYYYY!!!!!!V........',
  '.........VVV!!!!!!!!VVV.........',
  '............VVVVVVVV............',
];

// The Hamster Ball: a scatter (it counts anywhere). 3+ start free spins on the Burrow Bonanza.
const ball = [
  '..............WWWW..............',
  '..........WWWWvvvvWWWW..........',
  '........WWvvvvvvvvvvvvWW........',
  '.......WvvvvvvvvvvvvvvvvW.......',
  '......WvvvvvvvvvvvvvvvvvvW......',
  '.....WvvvvvwwwwwwvvvvvvvvvW.....',
  '....WvvvvvwwwwwwwvvvvvvvvvvW....',
  '...WvvvvwwwwvvvvvvvvvvvvvvvvW...',
  '..WvvvvvwwwvvvvvvvvvvvvvvvvvbW..',
  '..WvvvvwwvvvvvvvvvvvvvvvvvvvvW..',
  '.WvvvvwwwvvvvvvvvvvvvvvvvvvvvbW.',
  '.WvvvwwwvvvvvvvvvBBBvvvvvvvvvbW.',
  '.WvvvwwvvvvvvvvvBaatBBBvvvvvvbW.',
  '.WvvvvvvvvvvvvvvBapPattBvvvvvbW.',
  'WvvvvvvvvvvBBBBBBtPTatttBvvvbbbW',
  'WvvvvvvvvBBaaaataaaattttTBvvbbbW',
  'WvBBvvvvBaaaaaataaatttktTBvvbBBW',
  'WvvvBBBBaaaaaaatttttcckTT%BBBbBW',
  '.WvvvvvBaaaaaatttttcccccpBbbbbW.',
  '.WvvvvBtaaaatttttttccccC%BbbbbW.',
  '.WvvvvBttttttttttTTcccCCBbbbbBW.',
  '.WvvvvBtttttcccccT%%CCCBbbbvbBW.',
  '..WvvvvBttccccccccc%%BBbbbvbBW..',
  '..WvvvvBTcccccccccCC%BbbbbvBBW..',
  '...WvvvvBTcccccCCCC%BbbbbvBBW...',
  '....WvvvvBB%CCCCC%BBbbbbvBBW....',
  '.....WvvvvvBBBBBBBbbbbbvBBW.....',
  '......WbvvvvvvbbbbbbbbBBBW......',
  '.......WbbbbbbbbbbbbbBBBW.......',
  '........WWbbbbbbbbBBBBWW........',
  '..........WWWWBBBBWWWW..........',
  '..............WWWW..............',
];

// The Cheek Pouch: a scatter on the Pouch Palace. 3+ spin the jackpot wheel.
const pouch24 = [
  '..................VVV...........',
  '.................VhhyV..........',
  '...........VVV..VhhhhyV....h....',
  '..........VhhhVVhhhhyyYV..hwh...',
  '.........VhhhhyVhhhhyyYV...h....',
  '........VhhhhyyYyhyyyY!V........',
  '........VhhhyyY!yyyyYY!V........',
  '........VnnnnnnnnnnNNNNU........',
  '.........UnnUnnUnnUNNU*U........',
  '.........UnnnnnnnnNNN*U.........',
  '..........UUnNNN****eeeX........',
  '......UUUXXUxxxnnnNNeerRUU......',
  '.....UxxxrrrrrrrrrrrrRRexnU.....',
  '....UnxxxRRRRRRRRRRRRRRerN*U....',
  '....UxxxxxxxxxxxxxxnnneerNNU....',
  '...UnxxxxxxxxxxxxxxnnnnrRNN*U...',
  '...UxxxxxxxxxxxxxnnnnnnnNNNNU...',
  '...UxxxxxxxxxxxxnnnnnnnnNNNNU...',
  '...UxxxxxxxxxxhhhynnnnnNNNNNU...',
  '...UnxxxxxxxnhhhhhynnnnNNNN*U...',
  '...UnnnxnnnnhhhhVyyYnnNNNNN*U...',
  '...UnnnnnnnnhhhhYyyYNNNNNN**U...',
  '....UnnnnnnnhhhhYyyYNNNNNN*U....',
  '....UnnnnnnnyyyyYyYYNNNNN**U....',
  '.....UnnnnnnyyyyYYY!NNNN**U.....',
  '......UnnnnnnYYYVY!NNN***U......',
  '.......UnnnnnNY!!!NNN***U.......',
  '........UnnnnNNNNNN****U........',
  '.........UUnNNNN*****UU.........',
  '...........UnNN*****U...........',
  '............UUUUUUUU............',
  '................................',
];

const corn = [
  '................................',
  '............VVVVVVVV............',
  '...........VhhhhyyyYV...........',
  '..........VhhhhhhyyyYV..........',
  '..........VyhhyhhYyy!V..........',
  '.........VyyhhyhyYyy!YV.........',
  '.........VyyyyyyYYYY!!V.........',
  '.........VyhhyhhYyyYYYV.........',
  '........VyyhhyhhYyyYyY!V........',
  '........VYyyyyyYYYYYY!!V........',
  '........VyhyhhyyyYyyYYYV........',
  '........VyhyhhyyyYyyYYYV........',
  '........VYyyyyYYYYYYY!!V........',
  '........VyyhhyyyYyyYyY!V........',
  '........VyyhhYyyYyyYyY!V........',
  '........VYyyyYYYYYYY!!!V........',
  '.......HiyhyyyYyyYyy!YYGH.......',
  '......HiiyyyyyYyyYyy!YYGGH......',
  '......HiiYYYYYYYYYYY!!!GGH......',
  '.....HiiiyYyyYyyYyyYYY!GGgH.....',
  '.....HiiiyYyyYyyYyyYYY!GGgH.....',
  '.....HiiiYYYYYYYYYY!!!!GGgH.....',
  '.....HiiiyyYyyYyyYyY!Y!GggH.....',
  '.....HGiiGiiiGYyyYiiiGGGggH.....',
  '.....HGGGiiiiGgYYiiiiGgGggH.....',
  '.....HGGGiiiiGGyYiiiiGGgggH.....',
  '.....HGGGiiiGGgyYiiiGGggggH.....',
  '......HGGiiGGiiiiGGGGGgggH......',
  '......HggGGGiiiiiGGgGggggH......',
  '.......HggGgGGGGGGggggggH.......',
  '........HHggggggggggggHH........',
  '..........HHHHHHHHHHHH..........',
];

const apple = [
  '................................',
  '................................',
  '....................HHHHH.......',
  '..................UHiiiiGH......',
  '.................UNiiiiGGgH.....',
  '................UNUgGgGgggH.....',
  '................UNUHgggggH......',
  '........XXXXXXXUNXXXXXXXH.......',
  '.......XeeeeerrXNeeeeerrX.......',
  '.....XXwwweeeer###eeeeerrXX.....',
  '....Xewwwweeeeee#eeeeeerrrrX....',
  '...XewwwwweeeeeeeeeeeeerrrrRX...',
  '...XwwwwwweeeeeeeeeeeeerrrrrX...',
  '..XewwwwweeeeeeeeeeeeerrrrrrRX..',
  '..XewwwweeeeeeeeeeeeeerrrrrrRX..',
  '.XreewweeeereeeeeeeeerrrrrrrRRX.',
  '.XeeeeeeeeeeeeeeeeeeerrrrrrrRRX.',
  '.XeeeeeeeeeeeeeeeeeerrrrrrrRRRX.',
  '.XreeeeeerrreeeeeerrrrrrrrrRR#X.',
  '.XrreeerrrrrreeerrrrrrrrrrRRR#X.',
  '.XrrrrrrrrrrrrrrrrrrrrrrrRRRR#X.',
  '.XrrrrrrrrrrrrrrrrrrrrrrrRRR##X.',
  '..XrrrrrrrrrrrrrrrrrrrrrRRRR#X..',
  '..XrrrrrrrrrrrrrrrrrrrRRRRR##X..',
  '...XrrrrrrrrRrrrrrrrrRRRRR##X...',
  '...XRrrrrrRRRRrrrrrRRRRRR###X...',
  '....XRRRRRRRRRRRRRRRRRRR###X....',
  '.....XXRRRRRR###RRRRRR###XX.....',
  '.......X#######XX#######X.......',
  '........XXXXXXX..XXXXXXX........',
  '................................',
  '................................',
];

// ── Machines (24×24): the machine cards and the machine tags on the stage ──
const machineClunky = [
  '........................',
  '........................',
  '...EEEEEEEEEEEEEE.......',
  '..EffffffffffffffE..XX..',
  '.EfmVVVVVVVVVVVVmMEXerX.',
  '.EfmVhyyyyyyyyYVmMEXrRX.',
  '.EfmVVVVVVVVVVVVmME.XX..',
  '.EfmmmmmmmmmmmmmmME.QK..',
  '.EfEEEEEEEEEEEEEmME.QK..',
  '.EfEwwwqwwwqwwwEmME.QK..',
  '.EfEwdwqwywqwGwEmME.QK..',
  '.EfEdLdqyhyqoooEmME.QK..',
  '.EfEwdwqwYwqwOwEmME.QK..',
  '.EfEqqqqqqqqqqqEmMEKKK..',
  '.EfEEEEEEEEEEEEEmMEKK...',
  '.EfmmmmmmmmmmmmmmME.....',
  '.EfmmmEEEEEEEEmmmME.....',
  '.EfmmmEDDDDDDEmmmME.....',
  '.EfmmmEEEEEEEEmmmME.....',
  '.EfmmmmmmmmmmmmmmME.....',
  '.EMMMMMMMMMMMMMMMME.....',
  '..EEEEEEEEEEEEEEEE......',
  '........................',
  '........................',
];

const machineStacker = [
  '........................',
  '.....ZZZZZZZZZZZZZZ.....',
  '....ZFFFFFFFFFFFFFFZ....',
  '...ZFpVVVVVVVVVVVVpPZ...',
  '...ZFpVhyyyyyyyyYVpPZ...',
  '...ZFpVVVVVVVVVVVVpPZ...',
  '...ZFppppppppppppppPZ...',
  '...ZFZZZZZZZZZZZZZpPZ...',
  '...ZFZwdwqwGwqwSwZpPZ...',
  '...ZFZdLdqryrquzuZpPZ...',
  '...ZFZwdwqwrwqwIwZpPZ...',
  '...ZFZqqqqqqqqqqqZpPZ...',
  '...ZFZwGwqwGwqwGwZpPZ...',
  '...ZFZoooqoooqoooZpPZ...',
  '...ZFZwowqwowqwowZpPZ...',
  '...ZFZqqqqqqqqqqqZpPZ...',
  '...ZFZwywqwdwqwSwZpPZ...',
  '...ZFZyhyqdLdquzuZpPZ...',
  '...ZFZwYwqwdwqwIwZpPZ...',
  '...ZFZZZZZZZZZZZZZpPZ...',
  '...ZFppppppppppppppPZ...',
  '...ZPPPPPPPPPPPPPPPPZ...',
  '....ZZZZZZZZZZZZZZZZ....',
  '........................',
];

// The Burrow Bonanza (wood, with grass on top) and the Pouch Palace (velvet and gold).
const machineBonanza = [
  '...H..H..HH...H..H..H...',
  '..HGHHiH.HGGHHGH.HiHHGH.',
  '.UUUUUUUUUUUUUUUUUUUUUU.',
  '.UxxxxxxxxxxxxxxxxxxxnU.',
  '.UxnVVVVVVVVVVVVVVVVnNU.',
  '.UxnVhyyyyyyyyyyyyYVnNU.',
  '.UxnVVVVVVVVVVVVVVVVnNU.',
  '.UxnnnnnnnnnnnnnnnnnnNU.',
  '.UxnUUUUUUUUUUUUUUUUnNU.',
  '.UxnUwwqwwqwwqwwqwwUnNU.',
  '.UxnUdLqoGqyhqtaqbvUnNU.',
  '.UxnUwdqoOqYyqtAqBbUnNU.',
  '.UxnUqqqqqqqqqqqqqqUnNU.',
  '.UxnUrrqyyqdLqGGqooUnNU.',
  '.UxnUeRqhYqddqigqOOUnNU.',
  '.UxnUwwqwwqwwqwwqwwUnNU.',
  '.UxnUUUUUUUUUUUUUUUUnNU.',
  '.UxnnnnnnnnnnnnnnnnnnNU.',
  '.UxnnnnnnUUUUUUnnnnnnNU.',
  '.UxnnnnnnUDDDDUnnnnnnNU.',
  '.UxnnnnnnUUUUUUnnnnnnNU.',
  '.UxnnnnnnnnnnnnnnnnnnNU.',
  '.UNNNNNNNNNNNNNNNNNNNNU.',
  '.UUUUUUUUUUUUUUUUUUUUUU.',
];

const machinePalace = [
  '..........VhhV..........',
  '.........VyyyYV.........',
  '.0000000000000000000000.',
  '.0+++++++++++++++++++80.',
  '.0+8VVVVVVVVVVVVVVVV890.',
  '.0+8VhyyyyyyyyyyyyYV890.',
  '.0+8VVVVVVVVVVVVVVVV890.',
  '.0+88yy8bb8rr8pp8888890.',
  '.0+80000000000000000890.',
  '.0+80wwqwwqwwqwwqww0890.',
  '.0+80uzqrexyhqtaqpF0890.',
  '.0+80uIqrRqYyqtAqpP0890.',
  '.0+80qqqqqqqqqqqqqq0890.',
  '.0+80yyqdLquuqrrqtt0890.',
  '.0+80hYqddqzIqeRqaT0890.',
  '.0+80wwqwwqwwqwwqww0890.',
  '.0+80000000000000000890.',
  '.0+88888888888888888890.',
  '.0+88888800000088888890.',
  '.0+8888880DDDD088888890.',
  '.0+88888800000088888890.',
  '.0+88888888888888888890.',
  '.0999999999999999999990.',
  '.0000000000000000000000.',
];

// ── More icons (16×16) ──
const gear = [
  '......KKKK......',
  '..KK.KwwwwK.KK..',
  '.KwwKKwqqqKKwqK.',
  '.KwqwwqqqqwwqqK.',
  '..KwqqqqqqqqqK..',
  '.KKwqqqqqqqqqKK.',
  'KwwqqqqKKqqqqqqK',
  'KwqqqqK..KqqQQQK',
  'KwqqqqK..KqQQQQK',
  'KwqqqqqKKqQQQQQK',
  '.KKwqqqqqQQQQKK.',
  '..KwqqqqQQQQQK..',
  '.KwqqqqQQQQQQqK.',
  '.KqqKKqQQQKKqQK.',
  '..KK.KqQQQK.KK..',
  '......KKKK......',
];

const paylinesIcon = [
  'KKKKKKKKKKKKKKKK',
  'KyhwwqwwwwqwwwwK',
  'KYyhwqwwwwqwwwwK',
  'KwYyhqwwwwqwwwwK',
  'KwwYyhwwwwqwwwwK',
  'KqqqYyhqqqqqqqqK',
  'KwwwwYyhwwqwwwwK',
  'KwwwwqYyhwqwwwwK',
  'KwwwwqwYyhqwwwwK',
  'KwwwwqwwYyhwwwwK',
  'KqqqqqqqqYyhqqqK',
  'KwwwwqwwwwYyhwwK',
  'KwwwwqwwwwqYyhwK',
  'KwwwwqwwwwqwYyhK',
  'KwwwwqwwwwqwwYyK',
  'KKKKKKKKKKKKKKKK',
];

// Milestone 6 upgrade icons: High Roller (a stack of coins), Hot Streak (a flame),
// Hamster Wild, Bouncy Ball and Pouch Polish (the Family Fortune pouch, shined up).
const highRollerIcon = [
  '..............h.',
  '....VVVVVVVV.hwh',
  '...VhhyyyyyyV.h.',
  '...VhyywyyyYV...',
  '...VyyyyyyYYV...',
  '...VVyyyYYYVV...',
  '...VhVVVVVVYV...',
  '...VhyyyyyyYV...',
  '...VVVVVVVVVV...',
  '...VhyyyyyyYV...',
  '...VVVVVVVVVV...',
  '...VhyyyyyyYV...',
  '...VhyyyyyyYV...',
  '....VVVVVVVV....',
  '................',
  '................',
];

const flame = [
  '.......X........',
  '......XrX.......',
  '......XrrX......',
  '.....XrreX...X..',
  '....XrrerrX.XrX.',
  '...XrrrjerrXrrX.',
  '...XrrjjoerrrRX.',
  '..XrrjjooorrrRX.',
  '..XrrjyyoooRRRX.',
  '..XrjyhhyooRRRX.',
  '..XrjyhwhyoRRX..',
  '..XrjyhhhyoRRX..',
  '...XrjyyyoRRX...',
  '....XrroooRX....',
  '.....XXRRXX.....',
  '................',
];

const wildIcon = [
  '.....VVVVVV.....',
  '...VVhAAyAAyV...',
  '..VhAppAyApPAV..',
  '.VhhAAtaatttAYV.',
  '.VhAtaattttttAV.',
  'VhAtawkttttwktAV',
  'VyAtakkttttkktAV',
  'VyAttttttpptttAV',
  'VyAcccccAAccccAV',
  'VyAccccAttAcccAV',
  '.VyAccCttttCCAV.',
  '.VyyAACTTTTCAAV.',
  '..VyyyAAAAAAYV..',
  '...VVyyYYYYVV...',
  '.....VVVVVV.....',
  '................',
];

const ballIcon = [
  '.....WWWWWW.....',
  '...WWvvvWbbWW...',
  '..WvvwvvWbbbbW..',
  '.WvwvvvbbbbbbbW.',
  '.WvwvvbbbbAAbbW.',
  'WvvvvbbbAAtpAbBW',
  'WvvvbbbAattwkABW',
  'WWWbbbAttttttpZW',
  'WvbbbbAtttcccABW',
  'WbbbbbAttcccCABW',
  'WbbbbbbAAcCCABBW',
  '.WbbbbbZpAAZpBW.',
  '.WbbbbbbZbbZBBW.',
  '..WbbbbbWBBBBW..',
  '...WWbbbWBBWW...',
  '.....WWWWWW.....',
];

const pouchPolish = [
  '................',
  '.h..UUUUUUUU....',
  'hwhUxxxxxxnnU...',
  '.h.UxxxnnnnnU.h.',
  '....UnnnnnnU.hwh',
  '....UnnnnnnU..h.',
  '...UXrrrrrrXU...',
  '..UnxxxxnnnnnU..',
  '..UnxxnnnnnnnU..',
  '.UnxnnnwhynnnnU.',
  '.UnnnnnNynnnNNU.',
  '.UnnnnnNNnNNNNU.',
  '..UnnnnnNNNNNU..',
  '...UnnnNNNNNU...',
  '....UUNNNNUU....',
  '......UUUU......',
];

// ── Cage props (24×24): the water bottle hangs on the bars, the bowl sits in the bedding ──
// ── Milestone 7: the blank symbol, Luck, symbol unlocks, the card gamble ──
// The Wood Shaving: the reels' empty stop (it never pays). A curl of tan shaving,
// the same wood as the cage's bedding.
const shaving = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '.............UUUUU..............',
  '..........UUUnnnnnUUU...........',
  '........UUnnnnnnnnnnnU..........',
  '.......UnnnnnnnnnnnnnnU.........',
  '......UnnnnnxxxxxxxxnnnU........',
  '.....UnnnnxxxxUUUUxxxnnnU.......',
  '.....UnnnxxxUU....UUxxnnnU......',
  '....UnxxxxUU........UxxxnU......',
  '....UnxxxxU.........UxxxnU......',
  '...UnnxxxU...........UxxnnU.....',
  '...UnnxxxU...........UxxnnU.....',
  '...UNNxxxU...........UxxNNU.....',
  '...UNNxxxU..UUU.....UxxxNU......',
  '...UNNxxxU.UxxxUU.UUxxxxNU......',
  '...UNNxxxU.UNxxxxUxxxxxNU.......',
  '....UNNxxxUUNNxxxxxxxNNUUUU.....',
  '....UNNxxxxUUNNxxNNNNNUUxxxU....',
  '....UNNNxxxxUUUUNNNNUUUxxxxxU...',
  '.....UNNxxxxxxUUUUUUUxxxxxxNNU..',
  '......UNNxxxxxxxxxxxxxxxxNNNU...',
  '.......UNNxxxxxxxxxxxxxxNNNU....',
  '........UUNNxxxxxxxxxNNNNNU.....',
  '..........UUNNNNNNNNNNNNUU......',
  '............UUNNNNNNNUUU........',
  '..............UUUUUUU...........',
  '................................',
];

// Hamster Luck: a four-leaf clover (the notches between the leaves read as four leaves).
const clover = [
  '................',
  '................',
  '...HHHH..HHHH...',
  '..HiiiiHHGGGGH..',
  '..HiiiiGgGGGGH..',
  '..HiiiGGgGGGGH..',
  '..HiiGGGgGGGgH..',
  '...HggggggggH...',
  '..HiGGGGgGGggH..',
  '..HGGGGGgGgggH..',
  '..HGGGGGgggggH..',
  '..HGGGGGgggggH..',
  '..HGGGGHHggggH..',
  '...HHHH..HHHH...',
  '...........HH...',
  '............H...',
];

// Machine Luck: a lucky horseshoe (iron: light top-left, shade bottom-right).
const horseshoe = [
  '................',
  '................',
  '.....KKKKKK.....',
  '...KKwwwwqqKK...',
  '...KwwwKKqqqK...',
  '..KwwwK..KqqqK..',
  '..KwwK....KqqK..',
  '.KwwK......KQQK.',
  '.KwKK......KKQK.',
  '.KqqK......KQQK.',
  '..KqqK....KQQK..',
  '..KqKK....KKQK..',
  '..KKK......KKK..',
  '................',
  '................',
  '................',
];

// Symbol unlocks ("new seeds"): a paper seed packet with a sprouting seed on it.
const seedPacket = [
  '................',
  '................',
  '...UUUUUUUUUU...',
  '...UxxxxxxxxU...',
  '...UNNNNNNNNU...',
  '...UxnnnHnnnU...',
  '...UxnnHGHnnU...',
  '...UxnnDHDnnU...',
  '...UxnDddDnnU...',
  '...UxnDdldDnU...',
  '...UxnDdlsDnU...',
  '...UxnnDssDnU...',
  '...UxnnnDDnnU...',
  '...UnnnnnnnNU...',
  '...UUUUUUUUUU...',
  '................',
];

// The card gamble: a card back (for icons and the face-down card) and four suits.
const cardBack = [
  '................',
  '..KKKKKKKKKKK...',
  '..KwwwwwwwwwK...',
  '..KwRrRrRrRwK...',
  '..KwrRrRrRrwK...',
  '..KwRrRrRrRwK...',
  '..KwrRrRrRrwK...',
  '..KwRrRyRrRwK...',
  '..KwrRyhyRrwK...',
  '..KwRrRyRrRwK...',
  '..KwrRrRrRrwK...',
  '..KwRrRrRrRwK...',
  '..KwrRrRrRrwK...',
  '..KwwwwwwwwwK...',
  '..KKKKKKKKKKK...',
  '................',
];

const suitHearts = [
  '............',
  '...XX..XX...',
  '.XXeeXXrrXX.',
  '.XeeerrrrrX.',
  '.XeerrrrrrX.',
  '.XerrrrrrRX.',
  '..XrrrrrRX..',
  '...XrrrRX...',
  '....XrRX....',
  '.....XX.....',
  '............',
  '............',
];

const suitDiamonds = [
  '............',
  '.....XX.....',
  '....XerX....',
  '...XerrrX...',
  '..XerrrrrX..',
  '.XerrrrrrRX.',
  '.XrrrrrrRRX.',
  '..XrrrrRRX..',
  '...XrrRRX...',
  '....XRRX....',
  '.....XX.....',
  '............',
];

const suitClubs = [
  '............',
  '....DDDD....',
  '....DldD....',
  '...DllddD...',
  '..DllddddD..',
  '.DllddddddD.',
  '.DlddddddsD.',
  '.DddddddssD.',
  '.DDDdddsDDD.',
  '....DdsD....',
  '....DssD....',
  '...DDDDDD...',
];

const suitSpades = [
  '............',
  '.....DD.....',
  '....DldD....',
  '...DllddD...',
  '...DldddD...',
  '.DDldddddDD.',
  '.DlddddddsD.',
  '.DddddddssD.',
  '.DDddddssDD.',
  '...DddssD...',
  '....DssD....',
  '....DDDD....',
];

const bottle = [
  '........................',
  '........WWWWWWWW........',
  '.......WvvvvvvvvW.......',
  '.......WwvvvvvvvW.......',
  '..K....WwvvvvvvbW....K..',
  '..KKKKKKKKKKKKKKKKKKKK..',
  '.......WwbbbbbbBW.......',
  '.......WwbbbbbbBW.......',
  '.......WwbbbbbbBW.......',
  '.......WwbbbbbbBW.......',
  '.......WwbbbbbbBW.......',
  '.......WwbbbbbbBW.......',
  '..KKKKKKKKKKKKKKKKKKKK..',
  '.......WbbbbbbbBW.......',
  '.......WBbbbbbBBW.......',
  '........WWWWWWWW........',
  '.........XXXXXX.........',
  '.........XerrRX.........',
  '.........XrrRRX.........',
  '..........XXXX..........',
  '...........KK...........',
  '...........qK...........',
  '..........KqQK..........',
  '...........KK...........',
];

const bowl = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '...........DdD..........',
  '.......DdD.DdLD.DyD.....',
  '.....DdLdDdddDdDyhYD....',
  '....DdddDLddDoOdDdYdD...',
  '..ZZZZZZZZZZZZZZZZZZZZ..',
  '.ZFFFFFFFppppppppppppPZ.',
  '.ZFFFFppppppppppppppPPZ.',
  '.ZFppppppppppppppppppPZ.',
  '..ZPppppppppppppppPPPZ..',
  '...ZPppppppppppPPPPPZ...',
  '....ZPPpppppPPPPPPPZ....',
  '.....ZZPPPPPPPPPPZZ.....',
  '.......ZZZZZZZZZZ.......',
  '........................',
  '........................',
];

// ── Wood-shaving bedding (24×24), a tile that repeats seamlessly across the cage floor ──
const bedding = [
'xcxxxxxxxxccxxxxxxxxxxxx',
  'xxxxxxnxxcxnxxxxxxxxxccx',
  'xxxcxxxxcxxNxxxxxxxxcxnx',
  'xxxcnxxxnxxxxxxxccxcxxNx',
  'xxxxnxxxxxxxxxcnnxxnxxxx',
  'xxxnNxxxxxxxxnNNxxxxxxxn',
  'xxxxNxxxxxcxxNxxxccxxxxx',
  'xxxxxxxxxnxcxxxxcxncxxxx',
  'xxxxxxxxxNnxxxxcxxcxnxxx',
  'xxxccxxxxxcxxxxnxxxnNxxx',
  'xxxxnncxxxxxxxxxxxxxxxxx',
  'xxxxxNNnxxxxxxxxxxxxxxxx',
  'xxxxxxxNxxxxxxxxnccxxxcc',
  'cxxxxxxxnxxxxxxxcxnxxnxx',
  'ncxxxxxxccxxxxxcxxNxxNxx',
  'xcnxxxxxxnncxxxnxxxxxxNN',
  'xxnxxxxxxxNNnxxxxxxxxxxx',
  'xnNxxxxxxxxxNxxxxxxxxxxx',
  'cxNxxxxxxxxxccxxxxxxxxcc',
  'xccxxxxxxxcnnxxxxxxxxcxn',
  'nxxcxxxxxnNNxxxcccxxcxxN',
  'NxxnxxxxxNxxxxcnnnncnxxx',
  'xNNxxxxxxxxxxxxNNNNxxxxx',
  'xxxxxxxxxxxxxxxxxxxxxxxx',
];

// ── UI frames (12×12, 9-slice; see the style guide at the top) ──
// Cardboard: the tray, the HUD tags, the Menu button.
const frameCard = [
  '..UUUUUUUU..',
  '.UxxxxxxxxU.',
  'UxnnnnnnnnNU',
  'UxnnnnnnnnNU',
  'UxnnnnnnnnNU',
  'UxnnnnnnnnNU',
  'UxnnnnnnnnNU',
  'UxnnnnnnnnNU',
  'UxnnnnnnnnNU',
  'UxNNNNNNNNNU',
  '.UNNNNNNNNU.',
  '..UUUUUUUU..',
];

// Paper: upgrade tiles, dialogs, the speech bubble.
const framePaper = [
  '..33333333..',
  '.3111111113.',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '312222222223',
  '.3222222223.',
  '..33333333..',
];

// A paper tab: like framePaper but open at the bottom, so it joins the panel below it.
const frameTab = [
  '..33333333..',
  '.3111111113.',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
  '311111111123',
];

// A button with a darker lip underneath. theme.ts repaints it for every button colour.
const frameButton = [ // (1.5.0: a two-row highlight with a glint, like a glossy arcade key)
  '..77777777..',
  '.7w66666667.',
  '766666666657',
  '764444444457',
  '764444444457',
  '764444444457',
  '764444444457',
  '764444444457',
  '764444444457',
  '755555555557',
  '.7555555557.',
  '..77777777..',
];

// The speech bubble's little tail (paper colours), hung under the bubble.
// 1.5.0: a casino table's wooden rail round its felt (theme.ts repaints the wood and the felt).
const frameRail = [
  '..UUUUUUUU..',
  '.UxxxxxxxxU.',
  'UxnnnnnnnnNU',
  'UxnkkkkkkNNU',
  'Uxnk11111NNU',
  'Uxnk11111NNU',
  'Uxnk11111NNU',
  'Uxnk11111NNU',
  'Uxnk11111NNU',
  'UxnNNNNNNNNU',
  '.UNNNNNNNNU.',
  '..UUUUUUUU..',
];
const bubbleTail = [
  '3111113.....',
  '.311113.....',
  '.31113......',
  '..3113......',
  '..313.......',
  '...33.......',
  '...3........',
  '............',
  '............',
  '............',
  '............',
  '............',
];

// Pays Both Ways (16×16): a gold arrow to the right over a mint one to the left.
const bothWaysIcon = [
  '...........V....',
  '...........VV...',
  '...VVVVVVVVVyV..',
  '...VhhhhhhhhhyV.',
  '...VyyyyyyyyyYV.',
  '...VVVVVVVVVYV..',
  '...........VV...',
  '...........V....',
  '....E...........',
  '...EE...........',
  '..EmEEEEEEEEE...',
  '.EmfffffffffE...',
  '.EMmmmmmmmmmE...',
  '..EMEEEEEEEEE...',
  '...EE...........',
  '....E...........',
];

// Snack Inheritance (16×16): a tiny Snack Stacker, snacks in its window.
const snackIcon = [
  '................',
  '..ZZZZZZZZZZZZ..',
  '.ZFFFFFFFFFFFPZ.',
  '.ZFhyyyyyyyyYPZ.',
  '.ZFppppppppppPZ.',
  '.ZFZZZZZZZZZZPZ.',
  '.ZFZGGqooquuZPZ.',
  '.ZFZggqOOqIIZPZ.',
  '.ZFZqqqqqqqqZPZ.',
  '.ZFZrrqyyqddZPZ.',
  '.ZFZRRqYYqssZPZ.',
  '.ZFZZZZZZZZZZPZ.',
  '.ZFppppppppppPZ.',
  '.ZPPPPPPPPPPPPZ.',
  '..ZZZZZZZZZZZZ..',
  '................',
];

// ── M9: the new machines (24×24 icons), their symbols and upgrade icons (16×16) ──
// The Golden Acorn (the Acorn Vault's hold & spin coin): a tan cap, a gold body.
const goldAcorn = [
  '.................U..............',
  '................UNU.............',
  '................UNU.............',
  '..............UUNU..............',
  '.........UUUUUxxNnUUUUU.........',
  '......UUUxnnxnnxnnxnNnNUUU......',
  '.....UnxxnxxnxxnxxnxnNnnNNU.....',
  '....UnxnnxnnxnnxnnxnNnNNnN*U....',
  '...UnnxnnxnnxnnxnnxNNnNNnN*NU...',
  '..UnxxnxxnxxnxxnxxNnnNnnNnN*NU..',
  '..UxnnxnnxnnxnnxNNnNNnNNn**N*U..',
  '..UnnnxnnxnnxNNnNNnNNnNNN**N*U..',
  '..UNnnNnnNnnNnnNnnNnnNNN*NN**U..',
  '...U************************U...',
  '....UVhhhhhhhhhyyyyyyyyYYYVU....',
  '.....VhhhhhhhhyyyyyyyyyYYYV.....',
  '.....VyhhhhhhyyyyyyyyyYYYYV.....',
  '.....VyhhhhhyyyyyyyyyyYYYYV.....',
  '.....VyhhhhyyyyyyyyyyyYYYhV.....',
  '.....VyyyyyyyyyyyyyyyYYYhwh.....',
  '.....VyyyyyyyyyyyyyyyYYYYhV.....',
  '.....VyyyyyyyyyyyyyyYYYYY!V.....',
  '......VyyyyyyyyyyyyyYYYY!V......',
  '......VyyyyyyyyyyyyYYYYY!V......',
  '.......VyyyyyyyyyyYYYYY!V.......',
  '.......VyyyyyyyyyYYYYY!!V.......',
  '........VyyyyyyyYYYYY!!V........',
  '.........VyyyyyYYYYY!!V.........',
  '..........VyyyYYYY!!!V..........',
  '...........VVYYY!!!VV...........',
  '.............VVVVVV.............',
  '................................',
];

// The Cheese Wedge (the Big Cheese's top symbol): the pale top face, the gold front with holes.
const cheese = [
  '................................',
  '................................',
  '................................',
  '......................JJ........',
  '....................JJOOV.......',
  '..................JJOOoohVV.....',
  '................JJOOoohhhhhV....',
  '..............JJOOoohhhYYhwhVV..',
  '............JJOOoohhhhhYhwhhhhV.',
  '..........JJOOooYYYhhhhhwhhhyyV.',
  '........JJOOoohh!!hhhhhwhhyyyyV.',
  '......JJOOoohhhhYhhhhhwyyyyyyyV.',
  '....JJOOoowhhhhhhhhhhyyyyyyyyyV.',
  '..JJOOoohwYhhhhhhhhyyyyyyyyyyyV.',
  '.JOOoohhwY!hhhhhhyyyyyyyyyyyyyV.',
  '.JoohhhwhhhhhhhyyyyyyYYYYyyyyyV.',
  '.VYYYhwhhhhhyyyyyyyyyY!!hyyyyyV.',
  '.VYYYYhhhhyyyyyyyyyyyY!!hyyyyyV.',
  '.VYYYYYYyyyyyyyyyyyyyYhhhyyyYYV.',
  '.VYYYYYYyyyyYYYYyyyyyyyyyyYYYYV.',
  '.VYYYYYYyyyY!!!!hyyyyyyYYY!!YYV.',
  '.VYYYYYYyyyY!!!!hyyyyYYYYY!hYYV.',
  '.VYYYYYYyyyyYYYhyyyYYYYYYYYVVV..',
  '.VYYYYYYyyyyyyyyYYYYYYYYYVV.....',
  '.VYYYYYYyyyyyyYYYYY!hYVVV.......',
  '.VYYYYYYyy!!YYYYYYY!VV..........',
  '.VYYYYYYyY!hYYYYYVVV............',
  '..VVYYYYYYYYYYVVV...............',
  '....VYYYYYYYVV..................',
  '.....VVYYVVV....................',
  '.......VV.......................',
  '................................',
];

// The Hamster Maze: a hedge-green machine with a maze on its front (the Pouch Palace's frame, recoloured).
const machineMaze = [
  '...GG..GG..GG..GG..GG...',
  '..GiGGGiGGGiGGGiGGGiGG..',
  '.HHHHHHHHHHHHHHHHHHHHHH.',
  '.HiiiiiiiiiiiiiiiiiiiGH.',
  '.HiGVVVVVVVVVVVVVVVVGgH.',
  '.HiGVhyyyyyyyyyyyyYVGgH.',
  '.HiGVVVVVVVVVVVVVVVVGgH.',
  '.HiGGiGGiGGiGGiGGiGGGgH.',
  '.HiGHHHHHHHHHHHHHHHHGgH.',
  '.HiGHwwqwwqwwqwwqwwHGgH.',
  '.HiGHuzqrexyhqtaqpFHGgH.',
  '.HiGHuIqrRqYyqtAqpPHGgH.',
  '.HiGHqqqqqqqqqqqqqqHGgH.',
  '.HiGHyyqdLquuqrrqttHGgH.',
  '.HiGHhYqddqzIqeRqaTHGgH.',
  '.HiGHwwqwwqwwqwwqwwHGgH.',
  '.HiGHHHHHHHHHHHHHHHHGgH.',
  '.HiGHHHHHGHHHHHHGHHHGgH.',
  '.HiGGGGHGGGHGGGGHGGHGgH.',
  '.HiGHHGHGHHHGHHGHHGHGgH.',
  '.HiGHGGGGGGGHGGGGGGGGgH.',
  '.HiGHHHHHHHHHHHHHHHHGgH.',
  '.HggggggggggggggggggggH.',
  '.HHHHHHHHHHHHHHHHHHHHHH.',
];

// The Acorn Vault: brushed steel with a gold vault handle.
const machineVault = [
  '..........KQQK..........',
  '.........KqwwqK.........',
  '.KKKKKKKKKKKKKKKKKKKKKK.',
  '.KwwwwwwwwwwwwwwwwwwwqK.',
  '.KwqVVVVVVVVVVVVVVVVqQK.',
  '.KwqVhyyyyyyyyyyyyYVqQK.',
  '.KwqVVVVVVVVVVVVVVVVqQK.',
  '.KwqqyyqqqqqqqqqyyqqqQK.',
  '.KwqKKKKKKKKKKKKKKKKqQK.',
  '.KwqKwwqwwqwwqwwqwwKqQK.',
  '.KwqKuzqrexyhqtaqpFKqQK.',
  '.KwqKuIqrRqYyqtAqpPKqQK.',
  '.KwqKqqqqqqqqqqqqqqKqQK.',
  '.KwqKyyqdLquuqrrqttKqQK.',
  '.KwqKhYqddqzIqeRqaTKqQK.',
  '.KwqKwwqwwqwwqwwqwwKqQK.',
  '.KwqKKKKKKKKKKKKKKKKqQK.',
  '.KwqqqqqqKKKKKKqqqqqqQK.',
  '.KwqqqqqKyyyyyyKqqqqqQK.',
  '.KwqqqqqKyhVVYyKqqqqqQK.',
  '.KwqqqqqKYYYYYYKqqqqqQK.',
  '.KwqqqqqqKKKKKKqqqqqqQK.',
  '.KQQQQQQQQQQQQQQQQQQQQK.',
  '.KKKKKKKKKKKKKKKKKKKKKK.',
];

// The Big Cheese: a cheese-yellow machine with holes, a tan sign and a red wax seal on top.
const machineCheese = [
  '..........VrrV..........',
  '.........VreerV.........',
  '.VVVVVVVVVVVVVVVVVVVVVV.',
  '.VhhhhhhhhhhhhhhhhhhhyV.',
  '.VhyUUUUUUUUUUUUUUUUyYV.',
  '.VhyUxnnnnnnnnnnnnxUyYV.',
  '.VhyUUUUUUUUUUUUUUUUyYV.',
  '.VhyYVYyyYVYyyyYVYyyYYV.',
  '.VhyVVVVVVVVVVVVVVVVyYV.',
  '.VhyVwwqwwqwwqwwqwwVyYV.',
  '.VhyVuzqrexyhqtaqpFVyYV.',
  '.VhyVuIqrRqYyqtAqpPVyYV.',
  '.VhyVqqqqqqqqqqqqqqVyYV.',
  '.VhyVyyqdLquuqrrqttVyYV.',
  '.VhyVhYqddqzIqeRqaTVyYV.',
  '.VhyVwwqwwqwwqwwqwwVyYV.',
  '.VhyVVVVVVVVVVVVVVVVyYV.',
  '.VhyyyYYyyyyyyyyYYyyyYV.',
  '.VhyyYVVYyyVVVVyVVYyyYV.',
  '.VhyyYVVYyyVDDVyVVYyyYV.',
  '.VhyyyYYyyyVVVVyyYYyyYV.',
  '.VhyyyyyyyyyyyyyyyyyyYV.',
  '.VYYYYYYYYYYYYYYYYYYYYV.',
  '.VVVVVVVVVVVVVVVVVVVVVV.',
];

// Sticky Paws (more respins): a small acorn.
const acornIcon = [
  '................',
  '.......UU.......',
  '...UUUUNNUUUU...',
  '..UnxnnxnnxnNU..',
  '.UnxnnxnnxnnNNU.',
  '.UUUUUUUUUUUUUU.',
  '..VyhhyyyyyyYV..',
  '..VyhwyyyyyYYV..',
  '...VyhyyyyyYV...',
  '...VyyyyyyYYV...',
  '....VyyyyYYV....',
  '.....VyyYYV.....',
  '......VYYV......',
  '.......VV.......',
  '................',
  '................',
];

// Aged Cheese (a stronger cheese wheel): a small wedge.
const cheeseIcon = [
  '................',
  '................',
  '...........VV...',
  '........VVVhV...',
  '.....VVVhhhyV...',
  '..VVVhhhhhyYV...',
  '.VhhhhhhhyyYV...',
  '.VVVVVVVVVVVV...',
  '.VyyYYyyyyyYV...',
  '.VyYVVYyYYyYV...',
  '.VyyYYyyYVYYV...',
  '.VyyyyyyyYYyV...',
  '.VyyYYyyyyyYV...',
  '.VYYYYYYYYYYV...',
  '.VVVVVVVVVVVV...',
  '................',
];

// ── 1.3.1 (Nuts & Bolts): icons for the new upgrades and traits (16×16) ──
// Lucky Pennies: two copper pennies and a sparkle (the carrot ramp is copper enough).
const pennies = [
  '................',
  '...h....JJJJJ...',
  '..hwh..JjjjooJ..',
  '...h..JjjOOOooJ.',
  '......JjOojooOJ.',
  '......JjOjooOOJ.',
  '...JJJJJOoooOOJ.',
  '..JjjjooJOOOOOJ.',
  '.JjjOOOooJOOOJ..',
  '.JjOojooOJJJJ...',
  '.JjOjooOOJ......',
  '.JoOoooOOJ......',
  '.JooOOOOOJ......',
  '..JooOOOJ.......',
  '...JJJJJ........',
  '................',
];
// The Penny Jar and the Tip Jar: a glass jar with a tan lid, pennies at the bottom.
const jar = [
  '................',
  '.....UUUUUU.....',
  '....UxxxnnNU....',
  '....UnnnnNNU....',
  '...WWWWWWWWWW...',
  '..WvwvvvvvvvbW..',
  '..WvwvvvvvvvbW..',
  '..WvwvvvvvvvbW..',
  '..WvvvvvvvvvbW..',
  '..WvvvJJJJvvbW..',
  '..WvvJjooOJvbW..',
  '..WJJJJOOJJJJW..',
  '..WJjooJJjooOW..',
  '..WJOOOJJOOOJW..',
  '...WWWWWWWWWW...',
  '................',
];
// Night Shift: a gold crescent moon and a star.
const moon = [
  '................',
  '.....VVVV.......',
  '...VVhhhV...h...',
  '..VhhhVV...hwh..',
  '..VhhV......h...',
  '.VhhV...........',
  '.VhyV...........',
  '.VhyV........h..',
  '.VhyyV..........',
  '.VyyyV.......VV.',
  '..VyyyVV...VVYV.',
  '..VyyyyyVVVYYYV.',
  '...VyyyyyYYYYV..',
  '....VVYYYYYVV...',
  '......VVVVV.....',
  '................',
];
// The Cosy Nest: a twiggy nest with a pink blanket, and a sleepy "z".
const nest = [
  '................',
  '..........WWWW..',
  '............W...',
  '...........W....',
  '..........WWWW..',
  '....ZZZZZZZZ....',
  '...ZpFFpppppZ...',
  '..ZpFppppppPPZ..',
  '.UUZZZZZZZZZZUU.',
  'UxnxnnxnnxnnNnNU',
  'UnNnnNnnNnnNnNNU',
  '.UnnxnnNnnNnNNU.',
  '..UNnnNnnNNNNU..',
  '...UUNNNNNNUU...',
  '.....UUUUUU.....',
  '................',
];
// Running Shoes: a red running shoe with white laces and sole.
const shoe = [
  '................',
  '................',
  '................',
  '....XXXX........',
  '...XeeerX.......',
  '...XerrrX.......',
  '...XrwrrXX......',
  '...XrrwrrrXX....',
  '..XerwrwrrrrXX..',
  '..XerrrrrrrrrRX.',
  '..XrrrrrrrrrRRX.',
  '.KKKKKKKKKKKKKKK',
  '.KwwwwwwwwwwwqqK',
  '..KKKKKKKKKKKKK.',
  '................',
  '................',
];
// The Coupon Book: a paper coupon with a dotted tear line and a gold coin.
const coupon = [
  '................',
  '................',
  '................',
  '..KKKKKKKKKKKK..',
  '.KwwwwwKwwwwwqK.',
  '.KwrrwwwwwVVwqK.',
  'KwwrwwwKwVhyVqqK',
  'KwwwrwwwwVyYVqqK',
  'KwwrwrwKwVyYVqqK',
  '.KwwwrwwwwVVwqK.',
  '.KwqqqqKqqqqqqK.',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
  '................',
  '................',
];
// The Sticker Album: a blue book with a gold star sticker on its cover.
const album = [
  '................',
  '...WWWWWWWWWW...',
  '..WSvvvvvvvvbW..',
  '..WSvbbbbbbbbW..',
  '..WSvbbbVbbbbW..',
  '..WSvbbVhVbbbW..',
  '..WSvVVhyVVVbW..',
  '..WSbVhyyyYVbW..',
  '..WSbbVyYYVbBW..',
  '..WSbbVYVYVbBW..',
  '..WSbbVVbVVBBW..',
  '..WSbbbbbbBBBW..',
  '..WSWWWWWWWWWW..',
  '..WSqqqqqqqqqK..',
  '...WKKKKKKKKKK..',
  '................',
];
// Helping Paws: a pink paw print (the helper's).
const paw = [
  '................',
  '................',
  '....ZZ....ZZ....',
  '...ZFpZ..ZFpZ...',
  '...ZppZ..ZppZ...',
  '.ZZ.ZZ....ZZ.ZZ.',
  'ZFpZ........ZFpZ',
  'ZppZ..ZZZZ..ZppZ',
  '.ZZ..ZFFppZ..ZZ.',
  '....ZFppppPZ....',
  '...ZFppppppPZ...',
  '...ZppppppPPZ...',
  '...ZpppppPPPZ...',
  '....ZPPPPPPZ....',
  '.....ZZZZZZ.....',
  '................',
];
// Deep Roots: a sapling above the ground, its roots spreading out below.
const roots = [
  '.....HHHHH......',
  '....HiiGGGH.....',
  '...HiiGGGGgH....',
  '..HiGGGGGgggH...',
  '..HGGGGGggggH...',
  '...HgggggggH....',
  '....HHUnUHH.....',
  '......UnU.......',
  '......UnNU......',
  'GGGGGGUnNUGGGGGG',
  'NNNNNUnNNUNNNNNN',
  'NNNNUNUnNUNUNNNN',
  'NNNUNNUNNNUNUNNN',
  'NNUNNUNNNNNUNUNN',
  'NNNNNNNNNNNNNNNN',
  '................',
];

// ── 1.4.0: The Great Migration ──
// The Moving Box (Moving Day's mystery symbol): a taped cardboard box with a "?".
const box = [
  '................................',
  '................................',
  '................................',
  '...............UU...............',
  '.............UUxxUU.............',
  '...........UUxxxxxxUU...........',
  '........UUUxxxxxxxxxxUUU........',
  '......UUxxqxxxxxxxxxxxxxUU......',
  '....UUxxxxQqqxxxxxxxxxxxxxUU....',
  '...UxxxxxxxQQqqxxxxxxxxxxxxxU...',
  '..UxxxxxxxxxxQQqqxxxxxxxxxxxNU..',
  '..UnnxxxxxxxxxxQQqqxxxxxxxNNNU..',
  '..UnnnnxxxxxxxxxxQQqqxxxNNNNNU..',
  '..UnnnnnnxxxxxxxxxxQQqqNNNNNNU..',
  '..UnnnnnnUUxxxxxxxxNNQQNNNNNNU..',
  '..UnnnnnUnnUnxxxxNNNNNNNNNNNNU..',
  '..UnnnnnnnnUnnnx*NNNNNNNNNNNNU..',
  '..UnnnnnnnUnnnnn*NNNNNNNNNNNNU..',
  '..UnnnnnnUnnnnnn*NNNNNNNNNNNNU..',
  '..UnnnnnnUnnnnnn*NNNNNNNNNNNNU..',
  '..Unnnnnnnnnnnnn*NNNNNNNNNNNNU..',
  '..Unnnnnnnnnnnnn*NNNNNNNNNNNNU..',
  '..UnnnnnnUnnnnnn*NNNNNNNNNNNNU..',
  '..Unnnnnnnnnnnnn*NNNNNNNNNNNNU..',
  '...Unnnnnnnnnnnn*NNNNNNNNNNNU...',
  '....UUnnnnnnnnnn*NNNNNNNNNUU....',
  '......UUnnnnnnnn*NNNNNNNUU......',
  '........UUUnnnnn*NNNNUUU........',
  '...........UUnnn*NNUU...........',
  '.............UUn*UU.............',
  '...............UU...............',
  '................................',
];

// Moving Day: a big cardboard box with a blue label, a taped lid and a carrying slot.
const machineMoving = [
  '..........UqqU..........',
  '.........UxqQnU.........',
  '.UUUUUUUUUUUUUUUUUUUUUU.',
  '.UxxxxxxxxxxxxxxxxxxxnU.',
  '.UxnWWWWWWWWWWWWWWWWnNU.',
  '.UxnWvbbbbbbbbbbbbBWnNU.',
  '.UxnWWWWWWWWWWWWWWWWnNU.',
  '.UxnnnnnnnnqQnnnnnnnnNU.',
  '.UxnUUUUUUUUUUUUUUUUnNU.',
  '.UxnUwwqwwqwwqwwqwwUnNU.',
  '.UxnUuzqrexyhqtaqpFUnNU.',
  '.UxnUuIqrRqYyqtAqpPUnNU.',
  '.UxnUqqqqqqqqqqqqqqUnNU.',
  '.UxnUyyqdLquuqrrqttUnNU.',
  '.UxnUhYqddqzIqeRqaTUnNU.',
  '.UxnUwwqwwqwwqwwqwwUnNU.',
  '.UxnUUUUUUUUUUUUUUUUnNU.',
  '.UxnnnnnnnnnnnnnnnnnnNU.',
  '.UxnnnnnnUUUUUUnnnnnnNU.',
  '.UxnnnnnnnNNNNnnnnnnnNU.',
  '.UxnnnnnnnnnnnnnnnnnnNU.',
  '.UxnnnnnnnnnnnnnnnnnnNU.',
  '.UNNNNNNNNNNNNNNNNNNNNU.',
  '.UUUUUUUUUUUUUUUUUUUUUU.',
];

// Bubble Wrap and Moving Boxes (more boxes): a small taped box.
const boxIcon = [
  '................',
  '................',
  '..UUUUUUUUUUUU..',
  '.UxxxxxqQxxxxnU.',
  '.UxnnnnqQnnnnNU.',
  '.UUUUUUqQUUUUUU.',
  '.UxnnnnqQnnnnNU.',
  '.UxnnnnnnnnnnNU.',
  '.UxnnnnnnnnnnNU.',
  '.UxnnnUUUUnnnNU.',
  '.UxnnnnNNnnnnNU.',
  '.UxnnnnnnnnnnNU.',
  '.UNNNNNNNNNNNNU.',
  '..UUUUUUUUUUUU..',
  '................',
  '................',
];

// Golden Whiskers (the colony's currency, 12×12) and Whisker Wisdom (16×16): golden whiskers by a pink nose.
const whisker = [
  '..........h.',
  '........VyY.',
  '......VyYV..',
  '....VyYV....',
  '.ZZVyYV.....',
  'ZpPVyyyyyyyh',
  '.ZZVyYV.....',
  '....VyYV....',
  '......VyYV..',
  '........VyY.',
  '..........h.',
  '............',
];

const whiskerIcon = [
  '................',
  '.............Vh.',
  '...........VyY..',
  '.........VyYV...',
  '.......VyYV.....',
  '..ZZ.VyYV.......',
  '.ZppZV..........',
  'ZpppPVyyyyyyyyh.',
  '.ZPPZV..........',
  '..ZZ.VyYV.......',
  '.......VyYV.....',
  '.........VyYV...',
  '...........VyY..',
  '.............Vh.',
  '................',
  '................',
];

// Takings (the Family Casino's currency, M12, 12×12): a red velvet sack tied with
// gold cord, a gold coin showing at the front.
const takings = [
  '....X..X....',
  '...XeXXeX...',
  '....XrrX....',
  '....VyyV....',
  '...XerrRX...',
  '..XerrrrRX..',
  '.XerrhyrrRX.',
  '.XrrhyyVrRX.',
  '.XrryyYVrRX.',
  '.XRrrVVrRRX.',
  '..XRRRRRRX..',
  '...XXXXXX...',
];

// The Wise Elders (automation): an old hamster's spectacles.
const glasses = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..KKKK....KKKK..',
  '.KvvvbK..KvvvbK.',
  'KKvvbbKKKKvvbbKK',
  '.KvbbBK..KvbbBK.',
  '..KKKK....KKKK..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ── The Big Cage's meadow (1.5.0): a butterfly (two wingbeats) and a bird (two flaps), 12×12 ──
const butterfly = [
  '....k..k....',
  '.ZZZ.kk.ZZZ.',
  'ZpppZ..ZpppZ',
  'ZpFppZZppFpZ',
  'ZpppppppppPZ',
  '.ZpppkkpppZ.',
  '..ZZpkkpZZ..',
  '..ZppkkppZ..',
  '..ZpPkkPpZ..',
  '...ZZ..ZZ...',
  '............',
  '............',
];
const butterfly2 = [
  '............',
  '....k..k....',
  '.....kk.....',
  '...ZZkkZZ...',
  '..ZpFkkFpZ..',
  '..ZppkkppZ..',
  '...ZpkkpZ...',
  '...ZpkkpZ...',
  '....ZkkZ....',
  '.....kk.....',
  '............',
  '............',
];
const bird = [
  '............',
  '.S........S.',
  '.SS......SS.',
  '..SI....IS..',
  '...SI..IS...',
  '....SIIS....',
  '.....SS.....',
  '............',
  '............',
  '............',
  '............',
  '............',
];
const bird2 = [
  '............',
  '............',
  '............',
  '............',
  '....SIIS....',
  '..SSI..ISS..',
  '.SS......SS.',
  '.S........S.',
  '............',
  '............',
  '............',
  '............',
];

// ── 1.6.0 (New Digs): UI icons (16×16) ──
// A padlock (locked upgrades, the Locked drawer): a grey shackle on a gold body with a keyhole.
const lock = [
  '................',
  '.....KKKKKK.....',
  '....KQqqqqQK....',
  '...KQK....KQK...',
  '...KQK....KQK...',
  '...KQK....KQK...',
  '..VVVVVVVVVVVV..',
  '..VhhhhhhhhhhV..',
  '..VhyyyyyyyyYV..',
  '..VyyyykkyyyYV..',
  '..VyyyykkyyyYV..',
  '..VyyyyykyyyYV..',
  '..VyyyyykyyyYV..',
  '..VYYYYYYYYYYV..',
  '...VVVVVVVVVV...',
  '................',
];
// 1.9.0: the padlock springing open (unlock.ts): the shackle lifts, its right leg out of the body.
const lockOpen = [
  '.....KKKKKK.....',
  '....KQqqqqQK....',
  '...KQK....KQK...',
  '...KQK....KKK...',
  '...KQK..........',
  '...KQK..........',
  '..VVVVVVVVVVVV..',
  '..VhhhhhhhhhhV..',
  '..VhyyyyyyyyYV..',
  '..VyyyykkyyyYV..',
  '..VyyyykkyyyYV..',
  '..VyyyyykyyyYV..',
  '..VyyyyykyyyYV..',
  '..VYYYYYYYYYYV..',
  '...VVVVVVVVVV...',
  '................',
];
// 1.9.0: the guide's pointing paw (guide.ts): the hamster's arm reaching down, toes with pink pads.
const guidePaw = [
  '.....AAAAAA.....',
  '....AaattttA....',
  '....AattttTA....',
  '....AattttTA....',
  '....AattttTA....',
  '...AaattttTTA...',
  '..AaatttttTTTA..',
  '..AattttttttTA..',
  '..AattttttttTA..',
  '..AtttttttttTA..',
  '..AcccccccccCA..',
  '..AcccccccccCA..',
  '..AcppAppAppCA..',
  '...AZZAZZAZZA...',
  '................',
  '................',
];
// The tabs' and the HUD's icons (16×16): a capsule (the Capsules tab), a die (the Casino tab),
// the Menu's bars and the sound switch (on: waves; off: a red cross).
const capsule16 = [
  '................',
  '.....WWWWWW.....',
  '....WvvbbbbW....',
  '...WvbbbbbbBW...',
  '..WvbbbbbbbbBW..',
  '..WbbbbbbbbbBW..',
  '..WBBBBBBBBBBW..',
  '..KKKKKKKKKKKK..',
  '..KwwwwwwwwwqK..',
  '..KwwwwwwwwwqK..',
  '..KwwwwwwwwqqK..',
  '...KqqqqqqqqK...',
  '....KQQQQQQK....',
  '.....KKKKKK.....',
  '................',
  '................',
];
const die16 = [
  '................',
  '..KKKKKKKKKKKK..',
  '.KwwwwwwwwwwwqK.',
  '.KwrrwwwwwwrrqK.',
  '.KwrrwwwwwwrrqK.',
  '.KwwwwwwwwwwwqK.',
  '.KwwwwwrrwwwwqK.',
  '.KwwwwwrrwwwwqK.',
  '.KwwwwwwwwwwwqK.',
  '.KwrrwwwwwwrrqK.',
  '.KwrrwwwwwwrrqK.',
  '.KwwwwwwwwwwwqK.',
  '.KqqqqqqqqqqqQK.',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
];
const menu16 = [
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];
const soundOn = [
  '................',
  '................',
  '.......k........',
  '......kk...k....',
  '.....kkk....k...',
  '.kkkkkkk.k...k..',
  '.kkkkkkk..k..k..',
  '.kkkkkkk..k..k..',
  '.kkkkkkk..k..k..',
  '.kkkkkkk.k...k..',
  '.....kkk....k...',
  '......kk...k....',
  '.......k........',
  '................',
  '................',
  '................',
];
const soundOff = [
  '................',
  '................',
  '.......k........',
  '......kk........',
  '.....kkk........',
  '.kkkkkkk.r...r..',
  '.kkkkkkk..r.r...',
  '.kkkkkkk...r....',
  '.kkkkkkk..r.r...',
  '.kkkkkkk.r...r..',
  '.....kkk........',
  '......kk........',
  '.......k........',
  '................',
  '................',
  '................',
];
// A close cross (the sheet's close button).
const close = [
  '................',
  '................',
  '..kk........kk..',
  '..kkk......kkk..',
  '...kkk....kkk...',
  '....kkk..kkk....',
  '.....kkkkkk.....',
  '......kkkk......',
  '......kkkk......',
  '.....kkkkkk.....',
  '....kkk..kkk....',
  '...kkk....kkk...',
  '..kkk......kkk..',
  '..kk........kk..',
  '................',
  '................',
];

export const SPRITES: Record<string, string[]> = {
  seed, golden, carrot, blueberry, strawberry, wild, ball, pouch24, corn, apple,
  hamster, hamsterRun1, hamsterRun2, hamsterRun3, hamsterRun4, hamsterBlink, hamsterSleep, hamsterCheer, coin, chip, token, heirloom, capsule, capsuleRare, capsuleEpic, gacha,
  cheeks, wheel, oilcan, gear, reel, paylinesIcon, heart, star, bolt, scooter, backpack, parcel, pouch, goldenIcon, carrotIcon,
  machineClunky, machineStacker, machineBonanza, machinePalace, bottle, bowl, bedding,
  highRollerIcon, flame, wildIcon, ballIcon, pouchPolish,
  shaving, clover, horseshoe, seedPacket, cardBack, suitHearts, suitDiamonds, suitClubs, suitSpades, bothWaysIcon, snackIcon,
  goldAcorn, cheese, machineMaze, machineVault, machineCheese, acornIcon, cheeseIcon,
  pennies, jar, moon, nest, shoe, coupon, album, paw, roots, // 1.3.1
  box, machineMoving, boxIcon, whisker, whiskerIcon, glasses, // 1.4.0
  butterfly, butterfly2, bird, bird2, // 1.5.0
  lock, close, capsule16, die16, menu16, soundOn, soundOff, // 1.6.0
  lockOpen, guidePaw, // 1.9.0
  takings, // M12
  frameCard, framePaper, frameTab, frameButton, frameRail, bubbleTail,
};

// ── Hats (M10): worn on the hamster's head ──
// Each hat is a small picture plus where its top-left pixel goes on the 32×32 hamster
// standing (1.5.0: redrawn bigger for the new hamster; the near ear is at x 17–21, the
// top of the head at x 21–27, row 8). Frames where the head bobs move the hat with it
// (HAMSTER_BOB). Hats only use colours fur skins never change (no t T a A % c C p P Z),
// so a hat looks the same on every fur.
export const HATS: Record<string, { rows: string[]; x: number; y: number }> = {
  hatParty: { x: 18, y: 0, rows: [ // a party cone: blue with gold stripes and a pompom
    '....h....',
    '...hwh...',
    '...WhW...',
    '...WbW...',
    '..WyyYW..',
    '..WbbBW..',
    '.WbvbbBW.',
    '.WyyyyYW.',
    'WbvbbbbBW',
    'WWWWWWWWW',
  ] },
  hatBeanie: { x: 17, y: 3, rows: [ // a mint knitted beanie with a bobble and a ribbed rim
    '....ff....',
    '...EffE...',
    '..EmmmmE..',
    '.EmfmmmME.',
    'EmfmmmmmME',
    'EmmmmmmMME',
    'EfEfEfEMEE',
  ] },
  hatFlowers: { x: 17, y: 6, rows: [ // a ring of little flowers
    '.e...h...z.',
    'eXe.hVh.zSz',
    'GeGGGhGGGzG',
  ] },
  hatTop: { x: 17, y: 0, rows: [ // a charcoal top hat with a red band
    '..DDDDDDD..',
    '..DLlddsD..',
    '..DlddddD..',
    '..DlddddD..',
    '..DldddsD..',
    '..DrrrRRD..',
    'DDDddddsDDD',
    'DlddddddssD',
    '.DDDDDDDDD.',
  ] },
  hatCowboy: { x: 15, y: 2, rows: [ // a tan cowboy hat, its brim curling up
    '.....UUU.....',
    '....UxnnU....',
    '...UxnnnNU...',
    '...UNNNNNU...',
    'UU.UnnnnNU.UU',
    'UxUnnnnnnnUNU',
    '.UxnnnnnnnNU.',
    '..UUUUUUUUU..',
  ] },
  hatVisor: { x: 17, y: 6, rows: [ // M11: the casino dealer's green visor, its brim over the eyes
    '.HHHHHHH....',
    'HiiGGGGGH...',
    'HGGGGGGGgH..',
    '.HHgggggGiH.',
    '......HHHHH.',
  ] },
  hatCrown: { x: 18, y: 2, rows: [ // a gold crown with a ruby and a sapphire
    'h...h...h',
    'V..VhV..V',
    'Vh.VyV.hV',
    'VyVyyyVyV',
    'VyyyyyyYV',
    'VrYuYyYrV',
    'VVVVVVVVV',
  ] },
};

// The hamster's frames, and how far each one's head is bobbed from standing (rows).
export const HAMSTER_BOB: Record<string, number> = {
  hamster: 0, hamsterRun1: 0, hamsterRun2: -1, hamsterRun3: 0, hamsterRun4: -1, hamsterBlink: 0, hamsterSleep: 1, hamsterCheer: -2,
};
export type HamsterFrame = keyof typeof HAMSTER_BOB;
// The run, step by step.
export const HAMSTER_RUN: HamsterFrame[] = ['hamsterRun1', 'hamsterRun2', 'hamsterRun3', 'hamsterRun4'];
// The run's frame at a moment: `stepMs` milliseconds a step (faster = a quicker run).
export const runFrame = (now: number, stepMs = 90): HamsterFrame => HAMSTER_RUN[Math.floor(now / stepMs) % HAMSTER_RUN.length];

// A hamster frame with a hat on: the hat's pixels drawn over the hamster's.
function withHat(base: string[], hat: { rows: string[]; x: number; y: number }, dy: number): string[] {
  return base.map((row, y) => [...row].map((ch, x) => {
    const r = hat.rows[y - hat.y - dy];
    const top = r && x >= hat.x ? r[x - hat.x] : undefined;
    return top && top !== '.' ? top : ch;
  }).join(''));
}
// Registered as sprites ("hamster.hatParty", "hamsterRun2.hatParty" …), so every place
// that draws the hamster can draw it with its hat, fur colours and all.
for (const [id, hat] of Object.entries(HATS)) {
  for (const [frame, dy] of Object.entries(HAMSTER_BOB)) SPRITES[`${frame}.${id}`] = withHat(SPRITES[frame], hat, dy);
}

// The sprite name for a hamster frame wearing a hat (null or an unknown hat = none).
export function hamsterSprite(frame: HamsterFrame | string, hat: string | null): string {
  return hat && HATS[hat] ? `${frame}.${hat}` : frame;
}

// Which sprite to draw for each card suit id (from game.ts SUITS).
export const SUIT_SPRITES: Record<string, string> = { hearts: 'suitHearts', diamonds: 'suitDiamonds', clubs: 'suitClubs', spades: 'suitSpades' };

// Which capsule sprite to draw for each capsule rarity id (from data.json).
export const CAPSULE_SPRITES: Record<string, string> = { common: 'capsule', rare: 'capsuleRare', epic: 'capsuleEpic' };

// Which sprite to draw for each slot symbol id (from data.json).
// A symbol without an entry falls back to a letter tile, so new symbols still work.
export const SYMBOL_SPRITES: Record<string, string> = {
  seed: 'seed', carrot: 'carrot', golden: 'golden', blueberry: 'blueberry', strawberry: 'strawberry',
  wild: 'wild', ball: 'ball', pouch: 'pouch24', corn: 'corn', apple: 'apple', blank: 'shaving',
  goldAcorn: 'goldAcorn', cheese: 'cheese', // M9
  box: 'box', // 1.4.0: Moving Day's boxes
};

// Which sprite to draw for each machine id (from data.json), e.g. on the machine cards.
export const MACHINE_SPRITES: Record<string, string> = {
  clunky: 'machineClunky', stacker: 'machineStacker', bonanza: 'machineBonanza', palace: 'machinePalace',
  maze: 'machineMaze', vault: 'machineVault', cheese: 'machineCheese', // M9
  moving: 'machineMoving', // 1.4.0
};

// Upgrade icons: by upgrade id first, then by effect type, so a new upgrade
// of an existing type gets a sensible icon automatically.
const UPGRADE_ICONS_BY_ID: Record<string, string> = {
  cheeks: 'cheeks', wheel: 'wheel', lever: 'oilcan', thirdReel: 'reel', gears: 'gear', paylines: 'paylinesIcon', fourthReel: 'reel',
  tunnelGrease: 'oilcan', velvetGears: 'gear',
  clover: 'clover', // Hamster Luck is the clover; every Machine Luck upgrade is a horseshoe (by type, below)
  // 1.3.1
  couponBook: 'coupon', moneyBags: 'pouch', lineDance: 'paylinesIcon', goldenTouch: 'goldenIcon', deepPockets: 'pouchPolish',
  bubbleWrap: 'boxIcon', // 1.4.0: Moving Day
};
const UPGRADE_ICONS_BY_TYPE: Record<string, string> = {
  payoutMultiplier: 'cheeks', autoSpin: 'wheel', spinCostMultiplier: 'oilcan', extraReel: 'reel', extraPayline: 'paylinesIcon',
  betSteps: 'highRollerIcon', winStreak: 'flame', symbolWeight: 'wildIcon', extraFreeSpins: 'ballIcon', jackpotGrowth: 'pouchPolish',
  luck: 'horseshoe', unlockSymbol: 'seedPacket', bothWays: 'bothWaysIcon',
  extraRespins: 'acornIcon', wheelBonus: 'cheeseIcon', // M9
  // 1.3.1
  doubleWin: 'pennies', offlineBonus: 'moon', offlineTime: 'nest', spinSpeed: 'shoe', stickerPayout: 'album', starPayout: 'star',
  streakCap: 'flame', fullLineMultiplier: 'star', jackpotTokens: 'goldenIcon', deliveryTokens: 'jar', gambleHistory: 'cardBack',
  potSeedBonus: 'pouchPolish', generationPayout: 'roots', autoBuy: 'paw',
  zoomies: 'shoe', stickyWilds: 'wildIcon', freeSpinClimb: 'ballIcon', // 1.10.0: Burrow Party
};
export function upgradeIcon(def: { id: string; effect: { type: string } }): string | null {
  return UPGRADE_ICONS_BY_ID[def.id] || UPGRADE_ICONS_BY_TYPE[def.effect.type] || null;
}

// Family tree icons work the same way: by node id, then by effect type.
const TREE_ICONS_BY_ID: Record<string, string> = {
  familyPride: 'heart', familyFortune: 'pouch', luckyWhiskers: 'goldenIcon', carrotPatch: 'carrotIcon',
  warmUpLaps: 'wheel', heirloomReel: 'reel',
  // M8
  bigSpender: 'highRollerIcon', luckyHeirlooms: 'horseshoe', seedVault: 'seedPacket',
  // 1.3.1
  cloverHeirloom: 'clover', pennyJar: 'jar',
  // 1.4.0: the colony traits
  movingBoxes: 'boxIcon', whiskerWisdom: 'whiskerIcon', packLeader: 'heart', starryRoots: 'star',
};
const TREE_ICONS_BY_TYPE: Record<string, string> = {
  payoutMultiplier: 'heart', shiftWeight: 'goldenIcon', fullLineMultiplier: 'star', startingLevel: 'wheel',
  spinSpeed: 'bolt', deliveryTime: 'scooter', deliveryPayoutBonus: 'backpack', autoDelivery: 'parcel',
  // M8
  seedJar: 'pouch', luck: 'clover', startingMachineLevel: 'seedPacket', startingMachine: 'snackIcon',
  symbolWeight: 'ballIcon', potSeedBonus: 'pouchPolish',
  // 1.3.1
  autoBuy: 'paw', generationPayout: 'roots', doubleWin: 'pennies',
};
export function treeIcon(def: { id: string; effect: { type: string } }): string | null {
  return TREE_ICONS_BY_ID[def.id] || TREE_ICONS_BY_TYPE[def.effect.type] || null;
}

// Colony perks (1.4.0) by effect type.
const PERK_ICONS_BY_TYPE: Record<string, string> = {
  payoutMultiplier: 'heart', seedGain: 'seedPacket', autoRetire: 'glasses', startingMachine: 'snackIcon', maxStars: 'star',
};
export function perkIcon(def: { id: string; effect: { type: string } }): string | null {
  return PERK_ICONS_BY_TYPE[def.effect.type] || null;
}

// ── Drawing (browser only; everything above also loads fine in Node for tests) ──

const urlCache = new Map<string, string>();

// Paint a sprite onto a canvas once and cache the resulting image URL.
// `colors` (optional) swaps palette letters for this drawing only, e.g.
// { t: '#d9895a' } paints the hamster's fur cinnamon. This is how fur skins work.
export function spriteURL(name: string, colors: Colors | null = null): string | null {
  const key = colors ? `${name}|${JSON.stringify(colors)}` : name;
  if (urlCache.has(key)) return urlCache.get(key)!;
  const rows = SPRITES[name];
  if (!rows) return null;
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const colour = (colors && colors[ch]) || PALETTE[ch];
      if (!colour) return; // "." or unknown = transparent
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  const url = canvas.toDataURL();
  urlCache.set(key, url);
  return url;
}

// A sprite painted at 1× on its own little canvas (cached), for code that draws
// it itself: the particles (fx.ts) draw coins, stars and seeds this way, scaled
// up by a whole number with smoothing off, so they stay crisp pixel art.
const canvasCache = new Map<string, HTMLCanvasElement>();
export function spriteCanvas(name: string): HTMLCanvasElement | null {
  if (canvasCache.has(name)) return canvasCache.get(name)!;
  const rows = SPRITES[name];
  if (!rows) return null;
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!PALETTE[ch]) return;
      ctx.fillStyle = PALETTE[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  canvasCache.set(name, canvas);
  return canvas;
}

// Sizes are asked for in CSS pixels, but a sprite is only ever scaled by a WHOLE
// number, so every pixel stays a crisp square: the biggest whole scale that fits.
// e.g. a 24-pixel sprite asked for at 48 → 2×; at 40 → 1× (24 px).
export function spriteScale(name: string, size: number): number {
  const rows = SPRITES[name];
  return rows ? Math.max(1, Math.floor(size / rows[0].length)) : 1;
}

// An <img> of a sprite about `size` CSS pixels wide.
// Missing sprite → a letter tile, so the game never shows a broken image.
export function spriteImg(name: string | null | undefined, size = 48, fallbackText = '?', colors: Colors | null = null): HTMLImageElement | HTMLSpanElement {
  const url = name ? spriteURL(name, colors) : null;
  if (!url) {
    const tile = document.createElement('span');
    tile.className = 'sprite-fallback';
    tile.textContent = fallbackText;
    return tile;
  }
  const rows = SPRITES[name!];
  const scale = spriteScale(name!, size);
  const img = new Image(rows[0].length * scale, rows.length * scale);
  img.src = url;
  img.alt = '';
  img.draggable = false;
  img.className = 'sprite';
  return img;
}

// Fill an existing <img> in the HTML (e.g. <img data-sprite="coin" data-size="24">).
export function applySprite(img: HTMLImageElement, name: string, size = 48, colors: Colors | null = null): void {
  const rows = SPRITES[name];
  if (!rows) return;
  // Only write when something changed: this runs every frame for animated sprites.
  const url = spriteURL(name, colors);
  if (img.getAttribute('src') !== url) img.src = url!;
  const scale = spriteScale(name, size);
  if (img.width !== rows[0].length * scale) img.width = rows[0].length * scale;
  if (img.height !== rows.length * scale) img.height = rows.length * scale;
}

// (1.5.0: the reel symbols are 32×32, so 64 draws them at 2×.)
export function symbolImg(symbolId: string, size = 64) {
  return spriteImg(SYMBOL_SPRITES[symbolId], size, symbolId ? symbolId[0].toUpperCase() : '?');
}
