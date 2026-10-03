// shop.ts — VIEW layer. The Upgrades tab (1.6.0, "New Digs": rebuilt on the kit; DESIGN §31),
// in three sub-tabs:
//   1) Hamster:   the hamster's own upgrades (they work on every machine)
//   2) [Machine]: the upgrades of the machine you're running (named after it), and the workshop
//                 ticket that rebuilds it for a Machine Star once they're all maxed
//   3) Machines:  a catalogue page for every machine in data.json: buy it, or switch to it
// Above both upgrade lists: the Hamster Helper's switch (it buys from both) and ×1 / ×10 / Max
// (a saved setting). Every upgrade is a row tile: a tap on the tile opens the sheet in the tray
// (all about it: the whole "now → next", "ready in", the buy button), and its own buy button
// buys straight away (D132). A tile that needs another upgrade stays in place and says so;
// rebirth and sticker upgrades still locked wait in a Locked drawer under each list, each saying
// how it opens. The previews refresh 4 times a second, not every frame.
// Like ui.ts, it only calls game actions (buyUpgrade, buyMachine, switchMachine, rebuild,
// setHelper) and reads state.

import { spriteImg, upgradeIcon, MACHINE_SPRITES } from './art.ts';
import { formatCoins, formatSeconds, formatWait, formatDuration, setText, setHTML, replayClass, iconHTML } from './dom.ts';
import { createSubTabs, ordinal, byId, h, tile, buyButton, confirmButton, segmented, toggle, card, drawer, keyedList, appeared } from './kit.ts';
import { effectAs } from '../logic/game.ts';
import { divide } from '../logic/money.ts';
import type { Tile, BuyButton, ConfirmButton, Sheet, TileTone, BuyState } from './kit.ts';
import type { Game } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import type { UpgradeDef, TreeNodeDef, PerkDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';

// What game.previewUpgrade / previewTreeNode return: the value now and after buying.
// Each effect type has its own kind of value (a number, a Money for coins and
// the payout multiplier, on/off, Luck's { luck, hitRate } …) and its format below
// knows which, so it's loosely typed here. (A Money has toFixed() too.)
type Preview = { now: any; next: any };
type Format = (value: any) => string;
type Def = UpgradeDef | TreeNodeDef | PerkDef; // (colony perks, 1.4.0)

// Everything a machine card shows (game.getMachineInfo).
type MachineInfo = NonNullable<ReturnType<Game['getMachineInfo']>>;

// How each effect type is shown on a tile: [label, value format].
// Shared by upgrade tiles and family tree nodes (ui.ts uses describeEffect too).
function effectFormats(game: Game): Record<string, (def: Def) => [string, Format]> {
  const symbolName = (id: string) => (game.getMachineData().symbols.find((s) => s.id === id) || { name: id }).name;
  const upgradeName = (id: string) => (game.getUpgradeDef(id) || { name: id }).name;
  const percent = (v: number) => `${v < 0.1 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;
  return {
    payoutMultiplier: () => ['Payouts', (v) => `×${v.toFixed(2)}`],
    autoSpin: () => ['Auto-spin', (v) => (v === null ? 'off' : formatSeconds(v))],
    spinCostMultiplier: () => ['Spin cost', formatCoins],
    extraReel: () => ['Reels', String],
    extraPayline: () => ['Paylines', String],
    shiftWeight: (def) => [`${symbolName(effectAs(def, 'shiftWeight').to)} chance`, percent],
    fullLineMultiplier: () => ['Full-line wins', (v) => `×${Number(v.toFixed(2))}`],
    startingLevel: (def) => [`Free ${upgradeName(effectAs(def, 'startingLevel').upgrade)}`, (v) => `Lv ${v}`],
    spinSpeed: () => ['Spin time', formatSeconds],
    deliveryTime: () => ['Delivery trip', formatSeconds],
    deliveryPayoutBonus: () => ['Delivery reward', formatCoins],
    autoDelivery: () => ['Auto-delivery', (v) => (v ? 'on' : 'off')],
    // Milestone 6
    betSteps: () => ['Biggest bet', (v) => `×${v}`],
    winStreak: () => ['Best streak bonus', (v) => `×${v.toFixed(2)}`],
    symbolWeight: (def) => [`${symbolName(effectAs(def, 'symbolWeight').symbol)} chance`, percent],
    extraFreeSpins: () => ['Free spins a trigger', String],
    jackpotGrowth: () => ['Pot growth', (v) => `×${v.toFixed(2)}`],
    // M8 Family Tree traits
    seedJar: () => ['Seed jar holds', (v) => `+${Math.round(v * 100)}%`],
    startingMachineLevel: (def) => {
      const type = effectAs(def, 'startingMachineLevel').upgradeType;
      return [type === 'luck' ? 'Free Machine Luck levels' : type === 'unlockSymbol' ? 'Free symbol unlocks' : 'Free levels', (v) => `Lv ${v}`];
    },
    startingMachine: (def) => {
      const id = effectAs(def, 'startingMachine').machine;
      return [`Starts owning the ${(game.data.machines.find((m) => m.id === id) || { name: id }).name}`, (v) => (v ? 'yes' : 'no')];
    },
    potSeedBonus: () => ['Pot seeds', (v) => `×${v.toFixed(2)}`],
    // M9
    extraRespins: () => ['Respins', String],
    wheelBonus: () => ['Average wedge', (v) => `×${Number(v.toFixed(2))}`],
    // 1.3.1 (some were only on skins before)
    doubleWin: () => ['Wins paid double', (v) => `${Math.round(v * 100)}%`],
    offlineBonus: () => ['Coins while away', (v) => `×${Number(v.toFixed(2))}`],
    offlineTime: () => ['Pays while away for up to', (v) => formatDuration(v)],
    stickerPayout: () => ['Payouts', (v) => `×${v.toFixed(2)}`],
    starPayout: () => ['Each Machine Star', (v) => `+${Math.round(v * 100)}% payouts`],
    generationPayout: () => ['Payouts', (v) => `×${v.toFixed(2)}`],
    streakCap: () => ['Hot Streak counts', (v) => `${v} wins in a row`],
    jackpotTokens: () => ['Tokens a golden jackpot', String],
    deliveryTokens: () => ['A token every', (v) => `${ordinal(v)} delivery`],
    gambleHistory: () => ['Past cards shown', String],
    autoBuy: () => ['Hamster Helper', (v) => (v ? 'yes' : 'no')],
    // 1.4.0: colony perks and colony traits
    seedGain: () => ['Heirloom Seeds', (v) => `+${Math.round(v * 100)}%`],
    maxStars: () => ['Most Machine Stars', String],
    whiskerGain: () => ['Golden Whiskers', (v) => `+${Math.round(v * 100)}%`],
    autoRetire: () => ['The Wise Elders', (v) => (v ? 'yes' : 'no')],
    // 1.10.0: Burrow Party
    zoomies: () => ['Paid spins with Zoomies', (v) => `${Number((v * 100).toFixed(1))}%`],
    stickyWilds: () => ['A free-spin wild stays for', (v) => (v ? `${v} more spin${v === 1 ? '' : 's'}` : 'no more spins')],
    freeSpinClimb: () => ['Free spins climb to', (v) => `×${v}`],
  };
}

// 1.3.1: what a rebirth or sticker upgrade is still waiting for (null = it's on sale).
// 1.6.0: said the way you'd say it, short on its tile ("Opens with your 4th hamster") and in
// full in the sheet (plain text there; the padlock is a sprite, not an emoji).
export function lockShort(game: Game, id: string): string | null {
  const lock = game.getUpgradeLock(id);
  if (!lock) return null;
  const parts: string[] = [];
  if (lock.generation) parts.push(`your ${ordinal(lock.generation)} hamster`);
  if (lock.sticker) {
    const sticker = game.data.diary.find((d) => d.id === lock.sticker);
    parts.push(`the ${sticker ? sticker.name : lock.sticker} sticker`);
  }
  return lock.generation ? `Opens with ${parts.join(' + ')}` : `Earn ${parts[0]}`;
}
export function lockText(game: Game, id: string): string | null {
  const lock = game.getUpgradeLock(id);
  if (!lock) return null;
  const parts: string[] = [];
  if (lock.generation) {
    const left = lock.generation - game.state.generation;
    parts.push(`a rebirth upgrade: it opens with your family's ${ordinal(lock.generation)} hamster (this is your ${ordinal(game.state.generation)}: retire ${left} more time${left === 1 ? '' : 's'})`);
  }
  if (lock.sticker) {
    const sticker = game.data.diary.find((d) => d.id === lock.sticker);
    const name = sticker ? sticker.name : lock.sticker;
    parts.push(`a sticker upgrade: it opens when you earn the diary sticker <b>${name}</b>${sticker ? ` (${sticker.description})` : ''}`);
  }
  return `${parts.join(', and ').replace(/^./, (c) => c.toUpperCase())}.`;
}

