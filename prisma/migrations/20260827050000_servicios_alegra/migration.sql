-- Catálogo de servicios de Alegra — espejo de /items.
--
-- POR QUÉ UNA TABLA NUEVA Y NO CATEGORÍAS
--
-- El pedido original era mapear los `item.name` de Alegra directo como
-- CategoriaMovimiento. No se puede, y no por taxonomía: por plata.
--
-- Los items no son una etiqueta del documento, son EL DESGLOSE DEL MONTO.
-- Medido contra la cuenta de producción, las 25 facturas más recientes:
--
--   FEAD10124  total = 504.600
--     ├─ Administracion         63.025   ← lo que gana Admon
--     └─ Recaudo para Terceros 429.600   ← entra y vuelve a salir
--
-- Ninguna factura tiene una sola línea. Poner una sola categoría obliga a
-- elegir entre las dos y pierde el corte que importa. Y como `grupo` ya separa
-- cotización de factura, meter los 22 servicios en categorías obligaría a
-- duplicarlos por grupo — 44 filas mezclando dos dimensiones en una columna,
-- que es el error del Excel que este módulo vino a corregir.
--
-- Así que son dos dimensiones separadas: la categoría dice qué naturaleza de
-- plata es, el servicio dice qué se vendió.
--
-- Esta migración crea SOLO el catálogo. El desglose por línea
-- (movimiento → N servicios con monto) es un paso aparte.

CREATE TABLE "servicios_alegra" (
    "id" TEXT NOT NULL,
    "alegraItemId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "referencia" TEXT,
    "descripcion" TEXT,
    "enTransito" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sincronizadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicios_alegra_pkey" PRIMARY KEY ("id")
);

-- La identidad es el id del item en Alegra, no el nombre: el nombre se corrige
-- desde allá y el vínculo no debe romperse por una tilde.
CREATE UNIQUE INDEX "servicios_alegra_alegraItemId_key" ON "servicios_alegra"("alegraItemId");

CREATE INDEX "servicios_alegra_isActive_nombre_idx" ON "servicios_alegra"("isActive", "nombre");

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mismo criterio que 20260224000000_enable_rls_all_tables y que el resto del
-- módulo Control: Prisma se conecta como superusuario y salta RLS; habilitarlo
-- sin políticas deja la tabla en "deny all" para los roles anon/authenticated
-- de PostgREST.

ALTER TABLE public.servicios_alegra ENABLE ROW LEVEL SECURITY;
