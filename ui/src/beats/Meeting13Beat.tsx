// SPDX-License-Identifier: Apache-2.0
// Beat 5: the first meeting after sunset. No vendor, no admin key; the real recordMeeting circuit
// still runs and the fee comes off the group fee key, shown on a gauge and a pink fee chit.
import { useRef, useState } from 'react';
import { Phase } from '@undying-ledger/contract';
import { type MeetingLine, SOCIAL_FUND_GHS } from '../demo/engine';
import { ASSUMED_FEE_DUST, FEE_IS_MEASURED } from '../demo/fees';
import { Ghs, Leaf, Loose, Stamp } from '../a2/paper';
import { anim, printLine, reveal, settle, stampDown, wait } from '../a2/motion';
import { proving } from '../a2/proving';
import { MEETING_NO, provingNote, secretaryTicks } from './MeetingBeat';
import { contractWords, type BeatProps } from './types';

export const MEETING13 = MEETING_NO + 1;

export function Meeting13Beat({ e, go, announce }: BeatProps) {
  const [status, setStatus] = useState<'edit' | 'proving' | 'stamping' | 'done'>('edit');
  const [err, setErr] = useState('');
  const [step, setStep] = useState('');
  const [sheetLines, setSheetLines] = useState<MeetingLine[] | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const seal = useRef<HTMLDivElement>(null);
  const paid = useRef<HTMLDivElement>(null);
  const chit = useRef<HTMLDivElement>(null);
  const clip = useRef<SVGSVGElement>(null);
  const after = useRef<HTMLParagraphElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const timer = useRef<HTMLElement>(null);
  const pv = useRef<HTMLDivElement>(null);
  const spentFrom = useRef(0);

  const f = e.fees;
  const sunset = e.phase === Phase.SUNSET;
  const ready = e.meetingsRecorded === MEETING13 - 1;
  const before = e.meetingsRecorded < MEETING13 - 1;
  // the sheet the secretary will record: what the group says at the meeting (suggested from her book)
  const lines = sheetLines ?? e.suggestedNextMeeting();
  const pct = f.cap ? f.balance / f.cap : 0;

  const record = async () => {
    if (status !== 'edit' || !ready) return;
    const sheetNow = e.suggestedNextMeeting();
    setSheetLines(sheetNow);
    setErr('');
    setStatus('proving');
    spentFrom.current = f.balance;
    anim(pv.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    const { result } = await proving({
      minMs: 2600,
      steps: ['Running recordMeeting on this phone', 'Sealing 5 passbook entries', 'Group fee key pays the fee'],
      onStep: setStep,
      timer: timer.current,
      work: () => e.recordMeeting(sheetNow),
    });
    if (!result.ok) {
      setStatus('edit');
      setSheetLines(null);
      setErr(`Not recorded. ${contractWords(result.error ?? 'unknown error')}.`);
      announce('Meeting not recorded.');
      return;
    }
    setStatus('stamping');
    await stampDown(seal.current, table.current);
    await secretaryTicks(sheet.current!, [...(table.current?.querySelectorAll('tbody tr') ?? [])]);
    if (after.current) {
      after.current.hidden = false;
      printLine([after.current], 800);
    }
    await settle(chit.current, 'right');
    if (clip.current) {
      clip.current.style.display = '';
      anim(clip.current, [{ transform: 'translateY(-14px) rotate(-8deg)', opacity: 0 }, { transform: 'rotate(2deg)', opacity: 1, offset: 0.7 }, { transform: 'rotate(0)' }], {
        duration: 340,
        easing: 'cubic-bezier(.3,.9,.35,1)',
      });
    }
    await wait(200);
    await stampDown(paid.current, chit.current);
    reveal(next.current);
    setStatus('done');
    announce(`Meeting ${MEETING13} recorded${sunset ? ' after sunset' : ''}. ${ASSUMED_FEE_DUST} DUST paid by the group fee key.`);
  };

  const done = status === 'done';
  return (
    <Leaf band={[<><b>Fuseina</b>, secretary</>, sunset ? 'No vendor, no admin' : 'Vendor still checking in']} sheetRef={sheet}>
      <h2 className="disp" tabIndex={-1}>
        Meeting {MEETING13}
      </h2>
      {/* a fixed measure, so the lede wraps to two lines at 430 px too and the table header sits below the seal */}
      <p className="lede" style={{ maxWidth: 'min(60%, 190px)' }}>
        {sunset ? 'The first meeting after sunset.' : 'The grant has not ended yet. Recording works either way.'}
      </p>
      <Stamp ref={seal} kind="seal" ink="carmine" text={String(MEETING13)} style={{ right: 6, top: 4 }} testId="seal13" />
      <table className="ledger ruled m13" ref={table} data-testid="m13">
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col" className="r">
              Shares
            </th>
            <th scope="col" className="r">
              Fund
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="nm">{e.members[i].name}</td>
              <td className="r num">{l.shares}</td>
              <td className="r num">{l.social ? <Ghs n={SOCIAL_FUND_GHS} /> : '0'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ position: 'relative' }}>
        <div className="gauge">
          <div className="head">
            <span className="label">Group fee key {f.epoch}</span>
            <b className="num" data-testid="dust">
              {Math.floor(f.balance)} of {f.cap} DUST
            </b>
          </div>
          <div className="scale">
            <span className="fill" style={{ transform: `scaleX(${pct.toFixed(4)})` }} />
            <span className="ticks" />
          </div>
          <div className="tl">
            <span>0</span>
            <span>{f.cap / 2}</span>
            <span>{f.cap}</span>
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            Refills from the NGO’s one-time endowment. Members hold no DUST.{FEE_IS_MEASURED ? '' : ` ${ASSUMED_FEE_DUST} DUST a call is a placeholder.`}
          </p>
        </div>
        <Loose
          ref={chit}
          className="chit"
          tilt={-3.6}
          shown={done}
          style={{ right: -36, top: -6 }}
          edge={{ seed: 9, top: { amp: 0.6, n: 8 }, right: { amp: 0.8, n: 10 }, bottom: { kind: 'torn', amp: 4.5, n: 26 }, left: { amp: 0.8, n: 10 } }}
        >
          <div className="hd">Fee chit {MEETING13}</div>
          <div className="ln">{ASSUMED_FEE_DUST} DUST</div>
          <div className="ln">fee key {f.epoch}</div>
          <div className="ln" data-testid="chit-left">
            <span className="n">{Math.floor(f.balance)}</span> left
          </div>
          <Stamp ref={paid} kind="paid" ink="paid" style={{ left: 22, top: 118 }} />
        </Loose>
        <svg className="clip" ref={clip} width="22" height="62" viewBox="0 0 22 62" style={{ right: 62, top: -28, display: status === 'done' || status === 'stamping' ? undefined : 'none' }} aria-hidden="true">
          <path d="M7 44V10a5 5 0 0 1 10 0v40a8 8 0 0 1-16 0V16" fill="none" stroke="#7A807C" strokeWidth={2} strokeLinecap="round" />
          <path d="M8 44V11a4 4 0 0 1 4-4" fill="none" stroke="#A9AEA8" strokeWidth={0.8} />
        </svg>
      </div>
      <div style={{ minHeight: 56 }}>
        <div className={`proving ${status === 'proving' ? 'on' : ''}`} role="status" ref={pv} data-testid="proving13">
          <div className="row">
            <span>{step}</span>
            <b className="num" ref={timer}>
              0.0 s
            </b>
          </div>
          <span className="skel" style={{ width: '88%' }} />
          <span className="skel" style={{ width: '58%' }} />
          <p className="note">{provingNote('recordMeeting')}</p>
        </div>
        <p className="after" ref={after} hidden={!done} style={{ maxWidth: '80%' }} data-testid="after13">
          Recorded{sunset ? ' with no vendor' : ''}. Fee&nbsp;<b>{ASSUMED_FEE_DUST}&nbsp;DUST</b> from the group fee key.
        </p>
        <p className="err" role="alert">
          {err}
        </p>
      </div>
      {before && status === 'edit' && (
        <p className="note" style={{ marginBottom: 10 }}>
          Meeting {MEETING_NO} comes first.
        </p>
      )}
      {before && status === 'edit' ? (
        <button className="btn ghost" type="button" onClick={() => go(0)}>
          Go to meeting {MEETING_NO}
        </button>
      ) : (
        !done && (
          <button className="btn" type="button" onClick={record} disabled={status !== 'edit' || !ready}>
            {status !== 'edit' ? 'Recording' : `Stamp and record meeting ${MEETING13}`}
          </button>
        )
      )}
      <button className="btn" type="button" ref={next} hidden={!done} onClick={() => go(5)}>
        Ama applies for a loan
      </button>
    </Leaf>
  );
}
