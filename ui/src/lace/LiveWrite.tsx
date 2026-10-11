// SPDX-License-Identifier: Apache-2.0
// Live write-through on Preprod: join a deployed group from this phone, then record a meeting
// (secretary), open my own passbook, prove "at least N shares" (member), or call sunset (anyone).
// Each button calls a real circuit through LiveSession (chain/src/api.ts) with Lace's providers
// (chain/src/browser.ts). Loaded on demand after Lace connects.
//
// NOT RUN AGAINST PREPROD. Wired, typechecked and unit-tested with mocked providers only.
import { useEffect, useRef, useState } from 'react';
import { ZERO_ENTRY, type Entry } from '@undying-ledger/contract';
import type { GroupView, LiveSession, Role, Stage } from './live-session';

type Opened = { slot: number; shares: number; fund: number; loan: number; matches: boolean; meetings: number };
type Busy = null | 'join' | 'record' | 'open' | 'stamp' | 'prove' | 'sunset';

const defaultZk = () => new URL('zk/', location.href.split('#')[0]).href;
const msgOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  // circuit asserts come back inside Midnight.js errors; show the book's own words
  const a = /(Not enough shares|Sunset has happened[^"]*|Already sunset|The vendor is still[^"]*|You are not the member in this slot|Wrong group secret|Passbook does not match the ledger|Repayment is larger than the loan|failed assert[^"]*)/.exec(m);
  return a && !(e as { code?: string })?.code ? `Refused by the book: ${a[1]}.` : m;
};

export default function LiveWrite({ session, address, blockfrost }: { session: LiveSession; address: string; blockfrost: string }) {
  const [role, setRole] = useState<Role>('member');
  const [mySecret, setMySecret] = useState('');
  const [groupSecret, setGroupSecret] = useState('');
  const [slot, setSlot] = useState('0');
  const [passphrase, setPassphrase] = useState('');
  const [zk, setZk] = useState(defaultZk);
  const [relay, setRelay] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('relay') ?? '');
  const [lacePays, setLacePays] = useState(false);
  const [group, setGroup] = useState<GroupView | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [err, setErr] = useState('');
  const [errCode, setErrCode] = useState('');
  const [out, setOut] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stamps, setStamps] = useState<string[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [stamp, setStamp] = useState('');
  const [min, setMin] = useState(1);
  const timer = useRef<HTMLElement>(null);
  const prover = session.setup.proverUri;

  useEffect(() => {
    session.onStage((s) => setStage(s === 'done' ? null : s));
    return () => session.onStage(undefined);
  }, [session]);
  useEffect(() => session.setFee(relay, lacePays), [session, relay, lacePays]);
  useEffect(() => {
    if (!busy) return;
    const t0 = performance.now();
    const iv = setInterval(() => {
      if (timer.current) timer.current.textContent = `${((performance.now() - t0) / 1000).toFixed(1)} s`;
    }, 100);
    return () => clearInterval(iv);
  }, [busy]);

  const act = async (what: Exclude<Busy, null>, f: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(what);
    setErr('');
    setErrCode('');
    setOut('');
    try {
      const m = await f();
      if (m) setOut(m);
    } catch (e) {
      setErr(msgOf(e));
      setErrCode((e as { code?: string })?.code ?? '');
    } finally {
      setBusy(null);
      setStage(null);
    }
  };

  const join = () =>
    act('join', async () => {
      const g = await session.attach({
        address,
        role,
        mySecretHex: mySecret,
        groupSecretHex: groupSecret,
        slot: Number(slot),
        passphrase,
        zkConfigBaseUrl: zk,
        blockfrostProjectId: blockfrost || undefined,
      });
      setGroup(g);
      setEntries(Array.from({ length: g.memberCount }, () => ({ ...ZERO_ENTRY })));
      return role === 'secretary' ? `Joined as the secretary of a ${g.memberCount}-member group.` : `Joined as the member in slot ${slot}.`;
    });

  const record = () =>
    act('record', async () => {
      const s = await session.recordMeeting(entries);
      setStamps(s);
      const g = await session.group();
      setGroup(g);
      setEntries(Array.from({ length: g.memberCount }, () => ({ ...ZERO_ENTRY })));
      return `Meeting ${g.meetings} is on the book. Hand each member their stamp below.`;
    });

  const show = (o: Awaited<ReturnType<LiveSession['openPassbook']>>) =>
    setOpened({
      slot: o.slot,
      shares: Number(o.passbook.shares),
      fund: Number(o.passbook.socialFund),
      loan: Number(o.passbook.loanOutstanding),
      matches: o.matchesLedger,
      meetings: o.meetings,
    });

  const open = () =>
    act('open', async () => {
      const o = await session.openPassbook();
      show(o);
      return o.matchesLedger
        ? `Your copy opens the sealed line on the book (after meeting ${o.meetings}).`
        : 'Your copy on this phone is behind the book. Paste the stamp from the latest meeting.';
    });

  const keep = () =>
    act('stamp', async () => {
      show(await session.importStamp(stamp));
      setStamp('');
      return 'Stamp checked against the book and kept on this phone.';
    });

  const prove = () =>
    act('prove', async () => {
      const r = await session.proveAtLeast(min);
      return `Proof slip on the book: at least ${r.minShares} shares. Ref. ${r.ref}${r.txId ? `, tx ${r.txId.slice(0, 16)}` : ''}. Your total stays on this phone.`;
    });

  const sunset = () =>
    act('sunset', async () => {
      const r = await session.sunset();
      setGroup(await session.group());
      return `Sunset is on the book${r.txId ? ` (tx ${r.txId.slice(0, 16)})` : ''}. Admin paths are closed for good.`;
    });

  const setEntry = (i: number, k: keyof Entry, v: string) => {
    const n = Math.max(0, Math.min(999, Math.floor(Number(v) || 0)));
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, [k]: BigInt(n) } : e)));
  };

  const stageLabel: Record<Stage, string> = {
    proving: `Proving on ${prover.replace(/^https?:\/\//, '')}`,
    balancing: relay ? 'Lace signs, the fee is left for the group key' : 'Lace balances and pays the fee',
    relay: 'The group fee key adds the fee',
    submitting: 'Lace submits to Preprod',
    done: '',
  };

  const provingBlock = (testId: string) => (
    <div className="proving on" role="status" data-testid={testId}>
      <div className="row">
        <span>{stage ? stageLabel[stage] : 'Building the call'}</span>
        <b className="num" ref={timer}>
          0.0 s
        </b>
      </div>
      <span className="skel" style={{ width: '86%' }} />
      <span className="skel" style={{ width: '60%' }} />
      <p className="note">The proof is made by the prover Lace points at. Nothing private goes to the relay.</p>
    </div>
  );

  return (
    <div data-testid="live-write">
      <h3 className="label" style={{ marginTop: 22 }}>
        Act on the book
      </h3>
      {!session.setup.proverLocal && (
        <p className="err" role="alert" data-testid="prover-warning">
          {session.setup.warnings[0]}
        </p>
      )}

      <div className="prose">
        <label className="label" htmlFor="relay">
          Group fee-key relay URL
        </label>
        <input
          id="relay"
          className="addr"
          value={relay}
          onChange={(ev) => setRelay(ev.target.value)}
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
          placeholder="http://localhost:3001"
        />
        {!relay.trim() && (
          <label className="consent">
            <input type="checkbox" checked={lacePays} onChange={(ev) => setLacePays(ev.target.checked)} data-testid="lace-pays" />
            <span>No relay: let Lace pay each fee from my own DUST.</span>
          </label>
        )}
      </div>

      {!group && (
        <>
          <fieldset className="roles">
            <legend className="label">I am</legend>
            <label>
              <input type="radio" name="role" checked={role === 'member'} onChange={() => setRole('member')} /> a member
            </label>
            <label>
              <input type="radio" name="role" checked={role === 'secretary'} onChange={() => setRole('secretary')} /> the secretary
            </label>
          </fieldset>
          <div className="prose">
            <label className="label" htmlFor="mysec">
              {role === 'secretary' ? 'Secretary secret' : 'My member secret'}
            </label>
            <input id="mysec" className="addr" type="password" value={mySecret} onChange={(ev) => setMySecret(ev.target.value)} autoComplete="off" spellCheck={false} />
            <label className="label" htmlFor="gsec" style={{ display: 'block', marginTop: 10 }}>
              Group secret
            </label>
            <input id="gsec" className="addr" type="password" value={groupSecret} onChange={(ev) => setGroupSecret(ev.target.value)} autoComplete="off" spellCheck={false} />
            {role === 'member' && (
              <>
                <label className="label" htmlFor="slot" style={{ display: 'block', marginTop: 10 }}>
                  My slot
                </label>
                <input id="slot" className="addr num" style={{ width: 88 }} inputMode="numeric" value={slot} onChange={(ev) => setSlot(ev.target.value.replace(/\D/g, '').slice(0, 1))} />
              </>
            )}
            <label className="label" htmlFor="pass" style={{ display: 'block', marginTop: 10 }}>
              Passbook lock for this phone
            </label>
            <input id="pass" className="addr" type="password" value={passphrase} onChange={(ev) => setPassphrase(ev.target.value)} autoComplete="new-password" />
            <p className="note" style={{ marginTop: 4 }}>
              Encrypts the passbook kept in this browser. 16 characters or more, with three kinds of character.
            </p>
            <label className="label" htmlFor="zk" style={{ display: 'block', marginTop: 10 }}>
              Proving keys URL
            </label>
            <input id="zk" className="addr" value={zk} onChange={(ev) => setZk(ev.target.value)} spellCheck={false} autoComplete="off" />
          </div>
          <div style={{ height: 12 }} />
          <button className="btn" type="button" onClick={join} disabled={!!busy || !address.trim()}>
            {busy === 'join' ? 'Joining the group' : 'Join this group'}
          </button>
          {busy === 'join' && provingBlock('join-proving')}
        </>
      )}

      {group && (
        <>
          <div className="pub" data-testid="live-group">
            <div>
              <span className="label">You</span>
              <b>{session.role === 'secretary' ? 'Secretary' : `Slot ${session.slot}`}</b>
            </div>
            <div>
              <span className="label">Meetings</span>
              <b className="num">{group.meetings}</b>
            </div>
            <div>
              <span className="label">Phase</span>
              <b>{group.phase}</b>
            </div>
          </div>

          {session.role === 'secretary' && (
            <>
              <h3 className="disp sub3">Record meeting {group.meetings + 1}</h3>
              <table className="ledger entry">
                <thead>
                  <tr>
                    <th scope="col">Slot</th>
                    <th scope="col">Shares</th>
                    <th scope="col">Fund</th>
                    <th scope="col">Lent</th>
                    <th scope="col">Repaid</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i}>
                      <td className="num">{i}</td>
                      {(['shares', 'socialFund', 'loanIssued', 'loanRepaid'] as const).map((k) => (
                        <td key={k}>
                          <input
                            className="cell num"
                            inputMode="numeric"
                            aria-label={`Slot ${i} ${k === 'socialFund' ? 'social fund' : k === 'loanIssued' ? 'loan issued' : k === 'loanRepaid' ? 'loan repaid' : 'shares'}`}
                            value={String(e[k])}
                            onChange={(ev) => setEntry(i, k, ev.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ height: 12 }} />
              <button className="btn" type="button" onClick={record} disabled={!!busy || group.memberCount === 0}>
                {busy === 'record' ? 'Recording on Preprod' : `Stamp and record meeting ${group.meetings + 1}`}
              </button>
              {busy === 'record' && provingBlock('record-proving')}
              {stamps.length > 0 && (
                <ol className="stamps" aria-label="Stamps to hand out" data-testid="stamps">
                  {stamps.map((s) => (
                    <li key={s} className="hash">
                      {s}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          {session.role === 'member' && (
            <>
              <h3 className="disp sub3">My passbook</h3>
              <button className="btn ghost" type="button" onClick={open} disabled={!!busy}>
                {busy === 'open' ? 'Opening' : 'Open my passbook'}
              </button>
              {opened && (
                <div className="facts" data-testid="opened">
                  <div>
                    <span className="label">Shares</span>
                    <b className="num">{opened.shares}</b>
                  </div>
                  <div>
                    <span className="label">Social fund</span>
                    <b className="num">{opened.fund}</b>
                  </div>
                  <div>
                    <span className="label">Loan</span>
                    <b className="num">{opened.loan}</b>
                  </div>
                </div>
              )}
              <div className="prose">
                <label className="label" htmlFor="stamp">
                  Stamp from the secretary
                </label>
                <input id="stamp" className="addr" value={stamp} onChange={(ev) => setStamp(ev.target.value)} spellCheck={false} autoComplete="off" placeholder="undying-stamp:0:29:4:0" />
              </div>
              <div style={{ height: 10 }} />
              <button className="btn ghost" type="button" onClick={keep} disabled={!!busy || !stamp.trim()}>
                {busy === 'stamp' ? 'Checking the stamp' : 'Keep this stamp'}
              </button>

              <h3 className="disp sub3">Prove my savings</h3>
              <div className="step">
                <button type="button" aria-label="Fewer shares" onClick={() => setMin((m) => Math.max(1, m - 1))} disabled={!!busy}>
                  −
                </button>
                <output className="num" aria-live="polite" data-testid="live-min">
                  {min}
                </output>
                <button type="button" aria-label="More shares" onClick={() => setMin((m) => Math.min(999, m + 1))} disabled={!!busy}>
                  +
                </button>
                <span>shares at least</span>
              </div>
              <div style={{ height: 12 }} />
              <button className="btn" type="button" onClick={prove} disabled={!!busy}>
                {busy === 'prove' ? 'Making the proof' : 'Make a proof slip'}
              </button>
              {busy === 'prove' && provingBlock('prove-proving')}
            </>
          )}

          <h3 className="disp sub3">Sunset</h3>
          <p className="note">Anyone may call it once the vendor has been silent for the grace period. The book refuses it before then.</p>
          <div style={{ height: 10 }} />
          <button className="btn ghost" type="button" onClick={sunset} disabled={!!busy || group.phase === 'Sunset'}>
            {busy === 'sunset' ? 'Calling sunset' : group.phase === 'Sunset' ? 'Sunset is done' : 'Call sunset'}
          </button>
          {busy === 'sunset' && provingBlock('sunset-proving')}
        </>
      )}

      <p className="err" role="alert" data-testid="write-err">
        {err}
      </p>
      {errCode === 'payfees-refused' && !lacePays && (
        <button className="btn ghost" type="button" onClick={() => (setRelay(''), setLacePays(true))}>
          Let Lace pay this fee instead
        </button>
      )}
      <p className="after" role="status" data-testid="write-out">
        {out}
      </p>
    </div>
  );
}
