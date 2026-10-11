// SPDX-License-Identifier: Apache-2.0
// Smoke test for the Preprod live page (#/live) in a browser WITHOUT Lace. It proves the page and
// its lazy chunks load from the static build and that the member is told plainly what is missing.
// The write path itself (join, record, passbook, proof, sunset, fee relay) needs Lace and Preprod;
// it is covered by unit tests with a mocked Lace (ui/src/lace/__tests__/live-session.test.ts).
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ERROR_TRAP } from './helpers';

test('#/live renders and says there is no Lace wallet', { tags: ['live'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/#/live');
  const live = screen.getByTestId('live');
  await expect(live.getByRole('heading', 'The public register')).toBeVisible();
  await expect(live.getByTestId('lace-status')).toContainText('No Lace wallet');

  // Tapping the check gives the install hint, and no write controls appear without a wallet.
  await live.getByRole('button', 'Check my Lace setup').tap();
  await expect(live.getByTestId('lace-status')).toContainText('Install Lace (Midnight), switch it to Preprod');
  await expect(live.getByTestId('live-write')).not.toBeVisible();

  // A malformed address is refused on the page, before any network call.
  await live.getByRole('button', 'Read the register').tap();
  await expect(live.getByTestId('live-msg')).toContainText('does not look like a contract address');

  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
});
