import { readFile } from 'fs/promises'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { renderizarReciboPdf } from '../recibo-pago-document'
import { EMISOR_RECIBO } from '@/lib/config/recibo-emisor'
import { armarDatosRecibo } from '@/lib/utils/control-recibo'

const datos = armarDatosRecibo({
  numero: 1,
  fecha: new Date('2026-10-04T00:00:00.000Z'),
  clienteNombre: 'Ana Núñez Peña',
  clienteDocumento: 'CC 1.020.304.050',
  lineas: [
    { servicio: 'Administración', referencia: '01', monto: 150000 },
    { servicio: 'Afiliación', referencia: null, monto: 250000 },
  ],
  monto: 400000,
  bolsilloNombre: 'Bancolombia',
  concepto: 'Pago de servicios de octubre',
  anulado: false,
})

async function render(props: { anulado?: boolean; logo?: boolean }) {
  const logoBuffer = props.logo
    ? await readFile(path.join(process.cwd(), EMISOR_RECIBO.logoPath))
    : undefined
  return renderizarReciboPdf({
    datos: { ...datos, anulado: props.anulado ?? false },
    emisor: EMISOR_RECIBO,
    logoBuffer,
  })
}

describe('ReciboPagoDocument', () => {
  it('renderiza un PDF válido con logo', async () => {
    const pdf = await render({ logo: true })
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it('renderiza sin logo', async () => {
    const pdf = await render({ logo: false })
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it('renderiza un recibo anulado', async () => {
    const pdf = await render({ anulado: true, logo: true })
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(1000)
  })
})
