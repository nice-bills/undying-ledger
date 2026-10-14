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
| `contract/src/undying.compact` | Compact contract with 9 circuits: recordMeeting, attestSavings, addMember, handoverSecretary, voteSecretary, adminReplaceSecretary, heartbeat, sunset, rotateFeeKey; up to 30 members |
| `contract/src/test/` | 25 contract tests (simulator) |
| `contract/src/managed/` | compactc output (keys/ is gitignored and regenerated with `npm run compact`) |
| `chain/src/` | Midnight.js 4.1.1 wiring: config.ts (Blockfrost Preprod), api.ts, browser.ts (Lace connect, check and build; `payFees:false` plus the relay), wallet.ts, scripts/deploy.ts, scripts/measure.ts, relay/fee-key-relay.ts |
| `chain/compose.yml` | proof server (`midnightntwrk/proof-server:8.1.0`) |
| `ui/` | Vite + React app. A six-beat demo story (`ui/src/beats`, `ui/src/box` cash-box art and motion; `ui/src/a2` keeps the shared motion helpers) runs the real compiled circuits in the browser with no wallet. `#/live` is the Lace write path (`ui/src/lace/live-session.ts`, `LiveWrite.tsx`). `#/live?fake=1` is a dev-only fake session that is stripped from the production build. |
| `ui/src/landing/` | The front door at the root URL (`#/`): cash-box hero (coins in, locks shut, the real 1 SPECK receipt), the problem, what it does, the Preprod record. Loads no circuits; `main.tsx` lazy-loads the app for `#/demo`, `#/live` and the legal pages. Chosen from three mocks in `media/landing-mocks/` (A). |
| `ui/src/demo/measured.ts` | Measured fee and proof time. Null until Preprod runs; `ui/scripts/set-measured.mjs` writes it. While it is null the UI says "placeholder". |
| `e2e/` | tester.army e2e suite (six-beat story, refusals, legal links, console errors, `#/live` smoke) |
| `docs/` | Production build. Pages serves the `gh-pages` branch, which `.github/workflows/pages.yml` keeps equal to `docs/`. |
| `media/` | launch-wide.mp4 and launch-tall.mp4 (57 s, `media/launch/make.sh`, opens on the landing), demo.mp4 (82 s, cash-box UI), demo-narrated.mp4 (82 s; the synthetic en-NG voice from the earlier cut, edge-tts `en-NG-EzinneNeural`, re-timed to the new beats), demo.srt, screens/, live/, strip.jpg, record-demo.mjs |
| `chain/src/invite.ts`, `chain/src/scripts/invites.ts` | Invite links (URL fragment) and the PIN-to-lock derivation; `npm run invites -w chain` prints QR cards to `.preprod/invites.html` |
| `scripts/preprod.sh` | One-command Preprod run: `check \| up \| deploy \| measure [--apply] \| down` |

## Commands

```bash
npm ci
npm run compact      # compactc 0.31.1 (pinned; 0.34+ targets ledger 9 and cannot deploy to Preprod)
npm test             # 25 contract + 43 ui + 5 relay guard + 5 invite = 78 passing
npm run typecheck    # contract, ui, chain
npm run build        # ui/dist -> docs/ (commit docs/ so Pages updates)
npm run dev          # local; open #/live?fake=1 for the fake joined session
npm run test:e2e     # needs Chromium; E2E_CDP can attach to an existing browser
```

Pinned versions (Preprod support matrix, 9 Oct 2026): Compact 0.31.1, compact-runtime 0.16.0, Midnight.js 4.1.1, DApp Connector API 4.0.1, Wallet SDK 1.2.0, proof server 8.1.0. Midnight retired its own Preprod indexer and RPC on 9 Oct 2026, so every Preprod call now goes through **Blockfrost** (`BLOCKFROST_PROJECT_ID`, starts with `nightpreprod`).

## Status (13 Oct 2026 evening, HEAD on main)

