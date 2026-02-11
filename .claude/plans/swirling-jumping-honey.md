# Plan: Eliminar Estado "Pendiente de Soporte" del Kanban

## Contexto

El usuario quiere mejorar el kanban de affiliations eliminando el estado **"Pendiente de Soporte" (PENDING_SUPPORT)** ya que no es necesario en el flujo de trabajo actual.

Actualmente el kanban tiene 6 estados:
1. NOT_STARTED (Sin Iniciar)
2. IN_PROGRESS (En Proceso)
3. **PENDING_SUPPORT (Pendiente de Soporte)** ← A eliminar
4. IN_REVIEW (En Revisión)
5. COMPLETED (Terminado)
6. RETURNED (Devuelto)

Después de eliminar PENDING_SUPPORT, quedarán 5 columnas en el kanban.

Los sub-procesos que actualmente tengan estado PENDING_SUPPORT serán migrados a **NOT_STARTED** según indicación del usuario.

---

## Estrategia de Implementación

### 1. Migración de Datos (Base de Datos)

**Objetivo**: Migrar todos los sub-procesos con estado PENDING_SUPPORT a NOT_STARTED antes de modificar el schema.

**Acción**:
- Crear una migración de datos SQL que actualice todos los registros existentes
- Query: `UPDATE "AffiliationSubProcess" SET status = 'NOT_STARTED' WHERE status = 'PENDING_SUPPORT'`
- También actualizar los logs de estado: `UPDATE "AffiliationStatusLog" SET "fromStatus" = 'NOT_STARTED' WHERE "fromStatus" = 'PENDING_SUPPORT'` y similar para `toStatus`

### 2. Modificación del Schema de Prisma

**Archivo**: `prisma/schema.prisma`

**Líneas 413-420**: Eliminar `PENDING_SUPPORT` del enum

```prisma
enum AffiliationSubProcessStatus {
  NOT_STARTED      // Sin iniciar
  IN_PROGRESS      // En proceso
  IN_REVIEW        // En revisión
  COMPLETED        // Terminado
  RETURNED         // Devuelto/Rechazado
}
```

**Después de modificar**:
- Generar migración: `pnpm prisma migrate dev --name remove_pending_support_status`
- Esto creará automáticamente la migración SQL que elimina el valor del enum

### 3. Actualización de Tipos TypeScript

**Archivo**: `lib/types/affiliation.types.ts`

**Cambios**:

1. **Líneas 299-306**: Eliminar `PENDING_SUPPORT` de `SubProcessStatusLabels`
   ```typescript
   export const SubProcessStatusLabels: Record<AffiliationSubProcessStatus, string> = {
     NOT_STARTED: 'Sin Iniciar',
     IN_PROGRESS: 'En Proceso',
     // PENDING_SUPPORT: 'Pendiente de Soporte', ← ELIMINAR
     IN_REVIEW: 'En Revisión',
     COMPLETED: 'Terminado',
     RETURNED: 'Devuelto',
   }
   ```

2. **Líneas 334-338**: Eliminar colores de `SubProcessStatusColors`
   ```typescript
   export const SubProcessStatusColors: Record<...> = {
     // ...
     // PENDING_SUPPORT: {
     //   bg: 'bg-yellow-100',
     //   text: 'text-yellow-700',
     //   border: 'border-yellow-300',
     // }, ← ELIMINAR
     // ...
   }
   ```

3. **Líneas ~65-72**: Eliminar `pendingSupport` del interface `MyAssignmentsStats`
   ```typescript
   export interface MyAssignmentsStats {
     total: number
     notStarted: number
     inProgress: number
     // pendingSupport: number  ← ELIMINAR
     inReview: number
     completed: number
     returned: number
   }
   ```

### 4. Actualización de Server Actions

**Archivo**: `lib/actions/affiliation.actions.ts`

**Función afectada**: `getMyAssignmentsStats` (líneas 917-998)

**Cambios**:

1. **Línea 928**: Eliminar variable `pendingSupport` del destructuring
   ```typescript
   const [
     total,
     notStarted,
     inProgress,
     // pendingSupport, ← ELIMINAR
     inReview,
     completed,
     returned,
   ] = await Promise.all([
   ```

2. **Eliminar la query de conteo** (aprox. líneas 950-956):
   ```typescript
   // prisma.affiliationSubProcess.count({
   //   where: {
   //     assignedToId: authCheck.userId,
   //     affiliation: { isActive: true },
   //     status: AffiliationSubProcessStatus.PENDING_SUPPORT,
   //   },
   // }), ← ELIMINAR TODO ESTE BLOQUE
   ```

3. **Línea ~985**: Eliminar del objeto de retorno
   ```typescript
   return {
     success: true,
     data: {
       total,
       notStarted,
       inProgress,
       // pendingSupport, ← ELIMINAR
       inReview,
       completed,
       returned,
     },
   }
   ```

### 5. Verificación de Otros Archivos

