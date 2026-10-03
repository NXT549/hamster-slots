// casino.ts — LOGIC layer (M11, the Hamster Casino). The casino's chips, its four
// games and the Prize Counter, plugged into the game by game.ts (createCasino).
//
// The user's picks (DESIGN §27):
//   · Chips are earned by playing the machines (a chip every few paid spins, more
//     when a hamster retires) and can be bought with coins.
//   · Four games: Hamster Roulette, Blackjack, the Hamster Derby and Seed Drop. Each
//     keeps a small house edge (the rules and their exact odds are in roulette.ts,
//     blackjack.ts, derby.ts and seeddrop.ts).
//   · Chips only buy prizes: timed boosts, Luck charms, Hamster Tokens and skins you
//     can only get here. They never turn back into coins, and nothing here is ever
//     real money (AGENTS.md: no real money, ever).
//
// Rule 1 holds here too: no DOM and no clock. A boost counts down in game time
// (tick), a charm with every paid spin. The RNG is the game's, so a seed replays
// every card, pocket and bounce exactly (the tests and the golden run use that).

import { money, roundMoney } from './money.ts';
import type { Money, MoneyLike } from './money.ts';
import type { Rng } from './rng.ts';
import type { GameData, GameState, GameEvents, CasinoDef, LoyaltyDef, LoyaltyTierDef, PrizeDef, Effect, RouletteBet, BlackjackHand, TokenSource, ChipSource } from './types.ts';
import { covers, paysFor, spinRoulette, picksFor, ROULETTE_KINDS, rouletteRtp } from './roulette.ts';
import type { RouletteKind } from './roulette.ts';
import { drawCard, handValue, isBlackjack, dealerShouldHit, settle, returnFor, bestPlay, blackjackRtp } from './blackjack.ts';
import type { BjOutcome } from './blackjack.ts';
import { runDerby as pickWinner, racerChance, derbyRtp } from './derby.ts';
import { dropSeed as bounceSeed, seedDropRtp, binChance } from './seeddrop.ts';

// What the casino needs from the game (game.ts passes these in). `state` and
// `data` are functions because loading a save or new data replaces them.
export interface CasinoHost {
  state(): GameState;
  data(): GameData;
  rng: Rng;
  emit<K extends keyof GameEvents>(name: K, payload: GameEvents[K]): void;
  // What the hamster earns per second on its best machine at its biggest bet,
  // without boosts: a chip's price follows it (see getChipPrice).
  incomePerSecond(): Money;
  changeCoins(amount: Money): void;
  earnTokens(amount: MoneyLike, source: TokenSource): void;
  checkDiary(): void;
}

