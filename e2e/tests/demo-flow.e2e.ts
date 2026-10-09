// SPDX-License-Identifier: Apache-2.0
// The six-beat demo story, end to end in a real browser, against the built static app.
// Every number asserted here is produced by the real compiled Compact circuits running in
// the page (DemoEngine over compact-runtime), not by the UI.
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ERROR_TRAP } from './helpers';

const noErrors = async (browser: { evaluate: <T>(fn: string) => Promise<T> }) => {
  const errors = await browser.evaluate<string[]>('window.__errors');
  expect(errors).toEqual([]);
};

test('the six-beat story: record, passbook, husband, sunset, meeting 13, proof', { tags: ['demo'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/?fast');

  // 1. The secretary records meeting 12. The real recordMeeting circuit runs.
  const b0 = screen.getByTestId('beat-0');
  await expect(b0.getByRole('heading', 'Meeting 12')).toBeVisible();
  await expect(b0.getByTestId('total12')).toContainText('12 shares');
  await b0.getByRole('button', 'Stamp and record meeting 12').tap();
  await expect(b0.getByTestId('proving12')).toBeVisible();
  await expect(b0.getByRole('button', 'Open Ama’s passbook')).toBeVisible();
  await expect(b0.getByTestId('after12')).toContainText('group fee key');

  // 2. Ama's passbook: 26 shares become 29 as line 12 prints; her GH₵150 loan is cleared.
  await b0.getByRole('button', 'Open Ama’s passbook').tap();
  const b1 = screen.getByTestId('beat-1');
  await expect(b1.getByTestId('ama-shares')).toHaveText('29');
  await expect(b1.getByTestId('ama-value')).toHaveText('290');
  await expect(b1.getByTestId('passbook')).toContainText('25, cleared');
  await expect(b1.getByText('Cleared')).toBeVisible();

  // 3. The husband's phone sees only public state, and cannot open slot 0.
  await b1.getByRole('button', 'See her husband’s phone').tap();
  const b2 = screen.getByTestId('beat-2');
  await expect(b2.getByTestId('pub-meetings')).toHaveText('12');
  await expect(b2.getByTestId('pub-members')).toHaveText('5 keys');
  await expect(b2.getByTestId('register')).not.toContainText('Ama');
  await b2.getByRole('button', 'Try to open slot 0').tap();
  await expect(b2.getByTestId('err-open')).toContainText('needs the group secret');

  // 4. The grant ends. Calling sunset early is refused by the contract; after the wait anyone can.
  await b2.getByRole('button', 'The grant ends').tap();
  const b3 = screen.getByTestId('beat-3');
  await b3.getByRole('button', 'End the grant').tap();
  await b3.getByRole('button', 'Call sunset').tap();
  await expect(b3.getByTestId('err-sunset')).toContainText('Refused by the book');
  await expect(b3.getByTestId('err-sunset')).toContainText('still sending heartbeats');
  await b3.getByRole('button', 'Skip the wait').tap();
  await expect(b3.getByTestId('countdown')).toHaveText('0s');
  await b3.getByRole('button', 'Call sunset').tap();
  await expect(b3.getByTestId('countdown')).toHaveText('Erased');
  await expect(b3.getByText('Sunset done')).toBeVisible();

  // 5. Meeting 13 still records after sunset; the fee comes off the group fee key.
  await b3.getByRole('button', 'Hold meeting 13').tap();
  const b4 = screen.getByTestId('beat-4');
  await expect(b4.getByText('The first meeting after sunset.')).toBeVisible();
  await b4.getByRole('button', 'Stamp and record meeting 13').tap();
  await expect(b4.getByRole('button', 'Ama applies for a loan')).toBeVisible();
  await expect(b4.getByTestId('after13')).toContainText('with no vendor');
  await expect(b4.getByTestId('after13')).toContainText('DUST');

  // 6. Ama proves "at least N shares". 33 is refused by the circuit (she holds 32); 30 works.
  await b4.getByRole('button', 'Ama applies for a loan').tap();
  const b5 = screen.getByTestId('beat-5');
  for (let i = 0; i < 3; i++) await b5.getByRole('button', 'More shares').tap();
  await expect(b5.getByTestId('min')).toHaveText('33');
  await b5.getByRole('button', 'Make a proof slip').tap();
  await expect(b5.getByTestId('err-prove')).toContainText('Not enough shares');
  for (let i = 0; i < 3; i++) await b5.getByRole('button', 'Fewer shares').tap();
  await b5.getByRole('button', 'Make a proof slip').tap();
  await expect(b5.getByRole('button', 'Slip ready for the loan officer')).toBeVisible();
  await expect(b5.getByTestId('slip-done')).toContainText('At least 30 shares');
  await expect(b5.getByText('stays with me').first()).toBeVisible();

  await noErrors(browser);
});

test('refusals on a fresh book: early sunset and an over-large proof', { tags: ['refusals'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/?fast');

  // Jump straight to beat 4 with the rail, end the grant, and call sunset at once.
  await screen.getByRole('button', 'Step 4: Grant ends, anyone calls sunset').tap();
  const b3 = screen.getByTestId('beat-3');
  await b3.getByRole('button', 'End the grant').tap();
  await b3.getByRole('button', 'Call sunset').tap();
  await expect(b3.getByTestId('err-sunset')).toContainText('Refused by the book');
  await expect(b3.getByText('Vendor silent')).toBeVisible(); // still ACTIVE, not sunset

  // Ama holds 26 shares on a fresh book; asking for 33 is refused by attestSavings.
  await screen.getByRole('button', 'Step 6: Prove savings, keep the amount').tap();
  const b5 = screen.getByTestId('beat-5');
  for (let i = 0; i < 3; i++) await b5.getByRole('button', 'More shares').tap();
  await b5.getByRole('button', 'Make a proof slip').tap();
  await expect(b5.getByTestId('err-prove')).toContainText('Refused by the circuit');
  await expect(b5.getByTestId('err-prove')).toContainText('cannot prove 33');
  await expect(b5.getByRole('button', 'Make a proof slip')).toBeVisible();

  await noErrors(browser);
});

test('Terms, Privacy and the fee key page are reachable and plain', { tags: ['legal'] }, async ({ app, screen, browser }) => {
  await browser.addInitScript(ERROR_TRAP);
  await app.open('/');
  await screen.getByRole('link', 'Privacy').tap();
  await expect(screen.getByRole('heading', 'Privacy')).toBeVisible();
  await expect(screen.getByText('We collect nothing')).toBeVisible();
  await expect(screen.getByText('Private state stays on the device')).toBeVisible();
  await screen.getByRole('link', 'Back to the book').first().tap();
  await screen.getByRole('link', 'Terms').tap();
  await expect(screen.getByRole('heading', 'Terms of use')).toBeVisible();
  await screen.getByRole('link', 'Back to the book').first().tap();
  await screen.getByRole('link', 'Fee key').tap();
  await expect(screen.getByRole('heading', 'Fee key 1')).toBeVisible();
  await screen.getByRole('button', 'Key copied: burn fees').tap();
  await expect(screen.getByTestId('daybook')).toContainText('cannot write to the book');
  await noErrors(browser);
});

// Agentic smoke test: runs only with a model key (AI_GATEWAY_API_KEY). The deterministic tests
// above are the gate; this one checks the story reads right to a fresh pair of eyes.
test('agent: a newcomer can follow the story to sunset', { tags: ['agent'] }, async ({ app, agent, screen }) => {
  test.skip(!process.env.AI_GATEWAY_API_KEY, 'no model key: set AI_GATEWAY_API_KEY to run agent steps');
  await app.open('/?fast');
  await agent.act('record meeting 12 for the savings group, then open Ama’s passbook');
  await expect(screen.getByTestId('ama-shares')).toHaveText('29');
  await agent.act('go to the step where the grant ends, end the grant, wait out or skip the grace period, and call sunset');
  await expect(screen.getByTestId('countdown')).toHaveText('Erased');
  await agent.assert('the page says the vendor key was erased and nobody can switch the book off');
});
