# CLAUDE.md: working notes for agents continuing Undying Ledger

Claude Code reads this first. It covers what the project is, why it is built this way, what has been verified, and what is left. README.md is for the public and judges; PREPROD.md is the network runbook.

## What this is

Undying Ledger is a private record book for a village savings and loan association (VSLA, also called a susu group or savings group), built on Midnight for the **AKINDO Midnight Buildathon, Wave 2**.

- **Problem (evidence in README):** NGO-funded VSLA apps turn into paid subscriptions when the grant ends (hiveonline, $10 a month per group), or stop being used (Jamii.one: about 15% of groups still recording 3 months after donor money ended). Women often save in secret, and digital records have exposed them to husbands on shared phones (PCI/DreamSave, Tanzania).
- **Answer:** the group's book is a Midnight contract.
  - Fees are paid by a **group fee key**, a DUST key shared inside the group. A relay any member can run adds the fee, so members hold no crypto.
  - Balances are shielded, so a passbook can be opened only by its owner.
  - `heartbeat` and `sunset` let the book keep running with no operator after the NGO or vendor is gone.
  - `attestSavings` proves "I hold at least N shares" for loans or KYC without showing the balance.
- **Honest limit:** this removes the running cost and the vendor dependency. It does not fix the end of field-promoter stipends, which Jamii.one names as the main cause.

## Repo map

| Path | What |
|---|---|
| `contract/src/undying.compact` | Compact contract with 8 circuits: recordMeeting, attestSavings, addMember, handoverSecretary, adminReplaceSecretary, heartbeat, sunset, rotateFeeKey |
| `contract/src/test/` | 20 contract tests (simulator) |
| `contract/src/managed/` | compactc output (keys/ is gitignored and regenerated with `npm run compact`) |
| `chain/src/` | Midnight.js 4.1.1 wiring: config.ts (Blockfrost Preprod), api.ts, browser.ts (Lace connect, check and build; `payFees:false` plus the relay), wallet.ts, scripts/deploy.ts, scripts/measure.ts, relay/fee-key-relay.ts |
| `chain/compose.yml` | proof server (`midnightntwrk/proof-server:8.1.0`) |
| `ui/` | Vite + React app. A six-beat demo story (`ui/src/beats`, `ui/src/box` cash-box art and motion; `ui/src/a2` keeps the shared motion helpers) runs the real compiled circuits in the browser with no wallet. `#/live` is the Lace write path (`ui/src/lace/live-session.ts`, `LiveWrite.tsx`). `#/live?fake=1` is a dev-only fake session that is stripped from the production build. |
| `ui/src/demo/measured.ts` | Measured fee and proof time. Null until Preprod runs; `ui/scripts/set-measured.mjs` writes it. While it is null the UI says "placeholder". |
| `e2e/` | tester.army e2e suite (six-beat story, refusals, legal links, console errors, `#/live` smoke) |
| `docs/` | Production build. Pages serves the `gh-pages` branch, which `.github/workflows/pages.yml` keeps equal to `docs/`. |
| `media/` | demo.mp4 (84s, cash-box UI), demo-narrated.mp4 (84s; the synthetic en-NG voice from the earlier cut, edge-tts `en-NG-EzinneNeural`, re-timed to the new beats), demo.srt, screens/, live/, strip.jpg, record-demo.mjs |
| `scripts/preprod.sh` | One-command Preprod run: `check \| up \| deploy \| measure [--apply] \| down` |

## Commands

```bash
npm ci
npm run compact      # compactc 0.31.1 (pinned; 0.34+ targets ledger 9 and cannot deploy to Preprod)
npm test             # 20 contract + 30 ui = 50 passing
npm run typecheck    # contract, ui, chain
npm run build        # ui/dist -> docs/ (commit docs/ so Pages updates)
npm run dev          # local; open #/live?fake=1 for the fake joined session
npm run test:e2e     # needs Chromium; E2E_CDP can attach to an existing browser
```

