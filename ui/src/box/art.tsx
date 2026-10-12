// SPDX-License-Identifier: Apache-2.0
// The cash-box design: every VSLA keeps its money in a tin box with three padlocks, each key
// held by a different member. In this app the box is the book. Flat shapes, two inks per
// world, no gradients or shadows. Animations live in ./motion.ts and are driven by real actions.
import { forwardRef, useLayoutEffect, type CSSProperties, type ReactNode } from 'react';

export type LockState = 'shut' | 'open';

type BoxProps = {
  locks?: [LockState, LockState, LockState];
  /** The vendor's padlock on the hasp: on while the vendor key administers the book, gone after sunset. */
  vendor?: 'on' | 'gone' | 'none';
  /** Lid starts lifted (coins can go in) or shut. */
  lid?: 'up' | 'shut';
  label?: string;
  className?: string;
  style?: CSSProperties;
  title: string;
};

const LOCK_X = [64, 145, 226];

function Padlock({ x, state, i }: { x: number; state: LockState; i: number }) {
  return (
    <g transform={`translate(${x},100)`}>
      {/* the outer group places the lock; the inner one is free for animation transforms */}
      <g className={`cb-lock lock-${i}`}>
        <path className="cb-shackle" d="M8 2v-12a12 12 0 0 1 24 0V2" style={{ transform: state === 'open' ? 'translateY(-9px) rotate(-12deg)' : undefined }} />
        <rect className="cb-lockbody" width="40" height="44" rx="5" />
        <circle className="cb-keyhole" cx="20" cy="19" r="5" />
        <rect className="cb-keyhole" x="18" y="21" width="4" height="10" />
      </g>
    </g>
  );
}

export const CashBox = forwardRef<SVGSVGElement, BoxProps>(function CashBox(
  { locks = ['shut', 'shut', 'shut'], vendor = 'none', lid = 'shut', label, className = '', style, title },
  ref,
) {
  return (
    <svg ref={ref} className={`cashbox ${className}`} viewBox="0 0 330 206" role="img" aria-label={title} style={style}>
      <rect className="cb-handle" x="120" y="16" width="90" height="20" rx="5" />
      <rect className="cb-body" x="22" y="58" width="286" height="136" rx="7" />
      <rect className="cb-band" x="22" y="72" width="286" height="9" />
      {LOCK_X.map((x, i) => (
        <Padlock key={i} x={x} state={locks[i]} i={i} />
      ))}
      {label && (
        <text className="cb-label" x="165" y="178" textAnchor="middle">
          {label}
        </text>
      )}
      {vendor !== 'none' && (
        <g className="cb-vendor" style={{ opacity: vendor === 'gone' ? 0 : 1 }}>
          <rect className="cb-hasp" x="300" y="98" width="16" height="30" rx="3" />
          <g transform="translate(296,132)">
            <path className="cb-vshackle" d="M6 2v-9a10 10 0 0 1 20 0v9" />
            <rect className="cb-vbody" width="32" height="34" rx="4" />
            <text className="cb-vtext" x="16" y="22" textAnchor="middle">
              V
            </text>
          </g>
        </g>
      )}
      <g className="cb-lid" style={{ transform: lid === 'up' ? 'rotate(-13deg)' : undefined }}>
        <rect className="cb-lidtop" x="14" y="38" width="302" height="34" rx="7" />
        <rect className="cb-slot" x="138" y="48" width="54" height="8" rx="4" />
      </g>
    </svg>
  );
});

/** A brass key tag with the member's slot number: which lock, which passbook page. */
export function KeyTag({ n }: { n: number }) {
  return (
    <svg className="keytag" width="30" height="36" viewBox="0 0 34 40" aria-hidden="true">
      <path d="M4 8 L17 2 L30 8 V36 H4 Z" />
      <circle cx="17" cy="10" r="3.2" />
      <text x="17" y="31" textAnchor="middle">
        {n}
      </text>
    </svg>
  );
}

/** A round seal that pops onto the box or a slip when the contract agrees. Hidden until pop(). */
export const Seal = forwardRef<HTMLDivElement, { top: string; mid: string; sub?: string; tone?: 'ink' | 'red' | 'cream'; style?: CSSProperties; testId?: string }>(
  function Seal({ top, mid, sub, tone = 'ink', style, testId }, ref) {
    return (
      <div ref={ref} className={`seal t-${tone}${mid.length > 6 ? ' long' : ''}`} style={style} data-testid={testId} aria-hidden="true">
        <span className="s-top">{top}</span>
        <span className="s-mid">{mid}</span>
        {sub && <span className="s-sub">{sub}</span>}
      </div>
    );
  },
);

/** One screen of the story: a header line, an optional hero area on the world colour, then content. */
export function Screen({ who, where, action, children }: { who: ReactNode; where: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="who">{who}</div>
          <div className="where">{where}</div>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

/** The lock button in the corner: hides the screen at once on a shared phone. */
export function LockNow({ onLock }: { onLock: () => void }) {
  return (
    <button type="button" className="round" aria-label="Lock now: hide this screen" onClick={onLock}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="9" width="14" height="10" rx="2" fill="currentColor" />
        <path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    </button>
  );
}

/** A number the page counts up or down imperatively (countTo); React only sets the resting value. */
export function Figure({ value, innerRef, testId, className = 'num' }: { value: number; innerRef: React.RefObject<HTMLSpanElement | null>; testId?: string; className?: string }) {
  useLayoutEffect(() => {
    if (innerRef.current && !innerRef.current.dataset.counting) innerRef.current.textContent = String(value);
  }, [value, innerRef]);
  return <span ref={innerRef} data-testid={testId} className={className} />;
}
