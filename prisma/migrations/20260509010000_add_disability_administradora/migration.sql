-- AlterTable: track which administradora handles each disability subprocess
ALTER TABLE "affiliation_subprocesses"
  ADD COLUMN "disabilityAdministradoraId" TEXT,
  ADD COLUMN "disabilityAdministradoraType" "AdministradoraType";

-- AddForeignKey
ALTER TABLE "affiliation_subprocesses"
  ADD CONSTRAINT "affiliation_subprocesses_disabilityAdministradoraId_fkey"
  FOREIGN KEY ("disabilityAdministradoraId") REFERENCES "administradoras"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for FK lookups
CREATE INDEX "affiliation_subprocesses_disabilityAdministradoraId_idx"
  ON "affiliation_subprocesses"("disabilityAdministradoraId");
