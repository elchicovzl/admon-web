-- Client.clientType (single ClientType) -> Client.clientTypes (ClientType[])
-- Preserves existing data: each client keeps its current type as a 1-element array.

-- 1. Add the new array column, nullable for now so the backfill can run.
ALTER TABLE "clients" ADD COLUMN "clientTypes" "ClientType"[];

-- 2. Backfill: every existing client gets a 1-element array with its current type.
UPDATE "clients" SET "clientTypes" = ARRAY["clientType"]::"ClientType"[];

-- 3. Every row now has an explicit non-empty array; enforce NOT NULL going forward.
ALTER TABLE "clients" ALTER COLUMN "clientTypes" SET NOT NULL;

-- 4. Drop the old scalar column.
ALTER TABLE "clients" DROP COLUMN "clientType";
