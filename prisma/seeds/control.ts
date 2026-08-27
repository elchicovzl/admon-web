/**
 * Catálogos del módulo Control (libro de caja interno).
 *
 * Todo lo de acá está derivado del Excel que este módulo reemplaza, no
 * inventado: los bolsillos salen de la hoja CUENTAS y de las columnas de
 * PAGOS POR DEBAJO, y las categorías salen de agrupar los 93 conceptos
 * distintos que aparecen en esa hoja.
 *
 * Por qué el catálogo de categorías es CHICO y el Excel tenía 93 conceptos:
 * la hoja mezcla "quién" con "qué" en la misma columna. BURBUJA, IVEC y
 * BRANDON no son categorías — son contrapartes. Acá eso se separa en tres
 * campos del movimiento:
 *
 *   contraparteId  →  quién  (BURBUJA, IVEC, Fawer…)
 *   categoriaId    →  qué tipo de gasto  (catálogo controlado)
 *   concepto       →  el detalle en texto libre  ("Pasajes al centro")
 *
 * Los tres catálogos son editables desde la UI: esto es solo el arranque.
 */

import type { PrismaClient } from '@prisma/client'
import {
  TipoBolsillo,
  TipoContraparte,
  GrupoCategoria,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Bolsillos — de dónde sale y a dónde entra la plata
// ---------------------------------------------------------------------------

const BOLSILLOS = [
  { nombre: 'IVONE', tipo: TipoBolsillo.BANCARIA, orden: 0 },
  { nombre: 'EFECTIVO', tipo: TipoBolsillo.EFECTIVO, orden: 1 },
  { nombre: 'CAJA MENOR', tipo: TipoBolsillo.CAJA_MENOR, orden: 2 },
  { nombre: 'ADMON', tipo: TipoBolsillo.BANCARIA, orden: 3 },
  { nombre: 'AHORRO EFECTIVO', tipo: TipoBolsillo.AHORRO, orden: 4 },

  // Cuenta de tercero que se usaba como bolsillo. Deja de aparecer en la hoja
  // CUENTAS a partir de enero-2026, cuando la estructura de columnas cambia y
  // esta desaparece. Entra cerrado, no borrado: sus movimientos históricos
  // tienen que poder seguir existiendo.
  {
    nombre: 'JOSE Q',
    tipo: TipoBolsillo.BANCARIA,
    orden: 5,
    isActive: false,
    cerradoEn: new Date('2026-01-31'),
  },
] as const

// ---------------------------------------------------------------------------
// Categorías — el "qué". El comentario de cada una lista los conceptos del
// Excel que absorbe, que es justamente el mapa que va a necesitar la
// migración histórica (Fase B).
// ---------------------------------------------------------------------------

const CATEGORIAS = [
  // Lo que entra, separado en dos porque para el negocio son cosas distintas.
  // "Por debajo": el documento es una cotización, que Alegra trata como
  // informativa — no dice si se cobró. Entran a IVONE.
  { nombre: 'Cobro de cotización', grupo: GrupoCategoria.COBRO_COTIZACION },
  // "Por arriba": el documento es una factura de venta, con estado y
  // `totalPaid`, así que se sabe cuánto entró de verdad.
  { nombre: 'Cobro de factura', grupo: GrupoCategoria.COBRO_FACTURA },

  // Los pagos "por debajo": bruto menos deducción por abono a préstamo.
  { nombre: 'Pago por debajo', grupo: GrupoCategoria.NOMINA_COMPLEMENTARIA },
  { nombre: 'Cesantías por debajo', grupo: GrupoCategoria.NOMINA_COMPLEMENTARIA },
  { nombre: 'Intereses de cesantías por debajo', grupo: GrupoCategoria.NOMINA_COMPLEMENTARIA },

  // El grupo que cobra el mismo monto todos los meses (IVEC, BRANDON,
  // MARLENY, JOSE Q, ANDREA, ALBERTO, YESSIKA, LUISA…). El valor pasó de
  // 100.000 a 110.000 en enero-2026 para casi todos.
  //
  // OJO: ELIANA SIMPLE y ANA SIMPLE NO van acá aunque aparezcan mes a mes.
  // Su pago depende de cuántos clientes refieran → 'Comisión por referidos'.
  { nombre: 'Pago mensual fijo', grupo: GrupoCategoria.NOMINA_FIJA },

  // COMISION CARLOS SANITAS, COMISION COLPENSIONES, COMISION ANDREY,
  // COMISION HECTOR, COMISION SOLUCIONES PRO, COMISION ROBINSON…
  { nombre: 'Comisión de afiliación', grupo: GrupoCategoria.COMISION },
  { nombre: 'Comisión por incapacidad', grupo: GrupoCategoria.COMISION },
  { nombre: 'Comisión de asesoría', grupo: GrupoCategoria.COMISION },

  // ELIANA SIMPLE, ANA SIMPLE. Son dos personas que trabajan en Simple
  // (empresa de seguridad social) y refieren clientes a Admon. Se les paga
  // comisión según cuántos clientes manden, así que el monto VARÍA y no es
  // nómina: en el Excel va 40.000 una vez y 60.000 las demás.
  { nombre: 'Comisión por referidos', grupo: GrupoCategoria.COMISION },

  // Las dos patas de un ServicioReferenciado. El tipo de movimiento
  // (INGRESO / EGRESO) ya distingue el cobro de la entrega, así que no hacen
  // falta categorías separadas para cada lado.
  { nombre: 'Servicio de mensajería', grupo: GrupoCategoria.SERVICIO_REFERENCIADO },
  { nombre: 'Exámenes médicos', grupo: GrupoCategoria.SERVICIO_REFERENCIADO },

  // PASAJES ALBERTO / CENTRO / YUDY, TRANSPORTE ESCRITORIO, PAGO TRASTEO
  { nombre: 'Transporte y pasajes', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // PAPELERIA, RESMA, TOMAS OFICINA, LAMPARAS, RELOJ OFICINA, MEMORIA
  { nombre: 'Papelería y oficina', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // DON LUIS (MATERIALES / MANO DE OBRA ARREGLOS OFICINA)
  { nombre: 'Mantenimiento y arreglos', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // FACEBOOK, GABY - VIDEO, ESTAMPADO CAMISETAS
  { nombre: 'Publicidad y diseño', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // SIM CARD CLARO, ESTUCHE CELULAR, COMISION CELULAR
  { nombre: 'Telefonía y conectividad', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // VUELTA FAWER, VUELTA FAWER NUEVA EPS, MENSAJERO CRISTIAN TOBON
  { nombre: 'Diligencias y trámites', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // BURBUJA / ANDRES BURBUJA (la misma: es una TIENDA, no una persona —
  // gaseosas y consumos de oficina), CAFE DON EZEQUIEL. Va aparte de aseo
  // porque es el concepto más frecuente del Excel: 15 apariciones.
  { nombre: 'Cafetería y bebidas', grupo: GrupoCategoria.GASTO_OPERATIVO },
  // VENENOS (fumigación)
  { nombre: 'Aseo y fumigación', grupo: GrupoCategoria.GASTO_OPERATIVO },

  // MICHELADAS, ALMUERZO ADMON, ALMUERZO CUMPLEAÑOS, PIÑATERIA, YUDY PAN
  { nombre: 'Alimentación y celebraciones', grupo: GrupoCategoria.GASTO_BIENESTAR },
  // REGALO VANESA, REGALO LEIDY, REGALO DANIELA
  { nombre: 'Regalos', grupo: GrupoCategoria.GASTO_BIENESTAR },
  // CORREA, CORREAS, ESTAMPADOS CAMISAS
  { nombre: 'Dotación', grupo: GrupoCategoria.GASTO_BIENESTAR },

  { nombre: 'Desembolso de préstamo', grupo: GrupoCategoria.PRESTAMO_DESEMBOLSO },
  { nombre: 'Abono a préstamo', grupo: GrupoCategoria.PRESTAMO_ABONO },

  { nombre: 'Traslado entre bolsillos', grupo: GrupoCategoria.TRASLADO },

  // DEVOLUCION CLIENTE YERLI CASTAÑEDA, DEVOLUCION MONICA PATRICIA OCHOA
  { nombre: 'Devolución a cliente', grupo: GrupoCategoria.DEVOLUCION },

  // VARIOS. Existe para que nadie invente una categoría por un movimiento
  // suelto — pero si se llena, es señal de que falta una categoría real.
  { nombre: 'Varios', grupo: GrupoCategoria.OTRO },
] as const

// ---------------------------------------------------------------------------
// Tipos de servicio referenciado
// ---------------------------------------------------------------------------
//
// Es catálogo y no enum porque van a aparecer más servicios con esta misma
// forma (Admon cobra, entrega a un tercero, y a veces deja margen).
//
// Cada tipo apunta explícitamente a la categoría con la que se registran sus
// movimientos. El vínculo se escribe acá y no se adivina por nombre: fijate
// que "Mensajería" y "Servicio de mensajería" NO son el mismo string.

const TIPOS_SERVICIO = [
  { nombre: 'Mensajería', categoria: 'Servicio de mensajería' },
  { nombre: 'Exámenes médicos', categoria: 'Exámenes médicos' },
] as const

// ---------------------------------------------------------------------------
// Contrapartes conocidas
// ---------------------------------------------------------------------------
//
// No son catálogo, pero son las tres partes fijas del servicio de mensajería
// y sin ellas el módulo arranca vacío. Los NIT van sin dígito de verificación:
// el DV se calcula con el algoritmo DIAN cuando hay que mostrarlo.

const CONTRAPARTES_CON_NIT = [
  {
    nombre: 'A&A MODA CIRCULAR SAS',
    tipo: TipoContraparte.CLIENTE,
    documento: '901485874', // NIT 901485874-1
    notas: 'En el Excel aparece como "CLOSET DE MODA" y como "CLOSET".',
  },
  {
    nombre: 'MOMPOSSINA SWIMWEAR S.A.S',
    tipo: TipoContraparte.CLIENTE,
    documento: '901490160', // NIT 901490160-1
    notas: 'En el Excel aparece como "MOMPOSINA".',
  },
] as const

const CONTRAPARTES_SIN_DOCUMENTO = [
  {
    nombre: 'Fawer',
    tipo: TipoContraparte.PROVEEDOR,
    notas: 'Mensajero independiente. Recibe el 100% de lo cotizado por mensajería.',
  },
  {
    nombre: 'Burbuja',
    tipo: TipoContraparte.PROVEEDOR,
    notas:
      'Tienda donde se compran gaseosas y consumos de oficina. En el Excel ' +
      'aparece como "BURBUJA" y como "ANDRES BURBUJA" — es la misma, y es un ' +
      'negocio, no una persona.',
  },
] as const

/**
 * Carga los catálogos del módulo Control. Idempotente: se puede correr las
 * veces que haga falta sin duplicar nada.
 */
export async function seedControlCatalogs(
  prisma: PrismaClient,
  createdById: string
) {
  console.log('\n💰 Seeding catálogos del módulo Control...')

  for (const bolsillo of BOLSILLOS) {
    await prisma.bolsillo.upsert({
      where: { nombre: bolsillo.nombre },
      // No se pisan isActive ni cerradoEn: si alguien cerró un bolsillo desde
      // la UI, un re-seed no debe reabrirlo.
      update: { tipo: bolsillo.tipo, orden: bolsillo.orden },
      create: bolsillo,
    })
  }
  console.log(`✅ ${BOLSILLOS.length} bolsillos`)

  for (const categoria of CATEGORIAS) {
    await prisma.categoriaMovimiento.upsert({
      where: { nombre: categoria.nombre },
      update: { grupo: categoria.grupo },
      create: categoria,
    })
  }
  console.log(`✅ ${CATEGORIAS.length} categorías`)

  for (const tipo of TIPOS_SERVICIO) {
    const categoria = await prisma.categoriaMovimiento.findUnique({
      where: { nombre: tipo.categoria },
      select: { id: true },
    })

    // Las categorías se siembran arriba, así que esto solo puede fallar si
    // alguien renombró una a mano. Vale la pena reventar acá con un mensaje
    // claro en vez de dejar el tipo de servicio apuntando a cualquier cosa.
    if (!categoria) {
      throw new Error(
        `El tipo de servicio "${tipo.nombre}" apunta a la categoría "${tipo.categoria}", que no existe.`
      )
    }

    await prisma.tipoServicioReferenciado.upsert({
      where: { nombre: tipo.nombre },
      update: { categoriaId: categoria.id },
      create: { nombre: tipo.nombre, categoriaId: categoria.id },
    })
  }
  console.log(`✅ ${TIPOS_SERVICIO.length} tipos de servicio referenciado`)

  for (const contraparte of CONTRAPARTES_CON_NIT) {
    await prisma.contraparte.upsert({
      where: { documento: contraparte.documento },
      update: { nombre: contraparte.nombre, tipo: contraparte.tipo },
      create: { ...contraparte, createdById },
    })
  }

  // Fawer no tiene documento, y `nombre` no es único en el schema — dos
  // personas pueden llamarse igual. Por eso acá va findFirst + create en vez
  // de un upsert.
  for (const contraparte of CONTRAPARTES_SIN_DOCUMENTO) {
    const existente = await prisma.contraparte.findFirst({
      where: { nombre: contraparte.nombre },
      select: { id: true },
    })

    if (!existente) {
      await prisma.contraparte.create({
        data: { ...contraparte, createdById },
      })
    }
  }
  console.log(
    `✅ ${CONTRAPARTES_CON_NIT.length + CONTRAPARTES_SIN_DOCUMENTO.length} contrapartes conocidas`
  )
}
