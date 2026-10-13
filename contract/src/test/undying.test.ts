// SPDX-License-Identifier: Apache-2.0
// Unit tests for undying.compact, run against the compiled circuits with the
// compact-runtime simulator (pattern from midnightntwrk/example-bboard).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UndyingSimulator,
  type Device,
  type GroupSetup,
  device,
  strangerDevice,
  randomBytes,
  roleKey,
  DOMAINS,
} from '../simulator.js';
import { Phase, type Entry } from '../managed/undying/contract/index.js';

const T0 = 1_760_000_000n; // unix seconds
const GRACE = 90n; // demo grace period

const E = (shares = 0, socialFund = 0, loanIssued = 0, loanRepaid = 0): Entry => ({
  shares: BigInt(shares),
  socialFund: BigInt(socialFund),
  loanIssued: BigInt(loanIssued),
  loanRepaid: BigInt(loanRepaid),
});

type World = {
  sim: UndyingSimulator;
  setup: GroupSetup;
  secretary: Device;
  maintainer: Device;
  members: Device[];
};

const makeWorld = (memberCount = 5): World => {
  const setup: GroupSetup = {
    memberSecrets: Array.from({ length: memberCount }, () => randomBytes(32)),
    secretarySecret: randomBytes(32),
    maintainerSecret: randomBytes(32),
    groupSecret: randomBytes(32),
    feeKeyTag: randomBytes(32),
    graceSeconds: GRACE,
    startTime: T0,
  };
  const sim = new UndyingSimulator(setup);
  return {
    sim,
    setup,
    secretary: device('secretary', setup.secretarySecret, setup.groupSecret),
    maintainer: device('maintainer', setup.maintainerSecret, setup.groupSecret),
    members: setup.memberSecrets.map((s, i) => device(`member${i}`, s, setup.groupSecret)),
  };
};

/** Deep search for a number as a bigint, or as an encoded value atom (little-endian bytes), anywhere in a structure. */
const containsNumber = (haystack: unknown, n: bigint): boolean => {
  const bytes: number[] = [];
  let v = n;
  while (v > 0n) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  const needle = bytes.join(',');
  const seen = new Set<unknown>();
  const walk = (x: unknown): boolean => {
    if (x === null || x === undefined) return false;
    if (typeof x === 'bigint') return x === n;
    if (x instanceof Uint8Array) return Array.from(x).join(',') === needle;
    if (typeof x !== 'object' || seen.has(x)) return false;
    seen.add(x);
    if (x instanceof Map) return [...x.entries()].some(([k, val]) => walk(k) || walk(val));
    if (Array.isArray(x)) return x.some(walk);
    return Object.values(x as Record<string, unknown>).some(walk);
  };
  return walk(haystack);
};

const ledgerSnapshot = (sim: UndyingSimulator) => {
  const L = sim.ledger();
  return {
    memberCount: L.memberCount,
    memberKeys: [...L.memberKeys],
    passbooks: [...L.passbooks],
    versions: [...L.passbookVersion],
    secretaryKey: L.secretaryKey,
    maintainerKey: L.maintainerKey,
    groupKeyTag: L.groupKeyTag,
    meetings: L.meetings,
    lastHeartbeat: L.lastHeartbeat,
    phase: L.phase,
    feeKeyEpoch: L.feeKeyEpoch,
    feeKeyTag: L.feeKeyTag,
    attestations: [...L.attestations],
  };
};

describe('Undying Ledger: create group', () => {
  it('initialises public state with commitments only', () => {
    const { sim, setup } = makeWorld(5);
    const L = sim.ledger();
    expect(L.memberCount).toBe(5n);
    expect(L.meetings).toBe(0n);
    expect(L.phase).toBe(Phase.ACTIVE);
    expect(L.lastHeartbeat).toBe(T0);
    expect(L.graceSeconds).toBe(GRACE);
    expect(L.feeKeyEpoch).toBe(1n);
    expect(L.memberKeys.size()).toBe(5n);
    expect(L.passbooks.size()).toBe(5n); // one page of 5 slots pre-committed to zero
    expect(L.memberKeys.lookup(0n)).toEqual(roleKey(DOMAINS.member, setup.memberSecrets[0]));
    expect(L.secretaryKey).not.toEqual(setup.secretarySecret);
  });

  it('every empty passbook commitment is different (salts are per slot)', () => {
    const { sim } = makeWorld(5);
    const commits = [...sim.ledger().passbooks].map(([, c]) => c);
    expect(new Set(commits).size).toBe(5);
  });
});

