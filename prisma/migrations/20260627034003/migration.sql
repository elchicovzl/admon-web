-- CreateEnum
CREATE TYPE "NovedadType" AS ENUM ('VACACIONES', 'PERMISO', 'CALAMIDAD');

-- CreateEnum
CREATE TYPE "NovedadUnit" AS ENUM ('DIAS', 'HORAS');

-- CreateTable
CREATE TABLE "novedades" (
    "id" TEXT NOT NULL,
    "type" "NovedadType" NOT NULL,
    "unit" "NovedadUnit" NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "vacationDaysDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,
    "observation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "novedades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "novedades_userId_idx" ON "novedades"("userId");

-- CreateIndex
CREATE INDEX "novedades_year_idx" ON "novedades"("year");

-- CreateIndex
CREATE INDEX "novedades_type_idx" ON "novedades"("type");

-- CreateIndex
CREATE INDEX "novedades_userId_year_idx" ON "novedades"("userId", "year");

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
