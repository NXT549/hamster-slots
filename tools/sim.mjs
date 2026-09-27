// sim.mjs — the balance simulator. A headless bot plays the REAL game logic
// (src/logic/game.ts, no page, no browser) and prints how long things take, so balance
// changes can be compared with the targets in DESIGN.md section 10.
//
// Run it from the hamster_slots folder:
//     node tools/sim.mjs                     (idle player, 5 seeds, 7 lives)
//     node tools/sim.mjs --player active     (clicks once a second all the time)
//     node tools/sim.mjs --help              (every option)
//
// It's a bot, not a person: it buys greedily and never gets bored. Treat its
// numbers as "roughly how fast", and trust a real playtest over it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRng } from '../src/logic/rng.ts';
import { createGame } from '../src/logic/game.ts';

const HELP = `node tools/sim.mjs [options]
  --player idle|active   idle: clicks every 1.5 s until Wheel Training, then only auto-spin
                         active: clicks once a second the whole time            (default idle)
  --seeds N              how many RNG seeds to play (results show the median)   (default 5)
  --lives N              lives (retirements) per seed                           (default 7)
  --minutes N            the longest a life may last                            (default 120)
  --retire R             retire once pending seeds >= max(3, R x seeds earned)  (default 0.5)
  --first-minutes N      play the first life for exactly N minutes (no early retire)
  --bankroll N           a bet is only used if you hold N spins' worth of coins (default 40)
  --no-capsules          never open capsules (to measure the game without the M10 wardrobe buffs)
  --casino               spend the casino chips it earns on boosts, best first (M11; it never buys
                         chips or plays a table): the most the casino can speed a life up
  --no-helper            keep the Hamster Helper switched off once Helping Paws is planted (1.3.1),
                         so the bot does all the buying itself
  --plant S              at the Big Cage, plant a trait if it costs at most S x the
                         seeds held (or 1 seed); hold the rest for their bonus   (default 0.25)
  --data FILE            another data.json to try                               (default data.json)
  --verbose              print every purchase`;

// ───────────────────────── Options ─────────────────────────

