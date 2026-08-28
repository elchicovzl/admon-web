/**
 * Repara la categoría de los pagos de Alegra que se importaron sin concepto.
 *
 * EL BUG QUE REPARA
 *
 * `getCachedBillsInRange` no pasaba `type`, y el default de Alegra es `bill`:
 * los DOCUMENTOS SOPORTE quedaban afuera sin avisar (171 documentos contra
 * 271). Los honorarios de esta empresa se cargan como documento soporte
 * (prefijo DOSE), así que sus pagos se quedaban sin concepto.
 *
 * Y el fallback de entonces —"la primera categoría del grupo OTRO por orden
 * alfabético"— los sepultó en categorías ajenas. Peor: el destino cambiaba a
 * medida que la propia importación creaba categorías, así que el error no fue
 * ni consistente:
 *
 *   Alcantarillado/ Acueducto                40 pagos   50.314.129   ene–may
 *   Aportes fondo de pensiones y cesantías   11 pagos   14.929.700   junio
 *   Dotación a trabajadores                   9 pagos   12.761.900   julio
 *                                            ─────────────────────
 *                                            60 pagos   77.999.729
 *
 * POR QUÉ UN SCRIPT Y NO ANULAR Y REIMPORTAR
 *
 * Los movimientos del libro son inmutables a propósito: se anulan con un
 * contra-movimiento, no se editan. Pero eso vale para los HECHOS —el monto, la
 * fecha, el bolsillo—, que acá no cambian: la plata salió cuando salió y por
 * donde salió. Lo que se corrige es una ETIQUETA que el sistema puso mal por un
 * bug propio. Anular y reimportar 60 movimientos ensuciaría el libro con 120
 * asientos para arreglar un error de clasificación que nadie cometió.
 *
 * QUÉ HACE
 *
 * Por cada movimiento con `alegraPaymentId` cuya nota NO diga "Concepto en
 * Alegra", vuelve a pedir el pago y su documento —esta vez con `type: 'all'`—,
 * resuelve el concepto y reasigna la categoría. Deja la nota corregida para que
 * quede rastro.
 *
 * USO
 *   npx tsx scripts/reparar-categorias-pagos-alegra.ts          → simulacro
 *   npx tsx scripts/reparar-categorias-pagos-alegra.ts --aplicar → escribe
 */

import { PrismaClient, GrupoCategoria } from '@prisma/client'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--aplicar')

const BASE = 'https://api.alegra.com/api/v1'
const auth = Buffer.from(
  `${process.env.ALEGRA_EMAIL}:${process.env.ALEGRA_TOKEN}`
).toString('base64')

async function alegra<T>(path: string): Promise<T | null> {
  // Tres intentos: la cuenta corta la conexión cada tantas llamadas seguidas.
  for (let intento = 0; intento < 3; intento += 1) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Basic ${auth}` },
      })
      if (!res.ok) {
        console.error(`  HTTP ${res.status} en ${path}`)
        return null
      }
      return (await res.json()) as T
    } catch {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  return null
}

interface ConceptoLinea {
  name?: string
}
interface PagoAlegra {
  categories?: ConceptoLinea[]
  bills?: Array<{ id: string | number }>
}
interface FacturaAlegra {
  purchases?: { categories?: ConceptoLinea[]; items?: ConceptoLinea[] }
}

const primerNombre = (lineas: ConceptoLinea[] | undefined): string | null =>
  (lineas ?? []).map((l) => l?.name).find((n) => typeof n === 'string' && n.trim()) ?? null

/** El concepto de un pago: del propio pago, o del documento al que se aplicó. */
async function conceptoDe(paymentId: string): Promise<string | null> {
  const pago = await alegra<PagoAlegra>(`/payments/${paymentId}?fields=associations`)
  if (!pago) return null

  const delPago = primerNombre(pago.categories)
  if (delPago) return delPago

  for (const b of pago.bills ?? []) {
    const factura = await alegra<FacturaAlegra>(`/bills/${b.id}`)
    const nombre =
      primerNombre(factura?.purchases?.categories) ??
      primerNombre(factura?.purchases?.items)
    if (nombre) return nombre
  }

  return null
}

const cacheCategoria = new Map<string, string>()

async function categoriaPorNombre(nombre: string): Promise<string> {
  const yaResuelta = cacheCategoria.get(nombre)
  if (yaResuelta) return yaResuelta

  const existente = await prisma.categoriaMovimiento.findFirst({
    where: { nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existente) {
    cacheCategoria.set(nombre, existente.id)
    return existente.id
  }

  if (!APLICAR) {
    cacheCategoria.set(nombre, '(se crearía)')
    return '(se crearía)'
  }

  const creada = await prisma.categoriaMovimiento.create({
    data: { nombre: nombre.slice(0, 100), grupo: GrupoCategoria.OTRO },
    select: { id: true },
  })
  cacheCategoria.set(nombre, creada.id)
  return creada.id
}

async function main() {
  // El filtro de "nota sin concepto" se hace en código: expresarlo como
  // `notas: { not: { contains } }` junto a un OR con null hace que Prisma
  // rechace la consulta.
  const importados = await prisma.movimiento.findMany({
    where: { alegraPaymentId: { not: null } },
    select: {
      id: true,
      concepto: true,
      monto: true,
      notas: true,
      alegraPaymentId: true,
      categoria: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'asc' },
  })

  const rotos = importados.filter((m) => !m.notas?.includes('Concepto en Alegra'))

  console.log(
    `${rotos.length} movimientos sin concepto${APLICAR ? '' : ' (SIMULACRO — no escribe nada)'}\n`
  )

  const resumen = new Map<string, { n: number; total: number }>()
  let corregidos = 0
  let sinResolver = 0

  for (const m of rotos) {
    const concepto = await conceptoDe(m.alegraPaymentId!)

    if (!concepto) {
      sinResolver += 1
      console.log(`  ? ${m.concepto} — sigue sin concepto`)
      continue
    }

    const categoriaId = await categoriaPorNombre(concepto)
    const clave = `${m.categoria.nombre} → ${concepto}`
    const acc = resumen.get(clave) ?? { n: 0, total: 0 }
    acc.n += 1
    acc.total += Number(m.monto)
    resumen.set(clave, acc)

    if (APLICAR) {
      await prisma.movimiento.update({
        where: { id: m.id },
        data: {
          categoriaId,
          notas: [m.notas, `Concepto en Alegra: ${concepto}.`].filter(Boolean).join(' '),
        },
      })
    }
    corregidos += 1
  }

  console.log('\n=== reclasificaciones ===')
  for (const [clave, v] of [...resumen.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${v.n.toString().padStart(3)} · ${v.total.toLocaleString('es-CO').padStart(12)} · ${clave}`)
  }

  console.log(
    `\n${corregidos} corregidos, ${sinResolver} sin resolver.` +
      (APLICAR ? '' : '\n\nVolvé a correrlo con --aplicar para escribir los cambios.')
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
