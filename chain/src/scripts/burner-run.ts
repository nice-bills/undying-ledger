// SPDX-License-Identifier: Apache-2.0
// The whole story on Preprod with NO member wallet: every call is proved here, bound by a burner
// key (burner.ts) and paid by the group fee-key relay.
//   1. the secretary records a meeting; members keep their stamps
//   2. member 0 proves "at least 1 share"
//   3. once the grace period has passed, member 1 calls sunset (the vendor key is erased)
//   4. the secretary's phone is "lost": members 0, 1 and 2 vote for a new secretary key (3 of 5)
//   5. the elected secretary rebuilds the book from the members' stamps and records a meeting
//
//   GROUP_JSON=.preprod/group3.json RELAY_URL=http://localhost:3001 BURNER_OUT=.preprod/burner-run.json \
//   BLOCKFROST_PROJECT_ID=.. MIDNIGHT_NETWORK=preprod npm run burner:preprod -w chain
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeLogger } from '../logger.js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex } from '@midnight-ntwrk/midnight-js-utils';
import type { FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  applyEntry,
  createPrivateState,
  DOMAINS,
  pureCircuits,
  randomBytes,
  roleKey,
  ZERO_PASSBOOK,
  type Entry,
  type Passbook,
  type UndyingPrivateState,
} from '@undying-ledger/contract';
import { getConfig, redactToken } from '../config.js';
import { UndyingAPI } from '../api.js';
import { burnerWallet, submitThroughRelay } from '../burner.js';
import { undyingPrivateStateKey, type UndyingCircuitKeys, type UndyingProviders } from '../common.js';

const logger = makeLogger();
const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
const fromCaller = (p: string) => path.resolve(process.env['INIT_CWD'] ?? process.cwd(), p);
const cfg = getConfig();
setNetworkId(cfg.networkId);
const zkConfigPath = path.resolve(import.meta.dirname, '../../../contract/src/managed/undying');
const relayUrl = env('RELAY_URL');
const g = JSON.parse(readFileSync(fromCaller(env('GROUP_JSON')), 'utf8')) as {
  contract: string;
  groupSecret: string;
  secretarySecret: string;
  memberSecrets: string[];
};
const groupSecret = fromHex(g.groupSecret);

// One burner per run; nothing is synced, funded or kept.
const burner = burnerWallet();
const zk = new NodeZkConfigProvider<UndyingCircuitKeys>(zkConfigPath);
const prover = httpClientProofProvider(cfg.proofServer, zk);
const proofMs: number[] = [];
const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: `undying-burner-${Date.now()}`,
    privateStoragePasswordProvider: () => process.env['PRIVATE_STATE_PASSWORD'] ?? 'Undying-Ledger-1!',
    accountId: burner.getCoinPublicKey(),
  }),
  publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS),
  zkConfigProvider: zk,
  proofProvider: {
    proveTx: async (...args: Parameters<typeof prover.proveTx>) => {
      const t0 = performance.now();
      const out = await prover.proveTx(...args);
      proofMs.push(performance.now() - t0);
      return out;
    },
  },
  walletProvider: burner,
  midnightProvider: {
    submitTx: async (tx: FinalizedTransaction) => {
      const id = await submitThroughRelay(relayUrl, tx);
      logger.info(`Relay added the group fee and submitted ${id}`);
      return id;
    },
  },
} as unknown as UndyingProviders;

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

type Step = { circuit: string; txHash: string; txId: string; blockHeight: number; feeSpeck: string; proofSeconds: number };
const steps: Record<string, Step> = {};
const secs = (ms: number) => Math.round(ms / 100) / 10;
async function step(name: string, circuit: string, run: () => Promise<{ public: { txHash: string; txId: string; blockHeight: number } }>) {
  const r = await run();
  const fee = await paidFee(r.public.txHash);
  steps[name] = { circuit, txHash: r.public.txHash, txId: r.public.txId, blockHeight: r.public.blockHeight, feeSpeck: fee.toString(), proofSeconds: secs(proofMs.at(-1) ?? NaN) };
  logger.info(`${name}: ${r.public.txHash} (block ${r.public.blockHeight}, fee ${fee} SPECK)`);
}
const as = async (state: UndyingPrivateState) => providers.privateStateProvider.set(undyingPrivateStateKey, state);

