// Copied unchanged in substance from midnightntwrk/example-private-party (Apache-2.0).
// This file is part of example-private-party.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  nativeToken,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  type MidnightProvider,
  type UnboundTransaction,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import {
  DustWallet,
  InMemoryTransactionHistoryStorage,
  ShieldedWallet,
  UnshieldedWallet,
  WalletEntrySchema,
  WalletFacade,
  mergeWalletEntries,
  type FacadeState,
  type UnshieldedAddress,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk';
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from '@midnight-ntwrk/testkit-js';
import * as Rx from 'rxjs';
import type { Logger } from 'pino';
import { loadWalletState, registerStateSaver, stateSaverFor, walletStateId } from './wallet-state.js';

/**
 * Submit, retrying when the node's websocket drops mid-submission. Blockfrost's Preprod RPC
 * closes its websockets from time to time ("1000 Normal Closure"); on 12 Oct 2026 one close
 * killed a registration in flight. A retry of a transaction that did land fails with a
 * duplicate or a spent input, which the caller sees as an error to check, never a double spend.
 */
export async function submitWithRetry(
  facade: WalletFacade,
  tx: FinalizedTransaction,
  logger?: Pick<Logger, 'warn'>,
  attempts = 3,
): Promise<string> {
  for (let i = 1; ; i++) {
    try {
      return await facade.submitTransaction(tx);
    } catch (e) {
      const msg = String((e as { cause?: unknown })?.cause ?? e) + String(e);
      if (i >= attempts || !/disconnected|Normal Closure|socket|ECONNRESET/i.test(msg)) throw e;
      logger?.warn(`Submission interrupted by a dropped connection (attempt ${i}); retrying in ${3 * i} s`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}

export type WalletSecret =
  | { kind: 'seed'; value: string }
  | { kind: 'mnemonic'; value: string };

export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  readonly wallet: WalletFacade;
  readonly unshieldedKeystore: UnshieldedKeystore;

  private constructor(
    private readonly logger: Logger,
    private readonly env: EnvironmentConfiguration,
    wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    unshieldedKeystore: UnshieldedKeystore,
  ) {
    this.wallet = wallet;
    this.unshieldedKeystore = unshieldedKeystore;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl },
    );
    const signed = await this.wallet.signRecipe(
      recipe,
      (payload) => this.unshieldedKeystore.signData(payload),
    );
    return await this.wallet.finalizeRecipe(signed);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return submitWithRetry(this.wallet, tx, this.logger);
  }

  /**
   * USER SIDE of fee sponsorship.
   *
   * Balances only the caller's OWN value side — shielded and unshielded — and
   * deliberately NOT dust, then signs and finalizes (binds) the transaction.
   *
   * Finalizing here is the security-relevant step: the returned transaction is
   * bound and signed by this wallet, so a sponsor receiving it can only ADD a
   * DUST fee offer. It cannot change what the transaction does.
   */
  async balanceOwnValueAndFinalize(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl, tokenKindsToBalance: ['shielded', 'unshielded'] },
    );
    const signed = await this.wallet.signRecipe(
      recipe,
      (payload) => this.unshieldedKeystore.signData(payload),
    );
    return await this.wallet.finalizeRecipe(signed);
  }

  /**
   * SPONSOR SIDE of fee sponsorship.
   *
   * Takes a transaction the user has already proven, balanced, signed and bound,
   * and attaches ONLY a DUST fee offer paid by this wallet. The user's proof and
   * private inputs are never touched — this wallet has no way to read them.
   */
  async addDustFeesAndFinalize(
    tx: FinalizedTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceFinalizedTransaction(
      tx,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl, tokenKindsToBalance: ['dust'] },
    );
    const signed = await this.wallet.signRecipe(
      recipe,
      (payload) => this.unshieldedKeystore.signData(payload),
    );
    return await this.wallet.finalizeRecipe(signed);
  }

  /**
   * Current DUST balance at `now`, in SPECK (the atomic unit of DUST).
   *
   * Zero means this wallet cannot pay a fee for any transaction, no matter how
   * much NIGHT it holds — which is exactly the condition fee sponsorship solves.
   */
  async getDustBalance(): Promise<bigint> {
    const state = await this.wallet.waitForSyncedState();
    return state.dust.balance(new Date());
  }

  /**
   * Sends unshielded NIGHT to another wallet, paying this wallet's own fees.
   *
   * Whether the NIGHT sent here goes on to generate DUST depends entirely on the
   * RECIPIENT's key: the ledger creates a DUST UTXO only when a NIGHT UTXO is
   * created under a key that already has an entry in its Registration Table. So an
   * unregistered recipient ends up holding NIGHT while still having zero DUST —
   * which is exactly the precondition the sponsorship demo needs.
   */
  async transferNight(
    to: UnshieldedAddress,
    amount: bigint,
    ttl: Date = ttlOneHour(),
  ): Promise<string> {
    const recipe = await this.wallet.transferTransaction(
      [
        {
          type: 'unshielded',
          outputs: [{ type: nativeToken().raw, receiverAddress: to, amount }],
        },
      ],
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl },
    );
    const signed = await this.wallet.signRecipe(
      recipe,
      (payload) => this.unshieldedKeystore.signData(payload),
    );
    const finalized = await this.wallet.finalizeRecipe(signed);
    return await submitWithRetry(this.wallet, finalized, this.logger);
  }

  async start(): Promise<void> {
    this.logger.info('Starting wallet...');
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    await stateSaverFor(this.wallet)?.().catch((e: unknown) => this.logger.warn(`Could not save wallet state: ${String(e)}`));
    return this.wallet.stop();
  }

  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    secret: WalletSecret,
  ): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };

    const base = FluentWalletBuilder.forEnvironment(env)
      .withDustOptions(dustOptions);
    const builder =
      secret.kind === 'mnemonic'
        ? base.withMnemonic(secret.value)
        : base.withSeed(secret.value);

    const buildResult = await builder.buildWithoutStarting();
    const { wallet: fresh, seeds, keystore } = buildResult as {
      wallet: WalletFacade;
      seeds: {
        masterSeed: string;
        shielded: Uint8Array;
        unshielded: Uint8Array;
        dust: Uint8Array;
      };
      keystore: UnshieldedKeystore;
    };

    // Resume from a saved sync if there is one (wallet-state.ts); otherwise start from genesis.
    const stateId = walletStateId(env.walletNetworkId, seeds.masterSeed);
    const saved = loadWalletState(stateId);
    let wallet = fresh;
    if (saved) {
      const configuration = {
        indexerClientConnection: { indexerHttpUrl: env.indexer, indexerWsUrl: env.indexerWS },
        provingServerUrl: new URL(env.proofServer),
        networkId: env.walletNetworkId,
        relayURL: new URL(env.nodeWS),
        txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
        costParameters: dustOptions,
      };
      try {
        wallet = await WalletFacade.init({
          configuration: configuration as never,
          shielded: (c) => ShieldedWallet(c).restore(saved.shielded),
          unshielded: (c) => UnshieldedWallet(c).restore(saved.unshielded),
          dust: (c) => DustWallet(c).restore(saved.dust),
        });
        logger.info(`Wallet restored from state saved ${saved.savedAt}`);
      } catch (e) {
        logger.warn(`Saved wallet state unusable (${String(e)}); syncing from genesis`);
        wallet = fresh;
      }
    }
    registerStateSaver(wallet, stateId);

    logger.info(
      `Wallet built from ${secret.kind}`,
    );

    return new MidnightWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
  }
}

