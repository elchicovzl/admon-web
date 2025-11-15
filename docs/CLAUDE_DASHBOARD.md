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

### Protección de Rutas (middleware.ts)
```typescript
const protectedRoutes = ['/dashboard']
const superAdminRoutes = ['/dashboard/users']

// Flujo: Check auth → Check role → Allow/Deny
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
