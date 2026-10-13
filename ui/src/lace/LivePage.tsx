// SPDX-License-Identifier: Apache-2.0
// Live mode (Preprod): read a deployed group's PUBLIC register from the Midnight indexer, check
// the member's Lace wallet setup, and once Lace connects, act on the book (LiveWrite: join by
// address, record a meeting, open my passbook, prove at least N shares, sunset) through
// chain/src/browser.ts + chain/src/api.ts. Loaded on demand (#/live), so the simulator demo does
// not ship Midnight.js; the write path is a further chunk loaded only after Lace connects.
//
// NOT VERIFIED against a live deployment: the build machine had no Docker, no Lace and no tNIGHT.
// It is typechecked, the write wiring is unit-tested with a mocked Lace and mocked providers,
// and the no-Lace state is covered by the e2e suite.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ledger, Phase } from '@undying-ledger/contract';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Leaf } from '../a2/paper';
import type { LiveSession } from './live-session';
import { PreprodRecord } from './PreprodRecord';
import { PREPROD_RUN } from '../demo/preprod';

const LiveWrite = lazy(() => import('./LiveWrite'));
const LOOKING = 'Looking for the Lace wallet…';

// Preprod's public indexer moved to Blockfrost on 9 October 2026 and needs a project token
// (docs.midnight.network/guides/networks-and-environments). The page prefers the indexer the
// member's Lace wallet is configured with; without Lace it takes a Blockfrost Preprod project ID,
// which stays in this tab's memory only.
const PREPROD = {
  networkId: 'preprod',
  indexer: 'https://midnight-preprod.blockfrost.io/api/v0',
  indexerWS: 'wss://midnight-preprod.blockfrost.io/api/v0/ws',
};
const withToken = (url: string, t: string) => `${url}${url.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(t)}`;
const redact = (s: string) => s.replace(/project_id=[^&\s"']+/g, 'project_id=***');
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`no answer from the indexer in ${ms / 1000} s`)), ms))]);

type Register = {
  memberCount: number;
  meetings: number;
  phase: string;
  lastHeartbeat: string;
  graceSeconds: number;
  feeKeyEpoch: number;
  attestations: number;
  slots: { slot: number; commitment: string; version: number }[];
};

function params(): URLSearchParams {
  const q = location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q);
}

function findLace(): InitialAPI | undefined {
  const w = (globalThis as unknown as { midnight?: Record<string, unknown> }).midnight;
  if (!w) return undefined;
  return Object.values(w).find((x): x is InitialAPI => !!x && typeof x === 'object' && 'apiVersion' in x && 'connect' in x);
}

