// types.ts — LOGIC layer. The SHAPES of the game's data, written down for TypeScript.
//
// Nothing here runs: these are descriptions ("a machine has a name, a spin cost,
// a list of symbols …"). TypeScript checks every file against them, so a typo like
// machine.spinCots, or passing a number where a machine is expected, is caught
// before the game even starts. They're also the best map of the game there is:
// read GameData to see everything data.json can hold, GameState for the save.
//
// data.json holds plain numbers. In the game's state, every amount of money
// (coins, Heirloom Seeds, Hamster Tokens) is a Money: a big number (money.ts).

import type { Money } from './money.ts';
import type { BjCard, BjOutcome } from './blackjack.ts';
import type { RouletteKind, RoulettePays } from './roulette.ts';
import type { RacerDef } from './derby.ts';

// ───────────────────────── data.json (GameData) ─────────────────────────

// Levels of upgrades or tree nodes by id, e.g. { cheeks: 3, wheel: 1 }.
export type Levels = Record<string, number>;

// "What if this upgrade/node were level N?" for the shop previews: { cheeks: 3 }.
export type Overrides = Record<string, number>;

export interface SymbolDef {
  id: string;
  name: string;
  weight: number; // how often it lands, compared with the other symbols' weights
  locked?: boolean; // opened by an unlock upgrade ("New Seeds"), weight 0 until then
  blank?: boolean; // the Wood Shaving: never pays, ends a run
  wild?: boolean; // the Hamster Wild: stands in for other symbols on a line
  scatter?: boolean; // counts anywhere on the grid (free spins, the jackpot wheel)
}

// payouts[symbolId]["count"] = base coins, e.g. payouts.seed["2"] = 27.
// (JSON keys are always strings, so the count is a string too.)
export type Payouts = Record<string, Record<string, number>>;

export interface FreeSpinsDef {
  symbol: string; // the scatter that starts them (the Hamster Ball)
  awards: Record<string, number>; // scatters → free spins, e.g. { "3": 8, "4": 12, "5": 20 }
  multiplier: number; // every free-spin win × this
  pause: number; // seconds between free spins
  climb?: number; // 1.10.0 (Burrow Party): the multiplier grows this much each free spin, as far as the Party Climb upgrade lets it
}

// 1.10.0: Zoomies. Now and then, on a paid spin, the hamster dashes across the reels
// and turns whole reels wild: how many by weight, which ones at random.
export interface ZoomiesDef {
  minReels: number; // only machines with paylines and at least this many reels
  reels: { count: number; weight: number }[];
}

export interface PotDef {
  id: string;
  name: string;
  weight: number; // how often the wheel lands on it
  seed: number; // what it holds after being won (base units)
  growth: number; // added on every paid spin (base units)
}

export interface JackpotDef {
  symbol: string; // the scatter that starts the wheel (the Cheek Pouch)
  min: number; // how many of it start the wheel
  duration: number; // seconds the wheel turns
  pots: PotDef[]; // the last one is the top pot (the Grand)
}

// M9: hold & spin (the Acorn Vault). `trigger`+ coin symbols on a paid spin start
// it: they lock in place, and the empty cells respin; a new coin locks too and
// sets the respins back to `respins`. It ends when the respins run out or every
// cell holds a coin (then the Grand pays too).
export interface HoldSpinDef {
  symbol: string; // the coin symbol (a scatter: the Golden Acorn)
  trigger: number; // how many coins start it
  respins: number; // respins to start with, and after every new coin
  respinChance: number; // the chance an empty cell lands a coin on a respin
  values: { value: number; weight: number }[]; // what a coin holds (base units), by weight
  grand: number; // paid on top when every cell holds a coin (base units)
  respinSeconds: number; // how long one respin shows (time: the machine waits)
  pause: number; // seconds before the first respin and after the last
}

// M9: the multiplier wheel (the Big Cheese). Every full line (every reel matched)
// spins it, and that line's win is multiplied by the wedge it lands on.
export interface WheelDef {
  wedges: { multiplier: number; weight: number }[];
}

// 1.4.0 (The Great Migration): Moving Day's moving boxes. Every box that lands turns
// into the SAME symbol, picked by weight from `reveal` (only symbols the machine has
// unlocked), before the spin is scored. So the maths stays exact: given the reveal,
// the grid is an ordinary grid with the box's weight added to that symbol's.
export interface MysteryDef {
  symbol: string; // the box symbol (never pays itself)
  reveal: { symbol: string; weight: number }[];
}