describe('Undying Ledger: record a meeting', () => {
  let w: World;
  beforeEach(() => {
    w = makeWorld(5);
  });

  it('secretary records a meeting; members verify their stamps', () => {
    const { sim } = w;
    const r = sim.recordMeeting(w.secretary, [E(3, 200), E(2, 200), E(4, 200, 50_000), E(1, 200), E(5, 200)]);
    expect(sim.ledger().meetings).toBe(1n);
    expect(r.stamps).toHaveLength(5);
    expect(r.stamps[0].passbook).toEqual({ shares: 3n, socialFund: 200n, loanOutstanding: 0n });
    expect(r.stamps[2].passbook.loanOutstanding).toBe(50_000n);
    for (const s of r.stamps) expect(sim.verifyStamp(w.setup.groupSecret, s)).toBe(true);
  });

  it('balances accumulate across meetings, loans can be repaid', () => {
    const { sim } = w;
    let sec = sim.recordMeeting(w.secretary, [E(3), E(0, 0, 10_000)]).secretary;
    const r = sim.recordMeeting(sec, [E(2), E(1, 0, 0, 4_000)]);
    sec = r.secretary;
    expect(r.stamps[0].passbook.shares).toBe(5n);
    expect(r.stamps[1].passbook).toEqual({ shares: 1n, socialFund: 0n, loanOutstanding: 6_000n });
    expect(sim.ledger().meetings).toBe(2n);
    expect(sim.ledger().passbookVersion.lookup(0n)).toBe(2n);
  });

  it('every slot is re-committed every meeting, even with zero entries', () => {
    const { sim } = w;
    const commitOf = (i: number) => sim.ledger().passbooks.lookup(BigInt(i));
    const before = [0, 1, 2, 3, 4].map(commitOf);
    sim.recordMeeting(w.secretary, [E(1)]); // only slot 0 saves
    const after = [0, 1, 2, 3, 4].map(commitOf);
    for (let i = 0; i < 5; i++) expect(after[i]).not.toBe(before[i]);
    for (let i = 0; i < 5; i++) expect(sim.ledger().passbookVersion.lookup(BigInt(i))).toBe(1n);
  });

  it('rejects a recording from anyone but the secretary', () => {
    expect(() => w.sim.recordMeeting(w.members[0], [E(9)])).toThrow(/Only the group secretary/);
    expect(() => w.sim.recordMeeting(w.maintainer, [E(9)])).toThrow(/Only the group secretary/);
    expect(w.sim.ledger().meetings).toBe(0n);
  });

  it('rejects a secretary whose device has a tampered passbook (cannot silently rewrite history)', () => {
    const { sim } = w;
    const sec = sim.recordMeeting(w.secretary, [E(3)]).secretary;
    const tampered: Device = {
      ...sec,
      state: { ...sec.state, passbooks: { ...sec.state.passbooks, '0': { shares: 0n, socialFund: 0n, loanOutstanding: 0n } } },
    };
    expect(() => sim.recordMeeting(tampered, [E(1)])).toThrow(/Passbook does not match the ledger/);
  });

  it('rejects a wrong group secret', () => {
    const bad = device('secretary', w.setup.secretarySecret, randomBytes(32));
    expect(() => w.sim.recordMeeting(bad, [E(1)])).toThrow(/Wrong group secret/);
  });

  it('rejects repaying more than is owed', () => {
    expect(() => w.sim.recordMeeting(w.secretary, [E(0, 0, 0, 1)])).toThrow(/Repayment is larger/);
  });

  it('a member rejects a forged stamp', () => {
    const { sim } = w;
    const r = sim.recordMeeting(w.secretary, [E(3)]);
    const forged = { ...r.stamps[0], passbook: { ...r.stamps[0].passbook, shares: 30n } };
    expect(sim.verifyStamp(w.setup.groupSecret, forged)).toBe(false);
    expect(() => sim.acceptStamp(w.members[0], forged)).toThrow(/Stamp does not match/);
    expect(sim.verifyStamp(randomBytes(32), r.stamps[0])).toBe(false); // outsider cannot open it
  });

  it('handles a 7-member group across two pages', () => {
    const w7 = makeWorld(7);
    const r = w7.sim.recordMeeting(w7.secretary, [E(1), E(1), E(1), E(1), E(1), E(2), E(3, 0, 1000)]);
    expect(r.stamps).toHaveLength(7);
    expect(r.stamps[6].passbook).toEqual({ shares: 3n, socialFund: 0n, loanOutstanding: 1000n });
    expect(w7.sim.ledger().meetings).toBe(1n); // two txs, one meeting
    for (const s of r.stamps) expect(w7.sim.verifyStamp(w7.setup.groupSecret, s)).toBe(true);
  });

  it('a sixth member opens a new page of five empty passbooks, and the meeting spans both pages', () => {
    const w = makeWorld(5);
    expect(w.sim.ledger().passbooks.size()).toBe(5n);
    const sixth = randomBytes(32);
    w.sim.addMember(w.secretary, sixth);
    expect(w.sim.ledger().passbooks.size()).toBe(10n);
    w.sim.addMember(w.secretary, randomBytes(32)); // same page: nothing new to commit
    expect(w.sim.ledger().passbooks.size()).toBe(10n);
    const r = w.sim.recordMeeting(w.secretary, [E(1), E(1), E(1), E(1), E(1), E(4)]);
    expect(r.stamps).toHaveLength(7);
    expect(r.stamps[5].passbook.shares).toBe(4n);
    expect(w.sim.verifyStamp(w.setup.groupSecret, r.stamps[5])).toBe(true);
  });

  it('handles a full 30-member group across six pages', () => {
    const w30 = makeWorld(30);
    const entries = Array.from({ length: 30 }, (_, i) => E(1 + (i % 5)));
    const r = w30.sim.recordMeeting(w30.secretary, entries);
    expect(r.stamps).toHaveLength(30);
    expect(r.stamps[29].passbook.shares).toBe(5n);
    expect(w30.sim.ledger().meetings).toBe(1n); // six txs, one meeting
    expect(w30.sim.txs.filter((t) => t.circuit === 'recordMeeting')).toHaveLength(6);
    for (const s of r.stamps) expect(w30.sim.verifyStamp(w30.setup.groupSecret, s)).toBe(true);
  });
});

