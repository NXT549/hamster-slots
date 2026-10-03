// owncasino.ts — VIEW layer (M12). The Casino tab's "Your casino" sub-tab: the
// Family Casino a migrated family runs. From the top:
//   the till      — the Takings banked, the till filling (a gauge), Empty the till
//   the floor     — a painted carpet with a cabinet of each machine; hamster guests
//                   play the ones you own, the rest are for sale
//   upgrades      — decor, a room and staff (rule 3 prices, in Takings)
//   back office   — Takings for chips and tokens
// Like every view file it only calls game actions (emptyTill, buyCabinet …) and reads
// the state; the logic (src/logic/owncasino.ts) does every sum.

import { formatCoins, iconHTML, setText } from './dom.ts';
import { h, card, listRow, gauge, button, buyButton, more, amount, formatAmount, pct } from './kit.ts';
import type { BuyButton } from './kit.ts';
import { spriteImg } from './art.ts';
import { furPalette } from './skins.ts';
import { paintCabinet, CABINET_TOKENS, CAB_PX } from './cabinet.ts';
import type { CabinetParts } from './cabinet.ts';
import { Pixmap, readTokens, pixel, mix } from './paint.ts';
import type { Sound } from './sound.ts';
import type { Fx } from './fx.ts';
import type { Game } from '../logic/game.ts';

// The carpet's colours (theme tokens, like every painter: tests check they're in :root).
export const FLOOR_TOKENS = ['--outline-ink', '--danger', '--danger-dark', '--gold', '--gold-dark'] as const;

// A cabinet on the floor, in screen pixels (painted at CAB_PX, like the real machines).
const MINI: CabinetParts = { w: 56, h: 72, sign: { x: 6, y: 4, w: 44, h: 12 }, window: { x: 8, y: 22, w: 40, h: 24 }, meter: null, lever: null };
// The guests' fur (from skins.ts), one per cabinet, so the floor looks busy and mixed.
const GUEST_FURS = ['furClassic', 'furCinnamon', 'furSnowball', 'furCocoa', 'furLavender', 'furClassic', 'furCinnamon', 'furSnowball'];
const UPGRADE_ICONS: Record<string, string> = { neonSign: 'bolt', plushCarpet: 'heart', highLimit: 'highRollerIcon', floorManager: 'glasses', cashier: 'coin' };
const REWARD_ICONS: Record<string, string> = { chipCrate: 'chip', tokenBox: 'token' };

// The carpet: a 16×16 tile, red with a gold diamond and dots, dithered at the edges of the
// pattern (never smooth). Repeated as the floor's background at 2 screen px a pixel.
function paintCarpet(c: Record<(typeof FLOOR_TOKENS)[number], string>): string {
  const p = new Pixmap(16, 16);
  const base = pixel(c['--danger-dark']);
  const deep = mix(c['--danger-dark'], c['--outline-ink'], 0.35);
  const red = pixel(c['--danger']);
  const gold = pixel(c['--gold']);
  const goldDark = pixel(c['--gold-dark']);
  p.rect(0, 0, 16, 16, base);
  p.dither(0, 0, 16, 16, base, deep); // a woven texture
  for (let i = 0; i < 6; i++) { // a diamond outline round the middle
    p.set(8 + i, 2 + i, goldDark); p.set(8 - i, 2 + i, goldDark);
    p.set(8 + i, 14 - i, goldDark); p.set(8 - i, 14 - i, goldDark);
  }
  p.rect(7, 7, 3, 3, red);
  p.set(8, 8, gold);
  for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) p.set(x, y, gold);
  const canvas = document.createElement('canvas');
  p.toCanvas(canvas);
  return canvas.toDataURL();
}

