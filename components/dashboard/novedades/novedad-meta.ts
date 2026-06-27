import { NovedadType, NovedadUnit } from '@prisma/client'

/** Etiquetas y estilos compartidos del módulo de novedades. */

export const NOVEDAD_TYPE_LABELS: Record<NovedadType, string> = {
  VACACIONES: 'Vacaciones',
  PERMISO: 'Permiso',
  CALAMIDAD: 'Calamidad',
}

export const NOVEDAD_UNIT_LABELS: Record<NovedadUnit, string> = {
  DIAS: 'Días',
  HORAS: 'Horas',
}

export const NOVEDAD_TYPE_BADGE: Record<
  NovedadType,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  VACACIONES: 'default',
  PERMISO: 'secondary',
  CALAMIDAD: 'outline',
}
