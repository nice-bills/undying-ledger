// SPDX-License-Identifier: Apache-2.0
// The no-wallet path on #/live and the demo's opening screen, in a real browser from the static
// build. What runs here: the lazy live chunks, the "Use without a wallet" session (burner key,
// chain/src/burner.ts), the screen it opens, and its refusals before any network call. Joining,
// proving and voting need a proof server, a relay and a Blockfrost token; that path is run against
// Preprod by scripts/browser-preprod.mjs, not by this suite.
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ERROR_TRAP } from './helpers';

const HEX = 'ab'.repeat(32);

test('#/live without a wallet: the relay is the only way to pay, and a Blockfrost ID is asked for', { tags: ['live'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/#/live');
  const live = screen.getByTestId('live');
  await expect(live.getByRole('heading', 'The public register')).toBeVisible();
  // the v2 run is on the record, with the election
  await expect(live.getByTestId('preprod-v2')).toContainText('elected');

  await live.getByRole('button', 'Use without a wallet').tap();
  await expect(live.getByTestId('lace-status')).toContainText('No wallet');
  await expect(live.getByTestId('live-write')).toBeVisible();
  await expect(live.getByTestId('live-write')).toContainText('Without a wallet the relay pays every fee');
  // "let Lace pay" means nothing without Lace, so it is not offered
  await expect(live.getByTestId('lace-pays')).not.toBeVisible();

  // Joining with no Blockfrost ID is refused before any network call.
  await live.getByLabel('My member secret').fill(HEX);
  await live.getByLabel('Group secret').fill(HEX);
  await live.getByLabel('Passbook lock for this phone').fill('Kpalsi-Group-2026!x');
  await live.getByRole('button', 'Join this group').tap();
  await expect(live.getByTestId('write-err')).toContainText('Blockfrost');

  // A slot beyond a group of 30 is refused too.
  await live.getByLabel('My slot').fill('31');
  await live.getByRole('button', 'Join this group').tap();
  await expect(live.getByTestId('write-err')).toContainText('from 0 to 29');

  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
});

test('the demo opens on a skeleton of meeting 12, then the real book', { tags: ['demo'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/');
  const b0 = screen.getByTestId('beat-0');
  await expect(b0.getByRole('button', 'Stamp and record meeting 12')).toBeVisible();
  await expect(screen.getByTestId('opening')).not.toBeVisible();
  await expect(b0.getByTestId('total12')).toContainText('12 shares');
  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
});
