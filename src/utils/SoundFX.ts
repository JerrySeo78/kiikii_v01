let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function tone(
  c: AudioContext,
  freq: number,
  endFreq: number,
  type: OscillatorType,
  t: number,
  dur: number,
  gain: number,
  attack = 0.005,
) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(endFreq, t + dur)
  g.gain.setValueAtTime(0.001, t)
  g.gain.linearRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export const SoundFX = {
  // ── 공통 ──
  tick() {
    const c = ctx(); const t = c.currentTime
    tone(c, 900, 500, 'square', t, 0.05, 0.12)
  },

  // ── Match3 ──
  swap() {
    const c = ctx(); const t = c.currentTime
    tone(c, 220, 660, 'sine', t, 0.10, 0.18)
    tone(c, 440, 220, 'triangle', t + 0.04, 0.08, 0.10)
  },

  pop(combo = 1) {
    const c = ctx(); const t = c.currentTime
    const base = Math.min(350 + combo * 60, 700)
    tone(c, base, base * 1.6, 'triangle', t, 0.16, 0.28)
    if (combo >= 2) tone(c, base * 1.5, base * 2.0, 'sine', t + 0.04, 0.14, 0.15)
    if (combo >= 4) tone(c, base * 2.0, base * 2.5, 'sine', t + 0.08, 0.12, 0.12)
  },

  lineClear() {
    const c = ctx(); const t = c.currentTime
    ;[350, 440, 560, 700].forEach((f, i) =>
      tone(c, f, f * 1.3, 'sine', t + i * 0.055, 0.18, 0.22)
    )
  },

  boom() {
    const c = ctx(); const t = c.currentTime
    tone(c, 120, 40,  'sawtooth', t,       0.30, 0.40)
    tone(c, 240, 80,  'sine',     t,       0.20, 0.30)
    tone(c, 600, 200, 'triangle', t,       0.12, 0.15)
  },

  stageClear() {
    const c = ctx(); const t = c.currentTime
    ;[350, 440, 560, 700, 880].forEach((f, i) =>
      tone(c, f, f * 1.25, 'sine', t + i * 0.07, 0.22, 0.28 - i * 0.02)
    )
  },

  gameOver() {
    const c = ctx(); const t = c.currentTime
    ;[420, 360, 300, 240].forEach((f, i) =>
      tone(c, f, f * 0.85, 'triangle', t + i * 0.18, 0.28, 0.28 - i * 0.04)
    )
  },

  // ── Merge ──
  mergeChime(level = 0) {
    const c = ctx(); const t = c.currentTime
    const base = 300 + level * 55
    tone(c, base,        base * 1.5,  'sine',     t,       0.35, 0.35)
    tone(c, base * 1.25, base * 1.75, 'triangle', t + 0.06, 0.28, 0.22)
    tone(c, base * 1.5,  base * 2.0,  'sine',     t + 0.12, 0.22, 0.15)
  },

  jarTap() {
    const c = ctx(); const t = c.currentTime
    tone(c, 380, 180, 'sine',     t,       0.10, 0.28)
    tone(c, 700, 420, 'triangle', t,       0.07, 0.15)
  },

  spawnItem() {
    const c = ctx(); const t = c.currentTime
    tone(c, 550, 880,  'sine',     t,       0.12, 0.20)
    tone(c, 880, 1200, 'triangle', t + 0.07, 0.10, 0.14)
  },
}
