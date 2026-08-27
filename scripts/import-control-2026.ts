/**
 * Importa al módulo Control los movimientos de 2026 del Excel de contabilidad.
 *
 * Se corre con:
 *   npx tsx scripts/import-control-2026.ts --dry-run    (no escribe nada)
 *   npx tsx scripts/import-control-2026.ts --confirmar  (escribe)
 *
 * ALCANCE — decidido con Miguel el 2026-08-27:
 *   ✅ Movimientos operativos de PAGOS POR DEBAJO, desde enero-2026
 *   ✅ Pagos a Fawer que viven como texto libre en CUENTAS (48,1M en 37 pagos)
 *   ✅ Saldos de apertura de enero-2026 tomados de CUENTAS
 *   ⏸️ Préstamos, sus desembolsos y sus abonos: EN PAUSA hasta que Miguel
 *      confirme los saldos con el equipo. El estado de los 222 préstamos del
 *      Excel no es derivable del texto de seguimiento, y darlos todos por
 *      abiertos diría que el equipo debe 13.807.900 — un número falso.
 *
 * Es IDEMPOTENTE: cada movimiento lleva `origenImport` con la celda de origen,
 * y los que ya existan se saltean. Se puede correr las veces que haga falta.
 *
 * NO reproduce los errores del Excel. El total de marzo del Excel decía
 * 2.926.800 por una fórmula con el rango corto; acá entran los 3.137.800 que
 * realmente suman las filas.
 */

import { PrismaClient, TipoMovimiento, GrupoCategoria, TipoContraparte } from '@prisma/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const prisma = new PrismaClient()

const DIR_JSON = process.env.CONTROL_IMPORT_DIR ?? resolve(process.cwd(), 'tmp/control-import')
const ESCRIBIR = process.argv.includes('--confirmar')

/** Saldos de apertura de enero-2026, hoja CUENTAS fila 97. */
const APERTURA_2026_01: Record<string, number> = {
  IVONE: 344_000,
  EFECTIVO: 70_000,
  ADMON: 17_860_000,
  'CAJA MENOR': 0,
  'AHORRO EFECTIVO': 0,
}

/**
 * Concepto del Excel → categoría del módulo, y contraparte cuando el concepto
 * ES una persona (que es la mezcla que hacía el Excel: "quién" y "qué" en la
 * misma columna).
 *
 * La clave se compara en mayúsculas y sin espacios de más.
 */
