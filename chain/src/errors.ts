// SPDX-License-Identifier: Apache-2.0
// Errors the live (Preprod) path can hit, each with a message a member can act on.
// The UI shows `message` as is; `code` is for tests and for choosing what to offer next.

export type LiveErrorCode =
  | 'no-lace' // no Midnight Lace (dApp connector 4.x) in this browser
  | 'lace-refused' // the member declined the connection, or Lace did not answer
  | 'wrong-network' // Lace is on another network than Preprod
  | 'no-prover' // Lace has no proof server configured
  | 'prover-not-local' // Lace proves on a remote server (warning; the member can still go on)
  | 'no-indexer' // neither Lace nor a Blockfrost project ID gave an indexer
  | 'contract-not-found' // nothing deployed at that address on this network
  | 'payfees-refused' // Lace would not balance the call with payFees:false
  | 'relay-unreachable' // the fee-key relay URL did not answer
  | 'relay-refused' // the relay answered and said no
  | 'fee-choice-needed' // no relay URL and the member has not agreed to let Lace pay
  | 'bad-input'; // a secret, slot or stamp the member typed is malformed

export class LiveError extends Error {
  readonly code: LiveErrorCode;
  constructor(code: LiveErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LiveError';
    this.code = code;
  }
}

export const isLiveError = (e: unknown, code?: LiveErrorCode): e is LiveError =>
  e instanceof LiveError && (code === undefined || e.code === code);

/** The reason text out of a dApp connector APIError (or any thrown value). */
export const reasonOf = (e: unknown): string => {
  if (e && typeof e === 'object') {
    const r = (e as { reason?: unknown }).reason;
    if (typeof r === 'string' && r) return r;
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return String(e);
};
