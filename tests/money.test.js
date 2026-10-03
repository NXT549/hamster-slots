// money.test.js — big numbers for money (src/logic/money.ts) and how they're written
// on screen (formatCoins in src/view/dom.ts).
//
// The most important promise: for every amount a plain number can hold, the
// money helpers give EXACTLY what plain numbers gave, so the game plays the same
// to the cent. Past 1.8e308 (where a plain number is "Infinity") they keep going.

import { describe, test, expect, afterEach } from 'vitest';
import { money, moneyFrom, roundMoney, divide, power, isMoney, isFiniteMoney } from '../src/logic/money.ts';
import { createRng } from '../src/logic/rng.ts';
import { formatCoins, formatWhole, setNumberStyle } from '../src/view/dom.ts';

// Everyday amounts, the way the game makes them: cents from 0.01 to billions,
// plus multipliers and rates. A seeded RNG, so a failure can be replayed.
function samples(count = 3000, seed = 5) {
  const rng = createRng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const cents = Math.round(rng.next() * 10 ** (rng.next() * 13)) / 100; // 0 … 1e11, in cents
    const factor = rng.next() * 20; // a multiplier, a bet, a Luck bonus …
    const other = (rng.next() < 0.5 ? -1 : 1) * Math.round(rng.next() * 10 ** (rng.next() * 9)) / 100;
    out.push({ cents, factor, other });
  }
  return out;
}

describe('exactly the old answers for everyday amounts', () => {
  const all = samples();
  const same = (label, fn, old) => {
    test(label, () => {
      const wrong = all.filter((s) => fn(s).toNumber() !== old(s));
      expect(wrong.slice(0, 3)).toEqual([]);
    });
  };
  same('adding', (s) => money(s.cents).add(s.other), (s) => s.cents + s.other);
  same('subtracting', (s) => money(s.cents).sub(s.other), (s) => s.cents - s.other);
  same('multiplying', (s) => money(s.cents).mul(s.factor), (s) => s.cents * s.factor);
  same('rounding to cents', (s) => roundMoney(money(s.cents).mul(s.factor)), (s) => Math.round(s.cents * s.factor * 100) / 100);
  same('dividing', (s) => divide(s.cents, s.factor + 1), (s) => s.cents / (s.factor + 1));
  same('powers (the cost formula)', (s) => power(1 + s.factor / 100, Math.floor(s.factor * 10)), (s) => Math.pow(1 + s.factor / 100, Math.floor(s.factor * 10)));
  same('floor', (s) => money(s.cents).mul(s.factor).floor(), (s) => Math.floor(s.cents * s.factor));
  test('comparing', () => {
    const wrong = all.filter((s) => money(s.cents).gte(s.other) !== s.cents >= s.other || money(s.cents).lt(s.other) !== s.cents < s.other);
    expect(wrong).toEqual([]);
  });
  test('rounding a tiny leftover (0.3 − 0.1 − 0.2) gives 0, like before', () => {
    expect(roundMoney(money(0.3).sub(0.1).sub(0.2)).toNumber()).toBe(0);
  });
});

describe('big numbers', () => {
  test('money keeps going past 1.8e308 (a plain number would be Infinity)', () => {
    const big = money(1e308).mul(1e10);
    expect(isFiniteMoney(big)).toBe(true);
    expect(big.gt(1e308)).toBe(true);
    expect(big.toString()).toBe('1e318');
    expect(money('1e400').add('1e400').gt('1.9e400')).toBe(true);
  });
  test('rounding leaves a huge amount alone (a cent past 9e15 never shows)', () => {
    expect(roundMoney('1.5e400').eq('1.5e400')).toBe(true);
  });
  // Past plain numbers, amounts are kept to about 12 significant digits: plenty for money.
  test('dividing and powers work on huge amounts too', () => {
    expect(divide('1e400', '1e200').eq_tolerance('1e200', 1e-12)).toBe(true);
    expect(power('1e200', 2).eq_tolerance('1e400', 1e-12)).toBe(true);
    expect(power(1.15, 10000).gt(1e300)).toBe(true); // Math.pow gives Infinity here
  });
});

