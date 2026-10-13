// SPDX-License-Identifier: Apache-2.0
// Live write-through wiring, with a mocked Lace (window.midnight, dApp connector 4.0.1) and mocked
// Midnight.js providers. What is real here: chain/src/browser.ts, chain/src/api.ts,
// ui/src/lace/live-session.ts, the contract's pure circuits (roleKey, passbookCommitment) and
// applyEntry. What is faked: Lace, the proof server, the indexer, IndexedDB, the relay, and
// findDeployedContract (its callTx runs prove -> balance -> submit through our providers the way
// Midnight.js's submitCallTx does, then updates a fake ledger with the real commitment).
//
// This proves the wiring and the error paths. It does not prove that Preprod, Lace or the
// relay behave like the fakes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import {
  applyEntry,
  DOMAINS,
  Phase,
  pureCircuits,
  roleKey,
  ZERO_ENTRY,
  ZERO_PASSBOOK,
  type Entry,
  type Passbook,
} from '@undying-ledger/contract';

// ---------------------------------------------------------------- a fake chain

type Chain = {
  memberKeys: Uint8Array[];
  secretaryKey: Uint8Array;
  groupKeyTag: Uint8Array;
  meetings: number;
  phase: Phase;
  passbooks: bigint[];
  versions: bigint[];
  graceOver: boolean;
  votes: Map<number, string>;
};
const bytes = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + n) & 0xff);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const GS = bytes(1);
const SEC = bytes(2);
const MEMBERS = [bytes(10), bytes(11), bytes(12)];
const ADDRESS = 'ab'.repeat(32);

let chain: Chain;
const freshChain = (): Chain => ({
  memberKeys: MEMBERS.map((s) => roleKey(DOMAINS.member, s)),
  secretaryKey: roleKey(DOMAINS.secretary, SEC),
  groupKeyTag: roleKey(DOMAINS.group, GS),
  meetings: 0,
  phase: Phase.ACTIVE,
  passbooks: MEMBERS.map((_, i) => pureCircuits.passbookCommitment(ZERO_PASSBOOK, GS, BigInt(i), 0n)),
  versions: MEMBERS.map(() => 0n),
  graceOver: false,
  votes: new Map(),
});
const map = <V>(arr: V[]) => ({
  isEmpty: () => arr.length === 0,
  size: () => BigInt(arr.length),
  member: (k: bigint) => Number(k) < arr.length,
  lookup: (k: bigint) => arr[Number(k)],
  [Symbol.iterator]: () => arr.map((v, i) => [BigInt(i), v] as [bigint, V])[Symbol.iterator](),
});
const fakeLedger = (c: Chain) => ({
  memberCount: BigInt(c.memberKeys.length),
  memberKeys: map(c.memberKeys),
  passbooks: map(c.passbooks),
  passbookVersion: map(c.versions),
  secretaryKey: c.secretaryKey,
  maintainerKey: new Uint8Array(32),
  groupKeyTag: c.groupKeyTag,
  meetings: BigInt(c.meetings),
  lastHeartbeat: 0n,
  graceSeconds: 300n,
  phase: c.phase,
  feeKeyEpoch: 1n,
  feeKeyTag: new Uint8Array(32),
  attestations: map([] as bigint[]),
});

// ---------------------------------------------------------------- module mocks

const h = vi.hoisted(() => ({
  pdp: null as null | Record<string, unknown>,
  stores: new Map<string, Map<string, unknown>>(),
  levelCfg: [] as unknown[],
  proofUrls: [] as string[],
  indexerUrls: [] as string[][],
  findCalls: [] as Record<string, unknown>[],
  calls: [] as { circuit: string; args: unknown[] }[],
}));

