import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ERROR_NO_AUTENTICADO,
  ERROR_RECIBO_NO_ENCONTRADO,
  ERROR_SIN_ACCESO_CONTROL,
} from '@/lib/utils/control-errores'
import { armarDatosRecibo } from '@/lib/utils/control-recibo'

const {
  getReciboParaPdf,
  renderizarReciboPdf,
  leerLogoRecibo,
  emisorReciboCompleto,
  obtenerEmisorRecibo,
} =
  vi.hoisted(() => ({
    getReciboParaPdf: vi.fn(),
    renderizarReciboPdf: vi.fn(),
    leerLogoRecibo: vi.fn(),
    emisorReciboCompleto: vi.fn(),
    obtenerEmisorRecibo: vi.fn(),
  }))

vi.mock('@/lib/actions/control.actions', () => ({ getReciboParaPdf }))
vi.mock('@/lib/pdf/recibo-pago-document', () => ({ renderizarReciboPdf }))
vi.mock('@/lib/pdf/recibo-pago-logo', () => ({ leerLogoRecibo }))
vi.mock('@/lib/config/recibo-emisor', () => ({ emisorReciboCompleto }))
vi.mock('@/lib/control/emisor-recibo', () => ({ obtenerEmisorRecibo }))

import { GET } from '../route'

const datos = armarDatosRecibo({
  numero: 1,
  fecha: new Date('2026-10-04T00:00:00.000Z'),
  clienteNombre: 'Ana Núñez',
  clienteDocumento: null,
  lineas: [{ servicio: 'Administración', referencia: null, monto: 1000 }],
  monto: 1000,
  bolsilloNombre: 'Bancolombia',
  concepto: 'Pago',
  anulado: false,
})

const emisorPrueba = { razonSocial: 'Emisor de prueba' }

function llamar() {
  return GET(new Request('http://localhost/dashboard/control/recibos/abc/pdf'), {
    params: Promise.resolve({ id: 'abc' }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  leerLogoRecibo.mockResolvedValue(Buffer.from('logo'))
  renderizarReciboPdf.mockResolvedValue(Buffer.from('%PDF-1.4 prueba'))
  emisorReciboCompleto.mockReturnValue(true)
  obtenerEmisorRecibo.mockResolvedValue(emisorPrueba)
})

describe('GET /dashboard/control/recibos/[id]/pdf', () => {
  it.each([
    [ERROR_NO_AUTENTICADO, 401],
    [ERROR_SIN_ACCESO_CONTROL, 403],
    [ERROR_RECIBO_NO_ENCONTRADO, 404],
    ['Error inesperado de la base', 500],
  ])('mapea "%s" a %i y no renderiza', async (error, status) => {
    getReciboParaPdf.mockResolvedValue({ success: false, error })

    const respuesta = await llamar()

    expect(respuesta.status).toBe(status)
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store')
    expect(await respuesta.json()).toEqual({ error })
    expect(renderizarReciboPdf).not.toHaveBeenCalled()
  })

  it('responde 404 si la action no trae ni datos ni error', async () => {
    getReciboParaPdf.mockResolvedValue({ success: false })

    expect((await llamar()).status).toBe(404)
  })

  it('responde 500 si el render falla', async () => {
    getReciboParaPdf.mockResolvedValue({ success: true, data: datos })
    renderizarReciboPdf.mockRejectedValue(new Error('boom'))

    const respuesta = await llamar()

    expect(respuesta.status).toBe(500)
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store')
  })

  it('entrega el PDF con sus cabeceras', async () => {
    getReciboParaPdf.mockResolvedValue({ success: true, data: datos })

    const respuesta = await llamar()

    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get('Content-Type')).toBe('application/pdf')
    expect(respuesta.headers.get('Content-Disposition')).toBe(
      'attachment; filename="Recibo-RP-0001.pdf"'
    )
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store')
    expect(Buffer.from(await respuesta.arrayBuffer()).toString()).toBe('%PDF-1.4 prueba')
    expect(respuesta.headers.has('X-Recibo-Emisor-Pendiente')).toBe(false)
    expect(renderizarReciboPdf).toHaveBeenCalledWith(
      expect.objectContaining({ emisor: emisorPrueba })
    )
    expect(emisorReciboCompleto).toHaveBeenCalledWith(emisorPrueba)
  })

  it('marca la respuesta cuando los datos del emisor están incompletos', async () => {
    getReciboParaPdf.mockResolvedValue({ success: true, data: datos })
    emisorReciboCompleto.mockReturnValue(false)

    const respuesta = await llamar()

    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get('X-Recibo-Emisor-Pendiente')).toBe('1')
  })
})