**Archivos que NO requieren cambios** (se ajustarán automáticamente):
- `app/dashboard/affiliations/kanban/kanban-client.tsx` - Itera sobre todos los valores del enum, se ajustará solo
- `components/dashboard/affiliations/kanban-column.tsx` - Usa tipos genéricos, no requiere cambios
- `components/dashboard/affiliations/subprocess-kanban-card.tsx` - Usa tipos del schema, se ajustará solo
- `components/dashboard/affiliations/kanban-filters.tsx` - No tiene lógica específica de PENDING_SUPPORT
- `components/dashboard/affiliations/status-badge.tsx` - Usa Record types, se ajustará solo

---

## Archivos Críticos a Modificar

| Archivo | Líneas/Secciones | Acción |
|---------|------------------|--------|
| `prisma/schema.prisma` | 413-420 | Eliminar `PENDING_SUPPORT` del enum |
| `lib/types/affiliation.types.ts` | 299-306, 334-338, ~65-72 | Eliminar de labels, colores y stats interface |
| `lib/actions/affiliation.actions.ts` | 917-998 | Eliminar de `getMyAssignmentsStats` |

---

## Pasos de Ejecución

1. **Crear migración manual de datos**
   - Crear archivo de migración SQL personalizado que migre PENDING_SUPPORT → NOT_STARTED
   - Ejecutar antes de modificar el schema

2. **Modificar schema de Prisma**
   - Eliminar PENDING_SUPPORT del enum `AffiliationSubProcessStatus`

3. **Generar migración automática**
   - `pnpm prisma migrate dev --name remove_pending_support_status`
   - Prisma detectará el cambio en el enum y generará la migración

4. **Actualizar tipos TypeScript**
   - Eliminar de `SubProcessStatusLabels`
   - Eliminar de `SubProcessStatusColors`
   - Eliminar de `MyAssignmentsStats`

5. **Actualizar server actions**
   - Modificar `getMyAssignmentsStats` para eliminar conteo de pendingSupport

6. **Verificar compilación**
   - TypeScript debe compilar sin errores
   - No debe haber referencias huérfanas a PENDING_SUPPORT

---

## Verificación Post-Implementación

### 1. Verificación de Base de Datos
```bash
# Abrir Prisma Studio
pnpm db:studio

# Verificar que no existan sub-procesos con PENDING_SUPPORT
# Query: SELECT * FROM "AffiliationSubProcess" WHERE status = 'PENDING_SUPPORT'
# Resultado esperado: 0 registros
```

### 2. Verificación de UI (Kanban)
```bash
# Iniciar servidor
pnpm dev

# Navegar a:
http://localhost:3000/dashboard/affiliations/kanban

# Verificar:
✓ Solo se muestran 5 columnas (sin columna amarilla de "Pendiente de Soporte")
✓ Los sub-procesos se distribuyen correctamente en las columnas restantes
✓ Drag & drop funciona correctamente entre columnas
✓ Los filtros funcionan correctamente
```

### 3. Verificación de Estadísticas
```bash
# Navegar a:
http://localhost:3000/dashboard/affiliations/my-assignments

# Verificar:
✓ Las estadísticas muestran 5 estados (sin pendingSupport)
✓ Los contadores son correctos
✓ No hay errores en consola
```

### 4. Verificación de TypeScript
```bash
# Compilar
pnpm build

# Verificar:
✓ No hay errores de tipo relacionados con PENDING_SUPPORT
✓ Build completo exitoso
```

### 5. Prueba Funcional Completa
1. Crear una nueva afiliación
2. Verificar que los sub-procesos se inicialicen en NOT_STARTED
3. Mover sub-procesos entre columnas del kanban
4. Verificar que los cambios de estado se guarden correctamente
5. Verificar logs de auditoría (AffiliationStatusLog) no referencien PENDING_SUPPORT

---

## Riesgos y Consideraciones

### ✅ Mitigados
- **Datos huérfanos**: Se migran todos los registros PENDING_SUPPORT a NOT_STARTED antes de modificar el schema
- **Breaking changes**: TypeScript detectará cualquier referencia huérfana en tiempo de compilación
- **Logs históricos**: Los logs de auditoría mantienen integridad al migrar también fromStatus/toStatus

### ⚠️ A considerar
- **Historial de cambios**: Los logs históricos mostrarán "Sin Iniciar" en lugar de "Pendiente de Soporte" para registros antiguos
  - Esto es aceptable ya que la información histórica se mantiene, solo cambia la etiqueta
- **Usuarios acostumbrados**: El equipo debe ser notificado que el estado ya no existe
  - Comunicar que los procesos que antes iban a "Pendiente de Soporte" ahora van directamente a otros estados

---

## Resumen

**Cambios totales**: 3 archivos
- ✏️ `prisma/schema.prisma` - Eliminar del enum
- ✏️ `lib/types/affiliation.types.ts` - Eliminar labels, colores y de stats
- ✏️ `lib/actions/affiliation.actions.ts` - Eliminar de estadísticas

**Migración**: SQL automática generada por Prisma + migración manual de datos

**Resultado**: Kanban con 5 columnas en lugar de 6, sin estado "Pendiente de Soporte"