function parseArgs(argv) {
  const opts = { player: 'idle', seeds: 5, lives: 7, minutes: 120, retire: 0.5, firstMinutes: null, bankroll: 40, plant: 0.25, data: null, verbose: false, capsules: true, casino: false, helper: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
    else if (a === '--player') opts.player = next();
    else if (a === '--seeds') opts.seeds = Number(next());
    else if (a === '--lives') opts.lives = Number(next());
    else if (a === '--minutes') opts.minutes = Number(next());
    else if (a === '--retire') opts.retire = Number(next());
    else if (a === '--first-minutes') opts.firstMinutes = Number(next());
    else if (a === '--bankroll') opts.bankroll = Number(next());
    else if (a === '--plant') opts.plant = Number(next());
    else if (a === '--data') opts.data = next();
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--no-capsules') opts.capsules = false;
    else if (a === '--casino') opts.casino = true;
    else if (a === '--no-helper') opts.helper = false;
    else { console.log(`Unknown option ${a}\n\n${HELP}`); process.exit(1); }
  }
  if (!['idle', 'active'].includes(opts.player)) { console.log('--player must be idle or active'); process.exit(1); }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
// --data may be relative (to the current folder) or absolute (also "C:\…" on Windows).
const dataPath = opts.data ? resolve(opts.data) : new URL('../data.json', import.meta.url);
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

// ───────────────────────── The bot ─────────────────────────

// The game's money (coins, seeds, tokens, prices) is a big number (src/logic/money.ts).
// The bot does its sums with plain numbers: num(x) is x's number.
const num = (x) => (typeof x === 'number' ? x : x.toNumber());

const STEP = 0.25; // seconds of game time between the bot's looks at the game
const hasBets = (g) => typeof g.setBet === 'function';

// A throwaway copy of a game, for "what if I bought this?" questions.
// The save format round-trips the whole player state, so a clone is just a save + load.
function cloneGame(g) {
  const c = createGame(data, createRng(1));
  c.loadSaveData(g.toSaveData());
  return c;
}

// How many spins a second the bot makes on the active machine.
function spinsPerSecond(g) {
  const auto = g.getAutoInterval();
  const clicks = opts.player === 'active' ? 1 : auto === null ? 1 / 1.5 : 0;
  const autoRate = auto === null ? 0 : 1 / auto;
  return Math.min(1 / g.getSpinDuration(), autoRate + clicks);
}

// Expected coins a second on the active machine, at the bet the bot would use.
function income(g) {
  const econ = g.getEconomy();
  // Features (free spins, jackpot wheels) take time too; getEconomy says how much per paid spin.
  const extraTime = econ.extraSecondsPerSpin || 0;
  const rate = spinsPerSecond(g);
  return (num(econ.profitPerSpin) * rate) / (1 + extraTime * rate);
}

// The biggest unlocked bet the bankroll allows (the step-down rule keeps it safe).
function chooseBet(g) {
  if (!hasBets(g)) return;
  const steps = g.getBetSteps();
  let best = 0;
  for (let i = 0; i <= g.getMaxBetIndex(); i++) {
    if (num(g.state.coins) >= opts.bankroll * num(g.getSpinCost()) * steps[i]) best = i;
  }
  if (best !== g.getBetIndex()) g.setBet(best);
}

// Run the owned machine that earns the most, if the bankroll allows a few spins there.
function chooseMachine(g) {
  let bestId = null;
  let bestIncome = -Infinity;
  for (const m of g.state.machines) {
    const c = cloneGame(g);
    c.switchMachine(m.typeId);
    chooseBet(c);
    const enough = num(c.state.coins) >= 10 * num(c.getSpinCost());
    const inc = enough ? income(c) : -1;
    if (inc > bestIncome) { bestIncome = inc; bestId = m.typeId; }
  }
  if (bestId && bestId !== g.state.machines[g.state.activeMachine].typeId) g.switchMachine(bestId);
}

// Every purchase the bot could make next, best first. "Best" = the shortest
// time to afford it plus the time it takes to pay for itself:
//   (coins still missing) ÷ income  +  cost ÷ (income it adds)
// So a cheap good upgrade comes before a huge machine that would take hours to
// save up for, even if the machine earns more per coin. (A bot that only looked
// at income per coin saved for the Burrow Bonanza for hours and bought nothing else.)
// `score` (income gained per coin) is kept for the --verbose report.
function rankPurchases(g) {
  const base = income(g);
  const options = [];
  const consider = (kind, id, cost, apply) => {
    if (!(cost > 0) || !Number.isFinite(cost)) return;
    const c = cloneGame(g);
    c.addCoins(cost); // pretend we can afford it
    if (!apply(c)) return;
    chooseBet(c);
    const gain = income(c) - base;
    if (!(gain > 0)) return;
    const wait = Math.max(0, cost - num(g.state.coins)) / Math.max(base, 0.01);
    options.push({ kind, id, cost, score: gain / cost, time: wait + cost / gain });
  };
  for (const def of g.getAvailableUpgrades()) {
    if (g.isMaxed(def.id)) continue;
    consider('upgrade', def.id, num(g.getUpgradeCost(def.id)), (c) => c.buyUpgrade(def.id));
  }
  for (const md of data.machines) {
    if (g.ownsMachine(md.id)) continue;
    consider('machine', md.id, num(g.getMachineCost(md.id)), (c) => c.buyMachine(md.id));
  }
  return options.sort((a, b) => a.time - b.time);
}

// At the Big Cage (M8), plant or hold. Every seed held adds to payouts (up to the
// seed jar, M9), so planting gives that up. The bot plants a trait (cheapest
// first) when it costs at most --plant × the seeds held (or just 1 seed), and buys
// Family Fortune (a bigger jar) only when it raises the family's bonus. The rest
// is held.
function plantTree(g) {
  const nodes = data.familyTree.nodes;
  const isSink = (n) => n.effect.type === 'seedJar';
  for (;;) {
    const held = num(g.state.seeds);
    const cost = (n) => num(g.getTreeCost(n.id));
    const pick = nodes
      .filter((n) => !isSink(n) && g.canBuyTreeNode(n.id) && cost(n) <= Math.max(1, opts.plant * held))
      .sort((a, b) => cost(a) - cost(b))[0];
    if (pick) { g.buyTreeNode(pick.id); continue; }
    const sink = nodes.find((n) => isSink(n) && g.canBuyTreeNode(n.id));
    const after = sink && num(g.getHeirloomBonusFor(held - cost(sink), { [sink.id]: g.getTreeLevel(sink.id) + 1 }));
    if (sink && after > num(g.getHeirloomBonus()) + 1e-12) { g.buyTreeNode(sink.id); continue; }
    return;
  }
}

// M10: the Wardrobe. The bot opens a capsule whenever it has the tokens, and
// wears the rarest skin it owns in every slot (rarer = a stronger buff).
function dressUp(g) {
  if (!opts.capsules || !data.capsules) return;
  while (g.canPull()) g.pullCapsule();
  const rank = ['starter', ...data.capsules.rarities.map((r) => r.id)];
  for (const cat of data.skinCategories || []) {
    const best = data.skins
      .filter((s) => s.category === cat.id && g.isSkinOwned(s.id))
      .sort((a, b) => rank.indexOf(b.rarity) - rank.indexOf(a.rarity))[0];
    if (best && g.getEquippedSkin(cat.id) !== best.id) g.equipSkin(best.id);
  }
}

// M11: with --casino the bot spends the chips it earns (a chip every few paid spins,
// more when it retires) on the boosts and charms, in data.json's order, whenever one
// fits. It never buys chips with coins and never plays a table.
function useCasino(g) {
  if (!opts.casino || !data.casino) return 0;
  let bought = 0;
  for (const p of data.casino.prizes.filter((x) => x.kind === 'boost' || x.kind === 'charm')) {
    while (g.canBuyPrize(p.id)) { g.buyPrize(p.id); bought++; }
  }
  return bought;
}

// Just before retiring, coins are "use it or lose it" (the new pup starts over),
// so the bot spends them finishing machines, cheapest machine first, and rebuilds
// each finished one for a Machine Star (again and again while the coins last).
function spendOnStars(g) {
  let stars = 0;
  const active = g.state.machines[g.state.activeMachine].typeId;
  for (const { typeId } of [...g.state.machines]) {
    g.switchMachine(typeId);
    for (let i = 0; i < 10; i++) {
      for (const u of g.getAvailableUpgrades().filter((x) => x.scope === 'machine')) g.buyUpgrade(u.id, Infinity);
      if (!(g.canRebuild(typeId) && g.rebuild(typeId))) break;
      stars++;
    }
  }
  g.switchMachine(active);
  return stars;
}

// ───────────────────────── One run (one seed) ─────────────────────────

function playSeed(seed) {
  const g = createGame(data, createRng(seed));
  const lives = [];
  let life = null;
  let t = 0;

  const startLife = () => {
    life = { generation: g.state.generation, start: t, marks: {}, income: {}, luck: {}, hit: {}, seeds: 0, planted: [], freeSpins: 0, pots: 0, holds: 0, stars: 0, held: 0, boosts: 0 };
  };
  const mark = (name) => { if (!(name in life.marks)) life.marks[name] = (t - life.start) / 60; };

  g.on('upgradeBought', (e) => {
    mark(`${e.id}${e.level}`);
    if (e.id === 'thirdReel') mark('thirdReel');
    if (opts.verbose) console.log(`  [seed ${seed} gen ${life.generation} ${((t - life.start) / 60).toFixed(1)} min] ${e.id} Lv ${e.level} for ${Math.round(num(e.cost))}`);
  });
  g.on('machineBought', (e) => {
    mark(`machine:${e.id}`);
    if (opts.verbose) console.log(`  [seed ${seed} gen ${life.generation} ${((t - life.start) / 60).toFixed(1)} min] machine ${e.id} for ${Math.round(num(e.cost))}`);
  });
  g.on('treeNodeBought', (e) => life && life.planted.push(e.id));
  g.on('freeSpinsStarted', () => life.freeSpins++);
  g.on('jackpotWon', () => life.pots++);
  g.on('holdStarted', () => life.holds++); // M9: hold & spin on the Acorn Vault

  startLife();
  let treeDoneAt = null; // hours of play when every finite Family Tree node was planted
  let ranking = null;
  let rankedAt = -Infinity;
  let nextClick = 0;
  let nextMachineCheck = 0;

  while (lives.length < opts.lives) {
    g.update(STEP);
    t += STEP;
    const lifeSeconds = t - life.start;

    // Clicking.
    if (t >= nextClick) {
      const auto = g.getAutoInterval();
      if (opts.player === 'active') { g.spin('manual'); nextClick = t + 1; }
      else if (auto === null) { g.spin('manual'); nextClick = t + 1.5; }
    }

    // Broke? Go on a delivery (unless something is still spinning).
    const m = g.state.machines[g.state.activeMachine];
    if (!g.state.delivery.active && !m.spinning && !g.canAfford(g.getSpinCost())) {
      if (g.state.machines.length > 1 && g.state.activeMachine !== 0) g.switchMachine(g.state.machines[0].typeId);
      else g.startDelivery();
    }

    // Shopping. The ranking only changes when something is bought, so it's cached for a while.
    if (!ranking || t - rankedAt >= 15) {
      ranking = rankPurchases(g);
      rankedAt = t;
      // --verbose also says what the bot is saving up for, every 10 minutes.
      if (opts.verbose && Math.floor(lifeSeconds / 600) !== Math.floor((lifeSeconds - 15) / 600)) {
        const top = ranking.slice(0, 3).map((o) => `${o.id} ${Math.round(o.cost)} (+${(o.score * 1e3).toFixed(3)}/s per 1K)`).join(', ');
        console.log(`  [seed ${seed} gen ${life.generation} ${(lifeSeconds / 60).toFixed(1)} min] ${Math.round(num(g.state.coins))} coins, ${income(g).toFixed(2)}/s, saving for: ${top || 'nothing'}`);
      }
    }
    // The idle player's first goal is to stop clicking: Wheel Training comes first.
    const wantsWheel = opts.player === 'idle' && g.getAutoInterval() === null && g.getAvailableUpgrades().some((u) => u.id === 'wheel');
    const top = wantsWheel ? { kind: 'upgrade', id: 'wheel', cost: num(g.getUpgradeCost('wheel')) } : ranking[0];
    if (top && g.canAfford(top.cost)) {
      const ok = top.kind === 'machine' ? g.buyMachine(top.id) : g.buyUpgrade(top.id);
      if (ok) { ranking = null; nextMachineCheck = 0; }
    }
    if (t >= nextMachineCheck) { chooseMachine(g); chooseBet(g); dressUp(g); life.boosts += useCasino(g); nextMachineCheck = t + 10; }

    // When the Family tab (first seed pending) and the Capsules tab (10 tokens) would appear.
    if (num(g.getPendingSeeds()) >= 1 && num(g.state.seedsEarned) === 0) mark('seed1');
    if (num(g.state.stats.tokensEarned) >= (data.capsules ? data.capsules.pullCost : Infinity)) mark('tokens');

    // Income, Luck and hit-rate snapshots.
    for (const min of [5, 10, 20, 30, 45, 60]) {
      if (!(min in life.income) && lifeSeconds >= min * 60) {
        life.income[min] = income(g);
        const econ = g.getEconomy();
        life.luck[min] = econ.luck ? econ.luck.total : 0;
        life.hit[min] = econ.hitRate;
      }
    }

    // Retire?
    const firstLife = lives.length === 0 && opts.firstMinutes !== null;
    const pending = num(g.getPendingSeeds());
    const wantRetire = firstLife
      ? lifeSeconds >= opts.firstMinutes * 60
      : pending >= Math.max(3, Math.ceil(opts.retire * num(g.state.seedsEarned))) || lifeSeconds >= opts.minutes * 60;
    if (wantRetire && g.canRetire()) {
      life.seeds = pending;
      life.earned = num(g.state.run.coinsEarned);
      life.length = lifeSeconds / 60;
      life.stars = spendOnStars(g);
      lives.push(life);
      g.retire();
      plantTree(g); // (the nodes land in this life's "planted" list: planted after it)
      if (!opts.helper) g.setHelper(false); // --no-helper (1.3.1): does nothing before Helping Paws
      life.held = num(g.state.seeds); // seeds held into the next life
      life.bonus = num(g.getHeirloomBonus());
      life.totalStars = Object.values(g.state.stars).reduce((a, b) => a + b, 0);
      life.skins = Object.keys(g.state.skins.owned).length; // M10: skins found so far
      g.leaveBigCage();
      if (treeDoneAt === null && data.familyTree.nodes.every((n) => n.maxLevel === null || g.isTreeMaxed(n.id))) treeDoneAt = t / 3600;
      startLife();
      ranking = null;
      nextClick = t;
    } else if (wantRetire && lifeSeconds >= (opts.minutes + 30) * 60) {
      // Can't even get one seed in time: give up on this seed.
      life.length = lifeSeconds / 60;
      lives.push(life);
      break;
    }
  }
  return { lives, treeDoneAt };
}

// ───────────────────────── Report ─────────────────────────

const median = (xs) => {
  const v = xs.filter((x) => x !== undefined && x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const range = (xs) => {
  const v = xs.filter((x) => x !== undefined && x !== null && Number.isFinite(x));
  if (!v.length) return '—';
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const f = (x) => x.toFixed(1);
  const missing = xs.length - v.length;
  return `${lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`}${missing ? ` (${missing}×never)` : ''}`;
};
const short = (x) => {
  if (x === null || x === undefined) return '—';
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
  return x.toFixed(1);
};

const started = Date.now();
const seeds = Array.from({ length: opts.seeds }, (_, i) => i + 1);
const results = seeds.map((s) => playSeed(s));
const runs = results.map((r) => r.lives);

console.log(`Hamster Slots balance sim · ${opts.player} player · ${opts.seeds} seeds · retire at max(3, ${opts.retire} × seeds earned), max ${opts.minutes} min a life${opts.casino ? ' · spends casino chips on boosts' : ''}${opts.helper ? '' : ' · Hamster Helper off'}`);
console.log(`(times are minutes into the life; ranges are over seeds; income is the bot's expected coins/s)\n`);

// Which milestones to report: everything that happened in any life, in a sensible order.
const wheelMax = (data.upgrades.find((u) => u.id === 'wheel') || {}).maxLevel;
const firstUnlock = data.upgrades.find((u) => u.effect.type === 'unlockSymbol' && u.machines && u.machines.includes(data.machines[0].id));
const MARKS = [
  ['first buy', (l) => Math.min(...Object.entries(l.marks).filter(([k]) => k !== 'seed1' && k !== 'tokens').map(([, v]) => v))],
  ['Family tab', (l) => l.marks.seed1],
  ['Capsules tab', (l) => l.marks.tokens],
  ['Wheel 1', (l) => l.marks.wheel1],
  ...(firstUnlock ? firstUnlock.effect.symbols.map((sym, i) => [`${sym} unlocked`, (l) => l.marks[`${firstUnlock.id}${i + 1}`]]) : []),
  ['Third Reel', (l) => l.marks.thirdReel],
  [`Wheel ${wheelMax}`, (l) => l.marks[`wheel${wheelMax}`]],
  ...data.machines.slice(1).map((md) => [md.name, (l) => l.marks[`machine:${md.id}`]]),
  ...(data.upgrades.some((u) => u.id === 'highRoller') ? [['Bet ×2', (l) => l.marks.highRoller1], ['Bet ×10', (l) => l.marks.highRoller4]] : []),
  // 1.3.1: the first level of each new upgrade the bot buys (it only buys what raises its income).
  ...['luckyPennies', 'runningShoes', 'couponBook', 'stickerAlbum', 'starPolish', 'megaCheeks', 'moneyBags', 'lineDance', 'blazingStreak', 'hotSauce', 'rabbitsFoot']
    .filter((id) => data.upgrades.some((u) => u.id === id)).map((id) => [data.upgrades.find((u) => u.id === id).name, (l) => l.marks[`${id}1`]]),
  // "Pays Both Ways" on each machine that sells it.
  ...data.upgrades.filter((u) => u.effect.type === 'bothWays').map((u) => [`Both Ways ${(data.machines.find((m) => u.machines && u.machines.includes(m.id)) || { name: u.id }).name}`, (l) => l.marks[`${u.id}1`]]),
];

const maxLives = Math.max(...runs.map((r) => r.length));
for (let i = 0; i < maxLives; i++) {
  const lives = runs.map((r) => r[i]).filter(Boolean);
  const parts = [`Gen ${i + 1}: ${range(lives.map((l) => l.length))} min, +${range(lives.map((l) => l.seeds)).replace(/\.0/g, '')} seeds, earned ${short(median(lives.map((l) => l.earned)))}`];
  for (const [name, fn] of MARKS) {
    const vals = lives.map((l) => { const v = fn(l); return Number.isFinite(v) ? v : null; });
    if (vals.some((v) => v !== null)) parts.push(`${name} ${range(vals)}`);
  }
  const inc = [5, 10, 20, 30, 60].map((min) => `${min}m ${short(median(lives.map((l) => l.income[min])))}`).join(' · ');
  parts.push(`income/s ${inc}`);
  const luckAt = [10, 30, 60].map((min) => {
    const luck = median(lives.map((l) => l.luck[min]));
    const hit = median(lives.map((l) => l.hit[min]));
    return luck === null ? `${min}m —` : `${min}m L${Math.round(luck)} ${Math.round(hit * 100)}%`;
  }).join(' · ');
  parts.push(`Luck/hit ${luckAt}`);
  if (lives.some((l) => l.held || l.totalStars)) {
    parts.push(`held after ${range(lives.map((l) => l.held)).replace(/\.0/g, '')} (+${Math.round(median(lives.map((l) => l.bonus)) * 100)}%) · stars ${range(lives.map((l) => l.totalStars)).replace(/\.0/g, '')}`);
    if (opts.capsules && lives.some((l) => l.skins)) parts.push(`skins found ${range(lives.map((l) => l.skins)).replace(/\.0/g, '')}`);
    if (opts.casino) parts.push(`casino boosts bought ${range(lives.map((l) => l.boosts)).replace(/\.0/g, '')}`);
  }
  if (lives.some((l) => l.freeSpins || l.pots || l.holds)) {
    parts.push(`free-spin triggers ${median(lives.map((l) => l.freeSpins / (l.length / 60)))?.toFixed(1)}/h · pots ${median(lives.map((l) => l.pots / (l.length / 60)))?.toFixed(1)}/h`
      + (lives.some((l) => l.holds) ? ` · hold & spin ${median(lives.map((l) => l.holds / (l.length / 60)))?.toFixed(1)}/h` : ''));
  }
  console.log(parts.join(' | '));
}

const totalHours = runs.map((r) => r.reduce((sum, l) => sum + l.length, 0) / 60);
console.log(`
Played ${runs.map((r) => r.length).join('/')} lives per seed, ${range(totalHours)} hours in total.`);
console.log(`Whole Family Tree planted after: ${range(results.map((r) => r.treeDoneAt))} hours.`);
console.log(`Planted after each life (seed 1): ${runs[0].map((l, i) => `gen ${i + 1}: ${l.planted.join(', ') || '-'}`).join(' | ')}`);
console.log(`Took ${((Date.now() - started) / 1000).toFixed(1)} s.`);
