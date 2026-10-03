// hud.ts — VIEW layer. The HUD across the top (1.6.0, "New Digs"; DESIGN §31 → The wallet):
// the game's logo, the WALLET and the sound and Menu buttons, on a wooden shelf.
//
// The wallet shows every currency the family has, as brass counters: coins (always, with
// what auto-spin earns a second), Heirloom Seeds, Hamster Tokens, Casino Chips and Golden
// Whiskers, each once it exists. Tap one and the tray's sheet says what it is and where it's
// spent, with a button to that tab. On a phone only the coins show, and the rest fold into
// a "+N" counter (styles/hud.css decides when: the phone layout).
//
// It used to be part of ui.ts; ui.ts still asks it where coins should fly to (coinTarget)
// and to pop a counter when it gains (pop).

import { spriteImg, applySprite } from './art.ts';
import { formatCoins, setText, replayClass } from './dom.ts';
import { h, button, listRow, CURRENCIES, formatAmount, appeared } from './kit.ts';
import { titleLetters, rampFromTokens } from './pixelfont.ts';
import type { Currency, Sheet } from './kit.ts';
import type { Game } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import { money } from '../logic/money.ts';
import type { Sound } from './sound.ts';

const ORDER: Currency[] = ['coin', 'seed', 'token', 'chip', 'whisker', 'takings', 'candy'];

interface Purse {
  currency: Currency;
  el: HTMLButtonElement;
  num: HTMLElement;
  rate: HTMLElement | null;
  shown: boolean;
}

