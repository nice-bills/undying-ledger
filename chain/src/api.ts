// SPDX-License-Identifier: Apache-2.0
// Deploy / join / call the Undying Ledger contract with Midnight.js 4.1.1.
// Shape adapted from midnightntwrk/example-bboard api/src/index.ts
// (Apache-2.0, Copyright (C) Midnight Foundation).
//
// NOT RUN AGAINST PREPROD: it needs a proof server, an indexer and a funded or sponsored wallet.
// Typechecked, and unit-tested with mocked providers (ui/src/lace/__tests__/live-session.test.ts).

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { map, type Observable } from 'rxjs';
import {
  ledger,
  pureCircuits,
  type Entry,
  type Passbook,
  type Ledger,
  type UndyingPrivateState,
  DOMAINS,
  MAX_MEMBERS,
  PAGE_SIZE,
  applyEntry,
  roleKey,
  ZERO_ENTRY,
  ZERO_PASSBOOK,
} from '@undying-ledger/contract';
import {
  makeCompiledUndying,
  undyingPrivateStateKey,
  type DeployedUndyingContract,
  type UndyingProviders,
} from './common.js';
import { LiveError } from './errors.js';

/** How long join waits for the indexer to say whether a contract exists. */
export const CONTRACT_LOOKUP_MS = 25_000;

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A passbook line a secretary hands a member after a meeting ("the stamp"), as one line of text. */
export const formatStamp = (slot: number, pb: Passbook): string =>
  `undying-stamp:${slot}:${pb.shares}:${pb.socialFund}:${pb.loanOutstanding}`;

export function parseStamp(text: string): { slot: number; passbook: Passbook } {
  const m = /^undying-stamp:(\d{1,2}):(\d+):(\d+):(\d+)$/.exec(text.trim());
  if (!m) throw new LiveError('bad-input', 'That is not a passbook stamp. It looks like undying-stamp:0:29:4:0 and comes from the secretary after a meeting.');
  return { slot: Number(m[1]), passbook: { shares: BigInt(m[2]), socialFund: BigInt(m[3]), loanOutstanding: BigInt(m[4]) } };
}

export type OpenedPassbook = {
  slot: number;
  passbook: Passbook;
  /** Whether this device's copy opens the sealed commitment on the ledger right now. */
  matchesLedger: boolean;
  version: number;
  meetings: number;
};

export type GroupDeployParams = {
  memberSecrets: Uint8Array[];
  secretarySecret: Uint8Array;
  maintainerSecret: Uint8Array;
  groupSecret: Uint8Array;
  feeKeyTag: Uint8Array;
  graceSeconds: bigint;
  /** This device's private state (e.g. the secretary's). */
  initialPrivateState: UndyingPrivateState;
};

export class UndyingAPI {
  readonly address: ContractAddress;
  readonly ledger$: Observable<Ledger>;

