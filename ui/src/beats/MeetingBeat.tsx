// SPDX-License-Identifier: Apache-2.0
// Beat 1: the secretary counts meeting 12 into the cash box. Each member's coins are her shares
// for today; "Stamp and record" runs the real recordMeeting circuit, then the coins drop through
// the lid, the three padlocks click shut and the seal lands. Every figure comes from the engine.
import { useRef, useState } from 'react';
import { type MeetingLine, SHARE_VALUE_GHS, SOCIAL_FUND_GHS } from '../demo/engine';
import { ASSUMED_FEE_DUST, FEE_IS_MEASURED } from '../demo/fees';
import { MEASURED } from '../demo/measured';
import { Ghs } from '../a2/paper';
import { CashBox, Figure, KeyTag, Screen, Seal } from '../box/art';
import { bounce, coinsInto, countTo, lid, lock, pop, rise, wait } from '../box/motion';
import { proving } from '../a2/proving';
import { contractWords, type BeatProps } from './types';

export const MEETING_NO = 12;

export const loanNote = (l: MeetingLine) =>
  l.loanIssued && l.loanRepaid ? `new ${l.loanIssued}, repaid ${l.loanRepaid}` : l.loanRepaid ? `repaid ${l.loanRepaid}` : l.loanIssued ? `new loan ${l.loanIssued}` : 'no loan';

export function provingNote(kind: 'recordMeeting' | 'attestSavings') {
  const s = MEASURED.proofSeconds[kind];
  return s != null
    ? `Simulator: the real circuit runs here and makes no proof. On Preprod the proof took ${s} s.`
    : 'Simulator: the real circuit runs here and makes no proof. Preprod proof time is not measured yet.';
}

export const feeWords = () => (FEE_IS_MEASURED ? `${ASSUMED_FEE_DUST} DUST` : `${ASSUMED_FEE_DUST} DUST (placeholder)`);
/** Short form for receipts: the measured fee, or the placeholder marked "est.". */
export const feeShort = () =>
  FEE_IS_MEASURED ? `${Number(ASSUMED_FEE_DUST.toPrecision(3))} DUST` : `${ASSUMED_FEE_DUST} DUST est.`;

/** Shared by meeting 12 and 13: shut the box after a recorded meeting, lock by lock. */
export async function shutTheBox(box: SVGSVGElement | null) {
  await lid(box, 'shut');
  for (const i of [0, 1, 2]) {
    await lock(box, i, 'shut');
    await wait(70);
  }
}

