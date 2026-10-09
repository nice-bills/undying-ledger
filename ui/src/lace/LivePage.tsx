// SPDX-License-Identifier: Apache-2.0
// Live mode (Preprod): read a deployed group's PUBLIC register from the Midnight indexer, and
// check the member's Lace wallet setup. Loaded on demand (#/live), so the simulator demo does not
// ship Midnight.js. Writing to the book (recordMeeting, attestSavings with private state and
// local proving) goes through chain/src/api.ts + chain/src/browser.ts; see PREPROD.md.
//
// NOT VERIFIED against a live deployment: the build machine had no Docker, no Lace and no tNIGHT.
// It is typechecked and its offline states were exercised in a headless browser.
import { useEffect, useRef, useState } from 'react';
import { ledger, Phase } from '@undying-ledger/contract';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Leaf } from '../a2/paper';

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
  const [address, setAddress] = useState(() => params().get('contract') ?? '');
  const [token, setToken] = useState('');
  const [reg, setReg] = useState<Register | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [lace, setLace] = useState<string>('Looking for the Lace wallet…');
  const h = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h.current?.focus({ preventScroll: true });
    const t = setTimeout(() => {
      const api = findLace();
      setLace(api ? `Lace found (dApp connector ${api.apiVersion}).` : 'No Lace wallet in this browser. Reading the public register needs none.');
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const connect = async () => {
    const api = findLace();
    if (!api) return setLace('No Lace wallet in this browser. Install Lace (Midnight) and switch it to Preprod.');
    try {
      const c = await api.connect(PREPROD.networkId);
      const cfg = await c.getConfiguration();
      const local = /^(https?:\/\/)?(localhost|127\.0\.0\.1)/.test(cfg.proverServerUri ?? '');
      setLace(
        `Connected to Lace on ${PREPROD.networkId}. Proof server: ${cfg.proverServerUri ?? 'not set'}${local ? ' (local, good)' : '. Set it to Local http://localhost:6300 so proofs stay on this machine.'}`,
      );
    } catch (e) {
      setLace(`Lace refused the connection: ${(e as Error).message}`);
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
        <p className="lede">What anyone can read about a deployed group. No wallet needed.</p>
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
        <p className="note" data-testid="lace-status" style={{ marginTop: 6 }}>
          {lace}
        </p>
        <div style={{ height: 10 }} />
        <button className="btn ghost" type="button" onClick={connect}>
          Check my Lace setup
        </button>
      </Leaf>
    </section>
  );
}
