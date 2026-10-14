# Running Undying Ledger on Midnight Preprod

This is the path from a fresh clone to a deployed savings group on Preprod with **measured** fees
and proof times in the UI. Expect two to three hours, most of it a one-time wallet sync.

> **What has and has not been run.** On 12 October 2026 the wallet-SDK path ran end to end on
> Preprod from a cloud container: `register-dust self`, the deploy, `register-dust endow`, the
> fee-key relay, and `measure --apply` in relay mode (hashes in the README). On 13 October 2026
> **the Lace path (step 9, `payFees: false`) ran too**, from a 0-tDUST Lace wallet in Chromium on
> the owner's laptop: `recordMeeting` `625e2fe2…663f8186` and `attestSavings` `6703d63b…1b75dee1`.

### The order that worked (12 Oct 2026, seeds instead of Lace)

```bash
# three throwaway 64-hex seeds plus the fee key's, mode 600, never printed or committed
umask 077; for k in DEPLOYER NGO CALLER GROUP_FEE_KEY; do echo "${k}_SEED=$(openssl rand -hex 32)"; done > .preprod/wallets.env
set -a; . .preprod/wallets.env; set +a; export MIDNIGHT_NETWORK=preprod
npm run addresses -w chain                     # the deployer's unshielded address -> faucet tNIGHT
npm run sync-wallets -w chain -- deployer &    # one process per wallet: the sync is CPU-bound
npm run sync-wallets -w chain -- ngo &         # (about 1 h 45 min each from genesis, saved as it goes
npm run sync-wallets -w chain -- caller &      #  to .preprod/wallet-state; a restore takes ~6.5 min)
npm run sync-wallets -w chain -- feekey & wait
npm run register-dust -w chain -- self         # the deployer's NIGHT now makes its own DUST
GRACE_SECONDS=300 DEPLOY_OUT=$PWD/.preprod/group.json npm run deploy:preprod -w chain   # reuses GROUP_FEE_KEY_SEED
npm run register-dust -w chain -- endow        # half the NIGHT to the NGO key, registered to the fee key
GROUP_CONTRACT=... GROUP_FEE_KEY_SEED=... npm run relay -w chain &   # both from .preprod/group.json
RELAY_URL=http://localhost:3001 scripts/preprod.sh measure --apply   # CALLER_SEED signs with 0 DUST
```

> **Preprod moved to Blockfrost on 9 October 2026.** Midnight shut down
> `indexer.preprod.midnight.network` and `rpc.preprod.midnight.network` from 22:00 UTC that day
> (the old indexer now answers `410 ENDPOINT_DECOMMISSIONED`). Every Preprod indexer and RPC
> request now needs a Blockfrost project token. `chain/src/config.ts` is updated for this.
> Source: https://docs.midnight.network/guides/networks-and-environments

## The short version

```bash
export BLOCKFROST_PROJECT_ID=nightpreprod...        # step 2
export DEPLOYER_MNEMONIC="word1 word2 ... word24"   # steps 3 and 4: a THROWAWAY test wallet
scripts/preprod.sh                                   # check, proof server, compile, deploy, measure
scripts/preprod.sh measure --apply                  # put the measured numbers into the UI
```

Each step can also be run on its own: `scripts/preprod.sh check | up | deploy | measure | down`.

## Versions (Preprod support matrix, checked 9 October 2026)

| Component | Version |
|---|---|
| Compact toolchain | 0.31.1 (0.34 and 0.35 target ledger 9 and cannot deploy here) |
| Compact runtime | 0.16.0 |
| Midnight.js | 4.1.1 |
| DApp Connector API | 4.0.1 |
| Wallet SDK | 1.2.0 |
| Proof server | `midnightntwrk/proof-server:8.1.0` |

Source: https://docs.midnight.network/relnotes/support-matrix

## Step by step

### 1. Prerequisites

