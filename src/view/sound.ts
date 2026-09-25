// sound.ts — VIEW layer. Little synthesized sound effects: no audio files.
//
// It uses the browser's Web Audio API. Each sound is a few short "notes": an
// oscillator (a simple waveform) whose volume jumps up and quickly fades out.
// That's enough for cute bleeps, clunks and chimes, and it costs nothing to load.
//
// Browsers only allow sound after the player has clicked or pressed a key, so
// the audio is switched on by the first input (see unlock()).

// Musical notes (Hz) used by the chimes.
const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

// How one note sounds: the waveform, how loud, and where its pitch slides to.
interface NoteOptions {
  type?: OscillatorType;
  gain?: number;
  to?: number | null;
}

// A sound recipe. Each takes its own few arguments (a reel's index, bet up/down …).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recipe = (...args: any[]) => void;

export function createSound({ volume = 0.6, muted = false }: { volume?: number; muted?: boolean } = {}) {
  let ctx: AudioContext | null = null; // the AudioContext, created on the first click/key
  let master: GainNode | null = null; // one volume knob for everything
  let lastCoin = 0; // coin blips are rate-limited so a burst isn't a buzz

  function unlock() {
    // Older Safari only has the "webkit" version.
    const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      applyVolume();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  function applyVolume() {
    if (master) master.gain.value = muted ? 0 : volume * 0.5; // 0.5: keep the loudest sounds gentle
  }

  // One note: a waveform at `freq` Hz starting `at` seconds from now, fading over `dur`.
  // `to` slides the pitch (a "boing" or a "swoosh").
  // (Only called through play(), which checks the audio is on: ctx and master exist.)
  function note(freq: number, at: number, dur: number, { type = 'sine', gain = 0.3, to = null }: NoteOptions = {}) {
    const t0 = ctx!.currentTime + at;
    const osc = ctx!.createOscillator();
    const amp = ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008); // quick attack (no click)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // then fade out
    osc.connect(amp);
    amp.connect(master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const chord = (freqs: number[], at: number, dur: number, opts?: NoteOptions) => freqs.forEach((f) => note(f, at, dur, opts));

  // The recipes. Keep them short: this is a cozy game, not a casino.
  const SOUNDS: Record<string, Recipe> = {
    lever: () => note(220, 0, 0.12, { type: 'triangle', gain: 0.18, to: 140 }),
    // One clunk per reel as it lands (one at a time since M7), a little lower each reel.
    // `soft` = an auto-spin: the same clunk, quieter.
    reelStop: (i = 0, soft = false) => note(300 - i * 30, 0, 0.07, { type: 'triangle', gain: soft ? 0.06 : 0.16 }),
    win: () => note(NOTE.E6, 0, 0.12, { gain: 0.1 }),
    nice: () => [NOTE.C6, NOTE.E6].forEach((f, i) => note(f, i * 0.07, 0.18, { gain: 0.14 })),
    big: () => [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => note(f, i * 0.08, 0.3, { type: 'triangle', gain: 0.18 })),
    jackpot: () => {
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) => note(f, i * 0.07, 0.35, { type: 'triangle', gain: 0.18 }));
      chord([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.5, 0.9, { gain: 0.08 });
    },
    coin: () => {
      const now = performance.now();
      if (now - lastCoin < 45) return;
      lastCoin = now;
      note(NOTE.A5 * (1 + Math.random() * 0.1), 0, 0.06, { type: 'square', gain: 0.05 });
    },
    buy: () => note(440, 0, 0.12, { type: 'square', gain: 0.08, to: 880 }),
    plant: () => [NOTE.G5, NOTE.C6].forEach((f, i) => note(f, i * 0.06, 0.2, { gain: 0.14 })),
    error: () => note(160, 0, 0.16, { type: 'square', gain: 0.07, to: 110 }),
    deliver: () => [NOTE.E5, NOTE.E5].forEach((f, i) => note(f, i * 0.12, 0.08, { type: 'square', gain: 0.06 })),
    back: () => [NOTE.C5, NOTE.G5].forEach((f, i) => note(f, i * 0.1, 0.14, { type: 'triangle', gain: 0.14 })),
    capsuleShake: () => [0, 0.15, 0.3].forEach((at) => note(180, at, 0.06, { type: 'triangle', gain: 0.12 })),
    capsulePop: () => {
      note(300, 0, 0.1, { type: 'square', gain: 0.1, to: 900 });
      [NOTE.E6, NOTE.G6].forEach((f, i) => note(f, 0.1 + i * 0.06, 0.2, { gain: 0.1 }));
    },
    epic: () => [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C6 * 2].forEach((f, i) => note(f, i * 0.07, 0.3, { gain: 0.12 })),
    sticker: () => [NOTE.G5, NOTE.E6].forEach((f, i) => note(f, i * 0.08, 0.16, { gain: 0.1 })),
    retire: () => chord([NOTE.C5, NOTE.E5, NOTE.G5], 0, 0.8, { type: 'triangle', gain: 0.1 }),
    // A new machine: a rising "ta-da" with a clunk at the start (it's delivered!).
    machine: () => {
      note(140, 0, 0.12, { type: 'triangle', gain: 0.16, to: 90 });
      [NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) => note(f, 0.12 + i * 0.07, 0.25, { type: 'triangle', gain: 0.14 }));
    },
    switch: () => [260, 390].forEach((f, i) => note(f, i * 0.05, 0.06, { type: 'square', gain: 0.05 })), // a little "click-clack"
    // Milestone 6: bets, free spins, the jackpot wheel, the gamble, Hot Streak.
    bet: (up = true) => note(up ? 520 : 390, 0, 0.06, { type: 'square', gain: 0.05, to: up ? 700 : 300 }),
    anticipation: () => note(300, 0, 0.7, { type: 'triangle', gain: 0.09, to: 900 }), // a rising "will it…?"
    freeSpins: () => {
      [NOTE.C5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6].forEach((f, i) => note(f, i * 0.06, 0.25, { type: 'square', gain: 0.06 }));
      chord([NOTE.C6, NOTE.E6, NOTE.G6], 0.35, 0.6, { gain: 0.08 });
    },
    wheelTick: (i = 0) => note(900 - (i % 3) * 60, 0, 0.03, { type: 'square', gain: 0.04 }),
    pot: () => {
      [NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C6 * 2].forEach((f, i) => note(f, i * 0.08, 0.4, { type: 'triangle', gain: 0.16 }));
      chord([NOTE.C5, NOTE.G5, NOTE.C6, NOTE.E6], 0.5, 1.2, { gain: 0.07 });
    },
    gambleWin: () => [NOTE.E6, NOTE.G6, NOTE.C6 * 2].forEach((f, i) => note(f, i * 0.06, 0.18, { gain: 0.12 })),
    gambleLose: () => note(330, 0, 0.4, { type: 'triangle', gain: 0.12, to: 110 }), // a sad "wah-wah"
    streak: (n = 1) => note(400 + Math.min(n, 8) * 60, 0, 0.1, { type: 'triangle', gain: 0.08, to: 600 + Math.min(n, 8) * 80 }),
    // Milestone 7: the WIN meter, the card gamble, Luck, a new symbol.
    tick: () => note(1250 + Math.random() * 60, 0, 0.025, { type: 'square', gain: 0.025 }), // the meter's digits rolling
    card: () => note(700, 0, 0.07, { type: 'triangle', gain: 0.07, to: 350 }), // a card flipping over
    luck: () => [NOTE.E6, NOTE.A5, NOTE.E6 * 1.5].forEach((f, i) => note(f, i * 0.06, 0.14, { gain: 0.07 })), // a clover twinkle
    unlock: () => { // a new symbol on the reels: a little rising fanfare
      note(200, 0, 0.1, { type: 'triangle', gain: 0.12, to: 300 });
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G6].forEach((f, i) => note(f, 0.08 + i * 0.07, 0.22, { type: 'triangle', gain: 0.12 }));
    },
  };

  function play(name: string, ...args: unknown[]): void {
    if (!ctx || muted || volume <= 0 || ctx.state !== 'running') return;
    const recipe = SOUNDS[name];
    if (recipe) recipe(...args);
  }

  return {
    play,
    get ready() { return !!ctx && ctx.state === 'running'; }, // true once a click/key switched audio on
    get muted() { return muted; },
    get volume() { return volume; },
    setMuted(value: unknown) { muted = !!value; applyVolume(); },
    setVolume(value: number) { volume = Math.min(1, Math.max(0, value)); applyVolume(); },
  };
}
