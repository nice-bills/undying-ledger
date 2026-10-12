// SPDX-License-Identifier: Apache-2.0
// The public record of the Preprod run: addresses and transaction hashes anyone can look up.
// Null until a run is applied with `node ui/scripts/set-preprod.mjs .preprod/group.json .preprod/measure.json`
// (scripts/preprod.sh measure --apply does it). Never holds a secret: the script copies named
// public fields only.

export type PreprodTx = { txHash: string; feeDust: string; proofSeconds: number };
export type PreprodRun = {
  network: 'preprod';
  contract: string;
  deployTxHash: string | null;
  deployedAt: string | null;
  paidBy: string;
  callerDustSpeck: { before: string; after: string };
  recordMeeting: PreprodTx;
  attestSavings: PreprodTx;
  measuredAt: string;
};

export const PREPROD_RUN: PreprodRun | null = null;

/** Community Midnight explorer (Preprod); these two paths were checked against the real deploy on 12 Oct 2026. */
export const EXPLORER = 'https://preprod.midnightexplorer.com';
export const txLink = (hash: string) => `${EXPLORER}/transactions/${hash}`;
export const contractLink = (address: string) => `${EXPLORER}/contracts/${address}`;
