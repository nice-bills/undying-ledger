// SPDX-License-Identifier: Apache-2.0
// Hex without Node's Buffer, for code that runs in the browser. The runtime packages' toHex and
// fromHex use Buffer, which a browser does not have: in a real browser on Preprod the member's
// proved call failed at the very last step ("Buffer is not defined") before it reached the relay.
export const bytesToHex = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
};

export const hexToBytes = (h: string): Uint8Array => {
  const s = h.trim().replace(/^0x/i, '');
  if (s.length % 2 || /[^0-9a-f]/i.test(s)) throw new Error('Not a hex string');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
};
