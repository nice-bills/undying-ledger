// SPDX-License-Identifier: Apache-2.0
// Live write-through on Preprod: join a deployed group from this phone, then record a meeting
// (secretary), open my own passbook, prove "at least N shares" (member), or call sunset (anyone).
// Each button calls a real circuit through LiveSession (chain/src/api.ts) with Lace's providers
// (chain/src/browser.ts). Loaded on demand after Lace connects.
//
// RAN ON PREPROD, 13 Oct 2026: with a real Lace wallet holding 0 tDUST (recordMeeting and
// attestSavings, payFees: false, fee added by the relay; README "Lace on Preprod") and with no
// wallet at all. Also unit-tested with mocked providers (ui/src/lace/__tests__).
import { useEffect, useRef, useState } from 'react';
import { ZERO_ENTRY, type Entry } from '@undying-ledger/contract';
import { checkPin, lockFromPin, type Invite } from '@undying-ledger/chain/src/invite';
import { LiveError, type GroupView, type LiveSession, type Role, type Stage } from './live-session';

type Opened = { slot: number; shares: number; fund: number; loan: number; matches: boolean; meetings: number };
type Busy = null | 'join' | 'record' | 'open' | 'stamp' | 'prove' | 'vote' | 'sunset';

const defaultZk = () => new URL('zk/', location.href.split('#')[0]).href;
const msgOf = (e: unknown) => {
  // WebCrypto failures (a DOMException such as OperationError) carry an empty message: never show a blank error
  const m = (e instanceof Error ? e.message : String(e)) || `Something went wrong (${(e as { name?: string })?.name ?? 'unknown error'}).`;
  // circuit asserts come back inside Midnight.js errors; show the book's own words
  const a = /(Not enough shares|Sunset has happened[^"]*|Already sunset|The vendor is still[^"]*|The maintainer is still sending heartbeats|You are not the member in this slot|This slot already voted for that candidate|No member in this slot|Wrong group secret|Passbook does not match the ledger|Repayment is larger than the loan|failed assert[^"]*)/.exec(m);
  return a && !(e as { code?: string })?.code ? `Refused by the book: ${a[1].replace(/^failed assert:?\s*/i, '').replace(/\.$/, '')}.` : m;
};

/** A stamp as a QR code, so a member's phone camera can read it instead of her typing it. */
function StampQR({ text }: { text: string }) {
  const [svg, setSvg] = useState('');
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown || svg) return;
    void import('qrcode').then((q) => q.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#10261E', light: '#FFF9EE' } }).then(setSvg));
  }, [shown, svg, text]);
  const slot = text.split(':')[1];
  return (
    <>
      <button type="button" className="linkish" onClick={() => setShown((v) => !v)} aria-expanded={shown}>
        {shown ? 'Hide QR' : `Show as QR for slot ${slot}`}
      </button>
      {shown && svg && <div className="stamp-qr" role="img" aria-label={`QR code of the stamp for slot ${slot}`} data-testid={`stamp-qr-${slot}`} dangerouslySetInnerHTML={{ __html: svg }} />}
    </>
  );
}