Pinned versions (Preprod support matrix, 9 Oct 2026): Compact 0.31.1, compact-runtime 0.16.0, Midnight.js 4.1.1, DApp Connector API 4.0.1, Wallet SDK 1.2.0, proof server 8.1.0. Midnight retired its own Preprod indexer and RPC on 9 Oct 2026, so every Preprod call now goes through **Blockfrost** (`BLOCKFROST_PROJECT_ID`, starts with `nightpreprod`).

## Status (12 Oct 2026, HEAD on main)

**Done and verified on the build machine**
- The contract compiles; 50 unit tests pass; typecheck and the production build are clean.
- e2e: 8 passed, 2 skipped (the agentic tests need a model key) at 390x844 and 430x932.
- The live demo is up at https://nice-bills.github.io/undying-ledger/.
- The repo is public, Apache-2.0, with the `midnightntwrk` topic.
- Pitch deck: 14 slides, on Google Slides (owner has the link). The source is outside this repo; see the handoff zip.
- Narrated walkthrough video and captions are in `media/`.

**Never run (the biggest gap)**
- Anything on Preprod: deploy.ts, measure.ts, the fee-key relay, Lace with `payFees:false`, the relay accepting Lace's finalized transaction, `levelPrivateStateProvider` (IndexedDB) in a real browser, real proof times and fees.
- The `#/live` write path has only been tested with a mocked Lace and mocked providers, plus the fake session. Say this plainly anywhere it comes up; never claim it works on-chain.
- Running it needs Docker, a Blockfrost Preprod token, Lace on Preprod with a throwaway wallet, faucet tNIGHT, Generate tDUST, then `scripts/preprod.sh` and `measure --apply`, rebuild, and commit docs/. PREPROD.md has every step.

**Written 12 Oct without a machine (not typechecked, not run; npm registry was unreachable)**
- Relay logs the fee key's DUST address and returns it from `GET /health`; deploy writes it to `.preprod/group.json` as `groupFeeKeyDustAddress`. Uses `DustAddress.encodePublicKey` from wallet-sdk 1.2.0 and `DustSecretKey.publicKey`.
- Relay refuses a call whose intents already carry DUST spends (`intent.dustActions.spends`), so a fee is never paid twice.
- README: endowment paragraph at the top, Wave 3 roadmap. Deck spec (`make_spec.py`, project docs) reordered to lead with the endowment, with a Wave 3 slide and a `MEASURED` block to fill after Preprod.
- Run `npm run typecheck && npm test` first on the laptop. If the relay commit breaks, revert it alone.

**12 Oct, cloud session (no Lace)**
- Verified: 895dadd typechecks and 50 tests pass. compactc 0.31.1 compiles the contract to the same committed output (keys regenerated). Proof server 8.1.0 healthy on :6300.
- Written and typechecked, not yet run on Preprod: `chain/src/scripts/register-dust.ts` (`self`: deployer NIGHT to its own DUST; `endow`: deployer sends half its NIGHT to an NGO key, which registers it to `groupFeeKeyDustAddress`), `addresses.ts` (public addresses only), and `RELAY_URL`/`CALLER_SEED` relay mode in measure.ts.
- Order on Preprod: seeds into `.preprod/wallets.env` (mode 600; DEPLOYER_SEED, NGO_SEED, CALLER_SEED, never printed) -> `npm run addresses -w chain` -> faucet to the deployer -> `register-dust self` -> `GRACE_SECONDS=300 scripts/preprod.sh deploy` -> `register-dust endow` -> relay -> `RELAY_URL=http://localhost:3001 scripts/preprod.sh measure --apply`.
- Cloud container workarounds: start `dockerd` yourself; `compact update` fails behind the proxy, so download `https://github.com/midnightntwrk/compact/releases/download/compactc-v0.31.1/compactc_v0.31.1_x86_64-unknown-linux-musl.zip` and run its `compactc src/undying.compact ./src/managed/undying` from `contract/`; the proof server needs a compose override with `network_mode: host`, `ports: !reset []`, `/root/.ccr/ca-bundle.crt` mounted as `/etc/ssl/certs/ca-certificates.crt`, `SSL_CERT_FILE` and `HTTPS_PROXY` set, or it cannot fetch its parameters.

