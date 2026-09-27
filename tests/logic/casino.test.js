// casino.test.js — M11, the Hamster Casino: chips (earned by spinning and retiring,
// bought with coins), four games with a small house edge (Hamster Roulette,
// Blackjack, the Hamster Derby, Seed Drop), and the Prize Counter (timed boosts, a
// Luck charm, Hamster Tokens and skins only the casino has). Chips only ever buy
// prizes: they never turn back into coins.

import { describe } from 'vitest';
import { check } from '../check.js';
import { data, near, deepEqual, num, newGame, bonanza, soldOn, land, spinExpectation, clunky, SAVE_VERSION } from './helpers.js';
import { createRng } from '../../src/logic/rng.ts';
import {
  RED_NUMBERS, WHEEL_ORDER, POCKETS, ROULETTE_KINDS, picksFor, covers, coverage, paysFor, rouletteRtp, pocketColor,
} from '../../src/logic/roulette.ts';
import { handValue, isBlackjack, dealerShouldHit, settle, returnFor, bestPlay, blackjackRtp } from '../../src/logic/blackjack.ts';
import { racerChance, derbyRtp } from '../../src/logic/derby.ts';
import { binChance, seedDropRtp, dropSeed } from '../../src/logic/seeddrop.ts';

const casino = data.casino;
const prize = (id) => casino.prizes.find((p) => p.id === id);
const card = (rank, suit = 'spades') => ({ rank, suit });
const cards = (...ranks) => ranks.map((r) => card(r));

// A family with its second hamster: the casino is open (after the first retirement).
function casinoGame(seed = 81) {
  const g = newGame(seed);
  g.addCoins(50000, true);
  g.retire();
  g.leaveBigCage();
  return g;
}

// ─────────────────────────────────────────────────────────────
describe('Hamster Roulette: a real single-zero wheel', () => {
  check('the wheel has 37 pockets, each once', POCKETS === 37 && deepEqual([...WHEEL_ORDER].sort((a, b) => a - b), [...Array(37).keys()]));
  check('18 red numbers, 18 black, and the green zero',
    RED_NUMBERS.size === 18 && [...Array(37).keys()].filter((n) => pocketColor(n) === 'black').length === 18 && pocketColor(0) === 'green');
  check('red and black alternate around the wheel', WHEEL_ORDER.slice(1).every((n, i) => i === 0 || pocketColor(n) !== pocketColor(WHEEL_ORDER[i])));
  check('even-money bets cover 18 numbers, dozens and columns 12, a number 1',
    ['red', 'black', 'odd', 'even', 'low', 'high'].every((k) => coverage(k) === 18)
    && [0, 1, 2].every((p) => coverage('dozen', p) === 12 && coverage('column', p) === 12) && coverage('number', 17) === 1);
  check('the three dozens (and the three columns) split 1–36 between them, and 0 is in none',
    [...Array(36).keys()].map((i) => i + 1).every((n) => [0, 1, 2].filter((p) => covers('dozen', p, n)).length === 1
      && [0, 1, 2].filter((p) => covers('column', p, n)).length === 1)
    && ROULETTE_KINDS.filter((k) => k !== 'number').every((k) => [0, 1, 2].every((p) => !covers(k, p, 0))));
  check('a bet on 0 wins only on 0', covers('number', 0, 0) && !covers('number', 0, 32));
  const pays = casino.roulette.pays;
  check('every bet returns exactly 36/37 (the zero is the house\'s 2.7%)',
    ROULETTE_KINDS.every((k) => [...Array(picksFor(k)).keys()].every((p) => near(rouletteRtp(k, pays, p), 36 / 37, 1e-12))));
  check('the pays: 1 to 1, 2 to 1, 35 to 1 (stake included: ×2, ×3, ×36)', paysFor('red', pays) === 2 && paysFor('column', pays) === 3 && paysFor('number', pays) === 36);

  // The game's wheel: every pocket about equally often, and red returns ≈ 36/37.
  const g = casinoGame(82);
  g.addChips(1e7);
  const seen = new Array(37).fill(0);
  let staked = 0;
  let back = 0;
  g.on('rouletteSpun', (e) => { seen[e.pocket]++; staked += num(e.staked); back += num(e.returned); });
  for (let i = 0; i < 37000; i++) g.playRoulette([{ kind: 'red', pick: 0, amount: 10 }]);
  check(`37,000 spins: every pocket lands 1000 ± 130 times (${Math.min(...seen)}–${Math.max(...seen)})`, seen.every((n) => Math.abs(n - 1000) < 130));
  check(`…and red returns ${(back / staked).toFixed(4)} ≈ 36/37`, near(back / staked, 36 / 37, 0.02));
  check('each spin is one casino game', g.state.stats.casinoGames === 37000);
});