const secretaryState = createPrivateState(fromHex(g.secretarySecret), groupSecret);
const api = await UndyingAPI.join(providers, zkConfigPath, g.contract as never, secretaryState);
const L0 = await api.currentLedger();
const count = Number(L0.memberCount);

// 1. a meeting, page 0
const entries: Entry[] = [3, 2, 4, 1, 2].map((n) => ({ shares: BigInt(n), socialFund: 2n, loanIssued: 0n, loanRepaid: 0n }));
await as(secretaryState);
await step('recordMeeting', 'recordMeeting', () => api.deployed.callTx.recordMeeting(0n, entries));
const books: Record<string, Passbook> = {};
for (let s = 0; s < count; s++) books[String(s)] = applyEntry(ZERO_PASSBOOK, entries[s]);
const L1 = await api.currentLedger();
// each member's stamp: slot, version, passbook (what the secretary's phone hands out)
const stamps = Array.from({ length: count }, (_, s) => ({ slot: BigInt(s), version: L1.passbookVersion.lookup(BigInt(s)), passbook: books[String(s)] }));

// 2. member 0 proves at least 1 share
const member = (i: number, pb?: Passbook) => createPrivateState(fromHex(g.memberSecrets[i]), groupSecret, pb ? { [String(i)]: pb } : {});
await as(member(0, books['0']));
await step('attestSavings', 'attestSavings', () => api.deployed.callTx.attestSavings(0n, 1n, randomBytes(32)));

// 3. sunset once the grace period is over
const opensAt = Number(L1.lastHeartbeat + L1.graceSeconds) * 1000;
if (Date.now() < opensAt + 30_000) {
  const ms = opensAt + 30_000 - Date.now();
  logger.info(`Waiting ${Math.ceil(ms / 1000)} s for the grace period to pass`);
  await new Promise((r) => setTimeout(r, ms));
}
await as(member(1));
await step('sunset', 'sunset', () => api.deployed.callTx.sunset());

// 4. members elect a new secretary (3 of 5)
const candidate = randomBytes(32);
const candidateKey = roleKey(DOMAINS.secretary, candidate);
for (const i of [0, 1, 2]) {
  await as(member(i));
  await step(`vote${i}`, 'voteSecretary', () => api.deployed.callTx.voteSecretary(BigInt(i), candidateKey));
}
const L2 = await api.currentLedger();
const elected = Buffer.from(L2.secretaryKey).equals(Buffer.from(candidateKey));
if (!elected) throw new Error('The vote did not elect the candidate');
logger.info(`Members elected a new secretary (recovery round ${L2.recoveryRound})`);

// 5. the elected secretary checks every stamp against the ledger, then records
for (const st of stamps) {
  const ok = pureCircuits.passbookCommitment(st.passbook, groupSecret, st.slot, st.version) === L2.passbooks.lookup(st.slot);
  if (!ok) throw new Error(`Stamp for slot ${st.slot} does not match the ledger`);
}
const rebuilt = createPrivateState(candidate, groupSecret, books);
await as(rebuilt);
const entries2: Entry[] = [1, 1, 1, 1, 1].map((n) => ({ shares: BigInt(n), socialFund: 2n, loanIssued: 0n, loanRepaid: 0n }));
await step('recordMeetingByElected', 'recordMeeting', () => api.deployed.callTx.recordMeeting(0n, entries2));
const L3 = await api.currentLedger();

const out = {
  network: cfg.networkId,
  contract: g.contract,
  paidBy: 'group fee key (relay)',
  memberWallet: 'none (burner key: random coin and encryption public keys, never synced or funded)',
  steps,
  meetings: L3.meetings.toString(),
  phase: Number(L3.phase) === 1 ? 'SUNSET' : 'ACTIVE',
  recoveryRound: L2.recoveryRound.toString(),
  at: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
if (process.env['BURNER_OUT']) writeFileSync(fromCaller(process.env['BURNER_OUT']), JSON.stringify(out, null, 2) + '\n');
process.exit(0);
