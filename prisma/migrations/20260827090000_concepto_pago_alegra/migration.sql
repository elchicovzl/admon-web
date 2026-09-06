-- Traduce el concepto contable de un pago de Alegra a una categoría del libro.
--
-- Un pago de Alegra dice POR QUÉ se pagó. Medido sobre 150 pagos de salida
-- reales de la cuenta, el concepto está SIEMPRE:
--
--   61 lo traen en `payment.categories`  (pagos sin factura de compra)
--   89 en `bill.purchases.categories`    (pagos aplicados a una factura)
--    0 sin concepto, 0 con las dos cosas
--
-- Conceptos vistos: "Ingresos recibidos para terceros" (el recaudo),
-- "Aportes a EPS", "Aportes a ARL", "Aportes fondo de pensiones y cesantías",
-- "Aportes cajas de compensación familiar", "Otros gastos generales",
-- "Otros honorarios", "Teléfono / Internet", "Impuestos de renta".
--
-- Sin esta tabla hay que clasificar 244 pagos a mano, uno por uno. Es un
-- trabajo que nadie hace dos veces, y un reporte por categoría que nadie
-- mantiene deja de servir. Con ella se clasifica UNA vez por concepto.

CREATE TABLE "conceptos_pago_alegra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conceptos_pago_alegra_pkey" PRIMARY KEY ("id")
);

-- El nombre es la clave natural: no hay un id de concepto estable que venga
-- en los dos lados (pago y factura).
CREATE UNIQUE INDEX "conceptos_pago_alegra_nombre_key"
    ON "conceptos_pago_alegra"("nombre");

CREATE INDEX "conceptos_pago_alegra_categoriaId_idx"
    ON "conceptos_pago_alegra"("categoriaId");

-- RESTRICT como el resto de los catálogos: se desactivan, no se borran.
ALTER TABLE "conceptos_pago_alegra"
    ADD CONSTRAINT "conceptos_pago_alegra_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "categorias_movimiento"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.conceptos_pago_alegra ENABLE ROW LEVEL SECURITY;
