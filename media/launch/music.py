# SPDX-License-Identifier: Apache-2.0
# Original 120 BPM highlife-style bed plus sound effects timed to the app's own animation events.
# Synthesized from scratch (Karplus-Strong guitar, sine bass, noise shaker); no samples.
import json, sys, wave
import numpy as np
SR = 48000
dur, sfx_path, out = float(sys.argv[1]), sys.argv[2], sys.argv[3]
N = int(dur * SR)
mix = np.zeros((N, 2))
rng = np.random.default_rng(7)
BEAT = 0.5; BAR = 2.0
def place(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    s = sig[: N - i] * gain
    mix[i:i + len(s), 0] += s * (1 - max(0, pan))
    mix[i:i + len(s), 1] += s * (1 + min(0, pan))
def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)
def pluck(f, length=0.9, bright=0.5):
    n = int(length * SR); p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p) * bright + (1 - bright) * np.sin(np.linspace(0, 2 * np.pi, p, endpoint=False))
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out * env(n, 0.002, 0.5)
note = lambda m: 440 * 2 ** ((m - 69) / 12)
cache = {}
def P(m):
    if m not in cache: cache[m] = pluck(note(m))
    return cache[m]
# C - F - G - C, one chord per bar (MIDI roots)
prog = [(48, [60, 64, 67]), (53, [65, 69, 72]), (55, [67, 71, 74]), (48, [60, 64, 67])]
pattern = [(0, 0), (0.5, 2), (1, 1), (1.5, 2), (2, 0), (2.25, 1), (2.75, 2), (3.5, 1)]  # (beat, chord tone)
dark = (24.0, 30.0); end = 46.5
bars = int(np.ceil(dur / BAR))
for b in range(bars):
    t0 = b * BAR
    if t0 > end + 2: break
    root, tones = prog[b % 4]
    inend = t0 >= end
    for beat, k in pattern:
        t = t0 + beat * BEAT
        if inend and beat > 0: continue
        g = 0.22 if not (dark[0] <= t < dark[1]) else 0.14
        place(P(tones[k] + (12 if beat in (2, 3.5) else 0)), t, g, pan=0.3 if k == 1 else -0.25)
    if t0 >= 2.0 and not inend:
        # bass on 1 and 3 plus the "and" of 2
        for beat, m in ((0, root), (1.5, root + 7), (2, root)):
            n = int(0.45 * SR); tt = np.arange(n) / SR
            place(np.sin(2 * np.pi * note(m - 12) * tt) * env(n, 0.01, 0.25), t0 + beat * BEAT, 0.32)
        if not (dark[0] <= t0 < dark[1]):
            for beat in (0, 2):
                n = int(0.25 * SR); tt = np.arange(n) / SR
                f = 50 + 70 * np.exp(-tt * 30)
                place(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.09), t0 + beat * BEAT, 0.45)
            for e in range(8):  # shaker on eighths, light swing
                n = int(0.05 * SR); sh = rng.uniform(-1, 1, n); sh = np.diff(sh, prepend=0) * env(n, 0.003, 0.018)
                place(sh, t0 + e * BEAT / 2 + (0.02 if e % 2 else 0), 0.09 if e % 2 else 0.05, pan=0.4)
            for beat in (0, 1.5, 3, 5, 6):  # 3-2 clave over two bars of eighths
                if b % 2 == 0 and beat < 4 or b % 2 == 1 and beat >= 4:
                    n = int(0.04 * SR); tt = np.arange(n) / SR
                    place(np.sin(2 * np.pi * 1350 * tt) * env(n, 0.001, 0.012), t0 + (beat % 4) * BEAT, 0.08, pan=-0.4)
# a held final chord under the closing line
for m in (48, 60, 64, 67, 72):
    n = int(3.5 * SR); tt = np.arange(n) / SR
    place(np.sin(2 * np.pi * note(m) * tt) * env(n, 0.3, 1.6) * 0.5, end, 0.10)
# sound effects at the app's real event times
def tone(fs, d, decay, g=1.0):
    n = int(d * SR); tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * tt) for f in fs) * env(n, 0.001, decay) * g / len(fs)
def noise(d, decay, hp=True):
    n = int(d * SR); x = rng.uniform(-1, 1, n)
    if hp: x = np.diff(x, prepend=0)
    return x * env(n, 0.001, decay)
FX = {
    'tap': lambda: noise(0.03, 0.006) * 0.5 + tone([1900], 0.03, 0.008, 0.3),
    'tink': lambda: tone([2637, 3951, 5274], 0.25, 0.07, 0.8),
    'click': lambda: noise(0.05, 0.008) * 0.6 + tone([900, 1400], 0.05, 0.012, 0.6),
    'thump': lambda: tone([62, 124], 0.3, 0.09, 1.2) + np.pad(noise(0.03, 0.01, False) * 0.25, (0, int(0.3 * SR) - int(0.03 * SR))),
    'drop': lambda: np.concatenate([noise(0.25, 0.4, False) * np.linspace(0.05, 0.3, int(0.25 * SR)), tone([420, 640, 1100], 0.4, 0.08, 1.0)]),
    'swish': lambda: noise(0.35, 0.25, False) * np.sin(np.linspace(0, np.pi, int(0.35 * SR))) * 0.35,
}
G = {'tap': 0.35, 'tink': 0.22, 'click': 0.5, 'thump': 0.55, 'drop': 0.45, 'swish': 0.4}
for k, t in json.load(open(sfx_path)):
    place(FX[k](), t, G[k])
# fade in/out, gentle master limit
fade = np.ones(N); fi = int(0.05 * SR); fo = int(1.5 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) * 0.8
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out, round(dur, 2), 's')
