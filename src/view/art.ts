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
//   · Main sprites (hamster, reel symbols, machines, cage props) are 24×24; icons
//     are 16×16; currency icons are 12×12. They're drawn at whole-number scales only.
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
};

// Returns a copy of a sprite with some letters swapped, e.g. { d: 'Y' }.
function recolor(rows: string[], map: Colors): string[] {
  return rows.map((row) => [...row].map((ch) => map[ch] || ch).join(''));
}

// ───────────────────────── Sprites ─────────────────────────

// ── Reel symbols (24×24) ──
const seed = [
  '........................',
  '...........DD...........',
  '..........DddD..........',
  '.........DddddD.........',
  '........DddddddD........',
  '.......DddLddlddD.......',
  '.......DddLddlddD.......',
  '......DddLddddlddD......',
  '......DddLddddlddD......',
  '......DddLddddlddD......',
  '.....DdddLddddlddsD.....',
  '.....DdddLddddldssD.....',
  '.....DdddLddddlsssD.....',
  '.....DdddLddddlsssD.....',
  '.....DdddLdddslsssD.....',
  '.....DdddLddsslsssD.....',
  '......DddLdssslssD......',
  '......DddLsssslssD......',
  '.......DdsLsslssD.......',
  '.......DssLsslssD.......',
  '........DssssssD........',
  '.........DDssDD.........',
  '...........DD...........',
  '........................',
];

const golden = [
  '........................',
  '...........VV...........',
  '..........VyyV......y...',
  '.........VyyyyV....ywy..',
  '........VyhhyyyV....y...',
  '.......VyhwyyhyyV.......',
  '.......VhhwyyhyyV.......',
  '......VyhwyyyyhyyV......',
  '......VhhwyyyyhyyV......',
  '......VhywyyyyhyyV......',
  '.....VyyywyyyyhyyYV.....',
  '.....VyyywyyyyhyYYV.....',
  '.....VyyywyyyyhYYYV.....',
  '.....VyyywyyyyhYYYV.....',
  '.....VyyywyyyYhYYYV.....',
  '.....VyyywyyYYhYYYV.....',
  '....y.VyywyYYYhYYV......',
  '...ywyVyywYYYYhYYV......',
  '....y..VyYwYYhYYV.......',
  '.......VYYwYYhYYV.......',
  '........VYYYYYYV........',
  '.........VVYYVV.........',
  '...........VV...........',
  '........................',
];

const carrot = [
  '...........HH...........',
  '........H.HGGH.H........',
  '.......HGHHGGHHGH.......',
  '......HGiiHiGHiGGH......',
  '.......HiGHiGHGGH.......',
  '........HGGGGGGH........',
  '........HGGGGGGH........',
  '.........HGGgGH.........',
  '..........HGgH..........',
  '......JJJJHGgHJJJJ......',
  '.....JjjjjjjjjjoooJ.....',
  '.....JjjjjjjjjooooJ.....',
  '......JjjjjjjooooJ......',
  '......JjOOjooooooJ......',
  '.......JjjoooooooJ......',
  '.......JooooooOOJ.......',
  '........JooooooOJ.......',
  '........JoooooOJ........',
  '.........JOOoOOJ........',
  '.........JoOOOJ.........',
  '..........JOOOJ.........',
  '..........JOOJ..........',
  '...........JOJ..........',
  '............J...........',
];

// ── The hamster: two running frames (24×24) ──
const hamster = [
  '........................',
  '........................',
  '........................',
  '........................',
  '.............A..........',
  '............AtA.........',
  '...........AtttA........',
  '..........AttptAAAA.....',
  '.......AAAAAtPtaaatA....',
  '.....AAttttttaaaatttA...',
  '....AttaaaataaattttttA..',
  '...AttaaaaataattttwktA..',
  '..AttaaaatttttttttkkttA.',
  '.AttaaatttttttttcccccpZ.',
  '.ATtatttttttttttcccccA..',
  '.AttttttttttccctcpcccA..',
  '..AttttttccccccccccCA...',
  '..AtttttcccccccccccA....',
  '...AtttccccccccccccA....',
  '....AtttccccccccccA.....',
  '.....AtTTccccccCAA......',
  '.....ZppZAAAAAZppZ......',
  '......ZZ.......ZZ.......',
  '........................',
];

