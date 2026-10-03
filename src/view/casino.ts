// casino.ts — VIEW layer (M11). The Casino tab: the chips bar (buy chips with
// coins), the bet, four tables and the Prize Counter, plus the little boost
// badges on the cage. The tables:
//   Roulette   — tap spots on the board to put chips on them, then Spin: the hamster's
//                ball rolls round the wheel and drops into a pocket.
//   Blackjack  — Deal, then Hit / Stand / Double against the hamster dealer.
//   Derby      — pick a hamster, then Race!
//   Seed Drop  — drop a seed down the pegs into a bin (several can fall at once).
// Like every view file it only calls game actions (playRoulette, dealBlackjack …)
// and reads the state. Every game is decided the moment you play it (logic,
// casino.ts); the wheel, the cards, the race and the seed only show it (D92), and
// the chips counter waits for them, so a win lands when the ball does.

import { formatCoins, setText, setHTML, iconHTML, replayClass, mix } from './dom.ts';
import { createSubTabs, card, chip, h } from './kit.ts';
import { createOwnCasinoView } from './owncasino.ts';
import { spriteImg, applySprite, runFrame, SUIT_SPRITES } from './art.ts';
import { furPalette, skinPreview } from './skins.ts';
import { WHEEL_ORDER, POCKETS, pocketColor } from '../logic/roulette.ts';
import type { RouletteKind } from '../logic/roulette.ts';
import { handValue } from '../logic/blackjack.ts';
import type { BjCard } from '../logic/blackjack.ts';
import type { Sound } from './sound.ts';
import type { Fx } from './fx.ts';
import type { Game } from '../logic/game.ts';
import type { GameEvents, PrizeDef, BlackjackHand } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';

// How long the shows take (view only; the game has already decided).
const ROULETTE_MS = 3200;
const REVEAL_STEP_MS = 450; // the dealer turns its cards over one by one
const RACE_MS = 3600;
const PEG_MS = 150; // a seed falls one row of pegs in this long
const QUICK_MS = 250; // with Motion "Less" everything just lands

