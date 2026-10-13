// SPDX-License-Identifier: Apache-2.0
// What actually ran on Preprod (ui/src/demo/preprod.ts), shown without a wallet or a token:
// the contract and the transactions, each a link anyone can check on the explorer.
import { contractLink, PREPROD_RUN, txLink, type PreprodTx } from '../demo/preprod';
import { formatDust } from '../demo/fees';

const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
const SPECK = 10n ** 15n;
const dust = (speck: string) => {
  const s = BigInt(speck);
  return s === 0n ? '0' : `${s / SPECK}.${(s % SPECK).toString().padStart(15, '0').slice(0, 3)}`;
};

function Line({ label, tx }: { label: string; tx: PreprodTx }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>
        <a className="textlink" href={txLink(tx.txHash)} target="_blank" rel="noreferrer">
          {short(tx.txHash)}
        </a>
      </td>
      <td className="r num">{formatDust(Number(tx.feeDust))}</td>
    </tr>
  );
}

export function PreprodRecord() {
  const r = PREPROD_RUN;
  if (!r) return null;
  return (
    <div className="prose" data-testid="preprod-record">
      <span className="label">Ran on Preprod, {r.measuredAt.slice(0, 10)}</span>
      <p style={{ marginTop: 4 }}>
        Contract{' '}
        <a className="textlink" href={contractLink(r.contract)} target="_blank" rel="noreferrer">
          {short(r.contract)}
        </a>
        . Fees paid by the {r.paidBy}. The member’s wallet held {dust(r.callerDustSpeck.before)} DUST before and{' '}
        {dust(r.callerDustSpeck.after)} after.
      </p>
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Call</th>
            <th scope="col">Transaction</th>
            <th scope="col" className="r">
              Fee
            </th>
          </tr>
        </thead>
        <tbody>
          {r.deployTxHash && (
            <tr>
              <th scope="row">deploy</th>
              <td>
                <a className="textlink" href={txLink(r.deployTxHash)} target="_blank" rel="noreferrer">
                  {short(r.deployTxHash)}
                </a>
              </td>
              <td className="r">{r.deployedAt?.slice(0, 10)}</td>
            </tr>
          )}
          <Line label="recordMeeting" tx={r.recordMeeting} />
          <Line label="attestSavings" tx={r.attestSavings} />
          {r.sunset && (
            <tr>
              <th scope="row">sunset</th>
              <td>
                <a className="textlink" href={txLink(r.sunset.txHash)} target="_blank" rel="noreferrer">
                  {short(r.sunset.txHash)}
                </a>
              </td>
              <td className="r">vendor key erased</td>
            </tr>
          )}
          {r.afterSunset && (
            <tr>
              <th scope="row">meeting, after sunset</th>
              <td>
                <a className="textlink" href={txLink(r.afterSunset.recordMeeting.txHash)} target="_blank" rel="noreferrer">
                  {short(r.afterSunset.recordMeeting.txHash)}
                </a>
              </td>
              <td className="r">no vendor</td>
            </tr>
          )}
        </tbody>
      </table>
      {r.v2 && (
        <>
          <span className="label" style={{ display: 'block', marginTop: 18 }}>
            Contract v2, no member wallet, {r.v2.at.slice(0, 10)}
          </span>
          <p style={{ marginTop: 4 }}>
            Contract{' '}
            <a className="textlink" href={contractLink(r.v2.contract)} target="_blank" rel="noreferrer">
              {short(r.v2.contract)}
            </a>
            , up to 30 members. Every call was proved, bound by a throwaway key that holds nothing, and paid by the group fee key. After sunset three of five members elected a new secretary, who rebuilt the book from their stamps and recorded a meeting.
          </p>
          <table className="ledger" data-testid="preprod-v2">
            <thead>
              <tr>
                <th scope="col">Call</th>
                <th scope="col">Transaction</th>
                <th scope="col" className="r">
                  Fee
                </th>
              </tr>
            </thead>
            <tbody>
              {r.v2.rows.map((row) => (
                <tr key={row.txHash}>
                  <th scope="row">{row.label}</th>
                  <td>
                    <a className="textlink" href={txLink(row.txHash)} target="_blank" rel="noreferrer">
                      {short(row.txHash)}
                    </a>
                  </td>
                  <td className="r num">{row.feeSpeck} SPECK</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {r.heartbeat && (
        <p className="note">
          On a second group (
          <a className="textlink" href={contractLink(r.heartbeat.contract)} target="_blank" rel="noreferrer">
            {short(r.heartbeat.contract)}
          </a>
          ) the vendor sent a{' '}
          <a className="textlink" href={txLink(r.heartbeat.txHash)} target="_blank" rel="noreferrer">
            heartbeat {short(r.heartbeat.txHash)}
          </a>
          , paid from its own DUST. A member then tried sunset and the contract refused: “{r.heartbeat.sunsetRefused}”.
        </p>
      )}
    </div>
  );
}