// ─────────────────────────────────────────────────────────────
describe('Blackjack: the house rules and their exact odds', () => {
  check('hand values: A+K = 21 (a blackjack), A+6 = soft 17, A+6+10 = hard 17, K+Q+5 = 25',
    handValue(cards(1, 13)).total === 21 && isBlackjack(cards(1, 13))
    && deepEqual(handValue(cards(1, 6)), { total: 17, soft: true }) && deepEqual(handValue(cards(1, 6, 10)), { total: 17, soft: false })
    && handValue(cards(13, 12, 5)).total === 25);
  check('two aces are 12, three cards of 21 aren\'t a blackjack', handValue(cards(1, 1)).total === 12 && !isBlackjack(cards(7, 7, 7)));
  check('the dealer hits 16, stands on 17 (a soft 17 too)', dealerShouldHit(cards(10, 6)) && !dealerShouldHit(cards(10, 7)) && !dealerShouldHit(cards(1, 6)));
  check('settling: 20 beats 19, 18 ties 18, a bust dealer loses, a bust player loses',
    settle(cards(10, 10), cards(10, 9)) === 'win' && settle(cards(10, 8), cards(9, 9)) === 'push'
    && settle(cards(10, 5), cards(10, 6, 10)) === 'win' && settle(cards(10, 5, 10), cards(10, 6)) === 'bust');
  check('what a hand pays back per chip: blackjack 2.5, a win 2, a push 1, else 0',
    returnFor('blackjack', 1.5) === 2.5 && returnFor('win', 1.5) === 2 && returnFor('push', 1.5) === 1 && returnFor('lose', 1.5) === 0 && returnFor('bust', 1.5) === 0);
  const rtp = blackjackRtp(casino.blackjack.blackjackPays);
  check(`perfect play returns ${rtp.toFixed(5)}: the house keeps about 1%`, rtp > 0.985 && rtp < 0.995);
  check('a blackjack paying 6 to 5 would return less (the pays matter)', blackjackRtp(1.2) < rtp);
  check('the hints are basic strategy: double 11 v 6, hit 16 v 10, stand 12 v 4, hit soft 18 v 9, stand 17 v Ace',
    bestPlay(cards(5, 6), card(6)) === 'double' && bestPlay(cards(10, 6), card(10)) === 'hit' && bestPlay(cards(10, 2), card(4)) === 'stand'
    && bestPlay(cards(1, 7), card(9)) === 'hit' && bestPlay(cards(10, 7), card(1)) === 'stand');

  // Played in the game by its hint, many hands return about what the maths says.
  const g = casinoGame(83);
  g.addChips(1e8);
  const before = num(g.state.casino.chips);
  const hands = 60000;
  for (let i = 0; i < hands; i++) {
    g.dealBlackjack(10);
    for (let hint = g.getBlackjackHint(); hint; hint = g.getBlackjackHint()) {
      if (hint === 'double') g.doubleBlackjack();
      else if (hint === 'hit') g.hitBlackjack();
      else g.standBlackjack();
    }
  }
  const played = (num(g.state.casino.chips) - before) / (hands * 10) + 1;
  check(`60,000 hands played by the hints return ${played.toFixed(4)} ≈ ${rtp.toFixed(4)}`, near(played, rtp, 0.02));
  check('every hand was paid (none left on the table)', !g.state.casino.hand || g.state.casino.hand.outcome !== null);
  check(`blackjacks happen about 1 hand in 21 (${g.state.stats.blackjacks})`, near(g.state.stats.blackjacks / hands, (2 * 4) / 169 * (1 - 0.0473 * 0.37), 0.01));
});