describe('reading money from a save', () => {
  test('numbers (saves up to v7) and text (v8) give the same amount', () => {
    for (const x of [0, 0.01, 4.05, 1234.56, 98765432.1]) {
      expect(moneyFrom(x, 0).toNumber()).toBe(x);
      expect(moneyFrom(String(x), 0).toNumber()).toBe(x);
    }
  });
  test('any amount survives the trip to text and back exactly', () => {
    const wrong = samples(2000, 9).filter((s) => {
      const m = money(s.cents).mul(s.factor);
      return !moneyFrom(m.toString(), -1).eq(m);
    });
    expect(wrong).toEqual([]);
    for (const text of ['1.5e400', '-2.5e20', 'ee15.5', '(e^6)15.2']) expect(moneyFrom(money(text).toString(), -1).eq(money(text))).toBe(true);
  });
  test('a Money is taken as it is', () => {
    const m = money(12);
    expect(moneyFrom(m, 0)).toBe(m);
    expect(isMoney(m)).toBe(true);
    expect(isMoney(12)).toBe(false);
  });
  test.each(['abc', '', ' 12', '12abc', '1,000', '0x10', 'e5', 'NaN', 'Infinity', null, undefined, {}, [], true, NaN, Infinity])(
    'junk (%s) gives the fallback',
    (x) => {
      expect(moneyFrom(x, 42).toNumber()).toBe(42);
    },
  );
});

describe('how money is written on screen', () => {
  afterEach(() => setNumberStyle('short'));

  test.each([
    [0, '0'], [4.05, '4.05'], [99.994, '99.99'], [150.7, '150'], [999.99, '999'], [1234.5, '1.23K'], [47275, '47.27K'],
    [1.5e6, '1.5M'], [2e9, '2B'], [3.456e12, '3.45T'], [999.99e12, '999.99T'], [-250, '-250'],
  ])('%s → %s (as before)', (n, text) => {
    expect(formatCoins(n)).toBe(text);
    expect(formatCoins(money(n))).toBe(text); // a Money is written the same way
  });

  // 1.8.x fix: 1,150 / 1,000 is 1.1499999… in floating point, so it was written "1.14K".
  test.each([[1150, '1.15K'], [1130, '1.13K'], [2300, '2.3K'], [2010, '2.01K'], [4.07e6, '4.07M'], [5.29e9, '5.29B']])(
    '%s → %s (no floating-point step down)',
    (n, text) => {
      expect(formatCoins(n)).toBe(text);
      expect(formatCoins(money(n))).toBe(text);
    },
  );

  test('full numbers below a million', () => {
    setNumberStyle('full');
    expect(formatCoins(47275)).toBe('47,275');
    expect(formatCoins(1.5e6)).toBe('1.5M');
  });

  test.each([
    [1e15, '1e15'], [1.23e15, '1.23e15'], [9.999e17, '9.99e17'], ['1.5e400', '1.5e400'], ['1.2345e1000', '1.23e1000'], ['1e9e15', 'ee15.954242509439325'],
  ])('from a quadrillion up: %s → %s', (x, text) => {
    expect(formatCoins(money(x))).toBe(text);
  });

  test('a plain number past 1e15 is written the same way', () => {
    expect(formatCoins(1.23e15)).toBe('1.23e15');
  });

  // Heirloom Seeds and Hamster Tokens: whole numbers, in full as before, until a quadrillion.
  test.each([
    [0, '0'], [3, '3'], [1234, '1234'], [999999999999999, '999999999999999'], [1e15, '1e15'], ['2.773500981126202e198', '2.77e198'],
  ])('seeds and tokens: %s → %s', (x, text) => {
    expect(formatWhole(money(x))).toBe(text);
  });
});
