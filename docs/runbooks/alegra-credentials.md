# Runbook — Credenciales de Alegra

Operación del token de la API de Alegra usado por el módulo de Finanzas del dashboard.

---

## Quick reference

| Campo | Valor |
|-------|-------|
| `ALEGRA_EMAIL` | Email del **service user** dedicado (NO del admin humano) |
| `ALEGRA_TOKEN` | Token API estático generado en Alegra |
| **Auth** | HTTP Basic con `email:token` (sin OAuth, sin refresh) |
| **Rate limit** | 150 req/min **por usuario** (compartido con todo el uso web del mismo user) |
| **Dónde viven** | `.env.local` (dev) + env vars de la plataforma (Vercel/Railway/etc. en prod) |
| **Rotation cadence** | Cada 90 días preventivamente + inmediato ante sospecha de compromiso |
| **Owner** | Super Admin del dashboard (actualmente vos) |

> ⚠️ **Por qué un service user dedicado (no el admin humano)**: cada llamada a la API consume del budget de rate limit de **ESE** usuario. Si usás el email del admin que también navega Alegra web todo el día, vas a estar peleando con su actividad por el límite. Un user dedicado aísla los dos consumos.

---

## Setup inicial (una sola vez por ambiente)

### 1. Crear el service user en Alegra

1. Logueado en Alegra como Super Admin de la organización → **Configuración → Usuarios**
2. Click **"Nuevo usuario"**
3. Llenar:
   - **Email**: `integration@<tu-dominio>` (ej: `integration@admon-segura.com`)
   - **Nombre**: `Integración Dashboard`
   - **Rol**: El mínimo posible. Si Alegra permite "Sólo lectura" / "Reports", usar eso. Si no, asignar permiso únicamente a las secciones necesarias (Contactos, Facturas, Productos, Impuestos — NO a Configuración).
4. Guardar y verificar que el email de invitación llegó.

### 2. Generar el token API

1. **Cerrar sesión** del admin y **loguearse como el service user** recién creado.
2. Ir a **Configuración → API - Integraciones con otros sistemas**.
3. Click **"Generar token"**.
4. **⚠️ El token se muestra UNA sola vez.** Copiarlo inmediatamente a un password manager del equipo (1Password, Bitwarden, etc.).
5. Anotar en la tabla de auditoría (más abajo) la fecha de generación.

### 3. Configurar las env vars

**Dev local** (`/Users/.../admon-website/.env.local`):
```bash
ALEGRA_EMAIL="integration@tu-dominio.com"
ALEGRA_TOKEN="tk_xxxxx"   # pegar el token copiado
```

**Producción** (Vercel/Railway/etc.):
1. Settings → Environment Variables
2. Agregar `ALEGRA_EMAIL` y `ALEGRA_TOKEN` con scope Production (y Preview si querés probar en PRs)
3. Redeploy después del cambio.

### 4. Verificar

Levantar el dashboard local y abrir `/dashboard/finances`. Si las 4 KPI cards muestran números, todo está bien. Si alguna tira "Credenciales inválidas", revisar el `.env.local`.

---

## Rotación del token

### Cuándo rotar

- **Cada 90 días** (caducidad preventiva)
- **Inmediato** si:
  - Un dev con acceso al token deja la empresa
  - El log de Alegra muestra requests con origen inesperado
  - El token fue commiteado al repo por accidente (rotar + limpiar git history con `git filter-repo`)

### Procedimiento

1. Logueado como service user → **Configuración → API** → **"Rotar token"**
2. Copiar el nuevo token al password manager
3. Actualizar `ALEGRA_EMAIL` + `ALEGRA_TOKEN` en:
   - `.env.local` (dev)
   - Variables de entorno de prod (Vercel/Railway)
4. Redeploy prod si aplica
5. Verificar que las KPI cards sigan funcionando después del cambio
6. Anotar en la tabla de auditoría: nueva fecha de rotación

> **Tip**: rotar el token NO requiere cambiar el service user. El mismo user puede tener múltiples tokens activos en Alegra (rotar desactiva el anterior).

---

## Revocación de emergencia

### Cuándo

- Token comprometido / leak confirmado
- Alegra reporta incidente de seguridad de su lado que pueda afectarnos
- Decisión de cerrar la integración completamente

### Procedimiento

1. **Inmediato**: Logueado como Super Admin en Alegra (no como service user) → eliminar el service user o revocar su token desde la sección de Usuarios.
2. **Inmediato**: Rotar/eliminar las env vars de prod (sigue sirviendo el último deploy cacheado hasta que se redeployee).
3. **Avisar** al equipo que la integración está caída.
4. Si se va a restaurar: seguir el flujo de Setup inicial.

---

## Troubleshooting

### Error `AUTH_ERROR` (credenciales inválidas)

