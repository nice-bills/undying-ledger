// SPDX-License-Identifier: Apache-2.0
// Beat 6: Ama proves "at least N shares" to a loan officer. "Make a proof slip" runs the real
// attestSavings circuit with her key and her passbook as private inputs. Asking for more than
// she holds is refused by the circuit itself, and the slip is withdrawn.
import { useRef, useState } from 'react';
import { SHARE_VALUE_GHS } from '../demo/engine';
import { Ghs, Loose, Leaf, Stamp } from '../a2/paper';
import { anim, draw, linePath, rel, stampDown, wait } from '../a2/motion';
import { proving } from '../a2/proving';
import { provingNote } from './MeetingBeat';
import { contractWords, type BeatProps } from './types';

export function ProveBeat({ e, announce }: BeatProps) {
  const ama = e.members[0];
  const pb = e.passbookOf(ama);
  const shares = Number(pb.shares);
  const [min, setMin] = useState(30);
  const [status, setStatus] = useState<'edit' | 'proving' | 'stamping' | 'done'>('edit');
  const [err, setErr] = useState('');
  const [step, setStep] = useState('');
  const [proved, setProved] = useState<{ min: number; nonce: string; meeting: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const atleast = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const slip = useRef<HTMLDivElement>(null);
  const skel = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const ok = useRef<HTMLDivElement>(null);
  const withheld = useRef<HTMLUListElement>(null);
  const timer = useRef<HTMLElement>(null);
  const underlined = useRef(false);

  const change = (v: number) => {
    setMin(Math.max(1, Math.min(60, v)));
    setErr('');
  };

  const prove = async () => {
    if (status !== 'edit') return;
    setErr('');
    setStatus('proving');
    const s = sheet.current!;
    if (!underlined.current && atleast.current) {
      underlined.current = true;
      const a = rel(atleast.current, s);
      draw(s, linePath(a.x - 1, a.y + a.h - 1, a.x + a.w + 3, 1.1), { ms: 260 });
    }
    const w = wrap.current!, sl = slip.current!;
    w.hidden = false;
    w.style.height = '182px';
    sl.hidden = false;
    sl.style.transform = 'rotate(0deg)';
    if (skel.current) skel.current.hidden = false;
    if (doneRef.current) doneRef.current.hidden = true;
    w.style.height = `${Math.max(182, sl.offsetHeight + 14)}px`; // reserve the slip's room so it never covers the button
    // the slip feeds out of the passbook printer
    await anim(sl, [{ transform: 'translateY(-18px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.3,.8,.35,1)', fill: 'none' });
    const asked = min;
    const { result } = await proving({
      minMs: 3400,
      steps: ['Reading the passbook on this phone', 'Running attestSavings', `Checking it against the meeting ${e.meetingsRecorded} seal`],
      onStep: setStep,
      timer: timer.current,
      work: () => e.proveSavings(ama.slot, asked),
    });
    if (!result.ok) {
      // the circuit refused: the slip is withdrawn, nothing was published
      await anim(sl, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-12px) rotate(-1deg)', opacity: 0 }], { duration: 260, fill: 'forwards' });
      w.hidden = true;
      w.style.height = '0px';
      sl.getAnimations().forEach((a) => a.cancel());
      setStatus('edit');
      setErr(`Refused by the circuit: “${contractWords(result.error ?? '')}”. This passbook cannot prove ${asked}. Lower the number and try again.`);
      announce(`Proof refused. Ama's passbook cannot prove ${asked} shares.`);
      return;
    }
    setProved({ min: asked, nonce: result.nonce ?? '', meeting: e.meetingsRecorded });
    setStatus('stamping');
    if (skel.current) skel.current.hidden = true;
    const d = doneRef.current!;
    d.hidden = false;
    await anim(d, [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, easing: 'steps(9)', fill: 'none' });
    await stampDown(ok.current, sl);
    await wait(200);
    // torn off along the perforation: it lifts, swings, and settles crooked on the page
    const t = -2.4;
    await anim(
      sl,
      [
        { transform: 'rotate(0deg)' },
        { transform: `translate(3px,-4px) rotate(${t * 0.4}deg)`, offset: 0.25 },
        { transform: `translate(8px,10px) rotate(${t - 1.4}deg)`, offset: 0.7 },
        { transform: `translate(7px,9px) rotate(${t + 0.5}deg)`, offset: 0.86 },
        { transform: `translate(7px,9px) rotate(${t}deg)` },
      ],
      { duration: 760, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
    );
    w.style.height = `${Math.max(196, sl.offsetHeight + 18)}px`;
    const wl = withheld.current;
    if (wl) {
      wl.hidden = false;
      anim(wl, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
    }
    setStatus('done');
    announce(`Proof slip ready. It says Ama holds at least ${asked} shares, nothing more.`);
  };

  return (
    <Leaf band={[<><b>Ama</b>’s phone</>, 'Loan officer’s request']} dog sheetRef={sheet}>
      <h2 className="disp" tabIndex={-1} style={{ fontSize: 38, lineHeight: 1.04, maxWidth: 270 }}>
        Prove savings, keep the amount
      </h2>
      <div className="req">
        <p style={{ fontSize: 14.5, maxWidth: 250 }}>
          The loan officer asks for proof that Ama holds <span ref={atleast}>at least</span>
        </p>
        <div className="step">
          <button type="button" aria-label="Fewer shares" onClick={() => change(min - 1)} disabled={status !== 'edit'}>
            −
          </button>
          <output className="num" aria-live="polite" data-testid="min">
            {min}
          </output>
          <button type="button" aria-label="More shares" onClick={() => change(min + 1)} disabled={status !== 'edit'}>
            +
          </button>
          <span>shares</span>
        </div>
      </div>
      <p className="err" role="alert" data-testid="err-prove">
        {err}
      </p>
      <div className="slipwrap" ref={wrap} hidden>
        <Loose
          ref={slip}
          className="slip"
          tilt={0}
          shown
          role="status"
          ariaLive="polite"
          edge={{ seed: 11, top: { kind: 'perf', amp: 2.2, n: 96 }, right: { amp: 1, n: 14 }, bottom: { kind: 'deckle', amp: 1.6, n: 40 }, left: { amp: 1, n: 14 } }}
        >
          <div ref={skel} data-testid="slip-proving">
            <div className="proving on" style={{ padding: 0, margin: 0, maxWidth: 'none' }}>
              <div className="row">
                <span style={{ color: '#3A4F5C' }}>{step}</span>
                <b className="num" ref={timer}>
                  0.0 s
                </b>
              </div>
            </div>
            <span className="skel" style={{ width: '38%', height: 9, marginTop: 14 }} />
            <span className="skel" style={{ width: '80%', height: 26 }} />
            <span className="skel" style={{ width: '66%' }} />
            <p className="note" style={{ marginTop: 10, maxWidth: 250 }}>
              {provingNote('attestSavings')} Nothing leaves the phone while it works.
            </p>
          </div>
          <div ref={doneRef} hidden data-testid="slip-done">
            <p className="label">Proof slip, Kpalsi Women’s Group</p>
            <h3>At least {proved?.min ?? min} shares</h3>
            <p className="note" style={{ marginTop: 6, maxWidth: 200 }}>
              Checked against the group’s meeting {proved?.meeting ?? e.meetingsRecorded} seal. Ref. {proved?.nonce}
            </p>
            <Stamp ref={ok} kind="verified" ink="violet" style={{ right: 44, top: 50 }} testId="verified" />
          </div>
        </Loose>
      </div>
      <ul className="withheld" ref={withheld} hidden aria-label="Not on the slip">
        <li>
          <span>
            Her total, {shares} shares, <Ghs n={shares * SHARE_VALUE_GHS} />
          </span>
          <span>stays with me</span>
        </li>
        <li>
          <span>Her loan history</span>
          <span>stays with me</span>
        </li>
        <li>
          <span>Her name</span>
          <span>never on chain</span>
        </li>
      </ul>
      <div style={{ height: 14 }} />
      <button className="btn" type="button" onClick={prove} disabled={status !== 'edit'}>
        {status === 'done' ? 'Slip ready for the loan officer' : status === 'edit' ? 'Make a proof slip' : 'Making the proof'}
      </button>
    </Leaf>
  );
}
