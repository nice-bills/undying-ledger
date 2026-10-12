// SPDX-License-Identifier: Apache-2.0
// The vendor (maintainer) checks in: heartbeat(now) pushes the sunset deadline back by the grace
// period. Then any member tries sunset() and the circuit refuses, because the vendor is still
// there. heartbeat is an admin call, so the vendor's own wallet pays its fee (the relay does not
// sponsor it). Reads the group's secrets from GROUP_JSON (written by deploy.ts with DEPLOY_OUT).
//
//   DEPLOYER_SEED=.. GROUP_JSON=.preprod/group2.json BLOCKFROST_PROJECT_ID=.. \
//   MIDNIGHT_NETWORK=preprod npm run heartbeat:preprod -w chain
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeLogger } from '../logger.js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex } from '@midnight-ntwrk/midnight-js-utils';
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
const group = JSON.parse(readFileSync(env('GROUP_JSON'), 'utf8')) as { contract: string; groupSecret: string; maintainerSecret: string; secretarySecret: string };

const wallet = await MidnightWalletProvider.build(logger as never, { walletNetworkId: cfg.networkId, ...cfg } as never, { kind: 'seed', value: env('DEPLOYER_SEED') });
await wallet.start();
await syncWallet(logger as never, wallet.wallet, 1_800_000);

const zk = new NodeZkConfigProvider<UndyingCircuitKeys>(zkConfigPath);
const providersFor = (store: string) =>
  ({
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: store,
      privateStoragePasswordProvider: () => process.env['PRIVATE_STATE_PASSWORD'] ?? 'Undying-Ledger-1!',
      accountId: wallet.getCoinPublicKey(),
    }),
    publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
    zkConfigProvider: zk,
    proofProvider: httpClientProofProvider(cfg.proofServer, zk),
    walletProvider: wallet,
    midnightProvider: wallet,
  }) as unknown as UndyingProviders;

// The vendor's phone: its local secret is the maintainer secret.
const vendor = await UndyingAPI.join(providersFor('undying-maintainer'), zkConfigPath, group.contract as never, createPrivateState(fromHex(group.maintainerSecret), fromHex(group.groupSecret)));
const before = await vendor.currentLedger();
// A little in the past, so the block-time check (no pre-paying the grace period) passes.
const now = BigInt(Math.floor(Date.now() / 1000) - 60);
if (now < before.lastHeartbeat) throw new Error('Wait a minute after the deploy: heartbeat time would go backwards');
const dustBefore = await wallet.getDustBalance();
const t0 = Date.now();
const hb = await vendor.heartbeat(now);
const seconds = (Date.now() - t0) / 1000;
const dustAfter = await wallet.getDustBalance();
const after = await vendor.currentLedger();
logger.info(`heartbeat ${hb.public.txHash}: lastHeartbeat ${before.lastHeartbeat} -> ${after.lastHeartbeat}`);

// A member tries to call sunset now. The circuit refuses before anything is proved or sent.
const member = await UndyingAPI.join(providersFor('undying-member-sunset'), zkConfigPath, group.contract as never, createPrivateState(fromHex(group.secretarySecret), fromHex(group.groupSecret)));
let refusal = '';
try {
  await member.sunset();
} catch (e) {
  refusal = String((e as Error)?.message ?? e);
}
if (!refusal) throw new Error('sunset() was accepted; expected a refusal while the vendor is checking in');
logger.info(`sunset refused: ${refusal}`);

const out = {
  contract: group.contract,
  heartbeat: { txHash: hb.public.txHash, txId: hb.public.txId, blockHeight: hb.public.blockHeight, seconds, now: now.toString() },
  lastHeartbeat: { before: before.lastHeartbeat.toString(), after: after.lastHeartbeat.toString() },
  vendorDustSpeck: { before: dustBefore.toString(), after: dustAfter.toString() },
  sunsetRefused: refusal,
  at: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
if (process.env['HEARTBEAT_OUT']) writeFileSync(process.env['HEARTBEAT_OUT'], JSON.stringify(out, null, 2) + '\n');
await wallet.stop();
process.exit(0);
