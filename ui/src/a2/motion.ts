// SPDX-License-Identifier: Apache-2.0
// "A2 Passbook" motion kit: springs sampled to CSS linear(), a WAAPI wrapper that honours
// prefers-reduced-motion, rubber stamps, settling loose paper, a ballpoint pen and the
// passbook printer. Ported from the approved mock (work/ledger-mocks-v2/src/a2.html).
// Every motion here is tied to a real action in the app.

export const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FAST =
  typeof window !== 'undefined' &&
  (!!(window as unknown as { __FAST?: boolean }).__FAST || new URLSearchParams(location.search).has('fast'));

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, RM ? Math.min(ms, 60) : ms));

export function spring({ stiffness = 180, damping = 14, mass = 1 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const z = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = w0 * Math.sqrt(Math.max(0, 1 - z * z));
  const f = (t: number) =>
    z < 1 ? 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)) : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  let T = 0.1;
  for (let t = 0; t < 4; t += 0.01) if (Math.abs(1 - f(t)) > 0.002) T = t + 0.02;
  const n = 48;
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) pts.push(+f((T * i) / n).toFixed(4));
  pts[n] = 1;
  return { easing: `linear(${pts.join(',')})`, duration: Math.round(T * 1000) };
}

export const SPRING = {
  detent: spring({ stiffness: 420, damping: 20 }),
  paper: spring({ stiffness: 150, damping: 11 }),
};
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_FALL = 'cubic-bezier(0.55, 0, 1, 0.45)'; // gravity: only for things actually falling
export const EASE_HAND = 'cubic-bezier(.45,.05,.3,1)';

type Opts = { s?: keyof typeof SPRING; duration?: number; delay?: number; easing?: string; fill?: FillMode };

export function anim(el: Element | null | undefined, frames: Keyframe[], { s, duration, delay = 0, easing, fill = 'both' }: Opts = {}): Promise<void> {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  if (RM) {
    const last = { ...frames[frames.length - 1] };
    delete last.offset;
    return (el as HTMLElement).animate([last, last], { duration: 1, fill }).finished.then(() => undefined, () => undefined);
  }
  const sp = s ? SPRING[s] : null;
  const a = (el as HTMLElement).animate(frames, {
    duration: duration ?? sp?.duration ?? 240,
    easing: easing ?? sp?.easing ?? EASE_OUT,
    delay,
    fill,
  });
  return a.finished.then(() => undefined, () => undefined);
}

export function countTo(el: HTMLElement | null, from: number, to: number, ms = 600, fmt: (v: number) => string = String): Promise<void> {
  if (!el) return Promise.resolve();
  if (RM || from === to) {
    el.textContent = fmt(to);
    return Promise.resolve();
  }
  // Hold the box at the final value's width while counting, so text beside it (GH₵) stays put even in a
  // face without tabular digits. Needs an inline-block element; released when the count lands.
  const held = el.style.minWidth;
  el.textContent = fmt(to);
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  el.textContent = fmt(from);
  return new Promise((res) => {
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(tick);
      else {
        el.style.minWidth = held;
        res();
      }
    };
    requestAnimationFrame(tick);
  });
}

// ------------------------------------------------------------------ seeded hand-made randomness

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ paper edges

type Edge = { kind?: 'deckle' | 'torn' | 'perf'; amp?: number; n?: number; spine?: number; _w?: number };
export type EdgeSpec = { seed?: number; top?: Edge; right?: Edge; bottom?: Edge; left?: Edge; fold?: number; inset?: number };