- Node.js 22 or newer, Docker (Desktop or Engine, running), `curl`, Chrome or another Chromium browser.
- The Compact toolchain, pinned:

  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  compact update 0.31.1
  ```

- `npm ci && npm test` in the repo root should report 20 + 30 passing tests before you start.

### 2. A Blockfrost token for Preprod

1. Sign in at https://blockfrost.io and create a project on the **Midnight Preprod** network.
2. Copy its project ID (it starts with `nightpreprod`) and `export BLOCKFROST_PROJECT_ID=...`.
   Keep it out of the repo; `.env*` files are gitignored.
3. `scripts/preprod.sh check` asks the indexer for a block height with it.

### 3. A throwaway test wallet in Lace, funded from the faucet

1. Install Lace from the Chrome Web Store and create a **new** wallet only for this test.
   Its recovery phrase goes into a shell variable in step 7, so never use a wallet that holds anything real.
2. Switch the wallet to **Preprod** and copy its **unshielded** address (`mn_addr_preprod1...`).
3. Request tNIGHT at https://midnight-tmnight-preprod.nethermind.dev/ (1,000 tNIGHT per request,
   rate limited). It arrives within a couple of minutes.

### 4. Register the tNIGHT for DUST

In Lace, open the Midnight wallet, choose **Generate tDUST**, then **Review transaction** and
**Confirm**. The tDUST tank starts filling (up to 5 DUST per NIGHT, about a week to full, so
1,000 tNIGHT gives a cap of 5,000 DUST and plenty within minutes).
Source: https://docs.midnight.network/guides/acquire-tokens

### 5. Start the local proof server

```bash
scripts/preprod.sh up      # docker compose -f chain/compose.yml up -d, then waits for :6300/health
```

The server downloads public proving parameters once at startup. Your private inputs never leave it.

### 6. Point Lace at the local proof server

In Lace's Midnight settings, set the network to **Preprod** and the proof server to **Local
(`http://localhost:6300`)**. The member app's providers (`chain/src/browser.ts`) prove with
whatever prover Lace is configured with, and a member's passbook must never go to a hosted prover.
The live page in step 9 has a **Check my Lace setup** button that reports the configured prover.

### 7. Compile and deploy a demo group

```bash
export DEPLOYER_MNEMONIC="..."   # the throwaway wallet from step 3 (or DEPLOYER_SEED=<64 hex>)
scripts/preprod.sh deploy
```

This runs `npm ci`, `compact compile` (it generates the proving keys, which are not committed) and
`chain/src/scripts/deploy.ts`. The deploy wallet syncs first; a full sync on Preprod can take
over an hour. It deploys a 5-member group with a 7-day grace period (`GRACE_SECONDS` overrides
it; use something short such as `GRACE_SECONDS=300` to try `sunset()` the same day) and writes
the contract address and the demo secrets to `.preprod/group.json` (mode 600, gitignored).
In a real group those secrets go to each phone by QR code, never to a server.

### 8. Measure the real fee and proof times

```bash
scripts/preprod.sh measure            # prints the numbers and the command to apply them
scripts/preprod.sh measure --apply    # also writes ui/src/demo/measured.ts and rebuilds docs/
```

`chain/src/scripts/measure.ts` joins the group as the secretary, records one meeting, then proves
"at least 1 share" as member 0. For each call it reports:

- **fee**: read from the indexer (`RegularTransaction.fee`, in SPECK; 1 DUST = 10^15 SPECK), not
  from a balance difference, because DUST keeps generating while a proof runs;
- **proof time**: wall-clock time of the local proof server's `proveTx`;
- **submit-to-final time**: from the call until the transaction is final.

It ends with a line like:

```bash
node ui/scripts/set-measured.mjs --fee 0.42 --record 18.2 --attest 12.9 --date "2026-10-12, Preprod, proof-server 8.1.0"
```

That writes `ui/src/demo/measured.ts`. After `npm run build` the demo charges the measured fee
instead of the 1 DUST placeholder, the "placeholder" wording disappears from the meeting 13 page
and the fee key page, and the proving notes say how long the real proof took. You can also edit
`measured.ts` by hand; every field is `null` until measured.

The number to update in the pitch is then: one-off group endowment = (fee per meeting x meetings
per year) / (DUST per NIGHT per year), priced at the NIGHT price of the day.

### 9. Connect the UI and act on the book

```bash
npm run dev
# open http://localhost:5173/#/live?contract=<address from .preprod/group.json>&relay=http://localhost:3001
```

