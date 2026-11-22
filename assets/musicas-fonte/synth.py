# Gera faixas instrumentais originais (sem direitos de terceiros) para a playlist do Corte25.
import numpy as np, subprocess, sys, os, json

SR = 44100
rng = np.random.default_rng(25)
OUT = sys.argv[1]

def note_hz(n):  # n = MIDI
    return 440.0 * 2 ** ((n - 69) / 12)

NAMES = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
QUAL = {'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'sus':[0,5,7],'add9':[0,4,7,14],'m9':[0,3,7,10,14]}
def chord(name, octave=4):
    root = name[0] + (name[1] if len(name) > 1 and name[1] in '#b' else '')
    q = name[len(root):]
    r = 12 * (octave + 1) + NAMES[root]
    return r, [r + i for i in QUAL[q]]

def lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); s = 0.0
    # vetorizado aproximado via filtro recursivo simples
    from scipy.signal import lfilter  # noqa
    return lfilter([1 - a], [1, -a], x)

def hp(x, cutoff):
    return x - lp(x, cutoff)

def env(n, a=0.005, d=0.2, s=0.0, r=0.05, length=None):
    t = np.arange(n) / SR
    e = np.ones(n)
    A = max(1, int(a * SR))
    e[:A] = np.linspace(0, 1, A)
    after = t[A:] - a
    e[A:] = s + (1 - s) * np.exp(-after / max(d, 1e-4))
    if length is not None:
        L = int(length * SR)
        if L < n:
            rel = np.exp(-np.arange(n - L) / SR / max(r, 1e-4))
            e[L:] *= rel
    return e

def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in ([0] if detune == 0 else [-detune, 0, detune]):
        ph = (t * f * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / (1 if detune == 0 else 3)

def sq(f, n):
    t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * f * t))

def sine(f, n, phase=0):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t + phase)

def ks(f, n, damp=0.996, bright=0.5):  # Karplus-Strong (corda dedilhada)
    N = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, N)
    buf = lp(buf, 2000 + 6000 * bright)
    out = np.zeros(n)
    idx = 0
    b = buf.copy()
    for i in range(n):
        out[i] = b[idx]
        nxt = (idx + 1) % N
        b[idx] = damp * 0.5 * (b[idx] + b[nxt])
        idx = nxt
    return out

def kick(n=int(0.45 * SR), punch=1.0):
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * punch + 0.3 * np.sin(ph) * np.exp(-t * 60)

def snare(n=int(0.25 * SR)):
    t = np.arange(n) / SR
    noise = hp(rng.uniform(-1, 1, n), 1500) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return 0.7 * noise + 0.4 * tone

def clap(n=int(0.25 * SR)):
    t = np.arange(n) / SR
    e = np.zeros(n)
    for off in (0, 0.01, 0.02):
        o = int(off * SR); e[o:] += np.exp(-(t[: n - o]) * 30)
    return hp(rng.uniform(-1, 1, n), 1000) * e * 0.5

def hat(n=int(0.06 * SR), open_=False):
    if open_: n = int(0.3 * SR)
    t = np.arange(n) / SR
    return hp(rng.uniform(-1, 1, n), 7000) * np.exp(-t * (12 if open_ else 70))

def shaker(n=int(0.08 * SR)):
    t = np.arange(n) / SR
    e = np.minimum(t / 0.02, 1) * np.exp(-t * 35)
    return hp(rng.uniform(-1, 1, n), 5000) * e

class Track:
    def __init__(self, bpm, bars):
        self.bpm = bpm; self.bars = bars
        self.beat = 60 / bpm
        self.n = int(round(bars * 4 * self.beat * SR))
        self.L = np.zeros(self.n); self.R = np.zeros(self.n)
        self.kicks = []
    def add(self, sig, time, gain=1.0, pan=0.0):
        i = int(round(time * SR)) % self.n
        sig = sig * gain
        end = i + len(sig)
        l = np.sqrt((1 - pan) / 2) * 1.414; r = np.sqrt((1 + pan) / 2) * 1.414
        if end <= self.n:
            self.L[i:end] += sig * l; self.R[i:end] += sig * r
        else:  # dá a volta: loop sem emenda
            k = self.n - i
            self.L[i:] += sig[:k] * l; self.R[i:] += sig[:k] * r
            self.L[: end - self.n] += sig[k:] * l; self.R[: end - self.n] += sig[k:] * r
    def t(self, bar, beat):
        return (bar * 4 + beat) * self.beat