describe('Undying Ledger: member proves own passbook', () => {
  it('member attests "at least N shares" for a loan officer nonce', () => {
    const w = makeWorld(5);
    const r = w.sim.recordMeeting(w.secretary, [E(12)]);
    const ama = w.sim.acceptStamp(w.members[0], r.stamps[0]);
    const nonce = randomBytes(32);
    w.sim.attestSavings(ama, 0n, 10n, nonce);
    expect(w.sim.attestation(nonce)).toBe(10n);
    expect(w.sim.attestation(randomBytes(32))).toBeUndefined();
  });

  it('cannot over-claim, or claim someone else’s slot', () => {
    const w = makeWorld(5);
    const r = w.sim.recordMeeting(w.secretary, [E(12), E(1)]);
    const ama = w.sim.acceptStamp(w.members[0], r.stamps[0]);
    expect(() => w.sim.attestSavings(ama, 0n, 13n, randomBytes(32))).toThrow(/Not enough shares/);
    expect(() => w.sim.attestSavings(ama, 1n, 1n, randomBytes(32))).toThrow(/not the member in this slot/);
    // A member whose phone holds a fake passbook cannot prove with it.
    const liar: Device = { ...ama, state: { ...ama.state, passbooks: { '0': { shares: 99n, socialFund: 0n, loanOutstanding: 0n } } } };
    expect(() => w.sim.attestSavings(liar, 0n, 50n, randomBytes(32))).toThrow(/Passbook does not match/);
  });
});

