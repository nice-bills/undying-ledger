// SPDX-License-Identifier: Apache-2.0
// The no-wallet demo engine. It drives the REAL compiled Compact circuits through
// UndyingSimulator (compact-runtime in the browser), plus a fee-key model.
// Nothing here talks to a network.

import {
  UndyingSimulator,
  type Device,
  type Stamp,
  type PublicTx,
  type Entry,
  type Passbook,
  Phase,
  device,
  strangerDevice,
  randomBytes,
  toHex,
  ZERO_PASSBOOK,
} from '@undying-ledger/contract';
import { ASSUMED_FEE_DUST, FeeCommons, formatDust, KEY_SPEND_PER_CALL_DUST } from './fees';

export const SHARE_VALUE_GHS = 10;
export const SOCIAL_FUND_GHS = 2;
export const DEMO_GRACE_SECONDS = 90;
export const HEARTBEAT_EVERY_SECONDS = 30;
export const HISTORY_MEETINGS = 11; // the demo opens at meeting #12

export type Member = { name: string; slot: number; device: Device; stamps: { meeting: number; stamp: Stamp; delta: Entry }[] };

export type LogLine = {
  id: number;
  at: number; // demo seconds since start
  who: string;
  what: string;
  fee?: string;
  kind: 'ok' | 'error' | 'info';
};

export type MeetingLine = { shares: number; social: boolean; loanIssued: number; loanRepaid: number };

const toEntry = (l: MeetingLine): Entry => ({
  shares: BigInt(l.shares),
  socialFund: BigInt(l.social ? SOCIAL_FUND_GHS : 0),
  loanIssued: BigInt(l.loanIssued),
  loanRepaid: BigInt(l.loanRepaid),
});

const NAMES = ['Ama', 'Fuseina', 'Abiba', 'Memunatu', 'Rahinatu'];

// Deterministic history so every demo opens the same way.
const HISTORY: MeetingLine[][] = Array.from({ length: HISTORY_MEETINGS }, (_, m) =>
  NAMES.map((_, i) => ({
    shares: 1 + ((m + i * 2) % 4),
    social: true,
    loanIssued: m === 3 && i === 0 ? 150 : m === 6 && i === 2 ? 200 : 0,
    loanRepaid: m >= 5 && m <= 9 && i === 0 ? 25 : m >= 8 && i === 2 ? 40 : 0,
  })),
);

export const DEFAULT_NEXT_MEETING: MeetingLine[] = [
  { shares: 3, social: true, loanIssued: 0, loanRepaid: 25 },
  { shares: 2, social: true, loanIssued: 0, loanRepaid: 0 },
  { shares: 1, social: true, loanIssued: 0, loanRepaid: 40 },
  { shares: 4, social: true, loanIssued: 0, loanRepaid: 0 },
  { shares: 2, social: true, loanIssued: 100, loanRepaid: 0 },
];

export class DemoEngine {
  readonly sim: UndyingSimulator;
  readonly groupSecret = randomBytes(32);
  secretary: Device;
  readonly maintainer: Device;
  readonly members: Member[];
  readonly fees: FeeCommons;
  readonly log: LogLine[] = [];
  vendorOnline = true;
  elapsed = 0; // demo seconds
  private lastHeartbeatAt = 0;
  private logSeq = 0;
  private listeners = new Set<() => void>();
  version = 0;
  readonly startTime: bigint;

  constructor(startTime: bigint = BigInt(Math.floor(Date.now() / 1000))) {
    this.startTime = startTime;
    const memberSecrets = NAMES.map(() => randomBytes(32));
    const secretarySecret = randomBytes(32);
    const maintainerSecret = randomBytes(32);
    this.sim = new UndyingSimulator({
      memberSecrets,
      secretarySecret,
      maintainerSecret,
      groupSecret: this.groupSecret,
      feeKeyTag: randomBytes(32),
      graceSeconds: BigInt(DEMO_GRACE_SECONDS),
      startTime,
    });
    this.secretary = device('Secretary (Fuseina’s phone)', secretarySecret, this.groupSecret);
    this.maintainer = device('Vendor / NGO server', maintainerSecret, this.groupSecret);
    this.members = NAMES.map((name, slot) => ({ name, slot, device: device(name, memberSecrets[slot], this.groupSecret), stamps: [] }));
    this.fees = new FeeCommons([{ name: 'NGO endowment', night: 100, note: 'registered once, at hand-over' }]);
  }

