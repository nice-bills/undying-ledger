// SPDX-License-Identifier: Apache-2.0
// In-memory, no-wallet simulator for undying.compact.
//
// It executes the REAL compiled circuits (managed/undying/contract/index.js) with
// @midnight-ntwrk/compact-runtime, exactly as the proof server would see them,
// minus the proof and the network. The unit tests and the browser demo both use
// this class. Pattern adapted from midnightntwrk/example-bboard
// contract/src/test/bboard-simulator.ts (Apache-2.0, Copyright (C) Midnight Foundation).

import {
  type CircuitContext,
  type CircuitResults,
  type Op,
  type AlignedValue,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
  CostModel,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Entry,
  type Ledger,
  type Passbook,
  ledger,
  pureCircuits,
} from './managed/undying/contract/index.js';
import { type UndyingPrivateState, ZERO_PASSBOOK, createPrivateState, witnesses } from './witnesses.js';

export const MAX_MEMBERS = 30;
export const PAGE_SIZE = 5;

/** Right-pad an ASCII domain tag to 32 bytes, like Compact's `pad(32, "...")`. */
export const pad32 = (s: string): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(s).slice(0, 32));
  return out;
};

export const DOMAINS = {
  member: pad32('undying:member'),
  secretary: pad32('undying:secretary'),
  maintainer: pad32('undying:maintainer'),
  group: pad32('undying:group'),
} as const;

export const roleKey = (domain: Uint8Array, sk: Uint8Array): Uint8Array => pureCircuits.roleKey(domain, sk);

export const randomBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
};

export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const ZERO_ENTRY: Entry = { shares: 0n, socialFund: 0n, loanIssued: 0n, loanRepaid: 0n };

/** Same arithmetic as recordMeeting, so a device can predict the new passbook. */
export const applyEntry = (pb: Passbook, e: Entry): Passbook => {
  const owed = pb.loanOutstanding + e.loanIssued;
  if (e.loanRepaid > owed) throw new Error('Repayment is larger than the loan');
  return {
    shares: pb.shares + e.shares,
    socialFund: pb.socialFund + e.socialFund,
    loanOutstanding: owed - e.loanRepaid,
  };
};

export type Device = { readonly label: string; readonly state: UndyingPrivateState };

export type GroupSetup = {
  memberSecrets: Uint8Array[];
  secretarySecret: Uint8Array;
  maintainerSecret: Uint8Array;
  groupSecret: Uint8Array;
  feeKeyTag: Uint8Array;
  graceSeconds: bigint;
  startTime: bigint;
};

/** What a public block explorer can see about one call. */
export type PublicTx = {
  seq: number;
  circuit: string;
  time: bigint;
  publicTranscript: Op<AlignedValue>[];
  gas: { readTime: bigint; computeTime: bigint; bytesWritten: bigint; bytesDeleted: bigint };
};

/** A passbook "stamp" the secretary's phone hands to one member's phone at the meeting. */
export type Stamp = { slot: bigint; version: bigint; passbook: Passbook };

export class UndyingSimulator {
  readonly contract = new Contract<UndyingPrivateState>(witnesses);
  private ctx: CircuitContext<UndyingPrivateState>;
  now: bigint;
  readonly txs: PublicTx[] = [];

