// SPDX-License-Identifier: Apache-2.0
// Measure what the demo can only assume: the DUST fee of one recordMeeting and one
// attestSavings call on Preprod, and how long the local proof server takes for each.
//
// NOT RUN IN THIS REPO (no Docker, no tNIGHT, no Blockfrost token on the build machine).
// Typechecked only. Run it on your machine after `deploy:preprod` (see PREPROD.md, step 8):
//
//   BLOCKFROST_PROJECT_ID=nightpreprod...  DEPLOYER_MNEMONIC='<24 words>' (or DEPLOYER_SEED=<64 hex>)  GROUP_CONTRACT=<address> \
//   SECRETARY_SECRET=<hex>  GROUP_SECRET=<hex>  MEMBER0_SECRET=<hex> \
//   MIDNIGHT_NETWORK=preprod npm run measure:preprod -w chain
//
// The secrets are the ones deploy:preprod printed. Without RELAY_URL the wallet pays its own DUST
// (wallet mode). With RELAY_URL=http://localhost:3001 the wallet balances only its own value, adds
// no DUST, and the group fee-key relay adds the fee and submits (relay mode). CALLER_SEED picks a
// different wallet to sign the calls (e.g. one that has never held DUST); it defaults to the deployer.
// Either way the fee read back is the plain network fee for the call. Fees come from the
// indexer's RegularTransaction.fee (SPECK; 1 DUST = 10^15 SPECK), not from a balance difference,
// because DUST keeps generating while a proof runs.

import path from 'node:path';
import pino from 'pino';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { applyEntry, createPrivateState, randomBytes, ZERO_PASSBOOK, type Entry, type UndyingPrivateState } from '@undying-ledger/contract';
import { getConfig, redactToken } from '../config.js';
import { MidnightWalletProvider, syncWallet, type WalletSecret } from '../wallet.js';
import { UndyingAPI } from '../api.js';
import { undyingPrivateStateKey, type UndyingCircuitKeys, type UndyingProviders } from '../common.js';

const SPECK_PER_DUST = 10n ** 15n;
const logger = pino({ level: 'info' });
const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const cfg = getConfig();
setNetworkId(cfg.networkId);
const zkConfigPath = path.resolve(import.meta.dirname, '../../../contract/src/managed/undying');

const relayUrl = process.env['RELAY_URL']?.replace(/\/$/, '');
const secret: WalletSecret = process.env['CALLER_SEED']
  ? { kind: 'seed', value: process.env['CALLER_SEED'] }
  : process.env['DEPLOYER_MNEMONIC']
    ? { kind: 'mnemonic', value: process.env['DEPLOYER_MNEMONIC'] }
    : { kind: 'seed', value: env('DEPLOYER_SEED') };
const wallet = await MidnightWalletProvider.build(logger as never, { walletNetworkId: cfg.networkId, ...cfg } as never, secret);
await wallet.start();
await syncWallet(logger as never, wallet.wallet, 600_000);

// Time every proof the local proof server makes.
const zk = new NodeZkConfigProvider<UndyingCircuitKeys>(zkConfigPath);
const prover = httpClientProofProvider(cfg.proofServer, zk);
const proofMs: number[] = [];
const timedProver = {
  ...prover,
  proveTx: async (...args: Parameters<typeof prover.proveTx>) => {
    const t0 = performance.now();
    const out = await prover.proveTx(...args);
    proofMs.push(performance.now() - t0);
    return out;
  },
};

// Relay mode: balance own value only (no DUST), then hand the bound call to the relay.
const relayWallet = {
  getCoinPublicKey: () => wallet.getCoinPublicKey(),
  getEncryptionPublicKey: () => wallet.getEncryptionPublicKey(),
  balanceTx: (tx: Parameters<typeof wallet.balanceOwnValueAndFinalize>[0], ttl?: Date) => wallet.balanceOwnValueAndFinalize(tx, ttl),
};
const relayMidnight = {
  submitTx: async (tx: FinalizedTransaction): Promise<string> => {
    const res = await fetch(`${relayUrl}/sponsor`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx: toHex(tx.serialize()) }) });
    const body = (await res.json()) as { success: boolean; txId?: string; error?: string };
    if (!body.success || !body.txId) throw new Error(`Relay refused: ${body.error ?? res.status}`);
    logger.info(`Relay added the group fee and submitted ${body.txId}`);
    return body.txId;
  },
};
const callerDustBefore = await wallet.getDustBalance();
logger.info(`Mode: ${relayUrl ? `relay (${relayUrl})` : 'wallet pays'}; caller DUST before: ${callerDustBefore} SPECK`);

