# Plan de Optimización Completa del Dashboard

## Contexto

El dashboard actual presenta una arquitectura mixta con oportunidades significativas de optimización siguiendo las mejores prácticas de Vercel/React:

**Problemas Identificados:**
1. **3 páginas usan Client Components con useEffect** (disabilities, users, clients) - Waterfall en primer render
2. **4 páginas Server Component sin Suspense** (dashboard, my-assignments, kanban, archived) - No progressive rendering
3. **Sin React.cache() en Server Actions** - Fetches duplicados en mismo render
4. **~80KB de código lazy-loadeable** cargado eagerly (FilePond, form dialogs)
5. **Barrel imports en lib/actions** - Afecta tree-shaking

**Página Modelo:** `/app/dashboard/affiliations/page.tsx` ya implementa el patrón ideal (Server Component + Suspense + skeletons).

**Impacto Esperado:**
- Bundle inicial: -80KB (-15%)
- TTFB: -200ms promedio (-50%)
- Perceived performance: +40% (progressive rendering)
- CLS: 0 (sin layout shift)

---

## Fase 1: Convertir Client Pages a Server Components (PRIORIDAD ALTA)

**Patrón a seguir:** Exactamente como `/app/dashboard/affiliations/page.tsx`

### 1.1 Disabilities Page

**Archivos a crear:**

1. **`/app/dashboard/disabilities/page.tsx`** (Server Component)
   - Async function `DisabilitiesStats()` - Renderiza stats cards
   - Async function `DisabilitiesTable()` - Renderiza tabla
   - Main export con 2 Suspense boundaries

2. **`/app/dashboard/disabilities/disabilities-client.tsx`** (Client logic)
   - Maneja estado de dialogs (create/edit)
   - Recibe `initialDisabilities` como prop
   - Renderiza tabla + dialogs

3. **`/components/dashboard/disabilities/disabilities-stats-skeleton.tsx`**
   - 4 cards skeleton (Total, En Proceso, Terminadas, Urgentes)

4. **`/components/dashboard/disabilities/disabilities-table-skeleton.tsx`** (verificar si existe)

**Patrón de implementación:**
```tsx
export default async function DisabilitiesPage() {
  return (
    <div className="space-y-6">
      <div>{/* Header - renders immediately */}</div>

      <Suspense fallback={<DisabilitiesStatsSkeleton />}>
        <DisabilitiesStats />
      </Suspense>

      <Suspense fallback={<DisabilitiesTableSkeleton />}>
        <DisabilitiesTable />
      </Suspense>
    </div>
  )
}

async function DisabilitiesStats() {
  const statsResult = await getDisabilitiesCount()
  // Render 4 stats cards
}

async function DisabilitiesTable() {
  const result = await getDisabilities()
  return <DisabilitiesClient initialDisabilities={result.data} />
}
```

### 1.2 Users Page

**Archivos a crear:**

1. **`/app/dashboard/users/page.tsx`** (Server Component)
   - Async `UsersStats()` - 3 cards (Total, Super Admins, Managers)
   - Async `UsersTable()`
   - 2 Suspense boundaries

2. **`/app/dashboard/users/users-client.tsx`**
   - Estado de CreateUserForm dialog
   - Recibe `initialUsers` prop

3. **`/components/dashboard/users/users-stats-skeleton.tsx`**
   - 3 cards skeleton

4. **`/components/dashboard/users-table-skeleton.tsx`** (verificar si existe)

### 1.3 Clients Page

**Archivos a crear:**

1. **`/app/dashboard/clients/page.tsx`** (Server Component)
   - Async `ClientsStats()` - 3 cards (Total, Activos, Inactivos)
   - Async `ClientsTable()`
   - 2 Suspense boundaries

2. **`/app/dashboard/clients/clients-client.tsx`**
   - Estado de ClientFormDialog (create/edit)
   - Recibe `initialClients` prop

