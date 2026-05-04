-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('TIEMPO_COMPLETO', 'TIEMPO_PARCIAL', 'INDEPENDIENTE_CONTRATISTA');

-- CreateEnum
CREATE TYPE "WorkDaysRange" AS ENUM ('DIAS_1_7', 'DIAS_8_14', 'DIAS_15_21', 'DIAS_22_30');

-- CreateEnum
CREATE TYPE "AdministradoraType" AS ENUM ('EPS', 'AFP', 'ARL', 'CCF');

-- CreateEnum
CREATE TYPE "AffiliationStatus" AS ENUM ('ACTIVE', 'SENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AffiliationProcessType" AS ENUM ('DEPENDIENTE', 'INDEPENDIENTE', 'TRABAJADOR_TIEMPO_PARCIAL', 'INDEPENDIENTE_VOLUNTARIO', 'CONTRATISTA_INDEPENDIENTE', 'BENEFICIARIO_UPC_ADICIONAL', 'COTIZANTE_INDEPENDIENTE_SALUD', 'COTIZANTE_PENSIONES_PAGO_TERCERO', 'PLANILLA_S_SERVICIO_DOMESTICO', 'PLANILLA_E_EMPLEADOS', 'LIQUIDACIONES', 'TRASLADO_EPS', 'COBRO_INCAPACIDADES', 'PENSIONADO', 'INCLUSION_BENEFICIARIOS', 'EXCLUSION_BENEFICIARIOS', 'ASESORIAS_PENSIONES', 'OTRO');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AffiliationDocumentCategory" ADD VALUE 'PILA_DOCS';
ALTER TYPE "AffiliationDocumentCategory" ADD VALUE 'TRASLADOS_DOCS';
ALTER TYPE "AffiliationDocumentCategory" ADD VALUE 'INCAPACIDADES_DOCS';
ALTER TYPE "AffiliationDocumentCategory" ADD VALUE 'CONCILIACION_MORA_DOCS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AffiliationSubProcessType" ADD VALUE 'PILA';
ALTER TYPE "AffiliationSubProcessType" ADD VALUE 'TRASLADOS';
ALTER TYPE "AffiliationSubProcessType" ADD VALUE 'INCAPACIDADES';
ALTER TYPE "AffiliationSubProcessType" ADD VALUE 'CONCILIACION_MORA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IdentificationType" ADD VALUE 'TARJETA_IDENTIDAD';
ALTER TYPE "IdentificationType" ADD VALUE 'REGISTRO_CIVIL';
ALTER TYPE "IdentificationType" ADD VALUE 'PASAPORTE';
ALTER TYPE "IdentificationType" ADD VALUE 'PEP';
ALTER TYPE "IdentificationType" ADD VALUE 'NUIP';
ALTER TYPE "IdentificationType" ADD VALUE 'SALVOCONDUCTO';

-- AlterTable
ALTER TABLE "affiliation_subprocesses" ADD COLUMN     "bankRegistry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "disabilityEndDate" TIMESTAMP(3),
ADD COLUMN     "disabilityStartDate" TIMESTAMP(3),
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "transcription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "affiliations" ADD COLUMN     "affiliationNumber" TEXT NOT NULL,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "processType" "AffiliationProcessType",
ADD COLUMN     "processTypeOther" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sentById" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "AffiliationStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "client_additional_info" DROP COLUMN "novedadesIngreso",
ADD COLUMN     "fechaIngreso" TIMESTAMP(3),
ADD COLUMN     "fechaRetiro" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "client_beneficiaries" ADD COLUMN     "excludedAt" TIMESTAMP(3),
ADD COLUMN     "isExcluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "afpId" TEXT,
ADD COLUMN     "arlId" TEXT,
ADD COLUMN     "arlRiskLevel" INTEGER,
ADD COLUMN     "ccfId" TEXT,
ADD COLUMN     "employeeType" "EmployeeType",
ADD COLUMN     "epsId" TEXT,
ADD COLUMN     "workDaysRange" "WorkDaysRange";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "affiliation_subprocess_beneficiaries" (
    "id" TEXT NOT NULL,
    "subProcessId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliation_subprocess_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administradoras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "AdministradoraType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "administradoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sent_emails" (
    "id" TEXT NOT NULL,
    "affiliationId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "ccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "attachments" TEXT,
    "emailNotes" TEXT,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "featuredImageUrl" TEXT,
    "featuredImageS3Key" TEXT,
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT,
    "ogImageUrl" TEXT,
    "ogImageS3Key" TEXT,
    "readingTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BlogPostToBlogTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BlogPostToBlogTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "affiliation_subprocess_beneficiaries_subProcessId_idx" ON "affiliation_subprocess_beneficiaries"("subProcessId");

-- CreateIndex
CREATE INDEX "affiliation_subprocess_beneficiaries_beneficiaryId_idx" ON "affiliation_subprocess_beneficiaries"("beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliation_subprocess_beneficiaries_subProcessId_beneficia_key" ON "affiliation_subprocess_beneficiaries"("subProcessId", "beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "administradoras_code_type_key" ON "administradoras"("code", "type");

-- CreateIndex
CREATE INDEX "sent_emails_affiliationId_idx" ON "sent_emails"("affiliationId");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_publishedAt_idx" ON "blog_posts"("publishedAt");

-- CreateIndex
CREATE INDEX "blog_posts_authorId_idx" ON "blog_posts"("authorId");

-- CreateIndex
CREATE INDEX "_BlogPostToBlogTag_B_index" ON "_BlogPostToBlogTag"("B");

-- CreateIndex
CREATE INDEX "affiliation_subprocesses_employeeId_idx" ON "affiliation_subprocesses"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliations_affiliationNumber_key" ON "affiliations"("affiliationNumber");

-- CreateIndex
CREATE INDEX "affiliations_status_idx" ON "affiliations"("status");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_epsId_fkey" FOREIGN KEY ("epsId") REFERENCES "administradoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_afpId_fkey" FOREIGN KEY ("afpId") REFERENCES "administradoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_arlId_fkey" FOREIGN KEY ("arlId") REFERENCES "administradoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_ccfId_fkey" FOREIGN KEY ("ccfId") REFERENCES "administradoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_subprocess_beneficiaries" ADD CONSTRAINT "affiliation_subprocess_beneficiaries_subProcessId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "affiliation_subprocesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_subprocess_beneficiaries" ADD CONSTRAINT "affiliation_subprocess_beneficiaries_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "client_beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliation_subprocesses" ADD CONSTRAINT "affiliation_subprocesses_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_affiliationId_fkey" FOREIGN KEY ("affiliationId") REFERENCES "affiliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_A_fkey" FOREIGN KEY ("A") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlogPostToBlogTag" ADD CONSTRAINT "_BlogPostToBlogTag_B_fkey" FOREIGN KEY ("B") REFERENCES "blog_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

