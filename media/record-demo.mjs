// SPDX-License-Identifier: Apache-2.0
// Records the README demo video and the six beat screenshots from the REAL built app.
//   npm run build && npx serve docs -l 4173     (or e2e/serve.mjs 4173)
//   node media/record-demo.mjs http://localhost:4173/ shots   -> media/screens/beat-*.png (390x844 @2x)
//   node media/record-demo.mjs http://localhost:4173/ video   -> media/raw.webm (390x844)
//   ffmpeg -i media/raw.webm -c:v libx264 -pix_fmt yuv420p -crf 22 -r 30 -movflags +faststart media/demo.mp4
// PLAYWRIGHT=/path/to/playwright/index.mjs selects a Playwright install outside this repo.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const [url = 'http://localhost:4173/', mode = 'shots'] = process.argv.slice(2);
const out = fileURLToPath(new URL('.', import.meta.url));
const shots = mode === 'shots';
fs.mkdirSync(out + 'screens', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: shots ? 2 : 1,
  ...(shots ? {} : { recordVideo: { dir: out + 'vid', size: { width: 390, height: 844 } } }),
});
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const beat = (i) => p.getByTestId(`beat-${i}`);
const T = { timeout: 30000 };
const pause = (ms) => p.waitForTimeout(ms);
const shot = async (name) => shots && p.screenshot({ path: `${out}screens/${name}.png` });

await p.goto(url);
await p.evaluate(() => document.fonts.ready);
await pause(1800);
// 1. meeting 12: Fuseina adds a share for Abiba, then stamps and records
await beat(0).getByRole('group', { name: 'Abiba, shares bought' }).getByRole('button', { name: '2 shares' }).click();
await pause(700);
await beat(0).getByRole('group', { name: 'Abiba, shares bought' }).getByRole('button', { name: '2 shares' }).click(); // back to 1
await pause(500);
await beat(0).getByRole('button', { name: 'Stamp and record meeting 12' }).click();
await beat(0).getByRole('button', { name: 'Open Ama’s passbook' }).waitFor(T);
await pause(2200);
await shot('beat-1-meeting-12');
// 2. Ama's passbook prints line 12
await beat(0).getByRole('button', { name: 'Open Ama’s passbook' }).click();
await beat(1).getByTestId('match').evaluate((el) => new Promise((r) => { const f = () => (el.dataset.down ? r() : setTimeout(f, 100)); f(); }));
await pause(2400);
await shot('beat-2-passbook');
// 3. the husband's phone
await beat(1).getByRole('button', { name: 'See her husband’s phone' }).click();
await pause(2600);
await beat(2).getByRole('button', { name: 'Try to open slot 0' }).click();
await beat(2).getByTestId('err-open').filter({ hasText: 'group secret' }).waitFor(T);
await pause(2600);
await shot('beat-3-husband');
// 4. grant ends: early sunset refused, the light goes amber, then sunset
await beat(2).getByRole('button', { name: 'The grant ends' }).click();
await pause(1800);
await beat(3).getByRole('button', { name: 'End the grant' }).click();
await pause(3200);
await beat(3).getByRole('button', { name: 'Call sunset' }).click();
await beat(3).getByTestId('err-sunset').filter({ hasText: 'Refused' }).waitFor(T);
await pause(2800);
await beat(3).getByRole('button', { name: 'Skip the wait' }).click();
await pause(1600);
await beat(3).getByRole('button', { name: 'Call sunset' }).click();
await beat(3).getByRole('button', { name: 'Hold meeting 13' }).waitFor(T);
await pause(2600);
await shot('beat-4-sunset');
// 5. meeting 13 after sunset
await beat(3).getByRole('button', { name: 'Hold meeting 13' }).click();
await pause(1500);
await beat(4).getByRole('button', { name: 'Stamp and record meeting 13' }).click();
await beat(4).getByRole('button', { name: 'Ama applies for a loan' }).waitFor(T);
await pause(2400);
await shot('beat-5-meeting-13');
// 6. proof: 33 refused, 30 proved
await beat(4).getByRole('button', { name: 'Ama applies for a loan' }).click();
await pause(1500);
for (let i = 0; i < 3; i++) { await beat(5).getByRole('button', { name: 'More shares' }).click(); await pause(300); }
await beat(5).getByRole('button', { name: 'Make a proof slip' }).click();
await beat(5).getByTestId('err-prove').filter({ hasText: 'Refused' }).waitFor(T);
await pause(2600);
for (let i = 0; i < 3; i++) { await beat(5).getByRole('button', { name: 'Fewer shares' }).click(); await pause(300); }
await beat(5).getByRole('button', { name: 'Make a proof slip' }).click();
await beat(5).getByRole('button', { name: 'Slip ready for the loan officer' }).waitFor(T);
await pause(3200);
await shot('beat-6-proof');
const video = shots ? null : p.video();
await ctx.close();
if (video) fs.renameSync(await video.path(), out + 'raw.webm');
fs.rmSync(out + 'vid', { recursive: true, force: true });
await browser.close();
console.log('errors:', errors.length ? errors : 'none');
