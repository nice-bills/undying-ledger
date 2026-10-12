// SPDX-License-Identifier: Apache-2.0
// Motion for the cash box. Every animation follows a real action: a coin tapped, a circuit that
// accepted or refused, a heartbeat that did or did not arrive, a screen the person moved to.
// prefers-reduced-motion jumps every animation to its end state (see anim() in ../a2/motion).
import { anim, EASE_FALL, EASE_OUT, RM, SPRING, wait } from '../a2/motion';

export { anim, countTo, FAST, RM, wait } from '../a2/motion';

const springy = 'linear(0,0.24,0.62,0.93,1.1,1.16,1.13,1.06,1,0.97,0.97,0.99,1)';

/** A seal or stamp lands: it drops from slightly above, overshoots, settles with a small tilt. */
export async function pop(el: HTMLElement | null, tilt = -6): Promise<void> {
  if (!el) return;
  el.style.visibility = 'visible';
  await anim(
    el,
    [
      { opacity: 0, transform: `scale(1.7) rotate(${tilt - 8}deg)` },
      { opacity: 1, transform: `scale(.92) rotate(${tilt + 1}deg)`, offset: 0.55 },
      { opacity: 1, transform: `scale(1) rotate(${tilt}deg)` },
    ],
    { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)' },
  );
  el.dataset.down = '1';
}

/** No: a short side-to-side refusal. */
export const shake = (el: Element | null, px = 7) =>
  anim(el, [{ transform: 'translateX(0)' }, { transform: `translateX(-${px}px)` }, { transform: `translateX(${px * 0.8}px)` }, { transform: `translateX(-${px * 0.4}px)` }, { transform: 'translateX(0)' }], {
    duration: 340,
    easing: 'linear',
  });

/** A tapped coin bounces in. */
export const bounce = (el: Element | null) => anim(el, [{ transform: 'scale(.6)' }, { transform: 'scale(1)' }], { s: 'detent' });

const q = (svg: SVGSVGElement | null, sel: string) => svg?.querySelector<SVGGElement>(sel) ?? null;

/** The lid swings on its back hinge. */
export function lid(svg: SVGSVGElement | null, to: 'up' | 'shut'): Promise<void> {
  const g = q(svg, '.cb-lid');
  const up = 'rotate(-13deg)';
  const target = to === 'up' ? up : 'rotate(0deg)';
  if (!g) return Promise.resolve();
  const from = getComputedStyle(g).transform;
  g.style.transform = target;
  return anim(g, [{ transform: from === 'none' ? 'rotate(0deg)' : from }, { transform: target }], {
    duration: to === 'shut' ? 360 : 300,
    easing: to === 'shut' ? 'cubic-bezier(.5,0,.75,0)' : EASE_OUT,
    fill: 'none',
  }).then(() => {
    if (to === 'shut') return anim(svg, [{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }], { duration: 160 });
  });
}

/** One padlock clicks shut or springs open. */
export function lock(svg: SVGSVGElement | null, i: number, to: 'shut' | 'open'): Promise<void> {
  const s = q(svg, `.lock-${i} .cb-shackle`);
  const body = q(svg, `.lock-${i}`);
  if (!s) return Promise.resolve();
  const open = 'translateY(-9px) rotate(-12deg)';
  s.style.transform = to === 'open' ? open : '';
  const a = anim(s, [{ transform: to === 'open' ? 'none' : open }, { transform: to === 'open' ? open : 'none' }], {
    duration: to === 'open' ? 520 : 200,
    easing: to === 'open' ? springy : 'cubic-bezier(.6,0,.9,.4)',
    fill: 'none',
  });
  if (to === 'shut') a.then(() => anim(body, [{ transform: 'translateY(0)' }, { transform: 'translateY(1.5px)' }, { transform: 'translateY(0)' }], { duration: 120 }));
  return a;
}

/** The vendor's padlock is unhooked and falls out of the frame. */
export async function vendorFalls(svg: SVGSVGElement | null): Promise<void> {
  const v = q(svg, '.cb-vendor');
  if (!v) return;
  await anim(v, [{ transform: 'rotate(0deg)', opacity: 1 }, { transform: 'rotate(-14deg)', opacity: 1, offset: 0.35 }, { transform: 'rotate(8deg)', opacity: 1 }], { duration: 420, easing: EASE_OUT });
  await anim(v, [{ transform: 'translate(0,0) rotate(8deg)', opacity: 1 }, { transform: 'translate(12px,260px) rotate(64deg)', opacity: 0 }], { duration: 620, easing: EASE_FALL });
  v.style.opacity = '0';
}

/** Coins leave their rows and drop through the slot in the lid, one row after another. */
export async function coinsInto(coins: HTMLElement[], svg: SVGSVGElement | null, host: HTMLElement | null): Promise<void> {
  const slot = q(svg, '.cb-slot');
  if (!slot || !host || RM) return;
  const hb = host.getBoundingClientRect();
  const sb = slot.getBoundingClientRect();
  const tx = sb.left + sb.width / 2 - hb.left;
  const ty = sb.top + sb.height / 2 - hb.top;
  const flights = coins.map((c, i) => {
    const r = c.getBoundingClientRect();
    const g = document.createElement('i');
    g.className = 'coin-fly';
    g.style.left = `${r.left - hb.left}px`;
    g.style.top = `${r.top - hb.top + host.scrollTop}px`;
    g.style.width = `${r.width}px`;
    g.style.height = `${r.height}px`;
    host.appendChild(g);
    const dx = tx - (r.left - hb.left) - r.width / 2;
    const dy = ty + host.scrollTop - (r.top - hb.top + host.scrollTop) - r.height / 2;
    const lift = Math.min(-60, dy * 0.25 - 60);
    return wait(i * 45).then(() =>
      anim(
        g,
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.55}px,${dy * 0.5 + lift}px) scale(.9)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: 1, offset: 0.92 },
          { transform: `translate(${dx}px,${dy + 10}px) scale(.4)`, opacity: 0 },
        ],
        { duration: 620, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' },
      ).then(() => g.remove()),
    );
  });
  await Promise.all(flights);
}

/** A sheet or slip slides up from below and settles with a little spring. */
export function rise(el: HTMLElement | null, from = 120): Promise<void> {
  if (!el) return Promise.resolve();
  el.hidden = false;
  el.style.opacity = '';
  return anim(el, [{ transform: `translateY(${from}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { s: 'paper', fill: 'none' });
}

/** The next screen pushes in from the side the person is heading; the old one slides back and dims. */
export async function push(prev: HTMLElement, next: HTMLElement, dir: number): Promise<void> {
  const w = prev.offsetWidth || 390;
  await Promise.all([
    anim(prev, [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-dir * w * 0.3}px)`, opacity: 0.4 }], { duration: SPRING.paper.duration * 0.6, easing: EASE_OUT, fill: 'none' }),
    anim(next, [{ transform: `translateX(${dir * w}px)` }, { transform: 'translateX(0)' }], { duration: 460, easing: 'cubic-bezier(.2,.85,.25,1)', fill: 'none' }),
  ]);
}
