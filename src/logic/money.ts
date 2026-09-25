// money.ts — LOGIC: big numbers for money (coins, Heirloom Seeds, Hamster Tokens).
//
// A plain JavaScript number tops out at about 1.8e308: after that it's
// "Infinity", and idle games get there. break_eternity.js's Decimal goes far
// beyond (1e400, 1e1e15 …): it keeps a number as a sign, a "layer" and a
// magnitude. Every amount of money in the game is a Money (a Decimal), and so is
// everything that grows with money: prices, payouts, the payout multiplier.
// Odds, weights, timers, levels and counts stay plain numbers.
//
// Maths with a Decimal uses its methods, because + - * / < > don't work on it:
//   a.add(b)  a.sub(b)  a.mul(b)  a.neg()   a.gt(b) (>)  a.gte(b) (≥)  a.lt(b)  a.lte(b)  a.eq(b)
//   a.max(b)  a.min(b)  a.floor()  a.cmp(b) (−1, 0 or 1, for sorting)  a.toNumber()
// Dividing, powers and rounding to cents go through the helpers below instead.
// They give EXACTLY the answer plain numbers gave whenever the numbers fit in one,
// so the game plays the same, to the cent, as it did before big numbers
// (the golden run checks it). Decimal's own add, sub, mul and compare are
// already exact there; its div and pow can differ in the last digit.

import Decimal from 'break_eternity.js';

export type Money = Decimal;
// Anything money() accepts: a Money, a number (1234.56) or text ("1234.56", "1.5e400").
export type MoneyLike = Money | number | string;

export function money(x: MoneyLike): Money {
  return new Decimal(x);
}

export function isMoney(x: unknown): x is Money {
  return x instanceof Decimal;
}

// Below 9e15, a Decimal keeps its value as a plain number (break_eternity's
// "layer 0"), so doing the maths on that number gives the old answers exactly.
const PLAIN_LIMIT = 9e15;

// x as a plain number, or null when it's too big (or not a number at all).
function plain(x: Money): number | null {
  const n = x.toNumber();
  return Math.abs(n) < PLAIN_LIMIT ? n : null;
}

// Coins are always rounded to cents. Otherwise float drift (4.4999999…) could
// make you unable to afford a 4.5-coin spin while the screen shows "4.5".
// (Past 9e15 a cent doesn't show anyway, so big amounts are left as they are.)
export function roundMoney(x: MoneyLike): Money {
  const m = money(x);
  const n = plain(m);
  return n === null ? m : money(Math.round(n * 100) / 100);
}

// a ÷ b.
export function divide(a: MoneyLike, b: MoneyLike): Money {
  const ma = money(a);
  const mb = money(b);
  const x = plain(ma);
  const y = plain(mb);
  return x !== null && y !== null ? money(x / y) : ma.div(mb);
}

// x to the power e (e is a plain number, e.g. a growth rate's level or a square root's 0.5).
export function power(x: MoneyLike, e: number): Money {
  const m = money(x);
  const n = plain(m);
  if (n !== null) {
    const result = Math.pow(n, e);
    if (Number.isFinite(result)) return money(result);
  }
  return m.pow(e);
}

// Is this a real amount (not NaN or Infinity)?
export function isFiniteMoney(x: Money): boolean {
  return Number.isFinite(x.sign) && Number.isFinite(x.layer) && Number.isFinite(x.mag);
}

// The ways a Decimal writes itself as text (its toString), which is how a save
// stores money: "1234.56", "1.5e400", then for unimaginably big numbers "ee15.2"
// (layers 2–5) and "(e^6)15.2". break_eternity would read almost any text
// ("abc" as 0, "12abc" as 12), so text is checked against these first.
const MONEY_TEXT = [
  /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
  /^-?e{2,5}-?\d+(\.\d+)?(e[+-]?\d+)?$/,
  /^-?\(e\^\d+\)-?\d+(\.\d+)?(e[+-]?\d+)?$/,
];

// A money value from somewhere we can't trust (a save file): a Money, a number,
// or text like "1234.56" or "1.5e400". Anything else, NaN or Infinity → fallback.
// Saves before v8 hold plain numbers; from v8 on, text (see game.ts migrateSave).
export function moneyFrom(x: unknown, fallback: MoneyLike): Money {
  let m: Money | null = null;
  if (isMoney(x)) m = x;
  else if (typeof x === 'number' && Number.isFinite(x)) m = money(x);
  else if (typeof x === 'string' && MONEY_TEXT.some((re) => re.test(x))) m = money(x);
  return m && isFiniteMoney(m) ? m : money(fallback);
}
