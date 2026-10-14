// SPDX-License-Identifier: Apache-2.0
// A full group of 30 on Preprod, with NO member wallet: the secretary adds members 5 to 29
// (each addMember that starts a page commits its five empty passbooks), records one meeting for
// all 30 (six recordMeeting calls, one per page), and member 29 proves "at least 1 share". Every
// call is proved here, bound by a burner key (burner.ts) and paid by the group fee-key relay.
// Deploy with 5 members first (deploy.ts): committing all 30 at deploy exceeds the block limits.
//
//   GROUP_JSON=.preprod/group4.json RELAY_URL=http://localhost:3001 GROUP30_OUT=.preprod/group30-run.json \
//   BLOCKFROST_PROJECT_ID=.. MIDNIGHT_NETWORK=preprod npm run group30:preprod -w chain
//
// New member secrets are written back to GROUP_JSON (mode 600) after each addMember, so a run
// that stops part-way resumes where it left off. Nothing secret is printed.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { makeLogger } from '../logger.js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  applyEntry,
  createPrivateState,
  DOMAINS,
  pureCircuits,
  randomBytes,
  roleKey,
  ZERO_ENTRY,
  ZERO_PASSBOOK,
  type Entry,
  type UndyingPrivateState,
} from '@undying-ledger/contract';
import { getConfig, redactToken } from '../config.js';
import { UndyingAPI } from '../api.js';
import { burnerWallet, submitThroughRelay } from '../burner.js';
import { undyingPrivateStateKey, type UndyingCircuitKeys, type UndyingProviders } from '../common.js';

const FULL = 30;
const PAGE = 5;
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
const groupFile = fromCaller(env('GROUP_JSON'));
const g = JSON.parse(readFileSync(groupFile, 'utf8')) as { contract: string; groupSecret: string; secretarySecret: string; memberSecrets: string[] };
const groupSecret = fromHex(g.groupSecret);

const burner = burnerWallet();
const zk = new NodeZkConfigProvider<UndyingCircuitKeys>(zkConfigPath);
const prover = httpClientProofProvider(cfg.proofServer, zk);
const proofMs: number[] = [];
const providers = {
  privateStateProvider: levelPrivateStateProvider({
    privateStateStoreName: `undying-group30-${Date.now()}`,
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
  midnightProvider: { submitTx: (tx: FinalizedTransaction) => submitThroughRelay(relayUrl, tx) },
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

type Step = { name: string; circuit: string; txHash: string; blockHeight: number; feeSpeck: string; proofSeconds: number };
const steps: Step[] = [];
const secs = (ms: number) => Math.round(ms / 100) / 10;
async function step(name: string, circuit: string, run: () => Promise<{ public: { txHash: string; blockHeight: number } }>) {
  const r = await run();
  const fee = await paidFee(r.public.txHash);
  steps.push({ name, circuit, txHash: r.public.txHash, blockHeight: r.public.blockHeight, feeSpeck: fee.toString(), proofSeconds: secs(proofMs.at(-1) ?? NaN) });
  logger.info(`${name}: ${r.public.txHash} (block ${r.public.blockHeight}, fee ${fee} SPECK)`);
}
const as = (state: UndyingPrivateState) => providers.privateStateProvider.set(undyingPrivateStateKey, state);

const secretary = createPrivateState(fromHex(g.secretarySecret), groupSecret);
const api = await UndyingAPI.join(providers, zkConfigPath, g.contract as never, secretary);
await as(secretary);

// 1. the secretary adds members until the group is full
let L = await api.currentLedger();
while (Number(L.memberCount) < FULL) {
  const slot = Number(L.memberCount);
  if (!g.memberSecrets[slot]) {
    g.memberSecrets[slot] = toHex(randomBytes(32));
    writeFileSync(groupFile, JSON.stringify(g, null, 2) + '\n', { mode: 0o600 });
  }
  await step(`addMember ${slot}`, 'addMember', () => api.addMember(roleKey(DOMAINS.member, fromHex(g.memberSecrets[slot]))));
  L = await api.currentLedger();
}
logger.info(`Group is full: ${L.memberCount} members`);

// 2. one meeting for all 30 (1 to 5 shares each), one call per page
const entries: Entry[] = Array.from({ length: FULL }, (_, s) => ({ ...ZERO_ENTRY, shares: BigInt(1 + (s % 5)), socialFund: 1n }));
for (let p = 0; p < FULL / PAGE; p++) {
  await step(`recordMeeting page ${p}`, 'recordMeeting', () => api.deployed.callTx.recordMeeting(BigInt(p), entries.slice(p * PAGE, p * PAGE + PAGE)));
}
L = await api.currentLedger();
// every member's stamp opens her sealed line
const books = entries.map((e) => applyEntry(ZERO_PASSBOOK, e));
const opened = books.filter((pb, s) => pureCircuits.passbookCommitment(pb, groupSecret, BigInt(s), L.passbookVersion.lookup(BigInt(s))) === L.passbooks.lookup(BigInt(s))).length;
if (opened !== FULL) throw new Error(`Only ${opened} of ${FULL} stamps open the book`);

// 3. member 29 proves at least 1 share
await as(createPrivateState(fromHex(g.memberSecrets[29]), groupSecret, { '29': books[29] }));
await step('attestSavings slot 29', 'attestSavings', () => api.attestSavings(29n, 1n, randomBytes(32)));

const out = {
  network: cfg.networkId,
  contract: g.contract,
  paidBy: 'group fee key (relay)',
  memberWallet: 'none (burner key)',
  memberCount: Number(L.memberCount),
  meetings: L.meetings.toString(),
  stampsOpening: opened,
  steps,
  at: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
if (process.env['GROUP30_OUT']) writeFileSync(fromCaller(process.env['GROUP30_OUT']), JSON.stringify(out, null, 2) + '\n');
process.exit(0);
