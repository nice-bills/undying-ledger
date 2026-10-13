// SPDX-License-Identifier: Apache-2.0
// A browser has no Buffer. Lace gives Midnight.js Bech32m keys, and decoding them goes through
// @midnight-ntwrk/wallet-sdk-address-format, which uses Buffer without importing it. Each test
// removes Node's Buffer only for a synchronous moment (vitest itself needs it), standing in for
// the browser, and shows the shim is what makes the decode work.
import { describe, expect, it } from 'vitest';
import { Buffer as PolyfillBuffer } from 'buffer';
import { MidnightBech32m, ShieldedCoinPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import { parseCoinPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';
import { installBuffer } from '../buffer-shim';

const g = globalThis as { Buffer?: unknown };
const HEX = 'a1'.repeat(32);
// what Lace's getShieldedAddresses() returns as shieldedCoinPublicKey
const BECH32 = ShieldedCoinPublicKey.codec.encode('preprod', new ShieldedCoinPublicKey(Buffer.from(HEX, 'hex'))).asString();

const withoutNodeBuffer = <T>(f: () => T): T => {
  const node = g.Buffer;
  delete g.Buffer;
  try {
    return f();
  } finally {
    g.Buffer = node;
  }
};

describe('Buffer in the browser (found on Preprod with Lace)', () => {
  it('decoding a Lace Bech32m coin key fails without Buffer, as in a browser', () => {
    expect(BECH32.startsWith('mn_shield-cpk_preprod')).toBe(true);
    expect(() => withoutNodeBuffer(() => MidnightBech32m.parse(BECH32))).toThrow(/Buffer is not defined/);
  });

  it('with the live page’s shim, it decodes to the same hex key', () => {
    const hex = withoutNodeBuffer(() => {
      installBuffer();
      expect(g.Buffer).toBe(PolyfillBuffer);
      return parseCoinPublicKeyToHex(BECH32, 'preprod');
    });
    expect(hex).toBe(HEX);
  });

  it('never replaces a Buffer that is already there', () => {
    const target = { Buffer: 'existing' as unknown };
    installBuffer(target);
    expect(target.Buffer).toBe('existing');
  });
});
