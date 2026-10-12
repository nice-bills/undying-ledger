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

export const PREPROD_RUN: PreprodRun | null = {
  "network": "preprod",
  "contract": "726bb6e0ce9d67ecc5c587a2f5f509ae39c26dbfd29d71c75f8d7de090ed7c61",
  "deployTxHash": "e95e3769116b1868e16cd61cca434e00513c264a966383573466b77561f3bef5",
  "deployedAt": "2026-10-12T14:47:15.474Z",
  "paidBy": "group fee key (relay)",
  "callerDustSpeck": {
    "before": "0",
    "after": "0"
  },
  "recordMeeting": {
    "txHash": "abbb61e7d1557627f3a2d655c46beee4999315817eeb517d5959db03e31becc5",
    "feeDust": "0.000000000000001",
    "proofSeconds": 3.9
  },
  "attestSavings": {
    "txHash": "c40214efed2fdd2869c789166b3dd575a5140fee9e09d55af7f720ec7406e320",
    "feeDust": "0.000000000000001",
    "proofSeconds": 3.8
  },
  "measuredAt": "2026-10-12T15:25:15.672Z"
};

/** Community Midnight explorer (Preprod); these two paths were checked against the real deploy on 12 Oct 2026. */
export const EXPLORER = 'https://preprod.midnightexplorer.com';
export const txLink = (hash: string) => `${EXPLORER}/transactions/${hash}`;
export const contractLink = (address: string) => `${EXPLORER}/contracts/${address}`;