const MAPA: Record<string, { categoria: string; contraparte?: string }> = {
  // — Nómina fija: el concepto es el nombre de quien cobra —
  ALBERTO: { categoria: 'Pago mensual fijo', contraparte: 'Alberto' },
  ANDREA: { categoria: 'Pago mensual fijo', contraparte: 'Andrea' },
  BRANDON: { categoria: 'Pago mensual fijo', contraparte: 'Brandon' },
  IVEC: { categoria: 'Pago mensual fijo', contraparte: 'IVEC' },
  'JOSE Q': { categoria: 'Pago mensual fijo', contraparte: 'José Q' },
  MARLENY: { categoria: 'Pago mensual fijo', contraparte: 'Marleny' },
  YESSIKA: { categoria: 'Pago mensual fijo', contraparte: 'Yessika' },
  LUISA: { categoria: 'Pago mensual fijo', contraparte: 'Luisa' },
  YUDY: { categoria: 'Pago mensual fijo', contraparte: 'Yudy' },

  // — Comisión por referidos: trabajan en Simple y refieren clientes —
  'ELIANA SIMPLE': { categoria: 'Comisión por referidos', contraparte: 'Eliana (Simple)' },
  'ANA SIMPLE': { categoria: 'Comisión por referidos', contraparte: 'Ana (Simple)' },

  // — Nómina complementaria —
  'CESANTIAS JACKE POR DEBAJO': { categoria: 'Cesantías por debajo', contraparte: 'Jacke' },
  'CESANTIAS TATY POR DEBAJO': { categoria: 'Cesantías por debajo', contraparte: 'Tatiana' },
  'INTERESES CESANTIAS JACKE POR DEBAJO': { categoria: 'Intereses de cesantías por debajo', contraparte: 'Jacke' },
  'INTERESES CESANTIAS TATY POR DEBAJO': { categoria: 'Intereses de cesantías por debajo', contraparte: 'Tatiana' },

  // — Comisiones —
  'COMISION CARLOS SANITAS': { categoria: 'Comisión de afiliación', contraparte: 'Carlos' },
  'COMISION CARLOS COLPENSIONES': { categoria: 'Comisión de afiliación', contraparte: 'Carlos' },
  'CARLOS COLPENSIONES': { categoria: 'Comisión de afiliación', contraparte: 'Carlos' },
  'COMISION COLPENSIONES': { categoria: 'Comisión de afiliación' },
  'COMISION AESESOR COLPENSIONES': { categoria: 'Comisión de asesoría' },
  'COMISION SAVIA INCAPACIDADES': { categoria: 'Comisión por incapacidad' },
  ANDREY: { categoria: 'Comisión de afiliación', contraparte: 'Andrey' },
  ROBINSON: { categoria: 'Comisión de afiliación', contraparte: 'Robinson' },

  // — Cafetería y bebidas —
  BURBUJA: { categoria: 'Cafetería y bebidas', contraparte: 'Burbuja' },
  'ANDRES BURBUJA': { categoria: 'Cafetería y bebidas', contraparte: 'Burbuja' },
  'CAFE DON EZEQUIEL': { categoria: 'Cafetería y bebidas', contraparte: 'Don Ezequiel' },
  'YUDY PAN': { categoria: 'Cafetería y bebidas', contraparte: 'Yudy' },

  // — Alimentación y celebraciones —
  MICHELADAS: { categoria: 'Alimentación y celebraciones' },
  'ALMUERZO ADMON': { categoria: 'Alimentación y celebraciones' },
  'ALMUERZO CUMPLEAÑOS': { categoria: 'Alimentación y celebraciones' },
  PIÑATERIA: { categoria: 'Alimentación y celebraciones' },

  // — Regalos y dotación —
  'REGALO LEIDY': { categoria: 'Regalos' },
  'REGALO VANESA': { categoria: 'Regalos' },
  CORREA: { categoria: 'Dotación' },
  CORREAS: { categoria: 'Dotación' },
  'ESTAMPADO CAMISETAS': { categoria: 'Publicidad y diseño' },
  'GABY - VIDEO': { categoria: 'Publicidad y diseño', contraparte: 'Gaby' },

  // — Transporte —
  'PASAJES YUDY': { categoria: 'Transporte y pasajes', contraparte: 'Yudy' },
  'PASAJES ALBERTO JARAMILLO': { categoria: 'Transporte y pasajes', contraparte: 'Alberto' },
  'PASAJES CENTRO': { categoria: 'Transporte y pasajes' },
  'TRANSPORTE ESCRITORIO': { categoria: 'Transporte y pasajes' },
  'PAGO TRANSPORTE MUEBLES': { categoria: 'Transporte y pasajes' },
  'PAGO TRASTEO': { categoria: 'Transporte y pasajes' },

  // — Oficina —
  RESMA: { categoria: 'Papelería y oficina' },
  'TOMAS OFICINA': { categoria: 'Papelería y oficina' },
  MEMORIA: { categoria: 'Papelería y oficina' },
  'ADELANTO DON LUIS FERNANDO': { categoria: 'Mantenimiento y arreglos', contraparte: 'Don Luis Fernando' },
  'DON LUIS (MANO DE OBRA ARREGLOS OFICINA)': { categoria: 'Mantenimiento y arreglos', contraparte: 'Don Luis Fernando' },
  'DON LUIS (NATERIALES ARREGLOS OFICINA)': { categoria: 'Mantenimiento y arreglos', contraparte: 'Don Luis Fernando' },
  'LUIS FERNANDO (ARREGLOS OFICINA)': { categoria: 'Mantenimiento y arreglos', contraparte: 'Don Luis Fernando' },
  VENENOS: { categoria: 'Aseo y fumigación' },

  // — Telefonía —
  'COMISION CELULAR': { categoria: 'Telefonía y conectividad' },
  'ESTUCHE CELULAR': { categoria: 'Telefonía y conectividad' },
  'SIM CARD CLARO': { categoria: 'Telefonía y conectividad' },

  // — Diligencias —
  'VUELTA FAWER': { categoria: 'Diligencias y trámites', contraparte: 'Fawer' },
  'MENSAJERO CRISTIAN TOBON': { categoria: 'Diligencias y trámites', contraparte: 'Cristian Tobón' },

  // — Servicios referenciados —
  'EXAMENES MEDICOS': { categoria: 'Exámenes médicos' },
  // Los pagos a Fawer son la pata de ENTREGA del servicio de mensajería. Entran
  // como movimiento suelto y no como ServicioReferenciado porque el Excel no
  // documenta la pata de cobro: esas cotizaciones viven en Alegra.
  'PAGO A FAWER — SERVICIO DE MENSAJERÍA': {
    categoria: 'Servicio de mensajería',
    contraparte: 'Fawer',
  },

  // — Devoluciones —
  'DEVOLUCION CLIENTE YERLI CASTAÑEDA': { categoria: 'Devolución a cliente', contraparte: 'Yerli Castañeda' },
  'DEVOLUCION MONICA PATRICIA OCHOA': { categoria: 'Devolución a cliente', contraparte: 'Mónica Patricia Ochoa' },
  'DEVOLUCION PISENDE YUDY': { categoria: 'Devolución a cliente', contraparte: 'Yudy' },

  // — Sin clasificar: el Excel no dice más que esto —
  TRANSFERENCIA: { categoria: 'Varios' },
}

