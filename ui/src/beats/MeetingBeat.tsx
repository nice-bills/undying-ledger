// SPDX-License-Identifier: Apache-2.0
// Beat 1: the secretary fills in meeting 12 in the group's green minute book and stamps it.
// "Stamp and record" runs the real recordMeeting circuit; every figure comes from the engine.
import { useRef, useState } from 'react';
import { type MeetingLine, SHARE_VALUE_GHS, SOCIAL_FUND_GHS } from '../demo/engine';
import { ASSUMED_FEE_DUST, FEE_IS_MEASURED } from '../demo/fees';
import { MEASURED } from '../demo/measured';
import { Ghs, Leaf, Loose, Stamp } from '../a2/paper';
import { anim, draw, linePath, penJitter, printLine, rel, reveal, settle, stampDown, tickPath } from '../a2/motion';
import { proving } from '../a2/proving';
import { contractWords, type BeatProps } from './types';

export const MEETING_NO = 12;

export const loanNote = (l: MeetingLine) =>
  l.loanIssued && l.loanRepaid ? `new ${l.loanIssued}, repaid ${l.loanRepaid}` : l.loanRepaid ? `repaid ${l.loanRepaid}` : l.loanIssued ? `new, ${l.loanIssued}` : '';

export async function secretaryTicks(sheet: Element, rows: Element[]) {
  for (const [i, tr] of rows.entries()) {
    const b = rel(tr, sheet);
    await draw(sheet, tickPath(8 + penJitter() * 3, b.y + b.h / 2 - 8, 0.95 + penJitter() * 0.15), {
      ms: 170 + penJitter() * 60,
      delay: i ? 40 + penJitter() * 70 : 0,
    });
  }
}

export function provingNote(kind: 'recordMeeting' | 'attestSavings') {
  const s = MEASURED.proofSeconds[kind];
  return s != null
    ? `Simulator: the real circuit runs here and makes no proof. On Preprod the proof took ${s} s.`
    : 'Simulator: the real circuit runs here and makes no proof. Preprod proof time is not measured yet.';
}

export const feeWords = () => (FEE_IS_MEASURED ? `${ASSUMED_FEE_DUST} DUST` : `${ASSUMED_FEE_DUST} DUST (placeholder)`);
/** Short form for the handwritten receipt: the measured fee, or the placeholder marked "est.". */
export const feeShort = () =>
  FEE_IS_MEASURED ? `${Number(ASSUMED_FEE_DUST.toPrecision(3))} DUST` : `${ASSUMED_FEE_DUST} DUST est.`;

