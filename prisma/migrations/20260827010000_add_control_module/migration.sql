-- ═══════════════════════════════════════════════════════════════════════════
-- MÓDULO CONTROL — libro de caja interno
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Reemplaza el Excel de contabilidad. Ver prisma/schema.prisma para el detalle
-- de cada modelo y el porqué de cada decisión.
--
-- El bloque de CREATE TABLE / INDEX / FOREIGN KEY es salida de
-- `prisma migrate diff`. Lo que Prisma NO genera y va abajo a mano:
--   1. CHECK constraints — las reglas de negocio que no deben poder violarse
--      ni con un INSERT manual desde psql.
--   2. ROW LEVEL SECURITY — obligatorio en este repo para toda tabla nueva,
--      ver 20260224000000_enable_rls_all_tables.

-- CreateEnum
CREATE TYPE "TipoBolsillo" AS ENUM ('BANCARIA', 'EFECTIVO', 'CAJA_MENOR', 'AHORRO');

-- CreateEnum
CREATE TYPE "TipoContraparte" AS ENUM ('EMPLEADO', 'PROVEEDOR', 'CLIENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO', 'TRASLADO');

-- CreateEnum
CREATE TYPE "GrupoCategoria" AS ENUM ('NOMINA_COMPLEMENTARIA', 'NOMINA_FIJA', 'COMISION', 'SERVICIO_REFERENCIADO', 'GASTO_OPERATIVO', 'GASTO_BIENESTAR', 'PRESTAMO_DESEMBOLSO', 'PRESTAMO_ABONO', 'TRASLADO', 'DEVOLUCION', 'OTRO');

