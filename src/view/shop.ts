// shop.ts — VIEW layer. The Upgrades tab, in three sub-tabs:
//   1) Hamster:   the hamster's own upgrades (they work on every machine)
//   2) [Machine]: the upgrades of the machine you're running (named after it)
//   3) Machines:  a card for every machine in data.json. Buy it, or switch to it.
// The ×1 / ×10 / Max toggle (a saved setting) sits next to the sub-tabs, and tiles
// show "ready in ~2 min" hints for the ones you're saving up for.
// Like ui.ts, it only calls game actions (buyUpgrade, buyMachine, switchMachine)
// and reads state.

import { spriteImg, upgradeIcon, MACHINE_SPRITES } from './art.ts';
import { formatCoins, formatSeconds, formatWait, setText, setHTML, replayClass, iconHTML, createSubTabs } from './dom.ts';
import { effectAs } from '../logic/game.ts';
import { divide } from '../logic/money.ts';
import type { Game } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import type { UpgradeDef, TreeNodeDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';

// What game.previewUpgrade / previewTreeNode return: the value now and after buying.
// Each effect type has its own kind of value (a number, a Money for coins and
// the payout multiplier, on/off, Luck's { luck, hitRate } …) and its format below
// knows which, so it's loosely typed here. (A Money has toFixed() too.)
type Preview = { now: any; next: any };
type Format = (value: any) => string;
type Def = UpgradeDef | TreeNodeDef;

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
  };
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

// The "now → next" line, as HTML with the next value highlighted.
export function describeEffect(game: Game, def: Def, { now, next }: Preview): string {
  if (def.effect.type === 'luck' || def.effect.type === 'unlockSymbol') return describeTwoWay(game, def, { now, next });
  if (def.effect.type === 'bothWays') return describeBothWays({ now, next });
  const format = effectFormats(game)[def.effect.type] || ((): [string, Format] => ['', String]);
  const [label, fmt] = format(def);
  const tail = next === null ? ' <span class="note">(max)</span>' : ` → <span class="next">${fmt(next)}</span>`;
  return `${label} ${fmt(now)}${tail}`;
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
  return chips.join('');
}

const AMOUNTS: [Settings['buyAmount'], string][] = [[1, '×1'], [10, '×10'], ['max', 'Max']];

