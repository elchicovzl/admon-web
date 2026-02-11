# Plan: Mejoras a Vista Kanban - Cards Compactos y Drag & Drop

## Context

La vista Kanban fue implementada exitosamente, pero necesita dos mejoras importantes:

1. **Cards muy grandes**: Las tarjetas actuales ocupan demasiado espacio vertical, haciendo difícil ver múltiples procesos a la vez
2. **Falta drag & drop**: No es posible arrastrar tarjetas entre columnas para cambiar el estado - hay que usar un botón dentro de cada tarjeta

**Objetivo**: Hacer las tarjetas más compactas y agregar funcionalidad de drag & drop para que los usuarios puedan arrastrar tarjetas entre columnas y automáticamente actualizar el estado del sub-proceso.

## Mejoras a Implementar

### 1. Reducir Tamaño de Cards (Modo Compact)

**Cambios en diseño del card**:
- Reducir padding de CardHeader y CardContent
- Usar tamaños de fuente más pequeños (text-xs en lugar de text-sm)
- Reducir espacio entre elementos (space-y-2 en lugar de space-y-3)
- Hacer badges más pequeños
- Reducir tamaño de iconos (h-3 w-3)
- Eliminar botón "Ver Afiliación" del card - solo disponible en hover o en un menú contextual

**Altura objetivo**: ~150-180px por card (actualmente ~250-300px)

### 2. Implementar Drag & Drop

**Librería a usar**: `@dnd-kit/core` + `@dnd-kit/sortable`

**Razones**:
- Moderna, mantenida activamente
- Excelente soporte TypeScript
- Accesible por defecto (WCAG)
- Más ligera que react-beautiful-dnd
- Funciona bien con React 19
- Documentación clara

**Flujo de drag & drop**:
1. Usuario hace click y arrastra una tarjeta
2. Tarjeta muestra feedback visual (opacidad, shadow)
3. Columna de destino muestra indicador visual
4. Al soltar en columna diferente:
   - Llamar a `updateSubProcessStatus()` con el nuevo estado
   - Actualización optimista: mover card inmediatamente
   - Si falla: revertir y mostrar toast error
   - Si éxito: mantener posición y mostrar toast success

## Arquitectura de la Solución

### 1. Instalar Dependencias

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. Modificar subprocess-kanban-card.tsx

**Archivo**: `components/dashboard/affiliations/subprocess-kanban-card.tsx`

En el modo compact, reducir tamaños:

```tsx
// Antes
<CardHeader className="pb-3">
  <CardTitle className="text-sm font-medium line-clamp-1">

// Después
<CardHeader className="p-3 pb-2">
  <CardTitle className="text-xs font-medium line-clamp-1">
```

Cambios específicos:
- `CardHeader`: `p-3 pb-2` (antes: default padding)
- `CardContent`: `p-3 pt-2 space-y-2` (antes: `space-y-3 pt-0`)
- Título cliente: `text-xs` (antes: `text-sm`)
- Iconos: ya están en `h-3 w-3` ✅
- Remover botón "Ver Afiliación" del render normal
- Agregar menú contextual (click derecho) con opción "Ver Afiliación"

### 3. Envolver Cards con Draggable

**Archivo**: `components/dashboard/affiliations/kanban-column.tsx`

Modificar para soportar drag & drop:

```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function DraggableCard({ subProcess, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subProcess.id,
    data: {
      subProcess,
      currentStatus: subProcess.status,
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SubProcessKanbanCard {...props} subProcess={subProcess} />
    </div>
  )
}
```

### 4. Configurar DndContext en kanban-client.tsx

**Archivo**: `app/dashboard/affiliations/kanban/kanban-client.tsx`

Envolver el board con DndContext:

```tsx
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

export function KanbanClient({ ... }) {
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // Si se suelta en columna diferente
    if (activeData.currentStatus !== overData.columnStatus) {
      // Actualización optimista
      const newStatus = overData.columnStatus
      handleSubProcessUpdated(active.id, { status: newStatus })

      // Llamar a server action
      const result = await updateSubProcessStatus({
        subProcessId: active.id,
        status: newStatus,
      })

      if (!result.success) {
        // Revertir si falla
        handleSubProcessUpdated(active.id, { status: activeData.currentStatus })
        toast.error(result.error)
      } else {
        toast.success('Estado actualizado')
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Kanban Board */}
      <DragOverlay>
        {activeId ? (
          <SubProcessKanbanCard
            subProcess={findSubProcess(activeId)}
            compact={true}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
```

### 5. Configurar Droppable Zones en Columnas

**Archivo**: `components/dashboard/affiliations/kanban-column.tsx`

