-- Affiliation.affiliatedAs: the role (ClientType) the client is being
-- affiliated as for THIS specific affiliation, chosen by the user in the
-- wizard. Backfilled from the client's current type so existing affiliations
-- keep behaving exactly as before the multi-type migration.

-- 1. Add the column nullable so the backfill can run.
ALTER TABLE "affiliations" ADD COLUMN "affiliatedAs" "ClientType";

-- 2. Backfill: every client currently has exactly one type (T1 migration
-- guarantees clientTypes is a non-empty array with a single element for all
-- pre-existing clients), so use that type as the affiliation's role.
UPDATE "affiliations" a
SET "affiliatedAs" = c."clientTypes"[1]
FROM "clients" c
WHERE a."clientId" = c.id;

-- 3. Every row now has an explicit value; enforce NOT NULL going forward.
ALTER TABLE "affiliations" ALTER COLUMN "affiliatedAs" SET NOT NULL;
