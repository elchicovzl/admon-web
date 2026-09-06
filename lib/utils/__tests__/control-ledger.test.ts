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
  ingresosPorNaturaleza,
  contrastarIntermediados,
  resumirNomina,
  egresoRealDelPeriodo,
  desglosarPeriodo,
  SIN_DESGLOSE,
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


// ---------------------------------------------------------------------------

describe('ingresosPorNaturaleza', () => {
  const mov = (
    grupo: GrupoCategoria,
    monto: number,
    detalles: Array<{ monto: number; enTransito: boolean }> = [],
    tipo: TipoMovimiento = TipoMovimiento.INGRESO,
    categoria = 'Categoría'
  ) => ({ tipo, grupo, categoria, monto, detalles })

  it('separa lo que entró por cotización de lo que entró por factura', () => {
    const r = ingresosPorNaturaleza([
      mov(GrupoCategoria.COBRO_COTIZACION, 6_408_000),
      mov(GrupoCategoria.COBRO_FACTURA, 729_000),
    ])

    expect(r.cotizacion.bruto).toBe(6_408_000)
    expect(r.factura.bruto).toBe(729_000)
  })

  it('manda a "otros" lo que no es ni C ni F', () => {
    // Un abono a préstamo también es un ingreso. Sin este bucket, C + F no
    // daría el total y las tarjetas mentirían por omisión.
    const r = ingresosPorNaturaleza([
      mov(GrupoCategoria.COBRO_COTIZACION, 100_000),
      mov(GrupoCategoria.PRESTAMO_ABONO, 400_000),
      mov(GrupoCategoria.DEVOLUCION, 50_000),
    ])

    expect(r.otros.bruto).toBe(450_000)
    expect(r.cotizacion.bruto + r.factura.bruto + r.otros.bruto).toBe(550_000)
  })

  it('descuenta la plata en tránsito dentro de cada naturaleza', () => {
    // El recaudo para terceros viaja en las facturas, no en las cotizaciones.
    const r = ingresosPorNaturaleza([
      mov(GrupoCategoria.COBRO_COTIZACION, 80_000, [
        { monto: 80_000, enTransito: false },
      ]),
      mov(GrupoCategoria.COBRO_FACTURA, 729_000, [
        { monto: 150_000, enTransito: false },
        { monto: 579_000, enTransito: true },
      ]),
    ])

    expect(r.cotizacion.enTransito).toBe(0)
    expect(r.cotizacion.neto).toBe(80_000)
    expect(r.factura.enTransito).toBe(579_000)
    expect(r.factura.neto).toBe(150_000)
  })

  it('sin desglose, el neto es igual al bruto', () => {
    const r = ingresosPorNaturaleza([mov(GrupoCategoria.COBRO_FACTURA, 729_000)])

    expect(r.factura.neto).toBe(729_000)
  })

  it('ignora los egresos', () => {
    const r = ingresosPorNaturaleza([
      mov(GrupoCategoria.COBRO_FACTURA, 729_000, [], TipoMovimiento.EGRESO),
      mov(GrupoCategoria.GASTO_OPERATIVO, 23_000, [], TipoMovimiento.EGRESO),
    ])

    expect(r.factura.bruto).toBe(0)
    expect(r.otros.bruto).toBe(0)
  })

  it('sin movimientos devuelve las tres naturalezas en cero', () => {
    // El estado de hoy: 172 movimientos migrados y los 172 son egresos.
    const r = ingresosPorNaturaleza([])

    expect(r.cotizacion).toEqual({ bruto: 0, enTransito: 0, neto: 0, porCategoria: [] })
    expect(r.factura).toEqual({ bruto: 0, enTransito: 0, neto: 0, porCategoria: [] })
    expect(r.otros).toEqual({ bruto: 0, enTransito: 0, neto: 0, porCategoria: [] })
  })

  it('desglosa "otros" por categoría, de mayor a menor', () => {
    // Un número agregado que junta abonos, devoluciones y cargas manuales no
    // se puede cuadrar contra nada. Con el desglose al lado, sí.
    const r = ingresosPorNaturaleza([
      mov(GrupoCategoria.PRESTAMO_ABONO, 400_000, [], TipoMovimiento.INGRESO, 'Abono a préstamo'),
      mov(GrupoCategoria.DEVOLUCION, 50_000, [], TipoMovimiento.INGRESO, 'Devolución a cliente'),
      mov(GrupoCategoria.PRESTAMO_ABONO, 100_000, [], TipoMovimiento.INGRESO, 'Abono a préstamo'),
    ])

    expect(r.otros.bruto).toBe(550_000)
    expect(r.otros.porCategoria).toEqual([
      { nombre: 'Abono a préstamo', monto: 500_000 },
      { nombre: 'Devolución a cliente', monto: 50_000 },
    ])
  })

  it('el desglose de cada naturaleza suma su propio bruto', () => {
    // Si no cerrara, la nota contradiría al número que tiene arriba.
    const r = ingresosPorNaturaleza([
      mov(GrupoCategoria.PRESTAMO_ABONO, 400_000, [], TipoMovimiento.INGRESO, 'Abono a préstamo'),
      mov(GrupoCategoria.OTRO, 25_000, [], TipoMovimiento.INGRESO, 'Varios'),
    ])

    expect(sumarMontos(r.otros.porCategoria.map((c) => c.monto))).toBe(r.otros.bruto)
  })
})


