// game.js — LOGIC layer. The whole game: state, spinning, payouts, upgrades,
// machines, symbols you unlock, Luck, deliveries, auto-spin, the card gamble,
// retirement + the family tree, Hamster Tokens + the Capsule Machine (skins),
// and the save format.
//
// Golden rule: this file never touches the page (no document/window/localStorage)
// and never reads the clock. Time only moves when someone calls update(dt).
// That's what lets the same code run in the browser, in a Node test, or in a
// balance simulator, and what makes it easy to port to a Godot autoload.
//
// How the outside world uses it:
//   game.spin(), game.startDelivery(), game.buyUpgrade(id, count)  ← actions (return true/false)
//   game.buyMachine(id), game.switchMachine(id)                     ← machine actions
//   game.retire(), game.buyTreeNode(id)                             ← family actions
//   game.pullCapsule(), game.equipSkin(id)                          ← capsule/skin actions
//   game.setBet(index), game.gamble("red"), game.collectGamble()    ← bets + the card gamble
//   game.applyOfflineEarnings(seconds)                              ← coins for time away
//   game.update(dt)                                                 ← advance time
//   game.on("spinResolved", fn)                                     ← listen for events
//   game.state                                                      ← read-only snapshot for drawing

import { createEmitter } from './events.js';
import { rollGrid, evaluateGrid, rowCount, allPaylines, symbolRules, findSymbol, freeSpinAward, spinExpectation } from './machine.js';

// v2 added retirement: generation, Heirloom Seeds, the family tree, per-run
// totals, stats.coinsEarned and delivery.duration.
// v3 added Hamster Tokens, the diary, skins and the capsule pity counter.
// v4 added the stats biggestWin and offlineCoins.
// v5 made spin results a grid (reels × rows) and added the stats machinesBought
// and mostLinesWon.
// v6 added bets, free spins, jackpot pots, Hot Streak and the gamble stats.
// v7 added symbols you unlock (old saves get the ones they already had) and the
// stats symbolsUnlocked, bestLuck and suitWins.
// See migrateSave() below.
export const SAVE_VERSION = 7;

// The gamble's deck: 4 suits, 2 of each colour. Every card is a fresh draw (an
// endless deck), so the cards you saw before tell you nothing about the next one.
// The prizes are the fair odds of the deck, so they're not balance numbers:
// a colour is 2 of 4 suits (pays ×2), a suit is 1 of 4 (pays ×4).
export const SUITS = [
  { id: 'hearts', color: 'red' },
  { id: 'diamonds', color: 'red' },
  { id: 'clubs', color: 'black' },
  { id: 'spades', color: 'black' },
];
export const CARD_COLORS = ['red', 'black'];

// The logic runs in fixed 1/60 s steps ("ticks"), whatever the frame rate.
// update(1.0) and 60 × update(1/60) therefore give identical results.
export const TICK = 1 / 60;

// A tiny tolerance for comparing floating-point timers (0.1 + 0.2 ≠ 0.3 in floats).
const EPS = 1e-9;

// Coins are always rounded to cents. Otherwise float drift (4.4999999…) could
// make you unable to afford a 4.5-coin spin while the screen shows "4.5".
export function roundMoney(x) {
  return Math.round(x * 100) / 100;
}

// The one cost formula for EVERY purchase (coin upgrades and family tree nodes):
// floor(baseCost × growthRate ^ owned).
export function costAtLevel(def, owned) {
  return Math.floor(def.baseCost * Math.pow(def.growthRate, owned));
}

function maxedAtLevel(def, owned) {
  return def.maxLevel !== null && def.maxLevel !== undefined && owned >= def.maxLevel;
}

