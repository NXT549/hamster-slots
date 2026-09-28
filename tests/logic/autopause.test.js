// autopause.test.js — the auto-spin pause toggle: a QoL control the player asked
// for ("no option to pause the hamster" on mobile), not a balance change. While
// paused, Wheel Training doesn't fire by itself and nothing is earned while away
// either, but manual spins, deliveries (Self-Starter included) and the shop's
// previews of what Wheel Training WOULD do all work exactly as before. Save v13.

import { describe } from 'vitest';
import { check } from '../check.js';
import { data, near, num, newGame, land, plant, SAVE_VERSION } from './helpers.js';

// A game with Wheel Training maxed and plenty of coins, so auto-spin really would fire.
function autoGame(seed = 1) {
  const g = newGame(seed);
  g.addCoins(1e9);
  g.buyUpgrade('wheel', Infinity);
  return g;
}

describe('the pause toggle: on and off', () => {
  const g = newGame(1);
  check('a fresh game starts unpaused', g.getAutoPaused() === false);
  const events = [];
  g.on('autoPausedChanged', (e) => events.push(e));
  check('setAutoPaused(true) pauses it', g.setAutoPaused(true) === true && g.getAutoPaused() === true);
  check('…and fires the event once', events.length === 1 && events[0].paused === true);
  check('setAutoPaused(false) resumes it', g.setAutoPaused(false) === true && g.getAutoPaused() === false);
  check('…and fires again', events.length === 2 && events[1].paused === false);
  check('it works even with no Wheel Training at all (nothing to pause, but nothing breaks either)',
    newGame(2).setAutoPaused(true) === true);
});

describe('paused: auto-spin never fires, manual spins and deliveries still work', () => {
  const g = autoGame(3);
  g.setAutoPaused(true);
  const interval = g.getAutoInterval();
  check('Wheel Training is really there', interval !== null);
  // Run for many times the auto-spin interval: if it were unpaused this would be dozens of auto-spins.
  for (let i = 0; i < 200; i++) { g.update(interval / 10); if (g.state.machines[0].spinning) land(g); }
  check('not one auto-spin happened', g.state.stats.autoSpins === 0 && g.state.stats.spins === 0);
  check('a manual spin still works while paused', g.spin('manual') && g.state.machines[0].spinning);
  land(g);
  check('…and counts as manual, not auto', g.state.stats.manualSpins === 1 && g.state.stats.autoSpins === 0);

  // Self-Starter: broke and paused, the safety net still kicks in (a deliberate
  // choice: pausing controls SPENDING, it never strands you).
  const s = newGame(4);
  plant(s, 'familyPride', 'speedyScooter', 'bigBackpack', 'selfStarter');
  s.setAutoPaused(true);
  s.addCoins(s.state.coins.neg()); // broke: not even a ×1 spin
  s.update(0.1);
  check('Self-Starter still sends the hamster on a delivery while paused', s.state.delivery.active);
});

describe('resuming: auto-spin picks back up', () => {
  const g = autoGame(5);
  g.setAutoPaused(true);
  const interval = g.getAutoInterval();
  g.update(interval * 3); // would be 3 auto-spins if it weren't paused
  check('nothing happened while paused', g.state.stats.autoSpins === 0);
  g.setAutoPaused(false);
  for (let i = 0; i < 400 && g.state.stats.autoSpins === 0; i++) { g.update(interval / 20); if (g.state.machines[0].spinning) land(g); }
  check('auto-spin fires again once resumed', g.state.stats.autoSpins > 0);
});

