import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { UserRole } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { LOGIN_GRANT_PREFIX } from './login-grant'

export const authConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        loginToken: { label: 'Login token', type: 'text' },
      },
      /**
       * Autoriza SOLO contra un permiso de un uso emitido por verifyOtp().
       *
       * Antes esta función se conformaba con que el email existiera y el
       * usuario estuviera activo, apoyada en que `signIn('credentials')` se
       * llama únicamente desde verifyOtp() después de validar el código.
       *
       * Esa suposición era falsa: NextAuth expone
       * `/api/auth/callback/credentials` como endpoint HTTP público, y ese
       * endpoint entra acá directo sin pasar por ninguna Server Action. Con
       * dos peticiones —pedir el csrfToken y postear un email— se obtenía una
       * sesión de SUPER_ADMIN sin ver jamás un código. El OTP era un trámite
       * de la interfaz, no un control.
       *
       * El csrfToken no cubría nada de esto: protege contra que OTRO sitio
       * haga que tu navegador postee, no contra alguien que llama la API de
       * frente.
       *
       * Ahora el permiso lo emite verifyOtp() y se consume acá.
       */
      async authorize(credentials) {
        try {
          const { email, loginToken } = credentials as {
            email?: string
            loginToken?: string
          }

          if (!email || !loginToken) {
            return null
          }

          /**
           * Consumir primero y preguntar después.
           *
           * El delete es la operación atómica: si dos peticiones llegan con el
           * mismo token, solo una lo borra y la otra recibe null. Verificar y
           * después borrar dejaría una ventana para reusarlo.
           */
          const permiso = await prisma.verificationToken
            .delete({ where: { token: loginToken } })
            .catch(() => null)

          if (!permiso) {
            console.log('[auth] Login rechazado: permiso inexistente o ya usado')
            return null
          }

          // El permiso está atado al email que lo pidió: uno emitido para otra
          // cuenta no sirve para entrar a esta.
          if (permiso.identifier !== `${LOGIN_GRANT_PREFIX}${email}`) {
            console.log('[auth] Login rechazado: el permiso es de otra cuenta')
            return null
          }

          if (permiso.expires < new Date()) {
            console.log('[auth] Login rechazado: permiso vencido')
            return null
          }

          // Buscar usuario
          const user = await prisma.user.findUnique({
            where: { email },
          })

          if (!user) {
            return null
          }

          // Verificar que está activo
          if (!user.isActive) {
            console.log(`Login blocked: User ${email} is inactive`)
            return null
          }

          // Retornar usuario (sin verificar password)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image ? `/api/avatar/${user.id}` : null,
            role: user.role,
            canAccessControl: user.canAccessControl,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.canAccessControl = user.canAccessControl
      }

      // Re-fetch user data when session update is triggered
      if (trigger === 'update' && token.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            name: true,
            email: true,
            image: true,
            role: true,
            canAccessControl: true,
          },
        })
        if (freshUser) {
          token.name = freshUser.name
          token.email = freshUser.email
          token.picture = freshUser.image ? `/api/avatar/${token.id}` : null
          token.role = freshUser.role
          token.canAccessControl = freshUser.canAccessControl
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string | null
        // Copia perezosa: el token vive 30 días, así que esto puede quedar
        // desactualizado. Sirve para pintar la UI y para el gate barato del
        // middleware — nunca para autorizar una acción. Ver lib/auth/rbac.ts.
        session.user.canAccessControl = token.canAccessControl === true
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig
