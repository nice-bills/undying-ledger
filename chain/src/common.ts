// SPDX-License-Identifier: Apache-2.0
// Types and the compiled-contract handle for Midnight.js.
// Adapted from midnightntwrk/example-bboard api/src/common-types.ts and
// contract/src/index.ts (Apache-2.0, Copyright (C) Midnight Foundation).

import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, witnesses, type UndyingPrivateState, type Witnesses } from '@undying-ledger/contract';

export const undyingPrivateStateKey = 'undyingPrivateState';
export type PrivateStateId = typeof undyingPrivateStateKey;

export type UndyingContract = Contract<UndyingPrivateState, Witnesses<UndyingPrivateState>>;
export type UndyingCircuitKeys = Exclude<keyof UndyingContract['impureCircuits'], number | symbol>;
export type UndyingProviders = MidnightProviders<UndyingCircuitKeys, PrivateStateId, UndyingPrivateState>;
export type DeployedUndyingContract = FoundContract<UndyingContract>;

/** Path (relative to the served origin / working dir) of `compact compile` output: keys/ and zkir/. */
export const makeCompiledUndying = (zkConfigPath: string) =>
  CompiledContract.make<UndyingContract>('Undying', Contract<UndyingPrivateState>).pipe(
    CompiledContract.withWitnesses(witnesses as never),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
