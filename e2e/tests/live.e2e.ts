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
  // a malformed ?contract= wins over the address of the recorded Preprod run, so the refusal below is exercised
  await app.open('/#/live?contract=not-an-address');
  const live = screen.getByTestId('live');
  await expect(live.getByRole('heading', 'The public register')).toBeVisible();
  await expect(live.getByTestId('lace-status')).toContainText('No Lace wallet');
  // the recorded Preprod run is shown with no wallet and no token
  await expect(live.getByTestId('preprod-record')).toContainText('Ran on Preprod');
  await expect(live.getByTestId('preprod-record')).toContainText('recordMeeting');
  // the full group of 30: six meeting pages and a proof by member 29
  await expect(live.getByTestId('preprod-30')).toContainText('recordMeeting, page 5');
  await expect(live.getByTestId('preprod-30')).toContainText('attestSavings, member 29');

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
