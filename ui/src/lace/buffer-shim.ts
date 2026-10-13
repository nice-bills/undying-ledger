// SPDX-License-Identifier: Apache-2.0
// @midnight-ntwrk/wallet-sdk-address-format calls Node's Buffer without importing it. Midnight.js
// runs it to decode a wallet's Bech32m coin and encryption keys, which Lace hands over (the
// no-wallet burner key is hex, so that path never touched it). Found with a real Lace on Preprod:
// "Unexpected error executing scoped transaction '<unnamed>': ReferenceError: Buffer is not
// defined" on the first recordMeeting. Loaded with the live write path only, never the landing.
import { Buffer } from 'buffer';

/** Give `target` (the page's globalThis) a Buffer if it has none. Never replaces one that exists. */
export function installBuffer(target: { Buffer?: unknown } = globalThis as { Buffer?: unknown }): void {
  if (typeof target.Buffer === 'undefined') target.Buffer = Buffer;
}

installBuffer();
