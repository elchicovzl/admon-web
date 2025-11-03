# Dashboard de Administración - Admon Web

Sistema de dashboard completo con autenticación, roles (Super Admin y Manager), PostgreSQL y las mejores prácticas de Next.js 15.

## 🚀 Tecnologías Implementadas

### Core Stack
- **Next.js 15.2.4** - Framework React con App Router
- **TypeScript 5** - Tipado estático
- **PostgreSQL** - Base de datos relacional
- **Prisma ORM** - ORM type-safe para PostgreSQL

### Autenticación & Seguridad
- **NextAuth v5 (Auth.js)** - Autenticación completa
- **bcryptjs** - Hash de contraseñas
- **RBAC Middleware** - Control de acceso basado en roles
- **JWT Sessions** - Sesiones seguras

### UI & Forms
- **shadcn/ui** - Sistema de componentes basado en Radix UI
- **Tailwind CSS 4** - Estilos utility-first
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas
- **Sonner** - Notificaciones toast

### Estado Global
- **Zustand** - Estado client-side con pattern Context Provider
- **Server Components** - Estado server-side

## 📁 Arquitectura del Proyecto

```
app/
├── api/
│   └── auth/[...nextauth]/route.ts    # NextAuth API route
├── dashboard/                          # Rutas protegidas del dashboard
│   ├── layout.tsx                      # Layout con Sidebar + Header
│   ├── page.tsx                        # Dashboard principal
│   ├── users/                          # Gestión de usuarios (SUPER_ADMIN only)
│   │   └── page.tsx
│   └── settings/                       # Configuración del usuario
│       └── page.tsx
├── login/                              # Autenticación
│   └── page.tsx
├── layout.tsx                          # Root layout
└── middleware.ts                       # RBAC Middleware

lib/
├── actions/                            # Server Actions
│   ├── auth.actions.ts                 # Login, logout, register
│   ├── user.actions.ts                 # CRUD de usuarios
│   └── index.ts                        # Exports
├── auth/                               # Configuración de Auth
│   ├── auth.config.ts                  # NextAuth config
│   ├── auth.ts                         # NextAuth instance
│   └── rbac.ts                         # RBAC helpers
├── db/
│   └── prisma.ts                       # Prisma client singleton
├── stores/
│   └── use-dashboard-store.ts          # Zustand store
├── types/
│   └── auth.types.ts                   # TypeScript types
└── validations/                        # Zod schemas
    ├── auth.schema.ts
    └── user.schema.ts

components/
├── auth/
│   └── login-form.tsx                  # Formulario de login
├── dashboard/
│   ├── app-sidebar.tsx                 # Sidebar del dashboard
│   ├── dashboard-header.tsx            # Header con breadcrumbs
│   ├── create-user-form.tsx            # Formulario crear manager
│   └── users-table.tsx                 # Tabla de usuarios
├── providers/
│   └── dashboard-provider.tsx          # Zustand Context Provider
└── ui/                                 # shadcn/ui components

prisma/
├── schema.prisma                       # Database schema
├── seed.ts                             # Seed inicial
└── migrations/                         # Historial de migraciones
```

## 🗄️ Modelo de Datos

### User
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  password      String
  role          UserRole  @default(MANAGER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdById   String?   // Self-relation: quién creó este user

  // Relations
  createdBy     User?     @relation("UserCreatedBy")
  createdUsers  User[]    @relation("UserCreatedBy")
  accounts      Account[]
  sessions      Session[]
}

enum UserRole {
  SUPER_ADMIN
  MANAGER
}
```

### NextAuth Models
- **Account** - Cuentas OAuth (opcional)
- **Session** - Sesiones activas
- **VerificationToken** - Tokens de verificación

## 🔐 Sistema de Roles (RBAC)

### Super Admin
- **Acceso total** al sistema
- Puede crear, editar y eliminar **Managers**
- Acceso a `/dashboard/users`
- No puede ser eliminado por otros usuarios

### Manager
- Acceso limitado al dashboard
- **NO** puede crear otros usuarios
- **NO** puede acceder a gestión de usuarios
- Puede ver su configuración y dashboard principal

### Implementación
```typescript
// middleware.ts - Protección de rutas
const superAdminRoutes = ['/dashboard/users']
const protectedRoutes = ['/dashboard']

