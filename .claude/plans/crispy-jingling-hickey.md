# Plan: Vista Kanban para Afiliaciones

## Context

El sistema actual de afiliaciones permite crear clientes y asignarles procesos de seguridad social (ARL, EPS, AFP, CCF). Cada proceso puede tener un manager diferente y avanza por diferentes estados.

Actualmente, para ver el estado de los procesos hay que:
1. Ir a la tabla de afiliaciones
2. Hacer clic en cada afiliación individual
3. Ver el detalle de cada sub-proceso

Este flujo es lento y dificulta la supervisión general del estado de múltiples afiliaciones.

**Objetivo**: Crear una vista Kanban que permita visualizar rápidamente todos los sub-procesos organizados por estado, con filtros avanzados para facilitar el seguimiento.

## Decisiones de Diseño (Confirmadas con Usuario)

### Organización del Kanban
- **Columnas por estado**: NOT_STARTED, IN_PROGRESS, PENDING_SUPPORT, IN_REVIEW, COMPLETED, RETURNED
- **Cada tarjeta = 1 sub-proceso** (un ARL específico, un EPS específico, etc.)

### Información Visible en Tarjetas
- Nombre del cliente
- Tipo de proceso (badge: ARL, EPS, AFP, CCF)
- Manager asignado
- Número de documentos

### Filtros Disponibles
- Por tipo de proceso (ARL, EPS, AFP, CCF)
- Por manager asignado
- Por cliente (búsqueda)
- "Mis procesos asignados" (filtro rápido)

### Ubicación
- Nueva ruta: `/dashboard/affiliations/kanban`
- Nueva opción en el sidebar bajo "Afiliaciones"

## Arquitectura de la Solución

### 1. Server Action Nueva

**Archivo**: `lib/actions/affiliation.actions.ts`

Crear función `getSubProcessesForKanban()`:
- Retorna todos los sub-procesos con relaciones mínimas necesarias
- Include: cliente (fullName), manager asignado (name, email), documentos (count)
- Ordenado por `updatedAt DESC`
- Optimizado con select específico (no traer datos innecesarios)

```typescript
export async function getSubProcessesForKanban(): Promise<ActionResponse<SubProcessKanbanItem[]>>
```

### 2. Tipo TypeScript Nuevo

**Archivo**: `lib/types/affiliation.types.ts`

```typescript
export interface SubProcessKanbanItem {
  id: string
  type: AffiliationSubProcessType
  status: AffiliationSubProcessStatus
  affiliationId: string
  updatedAt: Date
  client: {
    id: string
    fullName: string
  }
  assignedTo: {
    id: string
    name: string | null
    email: string
  } | null
  _count: {
    documents: number
  }
}
```

### 3. Nueva Página (Server Component)

**Archivo**: `app/dashboard/affiliations/kanban/page.tsx`

- Server Component que obtiene datos con `getSubProcessesForKanban()`
- Pasa datos a Client Component
- Maneja autenticación (ya está en middleware)

### 4. Client Component Principal

**Archivo**: `app/dashboard/affiliations/kanban/kanban-client.tsx`

Responsabilidades:
- Manejo de estado de filtros
- Agrupar sub-procesos por estado
- Renderizar 6 columnas (una por estado)
- Optimistic updates cuando se actualiza un sub-proceso

### 5. Componente de Filtros

**Archivo**: `components/dashboard/affiliations/kanban-filters.tsx`

Controles:
- Select múltiple para tipos de proceso (ARL, EPS, AFP, CCF)
- Select para manager asignado
- Input de búsqueda por nombre de cliente
- Toggle "Solo mis procesos"

### 6. Componente de Columna

**Archivo**: `components/dashboard/affiliations/kanban-column.tsx`

- Renderiza encabezado con nombre de estado y contador
- Lista de tarjetas (sub-procesos)
- Scroll independiente si hay muchas tarjetas
- Posible drag & drop futuro (opcional en v1)

### 7. Reutilizar Componente de Tarjeta

**Archivo**: `components/dashboard/affiliations/subprocess-kanban-card.tsx` (Ya existe)

**Modificaciones necesarias**:
- Agregar prop `compact={true}` para versión simplificada en Kanban
- En modo compact: solo mostrar info esencial (cliente, manager, documentos)
- Mantener funcionalidad de cambio de estado
- Agregar botón "Ver Afiliación Completa" que redirija a `/dashboard/affiliations/[id]`

