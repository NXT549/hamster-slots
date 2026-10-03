// owncasino.ts — LOGIC layer (M12, the Family Casino). The family's own casino,
// for a family that has made the Great Migration: cabinets of your machines on the
// floor, hamster guests playing them, and the house's edge coming in as Takings.
// game.ts plugs it in (createOwnCasino), like casino.ts.
//
// The choices (DESIGN §32, PORTING_NOTES D164):
//   · The guests play below 100%. Your own machines always pay YOU more than 100%
//     (rule 4), so a guest on them would beat the house; on the floor every cabinet
//     has its own guest return (92–95%, shown on screen). Your odds never change.
//   · Takings are their own currency. They never become coins and never count as
//     coins earned, so the casino can't farm Heirloom Seeds or shorten a life. They
//     buy the casino's own cabinets and upgrades, and (back office) chips and tokens.
//   · Exact, not random: a guest's spins are counted at their average (bet × the
//     house edge ÷ the time a spin takes), so the takings while you play and while
//     you're away come from the same formula, and the RNG is never touched.
//   · The takings go into a till that holds a few hours of them; a tap empties it.
//     That is the casino's one chore, and the reason to drop by.
//   · Kept for good: retiring and migrating change nothing here (only Reset does).
//
// Rule 1 holds: no DOM and no clock. The till fills in game time (tick) and, while
// the game was closed, by the seconds the platform says passed (applyOffline).

import { money } from './money.ts';
import type { Money, MoneyLike } from './money.ts';
import type { GameData, GameState, GameEvents, OwnCasinoDef, CabinetDef, FloorUpgradeDef, OwnRewardDef, FloorEffectType, Priced, TokenSource, ChipSource } from './types.ts';

// What the Family Casino needs from the game (game.ts passes these in).
export interface OwnCasinoHost {
  state(): GameState;
  data(): GameData;
  emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void;
  costAtLevel(def: Priced, owned: number): Money; // rule 3: the one cost formula
  earnTokens(amount: MoneyLike, source: TokenSource): void;
  earnChips(amount: number, source: ChipSource): void;
  checkDiary(): void;
}

