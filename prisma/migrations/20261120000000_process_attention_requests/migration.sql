-- CreateTable
CREATE TABLE "process_attention_requests" (
    "id" TEXT NOT NULL,
    "subProcessId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "replyReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_attention_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_attention_requests_recipientId_readAt_createdAt_idx" ON "process_attention_requests"("recipientId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "process_attention_requests_senderId_repliedAt_idx" ON "process_attention_requests"("senderId", "repliedAt" DESC);

-- CreateIndex
CREATE INDEX "process_attention_requests_subProcessId_createdAt_idx" ON "process_attention_requests"("subProcessId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "process_attention_requests" ADD CONSTRAINT "process_attention_requests_subProcessId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "affiliation_subprocesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_attention_requests" ADD CONSTRAINT "process_attention_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_attention_requests" ADD CONSTRAINT "process_attention_requests_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security (hand-appended; every new public table enables RLS, see schema-rls.test.ts)
ALTER TABLE public.process_attention_requests ENABLE ROW LEVEL SECURITY;