export function createGame(initialData, rng) {
  let data = initialData;
  const events = createEmitter();
  let state = newState(data);
  let accumulator = 0; // leftover time smaller than one tick
  // A click on Spin while the machine is still spinning isn't lost: it queues ONE
  // manual spin that starts the moment this spin lands (see tick()). Not saved:
  // it's an input buffer, not progress.
  let queuedManual = false;
  // The last few gamble cards, newest first (shown along the top of the gamble
  // panel, like a real pokie). Just for show: never saved.
  let cardHistory = [];

  // ───────────────────────── Lookups ─────────────────────────

  function getUpgradeDef(id) {
    return data.upgrades.find((u) => u.id === id) || null;
  }

  function treeNodes() {
    return (data.familyTree && data.familyTree.nodes) || [];
  }

  function getTreeNodeDef(id) {
    return treeNodes().find((n) => n.id === id) || null;
  }

  function activeMachine() {
    return state.machines[state.activeMachine];
  }

  // The data.json entry for a machine in the state (default: the active one).
  function getMachineData(machine = activeMachine()) {
    return data.machines.find((m) => m.id === machine.typeId);
  }

  // Global upgrades belong to the hamster (state.upgrades). Machine upgrades
  // belong to one machine (state.machines[i].upgrades), and an upgrade can list
  // the machines it's sold for ("machines": ["clunky"]). No list = every machine.
  function isUpgradeAvailable(def, machine = activeMachine()) {
    if (!def) return false;
    return def.scope !== 'machine' || !def.machines || def.machines.includes(machine.typeId);
  }

  function levelStore(def, machine = activeMachine()) {
    return def.scope === 'machine' ? machine.upgrades : state.upgrades;
  }

  // An upgrade the active machine doesn't sell counts as level 0.
  function getUpgradeLevel(id, machine = activeMachine()) {
    const def = getUpgradeDef(id);
    return isUpgradeAvailable(def, machine) ? levelStore(def, machine)[id] || 0 : 0;
  }

  // The highest level on any machine (for diary goals like "get the Third Reel").
  function getBestUpgradeLevel(id) {
    const def = getUpgradeDef(id);
    if (!def) return 0;
    if (def.scope !== 'machine') return state.upgrades[id] || 0;
    return Math.max(0, ...state.machines.map((m) => getUpgradeLevel(id, m)));
  }

  // The upgrades to show in the shop: the hamster's, plus the active machine's.
  function getAvailableUpgrades() {
    return data.upgrades.filter((def) => isUpgradeAvailable(def));
  }

  function getTreeLevel(id) {
    return state.tree[id] || 0;
  }

  function getUpgradeCost(id) {
    return costAtLevel(getUpgradeDef(id), getUpgradeLevel(id));
  }

  function isMaxed(id) {
    return maxedAtLevel(getUpgradeDef(id), getUpgradeLevel(id));
  }

  function canAfford(cost) {
    return state.coins >= cost;
  }

  function canBuyUpgrade(id) {
    const def = getUpgradeDef(id);
    return isUpgradeAvailable(def) && !isMaxed(id) && canAfford(getUpgradeCost(id));
  }

  // ───────────────────── Effects ─────────────────────
  // Each effect "type" in data.json is handled by one small function below.
  // Effects come from two places: coin UPGRADES (reset when you retire) and
  // FAMILY TREE nodes (bought with Heirloom Seeds, kept forever). Both lists use
  // the same effect format, so a tree node can reuse an upgrade's effect type.
  //
  // "overrides" lets us ask "what if this upgrade/node were level N?" for the
  // shop previews: { cheeks: 3 } means "pretend Chubby Cheeks is level 3".
  // "machine" says whose machine upgrades count (default: the active machine).

  // Every effect of one type, with the level it's owned at:
  //   [{ effect, level, fromTree, scope }]   (scope: "global", "machine" or "tree")
  function effectsOfType(type, overrides, machine = activeMachine()) {
    const out = [];
    const levelFor = (id, current) => (overrides && id in overrides ? overrides[id] : current);
    for (const def of data.upgrades) {
      if (def.effect.type !== type || !isUpgradeAvailable(def, machine)) continue;
      out.push({ effect: def.effect, level: levelFor(def.id, levelStore(def, machine)[def.id] || 0), fromTree: false, scope: def.scope });
    }
    for (const def of treeNodes()) {
      if (def.effect.type === type) out.push({ effect: def.effect, level: levelFor(def.id, state.tree[def.id] || 0), fromTree: true, scope: 'tree' });
    }
    return out;
  }

  // Product of multiplier ^ level over one effect type (1 if nothing is owned).
  function productOf(type, overrides, machine) {
    let m = 1;
    for (const { effect, level } of effectsOfType(type, overrides, machine)) m *= Math.pow(effect.multiplier, level);
    return m;
  }

  // Payout bonuses ADD UP within a group and MULTIPLY between the two groups:
  //   (1 + coin upgrade bonuses) × (1 + family bonuses)
  // Family bonuses = family tree nodes + the heirloom bonus (see below).
  // e.g. Chubby Cheeks Lv 2 (+50%) with Family Pride (+25%) → 1.5 × 1.25 = ×1.875.
  // Multiplying is what makes the family feel strong in every new life.
  function getPayoutMultiplier(overrides) {
    let upgrades = 1;
    let family = 1 + getHeirloomBonus();
    for (const { effect, level, fromTree } of effectsOfType('payoutMultiplier', overrides)) {
      if (fromTree) family += effect.perLevel * level;
      else upgrades += effect.perLevel * level;
    }
    return upgrades * family;
  }

  // Heirloom bonus: every seed the family has EVER earned adds a little to payouts,
  // even after it's planted in the tree. Planting never makes you weaker, and
  // each generation starts stronger than the last.
  function getHeirloomBonus() {
    const perSeed = (data.retirement && data.retirement.payoutBonusPerSeedEarned) || 0;
    return perSeed * state.seedsEarned;
  }

  // Oiled Lever / Smooth Gears: base spin cost × perLevel ^ level
  function getSpinCost(overrides, machine = activeMachine()) {
    let cost = getMachineData(machine).spinCost;
    for (const { effect, level } of effectsOfType('spinCostMultiplier', overrides, machine)) cost *= Math.pow(effect.perLevel, level);
    return roundMoney(cost);
  }

  // Quick Paws: a multiplier on spin time AND the auto-spin interval (both get faster together).
  function getSpinDuration(overrides, machine = activeMachine()) {
    return getMachineData(machine).spinDuration * productOf('spinSpeed', overrides, machine);
  }

  // Wheel Training: null = no auto-spin; otherwise seconds between auto-spin starts:
  //   baseInterval × intervalMultiplier^(level − 1) (× Quick Paws),
  // but never quicker than the spin itself plus a short rest ("rest" in data.json),
  // so there's always a beat to see each win before the next spin starts.
  // The spin time depends on the machine, so the floor does too.
  function getAutoInterval(overrides, machine = activeMachine()) {
    let interval = null;
    let rest = 0;
    for (const { effect: e, level } of effectsOfType('autoSpin', overrides, machine)) {
      if (level <= 0) continue;
      const iv = e.baseInterval * Math.pow(e.intervalMultiplier, level - 1);
      interval = interval === null ? iv : Math.min(interval, iv);
      rest = Math.max(rest, e.rest || 0);
    }
    if (interval === null) return null;
    return Math.max(interval * productOf('spinSpeed', overrides, machine), getSpinDuration(overrides, machine) + rest);
  }

  // Third Reel / Fourth Reel: startReels + reelsPerLevel × level, capped at maxReels
  function getReelCount(overrides, machine = activeMachine()) {
    const md = getMachineData(machine);
    let reels = md.startReels;
    for (const { effect, level } of effectsOfType('extraReel', overrides, machine)) reels += effect.reelsPerLevel * level;
    return Math.min(reels, md.maxReels);
  }

  // Extra Paylines: startLines + linesPerLevel × level, capped at the machine's
  // list of paylines. A machine without startLines uses all of its lines.
  function getLineCount(overrides, machine = activeMachine()) {
    const md = getMachineData(machine);
    const all = allPaylines(md).length;
    let lines = md.startLines || all;
    for (const { effect, level } of effectsOfType('extraPayline', overrides, machine)) lines += effect.linesPerLevel * level;
    return Math.min(lines, all);
  }

  // The paylines that pay right now, each as the row it crosses on every reel.
  function getPaylines(overrides, machine = activeMachine()) {
    return allPaylines(getMachineData(machine)).slice(0, getLineCount(overrides, machine));
  }

  function getRowCount(machine = activeMachine()) {
    return rowCount(getMachineData(machine));
  }

  // ── Symbols: what the reels really land on ──
  // Returns the machine's symbols with the weights the reels really use, in four steps:
  //   1) Locked symbols ("locked": true in data.json, the user's "new seeds") have
  //      weight 0 until their unlock upgrade is bought in the shop.
  //   2) Lucky Whiskers / Carrot Patch move some weight from one symbol to another
  //      (never from or onto a locked symbol, so a trait can't unlock one by accident).
  //   3) Hamster Wild ADDS weight to the wild (it starts at 0 on the Snack Stacker).
  //   4) Luck: every symbol except the blank has its weight × (1 + Luck ÷ 100), so
  //      with more Luck the reels land on the Wood Shaving less often. That raises
  //      the hit rate AND the average win (a test checks both).
  function getSymbols(overrides, machine = activeMachine()) {
    const md = getMachineData(machine);
    const weight = {};
    for (const s of md.symbols) weight[s.id] = isSymbolLocked(s.id, overrides, machine) ? 0 : s.weight;
    for (const { effect: e, level } of effectsOfType('shiftWeight', overrides, machine)) {
      if (!(weight[e.from] > 0) || !(weight[e.to] > 0)) continue; // not on this machine, or still locked
      const moved = Math.min(e.amount * level, weight[e.from] - 1); // always leave at least weight 1
      weight[e.from] -= moved;
      weight[e.to] += moved;
    }
    for (const { effect: e, level } of effectsOfType('symbolWeight', overrides, machine)) {
      if (e.symbol in weight) weight[e.symbol] += e.perLevel * level;
    }
    const luck = 1 + getLuck(overrides, machine).total / 100;
    return md.symbols.map((s) => ({ ...s, weight: s.blank ? weight[s.id] : weight[s.id] * luck }));
  }

  // Is this symbol still locked on a machine? Only symbols marked "locked" in
  // data.json can be. An unlock upgrade lists symbols IN ORDER, and level n opens
  // the first n of them: Old Clunky's New Seeds opens the Baby Carrot, then the
  // Golden Seed. (The order matters for the balance: a test checks that every
  // level raises the average win and lowers the hit rate.)
  function isSymbolLocked(symbolId, overrides, machine = activeMachine()) {
    const s = getMachineData(machine).symbols.find((x) => x.id === symbolId);
    if (!s || !s.locked) return false;
    return !effectsOfType('unlockSymbol', overrides, machine).some((x) => x.effect.symbols.slice(0, x.level).includes(symbolId));
  }

  // The upgrade that unlocks a symbol on a machine (for the paytable's "unlock it" hint).
  function getSymbolUnlock(symbolId, machine = activeMachine()) {
    return data.upgrades.find((u) => u.effect.type === 'unlockSymbol' && u.effect.symbols.includes(symbolId) && isUpgradeAvailable(u, machine)) || null;
  }

  // Luck = Hamster Luck + Machine Luck, one number you can see (a clover on the machine).
  //   Hamster Luck: the hamster's own upgrades (and family traits): every machine.
  //   Machine Luck: this machine's upgrades only.
  function getLuck(overrides, machine = activeMachine()) {
    let hamster = 0;
    let own = 0;
    for (const { effect, level, scope } of effectsOfType('luck', overrides, machine)) {
      if (scope === 'machine') own += effect.perLevel * level;
      else hamster += effect.perLevel * level;
    }
    return { hamster, machine: own, total: hamster + own };
  }

  // Chance (0–1) that one reel lands on a symbol, after luck traits.
  function getSymbolChance(symbolId, overrides) {
    const symbols = getSymbols(overrides);
    const total = symbols.reduce((sum, s) => sum + s.weight, 0);
    const s = symbols.find((x) => x.id === symbolId);
    return s ? s.weight / total : 0;
  }

  // Jackpot Dance: wins where every reel matches pay × this.
  function getFullLineMultiplier(overrides) {
    return productOf('fullLineMultiplier', overrides);
  }

  // Warm-up Laps / Heirloom Reel: free upgrade levels at the start of every life.
  function getStartingLevel(upgradeId, overrides) {
    let levels = 0;
    for (const { effect, level } of effectsOfType('startingLevel', overrides)) {
      if (effect.upgrade === upgradeId) levels += effect.levels * level;
    }
    const def = getUpgradeDef(upgradeId);
    return def && def.maxLevel !== null && def.maxLevel !== undefined ? Math.min(levels, def.maxLevel) : levels;
  }

  // Speedy Scooter: delivery time × multiplier
  function getDeliveryDuration(overrides) {
    return data.delivery.duration * productOf('deliveryTime', overrides);
  }

  // Big Backpack: deliveries get your payout multiplier too.
  function getDeliveryReward(overrides) {
    const boosted = effectsOfType('deliveryPayoutBonus', overrides).some((x) => x.level > 0);
    return boosted ? roundMoney(data.delivery.reward * getPayoutMultiplier(overrides)) : data.delivery.reward;
  }

  // Self-Starter: when you're broke, the hamster starts a delivery by itself.
  function hasAutoDelivery(overrides) {
    return effectsOfType('autoDelivery', overrides).some((x) => x.level > 0);
  }

  // ── Bets ("denoms") ──
  // Every spin costs spinCost × bet and every payout is × bet, so the bet never
  // changes the RTP: it only makes each spin bigger (and riskier). The bet sizes
  // are data.json betSteps; High Roller unlocks the next one on every machine.

  function getBetSteps() {
    return data.betSteps && data.betSteps.length ? data.betSteps : [1];
  }

  // The biggest bet step you've unlocked (an index into betSteps).
  function getMaxBetIndex(overrides) {
    let steps = 0;
    for (const { effect, level } of effectsOfType('betSteps', overrides)) steps += effect.stepsPerLevel * level;
    return Math.min(getBetSteps().length - 1, steps);
  }

  // The bet this machine is set to (an index), never above what's unlocked.
  function getBetIndex(machine = activeMachine()) {
    return clamp(machine.bet || 0, 0, getMaxBetIndex());
  }

  function getBet(machine = activeMachine()) {
    return getBetSteps()[getBetIndex(machine)];
  }

  // What a paid spin costs at a bet (default: the chosen one).
  function getBetCost(bet = getBet(), machine = activeMachine()) {
    return roundMoney(getSpinCost(undefined, machine) * bet);
  }

  // The bet the next paid spin will REALLY use: the chosen one if you can afford
  // it, otherwise the biggest unlocked bet you can. null = not even ×1.
  // This "step down" is why a high bet never stalls auto-spin.
  function getSpinBet(machine = activeMachine()) {
    const steps = getBetSteps();
    for (let i = getBetIndex(machine); i >= 0; i--) {
      if (canAfford(getBetCost(steps[i], machine))) return steps[i];
    }
    return null;
  }

  function setBet(index) {
    const machine = activeMachine();
    const i = clamp(Math.floor(index), 0, getMaxBetIndex());
    if (!Number.isFinite(i) || i === getBetIndex(machine)) return false;
    machine.bet = i;
    events.emit('betChanged', { machineId: machine.typeId, index: i, bet: getBetSteps()[i] });
    return true;
  }

  // ── Hot Streak ──
  // Every machine counts its winning paid spins in a row (machine.streak).
  // With Hot Streak, a line win pays × (1 + perStack × level × min(streak, maxStacks)).
  function getStreakPerStack(overrides) {
    let per = 0;
    for (const { effect, level } of effectsOfType('winStreak', overrides)) per += effect.perStack * level;
    return per;
  }

  function getStreakCap(overrides) {
    let cap = 0;
    for (const { effect, level } of effectsOfType('winStreak', overrides)) if (level > 0) cap = Math.max(cap, effect.maxStacks);
    return cap;
  }

  // The multiplier the NEXT winning paid spin on this machine gets.
  function getStreakMultiplier(machine = activeMachine(), overrides) {
    return 1 + getStreakPerStack(overrides) * Math.min(machine.streak || 0, getStreakCap(overrides));
  }

  // The best a streak can get (for the shop card).
  function getMaxStreakMultiplier(overrides) {
    return 1 + getStreakPerStack(overrides) * getStreakCap(overrides);
  }

  // ── Free spins and the jackpot wheel ──
  // Bouncy Ball: extra free spins every time they trigger.
  function getExtraFreeSpins(overrides, machine = activeMachine()) {
    let extra = 0;
    for (const { effect, level } of effectsOfType('extraFreeSpins', overrides, machine)) extra += effect.perLevel * level;
    return extra;
  }

  // Free spins for the smallest trigger (for the shop card), or 0.
  function getFreeSpinAward(overrides, machine = activeMachine()) {
    const fs = getMachineData(machine).freeSpins;
    if (!fs) return 0;
    const min = Math.min(...Object.keys(fs.awards).map(Number));
    return freeSpinAward(fs, min, getExtraFreeSpins(overrides, machine));
  }

  // Pouch Polish: every pot grows faster, × (1 + perLevel × level).
  function getJackpotGrowth(overrides, machine = activeMachine()) {
    let growth = 1;
    for (const { effect, level } of effectsOfType('jackpotGrowth', overrides, machine)) growth += effect.perLevel * level;
    return growth;
  }

  // For the shop cards: which stat an effect type changes.
  const STAT_FOR_EFFECT = {
    payoutMultiplier: (def, o) => getPayoutMultiplier(o),
    spinCostMultiplier: (def, o) => getSpinCost(o),
    autoSpin: (def, o) => getAutoInterval(o),
    extraReel: (def, o) => getReelCount(o),
    extraPayline: (def, o) => getLineCount(o),
    shiftWeight: (def, o) => getSymbolChance(def.effect.to, o),
    fullLineMultiplier: (def, o) => getFullLineMultiplier(o),
    startingLevel: (def, o) => getStartingLevel(def.effect.upgrade, o),
    spinSpeed: (def, o) => getSpinDuration(o),
    deliveryTime: (def, o) => getDeliveryDuration(o),
    deliveryPayoutBonus: (def, o) => getDeliveryReward(o),
    autoDelivery: (def, o) => hasAutoDelivery(o),
    betSteps: (def, o) => getBetSteps()[getMaxBetIndex(o)],
    winStreak: (def, o) => getMaxStreakMultiplier(o),
    symbolWeight: (def, o) => getSymbolChance(def.effect.symbol, o),
    extraFreeSpins: (def, o) => getFreeSpinAward(o),
    jackpotGrowth: (def, o) => getJackpotGrowth(o),
    // Milestone 7: these show what they do in plain numbers ("hit rate 24% → 27%").
    luck: (def, o) => ({ luck: getLuck(o).total, hitRate: spinValue(activeMachine(), o).hitRate }),
    // "win" = the average win per paid spin at ×1, with every payout bonus.
    unlockSymbol: (def, o) => {
      const v = spinValue(activeMachine(), o);
      return { open: def.effect.symbols.filter((id) => !isSymbolLocked(id, o)).length, hitRate: v.hitRate, win: v.ev * getPayoutMultiplier(o) };
    },
  };

  // The affected stat now, and after `levels` more levels (next = null when maxed).
  // The shop passes levels > 1 when it's buying ×10 or Max.
  function preview(def, level, levels = 1) {
    const statFn = STAT_FOR_EFFECT[def.effect.type];
    const cap = def.maxLevel === null || def.maxLevel === undefined ? Infinity : def.maxLevel;
    return {
      type: def.effect.type,
      now: statFn(def),
      next: maxedAtLevel(def, level) ? null : statFn(def, { [def.id]: Math.min(cap, level + Math.max(1, levels)) }),
    };
  }

  function previewUpgrade(id, levels = 1) {
    return preview(getUpgradeDef(id), getUpgradeLevel(id), levels);
  }

  // ─────────────────────── Economy info ───────────────────────
  // Everything the debug panel (and the tests, and the balance simulator) want to
  // know about the maths. All of it is exact (machine.js spinExpectation).
  function spinValue(machine = activeMachine(), overrides) {
    const md = { ...getMachineData(machine), symbols: getSymbols(overrides, machine) };
    const reels = getReelCount(overrides, machine);
    return spinExpectation(md, reels, {
      lines: getLineCount(overrides, machine),
      fullLineMultiplier: getFullLineMultiplier(overrides),
      streakPerStack: getStreakPerStack(overrides),
      streakCap: getStreakCap(overrides),
      extraFreeSpins: getExtraFreeSpins(overrides, machine),
      jackpotGrowth: getJackpotGrowth(overrides, machine),
      spinDuration: getSpinDuration(overrides, machine),
    });
  }

  function getEconomy(machine = activeMachine()) {
    const md = getMachineData(machine);
    const value = spinValue(machine);
    const payoutMultiplier = getPayoutMultiplier();
    const spinCost = getSpinCost(undefined, machine);
    const bet = getBet(machine);
    const autoInterval = getAutoInterval(undefined, machine);
    // Per paid spin, at the chosen bet: every payout and the cost scale with it.
    const profitPerSpin = bet * (value.ev * payoutMultiplier - spinCost);
    return {
      reels: getReelCount(undefined, machine),
      lines: getLineCount(undefined, machine),
      rows: rowCount(md),
      ev: value.ev, // average payout per paid spin at ×1, before the payout multiplier (lines, streak, free spins, pots)
      lineEv: value.lineEv, // the paylines alone
      hitRate: value.hitRate, // chance a spin wins on a line
      luck: getLuck(undefined, machine), // { hamster, machine, total }
      streakFactor: value.streakFactor,
      freeSpins: value.freeSpins,
      jackpot: value.jackpot,
      payoutMultiplier,
      spinCost, // at ×1
      bet,
      betCost: getBetCost(bet, machine),
      spinDuration: getSpinDuration(undefined, machine),
      rtp: (value.ev * payoutMultiplier) / spinCost, // > 1 means spinning makes money on average (the same at every bet)
      profitPerSpin,
      autoInterval,
      // Free spins and the jackpot wheel pause auto-spin while they play, so they
      // make each paid spin's "cycle" longer by this many seconds on average.
      extraSecondsPerSpin: value.extraSeconds,
      expectedAutoProfitPerSecond: autoInterval ? profitPerSpin / (autoInterval + value.extraSeconds) : 0,
      deliveryPerSecond: getDeliveryReward() / getDeliveryDuration(),
    };
  }

  // The odds of the active machine's features, for the Info tab ("1 in N spins").
  function getFeatureOdds(machine = activeMachine()) {
    const md = getMachineData(machine);
    const value = spinValue(machine);
    return {
      wild: md.symbols.some((s) => s.wild) ? getSymbolChance(md.symbols.find((s) => s.wild).id) : 0,
      freeSpins: md.freeSpins ? { ...value.freeSpins, multiplier: md.freeSpins.multiplier } : null,
      jackpot: md.jackpot ? value.jackpot : null,
      hitRate: value.hitRate,
      luck: getLuck(undefined, machine),
      streak: { perStack: getStreakPerStack(), cap: getStreakCap(), factor: value.streakFactor },
      // The card gamble's odds come from the deck: a colour is 2 of the 4 suits, a suit 1 of 4.
      gamble: data.gamble ? {
        maxRounds: data.gamble.maxRounds,
        color: { chance: 1 / gambleMultiplier('red'), multiplier: gambleMultiplier('red') },
        suit: { chance: 1 / gambleMultiplier(SUITS[0].id), multiplier: gambleMultiplier(SUITS[0].id) },
      } : null,
    };
  }

  // ─────────────────────── Actions ───────────────────────────

  function changeCoins(amount) {
    state.coins = roundMoney(state.coins + amount);
    events.emit('coinsChanged', { coins: state.coins, amount });
  }

  function changeSeeds(amount) {
    state.seeds += amount;
    events.emit('seedsChanged', { seeds: state.seeds, amount });
  }

  // Every coin EARNED by playing (spin wins, deliveries) goes through here, so the
  // totals that decide Heirloom Seeds can never miss one. Spending doesn't lower them.
  function earn(amount) {
    state.stats.coinsEarned = roundMoney(state.stats.coinsEarned + amount);
    state.run.coinsEarned = roundMoney(state.run.coinsEarned + amount);
    changeCoins(amount);
  }

  // Is anything still waiting to play on this machine? (free spins left, or the
  // last free spin still in the air)
  function hasFreeSpins(machine = activeMachine()) {
    return !!machine.freeSpins && (machine.freeSpins.left > 0 || (machine.spinning && machine.spinFree));
  }

  // Start a spin. The result is decided NOW (so the UI knows where the reels
  // stop) but paid when the spin finishes, spinDuration seconds later.
  // source: "manual" (the player), "auto" (Wheel Training) or "free" (a free spin,
  // which the machine plays by itself; see tick()).
  function spin(source = 'manual') {
    const machine = activeMachine();
    if (state.delivery.active) {
      // The hamster is out delivering, so nobody is running the wheel.
      events.emit('spinBlocked', { reason: 'delivery', source });
      return false;
    }
    if (machine.spinning) {
      // Still busy: a click is remembered and becomes the next spin (auto-spin can't take it).
      if (source === 'manual') queuedManual = true;
      return false;
    }
    if (machine.bonus) {
      events.emit('spinBlocked', { reason: 'bonus', source });
      return false;
    }
    if (state.gamble && state.gamble.started) {
      events.emit('spinBlocked', { reason: 'gamble', source });
      return false;
    }
    const free = source === 'free';
    // Free spins play themselves, one after another; paid spins wait until they're done.
    if (free !== (!!machine.freeSpins && machine.freeSpins.left > 0)) return false;

    let bet;
    let cost = 0;
    if (free) {
      bet = machine.freeSpins.bet;
      machine.freeSpins.left--;
    } else {
      bet = getSpinBet(machine);
      if (bet === null) {
        events.emit('spinBlocked', { reason: 'coins', source, cost: getBetCost(1) });
        return false;
      }
      cost = getBetCost(bet);
    }
    if (state.gamble) endGamble('spin'); // spinning again means "no thanks" to an open gamble offer

    if (cost > 0) {
      changeCoins(-cost);
      state.stats.coinsSpent = roundMoney(state.stats.coinsSpent + cost);
      state.stats.biggestBet = Math.max(state.stats.biggestBet, bet);
      growPots(machine);
    }

    // Roll with the luck-adjusted weights (Lucky Whiskers, Carrot Patch, Hamster Wild).
    const md = { ...getMachineData(machine), symbols: getSymbols() };
    machine.result = rollGrid(md, getReelCount(), rng);
    machine.spinning = true;
    machine.spinTimer = getSpinDuration();
    machine.spinBet = bet;
    machine.spinFree = free;
    machine.spinSource = source;

    state.stats.spins++;
    if (source === 'auto') state.stats.autoSpins++;
    else if (free) state.stats.freeSpins++;
    else state.stats.manualSpins++;

    events.emit('spinStarted', { machineId: machine.typeId, result: copyGrid(machine.result), source, cost, bet, free });
    checkDiary(); // spin counts are diary goals ("First Spin", "Warming Up" …)
    return true;
  }

  // Pay a finished spin. Every active payline is scored on its own (machine.js
  // evaluateGrid) and the wins add up. Each line's payout gets:
  //   × the payout multiplier × the bet
  //   × Jackpot Dance on a line where EVERY reel matched
  //   × the free-spin multiplier (free spins) or × Hot Streak (paid spins)
  // Then the scatters are counted: free spins, or the jackpot wheel.
  function resolveSpin(machine) {
    const md = getMachineData(machine);
    const { wins, basePayout } = evaluateGrid(machine.result, getPaylines(undefined, machine), md.payouts, symbolRules(md));
    const bet = machine.spinBet || 1;
    const free = !!machine.spinFree;
    const manual = machine.spinSource === 'manual';
    const multiplier = getPayoutMultiplier() * bet;
    const fullLineBonus = getFullLineMultiplier();
    const featureMultiplier = free && md.freeSpins ? md.freeSpins.multiplier : 1;
    const streakMultiplier = free ? 1 : getStreakMultiplier(machine); // the streak BEFORE this spin
    let payout = 0;
    const paid = wins.map((w) => {
      const linePayout = roundMoney(w.basePayout * (w.fullLine ? fullLineBonus : 1) * multiplier * featureMultiplier * streakMultiplier);
      payout += linePayout;
      return { ...w, payout: linePayout };
    });
    payout = roundMoney(payout);
    machine.spinning = false;
    machine.spinTimer = 0;

    // Hot Streak counts winning PAID spins in a row (free spins don't count).
    if (!free) {
      machine.streak = paid.length > 0 ? (machine.streak || 0) + 1 : 0;
      state.stats.bestStreak = Math.max(state.stats.bestStreak, machine.streak);
    }
    if (payout > 0) {
      state.stats.wins++;
      state.stats.coinsWon = roundMoney(state.stats.coinsWon + payout);
      state.stats.biggestWin = Math.max(state.stats.biggestWin, payout);
      state.stats.mostLinesWon = Math.max(state.stats.mostLinesWon, paid.length);
      if (paid.some((w) => w.usedWild)) state.stats.wildWins++;
      if (free && machine.freeSpins) {
        machine.freeSpins.won = roundMoney(machine.freeSpins.won + payout);
        state.stats.freeSpinCoins = roundMoney(state.stats.freeSpinCoins + payout);
      }
      earn(payout);
    }

    // Scatters anywhere on the grid.
    const scatterCells = md.freeSpins ? findSymbol(machine.result, md.freeSpins.symbol) : [];
    const pouchCells = md.jackpot ? findSymbol(machine.result, md.jackpot.symbol) : [];
    const award = md.freeSpins ? freeSpinAward(md.freeSpins, scatterCells.length, getExtraFreeSpins(undefined, machine)) : 0;
    const wheel = !free && !!md.jackpot && pouchCells.length >= md.jackpot.min; // the jackpot wheel only starts on paid spins

    const tier = getWinTier(basePayout * featureMultiplier, md);
    events.emit('spinResolved', {
      machineId: machine.typeId, result: copyGrid(machine.result), wins: paid, payout, fullLine: paid.some((w) => w.fullLine), tier,
      bet, free, streak: machine.streak || 0,
      featureCells: award > 0 ? scatterCells : wheel ? pouchCells : [],
    });

    // Golden jackpot (the jackpot symbol on every reel of a line, 3+ reels): a
    // Hamster Token for each such line. Wilds may fill in; a line of wilds alone doesn't count.
    const t = data.tokens;
    if (t && machine.result.length >= t.jackpotMinReels) {
      for (const w of paid) {
        if (!w.fullLine || w.symbolId !== t.jackpotSymbol) continue;
        state.stats.goldenJackpots++;
        earnTokens(t.perJackpot, 'jackpot');
      }
    }

    if (award > 0) startFreeSpins(machine, award, bet);
    if (wheel) startJackpotWheel(machine, bet);
    if (free && machine.freeSpins && machine.freeSpins.left <= 0 && award === 0) endFreeSpins(machine);

    // The gamble is offered after a win you pulled yourself, when nothing else is
    // about to happen on the machine.
    if (payout > 0 && manual && !free && award === 0 && !wheel && machine === activeMachine()) offerGamble(machine, payout);
    checkDiary();
  }

  // How big a win FEELS: "none", "win", or a tier from data.json winTiers
  // ("nice", "big", "jackpot"). It compares the BASE payout (all lines together)
  // with the machine's BASE spin cost, so upgrades that multiply every payout (and
  // the bet) don't turn every win into a "big win". On Old Clunky: a Golden pair
  // is nice, a Carrot line is big, a Golden line is a jackpot.
  function getWinTier(basePayout, md = getMachineData()) {
    if (!(basePayout > 0)) return 'none';
    const multiple = basePayout / md.spinCost;
    let tier = 'win';
    for (const t of data.winTiers || []) if (multiple >= t.minMultiple) tier = t.id;
    return tier;
  }

  // ── Free spins ──
  // 3+ scatters give free spins. The machine plays them by itself (see tick()),
  // they cost nothing, use the bet that won them, and every win is × multiplier.
  // More scatters during free spins add more (a "retrigger").
  function startFreeSpins(machine, count, bet) {
    const md = getMachineData(machine);
    const retrigger = !!machine.freeSpins;
    if (retrigger) {
      machine.freeSpins.left += count;
      machine.freeSpins.total += count;
    } else {
      machine.freeSpins = { left: count, total: count, bet, won: 0, timer: md.freeSpins.pause };
    }
    state.stats.freeSpinTriggers++;
    events.emit('freeSpinsStarted', { machineId: machine.typeId, count, retrigger, bet, left: machine.freeSpins.left });
  }

  function endFreeSpins(machine) {
    const fs = machine.freeSpins;
    machine.freeSpins = null;
    events.emit('freeSpinsEnded', { machineId: machine.typeId, spins: fs.total, won: fs.won });
    checkDiary();
  }

  function getFreeSpins(machine = activeMachine()) {
    const fs = machine.freeSpins;
    return fs ? { left: fs.left, total: fs.total, played: fs.total - fs.left, won: fs.won, bet: fs.bet } : null;
  }

  // Debug only: free spins on the active machine (if it has them).
  function addFreeSpins(count) {
    const machine = activeMachine();
    if (!getMachineData(machine).freeSpins || !(count > 0)) return false;
    startFreeSpins(machine, Math.floor(count), getBet(machine));
    return true;
  }

  // ── Jackpot pots ──
  // Each pot is kept in base units (×1 bet, before payout bonuses). Every paid
  // spin adds its growth; winning it pays pot × bet × payout multiplier, and the
  // pot goes back to its seed.
  function growPots(machine) {
    const jp = getMachineData(machine).jackpot;
    if (!jp) return;
    const growth = getJackpotGrowth(undefined, machine);
    for (const pot of jp.pots) machine.pots[pot.id] = roundMoney((machine.pots[pot.id] || pot.seed) + pot.growth * growth);
  }

  // The wheel picks a pot NOW (like a spin's result) and pays when it stops.
  function startJackpotWheel(machine, bet, potId = null) {
    const jp = getMachineData(machine).jackpot;
    const pot = potId || rng.pickWeighted(jp.pots).id;
    machine.bonus = { pot, timer: jp.duration, bet };
    events.emit('jackpotStarted', { machineId: machine.typeId, pot, duration: jp.duration, bet });
  }

  function payJackpot(machine) {
    const jp = getMachineData(machine).jackpot;
    const { pot, bet } = machine.bonus;
    const def = jp.pots.find((p) => p.id === pot);
    const amount = roundMoney((machine.pots[pot] || def.seed) * bet * getPayoutMultiplier());
    machine.bonus = null;
    machine.pots[pot] = def.seed;
    state.stats.jackpotsWon++;
    if (def === jp.pots[jp.pots.length - 1]) state.stats.grandJackpots++; // the last pot in the list is the top one
    state.stats.biggestWin = Math.max(state.stats.biggestWin, amount);
    earn(amount);
    events.emit('jackpotWon', { machineId: machine.typeId, pot, amount });
    checkDiary();
  }

  // Debug only: spin the jackpot wheel now, landing on a chosen pot.
  function triggerJackpot(potId) {
    const machine = activeMachine();
    const jp = getMachineData(machine).jackpot;
    if (!jp || machine.bonus || machine.spinning || !jp.pots.some((p) => p.id === potId)) return false;
    startJackpotWheel(machine, getBet(machine), potId);
    return true;
  }

  // The pots of a machine as coins at its current bet (what the marquee shows).
  function getJackpotPots(machine = activeMachine()) {
    const jp = getMachineData(machine).jackpot;
    if (!jp) return [];
    const scale = getBet(machine) * getPayoutMultiplier();
    return jp.pots.map((p) => {
      const base = machine.pots[p.id] || p.seed;
      return { id: p.id, name: p.name, base, value: roundMoney(base * scale) };
    });
  }

  // 0 → 1 while the jackpot wheel turns (null when it isn't).
  function getBonusProgress(machine = activeMachine()) {
    if (!machine.bonus) return null;
    const duration = getMachineData(machine).jackpot.duration;
    return Math.min(1, Math.max(0, 1 - machine.bonus.timer / duration));
  }

  // ── The card gamble (like a real pokie's) ──
  // After a win you pulled yourself, you may risk it on a face-down card:
  //   pick a COLOUR ("red" or "black"): right 1 time in 2, and the win doubles (×2)
  //   pick a SUIT ("hearts", "diamonds", "clubs", "spades"): right 1 time in 4, ×4
  // Wrong: the stake is gone, and it's over. Both are exactly fair bets (on
  // average they never pay), and gamble coins are NOT "earned": otherwise wins
  // would count toward Heirloom Seeds and losses wouldn't, and gambling would farm seeds.
  function offerGamble(machine, stake) {
    const g = data.gamble;
    if (!g) return;
    state.gamble = { machineId: machine.typeId, stake, rounds: 0, won: 0, started: false, timer: g.offerSeconds };
    events.emit('gambleOffered', { machineId: machine.typeId, stake });
  }

  function canGamble() {
    const g = state.gamble;
    return !!g && !!data.gamble && g.rounds < data.gamble.maxRounds && g.machineId === activeMachine().typeId && state.coins >= g.stake;
  }

  // The fair prize for a pick: the cards in the deck ÷ the cards that win.
  // "red" → 4 ÷ 2 = ×2, "spades" → 4 ÷ 1 = ×4. 0 = not a real pick.
  function gambleMultiplier(pick) {
    const winners = SUITS.filter((s) => s.color === pick || s.id === pick).length;
    return winners > 0 ? SUITS.length / winners : 0;
  }

  // pick: "red", "black", or a suit id. Returns false for anything else.
  function gamble(pick) {
    const multiplier = gambleMultiplier(pick);
    if (!(multiplier > 0) || !canGamble()) return false;
    const byColor = CARD_COLORS.includes(pick);
    const g = state.gamble;
    g.started = true;
    const card = SUITS[Math.floor(rng.next() * SUITS.length)]; // a fresh card every time
    const stake = g.stake;
    const win = byColor ? card.color === pick : card.id === pick;
    if (win) {
      const gain = roundMoney(stake * (multiplier - 1));
      changeCoins(gain);
      g.won = roundMoney(g.won + gain);
      g.stake = roundMoney(stake * multiplier);
      g.rounds++;
      state.stats.gambleWins++;
      if (!byColor) state.stats.suitWins++;
      state.stats.bestGambleRun = Math.max(state.stats.bestGambleRun, g.rounds);
    } else {
      changeCoins(-stake);
      g.won = roundMoney(g.won - stake);
      state.stats.gambleLosses++;
    }
    cardHistory = [{ suit: card.id, color: card.color }, ...cardHistory].slice(0, Math.max(1, data.gamble.history || 5));
    events.emit('gambleResolved', {
      machineId: g.machineId, win, pick, card: { suit: card.id, color: card.color }, multiplier, stake, round: g.rounds, next: g.stake,
    });
    if (!win) endGamble('lose');
    else if (g.rounds >= data.gamble.maxRounds) endGamble('max');
    checkDiary();
    return true;
  }

  // Debug only: offer the gamble on the active machine for `stake` coins, as if a
  // spin you pulled had just won that much (to try the card panel quickly).
  function triggerGamble(stake) {
    const machine = activeMachine();
    if (!(stake > 0) || state.gamble || machine.spinning || machine.bonus) return false;
    offerGamble(machine, roundMoney(stake));
    return true;
  }

  // Keep what you have: the gamble ends (its coins are already in your pile).
  function collectGamble() {
    if (!state.gamble) return false;
    endGamble('collect');
    return true;
  }

  // reason: "collect", "lose", "max", "spin", "expired", "switch", "retire"
  function endGamble(reason) {
    const g = state.gamble;
    if (!g) return;
    state.gamble = null;
    events.emit('gambleEnded', { machineId: g.machineId, reason, won: g.won, rounds: g.rounds, started: g.started });
  }

  function getGambleInfo() {
    const g = state.gamble;
    if (!g) return null;
    return {
      machineId: g.machineId, stake: g.stake, rounds: g.rounds, maxRounds: data.gamble.maxRounds,
      won: g.won, started: g.started, canPick: canGamble(), timeLeft: g.started ? null : g.timer,
      colorWin: roundMoney(g.stake * gambleMultiplier('red')), suitWin: roundMoney(g.stake * gambleMultiplier(SUITS[0].id)),
      history: getCardHistory(),
    };
  }

  // The last gamble cards, newest first: [{ suit, color }].
  function getCardHistory() {
    return cardHistory.map((c) => ({ ...c }));
  }

  // Food delivery: always allowed (even at 0 coins) unless one is already running.
  // This is what makes spin costs safe: you can never get stuck.
  // source: "manual" (the player) or "auto" (the Self-Starter family trait).
  function startDelivery(source = 'manual') {
    if (state.delivery.active) return false;
    const duration = getDeliveryDuration();
    state.delivery.active = true;
    state.delivery.timer = duration;
    state.delivery.duration = duration; // remembered, so buying Speedy Scooter mid-trip can't confuse the progress bar
    events.emit('deliveryStarted', { duration, reward: getDeliveryReward(), source });
    return true;
  }

  function finishDelivery() {
    const reward = getDeliveryReward();
    state.delivery.active = false;
    state.delivery.timer = 0;
    state.delivery.duration = 0;
    state.stats.deliveries++;
    state.stats.deliveryCoins = roundMoney(state.stats.deliveryCoins + reward);
    earn(reward);
    events.emit('deliveryFinished', { reward });

    // Every Nth delivery brings back a tip: a Hamster Token. (A counter, not luck.)
    const t = data.tokens;
    if (t && t.deliveryEvery > 0 && state.stats.deliveries % t.deliveryEvery === 0) earnTokens(t.perDelivery, 'delivery');
    checkDiary();
  }

  // Buying several levels at once ("×10" or "Max"). Every level still costs what
  // the one cost formula says; a bundle is just the sum.
  //   want = 1, 10, …  → that many levels (fewer if the max level is closer), all or nothing
  //   want = Infinity  → "Max": as many levels as you can afford right now
  // Returns { count, cost, affordable }. When you can't afford even one level,
  // "Max" still returns the next level's price, so the button can show it.
  function getUpgradeBulk(id, want = 1) {
    const def = getUpgradeDef(id);
    if (!isUpgradeAvailable(def)) return { count: 0, cost: 0, affordable: false };
    const start = getUpgradeLevel(id);
    let count = 0;
    let cost = 0;
    // (The 1,000 cap only guards against a broken data.json with a 0 cost.)
    while (count < want && count < 1000 && !maxedAtLevel(def, start + count)) {
      const next = costAtLevel(def, start + count);
      if (want === Infinity && count > 0 && !canAfford(cost + next)) break;
      cost += next;
      count++;
      if (want === Infinity && !canAfford(cost)) break; // not even one level: keep it as the price to show
    }
    return { count, cost, affordable: count > 0 && canAfford(cost) };
  }

  function buyUpgrade(id, want = 1) {
    const def = getUpgradeDef(id);
    const { count, cost, affordable } = getUpgradeBulk(id, want);
    if (!def || !affordable) return false;
    const level = getUpgradeLevel(id) + count;
    changeCoins(-cost);
    levelStore(def)[id] = level;
    state.stats.upgradesBought += count;
    if (def.effect.type === 'unlockSymbol') state.stats.symbolsUnlocked += count;
    events.emit('upgradeBought', { id, level, cost, count });
    checkDiary();
    return true;
  }

  // ───────────────────────── Machines ─────────────────────────
  // "Collect & switch": you buy new machine types with coins and switch between
  // them. The hamster runs one machine at a time (the ACTIVE one). Each machine
  // keeps its own machine upgrades; the hamster's upgrades work on all of them.
  // Machines are bought with coins, so they reset when the hamster retires.

  function findMachine(id) {
    return state.machines.find((m) => m.typeId === id) || null;
  }

  function ownsMachine(id) {
    return !!findMachine(id);
  }

  // A one-time price (the first machine is free: unlockCost 0).
  function getMachineCost(id) {
    const md = data.machines.find((m) => m.id === id);
    return md ? md.unlockCost || 0 : Infinity;
  }

  function canBuyMachine(id) {
    return data.machines.some((m) => m.id === id) && !ownsMachine(id) && canAfford(getMachineCost(id));
  }

  // Buying a machine also switches to it straight away. It starts at the bet you
  // were using (so a new machine never feels like a step down).
  function buyMachine(id) {
    if (!canBuyMachine(id)) return false;
    const cost = getMachineCost(id);
    changeCoins(-cost);
    const machine = newMachineState(data.machines.find((m) => m.id === id));
    machine.bet = getBetIndex();
    state.machines.push(machine);
    state.stats.machinesBought++;
    applyStartingLevels(); // e.g. a "start with" family trait for this machine's upgrades
    events.emit('machineBought', { id, cost });
    switchMachine(id);
    checkDiary();
    return true;
  }

  // Switching is free and instant. If the old machine was mid-spin, that spin
  // still finishes and pays (it was already paid for); see tick().
  function switchMachine(id) {
    const index = state.machines.findIndex((m) => m.typeId === id);
    if (index < 0 || index === state.activeMachine) return false;
    const from = activeMachine().typeId;
    if (state.gamble) endGamble('switch'); // walking away keeps what the gamble has won so far
    queuedManual = false;
    state.activeMachine = index;
    events.emit('machineSwitched', { id, from });
    return true;
  }

  // Everything the machine cards show, for owned and not-yet-owned machines.
  // A machine you don't own yet is shown as it would be when bought (no upgrades).
  function getMachineInfo(id) {
    const md = data.machines.find((m) => m.id === id);
    if (!md) return null;
    const owned = findMachine(id);
    const m = owned || newMachineState(md);
    const wild = md.symbols.find((s) => s.wild);
    const lockable = md.symbols.filter((s) => s.locked);
    return {
      id,
      owned: !!owned,
      active: owned === activeMachine(),
      spinning: !!(owned && owned.spinning),
      cost: getMachineCost(id),
      spinCost: getSpinCost(undefined, m),
      bet: owned ? getBet(owned) : getBet(),
      reels: getReelCount(undefined, m),
      maxReels: md.maxReels,
      lines: getLineCount(undefined, m),
      maxLines: allPaylines(md).length,
      rows: rowCount(md),
      luck: getLuck(undefined, m).total,
      // Symbols you can unlock in the shop: how many of them are open.
      symbols: { unlocked: lockable.filter((s) => !isSymbolLocked(s.id, undefined, m)).length, lockable: lockable.length },
      // Which bonus features it has (a wild that starts at weight 0 is unlocked by an upgrade).
      features: {
        wild: !!wild,
        wildNow: !!wild && getSymbols(undefined, m).some((s) => s.wild && s.weight > 0),
        freeSpins: !!md.freeSpins,
        jackpot: !!md.jackpot,
      },
      freeSpinsLeft: owned && owned.freeSpins ? owned.freeSpins.left : 0,
      bonus: !!(owned && owned.bonus),
    };
  }

  // Debug only: free coins. Normally NOT counted as earned, so they don't give
  // Heirloom Seeds. asEarned = true counts them (for testing retirement quickly).
  function addCoins(amount, asEarned = false) {
    const clamped = Math.max(amount, -state.coins);
    if (asEarned && clamped > 0) {
      earn(clamped);
      checkDiary();
    } else {
      changeCoins(clamped);
    }
  }

  // Debug only: free Hamster Tokens (not counted as earned).
  function addTokens(amount) {
    changeTokens(Math.max(Math.floor(amount), -state.tokens), 'debug');
  }

  // Debug only: free Heirloom Seeds (not counted in seedsEarned).
  function addSeeds(amount) {
    changeSeeds(Math.max(Math.floor(amount), -state.seeds));
  }

  // ─────────────────── Retirement + family tree ───────────────────
  // Heirloom Seeds come from ALL the coins your family has ever earned:
  //   total seeds = floor( (lifetime coins earned / seedDivisor) ^ seedExponent )
  // Retiring pays the difference between that total and the seeds you've already
  // received. So retiring early or late gives the same seeds for the same coins:
  // there's no trick where retiring every minute beats playing on.
  // With exponent 0.5 (a square root), 4× the coins gives 2× the seeds.

  function seedsForCoins(coins) {
    const r = data.retirement;
    if (!r) return 0;
    return Math.floor(Math.pow(Math.max(0, coins) / r.seedDivisor, r.seedExponent) + EPS);
  }

  // The inverse: lifetime coins needed for a total of n seeds.
  function coinsForSeeds(n) {
    const r = data.retirement;
    return r.seedDivisor * Math.pow(n, 1 / r.seedExponent);
  }

  function getPendingSeeds() {
    return Math.max(0, seedsForCoins(state.stats.coinsEarned) - state.seedsEarned);
  }

  // Not while the jackpot wheel is turning or a gamble is under way (their coins
  // would vanish with the old life).
  function canRetire() {
    return getPendingSeeds() >= 1 && !state.machines.some((m) => m.bonus) && !(state.gamble && state.gamble.started);
  }

  // For the progress bar: how far lifetime coins are towards the next seed.
  function getSeedProgress() {
    const earned = state.stats.coinsEarned;
    const total = seedsForCoins(earned);
    const from = coinsForSeeds(total);
    const nextAt = coinsForSeeds(total + 1);
    return { earned, total, nextAt, progress: Math.min(1, Math.max(0, (earned - from) / (nextAt - from))) };
  }

  // Names cycle through the list in data.json: generation 1 is the first name.
  function getPupName(generation = state.generation) {
    const names = (data.retirement && data.retirement.pupNames) || [];
    return names.length ? names[(generation - 1) % names.length] : `Hamster ${generation}`;
  }

  // Family tree nodes like Warm-up Laps give free upgrade levels. Raise any
  // upgrade that is below its free level (never lower one the player bought).
  // A machine upgrade is only raised on the machines that sell it.
  function applyStartingLevels() {
    for (const def of data.upgrades) {
      const free = getStartingLevel(def.id);
      if (free <= 0) continue;
      const stores = def.scope === 'machine'
        ? state.machines.filter((m) => isUpgradeAvailable(def, m)).map((m) => m.upgrades)
        : [state.upgrades];
      for (const store of stores) {
        if ((store[def.id] || 0) < free) store[def.id] = free;
      }
    }
  }

  // Retire to the Big Cage: collect the pending seeds, and a new pup starts a new
  // life. Coins, upgrades, machines, deliveries and timers go back to the start.
  // The family keeps: generation, Heirloom Seeds, the tree, and lifetime stats.
  function retire() {
    if (!canRetire()) return false;
    const gained = getPendingSeeds();
    if (state.gamble) endGamble('retire');
    const oldName = getPupName();
    const runEarned = state.run.coinsEarned;
    state.seedsEarned += gained;
    changeSeeds(gained);
    state.generation++;

    const fresh = newState(data);
    state.coins = fresh.coins;
    state.upgrades = fresh.upgrades;
    state.machines = fresh.machines;
    state.activeMachine = fresh.activeMachine;
    state.delivery = fresh.delivery;
    state.autoTimer = fresh.autoTimer;
    state.run = fresh.run;
    queuedManual = false;
    applyStartingLevels(); // the new pup's head start from the tree

    events.emit('retired', { generation: state.generation, seedsGained: gained, oldName, newName: getPupName(), runEarned });
    events.emit('coinsChanged', { coins: state.coins, amount: 0 });
    if (data.tokens) earnTokens(data.tokens.perRetirement, 'retire');
    checkDiary();
    return true;
  }

  function getTreeCost(id) {
    return costAtLevel(getTreeNodeDef(id), getTreeLevel(id));
  }

  function isTreeMaxed(id) {
    return maxedAtLevel(getTreeNodeDef(id), getTreeLevel(id));
  }

  // A node is unlocked once every node it "requires" has at least level 1.
  function isTreeNodeUnlocked(id) {
    const def = getTreeNodeDef(id);
    return !!def && def.requires.every((r) => getTreeLevel(r) > 0);
  }

  function canBuyTreeNode(id) {
    return !!getTreeNodeDef(id) && isTreeNodeUnlocked(id) && !isTreeMaxed(id) && state.seeds >= getTreeCost(id);
  }

  function buyTreeNode(id) {
    if (!canBuyTreeNode(id)) return false;
    const cost = getTreeCost(id);
    const level = getTreeLevel(id) + 1;
    state.tree[id] = level;
    changeSeeds(-cost);
    applyStartingLevels(); // e.g. Warm-up Laps gives Wheel Training Lv 1 right away
    events.emit('treeNodeBought', { id, level, cost });
    checkDiary();
    return true;
  }

  function previewTreeNode(id) {
    return preview(getTreeNodeDef(id), getTreeLevel(id));
  }

  // ─────────────── Hamster Tokens + the Hamster Diary ───────────────
  // Tokens are a third currency. They only buy capsules (cosmetic skins), never
  // power. They're earned from diary stickers, golden jackpots, every Nth
  // delivery and retiring, and they're kept when the hamster retires.

  function changeTokens(amount, source) {
    state.tokens += amount;
    events.emit('tokensChanged', { tokens: state.tokens, amount, source });
  }

  // Earning (not refunds or debug) also counts toward stats.tokensEarned.
  function earnTokens(amount, source) {
    if (!(amount > 0)) return;
    state.stats.tokensEarned += amount;
    changeTokens(amount, source);
  }

  // How far along a diary goal is. Each goal "type" is one line here.
  function getDiaryValue(goal) {
    switch (goal.type) {
      case 'stat': return state.stats[goal.stat] || 0;
      case 'upgradeLevel': return getBestUpgradeLevel(goal.upgrade);
      case 'generation': return state.generation;
      case 'treeNodes': return treeNodes().filter((n) => getTreeLevel(n.id) > 0).length;
      case 'skinsOwned': return Object.keys(state.skins.owned).length;
      case 'machinesOwned': return state.machines.length;
      default: return 0;
    }
  }

  function getDiaryProgress(id) {
    const sticker = (data.diary || []).find((d) => d.id === id);
    if (!sticker) return null;
    const value = getDiaryValue(sticker.goal);
    return { value, target: sticker.goal.target, done: !!state.diary[id] };
  }

  // Award every sticker whose goal is met. Called after anything that can move
  // a goal (spins, deliveries, purchases, retiring, capsules) and after loading,
  // so goals reached in an older save are awarded too.
  function checkDiary() {
    // Luck only changes when something is bought, but it isn't one event, so the
    // best Luck any machine has reached is noted here, just before the goals are read.
    for (const m of state.machines) state.stats.bestLuck = Math.max(state.stats.bestLuck, getLuck(undefined, m).total);
    for (const sticker of data.diary || []) {
      if (state.diary[sticker.id]) continue;
      if (getDiaryValue(sticker.goal) < sticker.goal.target) continue;
      state.diary[sticker.id] = true;
      earnTokens(sticker.tokens, 'sticker');
      events.emit('stickerEarned', { id: sticker.id, tokens: sticker.tokens });
    }
  }

  // ─────────────────── Capsule Machine + skins ───────────────────
  // A pull costs tokens and gives one random skin. Rarity is picked by weight,
  // then a skin of that rarity is picked evenly. Two fairness rules:
  //   Pity: after (pityPulls - 1) pulls without the pity rarity, the next pull IS
  //         that rarity. So an Epic is guaranteed within pityPulls pulls.
  //   Duplicates: a skin you already own refunds some tokens instead.
  // It uses the game's seeded RNG, like the reels, so tests can check the odds.

  function getSkinDef(id) {
    return (data.skins || []).find((s) => s.id === id) || null;
  }

  // Starter skins (one per category) are owned from the start.
  function isSkinOwned(id) {
    const def = getSkinDef(id);
    return !!def && (def.rarity === 'starter' || !!state.skins.owned[id]);
  }

  function getEquippedSkin(category) {
    const id = state.skins.equipped[category];
    if (id && isSkinOwned(id)) return id;
    const starter = (data.skins || []).find((s) => s.category === category && s.rarity === 'starter');
    return starter ? starter.id : null;
  }

  function getPullCost() {
    return data.capsules ? data.capsules.pullCost : Infinity;
  }

  function canPull() {
    return !!data.capsules && state.tokens >= getPullCost();
  }

  // The odds for the odds table: `chance` is the listed weight; `withPity` is the
  // real long-run share once pity is counted. For the pity rarity with chance p
  // and pity N, the average gap between them is (1 − (1 − p)^N) / p pulls, so its
  // real share is one over that. The other rarities share what's left.
  // Example: Epic 5%, pity 20 → about 7.8% of all pulls.
  function getCapsuleOdds() {
    const c = data.capsules;
    if (!c) return [];
    const totalWeight = c.rarities.reduce((sum, r) => sum + r.weight, 0);
    const pityChance = c.rarities.find((r) => r.id === c.pityRarity).weight / totalWeight;
    const pityShare = pityChance / (1 - Math.pow(1 - pityChance, c.pityPulls));
    return c.rarities.map((r) => {
      const chance = r.weight / totalWeight;
      const withPity = r.id === c.pityRarity ? pityShare : ((1 - pityShare) * chance) / (1 - pityChance);
      return { id: r.id, name: r.name, chance, withPity, duplicateRefund: r.duplicateRefund };
    });
  }

  // Pulls left until the pity rarity is guaranteed (1 = the next pull).
  function getPityRemaining() {
    return data.capsules ? data.capsules.pityPulls - state.capsules.sincePity : 0;
  }

  function pullCapsule() {
    if (!canPull()) return false;
    const c = data.capsules;
    changeTokens(-c.pullCost, 'pull');

    const forced = state.capsules.sincePity >= c.pityPulls - 1;
    const rarity = forced ? c.pityRarity : rng.pickWeighted(c.rarities).id;
    const pool = data.skins.filter((s) => s.rarity === rarity);
    const skin = pool[Math.floor(rng.next() * pool.length)];
    state.capsules.sincePity = rarity === c.pityRarity ? 0 : state.capsules.sincePity + 1;
    state.stats.capsulesOpened++;

    const duplicate = !!state.skins.owned[skin.id];
    let refund = 0;
    if (duplicate) {
      refund = c.rarities.find((r) => r.id === rarity).duplicateRefund;
      changeTokens(refund, 'refund');
    } else {
      state.skins.owned[skin.id] = true;
    }
    events.emit('capsuleOpened', { skinId: skin.id, rarity, duplicate, refund, pity: forced });
    checkDiary();
    return true;
  }

  function equipSkin(id) {
    const def = getSkinDef(id);
    if (!def || !isSkinOwned(id)) return false;
    state.skins.equipped[def.category] = id;
    events.emit('skinEquipped', { id, category: def.category });
    return true;
  }

  // ─────────────────────── Offline earnings ───────────────────────
  // While the game is closed, the hamster keeps running the wheel, but at a
  // reduced rate (offline.efficiency) and for at most offline.maxSeconds.
  // It's worked out from the average auto-spin profit per second instead of
  // simulating every spin, so it's instant and doesn't touch the RNG.
  // main.js says how long the player was away: this file never reads the clock.
  // No Wheel Training = no auto-spin = nothing earned while away.
  function getOfflineEarnings(seconds) {
    const o = data.offline;
    if (!o || !(seconds >= o.minSeconds)) return { seconds: 0, coins: 0 };
    const counted = Math.min(seconds, o.maxSeconds);
    const perSecond = Math.max(0, getEconomy().expectedAutoProfitPerSecond);
    return { seconds: counted, coins: roundMoney(perSecond * counted * o.efficiency) };
  }

  function applyOfflineEarnings(seconds) {
    const { seconds: counted, coins } = getOfflineEarnings(seconds);
    if (coins <= 0) return false;
    state.stats.offlineCoins = roundMoney(state.stats.offlineCoins + coins);
    earn(coins); // counts as earned, so it moves you toward Heirloom Seeds too
    events.emit('offlineEarned', { awaySeconds: seconds, seconds: counted, coins });
    checkDiary();
    return true;
  }

  // ─────────────────────────── Time ───────────────────────────

  // Advance the game by dt seconds of game time. Time is saved up in an
  // "accumulator" and spent in fixed TICK-sized steps. This keeps the results
  // identical whether dt is 1/60 s (a normal frame) or 12 s (debug speed 50×).
  function update(dt) {
    if (!(dt > 0)) return; // also ignores NaN
    accumulator += dt;
    const steps = Math.floor((accumulator + EPS) / TICK);
    accumulator -= steps * TICK;
    for (let i = 0; i < steps; i++) tick(TICK);
  }

  // One fixed step. Order matters: finish things first, then start new things.
  function tick(dt) {
    state.stats.playTime += dt;
    state.run.playTime += dt;

    // 1) Delivery timer
    if (state.delivery.active) {
      state.delivery.timer -= dt;
      if (state.delivery.timer <= EPS) finishDelivery();
    }

    // 2) Jackpot wheels. Like spins, every machine's wheel keeps turning after a
    //    switch, and pays when it stops.
    for (const m of state.machines) {
      if (!m.bonus) continue;
      m.bonus.timer -= dt;
      if (m.bonus.timer <= EPS) payJackpot(m);
    }

    // 3) Spin timers. Every spinning machine counts down, not just the active
    //    one: after a switch, the old machine's last spin still lands and pays.
    //    (A spin landing can start free spins, the jackpot wheel or a gamble offer.)
    for (const m of state.machines) {
      if (!m.spinning) continue;
      m.spinTimer -= dt;
      if (m.spinTimer <= EPS) resolveSpin(m);
    }

    // 4) A gamble offer you haven't touched runs out after a few seconds.
    if (state.gamble && !state.gamble.started) {
      state.gamble.timer -= dt;
      if (state.gamble.timer <= EPS) endGamble('expired');
    }

    // 4b) A click that came while the machine was spinning: it goes now, before
    //     auto-spin can take the machine. (Tried once; if it can't start, it's dropped.)
    //     If the spin you pulled just won, the gamble offer takes its place: you
    //     get to see it, and your next tap decides (pick a card, or spin on).
    const machine = activeMachine();
    if (queuedManual && !machine.spinning) {
      queuedManual = false;
      if (!(state.gamble && state.gamble.machineId === machine.typeId)) spin('manual');
    }

    // 5) Free spins play by themselves on the active machine, with a short pause
    //    between them. Like any spin, they wait while the hamster is delivering.
    const fs = machine.freeSpins;
    const gambling = !!state.gamble && state.gamble.started;
    if (fs && fs.left > 0 && !state.delivery.active && !machine.spinning && !machine.bonus && !gambling) {
      fs.timer -= dt;
      if (fs.timer <= EPS && spin('free')) fs.timer = getMachineData(machine).freeSpins.pause;
    }

    // 6) Auto-spin (Wheel Training) on the active machine. Paused while the
    //    hamster is delivering, and its timer stands still while free spins, the
    //    jackpot wheel or a gamble have the machine (so they don't cost auto-spins).
    const interval = getAutoInterval();
    const held = hasFreeSpins(machine) || !!machine.bonus || (!!state.gamble && state.gamble.machineId === machine.typeId);
    if (interval !== null && !state.delivery.active && !held) {
      state.autoTimer += dt;
      if (state.autoTimer >= interval - EPS) {
        if (!machine.spinning && getSpinBet() !== null) {
          spin('auto');
          // Keep the leftover time so the average rate stays exact at 60 ticks/s.
          state.autoTimer = Math.max(0, state.autoTimer - interval);
        } else {
          // Busy or broke: wait at the line instead of banking extra spins.
          state.autoTimer = interval;
        }
      }
    }

    // 7) Self-Starter (family tree): broke and idle, so the hamster goes delivering
    //    by itself. "Broke" = can't afford even a ×1 spin, with nothing else to play.
    if (!state.delivery.active && !machine.spinning && !held && !gambling && getSpinBet() === null && hasAutoDelivery()) {
      startDelivery('auto');
    }
  }

  // ─────────────────────── UI helpers ───────────────────────

  // 0 → 1 over the active machine's current spin (1 when idle). The UI uses this
  // to decide when each reel stops, so animations automatically follow game speed.
  function getSpinProgress() {
    const machine = activeMachine();
    if (!machine.spinning) return 1;
    return Math.min(1, Math.max(0, 1 - machine.spinTimer / getSpinDuration()));
  }

  function getDeliveryProgress() {
    if (!state.delivery.active) return 0;
    return Math.min(1, Math.max(0, 1 - state.delivery.timer / state.delivery.duration));
  }

  // ────────────────────── Data & saves ──────────────────────

  // Hot-reload balance data (debug "Reload data.json"). Progress is kept, but
  // cleaned up against the new data (e.g. levels capped at a lowered maxLevel).
  function setData(newData) {
    data = newData;
    state = sanitizeState(state, data);
    applyStartingLevels();
    checkDiary();
    events.emit('dataReloaded', {});
    events.emit('coinsChanged', { coins: state.coins, amount: 0 });
  }

  // A plain JSON-safe copy of the player's state. Balance numbers are NOT saved,
  // so changes to data.json apply straight away to existing saves.
  // An open gamble isn't saved: dropping it is the same as collecting (its coins
  // are already in the pile).
  function toSaveData() {
    const copy = JSON.parse(JSON.stringify(state));
    delete copy.gamble;
    return { saveVersion: SAVE_VERSION, ...copy };
  }

  function loadSaveData(obj) {
    const save = migrateSave(obj, data);
    if (!save) return false;
    state = sanitizeState(save, data);
    applyStartingLevels();
    checkDiary(); // award goals an older save had already reached
    accumulator = 0;
    queuedManual = false;
    events.emit('stateLoaded', {});
    events.emit('coinsChanged', { coins: state.coins, amount: 0 });
    return true;
  }

  return {
    // Read-only by convention: draw from these, but change things only via the actions.
    get state() { return state; },
    get data() { return data; },
    get rng() { return rng; },

    on: events.on,
    off: events.off,

    // actions
    update, spin, startDelivery, buyUpgrade, buyMachine, switchMachine, retire, buyTreeNode, pullCapsule, equipSkin,
    setBet, gamble, collectGamble,
    applyOfflineEarnings, addCoins, addSeeds, addTokens, addFreeSpins, triggerJackpot, triggerGamble, setData,

    // queries: coins, upgrades
    getUpgradeDef, getAvailableUpgrades, getUpgradeLevel, getUpgradeCost, getUpgradeBulk, isMaxed, canAfford, canBuyUpgrade,
    previewUpgrade,

    // queries: machines, symbols, Luck
    getMachineData, getMachineInfo, getMachineCost, ownsMachine, canBuyMachine,
    getReelCount, getLineCount, getPaylines, getRowCount, getSymbols, getSymbolChance, getSpinCost, getSpinDuration,
    isSymbolLocked, getSymbolUnlock, getLuck,
    getPayoutMultiplier, getHeirloomBonus, getFullLineMultiplier, getAutoInterval,
    getDeliveryDuration, getDeliveryReward, hasAutoDelivery,
    getSpinProgress, getDeliveryProgress, getEconomy, getWinTier, getOfflineEarnings,

    // queries: bets and bonus features
    getBetSteps, getMaxBetIndex, getBetIndex, getBet, getBetCost, getSpinBet,
    getFreeSpins, hasFreeSpins, getJackpotPots, getBonusProgress, getStreakMultiplier, getMaxStreakMultiplier,
    getFeatureOdds, canGamble, getGambleInfo, getCardHistory,

    // queries: retirement + family tree
    getPendingSeeds, canRetire, getSeedProgress, getPupName,
    getTreeNodeDef, getTreeLevel, getTreeCost, isTreeMaxed, isTreeNodeUnlocked, canBuyTreeNode, previewTreeNode,
    getStartingLevel,

    // queries: tokens, diary, capsules, skins
    getDiaryProgress, getSkinDef, isSkinOwned, getEquippedSkin, getPullCost, canPull, getPityRemaining, getCapsuleOdds,

    // saving
    toSaveData, loadSaveData,
  };
}