vi.mock('@undying-ledger/contract', async (orig) => {
  const real = await orig<typeof import('@undying-ledger/contract')>();
  return { ...real, ledger: (data: unknown) => data };
});
vi.mock('@midnight-ntwrk/midnight-js-network-id', () => ({ setNetworkId: vi.fn() }));
vi.mock('@midnight-ntwrk/midnight-js-fetch-zk-config-provider', () => ({
  FetchZkConfigProvider: class {
    constructor(readonly base: string) {}
  },
}));
vi.mock('@midnight-ntwrk/midnight-js-http-client-proof-provider', () => ({
  httpClientProofProvider: (url: string) => {
    h.proofUrls.push(url);
    return {
      proveTx: async (tx: unknown) => {
        const proved: Record<string, unknown> = { ...(tx as object), proved: true, serialize: () => new Uint8Array([1, 2, 3]) };
        proved.bind = () => ({ ...proved, bound: true });
        return proved;
      },
    };
  },
}));
vi.mock('@midnight-ntwrk/midnight-js-indexer-public-data-provider', () => ({
  indexerPublicDataProvider: (a: string, b: string) => {
    h.indexerUrls.push([a, b]);
    return h.pdp;
  },
}));
vi.mock('@midnight-ntwrk/midnight-js-level-private-state-provider', () => ({
  levelPrivateStateProvider: (cfg: { accountId: string }) => {
    h.levelCfg.push(cfg);
    let addr = '';
    const scoped = () => {
      if (!h.stores.has(addr)) h.stores.set(addr, new Map());
      return h.stores.get(addr)!;
    };
    return {
      setContractAddress: (a: string) => (addr = a),
      get: async (k: string) => scoped().get(k) ?? null,
      set: async (k: string, v: unknown) => void scoped().set(k, v),
      remove: async (k: string) => void scoped().delete(k),
      clear: async () => scoped().clear(),
      getSigningKey: async () => null,
      setSigningKey: async () => undefined,
      removeSigningKey: async () => undefined,
      clearSigningKeys: async () => undefined,
    };
  },
}));
vi.mock('@midnight-ntwrk/midnight-js-protocol/ledger', () => ({
  ZswapSecretKeys: { fromSeed: () => ({ coinPublicKey: 'burner-coin', encryptionPublicKey: 'burner-enc', clear: () => undefined }) },
  Transaction: {
    deserialize: (_s: string, _p: string, _b: string, raw: Uint8Array) => ({
      raw,
      serialize: () => raw,
      identifiers: () => ['00ff' + Array.from(raw, (x) => x.toString(16).padStart(2, '0')).join('')],
    }),
  },
}));

// findDeployedContract: callTx runs our providers the way submitCallTx does, then the "chain" updates.
vi.mock('@midnight-ntwrk/midnight-js-contracts', () => ({
  deployContract: vi.fn(),
  findDeployedContract: async (providers: any, opts: any) => {
    h.findCalls.push(opts);
    if (opts.initialPrivateState) await providers.privateStateProvider.set(opts.privateStateId, opts.initialPrivateState);
    const submit = async (circuit: string, args: unknown[], effect: () => void) => {
      h.calls.push({ circuit, args });
      const ps = await providers.privateStateProvider.get(opts.privateStateId);
      if (!ps) throw new Error('no private state');
      const unproven = { circuit, serialize: () => new Uint8Array([9]) };
      const unbound = await providers.proofProvider.proveTx(unproven);
      const balanced = await providers.walletProvider.balanceTx(unbound);
      const txId = await providers.midnightProvider.submitTx(balanced);
      effect();
      return { public: { txId } };
    };
    return {
      deployTxData: { public: { contractAddress: opts.contractAddress } },
      callTx: {
        recordMeeting: (page: bigint, entries: Entry[]) =>
          submit('recordMeeting', [page, entries], () => {
            if (page === 0n) chain.meetings += 1;
            // the real circuit re-commits every slot on the page; mirror it with the real pure circuit
            const ps = h.stores.get(opts.contractAddress)!.get(opts.privateStateId) as { passbooks: Record<string, Passbook> };
            entries.forEach((e, j) => {
              const slot = Number(page) * 5 + j;
              if (slot >= chain.passbooks.length) return;
              const next = applyEntry(ps.passbooks[String(slot)] ?? ZERO_PASSBOOK, e);
              chain.versions[slot] += 1n;
              chain.passbooks[slot] = pureCircuits.passbookCommitment(next, GS, BigInt(slot), chain.versions[slot]);
            });
          }),
        attestSavings: (slot: bigint, min: bigint, nonce: Uint8Array) => submit('attestSavings', [slot, min, nonce], () => undefined),
        voteSecretary: (slot: bigint, key: Uint8Array) =>
          submit('voteSecretary', [slot, key], () => {
            chain.votes.set(Number(slot), hex(key));
            const n = [...chain.votes.values()].filter((v) => v === hex(key)).length;
            if (n * 2 > chain.memberKeys.length) chain.secretaryKey = key;
          }),
        sunset: () =>
          submit('sunset', [], () => {
            if (!chain.graceOver) throw new Error('failed assert: The vendor is still sending heartbeats; wait for the grace period');
            chain.phase = Phase.SUNSET;
          }),
      },
    };
  },
}));

