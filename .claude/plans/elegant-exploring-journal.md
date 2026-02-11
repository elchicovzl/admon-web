# Plan: Eliminar columna PENDING_SUPPORT del Kanban de Afiliaciones

## Context

El kanban de afiliaciones está mostrando una columna "Pendiente Soporte" (PENDING_SUPPORT) que no debería aparecer. Aunque el filtro del servidor excluye correctamente los sub-procesos con este estado, el cliente está renderizando una columna para CADA estado del enum `AffiliationSubProcessStatus`, incluyendo PENDING_SUPPORT.

**Problema identificado:**
- [kanban-client.tsx:178](app/dashboard/affiliations/kanban/kanban-client.tsx#L178) usa `Object.values(AffiliationSubProcessStatus)` que incluye PENDING_SUPPORT
- El enum en schema.prisma todavía contiene PENDING_SUPPORT como valor válido
- El filtro del servidor funciona correctamente, pero el cliente renderiza la columna vacía

**Evidencia visual:**
El usuario compartió una captura mostrando la columna "Pendiente Soporte" con 0 items en el kanban.

## Recommended Approach

Fix rápido que no requiere cambios en la base de datos ni migraciones.

### Changes Required

#### 1. Modificar Array de Columnas Visibles
**File:** [app/dashboard/affiliations/kanban/kanban-client.tsx:178](app/dashboard/affiliations/kanban/kanban-client.tsx#L178)

**Cambio:**
```typescript
// ANTES (línea 178):
const statuses = Object.values(AffiliationSubProcessStatus)

// DESPUÉS:
const statuses: AffiliationSubProcessStatus[] = [
  AffiliationSubProcessStatus.NOT_STARTED,
  AffiliationSubProcessStatus.IN_PROGRESS,
  AffiliationSubProcessStatus.IN_REVIEW,
  AffiliationSubProcessStatus.COMPLETED,
  AffiliationSubProcessStatus.RETURNED,
  // PENDING_SUPPORT is intentionally excluded from kanban view
]
```

**Razón:**
- Define explícitamente las 5 columnas que deben mostrarse en el kanban
- Excluye PENDING_SUPPORT sin afectar el enum o la base de datos
- Mantiene el tipado fuerte de TypeScript
- Incluye comentario explicativo para futuros desarrolladores

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `app/dashboard/affiliations/kanban/kanban-client.tsx` | 178 | Reemplazar `Object.values()` con array explícito de 5 estados |

### Verification Steps

1. **Reload página del kanban** - Verificar que solo aparezcan 5 columnas:
   - Sin Iniciar
   - En Proceso
   - En Revisión
   - Terminado
   - Devuelto

2. **Verificar que NO aparezca** la columna "Pendiente Soporte"

3. **Probar drag & drop** - Verificar que las tarjetas se puedan arrastrar entre las 5 columnas visibles

4. **Verificar filtros** - Confirmar que los filtros (búsqueda, tipo, manager) sigan funcionando

### Why This Approach?

**Pros:**
- ✅ Fix inmediato sin tocar base de datos
- ✅ Sin riesgo de pérdida de datos
- ✅ No requiere migración de Prisma
- ✅ Mantiene PENDING_SUPPORT disponible para otros usos (si es necesario)
- ✅ El filtro del servidor ya excluye estos registros

**Cons:**
- ⚠️ El enum PENDING_SUPPORT sigue existiendo en el sistema (pero no afecta el kanban)

### Alternative Considered (Not Implemented)

**Solución completa** - Eliminar PENDING_SUPPORT del schema:
- Requiere migrar datos existentes con el script `migrate-pending-support.ts`
- Requiere modificar `schema.prisma` línea 424
- Requiere generar migración de Prisma con `pnpm db:migrate`
- Requiere actualizar tipos en múltiples archivos
- Mayor riesgo y tiempo de implementación

Esta opción se puede implementar en el futuro si se decide eliminar PENDING_SUPPORT completamente del sistema.

## Expected Outcome

Después de este cambio, el kanban mostrará exactamente 5 columnas y la columna "Pendiente Soporte" desaparecerá completamente de la vista.