3. **`/components/dashboard/clients/clients-stats-skeleton.tsx`**
   - 3 cards skeleton

4. **`/components/dashboard/clients/clients-table-skeleton.tsx`** (verificar si existe)

---

## Fase 2: Agregar Suspense a Server Components Existentes (PRIORIDAD MEDIA)

### 2.1 Dashboard Main Page

**Archivo:** `/app/dashboard/page.tsx`

**Cambios:**
- Separar `UserStats()` como async component
- Separar `MyAssignmentsWidget()` como async component
- Agregar 2 Suspense boundaries

**Skeletons a crear:**
1. `/components/dashboard/dashboard-stats-skeleton.tsx` (3 cards)
2. `/components/dashboard/my-assignments-widget-skeleton.tsx` (widget con 4 stats)

### 2.2 My Assignments Page

**Archivo:** `/app/dashboard/affiliations/my-assignments/page.tsx`

**Cambios:**
- Separar `AssignmentsStats()` como async component
- Separar `AssignmentsTable()` como async component
- Agregar 2 Suspense boundaries

**Skeletons a crear:**
1. `/components/dashboard/affiliations/my-assignments-stats-skeleton.tsx` (7 cards)
2. `/components/dashboard/affiliations/my-assignments-table-skeleton.tsx`

### 2.3 Kanban Page

**Archivo:** `/app/dashboard/affiliations/kanban/page.tsx`

**Cambios:**
- Separar `KanbanBoard()` como async component
- Agregar 1 Suspense boundary

**Skeleton a crear:**
1. `/components/dashboard/affiliations/kanban-board-skeleton.tsx` (5 columnas con 3 cards cada una)

### 2.4 Archived Page

**Archivo:** `/app/dashboard/affiliations/archived/page.tsx`

**Cambios:**
- Separar `ArchivedTable()` como async component
- Agregar 1 Suspense boundary

**Skeleton a crear:**
1. `/components/dashboard/affiliations/archived-affiliations-table-skeleton.tsx`

---

## Fase 3: Implementar React.cache() en Server Actions (PRIORIDAD ALTA)

**Objetivo:** Prevenir fetches duplicados en mismo render cycle

### 3.1 Affiliation Actions

**Archivo:** `/lib/actions/affiliation.actions.ts`

**Agregar:**
```typescript
import { cache } from 'react'
```

**Funciones a envolver con cache():**
- `getAffiliations`
- `getAffiliationStats`
- `getMyAssignments`
- `getMyAssignmentsStats`
- `getSubProcessesForKanban`
- `getArchivedAffiliations`
- `getAffiliationById`

**Patrón:**
```typescript
// Antes:
export async function getAffiliations() { ... }

// Después:
export const getAffiliations = cache(async () => { ... })
```

**NO envolver:** Mutations (create, update, delete, cualquier función con revalidatePath)

### 3.2 Disability Actions

**Archivo:** `/lib/actions/disability.actions.ts`

**Funciones a envolver:**
- `getDisabilities`
- `getDisabilitiesCount`
- `getDisabilityById`

### 3.3 Client Actions

**Archivo:** `/lib/actions/client.actions.ts`

**Funciones a envolver:**
- `getClients`
- `getClientsCount`
- `getClientById`
- `getAvailableEmployees`
- `getCompanyEmployees`

### 3.4 User Actions

**Archivo:** `/lib/actions/user.actions.ts`

**Funciones a envolver:**
- `getUsers`
- `getUsersCount`
- `getUserById`
- `getManagers`

### 3.5 Auth Actions

**Archivo:** `/lib/actions/auth.actions.ts`

**Función a envolver:**
- `getSession` únicamente

**NO envolver:** login, logout, register, changePassword

---

## Fase 4: Optimización de Bundle Size con Dynamic Imports (PRIORIDAD MEDIA)

### 4.1 ClientDocumentsGallery (50KB savings)

**Archivo:** `/app/dashboard/clients/[id]/page.tsx`

