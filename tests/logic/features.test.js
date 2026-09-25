// features.test.js — bonus features: free spins, the jackpot wheel, the card gamble, Hot Streak.
// Moved from tools/test_logic.mjs (migration step 3.3): each section's code is
// unchanged; check(name, condition) registers one Vitest test per check.

import { describe } from 'vitest';
import { check } from '../check.js';
import {
  readFileSync, createRng, money, num, evaluate, evaluateGrid, expectedValue, rollGrid, lineSymbols, allPaylines, rowCount, symbolRules, findSymbol, scatterDistribution, freeSpinAward, freeSpinStats, jackpotStats, spinExpectation, createGame, roundMoney, costAtLevel, SAVE_VERSION, SUITS, data, near, deepEqual, newGame, clunky, stacker, bonanza, palace, nodes, nodeIds, upgrade, row0, land, soldOn, maxLuckLevels, maxLuck, gameOnStacker, gameOn, reachableLines, wildWeights, withWild, unlockLevels, withUnlocks, probe, probeMachine, setups, gameWithWholeTree,
} from './helpers.js';

// ─────────────────────────────────────────────────────────────
describe('free spins (Burrow Bonanza)', () => {
  const g = gameOn('bonanza', 101);
  check('Burrow Bonanza: 5 reels x 3 rows, 5 of 10 paylines', g.getReelCount() === 5 && g.getRowCount() === 3 && g.getLineCount() === 5 && g.getMachineInfo('bonanza').maxLines === 10);
  const started = [];
  const resolved = [];
  const ended = [];
  g.on('spinStarted', (e) => started.push(e));
  g.on('spinResolved', (e) => resolved.push(e));
  g.on('freeSpinsEnded', (e) => ended.push(e));
  check('addFreeSpins (debug) gives free spins', g.addFreeSpins(5) === true && g.getFreeSpins().left === 5);
  check('a paid spin waits while free spins are waiting', g.spin() === false);
  const coins = num(g.state.coins);
  g.update(300);
  const n = started.length;
  check(`free spins play by themselves (no Wheel Training), cost nothing (${n} played)`, n >= 5 && started.every((e) => e.free && num(e.cost) === 0 && e.source === 'free'));
  const mult = bonanza.freeSpins.multiplier;
  const payOk = resolved.every((e) => {
    const r = evaluateGrid(e.result, g.getPaylines(), bonanza.payouts, symbolRules(bonanza));
    return num(e.payout) === roundMoney(r.wins.reduce((sum, w) => sum + roundMoney(w.basePayout * num(g.getPayoutMultiplier()) * mult), 0));
  });
  check(`every free-spin win is x${mult}`, payOk && resolved.every((e) => e.free));
  const won = roundMoney(resolved.reduce((sum, e) => sum + num(e.payout), 0));
  check('when they are done: freeSpinsEnded with the spins and the total won', ended.length === 1 && ended[0].spins === n && near(num(ended[0].won), won, 0.011) && g.getFreeSpins() === null);
  check('coins only went up during free spins', near(num(g.state.coins), coins + won, 0.011));
  check('stats.freeSpins counts them (not as manual or auto spins)', g.state.stats.freeSpins === n && g.state.stats.manualSpins === 0 && g.state.stats.autoSpins === 0);
  check('free-spin wins never offer a gamble', g.getGambleInfo() === null);

  // The bet is frozen when free spins start.
  g.buyUpgrade('highRoller');
  g.setBet(1);
  g.addFreeSpins(2);
  g.setBet(0);
  const bets = [];
  g.on('spinStarted', (e) => bets.push(e.bet));
  g.update(30);
  check('free spins use the bet they were won at', bets.length >= 2 && bets.every((b) => b === 2));

  const a = gameOn('bonanza', 102);
  a.buyUpgrade('wheel', 10);
  a.addFreeSpins(10);
  a.update(a.getAutoInterval() + 5);
  check('auto-spin waits while free spins play', a.state.stats.autoSpins === 0 && a.state.stats.freeSpins > 0);

  const w = gameOn('bonanza', 103);
  w.addFreeSpins(3);
  w.switchMachine('clunky');
  w.update(10);
  check('free spins wait on their machine after a switch', w.getMachineInfo('bonanza').freeSpinsLeft === 3 && w.state.stats.freeSpins === 0);
  w.switchMachine('bonanza');
  w.update(120);
  check('… and play when you come back', w.getMachineInfo('bonanza').freeSpinsLeft === 0 && w.state.stats.freeSpins >= 3);

  const d = gameOn('bonanza', 104);
  d.startDelivery();
  d.addFreeSpins(2);
  d.update(5);
  check('no free spins while the hamster is out delivering', d.state.stats.freeSpins === 0);

  const ss = gameWithWholeTree(105);
  ss.addCoins(1e9);
  ss.buyMachine('bonanza');
  ss.addCoins(ss.state.coins.neg());
  ss.addFreeSpins(3);
  ss.update(0.2);
  check('Self-Starter waits while free spins are left', ss.state.delivery.active === false);

  // A long run: natural triggers, retriggers, and the time free spins take.
  // Max Luck makes Hamster Balls land more often, so there are enough to count.
  const r = gameOn('bonanza', 106, 1e12);
  maxLuck(r);
  r.buyUpgrade('wheel', 10);
  let triggers = 0;
  let retriggers = 0;
  let paid = 0;
  r.on('freeSpinsStarted', (e) => (e.retrigger ? retriggers++ : triggers++));
  r.on('spinStarted', (e) => { if (!e.free) paid++; });
  const T = 20000;
  r.update(T);
  const econ = r.getEconomy();
  const q = econ.freeSpins.chance;
  check(`free spins start on ${(triggers / paid * 100).toFixed(2)}% of paid spins ~ formula ${(q * 100).toFixed(2)}%`,
    near(triggers / paid, q, 4 * Math.sqrt((q * (1 - q)) / paid)));
  check(`retriggers happen (${retriggers})`, retriggers > 0);
  check(`${(r.state.stats.freeSpins / triggers).toFixed(1)} free spins per trigger (with retriggers) ~ formula ${econ.freeSpins.perTriggerWithRetriggers.toFixed(1)}`,
    near(r.state.stats.freeSpins / triggers, econ.freeSpins.perTriggerWithRetriggers, econ.freeSpins.perTriggerWithRetriggers * 0.15));
  const rate = 1 / (econ.autoInterval + econ.extraSecondsPerSpin);
  check(`paid spins a second ${(paid / T).toFixed(4)} ~ 1 / (interval + time in free spins) ${rate.toFixed(4)}`, near(paid / T, rate, rate * 0.03));
  check('"Free Ride" is awarded', r.state.diary.freeRide === true);
});

