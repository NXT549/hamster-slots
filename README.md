# Hamster Slots

A cute pixel-art idle slot machine, powered by a hamster on a wheel.

**Play it in your browser: https://nxt549.github.io/hamster-slots/**

![A BIG WIN on the Snack Stacker](public/social.png)

Spin the reels, win coins, buy upgrades, and teach your hamster to run the wheel by itself. When you run out of coins, the hamster goes on a food delivery, so you can never get stuck. Later on, retire to the Big Cage, pass Heirloom Seeds on to the next pup and grow the Family Tree.

**All coins are pretend.** There's no real money in the game, and nothing to buy with real money.

## What's in it

- **Eight slot machines**: Old Clunky, the Snack Stacker, the Burrow Bonanza, the Pouch Palace, and for the late game the Hamster Maze (243 ways), the Acorn Vault (hold & spin), the Big Cheese (a multiplier wheel) and, after the Great Migration, Moving Day (boxes that all open into the same symbol). Paylines, bets, wilds, free spins, a jackpot wheel with four pots, and a card gamble.
- **Upgrades** for your hamster and for every machine: payouts, auto-spin, Luck, new symbols, Pays Both Ways, Lucky Pennies (wins that pay double) and more. Some unlock as your family grows (**rebirth upgrades**) and some with diary stickers (**sticker upgrades**), and the Hamster Helper can buy the cheap ones for you.
- **Retirement and the Big Cage**: every seed you hold pays a bonus (up to the seed jar), or plant it in the Family Tree for a trait the family keeps forever.
- **Machine Stars**: max a machine's upgrades and rebuild it for a star it keeps for good.
- **The Great Migration**: once the Family Tree is fully grown, the whole family can move to a new colony and start again, taking Golden Whiskers for perks that last forever. Colony Trials (a life with a twist) pay whiskers too, and the Wise Elders can retire and restart for you.
- **The Capsule Machine**: Hamster Tokens from your Hamster Diary buy skins for the hamster, its hat, the wheel, the machine and the room, and everything you wear gives a small buff.
- **The Hamster Casino**: roulette, blackjack, a hamster derby and Seed Drop, played with pretend Casino Chips you earn by spinning (or buy with coins). Every table shows its odds, and chips only buy prizes: boosts, a Luck charm, tokens and three skins you can't get anywhere else.
- It saves by itself, keeps earning a little while you're away, and has a save backup code (Menu → Save backup).

What changed in each version: [CHANGELOG.md](CHANGELOG.md). Every update has a name, like 1.3.0 "The Hamster Casino", 1.3.1 "Nuts & Bolts" (the upgrades update), 1.4.0 "The Great Migration" (the mega rebirth) and 1.5.0 "The Glow Up" (a whole new look).

## Running it yourself

You need [Node.js](https://nodejs.org/) (with npm).

- **Windows:** double-click `play.bat`. It installs what it needs the first time, starts the game on `http://localhost:8765/` and opens your browser.
- **Anywhere:** `npm install`, then `npm run dev`, and open the address it prints.

Other commands: `npm test` (the tests), `npm run build` (the players' version, in `dist/`), `npm run preview` (try that build), `npm run sim` (the balance simulator).

## How it's made

TypeScript and [Vite](https://vite.dev/), with no game engine and no UI framework. The game rules live in `src/logic/` and never touch the page, so the tests and the balance simulator run them without a browser. The sprites are drawn as text in `src/view/art.ts`; the bigger scenes (the cage and the room around it, the wheel, every machine's cabinet, the family's tree) are painted pixel by pixel in code; and every sound is made in the browser.

- **[AGENTS.md](AGENTS.md)**: how the project is built and the rules for working on it (read this first).
- **[DESIGN.md](DESIGN.md)**: what the game is: every system, the maths behind the machines, the roadmap.
- **[PORTING_NOTES.md](PORTING_NOTES.md)**: the platform plans (web, itch.io, Steam, phones) and the logs of decisions, balance changes and playtests.