export function createCasino(host: CasinoHost) {
  const def = (): CasinoDef | null => {
    const c = host.data().casino;
    return c && c.enabled ? c : null;
  };
  const casino = () => host.state().casino;
  const stats = () => host.state().stats;

  // ───────────────────── Opening and chips ─────────────────────

  // The casino opens once the family has a second hamster (after the first
  // retirement), and it's closed in the Big Cage between lives (time stands still there).
  // (A family that has migrated, 1.4.0, found it long ago: it stays open.)
  function isUnlocked(): boolean {
    const c = def();
    return !!c && (host.state().generation >= c.unlockGeneration || host.state().colony > 0);
  }
  function isOpen(): boolean {
    return isUnlocked() && !host.state().bigCage;
  }

  function changeChips(amount: Money, source: ChipSource): void {
    const s = casino();
    s.chips = roundMoney(s.chips.add(amount)).max(0);
    host.emit('chipsChanged', { chips: s.chips, amount, source });
  }

  // Chips the family earns (not bought, not won): counted in stats.chipsEarned.
  function earnChips(amount: number, source: ChipSource): void {
    if (!(amount > 0)) return;
    stats().chipsEarned = stats().chipsEarned.add(amount);
    changeChips(money(amount), source);
  }

  // A paid spin (manual or auto; never a free spin) on any machine. It earns a chip
  // every few spins, and it uses up one spin of every Luck charm (the spin's reels
  // were already rolled, with the charm's Luck).
  function onPaidSpin(): void {
    const c = def();
    if (!c || !isUnlocked()) return;
    const s = casino();
    s.spinsToChip++;
    if (s.spinsToChip >= c.chipsPerSpins.spins) {
      s.spinsToChip = 0;
      earnChips(c.chipsPerSpins.chips, 'spins');
    }
    for (const prize of c.prizes) {
      if (prize.kind !== 'charm' || !(s.boosts[prize.id] > 0)) continue;
      s.boosts[prize.id]--;
      if (s.boosts[prize.id] <= 0) endBoost(prize.id);
    }
  }

  // A hamster is about to retire: the family remembers what it earned (a chip's price).
  function beforeRetire(): void {
    if (def()) noteIncome();
  }

  // The family migrated (1.4.0): a chip's price follows the new colony's earnings
  // from now on (the old colony's best would price every chip out of reach).
  function onMigrate(): void {
    if (def()) casino().bestIncome = money(0);
  }

  // A hamster retired: the family gets chips (the first retirement opens the casino).
  function onRetire(): void {
    const c = def();
    if (c && isUnlocked()) earnChips(c.chipsPerRetirement, 'retire');
  }

  // A chip costs a few seconds of the family's best earnings per second (its best
  // machine, at its biggest bet, without boosts), so chips cost about the same share
  // of your coins early and late in the game. "The family's best" is the best of now
  // and every earlier life (noted when a hamster retires and when chips are bought):
  // a new pup can't buy chips cheaply at the start of its life, while it earns little.
  // It never costs less than chipMinPrice.
  function bestIncome(): Money {
    return host.incomePerSecond().max(casino().bestIncome);
  }
  function getChipPrice(): Money {
    const c = def();
    if (!c) return money(Infinity);
    return bestIncome().mul(c.chipPriceSeconds).max(c.chipMinPrice).ceil();
  }
  function noteIncome(): void {
    casino().bestIncome = bestIncome();
  }

  // Buy chips with coins (the buy buttons: 100, 1,000 …). Coins spent here never
  // count against the coins you've earned (they decide Heirloom Seeds).
  function buyChips(count: number): boolean {
    if (!isOpen() || !(count > 0) || !Number.isInteger(count)) return false;
    const cost = getChipPrice().mul(count);
    if (!host.state().coins.gte(cost)) return false;
    noteIncome();
    host.changeCoins(cost.neg());
    stats().chipsBought = stats().chipsBought.add(count);
    changeChips(money(count), 'buy');
    host.checkDiary();
    return true;
  }

  // ───────────────────── Bets ─────────────────────

  // The table's bets, and the bigger ones the Loyalty Card's tiers have opened.
  function getBetSteps(): number[] {
    const c = def();
    if (!c) return [];
    const extra = reachedTiers().flatMap((t) => t.betSteps || []);
    if (!extra.length) return c.betSteps;
    return [...new Set([...c.betSteps, ...extra])].sort((a, b) => a - b);
  }

  // A bet is a whole number of the smallest chip (10), up to the table's limit (the
  // biggest step). Every payout is then a whole number of chips.
  function isValidBet(amount: Money | number): boolean {
    const steps = getBetSteps();
    if (!steps.length) return false;
    const n = money(amount).toNumber();
    return n >= steps[0] && n <= steps[steps.length - 1] && Number.isInteger(n / steps[0]);
  }

  function canStake(amount: Money | number): boolean {
    return isOpen() && isValidBet(amount) && casino().chips.gte(amount);
  }

  // Take the chips for a game, and later pay back what it returned. Every chip
  // staked counts on the Loyalty Card (a doubled blackjack bet counts twice).
  function stake(amount: Money): void {
    changeChips(amount.neg(), 'bet');
    const s = casino();
    s.wagered = s.wagered.add(amount);
    checkLoyalty();
  }
  function payBack(returned: Money): void {
    stats().casinoGames++;
    if (returned.gt(0)) {
      changeChips(returned, 'win');
      stats().biggestCasinoWin = stats().biggestCasinoWin.max(returned);
    }
    host.checkDiary();
  }

  // ───────────────────── The Loyalty Card ─────────────────────
  // The more chips you bet (win or lose), the higher your tier. A tier gives its
  // Hamster Tokens once and can open bigger bets or the VIP lounge. It never touches
  // a table's odds: every bet still gives back the same share of each chip, so a
  // bigger bet only wins or loses more at once (rule 4). The gifts are a few tokens
  // at tiers that need ever more chips bet, so they can't be farmed.

  function loyalty(): LoyaltyDef | null {
    const c = def();
    return (c && c.loyalty) || null;
  }

  function reachedTiers(): LoyaltyTierDef[] {
    const l = loyalty();
    return l ? l.tiers.slice(0, casino().tier) : [];
  }

  // Gift every tier the chips bet have reached (several at once if the data changed).
  function checkLoyalty(): void {
    const l = loyalty();
    if (!l) return;
    const s = casino();
    while (s.tier < l.tiers.length && s.wagered.gte(l.tiers[s.tier].wagered)) {
      const t = l.tiers[s.tier];
      s.tier++;
      if (t.tokens > 0) host.earnTokens(t.tokens, 'casino');
      host.emit('loyaltyTier', { tier: s.tier, id: t.id, name: t.name, tokens: t.tokens, betSteps: t.betSteps || [], lounge: !!t.lounge });
    }
  }

  // The card as the view draws it: the tier you're at, the next one, and the stamps
  // on the way there (each stamp is an equal share of the chips between the two).
  function getLoyalty() {
    const l = loyalty();
    if (!l) return null;
    const s = casino();
    const tier = s.tier > 0 ? l.tiers[s.tier - 1] : null;
    const next = s.tier < l.tiers.length ? l.tiers[s.tier] : null;
    const from = tier ? tier.wagered : 0;
    let stamps = l.stampsPerTier;
    let toNextStamp = 0;
    if (next) {
      const per = (next.wagered - from) / l.stampsPerTier;
      const done = Math.max(0, s.wagered.toNumber() - from);
      stamps = Math.min(l.stampsPerTier - 1, Math.floor(done / per));
      toNextStamp = Math.max(1, Math.ceil(from + per * (stamps + 1) - s.wagered.toNumber()));
    }
    return {
      name: l.name, tierName: tier ? tier.name : l.memberName, tier: s.tier, tiers: l.tiers,
      next, wagered: s.wagered, stamps, stampsPerTier: l.stampsPerTier, toNextStamp,
      lounge: reachedTiers().some((t) => t.lounge),
    };
  }

  // ───────────────────── Hamster Roulette ─────────────────────
  // Any number of bets on one spin (chips on red, on 17, on the 2nd dozen …).
  // Each spot holds up to the table's limit. The pocket is picked here; the view
  // rolls the hamster's ball to it.

  function isValidRouletteBet(b: RouletteBet): boolean {
    return ROULETTE_KINDS.includes(b.kind) && Number.isInteger(b.pick) && b.pick >= 0 && b.pick < picksFor(b.kind) && isValidBet(b.amount);
  }

  function playRoulette(bets: readonly RouletteBet[]): boolean {
    const c = def();
    if (!c || !isOpen() || !bets.length || !bets.every(isValidRouletteBet)) return false;
    // One spot once (the view adds chips to a spot; two entries for it would dodge the limit).
    const spots = new Set(bets.map((b) => `${b.kind}:${b.pick}`));
    if (spots.size !== bets.length) return false;
    const staked = bets.reduce((sum, b) => sum.add(b.amount), money(0));
    if (!casino().chips.gte(staked)) return false;
    stake(staked);
    const pocket = spinRoulette(host.rng);
    let returned = money(0);
    const results = bets.map((b) => {
      const back = covers(b.kind, b.pick, pocket) ? roundMoney(money(b.amount).mul(paysFor(b.kind, c.roulette.pays))) : money(0);
      returned = returned.add(back);
      if (b.kind === 'number' && back.gt(0)) stats().rouletteNumbers++;
      return { kind: b.kind, pick: b.pick, amount: money(b.amount), returned: back };
    });
    payBack(returned);
    host.emit('rouletteSpun', { pocket, bets: results, staked, returned });
    return true;
  }

  // ───────────────────── Blackjack ─────────────────────
  // deal(bet) → hit / stand / double down → the dealer plays → paid. A finished
  // hand stays on the table (outcome set) until the next deal, so the view can show it.

  function handInPlay(): boolean {
    const h = casino().hand;
    return !!h && h.outcome === null;
  }

  function dealBlackjack(bet: number): boolean {
    if (!canStake(bet) || handInPlay()) return false;
    const amount = money(bet);
    stake(amount);
    const r = host.rng;
    const hand: BlackjackHand = {
      bet: amount, player: [drawCard(r), drawCard(r)], dealer: [drawCard(r), drawCard(r)], doubled: false, outcome: null, returned: money(0),
    };
    casino().hand = hand;
    // Blackjacks end the hand at once: the dealer peeks at its hole card when it shows an Ace or a ten.
    const playerBj = isBlackjack(hand.player);
    const dealerBj = isBlackjack(hand.dealer);
    if (playerBj || dealerBj) finishHand(playerBj && !dealerBj ? 'blackjack' : playerBj && dealerBj ? 'push' : 'lose');
    else host.emit('blackjackChanged', { hand });
    return true;
  }

  function hitBlackjack(): boolean {
    const hand = casino().hand;
    if (!isOpen() || !hand || hand.outcome !== null) return false;
    hand.player.push(drawCard(host.rng));
    const total = handValue(hand.player).total;
    if (total > 21) finishHand('bust');
    else if (total === 21) dealerPlays(); // nothing better to do on 21
    else host.emit('blackjackChanged', { hand });
    return true;
  }

  function standBlackjack(): boolean {
    const hand = casino().hand;
    if (!isOpen() || !hand || hand.outcome !== null) return false;
    dealerPlays();
    return true;
  }

  // Double down: the bet doubles, one more card, then the dealer plays.
  function doubleBlackjack(): boolean {
    const hand = casino().hand;
    if (!canDouble()) return false;
    stake(hand!.bet);
    hand!.bet = hand!.bet.mul(2);
    hand!.doubled = true;
    hand!.player.push(drawCard(host.rng));
    if (handValue(hand!.player).total > 21) finishHand('bust');
    else dealerPlays();
    return true;
  }

  function canDouble(): boolean {
    const hand = casino().hand;
    return isOpen() && !!hand && hand.outcome === null && hand.player.length === 2 && casino().chips.gte(hand.bet);
  }

  function dealerPlays(): void {
    const hand = casino().hand!;
    while (dealerShouldHit(hand.dealer)) hand.dealer.push(drawCard(host.rng));
    finishHand(settle(hand.player, hand.dealer));
  }

  function finishHand(outcome: BjOutcome): void {
    const c = def()!;
    const hand = casino().hand!;
    // A doubled bet already counts twice: returnFor is per chip on the table.
    const returned = roundMoney(hand.bet.mul(returnFor(outcome, c.blackjack.blackjackPays)));
    hand.outcome = outcome;
    hand.returned = returned;
    if (outcome === 'blackjack') stats().blackjacks++;
    payBack(returned);
    host.emit('blackjackChanged', { hand });
    host.emit('blackjackEnded', { outcome, bet: hand.bet, returned });
  }

  // The best play for the hand on the table (the table's hint), or null.
  function getBlackjackHint(): 'stand' | 'hit' | 'double' | null {
    const hand = casino().hand;
    if (!hand || hand.outcome !== null) return null;
    return bestPlay(hand.player, hand.dealer[0], canDouble()); // (can't double: the better of hit and stand)
  }

  // ───────────────────── The Hamster Derby ─────────────────────

  function runDerby(racerId: string, bet: number): boolean {
    const c = def();
    const racer = c && c.derby.racers.find((r) => r.id === racerId);
    if (!c || !racer || !canStake(bet)) return false;
    const amount = money(bet);
    stake(amount);
    const winner = pickWinner(host.rng, c.derby.racers);
    const returned = winner.id === racer.id ? roundMoney(amount.mul(racer.pays)) : money(0);
    if (returned.gt(0) && racer.id === c.derby.longshot) stats().derbyLongshots++;
    payBack(returned);
    host.emit('derbyRun', { racer: racer.id, winner: winner.id, bet: amount, returned });
    return true;
  }

  // ───────────────────── Seed Drop ─────────────────────

  function dropSeed(bet: number): boolean {
    const c = def();
    if (!c || !canStake(bet)) return false;
    const amount = money(bet);
    stake(amount);
    const rows = c.seedDrop.multipliers.length - 1;
    const { path, bin } = bounceSeed(host.rng, rows);
    const multiplier = c.seedDrop.multipliers[bin];
    const returned = roundMoney(amount.mul(multiplier));
    if (bin === 0 || bin === rows) stats().seedDropEdges++;
    payBack(returned);
    host.emit('seedDropped', { path, bin, multiplier, bet: amount, returned });
    return true;
  }

  // ───────────────────── The Prize Counter ─────────────────────
  // A boost lasts some seconds of play, a charm some paid spins; buying one again
  // adds more, up to its max (so no chips are wasted). Their effects count like a
  // worn skin's (level 1 while they last): game.ts effectsOfType asks boostEffects().

  function getPrize(id: string): PrizeDef | null {
    const c = def();
    return (c && c.prizes.find((p) => p.id === id)) || null;
  }

  // Why a prize can't be bought right now, or null if it can.
  function prizeBlock(prize: PrizeDef): 'closed' | 'chips' | 'full' | 'owned' | null {
    if (!isOpen()) return 'closed';
    const left = casino().boosts[prize.id] || 0;
    if (prize.kind === 'boost' && left + prize.seconds > prize.maxSeconds + 1e-9) return 'full';
    if (prize.kind === 'charm' && left + prize.spins > prize.maxSpins) return 'full';
    if (prize.kind === 'skin' && host.state().skins.owned[prize.skin]) return 'owned';
    if (!casino().chips.gte(prize.cost)) return 'chips';
    return null;
  }

  function getPrizeBlock(id: string): ReturnType<typeof prizeBlock> | 'unknown' {
    const prize = getPrize(id);
    return prize ? prizeBlock(prize) : 'unknown';
  }

  function canBuyPrize(id: string): boolean {
    return getPrizeBlock(id) === null;
  }

  function buyPrize(id: string): boolean {
    const prize = getPrize(id);
    if (!prize || prizeBlock(prize) !== null) return false;
    const cost = money(prize.cost);
    changeChips(cost.neg(), 'prize');
    const boosts = casino().boosts;
    if (prize.kind === 'boost') boosts[prize.id] = (boosts[prize.id] || 0) + prize.seconds;
    else if (prize.kind === 'charm') boosts[prize.id] = (boosts[prize.id] || 0) + prize.spins;
    else if (prize.kind === 'tokens') host.earnTokens(prize.tokens, 'casino');
    else host.state().skins.owned[prize.skin] = true;
    stats().prizesBought++;
    host.emit('prizeBought', { id: prize.id, cost });
    host.checkDiary();
    return true;
  }

  // Every boost and charm under way: [{ id, name, kind, left, max }] (seconds or spins).
  function getBoosts() {
    const c = def();
    if (!c) return [];
    const out: { id: string; name: string; kind: 'boost' | 'charm'; left: number; max: number }[] = [];
    for (const p of c.prizes) {
      const left = casino().boosts[p.id] || 0;
      if (!(left > 0)) continue;
      if (p.kind === 'boost') out.push({ id: p.id, name: p.name, kind: 'boost', left, max: p.maxSeconds });
      else if (p.kind === 'charm') out.push({ id: p.id, name: p.name, kind: 'charm', left, max: p.maxSpins });
    }
    return out;
  }

  // The effects of every boost and charm under way.
  function boostEffects(): Effect[] {
    const c = def();
    if (!c) return [];
    const out: Effect[] = [];
    for (const p of c.prizes) {
      if ((p.kind === 'boost' || p.kind === 'charm') && casino().boosts[p.id] > 0) out.push(p.effect);
    }
    return out;
  }

  function endBoost(id: string): void {
    delete casino().boosts[id];
    host.emit('boostEnded', { id });
  }

  // Boosts count down in game time (not while the game is closed, and not in the Big Cage).
  function tick(dt: number): void {
    const c = def();
    if (!c) return;
    const boosts = casino().boosts;
    for (const p of c.prizes) {
      if (p.kind !== 'boost' || !(boosts[p.id] > 0)) continue;
      boosts[p.id] -= dt;
      if (boosts[p.id] <= 1e-9) endBoost(p.id);
    }
  }

  // ───────────────────── Odds (the Info line on every table) ─────────────────────

  // The exact return to the player of every bet (1 = you get back what you bet; the
  // house keeps the rest). Roulette: by kind; the Derby: by racer; with their chances.
  function getCasinoOdds() {
    const c = def();
    if (!c) return null;
    const rows = c.seedDrop.multipliers.length - 1;
    return {
      roulette: ROULETTE_KINDS.map((kind: RouletteKind) => ({ kind, pays: paysFor(kind, c.roulette.pays), rtp: rouletteRtp(kind, c.roulette.pays) })),
      blackjack: { rtp: blackjackRtp(c.blackjack.blackjackPays), blackjackPays: c.blackjack.blackjackPays },
      derby: c.derby.racers.map((r) => ({ id: r.id, name: r.name, pays: r.pays, chance: racerChance(r, c.derby.racers), rtp: derbyRtp(r, c.derby.racers) })),
      seedDrop: { rtp: seedDropRtp(c.seedDrop.multipliers), bins: c.seedDrop.multipliers.map((m, k) => ({ multiplier: m, chance: binChance(rows, k) })) },
    };
  }

  // Debug only: free chips.
  function addChips(amount: MoneyLike): void {
    changeChips(money(amount).floor().max(casino().chips.neg()), 'debug');
  }

  return {
    isUnlocked, isOpen, getChipPrice, buyChips, getBetSteps, isValidBet, canStake,
    playRoulette, dealBlackjack, hitBlackjack, standBlackjack, doubleBlackjack, canDouble, getBlackjackHint, handInPlay,
    runDerby, dropSeed,
    getPrize, canBuyPrize, getPrizeBlock, buyPrize, getBoosts, boostEffects,
    getCasinoOdds, addChips, earnChips, getLoyalty,
    onPaidSpin, beforeRetire, onRetire, onMigrate, tick,
  };
}

// A fresh casino (a new game): no chips, no boosts, no hand on the table, a blank Loyalty Card.
export function newCasinoState(): GameState['casino'] {
  return { chips: money(0), bestIncome: money(0), spinsToChip: 0, boosts: {}, hand: null, wagered: money(0), tier: 0 };
}
