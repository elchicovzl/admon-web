# CLAUDE - Dashboard Architecture & Patterns

**DOCUMENTACIÓN CRÍTICA**: Mantener estas convenciones para consistencia en todo el dashboard.

---

## Stack Tecnológico

- **Framework**: Next.js 15.2.4 (App Router, NO Pages Router)
- **Auth**: NextAuth v5 (Auth.js) - Variables: AUTH_SECRET, AUTH_URL
- **Database**: PostgreSQL 18 (+ extensión pgvector) + Prisma ORM 6.18.0
- **Forms**: React Hook Form 7.60 + Zod 3.25
- **UI**: shadcn/ui (Radix UI + Tailwind CSS 4.1.9)
- **State**: Zustand 5.0.8 (Context Provider pattern)
- **Package Manager**: pnpm

---

## Arquitectura Core

### Sin API Routes - Solo Server Actions
```typescript
// ✅ CORRECTO
'use server'
export async function createUser(data) { ... }

// ❌ NO USAR
// app/api/users/route.ts → NO crear API routes
```

### Server Components por Defecto
```typescript
// ✅ Server Component (default)
export default async function Page() {
  const data = await getData()
  return <Display data={data} />
}

// ❌ Client Component innecesario
'use client'  // Solo cuando REALMENTE necesario
```

---

## Patrones de Diseño Obligatorios

### 1. Server Actions Pattern

**Estructura Estándar**:
```typescript
'use server'

export async function actionName(input: Input): Promise<ActionResponse> {
  // 1. Auth
  const session = await auth()
  if (!session) return { success: false, error: 'No autenticado' }

  // 2. RBAC
  if (session.user.role !== 'REQUIRED_ROLE') {
    return { success: false, error: 'No autorizado' }
  }

  // 3. Validación (Zod)
  const validated = schema.safeParse(input)
  if (!validated.success) return { success: false, error: 'Inválido' }

  // 4. Lógica
  const result = await prisma...

  // 5. Revalidate
  revalidatePath('/dashboard/path')

  // 6. Return tipado
  return { success: true, data: result }
}
```

### 2. Optimistic Updates Pattern

```typescript
// Componente hijo
const result = await toggleStatus(id, !isActive)
if (result.success) {
  onUserUpdated?.(id, { isActive: !isActive })  // Callback
}

// Página padre
const handleUserUpdated = (id, updates) => {
  setUsers(prev => prev.map(u => u.id === id ? {...u, ...updates} : u))
}

// ❌ NO usar router.refresh() innecesariamente
```

### 3. Soft Delete Pattern

```typescript
// ✅ Soft delete con isActive
model User {
  isActive Boolean @default(true)
}

await prisma.user.update({ data: { isActive: false } })

// ❌ Hard delete NO para usuarios
await prisma.user.delete({ where: { id } })
```

### 4. Zustand Context Provider Pattern

```typescript
// ✅ CORRECTO
const createStore = () => createStore<Store>((set) => ({ ... }))

export function Provider({ children }) {
  const storeRef = useRef()
  if (!storeRef.current) storeRef.current = createStore()
  return <Context.Provider value={storeRef.current}>{children}</Context.Provider>
}

// ❌ NO stores globales
export const useStore = create<Store>((set) => (...))  // State leakage en SSR
```

---

## RBAC (Role-Based Access Control)

### Roles
```typescript
enum UserRole {
  SUPER_ADMIN  // Acceso total, gestiona managers
  MANAGER      // Acceso limitado
}
```

### Permisos ortogonales al rol

`User.role` es un campo **único**: un rol nuevo le quita al usuario todo lo demás.
Cuando un módulo necesita acceso restringido pero el usuario debe conservar el
resto del dashboard, se agrega un **flag booleano**, no un valor al enum.

```prisma
model User {
  role             UserRole @default(MANAGER)
  canAccessControl Boolean  @default(false)  // módulo Control (caja interna)
  canAccessWhatsApp Boolean @default(false)  // módulo WhatsApp (bandeja compartida)
}
```

```typescript
// Regla de acceso: SUPER_ADMIN entra por rol; el resto, por flag explícito
session.user.role === UserRole.SUPER_ADMIN || user.canAccessControl
```

