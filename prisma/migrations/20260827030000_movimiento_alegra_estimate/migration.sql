-- Dos cosas que van juntas: los ingresos del libro.

-- 1. Grupo de categoría para lo que ENTRA.
--
-- Los once grupos originales se diseñaron mirando el Excel, que era todo
-- egresos. Los ingresos del negocio vienen de cobrar cotizaciones de Alegra y
-- no tenían dónde caer.
ALTER TYPE "GrupoCategoria" ADD VALUE IF NOT EXISTS 'COBRO_A_CLIENTE';

-- 2. Referencia del movimiento a la cotización que lo originó.
--
-- Es una referencia, no una consolidación: siguen siendo dos libros separados,
-- pero se puede saltar de un ingreso al documento que lo generó.
--
-- El índice es ÚNICO a propósito: importar dos veces la misma cotización
-- duplicaría un ingreso, y eso tiene que ser imposible en la base y no solo en
-- el código.
ALTER TABLE "movimientos" ADD COLUMN "alegraEstimateId" TEXT;

CREATE UNIQUE INDEX "movimientos_alegraEstimateId_key"
  ON "movimientos"("alegraEstimateId");
