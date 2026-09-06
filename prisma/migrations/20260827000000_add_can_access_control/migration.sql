-- Permiso de acceso al módulo Control (caja interna).
--
-- Es un flag ORTOGONAL al rol, no un valor nuevo en UserRole: `users.role` es
-- una columna única, así que un rol CONTROL le quitaría al usuario el acceso a
-- clientes, procesos e incapacidades. Con este flag un MANAGER lleva la caja
-- sin perder nada más.
--
-- Default false: nadie hereda el permiso. SUPER_ADMIN entra por rol, no por
-- este flag (ver lib/auth/rbac.ts).
ALTER TABLE "users"
  ADD COLUMN "canAccessControl" BOOLEAN NOT NULL DEFAULT false;
