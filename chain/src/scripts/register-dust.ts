// SPDX-License-Identifier: Apache-2.0
// Register tNIGHT for DUST through the wallet SDK, without Lace (Lace's "Generate tDUST" button).
//
//   self   Register the deployer's unregistered NIGHT to the deployer's own DUST address, so it
//          can pay for the deploy.
//   endow  The one-time NGO endowment: the deployer sends ENDOW_PERCENT of its NIGHT (default 50)
//          to the NGO key, and the NGO key registers that NIGHT to the GROUP FEE KEY's DUST
//          address (groupFeeKeyDustAddress in .preprod/group.json, or FEE_KEY_DUST_ADDRESS).
//          The NGO keeps the NIGHT; the DUST it generates goes to the fee key.
//
//   DEPLOYER_SEED=<64 hex> [NGO_SEED=<64 hex>] BLOCKFROST_PROJECT_ID=nightpreprod... \
//   MIDNIGHT_NETWORK=preprod npm run register-dust -w chain -- self|endow
//
// Why two keys: the ledger keeps ONE DUST address per NIGHT key (its Registration Table), so the
// deployer cannot earn its own DUST and endow the group with the same key.
// A first registration pays its own fee from the DUST the NIGHT generated so far, so we wait
// for that (waitForGeneratedDust) before submitting.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeLogger } from '../logger.js';
import { nativeToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { DustAddress, MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk/address-format';
import { getConfig } from '../config.js';
import { MidnightWalletProvider, submitWithRetry, syncWallet } from '../wallet.js';

const logger = makeLogger();
const cfg = getConfig();
setNetworkId(cfg.networkId);
const mode = process.argv[2];
if (mode !== 'self' && mode !== 'endow') throw new Error('Usage: register-dust self|endow');

const build = async (seed: string | undefined, label: string): Promise<MidnightWalletProvider> => {
  if (!seed) throw new Error(`${label} seed is not set`);
  const w = await MidnightWalletProvider.build(logger as never, { walletNetworkId: cfg.networkId, ...cfg } as never, { kind: 'seed', value: seed });
  await w.start();
  await syncWallet(logger as never, w.wallet, 600_000);
  return w;
};

const isNight = (u: { utxo: { type: string } }) => u.utxo.type === nativeToken().raw;
const night = async (w: MidnightWalletProvider) => (await w.wallet.waitForSyncedState()).unshielded.availableCoins.filter(isNight);
const total = (us: readonly { utxo: { value: bigint } }[]) => us.reduce((a, u) => a + u.utxo.value, 0n);

/** Register `w`'s unregistered NIGHT to `to` (its own DUST address if omitted); returns the tx id. */
async function register(w: MidnightWalletProvider, to?: DustAddress): Promise<string | undefined> {
  const utxos = (await night(w)).filter((u) => !u.meta.registeredForDustGeneration);
  if (utxos.length === 0) {
    logger.info('No unregistered NIGHT in this wallet; nothing to register.');
    return undefined;
  }
  logger.info(`Registering ${utxos.length} NIGHT UTXO(s), ${total(utxos)} atomic units`);
  const { fee } = await w.wallet.estimateRegistration(utxos);
  logger.info(`Registration fee ${fee} SPECK; waiting for the NIGHT to generate that much DUST`);
  await w.wallet.waitForGeneratedDust(utxos, fee, { timeoutMs: 900_000 });
  const ks = w.unshieldedKeystore;
  const recipe = await w.wallet.registerNightUtxosForDustGeneration(utxos, ks.getPublicKey(), (p) => ks.signData(p), to);
  const tx = await w.wallet.finalizeRecipe(recipe); // proves on the local proof server and binds
  const id = await submitWithRetry(w.wallet, tx, logger as never);
  logger.info(`Registration submitted: ${id}`);
  return id;
}

/** Wait until `w` sees DUST (the registration is final and generation has started). */
async function waitForDust(w: MidnightWalletProvider, label: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    const bal = await w.getDustBalance();
    if (bal > 0n) return void logger.info(`${label} DUST balance: ${bal} SPECK`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`${label} still has no DUST after 20 minutes`);
}

const deployer = await build(process.env['DEPLOYER_SEED'], 'DEPLOYER');
logger.info(`Deployer unshielded address: ${deployer.unshieldedKeystore.getBech32Address().asString()}`);

if (mode === 'self') {
  await register(deployer);
  await waitForDust(deployer, 'Deployer');
} else {
  const groupJson = path.resolve(import.meta.dirname, '../../../.preprod/group.json');
  const feeKeyAddr = process.env['FEE_KEY_DUST_ADDRESS']
    ?? (JSON.parse(readFileSync(groupJson, 'utf8')) as { groupFeeKeyDustAddress: string }).groupFeeKeyDustAddress;
  const to = MidnightBech32m.parse(feeKeyAddr).decode(DustAddress, cfg.networkId as never);
  const ngo = await build(process.env['NGO_SEED'], 'NGO');
  if ((await night(ngo)).length === 0) {
    const percent = BigInt(process.env['ENDOW_PERCENT'] ?? 50);
    const amount = (total(await night(deployer)) * percent) / 100n;
    if (amount === 0n) throw new Error('The deployer holds no NIGHT to endow with');
    const ngoAddr = MidnightBech32m.parse(ngo.unshieldedKeystore.getBech32Address().asString()).decode(UnshieldedAddress, cfg.networkId as never);
    logger.info(`Sending ${amount} atomic NIGHT (${percent}%) from the deployer to the NGO key`);
    logger.info(`Transfer submitted: ${await deployer.transferNight(ngoAddr, amount)}`);
    for (let i = 0; i < 90 && (await night(ngo)).length === 0; i++) await new Promise((r) => setTimeout(r, 10_000));
    if ((await night(ngo)).length === 0) throw new Error('The NGO key has not received the NIGHT after 15 minutes');
  }
  logger.info(`Registering the NGO's NIGHT to the group fee key: ${feeKeyAddr}`);
  await register(ngo, to);
  await ngo.stop();
}
await deployer.stop();
