// album.test.js — 1.10, the Family Album: a page for every hamster that retires (or leads
// a Great Migration mid-life), kept for good; save v16.

import { describe } from 'vitest';
import { check } from '../check.js';
import { createRng, createGame, data, num, money, newGame, deepEqual } from './helpers.js';

const col = data.colony;

// Plant every trait this colony can grow (as colony.test.js does), so the family can migrate.
function completeTree(g) {
  if (!g.state.bigCage) g.openBigCage();
  g.addSeeds(1e7);
  for (let pass = 0; pass < 20; pass++) {
    for (const n of data.familyTree.nodes) {
      if (n.maxLevel === null && g.getTreeLevel(n.id) > 0) continue;
      while (g.canBuyTreeNode(n.id)) g.buyTreeNode(n.id);
    }
  }
  g.addSeeds(g.state.seeds.neg());
}

// Play a little, then retire: a life with coins earned, a best win and some time played.
function liveAndRetire(g, auto = false) {
  if (g.state.bigCage) g.leaveBigCage();
  g.update(5);
  g.addCoins(2e4 * 2 ** g.state.generation, true); // (enough for a new seed every life)
  return g.retire(auto);
}

describe('the Family Album', () => {
  const g = newGame(401);
  check('a new family has an empty album', deepEqual(g.state.album, []));
  g.ownAllSkins();
  g.equipSkin('furCocoa');
  g.equipSkin('hatTop');
  g.update(10);
  g.spin('manual');
  g.update(10);
  g.addCoins(2e4, true);
  const name = g.getPupName();
  const coins = num(g.state.run.coinsEarned);
  const best = num(g.state.run.bestWin);
  const pending = num(g.getPendingSeeds());
  g.retire();
  const p = g.state.album[0];
  check('retiring writes a page: who it was, how long it lived, what it earned and left',
    g.state.album.length === 1 && p.name === name && p.generation === 1 && p.colony === 0
    && p.playTime >= 20 && num(p.coinsEarned) === coins && num(p.bestWin) === best && num(p.seeds) === pending && pending > 0);
  check('… what it wore (for its portrait)', p.fur === 'furCocoa' && p.hat === 'hatTop');
  check('… and how it went (by hand, no trial)', p.how === 'retired' && p.trial === null && p.trialBeaten === false);
  check('the best win is the biggest single payout of the life (and a new life starts at 0)', num(g.state.run.bestWin) === 0 && best <= coins);
  check('the new pup gets the next page', liveAndRetire(g) && g.state.album.length === 2 && g.state.album[1].generation === 2 && g.state.album[1].name !== name);
  check('the Wise Elders\' retirements say so', liveAndRetire(g, true) && g.state.album[2].how === 'elders');
  check('the album emits a page event', (() => {
    const pages = [];
    g.on('albumPage', (e) => pages.push(e.page));
    liveAndRetire(g);
    return pages.length === 1 && pages[0] === g.state.album[3];
  })());
});

describe('the Family Album: trials and the Great Migration', () => {
  const g = newGame(402);
  liveAndRetire(g);
  completeTree(g);
  g.leaveBigCage();
  g.addCoins(1e9, true);
  check('migrating in the middle of a life writes the leader\'s page', g.migrate() && g.state.album.length === 2 && g.state.album[1].how === 'migrated' && g.state.album[1].colony === 0);
  check('the album is kept through a migration (and the first colony\'s pages stay)', g.state.album[0].colony === 0 && g.state.colony === 1);
  completeTree(g);
  check('migrating from the Big Cage (nobody\'s life played) writes no page', g.migrate() && g.state.album.length === 2);

  // Trials (from a colony's 4th hamster).
  g.state.generation = col.trialGeneration;
  g.state.seedsEarned = money(20); // the goal: 5 seeds
  const t = col.trials.find((x) => !x.needs);
  g.startTrial(t.id);
  g.leaveBigCage();
  g.addCoins(6e5, true); // 21 seeds in all: 1 pending, not yet the goal
  g.retire();
  const failed = g.state.album[g.state.album.length - 1];
  check('a trial retired early: on the page, not beaten', failed.trial === t.id && failed.trialBeaten === false && failed.colony === 2);
  g.startTrial(t.id);
  g.leaveBigCage();
  for (let k = 0; k < 60 && g.state.trial; k++) g.addCoins(10 ** (k / 3 + 3), true);
  check('(the trial was beaten)', g.state.trial === null && g.state.run.trialBeaten === t.id);
  g.retire();
  const won = g.state.album[g.state.album.length - 1];
  check('a trial beaten: on the page, beaten', won.trial === t.id && won.trialBeaten === true);
});

describe('the Family Album: how many pages it keeps', () => {
  const small = structuredClone(data);
  small.album = { keep: 5 };
  const g = createGame(small, createRng(403));
  for (let i = 0; i < 9; i++) liveAndRetire(g);
  const gens = g.state.album.map((p) => p.generation);
  check('the newest pages, and always the family\'s first hamster', deepEqual(gens, [1, 6, 7, 8, 9]), JSON.stringify(gens));
});

describe('the Family Album in the save', () => {
  const g = newGame(404);
  g.ownAllSkins();
  g.equipSkin('furMint');
  liveAndRetire(g);
  liveAndRetire(g);
  const save = g.toSaveData();
  check('pages are saved with their amounts as text', save.album.length === 2 && typeof save.album[0].coinsEarned === 'string' && typeof save.album[0].seeds === 'string');
  const h = createGame(structuredClone(data), createRng(1));
  check('a save loads its album back unchanged', h.loadSaveData(structuredClone(save)) && deepEqual(h.toSaveData().album, save.album));
  const broken = structuredClone(save);
  broken.album.push(null, 7, { generation: 3 }); // junk
  broken.album[0].fur = 'furGone'; // a skin that no longer exists
  broken.album[0].trial = 'noSuchTrial';
  broken.album[0].trialBeaten = true;
  broken.album[1].how = 'teleported';
  broken.album[1].seeds = '-5';
  const k = createGame(structuredClone(data), createRng(1));
  check('loading cleans what no longer makes sense (the page stays)', k.loadSaveData(broken) && k.state.album.length === 2
    && k.state.album[0].fur === null && k.state.album[0].trial === null && k.state.album[0].trialBeaten === false
    && k.state.album[1].how === 'retired' && num(k.state.album[1].seeds) === 0);
});