export function createOwnCasinoView(
  game: Game,
  { root, say, sound, fx, lessMotion, onFullTill }:
    { root: HTMLElement; say: (text: string, ms?: number) => void; sound: Sound; fx: Fx; lessMotion: () => boolean; onFullTill: (full: boolean) => void },
) {
  const def = () => game.data.ownCasino!;
  const name = (machine: string) => (game.data.machines.find((m) => m.id === machine) || { name: machine }).name;
  const rate = (r: number) => (r < 10 ? r.toFixed(2) : formatCoins(r));

  // ─────────────────────── the till ───────────────────────
  const till = card({ tone: 'gold', title: 'The till', icon: 'takings' });
  const banked = amount('takings', 24);
  const bankRow = till.body.appendChild(h('div', 'oc-bank'));
  bankRow.append(banked.el, h('span', 'note', 'Takings banked'));
  const tillGauge = gauge({ tone: 'gold', label: 'The till' });
  const tillLine = h('div', 'note oc-till-line');
  const empty = button({
    tone: 'primary', size: 'lg', label: 'Empty the till', icon: 'takings', className: 'oc-empty', sound: null,
    onClick: () => {
      const amountIn = game.state.ownCasino.till;
      if (!game.emptyTill()) { sound.play('error'); return; }
      sound.play('coin');
      if (!lessMotion()) fx.burstAt(empty.el, { count: 14, palette: [fx.colors.gold[0], '#ffffff'], speed: 180 });
      if (amountIn.gte(1)) say(`+${formatAmount('takings', amountIn)} Takings in the bank. The guests are having a lovely time!`);
    },
  });
  till.body.append(tillGauge.el, tillLine, empty.el);

  // ─────────────────────── the floor ───────────────────────
  const floorCard = card({ title: 'The floor' });
  const floor = floorCard.body.appendChild(h('div', 'oc-floor'));
  const floorNote = floorCard.body.appendChild(h('p', 'note oc-floor-note'));
  const cabinets = new Map<string, { slot: HTMLElement; canvas: HTMLCanvasElement; guest: HTMLElement; stats: HTMLElement; buy: BuyButton }>();
  def().cabinets.forEach((c, i) => {
    const slot = floor.appendChild(h('div', 'oc-slot'));
    const stand = slot.appendChild(h('div', 'oc-stand'));
    const canvas = stand.appendChild(document.createElement('canvas'));
    canvas.className = 'oc-cabinet';
    const guest = spriteImg('hamster', 32, '', furPalette(GUEST_FURS[i % GUEST_FURS.length]));
    guest.classList.add('oc-guest');
    guest.style.setProperty('--bob-delay', `${(i * 0.37) % 1.4}s`);
    stand.append(guest);
    slot.append(h('div', 'oc-name', name(c.machine)));
    const stats = slot.appendChild(h('div', 'note oc-stats'));
    const buy = buyButton({
      size: 'sm', ariaLabel: `Buy the ${name(c.machine)} cabinet`,
      onClick: () => {
        if (!game.buyCabinet(c.machine)) { sound.play('error'); return; }
        sound.play('buy');
        if (!lessMotion()) fx.burstAt(slot, { count: 20, palette: [fx.colors.gold[0], '#ffffff'], speed: 200 });
        say(`A ${name(c.machine)} cabinet on the floor! The guests are lining up already.`);
      },
    });
    slot.append(buy.el);
    cabinets.set(c.machine, { slot, canvas, guest, stats, buy });
  });

  // Paint the cabinets and the carpet (again when a machine skin changes their paint).
  let dirty = true;
  function paint(): void {
    if (!dirty) return;
    dirty = false;
    const colors = readTokens(root, CABINET_TOKENS);
    for (const [machine, { canvas }] of cabinets) {
      const cab = paintCabinet(machine, MINI, colors);
      cab.pix.toCanvas(canvas);
      canvas.style.width = `${cab.pix.w * CAB_PX}px`;
      canvas.style.height = `${cab.pix.h * CAB_PX}px`;
    }
    floor.style.setProperty('--carpet', `url("${paintCarpet(readTokens(root, FLOOR_TOKENS))}")`);
  }
  game.on('skinEquipped', () => { dirty = true; }); // a machine skin paints every cabinet
  game.on('stateLoaded', () => { dirty = true; });

  // ─────────────────────── upgrades ───────────────────────
  const upCard = card({ title: 'Decor, rooms and staff' });
  const upgrades = new Map<string, { row: ReturnType<typeof listRow>; buy: BuyButton }>();
  for (const u of def().upgrades) {
    const row = listRow({ icon: UPGRADE_ICONS[u.id] || 'star', title: u.name });
    const buy = buyButton({
      size: 'sm', ariaLabel: `Buy ${u.name}`,
      onClick: () => {
        if (!game.buyFloorUpgrade(u.id)) { sound.play('error'); return; }
        sound.play('buy');
        if (!lessMotion()) fx.burstAt(row.el, { count: 10, palette: [fx.colors.gold[0], '#ffffff'], speed: 160 });
      },
    });
    row.el.append(buy.el);
    upCard.body.append(row.el);
    upgrades.set(u.id, { row, buy });
  }

  // ─────────────────────── the back office ───────────────────────
  const office = card({ title: 'The back office' });
  office.body.append(h('p', 'note', 'Takings buy chips for the Prize Counter and Hamster Tokens. Each one costs a little more than the last.'));
  const rewards = new Map<string, { row: ReturnType<typeof listRow>; buy: BuyButton }>();
  for (const r of def().rewards) {
    const row = listRow({ icon: REWARD_ICONS[r.id] || 'star', title: r.name });
    const buy = buyButton({
      size: 'sm', ariaLabel: `Buy a ${r.name}`,
      onClick: () => {
        if (!game.buyOwnReward(r.id)) { sound.play('error'); return; }
        sound.play('chip');
        say(r.kind === 'chips' ? `+${r.chips} chips for the Prize Counter!` : 'A Hamster Token for the Capsule Machine!');
      },
    });
    row.el.append(buy.el);
    office.body.append(row.el);
    rewards.set(r.id, { row, buy });
  }

  // How it works (folded away: it's long).
  const how = more('How the Family Casino works');
  how.body.append(h('p', 'note', `Hamster guests play your cabinets. Your own machines always pay you more than they cost, but on the floor the guests win back less than they bet (each cabinet says how much), and what they don't win back goes in the till. The till fills while you play and while you're away, up to a few hours of takings; empty it to spend them. Takings never turn into coins, so they never count towards Heirloom Seeds. The casino is kept for good: retiring and migrating don't touch it. Nothing is ever real money.`));

  const wrap = h('div', 'oc');
  wrap.append(till.el, floorCard.el, upCard.el, office.el, how.el);
  root.append(wrap);

  // A few words when it opens, and when the till filled up while you were away.
  game.on('ownCasinoOpened', () => {
    sound.play('epic');
    say(`Grand opening! The family has its own casino now: hamster guests play an ${name(def().cabinets[0].machine)} cabinet. Peek at Casino → Your casino.`, 7000);
  });
  game.on('tillOffline', (e) => {
    say(`While you were away the guests put ${formatAmount('takings', e.takings)} Takings in the Family Casino's till.`, 6000);
  });

  // ─────────────────────── every frame (while it's open) ───────────────────────
  function render(): void {
    if (!game.isOwnCasinoOpen()) return;
    paint();
    const o = game.state.ownCasino;
    const takings = o.takings;
    banked.update(takings);
    const cap = game.getTillCapacity();
    const full = game.isTillFull();
    tillGauge.update(cap.gt(0) ? o.till.toNumber() / cap.toNumber() : 0);
    setText(tillLine, `${formatAmount('takings', o.till)} of ${formatAmount('takings', cap)}${full ? ' · full! Empty it so the guests can keep paying' : ''} · +${rate(game.getTakingsPerSecond())} a second · holds ${game.getTillHours()} hours`);
    empty.update({ disabled: !o.till.gte(1) });
    empty.el.classList.toggle('is-full', full);
    onFullTill(full);

    let owned = 0;
    for (const c of def().cabinets) {
      const v = cabinets.get(c.machine)!;
      const has = !!o.cabinets[c.machine];
      if (has) owned++;
      v.slot.classList.toggle('owned', has);
      setText(v.stats, `bets ${formatCoins(game.getGuestBet(c.machine))} · wins back ${(game.getGuestRtp(c.machine) * 100).toFixed(1)}%${has ? ` · +${rate(game.getCabinetRate(c.machine))}/s` : ''}`);
      if (has) v.buy.el.classList.add('hidden');
      else {
        v.buy.el.classList.remove('hidden');
        v.buy.update({ state: takings.gte(c.cost) ? 'ready' : 'saving', cost: c.cost, currency: 'takings', progress: takings.toNumber() / c.cost });
      }
    }
    setText(floorNote, `${owned} of ${def().cabinets.length} cabinets · ${pct(game.getGuestMultiplier())} guests · bets ×${game.getGuestBetMultiplier().toFixed(2)}`);

    for (const u of def().upgrades) {
      const { row, buy } = upgrades.get(u.id)!;
      const level = game.getFloorLevel(u.id);
      row.update({ sub: `${u.description} Level ${level}${u.maxLevel !== null ? ` of ${u.maxLevel}` : ''}.` });
      if (game.isFloorMaxed(u.id)) buy.update({ state: 'maxed' });
      else {
        const cost = game.getFloorCost(u.id);
        buy.update({ state: takings.gte(cost) ? 'ready' : 'saving', cost, currency: 'takings', progress: takings.toNumber() / cost.toNumber() });
      }
    }
    for (const r of def().rewards) {
      const { row, buy } = rewards.get(r.id)!;
      const n = o.rewards[r.id] || 0;
      row.update({ subHTML: `${r.description}${n ? ` Bought ${n}.` : ''}` });
      const cost = game.getOwnRewardCost(r.id);
      buy.update({ state: takings.gte(cost) ? 'ready' : 'saving', cost, currency: 'takings', progress: takings.toNumber() / cost.toNumber() });
    }
  }

  return { render, icon: iconHTML('takings', 16) };
}