export interface MachineDef {
  id: string;
  name: string;
  description: string;
  unlockCost: number; // 0 for the free first machine
  colony?: number; // 1.4.0: only for a family that has migrated this many times (missing = 0)
  startReels: number;
  maxReels: number;
  spinCost: number; // at ×1, before upgrades
  spinDuration: number; // seconds
  symbols: SymbolDef[];
  payouts: Payouts;
  rows?: number; // missing = 1 (Old Clunky)
  paylines?: number[][]; // each line = the row it crosses on every reel
  startLines?: number;
  freeSpins?: FreeSpinsDef;
  jackpot?: JackpotDef;
  // M9
  ways?: boolean; // "243 ways": no paylines; matching symbols on neighbouring reels win on any row (machine.ts evaluateWays)
  holdSpin?: HoldSpinDef;
  wheel?: WheelDef;
  mystery?: MysteryDef; // 1.4.0: moving boxes (Moving Day)
}

// Every upgrade and Family Tree node has an effect. The "type" says which small
// function in game.ts handles it; the other fields are that type's numbers.
export type Effect =
  | { type: 'payoutMultiplier'; perLevel: number }
  | { type: 'autoSpin'; baseInterval: number; intervalMultiplier: number; rest?: number }
  | { type: 'luck'; perLevel: number }
  | { type: 'betSteps'; stepsPerLevel: number }
  | { type: 'winStreak'; perStack: number; maxStacks: number }
  | { type: 'spinCostMultiplier'; perLevel: number }
  | { type: 'unlockSymbol'; symbols: string[] }
  | { type: 'extraReel'; reelsPerLevel: number }
  | { type: 'extraPayline'; linesPerLevel: number }
  | { type: 'symbolWeight'; symbol: string; perLevel: number }
  | { type: 'extraFreeSpins'; perLevel: number }
  | { type: 'jackpotGrowth'; perLevel: number }
  | { type: 'bothWays' }
  // M8 (The Big Cage): Family Tree traits
  | { type: 'seedJar'; perLevel: number } // the seed jar holds this much more heirloom bonus (M9: Family Fortune)
  | { type: 'startingMachineLevel'; upgradeType: string; levels: number } // every machine starts with levels of its upgrade of this effect type
  | { type: 'startingMachine'; machine: string } // every pup starts owning this machine
  | { type: 'potSeedBonus'; perLevel: number } // jackpot pots start (and restart) bigger
  // M9 (More machines): machine upgrades for the new features
  | { type: 'extraRespins'; perLevel: number } // hold & spin: more respins (to start with, and after every new coin)
  | { type: 'wheelBonus'; perLevel: number } // the cheese wheel: + this on every wedge
  // M10 (Wardrobe buffs): what a worn skin can do (skins also use payoutMultiplier,
  // spinSpeed, spinCostMultiplier, luck and extraFreeSpins)
  | { type: 'offlineBonus'; perLevel: number } // offline earnings × (1 + this)
  | { type: 'jackpotTokens'; perLevel: number } // this many more Hamster Tokens for a golden jackpot
  | { type: 'streakCap'; perLevel: number } // Hot Streak can climb this many steps higher
  | { type: 'deliveryTokens'; every: number } // a Hamster Token every Nth delivery (instead of the usual)
  | { type: 'gambleHistory'; perLevel: number } // the card gamble shows this many more past cards
  // 1.3.1 (Nuts & Bolts): the new upgrades and traits
  | { type: 'doubleWin'; perLevel: number } // Lucky Pennies: a winning paid spin pays double with this chance (per level)
  | { type: 'offlineTime'; perLevel: number } // Cosy Nest: offline earnings count this many more seconds (per level)
  | { type: 'stickerPayout'; perLevel: number } // Sticker Album: + this × every diary sticker earned, to payouts (per level)
  | { type: 'starPayout'; perLevel: number } // Star Polish: every Machine Star pays this much more (per level)
  | { type: 'generationPayout'; perLevel: number } // Deep Roots: + this × the generation, to payouts (per level)
  | { type: 'autoBuy'; share: number; interval: number } // Helping Paws: the Hamster Helper buys an upgrade that costs at most share × your coins, every `interval` seconds
  // 1.4.0 (The Great Migration): colony perks and colony traits
  | { type: 'seedGain'; perLevel: number } // Seed Sense: every Heirloom Seed total × (1 + this) (per level)
  | { type: 'maxStars'; perLevel: number } // Trailblazer, Starry Roots: a machine can have this many more Machine Stars (per level)
  | { type: 'whiskerGain'; perLevel: number } // Whisker Wisdom: Golden Whiskers from migrating × (1 + this) (per level)
  // 1.10.0 (Burrow Party): Zoomies and the Burrow Bonanza's free spins
  | { type: 'zoomies'; perLevel: number } // Zoomies: a paid spin turns whole reels wild with this chance (per level)
  | { type: 'stickyWilds'; perLevel: number } // a wild that lands in free spins stays this many more free spins (per level)
  | { type: 'freeSpinClimb'; perLevel: number } // the free-spin multiplier can climb this many more steps (per level)
  | { type: 'autoRetire' } // Wise Elders: the Hamster Helper may retire and plant for you (the Colony tab's switch)
  | { type: 'shiftWeight'; from: string; to: string; amount: number }
  | { type: 'fullLineMultiplier'; multiplier: number }
  | { type: 'startingLevel'; upgrade: string; levels: number }
  | { type: 'spinSpeed'; multiplier: number }
  | { type: 'deliveryTime'; multiplier: number }
  | { type: 'deliveryPayoutBonus' }
  | { type: 'autoDelivery' };

