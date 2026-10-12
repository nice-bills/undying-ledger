// SPDX-License-Identifier: Apache-2.0
// Any member calls sunset() on a deployed group once the vendor has been silent for the grace
// period: the vendor (maintainer) key is erased for good and the book keeps working without it.
// Signed by CALLER_SEED (a wallet that need hold no DUST) and paid by the group fee-key relay.
//
//   CALLER_SEED=.. GROUP_CONTRACT=.. SECRETARY_SECRET=.. GROUP_SECRET=.. RELAY_URL=http://localhost:3001 \
//   BLOCKFROST_PROJECT_ID=.. MIDNIGHT_NETWORK=preprod npm run sunset:preprod -w chain
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeLogger } from '../logger.js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { createPrivateState } from '@undying-ledger/contract';
import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { UndyingAPI } from '../api.js';
import type { UndyingCircuitKeys, UndyingProviders } from '../common.js';

const logger = makeLogger();
const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const cfg = getConfig();
setNetworkId(cfg.networkId);
const zkConfigPath = path.resolve(import.meta.dirname, '../../../contract/src/managed/undying');
const relayUrl = env('RELAY_URL').replace(/\/$/, '');

const wallet = await MidnightWalletProvider.build(logger as never, { walletNetworkId: cfg.networkId, ...cfg } as never, { kind: 'seed', value: env('CALLER_SEED') });
await wallet.start();
await syncWallet(logger as never, wallet.wallet, 1_800_000);
const dustBefore = await wallet.getDustBalance();
logger.info(`Caller DUST before: ${dustBefore} SPECK`);

const zk = new NodeZkConfigProvider<UndyingCircuitKeys>(zkConfigPath);
const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'undying-sunset',
    privateStoragePasswordProvider: () => process.env['PRIVATE_STATE_PASSWORD'] ?? 'Undying-Ledger-1!',
    accountId: wallet.getCoinPublicKey(),
  }),
  publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
  zkConfigProvider: zk,
  proofProvider: httpClientProofProvider(cfg.proofServer, zk),
  walletProvider: {
    getCoinPublicKey: () => wallet.getCoinPublicKey(),
    getEncryptionPublicKey: () => wallet.getEncryptionPublicKey(),
    balanceTx: (tx: Parameters<typeof wallet.balanceOwnValueAndFinalize>[0], ttl?: Date) => wallet.balanceOwnValueAndFinalize(tx, ttl),
  },
  midnightProvider: {
    submitTx: async (tx: FinalizedTransaction): Promise<string> => {
      const res = await fetch(`${relayUrl}/sponsor`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx: toHex(tx.serialize()) }) });
      const body = (await res.json()) as { success: boolean; txId?: string; error?: string };
      if (!body.success || !body.txId) throw new Error(`Relay refused: ${body.error ?? res.status}`);
      logger.info(`Relay added the group fee and submitted ${body.txId}`);
      return body.txId;
    },
  },
} as unknown as UndyingProviders;

const state = createPrivateState(fromHex(env('SECRETARY_SECRET')), fromHex(env('GROUP_SECRET')));
const api = await UndyingAPI.join(providers, zkConfigPath, env('GROUP_CONTRACT') as never, state);
const r = await api.sunset();
const dustAfter = await wallet.getDustBalance();
const out = { sunset: { txHash: r.public.txHash, txId: r.public.txId }, callerDustSpeck: { before: dustBefore.toString(), after: dustAfter.toString() }, at: new Date().toISOString() };
console.log(JSON.stringify(out, null, 2));
if (process.env['SUNSET_OUT']) writeFileSync(process.env['SUNSET_OUT'], JSON.stringify(out, null, 2) + '\n');
await wallet.stop();