// lib/auth/rbac.ts - Helpers
await requireSuperAdmin()  // Lanza error si no es SUPER_ADMIN
await isSuperAdmin()       // Retorna boolean
```

## 🎯 Server Actions

### Auth Actions
```typescript
// lib/actions/auth.actions.ts
login(credentials)          // Login con credenciales
logout()                    // Cerrar sesión
register(data)              // Registrar usuario (con validación de roles)
getSession()                // Obtener sesión actual
changePassword(data)        // Cambiar contraseña
```

### User Actions
```typescript
// lib/actions/user.actions.ts
getUsers(role?)             // Obtener usuarios (opcional: filtrar por rol)
getUserById(id)             // Obtener usuario por ID
createManager(data)         // Crear manager (solo SUPER_ADMIN)
updateUser(id, data)        // Actualizar usuario (solo SUPER_ADMIN)
deleteUser(id)              // Eliminar usuario (solo SUPER_ADMIN)
getUsersCount()             // Estadísticas de usuarios
```

## 📝 Formularios con React Hook Form + Server Actions

### Patrón de Implementación
```typescript
// Client Component
'use client'

export function LoginForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),  // Validación client-side con Zod
  })

  async function onSubmit(data: LoginInput) {
    const result = await login(data)     // Server Action

    if (result.success) {
      toast.success(result.message)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return <Form {...form}>...</Form>
}
```

### Validaciones con Zod
```typescript
// lib/validations/auth.schema.ts
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
```

## 🏪 Estado Global con Zustand

### Pattern Context Provider (Next.js 15)
```typescript
// components/providers/dashboard-provider.tsx
export function DashboardProvider({ children }) {
  const storeRef = useRef()

  if (!storeRef.current) {
    storeRef.current = createDashboardStore()  // Solo crea una vez
  }

  return <Context.Provider value={storeRef.current}>...</Context.Provider>
}

// Uso en componentes
export function Component() {
  const sidebarOpen = useDashboard((state) => state.sidebarOpen)
  const toggleSidebar = useDashboard((state) => state.toggleSidebar)
}
```

## 🚦 Configuración e Instalación

### 1. Variables de Entorno
```bash
# Copia .env.example a .env
cp .env.example .env
```

Edita `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/admon_web?schema=public"
AUTH_SECRET="WsjZtvo0rY5XQPt+FPc365m54HrBfOvzNBCg+gbzphc="
AUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

### 2. Instalar Dependencias
```bash
pnpm install
```

### 3. Base de Datos

#### Crear Base de Datos PostgreSQL
```sql
CREATE DATABASE admon_web;
```

#### Ejecutar Migraciones
```bash
pnpm db:migrate
```

#### Seed de Datos Iniciales
```bash
pnpm db:seed
```

Esto creará:
- **Super Admin**: `admin@admon.com` / `admin123`
- **Manager**: `manager@admon.com` / `manager123`

### 4. Iniciar Servidor de Desarrollo
```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 📜 Scripts Disponibles

```json
{
  "dev": "next dev",                    // Servidor de desarrollo
  "build": "next build",                // Build de producción
  "start": "next start",                // Servidor de producción
  "lint": "next lint",                  // Linting
  "db:migrate": "prisma migrate dev",   // Crear/aplicar migraciones
  "db:push": "prisma db push",          // Push schema sin migración
  "db:seed": "tsx prisma/seed.ts",      // Seed de datos
  "db:studio": "prisma studio"          // UI de Prisma
}
```

## 🎨 Componentes UI (shadcn/ui)

### Componentes Utilizados
- **Sidebar** - Navegación lateral colapsable
- **Form** - Formularios con validación
- **Table** - Tablas de datos
- **Dialog** - Modales
- **AlertDialog** - Confirmaciones
- **DropdownMenu** - Menús desplegables
- **Avatar** - Avatares de usuario
- **Badge** - Etiquetas de estado
- **Card** - Tarjetas de contenido
- **Button** - Botones
- **Input** - Inputs de formulario
- **Breadcrumb** - Navegación de ruta

Todos los componentes están en `components/ui/` y son totalmente customizables.

## 🔒 Seguridad

### Implementaciones
✅ Hash de contraseñas con bcrypt (10 rounds)
✅ Sesiones JWT con expiración (30 días)
✅ CSRF protection (NextAuth built-in)
✅ SQL Injection protection (Prisma ORM)
✅ XSS protection (React built-in)
✅ RBAC en middleware y server actions
✅ HttpOnly cookies
✅ Validación client y server-side

### Middleware de Protección
```typescript
// middleware.ts
export default async function middleware(request) {
  const session = await auth()

  // Redirigir a login si no autenticado
  if (isProtectedRoute && !session) {
    return redirect('/login')
  }

  // Validar permisos de SUPER_ADMIN
  if (requiresSuperAdmin && session.user.role !== 'SUPER_ADMIN') {
    return redirect('/dashboard?error=unauthorized')
  }
}
```

## 📊 Flujo de Autenticación

```mermaid
graph TD
    A[Usuario visita /dashboard] --> B{¿Tiene sesión?}
    B -->|No| C[Middleware: redirect a /login]
    C --> D[LoginForm]
    D --> E[Server Action: login]
    E --> F[Validar con Zod]
    F --> G[Buscar user en DB]
    G --> H[Verificar password con bcrypt]
    H --> I[NextAuth crea sesión JWT]
    I --> J[Redirect a /dashboard]
    B -->|Sí| K{¿Requiere SUPER_ADMIN?}
    K -->|Sí| L{¿Es SUPER_ADMIN?}
    L -->|No| M[Redirect con error]
    L -->|Sí| N[Permitir acceso]
    K -->|No| N
```

## 🎯 Características Implementadas

### ✅ Autenticación
- [x] Login con email y contraseña
- [x] Logout
- [x] Sesiones persistentes (JWT)
- [x] Página de login con diseño profesional

### ✅ Autorización (RBAC)
- [x] Roles: SUPER_ADMIN y MANAGER
- [x] Middleware de protección de rutas
- [x] Helpers de verificación de roles
- [x] Control granular por página

### ✅ Gestión de Usuarios (SUPER_ADMIN)
- [x] Ver todos los usuarios
- [x] Crear managers
- [x] Eliminar managers
- [x] Prevención de auto-eliminación
- [x] Prevención de modificación de SUPER_ADMIN

### ✅ Dashboard
- [x] Estadísticas generales
- [x] Información del usuario actual
- [x] Tarjetas de métricas
- [x] Layout responsive

### ✅ UI/UX
- [x] Sidebar colapsable
- [x] Breadcrumbs de navegación
- [x] Modo responsive (mobile-friendly)
- [x] Notificaciones toast
- [x] Confirmaciones de acciones destructivas
- [x] Loading states
- [x] Error handling

## 🔄 Próximas Características

### Sugeridas para Implementar
- [ ] Cambiar contraseña
- [ ] Editar perfil de usuario
- [ ] Subir avatar de usuario
- [ ] Filtros y búsqueda en tabla de usuarios
- [ ] Paginación en tabla
- [ ] Roles adicionales personalizados
- [ ] Permisos granulares
- [ ] Logs de auditoría
- [ ] Exportar datos a CSV/Excel
- [ ] Modo oscuro / claro
- [ ] Internacionalización (i18n)
- [ ] Dashboard con gráficos (recharts)
- [ ] Notificaciones en tiempo real
- [ ] OAuth (Google, GitHub, etc.)

## 🐛 Troubleshooting

### Problema: Prisma no encuentra DATABASE_URL
**Solución**: Asegúrate de que `prisma.config.ts` tenga `import "dotenv/config"` al inicio.

### Problema: Error de migración
**Solución**:
```bash
# Reset de base de datos (⚠️ borra todos los datos)
npx prisma migrate reset

# O elimina manualmente las migraciones
rm -rf prisma/migrations
pnpm db:migrate
```

### Problema: NextAuth session undefined
**Solución**: Verifica que `AUTH_SECRET` esté configurado en `.env` y que el servidor se haya reiniciado.

### Problema: Middleware no protege rutas
**Solución**: Revisa que el `matcher` en `middleware.ts` incluya las rutas correctas.

## 📚 Recursos y Referencias

### Documentación Oficial
- [Next.js 15 Docs](https://nextjs.org/docs)
- [NextAuth v5 Docs](https://authjs.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Zustand](https://zustand.docs.pmnd.rs)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)

### Patrones de Diseño Aplicados
1. **Repository Pattern** - Abstracción de Prisma
2. **Service Layer** - Lógica de negocio en Server Actions
3. **DTO Pattern** - Zod schemas como DTOs
4. **Provider Pattern** - Zustand con Context
5. **Compound Component** - Componentes de UI composables
6. **Server-First** - Maximizar Server Components

## 👨‍💻 Desarrollo

### Convenciones de Código
- **Componentes Client**: Incluir `'use client'` al inicio
- **Server Actions**: Incluir `'use server'` al inicio
- **Nombres de archivos**: kebab-case para archivos, PascalCase para componentes
- **Imports**: Usar alias `@/*` para imports absolutos
- **Tipado**: TypeScript strict mode habilitado

### Testing (Próximamente)
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

## 📄 Licencia

Este proyecto es privado y confidencial.

---

**Desarrollado con ❤️ usando Next.js 15 y las mejores prácticas de 2025**