// ─────────────────────────────────────────────────────────────
describe('the jackpot wheel and pots (Pouch Palace)', () => {
  const jp = palace.jackpot;
  const g = gameOn('palace', 111);
  check('Pouch Palace: 5 reels, 10 of 20 lines, every pot at its seed', g.getReelCount() === 5 && g.getLineCount() === 10
    && g.getJackpotPots().every((p, i) => num(p.base) === jp.pots[i].seed));
  g.spin();
  check('every paid spin grows every pot by its growth', g.getJackpotPots().every((p, i) => num(p.base) === roundMoney(jp.pots[i].seed + jp.pots[i].growth)));
  land(g);
  g.buyUpgrade('pouchPolish');
  const growth = 1 + data.upgrades.find((u) => u.id === 'pouchPolish').effect.perLevel;
  const before = g.getJackpotPots().map((p) => num(p.base));
  g.spin();
  check('Pouch Polish makes the pots grow faster', g.getJackpotPots().every((p, i) => near(num(p.base), before[i] + jp.pots[i].growth * growth, 0.011)));
  land(g);
  check('the marquee value = pot x bet x payout multiplier', g.getJackpotPots().every((p) => num(p.value) === roundMoney(num(p.base) * g.getBet() * num(g.getPayoutMultiplier()))));

  const won = [];
  const blocked = [];
  g.on('jackpotWon', (e) => won.push(e));
  g.on('spinBlocked', (e) => blocked.push(e.reason));
  const major = num(g.getJackpotPots().find((p) => p.id === 'major').base);
  check('triggerJackpot (debug) starts the wheel', g.triggerJackpot('major') === true && g.getBonusProgress() === 0);
  check('no spins while the wheel turns', g.spin() === false && blocked.includes('bonus'));
  g.update(1);
  check('the wheel\'s progress follows game time', near(g.getBonusProgress(), 1 / jp.duration, 0.02));
  const coins = num(g.state.coins);
  const earned = num(g.state.stats.coinsEarned);
  g.update(jp.duration);
  check('when it stops it pays pot x bet x payout multiplier', won.length === 1 && won[0].pot === 'major'
    && num(won[0].amount) === roundMoney(major * g.getBet() * num(g.getPayoutMultiplier())) && near(num(g.state.coins), coins + num(won[0].amount), 0.011));
  check('… the pot goes back to its seed, and the win counts as earned', num(g.getJackpotPots().find((p) => p.id === 'major').base) === jp.pots.find((p) => p.id === 'major').seed
    && near(num(g.state.stats.coinsEarned), earned + num(won[0].amount), 0.011));
  check('stats.jackpotsWon and "Pot Luck"', g.state.stats.jackpotsWon === 1 && g.state.diary.potLuck === true);
  g.triggerJackpot(jp.pots[jp.pots.length - 1].id);
  g.update(jp.duration + 0.1);
  check('the top pot counts as a Grand ("Grand Hamster")', g.state.stats.grandJackpots === 1 && g.state.diary.grandHamster === true);

  const r = gameOn('palace', 112);
  r.addCoins(data.retirement.seedDivisor * 4, true);
  r.triggerJackpot('mini');
  check('no retiring while the wheel turns (its pot would be lost)', r.canRetire() === false && r.retire() === false);
  r.update(jp.duration + 0.1);
  check('… but you can once it has paid', r.canRetire() === true);

  const s = gameOn('palace', 113);
  s.triggerJackpot('minor');
  s.switchMachine('clunky');
  const w2 = [];
  s.on('jackpotWon', (e) => w2.push(e));
  s.update(jp.duration + 0.1);
  check('the wheel still pays after a switch', w2.length === 1 && w2[0].machineId === 'palace');

  // A long run: trigger rate, which pot, and the long-run pot EV.
  // Max Luck makes Cheek Pouches land more often, so there are enough wheels to count.
  const n = gameOn('palace', 114, 1e14);
  maxLuck(n);
  n.buyUpgrade('wheel', 10);
  let paid = 0;
  const counts = {};
  const sums = {};
  const sumSqs = {};
  const scale = n.getBet() * num(n.getPayoutMultiplier());
  n.on('spinStarted', (e) => { if (!e.free) paid++; });
  n.on('jackpotWon', (e) => {
    const x = num(e.amount) / scale; // back to base units
    counts[e.pot] = (counts[e.pot] || 0) + 1;
    sums[e.pot] = (sums[e.pot] || 0) + x;
    sumSqs[e.pot] = (sumSqs[e.pot] || 0) + x * x;
  });
  n.update(40000);
  const stats = jackpotStats({ ...palace, symbols: n.getSymbols() }, 5); // the weights the reels really used (Luck, locks)
  const wheels = Object.values(counts).reduce((a, b) => a + b, 0);
  check(`the wheel starts on ${(wheels / paid * 100).toFixed(2)}% of paid spins ~ formula ${(stats.q * 100).toFixed(2)}%`,
    near(wheels / paid, stats.q, 4 * Math.sqrt((stats.q * (1 - stats.q)) / paid)));
  const totalWeight = jp.pots.reduce((a, p) => a + p.weight, 0);
  for (const p of jp.pots.slice(0, 2)) {
    const share = (counts[p.id] || 0) / wheels;
    const expected = p.weight / totalWeight;
    check(`${p.name}: ${(share * 100).toFixed(1)}% of wheels ~ ${(expected * 100).toFixed(1)}%`, near(share, expected, 4 * Math.sqrt((expected * (1 - expected)) / wheels)));
    // The heart of the pot formula: a pot won with chance c a spin has been
    // growing for 1/c spins on average, so it holds seed + growth / c when won.
    const c = stats.pots.find((x) => x.id === p.id).chance;
    const mean = sums[p.id] / counts[p.id];
    const stderr = Math.sqrt(Math.max(0, sumSqs[p.id] / counts[p.id] - mean * mean) / counts[p.id]);
    check(`${p.name} holds ${mean.toFixed(0)} on average when won ~ seed + growth / chance = ${(p.seed + p.growth / c).toFixed(0)}`,
      near(mean, p.seed + p.growth / c, 4 * stderr));
  }
});

