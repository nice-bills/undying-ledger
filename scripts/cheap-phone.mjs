// SPDX-License-Identifier: Apache-2.0
// How the six-beat demo runs on a cheap Android phone, emulated in Chromium: a 360x780 screen,
// the CPU slowed 6x (Chrome DevTools' "low-end mobile" preset is 6x) and a slow mobile network.
// Reports the landing's load time (it loads no circuits), then the demo's load time, how long
// each real circuit run takes from tap to result, and the longest
// main-thread freeze (long tasks), for an unthrottled run and the cheap-phone profile.
//
//   npm run build && npx vite preview --outDir docs --port 4179 -c ui/vite.config.ts &
//   node scripts/cheap-phone.mjs http://localhost:4179/ > cheap-phone.json
//
// Uses Playwright's Chromium (PLAYWRIGHT_BROWSERS_PATH, or PW_CHROMIUM for an executable path).
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');

const url = process.argv[2] ?? 'http://localhost:4179/';
const PROFILES = {
  unthrottled: { cpu: 1, net: null },
  // 6x CPU: DevTools "low-end mobile". Network: 1.6 Mbps down, 750 kbps up, 150 ms RTT ("slow 4G").
  cheapPhone: { cpu: 6, net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } },
  // a 3G connection on the same phone: 400 kbps down, 400 ms RTT
  cheapPhone3g: { cpu: 6, net: { latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 } },
};
const T = { timeout: 180_000 };

async function run(name, prof) {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (prof.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...prof.net });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  const wasm = [];
  cdp.on('Network.requestWillBeSent', (e) => e.request.url.endsWith('.wasm') && wasm.push(e.request.url));
  await p.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
  });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));

  const beat = (i) => p.getByTestId(`beat-${i}`);
  const longest = () => p.evaluate(() => Math.max(0, ...window.__long));
  const resetLong = () => p.evaluate(() => (window.__long = []));
  const out = { profile: name, cpuSlowdown: prof.cpu, network: prof.net ? `${Math.round((prof.net.downloadThroughput * 8) / 1024)} kbps down, ${prof.net.latency} ms RTT` : 'none', steps: {} };

  // the front door first: how soon a judge on this phone sees the page and its one button
  let t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit' });
  await p.getByRole('link', { name: 'Open the demo' }).waitFor({ state: 'visible', ...T });
  out.landing = {
    readySeconds: (Date.now() - t0) / 1000,
    firstPaintSeconds: Math.round(await p.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN)) / 1000,
    wasmLoaded: false,
  };
  await p.waitForLoadState('networkidle', T).catch(() => undefined);
  out.landing.transferredKB = Math.round(bytes / 1024);
  out.landing.wasmLoaded = wasm.length > 0;
  out.landing.longestFreezeMs = Math.round(await longest());
  bytes = 0;
  // a visitor reads the landing for a few seconds (the page fetches the demo meanwhile), then taps
  await p.waitForTimeout(Number(process.env.READ_MS ?? 8000));
  t0 = Date.now();
  await p.getByRole('link', { name: 'Open the demo' }).click();
  await beat(0).getByRole('button', { name: 'Stamp and record meeting 12' }).waitFor({ state: 'visible', ...T });
  out.firstScreenSeconds = (Date.now() - t0) / 1000; // tap on Open the demo to meeting 12 ready
  await p.waitForLoadState('networkidle', T).catch(() => undefined);
  out.loadedSeconds = (Date.now() - t0) / 1000;
  out.loadLongestFreezeMs = Math.round(await longest());
  // first contentful paint: when the phone first shows something (the static skeleton in index.html)
  out.firstPaintSeconds = Math.round(await p.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN)) / 1000;

  const step = async (label, tap, done) => {
    await resetLong();
    const s = Date.now();
    await tap();
    await done();
    out.steps[label] = { tapToResultSeconds: (Date.now() - s) / 1000, longestFreezeMs: Math.round(await longest()) };
  };
  await step('recordMeeting (meeting 12)', () => beat(0).getByRole('button', { name: 'Stamp and record meeting 12' }).click(), () => beat(0).getByRole('button', { name: 'Open Ama’s passbook' }).waitFor(T));
  await beat(0).getByRole('button', { name: 'Open Ama’s passbook' }).click();
  await beat(1).getByRole('button', { name: 'See her husband’s phone' }).waitFor(T);
  await beat(1).getByRole('button', { name: 'See her husband’s phone' }).click();
  await step('refused open (husband)', () => beat(2).getByRole('button', { name: 'Try to open slot 0' }).click(), () => beat(2).getByTestId('err-open').filter({ hasText: 'group secret' }).waitFor(T));
  await beat(2).getByRole('button', { name: 'The grant ends' }).click();
  await beat(3).getByRole('button', { name: 'End the grant' }).click();
  await beat(3).getByRole('button', { name: 'Skip the wait' }).waitFor(T);
  await beat(3).getByRole('button', { name: 'Skip the wait' }).click();
  await step('sunset', () => beat(3).getByRole('button', { name: 'Call sunset' }).click(), () => beat(3).getByRole('button', { name: 'Hold meeting 13' }).waitFor(T));
  await beat(3).getByRole('button', { name: 'Hold meeting 13' }).click();
  await step('recordMeeting (meeting 13)', () => beat(4).getByRole('button', { name: 'Stamp and record meeting 13' }).click(), () => beat(4).getByRole('button', { name: 'Ama applies for a loan' }).waitFor(T));
  await beat(4).getByRole('button', { name: 'Ama applies for a loan' }).click();
  await step('attestSavings (proof slip)', () => beat(5).getByRole('button', { name: 'Make a proof slip' }).click(), () => beat(5).getByRole('button', { name: 'Slip ready for the loan officer' }).waitFor(T));

  out.transferredKB = Math.round(bytes / 1024);
  out.pageErrors = errors;
  await browser.close();
  return out;
}

const results = [];
for (const [name, prof] of Object.entries(PROFILES)) results.push(await run(name, prof));
console.log(JSON.stringify({ url, at: new Date().toISOString(), note: 'Tap-to-result includes the demo’s minimum on-screen proving time (2.6 s for a meeting, 3.4 s for a proof slip), so values at that floor mean the circuit ran faster than the animation.', results }, null, 2));
