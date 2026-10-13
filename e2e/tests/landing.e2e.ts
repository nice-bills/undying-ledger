// SPDX-License-Identifier: Apache-2.0
// The front door at the root URL: it says what this is, shows the Preprod record with explorer
// links, has Terms and Privacy, and "Open the demo" opens the six-beat story.
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ERROR_TRAP } from './helpers';

test('the landing page leads into the demo', { tags: ['landing'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/');
  const l = screen.getByTestId('landing');
  await expect(l.getByRole('heading', 'The group’s book outlives the grant.')).toBeVisible();
  await expect(l.getByTestId('landing-proof')).toContainText('voteSecretary, elected');
  await expect(l.getByRole('link', 'Terms')).toBeVisible();
  await expect(l.getByRole('link', 'Privacy')).toBeVisible();
  await l.getByRole('link', 'Open the demo').tap();
  const b0 = screen.getByTestId('beat-0');
  await expect(b0.getByRole('button', 'Stamp and record meeting 12')).toBeVisible();
  await expect(b0.getByTestId('total12')).toContainText('12 shares');
  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
});