// ─────────────────────────────────────────────────────────────
describe('the card gamble', () => {
  // Spin by hand until a spin wins (and so offers the gamble).
  const manualWin = (game) => {
    for (let i = 0; i < 200; i++) {
      game.spin('manual');
      land(game);
      if (game.getGambleInfo()) return true;
    }
    return false;
  };
  const g = newGame(121);
  g.addCoins(1e6);
  const offers = [];
  const ends = [];
  let lastPayout = 0;
  g.on('gambleOffered', (e) => offers.push(e));
  g.on('gambleEnded', (e) => ends.push(e));
  g.on('spinResolved', (e) => { if (num(e.payout) > 0) lastPayout = num(e.payout); });
  check('a win you pulled yourself offers the gamble for that win', manualWin(g) && offers.length === 1 && num(g.getGambleInfo().stake) === lastPayout);
  g.update(data.gamble.offerSeconds + 0.1);
  check(`an untouched offer runs out after ${data.gamble.offerSeconds} s`, g.getGambleInfo() === null && ends.at(-1).reason === 'expired');
  manualWin(g);
  g.spin();
  check('spinning again closes the offer', g.getGambleInfo() === null && ends.at(-1).reason === 'spin');

  // A click queued during a winning manual spin doesn't close that spin's gamble offer.
  let found = false;
  for (let seed = 200; seed < 300 && !found; seed++) {
    const x = newGame(seed);
    x.addCoins(1e6);
    x.spin();
    x.spin(); // queued
    x.update(clunky.spinDuration + 0.05);
    if (!x.getGambleInfo()) continue;
    found = true;
    check('a click queued during a winning spin leaves its gamble offer open (the next tap decides)', x.state.stats.spins === 1);
    x.spin();
    check('… and the next tap spins on, closing the offer', x.state.stats.spins === 2 && x.getGambleInfo() === null);
  }
  check('(a seed whose first spin wins was found)', found);

  const a = newGame(122);
  a.addCoins(1e6);
  a.buyUpgrade('wheel', 10);
  let autoOffers = 0;
  a.on('gambleOffered', () => autoOffers++);
  a.update(300);
  check('auto-spin wins never offer a gamble', autoOffers === 0 && a.state.stats.wins > 0);

  const h = newGame(125);
  h.addCoins(1e6);
  h.buyUpgrade('wheel');
  manualWin(h);
  const auto0 = h.state.stats.autoSpins;
  h.update(data.gamble.offerSeconds - 0.5);
  check('auto-spin waits while a gamble offer is open', h.state.stats.autoSpins === auto0);

  const p = newGame(123);
  p.addCoins(1e6);
  manualWin(p);
  const stake = num(p.getGambleInfo().stake);
  const coins = num(p.state.coins);
  const earned = num(p.state.stats.coinsEarned);
  const res = [];
  p.on('gambleResolved', (e) => res.push(e));
  check('a pick must be a colour or a suit', p.gamble('middle') === false && p.gamble('left') === false && p.gamble('') === false);
  p.gamble('red');
  check('a colour pick wins +stake (×2) or loses the stake', res.length === 1 && res[0].multiplier === 2
    && (res[0].win ? num(p.state.coins) === roundMoney(coins + stake) : num(p.state.coins) === roundMoney(coins - stake)));
  check('the card is a real card of the deck, and red wins exactly on hearts and diamonds',
    SUITS.some((s) => s.id === res[0].card.suit && s.color === res[0].card.color) && res[0].win === (res[0].card.color === 'red'));
  check('gambling never changes coinsEarned (it can\'t farm Heirloom Seeds)', num(p.state.stats.coinsEarned) === earned);
  if (p.getGambleInfo()) {
    const blocked = [];
    p.on('spinBlocked', (e) => blocked.push(e.reason));
    check('while a gamble is under way, spins wait ("gamble")', p.spin() === false && blocked[0] === 'gamble');
    check('you can always take the win', p.collectGamble() === true && p.getGambleInfo() === null);
  }

  // Fairness: 20,000 colour picks and 20,000 suit picks (debug offers, so it's quick).
  // Every card is a fresh draw, so both bets are exactly fair: on average they never pay.
  const f = newGame(124);
  f.addCoins(1e9);
  const coinsEarned0 = num(f.state.stats.coinsEarned);
  const tally = { color: { picks: 0, wins: 0, net: 0 }, suit: { picks: 0, wins: 0, net: 0 } };
  const suitsSeen = {};
  let prizesOk = true;
  let maxEnds = 0;
  let lastCard = null;
  f.on('gambleResolved', (e) => {
    const t = tally[['red', 'black'].includes(e.pick) ? 'color' : 'suit'];
    t.picks++;
    const stake = num(e.stake);
    t.net += (e.win ? stake * (e.multiplier - 1) : -stake) / stake; // in stakes
    if (e.win) { t.wins++; if (num(e.next) !== roundMoney(stake * e.multiplier)) prizesOk = false; }
    suitsSeen[e.card.suit] = (suitsSeen[e.card.suit] || 0) + 1;
    lastCard = e.card;
  });
  f.on('gambleEnded', (e) => { if (e.reason === 'max') maxEnds++; });
  const picksOf = { color: ['red', 'black'], suit: SUITS.map((s) => s.id) };
  for (const mode of ['color', 'suit']) {
    let i = 0;
    while (tally[mode].picks < 20000) {
      f.triggerGamble(10);
      while (f.getGambleInfo()) f.gamble(picksOf[mode][i++ % picksOf[mode].length]);
    }
  }
  for (const [mode, chance, mult] of [['color', 0.5, 2], ['suit', 0.25, 4]]) {
    const t = tally[mode];
    const sd = Math.sqrt(chance * (mult - 1) ** 2 + (1 - chance)); // the spread of one pick, in stakes
    check(`rule 4: ${(t.wins / t.picks * 100).toFixed(2)}% of ${t.picks} ${mode} picks win ~ ${chance * 100}% (fair)`,
      near(t.wins / t.picks, chance, 4 * Math.sqrt(chance * (1 - chance) / t.picks)));
    check(`rule 4: ${mode} picks pay back ${(t.net / t.picks * 100).toFixed(2)}% of the stakes on average ~ 0 (a fair bet)`,
      near(t.net / t.picks, 0, 4 * sd / Math.sqrt(t.picks)));
  }
  const draws = Object.values(suitsSeen).reduce((a, b) => a + b, 0);
  check(`every suit is drawn ~25% of the time (${SUITS.map((s) => `${s.id} ${((suitsSeen[s.id] || 0) / draws * 100).toFixed(1)}%`).join(', ')})`,
    SUITS.every((s) => near((suitsSeen[s.id] || 0) / draws, 0.25, 4 * Math.sqrt(0.1875 / draws))));
  check('a right colour doubles the stake, a right suit makes it ×4', prizesOk);
  check(`after ${data.gamble.maxRounds} wins in a row the gamble takes the win by itself`, maxEnds > 0);
  check('rule 4: gamble coins never count as earned', num(f.state.stats.coinsEarned) === coinsEarned0);
  check('stats count gamble picks; "Double Trouble" after 3 wins in a row; "Card Shark" after a suit win',
    f.state.stats.gambleWins === tally.color.wins + tally.suit.wins && f.state.stats.gambleLosses === tally.color.picks + tally.suit.picks - tally.color.wins - tally.suit.wins
    && f.state.stats.suitWins === tally.suit.wins && f.state.diary.doubleTrouble === true && f.state.diary.cardShark === true);
  const history = f.getCardHistory();
  check(`the last ${data.gamble.history} cards are kept, newest first`, history.length === data.gamble.history && deepEqual(history[0], { suit: lastCard.suit, color: lastCard.color }));
  f.triggerGamble(10);
  const info = f.getGambleInfo();
  check('getGambleInfo shows both prizes and the card history', num(info.colorWin) === 20 && num(info.suitWin) === 40 && info.history.length === data.gamble.history);
  check('the Info tab gets the real odds', deepEqual(f.getFeatureOdds().gamble.color, { chance: 0.5, multiplier: 2 }) && deepEqual(f.getFeatureOdds().gamble.suit, { chance: 0.25, multiplier: 4 }));

  // Edge cases.
  const e = newGame(126);
  e.addCoins(1e6);
  manualWin(e);
  e.addCoins(-num(e.state.coins) + num(e.getGambleInfo().stake) / 2);
  check('you need the stake in your pile to gamble it', e.canGamble() === false && e.gamble('red') === false);
  const sv = newGame(127);
  sv.addCoins(1e6);
  manualWin(sv);
  check('an open gamble is not saved', !('gamble' in sv.toSaveData()));
  const re = newGame(128);
  re.addCoins(data.retirement.seedDivisor * 4, true);
  manualWin(re);
  re.gamble('black');
  if (re.getGambleInfo()) check('no retiring during a gamble', re.canRetire() === false && re.retire() === false);
  const sw = gameOn('stacker', 129);
  sw.switchMachine('clunky');
  manualWin(sw);
  sw.switchMachine('stacker');
  check('switching machine ends the gamble (keeping what it won)', sw.getGambleInfo() === null);
});