def sidechain(tr, depth=0.6, rel=0.18):
    g = np.ones(tr.n)
    t = np.arange(int(rel * 2 * SR)) / SR
    shape = 1 - depth * np.exp(-t / (rel / 3))
    for k in tr.kicks:
        i = int(k * SR) % tr.n
        e = min(tr.n, i + len(shape))
        g[i:e] = np.minimum(g[i:e], shape[: e - i])
    return g

def reverb(x, mix=0.2):
    out = x.copy()
    for d, g in ((0.031, 0.5), (0.047, 0.45), (0.071, 0.4), (0.113, 0.35), (0.173, 0.3)):
        D = int(d * SR)
        y = np.zeros_like(x)
        y[D:] = x[:-D] * g
        y = lp(y, 4000)
        out += y * mix
    return out

def drums(tr, kick_beats, snare_beats, hat_div=2, swing=0.0, use_clap=False, open_hat=False, hat_gain=0.25, kick_gain=0.9, snare_gain=0.5, start_bar=0):
    K = kick(); S = clap() if use_clap else snare(); H = hat(); O = hat(open_=True)
    for b in range(start_bar, tr.bars):
        for kb in kick_beats:
            tr.add(K, tr.t(b, kb), kick_gain); tr.kicks.append(tr.t(b, kb))
        for sb in snare_beats:
            tr.add(S, tr.t(b, sb), snare_gain, 0.05)
        steps = 4 * hat_div
        for s in range(steps):
            pos = s / hat_div
            if s % 2 == 1: pos += swing / hat_div
            g = hat_gain * (1.0 if s % 2 == 0 else 0.7)
            tr.add(H, tr.t(b, pos), g, 0.3)
        if open_hat:
            for ob in (0.5, 1.5, 2.5, 3.5):
                tr.add(O, tr.t(b, ob), hat_gain * 0.7, -0.3)

