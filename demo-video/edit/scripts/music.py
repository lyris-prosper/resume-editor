"""
拾历 Demo 视频配乐：用代码原创合成的器乐（无歌词、无人声、无采样），附少量转场音效（无点击音）。
输出 build/audio/music.wav、build/audio/sfx.wav、build/audio/mix.wav（48 kHz 立体声，90 秒）。

段落（按画面大段落变化，不精细踩点）：
  0–8s   开场：柔和铺底 + 稀疏钢琴音，建立期待
  8–14s  品牌：铺底展开 + 钟琴动机
  14–53s 实操前半：稳定节拍（轻底鼓、沙锤）+ 拨弦琶音
  53–82s 实操后半：加入贝斯与更密的节拍，适度抬升
  82–90s 收束：节拍退出，回到主和弦，自然收尾
用法：python3 scripts/music.py [时间点 json]
"""
import json
import os
import sys

import numpy as np

SR = 48000
DUR = 90.0
N = int(SR * DUR)
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(20261011)
OUT = os.path.join(os.path.dirname(__file__), '..', 'build', 'audio')
os.makedirs(OUT, exist_ok=True)

# 画面大段落（可从时间线导出覆盖）
T = {'brand': 8.0, 'ops': 14.0, 'lift': 53.5, 'outro': 82.0, 'steps': [28.07, 53.52, 69.48], 'window': 13.2, 'back': 84.0, 'end': 86.3}
if len(sys.argv) > 1:
    T.update(json.load(open(sys.argv[1])))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, sr=SR):
    """简单包络：a/d/r 为秒数，s 为保持电平；n 为总样本数"""
    e = np.ones(n) * s
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na, endpoint=False)
    nd2 = min(nd, max(0, n - na))
    e[na:na + nd2] = np.linspace(1, s, nd2, endpoint=False)
    if nr > 0:
        nr = min(nr, n)
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def place(buf, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= buf.shape[1] or i + len(sig) <= 0:
        return
    j = min(buf.shape[1], i + len(sig))
    seg = sig[: j - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:j] += seg * l * 1.414
    buf[1, i:j] += seg * r * 1.414


def tone(freq, dur, harmonics, decay=None, detune=0.0, vib=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, amp in enumerate(harmonics, start=1):
        f = freq * k * (1 + detune * (k - 1) * 0.0004)
        ph = 2 * np.pi * f * t + (vib * np.sin(2 * np.pi * 4.8 * t) if vib else 0)
        part = amp * np.sin(ph + rng.random() * 6.28)
        if decay:
            part *= np.exp(-t * decay * (1 + 0.6 * (k - 1)))
        out += part
    return out


def piano(freq, dur, vel=1.0):
    h = [1.0, 0.45, 0.22, 0.12, 0.06, 0.035, 0.02]
    s = tone(freq, dur, h, decay=2.2, detune=1.0)
    s *= env_adsr(len(s), 0.004, 0.08, 0.85, min(0.25, dur * 0.3))
    return s * vel


def bell(freq, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in [(1, 1.0, 1.4), (2.0, 0.35, 2.4), (3.01, 0.18, 3.5), (4.17, 0.08, 5.0), (5.43, 0.04, 7.0)]:
        s += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t * dec)
    s *= env_adsr(n, 0.003, 0.0, 1.0, 0.05)
    return s * vel


def pluck(freq, dur, vel=1.0):
    h = [1.0, 0.6, 0.35, 0.2, 0.12, 0.07, 0.04, 0.025]
    s = tone(freq, dur, h, decay=5.5)
    s *= env_adsr(len(s), 0.002, 0.03, 0.9, 0.04)
    return s * vel


def pad(freqs, dur, bright=0.5):
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.07, 0.0, 0.06):
            ff = f * 2 ** (det / 12)
            h = [1.0 / k * np.exp(-(k - 1) * (1.4 - bright)) for k in range(1, 9)]
            out += tone(ff, dur, h, vib=0.0008)
    out /= len(freqs) * 3
    return out * env_adsr(n, min(1.2, dur * 0.35), 0.0, 1.0, min(1.4, dur * 0.4))


def kick(vel=1.0):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 42 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 9.0)
    s += 0.15 * rng.standard_normal(n) * np.exp(-t * 160)
    return s * vel


