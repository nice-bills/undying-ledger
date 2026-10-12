// SPDX-License-Identifier: Apache-2.0
// Beat 2: Ama's own book on her phone. Her padlock (the middle one) springs open with her key,
// the newest line slides in, her shares count up, and the line is checked against the on-chain
// commitment with the group secret before the "matches" seal lands. "Lock now" hides it all.
import { useEffect, useRef, useState } from 'react';
import { SHARE_VALUE_GHS } from '../demo/engine';
import { Ghs } from '../a2/paper';
import { CashBox, Figure, LockNow, Screen, Seal } from '../box/art';
import { anim, countTo, lock, pop, rise, wait } from '../box/motion';
import type { BeatProps } from './types';

/** A VSLA cycle here runs 36 meetings, then the box is opened and everyone takes her savings home. */
export const CYCLE_MEETINGS = 36;

export function PassbookBeat({ e, active, go, announce }: BeatProps) {
  const ama = e.members[0];
  const pb = e.passbookOf(ama);
  const newest = ama.stamps[0];
  const [printed, setPrinted] = useState(() => newest?.meeting ?? 0);
  const fresh = newest && newest.meeting > printed ? newest : null;
  const shown = fresh ? ama.stamps[1] : newest; // figures as of the last line already shown
  const [locked, setLocked] = useState(false);
  const box = useRef<SVGSVGElement>(null);
  const match = useRef<HTMLDivElement>(null);
  const shA = useRef<HTMLSpanElement>(null);
  const valA = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const busy = useRef(false);
  const [opened, setOpened] = useState(false);

  const verified = newest ? e.sim.verifyStamp(e.groupSecret, newest.stamp) : false;
  const rows = ama.stamps.slice(0, 5);
  const lastLoan = ama.stamps.find((s) => s.delta.loanIssued > 0n);
  const owed = Number(pb.loanOutstanding);
  const holding = Number(shown?.stamp.passbook.shares ?? pb.shares);
  const left = Math.max(0, CYCLE_MEETINGS - e.meetingsRecorded);
  const pace = ama.stamps.length ? ama.stamps.reduce((a, s) => a + Number(s.delta.shares), 0) / ama.stamps.length : 0;
  const projected = Math.round(Number(pb.shares) + pace * left) * SHARE_VALUE_GHS;

  const loanCell = (s: (typeof rows)[number]) => {
    const rep = Number(s.delta.loanRepaid), iss = Number(s.delta.loanIssued);
    if (rep) return s.stamp.passbook.loanOutstanding === 0n ? `${rep}, cleared` : `repaid ${rep}`;
    if (iss) return `new loan ${iss}`;
    return '';
  };

  useEffect(() => {
    if (!active || busy.current) return;
    busy.current = true;
    (async () => {
      await wait(200);
      if (!opened) {
        await lock(box.current, 1, 'open');
        setOpened(true);
      }
      if (!fresh) {
        busy.current = false;
        return;
      }
      const row = list.current?.querySelector<HTMLElement>(`li[data-m="${fresh.meeting}"]`);
      await rise(row ?? null, -30);
      const from = Number(shown?.stamp.passbook.shares ?? 0);
      const to = Number(fresh.stamp.passbook.shares);
      [shA.current, valA.current].forEach((el) => el && (el.dataset.counting = '1'));
      await Promise.all([countTo(shA.current, from, to, 700), countTo(valA.current, from * SHARE_VALUE_GHS, to * SHARE_VALUE_GHS, 700)]);
      [shA.current, valA.current].forEach((el) => el && delete el.dataset.counting);
      anim(shA.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 260 });
      if (verified) await pop(match.current, 7);
      setPrinted(fresh.meeting);
      busy.current = false;
      announce(`Entry ${fresh.meeting} added. Ama holds ${to} shares, ${to * SHARE_VALUE_GHS} cedis. ${verified ? 'It matches the group seal.' : ''}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fresh?.meeting]);

  return (
    <Screen who={<><b>Ama</b>’s phone</>} where="Opened with her PIN" action={<LockNow onLock={() => setLocked(true)} />}>
      <h2 className="h1" tabIndex={-1}>
        Ama’s book
      </h2>
      <div className="hero-row">
        <span className="hero num" style={{ fontSize: 'var(--hero-xl)' }}>
          <Figure value={fresh ? holding : Number(pb.shares)} innerRef={shA} testId="ama-shares" className="" />
        </span>
        <span className="hero unit">SHARES</span>
      </div>
      <p className="hero-sub">
        GH¢<Figure value={(fresh ? holding : Number(pb.shares)) * SHARE_VALUE_GHS} innerRef={valA} testId="ama-value" className="" /> saved.{' '}
        {owed ? <>Loan owed: <Ghs n={owed} />.</> : lastLoan ? <>Her <Ghs n={Number(lastLoan.delta.loanIssued)} /> loan is paid off.</> : 'No loan.'}
      </p>
      <div className="boxstage">
        <CashBox ref={box} locks={['shut', opened ? 'open' : 'shut', 'shut']} title="The group’s cash box. Ama holds the key to the middle padlock, and it is open." label="AMA HOLDS THE MIDDLE KEY" />
        <Seal ref={match} top="MATCHES" mid={String(newest?.meeting ?? '')} sub="group seal" tone="cream" style={{ right: 4, top: -8, visibility: fresh || !newest ? 'hidden' : 'visible' }} testId="match" />
      </div>
      <section className="sheet" aria-label="Ama’s passbook">
        <div className="card shareout">
          <div>
            <b>Share-out in {left} meetings</b>
            <span>
              At her pace she takes home about <Ghs n={projected} />.
            </span>
          </div>
          <span className="hero num small">{left}</span>
        </div>
        <ol className="history" ref={list} data-testid="passbook" aria-label="Last five entries">
          {rows.map((s) => (
            <li key={s.meeting} data-m={s.meeting} className={fresh?.meeting === s.meeting || printed === s.meeting ? 'new' : ''} style={fresh?.meeting === s.meeting ? { opacity: 0 } : undefined}>
              <span className="mt">Meeting {s.meeting}</span>
              <span className="d num">+{String(s.delta.shares)}</span>
              <span className="h num">holding {String(s.stamp.passbook.shares)}</span>
              <span className="l">{loanCell(s)}</span>
            </li>
          ))}
        </ol>
        <div className="facts">
          <div>
            <span className="label">Social fund to date</span>
            <b className="num">
              <Ghs n={Number(pb.socialFund)} />
            </b>
          </div>
          <div>
            <span className="label">{lastLoan ? <>Loan of <Ghs n={Number(lastLoan.delta.loanIssued)} /></> : 'Loans'}</span>
            <b id="loanstate">{owed ? <><Ghs n={owed} /> owed</> : lastLoan ? 'Cleared' : 'None'}</b>
          </div>
        </div>
        <p className="note">Only this phone holds the key that reads this page.</p>
        <div className="cta">
          <button className="btn" type="button" onClick={() => go(2)}>
            See her husband’s phone
          </button>
        </div>
      </section>
      {locked && (
        <div className="cover" role="dialog" aria-label="Locked">
          <CashBox title="The cash box, all three padlocks shut" label="LOCKED" />
          <p>Locked. Anyone picking up this phone sees the group’s box, not her book.</p>
          <button className="btn light" type="button" onClick={() => setLocked(false)} autoFocus>
            Open with her PIN
          </button>
        </div>
      )}
    </Screen>
  );
}