interface MovimientoJson {
  origen: string
  fecha: string
  periodo: string
  concepto: string
  contraparteHint?: string | null
  bolsillo: string
  monto: number
  sinFechaExplicita?: boolean
  textoOriginal?: string
}

function leerJson<T>(archivo: string): T {
  return JSON.parse(readFileSync(resolve(DIR_JSON, archivo), 'utf8')) as T
}

/** Fecha de calendario a medianoche UTC, igual que en el resto del módulo. */
function fechaCalendario(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase()

async function main() {
  console.log(ESCRIBIR ? '⚠️  MODO ESCRITURA\n' : '🔍 SIMULACIÓN — no se escribe nada\n')

  const usuario = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true },
  })
  if (!usuario) throw new Error('No hay ningún SUPER_ADMIN. Corré `pnpm db:seed` primero.')

  const [bolsillos, categorias, contrapartes] = await Promise.all([
    prisma.bolsillo.findMany({ select: { id: true, nombre: true } }),
    prisma.categoriaMovimiento.findMany({ select: { id: true, nombre: true, grupo: true } }),
    prisma.contraparte.findMany({ select: { id: true, nombre: true } }),
  ])

  const porBolsillo = new Map(bolsillos.map((b) => [norm(b.nombre), b.id]))
  const porCategoria = new Map(categorias.map((c) => [norm(c.nombre), c.id]))
  const porContraparte = new Map(contrapartes.map((c) => [norm(c.nombre), c.id]))

  const mov = leerJson<{ movimientos: MovimientoJson[] }>('movimientos.json')
  const cue = leerJson<{ pagosFawer: MovimientoJson[] }>('cuentas.json')
  const todos = [...mov.movimientos, ...cue.pagosFawer]

  // ---- validación previa: nada se escribe si falta algo del catálogo ----
  const faltanCategorias = new Set<string>()
  const faltanBolsillos = new Set<string>()
  /**
   * Se indexa por nombre NORMALIZADO, no por el crudo. El Excel escribe los
   * nombres en mayúsculas y el MAPA en capitalización normal, así que
   * juntarlos por el texto tal cual creaba "YUDY" y "Yudy" como dos
   * contrapartes distintas — que es justo lo que este módulo existe para
   * evitar.
   */
  const contrapartesNuevas = new Map<string, string>()

  for (const m of todos) {
    if (!porBolsillo.has(norm(m.bolsillo))) faltanBolsillos.add(m.bolsillo)
    const entrada = MAPA[norm(m.concepto)]
    const catNombre = entrada?.categoria ?? 'Varios'
    if (!porCategoria.has(norm(catNombre))) faltanCategorias.add(catNombre)
    const cp = entrada?.contraparte ?? m.contraparteHint
    if (cp && !porContraparte.has(norm(cp)) && !contrapartesNuevas.has(norm(cp))) {
      contrapartesNuevas.set(norm(cp), cp)
    }
  }

  const sinMapa = [...new Set(todos.filter((m) => !MAPA[norm(m.concepto)]).map((m) => m.concepto))]

  if (faltanBolsillos.size || faltanCategorias.size) {
    console.error('❌ Faltan entradas de catálogo. No se importa nada:')
    faltanBolsillos.forEach((b) => console.error(`   bolsillo: ${b}`))
    faltanCategorias.forEach((c) => console.error(`   categoría: ${c}`))
    process.exit(1)
  }

  console.log(`movimientos a procesar : ${todos.length}`)
  console.log(`  · de PAGOS POR DEBAJO: ${mov.movimientos.length}`)
  console.log(`  · pagos a Fawer      : ${cue.pagosFawer.length}`)
  console.log(`contrapartes a crear   : ${contrapartesNuevas.size}`)
  console.log(`conceptos sin mapa (van a "Varios"): ${sinMapa.length}`)
  sinMapa.forEach((c) => console.log(`   ⚠️  ${c}`))
  console.log()

  if (!ESCRIBIR) {
    console.log('Simulación terminada. Volvé a correr con --confirmar para escribir.')
    return
  }

  // ---- contrapartes que falten ----
  for (const nombre of contrapartesNuevas.values()) {
    const creada = await prisma.contraparte.create({
      data: {
        nombre,
        tipo: TipoContraparte.OTRO,
        notas: 'Creada por la importación del Excel. Revisar el tipo.',
        createdById: usuario.id,
      },
      select: { id: true, nombre: true },
    })
    porContraparte.set(norm(creada.nombre), creada.id)
  }
  console.log(`✅ ${contrapartesNuevas.size} contrapartes creadas`)

  // ---- saldos de apertura de enero-2026 ----
  for (const [nombre, saldo] of Object.entries(APERTURA_2026_01)) {
    const bolsilloId = porBolsillo.get(norm(nombre))
    if (!bolsilloId) continue
    await prisma.cierreMensual.upsert({
      where: { periodo_bolsilloId: { periodo: '2026-01', bolsilloId } },
      update: { saldoInicial: saldo, esAperturaInicial: true },
      create: {
        periodo: '2026-01',
        bolsilloId,
        saldoInicial: saldo,
        saldoFinalCalculado: saldo,
        esAperturaInicial: true,
        createdById: usuario.id,
      },
    })
  }
  console.log('✅ saldos de apertura de enero-2026 registrados')

  // ---- movimientos ----
  let creados = 0
  let salteados = 0

  for (const m of todos) {
    const yaEsta = await prisma.movimiento.findFirst({
      where: { origenImport: m.origen },
      select: { id: true },
    })
    if (yaEsta) {
      salteados++
      continue
    }

    const entrada = MAPA[norm(m.concepto)]
    const categoriaId = porCategoria.get(norm(entrada?.categoria ?? 'Varios'))!
    const cpNombre = entrada?.contraparte ?? m.contraparteHint
    const contraparteId = cpNombre ? porContraparte.get(norm(cpNombre)) ?? null : null

    const notas: string[] = []
    if (m.sinFechaExplicita) {
      notas.push('El Excel no traía el día, solo el mes. Se usó el último día del mes.')
    }
    if (m.textoOriginal) notas.push(`Texto original: «${m.textoOriginal}»`)

    await prisma.movimiento.create({
      data: {
        fecha: fechaCalendario(m.fecha),
        periodo: m.periodo,
        tipo: TipoMovimiento.EGRESO,
        monto: m.monto,
        concepto: m.concepto.slice(0, 200),
        bolsilloId: porBolsillo.get(norm(m.bolsillo))!,
        categoriaId,
        contraparteId,
        notas: notas.length ? notas.join(' ') : null,
        origenImport: m.origen,
        createdById: usuario.id,
      },
    })
    creados++
  }

  console.log(`✅ ${creados} movimientos creados · ${salteados} ya existían y se saltearon`)

  const total = todos.reduce((a, m) => a + m.monto, 0)
  console.log(`   total importado: ${total.toLocaleString('es-CO')}`)
  console.log('\n⏸️  Préstamos, desembolsos y abonos NO se importaron: esperan la')
  console.log('    confirmación de saldos con el equipo.')
}

main()
  .catch((e) => {
    console.error('❌ Falló la importación:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
