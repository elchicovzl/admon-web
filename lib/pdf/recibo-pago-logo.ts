import { readFile } from 'fs/promises'
import path from 'path'
import { RECIBO_LOGO_PATH } from '@/lib/config/recibo-emisor'

/**
 * Reads the receipt logo from disk (no HTTP round trip). Returns undefined and
 * warns when the file is missing, so the PDF is still produced without it.
 */
export async function leerLogoRecibo(): Promise<Buffer | undefined> {
  const ruta = path.join(process.cwd(), RECIBO_LOGO_PATH)
  try {
    return await readFile(ruta)
  } catch (error) {
    console.warn('[control] logo del recibo no disponible, se genera sin logo', ruta, error)
    return undefined
  }
}
