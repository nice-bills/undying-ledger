# Running Undying Ledger on Midnight Preprod

This is the path from a fresh clone to a deployed savings group on Preprod with **measured** fees
and proof times in the UI. Expect one to two hours, most of it waiting for a wallet to sync.

> **What has and has not been run.** Everything in this file was written on a build machine with
> no Docker, no Lace and no tNIGHT. `scripts/preprod.sh` passes `bash -n` and `shellcheck`, its
> `check` step was run up to the Docker test, and `chain/` typechecks against Midnight.js 4.1.1.
> **Nothing here has been run against Preprod.** Treat the first run as the test.

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

- `npm ci && npm test` in the repo root should report 20 + 2 passing tests before you start.

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

### 9. Connect the UI

```bash
npm run dev
# open http://localhost:5173/#/live?contract=<address from .preprod/group.json>
```

The **live register** page (`ui/src/lace/LivePage.tsx`) reads the group's public state (members,
meetings, phase, last vendor check-in, one sealed commitment per slot) through the indexer your
Lace wallet is configured with, or through a Blockfrost Preprod project ID you paste on the page
(kept in that tab only). It is read-only. Writing to the book from the browser uses
`chain/src/browser.ts` (Lace providers, `payFees: false` for the group fee key) and
`chain/src/api.ts`; wiring those into the six-beat screens is the next piece of work.

### 10. Optional: the group fee-key relay

```bash
GROUP_FEE_KEY_SEED=<groupFeeKeySeed from .preprod/group.json> GROUP_CONTRACT=<address> \
MIDNIGHT_NETWORK=preprod npm run relay -w chain
```

The relay starts a DUST wallet from the group key and adds the fee to members' calls for this
contract only. For it to pay anything, some tNIGHT must be registered (or redirected) to the
fee key's DUST address, and new DUST starts at zero. The relay does not print that address yet;
that is open work. Also open: whether Lace honours `balanceUnsealedTransaction(tx, { payFees: false })`.

### 11. Stop

```bash
scripts/preprod.sh down
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `410 ENDPOINT_DECOMMISSIONED` or `fetch failed` for `*.preprod.midnight.network` | an old URL. Preprod is on Blockfrost now (see top). |
| HTTP `403 Missing project token` / `Invalid project token` / `Network token mismatch` | `BLOCKFROST_PROJECT_ID` unset, mistyped, or a Mainnet token. Midnight.js only shows `Received status code 403`; `scripts/preprod.sh check` shows the indexer's own message. |
| Wallet sync seems stuck | a first sync from genesis on Preprod takes over an hour. Saved sync state from the old Midnight-hosted indexer is not portable; discard it. |
| `Wallet sync timeout` right after a transaction | Blockfrost's idle subscription reports progress about every 4 to 5 minutes; wait longer. |
| Proof server never becomes healthy | first start downloads parameters; `docker compose -f chain/compose.yml logs`. |
| `DustDoubleSpend` (196) from the relay | two relays spent the same DUST UTXO; retry. Split the endowment across several NIGHT UTXOs. |
| The live page says "Failed to fetch" with a pasted token | the browser blocked a cross-origin request to Blockfrost (seen with an invalid token on the build machine; not tested with a valid one). Use the Lace path, or put a small proxy in front of the indexer. |