// ---------------------------------------------------------------------------

describe('contrastarIntermediados', () => {
  const MENSAJERIA = {
    id: 'csrvmensaje1',
    nombre: 'Servicios de Mensajería',
    categoriaEgresoId: 'ccatmensaje1',
    categoriaEgreso: 'Servicio de mensajería',
  }

  const entrada = (periodo: string, monto: number, servicioAlegraId = MENSAJERIA.id) => ({
    periodo,
    tipo: TipoMovimiento.INGRESO,
    monto,
    categoriaId: 'ccatcobro0001',
    detalles: [{ servicioAlegraId, monto }],
  })

  const salida = (periodo: string, monto: number, categoriaId = 'ccatmensaje1') => ({
    periodo,
    tipo: TipoMovimiento.EGRESO,
    monto,
    categoriaId,
    detalles: [],
  })

  it('contrasta lo que entró contra lo que salió, mes a mes', () => {
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-08', 1_752_000), salida('2026-08', 4_839_000)]
    )

    expect(r!.meses).toEqual([
      { periodo: '2026-08', entro: 1_752_000, salio: 4_839_000, margen: -3_087_000 },
    ])
    expect(r!.totalMargen).toBe(-3_087_000)
  })

  it('un margen negativo NO se esconde: es el hallazgo', () => {
    // Con números reales de 2026: entraron 15.942.000 por mensajería y
    // salieron 48.151.660 a Fawer. Todos los meses en rojo.
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-01', 1_040_000), salida('2026-01', 3_885_360)]
    )

    expect(r!.totalMargen).toBeLessThan(0)
  })

  it('ignora los egresos de otras categorías', () => {
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-08', 1_000_000), salida('2026-08', 500_000, 'ccatpapeler1')]
    )

    expect(r!.totalSalio).toBe(0)
  })

  it('ignora los ingresos de otros servicios', () => {
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-08', 1_000_000, 'csrvotro00001')]
    )

    expect(r!.totalEntro).toBe(0)
  })

  it('un servicio SIN categoría de egreso aparece igual, con salió en cero', () => {
    // Es el caso de "Recaudo para Terceros": entraron 453.881.429 y su salida
    // nunca se registró. Esconderlo sería esconder que esa plata está
    // inflando el saldo de los bolsillos.
    const [r] = contrastarIntermediados(
      [
        {
          id: 'csrvrecaudo1',
          nombre: 'Recaudo para Terceros',
          categoriaEgresoId: null,
          categoriaEgreso: null,
        },
      ],
      [
        { ...entrada('2026-08', 43_695_716), detalles: [{ servicioAlegraId: 'csrvrecaudo1', monto: 43_695_716 }] },
        salida('2026-08', 4_839_000),
      ]
    )

    expect(r!.categoriaEgreso).toBeNull()
    expect(r!.totalEntro).toBe(43_695_716)
    expect(r!.totalSalio).toBe(0)
    expect(r!.totalMargen).toBe(43_695_716)
  })

  it('incluye los meses en los que solo hubo pago, sin cobro', () => {
    // Un mes en el que se pagó sin haber cobrado importa tanto como el inverso.
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-07', 1_860_000), salida('2026-08', 4_839_000)]
    )

    expect(r!.meses.map((m) => m.periodo)).toEqual(['2026-07', '2026-08'])
    expect(r!.meses[1]!.entro).toBe(0)
  })

  it('los meses salen ordenados', () => {
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-08', 100), entrada('2026-01', 100), entrada('2026-05', 100)]
    )

    expect(r!.meses.map((m) => m.periodo)).toEqual(['2026-01', '2026-05', '2026-08'])
  })

  it('suma varias líneas del mismo servicio en el mismo mes', () => {
    const [r] = contrastarIntermediados(
      [MENSAJERIA],
      [entrada('2026-08', 700_000), entrada('2026-08', 1_052_000)]
    )

    expect(r!.meses[0]!.entro).toBe(1_752_000)
  })

  it('sin servicios en tránsito no devuelve nada', () => {
    expect(contrastarIntermediados([], [entrada('2026-08', 100)])).toEqual([])
  })
})


