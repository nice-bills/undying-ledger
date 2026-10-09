// SPDX-License-Identifier: Apache-2.0
// Beat 2: Ama's own passbook on her phone. Rows are her real stamps; the newest one is printed
// in when she opens the page, then checked against the on-chain commitment with the group secret.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SHARE_VALUE_GHS } from '../demo/engine';
import { Ced, Ghs, Leaf, Stamp } from '../a2/paper';
import { circlePath, countTo, draw, linePath, printLine, rel, stampDown, wait } from '../a2/motion';
import type { BeatProps } from './types';

/** A figure the page counts up imperatively; React only sets the resting value. */
function Count({ value, id, testId, innerRef }: { value: number; id?: string; testId?: string; innerRef: React.RefObject<HTMLSpanElement | null> }) {
  const ref = innerRef;
  useLayoutEffect(() => {
    if (ref.current && !ref.current.dataset.counting) ref.current.textContent = String(value);
  }, [value]);
  return <span ref={ref} id={id} data-testid={testId} className="num" />;
}

export function PassbookBeat({ e, active, go, announce }: BeatProps) {
  const ama = e.members[0];
  const pb = e.passbookOf(ama);
  const newest = ama.stamps[0];
  const [printed, setPrinted] = useState(() => newest?.meeting ?? 0);
  const fresh = newest && newest.meeting > printed ? newest : null;
  const shown = fresh ? ama.stamps[1] : newest; // the figures as of the last printed line
  const [shownShares, setShownShares] = useState<number | null>(null);
  const [printedSet, setPrintedSet] = useState<number[]>([]);
  const sheet = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const match = useRef<HTMLDivElement>(null);
  const shA = useRef<HTMLSpanElement>(null);
  const valA = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  const verified = newest ? e.sim.verifyStamp(e.groupSecret, newest.stamp) : false;
  const rows = ama.stamps.slice(0, 5).reverse();
  const lastLoan = ama.stamps.find((s) => s.delta.loanIssued > 0n);
  const owed = Number(pb.loanOutstanding);
  const holding = shownShares ?? Number(shown?.stamp.passbook.shares ?? pb.shares);

  const loanCell = (s: (typeof rows)[number]) => {
    const rep = Number(s.delta.loanRepaid), iss = Number(s.delta.loanIssued);
    if (rep) return s.stamp.passbook.loanOutstanding === 0n ? `${rep}, cleared` : String(rep);
    if (iss) return `new, ${iss}`;
    return '';
  };

  useEffect(() => {
    if (!active || !fresh || busy.current) return;
    busy.current = true;
    (async () => {
      const s = sheet.current!;
      const prts = [...s.querySelectorAll<HTMLElement>(`tr[data-m="${fresh.meeting}"] .prt`)];
      await wait(250);
      await printLine(prts);
      const from = Number(shown?.stamp.passbook.shares ?? 0);
      const to = Number(fresh.stamp.passbook.shares);
      [shA.current, valA.current].forEach((el) => el && (el.dataset.counting = '1'));
      await Promise.all([countTo(shA.current, from, to, 520), countTo(valA.current, from * SHARE_VALUE_GHS, to * SHARE_VALUE_GHS, 520)]);
      [shA.current, valA.current].forEach((el) => el && delete el.dataset.counting);
      setShownShares(to);
      await wait(200);
      const h = s.querySelector(`tr[data-m="${fresh.meeting}"] .hold`);
      if (h) {
        const c = rel(h, s);
        await draw(s, circlePath(c.x + c.w / 2 + 1, c.y + c.h / 2, c.w / 2 + 11, c.h / 2 + 6), { ms: 420 });
      }
      const k = s.querySelector('#loanstate');
      if (k && fresh.stamp.passbook.loanOutstanding === 0n && fresh.delta.loanRepaid > 0n) {
        const r = rel(k, s);
        await draw(s, linePath(r.x - 2, r.y + r.h + 1, r.x + r.w + 6, 1), { ms: 260 });
        draw(s, linePath(r.x + 3, r.y + r.h + 5, r.x + r.w + 2, 1), { ms: 220 });
      }
      await wait(160);
      if (verified) await stampDown(match.current, tableRef.current);
      setPrinted(fresh.meeting);
      setPrintedSet((xs) => [...xs, fresh.meeting]);
      setShownShares(null);
      busy.current = false;
      announce(`Entry ${fresh.meeting} printed. Ama holds ${to} shares, ${to * SHARE_VALUE_GHS} cedis. ${verified ? 'It matches the group seal.' : ''}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fresh?.meeting]);

  return (
    <Leaf band={[<><b>Ama</b>’s phone</>, 'Opened with her PIN']} dog sheetRef={sheet}>
      <p className="label">Savings passbook No. 0417</p>
      <div className="head1">
        <h2 className="disp" tabIndex={-1} style={{ fontSize: 64, marginTop: 4 }}>
          Ama
        </h2>
        <div className="bal">
          <span className="label">Shares held</span>
          <span className="fig">
            <Count value={holding} innerRef={shA} testId="ama-shares" />
          </span>
          <span className="sub">
            GH<Ced />
            <Count value={holding * SHARE_VALUE_GHS} innerRef={valA} testId="ama-value" />
          </span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <table className="ledger pb ruled" ref={tableRef} data-testid="passbook">
          <thead>
            <tr>
              <th scope="col">Mtg</th>
              <th scope="col">Bought</th>
              <th scope="col">Holding</th>
              <th scope="col" className="r">
                Loan repaid
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const isFresh = fresh?.meeting === s.meeting;
              const printedHere = isFresh || printedSet.includes(s.meeting);
              const cell = (v: string, cls = '') =>
                printedHere ? (
                  <span className="skew">
                    <span className={`prt ${cls}`} style={isFresh ? { visibility: 'hidden' } : undefined}>
                      {v}
                    </span>
                  </span>
                ) : (
                  <span className={cls}>{v}</span>
                );
              return (
                <tr key={s.meeting} data-m={s.meeting} className={printedHere ? 'fresh' : ''}>
                  <td className="mt">{cell(String(s.meeting))}</td>
                  <td className="num">{cell(String(s.delta.shares))}</td>
                  <td className="num">{cell(String(s.stamp.passbook.shares), 'hold')}</td>
                  <td className="r">{cell(loanCell(s))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Stamp ref={match} kind="match" ink="violet" text={`group seal ${newest?.meeting ?? ''}`} style={{ right: -2, top: 142 }} testId="match" />
      </div>
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
      <p className="after" style={{ color: 'var(--ink-2)', maxWidth: '74%' }}>
        Only this phone holds the key that reads this page.
      </p>
      <div style={{ height: 14 }} />
      <button className="btn" type="button" onClick={() => go(2)}>
        See her husband’s phone
      </button>
    </Leaf>
  );
}