export type EffectType = Effect['type'];
// The effect of one type, e.g. EffectOf<'luck'> = { type: 'luck'; perLevel: number }.
export type EffectOf<T extends EffectType> = Extract<Effect, { type: T }>;

// Anything bought with the one cost formula: floor(baseCost × growthRate ^ owned).
export interface Priced {
  baseCost: number;
  growthRate: number;
  maxLevel: number | null; // null = no max
}

// 1.3.1: what an upgrade needs before the shop sells it (both, if it lists both).
//   generation: a rebirth upgrade, from this generation on (the 3rd hamster = 2 retirements)
//   sticker:    a sticker upgrade, once this Hamster Diary sticker is earned
export interface UpgradeUnlock {
  generation?: number;
  sticker?: string;
}

export interface UpgradeDef extends Priced {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'machine'; // the hamster's, or one machine's
  machines?: string[]; // machine upgrades: which machines sell it (missing = all)
  requires?: string[]; // upgrade ids that must be bought first (e.g. Old Clunky's Both Ways needs the Third Reel)
  unlock?: UpgradeUnlock; // 1.3.1: locked until then (missing = sold from the start)
  effect: Effect;
}

export interface TreeNodeDef extends Priced {
  id: string;
  name: string;
  description: string;
  branch: string;
  requires: string[]; // node ids that must be planted first
  colony?: number; // 1.4.0: a colony trait, only for a family that has migrated this many times
  effect: Effect;
}

// ── 1.4.0: The Great Migration ──
// A colony perk: bought with Golden Whiskers, kept for good (through every migration).
export interface PerkDef extends Priced {
  id: string;
  name: string;
  description: string;
  effect: Effect;
}

// A Colony Trial: a life with a twist. Beat its goal (this life's coins would bring
// `goalShare` × the Heirloom Seeds the family has earned this colony, at least
// `minSeeds`) for its Golden Whiskers, once a colony.
export type TrialRule = 'noFamily' | 'noAuto' | 'noStars' | 'betCap' | 'noWardrobe';
export interface TrialDef {
  id: string;
  name: string;
  description: string;
  rule: TrialRule;
  goalShare: number;
  minSeeds: number;
  whiskers: number;
}

export interface ColonyDef {
  name: string; // "The Great Migration"
  currencyName: string; // "Golden Whiskers"
  whiskerDivisor: number; // whiskers = floor((seeds earned this colony / divisor) ^ exponent) × (1 + Whisker Wisdom)
  whiskerExponent: number;
  perks: PerkDef[];
  trials: TrialDef[];
  trialsFrom: number; // trials open from this many migrations…
  trialGeneration: number; // …from this hamster of each colony on (the first ones have little a twist could take away)
  autoRetire: { shares: number[]; minSeeds: number; plantShare: number }; // the Wise Elders' choices
}

export interface Named {
  id: string;
  name: string;
}

export interface Rarity extends Named {
  weight: number;
  duplicateRefund: number;
}

export interface SkinDef extends Named {
  category: string;
  rarity: string; // "starter" or a capsule rarity id
  effects?: Effect[]; // M10: what wearing it does (level 1 while worn; none for starters)
  casino?: boolean; // M11: only at the casino's Prize Counter (never in a capsule)
}

