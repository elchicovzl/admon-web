-- Los egresos de Alegra: pagos, no facturas de compra.
--
-- Control es un libro de CAJA. Alegra documenta como advertencia crítica que
-- /bills (devengado) y /payments (caja) son el MISMO gasto en dos momentos y
-- que nunca se suman; para un libro de caja la fuente correcta es el pago,
-- porque una factura sin pagar no sacó plata de ninguna caja.
--
-- POR QUÉ HACÍA FALTA, con los números de 2026:
--
--   Egresos en Control (todos del Excel)      61.675.854
--   Pagos `out` en Alegra                    533.148.667  (244 pagos)
--   Recaudo para Terceros entrado sin salida 453.881.429
--
-- Los ingresos de Alegra ya se importaban y los egresos no, así que el libro
-- registraba lo que entraba y no lo que salía. De ahí el saldo inflado.

ALTER TABLE "movimientos" ADD COLUMN "alegraPaymentId" TEXT;

-- Importar dos veces el mismo pago tiene que ser imposible a nivel de base,
-- no solo a nivel de código. Igual que alegraEstimateId y alegraInvoiceId.
CREATE UNIQUE INDEX "movimientos_alegraPaymentId_key"
    ON "movimientos"("alegraPaymentId");
