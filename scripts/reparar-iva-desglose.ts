/**
 * Rellena el IVA de las líneas del desglose que se importaron sin él.
 *
 * QUÉ REPARA
 *
 * `MovimientoDetalleServicio.impuesto` se agregó después de importar 2026, así
 * que las líneas viejas quedaron con impuesto en cero. Eso infla los ingresos
 * "por arriba": el IVA se cobra para girarlo a la DIAN, igual que el recaudo
 * para terceros, y no es plata de la empresa.
 *
 * POR QUÉ HAY QUE VOLVER A LEER ALEGRA
 *
 * El desglose guarda el bruto ya prorrateado. Para saber qué parte era
 * impuesto hay que ver las líneas del documento original, y el impuesto NO se
 * puede deducir del servicio: medido sobre 60 facturas, "Afiliacion
 * Dependiente" aparece con 19% en unas y sin impuesto en otras.
 *
 * SOLO TOCA LAS FACTURAS. Las cotizaciones no llevan IVA, y lo que se cobra
 * por debajo tampoco.
 *
 * USO
 *   npx tsx scripts/reparar-iva-desglose.ts            → simulacro
 *   npx tsx scripts/reparar-iva-desglose.ts --aplicar  → escribe
 *
 * Correr con las dos variables de entorno:
 *   node --env-file=.env --env-file=.env.local --import tsx scripts/…
 */

import { PrismaClient } from '@prisma/client'

import { repartirEntreServicios, type LineaDeDocumento } from '../lib/utils/control-ledger'

const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--aplicar')

const BASE = 'https://api.alegra.com/api/v1'
const auth = Buffer.from(
  `${process.env.ALEGRA_EMAIL}:${process.env.ALEGRA_TOKEN}`
).toString('base64')

interface ItemAlegra {
  id: string | number
  price?: unknown
  quantity?: unknown
  discount?: unknown
  tax?: Array<{ percentage?: unknown }>
}

async function alegra(path: string): Promise<{ items?: ItemAlegra[] } | null> {
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
      return (await res.json()) as { items?: ItemAlegra[] }
    } catch {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  return null
}

async function main() {
  const movimientos = await prisma.movimiento.findMany({
    where: {
      alegraInvoiceId: { not: null },
      detalleServicios: { some: {} },
    },
    select: {
      id: true,
      monto: true,
      alegraInvoiceId: true,
      detalleServicios: {
        select: {
          id: true,
          monto: true,
          impuesto: true,
          servicio: { select: { alegraItemId: true, nombre: true } },
        },
      },
    },
    orderBy: { fecha: 'asc' },
  })

  // Ya reparados: si todas sus líneas tienen impuesto, no hay nada que hacer.
  // Se detecta por "alguna línea en cero", no por un flag: el flag mentiría el
  // día que el script se corte a la mitad.
  const pendientes = movimientos.filter((m) =>
    m.detalleServicios.some((d) => Number(d.impuesto) === 0)
  )

  console.log(
    `${movimientos.length} facturas con desglose · ${pendientes.length} sin IVA cargado` +
      (APLICAR ? '' : ' (SIMULACRO — no escribe nada)') +
      '\n'
  )

  const porServicio = new Map<string, { lineas: number; impuesto: number }>()
  let actualizadas = 0
  let sinResolver = 0

  for (const [i, m] of pendientes.entries()) {
    if (i % 100 === 0 && i > 0) console.log(`  … ${i} de ${pendientes.length}`)

    const detalle = await alegra(`/invoices/${m.alegraInvoiceId}`)
    if (!detalle?.items?.length) {
      sinResolver += 1
      continue
    }

    const lineas: LineaDeDocumento[] = detalle.items.map((it) => ({
      itemId: String(it.id),
      precio: Number(it.price ?? 0),
      cantidad: Number(it.quantity ?? 0),
      descuento: Number(it.discount ?? 0),
      impuestos: (it.tax ?? []).map((t) => Number(t.percentage ?? 0)),
    }))

    // Se recalcula el reparto COMPLETO con el mismo monto cobrado que se usó
    // al importar, para que el impuesto salga con la misma proporción que el
    // monto ya guardado.
    const partes = repartirEntreServicios(lineas, Number(m.monto))
    const impuestoPorItem = new Map(partes.map((p) => [p.itemId, p.impuesto]))

    for (const d of m.detalleServicios) {
      const impuesto = impuestoPorItem.get(d.servicio.alegraItemId)
      if (impuesto === undefined || impuesto === 0) continue

      const acc = porServicio.get(d.servicio.nombre) ?? { lineas: 0, impuesto: 0 }
      acc.lineas += 1
      acc.impuesto += impuesto
      porServicio.set(d.servicio.nombre, acc)

      if (APLICAR) {
        await prisma.movimientoDetalleServicio.update({
          where: { id: d.id },
          data: { impuesto },
        })
      }
      actualizadas += 1
    }
  }

  console.log('\n=== IVA encontrado, por servicio ===')
  for (const [nombre, v] of [...porServicio.entries()].sort(
    (a, b) => b[1].impuesto - a[1].impuesto
  )) {
    console.log(
      `  ${String(v.lineas).padStart(4)} líneas · ${v.impuesto
        .toLocaleString('es-CO')
        .padStart(14)} · ${nombre}`
    )
  }

  const total = [...porServicio.values()].reduce((a, v) => a + v.impuesto, 0)
  console.log(
    `\n${actualizadas} líneas con IVA por ${total.toLocaleString('es-CO')}` +
      `, ${sinResolver} facturas que no se pudieron leer.` +
      (APLICAR ? '' : '\n\nVolvé a correrlo con --aplicar para escribir los cambios.')
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