export function createHud(game: Game, { sheet, sound, openTab, onSettingsChange, shown }: {
  sheet: Sheet;
  sound: Sound;
  openTab: (tab: string, sub?: string) => void;
  onSettingsChange: () => void;
  shown: { capsules: () => boolean; casino: () => boolean };
}) {
  const wallet = document.getElementById('wallet')!;
  const soundBtn = document.getElementById('sound-btn') as HTMLButtonElement;
  const soundImg = soundBtn.querySelector('img')!;

  // The brass counters, in their order. Each is a button: a tap opens its note in the sheet.
  const purses = new Map<Currency, Purse>();
  let drawn = false; // the counters have been drawn once (what shows then isn't new)
  for (const currency of ORDER) {
    const el = h('button', `purse fr purse-${currency}${currency === 'coin' ? '' : ' purse-extra hidden'}`);
    el.type = 'button';
    el.id = `purse-${currency}`;
    el.append(spriteImg(CURRENCIES[currency].sprite, 24, ''));
    const text = el.appendChild(h('span', 'purse-text'));
    const num = text.appendChild(h('span', 'purse-num num', '0'));
    const rate = currency === 'coin' ? text.appendChild(h('span', 'purse-rate num')) : null;
    el.addEventListener('click', () => { el.blur(); note(currency); });
    wallet.append(el);
    purses.set(currency, { currency, el, num, rate, shown: currency === 'coin' });
  }
  // The "+N" counter (phones): the other currencies, folded away.
  const more = button({ tone: 'brass', label: '+0', className: 'purse-more hidden', ariaLabel: 'Your other currencies', sound: null, onClick: () => noteAll() });
  wallet.append(more.el);

  // 1.5.0: the game's name as a pixel-art logo in gold (pixelfont.ts); the words stay for screen readers.
  const brandText = document.querySelector<HTMLElement>('.brand span');
  if (brandText) {
    const words = brandText.textContent || 'Hamster Slots';
    brandText.setAttribute('aria-label', words);
    brandText.classList.add('brand-logo');
    brandText.replaceChildren(...titleLetters(words, rampFromTokens('--gold', '--gold-dark')));
  }

  // Sound on/off, right on the HUD (the Menu keeps the volume).
  soundBtn.addEventListener('click', () => {
    soundBtn.blur();
    sound.setMuted(!sound.muted);
    onSettingsChange();
    if (!sound.muted) sound.play('buy'); // a little "hello" so you hear it's on
  });
  let shownMuted: boolean | null = null;
  function showSound(): void {
    if (sound.muted === shownMuted) return;
    shownMuted = sound.muted;
    applySprite(soundImg, sound.muted ? 'soundOff' : 'soundOn', 16);
    soundBtn.setAttribute('aria-pressed', String(!sound.muted));
    soundBtn.setAttribute('aria-label', sound.muted ? 'Sound is off: switch it on' : 'Sound is on: switch it off');
  }

  // ── the notes (in the tray's sheet) ──

  const amountOf = (c: Currency): Money => {
    const s = game.state;
    if (c === 'candy') return money(s.festival.treats); // Pumpkin Night: a plain count
    return c === 'coin' ? s.coins : c === 'seed' ? s.seeds : c === 'token' ? s.tokens : c === 'chip' ? s.casino.chips : c === 'takings' ? s.ownCasino.takings : s.whiskers;
  };
  const rateText = () => {
    const econ = game.getEconomy();
    return econ.autoInterval && !game.getAutoPaused() ? `+${formatCoins(econ.expectedAutoProfitPerSecond)}/s` : '';
  };
  // What each currency is, and where to spend it.
  const NOTES: Record<Currency, () => { text: string; go: [string, string, string?] | null }> = {
    coin: () => ({
      text: `Every spin costs coins, and wins pay them back. Spend them on upgrades and new machines. Out of coins? Send ${game.getPupName()} on a delivery: it always pays.${rateText() ? ` With auto-spin you make about ${rateText().slice(1, -2)} coins a second.` : ''}`,
      go: ['Upgrades', 'upgrades'],
    }),
    seed: () => ({
      text: `Earned by retiring a hamster. Every seed you hold adds +${Math.round(game.getHeldSeedBonusPerSeed() * 1000) / 10}% to every payout (up to the seed jar, +${Math.round(game.getSeedJar() * 100)}%). Plant them in the family's tree, in the Big Cage between lives.`,
      go: ['Family', 'family'],
    }),
    token: () => ({
      text: 'Earned from diary stickers, golden jackpots and some deliveries. Spend them at the Capsule Machine on skins: everything you wear gives a buff.',
      go: shown.capsules() ? ['Capsules', 'capsules'] : null,
    }),
    chip: () => ({
      text: 'Earned by spinning and retiring, or bought with coins at the cashier. Play the casino\'s tables, or spend them at the Prize Counter. Chips never turn back into coins.',
      go: shown.casino() ? ['Casino', 'casino'] : null,
    }),
    whisker: () => ({
      text: 'Brought along by the Great Migration. Spend them on colony perks, which the family keeps for good.',
      go: ['Colony perks', 'family', 'colony'],
    }),
    takings: () => ({
      text: 'The house\'s share of what hamster guests bet in the Family Casino. They collect in its till: empty it, then spend them on cabinets, decor and staff, or on chips and tokens. Takings never turn into coins.',
      go: ['Your casino', 'casino', 'own'],
    }),
    candy: () => {
      const f = game.getFestival();
      const left = f ? `${f.name} runs until ${endText(f.end)}` : 'The festival is over';
      return {
        text: `${left}. Your hamster collects candy every few wins, from every delivery and while you're away. Spend it at the festival stall on outfits you can only get now. Candy left at the end turns into Hamster Tokens.`,
        go: f ? ['the stall', 'capsules', 'festival'] : null,
      };
    },
  };
  // "11-03" → "3 November".
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const endText = (md: string) => { const [m, d] = md.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

  function note(c: Currency): void {
    const info = CURRENCIES[c];
    const key = `wallet:${c}`;
    if (sheet.key === key) { sheet.hide(); return; } // a second tap closes it
    const fresh = sheet.show(key, { icon: info.sprite, iconSize: 24, title: info.name[0].toUpperCase() + info.name.slice(1), tag: tagFor(c) });
    if (!fresh) return;
    const n = NOTES[c]();
    sheet.body.append(h('p', 'k-note', n.text));
    if (n.go) {
      const [label, tab, sub] = n.go;
      sheet.foot.append(button({ tone: 'soft', label: `Go to ${label}`, onClick: () => { sheet.hide(); openTab(tab, sub); } }).el);
    }
  }
  const tagFor = (c: Currency) => `${formatAmount(c, amountOf(c))} ${c === 'coin' ? 'coins' : 'held'}${c === 'coin' && rateText() ? ` · ${rateText()}` : ''}`;

  // "+N": every currency at once, each a row you can tap for its note.
  function noteAll(): void {
    if (sheet.key === 'wallet:all') { sheet.hide(); return; }
    if (!sheet.show('wallet:all', { icon: 'coin', iconSize: 24, title: 'Your purse', tag: '' })) return;
    for (const c of ORDER) {
      if (!purses.get(c)!.shown) continue;
      const row = listRow({ icon: CURRENCIES[c].sprite, title: CURRENCIES[c].name[0].toUpperCase() + CURRENCIES[c].name.slice(1) });
      row.update({ value: formatAmount(c, amountOf(c)) });
      const tap = h('button', 'k-row-tap');
      tap.type = 'button';
      tap.setAttribute('aria-label', `About ${CURRENCIES[c].name}`);
      tap.addEventListener('click', () => { sheet.hide(); note(c); });
      row.el.prepend(tap);
      sheet.body.append(row.el);
    }
  }

  // ── every frame ──

  let shownCoins = game.state.coins; // the counter "rolls" towards the real value
  let lastTitle = 0;
  let lastFold = '';

  function isShown(c: Currency): boolean {
    const s = game.state;
    switch (c) {
      case 'coin': return true;
      case 'seed': return s.seeds.gt(0) || s.seedsEarned.gt(0) || s.colony > 0;
      case 'token': return shown.capsules(); // (told about once the Capsules tab shows)
      case 'chip': return shown.casino();
      case 'whisker': return s.colony > 0 || s.whiskers.gt(0);
      case 'takings': return game.isOwnCasinoOpen();
      case 'candy': return !!game.getFestival(); // Pumpkin Night: only while a festival is on
    }
  }

  function render(now: number, realDt: number): void {
    const s = game.state;
    // The coin counter rolls toward the real value instead of jumping. It lands on it once
    // it's within a cent, or (for huge amounts) within a billionth of it.
    const diff = s.coins.sub(shownCoins);
    shownCoins = diff.abs().lt(s.coins.abs().mul(1e-9).max(0.01)) ? s.coins : shownCoins.add(diff.mul(Math.min(1, realDt * 14)));
    const coin = purses.get('coin')!;
    setText(coin.num, formatCoins(shownCoins));
    setText(coin.rate!, rateText());
    let extra = 0;
    for (const c of ORDER) {
      if (c === 'coin') continue;
      const p = purses.get(c)!;
      const show = isShown(c);
      if (show !== p.shown) {
        p.shown = show;
        p.el.classList.toggle('hidden', !show);
        // 1.9.0: a currency that's new to the family while you play (not one there on loading) unlocks.
        if (show && drawn) appeared(p.el, `purse:${c}`, more.el); // (on a phone it's in the "+N" fold)
      }
      if (show) {
        extra++;
        // formatAmount, like the purse's sheet: Takings get their K/M/B and are shown whole.
        setText(p.num, formatAmount(c, amountOf(c)));
      }
    }
    drawn = true;
    // The fold's count (whether it shows at all is the phone layout's call: styles/hud.css).
    const fold = String(extra);
    if (fold !== lastFold) {
      lastFold = fold;
      more.update({ label: `+${extra}` });
      more.el.classList.toggle('hidden', extra === 0);
    }
    // The note open in the sheet keeps its numbers live.
    if (sheet.key && sheet.key.startsWith('wallet:') && sheet.key !== 'wallet:all') sheet.setTag(tagFor(sheet.key.slice(7) as Currency));
    showSound();
    // Coins in the browser tab's title, so you can peek from another tab (twice a second).
    if (now - lastTitle > 500) {
      lastTitle = now;
      const title = `${formatCoins(s.coins)} coins · Hamster Slots`;
      if (document.title !== title) document.title = title;
    }
  }

  return {
    render,
    // Where flying coins land (the coin counter's icon).
    coinTarget: () => coin().el.querySelector('img') as HTMLElement,
    purse: (c: Currency) => purses.get(c)!.el,
    // A counter pops when it gains.
    pop(c: Currency) { replayClass(purses.get(c)!.el, 'gain'); },
    // After a retirement or a migration, jump to the new amount instead of rolling down from millions.
    resetCoins() { shownCoins = game.state.coins; },
    showSound,
  };
  function coin() { return purses.get('coin')!; }
}
export type Hud = ReturnType<typeof createHud>;