export default function LivePage() {
  const [address, setAddress] = useState(() => params().get('contract') ?? PREPROD_RUN?.contract ?? '');
  const [token, setToken] = useState('');
  const [reg, setReg] = useState<Register | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [lace, setLace] = useState<string>(LOOKING);
  const [laceErr, setLaceErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const [session, setSession] = useState<LiveSession | null>(null);
  const h = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h.current?.focus({ preventScroll: true });
    const t = setTimeout(() => {
      const api = findLace();
      const found = api ? `Lace found (dApp connector ${api.apiVersion}).` : 'No Lace wallet in this browser. Reading the public register needs none.';
      // never overwrite what a "Check my Lace setup" tap already reported
      setLace((prev) => (prev === LOOKING ? found : prev));
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const connect = async () => {
    if (checking) return;
    // `npm run dev` only: #/live?fake=1 swaps in a made-up session to look at the joined screens.
    if (import.meta.env.DEV && new URLSearchParams(location.hash.split('?')[1] ?? '').has('fake')) {
      const { fakeSession } = await import('./fake-session');
      setLace('Dev preview: a made-up Lace session. Nothing here reaches Preprod.');
      setLaceErr(false);
      return setSession(fakeSession() as unknown as LiveSession);
    }
    if (!findLace()) {
      setLaceErr(true);
      return setLace('No Lace wallet in this browser. Install Lace (Midnight), switch it to Preprod, then reload this page.');
    }
    setChecking(true);
    setLaceErr(false);
    setLace('Asking Lace to connect to Preprod…');
    try {
      const { LiveSession } = await import('./live-session');
      const s = await LiveSession.connect();
      const p = s.setup.proverUri;
      setLace(`Connected to Lace on ${PREPROD.networkId}. Proof server: ${p}${s.setup.proverLocal ? ' (local, good).' : '. Set it to Local http://localhost:6300 so proofs stay on this machine.'}`);
      setLaceErr(!s.setup.proverLocal);
      setSession(s);
    } catch (e) {
      setLaceErr(true);
      setLace(redact((e as Error).message));
    } finally {
      setChecking(false);
    }
  };

  // No wallet: prove on this machine's proof server, bind with a burner key, let the relay pay.
  const noWallet = async () => {
    if (checking) return;
    setChecking(true);
    setLaceErr(false);
    try {
      const { LiveSession } = await import('./live-session');
      const s = LiveSession.noWallet();
      setLace(`No wallet. Proofs on ${s.setup.proverUri} (this machine); each call is bound with a throwaway key that holds nothing, and the group fee-key relay pays. Needs the Blockfrost ID above and the relay URL below.`);
      setSession(s);
    } catch (e) {
      setLaceErr(true);
      setLace(redact((e as Error).message));
    } finally {
      setChecking(false);
    }
  };

  const read = async () => {
    const a = address.trim().replace(/^0x/, '');
    if (!/^[0-9a-f]{64,70}$/i.test(a)) {
      setStatus('error');
      setMsg('That does not look like a contract address (hex). Paste the address printed by the deploy script.');
      return;
    }
    setStatus('reading');
    setMsg('');
    try {
      const [{ indexerPublicDataProvider }, { setNetworkId }] = await Promise.all([
        import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
        import('@midnight-ntwrk/midnight-js-network-id'),
      ]);
      setNetworkId(PREPROD.networkId);
      let urls: { indexer: string; ws: string } | null = null;
      const api = findLace();
      if (api) {
        const cfg = await (await api.connect(PREPROD.networkId)).getConfiguration();
        urls = { indexer: cfg.indexerUri, ws: cfg.indexerWsUri };
      } else if (token.trim()) {
        urls = { indexer: withToken(PREPROD.indexer, token.trim()), ws: withToken(PREPROD.indexerWS, token.trim()) };
      }
      if (!urls) throw new Error('Preprod needs an indexer: open this page with Lace installed, or paste a Blockfrost Midnight Preprod project ID.');
      const pdp = indexerPublicDataProvider(urls.indexer, urls.ws);
      const state = await withTimeout(pdp.queryContractState(a as never), 25_000);
      if (!state) throw new Error('No contract with that address on Preprod (yet).');
      const L = ledger(state.data as never);
      const n = Number(L.memberCount);
      setReg({
        memberCount: n,
        meetings: Number(L.meetings),
        phase: L.phase === Phase.ACTIVE ? 'Active' : 'Sunset',
        lastHeartbeat: new Date(Number(L.lastHeartbeat) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        graceSeconds: Number(L.graceSeconds),
        feeKeyEpoch: Number(L.feeKeyEpoch),
        attestations: Number(L.attestations.size()),
        slots: [...Array(n).keys()].map((i) => ({
          slot: i,
          commitment: L.passbooks.lookup(BigInt(i)).toString(16).padStart(64, '0'),
          version: Number(L.passbookVersion.lookup(BigInt(i))),
        })),
      });
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setMsg(redact(`Could not read the register: ${(e as Error).message}`));
    }
  };

  return (
    <section className="beat w-slate" style={{ bottom: 0 }} aria-label="Live register on Preprod" data-testid="live">
      <Leaf band={[<b key="a">Live on Preprod</b>, <a href="#/" key="b">Back to the demo</a>]}>
        <h2 className="disp" tabIndex={-1} ref={h} style={{ fontSize: 40 }}>
          The public register
        </h2>
        <p className="lede">What anyone can read about a deployed group, no wallet needed. Members act on it with Lace, or with no wallet at all through the group fee-key relay.</p>
        <PreprodRecord />
        <div className="prose">
          <label className="label" htmlFor="addr">
            Contract address
          </label>
          <input
            id="addr"
            className="addr"
            value={address}
            onChange={(ev) => setAddress(ev.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="paste the address from the deploy script"
          />
        </div>
        <div className="prose">
          <label className="label" htmlFor="bf">
            Blockfrost Preprod project ID (only without Lace)
          </label>
          <input
            id="bf"
            className="addr"
            type="password"
            value={token}
            onChange={(ev) => setToken(ev.target.value)}
            autoComplete="off"
            placeholder="nightpreprod..."
          />
          <p className="note" style={{ marginTop: 4 }}>
            Kept in this tab only. Anyone who sees a page with it can use your quota.
          </p>
        </div>
        <div style={{ height: 12 }} />
        <button className="btn" type="button" onClick={read} disabled={status === 'reading'}>
          {status === 'reading' ? 'Reading the indexer' : 'Read the register'}
        </button>
        {status === 'reading' && (
          <div className="proving on" role="status">
            <span className="skel" style={{ width: '86%' }} />
            <span className="skel" style={{ width: '60%' }} />
          </div>
        )}
        <p className={status === 'error' ? 'err' : 'after'} role="status" data-testid="live-msg">
          {msg}
        </p>
        {reg && (
          <>
            <div className="pub">
              <div>
                <span className="label">Members</span>
                <b className="num">{reg.memberCount} keys</b>
              </div>
              <div>
                <span className="label">Meetings</span>
                <b className="num">{reg.meetings}</b>
              </div>
              <div>
                <span className="label">Phase</span>
                <b>{reg.phase}</b>
              </div>
            </div>
            <p className="note" style={{ marginTop: 8 }}>
              Last vendor check-in {reg.lastHeartbeat}; sunset opens {reg.graceSeconds} s after it. Fee key {reg.feeKeyEpoch}.{' '}
              {reg.attestations} savings proofs.
            </p>
            <table className="ledger redact">
              <thead>
                <tr>
                  <th scope="col">Slot</th>
                  <th scope="col">Sealed passbook</th>
                  <th scope="col" className="r">
                    Version
                  </th>
                </tr>
              </thead>
              <tbody>
                {reg.slots.map((s) => (
                  <tr key={s.slot}>
                    <td className="num">{s.slot}</td>
                    <td>
                      <span className="hash">{s.commitment.slice(0, 24)}</span>
                    </td>
                    <td className="r num">{s.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <h3 className="label" style={{ marginTop: 22 }}>
          Member wallet
        </h3>
        <p className={laceErr ? 'err' : 'note'} data-testid="lace-status" role="status" style={{ marginTop: 6 }}>
          {lace}
        </p>
        <div style={{ height: 10 }} />
        {!session && (
          <div className="pair">
            <button className="btn ghost" type="button" onClick={connect} disabled={checking}>
              {checking ? 'Checking Lace' : 'Check my Lace setup'}
            </button>
            <button className="btn ghost" type="button" onClick={noWallet} disabled={checking} data-testid="no-wallet">
              Use without a wallet
            </button>
          </div>
        )}
        {checking && (
          <div className="proving on" role="status" data-testid="lace-checking">
            <span className="skel" style={{ width: '72%' }} />
            <span className="skel" style={{ width: '48%' }} />
          </div>
        )}
        {session && (
          <Suspense
            fallback={
              <div className="proving on" role="status">
                <span className="skel" style={{ width: '86%' }} />
                <span className="skel" style={{ width: '60%' }} />
              </div>
            }
          >
            <LiveWrite session={session} address={address} blockfrost={token} />
          </Suspense>
        )}
      </Leaf>
    </section>
  );
}
