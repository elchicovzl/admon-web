'use client'

import * as React from 'react'
import { IMaskInput } from 'react-imask'

import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  formatPhone,
  getCountryByDialCode,
  parsePhone,
} from '@/lib/utils/phone'

interface PhoneInputProps {
  /** Stored value, "+<code> <number>" */
  value?: string | null
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  id?: string
  className?: string
}

// Free-form international numbers: digits and spaces, up to 15 digits
const FREE_MASK = (v: string) => /^[\d ]*$/.test(v) && v.replace(/\D/g, '').length <= 15

export function PhoneInput({ value, onChange, onBlur, disabled, id, className }: PhoneInputProps) {
  const parsed = parsePhone(value)
  // An empty number carries no code in the value, so remember the chosen country locally
  const [pickedDial, setPickedDial] = React.useState(parsed.dialCode)
  // Follow values loaded or reset after mount (e.g. an edit dialog filled later)
  React.useEffect(() => {
    if (value) setPickedDial(parsePhone(value).dialCode)
  }, [value])
  const dialCode = value ? parsed.dialCode : pickedDial
  const country = getCountryByDialCode(dialCode) ?? DEFAULT_PHONE_COUNTRY

  const handleCountry = (code: string) => {
    const next = PHONE_COUNTRIES.find((c) => c.code === code) ?? DEFAULT_PHONE_COUNTRY
    if (next.dialCode === dialCode) return
    setPickedDial(next.dialCode)
    // National numbers are not portable between masks, so a new country starts empty
    onChange('')
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Select value={country.code} onValueChange={handleCountry} disabled={disabled}>
        <SelectTrigger className="w-[104px] shrink-0" aria-label="País">
          <SelectValue>
            {country.flag} +{country.dialCode}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.flag} {c.name} (+{c.dialCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <IMaskInput
        key={country.code}
        id={id}
        mask={country.mask ?? (FREE_MASK as unknown as string)}
        value={parsed.national}
        onAccept={(val: string) => onChange(formatPhone(country.dialCode, val))}
        onBlur={onBlur}
        placeholder={country.mask ? '300 123 4567' : 'Número'}
        disabled={disabled}
        inputMode="tel"
        className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}
