// Plays the real built app inside the stage on a 120 BPM timeline (one bar = 2 s) and captures
// every frame through the DevTools screencast. Writes frames/<layout>/NNNNN.jpg, a timing file
// and the sound-effect log taken from the app's own animations.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const [base, layout, outDir] = process.argv.slice(2);
const [W, H] = layout === 'tall' ? [1080, 1920] : [1920, 1080];
rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/stage/?layout=${layout}`);
const app = page.frameLocator('#app');
await app.getByRole('button', { name: 'Stamp and record meeting 12' }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => {
  window.__sfx = [];
  const W = document.getElementById('app').contentWindow;
  const orig = W.Element.prototype.animate;
  W.Element.prototype.animate = function (k, o) {
    const a = orig.call(this, k, o);
    const c = (this.getAttribute && this.getAttribute('class')) || '';
    const d = typeof o === 'number' ? o : o?.duration || 0, delay = (o && o.delay) || 0;
    let kind = null, at = Date.now() + delay;
    if (c.includes('coin-fly')) { kind = 'tink'; at += d * 0.9; }
    else if (c.includes('cb-shackle')) { kind = 'click'; at += d; }
    else if (c.startsWith('seal')) { kind = 'thump'; at += d * 0.5; }
    else if (c.includes('cb-vendor') && JSON.stringify(k).includes('260px')) { kind = 'drop'; at += d * 0.8; }
    else if (c === 'slip') kind = 'swish';
    if (kind) window.__sfx.push([kind, at / 1000]);
    return a;
  };
});
const S = (fn, ...a) => page.evaluate(([f, args]) => window.stage[f](...args), [fn, a]);
const tap = async (loc) => { await page.evaluate(() => window.__sfx.push(['tap', Date.now() / 1000])); await loc.click({ timeout: 8000 }); };

// first frame is the thumbnail: the hook is already on screen
await S('cap', 'Undying Ledger', 'The grant ends.', 'The book doesn’t.', 'A savings group’s record book on Midnight: no vendor needed, <b>no fees for members</b>, no one reading her balance.', 0);
await page.waitForTimeout(600);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const n = frames.length;
  frames.push(metadata.timestamp);
  writeFileSync(`${outDir}/${String(n).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
const T0 = Date.now();
const at = async (t) => { const d = T0 + t * 1000 - Date.now(); if (d > 0) await page.waitForTimeout(d); };
const beat = (sel, n) => `[data-testid=beat-${n}] ${sel}`;
const scrollBeat = (n, y) => page.evaluate(([n, y]) => document.getElementById('app').contentDocument.querySelector(`[data-testid=beat-${n}]`).scrollTo({ top: y, behavior: 'smooth' }), [n, y]);

// 01 RECORD  (4 s)
await at(4);  await S('cap', '01 · Record', 'Count shares', 'into the box.', 'Taps become coins. The <b>recordMeeting</b> circuit seals all five passbooks.', 1);
await at(4.3); await scrollBeat(0, 300);
await at(4.8); await S('zoom', beat('[data-testid=m12] .mrow:nth-child(3)', 0), 1.3);
await at(6); await tap(app.getByRole('group', { name: 'Abiba, shares bought' }).getByRole('button', { name: '2 shares' }));
await at(6.5); await S('callout', beat('[data-testid=m12] .mrow:nth-child(3) .coin:nth-child(2)', 0), 'Abiba buys a second share');
await at(7.6); await S('uncall'); await S('zoom', null);
await at(8.5); await tap(app.getByRole('button', { name: 'Stamp and record meeting 12' }));
await at(12.4); await S('callout', '[data-testid=seal12]', 'Meeting 12 sealed');
// 02 FEES
await at(13.6); await S('uncall'); await S('cap', '02 · Fees', 'Members pay', 'nothing.', 'A shared <b>group fee key</b> pays each fee, and the receipt says so.', 2);
await page.evaluate(() => { const d = document.getElementById('app').contentDocument; d.querySelector('[data-testid=beat-0] .receipt')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
await at(14.6); await S('zoom', beat('.receipt', 0), 1.35);
await at(15.8); await S('callout', beat('.receipt .r-ln:nth-of-type(3) b', 0), 'Paid by the group fee key');
await at(17); await S('uncall'); await S('zoom', null);
// 03 PRIVATE
await at(18); await S('cap', '03 · Private', 'Only her phone', 'opens her book.', 'Her key opens her page: <b>26 to 29 shares</b>, checked against the group seal.', 3);
await tap(app.getByRole('button', { name: 'Open Ama’s passbook' }));
await at(19); await S('zoom', beat('.hero-row', 1), 1.3);
await at(22.1); await S('callout', '[data-testid=ama-shares]', 'Only on her phone');
await at(23.2); await S('uncall'); await S('zoom', null);
// 04 SHARED PHONE: the dark scene
await at(24); await S('dark', true); await S('cap', '04 · Shared phone', 'Her husband', 'sees nothing.', 'A shared phone shows sealed rows. <b>Guessing the amount fails.</b>', 4);
await tap(app.getByRole('button', { name: 'See her husband’s phone' }));
await at(25.2); await S('zoom', beat('.boxstage', 2), 1.3);
await at(26.4); await tap(app.getByRole('button', { name: 'Try to open slot 0' }));
await at(27.8); await S('callout', '[data-testid=cannot]', 'The slot needs the group secret');
await at(29); await S('uncall'); await S('zoom', null);
// 05 SUNSET
await at(30); await S('dark', false); await S('cap', '05 · Sunset', 'Vendor gone?', 'Still running.', 'After the grace period, <b>any member erases the vendor key</b>.', 5);
await tap(app.getByRole('button', { name: 'The grant ends' }));
await at(31); await tap(app.getByRole('button', { name: 'End the grant' }));
await at(32); await tap(app.getByRole('button', { name: 'Skip the wait' }));
await at(33.2); await S('zoom', beat('.boxstage', 3), 1.25);
await at(34.2); await tap(app.getByRole('button', { name: 'Call sunset' }));
await at(37); await S('callout', '[data-testid=sunset-stamp]', 'Vendor key erased');
await at(38.2); await S('uncall'); await S('zoom', null);
// 06 PROOF
await at(39); await S('cap', '06 · Proof', 'Prove savings,', 'keep the amount.', 'Ama proves <b>at least 25 shares</b>. Her total never leaves the phone.', 6);
await tap(app.getByRole('button', { name: 'Step 6: Prove savings, keep the amount' }));
for (let i = 0; i < 5; i++) { await at(40 + i * 0.25); await tap(app.getByRole('button', { name: 'Fewer shares' })); }
await at(41.6); await tap(app.getByRole('button', { name: 'Make a proof slip' }));
await at(42.4); await S('zoom', beat('.slipstage', 5), 1.2);
await at(44.6); await S('callout', '[data-testid=slip-done] h3', 'The only thing the lender sees');
await at(45.8); await S('uncall'); await S('zoom', null);
// END on the product, one line, nothing claimed that is not true today
await at(46.5); await S('cap', 'Undying Ledger · Built on Midnight', 'Grants end.', 'Savings don’t.', 'This demo runs the contract’s <b>real compiled circuits</b> in your browser.', 0); await S('url', true);
await at(50);
await cdp.send('Page.stopScreencast');
const sfx = (await page.evaluate(() => window.__sfx)).map(([k, t]) => [k, +(t - frames[0]).toFixed(3)]).filter(([, t]) => t >= 0);
writeFileSync(`${outDir}/times.json`, JSON.stringify(frames.map((t) => t - frames[0])));
writeFileSync(`${outDir}/sfx.json`, JSON.stringify(sfx));
console.log(layout, 'frames', frames.length, 'span', (frames.at(-1) - frames[0]).toFixed(2), 'sfx', sfx.length, 'errors', errors);
await browser.close();
