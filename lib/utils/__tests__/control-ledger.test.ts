/**
 * control-ledger.test.ts
 *
 * Tests de los cálculos del libro de caja.
 *
 * Varios casos usan cifras REALES del Excel que este módulo reemplaza, porque
 * son errores que ya ocurrieron: si vuelven a pasar, tienen que reventar acá y
 * no en un cierre de mes.
 */

import { describe, it, expect } from 'vitest'
import { TipoMovimiento, GrupoCategoria } from '@prisma/client'
import {
  sumarMontos,
  redondearMonto,
  parseFechaCalendario,
  periodoDeFecha,
  periodoAnterior,
  efectoEnBolsillo,
  calcularSaldoFinal,
  calcularDiferencia,
  totalAbonado,
  saldoPrestamo,
  estadoPrestamo,
  margenServicio,
  estadoServicio,
  contraMovimiento,
  type MovimientoParaSaldo,
  type MovimientoDePrestamo,
  repartirEntreServicios,
  ingresoPorServicio,
} from '../control-ledger'

const EFECTIVO = 'cbolefectivo1'
const IVONE = 'cbolivone0001'
const CAJA_MENOR = 'cbolcajamenor'

function egreso(monto: number, bolsilloId = EFECTIVO): MovimientoParaSaldo {
  return { tipo: TipoMovimiento.EGRESO, monto, bolsilloId, bolsilloDestinoId: null }
}

function ingreso(monto: number, bolsilloId = EFECTIVO): MovimientoParaSaldo {
  return { tipo: TipoMovimiento.INGRESO, monto, bolsilloId, bolsilloDestinoId: null }
}

function traslado(monto: number, desde: string, hacia: string): MovimientoParaSaldo {
  return {
    tipo: TipoMovimiento.TRASLADO,
    monto,
    bolsilloId: desde,
    bolsilloDestinoId: hacia,
  }
}

function abono(monto: number): MovimientoDePrestamo {
  return {
    tipo: TipoMovimiento.INGRESO,
    monto,
    grupoCategoria: GrupoCategoria.PRESTAMO_ABONO,
  }
}

// ---------------------------------------------------------------------------

describe('sumarMontos', () => {
  it('no arrastra error de punto flotante', () => {
    // La suma ingenua da 0.30000000000000004
    expect(sumarMontos([0.1, 0.2])).toBe(0.3)
  })

  it('suma montos grandes sin perder centavos', () => {
    expect(sumarMontos([1076500.55, 946500.45, 100000.0])).toBe(2123001.0)
  })

  it('devuelve cero para una lista vacía', () => {
    expect(sumarMontos([])).toBe(0)
  })

  it('acepta negativos', () => {
    expect(sumarMontos([100000, -40000])).toBe(60000)
  })
})

describe('redondearMonto', () => {
  it('recorta a dos decimales', () => {
    expect(redondearMonto(1234.5678)).toBe(1234.57)
  })
})

// ---------------------------------------------------------------------------

describe('parseFechaCalendario y periodoDeFecha', () => {
  it('fija la fecha a medianoche UTC', () => {
    const fecha = parseFechaCalendario('2026-08-27')
    expect(fecha.toISOString()).toBe('2026-08-27T00:00:00.000Z')
  })

  it('deriva el periodo de la fecha', () => {
    expect(periodoDeFecha(parseFechaCalendario('2026-08-27'))).toBe('2026-08')
  })

  it('no corre de mes el último día del mes', () => {
    // Este es el caso que rompe si la fecha se construye en hora local:
    // en Bogotá (UTC-5) el 31 a la noche cae en el mes siguiente en UTC.
    const ultimoDia = parseFechaCalendario('2026-08-31')
    expect(periodoDeFecha(ultimoDia)).toBe('2026-08')
  })

  it('mantiene el mes en el primer día del mes', () => {
    expect(periodoDeFecha(parseFechaCalendario('2026-09-01'))).toBe('2026-09')
  })

  it('rellena el mes con cero a la izquierda', () => {
    expect(periodoDeFecha(parseFechaCalendario('2026-01-15'))).toBe('2026-01')
  })
})

