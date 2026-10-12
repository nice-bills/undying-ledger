#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# One command to take Undying Ledger from a fresh clone to a measured Preprod deployment.
#
#   scripts/preprod.sh            # everything: check, proof server, compile, deploy, measure, build
#   scripts/preprod.sh check      # only check prerequisites and the Blockfrost token
#   scripts/preprod.sh up         # start the local proof server and wait for it
#   scripts/preprod.sh deploy     # deploy a demo group (writes .preprod/group.json, mode 600)
#   scripts/preprod.sh measure    # time proofs and read real fees, print the UI command
#   scripts/preprod.sh measure --apply   # ... and write them into ui/src/demo/measured.ts
#   scripts/preprod.sh down       # stop the proof server
#
# Needs in the environment (see PREPROD.md):
#   BLOCKFROST_PROJECT_ID   a "Midnight Preprod" project ID from blockfrost.io (starts with nightpreprod)
#   DEPLOYER_MNEMONIC       24 words of a THROWAWAY test wallet funded with tNIGHT and generating DUST
#     or DEPLOYER_SEED      the same wallet as a 64-hex seed
#
# Written and checked with `bash -n` and shellcheck on a machine without Docker; it has NOT been
# run end to end. Every step prints what it is doing and stops at the first failure.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.preprod"
GROUP_JSON="$STATE/group.json"
PROOF_SERVER="${MIDNIGHT_PROOF_SERVER:-http://127.0.0.1:6300}"
INDEXER="https://midnight-preprod.blockfrost.io/api/v0"
COMPACT_VERSION="0.31.1"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[31mstopped: %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

check() {
  say "Checking prerequisites"
  need node "Install Node.js 22 or newer."
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 22 ] || die "Node.js $major found; 22 or newer is required."
  need npm "It ships with Node.js."
  need docker "Install Docker Desktop (or Docker Engine) and start it."
  docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker and try again."
  need curl "Install curl."
  if ! command -v compact >/dev/null 2>&1; then
    echo "compact (the Compact toolchain) is not installed. Install it with:"
    echo "  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh"
    echo "  compact update $COMPACT_VERSION"
    die "compact is needed to generate the proving keys."
  fi
  [ -n "${BLOCKFROST_PROJECT_ID:-}" ] || die "BLOCKFROST_PROJECT_ID is not set. Create a 'Midnight Preprod' project at https://blockfrost.io and export its project ID."
  case "$BLOCKFROST_PROJECT_ID" in nightpreprod*) ;; *) echo "warning: a Midnight Preprod project ID usually starts with 'nightpreprod'." ;; esac
  say "Checking the Blockfrost token against the Preprod indexer"
  local answer
  answer="$(curl -s --max-time 20 -X POST -H 'Content-Type: application/json' \
    -d '{"query":"{ block { height } }"}' "$INDEXER?project_id=$BLOCKFROST_PROJECT_ID" || true)"
  case "$answer" in
    *'"height"'*) echo "indexer answers: ${answer//$BLOCKFROST_PROJECT_ID/***}" ;;
    *) die "the indexer did not return a block height (answer: ${answer:-none}). Check the token and its network." ;;
  esac
}

up() {
  say "Starting the local proof server (midnightntwrk/proof-server:8.1.0, port 6300)"
  docker compose -f "$ROOT/chain/compose.yml" up -d
  printf 'waiting for %s/health ' "$PROOF_SERVER"
  for _ in $(seq 1 90); do
    if curl -sf --max-time 2 "$PROOF_SERVER/health" >/dev/null 2>&1; then echo " ready"; return 0; fi
    printf '.'; sleep 2
  done
  echo
  die "the proof server did not answer in 3 minutes. It downloads proving parameters on first start; see 'docker compose -f chain/compose.yml logs'."
}

down() {
  say "Stopping the proof server"
  docker compose -f "$ROOT/chain/compose.yml" down
}

