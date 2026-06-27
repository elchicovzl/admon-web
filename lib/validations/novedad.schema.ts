import { z } from 'zod'
import { NovedadType, NovedadUnit } from '@prisma/client'

/**
 * Base de una novedad. Las fechas llegan como objetos Date desde el formulario
 * (el componente Calendar entrega Date), por eso usamos z.date() y no coerce.
 */
const novedadBaseSchema = z.object({
  userId: z.string().cuid('Seleccioná un empleado'),
  type: z.nativeEnum(NovedadType, { required_error: 'El tipo es requerido' }),
  unit: z.nativeEnum(NovedadUnit, { required_error: 'La unidad es requerida' }),
  startDate: z.date({ required_error: 'La fecha de inicio es requerida' }),
  endDate: z.date({ required_error: 'La fecha de fin es requerida' }),
  hours: z
    .number()
    .positive('Las horas deben ser mayores a 0')
    .max(24, 'Máximo 24 horas')
    .optional()
    .nullable(),
  observation: z
    .string()
    .max(1000, 'La observación no puede exceder 1000 caracteres')
    .optional()
    .nullable(),
})

/** La fecha de fin no puede ser anterior a la de inicio. */
const validRange = (data: { startDate: Date; endDate: Date }) =>
  data.endDate >= data.startDate

/** Si la unidad es HORAS, las horas son obligatorias y mayores a 0. */
const hoursRequiredForHourUnit = (data: {
  unit: NovedadUnit
  hours?: number | null
}) => data.unit !== NovedadUnit.HORAS || (data.hours != null && data.hours > 0)

export const createNovedadSchema = novedadBaseSchema
  .refine(validRange, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  })
  .refine(hoursRequiredForHourUnit, {
    message: 'Indicá las horas para una novedad por horas',
    path: ['hours'],
  })

export const updateNovedadSchema = novedadBaseSchema
  .extend({ id: z.string().cuid('ID inválido') })
  .refine(validRange, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  })
  .refine(hoursRequiredForHourUnit, {
    message: 'Indicá las horas para una novedad por horas',
    path: ['hours'],
  })

export const toggleNovedadStatusSchema = z.object({
  id: z.string().cuid('ID inválido'),
  isActive: z.boolean(),
})

export type CreateNovedadInput = z.infer<typeof createNovedadSchema>
export type UpdateNovedadInput = z.infer<typeof updateNovedadSchema>
