# Diseño: Sistema de Priorización Visual para Kanban de Afiliaciones

**Fecha:** 2026-02-10
**Estado:** Aprobado para implementación
**Autor:** Brainstorming con usuario

---

## Problema

El kanban de afiliaciones no permite identificar fácilmente qué sub-procesos llevan más tiempo esperando para ser iniciados. Los managers necesitan priorizar el trabajo basándose en la antigüedad de las afiliaciones para atender primero las más urgentes.

**Requisitos del Usuario:**
- Mostrar la fecha de creación de cada sub-proceso en las tarjetas del kanban
- Indicador visual claro de antigüedad/prioridad
- Ordenamiento automático por fecha (más antiguas primero)
- Especialmente importante para la columna "Sin Iniciar"
- Configuración personalizable de umbrales de prioridad

---

## Decisiones de Diseño

### 1. Umbrales de Prioridad
- **Configuración global del sistema** (manejada por SUPER_ADMIN)
- Valores por defecto hardcoded para la primera versión
- Futura implementación de UI de configuración (Fase 2)

**Umbrales por Defecto:**
- 🟢 **Baja** (Low): 0-2 días - Gris
- 🟡 **Media** (Medium): 3-6 días - Amarillo
- 🟠 **Alta** (High): 7-13 días - Naranja
- 🔴 **Crítica** (Critical): 14+ días - Rojo

### 2. Visualización en Tarjetas
- **Badge de tiempo transcurrido** - Muestra "Hace X días" con color según prioridad
- **Borde izquierdo coloreado** - Indicador visual rápido (4px)
- **Ícono de alerta** - Solo para prioridades alta y crítica
- **Diseño compacto** - No sobrecarga la tarjeta

### 3. Ordenamiento
- **Automático y fijo** por fecha de creación (ascendente)
- Más antiguas siempre aparecen primero
- No se puede reordenar manualmente
- Garantiza consistencia en la priorización

---

## Arquitectura

### Componentes Nuevos

#### 1. `lib/utils/priority.ts`
Utilidad para calcular el nivel de prioridad basado en fecha de creación.

**Exports:**
- `PriorityLevel` type: 'low' | 'medium' | 'high' | 'critical'
- `PriorityConfig` interface: configuración completa de un nivel de prioridad
- `PriorityThresholds` interface: umbrales configurables en días
- `DEFAULT_THRESHOLDS` const: valores por defecto
- `calculatePriority()` función: calcula prioridad de un sub-proceso

**Función Principal:**
```typescript
function calculatePriority(
  createdAt: Date,
  thresholds?: PriorityThresholds
): PriorityConfig
```

Retorna objeto con:
- `level`: Nivel de prioridad
- `borderColor`: Clases Tailwind para borde
- `badgeClass`: Clases Tailwind para badge
- `showIcon`: Boolean - mostrar ícono de alerta
- `label`: String formateado ("Hace 3 días", "Hoy", "Ayer")

### Componentes Modificados

#### 2. `lib/types/affiliation.types.ts`
**Cambio:** Añadir campo `createdAt: Date` a interface `SubProcessKanbanItem`

**Razón:** Necesario para calcular antigüedad en el frontend

#### 3. `lib/actions/affiliation.actions.ts`
**Función:** `getSubProcessesForKanban()`

**Cambios:**
- Incluir `createdAt` en el `select` de Prisma (línea ~1020)
- Mapear `createdAt` en la transformación de datos (línea ~1054)

#### 4. `components/dashboard/affiliations/subprocess-kanban-card.tsx`
**Cambios en modo compacto:**
- Importar `calculatePriority` y `AlertCircle`
- Calcular prioridad usando `createdAt` del sub-proceso
- Añadir clase de borde coloreado al `<Card>`
- Renderizar nueva fila con badge de tiempo + ícono condicional
- Posicionar entre badges de tipo/status y nombre del cliente

**Estructura visual:**
```
Card (con borde izquierdo coloreado)
├─ Header
│  ├─ TypeBadge | StatusBadge
│  ├─ [AlertIcon] TimeBadge  ← NUEVO
│  └─ Cliente nombre
└─ Content
   ├─ Manager
   ├─ Documentos
   └─ Ver detalle
```

#### 5. `app/dashboard/affiliations/kanban/kanban-client.tsx`
**Función:** `groupedByStatus` useMemo

**Cambio:** Añadir ordenamiento por fecha dentro de cada grupo de status

**Código:**
```typescript
Object.keys(groups).forEach((status) => {
  groups[status as AffiliationSubProcessStatus].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
})
```

---

## Plan de Implementación

### Fase 1: Core (Actual)

**Orden de implementación:**

1. **Crear `lib/utils/priority.ts`**
   - Definir types e interfaces
   - Implementar `calculatePriority()`
   - Exportar constantes

2. **Actualizar tipos (Backend → Frontend)**
   - Modificar `SubProcessKanbanItem` interface
   - Actualizar query en `getSubProcessesForKanban()`
   - Incluir `createdAt` en mapeo de datos

3. **Actualizar componente de tarjeta**
   - Importar utilidad de prioridad
   - Calcular prioridad en render
   - Añadir elementos visuales (borde, badge, ícono)

4. **Añadir ordenamiento en kanban**
   - Modificar `groupedByStatus` useMemo
   - Implementar sort por fecha

