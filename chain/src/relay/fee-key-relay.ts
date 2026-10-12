// SPDX-License-Identifier: Apache-2.0
// Group fee-key relay: pays DUST fees for ONE savings group's contract calls,
// using only the group's shared DUST secret key.
//
// Adapted from midnightntwrk/example-private-party scripts/sponsor-service.ts and
// src/sponsor.ts (Apache-2.0, Copyright (C) Midnight Foundation). Changes:
//   * the sponsor wallet is started from the GROUP FEE KEY via
//     DustWallet(...).startWithSecretKey(...) — no NIGHT key, no funded seed;
//     shielded/unshielded keys are throwaway (they hold nothing, sign nothing of value);
//   * it refuses any transaction that is not purely calls to the group's own contract
//     (abuse guard: the key can't be used to sponsor random dApps through this relay);
//   * anyone in the group can run it — on a laptop, a phone, or in the member app itself.
//
// NOT EXERCISED IN THIS REPO: needs Preprod (or local devnet via docker), a proof server
// for the DUST spend proof, and a fee key that has registered NIGHT generating DUST.
//
//   GROUP_FEE_KEY_SEED=<64 hex>  GROUP_CONTRACT=<contract address hex>
//   BLOCKFROST_PROJECT_ID=nightpreprod... MIDNIGHT_NETWORK=preprod MIDNIGHT_PROOF_SERVER=http://127.0.0.1:6300 npm run relay -w chain
//
//   GET  /health   -> { status, dust, contract, dustAddress }
//   POST /sponsor  -> { tx: "<hex FinalizedTransaction, bound, no fee>" } => { success, txId }

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { makeLogger } from '../logger.js';
import {
  ContractCall,
  Transaction,
  type Binding,
  type FinalizedTransaction,
  type Proof,
  type SignatureEnabled,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { getConfig } from '../config.js';
import { buildFeeKeyWallet } from '../fee-key-wallet.js';
import { stateSaverFor } from '../wallet-state.js';
import { syncWallet } from '../wallet.js';

const logger = makeLogger(process.env['LOG_LEVEL'] ?? 'info');
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const ALLOWED_ENTRY_POINTS = new Set(['recordMeeting', 'attestSavings', 'addMember', 'handoverSecretary', 'rotateFeeKey', 'sunset']);

const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const feeKeySeed = fromHex(env('GROUP_FEE_KEY_SEED'));
const groupContract = env('GROUP_CONTRACT').toLowerCase();
const port = Number(process.env['RELAY_PORT'] ?? 3001);
const cfg = getConfig();
setNetworkId(cfg.networkId);

// --- wallet: DUST from the group fee key, everything else holds nothing (fee-key-wallet.ts) ---
const { facade, shieldedKeys: throwawayShielded, dustKey: groupDustKey, keystore, dustAddress: feeKeyDustAddress, restoredFrom } =
  await buildFeeKeyWallet(cfg, feeKeySeed);
// The address the NGO (or a relative) registers or designates NIGHT to, so the key earns DUST.
// Printed before the long first sync so it can be funded while the wallet catches up.
logger.info(`Group fee key DUST address (register or designate NIGHT here): ${feeKeyDustAddress}`);
if (restoredFrom) logger.info(`Fee key wallet restored from state saved ${restoredFrom}`);
await syncWallet(logger as never, facade, 600_000); // a fresh key syncs from genesis; can take hours on Preprod

const dustBalance = async (): Promise<bigint> => (await facade.waitForSyncedState()).dust.balance(new Date());
logger.info(`Group fee key ready. DUST balance: ${await dustBalance()} SPECK`);

// --- policy: only this group's contract, only known circuits -------------------------
function assertGroupCallOnly(tx: FinalizedTransaction): void {
  const intents = tx.intents;
  if (!intents || intents.size === 0) throw new Error('No contract call in transaction');
  for (const intent of intents.values()) {
    // If the member's wallet already spent DUST on this call (Lace ignoring payFees:false),
    // adding the group fee would charge twice. Refuse; the member's wallet can submit it as is.
    if ((intent.dustActions?.spends.length ?? 0) > 0) {
      throw new Error('This call already carries a DUST fee from the member’s wallet; the relay will not add a second one');
    }
    for (const action of intent.actions) {
      if (!(action instanceof ContractCall)) throw new Error('Only contract calls are sponsored');
      if (String(action.address).toLowerCase() !== groupContract) throw new Error('Not this group’s contract');
      const ep = typeof action.entryPoint === 'string' ? action.entryPoint : new TextDecoder().decode(action.entryPoint);
      if (!ALLOWED_ENTRY_POINTS.has(ep)) throw new Error(`Circuit ${ep} is not sponsored`);
    }
  }
}

async function sponsorAndSubmit(hex: string): Promise<string> {
  const userTx = Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(hex));
  assertGroupCallOnly(userTx);
  const recipe = await facade.balanceFinalizedTransaction(
    userTx,
    { shieldedSecretKeys: throwawayShielded, dustSecretKey: groupDustKey },
    { ttl: ttlOneHour(), tokenKindsToBalance: ['dust'] },
  );
  const signed = await facade.signRecipe(recipe, (payload) => keystore.signData(payload));
  const finalized = await facade.finalizeRecipe(signed);
  // Several relays on one key can collide on the same DUST UTXO (DustDoubleSpend, error 196):
  // the loser should simply retry. See README "Honest limitations".
  const txId = await facade.submitTransaction(finalized);
  void stateSaverFor(facade)?.().catch(() => undefined);
  return txId;
}

// --- transport (from example-private-party sponsor-service.ts) -----------------------
function send(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return;
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        req.pause();
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' });
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { status: 'ok', dust: (await dustBalance()).toString(), contract: groupContract, dustAddress: feeKeyDustAddress });
    return;
  }
  if (req.method === 'POST' && req.url === '/sponsor') {
    const { tx } = JSON.parse(await readBody(req)) as { tx?: unknown };
    if (typeof tx !== 'string' || !/^[0-9a-fA-F]+$/.test(tx)) {
      send(res, 400, { success: false, error: "Field 'tx' must be hex" });
      return;
    }
    try {
      send(res, 200, { success: true, txId: await sponsorAndSubmit(tx) });
    } catch (e) {
      send(res, 422, { success: false, error: (e as Error).message });
    }
    return;
  }
  send(res, 404, { success: false, error: 'Try GET /health or POST /sponsor' });
}

createServer((req, res) => {
  handle(req, res).catch((e: unknown) => send(res, 500, { success: false, error: String(e) }));
}).listen(port, () => logger.info(`Group fee-key relay on http://localhost:${port} for contract ${groupContract}`));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    void (stateSaverFor(facade)?.() ?? Promise.resolve()).finally(() => process.exit(0));
  });
}
