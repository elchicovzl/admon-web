/**
 * control-recibo.test.ts
 *
 * Tests de la lógica pura del recibo de pago: número, monto en letras, reglas
 * de emisión y modelo de vista del PDF.
 */

import { describe, it, expect } from 'vitest'
import {
  CLAVE_CONSECUTIVO_RECIBO,
  formatearNumeroRecibo,
  montoEnLetras,
  validarEmisionRecibo,
  armarDatosRecibo,
  sumaDeLineas,
  esLineaVacia,
  normalizarEntradaMovimiento,
  puedeEmitirReciboDeFila,
  type EntradaValidarEmisionRecibo,
  type FilaEmitibleRecibo,
} from '../control-recibo'
import { EMISOR_RECIBO, PLACEHOLDER_EMISOR, emisorReciboCompleto } from '@/lib/config/recibo-emisor'

describe('formatearNumeroRecibo', () => {
  it('pads to 4 digits', () => {
    expect(formatearNumeroRecibo(1)).toBe('RP-0001')
    expect(formatearNumeroRecibo(42)).toBe('RP-0042')
    expect(formatearNumeroRecibo(9999)).toBe('RP-9999')
  })

  it('keeps all digits of larger numbers', () => {
    expect(formatearNumeroRecibo(12345)).toBe('RP-12345')
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'throws on invalid number %s',
    (n) => {
      expect(() => formatearNumeroRecibo(n)).toThrow('Número de recibo inválido')
    }
  )

  it('exposes the counter key', () => {
    expect(CLAVE_CONSECUTIVO_RECIBO).toBe('RECIBO_PAGO')
  })
})

describe('montoEnLetras', () => {
  it.each([
    [0, 'CERO PESOS M/CTE'],
    [1, 'UN PESO M/CTE'],
    [2, 'DOS PESOS M/CTE'],
    [16, 'DIECISÉIS PESOS M/CTE'],
    [21, 'VEINTIÚN PESOS M/CTE'],
    [31, 'TREINTA Y UN PESOS M/CTE'],
    [100, 'CIEN PESOS M/CTE'],
    [101, 'CIENTO UN PESOS M/CTE'],
    [500, 'QUINIENTOS PESOS M/CTE'],
    [1000, 'MIL PESOS M/CTE'],
    [1001, 'MIL UN PESOS M/CTE'],
    [21000, 'VEINTIÚN MIL PESOS M/CTE'],
    [100000, 'CIEN MIL PESOS M/CTE'],
    [150000, 'CIENTO CINCUENTA MIL PESOS M/CTE'],
    [729000, 'SETECIENTOS VEINTINUEVE MIL PESOS M/CTE'],
    [1250000, 'UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS M/CTE'],
    [1000000, 'UN MILLÓN DE PESOS M/CTE'],
    [2000000, 'DOS MILLONES DE PESOS M/CTE'],
    [2500000, 'DOS MILLONES QUINIENTOS MIL PESOS M/CTE'],
    [21000000, 'VEINTIÚN MILLONES DE PESOS M/CTE'],
    [101000001, 'CIENTO UN MILLONES UN PESOS M/CTE'],
    [1000000000, 'MIL MILLONES DE PESOS M/CTE'],
    [
      999999999999,
      'NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE MILLONES NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE PESOS M/CTE',
    ],
  ])('%s → %s', (monto, esperado) => {
    expect(montoEnLetras(monto)).toBe(esperado)
  })

  it('adds cents when present', () => {
    expect(montoEnLetras(1000.5)).toBe('MIL PESOS CON 50/100 M/CTE')
    expect(montoEnLetras(1.05)).toBe('UN PESO CON 05/100 M/CTE')
    expect(montoEnLetras(0.5)).toBe('CERO PESOS CON 50/100 M/CTE')
  })

  it('rejects negative, non-finite and too large input', () => {
    expect(() => montoEnLetras(-1)).toThrow(Error)
    expect(() => montoEnLetras(NaN)).toThrow(Error)
    expect(() => montoEnLetras(Infinity)).toThrow(Error)
    expect(() => montoEnLetras(1_000_000_000_000)).toThrow(Error)
  })
})

describe('validarEmisionRecibo', () => {
  const valido: EntradaValidarEmisionRecibo = {
    tipo: 'INGRESO',
    monto: 300000,
    alegraInvoiceId: null,
    alegraEstimateId: null,
    alegraPaymentId: null,
    tieneRecibo: false,
    cliente: { nombre: 'Ana Pérez' },
    lineas: [{ monto: 100000 }, { monto: 200000 }],
  }

  const rechazo = (cambios: Partial<EntradaValidarEmisionRecibo>) =>
    validarEmisionRecibo({ ...valido, ...cambios })

  it('accepts a valid income', () => {
    expect(validarEmisionRecibo(valido)).toEqual({ ok: true })
  })

  it('rejects non-income movements', () => {
    const r = rechazo({ tipo: 'EGRESO' })
    expect(r.ok).toBe(false)
  })

  it.each([
    ['alegraInvoiceId'],
    ['alegraEstimateId'],
    ['alegraPaymentId'],
  ] as const)('rejects incomes with %s', (campo) => {
    const r = rechazo({ [campo]: 'A-1' })
    expect(r).toEqual({
      ok: false,
      error: 'Este ingreso viene de un documento de Alegra y no admite recibo de pago.',
    })
  })

  it('rejects incomes that already have a receipt', () => {
    expect(rechazo({ tieneRecibo: true })).toEqual({
      ok: false,
      error: 'Este ingreso ya tiene un recibo de pago.',
    })
  })

  it('rejects incomes without a client', () => {
    expect(rechazo({ cliente: null })).toEqual({
      ok: false,
      error: 'El recibo requiere un cliente.',
    })
  })

  it('rejects incomes without lines', () => {
    expect(rechazo({ lineas: [] })).toEqual({
      ok: false,
      error: 'El recibo requiere al menos un servicio.',
    })
  })

  it('rejects zero or negative lines', () => {
    expect(rechazo({ lineas: [{ monto: 300000 }, { monto: 0 }] }).ok).toBe(false)
    expect(rechazo({ lineas: [{ monto: 400000 }, { monto: -100000 }] }).ok).toBe(false)
  })

  it('rejects lines that do not sum the amount', () => {
    expect(rechazo({ monto: 300001 })).toEqual({
      ok: false,
      error: 'La suma de los servicios debe ser igual al monto del ingreso.',
    })
  })

  it('sums with cent precision (0.1 + 0.2 equals 0.3)', () => {
    expect(rechazo({ monto: 0.3, lineas: [{ monto: 0.1 }, { monto: 0.2 }] })).toEqual({
      ok: true,
    })
  })

  it('rounds an unrounded float amount before comparing', () => {
    expect(
      rechazo({ monto: 0.30000000000000004, lineas: [{ monto: 0.1 }, { monto: 0.2 }] })
    ).toEqual({ ok: true })
  })

  it('reports the first broken rule in order', () => {
    const r = rechazo({ tipo: 'EGRESO', tieneRecibo: true, cliente: null, lineas: [] })
    expect(r).toEqual({ ok: false, error: 'Solo se puede emitir recibo para un ingreso.' })
  })
})

describe('armarDatosRecibo', () => {
  const fecha = new Date(Date.UTC(2026, 9, 4))

  it('builds the view model', () => {
    const datos = armarDatosRecibo({
      numero: 7,
      fecha,
      clienteNombre: 'Ana Pérez',
      clienteDocumento: '1020304050',
      lineas: [
        { servicio: 'Administración', referencia: 'Octubre', monto: 150000 },
        { servicio: 'Afiliación', referencia: null, monto: 1100000 },
      ],
      monto: 1250000,
      bolsilloNombre: 'Bancolombia',
      concepto: 'Pago de servicios',
      anulado: false,
    })

    expect(datos).toEqual({
      numeroFormateado: 'RP-0007',
      fecha,
      cliente: { nombre: 'Ana Pérez', documento: '1020304050' },
      lineas: [
        { servicio: 'Administración', referencia: 'Octubre', monto: 150000 },
        { servicio: 'Afiliación', referencia: null, monto: 1100000 },
      ],
      total: 1250000,
      totalEnLetras: 'UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS M/CTE',
      medioDePago: 'Bancolombia',
      concepto: 'Pago de servicios',
      anulado: false,
    })
  })

  it('throws when the lines do not sum the amount', () => {
    expect(() =>
      armarDatosRecibo({
        numero: 1,
        fecha,
        clienteNombre: 'Ana',
        clienteDocumento: null,
        lineas: [{ servicio: 'X', referencia: null, monto: 100 }],
        monto: 101,
        bolsilloNombre: 'Caja',
        concepto: 'c',
        anulado: false,
      })
    ).toThrow('no coincide')
  })

  it('carries the annulled flag and a null document', () => {
    const datos = armarDatosRecibo({
      numero: 1,
      fecha,
      clienteNombre: 'Ana',
      clienteDocumento: null,
      lineas: [{ servicio: 'X', referencia: null, monto: 1 }],
      monto: 1,
      bolsilloNombre: 'Caja',
      concepto: 'c',
      anulado: true,
    })
    expect(datos.anulado).toBe(true)
    expect(datos.cliente.documento).toBeNull()
    expect(datos.totalEnLetras).toBe('UN PESO M/CTE')
  })
})

describe('emisorReciboCompleto', () => {
  const completo = {
    razonSocial: 'Empresa S.A.S.',
    nit: '900123456-7',
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Bogotá',
    telefono: '3000000000',
    email: 'contacto@example.com',
    logoPath: 'public/images/logo-wordmark.png',
  }

  it('is true when no field is a placeholder', () => {
    expect(emisorReciboCompleto(completo)).toBe(true)
  })

  it('is false when any field is still the placeholder', () => {
    expect(emisorReciboCompleto({ ...completo, nit: PLACEHOLDER_EMISOR })).toBe(false)
  })

  it('defaults to the real issuer config', () => {
    expect(emisorReciboCompleto()).toBe(emisorReciboCompleto(EMISOR_RECIBO))
  })
})

describe('sumaDeLineas', () => {
  it('suma las líneas sin error de coma flotante', () => {
    expect(sumaDeLineas([{ monto: 0.1 }, { monto: 0.2 }])).toBe(0.3)
  })

  it('cuenta como cero las líneas sin monto todavía', () => {
    expect(sumaDeLineas([{ monto: 1000 }, {}, { monto: null }])).toBe(1000)
  })

  it('devuelve cero sin líneas', () => {
    expect(sumaDeLineas([])).toBe(0)
  })
})

describe('puedeEmitirReciboDeFila', () => {
  const base: FilaEmitibleRecibo = {
    tipo: 'INGRESO',
    estaAnulado: false,
    anulaMovimientoId: null,
    tieneDocumentoAlegra: false,
    cantidadServicios: 2,
    recibo: null,
  }

  it('ofrece emitir en un ingreso manual con desglose y sin recibo', () => {
    expect(puedeEmitirReciboDeFila(base)).toBe(true)
  })

  it.each([
    ['no es ingreso', { tipo: 'EGRESO' }],
    ['está anulado', { estaAnulado: true }],
    ['es una anulación', { anulaMovimientoId: 'mov1' }],
    ['viene de Alegra', { tieneDocumentoAlegra: true }],
    ['no tiene desglose', { cantidadServicios: 0 }],
    ['ya tiene recibo', { recibo: { id: 'r1', numero: 1 } }],
  ])('no ofrece emitir si %s', (_motivo, cambio) => {
    expect(puedeEmitirReciboDeFila({ ...base, ...cambio })).toBe(false)
  })
})

describe('normalizarEntradaMovimiento', () => {
  it('drops an empty servicios array', () => {
    const resultado = normalizarEntradaMovimiento({ concepto: 'x', servicios: [] })
    expect(resultado.servicios).toBeUndefined()
    expect(resultado.concepto).toBe('x')
  })

  it('keeps a non-empty servicios array', () => {
    const servicios = [{ servicioAlegraId: 's1', monto: 100 }]
    const entrada = { concepto: 'x', servicios }
    expect(normalizarEntradaMovimiento(entrada).servicios).toBe(servicios)
  })

  it('leaves input without servicios untouched', () => {
    const entrada = { concepto: 'x' } as { concepto: string; servicios?: unknown[] }
    expect(normalizarEntradaMovimiento(entrada)).toBe(entrada)
  })
})

describe('esLineaVacia', () => {
  it('is true with no service and no amount', () => {
    expect(esLineaVacia({ servicioAlegraId: '', monto: undefined })).toBe(true)
    expect(esLineaVacia({ servicioAlegraId: null, monto: null })).toBe(true)
  })

  it('is false when a service or an amount was filled', () => {
    expect(esLineaVacia({ servicioAlegraId: 's1', monto: undefined })).toBe(false)
    expect(esLineaVacia({ servicioAlegraId: '', monto: 500 })).toBe(false)
    expect(esLineaVacia({ servicioAlegraId: 's1', monto: 500 })).toBe(false)
  })
})