// Milestone 7: Luck and symbol unlocks change two things at once, so their line
// shows both in plain numbers: "Luck 10 → 15 · hit rate 24% → 27%".
const pct = (v: number) => `${Math.round(v * 100)}%`;
const arrow = (a: string | number, b?: string | number) => (b === undefined ? a : `${a} → <span class="next">${b}</span>`);
function describeTwoWay(game: Game, def: Def, { now, next }: Preview): string {
  if (def.effect.type === 'luck') {
    return next === null
      ? `Luck ${now.luck} · hit rate ${pct(now.hitRate)} <span class="note">(max)</span>`
      : `Luck ${arrow(now.luck, next.luck)} · hit rate ${arrow(pct(now.hitRate), pct(next.hitRate))}`;
  }
  // unlockSymbol: which symbol comes next, and what that does to wins.
  const symbols = effectAs(def, 'unlockSymbol').symbols;
  if (next === null) return `Every symbol unlocked · avg win ${formatCoins(now.win)} <span class="note">(max)</span>`;
  const md = game.getMachineData();
  const names = symbols.slice(now.open, next.open).map((id) => (md.symbols.find((s) => s.id === id) || { name: id }).name).join(' + ');
  return `New: <b>${names}</b> · avg win ${arrow(formatCoins(now.win), formatCoins(next.win))} · hit rate ${arrow(pct(now.hitRate), pct(next.hitRate))}`;
}

// Pays Both Ways: what it does to wins, like a symbol unlock (without the new symbol).
function describeBothWays({ now, next }: Preview): string {
  if (next === null) return `Pays both ways · avg win ${formatCoins(now.win)} <span class="note">(max)</span>`;
  return `Avg win ${arrow(formatCoins(now.win), formatCoins(next.win))} · hit rate ${arrow(pct(now.hitRate), pct(next.hitRate))}`;
}

