// SPDX-License-Identifier: Apache-2.0
import { MEASURED } from './measured';

// A model of the group's shared DUST fee key ("Group Commons") for the no-wallet demo.
//
// Protocol parameters are the published Preprod/Mainnet DUST parameters
// (docs.midnight.network/guides/manage-dust, checked 2026-09-30):
//   cap = 5 DUST per registered NIGHT; ~604,815 s (about one week) to fill;
//   new DUST UTXOs start at zero.
// The FEE PER CONTRACT CALL IS NOT MEASURED YET. ASSUMED_FEE_DUST falls back to a 1 DUST
// placeholder until a Preprod measurement is pasted into measured.ts (see PREPROD.md).

export const DUST_PER_NIGHT_CAP = 5;
export const SECONDS_TO_CAP = 604_815;
export const PLACEHOLDER_FEE_DUST = 1; // placeholder, unmeasured
/** True once a real Preprod fee has been pasted into measured.ts. */
export const FEE_IS_MEASURED = MEASURED.feeDustPerTx != null;
/** The fee the demo charges per transaction: the measured Preprod fee if there is one, else the placeholder. */
export const ASSUMED_FEE_DUST = MEASURED.feeDustPerTx ?? PLACEHOLDER_FEE_DUST;
/** What the fee key actually spends per call: the network fee plus the wallet SDK's fixed
 *  additionalFeeOverhead of 1,000 SPECK. On Preprod on 12 Oct 2026 the relay's balance fell by
 *  2,002 SPECK for two 1-SPECK calls. Before a measurement it is the placeholder fee. */
export const SDK_FEE_OVERHEAD_DUST = 1000e-15;
export const KEY_SPEND_PER_CALL_DUST = FEE_IS_MEASURED ? ASSUMED_FEE_DUST + SDK_FEE_OVERHEAD_DUST : PLACEHOLDER_FEE_DUST;

/** DUST for people: amounts under 0.001 DUST are shown in SPECK (1 DUST = 10^15 SPECK). Measured
 *  Preprod fees on 12 Oct 2026 were 1 SPECK a call, so "0.000000000000001 DUST" would only confuse. */
export function formatDust(d: number): string {
  if (d > 0 && d < 1e-3) return `${Math.round(d * 1e15).toLocaleString('en')} SPECK`;
  return `${Number(d.toPrecision(3))} DUST`;
}
/** The fee per call as shown on screen. */
export const FEE_TEXT = formatDust(ASSUMED_FEE_DUST);

export type Supporter = { name: string; night: number; note: string };

export class FeeCommons {
  epoch = 1;
  balance: number;
  supporters: Supporter[];
  spentByGroup = 0;
  spentByOthers = 0;
  txCount = 0;

  constructor(supporters: Supporter[], startFull = true) {
    this.supporters = [...supporters];
    this.balance = startFull ? this.cap : 0;
  }

  get night(): number {
    return this.supporters.reduce((a, s) => a + s.night, 0);
  }

  get cap(): number {
    return this.night * DUST_PER_NIGHT_CAP;
  }

  /** DUST generated per second for this key. */
  get ratePerSecond(): number {
    return this.cap / SECONDS_TO_CAP;
  }

  regenerate(seconds: number): void {
    this.balance = Math.min(this.cap, this.balance + this.ratePerSecond * seconds);
  }

  canPay(fee = KEY_SPEND_PER_CALL_DUST): boolean {
    // relative tolerance only: real fees are 1e-15 DUST, so an absolute epsilon would let an empty key pay
    return this.balance >= fee * (1 - 1e-9);
  }

  pay(fee = KEY_SPEND_PER_CALL_DUST, byGroup = true): void {
    if (!this.canPay(fee)) {
      throw new Error('The group fee key is out of DUST. It refills on its own; or rotate to a fresh key.');
    }
    this.balance -= fee;
    this.txCount += 1;
    if (byGroup) this.spentByGroup += fee;
    else this.spentByOthers += fee;
  }

  /** A supporter points their NIGHT's DUST generation at this key. Raises the cap; DUST still has to accrue. */
  designate(s: Supporter): void {
    this.supporters.push(s);
  }

  /** Move to a fresh key: supporters re-designate, and the new DUST starts at zero (protocol rule). */
  rotate(): void {
    this.epoch += 1;
    this.balance = 0;
  }
}
