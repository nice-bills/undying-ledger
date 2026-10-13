// SPDX-License-Identifier: Apache-2.0
// Browser providers for Lace (Midnight dApp connector 4.x) on Preprod.
//
// Copied and adapted from midnightntwrk/example-bboard
// bboard-ui/src/contexts/BrowserDeployedBoardManager.ts (Apache-2.0,
// Copyright (C) Midnight Foundation). Changes:
//   * connecting and building providers are split, so the page can check the member's Lace
//     setup (network, prover) first and show what is wrong in plain words (LiveError);
//   * fee mode 'group-fee-key': Lace balances the member's own value side with
//     `payFees: false`, and the bound transaction is POSTed to a group fee-key relay that adds
//     the DUST fee (pattern from example-private-party's prepareSponsoredCall / sponsorAndSubmit);
//   * fee mode 'wallet': unchanged bboard behaviour (Lace pays its own DUST);
//   * the indexer comes from Lace's configuration, or from a Blockfrost Preprod project ID;
//   * private state lives in this browser (levelPrivateStateProvider, IndexedDB via browser-level),
//     encrypted with a passphrase the member types, scoped to their wallet;
//   * every step reports a stage ('proving', 'balancing', 'relay', 'submitting') for the UI.
//
// NOT RUN AGAINST PREPROD (no Lace, no proof server, no tNIGHT on the build machine).
// Typechecked, and unit-tested with a mocked window.midnight and mocked Midnight.js providers
// (ui/src/lace/__tests__). Open question: whether Lace honours balanceUnsealedTransaction(tx,
// { payFees: false }); if it refuses, the page says so and offers the Lace-pays path.