describe('periodoAnterior', () => {
  it('retrocede un mes', () => {
    expect(periodoAnterior('2026-08')).toBe('2026-07')
  })

  it('cruza el cambio de año', () => {
    expect(periodoAnterior('2026-01')).toBe('2025-12')
  })

  it('mantiene el cero a la izquierda', () => {
    expect(periodoAnterior('2026-11')).toBe('2026-10')
  })
})

// ---------------------------------------------------------------------------

describe('efectoEnBolsillo', () => {
  it('un INGRESO suma en su bolsillo', () => {
    expect(efectoEnBolsillo(ingreso(50000), EFECTIVO)).toBe(50000)
  })

  it('un EGRESO resta en su bolsillo', () => {
    expect(efectoEnBolsillo(egreso(50000), EFECTIVO)).toBe(-50000)
  })

  it('ignora movimientos de otro bolsillo', () => {
    expect(efectoEnBolsillo(egreso(50000, IVONE), EFECTIVO)).toBe(0)
  })

  it('un TRASLADO resta en el origen', () => {
    expect(efectoEnBolsillo(traslado(200000, EFECTIVO, IVONE), EFECTIVO)).toBe(-200000)
  })

  it('el MISMO traslado suma en el destino', () => {
    // Una sola fila afecta a dos bolsillos en direcciones opuestas: por eso no
    // alcanza con mirar bolsilloId.
    expect(efectoEnBolsillo(traslado(200000, EFECTIVO, IVONE), IVONE)).toBe(200000)
  })

  it('un traslado ajeno no afecta a un tercer bolsillo', () => {
    expect(efectoEnBolsillo(traslado(200000, EFECTIVO, IVONE), CAJA_MENOR)).toBe(0)
  })
})

describe('calcularSaldoFinal', () => {
  it('parte del saldo inicial cuando no hay movimientos', () => {
    expect(calcularSaldoFinal(3487000, [], EFECTIVO)).toBe(3487000)
  })

  it('suma ingresos y resta egresos', () => {
    const movs = [ingreso(500000), egreso(140000), egreso(60000)]
    expect(calcularSaldoFinal(100000, movs, EFECTIVO)).toBe(400000)
  })

  it('un traslado deja la suma de los dos bolsillos igual', () => {
    const movs = [traslado(200000, EFECTIVO, IVONE)]
    const efectivo = calcularSaldoFinal(500000, movs, EFECTIVO)
    const ivone = calcularSaldoFinal(100000, movs, IVONE)

    expect(efectivo).toBe(300000)
    expect(ivone).toBe(300000)
    expect(efectivo + ivone).toBe(600000) // no se creó ni destruyó plata
  })

  it('una anulación se cancela sola contra el original', () => {
    // El contra-movimiento no se filtra en ningún lado: es un movimiento más,
    // en dirección contraria. Esa es toda la gracia de anular en vez de editar.
    const original = egreso(40000)
    const anulacion = contraMovimiento(original)

    expect(calcularSaldoFinal(100000, [original, anulacion], EFECTIVO)).toBe(100000)
  })

  it('NO se come filas del rango: el bug de septiembre-2026 del Excel', () => {
    // La celda K44 tenía =SUM(K30:K41) pero el bloque llegaba hasta K43, así
    // que BURBUJA (68.000) y ESTAMPADOS CAMISAS (134.500) quedaron afuera.
    // Registrado: 2.481.700. Real: 2.684.200. Faltaban 202.500.
    const septiembre = [
      egreso(743700), // YUDY POR DEBAJO (neto)
      egreso(946500), // TATY POR DEBAJO (neto)
      egreso(100000), // BRANDON
      egreso(100000), // YESIKA
      egreso(100000), // MARLENY
      egreso(100000), // JOSE Q
      egreso(100000), // ANDREA
      egreso(100000), // LUISA
      egreso(70000), // IVEC
      egreso(121500), // PAGO DE HEMYADY
      egreso(68000), // BURBUJA          ← el Excel se lo comió
      egreso(134500), // ESTAMPADOS CAMISAS ← y a este también
    ]

    const saldo = calcularSaldoFinal(3000000, septiembre, EFECTIVO)

    expect(3000000 - saldo).toBe(2684200)
    expect(3000000 - saldo).not.toBe(2481700)
  })
})

