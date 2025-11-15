-- CreateTable
CREATE TABLE "client_addresses" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "ciudad" TEXT,
    "direccion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_additional_info" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "actividadComercial" TEXT,
    "salario" DECIMAL(12,2),
    "novedadesIngreso" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_additional_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_beneficiaries" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tipoRelacion" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "identificationType" "IdentificationType" NOT NULL,
    "identificationNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_addresses_clientId_key" ON "client_addresses"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_additional_info_clientId_key" ON "client_additional_info"("clientId");

-- CreateIndex
CREATE INDEX "client_beneficiaries_clientId_idx" ON "client_beneficiaries"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_beneficiaries_clientId_identificationNumber_key" ON "client_beneficiaries"("clientId", "identificationNumber");

-- AddForeignKey
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_additional_info" ADD CONSTRAINT "client_additional_info_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_beneficiaries" ADD CONSTRAINT "client_beneficiaries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
