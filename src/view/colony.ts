// colony.ts — VIEW layer. 1.4.0, The Great Migration: the Family tab's Colony
// sub-tab. It shows how close the family is to the mega rebirth (the whole tree
// planted), what migrating would bring (Golden Whiskers) and the button (two taps);
// the colony perks to buy with whiskers; the Wise Elders' settings (automation);
// and which Colony Trials the family has beaten in this colony (a trial is picked in
// the Big Cage, before a life starts: bigcage.ts).
//
// Like the rest of the view it only reads game.state and calls actions (migrate,
// buyPerk, setAuto). ui.ts creates it and calls render() every frame.

import { spriteImg, perkIcon } from './art.ts';
import { describeEffect, ordinal } from './shop.ts';
import { formatWhole, setText, setHTML, createSubTabs, replayClass, popText, iconHTML } from './dom.ts';
import { divide } from '../logic/money.ts';
import type { Game } from '../logic/game.ts';
import type { PerkDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';

interface Options {
  say: (text: string, ms?: number) => void;
  sound: Sound;
  fx: Fx;
  settings: Settings;
  onSettingsChange: () => void;
}

interface PerkTile {
  def: PerkDef;
  tile: HTMLElement;
  button: HTMLButtonElement;
  level: HTMLElement;
  effect: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
}

// "+12 Golden Whiskers" with the whisker icon (in an inline box: a sprite is a block).
export const whiskerLabel = (text: string) => `<span class="whisker-amount">${iconHTML('whisker')}${text}</span>`;

export function createColonyView(game: Game, { say, sound, fx, settings, onSettingsChange }: Options) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const el = {
    row: $('family-subtab-row'), name: $('colony-name'), sub: $('colony-sub'), fill: $('colony-bar-fill'), progress: $('colony-progress'),
    gain: $('colony-gain'), gainLabel: $('colony-gain-label'), explain: $('colony-explain'), migrate: $<HTMLButtonElement>('migrate-btn'),
    perkNote: $('perk-note'), perks: $('perk-grid'),
    elders: $('elders-card'), eldersNote: $('elders-note'), eldersRetire: $<HTMLButtonElement>('elders-retire'),
    eldersShare: $('elders-share'), eldersPlant: $<HTMLButtonElement>('elders-plant'),
    trials: $('trials-card'), trialsNote: $('trials-note'), trialList: $('trial-list'),
  };
  const subtabs = createSubTabs($('family-subtabs'), $('tab-family'), { key: 'family', settings, onSettingsChange });
  let armed = 0; // migrating needs two taps; this is when the first tap expires
  let shown = false; // the Colony sub-tab is showing (once the family could migrate)
  let announced = false; // the hamster has said the family can migrate

  // ── the perk tiles (like the shop's) ──
  const tiles: PerkTile[] = (game.data.colony ? game.data.colony.perks : []).map((def) => {
    const tile = document.createElement('div');
    tile.className = 'tile perk-tile';
    tile.innerHTML = `
      <div class="tile-info">
        <span class="tile-icon"></span>
        <span class="tile-text"><span class="tile-name"></span><span class="tile-level"></span><span class="tile-effect"></span></span>
      </div>
      <p class="perk-desc"></p>
      <button class="buy-btn"><span class="buy-fill"></span><span class="buy-label"></span></button>`;
    tile.querySelector('.tile-icon')!.appendChild(spriteImg(perkIcon(def), 32, def.name[0]));
    tile.querySelector('.tile-name')!.textContent = def.name;
    tile.querySelector('.perk-desc')!.textContent = def.description;
    const button = tile.querySelector<HTMLButtonElement>('.buy-btn')!;
    button.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      game.buyPerk(def.id);
    });
    el.perks.appendChild(tile);
    return {
      def, tile, button,
      level: tile.querySelector<HTMLElement>('.tile-level')!, effect: tile.querySelector<HTMLElement>('.tile-effect')!,
      fill: tile.querySelector<HTMLElement>('.buy-fill')!, label: tile.querySelector<HTMLElement>('.buy-label')!,
    };
  });

  // ── the Wise Elders' switches and their share buttons ──
  el.eldersRetire.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    game.setAuto({ retire: !game.state.auto.retire });
  });
  el.eldersPlant.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    game.setAuto({ plant: !game.state.auto.plant });
  });
  el.eldersShare.replaceChildren(...game.getAutoShares().map((share) => {
    const b = document.createElement('button');
    b.className = 'seg-btn';
    b.dataset.share = String(share);
    b.textContent = `${Math.round(share * 100)}%`;
    b.title = `Retire once a life's seeds reach ${Math.round(share * 100)}% of the seeds the family has earned this colony`;
    b.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).blur();
      game.setAuto({ share });
    });
    return b;
  }));

  el.migrate.addEventListener('click', (e) => {
    (e.currentTarget as HTMLElement).blur();
    const now = performance.now();
    if (now < armed) {
      armed = 0;
      game.migrate();
    } else {
      armed = now + 3000;
      sound.play('tick');
    }
  });

  // ── game events ──
  game.on('perkBought', (e) => {
    sound.play('buy');
    const t = tiles.find((x) => x.def.id === e.id);
    if (t) {
      replayClass(t.tile, 'bought');
      fx.burstAt(t.button, { count: 14, palette: fx.colors.gold, speed: 160 });
      popText(t.button, e.level > 1 ? `LV ${e.level}!` : 'Yours!', 'seed');
    }
    if (game.getPerkDef(e.id)!.effect.type === 'autoRetire') say('The Wise Elders are here to help! Switch them on in the Colony tab when you like.', 5000);
  });
  game.on('trialCompleted', (e) => {
    const t = game.getTrialDef(e.id)!;
    sound.play('star');
    fx.confetti(60);
    say(`Colony Trial beaten: ${t.name}! +${formatWhole(e.whiskers)} Golden Whiskers, and the twist is over.`, 6000);
  });

  // ── drawing ──
  function colonyReady(): boolean {
    const s = game.state;
    return !!game.data.colony && (s.colony > 0 || s.whiskers.gt(0) || game.isTreeComplete());
  }

  function render(now: number, visible: boolean): void {
    const s = game.state;
    if (!game.data.colony) return;
    if (!shown && colonyReady()) {
      shown = true;
      if (s.colony === 0 && !announced) {
        announced = true;
        say('The whole Family Tree is planted! The family could make the Great Migration to a new colony. Peek at Family → Colony.', 7000);
      }
    }
    el.row.classList.toggle('hidden', !shown);
    subtabs.setHidden('colony', !shown);
    const canMigrate = game.canMigrate();
    const anyPerk = tiles.some((t) => game.canBuyPerk(t.def.id));
    subtabs.setDot('colony', canMigrate || anyPerk);
    if (!shown || !visible || subtabs.current !== 'colony') return;

    // The migration card
    const c = game.data.colony;
    setText(el.sub, `Colony ${s.colony + 1} · generation ${s.generation} · ${formatWhole(s.whiskers)} ${c.currencyName}`);
    const p = game.getTreeProgress();
    el.fill.style.width = `${(p.total ? (p.done / p.total) * 100 : 0).toFixed(1)}%`;
    setText(el.progress, game.isTreeComplete()
      ? 'The whole Family Tree is planted! The family can migrate (from here, or from the Big Cage).'
      : `The whole tree first: ${p.done} of ${p.total} traits planted to their max (Family Fortune once).`);
    const pending = game.getPendingWhiskers();
    setText(el.gainLabel, game.isTreeComplete() ? 'Migrate now:' : 'Migrating would bring:');
    setHTML(el.gain, whiskerLabel(`+${formatWhole(pending)} ${c.currencyName}`));
    setText(el.explain, `A new colony: the family starts again at generation 1. Heirloom Seeds, the Family Tree, Machine Stars and this life start over. `
      + `It keeps its ${c.currencyName} and perks, skins, tokens, stickers, casino chips and stats. The whiskers come from every seed earned this colony `
      + `(${formatWhole(game.getMigrationSeeds())} so far): more seeds, more whiskers. A migrated family finds Moving Day, colony traits and Colony Trials.`);
    el.migrate.disabled = !canMigrate;
    setText(el.migrate, now < armed ? 'Tap again: pack up for a new colony!' : 'Migrate to a new colony');

    // The perks
    setHTML(el.perkNote, `${whiskerLabel(formatWhole(s.whiskers))} to spend · kept for good`);
    for (const t of tiles) {
      const level = game.getPerkLevel(t.def.id);
      const maxed = game.isPerkMaxed(t.def.id);
      const cost = game.getPerkCost(t.def.id);
      const affordable = game.canBuyPerk(t.def.id);
      setText(t.level, t.def.maxLevel ? `Lv ${level}/${t.def.maxLevel}` : `Lv ${level}`);
      setHTML(t.effect, describeEffect(game, t.def, game.previewPerk(t.def.id)));
      t.button.className = `buy-btn ${maxed ? 'maxed' : affordable ? '' : 'poor'}`;
      t.tile.classList.toggle('owned', level > 0);
      t.fill.style.width = maxed || affordable ? '0%' : `${Math.min(100, divide(s.whiskers, cost).toNumber() * 100).toFixed(1)}%`;
      setHTML(t.label, maxed ? 'Owned' : whiskerLabel(formatWhole(cost)));
    }

    // The Wise Elders
    const elders = game.hasAutoRetire();
    el.elders.classList.toggle('hidden', !elders);
    if (elders) {
      const a = s.auto;
      el.elders.classList.toggle('off', !a.retire);
      setText(el.eldersRetire, a.retire ? 'On' : 'Off');
      el.eldersRetire.setAttribute('aria-pressed', String(a.retire));
      setText(el.eldersPlant, a.plant ? 'On' : 'Off');
      el.eldersPlant.setAttribute('aria-pressed', String(a.plant));
      for (const b of el.eldersShare.children) b.classList.toggle('active', Number((b as HTMLElement).dataset.share) === a.share);
      setText(el.eldersNote, !a.retire ? 'Switched off: you retire yourself.'
        : s.trial ? 'Resting during the Colony Trial.'
          : `Next: at ${formatWhole(game.getAutoRetireGoal())} seeds (${formatWhole(game.getPendingSeeds())} now)`);
    }

    // The trials beaten this colony (after the first migration; each colony's first
    // hamsters have too little for a twist to take away, so they open a bit later)
    const shownTrials = s.colony >= c.trialsFrom;
    el.trials.classList.toggle('hidden', !shownTrials);
    if (shownTrials) {
      const trials = c.trials;
      const done = trials.filter((t) => s.trialsDone[t.id]).length;
      setText(el.trialsNote, game.trialsOpen() ? `${done} of ${trials.length} beaten this colony · pick one in the Big Cage`
        : `From each colony's ${ordinal(c.trialGeneration)} hamster: pick one in the Big Cage`);
      const key = trials.map((t) => `${t.id}${s.trialsDone[t.id] ? 1 : 0}${s.trial === t.id ? 'n' : ''}`).join() + `|${formatWhole(game.getTrialWhiskers(trials[0].id))}`;
      if (el.trialList.dataset.key !== key) {
        el.trialList.dataset.key = key;
        el.trialList.replaceChildren(...trials.map((t) => {
          const row = document.createElement('div');
          row.className = `trial-row${s.trialsDone[t.id] ? ' done' : ''}${s.trial === t.id ? ' now' : ''}`;
          const status = s.trialsDone[t.id] ? '✓ Beaten' : s.trial === t.id ? 'Under way' : whiskerLabel(`+${formatWhole(game.getTrialWhiskers(t.id))}`);
          row.innerHTML = `<div><b>${t.name}</b><div class="note">${t.description}</div></div><span class="trial-status">${status}</span>`;
          return row;
        }));
      }
    }
  }

  return { render, openSub: subtabs.open };
}
