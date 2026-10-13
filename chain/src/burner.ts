// SPDX-License-Identifier: Apache-2.0
// The burner key: a member calls the group contract with NO wallet at all.
//
// A call to this contract moves no coins, so it needs no shielded or unshielded balancing and no
// signature: the member's phone proves the call, binds it, and hands it to the group fee-key
// relay, which adds the DUST fee and submits. The only keys involved are a throwaway coin and
// encryption public key that Midnight.js asks for when building the call; they come from a random
// seed made on the phone, hold nothing, and are never synced, funded or reused. Works the same in
// Node and in the browser (no extension, no wallet sync, no tokens).
import { ZswapSecretKeys, type FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { bytesToHex as toHex } from './hex.js';

export type BurnerWallet = {
  getCoinPublicKey: () => string;
  getEncryptionPublicKey: () => string;
  /** Bind the proven call as is: nothing to balance, nothing to sign. The relay adds the fee. */
  balanceTx: (tx: UnboundTransaction) => Promise<FinalizedTransaction>;
};

export function burnerWallet(seed: Uint8Array = globalThis.crypto.getRandomValues(new Uint8Array(32))): BurnerWallet {
  const keys = ZswapSecretKeys.fromSeed(seed);
  const coin = String(keys.coinPublicKey);
  const enc = String(keys.encryptionPublicKey);
  keys.clear?.();
  return {
    getCoinPublicKey: () => coin,
    getEncryptionPublicKey: () => enc,
    balanceTx: async (tx) => tx.bind() as unknown as FinalizedTransaction,
  };
}

/** Hand a bound call to the group fee-key relay; returns the transaction id it submitted. */
export async function submitThroughRelay(relayUrl: string, tx: FinalizedTransaction, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${relayUrl.replace(/\/$/, '')}/sponsor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tx: toHex(tx.serialize()) }),
  });
  let body: { success?: boolean; txId?: string; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* non-JSON answer: reported below with the status */
  }
  if (!res.ok || !body.success || !body.txId) throw new Error(`The fee-key relay refused this call: ${body.error ?? `HTTP ${res.status}`}`);
  return body.txId;
}