// ── M11: the Hamster Casino ──
// A prize at the Prize Counter. A boost lasts `seconds` of play, a charm `spins`
// paid spins; buying one again adds more, up to its max. Their effects work like a
// worn skin's (level 1 while they last).
export type PrizeDef = Named & { description: string; cost: number } & (
  | { kind: 'boost'; seconds: number; maxSeconds: number; effect: Effect }
  | { kind: 'charm'; spins: number; maxSpins: number; effect: Effect }
  | { kind: 'tokens'; tokens: number }
  | { kind: 'skin'; skin: string }
);

export interface CasinoDef {
  enabled: boolean; // false = no casino at all (e.g. a store build that leaves it out)
  unlockGeneration: number; // the casino opens for this generation (after the first retirement)
  chipName: string;
  chipPriceSeconds: number; // a chip costs this many seconds of the family's best earnings (best machine, biggest bet, no boosts)
  chipMinPrice: number; // but never less than this many coins
  buyAmounts: number[]; // how many chips the buy buttons buy
  chipsPerSpins: { spins: number; chips: number }; // earned while you play: this many chips every so many paid spins
  chipsPerRetirement: number; // and when a hamster retires
  betSteps: number[]; // the chip bets (a bet is always a multiple of the first)
  roulette: { pays: RoulettePays };
  blackjack: { blackjackPays: number };
  derby: { racers: RacerDef[]; longshot: string };
  seedDrop: { multipliers: number[] };
  prizes: PrizeDef[];
}

// ── M12: the Family Casino (your own casino, for a migrated family) ──
// A cabinet of one of your machines, on the casino's floor: hamster guests play it
// at `bet` Takings a spin and win back `guestRtp` of it on average (below 100%: the
// rest is the house's edge, your takings). Bought once, for `cost` Takings.
export interface CabinetDef {
  machine: string; // a machine id (its name, picture and spin time)
  cost: number;
  bet: number;
  guestRtp: number;
}
// What a floor upgrade does, per level: more guests (+perLevel of them), bigger guest
// bets (+perLevel), a bigger house edge (the guests win back perLevel less), or a till
// that holds perLevel more hours of takings.
export type FloorEffectType = 'guests' | 'guestBet' | 'houseEdge' | 'tillHours';
export interface FloorUpgradeDef extends Priced {
  id: string;
  name: string;
  description: string;
  kind: 'decor' | 'room' | 'staff';
  effect: { type: FloorEffectType; perLevel: number };
}
// The back office: what Takings buy outside the casino (chips, tokens), rule 3 prices.
export type OwnRewardDef = Priced & Named & { description: string } & (
  | { kind: 'chips'; chips: number }
  | { kind: 'tokens'; tokens: number }
);
export interface OwnCasinoDef {
  enabled: boolean; // false = no Family Casino (a store build can leave it out)
  name: string; // "The Family Casino"
  currencyName: string; // "Takings"
  unlockColony: number; // it opens for a family that has migrated this many times
  guestRestSeconds: number; // a guest waits this long between spins (on top of the machine's spin time)
  tillHours: number; // the till holds this many hours of takings before it's full
  minGuestRtp: number; // the guests always win back at least this much (the house edge never grows past 1 − this)
  cabinets: CabinetDef[];
  upgrades: FloorUpgradeDef[];
  rewards: OwnRewardDef[];
}

// A Hamster Diary goal. "stat" goals name a lifetime stat (see Stats below).
export type Goal =
  | { type: 'stat'; stat: keyof Stats; target: number }
  | { type: 'upgradeLevel'; upgrade: string; target: number }
  | { type: 'generation'; target: number }
  | { type: 'treeNodes'; target: number }
  | { type: 'skinsOwned'; target: number }
  | { type: 'categoryOwned'; category: string; target: number } // M10: skins found in one category (e.g. hats)
  | { type: 'machinesOwned'; target: number }
  | { type: 'stickers'; target: number }; // 1.3.1: diary stickers earned

export interface Sticker {
  id: string;
  name: string;
  description: string;
  goal: Goal;
  tokens: number;
}

export interface RetirementDef {
  name: string;
  currencyName: string;
  seedDivisor: number;
  seedExponent: number;
  payoutBonusPerSeedHeld: number; // M8: every seed you HOLD (not planted) adds this to payouts
  seedJar?: number; // M9: the most the held seeds can add (1 = +100%); Family Fortune adds to it
  // 1.4.0: past this many seeds, the total grows more slowly (as coins ^ exponent), so late lives last longer
  seedSoftcap?: { seeds: number; exponent: number };
  pupNames: string[];
}

