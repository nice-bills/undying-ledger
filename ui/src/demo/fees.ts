// SPDX-License-Identifier: Apache-2.0
// A model of the group's shared DUST fee key ("Group Commons") for the no-wallet demo.
//
// Protocol parameters are the published Preprod/Mainnet DUST parameters
// (docs.midnight.network/guides/manage-dust, checked 2026-09-30):
//   cap = 5 DUST per registered NIGHT; ~604,815 s (about one week) to fill;
//   new DUST UTXOs start at zero.
// The FEE PER CONTRACT CALL IS NOT MEASURED. ASSUMED_FEE_DUST is a placeholder
// until it is measured on Preprod (see README, "Honest limitations").

export const DUST_PER_NIGHT_CAP = 5;
export const SECONDS_TO_CAP = 604_815;
export const ASSUMED_FEE_DUST = 1; // placeholder, unmeasured

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

  canPay(fee = ASSUMED_FEE_DUST): boolean {
    return this.balance + 1e-9 >= fee;
  }

  pay(fee = ASSUMED_FEE_DUST, byGroup = true): void {
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
