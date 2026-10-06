import { NextResponse } from 'next/server'
import { getReciboParaPdf } from '@/lib/actions/control.actions'
import { EMISOR_RECIBO, emisorReciboCompleto } from '@/lib/config/recibo-emisor'
import { renderizarReciboPdf } from '@/lib/pdf/recibo-pago-document'
import { leerLogoRecibo } from '@/lib/pdf/recibo-pago-logo'
import {
  ERROR_NO_AUTENTICADO,
  ERROR_RECIBO_NO_ENCONTRADO,
  ERROR_SIN_ACCESO_CONTROL,
} from '@/lib/utils/control-errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const resultado = await getReciboParaPdf(id)

  if (!resultado.success || !resultado.data) {
    const error = resultado.error ?? ERROR_RECIBO_NO_ENCONTRADO
    if (error === ERROR_NO_AUTENTICADO) {
      return NextResponse.json({ error }, { status: 401, headers: SIN_CACHE })
    }
    if (error === ERROR_SIN_ACCESO_CONTROL) {
      return NextResponse.json({ error }, { status: 403, headers: SIN_CACHE })
    }
    const status = error === ERROR_RECIBO_NO_ENCONTRADO ? 404 : 500
    return NextResponse.json({ error }, { status, headers: SIN_CACHE })
  }

  const datos = resultado.data

  try {
    const logoBuffer = await leerLogoRecibo()
    const pdf = await renderizarReciboPdf({ datos, emisor: EMISOR_RECIBO, logoBuffer })

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Recibo-${datos.numeroFormateado}.pdf"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store',
    }
    if (!emisorReciboCompleto()) headers['X-Recibo-Emisor-Pendiente'] = '1'

    return new NextResponse(new Uint8Array(pdf), { status: 200, headers })
  } catch (error) {
    console.error('[control] no se pudo generar el PDF del recibo', id, error)
    return NextResponse.json(
      { error: 'No se pudo generar el PDF del recibo' },
      { status: 500, headers: SIN_CACHE }
    )
  }
}
