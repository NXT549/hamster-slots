// skins.ts — VIEW layer. What each skin LOOKS like.
//
// data.json lists the skins (id, name, category, rarity): that's game content,
// the same on every platform. The colours live here, because data.json never holds art.
//   Fur skins                → new colours for the hamster's palette letters (art.ts)
//   Hats (M10)               → a hat drawn on the hamster's head (art.ts HATS)
//   Wheel / machine / room   → new values for CSS theme tokens (style.css :root)
//
// A "room" skin colours the cage: the wall behind the bars (--wall-*), the wire
// (--wire), and the plastic base the bedding sits in (--floor, --floor-dark).
// A machine skin paints EVERY machine (1.6.1 "Fresh Coat"; before, only Old Clunky):
// it sets --paint, --paint-dark and --paint-light, and cabinet.ts paints each
// machine's body (and the trims made from it) in them, keeping the machine's own
// shape and details (the Bonanza's grass, the Big Cheese's rind, the boxes' tape).
// The starter skin sets nothing, so every machine wears its own colours.
//
// The equipped wheel/machine/room tokens are set on the STAGE element, so they
// only recolour the cage. A Wardrobe swatch sets its own tokens on itself, and
// anything it doesn't set falls back to the :root defaults, i.e. the classic look.

import { spriteImg, hamsterSprite } from './art.ts';
import { mix } from './dom.ts';
import type { Colors } from './art.ts';
import type { Game } from '../logic/game.ts';
import type { SkinDef } from '../logic/types.ts';

// What a skin looks like: fur colours (palette letters) or CSS token values.
export interface SkinArt {
  colors?: Colors;
  tokens?: Record<string, string>;
  hat?: string; // M10: a hat in art.ts HATS
}

// A machine skin's tokens: the paint every cabinet's body takes (base, shade, and a
// light worked out from the base), the sign's colour, and maybe a few extra tokens.
// --machine is set too, so the Wardrobe swatch (and Old Clunky) read it like before.
function paint(base: string, dark: string, sign?: string, extra: Record<string, string> = {}): Record<string, string> {
  const light = mix(base, '#ffffff', 0.45);
  const out: Record<string, string> = {
    '--paint': base, '--paint-dark': dark, '--paint-light': light, '--machine': base, '--machine-dark': dark, ...extra,
  };
  if (sign) out['--marquee'] = out['--paint-marquee'] = sign;
  return out;
}

