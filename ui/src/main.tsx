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
// While the visitor reads the landing, fetch the demo and build its book in the background, so
// "Open the demo" does not wait on downloads and 11 replayed meetings on a slow phone.
let warmed = false;
const warmDemo = () => {
  if (warmed) return;
  warmed = true;
  // fetch the demo, then build its book (11 meetings through the circuits, one per task)
  loadApp()
    .then((m) => m.prewarm())
    .catch(() => (warmed = false));
};

const isLanding = () => {
  const route = location.hash.replace(/^#\/?/, '').split('?')[0];
  // ?fast (tests, recordings) and ?demo open straight on the demo; ?landing shows the landing
  // even with ?fast (the launch video records the landing, then the demo at recording speed)
  const q = new URLSearchParams(location.search);
  return route === '' && (q.has('landing') || (!q.has('fast') && !q.has('demo')));
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
    // once the hero is under way, when the phone is idle (at most 1.5 s later)
    const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: unknown) => number }).requestIdleCallback;
    const t = setTimeout(() => (idle ? idle(warmDemo, { timeout: 1500 } as never) : warmDemo()), 2500);
    return () => clearTimeout(t);
  }, [landing]);
  return landing ? (
    <Landing />
  ) : (
    <Suspense
      fallback={
        <div className="boot" role="status" style={{ minHeight: '100dvh', background: '#0E5A43', color: '#FFF3DA', margin: 0 }}>
          Opening the group’s book…
        </div>
      }
    >
      <App />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
