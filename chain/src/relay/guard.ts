// SPDX-License-Identifier: Apache-2.0
// Spend guard for the group fee-key relay. The relay will pay for any member's call to the
// group's contract, so anyone who learns its URL (or the fee key) could send junk calls. At the
// fee measured on Preprod (1 SPECK a call) that cannot empty a 5 DUST tank in any useful time;
// what junk does do is tie up the relay and the key's DUST outputs so real calls fail, and
// Mainnet fees may be higher. So the relay caps how many calls it pays for, per hour and per
// day and per circuit, keeps a reserve that only meetings may spend, and reports a low tank.
// Pure and clock-injected so it can be unit-tested without a network.

export type GuardLimits = {
  /** All sponsored calls in any rolling hour. */
  perHour: number;
  /** All sponsored calls in any rolling 24 hours. */
  perDay: number;
  /** Per-circuit caps in any rolling hour; circuits not listed share `perHour` only. */
  perCircuitPerHour: Readonly<Record<string, number>>;
  /** Below this balance (SPECK) only recordMeeting is paid for, so a meeting can always be recorded. */
  reserveSpeck: bigint;
  /** Below this balance (SPECK) /health reports the tank as low. */
  lowSpeck: bigint;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Defaults sized for one group of up to 30: a meeting is six recordMeeting calls, so 18 an hour
 * allows a meeting to be retried twice; a handful of proofs, votes and admin calls on top.
 */
export const DEFAULT_LIMITS: GuardLimits = {
  perHour: 40,
  perDay: 150,
  perCircuitPerHour: { recordMeeting: 18, attestSavings: 10, voteSecretary: 30, addMember: 30, handoverSecretary: 3, rotateFeeKey: 3, sunset: 3 },
  reserveSpeck: 1_000_000n, // about 1,000 calls at the Preprod fee plus SDK overhead
  lowSpeck: 10_000_000n,
};

/** Read overrides from the environment (RELAY_MAX_PER_HOUR, RELAY_MAX_PER_DAY, RELAY_RESERVE_SPECK, RELAY_LOW_SPECK). */
export function limitsFromEnv(env: Readonly<Record<string, string | undefined>>, base: GuardLimits = DEFAULT_LIMITS): GuardLimits {
  const n = (k: string, d: number) => (env[k] ? Number(env[k]) : d);
  const b = (k: string, d: bigint) => (env[k] ? BigInt(env[k] as string) : d);
  return {
    ...base,
    perHour: n('RELAY_MAX_PER_HOUR', base.perHour),
    perDay: n('RELAY_MAX_PER_DAY', base.perDay),
    reserveSpeck: b('RELAY_RESERVE_SPECK', base.reserveSpeck),
    lowSpeck: b('RELAY_LOW_SPECK', base.lowSpeck),
  };
}

export class GuardRefusal extends Error {
  constructor(message: string, readonly retryAfterSeconds?: number) {
    super(message);
  }
}

export class SpendGuard {
  private log: { at: number; circuit: string }[] = [];

  constructor(
    readonly limits: GuardLimits = DEFAULT_LIMITS,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(t: number): void {
    this.log = this.log.filter((e) => t - e.at < DAY);
  }

  private retryAfter(t: number, window: number, entries: { at: number }[], cap: number): number {
    // the call that frees a slot is the cap-th newest inside the window
    const oldest = entries[entries.length - cap];
    return Math.max(1, Math.ceil(((oldest?.at ?? t) + window - t) / 1000));
  }

  /** Throws a GuardRefusal if paying for `circuits` (one transaction) would break a limit. */
  check(circuits: readonly string[], balanceSpeck: bigint): void {
    const t = this.now();
    this.prune(t);
    if (balanceSpeck < this.limits.reserveSpeck && circuits.some((c) => c !== 'recordMeeting')) {
      throw new GuardRefusal('The group fee key is low; it is keeping what is left for recording meetings');
    }
    const hour = this.log.filter((e) => t - e.at < HOUR);
    if (this.log.length + circuits.length > this.limits.perDay) {
      throw new GuardRefusal(`The relay pays for at most ${this.limits.perDay} calls a day`, this.retryAfter(t, DAY, this.log, this.limits.perDay));
    }
    if (hour.length + circuits.length > this.limits.perHour) {
      throw new GuardRefusal(`The relay pays for at most ${this.limits.perHour} calls an hour`, this.retryAfter(t, HOUR, hour, this.limits.perHour));
    }
    for (const c of new Set(circuits)) {
      const cap = this.limits.perCircuitPerHour[c];
      if (cap === undefined) continue;
      const same = hour.filter((e) => e.circuit === c);
      const adding = circuits.filter((x) => x === c).length;
      if (same.length + adding > cap) {
        throw new GuardRefusal(`The relay pays for at most ${cap} ${c} calls an hour`, this.retryAfter(t, HOUR, same, cap));
      }
    }
  }

  /** Count a transaction the relay has paid for. */
  record(circuits: readonly string[]): void {
    const t = this.now();
    for (const circuit of circuits) this.log.push({ at: t, circuit });
  }

  /** Calls paid for in the last hour and day, for /health. */
  usage(): { lastHour: number; lastDay: number } {
    const t = this.now();
    this.prune(t);
    return { lastHour: this.log.filter((e) => t - e.at < HOUR).length, lastDay: this.log.length };
  }
}

/** What /health says about the tank. */
export function tankStatus(balanceSpeck: bigint, limits: GuardLimits): 'ok' | 'low' | 'reserve' {
  if (balanceSpeck < limits.reserveSpeck) return 'reserve';
  if (balanceSpeck < limits.lowSpeck) return 'low';
  return 'ok';
}