// ─────────────────── State shape (module level) ───────────────────

// A fresh machine of one type (md = its data.json entry).
function newMachineState(md) {
  const pots = {};
  if (md.jackpot) for (const pot of md.jackpot.pots) pots[pot.id] = pot.seed;
  return {
    typeId: md.id, // which machine in data.json
    upgrades: {}, // machine-scoped upgrade levels, e.g. { lever: 2 }
    bet: 0, // the chosen bet: an index into data.json betSteps
    spinning: false,
    spinTimer: 0, // seconds left in the current spin
    spinBet: 1, // the bet the current spin was paid with
    spinFree: false, // the current spin is a free spin
    spinSource: 'manual', // who started the current spin: "manual", "auto" or "free"
    result: null, // the grid of the current or last spin: result[reel][row] = symbol id
    streak: 0, // winning paid spins in a row (Hot Streak)
    freeSpins: null, // { left, total, bet, won, timer } while free spins are waiting or playing
    pots, // jackpot pots in base units, e.g. { mini: 812.5, … } (machines with a jackpot wheel)
    bonus: null, // { pot, timer, bet } while the jackpot wheel turns
  };
}

function copyGrid(grid) {
  return grid.map((column) => [...column]);
}

// Lifetime stats: they keep counting across retirements (only Reset wipes them).
function newStats() {
  return {
    spins: 0, manualSpins: 0, autoSpins: 0, wins: 0,
    coinsWon: 0, coinsSpent: 0, deliveries: 0, deliveryCoins: 0,
    coinsEarned: 0, // everything earned by playing (wins + deliveries); decides Heirloom Seeds
    upgradesBought: 0, playTime: 0,
    goldenJackpots: 0, capsulesOpened: 0, tokensEarned: 0,
    biggestWin: 0, // the largest single spin payout ever
    offlineCoins: 0, // coins earned while the game was closed
    machinesBought: 0, // new machines bought (they reset on retiring, so this can pass the number of machine types)
    mostLinesWon: 0, // the most paylines that won in a single spin
    // v6: bets and bonus features
    biggestBet: 0, // the biggest bet a paid spin ever used (×N)
    freeSpins: 0, freeSpinTriggers: 0, freeSpinCoins: 0, // free spins played, times they started, coins they paid
    wildWins: 0, // winning spins where a Hamster Wild helped
    bestStreak: 0, // the most winning paid spins in a row
    jackpotsWon: 0, grandJackpots: 0, // jackpot pots won (grand = the top pot)
    gambleWins: 0, gambleLosses: 0, bestGambleRun: 0, // gamble picks won/lost, most wins in a row in one gamble
    // v7: symbols you unlock, Luck, the card gamble
    symbolsUnlocked: 0, // symbol unlocks bought (they reset on retiring, so this keeps counting)
    bestLuck: 0, // the most Luck any machine has had
    suitWins: 0, // gamble wins where you picked the suit (×4)
  };
}

