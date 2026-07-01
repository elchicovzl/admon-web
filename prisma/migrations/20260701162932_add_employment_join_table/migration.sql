-- CreateTable
CREATE TABLE "employments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeType" "EmployeeType",
    "workDaysRange" "WorkDaysRange",
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employments_employeeId_idx" ON "employments"("employeeId");

-- CreateIndex
CREATE INDEX "employments_companyId_idx" ON "employments"("companyId");

-- CreateIndex
CREATE INDEX "employments_isActive_idx" ON "employments"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "employments_employeeId_companyId_key" ON "employments"("employeeId", "companyId");

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy existing employee→company relationships from the legacy companyId column
INSERT INTO "employments" ("id","employeeId","companyId","employeeType","workDaysRange","startDate","isActive","createdAt","updatedAt")
SELECT gen_random_uuid()::text, c."id", c."companyId", c."employeeType", c."workDaysRange", NOW(), true, NOW(), NOW()
FROM "clients" c
WHERE c."companyId" IS NOT NULL
ON CONFLICT ("employeeId","companyId") DO NOTHING;