describe('Undying Ledger: heartbeat and sunset', () => {
  it('maintainer heartbeat delays sunset; nobody else can heartbeat', () => {
    const w = makeWorld(3);
    w.sim.advance(60n);
    w.sim.heartbeat(w.maintainer);
    expect(w.sim.ledger().lastHeartbeat).toBe(T0 + 60n);
    expect(() => w.sim.heartbeat(w.secretary)).toThrow(/Only the maintainer/);
    expect(() => w.sim.heartbeat(w.maintainer, w.sim.now + 1000n)).toThrow(/in the future/);
    w.sim.advance(GRACE - 1n);
    expect(() => w.sim.sunset(strangerDevice())).toThrow(/still sending heartbeats/);
  });

  it('after the grace period ANYONE can sunset; admin paths close; recording continues', () => {
    const w = makeWorld(5);
    let sec = w.sim.recordMeeting(w.secretary, [E(3), E(2)]).secretary;
    w.sim.advance(GRACE);
    expect(w.sim.secondsUntilSunsetOpens()).toBe(0n);
    w.sim.sunset(strangerDevice('a passer-by'));
    const L = w.sim.ledger();
    expect(L.phase).toBe(Phase.SUNSET);
    expect(L.maintainerKey).toEqual(new Uint8Array(32));
    // admin-only paths are now closed
    expect(() => w.sim.heartbeat(w.maintainer)).toThrow(/admin-only paths are closed/);
    expect(() => w.sim.adminReplaceSecretary(w.maintainer, randomBytes(32))).toThrow(/admin-only paths are closed/);
    expect(() => w.sim.sunset(strangerDevice())).toThrow(/Already sunset/);
    // ...but the group keeps recording
    const r = w.sim.recordMeeting(sec, [E(1), E(1)]);
    sec = r.secretary;
    expect(w.sim.ledger().meetings).toBe(2n);
    expect(r.stamps[0].passbook.shares).toBe(4n);
    expect(w.sim.verifyStamp(w.setup.groupSecret, r.stamps[1])).toBe(true);
    // ...and group-side governance still works
    const newSecret = randomBytes(32);
    w.sim.handoverSecretary(sec, newSecret);
    const sec2 = device('new secretary', newSecret, w.setup.groupSecret, sec.state.passbooks);
    w.sim.recordMeeting(sec2, [E(1)]);
    expect(w.sim.ledger().meetings).toBe(3n);
    w.sim.addMember(sec2, randomBytes(32));
    expect(w.sim.ledger().memberCount).toBe(6n);
  });

  it('maintainer can replace a lost secretary before sunset', () => {
    const w = makeWorld(3);
    const newSecret = randomBytes(32);
    w.sim.adminReplaceSecretary(w.maintainer, newSecret);
    expect(() => w.sim.recordMeeting(w.secretary, [E(1)])).toThrow(/Only the group secretary/);
    w.sim.recordMeeting(device('replacement', newSecret, w.setup.groupSecret), [E(1)]);
    expect(w.sim.ledger().meetings).toBe(1n);
  });
});

describe('Undying Ledger: members elect a secretary', () => {
  it('after sunset, a majority of members replaces a lost secretary, who rebuilds the book from stamps', () => {
    const w = makeWorld(5);
    const r = w.sim.recordMeeting(w.secretary, [E(3), E(2), E(4, 0, 500), E(1), E(2)]);
    // each member's phone keeps its own stamp
    const members = w.members.map((m, i) => w.sim.acceptStamp(m, r.stamps[i]));
    w.sim.advance(GRACE);
    w.sim.sunset(members[1]);
    // the secretary's phone is lost; no maintainer exists any more
    expect(() => w.sim.adminReplaceSecretary(w.maintainer, randomBytes(32))).toThrow(/admin-only paths are closed/);
    const candidate = randomBytes(32);
    const before = w.sim.ledger().secretaryKey;
    w.sim.voteSecretary(members[0], 0n, candidate);
    w.sim.voteSecretary(members[1], 1n, candidate);
    expect(w.sim.ledger().secretaryKey).toEqual(before); // 2 of 5 is not a majority
    w.sim.voteSecretary(members[2], 2n, candidate);
    expect(w.sim.ledger().secretaryKey).toEqual(roleKey(DOMAINS.secretary, candidate)); // 3 of 5 decides
    expect(w.sim.ledger().recoveryRound).toBe(1n);
    // the old phone, if found, no longer works
    expect(() => w.sim.recordMeeting(w.secretary, [E(1)])).toThrow(/Only the group secretary/);
    // the new secretary collects members' stamps, each checked against the ledger, and records
    const fresh = device('elected secretary', candidate, w.setup.groupSecret);
    const sec = w.sim.rebuildFromStamps(fresh, r.stamps);
    const r2 = w.sim.recordMeeting(sec, [E(1), E(1), E(0, 0, 0, 500)]);
    expect(r2.stamps[0].passbook.shares).toBe(4n);
    expect(r2.stamps[2].passbook.loanOutstanding).toBe(0n);
    expect(w.sim.ledger().meetings).toBe(2n);
  });

  it('one vote per slot per round; votes can move; only the slot owner votes', () => {
    const w = makeWorld(5);
    const a = randomBytes(32);
    const b = randomBytes(32);
    w.sim.voteSecretary(w.members[0], 0n, a);
    expect(() => w.sim.voteSecretary(w.members[0], 0n, a)).toThrow(/already voted for that candidate/);
    expect(() => w.sim.voteSecretary(w.members[1], 0n, a)).toThrow(/not the member in this slot/);
    expect(() => w.sim.voteSecretary(strangerDevice(), 1n, a)).toThrow(/not the member in this slot/);
    expect(() => w.sim.voteSecretary(w.members[0], 7n, a)).toThrow(/No member in this slot/);
    w.sim.voteSecretary(w.members[1], 1n, a);
    // slot 0 moves its vote to b: a is back to 1 vote, so a third vote for a is not yet a majority
    w.sim.voteSecretary(w.members[0], 0n, b);
    w.sim.voteSecretary(w.members[2], 2n, a);
    expect(w.sim.ledger().secretaryKey).toEqual(roleKey(DOMAINS.secretary, w.setup.secretarySecret));
    w.sim.voteSecretary(w.members[3], 3n, a);
    expect(w.sim.ledger().secretaryKey).toEqual(roleKey(DOMAINS.secretary, a));
    // a new round: old ballots do not count towards the next election
    w.sim.voteSecretary(w.members[4], 4n, b);
    expect(w.sim.ledger().secretaryKey).toEqual(roleKey(DOMAINS.secretary, a));
  });

  it('a vote leaks no amount', () => {
    const w = makeWorld(5);
    w.sim.recordMeeting(w.secretary, [E(37, 0, 4321)]);
    w.sim.voteSecretary(w.members[0], 0n, randomBytes(32));
    const vote = w.sim.txs[w.sim.txs.length - 1];
    expect(containsNumber(vote.publicTranscript, 37n)).toBe(false);
    expect(containsNumber(vote.publicTranscript, 4321n)).toBe(false);
  });
});

