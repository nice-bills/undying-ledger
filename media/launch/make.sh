#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Renders the launch videos from the REAL built app (docs/): media/launch-wide.mp4 (1920x1080)
# and media/launch-tall.mp4 (1080x1920). The stage plays the app inside a phone frame on a 120 BPM
# timeline (drive.mjs), captures frames over the DevTools screencast, synthesizes the music and
# the sound effects from the app's own animation events (music.py, numpy), and encodes with ffmpeg.
#   npm run build && media/launch/make.sh        (PLAYWRIGHT=/path/to/playwright/index.mjs optional)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$HERE/../.."; WORK="$(mktemp -d)"
cp "$ROOT/ui/src/fonts/archivo-62-125-latin.woff2" "$ROOT/ui/src/fonts/schibsted-grotesk-normal-400-800-latin.woff2" "$HERE/stage/"
node "$HERE/serve.mjs" 4180 "$ROOT/docs" "$HERE/stage" & SRV=$!; trap 'kill $SRV; rm -f "$HERE"/stage/*.woff2' EXIT; sleep 1
for lay in wide tall; do
  node "$HERE/drive.mjs" http://127.0.0.1:4180 "$lay" "$WORK/$lay"
  python3 "$HERE/music.py" 55 "$WORK/$lay/sfx.json" "$WORK/$lay.wav"
  python3 - "$WORK/$lay" <<'PY'
import json,sys
d=sys.argv[1]; t=json.load(open(f'{d}/times.json'))
with open(f'{d}/list.txt','w') as f:
    for i in range(len(t)):
        f.write(f"file '{i:05d}.jpg'\nduration {max((t[i+1]-t[i]) if i+1<len(t) else 1.0,0.001):.4f}\n")
    f.write(f"file '{len(t)-1:05d}.jpg'\n")
PY
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$WORK/$lay/list.txt" -i "$WORK/$lay.wav" -vf "fps=30,format=yuv420p" \
    -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart "$ROOT/media/launch-$lay.mp4"
done
echo "wrote media/launch-wide.mp4 and media/launch-tall.mp4"
