// SPDX-License-Identifier: Apache-2.0
// Undying Ledger: no-wallet simulator demo.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Phase } from '@undying-ledger/contract';
import {
  DemoEngine,
  type MeetingLine,
  type Member,
  SHARE_VALUE_GHS,
  DEMO_GRACE_SECONDS,
} from './demo/engine';
import { ASSUMED_FEE_DUST } from './demo/fees';

type Tab = 'secretary' | 'member' | 'public';

const short = (hex: string, n = 6) => `${hex.slice(0, n)}…${hex.slice(-4)}`;
const ghs = (n: number) => `GH₵${n.toLocaleString('en-GH')}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function useEngine(): DemoEngine {
  const engine = useMemo(() => {
    const e = new DemoEngine();
    e.seedHistory();
    return e;
  }, []);
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  useEffect(() => {
    const id = setInterval(() => engine.tick(1), 1000);
    return () => clearInterval(id);
  }, [engine]);
  return engine;
}

export default function App() {
  const e = useEngine();
  const [tab, setTab] = useState<Tab>('secretary');
  const sunset = e.phase === Phase.SUNSET;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>◐</span>
          <div>
            <h1>Undying Ledger</h1>
            <p className="tagline">The savings-group book that can’t be switched off when the grant ends.</p>
          </div>
        </div>
        <div className="mode" title="Runs the compiled Compact circuits with @midnight-ntwrk/compact-runtime in this browser. No wallet, no network, no proofs.">
          Simulator · no wallet · real Compact circuits in your browser
        </div>
      </header>

      <StatusBar e={e} />
      <Story e={e} />

      <nav className="tabs" aria-label="Phones">
        <button className={tab === 'secretary' ? 'on' : ''} onClick={() => setTab('secretary')}>Secretary</button>
        <button className={tab === 'member' ? 'on' : ''} onClick={() => setTab('member')}>Ama’s phone</button>
        <button className={tab === 'public' ? 'on' : ''} onClick={() => setTab('public')}>Husband’s phone</button>
      </nav>

      <main className="phones">
        <section className={`phone ${tab === 'secretary' ? 'show' : ''}`}>
          <Secretary e={e} />
        </section>
        <section className={`phone ${tab === 'member' ? 'show' : ''}`}>
          <Passbook e={e} m={e.members[0]} />
        </section>
        <section className={`phone public ${tab === 'public' ? 'show' : ''}`}>
          <PublicView e={e} />
        </section>
      </main>

      <section className="lower">
        <FeeKeyPanel e={e} />
        <Activity e={e} />
      </section>

      <footer className="foot">
        <p>
          {sunset ? 'Sunset reached: no operator, no admin key, the book keeps going. ' : ''}
          Fee per transaction is an <strong>assumed {ASSUMED_FEE_DUST} DUST</strong> (not yet measured on Preprod). DUST cap and refill
          rate follow the published protocol parameters. Built on Midnight; patterns from midnightntwrk/example-bboard and
          example-private-party (Apache-2.0).
        </p>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ status

function StatusBar({ e }: { e: DemoEngine }) {
  const pub = e.publicState();
  const sunset = e.phase === Phase.SUNSET;
  const sinceBeat = e.elapsed - pub.lastHeartbeat;
  const pct = e.fees.cap ? Math.round((e.fees.balance / e.fees.cap) * 100) : 0;
  return (
    <div className="status" role="status">
      <div className="pill group">
        <strong>Kpalsi Women’s Group</strong> · Tamale · {pub.memberCount} members · next meeting #{pub.meetings + 1}
      </div>
      <div className={`pill ${sunset ? 'good' : e.vendorOnline ? '' : 'warn'}`}>
        {sunset
          ? 'Sunset ✓ no operator'
          : e.vendorOnline
            ? `Vendor online · heartbeat ${sinceBeat}s ago`
            : e.sunsetOpensIn > 0
              ? `Vendor gone · sunset opens in ${e.sunsetOpensIn}s`
              : 'Vendor gone · anyone can call sunset'}
      </div>
      <div className="pill fee">
        Fees paid by <strong>group fee key #{e.fees.epoch}</strong>
        <span className="meter" aria-label={`${pct}% full`}>
          <span style={{ width: `${pct}%` }} className={pct < 10 ? 'low' : ''} />
        </span>
        {e.fees.balance.toFixed(1)} DUST
      </div>
      <div className="pill muted">Members’ own DUST: 0 · tokens held: 0</div>
    </div>
  );
}

function Story({ e }: { e: DemoEngine }) {
  const sunset = e.phase === Phase.SUNSET;
  const recordedAfterSunset = sunset && e.log.some((l) => l.who === 'Secretary' && l.kind === 'ok' && l.what.startsWith('Recorded meeting'));
  const steps: { label: string; done: boolean; action?: () => void; cta?: string; disabled?: boolean }[] = [
    { label: 'Secretary records meeting #12', done: e.meetingsRecorded >= 12 },
    { label: 'Ama checks her passbook; husband’s phone sees nothing', done: e.meetingsRecorded >= 12 },
    { label: 'Grant ends: vendor server switched off', done: !e.vendorOnline, action: () => e.grantEnds(), cta: 'Grant ends', disabled: !e.vendorOnline },
    {
      label: `Anyone calls sunset after ${DEMO_GRACE_SECONDS}s of silence`,
      done: sunset,
      action: () => (e.sunsetOpensIn > 0 && !e.vendorOnline ? e.skip(e.sunsetOpensIn) : e.trySunset()),
      cta: !e.vendorOnline && e.sunsetOpensIn > 0 ? `Skip ${e.sunsetOpensIn}s` : 'Call sunset()',
      disabled: sunset,
    },
    { label: 'Next meeting still records; fee from the group key', done: recordedAfterSunset },
  ];
  return (
    <ol className="story">
      {steps.map((s, i) => (
        <li key={i} className={s.done ? 'done' : ''}>
          <span className="n">{s.done ? '✓' : i + 1}</span>
          <span className="l">{s.label}</span>
          {s.action && (
            <button className="small" onClick={s.action} disabled={s.disabled}>
              {s.cta}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ secretary

function Secretary({ e }: { e: DemoEngine }) {
  const [lines, setLines] = useState<MeetingLine[]>(() => e.suggestedNextMeeting());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const totals = e.groupTotals();
  const next = e.meetingsRecorded + 1;

  const set = (i: number, patch: Partial<MeetingLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = () => {
    setBusy(true);
    setMsg(null);
    // let the button repaint before the (synchronous) circuit run
    setTimeout(() => {
      const r = e.recordMeeting(lines);
      setBusy(false);
      if (r.ok) {
        setMsg({ ok: true, text: `Meeting #${next} recorded. 5 passbooks stamped and verified. Fee paid from group fee key #${e.fees.epoch}; your DUST: 0.` });
        setLines(e.suggestedNextMeeting());
      } else setMsg({ ok: false, text: r.error ?? 'Failed' });
    }, 30);
  };

  return (
    <div className="screen">
      <div className="bar">
        <span>Secretary · Fuseina</span>
        <span className="chip">{e.phase === Phase.SUNSET ? 'after sunset' : 'live'}</span>
      </div>
      <h2>Meeting #{next}</h2>
      <p className="hint">Shares are GH₵{SHARE_VALUE_GHS} each. Amounts never leave this phone except inside a hiding commitment.</p>
      <div className="sheet" role="table">
        <div className="row head" role="row">
          <span>Member</span>
          <span>Shares</span>
          <span>Social</span>
          <span>Loan out</span>
          <span>Repaid</span>
        </div>
        {lines.map((l, i) => (
          <div className="row" role="row" key={i}>
            <span className="who">{e.members[i].name}</span>
            <span className="stepper">
              <button aria-label="fewer shares" onClick={() => set(i, { shares: Math.max(0, l.shares - 1) })}>−</button>
              <b>{l.shares}</b>
              <button aria-label="more shares" onClick={() => set(i, { shares: Math.min(5, l.shares + 1) })}>+</button>
            </span>
            <span>
              <input type="checkbox" checked={l.social} onChange={(ev) => set(i, { social: ev.target.checked })} aria-label="social fund" />
            </span>
            <span>
              <input inputMode="numeric" value={l.loanIssued || ''} placeholder="0" onChange={(ev) => set(i, { loanIssued: Number(ev.target.value.replace(/\D/g, '')) || 0 })} aria-label="loan issued" />
            </span>
            <span>
              <input inputMode="numeric" value={l.loanRepaid || ''} placeholder="0" onChange={(ev) => set(i, { loanRepaid: Number(ev.target.value.replace(/\D/g, '')) || 0 })} aria-label="loan repaid" />
            </span>
          </div>
        ))}
      </div>
      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? 'Proving & recording…' : `Record meeting #${next}`}
      </button>
      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}
      <div className="inside">
        <h3>Inside the group only</h3>
        <p>
          Box holds {totals.shares} shares ({ghs(totals.shares * SHARE_VALUE_GHS)}) · social fund {ghs(totals.social)} · loans out {ghs(totals.loans)}
        </p>
        <p className="hint">Counted aloud at the meeting, as in any VSLA. Never published.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ member passbook