const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: 'undying-secretary',
    privateStoragePasswordProvider: () => process.env['PRIVATE_STATE_PASSWORD'] ?? 'Undying-Ledger-1!',
    accountId: wallet.getCoinPublicKey(),
  }),
  publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
  zkConfigProvider: zk,
  proofProvider: timedProver,
  walletProvider: relayUrl ? relayWallet : wallet,
  midnightProvider: relayUrl ? relayMidnight : wallet,
} as unknown as UndyingProviders;

/** Read the paid fee of a transaction from the indexer (SPECK). */
async function paidFee(txHash: string): Promise<bigint> {
  const query = `{ transactions(offset: { hash: "${txHash}" }) { ... on RegularTransaction { hash fee } } }`;
  for (let i = 0; i < 30; i++) {
    const res = await fetch(cfg.indexer, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
    const body = (await res.json()) as { data?: { transactions?: { fee?: string }[] }; errors?: { message: string }[] };
    const fee = body.data?.transactions?.[0]?.fee;
    if (fee) return BigInt(fee);
    if (body.errors?.length) logger.warn(redactToken(body.errors.map((e) => e.message).join('; ')));
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Indexer has no fee for ${txHash} yet`);
}
const dust = (speck: bigint) => `${speck / SPECK_PER_DUST}.${(speck % SPECK_PER_DUST).toString().padStart(15, '0')}`;

const groupSecret = fromHex(env('GROUP_SECRET'));
const secretaryState = createPrivateState(fromHex(env('SECRETARY_SECRET')), groupSecret);
const api = await UndyingAPI.join(providers, zkConfigPath, env('GROUP_CONTRACT') as never, secretaryState);
const before = ((await providers.privateStateProvider.get(undyingPrivateStateKey)) ?? secretaryState) as UndyingPrivateState;

// 1. recordMeeting: page 0, one share and the social fund for every slot.
const entries: Entry[] = Array.from({ length: 5 }, () => ({ shares: 1n, socialFund: 2n, loanIssued: 0n, loanRepaid: 0n }));
let t0 = performance.now();
const rec = await api.deployed.callTx.recordMeeting(0n, entries);
const recWall = performance.now() - t0;
const recProof = proofMs.at(-1) ?? NaN;
const passbooks = { ...before.passbooks };
for (let s = 0; s < 5; s++) passbooks[String(s)] = applyEntry(before.passbooks[String(s)] ?? ZERO_PASSBOOK, entries[s]);
await providers.privateStateProvider.set(undyingPrivateStateKey, { ...before, passbooks });
const recFee = await paidFee(rec.public.txHash);

// 2. attestSavings as member 0: her phone holds only her own passbook.
const memberState = createPrivateState(fromHex(env('MEMBER0_SECRET')), groupSecret, { '0': passbooks['0'] });
await providers.privateStateProvider.set(undyingPrivateStateKey, memberState);
t0 = performance.now();
const att = await api.deployed.callTx.attestSavings(0n, 1n, randomBytes(32));
const attWall = performance.now() - t0;
const attProof = proofMs.at(-1) ?? NaN;
await providers.privateStateProvider.set(undyingPrivateStateKey, { ...before, passbooks }); // back to the secretary
const attFee = await paidFee(att.public.txHash);

const secs = (ms: number) => Math.round(ms / 100) / 10;
const callerDustAfter = await wallet.getDustBalance();
const result = {
  network: cfg.networkId,
  paidBy: relayUrl ? 'group fee key (relay)' : 'caller wallet',
  contract: env('GROUP_CONTRACT'),
  callerDustSpeck: { before: callerDustBefore.toString(), after: callerDustAfter.toString() },
  recordMeeting: { txHash: rec.public.txHash, txId: rec.public.txId, feeSpeck: recFee.toString(), feeDust: dust(recFee), proofSeconds: secs(recProof), submitToFinalSeconds: secs(recWall) },
  attestSavings: { txHash: att.public.txHash, txId: att.public.txId, feeSpeck: attFee.toString(), feeDust: dust(attFee), proofSeconds: secs(attProof), submitToFinalSeconds: secs(attWall) },
};
console.log(JSON.stringify(result, null, 2));
const feeForUi = Number(recFee) / Number(SPECK_PER_DUST);
console.log(
  `\nPaste into the UI:\n  node ui/scripts/set-measured.mjs --fee ${feeForUi} --record ${result.recordMeeting.proofSeconds} --attest ${result.attestSavings.proofSeconds} --date "${new Date().toISOString().slice(0, 10)}, Preprod, proof-server 8.1.0"\n`,
);
await wallet.stop();