export function MeetingBeat({ e, go, announce }: BeatProps) {
  const [lines, setLines] = useState<MeetingLine[]>(() => e.suggestedNextMeeting());
  const [status, setStatus] = useState<'edit' | 'proving' | 'stamping' | 'done'>(() => (e.meetingsRecorded >= MEETING_NO ? 'done' : 'edit'));
  const [err, setErr] = useState('');
  const [step, setStep] = useState('');
  const sheet = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const seal = useRef<HTMLDivElement>(null);
  const paid = useRef<HTMLDivElement>(null);
  const receipt = useRef<HTMLDivElement>(null);
  const after = useRef<HTMLParagraphElement>(null);
  const total = useRef<HTMLTableCellElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const timer = useRef<HTMLElement>(null);
  const pv = useRef<HTMLDivElement>(null);

  const shares = lines.reduce((a, l) => a + l.shares, 0);
  const fund = lines.filter((l) => l.social).length * SOCIAL_FUND_GHS;
  const ready = e.meetingsRecorded === MEETING_NO - 1;

  const setShares = (i: number, k: number) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, shares: l.shares === k + 1 ? k : k + 1 } : l)));
  };

  const record = async () => {
    if (status !== 'edit' || !ready) return;
    setErr('');
    setStatus('proving');
    anim(pv.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    const { result } = await proving({
      minMs: 2600,
      steps: ['Running recordMeeting on this phone', 'Sealing 5 passbook entries', 'Each member’s phone checks its stamp'],
      onStep: setStep,
      timer: timer.current,
      work: () => e.recordMeeting(lines),
    });
    if (!result.ok) {
      setStatus('edit');
      setErr(`Not recorded. The contract said: ${contractWords(result.error ?? 'unknown error')}.`);
      announce('Meeting not recorded.');
      return;
    }
    setStatus('stamping');
    const s = sheet.current!;
    await stampDown(seal.current, table.current);
    await secretaryTicks(s, [...(table.current?.querySelectorAll('tbody tr') ?? [])]);
    if (total.current) {
      const t = rel(total.current, s);
      draw(s, linePath(t.x - 2, t.y + t.h - 9, t.x + t.w * 0.62), { ms: 300 });
    }
    if (after.current) {
      after.current.hidden = false;
      printLine([after.current], 800);
    }
    await settle(receipt.current, 'right');
    await stampDown(paid.current, receipt.current);
    reveal(next.current);
    setStatus('done');
    announce(`Meeting ${MEETING_NO} recorded and stamped. The group fee key paid the fee. Members paid nothing.`);
  };

  const done = status === 'done';
  return (
    <Leaf band={[<><b>Fuseina</b>, secretary</>, 'Kpalsi Women’s Group']} sheetRef={sheet}>
      <h1 className="disp" tabIndex={-1}>
        Meeting {MEETING_NO}
      </h1>
      <p className="lede" style={{ maxWidth: '62%' }}>
        Tamale. Shares at <Ghs n={SHARE_VALUE_GHS} />, social fund <Ghs n={SOCIAL_FUND_GHS} /> each.
      </p>
      <div style={{ position: 'relative' }}>
        <table className="ledger" ref={table} data-testid="m12">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Shares bought today</th>
              <th scope="col" className="r">
                Loan
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="nm">{e.members[i].name}</td>
                <td>
                  <div className="boxes" role="group" aria-label={`${e.members[i].name}, shares bought`}>
                    {[0, 1, 2, 3, 4].map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-label={`${k + 1} share${k ? 's' : ''}`}
                        aria-pressed={k < l.shares}
                        disabled={status !== 'edit'}
                        onClick={(ev) => {
                          setShares(i, k);
                          if (k >= l.shares) anim(ev.currentTarget.querySelector('i'), [{ transform: 'scale(1.18) rotate(2deg)' }, { transform: 'scale(1)' }], { s: 'detent' });
                        }}
                      >
                        <i />
                      </button>
                    ))}
                  </div>
                </td>
                <td className="r">
                  {loanNote(l) && (
                    <span className="hand tilt" style={{ ['--t' as string]: `${i % 2 ? 2.5 : -3}deg`, fontSize: 22 }}>
                      {loanNote(l)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total">
              <td>Total</td>
              <td className="num" ref={total} data-testid="total12">
                {shares} shares, <Ghs n={shares * SHARE_VALUE_GHS} />
              </td>
              <td className="r note">
                fund <Ghs n={fund} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Stamp ref={seal} kind="seal" ink="carmine" text={String(MEETING_NO)} style={{ right: 6, top: 4 }} testId="seal12" />
      <div style={{ minHeight: 146 }}>
        <div className={`proving ${status === 'proving' ? 'on' : ''}`} role="status" ref={pv} data-testid="proving12">
          <div className="row">
            <span>{step}</span>
            <b className="num" ref={timer}>
              0.0 s
            </b>
          </div>
          <span className="skel" style={{ width: '92%' }} />
          <span className="skel" style={{ width: '64%' }} />
          <p className="note">{provingNote('recordMeeting')}</p>
        </div>
        <p className="after" ref={after} hidden={!done} style={{ maxWidth: '46%' }} data-testid="after12">
          Recorded. Fee paid by the <b>group fee key</b>. Members paid nothing.
        </p>
        <p className="err" role="alert">
          {err}
        </p>
      </div>
      <Loose
        ref={receipt}
        className="receipt"
        tilt={4.2}
        shown={done}
        style={{ right: -10, top: 458 }}
        edge={{ seed: 7, top: { kind: 'torn', amp: 5, n: 34 }, right: { amp: 0.8, n: 10 }, bottom: { amp: 0.8, n: 10 }, left: { amp: 0.8, n: 10 } }}
      >
        <div className="hd">
          <span>Receipt</span>
          <span>No. {String(MEETING_NO).padStart(4, '0')}</span>
        </div>
        <div className="ln">Meeting {MEETING_NO} fee {feeShort()}</div>
        <div className="ln">paid: group fee key</div>
        <div className="ln">members: nil</div>
        <Stamp ref={paid} kind="paid" ink="paid" style={{ right: 8, top: 80 }} />
      </Loose>
      <div style={{ height: 10 }} />
      {status === 'edit' && !ready && (
        <p className="note" style={{ marginBottom: 10 }}>
          This book has moved past meeting {MEETING_NO}.
        </p>
      )}
      {!done && (
        <button className="btn" type="button" onClick={record} disabled={status !== 'edit' || !ready}>
          {status !== 'edit' ? 'Recording' : `Stamp and record meeting ${MEETING_NO}`}
        </button>
      )}
      <button className="btn" type="button" ref={next} hidden={!done} onClick={() => go(1)}>
        Open Ama’s passbook
      </button>
      <span className="vh">Fee per call: {feeWords()}.</span>
    </Leaf>
  );
}
