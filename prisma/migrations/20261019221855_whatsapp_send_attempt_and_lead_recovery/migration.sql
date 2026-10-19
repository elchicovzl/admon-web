-- AlterTable
ALTER TABLE "whatsapp_contacts" ADD COLUMN     "leadRecoveryAt" TIMESTAMP(3),
ADD COLUMN     "leadRecoveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "leadSuppressed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "sendAttemptedAt" TIMESTAMP(3);

-- RLS: both tables were created with row level security enabled in
-- 20261019212953_whatsapp_channel_schema; adding columns does not change that.