export const SKIN_ART: Record<string, SkinArt> = {
  // Fur: t = fur, T = fur shade, c = cream belly/cheeks, p = pink ears/nose/feet
  furClassic: {},
  furCinnamon: { colors: { t: '#dc8b58', T: '#b5663a', c: '#fbe0c8' } },
  furSnowball: { colors: { t: '#f7f3ee', T: '#d9d1c6', c: '#ffffff' } },
  furCocoa: { colors: { t: '#946146', T: '#70442e', c: '#ecd0b3' } },
  furLavender: { colors: { t: '#cdb6ea', T: '#a78fd0', c: '#f5edfc' } },
  furMint: { colors: { t: '#a9dfca', T: '#78c1a6', c: '#f1fbf6', p: '#8a5a3c' } }, // chocolate-chip ears and toes
  furGolden: { colors: { t: '#ffd35c', T: '#e3a72f', c: '#fff6c2' } },
  furTuxedo: { colors: { t: '#6b6673', T: '#4f4a57', c: '#fdfcfa' } }, // M11 (the casino): a slate coat, a white shirt front
  furPumpkin: { colors: { t: '#f0913a', T: '#c96a22', c: '#ffe2b8' } }, // Pumpkin Night: pumpkin orange

  hatNone: {},
  hatParty: { hat: 'hatParty' },
  hatBeanie: { hat: 'hatBeanie' },
  hatFlowers: { hat: 'hatFlowers' },
  hatTop: { hat: 'hatTop' },
  hatCowboy: { hat: 'hatCowboy' },
  hatCrown: { hat: 'hatCrown' },
  hatVisor: { hat: 'hatVisor' }, // M11 (the casino)
  hatWitch: { hat: 'hatWitch' }, // Pumpkin Night

  wheelClassic: {},
  wheelMint: { tokens: { '--wheel-bg': '#effaf5', '--wheel-ring': '#c3ead9', '--wheel-spoke': '#8fcfb5', '--wheel-hub': '#7fcbb8' } },
  wheelBerry: { tokens: { '--wheel-bg': '#fff1f4', '--wheel-ring': '#f7c9d3', '--wheel-spoke': '#ec9fb2', '--wheel-hub': '#ef7a76' } },
  wheelOak: {
    tokens: {
      '--wheel-rim': '#5c3b24', '--wheel-bg': '#f5e3c8', '--wheel-ring': '#d9ae7c',
      '--wheel-spoke': '#a8773f', '--wheel-hub': '#8a5a3c', '--wheel-stand': '#c99b70',
    },
  },
  wheelGold: {
    tokens: {
      '--wheel-rim': '#a8741a', '--wheel-bg': '#fff8d6', '--wheel-ring': '#ffd35c',
      '--wheel-spoke': '#e3a72f', '--wheel-hub': '#fffdf8', '--wheel-stand': '#ffd35c',
    },
  },

  // Pumpkin Night: a carved pumpkin of a wheel, orange with a dark rim and a glowing hub.
  wheelLantern: {
    tokens: {
      '--wheel-rim': '#5a2a12', '--wheel-bg': '#ffe2b8', '--wheel-ring': '#f79a3e',
      '--wheel-spoke': '#d9722a', '--wheel-hub': '#ffd35c', '--wheel-stand': '#6b4a9c',
    },
  },

  machineClassic: {},
  machinePeach: { tokens: paint('#ffb899', '#e8906c') },
  machineSky: { tokens: paint('#93cfe8', '#5ea6c8') },
  machineGrape: { tokens: paint('#b9a3e3', '#8f78c2', '#f59aa5') },
  machineMidnight: { tokens: paint('#4b5185', '#33375f', '#ffd35c') },
  // 1.6.1 (Fresh Coat): five more. Copper Pipes and Arcade also recolour the chrome trim and the lever.
  machineBubblegum: { tokens: paint('#ff9ccf', '#e070a8', '#a8ecff') },
  machineMossy: { tokens: paint('#8fbf6a', '#648f45', '#f5e6a8') },
  machineCopper: { tokens: paint('#c8794a', '#9a5530', '#ffd35c', { '--chrome': '#e3a06e', '--chrome-light': '#ffd2a8', '--chrome-dark': '#a8623a' }) },
  machineSeaside: { tokens: paint('#6cc9c4', '#3f9c98', '#fbe3b0') },
  machineHaunted: { tokens: paint('#6b4a9c', '#4b2c78', '#9be36a') }, // Pumpkin Night: purple, with a slime-green sign
  machineArcade: { tokens: paint('#3d3850', '#262233', '#6ef0ff', { '--chrome': '#ff6ad5', '--chrome-light': '#ffc2ee', '--chrome-dark': '#b03a92' }) },

  roomClassic: {},
  roomStrawberry: { tokens: { '--wall-top': '#fff4f6', '--wall-bottom': '#fbdbe3', '--floor': '#f4a7b9', '--floor-dark': '#d67b92' } },
  roomMint: { tokens: { '--wall-top': '#f4fbf7', '--wall-bottom': '#d9f0e4', '--floor': '#9ed9bd', '--floor-dark': '#69b592' } },
  roomStarry: {
    tokens: {
      '--wall-top': '#454b7d', '--wall-bottom': '#2f335c', '--wall-stripe': 'rgba(255, 255, 255, 0.05)',
      '--wire': '#8d93c4', '--wire-dark': '#262a4d',
      '--floor': '#5d64a8', '--floor-dark': '#3f457f', '--floor-ink': '#fbeedd',
    },
  },
  roomSunflower: { tokens: { '--wall-top': '#fffbe3', '--wall-bottom': '#ffe79a', '--floor': '#a3d17f', '--floor-dark': '#78ad56' } },
  // Pumpkin Night: a night-purple wall, orange wire, a pumpkin-patch floor.
  roomPumpkin: {
    tokens: {
      '--wall-top': '#4a3366', '--wall-bottom': '#2f2045', '--wall-stripe': 'rgba(247, 154, 62, 0.07)',
      '--wire': '#f79a3e', '--wire-dark': '#5a2a12',
      '--floor': '#c96a22', '--floor-dark': '#8f4514', '--floor-ink': '#fbeedd',
    },
  },
  // M11 (the casino): red velvet walls with gold stripes, gold wire, green card-table felt.
  roomCasino: {
    tokens: {
      '--wall-top': '#8a2a3a', '--wall-bottom': '#5f1a28', '--wall-stripe': 'rgba(255, 211, 92, 0.09)',
      '--wire': '#ffd35c', '--wire-dark': '#7a4f12',
      '--floor': '#3f8f5f', '--floor-dark': '#2a6a44', '--floor-ink': '#fbeedd',
    },
  },
};