`npm run dev` also serves the proving keys and ZKIR from `contract/src/managed/undying` at `/zk/`,
where the page's proving-keys field points by default. They are never copied into `docs/`.

The **live page** (`ui/src/lace/LivePage.tsx`) first reads the group's public state (members,
meetings, phase, last vendor check-in, one sealed commitment per slot) through the indexer your
Lace wallet is configured with, or through a Blockfrost Preprod project ID you paste on the page
(kept in that tab only). No wallet is needed for that.

**Check my Lace setup** connects with dApp connector 4.0.1 (`connect('preprod')`) and checks Lace's
network and proof server. It warns when the prover is not `localhost`/`127.0.0.1`, because the
passbook would then leave the machine to be proved. After that the page loads the write path
(`ui/src/lace/LiveWrite.tsx` and `live-session.ts`) and builds the Midnight.js providers from
`chain/src/browser.ts`: Lace's wallet and submit APIs, its prover, its indexer (or the pasted
Blockfrost ID), and private state in this browser (`levelPrivateStateProvider`, IndexedDB,
encrypted with a passphrase you type, scoped to your wallet).

1. Choose **a member** or **the secretary**, paste your secret and the group secret from
   `.preprod/group.json` (and your slot, for a member), choose a passphrase (16+ characters, three
   kinds of character), and press **Join this group**. The page checks the address with the indexer
   first and your secrets against the public keys on the book.
2. Fees: with a **relay URL** (step 10) each call is balanced by Lace with `payFees: false` and the
   bound transaction is POSTed to the relay, which adds the DUST fee from the group key. With no
   relay URL, tick **let Lace pay** to pay from your own DUST. Without either, nothing is proved.
3. Secretary: enter the meeting's shares, social fund, loans and repayments per slot and press
   **Stamp and record meeting N**. One `recordMeeting` call per page of five slots. The page then
   lists one stamp per member, like `undying-stamp:0:3:1:0`.
4. Member: **Open my passbook** reads your copy from private state and checks it against the sealed
   commitment with the contract's `passbookCommitment`. If it is behind, paste the secretary's
   stamp and **Keep this stamp**; it is kept only if it opens the sealed line.
5. Member: **Make a proof slip** calls `attestSavings(slot, N, nonce)`. Asking for more than you
   hold is refused by the circuit.
6. Anyone: **Call sunset** after the grace period (`GRACE_SECONDS=300` at deploy makes that the same
   day). Before then the book refuses it.

Each call shows the proving skeleton and its stage: proving on your prover, Lace balancing, the
relay adding the fee, or Lace submitting. Errors are the page's own words for: no Lace, Lace
declined, wrong network, no prover or a remote one, no indexer, contract not found, Lace refusing
`payFees: false`, relay unreachable or refusing, and the circuit's own refusals.

> **Status of this step.** **Ran on Preprod on 13 Oct 2026** with a new Lace (Midnight) wallet
> holding 0 tDUST, in Chromium on Linux, through the relay: the secretary's `recordMeeting`
> (`625e2fe2…663f8186`, block 2,968,251) and member 0's `attestSavings` (`6703d63b…1b75dee1`,
> block 2,968,385), 1 SPECK each, paid by the group fee key. Lace honours
> `balanceUnsealedTransaction(tx, { payFees: false })` and the relay accepts what it returns.
> About 70 s from Sign to the stamps for `recordMeeting`, not yet split by stage. Still only
> tested with mocks: a wallet that refuses `payFees: false` (the page then offers **Let Lace pay
> this fee instead**), a wallet that adds its own fee (the relay refuses it), and `sunset` or
> `voteSecretary` through Lace.
>
> What to expect, from that run: after **Check my Lace setup**, Lace asks to authorize
> `localhost:5173`; each call shows Lace's **Prove transaction** sheet. Use one passbook lock per
> browser: the store is encrypted with the first one (see Troubleshooting). There is no "leave"
> button yet; reload the page to join with another role.

### 9b. Act on the book with no wallet at all

A call to this contract moves no coins, so a member needs no wallet: the page proves the call on
the local proof server, binds it with a throwaway key that holds nothing (`chain/src/burner.ts`)
and sends it to the relay, which adds the fee. Nothing to install but Docker for the proof server.

