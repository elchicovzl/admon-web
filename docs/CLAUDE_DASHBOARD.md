# CLAUDE - Dashboard Architecture & Patterns

**DOCUMENTACIÓN CRÍTICA**: Mantener estas convenciones para consistencia en todo el dashboard.

---

## Stack Tecnológico

- **Framework**: Next.js 15.2.4 (App Router, NO Pages Router)
- **Auth**: NextAuth v5 (Auth.js) - Variables: AUTH_SECRET, AUTH_URL
- **Database**: PostgreSQL + Prisma ORM 6.18.0
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
}
```

```typescript
// Regla de acceso: SUPER_ADMIN entra por rol; el resto, por flag explícito
session.user.role === UserRole.SUPER_ADMIN || user.canAccessControl
```

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
