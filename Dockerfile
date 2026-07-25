# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# BASE — Debian slim (NO Alpine).
# ¿Por qué Debian? Tu schema.prisma no define binaryTargets, así que
# Prisma usa el engine "nativo". En Debian el nativo es debian-openssl-3.0.x,
# y construimos + corremos en Debian → el engine matchea. Con Alpine (musl)
# tendrías que agregar binaryTargets o explota en runtime. No lo compliques.
# openssl + ca-certificates: Prisma los necesita sí o sí.
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ─────────────────────────────────────────────────────────────
# DEPS — instala TODAS las deps (incluidas dev: prisma, next, etc.
# se necesitan para buildear). Cacheable: solo se reinstala si cambian
# package.json o pnpm-lock.yaml.
# ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────
# BUILDER — acá corre "prisma generate && next build".
# ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* se HORNEAN en el bundle en build-time (no son runtime).
# Llegan como build-args desde GitHub Actions.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_HOTJAR_ID
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_HOTJAR_ID=$NEXT_PUBLIC_HOTJAR_ID

# Placeholder para que Prisma Client instancie durante el build.
# El build NO se conecta a la DB (las rutas son dinámicas). La URL REAL
# va en runtime, como env de Dokploy — nunca dentro de la imagen.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/placeholder" \
    DIRECT_URL="postgresql://build:build@localhost:5432/placeholder" \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ─────────────────────────────────────────────────────────────
# RUNNER — imagen final, mínima. Solo el standalone + static + public.
# Corre como usuario no-root (seguridad).
# ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# El tracing de "output: standalone" ya incluye el Prisma Client + engine.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
