// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMITS, GuardRefusal, SpendGuard, limitsFromEnv, tankStatus, type GuardLimits } from '../guard.js';

const FULL = 10n ** 15n; // 1 DUST in SPECK
const clock = (start = 0) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe('relay spend guard', () => {
  it('pays for a full 30-member meeting (six pages) and then caps further meetings in the hour', () => {
    const c = clock();
    const g = new SpendGuard(DEFAULT_LIMITS, c.now);
    for (let m = 0; m < 3; m++) for (let p = 0; p < 6; p++) {
      g.check(['recordMeeting'], FULL);
      g.record(['recordMeeting']);
    }
    expect(() => g.check(['recordMeeting'], FULL)).toThrow(/at most 18 recordMeeting calls an hour/);
    c.advance(3_600_000);
    expect(() => g.check(['recordMeeting'], FULL)).not.toThrow();
  });

  it('caps junk calls per circuit and tells the caller when to retry', () => {
    const c = clock();
    const g = new SpendGuard(DEFAULT_LIMITS, c.now);
    for (let i = 0; i < 10; i++) {
      g.check(['attestSavings'], FULL);
      g.record(['attestSavings']);
      c.advance(60_000);
    }
    let err: unknown;
    try {
      g.check(['attestSavings'], FULL);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GuardRefusal);
    // the first of the ten was 10 minutes ago, so a slot frees in 50 minutes
    expect((err as GuardRefusal).retryAfterSeconds).toBe(50 * 60);
    // other circuits are still paid for
    expect(() => g.check(['recordMeeting'], FULL)).not.toThrow();
  });

  it('enforces the hourly and daily totals across circuits', () => {
    const limits: GuardLimits = { ...DEFAULT_LIMITS, perHour: 5, perDay: 8, perCircuitPerHour: {} };
    const c = clock();
    const g = new SpendGuard(limits, c.now);
    for (let i = 0; i < 5; i++) g.record(['addMember']);
    expect(() => g.check(['addMember'], FULL)).toThrow(/5 calls an hour/);
    c.advance(3_600_000);
    for (let i = 0; i < 3; i++) g.record(['addMember']);
    expect(() => g.check(['addMember'], FULL)).toThrow(/8 calls a day/);
    c.advance(24 * 3_600_000);
    expect(g.usage()).toEqual({ lastHour: 0, lastDay: 0 });
    expect(() => g.check(['addMember'], FULL)).not.toThrow();
  });

  it('keeps the last of the tank for meetings', () => {
    const g = new SpendGuard(DEFAULT_LIMITS, () => 0);
    const low = DEFAULT_LIMITS.reserveSpeck - 1n;
    expect(() => g.check(['attestSavings'], low)).toThrow(/keeping what is left for recording meetings/);
    expect(() => g.check(['recordMeeting'], low)).not.toThrow();
    expect(tankStatus(low, DEFAULT_LIMITS)).toBe('reserve');
    expect(tankStatus(DEFAULT_LIMITS.lowSpeck - 1n, DEFAULT_LIMITS)).toBe('low');
    expect(tankStatus(FULL, DEFAULT_LIMITS)).toBe('ok');
  });

  it('reads limits from the environment', () => {
    const l = limitsFromEnv({ RELAY_MAX_PER_HOUR: '7', RELAY_RESERVE_SPECK: '42' });
    expect(l.perHour).toBe(7);
    expect(l.reserveSpeck).toBe(42n);
    expect(l.perDay).toBe(DEFAULT_LIMITS.perDay);
  });
});
