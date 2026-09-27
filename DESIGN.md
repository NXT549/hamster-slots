# Hamster Slots — Design

> Working title. A cute pixel-art idle/clicker game. A tiny hamster runs on a wheel, and the wheel powers a slot machine.
> **Web-first (since 2026-09-25):** this browser game *is* the game; there is no engine port. It ships from one web codebase: GitHub Pages first (friends play from a link), then itch.io, then Steam (Electron or Tauri), maybe mobile (Capacitor). See `PORTING_NOTES.md` (D106). **1.0 (§23)** is milestones 1–8, polished; more content comes after it as updates: **1.1.0** (the same day) added M9, three more machines (§24), and M10, Wardrobe buffs (§25). The art is still the prototype art (§12), and playtests keep tuning the fun and the balance.
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
- **Save version 7** (milestone 7) added **symbols you unlock** and the stats `symbolsUnlocked`, `bestLuck` and `suitWins`. Machines now start with some symbols locked, so a v6 save gives every machine every unlock it sells (maxed): an older hamster had every symbol, and nobody loses one. Luck isn't stored (it comes from upgrade levels), and neither is the gamble's card history.
- The save also keeps `savedAt` (real-world time), which pays **offline earnings** on the next visit (§15).
- Settings (sound on/off and volume, Motion, Quick reels, Numbers, the ×1/×10/Max choice) are stored separately from the save, so **Reset progress** keeps them.
- **Menu → Reset progress** wipes the save, *including the family*. You have to tap it twice within 3 s, so it can't happen by accident. (Retiring is the "soft" reset that keeps the family.)
- The game only runs while the tab is open and visible. Time away (closed or hidden) is paid as offline earnings instead (§15).

---

## 8. Debug panel (milestone 1)