1. Start the proof server (`scripts/preprod.sh up`) and the relay for the group (step 10).
2. Open `#/live?contract=<address>&relay=http://localhost:3001`, paste the Blockfrost project ID,
   tap **Use without a wallet**, then join with a member or secretary secret from the group's JSON.
3. Members can vote for a new secretary under **Elect a new secretary**; the one standing taps
   **I am standing** on her own phone and reads out the key.

The same path ran from Node on 13 Oct 2026 against contract v2 (`npm run burner:preprod -w chain`,
see the README table): a meeting, a proof, sunset, three votes that elected a new secretary, and a
meeting by her. From a browser it ran on 13 Oct too (`scripts/browser-preprod.mjs`, headless Chromium): join, keep a stamp, a proof slip and a vote.

```bash
GROUP_JSON=.preprod/group3.json RELAY_URL=http://localhost:3001 BURNER_OUT=.preprod/burner-run.json \
MIDNIGHT_NETWORK=preprod npm run burner:preprod -w chain
```

### 9c. Invite links, QR cards and a 6-digit PIN

Instead of typing the address, two 64-hex secrets, a slot and a 16-character lock, each member
scans her card and picks a 6-digit PIN.

```bash
GROUP=.preprod/group.json RELAY_URL=http://<laptop LAN IP>:3001 npm run invites -w chain
# writes .preprod/invites.html (mode 600): one QR card for the secretary and one per member slot
```

- The link is `<app>#/live?invite=u1.<contract>.<group secret>.<slot or s>.<own secret>.<relay>`.
  It sits in the URL fragment, which the browser never sends to a server, and the page removes it
  from the address bar once read. `APP_URL` sets the app (default: the Pages site);
  `INVITE_BLOCKFROST=1` also puts `BLOCKFROST_PROJECT_ID` into each link, so no-wallet members need
  not paste it (anyone with a link can then use that quota).
- The card is that person's key: whoever scans it can act as her. Hand each card to its owner and
  destroy the paper.
- The PIN becomes the passbook lock through PBKDF2-SHA256 (600,000 rounds), salted with the contract
  and her own secret, so the same PIN opens the same passbook on that phone next time. Without the
  invite, the PIN opens nothing; with the invite and the phone, 10^6 PINs can be tried offline, so
  the PIN keeps out a look over the shoulder, not someone who has both. **Use a long lock instead**
  keeps the old 16-character lock.
- **Join as someone else** (after joining) lets the next person join on the same phone. Each
  person's passbook stays in the browser under her own PIN.
- `PROVER_URL` puts the group's proof server into each invite. A phone cannot run a proof server, so
  in no-wallet mode it can join and read but not prove; with `PROVER_URL` (an https address, for
  example the secretary's laptop behind a tunnel, or `http://localhost` on a laptop) it proves there.
  What she proves goes to that machine, and the page says so. Not yet run against a remote prover.
- With an invite the page opens on **Join your group**; the public record and the connection
  settings sit in folds, and the 5 MB Midnight engine starts downloading while she reads.
- After a meeting the secretary's stamps each have **Show as QR**, so a member's camera reads hers.
  Before a stamp matches the book, a new phone says so instead of showing 0 shares.
- While a call runs, the page shows **Sent** with the tx id as soon as the relay (or Lace) returns.
  The relay answers once Preprod has finalized the call; the rest of the wait is the indexer.

Ran on Preprod on 14 Oct 2026 from headless Chromium with no wallet (`scripts/browser-preprod.mjs`
against group v2): invite + PIN join, a stamp, `attestSavings` (block 2,972,000, Sent at 30 s,
result at 37 s), `voteSecretary` (2,972,005), **Join as someone else**, and a rejoin with the same
PIN that opened the same passbook. Also on 14 Oct, on an iPhone in Safari: a QR card scanned with the camera, a PIN join, the passbook opened and a stamp kept. Proving needs a proof server on the same device, so a phone can join and read but not prove in no-wallet mode.

### 10. Optional: the group fee-key relay

```bash
GROUP_FEE_KEY_SEED=<groupFeeKeySeed from .preprod/group.json> GROUP_CONTRACT=<address> \
MIDNIGHT_NETWORK=preprod npm run relay -w chain
```

The relay starts a DUST wallet from the group key and adds the fee to members' calls for this
contract only. For it to pay anything, some tNIGHT must be registered (or designated) to the
fee key's DUST address, and new DUST starts at zero. The deploy step writes that address to
`.preprod/group.json` as `groupFeeKeyDustAddress`, the relay logs it before its first sync, and
`GET /health` returns it as `dustAddress`. The relay also refuses a call that already carries a
DUST fee from the member's wallet, so a fee is never paid twice. (Both changes were written
without a network or installed packages; run `npm run typecheck` first.) On 13 Oct 2026 the relay's
`balanceFinalizedTransaction` accepted Lace's `payFees: false` transactions (step 9). Put the relay's
URL in the live page's relay field (or `&relay=` in the page URL). The relay answers CORS
preflights from any origin.

