// ui.ts — VIEW layer. Draws the game and turns clicks and keys into game actions.
//
// The UI never changes game state directly. It:
//   1) calls actions:      game.spin(), game.startDelivery(), game.switchMachine(id), game.retire() …
//   2) listens to events:  game.on("spinResolved", …) for one-off effects (popups)
//   3) redraws from state: render() runs every frame and reads game.state
// Other tray tabs live in their own files: shop.ts (Upgrades), capsules.ts
// (Capsules), payouts.ts (Info). Skin colours live in skins.ts, the pixel frames
// for the cardboard/paper look are made in theme.ts, and the particles in fx.ts.

import { applySprite, spriteImg, treeIcon, hamsterSprite, MACHINE_SPRITES, SUIT_SPRITES } from './art.ts';
import { createReels } from './reels.ts';
import { createWinShow } from './winshow.ts';
import { formatCoins, formatWhole, formatSeconds, formatDuration, setText, setHTML, replayClass, iconHTML, setNumberStyle, popText } from './dom.ts';
import { furColors, applyStageSkins, hatOf } from './skins.ts';
import { createCapsulesView } from './capsules.ts';
import { createCasinoView } from './casino.ts';
import { createBackupView } from './backup.ts';
import { createShopView } from './shop.ts';
import { createBigCage } from './bigcage.ts';
import { createColonyView } from './colony.ts';
import { createPayoutsView } from './payouts.ts';
import { createFx } from './fx.ts';
import { createCelebration, createIris, IRIS_MS } from './celebrate.ts';
import { effectAs } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import type { Sound } from './sound.ts';
import type { BackupActions } from './backup.ts';
import type { Game } from '../logic/game.ts';
import type { Card, GameEvents, MachineState, SpinSource, UpgradeDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';

// The jackpot wheel's four segments, clockwise from the top (the colours are
// theme tokens). The wheel turns so the pot the game already picked ends up
// under the pointer; which pot is decided in game.ts, never here.
const PRIZE_SEGMENTS = ['--soft', '--buy', '--token', '--gold'];
// The cheese wheel's wedges (M9): cheese yellows, and the rind.
const CHEESE_SEGMENTS = ['--cheese', '--cheese-dark', '--cheese-light', '--cheese-rind'];

// Win celebrations by tier (the tier comes from game.ts / data.json winTiers).
// coins = how many coins fly to the counter; titles = the big celebration over
// the cage (celebrate.ts), climbing from the first to the last as the win counts up.
const WIN_FX: Record<string, { coins: number; sound: string; hop?: boolean; titles?: string[]; shake?: boolean }> = {
  win: { coins: 0, sound: 'win' },
  nice: { coins: 5, sound: 'nice', hop: true },
  big: { coins: 10, sound: 'big', hop: true, titles: ['BIG WIN!'] },
  jackpot: { coins: 24, sound: 'jackpot', hop: true, titles: ['BIG WIN!', 'HUGE WIN!', 'JACKPOT!'], shake: true },
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
  winStreak: (level, game, def) => (def.id === 'hotStreak' ? 'Hot Streak! Win in a row and every win pays more.'
    : `Hot sauce! Wins in a row can pay up to ×${game.getMaxStreakMultiplier().toFixed(2)} now.`),
  symbolWeight: () => 'My face is on the reels now! Wilds stand in for any snack.',
  extraFreeSpins: () => 'Bouncier balls: more free spins every time!',
  jackpotGrowth: () => 'Shiny pouches! The jackpot pots grow faster.',
  bothWays: () => 'Pays both ways! Matches on the right-hand reels count now too.',
  extraRespins: (level, game) => `Sticky paws! Hold & spin starts with ${game.getHoldRespins()} respins now.`,
  wheelBonus: (level, game) => `Aged to perfection! The cheese wheel averages ×${game.getWheelAverage().toFixed(1)} now.`,
  luck: (level, game) => `Luck ${game.getLuck().total}! Fewer Wood Shavings, more wins.`,
  unlockSymbol: (level, game, def) => {
    const id = effectAs(def, 'unlockSymbol').symbols[level - 1];
    const s = game.getMachineData().symbols.find((x) => x.id === id);
    return `A new symbol on the reels: the ${s ? s.name : id}! Bigger prizes, but wins come a little less often. Luck helps!`;
  },
  // 1.3.1
  doubleWin: (level, game) => `Lucky pennies! ${Math.round(game.getDoubleChance() * 100)}% of my wins pay double now.`,
  offlineBonus: () => "Night shift! I'll earn more while you're away.",
  offlineTime: (level, game) => `A cosy nest! I'll keep running for up to ${formatDuration(game.getOfflineCap())} while you're away.`,
  spinSpeed: () => 'New running shoes! Every spin is a little quicker.',
  stickerPayout: (level, game) => `My sticker album! ${game.countStickers()} stickers, and every one makes my wins bigger.`,
  starPayout: (level, game) => `Polished! Every Machine Star adds +${Math.round(game.getStarPayout() * 100)}% now.`,
  streakCap: (level, game) => `Blazing! Wins in a row can pay up to ×${game.getMaxStreakMultiplier().toFixed(2)} now.`,
  fullLineMultiplier: (level, game) => `Line dance! Full lines pay ×${game.getFullLineMultiplier().toFixed(2)}.`,
  jackpotTokens: (level, game) => `Golden touch! A golden jackpot gives ${game.getJackpotTokens()} Hamster Tokens now.`,
  deliveryTokens: () => 'A tip jar! Customers tip a Hamster Token every 3rd delivery now.',
  gambleHistory: () => 'Card counter: I can see more of the cards that came before. Every card is still a fresh draw!',
  potSeedBonus: () => 'Deep pockets! The jackpot pots start bigger.',
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
  // M8
  seedJar: () => 'A bigger seed jar! Our held seeds can pay more now.',
  luck: () => 'A lucky family! More Luck on every machine.',
  startingMachineLevel: () => 'Every machine will start with a head start!',
  startingMachine: () => 'We keep the Snack Stacker! Every pup starts with it.',
  symbolWeight: () => 'The ball pit is full: more Hamster Balls on the Bonanza!',
  potSeedBonus: () => 'Golden pouches: the jackpot pots start bigger!',
  // 1.3.1
  autoBuy: () => 'A little helper! It buys cheap upgrades for us. (Switch it on or off in Upgrades.)',
  generationPayout: () => 'Deep roots! The older our family grows, the more we win.',
  doubleWin: () => 'The family penny jar: some wins pay double!',
};

// The Menu's segmented settings: [setting key, [value, label] …].
const SETTING_ROWS: Record<string, [keyof Settings, [unknown, string][]]> = {
  'set-motion': ['motion', [['auto', 'Auto'], ['less', 'Less'], ['full', 'Full']]],
  'set-reels': ['quickReels', [[false, 'Scroll'], [true, 'Quick']]],
  'set-numbers': ['numbers', [['short', '47.2K'], ['full', '47,275']]],
};

export function createUI(
  game: Game,
  { onReset, onToggleDebug, sound, settings, onSettingsChange, backup, version }:
    { onReset: () => void; onToggleDebug: (() => void) | null; sound: Sound; settings: Settings; onSettingsChange: () => void; backup: BackupActions; version: string },
) {
  // The element with this id (every id used here is in index.html).
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    coinPill: $('coin-pill'), coins: $('coin-count'), coinRate: $('coin-rate'),
    seedPill: $('seed-pill'), seedCount: $('seed-count'),
    whiskerPill: $('whisker-pill'), whiskerCount: $('whisker-count'), trialBadge: $('trial-badge'), familyPanel: $('tab-family'),
    menuBtn: $('menu-btn'), menu: $<HTMLDialogElement>('menu'), debugBtn: $('debug-btn'), debugKey: $('debug-key'), resetBtn: $('reset-btn'),
    stage: $('stage'), wall: $('wall'), rig: document.querySelector<HTMLElement>('.rig')!, machineTags: $('machine-tags'),
    bubble: $('bubble'), spokes: $('spokes'), hamster: $<HTMLImageElement>('hamster'), belt: $('belt'),
    machine: $('machine'), machineName: $('machine-name'), reels: $('reels'), winLayer: $('win-layer'),
    spinBtn: $<HTMLButtonElement>('spin-btn'), spinTitle: $('spin-title'), spinMeta: $('spin-meta'),
    deliverBtn: $<HTMLButtonElement>('deliver-btn'), deliverMeta: $('deliver-meta'), autoBtn: $<HTMLButtonElement>('auto-btn'),
    betBox: $('bet-box'), betDown: $<HTMLButtonElement>('bet-down'), betUp: $<HTMLButtonElement>('bet-up'), betAmount: $('bet-amount'), betHint: $('bet-hint'),
    wheel: $('wheel'), prizeFace: $('prize-face'), pots: $('pots'), streakBadge: $('streak-badge'), streakText: $('streak-text'),
    luckBadge: $('luck-badge'), luckText: $('luck-text'),
    winMeter: $('win-meter'), winMeterValue: $('win-meter-value'), lineLabel: $('line-label'), holdBoard: $('hold-board'),
    gamble: $('gamble'), gambleTitle: $('gamble-title'), gambleNote: $('gamble-note'), gambleTimer: $('gamble-timer'),
    gambleCard: $('gamble-card'), gambleHistory: $('gamble-history'), gambleKeep: $('gamble-keep'),
    gamblePicks: [...document.querySelectorAll<HTMLButtonElement>('#gamble [data-pick]')],
    road: $('road'), roadFill: $('road-fill'), roadHamster: $<HTMLImageElement>('road-hamster'), roadLabel: $('road-label'),
    familyTab: $('family-tab'), pupName: $('pup-name'), pupGen: $('pup-gen'),
    retireGain: $('retire-gain'), seedBarFill: $('seed-bar-fill'), seedNext: $('seed-next'),
    heirloomPerSeed: $('heirloom-per-seed'), retireBtn: $<HTMLButtonElement>('retire-btn'), retireBonus: $('retire-bonus'),
    familyCount: $('family-count'), familyTraits: $('family-traits'), heirloomJar: $('heirloom-jar'),
    machineStars: $('machine-stars'),
    capsulesTab: $('capsules-tab'), stageGacha: $('stage-gacha'), tray: document.querySelector<HTMLElement>('.tray')!,
    casinoTab: $('casino-tab'), casinoPanel: $('tab-casino'),
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
      // A tiny thump of the whole machine (animate() plays on top of its CSS animations).
      if (!lessMotion()) el.machine.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(2px)', offset: 0.35 }, { transform: 'translateY(0)' }], { duration: 150, easing: 'ease-out' });
      const col = reels.reelElement(i);
      if (col) {
        const r = col.getBoundingClientRect();
        fx.dust(r.left + r.width / 2, r.bottom - 6, 4, r.width * 0.3);
      }
    },
    onTease: () => sound.play('anticipation'),
    // 1.4.0: Moving Day's boxes pop open (the symbol they became is already on the cell)
    onOpen: (cells) => {
      sound.play('box', cells.length);
      for (const cell of cells) {
        if (!lessMotion()) cell.animate([{ transform: 'scale(0.5) rotate(-10deg)' }, { transform: 'scale(1.18) rotate(4deg)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 340, easing: 'ease-out' });
        fx.burstAt(cell, { count: 8, palette: fx.colors.box, speed: 150, gravity: 300, size: 3, twinkle: false });
      }
      if (cells.length >= 5 && !lessMotion()) say(`${cells.length} boxes, all the same inside!`, 1800);
    },
    quick: () => settings.quickReels,
  });
  // The prize wheel: { machineId, pot, turns, start, landedAt } while the jackpot wheel shows.
  // M9: the same wheel is the Big Cheese's cheese wheel (kind "cheese"): it's timed by the view (the win was
  // already paid, D92) and lands on a multiplier wedge, then onLand shows the celebration.
  let prize: {
    machineId: string; pot: string; index: number; count: number; turns: number; landedAt: number | null;
    kind?: 'pots' | 'cheese'; start?: number; duration?: number; labels?: string[]; onLand?: () => void;
  } | null = null;
  const CHEESE_SECONDS = 2.4; // how long the cheese wheel turns (view only)
  let holdCells: HTMLElement[] = []; // the hold & spin board's cells (M9)
  let holdPlayed = -1; // how many respins the board has shown
  let lastTick = -1; // which segment the wheel last "ticked" past (for the clicking sound)
  let tagEls = new Map<string, HTMLButtonElement>(); // machine id → its tag on the stage
  let wheelAngle = 0;
  let lastPlayTime = game.state.stats.playTime;
  let shownCoins = game.state.coins; // the counter "rolls" towards the real value
  let lastFrame = performance.now();
  let lastTitle = 0; // when the browser tab title was last updated
  let speech: { text: string; until: number } | null = null; // a temporary line from the hamster: { text, until }
  let resetArmed = 0; // reset needs two taps; this is when the first tap expires
  let retireArmed = 0; // same for retiring
  let lastRetired: GameEvents['retired'] | null = null; // what the Big Cage page says about the hamster that just retired
  let rigFitKey = ''; // stage width + machine + reel count the rig was last fitted for
  let lastZ = 0; // when the dozing hamster last let out a "z"

  const lessMotion = () => settings.motion === 'less' || (settings.motion === 'auto' && systemReducedMotion);
  const activeId = () => game.getMachineData().id;
  const fx = createFx($('fx'), { lessMotion });
  // The big moments (1.0): BIG WIN, JACKPOT, free spins, Machine Stars, over the cage.
  const celebrate = createCelebration({ host: el.wall, fx, sound, lessMotion });
  const iris = createIris(); // retiring: the old life closes on the hamster, the new one opens from it
  // The win show: all winning cells + the WIN meter counting, then one line at a time.
  const winShow = createWinShow({
    game, reels, meter: el.winMeter, meterValue: el.winMeterValue, label: el.lineLabel, reelsEl: el.reels, fx, sound, lessMotion,
    quiet: () => celebrate.active, // the celebration's own count-up ticks instead
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

  // M11: the Casino tab appears once the family's first retirement has opened the casino.
  // (A family from an older save that retired before gets it announced once too: it has no chips yet.)
  let casinoShown = game.isCasinoUnlocked() && (game.state.stats.chipsEarned.gt(0) || game.state.stats.chipsBought.gt(0));
  let casinoNew = false;

  // Fill every <img data-sprite="…"> in the HTML with its pixel art. Hamster
  // sprites get the equipped fur colours and hat (M10); call again after a change.
  function paintStaticSprites() {
    const fur = furColors(game);
    const hat = hatOf(game);
    for (const img of document.querySelectorAll<HTMLImageElement>('img[data-sprite]')) {
      const name = img.dataset.sprite!;
      const isHamster = name === 'hamster' || name === 'hamster2';
      applySprite(img, isHamster ? hamsterSprite(name, hat) : name, Number(img.dataset.size || 48), isHamster ? fur : null);
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
  // Hearts floating up from the hamster (it's happy).
  function hearts(count: number): void {
    const c = fx.centerOf(el.hamster);
    fx.spriteBurst('heart', c.x, c.y - 10, { count, speed: 150, scale: 1, life: 1.2, gravity: -120 });
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
  // A payout bonus as "+4.5%" (one decimal while it's small, whole percents after).
  const bonusText = (bonus: Money) => (bonus.lt(1) ? `+${(bonus.toNumber() * 100).toFixed(1).replace(/\.0$/, '')}%` : `+${formatWhole(bonus.mul(100).round())}%`);
  const starIcons = (n: number) => iconHTML('star', 16).repeat(n);

  // ─────────────────────── building ───────────────────────

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
    reels.startSpin(e.result, e.mystery);
    el.machine.classList.remove('big-win');
    lastSpinSource = e.source;
    if (e.source === 'manual') {
      celebrate.close(); // a spin you pulled yourself: on with the game
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
    // The cheese wheel (M9): a line of five spins it first, and the celebration waits for it to land.
    const wheelWin = here ? Math.max(0, ...e.wins.map((w) => w.wheel || 0)) : 0;
    if (wheelWin > 0) spinCheeseWheel(e, wheelWin, tierFx.titles || ['CHEESE WIN!']);
    // Small wins float a "+N"; big ones get the whole celebration, which counts the amount up itself.
    else if (tierFx.titles) celebrate.start({ kind: e.tier === 'jackpot' ? 'jackpot' : 'big', titles: tierFx.titles, amount: e.payout });
    else floatText(`+${formatCoins(e.payout)}`, big);
    if (big) replayClass(el.machine, 'big-win');
    if (here) replayClass(el.machine, 'winning'); // the marquee flashes
    if (e.tier !== 'win' || lastSpinSource === 'manual') sound.play(tierFx.sound); // small auto-spin wins stay quiet
    coinBurst(tierFx.coins);
    if (tierFx.hop && !lessMotion()) replayClass(el.hamster, 'hop');
    if (tierFx.shake && !lessMotion()) replayClass(el.stage, 'shake-stage');
    // The hamster is thrilled: little hearts float up from it (big wins and up).
    if (tierFx.titles) hearts(e.tier === 'jackpot' ? 8 : 5);
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
    // Lucky Pennies (1.3.1): this win paid double.
    if (e.doubled && here) {
      sound.play('luck');
      popText(el.machine, '×2 DOUBLE!', 'gold');
      fx.sparkleOver(el.machine, { count: 16, palette: fx.colors.gold });
    }
  });

  // The cheese wheel (M9): the hamster wheel turns into a wheel of cheese wedges
  // (×2 … ×10, with Aged Cheese's bonus) and lands on the multiplier the game
  // already rolled; then the celebration counts the (already paid) win up.
  function spinCheeseWheel(e: GameEvents['spinResolved'], multiplier: number, titles: string[]): void {
    const md = game.data.machines.find((m) => m.id === e.machineId)!;
    const bonus = game.getWheelBonus();
    const wedges = md.wheel!.wedges.map((w) => w.multiplier + bonus);
    const index = Math.max(0, wedges.indexOf(multiplier));
    prize = {
      machineId: e.machineId, pot: '', index, count: wedges.length, turns: 4 + Math.floor(Math.random() * 2), landedAt: null,
      kind: 'cheese', start: performance.now(), duration: lessMotion() ? 0.01 : CHEESE_SECONDS * 1000, labels: wedges.map((m) => `×${m}`),
      onLand: () => {
        sound.play('pot');
        fx.burstAt(el.wheel, { count: 30, palette: fx.colors.gold, speed: 240 });
        celebrate.start({ kind: e.tier === 'jackpot' || multiplier >= 10 ? 'jackpot' : 'big', titles: [...titles, `×${multiplier} CHEESE!`], amount: e.payout, sub: 'The cheese wheel' });
        coinBurst(12);
      },
    };
    lastTick = -1;
    sound.play('anticipation');
    say(`Five in a row! Spin the cheese wheel…`, 2500);
  }

  // Hold & spin (M9): the acorns lock on the board over the reels (renderHold),
  // and the Acorn Vault pays when it's over.
  game.on('holdStarted', (e) => {
    if (e.machineId !== activeId()) return;
    sound.play('freeSpins');
    celebrate.start({ kind: 'free', titles: ['HOLD & SPIN!'], sub: `${e.cells.length} acorns · ${e.respins} respins` });
    say(`${e.cells.length} Golden Acorns! They lock in place: every new acorn gives ${e.respins} respins again.`, 4000);
  });
  game.on('holdEnded', (e) => {
    sound.play('pot');
    const here = e.machineId === activeId();
    celebrate.start(e.full
      ? { kind: 'grand', titles: ['HOLD & SPIN!', 'THE GRAND!'], amount: e.amount, sub: 'Every cell filled' }
      : { kind: 'pot', titles: ['ACORN VAULT!'], amount: e.amount, sub: `${e.coins} acorns` });
    if (here) coinBurst(e.full ? 30 : 16);
    say(e.full ? `EVERY CELL! The Grand! +${formatCoins(e.amount)} coins!` : `${e.coins} acorns cracked open: +${formatCoins(e.amount)} coins!`, 4000);
  });

  // Free spins: a banner, a fanfare, and the marquee counts them down.
  game.on('freeSpinsStarted', (e) => {
    if (e.machineId !== activeId()) return;
    winShow.setFeatureText(`${e.retrigger ? '+' : ''}${e.count} free spins!`);
    sound.play('freeSpins');
    celebrate.start({ kind: 'free', titles: [e.retrigger ? `+${e.count} FREE SPINS!` : `${e.count} FREE SPINS!`] });
    fx.confetti(50, el.stage);
    fx.burstAt(el.machine, { count: 30, palette: fx.colors.party, speed: 220 });
    if (!lessMotion()) replayClass(el.hamster, 'hop');
    say(e.retrigger ? `More Hamster Balls! +${e.count} free spins!` : `Hamster Balls! ${e.count} free spins, and every win is doubled!`, 3500);
  });
  game.on('freeSpinsEnded', (e) => {
    if (e.machineId !== activeId()) return;
    if (e.won.gt(0)) {
      celebrate.start({ kind: 'free', titles: ['FREE SPINS WIN'], amount: e.won, sub: `${e.spins} free spins` });
      coinBurst(16);
    } else banner('Free spins over', 'free');
    say(`${e.spins} free spins paid +${formatCoins(e.won)} coins!`, 3500);
  });

  // The jackpot wheel: the hamster wheel turns into a prize wheel (see render()).
  game.on('jackpotStarted', (e) => {
    const pots = (game.data.machines.find((m) => m.id === e.machineId)!.jackpot || { pots: [] }).pots;
    const index = Math.max(0, pots.findIndex((p) => p.id === e.pot));
    prize = { machineId: e.machineId, pot: e.pot, index, count: pots.length, turns: 4 + Math.floor(Math.random() * 2), landedAt: null, kind: 'pots' };
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
    const grand = pot === md.jackpot!.pots[md.jackpot!.pots.length - 1];
    celebrate.start(grand
      ? { kind: 'grand', titles: ['JACKPOT!', 'GRAND JACKPOT!'], amount: e.amount }
      : { kind: 'pot', titles: [`${pot.name.toUpperCase()} JACKPOT!`], amount: e.amount });
    coinBurst(30);
    fx.fountain(el.wheel, 60);
    fx.confetti(grand ? 160 : 80);
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
    if (e.reason === 'bigCage') {
      say('We\'re in the Big Cage: start the new life first!');
      return;
    }
    if (e.reason === 'bonus') {
      say(game.getHold() ? 'Hold & spin is playing: watch the acorns!' : 'Wait for the jackpot wheel to stop!');
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

  // 1.4.0: the Great Migration. The Big Cage plays the move (bigcage.ts); here the
  // whiskers pill pops, and the new colony's first pup says hello when it starts.
  let lastMigrated: GameEvents['migrated'] | null = null;
  game.on('migrated', (e) => {
    lastMigrated = e;
    lastRetired = null;
    showMachine();
    shownCoins = game.state.coins;
    celebrate.close();
    replayClass(el.whiskerPill, 'gain');
    sound.play('migrate');
  });
  game.on('trialStarted', () => sound.play('unlock'));

  game.on('deliveryStarted', (e) => {
    sound.play('deliver');
    const w = el.wheel.getBoundingClientRect();
    fx.dust(w.left + w.width / 2, w.bottom + 30, 10, 40); // it scoots off in a puff of bedding
    say(e.source === 'auto' ? "Out of coins! I'll go on a delivery by myself." : 'Off I scoot through the tube! Back soon.', 2200);
  });
  game.on('deliveryFinished', (e) => {
    sound.play('back');
    coinBurst(6, el.road); // the pay flies out of the delivery tube into your coins
    say(`Back! Delivery paid +${formatCoins(e.reward)} coins.`);
  });

  game.on('upgradeBought', (e) => {
    const def = game.getUpgradeDef(e.id)!;
    // The Hamster Helper (1.3.1) buys a level every second or so: just a little
    // sparkle on the tile, no sound or speech each time.
    if (e.helper) {
      const t = shop.elementFor(e.id);
      fx.sparkleOver(t, { count: 4 });
      if (!lessMotion() && t) popText(t.querySelector('.buy-btn'), `LV ${e.level}`, 'helper');
      return;
    }
    sound.play(def.effect.type === 'unlockSymbol' ? 'unlock' : def.effect.type === 'luck' ? 'luck' : 'buy');
    const line = UPGRADE_LINES[def.effect.type];
    if (line) say(line(e.level, game, def), def.effect.type === 'unlockSymbol' ? 5000 : 2600);
    const tile = shop.elementFor(e.id);
    fx.sparkleOver(tile, { count: 10 + Math.min(20, e.count * 2) });
    // A ring of sparks from the button, and the new level floating up from it.
    const button = tile && tile.querySelector('.buy-btn');
    fx.ringAt(button, { count: 20, speed: 260, palette: [fx.colors.gold[0], '#ffffff', getComputedStyle(document.documentElement).getPropertyValue('--buy').trim()] });
    if (!lessMotion()) popText(button, game.isMaxed(e.id) ? 'MAX!' : `LV ${e.level}!`, game.isMaxed(e.id) ? 'gold' : '');
    // A new symbol on the reels: confetti over the machine.
    if (def.effect.type === 'unlockSymbol') fx.confetti(40, el.machine);
  });

  game.on('machineBought', (e) => {
    sound.play('machine');
    const md = game.data.machines.find((m) => m.id === e.id)!;
    const extra = md.ways ? 'No paylines here: matching snacks on neighbouring reels win on any row!'
      : md.mystery ? 'Boxes everywhere! They all open into the same symbol.'
      : md.holdSpin ? `${md.holdSpin.trigger} Golden Acorns start hold & spin!`
        : md.wheel ? 'Five in a row spins the cheese wheel: up to ×10!'
          : md.jackpot ? 'Three Cheek Pouches spin the jackpot wheel!'
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

  game.on('retired', (e) => {
    showMachine();
    shownCoins = game.state.coins; // jump, don't roll down from millions
    retireArmed = 0;
    lastRetired = e;
    celebrate.close();
    sound.play('retire');
    // 1.4.0: the Wise Elders retired this hamster by themselves: no Big Cage, no iris,
    // the next life just starts (bigCageLeft follows at once), with a word and some seeds.
    if (e.auto) {
      fx.burstAt(el.seedPill, { count: 16, palette: fx.colors.heirloom, speed: 160 });
      return;
    }
    // The old life closes like the end of a cartoon: a circle shrinks onto the
    // hamster, then the Big Cage opens (bigcage.ts waits for it) and the rebirth
    // animation plays there: the hamster plants the seed and the tree shoots up.
    if (!lessMotion()) {
      sound.play('whoosh');
      iris.close(el.hamster);
    }
  });

  game.on('bigCageLeft', (e) => {
    showMachine();
    sound.play('machine');
    if (lastRetired && lastRetired.auto) {
      replayClass(el.hamster, 'hop');
      hearts(3);
      say(`The Wise Elders retired ${lastRetired.oldName} (+${formatWhole(lastRetired.seedsGained)} Heirloom Seeds). Hi, I'm ${e.name}!`, 4500);
      newUpgrades = [];
      lastRetired = null;
      return;
    }
    if (lastMigrated) {
      if (!lessMotion()) {
        iris.open(el.hamster);
        setTimeout(() => { replayClass(el.hamster, 'hop'); hearts(6); fx.confetti(80, el.stage); }, IRIS_MS * 0.6);
      } else iris.clear();
      say(`Hi, I'm ${e.name}, the first pup of colony ${lastMigrated.colony + 1}! We brought ${formatWhole(lastMigrated.whiskers)} Golden Whiskers. Spend them in Family → Colony.`, 7000);
      lastMigrated = null;
      newUpgrades = [];
      return;
    }
    // …and the new life opens from the hamster, who hops about with hearts and confetti.
    if (!lessMotion()) {
      iris.open(el.hamster);
      setTimeout(() => {
        replayClass(el.hamster, 'hop');
        hearts(6);
        fx.confetti(60, el.stage);
      }, IRIS_MS * 0.6);
    } else iris.clear();
    const news = newUpgrades.length ? ` And there's a new upgrade for our family: ${newUpgrades.join(' and ')}!` : '';
    say(lastRetired
      ? `Hi, I'm ${e.name}! ${lastRetired.oldName} left me ${formatWhole(game.state.seeds)} Heirloom Seeds to hold.${news || ' Let\'s go!'}`
      : `Hi, I'm ${e.name}!${news || ' Let\'s go!'}`, news ? 7000 : 6000);
    if (news) sound.play('unlock');
    newUpgrades = [];
    lastRetired = null;
  });

  // Machine Stars (M8): a rebuilt machine gets a star, a gold trim and a burst of sparkles.
  game.on('machineRebuilt', (e) => {
    const md = game.data.machines.find((m) => m.id === e.id)!;
    const st = game.data.stars;
    sound.play('star');
    if (e.id === activeId()) {
      showMachine();
      fx.burstAt(el.machine, { count: 40, palette: fx.colors.gold, speed: 240 });
    }
    // Once the celebration fades, the new star pops onto the marquee.
    if (e.id === activeId()) {
      setTimeout(() => {
        replayClass(el.machineStars, 'new');
        const stars = el.machineStars.querySelectorAll('img');
        fx.burstAt(stars[stars.length - 1], { count: 16, palette: fx.colors.gold, speed: 160 });
      }, 2800);
    }
    celebrate.start({
      kind: 'star', icon: 'star', titles: [`STAR ${e.stars}!`],
      sub: `${md.name}: +${Math.round(game.getStarPayout() * 100)}% payouts and +${st.luckPerStar} Luck per star`,
    });
    say(`${md.name} is good as new, with star ${e.stars}! Every star: +${Math.round(game.getStarPayout() * 100)}% payouts and +${st.luckPerStar} Luck on it, for good.`, 6000);
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
    if (e.source === 'jackpot') say(`Golden jackpot! +${formatWhole(e.amount)} Hamster Token${e.amount.eq(1) ? '' : 's'}.`, 3000);
    if (e.source === 'delivery') say('Back! A customer tipped me a Hamster Token.', 3000);
  });
  game.on('skinEquipped', applySkins);

  // 1.3.1: a rebirth or sticker upgrade has just opened. A sticker says so at once;
  // a new generation's upgrade waits for the new pup to say hello (bigCageLeft).
  let newUpgrades: string[] = [];
  game.on('upgradeUnlocked', (e) => {
    const def = game.getUpgradeDef(e.id)!;
    if (game.state.bigCage) { newUpgrades.push(def.name); return; }
    sound.play('unlock');
    const where = def.scope === 'machine' ? `in the ${(game.data.machines.find((m) => def.machines && def.machines.includes(m.id)) || { name: 'machine' }).name}'s upgrades` : 'in Upgrades';
    say(`A diary sticker unlocked a new upgrade: ${def.name}! It's ${where}.`, 4500);
  });

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
  // Pause/resume auto-spin (Wheel Training). A QoL toggle: manual spins and
  // deliveries work the same either way.
  el.autoBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    const paused = !game.getAutoPaused();
    game.setAutoPaused(paused);
    sound.play('bet', !paused);
    say(paused ? "I'll wait for you to tap Spin." : "Back to running the wheel myself!", 1800);
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
    if (name === 'casino') casinoNew = false;
    // M11: on a phone the casino's tables need the room, so the cage steps aside while it's open (style.css).
    document.querySelector('.app')!.classList.toggle('at-casino', name === 'casino');
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
  // No debug panel in this game (a built game without ?debug): no button, no key hint.
  el.debugBtn.classList.toggle('hidden', !onToggleDebug);
  el.debugKey.classList.toggle('hidden', !onToggleDebug);
  el.debugBtn.addEventListener('click', () => {
    el.menu.close();
    if (onToggleDebug) onToggleDebug();
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
      ['Machine Stars', `${Object.values(s.stars).reduce((a, b) => a + b, 0)} (${st.rebuilds} rebuilds)`],
      ['Most Heirloom Seeds held', count(st.mostSeedsHeld)],
      ['Most ways won by one symbol', st.bestWays ? count(st.bestWays) : '—'],
      ['Hold & spin', `${count(st.holdBonuses)} played · ${count(st.holdGrands)} Grand${st.holdGrands === 1 ? '' : 's'}`],
      ['Best cheese wheel', st.bestWheel ? `×${st.bestWheel}` : '—'],
      ['Diary stickers', `${Object.keys(s.diary).length} / ${(game.data.diary || []).length}`],
      ['Capsules opened', String(st.capsulesOpened)],
      ['Skins collected', `${Object.keys(s.skins.owned).length} / ${pool.length}`],
      // 1.4.0: The Great Migration
      ...(game.data.colony && (s.colony > 0 || st.migrations > 0) ? [
        ['Colony', `${s.colony + 1} (${count(st.migrations)} migration${st.migrations === 1 ? '' : 's'})`],
        ['Golden Whiskers earned', formatWhole(st.whiskersEarned)],
        ['Colony Trials beaten', count(st.trialsCompleted)],
        ['Retired by the Wise Elders', count(st.autoRetires)],
        ['Moving Boxes opened', `${count(st.mysteryBoxes)} (best ${st.bestBoxes} in one spin)`],
      ] : []),
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
  // On a phone it's wider than the screen; on a wide screen (M15: the cage beside
  // the tray, in a window of its own height) it can be taller than the cage. CSS zoom
  // scales everything inside it; --rig-zoom lets the CSS keep the bubble text readable.
  const WIDE = window.matchMedia('(min-width: 960px), (min-width: 700px) and (orientation: landscape)');
  function fitRig() {
    const pad = getComputedStyle(el.wall);
    const availableW = el.wall.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    // Beside the tray the wall's height is set by the window; stacked (a phone) the cage
    // may take up to 44% of the screen's height, and the tray gets the rest.
    const availableH = WIDE.matches ? el.wall.clientHeight - parseFloat(pad.paddingTop) : window.innerHeight * 0.44;
    el.rig.style.zoom = '1'; // measure its full size first
    const rig = el.rig.getBoundingClientRect();
    const style = getComputedStyle(el.rig);
    const height = rig.height + parseFloat(style.marginTop) + parseFloat(style.marginBottom); // + the room for the bubble
    const zoom = Math.max(0.3, Math.min(1, availableW / rig.width, availableH / height));
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
    el.seedPill.classList.toggle('hidden', !(s.seeds.gt(0) || s.seedsEarned.gt(0) || s.colony > 0));
    setText(el.seedCount, formatWhole(s.seeds));
    // 1.4.0: Golden Whiskers, once the family has migrated (or has some)
    el.whiskerPill.classList.toggle('hidden', !(s.colony > 0 || s.whiskers.gt(0)));
    setText(el.whiskerCount, formatWhole(s.whiskers));
    const anyBuyable = game.data.familyTree && game.data.familyTree.nodes.some((n) => game.canBuyTreeNode(n.id));
    const colonyNews = game.canMigrate() || (game.data.colony ? game.data.colony.perks.some((p) => game.canBuyPerk(p.id)) : false);
    el.familyTab.classList.toggle('alert', familyNew || anyBuyable || colonyNews);
    colony.render(now, familyShown && !el.familyPanel.classList.contains('hidden'));
    renderTrialBadge();
    if (!familyShown) return;

    // Retire card
    const name = game.getPupName();
    setText(el.pupName, name);
    setText(el.pupGen, `Generation ${s.generation} · earned ${formatCoins(s.run.coinsEarned)} this life`);
    const pending = game.getPendingSeeds();
    setHTML(el.retireGain, seedLabel(`+${formatWhole(pending)} Heirloom Seed${pending.eq(1) ? '' : 's'}`));
    const prog = game.getSeedProgress();
    el.seedBarFill.style.width = `${(prog.progress * 100).toFixed(1)}%`;
    // (Since 1.4.0 seeds come from the coins earned this colony, on a curve that bends
    // past its softcap: "coins still to go" says it plainly.)
    setText(el.seedNext, `Next Heirloom Seed in ${formatCoins(prog.nextAt.sub(prog.earned).max(0))} more coins earned`);
    const perSeed = game.getHeldSeedBonusPerSeed();
    setText(el.heirloomPerSeed, String(Math.round(perSeed * 1000) / 10));
    setText(el.heirloomJar, `${Math.round(game.getSeedJar() * 100)}`);
    // The seed jar (M9): past a full jar, more seeds held add nothing (plant them).
    const after = game.getHeirloomBonusFor(s.seeds.add(pending));
    const jarFull = s.seeds.add(pending).gte(game.getSeedJarSeeds());
    setText(el.retireBonus, `Heirloom bonus: ${bonusText(game.getHeirloomBonus())} now → ${bonusText(after)} with the new seeds held`
      + (jarFull ? ' (the seed jar is full: plant the extra seeds, or grow the jar with Family Fortune)' : ''));
    el.retireBtn.disabled = !game.canRetire(); // also not while the jackpot wheel turns or a gamble is on
    setText(el.retireBtn, now < retireArmed ? `Tap again to retire ${name}` : 'Retire to the Big Cage');

    // The family's traits (M15: the tree itself only shows in the Big Cage): a row of
    // the planted ones, with their levels.
    const ft = game.data.familyTree;
    const planted = ft ? ft.nodes.filter((n) => game.getTreeLevel(n.id) > 0) : [];
    const growable = ft ? ft.nodes.filter((n) => (n.colony || 0) <= s.colony).length : 0; // (colony traits, 1.4.0, after a migration)
    setText(el.familyCount, `${planted.length} of ${growable} traits planted`);
    const traitsKey = planted.map((n) => `${n.id}${game.getTreeLevel(n.id)}`).join();
    if (el.familyTraits.dataset.key !== traitsKey) {
      el.familyTraits.dataset.key = traitsKey;
      el.familyTraits.replaceChildren(...planted.map((n) => {
        const chip = document.createElement('span');
        chip.className = 'trait-chip';
        chip.title = `${n.name}: ${n.description}`;
        chip.appendChild(spriteImg(treeIcon(n), 16, n.name[0]));
        const level = game.getTreeLevel(n.id);
        chip.append(level > 1 ? `${n.name} ${level}` : n.name);
        return chip;
      }));
    }
  }

  // 1.4.0: a Colony Trial under way: its twist, and this life's seeds towards the goal.
  function renderTrialBadge(): void {
    const t = game.getTrialDef(game.state.trial);
    el.trialBadge.classList.toggle('hidden', !t || game.state.bigCage);
    if (!t) return;
    const goal = game.getTrialGoal();
    const have = game.getPendingSeeds();
    const key = `${t.id}|${formatWhole(have)}|${formatWhole(goal)}`;
    if (el.trialBadge.dataset.key === key) return;
    el.trialBadge.dataset.key = key;
    el.trialBadge.title = `Colony Trial: ${t.description} Reach ${formatWhole(goal)} pending Heirloom Seeds this life for ${formatWhole(game.getTrialWhiskers(t.id))} Golden Whiskers.`;
    setHTML(el.trialBadge, `<b>Trial: ${t.name}</b><span class="num">${iconHTML('heirloom', 16)}${formatWhole(have)} / ${formatWhole(goal)}</span>`);
  }

  function renderMachineTags() {
    const owned = game.state.machines.length;
    el.machineTags.classList.toggle('hidden', owned < 2);
    if (owned < 2) return;
    // Past four machines (M9) the named tags would wrap onto the machine: icons only
    // then (the marquee names the machine you're on, and every tag has a tooltip).
    el.machineTags.classList.toggle('many', owned > 4);
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
      if (!lessMotion()) popText(el.luckBadge, `Luck ${luck.total}!`, 'luck');
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

  // Hold & spin (M9): a board over the reels. Locked acorns show their coins;
  // empty cells shimmer while they respin. Each respin that lands acorns pops
  // them in with a clink and sparkles (game.getHold says how far it has played).
  function renderHold(hold: ReturnType<Game['getHold']>): void {
    el.holdBoard.classList.toggle('hidden', !hold);
    el.machine.classList.toggle('holding', !!hold);
    if (!hold) {
      holdPlayed = -1;
      return;
    }
    if (holdCells.length !== hold.cells.length) {
      const reels = hold.cells.length / hold.rows;
      el.holdBoard.style.gridTemplateColumns = `repeat(${reels}, 1fr)`;
      holdCells = hold.cells.map((_, i) => {
        const cell = document.createElement('div');
        cell.className = 'hold-cell';
        cell.style.gridColumn = String(Math.floor(i / hold.rows) + 1);
        cell.style.gridRow = String((i % hold.rows) + 1);
        cell.append(spriteImg('goldAcorn', 48), Object.assign(document.createElement('span'), { className: 'hold-value' }));
        return cell;
      });
      el.holdBoard.replaceChildren(...holdCells);
    }
    hold.cells.forEach((value, i) => {
      const cell = holdCells[i];
      const filled = value.gt(0);
      cell.classList.toggle('filled', filled);
      setText(cell.lastChild!, filled ? formatCoins(value) : '');
    });
    el.holdBoard.classList.toggle('full', hold.full);
    if (hold.played !== holdPlayed) {
      const first = holdPlayed < 0;
      holdPlayed = hold.played;
      if (!first) {
        if (hold.played > 0 && hold.landed.length === 0) sound.play('respin');
        for (const i of hold.landed) {
          replayClass(holdCells[i], 'landed');
          fx.sparkleOver(holdCells[i], { count: 8 });
        }
        if (hold.landed.length && hold.played > 0) sound.play('acorn', hold.landed.length);
      }
    }
  }

  // The prize wheel: the wheel face turns (following the game's bonus progress,
  // so it follows debug speed-ups too) and lands with the chosen pot under the pointer.
  function renderPrize(now: number): void {
    // The cheese wheel (M9) runs on its own clock; after a switch away it just stops.
    if (prize && prize.kind === 'cheese' && prize.machineId !== activeId()) prize = null;
    const cheese = !!prize && prize.kind === 'cheese';
    const bonus = !prize || prize.machineId !== activeId() ? null
      : cheese ? Math.min(1, (now - prize.start!) / prize.duration!) : game.getBonusProgress();
    if (prize && cheese && bonus === 1 && prize.landedAt === null) {
      prize.landedAt = now;
      if (prize.onLand) prize.onLand();
    }
    if (prize && (cheese ? prize.landedAt !== null && now - prize.landedAt > 2500 : bonus === null && (prize.landedAt === null || now - prize.landedAt > 2500))) prize = null;
    el.wheel.classList.toggle('prize', !!prize);
    el.wheel.classList.toggle('cheese', cheese && !!prize);
    if (!prize) return;
    const seg = 360 / prize.count;
    const target = prize.turns * 360 + (360 - (prize.index * seg + seg / 2)); // this segment ends at the top
    const t = bonus === null ? 1 : bonus;
    const eased = 1 - Math.pow(1 - t, 3);
    const angle = target * eased;
    el.prizeFace.style.transform = `rotate(${angle}deg)`;
    const paintKey = `${prize.kind}|${prize.count}|${(prize.labels || []).join()}`;
    if (el.prizeFace.dataset.painted !== paintKey) {
      const css = getComputedStyle(document.documentElement);
      const colours = cheese ? CHEESE_SEGMENTS : PRIZE_SEGMENTS;
      const stops = Array.from({ length: prize.count }, (_, i) => {
        const colour = css.getPropertyValue(colours[i % colours.length]).trim();
        return `${colour} ${i * seg}deg ${(i + 1) * seg}deg`;
      }).join(', ');
      el.prizeFace.style.background = `repeating-conic-gradient(rgba(74,52,40,0.25) 0 1.5deg, transparent 1.5deg ${seg}deg), conic-gradient(${stops})`;
      // The cheese wheel's wedges say what they're worth ("×5"), turning with the wheel.
      el.prizeFace.replaceChildren(...(prize.labels || []).map((text, i) => {
        const label = document.createElement('span');
        label.className = 'prize-label';
        label.textContent = text;
        label.style.transform = `rotate(${(i + 0.5) * seg}deg) translateY(-38px)`;
        return label;
      }));
      el.prizeFace.dataset.painted = paintKey;
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
    setText(el.coinRate, econ.autoInterval && !game.getAutoPaused() ? `+${formatCoins(econ.expectedAutoProfitPerSecond)}/s` : '');
    // Coins in the browser tab's title, so you can peek from another tab (twice a second).
    if (now - lastTitle > 500) {
      lastTitle = now;
      const title = `${formatCoins(s.coins)} coins · Hamster Slots`;
      if (document.title !== title) document.title = title;
    }

    // Machine + reels
    if (el.machine.dataset.machine !== game.getMachineData().id) showMachine();
    reels.render();
    // Refit when the cage's size, the machine or its reels change. (Stacked, the wall's
    // height follows the rig, so the window's height is what counts there.)
    const fitKey = `${el.stage.clientWidth}|${WIDE.matches ? el.wall.clientHeight : window.innerHeight}|${el.machine.dataset.machine}|${game.getReelCount()}|${el.pots.classList.contains('hidden')}`;
    if (fitKey !== rigFitKey) {
      rigFitKey = fitKey;
      fitRig();
    }
    el.machine.classList.toggle('spinning', machine.spinning);
    el.machine.classList.toggle('teasing', reels.teasing);
    el.machine.classList.toggle('pulled', machine.spinning && game.getSpinProgress() < 0.3);
    renderMachineTags();

    // Spin + deliver buttons. During free spins, Spin just counts them down.
    const free = game.getFreeSpins();
    const spinBet = game.getSpinBet();
    const gambling = !!s.gamble && s.gamble.started;
    const busy = machine.spinning || !!machine.bonus || !!machine.hold || gambling || (!!free && free.left > 0);
    // Auto-spin (Wheel Training): whether it's ON right now (bought AND not paused).
    // Used for every visual that should reflect "is the hamster actually running by
    // itself", as opposed to game.getAutoInterval(), which stays the real number
    // for shop previews and stats even while paused.
    const hasAuto = game.getAutoInterval() !== null;
    const autoRunning = hasAuto && !game.getAutoPaused();
    if (free) {
      setText(el.spinTitle, 'Free');
      setHTML(el.spinMeta, `${free.left} left · ×${free.bet}`);
    } else {
      setText(el.spinTitle, machine.bonus ? 'Jackpot!' : machine.hold ? 'Hold!' : 'Spin');
      setHTML(el.spinMeta, `${iconHTML('coin', 24)} ${formatCoins(game.getBetCost(spinBet || game.getBet()))}`);
    }
    // Not disabled while a normal spin runs: a click then queues the next spin.
    el.spinBtn.disabled = busy && !machine.spinning;
    el.spinBtn.classList.toggle('busy', machine.spinning);
    el.spinBtn.classList.toggle('free', !!free);
    el.spinBtn.classList.toggle('poor', !free && (delivering || spinBet === null));
    // No auto-spin running (never bought, or paused) and the hamster's been idle a
    // while (or never spun): Spin glows to say "tap me".
    const idle = !machine.spinning && !busy && !delivering && spinBet !== null && !autoRunning
      && (s.stats.spins === 0 || now - lastManualSpinAt > 8000);
    el.spinBtn.classList.toggle('attract', idle);
    renderBet();
    const reward = formatCoins(game.getDeliveryReward());
    const trip = formatSeconds(game.getDeliveryDuration());
    el.deliverBtn.disabled = delivering;
    setText(el.deliverMeta, delivering ? `back in ${Math.ceil(s.delivery.timer)}s` : `+${reward} · ${trip}`);
    // The pause/resume button: only once Wheel Training exists (nothing to pause before that).
    el.autoBtn.classList.toggle('hidden', !hasAuto);
    if (hasAuto) {
      const paused = game.getAutoPaused();
      el.autoBtn.classList.toggle('paused', paused);
      setText(el.autoBtn, paused ? '▶' : '⏸');
      el.autoBtn.setAttribute('aria-pressed', String(!paused));
      el.autoBtn.setAttribute('aria-label', paused ? 'Resume auto-spin' : 'Pause auto-spin');
    }

    // The machine's own extras: free-spin mode on the marquee, pots, streak, gamble.
    el.machine.classList.toggle('free-spins', !!free);
    const hold = game.getHold();
    setText(el.machineName, free ? `Free spins ${free.played}/${free.total} · +${formatCoins(free.won)}`
      : hold ? `${hold.full ? 'Every cell!' : `${hold.respinsLeft} respin${hold.respinsLeft === 1 ? '' : 's'} left`} · ${formatCoins(hold.total)}`
        : game.getMachineData().name);
    // Machine Stars (M8): little stars on the marquee, and a gold trim once it has one.
    const stars = game.getStars();
    setHTML(el.machineStars, starIcons(stars));
    el.machine.classList.toggle('starred', stars > 0);
    renderPots();
    renderLuck();
    renderStreak(machine, realDt);
    renderGamble(now);
    renderPrize(now);
    renderHold(hold);
    winShow.render(now);
    celebrate.render(now);

    // Wheel: fast during a spin, steady with auto-spin, still when resting or paused.
    // Rotation uses GAME time, so it speeds up with the debug speed buttons.
    const speed = delivering ? 0 : machine.spinning || machine.bonus ? 540 : autoRunning || free ? 90 : 0; // degrees per second
    wheelAngle = (wheelAngle + speed * Math.max(0, gameDt)) % 360;
    el.spokes.style.transform = `rotate(${wheelAngle}deg)`;
    el.belt.style.backgroundPositionX = `${(wheelAngle * 0.6) % 16}px`;
    // Particles: bedding dust kicked up by a fast wheel, and motes drifting in the cage.
    if (speed >= 540 && Math.random() < realDt * 6) {
      const r = el.wheel.getBoundingClientRect();
      fx.dust(r.left + r.width / 2, r.bottom + 30, 3, r.width * 0.3);
    }
    fx.motes(el.wall, 0.8, realDt);
    // Free spins turn the cage to night: a purple glow at the edges and twinkling stars.
    el.wall.classList.toggle('free-mode', !!free);
    if (free) fx.twinkles(el.wall, 18, realDt, [fx.colors.gold[0], '#ffffff', fx.colors.gold[2], getComputedStyle(el.wall).getPropertyValue('--soft').trim()]);
    // Out on a delivery: the hamster kicks up a little dust as it runs down the tube.
    if (delivering && Math.random() < realDt * 5) {
      const r = el.roadHamster.getBoundingClientRect();
      fx.dust(r.left + 4, r.bottom - 4, 1, 4);
    }
    fx.frame(realDt);

    // Hamster: two-frame run cycle (real time, purely visual).
    const frame = speed > 0 || delivering ? (Math.floor(now / 110) % 2 ? 'hamster2' : 'hamster') : 'hamster';
    const fur = furColors(game);
    applySprite(el.hamster, hamsterSprite(frame, hatOf(game)), 48, fur);
    el.hamster.classList.toggle('away', delivering);
    // Resting (the wheel still): the hamster breathes; left alone long enough, it dozes off (Zzz).
    const resting = speed === 0 && !delivering;
    el.hamster.classList.toggle('idle', resting);
    const sleepy = resting && !autoRunning && !machine.spinning && now - lastManualSpinAt > 25000;
    if (sleepy && now - lastZ > 1300 && !lessMotion()) {
      lastZ = now;
      const z = document.createElement('span');
      z.className = 'zzz';
      z.textContent = 'z';
      el.hamster.parentElement!.appendChild(z);
      z.addEventListener('animationend', () => z.remove());
    }

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
    else if (machine.hold) hint = 'Acorns lock in place. Every new one resets the respins. Fill the vault for the Grand!';
    else if (free && free.left > 0) hint = `Free spins! ${free.left} to go, and every win is doubled.`;
    else if (s.gamble && s.gamble.machineId === activeId()) hint = 'Feeling lucky? Guess the card: a colour doubles it, a suit makes it ×4!';
    else if (!machine.spinning && spinBet === null) hint = 'Out of coins! Send me on a delivery (D).';
    else if (s.stats.spins === 0) hint = `Hi, I'm ${game.getPupName()}! Tap SPIN (or Space). Match symbols from the left to win!`;
    else if (game.getAutoPaused() && !machine.spinning) hint = "Paused! I'll wait for you to tap Spin (or ▶ up there).";
    else if (!autoRunning && !machine.spinning && now - lastManualSpinAt > 25000) hint = 'Zzz… (tap Spin to wake me up)';
    setText(el.bubble, hint);
    el.bubble.classList.toggle('hidden', hint === '');

    // Reset button text (two-tap confirm)
    setText(el.resetBtn, now < resetArmed ? 'Tap again to wipe everything' : 'Reset progress');

    shop.render();
    payouts.render(now);
    renderFamily(now);
    renderCapsules(now);
    renderCasino(now);
    bigCage.render(now);
  }

  function renderCasino(now: number): void {
    if (!casinoShown && game.isCasinoOpen()) {
      casinoShown = true;
      casinoNew = true;
      const chips = game.state.casino.chips;
      say(chips.gt(0) ? `The Hamster Casino is open! The family got ${formatWhole(chips)} chips to play with. Peek at the Casino tab.`
        : `The Hamster Casino is open! I earn a chip every ${game.data.casino!.chipsPerSpins.spins} paid spins. Peek at the Casino tab.`, 6000);
    }
    el.casinoTab.classList.toggle('hidden', !casinoShown);
    el.casinoTab.classList.toggle('alert', casinoNew);
    casinoView.render(now, casinoShown && !el.casinoPanel.classList.contains('hidden'));
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

  const capsules = createCapsulesView(game, { say, sound, fx, settings, onSettingsChange });
  const colony = createColonyView(game, { say, sound, fx, settings, onSettingsChange });
  const casinoView = createCasinoView(game, { say, sound, fx, lessMotion, settings, onSettingsChange });
  const backupView = createBackupView(game, backup);
  const shop = createShopView(game, { settings, onSettingsChange });
  const payouts = createPayoutsView(game, { settings, onSettingsChange });
  // The Big Cage (M8; a scene of its own since M15): the page between lives, where the tree grows.
  const bigCage = createBigCage(game, {
    fx, sound, lessMotion, bonusText,
    treeLine: (type) => (TREE_LINES[type] ? TREE_LINES[type](1) : null),
  });
  setText($('app-version'), version);
  buildMachineTags();
  buildSettings();
  applySettings();
  showMachine();
  // The cage "opens" as the page loads (1.0): the HUD drops in, the wheel rolls
  // in, the machine lands with a bounce, the tray slides up (style.css .intro).
  const app = document.querySelector<HTMLElement>('.app');
  if (app && !lessMotion()) {
    app.classList.add('intro');
    setTimeout(() => app.classList.remove('intro'), 1800);
  }
  // celebrate: for trying the celebrations from the console, e.g.
  // hamster.ui.celebrate.start({ kind: 'jackpot', titles: ['BIG WIN!', 'JACKPOT!'], amount: hamster.game.state.coins })
  return { render, celebrate };
}
