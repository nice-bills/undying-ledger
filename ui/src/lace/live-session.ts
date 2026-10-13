// SPDX-License-Identifier: Apache-2.0
// Live write-through to Preprod from the member's browser: connect Lace, build the Midnight.js
// providers (chain/src/browser.ts), join a deployed group by address, and call the real circuits
// (chain/src/api.ts). No React here, so the wiring is unit-tested with a mocked window.midnight
// and mocked providers (./__tests__/live-session.test.ts).
//
// Loaded only after "Check my Lace setup" finds Lace, so neither the simulator demo nor the
// read-only register ships it. Shape follows example-bboard's BrowserDeployedBoardManager
// (cached providers, join by address) and api/src/index.ts.
//
// NOT RUN AGAINST PREPROD: the build machine had no Lace, no proof server and no tNIGHT.
import './buffer-shim';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createPrivateState, DOMAINS, Phase, roleKey, type Entry, type Ledger } from '@undying-ledger/contract';
import {
  browserPrivateStateProvider,
  buildBurnerProviders,
  buildProviders,
  checkLaceSetup,
  checkPassphrase,
  connectToWallet,
  isLocalProver,
  LOCAL_PROVER,
  type FeeMode,
  type LaceSetup,
  type Stage,
} from '@undying-ledger/chain/src/browser';
import { UndyingAPI, type OpenedPassbook } from '@undying-ledger/chain/src/api';
import type { UndyingProviders } from '@undying-ledger/chain/src/common';
import { LiveError } from '@undying-ledger/chain/src/errors';

export { LiveError, isLiveError } from '@undying-ledger/chain/src/errors';
export type { Stage } from '@undying-ledger/chain/src/browser';

export const NETWORK = 'preprod';
export const MAX_SLOT = 29; // groups of up to 30
export type Role = 'secretary' | 'member';
/** Where the session gets its keys: Lace, or no wallet at all (a burner key and the relay). */
export type Source = { kind: 'lace'; connected: ConnectedAPI } | { kind: 'burner' };
/** What the page shows about the prover. Lace's configuration is present only with Lace. */
export type Setup = Omit<LaceSetup, 'config'> & { config?: LaceSetup['config'] };

export type AttachOpts = {
  address: string;
  role: Role;
  mySecretHex: string;
  groupSecretHex: string;
  /** The member's own slot; ignored for the secretary. */
  slot?: number;
  /** Encrypts this browser's private state (IndexedDB). Midnight.js asks for 16+ characters, 3 kinds. */
  passphrase: string;
  /** Where keys/ and zkir/ from `compact compile` are served. */
  zkConfigBaseUrl: string;
  blockfrostProjectId?: string;
};

export type GroupView = { address: string; memberCount: number; meetings: number; phase: 'Active' | 'Sunset' };

const hex32 = (h: string, what: string): Uint8Array => {
  const s = h.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(s)) throw new LiveError('bad-input', `${what} must be 64 hex characters (32 bytes), as printed in .preprod/group.json.`);
  return Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));
};
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

const wrongLock = (e: unknown): boolean =>
  (e as { name?: string })?.name === 'OperationError' || /Salt mismatch|different password/i.test((e as Error)?.message ?? '');

export const normaliseAddress = (a: string): string => {
  const s = a.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{64,70}$/i.test(s)) throw new LiveError('bad-input', 'That does not look like a contract address (hex). Paste the address printed by the deploy script.');
  return s.toLowerCase();
};

const view = (address: string, L: Ledger): GroupView => ({
  address,
  memberCount: Number(L.memberCount),
  meetings: Number(L.meetings),
  phase: L.phase === Phase.ACTIVE ? 'Active' : 'Sunset',
});

export class LiveSession {
  private fee: { relayUrl: string; letLacePay: boolean } = { relayUrl: '', letLacePay: false };
  private stageListener: ((s: Stage) => void) | undefined;
  private providers: UndyingProviders | undefined;
  /** What the providers were built with: a new passbook lock (or burner account) rebuilds them. */
  private providersFor: string | undefined;
  private api: UndyingAPI | undefined;
  private me: { role: Role; slot: number; groupSecret: Uint8Array } | undefined;

  private constructor(
    readonly source: Source,
    readonly setup: Setup,
  ) {}

  /** Find Lace, connect to Preprod, and check its network and prover. Throws LiveError. */
  static async connect(networkId = NETWORK, waitMs = 1_500): Promise<LiveSession> {
    const connected = await connectToWallet(networkId, waitMs);
    const setup = await checkLaceSetup(connected, networkId);
    setNetworkId(networkId);
    return new LiveSession({ kind: 'lace', connected }, setup);
  }

