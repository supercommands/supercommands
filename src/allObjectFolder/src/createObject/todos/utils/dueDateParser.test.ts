import { parseDueDateInput, parseClock } from './dueDateParser';

declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('dueDateParser', () => {
  const frozenNow = new Date(2026, 6, 23, 14, 0, 0); // 2026-07-23 14:00

  test('parses empty input', () => {
    const res = parseDueDateInput('', { now: frozenNow });
    expect(res.valid).toBe(false);
  });

  test('parses tomorrow without time', () => {
    const res = parseDueDateInput('tomorrow', { now: frozenNow, timezone: 'Asia/Kolkata' });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-24');
      expect(res.value.time).toBe(null);
    }
  });

  test('parses tomorrow with time', () => {
    const res = parseDueDateInput('tomorrow at 9 AM', { now: frozenNow, timezone: 'Asia/Kolkata' });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-24');
      expect(res.value.time).toBe('09:00');
    }
  });

  test('parses relative days e.g., 3 days, 3day', () => {
    const res1 = parseDueDateInput('3 days', { now: frozenNow });
    expect(res1.valid).toBe(true);
    if (res1.valid) {
      expect(res1.value.date).toBe('2026-07-26');
      expect(res1.value.time).toBe(null);
    }

    const res2 = parseDueDateInput('3day', { now: frozenNow });
    expect(res2.valid).toBe(true);
    if (res2.valid) {
      expect(res2.value.date).toBe('2026-07-26');
      expect(res2.value.time).toBe(null);
    }

    const res3 = parseDueDateInput('4days', { now: frozenNow });
    expect(res3.valid).toBe(true);
    if (res3.valid) {
      expect(res3.value.date).toBe('2026-07-27');
      expect(res3.value.time).toBe(null);
    }
  });

  test('parses relative word numbers e.g., two days, three days, five days, seven days', () => {
    const resTwo = parseDueDateInput('two days', { now: frozenNow });
    expect(resTwo.valid).toBe(true);
    if (resTwo.valid) {
      expect(resTwo.value.date).toBe('2026-07-25');
    }

    const resThree = parseDueDateInput('three days', { now: frozenNow });
    expect(resThree.valid).toBe(true);
    if (resThree.valid) {
      expect(resThree.value.date).toBe('2026-07-26');
    }

    const resFive = parseDueDateInput('five days', { now: frozenNow });
    expect(resFive.valid).toBe(true);
    if (resFive.valid) {
      expect(resFive.value.date).toBe('2026-07-28');
    }

    const resSeven = parseDueDateInput('seven days', { now: frozenNow });
    expect(resSeven.valid).toBe(true);
    if (resSeven.valid) {
      expect(resSeven.value.date).toBe('2026-07-30');
    }
  });

  test('parses relative days with combined time e.g., 6days 3pm', () => {
    const res = parseDueDateInput('6days 3pm', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-29');
      expect(res.value.time).toBe('15:00');
    }
  });

  test('parses 5th july 2026 (spaced ordinal date)', () => {
    const res = parseDueDateInput('5th july 2026', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-05');
      expect(res.value.time).toBe(null);
    }
  });

  test('parses 28thjuly2026 (unspaced absolute date)', () => {
    const res = parseDueDateInput('28thjuly2026', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-28');
      expect(res.value.time).toBe(null);
    }
  });

  test('parses 27 july 26 (2-digit year)', () => {
    const res = parseDueDateInput('27 july 26', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-27');
      expect(res.value.time).toBe(null);
    }
  });

  test('parses 26th June 2027 (absolute date with ordinal suffix and year)', () => {
    const res = parseDueDateInput('26th June 2027', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2027-06-26');
      expect(res.value.time).toBe(null);
    }
  });

  test('parses 25 July 2026 2:00 PM (absolute date + 12-hour time)', () => {
    const res = parseDueDateInput('25 July 2026 2:00 PM', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-25');
      expect(res.value.time).toBe('14:00');
    }
  });

  test('parses 25 Jul 2026 2pm (absolute date + compact time)', () => {
    const res = parseDueDateInput('25 Jul 2026 2pm', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-25');
      expect(res.value.time).toBe('14:00');
    }
  });

  test('parses 2026-07-25 14:00 (ISO date + 24-hour time)', () => {
    const res = parseDueDateInput('2026-07-25 14:00', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-25');
      expect(res.value.time).toBe('14:00');
    }
  });

  test('parses 24h', () => {
    const res = parseDueDateInput('24h', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2026-07-24');
      expect(res.value.time).toBe('14:00');
    }
  });

  test('parses Feb 9', () => {
    const res = parseDueDateInput('Feb 9', { now: frozenNow });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.value.date).toBe('2027-02-09');
      expect(res.value.time).toBe(null);
    }
  });

  test('rejects invalid date e.g., Feb 30', () => {
    const res = parseDueDateInput('Feb 30', { now: frozenNow });
    expect(res.valid).toBe(false);
  });

  test('rejects invalid time e.g., 25:00', () => {
    const res = parseDueDateInput('tomorrow at 25:00', { now: frozenNow });
    expect(res.valid).toBe(false);
  });

  test('parses clock times 12 AM and 12 PM', () => {
    expect(parseClock('12 AM')).toEqual({ valid: true, time: '00:00' });
    expect(parseClock('12 PM')).toEqual({ valid: true, time: '12:00' });
    expect(parseClock('2:30 PM')).toEqual({ valid: true, time: '14:30' });
  });
});
