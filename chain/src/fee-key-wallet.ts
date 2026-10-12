// SPDX-License-Identifier: Apache-2.0
// The group fee key's wallet: DUST from the shared fee key, shielded and unshielded sides that
// hold nothing. Used by the relay and by sync-wallets.ts (to sync it ahead of time).
//
// The "throwaway" shielded and unshielded keys are derived from the fee key seed (not random),
// so a saved sync (wallet-state.ts) restores against the same keys on the next start.

import { createHash } from 'node:crypto';
import { DustSecretKey, LedgerParameters, ZswapSecretKeys } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  DustAddress,
  DustWallet,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  ShieldedWallet,
  UnshieldedWallet,
  WalletEntrySchema,
  WalletFacade,
  createKeystore,
  mergeWalletEntries,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk';
import type { NetworkConfig } from './config.js';
import { loadWalletState, registerStateSaver, walletStateId } from './wallet-state.js';

export type FeeKeyWallet = {
  facade: WalletFacade;
  shieldedKeys: ZswapSecretKeys;
  dustKey: DustSecretKey;
  keystore: UnshieldedKeystore;
  dustAddress: string;
  restoredFrom?: string;
};

export async function buildFeeKeyWallet(cfg: NetworkConfig, feeKeySeed: Uint8Array): Promise<FeeKeyWallet> {
  const configuration = {
    indexerClientConnection: { indexerHttpUrl: cfg.indexer, indexerWsUrl: cfg.indexerWS },
    provingServerUrl: new URL(cfg.proofServer),
    networkId: cfg.networkId,
    relayURL: new URL(cfg.nodeWS),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
    costParameters: { ledgerParams: LedgerParameters.initialParameters(), additionalFeeOverhead: 1_000n, feeBlocksMargin: 5 },
  };
  const holdsNothing = createHash('sha256').update('undying-ledger/fee-key-throwaway').update(feeKeySeed).digest();
  const shieldedKeys = ZswapSecretKeys.fromSeed(holdsNothing);
  const dustKey = DustSecretKey.fromSeed(feeKeySeed);
  const keystore = createKeystore(holdsNothing, cfg.networkId as never);
  const id = walletStateId(cfg.networkId, `fee-key:${toHex(feeKeySeed)}`);
  const saved = loadWalletState(id);
  const facade = await WalletFacade.init({
    configuration: configuration as never,
    shielded: (c) => (saved ? ShieldedWallet(c).restore(saved.shielded) : ShieldedWallet(c).startWithSeed(holdsNothing)),
    unshielded: (c) => (saved ? UnshieldedWallet(c).restore(saved.unshielded) : UnshieldedWallet(c).startWithPublicKey(PublicKey.fromKeyStore(keystore))),
    dust: (c) => (saved ? DustWallet(c).restore(saved.dust) : DustWallet(c).startWithSecretKey(dustKey, LedgerParameters.initialParameters().dust)),
  });
  registerStateSaver(facade, id);
  await facade.start(shieldedKeys, dustKey);
  return {
    facade,
    shieldedKeys,
    dustKey,
    keystore,
    dustAddress: DustAddress.encodePublicKey(cfg.networkId, dustKey.publicKey),
    restoredFrom: saved?.savedAt,
  };
}