def hat(vel=1.0, length=0.06):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = np.diff(np.concatenate([[0], s]))  # 高通
    s = np.diff(np.concatenate([[0], s]))
    return s * np.exp(-t * 70) * vel * 0.25


def shaker(vel=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    s = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    e = np.minimum(t / 0.015, 1) * np.exp(-t * 38)
    return s * e * vel * 0.2


def bandnoise(n, lo, hi):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n)
    return y / (np.abs(y).max() + 1e-9)


def reverb(x, secs=2.4, wet=0.25, seed=1):
    r = np.random.default_rng(seed)
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.standard_normal(n) * np.exp(-t * 6.9 / secs)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt((ir ** 2).sum())
        L = x.shape[1] + n
        size = 1 << int(np.ceil(np.log2(L)))
        y = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
        out[ch] = x[ch] * (1 - wet) + y * wet * 2.2
    return out


# ---------------- 和声 ----------------
# 每小节一个和弦：Fmaj7 → C/E → Am7 → G6（温和、向上）
CHORDS = [
    ([53, 57, 60, 64], 41),
    ([52, 55, 60, 62], 40),
    ([57, 60, 64, 67], 45),
    ([55, 59, 62, 64], 43),
]
nbars = int(np.ceil(DUR / BAR)) + 1
music = np.zeros((2, N))
drums = np.zeros((2, N))

ops, lift, outro, brand = T['ops'], T['lift'], T['outro'], T['brand']
for b in range(nbars):
    t0 = b * BAR
    if t0 >= DUR:
        break
    notes, root = CHORDS[b % 4]
    end_chord = t0 >= outro - 0.01
    if end_chord:
        notes, root = ([53, 57, 60, 64, 69], 41) if t0 < outro + BAR else ([48, 55, 60, 64, 67], 36)
    # 铺底：全程，品牌之后更亮
    bright = 0.35 if t0 < brand else (0.55 if t0 < lift else 0.7)
    g = 0.30 if t0 < brand else 0.36
    place(music, t0, pad([midi(m) for m in notes], BAR + 0.9, bright), gain=g)

    # 开场：稀疏的钢琴单音
    if t0 < brand:
        for k, m in enumerate(notes[1:][:3]):
            place(music, t0 + 0.6 + k * BEAT * 1.25, piano(midi(m + 12), 2.4, 0.22), pan=(-0.3 + 0.3 * k))
    # 品牌：钟琴动机
    if brand <= t0 < ops + BAR * 0.5:
        motif = [notes[-1] + 12, notes[1] + 12, notes[2] + 12, notes[-1] + 24]
        for k, m in enumerate(motif):
            place(music, t0 + k * BEAT, bell(midi(m), 2.6, 0.16), pan=(-0.4 + 0.27 * k))
    # 实操：拨弦琶音（八分音符），后半加高八度
    if ops <= t0 < outro:
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        for k in range(8):
            st = t0 + k * BEAT / 2
            if st < ops:
                continue
            m = notes[pat[k]] + 12
            place(music, st, pluck(midi(m), 0.9, 0.17 if k % 2 == 0 else 0.12), pan=0.25 if k % 2 else -0.15)
            if t0 >= lift and k % 2 == 1:
                place(music, st + BEAT / 4, pluck(midi(m + 12), 0.6, 0.07), pan=0.45)
        # 节拍
        for k in range(4):
            st = t0 + k * BEAT
            if st < ops:
                continue
            if k in (0, 2) or t0 >= lift:
                place(drums, st, kick(0.38 if t0 < lift else 0.44))
            place(drums, st + BEAT / 2, shaker(0.9 if t0 < lift else 1.1), pan=0.2)
            if t0 >= lift:
                place(drums, st + BEAT / 4, hat(0.6), pan=-0.25)
                place(drums, st + 3 * BEAT / 4, hat(0.45), pan=-0.25)
        # 后半：贝斯
        if t0 >= lift:
            for k in range(8):
                st = t0 + k * BEAT / 2
                bs = tone(midi(root), BEAT / 2 * 0.9, [1.0, 0.35, 0.12], decay=3.0) * env_adsr(int(BEAT / 2 * 0.9 * SR), 0.005, 0.05, 0.8, 0.04)
                place(music, st, bs, gain=0.22 if k % 2 == 0 else 0.16)
    # 收束：主和弦上的钢琴
    if end_chord and t0 < DUR - 1:
        for k, m in enumerate(notes):
            place(music, t0 + k * 0.09, piano(midi(m + 12), 4.0, 0.16), pan=-0.3 + 0.15 * k)