function Passbook({ e, m }: { e: DemoEngine; m: Member }) {
  const pb = e.passbookOf(m);
  const shares = Number(pb.shares);
  const [min, setMin] = useState(10);
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const last = m.stamps[0];
  return (
    <div className="screen">
      <div className="bar">
        <span>My passbook · {m.name}</span>
        <span className="chip">PIN locked app</span>
      </div>
      <div className="book">
        <div>
          <label>Savings</label>
          <strong>{ghs(shares * SHARE_VALUE_GHS)}</strong>
          <small>{shares} shares</small>
        </div>
        <div>
          <label>Social fund</label>
          <strong>{ghs(Number(pb.socialFund))}</strong>
        </div>
        <div>
          <label>Loan owed</label>
          <strong>{ghs(Number(pb.loanOutstanding))}</strong>
        </div>
      </div>
      {last && (
        <p className="ok">
          ✓ Meeting #{last.meeting} stamp verified against the public ledger (version {String(last.stamp.version)}).
        </p>
      )}
      <h3>Stamps</h3>
      <ul className="stamps">
        {m.stamps.slice(0, 6).map((s) => (
          <li key={s.meeting}>
            <span>#{s.meeting}</span>
            <span>+{String(s.delta.shares)} sh</span>
            <span>{s.delta.socialFund ? `+${ghs(Number(s.delta.socialFund))} soc` : '—'}</span>
            <span>
              {s.delta.loanIssued ? `loan ${ghs(Number(s.delta.loanIssued))}` : s.delta.loanRepaid ? `repaid ${ghs(Number(s.delta.loanRepaid))}` : ''}
            </span>
            <span className="tick">✓</span>
          </li>
        ))}
      </ul>
      <div className="prove">
        <h3>Prove my savings to a loan officer</h3>
        <p className="hint">Proves “at least N shares” without showing the amount. Uses Ama’s key, which never leaves her phone.</p>
        <div className="inline">
          <span>At least</span>
          <input inputMode="numeric" value={min} onChange={(ev) => setMin(Number(ev.target.value.replace(/\D/g, '')) || 0)} aria-label="minimum shares" />
          <span>shares</span>
          <button
            onClick={() => {
              const r = e.proveSavings(m.slot, min);
              setRes(r.ok ? { ok: true, text: `Proof accepted on-chain (reference ${r.nonce}). The officer sees “≥ ${min} shares”, nothing more.` } : { ok: false, text: r.error ?? '' });
            }}
          >
            Prove
          </button>
        </div>
        {res && <p className={res.ok ? 'ok' : 'err'}>{res.text}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ public view

function PublicView({ e }: { e: DemoEngine }) {
  const pub = e.publicState();
  const [tried, setTried] = useState<boolean | null>(null);
  const txs = e.publicTxs().slice(-6).reverse();
  return (
    <div className="screen">
      <div className="bar">
        <span>Husband’s phone</span>
        <span className="chip">shared household phone</span>
      </div>
      <div className="sms">
        <h3>Messages</h3>
        <p className="hint">No messages from the group. Undying never sends balances by SMS.</p>
      </div>
      <h3>Public explorer: what anyone can see</h3>
      <dl className="kv">
        <dt>Members</dt>
        <dd>{pub.memberCount} (keys only)</dd>
        <dt>Meetings recorded</dt>
        <dd>{pub.meetings}</dd>
        <dt>Phase</dt>
        <dd>{pub.phase}</dd>
        <dt>Last heartbeat</dt>
        <dd>t+{clock(pub.lastHeartbeat)}</dd>
        <dt>Maintainer key</dt>
        <dd className="mono">{/^0+$/.test(pub.maintainerKey) ? '— erased at sunset' : short(pub.maintainerKey)}</dd>
        <dt>Fee key note</dt>
        <dd className="mono">#{pub.feeKeyEpoch} {short(pub.feeKeyTag)}</dd>
        <dt>Savings proofs</dt>
        <dd>{pub.attestations}</dd>
      </dl>
      <h3>Passbook slots (commitments)</h3>
      <ul className="slots">
        {pub.slots.map((s) => (
          <li key={s.slot}>
            <span>slot {s.slot}</span>
            <span className="mono">{short(s.commitment, 10)}</span>
            <span>v{s.version}</span>
          </li>
        ))}
      </ul>
      <button
        className="small"
        onClick={() => setTried(e.outsiderTriesToOpen(0))}
        title="Even knowing the exact amounts, you cannot match the commitment without the group secret."
      >
        Try to open slot 0 without the group secret
      </button>
      {tried !== null && <p className="err">{tried ? 'Opened' : '✗ Cannot open: the commitment needs the group secret. No name, no amount.'}</p>}
      <h3>Latest transactions</h3>
      <ul className="txs">
        {txs.map((t) => (
          <li key={t.seq}>
            <span className="mono">{t.circuit}()</span>
            <span>t+{clock(Number(t.time) - Number(e.startTime))}</span>
            <span className="hint">fee in shielded DUST</span>
          </li>
        ))}
      </ul>
      <p className="callout">Nothing here names Ama or shows an amount.</p>
    </div>
  );
}

// ------------------------------------------------------------------ fee key + log

function FeeKeyPanel({ e }: { e: DemoEngine }) {
  const f = e.fees;
  const hasBrother = f.supporters.some((s) => s.name.startsWith('Brother'));
  return (
    <div className="card">
      <h2>Group fee key #{f.epoch}</h2>
      <p className="hint">
        One DUST key per group, kept inside the members’ app. DUST only pays fees: it can’t be sent anywhere, and the NIGHT that
        generates it stays with its owner.
      </p>
      <div className="big-meter">
        <span style={{ width: `${f.cap ? (f.balance / f.cap) * 100 : 0}%` }} className={f.balance < 5 ? 'low' : ''} />
      </div>
      <p>
        {f.balance.toFixed(1)} / {f.cap} DUST · refills ≈ {(f.ratePerSecond * 86400).toFixed(0)} DUST/day · {f.txCount} fees paid
        {e.pendingRotationNote ? ' · new key filling, rotation note pending' : ''}
      </p>
      <ul className="supporters">
        {f.supporters.map((s, i) => (
          <li key={i}>
            <strong>{s.name}</strong> · {s.night} NIGHT · <span className="hint">{s.note}</span>
          </li>
        ))}
      </ul>
      <div className="buttons">
        <button className="small" disabled={hasBrother} onClick={() => e.addSupporter('Brother in London', 20, 'points his NIGHT’s DUST here; sends no money')}>
          + Relative points DUST here
        </button>
        <button className="small warn" onClick={() => e.leakAndBurn(400)}>
          Key copied: burn fees
        </button>
        <button className="small" onClick={() => e.skip(24 * 3600)}>
          Fast-forward 1 day
        </button>
        <button className="small" onClick={() => e.rotateFeeKey()}>
          Rotate fee key
        </button>
      </div>
    </div>
  );
}

function Activity({ e }: { e: DemoEngine }) {
  return (
    <div className="card">
      <h2>Activity</h2>
      <ul className="log">
        {e.log.slice(0, 14).map((l) => (
          <li key={l.id} className={l.kind}>
            <span className="t">t+{clock(l.at)}</span>
            <span>
              <strong>{l.who}:</strong> {l.what}
              {l.fee && <em className="fee"> Fee: {l.fee}.</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
