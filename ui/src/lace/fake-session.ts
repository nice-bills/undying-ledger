// SPDX-License-Identifier: Apache-2.0
// DEV ONLY. A stand-in for LiveSession so the joined-group screens (secretary sheet, stamps,
// passbook, proof, sunset) can be looked at and screenshotted without Lace, a proof server or
// Preprod. Reached only from `npm run dev` at #/live?fake=1; LivePage gates the import behind
// import.meta.env.DEV, so a production build drops this file. Every figure here is made up.
import type { Entry } from '@undying-ledger/contract';
import { LiveError } from '@undying-ledger/chain/src/errors';
import type { GroupView, Role, Stage } from './live-session';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STEP = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('step') ?? 700);

export function fakeSession() {
  let listener: ((s: Stage) => void) | undefined;
  let fee = { relayUrl: '', letLacePay: false };
  let me: { role: Role; slot: number } | undefined;
  const g: GroupView = { address: 'ab'.repeat(32), memberCount: 5, meetings: 12, phase: 'Active' };
  const book = { shares: 29n, socialFund: 24n, loanOutstanding: 0n, version: 12 };

  const tx = async () => {
    if (!fee.relayUrl && !fee.letLacePay)
      throw new LiveError('fee-choice-needed', 'Give the group fee-key relay URL, or agree to let Lace pay this fee from your own DUST.');
    for (const s of ['proving', 'balancing', ...(fee.relayUrl ? (['relay'] as const) : []), 'submitting'] as Stage[]) {
      listener?.(s);
      await wait(STEP);
    }
    listener?.('done');
    return Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(i * 7 + g.meetings) % 16]).join('');
  };

  return {
    setup: { proverUri: 'http://localhost:6300', proverLocal: true, warnings: [] as string[] },
    onStage: (f: ((s: Stage) => void) | undefined) => void (listener = f),
    setFee: (relayUrl: string, letLacePay: boolean) => void (fee = { relayUrl: relayUrl.trim(), letLacePay }),
    get joined() {
      return !!me;
    },
    get role() {
      return me?.role;
    },
    get slot() {
      return me?.slot;
    },
    async attach(o: { address: string; role: Role; slot?: number }) {
      await wait(STEP);
      me = { role: o.role, slot: o.slot ?? 0 };
      g.address = o.address;
      return { ...g };
    },
    async group() {
      return { ...g };
    },
    async recordMeeting(entries: Entry[]) {
      await tx();
      g.meetings += 1;
      book.shares += entries[0]?.shares ?? 0n;
      book.version += 1;
      return entries.map((e, i) => `undying-stamp:${i}:${i === 0 ? book.shares : 10n + e.shares}:${g.meetings}:${i}`);
    },
    async openPassbook() {
      await wait(STEP);
      return {
        slot: me?.slot ?? 0,
        passbook: { shares: book.shares, socialFund: book.socialFund, loanOutstanding: book.loanOutstanding },
        matchesLedger: true,
        version: book.version,
        meetings: g.meetings,
      };
    },
    async importStamp(_text: string) {
      return this.openPassbook();
    },
    async proveAtLeast(minShares: number) {
      if (BigInt(minShares) > book.shares)
        throw new Error(`failed assert: Not enough shares`);
      const txId = await tx();
      return { minShares, ref: '93d07dfb9737', txId };
    },
    async sunset() {
      const txId = await tx();
      g.phase = 'Sunset';
      return { txId };
    },
  };
}