# 进入后半前的上扬
rise_n = int(2.4 * SR)
rise = bandnoise(rise_n, 2000, 9000) * np.linspace(0, 1, rise_n) ** 2.2 * 0.05
place(music, lift - 2.4, rise)

music = reverb(music, 2.6, 0.28, seed=2) + reverb(drums, 1.0, 0.12, seed=3)

# 结尾自然收束：最后 3.5 秒渐弱到无声
fade = np.ones(N)
fn = int(3.6 * SR)
fade[-fn:] = np.linspace(1, 0, fn) ** 1.6
fade[: int(1.2 * SR)] = np.linspace(0, 1, int(1.2 * SR))
music *= fade

# ---------------- 转场音效（无点击音） ----------------
sfx = np.zeros((2, N))


def whoosh(at, dur=0.7, gain=0.18, pan_from=-0.6, pan_to=0.6):
    n = int(dur * SR)
    x = bandnoise(n, 250, 5000)
    tt = np.linspace(0, 1, n)
    e = np.sin(np.pi * tt ** 0.7) ** 2
    l = np.cos((np.linspace(pan_from, pan_to, n) + 1) * np.pi / 4)
    r = np.sin((np.linspace(pan_from, pan_to, n) + 1) * np.pi / 4)
    i = int((at - dur * 0.55) * SR)
    j = min(N, i + n)
    sfx[0, i:j] += (x * e * l * gain)[: j - i]
    sfx[1, i:j] += (x * e * r * gain)[: j - i]


def chime(at, base=84, gain=0.10):
    for k, m in enumerate([base, base + 7, base + 12]):
        place(sfx, at + k * 0.07, bell(midi(m), 2.2, 1.0), gain=gain * (1 - 0.2 * k), pan=-0.2 + 0.2 * k)


whoosh(brand, 0.9, 0.16)
whoosh(T['window'] + 0.4, 0.8, 0.13, 0.6, -0.4)
for s in T['steps']:
    whoosh(s, 0.6, 0.10)
whoosh(outro, 0.8, 0.13)
chime(brand + 2.0, 84, 0.07)
chime(T['back'] + 0.4, 81, 0.07)
chime(T['end'] + 0.2, 84, 0.08)
sfx = reverb(sfx, 1.6, 0.3, seed=4)


def master(x, peak=0.89):
    x = np.tanh(x * 1.2) / np.tanh(1.2)
    return x / (np.abs(x).max() + 1e-9) * peak


def write_wav(path, x):
    import wave
    y = np.clip(x, -1, 1)
    pcm = (y.T * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


m = master(music, 0.8)
mix = master(m + sfx * 0.9, 0.89)
write_wav(os.path.join(OUT, 'music.wav'), m)
write_wav(os.path.join(OUT, 'sfx.wav'), master(sfx, 0.6))
write_wav(os.path.join(OUT, 'mix.wav'), mix)
print('audio →', OUT)
