// SPDX-License-Identifier: Apache-2.0
// The root URL is the landing page; the demo (#/demo), the live register (#/live) and the
// legal pages load the app, and its compiled circuits, only when someone goes there.
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing/Landing';
import './fonts/fonts.css';
import './styles.css';

const loadApp = () => import('./App');
const App = lazy(loadApp);
// While the visitor reads the landing, fetch the demo (app chunk and the compiled circuits) in the
// background, so "Open the demo" does not wait on a chain of downloads on a slow phone.
let warmed = false;
const warmDemo = () => {
  if (warmed) return;
  warmed = true;
  loadApp()
    .then(() => import('@undying-ledger/contract'))
    .catch(() => (warmed = false));
};

const isLanding = () => {
  const route = location.hash.replace(/^#\/?/, '').split('?')[0];
  // ?fast (tests, recordings) and ?demo open straight on the demo
  const q = new URLSearchParams(location.search);
  return route === '' && !q.has('fast') && !q.has('demo');
};

function Root() {
  const [landing, setLanding] = useState(isLanding);
  useEffect(() => {
    const f = () => setLanding(isLanding());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    if (!landing) return;
    document.title = 'Undying Ledger · a savings group’s book on Midnight';
    // after the hero has played, when the phone is idle
    const idle = (globalThis as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
    const t = setTimeout(() => (idle ? idle(warmDemo) : warmDemo()), 4500);
    return () => clearTimeout(t);
  }, [landing]);
  return landing ? (
    <Landing />
  ) : (
    <Suspense fallback={<p className="boot">Opening the group’s book…</p>}>
      <App />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
