# End-to-end tests (e2e by TesterArmy)

Set up with `npx e2e init --yes e2e` (e2e 0.19.0, docs: https://tester.army/e2e), then
adapted. The tests drive the **built** demo in `../docs` in a real browser at two phone
sizes (390x844 and 430x932) and check numbers produced by the compiled Compact circuits.

```bash
npm run build              # from the repo root: ui -> docs/
cd e2e && npm ci
npx e2e run                # starts serve.mjs on a free port, runs every test on both phones
```

| Test | What it proves |
|---|---|
| the six-beat story | record meeting 12 (circuit runs), Ama's passbook 26 → 29 shares and GH₵150 loan cleared, husband's phone sees 12 meetings and 5 keys and cannot open slot 0, early `sunset()` refused ("still sending heartbeats"), skip, sunset accepted ("Erased"), meeting 13 records after sunset, 33 shares refused by `attestSavings`, 30 shares proved; no console errors |
| refusals on a fresh book | early sunset refused straight from the rail, 33 shares refused when Ama holds 26 |
| Terms, Privacy, fee key | the legal pages and the fee-key page render; a leaked key burns DUST but cannot write the book |
| agent: a newcomer… | agentic smoke test with `agent.act`/`agent.assert`; **skipped** unless `AI_GATEWAY_API_KEY` is set |

## Machines where Playwright cannot download its browser

On linux-arm64 the e2e web engine's Chrome-for-Testing download returned HTTP 403, so the
run attaches to an already running Chromium over CDP instead:

```bash
chromium --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/cdp about:blank &
E2E_CDP=http://127.0.0.1:9333 npx e2e run
```

`E2E_CDP` accepts the `http://` debugging port or a `ws://` DevTools URL. `APP_URL` points the
run at an app you serve yourself; `E2E_SITE_DIR` serves another folder (e.g. `../ui/dist`).

## Agent steps

Set `AI_GATEWAY_API_KEY` (Vercel AI Gateway) or swap the model in `e2e.config.ts` (see
https://e2e.tester.army/docs/models). `E2E_MODEL` overrides the model id. Telemetry was
disabled on the build machine with `npx e2e telemetry disable`.
