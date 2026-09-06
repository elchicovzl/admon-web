-- Marca qué categorías son costo de nómina.
--
-- POR QUÉ UN FLAG Y NO UN GRUPO
--
-- La nómina llega por dos vías que ya tienen grupo propio y no se pueden
-- fusionar:
--
--   "por arriba" (Alegra) → categorías creadas desde el concepto contable
--                           ("Otros honorarios", "Aportes a EPS"), en OTRO
--   "por debajo"  (Excel) → NOMINA_FIJA y NOMINA_COMPLEMENTARIA
--
-- Un flag las cruza sin tocar los grupos, que el resto del código usa para
-- separar cobros, préstamos y traslados.
--
-- POR QUÉ NO SE PUEDE DEDUCIR DEL NOMBRE
--
-- Alegra NO expone nómina en su API: no hay endpoints de empleados, contratos
-- ni desprendibles (verificado contra developer.alegra.com/llms.txt, y una
-- ruta inventada devuelve el mismo 403 que /payrolls). Lo único que existe es
-- la API de proveedor electrónico, que sirve para EMITIR a la DIAN con otro
-- token. Así que la nómina se reconstruye desde los pagos, y qué concepto es
-- nómina lo decide el negocio.

ALTER TABLE "categorias_movimiento"
    ADD COLUMN "esNomina" BOOLEAN NOT NULL DEFAULT false;

-- Los grupos del Excel son nómina por definición: así se llamaron al migrar.
UPDATE "categorias_movimiento"
SET "esNomina" = true
WHERE "grupo" IN ('NOMINA_FIJA', 'NOMINA_COMPLEMENTARIA');

-- Los conceptos contables de Alegra que el negocio confirmó como nómina.
-- "Otros honorarios" es el sueldo del equipo, incluido el contador externo:
-- 13 personas y 74.166.600 entre enero y julio de 2026.
UPDATE "categorias_movimiento"
SET "esNomina" = true
WHERE "nombre" IN (
    'Otros honorarios',
    'Sueldos personal de ventas',
    'Sueldos y salarios',
    'Cesantías',
    'Aportes a EPS',
    'Aportes a ARL',
    'Aportes fondo de pensiones y cesantías',
    'Aportes cajas de compensación familiar',
    'Dotación a trabajadores',
    'Dotación a trabajadores de ventas'
);