// ---------------------------------------------------------------------------

describe('resumirNomina', () => {
  const mov = (
    persona: string,
    monto: number,
    porArriba: boolean,
    periodo = '2026-07',
    categoria = 'Otros honorarios'
  ) => ({ periodo, monto, persona, porArriba, categoria })

  it('separa lo que se paga por arriba de lo que se paga por debajo', () => {
    const r = resumirNomina([
      mov('YUDY MILENA JARAMILLO QUIROGA', 1_356_800, true),
      mov('YUDY', 923_000, false, '2026-04', 'Pago mensual fijo'),
    ])

    expect(r.totalPorArriba).toBe(1_356_800)
    expect(r.totalPorDebajo).toBe(923_000)
    expect(r.total).toBe(2_279_800)
  })

  it('NO fusiona personas por parecido de nombre', () => {
    // En estos datos conviven "ANDREA" (Excel) y "ANDREA BEDOYA" (Alegra), y
    // además existe "DANIELA ARANGO BEDOYA". Adivinar cuál es cuál mezclaría
    // el sueldo de dos personas distintas.
    const r = resumirNomina([
      mov('ANDREA BEDOYA', 8_741_700, true),
      mov('ANDREA', 770_000, false),
    ])

    expect(r.personas).toHaveLength(2)
    expect(r.personas.map((p) => p.persona)).toEqual(['ANDREA BEDOYA', 'ANDREA'])
  })

  it('una persona que cobra por los dos lados suma en una sola fila', () => {
    const r = resumirNomina([
      mov('ANDREA BEDOYA', 1_000_000, true),
      mov('ANDREA BEDOYA', 500_000, false),
    ])

    expect(r.personas).toHaveLength(1)
    expect(r.personas[0]).toEqual({
      persona: 'ANDREA BEDOYA',
      porArriba: 1_000_000,
      porDebajo: 500_000,
      total: 1_500_000,
      movs: 2,
    })
  })

  it('ordena las personas de mayor a menor', () => {
    const r = resumirNomina([
      mov('CHICO', 100_000, true),
      mov('GRANDE', 900_000, true),
      mov('MEDIANO', 500_000, true),
    ])

    expect(r.personas.map((p) => p.persona)).toEqual(['GRANDE', 'MEDIANO', 'CHICO'])
  })

  it('agrupa por mes y ordena cronológicamente', () => {
    const r = resumirNomina([
      mov('A', 100, true, '2026-07'),
      mov('B', 200, false, '2026-01'),
      mov('C', 300, true, '2026-04'),
    ])

    expect(r.meses.map((m) => m.periodo)).toEqual(['2026-01', '2026-04', '2026-07'])
    expect(r.meses[0]!.porDebajo).toBe(200)
    expect(r.meses[0]!.porArriba).toBe(0)
  })

  it('agrupa también por categoría', () => {
    // Sirve para ver que los aportes a seguridad social no se le pagan a la
    // persona sino al operador, aunque sean costo de nómina.
    const r = resumirNomina([
      mov('LINA', 1_000_000, true, '2026-07', 'Otros honorarios'),
      mov('SIMPLE S.A.', 430_700, true, '2026-07', 'Aportes a EPS'),
    ])

    expect(r.categorias.map((c) => c.persona)).toEqual(['Otros honorarios', 'Aportes a EPS'])
    expect(r.categorias[1]!.total).toBe(430_700)
  })

  it('la suma de los meses da el total', () => {
    const r = resumirNomina([
      mov('A', 10_745_500, true, '2026-01'),
      mov('B', 11_158_594, false, '2026-02'),
    ])

    expect(sumarMontos(r.meses.map((m) => m.total))).toBe(r.total)
  })

  it('sin movimientos devuelve todo en cero', () => {
    const r = resumirNomina([])

    expect(r).toEqual({
      meses: [],
      personas: [],
      categorias: [],
      totalPorArriba: 0,
      totalPorDebajo: 0,
      total: 0,
    })
  })
})


