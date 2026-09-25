// ui.ts — VIEW layer. Draws the game and turns clicks and keys into game actions.
//
// The UI never changes game state directly. It:
//   1) calls actions:      game.spin(), game.startDelivery(), game.switchMachine(id), game.retire() …
//   2) listens to events:  game.on("spinResolved", …) for one-off effects (popups)
//   3) redraws from state: render() runs every frame and reads game.state
// Other tray tabs live in their own files: shop.ts (Upgrades), capsules.ts
// (Capsules), payouts.ts (Info). Skin colours live in skins.ts, the pixel frames
// for the cardboard/paper look are made in theme.ts, and the particles in fx.ts.

import { applySprite, spriteImg, treeIcon, MACHINE_SPRITES, SUIT_SPRITES } from './art.ts';
import { createReels } from './reels.ts';
import { createWinShow } from './winshow.ts';
import { formatCoins, formatWhole, formatSeconds, formatDuration, setText, setHTML, replayClass, iconHTML, setNumberStyle } from './dom.ts';
import { furColors, applyStageSkins } from './skins.ts';
import { createCapsulesView } from './capsules.ts';
import { createBackupView } from './backup.ts';
import { createShopView, describeEffect } from './shop.ts';
import { createPayoutsView } from './payouts.ts';
import { createFx } from './fx.ts';
import { effectAs } from '../logic/game.ts';
import { divide } from '../logic/money.ts';
import type { Money } from '../logic/money.ts';
import type { Sound } from './sound.ts';
import type { BackupActions } from './backup.ts';
import type { Game } from '../logic/game.ts';
import type { Card, MachineState, Named, SpinSource, TreeNodeDef, UpgradeDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';

// The jackpot wheel's four segments, clockwise from the top (the colours are
// theme tokens). The wheel turns so the pot the game already picked ends up
// under the pointer; which pot is decided in game.ts, never here.
const PRIZE_SEGMENTS = ['--soft', '--buy', '--token', '--gold'];

// Win celebrations by tier (the tier comes from game.ts / data.json winTiers).
// coins = how many coins fly to the counter; banner = the big text on the machine.
const WIN_FX: Record<string, { coins: number; sound: string; hop?: boolean; banner?: string; shake?: boolean }> = {
  win: { coins: 0, sound: 'win' },
  nice: { coins: 5, sound: 'nice', hop: true },
  big: { coins: 10, sound: 'big', hop: true, banner: 'Big win!' },
  jackpot: { coins: 24, sound: 'jackpot', hop: true, banner: 'JACKPOT!', shake: true },
};

// The system's own "reduce motion" setting (the Menu's Motion "Auto" follows it).
const systemReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// What the hamster says after buying an upgrade or planting a family trait (by effect type).
const UPGRADE_LINES: Record<string, (level: number, game: Game, def: UpgradeDef) => string> = {
  payoutMultiplier: () => 'Bigger cheeks, bigger wins!',
  autoSpin: (level) => (level === 1 ? "I'll run the wheel for you now!" : 'Faster paws!'),
  spinCostMultiplier: () => 'Smooth as butter. Spins are cheaper!',
  extraReel: (level, game) => `Another reel! ${game.getReelCount()} in a row pays big!`,
  extraPayline: (level, game) => `A new payline! That's ${game.getLineCount()} ways to win.`,
  betSteps: (level, game) => `Bigger coins! I can bet up to ×${game.getBetSteps()[game.getMaxBetIndex()]} now. Tap + next to Spin.`,
  winStreak: () => 'Hot Streak! Win in a row and every win pays more.',
  symbolWeight: () => 'My face is on the reels now! Wilds stand in for any snack.',
  extraFreeSpins: () => 'Bouncier balls: more free spins every time!',
  jackpotGrowth: () => 'Shiny pouches! The jackpot pots grow faster.',
  luck: (level, game) => `Luck ${game.getLuck().total}! Fewer Wood Shavings, more wins.`,
  unlockSymbol: (level, game, def) => {
    const id = effectAs(def, 'unlockSymbol').symbols[level - 1];
    const s = game.getMachineData().symbols.find((x) => x.id === id);
    return `A new symbol on the reels: the ${s ? s.name : id}! Bigger prizes, but wins come a little less often. Luck helps!`;
  },
};
const TREE_LINES: Record<string, (level: number) => string> = {
  payoutMultiplier: () => 'Family pride! Every win pays more.',
  shiftWeight: () => 'My whiskers are tingling. Feeling lucky!',
  fullLineMultiplier: () => 'Line up every reel and watch me dance!',
  startingLevel: () => 'Every new pup gets a head start now!',
  spinSpeed: () => 'Zoom! Quicker paws, quicker spins.',
  deliveryTime: () => 'Vroom! Deliveries are quicker now.',
  deliveryPayoutBonus: () => 'A bigger backpack means bigger deliveries!',
  autoDelivery: () => "Out of coins? I'll head off on a delivery by myself.",
};

// The Menu's segmented settings: [setting key, [value, label] …].
const SETTING_ROWS: Record<string, [keyof Settings, [unknown, string][]]> = {
  'set-motion': ['motion', [['auto', 'Auto'], ['less', 'Less'], ['full', 'Full']]],
  'set-reels': ['quickReels', [[false, 'Scroll'], [true, 'Quick']]],
  'set-numbers': ['numbers', [['short', '47.2K'], ['full', '47,275']]],
};

export function createUI(
  game: Game,
  { onReset, onToggleDebug, sound, settings, onSettingsChange, backup }:
    { onReset: () => void; onToggleDebug: () => void; sound: Sound; settings: Settings; onSettingsChange: () => void; backup: BackupActions },
) {
  // The element with this id (every id used here is in index.html).
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    coinPill: $('coin-pill'), coins: $('coin-count'), coinRate: $('coin-rate'),
    seedPill: $('seed-pill'), seedCount: $('seed-count'),
    menuBtn: $('menu-btn'), menu: $<HTMLDialogElement>('menu'), debugBtn: $('debug-btn'), resetBtn: $('reset-btn'),
    stage: $('stage'), wall: $('wall'), rig: document.querySelector<HTMLElement>('.rig')!, machineTags: $('machine-tags'),
    bubble: $('bubble'), spokes: $('spokes'), hamster: $<HTMLImageElement>('hamster'), belt: $('belt'),
    machine: $('machine'), machineName: $('machine-name'), reels: $('reels'), winLayer: $('win-layer'),
    spinBtn: $<HTMLButtonElement>('spin-btn'), spinTitle: $('spin-title'), spinMeta: $('spin-meta'),
    deliverBtn: $<HTMLButtonElement>('deliver-btn'), deliverMeta: $('deliver-meta'),
    betBox: $('bet-box'), betDown: $<HTMLButtonElement>('bet-down'), betUp: $<HTMLButtonElement>('bet-up'), betAmount: $('bet-amount'), betHint: $('bet-hint'),
    wheel: $('wheel'), prizeFace: $('prize-face'), pots: $('pots'), streakBadge: $('streak-badge'), streakText: $('streak-text'),
    luckBadge: $('luck-badge'), luckText: $('luck-text'),
    winMeter: $('win-meter'), winMeterValue: $('win-meter-value'), lineLabel: $('line-label'),
    gamble: $('gamble'), gambleTitle: $('gamble-title'), gambleNote: $('gamble-note'), gambleTimer: $('gamble-timer'),
    gambleCard: $('gamble-card'), gambleHistory: $('gamble-history'), gambleKeep: $('gamble-keep'),
    gamblePicks: [...document.querySelectorAll<HTMLButtonElement>('#gamble [data-pick]')],
    road: $('road'), roadFill: $('road-fill'), roadHamster: $<HTMLImageElement>('road-hamster'), roadLabel: $('road-label'),
    familyTab: $('family-tab'), pupName: $('pup-name'), pupGen: $('pup-gen'),
    retireGain: $('retire-gain'), seedBarFill: $('seed-bar-fill'), seedNext: $('seed-next'),
    heirloomPerSeed: $('heirloom-per-seed'), retireBtn: $<HTMLButtonElement>('retire-btn'),
    tree: $('tree'), treeDetail: $('tree-detail'),
    capsulesTab: $('capsules-tab'), stageGacha: $('stage-gacha'), tray: document.querySelector<HTMLElement>('.tray')!,
    muteBtn: $('mute-btn'), volume: $<HTMLInputElement>('volume'), statsBtn: $('stats-btn'), backupBtn: $('backup-btn'), stats: $<HTMLDialogElement>('stats'), statsList: $('stats-list'),
    welcome: $<HTMLDialogElement>('welcome'), welcomeText: $('welcome-text'), welcomeCoins: $('welcome-coins'),
  };

  let lastSpinSource: SpinSource = 'manual'; // spins you pulled yourself clunk louder
  let lastManualSpinAt = performance.now(); // for the sleepy "Zzz" hint
  // Every reel clunks as it lands (they stop one at a time), with a puff of dust.
  // Since M7 auto-spin is slow enough that its clunks aren't a buzz: they're just softer.
  const reels = createReels(el.reels, game, {
    onLand: (i) => {
      sound.play('reelStop', i, lastSpinSource !== 'manual');
      const col = reels.reelElement(i);
      if (col) {
        const r = col.getBoundingClientRect();
        fx.dust(r.left + r.width / 2, r.bottom - 6, 4, r.width * 0.3);
      }
    },
    onTease: () => sound.play('anticipation'),
    quick: () => settings.quickReels,
  });
  // The prize wheel: { machineId, pot, turns, start, landedAt } while the jackpot wheel shows.
  let prize: { machineId: string; pot: string; index: number; count: number; turns: number; landedAt: number | null } | null = null;
  let lastTick = -1; // which segment the wheel last "ticked" past (for the clicking sound)
  let nodeEls = new Map<string, HTMLButtonElement>(); // tree node id → its button
  let selectedNode: string | null = null; // which tree node the detail panel shows
  let tagEls = new Map<string, HTMLButtonElement>(); // machine id → its tag on the stage
  let wheelAngle = 0;
  let lastPlayTime = game.state.stats.playTime;
  let shownCoins = game.state.coins; // the counter "rolls" towards the real value
  let lastFrame = performance.now();
  let lastTitle = 0; // when the browser tab title was last updated
  let speech: { text: string; until: number } | null = null; // a temporary line from the hamster: { text, until }
  let resetArmed = 0; // reset needs two taps; this is when the first tap expires
  let retireArmed = 0; // same for retiring
  let rigFitKey = ''; // stage width + machine + reel count the rig was last fitted for

  const lessMotion = () => settings.motion === 'less' || (settings.motion === 'auto' && systemReducedMotion);
  const activeId = () => game.getMachineData().id;
  const fx = createFx($('fx'), { lessMotion });
  // The win show: all winning cells + the WIN meter counting, then one line at a time.
  const winShow = createWinShow({
    game, reels, meter: el.winMeter, meterValue: el.winMeterValue, label: el.lineLabel, reelsEl: el.reels, fx, sound, lessMotion,
  });
  let cardShown: { card: Card; win: boolean; until: number } | null = null; // the gamble card turned face up: { card, win, until } (view only)
  let lastLuck = game.getLuck().total;

  // The Family tab appears once the hamster could retire for its first seed.
  // If it was already unlocked when the page loaded, don't announce it again.
  const familyUnlocked = () => {
    const s = game.state;
    return s.generation > 1 || s.seeds.gt(0) || s.seedsEarned.gt(0) || game.canRetire();
  };
  let familyShown = familyUnlocked();
  let familyNew = false; // shows a dot on the tab until you open it

  // The Capsules tab appears once the family has earned enough tokens for a pull.
  const capsulesUnlocked = () => {
    const s = game.state;
    return !!game.data.capsules && (s.stats.tokensEarned.gte(game.getPullCost()) || s.stats.capsulesOpened > 0 || s.tokens.gte(game.getPullCost()));
  };
  let capsulesShown = capsulesUnlocked();
  let capsulesNew = false;

  // Fill every <img data-sprite="…"> in the HTML with its pixel art. Hamster
  // sprites get the equipped fur colours; call again after a fur change.
  function paintStaticSprites() {
    const fur = furColors(game);
    for (const img of document.querySelectorAll<HTMLImageElement>('img[data-sprite]')) {
      const name = img.dataset.sprite!;
      applySprite(img, name, Number(img.dataset.size || 48), name.startsWith('hamster') ? fur : null);
    }
  }
  // Skins: fur on the sprites, and wheel/machine/room colours on the stage.
  function applySkins() {
    paintStaticSprites();
    applyStageSkins(game, el.stage);
  }
  applySkins();

  // ─────────────────────── small helpers ───────────────────────

  function floatText(text: string, big = false): void {
    const node = document.createElement('div');
    node.className = `float-text${big ? ' big' : ''}`;
    node.textContent = text;
    el.winLayer.appendChild(node);
    node.addEventListener('animationend', () => node.remove());
  }
  function say(text: string, ms = 2600): void {
    speech = { text, until: performance.now() + ms };
  }
  // Coins fly from the machine up into the coin counter (view only, for fun).
  // At most MAX_FLYING at once, so a lucky streak at 50× debug speed can't
  // flood the page with hundreds of coins.
  const MAX_FLYING = 40;
  let flying = 0;
  function coinBurst(want: number, from: HTMLElement = el.machine): void {
    const count = Math.min(want, MAX_FLYING - flying);
    if (lessMotion() || count <= 0) return;
    flying += count;
    const start = from.getBoundingClientRect();
    const target = el.coinPill.querySelector('img')!.getBoundingClientRect();
    const ex = target.left + target.width / 2;
    const ey = target.top + target.height / 2;
    for (let i = 0; i < count; i++) {
      const coin = spriteImg('coin', 24);
      coin.classList.add('burst-coin');
      document.body.appendChild(coin);
      const sx = start.left + start.width / 2 + (Math.random() - 0.5) * 90;
      const sy = start.top + start.height * 0.45;
      const px = sx + (Math.random() - 0.5) * 180; // the top of each coin's arc
      const py = sy - 60 - Math.random() * 90;
      const flight = coin.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(0.5)`, opacity: 0 },
        { transform: `translate(${px}px, ${py}px) scale(1)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${ex}px, ${ey}px) scale(0.7)`, opacity: 1 },
      ], { duration: 650 + Math.random() * 350, delay: i * 35, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'backwards' });
      flight.onfinish = () => {
        coin.remove();
        flying--;
        sound.play('coin');
        replayClass(el.coinPill, 'gain');
      };
    }
  }
  // One banner at a time: a new big win replaces the last banner. With an amount,
  // the number under the words counts up from 0 (a classic pokie "rollup").
  function banner(text: string, cls: string, amount: Money | null = null): void {
    for (const old of el.winLayer.querySelectorAll('.win-banner')) old.remove();
    const node = document.createElement('div');
    node.className = `win-banner ${cls}`;
    node.innerHTML = '<span class="banner-text"></span><span class="banner-amount"></span>';
    node.firstChild!.textContent = text;
    el.winLayer.appendChild(node);
    node.addEventListener('animationend', () => node.remove());
    if (amount === null) {
      node.lastChild!.remove();
      return;
    }
    const start = performance.now();
    const rollup = (now: number) => {
      if (!node.isConnected) return;
      const t = lessMotion() ? 1 : Math.min(1, (now - start) / 800);
      node.lastChild!.textContent = `+${formatCoins(amount.mul(1 - (1 - t) * (1 - t)))}`;
      if (t < 1) requestAnimationFrame(rollup);
    };
    requestAnimationFrame(rollup);
  }
  const seedLabel = (text: string) => `${iconHTML('heirloom')}${text}`;

  // ─────────────────────── building ───────────────────────

  // The family tree, drawn top-down like a real family tree: the first branch in
  // data.json ("Roots") is the top row, every other branch is a column below it.
  //
  //            [Family Pride]──[Family Fortune]
  //        ┌──────────┴──────────┐
  //      Luck       Speed      Delivery
  //       [ ]        [ ]         [ ]
  //       [ ]        [ ]         [ ]
  function buildTree() {
    el.tree.replaceChildren();
    nodeEls = new Map();
    const ft = game.data.familyTree;
    if (!ft) return;
    const [trunkBranch, ...branches] = ft.branches;
    const nodesOn = (branch: Named) => ft.nodes.filter((n) => n.branch === branch.id);

    const makeNode = (def: TreeNodeDef) => {
      const btn = document.createElement('button');
      btn.className = 'node';
      btn.innerHTML = '<span class="node-icon"></span><span class="node-name"></span><span class="node-cost"></span>';
      btn.querySelector('.node-icon')!.appendChild(spriteImg(treeIcon(def), 32, def.name[0]));
      btn.querySelector('.node-name')!.textContent = def.name;
      btn.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        selectedNode = def.id;
      });
      nodeEls.set(def.id, btn);
      return btn;
    };

    // Top row: the root in the middle, extra trunk nodes to its right (then left).
    const trunk = document.createElement('div');
    trunk.className = 'tree-trunk';
    nodesOn(trunkBranch).slice(0, 3).forEach((def, i) => {
      const slot = document.createElement('div');
      slot.className = `tree-slot${i === 1 ? ' side-right' : i === 2 ? ' side-left' : ''}`;
      slot.style.gridColumn = String([2, 3, 1][i]);
      slot.appendChild(makeNode(def));
      trunk.appendChild(slot);
    });
    const fork = document.createElement('div');
    fork.className = 'tree-fork';

    const cols = document.createElement('div');
    cols.className = 'tree-branches';
    for (const branch of branches) {
      const col = document.createElement('div');
      col.className = 'tree-col';
      const head = document.createElement('div');
      head.className = 'tree-branch-name';
      head.textContent = branch.name;
      col.appendChild(head);
      for (const def of nodesOn(branch)) col.appendChild(makeNode(def));
      cols.appendChild(col);
    }
    el.tree.append(trunk, fork, cols);
    if (!selectedNode || !nodeEls.has(selectedNode)) selectedNode = ft.nodes[0] ? ft.nodes[0].id : null;
  }

  // Paper tags hanging on the cage bars, one per machine you own: tap to switch.
  function buildMachineTags() {
    el.machineTags.replaceChildren();
    tagEls = new Map();
    for (const md of game.data.machines) {
      const tag = document.createElement('button');
      tag.className = 'machine-tag';
      tag.title = `Switch to ${md.name}`;
      tag.append(spriteImg(MACHINE_SPRITES[md.id], 24, md.name[0]));
      const name = document.createElement('span');
      name.textContent = md.name;
      tag.appendChild(name);
      tag.addEventListener('click', (e) => {
        (e.currentTarget as HTMLElement).blur();
        game.switchMachine(md.id);
      });
      el.machineTags.appendChild(tag);
      tagEls.set(md.id, tag);
    }
  }

  // Show the machine that's running: its look (data-machine), its reels, its name.
  function showMachine() {
    const md = game.getMachineData();
    el.machine.dataset.machine = md.id;
    el.machine.dataset.rows = String(game.getRowCount());
    setText(el.machineName, md.name);
    winShow.stop(); // a different machine: the last one's win show and meter are gone
    reels.build();
    rigFitKey = ''; // a different machine is a different width
  }

  // The Menu's segmented settings (Motion, Reels, Numbers).
  function buildSettings() {
    for (const [id, [key, options]] of Object.entries(SETTING_ROWS)) {
      $(id).replaceChildren(...options.map(([value, label]) => {
        const b = document.createElement('button');
        b.className = 'seg-btn';
        b.textContent = label;
        b.addEventListener('click', () => {
          (settings as unknown as Record<string, unknown>)[key] = value;
          applySettings();
          onSettingsChange();
        });
        return b;
      }));
    }
  }

  function applySettings() {
    setNumberStyle(settings.numbers);
    document.body.classList.toggle('less-motion', lessMotion());
    for (const [id, [key, options]] of Object.entries(SETTING_ROWS)) {
      [...$(id).children].forEach((b, i) => b.classList.toggle('active', options[i][0] === settings[key]));
    }
    payouts.rebuild(); // the paytable shows numbers too
  }

  // ─────────────────────── game events ───────────────────────

  game.on('spinStarted', (e) => {
    if (e.machineId !== activeId()) return;
    winShow.stop();
    reels.startSpin(e.result);
    el.machine.classList.remove('big-win');
    lastSpinSource = e.source;
    if (e.source === 'manual') {
      lastManualSpinAt = performance.now();
      sound.play('lever');
    }
  });

  // Every win shows "+N"; bigger tiers add a chime, flying coins, a banner,
  // a happy hop, and (for a jackpot) a little shake of the whole cage.
  game.on('spinResolved', (e) => {
    const here = e.machineId === activeId();
    if (here) winShow.start(e); // lights the wins and the feature scatters, and counts the meter up
    if (e.payout.lte(0)) return;
    const tierFx = WIN_FX[e.tier] || WIN_FX.win;
    const big = e.tier !== 'win';
    floatText(`+${formatCoins(e.payout)}`, big);
    if (big) replayClass(el.machine, 'big-win');
    if (e.tier !== 'win' || lastSpinSource === 'manual') sound.play(tierFx.sound); // small auto-spin wins stay quiet
    if (tierFx.banner) banner(tierFx.banner, e.tier, e.payout);
    coinBurst(tierFx.coins);
    if (tierFx.hop && !lessMotion()) replayClass(el.hamster, 'hop');
    if (tierFx.shake && !lessMotion()) replayClass(el.stage, 'shake-stage');
    // Particles: sparkles from every lit cell, more for bigger wins.
    if (here) {
      const per = { win: 2, nice: 6, big: 10, jackpot: 14 }[e.tier] || 2;
      for (const cell of reels.litCells().slice(0, 12)) {
        const lc = getComputedStyle(cell).getPropertyValue('--lc').trim();
        fx.sparkleOver(cell, { count: per, palette: lc ? [lc, '#ffffff', fx.colors.gold[0]] : fx.colors.gold });
      }
    }
    if (e.tier === 'big') fx.confetti(40, el.stage);
    if (e.tier === 'jackpot') {
      fx.confetti(90, el.stage);
      fx.fountain(el.machine, 40);
    }
    // Hot Streak: a rising chime for every win in a row (once it's worth something).
    if (!e.free && e.streak >= 2 && game.getStreakMultiplier() > 1) sound.play('streak', e.streak);
  });

  // Free spins: a banner, a fanfare, and the marquee counts them down.
  game.on('freeSpinsStarted', (e) => {
    if (e.machineId !== activeId()) return;
    winShow.setFeatureText(`${e.retrigger ? '+' : ''}${e.count} free spins!`);
    sound.play('freeSpins');
    banner(e.retrigger ? `+${e.count} FREE SPINS!` : `${e.count} FREE SPINS!`, 'free');
    fx.confetti(50, el.stage);
    fx.burstAt(el.machine, { count: 30, palette: fx.colors.party, speed: 220 });
    if (!lessMotion()) replayClass(el.hamster, 'hop');
    say(e.retrigger ? `More Hamster Balls! +${e.count} free spins!` : `Hamster Balls! ${e.count} free spins, and every win is doubled!`, 3500);
  });
  game.on('freeSpinsEnded', (e) => {
    if (e.machineId !== activeId()) return;
    banner('Free spins won', e.won.gt(0) ? 'big' : 'free', e.won);
    if (e.won.gt(0)) coinBurst(16);
    say(`${e.spins} free spins paid +${formatCoins(e.won)} coins!`, 3500);
  });

  // The jackpot wheel: the hamster wheel turns into a prize wheel (see render()).
  game.on('jackpotStarted', (e) => {
    const pots = (game.data.machines.find((m) => m.id === e.machineId)!.jackpot || { pots: [] }).pots;
    const index = Math.max(0, pots.findIndex((p) => p.id === e.pot));
    prize = { machineId: e.machineId, pot: e.pot, index, count: pots.length, turns: 4 + Math.floor(Math.random() * 2), landedAt: null };
    lastTick = -1;
    if (e.machineId === activeId()) winShow.setFeatureText('The jackpot wheel!');
    sound.play('anticipation');
    say('Three Cheek Pouches! Spin, wheel, spin!', 3500);
  });
  game.on('jackpotWon', (e) => {
    const md = game.data.machines.find((m) => m.id === e.machineId)!;
    const pot = md.jackpot!.pots.find((p) => p.id === e.pot)!;
    if (prize) prize.landedAt = performance.now();
    sound.play('pot');
    banner(`${pot.name.toUpperCase()} JACKPOT!`, 'jackpot', e.amount);
    coinBurst(30);
    fx.fountain(el.wheel, 60);
    fx.confetti(pot === md.jackpot!.pots[md.jackpot!.pots.length - 1] ? 160 : 80);
    if (!lessMotion()) {
      replayClass(el.stage, 'shake-stage');
      replayClass(el.hamster, 'hop');
    }
    say(`The ${pot.name} pot! +${formatCoins(e.amount)} coins!`, 4000);
  });

  // The card gamble: its panel is drawn in render(); here the card turns over,
  // with a sound, a gold burst (right) or a puff of dust (wrong), and a line.
  const suitName = (suit: string) => suit.charAt(0).toUpperCase() + suit.slice(1, -1); // "hearts" → "Heart"
  game.on('gambleResolved', (e) => {
    cardShown = { card: e.card, win: e.win, until: performance.now() + (e.win ? 1100 : 1600) };
    replayClass(el.gambleCard, 'flip');
    sound.play('card');
    const what = `a ${e.card.color} ${suitName(e.card.suit)}`; // "a red Heart"
    if (e.win) {
      sound.play('gambleWin');
      fx.burstAt(el.gambleCard, { count: e.multiplier > 2 ? 30 : 18, palette: fx.colors.gold });
      say(e.round >= game.data.gamble.maxRounds ? `It was ${what}! Kept +${formatCoins(e.next)}.` : `It was ${what}! It's ${formatCoins(e.next)} now. Again, or take it?`, 3000);
    } else {
      sound.play('gambleLose');
      const c = fx.centerOf(el.gambleCard);
      fx.dust(c.x, c.y, 14, 40);
      say(`It was ${what}… Easy come, easy go!`, 3000);
    }
  });

  game.on('spinBlocked', (e) => {
    if (e.source !== 'manual') return;
    sound.play('error');
    replayClass(el.spinBtn, 'shake');
    if (e.reason === 'delivery') {
      say("I'm out delivering, so the machine has no power!");
      return;
    }
    if (e.reason === 'gamble') {
      say('Pick a card, or take your win first!');
      return;
    }
    if (e.reason === 'bonus') {
      say('Wait for the jackpot wheel to stop!');
      return;
    }
    // On a pricey machine, a cheaper one you own is the other way out.
    const cheaper = game.data.machines.find((m) => m.id !== activeId() && game.ownsMachine(m.id)
      && game.getMachineInfo(m.id)!.spinCost.lte(game.state.coins));
    say(cheaper ? `Not enough coins for a spin here. Switch to ${cheaper.name}, or send me on a delivery?`
      : 'Not enough coins for a spin. Send me on a delivery?');
  });

  game.on('coinsChanged', (e) => {
    if (e.amount.gt(0)) replayClass(el.coinPill, 'gain');
  });
  game.on('seedsChanged', (e) => {
    if (e.amount.gt(0)) replayClass(el.seedPill, 'gain');
  });

  game.on('deliveryStarted', (e) => {
    sound.play('deliver');
    say(e.source === 'auto' ? "Out of coins! I'll go on a delivery by myself." : 'Off I scoot through the tube! Back soon.', 2200);
  });
  game.on('deliveryFinished', (e) => {
    sound.play('back');
    say(`Back! Delivery paid +${formatCoins(e.reward)} coins.`);
  });

  game.on('upgradeBought', (e) => {
    const def = game.getUpgradeDef(e.id)!;
    sound.play(def.effect.type === 'unlockSymbol' ? 'unlock' : def.effect.type === 'luck' ? 'luck' : 'buy');
    const line = UPGRADE_LINES[def.effect.type];
    if (line) say(line(e.level, game, def), def.effect.type === 'unlockSymbol' ? 5000 : 2600);
    fx.sparkleOver(shop.elementFor(e.id), { count: 10 + Math.min(20, e.count * 2) });
    // A new symbol on the reels: confetti over the machine.
    if (def.effect.type === 'unlockSymbol') fx.confetti(40, el.machine);
  });

  game.on('machineBought', (e) => {
    sound.play('machine');
    const md = game.data.machines.find((m) => m.id === e.id)!;
    const extra = md.jackpot ? 'Three Cheek Pouches spin the jackpot wheel!'
      : md.freeSpins ? 'Wilds, and three Hamster Balls give free spins!'
        : (md.rows ?? 1) > 1 ? 'Three rows and more paylines: so many ways to win!' : 'Let\'s give it a spin!';
    say(`A brand-new ${md.name}! ${extra}`, 5000);
    fx.confetti(70);
  });
  game.on('machineSwitched', (e) => {
    showMachine();
    if (!lessMotion()) replayClass(el.machine, 'switch-in');
    sound.play('switch');
    if (!speech || performance.now() > speech.until) say(`Over to ${game.getMachineData().name}!`, 1800);
  });

  game.on('treeNodeBought', (e) => {
    sound.play('plant');
    const node = nodeEls.get(e.id);
    if (node) replayClass(node, 'bought');
    const line = TREE_LINES[game.getTreeNodeDef(e.id)!.effect.type];
    if (line) say(line(e.level));
  });

  game.on('retired', (e) => {
    showMachine();
    shownCoins = game.state.coins; // jump, don't roll down from millions
    retireArmed = 0;
    sound.play('retire');
    floatText(`+${formatWhole(e.seedsGained)} Heirloom Seeds`, true);
    say(`Hi, I'm ${e.newName}! ${e.oldName} retired to the Big Cage and left the family ${formatWhole(e.seedsGained)} Heirloom Seeds.`, 6000);
  });

  // Tokens: the hamster mentions them only once the Capsules tab is showing,
  // so a brand-new player isn't told about a currency they can't see yet.
  game.on('stickerEarned', (e) => {
    if (!capsulesShown) return;
    const sticker = game.data.diary.find((d) => d.id === e.id)!;
    sound.play('sticker');
    say(`Diary sticker: ${sticker.name}! +${formatWhole(e.tokens)} Hamster Token${e.tokens.eq(1) ? '' : 's'}.`, 3500);
  });
  game.on('tokensChanged', (e) => {
    if (!capsulesShown) return;
    if (e.source === 'jackpot') say('Golden jackpot! +1 Hamster Token.', 3000);
    if (e.source === 'delivery') say('Back! A customer tipped me a Hamster Token.', 3000);
  });
  game.on('skinEquipped', applySkins);

  // Welcome back: coins the hamster earned while the game was closed or hidden.
  game.on('offlineEarned', (e) => {
    const capped = e.seconds < e.awaySeconds ? ` (it counts up to ${formatDuration(e.seconds)})` : '';
    setText(el.welcomeText, `You were away for ${formatDuration(e.awaySeconds)}. ${game.getPupName()} kept the wheel turning at a gentle pace${capped}.`);
    setHTML(el.welcomeCoins, `${iconHTML('coin', 24)}+${formatCoins(e.coins)}`);
    if (!el.welcome.open) el.welcome.showModal();
  });
  el.welcome.addEventListener('close', () => {
    sound.play('back');
    coinBurst(12, el.coinPill);
  });

  game.on('dataReloaded', () => {
    shop.build();
    buildTree();
    buildMachineTags();
    capsules.build();
    showMachine();
    applySkins();
    payouts.rebuild();
  });
  game.on('stateLoaded', () => {
    showMachine();
    applySkins();
  });

  // ─────────────────────── input ───────────────────────

  el.spinBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    game.spin('manual');
  });
  el.deliverBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    game.startDelivery();
  });

  // The bet: one step up or down. Past the biggest unlocked bet, the hamster
  // points you to High Roller instead.
  function changeBet(step: number): void {
    const next = game.getBetIndex() + step;
    if (step > 0 && next > game.getMaxBetIndex()) {
      sound.play('error');
      const steps = game.getBetSteps();
      say(next < steps.length ? `Buy High Roller (a hamster upgrade) to bet ×${steps[next]}!` : `×${steps[steps.length - 1]} is the biggest bet there is!`);
      return;
    }
    if (game.setBet(next)) sound.play('bet', step > 0);
  }
  el.betDown.addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); changeBet(-1); });
  el.betUp.addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); changeBet(1); });

  // The card gamble: pick a colour or a suit (the buttons say which with data-pick),
  // or take what you have.
  for (const button of el.gamblePicks) {
    button.addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); game.gamble(button.dataset.pick!); });
  }
  el.gambleKeep.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (game.collectGamble()) sound.play('coin');
  });

  // Tabs: show one panel, hide the rest.
  function openTab(name: string): void {
    for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      $(`tab-${tab.dataset.tab}`).classList.toggle('hidden', !active);
    }
    if (name === 'family') familyNew = false;
    if (name === 'capsules') capsulesNew = false;
  }
  for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
    tab.addEventListener('click', () => openTab(tab.dataset.tab!));
  }

  // The little capsule machine standing in the cage opens the Capsules tab.
  el.stageGacha.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    openTab('capsules');
    el.tray.scrollIntoView({ behavior: lessMotion() ? 'auto' : 'smooth', block: 'start' });
  });

  // Retiring needs two taps within 3 s, like Reset: it can't happen by accident.
  el.retireBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (!game.canRetire()) return;
    if (performance.now() < retireArmed) {
      game.retire();
      return;
    }
    retireArmed = performance.now() + 3000;
  });

  // The detail panel's button is redrawn often, so listen on the panel itself
  // ("event delegation") instead of on the button.
  el.treeDetail.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('.buy-btn');
    if (!button || !selectedNode) return;
    button.blur();
    game.buyTreeNode(selectedNode);
  });

  // Menu
  el.menuBtn.addEventListener('click', () => el.menu.showModal());

  // Sound: on/off and volume, saved as settings (not part of the game save).
  function showSound() {
    setText(el.muteBtn, sound.muted ? 'Off' : 'On');
    el.muteBtn.classList.toggle('off', sound.muted);
    el.volume.value = String(Math.round(sound.volume * 100));
  }
  showSound();
  el.muteBtn.addEventListener('click', () => {
    sound.setMuted(!sound.muted);
    showSound();
    onSettingsChange();
    sound.play('buy'); // a little "hello" so you hear it's on
  });
  el.volume.addEventListener('input', () => {
    sound.setVolume(Number(el.volume.value) / 100);
    if (sound.muted) sound.setMuted(false);
    showSound();
    onSettingsChange();
  });
  el.volume.addEventListener('change', () => sound.play('win'));

  // Save backup: the save as a code to copy, or a code to load (backup.ts).
  el.backupBtn.addEventListener('click', () => {
    el.menu.close();
    backupView.open();
  });

  // Stats: a snapshot of the lifetime stats, built when the dialog opens.
  el.statsBtn.addEventListener('click', () => {
    el.menu.close();
    buildStats();
    el.stats.showModal();
  });
  el.debugBtn.addEventListener('click', () => {
    el.menu.close();
    onToggleDebug();
  });
  // Reset asks for a second tap within 3 s instead of a browser pop-up.
  el.resetBtn.addEventListener('click', () => {
    if (performance.now() < resetArmed) {
      onReset();
      return;
    }
    resetArmed = performance.now() + 3000;
  });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('dialog[open]')) return;
    // e.repeat is true when a key is HELD. Ignoring it means you have to tap,
    // so holding Space can't replace the Wheel Training upgrade.
    if (e.code === 'Space') {
      e.preventDefault(); // stop the page from scrolling
      if (!e.repeat) game.spin('manual');
    } else if (e.repeat) {
      // every other key needs a fresh tap too
    } else if (e.code === 'KeyD') {
      game.startDelivery();
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      changeBet(-1);
    } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      changeBet(1);
    } else if (game.getGambleInfo() && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      e.preventDefault();
      game.gamble(e.code === 'ArrowLeft' ? 'red' : 'black');
    } else if (game.getGambleInfo() && /^(Digit|Numpad)[1-4]$/.test(e.code)) {
      // 1–4 = the suit buttons, in the order they're shown.
      const suits = el.gamblePicks.map((b) => b.dataset.pick!).filter((p) => p !== 'red' && p !== 'black');
      game.gamble(suits[Number(e.code.slice(-1)) - 1]);
    } else if (e.code === 'KeyC' && game.collectGamble()) {
      sound.play('coin');
    }
  });

  function buildStats() {
    const s = game.state;
    const st = s.stats;
    const pool = (game.data.skins || []).filter((x) => x.rarity !== 'starter');
    const count = (n: number) => n.toLocaleString('en-US');
    const rows = [
      ['Time played (all lives)', formatDuration(st.playTime)],
      ['Generation', `${s.generation} · ${game.getPupName()}`],
      ['Spins', `${count(st.spins)} (${count(st.manualSpins)} by hand)`],
      ['Wins', `${count(st.wins)} (${st.spins ? Math.round((st.wins / st.spins) * 100) : 0}%)`],
      ['Biggest win', formatCoins(st.biggestWin)],
      ['Biggest bet', st.biggestBet ? `×${st.biggestBet}` : '—'],
      ['Most paylines won at once', String(st.mostLinesWon)],
      ['Best winning streak', String(st.bestStreak)],
      ['Wins with a Hamster Wild', count(st.wildWins)],
      ['Free spins', `${count(st.freeSpins)} (started ${st.freeSpinTriggers}×, +${formatCoins(st.freeSpinCoins)})`],
      ['Jackpot pots won', `${st.jackpotsWon} (${st.grandJackpots} Grand)`],
      ['Gambles', `${st.gambleWins} won (${st.suitWins} by suit) · ${st.gambleLosses} lost · best ${st.bestGambleRun} in a row`],
      ['Symbols unlocked', count(st.symbolsUnlocked)],
      ['Best Luck', String(st.bestLuck)],
      ['Golden jackpots', String(st.goldenJackpots)],
      ['Coins earned (all lives)', formatCoins(st.coinsEarned)],
      ['… of that while away', formatCoins(st.offlineCoins)],
      ['Deliveries', String(st.deliveries)],
      ['Upgrades bought', count(st.upgradesBought)],
      ['Machines bought', String(st.machinesBought)],
      ['Heirloom Seeds earned', String(s.seedsEarned)],
      ['Family traits planted', String(Object.keys(s.tree).length)],
      ['Diary stickers', `${Object.keys(s.diary).length} / ${(game.data.diary || []).length}`],
      ['Capsules opened', String(st.capsulesOpened)],
      ['Skins collected', `${Object.keys(s.skins.owned).length} / ${pool.length}`],
    ];
    el.statsList.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span></span><b></b>';
      row.firstChild!.textContent = label;
      row.lastChild!.textContent = value;
      return row;
    }));
  }

  // ─────────────────────── drawing ───────────────────────

  // Shrink the machine rig (wheel + tube + machine) until it fits the stage.
  // On a phone it's wider than the screen. CSS zoom scales everything inside it;
  // --rig-zoom lets the CSS keep the bubble text readable.
  function fitRig() {
    const pad = getComputedStyle(el.wall);
    const available = el.wall.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    const zoom = Math.min(1, available / el.rig.offsetWidth); // offsetWidth ignores the rig's own zoom
    el.rig.style.zoom = String(zoom);
    el.rig.style.setProperty('--rig-zoom', String(zoom));
  }

  function renderFamily(now: number): void {
    const s = game.state;

    // Unlock the tab the first time a seed is on offer.
    if (!familyShown && familyUnlocked()) {
      familyShown = true;
      familyNew = true;
      say(`I've earned an Heirloom Seed! I could retire and pass it on to a new pup. Peek at the Family tab.`, 6000);
    }
    el.familyTab.classList.toggle('hidden', !familyShown);
    el.seedPill.classList.toggle('hidden', !(s.seeds.gt(0) || s.seedsEarned.gt(0)));
    setText(el.seedCount, formatWhole(s.seeds));
    const anyBuyable = game.data.familyTree && game.data.familyTree.nodes.some((n) => game.canBuyTreeNode(n.id));
    el.familyTab.classList.toggle('alert', familyNew || anyBuyable);
    if (!familyShown) return;

    // Retire card
    const name = game.getPupName();
    setText(el.pupName, name);
    setText(el.pupGen, `Generation ${s.generation} · earned ${formatCoins(s.run.coinsEarned)} this life`);
    const pending = game.getPendingSeeds();
    setHTML(el.retireGain, seedLabel(`+${formatWhole(pending)} Heirloom Seed${pending.eq(1) ? '' : 's'}`));
    const prog = game.getSeedProgress();
    el.seedBarFill.style.width = `${(prog.progress * 100).toFixed(1)}%`;
    setText(el.seedNext, `Family lifetime coins: ${formatCoins(prog.earned)} · next seed at ${formatCoins(prog.nextAt)}`);
    setText(el.heirloomPerSeed, String(Math.round(((game.data.retirement || {}).payoutBonusPerSeedEarned || 0) * 100)));
    el.retireBtn.disabled = !game.canRetire(); // also not while the jackpot wheel turns or a gamble is on
    setText(el.retireBtn, now < retireArmed ? `Tap again to retire ${name}` : 'Retire to the Big Cage');

    // Tree nodes
    for (const [id, btn] of nodeEls) {
      const level = game.getTreeLevel(id);
      const maxed = game.isTreeMaxed(id);
      btn.classList.toggle('owned', level > 0);
      btn.classList.toggle('locked', !game.isTreeNodeUnlocked(id));
      btn.classList.toggle('ready', game.canBuyTreeNode(id));
      btn.classList.toggle('selected', id === selectedNode);
      const costText = maxed ? 'Owned' : level > 0 ? `Lv ${level} · ${seedLabel(formatWhole(game.getTreeCost(id)))}` : seedLabel(formatWhole(game.getTreeCost(id)));
      setHTML(btn.querySelector<HTMLElement>('.node-cost')!, costText);
    }

    // Detail panel for the selected node
    const def = selectedNode && game.getTreeNodeDef(selectedNode);
    if (!def) {
      setHTML(el.treeDetail, '');
      return;
    }
    const level = game.getTreeLevel(def.id);
    const maxed = game.isTreeMaxed(def.id);
    const cost = game.getTreeCost(def.id);
    const unlocked = game.isTreeNodeUnlocked(def.id);
    const affordable = game.canBuyTreeNode(def.id);
    const branch = game.data.familyTree.branches.find((b) => b.id === def.branch);
    const maxText = def.maxLevel ? `Lv ${level}/${def.maxLevel}` : `Lv ${level}`;
    const needs = unlocked ? '' : `<div class="note">Needs ${def.requires.map((r) => game.getTreeNodeDef(r)!.name).join(' + ')} first.</div>`;
    const fill = maxed || affordable || !unlocked ? 0 : Math.min(100, divide(game.state.seeds, cost).toNumber() * 100);
    const buttonClass = maxed ? 'maxed' : affordable ? '' : 'poor';
    const buttonText = maxed ? 'Owned' : unlocked ? seedLabel(`Plant ${formatWhole(cost)}`) : 'Locked';
    setHTML(el.treeDetail, `
      <div class="tile-top">
        <div class="tile-icon">${iconHTML(treeIcon(def) || 'heirloom', 32)}</div>
        <div><div class="tile-name">${def.name}</div><div class="tile-tag">${branch ? branch.name : ''} · ${maxText}</div></div>
      </div>
      <div class="tile-desc">${def.description}</div>
      <div class="tile-effect">${describeEffect(game, def, game.previewTreeNode(def.id))}</div>
      ${needs}
      <button class="buy-btn ${buttonClass}"><span class="buy-fill" style="width:${fill.toFixed(1)}%"></span><span class="buy-label">${buttonText}</span></button>`);
  }

  function renderMachineTags() {
    const owned = game.state.machines.length;
    el.machineTags.classList.toggle('hidden', owned < 2);
    if (owned < 2) return;
    for (const [id, tag] of tagEls) {
      tag.classList.toggle('hidden', !game.ownsMachine(id));
      tag.classList.toggle('active', id === activeId());
    }
  }

  // The bet box next to Spin: the chosen bet, and a hint when a spin will step down.
  function renderBet() {
    const bet = game.getBet();
    const spinBet = game.getSpinBet();
    const max = game.getMaxBetIndex();
    setText(el.betAmount, `×${bet}`);
    el.betDown.disabled = game.getBetIndex() === 0;
    el.betUp.classList.toggle('locked', game.getBetIndex() >= max);
    el.betBox.classList.toggle('stepped', spinBet !== null && spinBet < bet);
    setText(el.betHint, spinBet !== null && spinBet < bet ? `spins ×${spinBet}` : max === 0 ? 'High Roller' : `up to ×${game.getBetSteps()[max]}`);
  }

  // Jackpot pots on the machine's front: live values at your bet.
  function renderPots() {
    const pots = game.getJackpotPots();
    el.pots.classList.toggle('hidden', pots.length === 0);
    if (!pots.length) return;
    if (el.pots.children.length !== pots.length) {
      el.pots.innerHTML = pots.map((p, i) => `<div class="pot pot-${i}"><span class="pot-name">${p.name}</span><span class="pot-value"></span></div>`).join('');
    }
    pots.forEach((p, i) => {
      const node = el.pots.children[i];
      setText(node.lastChild!, formatCoins(p.value));
      node.classList.toggle('lit', !!prize && prize.landedAt !== null && prize.pot === p.id);
    });
  }

  // Luck: a clover badge with the number (Hamster Luck + Machine Luck). When it
  // goes up (a purchase, or switching to a luckier machine) it pops and sparkles.
  function renderLuck() {
    const luck = game.getLuck();
    el.luckBadge.classList.toggle('hidden', luck.total <= 0);
    setText(el.luckText, String(luck.total));
    el.luckBadge.title = `Luck ${luck.total} = Hamster Luck ${luck.hamster} + Machine Luck ${luck.machine}: fewer Wood Shavings, more wins`;
    if (luck.total > lastLuck) {
      replayClass(el.luckBadge, 'up');
      fx.sparkleOver(el.luckBadge, { count: 14, palette: [fx.colors.gold[0], '#ffffff', getComputedStyle(document.documentElement).getPropertyValue('--luck').trim()] });
    }
    lastLuck = luck.total;
  }

  // Hot Streak: "×1.25" with embers that grow with the streak.
  function renderStreak(machine: MachineState, realDt: number): void {
    const mult = game.getStreakMultiplier();
    const show = mult > 1;
    el.streakBadge.classList.toggle('hidden', !show);
    if (!show) return;
    setText(el.streakText, `×${mult.toFixed(2)}`);
    el.streakBadge.classList.toggle('hot', machine.streak >= 3);
    fx.embers(el.streakBadge, Math.min(40, machine.streak * 6), realDt);
  }

  // The card gamble panel: an offer (with a countdown), or a gamble in progress.
  // The card is face down, or turned over for a moment after a pick (cardShown).
  let historyKey = '';
  let cardKey = '';
  function renderGamble(now: number): void {
    const g = game.getGambleInfo();
    const show = !!g && g.machineId === activeId();
    // The last card stays turned over a moment after the gamble ends too (a loss, or the last round).
    const lingering = !show && cardShown && now < cardShown.until;
    el.gamble.classList.toggle('hidden', !show && !lingering);
    if (!show && !lingering) return;
    const num = (n: Money) => `<b class="num">${formatCoins(n)}</b>`; // numbers always in the clean font
    if (show) {
      setHTML(el.gambleTitle, `${g.rounds > 0 ? 'Gamble again?' : 'Gamble your win?'} ${num(g.stake)}`);
      setHTML(el.gambleNote, g.canPick
        ? `Colour → ${num(g.colorWin)} · suit → ${num(g.suitWin)} · ${g.rounds}/${g.maxRounds} wins`
        : 'Not enough coins in your pile to cover this gamble.');
      for (const b of el.gamblePicks) b.disabled = !g.canPick;
      setHTML(el.gambleKeep, g.rounds > 0 ? `Take ${num(g.stake)}` : 'Take win'); // the win is already in your pile
      el.gamble.classList.toggle('started', g.started);
      el.gambleTimer.style.width = g.timeLeft === null ? '0%' : `${Math.max(0, (g.timeLeft / game.data.gamble.offerSeconds) * 100).toFixed(1)}%`;
    } else {
      for (const b of el.gamblePicks) b.disabled = true;
    }
    // The card: face up for a moment after a pick, otherwise face down.
    const faceUp = cardShown && now < cardShown.until ? cardShown : null;
    const key = faceUp ? `${faceUp.card.suit}|${faceUp.win}` : 'back';
    if (key !== cardKey) {
      cardKey = key;
      el.gambleCard.replaceChildren(faceUp ? spriteImg(SUIT_SPRITES[faceUp.card.suit], 36) : spriteImg('cardBack', 64));
      el.gambleCard.classList.toggle('back', !faceUp);
      el.gambleCard.classList.toggle('win', !!faceUp && faceUp.win);
      el.gambleCard.classList.toggle('lose', !!faceUp && !faceUp.win);
      if (!faceUp) replayClass(el.gambleCard, 'flip');
    }
    // The last few cards (every card is a fresh draw, so this is just for fun).
    const history = game.getCardHistory();
    const hKey = history.map((c) => c.suit).join();
    if (hKey !== historyKey) {
      historyKey = hKey;
      el.gambleHistory.replaceChildren(...history.map((c) => {
        const chip = document.createElement('span');
        chip.className = 'mini-card';
        chip.appendChild(spriteImg(SUIT_SPRITES[c.suit], 12));
        return chip;
      }));
    }
  }

  // The prize wheel: the wheel face turns (following the game's bonus progress,
  // so it follows debug speed-ups too) and lands with the chosen pot under the pointer.
  function renderPrize(now: number): void {
    const bonus = prize && prize.machineId === activeId() ? game.getBonusProgress() : null;
    if (prize && bonus === null && (prize.landedAt === null || now - prize.landedAt > 2500)) prize = null;
    el.wheel.classList.toggle('prize', !!prize);
    if (!prize) return;
    const seg = 360 / prize.count;
    const target = prize.turns * 360 + (360 - (prize.index * seg + seg / 2)); // this segment ends at the top
    const t = bonus === null ? 1 : bonus;
    const eased = 1 - Math.pow(1 - t, 3);
    const angle = target * eased;
    el.prizeFace.style.transform = `rotate(${angle}deg)`;
    if (!el.prizeFace.dataset.painted) {
      const css = getComputedStyle(document.documentElement);
      const stops = Array.from({ length: prize.count }, (_, i) => {
        const colour = css.getPropertyValue(PRIZE_SEGMENTS[i % PRIZE_SEGMENTS.length]).trim();
        return `${colour} ${i * seg}deg ${(i + 1) * seg}deg`;
      }).join(', ');
      el.prizeFace.style.background = `repeating-conic-gradient(rgba(74,52,40,0.25) 0 1.5deg, transparent 1.5deg ${seg}deg), conic-gradient(${stops})`;
      el.prizeFace.dataset.painted = '1';
    }
    // A tick each time a segment edge passes the pointer, and sparks off the rim.
    const tick = Math.floor(angle / seg);
    if (tick !== lastTick && t < 1) {
      lastTick = tick;
      sound.play('wheelTick', tick);
      fx.burstAt(el.wheel, { count: 2, palette: fx.colors.gold, speed: 140 });
    }
  }

  function render() {
    const s = game.state;
    const machine = s.machines[s.activeMachine];
    const delivering = s.delivery.active;
    const now = performance.now();
    const realDt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    const gameDt = s.stats.playTime - lastPlayTime; // game time since last frame (follows speed-up)
    lastPlayTime = s.stats.playTime;

    // Coin counter rolls toward the real value instead of jumping. It lands on it
    // once it's within a cent, or (for huge amounts) within a billionth of it.
    const diff = s.coins.sub(shownCoins);
    shownCoins = diff.abs().lt(s.coins.abs().mul(1e-9).max(0.01)) ? s.coins : shownCoins.add(diff.mul(Math.min(1, realDt * 14)));
    setText(el.coins, formatCoins(shownCoins));
    const econ = game.getEconomy();
    setText(el.coinRate, econ.autoInterval ? `+${formatCoins(econ.expectedAutoProfitPerSecond)}/s` : '');
    // Coins in the browser tab's title, so you can peek from another tab (twice a second).
    if (now - lastTitle > 500) {
      lastTitle = now;
      const title = `${formatCoins(s.coins)} coins · Hamster Slots`;
      if (document.title !== title) document.title = title;
    }

    // Machine + reels
    if (el.machine.dataset.machine !== game.getMachineData().id) showMachine();
    reels.render();
    const fitKey = `${el.stage.clientWidth}|${el.machine.dataset.machine}|${game.getReelCount()}`;
    if (fitKey !== rigFitKey) {
      rigFitKey = fitKey;
      fitRig();
    }
    el.machine.classList.toggle('spinning', machine.spinning);
    el.machine.classList.toggle('pulled', machine.spinning && game.getSpinProgress() < 0.3);
    renderMachineTags();

    // Spin + deliver buttons. During free spins, Spin just counts them down.
    const free = game.getFreeSpins();
    const spinBet = game.getSpinBet();
    const gambling = !!s.gamble && s.gamble.started;
    const busy = machine.spinning || !!machine.bonus || gambling || (!!free && free.left > 0);
    if (free) {
      setText(el.spinTitle, 'Free');
      setHTML(el.spinMeta, `${free.left} left · ×${free.bet}`);
    } else {
      setText(el.spinTitle, machine.bonus ? 'Jackpot!' : 'Spin');
      setHTML(el.spinMeta, `${iconHTML('coin', 24)} ${formatCoins(game.getBetCost(spinBet || game.getBet()))}`);
    }
    // Not disabled while a normal spin runs: a click then queues the next spin.
    el.spinBtn.disabled = busy && !machine.spinning;
    el.spinBtn.classList.toggle('busy', machine.spinning);
    el.spinBtn.classList.toggle('free', !!free);
    el.spinBtn.classList.toggle('poor', !free && (delivering || spinBet === null));
    renderBet();
    const reward = formatCoins(game.getDeliveryReward());
    const trip = formatSeconds(game.getDeliveryDuration());
    el.deliverBtn.disabled = delivering;
    setText(el.deliverMeta, delivering ? `back in ${Math.ceil(s.delivery.timer)}s` : `+${reward} · ${trip}`);

    // The machine's own extras: free-spin mode on the marquee, pots, streak, gamble.
    el.machine.classList.toggle('free-spins', !!free);
    setText(el.machineName, free ? `Free spins ${free.played}/${free.total} · +${formatCoins(free.won)}` : game.getMachineData().name);
    renderPots();
    renderLuck();
    renderStreak(machine, realDt);
    renderGamble(now);
    renderPrize(now);
    winShow.render(now);

    // Wheel: fast during a spin, steady with auto-spin, still when resting.
    // Rotation uses GAME time, so it speeds up with the debug speed buttons.
    const interval = game.getAutoInterval();
    const speed = delivering ? 0 : machine.spinning || machine.bonus ? 540 : interval || free ? 90 : 0; // degrees per second
    wheelAngle = (wheelAngle + speed * Math.max(0, gameDt)) % 360;
    el.spokes.style.transform = `rotate(${wheelAngle}deg)`;
    el.belt.style.backgroundPositionX = `${(wheelAngle * 0.6) % 16}px`;
    // Particles: bedding dust kicked up by a fast wheel, and motes drifting in the cage.
    if (speed >= 540 && Math.random() < realDt * 6) {
      const r = el.wheel.getBoundingClientRect();
      fx.dust(r.left + r.width / 2, r.bottom + 30, 3, r.width * 0.3);
    }
    fx.motes(el.wall, 0.8, realDt);
    fx.frame(realDt);

    // Hamster: two-frame run cycle (real time, purely visual).
    const frame = speed > 0 || delivering ? (Math.floor(now / 110) % 2 ? 'hamster2' : 'hamster') : 'hamster';
    const fur = furColors(game);
    applySprite(el.hamster, frame, 48, fur);
    el.hamster.classList.toggle('away', delivering);

    // Delivery tube
    const p = game.getDeliveryProgress();
    el.road.classList.toggle('active', delivering);
    el.roadFill.style.width = `${(p * 100).toFixed(1)}%`;
    el.roadHamster.style.left = `calc(10px + (100% - 44px) * ${p.toFixed(4)})`; // the tube's margins + the 24px sprite
    applySprite(el.roadHamster, frame, 24, fur);
    setText(el.roadLabel, delivering
      ? `Delivering… back in ${Math.ceil(s.delivery.timer)}s`
      : `Delivery tube · ${trip} trip → +${reward} coins`);

    // Speech bubble: a fresh line if there is one, otherwise the most useful hint.
    let hint = '';
    if (speech && now < speech.until) hint = speech.text;
    else if (delivering) hint = `Out delivering! No power to the machine for ${Math.ceil(s.delivery.timer)}s.`;
    else if (machine.bonus) hint = 'Round and round it goes… where it stops, nobody knows!';
    else if (free && free.left > 0) hint = `Free spins! ${free.left} to go, and every win is doubled.`;
    else if (s.gamble && s.gamble.machineId === activeId()) hint = 'Feeling lucky? Guess the card: a colour doubles it, a suit makes it ×4!';
    else if (!machine.spinning && spinBet === null) hint = 'Out of coins! Send me on a delivery (D).';
    else if (s.stats.spins === 0) hint = `Hi, I'm ${game.getPupName()}! Tap SPIN (or Space). Match symbols from the left to win!`;
    else if (!interval && !machine.spinning && now - lastManualSpinAt > 25000) hint = 'Zzz… (tap Spin to wake me up)';
    setText(el.bubble, hint);
    el.bubble.classList.toggle('hidden', hint === '');

    // Reset button text (two-tap confirm)
    setText(el.resetBtn, now < resetArmed ? 'Tap again to wipe everything' : 'Reset progress');

    shop.render();
    payouts.render(now);
    renderFamily(now);
    renderCapsules(now);
  }

  function renderCapsules(now: number): void {
    if (!capsulesShown && capsulesUnlocked()) {
      capsulesShown = true;
      capsulesNew = true;
      say(`My Hamster Diary earned me ${formatWhole(game.state.tokens)} Hamster Tokens! Let's try the Capsule Machine.`, 6000);
    }
    el.capsulesTab.classList.toggle('hidden', !capsulesShown);
    el.stageGacha.classList.toggle('hidden', !capsulesShown);
    el.capsulesTab.classList.toggle('alert', capsulesNew || game.canPull());
    el.stageGacha.classList.toggle('ready', game.canPull());
    if (capsulesShown) capsules.render(now);
  }

  const capsules = createCapsulesView(game, { say, sound, settings, onSettingsChange });
  const backupView = createBackupView(game, backup);
  const shop = createShopView(game, { settings, onSettingsChange });
  const payouts = createPayoutsView(game, { settings, onSettingsChange });
  buildTree();
  buildMachineTags();
  buildSettings();
  applySettings();
  showMachine();
  return { render };
}
