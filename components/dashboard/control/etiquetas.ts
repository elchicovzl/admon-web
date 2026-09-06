import { GrupoCategoria, TipoBolsillo, TipoContraparte, TipoMovimiento } from '@prisma/client'

/** Nombre legible de cada grupo de categoría. */
export const ETIQUETA_GRUPO: Record<GrupoCategoria, string> = {
  COBRO_COTIZACION: 'Cobros por cotización (C)',
  COBRO_FACTURA: 'Cobros por factura (F)',
  NOMINA_COMPLEMENTARIA: 'Nómina complementaria',
  NOMINA_FIJA: 'Nómina fija',
  COMISION: 'Comisiones',
  SERVICIO_REFERENCIADO: 'Servicios referenciados',
  GASTO_OPERATIVO: 'Gastos operativos',
  GASTO_BIENESTAR: 'Bienestar',
  PRESTAMO_DESEMBOLSO: 'Préstamos — desembolso',
  PRESTAMO_ABONO: 'Préstamos — abono',
  TRASLADO: 'Traslados',
  DEVOLUCION: 'Devoluciones',
  OTRO: 'Otros',
}

/**
 * Qué significa cada grupo y, cuando corresponde, qué hace el sistema con él.
 *
 * Los grupos son un enum de Prisma y NO se editan desde la interfaz: el código
 * se ramifica sobre varios de ellos. Esta tabla es la referencia que reemplaza
 * a poder tocarlos.
 */
export const DESCRIPCION_GRUPO: Record<
  GrupoCategoria,
  { que: string; usadoPorElSistema?: string }
> = {
  COBRO_COTIZACION: {
    que: 'La plata que entra al cobrar una cotización — los ingresos "por debajo".',
    usadoPorElSistema:
      'La importación de cotizaciones de Alegra registra los ingresos con una categoría de este grupo. Alegra no dice si una cotización se cobró, así que la fecha es la del documento.',
  },
  COBRO_FACTURA: {
    que: 'La plata que entra al cobrar una factura de venta — los ingresos "por arriba".',
    usadoPorElSistema:
      'La importación de facturas usa `totalPaid`, es decir lo efectivamente cobrado, no el total facturado.',
  },
  NOMINA_COMPLEMENTARIA: {
    que: 'Los pagos "por debajo" y sus cesantías e intereses.',
  },
  NOMINA_FIJA: {
    que: 'El monto que cobra el mismo grupo de gente todos los meses.',
  },
  COMISION: {
    que: 'Comisiones por afiliación, incapacidades, asesorías y referidos.',
  },
  SERVICIO_REFERENCIADO: {
    que: 'Las dos patas de un servicio intermediado: mensajería, exámenes médicos.',
    usadoPorElSistema:
      'Cada tipo de servicio apunta a una categoría de este grupo para registrar su cobro y su entrega.',
  },
  GASTO_OPERATIVO: {
    que: 'Lo que se necesita para que la oficina funcione.',
  },
  GASTO_BIENESTAR: {
    que: 'Almuerzos, celebraciones, regalos y dotación.',
  },
  PRESTAMO_DESEMBOLSO: {
    que: 'La plata que sale cuando se otorga un préstamo.',
    usadoPorElSistema:
      'El desembolso se crea automáticamente al registrar un préstamo y NO cuenta como abono.',
  },
  PRESTAMO_ABONO: {
    que: 'Cada pago que reduce el saldo de un préstamo.',
    usadoPorElSistema:
      'El saldo de todo préstamo se calcula sumando los movimientos de este grupo. Sin él, los saldos quedan en cero.',
  },
  TRASLADO: {
    que: 'Plata que se mueve de un bolsillo a otro sin entrar ni salir del negocio.',
  },
  DEVOLUCION: {
    que: 'Plata que se le devuelve a un cliente.',
  },
  OTRO: {
    que: 'Lo que todavía no tiene un lugar propio. Si se llena, falta una categoría.',
  },
}

export const ETIQUETA_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso — entra plata',
  EGRESO: 'Egreso — sale plata',
  TRASLADO: 'Traslado — entre bolsillos',
}

export const ETIQUETA_TIPO_BOLSILLO: Record<TipoBolsillo, string> = {
  BANCARIA: 'Cuenta bancaria',
  EFECTIVO: 'Efectivo',
  CAJA_MENOR: 'Caja menor',
  AHORRO: 'Ahorro',
}

export const ETIQUETA_TIPO_CONTRAPARTE: Record<TipoContraparte, string> = {
  EMPLEADO: 'Empleado',
  PROVEEDOR: 'Proveedor',
  CLIENTE: 'Cliente',
  OTRO: 'Otro',
}
