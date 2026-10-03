// family.ts — VIEW layer. The Family tab (1.7: "New Digs" part 4, rebuilt on the kit; DESIGN §31),
// split out of ui.ts. Two sub-tabs:
//   1) Family: the retire letter (who's retiring, "Retire now: +N Heirloom Seeds", the bonus now →
//      after, a gauge to the next seed, and the two-tap Retire button; what resets and what's kept
//      is folded under "How it works"), then the traits the family has planted, as chips you can
//      tap: the tray's sheet says what each does (it used to be a hover tooltip, which a phone
//      can't show).
//   2) Colony (1.4.0, colony.ts): the Great Migration, the perks, the Wise Elders, the trials.
// The tab itself appears once the hamster could retire for its first seed, with a word from the
// hamster and a dot until you open it.
// Like the rest of the view it only reads game.state and calls actions (retire).

import { treeIcon, applySprite, hamsterSprite } from './art.ts';
import { furColors, hatOf } from './skins.ts';
import { describeEffect } from './shop.ts';
import { createColonyView } from './colony.ts';
import { formatCoins, setText, setHTML } from './dom.ts';
import { byId, h, card, gauge, chip, statRow, confirmButton, more, amount, keyedList, appeared } from './kit.ts';
import type { Sheet } from './kit.ts';
import type { Game } from '../logic/game.ts';
import type { Money } from '../logic/money.ts';
import type { TreeNodeDef } from '../logic/types.ts';
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
  bonusText: (bonus: Money) => string; // "+4.5%"
}

interface TraitChip {
  el: HTMLButtonElement;
  label: HTMLElement;
}

