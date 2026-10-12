// SPDX-License-Identifier: Apache-2.0
// Sync the Preprod test wallets in parallel and save their state (wallet-state.ts), so the deploy,
// register-dust, relay and measure steps start from a synced wallet instead of from genesis.
// Safe to stop and rerun: progress is saved every few minutes.
//
//   DEPLOYER_SEED=.. [NGO_SEED=..] [CALLER_SEED=..] [GROUP_FEE_KEY_SEED=..] BLOCKFROST_PROJECT_ID=.. \
//   MIDNIGHT_NETWORK=preprod npm run sync-wallets -w chain [-- deployer ngo caller feekey]

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex } from '@midnight-ntwrk/midnight-js-utils';
import { makeLogger } from '../logger.js';
import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildFeeKeyWallet } from '../fee-key-wallet.js';
import { stateSaverFor } from '../wallet-state.js';

const cfg = getConfig();
setNetworkId(cfg.networkId);
const timeout = Number(process.env['SYNC_TIMEOUT_MS'] ?? 6 * 3600_000);
const wanted = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['deployer', 'ngo', 'caller', 'feekey']);
const seeds: Record<string, string | undefined> = {
  deployer: process.env['DEPLOYER_SEED'],
  ngo: process.env['NGO_SEED'],
  caller: process.env['CALLER_SEED'],
  feekey: process.env['GROUP_FEE_KEY_SEED'],
};

async function one(label: string, seed: string): Promise<void> {
  const logger = makeLogger().child({ wallet: label });
  const t0 = Date.now();
  if (label === 'feekey') {
    const w = await buildFeeKeyWallet(cfg, fromHex(seed));
    if (w.restoredFrom) logger.info(`restored from ${w.restoredFrom}`);
    await syncWallet(logger as never, w.facade, timeout);
    await stateSaverFor(w.facade)?.();
    await w.facade.stop();
  } else {
    const w = await MidnightWalletProvider.build(logger as never, { walletNetworkId: cfg.networkId, ...cfg } as never, { kind: 'seed', value: seed });
    await w.start();
    await syncWallet(logger as never, w.wallet, timeout);
    await w.stop(); // saves
  }
  logger.info(`${label} synced and saved in ${Math.round((Date.now() - t0) / 60_000)} min`);
}

const jobs = [...wanted].filter((l) => seeds[l]).map((l) => one(l, seeds[l]!));
const results = await Promise.allSettled(jobs);
const failed = results.filter((r) => r.status === 'rejected');
for (const f of failed) console.error(String((f as PromiseRejectedResult).reason));
process.exit(failed.length ? 1 : 0);