// A Family Tree trait that adds weight to a symbol only some machines have (Ball
// Pit: the Hamster Ball is only on the Burrow Bonanza), shown as that weight.
function describeTreeWeight(game: Game, def: TreeNodeDef, next: unknown): string {
  const e = effectAs(def, 'symbolWeight');
  const md = game.data.machines.find((m) => m.symbols.some((x) => x.id === e.symbol));
  const symbol = md ? md.symbols.find((x) => x.id === e.symbol)!.name : e.symbol;
  const level = game.getTreeLevel(def.id);
  const w = (l: number) => `+${Number((e.perLevel * l).toFixed(2))}`;
  const label = `${symbol} weight${md ? ` on the ${md.name}` : ''}`;
  return next === null ? `${label} ${w(level)} <span class="note">(max)</span>` : `${label} ${w(level)} → <span class="next">${w(level + 1)}</span>`;
}

// The "now → next" line, as HTML with the next value highlighted.
export function describeEffect(game: Game, def: Def, { now, next }: Preview): string {
  if (def.effect.type === 'symbolWeight' && 'branch' in def) return describeTreeWeight(game, def, next);
  if (def.effect.type === 'luck' || def.effect.type === 'unlockSymbol') return describeTwoWay(game, def, { now, next });
  if (def.effect.type === 'bothWays') return describeBothWays({ now, next });
  const format = effectFormats(game)[def.effect.type] || ((): [string, Format] => ['', String]);
  const [label, fmt] = format(def);
  const tail = next === null ? ' <span class="note">(max)</span>' : ` → <span class="next">${fmt(next)}</span>`;
  return `${label} ${fmt(now)}${tail}`;
}

// M15: the short "now → next" on a compact upgrade tile. Most effects are short
// already; Luck, unlocks and Pays Both Ways keep just their headline here, and the
// detail card (tap the tile) shows their whole line.
function shortEffect(game: Game, def: UpgradeDef, preview: Preview): string {
  const { now, next } = preview;
  switch (def.effect.type) {
    case 'luck':
      return next === null ? `Luck ${now.luck} <span class="note">(max)</span>` : `Luck ${arrow(now.luck, next.luck)}`;
    case 'unlockSymbol': {
      if (next === null) return 'Every symbol unlocked';
      const md = game.getMachineData();
      const names = effectAs(def, 'unlockSymbol').symbols.slice(now.open, next.open)
        .map((id) => (md.symbols.find((s) => s.id === id) || { name: id }).name).join(' + ');
      return `New: <b>${names}</b>`;
    }
    case 'bothWays':
      return next === null ? 'Pays both ways' : `Hit rate ${arrow(pct(now.hitRate), pct(next.hitRate))}`;
    default:
      return describeEffect(game, def, preview);
  }
}

// A machine's bonus features (and its Luck and symbol unlocks), as icons with names: icon chips
// on its catalogue page, named in full in its sheet.
export function machineFeatures(info: MachineInfo): { icon: string; name: string }[] {
  const f = info.features;
  const list: { icon: string; name: string }[] = [];
  if (info.luck > 0) list.push({ icon: 'clover', name: `Luck ${info.luck}` });
  if (info.symbols.lockable > 0) list.push({ icon: 'seedPacket', name: `Symbols ${info.symbols.unlocked} of ${info.symbols.lockable} unlocked` });
  if (f.wild) list.push({ icon: 'wildIcon', name: f.wildNow ? 'Wild' : 'Wild (an upgrade)' });
  if (f.freeSpins) list.push({ icon: 'ballIcon', name: 'Free spins' });
  if (f.jackpot) list.push({ icon: 'pouchPolish', name: 'Jackpot pots' });
  if (f.bothWays) list.push({ icon: 'bothWaysIcon', name: 'Pays both ways' });
  // M9
  if (f.ways) list.push({ icon: 'reel', name: `${f.ways} ways` });
  if (f.holdSpin) list.push({ icon: 'acornIcon', name: 'Hold & spin' });
  if (f.wheel) list.push({ icon: 'cheeseIcon', name: 'Cheese wheel' });
  if (f.mystery) list.push({ icon: 'boxIcon', name: 'Moving Boxes' }); // 1.4.0
  return list;
}

// Level pips only make sense for a small max level (past 12 they'd be specks: the level says it).
export const pipCount = (def: { maxLevel?: number | null }) => (def.maxLevel && def.maxLevel > 1 && def.maxLevel <= 12 ? def.maxLevel : 0);

// The Upgrades tab's dot: something is affordable now that wasn't the last time you looked.
export function newlyAffordable(now: Iterable<string>, seen: ReadonlySet<string>): boolean {
  for (const id of now) if (!seen.has(id)) return true;
  return false;
}

const AMOUNTS: { value: Settings['buyAmount']; label: string }[] = [{ value: 1, label: '×1' }, { value: 10, label: '×10' }, { value: 'max', label: 'Max' }];

// An upgrade's row tile (the buy button is null in the Locked drawer) and a machine's catalogue page.
interface UpgradeTile { el: HTMLElement; tile: Tile; buy: BuyButton | null; def: UpgradeDef }
interface MachinePage { el: HTMLElement; id: string; tile: Tile; buy: BuyButton; rebuild: ConfirmButton; chips: HTMLElement; stars: HTMLElement; chipKey: string }