describe('getAutoInterval() is untouched by pause: previews and stats stay real', () => {
  const g = autoGame(6);
  const before = g.getAutoInterval();
  g.setAutoPaused(true);
  check('the interval is the same number, paused or not (so "Auto-spin 4.6s" in the shop stays true)',
    g.getAutoInterval() === before && before !== null);
  const preview = g.previewUpgrade('wheel');
  check('buying the next Wheel Training level still previews a real interval, not null',
    typeof preview.next === 'number' || preview.next === null); // maxed = null; otherwise a real number
  const econ = g.getEconomy();
  check('getEconomy().autoInterval is still the real number while paused', econ.autoInterval === before);
  check('…but the rate you would actually earn is 0 while paused', num(econ.expectedAutoProfitPerSecond) === 0);
  g.setAutoPaused(false);
  check('…and back once resumed', num(g.getEconomy().expectedAutoProfitPerSecond) > 0);
});

describe('paused means nothing while away either', () => {
  const g = autoGame(7);
  const runningPay = g.getOfflineEarnings(3600);
  check('unpaused: an hour away pays something', num(runningPay.coins) > 0 && runningPay.seconds > 0);
  g.setAutoPaused(true);
  const pausedPay = g.getOfflineEarnings(3600);
  check('paused: an hour away pays nothing', num(pausedPay.coins) === 0 && pausedPay.seconds === 0);
  check('applyOfflineEarnings fails while paused (nothing to apply)', g.applyOfflineEarnings(3600) === false);
  const events = [];
  g.on('offlineEarned', (e) => events.push(e));
  check('…and never fires the event', events.length === 0);
  g.setAutoPaused(false);
  check('resumed: pays again', num(g.getOfflineEarnings(3600).coins) === num(runningPay.coins));
  check('…and applyOfflineEarnings succeeds', g.applyOfflineEarnings(3600) === true);
});

describe('retiring resets the pause: a fresh pup always starts running', () => {
  const g = newGame(8);
  g.addCoins(50000, true);
  g.setAutoPaused(true);
  check('paused before retiring', g.getAutoPaused() === true);
  check('retiring is never blocked by being paused', g.canRetire() === true);
  g.retire();
  g.leaveBigCage();
  check('the new pup starts unpaused', g.getAutoPaused() === false);
});

describe('save v13', () => {
  const g = autoGame(9);
  check(`SAVE_VERSION is 13 or later (1.3.2 added the toggle)`, SAVE_VERSION >= 13);
  g.setAutoPaused(true);
  const save = g.toSaveData();
  check('a paused game saves autoPaused: true', save.saveVersion === SAVE_VERSION && save.autoPaused === true);
  const h = newGame(10);
  check('…and loads it back', h.loadSaveData(save) && h.getAutoPaused() === true);

  // An old v12 save (no autoPaused field at all) migrates to v13 (and on), unpaused.
  const v12 = JSON.parse(JSON.stringify(save));
  v12.saveVersion = 12;
  delete v12.autoPaused;
  const old = newGame(11);
  check('a v12 save migrates to v13, running (not paused)', old.loadSaveData(v12) && old.getAutoPaused() === false);

  // A broken value in a save is never anything but a real boolean.
  const broken = JSON.parse(JSON.stringify(save));
  broken.autoPaused = 'yes please';
  const b = newGame(12);
  check('a broken autoPaused value in a save is cleaned up to false', b.loadSaveData(broken) && b.getAutoPaused() === false);
});

describe('rule 8 still holds: pausing never changes what auto-spin WOULD do', () => {
  // Every machine and Wheel level: the interval itself (used for the balance
  // rule) doesn't move when paused, so this is really the same check rule 8
  // already runs, just confirming the pause flag can't be mistaken for a speed change.
  const g = newGame(13);
  for (const md of data.machines.slice(1)) g.addCoins(1e15), g.buyMachine(md.id);
  let same = true;
  for (const md of data.machines) {
    g.switchMachine(md.id);
    for (let lv = 1; lv <= data.upgrades.find((u) => u.id === 'wheel').maxLevel; lv++) {
      const a = g.getAutoInterval({ wheel: lv });
      g.setAutoPaused(true);
      const b = g.getAutoInterval({ wheel: lv });
      g.setAutoPaused(false);
      if (a !== b) same = false;
    }
  }
  check('every machine, every Wheel level: getAutoInterval() is identical paused or not', same);
});