export interface GameData {
  schemaVersion: number;
  startCoins: number;
  autosaveSeconds: number;
  betSteps: number[]; // e.g. [1, 2, 3, 5, 10]
  gamble: { maxRounds: number; offerSeconds: number; history: number };
  machines: MachineDef[]; // the first one is free
  delivery: { name: string; description: string; duration: number; reward: number };
  upgrades: UpgradeDef[];
  winTiers: { id: string; minMultiple: number }[];
  offline: { minSeconds: number; maxSeconds: number; efficiency: number };
  retirement: RetirementDef;
  // M8: Machine Stars, for rebuilding a machine with every upgrade maxed.
  stars: { max: number; payoutPerStar: number; luckPerStar: number };
  // costPerColony: every trait costs × this more in each colony after the first (balancing pass).
  familyTree: { branches: Named[]; nodes: TreeNodeDef[]; costPerColony?: number };
  tokens: {
    name: string;
    perJackpot: number;
    jackpotSymbol: string;
    jackpotMinReels: number;
    deliveryEvery: number;
    perDelivery: number;
    perRetirement: number;
  };
  capsules: { name: string; pullCost: number; rarities: Rarity[]; pityRarity: string; pityPulls: number };
  skinCategories: Named[];
  skins: SkinDef[];
  diary: Sticker[];
  casino?: CasinoDef; // M11
  ownCasino?: OwnCasinoDef; // M12
  colony?: ColonyDef; // 1.4.0: The Great Migration
  zoomies?: ZoomiesDef; // 1.10.0: Burrow Party
}

// ───────────────────────── Spins ─────────────────────────

// A spin's result: grid[reel][row] = a symbol id.
export type Grid = string[][];
// One cell of the grid: [reel, row].
export type Cell = [number, number];

// Who started a spin.
export type SpinSource = 'manual' | 'auto' | 'free';

// Which symbols are special on a machine.
export interface SymbolRules {
  wild: string | null;
  scatters: Set<string>;
  blanks: Set<string>;
}

// One line, scored (machine.ts evaluate).
export interface LineResult {
  symbolId: string | null;
  count: number;
  basePayout: number;
  usedWild: boolean;
}

// A winning line of a grid (machine.ts evaluateGrid); `line` = its index in the paylines.
export interface LineWin extends LineResult {
  line: number; // (on a ways machine: the symbol's place in the machine's symbol list)
  fullLine: boolean; // every reel matched
  fromRight: boolean; // read from the right-hand reel (only with "pays both ways")
  ways?: number; // M9, ways machines: how many ways this symbol won (basePayout = pay × ways)
  cells?: Cell[]; // M9, ways machines: every cell of the win ([reel, row])
  wheel?: number; // M9, the Big Cheese: the multiplier wedge this full line landed on
}

// A winning line after every multiplier (game.ts resolveSpin).
export interface PaidWin extends LineWin {
  payout: Money;
}

// ───────────────────────── The game state (the save) ─────────────────────────

export interface FreeSpinsState {
  left: number;
  total: number;
  bet: number; // the bet that won them
  won: Money; // coins paid so far
  timer: number; // seconds until the next one
  sticky: number[]; // 1.10.0: every cell's sticky wild, as free spins it still stays (index = reel × rows + row; all 0 without Sticky Wilds)
}

export interface BonusState {
  pot: string; // the pot the wheel will land on (decided when it starts)
  timer: number;
  bet: number;
}

// M9: a hold & spin bonus while it plays. Like a spin's result, it's all decided
// when it starts (game.ts startHold); the timer only lets it play out, and it pays
// when the timer runs out. Cells are numbered reel by reel: index = reel × rows + row.
export interface HoldState {
  start: number[]; // the cells that held a coin when it started
  values: number[]; // every cell's coin value at the END (base units; 0 = never filled)
  steps: number[][]; // the cells each respin filled ([] = a respin with no new coin)
  respins: number; // respins to start with (and after every new coin)
  bet: number;
  timer: number; // seconds left
  duration: number; // seconds in all
}

export interface MachineState {
  typeId: string; // which machine in data.json
  upgrades: Levels; // machine-scoped upgrade levels
  bet: number; // the chosen bet: an index into betSteps
  spinning: boolean;
  spinTimer: number;
  spinBet: number;
  spinFree: boolean;
  spinSource: SpinSource;
  result: Grid | null;
  streak: number;
  freeSpins: FreeSpinsState | null;
  pots: Record<string, Money>; // jackpot pots in base units
  bonus: BonusState | null; // the jackpot wheel while it turns
  hold: HoldState | null; // M9: hold & spin while it plays
}