### 8. Actualizar Sidebar

**Archivo**: `components/dashboard/app-sidebar.tsx`

Cambiar el ítem de "Afiliaciones" para que tenga sub-menú:
- Listado (ruta actual)
- Vista Kanban (nueva ruta)
- Mis Asignaciones (ruta existente)

## Archivos Críticos a Modificar/Crear

### Nuevos Archivos
1. `app/dashboard/affiliations/kanban/page.tsx` - Página principal
2. `app/dashboard/affiliations/kanban/kanban-client.tsx` - Lógica del Kanban
3. `components/dashboard/affiliations/kanban-filters.tsx` - Filtros
4. `components/dashboard/affiliations/kanban-column.tsx` - Columna individual

### Archivos a Modificar
1. `lib/actions/affiliation.actions.ts` - Agregar `getSubProcessesForKanban()`
2. `lib/types/affiliation.types.ts` - Agregar `SubProcessKanbanItem`
3. `components/dashboard/affiliations/subprocess-kanban-card.tsx` - Agregar modo `compact`
4. `components/dashboard/app-sidebar.tsx` - Agregar sub-menú a Afiliaciones

## Funcionalidades Existentes a Reutilizar

De `subprocess-kanban-card.tsx`:
- `updateSubProcessStatus()` - Ya implementada
- `assignSubProcess()` - Ya implementada
- Badges de estado y tipo - Ya implementados
- Manejo de optimistic updates

De `my-assignments-client.tsx`:
- Patrón de agrupación por estado
- Layout de tarjetas con información del cliente

## Flujo de Interacción

1. Usuario navega a `/dashboard/affiliations/kanban`
2. Se cargan todos los sub-procesos con `getSubProcessesForKanban()`
3. Se agrupan por estado en 6 columnas
4. Usuario aplica filtros (tipo, manager, cliente, "mis procesos")
5. Las tarjetas se filtran en tiempo real (client-side)
6. Usuario puede:
   - Cambiar estado de un sub-proceso (actualización optimista)
   - Asignarse un proceso sin asignar
   - Ver detalles completos (navega a la afiliación)

## Consideraciones de Performance

- **Select optimizado**: Solo traer campos necesarios en la query
- **Client-side filtering**: Una vez cargados los datos, filtrar en el cliente
- **Skeleton loaders**: Mostrar mientras cargan datos iniciales
- **Virtualización (futuro)**: Si hay > 100 tarjetas, considerar react-virtual

## Verificación End-to-End

1. **Test de carga**: Navegar a `/dashboard/affiliations/kanban`
   - ✅ Se muestran 6 columnas con estados correctos
   - ✅ Tarjetas muestran nombre cliente, tipo, manager, documentos

2. **Test de filtros**:
   - ✅ Filtrar por tipo ARL → solo muestra sub-procesos ARL
   - ✅ Filtrar por manager → solo muestra procesos de ese manager
   - ✅ Buscar cliente "Jose" → solo muestra procesos de clientes con ese nombre
   - ✅ Toggle "Mis procesos" → solo muestra asignados al usuario actual

3. **Test de actualización**:
   - ✅ Cambiar estado de un sub-proceso → se mueve a la columna correcta
   - ✅ Asignarse un proceso → aparece el nombre del manager
   - ✅ Click "Ver Afiliación" → navega a la página de detalle

4. **Test de permisos**:
   - ✅ Manager solo puede editar sus procesos asignados
   - ✅ SUPER_ADMIN puede editar cualquier proceso

## Diseño Visual

- **Layout**: Grid responsivo de columnas
  - Desktop: 6 columnas visibles
  - Tablet: 3 columnas (scroll horizontal)
  - Mobile: 1 columna (tabs por estado)

- **Colores de columnas**: Usar los colores ya definidos en `SubProcessStatusColors`
  - NOT_STARTED: gray
  - IN_PROGRESS: blue
  - PENDING_SUPPORT: yellow
  - IN_REVIEW: purple
  - COMPLETED: green
  - RETURNED: red

- **Tarjetas**: Usar componente Card existente con padding reducido en modo compact

## Notas Adicionales

- Seguir patrón de Server Actions del proyecto (auth → RBAC → validación → lógica)
- Mantener convenciones de naming (camelCase, kebab-case para archivos)
- Usar shadcn/ui para todos los componentes UI
- Mensajes en español
- TypeScript strict mode
