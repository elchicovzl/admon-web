-- AI cost and abuse limits editable from the dashboard. Additive: nullable columns and an empty
-- array default, so existing rows keep today's behaviour (env values, no global cap).
ALTER TABLE "whatsapp_settings"
  ADD COLUMN "dailyBudgetUsd" DECIMAL(10,2),
  ADD COLUMN "maxTurnsPerDay" INTEGER,
  ADD COLUMN "maxConsecutiveFailures" INTEGER,
  ADD COLUMN "forbiddenTopics" TEXT[] DEFAULT ARRAY[]::TEXT[];
