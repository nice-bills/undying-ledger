// SPDX-License-Identifier: Apache-2.0
// Print the PUBLIC addresses of the throwaway test wallets, offline. Never prints a seed.
//
//   DEPLOYER_SEED=<64 hex> [NGO_SEED=<64 hex>] MIDNIGHT_NETWORK=preprod npm run addresses -w chain
//
// The deployer's unshielded address is where faucet tNIGHT goes. NGO_SEED is the second key that
// endows the group fee key (register-dust.ts): a NIGHT key registers to one DUST address only, so
// the deployer cannot both earn its own DUST and endow the group with the same key.
// Derivation matches FluentWalletBuilder (testkit-js 4.1.1): HD roles from the master seed.

import { DustSecretKey } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { DustAddress, createKeystore } from '@midnight-ntwrk/wallet-sdk';
import { WalletSeeds } from '@midnight-ntwrk/testkit-js';

const networkId = process.env['MIDNIGHT_NETWORK'] ?? 'preprod';

function describe(label: string, seeds: WalletSeeds): void {
  const unshielded = createKeystore(seeds.unshielded, networkId as never).getBech32Address().asString();
  const dust = DustAddress.encodePublicKey(networkId, DustSecretKey.fromSeed(seeds.dust).publicKey);
  console.log(`${label}\n  unshielded (NIGHT): ${unshielded}\n  DUST:               ${dust}`);
}

const deployer = process.env['DEPLOYER_MNEMONIC']
  ? WalletSeeds.fromMnemonic(process.env['DEPLOYER_MNEMONIC'])
  : process.env['DEPLOYER_SEED'] ? WalletSeeds.fromMasterSeed(process.env['DEPLOYER_SEED']) : undefined;
if (!deployer) throw new Error('Set DEPLOYER_SEED (64 hex) or DEPLOYER_MNEMONIC.');
describe(`deployer (${networkId})`, deployer);
if (process.env['NGO_SEED']) describe(`NGO endowment key (${networkId})`, WalletSeeds.fromMasterSeed(process.env['NGO_SEED']));