### 10b. Optional: heartbeat and a refused sunset

`heartbeat` is an admin call, so the vendor's wallet pays its own fee; the relay only sponsors
group calls. Deploy a group with a grace period long enough to test inside, wait a minute, then:

```bash
DEPLOY_OUT=.preprod/group2.json GRACE_SECONDS=3600 MIDNIGHT_NETWORK=preprod npm run deploy:preprod -w chain
GROUP_JSON=.preprod/group2.json HEARTBEAT_OUT=.preprod/heartbeat.json npm run heartbeat:preprod -w chain
```

The script sends `heartbeat(now - 60 s)` and then has a member try `sunset()`, which the
circuit refuses with "The maintainer is still sending heartbeats" before anything is sent. Ran
on 12 Oct 2026: heartbeat `4fd7f18c…73d706`, block 2,955,062, 1 SPECK.

### 11. Stop

```bash
scripts/preprod.sh down
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `410 ENDPOINT_DECOMMISSIONED` or `fetch failed` for `*.preprod.midnight.network` | an old URL. Preprod is on Blockfrost now (see top). |
| HTTP `403 Missing project token` / `Invalid project token` / `Network token mismatch` | `BLOCKFROST_PROJECT_ID` unset, mistyped, or a Mainnet token. Midnight.js only shows `Received status code 403`; `scripts/preprod.sh check` shows the indexer's own message. |
| Wallet sync seems stuck | a first sync from genesis on Preprod took about 1 h 45 min (1.65 million DUST events, one CPU core per wallet). Run `npm run sync-wallets -w chain` first, one process per wallet; progress is saved every 3 minutes. Saved state from the old Midnight-hosted indexer is not portable; discard it. |
| `disconnected from wss://rpc.midnight-preprod.blockfrost.io ... 1000:: Normal Closure` during a submission | Blockfrost closes its websockets from time to time. `submitWithRetry` (chain/src/wallet.ts) retries up to three times. If a retry fails with `1010: Invalid Transaction: Custom error: 170`, an earlier attempt may or may not have landed: rerun the step, which checks the chain first (on 12 Oct the first transfer had not landed). |
| A script sits for minutes after "Initializing wallet builder" | it is restoring a saved wallet (about 6.5 minutes of CPU for a 6 MB DUST state); not a hang. |
| `Wallet sync timeout` right after a transaction | Blockfrost's idle subscription reports progress about every 4 to 5 minutes; wait longer. |
| Proof server never becomes healthy | first start downloads parameters; `docker compose -f chain/compose.yml logs`. |
| `DustDoubleSpend` (196) from the relay | two relays spent the same DUST UTXO; retry. Split the endowment across several NIGHT UTXOs. |
| `ReferenceError: Buffer is not defined` on the first Lace call | a build from before 13 Oct 2026: Lace's Bech32m keys are decoded by a Midnight package that uses Node's `Buffer`. The write path now installs a polyfill (`ui/src/lace/buffer-shim.ts`). |
| **Join this group** goes back to idle, or says "a different passbook lock" | this browser's passbook store was created with another lock. Type that one, or clear the site's data (Site settings, Delete data) and join again; then keep your latest stamp. |
| The live page says "Failed to fetch" with a pasted token | the browser blocked a cross-origin request to Blockfrost (seen with an invalid token on the build machine; not tested with a valid one). Use the Lace path, or put a small proxy in front of the indexer. |