// ─────────────────────────────────────────────────────────────
describe('Blackjack at the table: deal, hit, stand, double down', () => {
  const g = casinoGame(84);
  g.addChips(1000);
  check('no hand before a deal: hit, stand and double do nothing', !g.hitBlackjack() && !g.standBlackjack() && !g.doubleBlackjack());
  check('bets are 10, 20, 50 … 1000 chips: 5, 15 and 2000 are refused', !g.dealBlackjack(5) && !g.dealBlackjack(15) && !g.dealBlackjack(2000));
  // Deal until a hand is still being played.
  let hand = null;
  for (let i = 0; i < 50 && !hand; i++) {
    g.dealBlackjack(20);
    if (g.state.casino.hand.outcome === null) hand = g.state.casino.hand;
  }
  check('a hand in play: the dealer shows one card of two, the bet is off the pile', hand && hand.dealer.length === 2 && hand.player.length === 2);
  check('…and no second deal until it ends', !g.dealBlackjack(20));
  check('the other tables stay open meanwhile', g.dropSeed(10));
  const save = g.toSaveData();
  check('a hand in play is saved', save.casino.hand && save.casino.hand.outcome === null && save.casino.hand.bet === '20');
  const h = newGame(84);
  h.loadSaveData(save);
  check('…and loads, still in play', h.state.casino.hand && h.state.casino.hand.outcome === null && deepEqual(h.state.casino.hand.player, hand.player));
  check('doubling needs the first two cards and chips for it', h.canDouble());
  const pile = num(h.state.casino.chips);
  h.doubleBlackjack();
  const done = h.state.casino.hand;
  check('double down: the bet doubles, one more card, then the dealer plays it out',
    done.doubled && num(done.bet) === 40 && done.player.length === 3 && done.outcome !== null && handValue(done.dealer).total >= 17 - (done.outcome === 'bust' ? 99 : 0));
  check(`…and it paid what it says (${done.outcome}: ${num(done.returned)} for 40)`,
    num(done.returned) === 40 * returnFor(done.outcome, 1.5) && num(h.state.casino.chips) === pile - 20 + num(done.returned));
  check('a finished hand isn\'t saved (it\'s already paid)', h.toSaveData().casino.hand === null);

  // A player blackjack against no dealer blackjack pays 3 to 2 at once.
  const b = casinoGame(85);
  b.addChips(1e6);
  let bj = null;
  b.on('blackjackEnded', (e) => { if (e.outcome === 'blackjack') bj = e; });
  for (let i = 0; i < 400 && !bj; i++) {
    b.dealBlackjack(20);
    while (b.getBlackjackHint()) b.standBlackjack();
  }
  check('a blackjack pays 3 to 2 on the deal (20 → 50 back)', bj && num(bj.returned) === 50);
  check('the Blackjack! sticker', b.state.diary.blackjack === true);
});

// ─────────────────────────────────────────────────────────────
describe('the Hamster Derby and Seed Drop', () => {
  const racers = casino.derby.racers;
  check('five racers; their chances add up to 1', racers.length === 5 && near(racers.reduce((s, r) => s + racerChance(r, racers), 0), 1, 1e-12));
  check('the favourite pays least, the long shot most', racers.every((r, i) => i === 0 || (r.pays > racers[i - 1].pays && r.weight < racers[i - 1].weight))
    && casino.derby.longshot === racers.at(-1).id);
  check(`every racer returns 94–97% (${racers.map((r) => derbyRtp(r, racers).toFixed(3)).join(', ')})`,
    racers.every((r) => derbyRtp(r, racers) > 0.94 && derbyRtp(r, racers) < 0.97));
  const g = casinoGame(86);
  g.addChips(1e7);
  const wins = {};
  g.on('derbyRun', (e) => { wins[e.winner] = (wins[e.winner] || 0) + 1; });
  for (let i = 0; i < 20000; i++) g.runDerby('nutmeg', 10);
  check('20,000 races: each hamster wins about as often as its chance says',
    racers.every((r) => near((wins[r.id] || 0) / 20000, racerChance(r, racers), 0.015)));
  check('an unknown racer is refused', !g.runDerby('speedy', 10));

  const m = casino.seedDrop.multipliers;
  const rows = m.length - 1;
  check(`the board: ${rows} rows of pegs, ${m.length} bins, the same on both sides`, deepEqual(m, [...m].reverse()));
  check('the bins\' chances add up to 1 (C(rows, k) / 2^rows)', near(m.reduce((s, _, k) => s + binChance(rows, k), 0), 1, 1e-12) && binChance(rows, 0) === 1 / 2 ** rows);
  const sd = seedDropRtp(m);
  check(`a drop returns ${sd.toFixed(4)}: a small house edge`, sd > 0.94 && sd < 0.99);
  const r = createRng(9);
  let bins = new Array(m.length).fill(0);
  for (let i = 0; i < 25600; i++) {
    const d = dropSeed(r, rows);
    if (d.path.length !== rows || d.bin !== d.path.reduce((s, x) => s + x, 0)) bins = null;
    if (bins) bins[d.bin]++;
  }
  check('a seed bounces once per row, and lands in the bin of its rights', bins !== null);
  check('25,600 drops land like the chances say', bins && bins.every((n, k) => near(n / 25600, binChance(rows, k), 0.01)));
  const s = casinoGame(87);
  s.addChips(1e6);
  let paid = null;
  s.on('seedDropped', (e) => { paid = e; });
  s.dropSeed(50);
  check('a drop pays the bet × its bin (a whole number of chips)', paid && num(paid.returned) === Math.round(50 * paid.multiplier) && Number.isInteger(num(paid.returned)));
});

