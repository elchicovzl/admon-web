export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 code */
  code: string
  name: string
  /** Dial code digits without the leading "+" */
  dialCode: string
  flag: string
  /** react-imask mask for the national number; when absent, free digits/spaces */
  mask?: string
}

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = {
  code: 'CO',
  name: 'Colombia',
  dialCode: '57',
  flag: '🇨🇴',
  mask: '000 000 0000',
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  DEFAULT_PHONE_COUNTRY,
  { code: 'US', name: 'Estados Unidos / Canadá', dialCode: '1', flag: '🇺🇸' },
  { code: 'VE', name: 'Venezuela', dialCode: '58', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', dialCode: '593', flag: '🇪🇨' },
  { code: 'PE', name: 'Perú', dialCode: '51', flag: '🇵🇪' },
  { code: 'PA', name: 'Panamá', dialCode: '507', flag: '🇵🇦' },
  { code: 'MX', name: 'México', dialCode: '52', flag: '🇲🇽' },
  { code: 'ES', name: 'España', dialCode: '34', flag: '🇪🇸' },
  { code: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱' },
  { code: 'BR', name: 'Brasil', dialCode: '55', flag: '🇧🇷' },
]

export function getCountryByDialCode(dialCode: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.dialCode === dialCode)
}

export interface ParsedPhone {
  dialCode: string
  national: string
}

/**
 * Splits a stored value ("+<code> <number>") into dial code and national number.
 * Values without "+" or with an unknown code fall back to Colombia.
 */
export function parsePhone(value: string | null | undefined): ParsedPhone {
  const raw = (value ?? '').trim()
  const fallback = DEFAULT_PHONE_COUNTRY.dialCode
  if (!raw) return { dialCode: fallback, national: '' }

  if (!raw.startsWith('+')) {
    const digits = raw.replace(/\D/g, '')
    // Legacy digits-only value that clearly carries the Colombian code
    if (digits.startsWith('57') && digits.length >= 12) {
      return { dialCode: fallback, national: digits.slice(2) }
    }
    return { dialCode: fallback, national: raw }
  }

  const digits = raw.slice(1).replace(/\D/g, '')
  // Longest dial-code prefix wins
  const match = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => digits.startsWith(c.dialCode))
  if (!match) return { dialCode: fallback, national: raw }

  // Consume exactly dialCode digits from the original string, keeping the rest
  let consumed = 0
  let i = 1
  while (i < raw.length && consumed < match.dialCode.length) {
    if (/\d/.test(raw[i])) consumed++
    i++
  }
  return { dialCode: match.dialCode, national: raw.slice(i).trim() }
}

/** Joins dial code and national number as "+<code> <number>"; empty number gives "". */
export function formatPhone(dialCode: string, national: string): string {
  const n = national.trim()
  return n ? `+${dialCode} ${n}` : ''
}

/** E.164 allows at most 15 digits; shorter than 8 cannot be a real subscriber number. */
const MIN_WA_ID_DIGITS = 8
const MAX_WA_ID_DIGITS = 15

/**
 * Normalizes a WhatsApp id (`wa_id`, digits with country code) to digits only.
 * Returns null when the value cannot be a phone number.
 */
export function normalizeWaId(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length < MIN_WA_ID_DIGITS || digits.length > MAX_WA_ID_DIGITS) return null
  return digits
}

/** E.164 representation of a wa_id ("573001234567" -> "+573001234567"). */
export function waIdToE164(waId: string): string {
  return `+${waId.replace(/\D/g, '')}`
}

/**
 * Digit strings a free-form `Client.phone` may reduce to for this wa_id.
 *
 * - `full`: country code + number ("573001234567"), what "+57 300 123 4567" reduces to.
 * - `national`: the number without country code ("3001234567"). Only produced for the
 *   default country, because a stored value with no country code is always read as
 *   Colombian (see `parsePhone`); offering it for other countries would invite false matches.
 *
 * Client.phone itself is never rewritten: matching compares digits at query time.
 */
export function waIdMatchCandidates(waId: string): string[] {
  const digits = normalizeWaId(waId)
  if (!digits) return []
  const candidates = [digits]
  const { dialCode } = DEFAULT_PHONE_COUNTRY
  if (digits.startsWith(dialCode) && digits.length > dialCode.length) {
    candidates.push(digits.slice(dialCode.length))
  }
  return candidates
}