-- CreateTable
CREATE TABLE "bolsillos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoBolsillo" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cerradoEn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bolsillos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrapartes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoContraparte" NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "documento" TEXT,
    "notas" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "contrapartes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_movimiento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" "GrupoCategoria" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_servicio_referenciado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_servicio_referenciado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "bolsilloId" TEXT NOT NULL,
    "bolsilloDestinoId" TEXT,
    "categoriaId" TEXT NOT NULL,
    "contraparteId" TEXT,
    "prestamoId" TEXT,
    "anulaMovimientoId" TEXT,
    "notas" TEXT,
    "origenImport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamos" (
    "id" TEXT NOT NULL,
    "contraparteId" TEXT NOT NULL,
    "fechaDesembolso" DATE NOT NULL,
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "bolsilloOrigenId" TEXT NOT NULL,
    "marcadoIncobrable" BOOLEAN NOT NULL DEFAULT false,
    "incobrableMotivo" TEXT,
    "notas" TEXT,
    "origenImport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios_referenciados" (
    "id" TEXT NOT NULL,
    "tipoServicioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "periodo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "valorFacturado" DECIMAL(14,2) NOT NULL,
    "valorEntregado" DECIMAL(14,2) NOT NULL,
    "movimientoIngresoId" TEXT,
    "movimientoEgresoId" TEXT,
    "alegraEstimateId" TEXT,
    "notas" TEXT,
    "origenImport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "servicios_referenciados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_mensuales" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "bolsilloId" TEXT NOT NULL,
    "saldoInicial" DECIMAL(14,2) NOT NULL,
    "saldoFinalCalculado" DECIMAL(14,2) NOT NULL,
    "saldoFinalReal" DECIMAL(14,2),
    "diferencia" DECIMAL(14,2),
    "justificacion" TEXT,
    "esAperturaInicial" BOOLEAN NOT NULL DEFAULT false,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "cerradoEn" TIMESTAMP(3),
    "cerradoById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "cierres_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bolsillos_nombre_key" ON "bolsillos"("nombre");

-- CreateIndex
CREATE INDEX "bolsillos_isActive_orden_idx" ON "bolsillos"("isActive", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "contrapartes_userId_key" ON "contrapartes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contrapartes_clientId_key" ON "contrapartes"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "contrapartes_documento_key" ON "contrapartes"("documento");

-- CreateIndex
CREATE INDEX "contrapartes_tipo_isActive_idx" ON "contrapartes"("tipo", "isActive");

-- CreateIndex
CREATE INDEX "contrapartes_nombre_idx" ON "contrapartes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_movimiento_nombre_key" ON "categorias_movimiento"("nombre");

-- CreateIndex
CREATE INDEX "categorias_movimiento_grupo_isActive_idx" ON "categorias_movimiento"("grupo", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_servicio_referenciado_nombre_key" ON "tipos_servicio_referenciado"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_anulaMovimientoId_key" ON "movimientos"("anulaMovimientoId");

-- CreateIndex
CREATE INDEX "movimientos_periodo_bolsilloId_idx" ON "movimientos"("periodo", "bolsilloId");

-- CreateIndex
CREATE INDEX "movimientos_fecha_idx" ON "movimientos"("fecha");

-- CreateIndex
CREATE INDEX "movimientos_contraparteId_fecha_idx" ON "movimientos"("contraparteId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_categoriaId_idx" ON "movimientos"("categoriaId");

-- CreateIndex
CREATE INDEX "movimientos_prestamoId_idx" ON "movimientos"("prestamoId");

-- CreateIndex
CREATE INDEX "prestamos_contraparteId_idx" ON "prestamos"("contraparteId");

-- CreateIndex
CREATE INDEX "prestamos_fechaDesembolso_idx" ON "prestamos"("fechaDesembolso");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_referenciados_movimientoIngresoId_key" ON "servicios_referenciados"("movimientoIngresoId");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_referenciados_movimientoEgresoId_key" ON "servicios_referenciados"("movimientoEgresoId");

-- CreateIndex
CREATE INDEX "servicios_referenciados_periodo_idx" ON "servicios_referenciados"("periodo");

-- CreateIndex
CREATE INDEX "servicios_referenciados_tipoServicioId_fecha_idx" ON "servicios_referenciados"("tipoServicioId", "fecha");

-- CreateIndex
CREATE INDEX "servicios_referenciados_clienteId_idx" ON "servicios_referenciados"("clienteId");

-- CreateIndex
CREATE INDEX "servicios_referenciados_proveedorId_idx" ON "servicios_referenciados"("proveedorId");

-- CreateIndex
CREATE INDEX "cierres_mensuales_periodo_idx" ON "cierres_mensuales"("periodo");

-- CreateIndex
CREATE INDEX "cierres_mensuales_bolsilloId_periodo_idx" ON "cierres_mensuales"("bolsilloId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_mensuales_periodo_bolsilloId_key" ON "cierres_mensuales"("periodo", "bolsilloId");

-- AddForeignKey
ALTER TABLE "contrapartes" ADD CONSTRAINT "contrapartes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrapartes" ADD CONSTRAINT "contrapartes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrapartes" ADD CONSTRAINT "contrapartes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_bolsilloId_fkey" FOREIGN KEY ("bolsilloId") REFERENCES "bolsillos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_bolsilloDestinoId_fkey" FOREIGN KEY ("bolsilloDestinoId") REFERENCES "bolsillos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_contraparteId_fkey" FOREIGN KEY ("contraparteId") REFERENCES "contrapartes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "prestamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_anulaMovimientoId_fkey" FOREIGN KEY ("anulaMovimientoId") REFERENCES "movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_contraparteId_fkey" FOREIGN KEY ("contraparteId") REFERENCES "contrapartes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_bolsilloOrigenId_fkey" FOREIGN KEY ("bolsilloOrigenId") REFERENCES "bolsillos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_referenciados" ADD CONSTRAINT "servicios_referenciados_tipoServicioId_fkey" FOREIGN KEY ("tipoServicioId") REFERENCES "tipos_servicio_referenciado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_referenciados" ADD CONSTRAINT "servicios_referenciados_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "contrapartes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_referenciados" ADD CONSTRAINT "servicios_referenciados_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "contrapartes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_referenciados" ADD CONSTRAINT "servicios_referenciados_movimientoIngresoId_fkey" FOREIGN KEY ("movimientoIngresoId") REFERENCES "movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_referenciados" ADD CONSTRAINT "servicios_referenciados_movimientoEgresoId_fkey" FOREIGN KEY ("movimientoEgresoId") REFERENCES "movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_referenciados" ADD CONSTRAINT "servicios_referenciados_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_mensuales" ADD CONSTRAINT "cierres_mensuales_bolsilloId_fkey" FOREIGN KEY ("bolsilloId") REFERENCES "bolsillos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_mensuales" ADD CONSTRAINT "cierres_mensuales_cerradoById_fkey" FOREIGN KEY ("cerradoById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_mensuales" ADD CONSTRAINT "cierres_mensuales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK CONSTRAINTS — reglas que no dependen de que la app se porte bien
-- ═══════════════════════════════════════════════════════════════════════════

-- Un movimiento de cero o negativo no existe. La dirección la da `tipo`
-- (INGRESO / EGRESO / TRASLADO), nunca el signo del monto: montos con signo son
-- la puerta de entrada a que una resta quede sumando.
ALTER TABLE "movimientos"
  ADD CONSTRAINT "movimientos_monto_positivo" CHECK ("monto" > 0);

-- El destino existe si y solo si es un TRASLADO.
ALTER TABLE "movimientos"
  ADD CONSTRAINT "movimientos_destino_solo_traslado" CHECK (
    ("tipo" = 'TRASLADO' AND "bolsilloDestinoId" IS NOT NULL)
    OR
    ("tipo" <> 'TRASLADO' AND "bolsilloDestinoId" IS NULL)
  );

-- Un traslado a sí mismo no mueve plata pero sí ensucia el saldo del periodo.
ALTER TABLE "movimientos"
  ADD CONSTRAINT "movimientos_traslado_bolsillos_distintos" CHECK (
    "bolsilloDestinoId" IS NULL OR "bolsilloDestinoId" <> "bolsilloId"
  );

-- Un movimiento no puede anularse a sí mismo.
ALTER TABLE "movimientos"
  ADD CONSTRAINT "movimientos_no_se_autoanula" CHECK (
    "anulaMovimientoId" IS NULL OR "anulaMovimientoId" <> "id"
  );

-- `periodo` es "YYYY-MM". La app lo deriva SIEMPRE de `fecha` al escribir
-- (nunca es input del usuario), así que no pueden divergir; esto es la red
-- por si alguien inserta a mano.
ALTER TABLE "movimientos"
  ADD CONSTRAINT "movimientos_periodo_formato" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "servicios_referenciados"
  ADD CONSTRAINT "servicios_periodo_formato" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "cierres_mensuales"
  ADD CONSTRAINT "cierres_periodo_formato" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Un préstamo de cero no es un préstamo.
ALTER TABLE "prestamos"
  ADD CONSTRAINT "prestamos_monto_positivo" CHECK ("montoOriginal" > 0);

-- No se enfora valorEntregado <= valorFacturado: un servicio puede cerrar en
-- pérdida y el libro tiene que poder registrarlo. Solo se prohíbe el negativo.
ALTER TABLE "servicios_referenciados"
  ADD CONSTRAINT "servicios_valores_no_negativos" CHECK (
    "valorFacturado" >= 0 AND "valorEntregado" >= 0
  );

-- LA regla del cierre mensual: si el conteo real no coincide con el calculado,
-- la diferencia tiene que estar justificada. En el Excel esto no existía y por
-- eso ADMON perdió 1.932.660 entre noviembre y diciembre de 2025 sin dejar
-- rastro: alguien pisó el saldo y el descuadre desapareció de la vista.
ALTER TABLE "cierres_mensuales"
  ADD CONSTRAINT "cierres_diferencia_justificada" CHECK (
    "diferencia" IS NULL
    OR "diferencia" = 0
    OR ("justificacion" IS NOT NULL AND length(btrim("justificacion")) > 0)
  );

-- Un cierre marcado como cerrado tiene que decir cuándo y quién.
ALTER TABLE "cierres_mensuales"
  ADD CONSTRAINT "cierres_cerrado_con_traza" CHECK (
    "cerrado" = false
    OR ("cerradoEn" IS NOT NULL AND "cerradoById" IS NOT NULL)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mismo criterio que 20260224000000_enable_rls_all_tables: Prisma se conecta
-- como superusuario y salta RLS; habilitarlo sin políticas deja estas tablas
-- en "deny all" para los roles anon/authenticated de PostgREST.
--
-- Acá pesa más que en el resto del sistema: son nómina complementaria y
-- préstamos personales de gente identificada con nombre y apellido.

ALTER TABLE public.bolsillos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrapartes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_servicio_referenciado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_referenciados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_mensuales ENABLE ROW LEVEL SECURITY;
