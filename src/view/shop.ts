// shop.ts — VIEW layer. The Upgrades tab, in three sub-tabs:
//   1) Hamster:   the hamster's own upgrades (they work on every machine)
//   2) [Machine]: the upgrades of the machine you're running (named after it)
//   3) Machines:  a card for every machine in data.json. Buy it, or switch to it.
// The ×1 / ×10 / Max toggle (a saved setting) sits next to the sub-tabs, and tiles
// show "ready in ~2 min" hints for the ones you're saving up for.
// Like ui.ts, it only calls game actions (buyUpgrade, buyMachine, switchMachine)
// and reads state.

import { spriteImg, upgradeIcon, MACHINE_SPRITES } from './art.ts';
import { formatCoins, formatSeconds, formatWait, formatDuration, setText, setHTML, replayClass, iconHTML } from './dom.ts';
import { createSubTabs, ordinal } from './kit.ts';
import { effectAs } from '../logic/game.ts';
import { divide } from '../logic/money.ts';
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
  };
}

// 1.3.1: what a rebirth or sticker upgrade is still waiting for, short (a tile) or
// long (the detail card). null = it's on sale.
export function lockText(game: Game, id: string, long = false): string | null {
  const lock = game.getUpgradeLock(id);
  if (!lock) return null;
  const parts: string[] = [];
  if (lock.generation) {
    const left = lock.generation - game.state.generation;
    parts.push(long
      ? `a rebirth upgrade: on sale from generation ${lock.generation} (your family is on ${game.state.generation}: retire ${left} more time${left === 1 ? '' : 's'})`
      : `Generation ${lock.generation}`);
  }
  if (lock.sticker) {
    const sticker = game.data.diary.find((d) => d.id === lock.sticker);
    const name = sticker ? sticker.name : lock.sticker;
    parts.push(long ? `a sticker upgrade: on sale once you earn the diary sticker <b>${name}</b> (${sticker ? sticker.description : ''})` : `Sticker: ${name}`);
  }
  return long ? `🔒 ${parts.join(', and ').replace(/^./, (c) => c.toUpperCase())}.` : `🔒 ${parts.join(' + ')}`;
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

// Little chips on a machine card for the bonus features it has (and its Luck and
// how many of its symbols are unlocked).
export function featureChips(info: MachineInfo): string {
  const f = info.features;
  const chips = [];
  if (info.luck > 0) chips.push(`<span class="feature-chip chip-luck">${iconHTML('clover', 16)}Luck ${info.luck}</span>`);
  if (info.symbols.lockable > 0) chips.push(`<span class="feature-chip chip-seeds">${iconHTML('seedPacket', 16)}Symbols ${info.symbols.unlocked}/${info.symbols.lockable}</span>`);
  if (f.wild) chips.push(`<span class="feature-chip chip-wild">${iconHTML('wildIcon', 16)}Wild${f.wildNow ? '' : ' (upgrade)'}</span>`);
  if (f.freeSpins) chips.push(`<span class="feature-chip chip-free">${iconHTML('ballIcon', 16)}Free spins</span>`);
  if (f.jackpot) chips.push(`<span class="feature-chip chip-pots">${iconHTML('pouchPolish', 16)}Jackpot pots</span>`);
  if (f.bothWays) chips.push(`<span class="feature-chip chip-both">${iconHTML('bothWaysIcon', 16)}Pays both ways</span>`);
  // M9
  if (f.ways) chips.push(`<span class="feature-chip chip-ways">${iconHTML('reel', 16)}Ways</span>`);
  if (f.holdSpin) chips.push(`<span class="feature-chip chip-hold">${iconHTML('acornIcon', 16)}Hold & spin</span>`);
  if (f.wheel) chips.push(`<span class="feature-chip chip-wheel">${iconHTML('cheeseIcon', 16)}Cheese wheel</span>`);
  if (f.mystery) chips.push(`<span class="feature-chip chip-box">${iconHTML('boxIcon', 16)}Moving Boxes</span>`); // 1.4.0
  return chips.join('');
}

const AMOUNTS: [Settings['buyAmount'], string][] = [[1, '×1'], [10, '×10'], ['max', 'Max']];

// An upgrade tile and a machine card: the elements render() updates.
interface Tile {
  id: string;
  def: UpgradeDef;
  locked: boolean; // 1.3.1: built as a locked tile (in the "still locked" group)
  tile: HTMLElement;
  button: HTMLButtonElement;
  pips: HTMLElement[];
  level: HTMLElement;
  effect: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
}
interface Card {
  id: string;
  card: HTMLElement;
  button: HTMLButtonElement;
  rebuild: HTMLButtonElement;
  stars: HTMLElement;
  stats: HTMLElement;
  features: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
  wait: HTMLElement;
}

export function createShopView(game: Game, { settings, onSettingsChange }: { settings: Settings; onSettingsChange: () => void }) {
  // The element with this id (every id used here is in index.html).
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    machines: $('machine-list'), hamster: $('upgrade-list-hamster'), machine: $('upgrade-list-machine'),
    amount: $('buy-amount'), machineNote: $('machine-upgrades-note'), detail: $('upgrade-detail'),
    // 1.3.1: the upgrades still locked (rebirth and sticker upgrades), folded away under the others
    lockedHamster: $<HTMLDetailsElement>('locked-hamster'), lockedMachine: $<HTMLDetailsElement>('locked-machine'),
    helper: $('helper-row'), helperBtn: $<HTMLButtonElement>('helper-btn'), helperText: $('helper-text'),
  };
  el.helper.querySelector('.helper-icon')!.appendChild(spriteImg('paw', 32, '🐾'));
  // The Hamster Helper's switch (1.3.1, the Helping Paws trait).
  el.helperBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    game.setHelper(!game.state.helper);
  });
  // M15: the tiles are small, like the Family Tree's traits. Tap one (not its buy
  // button) and a detail card at the bottom of the tab tells you all about it.
  let selected: string | null = null;
  el.detail.innerHTML = `
    <div class="tile-top">
      <div class="tile-icon"></div>
      <div><div class="tile-name"></div><div class="tile-tag"></div></div>
      <button class="ud-close" aria-label="Close">×</button>
    </div>
    <div class="tile-desc"></div>
    <div class="tile-effect"></div>
    <div class="ud-foot">
      <span class="wait-hint"></span>
      <button class="buy-btn"><span class="buy-fill"></span><span class="buy-label"></span></button>
    </div>`;
  const detail = {
    icon: el.detail.querySelector<HTMLElement>('.tile-icon')!, name: el.detail.querySelector<HTMLElement>('.tile-name')!,
    tag: el.detail.querySelector<HTMLElement>('.tile-tag')!, desc: el.detail.querySelector<HTMLElement>('.tile-desc')!,
    effect: el.detail.querySelector<HTMLElement>('.tile-effect')!, wait: el.detail.querySelector<HTMLElement>('.wait-hint')!,
    button: el.detail.querySelector<HTMLButtonElement>('.buy-btn')!, fill: el.detail.querySelector<HTMLElement>('.buy-fill')!,
    label: el.detail.querySelector<HTMLElement>('.buy-label')!, shown: '',
  };
  el.detail.querySelector('.ud-close')!.addEventListener('click', () => { selected = null; });
  detail.button.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (selected) game.buyUpgrade(selected, want());
  });
  const subtabs = createSubTabs($('upgrades-subtabs'), $('tab-upgrades'), { key: 'upgrades', settings, onSettingsChange });
  const rebuildEl = { card: $('rebuild-card'), text: $('rebuild-text'), button: $<HTMLButtonElement>('rebuild-btn') };
  let rebuildArmed: { id: string; until: number } | null = null; // the first tap on a Rebuild button

  // Rebuilding needs two taps within 3 s (it resets the machine's upgrades).
  function tryRebuild(id: string): void {
    if (!game.canRebuild(id)) return;
    if (rebuildArmed && rebuildArmed.id === id && performance.now() < rebuildArmed.until) {
      rebuildArmed = null;
      game.rebuild(id);
      return;
    }
    rebuildArmed = { id, until: performance.now() + 3000 };
  }
  rebuildEl.button.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    tryRebuild(game.getMachineData().id);
  });
  const armed = (id: string) => !!rebuildArmed && rebuildArmed.id === id && performance.now() < rebuildArmed.until;
  const starRow = (n: number, max: number) => `${iconHTML('star', 16).repeat(n)}<span class="note">${n}/${max} Machine Stars</span>`;
  let tiles: Tile[] = [];
  let cards: Card[] = [];
  let tileKey = ''; // which upgrades the tiles were built for (they change with the machine)

  const want = () => (settings.buyAmount === 'max' ? Infinity : settings.buyAmount);
  const coinLabel = (text: string) => `${iconHTML('coin')}${text}`;

  // "ready in ~2 min" at the current auto-spin income ('' when there's no auto-spin).
  function waitText(cost: Money, rate: Money): string {
    const missing = cost.sub(game.state.coins);
    return missing.gt(0) && rate.gt(0) ? `ready in ~${formatWait(divide(missing, rate).toNumber())}` : '';
  }

  // ─────────────────────── building ───────────────────────

  function buildAmountToggle() {
    el.amount.replaceChildren(...AMOUNTS.map(([value, label]) => {
      const b = document.createElement('button');
      b.className = 'seg-btn';
      b.textContent = label;
      b.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        // Tapping the one that's already on moves to the next (×1 → ×10 → Max → ×1):
        // a narrow tray shows only that one button (style.css).
        const i = AMOUNTS.findIndex(([v]) => v === value);
        settings.buyAmount = settings.buyAmount === value ? AMOUNTS[(i + 1) % AMOUNTS.length][0] : value;
        onSettingsChange();
      });
      return b;
    }));
  }

  function buildMachines() {
    el.machines.replaceChildren();
    cards = game.data.machines.map((md) => {
      const card = document.createElement('div');
      card.className = 'machine-card';
      card.innerHTML = `
        <div class="mc-icon"></div>
        <div class="mc-text"><div class="tile-name"></div><div class="tile-tag mc-stats"></div><div class="mc-features"></div><div class="mc-stars"></div><div class="tile-desc"></div></div>
        <div class="mc-action">
          <button class="buy-btn"><span class="buy-fill"></span><span class="buy-label"></span></button>
          <button class="btn btn-gold btn-small rebuild-btn hidden"></button>
          <span class="wait-hint"></span>
        </div>`;
      card.querySelector('.mc-icon')!.appendChild(spriteImg(MACHINE_SPRITES[md.id], 48, md.name[0]));
      card.querySelector('.tile-name')!.textContent = md.name;
      card.querySelector('.tile-desc')!.textContent = md.description;
      const button = card.querySelector<HTMLButtonElement>('.buy-btn')!;
      button.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        if (game.ownsMachine(md.id)) game.switchMachine(md.id);
        else game.buyMachine(md.id);
      });
      // Rebuild (M8): two taps, like retiring, because it resets the machine's upgrades.
      const rebuild = card.querySelector<HTMLButtonElement>('.rebuild-btn')!;
      rebuild.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        tryRebuild(md.id);
      });
      el.machines.appendChild(card);
      return {
        id: md.id, card, button, rebuild, stars: card.querySelector<HTMLElement>('.mc-stars')!,
        stats: card.querySelector<HTMLElement>('.mc-stats')!, features: card.querySelector<HTMLElement>('.mc-features')!, fill: card.querySelector<HTMLElement>('.buy-fill')!,
        label: card.querySelector<HTMLElement>('.buy-label')!, wait: card.querySelector<HTMLElement>('.wait-hint')!,
      };
    });
  }

  // A compact tile: icon, name, level and the short "now → next" (a button: tap it
  // for the detail card), level pips, and the buy button (one tap still buys).
  function makeTile(def: UpgradeDef, locked = false): Tile {
    const tile = document.createElement('div');
    tile.className = locked ? 'tile locked' : 'tile';
    tile.innerHTML = `
      <button class="tile-info">
        <span class="tile-icon"></span>
        <span class="tile-text"><span class="tile-name"></span><span class="tile-level"></span><span class="tile-effect"></span></span>
      </button>
      <div class="pips"></div>
      <button class="buy-btn"><span class="buy-fill"></span><span class="buy-label"></span></button>`;
    tile.querySelector('.tile-icon')!.appendChild(spriteImg(upgradeIcon(def), 32, def.name[0]));
    tile.querySelector('.tile-name')!.textContent = def.name;
    const info = tile.querySelector<HTMLButtonElement>('.tile-info')!;
    info.setAttribute('aria-label', `About ${def.name}`);
    info.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      selected = selected === def.id ? null : def.id; // tap it again to close the card
    });

    // Level pips only make sense for upgrades with a small max level.
    const pipsEl = tile.querySelector('.pips')!;
    const pips: HTMLElement[] = [];
    if (def.maxLevel && def.maxLevel > 1) {
      for (let i = 0; i < def.maxLevel; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip';
        pipsEl.appendChild(pip);
        pips.push(pip);
      }
    } else {
      pipsEl.remove();
    }

    const button = tile.querySelector<HTMLButtonElement>('.buy-btn')!;
    button.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur(); // so Space doesn't "click" it again later
      game.buyUpgrade(def.id, want());
    });
    return {
      id: def.id, def, tile, button, pips, locked,
      level: tile.querySelector<HTMLElement>('.tile-level')!,
      effect: tile.querySelector<HTMLElement>('.tile-effect')!,
      fill: tile.querySelector<HTMLElement>('.buy-fill')!,
      label: tile.querySelector<HTMLElement>('.buy-label')!,
    };
  }

  // Which tiles to build: every upgrade the shop sells here, and which are locked.
  // A rebirth upgrade only shows (locked) once the family has retired, or when
  // it's the very next one: a first life isn't a wall of padlocks.
  function tileDefs() {
    const next = Math.min(...game.getAvailableUpgrades().map((d) => (game.getUpgradeLock(d.id) || {}).generation || Infinity));
    return game.getAvailableUpgrades().filter((d) => {
      const lock = game.getUpgradeLock(d.id);
      return !lock || !lock.generation || game.state.generation > 1 || lock.generation === next;
    });
  }
  const keyOf = () => tileDefs().map((d) => `${d.id}${game.isUpgradeUnlocked(d.id) ? '' : '!'}`).join();

  // Hamster upgrades go in one sub-tab, this machine's in the other. Locked ones
  // (1.3.1) go in a folded group under each list: rebirth upgrades first, then sticker ones.
  function buildTiles() {
    const defs = tileDefs();
    tileKey = keyOf();
    el.hamster.replaceChildren();
    el.machine.replaceChildren();
    const lockedLists = { hamster: el.lockedHamster.querySelector('.upgrade-grid')!, machine: el.lockedMachine.querySelector('.upgrade-grid')! };
    lockedLists.hamster.replaceChildren();
    lockedLists.machine.replaceChildren();
    const order = (d: UpgradeDef) => { const l = game.getUpgradeLock(d.id); return l ? l.generation || 100 : -1; }; // the next rebirth upgrade first
    const sorted = [...defs].sort((a, b) => order(a) - order(b) || defs.indexOf(a) - defs.indexOf(b));
    tiles = sorted.map((def) => {
      const locked = !game.isUpgradeUnlocked(def.id);
      const t = makeTile(def, locked);
      const side = def.scope === 'machine' ? 'machine' : 'hamster';
      (locked ? lockedLists[side] : side === 'machine' ? el.machine : el.hamster).appendChild(t.tile);
      return t;
    });
    for (const side of ['hamster', 'machine'] as const) {
      const group = side === 'hamster' ? el.lockedHamster : el.lockedMachine;
      const n = lockedLists[side].children.length;
      group.classList.toggle('hidden', n === 0);
      setHTML(group.querySelector('summary')!, `🔒 ${n} upgrade${n === 1 ? '' : 's'} still locked <span class="note">(retire, or earn diary stickers, to open them)</span>`);
    }
    const md = game.getMachineData();
    subtabs.setLabel('machine', md.name);
    setText(el.machineNote, `${md.name}'s own upgrades: they stay with it when you switch. Tap one to read about it.`);
    if (selected && !tiles.some((t) => t.id === selected)) selected = null; // another machine's upgrade
  }

  function build() {
    buildAmountToggle();
    buildMachines();
    buildTiles();
  }

  // A buy button: affordable (green), saving up (grey, filling up), maxed (gold).
  function paintBuy(button: HTMLElement, fill: HTMLElement, { maxed, affordable, progress }: { maxed: boolean; affordable: boolean; progress: number }): void {
    button.classList.toggle('maxed', maxed);
    button.classList.toggle('poor', !maxed && !affordable);
    fill.style.width = maxed || affordable ? '0%' : `${Math.min(100, progress * 100).toFixed(1)}%`;
  }

  game.on('upgradeBought', (e) => {
    const t = tiles.find((x) => x.id === e.id);
    if (t) replayClass(t.tile, 'bought');
  });
  game.on('machineBought', (e) => {
    const c = cards.find((x) => x.id === e.id);
    if (c) replayClass(c.card, 'bought');
  });

  // The tile (or card) element for an upgrade or machine id, for the particle effects.
  function elementFor(id: string): HTMLElement | null {
    const t = tiles.find((x) => x.id === id);
    if (t) return t.tile;
    const c = cards.find((x) => x.id === id);
    return c ? c.card : null;
  }

  // ─────────────────────── drawing ───────────────────────

  function render() {
    const s = game.state;
    const rate = game.getEconomy().expectedAutoProfitPerSecond;
    if (tileKey !== keyOf()) buildTiles(); // switched machine, or an upgrade just unlocked

    [...el.amount.children].forEach((b, i) => b.classList.toggle('active', AMOUNTS[i][0] === settings.buyAmount));
    el.amount.classList.toggle('hidden', subtabs.current === 'machines');

    // Machine cards
    let machineReady = false;
    for (const c of cards) {
      const info = game.getMachineInfo(c.id)!;
      const reels = info.reels < info.maxReels ? `${info.reels} of ${info.maxReels} reels` : `${info.reels} reels`;
      // A ways machine (M9) has no paylines: say how many ways it pays instead.
      const lines = info.features.ways ? ` · ${info.features.ways} ways` : info.maxLines > 1 ? ` · ${info.lines} of ${info.maxLines} paylines` : ' · 1 payline';
      const bet = info.owned && info.bet > 1 ? ` · bet ×${info.bet}` : '';
      setText(c.stats, `${reels}${lines} · ${formatCoins(info.spinCost)} a spin${bet}`);
      setHTML(c.features, featureChips(info));
      // Machine Stars (M8): shown once it has one, or could get one.
      setHTML(c.stars, info.stars > 0 || info.canRebuild ? starRow(info.stars, info.maxStars) : '');
      c.rebuild.classList.toggle('hidden', !info.canRebuild);
      setText(c.rebuild, armed(c.id) ? 'Tap again: reset its upgrades' : 'Rebuild for a star');
      c.card.classList.toggle('active', info.active);
      c.card.classList.toggle('owned', info.owned);
      // 1.4.0: a colony machine (Moving Day) is for a family that has migrated. Before
      // that it's a locked card, a goal for the late game (from the family's 2nd hamster).
      const closed = !info.open;
      c.card.classList.toggle('hidden', closed && s.generation < 2 && s.colony === 0);
      c.card.classList.toggle('closed', closed);
      const affordable = !info.owned && game.canBuyMachine(c.id);
      if (affordable) machineReady = true;
      if (info.active) {
        setHTML(c.label, 'Running');
      } else if (closed) {
        setHTML(c.label, '🔒 After the Great Migration');
      } else if (info.owned) {
        setHTML(c.label, info.freeSpinsLeft > 0 ? `Switch to it · ${info.freeSpinsLeft} free spins waiting` : 'Switch to it');
      } else {
        setHTML(c.label, coinLabel(`Buy · ${formatCoins(info.cost)}`));
      }
      c.button.classList.toggle('switch', info.owned && !info.active);
      c.button.disabled = info.active || closed;
      paintBuy(c.button, c.fill, { maxed: info.active, affordable: info.owned || affordable, progress: closed ? 0 : divide(s.coins, info.cost).toNumber() });
      setText(c.wait, info.owned || closed ? '' : waitText(info.cost, rate));
    }

    // Upgrade tiles
    const ready = { hamster: false, machine: false };
    for (const t of tiles) {
      const level = game.getUpgradeLevel(t.id);
      const maxed = game.isMaxed(t.id);
      const bulk = game.getUpgradeBulk(t.id, want());
      // An upgrade that needs another one first (Old Clunky's Both Ways needs the Third Reel),
      // or is still locked (1.3.1: a rebirth or sticker upgrade).
      const needs = game.getUpgradeNeeds(t.id);
      const lock = lockText(game, t.id);
      const blocked = needs.length > 0 || lock !== null;
      const preview = blocked ? null : game.previewUpgrade(t.id, bulk.count);
      setText(t.level, maxed ? 'MAX' : t.def.maxLevel ? `Lv ${level}/${t.def.maxLevel}` : `Lv ${level}`);
      setHTML(t.effect, preview ? shortEffect(game, t.def, preview) : `<span class="note">${lock || `Needs ${needs.join(' + ')}`}</span>`);
      t.pips.forEach((pip, i) => pip.classList.toggle('on', i < level));
      const times = bulk.count > 1 ? `×${bulk.count} · ` : '';
      const label = maxed ? 'Maxed out' : blocked ? 'Locked' : coinLabel(`${times}${formatCoins(bulk.cost)}`);
      setHTML(t.label, label);
      const paint = { maxed, affordable: bulk.affordable, progress: blocked ? 0 : divide(s.coins, bulk.cost).toNumber() };
      paintBuy(t.button, t.fill, paint);
      t.tile.classList.toggle('ready', bulk.affordable);
      t.tile.classList.toggle('selected', t.id === selected);
      if (bulk.affordable) ready[t.def.scope === 'machine' ? 'machine' : 'hamster'] = true;
      // The detail card, for the tile you tapped (only while its sub-tab is open).
      if (t.id === selected) {
        if (detail.shown !== t.id) {
          detail.shown = t.id;
          detail.icon.replaceChildren(spriteImg(upgradeIcon(t.def), 32, t.def.name[0]));
          setText(detail.name, t.def.name);
          setText(detail.desc, t.def.description);
        }
        const scope = t.def.scope === 'machine' ? game.getMachineData().name : 'Hamster · every machine';
        setText(detail.tag, `${scope} · ${maxed ? 'MAX' : t.def.maxLevel ? `Lv ${level} of ${t.def.maxLevel}` : `Lv ${level}`}`);
        const why = lockText(game, t.id, true);
        setHTML(detail.effect, preview ? describeEffect(game, t.def, preview)
          : `<span class="note">${why ? `${why}${needs.length ? ` It also needs the ${needs.join(' and the ')}.` : ''}` : `Needs the ${needs.join(' and the ')} first`}</span>`);
        setHTML(detail.label, label);
        paintBuy(detail.button, detail.fill, paint);
        setText(detail.wait, maxed || bulk.affordable || blocked ? '' : waitText(bulk.cost, rate));
      }
    }
    const open = subtabs.current;
    const pick = tiles.find((t) => t.id === selected);
    const showDetail = !!pick && (pick.def.scope === 'machine' ? open === 'machine' : open === 'hamster');
    el.detail.classList.toggle('hidden', !showDetail);
    // The machine's own sub-tab: a Rebuild card once every upgrade on it is maxed.
    const here = game.getMachineInfo(game.getMachineData().id)!;
    const st = game.data.stars;
    const showRebuild = here.fullyUpgraded && here.stars < here.maxStars;
    rebuildEl.card.classList.toggle('hidden', !(showRebuild || here.stars > 0));
    setHTML(rebuildEl.text, showRebuild
      ? `<b>Every upgrade on ${game.getMachineData().name} is maxed!</b> Rebuild it for Machine Star ${here.stars + 1} of ${here.maxStars}: +${Math.round(game.getStarPayout() * 100)}% payouts and +${st.luckPerStar} Luck on this machine, for good. Its upgrades start again from nothing (your coins stay).<div>${starRow(here.stars, here.maxStars)}</div>`
      : here.stars >= here.maxStars
        ? `${starRow(here.stars, here.maxStars)} Every star this machine can have.`
        : `${starRow(here.stars, here.maxStars)} Max every upgrade here to rebuild it for another star.`);
    rebuildEl.button.classList.toggle('hidden', !showRebuild);
    rebuildEl.button.disabled = !here.canRebuild; // (busy: spinning, free spins, the jackpot wheel)
    setText(rebuildEl.button, armed(here.id) ? 'Tap again: reset its upgrades for a star' : here.canRebuild ? 'Rebuild for a star' : 'Rebuild when the machine is idle');
    if (showRebuild && here.canRebuild) ready.machine = true;

    // The Hamster Helper's switch, once the family has planted Helping Paws (1.3.1).
    const helper = game.getHelper();
    el.helper.classList.toggle('hidden', !helper);
    if (helper) {
      el.helper.classList.toggle('off', !s.helper);
      setText(el.helperBtn, s.helper ? 'On' : 'Off');
      el.helperBtn.setAttribute('aria-pressed', String(s.helper));
      setHTML(el.helperText, `<b>Hamster Helper</b> <span class="note">${s.helper
        ? `buys the cheapest upgrade here that costs ${Math.round(helper.share * 100)}% of your coins or less`
        : 'switched off: tap to let it buy cheap upgrades for you'}${s.stats.helperBuys ? ` · ${s.stats.helperBuys.toLocaleString('en-US')} levels bought so far` : ''}</span>`);
    }

    subtabs.setDot('hamster', ready.hamster);
    subtabs.setDot('machine', ready.machine);
    subtabs.setDot('machines', machineReady);
    return ready.hamster || ready.machine || machineReady;
  }

  build();
  return { build, render, elementFor, openSub: subtabs.open };
}
