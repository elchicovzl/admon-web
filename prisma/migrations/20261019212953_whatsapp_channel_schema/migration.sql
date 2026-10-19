-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('AI', 'HUMAN', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('CLIENT', 'AI', 'DASHBOARD', 'PHONE_APP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'DOCUMENT', 'VIDEO', 'STICKER', 'LOCATION', 'CONTACTS', 'INTERACTIVE', 'REACTION', 'TEMPLATE', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('RECEIVED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookItemKind" AS ENUM ('MESSAGE', 'STATUS', 'ECHO', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'STORED', 'FAILED', 'TOO_LARGE', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ContactMatchStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'AMBIGUOUS', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "ConversationActor" AS ENUM ('USER', 'AI', 'SYSTEM', 'PHONE_APP', 'CLIENT');

-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('CHAT_TURN', 'TRANSCRIPTION');

-- CreateEnum
CREATE TYPE "AiTurnOutcome" AS ENUM ('REPLIED', 'ESCALATED', 'DISCARDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "profileName" TEXT,
    "clientId" TEXT,
    "matchStatus" "ContactMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL DEFAULT 'WHATSAPP',
    "phoneE164" TEXT NOT NULL,
    "displayName" TEXT,
    "conversationId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "fullName" TEXT,
    "identificationType" "IdentificationType",
    "identificationNumber" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "convertedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "aiPaused" BOOLEAN NOT NULL DEFAULT false,
    "aiPausedById" TEXT,
    "aiPausedAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastAiSentAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "aiCursorAt" TIMESTAMP(3),
    "consecutiveAiFailures" INTEGER NOT NULL DEFAULT 0,
    "takenOverById" TEXT,
    "takenOverAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationReason" TEXT,
    "escalatedOutOfHours" BOOLEAN NOT NULL DEFAULT false,
    "attentionDueAt" TIMESTAMP(3),
    "consentNoticeMessageId" TEXT,
    "consentNoticeSentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "purgePendingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "wamid" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "source" "MessageSource" NOT NULL,
    "type" "MessageType" NOT NULL,
    "text" TEXT,
    "templateName" TEXT,
    "templateParams" JSONB,
    "status" "MessageStatus" NOT NULL,
    "statusRank" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "contextWamid" TEXT,
    "sentById" TEXT,
    "sourceChunkIds" TEXT[],
    "usageRecordId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_status_events" (
    "id" TEXT NOT NULL,
    "wamid" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "errorCode" TEXT,
    "errorTitle" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_media" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "metaMediaId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "fileName" TEXT,
    "s3Key" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "transcript" TEXT,
    "transcriptStatus" "TranscriptStatus",
    "durationSec" DOUBLE PRECISION,
    "r2DeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "kind" "WebhookItemKind" NOT NULL,
    "wamid" TEXT,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_events" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromStatus" "ConversationStatus",
    "toStatus" "ConversationStatus" NOT NULL,
    "event" TEXT NOT NULL,
    "actor" "ConversationActor" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_records" (
    "id" TEXT NOT NULL,
    "kind" "AiUsageKind" NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "outcome" "AiTurnOutcome",
    "model" TEXT NOT NULL,
    "promptVersion" TEXT,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" DOUBLE PRECISION,
    "toolCalls" JSONB,
    "retrievalScores" JSONB,
    "retrievedChunkIds" TEXT[],
    "topSimilarity" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "estimatedCostUsd" DECIMAL(10,6),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_waId_key" ON "whatsapp_contacts"("waId");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_clientId_idx" ON "whatsapp_contacts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_contactId_key" ON "leads"("contactId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_convertedClientId_idx" ON "leads"("convertedClientId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_contactId_key" ON "conversations"("contactId");

-- CreateIndex
CREATE INDEX "conversations_status_attentionDueAt_idx" ON "conversations"("status", "attentionDueAt");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "conversations_updatedAt_idx" ON "conversations"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_wamid_key" ON "whatsapp_messages"("wamid");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversationId_timestamp_idx" ON "whatsapp_messages"("conversationId", "timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_messages_conversationId_updatedAt_idx" ON "whatsapp_messages"("conversationId", "updatedAt");

-- CreateIndex
CREATE INDEX "whatsapp_messages_sentById_idx" ON "whatsapp_messages"("sentById");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_status_events_wamid_status_key" ON "whatsapp_status_events"("wamid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_media_messageId_key" ON "whatsapp_media"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_webhook_events_dedupKey_key" ON "whatsapp_webhook_events"("dedupKey");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_processedAt_receivedAt_idx" ON "whatsapp_webhook_events"("processedAt", "receivedAt");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_payloadHash_idx" ON "whatsapp_webhook_events"("payloadHash");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_receivedAt_idx" ON "whatsapp_webhook_events"("receivedAt");

-- CreateIndex
CREATE INDEX "conversation_events_conversationId_createdAt_idx" ON "conversation_events"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_events_actorUserId_idx" ON "conversation_events"("actorUserId");

-- CreateIndex
CREATE INDEX "ai_usage_records_createdAt_idx" ON "ai_usage_records"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_records_conversationId_idx" ON "ai_usage_records"("conversationId");


-- AddForeignKey
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_takenOverById_fkey" FOREIGN KEY ("takenOverById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (project convention, see 20260224000000_enable_rls_all_tables).
-- Prisma connects as a superuser and bypasses RLS; with no policies this denies
-- PostgREST (anon/authenticated) access to the WhatsApp tables.
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