Toggle with the **`` ` ``** (backtick) key, or Menu → Toggle debug panel. It's always there while developing; on the public site only with `?debug` in the address (players don't stumble on it).

- Machine stats: which machine (reels × rows, paylines, how many you own), EV per spin, payout multiplier, spin cost, RTP, auto interval
- **Expected auto profit/s** vs **measured net coins/s** (last 10 s of game time: payouts + deliveries − spin costs)
- Spins, hit rate (vs expected), deliveries, play time, RNG seed
- Buttons to add coins: +100 / +1K / +10K. These are free coins and **don't** count as earned, so they give no seeds.
- Family buttons: **Earn +10K / +100K** (counts as earned, so you can test retiring quickly), **+5 seeds** and **Open the Big Cage** (M8: plant without retiring; the new life starts when you leave).
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

**Late lives (M7's known issue; much better since M9's seed jar):** from generation ~9 lives got short again: once bets ×10 and the Palace multiply income, a square-root seed curve hands out seeds easily. M8 kept generations 1–8 close to M7 (§22) but didn't fix the late lives, and M9's machines alone didn't either: the heirloom bonus grew with every seed held (+7,600% by generation 13), so a late life lasted about a minute (D127). **The user picked the seed jar** (§13, D128): held seeds pay up to +100%, and Family Fortune makes the jar bigger. Now the simulated players' lives dip to 2–9 minutes around generations 12–15 and grow again as the family works through M9's machines (22–40 minutes by generation 18, idle; 7–17 active). The dip is still the weakest part of the pacing: the family owns everything up to the Palace by then, so a life there is a quick re-run until the next machine.

**A limit to keep in mind:** balance rules 2 and 3 together mean the base RTP must be at least **1 + auto-spin interval ÷ delivery time** (a delivery pays at least one spin, and must earn less per second than auto-spin at Wheel Training 1). So the slog comes from **time and prices** (slower spins, slower auto-spin, longer deliveries, higher prices), not from an RTP below that floor. RTP stays above 100% (Old Clunky starts at 150%).

### Milestone 6 measurements (history: the game before M7)

| Moment | Target time |
|--------|-------------|
| First upgrade affordable | ~15 s |
| Wheel Training 1 bought | ~1 min |
| Third Reel bought | ~4–6 min |
| Wheel Training + Oiled Lever maxed | ~12–15 min |
| Milestone 1 feels "done" | ~15 min |
| Capsules tab appears (10 tokens, first pull) | ~3–6 min |
| Family tab appears (1 seed pending) | ~4 min for an active clicker, ~11 min for an idle player |
| First retirement (3 seeds) | ~10–20 min |
| Snack Stacker bought (first life) | ~13–20 min idle, ~7–14 min active (bot) |
| Snack Stacker fully upgraded | ~7–9 min after buying it (bot) |
| Bet ×2 (High Roller Lv 1) | first life ~12–18 min idle, ~5–9 min active; later lives in the first few minutes |
| Burrow Bonanza bought | ~9–12 min into the 3rd life (idle and active) |
| Pouch Palace bought | ~4–8 min into the 7th life |
| Life length (idle bot, retiring at +50% seeds) | 15–21 min, then 9–14 min for lives 2–6, a dip to 4–8 min while the Pouch Palace arrives (lives 7–9), then longer again |
| Whole Family Tree planted | ~1.1–1.4 h idle, ~0.9–1.0 h active (bot). Was ~3 h in M2; milestone 8 (the Big Cage) adds new Family Tree traits, so this target is revisited there |

**Measured with `node tools/sim.mjs`** (milestone 6: the balance simulator is now a real tool; see AGENTS.md → How to run). Its tables go in PORTING_NOTES → Playtest notes whenever balance changes. The idle bot's Third Reel (9–14 min) is later than the 4–6 min target because it buys Chubby Cheeks first; the active bot is on target (3–6 min).

### Questions the prototype must answer

- Is going broke frustrating or funny? Does the delivery feel like a fair way back?
- Is the 45 s delivery (4 spins) too long, too short, or boring?
- Does a 28% hit rate feel like a pokie, or stingy? Does Luck feel like it fixes that?
- Is the Third Reel a big "wow" moment?
- When do you stop clicking and let the hamster do it?
- Once everything is maxed except Chubby Cheeks, does the game go flat? That tells us how urgently the next machine type is needed.

---

## 11. Roadmap

The user asked for rebirth + skill tree next, then skins, so the old "Prestige" milestone (7) moved up to 2 and everything after shifted.

**Web-first (2026-09-25):** there's no engine port (PORTING_NOTES D106). Before M8, the code moved to TypeScript + Vite (0.2.0, 2026-09-26) with **no gameplay changes**, and next it deploys to GitHub Pages; then friends can join the M7 playtest from a link. The platform steps (itch.io, Steam, mobile) are in PORTING_NOTES → The plan.

**Re-planned after M6 (2026-09-25):** the user's M6 feedback (the first real playtest) asked for a slower, more pokie-like game, luck you can see, symbols you unlock, a card gamble, a real rebirth decision, machine rebirths, more machines, buffs on hats and skins, a hamster casino with side games, and, late game, your own casino. They picked **"Real pokies" first**. Rows 7–14 below replace the old 7–9 (the old M7 "Wardrobe buffs" is now M10; its Family Tree ideas moved to M8). The order after M7 can be re-picked after each playtest. See PORTING_NOTES D88.

| # | Milestone | Contents |
|---|-----------|----------|
| 1 | First playable economy *(done)* | Old Clunky (2→3 reels), spin cost, food deliveries, 4 upgrades, autosave, debug panel. Plus the UI refresh (diorama look). |
| 2 | Retirement & Family Tree *(done)* | Retire to the Big Cage for Heirloom Seeds (lifetime formula + heirloom bonus), an 11-node Family Tree (Roots, Luck, Speed, Delivery), Family tab, save v2 with migration. See §13. |
| 3 | Hamster Tokens & Capsule Machine *(done)* | Hamster Tokens, an 18-sticker Hamster Diary, the Capsule Machine (rarities, pity, duplicate refunds), 22 skins in 4 categories, the Wardrobe, save v3. See §14. |
| 4 | Polish & feel *(done)* | The user asked for "refining the game and adding new and fun features" and said the assets were "almost too clunky". So: **an art cleanup** (every sprite redrawn at a finer resolution with colour ramps and matching outlines, a lighter stage with a wall and floor, thinner outlines), **win tiers** with banners, flying coins, a hamster hop and a jackpot shake, **synthesized sound effects** with volume and mute, **offline earnings** with a welcome-back dialog, a **stats screen**, a sleepy hint, save v4. See §12 and §15. |
| 5 | New look, QoL & a second machine *(done)* | The user asked to "start on qol features and begin adding new slot machine" and for "a full redesign of the ascetic", and picked: the **hamster cage** look, **collect & switch** machines, and the QoL sets **Buy ×10 / Max** and **Settings & info**. So: the **cage redesign** with pixel cardboard/paper UI frames (§12), reels as a **grid with paylines** and the **Snack Stacker** (§16, this pulls in most of the old "Machine types I"), buying and switching machines, ×1/×10/Max with "ready in" hints, Menu settings (Motion, Quick reels, Numbers), coins in the tab title, a recent-wins log (§17), save v5. ("1.2K" numbers are now the default.) |
| 6 | Pokies night *(done)* | The user gave ten goals and picked, in a question round: two milestones with the pokies part first, **all four bonus features**, bets unlocked by an upgrade. So: **bets** ×1 … ×10 with **High Roller** (§18); the **Hamster Wild**, **free spins** (Hamster Ball scatter), the **jackpot wheel with four pots**, the **gamble** and **Hot Streak** (§19); two new machines, the **Burrow Bonanza** and the **Pouch Palace** (§16); new upgrades (High Roller, Hot Streak, Hamster Wild, Bouncy Ball, Pouch Polish, and spin-cost and payline upgrades for the new machines); the **balance simulator** `tools/sim.mjs` and a tuning pass (the old roadmap's "Balance simulator"); **sub-tabs** in the tray and the Info tab (§12, §17); **pixel particles and animations** (§20); save v6; 8 diary stickers. (This absorbs the old "Machine types II": a third machine and the wild.) |
| 7 | Real pokies *(done; §21; + Pays Both Ways after the first feedback, §3)* | The user's "slow down spin speed… early game to feel like a slog", "make it more like slot machines… make them go one by one", luck you can see, symbols to unlock, and a new double-or-nothing. So: **slower spins and auto-spin** with reels that stop one at a time; a **win show** that lights each winning line **one by one** while a **WIN meter** counts up; a **blank symbol** (Wood Shaving); **unlockable symbols** (the user's "new seeds": machines start with fewer symbols); **Hamster Luck + Machine Luck** with a visible Luck number; the **pokies card gamble** (red/black ×2, suit ×4); a full **rebalance to the "real slog"** with `tools/sim.mjs` (§10); save v7; particles for all of it. Built with one change to the plan: each machine's unlocks are ONE upgrade that opens its symbols in a fixed order (PORTING_NOTES D96). |
| 8 | The Big Cage (rebirth rework) *(done; §22; released in 1.0.0)* | The user's "use the rebirth system more… a reason to both rebirth and hold heirloom seeds" and "when you rebirth it takes you to a fully in-depth page of just the upgrades". So: retiring opens a **full-screen Big Cage page** between lives, and it's the **only place to plant** (the Family tab keeps the retire card and a read-only tree). **Held seeds give +X% income each** (planting spends them, so plant-or-hold is a real choice); a "Retire now: +N seeds → +X%" preview. A **bigger tree**: start with High Roller steps, keep symbol unlocks / Machine Luck / a machine, free-spin luck, bigger pot seeds. **Machine rebirths ("Rebuild")**: a fully upgraded machine can be rebuilt for a permanent **Machine Star** (+payouts and +Machine Luck on that machine, a gold trim), kept through retirement. Numbers from the simulator. Save v8. It should also fix M7's known issue: lives from generation ~9 get short again (§10). |
| **9** | **More machines** *(done; with the seed jar; released in 1.1.0; §24)* | The user's "more slot machines". The user picked (2026-09-27) three late-game machines, each with a new pokie mechanic and exact EV: the **Hamster Maze** (**243 ways**: wins on any row, reel to reel), the **Acorn Vault** (**hold & spin**: 6+ Golden Acorns lock in place with 3 respins; fill it for the Grand) and **The Big Cheese** (a **multiplier wheel** on every full line). Each with its own unlockable symbols, Machine Luck, spin-cost upgrade and stars; new symbol sprites, machine looks, stickers; save v10. (The early machine between Old Clunky and the Snack Stacker wasn't picked.) Plus the **seed jar** (the user's pick for the short late lives): held seeds pay up to +100%, Family Fortune makes the jar bigger (§13). |
| **10** | **Wardrobe buffs** *(done; released in 1.1.0; §25)* | The user's "hats & skins which both give unique changes and improvements" (was M7): **every skin gives a buff while worn** (fur → payouts, wheel → faster spins, machine → cheaper spins, room → offline earnings; rarer = stronger, the user's "gentle" sizes), **6 hats** as a 5th capsule category (drawn on the hamster; +Luck), **a twist on every Epic**, the Wardrobe as a loadout (one per slot, the total shown). The user chose "what you wear gives the buff" and "hats come from capsules" (reversing D39: tokens were cosmetic only), then (2026-09-27) gentle buffs, hats for Luck, Epic twists, one per slot. |
| **11** | **Hamster Casino** *(next: plan it with the user first)* | The user's "minigames or side games… roulette, blackjack etc in a hamster casino". A casino room (a new tab) with side games: **roulette** (the hamster in a ball on the wheel), **blackjack**, and hamster ones (a derby race, a seed drop). Played with **Casino Chips**, which never count as coins earned (they can't farm seeds, like rule 4). A **Prize Counter** for hats, timed boosts and luck charms. Honest odds on screen. Each game is its own headless logic module (rule 1), not more code in game.ts. |
| 12 | Your own casino (late game) | The user's "late game you can eventually start your own casino". The family opens **its own casino**: put machines you own on the floor, hamster guests play them, and you earn the **house edge** while idle; decor, staff, more rooms, a new late-game currency/layer. Unlocked far into the game (e.g. every machine owned and several generations). Planned in detail when we get there. |
| 13 | Delivery depth | Only if playtests say deliveries are fun: routes (short/safe vs long/lucrative), helper hamsters. (The scooter, backpack and auto-delivery are now Family Tree traits.) |
| 14 | Release prep (toward 1.0.0) *(done: moved up after M8 and released as 1.0.0 on 2026-09-27, §23)* | The user's "I want a full release before trying to make the game longer" (2026-09-27): **1.0 = M1–M8, polished**, with the user's "cool animations and effects" (celebrations, reel and win-show effects, little touches, the big moments between lives) and the release basics (icons, a link card, the version in the Menu, a crash screen, a README). Then 1.0.0, the full public release (AGENTS → Git and releases); M9 onwards come after it as updates. Still before each store release: the store-rule checks below. *Was "Port-prep freeze" for the Godot rebuild (D106).* |
| 15 | Visual redesign *(planned; §26; when is the user's pick: before or after M11)* | The user's "i want an entire visual redesign" (2026-09-27): **a new look for the whole game**, **no page scrolling in play** (the upgrades beside or under the machine, in compact rows: "having to scroll down is a pain"), **retiring as a real animated sequence**, and **the Big Cage as its own screen** (it already is the only place to spend seeds, between lives only, since M8; the redesign makes it look and feel like its own place). View only: no rules, balance or save changes. Mock-ups first, for the user to pick a look and a layout. |
| → | **Releases** | GitHub Pages from the start; then itch.io, Steam (Electron or Tauri), maybe mobile (Capacitor), all from the same web codebase. See PORTING_NOTES → The plan. |

**Particles and animations are now a thread, not a milestone** (the user's "fun particle effects and animations"): every milestone ships the effects for what it adds (M7: dust puffs as each reel stops, sparkles per winning line, rolling WIN digits, a card flip, a clover sparkle when luck goes up; M8: the Big Cage scene and a star burst on a rebuild; and so on). **1.0 went through the whole game** (the user's "I also really want some cool animations and effects", §23). Motion "Less" keeps turning them all off.

### User wishlist

- ~~**Skill tree**~~ → built as the **Family Tree** (milestone 2, §13).
- ~~**Rebirth system**~~ → built as **Retirement** (milestone 2, §13).
- ~~**Skins**~~ → built as the **Capsule Machine** with Hamster Tokens (milestone 3, §14), as the user asked: a separate gacha system with its own tokens.
- **Art & UI direction:** the user picked **the hamster cage** (milestone 5, §12): the stage is the inside of a cage, the UI is cardboard and paper. Still a prototype look; the playtest decides whether it's the final direction. After 1.1.0 the user asked for **an entire visual redesign** (M15, §26).
- **QoL:** the user picked *Buy ×10 / Max* and *Settings & info* first (§17). Not picked yet: keyboard shortcuts for buying and tabs. The save backup (export/import code) was built in 3.8: the user asked for it with the web-first plan (2026-09-25, §7).
- **Milestone 6 goals (user):** "different denoms like actual pokies", "features where you can win more", "more slot machines", "better game balances", "new and unique upgrade", "different tabs for upgrades and stuff", "cool particle effects and animations" → milestone 6. "Hats that give different buffs", "skins give different buffs", "new Heirloom Seed upgrades" → planned as milestone 7, now M10 (hats, skins) and M8 (tree traits).
- **First M7 feedback (user, 2026-09-27):** "issue with 3 slots its based left to right meaning if you get 2 on the right it doesnt count" → the user picked **Pays Both Ways as an upgrade** (§3, D119), over "both ways always", "keep left to right, explain it better" and "both ways on Old Clunky only".
- **M9 (user, 2026-09-27):** after 1.0 ("looks good keep going"), the user picked **all three** proposed machines (243 ways, hold & spin, a multiplier wheel) and placed them in the **late game**, "priced so lives from generation ~9 get longer again" (§24; that part didn't work out, §10).
- **After 1.1.0 (user, 2026-09-27):** "i want an entire visual redesign" · "i want better ui for upgrades as having to scroll down is a pain" · "i want a rebirth animation" · "i want a separate screen where you spend heirloom seeds and you can only spend those seeds when you rebirth" → M15 (§26). The last two partly exist already (1.0's iris and seed rain, M8's Big Cage page), so the plan asks the user what should change about them.
- **After M6 (user, 2026-09-25):** new: "more slot machines" → M9 · "rebirths for slot machines" → M8 · "unlock/buy new seeds (carrot, sunflower, golden)", which the user explained as *unlockable symbols you don't start with, kept balanced* → M7 · "more new fun upgrades" → every milestone (luck M7, stars M8, casino M11) · "roulette, blackjack etc in a hamster casino" → M11 · "late game you can eventually start your own casino" → M12 · "hats & skins which both give unique changes and improvements" → M10 · "fun particle effects and animations" → every milestone. Balancing: "slow down spin speed… early game to feel like a slog" → M7 (the user picked "real slog") · "with new symbols added change how likely you are to actually get wins therefore making players buy the luck upgrade" → M7 · "a reason to both rebirth and hold heirloom seeds" → M8. Changes: "change how the double or nothing system works" → M7 (the user picked the pokies card gamble) · "make it more like slot machines… make them go one by one" → M7 · "luck upgrades so you can see how much luck you have… hamster luck and machine luck" → M7 · "when you rebirth it takes you to a fully in-depth page of just the upgrades" → M8.

### Things to keep in mind for release (itch.io, Steam, mobile)

- Slot-machine visuals can trigger "simulated gambling" age-rating flags on some stores, even with fake coins only. Check the target stores' rules before each store release (itch.io, Steam, and especially the Apple and Google app stores, which have their own rules for simulated gambling; PORTING_NOTES → Platform notes). **The double-or-nothing gamble (§19) and bet sizes (§18) make it look even more like real gambling**, so check them in particular. The planned card gamble (M7), casino table games like roulette and blackjack (M11) and running your own casino (M12) push further in that direction: decide before M11 whether the release version keeps them.
- The Capsule Machine (§14) is a gacha. Loot-box laws target boxes bought with real money, and ours never are, but store ratings may still flag it. Always show the odds in-game.

---

## 12. Look & feel (prototype): the hamster cage

**Direction: the inside of a hamster cage** (milestone 5, the user's pick from four directions: hamster cage, night arcade, cozy cottage, candy toy shop). It is *not* the classic clicker layout (big button on the left, long text shop on the right). The game is a little cage you look into: wire bars, wood-shaving bedding, a coloured plastic base, a water bottle and a food bowl, and clear plastic tubes. The UI around it is **cardboard and paper**: the tray is a taped-up cardboard box, tiles and dialogs are paper cards, and every border is a crisp pixel-art frame. **The final look is open:** the 2D pixel-art cage is the current look, and the 2.5D look planned for the Godot rebuild went with it (D106). Whether the release keeps this look is decided later. **The user asked for an entire visual redesign after 1.1.0** (M15, §26): this section describes the look until then.

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
| **Tray** (bottom) | A cardboard box with tape on top. Paper index tabs: **Upgrades** · **Family** · **Capsules** · **Info**. Family and Capsules stay hidden until they're useful (the first seed pending / 10 tokens earned), then appear with a dot. On phones the tabs shrink to fit. **Sub-tabs** (M6): tabs with several parts get a row of small paper labels under the tabs; a dot on a sub-tab means something there is ready (affordable, new). Each tab remembers its sub-tab (a setting). | Keeps the stage clean. The tabs and sub-tabs make room for new systems without long scrolling. |
| **Upgrades tab** | Sub-tabs **Hamster** (the hamster's upgrades) · **[the machine's name]** (this machine's upgrades) · **Machines**, with the ×1 / ×10 / Max toggle beside them. **Machines**: a card per machine (icon, reels / paylines / spin cost / bet, feature chips like *Wild* · *Free spins* · *Jackpot pots*, description, *Running* / *Switch to it* (with "N free spins waiting") / *Buy*). **Upgrades**: paper tiles: pixel icon, name, "Hamster" or the machine's name · Lv, short description, "now → **next**" effect (for the whole bundle; Luck and unlocks show two numbers: "Luck 0 → 10 · hit rate 28% → 30%", "New: Baby Carrot · avg win 7.48 → 8.81 · hit rate 28% → 22%"), level pips, a buy button that **fills up as you save**, and "ready in ~2 min" under it. | You can see at a glance what's affordable, how close the rest is, and what the next big goal (a new machine) costs. |
| **Capsules tab** | Sub-tabs **Capsule Machine** (tokens, Pull, pity, odds, reveal) · **Wardrobe** · **Diary** (a dot for new stickers). See §14. | Everything about skins in one place. |
| **Family tab** | A **retire card** (pup name, generation, "Retire now: +N seeds", progress bar to the next seed, what resets vs what's kept, two-tap Retire button), then the **Family Tree** drawn top-down like a real family tree (Roots on top, Luck / Speed / Delivery columns below, connected by lines), then a **detail panel** for the selected node with its "now → next" effect and a **Plant** button. | You tap a node to read it and then plant it, so a purchase can't happen by accident. The layout reads as "ancestors on top". |
| **Info tab** (was Paytable) | Sub-tabs **Paytable** (Symbol · **Chance** after luck traits and Luck · payouts with every bonus **and your bet** applied; locked columns faded; wilds and scatters marked, and a scatter's row says what it starts; symbols you haven't unlocked are faded with "Unlock: New Seeds"; the Wood Shaving says it never pays) · **Paylines** (little grids, locked lines faded; hidden on one-line machines) · **Features** (a card per feature with its **real odds**: Luck, symbols unlocked, bet, Hamster Wild, free spins, jackpot pots with live values, the card gamble, Hot Streak, line hit rate) · **Recent wins** (§17). | Luck traits change the odds and paylines change how you win, so both are shown, and every feature explains itself honestly. |
| **Menu** | Controls, saving info, **Sound** (volume + On/Off), **Motion**, **Reels**, **Numbers** (§17), **Stats**, debug toggle, two-tap Reset | No footer clutter and no browser pop-ups. |
| **Stats** (Menu → Stats) | Time played, generation, spins, wins + hit rate, biggest win, biggest bet, most paylines won at once, best winning streak, wins with a wild, free spins, jackpot pots (and Grands), the most ways won at once, hold & spin (and Grands), the best cheese wedge (M9), gambles, golden jackpots, coins earned (and how much came while away), deliveries, upgrades, machines bought, seeds, traits, stickers, capsules, skins | Players like seeing their history, and it helps playtests. |
| **Welcome back** | A paper dialog after time away: how long, what the hamster earned, and a "Yay!" that sends coins flying into the counter | Makes coming back feel good (§15). |

**Style rules**
- Soft pastel palette with warm brown outlines (never pure black). All colours are **theme tokens** in `src/view/style.css :root`: the room (`--page`), the cage (`--wall-*`, `--wire*`, `--floor*` for the plastic base, `--tube*`), cardboard and paper (`--kraft*`, `--paper*`), buttons, machines (`--machine*`, `--stacker*`, `--bonanza*`, `--palace*`), payline colours (`--line-1` … `--line-10`; line 11 on reuses them).
- **Pixel frames (9-slice):** the UI borders are 12×12 sprites in `src/view/art.ts` (cardboard, paper, a paper tab, a button). `src/view/theme.ts` turns them into CSS variables, and CSS stretches them with `border-image` at 2× (8 px) or 3× (12 px). A button is ONE sprite repainted in each button's token colours (face and lip, plus a light and an outline mixed from them). Paper frames also come with coloured edges: green = you can afford it, gold = maxed / running, heirloom = planted, blue = selected.
- The pixel font (Pixelify Sans, weight 500) is for words. The clean rounded font (Nunito) is for **all numbers** and body text, because pixel digits like 5 and 8 read as "S".
- **Sprites** (the full style guide is at the top of `src/view/art.ts`): main sprites 24×24 (hamster, reel symbols, machines, cage props, the bedding tile), icons 16×16, currency icons 12×12, UI frames 12×12. They're drawn at **whole-number scales only** (mostly 2×), so pixels stay crisp squares. Each material has a small ramp (base, shade, light) and its **own darker outline**. Light comes from the top-left. See them all at `tools/sprites.html`.
- **Stage outlines** are 3 px (2 px for small parts) in a slightly softer ink (`--outline`, `--outline-thin`, `--outline-ink`). Small flat things (bars, chips, strips) get notched "pixel" corners (`--notch`) instead of round ones.
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

The whole tree costs **71 seeds** (every trait at level 1, Family Fortune once; 37 before M8). The Delivery branch is cheaper because it's mostly quality of life, not raw power. Since M8 the traits that "keep" something are free levels at the start of every life (like Warm-up Laps), not memories of the last life (D120).

Free levels (Warm-up Laps, Heirloom Reel) are real upgrade levels. The next Wheel Training level costs the Lv 1 price (960), and a free level never lowers one you bought. Since M7, Warm-up Laps is the trait that makes later lives zip: the first retirement (3 seeds) buys Family Pride, Warm-up Laps and Speedy Scooter, so generation 2 skips the ~10 minutes of clicking.

### Old Clunky with every luck trait

Both symbols unlocked, Lucky Whiskers, Carrot Patch and Jackpot Dance, no Luck upgrades:

| Reels | Weights (seed / carrot / golden / shaving) | EV per spin | RTP | Hit rate |
|---|---|---:|---:|---:|
| 2 | 40 / 30 / 17 / 45 + Jackpot Dance | 18.05 | 361% | 16.0% |
| 3 | 40 / 30 / 17 / 45 + Jackpot Dance | 26.18 | 524% | 16.0% |

These family traits **lower the hit rate** (fewer Sunflower pairs) but raise the payout per spin: fewer, bigger wins. Since milestone 7 that's the job of symbol unlocks too, and **Luck** (§21) is what raises the hit rate. (M8 plans Luck traits for the tree.)

### Pacing (from the balance simulator, not a real playtest)

**M8:** the numbers in §22 replace this table (lives 1–8 stay close to M7's). The M7 table below is kept for comparison.

`node tools/sim.mjs --lives 12 --seeds 5` (milestone 7) plays the real game logic: an **idle** player (clicks every 1.5 s until Wheel Training, then lets the hamster work), buying by "time to afford + time to pay back" (PORTING_NOTES D100), retiring when the pending seeds reach max(3, +50% of the seeds already earned), 120 min max per life. Ranges are over 5 seeds.

| Life | Length (idle) | Length (active) | New this life (idle) |
|---|---:|---:|---|
| Gen 1 | 46–77 min | 28–45 min | Wheel Training 8–23 min, Third Reel 37–70 min, +3 seeds |
| Gen 2 | 35–43 min | 24–31 min | **Snack Stacker** ~30–37 min in |
| Gen 3 | 32–50 min | 27–39 min | |
| Gen 4 | 39–65 min | 28–37 min | **Burrow Bonanza** (~38–65 min in) |
| Gen 5 | 33–46 min | 22–35 min | Bonanza ~32–44 min in |
| Gen 6 | 31–40 min | 22–28 min | |
| Gen 7 | 16–31 min | 12–21 min | |
| Gen 8 | 10–18 min | 7–14 min | **Pouch Palace** (in some lives) |
| Gen 9–12 | 3–18 min | 3–11 min | Palace in every life; bet ×10 |

The whole tree is planted after ~4.0–4.9 h (idle) or ~2.7–3.4 h (active). **Known issue for M8:** lives from generation ~9 get short again (3–10 min), because once bets ×10 and the Palace multiply income, a square root hands out seeds easily; M8 reworks the rebirth economy (held seeds, new traits, D94). (M6's bot table, with the cube root and a different buying rule, had lives of 15–21 min then 4–14 min; see PORTING_NOTES.)

### Questions the prototype must answer

- Is the first retirement a "yay, a new pup!" moment or an "oh no, I lose everything" one? Does the card make clear what's kept?
- Do +3 seeds after ~1 hour feel like enough? Does the Family tab showing up at ~10 min (1 seed) tempt people to retire too early?
- Do later lives feel fast? Warm-up Laps and Heirloom Reel should make the first minutes zip.
- Is the Delivery branch worth seeds, or does everyone skip it?
- When do lives start to drag? That's where the next machine type should arrive.

---

## 14. Hamster Tokens & the Capsule Machine (milestone 3)

> **The user's direction:** skins come from *a separate gacha system*, paid with *"hamster tokens" earned separately*, "in whatever way you come up with". The proposal was shown to the user, who said "this is really good, continue", so it was built with the proposed defaults.

**Hamster Tokens** are a third currency. They only buy capsules (skins), and can never be bought with real money. Since M10 **a skin you wear gives a small buff** (§25; the user's pick, which reverses D39's "cosmetic only"). They're **kept when you retire** (only Reset wipes them).

### Earning tokens

| Source | Tokens | Notes |
|---|---:|---|
| **Hamster Diary stickers** (table below) | 1–5 each, 122 in total (39 stickers) | One-time goals. They're checked after every spin (when it starts and when it lands), delivery, purchase, retirement and capsule, and on load, so an older save gets the stickers it already earned. |
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
| Full Bloom | Every Family Tree trait (18 since M8; 11 before) | 5 |
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

Goal types (data.json `goal.type`): `stat` (a lifetime stat ≥ target), `upgradeLevel` (the best level on any machine), `generation`, `treeNodes`, `skinsOwned`, `machinesOwned` (M6: how many machines you own right now), `categoryOwned` (M10: skins found in one category, e.g. hats). A new sticker of an existing type needs only data.json. The two M5 stickers use the new stats `machinesBought` and `mostLinesWon`; the M6 stickers use `bestStreak`, `biggestBet`, `bestGambleRun`, `wildWins`, `freeSpinTriggers`, `jackpotsWon` and `grandJackpots`; the M7 stickers `symbolsUnlocked`, `suitWins` and `bestLuck` (the most Luck any machine has had, noted just before the diary is checked); the M8 stickers `mostSeedsHeld`, `rebuilds` and `bestStars`; the M9 stickers `bestWays`, `holdGrands` and `bestWheel` (the biggest wedge, Aged Cheese included).

The first five goals (First Spin, Beginner's Luck, Look No Paws!, Warming Up, Three's Company) pay exactly **10 tokens, the first pull** (a test checks this). So the **Capsules tab appears after ~3–6 minutes** of a first game in M6; with M7's slog it waits for Wheel Training and the Third Reel, so ~12–47 minutes into a first life (the simulator's range for an idle player).

### The Capsule Machine

- 1 pull = **10 tokens** → one capsule → one skin. The pull is decided instantly; the capsule wobbles for 0.9 s before it opens (view only).
- Rarity by weight: **Common 70 · Rare 25 · Epic 5**, then a skin of that rarity is picked evenly. Starter skins are never in capsules.
- **Pity:** after 19 pulls in a row without an Epic, the 20th pull is an Epic. So the real long-run Epic rate is **~7.8%**, not 5% (Common ~67.9%, Rare ~24.3%). The game shows both numbers. The formula is in `getCapsuleOdds()`, and a 20,000-pull test confirms it.
- **Duplicates** refund tokens: Common +2, Rare +4, Epic +8.
- Pulls use the game's seeded RNG (like spins), so the same seed gives the same capsules.

### Skins (29)

| Category | Starter | Common | Rare | Epic |
|---|---|---|---|---|
| **Fur** (hamster palette) | Classic | Cinnamon, Snowball, Cocoa | Lavender, Mint Chip | Golden Glow |
| **Hat** (M10, on the hamster's head) | No Hat | Party Hat, Beanie, Flower Crown | Top Hat, Cowboy Hat | Crown |
| **Wheel** | Classic Wheel | Mint Wheel, Berry Wheel | Oak Wheel | Gold Wheel |
| **Machine** | Mint Clunky | Peach Clunky, Sky Clunky | Grape Clunky | Midnight Clunky |
| **Room** (wall + floor) | Cozy Cream | Strawberry Milk, Mint Garden | Starry Night | Sunflower Field |

24 skins are in the capsule pool: 12 common, 7 rare, 5 epic (18 before the hats). Collecting all of them takes **~151 pulls on average** (median 136; 1 in 10 players needs 237+; measured over 2,000 seeds; ~110 before the hats), because the last Epics are the hard part. With refunds that's roughly 1,000–1,150 tokens. What each skin does when worn is in §25.

- data.json lists each skin's id, name, category and rarity. **What a skin looks like lives in `src/view/skins.ts`**, because data.json never holds colours. Fur skins recolour the hamster sprite's palette letters. Wheel, machine and room skins override theme tokens (`--wheel-*`, `--machine`, `--marquee`, `--wall-*`, `--floor*`), set **on the stage element only**.
- The **Wardrobe** shows every skin (unfound ones greyed out, with their names, rarities and buffs), grouped by category, under a line that adds up **what you're wearing** (M10). Tap an owned skin to wear it: one per slot. The choice is saved.
- Hats (M10) are drawn on the hamster sprite itself, wherever the hamster appears (the wheel, the tube, the Family tab, the Big Cage, the logo), and use only colours fur skins never change, so every hat fits every fur.

### The Capsules tab

- Appears (with a dot and a hamster line) once the family has earned 10 tokens. Until then the hamster doesn't mention tokens at all.
- **Capsule card:** the machine sprite, your tokens, a **Pull** button, the pity countdown ("Epic guaranteed within N pulls"), the odds (with the pity rate) and the duplicate refunds, then the **reveal** (the capsule wobbles, then shows the skin, NEW! or "Duplicate · +N back", and a **Wear it** button).
- **Wardrobe**, then the **Hamster Diary** (each sticker with a progress bar and its reward).
- On wide screens, a little **capsule machine stands in the corner of the room**. It bobs when you can afford a pull, and clicking it opens the tab.

### Questions the prototype must answer

- Does the first pull (~3–6 min) come at a nice moment, or is a second new tab this early too much?
- Do the diary goals feel like a helpful guide or like homework?
- Is 10 tokens a pull and ~1 token per few minutes (later) a fun pace? Do duplicates feel OK with the refund?
- Which skins do people actually wear? Are the rooms readable (e.g. Starry Night is dark)? (Since M10 the buffs decide some of that: §25.)

---

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

### Little touches

- **Stats screen:** Menu → Stats (see §12).
- **Sleepy hamster:** with no auto-spin and no spin for 25 s, the bubble says "Zzz… (tap Spin to wake me up)".

### Questions the prototype must answer

- Do the tiers feel right? Is a Golden pair exciting enough to deserve coins flying?
- Are the sounds charming or annoying after 10 minutes? Is the volume default (60%) right?
- Is 50% for up to 2 hours a generous-feeling "welcome back", or should it be more?

---

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

### Pacing (from the simulator, not a real playtest)

Since M7 (§10, §13): the Snack Stacker costs about what a whole first life earns, so it arrives at the first retirement: **retire now, or buy the Stacker and push on?** The idle bot retires, and buys it ~30–37 minutes into the second life (the active bot ~20–29 min). (M5's bot had it at 13–20 min of a first life; see PORTING_NOTES.)

### Questions the prototype must answer

- Is 5,000 a good price? Does the Stacker feel like a big "wow" (new look, more rows, lines lighting up one at a time)?
- Is switching useful, or does everyone just stay on the best machine? (Old Clunky's cheaper spins help when you're broke.)
- Is losing the machine on retiring OK, or should a Family Tree trait keep it (like the Heirloom Reel)? (Planned for M8.)
- The Stacker speeds up seeds a lot in long lives (~9× income at 30 min). Does the Family Tree now fill up too fast?

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

### Questions for the new machines

- Do the Bonanza (lives 4–5) and the Palace (from ~the 8th life) arrive at good moments? Is the Palace too far away?
- Are free spins exciting enough every ~255 spins (rarer than in M6)? Is the jackpot wheel worth the wait?
- Does the wooden burrow / velvet palace look read as "new machine" at a glance?

---

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
- **Keys** (M6, M7): `-` / `=` change the bet; in the card gamble `←` red, `→` black, `1`–`4` a suit, `C` takes the win.
- Stats (Menu → Stats) gained *Most paylines won at once* and *Machines bought*.
- Settings are saved separately from progress (like sound), so Reset keeps them.

### Not done yet

- Keyboard shortcuts for buying upgrades and switching tabs/machines (the user didn't pick them).

### Questions the prototype must answer

- Does ×10 / Max get used? Is "ready in" helpful or noise?
- Do people turn on Quick reels? Is the log of recent wins interesting?

---

## 18. Bets ("denoms") (milestone 6)

*"Different denoms like actual pokies: choose how much you want to gamble."* (the user)

- Every machine has a **bet**: ×1, ×2, ×3, ×5 or ×10 (data.json `betSteps`). **A spin costs spin cost × bet, and every payout is × bet** (lines, free spins, jackpot pots). So the bet never changes the RTP: a bigger bet is just a bigger, riskier spin.
- **High Roller** (a hamster upgrade, §5) unlocks the next bet on every machine: 3,000 · 45,000 · 675,000 · 10,125,000 coins (M7; 2,000 × 10ⁿ in M6).
- You pick the bet with **− / +** next to Spin (keys `-` / `=`). Each machine remembers its own bet; a newly bought machine starts at the bet you were using (so buying one never feels like a step down).
- **Short of coins?** A spin **steps down** to the biggest unlocked bet you can afford (the bet box says "spins ×2"). A spin is refused only when even ×1 is too much. So auto-spin never stalls because of a high bet, and 0 coins is never a dead end (rule 3).
- **Unchanged by the bet:** win tiers (base payout ÷ base spin cost, D54), balance rules 2 and 3 (checked at ×1), Self-Starter ("can't afford ×1").
- The bet resets to ×1 on retiring (High Roller is a coin upgrade). Milestone 8 may add a "start with" trait.

**Why unlocked by an upgrade?** Every machine pays back more than it costs, so a free choice of bet would multiply income for nothing. The user picked "unlock steps with upgrades" from three options (D73). **Why only up to ×10?** With ×20 … ×100 the simulator showed later lives collapsing to about 2 minutes (bets multiply everything else), see D80.

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

### Questions the prototype must answer

- Are wilds easy to read? Does "3 wilds beat 5 seeds" ever confuse?
- Do free spins feel special? Is ×2 enough?
- Is the jackpot wheel exciting? Are the pots too small or too big next to line wins (~10% of the Palace's EV)?
- Does anyone gamble? Is the card gamble fun, or does it feel too much like real gambling (a release concern, §11)?

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

### Save v7

A v6 (or older) save gives every machine every symbol unlock it sells, maxed: an older hamster had every symbol, so nobody loses one. New stats `symbolsUnlocked`, `bestLuck` and `suitWins` start at 0. Luck is worked out from upgrade levels, so it's never stored, and neither is the card history.

### Tests (687 in total)

Blanks never pay and never count as a hit · every unlock raises the EV and lowers the hit rate in every setup (no Luck and max Luck) · every Luck level raises the hit rate and the EV on every machine · the card gamble is fair (colour and suit, 20,000 picks each, win rates and pay-back) · the auto-spin interval is never shorter than spin time + rest · RTP > 100% for every setup, locked symbols included · rules 2 and 3 with the new numbers · the brute-force wild test with a blank added · a brute force of the new multi-line hit rate over every grid of a toy machine · every real machine's one-line EV against every possible line (sampled checks now use that exact spread, D99) · save v7 migration · Luck and unlocks in the game (locks, order, previews, reset on retiring, tree shifts skipping locked symbols).

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

- **Retiring opens it** (a full-screen page): who retired and how many seeds they left, seeds held, the heirloom bonus, Machine Stars, and **the Family Tree**. Tap a trait for its details and **Plant** button (it scrolls into view).
- **It's the only place to plant.** The Family tab keeps the retire card and shows the tree, read-only ("plant when you retire").
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

- **Retiring:** a dark circle **closes on the hamster** like the end of an old cartoon; then the Big Cage page arrives in parts (the header, each number, the tree), **Heirloom Seeds rain** down it, and the seeds held **count up** from what the family had before.
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
| Midnight Clunky (machine) | +2 free spins every time they trigger |
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

> **Status: planned, not built** (the user's request, 2026-09-27, after 1.1.0; PORTING_NOTES D131). Nothing below is decided yet: the questions at the end go to the user before any code changes, and so does when it's built (before or after M11).

*"i want an entire visual redesign · i want better ui for upgrades as having to scroll down is a pain · i want a rebirth animation · i want a separate screen where you spend heirloom seeds and you can only spend those seeds when you rebirth"* (the user, 2026-09-27)

### Where the game is today (1.1.0)

- **One long page.** The HUD, the cage and the tray are stacked, and the page scrolls. At 1280×800 the page is 1,377 px tall: the cage and its buttons fill the first ~700 px, so the tray starts below the fold, and scrolling down to buy something takes the machine off the screen. At 390×844 (a phone) it's 1,796 px, with one upgrade tile per row (~190 px each).
- **Tall upgrade tiles.** Every tile has an icon, the name and level, a description, "now → next", pips and a buy button. The Hamster sub-tab has 5, each machine's has 5–7 (41 across the 7 machines), and Machines has 7 cards. The sub-tabs (M6) keep each list short, but not short enough to sit beside the machine.
- **The rebirth animation** (1.0, §23): a dark circle closes on the hamster, the Big Cage page arrives in parts with seed rain and a count-up, a trait springs up when it's planted, and the circle opens on the new pup. A few seconds in all.
- **The seed screen already exists** (M8, §22): retiring opens **the Big Cage**, a full-screen page between lives. It's the only place to plant (only between lives), and time stands still while it's open; the Family tab keeps the retire card and a read-only copy of the tree. But it looks like one more paper dialog on a dark backdrop: the tree is a column of pale cards to scroll through, its lines show through the traits you can't plant yet (they're see-through), and on a phone most of the tree sits below the Start button.

So two of the four asks are already there in some form (the separate screen with its spending rule, and a short animation). For those, the redesign's job is to make them *feel* like the big moment they are; a question below checks that with the user.

### What the redesign is for

1. **No page scrolling in play.** The machine, Spin and what you can buy are on screen together, at every size from a phone up. Only a list inside a panel may scroll, and the main ones should fit without it.
2. **Upgrades at a glance.** Compact rows or small tiles (icon · name · level · "now → next" · price), with the rest a tap (or a hover) away, and the affordable ones standing out. The 5 hamster upgrades and a machine's 5–7 should fit without scrolling.
3. **Retiring as a real sequence**, not a transition: a few seconds you can skip. For example, the hamster packs up and waves goodbye, its seeds pour into the family's jar, the Big Cage opens, and after planting the new pup arrives and the cage comes back to life.
4. **The Big Cage as its own place:** its own scene and look, not a dialog. The tree is drawn as a tree, all 18 traits readable at once (no scrolling on a laptop), with the seed jar in view and the new pup waiting. Planting stays between lives only (already the rule).
5. **A new look for the whole game:** one consistent style for the HUD, the cage, the 7 machines, the tray, the dialogs and the Big Cage.

### Layouts to try (as mock-ups first)

- **Laptop and wider:** the cage on the left, a **side panel** with the tabs on the right. The panel scrolls on its own if it must; the page never does.
- **Phone:** the cage on top at a fixed height and the tray filling the rest of the screen, or a tray that slides up over the cage and back down.
- **Upgrade rows:** two lines per upgrade (icon, name and level; "now → next" and the buy button), with the description and "ready in" on a tap.

### What stays

- **View only, like 1.0:** no rules, balance or save changes, so the golden run, the save fixtures and the simulator stay untouched. (Hiding the tree from the Family tab would be view only too.)
- **The art rules** (rule 9, rule 11): sprites in art.ts, colours as theme tokens, whole-number scales, the pixel font for words and the clean font for numbers, highlights behind symbols. Skins keep recolouring through tokens (fur, hats, wheel, machine, room), so every token a skin sets must still mean something in the new look.
- **Motion "Less"** turns off every new animation (a `.less-motion` rule each), and the game still works at 390 px.
- **Nothing gets lost:** the features on the machine, the win show, the card gamble, the jackpot pots, the Info tab's honest odds and every setting stay reachable.

### How it would be built (proposed)

On a branch (`main` stays playable), one step at a time, with a look from the user after each:
1. **Mock-ups:** 2–3 layouts and looks as screenshots at 1280 and 390 px, for the user to pick from.
2. **The layout and the upgrades:** no page scrolling, the new tray.
3. **The Big Cage as its own screen.**
4. **The retirement sequence.**
5. **The new look everywhere else** (the machines, dialogs, the Menu, Capsules, Info).

Then the next minor version (1.2.0).

### Questions for the user (before building)

- **Which look?** The hamster cage remade cleaner, or a new direction (M5's other three were a night arcade, a cozy cottage and a candy toy shop), or something else? Still pixel art?
- **The Big Cage and the rebirth animation:** have you seen 1.0's (on the live link)? What should change: the look, the length, what happens in it?
- **The Family tab:** stop showing the tree there, so it's only ever in the Big Cage, or keep the read-only copy?
- **Upgrades:** compact rows, or small tiles in a grid? A side panel on a laptop?
- **When:** next (before M11, the Hamster Casino), or after it?
