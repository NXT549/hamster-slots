// album.ts — VIEW layer. 1.10: the Family Album, the Family tab's Album sub-tab. Every
// hamster that retired (or led a Great Migration) has a page: its portrait in the fur and
// hat it wore, its generation, how long it lived, what it earned, its best win, the seeds it
// left, and the Colony Trial it played. Newest first, one card per colony.
//
// The pages are written by the logic (game.ts addAlbumPage) and never change, so a page is
// drawn once and kept; the list is only redrawn when a page is added. Like the rest of the
// view it only reads game.state. family.ts creates it and calls render() every frame.

import { applySprite, hamsterSprite } from './art.ts';
import { furPalette, hatArt } from './skins.ts';
import { formatCoins, formatDuration, setText, setHTML } from './dom.ts';
import { byId, h, card, chip, amountHTML, keyedList } from './kit.ts';
import type { Game } from '../logic/game.ts';
import type { AlbumPage } from '../logic/types.ts';

interface ColonyCard {
  el: HTMLElement;
  count: HTMLElement;
  list: HTMLElement;
  pages: Map<string, { el: HTMLElement }>;
}

export function createAlbumView(game: Game) {
  const panel = byId('album-main');

  const intro = card({ tone: 'heirloom', title: 'Family Album', icon: 'paw', className: 'album-intro' });
  const summary = intro.body.appendChild(h('p', 'k-note album-summary'));
  panel.append(intro.el);
  const colonies = panel.appendChild(h('div', 'album-colonies'));
  let cards = new Map<string, ColonyCard>();
  let drawnKey = ''; // what the list shows (redrawn only when a page is added)

  // The sub-tab shows once a hamster could have a page (an older save's family too: its album
  // starts with the next hamster to retire).
  const shown = () => game.state.album.length > 0 || game.state.generation > 1 || game.state.colony > 0;

  function makeColony(colony: number): ColonyCard {
    const c = card({ title: `Colony ${colony + 1}`, className: 'album-colony' });
    const count = c.head.appendChild(h('span', 'k-note family-count'));
    const list = c.body.appendChild(h('div', 'album-pages'));
    list.setAttribute('role', 'list');
    return { el: c.el, count, list, pages: new Map() };
  }

  // One page: the portrait, who it was, and a line of how its life went.
  function makePage(p: AlbumPage): { el: HTMLElement } {
    const el = h('div', 'album-page');
    el.setAttribute('role', 'listitem');
    const img = el.appendChild(h('img', 'album-portrait')) as HTMLImageElement;
    img.alt = '';
    // (No data-sprite: ui.ts repaints those in today's fur; a page keeps the fur it wore.)
    applySprite(img, hamsterSprite('hamster', hatArt(p.hat)), 32, furPalette(p.fur));
    const text = el.appendChild(h('div', 'album-text'));
    text.append(h('div', 'album-name', p.name));
    text.append(h('div', 'album-line', `Generation ${p.generation} · lived ${formatDuration(p.playTime)}`));
    const life = text.appendChild(h('div', 'album-line'));
    setHTML(life, `Earned ${formatCoins(p.coinsEarned)} coins${p.bestWin.gt(0) ? ` · best win ${formatCoins(p.bestWin)}` : ''} · left +${amountHTML('seed', p.seeds, 12)}`);
    const chips = text.appendChild(h('div', 'album-chips'));
    const trial = p.trial ? game.getTrialDef(p.trial) : null;
    if (trial) chips.append(chip(p.trialBeaten ? `${trial.name}: beaten` : `${trial.name}: not beaten`, p.trialBeaten ? 'gold' : 'plain', 'whisker').el);
    if (p.how === 'elders') chips.append(chip('Retired by the Wise Elders', 'soft').el);
    if (p.how === 'migrated') chips.append(chip('Led the Great Migration', 'gold').el);
    if (!chips.childElementCount) chips.remove();
    return { el };
  }

  function render(visible: boolean): void {
    if (!visible) return;
    const album = game.state.album;
    const last = album[album.length - 1];
    const key = `${album.length}:${last ? `${last.colony}-${last.generation}` : ''}`;
    if (key === drawnKey) return;
    drawnKey = key;

    const founder = album[0] && album[0].generation === 1 && album[0].colony === 0 ? album[0] : null;
    const keep = game.data.album ? game.data.album.keep : Infinity;
    setText(summary, album.length === 0
      ? 'Every hamster that retires gets a page here: who they were, what they wore and how their life went. The album starts with the next hamster to retire.'
      : `${album.length} hamster${album.length === 1 ? '' : 's'} in the album${founder ? `, starting with ${founder.name}, who began it all` : ''}.`
        + (album.length >= keep ? ` The album keeps the newest ${keep} pages (and the family's first hamster).` : ''));

    // Newest first: the colonies from the latest, and in each the latest hamster on top.
    const byColony = new Map<number, AlbumPage[]>();
    for (let i = album.length - 1; i >= 0; i--) {
      const p = album[i];
      if (!byColony.has(p.colony)) byColony.set(p.colony, []);
      byColony.get(p.colony)!.push(p);
    }
    const order = [...byColony.keys()].sort((a, b) => b - a);
    cards = keyedList(colonies, order, (c) => `c${c}`, makeColony, cards);
    for (const c of order) {
      const cc = cards.get(`c${c}`)!;
      const pages = byColony.get(c)!;
      setText(cc.count, `${pages.length} hamster${pages.length === 1 ? '' : 's'}`);
      cc.pages = keyedList(cc.list, pages, (p) => `g${p.generation}:${p.name}`, makePage, cc.pages);
    }
  }

  return { render, shown };
}