export default function LiveWrite({ session, address, blockfrost, invite }: { session: LiveSession; address: string; blockfrost: string; invite?: Invite }) {
  // An invite fills in who she is; "Not you?" or "Join as someone else" drops it for typed secrets.
  const [useInvite, setUseInvite] = useState(!!invite);
  const [role, setRole] = useState<Role>(invite?.role ?? 'member');
  const [mySecret, setMySecret] = useState(invite?.mySecret ?? '');
  const [groupSecret, setGroupSecret] = useState(invite?.groupSecret ?? '');
  const [slot, setSlot] = useState(String(invite?.slot ?? 0));
  const [lockKind, setLockKind] = useState<'pin' | 'long'>('pin');
  const [pin, setPin] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [zk, setZk] = useState(defaultZk);
  const [relay, setRelay] = useState(() => invite?.relay ?? new URLSearchParams(location.hash.split('?')[1] ?? '').get('relay') ?? '');
  const [lacePays, setLacePays] = useState(false);
  const [group, setGroup] = useState<GroupView | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [sentTx, setSentTx] = useState('');
  const [err, setErr] = useState('');
  const [errCode, setErrCode] = useState('');
  const [out, setOut] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stamps, setStamps] = useState<string[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [stamp, setStamp] = useState('');
  const [min, setMin] = useState(1);
  const [candidate, setCandidate] = useState('');
  const [standing, setStanding] = useState<{ secret: string; key: string } | null>(null);
  const noWallet = session.noWalletMode;
  const timer = useRef<HTMLElement>(null);
  const prover = session.setup.proverUri;

  useEffect(() => {
    session.onStage((s, txId) => {
      if (s === 'sent') setSentTx(txId ?? '');
      setStage(s === 'done' ? null : s);
    });
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
    setSentTx('');
    setErr('');
    setErrCode('');
    setOut('');
    try {
      const m = await f();
      if (m) setOut(m);
    } catch (e) {
      // The line on screen is for the member. An unexpected failure (not one of the page's own
      // LiveErrors, which already say what to do) also goes to the console with the cause
      // Midnight.js wraps, for whoever debugs: that is how "Buffer is not defined" was traced.
      if (!(e as { code?: string })?.code) console.error(e, (e as { cause?: unknown })?.cause);
      setErr(msgOf(e));
      setErrCode((e as { code?: string })?.code ?? '');
    } finally {
      setBusy(null);
      setStage(null);
    }
  };

  // The PIN becomes a long passbook lock (PBKDF2, salted with the contract and her own secret).
  const lockFor = async (): Promise<string> => {
    if (lockKind === 'long') return passphrase;
    const bad = checkPin(pin);
    if (bad) throw new LiveError('bad-input', bad);
    const sec = mySecret.trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]{64}$/i.test(sec)) throw new LiveError('bad-input', `${role === 'secretary' ? 'The secretary secret' : 'Your member secret'} must be 64 hex characters (32 bytes), as printed in .preprod/group.json.`);
    return lockFromPin(pin, address.trim().replace(/^0x/i, ''), sec);
  };

  const join = () =>
    act('join', async () => {
      const lock = await lockFor();
      const g = await session.attach({
        address,
        role,
        mySecretHex: mySecret,
        groupSecretHex: groupSecret,
        slot: Number(slot),
        passphrase: lock,
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
      return `Proof slip on the book: at least ${r.minShares} ${Number(r.minShares) === 1 ? 'share' : 'shares'}. Ref. ${r.ref}${r.txId ? `, tx ${r.txId.slice(0, 16)}` : ''}. Your total stays on this phone.`;
    });

  const vote = () =>
    act('vote', async () => {
      const r = await session.voteSecretary(candidate);
      setCandidate('');
      return r.elected
        ? `Your vote made the majority: that key is now the group's secretary${r.txId ? ` (tx ${r.txId.slice(0, 16)})` : ''}.`
        : `Vote on the book${r.txId ? ` (tx ${r.txId.slice(0, 16)})` : ''}. More than half of all members must vote for the same key.`;
    });

  const stand = async () => {
    const { LiveSession: S } = await import('./live-session');
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');
    setStanding({ secret, key: S.secretaryKeyFor(secret) });
  };

  // Someone else on this phone: forget who joined (her passbook stays locked in this browser).
  const leave = () => {
    if (busy) return;
    session.leave();
    setGroup(null);
    setUseInvite(false);
    setMySecret('');
    setGroupSecret('');
    setSlot('0');
    setPin('');
    setPassphrase('');
    setOpened(null);
    setStamps([]);
    setStamp('');
    setStanding(null);
    setCandidate('');
    setErr('');
    setOut('Left the group on this page. The passbook stays locked on this phone. Join as someone else below.');
  };

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
    balancing: noWallet ? 'Binding the call with a throwaway key' : relay ? 'Lace signs, the fee is left for the group key' : 'Lace balances and pays the fee',
    relay: 'The group fee key adds the fee',
    submitting: 'Lace submits to Preprod',
    sent: 'On Preprod. Waiting for the indexer to show it',
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
      {stage === 'sent' && sentTx ? (
        <p className="note" data-testid="sent">
          Sent: Preprod has finalized tx <span className="hash">{sentTx.slice(0, 16)}</span>. The page updates once the indexer shows it.
        </p>
      ) : (
        <p className="note">{noWallet ? 'The proof is made on this machine.' : 'The proof is made by the prover Lace points at.'} Nothing private goes to the relay.</p>
      )}
    </div>
  );

  const zkField = (
    <>
      <label className="label" htmlFor="zk" style={{ display: 'block', marginTop: 10 }}>
        Proving keys URL
      </label>
      <input id="zk" className="addr" value={zk} onChange={(ev) => setZk(ev.target.value)} spellCheck={false} autoComplete="off" />
    </>
  );
  const relayField = (
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
          {noWallet && <p className="note" style={{ marginTop: 4 }}>Without a wallet the relay pays every fee, so this is required.</p>}
          {!relay.trim() && !noWallet && (
            <label className="consent">
              <input type="checkbox" checked={lacePays} onChange={(ev) => setLacePays(ev.target.checked)} data-testid="lace-pays" />
              <span>No relay: let Lace pay each fee from my own DUST.</span>
            </label>
          )}
        </div>
  );

  return (
    <div data-testid="live-write">
      <h3 className="label" style={{ marginTop: 22 }}>
        Act on the book
      </h3>
      {!session.setup.proverLocal && invite?.prover && session.setup.proverUri === invite.prover ? (
        <p className="note" data-testid="group-prover">
          Your proofs are made on the group’s proof server, {invite.prover.replace(/^https?:\/\//, '')}. What you prove goes to that machine, so the group runs it itself.
        </p>
      ) : (
        !session.setup.proverLocal && (
          <p className="err" role="alert" data-testid="prover-warning">
            {session.setup.warnings[0]}
          </p>
        )
      )}

      {invite ? (
        <details className="more" data-testid="connection">
          <summary>Connection details, from your invite</summary>
          {relayField}
          <div className="prose">{zkField}</div>
        </details>
      ) : (
        relayField
      )}

      {!group && (
        <>
          {useInvite && invite ? (
            <div className="prose" data-testid="invite-join">
              <p className="note">
                Joining as {invite.role === 'secretary' ? 'the secretary' : `the member in slot ${invite.slot}`}, from your invite.{' '}
                <button type="button" className="linkish" onClick={() => (setUseInvite(false), setMySecret(''), setGroupSecret(''))}>
                  Not you? Type the secrets instead
                </button>
              </p>
            </div>
          ) : (
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
                    <input id="slot" className="addr num" style={{ width: 88 }} inputMode="numeric" value={slot} onChange={(ev) => setSlot(ev.target.value.replace(/\D/g, '').slice(0, 2))} />
                  </>
                )}
              </div>
            </>
          )}
          <div className="prose">
            {lockKind === 'pin' ? (
              <>
                <label className="label" htmlFor="pin" style={{ display: 'block', marginTop: 10 }}>
                  6-digit PIN for this phone
                </label>
                <input
                  id="pin"
                  className="addr num pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(ev) => setPin(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="off"
                />
                <p className="note" style={{ marginTop: 4 }}>
                  Locks the passbook kept in this browser. Use the same PIN each time you join on this phone. The PIN works only together with your secret, so keep your invite private.
                </p>
              </>
            ) : (
              <>
                <label className="label" htmlFor="pass" style={{ display: 'block', marginTop: 10 }}>
                  Passbook lock for this phone
                </label>
                <input id="pass" className="addr" type="password" value={passphrase} onChange={(ev) => setPassphrase(ev.target.value)} autoComplete="new-password" />
                <p className="note" style={{ marginTop: 4 }}>
                  Encrypts the passbook kept in this browser. 16 characters or more, with three kinds of character.
                </p>
              </>
            )}
            <button type="button" className="linkish" onClick={() => setLockKind((k) => (k === 'pin' ? 'long' : 'pin'))}>
              {lockKind === 'pin' ? 'Use a long lock instead' : 'Use a 6-digit PIN instead'}
            </button>
            {!invite && zkField}
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
          <button type="button" className="linkish" onClick={leave} disabled={!!busy} data-testid="leave">
            Join as someone else
          </button>

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
              <h3 className="disp sub3">Collect a member’s stamp</h3>
              <p className="note">A newly elected secretary starts with an empty book on her phone. Each member reads out her stamp; the book checks it before it is kept.</p>
              <div className="prose">
                <label className="label" htmlFor="sstamp">
                  Member’s stamp
                </label>
                <input id="sstamp" className="addr" value={stamp} onChange={(ev) => setStamp(ev.target.value)} spellCheck={false} autoComplete="off" placeholder="Paste the stamp here" />
              </div>
              <div style={{ height: 10 }} />
              <button className="btn ghost" type="button" onClick={keep} disabled={!!busy || !stamp.trim()}>
                {busy === 'stamp' ? 'Checking the stamp' : 'Check and keep this stamp'}
              </button>
              {stamps.length > 0 && (
                <ol className="stamps" aria-label="Stamps to hand out" data-testid="stamps">
                  {stamps.map((s) => (
                    <li key={s}>
                      <span className="hash">{s}</span>
                      <StampQR text={s} />
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
              {opened && !opened.matches && (
                <p className="note" data-testid="behind">
                  This phone has no copy of your latest passbook yet. Paste the stamp from the secretary below, and your shares show here once the book confirms it.
                </p>
              )}
              {opened?.matches && (
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
              {opened?.matches && (
                <p className="note" data-testid="my-stamp">
                  Your stamp, for a newly elected secretary: <span className="hash">{`undying-stamp:${opened.slot}:${opened.shares}:${opened.fund}:${opened.loan}`}</span>
                </p>
              )}
              <div className="prose">
                <label className="label" htmlFor="stamp">
                  Stamp from the secretary
                </label>
                <input id="stamp" className="addr" value={stamp} onChange={(ev) => setStamp(ev.target.value)} spellCheck={false} autoComplete="off" placeholder="Paste the stamp here" />
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
                <input
                  className="num stepnum"
                  inputMode="numeric"
                  aria-label="Shares at least"
                  data-testid="live-min"
                  value={min}
                  disabled={!!busy}
                  onChange={(ev) => setMin(Math.max(1, Math.min(999, Number(ev.target.value.replace(/\D/g, '').slice(0, 3)) || 1)))}
                  onFocus={(ev) => ev.target.select()}
                />
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

              <h3 className="disp sub3">Elect a new secretary</h3>
              <p className="note">
                If the secretary’s phone is lost, members vote. The one standing makes a secretary key on her own phone and reads it out; more than half of all members voting for it makes her the secretary. Works after sunset too.
              </p>
              <div className="prose">
                <label className="label" htmlFor="cand">
                  Secretary key of the one standing
                </label>
                <input id="cand" className="addr" value={candidate} onChange={(ev) => setCandidate(ev.target.value)} spellCheck={false} autoComplete="off" placeholder="64 hex characters" />
              </div>
              <div style={{ height: 10 }} />
              <div className="pair">
                <button className="btn" type="button" onClick={vote} disabled={!!busy || !candidate.trim()} data-testid="vote">
                  {busy === 'vote' ? 'Voting' : 'Vote for this secretary'}
                </button>
                <button className="btn ghost" type="button" onClick={stand} disabled={!!busy}>
                  I am standing
                </button>
              </div>
              {busy === 'vote' && provingBlock('vote-proving')}
              {standing && (
                <div className="prose" data-testid="standing">
                  <span className="label">Your secretary key (read this out)</span>
                  <p className="hash">{standing.key}</p>
                  <span className="label">Your secretary secret (keep it on this phone only)</span>
                  <p className="hash">{standing.secret}</p>
                  <p className="note">Once elected, join as the secretary with this secret and collect each member’s stamp to rebuild the book.</p>
                </div>
              )}
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