Hacer cada columna una zona droppable:

```tsx
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

export function KanbanColumn({ status, subProcesses, ... }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: {
      columnStatus: status,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full",
        isOver && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Header */}

      {/* Cards Container */}
      <SortableContext
        items={subProcesses.map(sp => sp.id)}
        strategy={verticalListSortingStrategy}
      >
        {subProcesses.map((sp) => (
          <DraggableCard
            key={sp.id}
            subProcess={sp}
            {...props}
          />
        ))}
      </SortableContext>
    </div>
  )
}
```

### 6. Agregar Menú Contextual (Opcional pero Recomendado)

Ya que removemos el botón "Ver Afiliación", agregar menú contextual:

```tsx
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'

<ContextMenu>
  <ContextMenuTrigger>
    <Card>...</Card>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem asChild>
      <Link href={`/dashboard/affiliations/${subProcess.affiliationId}`}>
        <ExternalLink className="mr-2 h-4 w-4" />
        Ver Afiliación Completa
      </Link>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

## Archivos a Modificar

1. **package.json** - Agregar dependencias @dnd-kit
2. **[components/dashboard/affiliations/subprocess-kanban-card.tsx](components/dashboard/affiliations/subprocess-kanban-card.tsx)** - Reducir tamaños en modo compact
3. **[components/dashboard/affiliations/kanban-column.tsx](components/dashboard/affiliations/kanban-column.tsx)** - Agregar DraggableCard, useDroppable, SortableContext
4. **[app/dashboard/affiliations/kanban/kanban-client.tsx](app/dashboard/affiliations/kanban/kanban-client.tsx)** - Configurar DndContext, handlers

## Consideraciones Especiales

### Accesibilidad
- @dnd-kit incluye soporte de teclado por defecto
- Agregar `aria-label` descriptivos a las tarjetas
- Anunciar cambios de estado con toast

### Performance
- Usar `useSensors` con debounce para evitar renders excesivos
- Mantener actualización optimista para UX fluida

### Estado RETURNED
- Si el estado destino es RETURNED, mostrar dialog pidiendo la razón antes de actualizar
- No permitir drag & drop directo a RETURNED, forzar uso del botón "Cambiar Estado"

### Mobile
- Drag & drop funciona en mobile con touch events
- Considerar agregar botones de "mover" en mobile como alternativa

## Verificación End-to-End

1. **Test de tamaño de cards**:
   - ✅ Cards ocupan ~150-180px de alto
   - ✅ Se pueden ver 3-4 cards sin scroll en pantalla normal
   - ✅ Texto no se corta ni se superpone

2. **Test de drag & drop básico**:
   - ✅ Click y arrastrar una tarjeta
   - ✅ Tarjeta sigue el cursor con opacidad reducida
   - ✅ DragOverlay muestra preview de la tarjeta
   - ✅ Columna destino muestra indicador visual (ring)

3. **Test de actualización de estado**:
   - ✅ Arrastrar de "Sin Iniciar" a "En Proceso" → actualiza estado
   - ✅ Toast de éxito aparece
   - ✅ Tarjeta permanece en nueva columna
   - ✅ Recargar página → cambio persiste

4. **Test de error**:
   - ✅ Si falla server action → tarjeta vuelve a columna original
   - ✅ Toast de error muestra mensaje

5. **Test de permisos**:
   - ✅ Manager solo puede mover sus propios procesos
   - ✅ SUPER_ADMIN puede mover cualquier proceso
   - ✅ Intentar mover proceso de otro → error y revert

6. **Test de RETURNED**:
   - ✅ Arrastrar a "Devuelto" → muestra dialog pidiendo razón
   - ✅ Cancelar → tarjeta vuelve a origen
   - ✅ Confirmar con razón → actualiza con razón guardada

## Diseño Visual Mejorado

### Card Compact (Nuevo)
```
┌─────────────────────────┐
│ [ARL] [Sin Iniciar]     │  ← 12px padding, badges text-xs
│ Jose Perez              │  ← text-xs, line-clamp-1
│ 👤 Yudy Milena          │  ← text-xs, icon h-3
│ 📄 0 documentos         │  ← text-xs, icon h-3
└─────────────────────────┘
   ~150px height
```

### Visual Feedback Drag
- **Dragging**: opacity-50, scale-105, rotate-2, shadow-lg
- **Column hover**: ring-2 ring-primary
- **DragOverlay**: Card con shadow-2xl

## Notas de Implementación

- Seguir patrones de Server Actions del proyecto
- Mantener TypeScript strict
- Usar shadcn/ui para componentes UI
- Mensajes en español
- Testing manual exhaustivo antes de considerar completo