import type { Configuration, ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';
import { bytesToHex as toHex, hexToBytes as fromHex } from './hex.js';
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
import { LiveError, reasonOf } from './errors.js';
import { burnerWallet } from './burner.js';

export type FeeMode = { kind: 'wallet' } | { kind: 'group-fee-key'; relayUrl: string };
export type Stage = 'proving' | 'balancing' | 'relay' | 'submitting' | 'done';

export const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';
export const LOCAL_PROVER = 'http://localhost:6300';
export const BLOCKFROST_PREPROD = {
  indexer: 'https://midnight-preprod.blockfrost.io/api/v0',
  indexerWS: 'wss://midnight-preprod.blockfrost.io/api/v0/ws',
};

type MidnightWindow = { midnight?: Record<string, unknown> };

/** The first wallet in window.midnight that speaks dApp connector 4.x (Lace). */
export const findLace = (): InitialAPI | undefined => {
  const w = (globalThis as unknown as MidnightWindow).midnight;
  if (!w) return undefined;
  return Object.values(w).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      typeof (wallet as InitialAPI).connect === 'function' &&
      semver.satisfies((wallet as InitialAPI).apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

/** True when the prover URI points at this machine. */
export const isLocalProver = (uri: string | undefined): boolean =>
  !!uri && /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(uri.trim());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll for Lace for up to `waitMs`, then connect to `networkId` (e.g. 'preprod'). */
export async function connectToWallet(networkId: string, waitMs = 2_000, answerMs = 60_000): Promise<ConnectedAPI> {
  const start = Date.now();
  let api = findLace();
  while (!api && Date.now() - start < waitMs) {
    await sleep(100);
    api = findLace();
  }
  if (!api) {
    throw new LiveError('no-lace', 'No Lace wallet in this browser. Install Lace (Midnight), switch it to Preprod, then reload this page.');
  }
  try {
    return await Promise.race([
      api.connect(networkId),
      sleep(answerMs).then(() => {
        throw new Error('Lace did not answer. Unlock it and try again.');
      }),
    ]);
  } catch (e) {
    const r = reasonOf(e);
    if (/network/i.test(r)) {
      throw new LiveError('wrong-network', `Lace is not on ${networkId}: ${r}. Switch Lace to Preprod in its Midnight settings.`, { cause: e });
    }
    throw new LiveError('lace-refused', `Lace refused the connection: ${r}`, { cause: e });
  }
}

export type LaceSetup = {
  config: Configuration;
  proverUri: string;
  proverLocal: boolean;
  /** Plain-language warnings to show; empty when the setup is as PREPROD.md asks. */
  warnings: string[];
};

/** Read Lace's configuration and check it against what the member app needs. */
export async function checkLaceSetup(connected: ConnectedAPI, networkId: string): Promise<LaceSetup> {
  const config = await connected.getConfiguration();
  if (config.networkId && config.networkId !== networkId) {
    throw new LiveError('wrong-network', `Lace is on ${config.networkId}, not ${networkId}. Switch Lace to Preprod in its Midnight settings.`);
  }
  const proverUri = config.proverServerUri?.trim() ?? '';
  if (!proverUri) {
    throw new LiveError('no-prover', `Lace has no proof server set. In Lace's Midnight settings choose Local (${LOCAL_PROVER}) and start it with scripts/preprod.sh up.`);
  }
  const proverLocal = isLocalProver(proverUri);
  const warnings = proverLocal
    ? []
    : [`Lace proves on ${proverUri}, not on this machine. Your passbook would be sent there to be proved. Set Lace's proof server to Local (${LOCAL_PROVER}).`];
  return { config, proverUri, proverLocal, warnings };
}

const withToken = (url: string, t: string) => `${url}${url.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(t)}`;

/** Lace's indexer, or Blockfrost Preprod with a project ID the member pasted (preferred if given). */
export function resolveIndexer(config: Pick<Configuration, 'indexerUri' | 'indexerWsUri'> | undefined, blockfrostProjectId?: string) {
  const t = blockfrostProjectId?.trim();
  if (t) return { indexer: withToken(BLOCKFROST_PREPROD.indexer, t), indexerWS: withToken(BLOCKFROST_PREPROD.indexerWS, t) };
  if (config?.indexerUri && config.indexerWsUri) return { indexer: config.indexerUri, indexerWS: config.indexerWsUri };
  throw new LiveError('no-indexer', 'Preprod needs an indexer: use Lace (it has one configured) or paste a Blockfrost Midnight Preprod project ID.');
}

/** POST a bound, fee-less transaction to the group fee-key relay. Returns the tx id. */
export async function submitViaGroupFeeKey(relayUrl: string, tx: FinalizedTransaction): Promise<TransactionId> {
  // serialise before the request, so a failure here is not reported as the relay not answering
  const payload = JSON.stringify({ tx: toHex(tx.serialize()) });
  let res: Response;
  try {
    res = await fetch(new URL('/sponsor', relayUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
  } catch (e) {
    throw new LiveError('relay-unreachable', `The fee-key relay at ${relayUrl} did not answer (${reasonOf(e)}). Is it running? See PREPROD.md step 10.`, { cause: e });
  }
  let body: { success?: boolean; txId?: string; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* non-JSON answer: reported below with the status */
  }
  if (!res.ok || !body.success || !body.txId) {
    throw new LiveError('relay-refused', `The fee-key relay refused this call: ${body.error ?? `HTTP ${res.status}`}`);
  }
  return body.txId as TransactionId;
}

/**
 * The passbook lock must pass Midnight.js's own password rules (16+ characters, three kinds of
 * character, no runs like 1234). Checked before any provider is built, so a weak lock is refused
 * in the page's words and never baked into the providers.
 */
export function checkPassphrase(passphrase: string): void {
  try {
    validatePassword(passphrase);
  } catch (e) {
    throw new LiveError('bad-input', `Choose a stronger passbook lock: ${reasonOf(e)}.`, { cause: e });
  }
}

/** Private state in this browser (IndexedDB), encrypted with the member's passphrase. */
export function browserPrivateStateProvider(accountId: string, passphrase: string): PrivateStateProvider<PrivateStateId, UndyingPrivateState> {
  return levelPrivateStateProvider<PrivateStateId, UndyingPrivateState>({
    privateStateStoreName: 'undying-private-state',
    signingKeyStoreName: 'undying-signing-keys',
    privateStoragePasswordProvider: () => passphrase,
    accountId,
  });
}

export type BuildOpts = {
  connected: ConnectedAPI;
  config: Configuration;
  zkConfigBaseUrl: string; // where keys/ and zkir/ from `compact compile` are served
  privateStateProvider: PrivateStateProvider<PrivateStateId, UndyingPrivateState>;
  /** Read on every call, so the member can switch between relay and Lace-pays without re-joining. */
  feeMode: FeeMode | (() => FeeMode);
  blockfrostProjectId?: string;
  onStage?: (s: Stage) => void;
};

/** Midnight.js providers from an already connected Lace. Mirrors bboard's initializeProviders. */
export async function buildProviders(opts: BuildOpts): Promise<UndyingProviders> {
  const { connected, config } = opts;
  const fee = (): FeeMode => (typeof opts.feeMode === 'function' ? opts.feeMode() : opts.feeMode);
  const stage = (s: Stage) => opts.onStage?.(s);
  if (!config.proverServerUri) throw new LiveError('no-prover', `Lace has no proof server set. Choose Local (${LOCAL_PROVER}) in Lace.`);
  const { indexer, indexerWS } = resolveIndexer(config, opts.blockfrostProjectId);
  const keyMaterialProvider = new FetchZkConfigProvider<UndyingCircuitKeys>(opts.zkConfigBaseUrl, fetch.bind(globalThis));
  const shielded = await connected.getShieldedAddresses();
  // Proving must stay on the member's machine: Lace's configured prover (a LOCAL proof server,
  // http://localhost:6300). checkLaceSetup warns when it is not.
  const prover = httpClientProofProvider(config.proverServerUri, keyMaterialProvider);

  return {
    privateStateProvider: opts.privateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: {
      proveTx: (tx, cfg) => {
        stage('proving');
        return prover.proveTx(tx, cfg);
      },
    },
    publicDataProvider: indexerPublicDataProvider(indexer, indexerWS),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        stage('balancing');
        const payFees = fee().kind === 'wallet';
        let received: { tx: string };
        try {
          received = await connected.balanceUnsealedTransaction(toHex(tx.serialize()), { payFees });
        } catch (e) {
          if (!payFees) {
            throw new LiveError(
              'payfees-refused',
              `Lace would not balance this call without paying the fee itself (payFees: false): ${reasonOf(e)}. Let Lace pay from your own DUST instead, or try another wallet.`,
              { cause: e },
            );
          }
          throw new LiveError('lace-refused', `Lace did not sign the call: ${reasonOf(e)}`, { cause: e });
        }
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        const m = fee();
        if (m.kind === 'group-fee-key') {
          stage('relay');
          return submitViaGroupFeeKey(m.relayUrl, tx);
        }
        stage('submitting');
        try {
          await connected.submitTransaction(toHex(tx.serialize()));
        } catch (e) {
          throw new LiveError('lace-refused', `Lace did not submit the call: ${reasonOf(e)}`, { cause: e });
        }
        return tx.identifiers()[0];
      },
    },
  } as UndyingProviders;
}

export type BurnerOpts = {
  zkConfigBaseUrl: string;
  /** The proof server on this machine (http://localhost:6300). */
  proverUri: string;
  /** No Lace means no indexer from Lace: a Blockfrost Preprod project ID is required. */
  blockfrostProjectId?: string;
  privateStateProvider: PrivateStateProvider<PrivateStateId, UndyingPrivateState>;
  /** Read on every call; the burner path has no other way to pay. */
  relayUrl: () => string;
  onStage?: (s: Stage) => void;
};

/**
 * No wallet at all (burner.ts): the call is proved on this machine, bound with a throwaway key
 * that holds nothing, and POSTed to the group fee-key relay, which adds the fee and submits.
 * Nothing to install, no tokens, no wallet sync.
 */
export function buildBurnerProviders(opts: BurnerOpts): UndyingProviders {
  const stage = (s: Stage) => opts.onStage?.(s);
  if (!opts.blockfrostProjectId?.trim()) {
    throw new LiveError('no-indexer', 'Without a wallet the page needs a Blockfrost Midnight Preprod project ID to read the book. Paste it above.');
  }
  const { indexer, indexerWS } = resolveIndexer(undefined, opts.blockfrostProjectId);
  const keyMaterialProvider = new FetchZkConfigProvider<UndyingCircuitKeys>(opts.zkConfigBaseUrl, fetch.bind(globalThis));
  const prover = httpClientProofProvider(opts.proverUri, keyMaterialProvider);
  const burner = burnerWallet();
  return {
    privateStateProvider: opts.privateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: {
      proveTx: (tx, cfg) => {
        stage('proving');
        return prover.proveTx(tx, cfg);
      },
    },
    publicDataProvider: indexerPublicDataProvider(indexer, indexerWS),
    walletProvider: {
      getCoinPublicKey: burner.getCoinPublicKey,
      getEncryptionPublicKey: burner.getEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction) => {
        stage('balancing');
        return burner.balanceTx(tx);
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        const relayUrl = opts.relayUrl();
        if (!relayUrl) throw new LiveError('fee-choice-needed', 'Without a wallet, the group fee-key relay pays every fee. Give its URL above.');
        stage('relay');
        return submitViaGroupFeeKey(relayUrl, tx);
      },
    },
  } as UndyingProviders;
}

/** Connect, check, and build in one go (kept for scripts and for the old call sites). */
export async function initializeProviders(opts: Omit<BuildOpts, 'connected' | 'config'> & { networkId: string }): Promise<UndyingProviders> {
  const connected = await connectToWallet(opts.networkId);
  const { config } = await checkLaceSetup(connected, opts.networkId);
  return buildProviders({ ...opts, connected, config });
}