// ---------------------------------------------------------------- a fake Lace

type LaceOpts = { networkId?: string; prover?: string | undefined; refuseConnect?: string; refusePayFeesFalse?: boolean };
const makeLace = (o: LaceOpts = {}) => {
  const connected = {
    getConfiguration: vi.fn(async () => ({
      indexerUri: 'https://lace-indexer.example/api',
      indexerWsUri: 'wss://lace-indexer.example/ws',
      proverServerUri: 'prover' in o ? o.prover : 'http://localhost:6300',
      substrateNodeUri: 'wss://node.example',
      networkId: o.networkId ?? 'preprod',
    })),
    getShieldedAddresses: vi.fn(async () => ({ shieldedAddress: 'mn_shield_test', shieldedCoinPublicKey: 'coinpk-test', shieldedEncryptionPublicKey: 'encpk-test' })),
    balanceUnsealedTransaction: vi.fn(async (tx: string, opts?: { payFees?: boolean }) => {
      if (o.refusePayFeesFalse && opts?.payFees === false) {
        throw Object.assign(new Error('x'), { type: 'DAppConnectorAPIError', code: 'Rejected', reason: 'payFees false is not supported' });
      }
      return { tx: tx + 'beef' };
    }),
    submitTransaction: vi.fn(async () => undefined),
  };
  const initial = {
    rdns: 'io.lace.wallet',
    name: 'lace',
    icon: '',
    apiVersion: '4.0.1',
    connect: vi.fn(async (net: string) => {
      if (o.refuseConnect) throw Object.assign(new Error('x'), { type: 'DAppConnectorAPIError', code: 'PermissionRejected', reason: o.refuseConnect });
      void net;
      return connected;
    }),
  };
  (globalThis as any).midnight = { mnLace: initial };
  return { initial, connected };
};

const fetchMock = vi.fn();
beforeEach(() => {
  chain = freshChain();
  h.stores.clear();
  h.levelCfg.length = 0;
  h.proofUrls.length = 0;
  h.indexerUrls.length = 0;
  h.findCalls.length = 0;
  h.calls.length = 0;
  h.pdp = {
    queryContractState: vi.fn(async (a: string) => (a === ADDRESS ? { data: fakeLedger(chain) } : null)),
    contractStateObservable: () => of({ data: fakeLedger(chain) }),
  };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  delete (globalThis as any).midnight;
  vi.unstubAllGlobals();
});

const { LiveSession, isLiveError } = await import('../live-session');
const { isLocalProver, resolveIndexer, submitViaGroupFeeKey } = await import('@undying-ledger/chain/src/browser');
const { parseStamp, formatStamp } = await import('@undying-ledger/chain/src/api');

const PASS = 'Kpalsi-Group-2026!x';
const join = async (s: Awaited<ReturnType<typeof LiveSession.connect>>, role: 'secretary' | 'member' = 'secretary', slot = 0, extra: Record<string, unknown> = {}) =>
  s.attach({
    address: ADDRESS,
    role,
    mySecretHex: hex(role === 'secretary' ? SEC : MEMBERS[slot]),
    groupSecretHex: hex(GS),
    slot,
    passphrase: PASS,
    zkConfigBaseUrl: 'http://localhost:5173/zk/',
    ...extra,
  });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return isLiveError(e) ? e.code : `not a LiveError: ${(e as Error).message}`;
  }
  return 'resolved';
};
const relayOk = () =>
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true, txId: 'relay-tx-1' }), { status: 200 }));

// ---------------------------------------------------------------- connect

