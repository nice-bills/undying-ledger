// SPDX-License-Identifier: Apache-2.0
// Beat 3: the shared household phone. It can read only the public ledger: member keys, a meeting
// count and one hiding commitment per slot. "Try to open" runs the real stamp check with a
// guessed group secret, using the exact passbook figures, and the commitment does not match.
import { useEffect, useRef, useState } from 'react';
import { Leaf, Stamp } from '../a2/paper';
import { anim, stampDown, wait } from '../a2/motion';
import type { BeatProps } from './types';

const group4 = (hex: string) => `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)}`;

export function HusbandBeat({ e, active, go, announce }: BeatProps) {
  const pub = e.publicState();
  const [err, setErr] = useState('');
  const inked = useRef(false);
  const closed = useRef<SVGSVGElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const SLOT = 0;

  useEffect(() => {
    if (!active || inked.current) return;
    inked.current = true;
    anim(
      closed.current,
      [
        { transform: 'translate(40px,-30px) rotate(14deg)', opacity: 0 },
        { transform: 'translate(0,0) rotate(4.4deg)', opacity: 1, offset: 0.6 },
        { transform: 'rotate(5.6deg)', offset: 0.82 },
        { transform: 'rotate(5deg)', opacity: 1 },
      ],
      { duration: 640, easing: 'cubic-bezier(.3,.8,.35,1)' },
    );
    (async () => {
      await wait(260);
      const bars = [...(table.current?.querySelectorAll('.bar') ?? [])];
      await Promise.all(
        bars.map((b, i) =>
          anim(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1.02)', offset: 0.85 }, { transform: 'scaleX(1)' }], {
            duration: 260 + (i % 3) * 30,
            delay: i * 50,
            easing: 'cubic-bezier(.3,.6,.3,1)',
          }),
        ),
      );
    })();
  }, [active]);

  const tryOpen = async () => {
    const opened = e.outsiderTriesToOpen(SLOT); // real check against the on-chain commitment
    const s = stamp.current;
    if (opened) {
      setErr('The commitment opened. This should never happen; please report it.');
      return;
    }
    if (s?.dataset.down) {
      const r = getComputedStyle(s).getPropertyValue('--r');
      anim(s, [{ transform: `rotate(${r}) translateX(0)` }, { transform: `rotate(${r}) translateX(-6px)` }, { transform: `rotate(${r}) translateX(5px)` }, { transform: `rotate(${r}) translateX(0)` }], { duration: 260 });
      return;
    }
    // the clasp holds: the shut cover jolts once against its strap
    anim(closed.current, [{ transform: 'rotate(5deg)' }, { transform: 'rotate(3.6deg) translateX(-2px)' }, { transform: 'rotate(5.6deg)' }, { transform: 'rotate(5deg)' }], {
      duration: 360,
      easing: 'cubic-bezier(.3,.8,.35,1)',
    });
    await stampDown(s, table.current);
    setErr('Opening a slot needs the group secret. Guessing the exact amount does not match the seal either.');
    announce('Cannot open. The slot needs the group secret.');
  };

  return (
    <Leaf band={[<b key="b">Shared household phone</b>, 'Public record']}>
      <svg className="closed" ref={closed} viewBox="0 0 142 186" aria-hidden="true" style={{ transform: 'rotate(5deg)' }}>
        <g>
          <polygon points="4,6 136,2 140,180 2,184" fill="#3E1418" />
          <polygon points="6,8 134,4 137,177 4,181" fill="#5B1F26" />
          <polygon points="14,16 126,13 129,169 12,172" fill="none" stroke="#45161B" strokeWidth={1.4} />
          <polygon points="18,20 122,17 125,165 16,168" fill="none" stroke="#45161B" strokeWidth={0.7} />
          <text x={60} y={62} textAnchor="middle" fill="#C9AE76" fontFamily="Schibsted Grotesk" fontWeight={700} fontSize={9} letterSpacing={2} transform="rotate(-1.2 60 62)">
            SAVINGS
          </text>
          <text x={60} y={75} textAnchor="middle" fill="#C9AE76" fontFamily="Schibsted Grotesk" fontWeight={700} fontSize={9} letterSpacing={2} transform="rotate(-1.2 60 75)">
            PASSBOOK
          </text>
          <text x={60} y={104} textAnchor="middle" fill="#C9AE76" fontFamily="Libre Caslon Display" fontSize={13} transform="rotate(-1.2 60 104)">
            No. 0417
          </text>
          <rect x={114} y={0} width={12} height={186} fill="#202426" transform="rotate(1.5 120 93)" />
          <rect x={111} y={118} width={18} height={22} fill="none" stroke="#8C8A7C" strokeWidth={1.6} transform="rotate(1.5 120 129)" />
        </g>
      </svg>
      <h2 className="disp" tabIndex={-1} style={{ maxWidth: 220, fontSize: 42 }}>
        What he can see
      </h2>
      <p className="lede" style={{ maxWidth: 200 }}>
        Her passbook stays shut on this phone.
      </p>
      <div className="pub">
        <div>
          <span className="label">Members</span>
          <b className="num" data-testid="pub-members">{pub.memberCount} keys</b>
          <span className="note">no names</span>
        </div>
        <div>
          <span className="label">Meetings recorded</span>
          <b className="num" data-testid="pub-meetings">
            {pub.meetings}
          </b>
          <span className="note">all sealed</span>
        </div>
        <div style={{ alignSelf: 'flex-end', maxWidth: 96 }}>
          <span className="label">SMS</span>
          <span className="note" style={{ display: 'block' }}>
            none sent, ever
          </span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <table className="ledger redact" ref={table} style={{ marginTop: 12 }} data-testid="register">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Member</th>
              <th scope="col">Shares</th>
              <th scope="col" className="r">
                Loan
              </th>
            </tr>
          </thead>
          <tbody>
            {pub.slots.slice(0, 5).map((s, i) => (
              <tr key={s.slot} aria-label={`Slot ${s.slot}, version ${s.version}: sealed, no name, no amount`}>
                <td className="num" style={{ width: 50, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-2)' }}>
                  {s.slot}
                </td>
                <td>
                  <span className="bar" style={{ width: 70 + ((i * 23) % 40), transform: inked.current ? undefined : 'scaleX(0)' }} />
                  <span className="hash">{group4(s.commitment)}</span>
                </td>
                <td>
                  <span className="bar" style={{ width: 26 + ((i * 7) % 14), transform: inked.current ? undefined : 'scaleX(0)' }} />
                </td>
                <td className="r">
                  <span className="bar" style={{ width: 30 + ((i * 11) % 22), marginLeft: 'auto', transform: inked.current ? undefined : 'scaleX(0)' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Stamp ref={stamp} kind="cannot" ink="carmine" style={{ left: 104, top: 86, mixBlendMode: 'normal' }} testId="cannot" />
      </div>
      <p className="err" role="status" data-testid="err-open">
        {err}
      </p>
      <div style={{ height: 14 }} />
      <button className="btn ghost" type="button" onClick={tryOpen}>
        Try to open slot {SLOT}
      </button>
      <button className="btn" type="button" onClick={() => go(3)}>
        The grant ends
      </button>
    </Leaf>
  );
}