// M11: a hand of blackjack (a finished one stays to show until the next deal).
export interface BlackjackHand {
  bet: Money; // chips on the table (× 2 after a double down)
  player: BjCard[];
  dealer: BjCard[]; // the second card is face down until the hand ends
  doubled: boolean;
  outcome: BjOutcome | null; // null while it's being played
  returned: Money; // chips paid back when it ended
}

// M11: the family's casino (kept when retiring, like the tokens).
export interface CasinoState {
  chips: Money;
  bestIncome: Money; // the most the family has earned per second (noted when retiring and buying chips): chips never get cheaper
  spinsToChip: number; // paid spins since the last chip earned
  boosts: Record<string, number>; // prize id → seconds (a boost) or paid spins (a charm) left
  hand: BlackjackHand | null;
}

// M12: the Family Casino (kept for good: through retirements and migrations).
export interface OwnCasinoState {
  opened: boolean; // the grand opening has happened (the free first cabinet is on the floor)
  cabinets: Record<string, boolean>; // machine id → its cabinet is on the floor
  upgrades: Levels; // floor upgrade levels
  rewards: Levels; // back-office rewards bought (each one's price grows with rule 3)
  till: Money; // takings waiting in the till (tap to empty it)
  takings: Money; // takings banked, to spend
}

export interface GambleState {
  machineId: string;
  stake: Money;
  rounds: number;
  won: Money; // coins gained so far (below 0 after a loss)
  started: boolean; // a card has been picked (then it's no longer just an offer)
  timer: number; // seconds left on the offer
}

// Lifetime stats: they keep counting across retirements (only Reset wipes them).
// The amounts of money are Money; the rest are counts, seconds or bests.
export interface Stats {
  spins: number;
  manualSpins: number;
  autoSpins: number;
  wins: number;
  coinsWon: Money;
  coinsSpent: Money;
  deliveries: number;
  deliveryCoins: Money;
  coinsEarned: Money;
  upgradesBought: number;
  playTime: number;
  goldenJackpots: number;
  capsulesOpened: number;
  tokensEarned: Money;
  biggestWin: Money;
  offlineCoins: Money;
  machinesBought: number;
  mostLinesWon: number;
  biggestBet: number;
  freeSpins: number;
  freeSpinTriggers: number;
  freeSpinCoins: Money;
  wildWins: number;
  bestStreak: number;
  jackpotsWon: number;
  grandJackpots: number;
  gambleWins: number;
  gambleLosses: number;
  bestGambleRun: number;
  symbolsUnlocked: number;
  bestLuck: number;
  suitWins: number;
  rebuilds: number; // M8: machines rebuilt for a Machine Star
  bestStars: number; // M8: the most stars one machine has had
  mostSeedsHeld: number; // M8: the most Heirloom Seeds held at once
  bestWays: number; // M9: the most ways one symbol has won in a spin (ways machines)
  holdBonuses: number; // M9: hold & spin bonuses played
  holdGrands: number; // M9: hold & spin grids filled (the Grand)
  bestWheel: number; // M9: the biggest cheese-wheel multiplier landed
  // M11: the casino
  casinoGames: number; // games played (a roulette spin, a blackjack hand, a race, a drop)
  chipsBought: Money;
  chipsEarned: Money; // earned by playing the machines and retiring (not bought, not won)
  biggestCasinoWin: Money; // the most chips one game paid back
  rouletteNumbers: number; // straight-up numbers hit
  blackjacks: number;
  derbyLongshots: number; // races won on the long shot
  seedDropEdges: number; // seeds landed in an edge bin (the biggest)
  prizesBought: number;
  // 1.3.1 (save v12): the new upgrades
  doubleWins: number; // wins Lucky Pennies paid double
  helperBuys: number; // upgrade levels the Hamster Helper bought
  // 1.4.0 (save v14): The Great Migration
  migrations: number; // times the family moved to a new colony
  whiskersEarned: Money; // Golden Whiskers ever received
  trialsCompleted: number; // Colony Trials beaten
  autoRetires: number; // hamsters the Wise Elders retired
  mysteryBoxes: number; // moving boxes opened (Moving Day)
  bestBoxes: number; // the most boxes in one spin
  // M12 (save v15): the Family Casino
  takingsEarned: Money; // Takings ever banked from the till
  tillsEmptied: number;
  cabinetsBought: number; // cabinets put on the floor (the free first one included)
  // 1.10.0 (save v16): Burrow Party
  zoomies: number; // paid spins the hamster zoomed across (whole reels wild)
  stickyWilds: number; // wilds Sticky Wilds held for another free spin
}

