// SPDX-License-Identifier: Apache-2.0
// Beat 5: the first meeting after sunset. No vendor, no admin key; the real recordMeeting circuit
// still runs, the coins still go into the box, and the fee comes off the group fee key, whose
// tank drains by exactly that fee.
import { useRef, useState } from 'react';
import { Phase } from '@undying-ledger/contract';
import { type MeetingLine, SHARE_VALUE_GHS } from '../demo/engine';
import { ASSUMED_FEE_DUST, FEE_IS_MEASURED } from '../demo/fees';
import { Ghs } from '../a2/paper';
import { CashBox, Figure, KeyTag, Screen, Seal } from '../box/art';
import { anim, coinsInto, countTo, pop, rise, wait } from '../box/motion';
import { proving } from '../a2/proving';
import { MEETING_NO, feeShort, provingNote, shutTheBox } from './MeetingBeat';
import { contractWords, type BeatProps } from './types';

export const MEETING13 = MEETING_NO + 1;

export function Meeting13Beat({ e, go, announce }: BeatProps) {
  const [status, setStatus] = useState<'edit' | 'proving' | 'stamping' | 'done'>('edit');
  const [err, setErr] = useState('');
  const [step, setStep] = useState('');
  const [sheetLines, setSheetLines] = useState<MeetingLine[] | null>(null);
  const [held, setHeld] = useState<number | null>(null); // the tank as shown, until the drain plays
  const box = useRef<SVGSVGElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seal = useRef<HTMLDivElement>(null);
  const paid = useRef<HTMLDivElement>(null);
  const chit = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLElement>(null);
  const left = useRef<HTMLSpanElement>(null);
  const timer = useRef<HTMLElement>(null);

  const f = e.fees;
  const sunset = e.phase === Phase.SUNSET;
  const ready = e.meetingsRecorded === MEETING13 - 1;
  const before = e.meetingsRecorded < MEETING13 - 1;
  const lines = sheetLines ?? e.suggestedNextMeeting();
  const shares = lines.reduce((a, l) => a + l.shares, 0);
  const shownBal = held ?? f.balance;
  const pct = f.cap ? shownBal / f.cap : 0;
  const done = status === 'done';

  const record = async () => {
    if (status !== 'edit' || !ready) return;
    const sheetNow = e.suggestedNextMeeting();
    setSheetLines(sheetNow);
    setErr('');
    setStatus('proving');
    const from = f.balance;
    setHeld(from);
    if (left.current) left.current.dataset.counting = '1';
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
      setHeld(null);
      if (left.current) delete left.current.dataset.counting;
      setErr(`Not recorded. ${contractWords(result.error ?? 'unknown error')}.`);
      announce('Meeting not recorded.');
      return;
    }
    setStatus('stamping');
    const coins = [...(list.current?.querySelectorAll<HTMLElement>('.coin.on i') ?? [])];
    await coinsInto(coins, box.current, list.current?.closest<HTMLElement>('.beat') ?? null);
    await shutTheBox(box.current);
    await pop(seal.current, -8);
    // the tank drains by the fee the group key just paid
    const to = e.fees.balance;
    await Promise.all([
      anim(fill.current, [{ transform: `scaleX(${(from / f.cap).toFixed(4)})` }, { transform: `scaleX(${(to / f.cap).toFixed(4)})` }], { duration: 700 }),
      countTo(left.current, Math.floor(from), Math.floor(to), 700),
    ]);
    if (left.current) delete left.current.dataset.counting;
    setHeld(null);
    await rise(chit.current);
    await wait(60);
    await pop(paid.current, 5);
    setStatus('done');
    announce(`Meeting ${MEETING13} recorded${sunset ? ' after sunset' : ''}. ${ASSUMED_FEE_DUST} DUST paid by the group fee key.`);
  };

  return (
    <Screen who={<><b>Fuseina</b>, secretary</>} where={sunset ? 'No vendor, no admin' : 'Vendor still checking in'}>
      <h2 className="h1" tabIndex={-1}>
        Meeting {MEETING13}
      </h2>
      <p className="hero-sub">{sunset ? 'The first meeting after sunset.' : 'The grant has not ended yet. Recording works either way.'}</p>
      <div className="boxstage">
        <CashBox ref={box} lid={done ? 'shut' : 'up'} vendor={sunset ? 'none' : 'on'} title={done ? 'The cash box, locked' : 'The cash box, lid open'} label={done ? `MEETING ${MEETING13} LOCKED IN` : `${shares} SHARES · GH¢${shares * SHARE_VALUE_GHS}`} />
        <Seal ref={seal} top="NO VENDOR" mid={String(MEETING13)} sub="sealed" style={{ right: 6, top: -6, visibility: done ? 'visible' : 'hidden' }} testId="seal13" />
      </div>
      <div className="tank">
        <div className="t-hd">
          <span className="label">Group fee key {f.epoch}</span>
          <b className="num" data-testid="dust">
            <Figure value={Math.floor(shownBal)} innerRef={left} className="" /> of {f.cap} DUST
          </b>
        </div>
        <div className="t-bar">
          <i ref={fill} style={{ transform: `scaleX(${pct.toFixed(4)})` }} />
        </div>
        <p className="note">
          Refills from the NGO’s one-time endowment. Members hold no DUST.{FEE_IS_MEASURED ? '' : ` ${ASSUMED_FEE_DUST} DUST a call is a placeholder.`}
        </p>
      </div>
      <section className="sheet" aria-label="Meeting 13 shares">
        <div className="members" ref={list} data-testid="m13">
          {lines.map((l, i) => (
            <div className="mrow" key={i}>
              <KeyTag n={i} />
              <div className="mname">
                <b>{e.members[i].name}</b>
                <span>{l.social ? <>fund <Ghs n={2} /></> : 'no fund'}</span>
              </div>
              <div className="coins ro" aria-label={`${l.shares} shares`}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <span key={k} className={`coin${k < l.shares ? ' on' : ''}`}>
                    <i />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={`proving ${status === 'proving' ? 'on' : ''}`} role="status" data-testid="proving13" hidden={status !== 'proving'}>
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
        <p className="err" role="alert">
          {err}
        </p>
        <div className="receipt" ref={chit} hidden={!done}>
          <div className="r-hd">
            <span>Fee chit {MEETING13}</span>
            <Seal ref={paid} top="" mid="PAID" tone="red" style={{ visibility: done ? 'visible' : 'hidden' }} />
          </div>
          <div className="r-ln">
            <span>Fee</span>
            <b className="num">{feeShort()}</b>
          </div>
          <div className="r-ln" data-testid="chit-left">
            <span>Left on fee key {f.epoch}</span>
            <b className="num">{Math.floor(f.balance)} DUST</b>
          </div>
          <p className="after" data-testid="after13">
            Recorded{sunset ? ' with no vendor' : ''}. Fee&nbsp;<b>{feeShort().replace(' ', ' ')}</b> from the group fee key.
          </p>
        </div>
        {before && status === 'edit' && <p className="note">Meeting {MEETING_NO} comes first.</p>}
        <div className="cta">
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
          {done && (
            <button className="btn" type="button" onClick={() => go(5)}>
              Ama applies for a loan
            </button>
          )}
        </div>
      </section>
    </Screen>
  );
}