describe('calcularDiferencia', () => {
  it('distingue "no se contó" de "contó cero"', () => {
    // Colapsar estos dos casos es justamente lo que hacía invisibles los
    // descuadres del Excel.
    expect(calcularDiferencia(140000, null)).toBeNull()
    expect(calcularDiferencia(140000, undefined)).toBeNull()
    expect(calcularDiferencia(140000, 0)).toBe(-140000)
  })

  it('devuelve cero cuando cuadra', () => {
    expect(calcularDiferencia(140000, 140000)).toBe(0)
  })

  it('un faltante da negativo', () => {
    expect(calcularDiferencia(140000, 135000)).toBe(-5000)
  })

  it('un sobrante da positivo', () => {
    expect(calcularDiferencia(140000, 145000)).toBe(5000)
  })

  it('detecta el salto de ADMON entre noviembre y diciembre de 2025', () => {
    // ADMON cerró noviembre en 8.000.000 y abrió diciembre en 6.067.340.
    // En el Excel el saldo se pisó y la diferencia desapareció de la vista.
    expect(calcularDiferencia(8000000, 6067340)).toBe(-1932660)
  })
})

// ---------------------------------------------------------------------------

describe('totalAbonado y saldoPrestamo', () => {
  it('un préstamo sin abonos mantiene el monto original', () => {
    expect(saldoPrestamo(3000000, [])).toBe(3000000)
  })

  it('descuenta los abonos', () => {
    expect(saldoPrestamo(1000000, [abono(300000), abono(300000)])).toBe(400000)
  })

  it('NO cuenta el desembolso como abono', () => {
    // El desembolso también cuelga del préstamo, pero es lo que se prestó.
    const desembolso: MovimientoDePrestamo = {
      tipo: TipoMovimiento.EGRESO,
      monto: 1000000,
      grupoCategoria: GrupoCategoria.PRESTAMO_DESEMBOLSO,
    }

    expect(totalAbonado([desembolso, abono(300000)])).toBe(300000)
    expect(saldoPrestamo(1000000, [desembolso, abono(300000)])).toBe(700000)
  })

  it('un abono anulado vuelve a subir el saldo', () => {
    const anulacionDeAbono: MovimientoDePrestamo = {
      tipo: TipoMovimiento.EGRESO,
      monto: 300000,
      grupoCategoria: GrupoCategoria.PRESTAMO_ABONO,
    }

    expect(saldoPrestamo(1000000, [abono(300000), anulacionDeAbono])).toBe(1000000)
  })

  it('no baja de cero aunque se abone de más', () => {
    expect(saldoPrestamo(100000, [abono(150000)])).toBe(0)
  })
})

describe('estadoPrestamo', () => {
  it('sin abonos está ABIERTO', () => {
    expect(
      estadoPrestamo({ montoOriginal: 3000000, saldo: 3000000, marcadoIncobrable: false })
    ).toBe('ABIERTO')
  })

  it('con abonos parciales está PARCIAL', () => {
    expect(
      estadoPrestamo({ montoOriginal: 1000000, saldo: 400000, marcadoIncobrable: false })
    ).toBe('PARCIAL')
  })

  it('sin saldo está CANCELADO', () => {
    expect(
      estadoPrestamo({ montoOriginal: 1000000, saldo: 0, marcadoIncobrable: false })
    ).toBe('CANCELADO')
  })

  it('INCOBRABLE pisa a todo lo demás', () => {
    // Es la única parte del estado que no se puede derivar: es una decisión.
    expect(
      estadoPrestamo({ montoOriginal: 1000000, saldo: 400000, marcadoIncobrable: true })
    ).toBe('INCOBRABLE')
    expect(
      estadoPrestamo({ montoOriginal: 1000000, saldo: 0, marcadoIncobrable: true })
    ).toBe('INCOBRABLE')
  })

  it('el préstamo de 3.000.000 a Yudy queda ABIERTO, no archivado', () => {
    // Sin una sola marca de seguimiento en el Excel. Sigue activo y sin pagar:
    // si desaparece de la vista, vuelve el problema que teníamos.
    const saldo = saldoPrestamo(3000000, [])
    expect(
      estadoPrestamo({ montoOriginal: 3000000, saldo, marcadoIncobrable: false })
    ).toBe('ABIERTO')
  })
})

