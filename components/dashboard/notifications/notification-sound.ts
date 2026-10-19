/**
 * Short two-note chime generated with the Web Audio API (no audio file, no external URL).
 *
 * Browsers block audio until the user interacts with the page. `unlockAudio` is wired to the
 * first click or key press: it creates the context inside that gesture and resumes it. Until
 * then `playChime` is a silent no-op, which is exactly what the autoplay policy would force
 * anyway.
 */

let context: AudioContext | null = null

type AudioContextConstructor = typeof AudioContext

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const withPrefix = window as unknown as { webkitAudioContext?: AudioContextConstructor }
  return window.AudioContext ?? withPrefix.webkitAudioContext ?? null
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio(): void {
  try {
    if (!context) {
      const Ctor = audioContextConstructor()
      if (!Ctor) return
      context = new Ctor()
    }
    if (context.state === 'suspended') void context.resume()
  } catch {
    // Audio is a nicety; the visual badge still works.
  }
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // Fast attack and exponential release avoid the click of a hard start/stop.
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export function playChime(): void {
  try {
    if (!context || context.state !== 'running') return
    const now = context.currentTime
    tone(context, 880, now, 0.16)
    tone(context, 1175, now + 0.14, 0.26)
  } catch {
    // Ignore: never let a sound failure break the polling loop.
  }
}
