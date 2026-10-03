// colony.ts — VIEW layer. 1.4.0, The Great Migration: the Family tab's Colony sub-tab
// (rebuilt on the kit in "New Digs" part 4; DESIGN §31). It shows how close the family is to
// the mega rebirth (the whole tree planted), what migrating would bring (Golden Whiskers) and
// the two-tap button, with the long explanation folded away; the colony perks as tiles (a tap
// opens the tray's sheet, the buy button buys, like the upgrades); the Wise Elders' switches
// (automation); and which Colony Trials the family has beaten in this colony (a trial is picked
// in the Big Cage, before a life starts: bigcage.ts).
//
// It also owns the Family tab's two sub-tabs (Family, Colony). Like the rest of the view it only
// reads game.state and calls actions (migrate, buyPerk, setAuto). family.ts creates it and calls
// render() every frame.

import { perkIcon, spriteImg } from './art.ts';
import { describeEffect } from './shop.ts';
import { formatWhole, setText, setHTML, replayClass, popText } from './dom.ts';
import {
  createSubTabs, ordinal, byId, h, card, gauge, tile, buyButton, confirmButton, toggle, segmented, listRow, more, amount, amountHTML,
} from './kit.ts';
import { divide } from '../logic/money.ts';
import type { Sheet, Tile, BuyButton, BuyState, TileTone } from './kit.ts';
import type { Game } from '../logic/game.ts';
import type { PerkDef } from '../logic/types.ts';
import type { Settings } from '../platform/save.ts';
import type { Fx } from './fx.ts';
import type { Sound } from './sound.ts';

interface Options {
  sheet: Sheet;
  say: (text: string, ms?: number) => void;
  sound: Sound;
  fx: Fx;
  settings: Settings;
  onSettingsChange: () => void;
}

interface PerkTile {
  def: PerkDef;
  tile: Tile;
  buy: BuyButton;
}

// What a perk's buy button shows.
export function perkState(game: Game, id: string): BuyState {
  return game.isPerkMaxed(id) ? 'maxed' : game.canBuyPerk(id) ? 'ready' : 'saving';
}