const hamster2 = [
  '........................',
  '........................',
  '........................',
  '........................',
  '.............A..........',
  '............AtA.........',
  '...........AtttA........',
  '..........AttptAAAA.....',
  '.......AAAAAtPtaaatA....',
  '.....AAttttttaaaatttA...',
  '....AttaaaataaattttttA..',
  '...AttaaaaataattttwktA..',
  '..AttaaaatttttttttkkttA.',
  '.AttaaatttttttttcccccpZ.',
  '.ATtatttttttttttcccccA..',
  '.AttttttttttccctcpcccA..',
  '..AttttttccccccccccCA...',
  '..AtttttcccccccccccA....',
  '...AtttccccccccccccA....',
  '....AtttccccccccccA.....',
  '.....AtTTccccccCAA......',
  '......AZppZAZppZ........',
  '........ZZ...ZZ.........',
  '........................',
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

// ── Snack Stacker symbols (24×24) ──
const blueberry = [
  '........................',
  '........................',
  '........................',
  '.........SSSSSS.........',
  '.......SSzzuuuuSS.......',
  '......SzzzuSSuuuuS......',
  '.....SuzuSSIISSuuuS.....',
  '....SuzzuuuSSuuuuuuS....',
  '...SuzwzuuuuuuuuuuuuS...',
  '..SuzzzuuuuuuuuuuuuuIS..',
  '..SuzzuuuuuuuuuuuuuuIS..',
  '..SuzuuuuuuuuuuuuuuIIS..',
  '..SuuuuuuuuuuuuuuuuIIS..',
  '..SuuuuuuuuuuuuuuuIIIS..',
  '..SuuuuuuuuuuuuuuIIIIS..',
  '..SuuuuuuuuuuuuuIIIIIS..',
  '..SuuuuuuuuuuuuIIIIIIS..',
  '...SuuuuuuuuuuIIIIIIS...',
  '...SIuuuuuuuuIIIIIIIS...',
  '....SIuuuuuuIIIIIIIS....',
  '.....SIIuuIIIIIIIIS.....',
  '......SSIIIIIIIISS......',
  '........SSSSSSSS........',
  '........................',
];

const strawberry = [
  '........................',
  '...........HH...........',
  '..........HggH..........',
  '.....HHH..HGgH..HHH.....',
  '....HiGGHHGGGGHHGGgH....',
  '...HiGGGGGGGGGGGGGGgH...',
  '..HiGGGgHGGGGGGHgGGGgH..',
  '...HGgHerHGGgGHrrHGgH...',
  '...XHHerrrHGgHrrrrHHX...',
  '..XeeerrrrrHHrrrrrrrRX..',
  '..XeeryrrryrrryrrryrRX..',
  '..XerrrrrrrrrrrrrrrRRX..',
  '..XryrrryrrryrrryrRRRX..',
  '...XrrrrrrrrrrrrrRRRX...',
  '....XrryrrryrrryRRRX....',
  '.....XrrrrrrrrrRRRX.....',
  '......XrryrrryRRRX......',
  '.......XrrrrrRRRX.......',
  '........XrrYRRRX........',
  '.........XrRRRX.........',
  '..........XRRX..........',
  '...........XX...........',
  '........................',
  '........................',
];

// ── Milestone 6 symbols (24×24) ──
// The Hamster Wild: your hamster's face on a gold coin. It stands in for any symbol on a line.
const wild = [
  '..........VVVV..........',
  '.......VVVhhyyVVV.......',
  '.....VVhhhhyyyyyyVV.....',
  '....VhhAAAyyyyAAAyyV....',
  '...VhhAppPAyyAppPAyyV...',
  '..VhhhAppPAAAAppPAyyyV..',
  '..VhhhAAtaaattttAAyyyV..',
  '.VhhhAtaaaattttttAyyyYV.',
  '.VhhAtaaatttttttttAyyYV.',
  '.VhyAtaawktttttwktAyyYV.',
  'VhhyAtaakkttttttkktAyYYV',
  'VhyAtttttttppttttttAYYYV',
  'VyyAcccccttPPttcccccAYYV',
  'VyyAccccccttAAttcccccAYV',
  'VyyAccccccAttttAccccCAYV',
  '.VyyAccccCCttttCCccCAYV.',
  '.VyyyAcCCCtTTTTtCCCAYYV.',
  '.VyyyyAACCCTTTTCCAAYYYV.',
  '..VyyyyyAAAAAAAAYYYYYV..',
  '..VyyyyyyyyYYYYYYYYYYV..',
  '...VyyyyyyYYYYYYYYYYV...',
  '....VVyyyYYYYYYYYYVV....',
  '......VVVYYYYYYVVV......',
  '.........VVVVVV.........',
];

// The Hamster Ball: a scatter (it counts anywhere). 3+ start free spins on the Burrow Bonanza.
const ball = [
  '........................',
  '........WWWWWWWW........',
  '......WWvvvvWbbbWW......',
  '.....WvvvvvvWbbbbbW.....',
  '....WvvwwvvvWbbbbbbW....',
  '...WvvwvvvvbbbbbbbbbW...',
  '..WvvwvvvvbbbbbbbbbbbW..',
  '..WvwvvvvbbbbbbbbAAbbW..',
  '.WvvvvvvbbbbbbbbAtpAbBW.',
  '.WvvvvvbbbbbbAAAttAbbBW.',
  '.WvvvvbbbbbAAaatttAbbBW.',
  '.WvvvbbbbbAaatttwktAbBW.',
  '.WWWbbbbbAattttttkttAWW.',
  '.WvbbbbbbAtttttttttpZBW.',
  '.WbbbbbbAtttttttcccAbBW.',
  '.WbbbbbbAttttttccccABBW.',
  '..WbbbbbAttttcccccCABW..',
  '..WbbbbbbAAtTTcccCABBW..',
  '...WbbbbbbZpAAAAAZpBW...',
  '....WbbbbbbZZbbbZZBW....',
  '.....WbbbbbbWbBBBBW.....',
  '......WWbbbbWBBBWW......',
  '........WWWWWWWW........',
  '........................',
];

// The Cheek Pouch: a scatter on the Pouch Palace. 3+ spin the jackpot wheel.
const pouch24 = [
  '........................',
  '...........VV......h....',
  '.........VVwyVV...hwh...',
  '........VhyyyyYV...h....',
  '.......VVhyyyyYVV.......',
  '......VhyyVVVVyyYV......',
  '......VyyYV..VyYYV......',
  '........UxxnnnnU........',
  '........UxxxnnnU........',
  '......UXeerrrrRRXU......',
  '.....UxXXXXXXXXXXnU.....',
  '....UxxxxnnnnnnnnnnU....',
  '....UxxnnnnnnnnnnnnU....',
  '...UxxnnnnnnnnnnnnnNU...',
  '...UxnnnnnnVVVnnnnnNU...',
  '...UnnnnnnVyhyVnnnNNU...',
  '...UnnnnnnVyyYVnnNNNU...',
  '...UnnnnnnnVVVnnNNNNU...',
  '....UnnnnnnnnnnNNNNU....',
  '....UnnnnnnnnnNNNNNU....',
  '.....UnnnnnnNNNNNNU.....',
  '......UUnnnNNNNNUU......',
  '........UUUUUUUU........',
  '........................',
];

const corn = [
  '........................',
  '...........VV...........',
  '.........VVhyVV.........',
  '.........VyyYyV.........',
  '........VhwyyyyV........',
  '........VhYyYyYV........',
  '.......VhhyyyyyyV.......',
  '.......VyyYyYyYyV.......',
  '.......VyyyyyyyyV.......',
  '.......VYyYyYyYyV.......',
  '.......VyyyyyyyyV.......',
  '.......VYyYyYyYYV.......',
  '.......VyyyyyyyYV.......',
  '.......VYyYyYyYYV..H....',
  '....H..VyyyyyYYYV.HH....',
  '....HH..VyYyYYYV.HGH....',
  '....HiH.VyyyYYYYHGH.....',
  '.....HGH.VYyYYYGGGH.....',
  '.....HGGHyyYYYGGGGH.....',
  '.....HGGGiiiGGGGGGH.....',
  '......HGGgGGGGGGHH......',
  '.......HHgHGGHGH........',
  '.........H.HH.H.........',
  '........................',
];

const apple = [
  '........................',
  '........................',
  '.............UHH........',
  '............UHGiH.......',
  '............U.HH........',
  '............U...........',
  '......XXXXX..XXXXX......',
  '.....XeeerrXXeerrrX.....',
  '....XeeeeeeeerrrrrrX....',
  '...XeeweeeeerrrrrrrrX...',
  '..XeeweeeeerrrrrrrrrrX..',
  '..XeeeeeerrrrrrrrrrrrX..',
  '..XeeeeerrrrrrrrrrrrrX..',
  '..XeeeerrrrrrrrrrrrRRX..',
  '..XeeerrrrrrrrrrrrRRRX..',
  '..XerrrrrrrrrrrrrRRRRX..',
  '..XrrrrrrrrrrrrrRRRRRX..',
  '..XrrrrrrrrrrrrRRRRRRX..',
  '...XrrrrrrrrrRRRRRRRX...',
  '....XrrrrrrrRRRRRRRX....',
  '.....XrrrrrRRRRRRRX.....',
  '......XXXXXRRXXXXX......',
  '...........XX...........',
  '........................',
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
  '........................',
  '...........UUUU.........',
  '........UUUxxxxUUU......',
  '......UUxxxUUUUxnnU.....',
  '.....UxxUUU....UUnnUU...',
  '....UxxU....U....UnnU...',
  '....UxU..UUUxUUU..UnnU..',
  '...UxU..UxxxUUnnU..UnnU.',
  '...UxU..UxUU..UnnU..UnU.',
  '...UxU.UxU.....UnnU.UNU.',
  '...UU..UxU......UnU..UNU',
  '...UxU.UnU..UUU.UnU..UNU',
  '...UxU.UnnUUnnU.UnU..UNU',
  '...UxU..UUnnnU..UNU..UNU',
  '....UnU...UUU..UNNU.UNU.',
  '....UnnUU.....UNNU..UNU.',
  '.....UnnnUUUUUNNU..UNNU.',
  '......UUnnnnNNUU..UNNU..',
  '........UUUUUU...UNNU...',
  '...............UUNNU....',
  '..............UNNNU.....',
  '..............UUUU......',
  '........................',
  '........................',
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
const frameButton = [
  '..77777777..',
  '.7666666667.',
  '764444444457',
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
  '........................',
  '...........UU...........',
  '..........UNNU..........',
  '.....UUUUUUNNUUUUUU.....',
  '...UUxnnxnnxnnxnnxnUU...',
  '..UxnnxnnxnnxnnxnnxnNU..',
  '.UnxnnxnnxnnxnnxnnxnNNU.',
  '.UNnnNnnNnnNnnNnnNnNNNU.',
  '.UUUUUUUUUUUUUUUUUUUUUU.',
  '..VyhhhyyyyyyyyyyyyYYV..',
  '..VyhwhyyyyyyyyyyyyYYV..',
  '..VyhhyyyyyyyyyyyyyYYV..',
  '...VyhyyyyyyyyyyyyYYV...',
  '...VyhyyyyyyyyyyyyYYV...',
  '....VyyyyyyyyyyyyYYV....',
  '....VyyyyyyyyyyyYYYV....',
  '.....VyyyyyyyyyYYYV.....',
  '......VyyyyyyyYYYV......',
  '.......VyyyyyYYYV.......',
  '........VyyyYYYV........',
  '.........VYYYYV.........',
  '..........VYYV..........',
  '...........VV...........',
  '........................',
];

// The Cheese Wedge (the Big Cheese's top symbol): the pale top face, the gold front with holes.
const cheese = [
  '........................',
  '........................',
  '........................',
  '..................VV....',
  '...............VVVhV....',
  '............VVVhhhyV....',
  '.........VVVhhhhhyyV....',
  '......VVVhhhhhhhyyyV....',
  '...VVVhhhhhhhhhyyyYV....',
  '..VhhhhhhhhhhhyyyYYV....',
  '..VVVVVVVVVVVVVVVVVV....',
  '..VyyyyyyyyyyyyyyyYV....',
  '..VyyYYyyyyyyyYYyyYV....',
  '..VyYVVYyyyyyYVVYyYV....',
  '..VyYVVYyyYYyyYYyyYV....',
  '..VyyYYyyyYVYyyyyyYV....',
  '..VyyyyyyyyYyyyYYyYV....',
  '..VyyyyYYyyyyyYVVYYV....',
  '..VyyyYVVYyyyyyYYyYV....',
  '..VyyyyYYyyyyyyyyyYV....',
  '..VYYYYYYYYYYYYYYYYV....',
  '..VVVVVVVVVVVVVVVVVV....',
  '........................',
  '........................',
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

export const SPRITES: Record<string, string[]> = {
  seed, golden, carrot, blueberry, strawberry, wild, ball, pouch24, corn, apple, hamster, hamster2, coin, chip, token, heirloom, capsule, capsuleRare, capsuleEpic, gacha,
  cheeks, wheel, oilcan, gear, reel, paylinesIcon, heart, star, bolt, scooter, backpack, parcel, pouch, goldenIcon, carrotIcon,
  machineClunky, machineStacker, machineBonanza, machinePalace, bottle, bowl, bedding,
  highRollerIcon, flame, wildIcon, ballIcon, pouchPolish,
  shaving, clover, horseshoe, seedPacket, cardBack, suitHearts, suitDiamonds, suitClubs, suitSpades, bothWaysIcon, snackIcon,
  goldAcorn, cheese, machineMaze, machineVault, machineCheese, acornIcon, cheeseIcon,
  frameCard, framePaper, frameTab, frameButton, bubbleTail,
};

// ── Hats (M10): worn on the hamster's head ──
// Each hat is a small picture plus where its top-left pixel goes on the 24×24
// hamster (both run frames have the same head: the ear on the left, the top of
// the head at x 15–19, row 7). Hats only use colours fur skins never change
// (no t T a A c C p P Z), so a hat looks the same on every fur.
export const HATS: Record<string, { rows: string[]; x: number; y: number }> = {
  hatParty: { x: 14, y: 1, rows: [ // a party cone: blue with gold stripes and a pompom
    '...h...',
    '..WyW..',
    '..WbW..',
    '.WyyyW.',
    '.WbbBW.',
    'WbbbbBW',
    'WyyyyYW',
  ] },
  hatBeanie: { x: 14, y: 3, rows: [ // a mint knitted beanie with a bobble and a ribbed rim
    '...f...',
    '..EmE..',
    '.EmmmE.',
    'EmfmmME',
    'EmmmmME',
    'EMEMEME',
  ] },
  hatFlowers: { x: 14, y: 6, rows: [ // a ring of little flowers
    '.e.h.z.',
    'rGyGuGr',
  ] },
  hatTop: { x: 14, y: 1, rows: [ // a charcoal top hat with a red band
    '.DDDDD.',
    '.DlddD.',
    '.DlddD.',
    '.DldsD.',
    '.DrrRD.',
    'DdddddD',
    'DDDDDDD',
  ] },
  hatCowboy: { x: 13, y: 3, rows: [ // a tan cowboy hat, its brim curling up
    '...UUU...',
    '..UnxnU..',
    '..UnnnU..',
    'U.UNNNU.U',
    'UnnnnnnnU',
    '.UUUUUUU.',
  ] },
  hatVisor: { x: 14, y: 6, rows: [ // M11: the casino dealer's green visor, its brim over the eyes
    '.HHHHH...',
    'HiiGGGH..',
    'HGGGGGgH.',
    '.HHgggGiH',
    '....HHHHH',
  ] },
  hatCrown: { x: 14, y: 3, rows: [ // a gold crown with a ruby and a sapphire
    'V.V.V.V',
    'VhVyVyV',
    'VyyyyYV',
    'VrYuYrV',
    'VVVVVVV',
  ] },
};

// A hamster frame with a hat on: the hat's pixels drawn over the hamster's.
function withHat(base: string[], hat: { rows: string[]; x: number; y: number }): string[] {
  return base.map((row, y) => [...row].map((ch, x) => {
    const r = hat.rows[y - hat.y];
    const top = r && x >= hat.x ? r[x - hat.x] : undefined;
    return top && top !== '.' ? top : ch;
  }).join(''));
}
// Registered as sprites ("hamster.hatParty", "hamster2.hatParty" …), so every
// place that draws the hamster can draw it with its hat, fur colours and all.
for (const [id, hat] of Object.entries(HATS)) {
  SPRITES[`hamster.${id}`] = withHat(hamster, hat);
  SPRITES[`hamster2.${id}`] = withHat(hamster2, hat);
}

// The sprite name for a hamster frame wearing a hat (null or an unknown hat = none).
export function hamsterSprite(frame: 'hamster' | 'hamster2', hat: string | null): string {
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
};

// Which sprite to draw for each machine id (from data.json), e.g. on the machine cards.
export const MACHINE_SPRITES: Record<string, string> = {
  clunky: 'machineClunky', stacker: 'machineStacker', bonanza: 'machineBonanza', palace: 'machinePalace',
  maze: 'machineMaze', vault: 'machineVault', cheese: 'machineCheese', // M9
};

// Upgrade icons: by upgrade id first, then by effect type, so a new upgrade
// of an existing type gets a sensible icon automatically.
const UPGRADE_ICONS_BY_ID: Record<string, string> = {
  cheeks: 'cheeks', wheel: 'wheel', lever: 'oilcan', thirdReel: 'reel', gears: 'gear', paylines: 'paylinesIcon', fourthReel: 'reel',
  tunnelGrease: 'oilcan', velvetGears: 'gear',
  clover: 'clover', // Hamster Luck is the clover; every Machine Luck upgrade is a horseshoe (by type, below)
};
const UPGRADE_ICONS_BY_TYPE: Record<string, string> = {
  payoutMultiplier: 'cheeks', autoSpin: 'wheel', spinCostMultiplier: 'oilcan', extraReel: 'reel', extraPayline: 'paylinesIcon',
  betSteps: 'highRollerIcon', winStreak: 'flame', symbolWeight: 'wildIcon', extraFreeSpins: 'ballIcon', jackpotGrowth: 'pouchPolish',
  luck: 'horseshoe', unlockSymbol: 'seedPacket', bothWays: 'bothWaysIcon',
  extraRespins: 'acornIcon', wheelBonus: 'cheeseIcon', // M9
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
};
const TREE_ICONS_BY_TYPE: Record<string, string> = {
  payoutMultiplier: 'heart', shiftWeight: 'goldenIcon', fullLineMultiplier: 'star', startingLevel: 'wheel',
  spinSpeed: 'bolt', deliveryTime: 'scooter', deliveryPayoutBonus: 'backpack', autoDelivery: 'parcel',
  // M8
  seedJar: 'pouch', luck: 'clover', startingMachineLevel: 'seedPacket', startingMachine: 'snackIcon',
  symbolWeight: 'ballIcon', potSeedBonus: 'pouchPolish',
};
export function treeIcon(def: { id: string; effect: { type: string } }): string | null {
  return TREE_ICONS_BY_ID[def.id] || TREE_ICONS_BY_TYPE[def.effect.type] || null;
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

export function symbolImg(symbolId: string, size = 48) {
  return spriteImg(SYMBOL_SPRITES[symbolId], size, symbolId ? symbolId[0].toUpperCase() : '?');
}
