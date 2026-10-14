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
  /** Any member called sunset after the grace period, through the relay, holding 0 DUST. */
  sunset?: { txHash: string; block: number; at: string };
  /** The book keeps working after sunset: a meeting recorded on the same group, no vendor key left. */
  afterSunset?: { recordMeeting: { txHash: string; block: number } };
  /**
   * Contract v2 (groups of 30, member vote): every call made with NO member wallet, bound by a
   * burner key and paid by the group fee-key relay. Ends with three members electing a new
   * secretary after sunset, who then records a meeting.
   */
  v2?: {
    contract: string;
    deployTxHash: string;
    deployBlock: number;
    at: string;
    rows: { label: string; txHash: string; block: number; feeSpeck: string; proofSeconds: number }[];
    /** The same no-wallet path from this page in a real browser (headless Chromium), not from Node. */
    browser?: { label: string; txHash: string; block: number; feeSpeck: string }[];
  };
  /**
   * A real Lace wallet holding 0 tDUST, on #/live in Chromium: Lace balanced each call with
   * payFees: false and signed it, the group fee-key relay added the DUST fee.
   */
  lace?: {
    contract: string;
    deployTxHash: string;
    at: string;
    rows: { label: string; txHash: string; block: number; feeSpeck: string }[];
  };
  /** A second group (1 h grace) where the vendor checked in; a member's sunset was then refused. */
  heartbeat?: { contract: string; deployTxHash: string; txHash: string; block: number; sunsetRefused: string };
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
  "measuredAt": "2026-10-12T15:25:15.672Z",
  "sunset": {
    "txHash": "76cadb73800ccc27b7e8f2f1df02a499008566559445c7e2f1162f653e3fd0f9",
    "block": 2950326,
    "at": "2026-10-12T15:43:00Z"
  },
  "afterSunset": {
    "recordMeeting": { "txHash": "ec0e88f8c2326b95f326e22ec04286af3ab46ba9302e585cefae2d4d7157c99a", "block": 2950410 }
  },
  "v2": {
    "contract": "7a89acd2f41ee0f0c72cd3278d5e3bb7b96d76f1c663d751beeb8084703c2303",
    "deployTxHash": "1bf5e31ada871fb21b55c1f2cea7588d1b29e0fc5b6c4759f0e031c15668b4ce",
    "deployBlock": 2956697,
    "at": "2026-10-13T02:29:42.626Z",
    "browser": [
      {
        "label": "attestSavings, from a browser",
        "txHash": "761e7bc2ed64f516facd0c922ab7adfed400df503926135c5e3984625ac9246e",
        "block": 2956914,
        "feeSpeck": "1"
      },
      {
        "label": "voteSecretary, from a browser",
        "txHash": "89a0afbb9142018a9d75ca768675d3ca9645ad5a64e28dfa34b597f01d3e360e",
        "block": 2956919,
        "feeSpeck": "1"
      },
      {
        "label": "attestSavings, invite link and PIN",
        "txHash": "91669b577bbdbcf1c13d9bac43f8aa803ca0cde77d3a603c4124c2eab1ecd178",
        "block": 2972000,
        "feeSpeck": "1"
      },
      {
        "label": "voteSecretary, invite link and PIN",
        "txHash": "bc13d12799f6d2fe0b1f31e7e09749a211b93c1b43a5d804db5f9d05da9eead3",
        "block": 2972005,
        "feeSpeck": "1"
      }
    ],
    "rows": [
      {
        "label": "recordMeeting",
        "txHash": "60128464e4e6310c1914e0ddb29955dd6cfdf648ee93099c0f0e3fcb203833a2",
        "block": 2956754,
        "feeSpeck": "1",
        "proofSeconds": 3
      },
      {
        "label": "attestSavings",
        "txHash": "08a24610256b320779c45f2f3b6646c5f316847607ab6be9de7ad272ef60e8af",
        "block": 2956762,
        "feeSpeck": "1",
        "proofSeconds": 4.2
      },
      {
        "label": "sunset",
        "txHash": "787bc7635db17a0b22f9a57b92737fb3f865b48c0ccfad66035ed7fc3914e15e",
        "block": 2956767,
        "feeSpeck": "1",
        "proofSeconds": 1.1
      },
      {
        "label": "voteSecretary, slot 0",
        "txHash": "1839560423c9be4cd3af159f0b6e6c1705e93b3f0863005ccaff1a1c15d4f1f0",
        "block": 2956772,
        "feeSpeck": "1",
        "proofSeconds": 1.8
      },
      {
        "label": "voteSecretary, slot 1",
        "txHash": "3c1fc322ee17220335d87424bb910a9e18d11f30a693c6224b15615b6baba132",
        "block": 2956778,
        "feeSpeck": "0",
        "proofSeconds": 1.6
      },
      {
        "label": "voteSecretary, slot 2: elected",
        "txHash": "ddaa692e43c1dcc19931450ef6a6d35dfe85b249da8d3e524e2741120d0d859a",
        "block": 2956783,
        "feeSpeck": "1",
        "proofSeconds": 1.3
      },
      {
        "label": "recordMeeting by the elected secretary",
        "txHash": "34c43f4761d5ce5e9e7efe0d5755fee5450e2024b527c63440d4a066b2369987",
        "block": 2956788,
        "feeSpeck": "1",
        "proofSeconds": 2.1
      }
    ]
  },
  "lace": {
    "contract": "2e1965216ebe104a0dd382f7548f9dd5cb453e1f1b65bb75819d6ac49c20e5da",
    "deployTxHash": "1de57abeed1557e9abc6ce8698fa06fb7c95645cc2d015d8e9e1431c25c7dbba",
    "at": "2026-10-13T21:35:42.001Z",
    "rows": [
      {
        "label": "recordMeeting, signed in Lace",
        "txHash": "625e2fe2f181644247fc69471209d6874c70d0cbbc1aa73d1d442369663f8186",
        "block": 2968251,
        "feeSpeck": "1"
      },
      {
        "label": "attestSavings, signed in Lace",
        "txHash": "6703d63bc57ae926b863f61f7c0593046c71ba18ff4519310bd704341b75dee1",
        "block": 2968385,
        "feeSpeck": "1"
      }
    ]
  },
  "heartbeat": {
    "contract": "f1c7d8dc5a02ae4ce69898db599862bd1c2b79457b4c5db20f5c4b4054ec3485",
    "deployTxHash": "c0a2ab571d01eabfe6b6aafc002eb128f61df74779e7040d1786b7ae62feaf8a",
    "txHash": "4fd7f18cd031d78332b4d1c09c5a62354d73197c63f4f2021068dbc93973d706",
    "block": 2955062,
    "sunsetRefused": "The maintainer is still sending heartbeats"
  }
};

/** Community Midnight explorer (Preprod); these two paths were checked against the real deploy on 12 Oct 2026. */
export const EXPLORER = 'https://preprod.midnightexplorer.com';
export const txLink = (hash: string) => `${EXPLORER}/transactions/${hash}`;
export const contractLink = (address: string) => `${EXPLORER}/contracts/${address}`;