export function newState(data) {
  return {
    // ── this hamster's life (reset when it retires) ──
    coins: data.startCoins,
    upgrades: {}, // global upgrade levels, e.g. { cheeks: 3, wheel: 1 }
    machines: [newMachineState(data.machines[0])], // owned machines; the first one in data.json is free
    activeMachine: 0, // index into machines: the one the hamster is running
    delivery: { active: false, timer: 0, duration: 0 },
    autoTimer: 0,
    gamble: null, // { machineId, stake, rounds, won, started, timer } while a gamble is offered or played (never saved)
    run: { coinsEarned: 0, playTime: 0 }, // totals for this hamster only

    // ── the family (kept when retiring) ──
    generation: 1, // 1 = the first hamster; +1 per retirement
    seeds: 0, // unspent Heirloom Seeds
    seedsEarned: 0, // every seed ever received from retiring (the seed formula subtracts these)
    tree: {}, // family tree node levels, e.g. { familyPride: 1 }

    // ── collection (also kept when retiring) ──
    tokens: 0, // unspent Hamster Tokens
    diary: {}, // diary stickers earned, e.g. { firstSpin: true }
    skins: { owned: {}, equipped: {} }, // owned: { furCinnamon: true }; equipped: { fur: "furCinnamon" }
    capsules: { sincePity: 0 }, // pulls since the last pity-rarity (Epic) capsule

    stats: newStats(),
  };
}

