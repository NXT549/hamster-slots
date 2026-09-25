// types.ts — LOGIC layer. The SHAPES of the game's data, written down for TypeScript.
//
// Nothing here runs: these are descriptions ("a machine has a name, a spin cost,
// a list of symbols …"). TypeScript checks every file against them, so a typo like
// machine.spinCots, or passing a number where a machine is expected, is caught
// before the game even starts. They're also the best map of the game there is:
// read GameData to see everything data.json can hold, GameState for the save.

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

export interface MachineDef {
  id: string;
  name: string;
  description: string;
  unlockCost: number; // 0 for the free first machine
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

export interface UpgradeDef extends Priced {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'machine'; // the hamster's, or one machine's
  machines?: string[]; // machine upgrades: which machines sell it (missing = all)
  effect: Effect;
}

export interface TreeNodeDef extends Priced {
  id: string;
  name: string;
  description: string;
  branch: string;
  requires: string[]; // node ids that must be planted first
  effect: Effect;
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
}

// A Hamster Diary goal. "stat" goals name a lifetime stat (see Stats below).
export type Goal =
  | { type: 'stat'; stat: keyof Stats; target: number }
  | { type: 'upgradeLevel'; upgrade: string; target: number }
  | { type: 'generation'; target: number }
  | { type: 'treeNodes'; target: number }
  | { type: 'skinsOwned'; target: number }
  | { type: 'machinesOwned'; target: number };

export interface Sticker {
  id: string;
  name: string;
  description: string;
  goal: Goal;
  tokens: number;
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
  retirement: {
    name: string;
    currencyName: string;
    seedDivisor: number;
    seedExponent: number;
    payoutBonusPerSeedEarned: number;
    pupNames: string[];
  };
  familyTree: { branches: Named[]; nodes: TreeNodeDef[] };
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

// One line, scored (machine.js evaluate).
export interface LineResult {
  symbolId: string | null;
  count: number;
  basePayout: number;
  usedWild: boolean;
}

// A winning line of a grid (machine.js evaluateGrid); `line` = its index in the paylines.
export interface LineWin extends LineResult {
  line: number;
  fullLine: boolean; // every reel matched
}

// A winning line after every multiplier (game.ts resolveSpin).
export interface PaidWin extends LineWin {
  payout: number;
}

// ───────────────────────── The game state (the save) ─────────────────────────

export interface FreeSpinsState {
  left: number;
  total: number;
  bet: number; // the bet that won them
  won: number; // coins paid so far
  timer: number; // seconds until the next one
}

export interface BonusState {
  pot: string; // the pot the wheel will land on (decided when it starts)
  timer: number;
  bet: number;
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
  pots: Record<string, number>; // jackpot pots in base units
  bonus: BonusState | null; // the jackpot wheel while it turns
}

export interface GambleState {
  machineId: string;
  stake: number;
  rounds: number;
  won: number;
  started: boolean; // a card has been picked (then it's no longer just an offer)
  timer: number; // seconds left on the offer
}

// Lifetime stats: they keep counting across retirements (only Reset wipes them).
export interface Stats {
  spins: number;
  manualSpins: number;
  autoSpins: number;
  wins: number;
  coinsWon: number;
  coinsSpent: number;
  deliveries: number;
  deliveryCoins: number;
  coinsEarned: number;
  upgradesBought: number;
  playTime: number;
  goldenJackpots: number;
  capsulesOpened: number;
  tokensEarned: number;
  biggestWin: number;
  offlineCoins: number;
  machinesBought: number;
  mostLinesWon: number;
  biggestBet: number;
  freeSpins: number;
  freeSpinTriggers: number;
  freeSpinCoins: number;
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
}

export interface GameState {
  // this hamster's life (reset when it retires)
  coins: number;
  upgrades: Levels;
  machines: MachineState[];
  activeMachine: number;
  delivery: { active: boolean; timer: number; duration: number };
  autoTimer: number;
  gamble: GambleState | null;
  run: { coinsEarned: number; playTime: number };
  // the family (kept when retiring)
  generation: number;
  seeds: number;
  seedsEarned: number;
  tree: Levels;
  // the collection (also kept)
  tokens: number;
  diary: Record<string, boolean>;
  skins: { owned: Record<string, boolean>; equipped: Record<string, string> };
  capsules: { sincePity: number };
  stats: Stats;
}

// What toSaveData() returns: the state without the open gamble, plus the version.
export type SaveData = Omit<GameState, 'gamble'> & { saveVersion: number };

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
// Every event game.ts emits, and what it carries (AGENTS.md → Events).
// game.on('spinResolved', (e) => …) knows that e.payout is a number, and so on.

export type TokenSource = 'sticker' | 'jackpot' | 'delivery' | 'retire' | 'pull' | 'refund' | 'debug';
export type GambleEndReason = 'collect' | 'lose' | 'max' | 'spin' | 'expired' | 'switch' | 'retire';

export interface GameEvents {
  spinStarted: { machineId: string; result: Grid; source: SpinSource; cost: number; bet: number; free: boolean };
  spinResolved: {
    machineId: string; result: Grid; wins: PaidWin[]; payout: number; fullLine: boolean; tier: string;
    bet: number; free: boolean; streak: number; featureCells: Cell[];
  };
  spinBlocked: { reason: 'coins' | 'delivery' | 'gamble' | 'bonus'; source: SpinSource; cost?: number };
  betChanged: { machineId: string; index: number; bet: number };
  freeSpinsStarted: { machineId: string; count: number; retrigger: boolean; bet: number; left: number };
  freeSpinsEnded: { machineId: string; spins: number; won: number };
  jackpotStarted: { machineId: string; pot: string; duration: number; bet: number };
  jackpotWon: { machineId: string; pot: string; amount: number };
  gambleOffered: { machineId: string; stake: number };
  gambleResolved: {
    machineId: string; win: boolean; pick: string; card: Card; multiplier: number; stake: number; round: number; next: number;
  };
  gambleEnded: { machineId: string; reason: GambleEndReason; won: number; rounds: number; started: boolean };
  coinsChanged: { coins: number; amount: number };
  seedsChanged: { seeds: number; amount: number };
  upgradeBought: { id: string; level: number; cost: number; count: number };
  machineBought: { id: string; cost: number };
  machineSwitched: { id: string; from: string };
  treeNodeBought: { id: string; level: number; cost: number };
  retired: { generation: number; seedsGained: number; oldName: string; newName: string; runEarned: number };
  deliveryStarted: { duration: number; reward: number; source: 'manual' | 'auto' };
  deliveryFinished: { reward: number };
  tokensChanged: { tokens: number; amount: number; source: TokenSource };
  stickerEarned: { id: string; tokens: number };
  capsuleOpened: { skinId: string; rarity: string; duplicate: boolean; refund: number; pity: boolean };
  skinEquipped: { id: string; category: string };
  offlineEarned: { awaySeconds: number; seconds: number; coins: number };
  dataReloaded: Record<string, never>;
  stateLoaded: Record<string, never>;
}