// Every CSS token any skin sets, so switching skins can clear the old ones first.
export const SKIN_TOKENS = [...new Set(Object.values(SKIN_ART).flatMap((art) => Object.keys(art.tokens || {})))];

// A fur skin only lists its main colours (t fur, T shade, c cream, maybe p pink).
// The hamster sprite also uses a light fur (a), an outline (A), a deep shade (%), a cream shade (C)
// and pink shades (P, Z), so work those out from the main colours. That way a new
// fur skin needs just 3 colours and still matches the sprite's style.
export function furPalette(skinId: string | null): Colors | null {
  const art = skinId ? SKIN_ART[skinId] : undefined;
  if (!art || !art.colors) return null;
  const { t, T, c } = art.colors;
  const A = mix(T, '#2b1a10', 0.45);
  // (1.5.0: '%' is the 32×32 hamster's deep fur shade, between the shade and the outline.)
  const out: Colors = { ...art.colors, a: mix(t, '#ffffff', 0.4), A, '%': mix(T, A, 0.42), C: mix(c, T, 0.22) };
  if (art.colors.p) {
    out.P = mix(art.colors.p, '#2b1a10', 0.2);
    out.Z = mix(art.colors.p, '#2b1a10', 0.5);
  }
  return out;
}

// The palette colours to draw the hamster with (null = classic fur).
export function furColors(game: Game): Colors | null {
  return furPalette(game.getEquippedSkin('fur'));
}

// The hat the hamster is wearing (a name in art.ts HATS), or null.
export function hatOf(game: Game): string | null {
  const id = game.getEquippedSkin('hat');
  return (id && SKIN_ART[id] && SKIN_ART[id].hat) || null;
}

// Put the equipped wheel / machine / room tokens on the stage element.
export function applyStageSkins(game: Game, stage: HTMLElement): void {
  for (const name of SKIN_TOKENS) stage.style.removeProperty(name);
  for (const cat of game.data.skinCategories || []) {
    if (cat.id === 'fur' || cat.id === 'hat') continue; // drawn on the hamster sprite by ui.ts
    const id = game.getEquippedSkin(cat.id);
    const art: SkinArt = (id && SKIN_ART[id]) || {};
    for (const [name, value] of Object.entries(art.tokens || {})) stage.style.setProperty(name, value);
  }
}

// A small preview of a skin (about `size` px), for the Wardrobe and the capsule reveal.
export function skinPreview(def: SkinDef, size = 48): HTMLElement {
  const art: SkinArt = SKIN_ART[def.id] || {};
  if (def.category === 'fur') return spriteImg('hamster', size, def.name[0], furPalette(def.id));
  if (def.category === 'hat') return spriteImg(hamsterSprite('hamster', art.hat || null), size, def.name[0]);
  const swatch = document.createElement('div');
  swatch.className = `swatch swatch-${def.category}`;
  for (const [name, value] of Object.entries(art.tokens || {})) swatch.style.setProperty(name, value);
  swatch.innerHTML = ({
    wheel: '<span class="sw-spokes"></span>',
    machine: '<span class="sw-marquee"></span><span class="sw-window"></span>',
    room: '<span class="sw-bars"></span><span class="sw-floor"></span>',
  } as Record<string, string>)[def.category] || '';
  return swatch;
}