// Upgrades old saves to the current shape. Each time the save shape changes,
// bump SAVE_VERSION and add a step that upgrades an old save by one version.
// Returns null for anything unusable (not an object, or an unknown version).
// `data` (data.json) is needed by steps that depend on the balance file (v7).
export function migrateSave(obj, data) {
  if (!obj || typeof obj !== 'object') return null;
  const save = JSON.parse(JSON.stringify(obj));

  // v1 → v2: retirement arrived. The current hamster becomes generation 1, and
  // everything it has earned so far counts towards its first Heirloom Seeds.
  if (save.saveVersion === 1) {
    const stats = save.stats && typeof save.stats === 'object' ? save.stats : {};
    const earned = num(stats.coinsWon, 0) + num(stats.deliveryCoins, 0);
    stats.coinsEarned = earned;
    save.stats = stats;
    save.run = { coinsEarned: earned, playTime: num(stats.playTime, 0) };
    save.generation = 1;
    save.seeds = 0;
    save.seedsEarned = 0;
    save.tree = {};
    save.saveVersion = 2;
  }

  // v2 → v3: Hamster Tokens and skins arrived. Start with none; loadSaveData()
  // then awards any diary stickers this save had already earned.
  if (save.saveVersion === 2) {
    save.tokens = 0;
    save.diary = {};
    save.skins = { owned: {}, equipped: {} };
    save.capsules = { sincePity: 0 };
    save.saveVersion = 3;
  }

  // v3 → v4: two new lifetime stats. Old saves start them at 0 (the biggest win
  // from before this version isn't known).
  if (save.saveVersion === 3) {
    if (save.stats && typeof save.stats === 'object') {
      save.stats.biggestWin = 0;
      save.stats.offlineCoins = 0;
    }
    save.saveVersion = 4;
  }

  // v4 → v5: spin results became a grid (reels × rows). An old result was one
  // symbol per reel, so every reel becomes a column with a single row.
  // Two new stats: no machines were bought yet; any old win was on 1 line.
  if (save.saveVersion === 4) {
    for (const m of Array.isArray(save.machines) ? save.machines : []) {
      if (m && Array.isArray(m.result)) m.result = m.result.map((id) => [id]);
    }
    if (save.stats && typeof save.stats === 'object') {
      save.stats.machinesBought = 0;
      save.stats.mostLinesWon = num(save.stats.wins, 0) > 0 ? 1 : 0;
    }
    save.saveVersion = 5;
  }

  // v5 → v6: bets and bonus features. Every machine starts at bet ×1 with no
  // free spins, its pots at their seeds and no streak; the new stats start at 0.
  // (sanitizeState fills all of that in, so only the version changes here.)
  if (save.saveVersion === 5) {
    save.saveVersion = 6;
  }

  // v6 → v7: symbols you unlock arrived, and machines now start with fewer
  // symbols. An older hamster already had every symbol, so each of its machines
  // gets every symbol unlock that machine sells: nobody loses a symbol they had.
  // (The new stats start at 0: sanitizeState fills them in.)
  if (save.saveVersion === 6) {
    const unlocks = ((data && data.upgrades) || []).filter((u) => u.scope === 'machine' && u.effect.type === 'unlockSymbol');
    for (const m of Array.isArray(save.machines) ? save.machines : []) {
      if (!m || typeof m !== 'object') continue;
      if (!m.upgrades || typeof m.upgrades !== 'object') m.upgrades = {};
      for (const def of unlocks) if (!def.machines || def.machines.includes(m.typeId)) m.upgrades[def.id] = def.effect.symbols.length;
    }
    save.saveVersion = 7;
  }

  if (save.saveVersion !== SAVE_VERSION) return null;
  return save;
}

