// SPDX-License-Identifier: Apache-2.0
// Witness implementations for undying.compact.
// Pattern adapted from midnightntwrk/example-bboard contract/src/witnesses.ts
// (Apache-2.0, Copyright (C) Midnight Foundation).

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Passbook } from './managed/undying/contract/index.js';

/**
 * Everything a device keeps off-chain.
 *
 * - `localSecret`: this device's role secret (secretary, maintainer or member).
 * - `groupSecret`: shared with members inside their app; opens passbook commitments.
 * - `passbooks`: plaintext passbooks this device knows, keyed by slot.
 *   The secretary's phone knows every slot (as at a real VSLA meeting, where shares
 *   are counted aloud). A member's phone knows only its own slot ("the stamp").
 */
export type UndyingPrivateState = {
  readonly localSecret: Uint8Array;
  readonly groupSecret: Uint8Array;
  readonly passbooks: Readonly<Record<string, Passbook>>;
};

export const ZERO_PASSBOOK: Passbook = { shares: 0n, socialFund: 0n, loanOutstanding: 0n };

export const createPrivateState = (
  localSecret: Uint8Array,
  groupSecret: Uint8Array,
  passbooks: Record<string, Passbook> = {},
): UndyingPrivateState => ({ localSecret, groupSecret, passbooks });

export const witnesses = {
  localSecret: ({ privateState }: WitnessContext<Ledger, UndyingPrivateState>): [UndyingPrivateState, Uint8Array] => [
    privateState,
    privateState.localSecret,
  ],
  groupSecret: ({ privateState }: WitnessContext<Ledger, UndyingPrivateState>): [UndyingPrivateState, Uint8Array] => [
    privateState,
    privateState.groupSecret,
  ],
  passbookOf: (
    { privateState }: WitnessContext<Ledger, UndyingPrivateState>,
    slot: bigint,
  ): [UndyingPrivateState, Passbook] => [privateState, privateState.passbooks[slot.toString()] ?? ZERO_PASSBOOK],
};