// ─────────────────────────────────────────────────────────────
describe('Hot Streak', () => {
  const g = newGame(131);
  g.addCoins(1e9);
  g.buyUpgrade('thirdReel');
  maxLuck(g); // wins in a row need a decent hit rate
  let prevStreak = 0;
  let ok = true;
  g.on('spinResolved', (e) => {
    if (e.streak !== (e.wins.length > 0 ? prevStreak + 1 : 0)) ok = false;
    prevStreak = e.streak;
  });
  for (let i = 0; i < 3000; i++) { g.spin(); land(g); }
  check('every machine counts winning paid spins in a row, and a loss resets it', ok && g.state.stats.bestStreak >= 3);
  check('"On Fire" for 5 wins in a row', g.state.stats.bestStreak >= 5 && g.state.diary.onFire === true);

  const h = newGame(132);
  h.addCoins(1e9);
  h.buyUpgrade('thirdReel');
  h.buyUpgrade('hotStreak', Infinity);
  const hs = data.upgrades.find((u) => u.id === 'hotStreak');
  const per = hs.effect.perStack * hs.maxLevel;
  check('Hot Streak maxed: the best bonus is x(1 + perStack x level x maxStacks)', near(h.getMaxStreakMultiplier(), 1 + per * hs.effect.maxStacks, 1e-12));
  let before = 0;
  let payOk = true;
  let sumMult = 0;
  let winsN = 0;
  h.on('spinResolved', (e) => {
    const mult = 1 + per * Math.min(before, hs.effect.maxStacks);
    const expected = roundMoney(e.wins.reduce((sum, w) => sum + roundMoney(w.basePayout * num(h.getPayoutMultiplier()) * mult), 0));
    if (num(e.payout) !== expected) payOk = false;
    if (e.wins.length) { sumMult += mult; winsN++; }
    before = e.streak;
  });
  for (let i = 0; i < 20000; i++) { h.spin(); land(h); }
  const econ = h.getEconomy();
  check('a winning spin pays x the streak bonus from the streak BEFORE it', payOk);
  check(`average bonus on wins x${(sumMult / winsN).toFixed(4)} ~ formula x${econ.streakFactor.toFixed(4)}`, near(sumMult / winsN, econ.streakFactor, 0.02));
  check('the economy counts Hot Streak in the EV', near(econ.ev, econ.lineEv * econ.streakFactor, 1e-9));

  const f = gameOn('bonanza', 133);
  f.buyUpgrade('hotStreak');
  f.addFreeSpins(6);
  const streak0 = f.state.machines[f.state.activeMachine].streak;
  f.update(120);
  check('free spins never touch the streak', f.state.machines[f.state.activeMachine].streak === streak0 && f.state.stats.freeSpins >= 6);
});
