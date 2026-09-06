'use client'

/**
 * El envoltorio de React alrededor de `correrEnTandas`.
 *
 * Toda la lógica —el corte en tandas, el acumulado, qué pasa cuando una falla—
 * vive en `lib/utils/control-import.ts` y tiene tests propios. Acá solo queda
 * el estado y el dibujo.
 */

import { useState } from 'react'

import {
  correrEnTandas,
  porcentajeDeAvance,
  type ProgresoImportacion,
  type RespuestaTanda,
  type ResultadoImportacion,
} from '@/lib/utils/control-import'

import { Progress } from '@/components/ui/progress'

export function useImportarPorTandas(
  ejecutar: (ids: string[]) => Promise<RespuestaTanda>
) {
  const [progreso, setProgreso] = useState<ProgresoImportacion | null>(null)

  async function importar(ids: string[]): Promise<ResultadoImportacion> {
    setProgreso({ total: ids.length, procesados: 0, creados: 0, sinDesglose: 0 })
    try {
      return await correrEnTandas(ids, ejecutar, setProgreso)
    } finally {
      setProgreso(null)
    }
  }

  return { progreso, enviando: progreso !== null, importar }
}

/** Barra y contador. Solo se dibuja mientras hay una importación andando. */
export function BarraDeProgreso({ progreso }: { progreso: ProgresoImportacion | null }) {
  if (!progreso) return null

  const { total, procesados, creados, sinDesglose } = progreso
  const porcentaje = porcentajeDeAvance(progreso)

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums">
          {procesados} de {total} registrados
        </span>
        <span className="tabular-nums text-muted-foreground">{porcentaje}%</span>
      </div>

      <Progress value={porcentaje} aria-label={`${procesados} de ${total}`} />

      <p className="text-xs text-muted-foreground">
        {procesados === 0
          ? 'Se pide el detalle de cada documento a Alegra para saber por qué servicio se cobró.'
          : `${creados} nuevo${creados === 1 ? '' : 's'}${
              creados < procesados ? '; el resto ya estaba registrado' : ''
            }.`}
        {sinDesglose > 0 &&
          ` ${sinDesglose} sin desglose por servicio — falta sincronizar el catálogo.`}
      </p>
    </div>
  )
}
