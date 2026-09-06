/**
 * control-import.test.ts
 *
 * El corte en tandas de la importación de cobros. Lo que se prueba acá no es
 * la barra de progreso: es que si una tanda falla a mitad de camino el
 * operador sepa exactamente qué quedó registrado y qué no.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  correrEnTandas,
  porcentajeDeAvance,
  TAMANO_TANDA,
  type RespuestaTanda,
} from '../control-import'

/** Ids de juguete: "1", "2", … */
const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1))

/** Una acción que siempre anda y reporta un creado por id. */
const ok = async (tanda: string[]): Promise<RespuestaTanda> => ({
  success: true,
  data: { creados: tanda.length },
})

describe('correrEnTandas', () => {
  it('parte la lista en tandas del tamaño pedido', async () => {
    const ejecutar = vi.fn(ok)

    await correrEnTandas(ids(25), ejecutar, undefined, 10)

    expect(ejecutar).toHaveBeenCalledTimes(3)
    expect(ejecutar.mock.calls[0]![0]).toHaveLength(10)
    expect(ejecutar.mock.calls[2]![0]).toEqual(['21', '22', '23', '24', '25'])
  })

  it('las tandas van una detrás de otra, nunca en paralelo', async () => {
    // El limitador de Alegra vive en el proceso del servidor: disparar varias
    // tandas juntas se comería la cuota de 150 req/min de toda la cuenta.
    let enVuelo = 0
    let maximoSimultaneo = 0

    await correrEnTandas(
      ids(30),
      async (tanda) => {
        enVuelo += 1
        maximoSimultaneo = Math.max(maximoSimultaneo, enVuelo)
        await Promise.resolve()
        enVuelo -= 1
        return { success: true, data: { creados: tanda.length } }
      },
      undefined,
      10
    )

    expect(maximoSimultaneo).toBe(1)
  })

  it('acumula creados y sinDesglose de todas las tandas', async () => {
    const r = await correrEnTandas(
      ids(20),
      async (tanda) => ({
        success: true,
        data: { creados: tanda.length, sinDesglose: 2 },
      }),
      undefined,
      10
    )

    expect(r.resumen).toEqual({
      total: 20,
      procesados: 20,
      creados: 20,
      sinDesglose: 4,
    })
    expect(r.error).toBeUndefined()
  })

  it('avisa el avance después de CADA tanda', async () => {
    const avances: number[] = []

    await correrEnTandas(ids(25), ok, (p) => avances.push(p.procesados), 10)

    expect(avances).toEqual([10, 20, 25])
  })

  it('el avance que reporta es una copia, no la referencia mutable', async () => {
    // Si fuera la misma referencia, React vería siempre el mismo objeto y la
    // barra no se movería — o peor, mostraría el estado final desde el primer
    // tick.
    const capturados: Array<{ procesados: number }> = []

    await correrEnTandas(ids(20), ok, (p) => capturados.push(p), 10)

    expect(capturados[0]!.procesados).toBe(10)
    expect(capturados[1]!.procesados).toBe(20)
  })

  // -------------------------------------------------------------------------
  // Fallas a mitad de camino: la razón de ser del archivo
  // -------------------------------------------------------------------------

  it('se corta en la primera tanda que falla', async () => {
    const ejecutar = vi.fn(async (tanda: string[]): Promise<RespuestaTanda> => {
      if (tanda.includes('11')) return { success: false, error: 'Alegra no responde' }
      return { success: true, data: { creados: tanda.length } }
    })

    const r = await correrEnTandas(ids(30), ejecutar, undefined, 10)

    // Seguir con las que quedan sería peor: fallarían igual y el operador
    // terminaría con una fila de errores en vez de saber dónde quedó.
    expect(ejecutar).toHaveBeenCalledTimes(2)
    expect(r.error).toBe('Alegra no responde')
  })

  it('devuelve SOLO los ids que alcanzaron a procesarse', async () => {
    // Es lo que permite desmarcar los importados y dejar marcados los que
    // faltan, para reintentar sin volver a elegirlos uno por uno.
    const r = await correrEnTandas(
      ids(30),
      async (tanda) =>
        tanda.includes('11')
          ? { success: false, error: 'se cayó' }
          : { success: true, data: { creados: tanda.length } },
      undefined,
      10
    )

    expect(r.completados).toEqual(ids(10))
    expect(r.resumen.procesados).toBe(10)
    expect(r.resumen.creados).toBe(10)
  })

  it('una excepción no pierde lo que ya se registró', async () => {
    // Una Server Action que revienta —red caída, deploy a mitad— llega como
    // excepción y no como `success: false`.
    const r = await correrEnTandas(
      ids(30),
      async (tanda) => {
        if (tanda.includes('11')) throw new Error('ECONNRESET')
        return { success: true, data: { creados: tanda.length } }
      },
      undefined,
      10
    )

    expect(r.completados).toEqual(ids(10))
    expect(r.error).toContain('conexión')
  })

  // -------------------------------------------------------------------------
  // Bordes
  // -------------------------------------------------------------------------

  it('sin ids no llama a nada', async () => {
    const ejecutar = vi.fn(ok)

    const r = await correrEnTandas([], ejecutar)

    expect(ejecutar).not.toHaveBeenCalled()
    expect(r.completados).toEqual([])
    expect(r.resumen.total).toBe(0)
  })

  it('menos ids que el tamaño de tanda: una sola llamada', async () => {
    const ejecutar = vi.fn(ok)

    await correrEnTandas(ids(3), ejecutar, undefined, 10)

    expect(ejecutar).toHaveBeenCalledTimes(1)
    expect(ejecutar.mock.calls[0]![0]).toEqual(['1', '2', '3'])
  })

  it('un tamaño de tanda inválido no cuelga el bucle', async () => {
    // Con paso 0 el índice nunca avanzaría y el navegador se congelaría.
    const ejecutar = vi.fn(ok)

    const r = await correrEnTandas(ids(3), ejecutar, undefined, 0)

    expect(ejecutar).toHaveBeenCalledTimes(3)
    expect(r.resumen.procesados).toBe(3)
  })

  it('una tanda que no informa datos cuenta como procesada igual', async () => {
    const r = await correrEnTandas(ids(5), async () => ({ success: true }), undefined, 10)

    expect(r.resumen.procesados).toBe(5)
    expect(r.resumen.creados).toBe(0)
  })

  it('el tamaño por defecto es el acordado', async () => {
    const ejecutar = vi.fn(ok)

    await correrEnTandas(ids(TAMANO_TANDA + 1), ejecutar)

    expect(ejecutar).toHaveBeenCalledTimes(2)
  })
})

describe('porcentajeDeAvance', () => {
  it('redondea a entero', () => {
    expect(
      porcentajeDeAvance({ total: 3, procesados: 1, creados: 1, sinDesglose: 0 })
    ).toBe(33)
  })

  it('arranca en 0 y termina en 100', () => {
    expect(
      porcentajeDeAvance({ total: 81, procesados: 0, creados: 0, sinDesglose: 0 })
    ).toBe(0)
    expect(
      porcentajeDeAvance({ total: 81, procesados: 81, creados: 81, sinDesglose: 0 })
    ).toBe(100)
  })

  it('sin total no divide por cero', () => {
    expect(
      porcentajeDeAvance({ total: 0, procesados: 0, creados: 0, sinDesglose: 0 })
    ).toBe(0)
  })
})
