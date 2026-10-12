// SPDX-License-Identifier: Apache-2.0
// Beat 6: Ama proves "at least N shares" to a loan officer. "Make a proof slip" runs the real
// attestSavings circuit with her key and her passbook as private inputs. A note rises out of the
// box's slot while it works; if she asks for more than she holds, the circuit refuses and the
// note drops back in. Only the one sentence leaves the box.
import { useRef, useState } from 'react';
import { SHARE_VALUE_GHS } from '../demo/engine';
import { Ghs } from '../a2/paper';
import { CashBox, Screen, Seal } from '../box/art';
import { anim, bounce, pop, shake, wait } from '../box/motion';
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
  const box = useRef<SVGSVGElement>(null);
  const slip = useRef<HTMLDivElement>(null);
  const ok = useRef<HTMLDivElement>(null);
  const withheld = useRef<HTMLUListElement>(null);
  const out = useRef<HTMLOutputElement>(null);
  const timer = useRef<HTMLElement>(null);

  const change = (v: number) => {
    setMin(Math.max(1, Math.min(60, v)));
    setErr('');
    bounce(out.current);
  };

  const prove = async () => {
    if (status !== 'edit') return;
    setErr('');
    setProved(null);
    setStatus('proving');
    const sl = slip.current!;
    sl.hidden = false;
    // the note feeds up out of the slot in the lid
    await anim(sl, [{ transform: 'translateY(70%)', clipPath: 'inset(0 0 100% 0)' }, { transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'none' });
    const asked = min;
    const { result } = await proving({
      minMs: 3400,
      steps: ['Reading the passbook on this phone', 'Running attestSavings', `Checking it against the meeting ${e.meetingsRecorded} seal`],
      onStep: setStep,
      timer: timer.current,
      work: () => e.proveSavings(ama.slot, asked),
    });
    if (!result.ok) {
      // the circuit refused: the note goes back into the box, nothing was published
      await anim(sl, [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(70%)', clipPath: 'inset(0 0 100% 0)' }], { duration: 360, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' });
      sl.hidden = true;
      sl.getAnimations().forEach((a) => a.cancel());
      await shake(box.current, 6);
      setStatus('edit');
      setErr(`Refused by the circuit: “${contractWords(result.error ?? '')}”. This passbook cannot prove ${asked}. Lower the number and try again.`);
      announce(`Proof refused. Ama's passbook cannot prove ${asked} shares.`);
      return;
    }
    setProved({ min: asked, nonce: result.nonce ?? '', meeting: e.meetingsRecorded });
    setStatus('stamping');
    await wait(60);
    await pop(ok.current, -10);
    const items = [...(withheld.current?.querySelectorAll('li') ?? [])];
    if (withheld.current) withheld.current.hidden = false;
    await Promise.all(items.map((li, i) => anim(li, [{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: i * 110 })));
    setStatus('done');
    announce(`Proof slip ready. It says Ama holds at least ${asked} shares, nothing more.`);
  };

  return (
    <Screen who={<><b>Ama</b>’s phone</>} where="Loan officer’s request">
      <h2 className="h1" tabIndex={-1}>
        Prove savings, keep the amount
      </h2>
      <p className="hero-sub">The loan officer asks for proof that Ama holds at least</p>
      <div className="stepper">
        <button type="button" className="round lg" aria-label="Fewer shares" onClick={() => change(min - 1)} disabled={status !== 'edit'}>
          −
        </button>
        <output className="hero num" aria-live="polite" data-testid="min" ref={out}>
          {min}
        </output>
        <button type="button" className="round lg" aria-label="More shares" onClick={() => change(min + 1)} disabled={status !== 'edit'}>
          +
        </button>
        <span className="unit-word">shares</span>
      </div>
      <p className="err" role="alert" data-testid="err-prove">
        {err}
      </p>
      <div className="slipstage">
        <div className="slip" ref={slip} hidden role="status" aria-live="polite">
          {!proved ? (
            <div data-testid="slip-proving">
              <div className="proving on">
                <div className="row">
                  <span>{step}</span>
                  <b className="num" ref={timer}>
                    0.0 s
                  </b>
                </div>
              </div>
              <span className="skel" style={{ width: '40%', height: 10 }} />
              <span className="skel" style={{ width: '82%', height: 26 }} />
              <span className="skel" style={{ width: '64%' }} />
              <p className="note">{provingNote('attestSavings')} Nothing leaves the phone while it works.</p>
            </div>
          ) : (
            <div data-testid="slip-done">
              <p className="label">Kpalsi Women’s Group certifies</p>
              <h3>At least {proved.min} shares</h3>
              <p className="note">
                Checked against the group’s meeting {proved.meeting} seal. Ref. {proved.nonce}
              </p>
            </div>
          )}
          <Seal ref={ok} top="PROOF ONLY" mid="Verified" tone="red" style={{ right: 8, top: 34, visibility: 'hidden' }} testId="verified" />
        </div>
        <CashBox ref={box} title="The cash box, shut. Only the note comes out." label="ONLY THE NOTE COMES OUT" />
      </div>
      <section className="sheet" aria-label="What stays in the box">
        <ul className="withheld" ref={withheld} hidden aria-label="Not on the slip">
          <li>
            <span>
              Her total, {shares} shares, <Ghs n={shares * SHARE_VALUE_GHS} />
            </span>
            <b>stays with me</b>
          </li>
          <li>
            <span>Her loan history</span>
            <b>stays with me</b>
          </li>
          <li>
            <span>Her name</span>
            <b>never on chain</b>
          </li>
        </ul>
        <div className="cta">
          <button className="btn" type="button" onClick={prove} disabled={status !== 'edit'}>
            {status === 'done' ? 'Slip ready for the loan officer' : status === 'edit' ? 'Make a proof slip' : 'Making the proof'}
          </button>
        </div>
      </section>
    </Screen>
  );
}