// ---------------------------------------------------------------------------

describe('margenServicio', () => {
  it('mensajería entrega el 100% y deja margen cero', () => {
    expect(margenServicio(520000, 520000)).toBe(0)
  })

  it('los exámenes médicos dejan la comisión', () => {
    expect(margenServicio(45000, 30000)).toBe(15000)
  })

  it('soporta la comisión de 10.000 de junio-2026', () => {
    // La comisión no es constante: en junio hubo dos de 10.000 y dos de 15.000.
    expect(margenServicio(40000, 30000)).toBe(10000)
  })

  it('admite margen negativo: un servicio puede cerrar en pérdida', () => {
    expect(margenServicio(30000, 45000)).toBe(-15000)
  })
})

describe('estadoServicio', () => {
  it('sin movimientos está PENDIENTE_COBRO', () => {
    expect(estadoServicio({ tieneIngreso: false, tieneEgreso: false })).toBe(
      'PENDIENTE_COBRO'
    )
  })

  it('cobrado pero sin entregar: hay plata de un tercero en la caja', () => {
    expect(estadoServicio({ tieneIngreso: true, tieneEgreso: false })).toBe(
      'COBRADO_SIN_ENTREGAR'
    )
  })

  it('entregado sin cobrar: Admon puso la plata', () => {
    expect(estadoServicio({ tieneIngreso: false, tieneEgreso: true })).toBe(
      'ENTREGADO_SIN_COBRAR'
    )
  })

  it('con las dos patas está COMPLETO', () => {
    expect(estadoServicio({ tieneIngreso: true, tieneEgreso: true })).toBe('COMPLETO')
  })
})

// ---------------------------------------------------------------------------

describe('contraMovimiento', () => {
  it('un EGRESO se anula con un INGRESO en el mismo bolsillo', () => {
    expect(contraMovimiento(egreso(40000))).toEqual({
      tipo: TipoMovimiento.INGRESO,
      monto: 40000,
      bolsilloId: EFECTIVO,
      bolsilloDestinoId: null,
    })
  })

  it('un INGRESO se anula con un EGRESO', () => {
    expect(contraMovimiento(ingreso(40000))).toEqual({
      tipo: TipoMovimiento.EGRESO,
      monto: 40000,
      bolsilloId: EFECTIVO,
      bolsilloDestinoId: null,
    })
  })

  it('un TRASLADO se anula con otro TRASLADO en sentido contrario', () => {
    // No con un INGRESO: la plata tiene que volver por donde vino, o el
    // bolsillo destino queda con un sobrante que nadie explica.
    expect(contraMovimiento(traslado(200000, EFECTIVO, IVONE))).toEqual({
      tipo: TipoMovimiento.TRASLADO,
      monto: 200000,
      bolsilloId: IVONE,
      bolsilloDestinoId: EFECTIVO,
    })
  })

  it('anular un traslado deja los dos bolsillos como estaban', () => {
    const original = traslado(200000, EFECTIVO, IVONE)
    const movs = [original, contraMovimiento(original)]

    expect(calcularSaldoFinal(500000, movs, EFECTIVO)).toBe(500000)
    expect(calcularSaldoFinal(100000, movs, IVONE)).toBe(100000)
  })
})

// ---------------------------------------------------------------------------

describe('pago "por debajo" con deducción (escenario real del Excel)', () => {
  it('el bruto sale de la caja y la deducción vuelve como abono', () => {
    // JACKE POR DEBAJO: bruto 1.076.500 menos 200.000 de abono a préstamo.
    // En el Excel esto se digitaba dos veces en dos hojas y no se cruzaba.
    // Acá son dos movimientos ligados por prestamoId.
    const bruto = egreso(1076500)
    const deduccion = ingreso(200000)

    const saldo = calcularSaldoFinal(2000000, [bruto, deduccion], EFECTIVO)

    // Salida neta de caja: 876.500, que es lo que la persona se lleva.
    expect(2000000 - saldo).toBe(876500)

    // Y el préstamo recibe su abono por los mismos 200.000.
    expect(saldoPrestamo(1000000, [abono(200000)])).toBe(800000)
  })
})