export function createFamilyView(game: Game, { sheet, say, sound, fx, settings, onSettingsChange, bonusText }: Options) {
  const tab = byId('family-tab');
  const panel = byId('family-main');
  const colony = createColonyView(game, { sheet, say, sound, fx, settings, onSettingsChange });

  // The tab appears once the hamster could retire for its first seed. If it was already
  // unlocked when the page loaded, it isn't announced again.
  const unlocked = () => {
    const s = game.state;
    // A migrated family (colony 2 on) starts again at generation 1 with no seeds, but its
    // Colony sub-tab (the perks its Golden Whiskers buy) must stay reachable.
    return s.colony > 0 || s.generation > 1 || s.seeds.gt(0) || s.seedsEarned.gt(0) || game.canRetire();
  };
  let shown = unlocked();
  let fresh = false; // a dot on the tab until you open it

  // ── The retire letter ──
  const letter = card({ tone: 'heirloom', className: 'family-letter' });
  const who = letter.body.appendChild(h('div', 'family-who'));
  const portrait = who.appendChild(h('img', 'family-portrait')) as HTMLImageElement;
  portrait.alt = '';
  portrait.dataset.sprite = 'hamster'; // (ui.ts repaints every hamster sprite when the fur or hat changes)
  portrait.dataset.size = '64';
  applySprite(portrait, hamsterSprite('hamster', hatOf(game)), 64, furColors(game));
  const whoText = who.appendChild(h('div', 'family-who-text'));
  const pupName = whoText.appendChild(h('div', 'family-name'));
  const pupLine = whoText.appendChild(h('div', 'family-line'));
  // "Retire now: +12 Heirloom Seeds", the big line
  const gainLine = letter.body.appendChild(h('div', 'family-gain'));
  gainLine.append(h('span', '', 'Retire now:'), h('span', 'family-plus', '+'));
  const gain = amount('seed', 24);
  gainLine.append(gain.el);
  const gainUnit = gainLine.appendChild(h('span'));
  const bonus = statRow('Heirloom bonus');
  letter.body.append(bonus.el);
  const jarFull = chip('The seed jar is full', 'gold', 'heirloom');
  letter.body.append(jarFull.el);
  const seedGauge = gauge({ tone: 'heirloom', label: 'Next Heirloom Seed' });
  letter.body.append(seedGauge.el);
  const nextSeed = letter.body.appendChild(h('p', 'k-note family-next'));
  const retire = confirmButton({
    label: 'Retire to the Big Cage', armedLabel: 'Tap again to retire', tone: 'gold', size: 'lg', className: 'family-retire',
    onConfirm: () => { if (game.canRetire()) game.retire(); },
  });
  letter.body.append(retire.el);
  const how = more('How it works');
  const howText = how.body.appendChild(h('p'));
  const howJar = how.body.appendChild(h('p'));
  letter.body.append(how.el);

  // ── The traits the family has planted (the tree itself only grows in the Big Cage) ──
  const traitsCard = card({ title: 'Family Tree', icon: 'heirloom', className: 'family-traits-card' });
  const traitCount = traitsCard.head.appendChild(h('span', 'k-note family-count'));
  const traitList = traitsCard.body.appendChild(h('div', 'family-traits'));
  traitList.setAttribute('role', 'list');
  const traitsEmpty = traitsCard.body.appendChild(h('p', 'k-note', 'Nothing planted yet. Retire, and plant Heirloom Seeds in the Big Cage: every trait you plant is the family\'s for good.'));
  const traitsHelp = traitsCard.body.appendChild(h('p', 'k-note', 'Traits every future pup is born with. Tap one to read about it. Retire and the tree grows in the Big Cage, where you plant them.'));
  panel.append(letter.el, traitsCard.el);
  let chips = new Map<string, TraitChip>();

  function makeChip(def: TreeNodeDef): TraitChip {
    const el = h('button', 'k-chip tone-heirloom family-trait');
    el.type = 'button';
    el.setAttribute('role', 'listitem');
    const icon = treeIcon(def);
    if (icon) el.append(applyIcon(icon));
    const label = el.appendChild(h('span'));
    el.addEventListener('click', () => { el.blur(); openTrait(def.id); });
    return { el, label };
  }
  function applyIcon(name: string): HTMLImageElement {
    const img = h('img', 'sprite') as HTMLImageElement;
    img.alt = '';
    applySprite(img, name, 16);
    return img;
  }

  // ── A planted trait's sheet (in the tray) ──
  let traitSheet: { id: string; effect: HTMLElement } | null = null;
  function openTrait(id: string): void {
    const key = `family:trait:${id}`;
    if (sheet.key === key) { sheet.hide(); return; }
    const def = game.getTreeNodeDef(id);
    if (!def) return;
    if (sheet.show(key, { icon: treeIcon(def) || 'heirloom', iconSize: 32, title: def.name })) {
      const effect = h('p', 'shop-effect');
      sheet.body.append(h('p', 'k-note', def.description), effect, h('p', 'k-note', 'Kept by every future pup. Plant more levels in the Big Cage when you retire.'));
      traitSheet = { id, effect };
    }
    drawTraitSheet();
  }
  function drawTraitSheet(): void {
    if (!traitSheet || sheet.key !== `family:trait:${traitSheet.id}`) return;
    const def = game.getTreeNodeDef(traitSheet.id)!;
    const level = game.getTreeLevel(def.id);
    const branch = game.data.familyTree.branches.find((b) => b.id === def.branch);
    sheet.setTag(`${branch ? `${branch.name} · ` : ''}${def.maxLevel ? `Lv ${level} of ${def.maxLevel}` : `Lv ${level}`}`);
    setHTML(traitSheet.effect, describeEffect(game, def, game.previewTreeNode(def.id)));
  }
  sheet.onHide((key) => { if (key.startsWith('family:')) traitSheet = null; });

  // ─────────────────────── drawing ───────────────────────

  // Every frame from ui.ts. Hidden, it only keeps the tab (and its dot, 4 times a second) up to date.
  function render(now: number, visible: boolean, tick: boolean): void {
    const s = game.state;
    if (!shown && unlocked()) {
      shown = true;
      fresh = true;
      say(`I've earned an Heirloom Seed! I could retire and pass it on to a new pup. Peek at the Family tab.`, 6000);
      appeared(tab, 'tab:family'); // 1.9.0: the tab unlocks (unlock.ts)
    }
    tab.classList.toggle('hidden', !shown);
    // The tab's dot: something to plant, a perk to buy, or a migration ready.
    if (visible || tick) {
      const anyBuyable = game.data.familyTree && game.data.familyTree.nodes.some((n) => game.canBuyTreeNode(n.id));
      const colonyNews = game.canMigrate() || (game.data.colony ? game.data.colony.perks.some((p) => game.canBuyPerk(p.id)) : false);
      tab.classList.toggle('alert', fresh || anyBuyable || colonyNews);
    }
    colony.render(now, shown && visible);
    if (!shown || !visible || colony.current !== 'family') return;

    // The letter
    const name = game.getPupName();
    setText(pupName, name);
    setText(pupLine, `Generation ${s.generation}${s.colony > 0 ? ` · colony ${s.colony + 1}` : ''} · earned ${formatCoins(s.run.coinsEarned)} coins this life`);
    const pending = game.getPendingSeeds();
    gain.update(pending);
    setText(gainUnit, `Heirloom Seed${pending.eq(1) ? '' : 's'}`);
    // The seed jar (M9): past a full jar, more seeds held add nothing (plant them).
    const after = game.getHeirloomBonusFor(s.seeds.add(pending));
    const full = s.seeds.add(pending).gte(game.getSeedJarSeeds());
    bonus.updateHTML(`${bonusText(game.getHeirloomBonus())} → <span class="next">${bonusText(after)}</span>`);
    jarFull.el.classList.toggle('hidden', !full);
    // (Since 1.4.0 seeds come from the coins earned this colony, on a curve that bends past its
    // softcap: "coins still to go" says it plainly.)
    const prog = game.getSeedProgress();
    seedGauge.update(prog.progress);
    setText(nextSeed, `Next Heirloom Seed in ${formatCoins(prog.nextAt.sub(prog.earned).max(0))} more coins earned`);
    retire.update({ disabled: !game.canRetire(), armedLabel: `Tap again to retire ${name}` }); // (not while the jackpot wheel turns or a gamble is on)
    const per = Math.round(game.getHeldSeedBonusPerSeed() * 1000) / 10;
    setText(howText, 'A new pup starts over: coins, upgrades (High Roller too), machines and unplayed free spins reset. '
      + 'The family keeps its Heirloom Seeds, the Family Tree and Machine Stars. Retiring opens the Big Cage, where you plant.');
    setText(howJar, `Every seed you hold gives +${per}% payouts, up to +${Math.round(game.getSeedJar() * 100)}% (the seed jar). `
      + (full ? 'Your jar is full: plant the extra seeds, or grow the jar with Family Fortune.' : 'Planting a seed gives that up, but the trait is the family\'s forever.'));

    // The planted traits, kept by id
    const ft = game.data.familyTree;
    const planted = ft ? ft.nodes.filter((n) => game.getTreeLevel(n.id) > 0) : [];
    const growable = ft ? ft.nodes.filter((n) => (n.colony || 0) <= s.colony).length : 0; // (colony traits, 1.4.0, after a migration)
    setText(traitCount, `${planted.length} of ${growable} planted`);
    chips = keyedList(traitList, planted, (n) => n.id, makeChip, chips);
    for (const n of planted) {
      const level = game.getTreeLevel(n.id);
      setText(chips.get(n.id)!.label, level > 1 ? `${n.name} ${level}` : n.name);
    }
    traitsEmpty.classList.toggle('hidden', planted.length > 0);
    traitsHelp.classList.toggle('hidden', planted.length === 0);
    drawTraitSheet();
  }

  return {
    render,
    openSub: colony.openSub,
    opened() { fresh = false; }, // the tab was opened: no more dot for being new
    get shown() { return shown; },
  };
}