**WhatsApp** usa exactamente el mismo patrón con `User.canAccessWhatsApp`:
SUPER_ADMIN lo otorga por usuario desde "Editar Usuario" (switch "Acceso a
WhatsApp"). Capas: middleware (`whatsAppRoutes`, lee el JWT), layout de
`/dashboard/whatsapp` (`hasWhatsAppAccess()`, lee la base) y cada Server Action
(`requireWhatsAppAuth()` de `lib/whatsapp/access.ts`). La bandeja es compartida
entre los usuarios con acceso; las notificaciones de escalamiento y leads van
solo a ellos más los SUPER_ADMIN. Migración nueva: aplicar a producción a mano
con `pnpm db:deploy`.

### Protección de Rutas (middleware.ts)
```typescript
const protectedRoutes = ['/dashboard']
const superAdminRoutes = ['/dashboard/users']
const controlRoutes = ['/dashboard/control']

// Flujo: Check auth → Check role/flag → Allow/Deny
```

⚠️ **El middleware lee el JWT, que vive 30 días** (`session.maxAge`). Sirve como
gate barato para que un usuario sin permiso no vea la UI, pero **un permiso
revocado sigue diciendo `true` en el token hasta que expire**. Para módulos
sensibles la verificación real va contra la base de datos:

```typescript
// lib/auth/rbac.ts — lee de la DB, ignora el token
await requireControlAccess()   // throws si no está autorizado
```

### Validación Backend SIEMPRE
```typescript
// ✅ Validar en Server Action
const authCheck = await requireSuperAdmin()
if (!authCheck.authorized) return { error: 'No autorizado' }

// ❌ NO confiar solo en UI
{user.role === 'SUPER_ADMIN' && <Button />}  // Insuficiente
```

### Bloqueo de Usuarios Inactivos
```typescript
// lib/auth/auth.config.ts - authorize()
if (!user.isActive) return null  // Bloquea login
```

---

## Base de Datos (Prisma)

### Naming Conventions
```prisma
// Modelos: PascalCase singular
model User { }

// Campos: camelCase  
createdAt DateTime
emailVerified DateTime?

// Tables: snake_case plural
@@map("users")

// Enums: PascalCase
enum UserRole { SUPER_ADMIN }
```

### Campos Estándar
```prisma
model Model {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isActive  Boolean  @default(true)  // Soft delete

  @@map("models")
}
```

### Prisma Client Singleton
```typescript
// lib/db/prisma.ts
const prismaClientSingleton = () => new PrismaClient()
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
export default prisma

// ❌ NO múltiples instancias
const prisma = new PrismaClient()  // NO hacer esto en cada archivo
```

---

## Formularios

### Stack: React Hook Form + Zod + Server Actions

**1. Schema Zod**
```typescript
export const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
export type Input = z.infer<typeof schema>
```

**2. Server Action**
```typescript
'use server'
export async function action(data: Input) {
  const validated = schema.safeParse(data)  // Validación server
  if (!validated.success) return { error: 'Inválido' }
  // ...
}
```

**3. Componente**
```typescript
'use client'
export function Form({ onSuccess }) {
  const form = useForm<Input>({
    resolver: zodResolver(schema),  // Validación client
  })

  async function onSubmit(data: Input) {
    const result = await action(data)
    if (result.success) {
      onSuccess?.(result.data)  // Optimistic update
      toast.success(result.message)
    }
  }

  return <Form {...form}>...</Form>
}
```

---

## UI/UX

### Skeleton Loaders OBLIGATORIO
```typescript
// ✅ SIEMPRE
{isLoading ? <TableSkeleton /> : <Table data={data} />}

// ❌ NO solo spinner
{isLoading ? <Spinner /> : <Table />}
```

### Toasts (Sonner)
```typescript
toast.success('Usuario creado')
toast.error('Error al crear')
toast.loading('Creando...')
```

### Responsive (Mobile-First)
```tsx
<div className="flex-col md:flex-row">  // ✅
<div className="flex-row sm:flex-col">  // ❌
```

---

## Convenciones de Código

### Naming
```
Archivos: kebab-case.tsx
Componentes: PascalCase
Funciones: camelCase
Constantes: SCREAMING_SNAKE_CASE
```

### Imports
```typescript
// 1. External
import { useState } from 'react'

// 2. Internal (@ alias SIEMPRE)
import { Button } from '@/components/ui/button'
import prisma from '@/lib/db/prisma'

// 3. Relativos
import { helper } from './utils'
```

### Estructura de Componente
```typescript
'use client'  // Si aplica

// 1. Imports
// 2. Types/Interfaces
// 3. Component
//    3.1 Hooks
//    3.2 Handlers
//    3.3 Effects
//    3.4 Early returns
//    3.5 JSX
```

---

## Seguridad

### Password Hashing
```typescript
import bcrypt from 'bcryptjs'
const hashed = await bcrypt.hash(password, 10)
const valid = await bcrypt.compare(password, hashed)
```

### Input Validation
```typescript
// Client: UX (feedback)
resolver: zodResolver(schema)

// Server: Security (NUNCA confiar en client)
const validated = schema.safeParse(data)
```

### RBAC Enforcement
```typescript
// ✅ Validar SIEMPRE en backend
if (session.user.role !== 'SUPER_ADMIN') return { error: '...' }
```

---

## Performance

### Parallel Fetching
```typescript
// ✅ Paralelo
const [a, b, c] = await Promise.all([getA(), getB(), getC()])

// ❌ Secuencial (lento)
const a = await getA(); const b = await getB()
```

### revalidatePath Específico
```typescript
revalidatePath('/dashboard/users')  // ✅ Específico
revalidatePath('/dashboard', 'layout')  // ❌ Muy agresivo
```

---

## Scripts

```bash
# Dev
pnpm dev

# Database
pnpm db:migrate        # Crear migración
pnpm db:seed           # Seed
pnpm db:studio         # UI Prisma

# Build
pnpm build
pnpm start
```

---

## Flujos Implementados

### Autenticación
```
Usuario → /dashboard → Middleware → No auth → /login
Login → Valida credenciales → Verifica isActive
→ Crea JWT → Redirect /dashboard → Middleware permite
```

### Crear Manager (SUPER_ADMIN)
```
Click → Dialog → Form + Zod → Server Action
→ Hash password → Prisma create → Callback
→ Optimistic update → Toast → Dialog cierra
```

### Cambiar Password (SUPER_ADMIN)
```
Click → Dialog → Input → Server Action
→ Validar SUPER_ADMIN → Hash → Prisma update
→ Toast → Cierra
```

### Toggle Status
```
Click → Server Action → Validar SUPER_ADMIN
→ Prisma update isActive → Callback
→ Optimistic update (badge verde ↔ rojo) → Toast
```

### Bloqueo Usuario Inactivo
```
Login intento → authorize() → isActive === false
→ return null → "Credenciales inválidas"
```

---

## Guidelines Nuevos Módulos

### Checklist
- [ ] Schema Prisma + migración
- [ ] Tipos TypeScript
- [ ] Zod schemas
- [ ] Server Actions + exports
- [ ] Componentes UI + skeleton
- [ ] Página en app/dashboard/
- [ ] Sidebar update (si aplica)
- [ ] RBAC en middleware (si aplica)
- [ ] Testing manual
- [ ] Actualizar CLAUDE.md

### Agregar Server Action
```typescript
// Template en sección 14.4 del doc completo
// lib/actions/module.actions.ts
'use server'

export async function action(input) {
  // 1. Auth
  // 2. RBAC
  // 3. Validación
  // 4. Lógica
  // 5. Revalidate
  // 6. Return
}
```

---

## Módulo WhatsApp AI (en construcción)

Bandeja compartida de WhatsApp + asistente con IA + base de conocimiento. Solo
MANAGER y SUPER_ADMIN. Se construye en PRs encadenados detrás de flags
(`WHATSAPP_ENABLED`, `WHATSAPP_AI_ENABLED`, ambos `false` por defecto). Requiere
Postgres con la extensión `vector` (imagen `pgvector/pgvector:0.8.7-pg18-trixie`;
la migración `enable_pgvector` falla si la extensión no está disponible, así que
en producción primero se cambia la imagen y recién después se hace `pnpm db:deploy`
a mano). El worker pg-boss se documenta en este archivo a medida que aterrizan
sus PRs.

### Webhook de WhatsApp (`/api/whatsapp/webhook`)

Excepción documentada a "Sin API Routes": lo llama Meta, no un usuario, así que no
puede ser una Server Action. Reglas:

- Queda **fuera del middleware** (el matcher excluye `/api`) y se autentica **solo
  por firma**: `X-Hub-Signature-256` = HMAC-SHA256 del body crudo con
  `WHATSAPP_APP_SECRET`, comparación en tiempo constante. Firma ausente o inválida
  responde 401 sin guardar ni encolar nada. Body mayor a 1 MiB responde 413.
- `GET` devuelve el `hub.challenge` solo si `hub.verify_token` coincide con
  `WHATSAPP_VERIFY_TOKEN` (si no, 403).
- `POST` no ejecuta lógica de negocio: parte el payload en ítems, los guarda en
  `whatsapp_webhook_events` (`dedupKey` único, `createMany skipDuplicates`), encola
  `wa.event.process` solo para los ítems nuevos y responde 200. Las entregas
  duplicadas o concurrentes responden 200 sin efecto adicional. El barrendero
  (`wa.event.sweep`, cada minuto) reencola lo que siga sin procesar tras 60 s.
- Con `WHATSAPP_ENABLED` distinto de `true` solo verifica y guarda; no toca pg-boss.
- Nunca se loguean secretos, firmas, cuerpos ni teléfonos completos.
- Procesamiento (`wa.event.process` → `lib/whatsapp/process-event.ts`): un `MESSAGE`
  crea/actualiza el contacto (match con `Client` por teléfono normalizado: 1 coincidencia
  = `MATCHED`, varias = `AMBIGUOUS` sin lead, ninguna = lead `NEW`), reutiliza la única
  conversación del contacto (la reabre si estaba `CLOSED`) y guarda el mensaje. Un
  `STATUS` se guarda y se aplica de forma monótona (un `delivered` tardío no pisa `read`).
  Un ECHO (`smb_message_echoes`, mensaje espejo de lo que envía el negocio) se compara con
  nuestros propios envíos por `wamid`: si ya está guardado es nuestro y no cambia el estado.
  Si hay un envío en cola sin `wamid` de hace menos de 120 s se reintenta con
  `wa.echo.reconcile` (5 s, máx. 3). Si no, se inserta primero como `OUT`/`PHONE_APP` (el
  `wamid` único decide si es nuestro o del teléfono: un `P2002` significa que fue un envío
  propio y NO hay traspaso) y solo entonces, salvo que sea anterior al último envío de la
  IA, la conversación pasa a `HUMAN`. Si el proceso muere entre ambos pasos, la reentrega
  encuentra la fila `PHONE_APP` y completa el traspaso (la transición es idempotente). La forma real del
  payload de eco está pendiente de confirmar en un número Coexistence (tarea 1.4.8).
- Envío (`wa.message.send` → `lib/whatsapp/send.ts`): `queueOutbound` inserta el mensaje
  `OUT`/`QUEUED` sin `wamid` y el job lo entrega con un candado por conversación, revisando
  justo antes de llamar a Meta que el estado no haya cambiado y que la ventana de 24 h siga
  abierta (solo las plantillas aprobadas salen fuera de ella). Guarda `wamid` + `SENT`, aplica
  los estados que llegaron antes y marca `FAILED` con el código de Meta si el error es
  permanente. Entrega como máximo una vez: `sendAttemptedAt` se confirma en su propia
  conexión ANTES de llamar a Meta y el `wamid` se guarda justo después; una fila con intento
  pero sin `wamid` (caída tras aceptar Meta, error ambiguo como timeout/red/5xx sin código)
  queda `FAILED` con `UNKNOWN_DELIVERY` y nunca se reenvía sola (revisar el chat antes de
  reenviar a mano; el reenvío manual de PR2.3 debe limpiar `sendAttemptedAt`). Solo un
  rechazo definitivo (429 o respuesta con código de Meta) limpia la marca y deja reintentar.
  El cliente Graph (`cloud-api.ts`) usa `WHATSAPP_GRAPH_VERSION` (p. ej. `v25.0`).
  Un evento ya marcado como procesado por un despliegue anterior se reencola con
  `UPDATE whatsapp_webhook_events SET "processedAt" = NULL, attempts = 0 WHERE kind = 'ECHO'`.
  El barrendero ignora eventos con 12 o más intentos (los registra como conteo); siguen
  guardados para reprocesarlos a mano. Cada minuto también crea los leads que fallaron tras
  guardarse el mensaje (contacto sin cliente, con conversación y sin lead): cada fallo suma
  `leadRecoveryAttempts`, se reintenta tras 15 min y como máximo 5 veces (un contacto que
  falla siempre no bloquea el lote de 50). Un lead eliminado a propósito se borra con
  `removeLead` (marca `leadSuppressed`) para que ni el barrido ni un mensaje nuevo lo
  recreen; un lead `DISCARDED` conserva su fila y tampoco se recrea.

- Medios (`wa.media.download` → `lib/whatsapp/media.ts`): cada intento pide a Meta una URL
  nueva por id (la URL firmada caduca), descarga con el token (nunca se guarda ni se loguea),
  verifica sha256 y sube a R2 en `whatsapp/{conversationId}/{messageId}/{mediaId}.{ext}`
  (límite `WHATSAPP_MEDIA_MAX_BYTES`, 25 MB por defecto). Estados: `STORED`, `TOO_LARGE`,
  `UNSUPPORTED` (solo tipos activos como HTML/SVG, que no se guardan; video y similares sí se
  guardan) y `FAILED` tras agotar reintentos; el mensaje siempre sigue visible. Solo se
  procesa una fila `PENDING`, así que un reintento nunca duplica el objeto. La acción
  `getMediaUrl` (`lib/actions/whatsapp.actions.ts`, solo MANAGER/SUPER_ADMIN) devuelve una URL
  prefirmada de 10 min; la clave de R2 nunca sale del servidor. `lib/whatsapp/log.ts`
  (`safeLog`, `maskPhone`) es el único camino para loguear: enmascara teléfonos a los últimos
  4 dígitos y redacta cuerpos, transcripciones, tokens y URLs.

Verificación local (con `WHATSAPP_APP_SECRET=secret` y `WHATSAPP_VERIFY_TOKEN=token`
en `.env.local`):

```bash
# GET: debe imprimir 12345
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=token&hub.challenge=12345"

# POST firmado: 200
BODY='{"object":"whatsapp_business_account","entry":[]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac secret | sed 's/^.* //')"
curl -i -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "content-type: application/json" -H "x-hub-signature-256: $SIG" -d "$BODY"

# Firma incorrecta: 401
curl -i -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "x-hub-signature-256: sha256=00" -d "$BODY"
```

### Estados de la conversación

Una conversación por contacto (`contactId` único); se reabre, nunca se duplica.
Estados: `AI`, `HUMAN`, `ESCALATED`, `CLOSED`. La lógica pura vive en
`lib/whatsapp/state-machine.ts` y se aplica con `applyTransition`
(`lib/whatsapp/transitions.ts`).

| Desde | Evento | Hacia | Notas |
|-------|--------|-------|-------|
| (ninguno) | `INBOUND` | `AI` si la IA está efectiva, si no `HUMAN` | primer contacto |
| (ninguno) | `HUMAN_ECHO` | `HUMAN` | una persona escribió primero desde el teléfono |
| `CLOSED` | `INBOUND` | `AI` o `HUMAN` | reapertura automática; el mensaje se guarda |
| `AI` | `INBOUND` | `AI` | agenda turno de IA solo si está efectiva |
| `HUMAN` | `INBOUND` | `HUMAN` | |
| `ESCALATED` | `INBOUND` | `ESCALATED` | la IA no responde; un aviso `NEW_ACTIVITY_ON_ESCALATED` |
| `AI`, `ESCALATED` | `HUMAN_ECHO` | `HUMAN` | eco del teléfono (regla CH-9) |
| `AI`, `ESCALATED` | `DASHBOARD_REPLY` | `HUMAN` | atómico con el envío |
| `AI`, `ESCALATED` | `TAKE` ("Atender") | `HUMAN` | toma manual |
| `AI` | `AI_ESCALATE` | `ESCALATED` | único evento que puede originar la IA |
| `HUMAN` | `RETURN_TO_AI` | `AI` | solo manual, registra quién; mueve `aiCursorAt` |
| `AI`, `HUMAN`, `ESCALATED` | `CLOSE` | `CLOSED` | manual |
| `CLOSED` | `REOPEN` (destino `AI` o `HUMAN`) | destino | manual |

- Todo lo demás se rechaza. `ESCALATED` nunca pasa directo a `AI` (primero `HUMAN`); la IA
  nunca saca una conversación de `HUMAN` o `CLOSED`. `HUMAN` no tiene timeout por inactividad.
- Cada cambio usa `updateMany where { id, stateVersion }` con incremento de versión y un
  reintento; escribe un `ConversationEvent` (de, a, evento, actor, usuario, motivo). Dos
  transiciones simultáneas terminan en un solo estado con auditoría consistente.
- `aiPaused` (`setConversationAiPaused`) es ortogonal al estado: no cambia `status` ni
  `stateVersion`, se audita como `AI_PAUSED` / `AI_RESUMED`. Una conversación `AI` pausada
  no agenda turnos y se comporta como `HUMAN` para las respuestas.
- IA efectiva = `WHATSAPP_AI_ENABLED` y `WhatsAppSettings.aiEnabled` y no `aiPaused`.
- El puerto de transición del eco (`transition-port.ts`) se reemplaza por la máquina real
  al registrar los workers (`setApplyTransitionPort`).
- Las acciones de servidor para tomar, devolver a IA, cerrar y reabrir se publican en
  el PR de acciones de cabecera (2.4) y deberán llamar a `requireWhatsAppAuth()`.
- Notificaciones: ver la sección siguiente.

### Notificaciones de WhatsApp (solo en la app, sin email)

- `lib/notifications/notify.ts` implementa `NotifyPort` y se registra en `registerWhatsAppWorkers`
  (`setNotifyPort`). Destinatarios: usuarios activos con `canAccessWhatsApp` más todos los
  SUPER_ADMIN activos (no todos los MANAGER).
- Tabla `notifications` (RLS activo): tipo + ids; el título, el texto y el enlace se derivan al
  leer (`lib/notifications/present.ts`), así que no se guarda contenido de mensajes ni teléfonos.
- Dedup: `@@unique([userId, dedupKey])` + `skipDuplicates`. Al leer se limpia `dedupKey`, por
  eso hay a lo sumo una notificación SIN LEER por conversación y usuario para los tipos de
  actividad. Tipos: `ESCALATION`, `NEW_LEAD`, `NEW_ACTIVITY_ON_ESCALATED`, `AI_FAILURE`,
  `DRAFT_PENDING_REVIEW`.
- Acciones (`lib/actions/notification.actions.ts`): contar, listar, marcar una / todas /
  por conversación como leídas. Todas llaman a `requireWhatsAppAuth()` y filtran por el
  usuario de la sesión.
- Cabecera: icono de WhatsApp arriba a la derecha (`components/dashboard/notifications/`),
  visible solo con acceso a WhatsApp. Contador, pulso mientras haya sin leer (respeta
  `prefers-reduced-motion`), polling cada ~4 s.
- Sonido: tono Web Audio, desbloqueado con el primer clic; interruptor de silencio por usuario
  en `localStorage`. Suena solo si aparece un id nuevo o sube el contador
  (`lib/notifications/poll-diff.ts`), nunca en el primer poll.
- Notificaciones del navegador: botón "Activar notificaciones del navegador" (gesto del usuario,
  nunca al cargar). `tag` = conversación; al hacer clic se enfoca la pestaña y se abre el enlace.
  Con el navegador cerrado haría falta Web Push (service worker + VAPID): fuera de alcance.

### Bandeja de WhatsApp (`/dashboard/whatsapp`)

- Página server (`app/dashboard/whatsapp/page.tsx`) con Suspense + esqueleto; carga la primera
  página con `listConversations` y la pasa a `InboxContainer` (cliente, estado + polling). La
  lista, el hilo, las burbujas y el visor de medios son presentacionales.
- Acciones (`lib/actions/whatsapp.actions.ts`, todas con `requireWhatsAppAuth()` y Zod):
  `listConversations` (ESCALATED primero por `attentionDueAt` asc, luego `lastMessageAt` desc;
  `cursor` pagina solo las no escaladas), `getConversationThread` (últimos N mensajes, `before`
  para historial), `getUpdates` (cambios desde `updatedSince` por `updatedAt`, con 5 s de solape;
  si llega al tope devuelve `truncated` y el cliente recarga) y `markConversationRead`.
- La selección vive en la URL (`?c=<id>`, el mismo enlace de la campana). Abrir un hilo llama a
  `markConversationNotificationsRead` y `markConversationRead` (único write de esta etapa:
  solo `unreadCount`). Tomar, devolver, pausar, cerrar y leads: ver «Atención y leads». El historial usa un cursor
  compuesto `(timestamp, id)` (`before: { timestamp, id }`) porque varios mensajes pueden
  compartir el mismo timestamp.
- Lógica pura y probada en `lib/whatsapp/inbox.ts` (orden, marcadores, "Atender: lun 8:00",
  ventana de 24 h, previews, merges). Polling cada 4 s, solo con la pestaña visible.
- Medios: solo por `getMediaUrl` (URL firmada de 10 min, pedida cuando el adjunto es visible);
  nunca se expone la clave de R2.
- Datos de prueba locales: `pnpm seed:whatsapp-dev` (solo base local, ver el script).
- Insignia en el menú lateral ("WhatsApp"): `WhatsAppSidebarBadge` reutiliza
  `getUnreadNotificationCount` (cada 15 s, solo con la pestaña visible y solo si el usuario ve la
  entrada).

#### Búsqueda, avatares y ticks (UX de la bandeja)

- Búsqueda: `listConversations({ q })` resuelve los ids con una consulta SQL parametrizada
  (`Prisma.sql`, `lib/whatsapp/search.ts`) sobre el nombre del cliente, el nombre de perfil de
  WhatsApp y los dígitos del teléfono (solo si el texto parece un teléfono), y usa esos ids en las
  consultas existentes junto con el filtro de estado. Cliente con debounce de 300 ms. Con búsqueda
  activa el polling solo actualiza filas ya mostradas y relanza la consulta en silencio si aparece
  una conversación desconocida.
- Acentos y mayúsculas: sin extensión ni migración, con `lower(translate(col, ACCENT_FROM,
  ACCENT_TO))` de Postgres; el texto buscado se normaliza igual en TS (`normalizeSearchText`) y un
  test mantiene ambos mapas sincronizados. "jose" encuentra "José" y viceversa. Los `%`, `_` y `!`
  del usuario se escapan (`LIKE ... ESCAPE '!'`) y el texto viaja solo como parámetro. Tope de 1000
  ids por búsqueda. Letras fuera del mapa (p. ej. "ã") se comparan tal cual.
- Avatar: sin foto (la Cloud API no la entrega), iniciales de hasta 2 palabras sobre un color
  determinista según el id de la conversación; sin letras en el nombre (solo teléfono) se muestra un
  icono genérico (`lib/whatsapp/avatar.ts`).
- Ticks en burbujas salientes (`lib/whatsapp/delivery-ticks.ts`): QUEUED reloj, SENT un check gris,
  DELIVERED doble check gris, READ doble check azul, FAILED alerta roja (con "Reintentar"); el texto
  del estado queda como `aria-label` y `title`.

#### Responder (compositor)

- Acciones (`requireWhatsAppAuth()` + Zod): `sendReply`, `sendTemplate`, `resendFailedMessage`.
  Los adjuntos van por `POST /api/whatsapp/messages/media` (las Server Actions limitan el cuerpo a
  1 MB); misma autorización y el mismo servicio (`lib/whatsapp/outbound.ts`).
- Un envío desde el panel aplica `DASHBOARD_REPLY` (la conversación pasa a HUMAN) y crea la fila
  del outbox en **una sola transacción**; el job se encola después del commit con el
  `stateVersion` resultante (`expectedStateVersion`), así un cierre o una devolución a la IA
  posterior cancela el mensaje en vez de entregarlo. Una conversación CLOSED rechaza la respuesta
  ("Reábrala antes de responder").
- Ventana de 24 h: con la ventana cerrada solo se envían plantillas aprobadas
  (`WHATSAPP_APPROVED_TEMPLATES` + nombre configurado). Se valida en el servidor
  (`lib/whatsapp/composer.ts`, las mismas funciones del compositor) y otra vez en el job.
- Adjuntos: JPG/PNG (máx. 5 MB, el tope de Meta para imágenes) y PDF (máx. 10 MB), solo dentro de
  la ventana. Se comprueba el tipo declarado, la firma del archivo y la misma lista de bloqueo
  que los medios entrantes (`lib/whatsapp/mime.ts`). Se suben a R2 y el job los lee de R2 antes de
  marcar `sendAttemptedAt`.
- Reintento: solo mensajes FAILED enviados desde el panel (no IA ni sistema). Devuelve la misma
  fila a QUEUED, limpia `sendAttemptedAt` y el wamid anterior y suma `resendCount`. Un mensaje
  `UNKNOWN_DELIVERY` pudo haberse entregado: la UI pide confirmación y el servidor exige
  `confirmUnknownDelivery`.
- Con `WHATSAPP_ENABLED` apagado enviar falla con un mensaje claro y no escribe nada (`getBoss()`
  lanza en ese caso).
- El gancho `onSent` puede ejecutarse más de una vez para el mismo mensaje: debe ser idempotente.

#### Atención y leads (PR2.4)

- Acciones del encabezado (`requireWhatsAppAuth()` + Zod, todas devuelven el resumen fresco de la
  conversación para mostrarlo sin esperar al polling): `takeConversation` ("Atender", desde AI o
  ESCALATED), `returnToAi` (solo desde HUMAN; audita quién la devolvió y fija `aiCursorAt`),
  `closeConversation` (motivo opcional, máx. 300), `reopenConversation({ target: 'AI' | 'HUMAN' })` y
  `setConversationAiPaused` (no cambia el estado). Qué botones se muestran sale de
  `lib/whatsapp/handoff.ts`, que replica la máquina de estados; el servidor decide igual.
- Contacto: `linkContactToClient` (vínculo MANUAL y bloqueado, solo clientes activos no
  eliminados; el lead pasa a CONVERTED), `unlinkContactFromClient` (UNMATCHED bloqueado; un lead
  CONVERTED vuelve a NEW o se crea uno) y `confirmContactAsUnknown` (número AMBIGUOUS que no es de
  nadie: crea el lead). Desvincular y confirmar levantan una eliminación previa del lead
  (`leadSuppressed`). Como no tocan la fila de la conversación, la acción actualiza su `updatedAt`
  para que los marcadores se refresquen en todos los navegadores. El buscador del diálogo
  "Vincular" es `searchClientsForLink` (nombre sin acentos, documento o dígitos del teléfono; 10
  resultados).
- Leads (`/dashboard/whatsapp/leads`, misma protección que la bandeja; `lib/actions/lead.actions.ts`):
  `listLeads` (filtro por estado y búsqueda), `updateLead` (nombre, documento, correo, notas),
  `setLeadStatus` (NEW, CONTACTED, DISCARDED; nunca CONVERTED, y un lead convertido solo se revierte
  desvinculando el contacto), `convertLead` y `deleteLead` (usa `removeLead`, así el lead no se
  recrea aunque la persona vuelva a escribir).
- Vinculación automática (PR1.6): `createClient` (también al crear empleados) y `updateClient`
  cuando cambia el teléfono llaman a `autoLinkContactsForClient` (`lib/whatsapp/contacts.ts`). Busca
  contactos sin cliente y no bloqueados cuyo `waId` sea ese teléfono (con o sin el 57) y les aplica
  `matchClient`, la misma regla del inbound: un solo cliente vincula como MATCHED y convierte el lead;
  varios clientes marcan AMBIGUOUS. Es de mejor esfuerzo: un fallo se registra y nunca rompe la
  acción del cliente. Reactivar un cliente no lo dispara.
- Convertir: abre el formulario normal de cliente prellenado (`leadToClientDefaults`, teléfono en
  formato `+57 3001234567`); al crear el cliente se llama `convertLead({ leadId, clientId })`, que
  vincula el contacto y marca el lead CONVERTED.
- Límites de cuerpo: el webhook y `POST /api/whatsapp/messages/media` leen el cuerpo con
  `readCappedBody` (`lib/utils/read-capped-body.ts`), que corta también los envíos chunked sin
  Content-Length. Cada firma inválida del webhook deja un `console.warn` con el motivo
  (`missing header` / `mismatch`) y un contador por proceso, nunca el cuerpo ni la firma.

---

## Módulo de Finanzas (integración con Alegra)

Lee **[`docs/plans/2026-06-28-alegra-finances-design.md`](../plans/2026-06-28-alegra-finances-design.md)** para el diseño completo de V1. Acá el resumen ejecutivo de los patrones que aplican a este módulo.

### Qué es

Vista read-only del dashboard que consume la API REST de Alegra (sistema contable externo usado por Administración Segura). En V1 **solo expone Facturas de venta**; quotes/bills/payments se difieren a V2. **No guarda datos en nuestra DB** — cada vista llama a Alegra on-demand.

### Stack y variables de entorno

```bash
# .env / .env.example
ALEGRA_EMAIL="<service-user-email>"   # usuario dedicado en Alegra, NO el admin humano
ALEGRA_TOKEN="<api-token>"             # generado en Alegra → Configuración → API
```

- **Auth**: HTTP Basic con `email:token` (sin OAuth, sin refresh). El token es estático y se rota manualmente.
- **NO hay sandbox**: cualquier request contra Alegra toca producción. Usar una empresa de prueba en Alegra durante desarrollo.
- **Rate limit**: 150 req/min POR USUARIO. Si la empresa tiene admins activos navegando Alegra web, compartirán el budget. **Solución**: crear service user dedicado y usar SUS credenciales.

### Ubicación de archivos

```
lib/alegra/
├── client.ts          # Singleton HTTP client (server-only)
├── types.ts           # Zod schemas (Invoice, Company, etc.)
├── errors.ts          # AlegraError / AuthError / RateLimitError / ValidationError
├── transformers.ts    # Helpers puros: formatCurrency, parseAlegraDateTime, daysOverdue, computeAgingBucket
└── __tests__/         # Vitest unit tests (~120 casos)

app/dashboard/finances/
├── layout.tsx                       # Sidebar entry point, header
├── page.tsx                         # Home con 4 KPI cards
└── invoices/
    ├── page.tsx                     # Lista con filtros URL-driven
    └── [id]/page.tsx                # Detalle de factura

components/dashboard/finances/       # 7 componentes (kpi-cards, filters, table, detail-*)

docs/runbooks/alegra-credentials.md # Cómo rotar token, qué hacer si Alegra cambia API
```

### Patrones obligatorios (difieren del resto del dashboard)

#### 1. Sin DB — todo on-demand

```typescript
// ✅ CORRECTO — Server Component llama directo
export default async function InvoicesPage({ searchParams }) {
  const client = getAlegraClient()                        // singleton server-only
  const { data, total } = await client.listInvoices({    // fetch a Alegra
    status: searchParams.status,
    metadata: true,                                       // para tener total
  })
  return <InvoiceTable invoices={data} total={total} />
}
```

NO crear modelos Prisma para datos de Alegra. NO cachear. NO sincronizar. YAGNI.

#### 2. Singleton + lazy construction

```typescript
// lib/alegra/client.ts
let _client: AlegraClient | null = null
export function getAlegraClient(): AlegraClient {
  if (!_client) _client = new AlegraClient()  // valida env vars en este momento
  return _client
}
```

- Cada proceso Node tiene su propio singleton (en Vercel/Serverless cada función cold-start crea uno nuevo).
- Validación de env vars lazy: la página no se rompe si las env vars no están en build time (solo en request time).
- **NO usar `import 'server-only'`** — no es convención del proyecto.

#### 3. Rate limit awareness

```typescript
// El cliente lee X-Rate-Limit-* en cada respuesta.
// Si remaining <= 5, espera hasta X-Rate-Limit-Reset antes del próximo request.
private async waitForRateLimit() {
  if (this.rateLimit.remaining > 5) return     // safety threshold = 5
  await sleep(this.rateLimit.resetAt - now)
}
```

- Hacer **4 requests en paralelo** con `Promise.all` está OK (queda 146/150 worst case).
- NO hacer 50+ requests en paralelo (explotaría el rate limit).
- 429 → `RateLimitError` con `resetAt`. Caller puede reintentar.

#### 4. Zod schemas con normalización de campos raros

La API de Alegra tiene campos con shapes inconsistentes. Normalizar en el schema:

```typescript
// numberTemplate: object | array (datos legacy) → siempre object
NumberTemplateSchema = z.union([objectSchema, z.array(objectSchema)])
  .transform((v) => Array.isArray(v) ? v[0] ?? null : v)

// amount en payments: number | string → siempre number
InvoicePaymentSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform(Number),
})

// IDs: SIEMPRE string (post-Jan 2025 — UUIDs o legacy int-as-string)
id: z.string()
```

**Pitfall conocido** (ver `git log 248176d`): cuando hacés `z.union([a, b]).transform(fn)`, el transform DEBE reshape-ambos lados. Si solo normalizás uno, el otro se filtra sin cambios y los consumers ven `undefined` donde esperan un valor.

#### 5. Errores tipados

```typescript
import { AlegraError, AuthError, RateLimitError, ValidationError } from '@/lib/alegra/errors'

try {
  await client.listInvoices(...)
} catch (err) {
  if (err instanceof AuthError)         show 'Token inválido — contactar al admin'
  else if (err instanceof RateLimitError) show 'Alegra saturado, reintentando...'
  else if (err instanceof ValidationError) show 'Alegra cambió su API — reportar al equipo'
  else                                  show 'Error de conexión con Alegra'
}
```

#### 6. UI patterns

- **Filtros URL-driven**: `?status=open&date_from=...&page=2`. Server Component lee `searchParams` directo (compartible, back/forward funciona).
- **Paginación server-side**: `start=0,30,60,...` con `metadata.total`. **Max 30 por página** (hard cap de Alegra — `limit=31` devuelve 400/code 903).
- **TanStack table** para listas (mismo patrón que `/dashboard/affiliations/my-assignments`).
- **Currency**: `Intl.NumberFormat('es-CO', { currency: company.currency.code })` donde `currency.code` viene de `/company`. Cachear el formatter por código.
- **DIAN events** (Colombia-only): vienen en `events[]` con formato de fecha inconsistente. Usar `parseAlegraDateTime()` del transformers (NO en el schema, perderíamos el formato original).

### Sidebar y RBAC

El módulo aparece en el sidebar como **"Finanzas"** → expande a "Resumen" (`/dashboard/finances`) + "Facturas" (`/dashboard/finances/invoices`). Visible para `SUPER_ADMIN` y `MANAGER` (todos los roles, decisión de V1).

### Out of scope (V2+)

Webhooks, cache/sync a nuestra DB, write operations (crear/editar facturas desde el dashboard), reports/charts, aging buckets visuales, PDF/XML export, audit log, multi-currency más allá de display formatting, cross-linking con nuestros `Client`.

### Smoke test

Antes de mergear, validar manualmente contra el integration test company de Alegra:

1. Abrir `/dashboard/finances` → verificar que las 4 KPI cards muestran números coherentes
2. Abrir `/dashboard/finances/invoices` → verificar lista con paginación
3. Aplicar filtros (status, date range, client search) → verificar que la URL refleja los filtros y la lista se actualiza
4. Click en una factura → verificar detalle (totales correctos, items, payments, eventos DIAN)
5. Probar edge cases: 0 facturas, factura con pagos parciales, factura con evento DIAN rechazado

---

## Troubleshooting

**"useRouter not defined"**
```typescript
import { useRouter } from 'next/navigation'  // ✅ App Router
import { useRouter } from 'next/router'  // ❌ Pages Router
```

**"Prisma Client not found"**
```bash
npx prisma generate
```

**"AUTH_SECRET not found"**
```bash
openssl rand -base64 32  # Generar
# Agregar a .env
```

**"Hydration error"**
```typescript
// Usar Client Component o dynamic import
import dynamic from 'next/dynamic'
const C = dynamic(() => import('./C'), { ssr: false })
```

---

## Resumen de Principios

### SIEMPRE ✅
- Server Components por defecto
- Validar client Y server
- RBAC en backend
- TypeScript strict
- Skeleton loaders
- Mensajes en español
- Optimistic updates
- Soft delete (isActive)
- Prisma singleton
- @ alias imports
- ActionResponse tipado
- Hash passwords

### NUNCA ❌
- API routes (usar Server Actions)
- Prisma en componentes
- Validar solo frontend
- Hard delete usuarios
- Stores globales Zustand
- router.refresh() innecesario
- múltiples PrismaClient
- Passwords plain text
- Imports relativos largos
- Solo UI para seguridad

---

**Última actualización**: 2025-11-02
**Autor**: Dashboard Team

Documento completo detallado disponible para consulta exhaustiva.