// ---------------------------------------------------------------------------

describe('repartirEntreServicios', () => {
  /**
   * Factura FEAD10134, tomada de la cuenta de producción.
   *
   *   Administracion         63.025 × 2 = 126.050  (IVA 19%)
   *   Recaudo para Terceros 429.600 + 149.400 = 579.000  (sin IVA)
   *   subtotal 705.050 · total 729.000 · totalPaid 729.000
   */
  const FACTURA_REAL = [
    { itemId: '2', precio: 63025, cantidad: 2, impuestos: [19] },
    { itemId: '4', precio: 429600, cantidad: 1 },
    { itemId: '4', precio: 149400, cantidad: 1 },
  ]

  it('imputa el IVA a la línea que lo generó, no a prorrata', () => {
    // Este es el test que justifica toda la función: repartir el IVA parejo
    // le adjudicaría al recaudo un impuesto que no generó.
    //
    // Se compara con tolerancia de un peso y no al centavo a propósito. Alegra
    // REDONDEA el IVA: 126.050 × 19% = 23.949,50 y en la factura figura 23.950,
    // por eso el total es 729.000 y no 728.999,50. Perseguir el redondeo
    // interno de Alegra sería un test frágil que se rompe cuando ellos cambien
    // de criterio; lo que tiene que ser exacto es la SUMA, y eso se verifica
    // en el test de abajo.
    const partes = repartirEntreServicios(FACTURA_REAL, 729000)

    const porItem = Object.fromEntries(partes.map((p) => [p.itemId, p.monto]))
    expect(Math.abs(porItem['2']! - 150000)).toBeLessThan(1) // 126.050 × 1,19
    expect(Math.abs(porItem['4']! - 579000)).toBeLessThan(1) // sin IVA
  })

  it('fusiona las líneas repetidas del mismo servicio', () => {
    // "Recaudo para Terceros" viene dos veces en la factura real.
    const partes = repartirEntreServicios(FACTURA_REAL, 729000)

    expect(partes).toHaveLength(2)
    expect(partes.filter((p) => p.itemId === '4')).toHaveLength(1)
  })

  it('la suma da EXACTAMENTE el monto cobrado', () => {
    const partes = repartirEntreServicios(FACTURA_REAL, 729000)

    expect(sumarMontos(partes.map((p) => p.monto))).toBe(729000)
  })

  it('reparte a prorrata cuando la factura está a medio pagar', () => {
    // Al libro entra lo cobrado, no lo facturado: se mantiene la composición
    // del documento y se reparte el cobro en esa proporción.
    const partes = repartirEntreServicios(FACTURA_REAL, 364500) // la mitad

    const porItem = Object.fromEntries(partes.map((p) => [p.itemId, p.monto]))
    expect(Math.abs(porItem['2']! - 75000)).toBeLessThan(1)
    expect(Math.abs(porItem['4']! - 289500)).toBeLessThan(1)
    // La suma sí es exacta, siempre.
    expect(sumarMontos(partes.map((p) => p.monto))).toBe(364500)
  })

  it('cierra exacto aunque la proporción no sea redonda', () => {
    // Tres tercios de 100 no dan 33,33 × 3. Alguien tiene que absorber el resto.
    const partes = repartirEntreServicios(
      [
        { itemId: 'a', precio: 100, cantidad: 1 },
        { itemId: 'b', precio: 100, cantidad: 1 },
        { itemId: 'c', precio: 100, cantidad: 1 },
      ],
      100
    )

    expect(sumarMontos(partes.map((p) => p.monto))).toBe(100)
  })

  it('cotización de una sola línea: se lleva todo', () => {
    const partes = repartirEntreServicios(
      [{ itemId: '3', precio: 90000, cantidad: 2 }],
      180000
    )

    expect(partes).toEqual([{ itemId: '3', monto: 180000 }])
  })

  it('descuenta el descuento de la línea', () => {
    const partes = repartirEntreServicios(
      [{ itemId: 'a', precio: 100000, cantidad: 1, descuento: 20000 }],
      80000
    )

    expect(partes).toEqual([{ itemId: 'a', monto: 80000 }])
  })

  it('descarta las partes que redondean a cero sin descuadrar la suma', () => {
    // La línea despreciable no merece una fila de desglose, pero su peso no
    // puede evaporarse: tiene que quedar dentro de otra parte.
    const partes = repartirEntreServicios(
      [
        { itemId: 'grande', precio: 1000000, cantidad: 1 },
        { itemId: 'polvo', precio: 0.001, cantidad: 1 },
      ],
      100
    )

    expect(partes.every((p) => p.monto > 0)).toBe(true)
    expect(sumarMontos(partes.map((p) => p.monto))).toBe(100)
  })

  it('no inventa un reparto cuando no hay nada que repartir', () => {
    expect(repartirEntreServicios([], 1000)).toEqual([])
    expect(repartirEntreServicios(FACTURA_REAL, 0)).toEqual([])
    expect(repartirEntreServicios(FACTURA_REAL, -500)).toEqual([])
    expect(repartirEntreServicios([{ itemId: 'a', precio: 0, cantidad: 5 }], 1000)).toEqual([])
  })

  it('ignora líneas de importe negativo en vez de restarlas', () => {
    // Un importe negativo no es un servicio cobrado; si se colara, el reparto
    // le daría un monto negativo a un desglose que la base rechaza.
    const partes = repartirEntreServicios(
      [
        { itemId: 'a', precio: 100, cantidad: 1 },
        { itemId: 'b', precio: -50, cantidad: 1 },
      ],
      100
    )

    expect(partes).toEqual([{ itemId: 'a', monto: 100 }])
  })
})


