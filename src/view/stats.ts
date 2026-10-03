// stats.ts — VIEW layer. Menu → Stats: the lifetime stats, in sections.
//
// statSections() is pure (it only reads the game), so the tests can check it in Node;
// renderStats() turns it into rows. Every stat the logic counts (types.ts Stats) should
// show up here somewhere: a counter nobody can see is wasted (tests/stats.test.js checks).
// A section only shows once its part of the game has been reached, so a new player
// isn't shown a wall of zeros about a casino they haven't found yet.

import { formatCoins, formatWhole, formatDuration } from './dom.ts';
import { formatAmount } from './kit.ts';
import type { Game } from '../logic/game.ts';
import { divide } from '../logic/money.ts';

export interface StatSection {
  title: string;
  rows: [label: string, value: string][];
}

const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

export function statSections(game: Game): StatSection[] {
  const s = game.state;
  const st = s.stats;
  const pool = (game.data.skins || []).filter((x) => x.rarity !== 'starter');
  const sections: StatSection[] = [];

  // This life: the hamster you're playing now (state.run resets when it retires).
  const life = s.run.playTime;
  const trial = s.trial ? game.getTrialDef(s.trial) : null;
  sections.push({
    title: `This life: ${game.getPupName()}`,
    rows: [
      ['Generation', String(s.generation)],
      ...(trial ? [['Colony Trial', trial.name] as [string, string]] : []),
      ['Time this life', formatDuration(life)],
      ['Coins earned this life', formatCoins(s.run.coinsEarned)],
      // Under a minute the rate jumps about too much to mean anything.
      ['Coins per minute', life >= 60 ? formatCoins(divide(s.run.coinsEarned.mul(60), life).floor()) : '—'],
    ],
  });

  sections.push({
    title: 'Spins',
    rows: [
      ['Spins', `${count(st.spins)} (${count(st.manualSpins)} by hand, ${count(st.autoSpins)} on the wheel)`],
      ['Wins', `${count(st.wins)} (${st.spins ? Math.round((st.wins / st.spins) * 100) : 0}%)`],
      ['Coins won on spins', formatCoins(st.coinsWon)],
      ['Biggest win', formatCoins(st.biggestWin)],
      ['Biggest bet', st.biggestBet ? `×${st.biggestBet}` : '—'],
      ['Most paylines won at once', String(st.mostLinesWon)],
      ['Best winning streak', String(st.bestStreak)],
      ['Wins paid double (Lucky Pennies)', count(st.doubleWins)],
      ['Golden jackpots', String(st.goldenJackpots)],
    ],
  });

  sections.push({
    title: 'Bonus features',
    rows: [
      ['Wins with a Hamster Wild', count(st.wildWins)],
      ['Free spins', `${count(st.freeSpins)} (started ${st.freeSpinTriggers}×, +${formatCoins(st.freeSpinCoins)})`],
      ['Jackpot pots won', `${st.jackpotsWon} (${st.grandJackpots} Grand)`],
      ['Gambles', `${st.gambleWins} won (${st.suitWins} by suit) · ${st.gambleLosses} lost · best ${st.bestGambleRun} in a row`],
      ['Most ways won by one symbol', st.bestWays ? count(st.bestWays) : '—'],
      ['Hold & spin', `${count(st.holdBonuses)} played · ${plural(st.holdGrands, 'Grand')}`],
      ['Best cheese wheel', st.bestWheel ? `×${st.bestWheel}` : '—'],
    ],
  });

  sections.push({
    title: 'Coins & upgrades',
    rows: [
      ['Coins earned (all lives)', formatCoins(st.coinsEarned)],
      ['… of that while away', formatCoins(st.offlineCoins)],
      ['Coins spent on spins', formatCoins(st.coinsSpent)],
      ['Deliveries', `${count(st.deliveries)} (+${formatCoins(st.deliveryCoins)})`],
      ['Upgrades bought', `${count(st.upgradesBought)}${st.helperBuys ? ` (${count(st.helperBuys)} by the Hamster Helper)` : ''}`],
      ['Machines bought', String(st.machinesBought)],
      ['Symbols unlocked', count(st.symbolsUnlocked)],
      ['Best Luck', String(st.bestLuck)],
    ],
  });

  sections.push({
    title: 'The family',
    rows: [
      ['Time played (all lives)', formatDuration(st.playTime)],
      ['Heirloom Seeds earned', formatWhole(s.seedsEarned)],
      ['Most Heirloom Seeds held', count(st.mostSeedsHeld)],
      ['Family traits planted', String(Object.keys(s.tree).length)],
      ['Machine Stars', `${Object.values(s.stars).reduce((a, b) => a + b, 0)} (${plural(st.rebuilds, 'rebuild')}, best ${st.bestStars} on one machine)`],
      // 1.4.0: The Great Migration
      ...(game.data.colony && (s.colony > 0 || st.migrations > 0) ? [
        ['Colony', `${s.colony + 1} (${plural(st.migrations, 'migration')})`],
        ['Golden Whiskers earned', formatWhole(st.whiskersEarned)],
        ['Colony Trials beaten', count(st.trialsCompleted)],
        ['Retired by the Wise Elders', count(st.autoRetires)],
        ['Moving Boxes opened', `${count(st.mysteryBoxes)} (best ${st.bestBoxes} in one spin)`],
      ] as [string, string][] : []),
    ],
  });

  sections.push({
    title: 'Collection',
    rows: [
      ['Diary stickers', `${Object.keys(s.diary).length} / ${(game.data.diary || []).length}`],
      ['Hamster Tokens earned', formatWhole(st.tokensEarned)],
      ['Capsules opened', count(st.capsulesOpened)],
      ['Skins collected', `${Object.keys(s.skins.owned).length} / ${pool.length}`],
    ],
  });

  // M11: the Hamster Casino, once the family has had chips.
  if (st.casinoGames > 0 || st.chipsEarned.gt(0) || st.chipsBought.gt(0)) {
    sections.push({
      title: 'The Hamster Casino',
      rows: [
        ['Games played', count(st.casinoGames)],
        ['Chips earned', formatAmount('chip', st.chipsEarned)],
        ['Chips bought', formatAmount('chip', st.chipsBought)],
        ['Biggest win', formatAmount('chip', st.biggestCasinoWin)],
        ['Roulette numbers hit', count(st.rouletteNumbers)],
        ['Blackjacks', count(st.blackjacks)],
        ['Derby long shots won', count(st.derbyLongshots)],
        ['Seed Drop edge bins', count(st.seedDropEdges)],
        ['Prizes bought', count(st.prizesBought)],
      ],
    });
  }

  // M12: the Family Casino, once it has opened.
  if (s.ownCasino.opened) {
    sections.push({
      title: 'Your casino',
      rows: [
        ['Cabinets on the floor', count(st.cabinetsBought)],
        ['Tills emptied', count(st.tillsEmptied)],
        ['Takings earned', formatAmount('takings', st.takingsEarned)],
      ],
    });
  }
  return sections;
}

export function renderStats(list: HTMLElement, sections: StatSection[]): void {
  list.replaceChildren(...sections.flatMap(({ title, rows }) => {
    const head = document.createElement('h3');
    head.className = 'stat-head';
    head.textContent = title;
    return [head, ...rows.map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span></span><b></b>';
      row.firstChild!.textContent = label;
      row.lastChild!.textContent = value;
      return row;
    })];
  }));
}
