import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import prisma from '@/lib/db/prisma'

export const authConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        try {
          // Solo validar que el email existe y está activo
          // La verificación OTP ya se hizo en verifyOtp() action

          const { email } = credentials as { email: string }

          if (!email) {
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
      }

      // Re-fetch user data when session update is triggered
      if (trigger === 'update' && token.id) {
        const freshUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, image: true, role: true },
        })
        if (freshUser) {
          token.name = freshUser.name
          token.email = freshUser.email
          token.picture = freshUser.image ? `/api/avatar/${token.id}` : null
          token.role = freshUser.role
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string | null
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