export function createShopView(game: Game, { settings, onSettingsChange, sheet }: { settings: Settings; onSettingsChange: () => void; sheet: Sheet }) {
  const el = {
    panel: byId('tab-upgrades'), bar: byId('shop-bar'),
    hamster: byId('upgrade-list-hamster'), machine: byId('upgrade-list-machine'),
    machines: byId('machine-list'), ticketSlot: byId('rebuild-slot'),
  };
  // The sub-tabs, with icons (on a narrow tray only the open one keeps its name: kit.ts).
  const subtabs = createSubTabs(byId('upgrades-subtabs'), el.panel, {
    key: 'upgrades', settings, onSettingsChange,
    icons: { hamster: 'paw', machine: 'gear', machines: 'reel' },
    onChange: () => { sheet.hide(); dirty = true; },
  });

  // ── The bar over both upgrade lists: the Hamster Helper (1.3.1) and ×1 / ×10 / Max ──
  const helperBox = el.bar.appendChild(h('div', 'shop-helper hidden'));
  const helperInfo = helperBox.appendChild(h('button', 'shop-helper-info'));
  helperInfo.type = 'button';
  helperInfo.setAttribute('aria-label', 'About the Hamster Helper');
  helperInfo.append(spriteImg('paw', 32, ''), h('span', 'shop-helper-name', 'Helper'));
  helperInfo.addEventListener('click', () => { helperInfo.blur(); openHelper(); });
  const helperSwitch = toggle({ ariaLabel: 'Hamster Helper', onChange: (on) => game.setHelper(on) });
  helperBox.append(helperSwitch.el);
  // Until there's a Helper, its place holds a word about the list (where a phone has the room).
  const hint = el.bar.appendChild(h('p', 'note shop-hint'));
  const amount = segmented({
    options: AMOUNTS, ariaLabel: 'How many levels to buy', className: 'shop-amount',
    onPick: (value) => { settings.buyAmount = value; onSettingsChange(); dirty = true; },
  });
  el.bar.append(amount.el);

  // ── The workshop ticket: rebuild this machine for a Machine Star (M8) ──
  const ticket = card({ tone: 'gold', title: 'Rebuild for a star', icon: 'star', className: 'shop-ticket' });
  const ticketText = ticket.body.appendChild(h('div', 'shop-ticket-text'));
  const ticketStars = ticket.body.appendChild(h('div', 'shop-stars'));
  let ticketFor = ''; // the machine the ticket is armed for (a switch disarms it)
  const ticketButton = confirmButton({
    label: 'Rebuild for a star', armedLabel: 'Tap again: reset its upgrades for a star', tone: 'gold', size: 'lg', className: 'shop-rebuild',
    onConfirm: () => { game.rebuild(game.getMachineData().id); },
  });
  ticket.body.append(ticketButton.el);
  el.ticketSlot.append(ticket.el);

  // The tile whose sheet is open (an upgrade id, or "machine:<id>").
  let selected: string | null = null;
  sheet.onHide((key) => {
    if (key.startsWith('shop:')) { selected = null; dirty = true; }
  });

  let hamsterTiles = new Map<string, UpgradeTile>();
  let machineTiles = new Map<string, UpgradeTile>();
  let lockedHamsterTiles = new Map<string, UpgradeTile>();
  let lockedMachineTiles = new Map<string, UpgradeTile>();
  const lockedHamster = drawer('Locked');
  const lockedMachine = drawer('Locked');
  el.hamster.after(lockedHamster.el);
  el.machine.after(lockedMachine.el);
  let pages: MachinePage[] = [];

  const want = () => (settings.buyAmount === 'max' ? Infinity : settings.buyAmount);
  const levelText = (def: UpgradeDef, level: number, maxed: boolean) => (maxed ? 'Max' : def.maxLevel ? `Lv ${level}/${def.maxLevel}` : `Lv ${level}`);

  // "ready in ~2 min" at the current auto-spin income ('' when there's no auto-spin).
  function waitText(cost: Money, rate: Money): string {
    const missing = cost.sub(game.state.coins);
    return missing.gt(0) && rate.gt(0) ? `Ready in ~${formatWait(divide(missing, rate).toNumber())} at your auto-spin's pace` : '';
  }

  // ─────────────────────── building ───────────────────────

  function makeUpgradeTile(def: UpgradeDef, locked: boolean): UpgradeTile {
    const buy = locked ? null : buyButton({ onClick: () => game.buyUpgrade(def.id, want()), ariaLabel: `Buy ${def.name}` });
    const t = tile({ icon: upgradeIcon(def), iconSize: 32, name: def.name, onOpen: () => openUpgrade(def.id), buy, pips: locked ? 0 : pipCount(def), className: 'shop-tile' });
    return { el: t.el, tile: t, buy, def };
  }

  function makePage(md: (typeof game.data.machines)[number]): MachinePage {
    const act = h('span', 'k-tile-act');
    const buy = buyButton({
      ariaLabel: md.name,
      onClick: () => { if (game.ownsMachine(md.id)) game.switchMachine(md.id); else game.buyMachine(md.id); },
    });
    act.append(buy.el);
    const t = tile({ icon: MACHINE_SPRITES[md.id], iconSize: 48, name: md.name, onOpen: () => openMachine(md.id), buy: { el: act }, className: 'shop-machine' });
    // Its stars sit beside its name, its features as icon chips under its numbers.
    const stars = t.el.querySelector('.k-tile-head')!.appendChild(h('span', 'shop-stars'));
    const chips = t.el.querySelector('.k-tile-text')!.appendChild(h('span', 'shop-chips'));
    // Rebuild (M8): two taps, worded as on the workshop ticket, across the whole card.
    const rebuild = confirmButton({
      label: 'Rebuild for a star', armedLabel: 'Tap again: reset its upgrades for a star', tone: 'gold', className: 'k-tile-wide shop-rebuild',
      onConfirm: () => { game.rebuild(md.id); },
    });
    t.el.append(rebuild.el);
    return { el: t.el, id: md.id, tile: t, buy, rebuild, chips, stars, chipKey: '' };
  }

  // Which upgrades show: every one the shop sells here. A rebirth upgrade only shows (in the
  // Locked drawer) once the family has retired, or when it's the very next one: a first life
  // isn't a wall of padlocks.
  function upgradeDefs(): UpgradeDef[] {
    const all = game.getAvailableUpgrades();
    const next = Math.min(...all.map((d) => (game.getUpgradeLock(d.id) || {}).generation || Infinity));
    return all.filter((d) => {
      const lock = game.getUpgradeLock(d.id);
      return !lock || !lock.generation || game.state.generation > 1 || lock.generation === next;
    });
  }

  // Lay the lists out (kept by id: switching machines or an unlock reuses every tile it can).
  let listKey = '';
  const wasLocked = new Set<string>(); // upgrades seen in a Locked drawer (an unlock when they go on sale)
  const wasNeeding = new Set<string>(); // upgrades seen needing another (an unlock when they don't)
  const wasClosed = new Set<string>(); // machines seen closed (an unlock when they open)
  function layout(): void {
    const defs = upgradeDefs();
    const key = defs.map((d) => `${d.id}${game.isUpgradeUnlocked(d.id) ? '' : '!'}`).join();
    if (key === listKey) return;
    listKey = key;
    const open = defs.filter((d) => game.isUpgradeUnlocked(d.id));
    // Locked: the next rebirth upgrade first, then the later ones, then the sticker upgrades.
    const order = (d: UpgradeDef) => { const l = game.getUpgradeLock(d.id); return l ? l.generation || 100 : -1; };
    const locked = defs.filter((d) => !game.isUpgradeUnlocked(d.id)).sort((a, b) => order(a) - order(b) || defs.indexOf(a) - defs.indexOf(b));
    const side = (d: UpgradeDef) => (d.scope === 'machine' ? 'machine' : 'hamster');
    // 1.9.0: a rebirth or sticker upgrade that was in the Locked drawer and is on sale now unlocks.
    const opened = open.filter((d) => wasLocked.has(d.id));
    for (const d of locked) wasLocked.add(d.id);
    hamsterTiles = keyedList(el.hamster, open.filter((d) => side(d) === 'hamster'), (d) => d.id, (d) => makeUpgradeTile(d, false), hamsterTiles);
    machineTiles = keyedList(el.machine, open.filter((d) => side(d) === 'machine'), (d) => d.id, (d) => makeUpgradeTile(d, false), machineTiles);
    lockedHamsterTiles = keyedList(lockedHamster.body, locked.filter((d) => side(d) === 'hamster'), (d) => d.id, (d) => makeUpgradeTile(d, true), lockedHamsterTiles);
    lockedMachineTiles = keyedList(lockedMachine.body, locked.filter((d) => side(d) === 'machine'), (d) => d.id, (d) => makeUpgradeTile(d, true), lockedMachineTiles);
    lockedHamster.update(lockedHamsterTiles.size, 'retire, or earn diary stickers');
    lockedMachine.update(lockedMachineTiles.size, 'retire, or earn diary stickers');
    subtabs.setLabel('machine', game.getMachineData().name);
    for (const d of opened) {
      wasLocked.delete(d.id);
      const t = hamsterTiles.get(d.id) || machineTiles.get(d.id);
      if (t) appeared(t.el, `upgrade:${d.id}`);
    }
    // Another machine's upgrade was open in the sheet: it's gone now.
    if (selected && !selected.startsWith('machine:') && !allTiles().some((t) => t.def.id === selected)) sheet.hide();
  }
  const allTiles = () => [...hamsterTiles.values(), ...machineTiles.values(), ...lockedHamsterTiles.values(), ...lockedMachineTiles.values()];

  function build(): void {
    el.machines.replaceChildren();
    pages = game.data.machines.map((md) => {
      const p = makePage(md);
      el.machines.append(p.el);
      return p;
    });
    listKey = ''; // (a new data.json: lay the lists out again)
    hamsterTiles.clear(); machineTiles.clear(); lockedHamsterTiles.clear(); lockedMachineTiles.clear();
    el.hamster.replaceChildren(); el.machine.replaceChildren(); lockedHamster.body.replaceChildren(); lockedMachine.body.replaceChildren();
    layout();
    dirty = true;
  }

  // ─────────────────────── the sheet ───────────────────────

  // One upgrade's sheet: what it does, the whole "now → next", why it's locked, "ready in", Buy.
  let upgradeSheet: { id: string; effect: HTMLElement; lock: HTMLElement; wait: HTMLElement; buy: BuyButton } | null = null;
  function openUpgrade(id: string): void {
    const key = `shop:${id}`;
    if (sheet.key === key) { sheet.hide(); return; }
    const def = game.getUpgradeDef(id)!;
    if (sheet.show(key, { icon: upgradeIcon(def), iconSize: 32, title: def.name })) {
      const desc = h('p', 'k-note', def.description);
      const effect = h('p', 'shop-effect');
      const lock = h('p', 'shop-lock hidden');
      lock.append(spriteImg('lock', 16, ''), h('span'));
      const wait = h('p', 'shop-wait hidden');
      sheet.body.append(desc, effect, lock, wait);
      const buy = buyButton({ size: 'lg', onClick: () => game.buyUpgrade(id, want()), ariaLabel: `Buy ${def.name}` });
      sheet.foot.append(buy.el);
      upgradeSheet = { id, effect, lock, wait, buy };
    }
    selected = id;
    dirty = true;
    reveal(allTiles().find((t) => t.def.id === id)?.el);
  }

  // One machine's sheet: its description, numbers, features by name, stars, and its action.
  let machineSheet: { id: string; stats: HTMLElement; features: HTMLElement; stars: HTMLElement; buy: BuyButton; rebuild: ConfirmButton; featureKey: string } | null = null;
  function openMachine(id: string): void {
    const key = `shop:machine:${id}`;
    if (sheet.key === key) { sheet.hide(); return; }
    const md = game.data.machines.find((m) => m.id === id)!;
    if (sheet.show(key, { icon: MACHINE_SPRITES[id], iconSize: 48, title: md.name })) {
      const desc = h('p', 'k-note', md.description);
      const stats = h('p', 'shop-effect');
      const features = h('div', 'shop-feature-list');
      const stars = h('p', 'shop-sheet-stars');
      sheet.body.append(desc, stats, features, stars);
      const buy = buyButton({ size: 'lg', ariaLabel: md.name, onClick: () => { if (game.ownsMachine(id)) game.switchMachine(id); else game.buyMachine(id); } });
      const rebuild = confirmButton({ label: 'Rebuild for a star', armedLabel: 'Tap again: reset its upgrades for a star', tone: 'gold', size: 'lg', className: 'shop-rebuild', onConfirm: () => { game.rebuild(id); } });
      sheet.foot.append(buy.el, rebuild.el);
      machineSheet = { id, stats, features, stars, buy, rebuild, featureKey: '' };
    }
    selected = `machine:${id}`;
    dirty = true;
    reveal(pages.find((p) => p.id === id)?.el);
  }

  // The Hamster Helper's note.
  function openHelper(): void {
    const key = 'shop:helper';
    if (sheet.key === key) { sheet.hide(); return; }
    if (sheet.show(key, { icon: 'paw', iconSize: 32, title: 'Hamster Helper', tag: 'The Helping Paws trait' })) {
      sheet.body.append(h('p', 'k-note shop-helper-note'));
    }
    dirty = true;
  }

  // The tile you tapped scrolls into view above the sheet (the panel leaves room for it: kit.css).
  function reveal(node: HTMLElement | undefined): void {
    if (!node) return;
    requestAnimationFrame(() => node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  // ─────────────────────── effects ───────────────────────

  game.on('upgradeBought', (e) => {
    const t = allTiles().find((x) => x.def.id === e.id);
    if (t) replayClass(t.el, 'bought');
    dirty = true;
  });
  game.on('machineBought', (e) => {
    const p = pages.find((x) => x.id === e.id);
    if (p) replayClass(p.el, 'bought');
    dirty = true;
  });
  for (const ev of ['machineSwitched', 'machineRebuilt', 'helperChanged', 'upgradeUnlocked', 'stateLoaded', 'retired', 'migrated', 'bigCageLeft'] as const) game.on(ev, () => { dirty = true; });

  // The tile (or page) for an upgrade or machine id, and its buy button, for ui.ts's sparkles.
  function elementFor(id: string): HTMLElement | null {
    const t = allTiles().find((x) => x.def.id === id);
    if (t) return t.el;
    const p = pages.find((x) => x.id === id);
    return p ? p.el : null;
  }
  function buyButtonFor(id: string): HTMLElement | null {
    const t = allTiles().find((x) => x.def.id === id);
    return t ? (t.buy ? t.buy.el : t.el) : null;
  }

  // ─────────────────────── drawing ───────────────────────

  let dirty = true; // something changed: draw everything on the next frame
  let seen = new Set<string>(); // what was affordable when you last looked (the tab's dot)
  let news = false;

  // What you could buy right now at ×1, for the dots (upgrades, machines, a rebuild).
  function affordable(): Set<string> {
    const ids = new Set<string>();
    for (const d of game.getAvailableUpgrades()) if (game.isUpgradeUnlocked(d.id) && game.canBuyUpgrade(d.id)) ids.add(d.id);
    for (const md of game.data.machines) if (!game.ownsMachine(md.id) && game.canBuyMachine(md.id)) ids.add(`machine:${md.id}`);
    for (const md of game.data.machines) if (game.ownsMachine(md.id) && game.canRebuild(md.id)) ids.add(`rebuild:${md.id}`);
    return ids;
  }

  // Every frame from ui.ts. Hidden, it only keeps the tab's dot up to date (4 times a second);
  // open, it draws, 4 times a second or as soon as something changed.
  function render(_now: number, visible: boolean, tick: boolean): boolean {
    if (!visible) {
      if (tick) news = newlyAffordable(affordable(), seen);
      return news;
    }
    if (!dirty && !tick) return false;
    dirty = false;
    seen = affordable();
    news = false;
    draw();
    return false;
  }

  function draw(): void {
    const s = game.state;
    layout();
    const rate = game.getEconomy().expectedAutoProfitPerSecond;
    const sub = subtabs.current;
    el.bar.classList.toggle('hidden', sub === 'machines');
    amount.update(settings.buyAmount);

    // The Hamster Helper's switch, once the family has planted Helping Paws (1.3.1).
    const helper = game.getHelper();
    helperBox.classList.toggle('hidden', !helper);
    if (helper) helperSwitch.update(!!s.helper);
    hint.classList.toggle('hidden', !!helper);
    // (On a phone's tray only its last words show: styles/upgrades.css.)
    setHTML(hint, `<span class="shop-hint-long">${sub === 'machine' ? `${game.getMachineData().name}'s own: they stay with it when you switch.` : 'They work on every machine.'} </span>Tap one to read about it.`);
    if (sheet.key === 'shop:helper') {
      const note = sheet.body.querySelector('.shop-helper-note');
      if (!helper) sheet.hide();
      else if (note) setHTML(note as HTMLElement, `${s.helper ? 'It\'s on: it' : 'Switched off. When it\'s on, it'} buys the cheapest upgrade here, the hamster's or this machine's, that costs ${Math.round(helper.share * 100)}% of your coins or less, about every ${formatSeconds(helper.interval)}.${s.stats.helperBuys ? ` <b>${s.stats.helperBuys.toLocaleString('en-US')}</b> levels bought so far.` : ''}`);
    }

    // The upgrade tiles.
    const ready = { hamster: false, machine: false };
    for (const [list, side] of [[hamsterTiles, 'hamster'], [machineTiles, 'machine']] as const) {
      for (const t of list.values()) {
        const id = t.def.id;
        const level = game.getUpgradeLevel(id);
        const maxed = game.isMaxed(id);
        const bulk = game.getUpgradeBulk(id, want());
        const needs = game.getUpgradeNeeds(id); // (Old Clunky's Both Ways needs the Third Reel)
        if (needs.length) wasNeeding.add(id);
        else if (wasNeeding.delete(id)) appeared(t.el, `upgrade:${id}`); // 1.9.0: what it needed is bought
        const preview = needs.length ? null : game.previewUpgrade(id, bulk.count);
        const tone: TileTone = selected === id ? 'selected' : maxed ? 'maxed' : bulk.affordable ? 'ready' : 'plain';
        t.tile.update({
          level: levelText(t.def, level, maxed),
          effect: preview ? shortEffect(game, t.def, preview) : `<span class="note">Needs ${needs.join(' + ')}</span>`,
          pips: level, tone,
        });
        const state: BuyState = maxed ? 'maxed' : needs.length ? 'locked' : bulk.affordable ? 'ready' : 'saving';
        t.buy!.update({ state, cost: bulk.cost, count: bulk.count, progress: divide(s.coins, bulk.cost).toNumber() });
        t.tile.setOpen(selected === id);
        if (bulk.affordable) ready[side] = true;
        if (upgradeSheet && upgradeSheet.id === id && sheet.key === `shop:${id}`) drawUpgradeSheet(t.def, { level, maxed, bulk, needs, preview, state, rate });
      }
    }
    // The locked ones, in their drawers: how each opens.
    for (const t of [...lockedHamsterTiles.values(), ...lockedMachineTiles.values()]) {
      const id = t.def.id;
      t.tile.update({ level: levelText(t.def, game.getUpgradeLevel(id), false), effect: `<span class="note">${lockShort(game, id) || ''}</span>`, tone: selected === id ? 'selected' : 'locked' });
      t.tile.setOpen(selected === id);
      if (upgradeSheet && upgradeSheet.id === id && sheet.key === `shop:${id}`) {
        sheet.setTag(`${t.def.scope === 'machine' ? game.getMachineData().name : 'Hamster · every machine'} · locked`);
        upgradeSheet.effect.classList.add('hidden');
        upgradeSheet.lock.classList.remove('hidden');
        setHTML(upgradeSheet.lock.lastElementChild as HTMLElement, lockText(game, id) || '');
        upgradeSheet.wait.classList.add('hidden');
        upgradeSheet.buy.update({ state: 'locked' });
      }
    }

    drawTicket();
    if (ticketShowsRebuild) ready.machine = true;
    const machineReady = drawPages(rate);

    subtabs.setDot('hamster', ready.hamster);
    subtabs.setDot('machine', ready.machine);
    subtabs.setDot('machines', machineReady);
  }

  // The open upgrade's sheet, from the numbers its tile just worked out.
  function drawUpgradeSheet(def: UpgradeDef, o: { level: number; maxed: boolean; bulk: { count: number; cost: Money; affordable: boolean }; needs: string[]; preview: { now: any; next: any } | null; state: BuyState; rate: Money }): void {
    const sh = upgradeSheet!;
    const scope = def.scope === 'machine' ? game.getMachineData().name : 'Hamster · every machine';
    sheet.setTag(`${scope} · ${o.maxed ? 'Max' : def.maxLevel ? `Lv ${o.level} of ${def.maxLevel}` : `Lv ${o.level}`}`);
    sh.effect.classList.toggle('hidden', !o.preview);
    if (o.preview) setHTML(sh.effect, describeEffect(game, def, o.preview));
    sh.lock.classList.toggle('hidden', o.needs.length === 0);
    if (o.needs.length) setHTML(sh.lock.lastElementChild as HTMLElement, `It needs the ${o.needs.join(' and the ')} first.`);
    const wait = o.maxed || o.bulk.affordable || o.needs.length ? '' : waitText(o.bulk.cost, o.rate);
    setText(sh.wait, wait);
    sh.wait.classList.toggle('hidden', wait === '');
    sh.buy.update({ state: o.state, cost: o.bulk.cost, count: o.bulk.count, progress: divide(game.state.coins, o.bulk.cost).toNumber() });
  }

  // The machine's own sub-tab: the workshop ticket once every upgrade on it is maxed (or a
  // plain card with its stars once it has some).
  let ticketShowsRebuild = false;
  function drawTicket(): void {
    const md = game.getMachineData();
    const here = game.getMachineInfo(md.id)!;
    if (ticketFor !== md.id) { ticketFor = md.id; ticketButton.disarm(); }
    const canGrow = here.fullyUpgraded && here.stars < here.maxStars;
    ticketShowsRebuild = canGrow && here.canRebuild;
    ticket.el.classList.toggle('hidden', !(canGrow || here.stars > 0));
    ticket.setTone(canGrow ? 'gold' : 'plain');
    ticket.setTitle(canGrow ? 'Rebuild for a star' : 'Machine Stars');
    setHTML(ticketText, canGrow
      ? `<b>Every upgrade on ${md.name} is maxed!</b> Rebuild it for Machine Star ${here.stars + 1} of ${here.maxStars}: +${Math.round(game.getStarPayout() * 100)}% payouts and +${game.data.stars.luckPerStar} Luck on this machine, for good. Its upgrades start again from nothing (your coins stay).`
      : here.stars >= here.maxStars ? 'Every star this machine can have.' : 'Max every upgrade here to rebuild it for another star.');
    setHTML(ticketStars, starRow(here.stars, here.maxStars));
    ticketButton.el.classList.toggle('hidden', !canGrow);
    ticketButton.update({ disabled: !here.canRebuild, label: here.canRebuild ? 'Rebuild for a star' : 'Rebuild when the machine is idle' }); // (busy: spinning, free spins, the jackpot wheel)
  }

  // The catalogue: every machine's page. Returns whether one can be bought now.
  function drawPages(rate: Money): boolean {
    const s = game.state;
    let machineReady = false;
    for (const p of pages) {
      const info = game.getMachineInfo(p.id)!;
      const closed = !info.open;
      if (closed) wasClosed.add(p.id);
      else if (wasClosed.delete(p.id)) appeared(p.el, `machine:${p.id}`); // 1.9.0: a colony machine opened
      // 1.4.0: a colony machine (Moving Day) is for a family that has migrated. Before that
      // it's a locked page, a goal for the late game (from the family's 2nd hamster).
      p.el.classList.toggle('hidden', closed && s.generation < 2 && s.colony === 0);
      const affordable = !info.owned && !closed && game.canBuyMachine(p.id);
      if (affordable) machineReady = true;
      p.tile.update({
        effect: closed ? '<span class="note">Opens after the Great Migration</span>' : machineNumbers(info),
        tone: selected === `machine:${p.id}` ? 'selected' : info.active ? 'maxed' : closed ? 'locked' : affordable ? 'ready' : 'plain',
      });
      p.tile.setOpen(selected === `machine:${p.id}`);
      setHTML(p.stars, info.stars > 0 ? iconHTML('star', 16).repeat(info.stars) : '');
      const features = machineFeatures(info);
      const chipKey = features.map((f) => f.name).join('|');
      if (chipKey !== p.chipKey) {
        p.chipKey = chipKey;
        p.chips.replaceChildren(...features.map((f) => {
          const chip = h('span', 'shop-chip');
          chip.title = f.name;
          chip.append(spriteImg(f.icon, 16, ''));
          return chip;
        }));
      }
      const state = machineState(info, closed, affordable);
      p.buy.update({ state, cost: info.cost, progress: closed ? 0 : divide(s.coins, info.cost).toNumber(), label: state === 'switch' && info.freeSpinsLeft > 0 ? `Switch · ${info.freeSpinsLeft} free` : undefined });
      p.rebuild.el.classList.toggle('hidden', !info.canRebuild);
      if (machineSheet && machineSheet.id === p.id && sheet.key === `shop:machine:${p.id}`) drawMachineSheet(info, features, state, rate, closed);
    }
    return machineReady;
  }

  function machineState(info: MachineInfo, closed: boolean, affordable: boolean): BuyState {
    return info.active ? 'running' : closed ? 'locked' : info.owned ? 'switch' : affordable ? 'ready' : 'saving';
  }

  // One line of numbers: reels, lines (or ways), what a spin costs, the bet.
  function machineNumbers(info: MachineInfo): string {
    const reels = info.reels < info.maxReels ? `${info.reels} of ${info.maxReels} reels` : `${info.reels} reels`;
    const lines = info.features.ways ? `${info.features.ways} ways` : info.maxLines > 1 ? `${info.lines} of ${info.maxLines} lines` : '1 line';
    const bet = info.owned && info.bet > 1 ? ` · bet ×${info.bet}` : '';
    return `${reels} · ${lines} · ${formatCoins(info.spinCost)} a spin${bet}`;
  }

  function drawMachineSheet(info: MachineInfo, features: { icon: string; name: string }[], state: BuyState, rate: Money, closed: boolean): void {
    const sh = machineSheet!;
    sheet.setTag(info.active ? 'Running now' : info.owned ? 'Yours' : closed ? 'After the Great Migration' : `${formatCoins(info.cost)} coins`);
    setText(sh.stats, machineNumbers(info));
    const fk = features.map((f) => f.name).join('|');
    if (fk !== sh.featureKey) {
      sh.featureKey = fk;
      sh.features.replaceChildren(...features.map((f) => {
        const row = h('span', 'shop-feature');
        row.append(spriteImg(f.icon, 16, ''), h('span', '', f.name));
        return row;
      }));
    }
    setHTML(sh.stars, info.stars > 0 || info.canRebuild ? starRow(info.stars, info.maxStars) : '');
    const wait = state === 'saving' ? waitText(info.cost, rate) : '';
    sh.buy.update({ state, cost: info.cost, progress: divide(game.state.coins, info.cost).toNumber(), label: state === 'switch' ? (info.freeSpinsLeft > 0 ? `Switch · ${info.freeSpinsLeft} free spins waiting` : 'Switch to it') : undefined });
    sh.buy.el.title = wait;
    sh.rebuild.el.classList.toggle('hidden', !info.canRebuild);
  }

  // ★★☆ 2 of 5 Machine Stars
  const starRow = (n: number, max: number) => `${iconHTML('star', 16).repeat(n)}<span class="note">${n} of ${max} Machine Stars</span>`;

  build();
  return { build, render, elementFor, buyButtonFor, openSub: subtabs.open };
}
