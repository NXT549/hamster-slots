// skins.js — VIEW layer. What each skin LOOKS like.
//
// data.json lists the skins (id, name, category, rarity): that's game content
// shared with Godot. The colours live here, because data.json never holds art.
//   Fur skins                → new colours for the hamster's palette letters (art.js)
//   Wheel / machine / room   → new values for CSS theme tokens (style.css :root)
//
// A "room" skin colours the cage: the wall behind the bars (--wall-*), the wire
// (--wire), and the plastic base the bedding sits in (--floor, --floor-dark).
// Machine skins recolour Old Clunky (their names say so); the Snack Stacker has
// its own look for now.
//
// The equipped wheel/machine/room tokens are set on the STAGE element, so they
// only recolour the cage. A Wardrobe swatch sets its own tokens on itself, and
// anything it doesn't set falls back to the :root defaults, i.e. the classic look.
// Godot: fur = a palette-swap shader parameter; the rest = Theme/Material overrides.

import { spriteImg } from './art.js';
import { mix } from './dom.js';

export const SKIN_ART = {
  // Fur: t = fur, T = fur shade, c = cream belly/cheeks, p = pink ears/nose/feet
  furClassic: {},
  furCinnamon: { colors: { t: '#dc8b58', T: '#b5663a', c: '#fbe0c8' } },
  furSnowball: { colors: { t: '#f7f3ee', T: '#d9d1c6', c: '#ffffff' } },
  furCocoa: { colors: { t: '#946146', T: '#70442e', c: '#ecd0b3' } },
  furLavender: { colors: { t: '#cdb6ea', T: '#a78fd0', c: '#f5edfc' } },
  furMint: { colors: { t: '#a9dfca', T: '#78c1a6', c: '#f1fbf6', p: '#8a5a3c' } }, // chocolate-chip ears and toes
  furGolden: { colors: { t: '#ffd35c', T: '#e3a72f', c: '#fff6c2' } },

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

  machineClassic: {},
  machinePeach: { tokens: { '--machine': '#ffb899', '--machine-dark': '#e8906c' } },
  machineSky: { tokens: { '--machine': '#93cfe8', '--machine-dark': '#5ea6c8' } },
  machineGrape: { tokens: { '--machine': '#b9a3e3', '--machine-dark': '#8f78c2', '--marquee': '#f59aa5' } },
  machineMidnight: { tokens: { '--machine': '#4b5185', '--machine-dark': '#33375f', '--marquee': '#ffd35c' } },

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
};

// Every CSS token any skin sets, so switching skins can clear the old ones first.
export const SKIN_TOKENS = [...new Set(Object.values(SKIN_ART).flatMap((art) => Object.keys(art.tokens || {})))];

// A fur skin only lists its main colours (t fur, T shade, c cream, maybe p pink).
// The hamster sprite also uses a light fur (a), an outline (A), a cream shade (C)
// and pink shades (P, Z), so work those out from the main colours. That way a new
// fur skin needs just 3 colours and still matches the sprite's style.
export function furPalette(skinId) {
  const art = SKIN_ART[skinId];
  if (!art || !art.colors) return null;
  const { t, T, c } = art.colors;
  const out = { ...art.colors, a: mix(t, '#ffffff', 0.4), A: mix(T, '#2b1a10', 0.45), C: mix(c, T, 0.22) };
  if (art.colors.p) {
    out.P = mix(art.colors.p, '#2b1a10', 0.2);
    out.Z = mix(art.colors.p, '#2b1a10', 0.5);
  }
  return out;
}

// The palette colours to draw the hamster with (null = classic fur).
export function furColors(game) {
  return furPalette(game.getEquippedSkin('fur'));
}

// Put the equipped wheel / machine / room tokens on the stage element.
export function applyStageSkins(game, stage) {
  for (const name of SKIN_TOKENS) stage.style.removeProperty(name);
  for (const cat of game.data.skinCategories || []) {
    if (cat.id === 'fur') continue; // fur is a sprite palette, drawn by ui.js
    const art = SKIN_ART[game.getEquippedSkin(cat.id)] || {};
    for (const [name, value] of Object.entries(art.tokens || {})) stage.style.setProperty(name, value);
  }
}

// A small preview of a skin (about `size` px), for the Wardrobe and the capsule reveal.
export function skinPreview(def, size = 48) {
  const art = SKIN_ART[def.id] || {};
  if (def.category === 'fur') return spriteImg('hamster', size, def.name[0], furPalette(def.id));
  const swatch = document.createElement('div');
  swatch.className = `swatch swatch-${def.category}`;
  for (const [name, value] of Object.entries(art.tokens || {})) swatch.style.setProperty(name, value);
  swatch.innerHTML = {
    wheel: '<span class="sw-spokes"></span>',
    machine: '<span class="sw-marquee"></span><span class="sw-window"></span>',
    room: '<span class="sw-bars"></span><span class="sw-floor"></span>',
  }[def.category] || '';
  return swatch;
}