  /**
   * No wallet: proofs on this machine's proof server, a burner key binds each call, and the group
   * fee-key relay pays. The member installs nothing and holds no tokens.
   */
  static noWallet(proverUri = LOCAL_PROVER, networkId = NETWORK): LiveSession {
    setNetworkId(networkId);
    const proverLocal = isLocalProver(proverUri);
    const warnings = proverLocal ? [] : [`The proof server ${proverUri} is not on this machine. Your passbook would be sent there to be proved. Use ${LOCAL_PROVER}.`];
    return new LiveSession({ kind: 'burner' }, { proverUri, proverLocal, warnings });
  }

  get noWalletMode(): boolean {
    return this.source.kind === 'burner';
  }

  /** The public key that goes on the book for a secretary secret (for an election). */
  static secretaryKeyFor(secretHex: string): string {
    return toHex(roleKey(DOMAINS.secretary, hex32(secretHex, 'The secretary secret')));
  }

  onStage(f: ((s: Stage) => void) | undefined) {
    this.stageListener = f;
  }

  /** Relay URL for the group fee key, or the member's on-screen yes to let Lace pay. */
  setFee(relayUrl: string, letLacePay: boolean) {
    this.fee = { relayUrl: relayUrl.trim(), letLacePay };
  }

  /** The fee path every call takes. Throws when the member has not chosen one. */
  feeMode(): FeeMode {
    const { relayUrl, letLacePay } = this.fee;
    if (relayUrl) {
      try {
        const u = new URL(relayUrl);
        if (!/^https?:$/.test(u.protocol)) throw new Error('scheme');
      } catch {
        throw new LiveError('bad-input', `The relay URL "${relayUrl}" is not an http(s) address, for example http://localhost:3001.`);
      }
      return { kind: 'group-fee-key', relayUrl };
    }
    if (this.noWalletMode) throw new LiveError('fee-choice-needed', 'Without a wallet, the group fee-key relay pays every fee. Give its URL above.');
    if (letLacePay) return { kind: 'wallet' };
    throw new LiveError('fee-choice-needed', 'Give the group fee-key relay URL, or agree to let Lace pay this fee from your own DUST.');
  }

  get joined(): boolean {
    return !!this.api;
  }
  get role(): Role | undefined {
    return this.me?.role;
  }
  get slot(): number | undefined {
    return this.me?.slot;
  }

  /** Join (attach to) a deployed group by address, with this device's secrets. */
  async attach(o: AttachOpts): Promise<GroupView> {
    const address = normaliseAddress(o.address);
    const mySecret = hex32(o.mySecretHex, o.role === 'secretary' ? 'The secretary secret' : 'Your member secret');
    const groupSecret = hex32(o.groupSecretHex, 'The group secret');
    const slot = o.role === 'member' ? Number(o.slot) : 0;
    if (o.role === 'member' && (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT)) throw new LiveError('bad-input', `Your slot is a whole number from 0 to ${MAX_SLOT}.`);
    if (!o.passphrase) throw new LiveError('bad-input', 'Choose a passphrase to lock your passbook on this phone.');
    checkPassphrase(o.passphrase);

    const onStage = (s: Stage) => this.stageListener?.(s);
    // No wallet address to scope the stored passbook to: use this device's public role key,
    // so the same secret finds the same passbook after a reload.
    const account = this.source.kind === 'lace' ? 'lace' : toHex(roleKey(o.role === 'secretary' ? DOMAINS.secretary : DOMAINS.member, mySecret));
    const builtFor = `${account}:${o.passphrase}`;
    let providers = this.providersFor === builtFor ? this.providers : undefined;
    if (!providers && this.source.kind === 'lace') {
      const shielded = await this.source.connected.getShieldedAddresses();
      providers = await buildProviders({
        connected: this.source.connected,
        config: this.setup.config!,
        zkConfigBaseUrl: o.zkConfigBaseUrl,
        privateStateProvider: browserPrivateStateProvider(shielded.shieldedCoinPublicKey, o.passphrase),
        feeMode: () => this.feeMode(),
        blockfrostProjectId: o.blockfrostProjectId,
        onStage,
      });
    } else if (!providers) {
      providers = buildBurnerProviders({
        zkConfigBaseUrl: o.zkConfigBaseUrl,
        proverUri: this.setup.proverUri,
        blockfrostProjectId: o.blockfrostProjectId,
        privateStateProvider: browserPrivateStateProvider(`burner-${account}`, o.passphrase),
        relayUrl: () => this.feeMode().kind === 'group-fee-key' ? this.fee.relayUrl : '',
        onStage,
      });
    }
    this.providers = providers;
    this.providersFor = builtFor;

    let api: UndyingAPI;
    try {
      api = await UndyingAPI.join(providers, o.zkConfigBaseUrl, address as never, createPrivateState(mySecret, groupSecret));
    } catch (e) {
      // The passbook store in this browser is encrypted with the lock chosen the first time; AES-GCM
      // refuses any other with an OperationError whose message is empty (found on Preprod with Lace).
      if (wrongLock(e)) {
        throw new LiveError(
          'bad-input',
          'This browser already keeps a passbook locked with a different passbook lock. Type the lock you chose the first time. If it is forgotten, clear this site\'s data in the browser settings, join again with a new lock, and keep your latest stamp from the secretary.',
          { cause: e },
        );
      }
      throw e;
    }
    const L = await api.currentLedger();
    // Check the secrets against the public keys on the book before any proof is spent on them.
    if (!same(roleKey(DOMAINS.group, groupSecret), L.groupKeyTag)) {
      throw new LiveError('bad-input', 'That group secret does not belong to this group.');
    }
    if (o.role === 'secretary' && !same(roleKey(DOMAINS.secretary, mySecret), L.secretaryKey)) {
      throw new LiveError('bad-input', 'That is not the secretary secret for this group.');
    }
    if (o.role === 'member') {
      if (slot >= Number(L.memberCount)) throw new LiveError('bad-input', `Slot ${slot} is not in this group (it has ${L.memberCount} members).`);
      if (!same(roleKey(DOMAINS.member, mySecret), L.memberKeys.lookup(BigInt(slot)))) {
        throw new LiveError('bad-input', `That secret is not the member in slot ${slot}.`);
      }
    }
    this.api = api;
    this.me = { role: o.role, slot, groupSecret };
    return view(api.address, L);
  }