**Ran on Midnight Preprod (12 Oct 2026, cloud session, wallet SDK from Node, no Lace)**
- register-dust self `008d6278…ab357c7`; deploy `e95e3769…f3bef5`, contract `726bb6e0ce9d67ecc5c587a2f5f509ae39c26dbfd29d71c75f8d7de090ed7c61` (block 2,949,765, 300 s grace); endow transfer `00d7c29c…243b91` and NGO registration `008b8744…281bc6` to the fee key's DUST address.
- Through the relay, a caller holding 0 DUST before and after: `recordMeeting` `abbb61e7…1becc5` (block 2,950,140) and `attestSavings` `c40214ef…06e320` (block 2,950,145). Fee 1 SPECK each (the key spent 1,001 with the SDK's 1,000 overhead). Proofs 3.9 s and 3.8 s. Full hashes in README, `ui/src/demo/preprod.ts` and `.preprod/` (gitignored).
- `measure --apply` filled `ui/src/demo/measured.ts` and `preprod.ts`; `#/live` shows the run with explorer links (`preprod.midnightexplorer.com/transactions/<hash>`, `/contracts/<address>`) and no token.

**Contract v2 on Preprod (13 Oct 2026, no member wallet)**
- v2 = groups of 30 (pages of 5; the constructor commits only filled pages, addMember commits the next page: committing all 30 at deploy hit "Transaction would exhaust the block limits") + `voteSecretary` (one vote per slot per round, more than half of all members elects; works after sunset).
- Contract `7a89acd2…3c2303`, deploy `1bf5e31a…68b4ce` (block 2,956,697, 300 s grace), secrets in `.preprod/group3.json`. Through the relay with a burner key (`chain/src/burner.ts`: `tx.bind()`, no wallet, no sync): recordMeeting, attestSavings, sunset, 3 votes (elected), recordMeeting by the elected secretary; blocks 2,956,754 to 2,956,788; fees 1 SPECK (one vote reads 0). `npm run burner:preprod -w chain`, output `.preprod/burner-run.json`, shown on `#/live` (`PREPROD_RUN.v2`).
- Relay spend guard (`chain/src/relay/guard.ts`) ran live: `/health` counted the 7 calls.
- Cheap phone (`scripts/cheap-phone.mjs`, `media/cheap-phone.json`, against Pages, 13 Oct after the landing and the ledger cache): 6x CPU + slow 4G: landing usable 2.8 s (no wasm), tap to meeting 12 ready 16 s, recordMeeting 8.4 s and attestSavings 6.1 s tap to result (2.6 / 3.4 s of that is the on-screen minimum); 3G: landing 4.4 s, demo 23 s. The engine caches the ledger view per transaction: the 1 s demo clock re-rendering every beat had cost ~14% idle CPU and tripled circuit times on the slow profile.

**Lace on Preprod (13 Oct 2026, owner's laptop: Arch, Chromium 154, a new Lace wallet with 0 tDUST, local proof server)**
- Own v2 group `2e196521…c20e5da` (deploy `1de57abe…25c7dbba`, 18:04 UTC, 1 h grace), its relay on :3001. Secrets in the laptop's `.preprod/group.json` (not in the cloud container).
- Through `#/live` with Lace (`payFees: false`, relay adds the fee): secretary `recordMeeting` `625e2fe2…663f8186` (block 2,968,251) and member 0 `attestSavings` `6703d63b…1b75dee1` (block 2,968,385), 1 SPECK each, `SUCCESS`. So Lace honours `payFees:false` and the relay's `balanceFinalizedTransaction` accepts Lace's transaction. Shown on `#/live` (`PREPROD_RUN.lace`) and as a fifth line on the landing.
- Bugs it found, fixed with tests: `Buffer is not defined` (Lace's Bech32m keys go through `wallet-sdk-address-format`, which uses a bare `Buffer`; `ui/src/lace/buffer-shim.ts`); the first Join's providers were cached with its passbook lock; a lock different from the browser store's first one failed with an empty AES-GCM `OperationError` (blank error line); `findDeployedContract` had no timeout (90 s now). The page now logs a failed action's error and cause.
- Owner feedback: about 70 s from Sign to stamps on `recordMeeting` (not split by stage), and typing contract, secrets and a 16-character lock is too much for members. The owner approved four fixes on 14 Oct and dropped per-stage timing.

**Member join, 14 Oct 2026 (ran on Preprod from headless Chromium, no wallet, group v2 `7a89acd2…`)**
- Invite link (`chain/src/invite.ts`, `#/live?invite=u1.<contract>.<group>.<slot|s>.<own secret>.<relay b64url>`, in the URL fragment, stripped from the address bar on read), QR cards from `npm run invites -w chain` (`.preprod/invites.html`, mode 600), a 6-digit PIN (PBKDF2-SHA256 600k rounds, salted with contract + own secret, becomes a Midnight.js-valid lock; "Use a long lock instead" keeps the old one), "Join as someone else" (`LiveSession.leave()`), and a `sent` stage with the tx id when the relay or Lace returns (the relay answers after `Finalized`; the rest is the indexer).
- `scripts/browser-preprod.mjs` (output `.preprod/browser-run-invite.json`): invite + PIN join, stamp, `attestSavings` `91669b57…ecd178` (block 2,972,000; Sent at 30 s, result at 37 s), `voteSecretary` `bc13d127…eead3` (2,972,005), leave, rejoin with typed secrets and the same PIN opened the same passbook. Fees 1 SPECK (indexer `paidFees`).
- Not tested: scanning a QR card with a real phone; the invite and PIN with Lace (same code path for the lock, not run).

**Still only tested with mocks**
- Lace refusal paths (a wallet that refuses `payFees:false`, or adds its own fee), "Let Lace pay", `sunset` / `voteSecretary` through Lace, Lace on other browsers or phones.
- (Answered 13 Oct: `#/live` "Use without a wallet" ran on Preprod in headless Chromium, `scripts/browser-preprod.mjs`: join, keep stamp, attestSavings `761e7bc2…c9246e` (block 2,956,914), voteSecretary `89a0afbb…3e360e` (2,956,919). So browser Blockfrost CORS, browser private state, and browser to local proof server all work. First run found `Buffer is not defined` in the browser hex helpers, fixed in `chain/src/hex.ts`; the Lace path had the same bug.)
- (`heartbeat` ran on Preprod on 12 Oct: second group `f1c7d8dc…ec3485` (1 h grace, deploy `c0a2ab57…feaf8a`, block 2,955,001), `heartbeat` `4fd7f18c…73d706` (block 2,955,062, 1 SPECK from the vendor's own DUST; the relay does not sponsor admin calls), then a member's `sunset` was refused by the circuit, `npm run heartbeat:preprod -w chain`, secrets in `.preprod/group2.json`. `sunset` ran: `76cadb73…3fd0f9`, block 2,950,326, by a 0-DUST member through the relay, `npm run sunset:preprod -w chain`. The group is in SUNSET; after it, `recordMeeting` `ec0e88f8…57c99a` (block 2,950,410) and `attestSavings` `288b0711…d6fc55` (block 2,950,415) ran through the relay with 0 DUST.)

**Done and verified in the cloud session**
- 66 unit tests (72 after the Lace run, 78 with the invite and PIN), typecheck, e2e passed / 2 agentic skipped at 390 and 430 (e2e needs Node >= 22.22.3; the container has 22.22.0, so a Node 24 tarball was used).
- UI rebuilt as the cash box (owner's choice); launch video `media/launch-wide.mp4` and `-tall.mp4` (57 s, opens on the landing, `media/launch/make.sh`, ends on the Preprod record in `#/live`); demo.mp4 and the narrated cut (82 s; narration re-timed to the new beats). All re-rendered after the measurement, so receipts show 1 SPECK.
- Demo step rail (14 Oct): Back / Next pills, "Step N of 6" with the step name, six bars (done, current in saffron); the bare 1 to 6 numbers confused the owner. Rendered at 390 and 430. demo.mp4, demo-narrated.mp4 (narration cut per caption and re-placed 0.8 s after each beat; demo.srt rebuilt), screens/, strip.jpg and both launch cuts re-rendered with it on 14 Oct.
- Proving keys ship in `docs/zk/` so `#/live` can prove from Pages.

**Container notes (cloud)**
- Start `dockerd`; compactc 0.31.1 from the release zip (a `compact` shim wraps it); Docker Hub rate-limits, so pull `mirror.gcr.io/midnightntwrk/proof-server:8.1.0` and tag it; the proof server needs the compose override (host network, CA bundle, proxy env).
- Wallet sync from genesis ~1 h 45 min per wallet, CPU-bound: `npm run sync-wallets -w chain -- <wallet>`, one process each, with run_in_background (2 h cap); state saves to `.preprod/wallet-state` every 3 min; a restore costs ~6.5 min CPU.
- Blockfrost closes websockets often; `submitWithRetry` handles it. testkit logs the token unless `chain/src/logger.ts` is imported (it is, in every script).
- Never use `pkill -f <pattern>` in a tool command: it matches the tool's own shell.

**Next steps, in order**
1. Done 13 Oct: Lace `payFees:false` on the owner's laptop. Done 14 Oct: invite link/QR, PIN, sent, join as someone else (see above). Next: scan a QR card with a real phone.
2. Deck (Google Slides "Undying Ledger - AKINDO Midnight Buildathon", owner's Drive): slides 9, 12, 13 and 14 updated in place on 12 Oct to the Preprod run (1 SPECK fee, 5 calls by a 0-DUST caller, verified vs not-yet-verified split; heartbeat moved to verified); slides 1, 12, 13, 14 updated again on 13 Oct for v2 (9 circuits, 66 tests, 14 member calls at 0 DUST, no-wallet from a browser verified). Updated again on 13 Oct after the Lace run: slide 12 (72 tests, 16 member calls), slide 13 (Lace on Preprod moved to verified; Lace on phones and other browsers, and a wallet that refuses payFees:false, still not verified), slide 14 (Wave 3: a pilot group, Mainnet fee). 14 Oct: slide 12 (78 tests, 18 member calls), slide 13 (verified: browser join by invite link and PIN; not verified: Lace or a QR scan on a real phone).
3. The owner submits on AKINDO personally. **Do not submit, post publicly, or spend money without the owner's explicit yes.** Aim for 17 Oct.

## Design rules (the owner's standing rules; do not drift)

The UI is the **cash box** concept (chosen by the owner on 12 Oct 2026 over the earlier "A2 Passbook"): the VSLA's tin box with three padlocks, emerald (#0E5A43) and saffron (#F4B23A) on cream, huge condensed Archivo numbers (variable width, `font-stretch` 62%), Schibsted Grotesk for text, brass key tags, coins for shares, round seals. Art and motion live in `ui/src/box/`. Every animation follows a real action: coins drop in and locks click shut on a recorded meeting, her lock opens on her phone, all locks rattle on a refused open, the vendor's red lock falls off at sunset, the fee tank drains by the fee, the proof note rises from the slot (and drops back on a refusal). Numbers stay level. Fonts are self-hosted.

Rounded iOS-style pills and sheets are allowed in the cash-box design (the owner approved this; the old 4px cap applied to the passbook). Hard bans: harsh gradients, Lucide icons, pure white backgrounds, rainbow colours, drop shadows, three feature cards in a row, emoji, liquid glass, em dashes in copy, Inter, Geist or Space Grotesk, coloured left stripes, fake testimonials, bento grids, terminal windows, "It's not X, it's Y" phrasing, checkmark bullets, three pricing tiers, purple and black, radial orbs, dot grids, sparkle icons, animated arrows, hover animations, neon, basic pastels. No brutalist or terminal themes, nothing cartoony.

Always include: a real product demo, skeleton loaders, and Terms and Privacy links. Motion has to mean something, tied to real actions. Tap targets are 44px or more. Wrap hover styles in `(hover: hover) and (pointer: fine)`. Use `tabular-nums` on numbers that change, keep focus rings visible, and meet WCAG AA contrast.

Process for UI changes: render at 390 and 430 wide, look at the renders, critique for AI tells, then fix. Audit the CSS against vojtaholik/good-css. Keep unit and e2e tests green.

## Working style the owner wants
- For build work (code, fixes, renders, pushes to this repo), act without asking and send a short note when starting.
- Be honest about what was and wasn't verified, and separate "tested with mocks" from "ran on Preprod".
- Plain, specific copy. No hype.