export function MeetingBeat({ e, go, announce }: BeatProps) {
  const [lines, setLines] = useState<MeetingLine[]>(() => e.suggestedNextMeeting());
  const [status, setStatus] = useState<'edit' | 'proving' | 'stamping' | 'done'>(() => (e.meetingsRecorded >= MEETING_NO ? 'done' : 'edit'));
  const [err, setErr] = useState('');
  const [step, setStep] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<SVGSVGElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seal = useRef<HTMLDivElement>(null);
  const paid = useRef<HTMLDivElement>(null);
  const receipt = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLSpanElement>(null);
  const timer = useRef<HTMLElement>(null);

  const shares = lines.reduce((a, l) => a + l.shares, 0);
  const fund = lines.filter((l) => l.social).length * SOCIAL_FUND_GHS;
  const ready = e.meetingsRecorded === MEETING_NO - 1;
  const done = status === 'done';

  const setShares = (i: number, k: number) => {
    const before = shares * SHARE_VALUE_GHS;
    const next = lines.map((l, j) => (j === i ? { ...l, shares: l.shares === k + 1 ? k : k + 1 } : l));
    setLines(next);
    const after = next.reduce((a, l) => a + l.shares, 0) * SHARE_VALUE_GHS;
    if (hero.current) {
      hero.current.dataset.counting = '1';
      countTo(hero.current, before, after, 260).then(() => hero.current && delete hero.current.dataset.counting);
    }
  };

  const record = async () => {
    if (status !== 'edit' || !ready) return;
    setErr('');
    setStatus('proving');
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
    const coins = [...(list.current?.querySelectorAll<HTMLElement>('.coin[aria-pressed="true"] i') ?? [])];
    host.current?.closest('.beat')?.scrollTo({ top: 0, behavior: 'smooth' });
    await wait(120);
    await coinsInto(coins, box.current, host.current?.closest<HTMLElement>('.beat') ?? null);
    await shutTheBox(box.current);
    await pop(seal.current, -8);
    await rise(receipt.current);
    await pop(paid.current, 5);
    setStatus('done');
    announce(`Meeting ${MEETING_NO} recorded and sealed. The group fee key paid the fee. Members paid nothing.`);
  };

  return (
    <Screen who={<><b>Fuseina</b>, secretary</>} where="Kpalsi Women’s Group">
      <div ref={host}>
        <h1 className="h1" tabIndex={-1}>
          Meeting {MEETING_NO}
        </h1>
        <div className="hero-row">
          <span className="hero num">
            GH¢<Figure value={shares * SHARE_VALUE_GHS} innerRef={hero} className="" />
          </span>
        </div>
        <p className="hero-sub">
          {done ? 'locked in the box' : 'going into the box'} · <span className="acc" data-testid="total12">{shares} shares, fund <Ghs n={fund} /></span>
        </p>
        <div className="boxstage">
          <CashBox ref={box} lid={done ? 'shut' : 'up'} title={done ? 'The cash box, locked with three padlocks' : 'The cash box, lid open for today’s shares'} label={done ? `MEETING ${MEETING_NO} LOCKED IN` : 'COUNT THE SHARES IN'} />
          <Seal ref={seal} top="KPALSI · TAMALE" mid={String(MEETING_NO)} sub="sealed" style={{ right: 6, top: -6, visibility: done ? 'visible' : 'hidden' }} testId="seal12" />
        </div>
      </div>
      <section className="sheet" aria-label="Today’s shares">
        <p className="sheet-h">
          Shares at <Ghs n={SHARE_VALUE_GHS} />, social fund <Ghs n={SOCIAL_FUND_GHS} /> each. Tap a coin to count it.
        </p>
        <div className="members" ref={list} data-testid="m12">
          {lines.map((l, i) => (
            <div className="mrow" key={i}>
              <KeyTag n={i} />
              <div className="mname">
                <b>{e.members[i].name}</b>
                <span>{loanNote(l)}</span>
              </div>
              <div className="coins" role="group" aria-label={`${e.members[i].name}, shares bought`}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="coin"
                    aria-label={`${k + 1} share${k ? 's' : ''}`}
                    aria-pressed={k < l.shares}
                    disabled={status !== 'edit'}
                    onClick={(ev) => {
                      setShares(i, k);
                      if (k >= l.shares) bounce(ev.currentTarget.querySelector('i'));
                    }}
                  >
                    <i />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={`proving ${status === 'proving' ? 'on' : ''}`} role="status" data-testid="proving12" hidden={status !== 'proving'}>
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
        <p className="err" role="alert">
          {err}
        </p>
        <div className="receipt" ref={receipt} hidden={!done}>
          <div className="r-hd">
            <span>Receipt No. {String(MEETING_NO).padStart(4, '0')}</span>
            <Seal ref={paid} top="" mid="PAID" tone="red" style={{ visibility: done ? 'visible' : 'hidden' }} />
          </div>
          <div className="r-ln">
            <span>Meeting {MEETING_NO} fee</span>
            <b className="num">{feeShort()}</b>
          </div>
          <div className="r-ln">
            <span>Paid by</span>
            <b>group fee key</b>
          </div>
          <div className="r-ln">
            <span>Members paid</span>
            <b>nothing</b>
          </div>
          <p className="after" data-testid="after12">
            Recorded. Fee paid by the <b>group fee key</b>. Members paid nothing.
          </p>
        </div>
        {status === 'edit' && !ready && <p className="note">This book has moved past meeting {MEETING_NO}.</p>}
        <div className="cta">
          {!done && (
            <button className="btn" type="button" onClick={record} disabled={status !== 'edit' || !ready}>
              {status !== 'edit' ? 'Recording' : `Stamp and record meeting ${MEETING_NO}`}
            </button>
          )}
          {done && (
            <button className="btn" type="button" onClick={() => go(1)}>
              Open Ama’s passbook
            </button>
          )}
        </div>
        <span className="vh">Fee per call: {feeWords()}.</span>
      </section>
    </Screen>
  );
}
