import { describe, expect, it } from 'vitest';
import { formatGameTime, formatMinutesInWords, formatMoney } from '../../src/core/format';

describe('formatGameTime', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatGameTime(0)).toBe('0:00');
    expect(formatGameTime(999)).toBe('0:00');
    expect(formatGameTime(65_000)).toBe('1:05');
    expect(formatGameTime(59 * 60_000 + 59_999)).toBe('59:59');
  });

  it('formats from one hour as h:mm:ss', () => {
    expect(formatGameTime(3_600_000)).toBe('1:00:00');
    expect(formatGameTime(3_725_000)).toBe('1:02:05');
    expect(formatGameTime(10 * 3_600_000 + 5_000)).toBe('10:00:05');
  });

  it('clamps negative and non-finite input to 0:00', () => {
    expect(formatGameTime(-5_000)).toBe('0:00');
    expect(formatGameTime(Number.NaN)).toBe('0:00');
  });
});

describe('formatMoney', () => {
  it('prefixes $ to a floored whole number with no separators or K/M', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(145)).toBe('$145');
    expect(formatMoney(1450)).toBe('$1450');
    expect(formatMoney(2_500_000)).toBe('$2500000');
    expect(formatMoney(9.99)).toBe('$9');
  });

  it('shows $0 for non-finite or negative input and never uses exponent notation', () => {
    expect(formatMoney(Number.NaN)).toBe('$0');
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('$0');
    expect(formatMoney(-0.5)).toBe('$0');
    expect(formatMoney(-20)).toBe('$0');
    expect(formatMoney(1e21)).toBe('$1000000000000000000000');
  });
});

describe('formatMinutesInWords (Story 3.6: the old-age toast follows TUNING.oldAgeMs)', () => {
  it('spells whole minutes from one to twenty as words', () => {
    expect(formatMinutesInWords(60_000)).toBe('one minute');
    expect(formatMinutesInWords(540_000)).toBe('nine minutes');
    expect(formatMinutesInWords(1_200_000)).toBe('twenty minutes');
  });

  it('rounds to the nearest minute', () => {
    expect(formatMinutesInWords(569_999)).toBe('nine minutes');
    expect(formatMinutesInWords(570_000)).toBe('ten minutes');
  });

  it('uses digits above twenty', () => {
    expect(formatMinutesInWords(21 * 60_000)).toBe('21 minutes');
  });

  it('never says zero or less: under half a minute, negative or non-finite input reads as one minute', () => {
    expect(formatMinutesInWords(0)).toBe('one minute');
    expect(formatMinutesInWords(-60_000)).toBe('one minute');
    expect(formatMinutesInWords(Number.NaN)).toBe('one minute');
  });
});