describe('connect to Lace', () => {
  it('without window.midnight: no-lace, with the install hint', async () => {
    await expect(LiveSession.connect('preprod', 50)).rejects.toThrow('No Lace wallet in this browser');
    expect(await code(LiveSession.connect('preprod', 50))).toBe('no-lace');
  });

  it('ignores wallets that do not speak dApp connector 4.x', async () => {
    (globalThis as any).midnight = { old: { apiVersion: '3.2.0', connect: vi.fn() } };
    expect(await code(LiveSession.connect('preprod', 50))).toBe('no-lace');
  });

  it('connects to preprod and reports a local prover as good', async () => {
    const { initial } = makeLace();
    const s = await LiveSession.connect('preprod', 50);
    expect(initial.connect).toHaveBeenCalledWith('preprod');
    expect(s.setup.proverLocal).toBe(true);
    expect(s.setup.warnings).toEqual([]);
  });

  it('member declines the connection: lace-refused with the wallet reason', async () => {
    makeLace({ refuseConnect: 'User rejected' });
    const p = LiveSession.connect('preprod', 50);
    await expect(p).rejects.toThrow('Lace refused the connection: User rejected');
  });

  it('Lace on another network: wrong-network', async () => {
    makeLace({ networkId: 'mainnet' });
    await expect(LiveSession.connect('preprod', 50)).rejects.toThrow('Lace is on mainnet, not preprod');
    expect(await code(LiveSession.connect('preprod', 50))).toBe('wrong-network');
  });

  it('remote prover: connects, but warns that the passbook would leave the machine', async () => {
    makeLace({ prover: 'https://prover.example.com' });
    const s = await LiveSession.connect('preprod', 50);
    expect(s.setup.proverLocal).toBe(false);
    expect(s.setup.warnings[0]).toContain('not on this machine');
    expect(s.setup.warnings[0]).toContain('http://localhost:6300');
  });

  it('no prover configured: no-prover', async () => {
    makeLace({ prover: undefined });
    expect(await code(LiveSession.connect('preprod', 50))).toBe('no-prover');
  });

  it('isLocalProver and resolveIndexer', () => {
    expect(isLocalProver('http://localhost:6300')).toBe(true);
    expect(isLocalProver('http://127.0.0.1:6300/')).toBe(true);
    expect(isLocalProver('https://localhost.evil.com')).toBe(false);
    expect(isLocalProver('https://prover.example.com')).toBe(false);
    expect(resolveIndexer({ indexerUri: 'a', indexerWsUri: 'b' })).toEqual({ indexer: 'a', indexerWS: 'b' });
    expect(resolveIndexer({ indexerUri: 'a', indexerWsUri: 'b' }, 'nightpreprodX').indexer).toBe(
      'https://midnight-preprod.blockfrost.io/api/v0?project_id=nightpreprodX',
    );
    expect(() => resolveIndexer(undefined)).toThrow('Preprod needs an indexer');
  });
});

// ---------------------------------------------------------------- join

describe('join a deployed group by address', () => {
  it('builds providers from Lace (prover, indexer, coin key) and private state scoped to the wallet', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    const g = await join(s);
    expect(g).toEqual({ address: ADDRESS, memberCount: 3, meetings: 0, phase: 'Active' });
    expect(h.proofUrls).toEqual(['http://localhost:6300']);
    expect(h.indexerUrls[0]).toEqual(['https://lace-indexer.example/api', 'wss://lace-indexer.example/ws']);
    expect(h.levelCfg[0]).toMatchObject({ accountId: 'coinpk-test', privateStateStoreName: 'undying-private-state' });
    expect(h.findCalls[0]).toMatchObject({ contractAddress: ADDRESS, privateStateId: 'undyingPrivateState' });
    expect(s.joined).toBe(true);
  });

  it('a pasted Blockfrost project ID overrides the Lace indexer', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s, 'secretary', 0, { blockfrostProjectId: 'nightpreprodABC' });
    expect(h.indexerUrls[0][0]).toContain('midnight-preprod.blockfrost.io/api/v0?project_id=nightpreprodABC');
  });

  it('unknown address: contract-not-found, and Midnight.js is never asked to wait for it', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    const p = join(s, 'secretary', 0, { address: 'cd'.repeat(32) });
    expect(await code(p)).toBe('contract-not-found');
    expect(h.findCalls).toHaveLength(0);
  });

  it('malformed address or secrets: bad-input before any network call', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    expect(await code(join(s, 'secretary', 0, { address: 'not-hex' }))).toBe('bad-input');
    expect(await code(join(s, 'secretary', 0, { mySecretHex: 'abc' }))).toBe('bad-input');
    expect(h.indexerUrls).toHaveLength(0);
  });

  it('secrets that are not this group’s are caught against the public keys', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await expect(join(s, 'member', 1, { mySecretHex: hex(MEMBERS[2]) })).rejects.toThrow('not the member in slot 1');
    await expect(join(s, 'secretary', 0, { groupSecretHex: hex(bytes(99)) })).rejects.toThrow('group secret does not belong');
    await expect(join(s, 'member', 7)).rejects.toThrow();
  });

  it('re-joining with the same secrets keeps the passbooks already on this phone', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    expect(h.findCalls[0]).toHaveProperty('initialPrivateState');
    await join(s);
    expect(h.findCalls[1]).not.toHaveProperty('initialPrivateState');
  });
});

