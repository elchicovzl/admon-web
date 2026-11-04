import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Circle } from 'lucide-react'

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  try {
    return format(new Date(d), 'd MMM yyyy', { locale: es })
  } catch {
    return '—'
  }
}

export function CheckCell({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground/50" />
  )
}