// ---------------------------------------------------------------------------

describe('ingresoPorServicio', () => {
  const ing = (monto: number, enTransito = false) => ({
    tipo: TipoMovimiento.INGRESO,
    monto,
    enTransito,
  })

  it('descuenta la plata en tránsito de los ingresos', () => {
    // Factura de 729.000: 150.000 de Administracion, 579.000 de recaudo.
    const r = ingresoPorServicio(729_000, [ing(150_000), ing(579_000, true)])

    expect(r.enTransito).toBe(579_000)
    expect(r.netos).toBe(150_000)
  })

  it('informa cuánto de los ingresos NO tiene desglose', () => {
    // Sin este número, "ingresos netos" parecería exacto cuando en realidad
    // solo descontó la parte que pudo mirar.
    const r = ingresoPorServicio(1_000_000, [ing(150_000), ing(579_000, true)])

    expect(r.conDesglose).toBe(729_000)
    expect(r.sinDesglose).toBe(271_000)
  })

  it('sin desglose no descuenta nada: los ingresos quedan enteros', () => {
    const r = ingresoPorServicio(500_000, [])

    expect(r.conDesglose).toBe(0)
    expect(r.sinDesglose).toBe(500_000)
    expect(r.enTransito).toBe(0)
    expect(r.netos).toBe(500_000)
  })

  it('no resta los detalles de EGRESO', () => {
    // Una anulación espeja el desglose del original, pero `totalIngresos`
    // tampoco descuenta anulaciones: restarlas acá dejaría este número fuera
    // de escala con el resto del reporte.
    const r = ingresoPorServicio(729_000, [
      ing(579_000, true),
      { tipo: TipoMovimiento.EGRESO, monto: 579_000, enTransito: true },
    ])

    expect(r.enTransito).toBe(579_000)
  })

  it('nunca devuelve un sinDesglose negativo', () => {
    // Un número negativo acá se leería como un error del libro, no del dato.
    const r = ingresoPorServicio(100_000, [ing(150_000)])

    expect(r.sinDesglose).toBe(0)
  })

  it('todo en tránsito deja los ingresos netos en cero', () => {
    const r = ingresoPorServicio(579_000, [ing(579_000, true)])

    expect(r.netos).toBe(0)
  })
})
