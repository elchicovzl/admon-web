-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ESCALATION', 'NEW_LEAD', 'NEW_ACTIVITY_ON_ESCALATED', 'AI_FAILURE', 'DRAFT_PENDING_REVIEW');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "conversationId" TEXT,
    "entityId" TEXT,
    "dedupKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_createdAt_idx" ON "notifications"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_conversationId_idx" ON "notifications"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupKey_key" ON "notifications"("userId", "dedupKey");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security (hand-appended; every new public table enables RLS, see schema-rls.test.ts)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