/** A polygon in % with px offsets, so a deckled or torn edge holds at any size and is the same on every load. */
export function edgePoly({ seed = 1, top = {}, right = {}, bottom = {}, left = {}, fold = 0, inset = 0 }: EdgeSpec): string {
  const r = rng(seed);
  const P: string[] = [];
  const off = (e: Edge, i: number) => {
    const a = e.amp || 0;
    if (e.kind === 'perf') return i % 2 ? a : 0;
    if (e.kind === 'torn') {
      e._w = (e._w ?? a / 2) + (r() - 0.5) * a * 0.9;
      e._w = Math.max(0, Math.min(a, e._w));
      return e._w + (r() < 0.12 ? r() * a * 0.6 : 0);
    }
    return r() * a;
  };
  const pt = (x: number, dx: number, y: number, dy: number) =>
    `calc(${x.toFixed(2)}% + ${dx.toFixed(2)}px) calc(${y.toFixed(2)}% + ${dy.toFixed(2)}px)`;
  const T = { ...top }, Rt = { ...right }, B = { ...bottom }, L = { ...left };
  const nT = T.n || 30, nR = Rt.n || 60, nB = B.n || 30, nL = L.n || 2;
  for (let i = 0; i <= nT; i++) {
    const x = (i / nT) * 100;
    const curve = T.spine ? T.spine * Math.pow(1 - i / nT, 3) : 0;
    P.push(pt(x, (i === 0 ? inset : 0) - (fold && i === nT ? fold : 0), 0, off(T, i) + curve + inset));
  }
  for (let i = 0; i <= nR; i++) {
    const y = (i / nR) * 100;
    P.push(pt(100, -off(Rt, i) - inset, y, (fold && i === 0 ? fold : 0) + (i === 0 ? inset : 0) - (i === nR ? inset : 0)));
  }
  for (let i = 0; i <= nB; i++) P.push(pt(100 - (i / nB) * 100, 0, 100, -off(B, i) - inset));
  for (let i = 0; i <= nL; i++) P.push(pt(0, off(L, i) + inset, 100 - (i / nL) * 100, 0));
  return `polygon(${P.join(',')})`;
}

// ------------------------------------------------------------------ the ballpoint

const NS = 'http://www.w3.org/2000/svg';
const PEN = rng(77);

function smooth(pts: number[][]): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
export const tickPath = (x: number, y: number, s = 1) => {
  const j = () => (PEN() - 0.5) * 1.6;
  return smooth([[x + j(), y + 6 * s + j()], [x + 4 * s, y + 10 * s + j()], [x + 6.5 * s, y + 13 * s], [x + 10 * s + j(), y + 5 * s], [x + 17 * s + j(), y - 3 * s + j()]]);
};
export const circlePath = (cx: number, cy: number, rx: number, ry: number) => {
  const pts: number[][] = [];
  const a0 = -2.2 + PEN() * 0.4;
  for (let i = 0; i <= 15; i++) {
    const a = a0 + (i / 13) * Math.PI * 2;
    const w = 1 + (PEN() - 0.5) * 0.09 + (i > 12 ? 0.06 : 0);
    pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
  }
  return smooth(pts);
};
export const linePath = (x1: number, y: number, x2: number, wob = 1.2) => {
  const n = Math.max(3, Math.round((x2 - x1) / 30));
  const pts: number[][] = [];
  for (let i = 0; i <= n; i++) pts.push([x1 + ((x2 - x1) * i) / n + (PEN() - 0.5) * 2, y + (PEN() - 0.5) * wob * 2 + (i / n) * -1.2]);
  return smooth(pts);
};
export const penJitter = () => PEN();

export function rel(el: Element, sheet: Element) {
  const a = el.getBoundingClientRect(), b = sheet.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
}

/** Draw one pen stroke on the sheet's pen layer (an SVG React leaves alone). */
export async function draw(sheet: Element, d: string, { ms = 320, delay = 0, w = 1.7 } = {}): Promise<void> {
  const layer = sheet.querySelector('.penlayer');
  if (!layer) return;
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  p.style.strokeWidth = String(w);
  layer.appendChild(p);
  const L = p.getTotalLength();
  p.style.strokeDasharray = String(L);
  p.style.strokeDashoffset = String(L);
  await anim(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: ms, delay, easing: EASE_HAND, fill: 'forwards' });
}

export function clearPen(sheet: Element | null) {
  sheet?.querySelector('.penlayer')?.replaceChildren();
}

// ------------------------------------------------------------------ stamps and loose paper