// ─────────────────────────────────────────────────────────────
describe('the casino: small house edges, bets, whole chips', () => {
  const g = casinoGame(88);
  const odds = g.getCasinoOdds();
  const all = [...odds.roulette.map((x) => x.rtp), odds.blackjack.rtp, ...odds.derby.map((x) => x.rtp), odds.seedDrop.rtp];
  check(`every game keeps a SMALL house edge (the user's pick): every bet returns 94–99.5% (${Math.min(...all).toFixed(3)}–${Math.max(...all).toFixed(3)})`,
    all.every((x) => x > 0.94 && x < 0.995));
  check('bets are whole steps: every bet step is a multiple of the smallest', casino.betSteps.every((b) => b % casino.betSteps[0] === 0));
  check('every payout of every bet step is a whole number of chips',
    casino.betSteps.every((b) => [...racers(), ...casino.seedDrop.multipliers, 1 + casino.blackjack.blackjackPays, 2, 3, 36].every((x) => near(b * x, Math.round(b * x), 1e-9))));
  function racers() { return casino.derby.racers.map((r) => r.pays); }
  g.addChips(100);
  const coins = num(g.state.coins);
  check('a roulette spot holds up to the table limit; a spot can\'t be bet twice in one spin',
    !g.playRoulette([{ kind: 'red', pick: 0, amount: 2000 }]) && !g.playRoulette([{ kind: 'red', pick: 0, amount: 10 }, { kind: 'red', pick: 0, amount: 10 }]));
  check('bad picks are refused (a 4th dozen, number 37)', !g.playRoulette([{ kind: 'dozen', pick: 3, amount: 10 }]) && !g.playRoulette([{ kind: 'number', pick: 37, amount: 10 }]));
  check('no bet bigger than the chips you have', !g.runDerby('nutmeg', 1000) && !g.playRoulette([{ kind: 'red', pick: 0, amount: 500 }, { kind: 'black', pick: 0, amount: 500 }]));
  for (let i = 0; i < 30; i++) { g.dropSeed(10); g.runDerby('tofu', 10); }
  check('chips never turn into coins: playing leaves the coins alone', num(g.state.coins) === coins);
});