export interface GameState {
  // this hamster's life (reset when it retires)
  coins: Money;
  upgrades: Levels;
  machines: MachineState[];
  activeMachine: number;
  delivery: { active: boolean; timer: number; duration: number };
  autoTimer: number;
  autoPaused: boolean; // a QoL toggle (not a balance change): while true, Wheel Training doesn't fire by
  // itself, so coins pile up for the next upgrade instead of being spent on auto-spins. Manual spins and
  // deliveries (incl. Self-Starter) work as normal. Resets to false on retire, like the bet and the auto-spin timer.
  gamble: GambleState | null;
  run: { coinsEarned: Money; playTime: number };
  // the family (kept when retiring)
  generation: number;
  seeds: Money;
  seedsEarned: Money;
  tree: Levels;
  stars: Record<string, number>; // M8: Machine Stars by machine type, e.g. { clunky: 2 }
  bigCage: boolean; // M8: between lives, on the Big Cage page (time stands still; the only time you can plant)
  helper: boolean; // 1.3.1: the Hamster Helper is switched on (it only works once the family has planted Helping Paws)
  // 1.4.0: The Great Migration (the colony: kept through retirements; `colony` counts the migrations)
  colony: number; // 0 = the first colony
  colonyCoins: Money; // coins earned this colony: the Heirloom Seed formula reads this (lifetime stats keep counting)
  whiskers: Money; // Golden Whiskers held
  perks: Levels; // colony perk levels (kept for good)
  trial: string | null; // the Colony Trial this life is (null = an ordinary life)
  trialsDone: Record<string, boolean>; // trials beaten this colony
  auto: { retire: boolean; share: number; plant: boolean }; // the Wise Elders' settings
  // the collection (also kept)
  tokens: Money;
  diary: Record<string, boolean>;
  skins: { owned: Record<string, boolean>; equipped: Record<string, string> };
  capsules: { sincePity: number };
  casino: CasinoState; // M11
  ownCasino: OwnCasinoState; // M12
  stats: Stats;
}

// A save is JSON, so every Money in it is written as text ("1234.56", "1.5e400"):
// Saved<T> is T with each Money turned into a string.
export type Saved<T> = T extends Money ? string
  : T extends (infer U)[] ? Saved<U>[]
  : T extends object ? { [K in keyof T]: Saved<T[K]> }
  : T;

// What toSaveData() returns: the state without the open gamble, plus the version.
export type SaveData = Saved<Omit<GameState, 'gamble'>> & { saveVersion: number };

// ───────────────────────── The card gamble ─────────────────────────

export type CardColor = 'red' | 'black';
export type SuitId = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export interface Suit {
  id: SuitId;
  color: CardColor;
}
export interface Card {
  suit: SuitId;
  color: CardColor;
}

// ───────────────────────── Events ─────────────────────────
// Every event game.ts emits, and what it carries.
// game.on('spinResolved', (e) => …) knows that e.payout is a Money, and so on.

export type TokenSource = 'sticker' | 'jackpot' | 'delivery' | 'retire' | 'pull' | 'refund' | 'debug' | 'casino' | 'takings';
export type ChipSource = 'buy' | 'spins' | 'retire' | 'bet' | 'win' | 'prize' | 'refund' | 'debug' | 'takings';
// One roulette bet (M11): a kind, which one (dozen / column / number), and the chips on it.
export interface RouletteBet { kind: RouletteKind; pick: number; amount: Money | number }
export type GambleEndReason = 'collect' | 'lose' | 'max' | 'spin' | 'expired' | 'switch' | 'retire';