function num(x, fallback) {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// Keep only levels that exist in the current data, capped at maxLevel.
function cleanLevels(raw, defs) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const def of defs) {
    let level = Math.floor(num(raw[def.id], 0));
    if (level <= 0) continue;
    if (def.maxLevel !== null && def.maxLevel !== undefined) level = Math.min(level, def.maxLevel);
    out[def.id] = level;
  }
  return out;
}

// A spin result is kept only if it fits the machine: 1 to maxReels columns,
// each with exactly one symbol per row, all of them real symbols.
function isValidGrid(grid, md) {
  const rows = rowCount(md);
  const ids = md.symbols.map((s) => s.id);
  return Array.isArray(grid) && grid.length >= 1 && grid.length <= md.maxReels
    && grid.every((column) => Array.isArray(column) && column.length === rows && column.every((id) => ids.includes(id)));
}

// Build a clean, valid state from a save (or a live state after a data reload).
// Anything missing or broken falls back to the fresh-game value.
export function sanitizeState(raw, data) {
  const s = newState(data);
  if (!raw || typeof raw !== 'object') return s;

  s.coins = roundMoney(Math.max(0, num(raw.coins, s.coins)));
  s.upgrades = cleanLevels(raw.upgrades, data.upgrades.filter((u) => u.scope === 'global'));

  // Machines: keep each known machine type once. The first machine in data.json
  // is free, so it's always owned (it's what makes "never stuck" true).
  const rawMachines = Array.isArray(raw.machines) ? raw.machines : [];
  const rawActive = rawMachines[Math.floor(num(raw.activeMachine, 0))];
  const kept = [];
  const steps = data.betSteps && data.betSteps.length ? data.betSteps : [1];
  const validBet = (x) => (steps.includes(x) ? x : 1);
  for (const m of rawMachines) {
    const md = m && data.machines.find((x) => x.id === m.typeId);
    if (!md || kept.some((k) => k.typeId === md.id)) continue; // unknown type, or a duplicate
    const clean = newMachineState(md);
    clean.upgrades = cleanLevels(m.upgrades, data.upgrades.filter((u) => u.scope === 'machine' && (!u.machines || u.machines.includes(md.id))));
    clean.bet = clamp(Math.floor(num(m.bet, 0)), 0, steps.length - 1); // (game.js also caps it at what's unlocked)
    clean.streak = Math.max(0, Math.floor(num(m.streak, 0)));
    if (isValidGrid(m.result, md)) {
      clean.result = m.result.map((column) => [...column]);
      if (m.spinning === true) {
        clean.spinning = true;
        clean.spinTimer = clamp(num(m.spinTimer, 0), 0, md.spinDuration);
        clean.spinBet = validBet(m.spinBet);
        clean.spinFree = m.spinFree === true && !!md.freeSpins;
        clean.spinSource = ['manual', 'auto', 'free'].includes(m.spinSource) ? m.spinSource : 'auto';
      }
    }
    // Free spins: kept while some are left (or the last one is still spinning).
    const fs = m.freeSpins;
    if (md.freeSpins && fs && typeof fs === 'object') {
      const left = clamp(Math.floor(num(fs.left, 0)), 0, 10000);
      if (left > 0 || clean.spinFree) {
        const total = Math.max(left, Math.floor(num(fs.total, left)));
        clean.freeSpins = { left, total, bet: validBet(fs.bet), won: Math.max(0, num(fs.won, 0)), timer: clamp(num(fs.timer, 0), 0, md.freeSpins.pause) };
      }
    }
    if (clean.spinFree && !clean.freeSpins) clean.spinFree = false;
    // Jackpot pots never drop below their seeds; a wheel that was turning keeps turning.
    if (md.jackpot) {
      const rawPots = m.pots && typeof m.pots === 'object' ? m.pots : {};
      for (const pot of md.jackpot.pots) clean.pots[pot.id] = roundMoney(Math.max(pot.seed, num(rawPots[pot.id], pot.seed)));
      const b = m.bonus;
      if (b && typeof b === 'object' && md.jackpot.pots.some((p) => p.id === b.pot)) {
        clean.bonus = { pot: b.pot, timer: clamp(num(b.timer, 0), 0, md.jackpot.duration), bet: validBet(b.bet) };
      }
    }
    kept.push(clean);
  }
  if (!kept.some((m) => m.typeId === data.machines[0].id)) kept.unshift(newMachineState(data.machines[0]));
  s.machines = kept;
  s.activeMachine = Math.max(0, kept.findIndex((m) => rawActive && m.typeId === rawActive.typeId));

  if (raw.delivery && raw.delivery.active === true) {
    const longest = data.delivery.duration; // tree traits only ever make trips shorter
    s.delivery.active = true;
    s.delivery.duration = clamp(num(raw.delivery.duration, longest), 1 / 60, longest);
    s.delivery.timer = clamp(num(raw.delivery.timer, s.delivery.duration), 0, s.delivery.duration);
  }
  s.autoTimer = Math.max(0, num(raw.autoTimer, 0));
  if (raw.run && typeof raw.run === 'object') {
    for (const key of Object.keys(s.run)) s.run[key] = Math.max(0, num(raw.run[key], 0));
  }

  s.generation = Math.max(1, Math.floor(num(raw.generation, 1)));
  s.seeds = Math.max(0, Math.floor(num(raw.seeds, 0)));
  s.seedsEarned = Math.max(0, Math.floor(num(raw.seedsEarned, 0)));
  s.tree = cleanLevels(raw.tree, (data.familyTree && data.familyTree.nodes) || []);

  s.tokens = Math.max(0, Math.floor(num(raw.tokens, 0)));
  if (raw.diary && typeof raw.diary === 'object') {
    for (const sticker of data.diary || []) if (raw.diary[sticker.id] === true) s.diary[sticker.id] = true;
  }
  // Skins: keep owned skins that still exist; keep an equipped skin only if it's owned.
  const skins = data.skins || [];
  const rawSkins = raw.skins && typeof raw.skins === 'object' ? raw.skins : {};
  for (const skin of skins) {
    if (skin.rarity !== 'starter' && rawSkins.owned && rawSkins.owned[skin.id] === true) s.skins.owned[skin.id] = true;
  }
  for (const cat of data.skinCategories || []) {
    const id = rawSkins.equipped && rawSkins.equipped[cat.id];
    const skin = skins.find((x) => x.id === id && x.category === cat.id);
    if (skin && (skin.rarity === 'starter' || s.skins.owned[id])) s.skins.equipped[cat.id] = id;
  }
  const maxSincePity = data.capsules ? data.capsules.pityPulls - 1 : 0;
  s.capsules.sincePity = clamp(Math.floor(num(raw.capsules && raw.capsules.sincePity, 0)), 0, maxSincePity);

  if (raw.stats && typeof raw.stats === 'object') {
    for (const key of Object.keys(s.stats)) s.stats[key] = Math.max(0, num(raw.stats[key], 0));
  }
  return s;
}