// ---------------------------------------------------------------------------

describe('egresoRealDelPeriodo', () => {
  const RECAUDO = 'ccatrecaudo1'
  const MENSAJERIA = 'ccatmensaje1'
  const EN_TRANSITO = new Set([RECAUDO, MENSAJERIA])

  const eg = (monto: number, categoriaId: string, categoria: string, esNomina = false) => ({
    tipo: TipoMovimiento.EGRESO,
    monto,
    categoriaId,
    categoria,
    esNomina,
  })

  it('descuenta lo que había entrado para volver a salir', () => {
    // Julio de 2026, números reales: salieron 84.432.347 pero 63.875.000 son
    // recaudo y mensajería. La empresa gastó 20.557.347.
    const r = egresoRealDelPeriodo(
      [
        eg(57_725_400, RECAUDO, 'Ingresos recibidos para terceros'),
        eg(6_149_600, MENSAJERIA, 'Servicio de mensajería'),
        eg(20_557_347, 'ccatgasto001', 'Otros honorarios', true),
      ],
      EN_TRANSITO
    )

    expect(r.bruto).toBe(84_432_347)
    expect(r.enTransito).toBe(63_875_000)
    expect(r.neto).toBe(20_557_347)
  })

  it('cuenta cuánto del gasto real es nómina', () => {
    const r = egresoRealDelPeriodo(
      [
        eg(15_983_588, 'ccatnomina01', 'Otros honorarios', true),
        eg(4_573_759, 'ccatgasto001', 'Papelería y oficina'),
      ],
      EN_TRANSITO
    )

    expect(r.nomina).toBe(15_983_588)
    expect(r.neto).toBe(20_557_347)
  })

  it('un egreso en tránsito NO cuenta como nómina aunque su categoría lo sea', () => {
    // No es plata que se le pagó al equipo: es plata que pasó.
    const r = egresoRealDelPeriodo(
      [eg(6_149_600, MENSAJERIA, 'Servicio de mensajería', true)],
      EN_TRANSITO
    )

    expect(r.nomina).toBe(0)
    expect(r.enTransito).toBe(6_149_600)
  })

  it('los TRASLADOS no son egreso', () => {
    // Mover plata entre bolsillos no es gasto, y el resto del libro ya los
    // trata así.
    const r = egresoRealDelPeriodo(
      [
        { tipo: TipoMovimiento.TRASLADO, monto: 1_000_000, categoriaId: 'ccattras0001', categoria: 'Traslado', esNomina: false },
        eg(500_000, 'ccatgasto001', 'Papelería y oficina'),
      ],
      EN_TRANSITO
    )

    expect(r.bruto).toBe(500_000)
  })

  it('los INGRESOS tampoco entran', () => {
    const r = egresoRealDelPeriodo(
      [
        { tipo: TipoMovimiento.INGRESO, monto: 9_000_000, categoriaId: 'ccatcobro001', categoria: 'Cobro', esNomina: false },
        eg(500_000, 'ccatgasto001', 'Papelería y oficina'),
      ],
      EN_TRANSITO
    )

    expect(r.bruto).toBe(500_000)
  })

  it('dice de qué categorías es la plata en tránsito, de mayor a menor', () => {
    const r = egresoRealDelPeriodo(
      [
        eg(6_149_600, MENSAJERIA, 'Servicio de mensajería'),
        eg(57_725_400, RECAUDO, 'Ingresos recibidos para terceros'),
      ],
      EN_TRANSITO
    )

    expect(r.porCategoriaEnTransito).toEqual([
      { nombre: 'Ingresos recibidos para terceros', monto: 57_725_400 },
      { nombre: 'Servicio de mensajería', monto: 6_149_600 },
    ])
  })

  it('sin categorías en tránsito configuradas, el neto es igual al bruto', () => {
    // El caso de una base recién armada: no se descuenta nada hasta que
    // alguien marque qué entra y sale.
    const r = egresoRealDelPeriodo(
      [eg(84_432_347, RECAUDO, 'Ingresos recibidos para terceros')],
      new Set()
    )

    expect(r.neto).toBe(84_432_347)
    expect(r.enTransito).toBe(0)
  })

  it('sin movimientos devuelve todo en cero', () => {
    const r = egresoRealDelPeriodo([], EN_TRANSITO)

    expect(r).toEqual({
      bruto: 0, enTransito: 0, neto: 0, nomina: 0, porCategoriaEnTransito: [],
    })
  })
})


