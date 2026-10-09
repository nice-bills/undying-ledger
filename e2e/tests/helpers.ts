// SPDX-License-Identifier: Apache-2.0
/** Records uncaught errors and console.error in the page so a test can assert there were none. */
export const ERROR_TRAP = `
  window.__errors = [];
  addEventListener('error', (e) => window.__errors.push('error: ' + e.message));
  addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));
  const ce = console.error.bind(console);
  console.error = (...a) => { window.__errors.push('console.error: ' + a.map(String).join(' ')); ce(...a); };
`;
