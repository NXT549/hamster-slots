// capsules.ts — VIEW layer. The Capsules tab, in three sub-tabs:
//   1) the Capsule Machine: tokens, Pull button, odds, pity counter, the reveal
//   2) the Wardrobe: every skin, grouped by category; tap one you own to wear it
//   3) the Hamster Diary: goals that pay Hamster Tokens, with progress bars
// Like ui.ts, it only calls game actions (pullCapsule, equipSkin) and reads state.

import { CAPSULE_SPRITES } from './art.ts';
import { formatCoins, formatWhole, setText, setHTML, replayClass, iconHTML } from './dom.ts';
import { createSubTabs } from './kit.ts';
import { skinPreview } from './skins.ts';
import type { Sound } from './sound.ts';
import type { Fx } from './fx.ts';
import type { Game } from '../logic/game.ts';
import type { GameEvents, Effect, SkinDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';

// The capsule wobbles this long before it opens. View only: the game already
// decided what's inside the moment you pulled.
const REVEAL_MS = 900;

export function createCapsulesView(
  game: Game,
  { say, sound, fx, settings, onSettingsChange }: { say: (text: string, ms?: number) => void; sound: Sound; fx: Fx; settings: Settings; onSettingsChange: () => void },
) {
  // The element with this id (every id used here is in index.html).
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    tokens: $('cap-tokens'), pullBtn: $<HTMLButtonElement>('pull-btn'), odds: $('cap-odds'), pity: $('cap-pity'),
    machine: $('cap-machine'), reveal: $('cap-reveal'), wardrobe: $('wardrobe'), wardrobeTotal: $('wardrobe-total'), diary: $('diary'),
  };
  const subtabs = createSubTabs($('capsules-subtabs'), $('tab-capsules'), { key: 'capsules', settings, onSettingsChange });
  let stickersSeen = Object.keys(game.state.diary).length; // for the Diary dot
  let reveal: { e: GameEvents['capsuleOpened']; at: number; announced?: boolean } | null = null; // the capsule being opened
  let skinTiles = new Map<string, HTMLButtonElement>(); // skin id → its tile button
  let diaryRows = new Map<string, { row: HTMLElement; fill: HTMLElement; count: HTMLElement }>(); // sticker id → its row

  const rarityName = (id: string) => (id === 'starter' ? 'Starter' : (game.data.capsules.rarities.find((r) => r.id === id) || { name: id }).name);
  const categoryName = (id: string) => (game.data.skinCategories.find((c) => c.id === id) || { name: id }).name;

  // ─────────────────────── what a skin does (M10) ───────────────────────
  // One effect of a worn skin, in words. The first effect of a skin is its slot's
  // buff; an Epic's second one is its twist.
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  function describeWear(e: Effect): string {
    switch (e.type) {
      case 'payoutMultiplier': return `+${pct(e.perLevel)} payouts`;
      case 'spinSpeed': return `spins ${pct(1 - e.multiplier)} faster`;
      case 'spinCostMultiplier': return `spins ${pct(1 - e.perLevel)} cheaper`;
      case 'offlineBonus': return `+${pct(e.perLevel)} offline earnings`;
      case 'luck': return `+${e.perLevel} Luck`;
      case 'jackpotTokens': return `golden jackpots give ${game.data.tokens.perJackpot + e.perLevel} tokens`;
      case 'streakCap': return `Hot Streak climbs ${e.perLevel} step${e.perLevel === 1 ? '' : 's'} higher`;
      case 'extraFreeSpins': return `+${e.perLevel} free spins a trigger`;
      case 'deliveryTokens': return `a token every ${ordinal(e.every)} delivery`;
      case 'gambleHistory': return `the card gamble shows ${e.perLevel} more past cards`;
      case 'doubleWin': return `+${pct(e.perLevel)} chance a paid win pays double`; // 1.6.1: Arcade Neon
      default: return '';
    }
  }
  // "+5% payouts", or for an Epic "+20% payouts · ✦ golden jackpots give 2 tokens".
  function wearText(def: SkinDef): string {
    const effects = def.effects || [];
    if (!effects.length) return 'no buff';
    return effects.map((e, i) => (i === 0 ? describeWear(e) : `✦ ${describeWear(e)}`)).join(' · ');
  }

  // ─────────────────────── building ───────────────────────

  function buildOdds() {
    // Each rarity's listed chance, plus its real share once the pity rule is counted.
    const c = game.data.capsules;
    const chips = game.getCapsuleOdds().map((o) => {
      const pity = o.id === c.pityRarity ? ` <span class="note">(~${(o.withPity * 100).toFixed(1)}% with pity)</span>` : '';
      return `<span class="odds-chip"><span class="rarity-chip rarity-${o.id}">${o.name}</span> ${Math.round(o.chance * 100)}%${pity}</span>`;
    });
    const refunds = game.getCapsuleOdds().map((o) => `${o.name} +${o.duplicateRefund}`).join(', ');
    el.odds.innerHTML = `${chips.join('')}<div class="note">Duplicates give tokens back: ${refunds}.</div>`;
  }

  function buildWardrobe() {
    el.wardrobe.replaceChildren();
    skinTiles = new Map();
    const order = ['starter', ...game.data.capsules.rarities.map((r) => r.id)];
    for (const cat of game.data.skinCategories) {
      const group = document.createElement('div');
      group.className = 'wardrobe-group';
      const head = document.createElement('div');
      head.className = 'wardrobe-cat';
      head.textContent = cat.name;
      const grid = document.createElement('div');
      grid.className = 'wardrobe-grid';
      const skins = game.data.skins
        .filter((s) => s.category === cat.id)
        .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
      for (const def of skins) {
        const tile = document.createElement('button');
        tile.className = 'skin-tile';
        tile.innerHTML = `<span class="skin-preview"></span><span class="skin-name"></span>
          <span class="rarity-chip rarity-${def.rarity}">${rarityName(def.rarity)}</span><span class="skin-buff"></span><span class="skin-state"></span>`;
        tile.querySelector('.skin-preview')!.appendChild(skinPreview(def, def.category === 'fur' || def.category === 'hat' ? 64 : 48));
        tile.querySelector('.skin-name')!.textContent = def.name;
        tile.querySelector('.skin-buff')!.textContent = wearText(def);
        tile.addEventListener('click', (e) => {
          (e.currentTarget as HTMLElement).blur();
          if (game.equipSkin(def.id)) say(wearLine(def));
        });
        grid.appendChild(tile);
        skinTiles.set(def.id, tile);
      }
      group.append(head, grid);
      el.wardrobe.appendChild(group);
    }
  }

  function buildDiary() {
    el.diary.replaceChildren();
    diaryRows = new Map();
    for (const sticker of game.data.diary || []) {
      const row = document.createElement('div');
      row.className = 'diary-row';
      row.innerHTML = `
        <span class="diary-check"></span>
        <div class="diary-text"><div class="diary-name"></div><div class="note"></div></div>
        <div class="diary-progress"><div class="diary-bar"><div class="diary-fill"></div></div><span class="diary-count"></span></div>
        <span class="diary-reward">${iconHTML('token', 24)}+${sticker.tokens}</span>`;
      row.querySelector('.diary-name')!.textContent = sticker.name;
      row.querySelector('.note')!.textContent = sticker.description;
      // Dear Diary: a secret sticker is a mystery ("???" and a hint) until it's earned; render() reveals it.
      if (sticker.secret) {
        row.classList.add('secret');
        row.querySelector('.diary-name')!.textContent = 'Secret sticker';
        row.querySelector('.note')!.textContent = sticker.hint || 'Keep playing and see!';
      }
      // 1.3.1: a sticker can unlock an upgrade (a sticker upgrade) as well as pay tokens.
      const opens = game.data.upgrades.filter((u) => u.unlock && u.unlock.sticker === sticker.id);
      if (opens.length) {
        const line = document.createElement('div');
        line.className = 'diary-unlocks';
        line.textContent = `Unlocks the upgrade ${opens.map((u) => u.name).join(' and ')}`;
        row.querySelector('.diary-text')!.appendChild(line);
      }
      el.diary.appendChild(row);
      diaryRows.set(sticker.id, { row, fill: row.querySelector<HTMLElement>('.diary-fill')!, count: row.querySelector<HTMLElement>('.diary-count')! });
    }
  }

  // What the hamster says when it puts a skin on.
  function wearLine(def: SkinDef): string {
    const buff = def.effects && def.effects.length ? ` ${describeWear(def.effects[0]).replace(/^./, (c) => c.toUpperCase())}!` : '';
    if (def.category === 'fur') return `Ooh, new fur! How do I look?${buff}`;
    if (def.category === 'hat') return def.rarity === 'starter' ? 'Hat off!' : `A ${def.name}! How do I look?${buff}`;
    return `${def.name}! Looking cozy.${buff}`;
  }

  // Everything being worn, added up: "+15% payouts · spins 5% faster · +6 Luck …" (M10).
  function renderWardrobeTotal(): void {
    let payouts = 0;
    let speed = 1;
    let cost = 1;
    let offline = 0;
    let luck = 0;
    const twists: string[] = [];
    for (const w of game.getWardrobe()) {
      w.effects.forEach((e, i) => {
        if (e.type === 'payoutMultiplier') payouts += e.perLevel;
        else if (e.type === 'spinSpeed') speed *= e.multiplier;
        else if (e.type === 'spinCostMultiplier') cost *= e.perLevel;
        else if (e.type === 'offlineBonus') offline += e.perLevel;
        else if (e.type === 'luck') luck += e.perLevel;
        if (i > 0) twists.push(describeWear(e));
      });
    }
    const parts = [];
    if (payouts) parts.push(`+${pct(payouts)} payouts`);
    if (speed < 1) parts.push(`spins ${pct(1 - speed)} faster`);
    if (cost < 1) parts.push(`spins ${pct(1 - cost)} cheaper`);
    if (offline) parts.push(`+${pct(offline)} offline earnings`);
    if (luck) parts.push(`+${luck} Luck`);
    const html = parts.length
      ? `<b>What you're wearing:</b> ${parts.join(' · ')}${twists.length ? `<br>${twists.map((t) => `✦ ${t}`).join(' · ')}` : ''}`
      : '<b>What you\'re wearing:</b> starter skins, no buffs yet. Pull capsules to find some!';
    setHTML(el.wardrobeTotal, html);
  }

  // "1st", "2nd", "3rd", "5th", "12th" …
  function ordinal(n: number): string {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
  }

  // The other ways to earn tokens, built from data.json so the text never goes stale.
  function buildDiaryNote() {
    const t = game.data.tokens;
    const symbol = game.getMachineData().symbols.find((x) => x.id === t.jackpotSymbol);
    $('diary-note').textContent = `Goals that earn Hamster Tokens. You also get ${t.perJackpot} for a `
      + `${symbol ? symbol.name : t.jackpotSymbol} on every reel (${t.jackpotMinReels}+ reels), ${t.perDelivery} for every `
      + `${ordinal(t.deliveryEvery)} delivery, and ${t.perRetirement} for retiring.`;
  }

  function build() {
    if (!game.data.capsules) return;
    buildDiaryNote();
    buildOdds();
    buildWardrobe();
    buildDiary();
  }

  // ─────────────────────── events + input ───────────────────────

  game.on('capsuleOpened', (e) => {
    reveal = { e, at: performance.now() };
    replayClass(el.machine, 'shake'); // render() draws the wobbling capsule, then the prize
    sound.play('capsuleShake');
  });

  el.pullBtn.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    if (reveal && performance.now() - reveal.at < REVEAL_MS) return; // let the last one open first
    game.pullCapsule();
  });

  // The reveal card is redrawn, so listen on its container ("event delegation").
  el.reveal.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('.wear-btn');
    if (!button) return;
    button.blur();
    if (game.equipSkin(button.dataset.skin!)) say(wearLine(game.getSkinDef(button.dataset.skin!)!));
  });

  // ─────────────────────── drawing ───────────────────────

  function renderReveal(now: number): void {
    if (!reveal) return;
    const { e } = reveal;
    const opening = now - reveal.at < REVEAL_MS;
    if (opening) {
      setHTML(el.reveal, `<div class="reveal-card opening">${iconHTML(CAPSULE_SPRITES[e.rarity] || 'capsule', 48)}<span class="note">Opening…</span></div>`);
      return;
    }
    if (!reveal.announced) {
      reveal.announced = true;
      const def = game.getSkinDef(e.skinId)!;
      const name = rarityName(e.rarity);
      sound.play(e.rarity === game.data.capsules.pityRarity ? 'epic' : 'capsulePop');
      if (e.duplicate) {
        say(`${def.name} again! Here are ${formatWhole(e.refund)} tokens back.`);
      } else if (e.rarity === game.data.capsules.pityRarity) {
        say(`WOW, a${/^[aeiou]/i.test(name) ? 'n' : ''} ${name} capsule: ${def.name}!`, 4000);
      } else if (def.category === 'hat') {
        say(`A new hat: the ${def.name}!`);
      } else {
        say(`A new ${categoryName(def.category).toLowerCase()} skin: ${def.name}!`);
      }
    }
    const def = game.getSkinDef(e.skinId)!;
    const wearing = game.getEquippedSkin(def.category) === def.id;
    const badge = e.duplicate ? `<span class="note">Duplicate · ${iconHTML('token', 24)}+${formatWhole(e.refund)} back</span>` : '<span class="new-badge">NEW!</span>';
    const button = wearing ? '<button class="btn btn-soft wear-btn" disabled>Wearing it</button>'
      : `<button class="btn btn-primary wear-btn" data-skin="${def.id}">Wear it</button>`;
    // Rebuild only when the prize or "wearing" changes. (The preview is a real
    // element, not an HTML string, so a key is compared instead of using setHTML.)
    const key = `${e.skinId}|${wearing}|${reveal.at}`;
    if (el.reveal.dataset.key !== key) {
      el.reveal.dataset.key = key;
      el.reveal.dataset.html = '';
      el.reveal.innerHTML = `<div class="reveal-card rarity-edge-${e.rarity}">
          <span class="reveal-preview"><span class="reveal-rays rarity-${e.rarity}"></span></span>
          <div class="reveal-text"><div class="tile-name">${def.name}</div>
            <div><span class="rarity-chip rarity-${e.rarity}">${rarityName(e.rarity)}</span> <span class="note">${categoryName(def.category)}</span></div>
            <div class="skin-buff">${wearText(def)}</div>
            ${badge}</div>
          ${button}
        </div>`;
      el.reveal.querySelector('.reveal-preview')!.appendChild(skinPreview(def, def.category === 'fur' || def.category === 'hat' ? 64 : 48));
      // 1.0: the prize bursts out in its rarity's colour; the rarest one with confetti too.
      if (!e.duplicate || e.rarity !== 'common') {
        const preview = el.reveal.querySelector('.reveal-preview');
        const colour = getComputedStyle(document.documentElement).getPropertyValue(`--rarity-${e.rarity}`).trim() || fx.colors.gold[0];
        fx.burstAt(preview, { count: e.rarity === game.data.capsules.pityRarity ? 36 : 20, palette: [colour, '#ffffff', fx.colors.gold[0]], speed: 220 });
        fx.ringAt(preview, { count: 24, speed: 300, palette: [colour, '#ffffff'] });
        if (e.rarity === game.data.capsules.pityRarity) fx.confetti(60, el.machine.closest('.capsule-card'));
      }
    }
  }

  function render(now: number): void {
    const s = game.state;
    setText(el.tokens, formatWhole(s.tokens));
    const cost = game.getPullCost();
    const opening = reveal && now - reveal.at < REVEAL_MS;
    el.pullBtn.disabled = opening || !game.canPull();
    setHTML(el.pullBtn, `Pull a capsule · ${iconHTML('token', 24)} ${formatWhole(cost)}`);
    const left = game.getPityRemaining();
    setText(el.pity, left <= 1
      ? `The next capsule is guaranteed ${rarityName(game.data.capsules.pityRarity)}!`
      : `${rarityName(game.data.capsules.pityRarity)} guaranteed within ${left} pulls.`);
    renderReveal(now);

    for (const [id, tile] of skinTiles) {
      const owned = game.isSkinOwned(id);
      const wearing = game.getEquippedSkin(game.getSkinDef(id)!.category) === id;
      tile.classList.toggle('locked', !owned);
      tile.classList.toggle('wearing', wearing);
      tile.disabled = !owned;
      const casinoOnly = !!game.getSkinDef(id)!.casino; // M11: sold at the casino's Prize Counter, never in capsules
      setText(tile.querySelector('.skin-state')!, wearing ? 'Wearing' : owned ? 'Tap to wear' : casinoOnly ? 'Casino prize' : 'Not found yet');
    }
    renderWardrobeTotal();

    for (const [id, r] of diaryRows) {
      const p = game.getDiaryProgress(id)!;
      const value = Math.min(p.value, p.target);
      r.row.classList.toggle('done', p.done);
      r.fill.style.width = `${((value / p.target) * 100).toFixed(1)}%`;
      const fmt = (n: number) => (p.target >= 1000 ? formatCoins(n) : String(Math.floor(n)));
      const sticker = game.data.diary.find((d) => d.id === id)!;
      if (sticker.secret && p.done && r.row.classList.contains('secret')) {
        // Earned: now it shows what it was for.
        r.row.classList.remove('secret');
        setText(r.row.querySelector('.diary-name')!, sticker.name);
        setText(r.row.querySelector('.note')!, sticker.description);
      }
      // A secret's progress would give it away, so it shows "???" until it's done.
      setText(r.count, p.done ? 'Done!' : sticker.secret ? '???' : `${fmt(value)} / ${fmt(p.target)}`);
    }

    // Dots: a pull you can afford, or stickers you haven't looked at yet.
    const stickers = Object.keys(s.diary).length;
    if (subtabs.current === 'diary') stickersSeen = stickers;
    subtabs.setDot('machine', game.canPull());
    subtabs.setDot('diary', stickers > stickersSeen);
  }

  build();
  return { build, render, openSub: subtabs.open };
}