**Síntomas**: `/dashboard/finances` muestra "Token inválido — contactar al admin".

**Diagnóstico**:
```bash
# Verificar que las vars están bien en dev (en .env.local):
grep ALEGRA .env.local

# Verificar que NO hay espacios/saltos de línea al pegar el token:
node -e 'console.log(JSON.stringify(require("fs").readFileSync(".env.local","utf-8").match(/ALEGRA_TOKEN=.*/g)))'
```

**Fix más común**: regenerar el token (Alegra a veces lo muestra truncated al pegar), o re-copiar desde el password manager.

### Error `RATE_LIMIT` (429)

**Síntomas**: KPI cards demoran mucho en cargar, log del server muestra `[Alegra] rate limit bajo`.

**Diagnóstico**: el singleton de `getAlegraClient()` ya tiene un threshold de 5 requests — espera automáticamente. Si aún así ves errores, es porque el service user está siendo usado por otra parte (un humano navegando Alegra web).

**Fix**: verificar que el service user solo sea usado por el dashboard (no por humanos). Si la actividad es legítima del dashboard (muchos operators abriendo la página al mismo tiempo), ver sección "Escalar" abajo.

### Error `VALIDATION_ERROR` (Zod fail)

**Síntomas**: `[Alegra] Zod validation failed` en logs, mensaje "Alegra cambió su API — reportar al equipo" en UI.

**Diagnóstico**: revisar el log para ver qué campo falló:
```bash
# El log tiene path + issues con detalle. Buscar la línea:
grep "Zod validation failed" .next/server.log   # o donde se loguee
```

**Causa más probable**: Alegra cambió un endpoint (agregaron un campo requerido, renombraron otro). Ver:
- https://developer.alegra.com/changelog
- El archivo `lib/alegra/types.ts` — el schema Zod que está fallando

**Fix**: actualizar el schema en `lib/alegra/types.ts` y/o `transformers.ts`, agregar test que cubra el nuevo shape, commit.

---

## Si Alegra cambia la API

1. **Detección**: normalmente lo vemos en producción cuando los logs se llenan de `VALIDATION_ERROR`. Mejor: suscribirse al changelog RSS → https://developer.alegra.com/changelog
2. **Triage**: leer el changelog, identificar qué endpoint y qué campo cambió.
3. **Fix local**:
   - Actualizar el schema en `lib/alegra/types.ts` correspondiente
   - Si agregaron un campo útil, agregarlo a los tipos inferidos y opcionalmente exponerlo en la UI
   - Si quitaron un campo, remover del schema
   - Agregar test case en `lib/alegra/__tests__/schemas.test.ts` que cubra el nuevo shape
4. **Deploy**: commit + push + redeploy
5. **Verificación**: abrir las páginas afectadas en dev/prod

---

## Auditoría

Llevar un log de rotaciones en un lugar seguro (1Password, Bitwarden, o un sheet interno):

| Fecha | Acción | Quién | Notas |
|-------|--------|-------|-------|
| YYYY-MM-DD | Setup inicial | Nombre | Service user creado, token generado |
| YYYY-MM-DD | Rotación | Nombre | Caducidad 90d |
| YYYY-MM-DD | Rotación | Nombre | (próxima) |
| YYYY-MM-DD | Incidente | Nombre | Detalle... |

---

## Security checklist

- [ ] El service user tiene el **mínimo de permisos** posible (idealmente solo lectura)
- [ ] El token **NO está** en git history (`git log -p .env.local` debería dar nada)
- [ ] El token **NO está** en logs ni en respuestas de error expuestas al cliente
- [ ] `.env.local` está en `.gitignore` (verificar con `git check-ignore .env.local`)
- [ ] Production env vars están en un secret manager, NO en archivos
- [ ] El equipo sabe dónde está el token de backup (password manager)

---

## Escalación (futuro)

Si el dashboard crece y los 150 req/min/user se quedan cortos:
- **Opción A** (rápida): el dashboard usa un proxy interno que cachea respuestas en memoria con TTL corto (~30s). Reduce requests reales a Alegra sin guardar datos en DB.
- **Opción B** (correcta): webhook de Alegra (`new-invoice`, etc.) + sync incremental a nuestras tablas (V2 del módulo de Finanzas).
- **Opción C** (combinada): service user con rate limit extendido (Alegra tiene planes enterprise con más budget).

---

## Links útiles

- Docs auth Alegra: https://developer.alegra.com/reference/autenticaci%C3%B3n.md
- Rate limit: https://developer.alegra.com/reference/l%C3%ADmite-de-request.md
- Changelog: https://developer.alegra.com/changelog
- Webhooks: https://developer.alegra.com/reference/descripci%C3%B3n-general.md (relevant en V2)

---

**Última actualización**: 2026-06-28 (creado con el módulo de Finanzas V1)
