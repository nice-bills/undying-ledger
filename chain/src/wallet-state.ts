// SPDX-License-Identifier: Apache-2.0
// Save and restore synced wallet state, so each Preprod script does not resync from genesis.
// A fresh wallet's DUST sync on Preprod took about 3.7 hours on 12 Oct 2026 (1.65M events at
// roughly 120 a second), and every script built its wallet from scratch.
//
// Files live in .preprod/wallet-state (mode 600, gitignored), named by a hash of the network and
// seed, never the seed itself. They hold the wallets' synced local state, not the seed.

import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk';

export type SavedWalletState = { shielded: string; unshielded: string; dust: string; savedAt: string };

const stateDir = (): string =>
  process.env['WALLET_STATE_DIR'] ?? path.resolve(import.meta.dirname, '../../.preprod/wallet-state');

export const walletStateId = (networkId: string, secret: string): string =>
  createHash('sha256').update(`${networkId}:${secret}`).digest('hex').slice(0, 16);

const fileFor = (id: string): string => path.join(stateDir(), `${id}.json`);

export function loadWalletState(id: string): SavedWalletState | undefined {
  if (process.env['WALLET_STATE'] === 'off') return undefined;
  const f = fileFor(id);
  if (!existsSync(f)) return undefined;
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as SavedWalletState;
  } catch {
    return undefined;
  }
}

export async function saveWalletState(facade: WalletFacade, id: string): Promise<void> {
  if (process.env['WALLET_STATE'] === 'off') return;
  const [shielded, unshielded, dust] = await Promise.all([
    facade.shielded.serializeState(),
    facade.unshielded.serializeState(),
    facade.dust.serializeState(),
  ]);
  const dir = stateDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const f = fileFor(id);
  const tmp = `${f}.tmp`;
  writeFileSync(tmp, JSON.stringify({ shielded, unshielded, dust, savedAt: new Date().toISOString() }), { mode: 0o600 });
  renameSync(tmp, f);
  chmodSync(f, 0o600);
}

// syncWallet() only sees the facade; this lets it save progress for wallets that registered an id.
const savers = new WeakMap<WalletFacade, () => Promise<void>>();
export const registerStateSaver = (facade: WalletFacade, id: string): void => {
  savers.set(facade, () => saveWalletState(facade, id));
};
export const stateSaverFor = (facade: WalletFacade): (() => Promise<void>) | undefined => savers.get(facade);