  private need(): UndyingAPI {
    if (!this.api) throw new LiveError('bad-input', 'Join the group first.');
    return this.api;
  }

  private async run<T>(f: () => Promise<T>): Promise<T> {
    this.feeMode(); // fail before proving if no fee path is chosen
    try {
      return await f();
    } finally {
      this.stageListener?.('done');
    }
  }

  async group(): Promise<GroupView> {
    const api = this.need();
    return view(api.address, await api.currentLedger());
  }

  /** Secretary: record a meeting. Returns one stamp per slot to hand to the members. */
  async recordMeeting(entries: Entry[]): Promise<string[]> {
    const api = this.need();
    if (this.me?.role !== 'secretary') throw new LiveError('bad-input', 'Only the secretary records meetings.');
    const L = await api.currentLedger();
    return this.run(() => api.recordMeeting(entries, Number(L.memberCount)));
  }

  /** Member: open my own passbook from this phone's private state, checked against the sealed line. */
  async openPassbook(): Promise<OpenedPassbook> {
    const api = this.need();
    if (this.me?.role !== 'member') throw new LiveError('bad-input', 'Join as a member to open your passbook.');
    return api.openOwnPassbook(this.me.slot);
  }

  /** Member: keep a stamp from the secretary (checked against the book first). */
  async importStamp(text: string): Promise<OpenedPassbook> {
    const api = this.need();
    const opened = await api.importStamp(text);
    if (this.me?.role === 'member' && opened.slot !== this.me.slot) {
      throw new LiveError('bad-input', `That stamp is for slot ${opened.slot}; you are slot ${this.me.slot}.`);
    }
    return opened;
  }

  /** Member: prove "at least `minShares` shares" for a loan officer's reference. */
  async proveAtLeast(minShares: number, nonce: Uint8Array = crypto.getRandomValues(new Uint8Array(32))): Promise<{ minShares: number; ref: string; txId?: string }> {
    const api = this.need();
    if (this.me?.role !== 'member') throw new LiveError('bad-input', 'Join as a member to prove your savings.');
    if (!Number.isInteger(minShares) || minShares < 1) throw new LiveError('bad-input', 'Ask for at least 1 share.');
    const slot = this.me.slot;
    const r = await this.run(() => api.attestSavings(BigInt(slot), BigInt(minShares), nonce));
    return { minShares, ref: toHex(nonce).slice(0, 16), txId: (r as { public?: { txId?: string } })?.public?.txId };
  }

  /** Member: vote for a new secretary key (more than half of all members elects her). */
  async voteSecretary(candidateKeyHex: string): Promise<{ elected: boolean; txId?: string }> {
    const api = this.need();
    if (this.me?.role !== 'member') throw new LiveError('bad-input', 'Join as a member to vote.');
    const key = hex32(candidateKeyHex, 'The candidate’s secretary key');
    const slot = this.me.slot;
    const r = await this.run(() => api.voteSecretary(BigInt(slot), key));
    const L = await api.currentLedger();
    return { elected: same(L.secretaryKey, key), txId: (r as { public?: { txId?: string } })?.public?.txId };
  }

  /** Anyone: end the vendor's admin powers once the grace period has run out. */
  async sunset(): Promise<{ txId?: string }> {
    const api = this.need();
    const r = await this.run(() => api.sunset());
    return { txId: (r as { public?: { txId?: string } })?.public?.txId };
  }
}
