-- CreateTable
CREATE TABLE "recibos_pago" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "contraparteId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteDocumento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "recibos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consecutivos" (
    "clave" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consecutivos_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "recibos_pago_numero_key" ON "recibos_pago"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_pago_movimientoId_key" ON "recibos_pago"("movimientoId");

-- CreateIndex
CREATE INDEX "recibos_pago_contraparteId_idx" ON "recibos_pago"("contraparteId");

-- AddForeignKey
ALTER TABLE "recibos_pago" ADD CONSTRAINT "recibos_pago_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_pago" ADD CONSTRAINT "recibos_pago_contraparteId_fkey" FOREIGN KEY ("contraparteId") REFERENCES "contrapartes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos_pago" ADD CONSTRAINT "recibos_pago_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the receipt counter so the first receipt increments an existing row
-- (no concurrent upsert race on the very first number).
INSERT INTO "consecutivos" ("clave", "ultimo") VALUES ('RECIBO_PAGO', 0);