/** A rubber stamp: drops on a gravity curve, bites the page, rocks on the rubber, rests. */
export async function stampDown(el: HTMLElement | null, page?: Element | null): Promise<void> {
  if (!el) return;
  const r = parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0;
  el.style.opacity = '1';
  el.dataset.down = '1';
  const rot = (d: number) => `rotate(${(r + d).toFixed(2)}deg)`;
  await anim(el, [{ transform: `translateY(-34px) scale(1.16) ${rot(-2.5)}`, opacity: 0 }, { transform: `translateY(0) scale(.975) ${rot(0.6)}`, opacity: 1 }], {
    duration: 200,
    easing: EASE_FALL,
  });
  if (page && !RM)
    (page as HTMLElement).animate(
      [{ transform: 'none' }, { transform: 'translateY(1.6px) rotate(.08deg)' }, { transform: 'translateY(-.4px)' }, { transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(.3,.7,.4,1)' },
    );
  await anim(
    el,
    [
      { transform: `scale(.975) ${rot(0.6)}`, opacity: 1 },
      { transform: `scale(.99) ${rot(-1.4)}`, opacity: 0.97, offset: 0.3 },
      { transform: `scale(1) ${rot(0.7)}`, opacity: 0.94, offset: 0.58 },
      { transform: `scale(1) ${rot(-0.25)}`, opacity: 0.92, offset: 0.8 },
      { transform: `scale(1) ${rot(0)}`, opacity: 0.9 },
    ],
    { duration: 460, easing: 'cubic-bezier(.33,.9,.4,1)' },
  );
}

/** Loose paper slides in rotated a little extra, lands, then sways on a loose spring. */
export async function settle(el: HTMLElement | null, from: 'right' | 'down' | 'left' = 'right'): Promise<void> {
  if (!el) return;
  const t = +(el.dataset.tilt ?? 0);
  el.hidden = false;
  const dx = from === 'right' ? 70 : from === 'down' ? 0 : -70;
  const dy = from === 'down' ? 40 : -10;
  el.style.transform = `rotate(${t}deg)`;
  await anim(
    el,
    [
      { transform: `translate(${dx}px,${dy}px) rotate(${t + 9}deg)`, opacity: 0 },
      { transform: `translate(0,0) rotate(${t}deg)`, opacity: 1, offset: 0.55 },
      { transform: `rotate(${t}deg)`, opacity: 1 },
    ],
    { duration: 300 },
  );
  await anim(el, [{ transform: `rotate(${t}deg)` }, { transform: `rotate(${t - 1.6}deg) translateY(1px)` }, { transform: `rotate(${t}deg)` }], {
    duration: SPRING.paper.duration,
    easing: SPRING.paper.easing,
  });
}

/** The passbook printer: reveals each line cell by cell. */
export function printLine(els: (HTMLElement | null)[], ms = 650): Promise<unknown> {
  return Promise.all(
    els.map((el, i) => {
      if (!el) return Promise.resolve();
      const n = Math.max(2, (el.textContent ?? '').length);
      el.style.visibility = 'visible';
      return anim(el, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
        duration: Math.min(ms, 90 + n * 34),
        delay: i * 140,
        easing: `steps(${Math.min(n, 28)})`,
      });
    }),
  );
}

export function reveal(el: HTMLElement | null) {
  if (!el) return;
  el.hidden = false;
  anim(el, [{ opacity: 0, transform: 'translateY(6px) rotate(.6deg)' }, { opacity: 1, transform: 'none' }], {
    duration: 320,
    easing: 'cubic-bezier(.3,.9,.35,1)',
  });
}

/** Page turn: the leaf hangs a beat on the spine, swings, and the new leaf lands with a small settle. */
export async function pageTurn(prev: HTMLElement, next: HTMLElement, dir: number): Promise<void> {
  if (RM) return;
  const top = dir > 0 ? prev : next;
  const under = dir > 0 ? next : prev;
  top.style.zIndex = '2';
  under.style.zIndex = '1';
  const frames = [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-12deg)', offset: 0.22 }, { transform: 'rotateY(-104deg)' }];
  await anim(top, dir > 0 ? frames : frames.slice().reverse(), { duration: 620, easing: 'cubic-bezier(.5,.02,.3,1)', fill: 'none' });
  top.style.zIndex = '';
  under.style.zIndex = '';
  anim(next.querySelector('.leaf'), [{ transform: 'rotate(.6deg) translateY(2px)' }, { transform: 'rotate(-.25deg)' }, { transform: 'none' }], {
    duration: 520,
    easing: 'cubic-bezier(.3,.9,.35,1)',
  });
}
