-- El IVA de cada línea del desglose.
--
-- El IVA no es ingreso: se cobra para girarlo a la DIAN, igual que el recaudo
-- para terceros. Hasta ahora el desglose guardaba solo el bruto, así que los
-- ingresos "por arriba" venían inflados por el impuesto.
--
-- POR QUÉ POR LÍNEA Y NO COMO PROPIEDAD DEL SERVICIO
--
-- Porque NO es una propiedad del servicio. Medido sobre 60 facturas reales:
--
--   Recaudo para Terceros    → SIN IMPUESTO
--   Administracion           → 19%
--   Servicios de Mensajería  → SIN IMPUESTO   (exenta)
--   Afiliacion Dependiente   → 19% en 3 líneas y SIN IMPUESTO en otras 2
--
-- El mismo servicio aparece con y sin IVA, así que el dato solo puede vivir
-- en la línea.
--
-- Va INCLUIDO en `monto` a propósito: eso es lo que entró a la caja, y el
-- saldo del bolsillo tiene que seguir cuadrando contra el extracto.

ALTER TABLE "movimiento_detalle_servicio"
    ADD COLUMN "impuesto" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- El impuesto es una parte del monto, nunca más que él, y nunca negativo.
ALTER TABLE "movimiento_detalle_servicio"
    ADD CONSTRAINT "detalle_servicio_impuesto_valido"
    CHECK ("impuesto" >= 0 AND "impuesto" <= "monto");
