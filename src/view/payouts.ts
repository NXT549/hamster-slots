// payouts.ts — VIEW layer. The Info tab, in four sub-tabs:
//   1) Paytable: what the machine you're running pays, with every bonus applied
//      (and what its scatters do).
//   2) Paylines: its paylines as little grids (lines you haven't unlocked are faded).
//   3) Features: how its bonus features work, with the REAL odds from game.ts
//      (wild, free spins, jackpot pots, the gamble, Hot Streak, bets; M9: ways,
//      hold & spin, the cheese wheel).
//   4) Recent wins: the last few wins, free spins, pots and gambles, newest first.
//      View only: it's not saved, and it starts empty every session.

import { symbolImg, MACHINE_SPRITES, SYMBOL_SPRITES } from './art.ts';
import { formatCoins, iconHTML, setHTML, createSubTabs } from './dom.ts';
import { effectAs } from '../logic/game.ts';
import { mysteryOptions } from '../logic/machine.ts';
import type { Game } from '../logic/game.ts';
import type { PaidWin } from '../logic/types.ts';
import type { Money } from '../logic/money.ts';
import type { Settings } from '../platform/save.ts';

// One row of the Recent wins log.
interface LogEntry {
  machineId: string;
  kind: 'spin' | 'free' | 'pot' | 'gamble' | 'hold';
  payout: Money; // below 0 for a lost gamble
  wins?: PaidWin[];
  tier?: string;
  bet?: number;
  text?: string;
  at: number; // performance.now() when it happened
}

const LOG_SIZE = 10;
const TIER_NAMES: Record<string, string> = { nice: 'Nice', big: 'Big win', jackpot: 'Jackpot' };

// "1 in 76 spins" (or "every spin" for anything that likely).
function oneIn(chance: number): string {
  if (!(chance > 0)) return 'never';
  const n = 1 / chance;
  return n < 1.5 ? 'almost every spin' : `about 1 in ${n < 100 ? Math.round(n) : formatCoins(Math.round(n / 10) * 10)} spins`;
}

