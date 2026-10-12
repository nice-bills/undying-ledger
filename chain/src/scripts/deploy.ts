// SPDX-License-Identifier: Apache-2.0
// Deploy a demo savings group to Preprod (or local devnet) from a funded seed wallet,
// then print the group's secrets for the member apps. Provider wiring adapted from
// midnightntwrk/example-private-party src/providers.ts (Apache-2.0).
//
// NOT RUN IN THIS REPO. Needs: BLOCKFROST_PROJECT_ID (Preprod indexer/RPC moved to Blockfrost
// on 2026-10-09), docker proof server on :6300, a Preprod seed with tNIGHT
// registered for DUST (or use the group fee-key relay once one exists).
//
//   BLOCKFROST_PROJECT_ID=nightpreprod... DEPLOYER_SEED=<64 hex> npm run deploy:preprod -w chain

import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeLogger } from '../logger.js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { DustSecretKey } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { DustAddress } from '@midnight-ntwrk/wallet-sdk';
import { createPrivateState, randomBytes } from '@undying-ledger/contract';
import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet, type WalletSecret } from '../wallet.js';
import { UndyingAPI } from '../api.js';
import type { UndyingCircuitKeys, UndyingProviders } from '../common.js';

const logger = makeLogger();
// npm runs this from chain/, so resolve DEPLOY_OUT against the caller's directory, and check it
// before deploying: the secrets exist only in this process until they are written.
const deployOut = process.env['DEPLOY_OUT'] ? path.resolve(process.env['INIT_CWD'] ?? process.cwd(), process.env['DEPLOY_OUT']) : null;
if (deployOut && !existsSync(path.dirname(deployOut))) throw new Error(`DEPLOY_OUT folder does not exist: ${path.dirname(deployOut)}`);
const cfg = getConfig();
setNetworkId(cfg.networkId);
const zkConfigPath = path.resolve(import.meta.dirname, '../../../contract/src/managed/undying');

// A TEST-ONLY wallet: DEPLOYER_MNEMONIC (24 words of a throwaway Lace wallet) or DEPLOYER_SEED (64 hex).
const secret: WalletSecret = process.env['DEPLOYER_MNEMONIC']
  ? { kind: 'mnemonic', value: process.env['DEPLOYER_MNEMONIC'] }
  : { kind: 'seed', value: process.env['DEPLOYER_SEED'] ?? '' };
const wallet = await MidnightWalletProvider.build(logger as never, { walletNetworkId: cfg.networkId, ...cfg } as never, secret);
await wallet.start();
await syncWallet(logger as never, wallet.wallet, 600_000);

const zk = new NodeZkConfigProvider<UndyingCircuitKeys>(zkConfigPath);
const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'undying-secretary',
    privateStoragePasswordProvider: () => process.env['PRIVATE_STATE_PASSWORD'] ?? 'Undying-Ledger-1!',
    accountId: wallet.getCoinPublicKey(),
  }),
  publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
  zkConfigProvider: zk,
  proofProvider: httpClientProofProvider(cfg.proofServer, zk),
  walletProvider: wallet,
  midnightProvider: wallet,
} as unknown as UndyingProviders;

const memberSecrets = Array.from({ length: 5 }, () => randomBytes(32));
const secretarySecret = randomBytes(32);
const maintainerSecret = randomBytes(32);
const groupSecret = randomBytes(32);
// GROUP_FEE_KEY_SEED lets the fee key's wallet start syncing before the deploy (sync-wallets.ts).
const feeKeySeed = process.env['GROUP_FEE_KEY_SEED'] ? fromHex(process.env['GROUP_FEE_KEY_SEED']) : randomBytes(32);

const api = await UndyingAPI.deploy(providers, zkConfigPath, {
  memberSecrets,
  secretarySecret,
  maintainerSecret,
  groupSecret,
  feeKeyTag: randomBytes(32), // replace with H(fee key's DUST address) once registered
  graceSeconds: BigInt(process.env['GRACE_SECONDS'] ?? 7 * 24 * 3600),
  initialPrivateState: createPrivateState(secretarySecret, groupSecret),
});

logger.info({ contract: api.address }, 'Deployed');
// Printed ONCE for the demo. In a real group these go into each phone by QR, never to a server.
const secrets = JSON.stringify({
  contract: api.address,
  deployTxHash: api.deployed.deployTxData.public.txHash,
  deployTxId: api.deployed.deployTxData.public.txId,
  deployedAt: new Date().toISOString(),
  groupSecret: toHex(groupSecret),
  secretarySecret: toHex(secretarySecret),
  maintainerSecret: toHex(maintainerSecret),
  memberSecrets: memberSecrets.map(toHex),
  groupFeeKeySeed: toHex(feeKeySeed),
  // Register or designate tNIGHT to this address so the group fee key earns DUST (PREPROD.md step 10).
  groupFeeKeyDustAddress: DustAddress.encodePublicKey(cfg.networkId, DustSecretKey.fromSeed(feeKeySeed).publicKey),
}, null, 2);
// DEPLOY_OUT=<file> writes the secrets to a private file (mode 600) instead of the terminal.
if (deployOut) writeFileSync(deployOut, secrets + '\n', { mode: 0o600 });
else console.log(secrets);
await wallet.stop();
