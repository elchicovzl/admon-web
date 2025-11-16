-- CreateTable
CREATE TABLE "legal_representatives" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "identificationType" "IdentificationType" NOT NULL,
    "identificationNumber" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_representatives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_representatives_clientId_key" ON "legal_representatives"("clientId");

-- AddForeignKey
ALTER TABLE "legal_representatives" ADD CONSTRAINT "legal_representatives_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