export function createPayoutsView(game: Game, { settings, onSettingsChange }: { settings: Settings; onSettingsChange: () => void }) {
  // The element with this id (every id used here is in index.html).
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    log: $('win-log'), table: $('paytable'), lines: $('paylines-legend'), linesNote: $('paylines-note'),
    note: $('paytable-note'), features: $('features'),
  };
  const subtabs = createSubTabs($('info-subtabs'), $('tab-info'), { key: 'info', settings, onSettingsChange });
  const log: LogEntry[] = []; // { machineId, kind, wins?, payout, tier?, text?, at (performance.now()) }
  let logDirty = true;
  let lastLogDraw = 0;
  let tableKey = '';
  let featuresKey = '';
  let unseenWins: boolean | string | undefined = false;

  function addLog(entry: Omit<LogEntry, 'at'>): void {
    log.unshift({ ...entry, at: performance.now() });
    log.length = Math.min(log.length, LOG_SIZE);
    logDirty = true;
    if (subtabs.current !== 'wins') unseenWins = entry.kind !== 'spin' || (entry.tier && entry.tier !== 'win');
  }
  // Free-spin wins are summed up in one line when they end, not logged one by one.
  game.on('spinResolved', (e) => {
    if (e.payout.lte(0) || e.free) return;
    addLog({ machineId: e.machineId, kind: 'spin', wins: e.wins, payout: e.payout, tier: e.tier, bet: e.bet });
  });
  game.on('freeSpinsEnded', (e) => addLog({ machineId: e.machineId, kind: 'free', payout: e.won, text: `${e.spins} free spins` }));
  game.on('jackpotWon', (e) => {
    const md = game.data.machines.find((m) => m.id === e.machineId);
    const pot = md && md.jackpot ? md.jackpot.pots.find((p) => p.id === e.pot) : null;
    addLog({ machineId: e.machineId, kind: 'pot', payout: e.amount, text: `${pot ? pot.name : e.pot} jackpot` });
  });
  game.on('holdEnded', (e) => addLog({ machineId: e.machineId, kind: 'hold', payout: e.amount, text: e.full ? `Hold & spin: every cell, the Grand!` : `Hold & spin: ${e.coins} acorns` }));
  game.on('gambleEnded', (e) => {
    if (!e.started) return;
    addLog({ machineId: e.machineId, kind: 'gamble', payout: e.won, text: e.won.gte(0) ? `Gamble: ${e.rounds} card${e.rounds === 1 ? '' : 's'} right` : 'Gamble lost' });
  });

  // "12s ago", "3 min ago"
  function ago(ms: number): string {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago`;
  }

  function drawLog(now: number): void {
    if (log.length === 0) {
      el.log.innerHTML = '<div class="note">No wins yet this visit. Give the lever a pull!</div>';
      return;
    }
    el.log.replaceChildren(...log.map((entry) => {
      const row = document.createElement('div');
      row.className = `log-row tier-${entry.tier || entry.kind}`;
      const md = game.data.machines.find((m) => m.id === entry.machineId);
      let middle;
      let chip = '';
      if (entry.kind === 'spin') {
        // Each winning line as "symbol ×count" (the icon shows which symbol).
        middle = entry.wins!.map((w) => `<span class="log-line">${iconHTML(SYMBOL_SPRITES[w.symbolId!], 24)}×${w.count}${w.ways ? ` · ${w.ways} ways` : ''}${w.wheel ? ` · 🧀×${w.wheel}` : ''}</span>`).join('');
        if ((entry.bet ?? 1) > 1) middle += `<span class="log-bet">bet ×${entry.bet}</span>`;
        if (TIER_NAMES[entry.tier!]) chip = `<span class="tier-chip tier-${entry.tier}">${TIER_NAMES[entry.tier!]}</span>`;
      } else {
        const icon = ({ free: 'ballIcon', pot: 'pouchPolish', gamble: 'cardBack', hold: 'acornIcon' } as Record<string, string>)[entry.kind];
        middle = `<span class="log-line">${iconHTML(icon, 16)} ${entry.text}</span>`;
        chip = `<span class="tier-chip tier-${entry.kind}">${({ free: 'Free spins', pot: 'Pot', gamble: 'Gamble', hold: 'Hold & spin' } as Record<string, string>)[entry.kind]}</span>`;
      }
      const sign = entry.payout.lt(0) ? '−' : '+';
      row.innerHTML = `<span class="log-machine" title="${md ? md.name : ''}">${iconHTML(MACHINE_SPRITES[entry.machineId], 24)}</span>
        <span class="log-lines">${middle}</span>${chip}
        <span class="log-pay${entry.payout.lt(0) ? ' lost' : ''}">${sign}${formatCoins(entry.payout.abs())}</span><span class="log-ago">${ago(now - entry.at)}</span>`;
      return row;
    }));
  }

  function buildTable() {
    const md = game.getMachineData();
    const symbols = game.getSymbols();
    const reelCount = game.getReelCount();
    const mult = game.getPayoutMultiplier().mul(game.getStarMultiplier()).mul(game.getBet()); // (with this machine's stars)
    const fullLine = game.getFullLineMultiplier();
    // The columns start at the shortest run that pays (2 in a row; 3 on a ways machine).
    const firstK = Math.min(...Object.values(md.payouts).flatMap((t) => Object.keys(t).map(Number)));
    const head = document.createElement('tr');
    head.innerHTML = '<th>Symbol</th><th>Chance</th>';
    for (let k = firstK; k <= md.maxReels; k++) {
      const th = document.createElement('th');
      th.textContent = k > reelCount ? `${k} in a row (locked)` : `${k} in a row`;
      th.classList.toggle('locked', k > reelCount);
      head.appendChild(th);
    }
    const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
    // Every symbol is listed, locked ones too (faded, with the upgrade that unlocks them).
    const rows = symbols.map((s) => {
      const tr = document.createElement('tr');
      const locked = game.isSymbolLocked(s.id);
      tr.classList.toggle('locked-symbol', locked);
      const name = document.createElement('td');
      const inner = document.createElement('div');
      inner.className = 'sym-cell';
      inner.append(symbolImg(s.id, 24), s.name);
      if (s.wild) inner.insertAdjacentHTML('beforeend', ' <span class="feature-chip chip-wild">Wild</span>');
      if (s.scatter) inner.insertAdjacentHTML('beforeend', ' <span class="feature-chip chip-free">Scatter</span>');
      if (s.blank) inner.insertAdjacentHTML('beforeend', ' <span class="feature-chip chip-blank">Blank</span>');
      name.appendChild(inner);
      const chance = document.createElement('td');
      const p = s.weight / totalWeight;
      chance.textContent = s.weight > 0 ? `${p < 0.1 ? (p * 100).toFixed(1) : Math.round(p * 100)}%` : locked ? 'locked' : 'upgrade';
      tr.append(name, chance);
      // 1.4.0: Moving Day's box pays nothing itself: it opens into a symbol first.
      if (md.mystery && md.mystery.symbol === s.id) {
        const td = document.createElement('td');
        td.colSpan = md.maxReels - firstK + 1;
        td.className = 'scatter-note';
        const opens = mysteryOptions({ ...md, symbols }).map((o) => `${(md.symbols.find((x) => x.id === o.symbol) || { name: o.symbol }).name} ${Math.round(o.p * 100)}%`);
        td.textContent = `Every box on the reels opens into the same symbol, then the lines are read: ${opens.join(' · ')}`;
        tr.appendChild(td);
        return tr;
      }
      if (s.blank || locked) {
        // A blank pays nothing; a locked symbol says how to get it (its prizes stay visible, faded).
        if (s.blank) {
          const td = document.createElement('td');
          td.colSpan = md.maxReels - firstK + 1;
          td.className = 'scatter-note';
          td.textContent = 'Never pays: the empty stop on the reels. Luck makes it land less often.';
          tr.appendChild(td);
          return tr;
        }
        const unlock = game.getSymbolUnlock(s.id);
        inner.insertAdjacentHTML('beforeend', ` <span class="feature-chip chip-seeds">Unlock: ${unlock ? unlock.name : 'shop'}</span>`);
      }
      if (s.scatter) {
        // A scatter pays nothing on a line: say what it does instead.
        const td = document.createElement('td');
        td.colSpan = md.maxReels - firstK + 1;
        td.className = 'scatter-note';
        if (md.holdSpin && md.holdSpin.symbol === s.id) {
          td.textContent = `Anywhere on the reels: ${md.holdSpin.trigger}+ start hold & spin (each acorn holds coins)`;
        } else if (md.freeSpins && md.freeSpins.symbol === s.id) {
          const awards = Object.entries(md.freeSpins.awards).map(([k, n]) => `${k}+ → ${n} free spins`).join(' · ');
          td.textContent = `Anywhere on the reels: ${awards} (wins ×${md.freeSpins.multiplier})`;
        } else if (md.jackpot && md.jackpot.symbol === s.id) {
          td.textContent = `Anywhere on the reels: ${md.jackpot.min}+ spin the jackpot wheel`;
        }
        tr.appendChild(td);
        return tr;
      }
      if (md.ways && s.wild) {
        // On a ways machine the wild never lands on reel 1: it only stands in for others.
        const td = document.createElement('td');
        td.colSpan = md.maxReels - firstK + 1;
        td.className = 'scatter-note';
        td.textContent = 'Lands on reels 2 to 5 and stands in for any snack.';
        tr.appendChild(td);
        return tr;
      }
      for (let k = firstK; k <= md.maxReels; k++) {
        const td = document.createElement('td');
        // Jackpot Dance: a line of EVERY reel pays extra (for a locked column: once it unlocks).
        const bonus = k >= reelCount ? fullLine : 1;
        td.textContent = formatCoins(mult.mul(((md.payouts[s.id] || {})[String(k)] || 0) * bonus));
        td.classList.toggle('locked', k > reelCount);
        tr.appendChild(td);
      }
      return tr;
    });
    el.table.replaceChildren(head, ...rows);

    // Paylines: a little grid per line, its cells filled along the line.
    const all = md.paylines || null;
    subtabs.setHidden('paylines', !all);
    if (all) {
      const active = game.getLineCount();
      el.lines.replaceChildren(...all.map((line, index) => {
        const box = document.createElement('div');
        box.className = `line-card line-${index % 10}${index >= active ? ' locked' : ''}`;
        const grid = document.createElement('div');
        grid.className = 'line-grid';
        grid.style.gridTemplateColumns = `repeat(${reelCount}, 1fr)`;
        for (let row = 0; row < (md.rows || 1); row++) {
          for (let reel = 0; reel < reelCount; reel++) {
            const dot = document.createElement('span');
            dot.className = line[reel] === row ? 'on' : '';
            grid.appendChild(dot);
          }
        }
        const label = document.createElement('span');
        label.className = 'line-label';
        label.textContent = index >= active ? `Line ${index + 1} · locked` : `Line ${index + 1}`;
        box.append(grid, label);
        return box;
      }));
      el.linesNote.textContent = `${active} of ${all.length} paylines are active. Every payline is read on its own, ${game.hasBothWays() ? 'from the left and from the right (Pays Both Ways)' : 'left to right'}, and wins on several lines add up. A spin costs the same however many lines you have.`;
    }

    const wild = md.symbols.some((s) => s.wild);
    const luck = game.getLuck().total;
    // Pays Both Ways (an upgrade) also reads every line from the right-hand reel.
    const both = game.hasBothWays();
    const sellsBoth = game.getAvailableUpgrades().some((u) => u.effect.type === 'bothWays');
    if (md.ways) {
      // A ways machine (M9) has no paylines to explain.
      el.note.textContent = `No paylines: a symbol wins when it's on reel 1 and on the reels right after it, on ANY row. Every path through those cells (one per reel) is a way, and every way pays the prize shown, so the wins multiply: ${game.getWays()} ways with ${reelCount} reels.`
        + (wild ? ' The Hamster Wild lands on reels 2 to 5 and stands in for any snack.' : '')
        + ` A Wood Shaving never pays. Prices are per way, and include your payout bonuses and your bet (×${game.getBet()}). "Chance" is how often one cell lands on that symbol${luck > 0 ? `, with your Luck (${luck})` : ''}.`;
      return;
    }
    el.note.textContent = (both
      ? `${all ? 'Every payline is read on its own, from the left AND from the right (Pays Both Ways)' : 'Matches count from the left AND from the right (Pays Both Ways)'}: reels 1 and 2 match, or the last two reels do. A full line still pays once.${all ? ' Wins on several lines add up.' : ' Only the middle row (the payline) counts.'}`
      : (all
        ? 'Every payline is read on its own, left to right: reel 1 and reel 2 must match to win. Wins on several lines add up.'
        : 'Matches count from the left: reel 1 and reel 2 must match to win. Only the middle row (the payline) counts.')
        + (sellsBoth ? ' (The Pays Both Ways upgrade makes matches from the right pay too.)' : ''))
      + ' A Wood Shaving never pays and ends a run.'
      + (wild ? ' The Hamster Wild stands in for any symbol on a line (not scatters or Wood Shavings); a line pays whichever reading is worth more.' : '')
      + (md.wheel ? ' A line of five (every reel) spins the cheese wheel, which multiplies that line.' : '')
      + (md.mystery ? ' Moving Boxes all open into the same symbol before the lines are read, so a few boxes can fill whole lines.' : '')
      + ` Prices include your payout bonuses and your bet (×${game.getBet()}). "Chance" is how often one cell lands on that symbol${luck > 0 ? `, with your Luck (${luck})` : ''}.`;
  }

  // The Features page: every bonus with its real odds, from game.getFeatureOdds().
  function buildFeatures() {
    const md = game.getMachineData();
    const odds = game.getFeatureOdds();
    const card = (icon: string, title: string, body: string) => `<div class="feature-card"><div class="feature-icon">${iconHTML(icon, 32)}</div><div><div class="tile-name">${title}</div><div class="tile-desc">${body}</div></div></div>`;
    const cards: string[] = [];
    const steps = game.getBetSteps();
    // Luck (M7): what the number means, in plain words and this machine's numbers.
    const luck = odds.luck;
    const blank = md.symbols.find((s) => s.blank);
    cards.push(card('clover', `Luck ${luck.total}`,
      `Luck = Hamster Luck ${luck.hamster} (the Four-Leaf Clover, family traits and your hat: every machine) + Machine Luck ${luck.machine} (this machine only). Every symbol except the ${blank ? blank.name : 'blank'} lands ×${(1 + luck.total / 100).toFixed(2)} as often as with no Luck, so you hit more often: a paid spin wins on a line ${Math.round(odds.hitRate * 100)}% of the time here, and wins are worth more on average too.`));
    const info = game.getMachineInfo(md.id)!;
    if (info.symbols.lockable > 0) {
      const unlock = game.getAvailableUpgrades().find((u) => u.effect.type === 'unlockSymbol');
      const names = unlock ? effectAs(unlock, 'unlockSymbol').symbols.map((id) => md.symbols.find((s) => s.id === id)!.name).join(', then the ') : '';
      cards.push(card('seedPacket', `Symbols ${info.symbols.unlocked}/${info.symbols.lockable} unlocked`,
        `${md.name} starts with fewer symbols. ${unlock ? `${unlock.name} adds the ${names}.` : ''} Each new symbol pays much more, but it takes up room on the reels, so wins come a little less often: more Luck makes up for it. (Unlocks reset when your hamster retires.)`));
    }
    cards.push(card('highRollerIcon', `Bet ×${game.getBet()}`,
      `Every spin costs and pays × your bet, so the machine pays back the same share at any bet: bigger bets are just bigger (and riskier). Use − and + next to Spin. You can bet up to ×${steps[game.getMaxBetIndex()]} now (High Roller unlocks up to ×${steps[steps.length - 1]}). Short of coins? A spin steps down to the biggest bet you can afford.`));
    if (md.symbols.some((s) => s.wild)) {
      // The upgrade that brings the wild (Hamster Wild, Maze Runner), if the machine starts without it.
      const wildId = md.symbols.find((s) => s.wild)!.id;
      const wildUp = game.getAvailableUpgrades().find((u) => u.effect.type === 'symbolWeight' && effectAs(u, 'symbolWeight').symbol === wildId);
      cards.push(card('wildIcon', 'Hamster Wild', odds.wild > 0
        ? (md.ways
          ? `Lands on ${(odds.wild * 100).toFixed(1)}% of the cells on reels 2 to 5 (never reel 1, so every win starts with a real snack). It stands in for any snack.`
          : `Lands on ${(odds.wild * 100).toFixed(1)}% of cells. It stands in for any symbol on a payline, and a line of wilds pays the wild's own prize.`)
        : `This machine gets the wild with the ${wildUp ? wildUp.name : 'Hamster Wild'} upgrade.`));
    }
    if (odds.freeSpins) {
      const f = odds.freeSpins;
      cards.push(card('ballIcon', 'Free spins',
        `3 or more Hamster Balls anywhere start free spins: ${oneIn(f.chance)}, ${f.perTrigger.toFixed(1)} spins on average (${f.perTriggerWithRetriggers.toFixed(1)} counting retriggers). They play by themselves, cost nothing, use the bet that won them, and every win is ×${f.multiplier}.`));
    }
    if (odds.jackpot) {
      const pots = game.getJackpotPots();
      const list = odds.jackpot.pots.map((p) => {
        const pot = pots.find((x) => x.id === p.id)!;
        return `<b>${pot.name}</b> ${formatCoins(pot.value)} (${oneIn(p.chance)})`;
      }).join(' · ');
      cards.push(card('pouchPolish', 'Jackpot pots',
        `3 or more Cheek Pouches start the jackpot wheel (${oneIn(odds.jackpot.chance)}). It lands on one pot and pays it all. Every paid spin adds a little to every pot, and a pot starts again from its seed when it's won. Now: ${list}.`));
    }
    // M9: ways, hold & spin, the cheese wheel.
    if (odds.ways) {
      cards.push(card('reel', `${odds.ways} ways`,
        `No paylines on ${md.name}: a symbol wins when it's on reel 1 and on the reels right after it, on any row, and every path through those cells is a way that pays. ${game.getReelCount()} reels of 3 rows: ${odds.ways} ways (the Longer Maze upgrade adds reels: 27, 81, then 243 ways).`));
    }
    if (odds.hold) {
      const h = odds.hold;
      cards.push(card('acornIcon', 'Hold & spin',
        `${h.trigger} or more Golden Acorns anywhere start hold & spin (${oneIn(h.chance)}). The acorns lock in place, each holding coins, and the empty cells respin: ${h.respins} respins, and every new acorn locks too and sets them back to ${h.respins}. On average it ends with ${h.coins.toFixed(1)} acorns after ${h.averageRespins.toFixed(1)} respins. Fill every cell and the Grand pays too (${oneIn(h.full)}).`));
    }
    if (odds.wheel) {
      const wheel = md.wheel!;
      const wedges = wheel.wedges.map((w) => `×${w.multiplier + odds.wheel!.bonus}`).join(', ');
      cards.push(card('cheeseIcon', 'The cheese wheel',
        `A line of five (every reel) spins the cheese wheel, and that line's win is multiplied by the wedge it lands on: ${wedges}. On average ×${odds.wheel.average.toFixed(2)}.${odds.wheel.bonus > 0 ? ` (Aged Cheese adds +${odds.wheel.bonus} to every wedge.)` : ''}`));
    }
    // 1.4.0: Moving Day's boxes: how often one lands, and what they open into.
    if (md.mystery) {
      const reelMd = { ...md, symbols: game.getSymbols() };
      const opens = mysteryOptions(reelMd);
      const total = reelMd.symbols.reduce((sum, s) => sum + s.weight, 0);
      const box = reelMd.symbols.find((s) => s.id === md.mystery!.symbol);
      const cell = box && total > 0 ? box.weight / total : 0;
      const cells = game.getReelCount() * game.getRowCount();
      const any = 1 - Math.pow(1 - cell, cells);
      const list = opens.map((o) => `${(md.symbols.find((x) => x.id === o.symbol) || { name: o.symbol }).name} ${Math.round(o.p * 100)}%`).join(', ');
      cards.push(card('boxIcon', 'Moving Boxes',
        `A box lands on ${(cell * 100).toFixed(1)}% of the cells, so ${Math.round(any * 100)}% of spins have at least one. Before the lines are read, every box on the reels opens into the SAME symbol: ${list}. So the more boxes, the more lines they fill together. (Bubble Wrap and the Moving Boxes trait put more boxes on the reels.)`));
    }
    if (odds.gamble) {
      const gm = odds.gamble;
      cards.push(card('cardBack', 'The card gamble',
        `After a win you pulled yourself, you can gamble it on a face-down card. Pick a colour (red or black): right ${Math.round(gm.color.chance * 100)}% of the time, and the win ×${gm.color.multiplier}. Or pick a suit: right ${Math.round(gm.suit.chance * 100)}% of the time, ×${gm.suit.multiplier}. Wrong: the win is gone. Up to ${gm.maxRounds} wins in a row. Every card is a fresh draw, so the cards shown before tell you nothing: it never pays on average, it's just for the thrill. (Gamble coins don't count toward Heirloom Seeds.)`));
    }
    if (odds.streak.perStack > 0) {
      cards.push(card('flame', 'Hot Streak',
        `Each win in a row adds +${Math.round(odds.streak.perStack * 100)}% to the next win (up to ${odds.streak.cap} in a row). On this machine that's ×${odds.streak.factor.toFixed(2)} on average. Free spins don't count.`));
    } else {
      cards.push(card('flame', 'Hot Streak', 'Buy Hot Streak (a hamster upgrade) and wins in a row pay more and more.'));
    }
    const bothWays = game.getAvailableUpgrades().find((u) => u.effect.type === 'bothWays');
    if (bothWays) {
      const needs = game.getUpgradeNeeds(bothWays.id);
      cards.push(card('bothWaysIcon', game.hasBothWays() ? 'Pays Both Ways' : 'Pays Both Ways (upgrade)', game.hasBothWays()
        ? 'Every payline is read from the left AND from the right, so a match on the last reels pays too. A full line still pays once.'
        : `Wins count from the left: a match on the last reels doesn't pay yet. The ${bothWays.name} upgrade makes them pay too${needs.length > 0 ? ` (it needs the ${needs.join(' and the ')} first)` : ''}.`));
    }
    // Machine Stars (M8)
    const st = game.data.stars;
    cards.push(card('star', `Machine Stars ${info.stars}/${info.maxStars}`,
      `Max every upgrade on ${md.name} and you can rebuild it: its upgrades start again from nothing, and it gets a star it keeps forever (retiring too). Every star: +${Math.round(game.getStarPayout() * 100)}% payouts${game.getStarPayout() > st.payoutPerStar ? ' (with Star Polish)' : ''} and +${st.luckPerStar} Luck on this machine.${info.stars > 0 ? ` Now: ×${game.getStarMultiplier().toFixed(2)} payouts and +${info.stars * st.luckPerStar} Luck.` : ''}`));
    // 1.3.1: Lucky Pennies and the Penny Jar.
    const double = game.getDoubleChance();
    if (double > 0) {
      cards.push(card('pennies', `Lucky Pennies: ${Math.round(double * 100)}%`,
        `A win you pay for has a ${Math.round(double * 100)}% chance to pay double (every line of it). The coin toss doesn't care what the reels show, so on average paid wins pay ×${(1 + double).toFixed(2)}. Free spins don't double.`));
    }
    cards.push(card('coin', odds.ways ? 'Hit rate' : 'Line hit rate', `A paid spin wins ${odds.ways ? 'some ways' : 'on a payline'} ${Math.round(odds.hitRate * 100)}% of the time on this machine.`));
    setHTML(el.features, cards.join(''));
  }

  function render(now: number): void {
    // Rebuild the table only when something it shows changed.
    const weights = game.getSymbols().map((s) => s.weight).join(',');
    const key = `${game.getMachineData().id}|${game.getReelCount()}|${game.getLineCount()}|${game.getPayoutMultiplier()}|${game.getFullLineMultiplier()}|${weights}|${game.getBet()}|${game.hasBothWays()}|${game.getStars()}`;
    if (key !== tableKey) {
      tableKey = key;
      buildTable();
    }
    // Features show live pot values: redraw them about twice a second when showing.
    if (subtabs.current === 'features') {
      const fKey = `${key}|${game.getMaxBetIndex()}|${Math.floor(now / 500)}`;
      if (fKey !== featuresKey) {
        featuresKey = fKey;
        buildFeatures();
      }
    }
    // The log's "12s ago" labels only need a redraw about once a second.
    if (logDirty || now - lastLogDraw > 1000) {
      logDirty = false;
      lastLogDraw = now;
      drawLog(now);
    }
    if (subtabs.current === 'wins') unseenWins = false;
    subtabs.setDot('wins', unseenWins);
  }

  return { render, rebuild: () => { tableKey = ''; featuresKey = ''; }, openSub: subtabs.open };
}
