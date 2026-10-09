// SPDX-License-Identifier: Apache-2.0
// Numbers measured on Midnight Preprod. Every field is null until someone measures it
// (see PREPROD.md, step 8). While feeDustPerTx is null the demo uses the 1 DUST placeholder
// and says so on screen. Paste real values here, or run:
//   node scripts/set-measured.mjs --fee 0.42 --record 18.2 --attest 12.9 --date 2026-10-12
// then rebuild (`npm run build`).

export type Measured = {
  /** DUST paid by the group fee key for one contract call, as read from the relay / wallet. */
  feeDustPerTx: number | null;
  /** Wall-clock seconds from "prove" to "proof ready" on the local proof server. */
  proofSeconds: { recordMeeting: number | null; attestSavings: number | null };
  /** When and where it was measured, e.g. "2026-10-12, Preprod, proof-server 8.1.0 on a laptop". */
  measuredOn: string | null;
};

export const MEASURED: Measured = {
  feeDustPerTx: null,
  proofSeconds: { recordMeeting: null, attestSavings: null },
  measuredOn: null,
};
