// SPDX-License-Identifier: Apache-2.0
// Deploy / join / call the Undying Ledger contract with Midnight.js 4.1.1.
// Shape adapted from midnightntwrk/example-bboard api/src/index.ts
// (Apache-2.0, Copyright (C) Midnight Foundation).
//
// NOT EXERCISED IN THIS REPO'S CI: it needs a proof server, an indexer and a
// funded/sponsored wallet. Typechecked only.

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { map, type Observable } from 'rxjs';
import {
  ledger,
  type Entry,
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
    const found = await findDeployedContract(providers, {
      contractAddress: address,
      compiledContract: makeCompiledUndying(zkConfigPath),
      privateStateId: undyingPrivateStateKey,
      initialPrivateState,
    } as never);
    return new UndyingAPI(found as unknown as DeployedUndyingContract, providers);
  }

  private async privateState(): Promise<UndyingPrivateState> {
    const ps = await this.providers.privateStateProvider.get(undyingPrivateStateKey);
    if (!ps) throw new Error('No private state for this device');
    return ps;
  }

  /** Secretary: record a meeting (one tx per page of 5 slots), then store the new passbooks locally. */
  async recordMeeting(entries: Entry[], memberCount: number): Promise<void> {
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
    }
    await this.providers.privateStateProvider.set(undyingPrivateStateKey, { ...ps, passbooks: next });
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