// ---------------------------------------------------------------- calls and fees

const entries = (): Entry[] => [
  { ...ZERO_ENTRY, shares: 3n, socialFund: 1n },
  { ...ZERO_ENTRY, shares: 2n, loanIssued: 50n },
  { ...ZERO_ENTRY },
];

describe('secretary records a meeting', () => {
  it('group fee key: Lace balances with payFees:false, the bound tx goes to the relay, stamps come back', async () => {
    const { connected } = makeLace();
    relayOk();
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    const stages: string[] = [];
    s.onStage((x) => stages.push(x));
    s.setFee('http://localhost:3001', false);
    const stamps = await s.recordMeeting(entries());

    expect(h.calls.map((c) => c.circuit)).toEqual(['recordMeeting']);
    expect(h.calls[0].args[0]).toBe(0n);
    expect((h.calls[0].args[1] as Entry[]).length).toBe(5); // a full page, zero entries included
    expect(connected.balanceUnsealedTransaction).toHaveBeenCalledWith('010203', { payFees: false });
    expect(connected.submitTransaction).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3001/sponsor');
    expect(JSON.parse(init.body)).toEqual({ tx: '010203beef' });
    expect(stages).toEqual(['proving', 'balancing', 'relay', 'done']);
    expect(stamps).toEqual(['undying-stamp:0:3:1:0', 'undying-stamp:1:2:0:50', 'undying-stamp:2:0:0:0']);
    expect(chain.meetings).toBe(1);
    // each stamp opens its slot's new sealed line (real pure circuit), so members can keep it
    stamps.forEach((st, i) => {
      const { passbook } = parseStamp(st);
      expect(pureCircuits.passbookCommitment(passbook, GS, BigInt(i), chain.versions[i])).toBe(chain.passbooks[i]);
    });
  });

  it('no relay, and the member agreed on screen: Lace pays and submits', async () => {
    const { connected } = makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    s.setFee('', true);
    await s.recordMeeting(entries());
    expect(connected.balanceUnsealedTransaction).toHaveBeenCalledWith('010203', { payFees: true });
    expect(connected.submitTransaction).toHaveBeenCalledWith('010203beef');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no relay and no agreement: fee-choice-needed, and nothing is proved', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    s.setFee('', false);
    expect(await code(s.recordMeeting(entries()))).toBe('fee-choice-needed');
    expect(h.calls).toHaveLength(0);
  });

  it('Lace refuses payFees:false: payfees-refused, with the wallet reason', async () => {
    makeLace({ refusePayFeesFalse: true });
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    s.setFee('http://localhost:3001', false);
    const p = s.recordMeeting(entries());
    await expect(p).rejects.toThrow('payFees false is not supported');
    expect(await code(s.recordMeeting(entries()))).toBe('payfees-refused');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('relay down or refusing: relay-unreachable / relay-refused with the relay’s words', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    s.setFee('http://localhost:3001', false);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await code(s.recordMeeting(entries()))).toBe('relay-unreachable');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'Circuit heartbeat is not sponsored' }), { status: 422 }));
    await expect(s.recordMeeting(entries())).rejects.toThrow('The fee-key relay refused this call: Circuit heartbeat is not sponsored');
  });

  it('a bad relay URL is refused before proving', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s);
    s.setFee('ftp://relay', false);
    expect(await code(s.recordMeeting(entries()))).toBe('bad-input');
    expect(h.calls).toHaveLength(0);
  });

  it('only the secretary records', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s, 'member', 0);
    s.setFee('', true);
    await expect(s.recordMeeting(entries())).rejects.toThrow('Only the secretary');
  });
});

