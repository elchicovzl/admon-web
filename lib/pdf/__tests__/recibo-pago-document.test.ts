import { readFile } from 'fs/promises'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { renderizarReciboPdf } from '../recibo-pago-document'
import { RECIBO_LOGO_PATH, type EmisorRecibo } from '@/lib/config/recibo-emisor'
import { armarDatosRecibo } from '@/lib/utils/control-recibo'

const datos = armarDatosRecibo({
  numero: 1,
  fecha: new Date('2026-10-04T00:00:00.000Z'),
  clienteNombre: 'Ana Núñez Peña',
  clienteDocumento: '1.020.304.050',
  clienteTipoDocumento: 'CC',
  clienteDireccion: 'Cra 74 # 89-95',
  clienteCiudad: 'Medellín',
  clienteTelefono: '301 510 6144',
  elaboradoPor: 'Luisa Gómez',
  lineas: [
    { servicio: 'Administración', referencia: '01', monto: 150000 },
    { servicio: 'Afiliación', referencia: null, monto: 250000 },
  ],
  monto: 400000,
  bolsilloNombre: 'Bancolombia',
  concepto: 'Pago de servicios de octubre',
  anulado: false,
})

const EMISOR_PRUEBA: EmisorRecibo = {
  razonSocial: 'Empresa de Prueba S.A.S.',
  nit: '900123456-7',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Bogotá',
  telefono: '3000000000',
  email: 'contacto@example.com',
}

async function render(props: { anulado?: boolean; logo?: boolean }) {
  const logoBuffer = props.logo
    ? await readFile(path.join(process.cwd(), RECIBO_LOGO_PATH))
    : undefined
  return renderizarReciboPdf({
    datos: { ...datos, anulado: props.anulado ?? false },
    emisor: EMISOR_PRUEBA,
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

  it('renderiza un recibo antiguo sin datos de contacto y sin firmante', async () => {
    const pdf = await renderizarReciboPdf({
      datos: {
        ...datos,
        cliente: { ...datos.cliente, tipoDocumento: '', direccion: '', ciudad: '', telefono: '' },
        elaboradoPor: '',
      },
      emisor: EMISOR_PRUEBA,
    })
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  // react-pdf compresses the content streams, so the text "ANULADO" cannot be
  // grepped in the buffer. The ANULADO mark is the only difference between the
  // two renders, so a larger buffer is the proxy that it was drawn.
  it('el recibo anulado pesa más que el normal (la marca ANULADO se dibuja)', async () => {
    const normal = await render({ anulado: false, logo: true })
    const anulado = await render({ anulado: true, logo: true })
    expect(anulado.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(anulado.length).toBeGreaterThan(normal.length)
  })

  // Long names/addresses and many lines must wrap and flow onto further pages
  // instead of throwing or clipping. Pages cannot be counted (compressed
  // streams), so the extra page shows up as a larger buffer than the short one.
  it('renderiza un recibo con textos largos y 40 líneas, más grande que el corto', async () => {
    const largo = await renderizarReciboPdf({
      datos: {
        ...datos,
        cliente: {
          ...datos.cliente,
          nombre: 'Corporación Internacional de Servicios Profesionales y Asesorías Jurídicas '.repeat(2),
          direccion: 'Carrera 74 número 89-95 apartamento 1201 torre 3 conjunto residencial '.repeat(3),
        },
        lineas: Array.from({ length: 40 }, (_, i) => ({
          servicio: `Servicio de administración número ${i + 1}`,
          referencia: null,
          monto: 10000,
        })),
      },
      emisor: EMISOR_PRUEBA,
    })
    const corto = await render({ logo: false })
    expect(largo.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(largo.length).toBeGreaterThan(corto.length)
  })
})
