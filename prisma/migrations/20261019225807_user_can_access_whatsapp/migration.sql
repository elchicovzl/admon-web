-- AlterTable
-- Per-user access to the WhatsApp module (same pattern as canAccessControl).
-- RLS: "users" already has its policy state; ADD COLUMN does not change it.
ALTER TABLE "users" ADD COLUMN     "canAccessWhatsApp" BOOLEAN NOT NULL DEFAULT false;
