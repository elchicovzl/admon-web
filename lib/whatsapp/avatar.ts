/**
 * Initials avatar (PR2.2c). The Cloud API exposes no customer profile photo, so the inbox draws
 * initials over a deterministic color. Pure: no I/O, no clock.
 */

/**
 * Up to two initials from the first two words that contain a letter, uppercased. Null when the
 * name has no letters at all (only digits or a phone number): the caller shows a generic icon.
 */
export function avatarInitials(name: string | null | undefined): string | null {
  const words = (name ?? '').trim().split(/\s+/)
  const initials: string[] = []
  for (const word of words) {
    const match = /^[^\p{L}]*(\p{L})/u.exec(word)
    if (match) initials.push(match[1].toLocaleUpperCase('es'))
    if (initials.length === 2) break
  }
  return initials.length > 0 ? initials.join('') : null
}

/**
 * Soft tint with dark text in light mode, deep tint with light text in dark mode, so the initials
 * stay readable in both themes. Complete literal class names so Tailwind generates them.
 */
export const AVATAR_PALETTE = [
  'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100',
  'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100',
  'bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-100',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100',
] as const

/** FNV-1a, 32 bit: stable across runs and platforms (unlike anything seeded by the engine). */
function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Same seed (conversation or contact id), same color, always. */
export function avatarColorClass(seed: string): string {
  return AVATAR_PALETTE[hash(seed) % AVATAR_PALETTE.length]
}
