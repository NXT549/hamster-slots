# Hamster Slots — Design

> Working title. A cute pixel-art idle/clicker game. A tiny hamster runs on a wheel, and the wheel powers a slot machine.
> **Web-first (since 2026-09-25):** this browser game *is* the game; there is no engine port. It ships from one web codebase: GitHub Pages first (friends play from a link), then itch.io, then Steam (Electron or Tauri), maybe mobile (Capacitor). See `PORTING_NOTES.md` (D106). **1.0 (§23)** is milestones 1–8, polished; more content comes after it as updates: **1.1.0** (the same day) added M9, three more machines (§24), and M10, Wardrobe buffs (§25); then 1.2.0 the visual redesign (§26), 1.3.0 the Hamster Casino (§27), **1.3.1 "Nuts & Bolts"**, more upgrades (§28), 1.3.2 "Rest Stop" (a pause button for auto-spin, §17), **1.4.0 "The Great Migration"**, a mega rebirth for the late game (§29), **1.5.0 "The Glow Up"**, a full visual redesign: still pixel art, now painted with far more detail and life (§30), **1.6.0 "New Digs"**, the first part of a full UI redesign: the hamster's room in wood, paper and brass, a purse, a control deck, the tabs at the bottom of a phone and a new Upgrades tab (§31; its other parts come in later updates), and **1.6.1 "Fresh Coat"**, machine skins on every machine and five new ones (§14, §25). **Every update has a name** from what it's about (AGENTS.md → Git and releases). Playtests keep tuning the fun and the balance.
> All currency is fake in-game coins. There is no real money and nothing to buy with real money.

Every number in this file comes from `data.json`. If you change one there, change it here too, and log it in `PORTING_NOTES.md` → Balance log.

---

## 1. Design pillars

