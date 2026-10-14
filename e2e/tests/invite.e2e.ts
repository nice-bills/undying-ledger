// SPDX-License-Identifier: Apache-2.0
// Joining from an invite link with a 6-digit PIN, in a real browser from the static build. What
// runs here: reading the invite from the URL fragment, taking it out of the address bar, the
// prefilled join form, the PIN rules, the PIN-to-lock derivation (PBKDF2 in the browser) and the
// refusal that follows before any network call. Not run against Preprod.
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ERROR_TRAP } from './helpers';

const A = 'ab'.repeat(32);
const G = '01'.repeat(32);
const M = 'cd'.repeat(32);
const relay = btoa('http://192.168.1.20:3001').replace(/=+$/, '');
const INVITE = `u1.${A}.${G}.3.${M}.${relay}`;

test('an invite link fills in the group and the member, leaves the address bar, and asks only for a PIN', { tags: ['live'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open(`/#/live?invite=${INVITE}`);
  const live = screen.getByTestId('live');
  await expect(live.getByTestId('invite')).toContainText('the member in slot 3');
  // the secrets are not left in the address bar
  const href = await browser.evaluate<string>('location.href');
  expect(href.includes('invite=')).toEqual(false);

  await live.getByRole('button', 'Use without a wallet').tap();
  await expect(live.getByTestId('invite-join')).toContainText('slot 3');
  // nothing to type but the PIN: no secret fields
  await expect(live.getByLabel('My member secret')).not.toBeVisible();

  await live.getByLabel('6-digit PIN for this phone').fill('123456');
  await live.getByRole('button', 'Join this group').tap();
  await expect(live.getByTestId('write-err')).toContainText('straight run');

  // A good PIN becomes the lock; with no Blockfrost ID the join is refused before any network call.
  await live.getByLabel('6-digit PIN for this phone').fill('482916');
  await live.getByRole('button', 'Join this group').tap();
  await expect(live.getByTestId('write-err')).toContainText('Blockfrost');

  // Not you? The typed form comes back.
  await live.getByRole('button', 'Not you? Type the secrets instead').tap();
  await expect(live.getByLabel('My member secret')).toBeVisible();

  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
});

test('a cut-short invite says so', { tags: ['live'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open(`/#/live?invite=${INVITE.slice(0, 60)}`);
  await expect(screen.getByTestId('invite-err')).toContainText('cut short');
  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
});