install_and_compile() {
  say "Installing dependencies"
  (cd "$ROOT" && npm ci)
  if [ ! -f "$ROOT/contract/src/managed/undying/keys/recordMeeting.prover" ]; then
    say "Compiling the contract with Compact $COMPACT_VERSION (generates the proving keys)"
    compact update "$COMPACT_VERSION"
    (cd "$ROOT" && npm run compact)
  else
    echo "proving keys already present in contract/src/managed/undying/keys"
  fi
}

wallet_env() {
  if [ -z "${DEPLOYER_MNEMONIC:-}" ] && [ -z "${DEPLOYER_SEED:-}" ]; then
    die "set DEPLOYER_MNEMONIC (24 words of a throwaway test wallet) or DEPLOYER_SEED. The wallet needs tNIGHT from https://midnight-tmnight-preprod.nethermind.dev/ registered for DUST. See PREPROD.md steps 3 and 4."
  fi
}

deploy() {
  wallet_env
  mkdir -p "$STATE"
  chmod 700 "$STATE"
  if [ -f "$GROUP_JSON" ] && [ "${FORCE:-}" != "1" ]; then
    echo "already deployed: $(node -p "require('$GROUP_JSON').contract") (FORCE=1 deploys a new group)"
    return 0
  fi
  say "Deploying a demo savings group to Preprod (the first wallet sync can take a long time)"
  (cd "$ROOT" && DEPLOY_OUT="$GROUP_JSON" MIDNIGHT_NETWORK=preprod MIDNIGHT_PROOF_SERVER="$PROOF_SERVER" npm run deploy:preprod -w chain)
  [ -f "$GROUP_JSON" ] || die "the deploy script finished without writing $GROUP_JSON"
  echo "contract: $(node -p "require('$GROUP_JSON').contract")"
  echo "secrets saved to $GROUP_JSON (mode 600, gitignored). In a real group they go to phones by QR only."
}

measure() {
  wallet_env
  [ -f "$GROUP_JSON" ] || die "no $GROUP_JSON yet. Run: scripts/preprod.sh deploy"
  say "Measuring fees and proof times on Preprod (recordMeeting, attestSavings)"
  local out g
  g="$GROUP_JSON"
  out="$STATE/measure-$(date +%Y%m%d-%H%M%S).log"
  (
    cd "$ROOT"
    GROUP_CONTRACT="$(node -p "require('$g').contract")" \
    SECRETARY_SECRET="$(node -p "require('$g').secretarySecret")" \
    GROUP_SECRET="$(node -p "require('$g').groupSecret")" \
    MEMBER0_SECRET="$(node -p "require('$g').memberSecrets[0]")" \
    MEASURE_OUT="$STATE/measure.json" MIDNIGHT_NETWORK=preprod MIDNIGHT_PROOF_SERVER="$PROOF_SERVER" \
      npm run measure:preprod -w chain
  ) | tee "$out"
  local cmd
  cmd="$(grep -E '^  node ui/scripts/set-measured.mjs' "$out" | tail -1 | sed 's/^  //')"
  [ -n "$cmd" ] || die "no measurement line in $out"
  if [ "${1:-}" = "--apply" ]; then
    say "Writing the measurements into ui/src/demo/measured.ts and rebuilding docs/"
    (cd "$ROOT" && eval "$cmd" && node ui/scripts/set-preprod.mjs "$GROUP_JSON" "$STATE/measure.json" && npm run build)
  else
    echo
    echo "To show these numbers in the UI instead of the 1 DUST placeholder, run from $ROOT:"
    echo "  $cmd && npm run build"
  fi
}

live_url() {
  [ -f "$GROUP_JSON" ] || return 0
  say "Open the live register"
  echo "  npm run dev   then   http://localhost:5173/#/live?contract=$(node -p "require('$GROUP_JSON').contract")"
  echo "  (with Lace on Preprod, or paste your Blockfrost Preprod project ID on the page)"
}

cmd="${1:-all}"
shift || true
case "$cmd" in
  check) check ;;
  up) up ;;
  down) down ;;
  deploy) check; install_and_compile; deploy ;;
  measure) check; measure "$@" ;;
  all) check; up; install_and_compile; deploy; measure "$@"; live_url ;;
  *) die "unknown command '$cmd' (use: all, check, up, deploy, measure [--apply], down)" ;;
esac
