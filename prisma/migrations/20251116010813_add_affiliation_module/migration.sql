-- CreateEnum
CREATE TYPE "AffiliationSubProcessType" AS ENUM ('ARL', 'EPS', 'AFP', 'CCF');

-- CreateEnum
CREATE TYPE "AffiliationSubProcessStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_SUPPORT', 'IN_REVIEW', 'COMPLETED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AffiliationDocumentCategory" AS ENUM ('ARL_DOCS', 'EPS_DOCS', 'AFP_DOCS', 'CCF_DOCS', 'GENERAL');

-- CreateTable
CREATE TABLE "affiliations" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation_subprocesses" (
    "id" TEXT NOT NULL,
    "affiliationId" TEXT NOT NULL,
    "type" "AffiliationSubProcessType" NOT NULL,
    "status" "AffiliationSubProcessStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assignedToId" TEXT,
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliation_subprocesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation_documents" (
    "id" TEXT NOT NULL,
    "subProcessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "category" "AffiliationDocumentCategory" NOT NULL DEFAULT 'GENERAL',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation_observations" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "subProcessId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliation_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliation_status_logs" (
    "id" TEXT NOT NULL,
    "subProcessId" TEXT NOT NULL,
    "fromStatus" "AffiliationSubProcessStatus",
    "toStatus" "AffiliationSubProcessStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliation_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliations_clientId_idx" ON "affiliations"("clientId");

-- CreateIndex
CREATE INDEX "affiliations_createdById_idx" ON "affiliations"("createdById");

-- CreateIndex
CREATE INDEX "affiliation_subprocesses_affiliationId_idx" ON "affiliation_subprocesses"("affiliationId");

-- CreateIndex
CREATE INDEX "affiliation_subprocesses_assignedToId_idx" ON "affiliation_subprocesses"("assignedToId");

-- CreateIndex
CREATE INDEX "affiliation_subprocesses_status_idx" ON "affiliation_subprocesses"("status");

-- CreateIndex
CREATE INDEX "affiliation_subprocesses_type_idx" ON "affiliation_subprocesses"("type");

-- CreateIndex
CREATE INDEX "affiliation_documents_subProcessId_idx" ON "affiliation_documents"("subProcessId");

-- CreateIndex
CREATE INDEX "affiliation_documents_category_idx" ON "affiliation_documents"("category");

-- CreateIndex
CREATE INDEX "affiliation_observations_subProcessId_idx" ON "affiliation_observations"("subProcessId");

-- CreateIndex
CREATE INDEX "affiliation_status_logs_subProcessId_idx" ON "affiliation_status_logs"("subProcessId");

-- CreateIndex
CREATE INDEX "affiliation_status_logs_createdAt_idx" ON "affiliation_status_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_subprocesses" ADD CONSTRAINT "affiliation_subprocesses_affiliationId_fkey" FOREIGN KEY ("affiliationId") REFERENCES "affiliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_subprocesses" ADD CONSTRAINT "affiliation_subprocesses_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_documents" ADD CONSTRAINT "affiliation_documents_subProcessId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "affiliation_subprocesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_documents" ADD CONSTRAINT "affiliation_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_observations" ADD CONSTRAINT "affiliation_observations_subProcessId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "affiliation_subprocesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_observations" ADD CONSTRAINT "affiliation_observations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_status_logs" ADD CONSTRAINT "affiliation_status_logs_subProcessId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "affiliation_subprocesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_status_logs" ADD CONSTRAINT "affiliation_status_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
