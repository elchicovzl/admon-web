import { z } from 'zod'

const campoRequerido = (etiqueta: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${etiqueta} es requerido`)
    .max(max, `${etiqueta} no puede exceder ${max} caracteres`)

// Accepted NIT format: 6 to 12 digits, optionally followed by "-" and one
// check digit (e.g. 900123456-7). No dots or spaces.
export const NIT_REGEX = /^\d{6,12}(-\d)?$/

export const configuracionEmpresaSchema = z.object({
  razonSocial: campoRequerido('La razón social'),
  nit: campoRequerido('El NIT', 20).regex(
    NIT_REGEX,
    'NIT inválido: use solo dígitos con dígito de verificación opcional (ej. 900123456-7)'
  ),
  direccion: campoRequerido('La dirección', 200),
  ciudad: campoRequerido('La ciudad', 80),
  telefono: campoRequerido('El teléfono', 40),
  email: campoRequerido('El correo', 120).email('Correo electrónico inválido'),
})

export type ConfiguracionEmpresaInput = z.infer<typeof configuracionEmpresaSchema>
