// SPDX-License-Identifier: Apache-2.0
// Terms and Privacy: short, plain and true for this build. The demo collects nothing.
import { useEffect, useRef } from 'react';
import { Leaf } from '../a2/paper';

export function LegalPage({ which }: { which: 'terms' | 'privacy' }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), [which]);
  return (
    <section className={`beat ${which === 'terms' ? 'w-green' : 'w-ox'}`} style={{ bottom: 0 }} aria-label={which === 'terms' ? 'Terms of use' : 'Privacy policy'} data-testid={which}>
      <Leaf band={[<b key="a">Undying Ledger</b>, <a href="#/demo" key="b">Back to the book</a>]} dog>
        {which === 'terms' ? <Terms h={h} /> : <Privacy h={h} />}
        <div style={{ height: 22 }} />
        <a className="btn" href="#/demo" style={{ textDecoration: 'none' }}>
          Back to the book
        </a>
      </Leaf>
    </section>
  );
}

function Terms({ h }: { h: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <>
      <h2 className="disp" tabIndex={-1} ref={h}>
        Terms of use
      </h2>
      <p className="lede">Last updated 9 October 2026</p>
      <div className="prose">
        <p>This is a demonstration of Undying Ledger, a savings-group record book built on Midnight. Using it means you accept these terms.</p>
        <h3>What this is</h3>
        <p>
          The demo runs the group’s real contract code in your browser with made-up members and amounts. It does not connect to a wallet or a
          network, it moves no money and it makes no zero-knowledge proofs. Nothing you do here is recorded anywhere.
        </p>
        <h3>No financial service</h3>
        <p>
          Undying Ledger is not a bank, a lender or a payment service, and nothing here is financial advice. A savings group stays responsible
          for its own cash box, its own rules and its own records.
        </p>
        <h3>No warranty</h3>
        <p>
          The software is open source under the Apache License 2.0 and is provided as is, without warranties of any kind. It has not been
          audited and has not yet run on a public network. Fee figures marked as placeholders are estimates, not measurements.
        </p>
        <h3>Changes</h3>
        <p>We may change these terms when the software changes. The version in the project’s repository is the current one.</p>
      </div>
    </>
  );
}

function Privacy({ h }: { h: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <>
      <h2 className="disp" tabIndex={-1} ref={h}>
        Privacy
      </h2>
      <p className="lede">Last updated 9 October 2026</p>
      <div className="prose">
        <h3>We collect nothing</h3>
        <p>
          This demo has no accounts, no analytics, no cookies, no tracking and no server of ours. The fonts are served with the page, so no
          third party sees your visit either. When you close the tab, the demo group is gone.
        </p>
        <h3>Private state stays on the device</h3>
        <p>
          In the real app, each member’s passbook, keys and the group secret live only on her own phone. Amounts and names are never put on
          the chain. The chain holds sealed commitments, counts, the sunset phase and “at least N shares” proofs, which anyone can see but
          nobody can open without the group secret.
        </p>
        <h3>What others can see</h3>
        <ul>
          <li>The public ledger: how many members and meetings, one sealed commitment per member slot, and when the vendor last checked in.</li>
          <li>Which slot made a savings proof, and the threshold it proved, but never the amount.</li>
          <li>The secretary’s phone holds every passbook, as the group’s paper book does today.</li>
        </ul>
        <h3>No messages</h3>
        <p>The app never sends balances by SMS, so a shared household phone receives nothing about anyone’s savings.</p>
        <h3>Questions</h3>
        <p>Open an issue in the project’s repository.</p>
      </div>
    </>
  );
}
