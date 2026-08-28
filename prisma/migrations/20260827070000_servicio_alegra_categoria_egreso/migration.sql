-- Atar un servicio "en tránsito" con la categoría por la que su plata sale.
--
-- POR QUÉ HACE FALTA
--
-- "Entra y vuelve a salir" era una afirmación que nadie podía verificar: el
-- ingreso vive en el desglose por servicio y el egreso en una categoría, dos
-- dimensiones que no se tocan. Medido contra los datos importados de 2026:
--
--   Entró por `Servicios de Mensajería`      15.942.000
--   Salió a Fawer                            48.151.660
--                                            ────────────
--   Diferencia                              -32.209.660   ← en TODOS los meses
--
-- Y peor: entraron 453.881.429 de `Recaudo para Terceros` en 947 líneas,
-- contra 61.675.854 de egresos TOTALES en el año. Esa plata entró al libro y
-- su salida nunca se registró, así que infla el saldo de los bolsillos.
--
-- El vínculo es OPCIONAL a propósito. Un servicio en tránsito sin categoría de
-- egreso no es un error de configuración: es el hallazgo de que a esa plata no
-- se le registró la salida.

ALTER TABLE "servicios_alegra" ADD COLUMN "categoriaEgresoId" TEXT;

CREATE INDEX "servicios_alegra_categoriaEgresoId_idx"
    ON "servicios_alegra"("categoriaEgresoId");

-- RESTRICT: una categoría con servicios atados no se borra. Igual que en el
-- resto del módulo, los catálogos se desactivan, no se borran.
ALTER TABLE "servicios_alegra"
    ADD CONSTRAINT "servicios_alegra_categoriaEgresoId_fkey"
    FOREIGN KEY ("categoriaEgresoId") REFERENCES "categorias_movimiento"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- La mensajería es plata en tránsito, y sale por "Servicio de mensajería".
-- ───────────────────────────────────────────────────────────────────────────
--
-- Confirmado por el negocio: lo que se cobra por mensajería se le paga a
-- Fawer. Se marca acá y no solo en el seed porque el catálogo ya está
-- sincronizado en las bases existentes, y la sincronización NUNCA pisa
-- `enTransito` de un registro que ya existe — esa decisión es del negocio.

UPDATE "servicios_alegra"
SET "enTransito" = true
WHERE "referencia" = '19' AND "enTransito" = false;

UPDATE "servicios_alegra" s
SET "categoriaEgresoId" = c.id
FROM "categorias_movimiento" c
WHERE s."referencia" = '19'
  AND s."categoriaEgresoId" IS NULL
  AND c."nombre" = 'Servicio de mensajería';