5. **Testing**
   - Verificar ordenamiento correcto
   - Verificar colores según antigüedad
   - Verificar ícono solo en alta/crítica
   - Probar con datos de diferentes fechas

### Fase 2: Configuración (Futuro - Opcional)

**Componentes adicionales:**

1. **Tabla de base de datos**
   ```prisma
   model SystemSettings {
     id    String @id @default(cuid())
     key   String @unique
     value Json
     updatedAt DateTime @updatedAt
   }
   ```

2. **Página de configuración**
   - Ruta: `/dashboard/settings/kanban-priority`
   - Solo accesible para SUPER_ADMIN
   - Formulario con 3 inputs numéricos (umbrales)
   - Server Action para guardar

3. **Cargar configuración dinámica**
   - Leer de base de datos en server component
   - Pasar como prop al kanban client
   - Usar en `calculatePriority()`

---

## Resultado Esperado

### Comportamiento

1. **Al cargar el kanban:**
   - Sub-procesos se ordenan automáticamente por fecha de creación
   - Más antiguos aparecen arriba en cada columna

2. **Identificación visual:**
   - Borde gris: 0-2 días (reciente, sin urgencia)
   - Borde amarillo: 3-6 días (atención moderada)
   - Borde naranja + ⚠️: 7-13 días (prioridad alta)
   - Borde rojo + ⚠️: 14+ días (urgente)

3. **Badge de tiempo:**
   - "Hoy" - para creados hoy
   - "Ayer" - para creados ayer
   - "Hace X días" - para más antiguos
   - Color del badge coincide con nivel de prioridad

### Experiencia del Usuario

- **Escaneo rápido:** Colores llamativos inmediatamente visibles
- **Priorización clara:** Más urgentes arriba, rojos destacan
- **Información contextual:** Badge muestra exactamente cuánto tiempo lleva esperando
- **Consistencia:** Ordenamiento automático elimina decisiones manuales

---

## Consideraciones Técnicas

### Performance

- **Cálculo de prioridad:** O(1) por tarjeta, trivial
- **Ordenamiento:** O(n log n) por columna, ejecuta solo cuando cambian filtros
- **No afecta:** Drag & drop ni actualizaciones optimistas

### Compatibilidad

- **Modo compacto:** Se actualizan tarjetas en kanban
- **Modo completo:** No se modifica (página de detalle)
- **Tipos existentes:** Se mantiene compatibilidad con `AffiliationSubProcessWithRelations`

### Mantenibilidad

- **Centralizado:** Toda lógica de prioridad en un solo archivo
- **Configurable:** Fácil cambiar umbrales sin tocar componentes
- **Extensible:** Preparado para configuración dinámica futura

---

## Alternativas Consideradas

### 1. Ordenamiento manual con drag & drop
**Descartado:** Requiere persistencia de orden personalizado, añade complejidad innecesaria cuando el criterio es objetivo (fecha).

### 2. Prioridad por tipo de proceso
**Descartado:** Todos los procesos son igualmente importantes, la antigüedad es el único factor relevante.

### 3. Barra de progreso temporal
**Descartado:** Ocupa más espacio y es menos intuitivo que el sistema de colores con borde.

### 4. Configuración por usuario
**Descartado:** Causaría inconsistencias en el equipo. Mejor tener criterio único compartido.

---

## Testing

### Casos de Prueba

1. **Sub-proceso creado hoy:**
   - Badge muestra "Hoy"
   - Borde gris
   - Sin ícono de alerta

2. **Sub-proceso creado hace 5 días:**
   - Badge muestra "Hace 5 días"
   - Borde amarillo
   - Sin ícono de alerta

3. **Sub-proceso creado hace 10 días:**
   - Badge muestra "Hace 10 días"
   - Borde naranja
   - Con ícono de alerta ⚠️

4. **Sub-proceso creado hace 20 días:**
   - Badge muestra "Hace 20 días"
   - Borde rojo
   - Con ícono de alerta ⚠️

5. **Ordenamiento:**
   - Crear 3 sub-procesos con fechas diferentes
   - Verificar que aparecen ordenados (más antiguo arriba)

6. **Drag & drop:**
   - Mover tarjeta entre columnas
   - Verificar que se reordena automáticamente en destino

---

## Métricas de Éxito

- ✅ Managers pueden identificar sub-procesos urgentes en < 3 segundos
- ✅ Reducción en tiempo para decidir qué trabajar primero
- ✅ Consistencia en priorización entre todo el equipo
- ✅ Cero configuración necesaria para empezar a usar

---

## Notas de Implementación

### Dependencias
- `date-fns`: Ya instalada, usar para formatear fechas si es necesario
- `lucide-react`: Ya instalada, usar `AlertCircle` para ícono de prioridad

### Archivos de Referencia
- Componente actual: `components/dashboard/affiliations/subprocess-kanban-card.tsx`
- Cliente kanban: `app/dashboard/affiliations/kanban/kanban-client.tsx`
- Server action: `lib/actions/affiliation.actions.ts` (línea 1002)
- Tipos: `lib/types/affiliation.types.ts` (línea 283)

### Riesgos
- **Bajo:** Cambios aislados, no afecta lógica de negocio crítica
- **Rollback fácil:** Si hay problemas, simplemente no mostrar prioridad

---

**Fin del Documento**