1. **Cute first.** Every system should have a hamster reason: cheeks, snacks, wheels, deliveries.
2. **Always something to buy soon.** In the early game the next upgrade should never be more than about 30 seconds away.
   *Since milestone 7 (the user's pick, "real slog"):* **the first life is a slog on purpose** (first buy ~2 min, Wheel Training ~10 min, first retirement ~45–75 min) so every upgrade feels earned; later lives get faster. Something is always *in sight*, just not always soon. See §10 and §21.
3. **Manual → automatic.** Tapping is fun for a minute. Watching your hamster do it for you is the reward.
4. **You can never get stuck.** Spins cost coins, but the hamster can always go on a food delivery to earn more.
5. **Readable numbers.** Every payout and cost comes from `data.json` and a formula you can check with a calculator.

---

## 2. Core loop

```
            ┌───────────────────────────────────────────────┐
            ▼                                               │
   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
   │ PAY to SPIN  │ ──► │  WIN coins   │ ──► │  BUY upgrades         │
   └──────────────┘     └──────────────┘     │  better / cheaper /   │
          │                                  │  faster / more reels  │
          │ broke?                           └──────────────────────┘
          ▼
   ┌──────────────────┐
   │ FOOD DELIVERY    │  slow, safe coins; the machine has no power
   │ (timed, no skill)│  while the hamster is away
   └──────────────────┘
```

> **Milestone 7 made the first life a slog** (§21): 3-second spins, a blank symbol, symbols you unlock, Luck, and much slower pacing. The times below are from the balance simulator (§10), for an idle-ish first life.

- **Early game (0–10 min):** spin by hand on the 2-reel **Old Clunky**. It starts with only Sunflower Seeds and Wood Shavings: a win about 1 spin in 4. Buy Chubby Cheeks (~2 min), a Lucky Horseshoe (Luck) or **New Seeds** (the Baby Carrot: bigger prizes, fewer wins). Out of coins? A food delivery pays 4 spins.
- **Mid game (10–40 min):** buy **Wheel Training** (~10 min) and the hamster spins on its own, a bit slower than you click. Save up for the **Third Reel** and the **Golden Seed**, and buy Luck to win more often.
- **A second machine (~45–60 min):** the **Snack Stacker** (5,000 coins): three rows, several paylines, pricier spins, bigger wins. Around the same time the first **retirement** is worth it (3 seeds). You can switch back to Old Clunky any time. See §16.
- **Bets (milestone 6):** **High Roller** unlocks bigger bets (×2 … ×10). Every spin costs and pays × your bet (§18).
- **Bonus features and more machines:** the **Burrow Bonanza** (lives 4–5) has Hamster Wilds and free spins; the **Pouch Palace** (from about the 8th life) has jackpot pots and a jackpot wheel. Any win you pulled yourself can be gambled on a card (§19, §21). See §16 and §19.
- **Retirement loop (milestone 2):** once the family has earned enough coins, the hamster can **retire to the Big Cage** for **Heirloom Seeds**. A new pup starts over, and you plant the seeds in the **Family Tree** for permanent traits. Every life starts stronger than the last. See §13.

```
   play a life ──► earn coins ──► RETIRE ──► +Heirloom Seeds ──► plant in the Family Tree
        ▲                                                                  │
        └──────────────── a new pup, born with the family's traits ────────┘
```

---

## 3. The first machine: Old Clunky (milestone 1)

> There are now two machines. This section is Old Clunky, the free one every hamster starts with. The Snack Stacker, how buying and switching work, and paylines on a grid are in §16.

- **Starts with 2 reels.** The *Third Reel* upgrade adds a 3rd reel, the most it can have.
- **1 payline**, read left to right. Each reel shows 3 rows, but only the middle row (the payline) counts. The rows above and below are decoration.
- Each reel lands on a symbol **independently**, picked at random by **weight**.
- **Each spin costs coins** (5 at the start). You pay when the spin starts.
- A spin takes **3 s** of game time (0.8 s before milestone 7), and the reels stop one at a time (§21). The result is decided when the spin *starts* (so the UI knows where to stop the reels) and paid when the spin *ends*.
- Controls: click SPIN or tap **Space**. Holding Space does *not* repeat. Each spin needs a tap, so manual play can't replace Wheel Training (a tap during a spin queues the next one, §17).

### Win rule: count matches from the left

Count how many identical symbols appear in a row **starting from reel 1**. If that count is 2 or more, pay `payouts[symbol][count]`.

| Reels | Example | Result |
|---|---|---|
| 2 | 🌻 🌻 | 2-match, pays the Seed "2" amount |
| 2 | 🌻 🥕 | no win |
| 3 | 🥕 🥕 🥕 | 3-match, pays the Carrot "3" amount only (not the 2 as well) |
| 3 | 🥕 🥕 🌻 | 2-match, pays the Carrot "2" amount |
| 3 | 🌻 🥕 🥕 | no win (the match doesn't start at reel 1), unless the machine **pays both ways** (below) |

This rule works unchanged for 4, 5 or more reels later.

### Pays Both Ways (an upgrade; after the first M7 playtest)

*"Issue with 3 slots: it's based left to right, meaning if you get 2 on the right it doesn't count."* (the user, 2026-09-27). Left to right stays the rule at the start, like a real pokie; the user picked making "both ways" **an upgrade you buy** (PORTING_NOTES D119). Every machine sells one, **Pays Both Ways** (§5, §16):

- Every line is **also read from the right-hand reel**, with the same rule (matches in a row, wilds fill in, a Wood Shaving or a scatter ends the run). That win pays too, on its own: 🌻 🥕 🥕 pays the Baby Carrot pair; Sunflower, Sunflower, Wood Shaving, Carrot, Carrot on 5 reels pays both pairs.
- **A full line pays once**, not once from each side (🥕 🥕 🥕 is one Carrot line).
- With 2 reels every pair is a full line, so it would change nothing: Old Clunky's needs the **Third Reel** first (data: `"requires": ["thirdReel"]`; the shop says "Needs Third Reel").
- The win show says "from the right" and lights the cells on the right. It's a coin upgrade, so it resets when the hamster retires.
- The maths stays exact (machine.ts `expectedValue`): a line read backwards has the same odds as one read forwards, so both ways adds exactly the EV of every line that isn't full. The hit rate is counted exactly too (a win needs reels 1 + 2 or the last two to pair).

| Old Clunky, 3 reels, no Luck | EV | RTP | Hit rate |
|---|---:|---:|---:|
| Fresh | 10.10 → **13.65** | 202% → **273%** | 27.7% → **40.8%** |
| Both symbols unlocked | 14.24 → **21.51** | 285% → **430%** | 18.8% → **31.3%** |

On the bigger machines it's worth more (a 5-reel line has room for a run at each end): about ×1.7 on a full Snack Stacker and ×1.9 on the Burrow Bonanza and the Pouch Palace.

### Symbols

Since milestone 7 Old Clunky **starts with Sunflower Seeds and Wood Shavings only**; **New Seeds** (a machine upgrade, §5) unlocks the Baby Carrot, then the Golden Seed (§21).

| id       | Name            | Sprite (src/view/art.ts)               | Weight | Chance per reel (fresh → both unlocked) |
|----------|-----------------|----------------------------------|-------:|----------------:|
| `seed`   | Sunflower Seed  | grey striped seed                | 50     | 52.6% → 37.9%   |
| `carrot` | Baby Carrot 🔒  | orange carrot, green leaves      | 25     | locked → 18.9%  |
| `golden` | Golden Seed 🔒  | the seed recoloured gold + sparkles | 12  | locked → 9.1%   |
| `blank`  | Wood Shaving    | a curl of tan shaving            | 45     | 47.4% → 34.1%   |

Luck (§21) multiplies every weight except the Wood Shaving's.

### Payouts (base, before upgrades)

| Symbol       | 2-match | 3-match |
|--------------|--------:|--------:|
| Sunflower    | 27      | 45      |
| Baby Carrot  | 95      | 400     |
| Golden Seed  | 280     | 2,400   |
| Wood Shaving | never pays | |

The Sunflower line pays little more than its pair, and the symbols you unlock pay much more: that's what makes every unlock raise the average win (§21, PORTING_NOTES D98).

### Expected value and RTP (the maths behind the tables)

**RTP** (return to player) = expected payout ÷ spin cost. **It must stay above 100%.** Below that, spinning loses coins on average and the incremental loop breaks. Above it, every spin is a small, risky investment.

With chance `p` for a symbol on each reel:
- P(exactly k in a row, and more reels follow) = pᵏ × (1 − p)
- P(all R reels match) = pᴿ

| Old Clunky (no Luck) | EV per spin | Spin cost | **RTP** | Profit per spin | Hit rate |
|---|---:|---:|---:|---:|---:|
| 2 reels, fresh | 7.48 | 5 | **150%** | +2.48 | 27.7% |
| 2 reels, Baby Carrot | 8.81 | 5 | 176% | +3.81 | 21.7% |
| 2 reels, both unlocked | 9.60 | 5 | 192% | +4.60 | 18.8% |
| 3 reels, fresh | 10.10 | 5 | 202% | +5.10 | 27.7% |
| 3 reels, both unlocked | 14.24 | 5 | **285%** | +9.24 | 18.8% |
| 2 reels, fresh, max Luck (100) | 12.84 | 5 | 257% | +7.84 | 47.6% |
| 3 reels, both unlocked, max Luck | 22.08 | 5 | 442% | +17.08 | 27.3% |
| 2 reels, fresh, Luck 120 (+ the Rabbit's Foot, 1.3.1) | 13.60 | 5 | 272% | +8.60 | 50.4% |
| 3 reels, both unlocked, Luck 120 | 23.09 | 5 | 462% | +18.09 | 28.3% |

"Max Luck" is Luck 100 (the Four-Leaf Clover and the Lucky Horseshoe maxed). Since 1.3.1 a sticker unlocks the Rabbit's Foot, +20 Hamster Luck more (§28), so the most is 120 from upgrades (family traits, hats and the casino's charm add more).

The hit rate is the same on 2 and 3 reels because a win only needs reels 1 and 2 to match. The third reel just makes some of those wins bigger. **Every unlock raises the EV and lowers the hit rate; every point of Luck raises both** (tests check both, §9).

A Golden Seed 3-match comes up about 1 in 1,331 spins with both symbols unlocked and no Luck (1 in 760 with max Luck).

---

## 4. Food delivery (the safety net)

*"Your hamster hops on a tiny scooter and delivers sunflower seeds around the neighbourhood."*

| Field | Value |
|---|---|
| Duration | 45 s of game time (30 s before milestone 7) |
| Reward | +20 coins (always, no luck involved): 4 spins on Old Clunky |
| Rate | 0.44 coins/s |
| Can start | any time no delivery is running, even with 0 coins |

Why 4 spins: at a ~28% hit rate, a delivery worth 2 spins misses about half the time, and being broke turns into a loop (PORTING_NOTES D101).

- **While the hamster is away, the machine has no power.** The hamster is the one running the wheel, so no manual spins and no auto-spins happen. A spin that was already running still finishes and pays.
- Deliveries are what make spin costs safe. You can never be stuck with too few coins to spin.
- They're deliberately **weaker than auto-spinning**, so they stay a safety net and don't become the best strategy (see balance rule 2).

---

## 5. Upgrades (milestone 1)

Every upgrade uses the same cost formula:

```
cost(owned) = floor( baseCost × growthRate ^ owned )
```

`owned` is how many levels you already have. So the first level costs `baseCost`, and each later level costs `growthRate` times the previous one.

Upgrades are either **global** (they belong to the hamster and work on every machine) or **machine** (they belong to one machine, and each machine keeps its own levels). A machine upgrade can list the machines that sell it (`"machines": ["clunky"]` in data.json): the Oiled Lever and Third Reel are Old Clunky's, and the Snack Stacker has its own (§16). The shop only shows the hamster's upgrades plus the ones for the machine you're running.

You can buy one level, **×10**, or **Max** at a time (§17). A bundle costs the sum of its levels, each from the formula above.

**Since 1.3.1** there are 20 more upgrades (§28), and some are **locked** until the family reaches a generation (**rebirth upgrades**) or earns a diary sticker (**sticker upgrades**). The Hamster Helper (a Family Tree trait) can buy the cheap ones for you.

### 🐹 Chubby Cheeks (global, payouts)
*"Stuffs more coins in those cheeks."*

| Field | Value |
|---|---|
| Effect | +25% to all payouts per level (additive) |
| Formula | `payoutMultiplier = 1 + 0.25 × level` |
| Cost | 200 × 1.16ⁿ, no max. This is the long-term coin sink. |
| First costs | 200, 232, 269, 312, 362, 420, 487, 565, 655, 760 … |

### 🎡 Wheel Training (global, auto-spin)
*"Your hamster learns to run the wheel on its own."*

| Field | Value |
|---|---|
| Effect | Level 1 turns on auto-spin. Each extra level makes it faster. |
| Formula | `autoInterval = max(4.6 × 0.93^(level − 1), spin time + 0.8 s rest)` seconds between spin starts (× Quick Paws). The **rest** (data: `rest`) means auto-spin never starts before you've had a beat to see the win (§21). |
| Cost | 600 × 1.6ⁿ, **max level 4** (on Old Clunky, level 4 reaches the floor: 3 s + 0.8 s) |
| Costs | 600, 960, 1,536, 2,457 (5,553 total) |

| Level | Interval on Old Clunky | Auto spins/s | Profit/s, fresh 2 reels | Profit/s, 3 reels + both unlocks |
|------:|---------:|-------------:|--------------------:|--------------------:|
| 1 | 4.60 s | 0.22 | 0.54 | 2.01 |
| 2 | 4.28 s | 0.23 | 0.58 | 2.16 |
| 4 | 3.80 s (the floor) | 0.26 | 0.65 | 2.43 |

(Profit/s here means before Chubby Cheeks, Luck and the Oiled Lever. Clicking non-stop is one spin every 3 s, so auto-spin is a bit slower than a keen clicker: it's for when you stop clicking.) The floor depends on the machine's spin time: 4.0 s on the Snack Stacker (reached at level 3) and 4.4 s on the 5-reel machines (reached at level 2).

- Auto-spin waits if you can't afford a spin, or while the hamster is out on a delivery.
- Manual spins still work between auto-spins, on top of them.
- **The pause toggle** (§17, the user's "no option to pause the hamster" on mobile) lets you stop auto-spin without losing the upgrade: a ⏸/▶ button by Spin, view only.

### 🍀 Four-Leaf Clover (global, Hamster Luck; milestone 7)
*"Your hamster found a four-leaf clover."* **+10 Luck on every machine** per level (§21). Cost 500 × 2ⁿ, **max level 5** (500, 1,000, 2,000, 4,000, 8,000): up to 50 Hamster Luck.

### 🪙 High Roller (global, bet sizes; milestone 6)
*"Your hamster learns to carry bigger coins."* Each level unlocks the next bet size on **every** machine (§18).

| Field | Value |
|---|---|
| Effect | `betSteps`: +1 bet step per level. Bet steps are ×1, ×2, ×3, ×5, ×10 (data.json `betSteps`) |
| Cost | 3,000 × 15ⁿ, **max level 4**: 3,000 · 45,000 · 675,000 · 10,125,000 (M6: 2,000 × 10ⁿ) |

### 🔥 Hot Streak (global, milestone 6)
*"Wins in a row get your hamster fired up."* Every machine counts its winning paid spins in a row. The next win pays × (1 + 0.05 × level × min(streak, 5)).

| Field | Value |
|---|---|
| Effect | `winStreak`: +5% per win in a row per level, counting at most 5 wins in a row |
| Cost | 20,000 × 4ⁿ, **max level 5** (20K · 80K · 320K · 1.28M · 5.12M). Maxed: up to ×2.25 on the 5th win in a row |
| Average | Exact: × (1 + 0.25 × (h + h² + … + h⁵)), h = the line hit rate. Maxed, on a fully unlocked machine with no Luck: ×1.06 on Old Clunky, ×1.32 on the Stacker, ×1.20 on the Bonanza, ×1.24 on the Palace (it rewards machines that win often, and Luck, which raises the hit rate) |

Free spins don't touch the streak, and a free-spin win never gets the streak bonus.

### 🛢️ Oiled Lever (machine, cheaper spins)
*"A drop of oil and the old lever takes fewer coins per pull."* This is the "more spins per coin" upgrade.

| Field | Value |
|---|---|
| Effect | Spin cost × 0.9 per level |
| Formula | `spinCost = 5 × 0.9^level` (rounded to cents) |
| Cost | 200 × 1.35ⁿ, **max level 8** |
| Costs | 200, 270, 364, 492, 664, 896, 1,210, 1,634 (5,730 total) |
| Spin cost | L0 5.00 · L1 4.50 · L2 4.05 · L4 3.28 · L8 2.15 |

On 2 reels a cheaper spin matters most, because the profit per spin is thin. Chubby Cheeks matters more once you have 3 reels. The best buy changes as you progress, and that's intended.

### 🎰 Third Reel (machine, one-time)
*"Bolt a third reel onto Old Clunky."*

| Field | Value |
|---|---|
| Effect | +1 reel (2 → 3) |
| Cost | 1,600, once only |
| Impact | fresh machine: RTP 150% → 202%; both symbols unlocked: 192% → 285% (profit per spin about 2×) |

### 🌱 New Seeds (machine, symbol unlocks; milestone 7)
*"Paint a new symbol onto Old Clunky's reels: first the Baby Carrot, then the Golden Seed."* Cost 300 × 6ⁿ, **max level 2** (300, then 1,800). Level 1 unlocks the Baby Carrot, level 2 the Golden Seed. Each raises the average win and lowers the hit rate (2 reels: 7.48 / 27.7% → 8.81 / 21.7% → 9.60 / 18.8%). Every machine has one of these (§16, §21).

### 🧲 Lucky Horseshoe (machine, Machine Luck; milestone 7)
*"A horseshoe nailed above Old Clunky's reels."* **+10 Luck on this machine** per level. Cost 300 × 2ⁿ, **max level 5** (300 … 4,800): up to 50 Machine Luck. Every machine has one (§16).

### ⇄ Pays Both Ways (machine, one-time; after the M7 playtest)
*"Old Clunky reads its line from the right-hand reel too, so a pair on reels 2 and 3 pays."* Effect `bothWays` (§3). Cost **5,000**, once only (the same as the Snack Stacker), and it **needs the Third Reel** (`requires`). Fresh: RTP 202% → 273%, hit rate 27.7% → 40.8%; both symbols unlocked: 285% → 430%, 18.8% → 31.3%. Every machine has one (§16).

---

## 6. Currencies

| Currency | Milestone | How you earn it | What it buys |
|----------|-----------|-----------------|--------------|
| **Coins** | 1 | Winning spins, food deliveries | Spins, upgrades, new machines (§16). Reset when you retire. |
| **Heirloom Seeds** | 2 | Retiring your hamster (§13) | Family Tree traits, kept forever, planted in the Big Cage. Each seed you **hold** gives +1.5% payouts (M8, §22); planting spends it. |
| **Hamster Tokens** | 3 | Diary stickers, golden jackpots, every 5th delivery, retiring (§14) | Capsule Machine pulls, i.e. skins only. Never power. Kept when you retire. |

- You start with **100 coins** (20 spins on Old Clunky; 25 before milestone 7). At a ~28% hit rate that makes going broke in the first minutes rare (~3%).
- Coins are rounded to cents after every change, so floating-point drift can never leave you 0.0000001 coins short. The UI shows up to 2 decimals below 1,000 and whole numbers above that.

---

## 7. Save data

- Autosave every 10 s, and also when the tab is hidden or closed. On the web the save lives in `localStorage`; saving goes through the platform layer, so Steam and mobile can store it their own way (PORTING_NOTES → The platform layer).
- **Save backup (Menu → Save backup, since 3.8):** the save as a one-line code (`HS1:…`, about 1.5–4 KB) to copy out and paste back in, as a backup and to move a save between sites or devices (the user asked for it with the web-first plan, 2026-09-25). A pasted code is checked first and says what's in it (pup, generation, coins, seeds, machines, when it was made) or what's wrong with it; loading it needs two taps, replaces the game, and pays no offline earnings for the time since the code was made. Old codes load like old saves (the migrations).
- The save holds **player state only**: coins, upgrade levels, any in-progress spin or delivery, this life's totals, the family (generation, Heirloom Seeds, seeds ever earned, tree levels, Machine Stars, whether it's in the Big Cage), lifetime stats, and a `saveVersion` number. Amounts of money are saved as text ("1.5e400"), so they can grow without limit (save v8). It never holds balance values. That way, a change to `data.json` applies straight away to an existing save.
- When a save loads, unknown upgrades and tree nodes are dropped and levels are capped at the current max, in case `data.json` changed.
- **Save version 2** (milestone 2) added the family. A version 1 save is migrated: the hamster becomes generation 1, and everything it had already earned counts towards its first seeds.
- **Save version 3** (milestone 3) added Hamster Tokens, the diary, owned/equipped skins and the pity counter. A v2 save starts with no tokens, then gets every diary sticker it had already reached.
- **Save version 4** (milestone 4) added two lifetime stats, `biggestWin` and `offlineCoins` (older saves start them at 0).
- **Save version 5** (milestone 5) made each machine's spin result a **grid** (`result[reel][row]`) and added the stats `machinesBought` and `mostLinesWon`. A v4 result (one symbol per reel) becomes a one-row grid; an old save with wins starts `mostLinesWon` at 1. The save can hold several machines; loading keeps each machine type once and always keeps the free first machine.
- **Save version 6** (milestone 6) gave every machine its chosen **bet**, **free spins** (left, total, bet, won), its **jackpot pots**, a jackpot wheel in progress (`bonus`), its **win streak**, and the bet a running spin was paid with. New lifetime stats: `biggestBet`, `freeSpins`, `freeSpinTriggers`, `freeSpinCoins`, `wildWins`, `bestStreak`, `jackpotsWon`, `grandJackpots`, `gambleWins`, `gambleLosses`, `bestGambleRun`. A v5 save starts them all at their defaults (bet ×1, pots at their seeds, 0). An open **gamble is never saved** (dropping it = collecting: its coins are already in your pile).
- **Save version 9** (milestone 8) added **Machine Stars** (`stars`, by machine type, kept through retiring), the **Big Cage** flag (`bigCage`: between lives, §22) and the stats `rebuilds`, `bestStars` and `mostSeedsHeld`. A v8 save has no stars and is mid-life. (Save version 8 wrote money as text, see above.)
- **Save version 10** (milestone 9) added a hold & spin in progress on a machine (`hold`: the acorns, every respin, the bet and its timer; §24) and the stats `bestWays`, `holdBonuses`, `holdGrands` and `bestWheel`. A v9 save has no hold under way and starts them at 0. A saved hold that doesn't fit the machine any more (a data change) is dropped, like a broken spin.
- **Save version 11** (M11) added the family's casino (chips, boosts, a blackjack hand) and nine casino stats (§27). **Save version 12** (1.3.1) added the Hamster Helper's switch (`helper`) and the stats `doubleWins` and `helperBuys` (§28); an older save starts with the switch on and the stats at 0.
- **Save version 7** (milestone 7) added **symbols you unlock** and the stats `symbolsUnlocked`, `bestLuck` and `suitWins`. Machines now start with some symbols locked, so a v6 save gives every machine every unlock it sells (maxed): an older hamster had every symbol, and nobody loses one. Luck isn't stored (it comes from upgrade levels), and neither is the gamble's card history.
- The save also keeps `savedAt` (real-world time), which pays **offline earnings** on the next visit (§15).
- Settings (sound on/off and volume, Motion, Quick reels, Numbers, the ×1/×10/Max choice, and since 1.9.0 UI sounds and the Guide) are stored separately from the save, so **Reset progress** keeps them.
- **Menu → Reset progress** wipes the save, *including the family*. You have to tap it twice within 3 s, so it can't happen by accident. (Retiring is the "soft" reset that keeps the family.)
- The game only runs while the tab is open and visible. Time away (closed or hidden) is paid as offline earnings instead (§15).

---

## 8. Debug panel (milestone 1)

Toggle with the **`` ` ``** (backtick) key, or Menu → Toggle debug panel. It's always there while developing; on the public site only with `?debug` in the address (players don't stumble on it).

- Machine stats: which machine (reels × rows, paylines, how many you own), EV per spin, payout multiplier, spin cost, RTP, auto interval
- **Expected auto profit/s** vs **measured net coins/s** (last 10 s of game time: payouts + deliveries − spin costs)
- Spins, hit rate (vs expected), deliveries, play time, RNG seed
- Buttons to add coins: +100 / +1K / +10K. These are free coins and **don't** count as earned, so they give no seeds.
- Family buttons: **Earn +10K / +100K** (counts as earned, so you can test retiring quickly), **+5 seeds**, **Open the Big Cage** (M8: plant without retiring; the new life starts when you leave) and **Unlock every upgrade** (1.3.1: every rebirth and sticker upgrade on sale, until the page reloads).
- Capsule buttons: **+10 / +100 tokens** (free, not counted as earned). Stats: tokens, stickers, capsules opened, skins, pity countdown, golden jackpots.
- Offline buttons: pretend you were away **10 min / 1 h / 10 h** (opens the welcome-back dialog; needs Wheel Training).
- Bonus buttons (milestone 6): **+5 free spins** (machines with free spins) and **Wheel: Mini / Minor / Major / Grand** (starts the jackpot wheel on a chosen pot; machines with pots, when not spinning). Stats: feature odds and EV, pots, free spins left, bet (chosen, max, what the next spin uses), streak.
- Milestone 7: **Offer a gamble (100)** opens the card gamble without a winning spin (set game time to 0× first to freeze its countdown). Stats: **Luck** (Hamster + Machine) and how many of the machine's symbols are unlocked.
- Family stats: generation and pup name, this life's time and coins, seeds (to spend / ever earned / pending), heirloom bonus, lifetime earned.
- Time speed: 1× / 2× / 5× / 10× / 50×. This speeds up *game time*, so spins, auto-spins and deliveries all scale together.
- **Reload data.json**: re-reads the balance file and keeps your progress, so you can tweak numbers mid-game. Only while developing (`npm run dev`), where saving data.json also applies it by itself; a built game has data.json bundled in, so the button is hidden there.

---

## 9. Balance rules (the tests check these)

1. Every machine setup (each reel count, **each payline count**, each Hamster Wild level, with and without **Pays Both Ways**, and **each step of its symbol unlocks, locked symbols included**) has a base **RTP above 100%**, counting its features (free spins, jackpot pots) without feature upgrades and with no Luck (Luck only raises it). The lowest is Old Clunky fresh on 2 reels (150%); the Snack Stacker starts at 151%, the Burrow Bonanza at 400%, the Pouch Palace at 784%, and M9's Hamster Maze at 1,828%, the Acorn Vault at 1,246% (hold & spin included) and the Big Cheese at 1,322% (the cheese wheel included). **The bet never changes the RTP** (a test checks it at every bet).
2. **Delivery coins/s must be lower than auto-spin profit/s at Wheel Training level 1** on the starting machine. Currently 0.44 vs 0.54. **This must also hold with the whole Family Tree** (faster, bigger deliveries), on 2 reels and on 3 reels. Currently 1.00 vs 2.76 (2 reels) and 1.00 vs 3.55 (3 reels), with no Chubby Cheeks and no heirloom bonus. (The Snack Stacker earns far more per second than a delivery, so it's never the problem.)
3. **One delivery always covers at least one spin** at base spin cost **on the free first machine**, so 0 coins is never a dead end. Currently 20 vs 5. A Snack Stacker spin (25) costs more than a delivery, but you can always switch back to Old Clunky, and the free machine can never be lost. (Bets don't break this: a spin you can't afford at your bet steps down to one you can, down to ×1.)
4. **The gamble is fair and can't farm seeds** (milestone 6; the card gamble since M7): a colour wins 50% for ×2 and a suit 25% for ×4 (a test checks 20,000 picks of each, the win rates AND the average pay-back of 0), and gamble wins and losses never count as coins *earned*, so gambling can't raise Heirloom Seeds.
5. **Free spins always end**: every free spin retriggers less than once on average (Burrow Bonanza with every Bouncy Ball and max Luck: 0.13; with the whole Family Tree too, Ball Pit included, still well below 1), so the expected number of free spins per trigger is finite (26.8).
6. **Every symbol unlock raises the EV and lowers the hit rate** (milestone 7), in every setup of every machine (Pays Both Ways included), at no Luck and at max Luck: bigger prizes, fewer wins, never a trap (§21).
7. **Every level of Luck raises both the hit rate and the EV** (milestone 7), on every machine, with nothing and with everything unlocked, and paying both ways. (M8's Lucky Family trait and Machine Stars add Luck the same way.) M9's machines are in every one of these checks: every reel count of the Hamster Maze and every Maze Runner level, every payline count of the Vault and the Big Cheese, both ways, every unlock step, Luck 0 to max.
9. **Machine Stars and the M8 traits only ever add** (M8): a star multiplies a machine's payouts and adds Machine Luck; Golden Pouches raise the pots' seeds; the EV stays exact with them (the tests compare the game's EV with `spinExpectation` / `jackpotStats`).
8. **The auto-spin interval is never shorter than the spin time + the rest** (0.8 s; milestone 7), on every machine and Wheel Training level, with or without Quick Paws.
10. **Ways, hold & spin and the cheese wheel are exact** (M9): the ways EV and hit rate match every grid of a small test machine added up by brute force (to 1e-9) and sampled Maze spins; hold & spin's trigger is exactly the binomial tail and its average matches a Monte Carlo of the bonus; the wheel's EV matches sampling. The time a hold & spin takes is counted in the machine's coins per second.
11. **The casino keeps a small house edge and can't farm anything** (M11, §27): every casino bet gives back between 94% and 99.5% on average (each game's return is exact and matches play), and chips never turn into coins or count as coins earned. **Every rule above holds with every casino boost on:** the Lucky Charm is Luck (so it raises the hit rate and the EV), Turbo Wheel keeps the rest floor, deliveries stay below auto-spin, and free spins still end with the charm on top of the whole tree, max Luck, every Bouncy Ball and the best wardrobe.
12. **The new upgrades keep every rule** (1.3.1, §28): Lucky Pennies' double is exact (the lines × (1 + chance)); free spins still end with Ball Bearings; auto-spin never beats spin + rest with Running Shoes; offline earnings stay below playing with Night Shift maxed; the bet still stops at ×10 (D80).

13. **The Family Casino can't farm anything and never touches your odds** (M12, §32): every cabinet's guest return is below 100% and at least `minGuestRtp` (88%) with every Floor Manager level; the takings are an exact average (no RNG); Takings never become coins or count as coins earned; every machine's economy is identical with the whole Family Casino.

## 10. Balance targets (what "good" looks like)

### Milestone 7: the slog (targets and what the simulator measured)

The user picked **"real slog"** for the first life (PORTING_NOTES D93). Measured with `node tools/sim.mjs --lives 12 --seeds 5` (ranges over 5 seeds; the bot buys by "time to afford + time to pay back", D100; PORTING_NOTES → Playtest notes has the full tables).

| Moment (first life) | Target | Measured, idle-ish bot | Measured, active bot |
|---|---|---|---|
| Spin time | ~3 s (5-reel machines a little longer) | 3 s · 3.2 s (Stacker) · 3.6 s (5 reels) | same |
| First upgrade | ~2–3 min | (the idle bot saves for Wheel Training first) | ~0.7–2 min (one unlucky seed 14.6) |
| Wheel Training 1 | ~10 min | 8–23 min | not needed (it clicks) |
| Baby Carrot unlocked | | 21–49 min | 9–23 min |
| Third Reel | | 37–70 min | 20–37 min |
| Family tab (1 seed) | | 8–13 min | 7–13 min |
| First retirement (3 seeds, ~11,700 coins) | ~60 min | **46–77 min** | 28–45 min |
| Old Clunky hit rate at the start | ~25–30%, rising with Luck | **27.7%** (47.6% with max Luck) | |
| Later lives | clearly faster | 35–43 · 32–50 · 39–65 · 33–46 · 31–40 · 16–31 min (gens 2–7) | 24–31 · 27–39 · 28–37 · 22–35 · 22–28 · 12–21 min |
| Snack Stacker / Burrow Bonanza / Pouch Palace | | ~30–37 min into gen 2 / gens 4–5 / from gen 8 | a little earlier |
| Whole Family Tree | | 4.0–4.9 h | 2.7–3.4 h |

**Late lives (M7's known issue; much better since M9's seed jar):** from generation ~9 lives got short again: once bets ×10 and the Palace multiply income, a square-root seed curve hands out seeds easily. M8 kept generations 1–8 close to M7 (§22) but didn't fix the late lives, and M9's machines alone didn't either: the heirloom bonus grew with every seed held (+7,600% by generation 13), so a late life lasted about a minute (D127). **The user picked the seed jar** (§13, D128): held seeds pay up to +100%, and Family Fortune makes the jar bigger. Now the simulated players' lives dip to 2–9 minutes around generations 12–15 and grow again as the family works through M9's machines (22–40 minutes by generation 18, idle; 7–17 active). The dip is still the weakest part of the pacing: the family owns everything up to the Palace by then, so a life there is a quick re-run until the next machine. **1.4.0 (the user's "make them longer", §29):** a softcap on the seed curve past 100 seeds lengthens generations 11–13 from 2.5–7 to about 7–10 minutes (idle), and lives keep getting longer after that (the family owns everything; the simulator's lives hit its 2-hour cap from generation ~18), which is where the Great Migration comes in: the whole tree, its unlock, is planted at about the same time as before (5.0–5.8 h idle).

**A limit to keep in mind:** balance rules 2 and 3 together mean the base RTP must be at least **1 + auto-spin interval ÷ delivery time** (a delivery pays at least one spin, and must earn less per second than auto-spin at Wheel Training 1). So the slog comes from **time and prices** (slower spins, slower auto-spin, longer deliveries, higher prices), not from an RTP below that floor. RTP stays above 100% (Old Clunky starts at 150%).

## 11. Roadmap

Web-first (PORTING_NOTES D106): one web codebase ships to GitHub Pages, then itch.io, Steam (Electron or Tauri) and maybe mobile (Capacitor); platform steps are in PORTING_NOTES → The plan. The user's wishes behind each row (their own words and picks) are kept in git history and the PORTING_NOTES decision log (D-numbers); the rows below say only what was built.

| # | Milestone | What it is | Status |
|---|-----------|------------|--------|
| 1 | First playable economy | Old Clunky, spin cost, food deliveries, 4 upgrades, autosave, debug panel | done (§3–§8) |
| 2 | Retirement & Family Tree | Retire for Heirloom Seeds, the Family Tree, save v2 | done (§13) |
| 3 | Hamster Tokens & Capsule Machine | Tokens, the Diary, capsules with pity, skins, the Wardrobe | done (§14) |
| 4 | Polish & feel | Art cleanup, win tiers, sound, offline earnings, little touches | done (§15) |
| 5 | New look, QoL, second machine | The hamster-cage look, collect & switch machines, grids and paylines, the Snack Stacker, Buy ×10/Max, Settings | done (§12, §16, §17) |
| 6 | Pokies night | Bets and High Roller, Wild, free spins, jackpot wheel, gamble, Hot Streak, Burrow Bonanza, Pouch Palace | done (§16, §18–§20) |
| 7 | Real pokies | Slower spins, reels stop one by one, the win show, unlockable symbols, visible Luck, the card gamble; Pays Both Ways after feedback | done (§21, §3) |
| 8 | The Big Cage | A full page between lives, the only place to plant; held seeds, bigger tree, Machine Stars | done, 1.0.0 (§22) |
| 9 | More machines | Hamster Maze (243 ways), Acorn Vault (hold & spin), The Big Cheese (multiplier wheel), the seed jar | done, 1.1.0 (§24) |
| 10 | Wardrobe buffs | Every skin buffs while worn, 6 hats, a twist on every Epic | done, 1.1.0 (§25) |
| 11 | Hamster Casino | Roulette, blackjack, Derby, Seed Drop; Casino Chips; the Prize Counter | done, 1.3.0 (§27) |
| 12 | **Your own casino (late game)** | The Family Casino: cabinets of your machines on the floor, hamster guests play them below 100%, the house edge comes in as Takings (a till you empty); decor, staff, a high-limit room; opens after the first Great Migration, kept for good | done, 1.8.0 "Grand Opening" (§32) |
| 13 | Delivery depth | Only if playtests say deliveries are fun: routes (short/safe vs long/lucrative), helper hamsters | idea |
| 14 | Release prep | The 1.0 polish: celebrations, effects, icons, link card, version line | done, 1.0.0 (§23) |
| 15 | Visual redesign | A layout that fits the window, small upgrade tiles, the Big Cage as a meadow with a growing tree, a rebirth animation | done, 1.2.0 (§26) |
| — | 1.3.1 "Nuts & Bolts" | 20 upgrades (rebirth and sticker unlocks), 4 traits, the Hamster Helper, Lucky Pennies, save v12 | done (§28) |
| — | 1.4.0 "The Great Migration" | The mega rebirth: colonies, Golden Whiskers, perks, Colony Trials, Wise Elders, Moving Day, the seed softcap | done (§29) |
| — | 1.5.0 "The Glow Up" | Second visual redesign: painted room, cage, cabinets, a 32×32 hamster, pixel-art titles | done (§30) |
| — | 1.6.0 "New Digs" | UI redesign parts 1–3 (room look, purse, control deck, phone tab bar, Upgrades tab); **parts 4–9 planned, don't build until asked** | parts 1–3 done (§31) |
| — | 1.6.1 "Fresh Coat" | Every machine skin paints all 8 machines, plus 5 new machine skins | done (§14, §25) |
| — | 1.7.0 "Family Room" | UI redesign part 4 (the Family tab) | done (§31 part 4) |
| — | 1.7.1 "Settling In" | Balancing pass: each new colony's Family Tree costs ×3 more, Colony Pride +30% a level | done (§29) |
| — | 1.9.0 "Welcome Mat" | UI redesign part 8: the first-time guide (a pointing paw), UI sounds, and an unlock moment for everything new | done (§31 part 8) |
| → | Releases | GitHub Pages from the start; then itch.io, Steam, maybe mobile, all from the same web codebase (PORTING_NOTES → The plan) | ongoing |

**Particles and animations are a thread, not a milestone:** every milestone ships the effects for what it adds, and 1.0 went through the whole game (§20, §23). Every new animation needs its `.less-motion` rule (AGENTS.md → Code style).

### Things to keep in mind for release (itch.io, Steam, mobile)

- Slot-machine visuals can trigger "simulated gambling" age-rating flags on some stores, even with fake coins only. Check the target stores' rules before each store release (itch.io, Steam, and especially the Apple and Google app stores, which have their own rules for simulated gambling; PORTING_NOTES → Platform notes). **The double-or-nothing gamble (§19) and bet sizes (§18) make it look even more like real gambling**, so check them in particular. The planned card gamble (M7), casino table games like roulette and blackjack (M11) and running your own casino (M12) push further in that direction: decide before a store release whether it keeps them. (M11 makes that easy: `casino.enabled: false` in data.json leaves the whole casino out of a build.)
- The Capsule Machine (§14) is a gacha. Loot-box laws target boxes bought with real money, and ours never are, but store ratings may still flag it. Always show the odds in-game.

---

## 12. Look & feel (prototype): the hamster cage

**Direction: the inside of a hamster cage** (milestone 5, the user's pick from four directions: hamster cage, night arcade, cozy cottage, candy toy shop). It is *not* the classic clicker layout (big button on the left, long text shop on the right). The game is a little cage you look into: wire bars, wood-shaving bedding, a coloured plastic base, a water bottle and a food bowl, and clear plastic tubes. The UI around it is **cardboard and paper**: the tray is a taped-up cardboard box, tiles and dialogs are paper cards, and every border is a crisp pixel-art frame. **The final look is open:** the 2D pixel-art cage is the current look, and the 2.5D look planned for the Godot rebuild went with it (D106). Whether the release keeps this look is decided later. **M15 (§26) redesigned the layout** (the user's "entire visual redesign", still pixel art): the whole game fits the window, with the tray **beside the cage** on wide screens and **under it** on phones; the tables below describe the parts, and §26 how they fit together. **1.5.0 "The Glow Up" (§30) repainted it all**: the cage, the room behind it, the wheel and every machine's cabinet are pixel art painted in code to fit (no longer CSS shapes), the hamster and the reel symbols are 32×32, and the big moments, the tray and the HUD got far more detail and motion. Where a row below and §30 differ, §30 is the current look. **A full UI redesign is under way (§31; 1.6.0 brought its first three parts):** the UI round the scene as the hamster's room (painted wood, paper and brass), one kit of pieces, and a restructured layout.

| Area | What's there | Why |
|---|---|---|
| **HUD** (top) | Name · coin **price tag** (big number + auto income/s) · seed tag · a cardboard Menu button | One glanceable number. Everything else stays out of the way. |
| **Stage** (middle) | Three bands. The **back of the cage**: wire bars in front of the room's wall, with the hamster wheel joined to the slot machine by a **clear tube** (seeds roll along it), both standing in the bedding with a soft shadow; a water bottle hangs on the bars, and a food bowl and the capsule machine sit in the corners (wide screens). The **bedding**: a strip of wood shavings (a repeating pixel tile). The **front of the plastic base**: the Deliver and Spin buttons, and the **delivery tube** the hamster runs through. | Shows the core fantasy: the hamster *powers* the machine, in its own home. Every cage part has a hamster reason (pillar 1). |
| **Machine tags** | Paper tags hanging on the bars (top left), one per machine you own; tap one to switch. Hidden until you own two. On phones, and once you own more than four machines (M9), they shrink to the machine icons (one row). | Switching is one tap, right where you look. |
| **Machines** | Each machine type has its own look (`data-machine` on the machine element): Old Clunky is a chunky mint toy machine with a pull lever; the Snack Stacker is a tall strawberry-milk snack machine with a push button and numbered payline tags down both sides of its window; the **Burrow Bonanza** is a wide wooden machine dug into the burrow, with grass on its roof and a round-cornered window; the **Pouch Palace** is velvet and gold, with its four **jackpot pots** on plaques above the reels. | New machines should *feel* new. |
| **Bet box** (M6) | Next to Spin: − **BET ×3** + with a hint underneath ("up to ×10", "High Roller" before it's unlocked, or "spins ×2" in red when you're short and a spin will step down). Spin shows what the next spin really costs. Keys `-` and `=`. On phones it gets its own row. | The bet is the pokie "denom": always in reach, always showing what a spin costs. |
| **Feature widgets** (M6) | **Free spins**: the marquee counts them ("Free spins 3/8 · +1.2K"), the machine glows gold, and Spin turns gold ("Free · 5 left · ×3"). **Jackpot wheel**: the hamster wheel's face becomes a 4-colour prize wheel (Mini, Minor, Major, Grand) with a pointer, ticking as it turns and landing on the pot the game picked. **Card gamble** (M7): a gold-edged paper panel over the reels: a face-down card that flips over when you pick, the last 5 cards as little chips, "Gamble your win? 27 · colour → 54 · suit → 108", **Red ×2** · **Black ×2**, the four suits **×4**, **Take win**, and a countdown bar while it's only an offer. **Hot Streak**: a flame badge ("×1.25") on the machine's top-right corner with embers that grow with the streak. **Luck** (M7): a clover badge with the Luck number on the top-left corner; it pops and sparkles when Luck goes up. **WIN meter** (M7): a little dark screen under the reels that counts up to what the last spin paid. | Every feature is visible on the machine itself, where you're already looking. |
| **Reels** | 3 visible rows per reel. On Old Clunky only the middle row (the payline, with arrows) counts; the others are shaded. On the Snack Stacker every row counts, winning **cells glow in their line's colour**, and each winning line is **drawn across the reels**. Machines with more than 5 paylines have no tags down the sides; each drawn winning line gets a numbered badge instead. Wilds and scatters glow softly behind themselves; scatters that start a feature glow gold. **Anticipation** (M6): once the landed reels show all but one of the scatters a feature needs, the reels still spinning shimmer and land a beat later. The strips scroll down and land **one at a time**, left to right, each with a clunk and a puff of dust (or just drop in with *Quick reels*, §17). **The win show** (M7): after a win every winning cell glows while the WIN meter counts up, then the lines take turns one at a time, each drawn in its colour with a label ("Line 4 · Golden Seed ×2 (with a wild) · 770"); a tap on the reels skips to the total. The **Wood Shaving** (the blank) is a curl of tan shaving, the same wood as the bedding. | Reads instantly as a real slot machine, and you can see *which* line paid. |
| **Speech bubble** | Hints and reactions come from the hamster ("Out of coins! Send me on a delivery?", "Over to the Snack Stacker!"). A paper bubble with a pixel tail, kept beside the machine so it never covers the reels. | Replaces a line of UI text with personality. |
| **Tray** (beside the cage on wide screens, under it on phones; M15) | A cardboard box; only its open tab scrolls, and its sub-tab row stays at the top. Paper index tabs: **Upgrades** · **Family** · **Capsules** · **Info**. Family and Capsules stay hidden until they're useful (the first seed pending / 10 tokens earned), then appear with a dot. On phones the tabs shrink to fit. **Sub-tabs** (M6): tabs with several parts get a row of small paper labels under the tabs; a dot on a sub-tab means something there is ready (affordable, new). Each tab remembers its sub-tab (a setting). | Keeps the stage clean. The tabs and sub-tabs make room for new systems without long scrolling. |
| **Upgrades tab** | Sub-tabs **Hamster** (the hamster's upgrades) · **[the machine's name]** (this machine's upgrades) · **Machines**, with the ×1 / ×10 / Max toggle beside them (M15: tapping the one that's on moves to the next; a phone shows just that one). **Since M15 the tiles are small** (icon, name, level, a short "now → next", pips, the buy button: two a row) and **tapping a tile opens a detail card** at the bottom of the tab with the description, the whole line below and "ready in" (§26). **Machines**: a card per machine (icon, reels / paylines / spin cost / bet, feature chips like *Wild* · *Free spins* · *Jackpot pots*, description, *Running* / *Switch to it* (with "N free spins waiting") / *Buy*). **Upgrades**: paper tiles: pixel icon, name, "Hamster" or the machine's name · Lv, short description, "now → **next**" effect (for the whole bundle; Luck and unlocks show two numbers: "Luck 0 → 10 · hit rate 28% → 30%", "New: Baby Carrot · avg win 7.48 → 8.81 · hit rate 28% → 22%"), level pips, a buy button that **fills up as you save**, and "ready in ~2 min" under it. | You can see at a glance what's affordable, how close the rest is, and what the next big goal (a new machine) costs. |
| **Capsules tab** | Sub-tabs **Capsule Machine** (tokens, Pull, pity, odds, reveal) · **Wardrobe** · **Diary** (a dot for new stickers). See §14. | Everything about skins in one place. |
| **Family tab** | A **retire card** (pup name, generation, "Retire now: +N seeds", progress bar to the next seed, what resets vs what's kept, two-tap Retire button), then the traits the family has planted (M15; the tree itself only grows in the Big Cage, §26). | Retiring is a big choice, so it gets the tab; planting happens in the Big Cage. |
| **Info tab** (was Paytable) | Sub-tabs **Paytable** (Symbol · **Chance** after luck traits and Luck · payouts with every bonus **and your bet** applied; locked columns faded; wilds and scatters marked, and a scatter's row says what it starts; symbols you haven't unlocked are faded with "Unlock: New Seeds"; the Wood Shaving says it never pays) · **Paylines** (little grids, locked lines faded; hidden on one-line machines) · **Features** (a card per feature with its **real odds**: Luck, symbols unlocked, bet, Hamster Wild, free spins, jackpot pots with live values, the card gamble, Hot Streak, line hit rate) · **Recent wins** (§17). | Luck traits change the odds and paylines change how you win, so both are shown, and every feature explains itself honestly. |
| **Menu** | Controls, saving info, **Sound** (volume + On/Off), **Motion**, **Reels**, **Numbers** (§17), **Stats**, debug toggle, two-tap Reset | No footer clutter and no browser pop-ups. |
| **Stats** (Menu → Stats) | Time played, generation, spins, wins + hit rate, biggest win, biggest bet, most paylines won at once, best winning streak, wins with a wild, free spins, jackpot pots (and Grands), the most ways won at once, hold & spin (and Grands), the best cheese wedge (M9), gambles, golden jackpots, coins earned (and how much came while away), deliveries, upgrades, machines bought, seeds, traits, stickers, capsules, skins | Players like seeing their history, and it helps playtests. |
| **Welcome back** | A paper dialog after time away: how long, what the hamster earned, and a "Yay!" that sends coins flying into the counter | Makes coming back feel good (§15). |

**Style rules**
- Soft pastel palette with warm brown outlines (never pure black). All colours are **theme tokens** in `src/view/style.css :root`: the room (`--page`), the cage (`--wall-*`, `--wire*`, `--floor*` for the plastic base, `--tube*`), cardboard and paper (`--kraft*`, `--paper*`), buttons, machines (`--machine*`, `--stacker*`, `--bonanza*`, `--palace*`), payline colours (`--line-1` … `--line-10`; line 11 on reuses them).
- **Pixel frames (9-slice):** the UI borders are 12×12 sprites in `src/view/art.ts` (cardboard, paper, a paper tab, a button). `src/view/theme.ts` turns them into CSS variables, and CSS stretches them with `border-image` at 2× (8 px) or 3× (12 px). A button is ONE sprite repainted in each button's token colours (face and lip, plus a light and an outline mixed from them). Paper frames also come with coloured edges: green = you can afford it, gold = maxed / running, heirloom = planted, blue = selected.
- The pixel font (Pixelify Sans, weight 500) is for words. The clean rounded font (Nunito) is for **all numbers** and body text, because pixel digits like 5 and 8 read as "S".
- **Sprites** (the full style guide is at the top of `src/view/art.ts`): the hamster and the reel symbols are 32×32 since 1.5.0 (§30); other main sprites 24×24 (machines, cage props, the bedding tile), icons 16×16, currency icons 12×12, UI frames 12×12. They're drawn at **whole-number scales only** (mostly 2×), so pixels stay crisp squares. Each material has a small ramp (base, shade, light; the 32×32 sprites add a highlight and a deep shade) and its **own darker outline**. Light comes from the top-left. See them all at `tools/sprites.html`.
- **Painted scenes (1.5.0):** what must fit any size is painted pixel by pixel on a small canvas at 2×, with the same rules (ramps, top-left light, an outline per part, dithered blends, token colours): the cage and the room (`cage.ts`), the wheel (`wheel.ts`), every machine's cabinet (`cabinet.ts`), the Big Cage's tree (`bigtree.ts`) and the roulette wheel. The big titles use a pixel font of our own (`pixelfont.ts`).
- **Stage outlines** (the parts still drawn in CSS: the sign, the reel window's inside, the buttons) are 3 px (2 px for small parts) in a slightly softer ink (`--outline`, `--outline-thin`, `--outline-ink`). Small flat things (bars, chips, strips) get notched "pixel" corners (`--notch`) instead of round ones.
- Feedback: the win glow sits *behind* the symbols (never tint the symbol itself), plus a "+N" popup, and the coin tag pops when coins come in. Bigger wins add more (§15), and pixel particles add sparkle (§20).
- Works from phone width up. On narrow screens the machine rig **zooms out just enough to fit** (measured by `ui.ts`), so every reel and the lever always show. The speech bubble text is scaled back up so it stays readable.
- Numbers from a thousand up are **short by default** (47.27K, 1.5M; Menu → Numbers can switch to 47,275). From a quadrillion up they're written like **1.23e15** (coins, seeds and tokens alike), and there's no upper limit (big numbers, PORTING_NOTES D115).
- **Skins** recolour the cage through theme tokens set on the stage element: wheel skins (`--wheel-*`); machine skins recolour **Old Clunky** (`--machine*`, `--marquee`; their names say "Clunky"); room skins recolour the wall, the wire and the **plastic base** (`--wall-*`, `--wire*`, `--floor`, `--floor-dark`, `--floor-ink`). Fur skins are a palette swap for the hamster sprite. Everything outside the stage keeps the classic tokens.

---

## 13. Retirement & the Family Tree (milestone 2)

*"Pip is getting on a bit. Time to retire to the Big Cage and pass the family's Heirloom Seeds to a new pup."*

### Retiring

- The **Family tab** appears once the hamster could retire for its first seed. The hamster announces it in the speech bubble.
- **Retire to the Big Cage** (two taps within 3 s): the pending seeds are paid, the generation goes up by one, and a new pup with the next name takes over (`retirement.pupNames` in data.json, cycling: Pip, Nibbles, Biscuit …). Since M8 retiring opens the **Big Cage page** (§22), the only place to plant; the new life starts when you leave it.
- **Resets:** coins (back to 25), every upgrade (including the Third Reel), any spin or delivery in progress, the auto-spin timer, and this life's totals.
- **Keeps:** the generation, Heirloom Seeds, seeds ever earned, the Family Tree, Machine Stars (M8), and lifetime stats.

### Heirloom Seeds

```
total seeds  = floor( (lifetime coins earned ÷ 1,300) ^ (1/2) )      ← a square root again since milestone 7
retire gives = total seeds − seeds the family already received
```

- **Coins earned** = spin wins + delivery rewards. Spending never lowers it. Debug "+coins" doesn't count; debug "Earn" does.
- It's based on **lifetime** coins, so retiring every minute gives no more seeds than retiring once for the same coins (a test checks this). The only question is *when* retiring feels worth it.
- Square root: 4× the coins gives 2× the seeds. (Milestones 2–5 used a square root with 5,000; milestone 6 a cube root with 1,667, see PORTING_NOTES D80. With M7's slower income the cube root made each later life as slow as the first, so M7 went back to a square root, D102.)
- 3 seeds need 11,700 coins: about what an idle-ish first life earns in an hour (§10). The first seed comes at 1,300 coins (~10 minutes in), so the Family tab appears long before retiring is really worth it.

| Total seeds | 1 | 2 | 3 | 5 | 10 | 20 |
|---|---:|---:|---:|---:|---:|---:|
| Lifetime coins needed | 1,300 | 5,200 | 11,700 | 32,500 | 130,000 | 520,000 |

### Heirloom bonus

**Since M8: every seed you HOLD gives +1.5% payouts, up to the seed jar (M9): +100%, i.e. 67 seeds; each level of Family Fortune makes the jar +25% bigger.** Seeds past a full jar add nothing, so the Big Cage says "plant them" (the user's pick after the late lives shrank to a minute, D128). Planting a seed spends it, and its bonus with it, so plant-or-hold is a real choice (the user's "a reason to both rebirth and hold heirloom seeds", D94, D120). Until M7 it was every seed ever *earned* (+10% in M2–M5, +3% in M6, +1.5% in M7), planted or not. (Without a bonus, a bot showed lives stretching to 90 minutes by generation 4, see PORTING_NOTES D28. With milestone 6's bets and machines, +10% fed back so hard that lives collapsed instead, see D80.)

### How payout bonuses combine

```
payout multiplier = (1 + coin upgrade bonuses) × (1 + family bonuses)
  coin upgrade bonuses = Chubby Cheeks 0.25 × level
  family bonuses       = min(0.015 × seeds HELD, 1 + 0.25 × Family Fortune level) + Family Pride 0.25   (M8; the jar since M9)
  × (1 + the fur you wear: 0.05 / 0.1 / 0.2)                                                           (M10, its own group)
```

Bonuses **add up inside a group** and the two groups **multiply**. Example: Cheeks Lv 2 (1.5) with Family Pride and 3 seeds held (1 + 0.25 + 0.045 = 1.295) gives ×1.94. On a machine with **Machine Stars** (M8) the payout is also × (1 + 0.1 × stars). A spin win also gets ×1.5 on a full line with Jackpot Dance, then × the bet (§18), then × Hot Streak or the free-spin multiplier (§19).

### The Family Tree

Nodes are bought ("planted") with Heirloom Seeds and are **permanent**. They use the same cost formula as upgrades: `floor(baseCost × growthRate ^ owned)`. A node unlocks once every node it **needs** is owned.

| Branch | Trait | Cost | Needs | Effect |
|---|---|---:|---|---|
| Roots | ❤️ **Family Pride** | 1 | — | +25% payouts (family group) |
| Roots | 🌱 **Family Fortune** | 3 × 1.5ⁿ (3, 4, 6, 10, 15 …), no max | Family Pride | **M9:** the seed jar holds +25% more per level (+100% → +125% → …). The endless seed sink: once the jar is full, it's what extra seeds are for. (M8: +0.5% per held seed per level; before that +10% payouts per level.) |
| Luck | **Lucky Whiskers** | 2 | Family Pride | 5 weight moves from Sunflower Seed to Golden Seed: 50/25/12 → **45/25/17** (only once the Golden Seed is unlocked, §21) |
| Luck | **Carrot Patch** | 4 | Lucky Whiskers | 5 weight moves from Sunflower Seed to Baby Carrot: → **40/30/17** (only once the Baby Carrot is unlocked) |
| Luck | ⭐ **Jackpot Dance** | 8 | Carrot Patch | Full-line wins (every reel matches) pay ×1.5 |
| Speed | **Warm-up Laps** | 1 (2 before M7) | Family Pride | Every pup starts with Wheel Training Lv 1 (and you get it right away) |
| Speed | ⚡ **Quick Paws** | 4 | Warm-up Laps | Spin time and auto-spin interval × 0.8 (Old Clunky's 3 s → 2.4 s; the rest floor becomes 2.4 + 0.8 = 3.2 s) |
| Speed | **Heirloom Reel** | 8 | Quick Paws | Every pup starts with the Third Reel |
| Delivery | 🛴 **Speedy Scooter** | 1 | Family Pride | Delivery trip × 0.6 (45 s → 27 s) |
| Delivery | 🎒 **Big Backpack** | 2 | Speedy Scooter | Delivery rewards get your payout multiplier |
| Delivery | 📦 **Self-Starter** | 3 | Big Backpack | When you can't afford a spin (and nothing is spinning), the hamster starts a delivery by itself |
| Charms *(M8)* | 🍀 **Lucky Family** | 2 × 2ⁿ, max 4 | Family Pride | +5 Hamster Luck on every machine per level |
| Charms *(M8)* | 🧲 **Lucky Heirlooms** | 4 × 1.5ⁿ, max 5 | Lucky Family | Every machine starts with a level of its Machine Luck upgrade per level |
| Head Start *(M8)* | 🪙 **Big Spender** | 3 × 3ⁿ, max 2 | Family Pride | Every life starts with a High Roller level per level (bet ×2, then ×3) |
| Head Start *(M8)* | 🌱 **Seed Vault** | 4 × 2ⁿ, max 2 | Big Spender | Every machine starts with its first symbol unlocked, then both |
| Head Start *(M8)* | 🍓 **Snack Inheritance** | 10 | Seed Vault | Every pup starts owning the Snack Stacker |
| Bonuses *(M8)* | ⚽ **Ball Pit** | 5 × 2ⁿ, max 3 | Family Pride | +0.4 weight on the Hamster Ball (Burrow Bonanza) per level: free spins come sooner |
| Bonuses *(M8)* | 👝 **Golden Pouches** | 6 × 2ⁿ, max 3 | Ball Pit | Every jackpot pot starts (and restarts) at its seed × (1 + 0.5 per level) |
| Roots *(1.3.1)* | 🐾 **Helping Paws** | 4 | Family Fortune | The **Hamster Helper**: buys the cheapest upgrade that costs 10% of your coins or less, every second (switch in Upgrades; §28) |
| Roots *(1.3.1)* | 🌳 **Deep Roots** | 10 | Helping Paws | +2% payouts for every generation (family group) |
| Charms *(1.3.1)* | 🍀 **Four-Leaf Heirloom** | 4 × 2ⁿ, max 2 | Lucky Heirlooms | Every pup starts with Four-Leaf Clover Lv 1, then 2 |
| Bonuses *(1.3.1)* | 🫙 **Penny Jar** | 5 × 2ⁿ, max 3 | Golden Pouches | +2% a level that a paid win pays double (with Lucky Pennies, §28) |

The whole tree costs **94 seeds** (every trait at level 1, Family Fortune once; 71 before 1.3.1, 37 before M8). The Delivery branch is cheaper because it's mostly quality of life, not raw power. Since M8 the traits that "keep" something are free levels at the start of every life (like Warm-up Laps), not memories of the last life (D120).

Free levels (Warm-up Laps, Heirloom Reel) are real upgrade levels. The next Wheel Training level costs the Lv 1 price (960), and a free level never lowers one you bought. Since M7, Warm-up Laps is the trait that makes later lives zip: the first retirement (3 seeds) buys Family Pride, Warm-up Laps and Speedy Scooter, so generation 2 skips the ~10 minutes of clicking.

### Old Clunky with every luck trait

Both symbols unlocked, Lucky Whiskers, Carrot Patch and Jackpot Dance, no Luck upgrades:

| Reels | Weights (seed / carrot / golden / shaving) | EV per spin | RTP | Hit rate |
|---|---|---:|---:|---:|
| 2 | 40 / 30 / 17 / 45 + Jackpot Dance | 18.05 | 361% | 16.0% |
| 3 | 40 / 30 / 17 / 45 + Jackpot Dance | 26.18 | 524% | 16.0% |

These family traits **lower the hit rate** (fewer Sunflower pairs) but raise the payout per spin: fewer, bigger wins. Since milestone 7 that's the job of symbol unlocks too, and **Luck** (§21) is what raises the hit rate. (M8 plans Luck traits for the tree.)

## 14. Hamster Tokens & the Capsule Machine (milestone 3)

> **The user's direction:** skins come from *a separate gacha system*, paid with *"hamster tokens" earned separately*, "in whatever way you come up with". The proposal was shown to the user, who said "this is really good, continue", so it was built with the proposed defaults.

**Hamster Tokens** are a third currency. They only buy capsules (skins), and can never be bought with real money. Since M10 **a skin you wear gives a small buff** (§25; the user's pick, which reverses D39's "cosmetic only"). They're **kept when you retire** (only Reset wipes them).

### Earning tokens

| Source | Tokens | Notes |
|---|---:|---|
| **Hamster Diary stickers** (table below) | 1–5 each, 159 in total (51 stickers since 1.3.1) | One-time goals. They're checked after every spin (when it starts and when it lands), delivery, purchase, retirement and capsule, and on load, so an older save gets the stickers it already earned. |
| **Golden jackpot**: a Golden Seed on every reel of a payline, 3+ reels | 1 per golden line | Old Clunky (once the Golden Seed is unlocked, M7): 1 in 1,331 spins with no Luck, 1 in 760 with max Luck. A 2-reel golden pair doesn't count. On the Snack Stacker each payline counts on its own. Since M6, Hamster Wilds may fill in (golden, wild, golden counts); a line of wilds alone doesn't. |
| **Every 5th delivery** ("a customer tipped me") | 1 | Counts lifetime deliveries. A counter, not luck. Every 3rd with the Sunflower Field room on (M10). |
| **Retiring** | 3 | Plus the "The Big Cage" sticker the first time |

### The Hamster Diary

| Sticker | Goal | Tokens |
|---|---|---:|
| First Spin | 1 spin | 2 |
| Beginner's Luck | 1 winning spin | 2 |
| Look, No Paws! | Buy Wheel Training | 2 |
| Special Delivery | Finish 1 delivery | 1 |
| Fresh Seeds *(M7)* | Unlock a new symbol | 2 |
| Warming Up | 100 spins | 2 |
| Three's Company | Get the Third Reel | 2 |
| Snack Time *(M5)* | Buy a second machine | 2 |
| Line Dancer *(M5)* | Win on 3 paylines in a single spin | 3 |
| On Fire *(M6)* | Win 5 paid spins in a row on one machine | 2 |
| High Roller *(M6)* | Spin with a bet of ×10 or more | 2 |
| Double Trouble *(M6)* | Win the card gamble 3 times in a row | 3 |
| Card Shark *(M7)* | Guess the suit of a gamble card | 3 |
| Wild Thing *(M6)* | Win with a Hamster Wild | 2 |
| Free Ride *(M6)* | Roll 3 Hamster Balls for free spins | 3 |
| Pot Luck *(M6)* | Win a jackpot pot | 3 |
| Top Athlete | Max out Wheel Training (Lv 4 since M7) | 3 |
| Four-Leaf Hamster *(M7)* | Reach Luck 50 on a machine | 3 |
| Golden Moment | 1 golden jackpot | 3 |
| Wheel Enthusiast | 1,000 spins | 3 |
| Regular Courier | 25 deliveries | 3 |
| Millionaire | 1,000,000 coins earned (lifetime) | 3 |
| The Big Cage | Retire once (generation 2) | 3 |
| Growing Family | 5 Family Tree traits | 3 |
| Capsule Collector | Open 1 capsule | 1 |
| Marathon Runner | 10,000 spins | 5 |
| Big Family | Generation 5 | 5 |
| Full Bloom | Every Family Tree trait (22 since 1.3.1; 18 since M8; 11 before) | 5 |
| Fashion Hamster | 8 skins from capsules | 5 |
| Full Cage *(M6)* | Own four machines at once (every machine until M9) | 5 |
| Grand Hamster *(M6)* | Win the Grand jackpot | 5 |
| Nest Egg *(M8)* | Hold 25 Heirloom Seeds at once | 3 |
| Shooting Star *(M8)* | Rebuild a machine for a Machine Star | 3 |
| All-Star *(M8)* | Give one machine 5 Machine Stars | 5 |
| A-maze-ing *(M9)* | Win on 50 ways at once with one symbol (the Hamster Maze) | 3 |
| Nut Hoarder *(M9)* | Fill the Acorn Vault in hold & spin (the Grand) | 5 |
| The Big Cheese *(M9)* | Land a ×10 wedge on the cheese wheel | 4 |
| Whole Arcade *(M9)* | Own all seven machines at once | 5 |
| Hat Trick *(M10)* | Find 3 hats in capsules | 3 |
| Lucky Number, Blackjack!, Photo Finish, Edge of the Board, Prize Winner *(M11)* | The casino (§27) | 13 in all |
| Seeing Double *(1.3.1)* | Get a win paid double by Lucky Pennies | 2 |
| Night Owl *(1.3.1)* | Come back to coins earned while away | 2 |
| Busy Paws *(1.3.1)* | Buy 500 upgrade levels | 3 |
| Little Helper *(1.3.1)* | Let the Hamster Helper buy an upgrade | 2 |
| Sticker Book *(1.3.1)* | Earn 30 diary stickers | 5 |
| Dynasty *(1.3.1)* | Reach generation 10 | 5 |
| Billionaire *(1.3.1)* | Earn 1,000,000,000 coins in total | 5 |

Goal types (data.json `goal.type`): `stat` (a lifetime stat ≥ target), `upgradeLevel` (the best level on any machine), `generation`, `treeNodes`, `skinsOwned`, `machinesOwned` (M6: how many machines you own right now), `categoryOwned` (M10: skins found in one category, e.g. hats), `stickers` (1.3.1: diary stickers earned). **Since 1.3.1 a sticker can also unlock an upgrade** (a sticker upgrade, §28): the Diary says which under the sticker. A new sticker of an existing type needs only data.json. The two M5 stickers use the new stats `machinesBought` and `mostLinesWon`; the M6 stickers use `bestStreak`, `biggestBet`, `bestGambleRun`, `wildWins`, `freeSpinTriggers`, `jackpotsWon` and `grandJackpots`; the M7 stickers `symbolsUnlocked`, `suitWins` and `bestLuck` (the most Luck any machine has had, noted just before the diary is checked); the M8 stickers `mostSeedsHeld`, `rebuilds` and `bestStars`; the M9 stickers `bestWays`, `holdGrands` and `bestWheel` (the biggest wedge, Aged Cheese included).

The first five goals (First Spin, Beginner's Luck, Look No Paws!, Warming Up, Three's Company) pay exactly **10 tokens, the first pull** (a test checks this). So the **Capsules tab appears after ~3–6 minutes** of a first game in M6; with M7's slog it waits for Wheel Training and the Third Reel, so ~12–47 minutes into a first life (the simulator's range for an idle player).

### The Capsule Machine

- 1 pull = **10 tokens** → one capsule → one skin. The pull is decided instantly; the capsule wobbles for 0.9 s before it opens (view only).
- Rarity by weight: **Common 70 · Rare 25 · Epic 5**, then a skin of that rarity is picked evenly. Starter skins are never in capsules.
- **Pity:** after 19 pulls in a row without an Epic, the 20th pull is an Epic. So the real long-run Epic rate is **~7.8%**, not 5% (Common ~67.9%, Rare ~24.3%). The game shows both numbers. The formula is in `getCapsuleOdds()`, and a 20,000-pull test confirms it.
- **Duplicates** refund tokens: Common +2, Rare +4, Epic +8.
- Pulls use the game's seeded RNG (like spins), so the same seed gives the same capsules.

### Skins (34)

| Category | Starter | Common | Rare | Epic |
|---|---|---|---|---|
| **Fur** (hamster palette) | Classic | Cinnamon, Snowball, Cocoa | Lavender, Mint Chip | Golden Glow |
| **Hat** (M10, on the hamster's head) | No Hat | Party Hat, Beanie, Flower Crown | Top Hat, Cowboy Hat | Crown |
| **Wheel** | Classic Wheel | Mint Wheel, Berry Wheel | Oak Wheel | Gold Wheel |
| **Machine** (every machine's paint, 1.6.1) | Factory Paint | Peach Paint, Sky Paint, Bubblegum Paint, Moss Paint | Grape Paint, Copper Pipes, Seaside Paint | Midnight Paint, Arcade Neon |
| **Room** (wall + floor) | Cozy Cream | Strawberry Milk, Mint Garden | Starry Night | Sunflower Field |

29 skins are in the capsule pool: 14 common, 9 rare, 6 epic (18 before the hats, 24 before 1.6.1's machine skins). Collecting all of them takes **~194 pulls on average** (median 178; 1 in 10 players needs 301+; measured over 2,000 seeds; ~151 with 24 skins, ~110 before the hats), because the last Epics are the hard part. With refunds that's about 1,350 tokens for the median player (half of players 1,085–1,753). What each skin does when worn is in §25.

- data.json lists each skin's id, name, category and rarity. **What a skin looks like lives in `src/view/skins.ts`**, because data.json never holds colours. Fur skins recolour the hamster sprite's palette letters. Wheel, machine and room skins override theme tokens (`--wheel-*`, `--paint*`, `--marquee`, `--wall-*`, `--floor*`), set **on the stage element only**. **A machine skin paints every machine** (1.6.1 "Fresh Coat"; before, only Old Clunky): `--paint`, `--paint-dark` and `--paint-light` replace every cabinet's body colours (`painted()` in cabinet.ts), so the trims made from them follow, while each machine keeps its own shape and details (the Bonanza's grass, the Big Cheese's rind, the boxes' tape, the Palace's gold); `--paint-marquee` colours every sign. Copper Pipes and Arcade Neon also recolour the chrome trim and levers.
- The **Wardrobe** shows every skin (unfound ones greyed out, with their names, rarities and buffs), grouped by category, under a line that adds up **what you're wearing** (M10). Tap an owned skin to wear it: one per slot. The choice is saved.
- Hats (M10) are drawn on the hamster sprite itself, wherever the hamster appears (the wheel, the tube, the Family tab, the Big Cage, the logo), and use only colours fur skins never change, so every hat fits every fur.

### The Capsules tab

- Appears (with a dot and a hamster line) once the family has earned 10 tokens. Until then the hamster doesn't mention tokens at all.
- **Capsule card:** the machine sprite, your tokens, a **Pull** button, the pity countdown ("Epic guaranteed within N pulls"), the odds (with the pity rate) and the duplicate refunds, then the **reveal** (the capsule wobbles, then shows the skin, NEW! or "Duplicate · +N back", and a **Wear it** button).
- **Wardrobe**, then the **Hamster Diary** (each sticker with a progress bar and its reward).
- On wide screens, a little **capsule machine stands in the corner of the room**. It bobs when you can afford a pull, and clicking it opens the tab.

## 15. Feel & feedback (milestone 4)

### Win tiers

How big a win *feels* depends on the **base payout ÷ the machine's base spin cost**, not the final payout. Upgrades multiply every payout, so the final number would make every win a "big win" later on. Thresholds are in data.json (`winTiers`).

| Tier | Base payout ≥ | On Old Clunky | How often (3 reels, both symbols unlocked, no Luck) | What happens |
|---|---:|---|---:|---|
| win | any | Sunflower pair or line | ~14.4% | "+N" popup, reel glow (a soft blip for spins you pulled yourself) |
| **nice** | 10× | Carrot pair | ~2.9% | + chime, 5 coins fly to the counter, the hamster hops |
| **big** | 20× | Carrot line, Golden pair | ~1.4% | + the **BIG WIN!** celebration over the cage (1.0, §23), 10 coins, fanfare, hearts |
| **jackpot** | 100× | Golden line | ~0.075% | + the celebration climbing **BIG WIN! → HUGE WIN! → JACKPOT!** with coin rain, 24 coins, the room shakes |

- At most 40 coins fly at once, and only one banner or celebration shows at a time (so a lucky streak at 50× debug speed can't flood the page).
- Since milestone 6, big and jackpot banners **count the win up** under the words, and every win throws **pixel sparkles** from its lit cells in the line's colour (big: confetti; jackpot: confetti and a coin fountain). See §20.
- Players whose system asks for **reduced motion** get no flying coins, hops or shaking. Since milestone 5, **Menu → Motion** can also switch it on or off by hand (§17).

### Offline earnings

- While the game is closed (or the tab is hidden), the hamster keeps running the wheel at **50% of its auto-spin profit per second**, for **at most 2 hours**. Less than 1 minute away counts as nothing.
- It's worked out from the average (`getEconomy().expectedAutoProfitPerSecond`), not by simulating every spin, so it's instant and doesn't touch the RNG.
- **Needs Wheel Training** (no auto-spin, no offline coins). Offline coins count as earned, so they help toward Heirloom Seeds.
- The **Welcome back** dialog shows how long you were away and what was earned, and "Yay!" sends coins into the counter.

| Field (data.json `offline`) | Value |
|---|---|
| `minSeconds` | 60 |
| `maxSeconds` | 7,200 (2 h) |
| `efficiency` | 0.5 |

### Sound

- Every sound is **synthesized** in the browser (Web Audio): short bleeps, clunks and chimes, with no audio files.
- Sounds: lever pull and reel clunks (only for spins you pull yourself, since auto-spin clunking would get tiring), win chimes by tier, coin blips, buying, planting, errors, deliveries, capsule shake/pop/epic, diary stickers, retiring.
- Audio switches on with the first click or key press (browsers require that). **Menu → Sound** has a volume slider and an On/Off button. The choice is saved separately from game progress.
- **1.9.0:** an unlock's click-and-chime (`reveal`), and soft **UI sounds** for buttons, tabs, sheets and switches, much quieter than the game's own, with their own On/Off in the Menu (§31 → UI sounds).

### Little touches

- **Stats screen:** Menu → Stats (see §12).
- **Sleepy hamster:** with no auto-spin and no spin for 25 s, the bubble says "Zzz… (tap Spin to wake me up)".

## 16. Machines & paylines (milestone 5)

*"Old Clunky has a new neighbour: a tall pink snack machine with three rows of treats."*

### Collect & switch (the user's pick)

- You **buy** a new machine type with coins (a one-time price, `unlockCost` in data.json; the first machine is free). Buying it switches to it straight away.
- You **own** every machine you've bought and can **switch** between them any time: tap a machine tag on the cage bars, or *Switch to it* on its card in the Upgrades tab. Switching is free and instant.
- **The hamster runs one machine at a time** (the *active* one). Manual spins, auto-spin, the paytable, offline earnings and the shop all use the active machine.
- If you switch mid-spin, the old machine's spin still lands and pays (it was already paid for). The new machine starts on the next spin.
- **Each machine keeps its own machine upgrades** (Oiled Lever on Old Clunky, Smooth Gears on the Snack Stacker, …). The hamster's upgrades (Chubby Cheeks, Wheel Training) and the Family Tree work on every machine.
- Machines are bought with coins, so **they reset when the hamster retires** (like the Third Reel). The free first machine can never be lost, so rule 3 (§9) always holds.
- *Rejected:* every machine spinning at once with hired helper hamsters (much more to build and balance), and trading up (you'd lose the old machine). See PORTING_NOTES D61.

### Grids and paylines

A spin fills a **grid**: every reel shows `rows` symbols, each picked independently by weight. A machine lists its **paylines** in data.json: each line gives the row it crosses on every reel.

```
Snack Stacker paylines (row per reel; 0 = top, 1 = middle, 2 = bottom)
  line 1  [1,1,1,1]  middle
  line 2  [0,0,0,0]  top
  line 3  [2,2,2,2]  bottom
  line 4  [0,1,2,1]  diagonal down (a V with 4 reels)
  line 5  [2,1,0,1]  diagonal up   (a ^ with 4 reels)
```

- **Every active line is read on its own** with the same rule as Old Clunky (§3): count matches from reel 1; 2+ in a row pays `payouts[symbol][count]`. **The wins of all lines add up.**
- Jackpot Dance (×1.5) applies per line, to lines where every reel matched.
- A machine starts with `startLines` lines; **Extra Paylines** adds the rest, in the listed order.
- **The spin costs the same however many lines are active** (more lines = more ways to win for free).
- **Win tiers** (§15) use the base payouts of all winning lines together ÷ the machine's base spin cost.
- A one-row machine (Old Clunky) has no `rows`/`paylines` in data.json: it's a single line straight across, and nothing changed for it.

**The maths.** Every line crosses one cell per reel, and every cell is its own random pick, so each line has exactly the chances of a one-line machine. Averages always add up, so **EV = lines × one-line EV** (§3), even though lines share cells. The **hit rate** (the chance that *any* line pays) doesn't add up, because lines share cells; it's counted exactly from reels 1 and 2 alone (only they decide whether a line wins): try every way reel 1 can land, and for each, reel 2's cells are independent, so the chance that no line pairs is a simple product (PORTING_NOTES gotchas). A test checks it against every possible grid of a toy machine, and both against real spins for every setup.

### The Snack Stacker

| Field | Value |
|---|---|
| Price | **5,000** coins (7,500 in M5–M6) |
| Reels | 3, up to 4 (Fourth Reel) |
| Rows | 3 (all of them count) |
| Paylines | 3 (the rows), up to 5 (the diagonals, via Extra Paylines) |
| Spin cost | **25** (5× Old Clunky), spin time 3.2 s |
| Look | a tall strawberry-milk snack machine with a push button and numbered payline tags (§12) |

| Symbol | Weight | 2 in a row | 3 in a row | 4 in a row |
|---|---:|---:|---:|---:|
| Sunflower Seed | 40 | 40 | 70 | 125 |
| Baby Carrot | 25 | 75 | 155 | 335 |
| Blueberry | 17 | 140 | 390 | 1,100 |
| Strawberry 🔒 | 12 | 310 | 2,200 | 15,400 |
| Golden Seed 🔒 | 6 | 770 | 10,500 | 105,000 |
| 🐹 Hamster Wild | 0 (+2 a level) | 560 | 8,400 | 84,000 |
| Wood Shaving | 40 | never pays | | |

**Snack Restock** unlocks the Strawberry, then the Golden Seed (§21). The luck traits work here too once the Golden Seed is open (seed → golden, seed → carrot).

| Setup (no Luck) | Fresh (nothing unlocked) | Both symbols unlocked |
|---|---:|---:|
| 3 reels, 3 lines | EV 37.77 · **RTP 151%** · 42.6% hits | 44.92 · 180% · 35.8% |
| 3 reels, 5 lines | 62.95 · 252% · 55.8% | 74.86 · 299% · 48.7% |
| 4 reels, 5 lines | 69.05 · 276% · 55.8% | 83.54 · 334% · 48.7% |
| 4 reels, 5 lines, Hamster Wild Lv 3 | 109.79 · 439% · 63.7% | 196.07 · **784%** · 57.5% |

When bought, a fresh Stacker's EV is ~2.6× a finished Old Clunky's (14.24); fully upgraded it's ~14×. With a big payout multiplier the spin cost hardly matters, so that's roughly its income advantage too.

**Win tiers on the Stacker** (÷ 25): nice ≥ 250, big ≥ 500, jackpot ≥ 2,500. A Strawberry pair or a Blueberry line is *nice*; a Golden pair, a Strawberry line or a Blueberry four is *big*; a Golden line or a Strawberry four is a *jackpot*. Several small lines in one spin add up toward a tier.

### The Snack Stacker's upgrades (machine upgrades, this machine only)

| Upgrade | Cost | Max | Effect |
|---|---|---:|---|
| ⚙️ **Smooth Gears** | 4,000 × 1.3ⁿ | 8 | Spin cost × 0.9 per level (25 → 10.76) |
| **Extra Paylines** | 20,000 × 4ⁿ (20,000, 80,000) | 2 | +1 payline per level (3 → 5) |
| **Fourth Reel** | 200,000, once | 1 | +1 reel (3 → 4). Four in a row pays big. |
| 🐹 **Hamster Wild** *(M6)* | 60,000 × 3ⁿ (60K, 180K, 540K) | 3 | The wild's weight +2 per level (0 → 6) |
| 🌱 **Snack Restock** *(M7)* | 10,000 × 6ⁿ (10K, 60K) | 2 | Unlocks the Strawberry, then the Golden Seed |
| 🧲 **Lucky Sprinkles** *(M7)* | 8,000 × 2ⁿ | 5 | +10 Machine Luck per level |
| ⇄ **Pays Both Ways** *(after M7)* | 100,000 | 1 | Every line also pays from the right (§3). Full (4 reels, 5 lines, wild Lv 3, both unlocks): RTP 784% → 1,344%, hit rate 57.5% → 82.0% |

New effect type: `extraPayline` (`linesPerLevel`). The Fourth Reel reuses `extraReel`, and Smooth Gears reuses `spinCostMultiplier`; each is sold only on the Stacker (`"machines": ["stacker"]`).

### The Burrow Bonanza (milestone 6)

*"Five reels deep in the burrow."* A wide wooden machine with grass on its roof. **Hamster Wilds** on every reel, and 3+ **Hamster Balls** anywhere start **free spins** (§19).

| Field | Value |
|---|---|
| Price | **60,000** coins (600,000 in M6) |
| Reels × rows | 5 × 3 |
| Paylines | 5, up to 10 (More Tunnels) |
| Spin cost | 100, spin time 3.6 s; free spins pause 1 s between them |

| Symbol | Weight | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Sunflower Seed | 30 | 380 | 565 | 945 | 1,600 |
| Baby Carrot | 22 | 565 | 945 | 2,000 | 3,800 |
| Sweet Corn | 16 | 880 | 2,000 | 4,500 | 11,300 |
| Red Apple 🔒 | 12 | 1,600 | 8,300 | 44,100 | 252,000 |
| Golden Seed 🔒 | 6 | 3,800 | 37,800 | 283,500 | 1,890,000 |
| 🐹 Hamster Wild | 5 | 3,200 | 31,500 | 252,000 | 1,890,000 |
| Hamster Ball *(scatter)* | 3.2 | 3+ anywhere: 8 free spins · 4+: 12 · 5+: 20 (wins ×2) | | | |
| Wood Shaving | 70 | never pays | | | |

**Deeper Digging** unlocks the Red Apple, then the Golden Seed (§21).

| Setup (no Luck) | Lines EV | Free-spin EV | Total EV | RTP | Hit rate |
|---|---:|---:|---:|---:|---:|
| 5 lines, fresh (bought) | 374.90 | 25.16 | 400.06 | **400%** | 39.3% |
| 10 lines, fresh | 749.79 | 50.32 | 800.11 | 800% | 48.1% |
| 10 lines, both unlocked | 1,166.98 | 55.73 | 1,222.71 | 1,223% | 45.2% |
| … and Bouncy Ball maxed (+15 spins) | | | 1,331.09 | 1,331% | 45.2% |

Free spins start about 1 in 255 paid spins on a fresh machine (1 in 354 with both symbols unlocked: the new symbols take room from the balls; Luck makes them commoner again), 8.6 spins on average. When bought, its EV is ~2× a fully upgraded Snack Stacker (196); fully upgraded, ~6.8×.

| Upgrade | Cost | Max | Effect |
|---|---|---:|---|
| 🛢️ **Tunnel Grease** | 10,000 × 1.3ⁿ | 8 | Spin cost × 0.9 per level (reuses `spinCostMultiplier`) |
| **More Tunnels** | 25,000 × 2.5ⁿ | 5 | +1 payline per level (5 → 10) |
| ⚽ **Bouncy Ball** | 20,000 × 2.2ⁿ | 5 | +3 free spins every time they start (new effect `extraFreeSpins`) |
| 🌱 **Deeper Digging** *(M7)* | 30,000 × 6ⁿ | 2 | Unlocks the Red Apple, then the Golden Seed |
| 🧲 **Lucky Acorn** *(M7)* | 25,000 × 2ⁿ | 5 | +10 Machine Luck per level |
| ⇄ **Pays Both Ways** *(after M7)* | 5,000,000 | 1 | Every line also pays from the right (§3). 10 lines + both unlocks: RTP 1,223% → 2,370%, hit rate 45.2% → 70.0% |

### The Pouch Palace (milestone 6)

*"Twenty paylines of velvet and gold."* Hamster Wilds, and 3+ **Cheek Pouches** anywhere on a paid spin start the **jackpot wheel**, which pays one of four growing **pots** (§19).

| Field | Value |
|---|---|
| Price | **3,000,000** coins (100,000,000 in M6) |
| Reels × rows | 5 × 3 |
| Paylines | 10, up to 20 (Extra Pouches, 2 at a time) |
| Spin cost | 500, spin time 3.6 s; the jackpot wheel turns for 3 s |

| Symbol | Weight | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Sunflower Seed | 28 | 1,800 | 3,100 | 5,400 | 9,500 |
| Blueberry | 20 | 2,700 | 4,700 | 10,800 | 23,900 |
| Strawberry | 16 | 3,800 | 8,500 | 21,400 | 59,900 |
| Red Apple 🔒 | 12 | 9,500 | 59,900 | 359,100 | 1,795,500 |
| Golden Seed 🔒 | 7 | 23,900 | 299,300 | 2,154,600 | 11,970,000 |
| 🐹 Hamster Wild | 5 | 18,000 | 179,600 | 1,436,400 | 9,576,000 |
| Cheek Pouch *(scatter)* | 2.8 | 3+ anywhere (paid spins): the jackpot wheel | | | |
| Wood Shaving | 70 | never pays | | | |

**Royal Pantry** unlocks the Red Apple, then the Golden Seed (§21).

| Pot | Wheel weight | Seed (base units, × bet × payouts) | Growth per paid spin | Won about (fresh machine, no Luck) |
|---|---:|---:|---:|---|
| Mini | 62 | 30,000 | 6 | 1 in 550 spins |
| Minor | 27 | 75,000 | 12 | 1 in 1,260 spins |
| Major | 10 | 300,000 | 24 | 1 in 3,410 spins |
| Grand | 1 | 3,000,000 | 60 | 1 in 34,100 spins |

(M7 made the pots ×6 so they stay ~10% of the machine's value, PORTING_NOTES D103.)

| Setup (no Luck) | Lines EV | Pot EV | Total EV | RTP | Hit rate |
|---|---:|---:|---:|---:|---:|
| 10 lines, fresh (bought) | 3,530.07 | 391.81 | 3,921.88 | **784%** | 46.5% |
| 20 lines, fresh | 7,060.14 | 391.81 | 7,451.95 | 1,490% | 52.3% |
| 20 lines, both unlocked | 15,392.22 | 304.97 | 15,697.19 | 3,139% | 49.8% |
| … and Pouch Polish maxed (growth ×3) | | | 15,901.19 | 3,180% | 49.8% |

The wheel starts about 1 in 341 paid spins on a fresh machine (1 in 487 with both symbols unlocked; Luck makes it commoner). When bought, its EV is ~2.9× a fully upgraded Burrow Bonanza's (1,331); fully upgraded, ~12×.

| Upgrade | Cost | Max | Effect |
|---|---|---:|---|
| ⚙️ **Velvet Gears** | 400,000 × 1.3ⁿ | 8 | Spin cost × 0.9 per level |
| **Extra Pouches** | 800,000 × 2.5ⁿ | 5 | +2 paylines per level (10 → 20) |
| ✨ **Pouch Polish** | 1,200,000 × 3ⁿ | 4 | Every pot grows +50% faster per level (new effect `jackpotGrowth`) |
| 🌱 **Royal Pantry** *(M7)* | 1,200,000 × 6ⁿ | 2 | Unlocks the Red Apple, then the Golden Seed |
| 🧲 **Lucky Charm** *(M7)* | 800,000 × 2ⁿ | 5 | +10 Machine Luck per level |
| ⇄ **Pays Both Ways** *(after M7)* | 200,000,000 | 1 | Every line also pays from the right (§3). 20 lines + both unlocks: RTP 3,139% → 5,978%, hit rate 49.8% → 74.8% |

## 17. Quality of life (milestone 5)

The user picked two QoL sets: **Buy ×10 / Max** and **Settings & info**.

### Buying ×10 and Max

- A **×1 / ×10 / Max** toggle above the upgrade tiles (remembered as a setting).
- **×10** buys the next 10 levels (fewer if the max level is closer), and only if you can afford them all.
- **Max** buys as many levels as you can afford right now. When you can't afford even one, it shows the next level's price.
- The tile shows the bundle: "×10 · 1.01K" on the button, and "now → next" for the whole bundle (e.g. Payouts ×1.00 → ×3.50).
- Every level still costs exactly what the one cost formula says (rule 3); a bundle is the sum.
- **"ready in ~2 min"** under anything you're saving up for (upgrades and machines), from your auto-spin income. Nothing shows without auto-spin.

### Settings & info (Menu)

| Setting | Options | What it does |
|---|---|---|
| **Motion** | Auto · Less · Full | *Less* turns off particles, flying coins, hops, shakes, bobbing and flashing (banners just fade; 1.0's celebrations stand still and show the amount at once, §23). *Auto* follows the system's reduced-motion setting. |
| **Reels** | Scroll · Quick | *Quick* makes the reels drop a few symbols and land early instead of scrolling. **A spin still takes the same game time** (view only), so it's calmer, not faster: faster spins are a paid trait (Quick Paws). |
| **Numbers** | 47.2K · 47,275 | Short numbers (default) or full numbers below a million. From a million up it's always 1.5M, and from a quadrillion up 1.23e15. |

- **Save backup** (Menu, since 3.8): your save as a code to copy, or paste one to load it (§7).
- **The version** (1.0) at the bottom of the Menu, with a link to what's new (the CHANGELOG on GitHub) and "the coins are pretend: no real money, ever".
- **Coins in the browser tab's title** ("47.27K coins · Hamster Slots"), so you can peek from another tab.
- **Recent wins** (Info → Recent wins since M6): the last 10 wins on any machine (machine, symbol × count for every winning line, the bet, tier, coins, how long ago), plus free-spin totals, jackpot pots and gambles (M6). View only: it's not saved and starts empty each visit.
- **Payline diagrams** (Info → Paylines) (locked lines faded), and numbered payline tags on the Stacker's window that pulse when their line wins.
- **Sub-tabs** (M6, the user's "different tabs for upgrades and stuff"): Upgrades → Hamster · [machine] · Machines; Capsules → Capsule Machine · Wardrobe · Diary; Info → Paytable · Paylines · Features · Recent wins. Each tab remembers its sub-tab (a setting, `subTabs`), and a sub-tab shows a dot when something in it is ready.
- **A click is never lost** (M6): tapping Spin (or Space) while the machine is still spinning queues ONE spin that starts the moment this one lands, before auto-spin can take the machine. If the spin you pulled just won, the gamble offer takes that queued spin's place, so you get to see it (your next tap decides).
- **Pause auto-spin** (D142; the user's "no option to pause the hamster" on mobile, then "to make it easier to star machines"): once Wheel Training is bought, a small ⏸/▶ button next to Spin stops it from firing by itself, so coins pile up instead of being spent — handy while saving for a machine's last upgrade to rebuild it for a star. **Manual spins and every delivery (Self-Starter included) still work exactly the same**, paused or not: it only touches auto-spin. Pausing also stops coins piling up while you're away (offline earnings pay 0 for a paused hamster) — the shop's "ready in ~X" hints and the HUD's coin rate go quiet too, since nothing is really coming in by itself. It resets to running at the start of every new life (like the bet). Save v13; view only otherwise (game.getAutoInterval(), used for shop previews and the balance rules, is unaffected either way).
- **Keys** (M6, M7): `-` / `=` change the bet; in the card gamble `←` red, `→` black, `1`–`4` a suit, `C` takes the win.
- Stats (Menu → Stats) gained *Most paylines won at once* and *Machines bought*.
- Settings are saved separately from progress (like sound), so Reset keeps them.

### Not done yet

- Keyboard shortcuts for buying upgrades and switching tabs/machines (the user didn't pick them).

## 18. Bets ("denoms") (milestone 6)

*"Different denoms like actual pokies: choose how much you want to gamble."* (the user)

- Every machine has a **bet**: ×1, ×2, ×3, ×5 or ×10 (data.json `betSteps`). **A spin costs spin cost × bet, and every payout is × bet** (lines, free spins, jackpot pots). So the bet never changes the RTP: a bigger bet is just a bigger, riskier spin.
- **High Roller** (a hamster upgrade, §5) unlocks the next bet on every machine: 3,000 · 45,000 · 675,000 · 10,125,000 coins (M7; 2,000 × 10ⁿ in M6).
- You pick the bet with **− / +** next to Spin (keys `-` / `=`). Each machine remembers its own bet; a newly bought machine starts at the bet you were using (so buying one never feels like a step down).
- **Short of coins?** A spin **steps down** to the biggest unlocked bet you can afford (the bet box says "spins ×2"). A spin is refused only when even ×1 is too much. So auto-spin never stalls because of a high bet, and 0 coins is never a dead end (rule 3).
- **Unchanged by the bet:** win tiers (base payout ÷ base spin cost, D54), balance rules 2 and 3 (checked at ×1), Self-Starter ("can't afford ×1").
- The bet resets to ×1 on retiring (High Roller is a coin upgrade). Milestone 8 may add a "start with" trait.

**Why unlocked by an upgrade?** Every machine pays back more than it costs, so a free choice of bet would multiply income for nothing. The user picked "unlock steps with upgrades" from three options (D73). **Why only up to ×10?** With ×20 … ×100 the simulator showed later lives collapsing to about 2 minutes (bets multiply everything else), see D80. (1.3.1 kept it that way: its rebirth upgrades make other things stronger, D139.)

## 19. Bonus features (milestone 6)

*"Add features where you can win more."* The user picked all four pokie features. All of them are worked out **exactly** in machine.ts (no sampling), and the Info → Features tab shows their real odds.

### 🐹 The Hamster Wild

- A symbol with `"wild": true` (the hamster's face on a gold coin). On the Burrow Bonanza and the Pouch Palace from the start; on the Snack Stacker via the **Hamster Wild** upgrade (its weight starts at 0).
- It **stands in for any normal symbol on a payline** (never for a scatter). A line is read two ways and pays the better one, like a real pokie:
  - the **wild reading**: j wilds at the start pay the wild's own prize for j (j ≥ 2);
  - the **symbol reading**: the first real symbol, counting every wild before and after it: wild, carrot, wild, seed = **3 Baby Carrots**.
  - Example (Bonanza): wild, wild, wild, seed, seed → 3 wilds (3,000) beats 5 seeds (600).
- A scatter or a Wood Shaving (M7's blank) ends a run, and a wild never stands in for either. Jackpot Dance (×1.5) applies when the chosen reading covers every reel.
- **Exact EV:** a line starts with j wilds (chance wʲ), then its first real symbol s (pₛ), then keeps going while cells are s or wild ((pₛ + w) per cell); each case pays the better reading. A brute-force test tries every possible line on a small machine and matches it to 1e-9.
- The hit rate still depends only on reels 1 and 2 (a pair of line symbols, or a symbol and a wild, or two wilds; never a blank or a scatter), so it's still counted exactly, now with a faster method (§16).

### ⚽ Free spins (Hamster Ball scatter)

- 3 or more Hamster Balls **anywhere** on the grid start free spins: 3 → 8, 4 → 12, 5+ → 20 (data.json `freeSpins.awards`; Bouncy Ball adds +3 each).
- Free spins **play by themselves** one after another (no Wheel Training needed), with a short pause (1 s since M7, so the win show gets a beat). They **cost nothing**, use **the bet that won them**, and **every win is ×2**. More balls during free spins add more (a retrigger).
- While they play, Spin shows "Free · 5 left", auto-spin's timer stands still, Self-Starter waits, and a delivery pauses them. They only play on the active machine: switch away and they wait for you (the machine card says "N free spins waiting").
- **Exact maths:** scatters follow the binomial formula over reels × rows cells. With trigger chance q and average award N, one trigger gives N / (1 − q·N) spins counting retriggers. EV per paid spin = q × that × line EV × 2.
- Retiring loses unplayed free spins (the machines reset); the retire card says so.

### 👛 Jackpot pots and the jackpot wheel (Cheek Pouch scatter)

- The Pouch Palace has **four pots**: Mini, Minor, Major, Grand. They're kept in base units and shown as coins at your bet × your payout bonuses, on plaques above the reels.
- **Every paid spin adds a little to every pot.** 3+ Cheek Pouches anywhere on a **paid** spin start the **jackpot wheel**: the hamster wheel on the stage becomes a prize wheel and turns for 3 s. It lands on one pot (picked by weight when it starts, like a spin's result) and pays **pot × bet × payout bonuses**; that pot goes back to its seed.
- The machine is busy while the wheel turns (spins wait, auto-spin's timer stands still). A switch doesn't stop it: it still pays. Retiring waits until it has paid.
- **Exact maths:** a pot won with chance c per spin has grown for 1/c spins on average when it's won, so on average it pays c × seed + growth per spin: everything that flows in flows back out. A test checks "the pot holds seed + growth ÷ c when won" over 40,000 seconds of real play.

### 🃏 The card gamble (milestone 7; "pick a cheek" in M6)

- After a win **you pulled yourself** (not auto-spin, not free spins, and not a spin that started a feature), a gold panel offers a **face-down card**. Pick a **colour** (Red or Black): right half the time, and the win **doubles**. Or pick a **suit** (♥ ♦ ♣ ♠): right a quarter of the time, and the win is **×4**. Wrong: it's gone. **Take win** keeps it. Up to 5 wins in a row (then it takes the win by itself).
- The card turns over after a pick. The **last 5 cards** are shown as little chips along the top, like a real pokie; every card is a fresh draw (an endless deck), so they tell you nothing about the next one, and Info → Features says so.
- The offer lasts **5 s** (a countdown bar) and ends when you spin again, switch machine or retire; auto-spin waits while it's open. Once you pick, the gamble stays until you take the win or lose it.
- The win is already in your pile, so a pick needs the stake in your pile ("Not enough coins to cover this gamble" if you spent it).
- **It never pays on average** (both bets are exactly fair: the prize is the deck's odds, 4 cards ÷ the winning cards, not a data number) and **gamble coins never count as earned**, so it can't farm Heirloom Seeds (rule 4). It's just for the thrill. Not saved: leaving = keeping. Keys: ← red, → black, 1–4 the suits, C take the win.

### 🔥 Hot Streak

A hamster upgrade (§5): every machine counts its winning paid spins in a row, and the next win pays more. It favours machines that win often.

## 20. Particles & motion (milestone 6)

*"Cool particle effects and animations."* (the user)

- **src/view/fx.ts** draws pixel particles on one canvas over the page: little squares at whole-pixel positions in the theme's colours, so they match the pixel art. At most 400 at once; with Motion "Less" (or the system's reduced motion) none are drawn.
- Wins: sparkles from every lit cell in its line's colour (more for bigger tiers); big wins add confetti; jackpots add confetti and a gold coin fountain.
- Free spins: confetti and a burst of party colours when they start. The jackpot wheel: sparks off the rim as it ticks, then a big coin fountain and confetti when it lands (more for the Grand).
- The gamble: a gold burst from the card when you're right (bigger for a suit), a puff of dust when you're wrong (M7).
- Hot Streak: embers rising from the flame badge, more for longer streaks.
- Buying: sparkles over the upgrade tile; buying a machine: confetti.
- The cage: dust kicked up from the bedding by a fast wheel, and soft motes drifting in the air.
- Animations: **anticipation** (reels that could still complete a feature shimmer and land a beat later, within the same spin time), win banners that **count the win up**, a gold glow around the machine during free spins, pot plaques that flash when won.
- Sounds (synthesized, `src/view/sound.ts`): bet click, anticipation rise, free-spins fanfare, wheel ticks, pot fanfare, gamble win and "wah-wah", streak chimes.
- **Milestone 7:** a clunk and a puff of dust as **each reel lands** (quieter for auto-spins); **sparkles along each line** as the win show names it; the WIN meter's **rolling digits** with a soft tick; a **card flip** (sound + animation); a **clover sparkle** and a pop of the Luck badge when Luck goes up; a **"new symbol" fanfare** and confetti over the machine on an unlock. Motion "Less" turns the particles and the flip off, and the meter jumps straight to the total.
- **1.0 (§23):** particles can be **little sprites** too (spinning gold coins, stars, Heirloom Seeds, hearts), drawn from art.ts at whole-number scales; plus rings of sparks (shockwaves) and twinkling stars. The celebrations, the reel and win-show effects, the little touches and the big moments between lives are all in §23. New sounds: a title slam, the rising count-up, a star, a sprout, the whoosh of the iris.

---

## 21. Real pokies (milestone 7)

> **Status: built** (2026-09-25); released in 1.0.0 (2026-09-27), and the questions below are still open. **First feedback (2026-09-27):** a pair on the right-hand reels didn't count → **Pays Both Ways** upgrades (§3, D119). It came from the user's M6 feedback and their answers in a question round (PORTING_NOTES D88–D93); how it was built and tuned is in D95–D105. One change from the plan: each machine's symbol unlocks are one upgrade that opens its symbols in a fixed order (D96).

*"Slow down spin speed, I want early game to feel like a slog." "Make it more like slot machines… make them go one by one like actual slot machines."* (the user)

### Spin feel

- **Slower spins:** `spinDuration` 0.8 s → **3 s** on Old Clunky, **3.2 s** on the Snack Stacker, **3.6 s** on the 5-reel machines. Quick Paws still makes them faster (× 0.8).
- **Reels stop one at a time** (the first at 30% of the spin, the last at 90%): on Old Clunky at ~0.9 s and ~2.7 s, on a 5-reel machine a clunk every ~0.5 s. Each lands with a clunk and a puff of dust. The strips are longer, so they still blur past. Anticipation (§19) keeps working, now with time to build up.
- **Slower auto-spin:** Wheel Training goes 4.6 s → 3.8 s over 4 levels (§5), and the interval is **never shorter than the spin time + 0.8 s rest** (data: `rest`), so there's always a beat to see the win. A keen clicker (a spin every 3 s) is a little faster than auto-spin.
- *Quick reels* (§17) stays view only: it never changes game time (D69).

### The win show (view only, `src/view/winshow.ts`)

Like a real pokie, a win is shown in steps once the last reel lands:

1. **Every winning cell glows** (and every winning line is drawn), while the **WIN meter** under the reels (a little dark screen) counts up to the total with a soft tick: 0.5 s for a plain win, 0.9 s nice, 1.4 s big, 2.2 s jackpot.
2. Then the lines take turns **one at a time**, about 1 s each: only that line is drawn and lit, its payline tag pulses, sparkles run along it, and a label in its colour says what it paid ("Line 4 · Golden Seed ×2 (with a wild) · 770"; one-line machines drop the "Line 1"). Scatters that started a feature get their own turn ("8 free spins!", "The jackpot wheel!"), and that label already shows in step 1, because free spins start playing after 1 s, before the scatters' turn would come round. A single-line win just stays lit with its label.
3. It loops (everything lit for 0.7 s, then the lines again) until the next spin starts, which clears the show and the meter. **A tap on the reels skips** to the total.

The coins are paid when the spin ends, exactly as before: the show is only how you *see* it, so it never changes the economy (D92). It runs on real time, so it looks the same at any debug speed. Motion "Less": the meter jumps straight to the total and there are no sparkles.

### Symbols: a blank, and symbols you unlock (the user's "new seeds")

- **The blank** (the **Wood Shaving**, `"blank": true`, a curl of tan shaving) is on every machine: Old Clunky 45, the Snack Stacker 40, the 5-reel machines 70. It never pays, never makes a pair, a wild can't stand in for it, and on a line it ends the run like a scatter does. It's the "empty stop" of a real reel strip, and what Luck works against.
- **Unlockable symbols:** every machine starts with its two best line symbols **locked** (`"locked": true`) and **one upgrade per machine** opens them, **in order**: New Seeds (Old Clunky: the Baby Carrot, then the Golden Seed), Snack Restock (Stacker: Strawberry, Golden Seed), Deeper Digging (Bonanza: Red Apple, Golden Seed), Royal Pantry (Palace: Red Apple, Golden Seed). Each costs baseCost × 6ⁿ (the second step 6× the first). They're coin upgrades, so they reset on retiring (M8 plans a trait to keep unlocks).
- **Kept balanced (tested, §9 rule 6):** **every unlock raises the machine's EV and lowers its hit rate**, in every setup of every machine, at no Luck and at max Luck. Bigger prizes, fewer wins: never a trap, and a reason to buy Luck (the user: "with new symbols added change how likely you are to actually get wins therefore making players buy the luck upgrade"). Two things make it hold: the fixed order (opened the other way round, the Carrot would have diluted the Golden lines and lowered the EV), and paytables where the unlockable symbols pay steeply and the common symbols' long runs pay little more than their pairs (D98).
- The Family Tree's weight-shift traits (Lucky Whiskers, Carrot Patch) skip a symbol that is still locked, so they can't unlock one by accident. The paytable shows locked symbols faded with "Unlock: New Seeds".

| Old Clunky, 2 reels, no Luck | EV | RTP | Hit rate |
|---|---:|---:|---:|
| Fresh (Sunflower Seeds + Wood Shavings) | 7.48 | 150% | 27.7% |
| + Baby Carrot | 8.81 | 176% | 21.7% |
| + Golden Seed | 9.60 | 192% | 18.8% |

### Luck you can see

- Every machine has one **Luck** number: **Luck = Hamster Luck + Machine Luck**.
- **What it does:** every symbol except the blank has its weight × **(1 + Luck ÷ 100)**; the blank stays the same. So Luck 100 makes every real symbol twice as likely compared with a Wood Shaving. **Luck always raises both the hit rate and the EV** (tested level by level, §9 rule 7), and it stays exact because it only changes weights (the last step in `getSymbols`, after locks, family shifts and the wild).
- **Hamster Luck**: the **Four-Leaf Clover** (a hamster upgrade), +10 per level, 5 levels, every machine.
- **Machine Luck**: one upgrade per machine (Lucky Horseshoe, Lucky Sprinkles, Lucky Acorn, Lucky Charm), +10 per level, 5 levels, that machine only. So up to Luck 100.
- A **clover badge** on the machine's top-left corner shows the number (its tooltip splits it into Hamster + Machine Luck) and pops with a sparkle when Luck goes up. Shop tiles say what it does in plain numbers ("Luck 0 → 10 · hit rate 28% → 30%"), and Info → Features explains it with this machine's numbers. On a fresh Old Clunky, Luck 100 takes the hit rate from 27.7% to 47.6%.
- *Why not "move weight to the rare symbols"?* That is what the old luck traits do, and it **lowers** the hit rate (§13), which reads as the opposite of luck (D90).

### The card gamble (replaces "pick a cheek")

The user's pick, and how real pokies do it: after a win you pulled yourself, a gold panel shows a **face-down card**. **Red or Black** doubles the win (right 50%), **a suit** makes it **×4** (right 25%), **Take win** keeps it. The last 5 cards are shown along the top. Exactly fair in both modes (tested over 20,000 picks each), every card a fresh draw; only after manual wins that didn't start a feature, never counted as earned (rule 4), never saved, up to 5 wins in a row, a 5 s offer. The full rules are in §19. API: `gamble(pick)` takes `red` / `black` / a suit; `gambleResolved` carries the `card` and the `multiplier`. The debug panel's **Offer a gamble** opens one without a winning spin.

### The slog (balance)

- **Targets and results** are in §10: the first life takes ~45–75 min for an idle-ish player (Wheel Training at ~8–23 min), ~30–45 min for an active clicker; later lives get faster (35–43, 32–50 … 16–31 min by generation 7), with the new machines spread over lives 2 (Stacker), 4–5 (Bonanza) and 8+ (Palace).
- **How:** 100 starting coins (a 28% hit rate went broke too often from fewer), a delivery worth 4 spins (20 coins, 45 s), prices up across the board, machines re-spaced (5,000 / 60,000 / 3,000,000), a **square-root** seed curve with 3 seeds at 11,700 coins, a +1.5% heirloom bonus per seed, and Warm-up Laps for 1 seed so generation 2 starts with auto-spin. Every number is in PORTING_NOTES → Balance log with its reason.
- **Rules 2 and 3 set an RTP floor** (§10), so the slow start comes from time and prices, not from spins that lose money: Old Clunky starts at RTP 150%, and RTP stays above 100% for every setup, locked symbols included (rule 1).
- **Known issue for M8:** lives from generation ~9 get short again (3–10 min). M8 reworks the rebirth economy.

### Particles & sound

A dust puff and a clunk as each reel stops · sparkles along each line as it's shown · rolling WIN digits with a tick · a card flip (and a gold burst or a dust puff) · a clover sparkle when Luck goes up · a "new symbol" fanfare with confetti on an unlock. Sprites: the Wood Shaving, the clover, the horseshoe, a seed packet, a card back and four suits.

### Questions the prototype must answer

- Does a ~3 s spin feel like a real pokie, or like a chore? Is auto-spin (slower than a keen clicker) OK?
- Is the line-by-line show readable, especially on the 20-line Palace? Is the WIN meter noticed?
- Does buying Luck feel good? Is the Luck number clear?
- Does unlocking a symbol feel like a "new seed" moment, even though wins get rarer?
- Is a ~1 h first life a satisfying slog, or does it lose people? Are the first 10 minutes of clicking before Wheel Training fun?
- Is the card gamble more fun than "pick a cheek"? Does the suit bet get used?

---

## 22. The Big Cage (milestone 8)

> **Status: released in 1.0.0** (2026-09-27; built on a branch, and the user OK'd it with the 1.0 polish). Its playtest questions below are still open for friends playing the live game. It came from the user's M6 feedback (§11) and their picks on 2026-09-27: rebuild any time once a machine is maxed, all four groups of new traits, and M8 kept on a branch until they've tried it (PORTING_NOTES D120–D122).

*"Use the rebirth system more… a reason to both rebirth and hold heirloom seeds."* *"When you rebirth it takes you to a fully in-depth page of just the upgrades."* (the user)

### Held seeds

- **Every Heirloom Seed you hold gives +1.5% payouts** (`retirement.payoutBonusPerSeedHeld`), in the family group (§13), **up to the seed jar** (M9, `retirement.seedJar`: +100%, 67 seeds). Planting a seed spends it, and its bonus with it (unless the jar stays full). Most traits are still well worth a seed (Family Pride's +25% is ~17 held seeds' worth), so the choice bites on the expensive ones and on Family Fortune.
- **Family Fortune** makes the seed jar +25% bigger per level (M9; in M8 it made every held seed pay +0.5% more per level, and before that it was +10% payouts per level, which holding would beat).
- The retire card previews it: "Heirloom bonus +4.5% now → +9% with the new seeds held" (and says when the jar is full). A trait's preview counts the seeds planting would spend (Family Pride shows the payouts you'd really have), and the Big Cage says what planting costs: "Planting spends 1 of your 12 seeds held: heirloom bonus +18% → +16.5%", or "stays +100% (the seed jar is still full)". Since M9 the Big Cage shows the jar as a bar: "30 of 67 seeds · up to +100%", or "Full: … plant them".

### The Big Cage page

- **Retiring opens it** (a full-screen page): who retired and how many seeds they left, seeds held, the heirloom bonus, Machine Stars, and **the Family Tree**. Tap a trait for its details and **Plant** button. **Since M15 it's a meadow where the family's huge tree grows, with the traits on its branches, and retiring plays the planting animation** (§26).
- **It's the only place to plant.** The Family tab keeps the retire card (M15: and a list of the planted traits; the tree only shows in the Big Cage).
- **Time stands still** while it's open: no spins, auto-spins, deliveries or offline pay (a save made there loads there). **Start [pup]'s life** closes it and the new life begins. (Debug panel: **Open the Big Cage** to plant without retiring.)

### A bigger Family Tree (18 traits, 71 seeds)

Three new branches, one for each group the user picked (§13 has the full table):
- **Charms:** Lucky Family (+5 Hamster Luck per level) and Lucky Heirlooms (every machine starts with Machine Luck levels).
- **Head Start:** Big Spender (High Roller levels at the start of every life), Seed Vault (every machine starts with its symbols unlocked), Snack Inheritance (every pup owns the Snack Stacker).
- **Bonuses:** Ball Pit (more Hamster Balls, so free spins come sooner) and Golden Pouches (bigger jackpot pot seeds).
The traits that "keep" something are **free starting levels** (like Warm-up Laps and Heirloom Reel), not a memory of the last life: easier to understand and to balance (D120).

### Machine Stars ("Rebuild")

- **Max every upgrade on a machine** and a **Rebuild** card appears (in its upgrades, and on its machine card). Rebuilding (two taps) resets **that machine's upgrades** (not your coins; the family's free levels come straight back) and gives it a **star**.
- **Every star: +10% payouts and +2 Machine Luck on that machine** (`stars` in data.json), up to **5 stars** per machine, **kept forever**, through every retirement. A starred machine gets a gold trim and its stars on the marquee.
- Not while the machine is busy (spinning, free spins, the jackpot wheel, a gamble on it). The Info tab's Features page explains it with the machine's own numbers.
- Since coins reset on retiring, the smart time to rebuild is just before you retire: spend the leftover coins finishing a machine, then rebuild it.

### Balance (from the simulator; the full tables are in PORTING_NOTES → Playtest notes, 2026-09-27)

| Life | M7 (idle) | M8 (idle) | M8 (active) |
|---|---:|---:|---:|
| Gen 1 | 46–77 min | 46–77 min | 28–45 min |
| Gen 2–4 | 35–43 · 32–50 · 39–65 | 32–48 · 40–50 · 42–56 | 25–33 · 28–34 · 27–36 |
| Gen 5–7 | 33–46 · 31–40 · 16–31 | 38–61 · 32–39 · 23–31 | 25–35 · 20–26 · 12–20 |
| Gen 8 | 10–18 | 11–19 | 10–15 |
| Gen 9–12 | 2–18 | 1–13 | 1–12 |
| Whole tree planted | 4.0–4.9 h (37 seeds) | 5.2–6.1 h (71 seeds) | 3.5–3.9 h |

The simulated player plants a trait when it costs at most a quarter of the seeds held (or 1 seed) and holds the rest, and spends its last coins before retiring on finishing machines for stars (tools/sim.mjs `--plant`). It reaches 5 stars on Old Clunky around generation 6–7, and 15–20 stars in all by generation 12. Lives 1–8 stay close to M7; the late lives are still short (§10).

### Save v9

A v8 save gets no stars and is mid-life (not in the Big Cage); its tree, seeds and Family Fortune levels are kept, and its heirloom bonus now counts the seeds it holds.

### Questions the playtest must answer

- Does the Big Cage feel like a moment ("a new pup!"), or a chore between lives? Is the tree readable at this size (18 traits)?
- Is plant-or-hold a real choice? Do you hold seeds on purpose? Is Family Fortune worth it?
- Do Machine Stars feel worth rebuilding for? Is "rebuild just before retiring" fun or a chore?
- Which new traits feel good, and which are ignored?

---

## 23. The 1.0 release: polish & feel

> **Status: released as 1.0.0** (2026-09-27). It was built on the branch with M8 as 1.0.0-rc.1; the user OK'd it ("looks good"), and it was merged into `main` (live on the Pages link) and tagged `v1.0.0` (PORTING_NOTES D123).

*"I want a full release before trying to make the game longer. I also really want some cool animations and effects."* (the user, 2026-09-27)

So the roadmap's last step, **Release prep (toward 1.0.0)** (§11), moved up to right after M8: the content that's there (M1–M8) gets polished and released as the full 1.0, and M9 onwards (more machines, …) come after it as updates. **Nothing about the rules or the balance changed:** every effect is view only, and the golden run plays exactly as before, to the cent.

### Celebrations (`src/view/celebrate.ts`)

The big moments get a pokie-style show over the cage (the wall, not the buttons below it):
- The cage **dims**, **light rays** turn behind a big pixel **title that slams in**, its letters bob in a wave, and the win **counts up** under it with a rising tick. **Gold coins** (little spinning coin sprites) burst out of the title; on a jackpot they also **rain** down the cage and bounce on the bedding.
- The title **climbs** as the win counts up, like a real pokie's rollup: a big win says **BIG WIN!**; a jackpot-tier win goes **BIG WIN! → HUGE WIN! → JACKPOT!**, a new title slamming in at each third of the count.

| Moment | Title | How long (count + hold) |
|---|---|---|
| Big win (tier `big`) | BIG WIN! | 1.6 s + 1.1 s |
| Jackpot-tier win | BIG WIN! → HUGE WIN! → JACKPOT! (+ a white flash, coin rain) | 3.2 s + 1.8 s |
| A jackpot pot | MINI / MINOR / MAJOR JACKPOT!; the Grand: JACKPOT! → GRAND JACKPOT! | 2.2 s + 1.4 s (the Grand 3.6 + 2) |
| Free spins won / their total | 8 FREE SPINS! / FREE SPINS WIN (in blue) | 1.3 s / 1.8 s + 1.3 s |
| A Machine Star | STAR 3! with a big star, "+10% payouts and +2 Luck per star" | 2.6 s |

- **It never stands in your way:** taps go straight through it, so the card gamble's 5-second offer can be played underneath; any tap on the cage, or a spin you pull yourself, fades it out. Auto-spins carry on under it. (A blocking "tap to skip" screen would have eaten the gamble's time, D124.)
- Small wins keep their "+N" pop; nice wins keep the chime, coins to the counter and the hop.

### The reels and the win show

- Reels **blur** while they race and sharpen before they land; the machine gives a tiny **thump** as each reel lands.
- Winning symbols **dance** (a squash-and-stretch hop), a beat apart from reel to reel, so the line ripples; each winning line **draws itself** across the reels, left to right.
- The marquee's bulbs **chase** slowly at rest and race while it spins; a win **flashes** the marquee; a teasing reel (anticipation) makes the reel window **throb** like a heartbeat.

### Little touches everywhere

- Buy buttons you can afford get a **glint** sweeping across now and then. Buying an upgrade fires a **ring of sparks** and **"LV 3!"** (or **"MAX!"**) floats up from the button; more Luck floats up **"Luck 12!"**.
- The hamster **breathes** while it rests, **dozes** with little "z"s after 25 s without a spin (and no auto-spin), and **hearts** float up from it on big wins. With no auto-spin yet, the Spin button **glows** to say "tap me" (the first spin, or after 8 s idle).
- **Free spins turn the cage to night:** a purple glow around its edges and twinkling stars.
- Deliveries: a **puff of bedding** as the hamster scoots off, dust as it runs down the tube, and the pay **flies out of the tube** into your coins.
- The page **opens** with the HUD dropping in, the wheel rolling in and the machine landing with a bounce; tabs and sub-tabs **fade in**; dialogs **pop in**.

### The big moments between lives

- **Retiring:** a dark circle **closes on the hamster** like the end of an old cartoon; then the Big Cage page arrives in parts (the header, each number, the tree), **Heirloom Seeds rain** down it, and the seeds held **count up** from what the family had before. *(M15 replaced the part after the iris with the planting animation: the hamster plants the seed and the tree shoots up, §26.)*
- **Planting:** the trait **springs up** out of the ground with a burst of leaves, a ring of sparks and **"Planted!"** (or "LV 2!") from the Plant button, and the seeds it cost float off the seed count.
- **Starting the new life:** the circle **opens** from the new pup, who hops about with hearts and confetti.
- **A Machine Star:** the STAR celebration (above) with a burst of stars; when it fades, the new star **pops onto the marquee**.
- **Capsules:** a new prize gets **light rays** in its rarity's colour, a burst and a ring of sparks (the rarest also confetti).

### Motion "Less"

Everything above respects Menu → Motion (and the system's "reduce motion"): no particles, rays that don't turn, no slams, hops, glints, blurs, iris or page-opening; celebrations still say what you won (the amount straight away), and the Big Cage opens at once.

### Release basics

- **Icons:** the hamster as the browser-tab icon and the phone home-screen icon (`tools/icons.mjs` draws them from the hamster sprite), and a **web app manifest** so a phone can add the game to its home screen.
- **A link card:** a link to the game in a chat shows its name, a line about it and a picture of a BIG WIN (`public/social.png`).
- **The version** at the bottom of the Menu, with a link to what's new (the CHANGELOG) and "the coins are pretend: no real money, ever".
- **A crash screen:** if a bug ever stops the game, it stops saving (so the last good save is kept) and says so kindly, with a Reload button and the error for a bug report.
- **README.md** for the public repository: what the game is, the link to play, how to run it.
- Not done (not needed for a web 1.0, or needs the user): playing offline as an installed app (a service worker), a title screen, credits by name, the store-rule checks for itch.io and Steam (§11, before each store release).

### Questions the playtest must answer

- Do the celebrations feel exciting, or too much? Is a BIG WIN every few minutes on auto-spin fun or noisy? Should the rays or the coin rain be bigger or smaller?
- Is anything too busy on a phone? Does anything feel slow (the iris, the Big Cage arriving in parts)?
- Is 1.0 ready: anything else that must be fixed or explained before friends play it as "the full game"?

---

## 24. More machines (milestone 9)

> **Status: released in 1.1.0** (2026-09-27; built on a branch, and released with M10 so a friend of the user's could play it: their feedback is the playtest, PORTING_NOTES D125–D128, D130). The user's picks (2026-09-27): all three machines, in the late game; then the seed jar for the late lives (§13).

*"More slot machines."* (the user's M6 feedback)

Three machines past the Pouch Palace, each with a pokie mechanic the game didn't have. All three have exact maths (§9, rule 10), their own unlockable symbols, Machine Luck, a cheaper-spins upgrade, Machine Stars and a look of their own, and they're bought like the others (Upgrades → Machines).

| Machine | Price | Grid | Spin | Mechanic | Fresh: RTP · hits |
|---|---:|---|---:|---|---|
| 🌀 **Hamster Maze** | 500M | 3→5 reels × 3 rows, no paylines | 2,500 | **243 ways** | 1,828% · 20.5% |
| 🌰 **Acorn Vault** | 25B | 5×3, 10→20 lines | 50,000 | **hold & spin** | 1,246% · 39.2% (a hold & spin 1 in 139) |
| 🧀 **The Big Cheese** | 2.5T | 5×3, 10→20 lines | 300,000 | **the cheese wheel** | 1,322% · 46.4% |

Every spin takes 3.6 s. The high RTPs are the same idea as the Palace's 784%: each machine is a step up in income, like the ladder before it. Every rung works the same way: a fresh machine earns 0.5–0.95× what the finished machine before it earns (coins per second at ×1, every upgrade), and 10–30× that once its own upgrades are bought (PORTING_NOTES → Playtest notes, the seed jar).

### 🌀 The Hamster Maze: 243 ways

- **No paylines.** A symbol wins when it's on **reel 1 and every reel next to it**, on **any row**: 3 reels in a row pay the 3 prize, 4 the 4 prize, 5 the 5 prize. The prize is paid **once per way**: two Carrots on reel 2 make two ways, so a win's "ways" = the matching cells on reel 1 × on reel 2 × … It starts on 3 reels (27 ways) and **Longer Maze** adds reels: 81 ways, then **243 ways**.
- **Maze Runner** puts the hamster in the maze as a **wild on reels 2 to 5** (never reel 1, so every win starts with a real snack; the wild pays nothing by itself).
- The win show lights every cell of a win (there's no line to draw) and says "Baby Carrot ×4 · 6 ways".
- Symbols (weights): Sunflower Seed 30, Baby Carrot 24, Sweet Corn 18, Blueberry 14, Strawberry 9 🔒, Golden Seed 5 🔒, Wood Shaving 70. Pays (3/4/5 reels, per way): 90K/180K/360K · 135K/300K/660K · 210K/510K/1.35M · 330K/900K/2.7M · 3M/21M/150M · 12M/120M/1.8B (×1.5 after the first simulator runs: at the first pays the simulated players skipped the Maze, D128).
- **The maths:** the EV adds up, for each symbol and length, (its chance on a reel + the wild's) per row × 3 rows, reel by reel, times the chance the next reel has none; the hit rate follows which symbols are still "alive" from reel to reel. Both match brute force (every grid of a small test machine) and sampled spins.

| Upgrade | Price | Max | Effect |
|---|---:|---:|---|
| Maze Map | 60M × 1.3ⁿ | 8 | Spins 10% cheaper per level |
| Longer Maze | 800M × 5ⁿ | 2 | +1 reel (27 → 81 → 243 ways) |
| Maze Runner | 300M × 3ⁿ | 3 | The wild, +2 weight per level (reels 2–5) |
| Hidden Snacks | 200M × 6ⁿ | 2 | Unlocks the Strawberry, then the Golden Seed |
| Lucky Turns | 140M × 2ⁿ | 5 | +10 Machine Luck |

(Pays Both Ways doesn't exist on the Maze: ways already pay on any row, reel 1 onwards.)

### 🌰 The Acorn Vault: hold & spin

- **Six or more Golden Acorns** anywhere on a paid spin start **hold & spin**. The acorns **lock in place**, each showing a prize (175K ×40 · 350K ×25 · 875K ×18 · 1.75M ×10 · 4.375M ×5 · 17.5M ×2, weights; all × the bet). The other cells **respin 3 times**: each empty cell lands an acorn with a 10% chance, and **every new acorn locks too and sets the respins back to 3**. When the respins run out you win **every acorn on the board**. **Fill all 15 cells for the Grand** (+175M × the bet on top).
- The whole bonus is decided the moment it starts (like a spin, D92), then plays out on the reels: about 1 s a respin. Spins wait while it plays (auto-spin too). A hold & spin can be saved and loaded halfway.
- **Sticky Paws** (+1 respin per level, max 2) gives more respins to start with and after every new acorn. Luck brings more acorns (fewer blanks); unlocks bring fewer.
- On average (10 lines, nothing unlocked): 1 in 139 spins, 11.1 acorns, the Grand 1 in 2,749 spins; it's about a quarter of the machine's EV. With every unlock: 1 in 245; with max Luck: 1 in 42.
- Symbols: Sunflower Seed 28, Blueberry 20, Baby Carrot 16, Red Apple 12 🔒, Golden Seed 7 🔒, Hamster Wild 5, Golden Acorn 20 (scatter), Wood Shaving 70. Pays (2/3/4/5): Sunflower 315K/542.5K/945K/1.66M … Golden Seed 4.18M/52.4M/377M/2.09B, wild 3.15M/31.4M/251M/1.68B.
- **The maths:** the trigger is the chance of 6+ acorns among 15 cells; the bonus is worked out exactly for every (acorns, respins left) state: the average final acorns, the chance of filling it, and the average number of respins (for the time it takes).

| Upgrade | Price | Max | Effect |
|---|---:|---:|---|
| Oiled Hinges | 3B × 1.3ⁿ | 8 | Spins 10% cheaper per level |
| Wider Vault | 6B × 2.5ⁿ | 5 | +2 paylines (10 → 20) |
| Sticky Paws | 10B × 4ⁿ | 2 | +1 respin |
| Vault Pantry | 10B × 6ⁿ | 2 | Unlocks the Red Apple, then the Golden Seed |
| Lucky Combination | 6B × 2ⁿ | 5 | +10 Machine Luck |
| Pays Both Ways | 1T | 1 | Lines pay from the right too (§3) |

### 🧀 The Big Cheese: the cheese wheel

- **Every line that matches all five reels spins the cheese wheel**: ×2 (45), ×3 (30), ×5 (17) or ×10 (8), on that line's prize (×3.45 on average). The wheel on the stage spins and lands, and the celebration comes when it stops; the coins are already yours (the view only animates it, D92). A full line both ways still spins once.
- **Aged Cheese** (+1 on every wedge per level, max 3: ×2 becomes ×3, and so on) makes it stronger.
- The win's tier counts the wedge, so a ×10 Cheese Wedge line is a JACKPOT!.
- Symbols: Sunflower Seed 28, Blueberry 20, Strawberry 16, Red Apple 12, Golden Seed 7 🔒, Cheese Wedge 5 🔒, Hamster Wild 5, Wood Shaving 70. Pays (2/3/4/5): Sunflower 1.07M/1.84M/3.21M/5.64M … Cheese Wedge 35.6M/535M/4.16B/26.7B, wild 10.7M/107M/853M/5.69B.
- **The maths:** EV = the lines' EV + the full lines' EV × (the average wedge − 1); the wheel is ~16% of the machine's EV.

| Upgrade | Price | Max | Effect |
|---|---:|---:|---|
| Cheese Slicer | 300B × 1.3ⁿ | 8 | Spins 10% cheaper per level |
| Bigger Board | 600B × 2.5ⁿ | 5 | +2 paylines (10 → 20) |
| Aged Cheese | 1T × 4ⁿ | 3 | +1 on every wedge |
| Cheese Board | 1T × 6ⁿ | 2 | Unlocks the Golden Seed, then the Cheese Wedge |
| Lucky Rind | 600B × 2ⁿ | 5 | +10 Machine Luck |
| Pays Both Ways | 100T | 1 | Lines pay from the right too (§3) |

### Everything else

- **New sprites:** the Golden Acorn and the Cheese Wedge symbols, the three machines' marquee icons, and upgrade icons for respins and the wheel; each machine has its own colours (the maze's hedge green, the vault's steel, the cheese's yellow and rind).
- **The Info tab** explains each mechanic with the machine's real numbers (Features: ways, hold & spin with its odds and the Grand, the cheese wheel's wedges); the paytable says "per way" on the Maze; recent wins list ways, hold & spin and the wedge.
- **Four new stickers** (§14): A-maze-ing, Nut Hoarder, The Big Cheese and Whole Arcade (Full Cage is now "own four machines"; it always needed four).
- **Debug panel:** **Hold & spin** starts one on the Acorn Vault (6 acorns where the last spin landed).
- **Save v10** (§7): a hold & spin under way, and four new stats.

### Balance (from the simulator; PORTING_NOTES → Playtest notes, 2026-09-27 (M9) and (the seed jar))

The first M9 build didn't lengthen the late lives: the heirloom bonus grew with every seed held (+7,600% by generation 13), so by the time a family could afford the new machines a life lasted about a minute (D127). **The user picked the seed jar** (§13, D128), and the Maze's pays went up ×1.5 so it's worth buying. Now (18 lives, 3 seeds):

| Generation | Before the jar (idle) | With the jar (idle) | With the jar (active) |
|---|---:|---:|---:|
| 1–8 | as in M8 | as in M8 (gen 8: 14–18) | as in M8 (gen 8: 10–16) |
| 9–11 | 6–13 · 6–11 · 4–10 | 14–19 · 7–14 · 6–9 | 7–9 · 6–10 · 4–7 |
| 12–15 | 2–3 · 1.5–3.5 · 0.8–1.8 · 0.7–1.4 | 5–6 · 4–6 · 5–6 · 2–6 | 3 · 3–5 · 3–5 · 4–9 |
| 16–18 | ~1 each | 3–24 · 12–25 · 22–40 | 7–29 · 5–11 · 7–17 |

The Hamster Maze arrives around generation 12–13, the Big Cheese around 16–18; the idle player mostly skips the Acorn Vault with the jar (the Maze, then straight to the Big Cheese). The whole tree still takes 5.7–6.3 h (idle). The dip at generations 12–15 (2–9 minutes) is what's left of the old problem (§10).

### Questions the playtest must answer

- Are ways, hold & spin and the cheese wheel easy to follow the first time? Does the Info tab explain them well enough?
- Is hold & spin exciting (the respins counting back to 3), or too long? Should it be commoner and smaller, or rarer and bigger?
- Does the cheese wheel's wait (it lands after the reels) feel good, or should it be faster?
- Do the machines feel different enough from the Pouch Palace, not just bigger?
- Does the seed jar make sense (the bar on the Big Cage page, "plant them")? Does Family Fortune feel worth planting once the jar is full?
- The late lives: are generations 12–15 (2–9 minutes) too quick, and do the later lives feel better with the new machines?

---

## 25. Wardrobe buffs (milestone 10)

> **Status: released in 1.1.0** (2026-09-27, with M9; PORTING_NOTES D129, D130). The user's picks (2026-09-27): gentle buffs, six hats that add Luck, a twist on every Epic, one skin per slot.

*"Hats & skins which both give unique changes and improvements."* (the user's M6 feedback)

**Every skin you wear gives a buff.** The slot decides what it does, the rarity how much; starter skins do nothing. Wear one skin in each of the five slots (Capsules → Wardrobe; the top line adds up what you're wearing).

| Slot | Buff | Common | Rare | Epic |
|---|---|---:|---:|---:|
| **Fur** | payouts (its own multiplier group, §13) | +5% | +10% | +20% |
| **Hat** (new) | Hamster Luck, every machine | +3 | +6 | +12 |
| **Wheel** | spins (and auto-spin) faster | 5% | 10% | 15% |
| **Machine** | spins cheaper, every machine | 5% | 10% | 15% |
| **Room** | offline earnings | +5% | +10% | +20% |

**Every Epic has a twist** (shown with a ✦):

| Epic | Twist |
|---|---|
| Golden Glow (fur) | golden jackpots give 2 tokens instead of 1 |
| Crown (hat) | the card gamble shows 2 more past cards (7) |
| Gold Wheel | Hot Streak climbs one step higher (once you own Hot Streak) |
| Midnight Paint (machine) | +2 free spins every time they trigger |
| Arcade Neon (machine, 1.6.1) | +5% chance a win you paid for pays double (adds to Lucky Pennies) |
| Sunflower Field (room) | a Hamster Token every 3rd delivery instead of every 5th |

- **How it works:** a worn skin counts like an upgrade at level 1 (`effects` on each skin in data.json), so everything that reads an effect picks it up: the EV stays exact, Luck works like any Luck, a faster spin also speeds auto-spin (never below the spin + the rest), and the Info tab's odds include it. Fur is its own payout group, so its +5% is worth the same however many Chubby Cheeks you own.
- **Hats:** 6 in capsules (Party Hat, Beanie, Flower Crown · Top Hat, Cowboy Hat · Crown) plus "No Hat"; the capsule pool grows from 18 to 24 skins (§14). A new diary sticker, **Hat Trick** (find 3 hats, 3 tokens).
- **Saves don't change:** an older save simply wears no hat. Taking a skin off (wearing the slot's starter) takes its buff away.
- **The rules still hold with the best of everything worn** (a test wears all five Epics): deliveries stay below auto-spin at Wheel Training 1, every Luck level still raises the hit rate and the EV, free spins still always end (Midnight Clunky's +2 included).

### Balance (from the simulator; PORTING_NOTES → Playtest notes, 2026-09-27 (M10))

The simulated players now open a capsule whenever they have 10 tokens and wear their rarest skin in every slot. They find ~5 skins by generation 4, ~9 by generation 9 and 10–12 (of 24) by generation 18, so most buffs are Commons and Rares.

| Generation | Without the wardrobe (idle) | With it (idle) | Without (active) | With (active) |
|---|---:|---:|---:|---:|
| 1 | 49–62 | 50–61 | 28–32 | 31–33 |
| 2–6 | 32–61 | 32–57 | 22–36 | 18–35 |
| 7–11 | 6–31 | 3–23 | 4–19 | 4–14 |
| 12–15 | 2–6 | 3–8 | 3–9 | 1–5 |
| 16–18 | 3–40 | 2–14 | 4–29 | 3–11 |
| Whole tree | 5.7–6.3 h | 4.7–5.8 h | 3.5–4.0 h | 3.4–3.6 h |

So the gentle buffs make lives ~10–30% shorter from the middle game on, and the tree comes about an hour sooner (idle). Generations 16–18 swing with when the Big Cheese arrives (it came later with the wardrobe on in these runs).

### Questions the playtest must answer

- Do the buffs make capsules exciting, or do they feel like a must-have? Is "gentle" noticeable?
- Do the hats read well on the hamster at every size? Which ones do people wear?
- Are the Epic twists fun and understandable? Is the Wardrobe's summary line clear?

---

## 26. The visual redesign (milestone 15)

> **Status: released in 1.2.0** (2026-09-27, the user's request after 1.1.0; PORTING_NOTES D131–D134; the tree reworked after the user's first look, below). Built on the branch `claude/nice-hopper-r35bkf` and merged into `main` when the user said "publish 1.2"; its playtest questions below are still open. **View only:** no rules, balance or save changes (the golden run and the save fixtures are untouched).

*"i want an entire visual redesign · i want better ui for upgrades as having to scroll down is a pain · i want a rebirth animation · i want a separate screen where you spend heirloom seeds and you can only spend those seeds when you rebirth"* (the user, 2026-09-27)

**The user's first look** (2026-09-27): *"looks good tree looks a little clunky and goofy tho i only want new rebirth upgrades to appear after you buy the previous one also make the main trunk of the tree grown and reveal new upgrades as you buy the upgrades"* → the tree now **grows with the family** (below, D133).

**The user's picks** (their answers to the plan's questions): *"still pixel art just want a full cleaner way more user friendly ui for both big and small screens"* · the Big Cage and the rebirth animation: *"just want it more detailed"* · *"tree only apears when you rebirth"*, and *"a new rebirth animation of the hamster planting an heirloom seed and a huge tree shoots up and the rebirth skill tree is branching off the huge tree"* · upgrades: *"something similar to the rebirth, i just want it to fit a bit better"* · *"build this now"* (before M11).

### Before (1.1.0)

One long page: the HUD, the cage and the tray stacked, and the page scrolled. At 1280×800 it was 1,377 px tall and the tray started below the fold, so buying something scrolled the machine off the screen; at 390×844 it was 1,796 px, one ~190 px upgrade tile per row. The Big Cage (M8) was already the only place to plant, but it looked like one more paper dialog: a column of pale trait cards to scroll through, the tree's lines showing through the traits you couldn't plant yet.

### The layout: the whole game fits the window

- **No page scrolling in play.** `.app` is exactly the window's height (`100dvh`): the HUD on top, then the cage and the tray. **Wide screens** (960 px and up, or a phone on its side from 700 px) put the tray in a **panel beside the cage** (34% of the width, 340–500 px); **phones** stack the cage over the tray. Only the tray's open tab scrolls, inside itself; its sub-tab row stays at the top of it. (A really small window, under 540 px tall, may still scroll the page, so nothing is squashed to nothing.)
- **The cage fits itself:** `fitRig()` (ui.ts) zooms the machine rig to fit the cage's **width and height** (it used to fit only the width). On a phone the cage takes up to 44% of the screen's height and the tray gets the rest.
- **The tray lays out by its own width** (a CSS size container, `@container tray`), not the window's: a wide screen has a narrow tray. So a phone and the panel beside the cage both get the one-column machine cards, retire card and capsule card.
- **A narrow cage** (under 560 px, `@container stage`): Deliver, Spin and the bet share one row, and the delivery tube only shows while the hamster is out (the Deliver button says the trip's pay and time). The cage's props (the bottle, the bowl, the capsule machine) show when the cage is at least 900 px wide.
- **Cleaner:** no tape on the tray; a tighter HUD on phones.

### Upgrades: small tiles, like the tree's

- **A tile** is an icon, the name, the level (`Lv 3/5`), a short "now → next" (Luck and unlocks show just their headline: `Luck 30 → 40`, `New: Baby Carrot`), level pips and the buy button. Two tiles a row in the panel and on a phone (164 px and up each). **The 5 hamster upgrades fit beside the cage at 1280×800 with no scrolling, and so do a machine's 5–7.**
- **Tap a tile** (not its button) and a **detail card** sticks to the bottom of the tab: the description, the whole "now → next" line (hit rates and average wins too), "ready in ~2 min", and a buy button. Tap the tile again or × to close it. The buy button on the tile still buys in one tap.
- **×1 / ×10 / Max:** tapping the one that's on moves to the next, so a narrow tray (under 390 px, a phone) shows just that one button beside the sub-tabs.
- The machine cards are tighter (smaller text and buttons).

### The Family tab

The retire card, and a list of the traits the family has planted ("2 of 18 traits planted", a chip for each with its level). **The tree itself only grows in the Big Cage**, when you retire (the user's pick).

### The Big Cage: a meadow and the family's tree, which grows as you plant

- **A scene of its own** (the whole window): a meadow with a sky, clouds, a sun, two rows of hills, grass with tufts and little flowers, and soil with pebbles. In it stands **the family's tree**, with the Family Tree's traits in its leaves.
- **Only the traits you can plant show** (the user's pick): a trait appears once every trait it needs is planted, and stays once it's planted. A new family sees one: Family Pride.
- **The tree grows with the family** (the user's pick): it starts as **a sapling** holding Family Pride. Every trait you plant makes it grow: **the trunk grows up to the next level** when a trait there appears, **a branch grows out** to the traits you just unlocked, **the leaves fill in**, and **the new traits sprout onto it** as the branch reaches them. It also gets thicker and its crown bigger with every level. Plant everything and it's a big leafy tree.
- **Levels:** Family Pride sits at the foot of the trunk (every trait needs it) and the Roots' other trait (Family Fortune) on the trunk at the first level. Every other branch's first trait sits on **the first level**, its second on the second, its third at the top, in **the same column** (three columns on each side: Luck, Speed, Delivery on the left; Charms, Head Start, Bonuses on the right), so **a trait sits right above the one it needs**. A level's traits share a limb on each side, from the trunk out.
- **Pixel art, painted in code** (`src/view/bigtree.ts`): sprites must be 24/16/12 px squares (tests/art.test.js), so the tree is painted on a small canvas instead, each canvas pixel 2 or 3 screen pixels (like a sprite drawn at 2× or 3×). Every part has its own colour ramp (base, light from the top-left, shade) and its own outline, like the sprites: a trunk that tapers and sways a little, with bark grooves, a flared foot, roots and a shadow on the grass; limbs thick at the trunk and thin at the tip, with a knot where each trait sits; and **a canopy**: a bunch of leaves behind every trait (so the traits sit in the leaves like fruit), smaller bunches along the limbs, a leafy tip on each, and a crown, each bunch a few overlapping puffs, **in two layers** (a dark one behind the branches, the lit one in front, so the branches peek through). **The tree blossoms**: a flower for every trait level the family has planted. All its colours are theme tokens (`--sky-top` … `--blossom`).
- **Where everything goes** is worked out by `treeLayout()` for the scene's size; **a trait never moves as the tree grows** (the tree grows out to it). From 820 px wide the traits are bigger with their names under them; below that (phones) they're icons with their cost, and the name is in the card. **tests/bigtree.test.js checks**, from a 320 px phone to a 1560 px screen, that every trait is inside the scene, sits on its limb and right above the trait it needs, and never overlaps another; and, planting the whole tree trait by trait, that the tree only ever grows and always reaches every trait that shows.
- **A trait:** a paper box with its icon and its cost (or level). Green edge = you can plant it, heirloom edge with a gold glow = planted, blue = the one you tapped.
- **Beside the tree** (a phone: above and below it): the header, seeds held, the heirloom bonus, Machine Stars and the seed jar; **the card of the trait you tapped** (what it does, what planting spends, which traits it makes appear, **Plant**); and **Start [pup]'s life**. On a phone the card has a fixed height and the long explanation is left out; a short screen leaves out the subtitle too.
- **The hamster** stands by the tree, breathing, and **talks in a speech bubble** (after planting: the old TREE_LINES, and "The tree is growing!" when a trait unlocks others).
- **The rules don't change:** the Big Cage is still the only place to plant, only between lives, and time stands still while it's open (§22). Which traits show is the game's own rule (a trait can be planted once its needs are): the view only hides the rest.

### The rebirth animation (bigcage.ts)

Retiring still closes the iris on the hamster in the cage (1.0). Then the Big Cage opens on the empty meadow and:

| When (s) | What happens |
|---|---|
| 0–1 | The hamster runs in from the left. |
| 1 | It hops and holds up the family's **Heirloom Seed** (a burst of seed-coloured sparkles, "Our Heirloom Seed! Let's plant it."). |
| 1.25–1.85 | It **digs**: a squash-and-wiggle, puffs of dust, a mound of soil. |
| 1.65–1.95 | The seed drops into the hole (a gold burst, the plant sound). |
| from 1.95 | **The family's tree grows** to the size the family has grown it to: the trunk shoots up (the scene rumbles, "Whoa! Look at our family's tree grow!"), each limb grows out once the trunk reaches it, the leaves pop out where the wood has got to, and the traits sprout as the branches reach them; the hamster jumps back out of the way. A new family's is a sapling ("A little sapling! It grows with every trait we plant."). |
| when it's grown (by 7 s at most) | **Heirloom Seeds rain down**, the numbers, the card and Start slide in, and the seeds held count up. |

A tap anywhere on the scene (or **Tap to skip**) jumps to the grown tree. With Motion "Less" there's no animation: the tree is simply there, and it grows at once when you plant. Reopening the Big Cage without a fresh retirement (a reload, the debug panel's Open the Big Cage) shows the grown tree. **Starting the new life** closes the page and the iris opens on the new pup in the cage (1.0).

### What stays

- **View only, like 1.0:** no rules, balance or save changes. The golden run, the save fixtures and the simulator are untouched.
- **The art rules** (rules 9 and 11): sprites in art.ts, colours as theme tokens, whole-number scales, the pixel font for words and the clean font for numbers. Skins still recolour the cage (fur, hats, wheel, machine, room). Every new animation has its Motion "Less" rule.
- **Nothing is lost:** every feature on the machine, the win show, the gamble, the pots, the Info tab and every setting are where they were.

### Questions the playtest must answer

- Does everything fit on your screens (computer, phone, phone on its side)? Is anything too small to read or tap?
- Are the small tiles and the detail card easy to use? Do you miss the descriptions on the tiles?
- Does the rebirth animation feel like a moment, or too long after a few lives? Is it fun to watch the tree grow as you plant, and to fill it with blossoms?
- Is it clear which trait needs which (a trait right above the one it needs)? Is the sapling a nice start, or a letdown after the first retirement?

## 27. The Hamster Casino (milestone 11)

> **Status: released in 1.3.0** (2026-09-27; PORTING_NOTES D135–D137). Built on the branch `claude/nice-hopper-r35bkf` and merged into `main` when the user said "Publish 1.3", before a playtest; its playtest questions below are still open.

*"roulette, blackjack etc in a hamster casino"* (the user's M6 feedback), planned with the user after *"continue with the project plan"* (2026-09-27). **The user's picks:** the games → **all four** (Hamster Roulette, Blackjack, Seed Drop, the Hamster Derby) · where chips come from → **both** (earned by playing, and bought with coins) · the Prize Counter → **all of it** (timed boosts, Luck charms, Hamster Tokens, casino-only cosmetics) · the odds → **a small house edge**.

### Opening the casino

- **The Casino tab appears with the family's second hamster:** the first retirement opens the casino and gives the family **250 chips** to play with (the hamster says so). It's closed in the Big Cage (time stands still there).
- **On a phone** (the cage stacked over the tray) the cage steps aside while the Casino tab is open, so the tables get the whole screen under the HUD; any other tab brings it back. Beside the cage (a wide screen) nothing moves.

### Casino Chips

- **Earned** by playing: **a chip every 2 paid spins** (manual or auto, on any machine; free spins don't count), and **250 when a hamster retires**.
- **Bought** at the **cashier** (on the Prizes sub-tab): 100, 1,000 or 10,000 at a time. **A chip costs 0.5 s of the family's best earnings per second**: the best machine you own, at its biggest unlocked bet, with auto-spin (or a spin at a time before Wheel Training), without boosts. "The family's best" is the best of now and every earlier life (noted when a hamster retires and when chips are bought), so **chips never get cheaper** when a new pup starts over earning little. Never less than 1 coin. Switching to a cheap machine or lowering the bet doesn't lower the price.
- **Chips only buy prizes.** They never turn back into coins and never count as coins earned (so they can't farm Heirloom Seeds). The family keeps them when a hamster retires. They're as pretend as the coins.

### The tables

**A bet is a chip size:** 10, 20, 50, 100, 200, 500 or 1,000 chips (− and + beside the chips count), so every payout is a whole number of chips. **Every game is decided the moment you play it** (the logic: one module per game, rule 1); the wheel, the cards, the race and the seed only show it (like the jackpot wheel, D92), and the chips counter waits for them, so a win lands when the ball does.

| Game | How it plays | Pays (your bet included) | Gives back on average |
|---|---|---|---|
| **Hamster Roulette** | A real single-zero wheel: 0–36 in the real pocket order. Tap spots on the board to put chips on them (as many spots as you like, up to 1,000 on each), then **Spin**: the hamster rolls round in its ball and drops into a pocket. The chips stay on the board for the next spin (**Clear** takes them off). | red/black, odd/even, 1–18/19–36 **×2** · a dozen or a column **×3** · one number **×36** | **97.3%** (36/37: the green 0 is the house's edge) |
| **Blackjack** | Against the hamster dealer: get closer to 21 without going over. **Hit**, **Stand**, or **Double** (bet ×2, one more card) on your first two cards. The dealer peeks for a blackjack, draws to 17 and stands on every 17. Every card is a fresh draw (an endless deck, like the card gamble); no splitting, no insurance. **A tip says the best play** for every hand. | a blackjack **×2.5** (3 to 2) · a win **×2** · a tie **×1** | **98.9%** playing the tips (perfect play) |
| **The Hamster Derby** | Five hamsters race. Tap one to back it, then **Race!** | Nutmeg ×2.8 (wins 34%) · Biscuit ×3.7 (26%) · Pepper ×4.8 (20%) · Tofu ×7.3 (13%) · Wobbles ×13.6 (7%, the long shot) | **94.9–96.2%** |
| **Seed Drop** | A seed falls down 8 rows of pegs, bouncing left or right at every one, into one of 9 bins. Drop several at once. | ×12 · ×3 · ×1.2 · ×0.7 · ×0.4 · ×0.7 · ×1.2 · ×3 · ×12 (an edge bin: 1 seed in 256) | **95.9%** |

Every table's note says its pays and what it gives back. The returns are exact (worked out in the logic, `getCasinoOdds()`), and the tests check them against play: 37,000 roulette spins, 60,000 blackjack hands played by the tips, 20,000 races, 25,600 drops.

### The Prize Counter

| Prize | Chips | What it does |
|---|---|---|
| **Golden Hour** | 250 | every machine pays **+50%** for 90 s of play (a payout group of its own: it multiplies everything else); up to 10 min at once |
| **Turbo Wheel** | 200 | spins take **20% less time** for 2 min of play (auto-spin too, still never faster than the spin + the rest); up to 10 min |
| **Lucky Charm** | 200 | **+15 Luck** (Hamster Luck: every machine) for the next **100 paid spins**; up to 500 |
| **Token Bag** | 400 | a **Hamster Token** |
| **Dealer's Visor** | 2,500 | a hat (Rare): +6 Luck, like the other rare hats |
| **Tuxedo** | 3,500 | a fur (Rare): +10% payouts |
| **Casino Night** | 3,500 | a room (Rare): red velvet and gold, +10% offline earnings |

- **Boosts count down in play time:** not while the game is closed (time away pays as if no boost were on) and not in the Big Cage; they keep running into the next life. **A charm counts paid spins.** Buying one again adds more, up to its max (so no chips are wasted). The boosts running now show as little tags on the cage's top-right corner.
- **The three skins are only sold here** (never in a capsule); the Wardrobe marks them "Casino prize" until you have them, and they don't count for the diary's "from capsules" stickers.
- **5 new diary stickers** (13 tokens): Lucky Number (win on one number), Blackjack!, Photo Finish (win on Wobbles), Edge of the Board (an edge bin), Prize Winner (buy a prize).

### The Loyalty Card (added after 1.9.1; PORTING_NOTES D166)

Before this, playing at the tables led nowhere: chips went round and round. Now **every chip you bet at any table counts on a Loyalty Card**, win or lose (a doubled blackjack bet counts twice). It's on top of the Prizes sub-tab: a gold paper card with your tier and a row of **10 paw stamps**, each an equal share of the chips between your tier and the next. Kept for good, like the chips (only Reset wipes it).

| Tier | Chips bet in all | Gift (once) | Opens |
|---|---:|---|---|
| New Member | 0 | | bets up to 1,000 (the table's own) |
| **Bronze Paw** | 10,000 | 1 Hamster Token | bets of **2,000** |
| **Silver Paw** | 50,000 | 2 tokens | **the VIP lounge**: brass rails round every table |
| **Gold Paw** | 200,000 | 3 tokens | bets of **5,000** |
| **Platinum Paw** | 1,000,000 | 5 tokens | bets of **10,000** |

- **The odds never change.** A bet gives back the same share of every chip at any size, so a bigger bet only wins or loses more at once; the tables still give back 94–99.5% (rule 4). The bigger bets are whole multiples of 10 chips, so every payout is still whole chips, and a roulette spot holds up to the biggest bet you've opened.
- **The gifts are tokens, given once:** 11 in all, at tiers that need ever more chips bet, so the card can't be farmed (a gift per chip bet would push a table's return past 100%). They're tokens, not chips, so they never feed the tables back.
- **Roughly how long:** a chip at a 97% table is bet about 33 times on average before it's gone (about 90 times at blackjack played by the tips), so the 250 chips of the first retirement already go most of the way to Bronze Paw. Silver comes in the first few hours of casino play, Gold over a few colonies, and Platinum is a long goal for a family that buys chips or Chip Crates (§32). The simulator never plays a table, so these are estimates; the playtest checks them.
- **When a tier is reached** the hamster says what it opened, with a gold burst; the stamps fill as you play.
- Data: `casino.loyalty` (the tiers, their chips bet, tokens, bet steps and the lounge). **Save v16** keeps the chips bet (`casino.wagered`) and the tiers reached (`casino.tier`); an older family's card starts blank, because the chips it bet before were never counted.

### The rules still hold (tested, `tests/logic/casino.test.js`)

- **Every casino bet keeps a small house edge** (94–99.5% back), and chips never pay coins, so the tables can't be farmed. The machines' RTP only goes up with a boost.
- **Rule 4 with every boost on:** delivery coins/s stays below auto-spin profit/s at Wheel Training 1; the Lucky Charm is Luck, so it raises both the hit rate and the EV; the auto-spin interval never beats the spin time + the rest with Turbo Wheel; **free spins always end** with the charm on top of the whole tree, max Luck, every Bouncy Ball and the best wardrobe.

### Balance

The casino changes nothing unless chips go into boosts. `node tools/sim.mjs --casino` has the bot spend **every chip it earns** on the boosts and the charm (it never buys chips and never plays a table): **the most the casino can speed a family up**. Over 12 lives, 5 seeds (the full tables are in PORTING_NOTES → Playtest notes, M11):

| | idle | idle, `--casino` | active | active, `--casino` |
|---|---|---|---|---|
| **12 lives in all** | 5.0–5.9 h | 4.4–5.6 h | 3.4–3.6 h | 3.1–3.5 h |
| Gen 1 (no casino yet) | 46–76 min | the same | 29–40 min | the same |
| Gen 2 | 32–47 min | 33–46 min | 23–30 min | 24–29 min |
| Gen 6 | 25–48 min | 20–33 min | 16–27 min | 17–22 min |
| Gen 10 | 5.4–11.3 min | 2.6–11.2 min | 3.5–8.6 min | 2.8–7.4 min |
| Gen 12 | 3.7–9.6 min | 2.8–5.9 min | 2.7–4.7 min | 1.6–3.2 min |

So **at most 5–12% less time in all**, but **up to a third off the short late lives** (the 250 chips for retiring buy a Golden Hour at the start of each one), which were already the open problem (§10). A real player's lives shrink less: chips played at the tables lose a little on average, and chips spent on tokens or skins speed nothing up. If the playtest finds the late lives too short, the levers are all data: Golden Hour's +50%, the chips for retiring, a chip every 2 spins.

### Save v11

The family's casino: its chips, the best earnings noted (a chip's price), the spins towards the next chip, the boosts and charms running, and a blackjack hand still being played (a finished one isn't saved: it's paid). Nine new stats (games played, chips bought and earned, the biggest casino win, numbers hit, blackjacks, long-shot wins, edge bins, prizes bought). An older save starts with no chips; its family can play at once if it has retired before.

### Questions the playtest must answer

- Which table do you play most? Is any of them dull, or hard to follow?
- Chips: too slow to earn, or too many? Is buying them worth it?
- Are the prizes worth their chips? Is Golden Hour too strong, or not worth it?
- On a phone: is it fine that the cage steps aside while you're at the casino?
- A small house edge: does losing a little on average feel fair, or does it put you off playing?


---

## 28. Nuts & Bolts: more upgrades (update 1.3.1)

> **Status: released in 1.3.1** (2026-09-27; PORTING_NOTES D138–D141). Built on the branch `claude/nifty-carson-bcaz1t` and merged into `main` when the user picked "Publish 1.3.1 now", before a playtest; its playtest questions below are still open. Not a roadmap milestone: an update the user asked for between M11 and M12.

*"i want a ton of new upgrades and improvements some gated behind rebirths and some not maybe some from achievements just want a big 1.3.1 update of upgrades"* (the user, 2026-09-27). **Every update now has a name** (the user's wish, same message; AGENTS.md → Git and releases): this one is **"Nuts & Bolts"**, because it's about the upgrades, the nuts and bolts of the game.

What's new: **20 upgrades** (3 on sale from the start, 6 **rebirth upgrades** that a new generation unlocks, 11 **sticker upgrades** that a Hamster Diary sticker unlocks), **4 Family Tree traits** (one is the **Hamster Helper**, which buys cheap upgrades for you), **7 diary stickers**, and some improvements to how the shop shows all of it. One new mechanic: **Lucky Pennies**, a chance for a win to pay double. Save v12.

### How upgrades unlock (the new system)

An upgrade in data.json can have `"unlock"`:

- `{ "generation": 4 }`: a **rebirth upgrade**. It's on sale from the family's 4th hamster on (after 3 retirements), in every life after that. The lock can't close again: the generation only goes up.
- `{ "sticker": "onFire" }`: a **sticker upgrade**. It's on sale once the family has earned that diary sticker (the Diary says "Unlocks the upgrade …" under the sticker). Stickers stay earned, so it stays open.
- No `unlock`: on sale from the start, as before.

Until then the upgrade is **locked**: it can't be bought (game.ts `getUpgradeLock` says what's missing; `canBuyUpgrade` and the bulk price say no). The shop folds the locked ones away under each list (**"🔒 N upgrades still locked"**, tap to open), rebirth upgrades first, each saying what opens it ("Generation 4", "Sticker: On Fire"); the detail card says it in full ("retire 2 more times"). In the first life, before the family knows about retiring, only the next rebirth upgrade shows (so a first life isn't a wall of padlocks). When one opens, the hamster says so: at once for a sticker, and for a new generation in the Big Cage ("And this life I can buy Running Shoes!") and again when the pup says hello. `upgradeUnlocked` is the event. A machine upgrade that's still locked doesn't count for **Machine Stars** (a machine with everything else maxed can be rebuilt); once it opens, it has to be maxed too.

### Upgrades for everyone (the Hamster sub-tab)

| Upgrade | Cost | Max | What it does |
|---|---|---:|---|
| 🪙 **Lucky Pennies** | 2,500 × 2.5ⁿ | 5 | **+2% a level: a win you pay for pays double** (every line of it). Free spins never double. **New effect** `doubleWin`. |
| 🌙 **Night Shift** | 1,000 × 3ⁿ | 5 | +10% offline earnings a level (×1.5 maxed). Needs Wheel Training. |
| 🛏️ **Cosy Nest** | 2,000 × 4ⁿ | 4 | Time away pays for **1 hour longer** a level (2 h → 6 h). Needs Wheel Training. **New effect** `offlineTime`. |

### Rebirth upgrades (a new generation unlocks one)

| Generation | Upgrade | Cost | Max | What it does |
|---:|---|---|---:|---|
| 2 | 👟 **Running Shoes** | 4,000 × 4ⁿ | 3 | Spins and auto-spins ×0.95 a level, on every machine (auto-spin still never beats the spin + the rest) |
| 3 | 🎟️ **Coupon Book** | 8,000 × 3ⁿ | 5 | Spins on every machine cost ×0.95 a level |
| 4 | 📒 **Sticker Album** | 25,000 × 5ⁿ | 3 | **+1% payouts for every diary sticker earned**, a level (the coin upgrades' group). **New effect** `stickerPayout` |
| 5 | ⭐ **Star Polish** | 100,000 × 8ⁿ | 2 | Every Machine Star pays **+5% more** a level (+10% → +20% a star). **New effect** `starPayout` |
| 6 | 🐹 **Mega Cheeks** | 1M × 1.5ⁿ | none | **+100% payouts** a level (the coin upgrades' group): the late game's coin sink, like Chubby Cheeks but bigger |
| 8 | 🌶️ **Hot Sauce** | 5M × 3ⁿ | 5 | Hot Streak pays **+2% more for every win in a row**, a level (5% → 7%). Needs Hot Streak |

**Not bigger bets.** Bets above ×10 were tried in M6 and made the later lives collapse to about 2 minutes (§18, D80), so no rebirth upgrade raises the bet (D139).

### Sticker upgrades (a diary sticker unlocks one)

| Sticker | Upgrade | Cost | Max | What it does |
|---|---|---|---:|---|
| On Fire (5 wins in a row) | 🔥 **Blazing Streak** | 60,000 × 4ⁿ | 3 | Hot Streak counts **one more win in a row** a level (5 → 8). Needs Hot Streak |
| Line Dancer (3 lines at once) | **Line Dance** | 15,000 × 3ⁿ | 5 | Full lines (every reel matches) pay ×1.1 a level (on top of Jackpot Dance) |
| Four-Leaf Hamster (Luck 50) | **Rabbit's Foot** | 50,000 × 3ⁿ | 4 | +5 Hamster Luck a level (every machine) |
| Golden Moment (a golden jackpot) | **Golden Touch** | 10,000 × 5ⁿ | 2 | +1 Hamster Token for every golden jackpot, a level |
| Regular Courier (25 deliveries) | 🫙 **Tip Jar** | 5,000 | 1 | A token every 3rd delivery instead of every 5th |
| Card Shark (a suit guessed) | **Card Counter** | 3,000 | 1 | The card gamble shows 3 more past cards (every card is still a fresh draw) |
| Millionaire (1M coins earned) | 💰 **Money Bags** | 400,000 × 3ⁿ | 5 | +50% payouts a level (the coin upgrades' group) |
| Pot Luck (a jackpot pot won) | **Deep Pockets** | 3M × 3ⁿ | 4 | Every jackpot pot starts (and restarts) 25% bigger a level (on top of Golden Pouches) |
| Free Ride (3 Hamster Balls) | ⚽ **Ball Bearings** (the Burrow Bonanza's) | 150,000 × 3ⁿ | 3 | +1 free spin every time free spins start, a level |
| Nut Hoarder (hold & spin's Grand) | 🌰 **Acorn Stash** (the Acorn Vault's) | 50B | 1 | +1 respin in hold & spin |
| The Big Cheese (a ×10 wedge) | 🧀 **Sharp Cheddar** (the Big Cheese's) | 5T | 1 | +1 on every cheese wedge |

The last three are machine upgrades (they reset with their machine and count for its Machine Stars once they're open); the rest are the hamster's.

### Four new Family Tree traits (94 seeds for every trait once; 71 before)

They sit where the Big Cage's tree has room (§26, `tests/bigtree.test.js` checks every size): two more on the trunk, and the third trait of Charms and of Bonuses.

| Branch | Trait | Cost | Needs | Effect |
|---|---|---:|---|---|
| Roots (the trunk) | 🐾 **Helping Paws** | 4 | Family Fortune | **The Hamster Helper** (below). **New effect** `autoBuy` |
| Roots (the trunk) | 🌳 **Deep Roots** | 10 | Helping Paws | **+2% payouts for every generation** (the family's group): gen 10 = +20%. **New effect** `generationPayout` |
| Charms | 🍀 **Four-Leaf Heirloom** | 4 × 2ⁿ, max 2 | Lucky Heirlooms | Every pup starts with Four-Leaf Clover Lv 1 (then 2), like Warm-up Laps |
| Bonuses | 🫙 **Penny Jar** | 5 × 2ⁿ, max 3 | Golden Pouches | +2% a level that a paid win pays double (adds to Lucky Pennies: 10% + 6% = 16% at most) |

### The Hamster Helper (Helping Paws)

**An improvement for the late game**, where lives are a few minutes long and there are dozens of upgrades to click. Once the family has planted Helping Paws, a little helper hamster **buys an upgrade for you every second**: **the cheapest one on sale** (the hamster's, or the machine you're running), **but only if it costs 10% of your coins or less**. So it never spends what you're saving up for a machine, and it **never buys machines**. It rests in the Big Cage. A switch in the Upgrades tab (**Hamster Helper: On/Off**, with how many levels it has bought) turns it off and on; the switch is saved (the family's, so it stays through retiring). Levels it buys show a small "LV 5" on the tile, without the usual sound and speech. (Its clock isn't saved: after a load it waits a second before its first look, like the frame accumulator.)

### Seven new diary stickers (51 in all, 159 tokens)

Seeing Double (a win paid double, 2) · Night Owl (coins earned while away, 2) · Busy Paws (500 upgrade levels bought, 3) · Little Helper (the Hamster Helper buys a level, 2) · **Sticker Book** (30 stickers: a new goal type, `stickers`, 5) · **Dynasty** (generation 10, 5) · **Billionaire** (1,000,000,000 coins earned, 5). An older save gets the ones it already reached when it loads (Night Owl and Billionaire, usually).

### The rules still hold (tested, `tests/logic/nutsbolts.test.js`)

- **Lucky Pennies is exact:** the coin toss doesn't depend on the reels, so a paid spin's lines pay × (1 + chance) on average (machine.ts `spinExpectation`, `doubleChance`); the test checks the EV, that about 16% of 5,000 winning spins double, that a doubled win is exactly twice on every line, and that **without it the RNG runs exactly as before** (the coin is only tossed when it can matter, so older recordings replay).
- **Rule 5:** free spins still end with Ball Bearings on top of every Bouncy Ball, max Luck and the whole tree. **Rule 8:** auto-spin never beats spin + rest with Running Shoes and Quick Paws on every machine. **Offline** stays below playing (0.5 × 1.7 with Night Shift and the best room). **Machine Stars** only need the upgrades that are on sale. Hot Sauce and Blazing Streak keep the streak factor exact (8 wins counted).
- A locked upgrade can't be bought and stays at level 0; each generation opens exactly its upgrade, once; a sticker opens its upgrade; a loaded save doesn't announce anything again. The debug panel's **Unlock every upgrade** (and the tests' `newGame`) put them all on sale.

### Balance

`node tools/sim.mjs --lives 12` (5 seeds), before and after; the full tables are in PORTING_NOTES → Playtest notes (1.3.1). Life lengths in minutes:

| | idle before | idle after | active before | active after |
|---|---|---|---|---|
| Gen 1 | 46–76 | the same | 29–40 | the same |
| Gen 2–3 | 32–47 · 38–47 | 32–47 · 38–48 | 23–30 · 21–33 | the same |
| Gen 4–6 | 35–57 · 30–55 · 25–48 | 36–59 · 36–52 · 30–41 | 25–33 · 19–35 · 16–27 | 25–35 · 21–31 · 18–28 |
| Gen 7–8 | 9–24 · 11–17 | 12–25 · 10–17 | 8–18 · 7–12 | 12–25 · 7–11 |
| Gen 9–10 | 6–18 · 5–11 | 5–13 · 7–12 | 6–13 · 3.5–9 | 4–10 · 4–6 |
| Gen 11–12 | 3–9 · 3.7–9.6 | 4–7 · **2.4–3.5** | 2–7 · 2.7–4.7 | 3–5 · **1.5–3.5** |
| **12 lives in all** | 5.0–5.9 h | **5.2–5.6 h** | 3.4–3.6 h | **3.4–3.7 h** |
| Whole Family Tree | 4.7–5.8 h | 5.0–5.6 h (22 traits) | 3.4–3.6 h | 3.3–3.7 h |

- **The whole game takes as long as before**, and the first life is untouched (the bot doesn't buy Lucky Pennies before generation 3; the rest are locked). Lives 4–7 even get a little **longer**: there's more to spend on, and the new upgrades pay back more slowly than the old ones.
- **The last lives get shorter**: generation 12 from 3.7–9.6 to 2.4–3.5 min (idle) and 2.7–4.7 to 1.5–3.5 (active). That's the open problem of the late lives (§10) getting a bit worse. It isn't one upgrade: making Mega Cheeks cost ×2 a level, or halving it and Money Bags, left generation 12 at 2.0–3.8 and 1.7–3.6 min. With the helper switched off (`--no-helper`, the bot does all the buying) generation 12 is 3.0–4.5 min: the helper spends coins the moment they're there. The late lives need their own fix (the roadmap's M12, or a rework of the seeds), not smaller upgrades.
- When the bot first buys them (idle): Lucky Pennies at generation 3–4, Running Shoes 4, the Coupon Book 5, the Sticker Album, Line Dance and the Rabbit's Foot 8, Mega Cheeks, Money Bags, Star Polish and Blazing Streak 10. (The bot only buys what raises its income, so it never buys Night Shift, the Cosy Nest, Golden Touch, the Tip Jar or the Card Counter.)
- **Levers**, all data: the costs above, Mega Cheeks' +100%, the helper's 10% share, Lucky Pennies' 2% a level.

### Save v12

The Hamster Helper's switch (`helper`, on) and two stats (`doubleWins`, `helperBuys`). An older save starts with the switch on (it does nothing until Helping Paws is planted) and the stats at 0, and gets the new stickers it already earned. Data schema 13.

### Questions the playtest must answer

- Do the locked upgrades make you want to retire, or chase a sticker? Is folding them away right, or should they be in plain sight?
- Is the Hamster Helper a relief, or does it take the fun out of buying? Is "a tenth of your coins" the right limit?
- Does a doubled win feel good, or go unnoticed? Is 16% at most too much?
- Which new upgrades do you never buy? (Card Counter and Night Shift are the likely ones.)
- Is 1.3.1's name, "Nuts & Bolts", the kind of name you want for updates?

## 29. The Great Migration: a mega rebirth (update 1.4.0)

> **Status: done, released in 1.4.0 "The Great Migration"** (2026-09-28, at the user's "publish 1.4"; PORTING_NOTES D144–D148). Not a roadmap milestone: an update the user asked for between M11 and M12.

*"Start working on a new update to keep late game interesting like a mega rebirth and try to keep the game interesting late game be it balancing things adding things changing things I just want the late game to remain interesting and fun"* (the user, 2026-09-27). In a question round the user picked what the mega rebirth resets (**the family, the tree and the stars**), when it opens (**the whole tree planted**), **all four extras** (Colony Trials, automation, an 8th machine, colony-only traits) and, for the late lives, **"make them longer"**. The update's name: **"The Great Migration"**.

### The Great Migration

Once the **whole Family Tree is planted** (every trait at its max; Family Fortune, which has no max, at least once), the family can **migrate to a new colony**: from the Big Cage (a button next to Start, two taps) or from Family → **Colony** (the same, from a life: that life's pending seeds count too). A banner, a rain of golden whiskers, and the first pup of the new colony plants a seed in an empty meadow (the rebirth animation, §26).

| Starts again | Stays |
|---|---|
| The generation (1), Heirloom Seeds (held and earned), the Family Tree, **Machine Stars**, this life (coins, upgrades, machines), the Colony Trials beaten | **Golden Whiskers** and the colony perks, skins and tokens, diary stickers, casino chips (a chip's price follows the new colony's earnings), the stats, the settings |

**Golden Whiskers** (the colony's currency, 12 px whiskers by a pink nose): `floor((seeds earned this colony ÷ 4) ^ 0.5)`, at least 1, × (1 + Whisker Wisdom): about 9 for the ~350 seeds a family has when its tree is first complete, 27 for 3,000. So more seeds, more whiskers, but a square root: a longer colony pays more, not endlessly more. Colony Trials pay whiskers too. They never come from coins or chips, and there's nothing to buy them with.

**Each new colony's Family Tree costs ×3 more** (`familyTree.costPerColony`: colony 2 pays 3× rule 3's price, colony 3 9×, and so on; the balancing pass, 2026-10-03, D163, 1.7.1). A migrated family earns seeds so fast that it used to replant the whole tree in a few lives and grow ~10× stronger every life, so its lives shrank to 2–5 minutes.

A migrated family's **rebirth upgrades stay open** from its first pup (it has had every generation before: §28's `unlock.generation` counts only in the first colony), and its **casino stays open**. Every colony's pups start further along the name list.

### Colony perks (Golden Whiskers, kept for good)

Family → Colony. Rule 3's formula (`floor(baseCost × growthRate ^ owned)`), in whiskers:

| Perk | Cost | Max | What it does |
|---|---|---:|---|
| ❤️ **Colony Pride** | 1 × 1.6ⁿ | none | **+30% payouts a level** (+50% before the balancing pass, 2026-10-03), in a group of its own (it multiplies the others): the whiskers' sink |
| 🌱 **Seed Sense** | 2 × 1.8ⁿ | 10 | **+10% Heirloom Seeds a level** (every seed total × 1.1, 1.2 …). **New effect** `seedGain` |
| 👓 **Wise Elders** | 3 | 1 | **The automation** (below). **New effect** `autoRetire` |
| 🥨 **Old Friends** | 4 | 1 | Every pup starts owning the Burrow Bonanza (like Snack Inheritance's Stacker) |
| ⭐ **Trailblazer** | 5 × 2ⁿ | 3 | Every machine can be rebuilt for **one more Machine Star** a level (5 → 8). **New effect** `maxStars` |

### Colony Trials (a life with a twist)

From the first migration on, **from each colony's 4th hamster**, a life can be a **Colony Trial**, picked in the Big Cage before it starts. The twist lasts until the life's **pending Heirloom Seeds reach the goal**: a quarter of the seeds the family has earned this colony (at least 5). Then it pays its whiskers and **the twist lifts at once** (the rest of the life is ordinary). Each trial pays **once a colony**; retiring before the goal ends it with nothing (and it can be tried again). A badge in the cage's corner shows the trial and the seeds so far.

| Trial | Twist | Whiskers |
|---|---|---:|
| **Fresh Start** | No Family Tree and no heirloom bonus (not even the tree's free levels) | 3 |
| **Tired Paws** | No auto-spin: every spin by hand | 2 |
| **Rusty Machines** | Machine Stars don't count (no stars' payouts or Luck) | 2 |
| **Small Pockets** | Bets ×1 only | 3 |
| **Plain Hamster** | Nothing worn does anything, and no casino boosts | 2 |

(The first three hamsters of a colony have little a twist could take away, so trials wait for the 4th.) A tile's "now → next" ignores a trial's twist: Wheel Training still says what it gives during Tired Paws.

### The Wise Elders (automation)

With the Wise Elders perk, Family → Colony has three settings: **Retire by themselves** (off at first), **when a life's seeds reach** 25% / 50% / 100% / 200% of the seeds earned this colony (at least 3), and **plant the cheap traits** (on: any trait costing at most a quarter of the seeds held, cheapest first, and Family Fortune when it raises the heirloom bonus; the rest are held). They look once a second; when a life is ready they retire the hamster, plant, and start the next life at once, without the Big Cage (the new pup says who retired, and the seeds). Like retiring by hand it can happen mid-spin; they wait for free spins, a bonus and a gamble under way, and they rest during a Colony Trial. The Great Migration itself is always the player's call.

### Moving Day, the 8th machine (for a migrated family)

A big cardboard box, taped shut, with a blue label. **Colony machine** (`"colony": 1` in data.json): before the first migration it's a locked card in Upgrades → Machines ("🔒 After the Great Migration", from the family's 2nd hamster), after it it's for sale. Priced **between the Acorn Vault and the Big Cheese**: 250B, 5 reels × 3 rows, 20 paylines (10 at first), 120,000 a spin, 3.4 s.

**Moving Boxes** (the new mechanic, `mystery` in data.json): a box is an ordinary symbol on the reels, but before the lines are read **every box on the reels opens into the same symbol**: Baby Carrot 30, Corn Cob 26, Red Apple 20, Golden Seed 14 (once unlocked), Hamster Wild 10 (weights). Two boxes on a line are two of the same thing, so a few boxes can fill whole lines. On screen the boxes land as boxes and pop open once the last reel stops (the result is decided when the spin starts, like every feature, D92). **The EV is exact** (machine.ts `expectedValue`): the reveal doesn't depend on the reels, so a spin's EV is the mix of "the machine with the boxes' weight moved to carrots", "… to corn" and so on, weighted by the reveal chances (tested against every line tried and 40,000 spins).

| Symbol | Weight | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|
| Sunflower Seed | 28 | 427,680 | 736,560 | 1.28M | 2.26M |
| Baby Carrot | 22 | 641,520 | 1.12M | 2.57M | 5.68M |
| Corn Cob | 16 | 902,880 | 2.02M | 5.08M | 14.2M |
| Red Apple | 12 | 2.26M | 14.2M | 85.3M | 427M |
| Golden Seed (Valuables) | 7 | 5.68M | 71.1M | 512M | 2.84B |
| **Moving Box** | 9 | opens into one of the above (or a wild) | | | |
| Hamster Wild | 5 | 4.28M | 42.7M | 341M | 2.28B |
| Wood Shaving | 70 | never pays | | | |

**Its upgrades:** Packing Tape (spins ×0.9 a level, 8), More Rooms (+2 lines, 5), **Bubble Wrap** (+2 box weight a level, 4), Valuables (the Golden Seed), Lucky Van (+10 Machine Luck, 5), Pays Both Ways (10T). RTP **1,566%** fresh (10 lines) … 13,987% with everything (20 lines, both ways, Bubble Wrap Lv 4, the Golden Seed): about 16.7M profit a spin maxed, between the Acorn Vault's 4.0M and the Big Cheese's 30M. It has Machine Stars like every machine.

### Colony traits (a 4th level on the tree)

A migrated family's tree grows **one more level**: a colony trait at the top of four branches (`"colony": 1`; bigtree.ts spaces the levels so they never overlap, at every size, `tests/bigtree.test.js`). In the first colony they don't show, and the tree is laid out as before. "The whole tree" (for the next migration) includes them.

| Branch | Trait | Cost | Needs | Effect |
|---|---|---:|---|---|
| Luck | 📦 **Moving Boxes** | 40 × 2ⁿ, max 2 | Jackpot Dance | +2 box weight a level on Moving Day |
| Charms | 🥇 **Whisker Wisdom** | 60 × 2ⁿ, max 2 | Four-Leaf Heirloom | The next migration and every Colony Trial pay **+25% whiskers** a level. **New effect** `whiskerGain` |
| Head Start | ❤️ **Pack Leader** | 50 × 2ⁿ, max 3 | Snack Inheritance | +50% payouts a level (the family's group) |
| Bonuses | ⭐ **Starry Roots** | 60 × 2ⁿ, max 2 | Penny Jar | One more Machine Star a level (on top of Trailblazer: 5 → 10 at most) |

### Longer late lives: the seed softcap

The open problem since M7 (§10): from generation ~11 the lives shrank to 2–4 minutes, because income grows ×5–10 a life there (the whole tree, the seed jar with Family Fortune, stars, new machines) while the seeds follow a square root. **Past a softcap the seed curve bends**: below **100 seeds** (`seedSoftcap.seeds`) the total is `(coins ÷ 1,300) ^ 0.5` as before; above it, `100 × (raw ÷ 100) ^ 0.4`, where raw is the old total: the seeds grow as coins ^ **0.2** (`seedSoftcap.exponent`) instead of ^ 0.5, joined up at the cap, so nothing jumps. (+50% seeds takes ×7.6 the coins instead of ×2.25.) The next seed costs more and more coins, so late lives get longer; and once a family owns everything, lives keep getting longer, which is what makes the Great Migration the next step. **Since 1.4.0 the formula reads the coins earned this colony** (`colonyCoins`; lifetime stats keep counting), so a new colony starts on the steep early part of the curve. Seed Sense multiplies the total. The Family tab says "Next Heirloom Seed in N more coins" (the lifetime total isn't the number the formula reads any more).

**An old save keeps its progress:** save v14's migration sets the colony's coins to what the *new* curve needs for the seeds the *old* curve gave (fraction and all), so exactly the same seeds are pending; the next ones come on the new curve (tested at 0 to 1e24 coins).

### The rules still hold (tested, `tests/logic/colony.test.js`)

- **Moving Day's RTP is above 100% in every setup**, every unlock raises its EV and lowers its hit rate, every Luck level raises both (at no Luck and max Luck), and its EV is exact (every line tried, 40,000 sampled spins per setup, both ways too): the machine tests cover it like every machine, with the boxes opened as the game opens them.
- **Perks never touch the odds** (the hit rate and EV per ×1 are the same with every perk); **auto-spin never beats spin + rest** with every perk and colony trait; the Wise Elders never retire during a trial, when switched off, or without the perk.
- The migration resets and keeps exactly the table above; trials: goals, once a colony, the twist lifting on the goal, retiring early; the softcap: the same seeds below the cap, fewer above, always growing, the progress bar's next seed exactly where it says; saves v13 → v14.

### Balance (from the simulator; the full tables are in PORTING_NOTES → Playtest notes, 1.4.0-rc.1)

`node tools/sim.mjs --lives 20 --seeds 3`, idle and active, before (1.3.1's curve) and after; life lengths in minutes (120 is the simulator's cap):

| Life | idle before | idle after | active before | active after |
|---|---|---|---|---|
| Gen 1 · 5 · 8 | 50–61 · 37–46 · 10–16 | the same (8: 11–16) | 31–33 · 27–31 · 7–10 | the same |
| Gen 9–10 | 5.1–13.3 · 9.8–11.6 | 7.4–13.6 · 5.8–9.2 | 6.0–9.7 · 3.9–6.1 | 6.9–10.1 · 5.0–9.9 |
| **Gen 11–13** | **4.3–7.0 · 2.8–3.5 · 2.5–3.7** | **7.9–10.3 · 7.1–8.7 · 6.9–8.3** | 2.9–4.0 · 2.1–3.5 · 1.2–2.6 | 4.5–5.6 · 4.2–8.6 · 3.5–8.5 |
| Gen 14–15 | 2.6–3.8 · 3.3–6.5 | 5.0–14.4 · 8.6–37.1 | 1.9–2.7 · 1.3–2.0 | **7.5–9.6 · 7.6–13.9** |
| Gen 16–17 | 3.7–4.1 · 3.2–5.2 | 13–69 · 21–40 | 2.0–4.4 · 2.1–3.6 | 17–39 · 18–51 |
| Gen 18–20 | 5.1–27.6 | 70–120 | 2.6–6.6 | 82–120 |
| Whole Family Tree | 5.0–5.6 h | 5.0–5.8 h | 3.3–3.7 h | 3.4–3.9 h |

- **The first colony's late lives are 2–3× longer**, the first 8 lives are the same, and the whole tree (the Great Migration's unlock) comes at the same time. After generation ~16 the lives climb steeply (the family owns everything): the nudge to migrate.
- **The migration loop** (`--migrate`): the first migration after 5.0–5.8 h idle (3.4–3.9 active) pays **9–11 whiskers**; a migrated family's early game is 3–4× faster (colony 2's first lives 10–15 min idle, 4–10 active); the second migration comes about 2 h later idle (1.2 h active) and pays **33–49**.
- **Later colonies (the balancing pass, 2026-10-03, D163, 1.7.1):** a migrated family's late lives were short again (colony 2's generations 9–15: 2.5–6.5 min idle, 1–5 active) because it replanted the tree in a few lives and Colony Pride stacked on top. **Now each colony's tree costs ×3 more and Colony Pride gives +30% a level** (was +50%). `node tools/sim.mjs --migrate --lives 45 --seeds 3`:

  | | idle before | idle after | active before | active after |
  |---|---|---|---|---|
  | Colony 2, hours | 1.8–2.1 | **3.5–4.8** | 1.1–1.5 | **3.1–4.5** |
  | Colony 2, gens 1–8 | 3–20 min | 7–26 | 4–11 | 7–22 |
  | Colony 2, gens 9–15 (median) | 2.8–4.4 min | **6.0–8.4** | 2.3–3.1 | **4.9–7.7** |
  | Colony 3, gens 4–14 | 2–5 min | 2–7 | 1–2 | 1.6–5 |
  | Whiskers at migration 2 | 38–49 | 65–67 | 33–37 | 66–71 |

  Colony 1 doesn't change. Colony 2 is still faster than colony 1 (the migration's reward) but plays out over 3–5 hours. **Still open:** colony 3's middle lives (2–5 min), because a longer colony 2 pays more whiskers (more Pride). If the playtest finds them too fast, the levers are the tree factor, Pride's size, or a whisker formula that grows more slowly. Why not the seed curve: retiring at "+X% seeds" is relative, so a cost multiplier on seeds cancels out, and a gentler exponent per colony only adds a wall at the colony's end (docs/updates/balancing.md has every variant).

### Save v14

The colony (`colony`, `colonyCoins`, `whiskers`, `perks`, `trial`, `trialsDone`, `auto`) and six stats (`migrations`, `whiskersEarned`, `trialsCompleted`, `autoRetires`, `mysteryBoxes`, `bestBoxes`). An older save: colony 0, no whiskers, and the colony's coins set so that the same seeds are pending (above). Machine Stars are capped at the max with the family's Trailblazer and Starry Roots. Data schema 14 (the `colony` block, `seedSoftcap`, Moving Day and `mystery`, colony traits and machines, four effect types).

### Six new diary stickers (57 in all)

New Horizons (a migration, 10 tokens) · Far, Far Away (three migrations, 8) · Trial by Fur (a trial beaten, 3) · School of Hard Knocks (five trials, 5) · Wise Old Hamster (the Wise Elders retire a hamster, 2) · Box Full (five boxes in one spin, 3).

### Questions the playtest must answer

- Is the Great Migration worth it when it opens (about 10 whiskers the first time)? Does a new colony's much faster early game feel like the reward?
- Is "the whole tree planted" the right moment, and "the family, the tree and the stars" the right size of reset?
- Are generations 11–15 long enough now? Is the climb after generation ~16 a good nudge to migrate, or a wall?
- Which Colony Trials are fun, and which are chores (Tired Paws for an idle player)? Is a quarter of the colony's seeds the right goal, and the 4th hamster the right start?
- Do the Wise Elders make the late game better (less clicking) or empty (nothing to do)?
- Moving Day: do the boxes feel exciting? Is it in the right place (between the Acorn Vault and the Big Cheese)?
- Later colonies go much faster, and their late lives are short again: fun, or too fast?
- Is "The Great Migration" the right name?

## 30. The Glow Up: a visual redesign (update 1.5.0)

> **Status: done, released in 1.5.0 "The Glow Up"** (2026-09-28, at the user's "Publish the new update"; PORTING_NOTES D150–D155). Built on the branch `claude/game-visual-redesign-k9ykeg`. **View only:** no rules, balance or save changes: the golden run, the save fixtures and the simulator are untouched.

*"I want you to do a full visual redesign of the game I mean I want a massive improvement in graphics/visuals better animations more detail everything"* (the user, 2026-09-28)

### The direction

**Still pixel art** (the game's identity, and the user's pick for M15: "still pixel art"), but with far more detail and life: what used to be CSS boxes and gradients is now **painted as pixel art to fit** (a small canvas at 2×, the sprites' rules: colour ramps, light from the top-left, an outline per part, dithered blends), the hamster and the symbols are **bigger sprites** (32×32), and there's motion everywhere, all of it off with Motion "Less". Every colour is still a theme token, and skins still recolour the room, the wire, the wheel and Old Clunky.

### The cage and the room (`src/view/cage.ts`)

The stage is **one painting behind everything**, repainted only when the stage's size, a skin or the machine changes:
- **The room behind the cage:** wallpaper (the wall's two colours, the old stripes, a tiny motif), a wainscot and a chair rail; **a window** with a wooden frame and sill (a little plant on it), tied-back curtains, and the view outside: sky, hills and a round tree, with **clouds drifting past** (the sky is a layer behind the canvas, seen through the glass); **a shelf** with a plant, books and a lamp; **a portrait** of the family's first hamster in a gold frame.
- **The cage in perspective:** wire on the back wall and **down both side walls** (the side wires closer together towards the back), a strong top rail, a middle rail, corner posts, and the **plastic tray** the cage stands in (taller at the front). You look into the cage over the tray's front, which is where the buttons are.
- **The bedding:** a floor of wood shavings, darker where it meets the back wall, the shavings bigger towards the front (depth), a few **sunflower seeds** dropped in it, and **soft shadows under the wheel and the machine**.
- **Sunlight** falls in through the window in two bands, fading as it goes down.
- **At night (free spins):** a second painting fades in: the room dimmed to blue, **the lamp on** with a warm pool of light, and the window showing **the moon and the stars**. (The old purple glow and twinkles stay.)
- The layout is pure maths (`cageLayout()`); tests check the back wall sits inside the stage and the window, shelf and portrait sit on it without overlapping, from a small phone to a big screen.

### The machines (`src/view/cabinet.ts`)

Every machine's cabinet is **painted to fit the machine** (its size depends on its reels, rows and pots), behind its sign, reels and meter, each in its own material:

| Machine | Its cabinet |
|---|---|
| Old Clunky | Mint plastic with a gloss stripe, a chrome-rimmed reel window, bolts, speaker grilles by the meter, little feet, and a chrome cap with a big red bulb on top |
| Snack Stacker | Strawberry-milk pink with candy stripes, under a **striped, scalloped awning** |
| Burrow Bonanza | Wooden planks with nails and grain, **grass on the roof**, a red mushroom at its foot |
| Pouch Palace | **Quilted purple velvet** with gold buttons, a gold border and a **gold crown** with jewels |
| Hamster Maze | A clipped hedge with maze paths and two **topiary balls** |
| Acorn Vault | Brushed steel, **rivets** all round, a **gold combination dial** on top |
| The Big Cheese | A block of cheese **full of holes**, an orange rind, a **mouse hole** |
| Moving Day | Corrugated cardboard, **flaps open on top**, packing tape, "this way up" arrows |

- **Real light bulbs** round every sign: they chase slowly at rest, race while the reels spin (faster still when a reel teases) and all flash on a win (a second, see-through canvas repainted only when a bulb changes).
- A painted **coin tray** at the foot (a few coins in it), a **chrome plate** where the lever joins, and the lever's **ball in the machine's colours** (the Stacker's square push button too).
- **A machine with a Machine Star** is trimmed in gold (its outline turns gold). **In free spins** a halo round the cabinet pulses gold and orange (painted on the bulbs' canvas: a CSS glow on a machine whose reels move every frame cost too much, D153).
- **The reels are drums:** lighter across the middle, shaded towards the top and bottom (hard steps).

### The hamster and the wheel

- **The hamster is 32×32** (drawn at 2×, 64 px), chubbier, with a cheek pouch, a lit crown of fur, a deep shade and whiskers. It has **frames** now: a **four-step run** (quicker while the reels spin), a **blink** every few seconds while it rests, **asleep** when it dozes off (the "z"s still float up), and a **cheer** (a happy hop, eyes squeezed shut) after a nice win, a big win, free spins or a jackpot. The Big Cage, the delivery tube and the Derby's racers use the new run.
- **The seven hats are redrawn** for the bigger head, and move with its bounce; **fur skins** work out the new deep shade by themselves (`%`).
- **The wheel really turns** (`src/view/wheel.ts`): painted every frame at its angle (so its pixels stay square at any angle): a chunky wire wheel with rungs across its track, spokes and a hub bolt, a see-through back, on an A-frame stand in the bedding. At speed the rungs smear and the spokes leave ghosts. During the jackpot (and cheese) wheel its rim turns gold with chasing bulbs, and the prize face sits inside it. Wheel skins still recolour it.

### The reel symbols

All 14 are redrawn at **32×32** with five-step ramps (six new deep-shade colours; the palette's letters had run out, so they're punctuation marks): the **striped sunflower seed**, the **golden seed** with sparkles, a **carrot** with three fronds, a dusky **blueberry** with its crown, a **strawberry** with seeds and a leafy cap, the **hamster coin** (the wild) with a raised rim, the **hamster ball** (clear, with the hamster curled inside), the **cheek pouch** (a tied sack with coins spilling out), **corn** in its husk, a two-lobed **apple**, a pale **wood shaving** (the blank: light, so it never looks like a win), the **golden acorn** under a scaly cap, a **wedge of cheese** full of holes, and a taped **moving box**. They draw at 64 px in the 72 px cells.

### The big moments and the little touches

- **Pixel-art titles** (`src/view/pixelfont.ts`): "BIG WIN!", "HUGE WIN!", "JACKPOT!", "8 FREE SPINS!" … are drawn in **a chunky pixel font of our own** (the browser smooths every font at every size), each letter coloured like metal from its top to its bottom, with an edge, an ink outline and a drop shadow: gold, HUGE WIN in orange, free spins in blue, the Mini, Minor and Major pots in their plaques' colours. As big as fits the cage; the letters still bob in a wave. The amount under them stays in the clean number font (rule 11).
- **A second set of rays** turning the other way, and **a glow that breathes** behind the title.
- **Star glints:** sparkles swell into four-pointed stars and fade (glowing); big wins make the machine glint.
- **Coins clink into the coin tray** on every nice win and up.
- **The reels:** each gives a little **wind-up hitch** before it drops, a **flash of light as it lands** (behind its symbols), and winning cells get a **white frame** inside their line's colour.
- The WIN meter has faint **LCD scanlines**.

### The HUD, the tray, the Big Cage and the casino

- **A logo:** "HAMSTER SLOTS" in gold pixel letters (a wave runs through it now and then); the coin on the counter **turns over** every few seconds; the page is a **quilted pixel wallpaper**, a little darker at the edges.
- **The tray:** cardboard **fibres**, an **icon on each tab** (when they fit: not with four or more tabs in a narrow tray), buy buttons that fill with **marching green stripes** as you save up, tiles that sit up off the tray and **lift under the mouse**, and every button a little glossier (a two-row highlight with a glint).
- **The Big Cage's meadow comes alive:** two **butterflies** (pink and blue) flutter about, a **bird** flies over every so often, and **blossom petals** drift down from the tree.
- **The casino's tables** sit in a **wooden rail** round textured felt.

### What stays

- **View only:** no rules, balance or save changes. The golden run and the save fixtures are untouched; the simulator plays the same.
- **The layout is M15's** (§26): the whole game fits the window; nothing moved.
- **The art rules** (rules 9 and 11): sprites in art.ts (now 32/24/16/12 px squares), painted scenes by the same rules, whole-number scales, colours as theme tokens (tests check every token the painters read is in `:root`), the pixel font for words (and now the big titles), the clean font for numbers, highlights behind symbols.
- **Motion "Less"** stills it all: no drifting clouds, bulbs chasing (they just glow), critters, glints, wind-up or flashes, turning coin or waving logo.
- **Speed:** measured in a browser with no graphics card (the worst case), on a 5-reel machine in free spins with auto-spin: about 54 frames a second, against 56 for 1.4.0 (PORTING_NOTES D153).

### Questions the playtest must answer

- Is it too busy anywhere? Does the machine still stand out from the room, and the symbols from the machine?
- The new hamster: cute? Does its run read at auto-spin speed? Is the cheer too often, or not enough?
- The night room in free spins: lovely, or too dark?
- Are the pixel titles readable on a phone? Is the logo too big on a small laptop?
- Does anything feel slow on your phone?
- Is "The Glow Up" the right name?

## 31. New Digs: a full UI redesign (1.6.0: parts 1–3, 1.7.0 "Family Room": part 4, 1.9.0 "Welcome Mat": part 8, parts 5–7 and 9 planned)

> **Status: parts 1–3 done, released in 1.6.0 "New Digs"** (2026-10-03, at the user's "that looks good publish it", after they saw screenshots; planned 2026-09-29, built from their "build it" on 2026-10-02; PORTING_NOTES D156–D160): the foundations, the shell and the Upgrades tab, built on the branch `ccr-dd00c9db-4v56oa`. **Parts 4–9 are still planned** (Family, Capsules and Info, Casino, Menu and dialogs, the guide and UI sounds, polish): built when the user asks, as later updates; until then those screens wear the new materials in their old layouts. **Part 4 (Family) is released in 1.7.0 "Family Room"** (2026-10-03, D162); as built, see the Family, Colony and Big Cage rows below. **Part 8 (the guide and UI sounds), with new unlock moments, is released in 1.9.0 "Welcome Mat"** (2026-10-03, at the user's "publish it"; built from their "I want new animations for unlocking things as well as a tutorial", D165); as built, see those three sections below. **View only:** no rules, balance or save changes (the golden run, the save fixtures and the simulator stay untouched).

*"Make a full plan to redesign the full UI"* (the user, 2026-09-29)

**The user's picks** (their answers to four questions):
- **How deep:** *restyle + restructure*. Every panel, button, tile, card and dialog gets a new look, **and** the layout is rethought.
- **The look:** *the hamster's room*. Wood, paper and brass, like furniture in the painted room (over a deeper cardboard toy box, an arcade machine, or a clean and bold style).
- **Extras:** *a first-time guide* and *UI sounds* (not keyboard shortcuts, nor text-size and colour options).
- **Next:** *plan into docs only*.

### Why

1.2.0 (§26) fixed the **layout**: the game fits the window. 1.5.0 (§30) **painted the scene**: the room, the cage, the machines, the hamster and the symbols. Everything round the scene is still M5's flat cardboard-and-paper CSS (§12), with 1.5.0's polish on top: the HUD, the Spin, Deliver and bet controls, the tray and its tabs, every tab's tiles and cards, the dialogs, the Big Cage's panels and the casino's chrome. Next to the painted room it looks flat and busy, and on a phone much of it is small and cramped.

### Before (1.5.0)

The measurements of the 1.5.0 UI that motivated this redesign (taken 2026-10-02 at four screen sizes) were cut from this file to save space; they are in git history, in the commit that added this section.

### Goals

1. **One world:** the UI is part of the hamster's room, painted by the same rules as the cage (`cage.ts`: 2 screen pixels a painted pixel, light from the top-left, an outline per part, dithered blends, token colours).
2. **Clearer and friendlier:** one type scale, nothing under 12 px, finger-sized targets (44 px), fewer taps, every currency in view, and always a clear "what can I do now".
3. **One kit:** every screen built from the same pieces, instead of one-off styles.
4. **Phone first** (the user plays on a phone, D134), still great on a computer and a phone on its side, and ready for the phone app (safe areas).
5. **Welcoming:** a first-time guide and soft UI sounds.

### What stays

- **View only.** The two new things kept between visits are *settings* (`uiSounds`, `guide`), stored apart from the save like the others (Reset keeps them), so `SAVE_VERSION` doesn't change.
- **The painted scene stays** as 1.5.0 made it (the room, the cage, the cabinets, the hamster, the wheel, the symbols, the meadow and the tree). Only the controls and labels on it change.
- **Nothing is lost:** every feature, number, setting and key stays reachable.
- **Never cover the machine** (D132 rejected a sheet over the cage; D124: celebrations never cover Spin or Deliver). The tray's open tab is still the only thing that scrolls.
- **The art rules** (rules 9 and 11):
  - sprites in art.ts; painted pieces through paint.ts; whole-number scales only;
  - every colour a token in the first `:root` block (the tests read only that block);
  - the pixel font for words (weight 500), Nunito for numbers;
  - highlights behind symbols; every animation with its `.less-motion` rule;
  - skins still recolour the stage.
- **No UI framework, no new dependency** (rule 5).
- **No slower than 1.5.0:** 54 frames a second in D153's test, with no animated CSS filters.
- **Kept on purpose:**
  - one tap buys from a tile (D132);
  - two taps for the big choices (D24);
  - the cage steps aside for the casino on a phone (D136);
  - no title screen and no "what's new" pop-up (D123).

### The direction: the hamster's room

The UI is the furniture and paperwork of the room the cage stands in, each part in its own material:

| Material | Where | Painted as |
|---|---|---|
| **Wood** (the room's wainscot and shelf) | The tray (a wooden cabinet), the HUD (a shelf plank), dialog frames (picture frames), the control deck (a wooden console on the cage tray's front) | A 9-slice frame from `--wood*`: grain, a bevel, corner joints |
| **Paper** (cream index cards) | Tiles, cards, the detail sheet, tables (ruled lines), notes (a torn edge) | A paper frame with a soft shadow. Its coloured edges keep today's meanings: green = you can buy it, gold = maxed or running, heirloom = planted, blue = selected |
| **Brass** (fittings) | Tab plates, the currency counters, button rims, switches, screws at frame corners, progress gauges | New tokens `--brass`, `--brass-light`, `--brass-dark`, `--brass-ink`, with a bright top-left glint |
| **Enamel** (arcade buttons) | Spin, Deliver, the main buttons | Domed buttons in today's action colours (`--primary`, `--soft`, `--buy` …); pressing one pushes the face down into its lip |
| **Felt** (as now) | The casino's tables, and now the card gamble too | The felt and wooden rail of 1.5.0 |

- **Colour:** the room's warm neutrals; the action colours keep their token names (skins and tests use them); the raw colours outside `:root` become tokens. **The machine stays the brightest thing on screen** (§30).
- **Type:** six sizes (`--text-xs` … `--text-2xl`, about 12/14/16/20/24/32 px), nothing under 12 px (13 on a phone).
  - The few big labels (dialog titles, the tray's heading, the Big Cage's name) use the crisp pixel titles of `pixelfont.ts`.
  - Other words use Pixelify Sans 500, and numbers and long text use Nunito.
- **Spacing:** a 4 px grid (`--space-1` … `--space-6`). Corners come from the frames (pixel steps), not rounded CSS corners.
- **Icons:** a 16×16 icon (12×12 for currencies) for every tab, sub-tab, currency, setting and main button, from art.ts; pixel icons replace the emoji.
- **Motion:** three durations; `steps()` where it should feel like pixel frames; presses, sheets and tab changes move with `transform` and `opacity` only.

### The kit: one set of pieces

Every screen is built from these, and they replace the copies listed in Before:

| Piece | What it is |
|---|---|
| **Button** | Enamel or wood, small to extra large (Spin), with pressed, disabled and busy states |
| **BuyButton** | The cost with its currency, a fill as you save up; ready, saving, maxed, locked or "switch" |
| **ConfirmButton** | The two-tap choice. The first tap *arms* it: a brass "Tap again" plate, a fuse that burns down, a tick. The second confirms. It disarms after 4 s. Retire, Reset, Rebuild, Migrate and Load a save all use it |
| **Toggle** | A brass lever switch (`aria-pressed`) with one "off" look: the Hamster Helper, the Wise Elders, sound, the auto-spin pause |
| **Segmented** | A brass selector, all options always showing: ×1/×10/Max, Motion, Reels, Numbers, the Colony Trials |
| **Stepper** | − value +: the bet, the casino's bets |
| **Tabs / SubTabs** | Brass tab plates and paper index tabs, with dots and proper tab roles (`createSubTabs` grows into it) |
| **Tile** | Icon, name, level, a short effect, pips. **The whole tile is one tap target** (it opens the sheet), and its buy button is a separate 44 px target. Upgrades, perks, prizes and skins all use it |
| **Sheet** | The detail card, rising from the bottom **of the tray** (never over the cage): header, words, now → next, one action, a big close. The shop, the Big Cage and the capsule reveal share it |
| **Card** | Paper on wood with a header and a tone (plain, gold, heirloom, locked): the retire, migration, rebuild, capsule, Wise Elders, trials and cashier cards |
| **ListRow** | Icon, title, a line under it, a value at the end, an optional bar: the Diary, trials, recent wins, the Derby's lanes |
| **StatRow / StatTile** | A label and a number: Stats, the Big Cage's numbers, the retire and migration numbers |
| **Chip / Badge** | Small labels in a few tones, and the "new" dot |
| **Gauge** | One progress bar, a brass-rimmed glass tube, for all 8 kinds |
| **Amount** | A number with its currency icon, at a whole-number scale |
| **Dialog** | A picture frame with a pixel title plate and an action row: the Menu, Stats, Save backup, Welcome back, the crash screen |
| **More** | A "How it works" fold for the long notes (the paytable, the features, the casino's odds, the retire card) |
| **CoachMark** | The guide's pointing paw (below) |

- **Plain TypeScript factories:** `tile(options) → { el, update(…) }`.
  - Each builds its DOM once and updates it through element references with dirty checks (`setText` as today).
  - Lists render by key through one small helper; today several places each do it by hand.
- **Only the open tab renders.** Hidden tabs skip their work, the way the colony and the casino already do.
- **A kit gallery** (`tools/kit.html`, like `tools/sprites.html`) shows every piece in every state at phone and desktop widths.

### The layout and navigation

**Wide screens** (960 px and up, or a phone on its side from 700 px: M15's split stays):
```
┌───────────────────────────────────────────────────────────────────────┐
│ HAMSTER SLOTS   [coin 1.22M +2.9/s] [seed 12] [token 4] [chip 250]   [♪][☰] │ ← shelf plank, brass wallet
├─────────────────────────────────────────┬─────────────────────────────┤
│ [Clunky][Stacker]  ← signs on hooks       │ [Upgrades][Family][Capsules]… │ ← brass tab plates
│                                         │  Hamster | Old Clunky | Machines │
│        (the painted room and cage)      │  [tile]  [tile]              │
│                                         │  [tile]  [tile]              │
│ ╔═ the control deck ═══════════════════╗ │ ┌─ the sheet (in the tray) ─┐│
│ ║ (Deliver) (((  SPIN 25  ))) [⏸] − ×1 + ║ │ └───────────────────────────┘│
│ ╚══════════════════════════════════════╝ │                             │
└─────────────────────────────────────────┴─────────────────────────────┘
```

**Phones:**
```
┌───────────────────────────┐
│ 🐹 [coin 1.22M +3/s][+3] ☰ │ ← "+3" opens the other currencies
├───────────────────────────┤
│ (the cage, ≤ 44% high; the │
│  tray keeps ≥ 32% of it)  │
│ (Deliver)((SPIN))[⏸] −×1+ │ ← the control deck, one row
├───────────────────────────┤
│ Hamster|Old Clunky|Machines │ ← paper sub-tabs, they stay put
│ [tile]  [tile]            │
│ [tile]  [tile]            │ ← only this scrolls
├───────────────────────────┤
│ Upgrades Family Capsules  │ ← the main tabs, in thumb reach,
│ Casino Info  (icons)      │   above the home bar
└───────────────────────────┘
```

- **The wallet.** Every currency the family has, as brass counters: coins (always, with the income rate), Heirloom Seeds, Hamster Tokens, Casino Chips and Golden Whiskers, each once it exists.
  - Tap one for a note on what it is and where it's spent, with a button to that tab.
  - On a phone, coins show and the rest fold into a "+N" counter.
- **The control deck.** A wooden console on the front of the cage's plastic tray.
  - **Spin** is the hero: an extra-large enamel arcade button with the cost and bet. It turns gold in free spins.
  - **Deliver** shows the trip's pay and time, and fills while the hamster is out. The tube in the scene stays; its label moves onto the button.
  - **The auto-spin pause** is a brass lever with a lamp, instead of the ⏸/▶ glyphs.
  - **The bet** is a Stepper with its hint.
  - The keys stay the same.
- **Switching machines stays one tap, where you look** (§12). The tags become little wooden signs on hooks, icons only past four machines, as now. (Built in part 2: where the signs would hang over the machine, the machine keeps below them; on a phone they're icons only, slimmer from five machines, so eight fit a 320 px phone.)
- **The tray** is a wooden cabinet with paper inside.
  - **Wide:** the main tabs are brass plates along its top. The open one always shows its name, and the others show icons when the names don't fit.
  - **Phone:** the main tabs move to **a bar at the bottom** (five 64 px tabs fit a 320 px phone; as built, 52 px tall with 32 px icons, so the bar is 60 px), so they no longer crowd the tray's top. The sub-tabs stay at the top of the tray.
  - **A short phone** (built in part 2): the cage may take up to 44% of the screen's height, but the tray always keeps at least 32% of it, so the cage gives way on a 640 px phone (layout.ts `rigRoom`; a 320×568 phone: the tray 183 px, before 74).
- **The sheet** rises from the bottom of the tray to at most ~60% of it, with a big close button. The tile you tapped scrolls into view above it, and it never covers the cage.
- **The machine's small labels on a phone.** The payline tags, the pot plaques, the WIN meter and the win show's line label keep a readable size by scaling back up against the rig's zoom, as the speech bubble already does (`--rig-zoom`).
- **The card gamble** (built in part 2): a little card table on the casino's felt and rail, out of the zoomed rig and in the cage itself, so it's full size on a phone. ui.ts centres it on the reels, kept inside the cage's wall. On a phone it's three rows: the card, the stake and Take win; the six picks in one row; the timer.
- **Kept:** on a phone the cage still steps aside while the casino is open (D136). A phone on its side keeps the wide layout, with the tabs on the tray (no room for a bar), and stops scrolling the page.
- **Safe areas:** `viewport-fit=cover` with `env(safe-area-inset-*)` padding on the page, the bottom bar, the dialogs and the Big Cage, for notches and home bars (PORTING_NOTES → Mobile).
- **One breakpoint, written once:** today the wide/phone switch is written 5 times in the CSS and again in ui.ts. It becomes one constant in a small `layout.ts`, and a test checks that every copy in the CSS matches (browsers don't support CSS `@custom-media` yet).

### Screen by screen

| Screen | What changes |
|---|---|
| **On the machine** | The pots become brass plaques and the Luck and Hot Streak badges enamel pins. **The card gamble moves onto the casino's felt and rail.** The WIN meter, the line label and the hold & spin board get chrome frames. The trial and boost badges become pins on the cage (with working tooltips). The speech bubble stays paper, and screen readers now announce it |
| **Upgrades** *(built in part 3)* | **Tiles:** a tap on the tile opens the sheet (the description, the whole now → next line with hit rates and average wins, "ready in", the buy button); the tile's own buy button is 44 px. **×1/×10/Max** always shows all three (on a line of its own in a narrow tray). **The Hamster Helper's switch** sits at the top of both upgrade sub-tabs, since it buys the machine's upgrades too. **One meaning of "locked":** a tile that needs another upgrade stays in place and says what it needs; rebirth and sticker upgrades sit in one **Locked drawer**, each saying how it opens ("with your 4th hamster", "earn the On Fire sticker"). **Machine cards** become catalogue pages: icon, name, one line of numbers, the features as icon chips (named in the sheet), stars and one action; the description moves to the sheet. **Rebuild:** one framed workshop ticket with a ConfirmButton, worded the same on the machine card. *As built:* the list's hint ("Tap one to read about it") shares the bar with ×1/×10/Max and gives way to the Helper's switch; on a narrow tray the sub-tabs show only their icons but the open one's name, the Helper is its paw and its switch, and a tile's buy button is slimmer (its coin at 1×); the Upgrades tab's dot says something is newly affordable; the previews refresh 4 times a second |
| **Family** | **The retire card** is a letter from the pup: portrait and name, the big line "Retire now: +N Heirloom Seeds", the bonus now → after, a gauge to the next seed, and a ConfirmButton; what resets and what's kept goes in a "How it works" fold. **Planted traits** are chips you can tap (a sheet says what each does; today it's a hover tooltip, which a phone can't show) |
| **Colony** | The migration card: a progress gauge, the whiskers it would bring, a ConfirmButton; the long explanation in a fold. **Perks** become real tiles with a sheet, like the upgrades. The Wise Elders get Toggles and a Segmented; the trials become ListRows |
| **The Big Cage** | **The meadow, the tree, the rebirth animation and `treeLayout()` don't change.** The numbers become StatTiles on a wooden garden sign. The trait card is the shop's Sheet, with no fixed 150 px height and no scroll inside it: it rises over the lower meadow, and the scene shifts so the tapped trait stays in view. The trial picker is a Segmented with icons, Start an extra-large enamel button, the Migration a ConfirmButton. Nothing under 12 px | *As built (D162): the trait sheet opens by itself only on a first family's first visit with nothing planted; otherwise nothing is picked until you tap a trait. The trial picker is a Segmented without icons ("None" first). The panel under the meadow scrolls on a short screen with Start pinned at its bottom.*
| **Capsules** | **The reveal** is a sheet with "Wear it" and a close button. **The Wardrobe** shows five hangers (one per slot) with what's worn, and the buffs as StatRows (not one long sentence). Skin tiles show the preview, the name and a rarity chip; a tap opens a sheet, also for skins not found yet ("how to get it"). **The Diary** puts the stickers in progress first (nearest first) and folds the done ones under "Done (N)", with sticker upgrades marked |
| **Info** | **The paytable** on a phone is one card per symbol with its pays as chips, so nothing scrolls sideways. **Paylines** as now (its captions fixed). **Features:** each card leads with its key number; the explanation is in a fold. **Recent wins** become a receipt roll |
| **Casino** | **The chip bar** stays at the top with **"+ Chips"**, which opens the cashier from any table. The games become icon sub-tabs (one row on a phone). **Roulette** gets finger-sized spots on a phone (the board in two halves, or zoomed) and an "undo last chip". The long odds notes go in folds; "not enough chips" is said one way; the prizes become kit tiles |
| **Menu** | A wooden board in three parts (two columns when wide). **Settings:** Sound (volume, on/off), UI sounds, Motion, Reels, Numbers, Guide. **Game:** Stats, Save backup, Reset (a ConfirmButton). **About:** the version and its name, What's new, the keys, "the coins are pretend", and the debug panel when it's allowed |
| **Dialogs** | **Stats:** a ledger of StatRows in groups (spins, wins, features, family, casino). **Save backup:** the kit's pieces, working the same. **Welcome back:** a letter from the hamster. **The crash screen:** the kit's Dialog. **The debug panel** keeps its own look (it's for testing), but stops covering a phone's whole screen |

### The first-time guide

**Every step is worked out from the game's own state**, so the save doesn't change. The lifetime stats already count everything it needs (`stats.spins`, `deliveries`, `upgradesBought`, `capsulesOpened`, `casinoGames`, the generation, the tree).
- A step ends by itself once the player has done the thing.
- An old save that's past a step never sees it.
- A Reset brings the guide back (Reset clears the stats).

| Step | Shows while | Points at |
|---|---|---|
| Spin | no spin yet | Spin: "Tap Spin! Each spin costs coins; match symbols to win." (today's first hint) |
| Deliver | coins below a spin's cost, no delivery yet | Deliver: "Out of coins? Send me on a delivery: it always pays." |
| First upgrade | an upgrade is affordable, none bought yet | That tile |
| Auto-spin | Wheel Training is affordable, not bought, the first hamster | Its tile |
| Retire | the first hamster can retire | The Family tab, then the retire button |
| Plant | in the Big Cage with nothing planted | The first trait, then Start |
| Capsules | the tab is open, no capsule pulled yet | Pull |
| Casino | the tab is open, no game played yet | The first table |

- **How it looks:** the hamster says the line in its speech bubble (already the game's voice), and **a pixel paw** bounces beside the target with a soft ring round it.
  - It never blocks a tap.
  - It waits while a celebration, the gamble, the iris or the rebirth animation plays.
  - Motion "Less" stills the paw. Screen readers announce the line.
  - Today's Spin glow and sleepy hint stay.
- **Control:** "Skip the guide" on the note, and Menu → Settings → Guide (on/off; a setting, so Reset keeps it).
- **Tested:** `guideStep(game)` is a pure function (`src/view/guide.ts`, no page needed), tested in Node on games made with the test helpers, like `treeLayout()` and `cageLayout()`.

*As built (1.9.0, D165):*
- **The order:** the first step in the table that applies shows. The Big Cage's Plant step is followed by **Start** (the first visit only), pointing at "Start the new life". The Big Cage's own hamster speaks there, so those two steps are the paw alone.
- **On the way:** a step whose thing is in a closed tab points at the tab first (Upgrades, Family), then the sub-tab, then the thing; a tile out of sight scrolls into view once.
- **A nudge, not a nag:** First upgrade, Auto-spin and Retire are choices you may put off, so each rests for the rest of the visit once its paw has pointed at the real button for a while (20, 20 and 10 seconds).
- **The paw** is a new 16×16 sprite (`guidePaw`: the hamster's arm reaching down), at 3× (2× on a phone under 360 px), above the target (below it, pointing up, near the top of the screen), with a gold ring breathing in pixel steps. It never takes a tap. "Skip guide" is a small link at the end of the hamster's line.
- **It waits** for a celebration, the card gamble, the page's opening, the iris, the rebirth animation and any dialog but the Big Cage.

### UI sounds

- **Short synthesized sounds in sound.ts** (no audio files):
  - a paper flip for a tab;
  - a soft tick for a sub-tab;
  - a wooden click for a press;
  - a brass click for a switch;
  - a slide for a sheet opening and closing;
  - a fuse tick when a ConfirmButton arms;
  - a soft bonk for "can't afford";
  - a pop for a guide step.
- **How they play:**
  - quieter than the game's own sounds;
  - rate-limited, so a burst of taps never buzzes;
  - never doubled up: buying, planting and spinning keep their own sounds.
- **`playUi(name)`** checks the new **UI sounds** setting (on at first) as well as the volume and mute. The kit's pieces call it, so every screen gets it.
- *As built (1.9.0):* nine sounds (the eight above and a soft tick for steppers and folds), at a third or less of the game's own volume; the same sound at most every 60 ms and any UI sound every 25 ms. Buy, Plant, Spin, Deliver and the two-tap buttons keep only their own sounds (the kit's `sound: null`). Menu → UI sounds and Menu → Guide are On/Off rows under Numbers (part 7 will move them onto its board).

### Unlock moments (added to part 8, 1.9.0)

*"Also I want new animations for unlocking things as well as a tutorial"* (the user, 2026-10-03; they left the design to Claude). Before this, most unlocks just *appeared*: a tab or a purse counter switched on, a tile slid into a list, a machine sign hung up, and the hamster said a line. Now each one gets a moment, so a new player notices it and an old one enjoys it. **View only:** nothing about when things unlock changes.

| What unlocks | Its moment |
|---|---|
| **A new symbol** (New Seeds) | A small celebration over the cage: "NEW SYMBOL!" with the symbol big under it, and its name. |
| **A new machine** | "NEW MACHINE!" with the machine's picture; then its sign on the bars unlocks. |
| **A tab** (Family, Capsules, Casino), **a purse counter** (seeds, tokens, chips, whiskers, takings), **a machine sign**, **a new upgrade tile** (the next one in a first life, a rebirth or sticker upgrade), **the Family Casino's sub-tab** | **The padlock:** a brass padlock appears over it, shakes, its shackle springs open and it hops off; the thing itself pops in with a ring of gold sparks, a "NEW!" floats up from it, and a click-and-chime plays. |

- **It waits until you can see it.** A tile in a tab you haven't opened unlocks when you open it; nothing plays while a celebration, the gamble, the iris or a dialog is up, and two unlocks at once play one after the other.
- **Motion "Less":** no padlock, shake or sparks: the thing gets a still gold outline for a moment, and the chime plays.
- **One piece of code** (`src/view/unlock.ts`) plays every padlock moment, so a future unlock is one line.
- **Kept:** the hamster's lines about each unlock, and the tab dots.

### How it's built

| File | Its part |
|---|---|
| `src/view/kit.ts` (new) | The kit's pieces and the keyed-list helper. The helpers copied round today (`$`, `ordinal`, `pct`, the currency labels) end up in one place each |
| `src/view/frames.ts` (new) | Paints the wood, paper, brass and enamel frames and textures from tokens with paint.ts (`Pixmap`, `Mask`, `Ramp`, dither), like theme.ts's wallpaper and fibres. **Once at startup**, into CSS variables, never per frame. Lists its tokens (`FRAME_TOKENS`) for the tests |
| `src/view/theme.ts` | Keeps the button and felt frames and calls frames.ts. The plain paper and card frames take their colours from tokens too (today they use the palette's, so changing `:root` doesn't touch them) |
| `src/view/layout.ts` (new) | The wide/phone breakpoint, and `fitRig()`'s maths as a pure function |
| `src/view/guide.ts` (new) | `guideStep()` and the paw |
| `hud.ts`, `deck.ts`, `family.ts`, `menu.ts` (new) | Split out of ui.ts: the wallet, the control deck, the Family tab, the Menu and dialogs. ui.ts keeps the stage, the events and the frame loop, and renders only the open tab |
| shop.ts, capsules.ts, payouts.ts, colony.ts, casino.ts, bigcage.ts, backup.ts | Rebuilt on the kit, one at a time |
| sound.ts | The UI sounds and `playUi` |
| art.ts | New 16×16 icons: the tabs, settings, the wallet, the paw, the lever's lamp |
| `src/platform/save.ts` | Settings gain `uiSounds` and `guide`, with defaults (tests/platform.test.js too). No `SAVE_VERSION` change |
| index.html | The new skeleton (the wallet, the deck, the tray, the bottom bar, the sheet, the dialogs), `viewport-fit=cover`, tab panels |
| style.css | Keeps **the first `:root` block** (the tests read only that), with the new type, spacing and brass tokens. It `@import`s files by part (base, layout, kit, stage, one per screen; Vite bundles them). Frames replace the notched and rounded boxes, every animation gets its `.less-motion` rule, and dead rules and tokens go |

- **Reused:**
  - paint.ts;
  - theme.ts's frames-to-CSS-variables;
  - dom.ts's `setText`, `replayClass`, `popText`, `iconHTML` and number formats;
  - pixelfont.ts (`titleLetters`, `rampFromTokens`);
  - fx.ts, sound.ts's synth and `describeEffect`.
- **The bugs** listed in Before are fixed as their screens are rebuilt, each with a test where one can catch it.
- **Speed:**
  - no animated CSS filters (D153);
  - `transform` and `opacity` for motion;
  - only the open tab renders;
  - element references instead of HTML strings full of icon data;
  - the layout read at most once a frame.

### Build order (when the user asks)

On a branch, as **1.6.0-rc.1**. Every part leaves the game playable, passes the tests and the build, and gets screenshots. The whole update is one milestone (rule 8). *(Parts 1–3 were released as 1.6.0 at the user's word, D160; parts 4–9 go on a branch again when the user asks, as later updates.)*

| Part | What |
|---|---|
| 1. Foundations | The tokens, frames.ts, kit.ts, layout.ts, style.css split into files, the kit gallery. The game itself doesn't change yet |
| 2. The shell | The wallet, the wooden tray and brass tabs, the phone's bottom bar, safe areas, the control deck, the labels on the machine |
| 3. Upgrades | Tiles, the sheet, the Locked drawer, machine cards, Rebuild, the Helper's switch. **Then a stop: screenshots for the user to OK the look** before the rest is redone |
| 4. Family *(released in 1.7.0, D162)* | The retire letter, the traits, the Colony, the Big Cage's panels |
| 5. Capsules and Info | The reveal, the Wardrobe, the Diary, the paytable cards, the features, recent wins |
| 6. Casino | The chip bar and cashier, the tables, the roulette spots, the prizes |
| 7. Menu and dialogs | The Menu board, Stats, Save backup, Welcome back, the crash screen |
| 8. Guide and sounds | guide.ts, `playUi`, the two settings, and the unlock moments (`unlock.ts`) |
| 9. Polish | Motion "Less", access (contrast, 44 px targets, focus rings, tab roles), speed, skins, docs, the CHANGELOG |

### Questions the playtest must answer

- Is the tray easier to use on your phone? Do the tabs at the bottom feel right?
- Is the wood, paper and brass cosy, or too brown or heavy? Does the machine still stand out?
- Is the sheet better than the old detail card? Is anything too small to read or tap?
- Is the guide helpful or in the way? Are the UI sounds nice, or too many?
- Does anything you used to find easily feel lost?
- Is "New Digs" the right name?

## 32. The Family Casino: your own casino (milestone 12)

> **Status: released in 1.8.0 "Grand Opening"** (2026-10-03, at the user's "publish it", before a playtest; PORTING_NOTES D164). Built on the branch `claude/project-thread-oip2a6`. The project was set up to "begin roadmap 12", and the user left every design call to Claude: *"you decide everything based on the current and future state of the game"*. The picks below are Claude's; the playtest questions at the end are where they get checked.

**The idea:** the family opens its own casino. Cabinets of its machines stand on the floor, hamster guests play them, and the house's edge comes in as **Takings** while you play and while you're away. It's the late game's long goal: it opens with the Great Migration and is **kept for good**, so it keeps growing however short a colony's lives are.

### The picks, and why

| Question | Pick | Why |
|---|---|---|
| When it opens | **The first life after the first Great Migration** (`unlockColony: 1`) | "Far into the game" (the roadmap); a migrated family has everything else, and the migration is the moment the game asks for something new. |
| What it pays | **Its own currency, Takings**, which buy the casino's own things, plus **Chip Crates and Token Boxes** | Takings never become coins and never count as coins earned, so the casino **can't farm Heirloom Seeds or shorten a life**: the short late lives are already the open problem (§10, §29). Chips and tokens tie it back to the game without touching the seed curve; their prices grow (rule 3), so it can't flood the Prize Counter. |
| How deep | **A small idle layer**: 8 cabinets, 5 floor upgrades (decor, a room, staff), 2 back-office buys | Enough to be a goal for many hours, small enough to fit the tray. A full management game (events, many rooms) would be a second game. |
| Idle or active | **Mostly idle, with one light chore: the till** | Guests fill a till that holds a few hours of takings; a tap empties it. That's a reason to drop by without punishing anyone who doesn't. |
| Where it lives | **A sub-tab of the Casino tab, "Your casino"** | Not a full page: the Big Cage is the only page because time stands still there, and the Casino tab's redesign (§31 part 6) will restyle the sub-tab with the rest. |
| Reset layers | **Kept through retirements and migrations**; only Reset wipes it | It runs on real time, not on lives: that is what makes it a long goal next to colonies that reset. |
| Store builds | `ownCasino.enabled: false` leaves it out (and `casino.enabled: false` does too) | Running a casino pushes the gambling look further (§11). |

### "House edge" and rule 4

Every machine pays **you** more than 100% (rule 4), so a guest playing your machines would beat the house. On the floor **each cabinet has its own guest return** (Old Clunky 92% … the Big Cheese 95%), shown on its card, and **your own odds never change** (tested: every machine's economy is identical with the whole Family Casino). The Floor Manager trims the guests' return by 1% a level, never below **88%** (`minGuestRtp`).

### How the takings work (exact, never random)

A guest's spins are counted at their average, so the takings while you play and while you're away come from one formula and the RNG is never touched:

> a cabinet's takings per second = guest bet × (1 − guest return) ÷ (the machine's spin time + 2 s rest) × guests

- **Guests** = 1 + Neon Sign + Plush Carpet; **guest bet** = the cabinet's bet × (1 + High-Limit Room).
- **The till** fills while you play (not in the Big Cage: time stands still there) and while the game is closed (60 s or more, the coins' rule), **up to its size: 2 hours of takings** at today's rate, +2 h a Cashier level (up to 12 h). The coins' 2-hour offline cap doesn't apply; the till is the limit.
- **Empty the till** to bank its takings; only banked Takings can be spent.

### The floor (data.json `ownCasino.cabinets`)

| Cabinet | Takings | Guest bet | Guests win back | Takings/s fresh |
|---|---:|---:|---:|---:|
| Old Clunky | free (the grand opening) | 5 | 92% | 0.08 |
| Snack Stacker | 100 | 20 | 92.5% | 0.29 |
| Burrow Bonanza | 1,500 | 100 | 93% | 1.25 |
| Pouch Palace | 15,000 | 500 | 93.5% | 5.8 |
| Hamster Maze | 200,000 | 2,500 | 94% | 27 |
| Acorn Vault | 2.5M | 12,500 | 94% | 134 |
| Moving Day | 30M | 60,000 | 94.5% | 611 |
| The Big Cheese | 400M | 300,000 | 95% | 2,679 |

### Floor upgrades (rule 3's formula, in Takings)

| Upgrade | Kind | Cost | Max | Each level |
|---|---|---|---:|---|
| 💡 Neon Sign | decor | 25 × 1.6ⁿ | 10 | +20% guests |
| 🟥 Plush Carpet | decor | 2,000 × 1.7ⁿ | 10 | +15% guests |
| 🎩 High-Limit Room | room | 500 × 2ⁿ | 8 | guests bet +25% |
| 🧐 Floor Manager | staff | 50,000 × 8ⁿ | 4 | guests win back 1% less |
| 🧾 Cashier | staff | 300 × 3ⁿ | 5 | the till holds 2 more hours |

### The back office (rule 3, no max)

| Buy | Cost | What |
|---|---|---|
| Chip Crate | 200 × 1.3ⁿ | 500 Casino Chips (they count as chips earned, never coins) |
| Token Box | 400 × 1.25ⁿ | a Hamster Token |

### Pacing (a greedy buyer who empties the till the moment it pays)

From the grand opening, counting only casino time (play and away; a real player who empties the till less often is slower): the Snack Stacker cabinet at ~20 min, the Burrow Bonanza at ~1.1 h, the Pouch Palace ~2 h, the Hamster Maze ~3 h, the Acorn Vault ~4.6 h, Moving Day ~7.5 h, **the Big Cheese (a full floor) at ~14 h**, every upgrade maxed by then. A migrated family's second colony lasts 3–5 h (§29), so the floor fills over the second and third colonies, and the back office is the sink after that.

**The coins' pacing doesn't change:** the Family Casino never touches coins, the seed curve or the machines (the golden run's colony sessions only gained the new sticker's tokens). Its one route into the coin game is chips for the Prize Counter's boosts; `node tools/sim.mjs --casino` already measures the most those can do (§27), and Chip Crates' growing price keeps them from making Golden Hour permanent.

### Save v15

`ownCasino`: opened, the cabinets on the floor, upgrade levels, back-office buys, the till, the Takings. Three stats: Takings banked, tills emptied, cabinets bought. An older save hasn't opened it; a migrated family opens it the next time it plays. Data schema 15.

### Three new diary stickers (60 in all)

Grand Opening (open it, 3 tokens) · Full Floor (all 8 cabinets, 10) · Casino Mogul (bank a million Takings, 8).

### The rules still hold (tested, `tests/logic/owncasino.test.js`)

- Every cabinet's guest return is below 100% and at least 88%, with every Floor Manager level, so takings are never negative; the takings are exactly the formula above (with every upgrade).
- Takings never change coins, the coins earned (this life, this colony, lifetime) or the pending seeds; your machines' economy, payout multiplier and Luck are identical with the whole Family Casino.
- The till: fills by the rate, stops at its size, banks exactly what it held; away it fills by the same formula past the coins' 2-hour cap, not for a short absence, not in the Big Cage. Kept through retiring and migrating; the save keeps it and cleans what no longer exists.

### Questions the playtest must answer

- Is the Family Casino worth opening the tab for? Is the till a nice reason to drop by, or a chore?
- Are the guests' returns (88–95%) and the edge clear on screen?
- Does the floor fill too fast or too slow? Are Chip Crates and Token Boxes worth their Takings?
- Should it give something more to the coin game (it gives nothing on purpose, to keep the late lives from getting shorter)?
- Is a sub-tab the right place, or should it be its own page?
- Is "Grand Opening" the right name?
