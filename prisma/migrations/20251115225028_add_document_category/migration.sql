-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('GENERAL', 'ARL', 'EPS', 'AFP', 'OTROS');

-- AlterTable
ALTER TABLE "client_documents" ADD COLUMN     "category" "DocumentCategory" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "client_documents_clientId_category_idx" ON "client_documents"("clientId", "category");