// ─────────────────────────────────────────────────────────────
describe('chips: opening, earning, buying', () => {
  const first = newGame(89);
  first.addCoins(1e6);
  check('the first hamster has no casino: no chips, no games', !first.isCasinoOpen() && !first.buyChips(100) && !first.dropSeed(10));
  first.buyUpgrade('wheel');
  for (let i = 0; i < 20; i++) { first.spin(); land(first); }
  check('…and its spins earn no chips', num(first.state.casino.chips) === 0);

  const g = newGame(90);
  g.addCoins(50000, true);
  const events = [];
  g.on('chipsChanged', (e) => events.push(e.source));
  g.retire();
  check('retiring opens the casino for the family, with chips', g.isCasinoUnlocked() && num(g.state.casino.chips) === casino.chipsPerRetirement && events[0] === 'retire');
  check('…but not in the Big Cage (time stands still there)', !g.isCasinoOpen() && !g.dropSeed(10));
  g.leaveBigCage();
  check('the new pup\'s life: the casino is open', g.isCasinoOpen());
  g.addCoins(1e6);
  const start = num(g.state.casino.chips);
  for (let i = 0; i < 10; i++) { g.spin(); land(g); }
  check(`a chip for every ${casino.chipsPerSpins.spins} paid spins (10 spins → ${10 / casino.chipsPerSpins.spins * casino.chipsPerSpins.chips})`,
    num(g.state.casino.chips) - start === (10 / casino.chipsPerSpins.spins) * casino.chipsPerSpins.chips);
  check('earned chips are counted', num(g.state.stats.chipsEarned) === casino.chipsPerRetirement + 5);
  // Free spins don't earn chips.
  const f = casinoGame(91);
  f.addCoins(1e9);
  f.buyMachine('bonanza');
  f.addFreeSpins(6);
  const had = num(f.state.casino.chips);
  for (let i = 0; i < 6; i++) f.update(30);
  check('free spins earn no chips', f.state.stats.freeSpins >= 6 && num(f.state.casino.chips) === had);

  // Buying: the price follows what the hamster earns, and chips never count as earned.
  const b = casinoGame(92);
  b.addCoins(1e9);
  b.buyUpgrade('wheel', 3);
  const price = b.getChipPrice();
  check(`a chip costs ${casino.chipPriceSeconds} s of the hamster's best earnings (${num(price)} coins)`,
    num(price) === Math.max(casino.chipMinPrice, Math.ceil(num(b.getIncomePerSecond()) * casino.chipPriceSeconds)));
  const coins = num(b.state.coins);
  const earned = num(b.state.run.coinsEarned);
  check('buying 1,000 chips', b.buyChips(1000) && num(b.state.casino.chips) === casino.chipsPerRetirement + 1000);
  check('…costs 1,000 × the price, and the coins you\'ve earned don\'t drop',
    near(coins - num(b.state.coins), num(price) * 1000, 1e-6) && num(b.state.run.coinsEarned) === earned && num(b.state.stats.chipsBought) === 1000);
  check('you can\'t buy more than your coins pay for, or part of a chip', !b.buyChips(1e12) && !b.buyChips(0.5) && !b.buyChips(-5));
  b.buyMachine('stacker');
  b.buyMachine('bonanza');
  const onBest = num(b.getChipPrice());
  b.switchMachine('clunky');
  b.setBet(0);
  check('the price is set by the best machine at its biggest bet: switching machine or lowering the bet doesn\'t make chips cheaper',
    num(b.getChipPrice()) === onBest && onBest > num(price));
  b.buyPrize('goldenHour') || (b.addChips(1000), b.buyPrize('goldenHour'));
  check('a boost doesn\'t make chips dearer', num(b.getChipPrice()) === onBest);
  b.addCoins(1e7, true);
  b.retire();
  b.leaveBigCage();
  check('a new pup earns little, but chips don\'t get cheaper: the family remembers its best',
    num(b.getIncomePerSecond()) < onBest / casino.chipPriceSeconds && num(b.getChipPrice()) >= onBest);
});