// What each racer looks like (fur colours from skins.ts), in data.json's order.
const RACER_FURS = ['furClassic', 'furCinnamon', 'furSnowball', 'furCocoa', 'furLavender'];
// The Prize Counter's pictures (skins show themselves).
const PRIZE_ICONS: Record<string, string> = { goldenHour: 'star', turboWheel: 'bolt', luckyCharm: 'clover', tokenBag: 'token' };
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createCasinoView(
  game: Game,
  { say, sound, fx, lessMotion, settings, onSettingsChange }:
    { say: (text: string, ms?: number) => void; sound: Sound; fx: Fx; lessMotion: () => boolean; settings: Settings; onSettingsChange: () => void },
) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    panel: $('tab-casino'), chips: $('chip-count'), buy: $('chip-buy'), chipNote: $('chip-note'), chipPrice: $('chip-price'), bet: $('casino-bet'),
    betDown: $<HTMLButtonElement>('cbet-down'), betUp: $<HTMLButtonElement>('cbet-up'), betValue: $('cbet-value'),
    wheel: $<HTMLCanvasElement>('roulette-wheel'), rResult: $('roulette-result'), rHistory: $('roulette-history'), board: $('roulette-board'),
    rClear: $<HTMLButtonElement>('roulette-clear'), rSpin: $<HTMLButtonElement>('roulette-spin'), rNote: $('roulette-note'),
    bjDealer: $('bj-dealer'), bjPlayer: $('bj-player'), bjDealerTotal: $('bj-dealer-total'), bjPlayerTotal: $('bj-player-total'), bjResult: $('bj-result'),
    bjDeal: $<HTMLButtonElement>('bj-deal'), bjHit: $<HTMLButtonElement>('bj-hit'), bjStand: $<HTMLButtonElement>('bj-stand'), bjDouble: $<HTMLButtonElement>('bj-double'),
    bjHint: $('bj-hint'), bjNote: $('bj-note'),
    track: $('derby-track'), dResult: $('derby-result'), dRun: $<HTMLButtonElement>('derby-run'), dNote: $('derby-note'),
    dropBoard: $('drop-board'), dropResult: $('drop-result'), dropBtn: $<HTMLButtonElement>('drop-btn'), dropNote: $('drop-note'),
    prizes: $('prize-grid'), badges: $('boost-badges'), chipBar: $('chip-bar'), loyalty: $('loyalty-card'),
  };
  const subtabs = createSubTabs($('casino-subtabs'), el.panel, { key: 'casino', settings, onSettingsChange });
  // M12: the Family Casino, on its own sub-tab (shown once a migrated family has it).
  let tillFull = false;
  const own = game.data.ownCasino && game.data.ownCasino.enabled
    ? createOwnCasinoView(game, { root: $('own-casino'), say, sound, fx, lessMotion, onFullTill: (full) => { tillFull = full; } })
    : null;
  const casino = () => game.data.casino!;
  const enabled = () => !!game.data.casino && game.data.casino.enabled; // (a build can leave the casino out)
  const chips = () => game.state.casino.chips.toNumber();
  const steps = () => game.getCasinoBetSteps();
  let betIndex = 0;
  const bet = () => steps()[Math.min(betIndex, steps().length - 1)];
  const quick = () => lessMotion();
  const chipsText = (n: number) => (Math.abs(n) < 10000 ? Math.round(n).toLocaleString('en-US') : formatCoins(n));
  const chipIcon = (size = 24) => iconHTML('chip', size);

  // A win is "on its way" until its show ends: the counter doesn't count it yet.
  const pending: { amount: number; at: number }[] = [];
  function owed(amount: number, at: number): void {
    if (amount > 0) pending.push({ amount, at });
  }
  function shownChips(now: number): number {
    for (let i = pending.length - 1; i >= 0; i--) if (now >= pending[i].at) pending.splice(i, 1);
    return chips() - pending.reduce((s, p) => s + p.amount, 0);
  }

  // ─────────────────────── chips and the bet ───────────────────────

  // A chip's price takes some maths (every machine you own), so it's worked out
  // again only when something that changes it happens, or every few seconds.
  let price = 0;
  let priceAt = -Infinity;
  const priceDirty = () => { priceAt = -Infinity; };
  for (const name of ['upgradeBought', 'machineBought', 'skinEquipped', 'retired', 'bigCageLeft', 'stateLoaded', 'dataReloaded', 'prizeBought', 'boostEnded'] as const) {
    game.on(name, priceDirty);
  }

  const buyButtons: { count: number; btn: HTMLButtonElement }[] = [];
  function buildChipBar(): void {
    el.buy.replaceChildren();
    buyButtons.length = 0;
    for (const count of casino().buyAmounts) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-card chip-buy-btn';
      btn.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        if (game.buyChips(count)) {
          sound.play('chip');
          fx.burstAt(el.chips, { count: 10, palette: [fx.colors.gold[0], '#ffffff'], speed: 160 });
          priceDirty();
        } else sound.play('error');
      });
      el.buy.appendChild(btn);
      buyButtons.push({ count, btn });
    }
  }
  // The bet: − and + step through data.json's bet steps (10, 20, 50 … chips).
  for (const [btn, dir] of [[el.betDown, -1], [el.betUp, 1]] as [HTMLButtonElement, number][]) {
    btn.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      const next = Math.min(steps().length - 1, Math.max(0, betIndex + dir));
      if (next === betIndex) return;
      betIndex = next;
      sound.play('bet', dir > 0);
    });
  }

  // ─────────────────────── Roulette ───────────────────────

  const spots = new Map<string, number>(); // "red:0", "number:17" … → chips on it
  const spotEls = new Map<string, HTMLButtonElement>();
  const spotKey = (kind: RouletteKind, pick: number) => `${kind}:${pick}`;
  // A spin being shown. ball0: a little random head start for the ball, so no two spins look the same.
  let spin: { pocket: number; start: number; duration: number; rot0: number; turns: number; ball0: number; e: GameEvents['rouletteSpun'] } | null = null;
  let lastPocket: number | null = null;
  const history: number[] = [];
  let rot = 0; // the wheel's angle when it's at rest
  let wheelKey = '';

  function buildBoard(): void {
    el.board.replaceChildren();
    spotEls.clear();
    const add = (kind: RouletteKind, pick: number, label: string, cls: string, col: string, row: string) => {
      const b = document.createElement('button');
      b.className = `rspot ${cls}`;
      b.style.gridColumn = col;
      b.style.gridRow = row;
      b.innerHTML = `<span class="rspot-label">${label}</span><span class="rspot-chip hidden"></span>`;
      b.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        placeBet(kind, pick);
      });
      el.board.appendChild(b);
      spotEls.set(spotKey(kind, pick), b);
    };
    add('number', 0, '0', 'green', '1', '1 / span 3');
    for (let n = 1; n <= 36; n++) {
      const col = Math.ceil(n / 3) + 1; // 1–3 in the first column of numbers, 4–6 in the next …
      const row = 3 - ((n - 1) % 3); // 3, 6, 9 … on the top row (a real board's layout)
      add('number', n, String(n), pocketColor(n), String(col), String(row));
    }
    for (let c = 0; c < 3; c++) add('column', c, '2:1', 'outside', '14', String(3 - c));
    ['1st 12', '2nd 12', '3rd 12'].forEach((label, d) => add('dozen', d, label, 'outside', `${2 + d * 4} / span 4`, '4'));
    const even: [RouletteKind, string][] = [['low', '1–18'], ['even', 'Even'], ['red', 'Red'], ['black', 'Black'], ['odd', 'Odd'], ['high', '19–36']];
    even.forEach(([kind, label], i) => add(kind, 0, label, `outside${kind === 'red' || kind === 'black' ? ` ${kind}` : ''}`, `${2 + i * 2} / span 2`, '5'));
  }

  function placeBet(kind: RouletteKind, pick: number): void {
    if (spin) return; // no more bets while the ball rolls
    const key = spotKey(kind, pick);
    const max = steps()[steps().length - 1];
    const now = spots.get(key) || 0;
    if (now >= max) {
      say(`That spot is full: ${chipsText(max)} chips is the table's limit.`);
      sound.play('error');
      return;
    }
    spots.set(key, Math.min(max, now + bet()));
    sound.play('chip');
  }

  function stakedOnBoard(): number {
    let sum = 0;
    for (const v of spots.values()) sum += v;
    return sum;
  }

  el.rClear.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (spin) return;
    spots.clear();
  });
  el.rSpin.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (spin) return;
    if (!spots.size) {
      say('Tap the board to put chips on a number, a colour or a dozen first!');
      return;
    }
    const bets = [...spots].map(([key, amount]) => {
      const [kind, pick] = key.split(':');
      return { kind: kind as RouletteKind, pick: Number(pick), amount };
    });
    if (game.playRoulette(bets)) {
      // On a phone the tab scrolls: bring the wheel into view to watch the ball.
      el.wheel.scrollIntoView({ block: 'nearest', behavior: quick() ? 'auto' : 'smooth' });
    } else {
      say(stakedOnBoard() > chips() ? 'Not enough chips for all of that! Clear some, or buy more.' : 'The table is closed right now.');
      sound.play('error');
    }
  });

  game.on('rouletteSpun', (e) => {
    const duration = quick() ? QUICK_MS : ROULETTE_MS;
    spin = { pocket: e.pocket, start: performance.now(), duration, rot0: rot, turns: 1.5 + Math.random(), ball0: Math.random() * Math.PI * 2, e };
    owed(e.returned.toNumber(), spin.start + duration);
    sound.play('lever');
  });

  // Colours of the wheel, from the theme tokens (read once: they never change).
  let wheelColors: Record<string, [number, number, number]> | null = null;
  function readWheelColors(): Record<string, [number, number, number]> {
    const css = getComputedStyle(document.documentElement);
    const rgb = (name: string): [number, number, number] => {
      const hex = css.getPropertyValue(name).trim().replace('#', '');
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    };
    const lighten = (c: [number, number, number]): [number, number, number] => rgb2(mix(`#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`, '#ffffff', 0.45));
    const rgb2 = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const red = rgb('--pocket-red');
    const black = rgb('--pocket-black');
    const green = rgb('--pocket-green');
    return {
      red, black, green, redHi: lighten(red), blackHi: lighten(black), greenHi: lighten(green),
      wood: rgb('--wheel-wood'), woodDark: rgb('--wheel-wood-dark'), gold: rgb('--gold'), goldDark: rgb('--gold-dark'),
      ink: rgb('--outline-ink'), ball: rgb('--reel-bg'), ballShade: rgb('--ink-faint'), fur: rgb('--primary'),
    };
  }

  // The wheel, painted pixel by pixel on a 96×96 canvas (CSS shows it at 2×, crisp):
  // a wooden rim, 37 pockets in the real order, a wooden cone with gold spokes, and
  // the hamster's ball. `highlight` lights the pocket the ball landed in.
  const W = 96;
  const C = W / 2;
  const STEP = (Math.PI * 2) / POCKETS;
  let image: ImageData | null = null;
  function drawWheel(wheelAngle: number, ball: { a: number; r: number } | null, highlight: number | null): void {
    const ctx = el.wheel.getContext('2d');
    if (!ctx) return;
    if (!wheelColors) wheelColors = readWheelColors();
    const c = wheelColors;
    if (!image) image = ctx.createImageData(W, W);
    const d = image.data;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - C;
        const dy = y + 0.5 - C;
        const r = Math.hypot(dx, dy);
        const i = (y * W + x) * 4;
        let col: [number, number, number] | null = null;
        if (r > 47.5) col = null;
        else if (r > 46) col = c.ink;
        else if (r > 43) col = dy < 0 ? c.wood : c.woodDark; // the rim, lit from the top
        else if (r > 42) col = c.ink;
        else if (r > 32) {
          let a = Math.atan2(dy, dx) - wheelAngle;
          a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const idx = Math.floor(a / STEP);
          const frac = a / STEP - idx;
          const n = WHEEL_ORDER[idx];
          const kind = pocketColor(n);
          if (frac < 0.12 || r < 33) col = c.goldDark; // the frets between pockets
          else col = n === highlight ? c[`${kind}Hi`] : c[kind];
        } else if (r > 31) col = c.ink;
        else if (r > 7) {
          // The cone: a darker track round the outside, then wood with four gold spokes.
          const a = Math.atan2(dy, dx) - wheelAngle;
          const spoke = Math.abs(Math.sin(2 * a)) < 0.09 && r > 10 && r < 26;
          col = r > 26 ? c.woodDark : spoke ? c.gold : r > 25 ? c.goldDark : c.wood;
        } else if (r > 6) col = c.goldDark;
        else col = r < 3 && dx < 0 && dy < 0 ? c.ball : c.gold;
        if (!col) { d[i + 3] = 0; continue; }
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    // The ball: a 5-pixel hamster ball with a little hamster inside (a dot of fur).
    if (ball) {
      const bx = Math.round(C + Math.cos(ball.a) * ball.r - 0.5);
      const by = Math.round(C + Math.sin(ball.a) * ball.r - 0.5);
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          if (Math.abs(ox) === 2 && Math.abs(oy) === 2) continue; // round it off
          const px = bx + ox;
          const py = by + oy;
          if (px < 0 || py < 0 || px >= W || py >= W) continue;
          const edge = Math.abs(ox) === 2 || Math.abs(oy) === 2;
          const col = edge ? c.ink : ox === 0 && oy === 0 ? c.fur : ox + oy > 0 ? c.ballShade : c.ball;
          const i = (py * W + px) * 4;
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  // The angle (on screen) of a pocket's middle when the wheel is at `wheelAngle`.
  const pocketAngle = (pocket: number, wheelAngle: number) => wheelAngle + (WHEEL_ORDER.indexOf(pocket) + 0.5) * STEP;

  let lastTickAt = -1;
  function renderRoulette(now: number): void {
    if (spin) {
      const t = Math.min(1, (now - spin.start) / spin.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const wheelAngle = spin.rot0 + ease * Math.PI * 2 * spin.turns; // the wheel turns one way…
      const end = pocketAngle(spin.pocket, spin.rot0 + Math.PI * 2 * spin.turns);
      // …the ball the other, slowing down, and drops from the rim into its pocket at the end.
      const ballAngle = end - (1 - ease) * (Math.PI * 2 * (spin.turns + 2.5) - spin.ball0);
      const r = t < 0.7 ? 40.5 + 3 * Math.cos(t * 30) * (1 - t) : 37.5;
      drawWheel(wheelAngle, { a: t >= 1 ? pocketAngle(spin.pocket, wheelAngle) : ballAngle, r }, t >= 1 ? spin.pocket : null);
      const tick = Math.floor(ballAngle / STEP);
      if (tick !== lastTickAt && t < 0.95) {
        lastTickAt = tick;
        if (t > 0.3) sound.play('wheelTick', tick);
      }
      if (t >= 1) {
        rot = wheelAngle % (Math.PI * 2);
        landRoulette(spin.e);
        spin = null;
      }
      wheelKey = '';
    } else {
      const key = `${lastPocket}|${rot}`;
      if (key !== wheelKey) {
        wheelKey = key;
        drawWheel(rot, lastPocket === null ? null : { a: pocketAngle(lastPocket, rot), r: 37.5 }, lastPocket);
      }
    }
    // The board: a chip on every spot with a bet, the winning spots lit after a spin.
    for (const [key, b] of spotEls) {
      const amount = spots.get(key) || 0;
      const chip = b.querySelector<HTMLElement>('.rspot-chip')!;
      chip.classList.toggle('hidden', amount <= 0);
      setText(chip, amount > 0 ? chipsText(amount) : '');
    }
    const staked = stakedOnBoard();
    el.rSpin.disabled = !!spin || !game.isCasinoOpen();
    el.rClear.disabled = !!spin || !spots.size;
    setHTML(el.rSpin, staked ? `Spin · ${chipIcon()} ${chipsText(staked)}` : 'Spin');
    setHTML(el.rHistory, history.map((n) => `<span class="rh rh-${pocketColor(n)}">${n}</span>`).join(''));
  }

  function landRoulette(e: GameEvents['rouletteSpun']): void {
    lastPocket = e.pocket;
    history.unshift(e.pocket);
    history.length = Math.min(history.length, 10);
    for (const [key, b] of spotEls) b.classList.toggle('won', e.bets.some((x) => spotKey(x.kind, x.pick) === key && x.returned.gt(0)));
    const colour = pocketColor(e.pocket);
    const name = `${e.pocket} ${colour === 'green' ? 'Green' : colour === 'red' ? 'Red' : 'Black'}`;
    const back = e.returned.toNumber();
    if (back > 0) {
      result(el.rResult, `<b>${name}!</b> You win ${chipIcon()} <b class="num">${chipsText(back)}</b>`, 'win');
      sound.play(back >= e.staked.toNumber() * 10 ? 'jackpot' : 'gambleWin');
      fx.burstAt(el.wheel, { count: back >= e.staked.toNumber() * 10 ? 40 : 18, palette: fx.colors.gold, speed: 200 });
      if (e.bets.some((b) => b.kind === 'number' && b.returned.gt(0))) say(`${e.pocket}! Right on the number!`, 3500);
    } else {
      result(el.rResult, `<b>${name}.</b> No luck this time.`, 'lose');
      sound.play('gambleLose');
    }
  }

  // ─────────────────────── Blackjack ───────────────────────

  // The view's timeline of a hand: when it ended, and how far the dealer's cards are shown.
  let reveal: { at: number; hand: BlackjackHand; shownResult: boolean } | null = null;
  let bjKey = '';
  let bjHand: BlackjackHand | null = null; // the hand on the table when it was last drawn (a new deal = a new object)

  function cardEl(card: BjCard | null, fresh: boolean): HTMLElement {
    const div = document.createElement('div');
    div.className = `bj-card${card ? '' : ' back'}${fresh && !quick() ? ' deal' : ''}`;
    if (!card) {
      div.appendChild(spriteImg('cardBack', 48));
      return div;
    }
    const red = card.suit === 'hearts' || card.suit === 'diamonds';
    div.classList.add(red ? 'red' : 'black');
    div.innerHTML = `<span class="bj-rank">${RANKS[card.rank]}</span>`;
    div.appendChild(spriteImg(SUIT_SPRITES[card.suit], 16));
    return div;
  }

  game.on('blackjackChanged', (e) => {
    sound.play('card');
    if (e.hand.outcome !== null) {
      // The dealer turns over its hole card, then draws one card at a time.
      const at = performance.now();
      reveal = { at, hand: e.hand, shownResult: false };
      const extra = Math.max(0, e.hand.dealer.length - 2);
      owed(e.hand.returned.toNumber(), at + (quick() ? 0 : REVEAL_STEP_MS * (extra + 1)));
    } else reveal = null;
  });

  function bjAction(fn: () => boolean) {
    return (e: Event) => {
      (e.currentTarget as HTMLElement).blur();
      if (revealing()) return;
      if (!fn()) sound.play('error');
    };
  }
  el.bjDeal.addEventListener('click', bjAction(() => {
    if (chips() < bet()) {
      say('Not enough chips for that bet! Pick a smaller one, or buy chips.');
      return false;
    }
    el.bjResult.dataset.html = '';
    setHTML(el.bjResult, '');
    return game.dealBlackjack(bet());
  }));
  el.bjHit.addEventListener('click', bjAction(() => game.hitBlackjack()));
  el.bjStand.addEventListener('click', bjAction(() => game.standBlackjack()));
  el.bjDouble.addEventListener('click', bjAction(() => game.doubleBlackjack()));

  // How many of the dealer's cards are face up right now (the hole card = card 2).
  function dealerShown(now: number): number {
    const hand = game.state.casino.hand;
    if (!hand) return 0;
    if (hand.outcome === null) return 1;
    if (!reveal || quick()) return hand.dealer.length;
    return Math.min(hand.dealer.length, 2 + Math.floor((now - reveal.at) / REVEAL_STEP_MS));
  }
  // The hand has ended but its result isn't shown yet (the dealer is still turning cards over).
  const revealing = () => !!reveal && !reveal.shownResult;

  function renderBlackjack(now: number): void {
    const hand = game.state.casino.hand;
    const shown = dealerShown(now);
    const key = hand ? `${hand.player.length}|${shown}|${hand.outcome}|${hand.player.map((c) => c.rank).join(',')}` : 'none';
    if (key !== bjKey || hand !== bjHand) {
      // Cards that weren't on the table before are dealt in (all of them for a new hand).
      const [oldPlayer, oldShown] = hand === bjHand ? bjKey.split('|').map(Number) : [0, 0];
      bjKey = key;
      bjHand = hand;
      el.bjPlayer.replaceChildren(...(hand ? hand.player.map((c, i) => cardEl(c, i >= (oldPlayer || 0))) : []));
      el.bjDealer.replaceChildren(...(hand ? hand.dealer.slice(0, Math.max(shown, 2)).map((c, i) => cardEl(i < shown ? c : null, i >= (oldShown || 0) && i < shown)) : []));
      if (hand && shown > (oldShown || 0) && hand.outcome !== null) sound.play('card');
    }
    const visible = hand ? hand.dealer.slice(0, shown) : [];
    setText(el.bjPlayerTotal, hand ? String(handValue(hand.player).total) : '');
    setText(el.bjDealerTotal, hand ? `${handValue(visible).total}${shown < hand.dealer.length ? ' + ?' : ''}` : '');
    // The result, once the dealer's last card is shown.
    if (reveal && !reveal.shownResult && hand && shown >= hand.dealer.length && now - reveal.at >= (quick() ? 0 : REVEAL_STEP_MS * Math.max(0, hand.dealer.length - 2))) {
      reveal.shownResult = true;
      showHandResult(hand);
    }
    const inPlay = !!hand && hand.outcome === null;
    const busy = revealing();
    el.bjDeal.disabled = inPlay || busy || !game.isCasinoOpen();
    setHTML(el.bjDeal, `Deal · ${chipIcon()} ${chipsText(bet())}`);
    el.bjHit.disabled = !inPlay;
    el.bjStand.disabled = !inPlay;
    el.bjDouble.disabled = !inPlay || !game.canDouble();
    const hint = game.getBlackjackHint();
    const words = { hit: 'hit (take a card)', stand: 'stand (keep what you have)', double: 'double down (bet ×2, one more card)' };
    setHTML(el.bjHint, hint ? `Tip: the best play here is to <b>${words[hint]}</b>.` : hand ? '' : 'Get closer to 21 than the dealer without going over. Pick a bet and Deal!');
  }

  function showHandResult(hand: BlackjackHand): void {
    const back = hand.returned.toNumber();
    const text = {
      blackjack: `<b>Blackjack!</b> You win ${chipIcon()} <b class="num">${chipsText(back)}</b>`,
      win: `<b>You win!</b> ${chipIcon()} <b class="num">${chipsText(back)}</b>`,
      push: `<b>A tie.</b> Your ${chipsText(back)} chips come back.`,
      lose: `<b>The dealer wins.</b>`,
      bust: `<b>Bust!</b> Over 21.`,
    }[hand.outcome!];
    result(el.bjResult, text, back > hand.bet.toNumber() ? 'win' : back > 0 ? '' : 'lose');
    if (hand.outcome === 'blackjack') {
      sound.play('jackpot');
      fx.burstAt(el.bjPlayer, { count: 36, palette: fx.colors.gold, speed: 220 });
      say('Blackjack! An Ace and a ten!', 3000);
    } else if (hand.outcome === 'win') sound.play('gambleWin');
    else if (hand.outcome !== 'push') sound.play('gambleLose');
  }

  // ─────────────────────── the Hamster Derby ───────────────────────

  let racerId = '';
  let race: { start: number; duration: number; e: GameEvents['derbyRun']; finish: Record<string, number>; phase: Record<string, number>; done: boolean } | null = null;
  const lanes = new Map<string, { lane: HTMLButtonElement; runner: HTMLImageElement }>();

  function buildTrack(): void {
    el.track.replaceChildren();
    lanes.clear();
    const racers = casino().derby.racers;
    const odds = game.getCasinoOdds()!.derby;
    racerId = racerId || racers[0].id;
    racers.forEach((r, i) => {
      const lane = document.createElement('button');
      lane.className = 'derby-lane';
      const o = odds.find((x) => x.id === r.id)!;
      lane.innerHTML = `<span class="derby-name"><b>${r.name}</b><span class="note">×${r.pays} · ${Math.round(o.chance * 100)}%</span></span>
        <span class="derby-run"><span class="derby-finish"></span></span>`;
      const runner = spriteImg('hamster', 32, r.name[0], furPalette(RACER_FURS[i % RACER_FURS.length])) as HTMLImageElement;
      runner.classList.add('derby-runner');
      lane.querySelector('.derby-run')!.appendChild(runner);
      lane.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        if (race && !race.done) return;
        racerId = r.id;
        sound.play('switch');
      });
      el.track.appendChild(lane);
      lanes.set(r.id, { lane, runner });
    });
  }

  el.dRun.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (race && !race.done) return;
    if (chips() < bet()) {
      say('Not enough chips for that bet! Pick a smaller one, or buy chips.');
      sound.play('error');
      return;
    }
    if (!game.runDerby(racerId, bet())) sound.play('error');
  });

  game.on('derbyRun', (e) => {
    const duration = quick() ? QUICK_MS : RACE_MS;
    const finish: Record<string, number> = {};
    const phase: Record<string, number> = {};
    for (const r of casino().derby.racers) {
      finish[r.id] = r.id === e.winner ? 1 : 1.05 + Math.random() * 0.22; // the others cross the line a little later
      phase[r.id] = Math.random() * Math.PI * 2;
    }
    race = { start: performance.now(), duration, e, finish, phase, done: false };
    owed(e.returned.toNumber(), race.start + duration);
    sound.play('lever');
    el.dResult.dataset.html = '';
    setHTML(el.dResult, '<b>They\'re off!</b>');
  });

  function renderDerby(now: number): void {
    for (const [id, { lane, runner }] of lanes) {
      lane.classList.toggle('picked', id === racerId);
      let p = 0;
      if (race) {
        const t = (now - race.start) / race.duration;
        const f = race.finish[id];
        const x = Math.min(1, t / f);
        // A dash with a wobble: each hamster speeds up and slows down on its own.
        p = Math.min(1, x + (x < 1 && x > 0 ? Math.sin(x * 9 + race.phase[id]) * 0.035 * (1 - x) : 0));
        lane.classList.toggle('winner', race.done && id === race.e.winner);
        applySprite(runner, x < 1 && t > 0 ? runFrame(now + id.length * 37, 70) : race.done && id === race.e.winner ? 'hamsterCheer' : 'hamster', 32,
          furPalette(RACER_FURS[casino().derby.racers.findIndex((r) => r.id === id) % RACER_FURS.length]));
      } else lane.classList.remove('winner');
      runner.style.left = `calc((100% - 32px) * ${p.toFixed(4)})`;
    }
    if (race && !race.done && now - race.start >= race.duration) {
      race.done = true;
      const winner = casino().derby.racers.find((r) => r.id === race!.e.winner)!;
      const back = race.e.returned.toNumber();
      if (back > 0) {
        result(el.dResult, `<b>${winner.name} wins!</b> You win ${chipIcon()} <b class="num">${chipsText(back)}</b>`, 'win');
        sound.play(winner.id === casino().derby.longshot ? 'jackpot' : 'gambleWin');
        fx.burstAt(lanes.get(winner.id)!.runner, { count: 24, palette: fx.colors.gold, speed: 200 });
        if (winner.id === casino().derby.longshot) say(`${winner.name} did it! The long shot wins!`, 3500);
      } else {
        result(el.dResult, `<b>${winner.name} wins.</b> Your hamster was just behind!`, 'lose');
        sound.play('gambleLose');
      }
    }
    el.dRun.disabled = (!!race && !race.done) || !game.isCasinoOpen();
    const picked = casino().derby.racers.find((r) => r.id === racerId);
    setHTML(el.dRun, `Race! · ${picked ? picked.name : ''} · ${chipIcon()} ${chipsText(bet())}`);
  }

  // ─────────────────────── Seed Drop ───────────────────────

  const drops: { path: number[]; bin: number; start: number; seed: HTMLElement; row: number; e: GameEvents['seedDropped'] }[] = [];
  const bins: HTMLElement[] = [];
  const rows = () => casino().seedDrop.multipliers.length - 1;
  // Where the seed is at row r of the board, in % of the board: x from the middle, y from the top.
  const spot = (rights: number, r: number) => ({ x: 50 + (rights - r / 2) * (80 / (rows() + 1)), y: 6 + r * (70 / rows()) });

  function buildDropBoard(): void {
    el.dropBoard.replaceChildren();
    bins.length = 0;
    const n = rows();
    for (let r = 0; r < n; r++) {
      for (let k = 0; k <= r; k++) {
        const peg = document.createElement('span');
        peg.className = 'peg';
        const p = spot(k, r);
        peg.style.left = `${p.x}%`;
        peg.style.top = `${p.y + 3}%`;
        el.dropBoard.appendChild(peg);
      }
    }
    const m = casino().seedDrop.multipliers;
    const top = Math.max(...m);
    m.forEach((mult, k) => {
      const bin = document.createElement('span');
      bin.className = `bin${mult === top ? ' top' : mult >= 1 ? ' good' : ''}`;
      const p = spot(k, n);
      bin.style.left = `${p.x}%`;
      bin.innerHTML = `<b class="num">×${mult}</b>`;
      el.dropBoard.appendChild(bin);
      bins.push(bin);
    });
  }

  el.dropBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (drops.length >= 12) return; // plenty in the air already
    if (chips() < bet()) {
      say('Not enough chips for that bet! Pick a smaller one, or buy chips.');
      sound.play('error');
      return;
    }
    if (!game.dropSeed(bet())) sound.play('error');
  });

  game.on('seedDropped', (e) => {
    const seed = spriteImg('heirloom', 24) as HTMLElement;
    seed.classList.add('drop-seed');
    el.dropBoard.appendChild(seed);
    const start = performance.now();
    drops.push({ path: e.path, bin: e.bin, start, seed, row: -1, e });
    owed(e.returned.toNumber(), start + (quick() ? 0 : PEG_MS * (e.path.length + 1)));
    sound.play('chip');
  });

  function renderDrop(now: number): void {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const n = d.path.length;
      const t = quick() ? n + 1 : (now - d.start) / PEG_MS; // rows fallen so far
      if (t >= n + 1) {
        d.seed.remove();
        drops.splice(i, 1);
        landDrop(d.e);
        continue;
      }
      // Between the peg it hit (row r) and the next one, with a little hop off the peg.
      const r = Math.floor(t);
      const f = t - r;
      const rightsBefore = d.path.slice(0, r).reduce((s, x) => s + x, 0);
      const a = spot(rightsBefore, Math.min(r, n));
      const b = r >= n ? { x: spot(d.bin, n).x, y: 92 } : spot(rightsBefore + d.path[r], r + 1);
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f - Math.sin(Math.PI * f) * 3;
      d.seed.style.left = `${x}%`;
      d.seed.style.top = `${y}%`;
      if (r !== d.row) {
        d.row = r;
        if (r < n) sound.play('peg', r);
      }
    }
    el.dropBtn.disabled = drops.length >= 12 || !game.isCasinoOpen();
    setHTML(el.dropBtn, `Drop a seed · ${chipIcon()} ${chipsText(bet())}`);
  }

  function landDrop(e: GameEvents['seedDropped']): void {
    const bin = bins[e.bin];
    if (bin) replayClass(bin, 'hit');
    const back = e.returned.toNumber();
    const bet = e.bet.toNumber();
    const edge = e.bin === 0 || e.bin === e.path.length;
    result(el.dropResult, `×${e.multiplier}: ${back > 0 ? `${chipIcon()} <b class="num">${chipsText(back)}</b>` : 'nothing'} back for ${chipsText(bet)}`, back > bet ? 'win' : back < bet ? 'lose' : '');
    if (edge) {
      sound.play('jackpot');
      if (bin) fx.burstAt(bin, { count: 40, palette: fx.colors.gold, speed: 240 });
      say('The very edge! The biggest bin!', 3000);
    } else sound.play(back > bet ? 'win' : 'reelStop', 0, true);
  }

  // ─────────────────────── the Prize Counter ───────────────────────

  const prizeTiles = new Map<string, { tile: HTMLElement; state: HTMLElement; btn: HTMLButtonElement; bar: HTMLElement | null }>();
  function buildPrizes(): void {
    el.prizes.replaceChildren();
    prizeTiles.clear();
    for (const p of casino().prizes) {
      const tile = document.createElement('div');
      tile.className = 'tile prize-tile';
      tile.innerHTML = `<div class="prize-head"><span class="prize-icon"></span><div><div class="tile-name"></div><div class="note prize-desc"></div></div></div>
        ${p.kind === 'boost' || p.kind === 'charm' ? '<div class="prize-bar"><div class="prize-fill"></div></div>' : ''}
        <div class="note prize-state"></div><button class="buy-btn prize-btn"></button>`;
      const icon = tile.querySelector('.prize-icon')!;
      const skin = p.kind === 'skin' ? game.getSkinDef(p.skin) : null;
      icon.appendChild(skin ? skinPreview(skin, 48) : spriteImg(PRIZE_ICONS[p.id] || 'chip', 48));
      tile.querySelector('.tile-name')!.textContent = p.name;
      tile.querySelector('.prize-desc')!.textContent = p.description;
      const btn = tile.querySelector<HTMLButtonElement>('.prize-btn')!;
      btn.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        if (p.kind === 'skin' && game.isSkinOwned(p.skin)) {
          if (game.equipSkin(p.skin)) say(`The ${p.name}! How do I look?`);
          return;
        }
        if (game.buyPrize(p.id)) boughtPrize(p, tile);
        else sound.play('error');
      });
      el.prizes.appendChild(tile);
      prizeTiles.set(p.id, { tile, state: tile.querySelector('.prize-state')!, btn, bar: tile.querySelector('.prize-fill') });
    }
  }

  function boughtPrize(p: PrizeDef, tile: HTMLElement): void {
    sound.play(p.kind === 'skin' ? 'epic' : 'buy');
    fx.burstAt(tile, { count: p.kind === 'skin' ? 30 : 14, palette: [fx.colors.gold[0], '#ffffff'], speed: 200 });
    const lines: Record<string, string> = {
      boost: p.kind === 'boost' && p.effect.type === 'payoutMultiplier' ? 'Golden Hour! Everything pays more!' : 'Zoom zoom! I\'m running faster!',
      charm: 'A Lucky Charm! I feel lucky already.',
      tokens: 'A Hamster Token for the Capsule Machine!',
      skin: `The ${p.name}! It's mine now (the Wardrobe has it).`,
    };
    say(lines[p.kind]);
  }

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function renderPrizes(): void {
    const boosts = new Map(game.getBoosts().map((b) => [b.id, b]));
    for (const p of casino().prizes) {
      const t = prizeTiles.get(p.id)!;
      const block = game.getPrizeBlock(p.id);
      const b = boosts.get(p.id);
      let state = '';
      if (p.kind === 'boost') state = b ? `Running: ${clock(b.left)} left (up to ${clock(p.maxSeconds)})` : `${clock(p.seconds)} of play a time, up to ${clock(p.maxSeconds)}`;
      else if (p.kind === 'charm') state = b ? `${Math.ceil(b.left)} paid spins left (up to ${p.maxSpins})` : `${p.spins} paid spins a time, up to ${p.maxSpins}`;
      else if (p.kind === 'tokens') state = `You have ${chipsText(game.state.tokens.toNumber())} tokens`;
      else state = game.isSkinOwned(p.skin) ? (game.getEquippedSkin(game.getSkinDef(p.skin)!.category) === p.skin ? 'Wearing it' : 'Yours! In the Wardrobe') : 'Only here';
      setText(t.state, state);
      if (t.bar) t.bar.style.width = `${b ? Math.min(100, (b.left / b.max) * 100).toFixed(1) : 0}%`;
      const owned = p.kind === 'skin' && game.isSkinOwned(p.skin);
      const wearing = owned && game.getEquippedSkin(game.getSkinDef((p as { skin: string }).skin)!.category) === (p as { skin: string }).skin;
      t.btn.disabled = owned ? wearing : block !== null;
      t.btn.classList.toggle('ready', !owned && block === null);
      setHTML(t.btn, owned ? (wearing ? 'Wearing' : 'Wear it') : block === 'full' ? 'Full up' : `${chipIcon()} ${chipsText(p.cost)}`);
      t.tile.classList.toggle('ready', !owned && block === null);
      t.tile.classList.toggle('running', !!b);
    }
  }

  // The boosts running now, as little tags on the cage (always, not just in this tab).
  function renderBadges(): void {
    const html = game.getBoosts().map((b) => {
      const left = b.kind === 'boost' ? clock(b.left) : `${Math.ceil(b.left)} spins`;
      return `<span class="boost-badge" title="${b.name}">${iconHTML(PRIZE_ICONS[b.id] || 'chip', 16)}<b class="num">${left}</b></span>`;
    }).join('');
    setHTML(el.badges, html);
  }

  // ─────────────────────── the Loyalty Card ───────────────────────
  // A paper card on the Prizes sub-tab: your tier, a row of stamps (a paw print for
  // every share of the chips bet on the way to the next tier) and what each tier gives.

  let loyaltyCard: { tier: ReturnType<typeof chip>; stamps: HTMLElement[]; next: HTMLElement; rows: HTMLElement[] } | null = null;
  let loyaltyKey = '';
  function buildLoyalty(): void {
    el.loyalty.replaceChildren();
    loyaltyCard = null;
    loyaltyKey = '';
    const l = game.getLoyalty();
    if (!l) return;
    const c = card({ tone: 'gold', title: l.name, icon: 'coupon', className: 'loyalty' });
    const tier = chip(l.tierName, 'gold');
    c.head.append(tier.el);
    const row = c.body.appendChild(h('div', 'loyalty-stamps'));
    const stamps: HTMLElement[] = [];
    for (let i = 0; i < l.stampsPerTier; i++) {
      const slot = row.appendChild(h('span', 'loyalty-stamp'));
      slot.append(spriteImg('paw', 16));
      stamps.push(slot);
    }
    const next = c.body.appendChild(h('div', 'note loyalty-next'));
    const list = c.body.appendChild(h('ul', 'loyalty-tiers'));
    const rows = l.tiers.map((t) => {
      const li = list.appendChild(h('li', ''));
      const perks = [`${t.tokens} token${t.tokens === 1 ? '' : 's'}`];
      for (const b of t.betSteps || []) perks.push(`bets up to ${chipsText(b)}`);
      if (t.lounge) perks.push('the VIP lounge');
      li.innerHTML = `<b></b> <span class="num"></span> <span class="note"></span>`;
      li.children[0].textContent = t.name;
      li.children[1].textContent = `${chipsText(t.wagered)} bet`;
      li.children[2].textContent = perks.join(', ');
      return li;
    });
    el.loyalty.appendChild(c.el);
    loyaltyCard = { tier, stamps, next, rows };
  }

  function renderLoyalty(): void {
    const l = game.getLoyalty();
    if (!l || !loyaltyCard) return;
    const key = `${l.tier}:${l.stamps}:${l.toNextStamp}`;
    if (key === loyaltyKey) return;
    loyaltyKey = key;
    loyaltyCard.tier.update(l.tierName);
    loyaltyCard.stamps.forEach((s, i) => s.classList.toggle('on', i < l.stamps));
    loyaltyCard.rows.forEach((r, i) => r.classList.toggle('done', i < l.tier));
    setText(loyaltyCard.next, l.next
      ? `${chipsText(l.toNextStamp)} more chips bet for the next stamp. Fill the card for ${l.next.name}. Every chip you bet counts, win or lose.`
      : 'Every tier reached: the casino\'s best customer!');
  }

  // A tier reached: the hamster says what it opened (the card fills up on the Prizes sub-tab).
  game.on('loyaltyTier', (e) => {
    const opened = [...e.betSteps.map((b) => `bets up to ${chipsText(b)} chips`), ...(e.lounge ? ['the VIP lounge'] : [])];
    say(`${e.name}! ${e.tokens} Hamster Token${e.tokens === 1 ? '' : 's'}${opened.length ? `, and ${opened.join(' and ')}` : ''}!`, 5000);
    sound.play('epic');
    fx.burstAt(el.chipBar, { count: 24, palette: [fx.colors.gold[0], '#ffffff'], speed: 200 });
  });

  // ─────────────────────── shared ───────────────────────

  function result(node: HTMLElement, html: string, kind: 'win' | 'lose' | ''): void {
    node.dataset.html = '';
    setHTML(node, html);
    node.classList.toggle('win', kind === 'win');
    node.classList.toggle('lose', kind === 'lose');
    if (kind === 'win') replayClass(node, 'pop');
  }

  function buildNotes(): void {
    const o = game.getCasinoOdds();
    if (!o) return;
    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const pays = casino().roulette.pays;
    el.rNote.textContent = `Red, black, odd, even, 1–18 and 19–36 pay ×${pays.even}, a dozen or a column ×${pays.dozen}, one number ×${pays.number} (your bet included). `
      + `Every bet gives back ${pct(o.roulette[0].rtp)} on average: the green 0 is the house's edge.`;
    el.bjNote.textContent = `A blackjack (an Ace and a ten) pays ×${1 + o.blackjack.blackjackPays}, a win ×2, a tie gives your bet back. The dealer draws to 17. `
      + `Follow the tips and you get back ${pct(o.blackjack.rtp)} on average.`;
    el.dNote.textContent = `The favourite wins most often but pays least; the long shot pays ×${casino().derby.racers.at(-1)!.pays}. `
      + `Every hamster gives back ${pct(Math.min(...o.derby.map((x) => x.rtp)))}–${pct(Math.max(...o.derby.map((x) => x.rtp)))} on average.`;
    const edge = o.seedDrop.bins[0];
    el.dropNote.textContent = `At every peg the seed bounces left or right. The edge bins pay ×${edge.multiplier} but only 1 seed in ${Math.round(1 / edge.chance)} lands there. `
      + `A drop gives back ${pct(o.seedDrop.rtp)} on average.`;
  }

  function build(): void {
    if (!enabled()) return;
    buildChipBar();
    buildBoard();
    buildTrack();
    buildDropBoard();
    buildPrizes();
    buildLoyalty();
    buildNotes();
    wheelColors = null;
    wheelKey = '';
    bjKey = '';
    priceDirty();
  }

  // Everything that changes every frame. `visible` = the Casino tab is open (the
  // tables only draw then; the boost badges always).
  function render(now: number, visible: boolean): void {
    if (!enabled()) return;
    renderBadges();
    if (!visible) return;
    setText(el.chips, chipsText(shownChips(now)));
    if (now - priceAt > 3000) {
      price = game.getChipPrice().toNumber();
      priceAt = now;
    }
    const coins = game.state.coins.toNumber();
    for (const { count, btn } of buyButtons) {
      btn.disabled = !game.isCasinoOpen() || coins < price * count;
      setHTML(btn, `+${chipsText(count)} · ${iconHTML('coin', 24)} ${formatCoins(price * count)}`);
    }
    setHTML(el.chipPrice, `a chip costs ${iconHTML('coin', 12)} ${formatCoins(price)}`);
    setText(el.chipNote, `Chips cost about ${casino().chipPriceSeconds} s of your family's best earnings. You also earn one every ${casino().chipsPerSpins.spins} paid spins, `
      + `and ${casino().chipsPerRetirement} when a hamster retires. Chips only buy prizes: they never turn back into coins.`);
    subtabs.setHidden('own', !own || !game.isOwnCasinoOpen());
    const current = subtabs.current;
    el.chipBar.classList.toggle('hidden', current === 'own'); // (Takings, not chips, over there)
    el.bet.classList.toggle('hidden', current === 'prizes');
    if (current === 'own' && own) own.render();
    setHTML(el.betValue, `${chipIcon(12)} ${formatCoins(bet())}`);
    el.betValue.classList.toggle('dim', bet() > chips());
    el.betDown.disabled = betIndex <= 0;
    el.betUp.disabled = betIndex >= steps().length - 1;
    if (current === 'roulette') renderRoulette(now);
    if (current === 'blackjack') renderBlackjack(now);
    if (current === 'derby') renderDerby(now);
    if (current === 'drop') renderDrop(now);
    if (current === 'prizes') { renderPrizes(); renderLoyalty(); }
    el.panel.classList.toggle('vip', !!game.getLoyalty()?.lounge); // the VIP lounge: brass rails round the tables
    // A game still showing on another sub-tab finishes by itself (the chips were paid already).
    if (current !== 'roulette' && spin && now - spin.start >= spin.duration) renderRoulette(now);
    if (current !== 'derby' && race && !race.done && now - race.start >= race.duration) renderDerby(now);
    if (current !== 'drop' && drops.length) renderDrop(now);
    subtabs.setDot('prizes', casino().prizes.some((p) => p.kind === 'skin' && game.canBuyPrize(p.id)));
    subtabs.setDot('own', game.isOwnCasinoOpen() && (tillFull || game.isTillFull()));
  }

  build();
  return { build, render, openSub: subtabs.open };
}
