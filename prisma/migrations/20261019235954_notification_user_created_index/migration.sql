-- CreateIndex
-- Index only: serves the notification list (ORDER BY createdAt DESC per user). The generated
-- servicios_alegra FK drift was removed on purpose (see PR1.1 notes).
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);