**Cambio:**
```typescript
// Antes:
import { ClientDocumentsGallery } from '@/components/dashboard/clients/client-documents-gallery'

// Después:
import dynamic from 'next/dynamic'

const ClientDocumentsGallery = dynamic(
  () => import('@/components/dashboard/clients/client-documents-gallery')
    .then(mod => ({ default: mod.ClientDocumentsGallery })),
  {
    loading: () => <ClientDocumentsGallerySkeleton />,
    ssr: false, // FilePond requires browser APIs
  }
)
```

**Skeleton a crear:**
- `/components/dashboard/clients/client-documents-gallery-skeleton.tsx`

### 4.2 Form Dialogs (~15KB savings)

**Aplicar dynamic import a:**

1. **DisabilityFormDialog** en `/app/dashboard/disabilities/disabilities-client.tsx`
2. **ClientFormDialog** en `/app/dashboard/clients/clients-client.tsx`
3. **CredentialFormDialog** en `/components/dashboard/clients/client-credentials-section.tsx`
4. **AffiliationCreateWizard** en `/app/dashboard/affiliations/affiliations-client.tsx`

**Patrón:**
```typescript
const FormDialog = dynamic(
  () => import('./path-to-dialog').then(mod => ({ default: mod.FormDialog })),
  { ssr: false }
)
```

### 4.3 SubProcessDetailModal (~12KB savings)

**Archivo:** `/app/dashboard/affiliations/[id]/affiliation-detail-client.tsx`

**Aplicar dynamic import**

### 4.4 Eliminar Barrel Imports

**Problema:** `/lib/actions/index.ts` crea un barrel que bundlea todas las actions juntas

**Solución:** Reemplazar imports de barrel con imports directos

**Buscar:**
```bash
grep -r "from '@/lib/actions'" app/dashboard --include="*.tsx"
```

**Reemplazar:**
```typescript
// Antes:
import { getClients, getClientsCount } from '@/lib/actions'

// Después:
import { getClients, getClientsCount } from '@/lib/actions/client.actions'
```

**Archivos afectados:**
- `/app/dashboard/page.tsx`
- `/app/dashboard/users/page.tsx`
- `/app/dashboard/clients/page.tsx`
- `/app/dashboard/disabilities/page.tsx`
- `/app/dashboard/clients/[id]/page.tsx`
- `/app/dashboard/affiliations/kanban/page.tsx`

---

## Archivos Críticos a Modificar

### Server Actions:
- [x] `lib/actions/affiliation.actions.ts` - Add React.cache (7 functions)
- [x] `lib/actions/disability.actions.ts` - Add React.cache (3 functions)
- [x] `lib/actions/client.actions.ts` - Add React.cache (5 functions)
- [x] `lib/actions/user.actions.ts` - Add React.cache (4 functions)
- [x] `lib/actions/auth.actions.ts` - Add React.cache (getSession)

### Pages a Refactorizar:
1. [x] `app/dashboard/disabilities/page.tsx` - MAJOR (Client → Server)
2. [x] `app/dashboard/users/page.tsx` - MAJOR (Client → Server)
3. [x] `app/dashboard/clients/page.tsx` - MAJOR (Client → Server)
4. [x] `app/dashboard/page.tsx` - Add Suspense
5. [x] `app/dashboard/affiliations/my-assignments/page.tsx` - Add Suspense
6. [x] `app/dashboard/affiliations/kanban/page.tsx` - Add Suspense
7. [x] `app/dashboard/affiliations/archived/page.tsx` - Add Suspense

### Client Components a Crear:
- [x] `app/dashboard/disabilities/disabilities-client.tsx`
- [x] `app/dashboard/users/users-client.tsx`
- [x] `app/dashboard/clients/clients-client.tsx`

