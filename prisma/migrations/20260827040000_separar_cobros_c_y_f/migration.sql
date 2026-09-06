-- Separar los ingresos en dos: por cotización ("por debajo") y por factura
-- ("por arriba").
--
-- Para el negocio son cosas distintas, y poder mirarlas por separado es media
-- razón de ser de este módulo. Por eso la distinción va en el GRUPO y no en la
-- categoría: un reporte por grupo las mezclaría.
--
-- La diferencia también es técnica: una cotización de Alegra no tiene estado ni
-- saldo, mientras que una factura trae `status`, `totalPaid` y `balance`. Con
-- la factura se sabe cuánto entró de verdad; con la cotización hay que
-- asumirlo.

ALTER TYPE "GrupoCategoria" RENAME VALUE 'COBRO_A_CLIENTE' TO 'COBRO_COTIZACION';
ALTER TYPE "GrupoCategoria" ADD VALUE IF NOT EXISTS 'COBRO_FACTURA';

-- Referencia a la factura, en columna propia y no en un campo genérico con
-- tipo: un id de factura no puede confundirse con uno de cotización si viven
-- separados. Único, para que importar dos veces la misma sea imposible.
ALTER TABLE "movimientos" ADD COLUMN "alegraInvoiceId" TEXT;

CREATE UNIQUE INDEX "movimientos_alegraInvoiceId_key"
  ON "movimientos"("alegraInvoiceId");
