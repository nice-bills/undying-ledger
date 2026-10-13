// SPDX-License-Identifier: Apache-2.0
// The root URL is the landing page; the demo (#/demo), the live register (#/live) and the
// legal pages load the app, and its compiled circuits, only when someone goes there.
import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing/Landing';
import './fonts/fonts.css';
import './styles.css';

const App = lazy(() => import('./App'));

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
    if (landing) document.title = 'Undying Ledger · a savings group’s book on Midnight';
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
