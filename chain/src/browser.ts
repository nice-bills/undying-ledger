// SPDX-License-Identifier: Apache-2.0
// Browser providers for Lace (Midnight dApp connector 4.x) on Preprod.
//
// Copied and adapted from midnightntwrk/example-bboard
// bboard-ui/src/contexts/BrowserDeployedBoardManager.ts (Apache-2.0,
// Copyright (C) Midnight Foundation). Changes:
//   * fee mode 'group-fee-key': Lace balances the member's own value side with
//     `payFees: false`, and the bound transaction is POSTed to a group fee-key
//     relay that adds the DUST fee (pattern from example-private-party's
//     prepareSponsoredCall / sponsorAndSubmit).
//   * fee mode 'wallet': unchanged bboard behaviour (Lace pays its own DUST).
//
// NOT EXERCISED HERE (no Lace, no proof server in the build sandbox). Typechecked only.
// Open question carried from research: whether Lace 1.36.x honours payFees:false.

import { ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  type Binding,
  type FinalizedTransaction,
  type Proof,
  type SignatureEnabled,
  Transaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { PrivateStateProvider, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import semver from 'semver';
import type { UndyingPrivateState } from '@undying-ledger/contract';
import type { PrivateStateId, UndyingCircuitKeys, UndyingProviders } from './common.js';

export type FeeMode = { kind: 'wallet' } | { kind: 'group-fee-key'; relayUrl: string };

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

type MidnightWindow = { midnight?: Record<string, unknown> };

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  const w = (globalThis as unknown as MidnightWindow).midnight;
  if (!w) return undefined;
  return Object.values(w).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      semver.satisfies((wallet as InitialAPI).apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

/** Poll for Lace for up to `ms`, then connect to `networkId` (e.g. 'preprod'). */
export async function connectToWallet(networkId: string, ms = 2_000): Promise<ConnectedAPI> {
  const start = Date.now();
  for (;;) {
    const api = getFirstCompatibleWallet();
    if (api) return api.connect(networkId);
    if (Date.now() - start > ms) throw new Error('Could not find the Midnight Lace wallet. Is the extension installed?');
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** POST a bound, fee-less transaction to the group fee-key relay. Returns the tx id. */
export async function submitViaGroupFeeKey(relayUrl: string, tx: FinalizedTransaction): Promise<TransactionId> {
  const res = await fetch(new URL('/sponsor', relayUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tx: toHex(tx.serialize()) }),
  });
  const body = (await res.json()) as { success: boolean; txId?: string; error?: string };
  if (!res.ok || !body.success || !body.txId) throw new Error(`Group fee-key relay refused: ${body.error ?? res.status}`);
  return body.txId as TransactionId;
}

export async function initializeProviders(opts: {
  networkId: string;
  zkConfigBaseUrl: string; // where keys/ and zkir/ from `compact compile` are served
  privateStateProvider: PrivateStateProvider<PrivateStateId, UndyingPrivateState>;
  feeMode: FeeMode;
}): Promise<UndyingProviders> {
  const connectedAPI = await connectToWallet(opts.networkId);
  const config = await connectedAPI.getConfiguration();
  const keyMaterialProvider = new FetchZkConfigProvider<UndyingCircuitKeys>(opts.zkConfigBaseUrl, fetch.bind(globalThis));
  const shielded = await connectedAPI.getShieldedAddresses();
  const payFees = opts.feeMode.kind === 'wallet';

  return {
    privateStateProvider: opts.privateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    // Proving must stay on the member's machine: Lace's configured prover (set it to a LOCAL
    // proof server, http://localhost:6300). Never send secretary/member proofs to a hosted prover.
    proofProvider: httpClientProofProvider(config.proverServerUri!, keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const received = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()), { payFees });
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        if (opts.feeMode.kind === 'group-fee-key') return submitViaGroupFeeKey(opts.feeMode.relayUrl, tx);
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  } as UndyingProviders;
}
