-- Categoría explícita para cada tipo de servicio referenciado.
--
-- Antes, los movimientos que genera el sistema para un servicio resolvían su
-- categoría por coincidencia de nombre entre el tipo y la categoría. Eso
-- fallaba en silencio: "Mensajería" (tipo) no coincide con "Servicio de
-- mensajería" (categoría), así que caía a un fallback que tomaba cualquier
-- categoría del grupo SERVICIO_REFERENCIADO. Los movimientos quedaban con la
-- categoría equivocada sin que nada avisara.
--
-- Va en tres tiempos porque la columna es obligatoria y la tabla puede tener
-- filas: agregar nullable, rellenar, recién ahí exigir NOT NULL.

-- 1. Nullable
ALTER TABLE "tipos_servicio_referenciado" ADD COLUMN "categoriaId" TEXT;

-- 2. Backfill. Se intenta emparejar por nombre en cualquiera de las dos
--    direcciones ("Exámenes médicos" coincide exacto; "Mensajería" está
--    contenido en "Servicio de mensajería"). Si no hay coincidencia, cae a la
--    primera categoría activa del grupo — el mismo criterio que tenía el
--    código, pero ahora se resuelve UNA vez y queda escrito.
UPDATE "tipos_servicio_referenciado" t
SET "categoriaId" = COALESCE(
  (
    SELECT c.id FROM "categorias_movimiento" c
    WHERE c.grupo = 'SERVICIO_REFERENCIADO'
      AND c."isActive"
      AND (c.nombre ILIKE '%' || t.nombre || '%' OR t.nombre ILIKE '%' || c.nombre || '%')
    ORDER BY c.nombre
    LIMIT 1
  ),
  (
    SELECT c.id FROM "categorias_movimiento" c
    WHERE c.grupo = 'SERVICIO_REFERENCIADO' AND c."isActive"
    ORDER BY c.nombre
    LIMIT 1
  )
)
WHERE t."categoriaId" IS NULL;

-- 3. NOT NULL + FK.
--    Si algún tipo quedó sin categoría, esto falla y la migración se detiene.
--    Es lo correcto: significa que no existe ninguna categoría del grupo
--    SERVICIO_REFERENCIADO, y seguir dejaría datos inconsistentes.
ALTER TABLE "tipos_servicio_referenciado"
  ALTER COLUMN "categoriaId" SET NOT NULL;

CREATE INDEX "tipos_servicio_referenciado_categoriaId_idx"
  ON "tipos_servicio_referenciado"("categoriaId");

ALTER TABLE "tipos_servicio_referenciado"
  ADD CONSTRAINT "tipos_servicio_referenciado_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias_movimiento"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
