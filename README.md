# Undying Ledger

**The savings-group book that can’t be switched off when the grant ends.**

Undying Ledger is a private record book for village savings and loan associations (VSLAs, also called susu groups or savings groups), built on [Midnight](https://midnight.network). It keeps working after the NGO grant and the app vendor are gone. Members hold no crypto and pay nothing. Their balances are hidden from outsiders, including a spouse who shares the household phone.

Built for the AKINDO Midnight Buildathon, Wave 2.

> **Try it:** open `docs/index.html` from this repo through any static server (`npx serve docs`), or enable GitHub Pages on `main` → `/docs`. The demo runs the **real compiled Compact circuits** in your browser through `@midnight-ntwrk/compact-runtime`. It needs no wallet, no network and no tokens.

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

## What is in this repo

```
contract/   undying.compact (8 circuits) + witnesses + a no-wallet simulator + 20 unit tests
ui/         React + Vite demo (simulator mode, no wallet), mobile-friendly; 2 story tests
chain/      Preprod wiring: Midnight.js 4.1.1 deploy/join/call, Lace connector (copied from
            example-bboard), and the group fee-key relay (adapted from example-private-party)
docs/       the static build of ui/ (GitHub Pages / IPFS-ready)
```

### The contract (`contract/src/undying.compact`)

The contract was compiled with **Compact toolchain 0.31.1** (`pragma language_version 0.23`) against **compact-runtime 0.16.0**. These are the versions the Preprod and Mainnet support matrix lists. Toolchains 0.34 and 0.35 target ledger 9, which is not live yet.

| Circuit | Who | What it does | k (rows) |
|---|---|---|---|
| `constructor` | NGO / vendor | Creates the group: up to 10 member keys, secretary, maintainer, group-secret tag, first fee-key tag, grace period. Pre-commits all 10 passbooks to zero. | – |
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
npm install
npm test                      # 20 contract tests + 2 end-to-end demo-story tests
npm run dev                   # simulator demo at http://localhost:5173
npm run build                 # static build -> ui/dist (copied to docs/)
```

Recompile the contract. Proving keys are not committed; `compact compile` regenerates them:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1         # pin it: 0.34/0.35 target ledger 9, which is not live
npm run compact               # -> contract/src/managed/undying (contract/, zkir/, keys/)
```

### The demo (about 60 seconds)

1. **Kpalsi Women’s Group, Tamale**: 5 members, 11 meetings already in the book. The status bar shows "fees paid by group fee key #1" and "members’ own DUST: 0".
2. **Secretary** records meeting #12 (shares, social fund, a loan, repayments). The runtime executes the real `recordMeeting` circuit.
3. **Ama’s phone** shows her passbook and every stamp, each verified against the ledger. She can prove "≥ 10 shares" to a loan officer.
4. **Husband’s phone / public explorer** shows no SMS and only public state: commitments, counts and phase. "Try to open slot 0 without the group secret" fails.
5. **Grant ends**: the vendor’s heartbeats stop. Trying `sunset()` early is rejected by the contract. After 90 s (or "Skip"), **anyone** calls `sunset()`.
6. **Meeting #13 still records**, with the fee paid from the group fee key.
7. Fee-key panel:
   - A relative points their DUST at the key.
   - "Key copied: burn fees" drains the meter. The book can’t be written and no value moves.
   - "Fast-forward 1 day" refills the key.
   - "Rotate fee key" starts a fresh key, which fills from zero.

## Honest limitations

- **Not yet run on Preprod.** The `chain/` package (deploy script, Lace providers, fee-key relay) is **typechecked against Midnight.js 4.1.1, dapp-connector-api 4.0.1 and wallet-sdk 1.2.0, but not executed**. The build machine had no Docker (so no proof server), no Lace and no tNIGHT. These are still open:
  - Does Lace 1.36.x honour `balanceUnsealedTransaction(tx, { payFees: false })`? The API type has it, but the wallet behaviour is unconfirmed.
  - Does a DUST wallet started from a bare secret key sync fast enough in practice? Community reports range from about 78 minutes from genesis to about 29 s from a snapshot.
  - No real proof has been generated. The k values are from `zkir mock-compile`, not from timed proofs.
- **The fee cost has not been measured.** The demo’s **1 DUST per transaction is a placeholder**. Cap (5 DUST per NIGHT) and refill (about one week to cap) follow the published protocol parameters. The pitch line "a one-off ~US$0.50–4.50 per group against VSLA.online’s US$10/month" depends on two numbers that must be measured on Preprod first: the DUST fee per call and the NIGHT price.
- **Fee-drain risk.** Anyone holding the group key can spend its DUST on junk transactions as fast as it regenerates. That is a denial of service on the group, not a theft. Mitigations:
  - **Scope:** one key per group, shared only inside the members’ app, never published.
  - **Relay policy:** the relay sponsors only this group’s circuits.
  - **Redundancy:** split the endowment across several NIGHT UTXOs. One fee locks one DUST UTXO until confirmation, and relays sharing a key can hit `DustDoubleSpend` (error 196) and must retry.
  - **Rotation:** supporters re-designate to a new key, and `rotateFeeKey` records it. A new key starts at **zero** DUST and takes about a week to fill, so rotate early.
- **The guarantee is social, not locked.** The NGO can revoke its DUST registration at any time, and the protocol reserves the right to change DUST rules. The endowment is transparent and redesignatable, but it is not a trust fund.
- **No contract upgrade path at sunset.** Handing the contract maintenance authority to the group at sunset is future work.
- **Time, not blocks.** Midnight exposes block *time* to circuits, so the heartbeat window is measured in seconds (the demo uses 90 s; the deploy script defaults to 7 days).
- **Up to 10 members per contract in this version**, recorded as 2 pages of 5. Real VSLAs have 15–30 members; raising the limit means more pages or a larger page with k=15.
- The simulator does not generate proofs, so speed in the demo is not speed on-chain. Other projects measured about 18 s per proven, finalised transaction on devnet; that is unverified for this contract.

## Remaining steps on a developer machine (Preprod)

1. Install Docker and start the proof server: `docker compose -f chain/compose.yml up -d` (image `midnightntwrk/proof-server:8.1.0`, the same as example-private-party).
2. Install the Compact toolchain, run `compact update 0.31.1` and then `npm run compact` to generate the proving keys.
3. Install Lace (Midnight), switch it to **Preprod**, and set its proof server to **Local `http://localhost:6300`**.
4. Get tNIGHT from the faucet: https://midnight-tmnight-preprod.nethermind.dev/
5. Register NIGHT for DUST generation:
   - The deployer registers to its own DUST address, so it can pay for the deploy.
   - Create the **group fee key** seed and register (or redirect) some tNIGHT's DUST to the fee key's DUST address. New DUST starts at zero, so do this early.
6. Deploy: `MIDNIGHT_NETWORK=preprod DEPLOYER_SEED=… npm run deploy:preprod -w chain`.
7. Run the relay: `GROUP_FEE_KEY_SEED=… GROUP_CONTRACT=… MIDNIGHT_NETWORK=preprod npm run relay -w chain`.
8. Measure the DUST fee per circuit and the proof times, then replace `ASSUMED_FEE_DUST` in `ui/src/demo/fees.ts`.

## Attribution

Apache-2.0. This project adapts code and patterns from two official Midnight examples. Both are Apache-2.0, Copyright (C) Midnight Foundation, and each adapted file says what was taken:

- [midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard): the simulator test pattern, the witness layout, the Lace dApp-connector providers and the Vite WASM configuration.
- [midnightntwrk/example-private-party](https://github.com/midnightntwrk/example-private-party): the DUST sponsorship flow and service, `wallet.ts` and `config.ts`.

See `NOTICE`.
