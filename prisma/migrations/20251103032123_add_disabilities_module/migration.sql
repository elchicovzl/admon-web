-- CreateEnum
CREATE TYPE "DisabilityStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'URGENT');

-- CreateEnum
CREATE TYPE "HealthAdministrator" AS ENUM ('EPS_SURA', 'PORVENIR', 'NUEVA_EPS', 'ARL_SURA', 'SALUD_TOTAL', 'SAVIA_SALUD');

-- CreateTable
CREATE TABLE "disabilities" (
    "id" TEXT NOT NULL,
    "receptionDate" TIMESTAMP(3) NOT NULL,
    "status" "DisabilityStatus" NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "administrator" "HealthAdministrator" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "bankRegistry" BOOLEAN NOT NULL DEFAULT false,
    "transcription" TEXT NOT NULL,
    "filing" TEXT NOT NULL,
    "proofFileUrl" TEXT,
    "proofS3Key" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "disabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disability_observations" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "disabilityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disability_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disabilities_clientId_idx" ON "disabilities"("clientId");

-- CreateIndex
CREATE INDEX "disabilities_employeeId_idx" ON "disabilities"("employeeId");

-- CreateIndex
CREATE INDEX "disabilities_status_idx" ON "disabilities"("status");

-- CreateIndex
CREATE INDEX "disability_observations_disabilityId_idx" ON "disability_observations"("disabilityId");

-- AddForeignKey
ALTER TABLE "disabilities" ADD CONSTRAINT "disabilities_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disabilities" ADD CONSTRAINT "disabilities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disabilities" ADD CONSTRAINT "disabilities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disability_observations" ADD CONSTRAINT "disability_observations_disabilityId_fkey" FOREIGN KEY ("disabilityId") REFERENCES "disabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disability_observations" ADD CONSTRAINT "disability_observations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