  // ------------------------------------------------------------------ store plumbing

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private changed(): void {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  private say(who: string, what: string, kind: LogLine['kind'] = 'ok', fee?: string): void {
    this.log.unshift({ id: ++this.logSeq, at: this.elapsed, who, what, kind, fee });
    if (this.log.length > 60) this.log.pop();
  }

  private feeNote(): string {
    return `${formatDust(ASSUMED_FEE_DUST)} from group fee key #${this.fees.epoch}`;
  }

  /** Pay the fee for one transaction from the group fee key, or throw before touching the ledger. */
  private withFee<T>(txs: number, f: () => T): T {
    if (!this.fees.canPay(KEY_SPEND_PER_CALL_DUST * txs)) {
      throw new Error('The group fee key is out of DUST. It refills on its own; or rotate to a fresh key.');
    }
    const out = f();
    for (let i = 0; i < txs; i++) this.fees.pay(KEY_SPEND_PER_CALL_DUST, true);
    return out;
  }

  // ------------------------------------------------------------------ derived views

  // The ledger only changes when a transaction succeeds, but the demo clock re-renders every
  // screen each second. Reading it through the runtime on every render cost about 12% CPU on a
  // laptop and starved the circuits on a phone 6x slower, so both are cached per transaction.
  private ledgerAt = -1;
  private ledgerView: ReturnType<UndyingSimulator['ledger']> | null = null;
  private L(): ReturnType<UndyingSimulator['ledger']> {
    const n = this.sim.txs.length;
    if (n !== this.ledgerAt || !this.ledgerView) {
      this.ledgerView = this.sim.ledger();
      this.ledgerAt = n;
      this.publicAt = -1;
    }
    return this.ledgerView;
  }
  private publicAt = -1;
  private publicView: ReturnType<DemoEngine['buildPublicState']> | null = null;

  get meetingsRecorded(): number {
    return Number(this.L().meetings);
  }

  get phase(): Phase {
    return this.L().phase;
  }

  get sunsetOpensIn(): number {
    return Number(this.sim.secondsUntilSunsetOpens());
  }

  passbookOf(m: Member): Passbook {
    return m.device.state.passbooks[String(m.slot)] ?? ZERO_PASSBOOK;
  }

  /** A plausible next meeting sheet: never repays more than is owed. */
  suggestedNextMeeting(): MeetingLine[] {
    return DEFAULT_NEXT_MEETING.map((l, i) => {
      const owed = Number((this.secretary.state.passbooks[String(i)] ?? ZERO_PASSBOOK).loanOutstanding);
      const repay = Math.min(owed, l.loanRepaid > 0 ? l.loanRepaid : owed > 0 ? 20 : 0);
      return { ...l, loanRepaid: repay, loanIssued: owed > 0 ? 0 : l.loanIssued };
    });
  }

  /** The secretary's view of the whole group (known inside the group only). */
  groupTotals(): { shares: number; social: number; loans: number } {
    const books = this.secretary.state.passbooks;
    let shares = 0;
    let social = 0;
    let loans = 0;
    for (const m of this.members) {
      const b = books[String(m.slot)] ?? ZERO_PASSBOOK;
      shares += Number(b.shares);
      social += Number(b.socialFund);
      loans += Number(b.loanOutstanding);
    }
    return { shares, social, loans };
  }

  publicTxs(): PublicTx[] {
    return this.sim.txs;
  }

  publicState() {
    const L = this.L();
    if (this.publicAt !== this.ledgerAt || !this.publicView) {
      this.publicView = this.buildPublicState(L);
      this.publicAt = this.ledgerAt;
    }
    return this.publicView;
  }

  private buildPublicState(L: ReturnType<UndyingSimulator['ledger']>) {
    const slots = [...Array(Number(L.memberCount)).keys()].map((i) => ({
      slot: i,
      commitment: L.passbooks.lookup(BigInt(i)).toString(16).padStart(64, '0'),
      version: Number(L.passbookVersion.lookup(BigInt(i))),
      memberKey: toHex(L.memberKeys.lookup(BigInt(i))),
    }));
    return {
      memberCount: Number(L.memberCount),
      meetings: Number(L.meetings),
      phase: L.phase === Phase.ACTIVE ? 'ACTIVE' : 'SUNSET',
      lastHeartbeat: Number(L.lastHeartbeat - this.startTime),
      graceSeconds: Number(L.graceSeconds),
      maintainerKey: toHex(L.maintainerKey),
      secretaryKey: toHex(L.secretaryKey),
      feeKeyEpoch: Number(L.feeKeyEpoch),
      feeKeyTag: toHex(L.feeKeyTag),
      attestations: Number(L.attestations.size()),
      slots,
    };
  }

  /** An outsider (or a curious husband) tries to open Ama's slot with a guessed group secret. */
  outsiderTriesToOpen(slot: number): boolean {
    const L = this.L();
    const version = L.passbookVersion.lookup(BigInt(slot));
    // Even a guess of the exact amount fails without the group secret.
    const guess: Stamp = { slot: BigInt(slot), version, passbook: this.secretary.state.passbooks[String(slot)] ?? ZERO_PASSBOOK };
    return this.sim.verifyStamp(randomBytes(32), guess);
  }

  // ------------------------------------------------------------------ actions

  /** Replays the group's first 11 meetings so the demo opens at meeting #12. */
  seedHistory(): void {
    for (const lines of HISTORY) this.recordMeeting(lines, true);
    this.finishSeed();
  }

  /**
   * The same replay, one meeting per task, so a slow phone paints first and never freezes for
   * long. `pause` yields to the browser between meetings; `progress` gets meetings done so far.
   */
  async seedHistoryInSteps(pause: () => Promise<void>, progress?: (done: number, of: number) => void): Promise<void> {
    for (let i = 0; i < HISTORY.length; i++) {
      this.recordMeeting(HISTORY[i], true);
      progress?.(i + 1, HISTORY.length);
      await pause();
    }
    this.finishSeed();
  }

  private finishSeed(): void {
    this.log.length = 0;
    this.say('Group', `Kpalsi Women’s Group book loaded: ${HISTORY_MEETINGS} meetings, ${this.members.length} members.`, 'info');
    this.changed();
  }

  recordMeeting(lines: MeetingLine[], quiet = false): { ok: boolean; error?: string } {
    try {
      const entries = lines.map(toEntry);
      const pages = Math.max(1, Math.ceil(this.members.length / 5));
      const meetingNo = this.meetingsRecorded + 1;
      const { secretary, stamps } = this.withFee(pages, () => this.sim.recordMeeting(this.secretary, entries));
      this.secretary = secretary;
      // At the meeting, each member's phone scans its stamp and checks it against the chain.
      for (const m of this.members) {
        const stamp = stamps[m.slot];
        m.device = this.sim.acceptStamp(m.device, stamp);
        m.stamps.unshift({ meeting: meetingNo, stamp, delta: entries[m.slot] });
      }
      if (!quiet) {
        this.say(
          'Secretary',
          `Recorded meeting #${meetingNo}: ${stamps.length} passbooks re-committed; every member’s phone verified its stamp.`,
          'ok',
          this.feeNote(),
        );
        this.changed();
      }
      return { ok: true };
    } catch (e) {
      const error = (e as Error).message;
      this.say('Secretary', `Meeting not recorded: ${error}`, 'error');
      this.changed();
      return { ok: false, error };
    }
  }

  proveSavings(slot: number, minShares: number): { ok: boolean; error?: string; nonce?: string } {
    const m = this.members[slot];
    const nonce = randomBytes(32);
    try {
      m.device = this.withFee(1, () => this.sim.attestSavings(m.device, BigInt(slot), BigInt(minShares), nonce));
      this.say(m.name, `Proved “at least ${minShares} shares” to a loan officer. The amount itself stays private.`, 'ok', this.feeNote());
      this.changed();
      return { ok: true, nonce: toHex(nonce).slice(0, 12) };
    } catch (e) {
      const error = (e as Error).message;
      this.say(m.name, `Proof refused: ${error}`, 'error');
      this.changed();
      return { ok: false, error };
    }
  }

  /** Advance the demo clock. While the vendor is online its server sends heartbeats. */
  tick(seconds = 1): void {
    this.elapsed += seconds;
    this.sim.advance(BigInt(seconds));
    this.fees.regenerate(seconds);
    this.recordRotationNoteIfFunded();
    if (this.vendorOnline && this.phase === Phase.ACTIVE && this.elapsed - this.lastHeartbeatAt >= HEARTBEAT_EVERY_SECONDS) {
      try {
        this.withFee(1, () => this.sim.heartbeat(this.maintainer));
        this.lastHeartbeatAt = this.elapsed;
        this.say('Vendor server', 'Heartbeat sent.', 'info', this.feeNote());
      } catch (e) {
        this.say('Vendor server', `Heartbeat failed: ${(e as Error).message}`, 'error');
      }
    }
    this.changed();
  }

  /** Skip ahead (used for "fast-forward" buttons). Fees regenerate at the protocol rate. */
  skip(seconds: number): void {
    const alive = this.vendorOnline;
    // Jump in one step; a live vendor then sends one heartbeat for the skipped period.
    this.vendorOnline = false;
    this.tick(seconds);
    this.vendorOnline = alive;
    if (alive) {
      this.lastHeartbeatAt = this.elapsed - HEARTBEAT_EVERY_SECONDS;
      this.tick(0);
    }
  }

  grantEnds(): void {
    if (!this.vendorOnline) return;
    this.vendorOnline = false;
    this.say('Vendor', 'Grant ended. The vendor’s server is switched off; no more heartbeats.', 'info');
    this.changed();
  }

  trySunset(by = 'A passer-by'): { ok: boolean; error?: string } {
    try {
      // Anyone can pay for this call; here the passer-by uses the group fee key too.
      this.withFee(1, () => this.sim.sunset(strangerDevice(by)));
      this.say(by, 'Called sunset(). Admin-only paths are now closed for good. The group keeps its book.', 'ok', this.feeNote());
      this.changed();
      return { ok: true };
    } catch (e) {
      const error = (e as Error).message;
      this.say(by, `sunset() refused by the contract: ${error}`, 'error');
      this.changed();
      return { ok: false, error };
    }
  }

  vendorTriesAdmin(): { ok: boolean; error?: string } {
    try {
      this.withFee(1, () => this.sim.heartbeat(this.maintainer));
      this.say('Vendor server', 'Heartbeat sent.', 'info', this.feeNote());
      this.changed();
      return { ok: true };
    } catch (e) {
      const error = (e as Error).message;
      this.say('Former vendor', `Tried an admin action: ${error}`, 'error');
      this.changed();
      return { ok: false, error };
    }
  }

  addSupporter(name: string, night: number, note: string): void {
    this.fees.designate({ name, night, note });
    this.say(name, `Pointed the DUST from ${night} NIGHT at the group fee key. No money moved; the NIGHT stays theirs.`, 'info');
    this.changed();
  }

  /** Someone copies the fee key out of the app and burns fees on junk transactions. */
  /** A copied fee key can only spend DUST on fees. Real fees are tiny (1 SPECK on Preprod), but a
   *  junk transaction can overpay, so the key can still be emptied: burn up to `dust` DUST. */
  leakAndBurn(dust: number): void {
    const burned = Math.min(dust, this.fees.balance);
    if (burned > 0) this.fees.pay(burned, false);
    this.say('Someone with a copied key', `Burned ${formatDust(burned)} on junk transactions with inflated fees. They cannot move any money or NIGHT, and they cannot write to the book.`, 'error');
    this.changed();
  }

  /** Supporters re-point their DUST to a fresh key (new DUST starts at zero), then the
   *  secretary records the new key's tag on-chain, paid by the new key's first DUST. */
  rotateFeeKey(): void {
    this.fees.rotate();
    this.pendingRotationNote = true;
    this.say('Group', `Switched to group fee key #${this.fees.epoch}. Supporters re-pointed their DUST to it; it fills from zero (about a week to full).`, 'info');
    this.recordRotationNoteIfFunded();
    this.changed();
  }

  pendingRotationNote = false;

  private recordRotationNoteIfFunded(): void {
    if (!this.pendingRotationNote || !this.fees.canPay()) return;
    try {
      this.secretary = this.withFee(1, () => this.sim.rotateFeeKey(this.secretary, randomBytes(32)));
      this.pendingRotationNote = false;
      this.say('Secretary', `Recorded fee key #${this.fees.epoch} on the ledger so every member app switches.`, 'ok', this.feeNote());
    } catch (e) {
      this.say('Secretary', `Rotation note failed: ${(e as Error).message}`, 'error');
    }
  }

}