describe('member: own passbook, stamps, proof; anyone: sunset', () => {
  // the commitment a recorded meeting leaves on the book, for a member's passbook
  const seal = (slot: number, pb: Passbook) => {
    chain.versions[slot] += 1n;
    chain.passbooks[slot] = pureCircuits.passbookCommitment(pb, GS, BigInt(slot), chain.versions[slot]);
    chain.meetings += 1;
  };

  it('opens a fresh passbook from private state and checks it against the sealed line', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s, 'member', 1);
    const o = await s.openPassbook();
    expect(o).toMatchObject({ slot: 1, matchesLedger: true, passbook: ZERO_PASSBOOK });
  });

  it('after a meeting the copy is behind; the secretary’s stamp is checked, then kept', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s, 'member', 1);
    const pb = applyEntry(ZERO_PASSBOOK, { ...ZERO_ENTRY, shares: 4n, loanIssued: 20n });
    seal(1, pb);
    expect((await s.openPassbook()).matchesLedger).toBe(false);
    await expect(s.importStamp(formatStamp(1, { ...pb, shares: 99n }))).rejects.toThrow('does not open slot 1');
    await expect(s.importStamp('hello')).rejects.toThrow('not a passbook stamp');
    await expect(s.importStamp(formatStamp(0, ZERO_PASSBOOK))).rejects.toThrow('for slot 0; you are slot 1');
    const kept = await s.importStamp(formatStamp(1, pb));
    expect(kept).toMatchObject({ slot: 1, matchesLedger: true });
    const again = await s.openPassbook();
    expect(again.matchesLedger).toBe(true);
    expect(again.passbook.shares).toBe(4n);
  });

  it('proves at least N shares through attestSavings with the member’s slot and a fresh nonce', async () => {
    makeLace();
    relayOk();
    const s = await LiveSession.connect('preprod', 50);
    await join(s, 'member', 2);
    s.setFee('http://localhost:3001', false);
    const nonce = new Uint8Array(32).fill(7);
    const r = await s.proveAtLeast(5, nonce);
    expect(h.calls[0]).toEqual({ circuit: 'attestSavings', args: [2n, 5n, nonce] });
    expect(r).toEqual({ minShares: 5, ref: '0707070707070707', txId: 'relay-tx-1' });
    expect(await code(s.proveAtLeast(0))).toBe('bad-input');
  });

  it('sunset: the book’s refusal comes through, then it works once the grace period is over', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await join(s, 'member', 0);
    s.setFee('', true);
    await expect(s.sunset()).rejects.toThrow('still sending heartbeats');
    chain.graceOver = true;
    const r = await s.sunset();
    expect(r.txId).toMatch(/^00ff/);
    expect((await s.group()).phase).toBe('Sunset');
  });

  it('nothing works before joining', async () => {
    makeLace();
    const s = await LiveSession.connect('preprod', 50);
    await expect(s.openPassbook()).rejects.toThrow('Join the group first');
  });
});

describe('stamps and the relay client', () => {
  it('formatStamp / parseStamp round-trip', () => {
    const pb = { shares: 29n, socialFund: 4n, loanOutstanding: 0n };
    expect(parseStamp(formatStamp(0, pb))).toEqual({ slot: 0, passbook: pb });
  });

  it('submitViaGroupFeeKey reports a non-JSON error page by status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Bad gateway', { status: 502 }));
    await expect(submitViaGroupFeeKey('http://relay.example', { serialize: () => new Uint8Array([1]) } as never)).rejects.toThrow('HTTP 502');
  });
});

// ---------------------------------------------------------------- no wallet (burner key)

