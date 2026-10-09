// SPDX-License-Identifier: Apache-2.0
// The full 60-second demo story, run headless against the real compiled circuits.
import { describe, it, expect } from 'vitest';
import { DemoEngine, DEFAULT_NEXT_MEETING, DEMO_GRACE_SECONDS, HISTORY_MEETINGS } from '../engine';
import { Phase } from '@undying-ledger/contract';

describe('demo story', () => {
  it('runs end to end: record, passbook, explorer, grant ends, sunset, record again', () => {
    const e = new DemoEngine(1_760_000_000n);
    e.seedHistory();
    expect(e.meetingsRecorded).toBe(HISTORY_MEETINGS);
    const fullBefore = e.fees.balance;

    // 1. secretary records meeting #12
    expect(e.recordMeeting(e.suggestedNextMeeting()).ok).toBe(true);
    expect(e.meetingsRecorded).toBe(12);
    expect(e.fees.balance).toBeLessThan(fullBefore);

    // 2. Ama's passbook matches the secretary's book and is verified against the chain
    const ama = e.members[0];
    expect(e.passbookOf(ama)).toEqual(e.secretary.state.passbooks['0']);
    expect(ama.stamps[0].meeting).toBe(12);
    expect(e.sim.verifyStamp(e.groupSecret, ama.stamps[0].stamp)).toBe(true);

    // 3. public explorer shows commitments only; outsiders cannot open Ama's slot
    const pub = e.publicState();
    expect(pub.meetings).toBe(12);
    expect(JSON.stringify(pub)).not.toMatch(/Ama/);
    expect(e.outsiderTriesToOpen(0)).toBe(false);

    // vendor heartbeats keep sunset closed
    for (let i = 0; i < 120; i++) e.tick(1);
    expect(e.trySunset().ok).toBe(false);
    expect(e.phase).toBe(Phase.ACTIVE);

    // 4. grant ends -> heartbeats stop -> after grace anyone can sunset
    e.grantEnds();
    e.skip(DEMO_GRACE_SECONDS + 1);
    expect(e.sunsetOpensIn).toBe(0);
    expect(e.trySunset('A passer-by').ok).toBe(true);
    expect(e.phase).toBe(Phase.SUNSET);
    expect(e.vendorTriesAdmin().ok).toBe(false);

    // 5. next meeting still records, fees from the group fee key
    const before = e.fees.balance;
    expect(e.recordMeeting(e.suggestedNextMeeting()).ok).toBe(true);
    expect(e.meetingsRecorded).toBe(13);
    expect(e.fees.balance).toBeLessThan(before);
    expect(e.log[0].fee).toMatch(/group fee key #1/);

    // member proves savings
    expect(e.proveSavings(0, 5).ok).toBe(true);
    expect(e.proveSavings(0, 100_000).ok).toBe(false);
  });

  it('a leaked key can drain fees but not the book; rotation recovers', () => {
    const e = new DemoEngine(1_760_000_000n);
    e.seedHistory();
    e.leakAndBurn(10_000);
    expect(e.fees.canPay()).toBe(false);
    expect(e.recordMeeting(e.suggestedNextMeeting()).ok).toBe(false);
    expect(e.meetingsRecorded).toBe(HISTORY_MEETINGS); // nothing written
    e.addSupporter('Brother in London', 20, 'test');
    e.rotateFeeKey();
    expect(e.pendingRotationNote).toBe(true);
    e.skip(24 * 3600); // one day of DUST generation
    expect(e.pendingRotationNote).toBe(false);
    expect(e.sim.ledger().feeKeyEpoch).toBe(2n);
    expect(e.recordMeeting(e.suggestedNextMeeting()).ok).toBe(true);
  });
});
