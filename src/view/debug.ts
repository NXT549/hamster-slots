// debug.ts — VIEW layer. A balance-testing panel, toggled with the ` (backtick) key.
//
// It only uses the same public game API as the UI, plus the shared "clock"
// object from main.ts for time speed.

import { formatCoins } from './dom.ts';
import { money, divide } from '../logic/money.ts';
import type { Money } from '../logic/money.ts';
import type { Game } from '../logic/game.ts';

const SPEEDS = [1, 2, 5, 10, 50];
const WINDOW = 10; // seconds of game time used for "measured coins/s"

export function createDebugPanel(
  game: Game,
  { clock, reloadData, saveNow }: { clock: { timeScale: number }; reloadData: (() => Promise<void>) | null; saveNow: () => boolean },
) {
  const panel = document.getElementById('debug-panel')!;
  panel.innerHTML = `
    <h3>DEBUG <span class="small">(press \` to hide)</span></h3>
    <pre id="dbg-stats"></pre>
    <div class="row"><span class="row-label">Time speed (game time)</span><span id="dbg-speeds"></span></div>
    <div class="row"><span class="row-label">Add coins</span>
      <button data-add="100">+100</button><button data-add="1000">+1K</button><button data-add="10000">+10K</button>
    </div>
    <div class="row"><span class="row-label">Family (earned coins count toward Heirloom Seeds)</span>
      <button data-earn="10000">Earn +10K</button><button data-earn="100000">Earn +100K</button><button id="dbg-seeds">+5 seeds</button>
      <button id="dbg-cage">Open the Big Cage</button>
    </div>
    <div class="row"><span class="row-label">Capsules</span>
      <button data-tokens="10">+10 tokens</button><button data-tokens="100">+100 tokens</button><button id="dbg-skins">Every skin</button>
      <button data-chips="1000">+1,000 chips</button>
    </div>
    <div class="row"><span class="row-label">Bonus features (on the machine you're running)</span>
      <button id="dbg-free">+5 free spins</button>
      <button data-pot="mini">Wheel: Mini</button><button data-pot="minor">Minor</button><button data-pot="major">Major</button><button data-pot="grand">Grand</button>
      <button id="dbg-gamble">Offer a gamble (100)</button>
      <button id="dbg-hold">Hold & spin (6 acorns)</button>
    </div>
    <div class="row"><span class="row-label">Offline earnings (pretend you were away)</span>
      <button data-away="600">10 min</button><button data-away="3600">1 h</button><button data-away="36000">10 h</button>
    </div>
    <div class="row"><span class="row-label">Data &amp; save</span>
      <button id="dbg-reload">Reload data.json</button><button id="dbg-save">Save now</button>
    </div>
    <div class="status" id="dbg-status"></div>`;

  const statsEl = panel.querySelector('#dbg-stats')!;
  const statusEl = panel.querySelector('#dbg-status')!;
  const speedsEl = panel.querySelector('#dbg-speeds')!;

  // Time speed buttons
  const speedButtons = SPEEDS.map((speed) => {
    const b = document.createElement('button');
    b.textContent = `${speed}×`;
    b.addEventListener('click', () => { clock.timeScale = speed; });
    speedsEl.appendChild(b);
    return { b, speed };
  });

  panel.querySelectorAll<HTMLElement>('[data-add]').forEach((b) => {
    b.addEventListener('click', () => game.addCoins(Number(b.dataset.add)));
  });
  // "Earn" counts as coins earned by playing, so it moves you towards Heirloom Seeds.
  panel.querySelectorAll<HTMLElement>('[data-earn]').forEach((b) => {
    b.addEventListener('click', () => game.addCoins(Number(b.dataset.earn), true));
  });
  panel.querySelector('#dbg-seeds')!.addEventListener('click', () => game.addSeeds(5));
  // Plant without retiring (M8: planting only happens in the Big Cage).
  panel.querySelector('#dbg-cage')!.addEventListener('click', () => {
    if (!game.openBigCage()) setStatus('Already in the Big Cage, or a gamble is under way.');
  });
  panel.querySelectorAll<HTMLElement>('[data-chips]').forEach((b) => {
    b.addEventListener('click', () => game.addChips(Number(b.dataset.chips))); // M11 (the casino)
  });
  panel.querySelectorAll<HTMLElement>('[data-tokens]').forEach((b) => {
    b.addEventListener('click', () => game.addTokens(Number(b.dataset.tokens)));
  });
  panel.querySelector('#dbg-free')!.addEventListener('click', () => {
    if (!game.addFreeSpins(5)) setStatus('This machine has no free spins (try the Burrow Bonanza).');
  });
  panel.querySelectorAll<HTMLElement>('[data-pot]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!game.triggerJackpot(b.dataset.pot!)) setStatus('No jackpot wheel here (try the Pouch Palace), or the machine is busy.');
    });
  });
  panel.querySelector('#dbg-skins')!.addEventListener('click', () => game.ownAllSkins());
  panel.querySelector('#dbg-hold')!.addEventListener('click', () => {
    if (!game.triggerHold(6)) setStatus('No hold & spin here (try the Acorn Vault), or the machine is busy.');
  });
  panel.querySelector('#dbg-gamble')!.addEventListener('click', () => {
    if (!game.triggerGamble(100)) setStatus('Can\'t offer a gamble now (one is open, or the machine is busy).');
  });
  panel.querySelectorAll<HTMLElement>('[data-away]').forEach((b) => {
    b.addEventListener('click', () => {
      if (!game.applyOfflineEarnings(Number(b.dataset.away))) setStatus('Nothing earned: offline earnings need Wheel Training.');
    });
  });

  function setStatus(text: string): void {
    statusEl.textContent = text;
  }

  // reloadData is null in a built game (there's no data.json file to re-read
  // there; it's bundled into the code), so the button only shows in `npm run dev`.
  const reloadButton = panel.querySelector<HTMLButtonElement>('#dbg-reload')!;
  if (!reloadData) reloadButton.hidden = true;
  reloadButton.addEventListener('click', async () => {
    try {
      await reloadData!();
      setStatus('data.json reloaded, progress kept ✓');
    } catch (err) {
      setStatus(`Reload failed: ${(err as Error).message}`);
    }
  });
  panel.querySelector('#dbg-save')!.addEventListener('click', () => {
    setStatus(saveNow() ? 'Saved ✓' : 'Save failed (see console)');
  });

  // ── Measured income ──
  // Every coin in or out from playing (spin costs, payouts, deliveries) is logged
  // with its game time. Upgrade purchases and debug coins are left out on purpose:
  // we want the rate the machine is actually producing.
  const log: { t: number; amount: Money }[] = [];
  let logStart = game.state.stats.playTime;
  const now = () => game.state.stats.playTime;
  game.on('spinStarted', (e) => log.push({ t: now(), amount: e.cost.neg() }));
  game.on('spinResolved', (e) => { if (e.payout.gt(0)) log.push({ t: now(), amount: e.payout }); });
  game.on('deliveryFinished', (e) => log.push({ t: now(), amount: e.reward }));
  game.on('jackpotWon', (e) => log.push({ t: now(), amount: e.amount }));
  game.on('stateLoaded', () => { log.length = 0; logStart = now(); });

  function measuredPerSecond() {
    const t = now();
    while (log.length && log[0].t < t - WINDOW) log.shift();
    const span = Math.min(WINDOW, t - logStart);
    if (span <= 0) return money(0);
    return divide(log.reduce((sum, x) => sum.add(x.amount), money(0)), span);
  }

  // Toggle with backtick (or the Menu's "Toggle debug panel" button)
  function toggle() {
    panel.classList.toggle('hidden');
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote' || e.key === '`') {
      e.preventDefault();
      toggle();
    }
  });

  let lastDraw = 0;
  function render() {
    if (panel.classList.contains('hidden')) return;
    for (const { b, speed } of speedButtons) b.classList.toggle('active', clock.timeScale === speed);

    // Redrawing text 60×/s makes it unreadable, so update 5×/s.
    const t = performance.now();
    if (t - lastDraw < 200) return;
    lastDraw = t;

    const s = game.state.stats;
    const e = game.getEconomy();
    const md = game.getMachineData();
    const actualHit = s.spins > 0 ? `${((s.wins / s.spins) * 100).toFixed(1)}%` : 'n/a';
    const minutes = Math.floor(s.playTime / 60);
    const seconds = Math.floor(s.playTime % 60);

    const odds = game.getFeatureOdds();
    const features = [
      odds.freeSpins ? `free spins 1 in ${Math.round(1 / odds.freeSpins.chance)} (${odds.freeSpins.perTriggerWithRetriggers.toFixed(1)} spins, EV ${odds.freeSpins.ev.toFixed(1)})` : '',
      odds.jackpot ? `pots EV ${odds.jackpot.ev.toFixed(1)}, wheel 1 in ${Math.round(1 / odds.jackpot.chance)}` : '',
      odds.wild > 0 ? `wild ${(odds.wild * 100).toFixed(1)}%` : '',
    ].filter(Boolean).join(' · ') || 'none';
    const pots = game.getJackpotPots().map((p) => `${p.name} ${formatCoins(p.value)}`).join(' · ');
    const free = game.getFreeSpins();
    statsEl.textContent = [
      `Machine        ${md.name} · ${e.reels} reels × ${e.rows} row${e.rows === 1 ? '' : 's'} · ${e.lines} line${e.lines === 1 ? '' : 's'} (${game.state.machines.length} owned)`,
      `EV / spin      ${e.ev.toFixed(2)} base (lines ${e.lineEv.toFixed(2)} × streak ${e.streakFactor.toFixed(3)}) × ${e.payoutMultiplier.toFixed(2)} = ${e.payoutMultiplier.mul(e.ev).toFixed(2)}`,
      `Features       ${features}`,
      pots ? `Pots           ${pots}` : null,
      free ? `Free spins     ${free.left} left of ${free.total} · +${formatCoins(free.won)} · bet ×${free.bet}` : null,
      `Bet            ×${e.bet} (max ×${game.getBetSteps()[game.getMaxBetIndex()]}) · next spin ×${game.getSpinBet() ?? '—'} · streak ${game.state.machines[game.state.activeMachine].streak}`,
      `Spin cost      ${formatCoins(e.spinCost)} at ×1 · ${formatCoins(e.betCost)} at your bet`,
      `RTP            ${(e.rtp * 100).toFixed(1)}%   (profit/spin ${e.profitPerSpin.toFixed(2)}, +${e.extraSecondsPerSpin.toFixed(3)} s of features a spin)`,
      `Hit rate       ${(e.hitRate * 100).toFixed(1)}% expected · ${actualHit} actual (all machines)`,
      `Luck           ${e.luck.total} (Hamster ${e.luck.hamster} + Machine ${e.luck.machine}) · symbols ${game.getMachineInfo(md.id)!.symbols.unlocked}/${game.getMachineInfo(md.id)!.symbols.lockable} unlocked`,
      `Auto interval  ${e.autoInterval ? `${e.autoInterval.toFixed(2)} s (${(1 / e.autoInterval).toFixed(2)} spins/s)` : 'off'}`,
      `Auto profit/s  ${e.expectedAutoProfitPerSecond.toFixed(2)} expected`,
      `Net coins/s    ${measuredPerSecond().toFixed(2)} measured (last ${WINDOW}s game time)`,
      `Spin time      ${e.spinDuration.toFixed(2)} s`,
      `Delivery       ${e.deliveryPerSecond.toFixed(2)} coins/s (${formatCoins(game.getDeliveryReward())} per ${game.getDeliveryDuration().toFixed(1)} s trip)`,
      `Spins          ${s.spins} (${s.manualSpins} manual, ${s.autoSpins} auto) · wins ${s.wins}`,
      `Deliveries     ${s.deliveries} (+${formatCoins(s.deliveryCoins)})`,
      `Won / spent    +${formatCoins(s.coinsWon)} / -${formatCoins(s.coinsSpent)}`,
      `Play time      ${minutes}m ${seconds}s (game time, all lives)`,
      `Family         gen ${game.state.generation} (${game.getPupName()}) · this life ${Math.floor(game.state.run.playTime / 60)}m, +${formatCoins(game.state.run.coinsEarned)}`,
      `Seeds          ${game.state.seeds} held (+${(game.getHeirloomBonus().toNumber() * 100).toFixed(1)}%) · ${game.state.seedsEarned} ever earned · ${game.getPendingSeeds()} pending${game.state.bigCage ? ' · IN THE BIG CAGE' : ''}`,
      `Heirloom bonus +${game.getHeirloomBonus().mul(100).toFixed(0)}% payouts · lifetime earned ${formatCoins(s.coinsEarned)}`,
      `Tokens         ${game.state.tokens} (${s.tokensEarned} earned) · stickers ${Object.keys(game.state.diary).length}/${(game.data.diary || []).length}`,
      `Capsules       ${s.capsulesOpened} opened · ${Object.keys(game.state.skins.owned).length} skins · pity in ${game.getPityRemaining()} · jackpots ${s.goldenJackpots}`,
      `Seed           ${game.rng.seed}`,
    ].filter((line) => line !== null).join('\n');
  }

  return { render, toggle };
}
