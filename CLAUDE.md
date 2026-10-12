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
| `ui/` | Vite + React app. A six-beat demo story (`ui/src/beats`, `ui/src/a2` design system) runs the real compiled circuits in the browser with no wallet. `#/live` is the Lace write path (`ui/src/lace/live-session.ts`, `LiveWrite.tsx`). `#/live?fake=1` is a dev-only fake session that is stripped from the production build. |
| `ui/src/demo/measured.ts` | Measured fee and proof time. Null until Preprod runs; `ui/scripts/set-measured.mjs` writes it. While it is null the UI says "placeholder". |
| `e2e/` | tester.army e2e suite (six-beat story, refusals, legal links, console errors, `#/live` smoke) |
| `docs/` | Production build. Pages serves the `gh-pages` branch, which `.github/workflows/pages.yml` keeps equal to `docs/`. |
| `media/` | demo.mp4 (61.3s), demo-narrated.mp4 (60.7s, synthetic en-NG voice, edge-tts `en-NG-EzinneNeural`), demo.srt, screens/, live/, strip.jpg, record-demo.mjs |
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

**Next steps, in order**
1. Run Preprod (PREPROD.md). Fix whatever breaks in chain/ and the relay. Then run `measure --apply` so the UI shows real numbers instead of placeholders, rebuild docs/, and push.
2. Once Preprod works, update the README "Not yet run" section, the deck slide on fees (slide 9 still says "~1 wk" and the fee label lacks "placeholder"), and the video if the live flow is shown.
3. Optional: record a real Lace on-screen run for the video.
4. The owner submits on AKINDO personally (Discord and Telegram IDs, an ETH address). **Do not submit, post publicly, or spend money without the owner's explicit yes.** The deadline is unclear (page says 17 Oct 2026, API says 19 Oct 2026 15:00 GMT), so aim for 17 Oct.

## Design rules (the owner's standing rules; do not drift)

The UI is the "A2 Passbook" concept: cloth, paper and ink that change per beat, tilted stamps, tucked-in slips, handwritten pen notes. Numbers always stay level. Fonts are Libre Caslon Text and Display, Schibsted Grotesk, and Reenie Beanie, self-hosted.

Hard bans: harsh gradients, Lucide icons, pure white backgrounds, rainbow colours, drop shadows, three feature cards in a row, emoji, liquid glass, em dashes in copy, Inter, Geist or Space Grotesk, coloured left stripes, fake testimonials, bento grids, terminal windows, "It's not X, it's Y" phrasing, checkmark bullets, three pricing tiers, soft corner radius (keep it at 4px or less), purple and black, radial orbs, dot grids, sparkle icons, animated arrows, hover animations, neon, basic pastels. No brutalist or terminal themes, nothing cartoony.

Always include: a real product demo, skeleton loaders, and Terms and Privacy links. Motion has to mean something, tied to real actions. Tap targets are 44px or more. Wrap hover styles in `(hover: hover) and (pointer: fine)`. Use `tabular-nums` on numbers that change, keep focus rings visible, and meet WCAG AA contrast.

Process for UI changes: render at 390 and 430 wide, look at the renders, critique for AI tells, then fix. Audit the CSS against vojtaholik/good-css. Keep unit and e2e tests green.

## Working style the owner wants
- For build work (code, fixes, renders, pushes to this repo), act without asking and send a short note when starting.
- Be honest about what was and wasn't verified, and separate "tested with mocks" from "ran on Preprod".
- Plain, specific copy. No hype.
