# CLAUDE.md - Guía de Arquitectura del Proyecto

Este proyecto contiene dos módulos principales con arquitecturas diferentes:

---

## 📍 Estructura de Documentación

### 1. **Landing Page** (Módulo Original)
**Archivo**: [CLAUDE_LANDING.md](./CLAUDE_LANDING.md)

Documentación del sitio web original con:
- Landing page refactorizada
- Componentes de marketing
- SEO optimization
- Content management

**Stack**: Next.js 15 + Tailwind CSS + shadcn/ui

---

### 2. **Dashboard de Administración** (Nuevo Módulo) ⭐
**Archivo**: [CLAUDE_DASHBOARD.md](./CLAUDE_DASHBOARD.md)

**USAR ESTA GUÍA** para todo lo relacionado con el dashboard administrativo.

Documentación completa de:
- Autenticación (NextAuth v5)
- Sistema de roles (RBAC)
- Base de datos (PostgreSQL + Prisma)
- Server Actions pattern
- Gestión de usuarios
- Forms con React Hook Form + Zod

**Stack**: Next.js 15 + NextAuth v5 + PostgreSQL + Prisma + Zustand

---

## 🎯 ¿Qué Documentación Usar?

### Trabajando en el Dashboard (/dashboard/*)
➡️ **Usa [CLAUDE_DASHBOARD.md](./CLAUDE_DASHBOARD.md)**

Incluye:
- Patrones de diseño obligatorios
- Server Actions structure
- RBAC implementation
- Database patterns
- Forms & validation
- Security best practices

### Trabajando en el Landing (página principal)
➡️ **Usa [CLAUDE_LANDING.md](./CLAUDE_LANDING.md)**

Incluye:
- Componentes de marketing
- Sections y layouts
- SEO metadata
- Content structure

---

## 🚀 Quick Start

### Para Dashboard:
```bash
# 1. Levantar la base local (Postgres 18 + pgvector en Docker/Podman)
pnpm db:up

#    Si venías de la imagen vieja (Postgres 16), corré `pnpm db:nuke` UNA vez
#    antes: el volumen anterior no es compatible con Postgres 18.

# 2. Crear .env.local con la conexión local (ver abajo)

# 3. Migraciones + datos iniciales
pnpm db:migrate
pnpm db:seed

# 4. Start dev server
pnpm dev

# 5. Login
http://localhost:3000/login
admin@admon.com / admin123
```

**`.env.local`** (gitignored; pisa a `.env` tanto en Next.js como en Prisma):

```env
DATABASE_URL="postgresql://postgres:admon_local_dev@localhost:55432/admon"
DIRECT_URL="postgresql://postgres:admon_local_dev@localhost:55432/admon"
```

El resto de las variables (`AUTH_SECRET`, R2, Resend, Alegra…) se siguen
leyendo de `.env`. En `.env.local` va **solo lo que cambia en local**.

> **Producción vive en Dokploy** (proyecto `admon db` → `admonDB`) y no se
> toca desde el entorno de desarrollo. El `docker-compose.yml` de este repo es
> exclusivamente para local.

| Comando | Qué hace |
|---------|----------|
| `pnpm db:up` | Levanta la base local |
| `pnpm db:down` | La apaga (conserva los datos) |
| `pnpm db:nuke` | La apaga y **borra el volumen** — empezar de cero |
| `pnpm db:deploy` | Aplica migraciones sin generar una nueva (CI/prod) |

### Para Landing:
```bash
pnpm dev
http://localhost:3000/
```

---

## Módulo WhatsApp AI (en construcción)

Asistente de WhatsApp (Cloud API + Coexistence) con bandeja compartida, base de
conocimiento (pgvector) y respuestas con IA. Se entrega en PRs encadenados y
todo queda detrás de flags que **arrancan apagados**:

- `WHATSAPP_ENABLED=false`: el webhook verifica, guarda y responde 200, pero no procesa ni envía.
- `WHATSAPP_AI_ENABLED=false`: la IA no responde (los jobs encolados no hacen nada).
- Worker (pg-boss, mismo Postgres, schema `pgboss`): arranca desde `instrumentation.ts`; `WORKER_ENABLED=false` lo desactiva.
- Webhook: `app/api/whatsapp/webhook/route.ts`. Es la **excepción documentada** a "sin API routes" (llamador externo, firma HMAC sobre el body crudo).
- La imagen de Postgres requiere la extensión `vector` (ver Quick Start). En producción la migración `enable_pgvector` NO se corre hasta que Dokploy use la imagen pgvector.

---

## 📋 Comandos Comunes

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio

# Code Quality
pnpm lint             # Run linter
```

---

## 🔑 Variables de Entorno Requeridas

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Authentication
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
```

---

## 📚 Recursos Adicionales

- **Dashboard README Completo**: [DASHBOARD_README.md](./DASHBOARD_README.md)
- **Package Manager**: pnpm (requerido)
- **Node Version**: 18.0.0+

---

**Última actualización**: 2025-11-02

**Nota Importante**: Al trabajar en nuevas features del dashboard, SIEMPRE consultar [CLAUDE_DASHBOARD.md](./CLAUDE_DASHBOARD.md) para mantener consistencia en patrones, convenciones y arquitectura.