// ---------------------------------------------------------------------------

describe('desglosarPeriodo', () => {
  const RECAUDO = 'ccatrecaudo1'
  const EN_TRANSITO = new Set([RECAUDO])

  const base = {
    categoriaId: 'ccatgasto001',
    categoria: 'Gasto',
    esNomina: false,
    persona: '—',
    detalles: [] as Array<{ servicio: string; monto: number; enTransito: boolean }>,
  }

  const ingreso = (
    grupo: GrupoCategoria,
    monto: number,
    detalles: Array<{ servicio: string; monto: number; enTransito: boolean }> = []
  ) => ({ ...base, tipo: TipoMovimiento.INGRESO, grupo, monto, detalles })

  const egreso = (monto: number, categoria: string, extra: Partial<typeof base> = {}) => ({
    ...base,
    ...extra,
    tipo: TipoMovimiento.EGRESO,
    grupo: GrupoCategoria.GASTO_OPERATIVO,
    monto,
    categoria,
  })

  it('abre las cotizaciones por servicio', () => {
    const r = desglosarPeriodo(
      [
        ingreso(GrupoCategoria.COBRO_COTIZACION, 250_000, [
          { servicio: 'Independiente 03', monto: 150_000, enTransito: false },
          { servicio: 'Afiliacion Dependiente', monto: 100_000, enTransito: false },
        ]),
      ],
      EN_TRANSITO
    )

    expect(r.cotizacion).toEqual([
      { nombre: 'Independiente 03', monto: 150_000, movs: 1 },
      { nombre: 'Afiliacion Dependiente', monto: 100_000, movs: 1 },
    ])
  })

  it('en las facturas saca la plata en tránsito, para que sume el neto', () => {
    // La tarjeta muestra el neto: si la lista mostrara el recaudo, sumaría
    // otra cosa que el número que tiene arriba.
    const r = desglosarPeriodo(
      [
        ingreso(GrupoCategoria.COBRO_FACTURA, 729_000, [
          { servicio: 'Administracion', monto: 150_000, enTransito: false },
          { servicio: 'Recaudo para Terceros', monto: 579_000, enTransito: true },
        ]),
      ],
      EN_TRANSITO
    )

    expect(r.factura).toEqual([{ nombre: 'Administracion', monto: 150_000, movs: 1 }])
  })

  it('los cobros sin desglose aparecen como fila propia, no se esconden', () => {
    // Omitirlos haría que la lista sumara menos que la tarjeta.
    const r = desglosarPeriodo(
      [ingreso(GrupoCategoria.COBRO_COTIZACION, 500_000)],
      EN_TRANSITO
    )

    expect(r.cotizacion).toEqual([{ nombre: SIN_DESGLOSE, monto: 500_000, movs: 1 }])
  })

  it('abre los egresos por categoría, sin la plata que solo pasa', () => {
    const r = desglosarPeriodo(
      [
        egreso(15_983_588, 'Otros honorarios', { esNomina: true, persona: 'LINA' }),
        egreso(4_573_759, 'Papelería y oficina'),
        egreso(63_875_000, 'Ingresos recibidos para terceros', { categoriaId: RECAUDO }),
      ],
      EN_TRANSITO
    )

    expect(r.egresos).toEqual([
      { nombre: 'Otros honorarios', monto: 15_983_588, movs: 1 },
      { nombre: 'Papelería y oficina', monto: 4_573_759, movs: 1 },
    ])
  })

  it('abre la nómina por persona', () => {
    const r = desglosarPeriodo(
      [
        egreso(11_200_000, 'Otros honorarios', { esNomina: true, persona: 'LINA TATIANA' }),
        egreso(4_800_000, 'Otros honorarios', { esNomina: true, persona: 'HECTOR' }),
        egreso(500_000, 'Papelería y oficina'),
      ],
      EN_TRANSITO
    )

    expect(r.nomina).toEqual([
      { nombre: 'LINA TATIANA', monto: 11_200_000, movs: 1 },
      { nombre: 'HECTOR', monto: 4_800_000, movs: 1 },
    ])
  })

  it('un egreso en tránsito no entra en la nómina aunque su categoría lo sea', () => {
    const r = desglosarPeriodo(
      [egreso(6_149_600, 'Servicio de mensajería', {
        categoriaId: RECAUDO, esNomina: true, persona: 'Fawer',
      })],
      EN_TRANSITO
    )

    expect(r.nomina).toEqual([])
    expect(r.egresos).toEqual([])
  })

  it('junta las filas repetidas y ordena de mayor a menor', () => {
    const r = desglosarPeriodo(
      [
        egreso(100_000, 'Papelería y oficina'),
        egreso(900_000, 'Otros honorarios'),
        egreso(200_000, 'Papelería y oficina'),
      ],
      EN_TRANSITO
    )

    expect(r.egresos).toEqual([
      { nombre: 'Otros honorarios', monto: 900_000, movs: 1 },
      { nombre: 'Papelería y oficina', monto: 300_000, movs: 2 },
    ])
  })

  it('los ingresos que no son ni C ni F no entran en el desglose de cobros', () => {
    const r = desglosarPeriodo(
      [ingreso(GrupoCategoria.PRESTAMO_ABONO, 400_000)],
      EN_TRANSITO
    )

    expect(r.cotizacion).toEqual([])
    expect(r.factura).toEqual([])
  })

  it('sin movimientos devuelve las cuatro listas vacías', () => {
    expect(desglosarPeriodo([], EN_TRANSITO)).toEqual({
      cotizacion: [], factura: [], egresos: [], nomina: [],
    })
  })
})