  /** Deploys the contract. The secretary's device is the deployer (any device works). */
  constructor(setup: GroupSetup) {
    const count = setup.memberSecrets.length;
    if (count > MAX_MEMBERS) throw new Error(`At most ${MAX_MEMBERS} members`);
    const memberKeys = Array.from({ length: MAX_MEMBERS }, (_, i) =>
      i < count ? roleKey(DOMAINS.member, setup.memberSecrets[i]) : new Uint8Array(32),
    );
    const deployerState = createPrivateState(setup.secretarySecret, setup.groupSecret);
    const { currentPrivateState, currentContractState, currentZswapLocalState } = this.contract.initialState(
      createConstructorContext(deployerState, '0'.repeat(64)),
      memberKeys,
      BigInt(count),
      roleKey(DOMAINS.secretary, setup.secretarySecret),
      roleKey(DOMAINS.maintainer, setup.maintainerSecret),
      roleKey(DOMAINS.group, setup.groupSecret),
      setup.feeKeyTag,
      setup.graceSeconds,
      setup.startTime,
    );
    this.now = setup.startTime;
    this.ctx = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
    };
  }

  ledger(): Ledger {
    return ledger(this.ctx.currentQueryContext.state);
  }

  setTime(t: bigint): void {
    this.now = t;
  }

  advance(seconds: bigint): void {
    this.now += seconds;
  }

  /** Run one circuit as `device`. The shared ledger only changes if the circuit succeeds. */
  private run(
    device: Device,
    circuit: string,
    f: (ctx: CircuitContext<UndyingPrivateState>) => CircuitResults<UndyingPrivateState, []>,
  ): Device {
    const qc = this.ctx.currentQueryContext;
    qc.block = { ...qc.block, secondsSinceEpoch: this.now, lastBlockTime: this.now };
    const ctx: CircuitContext<UndyingPrivateState> = { ...this.ctx, currentPrivateState: device.state };
    const res = f(ctx);
    this.ctx = res.context;
    this.txs.push({
      seq: this.txs.length + 1,
      circuit,
      time: this.now,
      publicTranscript: res.proofData.publicTranscript,
      gas: res.gasCost,
    });
    return { ...device, state: res.context.currentPrivateState };
  }

  // ------------------------------------------------------------ 1. record a meeting

  /**
   * Secretary records a meeting. `entries[i]` is the line for slot i (missing = zero).
   * Every member slot is re-committed, so the chain cannot see who saved or borrowed.
   * Returns the updated secretary device and one stamp per member slot.
   */
  recordMeeting(secretary: Device, entries: Entry[]): { secretary: Device; stamps: Stamp[] } {
    const count = Number(this.ledger().memberCount);
    const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    let dev = secretary;
    const nextBooks: Record<string, Passbook> = { ...dev.state.passbooks };
    for (let p = 0; p < pages; p++) {
      const pageEntries: Entry[] = [];
      for (let j = 0; j < PAGE_SIZE; j++) {
        const slot = p * PAGE_SIZE + j;
        const e = entries[slot] ?? ZERO_ENTRY;
        pageEntries.push(e);
        nextBooks[String(slot)] = applyEntry(dev.state.passbooks[String(slot)] ?? ZERO_PASSBOOK, e);
      }
      dev = this.run(dev, 'recordMeeting', (ctx) => this.contract.impureCircuits.recordMeeting(ctx, BigInt(p), pageEntries));
    }
    // The circuit succeeded, so the predicted passbooks are now what the ledger commits to.
    dev = { ...dev, state: { ...dev.state, passbooks: nextBooks } };
    const L = this.ledger();
    const stamps: Stamp[] = [];
    for (let s = 0; s < count; s++) {
      stamps.push({ slot: BigInt(s), version: L.passbookVersion.lookup(BigInt(s)), passbook: nextBooks[String(s)] });
    }
    return { secretary: dev, stamps };
  }

  // ------------------------------------------------------------ member side

  /** A member's phone checks a stamp against the public ledger (no transaction, no fee). */
  verifyStamp(groupSecret: Uint8Array, stamp: Stamp): boolean {
    const L = this.ledger();
    if (L.passbookVersion.lookup(stamp.slot) !== stamp.version) return false;
    return pureCircuits.passbookCommitment(stamp.passbook, groupSecret, stamp.slot, stamp.version) === L.passbooks.lookup(stamp.slot);
  }

  /** Accept a verified stamp into a member's device. Throws if the secretary's stamp is wrong. */
  acceptStamp(member: Device, stamp: Stamp): Device {
    if (!this.verifyStamp(member.state.groupSecret, stamp)) throw new Error('Stamp does not match the ledger');
    return { ...member, state: { ...member.state, passbooks: { ...member.state.passbooks, [String(stamp.slot)]: stamp.passbook } } };
  }

  attestSavings(member: Device, slot: bigint, minShares: bigint, nonce: Uint8Array): Device {
    return this.run(member, 'attestSavings', (ctx) => this.contract.impureCircuits.attestSavings(ctx, slot, minShares, nonce));
  }

  /** What a loan officer checks: was "at least N shares" proven for my nonce? */
  attestation(nonce: Uint8Array): bigint | undefined {
    const id = pureCircuits.attestationId(nonce);
    const L = this.ledger();
    return L.attestations.member(id) ? L.attestations.lookup(id) : undefined;
  }

  // ------------------------------------------------------------ admin + lifecycle

  addMember(secretary: Device, memberSecret: Uint8Array): Device {
    const key = roleKey(DOMAINS.member, memberSecret);
    return this.run(secretary, 'addMember', (ctx) => this.contract.impureCircuits.addMember(ctx, key));
  }

  handoverSecretary(secretary: Device, newSecretarySecret: Uint8Array): Device {
    const key = roleKey(DOMAINS.secretary, newSecretarySecret);
    return this.run(secretary, 'handoverSecretary', (ctx) => this.contract.impureCircuits.handoverSecretary(ctx, key));
  }

  adminReplaceSecretary(maintainer: Device, newSecretarySecret: Uint8Array): Device {
    const key = roleKey(DOMAINS.secretary, newSecretarySecret);
    return this.run(maintainer, 'adminReplaceSecretary', (ctx) => this.contract.impureCircuits.adminReplaceSecretary(ctx, key));
  }

  heartbeat(maintainer: Device, at: bigint = this.now): Device {
    return this.run(maintainer, 'heartbeat', (ctx) => this.contract.impureCircuits.heartbeat(ctx, at));
  }

  sunset(anyone: Device): Device {
    return this.run(anyone, 'sunset', (ctx) => this.contract.impureCircuits.sunset(ctx));
  }

  /** A member votes for a new secretary (the candidate's secretary secret stays on the candidate's phone). */
  voteSecretary(member: Device, slot: bigint, candidateSecretarySecret: Uint8Array): Device {
    const key = roleKey(DOMAINS.secretary, candidateSecretarySecret);
    return this.run(member, 'voteSecretary', (ctx) => this.contract.impureCircuits.voteSecretary(ctx, slot, key));
  }

  /**
   * A newly elected secretary rebuilds the book from members' stamps, each checked against the
   * ledger, as members read their passbooks aloud at the first meeting with the new secretary.
   */
  rebuildFromStamps(secretary: Device, stamps: Stamp[]): Device {
    let dev = secretary;
    for (const st of stamps) dev = this.acceptStamp(dev, st);
    return dev;
  }

  rotateFeeKey(secretary: Device, newFeeKeyTag: Uint8Array): Device {
    return this.run(secretary, 'rotateFeeKey', (ctx) => this.contract.impureCircuits.rotateFeeKey(ctx, newFeeKeyTag));
  }

  /** Seconds left before anyone may call sunset (0 = sunset is open). */
  secondsUntilSunsetOpens(): bigint {
    const L = this.ledger();
    const opensAt = L.lastHeartbeat + L.graceSeconds;
    return opensAt > this.now ? opensAt - this.now : 0n;
  }
}

/** Convenience: a device for a role. */
export const device = (label: string, localSecret: Uint8Array, groupSecret: Uint8Array, passbooks: Record<string, Passbook> = {}): Device => ({
  label,
  state: createPrivateState(localSecret, groupSecret, passbooks),
});

/** A stranger's device: knows nothing about the group. */
export const strangerDevice = (label = 'stranger'): Device => device(label, randomBytes(32), randomBytes(32));