function isProgressStrictlyComplete(progress: unknown): boolean {
  if (!progress || typeof progress !== 'object') {
    return false;
  }
  const candidate = progress as { isStrictlyComplete?: unknown };
  if (typeof candidate.isStrictlyComplete !== 'function') {
    return false;
  }
  return (candidate.isStrictlyComplete as () => boolean)();
}

export async function syncWallet(
  logger: Logger,
  wallet: WalletFacade,
  timeout = 300_000,
): Promise<FacadeState> {
  // SYNC_TIMEOUT_MS overrides every caller: a fresh Preprod wallet syncs DUST from genesis, which
  // took longer than 10 minutes on 12 Oct 2026.
  timeout = Number(process.env['SYNC_TIMEOUT_MS'] ?? timeout);
  logger.info(`Syncing wallet (timeout ${Math.round(timeout / 60_000)} min)...`);
  let emissionCount = 0;
  // Save progress every few minutes so an interrupted sync resumes instead of restarting.
  const save = stateSaverFor(wallet);
  let lastSave = Date.now();
  let saving = false;
  const maybeSave = () => {
    if (!save || saving || Date.now() - lastSave < 180_000) return;
    saving = true;
    save()
      .then(() => logger.info(`Wallet state saved at emission ${emissionCount}`))
      .catch((e: unknown) => logger.warn(`Could not save wallet state: ${String(e)}`))
      .finally(() => {
        saving = false;
        lastSave = Date.now();
      });
  };
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.tap((state: FacadeState) => {
        emissionCount++;
        maybeSave();
        const shielded = isProgressStrictlyComplete(state.shielded.state.progress);
        const unshielded = isProgressStrictlyComplete(state.unshielded.progress);
        const dust = isProgressStrictlyComplete(state.dust.state.progress);
        // Every emission at debug; every 500th at info with the DUST progress, so a long sync is visible.
        const line = `Wallet sync [${emissionCount}]: shielded=${shielded}, unshielded=${unshielded}, dust=${dust}`;
        if (emissionCount % 500 === 1) logger.info(`${line} dust.progress=${JSON.stringify(state.dust.state.progress, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
        else logger.debug(line);
        if (!shielded) {
          logger.debug(`  shielded.progress: ${JSON.stringify(state.shielded.state.progress)}`);
        }
        if (!unshielded) {
          logger.debug(`  unshielded.progress: ${JSON.stringify(state.unshielded.progress)}`);
        }
        if (!dust) {
          logger.debug(`  dust.progress: ${JSON.stringify(state.dust.state.progress)}`);
        }
      }),
      Rx.filter(
        (state: FacadeState) =>
          isProgressStrictlyComplete(state.shielded.state.progress) &&
          isProgressStrictlyComplete(state.dust.state.progress) &&
          isProgressStrictlyComplete(state.unshielded.progress),
      ),
      Rx.tap(() => logger.info(`Wallet sync complete after ${emissionCount} emissions`)),
      Rx.concatMap(async (state: FacadeState) => {
        await save?.().catch((e: unknown) => logger.warn(`Could not save wallet state: ${String(e)}`));
        return state;
      }),
      Rx.timeout({
        each: timeout,
        with: () =>
          Rx.throwError(
            () => new Error(`Wallet sync timeout after ${timeout}ms (${emissionCount} emissions received)`),
          ),
      }),
      Rx.catchError((err) => {
        logger.error(`Wallet sync error: ${err}`);
        return Rx.throwError(() => err);
      }),
    ),
  );
}