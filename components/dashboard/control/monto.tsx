import { formatearMonto } from '@/lib/utils/control-format'
import { cn } from '@/lib/utils'

/**
 * Muestra un monto y pinta de rojo los negativos.
 *
 * En un libro de caja un saldo negativo es una señal, no un dato más: significa
 * que salió más plata de la que la caja tenía registrada. Leerlo en la misma
 * tinta que el resto obliga a buscar el signo menos entre puntos de miles, y a
 * esa altura ya se pasó de largo.
 *
 * No se pinta de verde lo positivo: si todo tiene color, nada resalta.
 */
export function Monto({
  valor,
  className,
  /** Atenúa el número. Para columnas de contexto, como el saldo inicial. */
  tenue = false,
}: {
  valor: number
  className?: string
  tenue?: boolean
}) {
  const negativo = valor < 0

  return (
    <span
      className={cn(
        'tabular-nums',
        negativo && 'text-red-600 dark:text-red-400',
        !negativo && tenue && 'text-muted-foreground',
        className
      )}
    >
      {formatearMonto(valor)}
    </span>
  )
}