// ─────────────────────────────────────────────────────────────
describe('the Prize Counter: boosts, charms, tokens, skins', () => {
  const g = casinoGame(93);
  g.addChips(100000);
  const pm = num(g.getPayoutMultiplier());
  check('Golden Hour', g.buyPrize('goldenHour'));
  check('…every machine pays × 1.5 (its own group: it multiplies the rest)', near(num(g.getPayoutMultiplier()), pm * 1.5, 1e-9));
  check('…for 90 s of play', deepEqual(g.getBoosts().map((b) => [b.id, b.left]), [['goldenHour', 90]]));
  check('buying more adds time, up to 10 minutes: no chips wasted', [1, 2, 3, 4, 5].every(() => g.buyPrize('goldenHour')) && !g.buyPrize('goldenHour')
    && g.getBoosts()[0].left === 540 && g.getPrizeBlock('goldenHour') === 'full');
  g.update(100);
  check('it counts down in play', near(g.getBoosts()[0].left, 440, 1e-6));
  g.addCoins(1e6);
  g.buyUpgrade('wheel'); // auto-spin: time away pays
  const away = num(g.getOfflineEarnings(3600).coins);
  const boosted = g.getEconomy().expectedAutoProfitPerSecond; // with Golden Hour on
  const coins = num(g.state.coins);
  g.applyOfflineEarnings(3600);
  check('time away pays as if no boost were on (a boost only counts while you play)',
    away > 0 && near(num(g.state.coins) - coins, away, 0.01) && away < num(boosted) * 3600 * data.offline.efficiency);
  check('…and the boost doesn\'t count down while you\'re away', near(g.getBoosts()[0].left, 440, 1e-6));
  g.openBigCage();
  g.update(60);
  check('nor in the Big Cage', near(g.getBoosts()[0].left, 440, 1e-6));
  g.leaveBigCage();
  let ended = null;
  g.on('boostEnded', (e) => { ended = e.id; });
  g.update(441);
  check('when it runs out: the payouts are back, and an event says so', g.getBoosts().length === 0 && ended === 'goldenHour' && near(num(g.getPayoutMultiplier()), pm, 1e-9));

  const t = casinoGame(94);
  t.addChips(10000);
  t.addCoins(1e6);
  t.buyUpgrade('wheel', 5);
  const spin = t.getSpinDuration();
  const auto = t.getAutoInterval();
  t.buyPrize('turboWheel');
  check('Turbo Wheel: spins take 20% less time', near(t.getSpinDuration(), spin * 0.8, 1e-9));
  check('…and auto-spin still never beats spin time + the rest', t.getAutoInterval() <= auto && t.getAutoInterval() >= t.getSpinDuration() + 0.3 - 1e-9);

  const c = casinoGame(95);
  c.addChips(10000);
  c.addCoins(1e6);
  const luck = c.getLuck().total;
  const before = spinExpectation({ ...clunky, symbols: c.getSymbols() }, c.getReelCount(), { lines: 1 });
  c.buyPrize('luckyCharm');
  const after = spinExpectation({ ...clunky, symbols: c.getSymbols() }, c.getReelCount(), { lines: 1 });
  check('Lucky Charm: +15 Luck (Hamster Luck, on every machine)', c.getLuck().total === luck + 15 && c.getLuck().hamster === c.getLuck().total - c.getLuck().machine);
  check('…which raises both the hit rate and the EV, like every Luck', after.hitRate > before.hitRate && after.ev > before.ev);
  for (let i = 0; i < 40; i++) { c.spin(); land(c); }
  check('…for 100 paid spins: 40 spins leave 60', c.getBoosts()[0].left === 60);
  c.update(3600);
  check('…and time alone doesn\'t use it up', c.getBoosts()[0].left <= 60);

  const k = casinoGame(96);
  k.addChips(100000);
  const tokens = num(k.state.tokens);
  check('Token Bag: a Hamster Token', k.buyPrize('tokenBag') && num(k.state.tokens) === tokens + 1 + (k.state.diary.prizeWinner ? data.diary.find((d) => d.id === 'prizeWinner').tokens : 0));
  check('the Prize Winner sticker', k.state.diary.prizeWinner === true);
  check('the Dealer\'s Visor: bought once, then it\'s yours', k.buyPrize('visor') && k.isSkinOwned('hatVisor') && !k.buyPrize('visor') && k.getPrizeBlock('visor') === 'owned');
  const l = k.getLuck().total;
  k.equipSkin('hatVisor');
  check('…and wearing it gives a rare hat\'s +6 Luck', k.getLuck().total === l + 6);
  check('casino skins don\'t count for the "from capsules" stickers', k.getDiaryProgress('fashion').value === 0 && k.getDiaryProgress('hatTrick').value === 0);
  check('every casino skin is a real skin with a prize to buy it',
    data.skins.filter((s) => s.casino).every((s) => casino.prizes.some((p) => p.kind === 'skin' && p.skin === s.id)));
  const poor = casinoGame(97);
  check('no chips, no prizes', !poor.buyPrize('visor') && poor.getPrizeBlock('visor') === 'chips');
});