**Ranked plan to win (rubric: Eng 40, QA 15, Product 15, UX 15, Comms 10, Biz 5)**
1. Preprod deploy with contract address and tx hashes in the README.
2. A recordMeeting paid by the group fee key, with the member at 0 DUST. Register tNIGHT to `groupFeeKeyDustAddress` first.
3. If Lace rejects `payFees:false`: a burner key in the member app that the relay balances.
4. Serve the proving keys from Pages so `#/live` can write from the public link (today they exist only under `npm run dev`).
5. Re-record the video with one real on-chain write and the explorer view of that transaction.

**Next steps, in order**
1. Run Preprod (PREPROD.md). Fix whatever breaks in chain/ and the relay. Then run `measure --apply` so the UI shows real numbers instead of placeholders, rebuild docs/, and push.
2. Once Preprod works, update the README "Not yet run" section, the deck slide on fees (slide 9 still says "~1 wk" and the fee label lacks "placeholder"), and the video if the live flow is shown.
3. Optional: record a real Lace on-screen run for the video.
4. The owner submits on AKINDO personally (Discord and Telegram IDs, an ETH address). **Do not submit, post publicly, or spend money without the owner's explicit yes.** The deadline is unclear (page says 17 Oct 2026, API says 19 Oct 2026 15:00 GMT), so aim for 17 Oct.

## Design rules (the owner's standing rules; do not drift)

The UI is the **cash box** concept (chosen by the owner on 12 Oct 2026 over the earlier "A2 Passbook"): the VSLA's tin box with three padlocks, emerald (#0E5A43) and saffron (#F4B23A) on cream, huge condensed Archivo numbers (variable width, `font-stretch` 62%), Schibsted Grotesk for text, brass key tags, coins for shares, round seals. Art and motion live in `ui/src/box/`. Every animation follows a real action: coins drop in and locks click shut on a recorded meeting, her lock opens on her phone, all locks rattle on a refused open, the vendor's red lock falls off at sunset, the fee tank drains by the fee, the proof note rises from the slot (and drops back on a refusal). Numbers stay level. Fonts are self-hosted.

Rounded iOS-style pills and sheets are allowed in the cash-box design (the owner approved this; the old 4px cap applied to the passbook). Hard bans: harsh gradients, Lucide icons, pure white backgrounds, rainbow colours, drop shadows, three feature cards in a row, emoji, liquid glass, em dashes in copy, Inter, Geist or Space Grotesk, coloured left stripes, fake testimonials, bento grids, terminal windows, "It's not X, it's Y" phrasing, checkmark bullets, three pricing tiers, purple and black, radial orbs, dot grids, sparkle icons, animated arrows, hover animations, neon, basic pastels. No brutalist or terminal themes, nothing cartoony.

Always include: a real product demo, skeleton loaders, and Terms and Privacy links. Motion has to mean something, tied to real actions. Tap targets are 44px or more. Wrap hover styles in `(hover: hover) and (pointer: fine)`. Use `tabular-nums` on numbers that change, keep focus rings visible, and meet WCAG AA contrast.

Process for UI changes: render at 390 and 430 wide, look at the renders, critique for AI tells, then fix. Audit the CSS against vojtaholik/good-css. Keep unit and e2e tests green.

## Working style the owner wants
- For build work (code, fixes, renders, pushes to this repo), act without asking and send a short note when starting.
- Be honest about what was and wasn't verified, and separate "tested with mocks" from "ran on Preprod".
- Plain, specific copy. No hype.
