'use client'

import { IMaskInput } from 'react-imask'
import { cn } from '@/lib/utils'

/**
 * Campo de monto en pesos colombianos.
 *
 * Convención de Colombia: punto para los miles y coma para los decimales
 * ($ 1.234.567). Es al revés que en inglés, y escribir "40,000" pensando en
 * cuarenta mil daría cuarenta pesos con cero centavos.
 *
 * `scale={0}` — sin decimales. El centavo existe legalmente pero no circula:
 * ningún monto del libro que este módulo reemplaza tiene fracción. Permitir
 * decimales acá solo abre la puerta a que un punto de más convierta 40.000 en
 * 40. La columna en la base sigue siendo Decimal(14,2) para los cálculos
 * derivados (una diferencia de cierre sí puede no ser redonda), pero lo que se
 * digita a mano es entero.
 *
 * Devuelve `number | undefined`, no el string con formato: el separador es
 * cosa de la vista y no debe llegar nunca al schema.
 */
interface Props {
  value: number | undefined
  onChange: (valor: number | undefined) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  id?: string
}

export function MontoInput({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = '40.000',
  id,
}: Props) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
      >
        $
      </span>
      <IMaskInput
        id={id}
        mask={Number}
        thousandsSeparator="."
        radix=","
        scale={0}
        min={0}
        // 99.999.999.999 — el techo de Decimal(14,2) menos los dos decimales.
        max={99_999_999_999}
        // Con unmask, `value` entra y sale sin los separadores.
        unmask
        value={value === undefined || value === null ? '' : String(value)}
        onAccept={(_valorConFormato, mask) => {
          const crudo = mask.unmaskedValue
          onChange(crudo === '' ? undefined : Number(crudo))
        }}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent py-1 pl-7 pr-3 text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Tabular para que los dígitos no bailen al escribir.
          'tabular-nums'
        )}
      />
    </div>
  )
}
