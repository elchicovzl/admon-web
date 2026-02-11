-- Migración de datos: PENDING_SUPPORT -> NOT_STARTED
-- Este script debe ejecutarse ANTES de aplicar el cambio de schema

-- 1. Migrar sub-procesos de PENDING_SUPPORT a NOT_STARTED
UPDATE "AffiliationSubProcess"
SET status = 'NOT_STARTED'
WHERE status = 'PENDING_SUPPORT';

-- 2. Migrar logs de estado (fromStatus)
UPDATE "AffiliationStatusLog"
SET "fromStatus" = 'NOT_STARTED'
WHERE "fromStatus" = 'PENDING_SUPPORT';

-- 3. Migrar logs de estado (toStatus)
UPDATE "AffiliationStatusLog"
SET "toStatus" = 'NOT_STARTED'
WHERE "toStatus" = 'PENDING_SUPPORT';

-- Verificar que no queden registros con PENDING_SUPPORT
SELECT COUNT(*) as "SubProcesses con PENDING_SUPPORT"
FROM "AffiliationSubProcess"
WHERE status = 'PENDING_SUPPORT';

SELECT COUNT(*) as "Logs con PENDING_SUPPORT en fromStatus"
FROM "AffiliationStatusLog"
WHERE "fromStatus" = 'PENDING_SUPPORT';

SELECT COUNT(*) as "Logs con PENDING_SUPPORT en toStatus"
FROM "AffiliationStatusLog"
WHERE "toStatus" = 'PENDING_SUPPORT';