### Skeletons a Crear (14 total):
1. [x] `components/dashboard/disabilities/disabilities-stats-skeleton.tsx`
2. [x] `components/dashboard/disabilities/disabilities-table-skeleton.tsx` (verificar)
3. [x] `components/dashboard/users/users-stats-skeleton.tsx`
4. [x] `components/dashboard/users-table-skeleton.tsx` (verificar)
5. [x] `components/dashboard/clients/clients-stats-skeleton.tsx`
6. [x] `components/dashboard/clients/clients-table-skeleton.tsx` (verificar)
7. [x] `components/dashboard/dashboard-stats-skeleton.tsx`
8. [x] `components/dashboard/my-assignments-widget-skeleton.tsx`
9. [x] `components/dashboard/affiliations/my-assignments-stats-skeleton.tsx`
10. [x] `components/dashboard/affiliations/my-assignments-table-skeleton.tsx`
11. [x] `components/dashboard/affiliations/kanban-board-skeleton.tsx`
12. [x] `components/dashboard/affiliations/archived-affiliations-table-skeleton.tsx`
13. [x] `components/dashboard/clients/client-documents-gallery-skeleton.tsx`

### Components para Dynamic Import:
- [x] `components/dashboard/clients/client-documents-gallery.tsx`
- [x] `components/dashboard/disabilities/disability-form-dialog.tsx`
- [x] `components/dashboard/clients/client-form-dialog.tsx`
- [x] `components/dashboard/clients/credential-form-dialog.tsx`
- [x] `components/dashboard/affiliations/affiliation-create-wizard.tsx`
- [x] `components/dashboard/affiliations/subprocess-detail-modal.tsx`

---

## Verificación End-to-End

Para CADA página modificada, verificar:

### 1. Progressive Rendering
- [ ] Header aparece instantáneamente
- [ ] Skeleton muestra para stats
- [ ] Skeleton muestra para tabla/contenido
- [ ] Datos se cargan progresivamente

### 2. Funcionalidad
- [ ] Botón crear funciona
- [ ] Botón editar funciona
- [ ] Delete funciona
- [ ] Search/filtros funcionan
- [ ] Paginación funciona

### 3. Performance
- [ ] Network tab: fetches paralelos
- [ ] Sin useEffect waterfalls en cliente
- [ ] Sin layout shift (CLS = 0)

### 4. Bundle Size
```bash
npm run build
# Verificar tamaños de chunks
# Verificar lazy chunks para dialogs
```

### 5. Testing Manual
```bash
# Development
npm run dev

# Production
npm run build
npm run start

# Lighthouse
npx lighthouse http://localhost:3000/dashboard/affiliations --view
```

---

## Métricas de Éxito

**Antes:**
- Initial JS bundle: ~540KB
- Dashboard TTFB: ~400ms
- Affiliations TTFB: ~600ms
- TTI: ~2.3s
- LCP: ~1.8s
- CLS: 0.05

**Después (target):**
- Initial JS bundle: ~460KB (-15%)
- Dashboard TTFB: ~200ms (-50%)
- Affiliations TTFB: ~300ms (-50%)
- TTI: ~1.8s (-22%)
- LCP: ~1.2s (-33%)
- CLS: 0 (perfecto)

---

## Notas Importantes

1. **Seguir patrón de affiliations page** - Es la implementación de referencia
2. **Crear skeletons que coincidan con layout real** - Previene CLS
3. **NO envolver mutations con cache()** - Solo operaciones de lectura
4. **Probar cada fase independientemente** - No saltarse testing
5. **Usar absolute imports consistentemente** - Convención del proyecto
6. **Preservar RBAC checks** - Seguridad es crítica
7. **Mantener error boundaries** - No remover error handling

---

## Estimación de Tiempo

- Fase 1 (Client → Server): 6-8 horas
  - Disabilities: 2-3h
  - Users: 2h
  - Clients: 2-3h
- Fase 2 (Suspense): 3-4 horas
- Fase 3 (React.cache): 1-2 horas
- Fase 4 (Bundle): 2 horas

**Total: 12-16 horas**