export function createOwnCasino(host: OwnCasinoHost) {
  // The casino needs the Hamster Casino (it's part of it on screen), and either can be
  // left out of a build with its own flag.
  const def = (): OwnCasinoDef | null => {
    const d = host.data();
    return d.ownCasino && d.ownCasino.enabled && d.casino && d.casino.enabled ? d.ownCasino : null;
  };
  const own = () => host.state().ownCasino;
  const stats = () => host.state().stats;

  // ───────────────────── Opening ─────────────────────

  // It opens for a family that has migrated (the first life of the second colony on).
  function isUnlocked(): boolean {
    const d = def();
    return !!d && host.state().colony >= d.unlockColony;
  }
  function isOpen(): boolean {
    return isUnlocked() && own().opened;
  }

  // The grand opening: the free cabinets (cost 0: Old Clunky) go on the floor.
  function open(): void {
    const d = def()!;
    const o = own();
    o.opened = true;
    let first: string | null = null;
    for (const c of d.cabinets) {
      if (c.cost > 0 || o.cabinets[c.machine]) continue;
      o.cabinets[c.machine] = true;
      stats().cabinetsBought++;
      first = first || c.machine;
    }
    host.emit('ownCasinoOpened', { cabinet: first });
    host.checkDiary();
  }

  // ───────────────────── What the floor earns ─────────────────────

  function upgradeTotal(type: FloorEffectType): number {
    const d = def();
    if (!d) return 0;
    let sum = 0;
    for (const u of d.upgrades) if (u.effect.type === type) sum += u.effect.perLevel * (own().upgrades[u.id] || 0);
    return sum;
  }

  function getCabinet(machine: string): CabinetDef | undefined {
    const d = def();
    return d ? d.cabinets.find((c) => c.machine === machine) : undefined;
  }

  // What the guests win back on a cabinet on average (the Floor Manager trims it,
  // never below minGuestRtp). 1 − this is the house's edge.
  function getGuestRtp(machine: string): number {
    const c = getCabinet(machine);
    if (!c) return 1;
    return Math.max(def()!.minGuestRtp, c.guestRtp - upgradeTotal('houseEdge'));
  }

  // Every guest's bet and the number of guests are multiplied by the upgrades.
  function getGuestMultiplier(): number {
    return 1 + upgradeTotal('guests');
  }
  function getBetMultiplier(): number {
    return 1 + upgradeTotal('guestBet');
  }
  // A guest's bet on a cabinet (Takings a spin).
  function getGuestBet(machine: string): number {
    const c = getCabinet(machine);
    return c ? c.bet * getBetMultiplier() : 0;
  }

  // Takings per second from one cabinet: a guest's bet × the house edge, once per spin
  // (the machine's spin time + the guest's rest), × the guests. The exact average:
  // what a guest wins back is (by definition of the return) guestRtp of what it bets.
  function getCabinetRate(machine: string): number {
    const c = getCabinet(machine);
    const md = host.data().machines.find((m) => m.id === machine);
    if (!c || !md) return 0;
    const seconds = md.spinDuration + def()!.guestRestSeconds;
    return (getGuestBet(machine) * (1 - getGuestRtp(machine)) / seconds) * getGuestMultiplier();
  }

  // The whole floor, per second (the cabinets you own).
  function getTakingsPerSecond(): number {
    if (!isOpen()) return 0;
    let sum = 0;
    for (const c of def()!.cabinets) if (own().cabinets[c.machine]) sum += getCabinetRate(c.machine);
    return sum;
  }

  // The till holds this many hours of takings (at today's rate) before it's full.
  function getTillHours(): number {
    const d = def();
    return d ? d.tillHours + upgradeTotal('tillHours') : 0;
  }
  function getTillCapacity(): Money {
    return money(getTakingsPerSecond() * getTillHours() * 3600);
  }
  function isTillFull(): boolean {
    const cap = getTillCapacity();
    return cap.gt(0) && own().till.gte(cap);
  }

  // Put takings in the till, up to what it holds. Returns what went in.
  function fillTill(seconds: number): Money {
    const rate = getTakingsPerSecond();
    if (!(rate > 0) || !(seconds > 0)) return money(0);
    const o = own();
    const room = getTillCapacity().sub(o.till).max(0);
    const add = money(rate * seconds).min(room);
    o.till = o.till.add(add);
    return add;
  }

  // ───────────────────── Time ─────────────────────

  // Every tick of play (never in the Big Cage: time stands still there).
  function tick(dt: number): void {
    if (!isUnlocked()) return;
    if (!own().opened) open();
    fillTill(dt);
  }

  // While the game was closed: the same formula for the seconds that passed (the
  // till's size is the limit, not offline.maxSeconds). Nothing in the Big Cage.
  function applyOffline(seconds: number): Money {
    if (!isOpen() || host.state().bigCage) return money(0);
    const added = fillTill(seconds);
    if (added.gt(0)) host.emit('tillOffline', { seconds, takings: added });
    return added;
  }

  // ───────────────────── Actions ─────────────────────

  // Empty the till: its takings are banked (spendable). Never coins, never "earned" coins.
  function emptyTill(): boolean {
    const o = own();
    if (!isOpen() || !o.till.gt(0)) return false;
    const amount = o.till;
    o.till = money(0);
    o.takings = o.takings.add(amount);
    stats().takingsEarned = stats().takingsEarned.add(amount);
    stats().tillsEmptied++;
    host.emit('tillEmptied', { amount, takings: o.takings });
    host.checkDiary();
    return true;
  }

  function spend(cost: Money): boolean {
    const o = own();
    if (!o.takings.gte(cost)) return false;
    o.takings = o.takings.sub(cost).max(0);
    return true;
  }

  function canBuyCabinet(machine: string): boolean {
    const c = getCabinet(machine);
    return !!c && isOpen() && !own().cabinets[machine] && own().takings.gte(c.cost);
  }
  function buyCabinet(machine: string): boolean {
    if (!canBuyCabinet(machine)) return false;
    const cost = money(getCabinet(machine)!.cost);
    spend(cost);
    own().cabinets[machine] = true;
    stats().cabinetsBought++;
    host.emit('cabinetBought', { machine, cost });
    host.checkDiary();
    return true;
  }

  function getFloorUpgrade(id: string): FloorUpgradeDef | undefined {
    const d = def();
    return d ? d.upgrades.find((u) => u.id === id) : undefined;
  }
  function getFloorLevel(id: string): number {
    return own().upgrades[id] || 0;
  }
  function isFloorMaxed(id: string): boolean {
    const u = getFloorUpgrade(id);
    return !!u && u.maxLevel !== null && getFloorLevel(id) >= u.maxLevel;
  }
  function getFloorCost(id: string): Money {
    const u = getFloorUpgrade(id);
    return u ? host.costAtLevel(u, getFloorLevel(id)) : money(Infinity);
  }
  function canBuyFloorUpgrade(id: string): boolean {
    return !!getFloorUpgrade(id) && isOpen() && !isFloorMaxed(id) && own().takings.gte(getFloorCost(id));
  }
  function buyFloorUpgrade(id: string): boolean {
    if (!canBuyFloorUpgrade(id)) return false;
    const cost = getFloorCost(id);
    spend(cost);
    const level = getFloorLevel(id) + 1;
    own().upgrades[id] = level;
    host.emit('floorUpgradeBought', { id, level, cost });
    host.checkDiary();
    return true;
  }

  function getOwnReward(id: string): OwnRewardDef | undefined {
    const d = def();
    return d ? d.rewards.find((r) => r.id === id) : undefined;
  }
  function getOwnRewardCost(id: string): Money {
    const r = getOwnReward(id);
    return r ? host.costAtLevel(r, own().rewards[id] || 0) : money(Infinity);
  }
  function canBuyOwnReward(id: string): boolean {
    const r = getOwnReward(id);
    return !!r && isOpen() && !(r.maxLevel !== null && (own().rewards[id] || 0) >= r.maxLevel) && own().takings.gte(getOwnRewardCost(id));
  }
  // Takings for chips (they buy the Prize Counter's boosts) or Hamster Tokens. Each one
  // costs more every time (rule 3), so the casino can't flood the Prize Counter.
  function buyOwnReward(id: string): boolean {
    if (!canBuyOwnReward(id)) return false;
    const r = getOwnReward(id)!;
    const cost = getOwnRewardCost(id);
    spend(cost);
    own().rewards[id] = (own().rewards[id] || 0) + 1;
    if (r.kind === 'chips') host.earnChips(r.chips, 'takings');
    else host.earnTokens(r.tokens, 'takings');
    host.emit('ownRewardBought', { id, cost });
    host.checkDiary();
    return true;
  }

  // Debug only: free takings (banked).
  function addTakings(amount: MoneyLike): void {
    const o = own();
    o.takings = o.takings.add(money(amount)).max(0);
  }

  return {
    isUnlocked, isOpen, tick, applyOffline,
    getCabinet, getGuestRtp, getGuestMultiplier, getBetMultiplier, getGuestBet, getCabinetRate, getTakingsPerSecond,
    getTillHours, getTillCapacity, isTillFull, emptyTill,
    canBuyCabinet, buyCabinet,
    getFloorUpgrade, getFloorLevel, isFloorMaxed, getFloorCost, canBuyFloorUpgrade, buyFloorUpgrade,
    getOwnReward, getOwnRewardCost, canBuyOwnReward, buyOwnReward,
    addTakings,
  };
}

// A fresh Family Casino (a new game): not open yet, nothing on the floor.
export function newOwnCasinoState(): GameState['ownCasino'] {
  return { opened: false, cabinets: {}, upgrades: {}, rewards: {}, till: money(0), takings: money(0) };
}
