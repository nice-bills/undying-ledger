// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';
import { checkPin, decodeInvite, encodeInvite, inviteUrl, lockFromPin, type Invite } from '../invite.js';

const A = 'ab'.repeat(32);
const G = '01'.repeat(32);
const M = 'cd'.repeat(32);
const member: Invite = { contract: A, groupSecret: G, role: 'member', slot: 3, mySecret: M, relay: 'http://192.168.1.20:3001', blockfrost: 'nightpreprodXYZ', prover: undefined };

describe('invite links', () => {
  it('round-trip a member and a secretary invite, with and without the extras', () => {
    expect(decodeInvite(encodeInvite(member))).toEqual(member);
    const sec: Invite = { contract: A, groupSecret: G, role: 'secretary', slot: 0, mySecret: M };
    expect(decodeInvite(encodeInvite(sec))).toEqual({ ...sec, relay: undefined, blockfrost: undefined, prover: undefined });
    // a group proof server, for phones that cannot run one; the fields before it may be empty
    const withProver: Invite = { ...member, relay: undefined, blockfrost: undefined, prover: 'https://prover.example:6300' };
    expect(decodeInvite(encodeInvite(withProver))).toEqual(withProver);
    expect(() => decodeInvite(encodeInvite({ ...member, prover: 'ftp://x' }))).toThrow(/proof server/);
  });

  it('live in the URL fragment, so no server sees them', () => {
    const u = new URL(inviteUrl('https://nice-bills.github.io/undying-ledger/#/demo', member));
    expect(u.search).toBe('');
    expect(u.hash.startsWith('#/live?invite=u1.')).toBe(true);
    expect(decodeInvite(new URLSearchParams(u.hash.split('?')[1]).get('invite')!)).toEqual(member);
  });

  it('a cut-short, changed or foreign link says so', () => {
    const t = encodeInvite(member);
    expect(() => decodeInvite(t.slice(0, 80))).toThrow(/cut short/);
    expect(() => decodeInvite(t.replace('u1.', 'u9.'))).toThrow(/not one this page reads/);
    expect(() => decodeInvite(t.replace('.3.', '.31.'))).toThrow(/no member slot/);
    expect(() => decodeInvite(encodeInvite({ ...member, relay: 'javascript:alert(1)' }))).toThrow(/not an http/);
  });
});

describe('the PIN', () => {
  it('is 6 digits, not one digit repeated or a straight run', () => {
    expect(checkPin('482916')).toBeNull();
    expect(checkPin('12345')).toMatch(/6 digits/);
    expect(checkPin('000000')).toMatch(/one digit/);
    expect(checkPin('123456')).toMatch(/straight run/);
    expect(checkPin('987654')).toMatch(/straight run/);
    expect(checkPin('12a456')).toMatch(/6 digits/);
  });

  it('becomes a lock Midnight.js accepts, the same every time, different per member and per group', async () => {
    const rounds = 1000; // the page uses 600,000
    const a = await lockFromPin('482916', A, M, rounds);
    expect(() => validatePassword(a)).not.toThrow();
    expect(await lockFromPin('482916', A, M, rounds)).toBe(a);
    expect(await lockFromPin('482917', A, M, rounds)).not.toBe(a);
    expect(await lockFromPin('482916', A, G, rounds)).not.toBe(a);
    expect(await lockFromPin('482916', 'ef'.repeat(32), M, rounds)).not.toBe(a);
    // many PINs: every derived lock passes the rules
    for (let p = 100000; p < 100040; p++) {
      const lock = await lockFromPin(String(p), A, M, 100);
      expect(() => validatePassword(lock)).not.toThrow();
    }
  });
});