export function createColonyView(game: Game, { sheet, say, sound, fx, settings, onSettingsChange }: Options) {
  const row = byId('family-subtab-row');
  const panel = byId('colony-main');
  const subtabs = createSubTabs(byId('family-subtabs'), byId('tab-family'), {
    key: 'family', settings, onSettingsChange,
    icons: { family: 'heart', colony: 'whisker' },
    // A new sub-tab starts at its top (the other one's scroll would land you mid-page).
    onChange: () => { sheet.hide(); byId('tab-family').scrollTop = 0; },
  });
  let shown = false; // the Colony sub-tab is showing (once the family could migrate)
  let announced = false; // the hamster has said the family can migrate
  const c = game.data.colony;

  // ── The migration card ──
  const mig = card({ tone: 'gold', className: 'colony-migrate' });
  const head = mig.body.appendChild(h('div', 'family-who'));
  head.append(spriteImg('whiskerIcon', 48, ''));
  const headText = head.appendChild(h('div', 'family-who-text'));
  headText.append(h('div', 'family-name', 'The Great Migration'));
  const sub = headText.appendChild(h('div', 'family-line'));
  const treeGauge = gauge({ tone: 'whisker', label: 'Family Tree planted' });
  mig.body.append(treeGauge.el);
  const progress = mig.body.appendChild(h('p', 'k-note'));
  const gainLine = mig.body.appendChild(h('div', 'family-gain'));
  const gainLabel = gainLine.appendChild(h('span'));
  gainLine.append(h('span', 'family-plus', '+'));
  const gain = amount('whisker', 24);
  gainLine.append(gain.el);
  gainLine.append(h('span', '', c ? c.currencyName : 'Golden Whiskers'));
  const migrate = confirmButton({
    label: 'Migrate to a new colony', armedLabel: 'Tap again: pack up for a new colony!', tone: 'gold', size: 'lg', className: 'family-retire',
    onConfirm: () => { game.migrate(); },
  });
  mig.body.append(migrate.el);
  const how = more('How it works');
  const explain = how.body.appendChild(h('p'));
  mig.body.append(how.el);

  // ── The perks (like the upgrades: a tap on a tile opens its sheet; its button buys) ──
  const perksHead = h('div', 'section-head');
  perksHead.append(h('h3', '', 'Colony perks'));
  const perkNote = perksHead.appendChild(h('span', 'note'));
  const perkList = h('div', 'shop-list colony-perks');
  const tiles: PerkTile[] = (c ? c.perks : []).map((def) => {
    const buy = buyButton({ onClick: () => game.buyPerk(def.id), ariaLabel: `Buy ${def.name}` });
    const t = tile({ icon: perkIcon(def), iconSize: 32, name: def.name, onOpen: () => openPerk(def.id), buy, pips: def.maxLevel && def.maxLevel <= 10 ? def.maxLevel : 0, className: 'shop-tile' });
    perkList.append(t.el);
    return { def, tile: t, buy };
  });

  // ── The Wise Elders' settings (once the perk is bought) ──
  const elders = card({ title: 'The Wise Elders', icon: 'glasses', className: 'colony-elders hidden' });
  const eldersNote = elders.head.appendChild(h('span', 'k-note colony-head-note'));
  const retireSwitch = toggle({ label: 'Retire by themselves', ariaLabel: 'The Wise Elders retire by themselves', onChange: (on) => game.setAuto({ retire: on }) });
  const shareRow = h('div', 'colony-elders-row');
  shareRow.append(h('span', '', '…when a life\'s seeds reach'));
  const share = segmented({
    options: game.getAutoShares().map((v) => ({ value: v, label: `${Math.round(v * 100)}%`, title: `Retire once a life's seeds reach ${Math.round(v * 100)}% of the seeds the family has earned this colony` })),
    ariaLabel: 'When to retire', onPick: (v) => game.setAuto({ share: v }),
  });
  shareRow.append(share.el);
  const plantSwitch = toggle({ label: 'Plant the cheap traits', ariaLabel: 'The Wise Elders plant the cheap traits', onChange: (on) => game.setAuto({ plant: on }) });
  elders.body.append(retireSwitch.el, shareRow, plantSwitch.el);

  // ── The Colony Trials beaten this colony ──
  const trials = card({ title: 'Colony Trials', icon: 'whisker', className: 'colony-trials hidden' });
  const trialsNote = trials.body.appendChild(h('p', 'k-note'));
  const trialList = trials.body.appendChild(h('div', 'colony-trial-list'));
  const trialRows = (c ? c.trials : []).map((t) => {
    const r = listRow({ title: t.name });
    r.update({ sub: t.description });
    trialList.append(r.el);
    return { def: t, row: r, key: '' };
  });

  panel.append(mig.el, perksHead, perkList, elders.el, trials.el);

  // ── A perk's sheet (in the tray) ──
  let perkSheet: { id: string; effect: HTMLElement; buy: BuyButton } | null = null;
  function openPerk(id: string): void {
    const key = `colony:perk:${id}`;
    if (sheet.key === key) { sheet.hide(); return; }
    const def = game.getPerkDef(id)!;
    if (sheet.show(key, { icon: perkIcon(def), iconSize: 32, title: def.name })) {
      const effect = h('p', 'shop-effect');
      sheet.body.append(h('p', 'k-note', def.description), effect, h('p', 'k-note', 'Bought with Golden Whiskers, and kept for good: every colony after this one has it too.'));
      const buy = buyButton({ size: 'lg', onClick: () => game.buyPerk(id), ariaLabel: `Buy ${def.name}` });
      sheet.foot.append(buy.el);
      perkSheet = { id, effect, buy };
    }
    for (const t of tiles) t.tile.setOpen(t.def.id === id);
    const t = tiles.find((x) => x.def.id === id);
    if (t) requestAnimationFrame(() => t.tile.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  sheet.onHide((key) => {
    if (!key.startsWith('colony:')) return;
    perkSheet = null;
    for (const t of tiles) t.tile.setOpen(false);
  });

  // The migration's word from the hamster, as the button arms (the kit's button arms on this click).
  migrate.el.addEventListener('click', () => {
    if (migrate.armed) say(`A new colony: the tree, the seeds and the stars start again, for ${formatWhole(game.getPendingWhiskers())} Golden Whiskers. Tap again to go!`, 4000);
  });

  // ── game events ──
  game.on('perkBought', (e) => {
    sound.play('buy');
    const t = tiles.find((x) => x.def.id === e.id);
    if (t) {
      replayClass(t.tile.el, 'bought');
      fx.burstAt(t.buy.el, { count: 14, palette: fx.colors.gold, speed: 160 });
      popText(t.buy.el, e.level > 1 ? `LV ${e.level}!` : 'Yours!', 'seed');
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
    return !!c && (s.colony > 0 || s.whiskers.gt(0) || game.isTreeComplete());
  }

  function render(_now: number, visible: boolean): void {
    const s = game.state;
    if (!c) { row.classList.add('hidden'); return; }
    if (!shown && colonyReady()) {
      shown = true;
      if (s.colony === 0 && !announced) {
        announced = true;
        say('The whole Family Tree is planted! The family could make the Great Migration to a new colony. Peek at Family → Colony.', 7000);
      }
    }
    row.classList.toggle('hidden', !shown);
    subtabs.setHidden('colony', !shown);
    const canMigrate = game.canMigrate();
    subtabs.setDot('colony', canMigrate || tiles.some((t) => game.canBuyPerk(t.def.id)));
    if (!shown || !visible || subtabs.current !== 'colony') return;

    // The migration card
    setText(sub, `Colony ${s.colony + 1} · generation ${s.generation} · ${formatWhole(s.whiskers)} ${c.currencyName}`);
    const p = game.getTreeProgress();
    treeGauge.update(p.total ? p.done / p.total : 0);
    setText(progress, game.isTreeComplete()
      ? 'The whole Family Tree is planted! The family can migrate (from here, or from the Big Cage).'
      : `The whole tree first: ${p.done} of ${p.total} traits planted to their max (Family Fortune once).`);
    setText(gainLabel, game.isTreeComplete() ? 'Migrate now:' : 'Migrating would bring:');
    gain.update(game.getPendingWhiskers());
    migrate.update({ disabled: !canMigrate });
    setText(explain, `A new colony: the family starts again at generation 1. Heirloom Seeds, the Family Tree, Machine Stars and this life start over. `
      + `It keeps its ${c.currencyName} and perks, skins, tokens, stickers, casino chips and stats. The whiskers come from every seed earned this colony `
      + `(${formatWhole(game.getMigrationSeeds())} so far): more seeds, more whiskers. A migrated family finds Moving Day, colony traits and Colony Trials.`);

    // The perks
    setHTML(perkNote, `${amountHTML('whisker', s.whiskers)} to spend · kept for good`);
    for (const t of tiles) {
      const id = t.def.id;
      const level = game.getPerkLevel(id);
      const maxed = game.isPerkMaxed(id);
      const cost = game.getPerkCost(id);
      const state = perkState(game, id);
      const progressShare = state === 'saving' ? divide(s.whiskers, cost).toNumber() : 0;
      const tone: TileTone = maxed ? 'maxed' : state === 'ready' ? 'ready' : level > 0 ? 'planted' : 'plain';
      const preview = game.previewPerk(id);
      t.tile.update({ level: maxed ? 'Max' : t.def.maxLevel ? `Lv ${level}/${t.def.maxLevel}` : `Lv ${level}`, effect: describeEffect(game, t.def, preview), pips: level, tone });
      t.buy.update({ state, cost, currency: 'whisker', progress: progressShare, label: 'Owned' });
      if (perkSheet && perkSheet.id === id && sheet.key === `colony:perk:${id}`) {
        sheet.setTag(maxed ? 'Max · kept for good' : t.def.maxLevel ? `Lv ${level} of ${t.def.maxLevel} · kept for good` : `Lv ${level} · kept for good`);
        setHTML(perkSheet.effect, describeEffect(game, t.def, preview));
        perkSheet.buy.update({ state, cost, currency: 'whisker', progress: progressShare, label: 'Owned' });
      }
    }

    // The Wise Elders
    const hasElders = game.hasAutoRetire();
    elders.el.classList.toggle('hidden', !hasElders);
    if (hasElders) {
      const a = s.auto;
      retireSwitch.update(a.retire);
      share.update(a.share);
      elders.el.classList.toggle('is-off', !a.retire); // (the rest only matters while they retire)
      plantSwitch.update(a.plant);
      setText(eldersNote, !a.retire ? 'Off: you retire yourself.'
        : s.trial ? 'Resting during the Colony Trial.'
          : `Next: at ${formatWhole(game.getAutoRetireGoal())} seeds (${formatWhole(game.getPendingSeeds())} now)`);
    }

    // The trials beaten this colony (after the first migration; each colony's first
    // hamsters have too little for a twist to take away, so they open a bit later)
    const shownTrials = s.colony >= c.trialsFrom;
    trials.el.classList.toggle('hidden', !shownTrials);
    if (shownTrials) {
      const done = c.trials.filter((t) => s.trialsDone[t.id]).length;
      setText(trialsNote, game.trialsOpen() ? `${done} of ${c.trials.length} beaten this colony · pick one in the Big Cage`
        : `From each colony's ${ordinal(c.trialGeneration)} hamster: pick one in the Big Cage`);
      for (const r of trialRows) {
        const beaten = !!s.trialsDone[r.def.id];
        const now = s.trial === r.def.id;
        const whiskers = game.getTrialWhiskers(r.def.id);
        const locked = !game.isTrialUnlocked(r.def.id); // Double Trouble (1.10): beat both halves first
        const key = `${beaten}${now}${locked}${formatWhole(whiskers)}`;
        if (key === r.key) continue;
        r.key = key;
        r.row.update({ valueHTML: beaten ? 'Beaten' : now ? 'Under way' : locked ? 'Beat both first' : `+${amountHTML('whisker', whiskers)}` });
        r.row.el.classList.toggle('is-locked', locked && !beaten);
        r.row.el.classList.toggle('is-done', beaten);
        r.row.el.classList.toggle('is-now', now);
      }
    }
  }

  return {
    render,
    openSub: subtabs.open,
    get current() { return subtabs.current; },
  };
}