// An upgrade tile and a machine card: the elements render() updates.
interface Tile {
  id: string;
  def: UpgradeDef;
  tile: HTMLElement;
  button: HTMLButtonElement;
  pips: HTMLElement[];
  level: HTMLElement;
  effect: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
  wait: HTMLElement;
}
interface Card {
  id: string;
  card: HTMLElement;
  button: HTMLButtonElement;
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
    amount: $('buy-amount'), machineNote: $('machine-upgrades-note'),
  };
  const subtabs = createSubTabs($('upgrades-subtabs'), $('tab-upgrades'), { key: 'upgrades', settings, onSettingsChange });
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
        settings.buyAmount = value;
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
        <div class="mc-text"><div class="tile-name"></div><div class="tile-tag mc-stats"></div><div class="mc-features"></div><div class="tile-desc"></div></div>
        <div class="mc-action">
          <button class="buy-btn"><span class="buy-fill"></span><span class="buy-label"></span></button>
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
      el.machines.appendChild(card);
      return {
        id: md.id, card, button,
        stats: card.querySelector<HTMLElement>('.mc-stats')!, features: card.querySelector<HTMLElement>('.mc-features')!, fill: card.querySelector<HTMLElement>('.buy-fill')!,
        label: card.querySelector<HTMLElement>('.buy-label')!, wait: card.querySelector<HTMLElement>('.wait-hint')!,
      };
    });
  }

  function makeTile(def: UpgradeDef): Tile {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `
      <div class="tile-top">
        <div class="tile-icon"></div>
        <div><div class="tile-name"></div><div class="tile-tag"><span class="tile-scope"></span> · <span class="tile-level"></span></div></div>
      </div>
      <div class="tile-desc"></div>
      <div class="tile-effect"></div>
      <div class="pips"></div>
      <button class="buy-btn"><span class="buy-fill"></span><span class="buy-label"></span></button>
      <span class="wait-hint"></span>`;
    tile.querySelector('.tile-icon')!.appendChild(spriteImg(upgradeIcon(def), 32, def.name[0]));
    tile.querySelector('.tile-name')!.textContent = def.name;
    // Machine upgrades name their machine, so it's clear they stay with it.
    tile.querySelector('.tile-scope')!.textContent = def.scope === 'machine' ? game.getMachineData().name : 'Hamster';
    tile.querySelector('.tile-desc')!.textContent = def.description;

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
      id: def.id, def, tile, button, pips,
      level: tile.querySelector<HTMLElement>('.tile-level')!,
      effect: tile.querySelector<HTMLElement>('.tile-effect')!,
      fill: tile.querySelector<HTMLElement>('.buy-fill')!,
      label: tile.querySelector<HTMLElement>('.buy-label')!,
      wait: tile.querySelector<HTMLElement>('.wait-hint')!,
    };
  }

  // Hamster upgrades go in one sub-tab, this machine's in the other.
  function buildTiles() {
    const defs = game.getAvailableUpgrades();
    tileKey = defs.map((d) => d.id).join();
    el.hamster.replaceChildren();
    el.machine.replaceChildren();
    tiles = defs.map((def) => {
      const t = makeTile(def);
      (def.scope === 'machine' ? el.machine : el.hamster).appendChild(t.tile);
      return t;
    });
    const md = game.getMachineData();
    subtabs.setLabel('machine', md.name);
    setText(el.machineNote, `${md.name}'s own upgrades. They stay with this machine when you switch.`);
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
    if (tileKey !== game.getAvailableUpgrades().map((d) => d.id).join()) buildTiles(); // switched machine

    [...el.amount.children].forEach((b, i) => b.classList.toggle('active', AMOUNTS[i][0] === settings.buyAmount));
    el.amount.classList.toggle('hidden', subtabs.current === 'machines');

    // Machine cards
    let machineReady = false;
    for (const c of cards) {
      const info = game.getMachineInfo(c.id)!;
      const reels = info.reels < info.maxReels ? `${info.reels} of ${info.maxReels} reels` : `${info.reels} reels`;
      const lines = info.maxLines > 1 ? ` · ${info.lines} of ${info.maxLines} paylines` : ' · 1 payline';
      const bet = info.owned && info.bet > 1 ? ` · bet ×${info.bet}` : '';
      setText(c.stats, `${reels}${lines} · ${formatCoins(info.spinCost)} a spin${bet}`);
      setHTML(c.features, featureChips(info));
      c.card.classList.toggle('active', info.active);
      c.card.classList.toggle('owned', info.owned);
      const affordable = !info.owned && game.canBuyMachine(c.id);
      if (affordable) machineReady = true;
      if (info.active) {
        setHTML(c.label, 'Running');
      } else if (info.owned) {
        setHTML(c.label, info.freeSpinsLeft > 0 ? `Switch to it · ${info.freeSpinsLeft} free spins waiting` : 'Switch to it');
      } else {
        setHTML(c.label, coinLabel(`Buy · ${formatCoins(info.cost)}`));
      }
      c.button.classList.toggle('switch', info.owned && !info.active);
      c.button.disabled = info.active;
      paintBuy(c.button, c.fill, { maxed: info.active, affordable: info.owned || affordable, progress: divide(s.coins, info.cost).toNumber() });
      setText(c.wait, info.owned ? '' : waitText(info.cost, rate));
    }

    // Upgrade tiles
    const ready = { hamster: false, machine: false };
    for (const t of tiles) {
      const level = game.getUpgradeLevel(t.id);
      const maxed = game.isMaxed(t.id);
      const bulk = game.getUpgradeBulk(t.id, want());
      // An upgrade that needs another one first (Old Clunky's Both Ways needs the Third Reel).
      const needs = game.getUpgradeNeeds(t.id);
      setText(t.level, maxed ? 'MAX' : `Lv ${level}`);
      setHTML(t.effect, needs.length > 0 ? `<span class="note">Needs the ${needs.join(' and the ')} first</span>` : describeEffect(game, t.def, game.previewUpgrade(t.id, bulk.count)));
      t.pips.forEach((pip, i) => pip.classList.toggle('on', i < level));
      const times = bulk.count > 1 ? `×${bulk.count} · ` : '';
      setHTML(t.label, maxed ? 'Maxed out' : needs.length > 0 ? `Needs ${needs.join(' + ')}` : coinLabel(`${times}${formatCoins(bulk.cost)}`));
      paintBuy(t.button, t.fill, { maxed, affordable: bulk.affordable, progress: needs.length > 0 ? 0 : divide(s.coins, bulk.cost).toNumber() });
      t.tile.classList.toggle('ready', bulk.affordable);
      setText(t.wait, maxed || bulk.affordable || needs.length > 0 ? '' : waitText(bulk.cost, rate));
      if (bulk.affordable) ready[t.def.scope === 'machine' ? 'machine' : 'hamster'] = true;
    }
    subtabs.setDot('hamster', ready.hamster);
    subtabs.setDot('machine', ready.machine);
    subtabs.setDot('machines', machineReady);
    return ready.hamster || ready.machine || machineReady;
  }

  build();
  return { build, render, elementFor, openSub: subtabs.open };
}