  private constructor(
    readonly deployed: DeployedUndyingContract,
    private readonly providers: UndyingProviders,
  ) {
    this.address = deployed.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.address);
    this.ledger$ = providers.publicDataProvider
      .contractStateObservable(this.address, { type: 'latest' })
      .pipe(map((s) => ledger(s.data)));
  }

  static async deploy(providers: UndyingProviders, zkConfigPath: string, p: GroupDeployParams): Promise<UndyingAPI> {
    const count = p.memberSecrets.length;
    const memberKeys = Array.from({ length: MAX_MEMBERS }, (_, i) =>
      i < count ? roleKey(DOMAINS.member, p.memberSecrets[i]) : new Uint8Array(32),
    );
    const deployed = await deployContract(providers, {
      compiledContract: makeCompiledUndying(zkConfigPath),
      privateStateId: undyingPrivateStateKey,
      initialPrivateState: p.initialPrivateState,
      args: [
        memberKeys,
        BigInt(count),
        roleKey(DOMAINS.secretary, p.secretarySecret),
        roleKey(DOMAINS.maintainer, p.maintainerSecret),
        roleKey(DOMAINS.group, p.groupSecret),
        p.feeKeyTag,
        p.graceSeconds,
        BigInt(Math.floor(Date.now() / 1000)),
      ],
    } as never);
    return new UndyingAPI(deployed as unknown as DeployedUndyingContract, providers);
  }

  static async join(
    providers: UndyingProviders,
    zkConfigPath: string,
    address: ContractAddress,
    initialPrivateState: UndyingPrivateState,
  ): Promise<UndyingAPI> {
    // findDeployedContract waits for the deploy tx forever if the address is wrong; ask first.
    const state = await Promise.race([
      providers.publicDataProvider.queryContractState(address),
      new Promise<null>((r) => setTimeout(() => r(null), CONTRACT_LOOKUP_MS)),
    ]);
    if (!state) {
      throw new LiveError('contract-not-found', `No Undying Ledger contract at ${address} on this network (or the indexer did not answer in ${CONTRACT_LOOKUP_MS / 1000} s). Check the address from .preprod/group.json.`);
    }
    // Keep the passbooks this device already holds for the same secrets; a re-join must not wipe them.
    providers.privateStateProvider.setContractAddress(address);
    const stored = await providers.privateStateProvider.get(undyingPrivateStateKey);
    const keep =
      stored && sameBytes(stored.localSecret, initialPrivateState.localSecret) && sameBytes(stored.groupSecret, initialPrivateState.groupSecret);
    const found = await findDeployedContract(providers, {
      contractAddress: address,
      compiledContract: makeCompiledUndying(zkConfigPath),
      privateStateId: undyingPrivateStateKey,
      ...(keep ? {} : { initialPrivateState }),
    } as never);
    return new UndyingAPI(found as unknown as DeployedUndyingContract, providers);
  }

  /** The current public ledger, read once from the indexer. */
  async currentLedger(): Promise<Ledger> {
    const s = await this.providers.publicDataProvider.queryContractState(this.address);
    if (!s) throw new LiveError('contract-not-found', `The indexer no longer returns contract ${this.address}.`);
    return ledger(s.data);
  }

  /** Does `pb` open slot `slot`'s sealed commitment on `L`? Checked locally with the pure circuit. */
  static opens(L: Ledger, groupSecret: Uint8Array, slot: number, pb: Passbook): boolean {
    const s = BigInt(slot);
    if (!L.passbooks.member(s)) return false;
    const version = L.passbookVersion.lookup(s);
    return pureCircuits.passbookCommitment(pb, groupSecret, s, version) === L.passbooks.lookup(s);
  }

  /** A member opens their own passbook from this device's private state and checks it against the book. */
  async openOwnPassbook(slot: number): Promise<OpenedPassbook> {
    const ps = await this.privateState();
    const L = await this.currentLedger();
    if (slot < 0 || slot >= Number(L.memberCount)) throw new LiveError('bad-input', `Slot ${slot} is not in this group (it has ${L.memberCount} members).`);
    const passbook = ps.passbooks[String(slot)] ?? ZERO_PASSBOOK;
    return {
      slot,
      passbook,
      matchesLedger: UndyingAPI.opens(L, ps.groupSecret, slot, passbook),
      version: Number(L.passbookVersion.lookup(BigInt(slot))),
      meetings: Number(L.meetings),
    };
  }

  /** Keep a stamp from the secretary, but only if it opens the sealed line on the book. */
  async importStamp(text: string): Promise<OpenedPassbook> {
    const { slot, passbook } = parseStamp(text);
    const ps = await this.privateState();
    const L = await this.currentLedger();
    if (!UndyingAPI.opens(L, ps.groupSecret, slot, passbook)) {
      throw new LiveError('bad-input', `That stamp does not open slot ${slot}'s sealed line on the book. Ask the secretary for the stamp from the latest meeting.`);
    }
    await this.providers.privateStateProvider.set(undyingPrivateStateKey, { ...ps, passbooks: { ...ps.passbooks, [String(slot)]: passbook } });
    return { slot, passbook, matchesLedger: true, version: Number(L.passbookVersion.lookup(BigInt(slot))), meetings: Number(L.meetings) };
  }

  private async privateState(): Promise<UndyingPrivateState> {
    const ps = await this.providers.privateStateProvider.get(undyingPrivateStateKey);
    if (!ps) throw new Error('No private state for this device');
    return ps;
  }

  /**
   * Secretary: record a meeting (one tx per page of 5 slots), then store the new passbooks locally.
   * Returns one stamp per member slot for the secretary to hand out.
   */
  async recordMeeting(entries: Entry[], memberCount: number): Promise<string[]> {
    const ps = await this.privateState();
    const next = { ...ps.passbooks };
    const pages = Math.max(1, Math.ceil(memberCount / PAGE_SIZE));
    for (let p = 0; p < pages; p++) {
      const page: Entry[] = [];
      for (let j = 0; j < PAGE_SIZE; j++) {
        const slot = p * PAGE_SIZE + j;
        const e = entries[slot] ?? ZERO_ENTRY;
        page.push(e);
        next[String(slot)] = applyEntry(ps.passbooks[String(slot)] ?? ZERO_PASSBOOK, e);
      }
      await this.deployed.callTx.recordMeeting(BigInt(p), page);
      // save after every confirmed page, so a failure on page 2 leaves page 1's passbooks right
      await this.providers.privateStateProvider.set(undyingPrivateStateKey, { ...ps, passbooks: { ...next } });
    }
    return Array.from({ length: memberCount }, (_, slot) => formatStamp(slot, next[String(slot)] ?? ZERO_PASSBOOK));
  }

  attestSavings(slot: bigint, minShares: bigint, nonce: Uint8Array) {
    return this.deployed.callTx.attestSavings(slot, minShares, nonce);
  }
  addMember(memberKey: Uint8Array) {
    return this.deployed.callTx.addMember(memberKey);
  }
  handoverSecretary(newKey: Uint8Array) {
    return this.deployed.callTx.handoverSecretary(newKey);
  }
  /** A member votes for a new secretary key; a majority of members elects her (works after sunset). */
  voteSecretary(slot: bigint, candidateKey: Uint8Array) {
    return this.deployed.callTx.voteSecretary(slot, candidateKey);
  }
  adminReplaceSecretary(newKey: Uint8Array) {
    return this.deployed.callTx.adminReplaceSecretary(newKey);
  }
  heartbeat(nowSeconds: bigint) {
    return this.deployed.callTx.heartbeat(nowSeconds);
  }
  sunset() {
    return this.deployed.callTx.sunset();
  }
  rotateFeeKey(tag: Uint8Array) {
    return this.deployed.callTx.rotateFeeKey(tag);
  }
}
