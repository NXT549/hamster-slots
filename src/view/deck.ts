// deck.ts — VIEW layer. The control deck (1.6.0, "New Digs"; DESIGN §31 → The control deck):
// a wooden console on the front of the cage's plastic tray, with everything you press to play.
//   Deliver  the trip's pay and time; it fills while the hamster is out (the tube stays in the scene)
//   Spin     the hero: an extra-large enamel arcade button with the cost and the bet; gold in free spins
//   lever    pauses and resumes auto-spin (1.3.2), once Wheel Training is bought: up with a green
//            lamp = the hamster runs it, down with a red lamp = paused
//   bet      − ×2 +, with a hint (how high it goes, or "spins ×1" when a spin steps down)
// The keys stay what they were (ui.ts): Space spins, D delivers, - and = change the bet.
// A spin refused for coins wiggles Deliver (nudgeDeliver), the way out of being broke.
// It only calls game actions (spin, startDelivery, setAutoPaused, setBet) and reads state.

import { formatCoins, formatSeconds, setText, replayClass } from './dom.ts';
import { h, button, toggle, stepper, amount } from './kit.ts';
import type { Game } from '../logic/game.ts';
import type { Sound } from './sound.ts';

export function createDeck(game: Game, { host, sound, say }: { host: HTMLElement; sound: Sound; say: (text: string, ms?: number) => void }) {
  // Deliver: a soft blue key with the scooter, its pay and time; a fill shows the trip.
  const deliver = button({ tone: 'soft', size: 'lg', icon: 'scooter', label: 'Deliver', meta: ' ', className: 'deck-deliver', sound: null, onClick: () => game.startDelivery() });
  const deliverFill = deliver.el.insertBefore(h('span', 'deck-fill'), deliver.face);
  // Its second line: the pay and the trip's time (stacked on a phone: styles/stage.css).
  const pay = h('span', 'deck-pay');
  const sep = h('span', 'deck-sep', ' · ');
  const time = h('span', 'deck-time');
  deliver.meta.replaceChildren(pay, sep, time);
  // Spin: the big one. Its second line is the spin's cost (a coin and the amount), or the free spins left.
  const spin = button({ tone: 'primary', size: 'xl', label: 'Spin', meta: ' ', className: 'deck-spin', sound: null, onClick: () => game.spin('manual') });
  spin.el.id = 'spin-btn';
  const cost = amount('coin', 24);
  const freeText = h('span', 'deck-free');
  spin.meta.replaceChildren(cost.el, freeText);
  // The auto-spin lever (a QoL toggle: manual spins and deliveries work the same either way).
  const lever = toggle({
    kind: 'lever', ariaLabel: 'Auto-spin', className: 'deck-lever hidden',
    onChange: (on) => {
      game.setAutoPaused(!on);
      sound.play('bet', on);
      say(on ? 'Back to running the wheel myself!' : "I'll wait for you to tap Spin.", 1800);
    },
  });
  lever.el.title = 'Auto-spin: up = on, down = paused';
  // The bet: one step up or down. Past the biggest unlocked bet, the hamster points you to High Roller.
  const bet = stepper({ label: 'Bet', onStep: (step) => changeBet(step), ariaDown: 'Lower the bet', ariaUp: 'Raise the bet', className: 'deck-bet' });
  host.append(deliver.el, spin.el, lever.el, bet.el);

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

  let shownFill = -1;
  // Every frame. `idle` = nobody's spinning and the hamster's been waiting a while: Spin glows.
  function render({ idle }: { idle: boolean }): void {
    const s = game.state;
    const machine = s.machines[s.activeMachine];
    const delivering = s.delivery.active;
    const free = game.getFreeSpins();
    const spinBet = game.getSpinBet();
    const gambling = !!s.gamble && s.gamble.started;
    const busy = machine.spinning || !!machine.bonus || !!machine.hold || gambling || (!!free && free.left > 0);

    // Spin. During free spins it just counts them down; it isn't disabled while a normal spin
    // runs (a tap then queues the next spin, D82).
    spin.update({
      label: free ? 'Free' : machine.bonus ? 'Jackpot!' : machine.hold ? 'Hold!' : 'Spin',
      disabled: busy && !machine.spinning,
      tone: free ? 'gold' : 'primary',
    });
    cost.el.classList.toggle('hidden', !!free);
    freeText.classList.toggle('hidden', !free);
    if (free) setText(freeText, free.bet > 1 ? `${free.left} left · ×${free.bet}` : `${free.left} left`);
    else cost.update(game.getBetCost(spinBet || game.getBet()));
    spin.el.classList.toggle('busy', machine.spinning);
    spin.el.classList.toggle('free', !!free);
    spin.el.classList.toggle('poor', !free && (delivering || spinBet === null));
    spin.el.classList.toggle('attract', idle);

    // Deliver: the trip's pay and time, or how long until the hamster's back (and the fill).
    deliver.update({ disabled: delivering });
    setText(pay, delivering ? 'back in' : `+${formatCoins(game.getDeliveryReward())}`);
    setText(time, delivering ? `${Math.ceil(s.delivery.timer)}s` : formatSeconds(game.getDeliveryDuration()));
    const f = delivering ? Math.round(game.getDeliveryProgress() * 200) : 0;
    if (f !== shownFill) {
      shownFill = f;
      deliverFill.style.width = `${f / 2}%`;
    }

    // The lever: only once Wheel Training exists (nothing to pause before that).
    const hasAuto = game.getAutoInterval() !== null;
    lever.el.classList.toggle('hidden', !hasAuto);
    if (hasAuto) {
      const paused = game.getAutoPaused();
      lever.update(!paused);
      lever.el.setAttribute('aria-label', paused ? 'Auto-spin is paused: resume it' : 'Auto-spin is on: pause it');
    }

    // The bet, and a hint when a spin will step down (not enough coins for the chosen bet).
    const chosen = game.getBet();
    const max = game.getMaxBetIndex();
    const stepped = spinBet !== null && spinBet < chosen;
    bet.update({
      value: `×${chosen}`,
      hint: stepped ? `spins ×${spinBet}` : max === 0 ? 'High Roller' : `up to ×${game.getBetSteps()[max]}`,
      canDown: game.getBetIndex() > 0,
      canUp: true, // (past the top it says why: changeBet)
      upLocked: game.getBetIndex() >= max,
      warn: stepped,
    });
  }

  return {
    render, changeBet,
    spinEl: spin.el,
    // A refused spin shakes the button.
    shake() { replayClass(spin.el, 'shake'); },
    // Broke: point at Deliver (1.9.1), since a delivery always pays.
    nudgeDeliver() { replayClass(deliver.el, 'nudge'); },
  };
}
export type Deck = ReturnType<typeof createDeck>;
