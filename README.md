# Undying Ledger

**The savings-group book that can’t be switched off when the grant ends.**

Undying Ledger is a private record book for village savings and loan associations (VSLAs, also called susu groups or savings groups), built on [Midnight](https://midnight.network). It keeps working after the NGO grant and the app vendor are gone. Members hold no crypto and pay nothing. Their balances are hidden from outsiders, including a spouse who shares the household phone.

Built for the AKINDO Midnight Buildathon, Wave 2.

![The six beats of the demo: meeting 12, Ama's passbook, the husband's phone, sunset, meeting 13, the proof slip](media/strip.jpg)

**Try it:** serve `docs/` with any static server (`npx serve docs`), or enable GitHub Pages (see [Deploying the demo](#deploying-the-demo)). The demo runs the **real compiled Compact circuits** in your browser through `@midnight-ntwrk/compact-runtime`. It needs no wallet, no network and no tokens. A one-minute recording of the built app is in [`media/demo.mp4`](media/demo.mp4).

---

## The problem, with evidence

1. **The app is free while the NGO contract lasts. After that, the group pays or loses it.**
   - hiveonline’s VSLA.online FAQ: use of the app is "included as part of the initial roll-out package swapping to a subscription fee at the end of the contract… $10/month" per group. https://www.hivenetwork.online/faqs
2. **Use collapses when donor money stops.**
   - Jamii.one (Kenya) digitised 708 groups (24,042 members). "Three months after donor funding ended, only about 15% of those groups were still recording meetings." https://dsghub.org/can-digitalisation-interventions-in-savings-groups-survive-after-the-project-ends/
   - To be fair, Jamii.one mainly blames the end of stipends for field promoters, not server costs. Undying removes the running cost and the dependence on the vendor. It does not fix the incentives for the people involved.
3. **Women often save in secret, and digital records have already exposed them.**
   - From the PCI / Global Communities DreamSave study in Tanzania: when savings SMS went to a shared household phone, "these women did not anticipate their husbands’ receiving their savings information… the husband received an SMS telling him that the notifications had been turned off and he became angry. It is common for women to save privately, away from their husbands." https://globalcommunities.org/wp-content/uploads/2025/09/PCI_Digitizing_Savings_Groups_Report_Tz_Sept_2020.pdf
4. **A plain public chain would be worse than paper.** On a transparent chain, every member’s deposits and missed payments would be readable forever.

## Why Midnight

| Need | What Midnight gives |
|---|---|
| Someone must pay every fee, forever, for members who hold no tokens. The NGO wants to stop paying. | Fees are paid in **DUST**, which is *generated* by NIGHT and **cannot be transferred**. The NGO registers NIGHT once to a per-group DUST address. Its last act is an **endowment, not a subscription**, and it keeps its NIGHT. Relatives abroad can **point their own NIGHT’s DUST** at the same address without sending any money. |
| The fee key must live inside every member’s app. | A copied DUST key can only pay fees. It cannot move NIGHT or any value, and it cannot write to the book, because every circuit checks a role secret. |
| Balances must be hidden from spouses, vendors and explorers, yet still checkable by the group. | Compact circuits keep amounts as private inputs. The chain stores only **hiding commitments**, and the compiler rejects any undisclosed leak. |
| The book must outlive the vendor. | `sunset()` can be called by anyone once the maintainer’s heartbeats stop. It permanently closes the admin paths, and recording continues. |

Other chains fall short. Celo fee abstraction still needs the user to hold cUSD, and every record is public. An Ethereum paymaster deposit gets spent down, and a published gas key is drained within seconds. Aztec and Aleo have private state, but their fees are consumed rather than regenerated, so there is no fee key that is safe to share.

## The demo, in six beats

The UI is a printed VSLA passbook ("A2 Passbook"): cloth covers that change colour with each beat, deckled ivory leaves, rubber stamps with uneven ink, carbon slips, a ballpoint that ticks the members off, and an amber light that leans across the page only while the vendor's grace period runs down. Every figure on screen comes from `DemoEngine` running the compiled circuits; nothing is hard-coded.

| # | Beat | What actually runs |
|---|---|---|
| 1 | **Fuseina records meeting 12** (bottle-green minute book) | `recordMeeting` re-commits all 5 passbooks; every member’s phone checks its stamp against the new commitment. The receipt says the group fee key paid and members paid nil. |
| 2 | **Ama’s passbook** (oxblood) | Line 12 prints in: 26 → 29 shares (GH₵290), her GH₵150 loan is cleared, and the stamp is verified against the on-chain commitment with the group secret. |
| 3 | **Her husband’s phone** (slate) | Only public state: 5 member keys, 12 meetings, one sealed commitment per slot, no SMS. “Try to open slot 0” runs the stamp check with a guessed group secret and the exact figures, and fails. |
| 4 | **The grant ends** (dusk) | The vendor’s heartbeats stop. Calling `sunset()` early is refused by the contract (“The maintainer is still sending heartbeats”). After the grace period, any member calls it; the vendor key is erased. |
| 5 | **Meeting 13 still records** | `recordMeeting` with no vendor and no admin key; the fee comes off the group fee key gauge. |
| 6 | **Prove savings, keep the amount** (blue security paper) | `attestSavings` proves “at least 30 shares” for a loan officer. Asking for 33 when she holds 32 is refused by the circuit, and the slip is withdrawn. |

Also in the app: a **fee key page** (a relative points their NIGHT’s DUST at the key, a leaked key burns DUST but cannot write the book, time refills it, rotation starts a fresh key), **Terms** and **Privacy** pages, and a **live page** for a group deployed on Preprod (`#/live`): anyone can read its public register, and with Lace a member can join it by address and act on it (record a meeting, open their own passbook, prove at least N shares, call sunset). The live write path is wired and unit-tested with a mocked Lace, but has not been run against Preprod yet (see Known limits).

The simulator makes no zero-knowledge proofs, so the proving skeletons stay up for a short fixed time and say so. Once real proof times are measured on Preprod they appear in those notes (see [PREPROD.md](PREPROD.md)).

## Architecture

```
contract/   undying.compact (8 circuits, Compact 0.31.1) + witnesses + a no-wallet simulator + 20 unit tests
ui/         React 19 + Vite. src/demo: DemoEngine (simulator), fee-key model, measured.ts
            src/beats: the six beats; src/a2: paper, stamps, pen and motion; src/pages: fee key, Terms, Privacy
            src/lace: the Preprod live page: public register, then Lace write-through (LiveSession,
            LiveWrite). Lazy-loaded: the demo never ships Midnight.js; the write path loads after Lace connects
chain/      Preprod wiring: Midnight.js 4.1.1 deploy/join/call, Lace connect/check/providers (payFees:false),
            the group fee-key relay, deploy and measure scripts. Preprod via Blockfrost.
e2e/        TesterArmy e2e suite: the six-beat story, the refusals and #/live without Lace, at 390x844 and 430x932
docs/       the static build of ui/ for GitHub Pages (relative paths)
media/      demo.mp4, six screenshots, record-demo.mjs
scripts/    preprod.sh: one command from clone to a measured Preprod deployment
```

```
 member phone (Ama)             secretary phone (Fuseina)            anyone
 ───────────────────            ─────────────────────────            ──────
 private state:                 private state:                       public ledger:
  her key, group secret,         her key, group secret,               member keys, meeting count,
  her own passbook               every passbook                       one commitment per slot,
        │                              │                              heartbeat time, phase,
        │ attestSavings(≥N)            │ recordMeeting(page, 5 entries) fee-key epoch, attestations
        ▼                              ▼                                     ▲
   local proof server ──proof──▶ Midnight (Preprod) ◀──fee in DUST── group fee-key relay
   (localhost:6300)                     │                         (one shared DUST key per group,
                                        └─ sunset(): anyone, after the grace period
```

### The contract (`contract/src/undying.compact`)

The contract was compiled with **Compact toolchain 0.31.1** (`pragma language_version 0.23`) against **compact-runtime 0.16.0**. These are the versions the Preprod and Mainnet support matrix lists. Toolchains 0.34 and 0.35 target ledger 9, which is not live yet.

| Circuit | Who | What it does | k (rows) |
|---|---|---|---|
| `constructor` | NGO / vendor | Creates the group: up to 10 member keys, secretary, maintainer, group-secret tag, first fee-key tag, grace period. Pre-commits all 10 passbooks to zero. | n/a |
| `recordMeeting(page, entries[5])` | secretary | For each of 5 slots: opens the old passbook commitment, applies the entry (shares, social fund, loan issued, loan repaid; no over-repayment allowed) and writes a fresh commitment. **Every slot is re-committed every meeting**, so the chain can’t tell who saved or borrowed. | 14 (11,288) |
| `attestSavings(slot, min, nonce)` | member | Proves "I hold ≥ `min` shares" for a loan officer’s nonce without revealing the amount. | 14 (12,771) |
| `addMember(key)` | secretary | Adds a member (max 10). Works after sunset. | 13 |
| `handoverSecretary(key)` | secretary | Hands the role to a new secretary. Works after sunset. | 13 |
| `adminReplaceSecretary(key)` | maintainer | Replaces a lost secretary. **Disabled after sunset.** | 13 |
| `heartbeat(now)` | maintainer | Proves the maintainer is alive. `now` can’t be in the future (checked with `blockTimeGte`). **Disabled after sunset.** | 13 |
| `sunset()` | **anyone** | Allowed once `lastHeartbeat + grace` has passed. Sets the phase to SUNSET and erases the maintainer key. | 7 |
| `rotateFeeKey(tag)` | secretary | Records the tag of a fresh group DUST key, so member apps switch keys. Works after sunset. | 13 |

The `k` values come from `zkir mock-compile` on the compiled output. All circuits are at k ≤ 14. The first version used `persistentCommit` (SHA-256), which made `recordMeeting` k=17 with 94k rows. Moving the passbook commitments to Poseidon-based `transientCommit` cut it to about one eighth of that. The trade-off is that Compact does not promise transient hashes stay stable across language versions, so a future contract upgrade would have to re-commit the passbooks. Identity keys still use `persistentHash`.

**How a member gets her balance without a server.** At the meeting, the secretary’s phone hands each member’s phone a *stamp*: the plaintext passbook plus its version. The member’s app checks the stamp against the on-chain commitment using the group secret. A secretary who lies is caught immediately, and a secretary whose phone holds a tampered book cannot record at all, because the circuit re-opens every old commitment. This works like stamping a paper passbook, with no operator database.

### Privacy model

| | Who can see it |
|---|---|
| Amounts (shares, social fund, loans), names, all secrets | **Never on-chain.** Amounts are private circuit inputs and leave the device only inside a hiding commitment. |
| Each member’s own passbook | That member’s phone (PIN-locked app). The app sends no SMS. |
| Every passbook | The secretary’s phone. Shares are counted aloud at a real VSLA meeting too, so the group already knows them. |
| Group size, slot numbers, number of meetings, commitments, heartbeat time, sunset phase, fee-key epoch/tag, "≥ N shares" attestations (by slot) | Public. |

Two known leaks are accepted:
- An attestation reveals which slot (a pseudonym) made it.
- The group size is public.

The unit tests check the raw public state. They search the ledger and every public transcript for the exact amounts recorded and for every secret, and they show that two groups with very different balances produce public state of the same shape.

### The group fee key ("Group Commons")

- There is **one DUST key per group**, not one global public key, and it is kept inside the members’ app. If the key were public to the whole world, anyone could drain the regenerating DUST at no cost to themselves (see the risks below).
- **The NGO endows the key once** by registering NIGHT for DUST generation to the key’s DUST address. Relatives can add capacity by **designating** their NIGHT’s DUST to the same address.
- **Anyone in the group can run the relay** (`chain/src/relay/fee-key-relay.ts`). It starts a DUST wallet from the group key with `DustWallet(...).startWithSecretKey(...)`, adds the DUST fee to a member’s bound transaction (`balanceFinalizedTransaction(tx, …, { tokenKindsToBalance: ['dust'] })`, the same flow as `sponsorAndSubmit` in example-private-party) and submits it. It refuses anything that is not a call to this group’s contract.
- **Members sign with Lace** in `payFees: false` mode (`chain/src/browser.ts`, copied from example-bboard), or with a burner wallet. Either way they hold 0 DUST.

## Run it

Requires Node 22+.

```bash
npm ci
npm test                      # 20 contract tests + 2 demo-story tests + 28 live-wiring tests (vitest)
npm run typecheck             # contract, ui, chain
npm run dev                   # the demo at http://localhost:5173
npm run build                 # static build -> ui/dist, copied to docs/
npm run test:e2e              # e2e suite against docs/ (cd e2e && npm ci first; see e2e/README.md)
```

Recompile the contract. Proving keys are not committed; `compact compile` regenerates them:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1         # pin it: 0.34/0.35 target ledger 9, which is not live
npm run compact               # -> contract/src/managed/undying (contract/, zkir/, keys/)
```

### Tests

| Suite | Count | What |
|---|---|---|
| `contract/src/test/undying.test.ts` | 20 | every circuit, every refusal, raw public state searched for amounts and secrets, two groups with different balances have identically shaped public state |
| `ui/src/demo/__tests__/engine.test.ts` | 2 | the demo story end to end on the engine; a leaked key drains fees but not the book, rotation recovers |
| `ui/src/lace/__tests__/live-session.test.ts` | 28 | the Lace write path with a mocked `window.midnight` (dApp connector 4.0.1) and mocked Midnight.js providers: connect, network and prover checks, join by address, record meeting through the fee-key relay (`payFees: false`) or with Lace paying, own passbook and stamps checked with the real `passbookCommitment`, proof, sunset, and every error message |
| `e2e/tests/live.e2e.ts` | 1 per phone size | `#/live` loads from the static build and says there is no Lace wallet; no write controls without one |
| `e2e/tests/demo-flow.e2e.ts` | 4 per phone size | the six-beat story in a real browser, the refusals, Terms/Privacy/fee key, no console errors; plus an agentic smoke test that runs only with a model key |

### Deploying the demo

`docs/` is the built app with relative paths. Either set **Settings → Pages → Deploy from a branch → `main` / `/docs`**, or choose **GitHub Actions** as the Pages source and let `.github/workflows/pages.yml` publish `docs/` on every push to `main`.

### Preprod

See **[PREPROD.md](PREPROD.md)** and `scripts/preprod.sh`: Docker proof server, Lace and the faucet, DUST registration, deploy, connecting the UI, and measuring the real fee and proof times so the UI can drop its 1 DUST placeholder. Preprod’s indexer and RPC moved to Blockfrost on 9 October 2026 and now need a project token.

## Known limits

- **Not yet run on Preprod.** `chain/` (deploy, measure, Lace providers, fee-key relay) and the live page, including its write path, are **typechecked but have never been executed against a network**. The build machine had no Docker, no Lace and no tNIGHT. The browser write path is covered by unit tests with a mocked Lace and mocked providers, which prove the wiring and the error paths, not that Lace, the proof server, the indexer or the relay behave like the mocks. Open questions:
  - Does Lace honour `balanceUnsealedTransaction(tx, { payFees: false })`? The API type has it; wallet behaviour is unconfirmed. If Lace refuses, the page says “Lace would not balance this call without paying the fee itself (payFees: false)” and offers to let Lace pay from the member’s own DUST. If Lace accepts but still adds its own fee, nothing on the page can tell; the relay would then add a second fee. Checking the balanced transaction’s fee before relaying is open work.
  - Will the relay accept what Lace returns? `balanceUnsealedTransaction` gives back a finalized transaction and the relay re-balances it with `balanceFinalizedTransaction` for DUST only. That pairing has not been exercised.
  - Does `levelPrivateStateProvider` (IndexedDB through `browser-level`) work in the Vite build in a real browser? It is bundled and typechecked; it was never opened in a browser here.
  - Does a DUST wallet started from a bare secret key sync fast enough? A first Preprod sync from genesis takes over an hour.
  - No real proof has been generated. The k values are from `zkir mock-compile`, not timed proofs.
  - Can a browser call Blockfrost directly with a pasted token (CORS)? Untested with a valid token.
- **The fee has not been measured.** The demo charges a **1 DUST placeholder** per transaction and says so on screen. Cap (5 DUST per NIGHT) and refill (about a week) follow the published parameters. The pitch line “a one-off ~US$0.50 to 4.50 per group against VSLA.online’s US$10/month” depends on two numbers still to measure: the DUST fee per call and the NIGHT price. `scripts/preprod.sh measure --apply` replaces the placeholder.
- **The six beats drive the simulator; Preprod writes live on `#/live`.** The live page joins a deployed group by address with the member’s secrets (from `.preprod/group.json`; in a real group they arrive by QR) and calls the real circuits through `chain/src/api.ts`: `recordMeeting` (secretary), `attestSavings` (member), `sunset` (anyone). A member’s passbook stays in browser private state, encrypted with a passphrase; after each meeting the secretary hands out one-line stamps, which the member’s phone checks against the sealed commitment before keeping. The beats themselves are not wired to Preprod, and the private state written by the Node deploy script does not carry over to the browser, so a secretary who wants to record on an older group must import the stamps first.
- **Fee-drain risk.** Anyone holding the group key can spend its DUST on junk transactions as fast as it regenerates. That is a denial of service, not a theft. Mitigations: one key per group kept inside the members’ app, a relay that sponsors only this group’s circuits, an endowment split across several NIGHT UTXOs (relays sharing a key can hit `DustDoubleSpend`, error 196, and must retry), and early rotation (a new key starts at zero DUST).
- **The guarantee is social, not locked.** The NGO can revoke its DUST registration at any time, and the protocol reserves the right to change DUST rules.
- **No contract upgrade path at sunset.** Handing maintenance authority to the group at sunset is future work.
- **Time, not blocks.** The heartbeat window is in seconds of block time (90 s in the demo, 7 days by default on deploy).
- **Up to 10 members per contract**, recorded as 2 pages of 5. Real VSLAs have 15 to 30 members.
- **Transient commitments.** Passbooks use Poseidon `transientCommit` (k=14 instead of 17), which Compact does not promise to keep stable across language versions; a future upgrade would re-commit the passbooks.
- **Design:** the handwriting face (Reenie Beanie) is used only for short notes; none of the faces has a ₵ glyph, so the cedi is drawn as a C with a stroke and read out as ₵ by screen readers.

## Attribution

Apache-2.0. This project adapts code and patterns from two official Midnight examples. Both are Apache-2.0, Copyright (C) Midnight Foundation, and each adapted file says what was taken:

- [midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard): the simulator test pattern, the witness layout, the Lace dApp-connector providers and the Vite WASM configuration.
- [midnightntwrk/example-private-party](https://github.com/midnightntwrk/example-private-party): the DUST sponsorship flow and service, `wallet.ts` and `config.ts`.

See `NOTICE`.
