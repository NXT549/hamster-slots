// festival.ts — LOGIC layer (Pumpkin Night). Seasonal festivals: for a couple of
// weeks a year the room dresses up, the hamster collects a festival treat (Candy)
// and a stall sells outfits you can only get then. game.ts plugs it in
// (createFestival), like casino.ts.
//
// The choices (DESIGN §33, PORTING_NOTES D167):
//   · The dates are month-days in data.json ("10-20" to "11-03"), so a festival
//     comes back every year. Only one festival is on at a time.
//   · Rule 1: the logic never reads the clock. The view tells it today's date
//     (setDate) when the game starts, when the page comes back and once a minute.
//   · Candy is counted, never rolled: one every few winning spins, a few for each
//     delivery and some for time away. The RNG is never touched, so the reels,
//     the payouts and every machine's odds are exactly the same with a festival on.
//   · Candy only buys the stall's outfits. It never becomes coins or seeds. When the
//     festival ends, what's left turns into Hamster Tokens, so nothing is wasted.
//   · The outfits are kept for good (they're ordinary skins with the same gentle
//     buffs as other skins of their rarity), and one you missed comes back next year.

import type { MoneyLike } from './money.ts';
import type { GameData, GameState, GameEvents, FestivalsDef, FestivalDef, FestivalState, TokenSource } from './types.ts';

// What the festival needs from the game (game.ts passes these in).
export interface FestivalHost {
  state(): GameState;
  data(): GameData;
  emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void;
  earnTokens(amount: MoneyLike, source: TokenSource): void;
  checkDiary(): void;
}

export function newFestivalState(): FestivalState {
  return { id: null, treats: 0, wins: 0 };
}

// "10-20" → 1020, so dates compare as plain numbers (month × 100 + day).
export function monthDay(text: string): number {
  const [m, d] = text.split('-').map(Number);
  return m * 100 + d;
}

// Is a festival on, on this month and day? A festival may cross New Year
// ("12-20" to "01-05"): then its end comes before its start.
export function festivalOnDate(f: FestivalDef, month: number, day: number): boolean {
  const today = month * 100 + day;
  const start = monthDay(f.start);
  const end = monthDay(f.end);
  return start <= end ? today >= start && today <= end : today >= start || today <= end;
}

export function createFestival(host: FestivalHost) {
  const defs = (): FestivalsDef | null => {
    const f = host.data().festivals;
    return f && f.enabled ? f : null;
  };
  const fest = () => host.state().festival;
  const stats = () => host.state().stats;

  // The festival on right now (the one the last setDate found), or null.
  function getActive(): FestivalDef | null {
    const d = defs();
    const id = fest().id;
    return (d && id && d.list.find((f) => f.id === id)) || null;
  }

  // The view tells the game today's date. A festival starts or ends here.
  function setDate(month: number, day: number): void {
    const d = defs();
    const today = d ? d.list.find((f) => festivalOnDate(f, month, day)) || null : null;
    const now = fest().id;
    if (today && today.id === now) return;
    if (now) end();
    if (today) {
      const s = fest();
      s.id = today.id;
      s.treats = 0;
      s.wins = 0;
      host.emit('festivalStarted', { id: today.id });
    }
  }

  // The end: the candy left over becomes Hamster Tokens (rounded down).
  function end(): void {
    const s = fest();
    const id = s.id!;
    const d = defs();
    const tokens = d ? Math.floor(s.treats / d.treatsPerToken) : 0;
    const treats = s.treats;
    s.id = null;
    s.treats = 0;
    s.wins = 0;
    if (tokens > 0) host.earnTokens(tokens, 'festival');
    host.emit('festivalEnded', { id, treats, tokens });
  }

  function addTreats(amount: number, source: 'win' | 'delivery' | 'away' | 'debug'): void {
    if (!(amount > 0) || !getActive()) return;
    fest().treats += amount;
    if (source !== 'debug') stats().treatsEarned += amount;
    host.emit('treatsChanged', { treats: fest().treats, amount, source });
    host.checkDiary();
  }

  // A winning spin (paid or free): every `winsPerTreat` wins bring a candy.
  function onWin(): void {
    const d = defs();
    if (!d || !getActive()) return;
    const s = fest();
    s.wins++;
    if (s.wins >= d.winsPerTreat) {
      s.wins = 0;
      addTreats(1, 'win');
    }
  }

  // A delivery always brings candy back (trick or treat!).
  function onDelivery(): void {
    const d = defs();
    if (d) addTreats(d.treatsPerDelivery, 'delivery');
  }

  // Time away: a candy for every few minutes, counted up to the offline limit.
  function applyOffline(seconds: number, maxSeconds: number): void {
    const d = defs();
    if (!d) return;
    const counted = Math.min(seconds, maxSeconds);
    addTreats(Math.floor(counted / (d.awayMinutesPerTreat * 60)), 'away');
  }

  // The stall: what's for sale this festival, and whether you have it.
  function getStall() {
    const f = getActive();
    if (!f) return [];
    return f.items.map((item) => ({ skin: item.skin, cost: item.cost, owned: !!host.state().skins.owned[item.skin] }));
  }

  function canBuy(skin: string): boolean {
    const item = getStall().find((i) => i.skin === skin);
    return !!item && !item.owned && fest().treats >= item.cost;
  }

  function buyItem(skin: string): boolean {
    if (!canBuy(skin)) return false;
    const item = getStall().find((i) => i.skin === skin)!;
    fest().treats -= item.cost;
    host.state().skins.owned[skin] = true;
    stats().festivalItems++;
    host.emit('treatsChanged', { treats: fest().treats, amount: -item.cost, source: 'stall' });
    host.emit('festivalItemBought', { skin, cost: item.cost });
    host.checkDiary();
    return true;
  }

  // Which festival a skin comes from (for the Wardrobe's "how to get it").
  function festivalOfSkin(skin: string): FestivalDef | null {
    const d = defs();
    return (d && d.list.find((f) => f.items.some((i) => i.skin === skin))) || null;
  }

  return {
    getActive, setDate, onWin, onDelivery, applyOffline, getStall, canBuy, buyItem, festivalOfSkin,
    addTreats: (n: number) => addTreats(n, 'debug'),
  };
}
