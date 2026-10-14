// SPDX-License-Identifier: Apache-2.0
// Invite links and the short PIN.
//
// An invite carries what a member would otherwise type: the contract address, the group secret,
// her own secret, her slot, and optionally the relay URL and a Blockfrost project ID. It travels
// in the URL fragment (#/live?invite=...), which browsers never send to a server, and the page
// strips it from the address bar once read. The link is the member's key: whoever holds it can
// act as her, so it is handed over by QR at the meeting or kept private like a passbook.
//
// The PIN replaces the 16-character passbook lock. Midnight.js still gets a long lock: it is
// derived from the PIN with PBKDF2 (600,000 rounds of SHA-256), salted with the contract and the
// member's own secret. Without the secret (the invite), the PIN alone opens nothing, and a stolen
// browser store cannot be tried against the 10^6 PINs. With the invite in hand, it can: a 6-digit
// PIN is a lock against a look over the shoulder, not against someone who has the link and time.
// No Buffer: this runs in the browser (see hex.ts).
import { hexToBytes } from './hex.js';

export type Invite = {
  contract: string;
  groupSecret: string;
  role: 'member' | 'secretary';
  /** The member's slot; 0 for the secretary. */
  slot: number;
  mySecret: string;
  relay?: string;
  blockfrost?: string;
};

const HEX32 = /^[0-9a-f]{64}$/;
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

/** Compact: a version, then the fields in order, joined by '.'. Hex keeps it URL-safe. */
export function encodeInvite(i: Invite): string {
  const parts = ['u1', i.contract, i.groupSecret, i.role === 'secretary' ? 's' : String(i.slot), i.mySecret, i.relay ? b64url(i.relay) : '', i.blockfrost ? b64url(i.blockfrost) : ''];
  return parts.join('.').replace(/\.+$/, '');
}

export class InviteError extends Error {}

export function decodeInvite(text: string): Invite {
  const t = decodeURIComponent(text.trim());
  const [v, contract, groupSecret, who, mySecret, relay, blockfrost] = t.split('.');
  if (v !== 'u1') throw new InviteError('This invite link is not one this page reads. Ask the secretary for a new one.');
  if (!/^[0-9a-f]{64,70}$/.test(contract ?? '') || !HEX32.test(groupSecret ?? '') || !HEX32.test(mySecret ?? '')) {
    throw new InviteError('This invite link is cut short or changed. Ask the secretary for a new one.');
  }
  const secretary = who === 's';
  const slot = secretary ? 0 : Number(who);
  if (!secretary && !(Number.isInteger(slot) && slot >= 0 && slot <= 29 && /^\d{1,2}$/.test(who ?? ''))) {
    throw new InviteError('This invite link has no member slot. Ask the secretary for a new one.');
  }
  let relayUrl: string | undefined;
  let bf: string | undefined;
  try {
    relayUrl = relay ? unb64url(relay) : undefined;
    bf = blockfrost ? unb64url(blockfrost) : undefined;
  } catch {
    throw new InviteError('This invite link is cut short or changed. Ask the secretary for a new one.');
  }
  if (relayUrl && !/^https?:\/\//.test(relayUrl)) throw new InviteError('The relay in this invite is not an http(s) address.');
  return { contract, groupSecret, role: secretary ? 'secretary' : 'member', slot, mySecret, relay: relayUrl, blockfrost: bf };
}

/** The link to hand over: `${base}#/live?invite=...`. */
export const inviteUrl = (base: string, i: Invite): string => `${base.split('#')[0]}#/live?invite=${encodeInvite(i)}`;

/** A 6-digit PIN that is not one digit repeated or a straight run (123456, 987654). */
export function checkPin(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return 'The PIN is 6 digits.';
  if (/^(\d)\1{5}$/.test(pin)) return 'Pick a PIN that is not one digit six times.';
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return 'Pick a PIN that is not a straight run like 123456.';
  return null;
}

export const PIN_ROUNDS = 600_000;
// 62 letters and digits plus four marks: every derived lock has three kinds of character
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789-_.~';

/** Midnight.js's lock rules (midnight-js-utils validatePassword): long, mixed, no runs or repeats. */
function passesLockRules(s: string): boolean {
  if (s.length < 16 || !/[A-Z]/.test(s) || !/[a-z]/.test(s) || !/[0-9]/.test(s)) return false;
  for (let i = 0; i + 3 < s.length; i++) {
    const c = [0, 1, 2, 3].map((k) => s.charCodeAt(i + k));
    if (c.every((x) => x === c[0])) return false;
    if (c.every((x, k) => x - c[0] === k) || c.every((x, k) => c[0] - x === k)) return false;
  }
  return true;
}

/**
 * The passbook lock for this PIN, contract and member secret. Deterministic, so the same PIN opens
 * the same passbook after a reload. `rounds` is lowered only by tests.
 */
export async function lockFromPin(pin: string, contract: string, mySecretHex: string, rounds = PIN_ROUNDS): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const salt = new Uint8Array([...new TextEncoder().encode(`undying-pin:${contract.toLowerCase()}:`), ...hexToBytes(mySecretHex)]);
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  let bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256));
  // A derived lock that happens to break a rule (a run like "abcd") is hashed again, deterministically.
  for (let n = 0; n < 64; n++) {
    const s = 'Pn7' + Array.from(bits.slice(0, 24), (b) => ALPHABET[b % ALPHABET.length]).join('');
    if (passesLockRules(s)) return s;
    bits = new Uint8Array(await subtle.digest('SHA-256', bits));
  }
  throw new Error('Could not derive a passbook lock from this PIN');
}

