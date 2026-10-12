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
| `media/` | launch-wide.mp4 and launch-tall.mp4 (54 s, `media/launch/make.sh`), demo.mp4 (82 s, cash-box UI), demo-narrated.mp4 (82 s; the synthetic en-NG voice from the earlier cut, edge-tts `en-NG-EzinneNeural`, re-timed to the new beats), demo.srt, screens/, live/, strip.jpg, record-demo.mjs |
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

## Status (12 Oct 2026, evening, HEAD on main)

**Ran on Midnight Preprod (12 Oct 2026, cloud session, wallet SDK from Node, no Lace)**
- register-dust self `008d6278…ab357c7`; deploy `e95e3769…f3bef5`, contract `726bb6e0ce9d67ecc5c587a2f5f509ae39c26dbfd29d71c75f8d7de090ed7c61` (block 2,949,765, 300 s grace); endow transfer `00d7c29c…243b91` and NGO registration `008b8744…281bc6` to the fee key's DUST address.
- Through the relay, a caller holding 0 DUST before and after: `recordMeeting` `abbb61e7…1becc5` (block 2,950,140) and `attestSavings` `c40214ef…06e320` (block 2,950,145). Fee 1 SPECK each (the key spent 1,001 with the SDK's 1,000 overhead). Proofs 3.9 s and 3.8 s. Full hashes in README, `ui/src/demo/preprod.ts` and `.preprod/` (gitignored).
- `measure --apply` filled `ui/src/demo/measured.ts` and `preprod.ts`; `#/live` shows the run with explorer links (`preprod.midnightexplorer.com/transactions/<hash>`, `/contracts/<address>`) and no token.

**Still only tested with mocks**
- Lace: `payFees:false`, Lace's finalized transaction into the relay, `levelPrivateStateProvider` in a real browser, browser Blockfrost CORS with a valid token. Needs Lace on Preprod with a throwaway wallet; the owner has to do this or drive it.
- `heartbeat` on Preprod. (`sunset` ran: `76cadb73…3fd0f9`, block 2,950,326, by a 0-DUST member through the relay, `npm run sunset:preprod -w chain`. The group is in SUNSET; after it, `recordMeeting` `ec0e88f8…57c99a` (block 2,950,410) and `attestSavings` `288b0711…d6fc55` (block 2,950,415) ran through the relay with 0 DUST.)

**Done and verified in the cloud session**
- 50 unit tests, typecheck, e2e 8 passed / 2 agentic skipped at 390 and 430 (e2e needs Node >= 22.22.3; the container has 22.22.0, so a Node 24 tarball was used).
- UI rebuilt as the cash box (owner's choice); launch video `media/launch-wide.mp4` and `-tall.mp4` (54 s, `media/launch/make.sh`, ends on the Preprod record in `#/live`); demo.mp4 and the narrated cut (82 s; narration re-timed to the new beats). All re-rendered after the measurement, so receipts show 1 SPECK.
- Proving keys ship in `docs/zk/` so `#/live` can prove from Pages.

**Container notes (cloud)**
- Start `dockerd`; compactc 0.31.1 from the release zip (a `compact` shim wraps it); Docker Hub rate-limits, so pull `mirror.gcr.io/midnightntwrk/proof-server:8.1.0` and tag it; the proof server needs the compose override (host network, CA bundle, proxy env).
- Wallet sync from genesis ~1 h 45 min per wallet, CPU-bound: `npm run sync-wallets -w chain -- <wallet>`, one process each, with run_in_background (2 h cap); state saves to `.preprod/wallet-state` every 3 min; a restore costs ~6.5 min CPU.
- Blockfrost closes websockets often; `submitWithRetry` handles it. testkit logs the token unless `chain/src/logger.ts` is imported (it is, in every script).
- Never use `pkill -f <pattern>` in a tool command: it matches the tool's own shell.

**Next steps, in order**
3. Lace `payFees:false` run (owner): PREPROD.md step 9.
4. Deck: the fee slide (still "~1 wk", no measured fee) gets the measured numbers; source is outside this repo.
5. The owner rotates the Blockfrost token (it was printed once in a session log before the redaction fix).
6. The owner submits on AKINDO personally. **Do not submit, post publicly, or spend money without the owner's explicit yes.** Aim for 17 Oct.

## Design rules (the owner's standing rules; do not drift)

The UI is the **cash box** concept (chosen by the owner on 12 Oct 2026 over the earlier "A2 Passbook"): the VSLA's tin box with three padlocks, emerald (#0E5A43) and saffron (#F4B23A) on cream, huge condensed Archivo numbers (variable width, `font-stretch` 62%), Schibsted Grotesk for text, brass key tags, coins for shares, round seals. Art and motion live in `ui/src/box/`. Every animation follows a real action: coins drop in and locks click shut on a recorded meeting, her lock opens on her phone, all locks rattle on a refused open, the vendor's red lock falls off at sunset, the fee tank drains by the fee, the proof note rises from the slot (and drops back on a refusal). Numbers stay level. Fonts are self-hosted.

Rounded iOS-style pills and sheets are allowed in the cash-box design (the owner approved this; the old 4px cap applied to the passbook). Hard bans: harsh gradients, Lucide icons, pure white backgrounds, rainbow colours, drop shadows, three feature cards in a row, emoji, liquid glass, em dashes in copy, Inter, Geist or Space Grotesk, coloured left stripes, fake testimonials, bento grids, terminal windows, "It's not X, it's Y" phrasing, checkmark bullets, three pricing tiers, purple and black, radial orbs, dot grids, sparkle icons, animated arrows, hover animations, neon, basic pastels. No brutalist or terminal themes, nothing cartoony.

Always include: a real product demo, skeleton loaders, and Terms and Privacy links. Motion has to mean something, tied to real actions. Tap targets are 44px or more. Wrap hover styles in `(hover: hover) and (pointer: fine)`. Use `tabular-nums` on numbers that change, keep focus rings visible, and meet WCAG AA contrast.

Process for UI changes: render at 390 and 430 wide, look at the renders, critique for AI tells, then fix. Audit the CSS against vojtaholik/good-css. Keep unit and e2e tests green.

## Working style the owner wants
- For build work (code, fixes, renders, pushes to this repo), act without asking and send a short note when starting.
- Be honest about what was and wasn't verified, and separate "tested with mocks" from "ran on Preprod".
- Plain, specific copy. No hype.
