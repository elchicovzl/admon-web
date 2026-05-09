-- AlterTable: Add paidToUser flag for INCAPACIDADES sub-processes
ALTER TABLE "affiliation_subprocesses"
  ADD COLUMN "paidToUser" BOOLEAN NOT NULL DEFAULT false;