// ─────────────────────────────────────────────────────────────
describe('the casino: the rules still hold with every boost on', () => {
  // Rule 2: deliveries earn less than auto-spin at Wheel Training 1 (boosts only help auto-spin).
  const g = casinoGame(98);
  g.addChips(1e6);
  g.addCoins(1e6);
  g.buyUpgrade('wheel');
  for (const id of ['goldenHour', 'turboWheel', 'luckyCharm']) g.buyPrize(id);
  const econ = g.getEconomy();
  check('rule 2 with every boost: delivery/s < auto-spin profit/s', num(econ.deliveryPerSecond) < num(econ.expectedAutoProfitPerSecond));
  // Free spins still always end: the whole tree, max Luck, every Bouncy Ball, the best wardrobe and the Lucky Charm.
  const f = casinoGame(99);
  f.ownAllSkins();
  for (const id of ['furGolden', 'hatCrown', 'wheelGold', 'machineMidnight', 'roomSunflower']) f.equipSkin(id);
  f.addCoins(1e12);
  f.addChips(1e6);
  f.buyMachine('bonanza');
  for (const u of soldOn(bonanza, 'luck')) f.buyUpgrade(u.id, Infinity);
  for (const u of soldOn(bonanza, 'extraFreeSpins')) f.buyUpgrade(u.id, Infinity);
  f.openBigCage();
  f.addSeeds(1e6);
  for (let k = 0; k < 20; k++) for (const n of data.familyTree.nodes) if (f.canBuyTreeNode(n.id)) f.buyTreeNode(n.id);
  f.leaveBigCage();
  const without = f.getEconomy().freeSpins;
  f.buyPrize('luckyCharm');
  const fs = f.getEconomy().freeSpins;
  // A trigger's spins with retriggers = its spins ÷ (1 − the retrigger loop), so the loop is 1 − one ÷ the other.
  const loop = 1 - fs.perTrigger / fs.perTriggerWithRetriggers;
  check(`free spins always end with the charm on top of everything (retrigger loop ${loop.toFixed(3)} < 1)`,
    Number.isFinite(fs.perTriggerWithRetriggers) && fs.perTriggerWithRetriggers > 0 && loop < 1 && fs.chance > without.chance);
});

// ─────────────────────────────────────────────────────────────
describe('the casino in a save (v11)', () => {
  const g = casinoGame(100);
  g.addChips(5000);
  g.buyPrize('goldenHour');
  g.buyPrize('luckyCharm');
  g.update(10);
  const save = g.toSaveData();
  check('the save keeps the chips (as text), the boosts and the family\'s best earnings',
    save.saveVersion === SAVE_VERSION && typeof save.casino.chips === 'string' && near(save.casino.boosts.goldenHour, 80, 1e-6) && save.casino.boosts.luckyCharm === 100
    && typeof save.casino.bestIncome === 'string');
  const h = newGame(100);
  h.loadSaveData(save);
  check('…and loads them back', num(h.state.casino.chips) === num(g.state.casino.chips) && deepEqual(h.getBoosts(), g.getBoosts()));
  const bad = structuredClone(save);
  bad.casino = { chips: 'lots', bestIncome: -5, spinsToChip: 99, boosts: { goldenHour: 99999, luckyCharm: 2.5, nothing: 5 },
    hand: { bet: '20', player: [{ rank: 14, suit: 'spades' }], dealer: [], outcome: null } };
  const b = newGame(100);
  b.loadSaveData(bad);
  check('a broken casino in a save is cleaned up: no chips, boosts capped and known, no broken hand',
    num(b.state.casino.chips) === 0 && num(b.state.casino.bestIncome) === 0 && b.state.casino.spinsToChip < casino.chipsPerSpins.spins
    && deepEqual(b.state.casino.boosts, { goldenHour: prize('goldenHour').maxSeconds, luckyCharm: 3 }) && b.state.casino.hand === null);
  const old = structuredClone(save);
  old.saveVersion = 10;
  delete old.casino;
  for (const key of ['casinoGames', 'chipsBought', 'chipsEarned', 'biggestCasinoWin', 'rouletteNumbers', 'blackjacks', 'derbyLongshots', 'seedDropEdges', 'prizesBought']) delete old.stats[key];
  const o = newGame(100);
  check('a v10 save loads: no chips, no boosts, the casino stats at 0', o.loadSaveData(old) && num(o.state.casino.chips) === 0 && o.getBoosts().length === 0
    && o.state.stats.casinoGames === 0 && num(o.state.stats.chipsEarned) === 0);
  check('…and its family can play (it has retired before)', o.isCasinoOpen() === (o.state.generation >= casino.unlockGeneration));
  // The same seed plays the same casino.
  const run = (seed) => {
    const x = casinoGame(seed);
    x.addChips(10000);
    const log = [];
    x.on('rouletteSpun', (e) => log.push(e.pocket));
    x.on('derbyRun', (e) => log.push(e.winner));
    x.on('seedDropped', (e) => log.push(e.bin));
    for (let i = 0; i < 20; i++) { x.playRoulette([{ kind: 'red', pick: 0, amount: 10 }]); x.runDerby('pepper', 10); x.dropSeed(10); }
    return log;
  };
  check('the same seed replays every pocket, race and drop', deepEqual(run(7), run(7)) && !deepEqual(run(7), run(8)));
});