describe('Undying Ledger: fee key rotation and membership', () => {
  it('secretary rotates the fee-key note (also after sunset)', () => {
    const w = makeWorld(3);
    const tag2 = randomBytes(32);
    w.sim.rotateFeeKey(w.secretary, tag2);
    expect(w.sim.ledger().feeKeyEpoch).toBe(2n);
    expect(w.sim.ledger().feeKeyTag).toEqual(tag2);
    expect(() => w.sim.rotateFeeKey(w.members[0], randomBytes(32))).toThrow(/Only the group secretary/);
    w.sim.advance(GRACE);
    w.sim.sunset(strangerDevice());
    w.sim.rotateFeeKey(w.secretary, randomBytes(32));
    expect(w.sim.ledger().feeKeyEpoch).toBe(3n);
  });

  it('group is capped at 30 members', () => {
    const w = makeWorld(29);
    w.sim.addMember(w.secretary, randomBytes(32));
    expect(() => w.sim.addMember(w.secretary, randomBytes(32))).toThrow(/Group is full/);
  });
});

describe('Undying Ledger: privacy of the raw public state', () => {
  it('no amount and no secret appears in the ledger or in any public transcript', () => {
    const w = makeWorld(5);
    // distinctive amounts that cannot collide with small counters
    const amounts = [31_337n, 48_611n, 987_654_321n, 54_321n];
    const entries = [E(31_337, 48_611), E(0, 0, 987_654_321), E(0, 0, 0, 0), E(0, 54_321)];
    const r = w.sim.recordMeeting(w.secretary, entries);
    const ama = w.sim.acceptStamp(w.members[0], r.stamps[0]);
    w.sim.attestSavings(ama, 0n, 31_000n, randomBytes(32));

    const publicView = { ledger: ledgerSnapshot(w.sim), txs: w.sim.txs.map((t) => t.publicTranscript) };
    for (const a of amounts) expect(containsNumber(publicView, a)).toBe(false);
    // the attested threshold IS public by design
    expect(containsNumber(publicView, 31_000n)).toBe(true);
    for (const secret of [w.setup.groupSecret, w.setup.secretarySecret, w.setup.maintainerSecret, ...w.setup.memberSecrets]) {
      expect(JSON.stringify(publicView, (_, v) => (v instanceof Uint8Array ? Array.from(v).join(',') : typeof v === 'bigint' ? v.toString() : v))).not.toContain(Array.from(secret).join(','));
    }
  });

  it('two groups with different balances have indistinguishable ledger shapes', () => {
    const a = makeWorld(5);
    const b = makeWorld(5);
    a.sim.recordMeeting(a.secretary, [E(1), E(1), E(1), E(1), E(1)]);
    b.sim.recordMeeting(b.secretary, [E(5, 900, 100_000), E(0), E(0), E(0), E(0)]);
    const sa = ledgerSnapshot(a.sim);
    const sb = ledgerSnapshot(b.sim);
    expect(sa.meetings).toBe(sb.meetings);
    expect(sa.versions).toEqual(sb.versions);
    expect(sa.passbooks.length).toBe(sb.passbooks.length);
    // public transcripts have the same structure (same ops, same length)
    const shape = (s: UndyingSimulator) => s.txs.map((t) => t.publicTranscript.length);
    expect(shape(a.sim)).toEqual(shape(b.sim));
  });
});
