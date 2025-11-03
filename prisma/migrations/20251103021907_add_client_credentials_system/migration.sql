-- CreateEnum
CREATE TYPE "AdministratorType" AS ENUM ('EPS', 'AFP', 'ARL', 'CCF', 'PILA_OPERATOR', 'OTRA');

-- CreateTable
CREATE TABLE "client_credentials" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "administratorName" TEXT NOT NULL,
    "administratorType" "AdministratorType" NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "portalUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_credentials_clientId_idx" ON "client_credentials"("clientId");

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
