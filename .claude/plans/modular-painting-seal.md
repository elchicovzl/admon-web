# Plan: Migración a React Email y Notificaciones de Login

## Contexto

El sistema de autenticación OTP actual funciona correctamente, pero presenta dos problemas principales:

1. **Branding inconsistente**: Los emails de OTP usan colores verdes (#00A86B) que no coinciden con el branding del sitio (Naranja #F1AD32 y Azul #2563EB). El diseño es genérico y no refleja la identidad visual de "Administración Segura".

2. **Falta de notificaciones de seguridad**: No se envía ninguna confirmación cuando alguien inicia sesión exitosamente, lo cual es una práctica recomendada de seguridad para alertar a los usuarios sobre accesos a su cuenta.

Este plan implementa React Email para crear templates profesionales y con el branding correcto, además de agregar un sistema de notificaciones de login exitoso.

---

## Solución Propuesta

### 1. Migrar de HTML strings a React Email

**Beneficios:**
- Components reutilizables y mantenibles
- Preview en desarrollo (`pnpm email:dev`)
- Tipado TypeScript
- Mejor soporte cross-client (Gmail, Outlook, Apple Mail, etc.)

### 2. Crear templates branded

**OTP Email:**
- Header con gradiente Naranja → Azul
- Logo de la empresa
- Código OTP destacado con estilo de marca
- Advertencias de seguridad visuales
- Footer profesional

**Login Success Email:**
- Notificación de acceso exitoso
- Detalles de login (fecha/hora, email)
- Alerta de seguridad ("¿No fuiste tú?")
- Consejos de seguridad

### 3. Mejorar UX del login

- Toast más descriptivo que mencione el email de confirmación
- Feedback visual consistente

---

## Archivos Críticos

### Archivos a Crear:

1. **`/emails/_components/email-layout.tsx`**
   - Layout base reutilizable con fonts (Figtree, Inter) y estructura HTML

2. **`/emails/_components/email-header.tsx`**
   - Header con gradiente naranja-azul y logo

3. **`/emails/_components/email-footer.tsx`**
   - Footer con copyright y disclaimer

4. **`/emails/otp-email.tsx`**
   - Template React del email de OTP con branding

5. **`/emails/login-success-email.tsx`**
   - Template React del email de notificación de login

### Archivos a Modificar:

6. **`/lib/email.ts`** (líneas 1, 24, 96-250)
   - Agregar imports de React Email
   - Crear funciones `sendOtpEmail()` y `sendLoginSuccessEmail()`
   - Mantener `generateOtpEmailHtml()` temporalmente como fallback

7. **`/lib/actions/auth.actions.ts`** (líneas 24, 84-88, 168-182)
   - Importar nuevas funciones de email
   - Actualizar `requestOtp()` para usar `sendOtpEmail()` (línea 84-88)
   - Actualizar `verifyOtp()` para enviar email de login exitoso después de verificación (después de línea 176, antes de línea 179)

8. **`/components/auth/otp-verification-form.tsx`** (líneas 49-51)
   - Mejorar mensaje del toast para mencionar el email de confirmación

9. **`/package.json`**
   - Agregar dependencias: `@react-email/components`, `@react-email/render`
   - Agregar devDependency: `@react-email/cli`
   - Agregar scripts: `email:dev`, `email:export`

---

## Plan de Implementación

### Fase 1: Instalación y Setup (5 min)

**1.1 Instalar React Email**
```bash
pnpm add @react-email/components @react-email/render
pnpm add -D @react-email/cli
```

**1.2 Agregar scripts a package.json**
```json
{
  "scripts": {
    "email:dev": "email dev -p 3001",
    "email:export": "email export"
  }
}
```

**1.3 Crear estructura de directorios**
```
emails/
├── _components/
│   ├── email-layout.tsx
│   ├── email-header.tsx
│   └── email-footer.tsx
├── otp-email.tsx
└── login-success-email.tsx
```

---

### Fase 2: Components Compartidos (15 min)

**2.1 EmailLayout Component** (`emails/_components/email-layout.tsx`)

Props:
- `children: React.ReactNode`
- `previewText?: string`

Features:
- Estructura HTML completa con meta tags responsive
- Importar fonts: Figtree (headings) e Inter (body)
- Container centrado, max-width 600px
- Background #f5f5f5 para contraste

**2.2 EmailHeader Component** (`emails/_components/email-header.tsx`)

Props:
- `title: string`
- `subtitle?: string`

Design:
- Background: `linear-gradient(135deg, #F1AD32, #2563EB)`
- Logo: `/public/images/logoadmon.webp` (usar URL absoluta o Base64)
- Padding: 40px vertical, 30px horizontal
- Typography: Figtree, 24px, blanco, centrado

**2.3 EmailFooter Component** (`emails/_components/email-footer.tsx`)

Content:
- Copyright: `© {year} Administración Segura. Todos los derechos reservados.`
- Disclaimer: "Este es un correo automático, por favor no respondas a este mensaje."
- Estilo: 12px, color gris #6c757d, centrado, background #f8f9fa

---

### Fase 3: Email Templates (30 min)

**3.1 OTP Email Template** (`emails/otp-email.tsx`)

Props:
```typescript
interface OtpEmailProps {
  code: string
  expirationMinutes: number
}
```

Sections:
1. **Header**: "🔐 Código de Acceso"
2. **Greeting**: "Hola,"
3. **Intro**: "Has solicitado acceso al panel administrativo..."
4. **OTP Display**:
   - Font: Courier New, monospace, 48px, bold
   - Color: Naranja #F1AD32
   - Letter-spacing: 12px
   - Background: Gradiente gris claro
   - Border: 3px dashed naranja
   - Border-radius: 12px
5. **Expiration**: "Este código expirará en **{n} minutos**" (rojo)
6. **Security Warning Box**:
   - Background: #fff3cd (amarillo claro)
   - Border-left: 5px solid #ffc107 (amarillo)
   - Icon: ⚠️
   - Bullets:
     - No compartas este código
     - Nunca te pediremos este código
     - Si no lo solicitaste, ignora este email
     - Uso único
7. **Support**: Texto de ayuda
8. **Footer**: Component reutilizable

**3.2 Login Success Email Template** (`emails/login-success-email.tsx`)

Props:
```typescript
interface LoginSuccessEmailProps {
  userName: string
  userEmail: string
  loginTimestamp: Date
  ipAddress?: string
  userAgent?: string
}
```

Sections:
1. **Header**: "✅ Inicio de Sesión Exitoso"
2. **Greeting**: "Hola {userName},"
3. **Message**: "Se ha iniciado sesión en tu cuenta exitosamente."
4. **Login Details Box**:
   - Background: #e7f3ff (azul claro)
   - Border-left: 5px solid #2563EB (azul)
   - Fecha y hora: Formato legible en español
   - Email
   - IP (opcional)
   - Navegador (opcional)
5. **Security Notice Box**:
   - Background: #fff4e6 (naranja claro)
   - Border-left: 5px solid #F1AD32 (naranja)
   - Icon: 🔒
   - Mensaje: "Si no fuiste tú quien inició sesión, contacta a soporte"
6. **Security Tips** (opcional):
   - Nunca compartir OTP
   - Cerrar sesión al terminar
   - Usar conexión segura
7. **Footer**: Component reutilizable

---

### Fase 4: Integración con Email Service (15 min)

**4.1 Actualizar `/lib/email.ts`**

Agregar imports:
```typescript
import { render } from '@react-email/render'
import OtpEmail from '@/emails/otp-email'
import LoginSuccessEmail from '@/emails/login-success-email'
```

Nueva función `sendOtpEmail`:
```typescript
export async function sendOtpEmail({
  to,
  code,
  expirationMinutes = 5,
}: {
  to: string
  code: string
  expirationMinutes?: number
}) {
  const html = render(OtpEmail({ code, expirationMinutes }))

  return sendEmail({
    to,
    subject: 'Tu código de acceso - Administración Segura',
    html,
  })
}
```

Nueva función `sendLoginSuccessEmail`:
```typescript
export async function sendLoginSuccessEmail({
  to,
  userName,
  userEmail,
  loginTimestamp,
  ipAddress,
  userAgent,
}: {
  to: string
  userName: string
  userEmail: string
  loginTimestamp: Date
  ipAddress?: string
  userAgent?: string
}) {
  const html = render(LoginSuccessEmail({
    userName,
    userEmail,
    loginTimestamp,
    ipAddress,
    userAgent
  }))

  return sendEmail({
    to,
    subject: '✅ Inicio de sesión exitoso - Administración Segura',
    html,
  })
}
```

**Mantener:**
- `transporter` configuración (Nodemailer + Gmail)
- `sendEmail()` función base
- `generateOtpEmailHtml()` como fallback (marcar como deprecated)

---

### Fase 5: Integración con Auth Actions (20 min)

**5.1 Actualizar imports en `/lib/actions/auth.actions.ts`** (línea 24)

Cambiar:
```typescript
import { sendEmail, generateOtpEmailHtml } from '@/lib/email'
```

Por:
```typescript
import { sendOtpEmail, sendLoginSuccessEmail } from '@/lib/email'
```

**5.2 Modificar `requestOtp()` función** (líneas 84-88)

Reemplazar:
```typescript
await sendEmail({
  to: email,
  subject: 'Tu código de acceso - Administración Segura',
  html: generateOtpEmailHtml({ code: otpCode, expirationMinutes: 5 }),
})
```

Por:
```typescript
await sendOtpEmail({
  to: email,
  code: otpCode,
  expirationMinutes: 5,
})
```

**5.3 Modificar `verifyOtp()` función** (después de línea 176, antes de 179)

Agregar después de eliminar el token (línea 176) y ANTES de crear la sesión (línea 179):

```typescript
// Obtener datos del usuario para el email
const fullUser = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    name: true,
    email: true
  },
})

if (!fullUser) {
  console.error('[OTP] User not found after verification')
  return { success: false, error: 'Error en la verificación' }
}

// Enviar email de notificación de login (no bloqueante)
try {
  await sendLoginSuccessEmail({
    to: email,
    userName: fullUser.name || 'Usuario',
    userEmail: email,
    loginTimestamp: new Date(),
    // Opcional: Agregar IP y user agent desde headers si es necesario
  })
} catch (emailError) {
  // Log error pero NO fallar el login
  console.error('[OTP] Login success email failed:', emailError)
}
```

**Lógica:**
- Enviar email DESPUÉS de validar OTP y eliminar token
- Enviar email ANTES de crear sesión (usuario autenticado pero no logueado todavía)
- Usar try-catch para NO bloquear login si el email falla
- Fire-and-forget: no esperar confirmación de envío

---

### Fase 6: Mejorar Toast Notification (5 min)

**6.1 Actualizar `/components/auth/otp-verification-form.tsx`** (líneas 49-51)

Reemplazar:
```typescript
toast.success('¡Bienvenido!', {
  description: 'Acceso concedido',
})
```

Por:
```typescript
toast.success('¡Inicio de sesión exitoso!', {
  description: 'Te hemos enviado un correo de confirmación',
  duration: 4000,
})
```

**Mejoras:**
- Título más descriptivo
- Informar al usuario sobre el email de confirmación
- Duration de 4 segundos para que pueda leerlo

---

## Verificación End-to-End

### 1. Preview de Templates (Desarrollo)

```bash
# Iniciar preview server
pnpm email:dev

# Abrir en navegador
# http://localhost:3001
```

**Checklist visual:**
- [ ] Logo se muestra correctamente
- [ ] Gradiente naranja-azul en header
- [ ] Código OTP con estilo naranja destacado
- [ ] Warnings de seguridad visibles
- [ ] Footer con año actual
- [ ] Responsive en móvil
- [ ] Legible en dark mode (email clients)

### 2. Testing de Flujo Completo

**Test 1: Login OTP Exitoso**

1. Ir a `/login`
2. Ingresar email válido
3. **Verificar**: Email OTP llega con nuevo diseño branded
4. **Verificar**: Header tiene gradiente naranja-azul
5. **Verificar**: Logo visible
6. **Verificar**: Código OTP destacado en naranja
7. Ingresar código OTP
8. **Verificar**: Toast dice "¡Inicio de sesión exitoso! - Te hemos enviado un correo de confirmación"
9. **Verificar**: Email de login success llega
10. **Verificar**: Email muestra timestamp correcto
11. **Verificar**: Email tiene diseño branded
12. **Verificar**: Redirige a `/dashboard`

**Test 2: OTP Expirado**

1. Solicitar OTP
2. Esperar 6 minutos
3. Intentar verificar
4. **Verificar**: Error mostrado, NO se envía email de login success

**Test 3: Email Inválido**

1. Solicitar OTP con email no registrado
2. **Verificar**: Mensaje genérico (no revela si existe)
3. **Verificar**: NO se envía email

**Test 4: Resend OTP**

1. Solicitar OTP
2. Esperar 60 segundos
3. Click "Reenviar código"
4. **Verificar**: Nuevo email OTP con diseño branded

### 3. Testing Cross-Client

**Email clients a probar:**
- Gmail (web y mobile)
- Outlook (web)
- Apple Mail (iOS)
- Dark mode en iOS Mail

**Verificar:**
- [ ] No hay imágenes rotas
- [ ] Fonts se cargan correctamente (o fallback a Arial)
- [ ] Colores se muestran correctamente
- [ ] Responsive en móvil
- [ ] No marcado como spam

### 4. Testing de Errores

**Caso 1: Render de React Email falla**
- Simular error en `render()`
- **Verificar**: Fallback a template antiguo (si mantenemos `generateOtpEmailHtml()`)
- **Verificar**: Error logueado pero no expuesto al usuario

**Caso 2: Email service falla**
- Credenciales Gmail incorrectas
- **Verificar**: Login todavía funciona (email de login success falla silenciosamente)
- **Verificar**: Error logueado en consola

---

## Consideraciones de Seguridad

1. **IP Address y User Agent (Opcional)**:
   - Se puede agregar extrayendo de headers en server actions
   - Requiere acceso a `headers()` de Next.js
   - Útil para detectar accesos sospechosos

2. **Email no bloquea login**:
   - Usar try-catch en envío de email de login success
   - Si email falla, login procede normalmente
   - Error logueado pero no expuesto al usuario

3. **Datos sensibles**:
   - NO incluir contraseñas (no aplicable, usamos OTP)
   - NO incluir datos de tarjetas de crédito
   - OTP codes son seguros porque:
     - Se hashean en DB
     - Expiran en 5 minutos
     - Un solo uso
     - Se eliminan después de verificación

4. **SPAM Prevention**:
   - Rate limiting ya implementado (3 intentos/15 min)
   - Emails transaccionales, no marketing
   - SPF/DKIM configurado en Gmail

---

## Rollback Plan

Si hay problemas en producción:

1. **Revertir a emails HTML antiguos**:
   - Comentar imports de React Email en `/lib/email.ts`
   - Descomentar `generateOtpEmailHtml()`
   - Revertir cambios en `/lib/actions/auth.actions.ts`

2. **Deshabilitar email de login success**:
   - Comentar el bloque try-catch en `verifyOtp()`
   - Login seguirá funcionando normalmente

3. **Deploy hotfix**:
   - Commit rollback changes
   - Deploy inmediato
   - Investigar issue offline

---

## Mejoras Futuras (Post-MVP)

1. **Email Analytics**:
   - Tracking de open rates
   - Click-through rates
   - Delivery rates

2. **Personalización adicional**:
   - Incluir rol del usuario en email
   - Timestamps con timezone del usuario
   - Idioma basado en preferencias

3. **Preferencias de usuario**:
   - Agregar campo `emailNotificationsEnabled` a User model
   - Settings page para deshabilitar notificaciones
   - Migración de Prisma

4. **Templates adicionales**:
   - Welcome email (cuando admin crea usuario)
   - Account deactivation notice
   - Password reset (si cambiamos de OTP-only)

5. **Queue-based email sending**:
   - Usar BullMQ o similar
   - Retry automático en caso de fallo
   - Mejor monitoreo

---

## Estimación de Tiempo

- **Fase 1 (Setup)**: 5 min
- **Fase 2 (Components)**: 15 min
- **Fase 3 (Templates)**: 30 min
- **Fase 4 (Email Service)**: 15 min
- **Fase 5 (Auth Actions)**: 20 min
- **Fase 6 (Toast)**: 5 min
- **Testing**: 30 min

**Total estimado**: ~2 horas de implementación + testing

---

## Resumen de Deliverables

✅ **React Email Setup**
- Dependencies instaladas
- Scripts configurados
- Preview server funcionando

✅ **Components Compartidos**
- EmailLayout con branding
- EmailHeader con gradiente naranja-azul
- EmailFooter profesional

✅ **Email Templates Branded**
- OTP Email con diseño de marca
- Login Success Email con notificaciones de seguridad

✅ **Integración Completa**
- Email service actualizado
- Auth actions integrados
- Toast mejorado

✅ **Testing y QA**
- Preview de templates
- Flujo end-to-end verificado
- Cross-client testing
- Error handling validado
