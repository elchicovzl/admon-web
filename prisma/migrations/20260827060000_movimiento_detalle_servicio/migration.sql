-- Desglose de un cobro por servicio de Alegra.
--
-- Un cobro no es de una sola cosa. Medido contra producción, la factura
-- FEAD10134 son 729.000 que se descomponen así:
--
--   Administracion         126.050 + IVA 19%  = 150.000  ← ingreso de Admon
--   Recaudo para Terceros                       579.000  ← entra y vuelve a salir
--
-- Sin este desglose, la única forma de etiquetar el movimiento es elegir uno
-- de los dos servicios — y se pierde justo el corte que interesa.
--
-- POR QUÉ UNA TABLA HIJA Y NO UN CAMPO EN "movimientos"
--
-- Un `servicioAlegraId` alcanzaría para un cobro manual de una sola cosa, pero
-- no para un documento de Alegra: la cotización 1191 tiene diez líneas. Tener
-- las dos cosas dejaría dos caminos que hay que mantener sincronizados, y el
-- día que alguien toque uno solo el reporte miente. Hay un solo mecanismo: un
-- cobro manual escribe UNA fila acá.

CREATE TABLE "movimiento_detalle_servicio" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "servicioAlegraId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_detalle_servicio_pkey" PRIMARY KEY ("id")
);

-- Un servicio aparece una sola vez por movimiento: las líneas repetidas del
-- mismo item se fusionan antes de guardar (la factura FEAD10127 trae "Recaudo
-- para Terceros" dos veces; la cotización 1191, diez de "Liquidacion Planilla").
CREATE UNIQUE INDEX "movimiento_detalle_servicio_movimientoId_servicioAlegraId_key"
    ON "movimiento_detalle_servicio"("movimientoId", "servicioAlegraId");

-- Reportar "cuánto entró por Independiente 03" arranca por acá.
CREATE INDEX "movimiento_detalle_servicio_servicioAlegraId_idx"
    ON "movimiento_detalle_servicio"("servicioAlegraId");

-- El desglose no tiene vida propia fuera de su movimiento.
ALTER TABLE "movimiento_detalle_servicio"
    ADD CONSTRAINT "movimiento_detalle_servicio_movimientoId_fkey"
    FOREIGN KEY ("movimientoId") REFERENCES "movimientos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- El servicio sí: se desactiva, nunca se borra, porque el desglose histórico
-- lo sigue apuntando.
ALTER TABLE "movimiento_detalle_servicio"
    ADD CONSTRAINT "movimiento_detalle_servicio_servicioAlegraId_fkey"
    FOREIGN KEY ("servicioAlegraId") REFERENCES "servicios_alegra"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Siempre positivo: el signo lo pone el `tipo` del movimiento, igual que en el
-- resto del libro. Un desglose en cero es ruido — no dice que se cobró ese
-- servicio, dice que alguien guardó una fila de más.
ALTER TABLE "movimiento_detalle_servicio"
    ADD CONSTRAINT "detalle_servicio_monto_positivo" CHECK ("monto" > 0);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mismo criterio que el resto del módulo: Prisma se conecta como superusuario
-- y salta RLS; habilitarlo sin políticas deja la tabla en "deny all" para los
-- roles anon/authenticated de PostgREST.

ALTER TABLE public.movimiento_detalle_servicio ENABLE ROW LEVEL SECURITY;
