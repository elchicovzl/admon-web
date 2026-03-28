# Proyecto: admon-website

## Stack
- Next.js 15 App Router + TypeScript
- PostgreSQL + Prisma (Supabase) — usar `prisma db push` en lugar de `migrate dev` (shadow DB falla con RLS)
- NextAuth v5, Zustand, React Hook Form + Zod, shadcn/ui, Tailwind
- Package manager: **pnpm**

## Arquitectura
- Dashboard en `/app/dashboard/*`
- Server Actions en `/lib/actions/*.actions.ts`
- Validaciones Zod en `/lib/validations/*.schema.ts`
- Tipos en `/lib/types/*.types.ts`
- Componentes en `/components/dashboard/`

## Patrones clave
- Formularios: React Hook Form + zodResolver. Evitar `.refine()` en schemas locales de wizards — rompe inferencia de tipos con `subProcesses`. Hacerlo manualmente en `onSubmit`.
- Combobox: patrón `Popover + Command` de shadcn (ver wizard de afiliaciones).
- Modal con navegación: al redirigir desde un modal, NO cerrar el modal manualmente — mostrar estado `navigating` y dejar que `router.push()` lo cierre naturalmente. Quitar `setDialogOpen(false)` del callback del padre.
- Selects Prisma: siempre incluir campos nuevos en todos los `select: {}` de las queries relevantes.

## Módulo de Afiliaciones
- Wizard 2 pasos: Step 1 (cliente + tipo proceso), Step 2 (sub-procesos)
- `AffiliationProcessType`: enum en Prisma con 16 valores + campo `processTypeOther` para "Otro"
- Labels en `AffiliationProcessTypeLabels` en `/lib/types/affiliation.types.ts`
- DB migration: `pnpm prisma db push` (no `pnpm db:migrate`)
