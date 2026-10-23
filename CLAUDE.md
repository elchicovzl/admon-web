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

### Variables de entorno del módulo

Se validan **al arrancar el servidor** (`instrumentation.ts` → `lib/config/runtime-config.ts`), nunca al importar ni durante `next build` (el build corre sin secretos). Si `WHATSAPP_ENABLED=true` y falta alguna variable de Meta, el servidor aborta el arranque con un único error que lista todas las faltantes. Con los flags apagados no se exige nada.

| Variable | Default | Requerida cuando |
|----------|---------|------------------|
| `WHATSAPP_ENABLED`, `WHATSAPP_AI_ENABLED`, `WHATSAPP_AI_DRAFTS_ENABLED` | `false` | — |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_GRAPH_VERSION` | — | `WHATSAPP_ENABLED=true` |
| `WHATSAPP_TEMPLATE_RESUME`, `WHATSAPP_TEMPLATE_PROCESS_UPDATE`, `WHATSAPP_APPROVED_TEMPLATES` (CSV) | vacío | opcional (se conocen tras aprobar plantillas en Meta) |
| `WHATSAPP_TEMPLATE_LANG` | `es` | — |
| `ANTHROPIC_API_KEY`, `AI_CHAT_MODEL`, `OPENAI_API_KEY` | — | `WHATSAPP_AI_ENABLED=true` |
| `AI_EMBEDDING_MODEL` / `AI_EMBEDDING_DIMENSIONS` / `AI_STT_MODEL` | `text-embedding-3-small` / `1536` / `gpt-4o-mini-transcribe` | — |
| `AI_MIN_SIMILARITY`, `AI_DEBOUNCE_SECONDS`, `AI_DEBOUNCE_MAX_SECONDS`, `AI_MAX_STEPS`, `AI_MAX_TURNS_PER_DAY`, `AI_MAX_CONSECUTIVE_FAILURES`, `AI_MAX_REPLY_AGE_MINUTES` | `0.35`, `8`, `30`, `4`, `30`, `2`, `15` | — |
| `AI_FORBIDDEN_TOPICS` (lista separada por `\|`) | vacío | — |
| `WHATSAPP_MEDIA_MAX_BYTES`, `AI_STT_MAX_SECONDS`, `KB_UPLOAD_MAX_BYTES` | `26214400`, `600`, `15728640` | — |
| `WHATSAPP_RETENTION_DAYS`, `WHATSAPP_WEBHOOK_EVENT_RETENTION_DAYS`, `WHATSAPP_HONOR_HOLIDAYS` | `365`, `30`, `false` | — |
| `WORKER_ENABLED` | `true` | — |
| `QUEUE_DATABASE_URL` | cae a `DIRECT_URL` | — |

`AI_MAX_TURNS_PER_DAY`, `AI_MAX_CONSECUTIVE_FAILURES` y `AI_FORBIDDEN_TOPICS` son los valores por defecto: un SUPER_ADMIN puede cambiarlos (y fijar un tope de gasto diario en USD) en Configuración → WhatsApp sin redeploy.

IA (`lib/ai/providers.ts`, AI SDK v7): Claude vía `@ai-sdk/anthropic` para conversación y visión; OpenAI vía `@ai-sdk/openai` para embeddings y transcripción. Nada se lee al importar. Valor recomendado para `AI_CHAT_MODEL`: `claude-opus-5-5`. `AI_EMBEDDING_DIMENSIONS` debe ser `1536` (tamaño de la columna `knowledge_chunks.embedding`). La ingesta de la base de conocimiento solo necesita `OPENAI_API_KEY`.

Base de conocimiento: migración `knowledge_base` con índices crudos (HNSW coseno sobre `embedding`, GIN `spanish` sobre `content`) y RLS. Prisma no puede expresar el HNSW y `migrate dev` lo reporta como drift proponiendo `DROP INDEX knowledge_chunks_embedding_hnsw`: **no aceptar ese drop**; `lib/__tests__/migration-guard.test.ts` falla si una migración posterior lo borra.

Documentos de identidad (`lib/whatsapp/identity-document.ts`): si el cliente manda foto de cédula o RUT, la IA llama `recordIdentityDocument` y, solo después de confirmar el turno, se aplica: un contacto **Ambiguo** se vincula al único cliente con ese teléfono y ese número (cédula o NIT, sin importar puntos ni dígito de verificación); si no hay uno solo, o el contacto no tiene cliente, los datos van a los campos vacíos del lead y a `notes` con la marca "Extraído por IA … Pendiente de verificar". Nunca edita un cliente.

Retención (`lib/retention/purge.ts`, cola `retention.purge`, todos los días 03:00 Bogotá): una conversación sin mensajes hace `WHATSAPP_RETENTION_DAYS` días se borra con sus mensajes, adjuntos y eventos. Primero se borran sus archivos en R2; si alguno falla, la conversación se conserva y se reintenta la noche siguiente. Se conservan el contacto (y su vínculo al cliente), el lead y los registros de uso de IA (pierden la referencia a la conversación). Los eventos crudos del webhook ya procesados se borran a los `WHATSAPP_WEBHOOK_EVENT_RETENTION_DAYS` días. Máximo 1000 conversaciones por noche.

Cola (`lib/queue/`): con `WHATSAPP_ENABLED` distinto de `true` el arranque es un no-op total (no valida config, no conecta, no crea el schema `pgboss` ni colas). Con `true`, pg-boss crea el schema `pgboss` en la base al arrancar el servidor (necesita permisos DDL con `DIRECT_URL`) y cualquier fallo de config o de la cola aborta el arranque. Topología y reintentos en `lib/queue/queues.ts`; los jobs agotados van a la cola `wa.dead`. Los handlers se registran con `registerWorker` en `lib/queue/workers.ts`.

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