describe('no wallet: burner key and the group fee-key relay', () => {
  it('needs a Blockfrost project ID, since there is no Lace to give an indexer', async () => {
    const s = LiveSession.noWallet();
    expect(s.noWalletMode).toBe(true);
    expect(s.setup.proverLocal).toBe(true);
    expect(await code(join(s, 'member', 0))).toBe('no-indexer');
  });

  it('proves locally, binds without a wallet and hands the call to the relay; Lace is never touched', async () => {
    const { connected } = makeLace();
    relayOk();
    const s = LiveSession.noWallet();
    s.setFee('http://localhost:3001', false);
    await join(s, 'member', 1, { blockfrostProjectId: 'nightpreprodX' });
    const stages: string[] = [];
    s.onStage((x) => stages.push(x));
    const r = await s.proveAtLeast(1);
    expect(r.txId).toBe('relay-tx-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3001/sponsor');
    expect(JSON.parse(init.body).tx).toBe('010203');
    expect(stages).toEqual(['proving', 'balancing', 'relay', 'done']);
    expect(h.proofUrls).toContain('http://localhost:6300');
    expect(h.indexerUrls.at(-1)?.[0]).toBe('https://midnight-preprod.blockfrost.io/api/v0?project_id=nightpreprodX');
    // the stored passbook is scoped to the member's public key, so a reload finds it again
    expect((h.levelCfg.at(-1) as { accountId: string }).accountId).toBe(`burner-${hex(roleKey(DOMAINS.member, MEMBERS[1]))}`);
    expect(connected.balanceUnsealedTransaction).not.toHaveBeenCalled();
    expect(connected.submitTransaction).not.toHaveBeenCalled();
  });

  it('without a relay URL there is no way to pay: fee-choice-needed, before any proof', async () => {
    const s = LiveSession.noWallet();
    s.setFee('', true); // "let Lace pay" means nothing without Lace
    await join(s, 'member', 0, { blockfrostProjectId: 'nightpreprodX' });
    expect(await code(s.proveAtLeast(1))).toBe('fee-choice-needed');
    expect(h.calls).toHaveLength(0);
  });

  it('warns when the proof server is not on this machine', () => {
    const s = LiveSession.noWallet('https://prover.example.com');
    expect(s.setup.proverLocal).toBe(false);
    expect(s.setup.warnings[0]).toContain('not on this machine');
  });
});

describe('members elect a secretary', () => {
  it('two of three members vote for the same key and it becomes the secretary; the new secretary records', async () => {
    relayOk();
    const newSecret = bytes(42);
    const key = LiveSession.secretaryKeyFor(hex(newSecret));
    expect(key).toBe(hex(roleKey(DOMAINS.secretary, newSecret)));
    const a = LiveSession.noWallet();
    a.setFee('http://localhost:3001', false);
    await join(a, 'member', 0, { blockfrostProjectId: 'nightpreprodX' });
    expect((await a.voteSecretary(key)).elected).toBe(false);
    const b = LiveSession.noWallet();
    b.setFee('http://localhost:3001', false);
    await join(b, 'member', 2, { blockfrostProjectId: 'nightpreprodX' });
    expect((await b.voteSecretary(key)).elected).toBe(true);
    expect(h.calls.filter((c) => c.circuit === 'voteSecretary').map((c) => c.args[0])).toEqual([0n, 2n]);
    // the elected secretary joins with her new secret; the old one no longer can
    const old = LiveSession.noWallet();
    expect(await code(join(old, 'secretary', 0, { blockfrostProjectId: 'nightpreprodX' }))).toBe('bad-input');
    const elected = LiveSession.noWallet();
    elected.setFee('http://localhost:3001', false);
    await elected.attach({ address: ADDRESS, role: 'secretary', mySecretHex: hex(newSecret), groupSecretHex: hex(GS), passphrase: PASS, zkConfigBaseUrl: 'z/', blockfrostProjectId: 'nightpreprodX' });
    expect(elected.role).toBe('secretary');
  });

  it('only a member can vote, with a 32-byte key', async () => {
    const s = LiveSession.noWallet();
    s.setFee('http://localhost:3001', false);
    await join(s, 'secretary', 0, { blockfrostProjectId: 'nightpreprodX' });
    expect(await code(s.voteSecretary('ab'.repeat(32)))).toBe('bad-input');
    const m = LiveSession.noWallet();
    m.setFee('http://localhost:3001', false);
    await join(m, 'member', 0, { blockfrostProjectId: 'nightpreprodX' });
    expect(await code(m.voteSecretary('not hex'))).toBe('bad-input');
  });
});