def pad(tr, prog, bars_per=1, octave=4, gain=0.12, cutoff=1800, detune=0.006, duck=None):
    sig = np.zeros(tr.n)
    seg = int(round(bars_per * 4 * tr.beat * SR))
    for i in range(tr.bars // bars_per):
        _, notes = chord(prog[i % len(prog)], octave)
        s = sum(saw(note_hz(m), seg, detune) for m in notes) / len(notes)
        s = lp(s, cutoff) * env(seg, a=0.08, d=10, s=1, r=0.05)
        sig[i * seg:(i + 1) * seg] += s[: tr.n - i * seg]
    if duck is not None: sig *= duck
    sig = reverb(sig, 0.25)
    tr.L += sig * gain; tr.R += np.roll(sig, int(0.012 * SR)) * gain

def bassline(tr, prog, pattern, bars_per=1, octave=2, gain=0.35, kind='saw', cutoff=600, length=0.9):
    for b in range(tr.bars):
        root, _ = chord(prog[(b // bars_per) % len(prog)], octave)
        for pos, semis in pattern:
            dur = length * tr.beat * 0.5
            n = int(dur * SR) + int(0.05 * SR)
            f = note_hz(root + semis)
            if kind == 'sine':
                s = sine(f, n) + 0.3 * sine(2 * f, n)
            elif kind == '808':
                n = int(tr.beat * 1.8 * SR)
                s = np.tanh(2.5 * sine(f, n)) * env(n, 0.003, 0.9, 0, 0.05)
                tr.add(s, tr.t(b, pos), gain); continue
            else:
                s = lp(saw(f, n) if kind == 'saw' else sq(f, n), cutoff)
            s *= env(n, 0.004, 0.25, 0.6, 0.04, length=dur)
            tr.add(s, tr.t(b, pos), gain)

def arp(tr, prog, pattern, bars_per=1, octave=5, gain=0.15, kind='pluck', step=0.5, pan_sw=0.3):
    for b in range(tr.bars):
        _, notes = chord(prog[(b // bars_per) % len(prog)], octave)
        for i, idx in enumerate(pattern):
            if idx is None: continue
            m = notes[idx % len(notes)] + 12 * (idx // len(notes))
            f = note_hz(m)
            n = int(0.6 * SR)
            if kind == 'pluck':
                s = lp(saw(f, n), 3500) * env(n, 0.002, 0.12, 0, 0.05)
            elif kind == 'bell':
                s = (sine(f, n) + 0.5 * sine(f * 2.01, n) + 0.25 * sine(f * 3.99, n)) * env(n, 0.002, 0.35)
            elif kind == 'marimba':
                s = (sine(f, n) + 0.4 * sine(f * 4, n) * np.exp(-np.arange(n) / SR * 40)) * env(n, 0.002, 0.18)
            elif kind == 'keys':
                s = (sine(f, n) + 0.3 * sine(2 * f, n) + 0.1 * sine(3 * f, n)) * env(n, 0.004, 0.5)
            elif kind == 'guitar':
                s = ks(f, n, 0.997, 0.4)
            pan = pan_sw if i % 2 else -pan_sw
            tr.add(s, tr.t(b, i * step), gain, pan)

def strum(tr, prog, hits, bars_per=1, octave=3, gain=0.12):
    for b in range(tr.bars):
        _, notes = chord(prog[(b // bars_per) % len(prog)], octave)
        notes = notes[:3] + [notes[0] + 12, notes[1] + 12]
        for pos, down in hits:
            order = notes if down else notes[::-1]
            for j, m in enumerate(order):
                n = int(0.9 * SR)
                tr.add(ks(note_hz(m), n, 0.996, 0.5), tr.t(b, pos) + j * 0.012, gain / len(notes) * 2.5, -0.2 + 0.1 * j)

def finish(tr, name, extra_noise=0.0):
    L, R = tr.L, tr.R
    if extra_noise:
        crackle = (rng.random(tr.n) > 0.9995) * rng.uniform(-1, 1, tr.n)
        hiss = lp(rng.normal(0, 1, tr.n), 3000) * 0.02
        L = L + (crackle * 0.3 + hiss) * extra_noise; R = R + (np.roll(crackle, 777) * 0.3 + hiss) * extra_noise
    m = max(np.abs(L).max(), np.abs(R).max())
    L, R = np.tanh(1.3 * L / m) / np.tanh(1.3), np.tanh(1.3 * R / m) / np.tanh(1.3)
    L *= 0.89; R *= 0.89
    stereo = np.stack([L, R], 1).astype(np.float32)
    raw = os.path.join(OUT, name + '.f32')
    stereo.tofile(raw)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw,
                    '-c:a', 'libmp3lame', '-b:a', '160k', os.path.join(OUT, name + '.mp3')], check=True)
    os.remove(raw)
    return round(tr.n / SR, 1)

meta = []
def make(slug, title, mood, bpm, bars, build):
    tr = Track(bpm, bars)
    noise = build(tr)
    dur = finish(tr, slug, noise or 0)
    meta.append({'slug': slug, 'title': title, 'mood': mood, 'bpm': bpm, 'seconds': dur})
    print(slug, dur, flush=True)

POP = ['C', 'G', 'Am', 'F']
def b_pop(tr):
    drums(tr, [0, 1, 2, 3], [1, 3], 2, use_clap=True, hat_gain=0.18)
    bassline(tr, POP, [(0, 0), (0.5, 0), (1, 12), (1.5, 0), (2, 0), (2.5, 0), (3, 12), (3.5, 7)], kind='saw', cutoff=900, gain=0.3)
    duck = sidechain(tr, 0.5)
    pad(tr, POP, octave=4, gain=0.1, duck=duck)
    arp(tr, POP, [0, 1, 2, 3, 2, 1, 0, 1], octave=5, gain=0.13, kind='pluck')
make('animada-pop', 'Animada Pop', 'animada', 120, 16, b_pop)

LOFI = ['Cmaj7', 'Am7', 'Dm7', 'G7']
def b_lofi(tr):
    drums(tr, [0, 2.5], [1, 3], 2, swing=0.18, hat_gain=0.12, kick_gain=0.7, snare_gain=0.35)
    bassline(tr, LOFI, [(0, 0), (1.5, 0), (2.5, 7)], kind='sine', gain=0.35, length=1.6)
    pad(tr, LOFI, octave=4, gain=0.09, cutoff=1100, detune=0.003)
    arp(tr, LOFI, [0, None, 2, None, 3, None, 1, None], octave=5, gain=0.12, kind='keys')
    return 1.0
make('calma-lofi', 'Calma Lo-fi', 'calma', 80, 16, b_lofi)

HOUSE = ['Am', 'F', 'C', 'G']
def b_house(tr):
    drums(tr, [0, 1, 2, 3], [1, 3], 2, use_clap=True, open_hat=True, hat_gain=0.15)
    bassline(tr, HOUSE, [(0.5, 0), (1.5, 0), (2.5, 0), (3.5, 12)], kind='square', cutoff=700, gain=0.28)
    duck = sidechain(tr, 0.75)
    pad(tr, [c + '' for c in HOUSE], octave=4, gain=0.13, cutoff=2500, duck=duck)
    arp(tr, HOUSE, [0, 2, 1, 2, 0, 2, 3, 2], octave=5, gain=0.1, kind='pluck')
make('eletronica-house', 'Eletrônica House', 'eletrônica', 124, 16, b_house)

FUNK = ['Em7', 'Em7', 'A7', 'A7']
def b_funk(tr):
    drums(tr, [0, 0.75, 2.5], [1, 3], 4, hat_gain=0.12, snare_gain=0.55)
    bassline(tr, FUNK, [(0, 0), (0.75, 0), (1, 12), (1.5, 10), (2, 7), (2.5, 0), (3.25, 3), (3.5, 5)], kind='square', cutoff=1000, gain=0.3, length=0.6)
    arp(tr, FUNK, [None, 1, None, 2, None, 1, None, 3], octave=4, gain=0.14, kind='guitar')
make('groove-funk', 'Groove Funk', 'dançante', 105, 24, b_funk)

TRAP = ['Cm', 'Ab', 'Eb', 'Bb']
def b_trap(tr):
    K = kick(); C = clap(); H = hat()
    for b in range(tr.bars):
        for kb in (0, 1.75, 2.5):
            tr.add(K, tr.t(b, kb), 0.8); tr.kicks.append(tr.t(b, kb))
        tr.add(C, tr.t(b, 2), 0.6)
        for s in range(16):
            tr.add(H, tr.t(b, s / 4), 0.14 if s % 2 == 0 else 0.09, 0.25)
        if b % 2 == 1:
            for s in range(6): tr.add(H, tr.t(b, 3.5 + s / 12), 0.1, 0.25)
    bassline(tr, TRAP, [(0, 0), (1.75, 0), (2.5, 7)], kind='808', octave=1, gain=0.45)
    arp(tr, TRAP, [0, None, 2, None, 1, None, 2, None], octave=5, gain=0.12, kind='bell')
    pad(tr, TRAP, octave=4, gain=0.06, cutoff=900)
make('trap-moderno', 'Trap Moderno', 'urbana', 140, 24, b_trap)

ACO = ['G', 'D', 'Em', 'C']
def b_aco(tr):
    S = shaker()
    for b in range(tr.bars):
        for s in range(8): tr.add(S, tr.t(b, s / 2), 0.16 if s % 2 else 0.1, 0.4)
    drums(tr, [0, 2], [1, 3], 1, hat_gain=0.0, kick_gain=0.6, snare_gain=0.25)
    strum(tr, ACO, [(0, 1), (1, 1), (1.5, 0), (2.5, 0), (3, 1), (3.5, 0)], octave=3, gain=0.2)
    bassline(tr, ACO, [(0, 0), (2, 7)], kind='sine', octave=2, gain=0.3, length=1.6)
make('acustica-alegre', 'Acústica Alegre', 'alegre', 110, 24, b_aco)

INSP = ['F', 'C', 'G', 'Am']
def b_insp(tr):
    drums(tr, [0, 2], [1, 3], 2, hat_gain=0.1, kick_gain=0.7, snare_gain=0.35, start_bar=4)
    pad(tr, INSP, octave=4, gain=0.12, cutoff=2200)
    arp(tr, INSP, [0, 1, 2, 4, 2, 1, 0, 1], octave=5, gain=0.14, kind='keys')
    bassline(tr, INSP, [(0, 0), (1.5, 0), (2, 0), (3, 7)], kind='sine', gain=0.3, length=1.0)
make('inspiradora', 'Inspiradora', 'motivacional', 100, 16, b_insp)

TROP = ['Dm', 'Bb', 'F', 'C']
def b_trop(tr):
    K = kick(); S = snare(); SH = shaker()
    for b in range(tr.bars):
        for kb in (0, 1, 2, 3):
            tr.add(K, tr.t(b, kb), 0.7); tr.kicks.append(tr.t(b, kb))
        for sb in (0.75, 1.5, 2.75, 3.5):
            tr.add(S, tr.t(b, sb), 0.3, 0.1)
        for s in range(8): tr.add(SH, tr.t(b, s / 2 + 0.25), 0.12, 0.4)
    arp(tr, TROP, [0, None, 1, 2, None, 1, 2, None], octave=5, gain=0.15, kind='marimba')
    bassline(tr, TROP, [(0, 0), (1.5, 0), (2, 7), (3.5, 5)], kind='sine', gain=0.32, length=0.9)
    duck = sidechain(tr, 0.5)
    pad(tr, TROP, octave=4, gain=0.07, cutoff=1600, duck=duck)
make('tropical-chill', 'Tropical Chill', 'verão', 100, 20, b_trop)

json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