export interface GameEvents {
  spinStarted: {
    machineId: string; result: Grid; source: SpinSource; cost: Money; bet: number; free: boolean;
    mystery: { cells: Cell[]; symbol: string } | null; // 1.4.0: the moving boxes that landed and what they all turned into (result shows them turned)
    zoom: number[]; // 1.10.0: the reels Zoomies turned wild (result shows them wild); [] = none
    sticky: Cell[]; // 1.10.0: cells held wild by Sticky Wilds from an earlier free spin (result shows them wild)
    multiplier: number; // 1.10.0: what this spin's wins are multiplied by as a feature (a free spin's ×2, ×3 …; 1 on a paid spin)
  };
  spinResolved: {
    machineId: string; result: Grid; wins: PaidWin[]; payout: Money; fullLine: boolean; tier: string;
    bet: number; free: boolean; streak: number; featureCells: Cell[];
    doubled: boolean; // 1.3.1: Lucky Pennies doubled this win (already in every line's payout)
  };
  spinBlocked: { reason: 'coins' | 'delivery' | 'gamble' | 'bonus' | 'bigCage'; source: SpinSource; cost?: Money };
  betChanged: { machineId: string; index: number; bet: number };
  freeSpinsStarted: { machineId: string; count: number; retrigger: boolean; bet: number; left: number };
  freeSpinsEnded: { machineId: string; spins: number; won: Money };
  jackpotStarted: { machineId: string; pot: string; duration: number; bet: number };
  jackpotWon: { machineId: string; pot: string; amount: Money };
  holdStarted: { machineId: string; cells: Cell[]; respins: number; bet: number; duration: number };
  holdEnded: { machineId: string; amount: Money; coins: number; full: boolean };
  gambleOffered: { machineId: string; stake: Money };
  gambleResolved: {
    machineId: string; win: boolean; pick: string; card: Card; multiplier: number; stake: Money; round: number; next: Money;
  };
  gambleEnded: { machineId: string; reason: GambleEndReason; won: Money; rounds: number; started: boolean };
  coinsChanged: { coins: Money; amount: Money };
  seedsChanged: { seeds: Money; amount: Money };
  upgradeBought: { id: string; level: number; cost: Money; count: number; helper: boolean }; // helper: the Hamster Helper bought it (1.3.1)
  upgradeUnlocked: { id: string; reason: 'generation' | 'sticker' }; // 1.3.1: a rebirth or sticker upgrade is on sale now
  helperChanged: { on: boolean }; // 1.3.1: the Hamster Helper was switched on or off
  autoPausedChanged: { paused: boolean }; // the player paused or resumed auto-spin (Wheel Training)
  machineBought: { id: string; cost: Money };
  machineSwitched: { id: string; from: string };
  treeNodeBought: { id: string; level: number; cost: Money };
  retired: { generation: number; seedsGained: Money; oldName: string; newName: string; runEarned: Money; auto: boolean }; // auto: the Wise Elders did it (1.4.0)
  migrated: { colony: number; whiskers: Money; seedsEarned: Money; generations: number }; // 1.4.0: the family moved (colony = migrations now)
  perkBought: { id: string; level: number; cost: Money };
  trialStarted: { id: string; goal: Money };
  trialCompleted: { id: string; whiskers: Money };
  trialEnded: { id: string; completed: boolean }; // the life with the twist is over (completed, or retired before the goal)
  autoChanged: { retire: boolean; share: number; plant: boolean };
  bigCageLeft: { generation: number; name: string };
  machineRebuilt: { id: string; stars: number };
  deliveryStarted: { duration: number; reward: Money; source: 'manual' | 'auto' };
  deliveryFinished: { reward: Money };
  tokensChanged: { tokens: Money; amount: Money; source: TokenSource };
  stickerEarned: { id: string; tokens: Money };
  capsuleOpened: { skinId: string; rarity: string; duplicate: boolean; refund: Money; pity: boolean };
  skinEquipped: { id: string; category: string };
  offlineEarned: { awaySeconds: number; seconds: number; coins: Money };
  // M11: the casino
  chipsChanged: { chips: Money; amount: Money; source: ChipSource };
  rouletteSpun: { pocket: number; bets: { kind: RouletteKind; pick: number; amount: Money; returned: Money }[]; staked: Money; returned: Money };
  blackjackChanged: { hand: BlackjackHand };
  blackjackEnded: { outcome: BjOutcome; bet: Money; returned: Money };
  derbyRun: { racer: string; winner: string; bet: Money; returned: Money };
  seedDropped: { path: number[]; bin: number; multiplier: number; bet: Money; returned: Money };
  prizeBought: { id: string; cost: Money };
  boostEnded: { id: string };
  // M12: the Family Casino
  ownCasinoOpened: { cabinet: string | null }; // the grand opening (the free first cabinet, if any)
  cabinetBought: { machine: string; cost: Money };
  floorUpgradeBought: { id: string; level: number; cost: Money };
  ownRewardBought: { id: string; cost: Money };
  tillEmptied: { amount: Money; takings: Money };
  tillOffline: { seconds: number; takings: Money }; // takings that went into the till while the game was closed
  dataReloaded: Record<string, never>;
  stateLoaded: Record<string, never>;
}
